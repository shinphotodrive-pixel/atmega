import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Camera,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Sliders,
  Cpu,
  Layers,
  Activity,
  Zap,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Timer,
  Terminal,
  Copy,
  Check,
  Eye,
  Bookmark,
  Trash2,
  HardDrive,
  Info,
  Flame,
  Volume2,
  ShieldCheck,
  Undo2,
  Redo2,
  History,
  Clock,
  CornerDownLeft
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
}

// Full Simulator State Snapshot
export interface SimulatorRegisters {
  DDRB: number;
  PORTB: number;
  PINB?: number;
  TCCR0A: number;
  TCCR0B: number;
  OCR0A: number;
  TIMSK0: number;
  ADCSRA: number;
  ADMUX: number;
  UCSR0B: number;
  SREG: number;
  externalPinInputs: number;
}

// Preset Snapshot Interface
export interface RegisterSnapshot {
  id: string;
  name: string;
  timestamp: string;
  description: string;
  mcu: SupportedMCU;
  registers: Omit<SimulatorRegisters, 'externalPinInputs'>;
  externalPinInputs: number;
}

// History Log Entry Interface
export interface BitHistoryEntry {
  id: string;
  stepNumber: number;
  timestamp: string;
  registerName: string;
  bitIndex?: number;
  bitName?: string;
  prevVal: number;
  newVal: number;
  actionType: 'set' | 'clear' | 'change';
  actionDesc: string;
  stateBefore: SimulatorRegisters;
  stateAfter: SimulatorRegisters;
}

const PRESET_SNAPSHOTS: Omit<RegisterSnapshot, 'id' | 'timestamp'>[] = [
  {
    name: 'LED 토글 & 풀업 입력 (GPIO 기본)',
    mcu: 'atmega328p',
    description: 'PB5 (Arduino D13 LED)를 출력 설정하고 HIGH로 켭니다. PB0~PB2는 내부 풀업 저항을 활성화하여 버튼 입력을 대기합니다.',
    registers: {
      DDRB: 0b00100000,    // PB5 Output, others Input
      PORTB: 0b00100111,   // PB5 High (LED On), PB0-PB2 Pull-up High
      PINB: 0b00100111,
      TCCR0A: 0x00,
      TCCR0B: 0x00,
      OCR0A: 0x00,
      TIMSK0: 0x00,
      ADCSRA: 0x00,
      ADMUX: 0x00,
      UCSR0B: 0x00,
      SREG: 0x80 // Global Interrupt Enabled
    },
    externalPinInputs: 0b00000111 // PB0-2 not pulled low externally
  },
  {
    name: 'Fast PWM 모드 (모터/LED 밝기 50% 듀티)',
    mcu: 'atmega328p',
    description: 'Timer0 Fast PWM 모드(WGM00/WGM01). OC0A(PD6/PB) 비반전 PWM 출력, 분주비 /64, OCR0A=128로 정확히 50% 듀티 사이클 생성.',
    registers: {
      DDRB: 0b00100000,
      PORTB: 0b00000000,
      PINB: 0b00000000,
      TCCR0A: 0b10000011,  // COM0A1=1 (Clear on match), WGM01=1, WGM00=1 (Fast PWM)
      TCCR0B: 0b00000011,  // CS01=1, CS00=1 (prescaler /64)
      OCR0A: 128,          // 50% Duty cycle (128 / 256)
      TIMSK0: 0b00000011,  // OCIE0A & TOIE0 Interrupts active
      ADCSRA: 0x00,
      ADMUX: 0x00,
      UCSR0B: 0x00,
      SREG: 0x80
    },
    externalPinInputs: 0x00
  },
  {
    name: 'ADC 연속 변환 & 전원 공급 모드',
    mcu: 'atmega328p',
    description: 'ADCSRA의 ADEN(ADC 전원 켬) 및 ADSC(변환 개시) 비트를 세트하여 아날로그 센서 입력을 주기적으로 스캔합니다.',
    registers: {
      DDRB: 0x00,
      PORTB: 0x00,
      PINB: 0x00,
      TCCR0A: 0x00,
      TCCR0B: 0x00,
      OCR0A: 0,
      TIMSK0: 0x00,
      ADCSRA: 0b11000111,  // ADEN=1, ADSC=1, Prescaler 128
      ADMUX: 0b01000000,   // AVcc ref, ADC0 channel
      UCSR0B: 0x00,
      SREG: 0x80
    },
    externalPinInputs: 0x00
  },
  {
    name: 'USART RX/TX 통신 활성화',
    mcu: 'atmega328p',
    description: 'UCSR0B의 RXCIE, RXEN, TXEN 비트를 활성화하여 시리얼 통신 인터럽트 수신 및 전송 링버퍼 송출을 대기합니다.',
    registers: {
      DDRB: 0b00100000,
      PORTB: 0x00,
      PINB: 0x00,
      TCCR0A: 0x00,
      TCCR0B: 0x00,
      OCR0A: 0,
      TIMSK0: 0x00,
      ADCSRA: 0x00,
      ADMUX: 0x00,
      UCSR0B: 0b10011000,  // RXCIE=1, RXEN=1, TXEN=1
      SREG: 0x80
    },
    externalPinInputs: 0x00
  }
];

