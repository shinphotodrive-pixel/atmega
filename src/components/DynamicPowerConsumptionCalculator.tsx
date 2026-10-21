import React, { useState, useMemo } from 'react';
import {
  Zap,
  Gauge,
  Sliders,
  Battery,
  AlertTriangle,
  CheckCircle2,
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
  Table
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export const DynamicPowerConsumptionCalculator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Configurable inputs: Operating Voltage (V) and Clock Frequency (MHz)
  const [voltage, setVoltage] = useState<number>(() => {
    return selectedMCU === 'atmega128' ? 5.0 : 3.3;
  });
  const [frequency, setFrequency] = useState<number>(8.0); // MHz

  // Additional workload duty cycle (% Active vs % Idle)
  const [activeDutyPct, setActiveDutyPct] = useState<number>(20); // 20% active, 80% idle
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Maximum allowed frequency for selected MCU at given voltage based on datasheet SOA curve
  const maxSafeFrequency = useMemo(() => {
    if (selectedMCU === 'atmega128') {
      if (voltage < 2.7) return 0; // Undervoltage for 128A
      if (voltage >= 4.5) return 16.0;
      // Linear interpolation: 2.7V (8MHz) to 4.5V (16MHz)
      return +(8.0 + ((voltage - 2.7) / (4.5 - 2.7)) * (16.0 - 8.0)).toFixed(1);
    } else if (selectedMCU === 'atmega640' || selectedMCU === 'atmega2560') {
      if (voltage < 1.8) return 0;
      if (voltage < 2.7) {
        // 1.8V to 2.7V: 4MHz to 8MHz
        return +(4.0 + ((voltage - 1.8) / (2.7 - 1.8)) * 4.0).toFixed(1);
      }
      if (voltage >= 4.5) return 16.0;
      // 2.7V to 4.5V: 8MHz to 16MHz
      return +(8.0 + ((voltage - 2.7) / (4.5 - 2.7)) * 8.0).toFixed(1);
    } else {
      // ATmega328P (PicoPower)
      if (voltage < 1.8) return 0;
      if (voltage < 2.7) {
        // 1.8V (4MHz) to 2.7V (10MHz)
        return +(4.0 + ((voltage - 1.8) / (2.7 - 1.8)) * 6.0).toFixed(1);
      }
      if (voltage >= 4.5) return 20.0;
      // 2.7V (10MHz) to 4.5V (20MHz)
      return +(10.0 + ((voltage - 2.7) / (4.5 - 2.7)) * 10.0).toFixed(1);
    }
  }, [selectedMCU, voltage]);

  const isVoltageOutOfBounds = useMemo(() => {
    if (selectedMCU === 'atmega128') {
      return voltage < 2.7 || voltage > 5.5;
    }
    return voltage < 1.8 || voltage > 5.5;
  }, [selectedMCU, voltage]);

  const isOverclocked = useMemo(() => {
    return frequency > maxSafeFrequency && !isVoltageOutOfBounds;
  }, [frequency, maxSafeFrequency, isVoltageOutOfBounds]);

  // Current draw estimation based on datasheet typical characterization graphs
  const powerEstimate = useMemo(() => {
    let activeMa = 0;
    let idleMa = 0;

    const v = Math.max(1.8, Math.min(5.5, voltage));
    const f = Math.max(0.1, Math.min(20, frequency));

    if (selectedMCU === 'atmega328p') {
      // ATmega328P PicoPower:
      // Active current: ~0.2mA @ 1.8V/1MHz, ~2.7mA @ 3.3V/8MHz, ~9.2mA @ 5V/16MHz, ~11.5mA @ 5V/20MHz
      // Typical linear slope: I_active ~ (0.088 * V + 0.065) * F + (0.04 * V)
      activeMa = +(((0.085 * v + 0.068) * f * 0.96 + (0.04 * v)).toFixed(2));
      // Idle current: ~0.03mA @ 1.8V/1MHz, ~0.75mA @ 3.3V/8MHz, ~2.75mA @ 5V/16MHz
      idleMa = +(((0.024 * v + 0.028) * f * 0.92 + (0.02 * v)).toFixed(2));
    } else if (selectedMCU === 'atmega128') {
      // ATmega128 / ATmega128A (VCC >= 2.7V)
      // Active current: ~1.1mA @ 2.7V/1MHz, ~6.8mA @ 3.3V/8MHz, ~15.0mA @ 5V/16MHz
      activeMa = +(((0.145 * v + 0.11) * f * 0.88 + (0.18 * v)).toFixed(2));
      // Idle current: ~0.35mA @ 2.7V/1MHz, ~2.7mA @ 3.3V/8MHz, ~7.2mA @ 5V/16MHz
      idleMa = +(((0.068 * v + 0.075) * f * 0.83 + (0.12 * v)).toFixed(2));
    } else {
      // ATmega640:
      // Active current: ~0.45mA @ 1.8V/1MHz, ~4.5mA @ 3.3V/8MHz, ~12.5mA @ 5V/16MHz
      activeMa = +(((0.108 * v + 0.085) * f * 0.92 + (0.08 * v)).toFixed(2));
      // Idle current: ~0.08mA @ 1.8V/1MHz, ~1.3mA @ 3.3V/8MHz, ~4.2mA @ 5V/16MHz
      idleMa = +(((0.038 * v + 0.048) * f * 0.86 + (0.05 * v)).toFixed(2));
    }

    // Power Dissipation (P = V * I in milliwatts)
    const activeMw = +(voltage * activeMa).toFixed(2);
    const idleMw = +(voltage * idleMa).toFixed(2);

    // Weighted Average Current based on Active vs Idle Duty Cycle
    const idleDutyPct = 100 - activeDutyPct;
    const avgCurrentMa = +((activeMa * (activeDutyPct / 100)) + (idleMa * (idleDutyPct / 100))).toFixed(2);
    const avgPowerMw = +(voltage * avgCurrentMa).toFixed(2);

    // Standard 5V @ 16MHz baseline for comparison
    const baselineCurrentMa =
      selectedMCU === 'atmega328p' ? 9.2 : selectedMCU === 'atmega128' ? 15.0 : 12.5;
    const baselineMw = 5.0 * baselineCurrentMa;
    const powerReductionPct = Math.max(0, Math.min(99, Math.round(((baselineMw - activeMw) / baselineMw) * 100)));

    return {
      activeMa,
      idleMa,
      activeMw,
      idleMw,
      avgCurrentMa,
      avgPowerMw,
      idleDutyPct,
      baselineCurrentMa,
      baselineMw,
      powerReductionPct
    };
  }, [selectedMCU, voltage, frequency, activeDutyPct]);

  // Code snippet for clock and power saving setup
  const powerCodeSnippet = useMemo(() => {
    return `// AVR Dynamic Power Reduction Setup (${currentProfile.name})
// Target: ${voltage}V @ ${frequency} MHz (Active ~${powerEstimate.activeMa} mA, Idle ~${powerEstimate.idleMa} mA)
#include <avr/io.h>
#include <avr/power.h>
#include <avr/sleep.h>

void setup_dynamic_power(void) {
    // 1. 시스템 클럭 분주 (동적 주파수 다운스케일링)
    #if defined(CLKPR)
    CLKPR = _BV(CLKPCE); // 클럭 분주 변경 활성화
    CLKPR = ${frequency <= 1.0 ? '_BV(CLKPS2)' : frequency <= 2.0 ? '_BV(CLKPS1) | _BV(CLKPS0)' : frequency <= 8.0 ? '_BV(CLKPS0)' : '0x00'}; // ${frequency} MHz 설정
    #endif

    // 2. Idle 슬립 모드 구성 (주기적 타이머/UART 수신 대기 시 ~${powerEstimate.idleMa} mA)
    set_sleep_mode(SLEEP_MODE_IDLE);
}

void enter_idle_sleep(void) {
    sleep_mode(); // CPU 정지, 주변장치는 계속 동작하며 ~${powerEstimate.idleMw} mW 소모
}`;
  }, [currentProfile.name, voltage, frequency, powerEstimate]);

  const copyCode = () => {
    navigator.clipboard.writeText(powerCodeSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
            <Zap className="w-3.5 h-3.5" /> Datasheet-Characterized Power Engine
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            동적 소비 전력 계산기 (Dynamic Power Consumption Calculator)
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
              {currentProfile.name}
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            동작 주파수(MHz)와 목표 전원 전압(V)을 입력하여 제조사 데이터시트 정격 곡선을 기반으로
            <strong> Active(동작 모드)</strong> 및 <strong>Idle(대기 모드)</strong>의 전형적인 전류 소모량(mA)과 소모 전력(mW)을 실시간 산출합니다.
          </p>
        </div>

        {/* MCU Selector Switcher */}
        {onSelectMCU && (
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0">
            {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcu) => (
              <button
                key={mcu}
                onClick={() => {
                  onSelectMCU(mcu);
                  if (mcu === 'atmega128' && voltage < 2.7) setVoltage(3.3);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedMCU === mcu
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {mcu === 'atmega2560' ? 'ATmega2560' : mcu === 'atmega328p' ? 'ATmega328P' : mcu === 'atmega128' ? 'ATmega128' : 'ATmega640'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Primary KPI Results Grid: Active vs Idle Current Draw (mA) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Current (mA) */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-1 relative">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-amber-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Active 모드 전류
            </span>
            <span className="text-[10px] font-mono text-amber-300">동작 중</span>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-black text-amber-300">
            {powerEstimate.activeMa} <span className="text-sm font-normal text-slate-400">mA</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            소비 전력: <strong className="text-amber-400">{powerEstimate.activeMw} mW</strong>
          </p>
        </div>

        {/* Idle Current (mA) */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 space-y-1 relative">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-cyan-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Idle 모드 전류
            </span>
            <span className="text-[10px] font-mono text-cyan-300">클럭 정지</span>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-black text-cyan-300">
            {powerEstimate.idleMa} <span className="text-sm font-normal text-slate-400">mA</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            소비 전력: <strong className="text-cyan-400">{powerEstimate.idleMw} mW</strong>
          </p>
        </div>

        {/* Average Blended Current */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1 relative">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> 듀티 평균 전류 (Avg)
            </span>
            <span className="text-[10px] font-mono text-emerald-300">{activeDutyPct}% Active</span>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-black text-emerald-300">
            {powerEstimate.avgCurrentMa} <span className="text-sm font-normal text-slate-400">mA</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            평균 소모 전력: <strong className="text-emerald-400">{powerEstimate.avgPowerMw} mW</strong>
          </p>
        </div>

        {/* Power Reduction relative to 5V@16MHz */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-1 relative">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-purple-400 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" /> 5V@16MHz 대비 절감
            </span>
            <span className="text-[10px] font-mono text-slate-500">에너지 효율</span>
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-black text-purple-300">
            -{powerEstimate.powerReductionPct}%
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            기준 {powerEstimate.baselineMw}mW $\rightarrow$ {powerEstimate.activeMw}mW
          </p>
        </div>
      </div>

      {/* Interactive Sliders & Presets: Voltage & Frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Voltage (VCC) Controller */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Battery className="w-4 h-4 text-cyan-400" />
              1. 동작 전압 (Operating Voltage VCC):
            </label>
            <span className="font-mono font-bold text-cyan-300 text-sm">
              {voltage.toFixed(1)} V
            </span>
          </div>

          <div className="space-y-2">
            <input
              type="range"
              min={selectedMCU === 'atmega128' ? 2.7 : 1.8}
              max={5.5}
              step={0.1}
              value={voltage}
              onChange={(e) => setVoltage(Number(e.target.value))}
              className="w-full accent-cyan-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>{selectedMCU === 'atmega128' ? '2.7V (최저)' : '1.8V (최저)'}</span>
              <span>2.7V</span>
              <span>3.3V (표준)</span>
              <span>5.0V (정격)</span>
              <span>5.5V</span>
            </div>
          </div>

          {/* Voltage Preset Buttons */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            {[
              { v: 1.8, label: '1.8V (배터리)', disabled: selectedMCU === 'atmega128' },
              { v: 2.7, label: '2.7V (저전압)', disabled: false },
              { v: 3.3, label: '3.3V (표준)', disabled: false },
              { v: 5.0, label: '5.0V (산업용)', disabled: false }
            ].map((p) => (
              <button
                key={p.v}
                disabled={p.disabled}
                onClick={() => setVoltage(p.v)}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${
                  voltage === p.v
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-sm'
                    : p.disabled
                    ? 'bg-slate-900/30 text-slate-600 border-slate-900 cursor-not-allowed'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {isVoltageOutOfBounds && (
            <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                <strong>전압 규격 위반:</strong> {currentProfile.name}의 정격 구동 전압은 {currentProfile.operatingVoltage}입니다.
              </span>
            </div>
          )}
        </div>

        {/* Frequency (F_CPU) Controller */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              2. 시스템 클럭 주파수 (Clock Frequency):
            </label>
            <span className="font-mono font-bold text-amber-300 text-sm">
              {frequency.toFixed(1)} MHz
            </span>
          </div>

          <div className="space-y-2">
            <input
              type="range"
              min={0.1}
              max={selectedMCU === 'atmega328p' ? 20.0 : 16.0}
              step={0.1}
              value={frequency}
              onChange={(e) => setFrequency(Number(e.target.value))}
              className="w-full accent-amber-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0.1 MHz</span>
              <span>4.0 MHz</span>
              <span>8.0 MHz (내장RC)</span>
              <span>16.0 MHz</span>
              {selectedMCU === 'atmega328p' && <span>20.0 MHz</span>}
            </div>
          </div>

          {/* Frequency Preset Buttons */}
          <div className="grid grid-cols-5 gap-1.5 pt-1">
            {[1.0, 4.0, 8.0, 16.0, 20.0].map((f) => {
              const isOver = f > (selectedMCU === 'atmega328p' ? 20 : 16);
              if (isOver) return null;
              return (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${
                    frequency === f
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {f} MHz
                </button>
              );
            })}
          </div>

          {/* Safe Operating Area (SOA) Validation Indicator */}
          <div
            className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
              isOverclocked
                ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {isOverclocked ? (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
              <span>
                {voltage}V 기준 안전 한계 클럭: <strong>최대 {maxSafeFrequency} MHz</strong>
              </span>
            </div>
            <span className="font-mono font-bold text-[11px]">
              {isOverclocked ? '오버클럭 위험 (비정상 동작 가능)' : '안전 동작 영역 (SOA 준수)'}
            </span>
          </div>
        </div>
      </div>

      {/* Duty Cycle Mixer & Datasheet Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active vs Idle Duty Cycle Slider */}
        <div className="lg:col-span-5 bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              3. 워크로드 듀티 사이클 (Active vs Idle)
            </span>
            <span className="text-xs font-mono font-bold text-emerald-300">
              {activeDutyPct}% / {powerEstimate.idleDutyPct}%
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            MCU가 연산을 수행하는 Active 구간과 저전력 대기 상태인 Idle 구간의 시간 비율을 조정하여 현실적인 평균 소비 전력을 계산합니다.
          </p>

          <div className="space-y-2">
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
              <span>1% (극초절전 센서)</span>
              <span>20% (일반 제어)</span>
              <span>50%</span>
              <span>100% (연속 연산)</span>
            </div>
          </div>

          {/* Quick Duty Presets */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { pct: 5, label: '5% (비동기 센서)' },
              { pct: 20, label: '20% (제어 노드)' },
              { pct: 100, label: '100% (풀가동)' }
            ].map((d) => (
              <button
                key={d.pct}
                onClick={() => setActiveDutyPct(d.pct)}
                className={`p-2 rounded-lg text-xs font-medium border ${
                  activeDutyPct === d.pct
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Datasheet Reference Typical Table for Selected MCU */}
        <div className="lg:col-span-7 bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Table className="w-4 h-4 text-purple-400" />
              데이터시트 정격 소비전류 비교표 ({currentProfile.name})
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Typ. @ 25°C</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">인가 전압 (VCC)</th>
                  <th className="py-2 px-3">클럭 속도</th>
                  <th className="py-2 px-3 text-center">Active 정격 전류</th>
                  <th className="py-2 px-3 text-center">Idle 정격 전류</th>
                  <th className="py-2 px-3 text-right">상태 판정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {selectedMCU === 'atmega328p' ? (
                  <>
                    <tr className="hover:bg-slate-900/60">
                      <td className="py-2 px-3 text-cyan-300 font-bold">1.8V</td>
                      <td className="py-2 px-3">1 MHz</td>
                      <td className="py-2 px-3 text-center font-bold text-amber-300">~0.20 mA</td>
                      <td className="py-2 px-3 text-center font-bold text-cyan-300">~0.03 mA</td>
                      <td className="py-2 px-3 text-right text-emerald-400 text-[11px]">초저전력 (PicoPower)</td>
                    </tr>
                    <tr className="hover:bg-slate-900/60">
                      <td className="py-2 px-3 text-cyan-300 font-bold">3.3V</td>
                      <td className="py-2 px-3">8 MHz</td>
                      <td className="py-2 px-3 text-center font-bold text-amber-300">~2.70 mA</td>
                      <td className="py-2 px-3 text-center font-bold text-cyan-300">~0.75 mA</td>
                      <td className="py-2 px-3 text-right text-emerald-400 text-[11px]">리튬 배터리 권장</td>
                    </tr>
                    <tr className="hover:bg-slate-900/60">
                      <td className="py-2 px-3 text-cyan-300 font-bold">5.0V</td>
                      <td className="py-2 px-3">16 MHz</td>
                      <td className="py-2 px-3 text-center font-bold text-amber-300">~9.20 mA</td>
                      <td className="py-2 px-3 text-center font-bold text-cyan-300">~2.75 mA</td>
                      <td className="py-2 px-3 text-right text-amber-400 text-[11px]">아두이노 Uno 표준</td>
                    </tr>
                    <tr className="hover:bg-slate-900/60">
                      <td className="py-2 px-3 text-cyan-300 font-bold">5.0V</td>
                      <td className="py-2 px-3">20 MHz</td>
                      <td className="py-2 px-3 text-center font-bold text-amber-300">~11.50 mA</td>
                      <td className="py-2 px-3 text-center font-bold text-cyan-300">~3.40 mA</td>
                      <td className="py-2 px-3 text-right text-purple-400 text-[11px]">최대 정격 속도</td>
                    </tr>
                  </>
                ) : selectedMCU === 'atmega128' ? (
                  <>
                    <tr className="hover:bg-slate-900/60">
                      <td className="py-2 px-3 text-cyan-300 font-bold">2.7V</td>
                      <td className="py-2 px-3">1 MHz</td>
                      <td className="py-2 px-3 text-center font-bold text-amber-300">~1.10 mA</td>
                      <td className="py-2 px-3 text-center font-bold text-cyan-300">~0.35 mA</td>
                      <td className="py-2 px-3 text-right text-emerald-400 text-[11px]">128A 최저 전압</td>
                    </tr>
                    <tr className="hover:bg-slate-900/60">
                      <td className="py-2 px-3 text-cyan-300 font-bold">3.3V</td>
                      <td className="py-2 px-3">8 MHz</td>
                      <td className="py-2 px-3 text-center font-bold text-amber-300">~6.80 mA</td>
                      <td className="py-2 px-3 text-center font-bold text-cyan-300">~2.70 mA</td>
                      <td className="py-2 px-3 text-right text-emerald-400 text-[11px]">3.3V 안전 상한선</td>
                    </tr>
                    <tr className="hover:bg-slate-900/60">
                      <td className="py-2 px-3 text-cyan-300 font-bold">5.0V</td>
                      <td className="py-2 px-3">16 MHz</td>
                      <td className="py-2 px-3 text-center font-bold text-amber-300">~15.00 mA</td>
                      <td className="py-2 px-3 text-center font-bold text-cyan-300">~7.20 mA</td>
                      <td className="py-2 px-3 text-right text-amber-400 text-[11px]">산업용 정격 클럭</td>
                    </tr>
                  </>
                ) : (
                  <>
                    <tr className="hover:bg-slate-900/60">
                      <td className="py-2 px-3 text-cyan-300 font-bold">1.8V</td>
                      <td className="py-2 px-3">1 MHz</td>
                      <td className="py-2 px-3 text-center font-bold text-amber-300">~0.45 mA</td>
                      <td className="py-2 px-3 text-center font-bold text-cyan-300">~0.08 mA</td>
                      <td className="py-2 px-3 text-right text-emerald-400 text-[11px]">1.8V 저전력</td>
                    </tr>
                    <tr className="hover:bg-slate-900/60">
                      <td className="py-2 px-3 text-cyan-300 font-bold">3.3V</td>
                      <td className="py-2 px-3">8 MHz</td>
                      <td className="py-2 px-3 text-center font-bold text-amber-300">~4.50 mA</td>
                      <td className="py-2 px-3 text-center font-bold text-cyan-300">~1.30 mA</td>
                      <td className="py-2 px-3 text-right text-emerald-400 text-[11px]">3.3V 센서 허브</td>
                    </tr>
                    <tr className="hover:bg-slate-900/60">
                      <td className="py-2 px-3 text-cyan-300 font-bold">5.0V</td>
                      <td className="py-2 px-3">16 MHz</td>
                      <td className="py-2 px-3 text-center font-bold text-amber-300">~12.50 mA</td>
                      <td className="py-2 px-3 text-center font-bold text-cyan-300">~4.20 mA</td>
                      <td className="py-2 px-3 text-right text-amber-400 text-[11px]">100핀 풀 퍼포먼스</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* C Code Generator for Dynamic Clock Scaling & Sleep */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-2 font-mono">
            <Zap className="w-4 h-4 text-amber-400" />
            저전력 동적 클럭 분주 및 Idle 슬립 C 코드 ({frequency}MHz / {voltage}V)
          </span>
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs transition"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedCode ? '복사됨' : 'C 코드 복사'}
          </button>
        </div>

        <pre className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
          {powerCodeSnippet}
        </pre>
      </div>
    </div>
  );
};
