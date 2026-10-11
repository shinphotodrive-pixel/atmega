import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Zap,
  Activity,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Clock,
  Battery,
  TrendingDown,
  Gauge,
  Info,
  Scale,
  Sparkles,
  ShieldCheck,
  Check,
  Copy
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export const ClockPowerAnalyzer: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // User Interactive Inputs
  const [clockMhz, setClockMhz] = useState<number>(16); // 0.1 ~ 24 MHz
  const [voltageV, setVoltageV] = useState<number>(5.0); // 1.8 ~ 5.5 V
  const [sleepMode, setSleepMode] = useState<'active' | 'idle' | 'power_down'>('active');
  const [temperatureC, setTemperatureC] = useState<number>(25); // 25C standard room temp
  const [activePeripheralsPercent, setActivePeripheralsPercent] = useState<number>(60); // 0 ~ 100%

  const [copied, setCopied] = useState<boolean>(false);

  // MCU Electrical Operating Envelope Datasheet Specs
  // For ATmega328P:
  // 0 - 4 MHz @ 1.8V - 5.5V
  // 0 - 10 MHz @ 2.7V - 5.5V
  // 0 - 20 MHz @ 4.5V - 5.5V
  // For ATmega128 / ATmega640:
  // ATmega128L: 0-8MHz @ 2.7-5.5V, ATmega128: 0-16MHz @ 4.5-5.5V
  // ATmega640V: 0-8MHz @ 1.8-5.5V, ATmega640: 0-16MHz @ 2.7-5.5V
  const mcuLimits = useMemo(() => {
    switch (selectedMCU) {
      case 'atmega328p':
        return {
          minV: 1.8,
          maxV: 5.5,
          maxSafeFreq: 20.0,
          // Frequency safe limit as function of voltage:
          // Between 1.8V (4MHz) and 2.7V (10MHz): slope = (10-4)/(2.7-1.8) = 6.67 MHz/V
          // Between 2.7V (10MHz) and 4.5V (20MHz): slope = (20-10)/(4.5-2.7) = 5.56 MHz/V
          getSafeMaxFreq: (v: number) => {
            if (v < 1.8) return 0;
            if (v <= 2.7) return 4.0 + ((v - 1.8) / (2.7 - 1.8)) * (10.0 - 4.0);
            if (v <= 4.5) return 10.0 + ((v - 2.7) / (4.5 - 2.7)) * (20.0 - 10.0);
            return 20.0;
          },
          getMinVoltageForFreq: (f: number) => {
            if (f <= 4.0) return 1.8;
            if (f <= 10.0) return 1.8 + ((f - 4.0) / 6.0) * (2.7 - 1.8);
            if (f <= 20.0) return 2.7 + ((f - 10.0) / 10.0) * (4.5 - 2.7);
            return 5.0; // out of spec
          },
          // Active current baseline: ~0.2mA/MHz @ 5V (approx 9mA @ 16MHz active)
          activeCurrentPerMhzMa: 0.55,
          idleRatio: 0.35,
          powerDownUa: 0.15
        };
      case 'atmega128':
        return {
          minV: 2.7,
          maxV: 5.5,
          maxSafeFreq: 16.0,
          getSafeMaxFreq: (v: number) => {
            if (v < 2.7) return 0;
            if (v <= 4.5) return 8.0 + ((v - 2.7) / (4.5 - 2.7)) * (16.0 - 8.0);
            return 16.0;
          },
          getMinVoltageForFreq: (f: number) => {
            if (f <= 8.0) return 2.7;
            if (f <= 16.0) return 2.7 + ((f - 8.0) / 8.0) * (4.5 - 2.7);
            return 5.0;
          },
          activeCurrentPerMhzMa: 0.95,
          idleRatio: 0.45,
          powerDownUa: 15.0
        };
      case 'atmega640':
      default:
        return {
          minV: 1.8,
          maxV: 5.5,
          maxSafeFreq: 16.0,
          getSafeMaxFreq: (v: number) => {
            if (v < 1.8) return 0;
            if (v <= 2.7) return 4.0 + ((v - 1.8) / (2.7 - 1.8)) * (8.0 - 4.0);
            if (v <= 4.5) return 8.0 + ((v - 2.7) / (4.5 - 2.7)) * (16.0 - 8.0);
            return 16.0;
          },
          getMinVoltageForFreq: (f: number) => {
            if (f <= 4.0) return 1.8;
            if (f <= 8.0) return 1.8 + ((f - 4.0) / 4.0) * (2.7 - 1.8);
            if (f <= 16.0) return 2.7 + ((f - 8.0) / 8.0) * (4.5 - 2.7);
            return 5.0;
          },
          activeCurrentPerMhzMa: 0.85,
          idleRatio: 0.40,
          powerDownUa: 2.5
        };
    }
  }, [selectedMCU]);

  // Operating Range Feasibility Check
  const maxSafeClockForCurrentVoltage = mcuLimits.getSafeMaxFreq(voltageV);
  const minRequiredVoltageForCurrentClock = mcuLimits.getMinVoltageForFreq(clockMhz);

  const isVoltageTooLow = voltageV < mcuLimits.minV;
  const isVoltageTooHigh = voltageV > mcuLimits.maxV;
  const isFrequencyOverclocked = clockMhz > mcuLimits.maxSafeFreq;
  const isOperatingRangeUnsafe =
    isVoltageTooLow ||
    isVoltageTooHigh ||
    clockMhz > maxSafeClockForCurrentVoltage;

  // Power Consumption Physics Modeling
  // Dynamic Power P_dyn = C_eff * V^2 * f
  // Total Current I = I_static + I_dynamic
  // I_dynamic is roughly proportional to V * f
  const powerModel = useMemo(() => {
    const vNorm = voltageV / 5.0; // normalized to 5V
    const fMhz = clockMhz;

    let currentMa = 0;

    if (sleepMode === 'power_down') {
      // Deep Sleep (Watchdog only or all stopped)
      currentMa = (mcuLimits.powerDownUa / 1000) * (1 + (temperatureC - 25) * 0.03);
    } else if (sleepMode === 'idle') {
      // Idle: CPU core stopped, peripherals running
      const basePerMhz = mcuLimits.activeCurrentPerMhzMa * mcuLimits.idleRatio;
      const periphFactor = 0.5 + (activePeripheralsPercent / 100) * 0.5;
      currentMa = (basePerMhz * fMhz * (vNorm ** 1.3)) * periphFactor;
    } else {
      // Active Mode: Core + Peripherals executing
      const basePerMhz = mcuLimits.activeCurrentPerMhzMa;
      const periphFactor = 0.6 + (activePeripheralsPercent / 100) * 0.4;
      currentMa = (basePerMhz * fMhz * (vNorm ** 1.4)) * periphFactor;
    }

    // Power in mW = V * I (mA)
    const powerMw = voltageV * currentMa;

    // Energy per Instruction (approx 1 clock = 1 instruction in AVR RISC core)
    // Energy per MIPS = Power / (fMhz) in nJ/instruction
    const nanoJoulesPerInstruction = fMhz > 0 ? (powerMw / fMhz) : 0;

    // Battery Runtime Estimation on typical CR2032 (220mAh) or 2xAA Alkaline (2400mAh)
    const cr2032Hours = currentMa > 0 ? Math.round(220 / currentMa) : 999999;
    const aaBatteryHours = currentMa > 0 ? Math.round(2400 / currentMa) : 999999;

    return {
      currentMa: parseFloat(currentMa.toFixed(3)),
      powerMw: parseFloat(powerMw.toFixed(2)),
      nanoJoulesPerInstruction: parseFloat(nanoJoulesPerInstruction.toFixed(2)),
      cr2032Hours,
      aaBatteryHours
    };
  }, [
    voltageV,
    clockMhz,
    sleepMode,
    temperatureC,
    activePeripheralsPercent,
    mcuLimits
  ]);

  // SVG Graph Coordinate Mapping:
  // X axis: Voltage from 1.5V to 5.5V (width 400)
  // Y axis: Frequency from 0MHz to 24MHz (height 200, inverted in SVG)
  const svgWidth = 420;
  const svgHeight = 220;
  const padding = { left: 40, right: 20, top: 20, bottom: 30 };

  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  const minGraphV = 1.5;
  const maxGraphV = 5.5;
  const minGraphF = 0;
  const maxGraphF = 24;

  const mapX = (v: number) => padding.left + ((v - minGraphV) / (maxGraphV - minGraphV)) * graphWidth;
  const mapY = (f: number) => padding.top + graphHeight - ((f - minGraphF) / (maxGraphF - minGraphF)) * graphHeight;

  // Build the Safe Envelope Polygon Points
  const safePoints: { v: number; f: number }[] = [];
  // Sample along voltage curve
  for (let v = mcuLimits.minV; v <= mcuLimits.maxV; v += 0.1) {
    safePoints.push({ v: parseFloat(v.toFixed(2)), f: mcuLimits.getSafeMaxFreq(v) });
  }

  // Create SVG path string for Safe Polygon
  const polygonPointsStr = [
    `${mapX(mcuLimits.minV)},${mapY(0)}`, // bottom left
    ...safePoints.map((pt) => `${mapX(pt.v)},${mapY(pt.f)}`),
    `${mapX(mcuLimits.maxV)},${mapY(safePoints[safePoints.length - 1].f)}`,
    `${mapX(mcuLimits.maxV)},${mapY(0)}` // bottom right
  ].join(' ');

  // Current Operating Point (User Point)
  const userPointX = mapX(voltageV);
  const userPointY = mapY(clockMhz);

  const copyAnalysisReport = () => {
    const report = `// ==============================================================================
// AVR 시스템 클럭 기반 전력 분석 보고서 (${currentProfile.name})
// ==============================================================================
- 목표 동작 전압 (VCC)       : ${voltageV} V
- 시스템 클럭 주파수 (F_CPU) : ${clockMhz} MHz
- 전원 관리 모드             : ${sleepMode.toUpperCase()}
- 주변장치 활성화율          : ${activePeripheralsPercent} %
- 동작 안전 영역 판정        : ${isOperatingRangeUnsafe ? '⚠️ 비안전 (클럭 오버 또는 전압 부족)' : '✅ 안전 (Safe Operating Area)'}
- 현재 전압 허용 최대 주파수 : ${maxSafeClockForCurrentVoltage.toFixed(1)} MHz

[전력 소비 및 배터리 수명 산출]
- 총 소비 전류 (I_CC)        : ${powerModel.currentMa} mA
- 소모 전력 (Power)          : ${powerModel.powerMw} mW
- 에너지 효율 (E/Inst)       : ${powerModel.nanoJoulesPerInstruction} nJ / 명령
- CR2032 코인셀 연속 수명    : 약 ${powerModel.cr2032Hours.toLocaleString()} 시간 (${(powerModel.cr2032Hours / 24).toFixed(1)} 일)
- AA 배터리 2개 연속 수명    : 약 ${powerModel.aaBatteryHours.toLocaleString()} 시간 (${(powerModel.aaBatteryHours / 24).toFixed(1)} 일)
`;
    navigator.clipboard.writeText(report);
    setCopied(true);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.3 } });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Title Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" /> Clock Power Analyzer
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              Target: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-mono">
              P = C × V² × f Dynamic Modeling
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            시스템 클럭 기반 전력 분석기 & 전압-주파수 동작 영역 (Operating Range)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            공급 전압(V)과 시스템 클럭 주파수(MHz)를 입력하면 AVR 데이터시트의 <strong>안전 동작 보장 영역(Safe Operating Area)</strong>에 부합하는지 실시간 진단하고,
            동적 스위칭 전력($P = C \cdot V^2 \cdot f$), 소비 전류(mA), 명령당 에너지(nJ) 및 배터리 구동 수명을 정밀 산출합니다.
          </p>
        </div>

        {/* Copy Report Button */}
        <button
          onClick={copyAnalysisReport}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20 shrink-0"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? '분석 복사 완료' : '전력 분석 보고서 복사'}</span>
        </button>
      </div>

      {/* Safety Warning Banner if outside safe envelope */}
      {isOperatingRangeUnsafe ? (
        <div className="p-4 rounded-xl border border-rose-500/60 bg-rose-950/40 text-rose-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <strong className="font-bold text-white">
              ⚠️ 동작 영역 한계 초과 경고: 클럭 안정성 결여 (Out of Safe Operating Range)
            </strong>
            <p className="leading-relaxed">
              현재 인가 전압(<strong>{voltageV}V</strong>)에서 허용되는 {currentProfile.name}의 최대 보장 주파수는 <strong>{maxSafeClockForCurrentVoltage.toFixed(1)} MHz</strong>입니다.
              설정된 <strong>{clockMhz} MHz</strong>로 구동 시 플래시 메모리 읽기 타이밍 위반 및 MCU 코어 명령어 페치 오류(Brown-out/Crash)가 발생할 수 있습니다.
              전압을 최소 <strong>{minRequiredVoltageForCurrentClock.toFixed(2)}V</strong> 이상으로 승압하거나 클럭을 낮추십시오.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/30 text-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <strong className="font-bold text-white">✅ 데이터시트 공인 안전 동작 영역 (Safe Operating Area)</strong>
              <p className="text-slate-400 text-[11px]">
                {voltageV}V 공급 환경에서 {clockMhz}MHz 클럭은 규격 내에서 안정적으로 동작합니다. (최대 가용 클럭: {maxSafeClockForCurrentVoltage.toFixed(1)}MHz)
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30">
            마진: +{(maxSafeClockForCurrentVoltage - clockMhz).toFixed(1)} MHz 여유
          </span>
        </div>
      )}

      {/* Grid: Form Inputs (Left 5 cols) & Safe Operating Graph (Right 7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Controls */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">동작 전압 및 클럭 주파수 설정</h3>
          </div>

          {/* Voltage Input Slider */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1 font-medium">
              <span className="text-slate-400">공급 전압 (VCC):</span>
              <span className="text-emerald-400 font-bold font-mono text-sm">{voltageV.toFixed(2)} V</span>
            </div>
            <input
              type="range"
              min="1.8"
              max="5.5"
              step="0.05"
              value={voltageV}
              onChange={(e) => setVoltageV(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <button onClick={() => setVoltageV(1.8)} className="hover:text-white">1.8V (초저전력)</button>
              <button onClick={() => setVoltageV(3.3)} className="hover:text-white">3.3V (배터리/센서)</button>
              <button onClick={() => setVoltageV(5.0)} className="hover:text-white font-bold text-emerald-400">5.0V (표준)</button>
            </div>
          </div>

          {/* Clock Frequency Slider */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1 font-medium">
              <span className="text-slate-400">시스템 클럭 주파수 (F_CPU):</span>
              <span className="text-cyan-400 font-bold font-mono text-sm">{clockMhz.toFixed(2)} MHz</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={clockMhz}
              onChange={(e) => setClockMhz(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <button onClick={() => setClockMhz(1.0)} className="hover:text-white">1 MHz (내부RC)</button>
              <button onClick={() => setClockMhz(8.0)} className="hover:text-white">8 MHz (3.3V)</button>
              <button onClick={() => setClockMhz(16.0)} className="hover:text-white font-bold text-cyan-400">16 MHz (Uno/Mega)</button>
              <button onClick={() => setClockMhz(20.0)} className="hover:text-white">20 MHz (최대)</button>
            </div>
          </div>

          {/* Sleep / Operating Mode */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">전원 관리 모드 (Power Reduction)</label>
            <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
              {(['active', 'idle', 'power_down'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSleepMode(mode)}
                  className={`py-1.5 px-2 rounded-lg border font-bold transition text-center ${
                    sleepMode === mode
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {mode === 'active' ? 'Active (동작)' : mode === 'idle' ? 'Idle (대기)' : 'Power-down'}
                </button>
              ))}
            </div>
          </div>

          {/* Active Peripherals Slider */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1 font-medium">
              <span className="text-slate-400">주변장치 가동률 (PRR 레지스터):</span>
              <span className="text-amber-400 font-bold font-mono">{activePeripheralsPercent}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={activePeripheralsPercent}
              onChange={(e) => setActivePeripheralsPercent(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              ADC, Timer, SPI, USART 등 하드웨어 모듈 전원 On 비율
            </span>
          </div>
        </div>

        {/* Right: Voltage vs Frequency Operating Range Graph (SVG) */}
        <div className="lg:col-span-7 bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">
                {currentProfile.name} 전압-주파수 안전 동작 영역 (Safe Operating Area)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Datasheet Envelope Graph
            </span>
          </div>

          {/* SVG Graph */}
          <div className="relative bg-slate-950 p-2 rounded-xl border border-slate-800/80 flex items-center justify-center">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-56 select-none font-mono">
              {/* Grid Lines */}
              {[2, 3, 4, 5].map((v) => (
                <line
                  key={`grid-x-${v}`}
                  x1={mapX(v)}
                  y1={padding.top}
                  x2={mapX(v)}
                  y2={svgHeight - padding.bottom}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              ))}
              {[0, 4, 8, 12, 16, 20].map((f) => (
                <line
                  key={`grid-y-${f}`}
                  x1={padding.left}
                  y1={mapY(f)}
                  x2={svgWidth - padding.right}
                  y2={mapY(f)}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              ))}

              {/* Safe Operating Area Shaded Polygon */}
              <polygon
                points={polygonPointsStr}
                fill="rgba(16, 185, 129, 0.15)"
                stroke="#10b981"
                strokeWidth="2"
              />

              {/* Axes lines */}
              <line
                x1={padding.left}
                y1={svgHeight - padding.bottom}
                x2={svgWidth - padding.right}
                y2={svgHeight - padding.bottom}
                stroke="#475569"
                strokeWidth="1.5"
              />
              <line
                x1={padding.left}
                y1={padding.top}
                x2={padding.left}
                y2={svgHeight - padding.bottom}
                stroke="#475569"
                strokeWidth="1.5"
              />

              {/* X Axis Labels (Voltage) */}
              {[1.8, 2.7, 3.3, 4.5, 5.0].map((v) => (
                <text
                  key={`label-v-${v}`}
                  x={mapX(v)}
                  y={svgHeight - padding.bottom + 16}
                  fill="#94a3b8"
                  fontSize="9"
                  textAnchor="middle"
                >
                  {v}V
                </text>
              ))}

              {/* Y Axis Labels (Frequency) */}
              {[0, 4, 8, 12, 16, 20].map((f) => (
                <text
                  key={`label-f-${f}`}
                  x={padding.left - 6}
                  y={mapY(f) + 3}
                  fill="#94a3b8"
                  fontSize="9"
                  textAnchor="end"
                >
                  {f}M
                </text>
              ))}

              {/* Axis Titles */}
              <text
                x={svgWidth / 2}
                y={svgHeight - 4}
                fill="#cbd5e1"
                fontSize="10"
                textAnchor="middle"
                fontWeight="bold"
              >
                공급 전압 VCC (Volts)
              </text>
              <text
                x={12}
                y={padding.top + 8}
                fill="#cbd5e1"
                fontSize="10"
                textAnchor="start"
                fontWeight="bold"
              >
                F_CPU (MHz)
              </text>

              {/* User Operating Point Indicator */}
              <circle
                cx={userPointX}
                cy={userPointY}
                r="6"
                fill={isOperatingRangeUnsafe ? '#f43f5e' : '#06b6d4'}
                stroke="#ffffff"
                strokeWidth="2"
                className="animate-pulse"
              />
              <text
                x={Math.min(svgWidth - 90, userPointX + 10)}
                y={Math.max(padding.top + 12, userPointY - 8)}
                fill={isOperatingRangeUnsafe ? '#fb7185' : '#22d3ee'}
                fontSize="10"
                fontWeight="bold"
              >
                ● {voltageV}V / {clockMhz}MHz
              </text>
            </svg>
          </div>

          {/* Graph Legend & Status */}
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-1 border-t border-slate-800">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500" />
                보장 안전 영역 (SOA)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                현재 설정 동작점
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              * 데이터시트 Section: Speed Grades 참조
            </span>
          </div>
        </div>
      </div>

      {/* Power Consumption & Battery Life Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Current Consumption */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold">총 소비 전류 (I_CC):</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {powerModel.currentMa} <span className="text-sm font-normal text-slate-400">mA</span>
          </div>
          <p className="text-[10px] text-slate-500">
            {sleepMode === 'active' ? 'CPU 코어 및 주변장치 연속 연산' : '저전력 슬립 모드 전류'}
          </p>
        </div>

        {/* Metric 2: Power in mW */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold">소비 전력 (Power):</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            {powerModel.powerMw} <span className="text-sm font-normal text-slate-400">mW</span>
          </div>
          <p className="text-[10px] text-slate-500">
            P = V × I ({voltageV}V × {powerModel.currentMa}mA)
          </p>
        </div>

        {/* Metric 3: Energy Efficiency */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold">에너지 효율 (E/Inst):</span>
            <Gauge className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-300 font-mono">
            {powerModel.nanoJoulesPerInstruction} <span className="text-sm font-normal text-slate-400">nJ / inst</span>
          </div>
          <p className="text-[10px] text-slate-500">
            명령 1회 실행당 소모되는 평균 에너지
          </p>
        </div>

        {/* Metric 4: Battery Lifetime */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold">CR2032 코인셀 연속 수명:</span>
            <Battery className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300 font-mono">
            {powerModel.cr2032Hours > 240 ? `${(powerModel.cr2032Hours / 24).toFixed(0)}일` : `${powerModel.cr2032Hours}시간`}
          </div>
          <p className="text-[10px] text-slate-500">
            AA 배터리 2개 사용 시 약 {(powerModel.aaBatteryHours / 24).toFixed(0)}일 구동
          </p>
        </div>
      </div>
    </div>
  );
};
