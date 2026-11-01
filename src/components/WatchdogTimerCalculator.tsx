import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Clock,
  RotateCcw,
  Sliders,
  Copy,
  Check,
  AlertTriangle,
  Info,
  CheckCircle2,
  Code2,
  Terminal,
  Cpu,
  Layers,
  ArrowRight,
  RefreshCw,
  Bell,
  Activity
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
}

export type WdtMode = 'interrupt' | 'reset' | 'dual' | 'disabled';

interface TimeoutOption {
  prescaler: number; // 0..9
  nominalMs: number;
  label: string;
  cycles: number;
  wdp3: number;
  wdp2: number;
  wdp1: number;
  wdp0: number;
  avrMacro: string;
}

const TIMEOUT_OPTIONS: TimeoutOption[] = [
  { prescaler: 0, nominalMs: 16, label: '16 ms', cycles: 2048, wdp3: 0, wdp2: 0, wdp1: 0, wdp0: 0, avrMacro: 'WDTO_15MS' },
  { prescaler: 1, nominalMs: 32, label: '32 ms', cycles: 4096, wdp3: 0, wdp2: 0, wdp1: 0, wdp0: 1, avrMacro: 'WDTO_30MS' },
  { prescaler: 2, nominalMs: 64, label: '64 ms', cycles: 8192, wdp3: 0, wdp2: 0, wdp1: 1, wdp0: 0, avrMacro: 'WDTO_60MS' },
  { prescaler: 3, nominalMs: 125, label: '125 ms (0.125s)', cycles: 16384, wdp3: 0, wdp2: 0, wdp1: 1, wdp0: 1, avrMacro: 'WDTO_120MS' },
  { prescaler: 4, nominalMs: 250, label: '250 ms (0.25s)', cycles: 32768, wdp3: 0, wdp2: 1, wdp1: 0, wdp0: 0, avrMacro: 'WDTO_250MS' },
  { prescaler: 5, nominalMs: 500, label: '500 ms (0.5s)', cycles: 65536, wdp3: 0, wdp2: 1, wdp1: 0, wdp0: 1, avrMacro: 'WDTO_500MS' },
  { prescaler: 6, nominalMs: 1000, label: '1.0 s', cycles: 131072, wdp3: 0, wdp2: 1, wdp1: 1, wdp0: 0, avrMacro: 'WDTO_1S' },
  { prescaler: 7, nominalMs: 2000, label: '2.0 s', cycles: 262144, wdp3: 0, wdp2: 1, wdp1: 1, wdp0: 1, avrMacro: 'WDTO_2S' },
  { prescaler: 8, nominalMs: 4000, label: '4.0 s', cycles: 524288, wdp3: 1, wdp2: 0, wdp1: 0, wdp0: 0, avrMacro: 'WDTO_4S' },
  { prescaler: 9, nominalMs: 8000, label: '8.0 s', cycles: 1048576, wdp3: 1, wdp2: 0, wdp1: 0, wdp0: 1, avrMacro: 'WDTO_8S' },
];

