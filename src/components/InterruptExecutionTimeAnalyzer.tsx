import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { getVectorTableByMCU, InterruptVector } from '../data/interruptVectorsData';
import {
  Clock,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle2,
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
  Sparkles,
  Download,
  Flame,
  FileCode,
  ShieldCheck,
  TrendingUp,
  XCircle,
  HelpCircle,
  Terminal,
  Search
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
  initialVectorName?: string;
}

export type IsrCompilerPreset = 'minimal_flag' | 'standard_io' | 'ring_buffer' | 'multi_word' | 'isr_naked' | 'custom';

interface PayloadPreset {
  id: IsrCompilerPreset;
  title: string;
  badge: string;
  desc: string;
  instructionCycles: number;
  pushedGprs: number;
  codeSnippet: string;
}

const PAYLOAD_PRESETS: PayloadPreset[] = [
  {
    id: 'minimal_flag',
    title: '1. 초경량 플래그 세트 (Minimal Flag)',
    badge: '초고속 (권장)',
    desc: 'volatile 전역 플래그 1개만 세트하고 즉시 복귀. 컴파일러가 최소 레지스터(SREG + R24)만 스택에 백업.',
    instructionCycles: 3, // LDI (1) + STS (2)
    pushedGprs: 2,        // SREG, R24
    codeSnippet: `// [권장 모범 사례] 최소 지연시간 플래그 세트
volatile uint8_t event_flag = 0;

ISR(__VECTOR_NAME__) {
    event_flag = 1; // 3 사이클 (LDI + STS)
}`
  },
  {
    id: 'standard_io',
    title: '2. 표준 I/O 토글 & 카운터 증가 (Standard I/O)',
    badge: '일반적인 ISR',
    desc: '포트 비트 토글 또는 8비트/16비트 카운터 증가. GCC 표준 프롤로그(SREG, R0, R1, R24, R25 등).',
    instructionCycles: 8,
    pushedGprs: 5,        // SREG, R0, R1, R24, R25
    codeSnippet: `volatile uint16_t isr_tick_counter = 0;

ISR(__VECTOR_NAME__) {
    isr_tick_counter++;
    PINB = (1 << PINB5); // I/O 토글 (2 사이클)
}`
  },
  {
    id: 'ring_buffer',
    title: '3. 시리얼/센서 원형 링 버퍼 푸시 (Ring Buffer FIFO)',
    badge: '통신/센서 표준',
    desc: '하드웨어 데이터 레지스터(UDR0/ADC)를 읽어 2^N 링버퍼에 저장하고 헤드 포인터 증가.',
    instructionCycles: 22,
    pushedGprs: 9,        // SREG, R0, R1, R24, R25, R26, R27, R30, R31
    codeSnippet: `ISR(__VECTOR_NAME__) {
    uint8_t data = __READ_REG__;
    uint8_t next_head = (rx_head + 1) & (RX_BUF_SIZE - 1);
    if (next_head != rx_tail) {
        rx_buffer[rx_head] = data;
        rx_head = next_head;
    } else {
        rx_overflow_flag = 1;
    }
}`
  },
  {
    id: 'multi_word',
    title: '4. 32비트 타임스탬프 & 복합 연산 (Multi-Word Math)',
    badge: '높은 부하',
    desc: '32비트 마이크로초 단위 연산 또는 복수 변수 갱신. 다수의 작업 레지스터(R18~R27) 스택 백업.',
    instructionCycles: 45,
    pushedGprs: 14,
    codeSnippet: `volatile uint32_t system_micro_ticks = 0;
volatile uint16_t sample_accum = 0;

ISR(__VECTOR_NAME__) {
    system_micro_ticks += 1000;
    sample_accum += ADC;
}`
  },
  {
    id: 'isr_naked',
    title: '5. 어셈블리 직접 최적화 (ISR_NAKED)',
    badge: '극한 성능 (0 프롤로그)',
    desc: '컴파일러의 자동 프롤로그/에필로그 생성을 완전히 차단하고 필요한 레지스터만 인라인 어셈블리로 직접 제어.',
    instructionCycles: 6,
    pushedGprs: 0,        // 0 GPRs pushed by compiler
    codeSnippet: `// 컴파일러 프롤로그/에필로그 완전 제거: 극한의 서브마이크로초 응답
ISR(__VECTOR_NAME__, ISR_NAKED) {
    __asm__ __volatile__ (
        "push r24            \\n\\t"
        "in   r24, __SREG__  \\n\\t"
        "sbi  %0, %1         \\n\\t" // 하드웨어 핀 직접 토글
        "out  __SREG__, r24  \\n\\t"
        "pop  r24            \\n\\t"
        "reti                \\n\\t"
        :
        : "I" (_SFR_IO_ADDR(PINB)), "I" (PINB5)
    );
}`
  },
  {
    id: 'custom',
    title: '6. 사용자 지정 명령 사이클 직접 입력',
    badge: '사용자 정의',
    desc: '원하는 명령 사이클 수와 스택에 백업할 범용 레지스터 수를 직접 슬라이더로 조절하여 분석합니다.',
    instructionCycles: 15,
    pushedGprs: 6,
    codeSnippet: `ISR(__VECTOR_NAME__) {
    // 사용자 맞춤형 로직 실행
    // 슬라이더로 사이클을 변경하여 분석하세요
}`
  }
];

