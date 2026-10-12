import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
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
  XCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type IsrComplexityLevel = 'minimal_flag' | 'standard_io' | 'medium_buffer' | 'heavy_math' | 'blocking_custom';

interface ComplexityPreset {
  id: IsrComplexityLevel;
  name: string;
  tag: string;
  desc: string;
  cStatements: number;
  pushedGprs: number;
  hasCall: boolean;
  hasFloat: boolean;
  codeSnippet: string;
}

const COMPLEXITY_PRESETS: ComplexityPreset[] = [
  {
    id: 'minimal_flag',
    name: '초경량 단일 플래그 세트 (ISR_NAKED 수준)',
    tag: '최고 속도 (1~2µs)',
    desc: '글로벌 volatile 플래그 변수 1개만 세트하고 즉시 종료. 레지스터 저장 최소화.',
    cStatements: 2,
    pushedGprs: 2, // SREG, R24
    hasCall: false,
    hasFloat: false,
    codeSnippet: `ISR(INT0_vect) {
    // 최소 레지스터만 저장: 0.8µs 내외 처리
    system_event_flag = 1;
}`
  },
  {
    id: 'standard_io',
    name: '표준 GPIO/타이머 카운터 증가',
    tag: '표준 (3~5µs)',
    desc: '포트 토글 및 16비트 밀리초 카운터 증가. GCC 기본 프롤로그(SREG, R0, R1, R24, R25 저장).',
    cStatements: 6,
    pushedGprs: 5,
    hasCall: false,
    hasFloat: false,
    codeSnippet: `ISR(TIMER0_COMPA_vect) {
    timer0_millis++;
    if (timer0_millis % 500 == 0) {
        PORTB ^= (1 << PB5); // LED 토글
    }
}`
  },
  {
    id: 'medium_buffer',
    name: 'UART 원형 링 버퍼 수신 (Ring Buffer FIFO)',
    tag: '중간 부하 (8~12µs)',
    desc: 'UDR0 읽기, 버퍼 인덱스 마스킹, 오버플로우 플래그 처리 및 임시 포인터 연산.',
    cStatements: 14,
    pushedGprs: 10,
    hasCall: false,
    hasFloat: false,
    codeSnippet: `ISR(USART_RX_vect) {
    uint8_t c = UDR0;
    uint8_t next_head = (rx_head + 1) & (RX_BUF_SIZE - 1);
    if (next_head != rx_tail) {
        rx_buffer[rx_head] = c;
        rx_head = next_head;
    } else {
        rx_overflow_count++;
    }
}`
  },
  {
    id: 'heavy_math',
    name: '부동소수점/연산 집약적 필터 (Float DSP in ISR)',
    tag: '고위험 (35~80µs)',
    desc: 'ADC 샘플을 읽고 float IIR/저역통과 필터 연산 수행. 32개 레지스터 전체 PUSH 및 수백 사이클 소모.',
    cStatements: 30,
    pushedGprs: 24,
    hasCall: true,
    hasFloat: true,
    codeSnippet: `ISR(ADC_vect) {
    // [경고] ISR 내부 부동소수점 연산은 치명적 지연을 초래합니다
    float sample = (float)ADC * 5.0f / 1024.0f;
    filtered_val = 0.9f * filtered_val + 0.1f * sample;
}`
  },
  {
    id: 'blocking_custom',
    name: '외부 함수 호출 및 지연 루틴 포함 (Worst Practice)',
    tag: '스택 오버플로우 위험!',
    desc: 'ISR 내에서 printf()나 _delay_ms() 등의 무거운 서브루틴을 직접 호출하여 중첩 스택 고갈 초래.',
    cStatements: 45,
    pushedGprs: 30,
    hasCall: true,
    hasFloat: false,
    codeSnippet: `ISR(INT1_vect) {
    // [치명적 오류] ISR 내 delay 및 I/O 호출
    _delay_ms(10);
    printf("Interrupt triggered!\\r\\n");
}`
  }
];

