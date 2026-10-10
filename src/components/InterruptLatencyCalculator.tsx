import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Clock,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
  Cpu,
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
  Bookmark
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type InterruptPreset =
  | 'custom'
  | 'naked_minimal'
  | 'flag_toggle'
  | 'gcc_standard'
  | 'math_heavy'
  | 'frame_pointer_local'
  | 'sleep_wakeup';

export interface RegisterSaveConfig {
  saveSreg: boolean;
  saveR0: boolean;
  saveR1: boolean;
  clrR1: boolean;
  scratchCount: number; // r18..r27 (0 to 10)
  saveFramePointerY: boolean; // r28, r29 (+4 cyc push, +4 cyc pop)
  saveZPointer: boolean; // r30, r31 (+4 cyc push, +4 cyc pop)
  customGprCount: number; // additional GPRs (0 to 16)
}

export interface DisassemblyStep {
  phase: 'Entry (HW)' | 'Entry (SW)' | 'ISR Body' | 'Exit (SW)' | 'Exit (HW)';
  instruction: string;
  cycles: number;
  stackDelta: number;
  description: string;
}

export const InterruptLatencyCalculator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Configurable System Parameters
  const [clockMhz, setClockMhz] = useState<number>(16); // 1 to 20 MHz
  const [interruptedInstruction, setInterruptedInstruction] = useState<'single_cycle' | 'two_cycle' | 'three_cycle' | 'four_cycle_lpm'>('four_cycle_lpm');
  const [vectorSource, setVectorSource] = useState<string>('TIMER1_COMPA_vect');
  const [sleepWakeMode, setSleepWakeMode] = useState<'none' | 'idle_4cyc' | 'powerdown_6cyc'>('none');
  const [activePreset, setActivePreset] = useState<InterruptPreset>('gcc_standard');

  // Register Context Configuration
  const [regConfig, setRegConfig] = useState<RegisterSaveConfig>({
    saveSreg: true,
    saveR0: true,
    saveR1: true,
    clrR1: true,
    scratchCount: 2, // r24, r25 default
    saveFramePointerY: false,
    saveZPointer: false,
    customGprCount: 0
  });

  // ISR Execution Body Parameters
  const [isrBodyCycles, setIsrBodyCycles] = useState<number>(12); // typical small ISR body
  const [isrBodyDescription, setIsrBodyDescription] = useState<string>('핀 토글 및 플래그 갱신 (PORTB ^= _BV(5); tick++);');

  // Trigger Frequency Simulator (for CPU load computation)
  const [triggerFreqHz, setTriggerFreqHz] = useState<number>(10000); // 10 kHz default

  // Tab for Code Display
  const [codeViewTab, setCodeViewTab] = useState<'asm' | 'c_gcc'>('asm');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Apply Preset Handlers
  const handleApplyPreset = (preset: InterruptPreset) => {
    setActivePreset(preset);
    switch (preset) {
      case 'naked_minimal':
        setRegConfig({
          saveSreg: false,
          saveR0: false,
          saveR1: false,
          clrR1: false,
          scratchCount: 0,
          saveFramePointerY: false,
          saveZPointer: false,
          customGprCount: 0
        });
        setIsrBodyCycles(4);
        setIsrBodyDescription('직접 포트 조작 (sbi 0x05, 5 / cbi 0x05, 5)');
        setSleepWakeMode('none');
        break;

      case 'flag_toggle':
        setRegConfig({
          saveSreg: true,
          saveR0: true,
          saveR1: false,
          clrR1: false,
          scratchCount: 0,
          saveFramePointerY: false,
          saveZPointer: false,
          customGprCount: 0
        });
        setIsrBodyCycles(6);
        setIsrBodyDescription('단일 전역 플래그 설정 (flag = 1;)');
        setSleepWakeMode('none');
        break;

      case 'gcc_standard':
        setRegConfig({
          saveSreg: true,
          saveR0: true,
          saveR1: true,
          clrR1: true,
          scratchCount: 2, // r24, r25
          saveFramePointerY: false,
          saveZPointer: false,
          customGprCount: 0
        });
        setIsrBodyCycles(12);
        setIsrBodyDescription('타이머 틱 증가 및 조건 분기 (system_ticks++;)');
        setSleepWakeMode('none');
        break;

      case 'math_heavy':
        setRegConfig({
          saveSreg: true,
          saveR0: true,
          saveR1: true,
          clrR1: true,
          scratchCount: 8, // r18..r25
          saveFramePointerY: false,
          saveZPointer: false,
          customGprCount: 2
        });
        setIsrBodyCycles(35);
        setIsrBodyDescription('32비트 정수 연산 및 PID 제어식 산출');
        setSleepWakeMode('none');
        break;

      case 'frame_pointer_local':
        setRegConfig({
          saveSreg: true,
          saveR0: true,
          saveR1: true,
          clrR1: true,
          scratchCount: 4,
          saveFramePointerY: true,
          saveZPointer: true,
          customGprCount: 2
        });
        setIsrBodyCycles(50);
        setIsrBodyDescription('로컬 버퍼 스택 할당 및 룩업 테이블 Z-포인터 탐색');
        setSleepWakeMode('none');
        break;

      case 'sleep_wakeup':
        setRegConfig({
          saveSreg: true,
          saveR0: true,
          saveR1: true,
          clrR1: true,
          scratchCount: 2,
          saveFramePointerY: false,
          saveZPointer: false,
          customGprCount: 0
        });
        setIsrBodyCycles(10);
        setIsrBodyDescription('외부 핀 인터럽트로 MCU 웨이크업 후 클럭 안정화');
        setSleepWakeMode('idle_4cyc');
        break;

      case 'custom':
      default:
        break;
    }
  };

  // Detailed Step-by-Step & Cost Calculation
  const calculation = useMemo(() => {
    // 1. Pending instruction completion
    const interruptedCycles =
      interruptedInstruction === 'single_cycle'
        ? 1
        : interruptedInstruction === 'two_cycle'
        ? 2
        : interruptedInstruction === 'three_cycle'
        ? 3
        : 4; // LDS, STS, RET, RETI

    // 2. Hardware Vector Jump
    // <=128KB (ATmega640 64KB, ATmega128 128KB, ATmega328P 32KB) uses 16-bit PC (2 bytes pushed) -> 4 cycles
    const hwTrapPcPushCycles = 4;
    const pcBytes = 2;

    // 3. Vector table jump: RJMP (2 cycles, 328P) vs JMP (3 cycles, 640/128)
    const vectorTableJumpCycles = selectedMCU === 'atmega328p' ? 2 : 3;

    // 4. Sleep Wake-up Overhead
    const sleepCycles = sleepWakeMode === 'idle_4cyc' ? 4 : sleepWakeMode === 'powerdown_6cyc' ? 6 : 0;

    // Total Hardware Entry Latency
    const hwEntryCycles = interruptedCycles + hwTrapPcPushCycles + vectorTableJumpCycles + sleepCycles;

    // 5. Software Context Save (Prologue)
    let swPrologueCycles = 0;
    let pushedBytes = 0;
    const steps: DisassemblyStep[] = [];

    // Hardware steps
    steps.push({
      phase: 'Entry (HW)',
      instruction: `; [HW] 인터럽트 래칭 & 실행 중 명령 완료 대기`,
      cycles: interruptedCycles,
      stackDelta: 0,
      description: `현재 파이프라인에서 실행 중인 명령어 완료 (${interruptedInstruction})`
    });

    if (sleepCycles > 0) {
      steps.push({
        phase: 'Entry (HW)',
        instruction: `; [HW] 슬립 모드 오실레이터 웨이크업 안정화 지연`,
        cycles: sleepCycles,
        stackDelta: 0,
        description: `슬립 상태에서 메인 클럭 발진기 안정화 대기`
      });
    }

    steps.push({
      phase: 'Entry (HW)',
      instruction: `PUSH PCL / PUSH PCH`,
      cycles: hwTrapPcPushCycles,
      stackDelta: -pcBytes,
      description: `하드웨어가 PC(2바이트)를 스택에 자동 푸시하고 SREG I-비트 차단`
    });

    steps.push({
      phase: 'Entry (HW)',
      instruction: selectedMCU === 'atmega328p' ? `rjmp  __vector_1` : `jmp   __vector_1`,
      cycles: vectorTableJumpCycles,
      stackDelta: 0,
      description: `인터럽트 벡터 테이블에서 실제 ISR 시작 주소로 분기`
    });

    // Software prologue steps
    if (regConfig.saveR0) {
      swPrologueCycles += 2;
      pushedBytes += 1;
      steps.push({
        phase: 'Entry (SW)',
        instruction: `push  r0`,
        cycles: 2,
        stackDelta: -1,
        description: `임시 레지스터(__tmp_reg__) 스택 보존`
      });
    }

    if (regConfig.saveSreg) {
      swPrologueCycles += 1; // in r0, __SREG__
      swPrologueCycles += 2; // push r0
      pushedBytes += 1;
      steps.push({
        phase: 'Entry (SW)',
        instruction: `in    r0, 0x3f    ; __SREG__`,
        cycles: 1,
        stackDelta: 0,
        description: `CPU 상태 레지스터(SREG: 플래그 C, Z, N, V 등)를 r0로 복사`
      });
      steps.push({
        phase: 'Entry (SW)',
        instruction: `push  r0`,
        cycles: 2,
        stackDelta: -1,
        description: `SREG 복사본을 스택에 푸시하여 보존`
      });
    }

    if (regConfig.saveR1) {
      swPrologueCycles += 2; // push r1
      pushedBytes += 1;
      steps.push({
        phase: 'Entry (SW)',
        instruction: `push  r1`,
        cycles: 2,
        stackDelta: -1,
        description: `영(Zero) 레지스터(__zero_reg__) 스택 보존`
      });

      if (regConfig.clrR1) {
        swPrologueCycles += 1; // clr r1 (eor r1, r1)
        steps.push({
          phase: 'Entry (SW)',
          instruction: `clr   r1          ; eor r1, r1`,
          cycles: 1,
          stackDelta: 0,
          description: `GCC C 런타임 규약 보장: r1을 0x00으로 초기화`
        });
      }
    }

    // Scratch registers
    for (let i = 0; i < regConfig.scratchCount; i++) {
      const regName = `r${24 - i >= 18 ? 24 - i : 18 + i}`;
      swPrologueCycles += 2;
      pushedBytes += 1;
      steps.push({
        phase: 'Entry (SW)',
        instruction: `push  ${regName}`,
        cycles: 2,
        stackDelta: -1,
        description: `스크래치 작업 레지스터 ${regName} 스택 보존`
      });
    }

    // Frame pointer Y (r28, r29)
    if (regConfig.saveFramePointerY) {
      swPrologueCycles += 4;
      pushedBytes += 2;
      steps.push({
        phase: 'Entry (SW)',
        instruction: `push  r28`,
        cycles: 2,
        stackDelta: -1,
        description: `프레임 포인터 Y-하위(r28) 스택 보존`
      });
      steps.push({
        phase: 'Entry (SW)',
        instruction: `push  r29`,
        cycles: 2,
        stackDelta: -1,
        description: `프레임 포인터 Y-상위(r29) 스택 보존`
      });
    }

    // Z pointer (r30, r31)
    if (regConfig.saveZPointer) {
      swPrologueCycles += 4;
      pushedBytes += 2;
      steps.push({
        phase: 'Entry (SW)',
        instruction: `push  r30`,
        cycles: 2,
        stackDelta: -1,
        description: `메모리/테이블 포인터 Z-하위(r30) 스택 보존`
      });
      steps.push({
        phase: 'Entry (SW)',
        instruction: `push  r31`,
        cycles: 2,
        stackDelta: -1,
        description: `메모리/테이블 포인터 Z-상위(r31) 스택 보존`
      });
    }

    // Custom GPRs
    for (let i = 0; i < regConfig.customGprCount; i++) {
      const regName = `r${16 - i >= 2 ? 16 - i : 2 + i}`;
      swPrologueCycles += 2;
      pushedBytes += 1;
      steps.push({
        phase: 'Entry (SW)',
        instruction: `push  ${regName}`,
        cycles: 2,
        stackDelta: -1,
        description: `추가 범용 레지스터 ${regName} 스택 보존`
      });
    }

    // 6. Total Entry Latency
    const totalEntryCycles = hwEntryCycles + swPrologueCycles;

    // 7. ISR Body Steps
    steps.push({
      phase: 'ISR Body',
      instruction: `; --- [사용자 C 코드 실행 시작] ---`,
      cycles: isrBodyCycles,
      stackDelta: 0,
      description: isrBodyDescription
    });

    // 8. Software Context Restore (Epilogue / Exit)
    let swEpilogueCycles = 0;

    // Pop Custom GPRs (reverse)
    for (let i = regConfig.customGprCount - 1; i >= 0; i--) {
      const regName = `r${16 - i >= 2 ? 16 - i : 2 + i}`;
      swEpilogueCycles += 2;
      steps.push({
        phase: 'Exit (SW)',
        instruction: `pop   ${regName}`,
        cycles: 2,
        stackDelta: +1,
        description: `추가 범용 레지스터 ${regName} 복원`
      });
    }

    // Pop Z pointer
    if (regConfig.saveZPointer) {
      swEpilogueCycles += 4;
      steps.push({
        phase: 'Exit (SW)',
        instruction: `pop   r31`,
        cycles: 2,
        stackDelta: +1,
        description: `포인터 Z-상위(r31) 복원`
      });
      steps.push({
        phase: 'Exit (SW)',
        instruction: `pop   r30`,
        cycles: 2,
        stackDelta: +1,
        description: `포인터 Z-하위(r30) 복원`
      });
    }

    // Pop Frame pointer Y
    if (regConfig.saveFramePointerY) {
      swEpilogueCycles += 4;
      steps.push({
        phase: 'Exit (SW)',
        instruction: `pop   r29`,
        cycles: 2,
        stackDelta: +1,
        description: `프레임 포인터 Y-상위(r29) 복원`
      });
      steps.push({
        phase: 'Exit (SW)',
        instruction: `pop   r28`,
        cycles: 2,
        stackDelta: +1,
        description: `프레임 포인터 Y-하위(r28) 복원`
      });
    }

    // Pop Scratch registers (reverse)
    for (let i = regConfig.scratchCount - 1; i >= 0; i--) {
      const regName = `r${24 - i >= 18 ? 24 - i : 18 + i}`;
      swEpilogueCycles += 2;
      steps.push({
        phase: 'Exit (SW)',
        instruction: `pop   ${regName}`,
        cycles: 2,
        stackDelta: +1,
        description: `스크래치 작업 레지스터 ${regName} 복원`
      });
    }

    // Pop r1
    if (regConfig.saveR1) {
      swEpilogueCycles += 2;
      steps.push({
        phase: 'Exit (SW)',
        instruction: `pop   r1`,
        cycles: 2,
        stackDelta: +1,
        description: `영 레지스터(__zero_reg__) 복원`
      });
    }

    // Pop SREG
    if (regConfig.saveSreg) {
      swEpilogueCycles += 2; // pop r0
      swEpilogueCycles += 1; // out SREG, r0
      steps.push({
        phase: 'Exit (SW)',
        instruction: `pop   r0`,
        cycles: 2,
        stackDelta: +1,
        description: `스택에서 보존했던 SREG 값을 r0로 팝`
      });
      steps.push({
        phase: 'Exit (SW)',
        instruction: `out   0x3f, r0    ; __SREG__`,
        cycles: 1,
        stackDelta: 0,
        description: `CPU 상태 레지스터(SREG) 원본 복원`
      });
    }

    // Pop r0
    if (regConfig.saveR0) {
      swEpilogueCycles += 2;
      steps.push({
        phase: 'Exit (SW)',
        instruction: `pop   r0`,
        cycles: 2,
        stackDelta: +1,
        description: `임시 레지스터(__tmp_reg__) 원본 복원`
      });
    }

    // 9. Hardware Exit: RETI instruction
    const hwRetiCycles = 4;
    steps.push({
      phase: 'Exit (HW)',
      instruction: `reti`,
      cycles: hwRetiCycles,
      stackDelta: +pcBytes,
      description: `스택에서 복귀 PC 팝 복원 (2B) 및 전역 인터럽트 I-비트 자동 인에이블`
    });

    const totalExitCycles = swEpilogueCycles + hwRetiCycles;
    const totalRoundTripCycles = totalEntryCycles + isrBodyCycles + totalExitCycles;
    const totalStackConsumedBytes = pcBytes + pushedBytes;

    // Time calculations
    const cycleTimeNs = (1 / (clockMhz * 1e6)) * 1e9;
    const entryLatencyNs = totalEntryCycles * cycleTimeNs;
    const exitLatencyNs = totalExitCycles * cycleTimeNs;
    const isrBodyDurationNs = isrBodyCycles * cycleTimeNs;
    const totalDurationNs = totalRoundTripCycles * cycleTimeNs;

    // CPU Load & Maximum Trigger Rate
    const maxSafeTriggerFreqHz = Math.floor((clockMhz * 1e6) / totalRoundTripCycles);
    const cpuLoadPct = Math.min(100, Number(((totalRoundTripCycles * triggerFreqHz) / (clockMhz * 1e6) * 100).toFixed(2)));

    // Cumulative timelines for step table
    let cumCycles = 0;
    const annotatedSteps = steps.map((s, idx) => {
      cumCycles += s.cycles;
      return {
        ...s,
        stepIndex: idx + 1,
        cumCycles,
        cumTimeNs: Number((cumCycles * cycleTimeNs).toFixed(1))
      };
    });

    return {
      interruptedCycles,
      hwTrapPcPushCycles,
      vectorTableJumpCycles,
      sleepCycles,
      hwEntryCycles,
      swPrologueCycles,
      totalEntryCycles,
      isrBodyCycles,
      swEpilogueCycles,
      hwRetiCycles,
      totalExitCycles,
      totalRoundTripCycles,
      totalStackConsumedBytes,
      pushedRegisterCount: pushedBytes,
      cycleTimeNs: Number(cycleTimeNs.toFixed(2)),
      entryLatencyNs: Number(entryLatencyNs.toFixed(1)),
      entryLatencyUs: Number((entryLatencyNs / 1000).toFixed(3)),
      exitLatencyNs: Number(exitLatencyNs.toFixed(1)),
      exitLatencyUs: Number((exitLatencyNs / 1000).toFixed(3)),
      isrBodyDurationNs: Number(isrBodyDurationNs.toFixed(1)),
      totalDurationNs: Number(totalDurationNs.toFixed(1)),
      totalDurationUs: Number((totalDurationNs / 1000).toFixed(3)),
      maxSafeTriggerFreqHz,
      cpuLoadPct,
      annotatedSteps
    };
  }, [
    interruptedInstruction,
    selectedMCU,
    clockMhz,
    sleepWakeMode,
    regConfig,
    isrBodyCycles,
    isrBodyDescription,
    triggerFreqHz
  ]);

  // Chart Data
  const chartData = [
    { name: '1. 명령완료 대기', cycles: calculation.interruptedCycles, fill: '#f59e0b', category: 'Entry' },
    { name: '2. HW 트랩 (PC스택)', cycles: calculation.hwTrapPcPushCycles, fill: '#3b82f6', category: 'Entry' },
    { name: '3. 벡터테이블 JMP', cycles: calculation.vectorTableJumpCycles, fill: '#6366f1', category: 'Entry' },
    ...(calculation.sleepCycles > 0
      ? [{ name: '슬립 웨이크업', cycles: calculation.sleepCycles, fill: '#ec4899', category: 'Entry' }]
      : []),
    { name: '4. 문맥저장(Prologue)', cycles: calculation.swPrologueCycles, fill: '#10b981', category: 'Entry' },
    { name: '5. ISR 본문 실행', cycles: calculation.isrBodyCycles, fill: '#8b5cf6', category: 'Body' },
    { name: '6. 문맥복원(Epilogue)', cycles: calculation.swEpilogueCycles, fill: '#06b6d4', category: 'Exit' },
    { name: '7. RETI 복귀', cycles: calculation.hwRetiCycles, fill: '#38bdf8', category: 'Exit' }
  ];

  // Generated Source Code
  const generatedCode = useMemo(() => {
    const isNaked =
      !regConfig.saveSreg &&
      !regConfig.saveR0 &&
      !regConfig.saveR1 &&
      regConfig.scratchCount === 0 &&
      !regConfig.saveFramePointerY &&
      !regConfig.saveZPointer &&
      regConfig.customGprCount === 0;

    const asmCode = `; ==========================================================
; [${currentProfile.name}] 정밀 ISR 진입/복귀 어셈블리 트레이스
; F_CPU: ${clockMhz}MHz (1 사이클 = ${calculation.cycleTimeNs}ns)
; 진입 지연: ${calculation.totalEntryCycles} 사이클 (${calculation.entryLatencyNs}ns / ${calculation.entryLatencyUs}µs)
; 본문 실행: ${calculation.isrBodyCycles} 사이클 (${calculation.isrBodyDurationNs}ns)
; 복귀 비용: ${calculation.totalExitCycles} 사이클 (${calculation.exitLatencyNs}ns / ${calculation.exitLatencyUs}µs)
; 왕복 총합: ${calculation.totalRoundTripCycles} 사이클 (${calculation.totalDurationUs}µs) | 스택 점유: ${calculation.totalStackConsumedBytes} Bytes
; ==========================================================

.global ${vectorSource}
${vectorSource}:
; --- [1. 진입 단계 / 문맥 보존 프롤로그 (Prologue)] ---
${calculation.annotatedSteps
  .filter((s) => s.phase === 'Entry (SW)')
  .map((s) => `    ${s.instruction.padEnd(20, ' ')} ; [${s.cycles} cyc] ${s.description}`)
  .join('\n')}

; --- [2. 사용자 작업 본문 (ISR Body)] ---
    ; ${isrBodyDescription}
    ; (약 ${calculation.isrBodyCycles} CPU 사이클 실행)

; --- [3. 복귀 단계 / 문맥 복원 에필로그 (Epilogue)] ---
${calculation.annotatedSteps
  .filter((s) => s.phase === 'Exit (SW)')
  .map((s) => `    ${s.instruction.padEnd(20, ' ')} ; [${s.cycles} cyc] ${s.description}`)
  .join('\n')}

; --- [4. 하드웨어 복귀 (Return from Interrupt)] ---
    reti                 ; [4 cyc] PC 팝 복원 및 전역 인터럽트(I) 자동 인에이블
`;

    const cCode = `// ==========================================================
// [${currentProfile.name}] AVR-GCC 최적화 ISR 루틴
// F_CPU: ${clockMhz}MHz (클럭 주기: ${calculation.cycleTimeNs}ns)
// 사용자 코드 도달 지연 (Latency): ${calculation.totalEntryCycles} 사이클 (${calculation.entryLatencyNs} ns)
// 루틴 복귀 오버헤드 (Exit Cost): ${calculation.totalExitCycles} 사이클 (${calculation.exitLatencyNs} ns)
// 총 왕복 소요 시간: ${calculation.totalDurationUs} µs (최대 안전 주기: ${calculation.maxSafeTriggerFreqHz.toLocaleString()} Hz)
// ==========================================================
#include <avr/io.h>
#include <avr/interrupt.h>

${
  isNaked
    ? `// ISR_NAKED: 컴파일러의 자동 레지스터 백업 생략 (극한의 초저지연)
ISR(${vectorSource}, ISR_NAKED) {
    // 1. 필요한 레지스터만 인라인 어셈블리로 수동 백업
    __asm__ __volatile__ (
        "push r16          \\n\\t"
        "in   r16, __SREG__ \\n\\t"
        "push r16          \\n\\t"
    );

    // 2. 고속 하드웨어 작업
    PORTB ^= (1 << PB5); // ${isrBodyDescription}

    // 3. 수동 복원 및 즉시 RETI
    __asm__ __volatile__ (
        "pop  r16          \\n\\t"
        "out  __SREG__, r16 \\n\\t"
        "pop  r16          \\n\\t"
        "reti              \\n\\t"
    );
}`
    : `// 표준 컴파일러 ISR: 레지스터 ${calculation.pushedRegisterCount}개 + SREG 자동 저장/복원
ISR(${vectorSource}) {
    // 하드웨어적으로 SREG의 전역 인터럽트 플래그(I-비트)가 차단된 상태입니다.
    // 진입 프롤로그(${calculation.totalEntryCycles} 사이클)가 완료된 후 이 블록이 실행됩니다.

    // [사용자 로직]
    ${isrBodyDescription}

    // 블록 종료 시 에필로그(${calculation.totalExitCycles} 사이클)가 수행되어
    // 레지스터 원본 복원 후 reti 명령으로 중단 지점으로 복귀합니다.
}`
}`;

    return { asmCode, cCode };
  }, [
    currentProfile,
    clockMhz,
    calculation,
    vectorSource,
    regConfig,
    isrBodyDescription
  ]);

  const handleCopyCode = () => {
    const textToCopy = codeViewTab === 'asm' ? generatedCode.asmCode : generatedCode.cCode;
    navigator.clipboard.writeText(textToCopy);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5" />
              Interrupt Service Routine (ISR) Latency Calculator
            </span>
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {currentProfile.name} • 1 사이클 = {calculation.cycleTimeNs} ns (@{clockMhz}MHz)
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              스택 점유: {calculation.totalStackConsumedBytes} Bytes (SRAM {currentProfile.sram}B)
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            인터럽트 서비스 루틴(ISR) 진입 · 복귀 지연 및 문맥 보존/복원 사이클 계산기
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-4xl leading-relaxed">
            AVR RISC 아키텍처에서 인터럽트 트리거 순간부터 명령어 완료, 하드웨어 벡터 점프, 컴파일러 프롤로그(SREG 및 범용 레지스터 PUSH),
            사용자 C 코드 실행, 그리고 에필로그(POP) 및 RETI 복귀까지의 **정밀 사이클 비용(Entering & Exiting Cycle Cost)**을 완벽히 계산합니다.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleApplyPreset('gcc_standard')}
            className="inline-flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-medium transition"
            title="기본값 복원"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            초기화
          </button>
          <button
            onClick={handleCopyCode}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition shadow-sm"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? '복사 완료!' : 'ISR 코드 복사'}</span>
          </button>
        </div>
      </div>

      {/* Preset Selector Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            원클릭 동작 모드 & 시나리오 프리셋
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {activePreset === 'custom' ? '사용자 정의 설정 활성화됨' : `현재 프리셋: ${activePreset}`}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { id: 'naked_minimal', label: '1. 초경량 Naked', desc: 'PUSH/POP 생략, 9 사이클' },
            { id: 'flag_toggle', label: '2. 플래그 토글', desc: 'SREG만 백업, 17 사이클' },
            { id: 'gcc_standard', label: '3. 표준 AVR-GCC', desc: 'SREG+r0+r1+r24/25, 29 사이클' },
            { id: 'math_heavy', label: '4. 고연산 핸들러', desc: '8개 레지스터 백업, 45 사이클' },
            { id: 'frame_pointer_local', label: '5. 로컬스택 프레임', desc: 'Y-포인터 + Z테이블, 65 사이클' },
            { id: 'sleep_wakeup', label: '6. 절전 모드 복귀', desc: 'Idle 클럭 웨이크업 포함' }
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleApplyPreset(preset.id as InterruptPreset)}
              className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                activePreset === preset.id
                  ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="text-xs font-bold">{preset.label}</div>
              <div className="text-[10px] text-slate-400 mt-1 font-mono leading-tight">{preset.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Primary KPI Metric Cards (Entering vs Exiting vs Total) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Entering Cost */}
        <div className="bg-slate-950/80 border border-amber-500/30 p-4 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span className="font-semibold text-amber-300 flex items-center gap-1.5">
              <CornerDownRight className="w-3.5 h-3.5" />
              ISR 진입 비용 (Entering Cost)
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
              HW + 프롤로그
            </span>
          </div>
          <div className="text-3xl font-black font-mono text-white mt-2">
            {calculation.totalEntryCycles} <span className="text-xs font-normal text-slate-400">Cycles</span>
          </div>
          <div className="text-xs text-amber-400 font-mono mt-1 flex items-center gap-2">
            <span>{calculation.entryLatencyNs} ns</span>
            <span className="text-slate-500">|</span>
            <span>{calculation.entryLatencyUs} µs</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-2 border-t border-slate-800/80 pt-1.5 leading-snug">
            HW 벡터 트랩({calculation.hwTrapPcPushCycles}c) + 점프({calculation.vectorTableJumpCycles}c) + 보존({calculation.swPrologueCycles}c)
          </div>
        </div>

        {/* KPI 2: ISR Execution Body */}
        <div className="bg-slate-950/80 border border-purple-500/30 p-4 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span className="font-semibold text-purple-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              본문 실행 (Payload Body)
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
              사용자 C 로직
            </span>
          </div>
          <div className="text-3xl font-black font-mono text-white mt-2">
            {calculation.isrBodyCycles} <span className="text-xs font-normal text-slate-400">Cycles</span>
          </div>
          <div className="text-xs text-purple-400 font-mono mt-1 flex items-center gap-2">
            <span>{calculation.isrBodyDurationNs} ns</span>
            <span className="text-slate-500">|</span>
            <span>{(calculation.isrBodyDurationNs / 1000).toFixed(3)} µs</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-2 border-t border-slate-800/80 pt-1.5 leading-snug truncate">
            {isrBodyDescription}
          </div>
        </div>

        {/* KPI 3: Exiting Cost */}
        <div className="bg-slate-950/80 border border-cyan-500/30 p-4 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5" />
              ISR 복귀 비용 (Exiting Cost)
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
              에필로그 + RETI
            </span>
          </div>
          <div className="text-3xl font-black font-mono text-white mt-2">
            {calculation.totalExitCycles} <span className="text-xs font-normal text-slate-400">Cycles</span>
          </div>
          <div className="text-xs text-cyan-400 font-mono mt-1 flex items-center gap-2">
            <span>{calculation.exitLatencyNs} ns</span>
            <span className="text-slate-500">|</span>
            <span>{calculation.exitLatencyUs} µs</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-2 border-t border-slate-800/80 pt-1.5 leading-snug">
            문맥 복원 POP({calculation.swEpilogueCycles}c) + RETI 명령어({calculation.hwRetiCycles}c)
          </div>
        </div>

        {/* KPI 4: Total Round-Trip & Overhead */}
        <div className="bg-slate-950/80 border border-emerald-500/30 p-4 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              왕복 총합 (Total Round-Trip)
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              순수 오버헤드 {(calculation.totalEntryCycles + calculation.totalExitCycles)}c
            </span>
          </div>
          <div className="text-3xl font-black font-mono text-white mt-2">
            {calculation.totalRoundTripCycles} <span className="text-xs font-normal text-slate-400">Cycles</span>
          </div>
          <div className="text-xs text-emerald-400 font-mono mt-1 flex items-center gap-2">
            <span>{calculation.totalDurationNs} ns</span>
            <span className="text-slate-500">|</span>
            <span>{calculation.totalDurationUs} µs</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-2 border-t border-slate-800/80 pt-1.5 leading-snug">
            최대 허용 빈도: {calculation.maxSafeTriggerFreqHz.toLocaleString()} Hz (포화 직전)
          </div>
        </div>
      </div>

      {/* Main Configuration Grid: 3 Interactive Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: MCU Hardware & Clock Parameters */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-400" />
              1. MCU 및 하드웨어 조건
            </h4>
            <span className="text-[10px] font-mono text-slate-400">{currentProfile.name}</span>
          </div>

          {/* MCU Target Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 font-medium block">대상 마이크로컨트롤러 (MCU)</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcu) => (
                <button
                  key={mcu}
                  onClick={() => onSelectMCU?.(mcu)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition ${
                    selectedMCU === mcu
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {mcu === 'atmega640' ? 'ATmega640' : mcu === 'atmega128' ? 'ATmega128' : 'ATmega328P'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              {selectedMCU === 'atmega328p'
                ? '328P: Flash 32KB, 16비트 PC(스택 2바이트), 벡터 테이블 RJMP(2사이클)'
                : selectedMCU === 'atmega128'
                ? '128: Flash 128KB, 16비트 PC(스택 2바이트), 벡터 테이블 JMP(3사이클)'
                : '640: Flash 64KB, 16비트 PC(스택 2바이트), 벡터 테이블 JMP(3사이클)'}
            </p>
          </div>

          {/* Clock Speed Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-slate-400 font-medium">
              <span>시스템 클럭 주파수 (F_CPU)</span>
              <span className="text-amber-400 font-mono font-bold">{clockMhz} MHz</span>
            </div>
            <input
              type="range"
              min="1"
              max={selectedMCU === 'atmega328p' ? 20 : 16}
              step="1"
              value={clockMhz}
              onChange={(e) => setClockMhz(parseInt(e.target.value))}
              className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>1 MHz</span>
              <span className="text-amber-300/80">주기: {calculation.cycleTimeNs} ns/clk</span>
              <span>{selectedMCU === 'atmega328p' ? '20 MHz' : '16 MHz (정격)'}</span>
            </div>
          </div>

          {/* Quick Frequency Presets */}
          <div className="flex items-center gap-1.5 pt-1">
            {[1, 8, 12, 16, ...(selectedMCU === 'atmega328p' ? [20] : [])].map((freq) => (
              <button
                key={freq}
                onClick={() => setClockMhz(freq)}
                className={`flex-1 py-1 text-[10px] font-mono rounded border transition ${
                  clockMhz === freq
                    ? 'bg-amber-500/25 border-amber-500/60 text-amber-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {freq}M
              </button>
            ))}
          </div>

          {/* Trigger Instruction Completion Status */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] text-slate-400 font-medium block">
              인터럽트 발생 순간 선행 명령어 상태 (Worst-Case)
            </label>
            <select
              value={interruptedInstruction}
              onChange={(e) => {
                setInterruptedInstruction(e.target.value as any);
                setActivePreset('custom');
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
            >
              <option value="four_cycle_lpm">최악 조건: 4 사이클 명령 (LDS, STS, LPM, RETI 등)</option>
              <option value="three_cycle">3 사이클 명령 (CALL, JMP, ST X+)</option>
              <option value="two_cycle">2 사이클 명령 (RJMP, 브랜치 BRNE, SBI/CBI)</option>
              <option value="single_cycle">최선 조건: 1 사이클 명령 (NOP, ADD, SUB, IN)</option>
            </select>
          </div>

          {/* Sleep Wakeup Mode */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] text-slate-400 font-medium block">
              절전(Sleep) 복귀 오실레이터 지연
            </label>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'none', label: '일반 동작 (0c)' },
                { id: 'idle_4cyc', label: 'Idle 슬립 (+4c)' },
                { id: 'powerdown_6cyc', label: 'Power-down (+6c)' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSleepWakeMode(m.id as any);
                    setActivePreset('custom');
                  }}
                  className={`p-1.5 rounded text-[10px] border text-center transition ${
                    sleepWakeMode === m.id
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Column 2: Context Save / Restore Register Matrix */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              2. 문맥 보존/복원 레지스터 매트릭스
            </h4>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              총 {calculation.pushedRegisterCount}개 레지스터
            </span>
          </div>

          {/* SREG Toggle */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
            <div>
              <div className="text-xs font-bold text-slate-200">상태 레지스터 (SREG)</div>
              <div className="text-[10px] text-slate-400">in r0, SREG + push r0 (진입 3c / 복귀 3c)</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={regConfig.saveSreg}
                onChange={(e) => {
                  setRegConfig({ ...regConfig, saveSreg: e.target.checked });
                  setActivePreset('custom');
                }}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* R0 and R1 Toggles */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">r0 (__tmp_reg__)</div>
                <div className="text-[10px] text-slate-400">push/pop 4c</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={regConfig.saveR0}
                  onChange={(e) => {
                    setRegConfig({ ...regConfig, saveR0: e.target.checked });
                    setActivePreset('custom');
                  }}
                  className="sr-only peer"
                />
                <div className="w-7 h-3.5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">r1 (__zero_reg__)</div>
                <div className="text-[10px] text-slate-400">push/clr/pop 5c</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={regConfig.saveR1}
                  onChange={(e) => {
                    setRegConfig({ ...regConfig, saveR1: e.target.checked });
                    setActivePreset('custom');
                  }}
                  className="sr-only peer"
                />
                <div className="w-7 h-3.5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>

          {/* Scratch Registers Slider (r18..r27) */}
          <div className="space-y-1.5 p-2 rounded-lg bg-slate-900 border border-slate-800">
            <div className="flex justify-between text-[11px] text-slate-300 font-medium">
              <span>스크래치 연산 레지스터 (r18~r27)</span>
              <span className="text-emerald-400 font-mono font-bold">{regConfig.scratchCount}개</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={regConfig.scratchCount}
              onChange={(e) => {
                setRegConfig({ ...regConfig, scratchCount: parseInt(e.target.value) });
                setActivePreset('custom');
              }}
              className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0개 (연산 없음)</span>
              <span className="text-emerald-400/80">소요: {regConfig.scratchCount * 4} 사이클</span>
              <span>10개 (복잡 수식)</span>
            </div>
          </div>

          {/* Pointer Registers (Y Frame Pointer & Z Table Pointer) */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">Y-프레임(r28,r29)</div>
                <div className="text-[10px] text-slate-400">로컬 변수 (+8c)</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={regConfig.saveFramePointerY}
                  onChange={(e) => {
                    setRegConfig({ ...regConfig, saveFramePointerY: e.target.checked });
                    setActivePreset('custom');
                  }}
                  className="sr-only peer"
                />
                <div className="w-7 h-3.5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">Z-포인터(r30,r31)</div>
                <div className="text-[10px] text-slate-400">LPM/테이블 (+8c)</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={regConfig.saveZPointer}
                  onChange={(e) => {
                    setRegConfig({ ...regConfig, saveZPointer: e.target.checked });
                    setActivePreset('custom');
                  }}
                  className="sr-only peer"
                />
                <div className="w-7 h-3.5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>

          {/* Custom Additional GPRs */}
          <div className="space-y-1.5 p-2 rounded-lg bg-slate-900 border border-slate-800">
            <div className="flex justify-between text-[11px] text-slate-300 font-medium">
              <span>추가 범용 레지스터 (GPR r2~r17)</span>
              <span className="text-cyan-400 font-mono font-bold">{regConfig.customGprCount}개</span>
            </div>
            <input
              type="range"
              min="0"
              max="16"
              step="1"
              value={regConfig.customGprCount}
              onChange={(e) => {
                setRegConfig({ ...regConfig, customGprCount: parseInt(e.target.value) });
                setActivePreset('custom');
              }}
              className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0개</span>
              <span className="text-cyan-400/80">+{regConfig.customGprCount * 4} 사이클</span>
              <span>16개 (최대)</span>
            </div>
          </div>
        </div>

        {/* Column 3: ISR Payload & CPU Load / Starvation Simulation */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Gauge className="w-4 h-4 text-purple-400" />
              3. ISR 본문 및 CPU 부하 시뮬레이션
            </h4>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
              calculation.cpuLoadPct > 80
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : calculation.cpuLoadPct > 50
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
            }`}>
              부하 {calculation.cpuLoadPct}%
            </span>
          </div>

          {/* User Code Cycles Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-slate-300 font-medium">
              <span>사용자 C 코드 실행 비용 (Payload)</span>
              <span className="text-purple-400 font-mono font-bold">{isrBodyCycles} Cycles</span>
            </div>
            <input
              type="range"
              min="2"
              max="120"
              step="2"
              value={isrBodyCycles}
              onChange={(e) => {
                setIsrBodyCycles(parseInt(e.target.value));
                setActivePreset('custom');
              }}
              className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>2 Cycles (단순 sbi)</span>
              <span className="text-purple-400">{calculation.isrBodyDurationNs} ns</span>
              <span>120 Cycles (대용량 버퍼)</span>
            </div>
          </div>

          {/* Interrupt Trigger Frequency for CPU load */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-slate-300 font-medium">
              <span>인터럽트 발생 빈도 (Trigger Rate)</span>
              <span className="text-indigo-400 font-mono font-bold">
                {triggerFreqHz >= 1000 ? `${(triggerFreqHz / 1000).toFixed(1)} kHz` : `${triggerFreqHz} Hz`}
              </span>
            </div>
            <input
              type="range"
              min="100"
              max="100000"
              step="100"
              value={triggerFreqHz}
              onChange={(e) => setTriggerFreqHz(parseInt(e.target.value))}
              className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>100 Hz</span>
              <span>10 kHz (표준)</span>
              <span>100 kHz (초고주파)</span>
            </div>
          </div>

          {/* CPU Load Progress Meter */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold">MCU 전체 CPU 점유율</span>
              <span className={`font-mono font-bold ${
                calculation.cpuLoadPct > 80 ? 'text-rose-400' : calculation.cpuLoadPct > 50 ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {calculation.cpuLoadPct}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  calculation.cpuLoadPct > 80 ? 'bg-rose-500' : calculation.cpuLoadPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${calculation.cpuLoadPct}%` }}
              />
            </div>
            {calculation.cpuLoadPct > 80 ? (
              <div className="flex items-center gap-1.5 text-[10px] text-rose-400 bg-rose-500/10 p-1.5 rounded border border-rose-500/30">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>경고: CPU 기아(Starvation) 위험! 메인 루프 실행 시간이 부족합니다.</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>정상: 남은 {(100 - calculation.cpuLoadPct).toFixed(1)}% 대역폭으로 메인 루틴 처리 가능</span>
              </div>
            )}
          </div>

          {/* Vector Source Selection */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 font-medium block">인터럽트 벡터 명칭 (AVR Vector)</label>
            <select
              value={vectorSource}
              onChange={(e) => setVectorSource(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
            >
              <option value="TIMER1_COMPA_vect">TIMER1_COMPA_vect (타이머 1 비교일치 A)</option>
              <option value="TIMER0_OVF_vect">TIMER0_OVF_vect (타이머 0 오버플로우 / millis)</option>
              <option value="INT0_vect">INT0_vect (외부 핀 인터럽트 0)</option>
              <option value="USART0_RX_vect">USART0_RX_vect (시리얼 수신 완료)</option>
              <option value="ADC_vect">ADC_vect (ADC 변환 완료)</option>
              <option value="PCINT0_vect">PCINT0_vect (핀 변화 인터럽트 0)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cycle Breakdown Visual Chart */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              단계별 클럭 사이클 분해 차트 (Entering vs Payload vs Exiting)
            </h4>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono">
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> 진입 단계 (Entry: {calculation.totalEntryCycles}c)
            </span>
            <span className="flex items-center gap-1 text-purple-400">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span> 본문 실행 (Body: {calculation.isrBodyCycles}c)
            </span>
            <span className="flex items-center gap-1 text-cyan-400">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block"></span> 복귀 단계 (Exit: {calculation.totalExitCycles}c)
            </span>
          </div>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 15, right: 20, left: -10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} interval={0} angle={-12} textAnchor="end" />
              <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem' }}
                labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                formatter={(value: any) => [`${value} 사이클 (${(value * calculation.cycleTimeNs).toFixed(1)} ns)`, '소요 사이클']}
              />
              <Bar dataKey="cycles" name="소요 사이클" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Disassembly Execution Timeline Table */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              정밀 어셈블리 실행 타임라인 & 스택 포인터(ΔSP) 추적표
            </h4>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            총 {calculation.annotatedSteps.length}개 명령어 • 스택 소비 {calculation.totalStackConsumedBytes} Bytes
          </span>
        </div>

        <div className="max-h-64 overflow-y-auto custom-scrollbar border border-slate-800/80 rounded-lg">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/90 text-slate-400 sticky top-0 text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-2 px-3 w-12 text-center">단계</th>
                <th className="py-2 px-3 w-28">페이즈</th>
                <th className="py-2 px-3 w-44">어셈블리 명령어</th>
                <th className="py-2 px-3 w-20 text-center">소요 사이클</th>
                <th className="py-2 px-3 w-20 text-center">ΔSP 스택</th>
                <th className="py-2 px-3 w-28 text-right">누적 지연시간</th>
                <th className="py-2 px-3">동작 설명</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {calculation.annotatedSteps.map((step) => {
                const phaseColor =
                  step.phase === 'Entry (HW)'
                    ? 'text-amber-400 bg-amber-500/10'
                    : step.phase === 'Entry (SW)'
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : step.phase === 'ISR Body'
                    ? 'text-purple-400 bg-purple-500/10'
                    : step.phase === 'Exit (SW)'
                    ? 'text-cyan-400 bg-cyan-500/10'
                    : 'text-sky-400 bg-sky-500/10';

                return (
                  <tr key={step.stepIndex} className="hover:bg-slate-900/40 transition">
                    <td className="py-1.5 px-3 text-center text-slate-500 font-bold">{step.stepIndex}</td>
                    <td className="py-1.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${phaseColor}`}>
                        {step.phase}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 font-bold text-slate-200">{step.instruction}</td>
                    <td className="py-1.5 px-3 text-center font-bold text-amber-300">{step.cycles} c</td>
                    <td className="py-1.5 px-3 text-center text-slate-400 font-bold">
                      {step.stackDelta < 0 ? `${step.stackDelta} B` : step.stackDelta > 0 ? `+${step.stackDelta} B` : '-'}
                    </td>
                    <td className="py-1.5 px-3 text-right text-emerald-400 font-mono">
                      {step.cumTimeNs} ns
                    </td>
                    <td className="py-1.5 px-3 text-slate-400 text-[11px]">{step.description}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generated Code Viewer (Assembly vs AVR-GCC C) */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              동기화된 소스 코드 생성기 (AVR Assembly & GCC C)
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setCodeViewTab('asm')}
                className={`px-3 py-1 text-xs rounded-md font-mono transition ${
                  codeViewTab === 'asm'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                AVR 어셈블리 (.S)
              </button>
              <button
                onClick={() => setCodeViewTab('c_gcc')}
                className={`px-3 py-1 text-xs rounded-md font-mono transition ${
                  codeViewTab === 'c_gcc'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                AVR-GCC C 언어 (.c)
              </button>
            </div>

            <button
              onClick={handleCopyCode}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? '복사됨!' : '코드 복사'}</span>
            </button>
          </div>
        </div>

        <pre className="p-4 bg-slate-900/90 border border-slate-800 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto custom-scrollbar leading-relaxed max-h-72">
          {codeViewTab === 'asm' ? generatedCode.asmCode : generatedCode.cCode}
        </pre>
      </div>
    </div>
  );
};