export const InterruptExecutionTimeAnalyzer: React.FC<Props> = ({
  selectedMCU,
  onSelectMCU,
  initialVectorName
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const allVectors = useMemo(() => getVectorTableByMCU(selectedMCU), [selectedMCU]);

  // Selected Vector
  const [selectedVectorName, setSelectedVectorName] = useState<string>(() => {
    if (initialVectorName && allVectors.some((v) => v.vectorName === initialVectorName)) {
      return initialVectorName;
    }
    // Default to INT0 or first external/timer vector
    const def = allVectors.find((v) => v.vectorName === 'INT0_vect') ||
      allVectors.find((v) => v.vectorName.includes('TIMER1_COMPA')) ||
      allVectors[1] || allVectors[0];
    return def.vectorName;
  });

  // Vector Category Filter & Search
  const [vectorFilter, setVectorFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Clock Frequency (Hz)
  const [fcpuPreset, setFcpuPreset] = useState<number>(16000000);
  const [customFcpuHz, setCustomFcpuHz] = useState<string>('16000000');
  const [isCustomFcpu, setIsCustomFcpu] = useState<boolean>(false);

  // Payload Preset & Custom Cycles
  const [selectedPayloadId, setSelectedPayloadId] = useState<IsrCompilerPreset>('standard_io');
  const [customInstructionCycles, setCustomInstructionCycles] = useState<number>(18);
  const [customPushedGprs, setCustomPushedGprs] = useState<number>(6);

  // Trigger Frequency (Hz) for CPU Load Analysis
  const [triggerRateHz, setTriggerRateHz] = useState<number>(1000); // 1 kHz

  // Multi-cycle in-flight instruction jitter (0, 1, 2, or 3 cycles)
  const [inFlightJitterCycles, setInFlightJitterCycles] = useState<number>(2);

  // Copy Feedback
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Keep selected vector valid when MCU changes
  React.useEffect(() => {
    const exists = allVectors.some((v) => v.vectorName === selectedVectorName);
    if (!exists) {
      const fallback = allVectors.find((v) => v.vectorName === 'INT0_vect') || allVectors[1] || allVectors[0];
      setSelectedVectorName(fallback.vectorName);
    }
  }, [selectedMCU, allVectors, selectedVectorName]);

  const activeVector = useMemo(() => {
    return allVectors.find((v) => v.vectorName === selectedVectorName) || allVectors[0];
  }, [allVectors, selectedVectorName]);

  const activePreset = useMemo(() => {
    return PAYLOAD_PRESETS.find((p) => p.id === selectedPayloadId) || PAYLOAD_PRESETS[1];
  }, [selectedPayloadId]);

  // Effective System Clock
  const effectiveFcpu = isCustomFcpu ? (parseFloat(customFcpuHz) || 16000000) : fcpuPreset;
  const clockPeriodNs = useMemo(() => (1 / effectiveFcpu) * 1e9, [effectiveFcpu]);

  // MCU Architecture Parameters
  const mcuArch = useMemo(() => {
    const isM2560 = selectedMCU === 'atmega2560';
    const isM640 = selectedMCU === 'atmega640';
    const isM128 = selectedMCU === 'atmega128';
    const isM328P = selectedMCU === 'atmega328p';

    // PC bytes pushed onto stack: 3 bytes for 2560 (22-bit PC), 2 bytes for 640/128/328P
    const pcStackBytes = isM2560 ? 3 : 2;
    // Hardware Vector Jump: RJMP (2 cycles on 328P) vs JMP (3 cycles on Mega/128)
    const ivtJumpCycles = isM328P ? 2 : 3;
    // RETI execution cycles: 4 cycles for 16-bit PC, 5 cycles for 22-bit PC
    const retiCycles = isM2560 ? 5 : 4;
    // Base hardware response to push PC and clear SREG.I: 4 cycles (or 5 cycles on 22-bit PC)
    const hwPushPcCycles = isM2560 ? 5 : 4;

    return {
      pcStackBytes,
      ivtJumpCycles,
      retiCycles,
      hwPushPcCycles,
      isM2560,
      isM328P
    };
  }, [selectedMCU]);

  // Effective Instruction Cycles and Pushed GPRs
  const effectiveInstructionCycles = selectedPayloadId === 'custom' ? customInstructionCycles : activePreset.instructionCycles;
  const effectivePushedGprs = selectedPayloadId === 'custom' ? customPushedGprs : activePreset.pushedGprs;

  // -------------------------------------------------------------
  // Comprehensive Cycle & Latency Breakdown
  // -------------------------------------------------------------
  const timingBreakdown = useMemo(() => {
    // 1. Hardware Entry Latency
    // = Currently executing instruction completion (0~3 cycles) + Push PC (4~5 cycles) + Vector Table Jump (2~3 cycles)
    const hwJitter = inFlightJitterCycles;
    const hwEntryCycles = hwJitter + mcuArch.hwPushPcCycles + mcuArch.ivtJumpCycles;

    // 2. GCC Compiler Prologue (Context Saving)
    // If ISR_NAKED, 0 cycles.
    // Otherwise:
    // PUSH __zero_reg__ (2 cycles)
    // PUSH __tmp_reg__ (2 cycles)
    // IN __tmp_reg__, __SREG__ (1 cycle)
    // PUSH __tmp_reg__ (2 cycles)
    // CLR __zero_reg__ (1 cycle)
    // -> Fixed overhead = 8 cycles
    // Plus each pushed working GPR (r24, r25, etc.): 2 cycles per PUSH
    let prologueCycles = 0;
    if (selectedPayloadId === 'isr_naked') {
      prologueCycles = 0;
    } else {
      prologueCycles = 8 + (effectivePushedGprs * 2);
    }

    // 3. User Payload / Body Minimum Instruction Cycles
    const bodyCycles = effectiveInstructionCycles;

    // 4. GCC Compiler Epilogue (Context Restoring)
    // If ISR_NAKED, 0 cycles.
    // Otherwise:
    // POP each working GPR: 2 cycles each
    // POP __tmp_reg__ (2 cycles)
    // OUT __SREG__, __tmp_reg__ (1 cycle)
    // POP __tmp_reg__ (2 cycles)
    // POP __zero_reg__ (2 cycles)
    // -> Fixed overhead = 7 cycles
    let epilogueCycles = 0;
    if (selectedPayloadId === 'isr_naked') {
      epilogueCycles = 0;
    } else {
      epilogueCycles = 7 + (effectivePushedGprs * 2);
    }

    // 5. Hardware Return (RETI)
    const retiCycles = mcuArch.retiCycles;

    // 6. Context Switching Overhead (Total overhead NOT including user code)
    // = Hardware Entry + Compiler Prologue + Compiler Epilogue + RETI
    const contextSwitchOverheadCycles = hwEntryCycles + prologueCycles + epilogueCycles + retiCycles;

    // 7. Total Execution Cycles
    const totalIsrCycles = contextSwitchOverheadCycles + bodyCycles;

    // 8. Physical Time Calculations (in microseconds & nanoseconds)
    const hwEntryUs = (hwEntryCycles * clockPeriodNs) / 1000;
    const prologueUs = (prologueCycles * clockPeriodNs) / 1000;
    const bodyUs = (bodyCycles * clockPeriodNs) / 1000;
    const epilogueUs = (epilogueCycles * clockPeriodNs) / 1000;
    const retiUs = (retiCycles * clockPeriodNs) / 1000;
    const contextSwitchUs = (contextSwitchOverheadCycles * clockPeriodNs) / 1000;
    const totalDurationUs = (totalIsrCycles * clockPeriodNs) / 1000;

    // 9. Response Latency (Time from interrupt flag set to 1st instruction of user code)
    const responseLatencyCycles = hwEntryCycles + prologueCycles;
    const responseLatencyUs = (responseLatencyCycles * clockPeriodNs) / 1000;

    // 10. Stack Memory Overhead (Bytes consumed in SRAM)
    // PC (2 or 3 bytes) + SREG (1 byte) + zero_reg (1 byte) + tmp_reg (1 byte) + pushed GPRs
    let stackBytes = 0;
    if (selectedPayloadId === 'isr_naked') {
      stackBytes = mcuArch.pcStackBytes; // Only PC pushed by hardware
    } else {
      stackBytes = mcuArch.pcStackBytes + 3 + effectivePushedGprs;
    }

    // 11. CPU Utilization at Trigger Rate
    // Trigger Period in µs
    const triggerPeriodUs = (1 / triggerRateHz) * 1e6;
    const cpuLoadPct = Math.min(100, (totalDurationUs / triggerPeriodUs) * 100);

    // 12. Maximum Theoretical Saturation Frequency
    const maxSafeFrequencyHz = Math.floor(effectiveFcpu / totalIsrCycles);

    // Percentage of time spent on pure context switching vs useful work
    const contextSwitchPct = ((contextSwitchOverheadCycles / totalIsrCycles) * 100);
    const bodyPct = ((bodyCycles / totalIsrCycles) * 100);

    return {
      hwJitter,
      hwEntryCycles,
      hwEntryUs,
      prologueCycles,
      prologueUs,
      bodyCycles,
      bodyUs,
      epilogueCycles,
      epilogueUs,
      retiCycles,
      retiUs,
      contextSwitchOverheadCycles,
      contextSwitchUs,
      totalIsrCycles,
      totalDurationUs,
      responseLatencyCycles,
      responseLatencyUs,
      stackBytes,
      cpuLoadPct,
      maxSafeFrequencyHz,
      contextSwitchPct,
      bodyPct
    };
  }, [
    inFlightJitterCycles,
    mcuArch,
    effectivePushedGprs,
    effectiveInstructionCycles,
    selectedPayloadId,
    clockPeriodNs,
    triggerRateHz,
    effectiveFcpu
  ]);

  // Vector-Specific Optimization Suggestions
  const vectorSpecificTips = useMemo(() => {
    const vName = activeVector.vectorName;
    const desc = activeVector.description;

    if (vName.includes('USART') && vName.includes('RX')) {
      return {
        title: 'USART 수신 버퍼 오버런(DOR0) 방지 권장사항',
        badge: '통신 필수 권장',
        severity: 'high',
        text: 'AVR의 하드웨어 USART 수신 FIFO는 2바이트 크기입니다. ISR 내부에서 링 버퍼에 데이터를 신속히 복사하고, printf()나 긴 루프를 절대 호출하지 마세요. 115200 bps 수신 시 86.8µs마다 1바이트가 도착하므로 ISR 총 소요시간은 20µs 이내로 유지해야 합니다.'
      };
    }
    if (vName.includes('TIMER1') || vName.includes('TIMER3') || vName.includes('TIMER4') || vName.includes('TIMER5')) {
      return {
        title: '16비트 타이머 레지스터 임시(TEMP) 버퍼 오염 방지',
        badge: '타이머 원자성',
        severity: 'medium',
        text: '16비트 레지스터(TCNT1, OCR1A, ICR1) 접근 시 하드웨어 TEMP 버퍼가 사용됩니다. 메인 루프에서 16비트 타이머 레지스터를 읽는 도중 본 ISR이 발생하면 상위 바이트가 손상될 수 있으므로, 메인 루프에서는 ATOMIC_BLOCK으로 감싸야 합니다.'
      };
    }
    if (vName.includes('ADC')) {
      return {
        title: 'ADC 데이터 레지스터(ADCL/ADCH) 잠금 순서 준수',
        badge: '아날로그 안전',
        severity: 'medium',
        text: 'ADC 변환값 10비트를 읽을 때는 반드시 하위 바이트(ADCL)를 먼저 읽어야 데이터 래치가 잠기고, 상위 바이트(ADCH)를 읽을 때 잠금이 해제됩니다. C언어에서는 ADC 전용 16비트 매크로 (val = ADC;)를 사용하는 것이 안전합니다.'
      };
    }
    if (vName.includes('INT0') || vName.includes('INT1') || vName.includes('INT2')) {
      return {
        title: '외부 핀 하드웨어 채터링 & 초고속 응답 팁',
        badge: '외부 인터럽트',
        severity: 'low',
        text: '기계식 스위치 신호 입력 시 하드웨어 채터링으로 수십 번의 인터럽트가 폭주할 수 있습니다. RC 로우패스 필터 또는 슈미트 트리거 회로를 권장하며, 고속 엔코더 계측 시에는 ISR_NAKED 인라인 어셈블리로 문맥 전환을 0으로 단축할 수 있습니다.'
      };
    }
    if (vName.includes('WDT')) {
      return {
        title: '워치독 타이머 인터럽트 모드 (기상 및 진단)',
        badge: '시스템 안전',
        severity: 'high',
        text: '워치독 인터럽트(WDIE=1) 발생 후 다음 타임아웃까지 플래그를 처리하지 않으면 시스템 리셋(WDE=1)으로 전환될 수 있습니다. ISR 진입 후 신속히 진단 로그를 남기거나 wdt_reset()을 실행하세요.'
      };
    }
    return {
      title: `${activeVector.sourceName} 일반 최적화 원칙`,
      badge: '모범 가이드라인',
      severity: 'normal',
      text: '전역 공유 변수는 반드시 volatile로 선언하여 컴파일러의 레지스터 캐싱을 방지하고, ISR 본문에서는 8비트 정수 연산만 수행하여 컴파일러의 GPR PUSH/POP 오버헤드를 최소화하세요.'
    };
  }, [activeVector]);

  // Dynamic C Code Snippet Generator
  const generatedIsrCode = useMemo(() => {
    let template = activePreset.codeSnippet;
    template = template.replaceAll('__VECTOR_NAME__', activeVector.vectorName);
    template = template.replaceAll('__READ_REG__', activeVector.vectorName.includes('USART') ? 'UDR0' : 'ADC');

    return `/**
 * @file      ${activeVector.vectorName.toLowerCase()}_handler.c
 * @target    ${currentProfile.name} (${currentProfile.fullName})
 * @vector    #${activeVector.vectorNum} ${activeVector.vectorName} (${activeVector.sourceName})
 * @f_cpu     ${(effectiveFcpu / 1e6).toFixed(2)} MHz (1 Cycle = ${clockPeriodNs.toFixed(1)} ns)
 * ----------------------------------------------------------------------------
 * [타이밍 분석 요약]
 * - 하드웨어 응답 지연: ${timingBreakdown.hwEntryCycles} 사이클 (${timingBreakdown.hwEntryUs.toFixed(2)} µs)
 * - 컴파일러 프롤로그:  ${timingBreakdown.prologueCycles} 사이클 (${timingBreakdown.prologueUs.toFixed(2)} µs)
 * - 사용자 본문 실행:  ${timingBreakdown.bodyCycles} 사이클 (${timingBreakdown.bodyUs.toFixed(2)} µs)
 * - 컴파일러 에필로그:  ${timingBreakdown.epilogueCycles} 사이클 (${timingBreakdown.epilogueUs.toFixed(2)} µs)
 * - 하드웨어 RETI 복귀: ${timingBreakdown.retiCycles} 사이클 (${timingBreakdown.retiUs.toFixed(2)} µs)
 * ----------------------------------------------------------------------------
 * 총 실행 시간: ${timingBreakdown.totalIsrCycles} 사이클 (${timingBreakdown.totalDurationUs.toFixed(2)} µs)
 * 순수 문맥 전환 오버헤드: ${timingBreakdown.contextSwitchOverheadCycles} 사이클 (${timingBreakdown.contextSwitchUs.toFixed(2)} µs, 전체의 ${timingBreakdown.contextSwitchPct.toFixed(1)}%)
 * 스택 SRAM 소모량: ${timingBreakdown.stackBytes} 바이트 (PC + 백업 레지스터)
 * 최대 안전 트리거 한도: ${timingBreakdown.maxSafeFrequencyHz.toLocaleString()} Hz (포화 직전)
 */

#include <avr/io.h>
#include <avr/interrupt.h>

${template}
`;
  }, [activeVector, currentProfile, effectiveFcpu, clockPeriodNs, timingBreakdown, activePreset]);

  // Copy handler
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedIsrCode);
      setCopiedCode(true);
      confetti({ particleCount: 35, spread: 55, origin: { y: 0.7 } });
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // fallback
    }
  };

  // Filtered vectors list for selector
  const filteredVectors = useMemo(() => {
    return allVectors.filter((v) => {
      const matchCat = vectorFilter === 'all' || v.category === vectorFilter;
      const matchSearch = searchQuery === '' ||
        v.vectorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.sourceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [allVectors, vectorFilter, searchQuery]);

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Clock className="w-5 h-5" />
            </span>
            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              인터럽트 벡터별 처리 시간 & 문맥 전환(Context Switching) 분석기
            </h3>
            <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              {currentProfile.name}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-4xl leading-relaxed">
            선택한 인터럽트 벡터의 <strong className="text-amber-400">하드웨어 트리거 지연, 컴파일러 레지스터 백업(Prologue), 최소 명령 사이클(ISR Body), 레지스터 복원(Epilogue), RETI 복귀</strong>까지의
            정밀 클럭 사이클과 마이크로초(µs) 소요 시간을 산출하고 시스템 최적화 방안을 제안합니다.
          </p>
        </div>

        {/* Copy Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyCode}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all ${
              copiedCode
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20'
            }`}
          >
            {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedCode ? 'C 분석 템플릿 복사됨!' : 'C 코드 템플릿 복사'}
          </button>
        </div>
      </div>

      {/* Control Configuration Bar: Vector Selector & Clock Frequency */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
        {/* 1. Vector Selector */}
        <div className="lg:col-span-5 space-y-1.5">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            분석 대상 인터럽트 벡터 선택 ({allVectors.length}개 벡터)
          </label>
          <div className="flex gap-2">
            <select
              value={selectedVectorName}
              onChange={(e) => setSelectedVectorName(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400 truncate"
            >
              {allVectors.map((v) => (
                <option key={v.vectorName} value={v.vectorName}>
                  #{v.vectorNum.toString().padStart(2, '0')} {v.vectorName} - {v.sourceName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
            <span>주소: <strong className="text-slate-300 font-mono">{activeVector.programAddress}</strong></span>
            <span>인에이블: <strong className="text-slate-300 font-mono">{activeVector.enableRegister}</strong></span>
            <span>플래그: <strong className="text-slate-300 font-mono">{activeVector.flagRegister}</strong></span>
          </div>
        </div>

        {/* 2. System Clock Frequency Selector */}
        <div className="lg:col-span-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              시스템 클럭 주파수 (F_CPU)
            </label>
            <button
              type="button"
              onClick={() => setIsCustomFcpu(!isCustomFcpu)}
              className="text-[10px] text-amber-400 hover:text-amber-300 underline font-mono"
            >
              {isCustomFcpu ? '표준 프리셋' : '직접 입력'}
            </button>
          </div>

          {isCustomFcpu ? (
            <div className="relative">
              <input
                type="number"
                value={customFcpuHz}
                onChange={(e) => setCustomFcpuHz(e.target.value)}
                placeholder="16000000"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
              />
              <span className="absolute right-3 top-2 text-[11px] text-slate-400 font-mono">Hz</span>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: '16 MHz', hz: 16000000 },
                { label: '20 MHz', hz: 20000000 },
                { label: '8 MHz', hz: 8000000 },
                { label: '1 MHz', hz: 1000000 }
              ].map((clk) => (
                <button
                  key={clk.hz}
                  type="button"
                  onClick={() => setFcpuPreset(clk.hz)}
                  className={`py-1.5 rounded-xl text-xs font-mono font-medium border transition ${
                    fcpuPreset === clk.hz
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {clk.label}
                </button>
              ))}
            </div>
          )}

          <div className="text-[11px] text-slate-400 flex items-center justify-between font-mono">
            <span>1 클럭 사이클 주기:</span>
            <strong className="text-cyan-400">{clockPeriodNs.toFixed(2)} ns</strong>
          </div>
        </div>

        {/* 3. In-flight Instruction Jitter */}
        <div className="lg:col-span-3 space-y-1.5">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-purple-400" />
            실행 중이던 명령어 지연 (지터)
          </label>
          <select
            value={inFlightJitterCycles}
            onChange={(e) => setInFlightJitterCycles(parseInt(e.target.value, 10))}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-400"
          >
            <option value={0}>0 사이클 (명령 완료 직후 트리거)</option>
            <option value={1}>1 사이클 (단일 사이클 명령 실행 중)</option>
            <option value={2}>2 사이클 (2사이클 명령 RJMP/ADIW/SBI)</option>
            <option value={3}>3 사이클 (최대 지연 LDS/STS/CALL/RET)</option>
          </select>
          <div className="text-[11px] text-slate-400 text-right">
            최악 응답 지터: <span className="text-purple-300 font-mono">+{inFlightJitterCycles} Cycles</span>
          </div>
        </div>
      </div>

      {/* Main KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Total Execution Time */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            총 인터럽트 소요 시간
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              {timingBreakdown.totalDurationUs.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-amber-400">µs</span>
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono">
            총 <strong className="text-white">{timingBreakdown.totalIsrCycles}</strong> 클럭 사이클
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            진입부터 RETI 완료 후 복귀까지
          </div>
        </div>

        {/* Card 2: Context Switching Overhead */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            문맥 전환 (Context Switching)
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              {timingBreakdown.contextSwitchUs.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-indigo-400">µs</span>
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono">
            <strong className="text-indigo-300">{timingBreakdown.contextSwitchOverheadCycles}</strong> 클럭 (전체의 {timingBreakdown.contextSwitchPct.toFixed(0)}%)
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            HW진입 + 프롤로그 + 에필로그 + RETI
          </div>
        </div>

        {/* Card 3: Response Latency (Flag to 1st user instruction) */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            첫 사용자 코드 응답 지연
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              {timingBreakdown.responseLatencyUs.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-emerald-400">µs</span>
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono">
            <strong className="text-emerald-300">{timingBreakdown.responseLatencyCycles}</strong> 클럭 대기 후 진입
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            플래그 감지 &rarr; ISR 첫 명령어 실행
          </div>
        </div>

        {/* Card 4: Stack & Safe Trigger Rate */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5" />
            최대 안전 처리 한도 & 스택
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
              {timingBreakdown.maxSafeFrequencyHz.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-cyan-400">Hz</span>
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono">
            SRAM 스택: <strong className="text-amber-300">{timingBreakdown.stackBytes}</strong> Bytes 사용
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            100% CPU 포화 직전 한계 주파수
          </div>
        </div>
      </div>

      {/* Visual Timeline & Lifecycle Clock Cycle Distribution */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white">
              인터럽트 실행 단계별 클럭 사이클 분해 (Clock Cycle Distribution)
            </h4>
          </div>
          <span className="text-xs font-mono text-slate-400">
            총합: <strong className="text-amber-400">{timingBreakdown.totalIsrCycles} Cycles</strong> ({timingBreakdown.totalDurationUs.toFixed(2)} µs)
          </span>
        </div>

        {/* Proportional Segment Bar */}
        <div className="w-full h-8 bg-slate-900 rounded-xl overflow-hidden flex border border-slate-800 shadow-inner">
          {/* Phase 1: HW Entry */}
          <div
            style={{ width: `${(timingBreakdown.hwEntryCycles / timingBreakdown.totalIsrCycles) * 100}%` }}
            className="bg-amber-500/80 hover:bg-amber-400 transition flex items-center justify-center text-[10px] font-mono text-slate-950 font-bold truncate px-1"
            title={`하드웨어 감지 & IVT 점프: ${timingBreakdown.hwEntryCycles} 사이클 (${timingBreakdown.hwEntryUs.toFixed(2)} µs)`}
          >
            HW ({timingBreakdown.hwEntryCycles}c)
          </div>

          {/* Phase 2: Compiler Prologue */}
          {timingBreakdown.prologueCycles > 0 && (
            <div
              style={{ width: `${(timingBreakdown.prologueCycles / timingBreakdown.totalIsrCycles) * 100}%` }}
              className="bg-indigo-500/80 hover:bg-indigo-400 transition flex items-center justify-center text-[10px] font-mono text-white font-bold truncate px-1"
              title={`컴파일러 프롤로그 (PUSH SREG/Regs): ${timingBreakdown.prologueCycles} 사이클 (${timingBreakdown.prologueUs.toFixed(2)} µs)`}
            >
              Prologue ({timingBreakdown.prologueCycles}c)
            </div>
          )}

          {/* Phase 3: User Payload */}
          <div
            style={{ width: `${(timingBreakdown.bodyCycles / timingBreakdown.totalIsrCycles) * 100}%` }}
            className="bg-emerald-500/90 hover:bg-emerald-400 transition flex items-center justify-center text-[10px] font-mono text-slate-950 font-bold truncate px-1"
            title={`사용자 로직 최소 명령: ${timingBreakdown.bodyCycles} 사이클 (${timingBreakdown.bodyUs.toFixed(2)} µs)`}
          >
            Body ({timingBreakdown.bodyCycles}c)
          </div>

          {/* Phase 4: Compiler Epilogue */}
          {timingBreakdown.epilogueCycles > 0 && (
            <div
              style={{ width: `${(timingBreakdown.epilogueCycles / timingBreakdown.totalIsrCycles) * 100}%` }}
              className="bg-purple-500/80 hover:bg-purple-400 transition flex items-center justify-center text-[10px] font-mono text-white font-bold truncate px-1"
              title={`컴파일러 에필로그 (POP Regs/SREG): ${timingBreakdown.epilogueCycles} 사이클 (${timingBreakdown.epilogueUs.toFixed(2)} µs)`}
            >
              Epilogue ({timingBreakdown.epilogueCycles}c)
            </div>
          )}

          {/* Phase 5: RETI */}
          <div
            style={{ width: `${(timingBreakdown.retiCycles / timingBreakdown.totalIsrCycles) * 100}%` }}
            className="bg-rose-500/80 hover:bg-rose-400 transition flex items-center justify-center text-[10px] font-mono text-white font-bold truncate px-1"
            title={`하드웨어 RETI 복귀: ${timingBreakdown.retiCycles} 사이클 (${timingBreakdown.retiUs.toFixed(2)} µs)`}
          >
            RETI ({timingBreakdown.retiCycles}c)
          </div>
        </div>

        {/* Detailed 5-Step Breakdown Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          {/* Step 1 */}
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">1. 하드웨어 진입</span>
              <span className="text-xs font-mono font-bold text-white">{timingBreakdown.hwEntryCycles} 사이클</span>
            </div>
            <div className="text-[11px] text-slate-300 font-mono">{timingBreakdown.hwEntryUs.toFixed(2)} µs</div>
            <p className="text-[10px] text-slate-400 leading-tight">
              현재 명령 완료 지터({timingBreakdown.hwJitter}c) + PC 스택 푸시({mcuArch.hwPushPcCycles}c, {mcuArch.pcStackBytes}바이트) + {mcuArch.isM328P ? 'RJMP' : 'JMP'} 점프({mcuArch.ivtJumpCycles}c)
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-indigo-400 uppercase font-bold">2. 프롤로그 백업</span>
              <span className="text-xs font-mono font-bold text-white">{timingBreakdown.prologueCycles} 사이클</span>
            </div>
            <div className="text-[11px] text-slate-300 font-mono">{timingBreakdown.prologueUs.toFixed(2)} µs</div>
            <p className="text-[10px] text-slate-400 leading-tight">
              PUSH r0/r1/SREG (8c) + 작업 GPR {effectivePushedGprs}개 PUSH ({effectivePushedGprs * 2}c).
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold">3. ISR 본문 실행</span>
              <span className="text-xs font-mono font-bold text-white">{timingBreakdown.bodyCycles} 사이클</span>
            </div>
            <div className="text-[11px] text-slate-300 font-mono">{timingBreakdown.bodyUs.toFixed(2)} µs</div>
            <p className="text-[10px] text-slate-400 leading-tight">
              실제 사용자 로직의 최소 명령 실행 사이클 (순수 유효 작업 비율: {timingBreakdown.bodyPct.toFixed(0)}%)
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-slate-900/90 border border-purple-500/30 rounded-xl p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-purple-400 uppercase font-bold">4. 에필로그 복원</span>
              <span className="text-xs font-mono font-bold text-white">{timingBreakdown.epilogueCycles} 사이클</span>
            </div>
            <div className="text-[11px] text-slate-300 font-mono">{timingBreakdown.epilogueUs.toFixed(2)} µs</div>
            <p className="text-[10px] text-slate-400 leading-tight">
              작업 GPR {effectivePushedGprs}개 POP ({effectivePushedGprs * 2}c) + SREG/r1/r0 복원 (7c)
            </p>
          </div>

          {/* Step 5 */}
          <div className="bg-slate-900/90 border border-rose-500/30 rounded-xl p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-rose-400 uppercase font-bold">5. 하드웨어 RETI</span>
              <span className="text-xs font-mono font-bold text-white">{timingBreakdown.retiCycles} 사이클</span>
            </div>
            <div className="text-[11px] text-slate-300 font-mono">{timingBreakdown.retiUs.toFixed(2)} µs</div>
            <p className="text-[10px] text-slate-400 leading-tight">
              스택에서 PC {mcuArch.pcStackBytes}바이트 복원, SREG.I=1 자동 활성화 후 메인 명령으로 복귀
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Payload Complexity & Custom Instruction Tuning */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Payload Preset Selection */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              인터럽트 본문(ISR Body) 명령 복잡도 & 컴파일러 프리셋 선택
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PAYLOAD_PRESETS.map((preset) => {
              const isSelected = selectedPayloadId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPayloadId(preset.id)}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/40 text-slate-400'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-bold leading-tight ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                        {preset.title}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        isSelected ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {preset.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      {preset.desc}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-800/80 font-mono text-[11px]">
                    <span className="text-slate-500">본문 명령 사이클:</span>
                    <strong className={isSelected ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                      {preset.id === 'custom' ? customInstructionCycles : preset.instructionCycles} Cycles
                    </strong>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Slider controls if custom preset chosen */}
          {selectedPayloadId === 'custom' && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-bold">본문 명령 사이클 (Instruction Cycles):</span>
                  <span className="text-amber-400 font-bold">{customInstructionCycles} 사이클 ({(customInstructionCycles * clockPeriodNs / 1000).toFixed(2)} µs)</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={200}
                  value={customInstructionCycles}
                  onChange={(e) => setCustomInstructionCycles(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-bold">스택 백업 범용 레지스터 수 (Pushed GPRs):</span>
                  <span className="text-indigo-400 font-bold">{customPushedGprs}개 ({customPushedGprs * 2} 프롤로그 사이클)</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={28}
                  value={customPushedGprs}
                  onChange={(e) => setCustomPushedGprs(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Trigger Frequency Slider & CPU Load Analysis */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                인터럽트 발생 주기 (Trigger Rate) 시뮬레이션
              </label>
              <span className="text-xs font-mono font-bold text-amber-400">
                {triggerRateHz >= 1000 ? `${(triggerRateHz / 1000).toFixed(1)} kHz` : `${triggerRateHz} Hz`}
              </span>
            </div>

            <input
              type="range"
              min={10}
              max={Math.min(100000, timingBreakdown.maxSafeFrequencyHz * 1.2)}
              step={10}
              value={triggerRateHz}
              onChange={(e) => setTriggerRateHz(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />

            {/* Load Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">CPU 점유율 (CPU Load):</span>
                <span className={`font-bold ${
                  timingBreakdown.cpuLoadPct >= 80
                    ? 'text-red-400'
                    : timingBreakdown.cpuLoadPct >= 40
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}>
                  {timingBreakdown.cpuLoadPct.toFixed(1)}% {timingBreakdown.cpuLoadPct >= 95 ? '(위험: 시스템 포화)' : ''}
                </span>
              </div>

              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  style={{ width: `${Math.min(100, timingBreakdown.cpuLoadPct)}%` }}
                  className={`h-full transition-all duration-300 ${
                    timingBreakdown.cpuLoadPct >= 80
                      ? 'bg-red-500 shadow-md shadow-red-500/50'
                      : timingBreakdown.cpuLoadPct >= 40
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
                <span>메인 루프 가용 시간: <strong>{(100 - timingBreakdown.cpuLoadPct).toFixed(1)}%</strong></span>
                <span>인터럽트 간격: <strong>{(1000000 / triggerRateHz).toFixed(1)} µs</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Specific Advice Card & C Code Preview */}
        <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
          {/* Proactive Optimization Suggestions tailored to active vector */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-white">
                  {vectorSpecificTips.title}
                </h4>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                vectorSpecificTips.severity === 'high'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {vectorSpecificTips.badge}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {vectorSpecificTips.text}
            </p>

            <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80 space-y-1.5 text-[11px]">
              <div className="text-slate-400 flex items-center justify-between">
                <span>문맥 전환 오버헤드 비율:</span>
                <strong className="text-indigo-400 font-mono">{timingBreakdown.contextSwitchPct.toFixed(1)}%</strong>
              </div>
              <div className="text-slate-400 flex items-center justify-between">
                <span>순수 로직 유효 효율:</span>
                <strong className="text-emerald-400 font-mono">{timingBreakdown.bodyPct.toFixed(1)}%</strong>
              </div>
              <div className="text-slate-400 flex items-center justify-between">
                <span>SRAM 스택 깊이:</span>
                <strong className="text-amber-400 font-mono">{timingBreakdown.stackBytes} Bytes</strong>
              </div>
            </div>
          </div>

          {/* C Code Generator Viewer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                최적화 C 인터럽트 서비스 루틴 (ISR) 코드
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-[11px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedCode ? '복사 완료' : '코드 복사'}
              </button>
            </div>

            <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3.5 font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto max-h-[300px] overflow-y-auto shadow-inner select-text">
              <pre className="whitespace-pre">
                {generatedIsrCode}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
