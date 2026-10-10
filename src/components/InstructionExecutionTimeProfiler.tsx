import React, { useState, useMemo } from 'react';
import {
  Clock,
  Cpu,
  Zap,
  Play,
  RotateCcw,
  Copy,
  Check,
  Code2,
  Sparkles,
  Info,
  TrendingUp,
  AlertTriangle,
  Layers,
  ArrowRight,
  Sliders,
  CheckCircle,
  HelpCircle,
  FileCode,
  Gauge
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

interface ParsedInstruction {
  lineNum: number;
  rawText: string;
  isCommentOrEmpty: boolean;
  mnemonic: string;
  operands: string;
  category: 'Arithmetic' | 'Logic' | 'Branch' | 'Data Transfer' | 'Bit/IO' | 'Stack' | 'Control' | 'C Primitive' | 'Other';
  minCycles: number;
  maxCycles: number;
  isConditional: boolean;
  branchTaken: boolean;
  effectiveCycles: number;
  sizeBytes: number;
  explanation: string;
  tip?: string;
}

interface PresetSnippet {
  id: string;
  name: string;
  description: string;
  category: string;
  code: string;
  loopCount: number;
}

// Comprehensive AVR Instruction Database
interface AvrInstructionSpec {
  cyclesMin: number;
  cyclesMax: number;
  isBranch?: boolean;
  sizeBytes: number;
  category: 'Arithmetic' | 'Logic' | 'Branch' | 'Data Transfer' | 'Bit/IO' | 'Stack' | 'Control';
  description: string;
}

const AVR_INSTRUCTION_DB: Record<string, AvrInstructionSpec> = {
  // Arithmetic & Logic
  ADD: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Arithmetic', description: 'Add two registers (Rd = Rd + Rr)' },
  ADC: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Arithmetic', description: 'Add with carry (Rd = Rd + Rr + C)' },
  ADIW: { cyclesMin: 2, cyclesMax: 2, sizeBytes: 2, category: 'Arithmetic', description: 'Add immediate to 16-bit register pair (R25:R24, X, Y, Z)' },
  SUB: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Arithmetic', description: 'Subtract without carry (Rd = Rd - Rr)' },
  SUBI: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Arithmetic', description: 'Subtract immediate from register' },
  SBC: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Arithmetic', description: 'Subtract with carry' },
  SBCI: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Arithmetic', description: 'Subtract immediate with carry' },
  SBIW: { cyclesMin: 2, cyclesMax: 2, sizeBytes: 2, category: 'Arithmetic', description: 'Subtract immediate from 16-bit register pair' },
  AND: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Logic', description: 'Logical AND between registers' },
  ANDI: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Logic', description: 'Logical AND with immediate' },
  OR: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Logic', description: 'Logical OR between registers' },
  ORI: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Logic', description: 'Logical OR with immediate' },
  EOR: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Logic', description: 'Exclusive OR (XOR) between registers' },
  COM: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Logic', description: 'One\'s complement (invert all bits)' },
  NEG: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Arithmetic', description: 'Two\'s complement negation' },
  INC: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Arithmetic', description: 'Increment register by 1' },
  DEC: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Arithmetic', description: 'Decrement register by 1' },
  TST: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Logic', description: 'Test for zero or minus (AND with itself)' },
  CLR: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Logic', description: 'Clear register (EOR with itself)' },
  SER: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Logic', description: 'Set all bits in register to 0xFF (LDI 0xFF)' },
  MUL: { cyclesMin: 2, cyclesMax: 2, sizeBytes: 2, category: 'Arithmetic', description: 'Hardware 8x8 Unsigned multiply (Result in R1:R0)' },
  MULS: { cyclesMin: 2, cyclesMax: 2, sizeBytes: 2, category: 'Arithmetic', description: 'Hardware 8x8 Signed multiply (Result in R1:R0)' },
  MULSU: { cyclesMin: 2, cyclesMax: 2, sizeBytes: 2, category: 'Arithmetic', description: 'Hardware 8x8 Signed with Unsigned multiply' },
  FMUL: { cyclesMin: 2, cyclesMax: 2, sizeBytes: 2, category: 'Arithmetic', description: 'Hardware 8x8 Fractional multiply' },

  // Data Transfer
  MOV: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Data Transfer', description: 'Copy register (Rd = Rr)' },
  MOVW: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Data Transfer', description: 'Copy 16-bit register pair' },
  LDI: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Data Transfer', description: 'Load immediate value (R16..R31)' },
  LDS: { cyclesMin: 2, cyclesMax: 2, sizeBytes: 4, category: 'Data Transfer', description: 'Load direct from data space (SRAM/Ext I/O)' },
  LD: { cyclesMin: 1, cyclesMax: 2, sizeBytes: 2, category: 'Data Transfer', description: 'Load indirect from data space (X, Y, Z)' },
  LDD: { cyclesMin: 2, cyclesMax: 2, sizeBytes: 2, category: 'Data Transfer', description: 'Load indirect with displacement (Y+q, Z+q)' },
  STS: { cyclesMin: 2, cyclesMax: 2, sizeBytes: 4, category: 'Data Transfer', description: 'Store direct to data space (SRAM/Ext I/O)' },
  ST: { cyclesMin: 1, cyclesMax: 2, sizeBytes: 2, category: 'Data Transfer', description: 'Store indirect to data space (X, Y, Z)' },
  STD: { cyclesMin: 2, cyclesMax: 2, sizeBytes: 2, category: 'Data Transfer', description: 'Store indirect with displacement (Y+q, Z+q)' },
  LPM: { cyclesMin: 3, cyclesMax: 3, sizeBytes: 2, category: 'Data Transfer', description: 'Load Program Flash Memory to R0 / Rd via Z pointer' },
  SPM: { cyclesMin: 4, cyclesMax: 4, sizeBytes: 2, category: 'Data Transfer', description: 'Store Program Flash Memory page buffer' },
  IN: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Bit/IO', description: 'Load from I/O Location (0x00..0x3F) to Register' },
  OUT: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Bit/IO', description: 'Store Register to I/O Location (0x00..0x3F)' },
  PUSH: { cyclesMin: 2, cyclesMax: 2, sizeBytes: 2, category: 'Stack', description: 'Push register onto SRAM stack (SP decremented)' },
  POP: { cyclesMin: 2, cyclesMax: 2, sizeBytes: 2, category: 'Stack', description: 'Pop register from SRAM stack (SP incremented)' },

  // Bit & I/O
  SBI: { cyclesMin: 2, cyclesMax: 2, sizeBytes: 2, category: 'Bit/IO', description: 'Set bit in lower I/O space (0x00..0x1F, e.g. PORTB)' },
  CBI: { cyclesMin: 2, cyclesMax: 2, sizeBytes: 2, category: 'Bit/IO', description: 'Clear bit in lower I/O space (0x00..0x1F, e.g. PORTB)' },
  LSL: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Logic', description: 'Logical shift left (ADD Rd, Rd)' },
  LSR: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Logic', description: 'Logical shift right (Zero into MSB)' },
  ROL: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Logic', description: 'Rotate left through Carry flag' },
  ROR: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Logic', description: 'Rotate right through Carry flag' },
  ASR: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Arithmetic', description: 'Arithmetic shift right (Sign bit preserved)' },
  SWAP: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Logic', description: 'Swap high & low 4-bit nibbles' },
  BSET: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Control', description: 'Set flag in SREG (Status Register)' },
  BCLR: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Control', description: 'Clear flag in SREG (Status Register)' },
  SBIW_ALT: { cyclesMin: 2, cyclesMax: 2, sizeBytes: 2, category: 'Arithmetic', description: 'Subtract immediate from word' },
  SEC: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Control', description: 'Set Carry Flag (C)' },
  CLC: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Control', description: 'Clear Carry Flag (C)' },
  SEI: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Control', description: 'Global Interrupt Enable (I flag in SREG)' },
  CLI: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Control', description: 'Global Interrupt Disable (I flag in SREG)' },

  // Branch & Jump
  RJMP: { cyclesMin: 2, cyclesMax: 2, sizeBytes: 2, category: 'Branch', description: 'Relative Jump within -2048..+2047 words' },
  JMP: { cyclesMin: 3, cyclesMax: 3, sizeBytes: 4, category: 'Branch', description: 'Direct Jump to anywhere in flash' },
  RCALL: { cyclesMin: 3, cyclesMax: 3, sizeBytes: 2, category: 'Branch', description: 'Relative Subroutine Call (pushes PC to stack)' },
  CALL: { cyclesMin: 4, cyclesMax: 4, sizeBytes: 4, category: 'Branch', description: 'Direct Subroutine Call (pushes PC to stack)' },
  RET: { cyclesMin: 4, cyclesMax: 4, sizeBytes: 2, category: 'Branch', description: 'Return from Subroutine (pops PC from stack)' },
  RETI: { cyclesMin: 4, cyclesMax: 4, sizeBytes: 2, category: 'Branch', description: 'Return from Interrupt (pops PC + re-enables SREG I)' },
  CP: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Branch', description: 'Compare registers (Rd - Rr updates flags)' },
  CPC: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Branch', description: 'Compare with Carry' },
  CPI: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Branch', description: 'Compare register with immediate' },
  CPSE: { cyclesMin: 1, cyclesMax: 3, isBranch: true, sizeBytes: 2, category: 'Branch', description: 'Compare Skip if Equal (1 clk no skip, 2 clk 1-word, 3 clk 2-word)' },
  SBIC: { cyclesMin: 1, cyclesMax: 3, isBranch: true, sizeBytes: 2, category: 'Branch', description: 'Skip if Bit in I/O is Cleared (1 clk no skip, 2 clk if skip)' },
  SBIS: { cyclesMin: 1, cyclesMax: 3, isBranch: true, sizeBytes: 2, category: 'Branch', description: 'Skip if Bit in I/O is Set (1 clk no skip, 2 clk if skip)' },
  SBRC: { cyclesMin: 1, cyclesMax: 3, isBranch: true, sizeBytes: 2, category: 'Branch', description: 'Skip if Bit in Register Cleared' },
  SBRS: { cyclesMin: 1, cyclesMax: 3, isBranch: true, sizeBytes: 2, category: 'Branch', description: 'Skip if Bit in Register Set' },
  BREQ: { cyclesMin: 1, cyclesMax: 2, isBranch: true, sizeBytes: 2, category: 'Branch', description: 'Branch if Equal (Z=1): 1 cycle if false, 2 cycles if taken' },
  BRNE: { cyclesMin: 1, cyclesMax: 2, isBranch: true, sizeBytes: 2, category: 'Branch', description: 'Branch if Not Equal (Z=0): 1 cycle if false, 2 cycles if taken' },
  BRCS: { cyclesMin: 1, cyclesMax: 2, isBranch: true, sizeBytes: 2, category: 'Branch', description: 'Branch if Carry Set (C=1): 1 clk false, 2 clk taken' },
  BRCC: { cyclesMin: 1, cyclesMax: 2, isBranch: true, sizeBytes: 2, category: 'Branch', description: 'Branch if Carry Cleared (C=0): 1 clk false, 2 clk taken' },
  BRSH: { cyclesMin: 1, cyclesMax: 2, isBranch: true, sizeBytes: 2, category: 'Branch', description: 'Branch if Same or Higher (C=0): 1 clk false, 2 clk taken' },
  BRLO: { cyclesMin: 1, cyclesMax: 2, isBranch: true, sizeBytes: 2, category: 'Branch', description: 'Branch if Lower (C=1): 1 clk false, 2 clk taken' },
  BRMI: { cyclesMin: 1, cyclesMax: 2, isBranch: true, sizeBytes: 2, category: 'Branch', description: 'Branch if Minus (N=1): 1 clk false, 2 clk taken' },
  BRPL: { cyclesMin: 1, cyclesMax: 2, isBranch: true, sizeBytes: 2, category: 'Branch', description: 'Branch if Plus (N=0): 1 clk false, 2 clk taken' },
  BRGE: { cyclesMin: 1, cyclesMax: 2, isBranch: true, sizeBytes: 2, category: 'Branch', description: 'Branch if Greater or Equal (Signed): 1 clk false, 2 clk taken' },
  BRLT: { cyclesMin: 1, cyclesMax: 2, isBranch: true, sizeBytes: 2, category: 'Branch', description: 'Branch if Less Than (Signed): 1 clk false, 2 clk taken' },

  // Control & NOP
  NOP: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Control', description: 'No Operation (Pipeline alignment / precise delay)' },
  SLEEP: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Control', description: 'Enter low-power sleep mode' },
  WDR: { cyclesMin: 1, cyclesMax: 1, sizeBytes: 2, category: 'Control', description: 'Watchdog Timer Reset (clears WDT counter)' }
};

