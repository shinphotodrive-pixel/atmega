import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Clock,
  Cpu,
  Zap,
  Check,
  Copy,
  AlertTriangle,
  Code2,
  RefreshCw,
  Info,
  Sparkles,
  Sliders,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

interface WdtPrescalerOption {
  wdp3: number; // 0 or 1
  wdp2: number;
  wdp1: number;
  wdp0: number;
  wdpValue: number; // 0..9
  cycles: number; // 2K .. 1024K
  nominalMs: number;
  nominalLabel: string;
  avrLibcMacro: string;
  is328pOnly?: boolean; // 4s and 8s are only available on enhanced WDT (ATmega328P, ATmega640)
}

const WDT_PRESCALER_OPTIONS: WdtPrescalerOption[] = [
  { wdp3: 0, wdp2: 0, wdp1: 0, wdp0: 0, wdpValue: 0, cycles: 2048, nominalMs: 16, nominalLabel: '16 ms (2K 사이클)', avrLibcMacro: 'WDTO_15MS' },
  { wdp3: 0, wdp2: 0, wdp1: 0, wdp0: 1, wdpValue: 1, cycles: 4096, nominalMs: 32, nominalLabel: '32 ms (4K 사이클)', avrLibcMacro: 'WDTO_30MS' },
  { wdp3: 0, wdp2: 0, wdp1: 1, wdp0: 0, wdpValue: 2, cycles: 8192, nominalMs: 64, nominalLabel: '64 ms (8K 사이클)', avrLibcMacro: 'WDTO_60MS' },
  { wdp3: 0, wdp2: 0, wdp1: 1, wdp0: 1, wdpValue: 3, cycles: 16384, nominalMs: 125, nominalLabel: '125 ms (0.125초)', avrLibcMacro: 'WDTO_120MS' },
  { wdp3: 0, wdp2: 1, wdp1: 0, wdp0: 0, wdpValue: 4, cycles: 32768, nominalMs: 250, nominalLabel: '250 ms (0.25초)', avrLibcMacro: 'WDTO_250MS' },
  { wdp3: 0, wdp2: 1, wdp1: 0, wdp0: 1, wdpValue: 5, cycles: 65536, nominalMs: 500, nominalLabel: '500 ms (0.50초)', avrLibcMacro: 'WDTO_500MS' },
  { wdp3: 0, wdp2: 1, wdp1: 1, wdp0: 0, wdpValue: 6, cycles: 131072, nominalMs: 1000, nominalLabel: '1.0 초 (1,000 ms)', avrLibcMacro: 'WDTO_1S' },
  { wdp3: 0, wdp2: 1, wdp1: 1, wdp0: 1, wdpValue: 7, cycles: 262144, nominalMs: 2000, nominalLabel: '2.0 초 (2,000 ms)', avrLibcMacro: 'WDTO_2S' },
  { wdp3: 1, wdp2: 0, wdp1: 0, wdp0: 0, wdpValue: 8, cycles: 524288, nominalMs: 4000, nominalLabel: '4.0 초 (4,000 ms)', avrLibcMacro: 'WDTO_4S', is328pOnly: true },
  { wdp3: 1, wdp2: 0, wdp1: 0, wdp0: 1, wdpValue: 9, cycles: 1048576, nominalMs: 8000, nominalLabel: '8.0 초 (8,000 ms)', avrLibcMacro: 'WDTO_8S', is328pOnly: true }
];

const CPU_CLOCK_PRESETS = [
  { fcpu: 1000000, label: '1.0 MHz (내부 저전력 RC)' },
  { fcpu: 8000000, label: '8.0 MHz (3.3V / 내부 RC)' },
  { fcpu: 11059200, label: '11.0592 MHz (UART 크리스탈)' },
  { fcpu: 12000000, label: '12.0 MHz (USB/크리스탈)' },
  { fcpu: 16000000, label: '16.0 MHz (Arduino 표준)' },
  { fcpu: 20000000, label: '20.0 MHz (정격 최대 클럭)' }
];

