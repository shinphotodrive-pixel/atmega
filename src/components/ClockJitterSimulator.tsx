import React, { useState, useMemo } from 'react';
import {
  Clock,
  Cpu,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sliders,
  Terminal,
  Zap,
  Radio,
  Gauge,
  Thermometer,
  ShieldAlert,
  RotateCcw,
  Sparkles,
  Info,
  Maximize2,
  Layers,
  ArrowRight
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type ClockSourceType = 'crystal' | 'ceramic' | 'internal_rc' | 'tcxo';

interface ClockPreset {
  id: ClockSourceType;
  name: string;
  nameKo: string;
  basePpm: number; // typical accuracy in ppm (+/-)
  tempCoeffPpmPerC: number; // ppm / °C
  typicalJitterNs: number; // RMS jitter in ns
  description: string;
  recommendedForUart: boolean;
}

const CLOCK_SOURCE_PRESETS: ClockPreset[] = [
  {
    id: 'crystal',
    name: 'External Quartz Crystal (HC-49 / SMD XTAL)',
    nameKo: '외부 수정 발진자 (Quartz Crystal)',
    basePpm: 20, // ±20 ppm (0.002%)
    tempCoeffPpmPerC: 0.4,
    typicalJitterNs: 0.05,
    description: '고정밀 석영 크리스털. 온도 및 전압 변화에 극도로 안정적이며 고속 통신에 표준 권장.',
    recommendedForUart: true
  },
  {
    id: 'ceramic',
    name: 'Ceramic Resonator (세라믹 발진자)',
    nameKo: '세라믹 발진자 (내장 커패시터)',
    basePpm: 5000, // ±0.5% (5000 ppm)
    tempCoeffPpmPerC: 15,
    typicalJitterNs: 0.8,
    description: '저가형 3핀 세라믹 레조네이터(일부 아두이노 호환보드 채택). 수천 ppm 오차 및 온도 드리프트 발생.',
    recommendedForUart: true
  },
  {
    id: 'internal_rc',
    name: 'Internal Calibrated RC Oscillator',
    nameKo: '내부 8MHz/1MHz RC 발진기',
    basePpm: 30000, // ±3.0% (30000 ppm) uncalibrated can be +/-10%
    tempCoeffPpmPerC: 80,
    typicalJitterNs: 4.5,
    description: '외부 부품 불필요. 공장 출하 시 ±10% 오차(OSCCAL 캘리브레이션 시 ±1~3%). 온도/전압에 매우 민감.',
    recommendedForUart: false
  },
  {
    id: 'tcxo',
    name: 'TCXO / Active Oscillator (온도보상 크리스털)',
    nameKo: '온도보상 발진기 (TCXO/OCXO)',
    basePpm: 1.5, // ±1.5 ppm
    tempCoeffPpmPerC: 0.05,
    typicalJitterNs: 0.01,
    description: '산업용/계측용 활성 오실레이터. 극한 환경에서도 클록 편차가 거의 없어 0% 에러 유지.',
    recommendedForUart: true
  }
];

const UART_BAUD_RATES = [
  { baud: 9600, label: '9,600 bps' },
  { baud: 19200, label: '19,200 bps' },
  { baud: 38400, label: '38,400 bps' },
  { baud: 57600, label: '57,600 bps' },
  { baud: 115200, label: '115,200 bps (표준 고속)' },
  { baud: 230400, label: '230,400 bps' },
  { baud: 500000, label: '500,000 bps (0.5 Mbps)' },
  { baud: 1000000, label: '1,000,000 bps (1 Mbps 초고속)' }
];

export const ClockJitterSimulator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Base Clock Settings
  const [baseFreqHz, setBaseFreqHz] = useState<number>(16000000);
  const [clockSource, setClockSource] = useState<ClockSourceType>('internal_rc');

  // Sliders for Precision & Environmental Stability
  const [manualOffsetPct, setManualOffsetPct] = useState<number>(2.5); // Initial frequency offset in %
  const [ambientTempC, setAmbientTempC] = useState<number>(45); // Ambient Temp in °C (25°C is nominal)
  const [vccVoltage, setVccVoltage] = useState<number>(4.8); // Supply voltage (nominal 5.0V)
  const [cycleJitterNs, setCycleJitterNs] = useState<number>(3.5); // RMS period jitter in ns
  const [osccalValue, setOsccalValue] = useState<number>(152); // OSCCAL register (0-255, nominal around 128-160)

  // USART Protocol Configuration
  const [targetBaud, setTargetBaud] = useState<number>(115200);
  const [isU2xMode, setIsU2xMode] = useState<boolean>(false); // Double speed mode (8x oversampling vs 16x)
  const [dataPayloadHex, setDataPayloadHex] = useState<string>('0x55'); // Test frame byte (0x55 = 01010101 alternating)

  // Quick preset application
  const applyClockPreset = (presetId: ClockSourceType) => {
    setClockSource(presetId);
    const p = CLOCK_SOURCE_PRESETS.find((x) => x.id === presetId) || CLOCK_SOURCE_PRESETS[0];

    if (presetId === 'crystal') {
      setManualOffsetPct(0.005);
      setCycleJitterNs(0.05);
      setAmbientTempC(25);
    } else if (presetId === 'ceramic') {
      setManualOffsetPct(0.45);
      setCycleJitterNs(0.7);
      setAmbientTempC(35);
    } else if (presetId === 'internal_rc') {
      setManualOffsetPct(3.2); // Typical uncalibrated or high-temp drift
      setCycleJitterNs(4.0);
      setAmbientTempC(45);
    } else if (presetId === 'tcxo') {
      setManualOffsetPct(0.0002);
      setCycleJitterNs(0.01);
      setAmbientTempC(25);
    }
  };

  // ---------------------------------------------------------------------------
  // 1. Physical Frequency Calculation with Temperature, Voltage & OSCCAL Drift
  // ---------------------------------------------------------------------------
  const clockPhysics = useMemo(() => {
    const activePreset = CLOCK_SOURCE_PRESETS.find((x) => x.id === clockSource) || CLOCK_SOURCE_PRESETS[0];

    // Temperature drift contribution
    const deltaT = ambientTempC - 25; // difference from room temp
    const tempDriftPpm = deltaT * activePreset.tempCoeffPpmPerC;
    const tempDriftPct = tempDriftPpm / 10000;

    // Voltage drift (mainly affects Internal RC: ~1% per 0.5V change from 5.0V)
    const deltaV = vccVoltage - 5.0;
    const voltageDriftPct = clockSource === 'internal_rc' ? deltaV * 1.8 : deltaV * 0.05;

    // OSCCAL Calibration effect (for Internal RC)
    // OSCCAL=128 is approx center (100%). Each step is roughly ~0.4% frequency shift
    const osccalShiftPct = clockSource === 'internal_rc' ? (osccalValue - 128) * 0.38 : 0;

    // Net Total Frequency Drift Percentage
    const netFrequencyDriftPct = manualOffsetPct + tempDriftPct + voltageDriftPct + (clockSource === 'internal_rc' ? osccalShiftPct : 0);

    // Effective actual CPU frequency
    const actualCpuFreqHz = baseFreqHz * (1 + netFrequencyDriftPct / 100);

    return {
      activePreset,
      tempDriftPct,
      voltageDriftPct,
      osccalShiftPct,
      netFrequencyDriftPct,
      actualCpuFreqHz,
      nominalPeriodNs: (1 / baseFreqHz) * 1e9,
      actualPeriodNs: (1 / actualCpuFreqHz) * 1e9
    };
  }, [baseFreqHz, clockSource, manualOffsetPct, ambientTempC, vccVoltage, osccalValue]);

  // ---------------------------------------------------------------------------
  // 2. USART Baud Rate Generator & Quantization Error
  // ---------------------------------------------------------------------------
  const usartMath = useMemo(() => {
    const divisor = isU2xMode ? 8 : 16;

    // Nominal UBRR calculated at ideal base frequency
    const rawUbrr = baseFreqHz / (divisor * targetBaud) - 1;
    const regUbrr = Math.max(0, Math.min(4095, Math.round(rawUbrr)));

    // Nominal Baud Rate with integer UBRR
    const nominalBaudWithUbrr = baseFreqHz / (divisor * (regUbrr + 1));
    const ubrrQuantErrorPct = ((nominalBaudWithUbrr - targetBaud) / targetBaud) * 100;

    // Actual Baud Rate generated by MCU with drifting clock
    const actualBaud = clockPhysics.actualCpuFreqHz / (divisor * (regUbrr + 1));
    const actualBaudErrorPct = ((actualBaud - targetBaud) / targetBaud) * 100;

    // Nominal Bit Period in nanoseconds
    const nominalBitTimeNs = (1 / targetBaud) * 1e9;
    // Actual MCU transmitter bit period
    const actualBitTimeNs = (1 / actualBaud) * 1e9;

    return {
      divisor,
      regUbrr,
      nominalBaudWithUbrr,
      ubrrQuantErrorPct,
      actualBaud,
      actualBaudErrorPct,
      nominalBitTimeNs,
      actualBitTimeNs
    };
  }, [baseFreqHz, targetBaud, isU2xMode, clockPhysics.actualCpuFreqHz]);

  // ---------------------------------------------------------------------------
  // 3. 10-Bit Frame Sampling Points & Eye Margin Analysis
  // Frame format: 1 Start bit (0), 8 Data bits (LSB first), 1 Stop bit (1)
  // ---------------------------------------------------------------------------
  const frameAnalysis = useMemo(() => {
    // Parse test payload byte
    const parsedByte = parseInt(dataPayloadHex, 16) || 0x55;
    const dataBits: number[] = [];
    for (let i = 0; i < 8; i++) {
      dataBits.push((parsedByte >> i) & 1);
    }
    const fullBits = [0, ...dataBits, 1]; // [Start(0), D0..D7, Stop(1)] - Total 10 bits

    const bitLabels = ['START', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'STOP'];

    // Receiver timing: receiver synchronizes on falling edge of START bit (t=0)
    // In ideal standard receiver: samples each bit at (k + 0.5) * T_bit_nominal
    // In actual system: TX bit boundaries arrive at k * T_bit_actual
    // Receiver samples at (k + 0.5) * T_bit_nominal
    // Jitter adds uncertainty window around each sample
    const bitSamples = fullBits.map((bitVal, bitIdx) => {
      // Time when TX transmits the start of this bit
      const txBitStartNs = bitIdx * usartMath.actualBitTimeNs;
      const txBitEndNs = (bitIdx + 1) * usartMath.actualBitTimeNs;
      const txBitCenterNs = txBitStartNs + usartMath.actualBitTimeNs * 0.5;

      // Ideal nominal sampling moment expected by Receiver
      const rxSampleMomentNs = (bitIdx + 0.5) * usartMath.nominalBitTimeNs;

      // Jitter range (±3 * RMS jitter)
      const jitterMarginNs = cycleJitterNs * 3;
      const earliestSampleNs = rxSampleMomentNs - jitterMarginNs;
      const latestSampleNs = rxSampleMomentNs + jitterMarginNs;

      // Position of sample relative to the TX bit window:
      // 0.0 = start of bit, 0.5 = exact center, 1.0 = end of bit
      const samplePositionInBit = (rxSampleMomentNs - txBitStartNs) / usartMath.actualBitTimeNs;
      const sampleOffsetFromCenterPct = (samplePositionInBit - 0.5) * 100;

      // Margin evaluation:
      // AVR receiver oversamples 16x (or 8x) and takes 3 samples around center (7,8,9 in 16x mode).
      // Valid window is typically 0.25 to 0.75 (i.e. within ±25% of center).
      // If sample position is < 0.1 or > 0.9, high probability of sampling adjacent bit (Bit Slip / Framing Error)!
      const isOutOfBounds = samplePositionInBit < 0.05 || samplePositionInBit > 0.95;
      const isCritical = samplePositionInBit < 0.2 || samplePositionInBit > 0.8;
      const isAcceptable = !isCritical && !isOutOfBounds;

      return {
        bitIdx,
        label: bitLabels[bitIdx],
        bitVal,
        txBitStartNs,
        txBitEndNs,
        txBitCenterNs,
        rxSampleMomentNs,
        samplePositionInBit,
        sampleOffsetFromCenterPct,
        earliestSampleNs,
        latestSampleNs,
        isOutOfBounds,
        isCritical,
        isAcceptable
      };
    });

    // Check Stop Bit (Bit 9) sampling status - Most vulnerable to cumulative drift!
    const stopBitSample = bitSamples[9];
    const maxCumulativeDriftNs = Math.abs(stopBitSample.rxSampleMomentNs - stopBitSample.txBitCenterNs);
    const cumulativeDriftPctOfBit = (maxCumulativeDriftNs / usartMath.nominalBitTimeNs) * 100;

    // Remaining Eye Margin (% of half-bit duration remaining before bit slip)
    // 100% = perfectly centered, 0% = eye closed / failure
    const rawEyeMargin = (0.5 - Math.abs(stopBitSample.samplePositionInBit - 0.5)) / 0.5;
    const eyeMarginPct = Math.max(0, Math.min(100, rawEyeMargin * 100));

    // Frame Error Flag (FE0) Determination
    // AVR datasheet: maximum allowable cumulative clock error over 10-bit frame is ~3.75% (normal) to 4.5% (theoretical)
    const maxSafeErrorLimitPct = isU2xMode ? 4.5 : 3.75;
    const isFrameErrorTriggered = Math.abs(usartMath.actualBaudErrorPct) > maxSafeErrorLimitPct || stopBitSample.isOutOfBounds;
    const isTimingMarginal = Math.abs(usartMath.actualBaudErrorPct) > 2.0 && !isFrameErrorTriggered;

    return {
      fullBits,
      bitSamples,
      stopBitSample,
      maxCumulativeDriftNs,
      cumulativeDriftPctOfBit,
      eyeMarginPct,
      maxSafeErrorLimitPct,
      isFrameErrorTriggered,
      isTimingMarginal
    };
  }, [dataPayloadHex, usartMath, cycleJitterNs, isU2xMode]);

  // ---------------------------------------------------------------------------
  // 4. Other Timing-Sensitive Peripherals Comparison (WS2812B & DMX512)
  // ---------------------------------------------------------------------------
  const timingSensitiveImpact = useMemo(() => {
    // WS2812B Protocol: 800 kHz (1250 ns period)
    // T0H: 400ns ± 150ns (250ns ~ 550ns)
    // T1H: 800ns ± 150ns (650ns ~ 950ns)
    const ws2812NominalT0hNs = 400;
    const ws2812NominalT1hNs = 800;
    const actualT0hNs = ws2812NominalT0hNs * (clockPhysics.nominalPeriodNs / clockPhysics.actualPeriodNs);
    const actualT1hNs = ws2812NominalT1hNs * (clockPhysics.nominalPeriodNs / clockPhysics.actualPeriodNs);
    const isWs2812Violated = Math.abs(actualT0hNs - 400) > 150 || Math.abs(actualT1hNs - 800) > 150 || cycleJitterNs > 50;

    // DMX512 Protocol: 250 kbps (4000 ns bit time), strict ±2% tolerance
    const isDmxViolated = Math.abs(clockPhysics.netFrequencyDriftPct) > 2.0;

    return {
      actualT0hNs,
      actualT1hNs,
      isWs2812Violated,
      isDmxViolated
    };
  }, [clockPhysics, cycleJitterNs]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <Activity className="w-3.5 h-3.5 animate-pulse" /> Clock Jitter & Stability Simulator
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              비동기 시리얼(USART) 에러율 및 신호 무결성 시뮬레이터
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-xs font-mono font-bold">
              {currentProfile.name}
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            클록 지터(Jitter) & 주파수 안정도 시뮬레이터
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            크리스털, 세라믹 발진자, 내부 RC 발진기의 <strong>주파수 허용 오차(Tolerance)</strong>,{' '}
            <strong>온도/전압 드리프트</strong> 및 <strong>사이클 지터(Jitter)</strong>를 조절하여,
            비동기 시리얼 통신(USART) 10비트 프레임 내 누적 타이밍 스큐(Skew), 아이 마진(Eye Margin) 및 프레이밍 에러(`FE0`) 발생을 실시간 파형으로 시뮬레이션합니다.
          </p>
        </div>

        {/* Quick MCU Switcher */}
        {onSelectMCU && (
          <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 shrink-0">
            {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
              <button
                key={mcuId}
                onClick={() => onSelectMCU(mcuId)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                  selectedMCU === mcuId
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {MCU_PROFILES[mcuId].name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Control Grid: 1. Clock Source & Environment, 2. USART Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (6 Cols): Clock Source Presets & Physical Drift Sliders */}
        <div className="lg:col-span-6 space-y-4">
          {/* Section 1: Clock Source Type Selector */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-cyan-400" />
                1. 클록 소스 유형 선택 (Clock Source Type)
              </label>
              <span className="text-xs font-mono font-bold text-cyan-400">
                기본 주파수: {(baseFreqHz / 1000000).toFixed(1)} MHz
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {CLOCK_SOURCE_PRESETS.map((preset) => {
                const isSelected = clockSource === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => applyClockPreset(preset.id)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-200">{preset.nameKo}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                            preset.recommendedForUart
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {preset.recommendedForUart ? 'UART 권장' : 'UART 불안정'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight">
                        {preset.description}
                      </p>
                    </div>
                    <div className="mt-2 pt-1 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>기본 오차: ±{(preset.basePpm / 10000).toFixed(3)}%</span>
                      <span>지터: {preset.typicalJitterNs}ns</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Physical Environmental Stability Sliders */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 border-b border-slate-800/70 pb-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              2. 발진기 정밀도 및 환경 변수 조절 (Drift & Jitter Tuning)
            </span>

            {/* Slider 1: Base Offset (%) */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">초기 주파수 편차 (Initial Frequency Offset):</span>
                <span className="font-mono font-bold text-amber-300">
                  {manualOffsetPct >= 0 ? '+' : ''}{manualOffsetPct.toFixed(2)}%
                </span>
              </div>
              <input
                type="range"
                min="-6.0"
                max="6.0"
                step="0.05"
                value={manualOffsetPct}
                onChange={(e) => setManualOffsetPct(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>-6.0% (극심한 감속)</span>
                <span>0.0% (이상적 공진)</span>
                <span>+6.0% (극심한 가속)</span>
              </div>
            </div>

            {/* Slider 2: Ambient Temperature */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                  동작 주변 온도 (Ambient Temperature):
                </span>
                <span className="font-mono font-bold text-rose-300">
                  {ambientTempC}°C (드리프트: {clockPhysics.tempDriftPct >= 0 ? '+' : ''}{clockPhysics.tempDriftPct.toFixed(3)}%)
                </span>
              </div>
              <input
                type="range"
                min="-40"
                max="85"
                step="5"
                value={ambientTempC}
                onChange={(e) => setAmbientTempC(parseInt(e.target.value, 10))}
                className="w-full accent-rose-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>-40°C (극한 냉각)</span>
                <span>25°C (상온 기준)</span>
                <span>85°C (산업용 최고 온도)</span>
              </div>
            </div>

            {/* Slider 3: Cycle-to-Cycle Jitter */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">사이클 지터 (RMS Period Jitter):</span>
                <span className="font-mono font-bold text-cyan-300">
                  {cycleJitterNs.toFixed(2)} ns (Peak-to-Peak: {(cycleJitterNs * 6.6).toFixed(1)} ns)
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="12.0"
                step="0.1"
                value={cycleJitterNs}
                onChange={(e) => setCycleJitterNs(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.0 ns (이상적)</span>
                <span>3.0 ns (세라믹 평균)</span>
                <span>12.0 ns (극심한 노이즈)</span>
              </div>
            </div>

            {/* Slider 4: Internal RC OSCCAL calibration (If internal RC is chosen) */}
            {clockSource === 'internal_rc' && (
              <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-purple-300">OSCCAL 발진기 캘리브레이션 레지스터:</span>
                  <span className="font-mono font-bold text-purple-200">
                    {osccalValue} (0x{osccalValue.toString(16).toUpperCase()})
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={osccalValue}
                  onChange={(e) => setOsccalValue(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-400 cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 block leading-snug">
                  * `OSCCAL` 레지스터를 미세 조절하여 내부 RC 주파수를 수동 보정할 수 있습니다 (값 증가 시 주파수 상승).
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (6 Cols): USART Protocol Config & Live Real-Time Verdict */}
        <div className="lg:col-span-6 space-y-4">
          {/* Section 3: Target USART Configuration */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 border-b border-slate-800/70 pb-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              3. 타깃 USART 통신 환경 설정 (USART Baud Rate & Frame)
            </span>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">통신 속도 (Baud Rate)</label>
                <select
                  value={targetBaud}
                  onChange={(e) => setTargetBaud(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                >
                  {UART_BAUD_RATES.map((item) => (
                    <option key={item.baud} value={item.baud}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">테스트 페이로드 바이트 (Hex)</label>
                <input
                  type="text"
                  value={dataPayloadHex}
                  onChange={(e) => setDataPayloadHex(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                  placeholder="0x55"
                />
              </div>
            </div>

            {/* Toggle U2X Mode */}
            <div className="pt-1 flex items-center justify-between text-xs border-t border-slate-800/50">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={isU2xMode}
                  onChange={(e) => setIsU2xMode(e.target.checked)}
                  className="accent-cyan-500 rounded cursor-pointer"
                />
                <span>U2X 2배속 모드 활성화 (8배 오버샘플링, UBRR 분주기 절반)</span>
              </label>
              <span className="text-[11px] font-mono text-slate-500">
                샘플링: {isU2xMode ? '8x 클록' : '16x 클록'}
              </span>
            </div>
          </div>

          {/* Real-time Verdict Status Box */}
          <div
            className={`rounded-2xl p-5 border shadow-xl space-y-3.5 transition-all ${
              frameAnalysis.isFrameErrorTriggered
                ? 'bg-rose-950/40 border-rose-500/80 shadow-rose-950/40 ring-1 ring-rose-500/50'
                : frameAnalysis.isTimingMarginal
                ? 'bg-amber-950/40 border-amber-500/80 shadow-amber-950/40'
                : 'bg-emerald-950/40 border-emerald-500/80 shadow-emerald-950/40'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                {frameAnalysis.isFrameErrorTriggered ? (
                  <XCircle className="w-5 h-5 text-rose-400 animate-bounce" />
                ) : frameAnalysis.isTimingMarginal ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                )}
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {frameAnalysis.isFrameErrorTriggered
                      ? '⚠️ 프레이밍 에러 발생 (Frame Error Flag: FE0 Set)'
                      : frameAnalysis.isTimingMarginal
                      ? '⚠️ 타이밍 임계 경고 (Marginal Timing Warning)'
                      : '✅ 안정적 통신 품질 확보 (Reliable Link)'}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    최대 안전 허용 오차 한계: ±{frameAnalysis.maxSafeErrorLimitPct.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Eye Margin Gauge */}
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-mono">유효 아이 마진 (Eye Margin)</span>
                <span
                  className={`text-lg font-black font-mono ${
                    frameAnalysis.eyeMarginPct >= 60
                      ? 'text-emerald-400'
                      : frameAnalysis.eyeMarginPct >= 30
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {frameAnalysis.eyeMarginPct.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">실제 CPU 주파수</span>
                <span className="text-white font-bold">
                  {(clockPhysics.actualCpuFreqHz / 1000000).toFixed(4)} MHz
                </span>
                <span className="text-[10px] text-slate-400 block">
                  편차: {clockPhysics.netFrequencyDriftPct >= 0 ? '+' : ''}{clockPhysics.netFrequencyDriftPct.toFixed(2)}%
                </span>
              </div>

              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">실제 전송 보드레이트</span>
                <span className="text-white font-bold">{Math.round(usartMath.actualBaud).toLocaleString()} bps</span>
                <span
                  className={`text-[10px] font-bold block ${
                    Math.abs(usartMath.actualBaudErrorPct) > frameAnalysis.maxSafeErrorLimitPct
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  오차: {usartMath.actualBaudErrorPct >= 0 ? '+' : ''}{usartMath.actualBaudErrorPct.toFixed(2)}%
                </span>
              </div>

              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">스톱비트 누적 지연</span>
                <span className="text-white font-bold">{frameAnalysis.maxCumulativeDriftNs.toFixed(1)} ns</span>
                <span className="text-[10px] text-slate-400 block">
                  1비트의 {frameAnalysis.cumulativeDriftPctOfBit.toFixed(1)}% 이동
                </span>
              </div>
            </div>

            {/* Explanatory Diagnosis */}
            <p className="text-xs text-slate-300 leading-relaxed border-t border-slate-800/80 pt-2">
              {frameAnalysis.isFrameErrorTriggered ? (
                <span className="text-rose-300">
                  누적 클록 오차율({Math.abs(usartMath.actualBaudErrorPct).toFixed(2)}%)이 하드웨어 수신 허용 한계(±{frameAnalysis.maxSafeErrorLimitPct.toFixed(2)}%)를 초과하여,
                  수신기가 마지막 스톱 비트를 샘플링할 때 인접 비트 구간으로 밀려나 <strong>FE0(프레이밍 에러)</strong> 및 데이터 깨짐(Garbage characters)이 발생합니다.
                </span>
              ) : frameAnalysis.isTimingMarginal ? (
                <span className="text-amber-300">
                  현재 오차율({Math.abs(usartMath.actualBaudErrorPct).toFixed(2)}%)은 아슬아슬하게 통과하지만,
                  장거리 케이블의 신호 왜곡이나 슬루레이트 지연이 결합되면 패킷 드롭이 발생할 수 있습니다.
                </span>
              ) : (
                <span className="text-emerald-300">
                  클록 타이밍이 이상적인 비트 중심점(Eye Center) 부근에 완벽히 정렬되어 패킷 전송이 100% 무결하게 유지됩니다.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Interactive 10-Bit Frame Waveform & Sampling Eye Inspection */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              10비트 USART 프레임 실시간 샘플링 파형 시각화 (Waveform & Sample Points)
            </h4>
          </div>
          <span className="text-xs font-mono text-slate-400">
            1 프레임 = START(0) + 8 Data Bits + STOP(1) [8N1 표준]
          </span>
        </div>

        {/* Waveform Diagram Container */}
        <div className="space-y-3 overflow-x-auto pb-2">
          {/* Bit Cells Header */}
          <div className="grid grid-cols-10 gap-1.5 min-w-[700px]">
            {frameAnalysis.bitSamples.map((bit) => (
              <div key={bit.bitIdx} className="text-center font-mono">
                <div className="text-[10px] text-slate-400 font-bold">{bit.label}</div>
                <div
                  className={`text-xs font-bold py-1 px-2 rounded-t-lg border-t border-x ${
                    bit.bitVal === 1
                      ? 'bg-slate-800/90 text-cyan-300 border-slate-700'
                      : 'bg-slate-900/90 text-slate-400 border-slate-800'
                  }`}
                >
                  비트: {bit.bitVal}
                </div>
              </div>
            ))}
          </div>

          {/* Waveform Trace & Sampling Ticks Bar */}
          <div className="grid grid-cols-10 gap-1.5 min-w-[700px] h-20 bg-slate-900 rounded-2xl p-2 border border-slate-800 relative">
            {frameAnalysis.bitSamples.map((bit) => {
              // Calculate horizontal position percentage inside this bit cell
              const samplePct = Math.max(2, Math.min(98, bit.samplePositionInBit * 100));

              return (
                <div key={bit.bitIdx} className="relative h-full flex flex-col justify-between border-r border-slate-800/60 last:border-r-0">
                  {/* Digital Level Graphic */}
                  <div className="w-full h-1/2 flex items-center">
                    <div
                      className={`w-full h-1.5 rounded transition ${
                        bit.bitVal === 1 ? 'bg-cyan-400 shadow-sm shadow-cyan-400' : 'bg-slate-700'
                      }`}
                    />
                  </div>

                  {/* Ideal Sampling Center Guide Line (dotted line at 50%) */}
                  <div
                    style={{ left: '50%' }}
                    className="absolute top-0 bottom-0 w-0.5 border-l border-dashed border-slate-600/70 pointer-events-none"
                    title="Ideal Bit Center (50%)"
                  />

                  {/* Actual Receiver Sampling Point (Indicator Dot) */}
                  <div
                    style={{ left: `${samplePct}%` }}
                    className={`absolute top-2 bottom-2 w-1.5 rounded-full transition-all duration-300 transform -translate-x-1/2 z-10 ${
                      bit.isOutOfBounds
                        ? 'bg-rose-500 ring-4 ring-rose-500/40 animate-ping'
                        : bit.isCritical
                        ? 'bg-amber-400 ring-2 ring-amber-400/30'
                        : 'bg-emerald-400 ring-2 ring-emerald-400/30'
                    }`}
                    title={`Sample Point: ${(bit.samplePositionInBit * 100).toFixed(1)}% of bit width (Offset: ${bit.sampleOffsetFromCenterPct >= 0 ? '+' : ''}${bit.sampleOffsetFromCenterPct.toFixed(1)}%)`}
                  />

                  {/* Skew Value Label */}
                  <div className="text-[9px] font-mono text-center text-slate-400 pt-0.5">
                    {bit.sampleOffsetFromCenterPct >= 0 ? '+' : ''}{bit.sampleOffsetFromCenterPct.toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </div>

          {/* Waveform Legend & Guidance */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 pt-1">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> 이상적 안전 구간 (Center ±20%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> 임계 경고 구간 (노이즈 취약)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> 비트 슬립 / 프레이밍 에러 (인접 비트 오독)
              </span>
            </div>
            <div className="text-slate-500 font-mono text-[11px]">
              * 점선: 이상적 중심점(50%) | 막대: 실제 수신기 샘플링 위치
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Other Timing-Sensitive Signals (WS2812B & DMX512) Impact Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* WS2812B Neopixel Card */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4.5 space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              WS2812B (Neopixel) 1-Wire 타이밍 무결성
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                timingSensitiveImpact.isWs2812Violated
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
              }`}
            >
              {timingSensitiveImpact.isWs2812Violated ? '⚠️ 타이밍 규격 위반 (LED 깜빡임)' : '✅ 안정 구동'}
            </span>
          </div>

          <p className="text-slate-400 leading-relaxed text-[11px]">
            WS2812B LED는 800kHz 주파수에서 <strong>'0' 펄스폭 400ns ±150ns</strong>, <strong>'1' 펄스폭 800ns ±150ns</strong>의
            엄격한 나노초 단위 타이밍을 요구합니다.
          </p>

          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">T0H 실제 펄스폭</span>
              <span className="font-bold text-white">{timingSensitiveImpact.actualT0hNs.toFixed(1)} ns</span>
              <span className="text-[10px] text-slate-400 block">규격: 250 ~ 550 ns</span>
            </div>
            <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">T1H 실제 펄스폭</span>
              <span className="font-bold text-white">{timingSensitiveImpact.actualT1hNs.toFixed(1)} ns</span>
              <span className="text-[10px] text-slate-400 block">규격: 650 ~ 950 ns</span>
            </div>
          </div>
        </div>

        {/* DMX512 Lighting Protocol Card */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4.5 space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-400" />
              DMX512 무대 조명 통신 (250 kbps)
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                timingSensitiveImpact.isDmxViolated
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
              }`}
            >
              {timingSensitiveImpact.isDmxViolated ? '⚠️ 통신 불능 위험' : '✅ 규격 준수'}
            </span>
          </div>

          <p className="text-slate-400 leading-relaxed text-[11px]">
            DMX512는 250 kbps RS-485 기반의 직렬 프로토콜로, 연속된 512바이트 슬롯을 송수신하므로
            클록 오차 허용 범위가 <strong>±2.0% 이내</strong>로 제한됩니다. 내부 RC 발진기로는 DMX512 프로토콜을 구현할 수 없습니다.
          </p>

          <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 font-mono text-[11px] flex justify-between items-center">
            <span className="text-slate-400">DMX512 슬롯 지속시간:</span>
            <span className="text-white font-bold">4.0 µs / bit (슬롯당 44.0 µs)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