export const AvrInterruptLatencyAnalyzer: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // System Parameters
  const [fcpuHz, setFcpuHz] = useState<number>(16000000);
  const [complexity, setComplexity] = useState<IsrComplexityLevel>('standard_io');
  const [callFrequencyHz, setCallFrequencyHz] = useState<number>(1000); // 1 kHz
  const [enableNesting, setEnableNesting] = useState<boolean>(false); // sei() inside ISR
  const [customInstructions, setCustomInstructions] = useState<number>(15);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // SRAM Specs
  const sramSpecs = useMemo(() => {
    let sramBytes = 2048;
    let pcBytes = 2; // 2 bytes PC for 16-bit address space
    if (selectedMCU === 'atmega128') {
      sramBytes = 4096;
      pcBytes = 3; // 3 bytes PC on 128KB flash
    } else if (selectedMCU === 'atmega640') {
      sramBytes = 8192;
      pcBytes = 2;
    }
    return { sramBytes, pcBytes };
  }, [selectedMCU]);

  const selectedPreset = useMemo(() => {
    return COMPLEXITY_PRESETS.find((p) => p.id === complexity) || COMPLEXITY_PRESETS[1];
  }, [complexity]);

  // Calculations for Latency & Stack Risk
  const metrics = useMemo(() => {
    // 1. Hardware Latency:
    // Interrupt execution takes 4 cycles to push PC onto stack and jump to vector address
    // Plus maximum currently executing multi-cycle instruction (e.g. LDS, STS, RETI takes 4 cycles)
    // Average hardware response: 4 + 2 = 6 cycles
    const hwLatencyCycles = 5;

    // 2. GCC Compiler Prologue (Context Saving):
    // PUSH SREG (in R0) + PUSH R0 + PUSH R1 + CLR R1 = ~8 cycles
    // Each additional GPR PUSH takes 2 clock cycles
    const pushedGprs = selectedPreset.pushedGprs;
    const prologuePushCycles = 4 + pushedGprs * 2;

    // 3. ISR Body Execution:
    // Simple statement: ~2-3 cycles each. If float, +250 cycles. If function call, +15 cycles.
    let isrBodyCycles = customInstructions * 2;
    if (selectedPreset.hasFloat) isrBodyCycles += 320;
    if (selectedPreset.hasCall) isrBodyCycles += 80;

    // 4. GCC Epilogue (Context Restoring) + RETI:
    // POP each register (2 cycles) + POP SREG + RETI (4 cycles)
    const epiloguePopCycles = 4 + pushedGprs * 2;

    // Total Latency & Duration:
    const totalResponseCycles = hwLatencyCycles + prologuePushCycles; // Time until 1st user statement runs
    const totalIsrCycles = hwLatencyCycles + prologuePushCycles + isrBodyCycles + epiloguePopCycles;

    // Time in nanoseconds and microseconds
    const cycleTimeNs = (1 / fcpuHz) * 1e9;
    const responseLatencyUs = (totalResponseCycles * cycleTimeNs) / 1000;
    const totalDurationUs = (totalIsrCycles * cycleTimeNs) / 1000;

    // CPU Overhead Percentage:
    // Call frequency * Duration
    const totalPeriodUs = (1 / callFrequencyHz) * 1e6;
    const cpuUtilizationPct = Math.min(100, (totalDurationUs / totalPeriodUs) * 100);

    // Stack Consumption:
    // PC (2 or 3 bytes) + pushed GPRs (1 byte each) + SREG (1 byte) + local frame buffer
    let stackPerIsr = sramSpecs.pcBytes + pushedGprs + 1;
    if (selectedPreset.hasFloat) stackPerIsr += 16;
    if (selectedPreset.hasCall) stackPerIsr += 8;

    // Max Nested Stack Depth:
    // If nesting enabled, up to 4 concurrent interrupts can chain together
    const maxNestingDepth = enableNesting ? 4 : 1;
    const totalIsrStackBytes = stackPerIsr * maxNestingDepth;
    const stackMarginBytes = sramSpecs.sramBytes - 350 - totalIsrStackBytes; // 350B typical main() stack
    const isStackCritical = stackMarginBytes < 64 || cpuUtilizationPct > 50;

    return {
      hwLatencyCycles,
      prologuePushCycles,
      isrBodyCycles,
      epiloguePopCycles,
      totalResponseCycles,
      totalIsrCycles,
      responseLatencyUs,
      totalDurationUs,
      totalPeriodUs,
      cpuUtilizationPct,
      stackPerIsr,
      totalIsrStackBytes,
      stackMarginBytes,
      isStackCritical
    };
  }, [
    fcpuHz,
    selectedPreset,
    customInstructions,
    callFrequencyHz,
    enableNesting,
    sramSpecs
  ]);

  // Recommended C Code Template
  const optimizedCodeSnippet = useMemo(() => {
    return `/**
 * @file   optimized_isr_pattern.c
 * @target ${currentProfile.name} (SRAM: ${sramSpecs.sramBytes}B, F_CPU: ${(fcpuHz / 1e6).toFixed(1)}MHz)
 * @brief  인터럽트 지연 시간 최소화 및 스택 안전 패턴 가이드
 * @metrics 반응 지연: ${metrics.responseLatencyUs.toFixed(2)}µs | CPU 점유율: ${metrics.cpuUtilizationPct.toFixed(1)}%
 */

#include <avr/io.h>
#include <avr/interrupt.h>

// 1. 원자적 데이터 교환을 위한 volatile 변수 선언
volatile uint8_t g_event_pending = 0;
volatile uint16_t g_captured_val = 0;

/**
 * @brief 최적화된 ISR: 무거운 연산이나 I/O를 배제하고 플래그만 세트
 * 소요 시간: 약 ${metrics.totalDurationUs.toFixed(2)} µs (${metrics.totalIsrCycles} Cycles)
 * 스택 점유: ${metrics.stackPerIsr} 바이트
 */
ISR(TIMER1_COMPA_vect) {
    // A. 최소 레지스터만 변경하여 프롤로그 PUSH 오버헤드 80% 단축
    g_captured_val = TCNT1;
    g_event_pending = 1;
    
    // [중요] ISR 내부에서는 printf, float, _delay_ms를 절대 호출하지 마십시오!
}

int main(void) {
    // 하드웨어 타이머 설정...
    sei(); // 전역 인터럽트 활성화

    while (1) {
        // 메인 슈퍼루프에서 안전하게 비즈니스 로직 처리
        if (g_event_pending) {
            uint16_t local_val;
            
            // 임계 영역 보호 (원자적 읽기)
            cli();
            local_val = g_captured_val;
            g_event_pending = 0;
            sei();
            
            // 무거운 연산/필터링/출력은 여기서 수행
            process_sensor_data(local_val);
        }
    }
}
`;
  }, [currentProfile.name, sramSpecs.sramBytes, fcpuHz, metrics]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(optimizedCodeSnippet);
      setCopiedCode(true);
      confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 } });
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {}
  };

  const handleDownload = () => {
    const blob = new Blob([optimizedCodeSnippet], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `optimized_isr_${selectedMCU}.c`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-7 shadow-2xl backdrop-blur">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" /> 인터럽트 성능 분석기 (Interrupt Latency Analyzer)
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              F_CPU: {(fcpuHz / 1000000).toFixed(1)} MHz
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 text-xs font-mono font-bold">
              {currentProfile.name}
            </span>
            {metrics.isStackCritical && (
              <span className="px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-300 border border-rose-700/60 text-[11px] font-mono font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                스택 오버플로우 또는 CPU 과부하 주의!
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            AVR 인터럽트 지연 시간(Interrupt Latency) 분석기 & 스택 안전 가이드
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            ISR의 복잡도와 호출 빈도에 따른 하드웨어 점프 지연, 레지스터 컨텍스트 스위칭(PUSH/POP) 오버헤드, 시스템 반응 시간(Response Latency) 및 CPU 점유율을 정밀 산출하고 스택 고갈 위험을 예방합니다.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-lg shadow-cyan-600/20 flex items-center gap-1.5"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? '복사됨!' : '최적화 코드 복사'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.c 다운로드</span>
          </button>
        </div>
      </div>

      {/* KPI Dashcards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">시스템 반응 지연 시간</span>
          <span className="text-base font-bold text-cyan-400 font-mono">
            {metrics.responseLatencyUs.toFixed(2)} µs
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            {metrics.totalResponseCycles} Cycles (HW + PUSH)
          </span>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">ISR 총 실행 시간</span>
          <span className="text-base font-bold text-violet-400 font-mono">
            {metrics.totalDurationUs.toFixed(2)} µs
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            총 {metrics.totalIsrCycles} 클럭 사이클
          </span>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">ISR CPU 점유율</span>
          <span className={`text-base font-bold font-mono ${
            metrics.cpuUtilizationPct > 40 ? 'text-rose-400' : metrics.cpuUtilizationPct > 15 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {metrics.cpuUtilizationPct.toFixed(1)}%
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            주기당 {metrics.totalDurationUs.toFixed(1)}µs / {metrics.totalPeriodUs.toFixed(0)}µs
          </span>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">단일 ISR 스택 소비</span>
          <span className="text-base font-bold text-amber-400 font-mono">
            {metrics.stackPerIsr} Bytes
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            PC({sramSpecs.pcBytes}B) + 레지스터 PUSH
          </span>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 col-span-2 sm:col-span-4 lg:col-span-1">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">최대 중첩 스택 소비</span>
          <span className={`text-base font-bold font-mono ${
            metrics.isStackCritical ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            {metrics.totalIsrStackBytes} Bytes
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            잔여 여유: {metrics.stackMarginBytes} B
          </span>
        </div>
      </div>

      {/* Main Configuration Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950/50 p-5 rounded-2xl border border-slate-800">
        {/* Left: Presets & Complexity Selector (6 cols) */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              ISR 복잡도 프리셋 선택 (Complexity Preset)
            </h4>
          </div>

          <div className="space-y-2">
            {COMPLEXITY_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setComplexity(p.id)}
                className={`w-full p-3 rounded-xl border text-left transition flex items-start justify-between gap-3 ${
                  complexity === p.id
                    ? 'bg-cyan-950/70 border-cyan-500 text-white shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{p.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300">
                      {p.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">{p.desc}</p>
                </div>
                {complexity === p.id && <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Dynamic Timing & Frequency Parameters (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
            <Clock className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              동작 주파수 및 호출 주기 파라미터 (Timing & Rate)
            </h4>
          </div>

          {/* Call Frequency Slider */}
          <div className="space-y-1.5 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-sans">인터럽트 발생 빈도 (Interrupt Frequency)</span>
              <span className="text-cyan-400 font-bold">
                {callFrequencyHz >= 1000 ? `${(callFrequencyHz / 1000).toFixed(1)} kHz` : `${callFrequencyHz} Hz`}
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="20000"
              step="50"
              value={callFrequencyHz}
              onChange={(e) => setCallFrequencyHz(parseInt(e.target.value) || 1000)}
              className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>50 Hz (저속 버튼/센서)</span>
              <span>1 kHz (millis 틱)</span>
              <span>20 kHz (고속 PWM/ADC)</span>
            </div>
          </div>

          {/* System Clock Selector */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 flex items-center justify-between">
              <span>MCU 시스템 클럭 (F_CPU)</span>
              <span className="font-mono text-cyan-400 font-bold">{(fcpuHz / 1e6).toFixed(1)} MHz</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '16 MHz', hz: 16000000 },
                { label: '8 MHz', hz: 8000000 },
                { label: '1 MHz', hz: 1000000 },
                { label: '20 MHz', hz: 20000000 }
              ].map((c) => (
                <button
                  key={c.hz}
                  onClick={() => setFcpuHz(c.hz)}
                  className={`py-1.5 rounded-lg border text-xs font-mono transition ${
                    fcpuHz === c.hz
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-600 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nested Interrupt Toggle */}
          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">중첩 인터럽트 활성화 (Nested ISR / sei())</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                ISR 진입 후 sei()를 호출하여 우선순위 인터럽트 허용 시 스택 깊이가 급증합니다.
              </span>
            </div>
            <input
              type="checkbox"
              checked={enableNesting}
              onChange={(e) => setEnableNesting(e.target.checked)}
              className="accent-cyan-500 rounded w-4 h-4 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Cycle Breakdown Visual Bar */}
      <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
            <Activity className="w-4 h-4 text-cyan-400" />
            사이클 단계별 오버헤드 분해 (Latency Breakdown)
          </span>
          <span className="text-slate-400 text-[11px]">
            총 {metrics.totalIsrCycles} 클럭 사이클 ({metrics.totalDurationUs.toFixed(2)} µs)
          </span>
        </div>

        {/* Visual Proportional Bar */}
        <div className="h-9 w-full rounded-xl overflow-hidden flex border border-slate-800 select-none text-[10px] font-bold">
          {/* HW Latency */}
          <div
            style={{ width: `${(metrics.hwLatencyCycles / metrics.totalIsrCycles) * 100}%` }}
            className="bg-blue-600 p-1 flex items-center justify-center text-white"
            title={`하드웨어 인터럽트 트리거 및 벡터 점프: ${metrics.hwLatencyCycles} 사이클`}
          >
            HW ({metrics.hwLatencyCycles})
          </div>
          {/* Prologue PUSH */}
          <div
            style={{ width: `${(metrics.prologuePushCycles / metrics.totalIsrCycles) * 100}%` }}
            className="bg-amber-600 p-1 flex items-center justify-center text-slate-950"
            title={`GCC 프롤로그 레지스터 PUSH: ${metrics.prologuePushCycles} 사이클 (${selectedPreset.pushedGprs}개 레지스터)`}
          >
            PUSH ({metrics.prologuePushCycles})
          </div>
          {/* ISR Body */}
          <div
            style={{ width: `${(metrics.isrBodyCycles / metrics.totalIsrCycles) * 100}%` }}
            className="bg-emerald-600 p-1 flex items-center justify-center text-white min-w-[50px]"
            title={`ISR 본문 사용자 로직: ${metrics.isrBodyCycles} 사이클`}
          >
            BODY ({metrics.isrBodyCycles})
          </div>
          {/* Epilogue POP + RETI */}
          <div
            style={{ width: `${(metrics.epiloguePopCycles / metrics.totalIsrCycles) * 100}%` }}
            className="bg-purple-600 p-1 flex items-center justify-center text-white"
            title={`GCC 에필로그 POP & RETI 복귀: ${metrics.epiloguePopCycles} 사이클`}
          >
            POP/RETI ({metrics.epiloguePopCycles})
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>하드웨어 점프: {metrics.hwLatencyCycles} cyc</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>컨텍스트 PUSH: {metrics.prologuePushCycles} cyc</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>본문 연산: {metrics.isrBodyCycles} cyc</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>에필로그 복귀: {metrics.epiloguePopCycles} cyc</span>
          </div>
        </div>
      </div>

      {/* Embedded Code Guide */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Code2 className="w-4 h-4 text-cyan-400" />
            스택 오버플로우 방지 및 최소 지연 ISR 아키텍처 템플릿
          </span>
          <button
            onClick={handleCopy}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? '복사됨!' : '템플릿 복사'}</span>
          </button>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-400">
            <span>optimized_isr_pattern.c ({currentProfile.name})</span>
            <span>AVR-GCC Volatile Flag Pattern</span>
          </div>
          <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-72">
            <code>{optimizedCodeSnippet}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
