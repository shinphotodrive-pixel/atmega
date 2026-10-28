import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  History,
  RotateCcw,
  RotateCw,
  Play,
  Pause,
  Sliders,
  Copy,
  Check,
  Sparkles,
  Cpu,
  Clock,
  Layers,
  FileCode2,
  Bookmark,
  Trash2,
  ArrowRight,
  CornerDownLeft,
  ChevronLeft,
  ChevronRight,
  Info,
  Activity,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export interface RegisterBitDef {
  index: number;
  name: string;
  desc: string;
}

export interface RegisterDef {
  name: string;
  category: string;
  description: string;
  resetValue: number;
  bits: RegisterBitDef[];
}

export interface HistorySnapshot {
  id: string;
  timestamp: string;
  elapsedSec: number;
  registerName: string;
  bitValues: Record<string, number>; // regName -> 8-bit value (0-255)
  changedReg: string;
  previousVal: number;
  newVal: number;
  label: string;
  reason: string;
}

const REGISTERS_DATABASE: Record<string, RegisterDef> = {
  TCCR0A: {
    name: 'TCCR0A',
    category: 'Timer/Counter0',
    description: 'Timer0 제어 레지스터 A (비교 출력 모드 COM0A/B 및 파형 생성 WGM01:00)',
    resetValue: 0x00,
    bits: [
      { index: 7, name: 'COM0A1', desc: 'OC0A 비교 일치 출력 모드 비트 1 (Non-inverting / Inverting)' },
      { index: 6, name: 'COM0A0', desc: 'OC0A 비교 일치 출력 모드 비트 0 (토글 또는 분리)' },
      { index: 5, name: 'COM0B1', desc: 'OC0B 비교 일치 출력 모드 비트 1' },
      { index: 4, name: 'COM0B0', desc: 'OC0B 비교 일치 출력 모드 비트 0' },
      { index: 3, name: 'Reserved', desc: '예약된 비트 (항상 0)' },
      { index: 2, name: 'Reserved', desc: '예약된 비트 (항상 0)' },
      { index: 1, name: 'WGM01', desc: '파형 생성 모드 비트 1 (Fast PWM / CTC 선택)' },
      { index: 0, name: 'WGM00', desc: '파형 생성 모드 비트 0 (Phase Correct / Fast PWM)' }
    ]
  },
  TCCR0B: {
    name: 'TCCR0B',
    category: 'Timer/Counter0',
    description: 'Timer0 제어 레지스터 B (강제 비교 FOC0A/B, WGM02 및 프리스케일러 CS02:00)',
    resetValue: 0x00,
    bits: [
      { index: 7, name: 'FOC0A', desc: '강제 비교 일치 A (Force Output Compare A)' },
      { index: 6, name: 'FOC0B', desc: '강제 비교 일치 B (Force Output Compare B)' },
      { index: 5, name: 'Reserved', desc: '예약 비트' },
      { index: 4, name: 'Reserved', desc: '예약 비트' },
      { index: 3, name: 'WGM02', desc: '파형 생성 모드 비트 2 (TOP 값 결정)' },
      { index: 2, name: 'CS02', desc: '클럭 분주비 선택 비트 2' },
      { index: 1, name: 'CS01', desc: '클럭 분주비 선택 비트 1' },
      { index: 0, name: 'CS00', desc: '클럭 분주비 선택 비트 0' }
    ]
  },
  TIMSK0: {
    name: 'TIMSK0',
    category: 'Timer/Counter0',
    description: 'Timer0 인터럽트 마스크 레지스터 (오버플로우 및 채널 A/B 비교일치 인터럽트)',
    resetValue: 0x00,
    bits: [
      { index: 7, name: 'Reserved', desc: '예약 비트' },
      { index: 6, name: 'Reserved', desc: '예약 비트' },
      { index: 5, name: 'Reserved', desc: '예약 비트' },
      { index: 4, name: 'Reserved', desc: '예약 비트' },
      { index: 3, name: 'Reserved', desc: '예약 비트' },
      { index: 2, name: 'OCIE0B', desc: 'Timer0 비교 일치 B 인터럽트 인에이블' },
      { index: 1, name: 'OCIE0A', desc: 'Timer0 비교 일치 A 인터럽트 인에이블' },
      { index: 0, name: 'TOIE0', desc: 'Timer0 오버플로우 인터럽트 인에이블' }
    ]
  },
  UCSR0B: {
    name: 'UCSR0B',
    category: 'USART0 시리얼',
    description: 'USART0 제어 및 상태 B (수신/송신 모듈 인에이블 및 인터럽트 제어)',
    resetValue: 0x00,
    bits: [
      { index: 7, name: 'RXCIE0', desc: '수신 완료 인터럽트 인에이블 (RX Complete Interrupt)' },
      { index: 6, name: 'TXCIE0', desc: '송신 완료 인터럽트 인에이블 (TX Complete Interrupt)' },
      { index: 5, name: 'UDRIE0', desc: '데이터 레지스터 빈 상태 인터럽트 (UDR Empty Interrupt)' },
      { index: 4, name: 'RXEN0', desc: '수신 하드웨어 회로 인에이블' },
      { index: 3, name: 'TXEN0', desc: '송신 하드웨어 회로 인에이블' },
      { index: 2, name: 'UCSZ02', desc: '문자 크기 비트 2 (9-bit 데이터 전송 시 1)' },
      { index: 1, name: 'RXB80', desc: '수신된 9번째 데이터 비트' },
      { index: 0, name: 'TXB80', desc: '송신할 9번째 데이터 비트' }
    ]
  },
  ADCSRA: {
    name: 'ADCSRA',
    category: '10-bit ADC',
    description: 'ADC 제어 및 상태 레지스터 A (변환 시작, 인터럽트 허용 및 ADC 클럭 프리스케일러)',
    resetValue: 0x00,
    bits: [
      { index: 7, name: 'ADEN', desc: 'ADC 전원 인에이블 (Enable ADC Module)' },
      { index: 6, name: 'ADSC', desc: '변환 시작 (Start Conversion)' },
      { index: 5, name: 'ADATE', desc: '자동 트리거 인에이블 (Auto Trigger Enable)' },
      { index: 4, name: 'ADIF', desc: 'ADC 변환 완료 인터럽트 플래그' },
      { index: 3, name: 'ADIE', desc: 'ADC 인터럽트 인에이블' },
      { index: 2, name: 'ADPS2', desc: 'ADC 클럭 분주비 비트 2' },
      { index: 1, name: 'ADPS1', desc: 'ADC 클럭 분주비 비트 1' },
      { index: 0, name: 'ADPS0', desc: 'ADC 클럭 분주비 비트 0' }
    ]
  },
  PORTB: {
    name: 'PORTB',
    category: 'GPIO 포트 B',
    description: 'Port B 데이터 레지스터 (출력 HIGH/LOW 레벨 또는 입력 모드 내부 풀업 제어)',
    resetValue: 0x00,
    bits: [
      { index: 7, name: 'PORTB7', desc: 'PB7 출력 레벨 / 풀업 제어' },
      { index: 6, name: 'PORTB6', desc: 'PB6 출력 레벨 / 풀업 제어' },
      { index: 5, name: 'PORTB5', desc: 'PB5 (Arduino D13 빌트인 LED) HIGH/LOW 제어' },
      { index: 4, name: 'PORTB4', desc: 'PB4 출력 레벨 / 풀업 제어' },
      { index: 3, name: 'PORTB3', desc: 'PB3 출력 레벨 / 풀업 제어' },
      { index: 2, name: 'PORTB2', desc: 'PB2 출력 레벨 / 풀업 제어' },
      { index: 1, name: 'PORTB1', desc: 'PB1 출력 레벨 / 풀업 제어' },
      { index: 0, name: 'PORTB0', desc: 'PB0 출력 레벨 / 풀업 제어' }
    ]
  },
  WDTCSR: {
    name: 'WDTCSR',
    category: '와치독 타이머',
    description: 'Watchdog Timer 제어 및 상태 레지스터 (타임아웃 주기, 리셋 및 인터럽트 모드)',
    resetValue: 0x00,
    bits: [
      { index: 7, name: 'WDIF', desc: '와치독 인터럽트 플래그' },
      { index: 6, name: 'WDIE', desc: '와치독 인터럽트 인에이블' },
      { index: 5, name: 'WDP3', desc: '와치독 프리스케일러 비트 3' },
      { index: 4, name: 'WDCE', desc: '와치독 변경 인에이블 (안전 시퀀스 4사이클)' },
      { index: 3, name: 'WDE', desc: '와치독 시스템 리셋 인에이블' },
      { index: 2, name: 'WDP2', desc: '와치독 프리스케일러 비트 2' },
      { index: 1, name: 'WDP1', desc: '와치독 프리스케일러 비트 1' },
      { index: 0, name: 'WDP0', desc: '와치독 프리스케일러 비트 0' }
    ]
  }
};