export const WatchdogTimeoutCalculator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Hardware model checks
  const isATmega128 = selectedMCU === 'atmega128';
  const registerName = isATmega128 ? 'WDTCR' : 'WDTCSR';
  const hasInterruptMode = !isATmega128; // ATmega328P and ATmega640 have enhanced WDT with WDIE & WDP3

  // State inputs
  const [selectedPrescalerIndex, setSelectedPrescalerIndex] = useState<number>(6); // Default 1.0s (index 6)
  const [fcpu, setFcpu] = useState<number>(16000000);
  const [customFcpuMhz, setCustomFcpuMhz] = useState<string>('16.0');
  const [isCustomFcpu, setIsCustomFcpu] = useState<boolean>(false);
  const [wdtOscFrequency, setWdtOscFrequency] = useState<number>(128000); // 128 kHz nominal
  const [operatingMode, setOperatingMode] = useState<'reset' | 'interrupt' | 'dual' | 'disabled'>('reset');

  // Code copy feedback
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedAvrLibc, setCopiedAvrLibc] = useState<boolean>(false);
  const [copiedInit3, setCopiedInit3] = useState<boolean>(false);

  // Available prescalers for this MCU
  const availablePrescalers = useMemo(() => {
    if (isATmega128) {
      return WDT_PRESCALER_OPTIONS.filter((opt) => !opt.is328pOnly);
    }
    return WDT_PRESCALER_OPTIONS;
  }, [isATmega128]);

  // Ensure selected index is valid
  const safePrescalerIndex = Math.min(selectedPrescalerIndex, availablePrescalers.length - 1);
  const currentPrescaler = availablePrescalers[safePrescalerIndex];

  // Active F_CPU
  const activeFcpu = isCustomFcpu
    ? Math.max(1000, parseFloat(customFcpuMhz) * 1000000 || 16000000)
    : fcpu;

  // Real-time calculation
  const calculations = useMemo(() => {
    // Exact timeout from WDT oscillator: Timeout = Cycles / F_WDT
    const exactTimeoutSeconds = currentPrescaler.cycles / wdtOscFrequency;
    const exactTimeoutMs = exactTimeoutSeconds * 1000;

    // Nominal timeout from datasheet
    const nominalTimeoutMs = currentPrescaler.nominalMs;

    // Instruction cycles executed by CPU during one watchdog timeout
    const cpuCycles = Math.round(exactTimeoutSeconds * activeFcpu);

    // Recommended watchdog reset interval (50% safety margin)
    const recommendedServiceIntervalMs = exactTimeoutMs * 0.5;

    // Register bit values
    const wdp3Bit = isATmega128 ? 0 : currentPrescaler.wdp3;
    const wdp2Bit = currentPrescaler.wdp2;
    const wdp1Bit = currentPrescaler.wdp1;
    const wdp0Bit = currentPrescaler.wdp0;

    let wdeBit = 0;
    let wdieBit = 0;
    if (operatingMode === 'reset') {
      wdeBit = 1;
      wdieBit = 0;
    } else if (operatingMode === 'interrupt') {
      wdeBit = 0;
      wdieBit = hasInterruptMode ? 1 : 0;
    } else if (operatingMode === 'dual') {
      wdeBit = 1;
      wdieBit = hasInterruptMode ? 1 : 0;
    } else {
      // disabled
      wdeBit = 0;
      wdieBit = 0;
    }

    // Step 1: Timed sequence enable (WDCE = 1, WDE = 1)
    const step1RegisterValue = (1 << 4) | (1 << 3); // (1 << WDCE) | (1 << WDE)

    // Step 2: Final target configuration
    let targetRegisterValue = 0;
    if (hasInterruptMode) {
      targetRegisterValue =
        (wdieBit << 6) |
        (wdp3Bit << 5) |
        (wdeBit << 3) |
        (wdp2Bit << 2) |
        (wdp1Bit << 1) |
        wdp0Bit;
    } else {
      targetRegisterValue =
        (wdeBit << 3) |
        (wdp2Bit << 2) |
        (wdp1Bit << 1) |
        wdp0Bit;
    }

    return {
      exactTimeoutSeconds,
      exactTimeoutMs,
      nominalTimeoutMs,
      cpuCycles,
      recommendedServiceIntervalMs,
      step1RegisterValue,
      targetRegisterValue,
      wdeBit,
      wdieBit,
      wdp3Bit,
      wdp2Bit,
      wdp1Bit,
      wdp0Bit
    };
  }, [
    currentPrescaler,
    wdtOscFrequency,
    activeFcpu,
    operatingMode,
    hasInterruptMode,
    isATmega128
  ]);

  // Generate bare-metal register code
  const bareMetalCode = useMemo(() => {
    const reg = registerName;
    const is328 = !isATmega128;

    let modeComment = '';
    if (operatingMode === 'reset') modeComment = '시스템 리셋 모드 (System Reset)';
    else if (operatingMode === 'interrupt') modeComment = '인터럽트 모드 (WDT_vect 슬립 절전 웨이크업)';
    else if (operatingMode === 'dual') modeComment = '인터럽트 후 리셋 모드 (Dual Mode: EEPROM 덤프 후 리셋)';
    else modeComment = 'WDT 완전 비활성화';

    if (operatingMode === 'disabled') {
      return `// ============================================================================
// ${currentProfile.name} WDT 안전 비활성화 (Timed Sequence)
// ============================================================================
#include <avr/io.h>
#include <avr/interrupt.h>

void WDT_Disable_Safe(void) {
    uint8_t sreg_backup = SREG;
    cli(); // 타이밍 보호: 4사이클 타임아웃 방지를 위해 전역 인터럽트 차단

    // 1. 이전 리셋 원인 플래그(WDRF) 소거 (소거하지 않으면 WDE가 비활성화되지 않음)
    MCUSR &= ~(1 << WDRF);

    // 2. 4-사이클 시간 제한 변경 시퀀스 시작 (WDCE 및 WDE 동시 1 세팅)
    ${reg} |= (1 << WDCE) | (1 << WDE);

    // 3. 4 클럭 사이클 이내에 WDE를 0으로 기록하여 WDT 완전 정지
    ${reg} = 0x00;

    SREG = sreg_backup; // 이전 인터럽트 상태 복원
}`;
    }

    const wdpConfigBits: string[] = [];
    if (is328 && calculations.wdp3Bit) wdpConfigBits.push('(1 << WDP3)');
    if (calculations.wdp2Bit) wdpConfigBits.push('(1 << WDP2)');
    if (calculations.wdp1Bit) wdpConfigBits.push('(1 << WDP1)');
    if (calculations.wdp0Bit) wdpConfigBits.push('(1 << WDP0)');
    if (calculations.wdeBit) wdpConfigBits.push('(1 << WDE)');
    if (is328 && calculations.wdieBit) wdpConfigBits.push('(1 << WDIE)');

    const finalBitsExpr = wdpConfigBits.length > 0 ? wdpConfigBits.join(' | ') : '0x00';

    return `// ============================================================================
// ${currentProfile.name} ${reg} 워치독 타이머 초기화 (Bare-metal)
// 동작 모드: ${modeComment}
// 공칭 타임아웃: ${calculations.nominalTimeoutMs} ms (실제: ${calculations.exactTimeoutMs.toFixed(1)} ms)
// F_CPU: ${(activeFcpu / 1e6).toFixed(4)} MHz | CPU 실행 여유 사이클: ${calculations.cpuCycles.toLocaleString()} cycles
// ============================================================================
#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/wdt.h>

void WDT_Init(void) {
    uint8_t sreg_backup = SREG;
    cli(); // 4-사이클 시퀀스 중 인터럽트 끼어듦 방지

    // 워치독 타이머 리셋
    wdt_reset();

    // 1. MCUSR의 WDRF(Watchdog Reset Flag) 반드시 클리어
    MCUSR &= ~(1 << WDRF);

    // 2. 시간 제한 시퀀스 활성화: WDCE 및 WDE 비트에 동시 1 기록
    ${reg} |= (1 << WDCE) | (1 << WDE);

    // 3. 정확히 4 사이클 이내에 새로운 분주비 및 모드 비트 기록
    // 타임아웃: ${currentPrescaler.nominalLabel}
    ${reg} = ${finalBitsExpr};

    SREG = sreg_backup; // 인터럽트 복구
}
${
  operatingMode === 'interrupt' || operatingMode === 'dual'
    ? `
/**
 * @brief WDT 타임아웃 인터럽트 서비스 루틴
 */
ISR(WDT_vect) {
    // ⚠️ 듀얼 모드인 경우 하드웨어가 WDIE를 자동 소거하므로,
    // 다음 타임아웃 전에 리셋을 방지하려면 WDIE를 재설정해야 합니다.
    // 긴급 상태 EEPROM 백업 또는 슬립 모드 복구 작업 수행:
}`
    : ''
}

void Process_Main_Loop(void) {
    while (1) {
        // 주기적인 워치독 킥 (주기: ${calculations.recommendedServiceIntervalMs.toFixed(1)} ms 이내 권장)
        wdt_reset();

        // 사용자 작업 수행...
    }
}`;
  }, [
    registerName,
    isATmega128,
    operatingMode,
    currentProfile.name,
    calculations,
    activeFcpu,
    currentPrescaler
  ]);

  // Generate avr-libc standard macros code
  const avrLibcCode = useMemo(() => {
    return `// ============================================================================
// <avr/wdt.h> 표준 라이브러리 함수 활용
// 타임아웃: ${currentPrescaler.nominalLabel} (${currentPrescaler.avrLibcMacro})
// ============================================================================
#include <avr/io.h>
#include <avr/wdt.h>

void setup(void) {
    // 워치독 활성화 (프리스케일러 타임아웃 매크로 지정)
    wdt_enable(${currentPrescaler.avrLibcMacro});
}

void loop(void) {
    // 메인 루프 주기적 갱신
    wdt_reset();
    
    // 타임아웃(${calculations.nominalTimeoutMs}ms) 내에 반환되는 비차단(Non-blocking) 로직 구성
}`;
  }, [currentPrescaler, calculations]);

  // Infamous Boot Loop Prevention snippet (.init3 hook)
  const init3PreventionCode = useMemo(() => {
    const reg = registerName;
    return `// ============================================================================
// [필수 방어 코드] WDT 무한 부트 루프(Boot-Loop Trap) 방지 루틴
// 워치독 리셋 후 MCU 재부팅 시 16ms 최단 타임아웃으로 영구 재부팅되는 현상 방지
// ============================================================================
#include <avr/io.h>
#include <avr/wdt.h>

// main() 함수 진입 이전(.init3 섹션)에 즉시 WDT를 끄는 글로벌 훅
uint8_t mcusr_mirror __attribute__((section(".noinit")));

void get_mcusr(void) __attribute__((naked, section(".init3")));
void get_mcusr(void) {
    mcusr_mirror = MCUSR;
    MCUSR = 0; // 리셋 플래그 소거
    
    // 즉각적인 WDT 비활성화 (인터럽트 허용 전 시점)
    ${reg} |= (1 << WDCE) | (1 << WDE);
    ${reg} = 0x00;
}`;
  }, [registerName]);

  const copyText = (text: string, type: 'bare' | 'lib' | 'init3') => {
    navigator.clipboard.writeText(text);
    if (type === 'bare') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else if (type === 'lib') {
      setCopiedAvrLibc(true);
      setTimeout(() => setCopiedAvrLibc(false), 2000);
    } else {
      setCopiedInit3(true);
      setTimeout(() => setCopiedInit3(false), 2000);
    }
  };

  return (
    <div id="watchdog-timer-configuration-calculator-section" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 backdrop-blur shadow-2xl space-y-6 scroll-mt-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" /> Watchdog Timer (WDT) Configuration Calculator
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              MCU: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-800/60 text-xs font-mono">
              제어 레지스터: {registerName}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Watchdog Timer (WDT) Configuration Calculator (워치독 타이머 설정 계산기)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            워치독 타임아웃 주기(16ms ~ 8s)와 시스템 클록(F_CPU)을 선택하여 <strong>{registerName} 레지스터의 WDP3:0 분주비 및 WDE/WDIE 비트</strong>를 계산하고,
            <strong> 시스템 리셋 모드(System Reset) vs 인터럽트 모드(Interrupt Mode)</strong> 설정을 지원합니다.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Quick MCU Switcher */}
          {onSelectMCU && (
            <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 shrink-0">
              {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
                <button
                  key={mcuId}
                  onClick={() => onSelectMCU(mcuId)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                    selectedMCU === mcuId
                      ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {MCU_PROFILES[mcuId].name}
                </button>
              ))}
            </div>
          )}

          {/* Current Timeout Metric Badge */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-right flex-shrink-0 min-w-[210px]">
            <div className="text-[11px] text-slate-400 font-mono">유효 타임아웃 주기</div>
            <div className="text-2xl font-mono font-black text-rose-400 mt-0.5">
              {calculations.exactTimeoutMs >= 1000
                ? `${(calculations.exactTimeoutMs / 1000).toFixed(2)} 초`
                : `${calculations.exactTimeoutMs.toFixed(1)} ms`}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              공칭 스펙: <span className="font-mono text-amber-400 font-bold">{calculations.nominalTimeoutMs} ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* 1. Prescaler Selection */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-rose-400" /> WDT 분주비 (Prescaler WDP)
            </span>
            <span className="text-[11px] font-mono text-amber-400">
              {currentPrescaler.cycles.toLocaleString()} cycles
            </span>
          </label>

          <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
            {availablePrescalers.map((option, idx) => {
              const isSelected = safePrescalerIndex === idx;
              return (
                <button
                  key={option.wdpValue}
                  onClick={() => setSelectedPrescalerIndex(idx)}
                  className={`p-2 rounded-lg border text-left transition flex flex-col justify-between ${
                    isSelected
                      ? 'bg-rose-950/60 border-rose-500 text-white shadow-md shadow-rose-950/40'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <span className="font-mono font-bold text-xs">{option.nominalLabel}</span>
                  <span className="text-[10px] font-mono text-slate-500 mt-0.5">
                    WDP={option.wdp3 ? '1' : '0'}{option.wdp2}{option.wdp1}{option.wdp0} ({option.avrLibcMacro})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-[10px] text-slate-400 pt-1">
            {isATmega128 ? (
              <span className="text-amber-400">
                ⚠️ ATmega128은 3비트 WDP(WDP2:0)를 사용하므로 최대 2.0초(2,048 ms)까지 지원됩니다.
              </span>
            ) : (
              <span className="text-emerald-400">
                ✅ 4비트 WDP3:0 분주비 확장을 통해 최대 8.0초(1,024K 사이클)까지 설정 가능합니다.
              </span>
            )}
          </div>
        </div>

        {/* 2. System Clock & WDT Oscillator Settings */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> 시스템 클럭 (F_CPU)
            </label>
            <button
              onClick={() => setIsCustomFcpu(!isCustomFcpu)}
              className="text-[10px] text-amber-400 hover:text-amber-300 underline font-mono"
            >
              {isCustomFcpu ? '프리셋 선택' : '직접 입력'}
            </button>
          </div>

          {isCustomFcpu ? (
            <div className="relative">
              <input
                type="number"
                step="0.0001"
                min="0.1"
                max="30"
                value={customFcpuMhz}
                onChange={(e) => setCustomFcpuMhz(e.target.value)}
                className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-amber-400"
                placeholder="16.0"
              />
              <span className="absolute right-3 top-2 text-xs text-slate-400 font-mono">MHz</span>
            </div>
          ) : (
            <select
              value={fcpu}
              onChange={(e) => setFcpu(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
            >
              {CPU_CLOCK_PRESETS.map((clk) => (
                <option key={clk.fcpu} value={clk.fcpu}>
                  {clk.label}
                </option>
              ))}
            </select>
          )}

          {/* Calibrated WDT Oscillator input */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                <Zap className="w-3 h-3 text-cyan-400" /> WDT 온칩 오실레이터 주파수
              </label>
              <span className="text-[10px] font-mono text-cyan-400">{wdtOscFrequency / 1000} kHz</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="100000"
                max="150000"
                step="1000"
                value={wdtOscFrequency}
                onChange={(e) => setWdtOscFrequency(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <button
                onClick={() => setWdtOscFrequency(128000)}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                title="128 kHz 기본값 복원"
              >
                128k
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              공칭값은 128 kHz(5V, 25°C)이며, 공급 전압(3.3V~5V) 및 온도에 따라 ±10% 편차가 발생합니다.
            </p>
          </div>
        </div>

        {/* 3. WDT Operating Mode Selection */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-purple-400" /> 워치독 동작 모드
          </label>

          <div className="space-y-1.5">
            <button
              onClick={() => setOperatingMode('reset')}
              className={`w-full text-left p-2 rounded-lg border text-xs transition flex items-center justify-between ${
                operatingMode === 'reset'
                  ? 'bg-rose-950/60 border-rose-500 text-white font-semibold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <div>
                <span className="block font-bold">시스템 리셋 모드 (WDE=1, WDIE=0)</span>
                <span className="text-[10px] text-slate-400">타임아웃 시 MCU 하드웨어 리셋 강제</span>
              </div>
              <span className="font-mono text-[11px] text-rose-400">기본</span>
            </button>

            {hasInterruptMode && (
              <>
                <button
                  onClick={() => setOperatingMode('interrupt')}
                  className={`w-full text-left p-2 rounded-lg border text-xs transition flex items-center justify-between ${
                    operatingMode === 'interrupt'
                      ? 'bg-purple-950/60 border-purple-500 text-white font-semibold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div>
                    <span className="block font-bold">인터럽트 모드 (WDE=0, WDIE=1)</span>
                    <span className="text-[10px] text-slate-400">WDT_vect 호출 (Power-Down 슬립 웨이크업)</span>
                  </div>
                  <span className="font-mono text-[11px] text-purple-400">절전</span>
                </button>

                <button
                  onClick={() => setOperatingMode('dual')}
                  className={`w-full text-left p-2 rounded-lg border text-xs transition flex items-center justify-between ${
                    operatingMode === 'dual'
                      ? 'bg-amber-950/60 border-amber-500 text-white font-semibold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div>
                    <span className="block font-bold">듀얼 모드 (인터럽트 후 리셋)</span>
                    <span className="text-[10px] text-slate-400">1차 ISR 경고(EEPROM 로깅) → 2차 리셋</span>
                  </div>
                  <span className="font-mono text-[11px] text-amber-400">보호</span>
                </button>
              </>
            )}

            <button
              onClick={() => setOperatingMode('disabled')}
              className={`w-full text-left p-2 rounded-lg border text-xs transition flex items-center justify-between ${
                operatingMode === 'disabled'
                  ? 'bg-slate-800 border-slate-600 text-white font-semibold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <div>
                <span className="block font-bold">워치독 비활성화 (OFF)</span>
                <span className="text-[10px] text-slate-400">4-사이클 시퀀스로 WDE 안전 해제</span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">정지</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Budget & Timing Analysis Card */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-rose-400" />
            타이밍 예산(Timing Budget) & CPU 명령 사이클 분석
          </h3>
          <span className="text-xs font-mono text-slate-400">
            F_CPU: {(activeFcpu / 1e6).toFixed(4)} MHz | F_WDT: {(wdtOscFrequency / 1000).toFixed(1)} kHz
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 block text-[11px]">공칭 데이터시트 타임아웃</span>
            <span className="text-lg font-bold text-white">{calculations.nominalTimeoutMs} ms</span>
            <span className="text-[10px] text-slate-500 block">5V 기준 표준 공칭치</span>
          </div>

          <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 block text-[11px]">실제 계산 타임아웃 (F_WDT 오실레이터 기준)</span>
            <span className="text-lg font-bold text-rose-400">{calculations.exactTimeoutMs.toFixed(2)} ms</span>
            <span className="text-[10px] text-slate-500 block">
              {calculations.exactTimeoutSeconds.toFixed(4)} 초
            </span>
          </div>

          <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 block text-[11px]">타임아웃까지 CPU 실행 사이클</span>
            <span className="text-lg font-bold text-cyan-400">
              {calculations.cpuCycles.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500 block">단일 명령어(1 cycle) 기준</span>
          </div>

          <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 block text-[11px]">권장 루프 갱신(Kick) 주기 (50%)</span>
            <span className="text-lg font-bold text-emerald-400">
              ≤ {calculations.recommendedServiceIntervalMs.toFixed(1)} ms
            </span>
            <span className="text-[10px] text-slate-500 block">wdt_reset() 호출 안전 한계</span>
          </div>
        </div>

        {/* Visual Progress / Safety Budget Bar */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> 메인 루프 지연 허용 시간 (Max Blocking Operation)
            </span>
            <span className="text-emerald-400 font-mono text-xs font-bold">
              안전 구역: 0 ~ {calculations.recommendedServiceIntervalMs.toFixed(1)} ms (50% 버퍼)
            </span>
          </div>

          <div className="h-3 bg-slate-950 rounded-full border border-slate-800 overflow-hidden flex">
            <div className="h-full bg-emerald-500 w-[50%]" title="안전한 루프 실행 구역 (0 ~ 50%)" />
            <div className="h-full bg-amber-500 w-[30%]" title="주의 구역 (50 ~ 80%)" />
            <div className="h-full bg-rose-500 w-[20%]" title="위험 구역 (80 ~ 100%)" />
          </div>

          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>0 ms (wdt_reset 호출)</span>
            <span className="text-emerald-400 font-bold">50% 권장 갱신점</span>
            <span className="text-rose-400 font-bold">100% WDT 타임아웃 리셋 ({calculations.exactTimeoutMs.toFixed(1)}ms)</span>
          </div>
        </div>
      </div>

      {/* Bit-field Register Diagram */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              {registerName} 제어 레지스터 비트맵 시각화
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              생성된 레지스터 값: <span className="font-mono text-amber-400 font-bold">0x{calculations.targetRegisterValue.toString(16).padStart(2, '0').toUpperCase()}</span> (2진수: {calculations.targetRegisterValue.toString(2).padStart(8, '0')})
            </p>
          </div>

          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
            {currentProfile.name} SFR
          </span>
        </div>

        {/* 8-Bit Visual Display */}
        <div className="grid grid-cols-8 gap-1 text-center font-mono text-xs">
          {/* Bit 7 */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
            <span className="text-[10px] text-slate-500 block">Bit 7</span>
            <span className="font-bold text-slate-300 text-xs">WDIF</span>
            <span className="text-sm font-bold text-slate-400 block mt-1">0</span>
            <span className="text-[9px] text-slate-500 block">Flag</span>
          </div>

          {/* Bit 6 */}
          <div className={`rounded-lg p-2 border ${calculations.wdieBit ? 'bg-purple-950/60 border-purple-500' : 'bg-slate-900 border-slate-800'}`}>
            <span className="text-[10px] text-slate-500 block">Bit 6</span>
            <span className={`font-bold text-xs ${calculations.wdieBit ? 'text-purple-300' : 'text-slate-400'}`}>WDIE</span>
            <span className={`text-sm font-bold block mt-1 ${calculations.wdieBit ? 'text-purple-400' : 'text-slate-500'}`}>
              {calculations.wdieBit}
            </span>
            <span className="text-[9px] text-slate-500 block">Int En</span>
          </div>

          {/* Bit 5 */}
          <div className={`rounded-lg p-2 border ${calculations.wdp3Bit ? 'bg-amber-950/60 border-amber-500' : 'bg-slate-900 border-slate-800'}`}>
            <span className="text-[10px] text-slate-500 block">Bit 5</span>
            <span className={`font-bold text-xs ${calculations.wdp3Bit ? 'text-amber-300' : 'text-slate-400'}`}>WDP3</span>
            <span className={`text-sm font-bold block mt-1 ${calculations.wdp3Bit ? 'text-amber-400' : 'text-slate-500'}`}>
              {calculations.wdp3Bit}
            </span>
            <span className="text-[9px] text-slate-500 block">Prescaler</span>
          </div>

          {/* Bit 4 */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
            <span className="text-[10px] text-slate-500 block">Bit 4</span>
            <span className="font-bold text-slate-300 text-xs">WDCE</span>
            <span className="text-sm font-bold text-slate-400 block mt-1">0</span>
            <span className="text-[9px] text-slate-500 block">Change En</span>
          </div>

          {/* Bit 3 */}
          <div className={`rounded-lg p-2 border ${calculations.wdeBit ? 'bg-rose-950/60 border-rose-500' : 'bg-slate-900 border-slate-800'}`}>
            <span className="text-[10px] text-slate-500 block">Bit 3</span>
            <span className={`font-bold text-xs ${calculations.wdeBit ? 'text-rose-300' : 'text-slate-400'}`}>WDE</span>
            <span className={`text-sm font-bold block mt-1 ${calculations.wdeBit ? 'text-rose-400' : 'text-slate-500'}`}>
              {calculations.wdeBit}
            </span>
            <span className="text-[9px] text-slate-500 block">Reset En</span>
          </div>

          {/* Bit 2 */}
          <div className={`rounded-lg p-2 border ${calculations.wdp2Bit ? 'bg-amber-950/60 border-amber-500' : 'bg-slate-900 border-slate-800'}`}>
            <span className="text-[10px] text-slate-500 block">Bit 2</span>
            <span className={`font-bold text-xs ${calculations.wdp2Bit ? 'text-amber-300' : 'text-slate-400'}`}>WDP2</span>
            <span className={`text-sm font-bold block mt-1 ${calculations.wdp2Bit ? 'text-amber-400' : 'text-slate-500'}`}>
              {calculations.wdp2Bit}
            </span>
            <span className="text-[9px] text-slate-500 block">Prescaler</span>
          </div>

          {/* Bit 1 */}
          <div className={`rounded-lg p-2 border ${calculations.wdp1Bit ? 'bg-amber-950/60 border-amber-500' : 'bg-slate-900 border-slate-800'}`}>
            <span className="text-[10px] text-slate-500 block">Bit 1</span>
            <span className={`font-bold text-xs ${calculations.wdp1Bit ? 'text-amber-300' : 'text-slate-400'}`}>WDP1</span>
            <span className={`text-sm font-bold block mt-1 ${calculations.wdp1Bit ? 'text-amber-400' : 'text-slate-500'}`}>
              {calculations.wdp1Bit}
            </span>
            <span className="text-[9px] text-slate-500 block">Prescaler</span>
          </div>

          {/* Bit 0 */}
          <div className={`rounded-lg p-2 border ${calculations.wdp0Bit ? 'bg-amber-950/60 border-amber-500' : 'bg-slate-900 border-slate-800'}`}>
            <span className="text-[10px] text-slate-500 block">Bit 0</span>
            <span className={`font-bold text-xs ${calculations.wdp0Bit ? 'text-amber-300' : 'text-slate-400'}`}>WDP0</span>
            <span className={`text-sm font-bold block mt-1 ${calculations.wdp0Bit ? 'text-amber-400' : 'text-slate-500'}`}>
              {calculations.wdp0Bit}
            </span>
            <span className="text-[9px] text-slate-500 block">Prescaler</span>
          </div>
        </div>

        {/* Timed Sequence Step Diagram */}
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="text-amber-400 font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            하드웨어 보호 규격: 4 클럭 사이클 변경 시퀀스 (Timed Sequence)
          </div>
          <p className="text-slate-300 text-xs leading-relaxed">
            AVR 코어는 악성 코드나 포인터 오류로 인해 WDT가 의도치 않게 꺼지거나 타임아웃 주기가 변하는 것을 방지하기 위해 엄격한 2단계 시퀀스를 요구합니다:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-[11px] pt-1">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-amber-400 font-bold block">1단계: 보안 인에이블</span>
              <code>{registerName} |= (1 &lt;&lt; WDCE) | (1 &lt;&lt; WDE);</code>
              <span className="text-slate-500 block text-[10px] mt-1">WDCE 비트 세팅 후 하드웨어 타이머 카운트다운 시작</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-cyan-400 font-bold block">2단계: 4 클럭 이내 신규 설정 쓰기</span>
              <code>{registerName} = 0x{calculations.targetRegisterValue.toString(16).padStart(2, '0').toUpperCase()};</code>
              <span className="text-slate-500 block text-[10px] mt-1">정확히 4 CPU 사이클 내에 새 WDE 및 WDP 비트 기록 완료</span>
            </div>
          </div>
        </div>
      </div>

      {/* Code Generation Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Code2 className="w-4 h-4 text-emerald-400" />
            프로덕션 레디 C 코드 생성기 ({currentProfile.name})
          </h3>
          <span className="text-xs text-slate-400 font-mono">AVR-GCC / Microchip Studio 호환</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Code Box 1: Bare-Metal Driver */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1 text-xs">
                <span className="font-mono text-amber-400 font-bold">
                  방법 1: Bare-Metal 시퀀스 구현
                </span>
                <button
                  onClick={() => copyText(bareMetalCode, 'bare')}
                  className="inline-flex items-center gap-1 text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 text-[11px] transition"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode ? '복사 완료' : '코드 복사'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                인터럽트 임시 차단(cli) 및 4사이클 타임아웃 변경 시퀀스를 완벽하게 반영한 베어메탈 드라이버입니다.
              </p>
            </div>
            <pre className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64 custom-scrollbar">
              {bareMetalCode}
            </pre>
          </div>

          {/* Code Box 2: avr/wdt.h Standard Library */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1 text-xs">
                <span className="font-mono text-cyan-400 font-bold">
                  방법 2: &lt;avr/wdt.h&gt; 표준 라이브러리 매크로
                </span>
                <button
                  onClick={() => copyText(avrLibcCode, 'lib')}
                  className="inline-flex items-center gap-1 text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 text-[11px] transition"
                >
                  {copiedAvrLibc ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedAvrLibc ? '복사 완료' : '코드 복사'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                표준 라이브러리 매크로 <code>wdt_enable({currentPrescaler.avrLibcMacro})</code>를 사용하는 간결한 구현입니다.
              </p>
            </div>
            <pre className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64 custom-scrollbar">
              {avrLibcCode}
            </pre>
          </div>
        </div>

        {/* Critical Trap Prevention: .init3 Early Disable Card */}
        <div className="bg-slate-950/90 border border-rose-500/30 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-mono text-rose-400 font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              [주의] 무한 부트루프(Boot-Loop Trap) 방지 .init3 조기 비활성화 훅
            </span>
            <button
              onClick={() => copyText(init3PreventionCode, 'init3')}
              className="inline-flex items-center gap-1 text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 text-[11px] transition"
            >
              {copiedInit3 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedInit3 ? '복사 완료' : '방어 코드 복사'}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            워치독 리셋이 발생하면 하드웨어 사양상 WDT가 꺼지지 않고 <strong>16ms 최단 타임아웃 상태로 계속 동작</strong>합니다.
            만약 부트로더(Optiboot 등)나 C 런타임 초기화가 16ms보다 오래 걸리면 MCU가 main() 함수에 도달하지 못하고
            영구적으로 무한 재부팅(Bootloop)되는 치명적인 결함이 발생합니다.
            아래 <code>.init3</code> 함수는 main() 이전에 하드웨어 리셋 플래그와 WDT를 즉시 소거하여 이 문제를 원천 차단합니다.
          </p>
          <pre className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 custom-scrollbar">
            {init3PreventionCode}
          </pre>
        </div>
      </div>
    </div>
  );
};
