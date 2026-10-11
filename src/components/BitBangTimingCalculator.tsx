import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Clock,
  Zap,
  Activity,
  Sliders,
  Terminal,
  Copy,
  Check,
  Cpu,
  RotateCcw,
  Sparkles,
  Info,
  Radio,
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type BitBangProtocol = 'custom' | 'uart_serial' | 'i2c_twi' | 'spi_master' | 'ws2812_neopixel' | 'dht11_onewire';

export const BitBangTimingCalculator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Frequency and protocol settings
  const [fCpuHz, setFCpuHz] = useState<number>(16000000); // 16 MHz default
  const [customFCpuStr, setCustomFCpuStr] = useState<string>('16000000');
  const [isCustomClock, setIsCustomClock] = useState<boolean>(false);

  const [protocol, setProtocol] = useState<BitBangProtocol>('i2c_twi');
  const [targetBaudOrSpeed, setTargetBaudOrSpeed] = useState<number>(100000); // e.g. 100kHz I2C, 9600 UART, etc.
  const [halfPeriodDutyPercent, setHalfPeriodDutyPercent] = useState<number>(50); // 50% standard duty

  // NOP loop style: 'inline_nop' | 'loop_dec_brne' | 'inline_asm_macro'
  const [asmStyle, setAsmStyle] = useState<'inline_nop' | 'loop_dec_brne' | 'inline_asm_macro'>('inline_asm_macro');

  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const effectiveFCpu = isCustomClock ? Math.max(100000, parseInt(customFCpuStr, 10) || 16000000) : fCpuHz;

  // Clock Period in Nanoseconds: T_cyc = 1 / F_CPU
  const cycleTimeNs = (1 / effectiveFCpu) * 1e9; // e.g. 62.5ns @ 16MHz

  // Protocol presets helper
  const handleSelectProtocol = (p: BitBangProtocol) => {
    setProtocol(p);
    if (p === 'i2c_twi') {
      setTargetBaudOrSpeed(100000); // 100 kHz standard mode (5µs high, 5µs low)
      setHalfPeriodDutyPercent(50);
    } else if (p === 'uart_serial') {
      setTargetBaudOrSpeed(9600); // 9600 bps = 104.16 µs per bit
      setHalfPeriodDutyPercent(50);
    } else if (p === 'spi_master') {
      setTargetBaudOrSpeed(500000); // 500 kHz = 1µs high, 1µs low
      setHalfPeriodDutyPercent(50);
    } else if (p === 'ws2812_neopixel') {
      setTargetBaudOrSpeed(800000); // 800 kHz = 1.25 µs total bit period (0.4µs T0H, 0.8µs T1H)
      setHalfPeriodDutyPercent(32); // ~0.4µs high for T0H
    } else if (p === 'dht11_onewire') {
      setTargetBaudOrSpeed(20000); // ~50µs timing slots
      setHalfPeriodDutyPercent(50);
    }
  };

  // Math Calculations for Timing & Cycles
  const timing = useMemo(() => {
    // 1. Total Bit/Clock Period (T_period in seconds)
    const periodSeconds = 1 / targetBaudOrSpeed;
    const periodUs = periodSeconds * 1e6;
    const periodNs = periodSeconds * 1e9;

    // 2. High and Low Phase Delays in Microseconds
    const highPhaseUs = periodUs * (halfPeriodDutyPercent / 100);
    const lowPhaseUs = periodUs * (1 - (halfPeriodDutyPercent / 100));

    // 3. Exact Cycle Count for High Phase & Low Phase:
    // Cycles = Delay_seconds * F_CPU
    const highCyclesExact = highPhaseUs * 1e-6 * effectiveFCpu;
    const lowCyclesExact = lowPhaseUs * 1e-6 * effectiveFCpu;

    const highCycles = Math.max(1, Math.round(highCyclesExact));
    const lowCycles = Math.max(1, Math.round(lowCyclesExact));

    // 4. Overhead adjustment:
    // In AVR assembly, toggling a pin via `sbi`/`cbi` takes 1 or 2 cycles (2 cycles on classic AVR Port).
    // `rjmp .+0` takes 2 cycles, `nop` takes 1 cycle.
    // Loop `dec r24` (1 cycle) + `brne loop` (2 cycles when taken, 1 when false) = 3 cycles per iteration.
    const pinToggleCycles = 2; // e.g. sbi / cbi or in/out

    // For pure high phase delay:
    const netHighDelayCycles = Math.max(0, highCycles - pinToggleCycles);
    const netLowDelayCycles = Math.max(0, lowCycles - pinToggleCycles);

    // 3-cycle loop count: Loop takes (count * 3) - 1 cycles
    const loopIterationsHigh = Math.max(1, Math.round((netHighDelayCycles + 1) / 3));
    const actualLoopCyclesHigh = (loopIterationsHigh * 3) - 1;
    const loopRemainderNopsHigh = Math.max(0, netHighDelayCycles - actualLoopCyclesHigh);

    // Actual achieved timing:
    const achievedHighUs = (highCycles / effectiveFCpu) * 1e6;
    const achievedLowUs = (lowCycles / effectiveFCpu) * 1e6;
    const achievedTotalUs = achievedHighUs + achievedLowUs;
    const timingErrorPercent = ((achievedTotalUs - periodUs) / periodUs) * 100;

    return {
      periodUs: parseFloat(periodUs.toFixed(3)),
      periodNs: parseFloat(periodNs.toFixed(1)),
      highPhaseUs: parseFloat(highPhaseUs.toFixed(3)),
      lowPhaseUs: parseFloat(lowPhaseUs.toFixed(3)),
      highCycles,
      lowCycles,
      netHighDelayCycles,
      netLowDelayCycles,
      loopIterationsHigh,
      loopRemainderNopsHigh,
      achievedHighUs: parseFloat(achievedHighUs.toFixed(3)),
      achievedTotalUs: parseFloat(achievedTotalUs.toFixed(3)),
      timingErrorPercent: parseFloat(timingErrorPercent.toFixed(2))
    };
  }, [effectiveFCpu, targetBaudOrSpeed, halfPeriodDutyPercent]);

  // Generate Assembly / C Code
  const generatedCode = useMemo(() => {
    // Generate inline NOP sequence or loop
    let highDelayAsm = '';
    let lowDelayAsm = '';

    if (asmStyle === 'inline_nop') {
      if (timing.netHighDelayCycles <= 32) {
        highDelayAsm = Array(timing.netHighDelayCycles).fill('    __asm__ __volatile__("nop");').join('\n');
      } else {
        highDelayAsm = `    // ${timing.netHighDelayCycles} 사이클 NOP (인라인 전개는 코드가 비대해지므로 루프 권장)\n    for (uint8_t i = 0; i < ${timing.loopIterationsHigh}; i++) { __asm__ __volatile__(""); }`;
      }
    } else if (asmStyle === 'loop_dec_brne') {
      highDelayAsm = `    // 정확히 ${timing.highCycles} 사이클 소비 (DEC + BRNE 3사이클 루프)
    __asm__ __volatile__ (
        "    ldi r24, %0   \\n"
        "1:  dec r24       \\n"
        "    brne 1b       \\n"${timing.loopRemainderNopsHigh > 0 ? '\n' + Array(timing.loopRemainderNopsHigh).fill('        "    nop           \\n"').join('\n') : ''}
        :
        : "M" (${timing.loopIterationsHigh})
        : "r24"
    );`;
    } else {
      // inline_asm_macro with cycle-accurate delay
      highDelayAsm = `    // 정확한 ${timing.highPhaseUs}µs 지연 (${timing.highCycles} Cycles @ ${(effectiveFCpu / 1e6).toFixed(2)}MHz)
    __builtin_avr_delay_cycles(${timing.netHighDelayCycles});`;
      lowDelayAsm = `    // 정확한 ${timing.lowPhaseUs}µs 지연 (${timing.lowCycles} Cycles)
    __builtin_avr_delay_cycles(${timing.netLowDelayCycles});`;
    }

    return `// ==============================================================================
// ${currentProfile.name} Bit-Banging 통신 프로토콜 타이밍 & NOP 어셈블리 생성기
// F_CPU: ${effectiveFCpu.toLocaleString()} Hz (1 사이클 = ${cycleTimeNs.toFixed(2)} ns)
// 프로토콜: ${protocol.toUpperCase()} | 목표 속도: ${targetBaudOrSpeed.toLocaleString()} Hz (주기: ${timing.periodUs} µs)
// High 구간: ${timing.highPhaseUs} µs (${timing.highCycles} Cycles) | Low 구간: ${timing.lowPhaseUs} µs (${timing.lowCycles} Cycles)
// ==============================================================================
#include <avr/io.h>
#include <util/delay_basic.h>

#define BB_PORT   PORTD
#define BB_DDR    DDRD
#define BB_PIN    PIND
#define BB_CLK    PD2   // Bit-bang 클럭 핀
#define BB_DAT    PD3   // Bit-bang 데이터 핀

// 정밀 사이클 지연 매크로 정의
#define DELAY_HIGH_PHASE() \\
    __builtin_avr_delay_cycles(${timing.netHighDelayCycles})

#define DELAY_LOW_PHASE() \\
    __builtin_avr_delay_cycles(${timing.netLowDelayCycles})

// 1비트 클럭 펄스 생성 루틴 (${protocol.toUpperCase()})
void bitbang_transmit_bit(uint8_t bit_val) {
    if (bit_val) {
        BB_PORT |= (1 << BB_DAT);   // Data High (2 cycles)
    } else {
        BB_PORT &= ~(1 << BB_DAT);  // Data Low (2 cycles)
    }

    // 1. 클럭 HIGH 전이 및 유지 (${timing.highPhaseUs} µs)
    BB_PORT |= (1 << BB_CLK);
${highDelayAsm}

    // 2. 클럭 LOW 전이 및 유지 (${timing.lowPhaseUs} µs)
    BB_PORT &= ~(1 << BB_CLK);
${asmStyle === 'inline_asm_macro' ? lowDelayAsm : `    DELAY_LOW_PHASE();`}
}

// 순수 어셈블리 루프 예제 (DEC + BRNE 3-cycle 루프)
void bitbang_cycle_accurate_delay_asm(void) {
    __asm__ __volatile__ (
        "    ldi r24, %0       \\n"  // 1 cycle
        "1:  dec r24           \\n"  // 1 cycle
        "    brne 1b           \\n"  // 2 cycles (참) / 1 cycle (거짓)
        :
        : "M" (${timing.loopIterationsHigh})
        : "r24"
    );
}
`;
  }, [
    currentProfile.name,
    effectiveFCpu,
    cycleTimeNs,
    protocol,
    targetBaudOrSpeed,
    timing,
    asmStyle
  ]);

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.3 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" /> Bit-banging Protocol Timing Calculator
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              MCU: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-mono">
              1 Cycle = {cycleTimeNs.toFixed(2)} ns
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            AVR 범용 통신 프로토콜 타이밍 계산기 (Bit-banging Timing Engine)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            하드웨어 통신 페리페럴이 없거나 핀 리매핑이 필요할 때, 소프트웨어 GPIO 토글로
            <strong>I2C(100k/400k), 소프트웨어 UART(9600/115200bps), SPI, WS2812, 1-Wire</strong>를 구현하기 위한
            최소 마이크로초(µs) 딜레이와 <strong>정밀 NOP / DEC-BRNE 3사이클 어셈블리 명령어</strong>를 계산합니다.
          </p>
        </div>

        {/* Copy Button */}
        <button
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-cyan-500/20 shrink-0"
        >
          {copiedCode ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
          <span>{copiedCode ? '어셈블리 복사됨' : 'Bit-bang C/어셈 코드 복사'}</span>
        </button>
      </div>

      {/* Protocol Presets Toolbar */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-white">표준 프로토콜 원클릭 프리셋:</span>
        </div>
        <div className="flex flex-wrap gap-1.5 font-mono">
          <button
            onClick={() => handleSelectProtocol('i2c_twi')}
            className={`px-2.5 py-1 rounded-lg border font-bold transition ${
              protocol === 'i2c_twi' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            I2C (100kHz / 5µs)
          </button>
          <button
            onClick={() => handleSelectProtocol('uart_serial')}
            className={`px-2.5 py-1 rounded-lg border font-bold transition ${
              protocol === 'uart_serial' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            UART (9600bps / 104.1µs)
          </button>
          <button
            onClick={() => handleSelectProtocol('spi_master')}
            className={`px-2.5 py-1 rounded-lg border font-bold transition ${
              protocol === 'spi_master' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            SPI (500kHz / 1µs)
          </button>
          <button
            onClick={() => handleSelectProtocol('ws2812_neopixel')}
            className={`px-2.5 py-1 rounded-lg border font-bold transition ${
              protocol === 'ws2812_neopixel' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            WS2812 (800kHz / 0.4µs T0H)
          </button>
          <button
            onClick={() => handleSelectProtocol('dht11_onewire')}
            className={`px-2.5 py-1 rounded-lg border font-bold transition ${
              protocol === 'dht11_onewire' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            1-Wire DHT11 (50µs slot)
          </button>
        </div>
      </div>

      {/* Grid: Form Controls (5 cols) & Calculated Metrics (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Settings */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">클럭 및 프로토콜 타이밍 파라미터</h3>
          </div>

          {/* 1. F_CPU Clock Speed */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <label className="text-slate-400 font-medium">시스템 클럭 속도 (F_CPU):</label>
              <button
                type="button"
                onClick={() => setIsCustomClock(!isCustomClock)}
                className="text-[10px] text-cyan-400 hover:underline font-mono"
              >
                {isCustomClock ? '프리셋 선택' : '직접 입력 (Hz)'}
              </button>
            </div>

            {isCustomClock ? (
              <div className="relative">
                <input
                  type="number"
                  value={customFCpuStr}
                  onChange={(e) => setCustomFCpuStr(e.target.value)}
                  placeholder="16000000"
                  className="w-full bg-slate-900 border border-cyan-500/50 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                />
                <span className="absolute right-2.5 top-1.5 text-[10px] text-slate-500 font-mono">Hz</span>
              </div>
            ) : (
              <select
                value={fCpuHz}
                onChange={(e) => setFCpuHz(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
              >
                <option value={16000000}>16.0000 MHz (5V 표준 크리스털 - 62.5ns)</option>
                <option value={8000000}>8.0000 MHz (3.3V / 내부 RC - 125ns)</option>
                <option value={20000000}>20.0000 MHz (ATmega 최대 - 50ns)</option>
                <option value={12000000}>12.0000 MHz (V-USB 전용 - 83.3ns)</option>
                <option value={11059200}>11.0592 MHz (UART 정밀 크리스털 - 90.4ns)</option>
                <option value={4000000}>4.0000 MHz (저전력 - 250ns)</option>
                <option value={1000000}>1.0000 MHz (초기 8분주 퓨즈 - 1µs)</option>
              </select>
            )}
          </div>

          {/* 2. Target Baud Rate / Clock Speed */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1 font-medium">
              <span className="text-slate-400">목표 통신 전송 속도:</span>
              <span className="text-amber-400 font-bold font-mono">
                {targetBaudOrSpeed.toLocaleString()} {protocol === 'uart_serial' ? 'bps (Baud)' : 'Hz (SCL/SCK)'}
              </span>
            </div>
            <input
              type="number"
              min="300"
              max="2000000"
              value={targetBaudOrSpeed}
              onChange={(e) => setTargetBaudOrSpeed(Math.max(1, Number(e.target.value)))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>9600 bps</span>
              <span>100 kHz (I2C)</span>
              <span>400 kHz (Fast I2C)</span>
              <span>800 kHz (WS2812)</span>
            </div>
          </div>

          {/* 3. Duty Cycle Percent */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1 font-medium">
              <span className="text-slate-400">하이(HIGH) 구간 듀티비 (Duty Cycle):</span>
              <span className="text-cyan-300 font-bold font-mono">{halfPeriodDutyPercent}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="90"
              value={halfPeriodDutyPercent}
              onChange={(e) => setHalfPeriodDutyPercent(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
              <span>30% (펄스 짧음)</span>
              <span className="text-emerald-400 font-bold">50% (대칭 사각파)</span>
              <span>70% (펄스 김)</span>
            </div>
          </div>

          {/* 4. Assembly Style */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">어셈블리 지연 구현 방식</label>
            <div className="grid grid-cols-1 gap-1.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setAsmStyle('inline_asm_macro')}
                className={`p-2 rounded-lg border font-bold text-left transition ${
                  asmStyle === 'inline_asm_macro' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                ⚡ __builtin_avr_delay_cycles() [표준 내장함수]
                <span className="block text-[10px] text-slate-400 font-normal">컴파일러가 최적의 NOP/루프를 100% 오차 0으로 자동 생성</span>
              </button>

              <button
                type="button"
                onClick={() => setAsmStyle('loop_dec_brne')}
                className={`p-2 rounded-lg border font-bold text-left transition ${
                  asmStyle === 'loop_dec_brne' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🔄 DEC + BRNE 레지스터 3사이클 루프
                <span className="block text-[10px] text-slate-400 font-normal">코드 크기 최소화 (r24 카운트다운 루프)</span>
              </button>

              <button
                type="button"
                onClick={() => setAsmStyle('inline_nop')}
                className={`p-2 rounded-lg border font-bold text-left transition ${
                  asmStyle === 'inline_nop' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🧱 순수 직렬 nop 명령어 나열
                <span className="block text-[10px] text-slate-400 font-normal">루프 오버헤드 없는 초단타 1~30 사이클 초정밀 지연</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Timing Breakdown & Microsecond Visualizer (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">필요 지연 시간(µs) 및 사이클 연산 명세</h3>
              </div>
              <span className="text-[11px] font-mono text-cyan-300 font-bold">
                전송 주기: {timing.periodUs} µs
              </span>
            </div>

            {/* Timing Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] block font-sans">1. HIGH 상태 유지 지연:</span>
                <div className="text-emerald-400 font-bold text-lg">
                  {timing.highPhaseUs} <span className="text-xs text-slate-400 font-normal">µs</span>
                </div>
                <div className="text-slate-300 text-xs">
                  필요 사이클: <strong className="text-white">{timing.highCycles.toLocaleString()} Cycles</strong>
                </div>
                <div className="text-[10px] text-slate-500 font-sans">
                  (GPIO 토글 2사이클 공제 후 순수 지연: {timing.netHighDelayCycles} Cycles)
                </div>
              </div>

              <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] block font-sans">2. LOW 상태 유지 지연:</span>
                <div className="text-cyan-400 font-bold text-lg">
                  {timing.lowPhaseUs} <span className="text-xs text-slate-400 font-normal">µs</span>
                </div>
                <div className="text-slate-300 text-xs">
                  필요 사이클: <strong className="text-white">{timing.lowCycles.toLocaleString()} Cycles</strong>
                </div>
                <div className="text-[10px] text-slate-500 font-sans">
                  (GPIO 토글 2사이클 공제 후 순수 지연: {timing.netLowDelayCycles} Cycles)
                </div>
              </div>
            </div>

            {/* Loop Counter Summary */}
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 flex justify-between items-center">
              <div>
                <span className="text-slate-400">DEC-BRNE 3사이클 루프 카운터:</span>{' '}
                <strong className="text-amber-400">{timing.loopIterationsHigh}회 반복</strong>
                {timing.loopRemainderNopsHigh > 0 && (
                  <span className="text-slate-500 ml-1">
                    (+ 잔여 {timing.loopRemainderNopsHigh}개 NOP)
                  </span>
                )}
              </div>
              <div className="text-emerald-400 font-bold">
                오차: {timing.timingErrorPercent >= 0 ? `+${timing.timingErrorPercent}` : timing.timingErrorPercent}%
              </div>
            </div>

            {/* Graphic Waveform Visualizer */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-400 block font-mono">
                1비트 전송 파형 타이밍 다이어그램:
              </span>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono">
                <div className="h-10 flex items-center">
                  {/* High Phase Wave */}
                  <div
                    className="h-full bg-emerald-500/20 border-t-2 border-r-2 border-l-2 border-emerald-400 flex flex-col items-center justify-center text-[10px] text-emerald-300 transition-all font-bold"
                    style={{ width: `${halfPeriodDutyPercent}%` }}
                  >
                    HIGH ({timing.highPhaseUs}µs)
                  </div>
                  {/* Low Phase Wave */}
                  <div
                    className="h-full border-b-2 border-slate-600 flex flex-col items-center justify-center text-[10px] text-slate-400 transition-all"
                    style={{ width: `${100 - halfPeriodDutyPercent}%` }}
                  >
                    LOW ({timing.lowPhaseUs}µs)
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>0 µs</span>
                  <span className="text-emerald-400 font-bold">▲ Toggle point</span>
                  <span>{timing.periodUs} µs (1 Bit 완료)</span>
                </div>
              </div>
            </div>

            {/* Architecture Tip */}
            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-xs text-slate-400 leading-relaxed font-sans flex items-start gap-2">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">💡 Bit-banging 구현 시 인터럽트 마스킹 주의사항:</strong>
                <p className="mt-0.5 text-[11px]">
                  소프트웨어 딜레이 루프로 비트를 전송하는 동안 타이머나 UART 인터럽트(ISR)가 끼어들면 타이밍이 지연되어 전송 에러가 발생합니다.
                  정밀 타이밍이 요구되는 WS2812나 고속 I2C 전송 중에는 <code>cli()</code>로 전역 인터럽트를 일시 차단하거나 임계 영역(Atomic)을 적용해야 합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Code Snippet Box */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-bold text-white font-mono">
              생성된 Bit-Banging C & 인라인 어셈블리 루틴
            </span>
          </div>

          <button
            onClick={copyCode}
            className="text-slate-400 hover:text-white text-xs font-mono inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copiedCode ? '복사됨' : '원클릭 복사'}</span>
          </button>
        </div>

        <pre className="p-5 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto max-h-[460px] custom-scrollbar bg-slate-950/90 selection:bg-cyan-500/30">
          {generatedCode}
        </pre>
      </div>
    </div>
  );
};
