import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Activity,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Download,
  Info,
  Sparkles,
  Zap,
  Cpu,
  Layers,
  ArrowRight,
  Code2,
  TrendingUp,
  Gauge,
  ShieldCheck,
  Radio,
  FileCode2,
  RotateCcw,
  Play,
  BarChart2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type VrefType = 'avcc' | 'internal' | 'aref_ext';
export type NoiseSourceType = 'gaussian' | 'mains_hum' | 'switching_ripple';

export interface AdcPreset {
  id: string;
  name: string;
  tag: string;
  desc: string;
  inputVoltage: number;
  vrefType: VrefType;
  vrefVoltage: number;
  noiseRmsMv: number;
  noiseType: NoiseSourceType;
  oversampleBits: number; // 0 (10-bit), 1 (11-bit), 2 (12-bit), 3 (13-bit), 4 (14-bit)
  useSleepNoiseReduction: boolean;
}

const ADC_PRESETS: AdcPreset[] = [
  {
    id: 'ntc_temp',
    name: '정밀 NTC 서미스터 온도 측정 (12-bit ENOB)',
    tag: '12-bit 정밀',
    desc: '2.5V 분압 신호에 16x(4^2) 오버샘플링 적용하여 0.05°C 정밀 분해능 달성',
    inputVoltage: 2.50,
    vrefType: 'avcc',
    vrefVoltage: 5.0,
    noiseRmsMv: 4.8,
    noiseType: 'gaussian',
    oversampleBits: 2,
    useSleepNoiseReduction: true
  },
  {
    id: 'battery_monitor',
    name: 'Li-Ion 배터리 셀 잔량 모니터링 (11-bit)',
    tag: '11-bit 저노이즈',
    desc: '3.7V 배터리 전압을 4x 오버샘플링하여 양자화 노이즈 억제 및 안정적 충전 레벨 감지',
    inputVoltage: 3.70,
    vrefType: 'avcc',
    vrefVoltage: 5.0,
    noiseRmsMv: 2.2,
    noiseType: 'gaussian',
    oversampleBits: 1,
    useSleepNoiseReduction: false
  },
  {
    id: 'industrial_motor',
    name: '고잡음 인버터/모터 환경 센서 (13-bit)',
    tag: '13-bit 고노이즈',
    desc: '64x(4^3) 오버샘플링과 ADC Sleep 모드로 18mV RMS 스위칭 노이즈를 상쇄',
    inputVoltage: 1.65,
    vrefType: 'avcc',
    vrefVoltage: 3.3,
    noiseRmsMv: 18.5,
    noiseType: 'switching_ripple',
    oversampleBits: 3,
    useSleepNoiseReduction: true
  },
  {
    id: 'precision_loadcell',
    name: '초정밀 로드셀 / 압력 센서 (14-bit, Vref 1.1V)',
    tag: '14-bit 극정밀',
    desc: '내부 1.1V 밴드갭 기준 전압과 256x 오버샘플링으로 마이크로볼트 단위 미세 전압 검출',
    inputVoltage: 0.75,
    vrefType: 'internal',
    vrefVoltage: 1.1,
    noiseRmsMv: 1.5,
    noiseType: 'gaussian',
    oversampleBits: 4,
    useSleepNoiseReduction: true
  }
];