export const WatchdogTimerCalculator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const isClassicMcu = selectedMCU === 'atmega128';
  const registerName = isClassicMcu ? 'WDTCR' : 'WDTCSR';

  // Available Prescalers: ATmega128 only supports 3 bits (max 2.0s), 328P/640/2560 support 4 bits (up to 8.0s)
  const availableTimeouts = useMemo(() => {
    if (isClassicMcu) {
      return TIMEOUT_OPTIONS.slice(0, 8);
    }
    return TIMEOUT_OPTIONS;
  }, [isClassicMcu]);

  // Selected State
  const [selectedPrescaler, setSelectedPrescaler] = useState<number>(isClassicMcu ? 6 : 9); // default 1s on m128, 8s on 328P/2560
  const [mode, setMode] = useState<WdtMode>('reset');
  const [wdtonFuseActive, setWdtonFuseActive] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [operatingVoltage, setOperatingVoltage] = useState<number>(5.0);

  // If switched to ATmega128, ensure prescaler is <= 7 and mode is reset or disabled
  React.useEffect(() => {
    if (isClassicMcu) {
      if (selectedPrescaler > 7) setSelectedPrescaler(7);
      if (mode === 'interrupt' || mode === 'dual') setMode('reset');
    }
  }, [isClassicMcu, selectedPrescaler, mode]);

  const currentTimeout = availableTimeouts.find((t) => t.prescaler === selectedPrescaler) || availableTimeouts[0];

  // Calculate Register Bits
  // Bits in WDTCSR (Modern):
  // 7: WDIF (Interrupt Flag)
  // 6: WDIE (Interrupt Enable)
  // 5: WDP3 (Prescaler bit 3)
  // 4: WDCE (Change Enable)
  // 3: WDE (System Reset Enable)
  // 2: WDP2 (Prescaler bit 2)
  // 1: WDP1 (Prescaler bit 1)
  // 0: WDP0 (Prescaler bit 0)
  //
  // Bits in WDTCR (Classic ATmega128):
  // 7..5: Reserved (0)
  // 4: WDCE (WDTOE on old docs)
  // 3: WDE
  // 2: WDP2
  // 1: WDP1
  // 0: WDP0
  const registerBits = useMemo(() => {
    const isWde = wdtonFuseActive || mode === 'reset' || mode === 'dual';
    const isWdie = !isClassicMcu && !wdtonFuseActive && (mode === 'interrupt' || mode === 'dual');
    const wdp3 = isClassicMcu ? 0 : currentTimeout.wdp3;
    const wdp2 = currentTimeout.wdp2;
    const wdp1 = currentTimeout.wdp1;
    const wdp0 = currentTimeout.wdp0;

    let hexVal = 0;
    if (isClassicMcu) {
      if (isWde) hexVal |= 1 << 3;
      hexVal |= (wdp2 << 2) | (wdp1 << 1) | wdp0;
    } else {
      if (isWdie) hexVal |= 1 << 6;
      if (wdp3) hexVal |= 1 << 5;
      if (isWde) hexVal |= 1 << 3;
      hexVal |= (wdp2 << 2) | (wdp1 << 1) | wdp0;
    }

    const binaryStr = hexVal.toString(2).padStart(8, '0');
    const hexStr = '0x' + hexVal.toString(16).toUpperCase().padStart(2, '0');

    // Individual bits array (Bit 7 down to Bit 0)
    const bits = isClassicMcu
      ? [
          { index: 7, name: '-', val: 0, desc: '예약됨 (Reserved)', role: 'reserved' },
          { index: 6, name: '-', val: 0, desc: '예약됨 (Reserved)', role: 'reserved' },
          { index: 5, name: '-', val: 0, desc: '예약됨 (Reserved)', role: 'reserved' },
          { index: 4, name: 'WDCE', val: 0, desc: 'Watchdog Change Enable (안전 해제용)', role: 'control' },
          { index: 3, name: 'WDE', val: isWde ? 1 : 0, desc: 'Watchdog Enable (시스템 리셋 인에이블)', role: 'reset' },
          { index: 2, name: 'WDP2', val: wdp2, desc: `Prescaler Bit 2 [${wdp2}]`, role: 'prescaler' },
          { index: 1, name: 'WDP1', val: wdp1, desc: `Prescaler Bit 1 [${wdp1}]`, role: 'prescaler' },
          { index: 0, name: 'WDP0', val: wdp0, desc: `Prescaler Bit 0 [${wdp0}]`, role: 'prescaler' },
        ]
      : [
          { index: 7, name: 'WDIF', val: 0, desc: 'Watchdog Interrupt Flag (인터럽트 플래그)', role: 'flag' },
          { index: 6, name: 'WDIE', val: isWdie ? 1 : 0, desc: 'Watchdog Interrupt Enable (인터럽트 인에이블)', role: 'interrupt' },
          { index: 5, name: 'WDP3', val: wdp3, desc: `Prescaler Bit 3 [${wdp3}] (확장 주기)`, role: 'prescaler' },
          { index: 4, name: 'WDCE', val: 0, desc: 'Watchdog Change Enable (4-사이클 설정 해제)', role: 'control' },
          { index: 3, name: 'WDE', val: isWde ? 1 : 0, desc: 'Watchdog System Reset Enable (리셋 인에이블)', role: 'reset' },
          { index: 2, name: 'WDP2', val: wdp2, desc: `Prescaler Bit 2 [${wdp2}]`, role: 'prescaler' },
          { index: 1, name: 'WDP1', val: wdp1, desc: `Prescaler Bit 1 [${wdp1}]`, role: 'prescaler' },
          { index: 0, name: 'WDP0', val: wdp0, desc: `Prescaler Bit 0 [${wdp0}]`, role: 'prescaler' },
        ];

    return {
      hexVal,
      hexStr,
      binaryStr,
      bits,
      isWde,
      isWdie,
      wdp3,
      wdp2,
      wdp1,
      wdp0,
    };
  }, [isClassicMcu, wdtonFuseActive, mode, currentTimeout]);

  // Oscillator drift calculations (Nominal 128 kHz ±15% variance across temperature/Vcc)
  const timingStats = useMemo(() => {
    const nominalSeconds = currentTimeout.nominalMs / 1000;
    // Lower voltage (e.g. 3V vs 5V) slows oscillator slightly
    const vFactor = operatingVoltage < 3.5 ? 0.92 : 1.0;
    const minSeconds = nominalSeconds * 0.85 * vFactor; // -15% worst-case fast oscillator
    const maxSeconds = nominalSeconds * 1.15 * vFactor; // +15% worst-case slow oscillator

    // Recommended maximum service (patting) interval to prevent accidental reset: 65% of minimum timeout
    const safePatIntervalSeconds = minSeconds * 0.65;
    const safePatIntervalFormatted =
      safePatIntervalSeconds < 0.1
        ? `${Math.round(safePatIntervalSeconds * 1000)} ms`
        : `${safePatIntervalSeconds.toFixed(2)} s`;

    // Power consumption addition
    const wdtCurrentMicroAmps = selectedMCU === 'atmega328p' ? 4.2 : 8.0;

    return {
      nominalSeconds,
      minSeconds,
      maxSeconds,
      safePatIntervalSeconds,
      safePatIntervalFormatted,
      wdtCurrentMicroAmps,
    };
  }, [currentTimeout, operatingVoltage, selectedMCU]);

  // Generated C Source Code
  const generatedCCode = useMemo(() => {
    const hex = registerBits.hexStr;
    const reg = registerName;

    if (mode === 'disabled' && !wdtonFuseActive) {
      return `/* =========================================================================
 * AVR Watchdog Timer (WDT) 완전 비활성화 (Disable / Turn-off) 루틴
 * Target MCU : ${currentProfile.name}
 * Register   : ${reg}
 * 주의사항   : MCUSR의 WDRF를 먼저 클리어하지 않으면 무한 리셋 루프가 발생할 수 있습니다.
 * ========================================================================= */
#include <avr/io.h>
#include <avr/wdt.h>
#include <avr/interrupt.h>

void wdt_disable_safe(void) {
    cli();                  // 4 사이클 타이밍 보호를 위해 전역 인터럽트 차단
    wdt_reset();            // 워치독 카운터 초기화
    
    // 1. 리셋 원인 레지스터(MCUSR)에서 워치독 리셋 플래그(WDRF) 해제
    MCUSR &= ~(1 << WDRF);

    // 2. 타이밍 시퀀스 개시 (WDCE와 WDE 동시 설정)
    ${reg} |= (1 << WDCE) | (1 << WDE);

    // 3. 4 클럭 사이클 이내에 WDE 및 모든 제어 비트를 0으로 작성
    ${reg} = 0x00;

    sei();                  // 전역 인터럽트 복원
}
`;
    }

    if (isClassicMcu) {
      // ATmega128 code
      return `/* =========================================================================
 * AVR Watchdog Timer (WDT) System Reset 설정 루틴
 * Target MCU : ATmega128 (Classic AVR Architecture)
 * Register   : WDTCR (${hex})
 * 타임아웃   : ${currentTimeout.label} (${currentTimeout.cycles.toLocaleString()} Cycles)
 * ========================================================================= */
#include <avr/io.h>
#include <avr/wdt.h>
#include <avr/interrupt.h>

void wdt_init_atmega128(void) {
    cli();                  // 원자적(Atomic) 실행 보장
    wdt_reset();            // 워치독 카운터 사전 리셋

    // MCUSR 워치독 리셋 플래그 클리어
    MCUSR &= ~(1 << WDRF);

    // 4사이클 타임드 시퀀스: WDCE (또는 WDTOE) 및 WDE 동시 세트
    WDTCR |= (1 << WDCE) | (1 << WDE);

    // 새로운 프리스케일러 및 WDE 비트 쓰기 (계산된 Hex 값: ${hex})
    WDTCR = ${hex};

    sei();                  // 인터럽트 재활성화
}

// 메인 루프 또는 주기적 태스크에서 반드시 wdt_reset() 호출 필요!
// 권장 호출 주기: < ${timingStats.safePatIntervalFormatted}
int main(void) {
    wdt_init_atmega128();

    while (1) {
        // [사용자 애플리케이션 작업]
        
        wdt_reset(); // 워치독 갱신 (Kick the dog)
    }
}
`;
    }

    // Modern AVR (ATmega328P / ATmega640 / ATmega2560)
    let modeComment = '';
    let isrCode = '';
    if (mode === 'interrupt') {
      modeComment = '인터럽트 모드 (WDIE=1, WDE=0: 주기적 슬립 탈출 및 저전력 타이머)';
      isrCode = `// 워치독 타임아웃 인터럽트 서비스 루틴 (WDT_vect)
ISR(WDT_vect) {
    // 주의: 인터럽트 진입 시 플래그는 하드웨어에 의해 자동 클리어됩니다.
    // 슬립 모드에서 깨어나 센서 측정 또는 상태 머신 갱신을 수행합니다.
}
`;
    } else if (mode === 'dual') {
      modeComment = '인터럽트 및 시스템 리셋 복합 모드 (WDIE=1, WDE=1: 1차 경고 후 2차 강제 리셋)';
      isrCode = `// 1차 타임아웃 발생 시 실행되는 경고 인터럽트
ISR(WDT_vect) {
    // 하드웨어가 자동으로 WDIE를 0으로 내리므로, 다음 타임아웃 시 MCU 하드 리셋 발생!
    // 크래시 직전 중요 변수를 EEPROM에 덤프하거나 블랙박스 로그를 전송하십시오.
}
`;
    } else {
      modeComment = '시스템 리셋 모드 (WDIE=0, WDE=1: 펌웨어 락업/무한루프 감지 시 하드 리셋)';
    }

    return `/* =========================================================================
 * AVR Watchdog Timer (WDT) 설정 루틴
 * Target MCU : ${currentProfile.name}
 * Register   : WDTCSR (${hex})
 * 동작 모드  : ${modeComment}
 * 타임아웃   : ${currentTimeout.label} (공칭 ${currentTimeout.nominalMs}ms, ${currentTimeout.cycles.toLocaleString()} Cycles)
 * 안전 갱신  : 주기 < ${timingStats.safePatIntervalFormatted} 이내 wdt_reset() 호출 필요
 * ========================================================================= */
#include <avr/io.h>
#include <avr/wdt.h>
#include <avr/interrupt.h>
#include <avr/sleep.h>

void wdt_init_custom(void) {
    cli();                  // 인터럽트 비활성화 (4클럭 시퀀스 보호)
    wdt_reset();            // 워치독 타이머 0으로 클리어

    // 1. 부트 루프 방지: MCUSR의 워치독 리셋 플래그(WDRF) 필수 해제
    MCUSR &= ~(1 << WDRF);

    // 2. 4 클럭 사이클 변경 잠금 해제 (WDCE와 WDE 동시 1 세트)
    WDTCSR |= (1 << WDCE) | (1 << WDE);

    // 3. 4 사이클 이내 목표 레지스터 값(${hex}) 직접 쓰기
    WDTCSR = ${hex};

    sei();                  // 전역 인터럽트 인에이블
}

${isrCode}
int main(void) {
    wdt_init_custom();

    while (1) {
        // [사용자 작업 수행]

        // 워치독 갱신 (리셋 모드인 경우 주기적 갱신 필수)
        wdt_reset();
    }
}
`;
  }, [
    currentProfile,
    registerName,
    registerBits,
    isClassicMcu,
    mode,
    wdtonFuseActive,
    currentTimeout,
    timingStats
  ]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.85 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div id="watchdog-timer-calculator-section" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur-xl shadow-2xl space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-lg shadow-rose-500/10">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                워치독 타이머 (WDT) 구성 계산기 & 레지스터 생성기
              </h3>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold">
                {registerName}
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                {currentProfile.name}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              독립형 128kHz 온칩 오실레이터 기반의 워치독 타임아웃 주기(16ms ~ 8s) 및 동작 모드(인터럽트, 시스템 리셋, 듀얼 모드)를 선택하여
              정확한 <strong>{registerName}</strong> 제어 레지스터 Hex 값과 4-사이클 안전 타임드 시퀀스 C 코드를 자동 산출합니다.
            </p>
          </div>
        </div>

        {/* Big Hex Result Badge */}
        <div className="bg-slate-950 px-5 py-3 rounded-2xl border border-rose-500/30 shadow-inner flex items-center gap-4 shrink-0">
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-400 block tracking-wider">
              {registerName} HEX
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-rose-400 tracking-wider">
                {registerBits.hexStr}
              </span>
              <span className="text-xs font-mono text-slate-400">
                ({registerBits.binaryStr})
              </span>
            </div>
          </div>
          <div className="border-l border-slate-800 pl-4 text-right">
            <span className="text-[10px] text-slate-400 block font-mono">공칭 타임아웃</span>
            <span className="text-sm font-bold font-mono text-amber-400">
              {currentTimeout.label}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Controls (Mode & Prescaler), Right Live Register View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Mode Selection, Prescaler, Options */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Operation Mode Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                1. 워치독 동작 모드 (Operation Mode)
              </label>
              {isClassicMcu && (
                <span className="text-[10px] text-amber-400/90 font-mono">
                  * ATmega128은 레거시 코어로 시스템 리셋/비활성화만 지원
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* System Reset Mode */}
              <button
                type="button"
                onClick={() => setMode('reset')}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                  mode === 'reset'
                    ? 'bg-rose-950/40 border-rose-500/80 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${mode === 'reset' ? 'text-rose-400' : 'text-slate-200'}`}>
                    <RotateCcw className="w-3.5 h-3.5" />
                    시스템 리셋 모드 (System Reset)
                  </span>
                  {mode === 'reset' && (
                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  WDE = 1, WDIE = 0. 타임아웃 발생 시 MCU를 하드 리셋하여 무한루프나 시스템 락업(Lock-up)을 복구합니다.
                </p>
                <div className="mt-2 text-[10px] font-mono text-rose-300/80">
                  전형적 용도: 안정성 보장, 펌웨어 멈춤 감지
                </div>
              </button>

              {/* Interrupt Mode (Modern AVR only) */}
              <button
                type="button"
                disabled={isClassicMcu}
                onClick={() => setMode('interrupt')}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                  isClassicMcu
                    ? 'opacity-40 cursor-not-allowed bg-slate-950 border-slate-800'
                    : mode === 'interrupt'
                    ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${mode === 'interrupt' ? 'text-emerald-400' : 'text-slate-200'}`}>
                    <Bell className="w-3.5 h-3.5" />
                    인터럽트 모드 (Interrupt Only)
                  </span>
                  {mode === 'interrupt' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  WDIE = 1, WDE = 0. 타임아웃 시 리셋하지 않고 <code className="text-emerald-300">WDT_vect</code> 인터럽트를 실행합니다.
                </p>
                <div className="mt-2 text-[10px] font-mono text-emerald-300/80">
                  전형적 용도: 초저전력 Sleep 모드 주기적 기상 (Wakeup)
                </div>
              </button>

              {/* Dual Mode: Interrupt + Reset (Modern AVR only) */}
              <button
                type="button"
                disabled={isClassicMcu}
                onClick={() => setMode('dual')}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                  isClassicMcu
                    ? 'opacity-40 cursor-not-allowed bg-slate-950 border-slate-800'
                    : mode === 'dual'
                    ? 'bg-amber-950/40 border-amber-500/80 shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${mode === 'dual' ? 'text-amber-400' : 'text-slate-200'}`}>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    인터럽트 + 시스템 리셋 (Dual Mode)
                  </span>
                  {mode === 'dual' && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  WDIE = 1, WDE = 1. 1차 타임아웃 시 인터럽트 발생 후 WDIE 자동 해제, 2차 타임아웃 시 강제 리셋.
                </p>
                <div className="mt-2 text-[10px] font-mono text-amber-300/80">
                  전형적 용도: 리셋 직전 EEPROM에 에러 로그/상태 백업
                </div>
              </button>

              {/* Disabled / Off Mode */}
              <button
                type="button"
                onClick={() => setMode('disabled')}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                  mode === 'disabled'
                    ? 'bg-slate-900 border-slate-500/80 shadow-lg shadow-slate-900/40 ring-1 ring-slate-400/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${mode === 'disabled' ? 'text-slate-200' : 'text-slate-400'}`}>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    완전 비활성화 (WDT Stopped)
                  </span>
                  {mode === 'disabled' && (
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  WDIE = 0, WDE = 0. 워치독 타이머를 정지시켜 파워다운 시 불필요한 대기 전력 소모를 0으로 만듭니다.
                </p>
                <div className="mt-2 text-[10px] font-mono text-slate-400">
                  * WDTON 퓨즈가 언프로그래밍(1) 상태여야 정지 가능
                </div>
              </button>
            </div>
          </div>

          {/* 2. Timeout Period (Prescaler) Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                2. 타임아웃 주기 선택 (Timeout Period & Prescaler)
              </label>
              <span className="text-[11px] font-mono text-cyan-300">
                선택: {currentTimeout.label} ({currentTimeout.cycles.toLocaleString()} 사이클)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {availableTimeouts.map((t) => {
                const isSelected = t.prescaler === selectedPrescaler;
                return (
                  <button
                    key={t.prescaler}
                    type="button"
                    onClick={() => setSelectedPrescaler(t.prescaler)}
                    className={`py-2.5 px-2 rounded-xl border text-center transition font-mono ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold shadow-md shadow-cyan-950/40 ring-1 ring-cyan-400/40'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-bold">{t.nominalMs < 1000 ? `${t.nominalMs}ms` : `${t.nominalMs / 1000}s`}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {isClassicMcu ? `WDP2:0=${t.wdp2}${t.wdp1}${t.wdp0}` : `WDP=${t.wdp3}${t.wdp2}${t.wdp1}${t.wdp0}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Hardware Fuse & VCC Environment Options */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              하드웨어 퓨즈 및 공급 전압 (VCC) 오실레이터 보정
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* WDTON Fuse Toggle */}
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 cursor-pointer hover:bg-slate-900 transition">
                <input
                  type="checkbox"
                  checked={wdtonFuseActive}
                  onChange={(e) => setWdtonFuseActive(e.target.checked)}
                  className="rounded border-slate-700 text-rose-500 focus:ring-rose-500"
                />
                <div>
                  <span className="font-bold text-slate-200 block">WDTON 퓨즈 활성화 (Programmed)</span>
                  <span className="text-[10px] text-slate-400 leading-tight block mt-0.5">
                    소프트웨어 제어 불가 강제 하드웨어 리셋 모드
                  </span>
                </div>
              </label>

              {/* VCC Slider for RC Oscillator Drift */}
              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-300 text-[11px]">동작 전압 (VCC):</span>
                  <span className="font-mono text-cyan-400 font-bold">{operatingVoltage.toFixed(1)} V</span>
                </div>
                <input
                  type="range"
                  min="1.8"
                  max="5.5"
                  step="0.1"
                  value={operatingVoltage}
                  onChange={(e) => setOperatingVoltage(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                  <span>1.8V (저속/저온)</span>
                  <span>3.3V</span>
                  <span>5.0V (표준 128kHz)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Live 8-Bit Register Layout & Timing Envelope */}
        <div className="lg:col-span-5 space-y-5">
          {/* 8-bit Register Visual Grid */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {registerName} 비트 배치도 (Bit Map)
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                {registerBits.hexStr}
              </span>
            </div>

            {/* 8-bit table */}
            <div className="grid grid-cols-8 gap-1 text-center font-mono">
              {registerBits.bits.map((b) => {
                let badgeColor = 'bg-slate-900 border-slate-800 text-slate-500';
                if (b.role === 'interrupt') badgeColor = b.val === 1 ? 'bg-emerald-500/25 border-emerald-500 text-emerald-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-500';
                else if (b.role === 'reset') badgeColor = b.val === 1 ? 'bg-rose-500/25 border-rose-500 text-rose-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-500';
                else if (b.role === 'prescaler') badgeColor = b.val === 1 ? 'bg-cyan-500/25 border-cyan-500 text-cyan-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-500';
                else if (b.role === 'control') badgeColor = 'bg-slate-900 border-slate-800 text-slate-500';

                return (
                  <div key={b.index} className="space-y-1">
                    <span className="text-[9px] text-slate-400 block font-mono">b{b.index}</span>
                    <div className={`p-1.5 rounded-lg border text-xs font-bold ${badgeColor}`}>
                      {b.val}
                    </div>
                    <span className="text-[10px] font-bold text-slate-300 block truncate" title={b.name}>
                      {b.name}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Bit Explanation List */}
            <div className="space-y-1.5 pt-2 text-[11px] divide-y divide-slate-800/60 font-mono">
              {!isClassicMcu && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">WDIE (b6 - 인터럽트 활성화):</span>
                  <span className={registerBits.isWdie ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    {registerBits.isWdie ? '1 (인터럽트 발생)' : '0 (비활성화)'}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">WDE (b3 - 시스템 리셋 활성화):</span>
                <span className={registerBits.isWde ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                  {registerBits.isWde ? '1 (리셋 활성화)' : '0 (비활성화)'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">프리스케일러 (WDP3:0):</span>
                <span className="text-cyan-400 font-bold">
                  {isClassicMcu
                    ? `WDP2:0 = 0b${currentTimeout.wdp2}${currentTimeout.wdp1}${currentTimeout.wdp0}`
                    : `WDP3:0 = 0b${currentTimeout.wdp3}${currentTimeout.wdp2}${currentTimeout.wdp1}${currentTimeout.wdp0}`}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">avr-libc 매크로 상수:</span>
                <span className="text-amber-400 font-bold">{currentTimeout.avrMacro}</span>
              </div>
            </div>
          </div>

          {/* Timing & Safe Patting Interval Envelope */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                오실레이터 허용오차 및 안전 리셋 갱신 권장치
              </span>
              <span className="text-[10px] text-slate-400 font-mono">128 kHz RC 기준</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-mono">최악(최단) 타임아웃</span>
                <span className="text-rose-400 font-bold font-mono text-sm">
                  {timingStats.minSeconds < 0.1
                    ? `${Math.round(timingStats.minSeconds * 1000)} ms`
                    : `${timingStats.minSeconds.toFixed(2)} s`}
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">-15% 오차 반영</span>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-mono">안전 갱신 권장 주기 (Max)</span>
                <span className="text-emerald-400 font-bold font-mono text-sm">
                  {timingStats.safePatIntervalFormatted}
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">wdt_reset() 호출 상한</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              AVR 온칩 128kHz 오실레이터는 전압과 온도에 따라 약 ±15%의 주파수 편차가 있습니다. 의도치 않은 리셋을 방지하려면 메인 루프 또는 타이머에서 최소 타임아웃의 65% 미만인 <strong>{timingStats.safePatIntervalFormatted}</strong> 마다 <code className="text-amber-300">wdt_reset()</code>을 수행하십시오.
            </p>
          </div>
        </div>
      </div>

      {/* 4-Clock Timed Security Sequence Protocol Banner */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
            AVR 하드웨어 4-클럭 사이클 타이밍 시퀀스 보호 규칙 (Timed Sequence Protocol)
          </h4>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          WDT 레지스터는 의도치 않은 쓰기로 인한 칩 멈춤을 방지하기 위해 특수 하드웨어 잠금 장치가 적용되어 있습니다. 
          반드시 <strong>(1) <code className="text-amber-300">MCUSR</code>의 WDRF 비트 클리어</strong> → 
          <strong>(2) <code className="text-amber-300">{registerName}</code>에 WDCE와 WDE 동시 1 작성</strong> → 
          <strong>(3) 정확히 4 클럭 사이클 이내에 새로운 프리스케일러/모드 비트 작성</strong>을 원자적(Atomic, cli/sei)으로 실행해야 반영됩니다.
        </p>
      </div>

      {/* Production C Code Generator Card */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              생성된 C 언어 안전 워치독 초기화 드라이버 코드 ({registerName})
            </h4>
          </div>
          <button
            onClick={handleCopyCode}
            className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-500/20 shrink-0 font-sans"
          >
            {copiedCode ? <Check className="w-4 h-4 text-slate-950" /> : <Copy className="w-4 h-4" />}
            <span>{copiedCode ? '복사 완료!' : 'C 소스 코드 복사'}</span>
          </button>
        </div>

        <pre className="p-4 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed max-h-96 select-all">
          {generatedCCode}
        </pre>
      </div>
    </div>
  );
};
