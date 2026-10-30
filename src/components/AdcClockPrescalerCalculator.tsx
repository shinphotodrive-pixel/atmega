import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Check,
  Cpu,
  Gauge,
  Info,
  Layers,
  RotateCcw,
  Sliders,
  Sparkles,
  Zap,
  TrendingUp,
  XCircle
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export interface PrescalerOption {
  factor: number;
  adpsBits: string;
  adpsVal: number;
  label: string;
  isDuplicate2?: boolean;
}

export const ADC_PRESCALERS: PrescalerOption[] = [
  { factor: 2, adpsBits: '001', adpsVal: 1, label: '÷2 (ADPS=001)' },
  { factor: 4, adpsBits: '010', adpsVal: 2, label: '÷4 (ADPS=010)' },
  { factor: 8, adpsBits: '011', adpsVal: 3, label: '÷8 (ADPS=011)' },
  { factor: 16, adpsBits: '100', adpsVal: 4, label: '÷16 (ADPS=100)' },
  { factor: 32, adpsBits: '101', adpsVal: 5, label: '÷32 (ADPS=101)' },
  { factor: 64, adpsBits: '110', adpsVal: 6, label: '÷64 (ADPS=110)' },
  { factor: 128, adpsBits: '111', adpsVal: 7, label: '÷128 (ADPS=111, 표준 권장)' }
];

const CLOCK_PRESETS = [
  { fcpu: 1000000, label: '1.0 MHz', desc: '내부 RC 기본' },
  { fcpu: 4000000, label: '4.0 MHz', desc: '저전력 동작' },
  { fcpu: 8000000, label: '8.0 MHz', desc: '3.3V Pro Mini / 내부 RC' },
  { fcpu: 12000000, label: '12.0 MHz', desc: 'V-USB 표준' },
  { fcpu: 16000000, label: '16.0 MHz', desc: '표준 5V Uno / Mega' },
  { fcpu: 20000000, label: '20.0 MHz', desc: 'AVR 정격 최대 클럭' }
];

