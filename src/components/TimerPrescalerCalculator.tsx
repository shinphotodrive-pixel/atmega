import React, { useState, useMemo } from 'react';
import {
  Clock,
  Zap,
  Sliders,
  Copy,
  Check,
  Cpu,
  AlertTriangle,
  CheckCircle,
  Code2,
  RefreshCw,
  Gauge,
  Activity,
  Info
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type TimerId = 'Timer0' | 'Timer1' | 'Timer2' | 'Timer3' | 'Timer4' | 'Timer5';

export type TimerModeId =
  | 'ctc_interrupt'
  | 'ctc_toggle'
  | 'fast_pwm_variable'
  | 'phase_correct_variable'
  | 'normal_preload';

interface TimerModeConfig {
  id: TimerModeId;
  name: string;
  category: 'CTC' | 'PWM' | 'Normal';
  shortDesc: string;
  wgmDescription: string;
  topRegister: 'OCRnA' | 'ICRn' | 'Fixed 0xFF' | 'Fixed 0xFFFF';
  isDualSlope: boolean;
  isPinToggle: boolean;
}

const TIMER_MODES: TimerModeConfig[] = [
  {
    id: 'ctc_interrupt',
    name: 'CTC 모드 (주기적 인터럽트 - ISR)',
    category: 'CTC',
    shortDesc: '카운터가 OCRnA에 도달하면 0으로 리셋되며 TIMER_COMPA_vect 인터럽트를 트리거합니다.',
    wgmDescription: 'Clear Timer on Compare Match (TOP = OCRnA)',
    topRegister: 'OCRnA',
    isDualSlope: false,
    isPinToggle: false
  },
  {
    id: 'ctc_toggle',
    name: 'CTC 모드 (하드웨어 OCnA 핀 토글)',
    category: 'CTC',
    shortDesc: '비교 일치마다 OCnA 핀 상태를 하드웨어적으로 반전(Toggle)시켜 50% 듀티 파형을 생성합니다.',
    wgmDescription: 'CTC + Toggle OCnA on Compare Match (주파수는 인터럽트의 1/2)',
    topRegister: 'OCRnA',
    isDualSlope: false,
    isPinToggle: true
  },
  {
    id: 'fast_pwm_variable',
    name: 'Fast PWM 모드 (단일 슬로프 고속 PWM, TOP = OCRnA)',
    category: 'PWM',
    shortDesc: '0부터 OCRnA까지 단조 증가 후 0으로 리셋. 높은 주파수 PWM 및 모터 속도 제어에 최적.',
    wgmDescription: 'Single-slope Fast PWM (TOP = OCRnA, Compare B = OCRnB)',
    topRegister: 'OCRnA',
    isDualSlope: false,
    isPinToggle: false
  },
  {
    id: 'phase_correct_variable',
    name: 'Phase Correct PWM 모드 (듀얼 슬로프 위상 보정)',
    category: 'PWM',
    shortDesc: '0 -> TOP -> 0 양방향 대칭 카운트. 고조파 왜곡이 적어 모터 드라이버 및 오디오에 필수.',
    wgmDescription: 'Dual-slope Phase Correct PWM (주파수 = f_clk / (2 * N * TOP))',
    topRegister: 'OCRnA',
    isDualSlope: true,
    isPinToggle: false
  },
  {
    id: 'normal_preload',
    name: 'Normal 모드 (오버플로우 프리로드 - TCNT 프리로드)',
    category: 'Normal',
    shortDesc: 'TCNTn이 0xFF/0xFFFF에서 0으로 오버플로우될 때 인터럽트 발생 후 초기값을 재장전합니다.',
    wgmDescription: 'Normal Mode (TOP = MAX, Reload TCNTn in ISR)',
    topRegister: 'Fixed 0xFF',
    isDualSlope: false,
    isPinToggle: false
  }
];

interface FrequencyPreset {
  label: string;
  freqHz: number;
  desc: string;
  tag: string;
}

const FREQ_PRESETS: FrequencyPreset[] = [
  { label: '1 Hz', freqHz: 1, desc: '1초 정주기 하트비트/시계 틱', tag: '타이머' },
  { label: '10 Hz', freqHz: 10, desc: '100ms 센서 샘플링 루프', tag: '타이머' },
  { label: '50 Hz', freqHz: 50, desc: 'RC 서보모터 표준 20ms 제어 주기', tag: '서보' },
  { label: '100 Hz', freqHz: 100, desc: '10ms 시스템 스케줄러 틱', tag: 'RTOS' },
  { label: '440 Hz', freqHz: 440, desc: '표준 음악 피치 Concert A (라 음)', tag: '오디오' },
  { label: '490 Hz', freqHz: 490, desc: 'Arduino 기본 PWM 주파수 (핀 3/9/10/11)', tag: '아두이노' },
  { label: '980 Hz', freqHz: 980, desc: 'Arduino 기본 PWM 주파수 (핀 5/6)', tag: '아두이노' },
  { label: '1 kHz', freqHz: 1000, desc: '1ms 초정밀 밀리초 틱 / 부저', tag: '표준' },
  { label: '10 kHz', freqHz: 10000, desc: '고속 ADC 트리거링 / 초음파', tag: '센서' },
  { label: '25 kHz', freqHz: 25000, desc: 'Intel 4핀 PC 쿨링팬 규격 (가청 노이즈 제거)', tag: '팬제어' },
  { label: '38 kHz', freqHz: 38000, desc: 'NEC / RC-5 적외선(IR) 반송파', tag: 'IR통신' }
];

export const TimerPrescalerCalculator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const mcuProfile = MCU_PROFILES[selectedMCU];

  // 1. Available Timers for Current MCU
  const availableTimers = useMemo<TimerId[]>(() => {
    if (selectedMCU === 'atmega328p') {
      return ['Timer0', 'Timer1', 'Timer2'];
    }
    if (selectedMCU === 'atmega128') {
      return ['Timer0', 'Timer1', 'Timer2', 'Timer3'];
    }
    // atmega640 has Timer 0, 1, 2, 3, 4, 5
    return ['Timer0', 'Timer1', 'Timer2', 'Timer3', 'Timer4', 'Timer5'];
  }, [selectedMCU]);

  const [selectedTimer, setSelectedTimer] = useState<TimerId>('Timer1');

  // Fallback if selectedTimer is invalid for chosen MCU
  const activeTimer: TimerId = availableTimers.includes(selectedTimer) ? selectedTimer : availableTimers[0];

  const is16Bit = useMemo(() => {
    return ['Timer1', 'Timer3', 'Timer4', 'Timer5'].includes(activeTimer);
  }, [activeTimer]);

  const maxCounterValue = is16Bit ? 65535 : 255;
  const timerBitWidth = is16Bit ? 16 : 8;

  // 2. Clock Speed (F_CPU in MHz)
  const [clockMhz, setClockMhz] = useState<number>(16.0);
  const fCpuHz = clockMhz * 1000000;

  // 3. Timer Mode
  const [selectedMode, setSelectedMode] = useState<TimerModeId>('ctc_interrupt');

  // 4. Target Frequency
  const [targetFreqHz, setTargetFreqHz] = useState<number>(1000);

  // 5. Duty Cycle for PWM preview (0% to 100%)
  const [dutyCyclePercent, setDutyCyclePercent] = useState<number>(50);

  // 6. User Override for Prescaler
  const [manualPrescalerOverride, setManualPrescalerOverride] = useState<number | null>(null);

  // 7. Copy Code State
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedRegisters, setCopiedRegisters] = useState<boolean>(false);

  // Timer Prescalers List:
  // Timer0 / Timer1 / Timer3 / Timer4 / Timer5 (standard): 1, 8, 64, 256, 1024
  // Timer2 (asynchronous RTC): 1, 8, 32, 64, 128, 256, 1024
  // Exception: ATmega128 Timer0 has: 1, 8, 32, 64, 128, 256, 1024
  const prescalers = useMemo<number[]>(() => {
    if (activeTimer === 'Timer2' || (selectedMCU === 'atmega128' && activeTimer === 'Timer0')) {
      return [1, 8, 32, 64, 128, 256, 1024];
    }
    return [1, 8, 64, 256, 1024];
  }, [activeTimer, selectedMCU]);

  const currentModeConfig = TIMER_MODES.find((m) => m.id === selectedMode) || TIMER_MODES[0];

  // Calculation logic for each prescaler
  interface PrescalerRow {
    prescaler: number;
    rawTop: number;
    top: number;
    isValid: boolean;
    actualFreq: number;
    errorPercent: number;
    resolutionSteps: number;
    csBits: { cs2: number; cs1: number; cs0: number };
    csName: string;
  }

  // Get CS bits based on prescaler & timer
  const getCsBits = (N: number, timer: TimerId): { cs2: number; cs1: number; cs0: number; csName: string } => {
    const isAsyncTimer = timer === 'Timer2' || (selectedMCU === 'atmega128' && timer === 'Timer0');
    if (!isAsyncTimer) {
      // Standard Timer 0/1/3/4/5
      switch (N) {
        case 1:
          return { cs2: 0, cs1: 0, cs0: 1, csName: 'clk/1 (분주 없음)' };
        case 8:
          return { cs2: 0, cs1: 1, cs0: 0, csName: 'clk/8' };
        case 64:
          return { cs2: 0, cs1: 1, cs0: 1, csName: 'clk/64' };
        case 256:
          return { cs2: 1, cs1: 0, cs0: 0, csName: 'clk/256' };
        case 1024:
          return { cs2: 1, cs1: 0, cs0: 1, csName: 'clk/1024' };
        default:
          return { cs2: 0, cs1: 0, cs0: 0, csName: '정지' };
      }
    } else {
      // Async Timer2 or Mega128 Timer0
      switch (N) {
        case 1:
          return { cs2: 0, cs1: 0, cs0: 1, csName: 'clk/1' };
        case 8:
          return { cs2: 0, cs1: 1, cs0: 0, csName: 'clk/8' };
        case 32:
          return { cs2: 0, cs1: 1, cs0: 1, csName: 'clk/32' };
        case 64:
          return { cs2: 1, cs1: 0, cs0: 0, csName: 'clk/64' };
        case 128:
          return { cs2: 1, cs1: 0, cs0: 1, csName: 'clk/128' };
        case 256:
          return { cs2: 1, cs1: 1, cs0: 0, csName: 'clk/256' };
        case 1024:
          return { cs2: 1, cs1: 1, cs0: 1, csName: 'clk/1024' };
        default:
          return { cs2: 0, cs1: 0, cs0: 0, csName: '정지' };
      }
    }
  };

  const calculatedRows = useMemo<PrescalerRow[]>(() => {
    return prescalers.map((N) => {
      let rawTop = 0;
      let top = 0;
      let actualFreq = 0;

      if (currentModeConfig.id === 'normal_preload') {
        const ticks = fCpuHz / (N * targetFreqHz);
        rawTop = (maxCounterValue + 1) - ticks;
        top = Math.round(rawTop);
        if (top >= 0 && top <= maxCounterValue) {
          actualFreq = fCpuHz / (N * (maxCounterValue + 1 - top));
        } else {
          actualFreq = fCpuHz / (N * (maxCounterValue + 1));
        }
      } else if (currentModeConfig.isDualSlope) {
        rawTop = fCpuHz / (2 * N * targetFreqHz);
        top = Math.round(rawTop);
        if (top >= 1) {
          actualFreq = fCpuHz / (2 * N * top);
        }
      } else if (currentModeConfig.isPinToggle) {
        rawTop = fCpuHz / (2 * N * targetFreqHz) - 1;
        top = Math.round(rawTop);
        if (top >= 0) {
          actualFreq = fCpuHz / (2 * N * (top + 1));
        }
      } else {
        rawTop = fCpuHz / (N * targetFreqHz) - 1;
        top = Math.round(rawTop);
        if (top >= 0) {
          actualFreq = fCpuHz / (N * (top + 1));
        }
      }

      const isValid = top >= 0 && top <= maxCounterValue;
      const errorPercent =
        isValid && actualFreq > 0
          ? (Math.abs(actualFreq - targetFreqHz) / targetFreqHz) * 100
          : 999;

      const resolutionSteps = top + 1;
      const csInfo = getCsBits(N, activeTimer);

      return {
        prescaler: N,
        rawTop,
        top,
        isValid,
        actualFreq,
        errorPercent,
        resolutionSteps,
        csBits: { cs2: csInfo.cs2, cs1: csInfo.cs1, cs0: csInfo.cs0 },
        csName: csInfo.csName
      };
    });
  }, [prescalers, currentModeConfig, fCpuHz, targetFreqHz, maxCounterValue, activeTimer, selectedMCU]);

  // Find best (optimal) prescaler automatically
  const bestPrescalerRow = useMemo<PrescalerRow | null>(() => {
    const validRows = calculatedRows.filter((r) => r.isValid);
    if (validRows.length === 0) return null;

    return validRows.reduce((best, curr) => {
      if (Math.abs(curr.errorPercent - best.errorPercent) > 0.05) {
        return curr.errorPercent < best.errorPercent ? curr : best;
      }
      return curr.top > best.top ? curr : best;
    });
  }, [calculatedRows]);

  // Active selected row
  const selectedRow = useMemo<PrescalerRow>(() => {
    if (manualPrescalerOverride !== null) {
      const found = calculatedRows.find((r) => r.prescaler === manualPrescalerOverride);
      if (found) return found;
    }
    if (bestPrescalerRow) return bestPrescalerRow;
    return calculatedRows[0];
  }, [manualPrescalerOverride, calculatedRows, bestPrescalerRow]);

  // PWM Compare Register (OCRnB) based on duty cycle
  const computedOcrnB = useMemo(() => {
    if (!selectedRow.isValid) return 0;
    const top = selectedRow.top;
    return Math.round((dutyCyclePercent / 100) * top);
  }, [selectedRow, dutyCyclePercent]);

  // Waveform timing metrics
  const waveformMetrics = useMemo(() => {
    const periodSec = selectedRow.actualFreq > 0 ? 1 / selectedRow.actualFreq : 0;
    const periodUs = periodSec * 1000000;
    const highTimeUs = periodUs * (dutyCyclePercent / 100);
    const lowTimeUs = periodUs - highTimeUs;

    return {
      periodSec,
      periodUs,
      highTimeUs,
      lowTimeUs
    };
  }, [selectedRow.actualFreq, dutyCyclePercent]);

  const formatFreq = (hz: number) => {
    if (hz >= 1000000) return `${(hz / 1000000).toFixed(4)} MHz`;
    if (hz >= 1000) return `${(hz / 1000).toFixed(3)} kHz`;
    if (hz >= 1) return `${hz.toFixed(2)} Hz`;
    return `${(hz * 1000).toFixed(2)} mHz`;
  };

  const formatPeriod = (sec: number) => {
    if (sec <= 0) return '0 s';
    if (sec < 0.000001) return `${(sec * 1000000000).toFixed(1)} ns`;
    if (sec < 0.001) return `${(sec * 1000000).toFixed(2)} µs`;
    if (sec < 1) return `${(sec * 1000).toFixed(2)} ms`;
    return `${sec.toFixed(3)} s`;
  };

  // Auto-calculated TCCR, OCR, TCNT Register Values
  const computedRegisters = useMemo(() => {
    const timerNum = activeTimer.replace('Timer', '');
    const is16 = is16Bit;
    const csBits = selectedRow.csBits;
    const csVal = (csBits.cs2 << 2) | (csBits.cs1 << 1) | csBits.cs0;

    let tccrAVal = 0;
    let tccrBVal = 0;
    let tccrABits: string[] = [];
    let tccrBBits: string[] = [];
    let ocrAVal = 0;
    let ocrBVal = 0;
    let tcntVal = 0;
    let timskVal = 0;
    let timskBits: string[] = [];

    const tccrARegName = `TCCR${timerNum}A`;
    const tccrBRegName = `TCCR${timerNum}B`;
    const ocrARegName = `OCR${timerNum}A`;
    const ocrBRegName = `OCR${timerNum}B`;
    const tcntRegName = `TCNT${timerNum}`;
    const timskRegName = activeTimer === 'Timer0' && selectedMCU === 'atmega128' ? 'TIMSK' : `TIMSK${timerNum}`;

    if (currentModeConfig.id === 'ctc_interrupt') {
      if (is16) {
        tccrAVal = 0x00;
        tccrBVal = (1 << 3) | csVal; // WGMn2=1
        tccrABits = ['WGMn1:0=00'];
        tccrBBits = ['WGMn2=1', `CSn=${csVal}`];
      } else {
        tccrAVal = (1 << 1); // WGMn1=1
        tccrBVal = csVal;
        tccrABits = ['WGMn1=1'];
        tccrBBits = [`CSn=${csVal}`];
      }
      ocrAVal = selectedRow.top;
      tcntVal = 0;
      timskVal = (1 << 1); // OCIEnA
      timskBits = ['OCIEnA=1'];
    } else if (currentModeConfig.id === 'ctc_toggle') {
      if (is16) {
        tccrAVal = (1 << 6); // COMnA0=1 (Toggle)
        tccrBVal = (1 << 3) | csVal;
        tccrABits = ['COMnA0=1 (Toggle)'];
        tccrBBits = ['WGMn2=1', `CSn=${csVal}`];
      } else {
        tccrAVal = (1 << 6) | (1 << 1); // COMnA0=1, WGMn1=1
        tccrBVal = csVal;
        tccrABits = ['COMnA0=1 (Toggle)', 'WGMn1=1'];
        tccrBBits = [`CSn=${csVal}`];
      }
      ocrAVal = selectedRow.top;
      tcntVal = 0;
    } else if (currentModeConfig.id === 'fast_pwm_variable') {
      if (is16) {
        tccrAVal = (1 << 5) | (1 << 1) | (1 << 0); // COMnB1, WGMn1, WGMn0
        tccrBVal = (1 << 4) | (1 << 3) | csVal;    // WGMn3, WGMn2, CS
        tccrABits = ['COMnB1=1 (Non-inv)', 'WGMn1=1', 'WGMn0=1'];
        tccrBBits = ['WGMn3=1', 'WGMn2=1', `CSn=${csVal}`];
      } else {
        tccrAVal = (1 << 5) | (1 << 1) | (1 << 0);
        tccrBVal = (1 << 3) | csVal;
        tccrABits = ['COMnB1=1', 'WGMn1=1', 'WGMn0=1'];
        tccrBBits = ['WGMn2=1', `CSn=${csVal}`];
      }
      ocrAVal = selectedRow.top; // TOP frequency
      ocrBVal = computedOcrnB;   // Duty cycle
      tcntVal = 0;
    } else if (currentModeConfig.id === 'phase_correct_variable') {
      if (is16) {
        tccrAVal = (1 << 5) | (1 << 1) | (1 << 0);
        tccrBVal = (1 << 4) | csVal;
        tccrABits = ['COMnB1=1', 'WGMn1=1', 'WGMn0=1'];
        tccrBBits = ['WGMn3=1', `CSn=${csVal}`];
      } else {
        tccrAVal = (1 << 5) | (1 << 0);
        tccrBVal = (1 << 3) | csVal;
        tccrABits = ['COMnB1=1', 'WGMn0=1'];
        tccrBBits = ['WGMn2=1', `CSn=${csVal}`];
      }
      ocrAVal = selectedRow.top;
      ocrBVal = computedOcrnB;
      tcntVal = 0;
    } else {
      tccrAVal = 0x00;
      tccrBVal = csVal;
      tccrABits = ['기본값'];
      tccrBBits = [`CSn=${csVal}`];
      ocrAVal = 0;
      ocrBVal = 0;
      tcntVal = selectedRow.top;
      timskVal = (1 << 0);
      timskBits = ['TOIEn=1'];
    }

    const sfrSnippet = `${tccrARegName} = 0x${tccrAVal.toString(16).padStart(2, '0').toUpperCase()};\n${tccrBRegName} = 0x${tccrBVal.toString(16).padStart(2, '0').toUpperCase()};\n${ocrARegName} = ${ocrAVal}; // 0x${ocrAVal.toString(16).toUpperCase()}\n${ocrBRegName} = ${ocrBVal}; // 0x${ocrBVal.toString(16).toUpperCase()}\n${tcntRegName} = ${tcntVal};\n${timskRegName} = 0x${timskVal.toString(16).padStart(2, '0').toUpperCase()};`;

    return {
      tccrARegName,
      tccrBRegName,
      ocrARegName,
      ocrBRegName,
      tcntRegName,
      timskRegName,
      tccrAVal,
      tccrBVal,
      tccrABits,
      tccrBBits,
      ocrAVal,
      ocrBVal,
      tcntVal,
      timskVal,
      timskBits,
      sfrSnippet
    };
  }, [activeTimer, is16Bit, selectedRow, currentModeConfig, computedOcrnB, selectedMCU]);

  // Generate C Code Snippet
  const generatedCCode = useMemo(() => {
    const timerNum = activeTimer.replace('Timer', '');
    const isT0 = activeTimer === 'Timer0';
    const is16 = is16Bit;

    const tccrA = `TCCR${timerNum}A`;
    const tccrB = `TCCR${timerNum}B`;
    const ocrA = `OCR${timerNum}A`;
    const ocrB = `OCR${timerNum}B`;
    const timsk = isT0 && selectedMCU === 'atmega128' ? 'TIMSK' : `TIMSK${timerNum}`;
    const csBits = selectedRow.csBits;

    let modeSetup = '';
    let isrName = '';

    if (currentModeConfig.id === 'ctc_interrupt') {
      isrName = `TIMER${timerNum}_COMPA_vect`;
      if (is16) {
        modeSetup = `    // 16-bit Timer${timerNum}: CTC Mode (WGM${timerNum}2 = 1)\n    ${tccrA} = 0x00;\n    ${tccrB} = (1 << WGM${timerNum}2) | (${csBits.cs2 ? `(1 << CS${timerNum}2)` : ''}${csBits.cs1 ? ` | (1 << CS${timerNum}1)` : ''}${csBits.cs0 ? ` | (1 << CS${timerNum}0)` : ''});`;
      } else {
        modeSetup = `    // 8-bit Timer${timerNum}: CTC Mode (WGM${timerNum}1 = 1)\n    ${tccrA} = (1 << WGM${timerNum}1);\n    ${tccrB} = (${csBits.cs2 ? `(1 << CS${timerNum}2)` : ''}${csBits.cs1 ? ` | (1 << CS${timerNum}1)` : ''}${csBits.cs0 ? ` | (1 << CS${timerNum}0)` : ''});`;
      }
    } else if (currentModeConfig.id === 'ctc_toggle') {
      if (is16) {
        modeSetup = `    // 16-bit Timer${timerNum}: CTC + Toggle OC${timerNum}A on Compare Match\n    ${tccrA} = (1 << COM${timerNum}A0);\n    ${tccrB} = (1 << WGM${timerNum}2) | (${csBits.cs2 ? `(1 << CS${timerNum}2)` : ''}${csBits.cs1 ? ` | (1 << CS${timerNum}1)` : ''}${csBits.cs0 ? ` | (1 << CS${timerNum}0)` : ''});`;
      } else {
        modeSetup = `    // 8-bit Timer${timerNum}: CTC + Toggle OC${timerNum}A\n    ${tccrA} = (1 << COM${timerNum}A0) | (1 << WGM${timerNum}1);\n    ${tccrB} = (${csBits.cs2 ? `(1 << CS${timerNum}2)` : ''}${csBits.cs1 ? ` | (1 << CS${timerNum}1)` : ''}${csBits.cs0 ? ` | (1 << CS${timerNum}0)` : ''});`;
      }
    } else if (currentModeConfig.id === 'fast_pwm_variable') {
      if (is16) {
        modeSetup = `    // 16-bit Timer${timerNum}: Fast PWM Mode 15 (TOP = OCR${timerNum}A)\n    ${tccrA} = (1 << COM${timerNum}B1) | (1 << WGM${timerNum}1) | (1 << WGM${timerNum}0);\n    ${tccrB} = (1 << WGM${timerNum}3) | (1 << WGM${timerNum}2) | (${csBits.cs2 ? `(1 << CS${timerNum}2)` : ''}${csBits.cs1 ? ` | (1 << CS${timerNum}1)` : ''}${csBits.cs0 ? ` | (1 << CS${timerNum}0)` : ''});`;
      } else {
        modeSetup = `    // 8-bit Timer${timerNum}: Fast PWM Mode 7 (TOP = OCR${timerNum}A)\n    ${tccrA} = (1 << COM${timerNum}B1) | (1 << WGM${timerNum}1) | (1 << WGM${timerNum}0);\n    ${tccrB} = (1 << WGM${timerNum}2) | (${csBits.cs2 ? `(1 << CS${timerNum}2)` : ''}${csBits.cs1 ? ` | (1 << CS${timerNum}1)` : ''}${csBits.cs0 ? ` | (1 << CS${timerNum}0)` : ''});`;
      }
    } else if (currentModeConfig.id === 'phase_correct_variable') {
      if (is16) {
        modeSetup = `    // 16-bit Timer${timerNum}: Phase Correct PWM Mode 11 (TOP = OCR${timerNum}A)\n    ${tccrA} = (1 << COM${timerNum}B1) | (1 << WGM${timerNum}1) | (1 << WGM${timerNum}0);\n    ${tccrB} = (1 << WGM${timerNum}3) | (${csBits.cs2 ? `(1 << CS${timerNum}2)` : ''}${csBits.cs1 ? ` | (1 << CS${timerNum}1)` : ''}${csBits.cs0 ? ` | (1 << CS${timerNum}0)` : ''});`;
      } else {
        modeSetup = `    // 8-bit Timer${timerNum}: Phase Correct PWM Mode 5 (TOP = OCR${timerNum}A)\n    ${tccrA} = (1 << COM${timerNum}B1) | (1 << WGM${timerNum}0);\n    ${tccrB} = (1 << WGM${timerNum}2) | (${csBits.cs2 ? `(1 << CS${timerNum}2)` : ''}${csBits.cs1 ? ` | (1 << CS${timerNum}1)` : ''}${csBits.cs0 ? ` | (1 << CS${timerNum}0)` : ''});`;
      }
    } else {
      isrName = `TIMER${timerNum}_OVF_vect`;
      modeSetup = `    // Normal Mode (Overflow reload)\n    ${tccrA} = 0x00;\n    ${tccrB} = (${csBits.cs2 ? `(1 << CS${timerNum}2)` : ''}${csBits.cs1 ? ` | (1 << CS${timerNum}1)` : ''}${csBits.cs0 ? ` | (1 << CS${timerNum}0)` : ''});\n    TCNT${timerNum} = ${selectedRow.top}; // Preload value`;
    }

    const cleanModeSetup = modeSetup.replace(/\|\s*;/g, ';').replace(/\(\s*\|\s*/g, '(');

    let code = `// ==========================================================================\n`;
    code += `// AVR ${mcuProfile.name} - ${activeTimer} Configuration\n`;
    code += `// F_CPU: ${clockMhz} MHz | Target Freq: ${formatFreq(targetFreqHz)} | Actual: ${formatFreq(selectedRow.actualFreq)}\n`;
    code += `// Prescaler: 1:${selectedRow.prescaler} | TOP Value: ${selectedRow.top} (0x${selectedRow.top.toString(16).toUpperCase()}) | Error: ${selectedRow.errorPercent.toFixed(3)}%\n`;
    code += `// ==========================================================================\n\n`;
    code += `#include <avr/io.h>\n#include <avr/interrupt.h>\n\n`;
    code += `void timer${timerNum}_init(void) {\n`;
    code += `    cli(); // Disable interrupts during configuration\n\n`;
    code += `${cleanModeSetup}\n\n`;

    if (currentModeConfig.id !== 'normal_preload') {
      code += `    // Set TOP compare match value (Resolution: ${selectedRow.resolutionSteps} steps)\n`;
      code += `    ${ocrA} = ${selectedRow.top}; // 0x${selectedRow.top.toString(16).toUpperCase()}\n\n`;

      if (currentModeConfig.category === 'PWM') {
        code += `    // Set Compare Match B for ${dutyCyclePercent}% Duty Cycle\n`;
        code += `    ${ocrB} = ${computedOcrnB}; // 0x${computedOcrnB.toString(16).toUpperCase()}\n\n`;
      }
    }

    if (isrName) {
      const ocieBit =
        currentModeConfig.id === 'normal_preload'
          ? `TOIE${timerNum}`
          : `OCIE${timerNum}A`;
      code += `    // Enable Timer Interrupt\n`;
      code += `    ${timsk} |= (1 << ${ocieBit});\n\n`;
    }

    code += `    sei(); // Enable global interrupts\n`;
    code += `}\n`;

    if (isrName) {
      code += `\n// Interrupt Service Routine\n`;
      code += `ISR(${isrName}) {\n`;
      if (currentModeConfig.id === 'normal_preload') {
        code += `    TCNT${timerNum} = ${selectedRow.top}; // Reload preload offset\n`;
      }
      code += `    // User code here (e.g. toggle GPIO or update PID loop)\n`;
      code += `    // PORTB ^= (1 << PB5); // Built-in LED Toggle\n`;
      code += `}\n`;
    }

    return code;
  }, [
    activeTimer,
    is16Bit,
    selectedMCU,
    selectedRow,
    currentModeConfig,
    clockMhz,
    targetFreqHz,
    dutyCyclePercent,
    computedOcrnB,
    mcuProfile.name
  ]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div id="timer-counter-configuration-calculator-section" className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden backdrop-blur scroll-mt-20">
      {/* Background ambient lighting */}
      <div className="absolute -top-32 -right-32 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Timer/Counter Configuration Calculator (타이머/카운터 설정 계산기)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Target Freq • Prescaler • TCNTn / OCRn Calculator
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-xs font-mono font-bold">
                  {mcuProfile.name}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
                원하는 목표 주파수(Target Frequency)와 시스템 클록(F_CPU)을 입력하면,
                <strong>CTC 모드 및 PWM 모드</strong>에 필요한 최적의 <strong>프리스케일러(Prescaler)</strong>와 <strong>TCNTn 프리로드 / OCRn 비교일치 레지스터 값</strong>을 자동으로 계산하고 C 코드를 생성합니다.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick MCU Switcher */}
          {onSelectMCU && (
            <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 shrink-0">
              {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
                <button
                  key={mcuId}
                  onClick={() => onSelectMCU(mcuId)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
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

          {/* Timer Selector Pills */}
          <div className="flex items-center gap-1.5 flex-wrap self-start lg:self-auto bg-slate-950/90 p-1 rounded-xl border border-slate-800">
            <span className="text-[11px] font-mono font-medium text-slate-400 px-2 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-amber-400" /> 타이머:
            </span>
            {availableTimers.map((timer) => {
              const is16 = ['Timer1', 'Timer3', 'Timer4', 'Timer5'].includes(timer);
              return (
                <button
                  key={timer}
                  onClick={() => {
                    setSelectedTimer(timer);
                    setManualPrescalerOverride(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    activeTimer === timer
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 ring-2 ring-amber-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {timer} <span className="text-[9px] font-normal opacity-80">({is16 ? '16b' : '8b'})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Target Spec Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>선택 타이머</span>
            <Activity className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-base font-bold font-mono text-amber-300">
            {activeTimer} ({timerBitWidth}-bit)
          </div>
          <div className="text-[10px] text-slate-500">MAX: {maxCounterValue.toLocaleString()}</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>시스템 클럭 (F_CPU)</span>
            <Zap className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="text-base font-bold font-mono text-cyan-300">
            {clockMhz} <span className="text-xs text-slate-400">MHz</span>
          </div>
          <div className="text-[10px] text-slate-500">{(1000 / clockMhz).toFixed(1)} ns / 클럭</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>선택 분주비 (Prescaler)</span>
            <Sliders className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="text-base font-bold font-mono text-emerald-300">
            1 : {selectedRow.prescaler}
          </div>
          <div className="text-[10px] text-slate-500">{selectedRow.csName}</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>연산된 TOP (OCRnA)</span>
            <Gauge className="w-3 h-3 text-indigo-400" />
          </div>
          <div className="text-base font-bold font-mono text-indigo-300">
            {selectedRow.isValid ? selectedRow.top.toLocaleString() : '범위 초과'}
          </div>
          <div className="text-[10px] text-slate-500">
            {selectedRow.isValid ? `0x${selectedRow.top.toString(16).toUpperCase()}` : '오버플로우'}
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>실제 출력 주파수</span>
            <CheckCircle className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="text-base font-bold font-mono text-cyan-300">
            {selectedRow.isValid ? formatFreq(selectedRow.actualFreq) : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500">
            주기: {selectedRow.isValid ? formatPeriod(1 / selectedRow.actualFreq) : 'N/A'}
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>주파수 오차율</span>
            <AlertTriangle className="w-3 h-3 text-rose-400" />
          </div>
          <div
            className={`text-base font-bold font-mono ${
              !selectedRow.isValid
                ? 'text-rose-400'
                : selectedRow.errorPercent <= 0.01
                ? 'text-emerald-300'
                : selectedRow.errorPercent <= 1.0
                ? 'text-amber-300'
                : 'text-rose-400'
            }`}
          >
            {selectedRow.isValid ? `${selectedRow.errorPercent.toFixed(3)}%` : '연산 불가'}
          </div>
          <div className="text-[10px] text-slate-500">
            {selectedRow.isValid
              ? selectedRow.errorPercent === 0
                ? '0.00% 정밀 일치'
                : '근사치'
              : '타이머 변경 필요'}
          </div>
        </div>
      </div>

      {/* Main Interactive Controls (Grid 12 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Inputs (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-950/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              타이머 연산 파라미터 입력
            </h4>
            <button
              onClick={() => {
                setClockMhz(16.0);
                setTargetFreqHz(1000);
                setSelectedMode('ctc_interrupt');
                setDutyCyclePercent(50);
                setManualPrescalerOverride(null);
              }}
              className="text-[11px] text-slate-400 hover:text-amber-300 flex items-center gap-1 font-mono transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> 초기화
            </button>
          </div>

          {/* 1. Clock Speed Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                시스템 클럭 속도 (Clock Speed):
              </label>
              <span className="font-mono text-xs font-bold text-cyan-300 bg-cyan-950/70 px-2 py-0.5 rounded border border-cyan-800/60">
                {clockMhz} MHz
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.0001"
                min="0.1"
                max="32"
                value={clockMhz}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    setClockMhz(val);
                    setManualPrescalerOverride(null);
                  }
                }}
                className="w-28 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
              />
              <span className="text-xs text-slate-400 font-mono">MHz</span>

              {/* Quick Clock Presets */}
              <div className="flex items-center gap-1 ml-auto">
                {[16, 8, 20, 11.0592].map((mhz) => (
                  <button
                    key={mhz}
                    onClick={() => {
                      setClockMhz(mhz);
                      setManualPrescalerOverride(null);
                    }}
                    className={`px-2 py-1 text-[10px] font-mono rounded transition-colors ${
                      clockMhz === mhz
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {mhz}M
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Timer Mode Selection */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              동작 모드 (Timer Mode):
            </label>
            <div className="space-y-1.5">
              {TIMER_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => {
                    setSelectedMode(mode.id);
                    setManualPrescalerOverride(null);
                  }}
                  className={`w-full p-2.5 rounded-xl border text-left transition-all ${
                    selectedMode === mode.id
                      ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-md shadow-amber-500/10'
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      {mode.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                      {mode.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    {mode.shortDesc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Desired Frequency Input */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                목표 주파수 (Desired Frequency):
              </label>
              <span className="font-mono text-xs font-bold text-emerald-300 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-800/60">
                {formatFreq(targetFreqHz)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                min="0.001"
                max={fCpuHz / 2}
                value={targetFreqHz}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    setTargetFreqHz(val);
                    setManualPrescalerOverride(null);
                  }
                }}
                className="w-36 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
              />
              <span className="text-xs text-slate-400 font-mono">Hz</span>
              <span className="text-[11px] text-slate-400 ml-auto font-mono">
                주기: {formatPeriod(1 / targetFreqHz)}
              </span>
            </div>

            {/* Frequency Preset Buttons */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 block">자주 쓰이는 임베디드 목표 주파수:</span>
              <div className="flex flex-wrap gap-1">
                {FREQ_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setTargetFreqHz(preset.freqHz);
                      setManualPrescalerOverride(null);
                    }}
                    className={`px-2 py-1 text-[10px] font-mono rounded-lg transition-colors border ${
                      targetFreqHz === preset.freqHz
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                    title={`${preset.desc} (${preset.tag})`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Duty Cycle (PWM mode only) */}
          {currentModeConfig.category === 'PWM' && (
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  PWM 듀티 사이클 (Duty Cycle):
                </label>
                <span className="font-mono text-xs font-bold text-indigo-300">
                  {dutyCyclePercent}% (OCRnB: {computedOcrnB})
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={dutyCyclePercent}
                onChange={(e) => setDutyCyclePercent(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>0% (항상 Low)</span>
                <span>50% (대칭 구형파)</span>
                <span>100% (항상 High)</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Output: Prescaler Table, Waveform & C Code (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Prescaler Matrix Comparison Table */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  프리스케일러(Prescaler) 분주비별 TOP 연산 매트릭스
                </h5>
                <p className="text-[11px] text-slate-400">
                  {activeTimer} ({timerBitWidth}-bit, MAX: {maxCounterValue}) 기준 연산 결과 (클릭하여 직접 분주비 선택 가능)
                </p>
              </div>
              {manualPrescalerOverride !== null && (
                <button
                  onClick={() => setManualPrescalerOverride(null)}
                  className="text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded hover:bg-amber-500/20"
                >
                  최적 자동 선택으로 복귀
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                    <th className="py-2 px-2.5">분주비 (N)</th>
                    <th className="py-2 px-2.5">CS 비트</th>
                    <th className="py-2 px-2.5">TOP (OCRnA)</th>
                    <th className="py-2 px-2.5">실제 주파수</th>
                    <th className="py-2 px-2.5">오차율</th>
                    <th className="py-2 px-2.5">해상도</th>
                    <th className="py-2 px-2.5 text-center">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {calculatedRows.map((row) => {
                    const isSelected = selectedRow.prescaler === row.prescaler;
                    const isOptimal = bestPrescalerRow?.prescaler === row.prescaler;

                    return (
                      <tr
                        key={row.prescaler}
                        onClick={() => {
                          if (row.isValid) setManualPrescalerOverride(row.prescaler);
                        }}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/15 border-l-4 border-l-amber-400 text-white'
                            : row.isValid
                            ? 'hover:bg-slate-900/80 text-slate-300'
                            : 'opacity-40 bg-slate-950/40 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <td className="py-2 px-2.5 font-bold">
                          1 : {row.prescaler}
                        </td>
                        <td className="py-2 px-2.5 text-slate-400 text-[11px]">
                          {row.csBits.cs2}{row.csBits.cs1}{row.csBits.cs0}
                        </td>
                        <td className="py-2 px-2.5 font-bold">
                          {row.isValid ? (
                            <span className="text-amber-300">
                              {row.top.toLocaleString()} <span className="text-[10px] text-slate-400">(0x{row.top.toString(16).toUpperCase()})</span>
                            </span>
                          ) : row.top > maxCounterValue ? (
                            <span className="text-rose-400 text-[11px]">오버플로우 (&gt; {maxCounterValue})</span>
                          ) : (
                            <span className="text-rose-400 text-[11px]">언더플로우 (&lt; 0)</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5">
                          {row.isValid ? formatFreq(row.actualFreq) : '-'}
                        </td>
                        <td className="py-2 px-2.5">
                          {row.isValid ? (
                            <span
                              className={`font-semibold ${
                                row.errorPercent <= 0.01
                                  ? 'text-emerald-400'
                                  : row.errorPercent <= 1.0
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {row.errorPercent.toFixed(2)}%
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-slate-400 text-[11px]">
                          {row.isValid ? `${row.resolutionSteps} 단계` : '-'}
                        </td>
                        <td className="py-2 px-2.5 text-center">
                          {isOptimal ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              추천 (최적)
                            </span>
                          ) : row.isValid ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                              사용가능
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              범위초과
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Out-of-Range Help Warning if no prescaler works */}
            {!selectedRow.isValid && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong>카운터 범위 초과 경고:</strong> 목표 주파수({formatFreq(targetFreqHz)})가 현재 {activeTimer} ({timerBitWidth}-bit)의
                  카운트 한계({maxCounterValue})를 벗어났습니다. 상단에서 <strong>16비트 타이머(Timer1)</strong>를 선택하거나,
                  시스템 클럭을 조정하세요.
                </div>
              </div>
            )}
          </div>

          {/* Auto-Generated Registers Panel (TCCR, OCR, TCNT & TIMSK) */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-amber-400" />
                  자동 산출 레지스터 값 (TCCR, OCR, TCNT & TIMSK)
                </h5>
                <p className="text-[11px] text-slate-400">
                  {currentModeConfig.name} 설정에 필요한 AVR 하드웨어 SFR 레지스터 값
                </p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(computedRegisters.sfrSnippet);
                  setCopiedRegisters(true);
                  setTimeout(() => setCopiedRegisters(false), 2000);
                }}
                className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all"
              >
                {copiedRegisters ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedRegisters ? '복사 완료!' : 'SFR 값 복사'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
              {/* TCCRnA */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-amber-300">{computedRegisters.tccrARegName}</span>
                  <span className="text-slate-400 font-bold">0x{computedRegisters.tccrAVal.toString(16).padStart(2, '0').toUpperCase()}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  0b{computedRegisters.tccrAVal.toString(2).padStart(8, '0')}
                </div>
                <div className="text-[9px] text-slate-400 truncate">
                  {computedRegisters.tccrABits.length > 0 ? computedRegisters.tccrABits.join(' | ') : '기본 (0x00)'}
                </div>
              </div>

              {/* TCCRnB */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-amber-300">{computedRegisters.tccrBRegName}</span>
                  <span className="text-slate-400 font-bold">0x{computedRegisters.tccrBVal.toString(16).padStart(2, '0').toUpperCase()}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  0b{computedRegisters.tccrBVal.toString(2).padStart(8, '0')}
                </div>
                <div className="text-[9px] text-slate-400 truncate">
                  {computedRegisters.tccrBBits.length > 0 ? computedRegisters.tccrBBits.join(' | ') : '기본 (0x00)'}
                </div>
              </div>

              {/* OCRnA */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-cyan-300">{computedRegisters.ocrARegName} (TOP)</span>
                  <span className="text-cyan-400 font-bold">0x{computedRegisters.ocrAVal.toString(16).toUpperCase()}</span>
                </div>
                <div className="text-[10px] text-slate-300 font-mono">
                  10진수: {computedRegisters.ocrAVal.toLocaleString()}
                </div>
                <div className="text-[9px] text-slate-400">
                  주파수 결정 비교 일치값
                </div>
              </div>

              {/* OCRnB */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-indigo-300">{computedRegisters.ocrBRegName}</span>
                  <span className="text-indigo-400 font-bold">0x{computedRegisters.ocrBVal.toString(16).toUpperCase()}</span>
                </div>
                <div className="text-[10px] text-slate-300 font-mono">
                  10진수: {computedRegisters.ocrBVal.toLocaleString()}
                </div>
                <div className="text-[9px] text-slate-400">
                  {currentModeConfig.category === 'PWM' ? `듀티 사이클 (${dutyCyclePercent}%)` : '미사용 (0)'}
                </div>
              </div>

              {/* TCNTn */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-emerald-300">{computedRegisters.tcntRegName}</span>
                  <span className="text-emerald-400 font-bold">0x{computedRegisters.tcntVal.toString(16).toUpperCase()}</span>
                </div>
                <div className="text-[10px] text-slate-300 font-mono">
                  10진수: {computedRegisters.tcntVal.toLocaleString()}
                </div>
                <div className="text-[9px] text-slate-400">
                  {currentModeConfig.id === 'normal_preload' ? '초기 프리로드 값' : '카운터 시작값 (0)'}
                </div>
              </div>

              {/* TIMSKn */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-violet-300">{computedRegisters.timskRegName}</span>
                  <span className="text-violet-400 font-bold">0x{computedRegisters.timskVal.toString(16).padStart(2, '0').toUpperCase()}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  0b{computedRegisters.timskVal.toString(2).padStart(8, '0')}
                </div>
                <div className="text-[9px] text-slate-400 truncate">
                  {computedRegisters.timskBits.length > 0 ? computedRegisters.timskBits.join(' | ') : '인터럽트 비활성 (0x00)'}
                </div>
              </div>
            </div>
          </div>

          {/* Waveform & Timing Visualization */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-cyan-400" />
                생성 파형 타이밍 시뮬레이션
              </h5>
              <span className="text-[11px] font-mono text-cyan-300">
                주기: {formatPeriod(waveformMetrics.periodSec)} ({formatFreq(selectedRow.actualFreq)})
              </span>
            </div>

            {/* SVG Digital Waveform */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
              <svg className="w-full h-16" viewBox="0 0 600 70" preserveAspectRatio="none">
                {/* Background grid */}
                <line x1="0" y1="55" x2="600" y2="55" stroke="#334155" strokeDasharray="4 4" />
                <line x1="0" y1="15" x2="600" y2="15" stroke="#334155" strokeDasharray="4 4" />

                {/* 2 Complete Cycles */}
                {(() => {
                  const duty = currentModeConfig.isPinToggle ? 0.5 : dutyCyclePercent / 100;
                  const cycleW = 280;
                  const highW = Math.max(2, cycleW * duty);

                  return (
                    <g stroke="#38bdf8" strokeWidth="2.5" fill="none">
                      {/* Cycle 1 */}
                      <path
                        d={`M 20 55 L 20 15 L ${20 + highW} 15 L ${20 + highW} 55 L ${20 + cycleW} 55`}
                      />
                      {/* Cycle 2 */}
                      <path
                        d={`M ${20 + cycleW} 55 L ${20 + cycleW} 15 L ${20 + cycleW + highW} 15 L ${
                          20 + cycleW + highW
                        } 55 L ${20 + cycleW * 2} 55`}
                      />
                    </g>
                  );
                })()}

                {/* Labels */}
                <text x="25" y="10" fill="#38bdf8" fontSize="10" fontFamily="monospace">
                  HIGH ({formatPeriod(waveformMetrics.highTimeUs / 1000000)})
                </text>
                <text x="180" y="67" fill="#64748b" fontSize="10" fontFamily="monospace">
                  LOW ({formatPeriod(waveformMetrics.lowTimeUs / 1000000)})
                </text>
              </svg>

              <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono pt-1 border-t border-slate-800/80">
                <div className="bg-slate-950 p-1.5 rounded">
                  <span className="text-slate-400 block text-[10px]">High 유지 시간 (T_high)</span>
                  <span className="text-cyan-300 font-bold">{formatPeriod(waveformMetrics.highTimeUs / 1000000)}</span>
                </div>
                <div className="bg-slate-950 p-1.5 rounded">
                  <span className="text-slate-400 block text-[10px]">Low 유지 시간 (T_low)</span>
                  <span className="text-slate-300 font-bold">{formatPeriod(waveformMetrics.lowTimeUs / 1000000)}</span>
                </div>
                <div className="bg-slate-950 p-1.5 rounded">
                  <span className="text-slate-400 block text-[10px]">1주기 카운터 틱수</span>
                  <span className="text-amber-300 font-bold">
                    {currentModeConfig.isDualSlope ? selectedRow.top * 2 : selectedRow.top + 1} Ticks
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* C Code Snippet Generator */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-emerald-400" />
                  AVR-GCC C 초기화 펌웨어 코드
                </h5>
                <p className="text-[11px] text-slate-400">
                  선택한 {activeTimer} 레지스터(TCCRnA, TCCRnB, OCRnA) 및 ISR 템플릿
                </p>
              </div>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode ? '복사 완료' : '코드 복사'}
              </button>
            </div>

            <pre className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto max-h-56 custom-scrollbar leading-relaxed">
              {generatedCCode}
            </pre>
          </div>
        </div>
      </div>

      {/* Engineering Technical Notes & Formulas */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-2">
        <h5 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-amber-400" />
          AVR 타이머/카운터 수학 공식 및 아키텍처 핵심 요약
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-400">
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
            <span className="font-bold text-amber-300 block font-mono">1. CTC 모드 인터럽트 주기 공식</span>
            <code className="text-cyan-300 block font-mono bg-slate-950 p-1 rounded">
              f = F_CPU / (N × (OCRnA + 1))
            </code>
            <p className="text-[10px] leading-tight">
              카운터가 0에서 OCRnA까지 세는 데 (OCRnA + 1) 클럭 틱이 필요하며, 도달 즉시 0으로 리셋됩니다.
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
            <span className="font-bold text-amber-300 block font-mono">2. Fast PWM 주파수 공식</span>
            <code className="text-cyan-300 block font-mono bg-slate-950 p-1 rounded">
              f_PWM = F_CPU / (N × (TOP + 1))
            </code>
            <p className="text-[10px] leading-tight">
              단일 슬로프(Single Slope)로 카운트하여 Phase Correct 모드에 비해 주파수가 정확히 2배 높습니다.
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
            <span className="font-bold text-amber-300 block font-mono">3. Phase Correct PWM 주기 공식</span>
            <code className="text-cyan-300 block font-mono bg-slate-950 p-1 rounded">
              f_PWM = F_CPU / (2 × N × TOP)
            </code>
            <p className="text-[10px] leading-tight">
              0부터 TOP까지 업카운트 후 다시 0까지 다운카운트(Dual Slope)하므로 위상 왜곡 없는 고품질 파형을 만듭니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
