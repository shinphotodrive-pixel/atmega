import React, { useState, useMemo } from 'react';
import {
  Gauge,
  Sliders,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Info,
  Copy,
  Check,
  TrendingDown,
  Layers,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  HelpCircle,
  Binary,
  Percent
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type VrefPreset = 'avcc_5v' | 'avcc_3v3' | 'internal_1v1' | 'internal_2v56' | 'custom_aref';

interface NoiseErrorItem {
  id: string;
  name: string;
  category: 'analog' | 'digital' | 'silicon' | 'interface';
  typicalLsb: number;
  description: string;
  impactNote: string;
  countermeasure: string;
}

const COMMON_NOISE_ERRORS: NoiseErrorItem[] = [
  {
    id: 'quantization',
    name: '양자화 오차 (Quantization Error)',
    category: 'analog',
    typicalLsb: 0.5,
    description: '연속적인 아날로그 전압을 10비트(1024단계) 이산 디지털 코드로 분해할 때 발생하는 피할 수 없는 본질적 반올림 오차 (±0.5 LSB).',
    impactNote: '이론상 신호 대 잡음비(SNR)를 최대 61.96 dB로 제한합니다.',
    countermeasure: '소프트웨어 오버샘플링 & 데시메이션 (4^n회 연속 샘플링으로 n-bit 해상도 증강).'
  },
  {
    id: 'source_impedance',
    name: '소스 임피던스 과다 오차 (R_source > 10kΩ)',
    category: 'interface',
    typicalLsb: 2.5,
    description: 'AVR ADC 내부 샘플앤홀드 커패시터(C_SH ≈ 14pF)가 1.5~2 ADC 클럭(약 12µs)의 짧은 샘플링 시간 동안 충전되지 못해 전압 강하 발생.',
    impactNote: '고임피던스 센서(포토레지스터, 가스센서 등) 연결 시 측정값이 실제보다 최대 -1~-15 LSB 낮게 왜곡됨.',
    countermeasure: '소스 임피던스를 10kΩ 이하로 유지하거나, 핀 바로 앞에 100nF 커패시터 설치 또는 OP-Amp 전압 팔로워 버퍼 삽입.'
  },
  {
    id: 'digital_switching',
    name: '디지털 코어 스위칭 노이즈 (CPU/Port Toggle)',
    category: 'digital',
    typicalLsb: 2.0,
    description: 'CPU ALU 연산, 고속 플래시 메모리 페치, 주변 포트 핀의 고속 토글링 시 발생하는 디지털 기판 리플이 아날로그 입력선으로 유입.',
    impactNote: 'ADC 결과 하위 2~3개 비트가 끊임없이 무작위로 흔들리는 지터(Jitter) 현상 발생.',
    countermeasure: 'ADC Noise Reduction Sleep Mode를 사용하여 변환 중에 CPU 및 플래시 클럭을 정지시킴.'
  },
  {
    id: 'power_rail_ripple',
    name: 'AVCC / AREF 전원 레일 리플 (Power Ripple)',
    category: 'analog',
    typicalLsb: 3.0,
    description: '스위칭 레귤레이터 또는 USB 5V 라인의 50~150mV 리플 노이즈가 기준 전압(Vref) 자체를 흔들어 변환 비례식을 직접 왜곡.',
    impactNote: '전체 전압 눈금 자체가 리플 주기에 따라 상하로 변조되어 측정 오차 급증.',
    countermeasure: 'AVCC 핀에 10µH 인덕터와 100nF 커패시터로 구성된 LC 필터 적용 및 AREF에 100nF 바이패스 커패시터 장착.'
  },
  {
    id: 'mux_crosstalk',
    name: '멀티플렉서 채널 간 잔류 전하 (Mux Ghosting)',
    category: 'interface',
    typicalLsb: 1.5,
    description: 'ADMUX 채널을 변경한 직후 첫 번째 변환 시, 이전 채널에서 C_SH 커패시터에 남아있던 전하가 완전히 방전되지 않고 혼입.',
    impactNote: '이전 채널의 전압이 높으면 현재 채널의 측정값이 비정상적으로 높게 나타남 (고스팅 현상).',
    countermeasure: 'ADMUX 채널 전환 후 첫 번째 ADC 변환 결과를 폐기(Dummy Read)하고 두 번째 변환값을 취득.'
  },
  {
    id: 'inl',
    name: '적분 비선형성 오차 (INL - Integral Non-Linearity)',
    category: 'silicon',
    typicalLsb: 1.2,
    description: '실리콘 내부 DAC 저항 래더(R-2R Ladder)의 제조 공정 편차로 인해 이상적인 직선 변환선에서 발생하는 전체적인 휨 현상.',
    impactNote: '전체 눈금(Full-scale) 중간 지점에서 최대 ±1.5 LSB 편차 발생.',
    countermeasure: '소프트웨어 룩업 테이블(LUT) 또는 다구간 선형 보간(Piecewise Linear Calibration).'
  },
  {
    id: 'dnl',
    name: '차등 비선형성 오차 (DNL - Differential Non-Linearity)',
    category: 'silicon',
    typicalLsb: 0.7,
    description: '인접한 두 디지털 코드 간의 아날로그 스텝 너비가 이상적인 1 LSB와 일치하지 않는 실리콘 오차.',
    impactNote: '특정 전압 구간에서 코드 폭이 좁아지거나 넓어지며, 극단적일 경우 결측 코드(Missing Code) 발생 위험.',
    countermeasure: 'AVR 실리콘은 보증된 단조성(Monotonic)을 제공하므로 아날로그 디더링(Dithering)을 통해 스텝 스무딩.'
  },
  {
    id: 'zero_offset',
    name: '영점 오프셋 오차 (Zero Offset Error)',
    category: 'silicon',
    typicalLsb: 1.5,
    description: '내부 아날로그 비교기(Comparator)의 입력 오프셋 전압으로 인해 0V 인가 시에도 0이 아닌 1~2 카운트가 읽히거나 그 반대 현상.',
    impactNote: '미세 전압 측정 시 항상 고정된 절대 오차가 덧셈 형태로 가산됨.',
    countermeasure: '부팅 시 입력 0V 상태를 측정하여 오프셋 기본값을 소프트웨어에서 뺄셈 보정.'
  },
  {
    id: 'gain_error',
    name: '이득 / 게인 오차 (Full-Scale Gain Error)',
    category: 'silicon',
    typicalLsb: 1.5,
    description: '내부 밴드갭(1.1V / 2.56V) 레퍼런스 자체의 생산 공차(최대 ±9% 편차) 또는 외장 저항 분압비 오차.',
    impactNote: '입력 전압이 높을수록 비례하여 오차 절대값이 커짐.',
    countermeasure: '알려진 정밀 기준 전압(예: 정밀 3.300V 또는 2.048V)을 인가하여 소프트웨어 스케일 팩터(Gain Multiplier) 보정.'
  }
];

export const AdcPrecisionCalculator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Presets availability based on MCU
  const isMega128 = selectedMCU === 'atmega128';
  const isMega2560or640 = selectedMCU === 'atmega2560' || selectedMCU === 'atmega640';

  // State
  const [vrefPreset, setVrefPreset] = useState<VrefPreset>('avcc_5v');
  const [customVrefVolt, setCustomVrefVolt] = useState<number>(4.096);
  const [rawAdcCount, setRawAdcCount] = useState<number>(512); // Midpoint default
  const [resolutionBits, setResolutionBits] = useState<10 | 8 | 12>(10); // 10-bit standard, 8-bit ADLAR, 12-bit oversampled
  const [formulaMode, setFormulaMode] = useState<'1024' | '1023'>('1024'); // Microchip datasheet specifies 1024
  const [selectedErrors, setSelectedErrors] = useState<Record<string, boolean>>({
    quantization: true,
    source_impedance: false,
    digital_switching: true,
    power_rail_ripple: false,
    mux_crosstalk: false,
    inl: true,
    dnl: true,
    zero_offset: true,
    gain_error: false
  });
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Compute Active Vref
  const activeVref = useMemo(() => {
    switch (vrefPreset) {
      case 'avcc_5v':
        return 5.0;
      case 'avcc_3v3':
        return 3.3;
      case 'internal_1v1':
        return 1.1;
      case 'internal_2v56':
        return 2.56;
      case 'custom_aref':
        return Math.max(0.5, Math.min(5.5, customVrefVolt));
      default:
        return 5.0;
    }
  }, [vrefPreset, customVrefVolt]);

  // Max Steps based on resolution
  const maxAdcCount = useMemo(() => {
    if (resolutionBits === 8) return 255;
    if (resolutionBits === 12) return 4095;
    return 1023;
  }, [resolutionBits]);

  const totalSteps = useMemo(() => {
    if (resolutionBits === 8) return 256;
    if (resolutionBits === 12) return 4096;
    return 1024;
  }, [resolutionBits]);

  // Clamped ADC Count
  const clampedAdc = Math.min(maxAdcCount, Math.max(0, rawAdcCount));

  // Calculations
  const calculations = useMemo(() => {
    const divisor = formulaMode === '1024' ? totalSteps : maxAdcCount;
    // LSB Size in Volts
    const lsbVolts = activeVref / totalSteps;
    const lsbMillivolts = lsbVolts * 1000;

    // Exact Calculated Analog Input Voltage
    const exactVinVolts = (clampedAdc * activeVref) / divisor;
    const exactVinMillivolts = exactVinVolts * 1000;

    // Quantization Uncertainty Window (±0.5 LSB)
    const minVinVolts = Math.max(0, exactVinVolts - lsbVolts * 0.5);
    const maxVinVolts = Math.min(activeVref, exactVinVolts + lsbVolts * 0.5);

    // Percentage of Full Scale
    const percentageOfFullScale = (clampedAdc / maxAdcCount) * 100;

    // Binary and Register breakdown (for 10-bit)
    const binary10Bit = clampedAdc.toString(2).padStart(10, '0');
    const adchVal = (clampedAdc >> 8) & 0x03; // top 2 bits
    const adclVal = clampedAdc & 0xFF; // lower 8 bits

    // Noise and Error Budget Analysis
    let totalRssNoiseLsbSq = 0;
    let worstCaseLinearLsb = 0;
    COMMON_NOISE_ERRORS.forEach((err) => {
      if (selectedErrors[err.id]) {
        totalRssNoiseLsbSq += Math.pow(err.typicalLsb, 2);
        worstCaseLinearLsb += err.typicalLsb;
      }
    });

    const totalRssNoiseLsb = Math.sqrt(totalRssNoiseLsbSq);
    const totalRssNoiseMv = totalRssNoiseLsb * lsbMillivolts;
    const worstCaseLinearMv = worstCaseLinearLsb * lsbMillivolts;

    // Effective Number of Bits (ENOB)
    // ENOB = Resolution - log2(Total Noise LSB / Quantization LSB)
    const enob = Math.max(1, Math.min(resolutionBits, resolutionBits - Math.log2(Math.max(1, totalRssNoiseLsb / 0.5))));

    // Signal-to-Noise Ratio (SNR) in dB
    const snrDb = 6.02 * enob + 1.76;

    return {
      lsbVolts,
      lsbMillivolts,
      exactVinVolts,
      exactVinMillivolts,
      minVinVolts,
      maxVinVolts,
      percentageOfFullScale,
      binary10Bit,
      adchVal,
      adclVal,
      totalRssNoiseLsb,
      totalRssNoiseMv,
      worstCaseLinearLsb,
      worstCaseLinearMv,
      enob,
      snrDb
    };
  }, [activeVref, clampedAdc, totalSteps, maxAdcCount, formulaMode, resolutionBits, selectedErrors]);

  const toggleErrorSelection = (id: string) => {
    setSelectedErrors((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSelectAllErrors = (enable: boolean) => {
    const next: Record<string, boolean> = {};
    COMMON_NOISE_ERRORS.forEach((e) => {
      next[e.id] = enable;
    });
    setSelectedErrors(next);
  };

  // Generated C Code
  const generatedCCode = useMemo(() => {
    let refsComment = '';
    let admuxRefs = '';
    if (vrefPreset === 'avcc_5v' || vrefPreset === 'avcc_3v3') {
      refsComment = 'AVCC 기준 전압 (AREF 핀에 100nF 커패시터 권장)';
      admuxRefs = '(1 << REFS0)';
    } else if (vrefPreset === 'internal_1v1') {
      refsComment = '내부 1.1V 밴드갭 전압 기준';
      admuxRefs = isMega128 ? '(1 << REFS1) | (1 << REFS0) /* 2.56V */' : '(1 << REFS1)';
    } else if (vrefPreset === 'internal_2v56') {
      refsComment = '내부 2.56V 정밀 전압 기준';
      admuxRefs = '(1 << REFS1) | (1 << REFS0)';
    } else {
      refsComment = `외부 AREF 핀 인가 전압 (${activeVref.toFixed(3)}V)`;
      admuxRefs = '0x00 /* REFS1:0 = 00 */';
    }

    return `/* =========================================================================
 * AVR 정밀 ADC 아날로그 입력 전압 계산 및 노이즈 필터링 드라이버
 * Target MCU : ${currentProfile.name}
 * 기준 전압  : ${activeVref.toFixed(3)} V (${refsComment})
 * 1 LSB 단위 : ${calculations.lsbMillivolts.toFixed(4)} mV
 * ========================================================================= */
#include <avr/io.h>
#include <util/delay.h>

#define VREF_VOLTAGE    ${activeVref.toFixed(4)}f   // 공칭 기준 전압 (Volts)
#define ADC_TOTAL_STEPS ${totalSteps}.0f       // ${resolutionBits}비트 분해능 스텝

void adc_init(void) {
    // 1. 기준 전압(VREF) 및 채널(ADC0) 설정
    ADMUX = ${admuxRefs} | (0 & 0x07);

    // 2. ADC 인에이블 및 프리스케일러 128 설정 (16MHz / 128 = 125kHz, 최적 50~200kHz)
    ADCSRA = (1 << ADEN) | (1 << ADPS2) | (1 << ADPS1) | (1 << ADPS0);

    // 3. 최초 변환 더미 리드 (초기화 안정화)
    ADCSRA |= (1 << ADSC);
    while (ADCSRA & (1 << ADSC));
    (void)ADC;
}

// 잡음 억제 16회 오버샘플링 평균화 함수
uint16_t adc_read_averaged(uint8_t channel) {
    // 채널 선택 (하위 3비트 안전 마스킹)
    ADMUX = (ADMUX & 0xF0) | (channel & 0x07);
    _delay_us(10); // 멀티플렉서 정착 시간 (Mux Settling Time)

    uint32_t sum = 0;
    const uint8_t SAMPLES = 16;

    for (uint8_t i = 0; i < SAMPLES; i++) {
        ADCSRA |= (1 << ADSC); // 변환 시작
        while (ADCSRA & (1 << ADSC)); // 완료 대기
        sum += ADC;
    }

    return (uint16_t)(sum / SAMPLES);
}

// 정확한 아날로그 전압(V) 환산 함수
float adc_to_voltage(uint16_t raw_counts) {
    // Microchip 공식: Vin = (ADC * Vref) / ${totalSteps}
    return ((float)raw_counts * VREF_VOLTAGE) / ADC_TOTAL_STEPS;
}

// 예제 사용:
// uint16_t raw = adc_read_averaged(0); // ADC0 핀 측정
// float voltage = adc_to_voltage(raw);  // 계산된 전압 (예: ${calculations.exactVinVolts.toFixed(4)}V)
`;
  }, [currentProfile, vrefPreset, activeVref, calculations, isMega128, totalSteps, resolutionBits]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.85 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div id="adc-precision-calculator-section" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur-xl shadow-2xl space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
            <Gauge className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                ADC 정밀도 & 해상도 계산기 (ADC Precision & Resolution Calculator)
              </h3>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                10-Bit SAR Engine
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                {currentProfile.name}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              선택한 마이크로컨트롤러의 <strong>기준 전압(Vref)</strong>과 <strong>Raw ADC 측정 카운트</strong>를 기반으로 정확한 실제 <strong>아날로그 입력 전압(Vin)</strong>을 산출하고, 
              실제 회로 환경에서 발생하는 <strong>주요 샘플링 노이즈 오차 매트릭스</strong>와 실효 분해능(ENOB)을 종합 분석합니다.
            </p>
          </div>
        </div>

        {/* Big Output Card */}
        <div className="bg-slate-950 px-5 py-3.5 rounded-2xl border border-amber-500/30 shadow-inner flex items-center gap-5 shrink-0">
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-400 block tracking-wider">
              산출된 아날로그 입력 전압 (Vin)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black font-mono text-amber-400 tracking-tight">
                {calculations.exactVinVolts.toFixed(4)} V
              </span>
              <span className="text-xs font-mono text-slate-400">
                ({calculations.exactVinMillivolts.toFixed(1)} mV)
              </span>
            </div>
          </div>
          <div className="border-l border-slate-800 pl-4 text-right">
            <span className="text-[10px] text-slate-400 block font-mono">1 LSB 해상도 단위</span>
            <span className="text-sm font-bold font-mono text-cyan-400">
              {calculations.lsbMillivolts.toFixed(3)} mV
            </span>
          </div>
        </div>
      </div>

      {/* Top Input Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Inputs (7 cols): Vref and Raw ADC Count */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Reference Voltage Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                1. 기준 전압 선택 (Reference Voltage - Vref)
              </label>
              <span className="text-[11px] font-mono font-bold text-amber-300">
                현재 Vref: {activeVref.toFixed(3)} V
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {/* AVCC 5.0V */}
              <button
                type="button"
                onClick={() => setVrefPreset('avcc_5v')}
                className={`p-3 rounded-2xl border text-left transition ${
                  vrefPreset === 'avcc_5v'
                    ? 'bg-amber-500/15 border-amber-500/80 text-amber-300 shadow-md ring-1 ring-amber-400/40'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
              >
                <div className="text-xs font-bold">AVCC (5.0V)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">기본 5V 아두이노 전원</div>
              </button>

              {/* AVCC 3.3V */}
              <button
                type="button"
                onClick={() => setVrefPreset('avcc_3v3')}
                className={`p-3 rounded-2xl border text-left transition ${
                  vrefPreset === 'avcc_3v3'
                    ? 'bg-amber-500/15 border-amber-500/80 text-amber-300 shadow-md ring-1 ring-amber-400/40'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
              >
                <div className="text-xs font-bold">AVCC (3.3V)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">3.3V 저전력 배터리 전원</div>
              </button>

              {/* Internal 1.1V Bandgap */}
              <button
                type="button"
                disabled={isMega128}
                onClick={() => setVrefPreset('internal_1v1')}
                className={`p-3 rounded-2xl border text-left transition ${
                  isMega128
                    ? 'opacity-40 cursor-not-allowed bg-slate-950 border-slate-800 text-slate-500'
                    : vrefPreset === 'internal_1v1'
                    ? 'bg-amber-500/15 border-amber-500/80 text-amber-300 shadow-md ring-1 ring-amber-400/40'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
              >
                <div className="text-xs font-bold">Internal 1.1V</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {isMega128 ? 'm128 미지원 (2.56V 지원)' : '내부 고정 밴드갭'}
                </div>
              </button>

              {/* Internal 2.56V Bandgap */}
              <button
                type="button"
                disabled={selectedMCU === 'atmega328p'}
                onClick={() => setVrefPreset('internal_2v56')}
                className={`p-3 rounded-2xl border text-left transition ${
                  selectedMCU === 'atmega328p'
                    ? 'opacity-40 cursor-not-allowed bg-slate-950 border-slate-800 text-slate-500'
                    : vrefPreset === 'internal_2v56'
                    ? 'bg-amber-500/15 border-amber-500/80 text-amber-300 shadow-md ring-1 ring-amber-400/40'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
              >
                <div className="text-xs font-bold">Internal 2.56V</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {selectedMCU === 'atmega328p' ? '328P 미지원 (m128/2560)' : '정밀 내부 기준'}
                </div>
              </button>

              {/* Custom External AREF */}
              <button
                type="button"
                onClick={() => setVrefPreset('custom_aref')}
                className={`p-3 rounded-2xl border text-left transition col-span-2 sm:col-span-2 ${
                  vrefPreset === 'custom_aref'
                    ? 'bg-cyan-500/15 border-cyan-500/80 text-cyan-300 shadow-md ring-1 ring-cyan-400/40'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
              >
                <div className="text-xs font-bold">사용자 지정 외부 AREF (Custom Vref)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">외부 정밀 션트 레퍼런스 (LM4040, REF192 등)</div>
              </button>
            </div>

            {/* Custom AREF Numeric Slider (if custom selected) */}
            {vrefPreset === 'custom_aref' && (
              <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-cyan-300">외부 AREF 핀 인가 전압:</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <input
                      type="number"
                      step="0.001"
                      min="0.5"
                      max="5.5"
                      value={customVrefVolt}
                      onChange={(e) => setCustomVrefVolt(parseFloat(e.target.value) || 0.5)}
                      className="w-24 px-2 py-1 rounded-lg bg-slate-900 border border-cyan-500/50 text-cyan-300 font-bold text-right text-xs"
                    />
                    <span className="text-slate-400">V</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5.5"
                  step="0.001"
                  value={customVrefVolt}
                  onChange={(e) => setCustomVrefVolt(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>0.5V (최소 한계)</span>
                  <button type="button" onClick={() => setCustomVrefVolt(2.048)} className="hover:text-cyan-300 underline">2.048V</button>
                  <button type="button" onClick={() => setCustomVrefVolt(3.000)} className="hover:text-cyan-300 underline">3.000V</button>
                  <button type="button" onClick={() => setCustomVrefVolt(4.096)} className="hover:text-cyan-300 underline">4.096V</button>
                  <span>5.5V (절대 최대)</span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Raw ADC Counts Input */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                2. 원시 ADC 측정값 (Raw ADC Counts)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-cyan-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                  {clampedAdc} / {maxAdcCount} (Hex: 0x{clampedAdc.toString(16).toUpperCase().padStart(3, '0')})
                </span>
              </div>
            </div>

            {/* Slider & Direct Number Input */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max={maxAdcCount}
                  step="1"
                  value={clampedAdc}
                  onChange={(e) => setRawAdcCount(parseInt(e.target.value, 10))}
                  className="flex-1 accent-cyan-400 cursor-pointer h-2"
                />
                <div className="flex items-center gap-1 font-mono shrink-0">
                  <input
                    type="number"
                    min="0"
                    max={maxAdcCount}
                    value={clampedAdc}
                    onChange={(e) => setRawAdcCount(parseInt(e.target.value, 10) || 0)}
                    className="w-24 px-2 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-bold text-right text-xs"
                  />
                  <span className="text-xs text-slate-400">카운트</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400 font-mono mr-1">빠른 입력:</span>
                {[0, 1, Math.round(maxAdcCount * 0.25), Math.round(maxAdcCount * 0.5), Math.round(maxAdcCount * 0.75), maxAdcCount].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRawAdcCount(v)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition ${
                      clampedAdc === v
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
                    }`}
                  >
                    {v === 0 ? '0V (0)' : v === maxAdcCount ? `Vref (${maxAdcCount})` : v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Advanced Conversion Options (Resolution & Divisor Mode) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Resolution Selector */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <span className="font-bold text-slate-300 block text-[11px]">ADC 분해능 모드 (Resolution):</span>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => setResolutionBits(10)}
                  className={`py-1.5 rounded-lg font-mono text-[11px] font-bold transition ${
                    resolutionBits === 10
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  10-bit (기본)
                </button>
                <button
                  type="button"
                  onClick={() => setResolutionBits(8)}
                  className={`py-1.5 rounded-lg font-mono text-[11px] font-bold transition ${
                    resolutionBits === 8
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  8-bit (ADLAR)
                </button>
                <button
                  type="button"
                  onClick={() => setResolutionBits(12)}
                  className={`py-1.5 rounded-lg font-mono text-[11px] font-bold transition ${
                    resolutionBits === 12
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  12-bit (오버샘플링)
                </button>
              </div>
            </div>

            {/* Formula Divisor Mode */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <span className="font-bold text-slate-300 block text-[11px]">공식 분모 선택 (Datasheet vs Endpoint):</span>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setFormulaMode('1024')}
                  className={`py-1.5 rounded-lg font-mono text-[11px] font-bold transition ${
                    formulaMode === '1024'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  ÷ {totalSteps} (공식 규격)
                </button>
                <button
                  type="button"
                  onClick={() => setFormulaMode('1023')}
                  className={`py-1.5 rounded-lg font-mono text-[11px] font-bold transition ${
                    formulaMode === '1023'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  ÷ {maxAdcCount} (종단점 일치)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Visual Scale, Register Bit Breakdown & Uncertainty */}
        <div className="lg:col-span-5 space-y-5">
          {/* Visual Voltage Scale & Level Gauge */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                아날로그 입력 전압 레벨 게이지
              </span>
              <span className="text-xs font-mono font-bold text-amber-400">
                {calculations.percentageOfFullScale.toFixed(1)} %
              </span>
            </div>

            {/* Progress Bar with Marks */}
            <div className="space-y-1.5">
              <div className="w-full bg-slate-900 h-6 rounded-xl border border-slate-800 overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-amber-400 to-rose-400 transition-all duration-150"
                  style={{ width: `${Math.min(100, Math.max(0, calculations.percentageOfFullScale))}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-black text-slate-950 drop-shadow">
                  {calculations.exactVinVolts.toFixed(3)} V / {activeVref.toFixed(3)} V
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0.000 V (0 카운트)</span>
                <span>{(activeVref * 0.5).toFixed(3)} V</span>
                <span>{activeVref.toFixed(3)} V ({maxAdcCount})</span>
              </div>
            </div>

            {/* Exact Calculation Formula Card */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1 font-mono text-xs">
              <div className="text-[10px] text-slate-400">변환 공식 적용 (Conversion Formula):</div>
              <div className="text-amber-300 font-bold">
                Vin = ({clampedAdc} × {activeVref.toFixed(3)}V) ÷ {formulaMode === '1024' ? totalSteps : maxAdcCount} = {calculations.exactVinVolts.toFixed(5)} V
              </div>
              <div className="text-[10px] text-slate-400 pt-1">
                1 LSB 양자화 폭 = {activeVref.toFixed(3)}V ÷ {totalSteps} = <strong className="text-cyan-300">{calculations.lsbMillivolts.toFixed(4)} mV</strong>
              </div>
            </div>

            {/* Quantization Uncertainty Interval (±0.5 LSB) */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1 text-xs">
              <span className="text-slate-400 text-[10px] uppercase font-mono block">
                양자화 불확도 신뢰 구간 (±0.5 LSB):
              </span>
              <div className="font-mono text-emerald-400 font-bold">
                [{calculations.minVinVolts.toFixed(4)} V ~ {calculations.maxVinVolts.toFixed(4)} V]
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">
                이산 변환 특성상 실제 전압은 위 ±{ (calculations.lsbMillivolts * 0.5).toFixed(3) } mV 구간 내에 위치합니다.
              </p>
            </div>

            {/* 10-bit Register View (ADCH / ADCL) */}
            {resolutionBits === 10 && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <Binary className="w-3.5 h-3.5 text-cyan-400" />
                  하드웨어 ADC 레지스터 비트맵 (Right-Adjusted ADCH:ADCL)
                </span>
                <div className="grid grid-cols-2 gap-2 text-center font-mono text-xs">
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[9px] text-slate-400 block">ADCH (상위 2비트)</span>
                    <span className="text-amber-400 font-bold">
                      0b{calculations.adchVal.toString(2).padStart(2, '0')} (0x{calculations.adchVal.toString(16).toUpperCase()})
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[9px] text-slate-400 block">ADCL (하위 8비트)</span>
                    <span className="text-cyan-400 font-bold">
                      0b{calculations.adclVal.toString(2).padStart(8, '0')} (0x{calculations.adclVal.toString(16).toUpperCase().padStart(2, '0')})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Common Sampling Noise Errors Table Section */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              샘플링 노이즈 오차 종합 분석표 (Common Sampling Noise Errors)
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              실제 임베디드 보드 환경에서 ADC 입력 신호와 기준 전압을 왜곡시키는 대표적인 9대 노이즈 요인을 분석합니다.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleSelectAllErrors(true)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono transition"
            >
              전체 선택
            </button>
            <button
              type="button"
              onClick={() => handleSelectAllErrors(false)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono transition"
            >
              선택 해제
            </button>
          </div>
        </div>

        {/* Live Error Budget Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">선택된 종합 RSS 노이즈</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-bold font-mono text-amber-400">
                ±{calculations.totalRssNoiseLsb.toFixed(2)} LSB
              </span>
              <span className="text-[10px] text-slate-400">
                (±{calculations.totalRssNoiseMv.toFixed(2)} mV)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">최악 조건 선형 누적 오차</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-bold font-mono text-rose-400">
                ±{calculations.worstCaseLinearLsb.toFixed(1)} LSB
              </span>
              <span className="text-[10px] text-slate-400">
                (±{calculations.worstCaseLinearMv.toFixed(1)} mV)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">실효 분해능 (ENOB)</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-bold font-mono text-cyan-400">
                {calculations.enob.toFixed(2)} Bits
              </span>
              <span className="text-[10px] text-slate-400">
                / {resolutionBits}-bit
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">이론적 SNR</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-bold font-mono text-emerald-400">
                {calculations.snrDb.toFixed(1)} dB
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Noise Error Table */}
        <div className="overflow-x-auto custom-scrollbar border border-slate-800 rounded-2xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-slate-300 font-mono border-b border-slate-800">
              <tr>
                <th className="py-3 px-3.5 w-12 text-center">선택</th>
                <th className="py-3 px-3.5">오차 유형 및 분류</th>
                <th className="py-3 px-3.5">전형적 오차 (LSB)</th>
                <th className="py-3 px-3.5">전압 환산치 (mV)</th>
                <th className="py-3 px-3.5">발생 메커니즘 및 증상</th>
                <th className="py-3 px-3.5">회로/펌웨어 대응책 (Countermeasure)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {COMMON_NOISE_ERRORS.map((err) => {
                const isSelected = !!selectedErrors[err.id];
                const errorMv = err.typicalLsb * calculations.lsbMillivolts;

                return (
                  <tr
                    key={err.id}
                    onClick={() => toggleErrorSelection(err.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-slate-900/60 hover:bg-slate-900' : 'bg-slate-950/40 opacity-60 hover:opacity-100 hover:bg-slate-900/40'
                    }`}
                  >
                    <td className="py-3 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleErrorSelection(err.id)}
                        className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-3.5 font-bold">
                      <div className="text-white flex items-center gap-1.5">
                        {err.name}
                      </div>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[9px] font-mono uppercase font-semibold bg-slate-800 text-slate-400">
                        {err.category}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-amber-400 font-bold whitespace-nowrap">
                      ±{err.typicalLsb.toFixed(1)} LSB
                    </td>
                    <td className="py-3 px-3.5 font-mono text-cyan-300 font-bold whitespace-nowrap">
                      ±{errorMv.toFixed(2)} mV
                    </td>
                    <td className="py-3 px-3.5 text-slate-300 max-w-xs leading-relaxed text-[11px]">
                      {err.description}
                    </td>
                    <td className="py-3 px-3.5 text-emerald-300 max-w-sm leading-relaxed text-[11px] font-sans">
                      {err.countermeasure}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Production C Code Generator Card */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              생성된 C 언어 고정밀 ADC 전압 변환 및 필터링 드라이버 코드
            </h4>
          </div>
          <button
            onClick={handleCopyCode}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 shrink-0 font-sans"
          >
            {copiedCode ? <Check className="w-4 h-4 text-slate-950" /> : <Copy className="w-4 h-4" />}
            <span>{copiedCode ? '복사 완료!' : 'C 소스 코드 복사'}</span>
          </button>
        </div>

        <pre className="p-4 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed max-h-80 select-all">
          {generatedCCode}
        </pre>
      </div>
    </div>
  );
};
