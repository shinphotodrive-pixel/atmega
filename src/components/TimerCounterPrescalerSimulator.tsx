import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Play,
  Pause,
  Layers,
  Sparkles,
  Waves,
  ArrowRight,
  Maximize2
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type TimerUnitId = 'timer0' | 'timer1' | 'timer2' | 'timer3' | 'timer4' | 'timer5';
export type TimerOperationMode = 'normal' | 'ctc' | 'fast_pwm' | 'phase_correct';

interface TimerDefinition {
  id: TimerUnitId;
  name: string;
  bits: 8 | 16;
  maxCount: number;
  ocPins: string;
  description: string;
  isAsynchronousRtc?: boolean;
}

interface PrescalerEntry {
  factor: number;
  label: string;
  csBits: string;
  csVal: number;
  description: string;
}

const CLOCK_PRESETS = [
  { fcpu: 1000000, label: '1.0 MHz', desc: '내부 RC 기본 출하 상태' },
  { fcpu: 4000000, label: '4.0 MHz', desc: '저전력 배터리 구동' },
  { fcpu: 8000000, label: '8.0 MHz', desc: '3.3V Pro Mini / 내부 RC' },
  { fcpu: 12000000, label: '12.0 MHz', desc: 'V-USB 클록' },
  { fcpu: 16000000, label: '16.0 MHz', desc: '표준 5V Uno / Mega 크리스털' },
  { fcpu: 20000000, label: '20.0 MHz', desc: 'AVR 정격 최대 클록' }
];

// Prescalers for standard timers (Timer0, Timer1, Timer3, Timer4, Timer5)
const STANDARD_PRESCALERS: PrescalerEntry[] = [
  { factor: 1, label: '1 (No Prescaler)', csBits: '0b001', csVal: 1, description: 'f_clk_io 직접 공급 (최고 분해능, 62.5ns @ 16MHz)' },
  { factor: 8, label: '8 분주', csBits: '0b010', csVal: 2, description: 'f_clk_io / 8 (0.5µs @ 16MHz)' },
  { factor: 64, label: '64 분주', csBits: '0b011', csVal: 3, description: 'f_clk_io / 64 (표준 밀리초 단위 millis() 타이머)' },
  { factor: 256, label: '256 분주', csBits: '0b100', csVal: 4, description: 'f_clk_io / 256 (16µs @ 16MHz)' },
  { factor: 1024, label: '1024 분주', csBits: '0b101', csVal: 5, description: 'f_clk_io / 1024 (최대 주기 지연, 64µs @ 16MHz)' }
];

// Prescalers for Timer2 (Asynchronous RTC capable with 32 and 128)
const TIMER2_PRESCALERS: PrescalerEntry[] = [
  { factor: 1, label: '1 (No Prescaler)', csBits: '0b001', csVal: 1, description: 'f_clk_io 직접 공급' },
  { factor: 8, label: '8 분주', csBits: '0b010', csVal: 2, description: 'f_clk_io / 8' },
  { factor: 32, label: '32 분주 (Timer2 전용)', csBits: '0b011', csVal: 3, description: 'f_clk_io / 32 (비동기 RTC 32.768kHz 최적화)' },
  { factor: 64, label: '64 분주', csBits: '0b100', csVal: 4, description: 'f_clk_io / 64' },
  { factor: 128, label: '128 분주 (Timer2 전용)', csBits: '0b101', csVal: 5, description: 'f_clk_io / 128 (1초 정확 1Hz 타이머 분주)' },
  { factor: 256, label: '256 분주', csBits: '0b110', csVal: 6, description: 'f_clk_io / 256' },
  { factor: 1024, label: '1024 분주', csBits: '0b111', csVal: 7, description: 'f_clk_io / 1024' }
];

