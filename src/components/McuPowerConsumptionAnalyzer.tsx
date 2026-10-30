import React, { useState, useMemo } from 'react';
import {
  Zap,
  Gauge,
  Sliders,
  Battery,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Clock,
  Sparkles,
  Copy,
  Check,
  TrendingDown,
  RotateCcw,
  Activity,
  Cpu,
  Layers,
  ArrowRight,
  ShieldAlert,
  Flame,
  FileCode
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export const McuPowerConsumptionAnalyzer: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // 1. Operating Voltage (Vcc in Volts)
  const [voltage, setVoltage] = useState<number>(() => {
    return selectedMCU === 'atmega128' ? 5.0 : 3.3;
  });
  const [voltageInput, setVoltageInput] = useState<string>(() => {
    return selectedMCU === 'atmega128' ? '5.0' : '3.3';
  });

  // 2. Clock Frequency (F_CPU in MHz)
  const [frequency, setFrequency] = useState<number>(8.0);
  const [freqInput, setFreqInput] = useState<string>('8.0');

  // 3. Workload Duty Cycle: % of time spent in Active mode vs Sleep mode
  const [activeDutyPct, setActiveDutyPct] = useState<number>(20); // 20% Active, 80% Sleep

  // 4. Battery Capacity for runtime estimation (mAh)
  const [batteryCapacity, setBatteryCapacity] = useState<number>(2500); // 2,500 mAh (AA Pair)

  // 5. Sleep Mode type
  const [sleepMode, setSleepMode] = useState<'idle' | 'power_down'>('power_down');

  // Copy state
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Frequency preset handlers
  const handleFreqPreset = (mhz: number) => {
    setFrequency(mhz);
    setFreqInput(mhz.toString());
  };

  const handleCustomFreq = (valStr: string) => {
    setFreqInput(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 25) {
      setFrequency(parsed);
    }
  };

  // Voltage preset handlers
  const handleVoltagePreset = (v: number) => {
    setVoltage(v);
    setVoltageInput(v.toFixed(1));
  };

  const handleCustomVoltage = (valStr: string) => {
    setVoltageInput(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed >= 1.0 && parsed <= 6.0) {
      setVoltage(parsed);
    }
  };

  // ---------------------------------------------------------------------------
  // Safe Operating Area (SOA) Limits Calculation based on AVR Datasheet Curves
  // ---------------------------------------------------------------------------
  const soaStatus = useMemo(() => {
    let minVoltage = 1.8;
    let maxSafeFreq = 20.0;
    let absoluteMaxFreq = 20.0;

    if (selectedMCU === 'atmega128') {
      minVoltage = 2.7; // ATmega128A minimum operating voltage
      absoluteMaxFreq = 16.0;
      if (voltage < 2.7) {
        maxSafeFreq = 0;
      } else if (voltage >= 4.5) {
        maxSafeFreq = 16.0;
      } else {
        // Linear interpolation between 2.7V (8MHz) and 4.5V (16MHz)
        maxSafeFreq = +(8.0 + ((voltage - 2.7) / (4.5 - 2.7)) * (16.0 - 8.0)).toFixed(1);
      }
    } else if (selectedMCU === 'atmega640' || selectedMCU === 'atmega2560') {
      minVoltage = 1.8;
      absoluteMaxFreq = 16.0;
      if (voltage < 1.8) {
        maxSafeFreq = 0;
      } else if (voltage < 2.7) {
        // 1.8V to 2.7V: 4MHz to 8MHz
        maxSafeFreq = +(4.0 + ((voltage - 1.8) / (2.7 - 1.8)) * 4.0).toFixed(1);
      } else if (voltage >= 4.5) {
        maxSafeFreq = 16.0;
      } else {
        // 2.7V to 4.5V: 8MHz to 16MHz
        maxSafeFreq = +(8.0 + ((voltage - 2.7) / (4.5 - 2.7)) * 8.0).toFixed(1);
      }
    } else {
      // ATmega328P (PicoPower)
      minVoltage = 1.8;
      absoluteMaxFreq = 20.0;
      if (voltage < 1.8) {
        maxSafeFreq = 0;
      } else if (voltage < 2.7) {
        // 1.8V to 2.7V: 4MHz to 10MHz
        maxSafeFreq = +(4.0 + ((voltage - 1.8) / (2.7 - 1.8)) * 6.0).toFixed(1);
      } else if (voltage >= 4.5) {
        maxSafeFreq = 20.0;
      } else {
        // 2.7V to 4.5V: 10MHz to 20MHz
        maxSafeFreq = +(10.0 + ((voltage - 2.7) / (4.5 - 2.7)) * 10.0).toFixed(1);
      }
    }

    const isUndervoltage = voltage < minVoltage;
    const isOverclocked = !isUndervoltage && frequency > maxSafeFreq;
    const isSafe = !isUndervoltage && !isOverclocked;

    let verdictText = '';
    let badgeColor = '';

    if (isUndervoltage) {
      verdictText = `저전압 경고 (최소 요구 전압 ${minVoltage}V 미만). 칩이 리셋(BOD) 상태에 머물거나 불안정합니다.`;
      badgeColor = 'text-rose-400 bg-rose-950/60 border-rose-800/60';
    } else if (isOverclocked) {
      verdictText = `안전 클럭 한계 초과 (현재 전압 ${voltage.toFixed(1)}V에서 최대 안전 주파수는 ${maxSafeFreq}MHz). 플래시 메모리 읽기 오류 및 CPU 충돌 위험!`;
      badgeColor = 'text-amber-400 bg-amber-950/60 border-amber-800/60';
    } else {
      verdictText = `안전 동작 영역 (SOA) 충족. 정격 전압 대비 클럭 주파수가 데이터시트 허용 범위 내에 있습니다.`;
      badgeColor = 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60';
    }

    return {
      minVoltage,
      maxSafeFreq,
      absoluteMaxFreq,
      isUndervoltage,
      isOverclocked,
      isSafe,
      verdictText,
      badgeColor
    };
  }, [selectedMCU, voltage, frequency]);

  // ---------------------------------------------------------------------------
  // Current & Power Consumption Estimates based on Datasheet Characterization
  // ---------------------------------------------------------------------------
  const powerEstimate = useMemo(() => {
    let activeSlope = 0.55; // mA per MHz at 5V
    let idleSlope = 0.18;   // mA per MHz at 5V
    let powerDownBaseUa = 0.1; // µA at 25C

    if (selectedMCU === 'atmega328p') {
      // PicoPower ATmega328P
      // At 5V: ~0.6 mA/MHz, at 3V: ~0.35 mA/MHz, at 1.8V: ~0.2 mA/MHz
      activeSlope = 0.18 + (voltage - 1.8) * ((0.6 - 0.18) / (5.0 - 1.8));
      idleSlope = activeSlope * 0.32;
      powerDownBaseUa = voltage <= 3.3 ? 0.1 : 0.75;
    } else if (selectedMCU === 'atmega640' || selectedMCU === 'atmega2560') {
      // ATmega2560/640 (100-pin Mega)
      // At 5V: ~1.1 mA/MHz, at 3V: ~0.6 mA/MHz, at 1.8V: ~0.35 mA/MHz
      activeSlope = 0.35 + (voltage - 1.8) * ((1.1 - 0.35) / (5.0 - 1.8));
      idleSlope = activeSlope * 0.35;
      powerDownBaseUa = voltage <= 3.3 ? 1.0 : 4.5;
    } else {
      // ATmega128A (Legacy Architecture)
      // At 5V: ~1.25 mA/MHz, at 3V: ~0.75 mA/MHz
      activeSlope = 0.75 + (voltage - 2.7) * ((1.25 - 0.75) / (5.0 - 2.7));
      idleSlope = activeSlope * 0.45;
      powerDownBaseUa = voltage <= 3.3 ? 15.0 : 25.0;
    }

    // Active Current (mA)
    const activeMa = Math.max(0.1, +(activeSlope * frequency).toFixed(2));
    // Idle Current (mA)
    const idleMa = Math.max(0.05, +(idleSlope * frequency).toFixed(2));
    // Power-down Current (µA and mA)
    const powerDownUa = +(powerDownBaseUa).toFixed(2);
    const powerDownMa = powerDownUa / 1000.0;

    // Active Power Consumption (mW): P = V * I
    const activeMw = +(voltage * activeMa).toFixed(2);
    // Idle Power Consumption (mW)
    const idleMw = +(voltage * idleMa).toFixed(2);
    // Power-down Power (µW)
    const powerDownUw = +(voltage * powerDownUa).toFixed(2);

    // Blended Average Current based on Active Duty Cycle %
    const sleepCurrentMa = sleepMode === 'power_down' ? powerDownMa : idleMa;
    const avgCurrentMa = +(
      (activeMa * (activeDutyPct / 100)) +
      (sleepCurrentMa * ((100 - activeDutyPct) / 100))
    ).toFixed(3);
    const avgPowerMw = +(voltage * avgCurrentMa).toFixed(2);

    // Baseline standard: 5.0V @ 16.0MHz Active
    let baselineActiveMa = 0.6 * 16.0;
    if (selectedMCU === 'atmega640' || selectedMCU === 'atmega2560') baselineActiveMa = 1.1 * 16.0;
    if (selectedMCU === 'atmega128') baselineActiveMa = 1.25 * 16.0;
    const baselineMw = +(5.0 * baselineActiveMa).toFixed(1);

    // Power reduction relative to 5V@16MHz baseline
    const powerReductionPct = Math.max(0, +(((baselineMw - activeMw) / baselineMw) * 100).toFixed(1));

    // Battery Life Estimation (Effective usable capacity = 85% to account for self-discharge & cut-off)
    const effectiveBatteryMah = batteryCapacity * 0.85;
    const batteryHours = avgCurrentMa > 0 ? Math.round(effectiveBatteryMah / avgCurrentMa) : 0;
    const batteryDays = +(batteryHours / 24).toFixed(1);
    const batteryMonths = +(batteryDays / 30.4).toFixed(1);

    return {
      activeMa,
      idleMa,
      powerDownUa,
      powerDownMa,
      activeMw,
      idleMw,
      powerDownUw,
      avgCurrentMa,
      avgPowerMw,
      baselineMw,
      powerReductionPct,
      batteryHours,
      batteryDays,
      batteryMonths
    };
  }, [selectedMCU, voltage, frequency, activeDutyPct, sleepMode, batteryCapacity]);

  // C code snippet for sleep & power reduction
  const powerCodeSnippet = useMemo(() => {
    return `// ============================================================================
// ${currentProfile.name} 저전력 슬립 모드 및 전력 관리 C 코드
// - 동작 조건: ${voltage.toFixed(1)}V @ ${frequency.toFixed(2)}MHz
// - Active 전류: 약 ${powerEstimate.activeMa} mA (${powerEstimate.activeMw} mW)
// - ${sleepMode === 'power_down' ? 'Power-down' : 'Idle'} 전류: 약 ${sleepMode === 'power_down' ? `${powerEstimate.powerDownUa} µA` : `${powerEstimate.idleMa} mA`}
// ============================================================================

#include <avr/io.h>
#include <avr/sleep.h>
#include <avr/interrupt.h>

void System_Power_Init(void) {
    // 1. 미사용 주변장치 클럭 차단으로 동적 전력 절감 (PRR 설정)
#if defined(PRR) || defined(PRR0)
    // TWI, SPI, USART, Timer1 클럭 게이팅 차단
    #if defined(PRR)
    PRR |= (1 << PRTWI) | (1 << PRSPI) | (1 << PRADC);
    #elif defined(PRR0)
    PRR0 |= (1 << PRTWI) | (1 << PRSPI) | (1 << PRADC);
    #endif
#endif

    // 2. 아날로그 비교기(ACSR) 비활성화 (~70 µA 절감)
    ACSR |= (1 << ACD);

    // 3. ADC 비활성화 (ADCSRA의 ADEN 비트 클리어, ~200 µA 절감)
    ADCSRA &= ~(1 << ADEN);

    // 4. 슬립 모드 설정 (${sleepMode === 'power_down' ? 'SLEEP_MODE_PWR_DOWN' : 'SLEEP_MODE_IDLE'})
    set_sleep_mode(${sleepMode === 'power_down' ? 'SLEEP_MODE_PWR_DOWN' : 'SLEEP_MODE_IDLE'});
}

void Enter_LowPower_Sleep(void) {
    sleep_enable();
    sei();          // 기동 인터럽트 허용
    sleep_cpu();    // CPU 정지 및 초저전력 모드 진입
    sleep_disable(); // 기동 후 즉시 슬립 비활성화
}
`;
  }, [currentProfile.name, voltage, frequency, powerEstimate, sleepMode]);

  const handleCopySummary = () => {
    const summary = `[${currentProfile.name} MCU 전력 소비 분석 결과]
• 동작 전압 (VCC): ${voltage.toFixed(2)} V
• 클럭 주파수 (F_CPU): ${frequency.toFixed(2)} MHz
• Active 모드 소비 전류: ${powerEstimate.activeMa} mA
• Active 모드 전력 소모량: ${powerEstimate.activeMw} mW
• Idle 모드 소비 전류: ${powerEstimate.idleMa} mA (${powerEstimate.idleMw} mW)
• Power-down 모드 전류: ${powerEstimate.powerDownUa} µA
• 평균 전류 (${activeDutyPct}% Active 기준): ${powerEstimate.avgCurrentMa} mA (${powerEstimate.avgPowerMw} mW)
• SOA 안전 동작 검증: ${soaStatus.isSafe ? '정상 (안전 범위 충족)' : soaStatus.verdictText}
• 예상 배터리 수명 (${batteryCapacity} mAh 기준): 약 ${powerEstimate.batteryDays}일 (${powerEstimate.batteryHours.toLocaleString()}시간)`;

    navigator.clipboard.writeText(summary);
    setCopiedSummary(true);
    confetti({
      particleCount: 30,
      spread: 60,
      origin: { y: 0.8 }
    });
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(powerCodeSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div id="mcu-power-consumption-analyzer-section" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur shadow-2xl space-y-6 scroll-mt-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" /> MCU 전력 소비 분석기
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              F_CPU & VCC Dynamic Current & Power Calculator
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-xs font-mono font-bold">
              {currentProfile.name}
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            MCU 전력 소비 분석기 (MCU Power Consumption Analyzer)
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            클럭 주파수(<strong className="text-amber-300 font-mono">F_CPU</strong>)와 동작 전압(<strong className="text-cyan-300 font-mono">Vcc</strong>)을 입력받아,
            선택된 {currentProfile.name} MCU의 <strong className="text-emerald-300 font-mono">예상 소비 전류(Active/Idle/Sleep mA)</strong>와
            <strong className="text-purple-300 font-mono"> 전력 소모량(mW)</strong>, 그리고 데이터시트 안전 동작 영역(SOA)을 실시간으로 정밀 계산합니다.
          </p>
        </div>

        {/* Quick MCU Switcher */}
        {onSelectMCU && (
          <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 shrink-0">
            {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
              <button
                key={mcuId}
                onClick={() => {
                  onSelectMCU(mcuId);
                  if (mcuId === 'atmega128' && voltage < 2.7) {
                    setVoltage(3.3);
                    setVoltageInput('3.3');
                  }
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                  selectedMCU === mcuId
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {MCU_PROFILES[mcuId].name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPI Cards: 4 Primary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Active Mode Current */}
        <div className="bg-slate-950/90 p-4 sm:p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-1 relative">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-amber-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Active 모드 전류
            </span>
            <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">동작 중</span>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-black text-amber-300">
            {powerEstimate.activeMa} <span className="text-sm font-normal text-slate-400">mA</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            소비 전력: <strong className="text-amber-400">{powerEstimate.activeMw} mW</strong>
          </p>
        </div>

        {/* 2. Idle / Sleep Mode Current */}
        <div className="bg-slate-950/90 p-4 sm:p-5 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 space-y-1 relative">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-cyan-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> {sleepMode === 'power_down' ? 'Power-down 전류' : 'Idle 모드 전류'}
            </span>
            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
              {sleepMode === 'power_down' ? '최대절전' : '클록정지'}
            </span>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-black text-cyan-300">
            {sleepMode === 'power_down' ? (
              <>
                {powerEstimate.powerDownUa} <span className="text-sm font-normal text-slate-400">µA</span>
              </>
            ) : (
              <>
                {powerEstimate.idleMa} <span className="text-sm font-normal text-slate-400">mA</span>
              </>
            )}
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            소비 전력: <strong className="text-cyan-400">{sleepMode === 'power_down' ? `${powerEstimate.powerDownUw} µW` : `${powerEstimate.idleMw} mW`}</strong>
          </p>
        </div>

        {/* 3. Blended Average Power */}
        <div className="bg-slate-950/90 p-4 sm:p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-1 relative">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> 듀티 평균 소비 전력
            </span>
            <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
              {activeDutyPct}% 활성
            </span>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-black text-emerald-300">
            {powerEstimate.avgPowerMw} <span className="text-sm font-normal text-slate-400">mW</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            평균 전류: <strong className="text-emerald-400">{powerEstimate.avgCurrentMa} mA</strong>
          </p>
        </div>

        {/* 4. Estimated Battery Run-Time */}
        <div className="bg-slate-950/90 p-4 sm:p-5 rounded-2xl border border-purple-500/30 bg-purple-500/5 space-y-1 relative">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-purple-400 flex items-center gap-1.5">
              <Battery className="w-3.5 h-3.5" /> 예상 배터리 수명
            </span>
            <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/40">
              {batteryCapacity}mAh
            </span>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-black text-purple-300">
            {powerEstimate.batteryDays >= 365
              ? `${(powerEstimate.batteryDays / 365).toFixed(1)}년`
              : `${powerEstimate.batteryDays}일`}
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            연속 {powerEstimate.batteryHours.toLocaleString()} 시간 구동
          </p>
        </div>
      </div>

      {/* Control Grid: 1. Voltage (Vcc) and 2. Clock Frequency (F_CPU) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (6 cols): Voltage (Vcc) Controller */}
        <div className="lg:col-span-6 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Battery className="w-4 h-4 text-cyan-400" />
              1. 동작 전압 (Operating Voltage: Vcc)
            </label>
            <span className="font-mono font-bold text-cyan-300 text-sm bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
              {voltage.toFixed(2)} V
            </span>
          </div>

          {/* Quick Presets */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {[
              { v: 1.8, label: '1.8V', desc: '배터리 최소', disabled: selectedMCU === 'atmega128' },
              { v: 2.7, label: '2.7V', desc: '저전압 표준', disabled: false },
              { v: 3.3, label: '3.3V', desc: '3.3V 로직', disabled: false },
              { v: 5.0, label: '5.0V', desc: '정격 5V (Uno)', disabled: false }
            ].map((p) => {
              const isSelected = Math.abs(voltage - p.v) < 0.05;
              return (
                <button
                  key={p.v}
                  disabled={p.disabled}
                  onClick={() => handleVoltagePreset(p.v)}
                  className={`p-2 rounded-xl text-left border transition ${
                    p.disabled
                      ? 'opacity-30 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-600'
                      : isSelected
                      ? 'bg-cyan-500/20 text-white border-cyan-500/60 shadow-sm ring-1 ring-cyan-500/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold font-mono text-cyan-300">{p.label}</div>
                  <div className="text-[10px] text-slate-400 truncate">{p.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Slider */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs text-slate-400 font-mono">
              <span>전압 미세 조절:</span>
              <span>{voltage.toFixed(2)} V</span>
            </div>
            <input
              type="range"
              min={selectedMCU === 'atmega128' ? 2.7 : 1.8}
              max={5.5}
              step={0.05}
              value={voltage}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVoltage(v);
                setVoltageInput(v.toFixed(2));
              }}
              className="w-full accent-cyan-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>{selectedMCU === 'atmega128' ? '2.7V (최저)' : '1.8V (최저)'}</span>
              <span>2.7V</span>
              <span>3.3V</span>
              <span>5.0V</span>
              <span>5.5V (최대)</span>
            </div>
          </div>

          {/* Direct Input */}
          <div className="relative pt-1">
            <input
              type="number"
              step="0.05"
              min={selectedMCU === 'atmega128' ? 2.7 : 1.8}
              max={5.5}
              value={voltageInput}
              onChange={(e) => handleCustomVoltage(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              placeholder="예: 3.3"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">Volts (Vcc)</span>
          </div>
        </div>

        {/* Right Column (6 cols): Clock Frequency (F_CPU) Controller */}
        <div className="lg:col-span-6 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              2. 시스템 클럭 주파수 (Clock Frequency: F_CPU)
            </label>
            <span className="font-mono font-bold text-amber-300 text-sm bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
              {frequency.toFixed(2)} MHz
            </span>
          </div>

          {/* Quick Presets */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {[
              { mhz: 1.0, label: '1.0 MHz', desc: '초기 퓨즈 8분주' },
              { mhz: 4.0, label: '4.0 MHz', desc: '1.8V 저전력' },
              { mhz: 8.0, label: '8.0 MHz', desc: '내부 RC 발진' },
              { mhz: 16.0, label: '16.0 MHz', desc: '표준 Uno/Mega' }
            ].map((p) => {
              const isSelected = Math.abs(frequency - p.mhz) < 0.05;
              return (
                <button
                  key={p.mhz}
                  onClick={() => handleFreqPreset(p.mhz)}
                  className={`p-2 rounded-xl text-left border transition ${
                    isSelected
                      ? 'bg-amber-500/20 text-white border-amber-500/60 shadow-sm ring-1 ring-amber-500/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold font-mono text-amber-300">{p.label}</div>
                  <div className="text-[10px] text-slate-400 truncate">{p.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Slider */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs text-slate-400 font-mono">
              <span>주파수 조절:</span>
              <span>{frequency.toFixed(2)} MHz</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={soaStatus.absoluteMaxFreq}
              step={0.1}
              value={frequency}
              onChange={(e) => {
                const f = Number(e.target.value);
                setFrequency(f);
                setFreqInput(f.toFixed(2));
              }}
              className="w-full accent-amber-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0.1 MHz</span>
              <span>4.0 MHz</span>
              <span>8.0 MHz</span>
              <span>16.0 MHz</span>
              <span>{soaStatus.absoluteMaxFreq.toFixed(1)} MHz</span>
            </div>
          </div>

          {/* Direct Input */}
          <div className="relative pt-1">
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="25"
              value={freqInput}
              onChange={(e) => handleCustomFreq(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              placeholder="예: 8.0"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">MHz</span>
          </div>
        </div>
      </div>

      {/* Safe Operating Area (SOA) Alert Banner */}
      <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${soaStatus.badgeColor}`}>
        {soaStatus.isSafe ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        ) : soaStatus.isUndervoltage ? (
          <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm block">
              {soaStatus.isSafe ? '안전 동작 영역 (SOA) 검증 완료' : '전압-클럭 안전 규격 위반 경고'}
            </span>
            <span className="text-[11px] font-mono opacity-80">
              [현재 Vcc: {voltage.toFixed(2)}V, F_CPU: {frequency.toFixed(2)}MHz | 해당 전압 허용 최대: {soaStatus.maxSafeFreq}MHz]
            </span>
          </div>
          <p className="text-[11px] opacity-90 leading-relaxed">
            {soaStatus.verdictText}
          </p>
        </div>
      </div>

      {/* Workload Profile & Battery Calculator Controls */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-400" />
            3. 워크로드 듀티 사이클 & 배터리 용량 파라미터
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSleepMode('power_down')}
              className={`px-2.5 py-1 text-[11px] rounded-lg font-mono transition ${
                sleepMode === 'power_down'
                  ? 'bg-purple-500 text-white font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              Power-down 모드 ({powerEstimate.powerDownUa}µA)
            </button>
            <button
              onClick={() => setSleepMode('idle')}
              className={`px-2.5 py-1 text-[11px] rounded-lg font-mono transition ${
                sleepMode === 'idle'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              Idle 모드 ({powerEstimate.idleMa}mA)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Active Duty Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-400">Active 모드 점유율 (Duty Cycle):</span>
              <span className="text-emerald-400 font-bold">{activeDutyPct}% Active / {100 - activeDutyPct}% Sleep</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={activeDutyPct}
              onChange={(e) => setActiveDutyPct(Number(e.target.value))}
              className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1% (간헐적 주기 센서)</span>
              <span>10% (표준 IoT)</span>
              <span>50% (빈번한 폴링)</span>
              <span>100% (상시 전출력)</span>
            </div>
          </div>

          {/* Battery Presets */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-400">전원 배터리 종류:</span>
              <span className="text-purple-300 font-bold">{batteryCapacity} mAh</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { cap: 220, label: 'CR2032 (220mAh)' },
                { cap: 1000, label: 'AAA x2 (1000mAh)' },
                { cap: 2500, label: 'AA x2 (2500mAh)' },
                { cap: 3000, label: '18650 (3000mAh)' }
              ].map((b) => (
                <button
                  key={b.cap}
                  onClick={() => setBatteryCapacity(b.cap)}
                  className={`p-1.5 rounded-lg text-center border font-mono transition text-[10px] ${
                    batteryCapacity === b.cap
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/60 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Detailed Power Breakdown Table */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            모드별 전류 소모량 & 소모 전력 정밀 내역표 ({currentProfile.name})
          </span>
          <button
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition"
          >
            {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSummary ? '복사됨!' : '분석 결과 복사'}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="py-2 px-3">동작 모드 (Operating Mode)</th>
                <th className="py-2 px-3">인가 전압 (Vcc)</th>
                <th className="py-2 px-3">클럭 (F_CPU)</th>
                <th className="py-2 px-3">예상 소비 전류</th>
                <th className="py-2 px-3">계산된 전력 소모량</th>
                <th className="py-2 px-3">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              <tr className="bg-amber-500/5">
                <td className="py-2.5 px-3 font-bold text-amber-300">Active (CPU + Flash Fetch)</td>
                <td className="py-2.5 px-3">{voltage.toFixed(2)} V</td>
                <td className="py-2.5 px-3">{frequency.toFixed(2)} MHz</td>
                <td className="py-2.5 px-3 font-bold text-amber-400">{powerEstimate.activeMa} mA</td>
                <td className="py-2.5 px-3 font-bold text-amber-300">{powerEstimate.activeMw} mW</td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    전속력 연산
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-cyan-300">Idle (CPU Halted, Peripherals Running)</td>
                <td className="py-2.5 px-3">{voltage.toFixed(2)} V</td>
                <td className="py-2.5 px-3">{frequency.toFixed(2)} MHz</td>
                <td className="py-2.5 px-3 font-bold text-cyan-400">{powerEstimate.idleMa} mA</td>
                <td className="py-2.5 px-3 font-bold text-cyan-300">{powerEstimate.idleMw} mW</td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    대기
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-purple-300">Power-down (Deep Sleep, WDT/EXT INT Only)</td>
                <td className="py-2.5 px-3">{voltage.toFixed(2)} V</td>
                <td className="py-2.5 px-3 text-slate-500">Oscillator Off</td>
                <td className="py-2.5 px-3 font-bold text-purple-400">{powerEstimate.powerDownUa} µA</td>
                <td className="py-2.5 px-3 font-bold text-purple-300">{powerEstimate.powerDownUw} µW</td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    최대 절전
                  </span>
                </td>
              </tr>
              <tr className="bg-emerald-500/5 font-bold">
                <td className="py-2.5 px-3 text-emerald-300">Blended Average ({activeDutyPct}% Active Duty)</td>
                <td className="py-2.5 px-3">{voltage.toFixed(2)} V</td>
                <td className="py-2.5 px-3">혼합 사이클</td>
                <td className="py-2.5 px-3 text-emerald-400">{powerEstimate.avgCurrentMa} mA</td>
                <td className="py-2.5 px-3 text-emerald-300">{powerEstimate.avgPowerMw} mW</td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    실제 종합 소모
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Production-Ready Low Power C Code Generator */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono font-bold text-white">
              C 언어 저전력 슬립 모드 & 전력 차단 레지스터 초기화 루틴 ({currentProfile.name})
            </span>
          </div>
          <button
            onClick={handleCopyCode}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? '복사 완료!' : 'C 소스코드 복사'}</span>
          </button>
        </div>
        <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-64 custom-scrollbar leading-relaxed">
          {powerCodeSnippet}
        </pre>
      </div>
    </div>
  );
};
