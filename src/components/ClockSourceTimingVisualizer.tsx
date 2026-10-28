import React, { useState, useMemo } from 'react';
import {
  Clock,
  Cpu,
  Zap,
  Activity,
  Layers,
  Sliders,
  Copy,
  Check,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Info,
  Sparkles,
  ArrowRight,
  Gauge,
  Timer as TimerIcon,
  HelpCircle,
  Binary,
  Radio
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type ClockSourceType = 'internal_rc' | 'external_crystal';

interface ClockPreset {
  id: string;
  source: ClockSourceType;
  label: string;
  freqHz: number;
  description: string;
  accuracy: string;
  stability: 'high' | 'medium' | 'low';
}

const CLOCK_PRESETS: ClockPreset[] = [
  {
    id: 'ext_16mhz',
    source: 'external_crystal',
    label: '16.0 MHz (Arduino 표준 크리스탈)',
    freqHz: 16000000,
    description: 'Arduino Uno/Mega 표준 주파수. 62.5ns 단일 사이클 실행 속도.',
    accuracy: '±30 ppm (0.003%)',
    stability: 'high'
  },
  {
    id: 'ext_20mhz',
    source: 'external_crystal',
    label: '20.0 MHz (AVR 정격 최대 클럭)',
    freqHz: 20000000,
    description: '5V 동작 전압에서 발휘 가능한 최대 연산 성능 (50ns/사이클).',
    accuracy: '±30 ppm (0.003%)',
    stability: 'high'
  },
  {
    id: 'ext_14_7456mhz',
    source: 'external_crystal',
    label: '14.7456 MHz (UART 0% 보레이트 전용)',
    freqHz: 14745600,
    description: '115200, 230400bps 등 모든 시리얼 통신 오차율 0.00% 달성.',
    accuracy: '±20 ppm (0.002%)',
    stability: 'high'
  },
  {
    id: 'ext_8mhz',
    source: 'external_crystal',
    label: '8.0 MHz (3.3V 저전력 크리스탈)',
    freqHz: 8000000,
    description: '3.3V 배터리 전원 구동에 안전하며 125ns 단일 사이클 제공.',
    accuracy: '±30 ppm (0.003%)',
    stability: 'high'
  },
  {
    id: 'ext_32khz',
    source: 'external_crystal',
    label: '32.768 kHz (RTC 시계 크리스탈)',
    freqHz: 32768,
    description: '실시간 시계(RTC) 및 초저전력 Power-save 모드용 발진자.',
    accuracy: '±20 ppm (0.002%)',
    stability: 'high'
  },
  {
    id: 'rc_8mhz',
    source: 'internal_rc',
    label: '8.0 MHz (내부 Calibrated RC 오실레이터)',
    freqHz: 8000000,
    description: '외장 부품 없이 온칩 발진. 공장 출고 교정 기준 ±1% 오차.',
    accuracy: '±1.0% ~ ±10% (온도/전압 의존)',
    stability: 'medium'
  },
  {
    id: 'rc_1mhz',
    source: 'internal_rc',
    label: '1.0 MHz (내부 8MHz + CKDIV8 퓨즈 기본값)',
    freqHz: 1000000,
    description: '신품 MCU 출고 시 기본 클럭. 1.0µs 사이클로 안전 부팅.',
    accuracy: '±1.0% (공장 교정)',
    stability: 'medium'
  },
  {
    id: 'rc_128khz',
    source: 'internal_rc',
    label: '128 kHz (내부 저주파 WDT 오실레이터)',
    freqHz: 128000,
    description: '와치독 타이머 및 최저 전력 소모(1~2µA) 동작용 클럭.',
    accuracy: '±10% ~ ±30%',
    stability: 'low'
  }
];

// Prescaler definitions for Timers
interface PrescalerOption {
  factor: number;
  csBits: string;
  label: string;
}

const TIMER0_PRESCALERS: PrescalerOption[] = [
  { factor: 1, csBits: '001 (CS00=1)', label: '1 (분주 없음)' },
  { factor: 8, csBits: '010 (CS01=1)', label: '8' },
  { factor: 64, csBits: '011 (CS01=1, CS00=1)', label: '64' },
  { factor: 256, csBits: '100 (CS02=1)', label: '256' },
  { factor: 1024, csBits: '101 (CS02=1, CS00=1)', label: '1024' }
];

export const ClockSourceTimingVisualizer: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Clock source selection
  const [clockSource, setClockSource] = useState<ClockSourceType>('external_crystal');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('ext_16mhz');
  const [baseFreqHz, setBaseFreqHz] = useState<number>(16000000);
  const [customFreqInput, setCustomFreqInput] = useState<string>('16.0');

  // System Prescaler (CLKPR: 1, 2, 4, 8, 16, 32, 64, 128, 256)
  const [clkDiv, setClkDiv] = useState<number>(1);

  // Target interval interactive solver
  const [targetIntervalMs, setTargetIntervalMs] = useState<number>(1.0); // 1.0 ms default

  // Copy C code state
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Apply a preset
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const p = CLOCK_PRESETS.find((x) => x.id === presetId);
    if (p) {
      setClockSource(p.source);
      setBaseFreqHz(p.freqHz);
      setCustomFreqInput((p.freqHz / 1000000).toFixed(4).replace(/\.?0+$/, ''));
    }
  };

  // Change Clock Source Category
  const handleChangeSourceType = (type: ClockSourceType) => {
    setClockSource(type);
    const defaultPreset = CLOCK_PRESETS.find((p) => p.source === type);
    if (defaultPreset) {
      handleSelectPreset(defaultPreset.id);
    }
  };

  // Apply custom frequency
  const handleCustomFreqChange = (valStr: string) => {
    setCustomFreqInput(valStr);
    const parsedMHz = parseFloat(valStr);
    if (!isNaN(parsedMHz) && parsedMHz > 0 && parsedMHz <= 30) {
      setBaseFreqHz(Math.round(parsedMHz * 1000000));
      setSelectedPresetId('custom');
    }
  };

  // Effective Core CPU Frequency
  const effectiveFcpu = baseFreqHz / clkDiv;
  const clockPeriodNs = (1 / effectiveFcpu) * 1e9; // 1 cycle in ns
  const mips = (effectiveFcpu / 1e6).toFixed(2);

  // Calculate Instruction Timings
  const instructionTimings = useMemo(() => {
    const cycle1Ns = clockPeriodNs * 1;
    const cycle2Ns = clockPeriodNs * 2;
    const cycle3Ns = clockPeriodNs * 3;
    const cycle4Ns = clockPeriodNs * 4;
    const isrLatencyNs = clockPeriodNs * 4; // minimum 4 cycles to vector
    const totalIsrNs = clockPeriodNs * 7; // typical 7 cycles prologue/vector

    const formatTime = (ns: number) => {
      if (ns >= 1000000) return `${(ns / 1000000).toFixed(3)} ms`;
      if (ns >= 1000) return `${(ns / 1000).toFixed(3)} µs`;
      return `${ns.toFixed(2)} ns`;
    };

    return {
      cycle1Ns,
      cycle2Ns,
      cycle3Ns,
      cycle4Ns,
      isrLatencyNs,
      totalIsrNs,
      cycle1Str: formatTime(cycle1Ns),
      cycle2Str: formatTime(cycle2Ns),
      cycle3Str: formatTime(cycle3Ns),
      cycle4Str: formatTime(cycle4Ns),
      isrLatencyStr: formatTime(isrLatencyNs),
      totalIsrStr: formatTime(totalIsrNs)
    };
  }, [clockPeriodNs]);

  // Calculate Prescaler & Timer Table
  const prescalerAnalysis = useMemo(() => {
    return TIMER0_PRESCALERS.map((ps) => {
      const timerFreq = effectiveFcpu / ps.factor;
      const tickPeriodNs = (1 / timerFreq) * 1e9;
      const tickPeriodUs = tickPeriodNs / 1000;

      // 8-bit timer overflow (256 ticks)
      const overflow8BitPeriodMs = (256 * tickPeriodNs) / 1e6;
      const overflow8BitFreqHz = 1000 / overflow8BitPeriodMs;

      // 16-bit timer overflow (65,536 ticks)
      const overflow16BitPeriodMs = (65536 * tickPeriodNs) / 1e6;
      const overflow16BitFreqHz = 1000 / overflow16BitPeriodMs;

      // Check suitability for targetIntervalMs
      // Ideal OCR value for 8-bit CTC mode: OCR = (targetMs * 1e-3 * timerFreq) - 1
      const ticksNeeded = Math.round((targetIntervalMs * 1e-3) * timerFreq);
      const ocr8bit = ticksNeeded - 1;
      const is8bitValid = ocr8bit >= 0 && ocr8bit <= 255;
      const ocr16bit = ticksNeeded - 1;
      const is16bitValid = ocr16bit >= 0 && ocr16bit <= 65535;

      const actualIntervalMs8 = is8bitValid ? ((ocr8bit + 1) / timerFreq) * 1000 : null;
      const errorPct8 = actualIntervalMs8 !== null ? Math.abs((actualIntervalMs8 - targetIntervalMs) / targetIntervalMs) * 100 : null;

      return {
        ...ps,
        timerFreq,
        tickPeriodUs,
        overflow8BitPeriodMs,
        overflow8BitFreqHz,
        overflow16BitPeriodMs,
        overflow16BitFreqHz,
        ocr8bit,
        is8bitValid,
        ocr16bit,
        is16bitValid,
        errorPct8
      };
    });
  }, [effectiveFcpu, targetIntervalMs]);

  // Determine best prescaler recommendation for targetIntervalMs
  const recommendedPrescaler = useMemo(() => {
    const valid8 = prescalerAnalysis.filter((p) => p.is8bitValid);
    if (valid8.length > 0) {
      // Pick the one with smallest error and highest resolution (smaller factor is better resolution)
      return {
        timer: '8-bit Timer0/2 (CTC 모드 권장)',
        prescaler: valid8[0],
        ocr: valid8[0].ocr8bit,
        exact: valid8[0].errorPct8 !== null && valid8[0].errorPct8 < 0.1
      };
    }
    const valid16 = prescalerAnalysis.filter((p) => p.is16bitValid);
    if (valid16.length > 0) {
      return {
        timer: '16-bit Timer1/3/4/5 (정밀 16비트 권장)',
        prescaler: valid16[0],
        ocr: valid16[0].ocr16bit,
        exact: true
      };
    }
    return null;
  }, [prescalerAnalysis]);

  // Operational Voltage & Stability Warning
  const voltageConstraint = useMemo(() => {
    const fMhz = effectiveFcpu / 1e6;
    if (selectedMCU === 'atmega328p') {
      if (fMhz > 10) return { minV: 4.5, text: '20MHz/16MHz 구동을 위해 최소 4.5V~5.5V 공급 전압이 필요합니다.' };
      if (fMhz > 4) return { minV: 2.7, text: '8MHz~10MHz 구동을 위해 최소 2.7V 이상이 필요합니다 (3.3V 표준 호환).' };
      return { minV: 1.8, text: '4MHz 이하 저속 구동 시 1.8V 최저 전압에서 구동 가능합니다.' };
    }
    if (selectedMCU === 'atmega128') {
      if (fMhz > 8) return { minV: 4.5, text: 'ATmega128A 16MHz 정격 클럭 구동 시 4.5V~5.5V 전압이 필요합니다.' };
      return { minV: 2.7, text: '8MHz 이하 구동 시 2.7V~5.5V 저전압 범위에서 구동 가능합니다.' };
    }
    // atmega640 / 2560
    if (fMhz > 8) return { minV: 4.5, text: '16MHz 최대 속도 구동을 위해 4.5V~5.5V 전압이 필요합니다.' };
    if (fMhz > 4) return { minV: 2.7, text: '8MHz 구동을 위해 2.7V 이상이 필요합니다.' };
    return { minV: 1.8, text: '4MHz 이하 구동 시 1.8V 저전압 동작이 가능합니다.' };
  }, [effectiveFcpu, selectedMCU]);

  // Generated C Initialization Snippet
  const generatedCCode = useMemo(() => {
    const clkprVal = Math.log2(clkDiv);
    const prescaler = recommendedPrescaler?.prescaler || prescalerAnalysis[2]; // default /64
    const ocrVal = recommendedPrescaler ? recommendedPrescaler.ocr : 249;

    return `// =================================================================
// ${currentProfile.name} 클럭 소스 & 타이머 분주비 C 초기화 코드
// 주파수(F_CPU): ${effectiveFcpu.toLocaleString()} Hz (${mips} MIPS)
// 클럭 소스: ${clockSource === 'external_crystal' ? '외부 크리스탈 (External Crystal)' : '내부 Calibrated RC'}
// 시스템 분주비(CLKPR): 1:${clkDiv}
// =================================================================
#include <avr/io.h>
#include <avr/interrupt.h>

#define F_CPU ${Math.round(effectiveFcpu)}UL

void System_Clock_And_Timer_Init(void) {
    // 1. CLKPR 레지스터 2단계 안전 분주비 기록 (보호 시퀀스)
    #if ${clkDiv} > 1
    CLKPR = (1 << CLKPCE); // 분주 변경 인에이블 (4사이클 유효)
    CLKPR = ${clkprVal};   // 분주비 1:${clkDiv} 기록
    #endif

    // 2. 타이머 0 설정 (주기: ${targetIntervalMs}ms 타깃, CTC 모드)
    TCCR0A = (1 << WGM01); // CTC 모드 (TOP = OCR0A)
    OCR0A  = ${ocrVal};         // 비교 일치 카운트 값
    TIMSK0 = (1 << OCIE0A); // Compare Match A 인터럽트 활성화

    // 3. 타이머 클럭 분주비 인에이블 (분주: 1/${prescaler.factor})
    TCCR0B = ${prescaler.csBits.includes('CS02') ? '(1 << CS02)' : ''}${prescaler.csBits.includes('CS01') ? (prescaler.csBits.includes('CS02') ? ' | (1 << CS01)' : '(1 << CS01)') : ''}${prescaler.csBits.includes('CS00') ? ' | (1 << CS00)' : ''};

    sei(); // 전역 인터럽트 활성화
}

// ${targetIntervalMs}ms 주기 실행 인터럽트 서비스 루틴
ISR(TIMER0_COMPA_vect) {
    // 비즈니스 로직 (단일 사이클 실행시간: ${instructionTimings.cycle1Str})
    // 1클럭 명령어 10개 수행 시 소요시간: ${(instructionTimings.cycle1Ns * 10).toFixed(1)} ns
}`;
  }, [currentProfile.name, effectiveFcpu, mips, clockSource, clkDiv, recommendedPrescaler, prescalerAnalysis, targetIntervalMs, instructionTimings]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
            <Clock className="w-3.5 h-3.5" />
            <span>Clock Architecture & Timing Simulator</span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            클럭 도메인 & 타이머 분주비 동적 시뮬레이터
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
              {currentProfile.name}
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            클럭 발진원(내부 RC vs 외부 크리스탈)과 목표 주파수를 선택하면, CPU 단일 명령어(1~4사이클)의 실제 실행 시간
            및 타이머 프리스케일러(Prescaler) 분주비별 틱 주기와 오버플로우 발생 시간을 실시간으로 연산하여 시각화합니다.
          </p>
        </div>

        {/* Real-time MIPS & Period Indicator */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center gap-4 shrink-0 font-mono">
          <div>
            <span className="text-[10px] text-slate-400 block font-sans">실효 코어 주파수</span>
            <span className="text-sm font-bold text-amber-400">
              {(effectiveFcpu / 1e6).toFixed(3)} MHz
            </span>
          </div>
          <div className="border-l border-slate-800 pl-4">
            <span className="text-[10px] text-slate-400 block font-sans">단일 클럭 주기 (1T)</span>
            <span className="text-sm font-bold text-cyan-300">
              {clockPeriodNs < 1000 ? `${clockPeriodNs.toFixed(2)} ns` : `${(clockPeriodNs / 1000).toFixed(3)} µs`}
            </span>
          </div>
        </div>
      </div>

      {/* Control Panel: Clock Source + Presets + Prescaler */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Clock Source & Frequencies (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-amber-400" /> 1. 발진 클럭 소스 (Clock Source)
            </span>
            <div className="flex gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => handleChangeSourceType('external_crystal')}
                className={`px-2.5 py-1 text-xs font-bold rounded transition-all ${
                  clockSource === 'external_crystal'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                외부 크리스탈 (Crystal)
              </button>
              <button
                onClick={() => handleChangeSourceType('internal_rc')}
                className={`px-2.5 py-1 text-xs font-bold rounded transition-all ${
                  clockSource === 'internal_rc'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                내부 RC 오실레이터 (RC Osc)
              </button>
            </div>
          </div>

          {/* Preset Buttons Grid */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 block">추천 주파수 프리셋 (Presets)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CLOCK_PRESETS.filter((p) => p.source === clockSource).map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                        : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold font-mono ${isSelected ? 'text-amber-300' : 'text-white'}`}>
                        {preset.label.split(' ')[0]}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          preset.stability === 'high'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : preset.stability === 'medium'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {preset.stability === 'high' ? '안정' : preset.stability === 'medium' ? '보통' : '드리프트'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{preset.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Frequency Direct Input */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">직접 주파수 입력 (MHz):</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.0001"
                  min="0.01"
                  max="30.0"
                  value={customFreqInput}
                  onChange={(e) => handleCustomFreqChange(e.target.value)}
                  className="w-24 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold text-center focus:outline-none focus:border-amber-400"
                />
                <span className="text-slate-500 font-mono">MHz</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400">
              정격 허용 클럭: <strong className="text-white font-mono">{currentProfile.maxFreq}</strong>
            </div>
          </div>
        </div>

        {/* Right Column: System Prescaler & Voltage Warnings (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" /> 2. 시스템 클럭 분주기 (CLKPR)
              </span>
              <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                1:{clkDiv} (CLKPR={Math.log2(clkDiv)})
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              MCU 내부의 시스템 클럭 분주기를 통해 전력 소모를 억제할 수 있습니다. (출고 시 CKDIV8 퓨즈 적용 시 1:8)
            </p>

            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 4, 8, 16, 32, 64, 128, 256].map((div) => (
                <button
                  key={div}
                  onClick={() => setClkDiv(div)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border ${
                    clkDiv === div
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  ÷{div}
                </button>
              ))}
            </div>
          </div>

          {/* Operating Voltage Safety Status Card */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> 권장 공급 전압 (VCC)
              </span>
              <span className="font-mono font-bold text-amber-400">
                VCC ≥ {voltageConstraint.minV}V
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              {voltageConstraint.text}
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Instruction Execution Time Visualization */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              명령어 실행 주기 및 지연 시간 동적 시뮬레이션 (Instruction Timings)
            </h4>
            <span className="text-xs text-slate-400">
              클럭 {mips}MHz 기준 1사이클({clockPeriodNs.toFixed(2)}ns)당 소요 시간 계산
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-slate-400">연산 성능:</span>
            <span className="text-emerald-400 font-bold">{mips} MIPS (초당 {(effectiveFcpu / 1e6).toFixed(1)}백만 회)</span>
          </div>
        </div>

        {/* Visual Timing Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1 Cycle */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300 font-mono">1-Cycle 명령어</span>
              <span className="text-xs font-bold font-mono text-white bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                {instructionTimings.cycle1Str}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              단일 클럭 연산: <code className="text-slate-200">NOP, ADD, SUB, MOV, LDI, CP, IN, OUT</code>
            </p>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-400 h-full w-[25%]" />
            </div>
            <span className="text-[10px] text-slate-500 block">초당 {(effectiveFcpu / 1e6).toFixed(1)}백만 회 실행</span>
          </div>

          {/* 2 Cycles */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-cyan-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300 font-mono">2-Cycle 명령어</span>
              <span className="text-xs font-bold font-mono text-white bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                {instructionTimings.cycle2Str}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              분기 & I/O 비트 조작: <code className="text-slate-200">SBI, CBI, RJMP, RCALL, LDS, STS</code>
            </p>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-cyan-400 h-full w-[50%]" />
            </div>
            <span className="text-[10px] text-slate-500 block">초당 {(effectiveFcpu / 2e6).toFixed(1)}백만 회 실행</span>
          </div>

          {/* 3~4 Cycles */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-purple-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 font-mono">3~4 Cycle 점프/복귀</span>
              <span className="text-xs font-bold font-mono text-white bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                {instructionTimings.cycle3Str} ~ {instructionTimings.cycle4Str}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              서브루틴 호출 및 리턴: <code className="text-slate-200">CALL, JMP, RET, RETI</code>
            </p>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-purple-400 h-full w-[75%]" />
            </div>
            <span className="text-[10px] text-slate-500 block">스택 PC 푸시/팝 소요</span>
          </div>

          {/* Interrupt Latency */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-amber-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 font-mono">하드웨어 ISR 진입 지연</span>
              <span className="text-xs font-bold font-mono text-white bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                {instructionTimings.isrLatencyStr} (최소 4T)
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              인터럽트 신호 발생 후 벡터 점프까지 최소 지연 (프롤로그 포함 총 {instructionTimings.totalIsrStr})
            </p>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-amber-400 h-full w-[100%]" />
            </div>
            <span className="text-[10px] text-slate-500 block">SREG 백업 및 컨텍스트 보존 이전</span>
          </div>
        </div>
      </div>

      {/* Dynamic Timer Prescaler Settings & Overflow Calculator */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <TimerIcon className="w-4 h-4 text-cyan-400" />
              타이머 프리스케일러(Prescaler) 분주비별 틱 해상도 및 오버플로우 주기
            </h4>
            <span className="text-xs text-slate-400">
              클럭 주파수 {mips}MHz가 타이머 카운터(TCNT) 클럭에 미치는 영향
            </span>
          </div>

          {/* Interactive Target Interval Input */}
          <div className="flex items-center gap-2.5 bg-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-300 font-medium">목표 인터럽트 주기(ms):</span>
            <input
              type="number"
              step="0.1"
              min="0.01"
              max="1000"
              value={targetIntervalMs}
              onChange={(e) => setTargetIntervalMs(Math.max(0.01, parseFloat(e.target.value) || 1.0))}
              className="w-20 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-center text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
            />
            <span className="text-slate-500 font-mono">ms ({(1000 / targetIntervalMs).toFixed(1)} Hz)</span>
          </div>
        </div>

        {/* Recommendation Callout */}
        {recommendedPrescaler && (
          <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/40 flex items-start gap-3 text-xs">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold text-cyan-300 flex items-center gap-2">
                <span>{targetIntervalMs}ms 주기를 위한 최적 분주비 추천:</span>
                <span className="font-mono bg-cyan-900/60 px-2 py-0.5 rounded text-white font-bold border border-cyan-700/60">
                  분주비 1:{recommendedPrescaler.prescaler.factor} (CS02:00 = {recommendedPrescaler.prescaler.csBits.split(' ')[0]})
                </span>
                <span className="font-mono text-amber-300">OCR = {recommendedPrescaler.ocr}</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                {recommendedPrescaler.timer}에서 TCNT가 0부터 {recommendedPrescaler.ocr}까지 카운트한 후 CTC 인터럽트를 트리거하면 정확히 {targetIntervalMs}ms 주기가 발생합니다.
              </p>
            </div>
          </div>
        )}

        {/* Prescalers Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60">
                <th className="py-2.5 px-3">분주비 (Prescaler)</th>
                <th className="py-2.5 px-3">TCCR 비트 설정</th>
                <th className="py-2.5 px-3">타이머 입력 주파수</th>
                <th className="py-2.5 px-3">단일 틱 주기 (1 Tick)</th>
                <th className="py-2.5 px-3">8비트 오버플로우 (256 카운트)</th>
                <th className="py-2.5 px-3">16비트 오버플로우 (65536 카운트)</th>
                <th className="py-2.5 px-3">{targetIntervalMs}ms 매칭 여부</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {prescalerAnalysis.map((row) => (
                <tr
                  key={row.factor}
                  className={`hover:bg-slate-900/40 transition-colors ${
                    recommendedPrescaler?.prescaler.factor === row.factor
                      ? 'bg-amber-500/5 font-semibold text-white'
                      : 'text-slate-300'
                  }`}
                >
                  <td className="py-2.5 px-3 font-bold text-amber-400">
                    ÷ {row.factor}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">
                    {row.csBits}
                  </td>
                  <td className="py-2.5 px-3">
                    {row.timerFreq >= 1000000
                      ? `${(row.timerFreq / 1000000).toFixed(3)} MHz`
                      : row.timerFreq >= 1000
                      ? `${(row.timerFreq / 1000).toFixed(2)} kHz`
                      : `${row.timerFreq.toFixed(1)} Hz`}
                  </td>
                  <td className="py-2.5 px-3 text-cyan-300">
                    {row.tickPeriodUs < 1
                      ? `${(row.tickPeriodUs * 1000).toFixed(1)} ns`
                      : `${row.tickPeriodUs.toFixed(3)} µs`}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-white font-bold">{row.overflow8BitPeriodMs.toFixed(3)} ms</span>
                    <span className="text-[10px] text-slate-500 block">({row.overflow8BitFreqHz.toFixed(1)} Hz)</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-white font-bold">
                      {row.overflow16BitPeriodMs >= 1000
                        ? `${(row.overflow16BitPeriodMs / 1000).toFixed(3)} s`
                        : `${row.overflow16BitPeriodMs.toFixed(1)} ms`}
                    </span>
                    <span className="text-[10px] text-slate-500 block">({row.overflow16BitFreqHz.toFixed(2)} Hz)</span>
                  </td>
                  <td className="py-2.5 px-3">
                    {row.is8bitValid ? (
                      <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        8-bit OCR={row.ocr8bit}
                      </span>
                    ) : row.is16bitValid ? (
                      <span className="px-2 py-0.5 rounded text-[11px] bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        16-bit OCR={row.ocr16bit}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-[11px]">범위 초과</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* C Code Generator for Clock & Timer Prescaler */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-slate-900/80 p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Binary className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white">
              C/C++ 클럭 및 타이머 초기화 펌웨어 소스코드 (Bare-Metal Init Snippet)
            </h4>
          </div>
          <button
            onClick={handleCopyCode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              copiedCode
                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            {copiedCode ? (
              <>
                <Check className="w-3.5 h-3.5" /> 복사 완료!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> 소스 복사
              </>
            )}
          </button>
        </div>

        <pre className="p-4 font-mono text-xs text-amber-300/90 overflow-x-auto leading-relaxed bg-slate-950/90">
          {generatedCCode}
        </pre>
      </div>
    </div>
  );
};
