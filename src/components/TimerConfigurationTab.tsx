import React, { useState, useMemo } from 'react';
import {
  Clock,
  Zap,
  Sliders,
  Copy,
  Check,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  Code2,
  RotateCcw,
  Gauge,
  Activity,
  Info,
  Layers,
  Sparkles,
  Waves,
  ArrowRight,
  HelpCircle,
  Hash,
  Terminal,
  Settings,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type TimerIndex = 0 | 1 | 2 | 3 | 4 | 5;
export type WgmMode = 'ctc' | 'normal' | 'fast_pwm' | 'phase_correct' | 'phase_freq_correct';

interface TimerSpec {
  index: TimerIndex;
  name: string;
  bits: 8 | 16;
  maxTop: number;
  ocPins: string[];
  description: string;
  isAsyncRtc?: boolean;
  supportedMcus: SupportedMCU[];
  prescalers: number[];
}

export const ALL_TIMER_SPECS: TimerSpec[] = [
  {
    index: 0,
    name: 'Timer/Counter 0',
    bits: 8,
    maxTop: 255,
    ocPins: ['OC0A', 'OC0B'],
    description: '8비트 기본 하드웨어 타이머. 밀리초(millis) 및 시스템 틱 카운팅에 주로 활용됩니다.',
    supportedMcus: ['atmega328p', 'atmega128', 'atmega640', 'atmega2560'],
    prescalers: [1, 8, 64, 256, 1024]
  },
  {
    index: 1,
    name: 'Timer/Counter 1',
    bits: 16,
    maxTop: 65535,
    ocPins: ['OC1A', 'OC1B', 'OC1C'],
    description: '16비트 고정밀 타이머. 16비트 분해능(최대 65,535)으로 서보모터 정밀 PWM 및 긴 주기 인터럽트를 생성합니다.',
    supportedMcus: ['atmega328p', 'atmega128', 'atmega640', 'atmega2560'],
    prescalers: [1, 8, 64, 256, 1024]
  },
  {
    index: 2,
    name: 'Timer/Counter 2',
    bits: 8,
    maxTop: 255,
    ocPins: ['OC2A', 'OC2B'],
    description: '8비트 비동기 RTC 지원 타이머. TOSC1/TOSC2에 32.768kHz 크리스털을 연결하여 저전력 시계 동작이 가능합니다.',
    isAsyncRtc: true,
    supportedMcus: ['atmega328p', 'atmega128', 'atmega640', 'atmega2560'],
    prescalers: [1, 8, 32, 64, 128, 256, 1024]
  },
  {
    index: 3,
    name: 'Timer/Counter 3',
    bits: 16,
    maxTop: 65535,
    ocPins: ['OC3A', 'OC3B', 'OC3C'],
    description: '16비트 보조 정밀 타이머. 대형 I/O MCU에 추가 내장된 16비트 채널입니다.',
    supportedMcus: ['atmega128', 'atmega640', 'atmega2560'],
    prescalers: [1, 8, 64, 256, 1024]
  },
  {
    index: 4,
    name: 'Timer/Counter 4',
    bits: 16,
    maxTop: 65535,
    ocPins: ['OC4A', 'OC4B', 'OC4C'],
    description: '16비트 고성능 확장 타이머. ATmega2560 / ATmega640 100핀 패키지에 내장되어 다채널 모터 구동에 사용됩니다.',
    supportedMcus: ['atmega640', 'atmega2560'],
    prescalers: [1, 8, 64, 256, 1024]
  },
  {
    index: 5,
    name: 'Timer/Counter 5',
    bits: 16,
    maxTop: 65535,
    ocPins: ['OC5A', 'OC5B', 'OC5C'],
    description: '16비트 최상위 확장 타이머. 3D 프린터(Marlin) 및 대규모 산업용 장비의 다채널 정밀 PWM을 책임집니다.',
    supportedMcus: ['atmega640', 'atmega2560'],
    prescalers: [1, 8, 64, 256, 1024]
  }
];

export const FREQUENCY_PRESETS = [
  { freq: 1, label: '1 Hz', desc: '1초 주기 심장박동 / 시계 (1s)' },
  { freq: 10, label: '10 Hz', desc: '센서 100ms 정기 샘플링' },
  { freq: 50, label: '50 Hz', desc: 'RC 서보모터 표준 프레임 (20ms)' },
  { freq: 100, label: '100 Hz', desc: '10ms 시스템 틱 / 키패드 스캔' },
  { freq: 440, label: '440 Hz', desc: 'A4 라 음계 (오디오 톤 발생)' },
  { freq: 1000, label: '1,000 Hz', desc: '1ms millis() 타이머 기준' },
  { freq: 8000, label: '8,000 Hz', desc: '8kHz 오디오 PCM 샘플링' },
  { freq: 31250, label: '31.25 kHz', desc: '초음파 / 모터 무소음 PWM' }
];

export const TimerConfigurationTab: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Selected Timer (0 ~ 5)
  const [selectedTimerIndex, setSelectedTimerIndex] = useState<TimerIndex>(1);
  const [desiredFrequencyHz, setDesiredFrequencyHz] = useState<number>(1000);
  const [cpuFreqMhz, setCpuFreqMhz] = useState<number>(16);
  const [wgmMode, setWgmMode] = useState<WgmMode>('ctc');
  const [selectedPrescaler, setSelectedPrescaler] = useState<number>(64);
  const [dutyCyclePct, setDutyCyclePct] = useState<number>(50);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Check which timers are valid for selected MCU
  const timerAvailabilityMap = useMemo(() => {
    const map: Record<TimerIndex, boolean> = { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false };
    ALL_TIMER_SPECS.forEach((spec) => {
      map[spec.index] = spec.supportedMcus.includes(selectedMCU);
    });
    return map;
  }, [selectedMCU]);

  // If currently selected timer is not available on selected MCU, auto fallback
  React.useEffect(() => {
    if (!timerAvailabilityMap[selectedTimerIndex]) {
      // Find first available timer
      const firstAvail = ALL_TIMER_SPECS.find((s) => s.supportedMcus.includes(selectedMCU));
      if (firstAvail) {
        setSelectedTimerIndex(firstAvail.index);
      }
    }
  }, [selectedMCU, timerAvailabilityMap, selectedTimerIndex]);

  // Current Timer Spec
  const currentTimerSpec = useMemo(() => {
    return ALL_TIMER_SPECS.find((s) => s.index === selectedTimerIndex) || ALL_TIMER_SPECS[1];
  }, [selectedTimerIndex]);

  // Available Prescalers for current Timer
  const availablePrescalers = currentTimerSpec.prescalers;

  // Auto-select valid prescaler if current one is not in list
  React.useEffect(() => {
    if (!availablePrescalers.includes(selectedPrescaler)) {
      setSelectedPrescaler(availablePrescalers[1] || availablePrescalers[0]);
    }
  }, [availablePrescalers, selectedPrescaler]);

  // Prescaler Comparison Table Calculations
  interface PrescalerAnalysis {
    prescaler: number;
    rawOcr: number;
    actualOcr: number;
    actualFreqHz: number;
    errorHz: number;
    errorPercent: number;
    status: 'BEST' | 'VALID' | 'OVERFLOW' | 'UNDERFLOW';
  }

  const prescalerComparison = useMemo<PrescalerAnalysis[]>(() => {
    const fcpuHz = cpuFreqMhz * 1_000_000;
    const maxTop = currentTimerSpec.maxTop;

    const list: PrescalerAnalysis[] = availablePrescalers.map((N) => {
      let rawOcr = 0;
      if (wgmMode === 'ctc' || wgmMode === 'fast_pwm') {
        // f = f_cpu / (N * (1 + OCR))
        // 1 + OCR = f_cpu / (N * f_target)
        // OCR = (f_cpu / (N * f_target)) - 1
        rawOcr = fcpuHz / (N * desiredFrequencyHz) - 1;
      } else if (wgmMode === 'phase_correct' || wgmMode === 'phase_freq_correct') {
        // f = f_cpu / (2 * N * TOP)
        // TOP = f_cpu / (2 * N * f_target)
        rawOcr = fcpuHz / (2 * N * desiredFrequencyHz);
      } else {
        // Normal mode (Overflow: TOP = maxTop)
        // f = f_cpu / (N * (maxTop + 1))
        rawOcr = maxTop;
      }

      const clampedOcr = Math.round(rawOcr);
      let actualFreq = 0;
      if (wgmMode === 'ctc' || wgmMode === 'fast_pwm') {
        actualFreq = fcpuHz / (N * (clampedOcr + 1));
      } else if (wgmMode === 'phase_correct' || wgmMode === 'phase_freq_correct') {
        actualFreq = fcpuHz / (2 * N * (clampedOcr === 0 ? 1 : clampedOcr));
      } else {
        actualFreq = fcpuHz / (N * (maxTop + 1));
      }

      const errorHz = Math.abs(actualFreq - desiredFrequencyHz);
      const errorPercent = (errorHz / desiredFrequencyHz) * 100;

      let status: 'BEST' | 'VALID' | 'OVERFLOW' | 'UNDERFLOW' = 'VALID';
      if (clampedOcr > maxTop) {
        status = 'OVERFLOW';
      } else if (clampedOcr < 0) {
        status = 'UNDERFLOW';
      }

      return {
        prescaler: N,
        rawOcr,
        actualOcr: Math.max(0, Math.min(maxTop, clampedOcr)),
        actualFreqHz: +actualFreq.toFixed(3),
        errorHz: +errorHz.toFixed(3),
        errorPercent: +errorPercent.toFixed(3),
        status
      };
    });

    // Mark the Best valid match
    const validEntries = list.filter((e) => e.status === 'VALID');
    if (validEntries.length > 0) {
      validEntries.sort((a, b) => a.errorPercent - b.errorPercent);
      validEntries[0].status = 'BEST';
    }

    return list;
  }, [cpuFreqMhz, desiredFrequencyHz, currentTimerSpec, availablePrescalers, wgmMode]);

  // Current Active Calculation based on selectedPrescaler
  const currentAnalysis = useMemo(() => {
    return (
      prescalerComparison.find((p) => p.prescaler === selectedPrescaler) ||
      prescalerComparison[0]
    );
  }, [prescalerComparison, selectedPrescaler]);

  // Output Match Channel Values (OCRnA, OCRnB, OCRnC)
  const ocrA = currentAnalysis.actualOcr;
  const ocrB = Math.round((ocrA * dutyCyclePct) / 100);
  const ocrC = Math.round((ocrA * (dutyCyclePct * 0.7)) / 100);

  // WGM Mode Register Bit Representation
  const wgmBitInfo = useMemo(() => {
    const is16Bit = currentTimerSpec.bits === 16;
    if (wgmMode === 'ctc') {
      if (is16Bit) {
        return {
          modeName: 'Mode 4: CTC (Clear Timer on Compare Match, TOP = OCR1A)',
          tccrA_wgm: 'WGM11=0, WGM10=0',
          tccrB_wgm: 'WGM13=0, WGM12=1',
          tccrA_val: 0x00,
          tccrB_wgm_bits: 0x08 // WGM12 bit is bit 3
        };
      } else {
        return {
          modeName: 'Mode 2: CTC (Clear Timer on Compare Match, TOP = OCR0A)',
          tccrA_wgm: 'WGM01=1, WGM00=0',
          tccrB_wgm: 'WGM02=0',
          tccrA_val: 0x02,
          tccrB_wgm_bits: 0x00
        };
      }
    } else if (wgmMode === 'fast_pwm') {
      if (is16Bit) {
        return {
          modeName: 'Mode 14: Fast PWM (TOP = ICR1, Update OCR1x at BOTTOM)',
          tccrA_wgm: 'WGM11=1, WGM10=0',
          tccrB_wgm: 'WGM13=1, WGM12=1',
          tccrA_val: 0x02,
          tccrB_wgm_bits: 0x18
        };
      } else {
        return {
          modeName: 'Mode 3: Fast PWM 8-bit (TOP = 0xFF)',
          tccrA_wgm: 'WGM01=1, WGM00=1',
          tccrB_wgm: 'WGM02=0',
          tccrA_val: 0x03,
          tccrB_wgm_bits: 0x00
        };
      }
    } else if (wgmMode === 'phase_correct') {
      if (is16Bit) {
        return {
          modeName: 'Mode 10: Phase Correct PWM (TOP = ICR1)',
          tccrA_wgm: 'WGM11=1, WGM10=0',
          tccrB_wgm: 'WGM13=1, WGM12=0',
          tccrA_val: 0x02,
          tccrB_wgm_bits: 0x10
        };
      } else {
        return {
          modeName: 'Mode 1: Phase Correct PWM (TOP = 0xFF)',
          tccrA_wgm: 'WGM01=0, WGM00=1',
          tccrB_wgm: 'WGM02=0',
          tccrA_val: 0x01,
          tccrB_wgm_bits: 0x00
        };
      }
    } else {
      // Normal
      return {
        modeName: 'Mode 0: Normal (Counter wraps at 0xFF / 0xFFFF)',
        tccrA_wgm: 'WGM0=0',
        tccrB_wgm: 'WGM0=0',
        tccrA_val: 0x00,
        tccrB_wgm_bits: 0x00
      };
    }
  }, [wgmMode, currentTimerSpec]);

  // Prescaler Clock Select Register Bit Mapping (CSn2..0)
  const csBitsVal = useMemo(() => {
    const n = selectedPrescaler;
    const isTimer2 = currentTimerSpec.index === 2;
    if (isTimer2) {
      // Timer 2 prescalers: 1, 8, 32, 64, 128, 256, 1024
      if (n === 1) return 1;
      if (n === 8) return 2;
      if (n === 32) return 3;
      if (n === 64) return 4;
      if (n === 128) return 5;
      if (n === 256) return 6;
      if (n === 1024) return 7;
      return 1;
    } else {
      // Standard: 1, 8, 64, 256, 1024
      if (n === 1) return 1;
      if (n === 8) return 2;
      if (n === 64) return 3;
      if (n === 256) return 4;
      if (n === 1024) return 5;
      return 1;
    }
  }, [selectedPrescaler, currentTimerSpec]);

  // Generated C Initialization Snippet
  const generatedCInitCode = useMemo(() => {
    const tIdx = currentTimerSpec.index;
    const is16Bit = currentTimerSpec.bits === 16;
    const tccrA = `TCCR${tIdx}A`;
    const tccrB = `TCCR${tIdx}B`;
    const ocrReg = `OCR${tIdx}A`;
    const timskReg = `TIMSK${tIdx}`;
    const ocieBit = `OCIE${tIdx}A`;
    const isrVector = `TIMER${tIdx}_COMPA_vect`;

    const hexOcr = `0x${ocrA.toString(16).toUpperCase()}`;

    return `// =========================================================================
// AVR ${currentTimerSpec.name} (${currentTimerSpec.bits}-bit) 정밀 인터럽트 구성 코드
// MCU Target     : ${currentProfile.name} @ ${cpuFreqMhz} MHz
// 목표 주파수   : ${desiredFrequencyHz.toLocaleString()} Hz (실제: ${currentAnalysis.actualFreqHz.toLocaleString()} Hz, 오차: ${currentAnalysis.errorPercent}%)
// 프리스케일러   : clk_io / ${selectedPrescaler} (CS${tIdx}[2:0] = ${csBitsVal})
// 비교일치(OCR)  : ${ocrA} (${hexOcr})
// =========================================================================
#include <avr/io.h>
#include <avr/interrupt.h>

void timer${tIdx}_init(void) {
    // 1. 전역 인터럽트 비활성화
    cli();

    // 2. 타이머 레지스터 초기화
    ${tccrA} = 0;
    ${tccrB} = 0;
    TCNT${tIdx} = 0;

    // 3. 비교일치 값 설정 (OCR${tIdx}A)
    ${ocrReg} = ${ocrA}; // ${hexOcr}

    // 4. 파형 생성 모드(WGM) 및 클럭 소스(CS) 설정: ${wgmBitInfo.modeName}
    ${wgmMode === 'ctc'
      ? is16Bit
        ? `${tccrB} |= (1 << WGM${tIdx}2); // CTC Mode (TOP=OCR${tIdx}A)\n    ${tccrB} |= (${csBitsVal} << CS${tIdx}0); // Prescaler /${selectedPrescaler}`
        : `${tccrA} |= (1 << WGM${tIdx}1); // CTC Mode (TOP=OCR${tIdx}A)\n    ${tccrB} |= (${csBitsVal} << CS${tIdx}0); // Prescaler /${selectedPrescaler}`
      : `${tccrB} |= (${csBitsVal} << CS${tIdx}0); // Prescaler /${selectedPrescaler}`
    }

    // 5. 타이머 비교일치 인터럽트 인에이블 (${ocieBit})
    ${selectedMCU === 'atmega128' && tIdx === 0
      ? `TIMSK |= (1 << OCIE0);`
      : `${timskReg} |= (1 << ${ocieBit});`
    }

    // 6. 전역 인터럽트 활성화
    sei();
}

// 7. 타이머 비교일치 인터럽트 서비스 루틴
ISR(${isrVector}) {
    // ⚠️ ISR 내부 연산: 1초에 ${currentAnalysis.actualFreqHz.toFixed(1)}번 정밀 호출됨
    // 사용자 제어 로직 (예: PIN 토글, 시스템 틱 카운터 증가)
    // PORTB ^= (1 << PB5); // Arduino Uno 내장 LED 토글 예시
}
`;
  }, [
    currentTimerSpec,
    currentProfile,
    cpuFreqMhz,
    desiredFrequencyHz,
    currentAnalysis,
    selectedPrescaler,
    csBitsVal,
    ocrA,
    wgmBitInfo,
    wgmMode,
    selectedMCU
  ]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCInitCode);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & MCU Profile Summary */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wide uppercase mb-3">
              <Clock className="w-3.5 h-3.5" />
              AVR Hardware Timer/Counter 0-5 Engineering Suite
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              타이머/카운터 설정기 (Timer/Counter Configuration)
              <span className="text-xs font-mono font-normal text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-700/50">
                {currentProfile.name} • {currentProfile.timers}
              </span>
            </h2>
            <p className="text-sm text-slate-400 mt-2 max-w-3xl leading-relaxed">
              AVR 하드웨어 <strong>타이머 0~5</strong>번 중 대상 유닛을 선택하여, <strong>목표 인터럽트 주파수(Hz)</strong>에 적합한 최적의 <strong>프리스케일러(Prescaler)</strong>와 <strong>비교일치(OCR) 값</strong>을 실시간 계산하고 <strong>WGM 모드</strong> 레지스터 설정 및 검증된 C 초기화 코드를 자동 생성합니다.
            </p>
          </div>

          {/* MCU Quick Toggle */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/90 p-1.5 rounded-xl border border-slate-800 self-start lg:self-auto">
            {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => {
              const isSelected = selectedMCU === mcuId;
              return (
                <button
                  key={mcuId}
                  onClick={() => onSelectMCU && onSelectMCU(mcuId)}
                  className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex flex-col items-center ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <span>{MCU_PROFILES[mcuId].name}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-slate-900/80' : 'text-slate-500'}`}>
                    {MCU_PROFILES[mcuId].timers.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Step 1: Timer Selection Tabs (Timer 0 ~ 5) */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              1. 타깃 하드웨어 타이머/카운터 선택 (Timer 0 ~ 5)
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            현재 MCU 지원 유닛만 활성화됨
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {ALL_TIMER_SPECS.map((spec) => {
            const isSupported = timerAvailabilityMap[spec.index];
            const isSelected = selectedTimerIndex === spec.index;

            return (
              <button
                key={spec.index}
                disabled={!isSupported}
                onClick={() => setSelectedTimerIndex(spec.index)}
                className={`p-3.5 rounded-2xl border transition-all text-left relative overflow-hidden flex flex-col justify-between ${
                  !isSupported
                    ? 'bg-slate-950/30 border-slate-900 text-slate-600 opacity-40 cursor-not-allowed'
                    : isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xl shadow-amber-500/20 ring-2 ring-amber-400/50'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-black text-sm">Timer {spec.index}</span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-900 text-amber-400'
                    }`}>
                      {spec.bits}-bit
                    </span>
                  </div>
                  <div className={`text-xs font-semibold leading-tight ${isSelected ? 'text-slate-900' : 'text-white'}`}>
                    MAX: {spec.maxTop.toLocaleString()}
                  </div>
                </div>

                <div className={`mt-3 pt-2 text-[10px] font-mono border-t ${
                  isSelected ? 'border-slate-900/20 text-slate-900' : 'border-slate-800/80 text-slate-400'
                }`}>
                  {isSupported ? (
                    <span>출력핀: {spec.ocPins.slice(0, 2).join(', ')}</span>
                  ) : (
                    <span className="text-rose-400 font-sans">미지원 MCU</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Timer Detail Card */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold font-mono">
              T{currentTimerSpec.index}
            </div>
            <div>
              <span className="font-bold text-white text-sm">
                {currentTimerSpec.name} ({currentTimerSpec.bits}-bit, TOP = {currentTimerSpec.maxTop})
              </span>
              <p className="text-slate-400 text-xs mt-0.5">
                {currentTimerSpec.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] shrink-0 text-slate-400">
            <span>OC 채널: <strong className="text-cyan-400">{currentTimerSpec.ocPins.join(', ')}</strong></span>
            {currentTimerSpec.isAsyncRtc && (
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                32.768kHz RTC 지원
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Step 2 & 3: Frequency Target Input & Parameters Tuning */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Frequency Target & Modes */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                2. 목표 인터럽트 주파수 & WGM 모드 설정
              </h3>
            </div>
            <div className="flex items-center gap-1 font-mono text-xs text-slate-400">
              <span>시스템 클럭:</span>
              <select
                value={cpuFreqMhz}
                onChange={(e) => setCpuFreqMhz(parseFloat(e.target.value))}
                className="bg-slate-950 border border-slate-700 text-amber-400 font-bold rounded-lg px-2 py-1 text-xs"
              >
                <option value={8}>8.0 MHz (3.3V)</option>
                <option value={12}>12.0 MHz (V-USB)</option>
                <option value={16}>16.0 MHz (표준 Uno/Mega)</option>
                <option value={20}>20.0 MHz (정격 최대)</option>
              </select>
            </div>
          </div>

          {/* Target Frequency Slider & Direct Input */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-300">
                목표 인터럽트 주파수 (Target Frequency):
              </label>
              <div className="flex items-center gap-1.5 font-mono">
                <input
                  type="number"
                  min={0.1}
                  max={250000}
                  step={desiredFrequencyHz < 10 ? 0.1 : desiredFrequencyHz < 100 ? 1 : 10}
                  value={desiredFrequencyHz}
                  onChange={(e) => setDesiredFrequencyHz(Math.max(0.1, Math.min(250000, parseFloat(e.target.value) || 1)))}
                  className="w-28 px-2 py-1 rounded-xl bg-slate-950 border border-slate-700 text-right text-cyan-400 font-bold text-sm"
                />
                <span className="text-cyan-400 font-bold text-xs">Hz</span>
              </div>
            </div>

            <input
              type="range"
              min={1}
              max={10000}
              step={1}
              value={desiredFrequencyHz}
              onChange={(e) => setDesiredFrequencyHz(parseInt(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />

            {/* Quick Frequency Preset Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {FREQUENCY_PRESETS.map((p) => (
                <button
                  key={p.freq}
                  onClick={() => setDesiredFrequencyHz(p.freq)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                    desiredFrequencyHz === p.freq
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                  title={p.desc}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* WGM Mode Selection */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="text-xs font-semibold text-slate-300 block">
              파형 생성 모드 (Waveform Generation Mode - WGM):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <button
                onClick={() => setWgmMode('ctc')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  wgmMode === 'ctc'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold">CTC 모드 (추천)</div>
                <div className="text-[10px] opacity-80 mt-0.5">TOP=OCRnA, 주기적 인터럽트</div>
              </button>

              <button
                onClick={() => setWgmMode('fast_pwm')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  wgmMode === 'fast_pwm'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold">Fast PWM</div>
                <div className="text-[10px] opacity-80 mt-0.5">단방향 톱니파 고속 출력</div>
              </button>

              <button
                onClick={() => setWgmMode('phase_correct')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  wgmMode === 'phase_correct'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold">Phase Correct</div>
                <div className="text-[10px] opacity-80 mt-0.5">대칭 삼각파 모터 제어</div>
              </button>

              <button
                onClick={() => setWgmMode('normal')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  wgmMode === 'normal'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold">Normal 모드</div>
                <div className="text-[10px] opacity-80 mt-0.5">TOP=최대치 오버플로우</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Live Realized KPI Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <Gauge className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                실제 달성 주파수 & 오차율
              </h3>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400">실제 생성 주파수:</span>
              <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
                {currentAnalysis.actualFreqHz.toLocaleString()} <span className="text-sm font-normal text-slate-400">Hz</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                주기(Period): {(1000 / currentAnalysis.actualFreqHz).toFixed(3)} ms
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">OCR 계산값</span>
                <span className="text-lg font-bold text-amber-400 font-mono">
                  {ocrA}
                </span>
                <span className="text-[10px] text-slate-500 block">0x{ocrA.toString(16).toUpperCase()}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">주파수 오차</span>
                <span className={`text-lg font-bold font-mono ${
                  currentAnalysis.errorPercent === 0 ? 'text-emerald-400' : currentAnalysis.errorPercent < 0.5 ? 'text-cyan-400' : 'text-rose-400'
                }`}>
                  {currentAnalysis.errorPercent}%
                </span>
                <span className="text-[10px] text-slate-500 block">±{currentAnalysis.errorHz} Hz</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>선택 프리스케일러:</span>
              <span className="font-bold text-white">clk / {selectedPrescaler}</span>
            </div>
            <div className="flex justify-between">
              <span>카운터 해상도:</span>
              <span className="font-bold text-white">{currentTimerSpec.bits}-bit ({currentTimerSpec.maxTop + 1} steps)</span>
            </div>
            <div className="flex justify-between">
              <span>클럭 비트 (CS):</span>
              <span className="font-bold text-amber-400">0b{csBitsVal.toString(2).padStart(3, '0')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Step 3: Prescaler Selection & Accuracy Comparison Table */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              3. 프리스케일러별 비교일치(OCR) 및 주파수 매칭 비교 분석표
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            클릭하여 최적의 프리스케일러를 즉시 채택하세요
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-950 text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">프리스케일러 (N)</th>
                <th className="py-2.5 px-3">계산된 OCR 값</th>
                <th className="py-2.5 px-3">실제 생성 주파수</th>
                <th className="py-2.5 px-3">절대 오차 (Hz)</th>
                <th className="py-2.5 px-3">오차율 (%)</th>
                <th className="py-2.5 px-3">레인지 상태</th>
                <th className="py-2.5 px-3 text-right">선택</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {prescalerComparison.map((row) => {
                const isSelected = row.prescaler === selectedPrescaler;
                const isBest = row.status === 'BEST';
                const isOverflow = row.status === 'OVERFLOW';
                const isUnderflow = row.status === 'UNDERFLOW';

                return (
                  <tr
                    key={row.prescaler}
                    onClick={() => row.status !== 'OVERFLOW' && row.status !== 'UNDERFLOW' && setSelectedPrescaler(row.prescaler)}
                    className={`transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 border-l-4 border-amber-500 text-white font-bold'
                        : isBest
                        ? 'bg-emerald-950/20 hover:bg-emerald-900/30'
                        : isOverflow || isUnderflow
                        ? 'opacity-40 hover:opacity-60 bg-slate-950/40 cursor-not-allowed'
                        : 'hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <td className="py-3 px-3 font-bold text-white flex items-center gap-1.5">
                      <span>clk / {row.prescaler}</span>
                      {isBest && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-bold bg-emerald-500 text-slate-950">
                          BEST
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {isOverflow ? (
                        <span className="text-rose-400 font-bold">오버플로우 ({Math.round(row.rawOcr)} &gt; {currentTimerSpec.maxTop})</span>
                      ) : isUnderflow ? (
                        <span className="text-rose-400 font-bold">언더플로우 (&lt; 0)</span>
                      ) : (
                        <span className="text-amber-400 font-bold">
                          {row.actualOcr} <span className="text-slate-500 font-normal">(0x{row.actualOcr.toString(16).toUpperCase()})</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-emerald-400 font-bold">
                      {row.actualFreqHz.toLocaleString()} Hz
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      ±{row.errorHz} Hz
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
                      {isOverflow ? (
                        <span className="text-rose-400 text-[11px] flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> 분해능 초과
                        </span>
                      ) : isUnderflow ? (
                        <span className="text-rose-400 text-[11px]">주파수 과다</span>
                      ) : (
                        <span className="text-emerald-400 text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 유효 레인지
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        disabled={isOverflow || isUnderflow}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPrescaler(row.prescaler);
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        {isSelected ? '선택됨' : '적용'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Step 4: Output Compare Channels (OCRnA, OCRnB, OCRnC) & Waveform Simulation */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              4. 타이머 카운터(TCNT) & 비교일치 채널 시뮬레이션 다이어그램
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">PWM 듀티비(Duty):</span>
            <input
              type="range"
              min={0}
              max={100}
              value={dutyCyclePct}
              onChange={(e) => setDutyCyclePct(parseInt(e.target.value))}
              className="w-24 accent-cyan-500 cursor-pointer"
            />
            <span className="text-cyan-400 font-bold w-10 text-right">{dutyCyclePct}%</span>
          </div>
        </div>

        {/* Output Channel Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/40 space-y-1.5">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-amber-400 font-bold">Channel A (TOP / Interrupt)</span>
              <span className="text-[10px] text-slate-400">{currentTimerSpec.ocPins[0]}</span>
            </div>
            <div className="text-xl font-black text-white font-mono">{ocrA}</div>
            <p className="text-[11px] text-slate-400">
              CTC 주기 결정값. 카운터가 이 값에 도달하면 인터럽트가 발생하고 TCNT가 0으로 리셋됩니다.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-cyan-500/40 space-y-1.5">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-cyan-400 font-bold">Channel B (Secondary Match)</span>
              <span className="text-[10px] text-slate-400">{currentTimerSpec.ocPins[1]}</span>
            </div>
            <div className="text-xl font-black text-white font-mono">{ocrB}</div>
            <p className="text-[11px] text-slate-400">
              보조 비교일치 채널. PWM 듀티비({dutyCyclePct}%) 또는 독립된 타이밍 펄스 생성에 쓰입니다.
            </p>
          </div>

          {currentTimerSpec.ocPins[2] ? (
            <div className="bg-slate-950 p-4 rounded-2xl border border-purple-500/40 space-y-1.5">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-purple-400 font-bold">Channel C (Tertiary Match)</span>
                <span className="text-[10px] text-slate-400">{currentTimerSpec.ocPins[2]}</span>
              </div>
              <div className="text-xl font-black text-white font-mono">{ocrC}</div>
              <p className="text-[11px] text-slate-400">
                3번째 비교일치 채널 (100핀 Mega/128 계열 전용). 3상 PWM 모터 제어에 활용됩니다.
              </p>
            </div>
          ) : (
            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800 text-xs text-slate-500 flex items-center justify-center font-mono">
              Channel C 미지원 (8-bit Timer)
            </div>
          )}
        </div>

        {/* SVG Counter Waveform Ramp */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 overflow-hidden relative">
          <svg viewBox="0 0 800 180" className="w-full h-44 select-none font-mono">
            {/* Grid */}
            <defs>
              <pattern id="timer-grid" width="40" height="30" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#1e293b" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="800" height="180" fill="url(#timer-grid)" />

            {/* TOP Line */}
            <line x1="60" y1="30" x2="780" y2="30" stroke="#f59e0b" strokeDasharray="3 3" strokeWidth="1.2" />
            <text x="50" y="34" fill="#f59e0b" fontSize="10" textAnchor="end">OCR{currentTimerSpec.index}A ({ocrA})</text>

            {/* OCR B Line */}
            <line x1="60" y1="85" x2="780" y2="85" stroke="#06b6d4" strokeDasharray="2 2" strokeWidth="1" />
            <text x="50" y="89" fill="#06b6d4" fontSize="10" textAnchor="end">OCR{currentTimerSpec.index}B ({ocrB})</text>

            {/* Bottom (0) Line */}
            <line x1="60" y1="140" x2="780" y2="140" stroke="#64748b" strokeWidth="1" />
            <text x="50" y="144" fill="#94a3b8" fontSize="10" textAnchor="end">BOTTOM (0)</text>

            {/* Sawtooth / Triangle Ramp Wave for TCNT */}
            {wgmMode === 'phase_correct' ? (
              // Triangular Wave
              <path
                d="
                  M 70 140
                  L 170 30
                  L 270 140
                  L 370 30
                  L 470 140
                  L 570 30
                  L 670 140
                  L 770 30
                "
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
              />
            ) : (
              // Sawtooth Ramp (CTC / Fast PWM)
              <path
                d="
                  M 70 140
                  L 220 30
                  L 220 140
                  L 370 30
                  L 370 140
                  L 520 30
                  L 520 140
                  L 670 30
                  L 670 140
                  L 780 40
                "
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
              />
            )}

            {/* Interrupt Strobe Arrows */}
            <line x1="220" y1="15" x2="220" y2="155" stroke="#f59e0b" strokeDasharray="3 3" strokeWidth="1.2" />
            <circle cx="220" cy="30" r="4" fill="#f59e0b" />
            <text x="220" y="12" fill="#f59e0b" fontSize="9" textAnchor="middle">인터럽트 트리거 (RETI)</text>

            <line x1="370" y1="15" x2="370" y2="155" stroke="#f59e0b" strokeDasharray="3 3" strokeWidth="1.2" />
            <circle cx="370" cy="30" r="4" fill="#f59e0b" />
            <text x="370" y="12" fill="#f59e0b" fontSize="9" textAnchor="middle">주기: {(1000 / currentAnalysis.actualFreqHz).toFixed(2)}ms</text>
          </svg>
        </div>
      </section>

      {/* Step 5: C Initialization Code & Copy Section */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                생성된 AVR C 타이머 초기화 코드 (Production Firmware Code)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentTimerSpec.name} • {wgmBitInfo.modeName} • {desiredFrequencyHz.toLocaleString()} Hz 기준
              </p>
            </div>
          </div>

          <button
            onClick={handleCopyCode}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 shrink-0"
          >
            {copiedCode ? <Check className="w-4 h-4 text-slate-950" /> : <Copy className="w-4 h-4" />}
            <span>{copiedCode ? '복사 완료!' : 'C 초기화 코드 복사'}</span>
          </button>
        </div>

        <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed max-h-96 select-all">
          {generatedCInitCode}
        </pre>
      </section>
    </div>
  );
};
