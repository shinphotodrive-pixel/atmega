import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
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
  Download,
  Sparkles,
  Waves,
  ArrowRight,
  Maximize2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type TimerUnit = 'timer0' | 'timer1' | 'timer2' | 'timer3' | 'timer4' | 'timer5';
export type TimerMode = 'normal' | 'ctc' | 'fast_pwm' | 'phase_correct_pwm';

export interface PrescalerOption {
  value: number;
  label: string;
  csBits: number; // 3-bit CS value (0b000 - 0b111)
  description: string;
}

// Prescaler sets
const STANDARD_PRESCALERS: PrescalerOption[] = [
  { value: 0, label: 'Stopped (정지)', csBits: 0b000, description: '클럭 정지 (타이머 카운트 비활성화)' },
  { value: 1, label: '1 (No Prescaler)', csBits: 0b001, description: 'f_clk_io 직접 공급 (가장 높은 분해능)' },
  { value: 8, label: '8', csBits: 0b010, description: 'f_clk_io / 8' },
  { value: 64, label: '64', csBits: 0b011, description: 'f_clk_io / 64 (일반 주기 인터럽트에 적합)' },
  { value: 256, label: '256', csBits: 0b100, description: 'f_clk_io / 256' },
  { value: 1024, label: '1024', csBits: 0b101, description: 'f_clk_io / 1024 (장주기 타이머/초 단위 지연)' },
  { value: -1, label: 'Ext Tn (Falling)', csBits: 0b110, description: 'Tn 핀 외부 클럭 (하강 에지)' },
  { value: -2, label: 'Ext Tn (Rising)', csBits: 0b111, description: 'Tn 핀 외부 클럭 (상승 에지)' }
];

const TIMER2_PRESCALERS: PrescalerOption[] = [
  { value: 0, label: 'Stopped (정지)', csBits: 0b000, description: '클럭 정지' },
  { value: 1, label: '1 (No Prescaler)', csBits: 0b001, description: 'f_clk_io 직접 공급' },
  { value: 8, label: '8', csBits: 0b010, description: 'f_clk_io / 8' },
  { value: 32, label: '32', csBits: 0b011, description: 'f_clk_io / 32 (Timer2 고유)' },
  { value: 64, label: '64', csBits: 0b100, description: 'f_clk_io / 64' },
  { value: 128, label: '128', csBits: 0b101, description: 'f_clk_io / 128 (Timer2 고유)' },
  { value: 256, label: '256', csBits: 0b110, description: 'f_clk_io / 256' },
  { value: 1024, label: '1024', csBits: 0b111, description: 'f_clk_io / 1024' }
];

interface QuickPreset {
  name: string;
  tag: string;
  desc: string;
  timer: TimerUnit;
  mode: TimerMode;
  prescaler: number;
  ocrValue: number;
  preloadValue: number;
  pwmDutyPct: number;
  fcpu: number;
}

const PRESETS: QuickPreset[] = [
  {
    name: '1ms 시스템 틱 (System Tick 1kHz)',
    tag: '1ms ISR',
    desc: 'Timer0 CTC 모드로 1ms마다 정확히 타이머 인터럽트를 발생시켜 millis() 카운터 구현',
    timer: 'timer0',
    mode: 'ctc',
    prescaler: 64,
    ocrValue: 249, // 16MHz / (64 * (249 + 1)) = 1000 Hz
    preloadValue: 0,
    pwmDutyPct: 50,
    fcpu: 16000000
  },
  {
    name: '10ms 정밀 스케줄러 (100Hz 주기)',
    tag: '10ms CTC',
    desc: 'Timer1 16비트 CTC 모드로 정밀 10ms 태스크 스케줄링 인터럽트 실행',
    timer: 'timer1',
    mode: 'ctc',
    prescaler: 64,
    ocrValue: 2499, // 16MHz / (64 * (2499 + 1)) = 100 Hz
    preloadValue: 0,
    pwmDutyPct: 50,
    fcpu: 16000000
  },
  {
    name: '440Hz 음계 라(A4) 버저 사운드',
    tag: 'Audio 440Hz',
    desc: 'CTC 모드에서 하드웨어 OCnA 핀을 자동 토글하여 50% 듀티 440Hz 구형파 직접 출력',
    timer: 'timer1',
    mode: 'ctc',
    prescaler: 8,
    ocrValue: 2272, // 16MHz / (2 * 8 * (2272 + 1)) ≈ 440.01 Hz
    preloadValue: 0,
    pwmDutyPct: 50,
    fcpu: 16000000
  },
  {
    name: '1kHz 모터 PWM 제어 (Fast PWM)',
    tag: 'PWM 1kHz',
    desc: 'Timer1 Fast PWM 모드로 1kHz 구형파 출력 및 듀티비 가변 속도 제어',
    timer: 'timer1',
    mode: 'fast_pwm',
    prescaler: 8,
    ocrValue: 1999, // TOP = 1999 => 16M / (8 * 2000) = 1000 Hz
    preloadValue: 0,
    pwmDutyPct: 50,
    fcpu: 16000000
  },
  {
    name: '31.25kHz 고주파 무소음 PWM',
    tag: 'Phase Correct',
    desc: 'Timer2 위상 보정 PWM 8비트 모드(TOP=255, N=1)로 가청 대역 노이즈 없는 모터 구동',
    timer: 'timer2',
    mode: 'phase_correct_pwm',
    prescaler: 1,
    ocrValue: 128, // 16M / (2 * 1 * 255) ≈ 31,372 Hz
    preloadValue: 0,
    pwmDutyPct: 50,
    fcpu: 16000000
  },
  {
    name: 'Normal 모드 1초 오버플로우 (16-Bit)',
    tag: '1s Overflow',
    desc: 'Timer1 16비트 Normal 모드(N=256)에서 프리로드 3036을 설정하여 정확히 1초마다 오버플로우',
    timer: 'timer1',
    mode: 'normal',
    prescaler: 256,
    ocrValue: 0,
    preloadValue: 3036, // 65536 - (16000000 / 256 * 1) = 65536 - 62500 = 3036
    pwmDutyPct: 50,
    fcpu: 16000000
  }
];

