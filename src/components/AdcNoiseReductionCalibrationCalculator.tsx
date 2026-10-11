import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Activity,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Zap,
  Sparkles,
  TrendingDown,
  Layers,
  Info,
  Copy,
  Check,
  ShieldCheck,
  RefreshCw,
  Gauge,
  Scale
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type VrefConfigType = 'avcc_5v' | 'avcc_3v3' | 'internal_1v1' | 'internal_2v56' | 'external_aref';

export const AdcNoiseReductionCalibrationCalculator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // User Interactive Parameters
  const [vrefConfig, setVrefConfig] = useState<VrefConfigType>('avcc_5v');
  const [customArefVolt, setCustomArefVolt] = useState<number>(4.096);
  const [decouplingCapNf, setDecouplingCapNf] = useState<number>(100); // 0 (none), 10nF, 100nF (standard 0.1uF), 1000nF (1uF), 10000nF (10uF)
  const [samplingFrequencyKhz, setSamplingFrequencyKhz] = useState<number>(125); // 15.6 kHz to 1000 kHz
  const [pcbLayoutNoiseMv, setPcbLayoutNoiseMv] = useState<number>(2.5); // 0.5mV (quiet 4-layer) to 15mV (noisy breadboard)
  const [enableSleepNoiseReduction, setEnableSleepNoiseReduction] = useState<boolean>(true); // ADC Noise Reduction Sleep Mode (SMCR)
  const [enablePcbGuardRing, setEnablePcbGuardRing] = useState<boolean>(true); // Ground shield trace around AREF
  const [useAvccLcFilter, setUseAvccLcFilter] = useState<boolean>(true); // 10uH inductor + 100nF cap on AVCC

  // Calibration parameters
  const [calibratedOffsetMv, setCalibratedOffsetMv] = useState<number>(1.2); // offset error in mV
  const [calibratedGainErrorPercent, setCalibratedGainErrorPercent] = useState<number>(0.3); // gain error %
  const [applySoftwareCalibration, setApplySoftwareCalibration] = useState<boolean>(true);

  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // VREF Voltage extraction
  const nominalVref = useMemo(() => {
    switch (vrefConfig) {
      case 'avcc_5v': return 5.0;
      case 'avcc_3v3': return 3.3;
      case 'internal_1v1': return 1.1;
      case 'internal_2v56': return 2.56;
      case 'external_aref': return customArefVolt;
      default: return 5.0;
    }
  }, [vrefConfig, customArefVolt]);

  // VREF description & hardware noise characteristic
  const vrefSpecs = useMemo(() => {
    switch (vrefConfig) {
      case 'internal_1v1':
        return {
          name: '내부 1.1V Bandgap 기준전압',
          driftPpm: '40 ppm/°C (온도 안정성 우수)',
          baseRippleMv: 0.8,
          admuxBits: 'REFS1=1, REFS0=1',
          desc: 'VCC 전원 노이즈와 완전히 격리된 밴드갭 전압원. 미약한 센서(열전대, 션트) 측정에 최적.'
        };
      case 'internal_2v56':
        return {
          name: '내부 2.56V 정밀 기준전압',
          driftPpm: '50 ppm/°C',
          baseRippleMv: 1.0,
          admuxBits: 'REFS1=1, REFS0=1',
          desc: 'ATmega128 / ATmega640 전용 고정밀 밴드갭 전압.'
        };
      case 'external_aref':
        return {
          name: '외부 정밀 션트/LDO AREF (예: LM4040, REF3040)',
          driftPpm: '10 ppm/°C (초저 드리프트)',
          baseRippleMv: 0.3,
          admuxBits: 'REFS1=0, REFS0=0',
          desc: '외부 전용 0.1% 정밀 전압 레퍼런스 IC 연결.'
        };
      case 'avcc_3v3':
        return {
          name: 'AVCC (3.3V 아날로그 전원)',
          driftPpm: '전원 레귤레이터 의존',
          baseRippleMv: 4.5,
          admuxBits: 'REFS1=0, REFS0=1',
          desc: '3.3V 시스템 전원을 레퍼런스로 활용.'
        };
      case 'avcc_5v':
      default:
        return {
          name: 'AVCC (5.0V 표준 전원)',
          driftPpm: 'USB / 5V SMPS 전원 리플 직결 (리플 취약)',
          baseRippleMv: 6.0,
          admuxBits: 'REFS1=0, REFS0=1',
          desc: '기본 설정. USB 5V 리플 노이즈가 ADC 측정값에 직접 전달되므로 LC 필터 필수.'
        };
    }
  }, [vrefConfig]);

  // Physics Simulation: Calculate Noise, SNR, and ENOB
  const simulation = useMemo(() => {
    const lsbMv = (nominalVref * 1000) / 1024; // 10-bit theoretical LSB in mV

    // 1. Decoupling capacitor attenuation factor on AREF:
    // C_aref = 100nF is standard. Below 10nF gives very poor noise rejection.
    let capAttenuation = 1.0;
    if (decouplingCapNf === 0) capAttenuation = 3.5; // No cap -> severe high freq pickup
    else if (decouplingCapNf < 50) capAttenuation = 1.8;
    else if (decouplingCapNf === 100) capAttenuation = 1.0; // standard baseline
    else if (decouplingCapNf <= 1000) capAttenuation = 0.75; // 1uF ceramic
    else capAttenuation = 0.65; // 10uF tantalum / low ESR ceramic

    // 2. VREF Ripple Noise (mV RMS)
    let vrefNoiseRms = vrefSpecs.baseRippleMv * capAttenuation;
    if (useAvccLcFilter && (vrefConfig === 'avcc_5v' || vrefConfig === 'avcc_3v3')) {
      vrefNoiseRms *= 0.35; // 10uH LC filter suppresses 65% of switching power supply noise
    }

    // 3. Sampling frequency impact on ADC conversion accuracy:
    // AVR 10-bit SAR ADC spec requires ADC clock between 50kHz and 200kHz.
    // If sampling frequency is above 200kHz, Sample/Hold cannot settle, increasing noise & non-linearity.
    let freqPenaltyFactor = 1.0;
    if (samplingFrequencyKhz > 200) {
      // Overclocked SAR ADC degrades dramatically
      const overRatio = samplingFrequencyKhz / 200;
      freqPenaltyFactor = 1.0 + (overRatio - 1) * 2.2;
    } else if (samplingFrequencyKhz < 50) {
      // Below 50kHz: leakage currents on internal sample capacitor degrade resolution
      const underRatio = 50 / Math.max(10, samplingFrequencyKhz);
      freqPenaltyFactor = 1.0 + (underRatio - 1) * 0.8;
    }

    // 4. PCB layout and digital switching noise impact:
    let envNoiseRms = pcbLayoutNoiseMv;
    if (enableSleepNoiseReduction) {
      envNoiseRms *= 0.35; // Sleep mode turns off CPU core clock, reducing digital noise by ~65%
    }
    if (enablePcbGuardRing) {
      envNoiseRms *= 0.70; // Guard ring trace blocks capacitive crosstalk from digital traces
    }

    // 5. Total Effective Input-Referred RMS Noise:
    // sqrt(Vref_noise^2 + Env_noise^2 + Quantization_noise^2)
    const quantizationNoiseRms = lsbMv / Math.sqrt(12); // theoretical q-noise
    const analogNoiseRms = Math.sqrt(vrefNoiseRms ** 2 + envNoiseRms ** 2) * freqPenaltyFactor;
    const totalNoiseRmsMv = Math.sqrt(quantizationNoiseRms ** 2 + analogNoiseRms ** 2);

    // 6. Signal-to-Noise Ratio (SNR) in dB for full-scale sinewave:
    // SNR = 20 * log10( (Vref / (2 * sqrt(2))) / (totalNoiseRms / 1000) )
    const signalRmsVolts = nominalVref / (2 * Math.SQRT2);
    const noiseVolts = totalNoiseRmsMv / 1000;
    const snrDb = Math.max(10, 20 * Math.log10(signalRmsVolts / Math.max(0.00001, noiseVolts)));

    // 7. Effective Number of Bits (ENOB):
    // ENOB = (SNR - 1.76) / 6.02
    let calculatedEnob = Math.max(4.0, Math.min(10.0, (snrDb - 1.76) / 6.02));

    // Calibration benefit:
    let calibratedEnob = calculatedEnob;
    if (applySoftwareCalibration) {
      // Offset and gain calibration eliminates systematic DC transfer curve distortion
      calibratedEnob = Math.min(10.0, calculatedEnob + 0.35);
    }

    // Noise in counts (peak-to-peak counts):
    const noiseLsbCounts = totalNoiseRmsMv / lsbMv;
    const peakToPeakCounts = Math.round(noiseLsbCounts * 6.6); // 99.9% confidence interval peak-to-peak

    const isFrequencyOptimal = samplingFrequencyKhz >= 50 && samplingFrequencyKhz <= 200;
    const isCapSufficient = decouplingCapNf >= 100;

    return {
      lsbMv: parseFloat(lsbMv.toFixed(3)),
      totalNoiseRmsMv: parseFloat(totalNoiseRmsMv.toFixed(3)),
      snrDb: parseFloat(snrDb.toFixed(2)),
      enob: parseFloat(calibratedEnob.toFixed(2)),
      rawEnob: parseFloat(calculatedEnob.toFixed(2)),
      peakToPeakCounts,
      isFrequencyOptimal,
      isCapSufficient
    };
  }, [
    nominalVref,
    vrefConfig,
    vrefSpecs,
    decouplingCapNf,
    samplingFrequencyKhz,
    pcbLayoutNoiseMv,
    enableSleepNoiseReduction,
    enablePcbGuardRing,
    useAvccLcFilter,
    applySoftwareCalibration
  ]);

  // C Calibration Code Generator
  const generatedCalibrationCode = useMemo(() => {
    return `// ==============================================================================
// ${currentProfile.name} ADC 정밀 노이즈 억제 & 소프트웨어 2점 캘리브레이션 루틴
// VREF Config: ${vrefSpecs.name} (${nominalVref}V)
// Decoupling : ${decouplingCapNf}nF on AREF pin | ADC Clock: ${samplingFrequencyKhz}kHz
// Projected ENOB: ${simulation.enob} bits (SNR: ${simulation.snrDb} dB)
// ==============================================================================
#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/sleep.h>

// 캘리브레이션 튜닝 계수
#define ADC_OFFSET_MV          (${calibratedOffsetMv.toFixed(2)}f)
#define ADC_GAIN_CORRECTION    (${((1.0 - (calibratedGainErrorPercent / 100))).toFixed(4)}f)
#define VREF_VOLTAGE_MV        (${((nominalVref * 1000)).toFixed(1)}f)

void adc_low_noise_init(void) {
    // 1. 기준전압 및 채널 초기화 (${vrefSpecs.admuxBits})
    ADMUX = ${vrefConfig === 'internal_1v1' || vrefConfig === 'internal_2v56' ? '(1 << REFS1) | (1 << REFS0)' : vrefConfig === 'external_aref' ? '0x00' : '(1 << REFS0)'};

    // 2. ADC 클럭 분주비 설정 (${samplingFrequencyKhz}kHz) 및 인터럽트 활성화
    ADCSRA = (1 << ADEN) | (1 << ADIE) | ${samplingFrequencyKhz <= 125 ? '(1 << ADPS2) | (1 << ADPS1) | (1 << ADPS0)' : '(1 << ADPS2) | (1 << ADPS1)'};

    // 3. 미사용 디지털 입력 버퍼 차단 (DIDR0로 전력 및 노이즈 절감)
    DIDR0 = 0x3F; // ADC0~ADC5 디지털 버퍼 Disable
}

// ADC Noise Reduction Sleep Mode를 활용한 초저노이즈 샘플링 루틴
uint16_t adc_read_low_noise_sleep(uint8_t channel) {
    ADMUX = (ADMUX & 0xF0) | (channel & 0x0F);

    // 슬립 모드 진입 즉시 CPU 코어 클럭 정지 및 ADC 변환 개시
    set_sleep_mode(SLEEP_MODE_ADC);
    sleep_enable();
    sei();
    sleep_cpu();
    sleep_disable();

    return ADC;
}

// 측정된 원시 ADC 카운트를 밀리볼트(mV)로 보정 변환하는 캘리브레이션 함수
float adc_to_calibrated_millivolts(uint16_t raw_counts) {
    float raw_mv = ((float)raw_counts / 1024.0f) * VREF_VOLTAGE_MV;
    // 오프셋 제거 및 게인 오차 정밀 보정
    float calibrated_mv = (raw_mv - ADC_OFFSET_MV) * ADC_GAIN_CORRECTION;
    return (calibrated_mv < 0.0f) ? 0.0f : calibrated_mv;
}

ISR(ADC_vect) {
    // ADC 노이즈 리덕션 슬립 모드에서 CPU를 깨우기 위한 빈 ISR 핸들러
}
`;
  }, [
    currentProfile.name,
    vrefSpecs,
    nominalVref,
    decouplingCapNf,
    samplingFrequencyKhz,
    simulation.enob,
    simulation.snrDb,
    calibratedOffsetMv,
    calibratedGainErrorPercent,
    vrefConfig
  ]);

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCalibrationCode);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.3 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Title Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <Activity className="w-3.5 h-3.5" /> ADC Noise Reduction & Calibration Calculator
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              MCU: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-mono">
              10-bit SAR Engine
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            ADC 노이즈 리덕션 & 유효 비트수(ENOB) 캘리브레이션 계산기
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            디커플링 커패시터(C_AREF), 기준전압(VREF) 소스, 샘플링 클럭 주파수 및 PCB 노이즈 환경이
            ADC의 유효 비트수(ENOB)와 신호 대 잡음비(SNR)에 미치는 영향을 정밀 시뮬레이션하고,
            오프셋/게인 오차를 제거하는 C 캘리브레이션 펌웨어를 자동 산출합니다.
          </p>
        </div>

        {/* Copy Action */}
        <button
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-cyan-500/20 shrink-0"
        >
          {copiedCode ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
          <span>{copiedCode ? 'C 드라이버 복사 완료' : '노이즈 억제 C 코드 복사'}</span>
        </button>
      </div>

      {/* Hero Performance Overview Banner: ENOB & SNR Gauge */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 border border-cyan-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>ADC 유효 분해능(ENOB) 및 신호 충실도 종합 결과</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  simulation.enob >= 9.2
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : simulation.enob >= 8.0
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  {simulation.enob >= 9.2 ? '최상급 정밀도' : simulation.enob >= 8.0 ? '양호한 측정' : '노이즈 오염 심각'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                10비트 물리 분해능 중 노이즈 없이 신뢰할 수 있는 실효 유효 비트(ENOB) 비율
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-900/80 px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">신호 대 잡음비 (SNR):</span>
            <span className="text-cyan-400 font-bold text-sm">{simulation.snrDb} dB</span>
          </div>
        </div>

        {/* 2 Big Visual Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gauge 1: ENOB Bar */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-cyan-500/30 space-y-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-emerald-400" /> 유효 비트수 (ENOB):
              </span>
              <span className="text-emerald-400 font-bold text-base">
                {simulation.enob} / 10.0 <span className="text-xs text-slate-500">Bits</span>
              </span>
            </div>

            <div className="h-3.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative flex">
              <div
                className={`transition-all duration-700 ${
                  simulation.enob >= 9.0 ? 'bg-emerald-500' : simulation.enob >= 8.0 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${(simulation.enob / 10.0) * 100}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
              <span>하드웨어 이론 한계: 10 Bits</span>
              <span className="text-slate-300 font-mono">
                노이즈로 상실된 분해능: <strong className="text-rose-400">-{(10.0 - simulation.enob).toFixed(2)} Bits</strong>
              </span>
            </div>
          </div>

          {/* Gauge 2: RMS Noise & LSB Step */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" /> 총 입력 등가 노이즈 (Total RMS Noise):
              </span>
              <span className="text-amber-400 font-bold text-base">
                {simulation.totalNoiseRmsMv} mV <span className="text-xs text-slate-500">RMS</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-slate-400">
              <div className="bg-slate-900/60 p-2 rounded border border-slate-800 flex justify-between">
                <span>1 LSB 전압 스텝:</span>
                <span className="text-white font-bold">{simulation.lsbMv} mV</span>
              </div>
              <div className="bg-slate-900/60 p-2 rounded border border-slate-800 flex justify-between">
                <span>피크-피크 플리커:</span>
                <span className="text-amber-300 font-bold">±{simulation.peakToPeakCounts} Counts</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Inputs Configuration Form (Left 5 cols) & Hardware Topology Details (Right 7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Parameters (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">기준전압 & 아날로그 하드웨어 파라미터</h3>
          </div>

          {/* 1. VREF Mode */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">기준전압(VREF) 소스 구성</label>
            <select
              value={vrefConfig}
              onChange={(e) => setVrefConfig(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
            >
              <option value="avcc_5v">AVCC 5.0V 전원 직결 (표준 Uno/Mega)</option>
              <option value="avcc_3v3">AVCC 3.3V 전원 직결 (3.3V 시스템)</option>
              <option value="internal_1v1">내부 1.1V Bandgap 정밀 전압원</option>
              {selectedMCU !== 'atmega328p' && (
                <option value="internal_2v56">내부 2.56V Bandgap 전압원 (128/640)</option>
              )}
              <option value="external_aref">외부 전용 정밀 AREF IC (션트/LDO 레퍼런스)</option>
            </select>
            <p className="text-[10px] text-slate-500 mt-1 leading-snug font-sans">
              {vrefSpecs.desc}
            </p>
          </div>

          {vrefConfig === 'external_aref' && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">외부 레퍼런스 전압값 (V):</span>
                <span className="text-cyan-400 font-bold font-mono">{customArefVolt} V</span>
              </div>
              <input
                type="number"
                step="0.001"
                min="1.0"
                max="5.5"
                value={customArefVolt}
                onChange={(e) => setCustomArefVolt(parseFloat(e.target.value) || 4.096)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
              />
            </div>
          )}

          {/* 2. Decoupling Capacitor on AREF */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1 font-medium">
              <span className="text-slate-400">AREF 핀 디커플링 커패시터 (C_AREF):</span>
              <span className="text-emerald-400 font-bold font-mono">
                {decouplingCapNf === 0 ? '미장착 (None)' : decouplingCapNf >= 1000 ? `${decouplingCapNf / 1000} µF` : `${decouplingCapNf} nF`}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1 text-xs font-mono">
              {[0, 10, 100, 1000, 10000].map((cap) => (
                <button
                  key={cap}
                  type="button"
                  onClick={() => setDecouplingCapNf(cap)}
                  className={`py-1.5 rounded-lg border font-bold transition text-center ${
                    decouplingCapNf === cap
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cap === 0 ? '0' : cap >= 1000 ? `${cap / 1000}µF` : `${cap}nF`}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              권장: 100nF(0.1µF) 세라믹 커패시터. 노이즈 바이패스 및 SAR 스위칭 전하 보충 역할 수행.
            </span>
          </div>

          {/* 3. ADC Sampling Clock Frequency */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1 font-medium">
              <span className="text-slate-400">ADC 클럭 주파수 (Sampling Clock):</span>
              <span className={`font-mono font-bold ${simulation.isFrequencyOptimal ? 'text-cyan-400' : 'text-rose-400'}`}>
                {samplingFrequencyKhz} kHz {!simulation.isFrequencyOptimal && '(규격 초과/미달)'}
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="500"
              step="5"
              value={samplingFrequencyKhz}
              onChange={(e) => setSamplingFrequencyKhz(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>50 kHz (하한)</span>
              <span className="text-emerald-400 font-bold">125 kHz (10-bit 최적값)</span>
              <span>200 kHz (상한)</span>
            </div>
          </div>

          {/* 4. PCB & Hardware Noise Protection Toggles */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs">
            <span className="text-[11px] font-bold text-slate-400 block">하드웨어 노이즈 억제 대책:</span>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enableSleepNoiseReduction}
                onChange={(e) => setEnableSleepNoiseReduction(e.target.checked)}
                className="accent-cyan-500 rounded"
              />
              <span>ADC Noise Reduction 슬립 모드 활용 (CPU 코어 클럭 차단)</span>
            </label>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={useAvccLcFilter}
                onChange={(e) => setUseAvccLcFilter(e.target.checked)}
                className="accent-cyan-500 rounded"
              />
              <span>AVCC 전원 LC 필터 적용 (10µH 인덕터 + 100nF 커패시터)</span>
            </label>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enablePcbGuardRing}
                onChange={(e) => setEnablePcbGuardRing(e.target.checked)}
                className="accent-cyan-500 rounded"
              />
              <span>AREF 핀 주변 PCB 접지 가드 링(GND Guard Ring) 패턴 적용</span>
            </label>
          </div>
        </div>

        {/* Right: Calibration & Hardware Diagnostics (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Software Calibration Settings Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">소프트웨어 2점 캘리브레이션 튜닝</h3>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={applySoftwareCalibration}
                  onChange={(e) => setApplySoftwareCalibration(e.target.checked)}
                  className="accent-emerald-500 rounded"
                />
                <span>보정 알고리즘 적용 (+0.35 ENOB 향상)</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">영점 오프셋 오차 (Zero Offset in mV)</label>
                <input
                  type="number"
                  step="0.1"
                  value={calibratedOffsetMv}
                  onChange={(e) => setCalibratedOffsetMv(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">0V 입력 시 측정되는 잔여 오프셋</span>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">풀스케일 게인 오차 (Gain Error %)</label>
                <input
                  type="number"
                  step="0.05"
                  value={calibratedGainErrorPercent}
                  onChange={(e) => setCalibratedGainErrorPercent(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">VREF 전압 분압비 기울기 오차</span>
              </div>
            </div>

            {/* Circuit Hardware Analysis Advice */}
            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1.5 font-sans leading-relaxed">
              <span className="font-bold text-cyan-400 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> 회로 노이즈 차단 가이드:
              </span>
              <ul className="text-[11px] text-slate-400 space-y-0.5 list-disc list-inside">
                <li>AREF 핀의 디커플링 커패시터(C_AREF)는 반드시 MCU 핀과 최단 거리(1mm 이내)에 배치하고 비아(Via)를 최소화해야 합니다.</li>
                <li>디지털 SPI/PWM 신호선이 AREF 및 아날로그 입력 트레이스 하부를 가로지르면 용량성 커플링으로 인해 ENOB가 최대 2비트 이상 손실됩니다.</li>
                <li>ADC 변환 중에는 <code>SLEEP_MODE_ADC</code>를 호출하여 CPU 코어의 고주파 스위칭 노이즈를 차단하는 것이 가장 효과적입니다.</li>
              </ul>
            </div>
          </div>

          {/* Quick Benchmark Comparison Table */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
            <span className="text-xs font-bold text-white block">
              기준전압 모드별 노이즈 및 ENOB 비교 매트릭스
            </span>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono text-center">
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400 font-sans">AVCC (5V 일반)</div>
                <div className="text-white font-bold text-sm mt-0.5">~8.2 Bits</div>
                <div className="text-[10px] text-slate-500">USB 리플 영향 큼</div>
              </div>

              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400 font-sans">내부 1.1V Bandgap</div>
                <div className="text-emerald-400 font-bold text-sm mt-0.5">~9.4 Bits</div>
                <div className="text-[10px] text-emerald-500">전원 노이즈 격리</div>
              </div>

              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400 font-sans">외부 정밀 AREF IC</div>
                <div className="text-cyan-400 font-bold text-sm mt-0.5">~9.8 Bits</div>
                <div className="text-[10px] text-cyan-500">초저 드리프트 최고 성능</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
