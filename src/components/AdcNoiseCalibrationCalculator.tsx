import React, { useState, useMemo } from 'react';
import {
  Activity,
  Sliders,
  CheckCircle,
  AlertTriangle,
  Zap,
  Info,
  Copy,
  Check,
  TrendingUp,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw,
  Code2,
  Gauge
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

export interface AdcNoiseCalibrationCalculatorProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export const AdcNoiseCalibrationCalculator: React.FC<AdcNoiseCalibrationCalculatorProps> = ({
  selectedMCU
}) => {
  const profile = MCU_PROFILES[selectedMCU];

  // 1. Decoupling Capacitor & Hardware Filter
  const [arefCapacitorNf, setArefCapacitorNf] = useState<number>(100); // 100nF is standard
  const [avccDecouplingType, setAvccDecouplingType] = useState<'lc_filter' | 'rc_filter' | 'direct_vcc'>('lc_filter');

  // 2. VREF Configuration
  const [vrefType, setVrefType] = useState<'avcc' | 'internal_1v1' | 'external_aref'>('avcc');
  const [externalVrefVolts, setExternalVrefVolts] = useState<number>(3.3);
  const [systemVccVolts, setSystemVccVolts] = useState<number>(5.0);

  // 3. Sampling Frequency & Clock Prescaler
  const [systemClockMhz, setSystemClockMhz] = useState<number>(16.0);
  const [adcPrescaler, setAdcPrescaler] = useState<number>(128); // 16MHz / 128 = 125 kHz

  // 4. Environmental & PCB Digital Noise (mV RMS)
  const [pcbNoiseMv, setPcbNoiseMv] = useState<number>(4.5);
  const [useNoiseReductionSleep, setUseNoiseReductionSleep] = useState<boolean>(true);

  // 5. Calibration simulation
  const [rawOffsetLsb, setRawOffsetLsb] = useState<number>(1.8);
  const [rawGainErrorPercent, setRawGainErrorPercent] = useState<number>(0.8);

  const [copiedCode, setCopiedCode] = useState(false);

  // Effective VREF in Volts
  const effectiveVref = useMemo(() => {
    if (vrefType === 'internal_1v1') return 1.1;
    if (vrefType === 'external_aref') return externalVrefVolts;
    return systemVccVolts; // AVCC
  }, [vrefType, externalVrefVolts, systemVccVolts]);

  // ADC Clock frequency
  const adcClockKhz = useMemo(() => {
    return (systemClockMhz * 1000) / adcPrescaler;
  }, [systemClockMhz, adcPrescaler]);

  // Mathematical Model for ENOB & Noise
  const analysis = useMemo(() => {
    // 1 LSB size in µV
    const lsbMicrovolts = (effectiveVref / 1024) * 1000000;

    // Ideal Quantization noise: LSB / sqrt(12)
    const quantizationNoiseUv = lsbMicrovolts / Math.sqrt(12);

    // AREF Decoupling attenuation factor:
    // With 100nF cap: attenuation ~0.15; No cap (0nF): attenuation ~1.0; 1µF: attenuation ~0.05
    let capAttenuation = 1.0;
    if (arefCapacitorNf >= 1000) capAttenuation = 0.05;
    else if (arefCapacitorNf >= 100) capAttenuation = 0.15;
    else if (arefCapacitorNf >= 10) capAttenuation = 0.45;
    else capAttenuation = 0.95;

    // AVCC Filter attenuation:
    let avccAttenuation = 1.0;
    if (avccDecouplingType === 'lc_filter') avccAttenuation = 0.12; // 10µH + 100nF LC filter recommended in datasheet
    else if (avccDecouplingType === 'rc_filter') avccAttenuation = 0.35; // 10Ω + 100nF
    else avccAttenuation = 1.0; // Direct connection

    // Sleep mode reduction:
    // ADC Noise Reduction Sleep Mode eliminates CPU core digital switching noise during conversion
    const sleepFactor = useNoiseReductionSleep ? 0.25 : 1.0;

    // Prescaler / Frequency degradation:
    // AVR ADC is rated for 50kHz to 200kHz.
    // > 200kHz degrades S&H capacitor charging accuracy and increases noise.
    let freqDegradationFactor = 1.0;
    if (adcClockKhz <= 200) {
      freqDegradationFactor = 1.0;
    } else if (adcClockKhz <= 500) {
      freqDegradationFactor = 1.0 + ((adcClockKhz - 200) / 300) * 0.8; // up to 1.8x
    } else {
      freqDegradationFactor = 1.8 + ((adcClockKhz - 500) / 500) * 1.5; // up to 3.3x
    }

    // Coupled Analog / PCB Noise in µV
    const coupledPcbNoiseUv = (pcbNoiseMv * 1000) * capAttenuation * avccAttenuation * sleepFactor * freqDegradationFactor;

    // Total Input-Referred RMS Noise (Quadrature sum)
    const totalNoiseUvRms = Math.sqrt(Math.pow(quantizationNoiseUv, 2) + Math.pow(coupledPcbNoiseUv, 2));

    // Full-scale Signal RMS: (Vref / (2 * sqrt(2))) in µV
    const fullScaleSignalUvRms = (effectiveVref * 1000000) / (2 * Math.sqrt(2));

    // Signal to Noise Ratio (SNR in dB)
    const snrDb = 20 * Math.log10(fullScaleSignalUvRms / totalNoiseUvRms);

    // ENOB (Effective Number of Bits) = (SNR - 1.76) / 6.02
    const rawEnob = (snrDb - 1.76) / 6.02;
    const enob = Math.max(4.0, Math.min(10.0, rawEnob));

    // Noise in LSBs
    const noiseLsbRms = totalNoiseUvRms / lsbMicrovolts;

    // Quality Grade
    let grade: 'optimal' | 'good' | 'degraded' | 'poor';
    if (enob >= 9.6) grade = 'optimal';
    else if (enob >= 9.0) grade = 'good';
    else if (enob >= 7.8) grade = 'degraded';
    else grade = 'poor';

    return {
      lsbMicrovolts,
      quantizationNoiseUv,
      coupledPcbNoiseUv,
      totalNoiseUvRms,
      snrDb,
      enob,
      noiseLsbRms,
      grade,
      freqDegradationFactor
    };
  }, [
    effectiveVref,
    arefCapacitorNf,
    avccDecouplingType,
    useNoiseReductionSleep,
    adcClockKhz,
    pcbNoiseMv
  ]);

  // C Calibration and Oversampling Code Snippet
  const generatedCCode = useMemo(() => {
    return `// ============================================================================
// AVR ${profile.name} 10-bit ADC 저노이즈 샘플링 & 2점 보정 C 코드
// VREF: ${effectiveVref}V (1 LSB = ${analysis.lsbMicrovolts.toFixed(1)} µV)
// ADC 클럭: ${adcClockKhz.toFixed(1)} kHz (Prescaler 1:${adcPrescaler}) -> ENOB: ${analysis.enob.toFixed(2)} 비트
// ============================================================================
#include <avr/io.h>
#include <avr/sleep.h>
#include <avr/interrupt.h>

// 2점 캘리브레이션 파라미터 (오프셋 & 게인 계수)
#define ADC_OFFSET_RAW   ${rawOffsetLsb.toFixed(1)}f   // 측정된 오프셋 오차 (LSB)
#define ADC_GAIN_FACTOR  ${(1 - rawGainErrorPercent / 100).toFixed(4)}f // 게인 보정 배율

void adc_init(void) {
    // 1. 기준전압 및 채널 선택 (ADMUX)
${vrefType === 'avcc' ? '    ADMUX = (1 << REFS0); // AVCC 기준 (AREF 100nF 커패시터 연결)' : vrefType === 'internal_1v1' ? '    ADMUX = (1 << REFS1) | (1 << REFS0); // 내부 1.1V Bandgap 기준' : '    ADMUX = 0x00; // 외부 AREF 핀 정밀 기준전압'}
    // 2. ADC 인에이블 & 분주비 설정 (ADCSRA)
    ADCSRA = (1 << ADEN) | (1 << ADIE) | (${adcPrescaler === 128 ? '(1 << ADPS2) | (1 << ADPS1) | (1 << ADPS0)' : adcPrescaler === 64 ? '(1 << ADPS2) | (1 << ADPS1)' : '(1 << ADPS2)'});
}

// ADC 노이즈 리덕션 슬립 모드로 1회 고정밀 변환
uint16_t adc_read_low_noise(uint8_t channel) {
    ADMUX = (ADMUX & 0xF0) | (channel & 0x0F);
    set_sleep_mode(SLEEP_MODE_ADC);
    sleep_enable();
    sei();
    sleep_cpu(); // CPU 정지 -> ADC 변환 완료 인터럽트로 기상
    sleep_disable();
    return ADC;
}

// 4배 오버샘플링 및 캘리브레이션 보정 (11-bit 유효 해상도 달성)
float adc_read_calibrated_millivolts(uint8_t channel) {
    uint32_t sum = 0;
    for (int i = 0; i < 16; i++) { // 16회 누적 = +2비트 해상도 향상
        sum += adc_read_low_noise(channel);
    }
    float raw_12bit = (float)sum / 4.0f; // 4로 나누어 12비트 스케일화
    
    // 오프셋 및 게인 2점 보정 적용
    float calibrated_counts = (raw_12bit - (ADC_OFFSET_RAW * 4.0f)) * ADC_GAIN_FACTOR;
    if (calibrated_counts < 0) calibrated_counts = 0;

    // 밀리볼트(mV) 단위 전압 산출
    return (calibrated_counts / 4096.0f) * (${(effectiveVref * 1000).toFixed(1)}f);
}`;
  }, [profile.name, effectiveVref, analysis, adcClockKhz, adcPrescaler, vrefType, rawOffsetLsb, rawGainErrorPercent]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg font-bold text-white tracking-wide">
                ADC Noise Reduction & Calibration Calculator
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold">
                ENOB & 캘리브레이션 시뮬레이터
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                {profile.fullName} (10-bit SAR ADC)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              디커플링 커패시터, VREF 기준전압, 샘플링 클럭 및 PCB 잡음이 ADC의 유효 비트수(ENOB)에 미치는 영향을 시뮬레이션하고 2점 보정 파라미터를 도출합니다.
            </p>
          </div>
        </div>

        {/* Quick Result Pill */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-right min-w-[180px]">
          <span className="text-[11px] text-slate-400 font-mono block">유효 해상도 (ENOB)</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">
            {analysis.enob.toFixed(2)} <span className="text-xs text-slate-400 font-normal">/ 10 Bits</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">SNR: {analysis.snrDb.toFixed(1)} dB (오차: {analysis.noiseLsbRms.toFixed(2)} LSB)</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block font-medium">1 LSB 분해능 전압</span>
          <div className="text-lg font-bold font-mono text-cyan-300 mt-1">
            {analysis.lsbMicrovolts.toFixed(1)} <span className="text-xs text-slate-400 font-normal">µV</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">
            VREF {effectiveVref.toFixed(2)}V / 1024 스텝
          </span>
        </div>

        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block font-medium">ADC 샘플링 클럭</span>
          <div className={`text-lg font-bold font-mono mt-1 ${adcClockKhz > 200 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {adcClockKhz.toFixed(1)} <span className="text-xs text-slate-400 font-normal">kHz</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">
            {adcClockKhz <= 200 ? '정격 권장 범위 (50~200kHz)' : '주의: 200kHz 초과로 정확도 저하'}
          </span>
        </div>

        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block font-medium">총 노이즈 전압 (RMS)</span>
          <div className="text-lg font-bold font-mono text-indigo-300 mt-1">
            {analysis.totalNoiseUvRms.toFixed(1)} <span className="text-xs text-slate-400 font-normal">µV</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">
            양자화 {analysis.quantizationNoiseUv.toFixed(0)}µV + 결합 {analysis.coupledPcbNoiseUv.toFixed(0)}µV
          </span>
        </div>

        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block font-medium">노이즈 억제 등급</span>
          <div className="text-lg font-bold font-mono mt-1 text-emerald-400">
            {analysis.grade === 'optimal' ? '최적 (Optimal)' : analysis.grade === 'good' ? '우수 (Good)' : analysis.grade === 'degraded' ? '보통 (Degraded)' : '불량 (Poor)'}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">
            {useNoiseReductionSleep ? 'ADC 슬립 모드 켜짐' : '일반 모드 (디지털 노이즈 노출)'}
          </span>
        </div>
      </div>

      {/* Interactive Parameter Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Hardware Decoupling & VREF */}
        <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white">디커플링 커패시터 & VREF 설정</h4>
          </div>

          <div className="space-y-3 text-xs">
            {/* AREF Decoupling Capacitor */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-300 font-semibold">AREF 핀 디커플링 커패시터 용량</label>
                <span className="font-mono text-cyan-400 font-bold">{arefCapacitorNf} nF</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[0, 10, 100, 1000].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setArefCapacitorNf(c)}
                    className={`py-1.5 rounded-lg font-mono border text-center transition-all ${
                      arefCapacitorNf === c
                        ? 'bg-cyan-600 text-white border-cyan-500 shadow'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {c === 0 ? '없음 (0nF)' : c === 1000 ? '1 µF' : `${c} nF`}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {arefCapacitorNf === 100 ? '✅ 데이터시트 표준 권장치 (고주파 노이즈 85% 억제)' : arefCapacitorNf === 0 ? '⚠️ 커패시터 미연결 시 VREF 전압 흔들림으로 ENOB 급락' : '대용량 필터링'}
              </span>
            </div>

            {/* AVCC Filter Type */}
            <div>
              <label className="text-slate-300 font-semibold block mb-1">AVCC 전원 필터링 방식</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setAvccDecouplingType('lc_filter')}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    avccDecouplingType === 'lc_filter'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  LC 필터 (10µH + 100nF)
                  <span className="text-[10px] text-slate-400 font-normal block mt-0.5">데이터시트 표준 권장</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAvccDecouplingType('rc_filter')}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    avccDecouplingType === 'rc_filter'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  RC 필터 (10Ω + 100nF)
                  <span className="text-[10px] text-slate-400 font-normal block mt-0.5">간이 저역통과 필터</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAvccDecouplingType('direct_vcc')}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    avccDecouplingType === 'direct_vcc'
                      ? 'bg-rose-950/60 border-rose-500 text-white font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  VCC 직결 (필터 없음)
                  <span className="text-[10px] text-slate-400 font-normal block mt-0.5">디지털 잡음 유입</span>
                </button>
              </div>
            </div>

            {/* VREF Source */}
            <div>
              <label className="text-slate-300 font-semibold block mb-1">기준전압 (VREF Source)</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setVrefType('avcc')}
                  className={`py-1.5 px-2 rounded-lg border text-center font-mono ${
                    vrefType === 'avcc' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  AVCC ({systemVccVolts.toFixed(1)}V)
                </button>
                <button
                  type="button"
                  onClick={() => setVrefType('internal_1v1')}
                  className={`py-1.5 px-2 rounded-lg border text-center font-mono ${
                    vrefType === 'internal_1v1' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  내부 1.1V Bandgap
                </button>
                <button
                  type="button"
                  onClick={() => setVrefType('external_aref')}
                  className={`py-1.5 px-2 rounded-lg border text-center font-mono ${
                    vrefType === 'external_aref' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  외장 AREF ({externalVrefVolts.toFixed(1)}V)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Prescaler & Noise Source */}
        <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white">ADC 분주비 & 잡음 환경</h4>
          </div>

          <div className="space-y-3 text-xs">
            {/* Prescaler Selection */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-300 font-semibold">ADC 클럭 분주비 (Prescaler)</label>
                <span className="font-mono text-emerald-400 font-bold">1:{adcPrescaler} ({adcClockKhz.toFixed(1)} kHz)</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[16, 32, 64, 128].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAdcPrescaler(p)}
                    className={`py-1.5 rounded-lg font-mono border text-center ${
                      adcPrescaler === p
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    1:{p} ({(systemClockMhz * 1000 / p).toFixed(0)}k)
                  </button>
                ))}
              </div>
            </div>

            {/* ADC Sleep Mode Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div>
                <div className="font-semibold text-slate-200">ADC 노이즈 리덕션 슬립 모드 (SLEEP_MODE_ADC)</div>
                <div className="text-[10px] text-slate-400">변환 중 CPU 코어 클럭을 정지하여 디지털 스위칭 잡음 차단</div>
              </div>
              <input
                type="checkbox"
                checked={useNoiseReductionSleep}
                onChange={e => setUseNoiseReductionSleep(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* PCB Digital Noise Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-300 font-semibold">PCB 전원/신호 노이즈 레벨</label>
                <span className="font-mono text-amber-400 font-bold">{pcbNoiseMv} mV RMS</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="30"
                step="0.5"
                value={pcbNoiseMv}
                onChange={e => setPcbNoiseMv(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                스위칭 레귤레이터 리플 및 인접 고속 디지털 버스(SPI/PWM) 결합 노이즈
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* C Code Generation */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white">저노이즈 슬립 샘플링 & 2점 보정 C 코드</h4>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow transition-all"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedCode ? '복사 완료!' : '코드 복사'}
          </button>
        </div>

        <pre className="bg-slate-900/90 text-slate-200 font-mono text-xs p-3.5 rounded-xl border border-slate-800 overflow-x-auto leading-relaxed max-h-56 custom-scrollbar">
          {generatedCCode}
        </pre>
      </div>
    </div>
  );
};
