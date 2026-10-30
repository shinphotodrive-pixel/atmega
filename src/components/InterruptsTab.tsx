import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { getVectorTableByMCU, InterruptVector } from '../data/interruptVectorsData';
import { InterruptVectorTableExplorer } from './InterruptVectorTableExplorer';
import { InterruptExecutionTimeAnalyzer } from './InterruptExecutionTimeAnalyzer';
import { StackDepthAnalyzer } from './StackDepthAnalyzer';
import {
  Zap,
  Activity,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  RotateCcw,
  Sliders,
  Code2,
  Layers,
  Info,
  Terminal,
  Cpu,
  Bookmark,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Gauge
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU: (mcu: SupportedMCU) => void;
}

interface CollisionPreset {
  id: string;
  name: string;
  description: string;
  vectorNames: string[];
  clockMhz: number;
  winningIsrCycles: number;
  uartBaud?: number;
  riskTitle: string;
  hazardType: 'overrun' | 'pulse_drop' | 'jitter' | 'race_condition';
}

export const InterruptsTab: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const allVectors = useMemo(() => getVectorTableByMCU(selectedMCU), [selectedMCU]);

  // Sub-tab selection: 'ivt' (Vector Table) vs 'timing' (Execution Time & Context Switch Analyzer) vs 'collision' vs 'stack' vs 'architecture'
  const [subTab, setSubTab] = useState<'ivt' | 'timing' | 'collision' | 'stack' | 'architecture'>('ivt');
  const [selectedTimingVector, setSelectedTimingVector] = useState<string>('INT0_vect');

  // -------------------------------------------------------------
  // Collision Debugger State
  // -------------------------------------------------------------
  // Selected colliding vector names (minimum 2)
  const defaultCollidingVectors = useMemo(() => {
    // Pick two realistic colliding vectors: e.g. INT0 and USART0_RX or TIMER1_COMPA
    const vec1 = allVectors.find((v) => v.vectorName.includes('INT0'))?.vectorName || allVectors[1]?.vectorName;
    const vec2 = allVectors.find((v) => v.vectorName.includes('USART0_RX') || v.vectorName.includes('USART_RX'))?.vectorName || allVectors[5]?.vectorName;
    return [vec1, vec2].filter(Boolean);
  }, [allVectors]);

  const [selectedCollidingVectors, setSelectedCollidingVectors] = useState<string[]>(defaultCollidingVectors);
  const [cpuFreqMhz, setCpuFreqMhz] = useState<number>(16);
  const [activeIsrCycles, setActiveIsrCycles] = useState<number>(120);
  const [uartBaudRate, setUartBaudRate] = useState<number>(115200);
  const [enableNestedIsr, setEnableNestedIsr] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Sync selected colliding vectors when MCU changes if names no longer exist
  React.useEffect(() => {
    const validNames = new Set(allVectors.map((v) => v.vectorName));
    const stillValid = selectedCollidingVectors.filter((name) => validNames.has(name));
    if (stillValid.length >= 2) {
      setSelectedCollidingVectors(stillValid);
    } else {
      setSelectedCollidingVectors(defaultCollidingVectors);
    }
  }, [selectedMCU, allVectors]);

  // Presets tailored to AVR firmware pitfalls
  const collisionPresets: CollisionPreset[] = useMemo(() => {
    return [
      {
        id: 'uart_overrun',
        name: 'USART RX 버퍼 오버런 (DOR0) 위험 시나리오',
        description: '고우선순위 ISR(ADC 또는 외부 인터럽트)이 장시간 실행되는 동안 USART 수신 문자가 누락되는 전형적인 충돌',
        vectorNames: [
          allVectors.find((v) => v.vectorName.includes('ADC'))?.vectorName || 'ADC_vect',
          allVectors.find((v) => v.vectorName.includes('USART0_RX') || v.vectorName.includes('USART_RX'))?.vectorName || 'USART0_RX_vect'
        ],
        clockMhz: 16,
        winningIsrCycles: 280,
        uartBaud: 115200,
        riskTitle: 'USART 하드웨어 수신 버퍼 2바이트 초과로 Data Overrun (DOR) 발생',
        hazardType: 'overrun'
      },
      {
        id: 'encoder_timer',
        name: '고속 모터 엔코더(INT0) vs 16-bit PWM(Timer1)',
        description: '펄스 카운팅 중 PWM 타이머 인터럽트가 동시 발생할 때 엔코더 에지 신호가 지연되거나 누락되는 문제',
        vectorNames: [
          allVectors.find((v) => v.vectorName.includes('INT0'))?.vectorName || 'INT0_vect',
          allVectors.find((v) => v.vectorName.includes('TIMER1_COMPA'))?.vectorName || 'TIMER1_COMPA_vect'
        ],
        clockMhz: 16,
        winningIsrCycles: 95,
        riskTitle: '모터 RPM 증가 시 타이머 지터 및 다중 에지 누락(Pulse Drop) 발생',
        hazardType: 'pulse_drop'
      },
      {
        id: 'twi_pcint',
        name: 'I2C(TWI) 버스 트랜잭션 vs 핀 체인지(PCINT)',
        description: 'I2C 슬레이브 하드웨어 ACK 대기 시간 동안 버튼 채터링 PCINT가 가로채어 TWI 통신 타임아웃 유발',
        vectorNames: [
          allVectors.find((v) => v.vectorName.includes('PCINT0'))?.vectorName || 'PCINT0_vect',
          allVectors.find((v) => v.vectorName.includes('TWI'))?.vectorName || 'TWI_vect'
        ],
        clockMhz: 16,
        winningIsrCycles: 150,
        riskTitle: 'I2C SCL 클럭 스트레칭 한도 초과 또는 마스터 타임아웃 발생',
        hazardType: 'jitter'
      },
      {
        id: 'triple_hazard',
        name: '3중 동시 발생: 워치독 + 외부핀 + 타이머',
        description: '전역 인터럽트 차단(cli() 또는 중장기 원자적 블록) 해제 직후 3개 이상의 인터럽트가 동시 트리거되는 극한 상황',
        vectorNames: [
          allVectors.find((v) => v.vectorName.includes('WDT'))?.vectorName || 'WDT_vect',
          allVectors.find((v) => v.vectorName.includes('INT0'))?.vectorName || 'INT0_vect',
          allVectors.find((v) => v.vectorName.includes('TIMER0_OVF'))?.vectorName || 'TIMER0_OVF_vect'
        ],
        clockMhz: 16,
        winningIsrCycles: 180,
        riskTitle: '최하위 순위 인터럽트 서비스 지연 극대화 및 스택 깊이 증가',
        hazardType: 'race_condition'
      }
    ];
  }, [allVectors]);

  const applyPreset = (preset: CollisionPreset) => {
    const validNames = preset.vectorNames.filter((name) => allVectors.some((v) => v.vectorName === name));
    if (validNames.length >= 2) {
      setSelectedCollidingVectors(validNames);
    }
    setCpuFreqMhz(preset.clockMhz);
    setActiveIsrCycles(preset.winningIsrCycles);
    if (preset.uartBaud) setUartBaudRate(preset.uartBaud);
  };

  const toggleVectorCollision = (vecName: string) => {
    if (selectedCollidingVectors.includes(vecName)) {
      if (selectedCollidingVectors.length <= 2) {
        return; // maintain at least 2 for collision comparison
      }
      setSelectedCollidingVectors((prev) => prev.filter((v) => v !== vecName));
    } else {
      setSelectedCollidingVectors((prev) => [...prev, vecName]);
    }
  };

  // Resolved priority order for selected colliding vectors
  // In AVR, priority is strictly vectorNum ascending (Vector 1 = RESET, Vector 2 = INT0, etc.)
  const collidingVectorObjects = useMemo(() => {
    return selectedCollidingVectors
      .map((name) => allVectors.find((v) => v.vectorName === name))
      .filter((v): v is InterruptVector => v !== undefined)
      .sort((a, b) => a.vectorNum - b.vectorNum);
  }, [selectedCollidingVectors, allVectors]);

  // Active winning vector (lowest vectorNum)
  const winningVector = collidingVectorObjects[0];
  const deferredVectors = collidingVectorObjects.slice(1);

  // Timing Calculations
  const cycleTimeNs = useMemo(() => 1000 / cpuFreqMhz, [cpuFreqMhz]);
  const isrDurationUs = useMemo(() => (activeIsrCycles * cycleTimeNs) / 1000, [activeIsrCycles, cycleTimeNs]);

  // Minimum hardware latency before first vector starts (4 cycles hardware jump + instruction latency 1~3 cycles)
  const minEntryCycles = 4;
  const retiCycles = 4;
  const compilerPrologEpilogCycles = 18; // Typical push/pop r0, r1, SREG, r24, r25

  // Total execution time for winning ISR before NEXT pending interrupt can be acknowledged
  // After RETI, AVR CPU executes AT LEAST ONE main loop instruction (1~4 cycles) before triggering next pending vector
  const mainInstructionCycles = 1;
  const totalWinningTurnaroundCycles = minEntryCycles + compilerPrologEpilogCycles + activeIsrCycles + retiCycles + mainInstructionCycles;
  const totalWinningTurnaroundUs = (totalWinningTurnaroundCycles * cycleTimeNs) / 1000;

  // UART byte time calculation (1 start + 8 data + 1 stop = 10 bits)
  const uartByteTimeUs = (10 / uartBaudRate) * 1_000_000;

  // Overrun check if USART RX is in deferred list
  const usartDeferred = deferredVectors.find((v) => v.vectorName.includes('USART') && v.vectorName.includes('RX'));
  const isUsartOverrunRisk = Boolean(usartDeferred && totalWinningTurnaroundUs > uartByteTimeUs * 2);

  // External Interrupt Pulse Drop Check: if INT0/INT1/PCINT is deferred and high-frequency pulse arrives
  const externalDeferred = deferredVectors.find((v) => v.category === 'external');

  // Copy remediation code
  const handleCopyRemediationCode = () => {
    if (!collidingVectorObjects.length) return;
    const code = `// ==============================================================================
// AVR 인터럽트 충돌 & 레이스 컨디션 방지 펌웨어 템플릿 (${currentProfile.name})
// 충돌 벡터: ${collidingVectorObjects.map((v) => `#${v.vectorNum} ${v.vectorName}`).join(' vs ')}
// ==============================================================================
#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/atomic.h>

// 1. 휘발성(volatile) 공유 상태 변수 - 컴파일러의 레지스터 캐싱 방지
volatile uint8_t  g_${winningVector?.vectorName.replace('_vect', '').toLowerCase()}_flag = 0;
volatile uint16_t g_shared_counter = 0;

// 2. 최우선순위 인터럽트 서비스 루틴 (빠른 플래그 설정 후 즉시 복귀)
ISR(${winningVector?.vectorName}) {
    // ⚠️ 원칙: ISR 내부에서는 printf, long delay, 무거운 연산을 절대 수행하지 않습니다!
    g_${winningVector?.vectorName.replace('_vect', '').toLowerCase()}_flag = 1;
    g_shared_counter++;
    // 하드웨어 플래그(${winningVector?.flagRegister})는 자동 클리어됩니다.
}

${deferredVectors.map((v) => `// 3. 지연 대기 후 실행될 차순위 인터럽트
ISR(${v.vectorName}) {
    // ${v.sourceName} 처리
    // 이전 인터럽트 복귀(reti) 후 1클럭 뒤 하드웨어 우선순위에 따라 순차 실행됩니다.
}`).join('\n\n')}

// 4. 메인 루프에서 다중 바이트 공유 변수 안전 접근 (원자적 보호)
void loop_process_safe(void) {
    uint16_t counter_snapshot;
    
    // ATOMIC_BLOCK은 SREG 전역 인터럽트 플래그를 백업하고 cli()한 뒤,
    // 블록 종료 시 이전 SREG 상태를 완벽하게 복원합니다.
    ATOMIC_BLOCK(ATOMIC_RESTORESTATE) {
        counter_snapshot = g_shared_counter;
        // 필요 시 플래그 리셋
    }
    
    // 복사된 snapshot을 활용해 무거운 연산 수행
    if (counter_snapshot > 1000) {
        // ...
    }
}
`;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & MCU Switcher */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wide uppercase mb-3">
              <Zap className="w-3.5 h-3.5" />
              AVR Interrupt Vector Table (IVT) & Collision Engine
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              인터럽트 벡터 테이블 & 충돌 디버거
              <span className="text-xs font-mono font-normal text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-700/50">
                {currentProfile.name} • {allVectors.length}개 벡터
              </span>
            </h2>
            <p className="text-sm text-slate-400 mt-2 max-w-3xl leading-relaxed">
              AVR 8비트 RISC 하드웨어는 <span className="text-amber-300 font-semibold">벡터 번호(플래시 주소)가 낮을수록 더 높은 우선순위</span>를 부여합니다.
              인터럽트 동시 발생 및 전역 인터럽트 금지(<code className="text-amber-400 font-mono">SREG.I=0</code>) 상태에서의 경합 과정을 시뮬레이션하고,
              USART 버퍼 오버런, 펄스 누락, 원자성(Atomic) 위반을 사전에 디버깅하세요.
            </p>
          </div>

          {/* MCU Switcher */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/90 p-1.5 rounded-xl border border-slate-800 self-start lg:self-auto">
            {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => {
              const isSelected = selectedMCU === mcuId;
              const count = getVectorTableByMCU(mcuId).length;
              return (
                <button
                  key={mcuId}
                  onClick={() => onSelectMCU(mcuId)}
                  className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex flex-col items-center ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <span>{MCU_PROFILES[mcuId].name}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-slate-900/80' : 'text-slate-500'}`}>
                    {count} Vectors
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-800/80 overflow-x-auto">
          <button
            onClick={() => setSubTab('ivt')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              subTab === 'ivt'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            전체 벡터 테이블 (IVT) 탐색기
          </button>
          <button
            onClick={() => setSubTab('timing')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              subTab === 'timing'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-cyan-400" />
            인터럽트 처리 시간 & 문맥 전환 분석기
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              Latency & Cycles
            </span>
          </button>
          <button
            onClick={() => setSubTab('collision')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              subTab === 'collision'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-amber-400 group-hover:text-amber-300" />
            벡터 충돌 & 우선순위 경합 디버거
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-500/20 text-red-400 border border-red-500/30">
              Collision Simulator
            </span>
          </button>
          <button
            onClick={() => setSubTab('stack')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              subTab === 'stack'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-rose-400" />
            인터럽트 & 스택 오버플로우 디버거
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-400 border border-rose-500/30">
              Stack Overflow Debugger
            </span>
          </button>
          <button
            onClick={() => setSubTab('architecture')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              subTab === 'architecture'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            하드웨어 타이밍 & 지연 규격
          </button>
        </div>
      </section>

      {/* SUB-TAB 1: IVT Vector Table Explorer */}
      {subTab === 'ivt' && (
        <InterruptVectorTableExplorer
          selectedMCU={selectedMCU}
          onSelectMCU={onSelectMCU}
          onNavigateToTiming={(vectorName) => {
            setSelectedTimingVector(vectorName);
            setSubTab('timing');
          }}
        />
      )}

      {/* SUB-TAB 2: Interrupt Vector Execution Time & Context Switching Analyzer */}
      {subTab === 'timing' && (
        <div id="interrupt-execution-time-analyzer-section" className="scroll-mt-20">
          <InterruptExecutionTimeAnalyzer
            selectedMCU={selectedMCU}
            onSelectMCU={onSelectMCU}
            initialVectorName={selectedTimingVector}
          />
        </div>
      )}

      {/* SUB-TAB 2: Vector Collision & Race Condition Debugger */}
      {subTab === 'collision' && (
        <div className="space-y-6">
          {/* Quick Presets Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              실무 펌웨어 충돌 위험 프리셋 (One-Click Scenarios)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {collisionPresets.map((preset) => {
                const isActive = preset.vectorNames.every((name) => selectedCollidingVectors.includes(name));
                return (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                      isActive
                        ? 'bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-amber-400 flex items-center justify-between">
                        <span>{preset.name}</span>
                        {isActive && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      {preset.vectorNames.map((vName) => (
                        <span key={vName} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                          {vName}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Collision Playground */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 5 Cols: Vector Selector & Simulation Controls */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    충돌 인터럽트 선택 (최소 2개 이상)
                  </div>
                  <span className="text-xs font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                    선택: {selectedCollidingVectors.length}개
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  아래 목록에서 동시 트리거되거나 인터럽트 차단 중 함께 대기할 벡터들을 체크하세요.
                </p>

                {/* Vector Selection Chips/List */}
                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 text-xs">
                  {allVectors
                    .filter((v) => v.vectorNum !== 1) // exclude RESET from normal collisions
                    .map((vec) => {
                      const isSelected = selectedCollidingVectors.includes(vec.vectorName);
                      return (
                        <div
                          key={vec.vectorName}
                          onClick={() => toggleVectorCollision(vec.vectorName)}
                          className={`px-3 py-2 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-500 text-white font-semibold'
                              : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-mono text-[10px] font-bold flex items-center justify-center">
                              #{vec.vectorNum}
                            </span>
                            <span className="font-mono">{vec.vectorName}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 truncate max-w-[150px]">
                            {vec.sourceName}
                          </span>
                        </div>
                      );
                    })}
                </div>

                {/* Environmental Sliders */}
                <div className="pt-4 border-t border-slate-800 space-y-4">
                  {/* CPU Frequency */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
                      <span>CPU 클럭 주파수 (F_CPU)</span>
                      <span className="font-mono text-amber-400">{cpuFreqMhz} MHz (주기 {cycleTimeNs.toFixed(1)} ns)</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[8, 12, 16, 20].map((freq) => (
                        <button
                          key={freq}
                          onClick={() => setCpuFreqMhz(freq)}
                          className={`py-1 text-xs font-mono rounded-lg border transition ${
                            cpuFreqMhz === freq
                              ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {freq} MHz
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Winning ISR Execution Cycles */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                      <span>최우선 ISR 실행 클럭 소요량</span>
                      <span className="font-mono text-amber-400">
                        {activeIsrCycles} 클럭 ({isrDurationUs.toFixed(2)} µs)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="600"
                      step="10"
                      value={activeIsrCycles}
                      onChange={(e) => setActiveIsrCycles(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>20클럭 (초고속 플래그)</span>
                      <span>150클럭 (중형 ISR)</span>
                      <span>600클럭 (위험 긴 연산)</span>
                    </div>
                  </div>

                  {/* UART Baud Rate (if UART is involved) */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                      <span>USART 통신 보드레이트 (Baud Rate)</span>
                      <span className="font-mono text-amber-400">{uartBaudRate.toLocaleString()} bps</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[9600, 57600, 115200].map((baud) => (
                        <button
                          key={baud}
                          onClick={() => setUartBaudRate(baud)}
                          className={`py-1 text-xs font-mono rounded-lg border transition ${
                            uartBaudRate === baud
                              ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {baud} bps
                        </button>
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      1바이트 수신 소요 시간: <span className="font-mono text-slate-200">{uartByteTimeUs.toFixed(1)} µs</span> (하드웨어 2바이트 FIFO 초과 시 오버런)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 7 Cols: Hardware Arbitration Pipeline & Risk Analysis */}
            <div className="lg:col-span-7 space-y-5">
              {/* AVR Hardware Arbitration Result Box */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    AVR 하드웨어 중재 엔진: 우선순위 실행 파이프라인
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Fixed Hardware Priority (Lowest Address First)
                  </span>
                </div>

                <div className="space-y-3">
                  {collidingVectorObjects.map((vec, idx) => {
                    const isWinner = idx === 0;
                    return (
                      <div
                        key={vec.vectorName}
                        className={`p-4 rounded-xl border transition-all ${
                          isWinner
                            ? 'bg-gradient-to-r from-emerald-950/40 via-emerald-900/20 to-slate-950 border-emerald-500/50 shadow-md shadow-emerald-500/5'
                            : 'bg-slate-950/80 border-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-6 h-6 rounded-full font-black text-xs flex items-center justify-center ${
                                isWinner
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-white text-sm">
                                  {vec.vectorName}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-400">
                                  Vector #{vec.vectorNum} (Addr {vec.programAddress})
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {vec.sourceName}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            {isWinner ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                즉시 실행 (Active Service)
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/30">
                                <Clock className="w-3.5 h-3.5" />
                                대기 (Pending in {vec.flagRegister})
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Timing bar for this vector */}
                        <div className="mt-3 pt-3 border-t border-slate-800/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-400">
                          <div>
                            {isWinner ? (
                              <span>
                                총 턴어라운드: <span className="font-mono text-emerald-400 font-bold">{totalWinningTurnaroundCycles} 클럭</span> ({totalWinningTurnaroundUs.toFixed(2)} µs)
                              </span>
                            ) : (
                              <span>
                                지연 대기 시간: <span className="font-mono text-amber-400 font-bold">최소 {totalWinningTurnaroundUs.toFixed(2)} µs</span> (상위 ISR 완료 및 1인스트럭션 후)
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            플래그 레지스터: {vec.flagRegister}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Hardware Arbitration Explanatory Note */}
                <div className="mt-4 p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-400 leading-relaxed flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-200 font-semibold">AVR 하드웨어 중재 규칙:</span>
                    {' '}동일 클럭 사이클 또는 전역 인터럽트 차단(<code className="text-amber-300 font-mono">cli()</code>) 상태에서 여러 인터럽트 요청이 발생하면,
                    AVR CPU는 오직 <span className="text-amber-400 font-bold">벡터 테이블 번호가 가장 작은(주소가 가장 낮은) 벡터</span>를 먼저 디스패치합니다.
                    후순위 인터럽트는 해당 주변장치의 플래그 레지스터(EIFR, TIFR 등)에 하드웨어적으로 래치(Latch)된 채 대기합니다.
                  </div>
                </div>
              </div>

              {/* Hazard & Risk Diagnostics Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  충돌 시뮬레이션 위험도 정밀 진단 (Hazard Diagnostics)
                </div>

                <div className="space-y-3 text-xs">
                  {/* Check 1: USART Overrun */}
                  {usartDeferred && (
                    <div className={`p-3.5 rounded-xl border ${isUsartOverrunRisk ? 'bg-red-950/40 border-red-500/60' : 'bg-emerald-950/20 border-emerald-500/30'}`}>
                      <div className="flex items-center gap-2 font-bold mb-1">
                        {isUsartOverrunRisk ? (
                          <span className="text-red-400 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4" />
                            [심각] USART Data Overrun (DOR0) 발생 확정!
                          </span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4" />
                            [안전] USART 수신 버퍼 여유 내 처리 가능
                          </span>
                        )}
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        상위 ISR 처리 지연 시간({totalWinningTurnaroundUs.toFixed(1)} µs)이 USART 2바이트 수신 여유 시간({(uartByteTimeUs * 2).toFixed(1)} µs)보다
                        {isUsartOverrunRisk ? ' 깁니다! 새로운 바이트가 수신 시프트 레지스터를 밀어내며 기존 UDR 바이트가 손실됩니다.' : ' 짧아 하드웨어 2바이트 FIFO 내부에서 데이터가 보존됩니다.'}
                      </p>
                    </div>
                  )}

                  {/* Check 2: External Pulse Drop */}
                  {externalDeferred && (
                    <div className="p-3.5 rounded-xl border bg-amber-950/20 border-amber-500/40">
                      <div className="flex items-center gap-2 font-bold text-amber-400 mb-1">
                        <AlertTriangle className="w-4 h-4" />
                        [주의] 외부 인터럽트 펄스 유실(Pulse Drop) 주의
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        <code className="text-amber-300 font-mono">{externalDeferred.vectorName}</code> 플래그는 1비트 레지스터({externalDeferred.flagRegister})입니다.
                        상위 ISR이 실행 중일 때 외부 신호가 2회 이상 연속 인가되면, 하드웨어는 1회만 래치하므로 두 번째 펄스는 영구 유실됩니다.
                      </p>
                    </div>
                  )}

                  {/* Check 3: Multibyte Shared Variable Race Condition */}
                  <div className="p-3.5 rounded-xl border bg-slate-950/80 border-slate-800">
                    <div className="flex items-center gap-2 font-bold text-slate-200 mb-1">
                      <ShieldCheck className="w-4 h-4 text-indigo-400" />
                      다중 바이트(16-bit / 32-bit) 레이스 컨디션 검증
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      AVR은 8비트 데이터 버스 구조입니다. <code className="text-amber-300 font-mono">uint16_t</code>나 <code className="text-amber-300 font-mono">uint32_t</code> 변수를 메인 루프에서 읽는 도중 상위 인터럽트가 발생하여 상위 바이트만 갱신되면 <span className="text-amber-400 font-semibold">데이터 찢김(Torn Read/Write)</span>이 발생합니다. 반드시 <code className="text-amber-300 font-mono">ATOMIC_BLOCK(ATOMIC_RESTORESTATE)</code>를 적용해야 합니다.
                    </p>
                  </div>

                  {/* Check 4: Nested ISRs (ISR_NOBLOCK) Danger */}
                  <div className="p-3.5 rounded-xl border bg-slate-950/80 border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-200">
                        중첩 인터럽트 (ISR_NOBLOCK) 위험도 평가
                      </span>
                      <button
                        onClick={() => setEnableNestedIsr(!enableNestedIsr)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                          enableNestedIsr
                            ? 'bg-red-500/20 text-red-400 border-red-500/50'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {enableNestedIsr ? 'ISR_NOBLOCK 활성화됨 (위험)' : '표준 비차단 모드 (권장)'}
                      </button>
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      {enableNestedIsr ? (
                        <span className="text-red-300">
                          ⚠️ 중첩 인터럽트 허용 시 ISR마다 스택(PC 2~3바이트 + 레지스터 백업 15~35바이트)이 소모됩니다. 동일 인터럽트 재진입 또는 루프 진입 시 {currentProfile.sram}KB SRAM 스택이 즉시 오버플로우되어 MCU가 리셋됩니다!
                        </span>
                      ) : (
                        'AVR 하드웨어는 기본적으로 ISR 진입 시 SREG.I 비트를 자동으로 0으로 클리어하여 다른 인터럽트의 무분별한 중첩을 차단하므로 안전합니다.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Remediation Production C Code Snippet */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Code2 className="w-4 h-4 text-amber-400" />
                    충돌 해결 표준 C 펌웨어 구현 패턴 (Atomic & Deferred Processing)
                  </div>
                  <button
                    onClick={handleCopyRemediationCode}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 transition flex items-center gap-1.5"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? '복사 완료' : '코드 복사'}
                  </button>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed max-h-60">
                  <pre>{`// 1. 고우선순위 ISR: 계산을 하지 않고 플래그만 설정 (최소 클럭 소요)
ISR(${winningVector?.vectorName}) {
    g_${winningVector?.vectorName.replace('_vect', '').toLowerCase()}_flag = 1;
    g_shared_counter++;
}

// 2. 후순위 대기 인터럽트: 상위 ISR 복귀 즉시 하드웨어 자동 디스패치
${deferredVectors.map((v) => `ISR(${v.vectorName}) {
    // ${v.sourceName} 처리 루틴
}`).join('\n')}

// 3. 메인 루프: 원자적 블록으로 공유 변수 안전 접근
#include <util/atomic.h>
void process_events(void) {
    uint16_t count;
    ATOMIC_BLOCK(ATOMIC_RESTORESTATE) {
        count = g_shared_counter; // 16비트 복사 중 인터럽트 차단
    }
    // 무거운 계산은 인터럽트 외부에서 수행
}`}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: Stack Depth & Overflow Analyzer */}
      {subTab === 'stack' && (
        <StackDepthAnalyzer selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />
      )}

      {/* SUB-TAB 5: Hardware Timing & Latency Specs */}
      {subTab === 'architecture' && (
        <div className="space-y-6">
          {/* Hardware Lifecycle Pipeline Diagram */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-amber-400 uppercase tracking-wider mb-2">
                <Clock className="w-4 h-4" />
                AVR 8-Bit RISC 인터럽트 실행 타이밍 라이프사이클
              </div>
              <h3 className="text-xl font-bold text-white">
                인터럽트 발생부터 복귀(RETI)까지의 정밀 하드웨어 클럭 사이클 분해
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
                AVR 코어는 인터럽트 신호가 감지되면 현재 실행 중인 명령어를 완료한 후 4클럭 동안 하드웨어 벡터 점프를 수행합니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative">
                <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
                  Step 1 • 하드웨어 응답
                </div>
                <div className="text-lg font-black text-white mt-1">4 ~ 7 클럭</div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  현재 명령어 실행 완료(1~3클럭) + PC 레지스터를 스택(SP)에 PUSH하고 IVT 주소로 점프(4클럭). 하드웨어가 자동으로 <code className="text-amber-400 font-mono">SREG.I=0</code> 클리어.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative">
                <div className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest font-bold">
                  Step 2 • 프롤로그 (Prologue)
                </div>
                <div className="text-lg font-black text-white mt-1">12 ~ 25 클럭</div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  GCC 컴파일러가 자동 생성: <code className="text-indigo-300 font-mono">PUSH r0, r1</code>, <code className="text-indigo-300 font-mono">IN r0, SREG</code>, <code className="text-indigo-300 font-mono">PUSH r0</code>, 및 ISR 내부에서 사용되는 작업 레지스터(r24, r25 등) 스택 백업.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative">
                <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-bold">
                  Step 3 • 사용자 코드 실행
                </div>
                <div className="text-lg font-black text-white mt-1">N 클럭 (권장 &lt;100)</div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  사용자 ISR 본문 실행. 플래그 레지스터 비트 자동 클리어 확인. 전역 변수 값 변경 및 링버퍼 삽입.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative">
                <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
                  Step 4 • 에필로그 & 복귀
                </div>
                <div className="text-lg font-black text-white mt-1">16 ~ 30 클럭</div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  백업 레지스터 복원(POP) 후 <code className="text-amber-400 font-mono">RETI</code> 실행(4클럭). RETI는 스택에서 PC를 복원하고 <code className="text-amber-400 font-mono">SREG.I=1</code>로 자동 재활성화합니다.
                </p>
              </div>
            </div>

            {/* Architecture Differences Table between 2560/640/128 and 328P */}
            <div className="pt-4 border-t border-slate-800">
              <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-amber-400" />
                MCU별 IVT 주소 스텝 및 명령어 구조 비교
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">MCU 모델</th>
                      <th className="py-2.5 px-4">벡터 개수</th>
                      <th className="py-2.5 px-4">IVT 점프 명령어</th>
                      <th className="py-2.5 px-4">벡터 간격 (바이트)</th>
                      <th className="py-2.5 px-4">PC 스택 크기</th>
                      <th className="py-2.5 px-4">부트로더 재배치</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-slate-300">
                    <tr className="hover:bg-slate-950/50">
                      <td className="py-2.5 px-4 font-bold text-amber-400">ATmega2560</td>
                      <td className="py-2.5 px-4">57개</td>
                      <td className="py-2.5 px-4 text-emerald-400 font-semibold">JMP (4 바이트 / 2 Words)</td>
                      <td className="py-2.5 px-4">4 Bytes (0x0004 스텝)</td>
                      <td className="py-2.5 px-4 text-amber-300 font-bold">3 Bytes (22-bit PC)</td>
                      <td className="py-2.5 px-4">MCUCR (IVSEL)</td>
                    </tr>
                    <tr className="hover:bg-slate-950/50">
                      <td className="py-2.5 px-4 font-bold text-amber-400">ATmega640</td>
                      <td className="py-2.5 px-4">57개</td>
                      <td className="py-2.5 px-4 text-emerald-400 font-semibold">JMP (4 바이트 / 2 Words)</td>
                      <td className="py-2.5 px-4">4 Bytes (0x0004 스텝)</td>
                      <td className="py-2.5 px-4">2 Bytes (16-bit PC)</td>
                      <td className="py-2.5 px-4">MCUCR (IVSEL)</td>
                    </tr>
                    <tr className="hover:bg-slate-950/50">
                      <td className="py-2.5 px-4 font-bold text-amber-400">ATmega128</td>
                      <td className="py-2.5 px-4">35개</td>
                      <td className="py-2.5 px-4 text-emerald-400 font-semibold">JMP (4 바이트 / 2 Words)</td>
                      <td className="py-2.5 px-4">4 Bytes (0x0004 스텝)</td>
                      <td className="py-2.5 px-4">2 Bytes (16-bit PC)</td>
                      <td className="py-2.5 px-4">MCUCR (IVSEL)</td>
                    </tr>
                    <tr className="hover:bg-slate-950/50">
                      <td className="py-2.5 px-4 font-bold text-amber-400">ATmega328P</td>
                      <td className="py-2.5 px-4">26개</td>
                      <td className="py-2.5 px-4 text-indigo-400 font-semibold">RJMP (2 바이트 / 1 Word)</td>
                      <td className="py-2.5 px-4">2 Bytes (0x0002 스텝)</td>
                      <td className="py-2.5 px-4">2 Bytes (16-bit PC)</td>
                      <td className="py-2.5 px-4">MCUCR (IVSEL)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