export const RegisterSnapshotSimulator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Active Register State
  const [ddrb, setDdrb] = useState<number>(0b00100000); // PB5 Output
  const [portb, setPortb] = useState<number>(0b00100111); // PB5 High, PB0-2 Pullup
  const [externalPinInputs, setExternalPinInputs] = useState<number>(0b00000111); // external driven levels

  // Timer 0 Registers
  const [tccr0a, setTccr0a] = useState<number>(0b10000011); // Fast PWM COM0A1=1, WGM01:00=3
  const [tccr0b, setTccr0b] = useState<number>(0b00000011); // CS01:00 = 3 (/64)
  const [ocr0a, setOcr0a] = useState<number>(128);
  const [timsk0, setTimsk0] = useState<number>(0b00000001); // TOIE0

  // ADC Registers
  const [adcsra, setAdcsra] = useState<number>(0b10000111); // ADEN=1, Prescaler=128
  const [admux, setAdmux] = useState<number>(0b01000000);   // AVcc ref, ADC0

  // USART Register
  const [ucsr0b, setUcsr0b] = useState<number>(0b10011000); // RXCIE, RXEN, TXEN

  // CPU SREG
  const [sreg, setSreg] = useState<number>(0b10000000); // I-bit enabled

  // Simulation Running State
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1); // 1x, 2x, 5x
  const [simClockTick, setSimClockTick] = useState<number>(0);
  const [tcnt0, setTcnt0] = useState<number>(0);
  const [oc0aOutput, setOc0aOutput] = useState<boolean>(false);
  const [timerOverflowCount, setTimerOverflowCount] = useState<number>(0);
  const [lastInterruptTriggered, setLastInterruptTriggered] = useState<string | null>(null);

  // Bit Manipulation History & Undo / Redo
  const [history, setHistory] = useState<BitHistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [copiedLog, setCopiedLog] = useState<boolean>(false);
  const historyListRef = useRef<HTMLDivElement>(null);

  // Saved Snapshots in Local State
  const [snapshots, setSnapshots] = useState<RegisterSnapshot[]>(() => {
    return PRESET_SNAPSHOTS.map((p, idx) => ({
      ...p,
      id: `preset-${idx}`,
      timestamp: '기본 프리셋'
    }));
  });

  const [snapshotName, setSnapshotName] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Package current state into a snapshot object
  const getCurrentSnapshot = (): SimulatorRegisters => ({
    DDRB: ddrb,
    PORTB: portb,
    TCCR0A: tccr0a,
    TCCR0B: tccr0b,
    OCR0A: ocr0a,
    TIMSK0: timsk0,
    ADCSRA: adcsra,
    ADMUX: admux,
    UCSR0B: ucsr0b,
    SREG: sreg,
    externalPinInputs
  });

  // Restore an arbitrary state into registers
  const restoreSimulatorState = (state: SimulatorRegisters) => {
    setDdrb(state.DDRB);
    setPortb(state.PORTB);
    setExternalPinInputs(state.externalPinInputs ?? 0);
    setTccr0a(state.TCCR0A);
    setTccr0b(state.TCCR0B);
    setOcr0a(state.OCR0A);
    setTimsk0(state.TIMSK0);
    setAdcsra(state.ADCSRA);
    setAdmux(state.ADMUX);
    setUcsr0b(state.UCSR0B);
    setSreg(state.SREG);
  };

  // Central record & apply helper for bit modifications
  const applyChange = (
    entryMeta: {
      registerName: string;
      bitIndex?: number;
      bitName?: string;
      prevVal: number;
      newVal: number;
      actionType: 'set' | 'clear' | 'change';
      actionDesc: string;
    },
    statePatch: Partial<SimulatorRegisters>
  ) => {
    const stateBefore = getCurrentSnapshot();
    const stateAfter: SimulatorRegisters = {
      ...stateBefore,
      ...statePatch
    };

    // Apply the patch to react state
    if (statePatch.DDRB !== undefined) setDdrb(statePatch.DDRB);
    if (statePatch.PORTB !== undefined) setPortb(statePatch.PORTB);
    if (statePatch.externalPinInputs !== undefined) setExternalPinInputs(statePatch.externalPinInputs);
    if (statePatch.TCCR0A !== undefined) setTccr0a(statePatch.TCCR0A);
    if (statePatch.TCCR0B !== undefined) setTccr0b(statePatch.TCCR0B);
    if (statePatch.OCR0A !== undefined) setOcr0a(statePatch.OCR0A);
    if (statePatch.TIMSK0 !== undefined) setTimsk0(statePatch.TIMSK0);
    if (statePatch.ADCSRA !== undefined) setAdcsra(statePatch.ADCSRA);
    if (statePatch.ADMUX !== undefined) setAdmux(statePatch.ADMUX);
    if (statePatch.UCSR0B !== undefined) setUcsr0b(statePatch.UCSR0B);
    if (statePatch.SREG !== undefined) setSreg(statePatch.SREG);

    // Truncate any redo entries ahead of current history index
    const truncatedHistory = history.slice(0, historyIndex + 1);
    const newStepNumber = truncatedHistory.length + 1;
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;

    const newEntry: BitHistoryEntry = {
      id: `hist-${Date.now()}-${Math.random()}`,
      stepNumber: newStepNumber,
      timestamp: timeStr,
      ...entryMeta,
      stateBefore,
      stateAfter
    };

    const nextHistory = [...truncatedHistory, newEntry];
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  // Undo Handler
  const handleUndo = () => {
    if (historyIndex < 0) return;
    const entryToUndo = history[historyIndex];
    restoreSimulatorState(entryToUndo.stateBefore);
    setHistoryIndex((prev) => prev - 1);
  };

  // Redo Handler
  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    const entryToRedo = history[historyIndex + 1];
    restoreSimulatorState(entryToRedo.stateAfter);
    setHistoryIndex((prev) => prev + 1);
  };

  // Jump directly to a historical state
  const handleJumpToHistory = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= history.length) return;
    const targetEntry = history[targetIndex];
    restoreSimulatorState(targetEntry.stateAfter);
    setHistoryIndex(targetIndex);
  };

  // Clear History
  const handleClearHistory = () => {
    setHistory([]);
    setHistoryIndex(-1);
  };

  // Export / Copy History Log
  const handleCopyHistory = () => {
    if (history.length === 0) return;
    const textLines = history.map((h, i) => {
      const marker = i === historyIndex ? '▶ (현재 위치)' : ' ';
      return `${marker} [#${h.stepNumber}] [${h.timestamp}] [${h.registerName}${h.bitName ? `.${h.bitName}` : ''}] ${h.actionType.toUpperCase()}: ${h.actionDesc} (0x${h.prevVal.toString(16)} -> 0x${h.newVal.toString(16)})`;
    });
    navigator.clipboard.writeText(textLines.join('\n'));
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  // Keyboard shortcut listener for Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  // Derive Actual Physical Pin States: PINB
  const pinb = useMemo(() => {
    let result = 0;
    for (let i = 0; i < 8; i++) {
      const isOutput = (ddrb & (1 << i)) !== 0;
      if (isOutput) {
        if (portb & (1 << i)) {
          result |= (1 << i);
        }
      } else {
        const isPullUp = (portb & (1 << i)) !== 0;
        const ext = (externalPinInputs & (1 << i)) !== 0;
        if (isPullUp) {
          if (ext) {
            result |= (1 << i);
          }
        } else {
          if (ext) {
            result |= (1 << i);
          }
        }
      }
    }
    return result;
  }, [ddrb, portb, externalPinInputs]);

  // Decode Timer 0 Mode
  const timerPrescalerDiv = useMemo(() => {
    const cs = tccr0b & 0x07;
    switch (cs) {
      case 0b001: return 1;
      case 0b010: return 8;
      case 0b011: return 64;
      case 0b100: return 256;
      case 0b101: return 1024;
      default: return 0; // stopped
    }
  }, [tccr0b]);

  const timerWgm = useMemo(() => {
    const wgm0 = (tccr0a & 0x01);
    const wgm1 = (tccr0a & 0x02) >> 1;
    const wgm2 = (tccr0b & 0x08) >> 3;
    const val = (wgm2 << 2) | (wgm1 << 1) | wgm0;
    switch (val) {
      case 0: return { mode: 'Normal', top: 255, desc: '0 ~ 255 일반 카운터' };
      case 1: return { mode: 'Phase Correct PWM', top: 255, desc: '대칭 PWM (모터 제어 특화)' };
      case 2: return { mode: 'CTC', top: ocr0a, desc: 'Clear Timer on Compare Match' };
      case 3: return { mode: 'Fast PWM', top: 255, desc: '고속 PWM (0~255 단방향 톱니파)' };
      case 7: return { mode: 'Fast PWM (OCR0A Top)', top: ocr0a, desc: 'OCR0A가 주파수 결정' };
      default: return { mode: `Mode ${val}`, top: 255, desc: '기타 타이머 모드' };
    }
  }, [tccr0a, tccr0b, ocr0a]);

  // Timer Simulation Loop
  useEffect(() => {
    if (!isRunning || timerPrescalerDiv === 0) return;

    const intervalTime = Math.max(16, Math.floor(100 / simSpeed));
    const interval = setInterval(() => {
      setSimClockTick((prev) => prev + 1);

      setTcnt0((prevTcnt) => {
        let next = prevTcnt + 1;
        const top = timerWgm.top || 255;

        // Compare match
        if (next === ocr0a) {
          const com0a = (tccr0a >> 6) & 0x03;
          if (com0a === 2) {
            setOc0aOutput(false);
          } else if (com0a === 3) {
            setOc0aOutput(true);
          } else if (com0a === 1) {
            setOc0aOutput((prev) => !prev);
          }

          if ((timsk0 & 0x02) && (sreg & 0x80)) {
            setLastInterruptTriggered(`TIMER0_COMPA (TCNT0 = OCR0A = ${ocr0a})`);
          }
        }

        // Overflow condition
        if (next > top) {
          next = 0;
          setTimerOverflowCount((c) => c + 1);

          const com0a = (tccr0a >> 6) & 0x03;
          if (com0a === 2) {
            setOc0aOutput(true);
          } else if (com0a === 3) {
            setOc0aOutput(false);
          }

          if ((timsk0 & 0x01) && (sreg & 0x80)) {
            setLastInterruptTriggered('TIMER0_OVF (오버플로우 0xFF -> 0x00)');
          }
        }

        return next;
      });
    }, intervalTime);

    return () => clearInterval(interval);
  }, [isRunning, timerPrescalerDiv, simSpeed, timerWgm, ocr0a, tccr0a, timsk0, sreg]);

  // Handle Save Current State as Snapshot
  const handleSaveSnapshot = () => {
    const title = snapshotName.trim() || `스냅샷 #${snapshots.length + 1}`;
    const newSnap: RegisterSnapshot = {
      id: `snap-${Date.now()}`,
      name: title,
      timestamp: new Date().toLocaleTimeString(),
      description: `사용자 정의 스냅샷 (DDRB=0x${ddrb.toString(16)}, PORTB=0x${portb.toString(16)}, TCCR0A=0x${tccr0a.toString(16)})`,
      mcu: selectedMCU,
      registers: {
        DDRB: ddrb,
        PORTB: portb,
        PINB: pinb,
        TCCR0A: tccr0a,
        TCCR0B: tccr0b,
        OCR0A: ocr0a,
        TIMSK0: timsk0,
        ADCSRA: adcsra,
        ADMUX: admux,
        UCSR0B: ucsr0b,
        SREG: sreg
      },
      externalPinInputs
    };

    setSnapshots([newSnap, ...snapshots]);
    setSnapshotName('');
    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.3 }
    });
  };

  // Restore snapshot
  const handleRestoreSnapshot = (snap: RegisterSnapshot) => {
    const stateToRestore: SimulatorRegisters = {
      ...snap.registers,
      externalPinInputs: snap.externalPinInputs
    };
    applyChange({
      registerName: 'SNAPSHOT',
      bitName: snap.name,
      prevVal: 0,
      newVal: 0,
      actionType: 'change',
      actionDesc: `스냅샷 프리셋 [${snap.name}] 전체 레지스터 상태 복원`
    }, stateToRestore);

    setTcnt0(0);
    setTimerOverflowCount(0);
    setLastInterruptTriggered(null);
  };

  const handleDeleteSnapshot = (id: string) => {
    setSnapshots(snapshots.filter((s) => s.id !== id));
  };

  // C code representation
  const generatedCInit = useMemo(() => {
    return `// ==============================================================================
// ${currentProfile.name} 하드웨어 레지스터 스냅샷 C 초기화 루틴
// ==============================================================================
#include <avr/io.h>
#include <avr/interrupt.h>

void hardware_snapshot_init(void) {
    // 1. GPIO Port B 입출력 및 풀업 상태 반영
    DDRB  = 0x${ddrb.toString(16).padStart(2, '0').toUpperCase()}; // 0b${ddrb.toString(2).padStart(8, '0')} (출력 핀 마스크)
    PORTB = 0x${portb.toString(16).padStart(2, '0').toUpperCase()}; // 0b${portb.toString(2).padStart(8, '0')} (HIGH 출력 및 내부 풀업)

    // 2. 8비트 Timer/Counter0 설정 (${timerWgm.mode}, 분주비 ${timerPrescalerDiv > 0 ? `/${timerPrescalerDiv}` : '정지'})
    TCCR0A = 0x${tccr0a.toString(16).padStart(2, '0').toUpperCase()};
    TCCR0B = 0x${tccr0b.toString(16).padStart(2, '0').toUpperCase()};
    OCR0A  = 0x${ocr0a.toString(16).padStart(2, '0').toUpperCase()}; // 비교 일치 기준값: ${ocr0a}
    TIMSK0 = 0x${timsk0.toString(16).padStart(2, '0').toUpperCase()}; // 인터럽트 마스크

    // 3. 아날로그 ADC 변환기 제어
    ADMUX  = 0x${admux.toString(16).padStart(2, '0').toUpperCase()};
    ADCSRA = 0x${adcsra.toString(16).padStart(2, '0').toUpperCase()};

    // 4. USART0 비동기 시리얼 통신
    UCSR0B = 0x${ucsr0b.toString(16).padStart(2, '0').toUpperCase()};

    // 5. 전역 인터럽트 활성화
    ${sreg & 0x80 ? 'sei(); // SREG I-bit 활성화' : 'cli(); // SREG I-bit 차단'}
}
`;
  }, [currentProfile.name, ddrb, portb, timerWgm, timerPrescalerDiv, tccr0a, tccr0b, ocr0a, timsk0, admux, adcsra, ucsr0b, sreg]);

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCInit);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Specific Bit Change Handlers
  const toggleDdrbBit = (bit: number) => {
    const isSet = (ddrb & (1 << bit)) !== 0;
    const next = ddrb ^ (1 << bit);
    const isNowSet = !isSet;
    applyChange({
      registerName: 'DDRB',
      bitIndex: bit,
      bitName: `PB${bit}`,
      prevVal: ddrb,
      newVal: next,
      actionType: isNowSet ? 'set' : 'clear',
      actionDesc: `DDRB.${bit} (PB${bit}) 핀을 ${isNowSet ? '출력 모드(Output: 1)' : '입력 모드(Input: 0)'}로 전환`
    }, { DDRB: next });
  };

  const togglePortbBit = (bit: number) => {
    const isSet = (portb & (1 << bit)) !== 0;
    const next = portb ^ (1 << bit);
    const isNowSet = !isSet;
    const isOutput = (ddrb & (1 << bit)) !== 0;
    const desc = isOutput
      ? `PORTB.${bit} (PB${bit}) 출력을 ${isNowSet ? 'HIGH (5V/VCC)' : 'LOW (0V/GND)'}로 변경`
      : `PORTB.${bit} (PB${bit}) 내부 풀업 저항을 ${isNowSet ? '활성화 (Pull-up ON: 40kΩ)' : '비활성화 (Hi-Z 고임피던스 플로팅)'}함`;

    applyChange({
      registerName: 'PORTB',
      bitIndex: bit,
      bitName: `PB${bit}`,
      prevVal: portb,
      newVal: next,
      actionType: isNowSet ? 'set' : 'clear',
      actionDesc: desc
    }, { PORTB: next });
  };

  const toggleExtPin = (bit: number) => {
    const isSet = (externalPinInputs & (1 << bit)) !== 0;
    const next = externalPinInputs ^ (1 << bit);
    const isNowSet = !isSet;
    applyChange({
      registerName: 'EXT_PIN',
      bitIndex: bit,
      bitName: `EXT_PB${bit}`,
      prevVal: externalPinInputs,
      newVal: next,
      actionType: isNowSet ? 'set' : 'clear',
      actionDesc: `외부 하드웨어 스위치 PB${bit}에 ${isNowSet ? 'VCC (논리 1)' : 'GND (논리 0)'} 신호 인가`
    }, { externalPinInputs: next });
  };

  const changeOcr0a = (val: number) => {
    applyChange({
      registerName: 'OCR0A',
      bitName: 'OCR0A',
      prevVal: ocr0a,
      newVal: val,
      actionType: 'change',
      actionDesc: `타이머0 비교 일치 OCR0A를 ${val} (듀티 ${((val / 256) * 100).toFixed(1)}%)로 조정`
    }, { OCR0A: val });
  };

  const changePrescaler = (cs: number) => {
    const next = (tccr0b & ~0x07) | cs;
    const names: Record<number, string> = {
      0: '정지 (클럭 차단)',
      1: '분주 없음 (/1)',
      2: '8분주 (/8)',
      3: '64분주 (/64)',
      4: '256분주 (/256)',
      5: '1024분주 (/1024)'
    };
    applyChange({
      registerName: 'TCCR0B',
      bitName: 'CS02:00',
      prevVal: tccr0b,
      newVal: next,
      actionType: 'change',
      actionDesc: `TCCR0B 클럭 분주비를 [${names[cs] || cs}]로 변경`
    }, { TCCR0B: next });
  };

  const changeCom0a = (com: number) => {
    const next = (tccr0a & ~(0x03 << 6)) | (com << 6);
    const names: Record<number, string> = {
      0: '일반 핀 (OC0A 비활성)',
      1: '비교 일치 시 토글 (Toggle)',
      2: '비반전 고속 PWM (Clear on match)',
      3: '반전 고속 PWM (Set on match)'
    };
    applyChange({
      registerName: 'TCCR0A',
      bitName: 'COM0A1:00',
      prevVal: tccr0a,
      newVal: next,
      actionType: 'change',
      actionDesc: `TCCR0A OC0A 출력 핀 모드를 [${names[com]}]로 변경`
    }, { TCCR0A: next });
  };

  const toggleTimsk0Bit = (mask: number, name: string, desc: string) => {
    const isSet = (timsk0 & mask) !== 0;
    const next = isSet ? (timsk0 & ~mask) : (timsk0 | mask);
    const isNowSet = !isSet;
    applyChange({
      registerName: 'TIMSK0',
      bitName: name,
      prevVal: timsk0,
      newVal: next,
      actionType: isNowSet ? 'set' : 'clear',
      actionDesc: `TIMSK0.${name} (${desc}) 인터럽트 ${isNowSet ? '인에이블 허용' : '디스에이블 차단'}`
    }, { TIMSK0: next });
  };

  const toggleSregI = () => {
    const next = sreg ^ 0x80;
    const isNowSet = (next & 0x80) !== 0;
    applyChange({
      registerName: 'SREG',
      bitIndex: 7,
      bitName: 'I-bit',
      prevVal: sreg,
      newVal: next,
      actionType: isNowSet ? 'set' : 'clear',
      actionDesc: `CPU SREG.${isNowSet ? 'I-bit 활성화 (sei() 전역 인터럽트 허용)' : 'I-bit 차단 (cli() 전역 인터럽트 금지)'}`
    }, { SREG: next });
  };

  const toggleAdcsraBit = (mask: number, name: string, desc: string) => {
    const isSet = (adcsra & mask) !== 0;
    const next = isSet ? (adcsra & ~mask) : (adcsra | mask);
    const isNowSet = !isSet;
    applyChange({
      registerName: 'ADCSRA',
      bitName: name,
      prevVal: adcsra,
      newVal: next,
      actionType: isNowSet ? 'set' : 'clear',
      actionDesc: `ADCSRA.${name} (${desc}) ${isNowSet ? '활성화 (ON)' : '비활성화 (OFF)'}`
    }, { ADCSRA: next });
  };

  const toggleUcsr0bBit = (mask: number, name: string, desc: string) => {
    const isSet = (ucsr0b & mask) !== 0;
    const next = isSet ? (ucsr0b & ~mask) : (ucsr0b | mask);
    const isNowSet = !isSet;
    applyChange({
      registerName: 'UCSR0B',
      bitName: name,
      prevVal: ucsr0b,
      newVal: next,
      actionType: isNowSet ? 'set' : 'clear',
      actionDesc: `UCSR0B.${name} (${desc}) ${isNowSet ? '활성화 (ON)' : '비활성화 (OFF)'}`
    }, { UCSR0B: next });
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Title Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-400 text-xs font-semibold">
              <Camera className="w-3.5 h-3.5" /> 레지스터 스냅샷 시뮬레이터 (Register Snapshot Simulator)
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              MCU: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-mono">
              Live Interactive Engine
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            실시간 레지스터-하드웨어 동작 연동 시뮬레이터
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            비트 단위로 조작한 레지스터(DDRx, PORTx, PINx, TCCRx, OCRx, ADCSRA 등)의 상태가 실제 MCU 핀 출력,
            내부 풀업 저항, 타이머 PWM 파형 생성 및 오버플로우 인터럽트 트리거에 미치는 영향을 실시간 인터랙티브 시뮬레이션으로 확인하세요.
          </p>
        </div>

        {/* Global Controls & Speed */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition shadow-md ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
            }`}
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isRunning ? '시뮬레이션 일시정지' : '시뮬레이션 재개'}</span>
          </button>

          <div className="flex items-center bg-slate-950 rounded-xl p-1 border border-slate-800 text-xs font-mono">
            {[1, 2, 5].map((speed) => (
              <button
                key={speed}
                onClick={() => setSimSpeed(speed)}
                className={`px-2.5 py-1 rounded-lg transition font-bold ${
                  simSpeed === speed ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setTcnt0(0);
              setTimerOverflowCount(0);
              setLastInterruptTriggered(null);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700"
            title="타이머 및 카운터 초기화"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Snapshot Library & Quick Presets */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-violet-400" />
            <h3 className="text-xs sm:text-sm font-bold text-white">레지스터 시나리오 스냅샷 프리셋 및 저장</h3>
          </div>

          {/* Save snapshot input */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <input
              type="text"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder="현재 상태 스냅샷 이름 지정..."
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-violet-500 flex-1 sm:w-56"
            />
            <button
              onClick={handleSaveSnapshot}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shrink-0 shadow-md shadow-violet-600/20"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>현재 상태 캡처</span>
            </button>
          </div>
        </div>

        {/* Snapshots chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          {snapshots.map((snap) => (
            <div
              key={snap.id}
              className="inline-flex items-center gap-2 bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-violet-500/50 rounded-xl px-3 py-1.5 text-xs transition group"
            >
              <button
                onClick={() => handleRestoreSnapshot(snap)}
                className="text-left flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-violet-400 group-hover:scale-125 transition-transform" />
                <span className="font-semibold text-slate-200 group-hover:text-white">{snap.name}</span>
                <span className="text-[10px] text-slate-500 font-mono">({snap.timestamp})</span>
              </button>

              {!snap.id.startsWith('preset-') && (
                <button
                  onClick={() => handleDeleteSnapshot(snap.id)}
                  className="text-slate-500 hover:text-rose-400 ml-1 p-0.5 rounded transition"
                  title="스냅샷 삭제"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 비트 조작 히스토리 로거 & Undo/Redo 패널 */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 lg:p-5 space-y-4 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-64 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />

        {/* Top bar with Undo / Redo buttons & meta info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
              <History className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  비트 조작 히스토리 로거 & 시간 여행 (Undo / Redo)
                </h3>
                <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 rounded-full text-[10px] font-mono font-bold">
                  {history.length}건 기록됨
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                레지스터 비트 변경 사항이 실시간으로 기록되며, 단축키 <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-mono text-[10px]">Ctrl+Z</kbd> (Undo) 및 <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-mono text-[10px]">Ctrl+Y</kbd> (Redo)로 상태를 되돌릴 수 있습니다.
              </p>
            </div>
          </div>

          {/* Undo / Redo Buttons & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleUndo}
              disabled={historyIndex < 0}
              title={
                historyIndex >= 0
                  ? `Undo: [${history[historyIndex].registerName}] ${history[historyIndex].actionDesc}`
                  : '되돌릴 이전 조작이 없습니다'
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                historyIndex >= 0
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600 shadow-sm active:scale-95'
                  : 'bg-slate-900/50 text-slate-600 border-slate-800/80 cursor-not-allowed'
              }`}
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>실행 취소 (Undo)</span>
            </button>

            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title={
                historyIndex < history.length - 1
                  ? `Redo: [${history[historyIndex + 1].registerName}] ${history[historyIndex + 1].actionDesc}`
                  : '다시 실행할 조작이 없습니다'
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                historyIndex < history.length - 1
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500 shadow-sm active:scale-95'
                  : 'bg-slate-900/50 text-slate-600 border-slate-800/80 cursor-not-allowed'
              }`}
            >
              <span>다시 실행 (Redo)</span>
              <Redo2 className="w-3.5 h-3.5" />
            </button>

            {history.length > 0 && (
              <>
                <button
                  onClick={handleCopyHistory}
                  title="히스토리 전체 로그 복사"
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition"
                >
                  {copiedLog ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={handleClearHistory}
                  title="히스토리 전체 지우기"
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 border border-slate-700 text-xs transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Scrollable History Log List */}
        <div
          ref={historyListRef}
          className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar"
        >
          {history.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-xs font-mono bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
              <Sparkles className="w-4 h-4 mx-auto mb-1 text-slate-600" />
              레지스터 비트(DDRB, PORTB, TCCR0A, SREG 등)를 토글하거나 슬라이더를 조작하면
              <br />
              실시간 비트 변경 이력이 여기에 타임스탬프와 함께 자동 기록됩니다.
            </div>
          ) : (
            history.map((entry, idx) => {
              const isCurrent = idx === historyIndex;
              const isPast = idx < historyIndex;
              const isFuture = idx > historyIndex;

              return (
                <div
                  key={entry.id}
                  onClick={() => handleJumpToHistory(idx)}
                  className={`p-2.5 rounded-xl border text-xs font-mono transition flex items-center justify-between gap-3 cursor-pointer group ${
                    isCurrent
                      ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-md shadow-cyan-950/30 ring-1 ring-cyan-500/40'
                      : isPast
                      ? 'bg-slate-900/60 hover:bg-slate-850 border-slate-800/80 text-slate-300'
                      : 'bg-slate-950/40 border-slate-900 text-slate-500 opacity-60 hover:opacity-90'
                  }`}
                >
                  {/* Left: Step number, Dot indicator, timestamp & badges */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isCurrent
                          ? 'bg-cyan-400 ring-4 ring-cyan-400/20 animate-pulse'
                          : isPast
                          ? 'bg-slate-500'
                          : 'bg-slate-700'
                      }`}
                    />

                    <span className="text-[10px] text-slate-500 font-bold shrink-0">
                      #{entry.stepNumber}
                    </span>

                    <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-slate-500" />
                      {entry.timestamp}
                    </span>

                    {/* Register & Bit Badge */}
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] shrink-0 bg-slate-800 border border-slate-700 text-white">
                      {entry.registerName}
                      {entry.bitName && entry.bitName !== entry.registerName ? `.${entry.bitName}` : ''}
                    </span>

                    {/* Action Type Badge (SET / CLR / VAL) */}
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase shrink-0 border ${
                        entry.actionType === 'set'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : entry.actionType === 'clear'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      }`}
                    >
                      {entry.actionType}
                    </span>

                    {/* Description of change */}
                    <span className="text-[11px] truncate text-slate-300 font-sans group-hover:text-white">
                      {entry.actionDesc}
                    </span>
                  </div>

                  {/* Right: State values & Jump button */}
                  <div className="flex items-center gap-2 shrink-0 text-[10px]">
                    <span className="text-slate-500">
                      0x{entry.prevVal.toString(16).padStart(2, '0').toUpperCase()} →{' '}
                      <span className="font-bold text-cyan-300">
                        0x{entry.newVal.toString(16).padStart(2, '0').toUpperCase()}
                      </span>
                    </span>

                    {isCurrent ? (
                      <span className="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 font-bold text-[9px]">
                        현재 시점
                      </span>
                    ) : (
                      <span className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-cyan-300 flex items-center gap-1 text-[10px] transition">
                        <CornerDownLeft className="w-3 h-3" /> 복원
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Simulation Panel: Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Register Bit Manipulators */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" /> 특수기능 레지스터(SFR) 비트 제어판
            </span>
            <span className="text-[11px] text-slate-400">비트 버튼을 클릭하여 즉시 토글</span>
          </div>

          {/* 1. GPIO Port B: DDRB, PORTB */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" /> GPIO Port B (입출력 방향 & 풀업 저항)
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                DDRB: 0x{ddrb.toString(16).padStart(2, '0').toUpperCase()} | PORTB: 0x{portb.toString(16).padStart(2, '0').toUpperCase()}
              </span>
            </div>

            {/* DDRB Bit Array */}
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span className="font-mono text-cyan-400">DDRB (0: 입력, 1: 출력):</span>
                <span className="text-[10px] text-slate-500">MSB (PB7) ~ LSB (PB0)</span>
              </div>
              <div className="grid grid-cols-8 gap-1 font-mono text-xs text-center">
                {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => {
                  const isSet = (ddrb & (1 << bit)) !== 0;
                  return (
                    <button
                      key={bit}
                      onClick={() => toggleDdrbBit(bit)}
                      className={`py-1.5 rounded-lg border font-bold transition flex flex-col items-center ${
                        isSet
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <span className="text-[9px] text-slate-400 font-sans">PB{bit}</span>
                      <span>{isSet ? '1' : '0'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PORTB Bit Array */}
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span className="font-mono text-amber-400">PORTB (출력 HIGH/LOW 또는 풀업 ON/OFF):</span>
                <span className="text-[10px] text-slate-500">출력 모드 시 핀 전압, 입력 모드 시 풀업</span>
              </div>
              <div className="grid grid-cols-8 gap-1 font-mono text-xs text-center">
                {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => {
                  const isSet = (portb & (1 << bit)) !== 0;
                  return (
                    <button
                      key={bit}
                      onClick={() => togglePortbBit(bit)}
                      className={`py-1.5 rounded-lg border font-bold transition flex flex-col items-center ${
                        isSet
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <span className="text-[9px] text-slate-400 font-sans">PB{bit}</span>
                      <span>{isSet ? '1' : '0'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* External Physical Pin Driving (Simulating Button/External Logic) */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span className="font-mono text-purple-300 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> 외부 하드웨어 신호 인가 (스위치/센서 레벨):
                </span>
                <span className="text-[10px] text-slate-500">입력 핀에 GND/VCC 연결 시뮬레이션</span>
              </div>
              <div className="grid grid-cols-8 gap-1 font-mono text-xs text-center">
                {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => {
                  const isDrivenHigh = (externalPinInputs & (1 << bit)) !== 0;
                  const isOutput = (ddrb & (1 << bit)) !== 0;
                  return (
                    <button
                      key={bit}
                      disabled={isOutput}
                      onClick={() => toggleExtPin(bit)}
                      className={`py-1 rounded-lg border text-[11px] font-bold transition flex flex-col items-center ${
                        isOutput
                          ? 'bg-slate-950 border-slate-900 text-slate-700 cursor-not-allowed'
                          : isDrivenHigh
                          ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                          : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'
                      }`}
                    >
                      <span className="text-[8px] text-slate-400">EXT</span>
                      <span>{isOutput ? '출력' : isDrivenHigh ? 'VCC' : 'GND'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. Timer/Counter 0: TCCR0A, TCCR0B, OCR0A, TIMSK0 */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5" /> 8-bit Timer/Counter 0 (PWM & CTC)
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                모드: <strong className="text-white">{timerWgm.mode}</strong> (분주: {timerPrescalerDiv > 0 ? `/${timerPrescalerDiv}` : 'OFF'})
              </span>
            </div>

            {/* OCR0A Slider */}
            <div>
              <div className="flex justify-between items-center text-[11px] mb-1 font-mono">
                <span className="text-slate-300 font-semibold">OCR0A (비교 일치 레지스터):</span>
                <span className="text-amber-400 font-bold">
                  {ocr0a} <span className="text-slate-500">(0x{ocr0a.toString(16).padStart(2, '0').toUpperCase()}, 듀티: {((ocr0a / 256) * 100).toFixed(1)}%)</span>
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={ocr0a}
                onChange={(e) => changeOcr0a(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
              />
            </div>

            {/* Prescaler and Mode Quick Selectors */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">클럭 분주비 (CS02:00 in TCCR0B)</label>
                <select
                  value={tccr0b & 0x07}
                  onChange={(e) => changePrescaler(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                >
                  <option value={0}>정지 (타이머 클럭 차단)</option>
                  <option value={1}>분주 없음 (/1, 16MHz)</option>
                  <option value={2}>8분주 (/8, 2MHz)</option>
                  <option value={3}>64분주 (/64, 250kHz - 표준)</option>
                  <option value={4}>256분주 (/256, 62.5kHz)</option>
                  <option value={5}>1024분주 (/1024, 15.625kHz)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">OC0A 핀 동작 (COM0A1:00 in TCCR0A)</label>
                <select
                  value={(tccr0a >> 6) & 0x03}
                  onChange={(e) => changeCom0a(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                >
                  <option value={0}>일반 핀으로 유지 (OC0A 비활성)</option>
                  <option value={1}>비교 일치 시 토글 (Toggle on match)</option>
                  <option value={2}>비반전 PWM (Clear on match, Set on top)</option>
                  <option value={3}>반전 PWM (Set on match, Clear on top)</option>
                </select>
              </div>
            </div>

            {/* Interrupt Mask TIMSK0 */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-[11px] text-slate-400 font-mono">TIMSK0 인터럽트 허용:</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(timsk0 & 0x01) !== 0}
                    onChange={() => toggleTimsk0Bit(0x01, 'TOIE0', '오버플로우')}
                    className="accent-amber-500 rounded"
                  />
                  <span>TOIE0 (오버플로우)</span>
                </label>
                <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(timsk0 & 0x02) !== 0}
                    onChange={() => toggleTimsk0Bit(0x02, 'OCIE0A', '비교 일치')}
                    className="accent-amber-500 rounded"
                  />
                  <span>OCIE0A (비교 일치)</span>
                </label>
              </div>
            </div>
          </div>

          {/* 3. Global Interrupt & Peripherals (SREG, ADCSRA, UCSR0B) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> CPU 상태 레지스터 & 주변장치 인에이블
              </span>
              <button
                onClick={toggleSregI}
                className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-mono transition border ${
                  sreg & 0x80
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                    : 'bg-rose-500/20 text-rose-300 border-rose-400'
                }`}
              >
                SREG I-Bit: {sreg & 0x80 ? '인터럽트 허용 (sei)' : '인터럽트 금지 (cli)'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <span className="font-bold text-white block">ADCSRA (ADC 변환기)</span>
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={(adcsra & 0x80) !== 0}
                    onChange={() => toggleAdcsraBit(0x80, 'ADEN', 'ADC 전원 켬')}
                    className="accent-emerald-500 rounded"
                  />
                  <span>ADEN (ADC 전원 켬)</span>
                </label>
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={(adcsra & 0x40) !== 0}
                    onChange={() => toggleAdcsraBit(0x40, 'ADSC', '변환 시작')}
                    className="accent-emerald-500 rounded"
                  />
                  <span>ADSC (변환 시작)</span>
                </label>
              </div>

              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <span className="font-bold text-white block">UCSR0B (USART0 통신)</span>
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={(ucsr0b & 0x10) !== 0}
                    onChange={() => toggleUcsr0bBit(0x10, 'RXEN', '수신 활성화')}
                    className="accent-emerald-500 rounded"
                  />
                  <span>RXEN (수신 활성화)</span>
                </label>
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={(ucsr0b & 0x08) !== 0}
                    onChange={() => toggleUcsr0bBit(0x08, 'TXEN', '송신 활성화')}
                    className="accent-emerald-500 rounded"
                  />
                  <span>TXEN (송신 활성화)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Physical Hardware Reaction Visualizer */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> MCU 하드웨어 실시간 물리 동작 반응기
            </span>
            <span className="text-[11px] text-slate-400">레지스터 설정에 따른 실제 물리 상태</span>
          </div>

          {/* 1. Port B Physical Pins & Logic Visualizer */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400" /> Port B 핀 물리적 상태 (PINB 입력 버퍼)
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                PINB 읽기 레지스터: 0b{pinb.toString(2).padStart(8, '0')} (0x{pinb.toString(16).padStart(2, '0').toUpperCase()})
              </span>
            </div>

            {/* Visual Pin Diagram */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-center font-mono">
              {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => {
                const isOutput = (ddrb & (1 << bit)) !== 0;
                const isPortHigh = (portb & (1 << bit)) !== 0;
                const isPullUp = !isOutput && isPortHigh;
                const isPinHigh = (pinb & (1 << bit)) !== 0;

                return (
                  <div
                    key={bit}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-between transition-all ${
                      isPinHigh
                        ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-slate-300">PB{bit}</span>

                    {/* Visual LED / Logic Indicator */}
                    <div className="my-2 relative flex items-center justify-center">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg transition-all ${
                          isPinHigh
                            ? 'bg-emerald-400 text-slate-950 shadow-emerald-400/50 scale-110'
                            : 'bg-slate-800 text-slate-500 border border-slate-700'
                        }`}
                      >
                        {isPinHigh ? 'H' : 'L'}
                      </div>
                    </div>

                    <div className="space-y-0.5 text-[9px] font-sans w-full">
                      <div className={`px-1 py-0.5 rounded font-bold ${isOutput ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'}`}>
                        {isOutput ? '출력' : '입력'}
                      </div>
                      <div className="text-[8px] text-slate-400 truncate">
                        {isOutput ? (isPortHigh ? 'HIGH (5V)' : 'LOW (GND)') : isPullUp ? '풀업(40kΩ)' : 'Hi-Z(플로팅)'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Hardware Behavioral Notes */}
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 leading-relaxed font-sans">
              <span className="text-amber-400 font-bold">💡 하드웨어 동작 분석: </span>
              {ddrb & 0x20 ? (
                <span>PB5가 출력 모드로 설정되어 {portb & 0x20 ? '온보드 LED(D13)에 5V가 인가되어 밝게 점등됩니다.' : '온보드 LED가 소등 상태(GND)입니다.'} </span>
              ) : (
                <span>PB5가 고임피던스 입력 모드입니다. </span>
              )}
              {portb & 0x07 && !(ddrb & 0x07) ? (
                <span>PB0~PB2의 내부 풀업 저항(30k~50kΩ)이 활성화되어 스위치를 GND로 누르지 않는 한 논리 1(HIGH)로 안정적으로 유지됩니다.</span>
              ) : null}
            </div>
          </div>

          {/* 2. Timer/Counter 0 Live Waveform & Counter Gauge */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-400" /> 타이머0 실시간 카운터(TCNT0) 및 PWM 파형
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                오버플로우 횟수: <strong className="text-amber-300">{timerOverflowCount}</strong>
              </span>
            </div>

            {/* Counter Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">TCNT0 카운터 값:</span>
                <span className="text-amber-400 font-bold text-sm">
                  {tcnt0} / {timerWgm.top} <span className="text-xs text-slate-500">(0x{tcnt0.toString(16).padStart(2, '0').toUpperCase()})</span>
                </span>
              </div>
              <div className="h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-75"
                  style={{ width: `${Math.min(100, (tcnt0 / (timerWgm.top || 255)) * 100)}%` }}
                />
                {/* Marker for OCR0A */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-400 z-10"
                  style={{ left: `${Math.min(100, (ocr0a / (timerWgm.top || 255)) * 100)}%` }}
                  title={`OCR0A = ${ocr0a}`}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0 (BOTTOM)</span>
                <span className="text-rose-400 font-bold">▲ OCR0A ({ocr0a})</span>
                <span>{timerWgm.top} (TOP)</span>
              </div>
            </div>

            {/* OC0A Output Waveform Simulation */}
            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-semibold font-mono">OC0A 물리적 출력 신호 (PWM 파형):</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${oc0aOutput ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'bg-slate-800 text-slate-400'}`}>
                  {oc0aOutput ? 'HIGH (5V)' : 'LOW (0V)'}
                </span>
              </div>

              {/* Graphic PWM Pulse Preview */}
              <div className="h-8 bg-slate-950 rounded border border-slate-800 flex items-center px-2 overflow-hidden relative">
                <div className="w-full flex items-center h-full">
                  <div
                    className="h-5 bg-amber-400/80 border-r-2 border-amber-200"
                    style={{ width: `${((ocr0a / 256) * 100).toFixed(1)}%` }}
                  />
                  <div
                    className="h-1 bg-slate-800 flex-1"
                  />
                </div>
                <div className="absolute right-2 text-[10px] font-mono text-slate-400">
                  듀티 사이클: {((ocr0a / 256) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* 3. Real-time Interrupt & Peripheral Event Monitor */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-400" /> 최근 발생한 인터럽트 및 하드웨어 이벤트
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                SREG I-Bit: {sreg & 0x80 ? '✅ 수신 가능' : '❌ 마스킹 차단'}
              </span>
            </div>

            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-xs font-mono min-h-[50px] flex items-center justify-between">
              <div>
                {lastInterruptTriggered ? (
                  <div className="flex items-center gap-2 text-rose-300 font-bold animate-pulse">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{lastInterruptTriggered}</span>
                  </div>
                ) : (
                  <span className="text-slate-500">인터럽트 트리거 대기 중...</span>
                )}
              </div>

              {lastInterruptTriggered && (
                <button
                  onClick={() => setLastInterruptTriggered(null)}
                  className="text-[10px] text-slate-400 hover:text-white underline font-sans"
                >
                  지우기
                </button>
              )}
            </div>

            {/* Peripherals Status Row */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="bg-slate-900/60 p-2 rounded border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">ADC 변환기 상태:</span>
                <span className={adcsra & 0x80 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {adcsra & 0x80 ? (adcsra & 0x40 ? '변환 중 (BUSY)' : '준비 완료 (READY)') : '전원 꺼짐 (OFF)'}
                </span>
              </div>
              <div className="bg-slate-900/60 p-2 rounded border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">USART0 통신 링크:</span>
                <span className={(ucsr0b & 0x18) === 0x18 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {(ucsr0b & 0x18) === 0x18 ? 'RX/TX 풀 듀플렉스' : (ucsr0b & 0x08 ? 'TX만 활성' : '비활성')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Generated C Code & Bare-metal Mirror */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-white font-mono">
              현재 스냅샷 동기화 Bare-metal C 초기화 코드
            </span>
          </div>

          <button
            onClick={copyCode}
            className="text-slate-400 hover:text-white text-xs font-mono inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copiedCode ? '복사됨' : '코드 복사'}</span>
          </button>
        </div>

        <pre className="p-4 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto max-h-48 custom-scrollbar bg-slate-950/90">
          {generatedCInit}
        </pre>
      </div>
    </div>
  );
};
