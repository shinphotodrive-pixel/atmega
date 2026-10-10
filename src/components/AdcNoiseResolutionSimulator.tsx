import React, { useState, useMemo } from 'react';
import {
  Activity,
  Sliders,
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
  Zap,
  Info,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Cpu,
  BarChart2,
  RefreshCw,
  Gauge,
  HelpCircle,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
}

interface SignalPreset {
  name: string;
  vmin: number;
  vmax: number;
  description: string;
}

interface NoisePreset {
  name: string;
  noiseMvRms: number;
  description: string;
  badge: string;
}

export const AdcNoiseResolutionSimulator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // ----------------------------------------------------
  // MCU Hardware Specs & Reference Options
  // ----------------------------------------------------
  // ATmega328P: 10-bit, AVCC, Internal 1.1V, External AREF
  // ATmega128: 10-bit, AVCC, Internal 2.56V, External AREF
  // ATmega640: 10-bit, AVCC, Internal 1.1V, Internal 2.56V, External AREF
  const hasInternal1V1 = selectedMCU === 'atmega328p' || selectedMCU === 'atmega640';
  const hasInternal2V56 = selectedMCU === 'atmega128' || selectedMCU === 'atmega640';

  // ----------------------------------------------------
  // State
  // ----------------------------------------------------
  const [vrefMode, setVrefMode] = useState<'avcc_5v' | 'avcc_3v3' | 'internal_1v1' | 'internal_2v56' | 'aref_ext' | 'custom'>('avcc_5v');
  const [customVref, setCustomVref] = useState<number>(5.0);
  
  // Expected Signal Range
  const [signalVmin, setSignalVmin] = useState<number>(0.5);
  const [signalVmax, setSignalVmax] = useState<number>(3.5);

  // PCB / Ground / Supply Noise in mV RMS
  const [pcbNoiseMvRms, setPcbNoiseMvRms] = useState<number>(3.5);

  // Oversampling option (AVR standard oversampling & decimation)
  const [oversamplingBits, setOversamplingBits] = useState<number>(0); // 0 = 10-bit, 1 = 11-bit (4x), 2 = 12-bit (16x), etc.

  // Interactive Probe for Visualization
  const [probeVoltage, setProbeVoltage] = useState<number>(2.0);
  const [zoomLevel, setZoomLevel] = useState<number>(4); // Zoom for staircase inspect
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [selectedAdcChannel, setSelectedAdcChannel] = useState<number>(0);

  // ----------------------------------------------------
  // Vref Calculation
  // ----------------------------------------------------
  const actualVref = useMemo(() => {
    switch (vrefMode) {
      case 'avcc_5v':
        return 5.0;
      case 'avcc_3v3':
        return 3.3;
      case 'internal_1v1':
        return 1.1;
      case 'internal_2v56':
        return 2.56;
      case 'aref_ext':
        return 2.048; // Precision 2.048V external reference
      case 'custom':
        return Math.max(0.2, Math.min(6.0, customVref || 5.0));
      default:
        return 5.0;
    }
  }, [vrefMode, customVref]);

  // Adjust probe voltage if Vref changes
  const effectiveProbeVoltage = Math.min(actualVref, Math.max(0, probeVoltage));

  // ----------------------------------------------------
  // Presets
  // ----------------------------------------------------
  const signalPresets: SignalPreset[] = [
    {
      name: 'Full Scale (0.0V ~ Vref)',
      vmin: 0.0,
      vmax: actualVref,
      description: '레일-투-레일 포텐셔미터 또는 풀스케일 센서'
    },
    {
      name: 'Ratiometric (0.5V ~ 4.5V)',
      vmin: 0.5,
      vmax: Math.min(4.5, actualVref),
      description: '자동차/산업용 압력 트랜스듀서, 홀 이펙트 센서'
    },
    {
      name: 'Thermistor / NTC (1.0V ~ 3.5V)',
      vmin: 1.0,
      vmax: Math.min(3.5, actualVref),
      description: '온도 측정용 전압 분배 회로 출력'
    },
    {
      name: 'Current Shunt (0.0V ~ 0.25V)',
      vmin: 0.0,
      vmax: 0.25,
      description: '낮은 션트 저항 양단 전압 강하 (소신호)'
    },
    {
      name: 'Audio / Mic (1.2V ~ 2.0V)',
      vmin: 1.2,
      vmax: Math.min(2.0, actualVref),
      description: 'DC 바이어스 인가된 일렉트릿 마이크로폰 신호'
    }
  ];

  const noisePresets: NoisePreset[] = [
    {
      name: '초저노이즈 실장 (< 0.5 mV)',
      noiseMvRms: 0.3,
      description: '4층 PCB + LC 전원 필터 + 별도 아날로그 접지(AGND) 분리',
      badge: '이상적 AFE'
    },
    {
      name: '일반 표준 양산 보드 (~ 2.0 mV)',
      noiseMvRms: 2.0,
      description: '2층 PCB + AVCC 디커플링 100nF + 적절한 접지면',
      badge: '표준 상용'
    },
    {
      name: '브레드보드 / 개발키트 (~ 5.0 mV)',
      noiseMvRms: 5.0,
      description: 'USB 전원 직결 리플 + 점퍼선 부유 인덕턴스 결합',
      badge: 'Arduino 기본'
    },
    {
      name: '고노이즈 디지털 스위칭 (~ 12.0 mV)',
      noiseMvRms: 12.0,
      description: '인접한 고속 SPI/PWM 클럭 라인의 크로스토크 결합',
      badge: '주의 요망'
    },
    {
      name: '열악한 SMPS 리플 (~ 30.0 mV)',
      noiseMvRms: 30.0,
      description: '미필터링 벅 컨버터 스위칭 스파이크 + 모터 역기전력',
      badge: '심각한 열화'
    }
  ];

  // ----------------------------------------------------
  // Core ADC & Noise Calculations
  // ----------------------------------------------------
  const baseBits = 10; // AVR Native hardware bits
  const totalHardwareBits = baseBits + oversamplingBits; // 10, 11, 12, 13, 14
  const numRawCodes = Math.pow(2, totalHardwareBits); // 1024 to 16384
  const oversampleFactor = Math.pow(4, oversamplingBits); // 1, 4, 16, 64, 256 samples

  // 1. LSB Voltage (mV)
  const lsbVoltageVolts = actualVref / numRawCodes;
  const lsbVoltageMv = lsbVoltageVolts * 1000;

  // 2. Quantization Noise
  // Ideal RMS quantization error: e_q = LSB / sqrt(12)
  const quantNoiseRmsMv = lsbVoltageMv / Math.sqrt(12);
  const maxQuantErrorMv = lsbVoltageMv / 2;

  // 3. Intrinsic ADC internal noise (datasheet typical comparator jitter & thermal noise)
  // AVR datasheet specifies TUE ~ 2 LSB, intrinsic thermal noise ~ 0.5 LSB RMS
  const adcIntrinsicNoiseMv = 0.5 * lsbVoltageMv;

  // 4. Oversampling noise attenuation:
  // White noise drops by sqrt(N) = 2^oversamplingBits
  const effectivePcbNoiseMvRms = pcbNoiseMvRms / Math.pow(2, oversamplingBits * 0.5);

  // 5. Total Combined RMS Noise (RSS: Root Sum Square)
  const totalNoiseRmsMv = Math.sqrt(
    Math.pow(quantNoiseRmsMv, 2) +
    Math.pow(effectivePcbNoiseMvRms, 2) +
    Math.pow(adcIntrinsicNoiseMv, 2)
  );

  // Peak-to-peak noise (6.6 sigma for 99.9% Gaussian confidence)
  const noisePeakToPeakMv = 6.6 * totalNoiseRmsMv;
  const noiseInLsbsRms = totalNoiseRmsMv / lsbVoltageMv;
  const noiseInLsbsPeakToPeak = noisePeakToPeakMv / lsbVoltageMv;

  // 6. Signal Range Analysis
  const validVmin = Math.max(0, Math.min(signalVmin, signalVmax));
  const validVmax = Math.min(actualVref * 1.5, Math.max(signalVmin, signalVmax));
  const signalSpanVolts = Math.max(0.001, validVmax - validVmin);
  const isClipping = validVmax > actualVref;

  // Clamped usable span within Vref
  const activeUsableVmax = Math.min(actualVref, validVmax);
  const activeUsableVmin = Math.max(0, validVmin);
  const clampedSpanVolts = Math.max(0, activeUsableVmax - activeUsableVmin);

  // ADC Codes used
  const codeMin = Math.min(numRawCodes - 1, Math.max(0, Math.floor((activeUsableVmin / actualVref) * numRawCodes)));
  const codeMax = Math.min(numRawCodes - 1, Math.max(0, Math.floor((activeUsableVmax / actualVref) * numRawCodes)));
  const activeCodesCount = Math.max(1, codeMax - codeMin + 1);
  const fullScaleUtilizationPercent = (clampedSpanVolts / actualVref) * 100;

  // 7. Dynamic Range & ENOB Calculation
  // Full-scale test sine wave RMS = Vref / (2 * sqrt(2))
  const vrefRmsMv = (actualVref * 1000) / (2 * Math.sqrt(2));
  
  // Full-scale SNR (Signal to Noise Ratio): 20 * log10(Vref_rms / noise_rms)
  const snrFullScaleDb = 20 * Math.log10(vrefRmsMv / Math.max(0.0001, totalNoiseRmsMv));

  // Full-Scale ENOB = (SNR - 1.76) / 6.02
  const theoreticalEnob = (snrFullScaleDb - 1.76) / 6.02;
  const clampedEnob = Math.max(1.0, Math.min(totalHardwareBits, Number(theoreticalEnob.toFixed(2))));

  // Noise-free code resolution (bits where LSB never flickers with 99.9% probability):
  // log2(Vref / (6.6 * sigma))
  const noiseFreeResolutionBits = Math.max(
    0,
    Math.min(totalHardwareBits, Number((Math.log2((actualVref * 1000) / Math.max(0.01, noisePeakToPeakMv))).toFixed(2)))
  );

  // Dynamic range penalty from signal span under-utilization:
  // Loss = log2(Vspan / Vref)
  const spanLossBits = Math.log2(Math.max(0.001, clampedSpanVolts / actualVref));
  
  // Net Effective Usable Bits for this specific sensor signal range:
  const netSensorEnob = Math.max(0.5, Math.min(clampedEnob, Number((clampedEnob + spanLossBits).toFixed(2))));

  // Effective step resolution in mV
  const effectiveVoltageResolutionMv = (clampedSpanVolts * 1000) / activeCodesCount;

  // Flickering bits count (number of lowest bits that are unstable noise)
  const flickeringBitsCount = Math.max(0, Math.ceil(Math.log2(Math.max(1, noiseInLsbsPeakToPeak))));

  // ----------------------------------------------------
  // Interactive Probe & Code Distribution Simulation
  // ----------------------------------------------------
  const idealRawCode = Math.min(numRawCodes - 1, Math.max(0, Math.floor((effectiveProbeVoltage / actualVref) * numRawCodes)));
  const quantizedVoltageVolts = (idealRawCode / numRawCodes) * actualVref;
  const instantaneousQuantErrorMv = (effectiveProbeVoltage - quantizedVoltageVolts) * 1000;

  // Simulate Gaussian Readout Histogram around idealRawCode
  // Under PCB noise sigma_lsb
  const codeDistribution = useMemo(() => {
    const sigmaLsb = Math.max(0.1, noiseInLsbsRms);
    const centerCode = idealRawCode;
    const spread = Math.min(10, Math.max(3, Math.ceil(sigmaLsb * 3.5)));
    
    const items = [];
    let sumWeight = 0;

    for (let c = centerCode - spread; c <= centerCode + spread; c++) {
      if (c < 0 || c >= numRawCodes) continue;
      // Normal CDF difference for bin [c - 0.5, c + 0.5]
      // Approx with Gaussian PDF
      const diff = (c - (effectiveProbeVoltage / actualVref) * numRawCodes);
      const weight = Math.exp(-0.5 * Math.pow(diff / sigmaLsb, 2));
      items.push({ code: c, weight, diff });
      sumWeight += weight;
    }

    return items.map((item) => ({
      code: item.code,
      probabilityPercent: Number(((item.weight / (sumWeight || 1)) * 100).toFixed(1)),
      isCenter: item.code === centerCode
    }));
  }, [idealRawCode, noiseInLsbsRms, effectiveProbeVoltage, actualVref, numRawCodes]);

  // ----------------------------------------------------
  // Register Values & Bare-Metal AVR C Code Generation
  // ----------------------------------------------------
  const { admuxReg, refsName, refsBinary } = useMemo(() => {
    let refs = '00';
    let name = 'AREF pin external';
    if (vrefMode === 'avcc_5v' || vrefMode === 'avcc_3v3') {
      refs = '01';
      name = 'AVCC with external capacitor at AREF pin';
    } else if (vrefMode === 'internal_1v1') {
      if (selectedMCU === 'atmega328p') {
        refs = '11';
        name = 'Internal 1.1V Voltage Reference';
      } else {
        refs = '10'; // ATmega640
        name = 'Internal 1.1V Voltage Reference';
      }
    } else if (vrefMode === 'internal_2v56') {
      refs = '11';
      name = 'Internal 2.56V Voltage Reference';
    }

    const mux = selectedAdcChannel.toString(2).padStart(4, '0');
    return {
      admuxReg: `(1 << REFS0) | ${refs === '11' ? '(1 << REFS1) | ' : ''}(${selectedAdcChannel} & 0x07)`,
      refsName: name,
      refsBinary: refs
    };
  }, [vrefMode, selectedMCU, selectedAdcChannel]);

  const generatedCCode = useMemo(() => {
    const isSleepNoiseReduction = true;
    return `// ======================================================================
// ${currentProfile.name} ADC 정밀 노이즈 억제 & 고분해능 판독 드라이버
// 기준 전압: ${vrefMode} (${actualVref.toFixed(3)} V), 채널: ADC${selectedAdcChannel}
// 하드웨어 분해능: 10-bit (${lsbVoltageMv.toFixed(3)} mV/LSB)
// ${oversamplingBits > 0 ? `소프트웨어 오버샘플링: +${oversamplingBits}비트 (${oversampleFactor}x 샘플 누적 디시메이션)` : '단일 변환 모드'}
// 계산된 ENOB: ${clampedEnob.toFixed(2)} 비트 (노이즈: ${pcbNoiseMvRms} mV RMS)
// ======================================================================
#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/sleep.h>
#include <util/delay.h>

void ADC_Init(void) {
    // 1. 전원 공급 및 기준전압(Vref) 설정 (ADMUX)
    // REFS[1:0] = ${refsBinary} (${refsName})
    ADMUX = ${admuxReg};

    // 2. ADC 제어/상태 레지스터 A (ADCSRA)
    // ADEN: 인에이블, ADPS[2:0] = 7 (128 분주 -> 16MHz 기준 125kHz로 10비트 정밀도 보장)
    ADCSRA = (1 << ADEN) | (1 << ADPS2) | (1 << ADPS1) | (1 << ADPS0);

    // 3. 디지털 입력 버퍼 차단 (DIDR0: 불필요한 누설전류 및 노이즈 결합 방지)
    #ifdef DIDR0
    DIDR0 |= (1 << ADC${selectedAdcChannel}D);
    #endif

    // 초기 더미 변환 1회 수행 (내부 밴드갭 및 S/H 커패시터 안정화)
    ADCSRA |= (1 << ADSC);
    while (ADCSRA & (1 << ADSC));
}

${oversamplingBits > 0 ? `// ${totalHardwareBits}비트 오버샘플링 & 디시메이션 판독 함수 (${oversampleFactor}회 누적 후 >> ${oversamplingBits})
uint16_t ADC_Read_Oversampled(void) {
    uint32_t accumulator = 0;
    
    for (uint16_t i = 0; i < ${oversampleFactor}; i++) {
        // 변환 개시
        ADCSRA |= (1 << ADSC);
        while (ADCSRA & (1 << ADSC));
        accumulator += ADC;
    }
    
    // 비트 확장 디시메이션: 4^n회 누적 시 n비트 우측 시프트
    return (uint16_t)(accumulator >> ${oversamplingBits});
}` : `// 단일 10비트 변환 판독 (폴링 방식)
uint16_t ADC_Read_Single(void) {
    ADCSRA |= (1 << ADSC);
    while (ADCSRA & (1 << ADSC));
    return ADC;
}`}

// ADC 노이즈 리덕션 슬립 모드를 활용한 초저노이즈 측정 (CPU 코어 클럭 정지)
uint16_t ADC_Read_NoiseReduction_Sleep(void) {
    set_sleep_mode(SLEEP_MODE_ADC);
    sleep_enable();
    
    // ADC 완료 인터럽트 활성화
    ADCSRA |= (1 << ADIE);
    sei();
    
    // 슬립 진입 즉시 하드웨어가 ADC 변환을 자동 트리거함
    sleep_cpu();
    
    // 변환 완료 후 인터럽트에 의해 웨이크업
    sleep_disable();
    ADCSRA &= ~(1 << ADIE);
    
    return ADC;
}

ISR(ADC_vect) {
    // ADC 변환 완료 인터럽트 (CPU 웨이크업 트리거)
}`;
  }, [
    currentProfile.name,
    vrefMode,
    actualVref,
    selectedAdcChannel,
    lsbVoltageMv,
    oversamplingBits,
    oversampleFactor,
    clampedEnob,
    pcbNoiseMvRms,
    refsBinary,
    refsName,
    admuxReg,
    totalHardwareBits
  ]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-2">
            <Activity className="w-3.5 h-3.5" /> ADC Noise & Resolution Simulator
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            {currentProfile.name} ADC 양자화 오차 & PCB 노이즈 ENOB 시뮬레이터
          </h3>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            기준 전압(Vref)과 센서 입력 전압 범위에 따른 양자화 스텝(LSB) 및 양자화 오차 파형을 시각화하고,
            PCB 전원 리플/접지 바운스 노이즈(mV)가 실효 유효 비트(ENOB) 및 비트 플리커에 미치는 물리적 영향을 정밀 분석합니다.
          </p>
        </div>

        {/* Top Summary Badges */}
        <div className="flex flex-wrap sm:flex-nowrap gap-3">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-center min-w-[120px]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              1 LSB 전압폭
            </span>
            <span className="text-lg font-mono font-black text-cyan-400">
              {lsbVoltageMv.toFixed(2)} <span className="text-xs font-normal text-slate-400">mV</span>
            </span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-center min-w-[120px]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              실효 ENOB
            </span>
            <span className={`text-lg font-mono font-black ${
              clampedEnob >= 9.0 ? 'text-emerald-400' : clampedEnob >= 7.5 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {clampedEnob.toFixed(2)} <span className="text-xs font-normal text-slate-400">Bits</span>
            </span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-center min-w-[130px]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              센서 순 유효비트
            </span>
            <span className="text-lg font-mono font-black text-indigo-400">
              {netSensorEnob.toFixed(2)} <span className="text-xs font-normal text-slate-400">Bits</span>
            </span>
          </div>
        </div>
      </div>

      {/* Control Panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel 1: Reference Voltage (Vref) Selector */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" /> 1. 기준 전압 (Vref) 설정
            </span>
            <span className="text-xs font-mono font-semibold text-cyan-400">
              {actualVref.toFixed(3)} V
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400 block">Vref 소스 선택</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVrefMode('avcc_5v')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all ${
                  vrefMode === 'avcc_5v'
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-white">AVCC (5.0V)</div>
                <div className="text-[10px] text-slate-500 font-mono">표준 5V 전원</div>
              </button>

              <button
                type="button"
                onClick={() => setVrefMode('avcc_3v3')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all ${
                  vrefMode === 'avcc_3v3'
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-white">AVCC (3.3V)</div>
                <div className="text-[10px] text-slate-500 font-mono">3.3V 저전력</div>
              </button>

              {hasInternal1V1 && (
                <button
                  type="button"
                  onClick={() => setVrefMode('internal_1v1')}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all ${
                    vrefMode === 'internal_1v1'
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-white">내부 1.1V</div>
                  <div className="text-[10px] text-slate-500 font-mono">정밀 밴드갭</div>
                </button>
              )}

              {hasInternal2V56 && (
                <button
                  type="button"
                  onClick={() => setVrefMode('internal_2v56')}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all ${
                    vrefMode === 'internal_2v56'
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-white">내부 2.56V</div>
                  <div className="text-[10px] text-slate-500 font-mono">정밀 밴드갭</div>
                </button>
              )}

              <button
                type="button"
                onClick={() => setVrefMode('aref_ext')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all ${
                  vrefMode === 'aref_ext'
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-white">AREF 외부 (2.048V)</div>
                <div className="text-[10px] text-slate-500 font-mono">정밀 IC (2mV/LSB)</div>
              </button>

              <button
                type="button"
                onClick={() => setVrefMode('custom')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all ${
                  vrefMode === 'custom'
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-white">사용자 지정 Vref</div>
                <div className="text-[10px] text-slate-500 font-mono">임의 전압 입력</div>
              </button>
            </div>
          </div>

          {vrefMode === 'custom' && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>커스텀 Vref 전압</span>
                <span className="font-mono text-cyan-400">{customVref.toFixed(2)} V</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5.5"
                step="0.05"
                value={customVref}
                onChange={(e) => setCustomVref(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          )}

          {/* Oversampling Option */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> 소프트웨어 오버샘플링
              </span>
              <span className="text-amber-400 font-mono text-[11px]">
                {totalHardwareBits} 비트 ({oversampleFactor}x)
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { bits: 0, label: '10-bit (1x)' },
                { bits: 1, label: '11-bit (4x)' },
                { bits: 2, label: '12-bit (16x)' },
                { bits: 4, label: '14-bit (256x)' }
              ].map((opt) => (
                <button
                  key={opt.bits}
                  type="button"
                  onClick={() => setOversamplingBits(opt.bits)}
                  className={`py-1 text-[11px] font-mono rounded border transition-all ${
                    oversamplingBits === opt.bits
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Panel 2: Expected Signal Range Inputs */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-indigo-400" /> 2. 센서 신호 전압 범위
            </span>
            <span className="text-xs font-mono font-semibold text-indigo-400">
              {signalVmin.toFixed(2)}V ~ {signalVmax.toFixed(2)}V
            </span>
          </div>

          {/* Quick Sensor Presets */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 block">센서 동작 프리셋</label>
            <div className="flex flex-wrap gap-1.5">
              {signalPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSignalVmin(preset.vmin);
                    setSignalVmax(preset.vmax);
                    setProbeVoltage(Number(((preset.vmin + preset.vmax) / 2).toFixed(2)));
                  }}
                  className="px-2 py-1 text-[11px] bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded hover:text-white transition-all text-left"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Sliders for Vmin and Vmax */}
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>최소 전압 (V_min)</span>
                <span className="font-mono text-indigo-400">{signalVmin.toFixed(2)} V</span>
              </div>
              <input
                type="range"
                min="0.0"
                max={actualVref}
                step="0.05"
                value={signalVmin}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSignalVmin(val);
                  if (val > signalVmax) setSignalVmax(val + 0.1);
                }}
                className="w-full accent-indigo-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>최대 전압 (V_max)</span>
                <span className="font-mono text-indigo-400">{signalVmax.toFixed(2)} V</span>
              </div>
              <input
                type="range"
                min="0.05"
                max={Number((actualVref * 1.1).toFixed(2))}
                step="0.05"
                value={signalVmax}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSignalVmax(val);
                  if (val < signalVmin) setSignalVmin(Math.max(0, val - 0.1));
                }}
                className="w-full accent-indigo-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Signal Range Utilization Warning / Status */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>유효 다이내믹 스팬:</span>
              <span className="font-mono font-bold text-white">{clampedSpanVolts.toFixed(3)} V</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Vref 풀스케일 활용률:</span>
              <span className={`font-mono font-bold ${
                fullScaleUtilizationPercent >= 70 ? 'text-emerald-400' : fullScaleUtilizationPercent >= 40 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {fullScaleUtilizationPercent.toFixed(1)} %
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>할당된 디지털 코드수:</span>
              <span className="font-mono font-bold text-cyan-400">
                {activeCodesCount.toLocaleString()} / {numRawCodes} 단계
              </span>
            </div>

            {isClipping && (
              <div className="flex items-center gap-1.5 text-rose-400 text-[11px] pt-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>경고: 신호(V_max)가 Vref를 초과하여 코드 클리핑 발생!</span>
              </div>
            )}
          </div>
        </div>

        {/* Panel 3: PCB & System Noise (mV) */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> 3. PCB & 전원 노이즈 (mV)
            </span>
            <span className="text-xs font-mono font-semibold text-rose-400">
              {pcbNoiseMvRms.toFixed(1)} mV RMS
            </span>
          </div>

          {/* Noise Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>PCB 아날로그 라인 노이즈</span>
              <span className="font-mono text-rose-400 font-bold">{pcbNoiseMvRms.toFixed(1)} mV RMS</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="35.0"
              step="0.1"
              value={pcbNoiseMvRms}
              onChange={(e) => setPcbNoiseMvRms(parseFloat(e.target.value))}
              className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0.1 mV (실드룸)</span>
              <span>10 mV (스위칭)</span>
              <span>35 mV (극심)</span>
            </div>
          </div>

          {/* Noise Presets */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs text-slate-400 block">실제 환경 노이즈 프리셋</label>
            <div className="space-y-1">
              {noisePresets.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPcbNoiseMvRms(item.noiseMvRms)}
                  className={`w-full px-2.5 py-1.5 rounded text-left text-xs transition-all flex items-center justify-between border ${
                    Math.abs(pcbNoiseMvRms - item.noiseMvRms) < 0.1
                      ? 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                      : 'bg-slate-900 border-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="truncate pr-2">{item.name}</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400">
                    {item.noiseMvRms} mV
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Noise in LSB metric */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>노이즈 Peak-to-Peak (6.6σ):</span>
              <span className="font-mono font-bold text-rose-300">
                {noisePeakToPeakMv.toFixed(2)} mV p-p
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>노이즈 크기 (LSB 단위):</span>
              <span className={`font-mono font-bold ${
                noiseInLsbsPeakToPeak > 1.0 ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                {noiseInLsbsPeakToPeak.toFixed(2)} LSB p-p
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>불안정 플리커 비트:</span>
              <span className="font-mono font-bold text-amber-400">
                하위 {flickeringBitsCount}개 비트 요동
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Range Utilization Bar */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" /> Vref 전압 대역 대비 센서 신호 윈도우 점유율
          </span>
          <span className="font-mono text-slate-400">
            0V ~ {actualVref.toFixed(2)}V (총 {numRawCodes} Codes)
          </span>
        </div>

        {/* Visual Bar */}
        <div className="h-6 w-full bg-slate-900 rounded-lg overflow-hidden flex relative border border-slate-800">
          {/* Below Vmin (Wasted Bottom) */}
          <div
            style={{ width: `${Math.min(100, (activeUsableVmin / actualVref) * 100)}%` }}
            className="h-full bg-slate-800/80 flex items-center justify-center text-[10px] text-slate-500 font-mono"
            title={`미사용 하한 대역: 0V ~ ${activeUsableVmin.toFixed(2)}V`}
          >
            {((activeUsableVmin / actualVref) * 100) > 10 ? '미사용' : ''}
          </div>

          {/* Active Sensor Window */}
          <div
            style={{ width: `${Math.min(100, (clampedSpanVolts / actualVref) * 100)}%` }}
            className="h-full bg-gradient-to-r from-cyan-600 via-indigo-600 to-indigo-500 flex items-center justify-center text-[11px] font-bold text-white font-mono shadow-inner relative group"
            title={`유효 센서 윈도우: ${activeUsableVmin.toFixed(2)}V ~ ${activeUsableVmax.toFixed(2)}V (${activeCodesCount} 단계)`}
          >
            <span className="drop-shadow-sm px-2 truncate">
              센서 입력 대역 ({activeCodesCount.toLocaleString()} 단계, {fullScaleUtilizationPercent.toFixed(1)}%)
            </span>
          </div>

          {/* Above Vmax (Wasted Top) */}
          <div
            style={{ width: `${Math.max(0, 100 - (activeUsableVmax / actualVref) * 100)}%` }}
            className="h-full bg-slate-800/80 flex items-center justify-center text-[10px] text-slate-500 font-mono"
            title={`미사용 상한 여유: ${activeUsableVmax.toFixed(2)}V ~ ${actualVref.toFixed(2)}V`}
          >
            {(100 - (activeUsableVmax / actualVref) * 100) > 10 ? '미사용' : ''}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-gradient-to-r from-cyan-500 to-indigo-500 inline-block" />
              활성 코드: Code {codeMin} ~ Code {codeMax}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-slate-800 inline-block" />
              낭비된 코드: {(numRawCodes - activeCodesCount).toLocaleString()}개
            </span>
          </div>

          <div className="font-mono text-slate-400">
            센서 실효 분해능: <strong className="text-cyan-400">{effectiveVoltageResolutionMv.toFixed(3)} mV</strong> / 단계
          </div>
        </div>
      </div>

      {/* Main Visualization & Diagnostic Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Quantization Staircase & Error Waveform SVG */}
        <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-cyan-400" /> 양자화 계단(Staircase) & 양자화 오차 파형 시각화
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                아날로그 입력 전압에 따른 ADC 출력 코드와 톱니파(Sawtooth) 양자화 오차 $e(V)$
              </p>
            </div>

            {/* Interactive Probe Voltage Input */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">입력 탐침:</span>
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                <input
                  type="number"
                  min="0"
                  max={actualVref}
                  step="0.05"
                  value={probeVoltage}
                  onChange={(e) => setProbeVoltage(parseFloat(e.target.value) || 0)}
                  className="w-16 bg-transparent text-xs font-mono font-bold text-cyan-400 outline-none text-right"
                />
                <span className="text-xs text-slate-400 ml-1">V</span>
              </div>
            </div>
          </div>

          {/* SVG Waveform Canvas */}
          <div className="relative bg-slate-950 border border-slate-800 rounded-lg p-2 overflow-hidden">
            <svg
              viewBox="0 0 600 320"
              className="w-full h-auto select-none"
              style={{ maxHeight: '340px' }}
            >
              <defs>
                {/* Grid Pattern */}
                <pattern id="adc-grid" width="30" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                </pattern>
                {/* Noise Blur Filter for Gaussian Uncertainty */}
                <filter id="noise-blur" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation={Math.min(5, Math.max(0.8, (pcbNoiseMvRms / lsbVoltageMv) * 1.5))} />
                </filter>
                {/* Gradients */}
                <linearGradient id="quantGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
                <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#f43f5e" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.8" />
                </linearGradient>
              </defs>

              {/* Grid Background */}
              <rect x="40" y="20" width="540" height="180" fill="url(#adc-grid)" />
              <rect x="40" y="220" width="540" height="70" fill="url(#adc-grid)" />

              {/* Y Axis for Upper Plot (ADC Output Code) */}
              <line x1="40" y1="20" x2="40" y2="200" stroke="#475569" strokeWidth="1.5" />
              <line x1="40" y1="200" x2="580" y2="200" stroke="#475569" strokeWidth="1.5" />

              <text x="35" y="30" fill="#94a3b8" fontSize="10" textAnchor="end" fontFamily="monospace">Code</text>
              <text x="35" y="35" fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">
                {numRawCodes - 1}
              </text>
              <text x="35" y="115" fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">
                {numRawCodes / 2}
              </text>
              <text x="35" y="198" fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">0</text>

              {/* Y Axis for Lower Plot (Quantization Error in mV) */}
              <line x1="40" y1="220" x2="40" y2="290" stroke="#475569" strokeWidth="1.5" />
              <line x1="40" y1="255" x2="580" y2="255" stroke="#475569" strokeWidth="1" strokeDasharray="3,3" />

              <text x="35" y="230" fill="#f43f5e" fontSize="8" textAnchor="end" fontFamily="monospace">
                +{maxQuantErrorMv.toFixed(1)}mV
              </text>
              <text x="35" y="258" fill="#94a3b8" fontSize="8" textAnchor="end" fontFamily="monospace">
                0
              </text>
              <text x="35" y="288" fill="#f43f5e" fontSize="8" textAnchor="end" fontFamily="monospace">
                -{maxQuantErrorMv.toFixed(1)}mV
              </text>
              <text x="580" y="268" fill="#94a3b8" fontSize="9" textAnchor="end" fontFamily="monospace">
                양자화 오차 e(V)
              </text>

              {/* X Axis Voltage Markers */}
              <text x="40" y="308" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace">0V</text>
              <text x="175" y="308" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace">
                {(actualVref * 0.25).toFixed(2)}V
              </text>
              <text x="310" y="308" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace">
                {(actualVref * 0.5).toFixed(2)}V
              </text>
              <text x="445" y="308" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace">
                {(actualVref * 0.75).toFixed(2)}V
              </text>
              <text x="580" y="308" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace">
                {actualVref.toFixed(2)}V
              </text>

              {/* Ideal Analog Transfer Line (Diagonal) */}
              <line
                x1="40"
                y1="200"
                x2="580"
                y2="20"
                stroke="#334155"
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />

              {/* Sensor Active Window Highlight Box */}
              {(() => {
                const xMin = 40 + (activeUsableVmin / actualVref) * 540;
                const xMax = 40 + (activeUsableVmax / actualVref) * 540;
                const width = Math.max(1, xMax - xMin);
                return (
                  <rect
                    x={xMin}
                    y="20"
                    width={width}
                    height="180"
                    fill="#38bdf8"
                    fillOpacity="0.04"
                    stroke="#38bdf8"
                    strokeWidth="0.5"
                    strokeDasharray="2,2"
                  />
                );
              })()}

              {/* Staircase Steps Generator (Render ~32 prominent steps for clean display) */}
              {(() => {
                const stepsCount = 32;
                const stepWidth = 540 / stepsCount;
                const stepHeight = 180 / stepsCount;
                const pathParts: string[] = [];

                for (let i = 0; i < stepsCount; i++) {
                  const xStart = 40 + i * stepWidth;
                  const xEnd = xStart + stepWidth;
                  const y = 200 - i * stepHeight;
                  if (i === 0) {
                    pathParts.push(`M ${xStart} ${y} L ${xEnd} ${y}`);
                  } else {
                    pathParts.push(`L ${xStart} ${y} L ${xEnd} ${y}`);
                  }
                }

                return (
                  <>
                    {/* Noise Blur Envelope on Staircase */}
                    {pcbNoiseMvRms > 1.0 && (
                      <path
                        d={pathParts.join(' ')}
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth={Math.min(10, Math.max(2, (pcbNoiseMvRms / lsbVoltageMv) * 4))}
                        strokeOpacity="0.25"
                        filter="url(#noise-blur)"
                      />
                    )}
                    {/* Main Quantized Staircase Line */}
                    <path
                      d={pathParts.join(' ')}
                      fill="none"
                      stroke="url(#quantGrad)"
                      strokeWidth="2"
                    />
                  </>
                );
              })()}

              {/* Quantization Error Sawtooth Wave Generator in Bottom Subplot */}
              {(() => {
                const teethCount = 32;
                const toothWidth = 540 / teethCount;
                const pathParts: string[] = [];

                for (let i = 0; i < teethCount; i++) {
                  const xStart = 40 + i * toothWidth;
                  const xEnd = xStart + toothWidth;
                  const yTop = 255 - 28; // +0.5 LSB
                  const yBottom = 255 + 28; // -0.5 LSB
                  
                  if (i === 0) {
                    pathParts.push(`M ${xStart} ${yBottom} L ${xEnd} ${yTop} L ${xEnd} ${yBottom}`);
                  } else {
                    pathParts.push(`L ${xEnd} ${yTop} L ${xEnd} ${yBottom}`);
                  }
                }

                return (
                  <>
                    <path
                      d={pathParts.join(' ')}
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="1.2"
                    />
                    {/* PCB Noise spread envelope in lower error plot */}
                    <line
                      x1="40"
                      y1={Math.max(225, 255 - (totalNoiseRmsMv / lsbVoltageMv) * 28)}
                      x2="580"
                      y2={Math.max(225, 255 - (totalNoiseRmsMv / lsbVoltageMv) * 28)}
                      stroke="#fbbf24"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                      strokeOpacity="0.8"
                    />
                    <line
                      x1="40"
                      y1={Math.min(285, 255 + (totalNoiseRmsMv / lsbVoltageMv) * 28)}
                      x2="580"
                      y2={Math.min(285, 255 + (totalNoiseRmsMv / lsbVoltageMv) * 28)}
                      stroke="#fbbf24"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                      strokeOpacity="0.8"
                    />
                  </>
                );
              })()}

              {/* Interactive Probe Line & Marker */}
              {(() => {
                const probeX = 40 + (effectiveProbeVoltage / actualVref) * 540;
                const probeY = 200 - (idealRawCode / numRawCodes) * 180;
                return (
                  <g>
                    {/* Vertical Probe Line across both plots */}
                    <line
                      x1={probeX}
                      y1="15"
                      x2={probeX}
                      y2="295"
                      stroke="#22d3ee"
                      strokeWidth="1.5"
                      strokeDasharray="3,2"
                    />
                    {/* Probe Indicator Circle on Staircase */}
                    <circle
                      cx={probeX}
                      cy={probeY}
                      r="5"
                      fill="#06b6d4"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    {/* Value Tooltip Label */}
                    <rect
                      x={Math.min(480, Math.max(45, probeX - 55))}
                      y={Math.max(22, probeY - 26)}
                      width="110"
                      height="20"
                      rx="4"
                      fill="#0f172a"
                      stroke="#06b6d4"
                      strokeWidth="1"
                    />
                    <text
                      x={Math.min(480, Math.max(45, probeX - 55)) + 55}
                      y={Math.max(22, probeY - 26) + 14}
                      fill="#e2e8f0"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {effectiveProbeVoltage.toFixed(2)}V → Code {idealRawCode}
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>

          {/* Interactive Probe Voltage Slider */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" /> 탐침 입력 전압 이동
              </span>
              <span className="font-mono text-cyan-400 font-bold">
                {effectiveProbeVoltage.toFixed(3)} V
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max={actualVref}
              step="0.01"
              value={effectiveProbeVoltage}
              onChange={(e) => setProbeVoltage(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Real-time Probe Numerical Inspection Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
              <span className="text-[10px] text-slate-400 block">변환 디지털 코드</span>
              <span className="text-sm font-mono font-bold text-white">
                {idealRawCode} <span className="text-[10px] text-slate-500 font-normal">/ {numRawCodes - 1}</span>
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
              <span className="text-[10px] text-slate-400 block">양자화 전압 (Q)</span>
              <span className="text-sm font-mono font-bold text-indigo-400">
                {quantizedVoltageVolts.toFixed(3)} <span className="text-[10px] text-slate-400">V</span>
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
              <span className="text-[10px] text-slate-400 block">순시 양자화 오차</span>
              <span className="text-sm font-mono font-bold text-rose-400">
                {instantaneousQuantErrorMv >= 0 ? '+' : ''}{instantaneousQuantErrorMv.toFixed(2)} <span className="text-[10px] text-slate-400">mV</span>
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
              <span className="text-[10px] text-slate-400 block">최대 이론 오차</span>
              <span className="text-sm font-mono font-bold text-amber-400">
                ±{maxQuantErrorMv.toFixed(2)} <span className="text-[10px] text-slate-400">mV</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): PCB Noise Impact, Code Histogram & ENOB Waterfall */}
        <div className="lg:col-span-5 space-y-4">
          {/* Box 1: Simulated Readout Histogram under PCB Noise */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-rose-400" /> PCB 노이즈에 의한 ADC 코드 흔들림(Flicker)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  DC {effectiveProbeVoltage.toFixed(2)}V 입력 시 연속 1,000회 변환 판독값의 가우시안 분포
                </p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                noiseInLsbsPeakToPeak > 1.0 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                ±{(noiseInLsbsPeakToPeak / 2).toFixed(1)} LSB
              </span>
            </div>

            {/* Histogram Bars */}
            <div className="space-y-1.5 pt-1">
              {codeDistribution.map((item) => (
                <div key={item.code} className="flex items-center gap-2 text-xs">
                  <span className={`w-16 font-mono text-[11px] text-right ${
                    item.isCenter ? 'font-bold text-cyan-400' : 'text-slate-400'
                  }`}>
                    Code {item.code}
                  </span>
                  
                  <div className="flex-1 h-4 bg-slate-900 rounded overflow-hidden relative">
                    <div
                      style={{ width: `${item.probabilityPercent}%` }}
                      className={`h-full rounded transition-all ${
                        item.isCenter
                          ? 'bg-gradient-to-r from-cyan-500 to-indigo-500'
                          : 'bg-rose-500/60'
                      }`}
                    />
                  </div>

                  <span className="w-12 font-mono text-[10px] text-slate-300 text-right">
                    {item.probabilityPercent}%
                  </span>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-900/60 rounded-lg p-2.5 border border-slate-800">
              <span className="font-semibold text-slate-200">분석 결과: </span>
              {noiseInLsbsPeakToPeak <= 0.5 ? (
                <span className="text-emerald-400">노이즈가 0.5 LSB 이하로 코드 플리커 없이 100% 안정적인 단일 코드를 유지합니다.</span>
              ) : noiseInLsbsPeakToPeak <= 2.0 ? (
                <span className="text-amber-400">인접한 ±1~2 LSB 범위에서 비트 떨림이 발생합니다. 최하위 1개 비트가 불안정합니다.</span>
              ) : (
                <span className="text-rose-400">
                  노이즈가 {noiseInLsbsPeakToPeak.toFixed(1)} LSB에 달하여 하위 {flickeringBitsCount}개 비트가 심하게 요동치며 실효 해상도가 파괴됩니다.
                </span>
              )}
            </div>
          </div>

          {/* Box 2: ENOB Loss Breakdown & Waterfall */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <TrendingDown className="w-3.5 h-3.5 text-amber-400" /> 실효 유효 비트(ENOB) 열화 요인 분해
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3 h-3 text-cyan-400" /> 하드웨어 공칭 분해능 (Nominal)
                </span>
                <span className="font-mono font-bold text-white">+{totalHardwareBits}.00 Bits</span>
              </div>

              <div className="flex justify-between items-center text-slate-400">
                <span className="pl-4.5">(-) 이론적 양자화 노이즈 한계</span>
                <span className="font-mono text-amber-400">-0.24 Bits</span>
              </div>

              <div className="flex justify-between items-center text-slate-400">
                <span className="pl-4.5">(-) PCB 리플 & 접지 노이즈 손실</span>
                <span className="font-mono text-rose-400">
                  -{(totalHardwareBits - 0.24 - clampedEnob).toFixed(2)} Bits
                </span>
              </div>

              <div className="pt-1.5 border-t border-slate-800 flex justify-between items-center font-bold">
                <span className="text-emerald-400">하드웨어 실효 ENOB</span>
                <span className="font-mono text-emerald-400 text-sm">{clampedEnob.toFixed(2)} Bits</span>
              </div>

              <div className="flex justify-between items-center text-slate-400">
                <span className="pl-4.5">(-) 센서 전압 미활용 대역 손실</span>
                <span className="font-mono text-rose-400">
                  {spanLossBits.toFixed(2)} Bits
                </span>
              </div>

              <div className="pt-1.5 border-t border-slate-800 flex justify-between items-center font-bold bg-slate-900/90 rounded-lg p-2.5 border border-slate-700/60">
                <span className="text-indigo-300">센서 신호 순 유효 분해능 (Net ENOB)</span>
                <span className="font-mono text-indigo-300 text-base">{netSensorEnob.toFixed(2)} Bits</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center pt-1">
              <div className="bg-slate-900 border border-slate-800 rounded p-2">
                <span className="text-[10px] text-slate-400 block">풀스케일 SNR</span>
                <span className="text-xs font-mono font-bold text-cyan-400">{snrFullScaleDb.toFixed(1)} dB</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded p-2">
                <span className="text-[10px] text-slate-400 block">무잡음 비트 (Noise-Free)</span>
                <span className="text-xs font-mono font-bold text-amber-400">{noiseFreeResolutionBits.toFixed(2)} Bits</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Engineering Diagnosis & Hardware Recommendations */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> 엔지니어링 최적화 진단 & PCB 레이아웃 가이드
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <div className="font-bold text-cyan-300 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> 1. Vref 적정성 최적화
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              {fullScaleUtilizationPercent < 50 ? (
                <span>
                  현재 센서 입력({signalVmax}V)이 Vref({actualVref}V)의 {fullScaleUtilizationPercent.toFixed(0)}%만 사용하여 
                  <strong className="text-rose-400"> {(totalHardwareBits - netSensorEnob).toFixed(1)} 비트의 분해능이 허공에 낭비</strong>되고 있습니다.
                  {hasInternal1V1 && signalVmax <= 1.1 ? (
                    <>
                      <strong className="text-cyan-300"> Vref를 &apos;내부 1.1V 밴드갭&apos;으로 변경</strong>하여 분해능을 극대화하십시오.
                    </>
                  ) : (
                    ' 전치 연산증폭기(Op-Amp) 게인 회로를 추가하여 전압 범위를 Vref 풀스케일까지 확장하십시오.'
                  )}
                </span>
              ) : (
                <span className="text-emerald-400">
                  센서 동작 범위가 Vref의 {fullScaleUtilizationPercent.toFixed(0)}%를 사용하여 매우 우수한 다이내믹 레인지를 확보하고 있습니다.
                </span>
              )}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <div className="font-bold text-cyan-300 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> 2. AVCC 전원 필터링 (LC 회로)
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              디지털 VCC와 AVCC 핀 사이에 <strong className="text-slate-200">10 µH 인덕터</strong>와 
              <strong className="text-slate-200"> 100 nF 커패시터</strong>로 저역통과 필터(Cutoff ≈ 159 kHz)를 구성하면
              디지털 스위칭 고주파 리플을 20dB 이상 감쇄시켜 ENOB를 최대 1.5비트 이상 향상시킵니다.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <div className="font-bold text-cyan-300 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5" /> 3. AREF 핀 디커플링 주의사항
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              내부 기준전압(1.1V / 2.56V) 또는 AVCC를 Vref로 선택한 경우, <strong className="text-rose-400">절대 AREF 핀에 외부 전압을 인가하지 마십시오</strong> (내부 쇼트로 MCU 소손 위험).
              AREF 핀과 GND 사이에 100nF 세라믹 커패시터만 단독 연결하여 내부 밴드갭 노이즈를 접지로 바이패스하십시오.
            </p>
          </div>
        </div>
      </div>

      {/* Code Generation Section */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" /> Bare-Metal AVR C 초기화 & 노이즈 억제 드라이버 코드
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              선택한 Vref({vrefMode}) 및 슬립모드 노이즈 억제(SMCR)가 적용된 고정밀 C 라이브러리
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* ADC Channel Select */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs">
              <span className="text-slate-400">입력 채널:</span>
              <select
                value={selectedAdcChannel}
                onChange={(e) => setSelectedAdcChannel(parseInt(e.target.value))}
                className="bg-transparent text-cyan-400 font-mono font-bold outline-none cursor-pointer"
              >
                {Array.from({ length: currentProfile.adc || 8 }).map((_, idx) => (
                  <option key={idx} value={idx} className="bg-slate-900 text-slate-200">
                    ADC{idx} ({currentProfile.name})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition-all shadow-md shadow-cyan-500/20"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? '복사 완료!' : 'C 소스 복사'}
            </button>
          </div>
        </div>

        <div className="relative">
          <pre className="bg-slate-950 text-slate-300 font-mono text-xs p-4 rounded-lg overflow-x-auto border border-slate-800/80 leading-relaxed max-h-72">
            {generatedCCode}
          </pre>
        </div>
      </div>
    </div>
  );
};
