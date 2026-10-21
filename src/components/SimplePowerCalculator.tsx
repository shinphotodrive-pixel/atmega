import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
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
  RotateCcw
} from 'lucide-react';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export const SimplePowerCalculator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Default initial values
  const [voltage, setVoltage] = useState<number>(() => {
    return selectedMCU === 'atmega128' ? 5.0 : 3.3;
  });
  const [frequency, setFrequency] = useState<number>(8.0); // MHz
  const [batteryCapacity, setBatteryCapacity] = useState<number>(220); // CR2032 (220 mAh) or 2500 (AA)
  const [activeDutyPercent, setActiveDutyPercent] = useState<number>(10); // 10% active, 90% sleep
  const [copied, setCopied] = useState<boolean>(false);

  // Maximum allowed frequency for selected MCU at given voltage based on datasheet SOA curve
  const maxSafeFrequency = useMemo(() => {
    if (selectedMCU === 'atmega128') {
      if (voltage < 2.7) return 0; // Undervoltage for 128A
      if (voltage >= 4.5) return 16.0;
      // Linear interpolation 2.7V (8MHz) to 4.5V (16MHz)
      return +(8.0 + ((voltage - 2.7) / (4.5 - 2.7)) * (16.0 - 8.0)).toFixed(1);
    } else if (selectedMCU === 'atmega640') {
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

  const isFrequencyOverclocked = useMemo(() => {
    return frequency > maxSafeFrequency;
  }, [frequency, maxSafeFrequency]);

  // Current draw estimation based on datasheet typical characterization graphs
  const powerEstimation = useMemo(() => {
    let activeMa = 0;
    let idleMa = 0;
    let powerDownUa = 0;

    const v = Math.max(1.8, Math.min(5.5, voltage));
    const f = Math.max(0.1, Math.min(20, frequency));

    if (selectedMCU === 'atmega328p') {
      // ATmega328P PicoPower:
      // Active current: ~0.2mA @ 1.8V/1MHz, ~2.5mA @ 3.3V/8MHz, ~9.2mA @ 5V/16MHz, ~11.5mA @ 5V/20MHz
      // Slope: I_active ~ (0.09 * v + 0.08) * f + (0.05 * v)
      activeMa = +(((0.085 * v + 0.07) * f * 0.95 + (0.04 * v)).toFixed(2));
      // Idle current: ~0.03mA @ 1.8V/1MHz, ~0.75mA @ 3.3V/8MHz, ~2.8mA @ 5V/16MHz
      idleMa = +(((0.025 * v + 0.03) * f * 0.9 + (0.02 * v)).toFixed(2));
      // Power-down sleep: ~0.1 uA @ 1.8V, ~0.2 uA @ 3.3V, ~0.75 uA @ 5V (WDT off)
      powerDownUa = +(0.05 + 0.04 * Math.pow(v, 1.8)).toFixed(2);
    } else if (selectedMCU === 'atmega128') {
      // ATmega128 / ATmega128A:
      // Minimum VCC = 2.7V. Higher baseline active and sleep current.
      // Active current: ~1.2mA @ 2.7V/1MHz, ~4.5mA @ 3.3V/8MHz, ~15.0mA @ 5V/16MHz
      activeMa = +(((0.14 * v + 0.12) * f * 0.88 + (0.18 * v)).toFixed(2));
      idleMa = +(((0.06 * v + 0.08) * f * 0.82 + (0.12 * v)).toFixed(2));
      // Power-down sleep: ~5 uA @ 3.3V, ~18 uA @ 5V
      powerDownUa = +(1.5 + 0.65 * Math.pow(v, 2.1)).toFixed(1);
    } else {
      // ATmega640:
      // Active current: ~0.4mA @ 1.8V/1MHz, ~3.6mA @ 3.3V/8MHz, ~12.5mA @ 5V/16MHz
      activeMa = +(((0.11 * v + 0.09) * f * 0.92 + (0.08 * v)).toFixed(2));
      idleMa = +(((0.04 * v + 0.05) * f * 0.85 + (0.05 * v)).toFixed(2));
      // Power-down sleep: ~0.5 uA @ 1.8V, ~1.5 uA @ 3.3V, ~3.2 uA @ 5V
      powerDownUa = +(0.2 + 0.18 * Math.pow(v, 1.7)).toFixed(2);
    }

    // Power dissipation P = V * I (in milliwatts)
    const activeMw = +(voltage * activeMa).toFixed(2);
    const idleMw = +(voltage * idleMa).toFixed(2);
    const sleepMw = +((voltage * powerDownUa) / 1000).toFixed(4);

    // Baseline standard comparison: 5.0V @ 16MHz
    const baselineCurrentMa =
      selectedMCU === 'atmega328p' ? 9.2 : selectedMCU === 'atmega128' ? 15.0 : 12.5;
    const baselineMw = 5.0 * baselineCurrentMa;
    const powerReductionPercent = Math.max(0, Math.min(99, Math.round(((baselineMw - activeMw) / baselineMw) * 100)));

    // Duty-cycled Average Current
    const dutyRatio = activeDutyPercent / 100;
    const avgCurrentMa = +(activeMa * dutyRatio + (powerDownUa / 1000) * (1 - dutyRatio)).toFixed(3);
    const avgPowerMw = +(voltage * avgCurrentMa).toFixed(2);

    // Battery Life in Hours & Days
    const batteryHours = avgCurrentMa > 0 ? Math.round(batteryCapacity / avgCurrentMa) : 999999;
    const batteryDays = +(batteryHours / 24).toFixed(1);

    return {
      activeMa,
      idleMa,
      powerDownUa,
      activeMw,
      idleMw,
      sleepMw,
      powerReductionPercent,
      avgCurrentMa,
      avgPowerMw,
      batteryHours,
      batteryDays
    };
  }, [selectedMCU, voltage, frequency, activeDutyPercent, batteryCapacity]);

  const handleCopySummary = () => {
    const summaryText = `[${currentProfile.name} 전력 소모 계산 결과]
• 동작 전압 (VCC): ${voltage.toFixed(1)} V
• 동작 클럭 (F_CPU): ${frequency.toFixed(1)} MHz
• 활성 모드 예상 전류 (Active Current): ${powerEstimation.activeMa} mA (${powerEstimation.activeMw} mW)
• 대기 모드 예상 전류 (Idle Current): ${powerEstimation.idleMa} mA (${powerEstimation.idleMw} mW)
• 파워다운 슬립 전류 (Power-down Sleep): ${powerEstimation.powerDownUa} µA
• 듀티 사이클 (${activeDutyPercent}% 활성 기준) 평균 전류: ${powerEstimation.avgCurrentMa} mA
• 예상 배터리 수명 (${batteryCapacity} mAh 기준): 약 ${powerEstimation.batteryDays}일 (${powerEstimation.batteryHours}시간)`;

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
            <Zap className="w-3.5 h-3.5" /> Datasheet-Grounded Power Calculator
          </div>
          <h3 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>{currentProfile.name} 간이 소비전력 계산기 (Simple Power Calculator)</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            동작 전압(VCC)과 동작 주파수(F_CPU)를 설정하면, <strong>{currentProfile.name} 데이터시트 실측 곡선</strong>에 기반하여
            활성(Active), 유휴(Idle), 파워다운(Power-down) 모드별 전형적 소비전류(mA/µA)와 총 소비전력(mW)을 즉시 산출합니다.
          </p>
        </div>

        <button
          onClick={handleCopySummary}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all flex items-center gap-1.5 border border-slate-700 shrink-0 shadow-md"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? '복사 완료!' : '계산 결과 복사'}</span>
        </button>
      </div>

      {/* Safety Warnings & Operating Area Checker */}
      {isVoltageOutOfBounds && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold">동작 전압 범위 이탈 경고:</strong>
            {selectedMCU === 'atmega128' ? (
              <span>
                ATmega128 / ATmega128A는 최소 동작 전압이 <strong>2.7V</strong>입니다. 현재 설정된 {voltage}V에서는 내부 플래시 및 CPU 코어가 동작하지 않습니다. (2.7V ~ 5.5V 설정 필요)
              </span>
            ) : (
              <span>
                {currentProfile.name}의 정격 공급 전압은 <strong>1.8V ~ 5.5V</strong>입니다. 설정 전압({voltage}V)을 조정해 주세요.
              </span>
            )}
          </div>
        </div>
      )}

      {isFrequencyOverclocked && !isVoltageOutOfBounds && (
        <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold">클럭 주파수 과속 경고 (Safe Operating Area 초과):</strong>
            <span>
              {voltage.toFixed(1)}V 전압에서 {currentProfile.name}의 데이터시트 보증 최대 안전 주파수는 <strong>{maxSafeFrequency} MHz</strong>입니다.
              현재 설정({frequency} MHz)은 오버클럭 상태로, 플래시 읽기 오류나 리셋이 발생할 수 있습니다.
            </span>
          </div>
        </div>
      )}

      {/* Calculator Input Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-950/70 p-5 rounded-2xl border border-slate-800">
        {/* Voltage (VCC) Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-white flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              1. 공급 전압 (VCC):
            </label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-amber-400">{voltage.toFixed(2)} V</span>
              <span className="text-[10px] text-slate-500 font-mono">
                ({selectedMCU === 'atmega128' ? '2.7V ~ 5.5V' : '1.8V ~ 5.5V'})
              </span>
            </div>
          </div>

          <input
            type="range"
            min={selectedMCU === 'atmega128' ? 2.7 : 1.8}
            max={5.5}
            step={0.1}
            value={voltage}
            onChange={(e) => setVoltage(parseFloat(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />

          {/* Quick Preset Buttons for Voltage */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-400">전압 프리셋:</span>
            {selectedMCU !== 'atmega128' && (
              <button
                onClick={() => setVoltage(1.8)}
                className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-all border ${
                  voltage === 1.8
                    ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                }`}
              >
                1.8V (배터리 저전압)
              </button>
            )}
            <button
              onClick={() => setVoltage(2.7)}
              className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-all border ${
                voltage === 2.7
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
              }`}
            >
              2.7V (128 최소 전압)
            </button>
            <button
              onClick={() => setVoltage(3.3)}
              className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-all border ${
                voltage === 3.3
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
              }`}
            >
              3.3V (표준 3V3 로직)
            </button>
            <button
              onClick={() => setVoltage(5.0)}
              className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-all border ${
                voltage === 5.0
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
              }`}
            >
              5.0V (표준 USB / 아두이노)
            </button>
          </div>
        </div>

        {/* Frequency (F_CPU) Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-white flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-400" />
              2. 동작 클럭 주파수 (F_CPU):
            </label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-cyan-400">{frequency.toFixed(1)} MHz</span>
              <span className="text-[10px] text-slate-500 font-mono">
                (안전 권장: ≤ {maxSafeFrequency} MHz)
              </span>
            </div>
          </div>

          <input
            type="range"
            min={0.5}
            max={selectedMCU === 'atmega328p' ? 20.0 : 16.0}
            step={0.5}
            value={frequency}
            onChange={(e) => setFrequency(parseFloat(e.target.value))}
            className="w-full accent-cyan-500 cursor-pointer"
          />

          {/* Quick Preset Buttons for Frequency */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-400">클럭 프리셋:</span>
            <button
              onClick={() => setFrequency(1.0)}
              className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-all border ${
                frequency === 1.0
                  ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
              }`}
            >
              1.0 MHz (8분주 저전력)
            </button>
            <button
              onClick={() => setFrequency(8.0)}
              className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-all border ${
                frequency === 8.0
                  ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
              }`}
            >
              8.0 MHz (내부 RC 기본)
            </button>
            <button
              onClick={() => setFrequency(16.0)}
              className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-all border ${
                frequency === 16.0
                  ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
              }`}
            >
              16.0 MHz (외부 크리스탈)
            </button>
            {selectedMCU === 'atmega328p' && (
              <button
                onClick={() => setFrequency(20.0)}
                className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-all border ${
                  frequency === 20.0
                    ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                }`}
              >
                20.0 MHz (328P 최고속)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Calculation Results Display Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Active Mode Result Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-b from-amber-500/10 to-slate-950 border border-amber-500/40 space-y-3 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Zap className="w-4 h-4 text-amber-400" /> 활성 모드 (Active Mode)
            </span>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono font-bold">
              CPU 100% 가동
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-black font-mono text-white">
              {powerEstimation.activeMa} <span className="text-sm font-sans font-bold text-amber-400">mA</span>
            </div>
            <div className="text-xs font-mono text-slate-400">
              소비전력: <strong className="text-amber-300 font-bold">{powerEstimation.activeMw} mW</strong>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-2">
            CPU 코어와 모든 I/O 클럭이 정속 실행 중일 때의 전형적 소비전류 (VCC × ICC).
          </p>
        </div>

        {/* Idle Mode Result Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-b from-cyan-500/10 to-slate-950 border border-cyan-500/40 space-y-3 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Clock className="w-4 h-4 text-cyan-400" /> 유휴 모드 (Idle Mode)
            </span>
            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-mono font-bold">
              CPU 정지 / 주변장치 ON
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-black font-mono text-white">
              {powerEstimation.idleMa} <span className="text-sm font-sans font-bold text-cyan-400">mA</span>
            </div>
            <div className="text-xs font-mono text-slate-400">
              소비전력: <strong className="text-cyan-300 font-bold">{powerEstimation.idleMw} mW</strong>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-2">
            CPU 코어 및 플래시 클럭 정지, SPI/USART/타이머 인터럽트 대기 상태.
          </p>
        </div>

        {/* Power-down Sleep Result Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-b from-emerald-500/10 to-slate-950 border border-emerald-500/40 space-y-3 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Battery className="w-4 h-4 text-emerald-400" /> 파워다운 슬립 (Power-down)
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono font-bold">
              최대 절전 대기
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-black font-mono text-white">
              {powerEstimation.powerDownUa} <span className="text-sm font-sans font-bold text-emerald-400">µA</span>
            </div>
            <div className="text-xs font-mono text-slate-400">
              소비전력: <strong className="text-emerald-300 font-bold">{powerEstimation.sleepMw} mW</strong>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-2">
            외부 오실레이터 차단, 외부 인터럽트(INTx) 및 WDT에 의해서만 기상 가능한 최저 암전류.
          </p>
        </div>
      </div>

      {/* Advanced Battery Life & Duty Cycle Scenario Simulator */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Battery className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              동적 듀티 사이클 & 배터리 수명 시뮬레이터 (Battery Runtime Estimate)
            </h4>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            평균 전류: <strong className="text-amber-400 font-bold">{powerEstimation.avgCurrentMa} mA</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Duty Cycle Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">활성 가동율 (Active Duty Cycle):</span>
              <span className="font-mono font-bold text-amber-400">{activeDutyPercent}% 가동 / {100 - activeDutyPercent}% 슬립</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={activeDutyPercent}
              onChange={(e) => setActiveDutyPercent(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              센서 주기적 측정 (예: 1초 중 100ms 가동 = 10% 듀티 사이클)
            </p>
          </div>

          {/* Battery Preset Selector */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">배터리 용량 (Battery Capacity):</span>
              <span className="font-mono font-bold text-cyan-400">{batteryCapacity} mAh</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setBatteryCapacity(220)}
                className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-all border ${
                  batteryCapacity === 220
                    ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                CR2032 (220 mAh)
              </button>
              <button
                onClick={() => setBatteryCapacity(1000)}
                className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-all border ${
                  batteryCapacity === 1000
                    ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                LiPo 1S (1,000 mAh)
              </button>
              <button
                onClick={() => setBatteryCapacity(2500)}
                className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-all border ${
                  batteryCapacity === 2500
                    ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                2x AA 알카라인 (2,500 mAh)
              </button>
            </div>
          </div>
        </div>

        {/* Runtime Result Badge */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs">
            <span className="text-slate-400 block">설정 조건 하 연속 사용 가능 예상 시간:</span>
            <span className="text-base font-bold text-white font-mono flex items-center gap-2 mt-0.5">
              <span>약 {powerEstimation.batteryDays} 일</span>
              <span className="text-xs text-slate-400 font-normal">({powerEstimation.batteryHours} 시간)</span>
            </span>
          </div>

          <div className="text-right text-xs">
            <span className="text-slate-400 block font-mono">기본 5.0V 16MHz 대비 절감율</span>
            <span className="text-emerald-400 font-bold font-mono text-sm">
              ▼ {powerEstimation.powerReductionPercent}% 전력 절약
            </span>
          </div>
        </div>
      </div>

      {/* Datasheet Formula Grounding Note */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400 space-y-1.5 leading-relaxed">
        <div className="font-bold text-slate-300 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-amber-400" /> 데이터시트 전기적 특성 (Electrical Characteristics) 산출 근거:
        </div>
        <div>
          • <strong>동적 소비전류 비례식</strong>: AVR CMOS 로직의 활성 전류는 공급 전압의 제곱 및 주파수에 비례합니다 (P ∝ C · VCC² · f).
        </div>
        <div>
          • <strong>칩셋별 사양 차이</strong>: <strong>ATmega328P</strong>는 PicoPower 설계로 1.8V 저전압에서 극저전력(0.1µA 슬립)을 지원하며, <strong>ATmega128</strong>은 2.7V 이상에서 구동되는 클래식 아키텍처 특성상 대기 전류가 상대적으로 높습니다.
        </div>
      </div>
    </div>
  );
};