const INITIAL_REG_STATE: Record<string, number> = {
  TCCR0A: 0x00,
  TCCR0B: 0x00,
  TIMSK0: 0x00,
  UCSR0B: 0x00,
  ADCSRA: 0x00,
  PORTB: 0x00,
  WDTCSR: 0x00
};

export const RegisterTimelineHistory: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Currently selected register to view/edit
  const [selectedReg, setSelectedReg] = useState<string>('TCCR0A');

  // Master register current state
  const [currentRegState, setCurrentRegState] = useState<Record<string, number>>(INITIAL_REG_STATE);

  // History timeline stack
  const [history, setHistory] = useState<HistorySnapshot[]>(() => [
    {
      id: 'init_state',
      timestamp: new Date().toLocaleTimeString(),
      elapsedSec: 0,
      registerName: 'TCCR0A',
      bitValues: { ...INITIAL_REG_STATE },
      changedReg: 'ALL',
      previousVal: 0,
      newVal: 0,
      label: 'MCU 전원 인가 초기 리셋 (Power-on Reset)',
      reason: '모든 SFR 레지스터가 데이터시트 기본값 0x00으로 초기화되었습니다.'
    }
  ]);

  // Current timeline index pointing into history array
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Code copy feedback
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Active snapshot displayed on the timeline slider
  const activeSnapshot = history[historyIndex] || history[0];
  const activeRegVal = activeSnapshot.bitValues[selectedReg] ?? 0;

  // Toggle a bit in the active register
  const handleToggleBit = (bitIndex: number) => {
    const prevVal = currentRegState[selectedReg] ?? 0;
    const bitMask = 1 << bitIndex;
    const isCurrentlySet = (prevVal & bitMask) !== 0;
    const newVal = isCurrentlySet ? prevVal & ~bitMask : prevVal | bitMask;

    const bitDef = REGISTERS_DATABASE[selectedReg]?.bits.find((b) => b.index === bitIndex);
    const bitName = bitDef ? bitDef.name : `Bit${bitIndex}`;
    const nextState = { ...currentRegState, [selectedReg]: newVal };

    setCurrentRegState(nextState);

    const newSnapshot: HistorySnapshot = {
      id: `step_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      elapsedSec: history.length * 1.5,
      registerName: selectedReg,
      bitValues: nextState,
      changedReg: selectedReg,
      previousVal: prevVal,
      newVal,
      label: `${selectedReg}[${bitName}] ${isCurrentlySet ? '1 ➔ 0 해제' : '0 ➔ 1 설정'}`,
      reason: `${selectedReg}의 ${bitName} 비트가 ${isCurrentlySet ? '비활성화' : '활성화'}되었습니다. (0x${prevVal.toString(16).toUpperCase()} ➔ 0x${newVal.toString(16).toUpperCase()})`
    };

    const nextHistory = [...history.slice(0, historyIndex + 1), newSnapshot];
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  // Revert / Rollback to a specific historical snapshot
  const handleRollbackToSnapshot = (index: number) => {
    if (index < 0 || index >= history.length) return;
    const targetSnapshot = history[index];
    setHistoryIndex(index);
    setCurrentRegState({ ...targetSnapshot.bitValues });
    setSelectedReg(targetSnapshot.changedReg === 'ALL' ? 'TCCR0A' : targetSnapshot.changedReg);
  };

  // Timeline slider scrubbing
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value, 10);
    handleRollbackToSnapshot(idx);
  };

  // Step undo/redo
  const handleStepUndo = () => {
    if (historyIndex > 0) {
      handleRollbackToSnapshot(historyIndex - 1);
    }
  };

  const handleStepRedo = () => {
    if (historyIndex < history.length - 1) {
      handleRollbackToSnapshot(historyIndex + 1);
    }
  };

  // Auto-play timeline simulation
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        setHistoryIndex((prevIdx) => {
          if (prevIdx >= history.length - 1) {
            setIsPlaying(false);
            return prevIdx;
          }
          const next = prevIdx + 1;
          setCurrentRegState({ ...history[next].bitValues });
          return next;
        });
      }, 1400);
    } else {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, history]);

  // Load Preset Scenario sequences to build rich history
  const handleLoadPresetScenario = (scenarioKey: 'timer_pwm' | 'usart_rx' | 'adc_free' | 'wdt_protect') => {
    let steps: Array<{ reg: string; val: number; label: string; reason: string }> = [];

    if (scenarioKey === 'timer_pwm') {
      steps = [
        {
          reg: 'TCCR0A',
          val: 0b10000000,
          label: 'COM0A1 비트 활성화 (비반전 출력)',
          reason: 'OC0A 핀으로 비교 일치 시 0V, 오버플로우 시 5V가 출력되는 비반전 PWM 신호 경로를 연결합니다.'
        },
        {
          reg: 'TCCR0A',
          val: 0b10000011,
          label: 'WGM01, WGM00 세트 (Fast PWM 모드 3)',
          reason: '타이머를 Fast PWM (TOP=0xFF, 주기 256 카운트) 모드로 전환하여 정밀 아날로그 파형을 생성합니다.'
        },
        {
          reg: 'TCCR0B',
          val: 0b00000011,
          label: 'TCCR0B CS01, CS00 세트 (64분주 클럭)',
          reason: '16MHz 시스템 클럭을 64분주(250kHz 카운터 클럭)하여 약 976.56Hz PWM 캐리어 주파수를 확정합니다.'
        },
        {
          reg: 'TIMSK0',
          val: 0b00000001,
          label: 'TOIE0 오버플로우 인터럽트 인에이블',
          reason: '타이머가 0xFF에 도달할 때마다 ISR(TIMER0_OVF_vect)이 자동 실행되도록 마스크를 엽니다.'
        }
      ];
    } else if (scenarioKey === 'usart_rx') {
      steps = [
        {
          reg: 'UCSR0B',
          val: 0b00011000,
          label: 'RXEN0, TXEN0 활성화 (송수신 모듈 ON)',
          reason: 'USART0 하드웨어 송신부(TX)와 수신부(RX) 회로에 전원을 공급하고 물리 핀 제어권을 인수합니다.'
        },
        {
          reg: 'UCSR0B',
          val: 0b10011000,
          label: 'RXCIE0 수신 완료 인터럽트 활성화',
          reason: '1바이트 수신 시 메인 CPU 루프를 방해하지 않고 백그라운드 링버퍼로 즉시 저장하도록 인터럽트를 인가합니다.'
        }
      ];
    } else if (scenarioKey === 'adc_free') {
      steps = [
        {
          reg: 'ADCSRA',
          val: 0b10000111,
          label: 'ADEN 인에이블 & 128 분주비 설정',
          reason: 'ADC 회로를 켜고 16MHz 클럭을 128분주하여 최적 변환 클럭(125kHz, 권장 50~200kHz)을 공급합니다.'
        },
        {
          reg: 'ADCSRA',
          val: 0b11101111,
          label: 'ADSC, ADATE, ADIE 활성화 (연속 자동 샘플링)',
          reason: '첫 변환을 시작(ADSC)하고 자동 트리거(ADATE) 및 완료 인터럽트(ADIE)를 활성화하여 센서 연속 측정을 시작합니다.'
        }
      ];
    } else {
      steps = [
        {
          reg: 'WDTCSR',
          val: 0b00011000,
          label: 'WDCE, WDE 동시 세트 (안전 변경 시퀀스)',
          reason: '와치독 타이머의 오동작을 방지하는 AVR 하드웨어 4사이클 타임윈도우를 엽니다.'
        },
        {
          reg: 'WDTCSR',
          val: 0b00001111,
          label: 'WDE=1, WDP3:0 = 2초 타임아웃 확정',
          reason: '2초 동안 wdt_reset()이 호출되지 않으면 하드웨어 강제 시스템 리셋이 수행되도록 방어 코드를 적용합니다.'
        }
      ];
    }

    let runningState = { ...currentRegState };
    const newItems: HistorySnapshot[] = [];

    steps.forEach((step, idx) => {
      const prev = runningState[step.reg] ?? 0;
      runningState = { ...runningState, [step.reg]: step.val };
      newItems.push({
        id: `preset_${Date.now()}_${idx}`,
        timestamp: new Date().toLocaleTimeString(),
        elapsedSec: (history.length + idx) * 1.5,
        registerName: step.reg,
        bitValues: { ...runningState },
        changedReg: step.reg,
        previousVal: prev,
        newVal: step.val,
        label: step.label,
        reason: step.reason
      });
    });

    const combined = [...history, ...newItems];
    setHistory(combined);
    setHistoryIndex(combined.length - 1);
    setCurrentRegState(runningState);
    setSelectedReg(steps[steps.length - 1].reg);

    confetti({
      particleCount: 35,
      spread: 50,
      origin: { y: 0.7 }
    });
  };

  // Reset entire history
  const handleClearHistory = () => {
    const initialSnapshot: HistorySnapshot = {
      id: 'init_state',
      timestamp: new Date().toLocaleTimeString(),
      elapsedSec: 0,
      registerName: 'TCCR0A',
      bitValues: { ...INITIAL_REG_STATE },
      changedReg: 'ALL',
      previousVal: 0,
      newVal: 0,
      label: '히스토리 초기화 (Reset to Initial)',
      reason: '모든 히스토리가 비워지고 초기 0x00 상태로 복구되었습니다.'
    };
    setHistory([initialSnapshot]);
    setHistoryIndex(0);
    setCurrentRegState(INITIAL_REG_STATE);
  };

  // Generate C code for current active snapshot
  const generatedCInitCode = useMemo(() => {
    const lines: string[] = [
      `/* =================================================================== */`,
      `/* @brief ${currentProfile.name} SFR Configuration Snapshot (${activeSnapshot.label}) */`,
      `/* Timestamp: ${activeSnapshot.timestamp} | History Step ${historyIndex + 1}/${history.length} */`,
      `/* =================================================================== */`,
      `#include <avr/io.h>`,
      ``,
      `void restore_register_state_step${historyIndex + 1}(void) {`
    ];

    Object.entries(activeSnapshot.bitValues).forEach(([regName, val]) => {
      if (val !== 0) {
        const regDef = REGISTERS_DATABASE[regName];
        const activeBitNames: string[] = [];
        if (regDef) {
          regDef.bits.forEach((b) => {
            if (b.name !== 'Reserved' && (val & (1 << b.index)) !== 0) {
              activeBitNames.push(`(1 << ${b.name})`);
            }
          });
        }
        const macroStr = activeBitNames.length > 0 ? activeBitNames.join(' | ') : `0x${val.toString(16).padStart(2, '0').toUpperCase()}`;
        lines.push(`    ${regName} = ${macroStr}; /* 0x${val.toString(16).padStart(2, '0').toUpperCase()} */`);
      }
    });

    lines.push(`}`);
    return lines.join('\n');
  }, [activeSnapshot, historyIndex, history.length, currentProfile.name]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCInitCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Difference between active snapshot and previous snapshot
  const prevSnapshot = historyIndex > 0 ? history[historyIndex - 1] : null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl backdrop-blur-md">
      {/* 1. Header & Quick Switchers */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <History className="w-4 h-4" />
            </span>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              레지스터 타임라인 히스토리 관리자 (Register Timeline History)
            </h3>
            <span className="text-xs text-cyan-400 bg-cyan-950/60 px-2.5 py-0.5 rounded-full border border-cyan-800/40 font-mono">
              Live Undo/Redo & Time Travel
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            비트 값을 변경할 때마다 레지스터 상태가 실시간 스냅샷으로 타임라인에 기록됩니다. 타임라인 슬라이더를 드래그하여 과거의 특정 레지스터 구성으로 즉시 되돌리고 비트 변경점(Diff)을 시각적으로 추적할 수 있습니다.
          </p>
        </div>

        {/* Preset Sequence Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleLoadPresetScenario('timer_pwm')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 text-xs font-semibold transition border border-amber-800/40"
            title="Timer0 Fast PWM 설정 단계 자동 기록"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>PWM 시나리오 주입</span>
          </button>

          <button
            onClick={() => handleLoadPresetScenario('usart_rx')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-300 text-xs font-semibold transition border border-indigo-800/40"
            title="USART0 수신 인터럽트 설정 단계 자동 기록"
          >
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>USART 시나리오</span>
          </button>

          <button
            onClick={() => handleLoadPresetScenario('adc_free')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 text-xs font-semibold transition border border-emerald-800/40"
            title="ADC 연속 자동 변환 설정 단계 기록"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>ADC 시나리오</span>
          </button>

          <button
            onClick={handleClearHistory}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs transition border border-slate-800"
            title="히스토리 전체 비우기"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Interactive Timeline Slider & Playback Controls Bar */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-inner">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              타임라인 스냅샷: <strong className="text-cyan-400">{historyIndex + 1}</strong> / {history.length} 단계
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              (기록 시간: {activeSnapshot.timestamp})
            </span>
          </div>

          {/* Stepper & Playback Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleStepUndo}
              disabled={historyIndex === 0}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 text-xs font-mono transition border border-slate-800 flex items-center gap-1"
              title="이전 단계로 되돌리기 (Undo)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>이전</span>
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 shadow-sm ${
                isPlaying
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/20'
              }`}
              title={isPlaying ? '타임라인 자동 재생 정지' : '타임라인 단계별 자동 재생'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? '일시정지' : '재생'}</span>
            </button>

            <button
              onClick={handleStepRedo}
              disabled={historyIndex === history.length - 1}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 text-xs font-mono transition border border-slate-800 flex items-center gap-1"
              title="다음 단계로 진행 (Redo)"
            >
              <span>다음</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleRollbackToSnapshot(0)}
              disabled={historyIndex === 0}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-400 hover:text-white transition border border-slate-800 ml-1"
              title="최초 상태로 복구 (Revert to Start)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Timeline Range Slider */}
        <div className="space-y-1.5">
          <input
            type="range"
            min={0}
            max={Math.max(0, history.length - 1)}
            value={historyIndex}
            onChange={handleSliderChange}
            className="w-full h-2.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500 px-1">
            <span>스텝 1 (초기 리셋)</span>
            <span className="text-cyan-400 font-bold">
              현재: {activeSnapshot.label}
            </span>
            <span>최신 스텝 ({history.length})</span>
          </div>
        </div>

        {/* Active Snapshot Summary Badge Banner */}
        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-cyan-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                {activeSnapshot.label}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                {activeSnapshot.changedReg !== 'ALL' ? `${activeSnapshot.changedReg} 변경` : '전체 레지스터'}
              </span>
            </div>
            <p className="text-slate-300 text-[11px] mt-1 leading-relaxed">
              {activeSnapshot.reason}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono text-slate-400">
              16진수: <strong className="text-amber-300">0x{activeRegVal.toString(16).padStart(2, '0').toUpperCase()}</strong>
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              2진수: <strong className="text-emerald-400">{activeRegVal.toString(2).padStart(8, '0')}b</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Workstation: Register Selector + Interactive Bit Pad (Left) + Timeline Change Log (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Register Selector & Interactive Bit Toggles */}
        <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-amber-400" />
                대화형 레지스터 비트 에디터 (Interactive Bit Pad)
              </h4>
              <span className="text-[11px] text-slate-400">
                비트 버튼을 누르면 즉시 새로운 히스토리 스냅샷이 생성됩니다
              </span>
            </div>

            {/* Register Selector Dropdown */}
            <select
              value={selectedReg}
              onChange={(e) => setSelectedReg(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
            >
              {Object.keys(REGISTERS_DATABASE).map((rName) => (
                <option key={rName} value={rName}>
                  {rName} ({REGISTERS_DATABASE[rName].category})
                </option>
              ))}
            </select>
          </div>

          {/* Register Info Banner */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center justify-between font-mono">
              <span className="font-bold text-white text-sm">{selectedReg}</span>
              <span className="text-slate-400">{REGISTERS_DATABASE[selectedReg]?.category}</span>
            </div>
            <p className="text-slate-400 text-[11px] mt-0.5">
              {REGISTERS_DATABASE[selectedReg]?.description}
            </p>
          </div>

          {/* 8-Bit Interactive Buttons Matrix */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 px-1">
              <span>MSB (Bit 7)</span>
              <span>8-Bit Register Binary Controls</span>
              <span>LSB (Bit 0)</span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {REGISTERS_DATABASE[selectedReg]?.bits.map((bitDef) => {
                const bitMask = 1 << bitDef.index;
                const isSet = (activeRegVal & bitMask) !== 0;
                const isReserved = bitDef.name === 'Reserved';

                // Check if this bit was changed from previous snapshot
                const prevRegVal = prevSnapshot?.bitValues[selectedReg] ?? 0;
                const wasChanged = prevSnapshot !== null && ((prevRegVal & bitMask) !== (activeRegVal & bitMask));

                return (
                  <button
                    key={bitDef.index}
                    disabled={isReserved}
                    onClick={() => handleToggleBit(bitDef.index)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-between transition-all duration-200 select-none ${
                      isReserved
                        ? 'opacity-30 bg-slate-950 border-slate-900 cursor-not-allowed'
                        : isSet
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-500/40 hover:bg-cyan-500/30'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                    } ${wasChanged ? 'ring-2 ring-amber-400 animate-pulse' : ''}`}
                    title={bitDef.desc}
                  >
                    <span className="text-[10px] font-mono font-bold">{bitDef.name}</span>
                    <span className={`text-base font-black font-mono my-1 ${isSet ? 'text-cyan-300' : 'text-slate-500'}`}>
                      {isSet ? '1' : '0'}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">[{bitDef.index}]</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bit Field Details Table */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800 text-xs">
            {REGISTERS_DATABASE[selectedReg]?.bits.map((bitDef) => {
              const isSet = (activeRegVal & (1 << bitDef.index)) !== 0;
              return (
                <div
                  key={bitDef.index}
                  className="p-2 rounded-lg bg-slate-900/50 border border-slate-800/80 flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                        isSet ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Bit {bitDef.index}: {bitDef.name}
                    </span>
                    <span className="text-slate-400 truncate">{bitDef.desc}</span>
                  </div>
                  <span className={`font-mono font-bold shrink-0 ml-2 ${isSet ? 'text-cyan-400' : 'text-slate-500'}`}>
                    {isSet ? 'SET (1)' : 'CLEAR (0)'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Historical Snapshots Log & Rollback Buttons */}
        <div className="lg:col-span-5 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Bookmark className="w-4 h-4 text-cyan-400" />
              히스토리 스냅샷 목록 ({history.length})
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">클릭 시 해당 시점으로 복원</span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800 text-xs">
            {history.map((snap, idx) => {
              const isCurrent = idx === historyIndex;
              return (
                <div
                  key={snap.id}
                  onClick={() => handleRollbackToSnapshot(idx)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isCurrent
                      ? 'bg-cyan-950/40 border-cyan-500 ring-1 ring-cyan-500/40 shadow-md shadow-cyan-950/50'
                      : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-white flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isCurrent ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'
                        }`}
                      />
                      스텝 {idx + 1}: {snap.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{snap.timestamp}</span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed truncate">
                    {snap.reason}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] font-mono">
                    <span className="text-slate-400">
                      {snap.changedReg !== 'ALL' ? (
                        <>
                          {snap.changedReg}:{' '}
                          <span className="text-rose-400">0x{snap.previousVal.toString(16).toUpperCase()}</span> ➔{' '}
                          <span className="text-emerald-400 font-bold">0x{snap.newVal.toString(16).toUpperCase()}</span>
                        </>
                      ) : (
                        '전체 기본값'
                      )}
                    </span>
                    <span className={`font-bold ${isCurrent ? 'text-cyan-400' : 'text-slate-500'}`}>
                      {isCurrent ? '현재 활성 위치' : '이 시점으로 롤백'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Instant C Code Export for Selected Historical State */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              선택된 스냅샷(스텝 {historyIndex + 1}) 복원 C 코드 스니펫
            </h4>
          </div>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 shrink-0"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'C 코드 복사 완료!' : '복원 코드 클립보드 복사'}</span>
          </button>
        </div>

        <pre className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto max-h-40 leading-relaxed select-all">
          {generatedCInitCode}
        </pre>
      </div>
    </div>
  );
};
