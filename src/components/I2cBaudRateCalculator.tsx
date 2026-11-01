import React, { useState, useMemo } from 'react';
import {
  Clock,
  Radio,
  Sliders,
  Copy,
  Check,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Info,
  ShieldCheck,
  ShieldAlert,
  Gauge,
  Activity,
  Layers,
  ArrowRight,
  TrendingUp,
  RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
}

export type I2cSpeedMode = 'standard' | 'fast' | 'fast_plus' | 'high_speed' | 'custom';

interface ModeDefinition {
  id: I2cSpeedMode;
  name: string;
  nominalKhz: number;
  badge: string;
  desc: string;
  maxRiseTimeNs: number;
  maxFallTimeNs: number;
}

export const I2C_MODES: ModeDefinition[] = [
  {
    id: 'standard',
    name: 'Standard-mode (Sm)',
    nominalKhz: 100,
    badge: '100 kHz',
    desc: '표준 저속 I2C 모드. 거의 모든 I2C 센서 및 EEPROM의 기본 동작 주파수입니다.',
    maxRiseTimeNs: 1000,
    maxFallTimeNs: 300
  },
  {
    id: 'fast',
    name: 'Fast-mode (Fm)',
    nominalKhz: 400,
    badge: '400 kHz',
    desc: '고속 I2C 모드. IMU, OLED 디스플레이, 고성능 센서 통신에 표준으로 채택됩니다.',
    maxRiseTimeNs: 300,
    maxFallTimeNs: 300
  },
  {
    id: 'fast_plus',
    name: 'Fast-mode Plus (Fm+)',
    nominalKhz: 1000,
    badge: '1,000 kHz (1 MHz)',
    desc: '초고속 1MHz 모드. 풀업 저항을 1kΩ 이하로 낮추고 짧은 배선에서 동작합니다.',
    maxRiseTimeNs: 120,
    maxFallTimeNs: 120
  },
  {
    id: 'high_speed',
    name: 'High-speed mode (Hs-mode)',
    nominalKhz: 3400,
    badge: '3,400 kHz (3.4 MHz)',
    desc: 'NXP I2C 3.4MHz 고속 규격. 8비트 AVR 하드웨어 한계 및 호환성을 정밀 진단합니다.',
    maxRiseTimeNs: 80,
    maxFallTimeNs: 80
  }
];

