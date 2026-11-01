import React, { useState, useMemo } from 'react';
import {
  Clock,
  Cpu,
  Zap,
  Search,
  Sliders,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  TrendingUp,
  Activity,
  Calculator,
  Maximize2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export interface InstructionSpec {
  mnemonic: string;
  fullName: string;
  category: 'Arithmetic' | 'Multiplier' | 'Logic' | 'Branch' | 'Data Transfer' | 'Bit & I/O' | 'Stack & Subroutine' | 'System Control';
  cyclesMin: number;
  cyclesMax: number;
  conditionDescription?: string;
  words: 1 | 2; // 16-bit or 32-bit opcode
  description: string;
  syntax: string;
  flagsAffected: string;
  hardwareUnit: 'ALU' | 'HW Multiplier' | 'Branch Unit' | 'Flash Bus' | 'SRAM Bus' | 'I/O Bus' | 'Control Unit';
  mcuSupportNote?: string;
}

export const AVR_INSTRUCTION_SET: InstructionSpec[] = [
  // Multiplier (Special AVR Hardware Multiplier)
  {
    mnemonic: 'MUL',
    fullName: 'Multiply Unsigned (8-bit x 8-bit -> 16-bit)',
    category: 'Multiplier',
    cyclesMin: 2,
    cyclesMax: 2,
    words: 1,
    syntax: 'MUL Rd, Rr',
    description: '부호 없는 8비트 곱셈 (R1:R0 <- Rd * Rr). 고속 하드웨어 승산기를 사용하여 단 2클럭에 16비트 곱셈 결과를 생성합니다.',
    flagsAffected: 'Z, C (Carry는 15번 비트 복사)',
    hardwareUnit: 'HW Multiplier',
    mcuSupportNote: 'MegaAVR 코어(ATmega328P/128/640/2560) 전 기종 하드웨어 2사이클 곱셈기 내장'
  },
  {
    mnemonic: 'MULS',
    fullName: 'Multiply Signed (8-bit x 8-bit -> 16-bit)',
    category: 'Multiplier',
    cyclesMin: 2,
    cyclesMax: 2,
    words: 1,
    syntax: 'MULS Rd, Rr',
    description: '부호 있는 2의 보수 8비트 곱셈 (R1:R0 <- Rd * Rr, R16~R31 지원). DSP 필터링 연산에 필수적입니다.',
    flagsAffected: 'Z, C',
    hardwareUnit: 'HW Multiplier'
  },
  {
    mnemonic: 'MULSU',
    fullName: 'Multiply Signed with Unsigned',
    category: 'Multiplier',
    cyclesMin: 2,
    cyclesMax: 2,
    words: 1,
    syntax: 'MULSU Rd, Rr',
    description: '부호 있는 수와 부호 없는 수 간의 혼합 곱셈 (R1:R0 <- Rd[signed] * Rr[unsigned]).',
    flagsAffected: 'Z, C',
    hardwareUnit: 'HW Multiplier'
  },
  {
    mnemonic: 'FMUL',
    fullName: 'Fractional Multiply Unsigned (Q7 x Q7 -> Q15)',
    category: 'Multiplier',
    cyclesMin: 2,
    cyclesMax: 2,
    words: 1,
    syntax: 'FMUL Rd, Rr',
    description: '부동소수점 근사/고정소수점 16비트 정규화 곱셈. 곱셈 후 결과를 1비트 좌측 시프트하여 Q15 포맷으로 변환합니다.',
    flagsAffected: 'Z, C',
    hardwareUnit: 'HW Multiplier'
  },
  {
    mnemonic: 'FMULS',
    fullName: 'Fractional Multiply Signed',
    category: 'Multiplier',
    cyclesMin: 2,
    cyclesMax: 2,
    words: 1,
    syntax: 'FMULS Rd, Rr',
    description: '부호 있는 2의 보수 고정소수점 DSP 곱셈.',
    flagsAffected: 'Z, C',
    hardwareUnit: 'HW Multiplier'
  },

  // Arithmetic
  {
    mnemonic: 'ADIW',
    fullName: 'Add Immediate to Word (16-bit Word Addition)',
    category: 'Arithmetic',
    cyclesMin: 2,
    cyclesMax: 2,
    words: 1,
    syntax: 'ADIW Rd+1:Rd, K6',
    description: '16비트 포인터 레지스터 쌍(R25:R24, X, Y, Z)에 0~63 즉칫값을 2클럭 만에 직접 가산합니다.',
    flagsAffected: 'S, V, N, Z, C',
    hardwareUnit: 'ALU'
  },
  {
    mnemonic: 'SBIW',
    fullName: 'Subtract Immediate from Word (16-bit)',
    category: 'Arithmetic',
    cyclesMin: 2,
    cyclesMax: 2,
    words: 1,
    syntax: 'SBIW Rd+1:Rd, K6',
    description: '16비트 레지스터 쌍에서 0~63 즉칫값을 2클럭으로 직접 감산합니다.',
    flagsAffected: 'S, V, N, Z, C',
    hardwareUnit: 'ALU'
  },
  {
    mnemonic: 'ADD',
    fullName: 'Add two Registers without Carry',
    category: 'Arithmetic',
    cyclesMin: 1,
    cyclesMax: 1,
    words: 1,
    syntax: 'ADD Rd, Rr',
    description: '두 범용 레지스터의 8비트 덧셈 (Rd <- Rd + Rr). 듀얼 포트 레지스터 파일 덕분에 1클럭에 완료됩니다.',
    flagsAffected: 'H, S, V, N, Z, C',
    hardwareUnit: 'ALU'
  },
  {
    mnemonic: 'ADC',
    fullName: 'Add with Carry',
    category: 'Arithmetic',
    cyclesMin: 1,
    cyclesMax: 1,
    words: 1,
    syntax: 'ADC Rd, Rr',
    description: '캐리 플래그(C)를 포함한 8비트 덧셈 (Rd <- Rd + Rr + C). 다중 바이트(32/64비트) 연산 루프에 사용됩니다.',
    flagsAffected: 'H, S, V, N, Z, C',
    hardwareUnit: 'ALU'
  },
  {
    mnemonic: 'SUB',
    fullName: 'Subtract Registers without Carry',
    category: 'Arithmetic',
    cyclesMin: 1,
    cyclesMax: 1,
    words: 1,
    syntax: 'SUB Rd, Rr',
    description: '두 레지스터 8비트 뺄셈 (Rd <- Rd - Rr).',
    flagsAffected: 'H, S, V, N, Z, C',
    hardwareUnit: 'ALU'
  },
  {
    mnemonic: 'SUBI',
    fullName: 'Subtract Immediate',
    category: 'Arithmetic',
    cyclesMin: 1,
    cyclesMax: 1,
    words: 1,
    syntax: 'SUBI Rd, K8',
    description: '상수값 8비트 즉치 감산 (Rd <- Rd - K, R16~R31).',
    flagsAffected: 'H, S, V, N, Z, C',
    hardwareUnit: 'ALU'
  },
  {
    mnemonic: 'INC',
    fullName: 'Increment Register',
    category: 'Arithmetic',
    cyclesMin: 1,
    cyclesMax: 1,
    words: 1,
    syntax: 'INC Rd',
    description: '레지스터 1 증가 (Rd <- Rd + 1). Carry 플래그를 변경하지 않는 특성이 있습니다.',
    flagsAffected: 'S, V, N, Z',
    hardwareUnit: 'ALU'
  },
  {
    mnemonic: 'DEC',
    fullName: 'Decrement Register',
    category: 'Arithmetic',
    cyclesMin: 1,
    cyclesMax: 1,
    words: 1,
    syntax: 'DEC Rd',
    description: '레지스터 1 감소 (Rd <- Rd - 1). 루프 카운터에 최적화.',
    flagsAffected: 'S, V, N, Z',
    hardwareUnit: 'ALU'
  },

  // Data Transfer (Flash vs SRAM)
  {
    mnemonic: 'LDI',
    fullName: 'Load Immediate (8-bit Constant)',
    category: 'Data Transfer',
    cyclesMin: 1,
    cyclesMax: 1,
    words: 1,
    syntax: 'LDI Rd, K8',
    description: '8비트 상수(0~255)를 R16~R31 상위 레지스터에 1클럭 즉시 로드.',
    flagsAffected: 'None',
    hardwareUnit: 'Flash Bus'
  },
  {
    mnemonic: 'MOV',
    fullName: 'Copy Register',
    category: 'Data Transfer',
    cyclesMin: 1,
    cyclesMax: 1,
    words: 1,
    syntax: 'MOV Rd, Rr',
    description: '레지스터 간 8비트 데이터 고속 복사 (1클럭).',
    flagsAffected: 'None',
    hardwareUnit: 'Control Unit'
  },
  {
    mnemonic: 'MOVW',
    fullName: 'Copy Register Word (16-bit)',
    category: 'Data Transfer',
    cyclesMin: 1,
    cyclesMax: 1,
    words: 1,
    syntax: 'MOVW Rd+1:Rd, Rr+1:Rr',
    description: '16비트 레지스터 쌍을 단 1클럭 만에 복사하여 포인터 및 16비트 정수 연산을 가속합니다.',
    flagsAffected: 'None',
    hardwareUnit: 'Control Unit'
  },
  {
    mnemonic: 'LDS',
    fullName: 'Load Direct from Data Space (SRAM)',
    category: 'Data Transfer',
    cyclesMin: 2,
    cyclesMax: 2,
    words: 2,
    syntax: 'LDS Rd, k16',
    description: 'SRAM 16비트 절대 주소에서 1바이트 읽기 (32비트 2워드 명령어). 플래시 인출 1클럭 + SRAM 데이터 버스 읽기 1클럭 = 2클럭.',
    flagsAffected: 'None',
    hardwareUnit: 'SRAM Bus'
  },
  {
    mnemonic: 'STS',
    fullName: 'Store Direct to Data Space (SRAM)',
    category: 'Data Transfer',
    cyclesMin: 2,
    cyclesMax: 2,
    words: 2,
    syntax: 'STS k16, Rr',
    description: 'SRAM 16비트 절대 주소로 1바이트 저장 (32비트 2워드 명령어). 플래시 1클럭 + SRAM 쓰기 1클럭 = 2클럭.',
    flagsAffected: 'None',
    hardwareUnit: 'SRAM Bus'
  },
  {
    mnemonic: 'LD',
    fullName: 'Load Indirect using Pointer (X, Y, Z)',
    category: 'Data Transfer',
    cyclesMin: 1,
    cyclesMax: 2,
    conditionDescription: '일반 포인터 접근: 2사이클 (신형 core에서는 1~2사이클)',
    words: 1,
    syntax: 'LD Rd, X / X+ / -X',
    description: '포인터 레지스터(X, Y, Z)를 통한 간접 SRAM 로드. 후증가(X+) 및 선감소(-X) 지원.',
    flagsAffected: 'None',
    hardwareUnit: 'SRAM Bus'
  },
  {
    mnemonic: 'ST',
    fullName: 'Store Indirect using Pointer (X, Y, Z)',
    category: 'Data Transfer',
    cyclesMin: 1,
    cyclesMax: 2,
    conditionDescription: '일반 간접 저장: 2사이클 (신형 core 1~2사이클)',
    words: 1,
    syntax: 'ST X, Rr / X+, Rr / -X, Rr',
    description: '포인터 레지스터를 통한 간접 SRAM 쓰기.',
    flagsAffected: 'None',
    hardwareUnit: 'SRAM Bus'
  },
  {
    mnemonic: 'LPM',
    fullName: 'Load Program Memory (Flash Read via Z-pointer)',
    category: 'Data Transfer',
    cyclesMin: 3,
    cyclesMax: 3,
    words: 1,
    syntax: 'LPM Rd, Z / Z+',
    description: 'PROGMEM 플래시 롬에서 상수 바이트를 읽어옵니다. 내부 하버드 버스 중재로 인해 3사이클이 소요됩니다.',
    flagsAffected: 'None',
    hardwareUnit: 'Flash Bus'
  },

  // Branch & Jump
  {
    mnemonic: 'RJMP',
    fullName: 'Relative Jump (-2048 ~ +2047 words)',
    category: 'Branch',
    cyclesMin: 2,
    cyclesMax: 2,
    words: 1,
    syntax: 'RJMP k',
    description: '상대 주소로 무조건 점프. 파이프라인 재충전으로 인해 항상 2사이클이 소요됩니다.',
    flagsAffected: 'None',
    hardwareUnit: 'Branch Unit'
  },
  {
    mnemonic: 'JMP',
    fullName: 'Absolute Jump (Full Program Memory)',
    category: 'Branch',
    cyclesMin: 3,
    cyclesMax: 3,
    words: 2,
    syntax: 'JMP k',
    description: '32비트 2워드 절대 주소 점프 (전체 플래시 주소 공간 도달 가능). 플래시 인출 2사이클 + 파이프라인 충전 1사이클 = 3사이클.',
    flagsAffected: 'None',
    hardwareUnit: 'Branch Unit'
  },
  {
    mnemonic: 'BREQ',
    fullName: 'Branch if Equal (Z == 1)',
    category: 'Branch',
    cyclesMin: 1,
    cyclesMax: 2,
    conditionDescription: '분기 불성립(Not Taken): 1사이클 | 분기 성립(Taken): 2사이클',
    words: 1,
    syntax: 'BREQ k',
    description: 'Z(Zero) 플래그가 1이면 분기. 거짓이면 1사이클(순차 진행), 참이면 파이프라인 플러시로 2사이클 소요.',
    flagsAffected: 'None',
    hardwareUnit: 'Branch Unit'
  },
  {
    mnemonic: 'BRNE',
    fullName: 'Branch if Not Equal (Z == 0)',
    category: 'Branch',
    cyclesMin: 1,
    cyclesMax: 2,
    conditionDescription: '분기 불성립(Not Taken): 1사이클 | 분기 성립(Taken): 2사이클',
    words: 1,
    syntax: 'BRNE k',
    description: 'Z 플래그가 0이면 분기 (루프 탈출에 가장 널리 쓰임). 불성립 시 1사이클, 성립 시 2사이클.',
    flagsAffected: 'None',
    hardwareUnit: 'Branch Unit'
  },
  {
    mnemonic: 'BRCS',
    fullName: 'Branch if Carry Set (C == 1)',
    category: 'Branch',
    cyclesMin: 1,
    cyclesMax: 2,
    conditionDescription: '불성립: 1사이클 | 성립: 2사이클',
    words: 1,
    syntax: 'BRCS k',
    description: '캐리 플래그가 1일 때 상대 분기 점프.',
    flagsAffected: 'None',
    hardwareUnit: 'Branch Unit'
  },
  {
    mnemonic: 'BRCC',
    fullName: 'Branch if Carry Cleared (C == 0)',
    category: 'Branch',
    cyclesMin: 1,
    cyclesMax: 2,
    conditionDescription: '불성립: 1사이클 | 성립: 2사이클',
    words: 1,
    syntax: 'BRCC k',
    description: '캐리 플래그가 0일 때 상대 분기 점프.',
    flagsAffected: 'None',
    hardwareUnit: 'Branch Unit'
  },

  // Stack & Subroutine
  {
    mnemonic: 'RCALL',
    fullName: 'Relative Call Subroutine',
    category: 'Stack & Subroutine',
    cyclesMin: 3,
    cyclesMax: 4,
    conditionDescription: '16비트 PC MCU(328P/128/640): 3사이클 | 22비트 PC MCU(2560): 4사이클',
    words: 1,
    syntax: 'RCALL k',
    description: '서브루틴 상대 호출. 반환 주소(PC)를 스택에 PUSH(2~3바이트) 후 타깃으로 점프.',
    flagsAffected: 'None',
    hardwareUnit: 'Control Unit'
  },
  {
    mnemonic: 'CALL',
    fullName: 'Absolute Call Subroutine',
    category: 'Stack & Subroutine',
    cyclesMin: 4,
    cyclesMax: 5,
    conditionDescription: '16비트 PC MCU: 4사이클 | 22비트 PC (ATmega2560): 5사이클',
    words: 2,
    syntax: 'CALL k',
    description: '절대 주소 함수 호출 (32비트 명령어). PC 스택 푸시 및 파이프라인 재충전.',
    flagsAffected: 'None',
    hardwareUnit: 'Control Unit'
  },
  {
    mnemonic: 'RET',
    fullName: 'Return from Subroutine',
    category: 'Stack & Subroutine',
    cyclesMin: 4,
    cyclesMax: 5,
    conditionDescription: '16비트 PC MCU: 4사이클 | 22비트 PC (ATmega2560): 5사이클',
    words: 1,
    syntax: 'RET',
    description: '함수 복귀. 스택에서 이전 PC 값을 POP(2~3바이트)하여 프로그램 카운터 복원.',
    flagsAffected: 'None',
    hardwareUnit: 'Control Unit'
  },
  {
    mnemonic: 'RETI',
    fullName: 'Return from Interrupt Routine',
    category: 'Stack & Subroutine',
    cyclesMin: 4,
    cyclesMax: 5,
    conditionDescription: '16비트 PC MCU: 4사이클 | 22비트 PC (ATmega2560): 5사이클',
    words: 1,
    syntax: 'RETI',
    description: '인터럽트 복귀. 스택에서 PC를 복원하고 전역 인터럽트 플래그(SREG.I)를 1로 즉시 재활성화.',
    flagsAffected: 'I (SREG.I=1 자동 복원)',
    hardwareUnit: 'Control Unit'
  },
  {
    mnemonic: 'PUSH',
    fullName: 'Push Register onto Stack',
    category: 'Stack & Subroutine',
    cyclesMin: 2,
    cyclesMax: 2,
    words: 1,
    syntax: 'PUSH Rr',
    description: '레지스터 1바이트를 SRAM 스택(SP)에 저장하고 스택 포인터 1 감소 (2사이클 소요).',
    flagsAffected: 'None',
    hardwareUnit: 'SRAM Bus'
  },
  {
    mnemonic: 'POP',
    fullName: 'Pop Register from Stack',
    category: 'Stack & Subroutine',
    cyclesMin: 2,
    cyclesMax: 2,
    words: 1,
    syntax: 'POP Rd',
    description: '스택 포인터 1 증가 후 SRAM 스택에서 레지스터로 1바이트 복원 (2사이클 소요).',
    flagsAffected: 'None',
    hardwareUnit: 'SRAM Bus'
  },

  // Bit & I/O
  {
    mnemonic: 'IN',
    fullName: 'Load an I/O Port to Register',
    category: 'Bit & I/O',
    cyclesMin: 1,
    cyclesMax: 1,
    words: 1,
    syntax: 'IN Rd, P',
    description: '표준 I/O 레지스터(0x00~0x3F)에서 범용 레지스터로 1클럭에 직접 읽기.',
    flagsAffected: 'None',
    hardwareUnit: 'I/O Bus'
  },
  {
    mnemonic: 'OUT',
    fullName: 'Store Register to I/O Port',
    category: 'Bit & I/O',
    cyclesMin: 1,
    cyclesMax: 1,
    words: 1,
    syntax: 'OUT P, Rr',
    description: '범용 레지스터 값을 I/O 포트(PORTB, DDRB 등)에 1클럭으로 즉시 출력.',
    flagsAffected: 'None',
    hardwareUnit: 'I/O Bus'
  },
  {
    mnemonic: 'SBI',
    fullName: 'Set Bit in I/O Register',
    category: 'Bit & I/O',
    cyclesMin: 2,
    cyclesMax: 2,
    words: 1,
    syntax: 'SBI P, b',
    description: '하위 32개 I/O 레지스터의 특정 비트를 원자적(Atomic)으로 1 세트. 읽기-수정-쓰기 하드웨어 2사이클 소요.',
    flagsAffected: 'None',
    hardwareUnit: 'I/O Bus'
  },
  {
    mnemonic: 'CBI',
    fullName: 'Clear Bit in I/O Register',
    category: 'Bit & I/O',
    cyclesMin: 2,
    cyclesMax: 2,
    words: 1,
    syntax: 'CBI P, b',
    description: '하위 32개 I/O 레지스터의 특정 비트를 원자적(Atomic)으로 0 클리어. 하드웨어 2사이클.',
    flagsAffected: 'None',
    hardwareUnit: 'I/O Bus'
  },

  // System Control & Logic
  {
    mnemonic: 'NOP',
    fullName: 'No Operation',
    category: 'System Control',
    cyclesMin: 1,
    cyclesMax: 1,
    words: 1,
    syntax: 'NOP',
    description: '아무 연산도 수행하지 않고 정확히 1클럭 사이클을 소모합니다 (정밀 타이밍 딜레이 및 동기화).',
    flagsAffected: 'None',
    hardwareUnit: 'Control Unit'
  },
  {
    mnemonic: 'SLEEP',
    fullName: 'Sleep (Low Power Mode)',
    category: 'System Control',
    cyclesMin: 1,
    cyclesMax: 1,
    words: 1,
    syntax: 'SLEEP',
    description: 'MCU 코어를 절전 모드로 진입시키며 외부 인터럽트나 타이머에 의해 기상할 때까지 대기합니다.',
    flagsAffected: 'None',
    hardwareUnit: 'Control Unit'
  },
  {
    mnemonic: 'WDR',
    fullName: 'Watchdog Reset',
    category: 'System Control',
    cyclesMin: 1,
    cyclesMax: 1,
    words: 1,
    syntax: 'WDR',
    description: '워치독 타이머 카운터를 0으로 리셋하여 시스템 비정상 리셋을 방지합니다 (1클럭).',
    flagsAffected: 'None',
    hardwareUnit: 'Control Unit'
  }
];

export const InstructionTimingCalculator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // User Inputs
  const [selectedMnemonic, setSelectedMnemonic] = useState<string>('ADIW');
  const [clockMhz, setClockMhz] = useState<number>(selectedMCU === 'atmega328p' ? 16 : 16);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [branchConditionState, setBranchConditionState] = useState<'taken' | 'not_taken'>('taken');
  const [iterationCount, setIterationCount] = useState<number>(1);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);

  // Available Categories
  const categories = useMemo(() => {
    return ['All', 'Multiplier', 'Arithmetic', 'Data Transfer', 'Branch', 'Stack & Subroutine', 'Bit & I/O', 'System Control'];
  }, []);

  // Filtered Instructions
  const filteredInstructions = useMemo(() => {
    return AVR_INSTRUCTION_SET.filter((inst) => {
      const matchCat = activeCategory === 'All' || inst.category === activeCategory;
      const matchQuery =
        inst.mnemonic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [searchQuery, activeCategory]);

  // Selected Instruction Object
  const currentInstruction = useMemo(() => {
    return (
      AVR_INSTRUCTION_SET.find((i) => i.mnemonic.toUpperCase() === selectedMnemonic.toUpperCase()) ||
      AVR_INSTRUCTION_SET[0]
    );
  }, [selectedMnemonic]);

  // Calculate Cycles based on condition & MCU
  const calculatedCycles = useMemo(() => {
    let cycles = currentInstruction.cyclesMin;

    if (currentInstruction.category === 'Branch') {
      if (currentInstruction.mnemonic === 'RJMP' || currentInstruction.mnemonic === 'JMP') {
        cycles = currentInstruction.cyclesMin;
      } else {
        cycles = branchConditionState === 'taken' ? currentInstruction.cyclesMax : currentInstruction.cyclesMin;
      }
    } else if (currentInstruction.category === 'Stack & Subroutine') {
      // ATmega2560 has 3-byte PC, others 2-byte PC
      if (selectedMCU === 'atmega2560' && currentInstruction.cyclesMax > currentInstruction.cyclesMin) {
        cycles = currentInstruction.cyclesMax;
      } else {
        cycles = currentInstruction.cyclesMin;
      }
    }

    return cycles;
  }, [currentInstruction, branchConditionState, selectedMCU]);

  // Total Cycles and Execution Time Calculations
  const singleCycleTimeNs = useMemo(() => {
    return +(1000 / clockMhz).toFixed(3);
  }, [clockMhz]);

  const singleExecutionTimeNs = useMemo(() => {
    return +(calculatedCycles * singleCycleTimeNs).toFixed(2);
  }, [calculatedCycles, singleCycleTimeNs]);

  const totalCycleCount = calculatedCycles * iterationCount;
  const totalExecutionTimeNs = +(totalCycleCount * singleCycleTimeNs).toFixed(2);
  const totalExecutionTimeUs = +(totalExecutionTimeNs / 1000).toFixed(4);

  const handleCopyCode = () => {
    const text = `// AVR Instruction Timing: ${currentInstruction.mnemonic} (${currentInstruction.fullName})
// Target: ${currentProfile.name} @ ${clockMhz} MHz
// Single Execution: ${calculatedCycles} cycles = ${singleExecutionTimeNs} ns
// ${iterationCount > 1 ? `Loop (${iterationCount}x): ${totalCycleCount} cycles = ${totalExecutionTimeNs} ns (${totalExecutionTimeUs} µs)\n` : ''}
asm volatile("${currentInstruction.syntax}\\n\\t");`;

    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    confetti({ particleCount: 25, spread: 45, origin: { y: 0.8 } });
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div id="instruction-timing-calculator-card" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur-xl shadow-2xl space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
            <Calculator className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                명령어 실행 시간 및 클럭 사이클 계산기
              </h3>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                Instruction Timing Calculator
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                {currentProfile.name}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              특정 어셈블리 명령어(예: <strong className="text-amber-300">ADIW</strong>, <strong className="text-amber-300">MUL</strong>, <strong className="text-amber-300">LDS</strong>)와 동작 클럭 주파수를 입력하여 정확한 <strong>소요 클럭 사이클</strong>과 <strong>나노초(ns) 단위 절대 실행 시간</strong>을 계산합니다.
            </p>
          </div>
        </div>

        {/* Quick Clock Frequency Presets */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400 font-mono">클럭 속도:</span>
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            {[8, 12, 16, 20].map((f) => (
              <button
                key={f}
                onClick={() => setClockMhz(f)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  clockMhz === f
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f}MHz
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main KPI Dashboard: Cycles & Nanosecond Latency */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Single Instruction Cycles */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4.5 relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> 소요 클럭 사이클
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300">
              {currentInstruction.words === 1 ? '16-bit Opcode' : '32-bit Opcode'}
            </span>
          </div>
          <div className="text-3xl font-black text-amber-400 font-mono tracking-tight mt-1">
            {calculatedCycles} <span className="text-sm font-normal text-slate-400">Cycles</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {currentInstruction.cyclesMin !== currentInstruction.cyclesMax
              ? `조건부: ${currentInstruction.cyclesMin}~${currentInstruction.cyclesMax} 사이클`
              : '고정 단일 결정론적 클럭'}
          </p>
        </div>

        {/* KPI 2: Execution Time in Nanoseconds */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4.5 relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Zap className="w-3.5 h-3.5 text-cyan-400" /> 단일 실행 시간 (ns)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
              1 T = {singleCycleTimeNs} ns
            </span>
          </div>
          <div className="text-3xl font-black text-cyan-400 font-mono tracking-tight mt-1">
            {singleExecutionTimeNs} <span className="text-sm font-normal text-slate-400">ns</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            @ {clockMhz} MHz ({currentProfile.name})
          </p>
        </div>

        {/* KPI 3: Total Loop / Batch Execution */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4.5 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Activity className="w-3.5 h-3.5 text-emerald-400" /> {iterationCount}회 누적 지연 시간
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              {totalCycleCount} Cycles
            </span>
          </div>
          <div className="text-3xl font-black text-emerald-400 font-mono tracking-tight mt-1">
            {totalExecutionTimeNs >= 1000 ? `${totalExecutionTimeUs} µs` : `${totalExecutionTimeNs} ns`}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            {totalExecutionTimeNs.toLocaleString()} ns 총 실행 소요
          </p>
        </div>

        {/* KPI 4: Hardware Engine & Bus */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4.5 relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Cpu className="w-3.5 h-3.5 text-purple-400" /> 하드웨어 실행 유닛
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40">
              {currentInstruction.category}
            </span>
          </div>
          <div className="text-xl font-bold text-white font-mono tracking-tight mt-1 truncate">
            {currentInstruction.hardwareUnit}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            영향 플래그: <strong className="text-amber-300 font-mono">{currentInstruction.flagsAffected}</strong>
          </p>
        </div>
      </div>

      {/* Interactive Controls & Instruction Selector */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              명령어 선택 및 클럭 주파수 미세 조정
            </h4>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="명령어 검색 (예: ADIW, MUL, LDS)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-mono mr-1">분류:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Quick Instruction Buttons Grid */}
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 custom-scrollbar">
          {filteredInstructions.map((inst) => {
            const isSelected = inst.mnemonic === selectedMnemonic;
            return (
              <button
                key={inst.mnemonic}
                onClick={() => setSelectedMnemonic(inst.mnemonic)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 ring-1 ring-amber-400 scale-105'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{inst.mnemonic}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-normal ${isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-950 text-slate-400'}`}>
                  {inst.cyclesMin === inst.cyclesMax ? `${inst.cyclesMin}clk` : `${inst.cyclesMin}~${inst.cyclesMax}clk`}
                </span>
              </button>
            );
          })}
        </div>

        {/* Detailed Tuning Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-800 text-xs">
          {/* Clock Frequency Slider & Direct Input */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold">동작 클럭 주파수 (f_CPU):</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0.1}
                  max={24}
                  step={0.5}
                  value={clockMhz}
                  onChange={(e) => setClockMhz(Math.max(0.1, Math.min(24, parseFloat(e.target.value) || 1)))}
                  className="w-16 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-right text-amber-400 font-bold text-xs"
                />
                <span className="text-amber-400 font-bold">MHz</span>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              step={0.5}
              value={clockMhz}
              onChange={(e) => setClockMhz(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1 MHz</span>
              <span>16 MHz (표준)</span>
              <span>20 MHz (정격 최대)</span>
            </div>
          </div>

          {/* Loop / Repetition Count */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold">반복 실행 횟수 (N회 루프):</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={iterationCount}
                  onChange={(e) => setIterationCount(Math.max(1, Math.min(100000, parseInt(e.target.value) || 1)))}
                  className="w-20 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-right text-emerald-400 font-bold text-xs"
                />
                <span className="text-emerald-400 font-bold">회</span>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={1000}
              value={iterationCount}
              onChange={(e) => setIterationCount(parseInt(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1회 (단일)</span>
              <span>100회</span>
              <span>1000회</span>
            </div>
          </div>

          {/* Branch Condition State Toggle (if conditional) */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold">조건 분기 평가 상태:</span>
              <span className="text-cyan-400 font-bold text-[11px]">
                {currentInstruction.category === 'Branch' && currentInstruction.cyclesMin !== currentInstruction.cyclesMax
                  ? branchConditionState === 'taken' ? '참 (Taken: 2clk)' : '거짓 (Not Taken: 1clk)'
                  : '해당 없음'}
              </span>
            </div>
            {currentInstruction.category === 'Branch' && currentInstruction.cyclesMin !== currentInstruction.cyclesMax ? (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => setBranchConditionState('taken')}
                  className={`py-1 rounded-lg text-xs font-bold transition ${
                    branchConditionState === 'taken' ? 'bg-amber-500 text-slate-950' : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  분기 성립 (Taken)
                </button>
                <button
                  onClick={() => setBranchConditionState('not_taken')}
                  className={`py-1 rounded-lg text-xs font-bold transition ${
                    branchConditionState === 'not_taken' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  분기 불성립 (Not Taken)
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 pt-2 font-mono">
                현재 명령어는 고정 사이클로 동작하며 분기 조건에 영향을 받지 않습니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visual Clock Timeline Diagram */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              {currentInstruction.mnemonic} 클럭 사이클 분해 및 나노초 타임라인 ({clockMhz} MHz)
            </h4>
          </div>
          <span className="text-xs font-mono text-cyan-400">
            총 실행 시간: {singleExecutionTimeNs} ns
          </span>
        </div>

        {/* Visual Cycle Blocks */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: calculatedCycles }).map((_, idx) => {
              const cycleStartNs = +(idx * singleCycleTimeNs).toFixed(2);
              const cycleEndNs = +((idx + 1) * singleCycleTimeNs).toFixed(2);
              const isFetch = idx === 0;

              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-800 bg-slate-900/90 space-y-1.5 relative overflow-hidden"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300">
                      Cycle T{idx + 1}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {singleCycleTimeNs} ns
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white pt-1">
                    {isFetch
                      ? '명령어 인출 (Fetch) & 디코드'
                      : idx === 1 && currentInstruction.words === 2
                      ? '2워드(32-bit) 16비트 주소 인출'
                      : currentInstruction.hardwareUnit === 'HW Multiplier'
                      ? '하드웨어 16비트 곱셈 연산'
                      : currentInstruction.hardwareUnit === 'SRAM Bus'
                      ? 'SRAM 데이터 버스 접근'
                      : 'ALU 연산 및 결과 쓰기'}
                  </div>
                  <div className="text-[10px] text-cyan-400 font-mono">
                    {cycleStartNs} ns ➔ {cycleEndNs} ns
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 text-xs text-slate-300 leading-relaxed flex items-start gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white font-mono">{currentInstruction.syntax}</strong>: {currentInstruction.description}
              {currentInstruction.mcuSupportNote && (
                <span className="block text-[11px] text-amber-300/90 mt-1">
                  💡 {currentInstruction.mcuSupportNote}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Code Snippet & Copy */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <span>C / Inline Assembly 스니펫</span>
            <span className="text-xs text-slate-400 font-normal font-mono">
              ({currentInstruction.mnemonic} • {calculatedCycles}clk = {singleExecutionTimeNs}ns)
            </span>
          </div>
          <code className="text-xs font-mono text-emerald-400 mt-1 block">
            asm volatile("{currentInstruction.syntax}\\n\\t");
          </code>
        </div>
        <button
          onClick={handleCopyCode}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 shrink-0"
        >
          {copiedSnippet ? <Check className="w-4 h-4 text-slate-950" /> : <Copy className="w-4 h-4" />}
          <span>{copiedSnippet ? '복사 완료!' : '타이밍 스니펫 복사'}</span>
        </button>
      </div>
    </div>
  );
};
