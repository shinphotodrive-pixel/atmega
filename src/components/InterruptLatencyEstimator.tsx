import React, { useState, useMemo } from 'react';
import {
  Clock,
  Zap,
  Activity,
  Layers,
  ArrowRight,
  ShieldAlert,
  Info,
  Code2,
  Sliders,
  RotateCcw,
  Gauge,
  CornerDownRight,
  Sparkles,
  Database,
  Terminal,
  Cpu,
  CheckCircle2,
  Copy,
  Check,
  AlertTriangle,
  Flame,
  TrendingDown
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type IsrPresetType =
  | 'naked'
  | 'flag_toggle'
  | 'gcc_standard'
  | 'gcc_medium'
  | 'heavy_compute'
  | 'custom';

interface VectorInfo {
  vectorNum: number;
  name: string;
  source: string;
  offsetWords: number;
  offsetBytes: number;
  description: string;
}

export const InterruptLatencyEstimator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // System Clock Frequency (MHz)
  const [clockMhz, setClockMhz] = useState<number>(16);

  // In-flight instruction cycles (1 to 4 cycles)
  const [interruptedInstCycles, setInterruptedInstCycles] = useState<number>(3); // Typical worst-case before interrupt
  const [interruptedInstName, setInterruptedInstName] = useState<string>('CALL / LPM (3~4 cycles)');

  // Sleep wakeup mode
  const [sleepMode, setSleepMode] = useState<'active' | 'idle' | 'power_down'>('active');

  // Vector table jump type (JMP 3 cycles vs RJMP 2 cycles for smaller 328P)
  const [vectorJumpType, setVectorJumpType] = useState<'jmp' | 'rjmp'>(() => {
    return selectedMCU === 'atmega328p' ? 'rjmp' : 'jmp';
  });

  // Selected Vector
  const [selectedVectorIndex, setSelectedVectorIndex] = useState<number>(1); // INT0 default

  // ISR Preset
  const [preset, setPreset] = useState<IsrPresetType>('gcc_standard');

  // Granular Register Save Configuration
  const [saveSreg, setSaveSreg] = useState<boolean>(true);
  const [saveR0, setSaveR0] = useState<boolean>(true);
  const [saveR1, setSaveR1] = useState<boolean>(true);
  const [clrR1, setClrR1] = useState<boolean>(true);
  const [scratchGprCount, setScratchGprCount] = useState<number>(2); // e.g., r24, r25
  const [saveFramePointer, setSaveFramePointer] = useState<boolean>(false); // r28, r29 (Y pointer)
  const [saveZPointer, setSaveZPointer] = useState<boolean>(false); // r30, r31 (Z pointer)
  const [extraGprCount, setExtraGprCount] = useState<number>(0);

  // User-defined ISR Body workload (clock cycles)
  const [isrBodyCycles, setIsrBodyCycles] = useState<number>(12);

  // Target Interrupt Trigger Frequency (Hz) for CPU load estimation
  const [triggerFreqHz, setTriggerFreqHz] = useState<number>(8000);

  const [copiedAsm, setCopiedAsm] = useState<boolean>(false);

  // Hardware Specifications per MCU
  const mcuHw = useMemo(() => {
    if (selectedMCU === 'atmega640') {
      return {
        name: 'ATmega640',
        vectorCount: 57,
        vectorTableSizeBytes: 228, // 57 * 4 bytes
        vectorEntryWords: 2,       // JMP instruction (4 bytes)
        pcStackBytes: 3,           // 22-bit/24-bit PC -> 3 bytes pushed
        hwEntryPushCycles: 5,      // 5 clock cycles to push 3-byte PC
        hwExitRetiCycles: 5,       // 5 clock cycles to pop 3-byte PC & restore I-bit
        maxFreqMhz: 16,
        flashKb: 64,
        supportsRjmpVector: false
      };
    } else if (selectedMCU === 'atmega128') {
      return {
        name: 'ATmega128',
        vectorCount: 35,
        vectorTableSizeBytes: 140, // 35 * 4 bytes
        vectorEntryWords: 2,       // JMP instruction (4 bytes)
        pcStackBytes: 2,           // 16-bit PC -> 2 bytes pushed
        hwEntryPushCycles: 4,      // 4 clock cycles to push 2-byte PC
        hwExitRetiCycles: 4,       // 4 clock cycles to pop 2-byte PC & restore I-bit
        maxFreqMhz: 16,
        flashKb: 128,
        supportsRjmpVector: false
      };
    } else {
      // ATmega328P
      return {
        name: 'ATmega328P',
        vectorCount: 26,
        vectorTableSizeBytes: 104, // 26 * 4 bytes (or 52 bytes with RJMP)
        vectorEntryWords: vectorJumpType === 'rjmp' ? 1 : 2,
        pcStackBytes: 2,           // 16-bit PC -> 2 bytes pushed
        hwEntryPushCycles: 4,      // 4 clock cycles to push 2-byte PC
        hwExitRetiCycles: 4,       // 4 clock cycles to pop 2-byte PC & restore I-bit
        maxFreqMhz: 20,
        flashKb: 32,
        supportsRjmpVector: true
      };
    }
  }, [selectedMCU, vectorJumpType]);

  // Common Vector List for selected MCU
  const vectorList: VectorInfo[] = useMemo(() => {
    if (selectedMCU === 'atmega640') {
      return [
        { vectorNum: 1, name: 'RESET', source: 'Hardware Reset / BOD / WDT', offsetWords: 0x0000, offsetBytes: 0x0000, description: '전원 투입, 리셋 핀 또는 와치독 타임아웃' },
        { vectorNum: 2, name: 'INT0_vect', source: 'External Interrupt 0 (PD0)', offsetWords: 0x0002, offsetBytes: 0x0004, description: '외부 핀 인터럽트 0 신호' },
        { vectorNum: 3, name: 'INT1_vect', source: 'External Interrupt 1 (PD1)', offsetWords: 0x0004, offsetBytes: 0x0008, description: '외부 핀 인터럽트 1 신호' },
        { vectorNum: 13, name: 'TIMER1_CAPT_vect', source: 'Timer/Counter1 Capture Event', offsetWords: 0x0018, offsetBytes: 0x0030, description: '16비트 타이머 1 인풋 캡처 (ICP1)' },
        { vectorNum: 14, name: 'TIMER1_COMPA_vect', source: 'Timer/Counter1 Compare Match A', offsetWords: 0x001A, offsetBytes: 0x0034, description: '타이머 1 OCR1A 비교 일치 (주기적 CTC)' },
        { vectorNum: 18, name: 'TIMER0_OVF_vect', source: 'Timer/Counter0 Overflow', offsetWords: 0x0022, offsetBytes: 0x0044, description: '8비트 타이머 0 오버플로' },
        { vectorNum: 25, name: 'USART0_RX_vect', source: 'USART0 Rx Complete', offsetWords: 0x0030, offsetBytes: 0x0060, description: '시리얼 0 바이트 수신 완료' },
        { vectorNum: 29, name: 'ADC_vect', source: 'ADC Conversion Complete', offsetWords: 0x0038, offsetBytes: 0x0070, description: '아날로그-디지털 변환 완료' }
      ];
    } else if (selectedMCU === 'atmega128') {
      return [
        { vectorNum: 1, name: 'RESET', source: 'Hardware Reset / BOD / WDT', offsetWords: 0x0000, offsetBytes: 0x0000, description: '전원 투입 및 하드웨어 리셋' },
        { vectorNum: 2, name: 'INT0_vect', source: 'External Interrupt Request 0 (PD0)', offsetWords: 0x0002, offsetBytes: 0x0004, description: '외부 인터럽트 0' },
        { vectorNum: 3, name: 'INT1_vect', source: 'External Interrupt Request 1 (PD1)', offsetWords: 0x0004, offsetBytes: 0x0008, description: '외부 인터럽트 1' },
        { vectorNum: 12, name: 'TIMER1_COMPA_vect', source: 'Timer/Counter1 Compare Match A', offsetWords: 0x0016, offsetBytes: 0x002C, description: '16비트 타이머 1 비교 일치 A' },
        { vectorNum: 15, name: 'TIMER0_OVF_vect', source: 'Timer/Counter0 Overflow', offsetWords: 0x001C, offsetBytes: 0x0038, description: '8비트 타이머 0 오버플로' },
        { vectorNum: 18, name: 'USART0_RX_vect', source: 'USART0 Rx Complete (PE0)', offsetWords: 0x0022, offsetBytes: 0x0044, description: 'USART0 수신 완료' },
        { vectorNum: 21, name: 'ADC_vect', source: 'ADC Conversion Complete', offsetWords: 0x0028, offsetBytes: 0x0050, description: 'ADC 변환 완료' }
      ];
    } else {
      // ATmega328P
      return [
        { vectorNum: 1, name: 'RESET', source: 'Hardware Reset / BOD / WDT', offsetWords: 0x0000, offsetBytes: 0x0000, description: '리셋 벡터 (0x0000)' },
        { vectorNum: 2, name: 'INT0_vect', source: 'External Interrupt Request 0 (PD2)', offsetWords: 0x0002, offsetBytes: 0x0004, description: '아두이노 D2 핀 외부 인터럽트' },
        { vectorNum: 3, name: 'INT1_vect', source: 'External Interrupt Request 1 (PD3)', offsetWords: 0x0004, offsetBytes: 0x0008, description: '아두이노 D3 핀 외부 인터럽트' },
        { vectorNum: 4, name: 'PCINT0_vect', source: 'Pin Change Interrupt Request 0 (PB0..PB7)', offsetWords: 0x0006, offsetBytes: 0x000C, description: 'Port B 핀 상태 변화 인터럽트' },
        { vectorNum: 11, name: 'TIMER1_COMPA_vect', source: 'Timer/Counter1 Compare Match A', offsetWords: 0x0014, offsetBytes: 0x0028, description: '16비트 타이머 1 CTC 주기 인터럽트' },
        { vectorNum: 16, name: 'TIMER0_OVF_vect', source: 'Timer/Counter0 Overflow (millis)', offsetWords: 0x001E, offsetBytes: 0x003C, description: '밀리초 millis() 틱 카운터' },
        { vectorNum: 19, name: 'USART_RX_vect', source: 'USART Rx Complete (PD0)', offsetWords: 0x0024, offsetBytes: 0x0048, description: '하드웨어 시리얼 수신 완료' },
        { vectorNum: 22, name: 'ADC_vect', source: 'ADC Conversion Complete', offsetWords: 0x002A, offsetBytes: 0x0054, description: '아날로그 입력 A0~A7 변환 완료' }
      ];
    }
  }, [selectedMCU]);

  // Handle Preset Changes
  const applyPreset = (newPreset: IsrPresetType) => {
    setPreset(newPreset);
    if (newPreset === 'naked') {
      setSaveSreg(false);
      setSaveR0(false);
      setSaveR1(false);
      setClrR1(false);
      setScratchGprCount(0);
      setSaveFramePointer(false);
      setSaveZPointer(false);
      setExtraGprCount(0);
    } else if (newPreset === 'flag_toggle') {
      setSaveSreg(true);
      setSaveR0(false);
      setSaveR1(false);
      setClrR1(false);
      setScratchGprCount(1); // r24 only
      setSaveFramePointer(false);
      setSaveZPointer(false);
      setExtraGprCount(0);
    } else if (newPreset === 'gcc_standard') {
      setSaveSreg(true);
      setSaveR0(true);
      setSaveR1(true);
      setClrR1(true);
      setScratchGprCount(2); // r24, r25
      setSaveFramePointer(false);
      setSaveZPointer(false);
      setExtraGprCount(0);
    } else if (newPreset === 'gcc_medium') {
      setSaveSreg(true);
      setSaveR0(true);
      setSaveR1(true);
      setClrR1(true);
      setScratchGprCount(4); // r24, r25, r26, r27
      setSaveFramePointer(false);
      setSaveZPointer(false);
      setExtraGprCount(2); // +2 regs
    } else if (newPreset === 'heavy_compute') {
      setSaveSreg(true);
      setSaveR0(true);
      setSaveR1(true);
      setClrR1(true);
      setScratchGprCount(6); // r18..r27
      setSaveFramePointer(true); // r28, r29
      setSaveZPointer(true); // r30, r31
      setExtraGprCount(4);
    }
  };

  // Latency & Cycle Calculation
  const metrics = useMemo(() => {
    // 1. IN-FLIGHT INSTRUCTION OVERHEAD
    const inFlightCycles = interruptedInstCycles;

    // 2. SLEEP WAKEUP CYCLES
    let sleepCycles = 0;
    if (sleepMode === 'idle') {
      sleepCycles = 4; // Idle wakeup takes 4 clock cycles
    } else if (sleepMode === 'power_down') {
      sleepCycles = 6; // Power-down with Fast Int RC takes 6 clock cycles
    }

    // 3. HARDWARE VECTOR JUMP & PC PUSH
    const hwPushCycles = mcuHw.hwEntryPushCycles;

    // 4. VECTOR TABLE INSTRUCTION EXECUTION
    const vectorJumpCycles = mcuHw.supportsRjmpVector && vectorJumpType === 'rjmp' ? 2 : 3;

    // 5. SOFTWARE PROLOGUE OVERHEAD (Context Saving)
    let swPrologueCycles = 0;
    let swPrologueBytes = 0;

    if (saveR1) {
      swPrologueCycles += 2;
      swPrologueBytes += 1;
    }
    if (saveR0) {
      swPrologueCycles += 2;
      swPrologueBytes += 1;
    }
    if (saveSreg) {
      swPrologueCycles += 1; // in r0, __SREG__
      swPrologueCycles += 2; // push r0
      swPrologueBytes += 1;
    }
    if (clrR1) {
      swPrologueCycles += 1; // clr r1 (eor r1, r1)
    }

    const totalSavedGprs =
      scratchGprCount +
      (saveFramePointer ? 2 : 0) +
      (saveZPointer ? 2 : 0) +
      extraGprCount;

    swPrologueCycles += totalSavedGprs * 2; // push rx is 2 cycles
    swPrologueBytes += totalSavedGprs;

    // TOTAL ENTRY CYCLES
    const totalEntryCycles =
      inFlightCycles +
      sleepCycles +
      hwPushCycles +
      vectorJumpCycles +
      swPrologueCycles;

    // 6. SOFTWARE EPILOGUE OVERHEAD (Context Restoration)
    let swEpilogueCycles = 0;
    swEpilogueCycles += totalSavedGprs * 2;

    if (saveSreg) {
      swEpilogueCycles += 2; // pop r0
      swEpilogueCycles += 1; // out __SREG__, r0
    }
    if (saveR0) {
      swEpilogueCycles += 2; // pop r0
    }
    if (saveR1) {
      swEpilogueCycles += 2; // pop r1
    }

    // 7. HARDWARE RETI (Return from Interrupt)
    const hwRetiCycles = mcuHw.hwExitRetiCycles;

    // TOTAL EXIT CYCLES
    const totalExitCycles = swEpilogueCycles + hwRetiCycles;

    // TOTAL OVERHEAD CYCLES (Entry + Exit, excluding user ISR body)
    const totalOverheadCycles = totalEntryCycles + totalExitCycles;

    // COMBINED COMPLETE ISR TIME (Entry + Body + Exit)
    const fullIsrCycles = totalOverheadCycles + isrBodyCycles;

    // Time calculations based on Clock MHz
    const cycleTimeNs = (1000 / clockMhz); // e.g., 62.5ns @ 16MHz
    const entryTimeNs = totalEntryCycles * cycleTimeNs;
    const exitTimeNs = totalExitCycles * cycleTimeNs;
    const overheadTimeNs = totalOverheadCycles * cycleTimeNs;
    const fullIsrTimeNs = fullIsrCycles * cycleTimeNs;

    // Total Stack Usage
    const totalStackBytes = mcuHw.pcStackBytes + swPrologueBytes;

    // Max Sustainable Trigger Frequency before CPU starvation (100% Load)
    const maxFreqHz = Math.floor((clockMhz * 1000000) / fullIsrCycles);

    // CPU Utilization at user target trigger frequency
    const currentCpuLoadPct = Math.min(100, +((triggerFreqHz * fullIsrCycles) / (clockMhz * 1000000) * 100).toFixed(1));

    return {
      inFlightCycles,
      sleepCycles,
      hwPushCycles,
      vectorJumpCycles,
      swPrologueCycles,
      totalEntryCycles,
      swEpilogueCycles,
      hwRetiCycles,
      totalExitCycles,
      totalOverheadCycles,
      fullIsrCycles,
      cycleTimeNs,
      entryTimeNs,
      exitTimeNs,
      overheadTimeNs,
      fullIsrTimeNs,
      totalStackBytes,
      totalSavedGprs,
      maxFreqHz,
      currentCpuLoadPct
    };
  }, [
    clockMhz,
    interruptedInstCycles,
    sleepMode,
    vectorJumpType,
    mcuHw,
    saveSreg,
    saveR0,
    saveR1,
    clrR1,
    scratchGprCount,
    saveFramePointer,
    saveZPointer,
    extraGprCount,
    isrBodyCycles,
    triggerFreqHz
  ]);

  // Selected Vector Details
  const activeVector = useMemo(() => {
    return vectorList.find((v) => v.vectorNum === selectedVectorIndex) || vectorList[0];
  }, [vectorList, selectedVectorIndex]);

  // Assembly Code Breakdown Generator
  const generatedAsm = useMemo(() => {
    const lines: Array<{ code: string; cyc: string; bytes: string; desc: string }> = [];

    lines.push({
      code: `; --- [1. 벡터 테이블 위치: 0x${activeVector.offsetBytes.toString(16).padStart(4, '0').toUpperCase()}] ---`,
      cyc: '',
      bytes: '',
      desc: `${mcuHw.name} 벡터 #${activeVector.vectorNum} (${activeVector.name})`
    });

    if (mcuHw.supportsRjmpVector && vectorJumpType === 'rjmp') {
      lines.push({
        code: `rjmp  __vector_${activeVector.vectorNum}`,
        cyc: '2 cycles',
        bytes: '2 Bytes',
        desc: '상대 점프 (RJMP) - 벡터 테이블에서 ISR 본체로 점프'
      });
    } else {
      lines.push({
        code: `jmp   __vector_${activeVector.vectorNum}`,
        cyc: '3 cycles',
        bytes: '4 Bytes',
        desc: '절대 점프 (JMP) - 32비트 명령어로 전역 메모리 공간 어디든 점프'
      });
    }

    lines.push({
      code: `\n__vector_${activeVector.vectorNum}:`,
      cyc: '',
      bytes: '',
      desc: `; 하드웨어 자동 수행: PC(${mcuHw.pcStackBytes}B) 스택 Push (${mcuHw.hwEntryPushCycles} cyc) & I-Bit 클리어`
    });

    lines.push({
      code: `; --- [2. 컴파일러 ISR 프롤로그 (Prologue) - 컨텍스트 백업] ---`,
      cyc: '',
      bytes: '',
      desc: '인터럽트 진입 레지스터 보존'
    });

    if (saveR1) {
      lines.push({ code: 'push  r1', cyc: '2 cycles', bytes: '2 Bytes', desc: 'GCC 고정 __zero_reg__ 보존' });
    }
    if (saveR0) {
      lines.push({ code: 'push  r0', cyc: '2 cycles', bytes: '2 Bytes', desc: '임시 연산 레지스터 __tmp_reg__ 보존' });
    }
    if (saveSreg) {
      lines.push({ code: 'in    r0, 0x3f', cyc: '1 cycle', bytes: '2 Bytes', desc: '상태 레지스터 (SREG / FLAGS) 읽기' });
      lines.push({ code: 'push  r0', cyc: '2 cycles', bytes: '2 Bytes', desc: 'SREG 값 스택 백업' });
    }
    if (clrR1) {
      lines.push({ code: 'eor   r1, r1', cyc: '1 cycle', bytes: '2 Bytes', desc: 'r1을 0으로 클리어 (GCC 규약 유지)' });
    }
    if (scratchGprCount >= 1) {
      lines.push({ code: 'push  r24', cyc: '2 cycles', bytes: '2 Bytes', desc: '작업용 스크래치 레지스터 r24 보존' });
    }
    if (scratchGprCount >= 2) {
      lines.push({ code: 'push  r25', cyc: '2 cycles', bytes: '2 Bytes', desc: '작업용 스크래치 레지스터 r25 보존' });
    }
    if (scratchGprCount >= 3) {
      lines.push({ code: 'push  r26', cyc: '2 cycles', bytes: '2 Bytes', desc: 'X 포인터 하위 (r26) 보존' });
    }
    if (scratchGprCount >= 4) {
      lines.push({ code: 'push  r27', cyc: '2 cycles', bytes: '2 Bytes', desc: 'X 포인터 상위 (r27) 보존' });
    }
    if (saveFramePointer) {
      lines.push({ code: 'push  r28', cyc: '2 cycles', bytes: '2 Bytes', desc: 'Y 프레임 포인터 하위 보존' });
      lines.push({ code: 'push  r29', cyc: '2 cycles', bytes: '2 Bytes', desc: 'Y 프레임 포인터 상위 보존' });
    }
    if (saveZPointer) {
      lines.push({ code: 'push  r30', cyc: '2 cycles', bytes: '2 Bytes', desc: 'Z 포인터 하위 (LPM/ICALL용) 보존' });
      lines.push({ code: 'push  r31', cyc: '2 cycles', bytes: '2 Bytes', desc: 'Z 포인터 상위 보존' });
    }

    lines.push({
      code: `\n; --- [3. 사용자 ISR 본체 (User ISR Body)] ---`,
      cyc: `${isrBodyCycles} cycles`,
      bytes: `~${isrBodyCycles * 2} Bytes`,
      desc: '플래그 갱신, I/O 핀 토글, 타이머 카운터 리셋 등'
    });
    lines.push({ code: 'sbi   0x05, 5', cyc: '2 cycles', bytes: '2 Bytes', desc: '예: PORTB.5 핀 하드웨어 토글' });
    lines.push({ code: 'lds   r24, 0x0100', cyc: '2 cycles', bytes: '4 Bytes', desc: 'SRAM 변수 읽기' });
    lines.push({ code: 'subi  r24, 0xFF', cyc: '1 cycle', bytes: '2 Bytes', desc: '카운터 증감 연산' });
    lines.push({ code: 'sts   0x0100, r24', cyc: '2 cycles', bytes: '4 Bytes', desc: 'SRAM 변수 저장' });

    lines.push({
      code: `\n; --- [4. 컴파일러 ISR 에필로그 (Epilogue) - 컨텍스트 복원] ---`,
      cyc: '',
      bytes: '',
      desc: '인터럽트 복귀 레지스터 복원'
    });

    if (saveZPointer) {
      lines.push({ code: 'pop   r31', cyc: '2 cycles', bytes: '2 Bytes', desc: 'Z 포인터 상위 복원' });
      lines.push({ code: 'pop   r30', cyc: '2 cycles', bytes: '2 Bytes', desc: 'Z 포인터 하위 복원' });
    }
    if (saveFramePointer) {
      lines.push({ code: 'pop   r29', cyc: '2 cycles', bytes: '2 Bytes', desc: 'Y 프레임 포인터 상위 복원' });
      lines.push({ code: 'pop   r28', cyc: '2 cycles', bytes: '2 Bytes', desc: 'Y 프레임 포인터 하위 복원' });
    }
    if (scratchGprCount >= 4) {
      lines.push({ code: 'pop   r27', cyc: '2 cycles', bytes: '2 Bytes', desc: 'X 포인터 상위 복원' });
    }
    if (scratchGprCount >= 3) {
      lines.push({ code: 'pop   r26', cyc: '2 cycles', bytes: '2 Bytes', desc: 'X 포인터 하위 복원' });
    }
    if (scratchGprCount >= 2) {
      lines.push({ code: 'pop   r25', cyc: '2 cycles', bytes: '2 Bytes', desc: 'r25 복원' });
    }
    if (scratchGprCount >= 1) {
      lines.push({ code: 'pop   r24', cyc: '2 cycles', bytes: '2 Bytes', desc: 'r24 복원' });
    }
    if (saveSreg) {
      lines.push({ code: 'pop   r0', cyc: '2 cycles', bytes: '2 Bytes', desc: 'SREG 백업 값 꺼내기' });
      lines.push({ code: 'out   0x3f, r0', cyc: '1 cycle', bytes: '2 Bytes', desc: '상태 레지스터 (SREG) 원상 복구' });
    }
    if (saveR0) {
      lines.push({ code: 'pop   r0', cyc: '2 cycles', bytes: '2 Bytes', desc: 'r0 복원' });
    }
    if (saveR1) {
      lines.push({ code: 'pop   r1', cyc: '2 cycles', bytes: '2 Bytes', desc: 'r1 복원' });
    }

    lines.push({
      code: `\n; --- [5. 하드웨어 복귀 (Exit)] ---`,
      cyc: '',
      bytes: '',
      desc: ''
    });
    lines.push({
      code: 'reti',
      cyc: `${mcuHw.hwExitRetiCycles} cycles`,
      bytes: '2 Bytes',
      desc: `PC(${mcuHw.pcStackBytes}B) 스택 Pop 복귀 및 Global Interrupt Enable (I=1) 자동 활성화`
    });

    return lines;
  }, [activeVector, mcuHw, vectorJumpType, saveR1, saveR0, saveSreg, clrR1, scratchGprCount, saveFramePointer, saveZPointer, isrBodyCycles]);

  const copyAsmText = () => {
    const text = generatedAsm.map((l) => `${l.code.padEnd(24, ' ')} ${l.cyc ? '; ' + l.cyc : ''}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAsm(true);
    setTimeout(() => setCopiedAsm(false), 2000);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
            <Clock className="w-3.5 h-3.5" /> Hardware Interrupt Latency & Jitter Estimator
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            인터럽트 지연 시간 추정기 (Interrupt Latency Estimator)
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
              {mcuHw.name}
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            선택된 MCU의 <strong>벡터 테이블 크기({mcuHw.vectorCount}개 벡터, {mcuHw.vectorTableSizeBytes} Bytes)</strong>,
            <strong> PC 스택 깊이({mcuHw.pcStackBytes} Bytes)</strong> 및
            <strong> 실행 중 명령어 오버헤드 + C 컴파일러 프롤로그/에필로그</strong>를 기반으로
            인터럽트 진입(Entry) 및 복귀(Exit)에 소요되는 정확한 클럭 사이클과 지연 시간을 실시간 산출합니다.
          </p>
        </div>

        {/* MCU Selector Switcher */}
        {onSelectMCU && (
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0">
            {(['atmega328p', 'atmega128', 'atmega640'] as SupportedMCU[]).map((mcu) => (
              <button
                key={mcu}
                onClick={() => onSelectMCU(mcu)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedMCU === mcu
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {mcu === 'atmega328p' ? 'ATmega328P' : mcu === 'atmega128' ? 'ATmega128' : 'ATmega640'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Entry Latency */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-rose-400 flex items-center gap-1.5">
              <CornerDownRight className="w-3.5 h-3.5" /> 인터럽트 진입 (Entry)
            </span>
            <span className="text-[10px] font-mono text-slate-500">HW + SW</span>
          </div>
          <div className="font-mono text-2xl font-black text-rose-300">
            {metrics.totalEntryCycles} <span className="text-sm font-normal text-slate-400">Cycles</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            = {metrics.entryTimeNs.toFixed(1)} ns ({clockMhz} MHz 기준)
          </p>
        </div>

        {/* Exit Latency */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-cyan-400 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5" /> 인터럽트 복귀 (Exit)
            </span>
            <span className="text-[10px] font-mono text-slate-500">Epilogue + RETI</span>
          </div>
          <div className="font-mono text-2xl font-black text-cyan-300">
            {metrics.totalExitCycles} <span className="text-sm font-normal text-slate-400">Cycles</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            = {metrics.exitTimeNs.toFixed(1)} ns ({clockMhz} MHz 기준)
          </p>
        </div>

        {/* Total Overhead */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-amber-400 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" /> 순수 오버헤드 (Entry + Exit)
            </span>
            <span className="text-[10px] font-mono text-amber-300">순수 지연</span>
          </div>
          <div className="font-mono text-2xl font-black text-amber-300">
            {metrics.totalOverheadCycles} <span className="text-sm font-normal text-amber-400/80">Cycles</span>
          </div>
          <p className="text-[11px] text-amber-400/80 font-mono">
            = {(metrics.overheadTimeNs / 1000).toFixed(3)} µs (본체 제외 순수 전환 비용)
          </p>
        </div>

        {/* Stack Consumption */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-purple-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> 스택 점유 깊이 (Stack)
            </span>
            <span className="text-[10px] font-mono text-slate-500">SRAM Push</span>
          </div>
          <div className="font-mono text-2xl font-black text-purple-300">
            {metrics.totalStackBytes} <span className="text-sm font-normal text-slate-400">Bytes</span>
          </div>
          <p className="text-[11px] text-slate-400">
            PC({mcuHw.pcStackBytes}B) + 레지스터 {metrics.totalStackBytes - mcuHw.pcStackBytes}B 백업
          </p>
        </div>
      </div>

      {/* Interactive Controls & Parameters Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Hardware Architecture & Vector Configuration */}
        <div className="lg:col-span-6 bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <Cpu className="w-4 h-4 text-amber-400" />
            1. 하드웨어 아키텍처 및 시스템 클럭 설정
          </h4>

          {/* Clock Frequency Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium">MCU 시스템 클럭 주파수 (F_CPU):</span>
              <span className="font-mono font-bold text-amber-400">
                {clockMhz} MHz (1 클럭 = {metrics.cycleTimeNs.toFixed(1)} ns)
              </span>
            </div>
            <input
              type="range"
              min="1"
              max={mcuHw.maxFreqMhz}
              step="1"
              value={clockMhz}
              onChange={(e) => setClockMhz(Number(e.target.value))}
              className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1 MHz</span>
              <span>8 MHz (내장 RC)</span>
              <span>16 MHz (크리스탈)</span>
              {mcuHw.maxFreqMhz === 20 && <span>20 MHz (328P 최대)</span>}
            </div>
          </div>

          {/* Current In-flight Instruction Worst Case */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 font-medium block">
              인터럽트 발생 시점 실행 중인 명령어 (In-flight Overhead):
            </label>
            <select
              value={interruptedInstCycles}
              onChange={(e) => {
                const val = Number(e.target.value);
                setInterruptedInstCycles(val);
                if (val === 1) setInterruptedInstName('단일 사이클 연산 (NOP, ADD, MOV - 1 cycle)');
                else if (val === 2) setInterruptedInstName('2사이클 명령어 (SBI, CBI, RJMP, LDS/STS - 2 cycles)');
                else if (val === 3) setInterruptedInstName('3사이클 서브루틴 호출 (RCALL / CALL - 3 cycles)');
                else setInterruptedInstName('최대 지연 4사이클 명령어 (CALL, LPM, SPM, RET, RETI - 4 cycles)');
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono"
            >
              <option value="1">1 클럭 사이클: NOP, ADD, SUB, AND, MOV (최소 진입 지연)</option>
              <option value="2">2 클럭 사이클: SBI, CBI, RJMP, ADIW, LDS, STS</option>
              <option value="3">3 클럭 사이클: RCALL, CALL (일부 소형 모델)</option>
              <option value="4">4 클럭 사이클: CALL, LPM, SPM, RET, RETI (최악 케이스 지연)</option>
            </select>
            <span className="text-[11px] text-slate-400 block">
              * AVR은 진행 중인 머신 명령어가 완전히 끝난 뒤에만 인터럽트를 서비스하므로, 최악 조건 시 최대 4사이클 대기가 발생합니다.
            </span>
          </div>

          {/* Sleep Wakeup Mode */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 font-medium block">
              슬립 모드 기상(Wakeup) 대기 시간:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setSleepMode('active')}
                className={`p-2 rounded-lg text-xs font-semibold border transition-all ${
                  sleepMode === 'active'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                정상 동작 (0 cyc)
              </button>
              <button
                onClick={() => setSleepMode('idle')}
                className={`p-2 rounded-lg text-xs font-semibold border transition-all ${
                  sleepMode === 'idle'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                Idle 슬립 (+4 cyc)
              </button>
              <button
                onClick={() => setSleepMode('power_down')}
                className={`p-2 rounded-lg text-xs font-semibold border transition-all ${
                  sleepMode === 'power_down'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                Power-down (+6 cyc)
              </button>
            </div>
          </div>

          {/* Vector Table Jump Type (ATmega328P option) */}
          {mcuHw.supportsRjmpVector && (
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300">벡터 테이블 점프 인스트럭션 (ATmega328P):</span>
                <span className="font-mono text-cyan-400 font-bold">
                  {vectorJumpType === 'rjmp' ? 'rjmp (2 Cycles / 2B)' : 'jmp (3 Cycles / 4B)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setVectorJumpType('rjmp')}
                  className={`p-1.5 rounded-lg text-xs font-medium border ${
                    vectorJumpType === 'rjmp'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  RJMP (표준 32KB 미만, 2 클럭)
                </button>
                <button
                  onClick={() => setVectorJumpType('jmp')}
                  className={`p-1.5 rounded-lg text-xs font-medium border ${
                    vectorJumpType === 'jmp'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  JMP (절대 점프, 3 클럭)
                </button>
              </div>
            </div>
          )}

          {/* Vector Source Selector */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <label className="text-xs text-slate-300 font-medium block">
              대상 인터럽트 벡터 소스 (Vector Table Entry):
            </label>
            <select
              value={selectedVectorIndex}
              onChange={(e) => setSelectedVectorIndex(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
            >
              {vectorList.map((vec) => (
                <option key={vec.vectorNum} value={vec.vectorNum}>
                  #{vec.vectorNum}: {vec.name} ({vec.source}) - 0x{vec.offsetBytes.toString(16).padStart(4, '0').toUpperCase()}
                </option>
              ))}
            </select>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>{activeVector.description}</span>
              <span className="font-mono text-amber-400 shrink-0 font-bold">
                Offset 0x{activeVector.offsetBytes.toString(16).padStart(4, '0').toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Right Col: C Compiler Context-Saving Overhead (Prologue & Epilogue) */}
        <div className="lg:col-span-6 bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              2. C 컴파일러 프롤로그/에필로그 레지스터 보존 설정
            </h4>
            <span className="text-[10px] font-mono text-cyan-300">
              GPR {metrics.totalSavedGprs}개 보존
            </span>
          </div>

          {/* Preset Buttons */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400 block font-medium">ISR 구조 프리셋:</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {[
                { id: 'naked', name: 'Naked ISR', desc: '프롤로그 없음 (어셈블리 제어)' },
                { id: 'flag_toggle', name: '초경량 플래그 토글', desc: 'SREG + 1개 레지스터' },
                { id: 'gcc_standard', name: 'GCC 표준 핸들러', desc: 'SREG, r0, r1 + r24..r25' },
                { id: 'gcc_medium', name: '중간 규모 연산', desc: 'SREG, r0, r1 + 6개 레지스터' },
                { id: 'heavy_compute', name: '고연산 / 포인터', desc: '프레임포인터 Y, Z 포함' }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id as IsrPresetType)}
                  className={`p-2 rounded-lg text-left border transition-all text-xs ${
                    preset === p.id
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-[10px] opacity-75 font-normal truncate">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Granular Toggles */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="text-[11px] font-bold text-slate-300">세부 레지스터 푸시/팝 스위치:</div>
            <div className="grid grid-cols-2 gap-2 text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveSreg}
                  onChange={(e) => {
                    setSaveSreg(e.target.checked);
                    setPreset('custom');
                  }}
                  className="rounded accent-amber-500"
                />
                <span>SREG 보존 (in/push, pop/out - 6 cyc)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveR0}
                  onChange={(e) => {
                    setSaveR0(e.target.checked);
                    setPreset('custom');
                  }}
                  className="rounded accent-amber-500"
                />
                <span>r0 (__tmp_reg__ - 4 cyc)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveR1}
                  onChange={(e) => {
                    setSaveR1(e.target.checked);
                    setPreset('custom');
                  }}
                  className="rounded accent-amber-500"
                />
                <span>r1 (__zero_reg__ - 4 cyc)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clrR1}
                  onChange={(e) => {
                    setClrR1(e.target.checked);
                    setPreset('custom');
                  }}
                  className="rounded accent-amber-500"
                />
                <span>eor r1, r1 (clr r1 - 1 cyc)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveFramePointer}
                  onChange={(e) => {
                    setSaveFramePointer(e.target.checked);
                    setPreset('custom');
                  }}
                  className="rounded accent-amber-500"
                />
                <span>Y 포인터 (r28, r29 - 8 cyc)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveZPointer}
                  onChange={(e) => {
                    setSaveZPointer(e.target.checked);
                    setPreset('custom');
                  }}
                  className="rounded accent-amber-500"
                />
                <span>Z 포인터 (r30, r31 - 8 cyc)</span>
              </label>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">작업용 스크래치 레지스터 (r24..r27):</span>
              <div className="flex items-center gap-2">
                {[0, 1, 2, 4].map((count) => (
                  <button
                    key={count}
                    onClick={() => {
                      setScratchGprCount(count);
                      setPreset('custom');
                    }}
                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                      scratchGprCount === count
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {count}개 (+{count * 4}cyc)
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ISR Body Simulation & Frequency Load */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300">사용자 ISR 본체 연산 사이클 (Body Cycles):</span>
                <span className="font-mono font-bold text-amber-400">
                  {isrBodyCycles} Cycles ({(isrBodyCycles * metrics.cycleTimeNs).toFixed(1)} ns)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="2"
                value={isrBodyCycles}
                onChange={(e) => setIsrBodyCycles(Number(e.target.value))}
                className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300">인터럽트 트리거 빈도 (Hz):</span>
                <span className="font-mono font-bold text-cyan-400">
                  {triggerFreqHz.toLocaleString()} Hz (주기: {(1000000 / triggerFreqHz).toFixed(1)} µs)
                </span>
              </div>
              <input
                type="range"
                min="100"
                max="100000"
                step="500"
                value={triggerFreqHz}
                onChange={(e) => setTriggerFreqHz(Number(e.target.value))}
                className="w-full accent-cyan-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 font-mono">
                <span>CPU 부하율 (점유율):</span>
                <span className={`font-bold ${metrics.currentCpuLoadPct > 80 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {metrics.currentCpuLoadPct}% ({metrics.currentCpuLoadPct > 80 ? '위험: CPU 고갈 주의' : '안정적'})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Step-by-Step Latency Breakdown Pipeline */}
      <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
          <span className="font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            인터럽트 전 구간 사이클 소모 파이프라인 (총 {metrics.fullIsrCycles} 클럭 사이클)
          </span>
          <span className="text-slate-400 font-mono text-[11px]">
            1사이클 = {metrics.cycleTimeNs.toFixed(1)} ns | 최대 허용 한계 주파수: {(metrics.maxFreqHz / 1000).toFixed(1)} kHz
          </span>
        </div>

        {/* Stacked Visual Bar */}
        <div className="w-full h-8 bg-slate-900 rounded-xl overflow-hidden flex text-[10px] font-mono font-bold text-slate-950">
          <div
            style={{ width: `${(metrics.inFlightCycles / metrics.fullIsrCycles) * 100}%` }}
            className="h-full bg-rose-400 flex items-center justify-center truncate px-1"
            title={`명령어 완료 대기: ${metrics.inFlightCycles} cyc`}
          >
            {metrics.inFlightCycles}c 대기
          </div>
          {metrics.sleepCycles > 0 && (
            <div
              style={{ width: `${(metrics.sleepCycles / metrics.fullIsrCycles) * 100}%` }}
              className="h-full bg-purple-400 flex items-center justify-center truncate px-1"
              title={`슬립 기상: ${metrics.sleepCycles} cyc`}
            >
              {metrics.sleepCycles}c 기상
            </div>
          )}
          <div
            style={{ width: `${(metrics.hwPushCycles / metrics.fullIsrCycles) * 100}%` }}
            className="h-full bg-amber-400 flex items-center justify-center truncate px-1"
            title={`HW PC Push: ${metrics.hwPushCycles} cyc (${mcuHw.pcStackBytes}B)`}
          >
            {metrics.hwPushCycles}c HW Push
          </div>
          <div
            style={{ width: `${(metrics.vectorJumpCycles / metrics.fullIsrCycles) * 100}%` }}
            className="h-full bg-emerald-400 flex items-center justify-center truncate px-1"
            title={`벡터 점프: ${metrics.vectorJumpCycles} cyc`}
          >
            {metrics.vectorJumpCycles}c JMP
          </div>
          <div
            style={{ width: `${(metrics.swPrologueCycles / metrics.fullIsrCycles) * 100}%` }}
            className="h-full bg-sky-400 flex items-center justify-center truncate px-1"
            title={`SW 프롤로그: ${metrics.swPrologueCycles} cyc`}
          >
            {metrics.swPrologueCycles}c 프롤로그
          </div>
          {isrBodyCycles > 0 && (
            <div
              style={{ width: `${(isrBodyCycles / metrics.fullIsrCycles) * 100}%` }}
              className="h-full bg-indigo-300 flex items-center justify-center truncate px-1"
              title={`ISR 본체: ${isrBodyCycles} cyc`}
            >
              {isrBodyCycles}c ISR 본체
            </div>
          )}
          <div
            style={{ width: `${(metrics.swEpilogueCycles / metrics.fullIsrCycles) * 100}%` }}
            className="h-full bg-cyan-400 flex items-center justify-center truncate px-1"
            title={`SW 에필로그: ${metrics.swEpilogueCycles} cyc`}
          >
            {metrics.swEpilogueCycles}c 에필로그
          </div>
          <div
            style={{ width: `${(metrics.hwRetiCycles / metrics.fullIsrCycles) * 100}%` }}
            className="h-full bg-teal-400 flex items-center justify-center truncate px-1"
            title={`HW RETI: ${metrics.hwRetiCycles} cyc`}
          >
            {metrics.hwRetiCycles}c RETI
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-400" />진행 중 명령 대기</span>
          {metrics.sleepCycles > 0 && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-400" />슬립 기상</span>}
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" />HW PC 푸시 ({mcuHw.pcStackBytes}B)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />벡터 점프 ({mcuHw.supportsRjmpVector && vectorJumpType === 'rjmp' ? 'RJMP' : 'JMP'})</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-400" />SW 프롤로그 (SREG/GPR)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-300" />사용자 본체 코드</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />SW 에필로그</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal-400" />HW RETI</span>
        </div>
      </div>

      {/* Assembly Instruction Disassembly with Line-by-Line Cycles */}
      <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-white">
              실제 AVR-GCC 어셈블리 명령어별 사이클 및 스택 심층 분석 ({mcuHw.name} - {activeVector.name})
            </span>
          </div>
          <button
            onClick={copyAsmText}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs transition"
          >
            {copiedAsm ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedAsm ? '복사됨' : '어셈블리 복사'}
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800/80 bg-slate-900/50">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-2 px-3">어셈블리 명령어 (Opcode)</th>
                <th className="py-2 px-3 text-center">소요 사이클</th>
                <th className="py-2 px-3 text-center">코드 크기</th>
                <th className="py-2 px-3">하드웨어 및 링커 상세 동작</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {generatedAsm.map((row, idx) => (
                <tr key={idx} className={row.code.startsWith(';') || row.code.startsWith('\n;') ? 'bg-slate-950/60 text-slate-500 font-sans text-[11px]' : 'hover:bg-slate-900/80'}>
                  <td className="py-1.5 px-3 whitespace-pre font-bold text-cyan-300">{row.code}</td>
                  <td className="py-1.5 px-3 text-center font-bold text-amber-400">{row.cyc || '-'}</td>
                  <td className="py-1.5 px-3 text-center text-slate-400">{row.bytes || '-'}</td>
                  <td className="py-1.5 px-3 text-slate-400 font-sans text-[11px]">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