// Preset library for common real-world AVR tasks
const PRESET_SNIPPETS: PresetSnippet[] = [
  {
    id: 'gpio_benchmark',
    name: 'Direct I/O (sbi) vs Arduino digitalWrite()',
    category: 'GPIO Benchmark',
    description: 'Compare bare-metal atomic 1-cycle/2-cycle direct port manipulation against Arduino HAL function overhead.',
    loopCount: 1,
    code: `; --- Case 1: Direct Port Bit Set (Bare-metal) ---
sbi PORTB, 5        ; 2 cycles (125 ns @ 16MHz) - atomic pin toggle!
nop                 ; 1 cycle (62.5 ns) pulse width padding
cbi PORTB, 5        ; 2 cycles - clear pin

; --- Case 2: Arduino digitalWrite(13, HIGH) equivalent overhead ---
; digitalWrite checks timer pins, translates pin to port via PROGMEM, then applies mask:
lds r24, 0x0100     ; 2 cycles - load digital pin mapping
in r25, 0x05        ; 1 cycle - read PORTB
ori r25, 0x20       ; 1 cycle - bitmask OR (1 << 5)
out 0x05, r25       ; 1 cycle - write back to PORTB
; Total Arduino digitalWrite takes 56~68 cycles!`
  },
  {
    id: 'bit_bang_spi',
    name: 'Bit-Banged SPI 8-bit Transmit Byte',
    category: 'Communication Protocol',
    description: 'High-speed software SPI master byte transmission loop (MSB first, Mode 0).',
    loopCount: 8,
    code: `; Transmit 1 Bit of SPI (Repeated 8 times for a byte)
sbrc r16, 7         ; 1 cycle (2 if bit clear): Test MSB
sbi PORTB, 3        ; 2 cycles: Set MOSI High
sbrs r16, 7         ; 1 cycle: Test MSB
cbi PORTB, 3        ; 2 cycles: Set MOSI Low
sbi PORTB, 5        ; 2 cycles: Pulse SCK High (Rising Edge)
lsl r16             ; 1 cycle: Shift next bit into MSB position
cbi PORTB, 5        ; 2 cycles: Return SCK Low (Falling Edge)
dec r17             ; 1 cycle: Decrement bit counter
brne -8             ; 2 cycles (taken) / 1 cycle (last exit)`
  },
  {
    id: 'isr_context_switch',
    name: 'ISR Context Save & Restore (Prologue/Epilogue)',
    category: 'Interrupt Overhead',
    description: 'Minimum required register preservation for a non-trivial interrupt service routine.',
    loopCount: 1,
    code: `; --- ISR Prologue (Entering Interrupt) ---
push r0             ; 2 cycles: Save temporary register
in r0, 0x3F         ; 1 cycle: Read Status Register (SREG)
push r0             ; 2 cycles: Save SREG to stack
push r24            ; 2 cycles: Save Working Register R24
push r25            ; 2 cycles: Save Working Register R25

; --- Minimal ISR Payload ---
in r24, 0x03        ; 1 cycle: Read PINB flag
out 0x05, r24       ; 1 cycle: Output directly to PORTB

; --- ISR Epilogue (Exiting Interrupt) ---
pop r25             ; 2 cycles: Restore R25
pop r24             ; 2 cycles: Restore R24
pop r0              ; 2 cycles: Restore saved SREG
out 0x3F, r0        ; 1 cycle: Write back to SREG
pop r0              ; 2 cycles: Restore original R0
reti                ; 4 cycles: Return from Interrupt & re-enable I-bit`
  },
  {
    id: 'delay_loop_calibrated',
    name: 'Precision Software 4-Cycle Delay Loop',
    category: 'Timing Generator',
    description: 'Classic avr-libc _delay_loop_1 (3 cycles) & _delay_loop_2 (4 cycles) calibrated delay block.',
    loopCount: 250,
    code: `; 16-bit 4-Cycle Delay Loop: Total = 1 + (Count * 4) - 1 + 4 cycles
sbiw r24, 1         ; 2 cycles: Subtract 1 from 16-bit pair (R25:R24)
brne -2             ; 2 cycles when branching back, 1 cycle on zero exit
nop                 ; 1 cycle: Tail alignment`
  },
  {
    id: 'fixed_point_math',
    name: 'Hardware 8x8 Multiply & 16-bit Accumulator',
    category: 'Math & DSP',
    description: 'AVR hardware multiplier acceleration for DSP filters, audio PWM, and PID loops.',
    loopCount: 1,
    code: `; 8x8 Hardware Multiply & 16-bit Accumulate
mul r18, r19        ; 2 cycles: Hardware multiplier (Result in R1:R0)
add r24, r0         ; 1 cycle: Accumulate low byte
adc r25, r1         ; 1 cycle: Accumulate high byte with Carry
clr r1              ; 1 cycle: AVR-GCC ABI convention (R1 must always be 0!)`
  }
];