export const TimerCounterSimulator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Available timers for current MCU
  const availableTimers = useMemo<TimerUnit[]>(() => {
    if (selectedMCU === 'atmega640') {
      return ['timer0', 'timer1', 'timer2', 'timer3', 'timer4', 'timer5'];
    } else if (selectedMCU === 'atmega128') {
      return ['timer0', 'timer1', 'timer2', 'timer3'];
    } else {
      // atmega328p
      return ['timer0', 'timer1', 'timer2'];
    }
  }, [selectedMCU]);

  // Main Controls State
  const [selectedTimer, setSelectedTimer] = useState<TimerUnit>('timer0');
  const [timerMode, setTimerMode] = useState<TimerMode>('ctc');
  const [fcpuHz, setFcpuHz] = useState<number>(16000000);
  const [prescaler, setPrescaler] = useState<number>(64);
  const [ocrValue, setOcrValue] = useState<number>(249);
  const [preloadValue, setPreloadValue] = useState<number>(0);
  const [pwmDutyPct, setPwmDutyPct] = useState<number>(50);
  const [pinAction, setPinAction] = useState<'none' | 'toggle' | 'clear' | 'set'>('toggle');
  const [enableInterrupt, setEnableInterrupt] = useState<boolean>(true);
  const [isAsyncTimer2, setIsAsyncTimer2] = useState<boolean>(false); // 32.768kHz RTC mode for Timer2

  // Interactive Waveform Simulator
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [counterPos, setCounterPos] = useState<number>(0);
  const [ovfFlash, setOvfFlash] = useState<boolean>(false);
  const [matchFlash, setMatchFlash] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Validate selected timer when MCU changes
  useEffect(() => {
    if (!availableTimers.includes(selectedTimer)) {
      setSelectedTimer('timer0');
    }
  }, [availableTimers, selectedTimer]);

  // Determine if selected timer is 16-bit or 8-bit
  const is16Bit = useMemo(() => {
    return ['timer1', 'timer3', 'timer4', 'timer5'].includes(selectedTimer);
  }, [selectedTimer]);

  const maxCounterValue = is16Bit ? 65535 : 255;
  const timerBitResolution = is16Bit ? 16 : 8;

  // Prescalers list based on timer unit
  const prescalerOptions = useMemo(() => {
    if (selectedTimer === 'timer2') {
      return TIMER2_PRESCALERS;
    }
    return STANDARD_PRESCALERS;
  }, [selectedTimer]);

  // Active Clock Frequency (considering Async Timer2 mode)
  const effectiveFcpu = useMemo(() => {
    if (selectedTimer === 'timer2' && isAsyncTimer2) {
      return 32768; // 32.768 kHz RTC crystal
    }
    return fcpuHz;
  }, [selectedTimer, isAsyncTimer2, fcpuHz]);

  // Calculations: Real-time Clock, Tick period, Overflow, CTC frequency, PWM frequency
  const timingCalc = useMemo(() => {
    const isClockStopped = prescaler <= 0;
    const actualN = isClockStopped ? 1 : prescaler;

    // Timer Tick Frequency & Duration
    const timerClkHz = isClockStopped ? 0 : effectiveFcpu / actualN;
    const tickTimeUs = timerClkHz > 0 ? (1 / timerClkHz) * 1000000 : 0;
    const tickTimeNs = tickTimeUs * 1000;

    // Normal Mode:
    // Overflow occurs when counter reaches max (256 or 65536) starting from preload
    const countsToOvf = Math.max(1, (maxCounterValue + 1) - preloadValue);
    const normalOvfPeriodUs = countsToOvf * tickTimeUs;
    const normalOvfFreqHz = normalOvfPeriodUs > 0 ? (1000000 / normalOvfPeriodUs) : 0;

    // CTC Mode:
    // Clear on Compare Match: counts from 0 to OCRValue (OCRValue + 1 ticks)
    const validOcr = Math.min(Math.max(0, ocrValue), maxCounterValue);
    const ctcMatchPeriodUs = (validOcr + 1) * tickTimeUs;
    const ctcInterruptFreqHz = ctcMatchPeriodUs > 0 ? (1000000 / ctcMatchPeriodUs) : 0;
    // If pin toggle is active, output square wave is half the interrupt freq
    const ctcToggleFreqHz = ctcInterruptFreqHz / 2;

    // Fast PWM Mode:
    // TOP can be fixed (255 / 65535) or variable (OCRValue)
    const fastPwmTop = is16Bit && validOcr > 0 ? validOcr : maxCounterValue;
    const fastPwmPeriodUs = (fastPwmTop + 1) * tickTimeUs;
    const fastPwmFreqHz = fastPwmPeriodUs > 0 ? (1000000 / fastPwmPeriodUs) : 0;
    const fastPwmHighUs = (pwmDutyPct / 100) * fastPwmPeriodUs;
    const fastPwmOcrTicks = Math.round((pwmDutyPct / 100) * fastPwmTop);

    // Phase Correct PWM Mode (Dual slope):
    // Counts 0 -> TOP -> 0 (Total 2 * TOP ticks)
    const phaseTop = is16Bit && validOcr > 0 ? validOcr : maxCounterValue;
    const phasePeriodUs = (2 * phaseTop) * tickTimeUs;
    const phaseFreqHz = phasePeriodUs > 0 ? (1000000 / phasePeriodUs) : 0;
    const phaseHighUs = (pwmDutyPct / 100) * phasePeriodUs;
    const phaseOcrTicks = Math.round((pwmDutyPct / 100) * phaseTop);

    // Active event periods depending on selected mode
    let activeFreqHz = 0;
    let activePeriodUs = 0;
    let activeEventName = '';

    if (timerMode === 'normal') {
      activeFreqHz = normalOvfFreqHz;
      activePeriodUs = normalOvfPeriodUs;
      activeEventName = '오버플로우 (TOV 발생 주기)';
    } else if (timerMode === 'ctc') {
      activeFreqHz = pinAction === 'toggle' ? ctcToggleFreqHz : ctcInterruptFreqHz;
      activePeriodUs = pinAction === 'toggle' ? ctcMatchPeriodUs * 2 : ctcMatchPeriodUs;
      activeEventName = pinAction === 'toggle' ? 'OCnA 핀 토글 주파수' : '비교 일치(OCF) 인터럽트 주기';
    } else if (timerMode === 'fast_pwm') {
      activeFreqHz = fastPwmFreqHz;
      activePeriodUs = fastPwmPeriodUs;
      activeEventName = 'Fast PWM 출력 주파수';
    } else {
      activeFreqHz = phaseFreqHz;
      activePeriodUs = phasePeriodUs;
      activeEventName = 'Phase Correct PWM 출력 주파수';
    }

    return {
      isClockStopped,
      actualN,
      timerClkHz,
      tickTimeUs,
      tickTimeNs,
      countsToOvf,
      normalOvfPeriodUs,
      normalOvfFreqHz,
      validOcr,
      ctcMatchPeriodUs,
      ctcInterruptFreqHz,
      ctcToggleFreqHz,
      fastPwmTop,
      fastPwmPeriodUs,
      fastPwmFreqHz,
      fastPwmHighUs,
      fastPwmOcrTicks,
      phaseTop,
      phasePeriodUs,
      phaseFreqHz,
      phaseHighUs,
      phaseOcrTicks,
      activeFreqHz,
      activePeriodUs,
      activeEventName
    };
  }, [
    effectiveFcpu,
    prescaler,
    timerMode,
    maxCounterValue,
    preloadValue,
    ocrValue,
    is16Bit,
    pwmDutyPct,
    pinAction
  ]);

  // Format Helper for Human Readable Time
  const formatTime = (timeUs: number) => {
    if (timeUs <= 0) return '0 s';
    if (timeUs < 1) return `${(timeUs * 1000).toFixed(2)} ns`;
    if (timeUs < 1000) return `${timeUs.toFixed(2)} µs`;
    if (timeUs < 1000000) return `${(timeUs / 1000).toFixed(3)} ms`;
    return `${(timeUs / 1000000).toFixed(4)} s`;
  };

  // Format Helper for Frequency
  const formatFreq = (freqHz: number) => {
    if (freqHz <= 0) return '0 Hz';
    if (freqHz >= 1000000) return `${(freqHz / 1000000).toFixed(3)} MHz`;
    if (freqHz >= 1000) return `${(freqHz / 1000).toFixed(2)} kHz`;
    return `${freqHz.toFixed(2)} Hz`;
  };

  // Auto-Generate TCCR Register Values
  const registerGen = useMemo(() => {
    // Find CS bits
    const selectedPrescalerObj = prescalerOptions.find((p) => p.value === prescaler);
    const csBits = selectedPrescalerObj ? selectedPrescalerObj.csBits : 0b001;

    // Channel names & prefixes
    let timerNum = '0';
    if (selectedTimer === 'timer1') timerNum = '1';
    else if (selectedTimer === 'timer2') timerNum = '2';
    else if (selectedTimer === 'timer3') timerNum = '3';
    else if (selectedTimer === 'timer4') timerNum = '4';
    else if (selectedTimer === 'timer5') timerNum = '5';

    // Microcontroller Architecture Differentiation:
    // ATmega128 has legacy TCCR0 and TCCR2 single 8-bit registers, whereas ATmega328P/640 have TCCR0A/TCCR0B and TCCR2A/TCCR2B
    const isMega128Legacy8Bit = selectedMCU === 'atmega128' && (selectedTimer === 'timer0' || selectedTimer === 'timer2');

    let tccrA_val = 0;
    let tccrB_val = 0;
    let tccrC_val = 0;
    let timsk_val = 0;
    let assr_val = 0;

    let tccrA_name = `TCCR${timerNum}A`;
    let tccrB_name = `TCCR${timerNum}B`;
    let timsk_name = `TIMSK${timerNum}`;

    const regExplanation: { reg: string; valueHex: string; valueBin: string; bits: string[]; role: string }[] = [];

    if (isMega128Legacy8Bit) {
      // ATmega128 Timer0 / Timer2 Legacy 8-bit
      const regName = `TCCR${timerNum}`;
      tccrA_name = regName;
      let wgm0 = 0;
      let wgm1 = 0;
      let com1 = 0;
      let com0 = 0;

      if (timerMode === 'normal') {
        wgm0 = 0;
        wgm1 = 0;
      } else if (timerMode === 'ctc') {
        wgm0 = 0;
        wgm1 = 1; // CTC mode
        if (pinAction === 'toggle') {
          com0 = 1;
          com1 = 0;
        } else if (pinAction === 'clear') {
          com0 = 0;
          com1 = 1;
        } else if (pinAction === 'set') {
          com0 = 1;
          com1 = 1;
        }
      } else if (timerMode === 'fast_pwm') {
        wgm0 = 1;
        wgm1 = 1; // Fast PWM
        com1 = 1; // Non-inverting
        com0 = 0;
      } else {
        // Phase correct
        wgm0 = 1;
        wgm1 = 0;
        com1 = 1;
        com0 = 0;
      }

      // Bit layout: [FOC, WGM0, COM1, COM0, WGM1, CS2, CS1, CS0]
      tccrA_val = (wgm0 << 6) | (com1 << 5) | (com0 << 4) | (wgm1 << 3) | csBits;
      timsk_name = 'TIMSK';

      if (enableInterrupt) {
        if (timerMode === 'normal') {
          timsk_val = selectedTimer === 'timer0' ? (1 << 0) : (1 << 6); // TOIE0 or TOIE2
        } else {
          timsk_val = selectedTimer === 'timer0' ? (1 << 1) : (1 << 7); // OCIE0 or OCIE2
        }
      }

      regExplanation.push({
        reg: regName,
        valueHex: `0x${tccrA_val.toString(16).padStart(2, '0').toUpperCase()}`,
        valueBin: `0b${tccrA_val.toString(2).padStart(8, '0')}`,
        bits: [
          `FOC=${0}`,
          `WGM${timerNum}0=${wgm0}`,
          `COM${timerNum}1=${com1}`,
          `COM${timerNum}0=${com0}`,
          `WGM${timerNum}1=${wgm1}`,
          `CS${timerNum}2=${(csBits >> 2) & 1}`,
          `CS${timerNum}1=${(csBits >> 1) & 1}`,
          `CS${timerNum}0=${csBits & 1}`
        ],
        role: `모드(WGM=${wgm1}${wgm0}) 및 프리스케일러(CS=${csBits}) 단일 제어 레지스터`
      });

    } else if (!is16Bit) {
      // 8-bit Timer (Timer0 or Timer2 on ATmega328P/640)
      let wgm0 = 0;
      let wgm1 = 0;
      let wgm2 = 0;
      let comA1 = 0;
      let comA0 = 0;

      if (timerMode === 'normal') {
        wgm0 = 0;
        wgm1 = 0;
        wgm2 = 0;
      } else if (timerMode === 'ctc') {
        wgm0 = 0;
        wgm1 = 1;
        wgm2 = 0; // Mode 2: CTC (TOP = OCRnA)
        if (pinAction === 'toggle') {
          comA0 = 1;
          comA1 = 0;
        } else if (pinAction === 'clear') {
          comA0 = 0;
          comA1 = 1;
        } else if (pinAction === 'set') {
          comA0 = 1;
          comA1 = 1;
        }
      } else if (timerMode === 'fast_pwm') {
        wgm0 = 1;
        wgm1 = 1;
        wgm2 = 0; // Mode 3: Fast PWM (TOP = 0xFF)
        comA1 = 1;
        comA0 = 0; // Clear on compare match (Non-inverting)
      } else {
        // Phase Correct PWM
        wgm0 = 1;
        wgm1 = 0;
        wgm2 = 0; // Mode 1: Phase Correct PWM (TOP = 0xFF)
        comA1 = 1;
        comA0 = 0;
      }

      tccrA_val = (comA1 << 7) | (comA0 << 6) | (wgm1 << 1) | wgm0;
      tccrB_val = (wgm2 << 3) | csBits;

      if (enableInterrupt) {
        timsk_val = timerMode === 'normal' ? (1 << 0) : (1 << 1); // TOIE or OCIEA
      }

      if (selectedTimer === 'timer2' && isAsyncTimer2) {
        assr_val = (1 << 5); // AS2 bit
      }

      regExplanation.push({
        reg: tccrA_name,
        valueHex: `0x${tccrA_val.toString(16).padStart(2, '0').toUpperCase()}`,
        valueBin: `0b${tccrA_val.toString(2).padStart(8, '0')}`,
        bits: [
          `COM${timerNum}A1=${comA1}`,
          `COM${timerNum}A0=${comA0}`,
          `COM${timerNum}B1=0`,
          `COM${timerNum}B0=0`,
          `WGM${timerNum}1=${wgm1}`,
          `WGM${timerNum}0=${wgm0}`
        ],
        role: `출력 비교 모드(COM${timerNum}A) 및 파형 생성 하위 비트(WGM${timerNum}1:0)`
      });

      regExplanation.push({
        reg: tccrB_name,
        valueHex: `0x${tccrB_val.toString(16).padStart(2, '0').toUpperCase()}`,
        valueBin: `0b${tccrB_val.toString(2).padStart(8, '0')}`,
        bits: [
          `FOC${timerNum}A=0`,
          `FOC${timerNum}B=0`,
          `WGM${timerNum}2=${wgm2}`,
          `CS${timerNum}2=${(csBits >> 2) & 1}`,
          `CS${timerNum}1=${(csBits >> 1) & 1}`,
          `CS${timerNum}0=${csBits & 1}`
        ],
        role: `클럭 선택 분주비(CS${timerNum}2:0) 및 파형 상위 비트(WGM${timerNum}2)`
      });

    } else {
      // 16-bit Timer (Timer1, Timer3, Timer4, Timer5)
      let wgm0 = 0;
      let wgm1 = 0;
      let wgm2 = 0;
      let wgm3 = 0;
      let comA1 = 0;
      let comA0 = 0;

      if (timerMode === 'normal') {
        // Mode 0: Normal (TOP = 0xFFFF)
        wgm0 = 0;
        wgm1 = 0;
        wgm2 = 0;
        wgm3 = 0;
      } else if (timerMode === 'ctc') {
        // Mode 4: CTC (TOP = OCRnA)
        wgm0 = 0;
        wgm1 = 0;
        wgm2 = 1;
        wgm3 = 0;
        if (pinAction === 'toggle') {
          comA0 = 1;
          comA1 = 0;
        } else if (pinAction === 'clear') {
          comA0 = 0;
          comA1 = 1;
        } else if (pinAction === 'set') {
          comA0 = 1;
          comA1 = 1;
        }
      } else if (timerMode === 'fast_pwm') {
        // Mode 14: Fast PWM (TOP = ICRn) or Mode 15 (TOP = OCRnA)
        wgm0 = 0;
        wgm1 = 1;
        wgm2 = 1;
        wgm3 = 1; // Mode 14: Fast PWM (TOP = ICRn)
        comA1 = 1;
        comA0 = 0; // Non-inverting
      } else {
        // Mode 8: Phase & Frequency Correct (TOP = ICRn) or Mode 10: Phase Correct (TOP = ICRn)
        wgm0 = 0;
        wgm1 = 1;
        wgm2 = 0;
        wgm3 = 1; // Mode 10: Phase Correct PWM (TOP = ICRn)
        comA1 = 1;
        comA0 = 0;
      }

      tccrA_val = (comA1 << 7) | (comA0 << 6) | (wgm1 << 1) | wgm0;
      tccrB_val = (wgm3 << 4) | (wgm2 << 3) | csBits;

      if (selectedMCU === 'atmega128') {
        timsk_name = selectedTimer === 'timer1' ? 'TIMSK' : 'ETIMSK';
        timsk_val = timerMode === 'normal' ? (1 << 2) : (1 << 4); // TOIE1 or OCIE1A
      } else {
        timsk_name = `TIMSK${timerNum}`;
        timsk_val = timerMode === 'normal' ? (1 << 0) : (1 << 1); // TOIE or OCIEA
      }

      regExplanation.push({
        reg: tccrA_name,
        valueHex: `0x${tccrA_val.toString(16).padStart(2, '0').toUpperCase()}`,
        valueBin: `0b${tccrA_val.toString(2).padStart(8, '0')}`,
        bits: [
          `COM${timerNum}A1=${comA1}`,
          `COM${timerNum}A0=${comA0}`,
          `COM${timerNum}B1=0`,
          `COM${timerNum}B0=0`,
          `WGM${timerNum}1=${wgm1}`,
          `WGM${timerNum}0=${wgm0}`
        ],
        role: `비교 출력 제어 및 16비트 파형 하위 비트(WGM${timerNum}1:0)`
      });

      regExplanation.push({
        reg: tccrB_name,
        valueHex: `0x${tccrB_val.toString(16).padStart(2, '0').toUpperCase()}`,
        valueBin: `0b${tccrB_val.toString(2).padStart(8, '0')}`,
        bits: [
          `ICNC${timerNum}=0`,
          `ICES${timerNum}=0`,
          `WGM${timerNum}3=${wgm3}`,
          `WGM${timerNum}2=${wgm2}`,
          `CS${timerNum}2=${(csBits >> 2) & 1}`,
          `CS${timerNum}1=${(csBits >> 1) & 1}`,
          `CS${timerNum}0=${csBits & 1}`
        ],
        role: `16비트 파형 상위 비트(WGM${timerNum}3:2) 및 프리스케일러(CS${timerNum}2:0)`
      });
    }

    if (enableInterrupt) {
      regExplanation.push({
        reg: timsk_name,
        valueHex: `0x${timsk_val.toString(16).padStart(2, '0').toUpperCase()}`,
        valueBin: `0b${timsk_val.toString(2).padStart(8, '0')}`,
        bits: [
          timerMode === 'normal' ? `TOIE${timerNum}=1` : `OCIE${timerNum}A=1`
        ],
        role: `타이머 인터럽트 마스크 레지스터 (글로벌 sei() 활성화 필수)`
      });
    }

    if (selectedTimer === 'timer2' && isAsyncTimer2) {
      regExplanation.push({
        reg: 'ASSR',
        valueHex: `0x${assr_val.toString(16).padStart(2, '0').toUpperCase()}`,
        valueBin: `0b${assr_val.toString(2).padStart(8, '0')}`,
        bits: ['AS2=1 (TOSC1/2 32.768kHz 발진기 비동기 클럭 활성화)'],
        role: '비동기 상태 레지스터 (저전력 RTC 실시간 시계 구현)'
      });
    }

    return {
      tccrA_name,
      tccrA_val,
      tccrB_name,
      tccrB_val,
      tccrC_val,
      timsk_name,
      timsk_val,
      assr_val,
      regExplanation
    };
  }, [
    selectedMCU,
    selectedTimer,
    timerMode,
    prescaler,
    prescalerOptions,
    pinAction,
    enableInterrupt,
    isAsyncTimer2,
    is16Bit
  ]);

  // Generate C Code Snippet
  const generatedCCode = useMemo(() => {
    let timerNum = '0';
    if (selectedTimer === 'timer1') timerNum = '1';
    else if (selectedTimer === 'timer2') timerNum = '2';
    else if (selectedTimer === 'timer3') timerNum = '3';
    else if (selectedTimer === 'timer4') timerNum = '4';
    else if (selectedTimer === 'timer5') timerNum = '5';

    const isMega128Legacy8Bit = selectedMCU === 'atmega128' && (selectedTimer === 'timer0' || selectedTimer === 'timer2');
    const isrVector = timerMode === 'normal' ? `TIMER${timerNum}_OVF_vect` : `TIMER${timerNum}_COMPA_vect`;

    const codeLines: string[] = [];
    codeLines.push(`/**`);
    codeLines.push(` * @file   timer${timerNum}_config.c`);
    codeLines.push(` * @target ${currentProfile.name} (${selectedMCU.toUpperCase()})`);
    codeLines.push(` * @clock  ${effectiveFcpu.toLocaleString()} Hz (${(effectiveFcpu / 1000000).toFixed(2)} MHz)`);
    codeLines.push(` * @mode   ${timerMode.toUpperCase()} Mode (${is16Bit ? '16-Bit' : '8-Bit'})`);
    codeLines.push(` * @rate   주기: ${formatTime(timingCalc.activePeriodUs)} | 주파수: ${formatFreq(timingCalc.activeFreqHz)}`);
    codeLines.push(` */`);
    codeLines.push(``);
    codeLines.push(`#include <avr/io.h>`);
    codeLines.push(`#include <avr/interrupt.h>`);
    codeLines.push(``);

    if (timerMode === 'normal') {
      codeLines.push(`// 초기 프리로드 값 (TCNT${timerNum} 오버플로우 주기 보정용)`);
      codeLines.push(`#define TCNT${timerNum}_PRELOAD  ${preloadValue}`);
      codeLines.push(``);
    }

    codeLines.push(`void timer${timerNum}_init(void) {`);
    codeLines.push(`    cli(); // 전역 인터럽트 임시 비활성화`);
    codeLines.push(``);

    if (selectedTimer === 'timer2' && isAsyncTimer2) {
      codeLines.push(`    // Timer2 비동기 RTC 32.768kHz 크리스털 모드 설정`);
      codeLines.push(`    ASSR |= (1 << AS2);`);
      codeLines.push(``);
    }

    if (isMega128Legacy8Bit) {
      codeLines.push(`    // 레거시 ATmega128 Timer${timerNum} 단일 제어 레지스터 설정`);
      codeLines.push(`    TCCR${timerNum} = 0x${registerGen.tccrA_val.toString(16).padStart(2, '0').toUpperCase()};`);
    } else {
      codeLines.push(`    // TCCR${timerNum}A 설정: 비교 출력 모드 및 파형 제어`);
      codeLines.push(`    ${registerGen.tccrA_name} = 0x${registerGen.tccrA_val.toString(16).padStart(2, '0').toUpperCase()};`);
      codeLines.push(`    // TCCR${timerNum}B 설정: 파형 생성 상위 비트 및 분주비 (CS = ${prescaler})`);
      codeLines.push(`    ${registerGen.tccrB_name} = 0x${registerGen.tccrB_val.toString(16).padStart(2, '0').toUpperCase()};`);
    }

    if (timerMode === 'normal') {
      codeLines.push(`    TCNT${timerNum} = TCNT${timerNum}_PRELOAD; // 초기 카운터 값 적재`);
    } else if (timerMode === 'ctc') {
      codeLines.push(`    OCR${timerNum}A = ${timingCalc.validOcr}; // 비교 일치 기준값 TOP 설정`);
      if (pinAction === 'toggle') {
        codeLines.push(`    // 주의: OC${timerNum}A 핀을 출력(OUTPUT)으로 설정해야 하드웨어 토글 펄스가 외부로 방출됩니다.`);
        codeLines.push(`    // DDRB |= (1 << PB...);`);
      }
    } else if (timerMode === 'fast_pwm' || timerMode === 'phase_correct_pwm') {
      if (is16Bit) {
        codeLines.push(`    ICR${timerNum} = ${timingCalc.fastPwmTop}; // 16비트 PWM 주파수 결정 TOP 값`);
        codeLines.push(`    OCR${timerNum}A = ${timingCalc.fastPwmOcrTicks}; // 듀티비(${pwmDutyPct}%) 비교 일치값`);
      } else {
        codeLines.push(`    OCR${timerNum}A = ${timingCalc.fastPwmOcrTicks}; // 듀티비(${pwmDutyPct}%) 비교 일치값`);
      }
      codeLines.push(`    // PWM 출력 핀(OC${timerNum}A) 출력 방향 활성화 필수`);
      codeLines.push(`    // DDRx |= (1 << OC${timerNum}A_PIN);`);
    }

    if (enableInterrupt) {
      codeLines.push(``);
      codeLines.push(`    // 인터럽트 마스크 활성화`);
      codeLines.push(`    ${registerGen.timsk_name} |= 0x${registerGen.timsk_val.toString(16).padStart(2, '0').toUpperCase()};`);
      codeLines.push(`    sei(); // 전역 인터럽트 활성화`);
    }

    codeLines.push(`}`);
    codeLines.push(``);

    if (enableInterrupt) {
      codeLines.push(`/**`);
      codeLines.push(` * @brief 인터럽트 서비스 루틴 (ISR)`);
      codeLines.push(` * 주기: ${formatTime(timingCalc.activePeriodUs)}`);
      codeLines.push(` */`);
      codeLines.push(`ISR(${isrVector}) {`);
      if (timerMode === 'normal' && preloadValue > 0) {
        codeLines.push(`    // Normal 모드는 0부터 다시 카운트하므로 주기 유지를 위해 프리로드를 재장전합니다.`);
        codeLines.push(`    TCNT${timerNum} = TCNT${timerNum}_PRELOAD;`);
      }
      codeLines.push(`    // 사용자 비즈니스 로직 작성 (예: LED 토글, 센서 샘플링)`);
      codeLines.push(`    // PORTB ^= (1 << PB5);`);
      codeLines.push(`}`);
    }

    return codeLines.join('\n');
  }, [
    selectedMCU,
    selectedTimer,
    currentProfile,
    effectiveFcpu,
    timerMode,
    is16Bit,
    timingCalc,
    preloadValue,
    pinAction,
    pwmDutyPct,
    enableInterrupt,
    isAsyncTimer2,
    registerGen,
    prescaler
  ]);

  // Animation Loop for Counter Waveform
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (isPlaying) {
        // Increment normalized counter pos (0 to 1)
        const rate = 0.5 * simSpeed;
        setCounterPos((prev) => {
          let next = prev + dt * rate;
          if (next >= 1) {
            next = 0;
            // Flash overflow / match event
            setOvfFlash(true);
            setTimeout(() => setOvfFlash(false), 80);
          }
          return next;
        });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, simSpeed]);

  // Handle Preset Load
  const handleApplyPreset = (preset: QuickPreset) => {
    if (availableTimers.includes(preset.timer)) {
      setSelectedTimer(preset.timer);
    }
    setTimerMode(preset.mode);
    setFcpuHz(preset.fcpu);
    setPrescaler(preset.prescaler);
    setOcrValue(preset.ocrValue);
    setPreloadValue(preset.preloadValue);
    setPwmDutyPct(preset.pwmDutyPct);
    setPinAction('toggle');
    setEnableInterrupt(true);

    confetti({
      particleCount: 30,
      spread: 60,
      origin: { y: 0.7 }
    });
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedCCode);
      setCopiedCode(true);
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 }
      });
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleDownloadCode = () => {
    const blob = new Blob([generatedCCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timer_${selectedTimer}_${timerMode}.c`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-7 shadow-2xl backdrop-blur">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-400 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" /> 타이머/카운터 엔진 (Timer/Counter Engine)
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              {is16Bit ? '16-Bit Resolution (MAX 65,535)' : '8-Bit Resolution (MAX 255)'}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-violet-950/60 text-violet-300 border border-violet-800/40 text-xs font-mono font-bold">
              {currentProfile.name}
            </span>
            {selectedTimer === 'timer2' && (
              <span className="px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-800/40 text-[11px] font-mono">
                TOSC1/2 비동기 RTC 지원
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            AVR 타이머/카운터 설정 시뮬레이터 & TCCR 레지스터 빌더
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Normal, CTC, Fast PWM, Phase Correct PWM 모드 및 분주비(Prescaler)를 인터랙티브하게 설정하여 실시간 클럭 주파수와 오버플로우 주기(Overflow Period)를 즉시 시각화하고, AVR-GCC용 TCCR/TIMSK 레지스터 마스크와 최적의 인터럽트 ISR 템플릿을 자동 생성합니다.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyCode}
            className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/20 flex items-center gap-1.5"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? '복사 완료!' : 'C 소스 복사'}</span>
          </button>
          <button
            onClick={handleDownloadCode}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.c 다운로드</span>
          </button>
        </div>
      </div>

      {/* Quick Presets Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>자주 사용하는 타이머 설정 프리셋 (Quick Presets):</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handleApplyPreset(preset)}
              className="p-2.5 rounded-2xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-violet-500/50 text-left transition group"
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800/40">
                  {preset.tag}
                </span>
                <span className="text-[9px] text-slate-500 uppercase">{preset.timer}</span>
              </div>
              <p className="text-xs font-bold text-slate-200 group-hover:text-violet-300 truncate">
                {preset.name}
              </p>
              <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                {preset.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Main Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Timer & Mode Selection Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-5 bg-slate-950/50 p-5 rounded-2xl border border-slate-800/80">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-violet-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              타이머 모드 및 파라미터 입력 (Configuration)
            </h4>
          </div>

          {/* 1. Timer Unit Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>타이머 유닛 선택 (Timer Unit)</span>
              <span className="text-[10px] font-mono text-violet-400">
                {is16Bit ? '16비트 (0 ~ 65535)' : '8비트 (0 ~ 255)'}
              </span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {availableTimers.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTimer(t)}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border transition flex flex-col items-center justify-center gap-0.5 ${
                    selectedTimer === t
                      ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-600/30'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span className="capitalize">{t}</span>
                  <span className="text-[9px] font-mono opacity-80">
                    {['timer1', 'timer3', 'timer4', 'timer5'].includes(t) ? '16-bit' : '8-bit'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Timer Operating Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              동작 모드 (Operating Mode)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'normal', name: 'Normal 모드', sub: '오버플로우 (TOP=MAX, TOV 인터럽트)' },
                { id: 'ctc', name: 'CTC 모드', sub: '비교 일치 리셋 (TOP=OCRnA, 정밀 주기)' },
                { id: 'fast_pwm', name: 'Fast PWM 모드', sub: '단일 슬로프 고속 구형파 출력' },
                { id: 'phase_correct_pwm', name: 'Phase Correct PWM', sub: '듀얼 슬로프 위상 보정 저노이즈' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setTimerMode(m.id as TimerMode)}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    timerMode === m.id
                      ? 'bg-violet-950/70 border-violet-500 text-white shadow-sm'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>{m.name}</span>
                    {timerMode === m.id && <Check className="w-3 h-3 text-violet-400" />}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                    {m.sub}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 3. System Clock Frequency */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">MCU 시스템 클럭 (f_clk)</span>
              <span className="font-mono text-cyan-400">
                {(effectiveFcpu / 1000000).toFixed(effectiveFcpu >= 1000000 ? 2 : 4)} MHz
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: '16 MHz', hz: 16000000 },
                { label: '8 MHz', hz: 8000000 },
                { label: '1 MHz', hz: 1000000 },
                { label: '20 MHz', hz: 20000000 }
              ].map((clk) => (
                <button
                  key={clk.hz}
                  onClick={() => setFcpuHz(clk.hz)}
                  className={`py-1.5 px-2 text-xs font-mono rounded-lg border transition ${
                    fcpuHz === clk.hz && (!isAsyncTimer2 || selectedTimer !== 'timer2')
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-700 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {clk.label}
                </button>
              ))}
            </div>
            {selectedTimer === 'timer2' && (
              <label className="flex items-center gap-2 mt-1.5 cursor-pointer text-xs text-amber-300 bg-amber-950/40 p-2 rounded-xl border border-amber-800/40">
                <input
                  type="checkbox"
                  checked={isAsyncTimer2}
                  onChange={(e) => setIsAsyncTimer2(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                />
                <span>TOSC1/2 32.768 kHz 비동기 크리스털 클럭 사용 (RTC 실시간 시계)</span>
              </label>
            )}
          </div>

          {/* 4. Prescaler Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">분주비 선택 (Prescaler N)</span>
              <span className="font-mono text-violet-400 font-bold">
                N = {prescaler > 0 ? prescaler : 'STOPPED'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {prescalerOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPrescaler(opt.value)}
                  className={`py-1.5 px-2 text-xs font-mono rounded-lg border transition text-center ${
                    prescaler === opt.value
                      ? 'bg-violet-600 text-white border-violet-500 font-bold shadow'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={opt.description}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Dynamic Mode Specific Inputs */}
          {timerMode === 'normal' && (
            <div className="space-y-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">TCNT 프리로드 값 (Preload)</span>
                <span className="font-mono text-amber-400 font-bold">
                  {preloadValue} / {maxCounterValue}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={maxCounterValue}
                value={preloadValue}
                onChange={(e) => setPreloadValue(parseInt(e.target.value) || 0)}
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>0 (전체 오버플로우)</span>
                <span>카운트 횟수: {(maxCounterValue + 1) - preloadValue} ticks</span>
                <span>{maxCounterValue}</span>
              </div>
            </div>
          )}

          {timerMode === 'ctc' && (
            <div className="space-y-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">비교 일치 레지스터 (OCRnA TOP)</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <input
                    type="number"
                    min="0"
                    max={maxCounterValue}
                    value={ocrValue}
                    onChange={(e) => setOcrValue(Math.min(maxCounterValue, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-24 px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-right text-emerald-400 text-xs font-bold"
                  />
                  <span className="text-slate-500 text-[10px]">/ {maxCounterValue}</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max={maxCounterValue}
                value={ocrValue}
                onChange={(e) => setOcrValue(parseInt(e.target.value) || 0)}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />

              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-medium text-slate-400">하드웨어 OCnA 출력 핀 동작:</label>
                <div className="grid grid-cols-4 gap-1 text-[11px]">
                  {[
                    { id: 'none', label: '차단 (None)' },
                    { id: 'toggle', label: '반전 (Toggle)' },
                    { id: 'clear', label: '0 클리어' },
                    { id: 'set', label: '1 세트' }
                  ].map((act) => (
                    <button
                      key={act.id}
                      onClick={() => setPinAction(act.id as any)}
                      className={`py-1 rounded border transition font-mono ${
                        pinAction === act.id
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-600 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(timerMode === 'fast_pwm' || timerMode === 'phase_correct_pwm') && (
            <div className="space-y-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">PWM 듀티비 (Duty Cycle)</span>
                <span className="font-mono text-cyan-400 font-bold">{pwmDutyPct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={pwmDutyPct}
                onChange={(e) => setPwmDutyPct(parseInt(e.target.value) || 0)}
                className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />

              {is16Bit && (
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">16비트 주파수 결정 TOP 값 (ICRn)</span>
                    <input
                      type="number"
                      min="1"
                      max={65535}
                      value={ocrValue}
                      onChange={(e) => setOcrValue(Math.min(65535, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-24 px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-right text-cyan-400 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Interrupt Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
            <input
              type="checkbox"
              checked={enableInterrupt}
              onChange={(e) => setEnableInterrupt(e.target.checked)}
              className="rounded text-violet-600 focus:ring-violet-500 w-3.5 h-3.5"
            />
            <span>인터럽트(TIMSK 활성화 및 ISR 코드 템플릿 포함)</span>
          </label>
        </div>

        {/* Right Column: Live Math & Interactive Waveform & Registers (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Key Metrics Dashcards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block uppercase font-mono">타이머 클럭 (f_timer)</span>
              <span className="text-base font-bold text-violet-400 font-mono">
                {formatFreq(timingCalc.timerClkHz)}
              </span>
              <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                분주 후 타이머 주파수
              </span>
            </div>

            <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block uppercase font-mono">1 클럭 틱 주기 (T_tick)</span>
              <span className="text-base font-bold text-cyan-400 font-mono">
                {timingCalc.tickTimeNs < 1000
                  ? `${timingCalc.tickTimeNs.toFixed(1)} ns`
                  : `${timingCalc.tickTimeUs.toFixed(3)} µs`}
              </span>
              <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                카운터 1 증가당 시간
              </span>
            </div>

            <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block uppercase font-mono">
                {timerMode === 'normal' ? '오버플로우 주기' : '목표 주기 (Period)'}
              </span>
              <span className="text-base font-bold text-amber-400 font-mono">
                {formatTime(timingCalc.activePeriodUs)}
              </span>
              <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                {timingCalc.activeEventName}
              </span>
            </div>

            <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block uppercase font-mono">
                {timerMode === 'normal' ? '오버플로우 주파수' : '출력/인터럽트 주파수'}
              </span>
              <span className="text-base font-bold text-emerald-400 font-mono">
                {formatFreq(timingCalc.activeFreqHz)}
              </span>
              <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                초당 트리거 횟수
              </span>
            </div>
          </div>

          {/* Interactive Live Waveform Simulation Canvas */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Waves className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  실시간 타이머 카운터 및 출력 파형 시뮬레이션 (Live Waveform)
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                  ovfFlash ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {timerMode === 'normal' ? 'TOV0 OVF' : 'COMPA MATCH'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title={isPlaying ? '일시정지' : '재생'}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                  <span>속도:</span>
                  {[0.5, 1, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSimSpeed(s)}
                      className={`px-1.5 py-0.5 rounded ${
                        simSpeed === s ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SVG Waveform Rendering */}
            <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80">
              <svg viewBox="0 0 500 130" className="w-full h-32 select-none">
                {/* Grid Lines */}
                <line x1="40" y1="20" x2="480" y2="20" stroke="#334155" strokeDasharray="3 3" />
                <line x1="40" y1="55" x2="480" y2="55" stroke="#334155" strokeDasharray="3 3" />
                <line x1="40" y1="90" x2="480" y2="90" stroke="#334155" />
                <line x1="40" y1="120" x2="480" y2="120" stroke="#334155" />

                {/* Y-axis Labels */}
                <text x="5" y="24" fill="#94a3b8" fontSize="9" fontFamily="monospace">TOP</text>
                <text x="5" y="94" fill="#94a3b8" fontSize="9" fontFamily="monospace">0</text>
                <text x="5" y="118" fill="#38bdf8" fontSize="9" fontFamily="monospace">OCnA</text>

                {/* Ramp Waveform (Counter TCNT) based on mode */}
                {timerMode === 'phase_correct_pwm' ? (
                  // Triangle wave for Phase Correct
                  <polyline
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2.5"
                    points="
                      40,90 150,20 260,90 370,20 480,90
                    "
                  />
                ) : (
                  // Sawtooth wave for Normal, CTC, Fast PWM
                  <polyline
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2.5"
                    points="
                      40,90 180,20 180,90 320,20 320,90 460,20 460,90 480,80
                    "
                  />
                )}

                {/* Compare Match Threshold Line if CTC or PWM */}
                {(timerMode === 'ctc' || timerMode === 'fast_pwm' || timerMode === 'phase_correct_pwm') && (
                  <>
                    <line
                      x1="40"
                      y1={90 - (pwmDutyPct / 100) * 70}
                      x2="480"
                      y2={90 - (pwmDutyPct / 100) * 70}
                      stroke="#10b981"
                      strokeWidth="1.5"
                      strokeDasharray="4 2"
                    />
                    <text
                      x="410"
                      y={85 - (pwmDutyPct / 100) * 70}
                      fill="#10b981"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      OCRnA ({timerMode === 'ctc' ? timingCalc.validOcr : `${pwmDutyPct}%`})
                    </text>
                  </>
                )}

                {/* Simulated Digital Output Waveform on Pin OCnA */}
                {timerMode === 'normal' ? (
                  // Normal mode: flat or periodic spike on overflow
                  <path
                    d="M 40,120 L 180,120 L 180,105 L 184,105 L 184,120 L 320,120 L 320,105 L 324,105 L 324,120 L 460,120 L 460,105 L 464,105 L 464,120 L 480,120"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2"
                  />
                ) : timerMode === 'ctc' && pinAction === 'toggle' ? (
                  // 50% square wave (Toggle on compare match)
                  <path
                    d="M 40,120 L 180,120 L 180,105 L 320,105 L 320,120 L 460,120 L 460,105 L 480,105"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2"
                  />
                ) : (
                  // PWM pulse train (width reflects pwmDutyPct)
                  <path
                    d={`M 40,105 L ${40 + 140 * (pwmDutyPct / 100)},105 L ${40 + 140 * (pwmDutyPct / 100)},120 L 180,120 L 180,105 L ${180 + 140 * (pwmDutyPct / 100)},105 L ${180 + 140 * (pwmDutyPct / 100)},120 L 320,120 L 320,105 L ${320 + 140 * (pwmDutyPct / 100)},105 L ${320 + 140 * (pwmDutyPct / 100)},120 L 460,120 L 460,105 L 480,105`}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2"
                  />
                )}

                {/* Dynamic Cursor Indicator */}
                <line
                  x1={40 + counterPos * 420}
                  y1="10"
                  x2={40 + counterPos * 420}
                  y2="125"
                  stroke="#f43f5e"
                  strokeWidth="2"
                />
                <circle
                  cx={40 + counterPos * 420}
                  cy={15}
                  r="3.5"
                  fill="#f43f5e"
                />
              </svg>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-2 px-1">
                <span>BOTTOM (0x00)</span>
                <span>카운터 진행 방향: {timerMode === 'phase_correct_pwm' ? '0 -> TOP -> 0 (듀얼 슬로프)' : '0 -> TOP (단일 슬로프 업카운트)'}</span>
                <span>TOP ({is16Bit ? '0xFFFF' : '0xFF'})</span>
              </div>
            </div>
          </div>

          {/* Generated TCCR & TIMSK Registers Breakdown */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-emerald-400" />
                자동 산출된 AVR 하드웨어 제어 레지스터 (Calculated Registers)
              </span>
              <span className="text-[11px] font-mono text-emerald-400">
                8-Bit Binary & Hex Values
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {registerGen.regExplanation.map((reg, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 font-mono">{reg.reg}</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40">
                        {reg.valueHex}
                      </span>
                      <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                        {reg.valueBin}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {reg.bits.map((b, bIdx) => (
                      <span
                        key={bIdx}
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                          b.includes('=1')
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60 font-bold'
                            : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500">{reg.role}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Production C Code Viewer */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Code2 className="w-4 h-4 text-violet-400" />
            완성형 AVR-GCC 초기화 함수 & ISR 인터럽트 핸들러 템플릿
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="text-xs text-violet-400 hover:text-violet-300 font-mono flex items-center gap-1 transition"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? '복사됨!' : '코드 복사'}</span>
            </button>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-400">
            <span>timer{selectedTimer.replace('timer', '')}_config.c ({currentProfile.name})</span>
            <span>AVR-GCC / avr-libc 호환</span>
          </div>
          <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-80">
            <code>{generatedCCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