export const AdcClockPrescalerCalculator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // 1. System Clock State (F_CPU in Hz)
  const [fcpu, setFcpu] = useState<number>(16000000);
  const [fcpuInputMhz, setFcpuInputMhz] = useState<string>('16.0');
  const [isCustomFcpu, setIsCustomFcpu] = useState<boolean>(false);

  // 2. ADC Prescaler State (ADPS2:0: 2, 4, 8, 16, 32, 64, 128)
  const [prescaler, setPrescaler] = useState<number>(128);

  // 3. Conversion Mode
  // Normal: 13 cycles, First: 25 cycles, FreeRunning: 13.5 cycles
  const [conversionType, setConversionType] = useState<'normal' | 'first' | 'free_running'>('normal');

  // 4. Target Application Priority
  const [targetResolution, setTargetResolution] = useState<'10bit' | '8bit'>('10bit');

  // 5. Source Impedance (R_in in kΩ, datasheet max 10kΩ)
  const [sourceImpedanceKohm, setSourceImpedanceKohm] = useState<number>(10);

  // 6. Copy Status
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  // Handle Clock Preset Selection
  const handleSelectClockPreset = (hz: number) => {
    setFcpu(hz);
    setFcpuInputMhz((hz / 1000000).toString());
    setIsCustomFcpu(false);
  };

  const handleCustomClockChange = (mhzStr: string) => {
    setFcpuInputMhz(mhzStr);
    const mhz = parseFloat(mhzStr);
    if (!isNaN(mhz) && mhz > 0 && mhz <= 30) {
      setFcpu(Math.round(mhz * 1000000));
      setIsCustomFcpu(true);
    }
  };

  // Conversion cycle count based on mode
  const cyclesPerConversion = useMemo(() => {
    switch (conversionType) {
      case 'first':
        return 25;
      case 'free_running':
        return 13.5;
      case 'normal':
      default:
        return 13;
    }
  }, [conversionType]);

  // Calculations for Active Configuration
  const currentPrescalerObj = useMemo(() => {
    return ADC_PRESCALERS.find((p) => p.factor === prescaler) || ADC_PRESCALERS[6];
  }, [prescaler]);

  // ADC Clock Frequency: f_ADC = F_CPU / Prescaler
  const adcClockHz = useMemo(() => fcpu / prescaler, [fcpu, prescaler]);
  const adcClockKhz = adcClockHz / 1000;
  const adcClockPeriodNs = (1 / adcClockHz) * 1e9; // T_ADC in ns

  // Conversion Time: t_conv = cycles / f_ADC
  const conversionTimeUs = (cyclesPerConversion / adcClockHz) * 1e6;
  const sampleHoldTimeUs = (1.5 / adcClockHz) * 1e6; // 1.5 ADC cycles
  const samplingRateKsps = 1000 / conversionTimeUs; // kSPS (kilo samples per second)

  // Source Impedance RC Time Constant
  // Internal S/H capacitor C_S ≈ 14 pF. Internal MUX resistance R_mux ≈ 1~10 kΩ.
  // Required settling time for 10-bit accuracy (0.5 LSB): ~7 * tau
  const totalRinKohm = sourceImpedanceKohm + 5; // adding approx 5k internal MUX R
  const tauNs = totalRinKohm * 1e3 * 14e-12 * 1e9; // in nanoseconds
  const settlingTime10BitUs = (7.6 * totalRinKohm * 1e3 * 14e-12) * 1e6;
  const isImpedanceSettlingWarning = settlingTime10BitUs > sampleHoldTimeUs;

  // Accuracy & Operating Zone Analysis
  // Datasheet: 50 kHz <= f_ADC <= 200 kHz for full 10-bit resolution
  // 200 kHz < f_ADC <= 1000 kHz for 8-bit fast resolution
  // f_ADC > 1000 kHz out of hardware spec
  // f_ADC < 50 kHz leakage droop
  const zoneAnalysis = useMemo(() => {
    if (adcClockKhz >= 50 && adcClockKhz <= 200) {
      return {
        zone: 'optimal_10bit',
        badge: '최적 10비트 고정밀 구간 (50~200 kHz)',
        color: 'text-emerald-400',
        bg: 'bg-emerald-950/60 border-emerald-500/40',
        enob: 10.0,
        desc: '데이터시트 정격 권장 클록. SAR 비교기가 10비트 전체 코드(1024 스텝)에 걸쳐 비선형성 오차(DNL/INL) 없이 완벽히 수렴합니다.'
      };
    } else if (adcClockKhz > 200 && adcClockKhz <= 1000) {
      // 200kHz to 1MHz
      const penalty = Math.min(2.0, ((adcClockKhz - 200) / 800) * 2.0);
      const enob = +(10.0 - penalty).toFixed(1);
      return {
        zone: 'fast_8bit',
        badge: '고속 8비트 허용 구간 (200~1000 kHz)',
        color: 'text-cyan-400',
        bg: 'bg-cyan-950/60 border-cyan-500/40',
        enob,
        desc: '변환 속도가 빨라지나 하위 1~2비트의 양자화 노이즈가 증가합니다. 8비트 분해능(ADLAR=1, ADCH만 읽기) 또는 고주파 센서 스트리밍에 적합합니다.'
      };
    } else if (adcClockKhz > 1000) {
      return {
        zone: 'out_of_spec_fast',
        badge: '규격 초과 위험 구간 (> 1000 kHz)',
        color: 'text-rose-400',
        bg: 'bg-rose-950/60 border-rose-500/50',
        enob: 6.5,
        desc: 'AVR SAR ADC 정격 한계를 초과했습니다. 비교기가 중간 비트 판단을 완료하지 못해 코드 누락(Missing Codes) 및 심각한 전송 왜곡이 발생합니다.'
      };
    } else {
      // < 50 kHz
      return {
        zone: 'too_slow',
        badge: '과도 저속 누설 드리프트 (< 50 kHz)',
        color: 'text-amber-400',
        bg: 'bg-amber-950/60 border-amber-500/40',
        enob: 9.2,
        desc: 'ADC 클럭이 너무 느려 13클록 동안 내부 S/H 커패시터(14pF)의 전하가 미세 누설(Leakage current)되어 측정값 전압 강하가 발생할 수 있습니다.'
      };
    }
  }, [adcClockKhz]);

  // Sweep Matrix for All 7 Prescalers
  const prescalerSweep = useMemo(() => {
    return ADC_PRESCALERS.map((p) => {
      const clkHz = fcpu / p.factor;
      const clkKhz = clkHz / 1000;
      const convUs = (13 / clkHz) * 1e6;
      const shUs = (1.5 / clkHz) * 1e6;
      const ksps = 1000 / convUs;

      let qualityTag = '';
      let qualityColor = '';
      let isRecommended = false;

      if (clkKhz >= 50 && clkKhz <= 200) {
        qualityTag = '10비트 고정밀 (최적)';
        qualityColor = 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40';
        isRecommended = true;
      } else if (clkKhz > 200 && clkKhz <= 1000) {
        qualityTag = '고속 (8비트 권장)';
        qualityColor = 'text-cyan-400 bg-cyan-950/50 border-cyan-800/40';
      } else if (clkKhz > 1000) {
        qualityTag = '규격 초과 (>1MHz)';
        qualityColor = 'text-rose-400 bg-rose-950/50 border-rose-800/40';
      } else {
        qualityTag = '누설 주의 (<50kHz)';
        qualityColor = 'text-amber-400 bg-amber-950/50 border-amber-800/40';
      }

      return {
        ...p,
        clkHz,
        clkKhz,
        convUs,
        shUs,
        ksps,
        qualityTag,
        qualityColor,
        isRecommended
      };
    });
  }, [fcpu]);

  // Recommended Prescalers for Auto-Optimization
  const optimal10BitPrescaler = useMemo(() => {
    const candidates = prescalerSweep.filter((p) => p.clkKhz >= 50 && p.clkKhz <= 200);
    if (candidates.length > 0) {
      // Pick the highest frequency within 50~200kHz for fastest 10-bit conversion
      return candidates.reduce((prev, curr) => (curr.clkKhz > prev.clkKhz ? curr : prev)).factor;
    }
    // Fallback: closest to 125kHz
    return prescalerSweep.reduce((prev, curr) =>
      Math.abs(curr.clkKhz - 125) < Math.abs(prev.clkKhz - 125) ? curr : prev
    ).factor;
  }, [prescalerSweep]);

  const optimal8BitPrescaler = useMemo(() => {
    const candidates = prescalerSweep.filter((p) => p.clkKhz > 200 && p.clkKhz <= 1000);
    if (candidates.length > 0) {
      return candidates.reduce((prev, curr) => (curr.clkKhz > prev.clkKhz ? curr : prev)).factor;
    }
    return 16;
  }, [prescalerSweep]);

  // Auto-tune triggers
  const handleOptimize10Bit = () => {
    setPrescaler(optimal10BitPrescaler);
    setTargetResolution('10bit');
    confetti({ particleCount: 20, spread: 45, origin: { y: 0.6 } });
  };

  const handleOptimizeSpeed = () => {
    setPrescaler(optimal8BitPrescaler);
    setTargetResolution('8bit');
    confetti({ particleCount: 25, spread: 50, origin: { y: 0.6 } });
  };

  // Copy helpers
  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopySummary = () => {
    const summaryText = `[${currentProfile.name} ADC Clock Configuration]\nF_CPU: ${(fcpu / 1e6).toFixed(2)}MHz | Prescaler: ÷${prescaler} (ADPS2:0 = ${currentPrescalerObj.adpsBits})\nADC Clock: ${adcClockKhz.toFixed(1)} kHz | Period: ${adcClockPeriodNs.toFixed(1)} ns\nConversion Time: ${conversionTimeUs.toFixed(1)} µs (${cyclesPerConversion} cycles) | Sampling Rate: ${samplingRateKsps.toFixed(2)} kSPS\nS/H Acquisition: ${sampleHoldTimeUs.toFixed(2)} µs | Target ENOB: ~${zoneAnalysis.enob} Bits (${zoneAnalysis.badge})`;
    navigator.clipboard.writeText(summaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // Generated C Source Code
  const generatedCCode = useMemo(() => {
    const adpsBits = currentPrescalerObj.adpsBits;
    const adpsSet = [
      adpsBits[0] === '1' ? '(1 << ADPS2)' : null,
      adpsBits[1] === '1' ? '(1 << ADPS1)' : null,
      adpsBits[2] === '1' ? '(1 << ADPS0)' : null
    ].filter(Boolean).join(' | ') || '0';

    return `// ==============================================================================
// ${currentProfile.name} ADC Clock Prescaler & Sampling Configuration
// F_CPU          : ${fcpu} Hz (${(fcpu / 1e6).toFixed(4)} MHz)
// ADC Prescaler  : ÷${prescaler} (ADPS2:0 = 0b${adpsBits})
// ADC Clock      : ${adcClockKhz.toFixed(1)} kHz (T_ADC = ${adcClockPeriodNs.toFixed(1)} ns)
// Conversion Time: ${conversionTimeUs.toFixed(1)} µs (1회 변환 소요 시간)
// Max Throughput : ${samplingRateKsps.toFixed(2)} kSPS (${Math.round(samplingRateKsps * 1000).toLocaleString()} samples/sec)
// Operating Mode : ${zoneAnalysis.badge}
// ==============================================================================
#define F_CPU ${fcpu}UL
#include <avr/io.h>
#include <stdint.h>

/**
 * @brief ADC 하드웨어 모듈 초기화
 * 기준전압: AVCC 핀 (AREF 100nF 커패시터 장착)
 * 클럭분주: ÷${prescaler} -> ${adcClockKhz.toFixed(1)} kHz (권장 50~200kHz ${adcClockKhz >= 50 && adcClockKhz <= 200 ? '만족' : '유의'})
 */
void ADC_Init(void) {
    // 1. 기준 전압 선택 (REFS1:0 = 01: AVCC 기준)
    ${targetResolution === '8bit' ? '// 8비트 고속 모드: ADLAR=1 (상위 8비트를 ADCH에서 단일 판독)' : '// 10비트 표준 정밀 모드: ADLAR=0'}
    ADMUX = (1 << REFS0)${targetResolution === '8bit' ? ' | (1 << ADLAR)' : ''};

    // 2. ADCSRA 레지스터: ADC 활성화(ADEN) 및 프리스케일러(ADPS2:0 = 0b${adpsBits}) 설정
    ADCSRA = (1 << ADEN) | ${adpsSet};

    // 3. 디지털 입력 버퍼 비활성화 (DIDR0: 아날로그 핀 입력 버퍼 누설 전류 방지)
    ${selectedMCU === 'atmega328p' ? 'DIDR0 = (1 << ADC0D); // ADC0 핀 디지털 로직 버퍼 차단' : 'DIDR0 = 0x01; // ADC0 디지털 로직 버퍼 차단'}
}

/**
 * @brief 아날로그 단일 채널 변환 수행 (Polling 방식)
 * @param channel 아날로그 입력 채널 (0 ~ 7)
 * @return ${targetResolution === '8bit' ? '8비트 변환값 (0 ~ 255)' : '10비트 변환값 (0 ~ 1023)'}
 */
${targetResolution === '8bit' ? 'uint8_t' : 'uint16_t'} ADC_Read(uint8_t channel) {
    // 입력 채널 선택 (하위 4비트 마스킹)
    ADMUX = (ADMUX & 0xF0) | (channel & 0x0F);

    // ADC 변환 시작 (ADSC = 1)
    ADCSRA |= (1 << ADSC);

    // 하드웨어 변환 완료 대기 (13 ADC 클럭 소요: 약 ${conversionTimeUs.toFixed(1)} µs)
    while (ADCSRA & (1 << ADSC));

    // ${targetResolution === '8bit' ? '8비트 고속 모드이므로 ADCH 레지스터만 판독하여 즉시 반환' : '10비트 정밀 모드: 하위 바이트(ADCL) 선행 판독 후 상위 바이트(ADCH) 읽기 (하드웨어 락 해제)'}
    return ${targetResolution === '8bit' ? 'ADCH' : 'ADC'};
}
`;
  }, [
    currentProfile.name,
    selectedMCU,
    fcpu,
    prescaler,
    currentPrescalerObj.adpsBits,
    adcClockKhz,
    adcClockPeriodNs,
    conversionTimeUs,
    samplingRateKsps,
    zoneAnalysis.badge,
    targetResolution
  ]);

  return (
    <div
      id="adc-clock-prescaler-calculator-section"
      className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur shadow-2xl space-y-6 scroll-mt-20"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <Activity className="w-3.5 h-3.5" /> ADC Clock Prescaler & Sample Time Calculator
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              ADPS2:0 Prescaler & Conversion Speed Optimizer
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-xs font-mono font-bold">
              {currentProfile.name}
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            ADC 클럭 분주비 & 샘플링 시간 계산기 (ADC Prescaler Calculator)
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            시스템 클록(F_CPU)과 <strong>ADC 프리스케일러(ADCSRA 레지스터 ADPS2:0)</strong>를 선택하여
            <strong>ADC 클럭 주파수(f_ADC)</strong> 및 <strong>1회 변환 소요 시간(t_conv)</strong>을 계산하고,
            <strong>변환 속도(Throughput: kSPS)</strong>와 <strong>정밀도(ENOB / Accuracy)</strong> 간의 최적 트레이드오프를 도출합니다.
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

      {/* Quick Optimization Action Bar */}
      <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs text-slate-300 font-medium">
            원클릭 최적 분주비 프리셋:
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button
            onClick={handleOptimize10Bit}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            10비트 최고 정밀도 최적화 (÷{optimal10BitPrescaler})
          </button>
          <button
            onClick={handleOptimizeSpeed}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition shadow-sm"
          >
            <Zap className="w-3.5 h-3.5" />
            8비트 최고 속도 최적화 (÷{optimal8BitPrescaler})
          </button>
        </div>
      </div>

      {/* Main Grid: Parameter Inputs & KPI Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (5 Cols): Inputs */}
        <div className="lg:col-span-5 space-y-4">
          {/* Section 1: System Clock (F_CPU) */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                1. 시스템 클록 주파수 (System Clock: F_CPU)
              </label>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                {(fcpu / 1000000).toFixed(4)} MHz
              </span>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {CLOCK_PRESETS.map((preset) => {
                const isSelected = !isCustomFcpu && fcpu === preset.fcpu;
                return (
                  <button
                    key={preset.fcpu}
                    onClick={() => handleSelectClockPreset(preset.fcpu)}
                    className={`p-2 rounded-xl text-left border transition ${
                      isSelected
                        ? 'bg-amber-500/20 text-white border-amber-500/60 shadow-sm ring-1 ring-amber-500/40 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-mono text-amber-300">{preset.label}</div>
                    <div className="text-[10px] text-slate-400 truncate">{preset.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Custom Input */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800/50">
              <span className="text-xs text-slate-400 shrink-0">커스텀 주파수 (MHz):</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.001"
                  min="0.1"
                  max="30"
                  value={fcpuInputMhz}
                  onChange={(e) => handleCustomClockChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                  placeholder="예: 16.0"
                />
                <span className="absolute right-3 top-1.5 text-xs text-slate-500 font-mono">MHz</span>
              </div>
            </div>
          </div>

          {/* Section 2: ADC Prescaler (ADPS2:0) */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-cyan-400" />
                2. ADC 클럭 분주비 (ADCSRA 레지스터 ADPS2:0)
              </label>
              <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
                ÷{prescaler} (0b{currentPrescalerObj.adpsBits})
              </span>
            </div>

            {/* Prescaler Buttons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ADC_PRESCALERS.map((p) => {
                const isSelected = prescaler === p.factor;
                const optClkKhz = (fcpu / p.factor) / 1000;
                const isSweetSpot = optClkKhz >= 50 && optClkKhz <= 200;

                return (
                  <button
                    key={p.factor}
                    onClick={() => setPrescaler(p.factor)}
                    className={`p-2.5 rounded-xl border text-left transition relative ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md shadow-cyan-950/40 ring-1 ring-cyan-400 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono font-black text-cyan-300">÷{p.factor}</span>
                      <span className="text-[10px] font-mono text-slate-400">{p.adpsBits}</span>
                    </div>
                    <div className="text-[11px] font-mono mt-1 text-slate-300">
                      {optClkKhz.toFixed(0)} kHz
                    </div>
                    {isSweetSpot && (
                      <span className="inline-block mt-1 text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/40">
                        10-bit 권장
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-400 leading-snug">
              * AVR 마이크로컨트롤러의 SAR ADC는 <strong>10비트 전체 정밀도</strong> 유지를 위해 <strong>50 kHz ~ 200 kHz</strong>의 ADC 클럭 공급을 권장합니다.
            </p>
          </div>

          {/* Section 3: Target Application & Conversion Mode */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3 text-xs">
            <span className="font-bold text-slate-200 block border-b border-slate-800/70 pb-2 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-400" />
              3. 변환 모드 & 아날로그 신호원 설정
            </span>

            {/* Target Resolution Toggle */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">목표 분해능:</span>
              <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
                <button
                  onClick={() => setTargetResolution('10bit')}
                  className={`px-3 py-1 rounded-lg font-bold transition ${
                    targetResolution === '10bit'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  10-bit 정밀 (50~200kHz)
                </button>
                <button
                  onClick={() => setTargetResolution('8bit')}
                  className={`px-3 py-1 rounded-lg font-bold transition ${
                    targetResolution === '8bit'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  8-bit 고속 (200k~1MHz)
                </button>
              </div>
            </div>

            {/* Conversion Type Select */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>변환 사이클 유형:</span>
                <span className="font-mono text-cyan-300">{cyclesPerConversion} ADC 클럭</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px]">
                <button
                  onClick={() => setConversionType('normal')}
                  className={`p-1.5 rounded-lg border text-center transition ${
                    conversionType === 'normal'
                      ? 'bg-purple-900/40 border-purple-500/70 text-white font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  표준 (13 사이클)
                </button>
                <button
                  onClick={() => setConversionType('first')}
                  className={`p-1.5 rounded-lg border text-center transition ${
                    conversionType === 'first'
                      ? 'bg-purple-900/40 border-purple-500/70 text-white font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  최초 (25 사이클)
                </button>
                <button
                  onClick={() => setConversionType('free_running')}
                  className={`p-1.5 rounded-lg border text-center transition ${
                    conversionType === 'free_running'
                      ? 'bg-purple-900/40 border-purple-500/70 text-white font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  연속 (13.5 사이클)
                </button>
              </div>
            </div>

            {/* Source Impedance Slider */}
            <div className="space-y-1 pt-1 border-t border-slate-800/60">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">아날로그 입력 임피던스 (R_in):</span>
                <span
                  className={`font-mono font-bold ${
                    sourceImpedanceKohm > 10 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {sourceImpedanceKohm} kΩ {sourceImpedanceKohm > 10 ? '(⚠️ 권장 10kΩ 초과)' : '(✓ 안전)'}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={sourceImpedanceKohm}
                onChange={(e) => setSourceImpedanceKohm(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>1 kΩ</span>
                <span className="text-emerald-400 font-bold">10 kΩ (데이터시트 상한)</span>
                <span>100 kΩ</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7 Cols): KPI Cards, Speed vs Accuracy Tradeoff & 13-Cycle Diagram */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main KPI Stat Cards */}
          <div className="bg-slate-950/90 border border-amber-500/40 rounded-2xl p-5 shadow-xl shadow-amber-950/20 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Gauge className="w-4 h-4 text-amber-400" />
                ADC 클럭 & 변환 성능 지표 (Key Metrics)
              </span>
              <button
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition"
              >
                {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSummary ? '복사됨!' : '요약 복사'}</span>
              </button>
            </div>

            {/* 4 Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {/* Card 1: ADC Clock Frequency */}
              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl space-y-0.5">
                <span className="text-[10px] text-slate-400 block font-mono">ADC 클럭 주파수 (f_ADC)</span>
                <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight block ${zoneAnalysis.color}`}>
                  {adcClockKhz.toFixed(1)}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  kHz (주기 {adcClockPeriodNs.toFixed(1)}ns)
                </span>
              </div>

              {/* Card 2: Conversion Time */}
              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl space-y-0.5">
                <span className="text-[10px] text-slate-400 block font-mono">1회 변환 소요 시간</span>
                <span className="text-xl sm:text-2xl font-black text-cyan-400 font-mono tracking-tight block">
                  {conversionTimeUs.toFixed(1)}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  µs ({cyclesPerConversion} 사이클)
                </span>
              </div>

              {/* Card 3: Sampling Rate Throughput */}
              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl space-y-0.5">
                <span className="text-[10px] text-slate-400 block font-mono">최대 샘플링 속도</span>
                <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-tight block">
                  {samplingRateKsps.toFixed(1)}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  kSPS (초당 {Math.round(samplingRateKsps * 1000).toLocaleString()}회)
                </span>
              </div>

              {/* Card 4: S/H Acquisition Time */}
              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl space-y-0.5">
                <span className="text-[10px] text-slate-400 block font-mono">샘플 & 홀드 시간</span>
                <span className="text-xl sm:text-2xl font-black text-purple-400 font-mono tracking-tight block">
                  {sampleHoldTimeUs.toFixed(2)}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  µs (1.5 ADC 사이클)
                </span>
              </div>
            </div>

            {/* Operating Zone Verdict Card */}
            <div className={`p-4 rounded-xl border text-xs space-y-2 ${zoneAnalysis.bg}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-sm ${zoneAnalysis.color}`}>{zoneAnalysis.badge}</span>
                </div>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-slate-950/80 border border-slate-800 font-bold text-white">
                  추정 실효 비트: ~{zoneAnalysis.enob} Bits ({Math.pow(2, zoneAnalysis.enob).toFixed(0)} Steps)
                </span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                {zoneAnalysis.desc}
              </p>
            </div>

            {/* Source Impedance Warning if high */}
            {isImpedanceSettlingWarning && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold">신호원 임피던스 충전 시간 부족 경고:</span>
                  <p className="text-[11px] leading-snug">
                    입력 임피던스 {sourceImpedanceKohm}kΩ 기준 S/H 커패시터(14pF)의 10비트 완충 필요 시간은 약{' '}
                    <strong>{settlingTime10BitUs.toFixed(2)}µs</strong>이지만, 현재 S/H 시간은{' '}
                    <strong>{sampleHoldTimeUs.toFixed(2)}µs</strong>에 불과합니다. 프리스케일러를 높이거나 전치단에 Op-Amp 버퍼를 배치하십시오.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Speed vs Accuracy Visual Trade-off Bar */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                변환 속도(Speed) vs 정밀도(Accuracy) 트레이드오프 스펙트럼
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                현재 위치: {adcClockKhz.toFixed(0)} kHz
              </span>
            </div>

            {/* Spectrum Bar */}
            <div className="relative pt-6 pb-2">
              <div className="h-4 w-full rounded-full bg-gradient-to-r from-amber-500 via-emerald-500 via-cyan-500 to-rose-600 flex overflow-hidden shadow-inner">
                {/* 4 Zones */}
                <div className="w-[10%] h-full opacity-30 border-r border-slate-900" title="누설 구간 (<50kHz)" />
                <div className="w-[30%] h-full opacity-30 border-r border-slate-900" title="10비트 최적 (50-200kHz)" />
                <div className="w-[45%] h-full opacity-30 border-r border-slate-900" title="8비트 고속 (200k-1MHz)" />
                <div className="w-[15%] h-full opacity-30" title="규격 초과 (>1MHz)" />
              </div>

              {/* Current Position Marker */}
              {(() => {
                // Map adcClockKhz (0 to 1200 kHz) to 0% - 100%
                const pct = Math.max(3, Math.min(97, (adcClockKhz / 1200) * 100));
                return (
                  <div
                    className="absolute top-1 transform -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-300"
                    style={{ left: `${pct}%` }}
                  >
                    <span className="bg-white text-slate-950 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded shadow-lg ring-2 ring-amber-400 whitespace-nowrap">
                      ▲ {adcClockKhz.toFixed(0)} kHz
                    </span>
                  </div>
                );
              })()}

              {/* Labels below bar */}
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-2">
                <span>0 kHz</span>
                <span className="text-emerald-400 font-bold">50 kHz (10-bit 시작)</span>
                <span className="text-emerald-400 font-bold">200 kHz (10-bit 상한)</span>
                <span className="text-cyan-400 font-bold">1,000 kHz (1MHz 한계)</span>
              </div>
            </div>

            {/* Trade-off Comparison Table */}
            <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono border-t border-slate-800/70">
              <div className="bg-slate-900/80 p-2.5 rounded-xl space-y-1">
                <span className="text-emerald-400 font-bold block">10-Bit Full Precision Target</span>
                <div className="text-[11px] text-slate-300 flex justify-between">
                  <span>권장 분주비:</span>
                  <span className="text-white font-bold">÷{optimal10BitPrescaler}</span>
                </div>
                <div className="text-[11px] text-slate-300 flex justify-between">
                  <span>변환 시간:</span>
                  <span className="text-white">{(13 / (fcpu / optimal10BitPrescaler) * 1e6).toFixed(1)} µs</span>
                </div>
                <div className="text-[11px] text-slate-300 flex justify-between">
                  <span>최대 속도:</span>
                  <span className="text-emerald-300 font-bold">
                    {(1000 / (13 / (fcpu / optimal10BitPrescaler) * 1e6)).toFixed(1)} kSPS
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-xl space-y-1">
                <span className="text-cyan-400 font-bold block">8-Bit High-Speed Target</span>
                <div className="text-[11px] text-slate-300 flex justify-between">
                  <span>권장 분주비:</span>
                  <span className="text-white font-bold">÷{optimal8BitPrescaler}</span>
                </div>
                <div className="text-[11px] text-slate-300 flex justify-between">
                  <span>변환 시간:</span>
                  <span className="text-white">{(13 / (fcpu / optimal8BitPrescaler) * 1e6).toFixed(1)} µs</span>
                </div>
                <div className="text-[11px] text-slate-300 flex justify-between">
                  <span>최대 속도:</span>
                  <span className="text-cyan-300 font-bold">
                    {(1000 / (13 / (fcpu / optimal8BitPrescaler) * 1e6)).toFixed(1)} kSPS
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 13-Cycle Conversion Timing Visualizer */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            AVR SAR ADC 13클록 변환 사이클 타임라인 구조 (13 ADC Clock Cycles Breakdown)
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            1 클록 주기(T_ADC): {adcClockPeriodNs.toFixed(1)} ns
          </span>
        </div>

        {/* 13 Cycles Bar */}
        <div className="space-y-1.5">
          <div className="grid grid-cols-13 gap-1 text-center font-mono text-[10px]">
            {Array.from({ length: 13 }, (_, i) => i + 1).map((cycle) => {
              const isSH = cycle <= 2;
              const isSAR = cycle >= 3 && cycle <= 12;
              const isFinish = cycle === 13;

              return (
                <div
                  key={cycle}
                  className={`p-1.5 rounded-lg border text-center transition ${
                    isSH
                      ? 'bg-purple-950/60 border-purple-500/60 text-purple-300 font-bold'
                      : isSAR
                      ? 'bg-cyan-950/50 border-cyan-500/50 text-cyan-300'
                      : 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300 font-bold'
                  }`}
                >
                  <div className="text-[9px] text-slate-400">CLK</div>
                  <div className="font-bold">{cycle}</div>
                  <div className="text-[8px] mt-0.5 truncate">
                    {cycle === 1
                      ? 'S/H'
                      : cycle === 2
                      ? 'Latch'
                      : cycle <= 12
                      ? `B${12 - cycle}`
                      : 'ADIF'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend Description */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs pt-1">
            <div className="bg-slate-900/70 p-2 rounded-xl border border-purple-800/40 text-[11px]">
              <strong className="text-purple-300 block mb-0.5">• 사이클 1 ~ 1.5: 샘플 & 홀드</strong>
              <span className="text-slate-400">
                아날로그 멀티플렉서를 통해 내부 14pF 커패시터에 전압을 충전하고 1.5사이클 시점에 입력 핀을 차단합니다.
              </span>
            </div>
            <div className="bg-slate-900/70 p-2 rounded-xl border border-cyan-800/40 text-[11px]">
              <strong className="text-cyan-300 block mb-0.5">• 사이클 2 ~ 12: 연속 근사(SAR) 비교</strong>
              <span className="text-slate-400">
                내부 DAC와 비교기를 사용하여 MSB(비트 9)부터 LSB(비트 0)까지 한 클록에 1비트씩 10번에 걸쳐 판정합니다.
              </span>
            </div>
            <div className="bg-slate-900/70 p-2 rounded-xl border border-emerald-800/40 text-[11px]">
              <strong className="text-emerald-300 block mb-0.5">• 사이클 13: 레지스터 래치 & 플래그</strong>
              <span className="text-slate-400">
                10비트 결과가 ADCL/ADCH 레지스터에 기록되고 ADIF 인터럽트 플래그가 세트되어 변환이 완료됩니다.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Prescaler Sweep Comparison Table */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              모든 프리스케일러(ADPS2:0) 종합 스윕 비교표 (Prescaler Matrix Sweep)
            </span>
            <p className="text-[11px] text-slate-400">
              현재 F_CPU: {(fcpu / 1e6).toFixed(2)} MHz 기준 (행을 클릭하면 해당 분주비로 즉시 전환됩니다)
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            총 7개 가용 하드웨어 분주비
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="pb-2 font-semibold">분주비 (Prescaler)</th>
                <th className="pb-2 font-semibold">ADPS2:0 비트</th>
                <th className="pb-2 font-semibold">ADC 클럭 (f_ADC)</th>
                <th className="pb-2 font-semibold">S/H 시간</th>
                <th className="pb-2 font-semibold">13사이클 변환시간</th>
                <th className="pb-2 font-semibold">최대 처리량</th>
                <th className="pb-2 font-semibold">판정 상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {prescalerSweep.map((row) => {
                const isSelected = prescaler === row.factor;

                return (
                  <tr
                    key={row.factor}
                    onClick={() => setPrescaler(row.factor)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-cyan-500/15 font-bold text-white'
                        : 'hover:bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    <td className="py-2.5 font-bold text-cyan-300">
                      ÷{row.factor} {isSelected && <span className="text-[10px] ml-1 text-amber-400">● 선택됨</span>}
                    </td>
                    <td className="py-2.5 text-slate-300">0b{row.adpsBits}</td>
                    <td className="py-2.5 font-bold text-white">{row.clkKhz.toFixed(1)} kHz</td>
                    <td className="py-2.5 text-purple-300">{row.shUs.toFixed(2)} µs</td>
                    <td className="py-2.5 text-cyan-300">{row.convUs.toFixed(1)} µs</td>
                    <td className="py-2.5 text-amber-300 font-bold">{row.ksps.toFixed(1)} kSPS</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] border ${row.qualityColor}`}>
                        {row.qualityTag}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* C Code Generation Section */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span className="font-mono flex items-center gap-1.5 font-bold text-slate-200">
            <Code2 className="w-4 h-4 text-amber-400" />
            AVR GCC Bare-metal C 초기화 루틴 ({currentProfile.name})
          </span>
          <button
            onClick={handleCopyCode}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition shadow-sm"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? '복사 완료!' : 'ADC C 코드 전체 복사'}</span>
          </button>
        </div>
        <pre className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60 custom-scrollbar leading-relaxed">
          {generatedCCode}
        </pre>
      </div>
    </div>
  );
};