export const AdcNoisePrecisionAnalyzer: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // System Clock & MCU internal reference options
  const defaultInternalVref = selectedMCU === 'atmega328p' ? 1.1 : 2.56;

  // User Parameter States
  const [inputVoltage, setInputVoltage] = useState<number>(2.50);
  const [vrefType, setVrefType] = useState<VrefType>('avcc');
  const [vrefVoltage, setVrefVoltage] = useState<number>(5.0);
  const [noiseRmsMv, setNoiseRmsMv] = useState<number>(4.8);
  const [noiseType, setNoiseType] = useState<NoiseSourceType>('gaussian');
  const [prescaler, setPrescaler] = useState<number>(128); // 128 -> 125kHz @ 16MHz
  const [oversampleBits, setOversampleBits] = useState<number>(2); // 0(+0), 1(+1b: 4x), 2(+2b: 16x), 3(+3b: 64x), 4(+4b: 256x)
  const [useSleepNoiseReduction, setUseSleepNoiseReduction] = useState<boolean>(true);

  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simSeed, setSimSeed] = useState<number>(0);

  // Auto update vref value when type changes
  const handleVrefTypeChange = (type: VrefType) => {
    setVrefType(type);
    if (type === 'avcc') {
      setVrefVoltage(5.0);
    } else if (type === 'internal') {
      setVrefVoltage(defaultInternalVref);
    } else {
      setVrefVoltage(2.50);
    }
  };

  // Preset Selection
  const handleSelectPreset = (p: AdcPreset) => {
    setInputVoltage(p.inputVoltage);
    setVrefType(p.vrefType);
    setVrefVoltage(p.vrefType === 'internal' ? defaultInternalVref : p.vrefVoltage);
    setNoiseRmsMv(p.noiseRmsMv);
    setNoiseType(p.noiseType);
    setOversampleBits(p.oversampleBits);
    setUseSleepNoiseReduction(p.useSleepNoiseReduction);
  };

  // Clamped Vin to Vref
  const safeVin = Math.min(vrefVoltage, Math.max(0, inputVoltage));

  // Calculations
  const calculations = useMemo(() => {
    // 1. Fundamental 10-bit ADC characteristics
    const rawBits = 10;
    const rawMaxCode = 1023;
    const lsbVoltageMv = (vrefVoltage / 1024) * 1000; // in mV
    const idealCode = Math.min(rawMaxCode, Math.max(0, Math.round((safeVin / vrefVoltage) * 1024)));

    // Quantization Noise (uniform distribution standard deviation = LSB / sqrt(12))
    const quantizationNoiseMv = lsbVoltageMv / Math.sqrt(12);

    // Total Noise: RSS of Quantization Noise + Environmental Noise
    // If sleep mode is ON, CPU digital switching noise is reduced by ~60% (~1.5 mV saving)
    const effectiveNoiseRmsMv = useSleepNoiseReduction
      ? Math.max(0.5, noiseRmsMv * 0.7)
      : noiseRmsMv;

    const totalNoiseMv = Math.sqrt(Math.pow(quantizationNoiseMv, 2) + Math.pow(effectiveNoiseRmsMv, 2));
    const noiseLsbRatio = totalNoiseMv / lsbVoltageMv; // Noise in LSB units

    // Signal-to-Noise Ratio (SNR) and SINAD for Full-scale input
    // Ideal SNR = 6.02 * N + 1.76 dB
    const signalRmsMv = (vrefVoltage * 1000) / (2 * Math.sqrt(2));
    const rawSinadDb = 20 * Math.log10(signalRmsMv / totalNoiseMv);
    const rawEnob = Math.max(1, Math.min(10.0, (rawSinadDb - 1.76) / 6.02));

    // 2. Oversampling and Decimation Mechanics
    // Factor M = 4^n
    const n = oversampleBits;
    const oversamplingFactor = Math.pow(4, n);
    const targetBits = rawBits + n;
    const targetMaxCode = Math.pow(2, targetBits) - 1;
    const oversampledIdealCode = Math.min(targetMaxCode, Math.max(0, Math.round((safeVin / vrefVoltage) * Math.pow(2, targetBits))));
    const oversampledLsbMv = (vrefVoltage / Math.pow(2, targetBits)) * 1000;

    // Dither check: Oversampling requires noise p-p >= 1 LSB (~0.33 LSB RMS)
    // If noise is below 0.33 LSB, quantization stall happens and oversampling efficiency drops
    const ditherSufficiency = effectiveNoiseRmsMv / (0.33 * lsbVoltageMv);
    const ditherEfficiencyFactor = Math.min(1.0, Math.max(0.2, ditherSufficiency));

    // Oversampled Total Noise is reduced by sqrt(M) = 2^n
    const oversampledNoiseMv = totalNoiseMv / Math.pow(2, n * ditherEfficiencyFactor);
    const oversampledSinadDb = 20 * Math.log10(signalRmsMv / oversampledNoiseMv);
    const oversampledEnob = Math.max(rawEnob, Math.min(targetBits * 1.0, (oversampledSinadDb - 1.76) / 6.02));

    // Noise floor reduction in dB = 10 * log10(M)
    const noiseFloorReductionDb = 10 * Math.log10(oversamplingFactor);

    // 3. Timing & Throughput calculations
    const fCpuHz = 16_000_000; // 16 MHz standard
    const adcFreqKhz = (fCpuHz / prescaler) / 1000;
    const singleConvClockCycles = 13; // Normal AVR conversion is 13 cycles (first is 25)
    const singleConvTimeUs = (singleConvClockCycles / (adcFreqKhz * 1000)) * 1_000_000;
    const totalOversampledTimeUs = singleConvTimeUs * oversamplingFactor;
    const sampleRateSps = 1_000_000 / totalOversampledTimeUs;

    // 4. Distribution standard deviation in ADC raw codes
    const sigmaCode = totalNoiseMv / lsbVoltageMv;
    const oversampledSigmaCode = (oversampledNoiseMv / oversampledLsbMv);

    return {
      rawBits,
      rawMaxCode,
      lsbVoltageMv,
      idealCode,
      quantizationNoiseMv,
      effectiveNoiseRmsMv,
      totalNoiseMv,
      noiseLsbRatio,
      rawSinadDb: Math.round(rawSinadDb * 10) / 10,
      rawEnob: Math.round(rawEnob * 100) / 100,
      n,
      oversamplingFactor,
      targetBits,
      targetMaxCode,
      oversampledIdealCode,
      oversampledLsbMv,
      oversampledNoiseMv,
      oversampledSinadDb: Math.round(oversampledSinadDb * 10) / 10,
      oversampledEnob: Math.round(oversampledEnob * 100) / 100,
      enobGain: Math.max(0, Math.round((oversampledEnob - rawEnob) * 100) / 100),
      noiseFloorReductionDb: Math.round(noiseFloorReductionDb * 10) / 10,
      adcFreqKhz: Math.round(adcFreqKhz),
      singleConvTimeUs: Math.round(singleConvTimeUs * 10) / 10,
      totalOversampledTimeUs: Math.round(totalOversampledTimeUs * 10) / 10,
      sampleRateSps: Math.round(sampleRateSps),
      sigmaCode,
      oversampledSigmaCode,
      ditherSufficiency,
      hasEnoughDither: ditherSufficiency >= 0.8
    };
  }, [safeVin, vrefVoltage, noiseRmsMv, useSleepNoiseReduction, oversampleBits, prescaler]);

  // Periodic simulation tick for live data visualization
  useEffect(() => {
    if (!isSimulating) return;
    const timer = setInterval(() => {
      setSimSeed((prev) => (prev + 1) % 1000);
    }, 400);
    return () => clearInterval(timer);
  }, [isSimulating]);

  // Generate 40 simulated sample points for live waveform display
  const simulatedSamples = useMemo(() => {
    const points: { rawCode: number; osCode: number; timeIdx: number }[] = [];
    const count = 35;
    const seed = simSeed;

    for (let i = 0; i < count; i++) {
      // Deterministic pseudo-random Gaussian noise based on sine harmonics
      const t = (i + seed) * 0.75;
      const noise1 = Math.sin(t * 1.3) + Math.cos(t * 2.7) * 0.5 + Math.sin(t * 4.1) * 0.3;
      const noiseScaled = noise1 * calculations.sigmaCode * 0.7;

      const raw = Math.round(calculations.idealCode + noiseScaled);

      // Oversampled noise is attenuated by sqrt(M)
      const osNoiseScaled = noiseScaled / Math.sqrt(calculations.oversamplingFactor);
      const os = Math.round(
        (calculations.idealCode + osNoiseScaled) * Math.pow(2, calculations.n)
      );

      points.push({
        timeIdx: i,
        rawCode: Math.min(1023, Math.max(0, raw)),
        osCode: os
      });
    }
    return points;
  }, [simSeed, calculations]);

  // Histogram buckets (-4 LSB to +4 LSB)
  const histogramBuckets = useMemo(() => {
    const offsets = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
    const sigma = Math.max(0.4, calculations.sigmaCode);
    const osSigma = Math.max(0.2, calculations.sigmaCode / Math.sqrt(calculations.oversamplingFactor));

    return offsets.map((off) => {
      // Gaussian probability density P(x) = (1 / sqrt(2pi * sigma^2)) * exp(-x^2 / 2sigma^2)
      const pRaw = (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-Math.pow(off, 2) / (2 * Math.pow(sigma, 2)));
      const pOs = (1 / (osSigma * Math.sqrt(2 * Math.PI))) * Math.exp(-Math.pow(off, 2) / (2 * Math.pow(osSigma, 2)));

      return {
        offset: off,
        codeLabel: `${off >= 0 ? '+' : ''}${off} LSB`,
        rawPct: Math.min(100, Math.round(pRaw * 100)),
        osPct: Math.min(100, Math.round(pOs * 100))
      };
    });
  }, [calculations]);

  // Generated C Source Code
  const generatedCCode = useMemo(() => {
    const admuxRefBits =
      vrefType === 'avcc'
        ? '(1 << REFS0)'
        : vrefType === 'internal'
        ? (selectedMCU === 'atmega328p' ? '(1 << REFS1) | (1 << REFS0)' : '(1 << REFS1) | (1 << REFS0)')
        : '0'; // AREF External

    const prescalerBitName =
      prescaler === 128
        ? '(1 << ADPS2) | (1 << ADPS1) | (1 << ADPS0)'
        : prescaler === 64
        ? '(1 << ADPS2) | (1 << ADPS1)'
        : '(1 << ADPS2) | (1 << ADPS0)';

    const n = calculations.n;
    const factor = calculations.oversamplingFactor;

    return `/* =========================================================================
 * AVR ADC 정밀도 극대화 & 오버샘플링 드라이버
 * 타깃 MCU      : ${currentProfile.name}
 * 기준 전압(Vref): ${vrefType === 'avcc' ? 'AVCC (5.0V)' : vrefType === 'internal' ? `Internal (${defaultInternalVref}V)` : 'AREF External'}
 * 기본 분해능   : 10-bit (LSB = ${calculations.lsbVoltageMv.toFixed(3)} mV)
 * 오버샘플링   : ${factor}x Summation >> ${n} Shift (목표 분해능: ${calculations.targetBits}-bit)
 * 달성 ENOB     : ${calculations.oversampledEnob} Bits (노이즈 플로어 -${calculations.noiseFloorReductionDb} dB 감쇠)
 * ========================================================================= */
#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/sleep.h>
#include <util/delay.h>

// 1. ADC 하드웨어 초기화
void adc_init(void) {
    // Vref 기준 전압 설정 및 채널 0 (ADC0) 선택
    ADMUX = ${admuxRefBits};

    // ADC 활성화, 인터럽트 비활성화, 프리스케일러 128 (16MHz / 128 = 125kHz)
    ADCSRA = (1 << ADEN) | ${prescalerBitName};

    // 최초 더미 변환을 통한 내부 아날로그 회로 안정화
    ADCSRA |= (1 << ADSC);
    while (ADCSRA & (1 << ADSC));
}

${useSleepNoiseReduction ? `// 2. ADC 노이즈 감소 슬립 모드 (CPU 코어 클럭을 정지시켜 스위칭 노이즈 억제)
EMPTY_INTERRUPT(ADC_vect); // ADC 변환 완료 시 CPU 기상을 위한 빈 인터럽트 루틴

uint16_t adc_read_noise_reduced(uint8_t channel) {
    ADMUX = (ADMUX & 0xF0) | (channel & 0x0F);
    
    // ADC 인터럽트 활성화 및 슬립 모드 진입 준비
    ADCSRA |= (1 << ADIE);
    set_sleep_mode(SLEEP_MODE_ADC);
    sleep_enable();
    sei();

    sleep_cpu(); // CPU 정지 -> ADC 변환 개시 -> 변환 완료 시 기상

    sleep_disable();
    ADCSRA &= ~(1 << ADIE); // 인터럽트 해제

    return ADC;
}` : `// 2. 일반 폴링 방식 ADC 단일 변환
uint16_t adc_read_single(uint8_t channel) {
    ADMUX = (ADMUX & 0xF0) | (channel & 0x0F);
    ADCSRA |= (1 << ADSC);
    while (ADCSRA & (1 << ADSC));
    return ADC;
}`}

// 3. ${calculations.targetBits}-bit 정밀 오버샘플링 & 데시메이션 함수 (M = ${factor}x, Shift = >> ${n})
uint16_t adc_read_oversampled_${calculations.targetBits}bit(uint8_t channel) {
    uint32_t accumulator = 0;
    const uint16_t num_samples = ${factor}; // 4^${n} 회 누적

    for (uint16_t i = 0; i < num_samples; i++) {
        ${useSleepNoiseReduction ? 'accumulator += adc_read_noise_reduced(channel);' : 'accumulator += adc_read_single(channel);'}
    }

    // 데시메이션(Decimation): 누적합을 2^${n}으로 우측 시프트하여 최종 ${calculations.targetBits}-bit 획득
    return (uint16_t)(accumulator >> ${n});
}

// 4. 전압(mV) 단위 고정밀 변환 계산식 예제
uint32_t adc_to_millivolts(uint16_t adc_code_${calculations.targetBits}bit) {
    // (ADC * Vref_mV) / 2^${calculations.targetBits}
    // 예: Vref = ${Math.round(vrefVoltage * 1000)} mV, 정밀 연산
    return ((uint32_t)adc_code_${calculations.targetBits}bit * ${Math.round(vrefVoltage * 1000)}UL) >> ${calculations.targetBits};
}
`;
  }, [
    currentProfile.name,
    vrefType,
    defaultInternalVref,
    selectedMCU,
    prescaler,
    calculations,
    useSleepNoiseReduction,
    vrefVoltage
  ]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.85 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadCode = () => {
    const blob = new Blob([generatedCCode], { type: 'text/x-csrc' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adc_oversampling_${calculations.targetBits}bit_${selectedMCU}.c`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-2">
            <Gauge className="w-3.5 h-3.5" /> Analog Precision & Oversampling Engine
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            ADC 노이즈 및 정밀도 분석 도구 (Oversampling & ENOB Simulator)
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            입력 전압, 기준 전압(Vref), 샘플링 클럭 및 외부 환경 노이즈를 설정하여 10-bit 기본 ADC의 
            <span className="text-rose-400 font-medium"> 오차 분포 히스토그램</span>을 분석하고, 
            <span className="text-emerald-400 font-medium"> 4^n 오버샘플링(Oversampling)</span>을 통해 
            유효 비트(ENOB)를 최대 14-bit 수준으로 확장하는 시뮬레이션을 제공합니다.
          </p>
        </div>

        {/* Quick Target Info Badge */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
          <div className="flex items-center gap-2 text-slate-400">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>선택된 MCU:</span>
            <span className="text-white font-bold">{currentProfile.name}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            ADC 클럭: <span className="text-emerald-400 font-mono">{calculations.adcFreqKhz} kHz</span> (13 사이클 변환)
          </div>
        </div>
      </div>

      {/* Preset Banner */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            센서 & 아날로그 응용별 노이즈/정밀도 프리셋
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {ADC_PRESETS.map((p) => {
            const isSelected =
              Math.abs(p.inputVoltage - inputVoltage) < 0.01 &&
              p.vrefType === vrefType &&
              p.oversampleBits === oversampleBits &&
              p.noiseRmsMv === noiseRmsMv;

            return (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p)}
                className={`text-left p-2.5 rounded-lg border transition-all text-xs flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-950/40 border-emerald-500/50 ring-1 ring-emerald-500/40'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-semibold text-white truncate">{p.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {p.tag}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-1">{p.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Control Panel: Parameters Inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Voltage & Reference Settings */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" /> 전압 신호 & 기준 전압 (Vref)
          </h3>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>입력 전압 (Vin)</span>
              <span className="text-emerald-400 font-mono font-bold">{inputVoltage.toFixed(3)} V</span>
            </div>
            <input
              type="range"
              min={0}
              max={vrefVoltage}
              step={0.01}
              value={inputVoltage}
              onChange={(e) => setInputVoltage(parseFloat(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-500 mt-1">
              <span>0.0 V</span>
              <span>스케일 비율: {((safeVin / vrefVoltage) * 100).toFixed(1)}%</span>
              <span>{vrefVoltage.toFixed(1)} V</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">기준 전압 선택 (Vref)</label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => handleVrefTypeChange('avcc')}
                className={`py-1.5 text-xs rounded border transition-all font-semibold ${
                  vrefType === 'avcc'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                AVCC (5V)
              </button>
              <button
                onClick={() => handleVrefTypeChange('internal')}
                className={`py-1.5 text-xs rounded border transition-all font-semibold ${
                  vrefType === 'internal'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                Internal ({defaultInternalVref}V)
              </button>
              <button
                onClick={() => handleVrefTypeChange('aref_ext')}
                className={`py-1.5 text-xs rounded border transition-all font-semibold ${
                  vrefType === 'aref_ext'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                AREF 외부
              </button>
            </div>
          </div>

          {vrefType === 'aref_ext' && (
            <div>
              <label className="text-xs text-slate-400 block mb-1">AREF 정밀 기준 전압 값</label>
              <input
                type="number"
                step="0.01"
                min="1.0"
                max="5.5"
                value={vrefVoltage}
                onChange={(e) => setVrefVoltage(Math.max(1.0, parseFloat(e.target.value) || 2.5))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
              />
            </div>
          )}

          {/* LSB resolution readout */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>기본 10-bit 1 LSB 전압:</span>
              <span className="text-emerald-400 font-mono font-bold">{calculations.lsbVoltageMv.toFixed(3)} mV</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>이론적 10-bit ADC 코드:</span>
              <span className="text-white font-mono font-bold">
                {calculations.idealCode} / 1023
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>양자화 노이즈 (σ_q):</span>
              <span className="text-slate-300 font-mono">
                {calculations.quantizationNoiseMv.toFixed(3)} mV
              </span>
            </div>
          </div>
        </div>

        {/* Middle: Noise & Environment Parameters */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-400" /> 외부 환경 노이즈 & 간섭 조건
          </h3>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>환경 노이즈 진폭 (RMS)</span>
              <span className="text-rose-400 font-mono font-bold">{noiseRmsMv.toFixed(1)} mV RMS</span>
            </div>
            <input
              type="range"
              min={0.2}
              max={30.0}
              step={0.2}
              value={noiseRmsMv}
              onChange={(e) => setNoiseRmsMv(parseFloat(e.target.value))}
              className="w-full accent-rose-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-500 mt-1">
              <span>0.2 mV (초저노이즈)</span>
              <span>노이즈 대 LSB: {calculations.noiseLsbRatio.toFixed(2)} LSB</span>
              <span>30.0 mV</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">주요 노이즈 간섭 유형</label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => setNoiseType('gaussian')}
                className={`py-1 text-xs rounded border transition-all ${
                  noiseType === 'gaussian'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-semibold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                가우시안 백색
              </button>
              <button
                onClick={() => setNoiseType('mains_hum')}
                className={`py-1 text-xs rounded border transition-all ${
                  noiseType === 'mains_hum'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-semibold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                60Hz 전원 험
              </button>
              <button
                onClick={() => setNoiseType('switching_ripple')}
                className={`py-1 text-xs rounded border transition-all ${
                  noiseType === 'switching_ripple'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-semibold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                스위칭 리플
              </button>
            </div>
          </div>

          {/* Sleep Noise Reduction Toggle */}
          <div className="flex items-center justify-between bg-slate-900/70 p-2.5 rounded-lg border border-slate-800 text-xs">
            <div>
              <span className="text-slate-200 font-medium block">ADC Noise Reduction Sleep 모드</span>
              <span className="text-[11px] text-slate-400">변환 중 CPU 코어 클럭을 정지하여 디지털 노이즈 차단</span>
            </div>
            <input
              type="checkbox"
              checked={useSleepNoiseReduction}
              onChange={(e) => setUseSleepNoiseReduction(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
            />
          </div>

          {/* Dither Check Badge */}
          <div
            className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
              calculations.hasEnoughDither
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
            }`}
          >
            {calculations.hasEnoughDither ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="text-[11px] leading-relaxed">
              <strong>디더링(Dithering) 조건:</strong> {calculations.hasEnoughDither ? (
                <span>노이즈가 1 LSB p-p 이상 존재하여 오버샘플링이 이상적으로 동작합니다.</span>
              ) : (
                <span>노이즈 진폭이 너무 작아 양자화 정체가 발생할 수 있습니다 (삼각파 디더 권장).</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Oversampling & Decimation Engine */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" /> 오버샘플링(Oversampling) & 데시메이션
          </h3>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>오버샘플링 추가 비트 (n)</span>
              <span className="text-cyan-400 font-mono font-bold">
                +{oversampleBits} Bits ({calculations.targetBits}-bit)
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {[0, 1, 2, 3, 4].map((b) => (
                <button
                  key={b}
                  onClick={() => setOversampleBits(b)}
                  className={`py-1.5 text-xs rounded border transition-all font-semibold ${
                    oversampleBits === b
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {b === 0 ? '10-bit' : `+${b}b (${Math.pow(4, b)}x)`}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
              <span>샘플 누적 횟수: {calculations.oversamplingFactor}회</span>
              <span>우측 시프트: &gt;&gt; {calculations.n}</span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
              <span className="text-slate-400 text-[11px] block">원시 10-bit ENOB</span>
              <span className="text-rose-400 font-mono font-bold text-sm">
                {calculations.rawEnob} Bits
              </span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
              <span className="text-slate-400 text-[11px] block">개선된 유효 비트 (ENOB)</span>
              <span className="text-emerald-400 font-mono font-bold text-sm flex items-center gap-1">
                {calculations.oversampledEnob} Bits
                {calculations.enobGain > 0 && (
                  <span className="text-[10px] text-emerald-300 font-normal">
                    (+{calculations.enobGain})
                  </span>
                )}
              </span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
              <span className="text-slate-400 text-[11px] block">오버샘플링 분해능 LSB</span>
              <span className="text-cyan-400 font-mono font-bold text-sm">
                {calculations.oversampledLsbMv.toFixed(3)} mV
              </span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
              <span className="text-slate-400 text-[11px] block">변환 소요 시간 / 속도</span>
              <span className="text-amber-400 font-mono font-bold text-sm">
                {calculations.totalOversampledTimeUs} µs ({calculations.sampleRateSps.toLocaleString()} SPS)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visualizer 1: ADC Error Distribution Histogram & Live Fluctuation */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                ADC 변환 코드 오차 확률 분포 (Histogram & Error Spread)
              </h3>
              <p className="text-xs text-slate-400">
                이상적 변환 코드({calculations.idealCode})를 중심으로 한 표준 편차(±1σ) 및 
                오버샘플링 적용 시의 분산 집중도 비교
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                isSimulating
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
              }`}
            >
              {isSimulating ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" /> 노이즈 일시정지
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> 실시간 노이즈 재생
                </>
              )}
            </button>
          </div>
        </div>

        {/* Histogram Bars Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {/* Histogram Chart */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-slate-300 mb-3 flex items-center justify-between">
              <span>코드 분포 확률 밀도 비교</span>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="w-2.5 h-2.5 bg-rose-500 rounded"></span> 원시 10-bit
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded"></span> {calculations.targetBits}-bit 오버샘플
                </span>
              </div>
            </h4>

            <div className="space-y-2">
              {histogramBuckets.map((bucket) => (
                <div key={bucket.offset} className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span className="font-mono text-slate-300">{bucket.codeLabel}</span>
                    <span className="text-[10px] text-slate-500">
                      원시 {bucket.rawPct}% vs 오버샘플 {bucket.osPct}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 h-2.5">
                    {/* Raw Bar */}
                    <div className="w-full bg-slate-950 rounded-full overflow-hidden flex">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${bucket.rawPct}%` }}
                      />
                    </div>
                    {/* Oversampled Bar */}
                    <div className="w-full bg-slate-950 rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${bucket.osPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-800">
              오버샘플링을 거치면 중심 코드(0 LSB 편차)에 확률 밀도가 약 <strong>{calculations.oversamplingFactor > 1 ? `${Math.round(calculations.oversamplingFactor * 0.75)}배` : '1배'}</strong> 집중되어 측정 편차가 급감합니다.
            </p>
          </div>

          {/* Live Fluctuation Stream Chart */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
              <span>실시간 샘플링 변동 추이 (Time Domain Stream)</span>
              <span className="text-[11px] font-mono text-emerald-400">
                목표값: {calculations.idealCode} Code
              </span>
            </h4>

            {/* SVG Waveform of 35 points */}
            <div className="w-full h-44 bg-slate-950 rounded-lg p-2 border border-slate-800">
              <svg viewBox="0 0 320 140" className="w-full h-full">
                {/* Center Target Reference Line */}
                <line x1="10" y1="70" x2="310" y2="70" stroke="#10b981" strokeDasharray="3,3" strokeWidth="1.5" />
                <text x="15" y="65" fill="#10b981" fontSize="9" fontWeight="bold">
                  Target: {calculations.idealCode}
                </text>

                {/* Upper and Lower 1 LSB lines */}
                <line x1="10" y1="45" x2="310" y2="45" stroke="#334155" strokeDasharray="2,2" strokeWidth="1" />
                <text x="275" y="42" fill="#64748b" fontSize="8">+1 LSB</text>
                <line x1="10" y1="95" x2="310" y2="95" stroke="#334155" strokeDasharray="2,2" strokeWidth="1" />
                <text x="275" y="103" fill="#64748b" fontSize="8">-1 LSB</text>

                {/* Raw samples polyline */}
                {(() => {
                  const pointsStr = simulatedSamples
                    .map((s, idx) => {
                      const x = 15 + idx * 8.5;
                      const diff = s.rawCode - calculations.idealCode;
                      const y = Math.max(10, Math.min(130, 70 - diff * 25));
                      return `${x},${y}`;
                    })
                    .join(' ');
                  return (
                    <polyline
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="1.5"
                      strokeOpacity="0.85"
                      points={pointsStr}
                    />
                  );
                })()}

                {/* Oversampled filtered samples polyline */}
                {(() => {
                  const scaleDown = Math.pow(2, calculations.n);
                  const pointsStr = simulatedSamples
                    .map((s, idx) => {
                      const x = 15 + idx * 8.5;
                      const diff = (s.osCode / scaleDown) - calculations.idealCode;
                      const y = Math.max(10, Math.min(130, 70 - diff * 25));
                      return `${x},${y}`;
                    })
                    .join(' ');
                  return (
                    <polyline
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="2.5"
                      points={pointsStr}
                    />
                  );
                })()}

                {/* Scatter Dots */}
                {simulatedSamples.map((s, idx) => {
                  const x = 15 + idx * 8.5;
                  const diff = s.rawCode - calculations.idealCode;
                  const y = Math.max(10, Math.min(130, 70 - diff * 25));
                  return (
                    <circle
                      key={`raw_dot_${idx}`}
                      cx={x}
                      cy={y}
                      r="2"
                      fill="#f43f5e"
                    />
                  );
                })}
              </svg>
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-rose-500"></span> 원시 노이즈 변동 폭
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-1 bg-emerald-400"></span> 오버샘플링 필터링 출력
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visualizer 2: ENOB Improvement & Noise Floor Attenuation */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">
              유효 비트(ENOB) 개선 및 노이즈 플로어 감쇠 비교
            </h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
            노이즈 플로어 감쇠: -{calculations.noiseFloorReductionDb} dB
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: ENOB Gain */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase">ENOB 유효 비트 달성률</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono">{calculations.oversampledEnob}</span>
              <span className="text-xs text-emerald-400 font-semibold">/ {calculations.targetBits} Bits</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${(calculations.oversampledEnob / 14) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              기본 10비트 대비 <strong>+{calculations.enobGain} 비트</strong> 개선. 
              양자화 잡음과 임의 노이즈가 주파수 대역에 분산되어 유효 정밀도가 비약적으로 향상됩니다.
            </p>
          </div>

          {/* Card 2: SINAD Comparison */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase">신호 대 잡음비 (SINAD)</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono">{calculations.oversampledSinadDb}</span>
              <span className="text-xs text-cyan-400 font-semibold">dB</span>
              <span className="text-[11px] text-slate-400">(원시: {calculations.rawSinadDb} dB)</span>
            </div>
            <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span>원시 노이즈 전압:</span>
                <span className="text-rose-400 font-mono">{calculations.totalNoiseMv.toFixed(2)} mV</span>
              </div>
              <div className="flex justify-between">
                <span>오버샘플 노이즈:</span>
                <span className="text-emerald-400 font-mono">{calculations.oversampledNoiseMv.toFixed(2)} mV</span>
              </div>
            </div>
          </div>

          {/* Card 3: Bandwidth vs Resolution Trade-off */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase">대역폭 vs 정밀도 트레이드오프</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono">{calculations.sampleRateSps.toLocaleString()}</span>
              <span className="text-xs text-amber-400 font-semibold">SPS</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {calculations.oversamplingFactor}회 변환을 누적하므로 샘플링 레이트는 
              {calculations.oversamplingFactor}배 감소합니다. 온도, 배터리, 저속 센서 모니터링에 이상적인 설계 기법입니다.
            </p>
          </div>
        </div>
      </div>

      {/* Embedded C Code Generator */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                자동 생성된 AVR C 정밀 오버샘플링 드라이버 코드
              </h3>
              <p className="text-xs text-slate-400">
                선택한 Vref, {calculations.targetBits}-bit 오버샘플링 계수({calculations.oversamplingFactor}x) 및 Sleep Noise Reduction 루틴 완비
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? '복사 완료!' : 'C 코드 복사'}
            </button>
            <button
              onClick={handleDownloadCode}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> .c 파일 다운로드
            </button>
          </div>
        </div>

        <pre className="p-4 bg-slate-900/90 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[360px] scrollbar-thin scrollbar-thumb-slate-700">
          <code>{generatedCCode}</code>
        </pre>
      </div>
    </div>
  );
};
