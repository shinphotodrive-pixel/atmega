import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Clock,
  Cpu,
  Zap,
  Plus,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Layers,
  Code2,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export interface AvrOpcodeDef {
  mnemonic: string;
  defaultOperands: string;
  category: 'Data Transfer' | 'Arithmetic' | 'Logic' | 'Branch' | 'Bit/IO' | 'Stack/Control';
  cyclesMin: number;
  cyclesMax: number;
  isConditional?: boolean;
  words: number; // 1 word = 16-bit flash, 2 words = 32-bit flash
  description: string;
}

export interface SequenceItem {
  id: string;
  mnemonic: string;
  operands: string;
  category: 'Data Transfer' | 'Arithmetic' | 'Logic' | 'Branch' | 'Bit/IO' | 'Stack/Control';
  cycles: number;
  words: number;
  isConditional?: boolean;
  branchTaken?: boolean;
  description: string;
}

// Canonical AVR Instruction Set Database
export const AVR_OPCODES: AvrOpcodeDef[] = [
  // Data Transfer
  { mnemonic: 'LDI', defaultOperands: 'r16, 0x55', category: 'Data Transfer', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Load Immediate (상수 값을 r16~r31 범용 레지스터에 로드)' },
  { mnemonic: 'MOV', defaultOperands: 'r17, r16', category: 'Data Transfer', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Copy Register (레지스터 r16 값을 r17로 복사)' },
  { mnemonic: 'LDS', defaultOperands: 'r18, 0x0100', category: 'Data Transfer', cyclesMin: 2, cyclesMax: 2, words: 2, description: 'Load Direct from SRAM (SRAM 16비트 절대 주소에서 로드, 32비트 명령어)' },
  { mnemonic: 'STS', defaultOperands: '0x0100, r18', category: 'Data Transfer', cyclesMin: 2, cyclesMax: 2, words: 2, description: 'Store Direct to SRAM (r18 값을 SRAM 절대 주소에 저장, 32비트 명령어)' },
  { mnemonic: 'LD', defaultOperands: 'r16, X', category: 'Data Transfer', cyclesMin: 2, cyclesMax: 2, words: 1, description: 'Load Indirect (포인터 레지스터 X/Y/Z가 가리키는 SRAM 데이터 로드)' },
  { mnemonic: 'ST', defaultOperands: 'X+, r16', category: 'Data Transfer', cyclesMin: 2, cyclesMax: 2, words: 1, description: 'Store Indirect with Post-Increment (X 포인터에 저장 후 주소 +1)' },
  { mnemonic: 'IN', defaultOperands: 'r16, PIND', category: 'Data Transfer', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'In from I/O Location (0x00~0x3F I/O 레지스터에서 읽기)' },
  { mnemonic: 'OUT', defaultOperands: 'PORTB, r16', category: 'Data Transfer', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Out to I/O Location (r16 값을 I/O 포트에 쓰기)' },
  { mnemonic: 'PUSH', defaultOperands: 'r16', category: 'Data Transfer', cyclesMin: 2, cyclesMax: 2, words: 1, description: 'Push Register on Stack (SP가 가리키는 스택에 r16 저장, SP 감소)' },
  { mnemonic: 'POP', defaultOperands: 'r16', category: 'Data Transfer', cyclesMin: 2, cyclesMax: 2, words: 1, description: 'Pop Register from Stack (스택에서 r16으로 데이터 복원, SP 증가)' },

  // Arithmetic
  { mnemonic: 'ADD', defaultOperands: 'r16, r17', category: 'Arithmetic', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Add without Carry (두 레지스터 덧셈: r16 = r16 + r17)' },
  { mnemonic: 'ADC', defaultOperands: 'r17, r18', category: 'Arithmetic', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Add with Carry (캐리 비트를 포함한 덧셈: 16/32비트 확장 연산)' },
  { mnemonic: 'SUB', defaultOperands: 'r16, r17', category: 'Arithmetic', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Subtract without Carry (두 레지스터 뺄셈: r16 = r16 - r17)' },
  { mnemonic: 'SUBI', defaultOperands: 'r16, 1', category: 'Arithmetic', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Subtract Immediate (레지스터에서 상수값 뺄셈)' },
  { mnemonic: 'INC', defaultOperands: 'r16', category: 'Arithmetic', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Increment Register (r16 = r16 + 1, 캐리 플래그 보존)' },
  { mnemonic: 'DEC', defaultOperands: 'r16', category: 'Arithmetic', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Decrement Register (r16 = r16 - 1)' },
  { mnemonic: 'MUL', defaultOperands: 'r16, r17', category: 'Arithmetic', cyclesMin: 2, cyclesMax: 2, words: 1, description: 'Multiply Unsigned (8x8비트 부호없는 곱셈 -> r1:r0에 16비트 결과)' },

  // Logic
  { mnemonic: 'AND', defaultOperands: 'r16, r17', category: 'Logic', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Logical AND (두 레지스터 비트 AND)' },
  { mnemonic: 'ANDI', defaultOperands: 'r16, 0x0F', category: 'Logic', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Logical AND with Immediate (상수 마스킹 연산)' },
  { mnemonic: 'OR', defaultOperands: 'r16, r17', category: 'Logic', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Logical OR (두 레지스터 비트 OR)' },
  { mnemonic: 'ORI', defaultOperands: 'r16, 0x80', category: 'Logic', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Logical OR with Immediate (특정 비트 세트)' },
  { mnemonic: 'EOR', defaultOperands: 'r16, r17', category: 'Logic', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Exclusive OR (두 레지스터 비트 XOR)' },
  { mnemonic: 'CLR', defaultOperands: 'r16', category: 'Logic', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Clear Register (EOR r16, r16 축약형: 1사이클 0 클리어)' },
  { mnemonic: 'LSL', defaultOperands: 'r16', category: 'Logic', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Logical Shift Left (1비트 좌측 시프트, 최하위 0 삽입)' },
  { mnemonic: 'LSR', defaultOperands: 'r16', category: 'Logic', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Logical Shift Right (1비트 우측 시프트, 최상위 0 삽입)' },

  // Branch & Flow
  { mnemonic: 'CP', defaultOperands: 'r16, r17', category: 'Branch', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Compare (r16 - r17 비교 후 SREG 상태 플래그 갱신)' },
  { mnemonic: 'CPI', defaultOperands: 'r16, 10', category: 'Branch', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Compare with Immediate (상수값과 비교)' },
  { mnemonic: 'BREQ', defaultOperands: 'LOOP_EXIT', category: 'Branch', cyclesMin: 1, cyclesMax: 2, isConditional: true, words: 1, description: 'Branch if Equal (Z=1일 때 점프: 불발 시 1사이클, 점프 시 2사이클)' },
  { mnemonic: 'BRNE', defaultOperands: 'LOOP_START', category: 'Branch', cyclesMin: 1, cyclesMax: 2, isConditional: true, words: 1, description: 'Branch if Not Equal (Z=0일 때 점프: 불발 1사이클, 분기 2사이클)' },
  { mnemonic: 'RJMP', defaultOperands: 'TARGET', category: 'Branch', cyclesMin: 2, cyclesMax: 2, words: 1, description: 'Relative Jump (상대 주소로 무조건 점프, 파이프라인 플러시 2사이클)' },
  { mnemonic: 'RCALL', defaultOperands: 'SUBROUTINE', category: 'Branch', cyclesMin: 3, cyclesMax: 4, words: 1, description: 'Relative Call (복귀 주소를 스택에 PUSH 후 서브루틴 점프, 3~4사이클)' },
  { mnemonic: 'RET', defaultOperands: '', category: 'Branch', cyclesMin: 4, cyclesMax: 5, words: 1, description: 'Return from Subroutine (스택에서 복귀 주소 POP 후 복귀, 4~5사이클)' },
  { mnemonic: 'RETI', defaultOperands: '', category: 'Branch', cyclesMin: 4, cyclesMax: 5, words: 1, description: 'Return from Interrupt (인터럽트 복귀 및 전역 인터럽트 I-플래그 활성화)' },

  // Bit & I/O
  { mnemonic: 'SBI', defaultOperands: 'PORTB, 5', category: 'Bit/IO', cyclesMin: 2, cyclesMax: 2, words: 1, description: 'Set Bit in I/O Register (하위 I/O 레지스터의 특정 비트 1 세트)' },
  { mnemonic: 'CBI', defaultOperands: 'PORTB, 5', category: 'Bit/IO', cyclesMin: 2, cyclesMax: 2, words: 1, description: 'Clear Bit in I/O Register (하위 I/O 레지스터의 특정 비트 0 클리어)' },
  { mnemonic: 'NOP', defaultOperands: '', category: 'Stack/Control', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'No Operation (아무 동작 없이 정확히 1클럭 사이클 지연)' },
  { mnemonic: 'WDR', defaultOperands: '', category: 'Stack/Control', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Watchdog Reset (하드웨어 워치독 타이머 카운터 0 초기화)' },
  { mnemonic: 'SLEEP', defaultOperands: '', category: 'Stack/Control', cyclesMin: 1, cyclesMax: 1, words: 1, description: 'Sleep Mode Enter (저전력 슬립 모드로 전환)' }
];

export interface RoutinePreset {
  id: string;
  name: string;
  tag: string;
  desc: string;
  instructions: { mnemonic: string; operands: string; branchTaken?: boolean }[];
}

export const ROUTINE_PRESETS: RoutinePreset[] = [
  {
    id: 'gpio_toggle',
    name: '고속 GPIO 스트로브 토글 루틴 (LED/펄스 생성)',
    tag: 'GPIO / I/O',
    desc: 'SBI와 CBI 명령어를 사용하여 PORTB 5번 핀(아두이노 D13)에 정밀 펄스를 출력하는 루틴',
    instructions: [
      { mnemonic: 'SBI', operands: 'PORTB, 5' },
      { mnemonic: 'NOP', operands: '' },
      { mnemonic: 'CBI', operands: 'PORTB, 5' }
    ]
  },
  {
    id: 'ram_rmw',
    name: 'SRAM 데이터 읽기-수정-쓰기 (RMW) 시퀀스',
    tag: '메모리',
    desc: 'SRAM 특정 주소에서 값을 읽어와 1을 더한 후 다시 저장하는 전형적인 C 전역 변수 증가 패턴',
    instructions: [
      { mnemonic: 'LDS', operands: 'r18, 0x0100' },
      { mnemonic: 'INC', operands: 'r18' },
      { mnemonic: 'STS', operands: '0x0100, r18' }
    ]
  },
  {
    id: 'delay_loop',
    name: '단일 바이트 딜레이 루프 본체 (Loop Step)',
    tag: '루프 / 분기',
    desc: 'LDI로 카운터를 로드하고 DEC와 BRNE로 조건 분기하는 카운트다운 루프 1회 반복',
    instructions: [
      { mnemonic: 'LDI', operands: 'r16, 250' },
      { mnemonic: 'DEC', operands: 'r16' },
      { mnemonic: 'BRNE', operands: 'LOOP', branchTaken: true }
    ]
  },
  {
    id: 'subroutine_overhead',
    name: '서브루틴 호출 및 컨텍스트 스택 보존 (RCALL/RET)',
    tag: '함수 호출',
    desc: '함수 호출 시 레지스터 r16, r17을 스택에 백업하고 복귀하는 프롤로그/에필로그 오버헤드',
    instructions: [
      { mnemonic: 'PUSH', operands: 'r16' },
      { mnemonic: 'PUSH', operands: 'r17' },
      { mnemonic: 'RCALL', operands: 'MY_FUNC' },
      { mnemonic: 'POP', operands: 'r17' },
      { mnemonic: 'POP', operands: 'r16' },
      { mnemonic: 'RET', operands: '' }
    ]
  },
  {
    id: '16bit_add',
    name: '16비트 정밀 덧셈 연산 (ADD + ADC)',
    tag: '산술 연산',
    desc: '8비트 ALU에서 16비트 정수 (r17:r16 + r19:r18)를 단 2클럭 만에 덧셈하는 기법',
    instructions: [
      { mnemonic: 'ADD', operands: 'r16, r18' },
      { mnemonic: 'ADC', operands: 'r17, r19' }
    ]
  }
];

export const InstructionCycleEstimator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // User Sequence State (Initial default sequence: LDI + STS + ADD as in prompt)
  const [sequence, setSequence] = useState<SequenceItem[]>([
    {
      id: 'seq-1',
      mnemonic: 'LDI',
      operands: 'r16, 0x55',
      category: 'Data Transfer',
      cycles: 1,
      words: 1,
      description: 'Load Immediate (상수 값 로드)'
    },
    {
      id: 'seq-2',
      mnemonic: 'STS',
      operands: '0x0100, r16',
      category: 'Data Transfer',
      cycles: 2,
      words: 2,
      description: 'Store Direct to SRAM (SRAM에 저장)'
    },
    {
      id: 'seq-3',
      mnemonic: 'ADD',
      operands: 'r16, r17',
      category: 'Arithmetic',
      cycles: 1,
      words: 1,
      description: 'Add without Carry (덧셈)'
    }
  ]);

  // Clock Frequency (MHz)
  const defaultClock = useMemo(() => {
    if (selectedMCU === 'atmega328p') return 16; // Uno standard, can be 20
    if (selectedMCU === 'atmega128') return 16;
    return 16;
  }, [selectedMCU]);

  const [clockMhz, setClockMhz] = useState<number>(defaultClock);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copiedAsm, setCopiedAsm] = useState<boolean>(false);

  // Quick categories
  const categories = ['all', 'Data Transfer', 'Arithmetic', 'Logic', 'Branch', 'Bit/IO', 'Stack/Control'];

  // Total Cycles and Calculations
  const stats = useMemo(() => {
    let totalCycles = 0;
    let totalWords = 0;

    sequence.forEach((item) => {
      let c = item.cycles;
      if (item.isConditional) {
        c = item.branchTaken ? 2 : 1;
      }
      totalCycles += c;
      totalWords += item.words;
    });

    const totalBytes = totalWords * 2;
    const fCpuHz = clockMhz * 1000000;
    const oneClockNs = 1000 / clockMhz; // ns per clock cycle
    const totalTimeNs = totalCycles * oneClockNs;
    const totalTimeUs = +(totalTimeNs / 1000).toFixed(4);
    const cpi = sequence.length > 0 ? +(totalCycles / sequence.length).toFixed(2) : 0;

    return {
      totalCycles,
      totalWords,
      totalBytes,
      oneClockNs: +oneClockNs.toFixed(2),
      totalTimeNs: +totalTimeNs.toFixed(2),
      totalTimeUs,
      cpi
    };
  }, [sequence, clockMhz]);

  // Add instruction to sequence
  const addInstruction = (opcode: AvrOpcodeDef) => {
    const newItem: SequenceItem = {
      id: `seq-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      mnemonic: opcode.mnemonic,
      operands: opcode.defaultOperands,
      category: opcode.category,
      cycles: opcode.cyclesMin,
      words: opcode.words,
      isConditional: opcode.isConditional,
      branchTaken: opcode.isConditional ? true : undefined,
      description: opcode.description
    };
    setSequence((prev) => [...prev, newItem]);
  };

  // Move up/down
  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sequence.length - 1) return;
    const newSeq = [...sequence];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const temp = newSeq[index];
    newSeq[index] = newSeq[targetIdx];
    newSeq[targetIdx] = temp;
    setSequence(newSeq);
  };

  // Remove item
  const removeItem = (id: string) => {
    setSequence((prev) => prev.filter((item) => item.id !== id));
  };

  // Toggle conditional branch taken
  const toggleBranch = (id: string) => {
    setSequence((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextTaken = !item.branchTaken;
          return {
            ...item,
            branchTaken: nextTaken,
            cycles: nextTaken ? 2 : 1
          };
        }
        return item;
      })
    );
  };

  // Load preset
  const loadPreset = (preset: RoutinePreset) => {
    const newItems: SequenceItem[] = preset.instructions.map((inst, idx) => {
      const def = AVR_OPCODES.find((op) => op.mnemonic === inst.mnemonic);
      return {
        id: `seq-${Date.now()}-${idx}`,
        mnemonic: inst.mnemonic,
        operands: inst.operands,
        category: def ? def.category : 'Data Transfer',
        cycles: inst.branchTaken !== undefined ? (inst.branchTaken ? 2 : 1) : def ? def.cyclesMin : 1,
        words: def ? def.words : 1,
        isConditional: def?.isConditional,
        branchTaken: inst.branchTaken,
        description: def ? def.description : ''
      };
    });
    setSequence(newItems);
  };

  // Generate assembly code string
  const assemblySource = useMemo(() => {
    return sequence
      .map((item, idx) => {
        const line = `${item.mnemonic.padEnd(8, ' ')}${item.operands ? item.operands.padEnd(16, ' ') : ''}`;
        const cycleText = item.isConditional
          ? `${item.cycles} cycle${item.cycles > 1 ? 's' : ''} (${item.branchTaken ? 'Taken' : 'Not taken'})`
          : `${item.cycles} cycle${item.cycles > 1 ? 's' : ''}`;
        return `    ${line}; [${cycleText}] ${item.description}`;
      })
      .join('\n');
  }, [sequence]);

  const handleCopyAssembly = () => {
    navigator.clipboard.writeText(assemblySource);
    setCopiedAsm(true);
    confetti({
      particleCount: 30,
      spread: 50,
      origin: { y: 0.2 }
    });
    setTimeout(() => setCopiedAsm(false), 2000);
  };

  const filteredOpcodes = useMemo(() => {
    if (activeCategory === 'all') return AVR_OPCODES;
    return AVR_OPCODES.filter((op) => op.category === activeCategory);
  }, [activeCategory]);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-2">
            <Clock className="w-3.5 h-3.5" /> AVR Pipeline & Instruction Timing Estimator
          </div>
          <h3 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Instruction Cycle Estimator (명령어 사이클 & 실행 시간 연산기)</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            원하는 AVR 어셈블리 명령어 시퀀스(예: <strong>LDI, STS, ADD</strong>)를 선택 및 조합하여,
            선택된 MCU(<strong>{currentProfile.name}</strong>)의 클럭 주파수 기준 <strong>총 클럭 사이클 수</strong>와 <strong>예상 실행 시간(ns / µs)</strong>을 실시간 계산합니다.
          </p>
        </div>

        {/* Clock Frequency Selector */}
        <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800 shrink-0">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-mono">기준 시스템 클럭 (F_CPU)</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-sm font-bold font-mono text-cyan-400">{clockMhz} MHz</span>
              <span className="text-[10px] text-slate-500 font-mono">({stats.oneClockNs} ns/사이클)</span>
            </div>
          </div>
          <div className="flex gap-1 border-l border-slate-800 pl-3">
            {[8, 16, 20].map((mhz) => (
              <button
                key={mhz}
                onClick={() => setClockMhz(mhz)}
                className={`px-2 py-1 text-xs font-mono font-bold rounded-lg transition-all border ${
                  clockMhz === mhz
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                }`}
              >
                {mhz}M
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Routine Presets Strip */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 실전 루틴 프리셋 빠른 불러오기 (Quick Presets):
          </span>
          <span className="text-[11px] text-slate-500">클릭 시 해당 어셈블리 시퀀스가 즉시 로드됩니다</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {ROUTINE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => loadPreset(preset)}
              className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/90 text-left transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 line-clamp-1">
                  {preset.name}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                {preset.desc}
              </p>
              <div className="mt-2 text-[10px] font-mono text-cyan-400 font-semibold flex items-center justify-between">
                <span>{preset.tag}</span>
                <span>{preset.instructions.length} Ops →</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Results KPI Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Cycles */}
        <div className="p-4 rounded-xl bg-gradient-to-b from-cyan-500/15 to-slate-950 border border-cyan-500/40 space-y-1 shadow-lg">
          <div className="text-[10px] uppercase font-mono text-cyan-400 font-bold flex items-center justify-between">
            <span>총 실행 사이클 (Total Cycles)</span>
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white">
            {stats.totalCycles} <span className="text-sm font-sans font-normal text-cyan-300">Cycles</span>
          </div>
          <div className="text-[10px] text-slate-400">
            총 {sequence.length}개 명령어 (평균 CPI: {stats.cpi})
          </div>
        </div>

        {/* Estimated Execution Time */}
        <div className="p-4 rounded-xl bg-gradient-to-b from-emerald-500/15 to-slate-950 border border-emerald-500/40 space-y-1 shadow-lg">
          <div className="text-[10px] uppercase font-mono text-emerald-400 font-bold flex items-center justify-between">
            <span>예상 실행 시간 (@{clockMhz}MHz)</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white">
            {stats.totalTimeNs < 1000 ? (
              <>
                {stats.totalTimeNs} <span className="text-sm font-sans font-normal text-emerald-300">ns</span>
              </>
            ) : (
              <>
                {stats.totalTimeUs} <span className="text-sm font-sans font-normal text-emerald-300">µs</span>
              </>
            )}
          </div>
          <div className="text-[10px] text-slate-400">
            단일 사이클당 {stats.oneClockNs} ns 소요
          </div>
        </div>

        {/* Flash Memory Size */}
        <div className="p-4 rounded-xl bg-gradient-to-b from-amber-500/15 to-slate-950 border border-amber-500/40 space-y-1 shadow-lg">
          <div className="text-[10px] uppercase font-mono text-amber-400 font-bold flex items-center justify-between">
            <span>플래시 메모리 점유</span>
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white">
            {stats.totalBytes} <span className="text-sm font-sans font-normal text-amber-300">Bytes</span>
          </div>
          <div className="text-[10px] text-slate-400">
            {stats.totalWords} Flash Words (16-bit Words)
          </div>
        </div>

        {/* Effective Throughput */}
        <div className="p-4 rounded-xl bg-gradient-to-b from-purple-500/15 to-slate-950 border border-purple-500/40 space-y-1 shadow-lg">
          <div className="text-[10px] uppercase font-mono text-purple-400 font-bold flex items-center justify-between">
            <span>초당 최대 실행 반복 횟수</span>
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-white">
            {stats.totalCycles > 0
              ? (clockMhz * 1000000 / stats.totalCycles >= 1000000
                  ? `${+(clockMhz / stats.totalCycles).toFixed(2)} M/s`
                  : `${Math.round(clockMhz * 1000000 / stats.totalCycles).toLocaleString()} /s`)
              : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-400">
            연속 루프 시 최대 반복 주파수
          </div>
        </div>
      </div>

      {/* Sequence Builder + Opcode Catalog Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Active Sequence Editor */}
        <div className="lg:col-span-7 bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                현재 어셈블리 명령어 시퀀스 ({sequence.length}개)
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSequence([])}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-900 hover:bg-slate-800 text-rose-400 hover:text-rose-300 transition-colors border border-slate-800"
                title="모든 명령어 비우기"
              >
                전체 삭제
              </button>
              <button
                onClick={handleCopyAssembly}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors border border-slate-700 flex items-center gap-1"
              >
                {copiedAsm ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAsm ? '복사됨!' : '어셈블리 복사'}</span>
              </button>
            </div>
          </div>

          {/* Sequence Items List */}
          {sequence.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-2">
              <AlertCircle className="w-6 h-6 mx-auto text-slate-600" />
              <p>시퀀스에 추가된 명령어가 없습니다.</p>
              <p className="text-[11px] text-slate-600">
                오른쪽 카탈로그에서 LDI, STS, ADD 등의 명령어를 클릭하여 추가하세요.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
              {sequence.map((item, idx) => {
                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-3 group"
                  >
                    {/* Index + Mnemonic & Operands */}
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-slate-950 font-mono text-[11px] font-bold text-slate-500 flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-cyan-400">
                            {item.mnemonic}
                          </span>
                          <span className="font-mono text-xs text-slate-300">
                            {item.operands}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                            {item.words * 2}B
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* Cycle Badge & Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Conditional Branch Toggle */}
                      {item.isConditional && (
                        <button
                          onClick={() => toggleBranch(item.id)}
                          className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
                            item.branchTaken
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                          title="분기 발생(Taken=2사이클) 또는 불발(Not taken=1사이클) 토글"
                        >
                          {item.branchTaken ? '분기(Taken)' : '불발(Not Taken)'}
                        </button>
                      )}

                      {/* Cycles indicator */}
                      <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono font-bold text-xs">
                        {item.cycles} Cyc ({+(item.cycles * stats.oneClockNs).toFixed(1)}ns)
                      </span>

                      {/* Up/Down reorder */}
                      <div className="flex flex-col gap-0.5 opacity-60 group-hover:opacity-100">
                        <button
                          onClick={() => moveItem(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 hover:text-white disabled:opacity-20 text-slate-400"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => moveItem(idx, 'down')}
                          disabled={idx === sequence.length - 1}
                          className="p-1 hover:text-white disabled:opacity-20 text-slate-400"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Opcode Library Quick Add */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                명령어 카탈로그 (클릭 시 시퀀스에 추가)
              </h4>
            </div>
          </div>

          {/* Quick Buttons for LDI, STS, ADD from prompt */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-slate-400 uppercase">자주 쓰이는 핵심 명령어:</span>
            <div className="flex flex-wrap gap-1.5">
              {['LDI', 'STS', 'LDS', 'ADD', 'SUB', 'IN', 'OUT', 'RJMP', 'NOP', 'PUSH', 'POP'].map((m) => {
                const op = AVR_OPCODES.find((o) => o.mnemonic === m);
                if (!op) return null;
                return (
                  <button
                    key={m}
                    onClick={() => addInstruction(op)}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-200 transition-all flex items-center gap-1 shadow-sm"
                  >
                    <span>{m}</span>
                    <span className="text-[10px] text-slate-500 font-normal">({op.cyclesMin}c)</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap gap-1 border-t border-slate-800/80 pt-3">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2 py-0.5 text-[10px] rounded transition-all ${
                  activeCategory === cat
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat === 'all' ? '전체' : cat}
              </button>
            ))}
          </div>

          {/* Opcode Cards List */}
          <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredOpcodes.map((op) => (
              <button
                key={op.mnemonic}
                onClick={() => addInstruction(op)}
                className="w-full p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/90 hover:border-cyan-500/40 hover:bg-slate-850 text-left transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white group-hover:text-cyan-300">
                      {op.mnemonic}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {op.defaultOperands}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                    {op.description}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/30">
                    {op.isConditional ? `${op.cyclesMin}~${op.cyclesMax}c` : `${op.cyclesMin}c`}
                  </span>
                  <Plus className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-300" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Assembly Preview & Educational Note */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-amber-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> AVR RISC 단일 사이클 하버드 파이프라인(Pipeline) 실행 원리:
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            {clockMhz} MHz → 1 클럭 = {stats.oneClockNs} ns
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          • <strong>이상적인 1 CPI (단일 사이클)</strong>: AVR RISC 코어는 명령어 인출(Fetch)과 실행(Execute)이 오버랩되는 2단계 파이프라인을 탑재하여 대부분의 산술/논리(ADD, SUB, AND) 및 레지스터 조작(LDI, MOV)이 <strong>단 1클럭 사이클</strong>에 완료됩니다.<br />
          • <strong>메모리 접근 오버헤드</strong>: SRAM을 직접 접근하는 <strong>LDS/STS</strong>는 2사이클, I/O 레지스터 조작(IN/OUT)은 1사이클 소요됩니다.<br />
          • <strong>분기/호출 파이프라인 플러시</strong>: 분기(RJMP, RCALL, RET) 발생 시 이미 인출된 후속 명령어가 무효화(Pipeline Bubble)되므로 2~4클럭 사이클이 소요됩니다.
        </p>
      </div>
    </div>
  );
};
