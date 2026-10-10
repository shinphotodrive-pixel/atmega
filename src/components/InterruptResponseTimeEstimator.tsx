import React, { useState, useMemo } from 'react';
import {
  Clock,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
  Cpu,
  Layers,
  ArrowRight,
  ShieldAlert,
  Info,
  Code2,
  Sliders,
  RotateCcw,
  Gauge,
  CornerDownRight,
  Sparkles,
  Database,
  Terminal,
  Bookmark,
  ShieldCheck,
  TrendingDown,
  Timer,
  Play,
  Flame,
  FileCode,
  CheckCircle2,
  AlertOctagon
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

export interface InterruptResponseTimeEstimatorProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

// Preset real-time scenarios
interface RealTimeScenario {
  id: string;
  name: string;
  tag: string;
  description: string;
  cpuFreqMhz: number;
  criticalSectionInstructions: number;
  criticalSectionAvgCycles: number;
  interruptedInstCycles: number;
  interferingIsrInstructions: number;
  interferingIsrPreSeiInstructions: number;
  targetIsrPrologueInstructions: number;
  nestingMode: 'noblock' | 'manual_sei' | 'blocked' | 'prioritized';
  targetDeadlineUs: number;
  triggerVector: string;
  interferingVector: string;
}

const PRESET_SCENARIOS: RealTimeScenario[] = [
  {
    id: 'motor-foc-stepper',
    name: '모터 FOC / 고속 스텝 제어 (Hard Real-Time)',
    tag: '극초지연 5µs',
    description: '타이머 오버플로로 모터 드라이버 PWM을 갱신하는 엄격한 실시간 제어. 지연 5µs 초과 시 탈조나 코일 과전류 위험이 있습니다.',
    cpuFreqMhz: 16,
    criticalSectionInstructions: 6,
    criticalSectionAvgCycles: 1.5,
    interruptedInstCycles: 3,
    interferingIsrInstructions: 32,
    interferingIsrPreSeiInstructions: 8,
    targetIsrPrologueInstructions: 6,
    nestingMode: 'noblock',
    targetDeadlineUs: 5.0,
    triggerVector: 'TIMER1_COMPA_vect',
    interferingVector: 'USART0_RX_vect'
  },
  {
    id: 'uart-ringbuffer-spi',
    name: '고속 통신 수신 (115.2kbps UART & SPI DMA)',
    tag: '통신 버퍼 보호',
    description: 'UART 수신 버퍼 오버런(Overrun)을 방지하기 위해 SPI 센서 폴링 ISR 중간에 UART 인터럽트를 중첩 허용(Nested ISR)하는 구조.',
    cpuFreqMhz: 16,
    criticalSectionInstructions: 12,
    criticalSectionAvgCycles: 1.33,
    interruptedInstCycles: 2,
    interferingIsrInstructions: 45,
    interferingIsrPreSeiInstructions: 10,
    targetIsrPrologueInstructions: 8,
    nestingMode: 'manual_sei',
    targetDeadlineUs: 20.0,
    triggerVector: 'USART0_RX_vect',
    interferingVector: 'SPI_STC_vect'
  },
  {
    id: 'rotary-encoder-gui',
    name: '로터리 엔코더 펄스 캡처 & OLED GUI',
    tag: 'Jitter 민감',
    description: 'OLED 화면 갱신 중 긴 cli() 임계 구역 때문에 엔코더 펄스 카운트 누락이 발생하지 않도록 최대 반응 시간을 제어.',
    cpuFreqMhz: 16,
    criticalSectionInstructions: 28,
    criticalSectionAvgCycles: 1.4,
    interruptedInstCycles: 4,
    interferingIsrInstructions: 60,
    interferingIsrPreSeiInstructions: 15,
    targetIsrPrologueInstructions: 5,
    nestingMode: 'prioritized',
    targetDeadlineUs: 15.0,
    triggerVector: 'PCINT0_vect',
    interferingVector: 'TIMER0_OVF_vect'
  },
  {
    id: 'low-power-iot',
    name: '1MHz 저전력 IoT 센서 노드 (Sleep Wakeup)',
    tag: '저클럭 1MHz',
    description: '배터리 소모를 줄이기 위해 1MHz 클럭으로 동작 중 외부 인터럽트(INT0)로 센서 신호를 감지하여 반응하는 구조.',
    cpuFreqMhz: 1,
    criticalSectionInstructions: 4,
    criticalSectionAvgCycles: 1.25,
    interruptedInstCycles: 2,
    interferingIsrInstructions: 20,
    interferingIsrPreSeiInstructions: 6,
    targetIsrPrologueInstructions: 7,
    nestingMode: 'blocked',
    targetDeadlineUs: 80.0,
    triggerVector: 'INT0_vect',
    interferingVector: 'WDT_vect'
  },
  {
    id: 'e-stop-safety',
    name: '비상 정지 (Emergency Stop / INT0 최우선순위)',
    tag: 'Naked 최소 지연',
    description: '산업용 장비 비상 스위치 입력 시 컨텍스트 백업을 생략한 Naked ISR로 1µs 이내에 전원을 차단하는 최우선순위 안전 구조.',
    cpuFreqMhz: 20,
    criticalSectionInstructions: 2,
    criticalSectionAvgCycles: 1.0,
    interruptedInstCycles: 2,
    interferingIsrInstructions: 15,
    interferingIsrPreSeiInstructions: 0,
    targetIsrPrologueInstructions: 2,
    nestingMode: 'noblock',
    targetDeadlineUs: 2.0,
    triggerVector: 'INT0_vect',
    interferingVector: 'TIMER2_COMPA_vect'
  }
];

export const InterruptResponseTimeEstimator: React.FC<InterruptResponseTimeEstimatorProps> = ({
  selectedMCU,
  onSelectMCU
}) => {
  const profile = MCU_PROFILES[selectedMCU];

  // 1. Core Configurable Parameters
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('motor-foc-stepper');
  const [cpuFreqMhz, setCpuFreqMhz] = useState<number>(16);
  
  // Critical section (cli / ATOMIC_BLOCK) instruction count
  const [criticalSectionInstructions, setCriticalSectionInstructions] = useState<number>(6);
  const [criticalSectionAvgCycles, setCriticalSectionAvgCycles] = useState<number>(1.5);
  
  // Current executing instruction cycles at the moment interrupt fires (1 to 4 cycles)
  const [interruptedInstCycles, setInterruptedInstCycles] = useState<number>(3);
  
  // Nested / Interfering ISR parameters
  const [nestingMode, setNestingMode] = useState<'noblock' | 'manual_sei' | 'blocked' | 'prioritized'>('noblock');
  const [interferingIsrInstructions, setInterferingIsrInstructions] = useState<number>(32);
  const [interferingIsrPreSeiInstructions, setInterferingIsrPreSeiInstructions] = useState<number>(8);
  const [interferingIsrAvgCycles, setInterferingIsrAvgCycles] = useState<number>(1.5);

  // Target ISR parameters
  const [targetIsrPrologueInstructions, setTargetIsrPrologueInstructions] = useState<number>(6);
  const [targetIsrAvgCycles, setTargetIsrAvgCycles] = useState<number>(1.67);
  
  // Real-time deadline requirement (in microseconds)
  const [targetDeadlineUs, setTargetDeadlineUs] = useState<number>(5.0);

  // Vectors name for labeling
  const [triggerVector, setTriggerVector] = useState<string>('TIMER1_COMPA_vect');
  const [interferingVector, setInterferingVector] = useState<string>('USART0_RX_vect');

  // Code generator state
  const [codeType, setCodeType] = useState<'gcc_noblock' | 'atomic_block' | 'prioritized_mask' | 'naked_fast'>('gcc_noblock');
  const [copiedCode, setCopiedCode] = useState(false);

  // Load preset scenario
  const handleSelectScenario = (scenario: RealTimeScenario) => {
    setSelectedScenarioId(scenario.id);
    setCpuFreqMhz(scenario.cpuFreqMhz);
    setCriticalSectionInstructions(scenario.criticalSectionInstructions);
    setCriticalSectionAvgCycles(scenario.criticalSectionAvgCycles);
    setInterruptedInstCycles(scenario.interruptedInstCycles);
    setInterferingIsrInstructions(scenario.interferingIsrInstructions);
    setInterferingIsrPreSeiInstructions(scenario.interferingIsrPreSeiInstructions);
    setTargetIsrPrologueInstructions(scenario.targetIsrPrologueInstructions);
    setNestingMode(scenario.nestingMode);
    setTargetDeadlineUs(scenario.targetDeadlineUs);
    setTriggerVector(scenario.triggerVector);
    setInterferingVector(scenario.interferingVector);
  };

  // Hardware Vector Jump Cost (4 cycles on 16-bit PC: mega328p/128/640)
  const HW_VECTOR_JUMP_CYCLES = 4;
  const HW_RETI_CYCLES = 4;

  // 2. Calculations
  const calculations = useMemo(() => {
    const cycleTimeNs = (1 / cpuFreqMhz) * 1000; // ns per cycle
    const cycleTimeUs = 1 / cpuFreqMhz; // µs per cycle

    // Phase A: Critical Section (Global Interrupt Disabled: cli / ATOMIC_BLOCK)
    // In worst-case, interrupt trigger occurs at instruction 0 of the critical section.
    const critCycles = Math.round(criticalSectionInstructions * criticalSectionAvgCycles);
    const critTimeNs = critCycles * cycleTimeNs;

    // AVR Hardware Rule: After sei() executes, the CPU is guaranteed to execute at least 1 foreground instruction
    // before the interrupt is recognized.
    const postSeiInstCycles = interruptedInstCycles;
    const postSeiTimeNs = postSeiInstCycles * cycleTimeNs;

    // Phase B: Interfering / Nested ISR Overhead
    // If nesting is 'blocked' (standard non-nested ISR):
    // Target ISR must wait for the ENTIRE interfering ISR to complete + RETI (4 cyc).
    // If nesting is 'noblock' or 'manual_sei':
    // Target ISR only waits until interfering ISR executes its prologue + pre-sei instructions, then enables sei()!
    let interferingWaitCycles = 0;
    let interferingDesc = '';

    if (nestingMode === 'blocked') {
      // Non-nested: vector jump (4) + full ISR execution + RETI (4) + 1 instruction
      const fullIsrCycles = Math.round(interferingIsrInstructions * interferingIsrAvgCycles);
      interferingWaitCycles = HW_VECTOR_JUMP_CYCLES + fullIsrCycles + HW_RETI_CYCLES + 1;
      interferingDesc = `비중첩(Non-Nested) 모드: 선행 ISR 전체 실행(${interferingIsrInstructions}개 명령) + RETI 대기`;
    } else if (nestingMode === 'noblock') {
      // GCC ISR_NOBLOCK: vector jump (4) + prologue (typically 8~12 cyc) + sei() happens immediately in prologue
      const preSeiCycles = Math.round(interferingIsrPreSeiInstructions * interferingIsrAvgCycles);
      interferingWaitCycles = HW_VECTOR_JUMP_CYCLES + preSeiCycles;
      interferingDesc = `ISR_NOBLOCK 중첩: 선행 ISR의 진입 및 sei() 직전까지(${interferingIsrPreSeiInstructions}개 명령) 대기`;
    } else if (nestingMode === 'manual_sei') {
      // Manual sei: vector jump (4) + context save pushes (e.g. 14 cyc) + preSei code + sei instruction (1 cyc)
      const preSeiCycles = Math.round(interferingIsrPreSeiInstructions * interferingIsrAvgCycles) + 1;
      interferingWaitCycles = HW_VECTOR_JUMP_CYCLES + preSeiCycles;
      interferingDesc = `수동 sei() 중첩: 선행 ISR의 컨텍스트 저장 및 지정 명령(${interferingIsrPreSeiInstructions}개) 실행 후 선점 허용`;
    } else {
      // Prioritized: High priority preempts low priority immediately after minimal mask
      const maskCycles = 4;
      interferingWaitCycles = HW_VECTOR_JUMP_CYCLES + maskCycles;
      interferingDesc = `소프트웨어 우선순위 마스킹: 인터럽트 마스크 설정 후 즉시 최우선순위 선점 허용`;
    }

    const interferingTimeNs = interferingWaitCycles * cycleTimeNs;

    // Phase C: Target ISR Entry & Prologue
    // Vector Jump (4 cycles) + Prologue Register Saves (targetIsrPrologueInstructions * avgCycles)
    const targetVectorCycles = HW_VECTOR_JUMP_CYCLES;
    const targetPrologueCycles = Math.round(targetIsrPrologueInstructions * targetIsrAvgCycles);
    const targetEntryCycles = targetVectorCycles + targetPrologueCycles;
    const targetEntryTimeNs = targetEntryCycles * cycleTimeNs;

    // Total Worst-Case Latency
    const maxLatencyCycles = critCycles + postSeiInstCycles + interferingWaitCycles + targetEntryCycles;
    const maxLatencyNs = maxLatencyCycles * cycleTimeNs;
    const maxLatencyUs = maxLatencyNs / 1000;

    // Best-Case Latency:
    // CPU in IDLE sleep or single-cycle NOP, no critical section, no interfering ISR.
    // Vector jump (4 cyc) + Target prologue
    const minLatencyCycles = HW_VECTOR_JUMP_CYCLES + targetPrologueCycles;
    const minLatencyNs = minLatencyCycles * cycleTimeNs;
    const minLatencyUs = minLatencyNs / 1000;

    // Average / Typical Latency
    const avgCritCycles = Math.round(critCycles * 0.3);
    const avgInterferingCycles = Math.round(interferingWaitCycles * 0.4);
    const avgLatencyCycles = avgCritCycles + 2 + avgInterferingCycles + targetEntryCycles;
    const avgLatencyUs = (avgLatencyCycles * cycleTimeNs) / 1000;

    // Jitter
    const jitterCycles = maxLatencyCycles - minLatencyCycles;
    const jitterUs = maxLatencyUs - minLatencyUs;

    // Deadline Evaluation
    const meetsDeadline = maxLatencyUs <= targetDeadlineUs;
    const deadlineMarginUs = targetDeadlineUs - maxLatencyUs;
    const deadlineMarginPercent = (deadlineMarginUs / targetDeadlineUs) * 100;

    // Stack Overhead of Nesting (Bytes)
    // PC (2 bytes for 128KB/32KB, 3 for 256KB) + SREG (1) + saved GPRs (~2 bytes per instruction saved)
    const stackPerLevel = 2 + 1 + Math.min(32, targetIsrPrologueInstructions * 2);
    const totalStackEstimated = nestingMode === 'blocked' ? stackPerLevel : stackPerLevel * 2 + 4;

    return {
      cycleTimeNs,
      cycleTimeUs,
      critCycles,
      critTimeNs,
      postSeiInstCycles,
      postSeiTimeNs,
      interferingWaitCycles,
      interferingTimeNs,
      interferingDesc,
      targetVectorCycles,
      targetPrologueCycles,
      targetEntryCycles,
      targetEntryTimeNs,
      maxLatencyCycles,
      maxLatencyNs,
      maxLatencyUs,
      minLatencyCycles,
      minLatencyNs,
      minLatencyUs,
      avgLatencyCycles,
      avgLatencyUs,
      jitterCycles,
      jitterUs,
      meetsDeadline,
      deadlineMarginUs,
      deadlineMarginPercent,
      totalStackEstimated
    };
  }, [
    cpuFreqMhz,
    criticalSectionInstructions,
    criticalSectionAvgCycles,
    interruptedInstCycles,
    interferingIsrInstructions,
    interferingIsrPreSeiInstructions,
    interferingIsrAvgCycles,
    targetIsrPrologueInstructions,
    targetIsrAvgCycles,
    nestingMode,
    targetDeadlineUs
  ]);

  // Timeline breakdown segments for the visual bar
  const timelineSegments = useMemo(() => {
    const total = calculations.maxLatencyCycles || 1;
    return [
      {
        id: 'crit',
        name: '임계 구역 (cli/ATOMIC)',
        cycles: calculations.critCycles,
        timeNs: calculations.critTimeNs,
        percent: (calculations.critCycles / total) * 100,
        color: '#f59e0b', // Amber
        desc: `${criticalSectionInstructions}개 어셈블리 명령 실행 중 인터럽트 비활성 대기`
      },
      {
        id: 'post_sei',
        name: '실행 중 명령 완결',
        cycles: calculations.postSeiInstCycles,
        timeNs: calculations.postSeiTimeNs,
        percent: (calculations.postSeiInstCycles / total) * 100,
        color: '#64748b', // Slate
        desc: `sei() 직후 최소 1개 명령 실행 보장 및 멀티사이클 명령 완료 (${interruptedInstCycles}사이클)`
      },
      {
        id: 'interfering',
        name: `선행 ISR 지연 (${nestingMode.toUpperCase()})`,
        cycles: calculations.interferingWaitCycles,
        timeNs: calculations.interferingTimeNs,
        percent: (calculations.interferingWaitCycles / total) * 100,
        color: '#8b5cf6', // Violet
        desc: calculations.interferingDesc
      },
      {
        id: 'target_vector',
        name: '타깃 HW 벡터 점프',
        cycles: calculations.targetVectorCycles,
        timeNs: calculations.targetVectorCycles * calculations.cycleTimeNs,
        percent: (calculations.targetVectorCycles / total) * 100,
        color: '#3b82f6', // Blue
        desc: `AVR 하드웨어 인터럽트 디스패치 및 프로그램 카운터(PC) 푸시 (4 사이클)`
      },
      {
        id: 'target_prologue',
        name: '타깃 ISR 프롤로그',
        cycles: calculations.targetPrologueCycles,
        timeNs: calculations.targetPrologueCycles * calculations.cycleTimeNs,
        percent: (calculations.targetPrologueCycles / total) * 100,
        color: '#10b981', // Emerald
        desc: `타깃 ISR 본문 직전 레지스터(${targetIsrPrologueInstructions}개 명령) 컨텍스트 스택 PUSH`
      }
    ].filter(s => s.cycles > 0);
  }, [calculations, criticalSectionInstructions, interruptedInstCycles, nestingMode, targetIsrPrologueInstructions]);

  // Safe AVR-GCC C Code Generator for Nested Interrupts
  const generatedCode = useMemo(() => {
    if (codeType === 'gcc_noblock') {
      return `// ========================================================
// 1. AVR-GCC ISR_NOBLOCK 특성을 이용한 자동 중첩 인터럽트
// ========================================================
#include <avr/io.h>
#include <avr/interrupt.h>

// 선행 ISR: ISR_NOBLOCK 플래그를 주어 진입 즉시 sei()가 호출되도록 설정
// 높은 우선순위의 ${triggerVector} 가 언제든 선점(Preemption)할 수 있습니다.
ISR(${interferingVector}, ISR_NOBLOCK) {
    // 주의: 동일 인터럽트 재진입 방지를 위해 인터럽트 플래그가 자동 클리어되거나
    // 인터럽트 마스크를 일시 해제해야 안전합니다.
    volatile uint8_t rx = UDR0;
    // ... 백그라운드 데이터 처리 ...
}

// 타깃 실시간 ISR: 최우선순위로 즉시 실행
ISR(${triggerVector}) {
    // 지연 시간: 최대 ${calculations.maxLatencyUs.toFixed(2)} µs 이내 응답
    PORTB ^= _BV(PB5); // 모터 펄스 또는 초고속 액추에이터 제어
}`;
    }

    if (codeType === 'atomic_block') {
      return `// ========================================================
// 2. <util/atomic.h> 안전한 임계 구역 (Critical Section) 최소화
// ========================================================
#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/atomic.h>

volatile uint32_t g_shared_encoder_ticks = 0;

void update_system_state(void) {
    // ATOMIC_RESTORESTATE: 이전 SREG 인터럽트 상태를 백업하고 복원
    // 임계 구역 크기: 약 ${criticalSectionInstructions}개 어셈블리 명령 (${calculations.critCycles} Cycles / ${(calculations.critTimeNs / 1000).toFixed(2)} µs)
    ATOMIC_BLOCK(ATOMIC_RESTORESTATE) {
        g_shared_encoder_ticks++;
        // 실시간성을 위해 임계 구역 내부에는 복잡한 연산, 루프, 함수 호출을 절대 금지!
    }
    // 임계 구역 탈출 즉시 ${triggerVector} 응답 가능
}`;
    }

    if (codeType === 'prioritized_mask') {
      return `// ========================================================
// 3. 소프트웨어 인터럽트 우선순위 마스킹 (Priority Masking)
// ========================================================
#include <avr/io.h>
#include <avr/interrupt.h>

// 낮은 우선순위 인터럽트에서 자기 자신 및 더 낮은 인터럽트만 마스킹 후 sei()
ISR(${interferingVector}) {
    // 1. 현재 인터럽트 비활성화 (자기 자신 재진입 방지)
    UCSR0B &= ~_BV(RXCIE0);
    
    // 2. 전역 인터럽트 허용 -> ${triggerVector}는 언제든 선점 가능!
    sei();

    // 3. 작업 수행
    process_communication_packet();

    // 4. 복귀 전 인터럽트 다시 마스크 해제
    cli();
    UCSR0B |= _BV(RXCIE0);
}

ISR(${triggerVector}) {
    // 최우선순위 ISR 실행 (최대 지연 ${calculations.maxLatencyUs.toFixed(2)} µs)
    PINB = _BV(PB5);
}`;
    }

    // naked_fast
    return `// ========================================================
// 4. Naked ISR 극한의 초저지연 (Extreme Low Latency / E-Stop)
// ========================================================
#include <avr/io.h>
#include <avr/interrupt.h>

// ISR_NAKED: 컴파일러의 자동 프롤로그(PUSH) 및 에필로그(POP/RETI)를 완전 제거
// 최우선순위 비상 정지(INT0) 전용: 4 Cycles (Vector) + 1 Cycle (OUT/SBI) = 5 Cycles 응답!
ISR(${triggerVector}, ISR_NAKED) {
    // 어셈블리로 레지스터 손상 없이 단일 포트 즉시 차단
    __asm__ __volatile__(
        "sbi %0, %1 \\n\\t"   // 1~2 cycle: 비상 릴레이 즉시 OFF
        "reti       \\n\\t"   // 4 cycle: 복귀
        :: "I" (_SFR_IO_ADDR(PORTD)), "I" (PD2)
    );
}`;
  }, [codeType, triggerVector, interferingVector, calculations, criticalSectionInstructions]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-rose-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
            <Timer className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg font-bold text-white tracking-wide">
                Interrupt Response Time Estimator
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold">
                실시간 펌웨어 최대 지연 분석기
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                {profile.fullName} ({cpuFreqMhz} MHz)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              CPU 주파수, 임계 구역(Critical Section) 명령 수, 중첩 인터럽트(Nested ISR) 선점 구조를 종합 시뮬레이션하여 워스트케이스 최대 지연 시간 및 지터(Jitter)를 계산합니다.
            </p>
          </div>
        </div>

        {/* Quick MCU Switch if prop provided */}
        {onSelectMCU && (
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs self-start lg:self-center">
            {(['atmega328p', 'atmega128', 'atmega640'] as SupportedMCU[]).map(mcu => (
              <button
                key={mcu}
                onClick={() => onSelectMCU(mcu)}
                className={`px-2.5 py-1 rounded-lg font-mono font-medium transition-all ${
                  selectedMCU === mcu
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mcu === 'atmega328p' ? '328P' : mcu === 'atmega128' ? 'M128' : 'M640'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Preset Scenarios Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            실시간 펌웨어 응답 시나리오 프리셋
          </span>
          <span className="text-slate-500">실전 제어 시스템의 클럭 및 지연 요구조건을 원클릭으로 불러옵니다</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {PRESET_SCENARIOS.map(sc => {
            const isSelected = selectedScenarioId === sc.id;
            return (
              <button
                key={sc.id}
                onClick={() => handleSelectScenario(sc)}
                className={`text-left p-3 rounded-xl border transition-all relative overflow-hidden group ${
                  isSelected
                    ? 'bg-amber-950/40 border-amber-500/60 shadow-md shadow-amber-500/10'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className={`text-xs font-bold truncate ${isSelected ? 'text-amber-300' : 'text-slate-200'}`}>
                    {sc.name.split(' (')[0]}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-medium shrink-0 ${
                    isSelected
                      ? 'bg-amber-500/30 text-amber-200 border border-amber-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {sc.tag}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                  {sc.description}
                </p>
                {isSelected && (
                  <div className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-bl" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Maximum Worst-Case Latency */}
        <div className={`p-4 rounded-xl border relative overflow-hidden ${
          calculations.meetsDeadline
            ? 'bg-slate-950/80 border-slate-800'
            : 'bg-rose-950/30 border-rose-500/50'
        }`}>
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>최대 반응 지연 (Worst Latency)</span>
            <AlertTriangle className={`w-3.5 h-3.5 ${calculations.meetsDeadline ? 'text-amber-400' : 'text-rose-400'}`} />
          </div>
          <div className={`text-2xl font-bold font-mono mt-1 ${
            calculations.meetsDeadline ? 'text-amber-400' : 'text-rose-400'
          }`}>
            {calculations.maxLatencyUs.toFixed(2)} <span className="text-xs font-normal text-slate-400">µs</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {calculations.maxLatencyCycles.toLocaleString()} CPU 사이클 ({calculations.maxLatencyNs.toLocaleString()} ns)
          </div>
        </div>

        {/* Real-time Deadline Margin */}
        <div className={`p-4 rounded-xl border ${
          calculations.meetsDeadline
            ? 'bg-emerald-950/20 border-emerald-500/40'
            : 'bg-rose-950/40 border-rose-500/60'
        }`}>
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>목표 마감 시간 (Deadline)</span>
            {calculations.meetsDeadline ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
            )}
          </div>
          <div className={`text-2xl font-bold font-mono mt-1 ${
            calculations.meetsDeadline ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {targetDeadlineUs.toFixed(1)} <span className="text-xs font-normal text-slate-400">µs</span>
          </div>
          <div className={`text-[10px] font-mono mt-0.5 font-medium ${
            calculations.meetsDeadline ? 'text-emerald-300' : 'text-rose-300'
          }`}>
            {calculations.meetsDeadline
              ? `여유 마진: +${calculations.deadlineMarginUs.toFixed(2)} µs (${calculations.deadlineMarginPercent.toFixed(1)}%)`
              : `마감 초과 위반: ${Math.abs(calculations.deadlineMarginUs).toFixed(2)} µs 초과!`}
          </div>
        </div>

        {/* Jitter (Max - Min Latency) */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>타이밍 지터 (Jitter)</span>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-400 font-mono mt-1">
            {calculations.jitterUs.toFixed(2)} <span className="text-xs font-normal text-slate-400">µs</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            최소 {calculations.minLatencyUs.toFixed(2)} µs ~ 최대 {calculations.maxLatencyUs.toFixed(2)} µs (Δ {calculations.jitterCycles} cyc)
          </div>
        </div>

        {/* Stack Memory Consumption */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>중첩 스택 소비량 (Stack Depth)</span>
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-indigo-400 font-mono mt-1">
            {calculations.totalStackEstimated} <span className="text-xs font-normal text-slate-400">Bytes</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            PC 백업 + SREG + 임시 레지스터 PUSH 누적
          </div>
        </div>
      </div>

      {/* Visual Timing Waterfall & Latency Breakdown Bar */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-inner">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white tracking-wide">
              워스트케이스 지연 구성 타임라인 (Latency Breakdown Waterfall)
            </h4>
          </div>
          <div className="text-xs font-mono text-slate-400">
            1 클럭 사이클 = <span className="text-amber-300 font-bold">{calculations.cycleTimeNs.toFixed(2)} ns</span> (@ {cpuFreqMhz}MHz)
          </div>
        </div>

        {/* Stacked Proportional Bar */}
        <div className="w-full h-11 bg-slate-900 rounded-xl border border-slate-700/80 overflow-hidden flex shadow-inner">
          {timelineSegments.map(seg => (
            <div
              key={seg.id}
              style={{
                width: `${seg.percent}%`,
                backgroundColor: seg.color
              }}
              className="h-full relative group cursor-pointer transition-all hover:brightness-110 flex flex-col justify-center px-1.5 overflow-hidden select-none"
              title={`${seg.name}\n사이클: ${seg.cycles} Cycles (${(seg.timeNs / 1000).toFixed(2)} µs)\n점유율: ${seg.percent.toFixed(1)}%\n${seg.desc}`}
            >
              {seg.percent > 10 && (
                <span className="text-[10px] font-bold text-white truncate drop-shadow">
                  {seg.name.split(' (')[0]}
                </span>
              )}
              {seg.percent > 15 && (
                <span className="text-[9px] font-mono text-white/90 truncate drop-shadow">
                  {(seg.timeNs / 1000).toFixed(2)}µs ({seg.cycles}c)
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Legend & Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-1 text-xs">
          {timelineSegments.map(seg => (
            <div key={seg.id} className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-[11px] font-bold text-slate-200 truncate">{seg.name}</span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between">
                <span>{seg.cycles} 사이클</span>
                <span className="font-semibold text-slate-200">{(seg.timeNs / 1000).toFixed(2)} µs</span>
              </div>
              <div className="text-[9px] text-slate-500 mt-1 line-clamp-1">{seg.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Controls & Parameters Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: CPU & Critical Section Inputs */}
        <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white">CPU 주파수 & 임계 구역(Critical Section) 명령 설정</h4>
          </div>

          <div className="space-y-4 text-xs">
            {/* CPU Clock Frequency */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  CPU 동작 클럭 (CPU Frequency)
                </label>
                <span className="font-mono text-cyan-400 font-bold">{cpuFreqMhz} MHz</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={cpuFreqMhz}
                  onChange={e => setCpuFreqMhz(parseFloat(e.target.value))}
                  className="flex-1 accent-cyan-500"
                />
                <div className="flex items-center gap-1">
                  {[1, 8, 16, 20].map(freq => (
                    <button
                      key={freq}
                      onClick={() => setCpuFreqMhz(freq)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                        cpuFreqMhz === freq
                          ? 'bg-cyan-600 text-white border-cyan-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {freq}M
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Critical Section Instruction Count */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  임계 구역 내 어셈블리 명령 수 (cli() ~ sei() 사이)
                </label>
                <span className="font-mono text-amber-400 font-bold">
                  {criticalSectionInstructions} 명령 ({calculations.critCycles} 사이클)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                step="1"
                value={criticalSectionInstructions}
                onChange={e => setCriticalSectionInstructions(parseInt(e.target.value) || 0)}
                className="w-full accent-amber-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                전역 인터럽트가 비활성화된 상태에서 실행되는 명령 개수입니다. 이 값이 클수록 지터가 급증합니다.
              </p>
            </div>

            {/* Critical Section Average CPI */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 font-medium block mb-1">임계 구역 평균 CPI (Cycles)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="4.0"
                  value={criticalSectionAvgCycles}
                  onChange={e => setCriticalSectionAvgCycles(parseFloat(e.target.value) || 1.0)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">트리거 순간 실행 중 명령 사이클</label>
                <select
                  value={interruptedInstCycles}
                  onChange={e => setInterruptedInstCycles(parseInt(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value={1}>1 Cycle (NOP, ADD, MOV)</option>
                  <option value={2}>2 Cycles (LDI, IN, OUT, SBI)</option>
                  <option value={3}>3 Cycles (LPM, CALL, RET)</option>
                  <option value={4}>4 Cycles (LDS, STS, JMP, RETI)</option>
                </select>
              </div>
            </div>

            {/* Target Real-Time Deadline */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-emerald-400" />
                  목표 실시간 마감 시간 요구조건 (Deadline)
                </label>
                <span className="font-mono text-emerald-400 font-bold">{targetDeadlineUs.toFixed(1)} µs</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0.5"
                  max="50"
                  step="0.5"
                  value={targetDeadlineUs}
                  onChange={e => setTargetDeadlineUs(parseFloat(e.target.value))}
                  className="flex-1 accent-emerald-500"
                />
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="200"
                  value={targetDeadlineUs}
                  onChange={e => setTargetDeadlineUs(parseFloat(e.target.value) || 1.0)}
                  className="w-20 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-center outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Nested ISR Preemption & Target ISR Configuration */}
        <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Zap className="w-4 h-4 text-violet-400" />
            <h4 className="text-sm font-bold text-white">중첩 인터럽트 (Nested ISR) 및 선점 모드 설정</h4>
          </div>

          <div className="space-y-4 text-xs">
            {/* Nesting Mode Selector */}
            <div>
              <label className="text-slate-300 font-semibold block mb-2">
                인터럽트 중첩(Nesting) 및 우선순위 방식
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNestingMode('noblock')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    nestingMode === 'noblock'
                      ? 'bg-violet-950/60 border-violet-500 text-white shadow-md'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-violet-300">ISR_NOBLOCK 자동 중첩</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">진입 직후 sei() 실행으로 즉시 선점 허용</div>
                </button>
                <button
                  type="button"
                  onClick={() => setNestingMode('manual_sei')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    nestingMode === 'manual_sei'
                      ? 'bg-violet-950/60 border-violet-500 text-white shadow-md'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-violet-300">수동 sei() 중첩 제어</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">컨텍스트 PUSH 완료 후 명시적 sei() 허용</div>
                </button>
                <button
                  type="button"
                  onClick={() => setNestingMode('prioritized')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    nestingMode === 'prioritized'
                      ? 'bg-violet-950/60 border-violet-500 text-white shadow-md'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-violet-300">소프트웨어 우선순위 마스크</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">하위 인터럽트 마스킹 후 상위 인터럽트만 선점</div>
                </button>
                <button
                  type="button"
                  onClick={() => setNestingMode('blocked')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    nestingMode === 'blocked'
                      ? 'bg-rose-950/60 border-rose-500 text-white shadow-md'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-rose-300">비중첩 (Non-Nested / Default)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">선행 ISR이 끝날 때까지 타깃 ISR 대기</div>
                </button>
              </div>
            </div>

            {/* Interfering ISR Instructions Count */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-semibold">
                  {nestingMode === 'blocked' ? '선행 ISR 전체 명령 수' : '선행 ISR에서 sei() 호출 전까지 실행되는 명령 수'}
                </label>
                <span className="font-mono text-violet-400 font-bold">
                  {nestingMode === 'blocked' ? interferingIsrInstructions : interferingIsrPreSeiInstructions} 명령
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={nestingMode === 'blocked' ? 120 : 30}
                step="1"
                value={nestingMode === 'blocked' ? interferingIsrInstructions : interferingIsrPreSeiInstructions}
                onChange={e => {
                  const val = parseInt(e.target.value) || 0;
                  if (nestingMode === 'blocked') setInterferingIsrInstructions(val);
                  else setInterferingIsrPreSeiInstructions(val);
                }}
                className="w-full accent-violet-500"
              />
            </div>

            {/* Target ISR Prologue Instructions */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-semibold">
                  타깃 ISR 진입 프롤로그 명령 수 (SREG 및 레지스터 PUSH)
                </label>
                <span className="font-mono text-emerald-400 font-bold">
                  {targetIsrPrologueInstructions} 명령 ({calculations.targetPrologueCycles} 사이클)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="24"
                step="1"
                value={targetIsrPrologueInstructions}
                onChange={e => setTargetIsrPrologueInstructions(parseInt(e.target.value) || 0)}
                className="w-full accent-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                타깃 ISR의 첫 실제 제어 로직(포트 토글 등)이 실행되기 전 컴파일러가 레지스터를 백업하는 명령 수입니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Firmware Optimization & C Code Generator */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white tracking-wide">
              실시간 펌웨어 최적화 가이드 & C 소스 생성기 (Optimization & Code Gen)
            </h4>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setCodeType('gcc_noblock')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                codeType === 'gcc_noblock' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ISR_NOBLOCK
            </button>
            <button
              onClick={() => setCodeType('atomic_block')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                codeType === 'atomic_block' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ATOMIC_BLOCK
            </button>
            <button
              onClick={() => setCodeType('prioritized_mask')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                codeType === 'prioritized_mask' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              우선순위 마스킹
            </button>
            <button
              onClick={() => setCodeType('naked_fast')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                codeType === 'naked_fast' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Naked 초저지연
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="relative">
          <pre className="bg-slate-900/90 text-slate-200 font-mono text-xs p-4 rounded-xl border border-slate-800 overflow-x-auto leading-relaxed max-h-72">
            {generatedCode}
          </pre>

          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 shadow transition-all"
          >
            {copiedCode ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">복사 완료!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>코드 복사</span>
              </>
            )}
          </button>
        </div>

        {/* Real-Time Firmware Optimization Checklist */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-amber-400" />
              임계 구역 (cli ~ sei) 최소화
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              임계 구역 내부에는 16/32비트 변수 카피나 원자적 플래그 설정 등 필수 명령 2~4개만 남기고 복잡한 계산이나 디스플레이 함수 호출을 배제해야 최대 지터를 줄일 수 있습니다.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
            <div className="font-bold text-violet-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
              중첩 인터럽트 재진입 방지
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <code className="text-violet-300 font-mono">ISR_NOBLOCK</code>을 사용할 때 동일 인터럽트 소스가 연속 트리거되면 스택 오버플로가 발생합니다. 반드시 플래그가 하드웨어적으로 클리어되는지 확인하십시오.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
            <div className="font-bold text-emerald-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              ISR 내부 함수 호출 자제
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              ISR 내부에서 다른 일반 C 함수를 호출하면 컴파일러가 모든 Call-clobbered 레지스터(r18~r27 등)를 스택에 PUSH해야 하므로 프롤로그 지연이 15~25 사이클 이상 급증합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