export const TimerCounterPrescalerSimulator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // System Clock Frequency state
  const [fcpu, setFcpu] = useState<number>(16000000);
  const [fcpuInputMhz, setFcpuInputMhz] = useState<string>('16.0');
  const [isCustomFcpu, setIsCustomFcpu] = useState<boolean>(false);

  // Available timers for selected MCU
  const availableTimers = useMemo<TimerDefinition[]>(() => {
    switch (selectedMCU) {
      case 'atmega2560':
      case 'atmega640':
        return [
          { id: 'timer0', name: 'Timer/Counter 0', bits: 8, maxCount: 255, ocPins: 'OC0A(PB7), OC0B(PG5)', description: '8비트 고속 PWM & 시스템 틱' },
          { id: 'timer1', name: 'Timer/Counter 1', bits: 16, maxCount: 65535, ocPins: 'OC1A(PB5), OC1B(PB6), OC1C(PB7)', description: '16비트 정밀 모터/서보 제어' },
          { id: 'timer2', name: 'Timer/Counter 2', bits: 8, maxCount: 255, ocPins: 'OC2A(PB4), OC2B(PH6)', description: '8비트 비동기 RTC(TOSC1/2)' , isAsynchronousRtc: true },
          { id: 'timer3', name: 'Timer/Counter 3', bits: 16, maxCount: 65535, ocPins: 'OC3A(PE3), OC3B(PE4), OC3C(PE5)', description: '16비트 확장 다채널 PWM' },
          { id: 'timer4', name: 'Timer/Counter 4', bits: 16, maxCount: 65535, ocPins: 'OC4A(PH3), OC4B(PH4), OC4C(PH5)', description: '16비트 3D 프린터 히터 제어' },
          { id: 'timer5', name: 'Timer/Counter 5', bits: 16, maxCount: 65535, ocPins: 'OC5A(PL3), OC5B(PL4), OC5C(PL5)', description: '16비트 서보/엔코더 캡처' }
        ];
      case 'atmega128':
        return [
          { id: 'timer0', name: 'Timer/Counter 0', bits: 8, maxCount: 255, ocPins: 'OC0(PB4)', description: '8비트 비동기 RTC 겸용' , isAsynchronousRtc: true },
          { id: 'timer1', name: 'Timer/Counter 1', bits: 16, maxCount: 65535, ocPins: 'OC1A(PB5), OC1B(PB6), OC1C(PB7)', description: '16비트 3채널 PWM' },
          { id: 'timer2', name: 'Timer/Counter 2', bits: 8, maxCount: 255, ocPins: 'OC2(PB7)', description: '8비트 기본 타이머' },
          { id: 'timer3', name: 'Timer/Counter 3', bits: 16, maxCount: 65535, ocPins: 'OC3A(PE3), OC3B(PE4), OC3C(PE5)', description: '16비트 정밀 타이머' }
        ];
      case 'atmega328p':
      default:
        return [
          { id: 'timer0', name: 'Timer/Counter 0', bits: 8, maxCount: 255, ocPins: 'OC0A(PD6/D6), OC0B(PD5/D5)', description: '8비트 표준 millis() 타이머' },
          { id: 'timer1', name: 'Timer/Counter 1', bits: 16, maxCount: 65535, ocPins: 'OC1A(PB1/D9), OC1B(PB2/D10)', description: '16비트 Servo & Tone 제어' },
          { id: 'timer2', name: 'Timer/Counter 2', bits: 8, maxCount: 255, ocPins: 'OC2A(PB3/D11), OC2B(PD3/D3)', description: '8비트 비동기 RTC (TOSC1/2)' , isAsynchronousRtc: true }
        ];
    }
  }, [selectedMCU]);

  // Selected Timer state
  const [selectedTimerId, setSelectedTimerId] = useState<TimerUnitId>('timer0');

  // Verify selected timer is valid for current MCU
  const activeTimer = useMemo(() => {
    return availableTimers.find((t) => t.id === selectedTimerId) || availableTimers[0];
  }, [availableTimers, selectedTimerId]);

  // Prescaler list depending on whether Timer2 is selected
  const prescalerList = useMemo(() => {
    return activeTimer.isAsynchronousRtc ? TIMER2_PRESCALERS : STANDARD_PRESCALERS;
  }, [activeTimer]);

  // Prescaler selection
  const [prescalerFactor, setPrescalerFactor] = useState<number>(64);

  // Operation Mode
  const [opMode, setOpMode] = useState<TimerOperationMode>('normal');

  // Compare Match Register (OCRnx) value
  const [ocrValue, setOcrValue] = useState<number>(127);

  // Animation Play/Pause & Speed
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [animProgress, setAnimProgress] = useState<number>(0);
  const animRef = useRef<number | null>(null);

  // Copy code feedback
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Frequency handler
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

  // Adjust default OCR when timer bit depth changes
  useEffect(() => {
    if (activeTimer.bits === 16 && ocrValue < 256) {
      setOcrValue(15624); // Standard 1-second interval at 16MHz/1024
    } else if (activeTimer.bits === 8 && ocrValue > 255) {
      setOcrValue(127);
    }
  }, [activeTimer.bits]);

  // Ensure selected prescaler is valid in current list
  useEffect(() => {
    if (!prescalerList.some((p) => p.factor === prescalerFactor)) {
      setPrescalerFactor(prescalerList[2]?.factor || 64);
    }
  }, [prescalerList, prescalerFactor]);

  // ---------------------------------------------------------------------------
  // 1. Core Mathematical Timer/Prescaler & Waveform Frequency Calculations
  // ---------------------------------------------------------------------------
  const timerCalculations = useMemo(() => {
    const N = prescalerFactor;
    const bits = activeTimer.bits;
    const maxCount = activeTimer.maxCount;

    // Timer Tick Frequency & Duration
    const timerFreqHz = fcpu / N;
    const tickPeriodNs = (1 / timerFreqHz) * 1e9;
    const tickPeriodUs = tickPeriodNs / 1000;

    // Mode-specific Top Count & Cycle Steps
    let topCount = maxCount;
    let stepsPerCycle = maxCount + 1;
    let isDualSlope = false;

    if (opMode === 'ctc') {
      topCount = Math.min(maxCount, Math.max(1, ocrValue));
      stepsPerCycle = topCount + 1;
    } else if (opMode === 'fast_pwm') {
      topCount = maxCount;
      stepsPerCycle = maxCount + 1;
    } else if (opMode === 'phase_correct') {
      topCount = maxCount;
      stepsPerCycle = 2 * topCount; // Up then Down
      isDualSlope = true;
    }

    // Overflow / Cycle Frequency & Period
    const overflowFreqHz = isDualSlope
      ? fcpu / (2 * N * topCount)
      : fcpu / (N * stepsPerCycle);

    const overflowPeriodSec = 1 / overflowFreqHz;
    const overflowPeriodMs = overflowPeriodSec * 1000;
    const overflowPeriodUs = overflowPeriodSec * 1e6;

    // Physical Output Pin Waveform (OCnx Pin)
    let outputPinFreqHz = overflowFreqHz;
    let outputDutyPercent = 50.0;
    let outputModeDesc = '';

    if (opMode === 'normal') {
      outputPinFreqHz = overflowFreqHz / 2; // Toggle on compare match
      outputDutyPercent = 50.0;
      outputModeDesc = 'Compare Match 시 OCnx 토글 (50% 듀티 사각파, 오버플로 주파수의 1/2)';
    } else if (opMode === 'ctc') {
      outputPinFreqHz = overflowFreqHz / 2; // Hardware toggle on compare match
      outputDutyPercent = 50.0;
      outputModeDesc = 'CTC 토글 모드 (완벽한 50% 듀티 구형파 생성)';
    } else if (opMode === 'fast_pwm') {
      outputPinFreqHz = overflowFreqHz;
      outputDutyPercent = ((ocrValue + 1) / (topCount + 1)) * 100;
      outputModeDesc = `고속 단일 슬로프 PWM (듀티: ${outputDutyPercent.toFixed(1)}%)`;
    } else if (opMode === 'phase_correct') {
      outputPinFreqHz = overflowFreqHz;
      outputDutyPercent = (ocrValue / topCount) * 100;
      outputModeDesc = `위상 교정 듀얼 슬로프 PWM (중심 정렬, 듀티: ${outputDutyPercent.toFixed(1)}%)`;
    }

    // Active Prescaler Info
    const activePrescalerEntry = prescalerList.find((p) => p.factor === N) || prescalerList[0];

    return {
      N,
      bits,
      maxCount,
      topCount,
      stepsPerCycle,
      isDualSlope,
      timerFreqHz,
      tickPeriodNs,
      tickPeriodUs,
      overflowFreqHz,
      overflowPeriodSec,
      overflowPeriodMs,
      overflowPeriodUs,
      outputPinFreqHz,
      outputDutyPercent,
      outputModeDesc,
      activePrescalerEntry
    };
  }, [fcpu, prescalerFactor, activeTimer, opMode, ocrValue, prescalerList]);

  // ---------------------------------------------------------------------------
  // 2. Prescaler Comparison Matrix for all available Prescalers
  // ---------------------------------------------------------------------------
  const prescalerSweepMatrix = useMemo(() => {
    return prescalerList.map((p) => {
      const N = p.factor;
      const tickUs = (N / fcpu) * 1e6;
      const steps = activeTimer.maxCount + 1;
      const ovfFreq = fcpu / (N * steps);
      const ovfPeriodMs = (1 / ovfFreq) * 1000;
      const maxDelaySec = ovfPeriodMs / 1000;

      return {
        ...p,
        tickUs,
        ovfFreq,
        ovfPeriodMs,
        maxDelaySec,
        isCurrent: p.factor === prescalerFactor
      };
    });
  }, [prescalerList, fcpu, activeTimer, prescalerFactor]);

  // ---------------------------------------------------------------------------
  // 3. Real-Time Waveform Animation Driver
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    let lastTime = performance.now();
    const animate = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      // Progress cycle: visually advances 1 full waveform cycle in ~2.0 seconds
      setAnimProgress((prev) => (prev + dt * 0.5) % 1.0);
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying]);

  // Format Frequency nicely (Hz, kHz, MHz)
  const formatFreq = (hz: number): string => {
    if (hz >= 1000000) return `${(hz / 1000000).toFixed(4)} MHz`;
    if (hz >= 1000) return `${(hz / 1000).toFixed(3)} kHz`;
    return `${hz.toFixed(2)} Hz`;
  };

  // Format Time Period nicely (s, ms, µs, ns)
  const formatPeriod = (sec: number): string => {
    if (sec >= 1) return `${sec.toFixed(3)} s`;
    if (sec >= 0.001) return `${(sec * 1000).toFixed(3)} ms`;
    if (sec >= 0.000001) return `${(sec * 1e6).toFixed(2)} µs`;
    return `${(sec * 1e9).toFixed(1)} ns`;
  };

  // Copy C-Code handler
  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.7 }
    });
  };

  // C Register Code Generator
  const generatedCCode = useMemo(() => {
    const tNum = activeTimer.id.replace('timer', '');
    const csBits = timerCalculations.activePrescalerEntry.csBits;

    let wgmComment = 'Normal 모드';
    let tccraVal = '0x00';
    let tccrbVal = `(1 << CS${tNum}2) | (1 << CS${tNum}0)`; // e.g. /1024

    if (opMode === 'ctc') {
      wgmComment = 'CTC 모드 (OCRnA 일치 시 카운터 0 리셋 & 토글)';
      tccraVal = `(1 << COM${tNum}A0)`; // Toggle OCnA
      tccrbVal = `(1 << WGM${tNum}2) | ${csBits}`;
    } else if (opMode === 'fast_pwm') {
      wgmComment = 'Fast PWM 모드 (비반전 출력)';
      tccraVal = `(1 << COM${tNum}A1) | (1 << WGM${tNum}0) | (1 << WGM${tNum}1)`;
      tccrbVal = `(1 << WGM${tNum}2) | ${csBits}`;
    } else if (opMode === 'phase_correct') {
      wgmComment = 'Phase Correct PWM 모드 (대칭 삼각파)';
      tccraVal = `(1 << COM${tNum}A1) | (1 << WGM${tNum}0)`;
      tccrbVal = `${csBits}`;
    }

    return `// ==============================================================================
// ${currentProfile.name} ${activeTimer.name} Prescaler & Waveform Configuration
// F_CPU             : ${fcpu} Hz (${(fcpu / 1000000).toFixed(4)} MHz)
// Prescaler (N)     : ${prescalerFactor} 분주 (${timerCalculations.activePrescalerEntry.csBits})
// Tick Resolution   : ${timerCalculations.tickPeriodUs.toFixed(3)} µs (${timerCalculations.tickPeriodNs.toFixed(1)} ns)
// Overflow Frequency: ${formatFreq(timerCalculations.overflowFreqHz)} (${formatPeriod(timerCalculations.overflowPeriodSec)})
// Output Pin Freq   : ${formatFreq(timerCalculations.outputPinFreqHz)} (Duty: ${timerCalculations.outputDutyPercent.toFixed(1)}%)
// Hardware Pins     : ${activeTimer.ocPins}
// ==============================================================================
#define F_CPU ${fcpu}UL
#include <avr/io.h>
#include <avr/interrupt.h>

void Timer_Init(void) {
    // 1. 하드웨어 출력 핀(OC${tNum}A)을 출력(OUTPUT)으로 설정
    // ${activeTimer.ocPins}
    DDRB |= (1 << PB${tNum}); // 해당 MCU 핀아웃에 맞게 매핑

    // 2. 카운터 레지스터(TCNT${tNum}) 초기화
    TCNT${tNum} = 0;

    // 3. 비교 일치 레지스터(OCR${tNum}A) 설정
    OCR${tNum}A = ${ocrValue}; // TOP 또는 듀티 임계값

    // 4. 모드 설정: ${wgmComment}
    TCCR${tNum}A = ${tccraVal};
    TCCR${tNum}B = ${tccrbVal};

    // 5. 인터럽트 마스크 활성화 (필요 시 주석 해제)
    // TIMSK${tNum} |= (1 << TOIE${tNum});  // 오버플로 인터럽트
    // TIMSK${tNum} |= (1 << OCIE${tNum}A); // 비교 일치 A 인터럽트

    sei(); // 전역 인터럽트 활성화
}

// 오버플로 인터럽트 서비스 루틴 (${formatFreq(timerCalculations.overflowFreqHz)} 주기)
ISR(TIMER${tNum}_OVF_vect) {
    // 사용자 주기적 처리 코드 작성
}
`;
  }, [currentProfile.name, activeTimer, fcpu, prescalerFactor, timerCalculations, opMode, ocrValue]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <Waves className="w-3.5 h-3.5 animate-pulse" /> Timer/Counter Prescaler Simulator
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              F_CPU ➔ Prescaler ➔ Overflow ➔ Real-time Output Waveform
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-xs font-mono font-bold">
              {currentProfile.name}
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            타이머/카운터 프리스케일러 & 실시간 출력 파형 시뮬레이터
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            시스템 클록(F_CPU), <strong>프리스케일러 분주비(1, 8, 32, 64, 128, 256, 1024)</strong> 및{' '}
            <strong>타이머 오버플로 주파수(F_overflow)</strong> 간의 유기적 상관관계를 시각화하고,
            비교 일치(Compare Match)에 따른 <strong>출력 구형파(Square Wave) 및 PWM 파형</strong>을 실시간 애니메이션으로 계산합니다.
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

      {/* Control Grid: 1. System Clock & Timer Selector, 2. Prescaler & Waveform Modes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (6 Cols): Hardware Configuration Inputs */}
        <div className="lg:col-span-6 space-y-4">
          {/* Section 1: System Clock (F_CPU) Selection */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-cyan-400" />
                1. 시스템 클록 주파수 (System Clock: F_CPU)
              </label>
              <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
                {(fcpu / 1000000).toFixed(4)} MHz
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {CLOCK_PRESETS.map((preset) => {
                const isSelected = !isCustomFcpu && fcpu === preset.fcpu;
                return (
                  <button
                    key={preset.fcpu}
                    onClick={() => handleSelectClockPreset(preset.fcpu)}
                    className={`p-2 rounded-xl text-left border transition ${
                      isSelected
                        ? 'bg-cyan-500/20 text-white border-cyan-500/60 shadow-sm ring-1 ring-cyan-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold font-mono text-cyan-300">{preset.label}</div>
                    <div className="text-[10px] text-slate-500 truncate">{preset.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Custom Clock Input */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800/50">
              <span className="text-xs text-slate-400 shrink-0">커스텀 클록 직접 입력:</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.001"
                  min="0.1"
                  max="30"
                  value={fcpuInputMhz}
                  onChange={(e) => handleCustomClockChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                  placeholder="예: 16.0"
                />
                <span className="absolute right-3 top-1.5 text-xs text-slate-500 font-mono">MHz</span>
              </div>
            </div>
          </div>

          {/* Section 2: Timer/Counter Peripheral Selector */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-amber-400" />
                2. 대상 타이머/카운터 선택 (Timer Peripheral)
              </label>
              <span className="text-xs font-mono font-bold text-amber-400">
                {activeTimer.bits}-bit ({activeTimer.maxCount} MAX)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {availableTimers.map((t) => {
                const isSelected = selectedTimerId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTimerId(t.id)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-950/40 border-amber-500 text-white shadow-md shadow-amber-950/40 ring-1 ring-amber-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-white">{t.name}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono font-bold">
                          {t.bits}비트
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">{t.description}</p>
                    </div>
                    <div className="mt-2 pt-1 border-t border-slate-800/60 text-[9px] font-mono text-slate-500 truncate">
                      {t.ocPins}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (6 Cols): Prescaler Slider & Operation Modes */}
        <div className="lg:col-span-6 space-y-4">
          {/* Section 3: Prescaler Factor Selection */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-purple-400" />
                3. 프리스케일러 분주비 선택 (Prescaler: N)
              </label>
              <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950/50 px-2.5 py-0.5 rounded border border-purple-800/40">
                1 / {prescalerFactor} 분주 ({timerCalculations.activePrescalerEntry.csBits})
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              {prescalerList.map((p) => {
                const isSelected = prescalerFactor === p.factor;
                return (
                  <button
                    key={p.factor}
                    onClick={() => setPrescalerFactor(p.factor)}
                    className={`p-2.5 rounded-xl border text-center transition ${
                      isSelected
                        ? 'bg-purple-950/50 border-purple-500 text-white shadow-md shadow-purple-950/30 ring-1 ring-purple-500/40 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs text-purple-300 font-bold">N = {p.factor}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{p.csBits}</div>
                  </button>
                );
              })}
            </div>

            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono flex items-center justify-between">
              <span className="text-slate-400">1 타이머 틱(Tick) 분해능:</span>
              <span className="text-emerald-400 font-bold">
                {timerCalculations.tickPeriodUs >= 1
                  ? `${timerCalculations.tickPeriodUs.toFixed(3)} µs`
                  : `${timerCalculations.tickPeriodNs.toFixed(1)} ns`}
              </span>
            </div>
          </div>

          {/* Section 4: Timer Operation Mode & OCR Setting */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 border-b border-slate-800/70 pb-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              4. 타이머 동작 모드 및 비교 일치(OCR) 설정
            </span>

            {/* Mode Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
              {[
                { id: 'normal', label: 'Normal 모드', desc: '자유 카운팅 오버플로' },
                { id: 'ctc', label: 'CTC 모드', desc: 'OCR 일치 시 리셋' },
                { id: 'fast_pwm', label: 'Fast PWM', desc: '단일 슬로프 고속' },
                { id: 'phase_correct', label: 'Phase Correct', desc: '대칭 삼각파' }
              ].map((m) => {
                const isSelected = opMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setOpMode(m.id as TimerOperationMode)}
                    className={`p-2 rounded-xl border text-center transition ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-500 text-white font-bold ring-1 ring-emerald-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <div>{m.label}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">{m.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* OCR Slider */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">비교 일치 레지스터 (OCRnA Threshold):</span>
                <span className="text-amber-300 font-bold">
                  {ocrValue} (0x{ocrValue.toString(16).toUpperCase()}) / {timerCalculations.maxCount}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max={timerCalculations.maxCount}
                value={ocrValue}
                onChange={(e) => setOcrValue(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>0 (최소 듀티)</span>
                <span>{Math.round(timerCalculations.maxCount / 2)} (50% 듀티)</span>
                <span>{timerCalculations.maxCount} (100% 듀티)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Calculated Metrics Dashboard */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
          <span className="text-slate-500 block text-[10px]">타이머 클록 주파수 (f_TCNT)</span>
          <span className="text-lg sm:text-xl font-black text-cyan-400 block my-0.5">
            {formatFreq(timerCalculations.timerFreqHz)}
          </span>
          <span className="text-[10px] text-slate-400">틱 분해능: {timerCalculations.tickPeriodNs.toFixed(1)} ns</span>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-amber-500/30">
          <span className="text-slate-500 block text-[10px]">오버플로 주파수 (f_overflow)</span>
          <span className="text-lg sm:text-xl font-black text-amber-400 block my-0.5">
            {formatFreq(timerCalculations.overflowFreqHz)}
          </span>
          <span className="text-[10px] text-amber-300/80">주기: {formatPeriod(timerCalculations.overflowPeriodSec)}</span>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-emerald-500/30">
          <span className="text-slate-500 block text-[10px]">출력 핀 파형 주파수 (f_OCnx)</span>
          <span className="text-lg sm:text-xl font-black text-emerald-400 block my-0.5">
            {formatFreq(timerCalculations.outputPinFreqHz)}
          </span>
          <span className="text-[10px] text-emerald-300/80">듀티: {timerCalculations.outputDutyPercent.toFixed(1)}%</span>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-purple-500/30">
          <span className="text-slate-500 block text-[10px]">사이클당 스텝 수 (TOP + 1)</span>
          <span className="text-lg sm:text-xl font-black text-purple-400 block my-0.5">
            {timerCalculations.stepsPerCycle.toLocaleString()} Steps
          </span>
          <span className="text-[10px] text-purple-300/80">
            {timerCalculations.isDualSlope ? '듀얼 슬로프 (상/하향)' : '단일 슬로프 (톱니파)'}
          </span>
        </div>
      </div>

      {/* Real-Time Animated Output Waveform Calculation & Visualizer */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              실시간 출력 파형 연산 & 시뮬레이션 (Real-Time Waveform Engine)
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isPlaying ? '일시 정지' : '애니메이션 재생'}</span>
            </button>
          </div>
        </div>

        {/* SVG Multi-Track Waveform Canvas */}
        <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-4">
          {/* Track 1: TCNT Counter Sawtooth / Triangle Wave */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                Track 1: 카운터 값 증가 파형 (TCNT{activeTimer.id.replace('timer', '')}: 0 ➔ {timerCalculations.topCount})
              </span>
              <span className="text-slate-400">
                현재 카운트: {Math.round(animProgress * timerCalculations.topCount)} | 임계값(OCR): {ocrValue}
              </span>
            </div>

            <div className="relative h-28 bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden">
              {/* SVG Sawtooth waveform across 2 complete cycles */}
              <svg className="w-full h-full" viewBox="0 0 1000 100" preserveAspectRatio="none">
                {/* Horizontal Grid lines */}
                <line x1="0" y1="10" x2="1000" y2="10" stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="0" y1="50" x2="1000" y2="50" stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="0" y1="90" x2="1000" y2="90" stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" />

                {/* Compare Match OCR Horizontal Line */}
                {(() => {
                  const ocrY = 90 - (ocrValue / timerCalculations.topCount) * 80;
                  return (
                    <g>
                      <line x1="0" y1={ocrY} x2="1000" y2={ocrY} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 4" />
                      <text x="10" y={Math.max(15, ocrY - 4)} fill="#f59e0b" fontSize="10" fontFamily="monospace">
                        OCR Threshold ({ocrValue})
                      </text>
                    </g>
                  );
                })()}

                {/* TCNT Counter Waveform Paths (2 Cycles) */}
                {timerCalculations.isDualSlope ? (
                  // Phase Correct Triangle Wave: Up to TOP then Down to 0
                  <polyline
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2.5"
                    points="0,90 250,10 500,90 750,10 1000,90"
                  />
                ) : (
                  // Normal & Fast PWM & CTC Sawtooth: 0 -> TOP, drop to 0
                  <g>
                    <polyline fill="none" stroke="#06b6d4" strokeWidth="2.5" points="0,90 495,10" />
                    <line x1="495" y1="10" x2="500" y2="90" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="2 2" />
                    <polyline fill="none" stroke="#06b6d4" strokeWidth="2.5" points="500,90 995,10" />
                    <line x1="995" y1="10" x2="1000" y2="90" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="2 2" />
                  </g>
                )}

                {/* Dynamic Moving Timeline Cursor */}
                {(() => {
                  const cursorX = animProgress * 1000;
                  return (
                    <line
                      x1={cursorX}
                      y1="0"
                      x2={cursorX}
                      y2="100"
                      stroke="#ef4444"
                      strokeWidth="2"
                    />
                  );
                })()}
              </svg>
            </div>
          </div>

          {/* Track 2: Overflow Interrupt Trigger Pulses */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Track 2: 오버플로 인터럽트 플래그 펄스 (TOV{activeTimer.id.replace('timer', '')} Trigger @ {formatFreq(timerCalculations.overflowFreqHz)})
              </span>
              <span className="text-slate-400">주기: {formatPeriod(timerCalculations.overflowPeriodSec)}</span>
            </div>

            <div className="relative h-12 bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 1000 50" preserveAspectRatio="none">
                {/* Baseline 0 */}
                <line x1="0" y1="40" x2="1000" y2="40" stroke="#334155" strokeWidth="0.5" />
                {/* Trigger Pulses at cycle boundaries (500 and 1000) */}
                <polyline fill="none" stroke="#f59e0b" strokeWidth="2.5" points="0,40 495,40 495,10 505,10 505,40 995,40 995,10 1000,10" />
              </svg>
            </div>
          </div>

          {/* Track 3: Physical Output Pin Waveform (OCnx Pin) */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                Track 3: 물리 핀 출력 파형 (OCnx Output Waveform: {formatFreq(timerCalculations.outputPinFreqHz)})
              </span>
              <span className="text-emerald-300 font-bold font-mono">
                {timerCalculations.outputModeDesc}
              </span>
            </div>

            <div className="relative h-16 bg-slate-950 rounded-xl border border-slate-800/80 overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 1000 60" preserveAspectRatio="none">
                {/* Duty Cycle Waveform */}
                {(() => {
                  const duty = timerCalculations.outputDutyPercent / 100;
                  const c1High = Math.max(10, Math.min(490, 500 * duty));
                  const c2High = 500 + Math.max(10, Math.min(490, 500 * duty));

                  return (
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3"
                      points={`0,15 ${c1High},15 ${c1High},48 500,48 500,15 ${c2High},15 ${c2High},48 1000,48`}
                    />
                  );
                })()}

                {/* Moving Cursor */}
                {(() => {
                  const cursorX = animProgress * 1000;
                  return (
                    <line
                      x1={cursorX}
                      y1="0"
                      x2={cursorX}
                      y2="60"
                      stroke="#ef4444"
                      strokeWidth="2"
                    />
                  );
                })()}
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Prescaler Sweep Matrix Comparison Table */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            전체 프리스케일러별 분해능 & 오버플로 주파수 비교표 (Prescaler Matrix)
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            F_CPU: {(fcpu / 1000000).toFixed(2)} MHz | {activeTimer.name} ({activeTimer.bits}비트)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                <th className="py-2 px-3">분주비 (N)</th>
                <th className="py-2 px-3">CS 설정 비트</th>
                <th className="py-2 px-3">1 틱(Tick) 분해능</th>
                <th className="py-2 px-3">오버플로 주파수 (f_OVF)</th>
                <th className="py-2 px-3">오버플로 주기 (T_OVF)</th>
                <th className="py-2 px-3 text-right">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {prescalerSweepMatrix.map((row) => (
                <tr
                  key={row.factor}
                  onClick={() => setPrescalerFactor(row.factor)}
                  className={`transition cursor-pointer ${
                    row.isCurrent
                      ? 'bg-purple-950/40 text-white font-bold'
                      : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                  }`}
                >
                  <td className="py-2.5 px-3">
                    <span className={row.isCurrent ? 'text-purple-300 font-bold' : ''}>
                      N = {row.factor}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">{row.csBits}</td>
                  <td className="py-2.5 px-3 text-cyan-300">
                    {row.tickUs >= 1 ? `${row.tickUs.toFixed(3)} µs` : `${(row.tickUs * 1000).toFixed(1)} ns`}
                  </td>
                  <td className="py-2.5 px-3 text-amber-300 font-bold">
                    {formatFreq(row.ovfFreq)}
                  </td>
                  <td className="py-2.5 px-3 text-emerald-300">
                    {formatPeriod(row.maxDelaySec)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {row.isCurrent ? (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500 text-slate-950 font-bold">
                        선택됨
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">클릭하여 선택</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Production C-Code Generator */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold text-white">
              C 언어 타이머/카운터 초기화 레지스터 코드 ({currentProfile.name})
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              {activeTimer.id.toUpperCase()} • N={prescalerFactor} • {opMode.toUpperCase()}
            </span>
          </div>

          <button
            onClick={() => handleCopyCode(generatedCCode)}
            className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-cyan-600/20"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? '복사 완료!' : 'C 소스코드 복사'}</span>
          </button>
        </div>

        <pre className="p-4 overflow-x-auto max-h-[360px] overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed bg-slate-950 custom-scrollbar select-all">
          {generatedCCode}
        </pre>
      </div>
    </div>
  );
};