export const InstructionExecutionTimeProfiler: React.FC<Props> = ({
  selectedMCU
}) => {
  const [clockMhz, setClockMhz] = useState<number>(16);
  const [sourceCode, setSourceCode] = useState<string>(PRESET_SNIPPETS[0].code);
  const [activePreset, setActivePreset] = useState<string>(PRESET_SNIPPETS[0].id);
  const [loopCount, setLoopCount] = useState<number>(1);
  const [copied, setCopied] = useState<boolean>(false);
  const [branchDecisions, setBranchDecisions] = useState<Record<number, boolean>>({});

  const mcuProfile = MCU_PROFILES[selectedMCU] || MCU_PROFILES['atmega328p'];

  // Clock period calculation: T = 1 / F_CPU
  // 16MHz -> 62.5ns
  const clockPeriodNs = useMemo(() => {
    if (clockMhz <= 0) return 62.5;
    return 1000 / clockMhz;
  }, [clockMhz]);

  // Parsing function for line-by-line profiling
  const parsedLines: ParsedInstruction[] = useMemo(() => {
    const rawLines = sourceCode.split('\n');

    return rawLines.map((raw, idx) => {
      const lineNum = idx + 1;
      const trimmed = raw.trim();

      // Check empty or comment line
      if (
        !trimmed ||
        trimmed.startsWith(';') ||
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*')
      ) {
        return {
          lineNum,
          rawText: raw,
          isCommentOrEmpty: true,
          mnemonic: '',
          operands: '',
          category: 'Other',
          minCycles: 0,
          maxCycles: 0,
          isConditional: false,
          branchTaken: false,
          effectiveCycles: 0,
          sizeBytes: 0,
          explanation: trimmed.replace(/^[;\/\*]+\s*/, '') || 'Empty line / Comment'
        };
      }

      // Check C code constructs
      // 1. C port direct toggle: PORTB |= (1 << 5) -> sbi 2 cycles
      if (/PORT[A-L]\s*\|\=\s*\(1\s*<<\s*\d+\)/i.test(trimmed)) {
        return {
          lineNum,
          rawText: raw,
          isCommentOrEmpty: false,
          mnemonic: 'PORTx |= (1<<b)',
          operands: 'sbi instruction equivalent',
          category: 'C Primitive',
          minCycles: 2,
          maxCycles: 2,
          isConditional: false,
          branchTaken: false,
          effectiveCycles: 2,
          sizeBytes: 2,
          explanation: '컴파일러가 SBI(Set Bit in I/O) 명령어로 최적화 (2 cycles)',
          tip: '0x00~0x1F 포트(PORTB, C, D)는 1단위 SBI로 2사이클에 완료됩니다.'
        };
      }

      if (/PORT[A-L]\s*&\=\s*~\(1\s*<<\s*\d+\)/i.test(trimmed)) {
        return {
          lineNum,
          rawText: raw,
          isCommentOrEmpty: false,
          mnemonic: 'PORTx &= ~(1<<b)',
          operands: 'cbi instruction equivalent',
          category: 'C Primitive',
          minCycles: 2,
          maxCycles: 2,
          isConditional: false,
          branchTaken: false,
          effectiveCycles: 2,
          sizeBytes: 2,
          explanation: '컴파일러가 CBI(Clear Bit in I/O) 명령어로 최적화 (2 cycles)',
          tip: 'CBI는 원자적(Atomic)으로 동작하여 인터럽트 간섭이 없습니다.'
        };
      }

      // 2. Arduino digitalWrite
      if (/digitalWrite\s*\(/i.test(trimmed)) {
        return {
          lineNum,
          rawText: raw,
          isCommentOrEmpty: false,
          mnemonic: 'digitalWrite()',
          operands: 'Arduino HAL Function',
          category: 'C Primitive',
          minCycles: 56,
          maxCycles: 68,
          isConditional: false,
          branchTaken: false,
          effectiveCycles: 62,
          sizeBytes: 120,
          explanation: '아두이노 핀 타이머 해제 + 포트 번호 룩업 + 메모리 I/O 함수 오버헤드 (평균 62 cycles)',
          tip: '초당 수백 kHz 이상의 고속 토글이 필요할 때는 반드시 direct I/O(PORTx |= ...)로 교체하세요.'
        };
      }

      // 3. Arduino digitalRead
      if (/digitalRead\s*\(/i.test(trimmed)) {
        return {
          lineNum,
          rawText: raw,
          isCommentOrEmpty: false,
          mnemonic: 'digitalRead()',
          operands: 'Arduino HAL Function',
          category: 'C Primitive',
          minCycles: 48,
          maxCycles: 58,
          isConditional: false,
          branchTaken: false,
          effectiveCycles: 52,
          sizeBytes: 90,
          explanation: '아두이노 핀 룩업 및 비트 마스킹 오버헤드 (평균 52 cycles)',
          tip: 'PINB & (1<<5) 직접 읽기는 1~2 사이클에 불과합니다.'
        };
      }

      // 4. C variable assignment or arithmetic: e.g. a = b + c
      if (/^[a-zA-Z0-9_]+\s*=\s*[a-zA-Z0-9_]+\s*\+\s*[a-zA-Z0-9_]+;/i.test(trimmed)) {
        return {
          lineNum,
          rawText: raw,
          isCommentOrEmpty: false,
          mnemonic: 'a = b + c;',
          operands: 'ADD Rd, Rr',
          category: 'Arithmetic',
          minCycles: 1,
          maxCycles: 1,
          isConditional: false,
          branchTaken: false,
          effectiveCycles: 1,
          sizeBytes: 2,
          explanation: '단일 8비트 ADD 연산 (1 cycle)'
        };
      }

      // 5. C integer divide: a = b / c;
      if (/^[a-zA-Z0-9_]+\s*=\s*[a-zA-Z0-9_]+\s*\/\s*[a-zA-Z0-9_]+;/i.test(trimmed)) {
        return {
          lineNum,
          rawText: raw,
          isCommentOrEmpty: false,
          mnemonic: 'a = b / c;',
          operands: '__udivmodqi4 (8-bit) / __udivmodhi4 (16-bit)',
          category: 'Arithmetic',
          minCycles: 60,
          maxCycles: 180,
          isConditional: false,
          branchTaken: false,
          effectiveCycles: 95,
          sizeBytes: 64,
          explanation: 'AVR은 하드웨어 나눗셈기가 없어 소프트웨어 루프로 실행 (~95 cycles)',
          tip: '가능하다면 2의 거듭제곱 비트 시프트(>> 1, >> 2)로 대체하세요.'
        };
      }

      // 6. Strip comments from assembly line: e.g. "sbi PORTB, 5 ; comment"
      const codePart = trimmed.split(';')[0].split('//')[0].trim();
      const commentPart = trimmed.includes(';')
        ? trimmed.substring(trimmed.indexOf(';') + 1).trim()
        : trimmed.includes('//')
        ? trimmed.substring(trimmed.indexOf('//') + 2).trim()
        : '';

      // Tokenize mnemonic and operands
      const parts = codePart.split(/\s+/);
      const mnemonicUpper = parts[0]?.toUpperCase().replace(':', '') || '';
      const operands = parts.slice(1).join(' ');

      // Label definition: e.g. "loop:"
      if (codePart.endsWith(':') || parts.length === 1 && codePart.includes(':')) {
        return {
          lineNum,
          rawText: raw,
          isCommentOrEmpty: true,
          mnemonic: mnemonicUpper,
          operands: '',
          category: 'Other',
          minCycles: 0,
          maxCycles: 0,
          isConditional: false,
          branchTaken: false,
          effectiveCycles: 0,
          sizeBytes: 0,
          explanation: `코드 라벨 (${codePart})`
        };
      }

      const spec = AVR_INSTRUCTION_DB[mnemonicUpper];

      if (spec) {
        const isBranch = !!spec.isBranch;
        // Default to branch taken for backward jump loops, not taken for skip unless set
        const userDecision = branchDecisions[lineNum];
        const isTaken = userDecision !== undefined ? userDecision : true;

        const effectiveCycles = isBranch
          ? (isTaken ? spec.cyclesMax : spec.cyclesMin)
          : spec.cyclesMin;

        return {
          lineNum,
          rawText: raw,
          isCommentOrEmpty: false,
          mnemonic: mnemonicUpper,
          operands,
          category: spec.category,
          minCycles: spec.cyclesMin,
          maxCycles: spec.cyclesMax,
          isConditional: isBranch,
          branchTaken: isTaken,
          effectiveCycles,
          sizeBytes: spec.sizeBytes,
          explanation: commentPart || spec.description
        };
      }

      // Unknown or complex statement fallback estimation
      return {
        lineNum,
        rawText: raw,
        isCommentOrEmpty: false,
        mnemonic: mnemonicUpper || 'CMD',
        operands,
        category: 'Other',
        minCycles: 1,
        maxCycles: 2,
        isConditional: false,
        branchTaken: false,
        effectiveCycles: 1,
        sizeBytes: 2,
        explanation: commentPart || '표준 RISC 명령어 추정 (1 cycle, 2 bytes)'
      };
    });
  }, [sourceCode, branchDecisions]);

  // Aggregate cycle calculations
  const totals = useMemo(() => {
    let singlePassCycles = 0;
    let minPossibleCycles = 0;
    let maxPossibleCycles = 0;
    let totalSizeBytes = 0;
    let executableLinesCount = 0;

    const categoryStats: Record<string, { count: number; cycles: number }> = {
      Arithmetic: { count: 0, cycles: 0 },
      Logic: { count: 0, cycles: 0 },
      Branch: { count: 0, cycles: 0 },
      'Data Transfer': { count: 0, cycles: 0 },
      'Bit/IO': { count: 0, cycles: 0 },
      Stack: { count: 0, cycles: 0 },
      Control: { count: 0, cycles: 0 },
      'C Primitive': { count: 0, cycles: 0 },
      Other: { count: 0, cycles: 0 }
    };

    parsedLines.forEach(item => {
      if (!item.isCommentOrEmpty) {
        singlePassCycles += item.effectiveCycles;
        minPossibleCycles += item.minCycles;
        maxPossibleCycles += item.maxCycles;
        totalSizeBytes += item.sizeBytes;
        executableLinesCount++;

        if (categoryStats[item.category]) {
          categoryStats[item.category].count++;
          categoryStats[item.category].cycles += item.effectiveCycles;
        }
      }
    });

    const effectiveTotalCycles = singlePassCycles * loopCount;
    const effectiveMinCycles = minPossibleCycles * loopCount;
    const effectiveMaxCycles = maxPossibleCycles * loopCount;

    const totalTimeNs = effectiveTotalCycles * clockPeriodNs;
    const totalTimeUs = totalTimeNs / 1000;
    const totalTimeMs = totalTimeUs / 1000;

    // MIPS throughput achieved by this block
    const mips = effectiveTotalCycles > 0 && totalTimeNs > 0
      ? (executableLinesCount * loopCount) / (totalTimeNs / 1000)
      : clockMhz;

    return {
      singlePassCycles,
      effectiveTotalCycles,
      effectiveMinCycles,
      effectiveMaxCycles,
      totalSizeBytes,
      executableLinesCount,
      totalTimeNs,
      totalTimeUs,
      totalTimeMs,
      mips,
      categoryStats
    };
  }, [parsedLines, loopCount, clockPeriodNs, clockMhz]);

  const handleToggleBranch = (lineNum: number) => {
    setBranchDecisions(prev => ({
      ...prev,
      [lineNum]: !prev[lineNum]
    }));
  };

  const handleSelectPreset = (preset: PresetSnippet) => {
    setActivePreset(preset.id);
    setSourceCode(preset.code);
    setLoopCount(preset.loopCount);
    setBranchDecisions({});
  };

  const handleCopyReport = () => {
    const report = `/*
 * AVR Instruction Execution Time Profile Report
 * Target MCU: ${mcuProfile.name} (${selectedMCU})
 * Clock Speed: ${clockMhz} MHz (Cycle Period: ${clockPeriodNs.toFixed(2)} ns)
 * Loop Multiplier: ${loopCount}x
 *
 * Total Cycles: ${totals.effectiveTotalCycles} cycles
 * Total Time: ${totals.totalTimeNs >= 1000 ? `${totals.totalTimeUs.toFixed(3)} µs` : `${totals.totalTimeNs.toFixed(1)} ns`}
 * Flash Footprint: ${totals.totalSizeBytes} Bytes (${totals.totalSizeBytes / 2} Words)
 * Throughput: ${totals.mips.toFixed(2)} MIPS
 */
`;
    navigator.clipboard.writeText(report + '\n' + sourceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-6">
      {/* Header & Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-white">명령어 실행 시간 프로파일러 (Instruction Execution Time Profiler)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                C & ASM 클럭 사이클 / ns 정밀 계측
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              C/어셈블리 명령어 시퀀스를 입력하면 선택된 <strong>{mcuProfile.name}</strong> 클럭({clockMhz}MHz, 1T={clockPeriodNs.toFixed(1)}ns)에 기반하여
              총 실행 사이클, 분기 적중(Branch Taken) 패널티 및 나노초(ns) 타이밍을 정밀 분석합니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all shadow-sm"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? '분석 리포트 복사됨!' : '리포트 복사'}
          </button>
        </div>
      </div>

      {/* Control Bar: Clock Frequency & Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
        {/* Clock Frequency Selector */}
        <div className="lg:col-span-5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              시스템 클럭 주파수 (F_CPU)
            </label>
            <span className="text-[11px] font-mono text-amber-300 font-bold">
              1 사이클 = {clockPeriodNs.toFixed(2)} ns
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[1, 8, 12, 16, 20].map(freq => (
              <button
                key={freq}
                onClick={() => setClockMhz(freq)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                  clockMhz === freq
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {freq} MHz
              </button>
            ))}
            <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
              <input
                type="number"
                min="0.1"
                max="32"
                step="0.5"
                value={clockMhz}
                onChange={e => setClockMhz(parseFloat(e.target.value) || 16)}
                className="w-12 bg-transparent text-xs font-mono text-white focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 font-mono">MHz</span>
            </div>
          </div>
        </div>

        {/* Loop Multiplier */}
        <div className="lg:col-span-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
              루프 반복 횟수 (Iterations)
            </label>
            <span className="text-[11px] font-mono text-indigo-300">
              {loopCount} 회 반복
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 8, 16, 250, 1000].map(n => (
              <button
                key={n}
                onClick={() => setLoopCount(n)}
                className={`px-2 py-1 rounded-lg text-xs font-mono transition-all ${
                  loopCount === n
                    ? 'bg-indigo-500 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {n}x
              </button>
            ))}
          </div>
        </div>

        {/* Preset Selector */}
        <div className="lg:col-span-4 space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            실전 벤치마크 프리셋
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESET_SNIPPETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium text-left truncate transition-all ${
                  activePreset === preset.id
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
                title={preset.name}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Real-Time Metrics KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">총 실행 사이클</div>
          <div className="text-xl font-bold font-mono text-amber-400 mt-1">
            {totals.effectiveTotalCycles.toLocaleString()} <span className="text-xs text-amber-500/80">cycles</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            단일 통과: {totals.singlePassCycles} cycles
          </div>
        </div>

        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">총 소요 시간 (Timing)</div>
          <div className="text-xl font-bold font-mono text-cyan-300 mt-1 truncate">
            {totals.totalTimeNs < 1000
              ? `${totals.totalTimeNs.toFixed(1)} ns`
              : totals.totalTimeUs < 1000
              ? `${totals.totalTimeUs.toFixed(3)} µs`
              : `${totals.totalTimeMs.toFixed(3)} ms`}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            최소~최대: {(totals.effectiveMinCycles * clockPeriodNs).toFixed(0)}~{(totals.effectiveMaxCycles * clockPeriodNs).toFixed(0)} ns
          </div>
        </div>

        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">클럭 주기 (1 T-Cycle)</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            {clockPeriodNs.toFixed(2)} <span className="text-xs text-emerald-500/80">ns</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            1초당 {clockMhz}M 사이클
          </div>
        </div>

        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">유효 명령어 수</div>
          <div className="text-xl font-bold font-mono text-purple-400 mt-1">
            {totals.executableLinesCount} <span className="text-xs text-purple-500/80">개</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            반복 누적: {(totals.executableLinesCount * loopCount).toLocaleString()} 회
          </div>
        </div>

        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">플래시 메모리 소모</div>
          <div className="text-xl font-bold font-mono text-sky-400 mt-1">
            {totals.totalSizeBytes} <span className="text-xs text-sky-500/80">Bytes</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {totals.totalSizeBytes / 2} Words (16-bit Flash)
          </div>
        </div>

        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">순간 처리량 (Throughput)</div>
          <div className="text-xl font-bold font-mono text-rose-400 mt-1">
            {totals.mips.toFixed(1)} <span className="text-xs text-rose-500/80">MIPS</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            평균 1명령어당 {(totals.effectiveTotalCycles / (totals.executableLinesCount * loopCount || 1)).toFixed(2)} clk
          </div>
        </div>
      </div>

      {/* Editor & Instruction Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Code Input Area */}
        <div className="lg:col-span-5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-amber-400" />
              어셈블리 / C 명령어 시퀀스 입력
            </label>
            <span className="text-[11px] text-slate-500">
              AVR 명령어 및 C 코드 자동 인식
            </span>
          </div>

          <div className="relative">
            <textarea
              value={sourceCode}
              onChange={e => setSourceCode(e.target.value)}
              rows={14}
              placeholder="; 예시: sbi PORTB, 5&#10;nop&#10;cbi PORTB, 5"
              className="w-full bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500/60 leading-relaxed resize-y selection:bg-amber-500/30"
              spellCheck={false}
            />
          </div>

          <div className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
            💡 <strong>지원 문법</strong>: AVR 순수 어셈블리 (<code>sbi</code>, <code>cbi</code>, <code>rjmp</code>, <code>mul</code>, <code>push</code>, <code>lds</code> 등) 및 C 프리미티브 (<code>PORTB |= (1&lt;&lt;5)</code>, <code>digitalWrite</code>, <code>a = b + c</code>)
          </div>
        </div>

        {/* Right: Step-by-Step Cycle Execution Table */}
        <div className="lg:col-span-7 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              라인별 실행 사이클 &amp; 나노초(ns) 분해 내역
            </div>
            <div className="text-[11px] text-slate-500">
              조건부 분기 클릭 시 분기 적중 여부(Taken/Not Taken) 토글
            </div>
          </div>

          <div className="overflow-x-auto max-h-[380px] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900/90 sticky top-0 border-b border-slate-800 text-[11px] text-slate-400 font-semibold z-10">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">명령어 / 소스코드</th>
                  <th className="py-2.5 px-3 w-24">카테고리</th>
                  <th className="py-2.5 px-3 w-20 text-center">사이클</th>
                  <th className="py-2.5 px-3 w-24 text-right">소요시간 (ns)</th>
                  <th className="py-2.5 px-3 w-28 text-right">누적 사이클</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {(() => {
                  let runningCumulativeCycles = 0;

                  return parsedLines.map(line => {
                    if (line.isCommentOrEmpty) {
                      return (
                        <tr key={line.lineNum} className="bg-slate-950/40 text-slate-600">
                          <td className="py-1 px-3 text-center">{line.lineNum}</td>
                          <td colSpan={5} className="py-1 px-3 italic truncate">
                            {line.rawText}
                          </td>
                        </tr>
                      );
                    }

                    runningCumulativeCycles += line.effectiveCycles;
                    const timeForThisInstr = line.effectiveCycles * clockPeriodNs;
                    const timeCumulative = runningCumulativeCycles * clockPeriodNs;

                    return (
                      <tr
                        key={line.lineNum}
                        className="hover:bg-slate-900/80 transition-colors group"
                      >
                        <td className="py-2 px-3 text-slate-500 text-center font-bold">
                          {line.lineNum}
                        </td>
                        <td className="py-2 px-3 text-slate-200">
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            <span>{line.mnemonic}</span>
                            <span className="text-slate-400 font-normal">{line.operands}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans truncate max-w-xs mt-0.5" title={line.explanation}>
                            {line.explanation}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-sans font-medium ${
                              line.category === 'Branch'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : line.category === 'Bit/IO'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : line.category === 'Data Transfer'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                : line.category === 'Stack'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : line.category === 'C Primitive'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {line.category}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {line.isConditional ? (
                            <button
                              onClick={() => handleToggleBranch(line.lineNum)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all ${
                                line.branchTaken
                                  ? 'bg-amber-500/30 text-amber-300 border-amber-500/50 hover:bg-amber-500/40'
                                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                              }`}
                              title="클릭하여 분기 적중(Taken: 2clk) / 미적중(Not Taken: 1clk) 전환"
                            >
                              {line.effectiveCycles} clk {line.branchTaken ? '✓' : '✗'}
                            </button>
                          ) : (
                            <span className="font-bold text-amber-400">
                              {line.effectiveCycles} clk
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right text-cyan-300 font-semibold">
                          {timeForThisInstr >= 1000
                            ? `${(timeForThisInstr / 1000).toFixed(2)} µs`
                            : `${timeForThisInstr.toFixed(1)} ns`}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-400">
                          <span className="text-white font-bold">{runningCumulativeCycles}</span> clk
                          <div className="text-[10px] text-slate-500">
                            {timeCumulative >= 1000
                              ? `${(timeCumulative / 1000).toFixed(2)} µs`
                              : `${timeCumulative.toFixed(1)} ns`}
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Optimization Analysis & AVR Microarchitecture Insights */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span>MCU 아키텍처 관점의 성능 분석 &amp; 병목(Bottleneck) 최적화 가이드</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="text-amber-400 font-semibold block text-[11px]">1. I/O 비트 제어 (Atomic SBI/CBI)</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              AVR 하위 32개 I/O 주소(0x00~0x1F)에 위치한 PORTB, PORTC, PORTD는 <code>sbi</code>/<code>cbi</code> 단일 명령으로 <strong>2사이클(125ns)</strong>에 하드웨어 원자적 토글이 가능합니다. 아두이노 <code>digitalWrite()</code>(약 62사이클, 3.88µs) 대비 약 <strong>31배 이상 빠릅니다</strong>.
            </p>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="text-cyan-400 font-semibold block text-[11px]">2. 하드웨어 곱셈기 vs 나눗셈</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              ATmega328P/128/640은 하드웨어 8×8 곱셈기(<code>MUL</code>)를 내장하여 단 <strong>2사이클</strong>에 16비트 곱셈 결과를 도출합니다. 반면 하드웨어 나눗셈기가 없어 16비트 나눗셈은 약 <strong>100~180사이클</strong>이 소요되므로 비트 시프트(<code>&gt;&gt;</code>)로 대체해야 합니다.
            </p>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="text-purple-400 font-semibold block text-[11px]">3. 분기 예측 미탑재 &amp; 파이프라인 플러시</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              AVR RISC 코어는 단일단 2-Stage 파이프라인을 사용하며, 분기문(<code>BRNE</code>, <code>RJMP</code>)이 적중(Taken)할 때 이미 프리페치된 다음 명령어를 폐기하므로 <strong>추가 1사이클 패널티(총 2사이클)</strong>가 발생합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