export const I2cBaudRateCalculator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // User Parameters
  const [selectedMode, setSelectedMode] = useState<I2cSpeedMode>('standard');
  const [targetKhz, setTargetKhz] = useState<number>(100);
  const [cpuFreqMhz, setCpuFreqMhz] = useState<number>(16);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Sync mode click
  const handleSelectMode = (mode: I2cSpeedMode) => {
    setSelectedMode(mode);
    const def = I2C_MODES.find((m) => m.id === mode);
    if (def) {
      setTargetKhz(def.nominalKhz);
    }
  };

  // Prescalers for AVR TWI: 4^TWPS where TWPS in {0, 1, 2, 3} -> {1, 4, 16, 64}
  const PRESCALER_OPTIONS = [
    { prescaler: 1, twps: 0, twpsBits: '0b00' },
    { prescaler: 4, twps: 1, twpsBits: '0b01' },
    { prescaler: 16, twps: 2, twpsBits: '0b10' },
    { prescaler: 64, twps: 3, twpsBits: '0b11' }
  ];

  // Hardware Theoretical Max TWI Frequency:
  // f_SCL = f_CPU / (16 + 2 * TWBR * Prescaler)
  // Max SCL occurs when TWBR = 0 and Prescaler = 1: f_max = f_CPU / 16
  const maxHardwareSclKhz = useMemo(() => {
    return (cpuFreqMhz * 1000) / 16;
  }, [cpuFreqMhz]);

  // Prescaler comparison matrix
  interface PrescalerRow {
    prescaler: number;
    twps: number;
    twpsBits: string;
    rawTwbr: number;
    actualTwbr: number;
    actualKhz: number;
    errorHz: number;
    errorPercent: number;
    status: 'OPTIMAL' | 'VALID' | 'TWBR_LOW' | 'OVERFLOW' | 'HW_LIMIT';
  }

  const comparisonRows = useMemo<PrescalerRow[]>(() => {
    const fcpuHz = cpuFreqMhz * 1_000_000;
    const targetHz = targetKhz * 1000;

    const rows: PrescalerRow[] = PRESCALER_OPTIONS.map((opt) => {
      // TWBR formula: TWBR = ((f_CPU / f_SCL) - 16) / (2 * Prescaler)
      const rawTwbr = (fcpuHz / targetHz - 16) / (2 * opt.prescaler);
      const clampedTwbr = Math.round(rawTwbr);
      const actualTwbr = Math.max(0, Math.min(255, clampedTwbr));

      // Recomputed SCL:
      const actualHz = fcpuHz / (16 + 2 * actualTwbr * opt.prescaler);
      const actualKhz = +(actualHz / 1000).toFixed(2);
      const errorHz = Math.abs(actualHz - targetHz);
      const errorPercent = +((errorHz / targetHz) * 100).toFixed(2);

      let status: 'OPTIMAL' | 'VALID' | 'TWBR_LOW' | 'OVERFLOW' | 'HW_LIMIT' = 'VALID';

      if (targetKhz > maxHardwareSclKhz) {
        status = 'HW_LIMIT';
      } else if (rawTwbr > 255) {
        status = 'OVERFLOW';
      } else if (actualTwbr < 10) {
        // Atmel datasheet 22.5.2 warning: "TWBR should be 10 or higher if Master mode"
        status = 'TWBR_LOW';
      } else {
        status = 'VALID';
      }

      return {
        prescaler: opt.prescaler,
        twps: opt.twps,
        twpsBits: opt.twpsBits,
        rawTwbr: +rawTwbr.toFixed(2),
        actualTwbr,
        actualKhz,
        errorHz: Math.round(errorHz),
        errorPercent,
        status
      };
    });

    // Determine the optimal row among valid ones (preferring TWBR >= 10 and min error)
    const validRows = rows.filter((r) => r.status === 'VALID' || r.status === 'TWBR_LOW');
    if (validRows.length > 0) {
      // Prioritize VALID (TWBR >= 10) first, then lowest error
      validRows.sort((a, b) => {
        if (a.status === 'VALID' && b.status !== 'VALID') return -1;
        if (b.status === 'VALID' && a.status !== 'VALID') return 1;
        return a.errorPercent - b.errorPercent;
      });
      validRows[0].status = 'OPTIMAL';
    }

    return rows;
  }, [cpuFreqMhz, targetKhz, maxHardwareSclKhz]);

  // Selected / Best Row
  const bestRow = useMemo(() => {
    return comparisonRows.find((r) => r.status === 'OPTIMAL') || comparisonRows[0];
  }, [comparisonRows]);

  // SCL Timing decomposition in nanoseconds
  const timingBreakdown = useMemo(() => {
    const periodNs = Math.round((1000 / bestRow.actualKhz) * 1000);
    const halfPeriodNs = Math.round(periodNs / 2);

    return {
      periodNs,
      periodUs: +(periodNs / 1000).toFixed(3),
      tLowNs: halfPeriodNs,
      tHighNs: halfPeriodNs
    };
  }, [bestRow]);

  // Generated C Initialization Snippet
  const generatedCode = useMemo(() => {
    return `// =========================================================================
// AVR TWI (I2C) 고신뢰성 보레이트 초기화 코드
// Target MCU     : ${currentProfile.name} @ ${cpuFreqMhz} MHz
// 목표 비트레이트 : ${targetKhz} kHz (${selectedMode.toUpperCase()} Mode)
// 실제 달성 속도 : ${bestRow.actualKhz} kHz (오차: ${bestRow.errorPercent}%)
// =========================================================================
#include <avr/io.h>

void i2c_master_init(void) {
    // 1. TWI 비트 전송률 레지스터 (TWBR) 설정
    // 계산 공식: TWBR = ((F_CPU / F_SCL) - 16) / (2 * Prescaler)
    TWBR = ${bestRow.actualTwbr}; // 0x${bestRow.actualTwbr.toString(16).toUpperCase()}

    // 2. TWI 상태 레지스터 (TWSR) 프리스케일러: ${bestRow.prescaler}배 (${bestRow.twpsBits})
    TWSR = (TWSR & ~0x03) | ${bestRow.twps}; // TWPS1:0 = ${bestRow.twps}

    // 3. TWI 하드웨어 활성화 (TWEN=1, TWEA=1 ACK 인에이블)
    TWCR = (1 << TWEN) | (1 << TWEA);

    /* 💡 하드웨어 팁:
     * - SCL 클럭 주기: ${timingBreakdown.periodUs} µs (${timingBreakdown.periodNs} ns)
     * - 권장 풀업 저항: 2.2kΩ ~ 4.7kΩ (100k/400kHz 기준)
     * - TWBR 설정값(${bestRow.actualTwbr})이 10 이상이어야 슬레이브 클럭 스트레칭 노이즈를 완벽 방어합니다.
     */
}
`;
  }, [currentProfile, cpuFreqMhz, targetKhz, selectedMode, bestRow, timingBreakdown]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.85 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div id="i2c-baud-rate-calculator-section" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur-xl shadow-2xl space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-500/10">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                I2C / TWI 보레이트 계산기 (Baud Rate Calculator)
              </h3>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold">
                TWBR & TWSR Engine
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                {currentProfile.name}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              AVR 시스템 클럭 주파수(f_CPU)와 목표 I2C 비트 전송률에 따른 <strong>TWBR (TWI Bit Rate Register)</strong> 및 <strong>프리스케일러(4^TWPS)</strong>를 정확히 산출하고, <strong>Standard (100k)</strong>, <strong>Fast (400k)</strong>, <strong>Fast Plus (1M)</strong>, <strong>High-speed (3.4M)</strong> 모드 호환성을 실시간 검증합니다.
            </p>
          </div>
        </div>

        {/* CPU Clock Frequency Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400 font-mono">시스템 클럭:</span>
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            {[8, 12, 16, 20].map((f) => (
              <button
                key={f}
                onClick={() => setCpuFreqMhz(f)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  cpuFreqMhz === f
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f}MHz
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Speed Mode Selector Pills */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
          <span>표준 I2C 통신 모드 선택 (I2C / TWI Speed Modes):</span>
          <span className="text-[11px] font-mono text-cyan-400">
            하드웨어 최대 한계: {maxHardwareSclKhz.toLocaleString()} kHz (@ {cpuFreqMhz}MHz)
          </span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {I2C_MODES.map((mode) => {
            const isSelected = selectedMode === mode.id;
            const isExceeded = mode.nominalKhz > maxHardwareSclKhz;

            return (
              <button
                key={mode.id}
                onClick={() => handleSelectMode(mode.id)}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-xl shadow-cyan-500/20 ring-2 ring-cyan-400/50'
                    : isExceeded
                    ? 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-mono font-black text-sm ${isSelected ? 'text-slate-950' : 'text-white'}`}>
                      {mode.badge}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-slate-950/20 text-slate-950' : isExceeded ? 'bg-amber-950 text-amber-300' : 'bg-slate-900 text-cyan-400'
                    }`}>
                      {isExceeded ? 'HW 한계 초과' : '호환'}
                    </span>
                  </div>
                  <div className={`text-xs font-semibold leading-tight ${isSelected ? 'text-slate-900' : 'text-slate-200'}`}>
                    {mode.name}
                  </div>
                </div>

                <div className={`mt-2.5 pt-2 text-[10px] border-t leading-relaxed ${
                  isSelected ? 'border-slate-900/20 text-slate-900' : 'border-slate-800/80 text-slate-400'
                }`}>
                  {mode.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Bit Rate Sliders & Inputs */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              목표 TWI 비트레이트 미세 조정
            </h4>
          </div>

          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-slate-400 text-xs">목표 클럭:</span>
            <input
              type="number"
              min={10}
              max={3400}
              step={10}
              value={targetKhz}
              onChange={(e) => {
                setTargetKhz(Math.max(10, Math.min(3400, parseInt(e.target.value) || 10)));
                setSelectedMode('custom');
              }}
              className="w-24 px-2 py-1 rounded-xl bg-slate-900 border border-slate-700 text-right text-cyan-400 font-bold text-sm"
            />
            <span className="text-cyan-400 font-bold text-xs">kHz</span>
          </div>
        </div>

        <input
          type="range"
          min={10}
          max={1200}
          step={10}
          value={Math.min(1200, targetKhz)}
          onChange={(e) => {
            setTargetKhz(parseInt(e.target.value));
            setSelectedMode('custom');
          }}
          className="w-full accent-cyan-500 cursor-pointer"
        />

        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>10 kHz (초저속 센서)</span>
          <span>100 kHz (Standard)</span>
          <span>400 kHz (Fast)</span>
          <span>1,000 kHz (Fm+)</span>
          <span>1,200 kHz (AVR 한계)</span>
        </div>
      </div>

      {/* Realized Metrics KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: TWBR Register Value */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4.5 relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Zap className="w-3.5 h-3.5 text-cyan-400" /> TWBR 레지스터
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300">
              8-bit (0~255)
            </span>
          </div>
          <div className="text-3xl font-black text-cyan-400 font-mono tracking-tight mt-1">
            {bestRow.actualTwbr} <span className="text-sm font-normal text-slate-400">(0x{bestRow.actualTwbr.toString(16).toUpperCase()})</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {bestRow.actualTwbr < 10
              ? '⚠️ TWBR < 10 (노이즈 방어 주의)'
              : '안전 동작 마진 충족 (TWBR ≥ 10)'}
          </p>
        </div>

        {/* KPI 2: Actual Realized Bit Rate */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4.5 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Activity className="w-3.5 h-3.5 text-emerald-400" /> 실제 달성 비트레이트
            </span>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
              bestRow.errorPercent === 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
            }`}>
              오차 {bestRow.errorPercent}%
            </span>
          </div>
          <div className="text-3xl font-black text-emerald-400 font-mono tracking-tight mt-1">
            {bestRow.actualKhz} <span className="text-sm font-normal text-slate-400">kHz</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            목표 대비: {bestRow.errorHz > 0 ? `±${bestRow.errorHz} Hz` : '완벽 일치 (0 Hz)'}
          </p>
        </div>

        {/* KPI 3: Prescaler Bits (TWPS in TWSR) */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4.5 relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> TWSR 프리스케일러
            </span>
            <span className="text-[10px] font-mono text-amber-400 font-bold">
              4^{bestRow.twps}
            </span>
          </div>
          <div className="text-3xl font-black text-amber-400 font-mono tracking-tight mt-1">
            /{bestRow.prescaler} <span className="text-sm font-normal text-slate-400">({bestRow.twpsBits})</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            TWPS1:0 = {bestRow.twps} (TWSR[1:0])
          </p>
        </div>

        {/* KPI 4: SCL Period & Duty Cycle */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4.5 relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Gauge className="w-3.5 h-3.5 text-purple-400" /> SCL 클럭 주기 (Period)
            </span>
            <span className="text-[10px] font-mono text-purple-300">
              50% Duty
            </span>
          </div>
          <div className="text-3xl font-black text-purple-400 font-mono tracking-tight mt-1">
            {timingBreakdown.periodUs} <span className="text-sm font-normal text-slate-400">µs</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            tLOW = tHIGH ≈ {timingBreakdown.tLowNs} ns
          </p>
        </div>
      </div>

      {/* High-speed Mode Hardware Advisory Diagnostic Banner */}
      {targetKhz > maxHardwareSclKhz && (
        <div className="p-4.5 rounded-2xl bg-amber-950/50 border border-amber-500 shadow-xl shadow-amber-950/20 text-xs text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-300">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>하드웨어 아키텍처 한계 알림: High-speed 모드 (3.4 MHz) 제약</span>
          </div>
          <p className="leading-relaxed text-slate-300 text-[11px]">
            AVR 8비트 RISC의 하드웨어 TWI 모듈은 <strong className="text-amber-300 font-mono">f_SCL = f_CPU / (16 + 2 * TWBR * Prescaler)</strong> 구조로 설계되어 있어, <strong className="text-amber-300 font-mono">TWBR = 0</strong>일 때의 이론상 최대 속도는 <strong className="text-amber-300 font-mono">f_CPU / 16</strong>입니다.
            현재 시스템 클럭({cpuFreqMhz} MHz) 기준 TWI 최대 클럭은 <strong className="text-amber-300">{maxHardwareSclKhz.toLocaleString()} kHz</strong>이며, 3.4 MHz High-speed 모드는 전용 외장 I2C 가속 브리지(예: NXP PCA9617A 등) 또는 SPI/고속 전용 인터페이스를 병용해야 합니다.
          </p>
        </div>
      )}

      {/* Prescaler Matrix Comparison Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              프리스케일러별 TWBR 산출 및 오차율 비교 분석표
            </h4>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            공식: TWBR = ((f_CPU / f_SCL) - 16) / (2 * Prescaler)
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">프리스케일러 (4^TWPS)</th>
                <th className="py-2.5 px-3">TWPS 비트 (TWSR)</th>
                <th className="py-2.5 px-3">계산된 TWBR 값</th>
                <th className="py-2.5 px-3">실제 달성 속도</th>
                <th className="py-2.5 px-3">속도 오차</th>
                <th className="py-2.5 px-3">하드웨어 상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono">
              {comparisonRows.map((row) => {
                const isOptimal = row.status === 'OPTIMAL';
                const isOverflow = row.status === 'OVERFLOW';
                const isTwbrLow = row.status === 'TWBR_LOW';
                const isHwLimit = row.status === 'HW_LIMIT';

                return (
                  <tr
                    key={row.prescaler}
                    className={`transition-all ${
                      isOptimal
                        ? 'bg-cyan-500/15 border-l-4 border-cyan-400 text-white font-bold'
                        : isHwLimit || isOverflow
                        ? 'opacity-40 bg-slate-950/40 text-slate-500'
                        : 'hover:bg-slate-900/50 text-slate-300'
                    }`}
                  >
                    <td className="py-3 px-3 font-bold flex items-center gap-1.5">
                      <span>/{row.prescaler}</span>
                      {isOptimal && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-bold bg-cyan-500 text-slate-950">
                          OPTIMAL
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-amber-400">
                      {row.twpsBits} ({row.twps})
                    </td>
                    <td className="py-3 px-3">
                      {isHwLimit ? (
                        <span className="text-rose-400 font-sans">클럭 초과 (HW 한계)</span>
                      ) : isOverflow ? (
                        <span className="text-rose-400 font-sans">오버플로우 ({row.rawTwbr} &gt; 255)</span>
                      ) : (
                        <span className="font-bold text-cyan-300">
                          {row.actualTwbr} <span className="text-slate-500 font-normal">(0x{row.actualTwbr.toString(16).toUpperCase()})</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-emerald-400 font-bold">
                      {row.actualKhz} kHz
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        row.errorPercent === 0
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : row.errorPercent < 1.0
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {row.errorPercent}%
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {isOptimal ? (
                        <span className="text-emerald-400 text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 최적 채택값
                        </span>
                      ) : isTwbrLow ? (
                        <span className="text-amber-400 text-[11px] flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> TWBR &lt; 10 권장치 이하
                        </span>
                      ) : isOverflow ? (
                        <span className="text-rose-400 text-[11px]">8비트 레지스터 초과</span>
                      ) : isHwLimit ? (
                        <span className="text-rose-400 text-[11px]">하드웨어 한계</span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">유효 분주비</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generated C Code & Copy Section */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              생성된 AVR TWI (I2C) 마스터 초기화 C 코드
            </h4>
          </div>
          <button
            onClick={handleCopy}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-cyan-500/20 shrink-0 font-sans"
          >
            {copiedCode ? <Check className="w-4 h-4 text-slate-950" /> : <Copy className="w-4 h-4" />}
            <span>{copiedCode ? '복사 완료!' : 'C 초기화 코드 복사'}</span>
          </button>
        </div>

        <pre className="p-4 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed max-h-72 select-all">
          {generatedCode}
        </pre>
      </div>
    </div>
  );
};
