import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  GitCompare,
  ArrowRight,
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Search,
  Filter,
  Copy,
  Check,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Sliders,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Code2,
  Terminal,
  RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type DiffCategory = 'all' | 'timer' | 'usart' | 'comm' | 'analog' | 'interrupt' | 'system' | 'gpio';

export interface BitField {
  bit: number;
  name: string;
  desc: string;
  isReserved?: boolean;
}

export interface McuRegisterData {
  supported: boolean;
  regName: string;
  ioAddr: string;
  memAddr: string;
  isExtendedIo: boolean; // > 0x3F (requires LDS/STS instead of IN/OUT)
  bits: BitField[];
  notes?: string;
}

export interface RegisterCompatibilityItem {
  id: string; // Generic canonical ID (e.g. "TCCR0A", "TIMSK0", "UCSR0A")
  category: DiffCategory;
  categoryLabel: string;
  title: string;
  description: string;
  mcus: Record<SupportedMCU, McuRegisterData>;
  migrationNotice?: {
    pair: string; // e.g. "atmega328p_atmega128"
    severity: 'critical' | 'warning' | 'info';
    summary: string;
    workaround: string;
  }[];
}

// Master Cross-MCU Register Address & Bit Map Database
export const MASTER_REGISTER_COMPATIBILITY_DB: RegisterCompatibilityItem[] = [
  // 1. Timer0 Control Register A
  {
    id: 'TCCR0A',
    category: 'timer',
    categoryLabel: '8비트 타이머 0',
    title: 'Timer/Counter0 Control Register A',
    description: '타이머0 파형 생성 모드(WGM01:00) 및 비교 출력 모드(COM0A/B) 제어',
    mcus: {
      atmega328p: {
        supported: true,
        regName: 'TCCR0A',
        ioAddr: '0x24',
        memAddr: '0x44',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: 'COM0A1', desc: 'OC0A 비교일치 출력모드 1' },
          { bit: 6, name: 'COM0A0', desc: 'OC0A 비교일치 출력모드 0' },
          { bit: 5, name: 'COM0B1', desc: 'OC0B 비교일치 출력모드 1' },
          { bit: 4, name: 'COM0B0', desc: 'OC0B 비교일치 출력모드 0' },
          { bit: 3, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 2, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 1, name: 'WGM01', desc: '파형 생성 모드 1' },
          { bit: 0, name: 'WGM00', desc: '파형 생성 모드 0' }
        ]
      },
      atmega2560: {
        supported: true,
        regName: 'TCCR0A',
        ioAddr: '0x24',
        memAddr: '0x44',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: 'COM0A1', desc: 'OC0A 비교일치 출력모드 1' },
          { bit: 6, name: 'COM0A0', desc: 'OC0A 비교일치 출력모드 0' },
          { bit: 5, name: 'COM0B1', desc: 'OC0B 비교일치 출력모드 1' },
          { bit: 4, name: 'COM0B0', desc: 'OC0B 비교일치 출력모드 0' },
          { bit: 3, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 2, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 1, name: 'WGM01', desc: '파형 생성 모드 1' },
          { bit: 0, name: 'WGM00', desc: '파형 생성 모드 0' }
        ]
      },
      atmega640: {
        supported: true,
        regName: 'TCCR0A',
        ioAddr: '0x24',
        memAddr: '0x44',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: 'COM0A1', desc: 'OC0A 비교일치 출력모드 1' },
          { bit: 6, name: 'COM0A0', desc: 'OC0A 비교일치 출력모드 0' },
          { bit: 5, name: 'COM0B1', desc: 'OC0B 비교일치 출력모드 1' },
          { bit: 4, name: 'COM0B0', desc: 'OC0B 비교일치 출력모드 0' },
          { bit: 3, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 2, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 1, name: 'WGM01', desc: '파형 생성 모드 1' },
          { bit: 0, name: 'WGM00', desc: '파형 생성 모드 0' }
        ]
      },
      atmega128: {
        supported: true,
        regName: 'TCCR0',
        ioAddr: '0x33',
        memAddr: '0x53',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: 'FOC0', desc: '강제 비교일치 (TCCR0B에 있던 비트)' },
          { bit: 6, name: 'WGM00', desc: '파형 모드 0 (328P에서는 Bit 0임!)' },
          { bit: 5, name: 'COM01', desc: 'OC0 비교일치 출력모드 1' },
          { bit: 4, name: 'COM00', desc: 'OC0 비교일치 출력모드 0' },
          { bit: 3, name: 'WGM01', desc: '파형 모드 1 (328P에서는 Bit 1임!)' },
          { bit: 2, name: 'CS02', desc: '클럭 분주비 비트 2' },
          { bit: 1, name: 'CS01', desc: '클럭 분주비 비트 1' },
          { bit: 0, name: 'CS00', desc: '클럭 분주비 비트 0' }
        ],
        notes: 'ATmega128은 TCCR0A와 TCCR0B가 단일 TCCR0 레지스터로 통합되어 있어 비트 위치가 완전히 다릅니다!'
      }
    },
    migrationNotice: [
      {
        pair: 'atmega328p_atmega128',
        severity: 'critical',
        summary: '레지스터 분리 구조 불일치: TCCR0A/TCCR0B vs 단일 TCCR0',
        workaround: 'TCCR0A = (1 << WGM01) 코드는 ATmega128에서 컴파일 에러가 발생합니다. TCCR0 = (1 << WGM01) | (1 << CS01) 형태로 통합 설정해야 합니다.'
      }
    ]
  },

  // 2. Timer0 Control Register B
  {
    id: 'TCCR0B',
    category: 'timer',
    categoryLabel: '8비트 타이머 0',
    title: 'Timer/Counter0 Control Register B',
    description: '타이머0 클럭 소스 분주비(CS02:00) 및 상위 파형 모드(WGM02) 설정',
    mcus: {
      atmega328p: {
        supported: true,
        regName: 'TCCR0B',
        ioAddr: '0x25',
        memAddr: '0x45',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: 'FOC0A', desc: '강제 비교일치 A' },
          { bit: 6, name: 'FOC0B', desc: '강제 비교일치 B' },
          { bit: 5, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 4, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 3, name: 'WGM02', desc: '파형 생성 모드 최상위 비트' },
          { bit: 2, name: 'CS02', desc: '클럭 소스 선택 비트 2' },
          { bit: 1, name: 'CS01', desc: '클럭 소스 선택 비트 1' },
          { bit: 0, name: 'CS00', desc: '클럭 소스 선택 비트 0' }
        ]
      },
      atmega2560: {
        supported: true,
        regName: 'TCCR0B',
        ioAddr: '0x25',
        memAddr: '0x45',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: 'FOC0A', desc: '강제 비교일치 A' },
          { bit: 6, name: 'FOC0B', desc: '강제 비교일치 B' },
          { bit: 5, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 4, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 3, name: 'WGM02', desc: '파형 생성 모드 최상위 비트' },
          { bit: 2, name: 'CS02', desc: '클럭 소스 선택 비트 2' },
          { bit: 1, name: 'CS01', desc: '클럭 소스 선택 비트 1' },
          { bit: 0, name: 'CS00', desc: '클럭 소스 선택 비트 0' }
        ]
      },
      atmega640: {
        supported: true,
        regName: 'TCCR0B',
        ioAddr: '0x25',
        memAddr: '0x45',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: 'FOC0A', desc: '강제 비교일치 A' },
          { bit: 6, name: 'FOC0B', desc: '강제 비교일치 B' },
          { bit: 5, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 4, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 3, name: 'WGM02', desc: '파형 생성 모드 최상위 비트' },
          { bit: 2, name: 'CS02', desc: '클럭 소스 선택 비트 2' },
          { bit: 1, name: 'CS01', desc: '클럭 소스 선택 비트 1' },
          { bit: 0, name: 'CS00', desc: '클럭 소스 선택 비트 0' }
        ]
      },
      atmega128: {
        supported: false,
        regName: '미존재 (TCCR0에 통합)',
        ioAddr: '—',
        memAddr: '—',
        isExtendedIo: false,
        bits: [],
        notes: 'ATmega128에는 TCCR0B가 없으며 TCCR0 단일 레지스터에 클럭 분주비 비트가 포함되어 있습니다.'
      }
    }
  },

  // 3. Timer Interrupt Mask Register
  {
    id: 'TIMSK0',
    category: 'timer',
    categoryLabel: '타이머 인터럽트',
    title: 'Timer/Counter Interrupt Mask Register (TIMSK / TIMSK0)',
    description: '타이머0 오버플로우(TOIE0) 및 비교일치(OCIE0A/B) 인터럽트 허용 마스크',
    mcus: {
      atmega328p: {
        supported: true,
        regName: 'TIMSK0',
        ioAddr: '—',
        memAddr: '0x6E',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 6, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 5, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 4, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 3, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 2, name: 'OCIE0B', desc: '타이머0 비교일치 B 인터럽트 허용' },
          { bit: 1, name: 'OCIE0A', desc: '타이머0 비교일치 A 인터럽트 허용' },
          { bit: 0, name: 'TOIE0', desc: '타이머0 오버플로우 인터럽트 허용' }
        ]
      },
      atmega2560: {
        supported: true,
        regName: 'TIMSK0',
        ioAddr: '—',
        memAddr: '0x6E',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 6, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 5, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 4, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 3, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 2, name: 'OCIE0B', desc: '타이머0 비교일치 B 인터럽트 허용' },
          { bit: 1, name: 'OCIE0A', desc: '타이머0 비교일치 A 인터럽트 허용' },
          { bit: 0, name: 'TOIE0', desc: '타이머0 오버플로우 인터럽트 허용' }
        ]
      },
      atmega640: {
        supported: true,
        regName: 'TIMSK0',
        ioAddr: '—',
        memAddr: '0x6E',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 6, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 5, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 4, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 3, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 2, name: 'OCIE0B', desc: '타이머0 비교일치 B 인터럽트 허용' },
          { bit: 1, name: 'OCIE0A', desc: '타이머0 비교일치 A 인터럽트 허용' },
          { bit: 0, name: 'TOIE0', desc: '타이머0 오버플로우 인터럽트 허용' }
        ]
      },
      atmega128: {
        supported: true,
        regName: 'TIMSK',
        ioAddr: '0x37',
        memAddr: '0x57',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: 'OCIE2', desc: '타이머2 비교일치 인터럽트' },
          { bit: 6, name: 'TOIE2', desc: '타이머2 오버플로우 인터럽트' },
          { bit: 5, name: 'TICIE1', desc: '타이머1 캡처 인터럽트' },
          { bit: 4, name: 'OCIE1A', desc: '타이머1 비교일치 A' },
          { bit: 3, name: 'OCIE1B', desc: '타이머1 비교일치 B' },
          { bit: 2, name: 'TOIE1', desc: '타이머1 오버플로우' },
          { bit: 1, name: 'OCIE0', desc: '타이머0 비교일치 인터럽트' },
          { bit: 0, name: 'TOIE0', desc: '타이머0 오버플로우 인터럽트' }
        ],
        notes: 'ATmega128은 단일 TIMSK 레지스터에 타이머0, 1, 2 인터럽트가 모두 모여 있으며, 표준 I/O 공간(0x37)에 있어 IN/OUT 가능합니다.'
      }
    },
    migrationNotice: [
      {
        pair: 'atmega328p_atmega128',
        severity: 'critical',
        summary: 'TIMSK0 vs TIMSK: 레지스터 명칭 및 주소 공간(확장 vs 표준) 상이',
        workaround: 'ATmega328P에서는 TIMSK0 (0x6E 확장 I/O)이고, ATmega128에서는 TIMSK (0x57 표준 I/O)입니다.'
      }
    ]
  },

  // 4. USART0 Control Register A
  {
    id: 'UCSR0A',
    category: 'usart',
    categoryLabel: 'USART0 시리얼',
    title: 'USART0 Control and Status Register A',
    description: '수신/송신 완료 플래그(RXC/TXC), 데이터 레지스터 빈 상태(UDRE), 배속 전송(U2X0)',
    mcus: {
      atmega328p: {
        supported: true,
        regName: 'UCSR0A',
        ioAddr: '—',
        memAddr: '0xC0',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: 'RXC0', desc: 'USART 수신 완료 플래그' },
          { bit: 6, name: 'TXC0', desc: 'USART 송신 완료 플래그' },
          { bit: 5, name: 'UDRE0', desc: '송신 데이터 버퍼 빈 상태 플래그' },
          { bit: 4, name: 'FE0', desc: '프레임 에러' },
          { bit: 3, name: 'DOR0', desc: '데이터 오버런 에러' },
          { bit: 2, name: 'UPE0', desc: '패리티 에러' },
          { bit: 1, name: 'U2X0', desc: '배속 전송 모드 (Double Speed)' },
          { bit: 0, name: 'MPCM0', desc: '멀티 프로세서 통신 모드' }
        ]
      },
      atmega2560: {
        supported: true,
        regName: 'UCSR0A',
        ioAddr: '—',
        memAddr: '0xC0',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: 'RXC0', desc: 'USART0 수신 완료 플래그' },
          { bit: 6, name: 'TXC0', desc: 'USART0 송신 완료 플래그' },
          { bit: 5, name: 'UDRE0', desc: '송신 데이터 버퍼 빈 상태 플래그' },
          { bit: 4, name: 'FE0', desc: '프레임 에러' },
          { bit: 3, name: 'DOR0', desc: '데이터 오버런 에러' },
          { bit: 2, name: 'UPE0', desc: '패리티 에러' },
          { bit: 1, name: 'U2X0', desc: '배속 전송 모드' },
          { bit: 0, name: 'MPCM0', desc: '멀티 프로세서 통신 모드' }
        ]
      },
      atmega640: {
        supported: true,
        regName: 'UCSR0A',
        ioAddr: '—',
        memAddr: '0xC0',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: 'RXC0', desc: 'USART0 수신 완료 플래그' },
          { bit: 6, name: 'TXC0', desc: 'USART0 송신 완료 플래그' },
          { bit: 5, name: 'UDRE0', desc: '송신 데이터 버퍼 빈 상태 플래그' },
          { bit: 4, name: 'FE0', desc: '프레임 에러' },
          { bit: 3, name: 'DOR0', desc: '데이터 오버런 에러' },
          { bit: 2, name: 'UPE0', desc: '패리티 에러' },
          { bit: 1, name: 'U2X0', desc: '배속 전송 모드' },
          { bit: 0, name: 'MPCM0', desc: '멀티 프로세서 통신 모드' }
        ]
      },
      atmega128: {
        supported: true,
        regName: 'UCSR0A',
        ioAddr: '0x0B',
        memAddr: '0x2B',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: 'RXC0', desc: '수신 완료' },
          { bit: 6, name: 'TXC0', desc: '송신 완료' },
          { bit: 5, name: 'UDRE0', desc: '버퍼 빈 상태' },
          { bit: 4, name: 'FE0', desc: '프레임 에러' },
          { bit: 3, name: 'DOR0', desc: '데이터 오버런' },
          { bit: 2, name: 'UPE0', desc: '패리티 에러' },
          { bit: 1, name: 'U2X0', desc: '배속 전송 모드' },
          { bit: 0, name: 'MPCM0', desc: '멀티 프로세서 통신 모드' }
        ],
        notes: 'ATmega128의 UCSR0A는 표준 I/O 영역(0x0B, 메모리 0x2B)에 위치하여 SBI/CBI/IN/OUT 명령어로 1클럭 직접 조작이 가능합니다!'
      }
    },
    migrationNotice: [
      {
        pair: 'atmega328p_atmega128',
        severity: 'info',
        summary: '주소 공간 차이: 328P(0xC0 확장) vs 128(0x2B 표준)',
        workaround: '비트 명칭과 의미는 100% 동일하나, 어셈블리 레벨에서 128은 IN/OUT이 가능하고 328P는 LDS/STS를 사용해야 합니다.'
      }
    ]
  },

  // 5. USART0 Control Register C
  {
    id: 'UCSR0C',
    category: 'usart',
    categoryLabel: 'USART0 시리얼',
    title: 'USART0 Control and Status Register C',
    description: '동기/비동기 모드, 패리티(UPM), 스톱 비트(USBS), 데이터 문자 크기(UCSZ)',
    mcus: {
      atmega328p: {
        supported: true,
        regName: 'UCSR0C',
        ioAddr: '—',
        memAddr: '0xC2',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: 'UMSEL01', desc: 'USART 모드 선택 1' },
          { bit: 6, name: 'UMSEL00', desc: 'USART 모드 선택 0' },
          { bit: 5, name: 'UPM01', desc: '패리티 모드 1' },
          { bit: 4, name: 'UPM00', desc: '패리티 모드 0' },
          { bit: 3, name: 'USBS0', desc: '스톱 비트 선택 (0=1bit, 1=2bit)' },
          { bit: 2, name: 'UCSZ01', desc: '문자 크기 1' },
          { bit: 1, name: 'UCSZ00', desc: '문자 크기 0' },
          { bit: 0, name: 'UCPOL0', desc: '클럭 극성' }
        ]
      },
      atmega2560: {
        supported: true,
        regName: 'UCSR0C',
        ioAddr: '—',
        memAddr: '0xC2',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: 'UMSEL01', desc: 'USART 모드 선택 1' },
          { bit: 6, name: 'UMSEL00', desc: 'USART 모드 선택 0' },
          { bit: 5, name: 'UPM01', desc: '패리티 모드 1' },
          { bit: 4, name: 'UPM00', desc: '패리티 모드 0' },
          { bit: 3, name: 'USBS0', desc: '스톱 비트 선택' },
          { bit: 2, name: 'UCSZ01', desc: '문자 크기 1' },
          { bit: 1, name: 'UCSZ00', desc: '문자 크기 0' },
          { bit: 0, name: 'UCPOL0', desc: '클럭 극성' }
        ]
      },
      atmega640: {
        supported: true,
        regName: 'UCSR0C',
        ioAddr: '—',
        memAddr: '0xC2',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: 'UMSEL01', desc: 'USART 모드 선택 1' },
          { bit: 6, name: 'UMSEL00', desc: 'USART 모드 선택 0' },
          { bit: 5, name: 'UPM01', desc: '패리티 모드 1' },
          { bit: 4, name: 'UPM00', desc: '패리티 모드 0' },
          { bit: 3, name: 'USBS0', desc: '스톱 비트 선택' },
          { bit: 2, name: 'UCSZ01', desc: '문자 크기 1' },
          { bit: 1, name: 'UCSZ00', desc: '문자 크기 0' },
          { bit: 0, name: 'UCPOL0', desc: '클럭 극성' }
        ]
      },
      atmega128: {
        supported: true,
        regName: 'UCSR0C',
        ioAddr: '—',
        memAddr: '0x95',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 6, name: 'UMSEL0', desc: '단일 비트 동기/비동기 선택 (328P는 2비트임!)' },
          { bit: 5, name: 'UPM01', desc: '패리티 모드 1' },
          { bit: 4, name: 'UPM00', desc: '패리티 모드 0' },
          { bit: 3, name: 'USBS0', desc: '스톱 비트' },
          { bit: 2, name: 'UCSZ01', desc: '문자 크기 1' },
          { bit: 1, name: 'UCSZ00', desc: '문자 크기 0' },
          { bit: 0, name: 'UCPOL0', desc: '클럭 극성' }
        ],
        notes: 'ATmega128의 UCSR0C는 UMSEL 비트가 1개(비트 6)뿐이며 Master SPI 모드를 지원하지 않습니다.'
      }
    },
    migrationNotice: [
      {
        pair: 'atmega328p_atmega128',
        severity: 'warning',
        summary: 'UMSEL01/00 2비트(MSPIM 지원) vs UMSEL0 1비트',
        workaround: 'ATmega128에서는 Master SPI 모드를 USART로 에뮬레이션할 수 없으며 비동기(0)/동기(1) 모드만 선택 가능합니다.'
      }
    ]
  },

  // 6. Watchdog Timer Control Register
  {
    id: 'WDTCSR',
    category: 'system',
    categoryLabel: '시스템 & 워치독',
    title: 'Watchdog Timer Control Register (WDTCSR / WDTCR)',
    description: '워치독 리셋(WDE), 인터럽트 모드(WDIE), 변경 허용(WDCE), 프리스케일러(WDP3:0)',
    mcus: {
      atmega328p: {
        supported: true,
        regName: 'WDTCSR',
        ioAddr: '—',
        memAddr: '0x60',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: 'WDIF', desc: '워치독 인터럽트 플래그' },
          { bit: 6, name: 'WDIE', desc: '워치독 인터럽트 허용' },
          { bit: 5, name: 'WDP3', desc: '타임아웃 프리스케일러 3 (최대 8초)' },
          { bit: 4, name: 'WDCE', desc: '워치독 변경 안전 비트 (Change Enable)' },
          { bit: 3, name: 'WDE', desc: '워치독 시스템 리셋 허용' },
          { bit: 2, name: 'WDP2', desc: '타임아웃 프리스케일러 2' },
          { bit: 1, name: 'WDP1', desc: '타임아웃 프리스케일러 1' },
          { bit: 0, name: 'WDP0', desc: '타임아웃 프리스케일러 0' }
        ]
      },
      atmega2560: {
        supported: true,
        regName: 'WDTCSR',
        ioAddr: '—',
        memAddr: '0x60',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: 'WDIF', desc: '워치독 인터럽트 플래그' },
          { bit: 6, name: 'WDIE', desc: '워치독 인터럽트 허용' },
          { bit: 5, name: 'WDP3', desc: '타임아웃 프리스케일러 3' },
          { bit: 4, name: 'WDCE', desc: '워치독 변경 허용 비트' },
          { bit: 3, name: 'WDE', desc: '워치독 리셋 허용' },
          { bit: 2, name: 'WDP2', desc: '타임아웃 프리스케일러 2' },
          { bit: 1, name: 'WDP1', desc: '타임아웃 프리스케일러 1' },
          { bit: 0, name: 'WDP0', desc: '타임아웃 프리스케일러 0' }
        ]
      },
      atmega640: {
        supported: true,
        regName: 'WDTCSR',
        ioAddr: '—',
        memAddr: '0x60',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: 'WDIF', desc: '워치독 인터럽트 플래그' },
          { bit: 6, name: 'WDIE', desc: '워치독 인터럽트 허용' },
          { bit: 5, name: 'WDP3', desc: '타임아웃 프리스케일러 3' },
          { bit: 4, name: 'WDCE', desc: '워치독 변경 허용 비트' },
          { bit: 3, name: 'WDE', desc: '워치독 리셋 허용' },
          { bit: 2, name: 'WDP2', desc: '타임아웃 프리스케일러 2' },
          { bit: 1, name: 'WDP1', desc: '타임아웃 프리스케일러 1' },
          { bit: 0, name: 'WDP0', desc: '타임아웃 프리스케일러 0' }
        ]
      },
      atmega128: {
        supported: true,
        regName: 'WDTCR',
        ioAddr: '0x21',
        memAddr: '0x41',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 6, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 5, name: '—', desc: '예약 비트 (WDP3 미지원, 최대 2.1초)', isReserved: true },
          { bit: 4, name: 'WDCE', desc: '워치독 변경 허용 (구버전명: WDTOE)' },
          { bit: 3, name: 'WDE', desc: '워치독 리셋 허용' },
          { bit: 2, name: 'WDP2', desc: '타임아웃 프리스케일러 2' },
          { bit: 1, name: 'WDP1', desc: '타임아웃 프리스케일러 1' },
          { bit: 0, name: 'WDP0', desc: '타임아웃 프리스케일러 0' }
        ],
        notes: 'ATmega128은 레지스터명이 WDTCR이며, 독립 인터럽트 모드(WDIE) 및 8초 타임아웃(WDP3)을 지원하지 않습니다!'
      }
    },
    migrationNotice: [
      {
        pair: 'atmega328p_atmega128',
        severity: 'critical',
        summary: 'WDTCSR vs WDTCR 및 인터럽트 모드/8초 타임아웃 부재',
        workaround: 'ATmega128에서는 WDTCSR 대신 WDTCR을 사용해야 하며, WDP3(8초) 대신 최대 2.1초(WDP2:0=111)만 지원합니다.'
      }
    ]
  },

  // 7. ADC Control and Status Register A
  {
    id: 'ADCSRA',
    category: 'analog',
    categoryLabel: 'ADC 아날로그',
    title: 'ADC Control and Status Register A',
    description: 'ADC 활성화(ADEN), 변환 시작(ADSC), 자동 트리거(ADATE), 인터럽트(ADIE), 분주비(ADPS2:0)',
    mcus: {
      atmega328p: {
        supported: true,
        regName: 'ADCSRA',
        ioAddr: '—',
        memAddr: '0x7A',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: 'ADEN', desc: 'ADC 활성화' },
          { bit: 6, name: 'ADSC', desc: '변환 시작' },
          { bit: 5, name: 'ADATE', desc: '자동 트리거 허용' },
          { bit: 4, name: 'ADIF', desc: '인터럽트 플래그' },
          { bit: 3, name: 'ADIE', desc: '인터럽트 허용' },
          { bit: 2, name: 'ADPS2', desc: '프리스케일러 2' },
          { bit: 1, name: 'ADPS1', desc: '프리스케일러 1' },
          { bit: 0, name: 'ADPS0', desc: '프리스케일러 0' }
        ]
      },
      atmega2560: {
        supported: true,
        regName: 'ADCSRA',
        ioAddr: '—',
        memAddr: '0x7A',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: 'ADEN', desc: 'ADC 활성화' },
          { bit: 6, name: 'ADSC', desc: '변환 시작' },
          { bit: 5, name: 'ADATE', desc: '자동 트리거 허용' },
          { bit: 4, name: 'ADIF', desc: '인터럽트 플래그' },
          { bit: 3, name: 'ADIE', desc: '인터럽트 허용' },
          { bit: 2, name: 'ADPS2', desc: '프리스케일러 2' },
          { bit: 1, name: 'ADPS1', desc: '프리스케일러 1' },
          { bit: 0, name: 'ADPS0', desc: '프리스케일러 0' }
        ]
      },
      atmega640: {
        supported: true,
        regName: 'ADCSRA',
        ioAddr: '—',
        memAddr: '0x7A',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: 'ADEN', desc: 'ADC 활성화' },
          { bit: 6, name: 'ADSC', desc: '변환 시작' },
          { bit: 5, name: 'ADATE', desc: '자동 트리거 허용' },
          { bit: 4, name: 'ADIF', desc: '인터럽트 플래그' },
          { bit: 3, name: 'ADIE', desc: '인터럽트 허용' },
          { bit: 2, name: 'ADPS2', desc: '프리스케일러 2' },
          { bit: 1, name: 'ADPS1', desc: '프리스케일러 1' },
          { bit: 0, name: 'ADPS0', desc: '프리스케일러 0' }
        ]
      },
      atmega128: {
        supported: true,
        regName: 'ADCSRA',
        ioAddr: '0x06',
        memAddr: '0x26',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: 'ADEN', desc: 'ADC 활성화' },
          { bit: 6, name: 'ADSC', desc: '변환 시작' },
          { bit: 5, name: 'ADFR', desc: '프리 러닝 모드 (Free Running, 328P의 ADATE와 유사)' },
          { bit: 4, name: 'ADIF', desc: '인터럽트 플래그' },
          { bit: 3, name: 'ADIE', desc: '인터럽트 허용' },
          { bit: 2, name: 'ADPS2', desc: '프리스케일러 2' },
          { bit: 1, name: 'ADPS1', desc: '프리스케일러 1' },
          { bit: 0, name: 'ADPS0', desc: '프리스케일러 0' }
        ],
        notes: 'Bit 5 명칭이 ADFR(Free Running)이며, ATmega128은 표준 I/O 0x06 영역에 위치합니다.'
      }
    }
  },

  // 8. External Interrupt Mask Register
  {
    id: 'EIMSK',
    category: 'interrupt',
    categoryLabel: '외부 인터럽트',
    title: 'External Interrupt Mask Register (EIMSK / GICR)',
    description: 'INT0~INT7 외부 하드웨어 핀 인터럽트 개별 활성화 마스크',
    mcus: {
      atmega328p: {
        supported: true,
        regName: 'EIMSK',
        ioAddr: '0x1D',
        memAddr: '0x3D',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 6, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 5, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 4, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 3, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 2, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 1, name: 'INT1', desc: '외부 인터럽트 1 허용 (PD3)' },
          { bit: 0, name: 'INT0', desc: '외부 인터럽트 0 허용 (PD2)' }
        ]
      },
      atmega2560: {
        supported: true,
        regName: 'EIMSK',
        ioAddr: '0x1D',
        memAddr: '0x3D',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: 'INT7', desc: '외부 인터럽트 7 허용 (PE7)' },
          { bit: 6, name: 'INT6', desc: '외부 인터럽트 6 허용 (PE6)' },
          { bit: 5, name: 'INT5', desc: '외부 인터럽트 5 허용 (PE5)' },
          { bit: 4, name: 'INT4', desc: '외부 인터럽트 4 허용 (PE4)' },
          { bit: 3, name: 'INT3', desc: '외부 인터럽트 3 허용 (PD3)' },
          { bit: 2, name: 'INT2', desc: '외부 인터럽트 2 허용 (PD2)' },
          { bit: 1, name: 'INT1', desc: '외부 인터럽트 1 허용 (PD1)' },
          { bit: 0, name: 'INT0', desc: '외부 인터럽트 0 허용 (PD0)' }
        ]
      },
      atmega640: {
        supported: true,
        regName: 'EIMSK',
        ioAddr: '0x1D',
        memAddr: '0x3D',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: 'INT7', desc: '외부 인터럽트 7 허용' },
          { bit: 6, name: 'INT6', desc: '외부 인터럽트 6 허용' },
          { bit: 5, name: 'INT5', desc: '외부 인터럽트 5 허용' },
          { bit: 4, name: 'INT4', desc: '외부 인터럽트 4 허용' },
          { bit: 3, name: 'INT3', desc: '외부 인터럽트 3 허용' },
          { bit: 2, name: 'INT2', desc: '외부 인터럽트 2 허용' },
          { bit: 1, name: 'INT1', desc: '외부 인터럽트 1 허용' },
          { bit: 0, name: 'INT0', desc: '외부 인터럽트 0 허용' }
        ]
      },
      atmega128: {
        supported: true,
        regName: 'EIMSK',
        ioAddr: '0x39',
        memAddr: '0x59',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: 'INT7', desc: '외부 인터럽트 7' },
          { bit: 6, name: 'INT6', desc: '외부 인터럽트 6' },
          { bit: 5, name: 'INT5', desc: '외부 인터럽트 5' },
          { bit: 4, name: 'INT4', desc: '외부 인터럽트 4' },
          { bit: 3, name: 'INT3', desc: '외부 인터럽트 3' },
          { bit: 2, name: 'INT2', desc: '외부 인터럽트 2' },
          { bit: 1, name: 'INT1', desc: '외부 인터럽트 1' },
          { bit: 0, name: 'INT0', desc: '외부 인터럽트 0' }
        ]
      }
    }
  },

  // 9. SPI Control Register
  {
    id: 'SPCR',
    category: 'comm',
    categoryLabel: 'SPI 버스',
    title: 'SPI Control Register',
    description: 'SPI 활성화(SPE), 마스터/슬레이브(MSTR), 클럭 극성/위상(CPOL/CPHA), 분주비(SPR1:0)',
    mcus: {
      atmega328p: {
        supported: true,
        regName: 'SPCR',
        ioAddr: '0x2C',
        memAddr: '0x4C',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: 'SPIE', desc: 'SPI 인터럽트 허용' },
          { bit: 6, name: 'SPE', desc: 'SPI 모듈 활성화' },
          { bit: 5, name: 'DORD', desc: '데이터 순서 (1=LSB, 0=MSB)' },
          { bit: 4, name: 'MSTR', desc: '마스터/슬레이브 (1=Master)' },
          { bit: 3, name: 'CPOL', desc: '클럭 극성' },
          { bit: 2, name: 'CPHA', desc: '클럭 위상' },
          { bit: 1, name: 'SPR1', desc: '클럭 분주비 1' },
          { bit: 0, name: 'SPR0', desc: '클럭 분주비 0' }
        ]
      },
      atmega2560: {
        supported: true,
        regName: 'SPCR',
        ioAddr: '0x2C',
        memAddr: '0x4C',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: 'SPIE', desc: 'SPI 인터럽트 허용' },
          { bit: 6, name: 'SPE', desc: 'SPI 모듈 활성화' },
          { bit: 5, name: 'DORD', desc: '데이터 순서' },
          { bit: 4, name: 'MSTR', desc: '마스터/슬레이브' },
          { bit: 3, name: 'CPOL', desc: '클럭 극성' },
          { bit: 2, name: 'CPHA', desc: '클럭 위상' },
          { bit: 1, name: 'SPR1', desc: '클럭 분주비 1' },
          { bit: 0, name: 'SPR0', desc: '클럭 분주비 0' }
        ]
      },
      atmega640: {
        supported: true,
        regName: 'SPCR',
        ioAddr: '0x2C',
        memAddr: '0x4C',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: 'SPIE', desc: 'SPI 인터럽트 허용' },
          { bit: 6, name: 'SPE', desc: 'SPI 모듈 활성화' },
          { bit: 5, name: 'DORD', desc: '데이터 순서' },
          { bit: 4, name: 'MSTR', desc: '마스터/슬레이브' },
          { bit: 3, name: 'CPOL', desc: '클럭 극성' },
          { bit: 2, name: 'CPHA', desc: '클럭 위상' },
          { bit: 1, name: 'SPR1', desc: '클럭 분주비 1' },
          { bit: 0, name: 'SPR0', desc: '클럭 분주비 0' }
        ]
      },
      atmega128: {
        supported: true,
        regName: 'SPCR',
        ioAddr: '0x0D',
        memAddr: '0x2D',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: 'SPIE', desc: 'SPI 인터럽트 허용' },
          { bit: 6, name: 'SPE', desc: 'SPI 활성화' },
          { bit: 5, name: 'DORD', desc: '데이터 순서' },
          { bit: 4, name: 'MSTR', desc: '마스터/슬레이브' },
          { bit: 3, name: 'CPOL', desc: '클럭 극성' },
          { bit: 2, name: 'CPHA', desc: '클럭 위상' },
          { bit: 1, name: 'SPR1', desc: '클럭 분주비 1' },
          { bit: 0, name: 'SPR0', desc: '클럭 분주비 0' }
        ]
      }
    }
  },

  // 10. TWI (I2C) Control Register
  {
    id: 'TWCR',
    category: 'comm',
    categoryLabel: 'TWI (I2C)',
    title: 'TWI Control Register',
    description: '인터럽트 플래그(TWINT), ACK 생성(TWEA), START(TWSTA), STOP(TWSTO), 활성화(TWEN)',
    mcus: {
      atmega328p: {
        supported: true,
        regName: 'TWCR',
        ioAddr: '—',
        memAddr: '0xBC',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: 'TWINT', desc: 'TWI 인터럽트 플래그 (1 쓰면 클리어)' },
          { bit: 6, name: 'TWEA', desc: 'ACK 응답 생성 허용' },
          { bit: 5, name: 'TWSTA', desc: 'START 조건 전송' },
          { bit: 4, name: 'TWSTO', desc: 'STOP 조건 전송' },
          { bit: 3, name: 'TWWC', desc: '쓰기 충돌 플래그' },
          { bit: 2, name: 'TWEN', desc: 'TWI 인터페이스 활성화' },
          { bit: 1, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 0, name: 'TWIE', desc: '인터럽트 허용' }
        ]
      },
      atmega2560: {
        supported: true,
        regName: 'TWCR',
        ioAddr: '—',
        memAddr: '0xBC',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: 'TWINT', desc: 'TWI 인터럽트 플래그' },
          { bit: 6, name: 'TWEA', desc: 'ACK 생성 허용' },
          { bit: 5, name: 'TWSTA', desc: 'START 전송' },
          { bit: 4, name: 'TWSTO', desc: 'STOP 전송' },
          { bit: 3, name: 'TWWC', desc: '쓰기 충돌 플래그' },
          { bit: 2, name: 'TWEN', desc: 'TWI 활성화' },
          { bit: 1, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 0, name: 'TWIE', desc: '인터럽트 허용' }
        ]
      },
      atmega640: {
        supported: true,
        regName: 'TWCR',
        ioAddr: '—',
        memAddr: '0xBC',
        isExtendedIo: true,
        bits: [
          { bit: 7, name: 'TWINT', desc: 'TWI 인터럽트 플래그' },
          { bit: 6, name: 'TWEA', desc: 'ACK 생성 허용' },
          { bit: 5, name: 'TWSTA', desc: 'START 전송' },
          { bit: 4, name: 'TWSTO', desc: 'STOP 전송' },
          { bit: 3, name: 'TWWC', desc: '쓰기 충돌 플래그' },
          { bit: 2, name: 'TWEN', desc: 'TWI 활성화' },
          { bit: 1, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 0, name: 'TWIE', desc: '인터럽트 허용' }
        ]
      },
      atmega128: {
        supported: true,
        regName: 'TWCR',
        ioAddr: '0x36',
        memAddr: '0x56',
        isExtendedIo: false,
        bits: [
          { bit: 7, name: 'TWINT', desc: '인터럽트 플래그' },
          { bit: 6, name: 'TWEA', desc: 'ACK 생성 허용' },
          { bit: 5, name: 'TWSTA', desc: 'START 전송' },
          { bit: 4, name: 'TWSTO', desc: 'STOP 전송' },
          { bit: 3, name: 'TWWC', desc: '쓰기 충돌' },
          { bit: 2, name: 'TWEN', desc: 'TWI 활성화' },
          { bit: 1, name: '—', desc: '예약 비트', isReserved: true },
          { bit: 0, name: 'TWIE', desc: '인터럽트 허용' }
        ],
        notes: 'ATmega128의 TWCR은 표준 I/O 0x36 영역에 있어 IN/OUT 명령어를 지원합니다.'
      }
    }
  }
];

export const RegisterCompatibilityComparator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const [mcuA, setMcuA] = useState<SupportedMCU>(selectedMCU);
  const [mcuB, setMcuB] = useState<SupportedMCU>(
    selectedMCU === 'atmega328p' ? 'atmega128' : 'atmega328p'
  );

  const [activeCategory, setActiveCategory] = useState<DiffCategory>('all');
  const [showDiffsOnly, setShowDiffsOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedRegId, setExpandedRegId] = useState<string | null>('TCCR0A');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Sync when selectedMCU from parent changes
  React.useEffect(() => {
    if (mcuA !== selectedMCU) {
      setMcuA(selectedMCU);
      if (mcuB === selectedMCU) {
        setMcuB(selectedMCU === 'atmega328p' ? 'atmega128' : 'atmega328p');
      }
    }
  }, [selectedMCU]);

  const profileA = MCU_PROFILES[mcuA];
  const profileB = MCU_PROFILES[mcuB];

  // Swap MCUs
  const handleSwapMcus = () => {
    const temp = mcuA;
    setMcuA(mcuB);
    setMcuB(temp);
    if (onSelectMCU) onSelectMCU(mcuB);
  };

  // Helper to compare two bits at a given bit index
  const compareBitFields = (bitIdx: number, dataA: McuRegisterData, dataB: McuRegisterData) => {
    if (!dataA.supported && !dataB.supported) return 'both_unsupported';
    if (!dataA.supported) return 'only_b';
    if (!dataB.supported) return 'only_a';

    const bitA = dataA.bits.find((b) => b.bit === bitIdx);
    const bitB = dataB.bits.find((b) => b.bit === bitIdx);

    const isReservedA = !bitA || bitA.isReserved || bitA.name === '—';
    const isReservedB = !bitB || bitB.isReserved || bitB.name === '—';

    if (isReservedA && isReservedB) return 'identical_reserved';
    if (isReservedA && !isReservedB) return 'only_b';
    if (!isReservedA && isReservedB) return 'only_a';

    if (bitA && bitB) {
      if (bitA.name === bitB.name) {
        return 'identical';
      }
      return 'mismatch';
    }
    return 'mismatch';
  };

  // Comparison metrics for the entire register set between MCU A and B
  const comparisonStats = useMemo(() => {
    let totalRegs = MASTER_REGISTER_COMPATIBILITY_DB.length;
    let identicalRegs = 0;
    let diffRegs = 0;
    let addressMismatches = 0;
    let bitMismatches = 0;

    MASTER_REGISTER_COMPATIBILITY_DB.forEach((item) => {
      const dataA = item.mcus[mcuA];
      const dataB = item.mcus[mcuB];

      if (!dataA.supported || !dataB.supported) {
        diffRegs++;
        return;
      }

      const isAddrDiff = dataA.memAddr !== dataB.memAddr || dataA.isExtendedIo !== dataB.isExtendedIo;
      if (isAddrDiff) addressMismatches++;

      let hasBitDiff = false;
      for (let i = 0; i < 8; i++) {
        const result = compareBitFields(i, dataA, dataB);
        if (result === 'mismatch' || result === 'only_a' || result === 'only_b') {
          hasBitDiff = true;
          bitMismatches++;
        }
      }

      if (dataA.regName === dataB.regName && !isAddrDiff && !hasBitDiff) {
        identicalRegs++;
      } else {
        diffRegs++;
      }
    });

    const compatibilityScore = Math.round(
      ((totalRegs - diffRegs + identicalRegs * 0.5) / totalRegs) * 100
    );

    return {
      totalRegs,
      identicalRegs,
      diffRegs,
      addressMismatches,
      bitMismatches,
      compatibilityScore: Math.min(100, Math.max(0, compatibilityScore))
    };
  }, [mcuA, mcuB]);

  // Filtered registers list
  const filteredRegisters = useMemo(() => {
    return MASTER_REGISTER_COMPATIBILITY_DB.filter((item) => {
      // Category filter
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }

      const dataA = item.mcus[mcuA];
      const dataB = item.mcus[mcuB];

      // Diffs only filter
      if (showDiffsOnly) {
        const isUnsupported = !dataA.supported || !dataB.supported;
        const isNameDiff = dataA.regName !== dataB.regName;
        const isAddrDiff = dataA.memAddr !== dataB.memAddr || dataA.isExtendedIo !== dataB.isExtendedIo;

        let hasBitDiff = false;
        for (let i = 0; i < 8; i++) {
          const res = compareBitFields(i, dataA, dataB);
          if (res === 'mismatch' || res === 'only_a' || res === 'only_b') {
            hasBitDiff = true;
            break;
          }
        }

        if (!isUnsupported && !isNameDiff && !isAddrDiff && !hasBitDiff) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchRegA = dataA.regName.toLowerCase().includes(q);
        const matchRegB = dataB.regName.toLowerCase().includes(q);
        const matchBitsA = dataA.bits.some((b) => b.name.toLowerCase().includes(q));
        const matchBitsB = dataB.bits.some((b) => b.name.toLowerCase().includes(q));

        if (!matchTitle && !matchDesc && !matchRegA && !matchRegB && !matchBitsA && !matchBitsB) {
          return false;
        }
      }

      return true;
    });
  }, [activeCategory, showDiffsOnly, searchQuery, mcuA, mcuB]);

  // Generate Cross-MCU Compatibility C Header Macro
  const generatedCompatibilityHeader = useMemo(() => {
    const lines: string[] = [];
    lines.push('/**');
    lines.push(` * @file      mcu_compat_${mcuA}_to_${mcuB}.h`);
    lines.push(` * @brief     Cross-MCU Register Portability & Compatibility Wrapper`);
    lines.push(` * @pair      ${profileA.name} <===> ${profileB.name}`);
    lines.push(` * @generated ATmega Studio Register Compatibility Comparator`);
    lines.push(' */');
    lines.push('');
    lines.push('#ifndef MCU_REGISTER_COMPAT_H_');
    lines.push('#define MCU_REGISTER_COMPAT_H_');
    lines.push('');
    lines.push('#include <avr/io.h>');
    lines.push('');
    lines.push('/* Auto-reconciled Peripheral Register Aliases */');

    filteredRegisters.forEach((reg) => {
      const dataA = reg.mcus[mcuA];
      const dataB = reg.mcus[mcuB];

      if (dataA.supported && dataB.supported && dataA.regName !== dataB.regName) {
        lines.push(`// Reconcile ${reg.id}: ${profileA.name} uses ${dataA.regName}, ${profileB.name} uses ${dataB.regName}`);
        lines.push(`#if defined(__AVR_${profileA.name.toUpperCase()}__)`);
        lines.push(`  #define COMPAT_${reg.id} ${dataA.regName}`);
        lines.push(`#elif defined(__AVR_${profileB.name.toUpperCase()}__)`);
        lines.push(`  #define COMPAT_${reg.id} ${dataB.regName}`);
        lines.push('#endif');
        lines.push('');
      }
    });

    lines.push('#endif /* MCU_REGISTER_COMPAT_H_ */');
    return lines.join('\n');
  }, [filteredRegisters, mcuA, mcuB, profileA, profileB]);

  const handleCopyMacro = () => {
    navigator.clipboard.writeText(generatedCompatibilityHeader);
    setCopiedCode(true);
    confetti({ particleCount: 35, spread: 55, origin: { y: 0.7 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* 1. Top Banner & Dual MCU Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <GitCompare className="w-5 h-5" />
            </span>
            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              레지스터 호환성 비교기
              <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
                Cross-MCU Register Map Comparator
              </span>
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-4xl leading-relaxed">
            두 개의 서로 다른 AVR MCU 레지스터 주소 맵을 나란히 배치하고,
            <strong className="text-cyan-300"> 주소 차이(I/O vs 메모리), 비트 필드 명칭 및 기능적 차이점</strong>을
            자동으로 대조하여 색상별로 하이라이트합니다.
          </p>
        </div>

        {/* Dual MCU Picker Card */}
        <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800 shadow-inner shrink-0">
          {/* MCU Model A */}
          <div className="text-left">
            <span className="text-[10px] font-bold text-cyan-400 block px-1">MCU 모델 A</span>
            <select
              value={mcuA}
              onChange={(e) => {
                const nextMcu = e.target.value as SupportedMCU;
                setMcuA(nextMcu);
                if (onSelectMCU) onSelectMCU(nextMcu);
              }}
              className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs font-bold text-white font-mono focus:outline-none focus:border-cyan-400"
            >
              <option value="atmega328p">ATmega328P</option>
              <option value="atmega2560">ATmega2560</option>
              <option value="atmega128">ATmega128</option>
              <option value="atmega640">ATmega640</option>
            </select>
          </div>

          {/* Swap Button */}
          <button
            type="button"
            onClick={handleSwapMcus}
            title="MCU A와 B 위치 교환 (Swap)"
            className="p-2 mt-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
          >
            <ArrowLeftRight className="w-4 h-4 text-cyan-400" />
          </button>

          {/* MCU Model B */}
          <div className="text-left">
            <span className="text-[10px] font-bold text-indigo-400 block px-1">MCU 모델 B</span>
            <select
              value={mcuB}
              onChange={(e) => setMcuB(e.target.value as SupportedMCU)}
              className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs font-bold text-white font-mono focus:outline-none focus:border-indigo-400"
            >
              <option value="atmega328p">ATmega328P</option>
              <option value="atmega2560">ATmega2560</option>
              <option value="atmega128">ATmega128</option>
              <option value="atmega640">ATmega640</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Compatibility Score & Quick KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Score Card */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            종합 호환성 지수
          </div>
          <div className="my-2 flex items-baseline gap-1">
            <span className={`text-2xl sm:text-3xl font-black font-mono ${
              comparisonStats.compatibilityScore >= 90
                ? 'text-emerald-400'
                : comparisonStats.compatibilityScore >= 70
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}>
              {comparisonStats.compatibilityScore}%
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {profileA.name} &harr; {profileB.name}
          </div>
        </div>

        {/* Identical Registers */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            100% 동일 레지스터
          </div>
          <div className="my-2 text-2xl font-black text-white font-mono">
            {comparisonStats.identicalRegs}개
          </div>
          <div className="text-[10px] text-slate-500">주소 및 비트 완벽 일치</div>
        </div>

        {/* Different Registers */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            차이점 있는 레지스터
          </div>
          <div className="my-2 text-2xl font-black text-amber-300 font-mono">
            {comparisonStats.diffRegs}개
          </div>
          <div className="text-[10px] text-slate-500">마이그레이션 검토 필요</div>
        </div>

        {/* Address Mismatch */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-[11px] font-bold text-indigo-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            주소 영역 불일치
          </div>
          <div className="my-2 text-2xl font-black text-indigo-300 font-mono">
            {comparisonStats.addressMismatches}건
          </div>
          <div className="text-[10px] text-slate-500">확장(LDS/STS) vs 표준(IN/OUT)</div>
        </div>

        {/* Bit Discrepancies */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between col-span-2 md:col-span-1">
          <div className="text-[11px] font-bold text-rose-400 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            불일치 비트 필드
          </div>
          <div className="my-2 text-2xl font-black text-rose-300 font-mono">
            {comparisonStats.bitMismatches}개 비트
          </div>
          <div className="text-[10px] text-slate-500">위치 이동 또는 미지원 비트</div>
        </div>
      </div>

      {/* 3. Filter Controls & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {[
            { id: 'all', label: '전체 주변장치' },
            { id: 'timer', label: '타이머/카운터' },
            { id: 'usart', label: 'USART 시리얼' },
            { id: 'comm', label: '통신(SPI/I2C)' },
            { id: 'analog', label: 'ADC 아날로그' },
            { id: 'interrupt', label: '외부 인터럽트' },
            { id: 'system', label: '시스템/WDT' }
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id as DiffCategory)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all font-medium ${
                activeCategory === cat.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Right Search & Diffs-Only Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-slate-300 select-none">
            <input
              type="checkbox"
              checked={showDiffsOnly}
              onChange={(e) => setShowDiffsOnly(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-cyan-500"
            />
            <span className={showDiffsOnly ? 'text-amber-400 font-bold' : ''}>차이점만 보기</span>
          </label>

          <div className="relative min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="레지스터 또는 비트 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
            />
          </div>
        </div>
      </div>

      {/* 4. Legend Bar */}
      <div className="flex flex-wrap items-center gap-4 px-2 text-[11px] text-slate-400 border-b border-slate-800/80 pb-3">
        <span className="font-bold text-slate-300">비트 하이라이트 범례:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-emerald-500/20 border border-emerald-500/50" />
          <span className="text-emerald-300">100% 동일 기능 비트</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-amber-500/20 border border-amber-500/60" />
          <span className="text-amber-300">기능적 의미/위치 상이</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-rose-500/20 border border-rose-500/60" />
          <span className="text-rose-300">한 쪽에만 존재 (미지원)</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-indigo-500/20 border border-indigo-500/50" />
          <span className="text-indigo-300">주소/영역(확장 vs 표준) 상이</span>
        </span>
      </div>

      {/* 5. Side-by-Side Register Comparison Workstation List */}
      <div className="space-y-4">
        {filteredRegisters.length === 0 ? (
          <div className="text-center py-12 bg-slate-950/40 rounded-2xl border border-slate-800 text-slate-500 text-xs">
            일치하는 레지스터가 없습니다. 필터 조건을 변경해 보세요.
          </div>
        ) : (
          filteredRegisters.map((reg) => {
            const dataA = reg.mcus[mcuA];
            const dataB = reg.mcus[mcuB];

            const isNameDiff = dataA.regName !== dataB.regName;
            const isAddrDiff = dataA.memAddr !== dataB.memAddr || dataA.isExtendedIo !== dataB.isExtendedIo;
            const isExpanded = expandedRegId === reg.id;

            return (
              <div
                key={reg.id}
                className={`border rounded-2xl transition-all ${
                  isExpanded
                    ? 'bg-slate-900/90 border-cyan-500/40 shadow-xl ring-1 ring-cyan-500/20'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Header Row: Title & Side-by-Side Address Badges */}
                <div
                  onClick={() => setExpandedRegId(isExpanded ? null : reg.id)}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="p-1 text-slate-400 hover:text-white transition"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-white">{reg.id}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          {reg.categoryLabel}
                        </span>
                        {(isNameDiff || isAddrDiff) && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold">
                            차이점 감지됨
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{reg.description}</p>
                    </div>
                  </div>

                  {/* Dual MCU Address Indicators */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono shrink-0 pl-7 md:pl-0">
                    {/* Left: MCU A Specs */}
                    <div className="bg-slate-900/80 border border-cyan-500/30 px-3 py-1.5 rounded-xl text-left">
                      <div className="text-[10px] text-cyan-400 font-bold">{profileA.name}</div>
                      <div className="text-white font-bold flex items-center gap-1.5">
                        <span>{dataA.regName}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {dataA.supported ? dataA.memAddr : '미지원'}
                        </span>
                      </div>
                    </div>

                    {/* Right: MCU B Specs */}
                    <div className="bg-slate-900/80 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-left">
                      <div className="text-[10px] text-indigo-400 font-bold">{profileB.name}</div>
                      <div className="text-white font-bold flex items-center gap-1.5">
                        <span>{dataB.regName}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {dataB.supported ? dataB.memAddr : '미지원'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Side-by-Side 8-Bit Strips */}
                <div className="border-t border-slate-800/80 p-4 space-y-4 bg-slate-950/40 rounded-b-2xl">
                  {/* Visual 8-Bit Side-by-Side Contrast Table */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-8 gap-1.5 text-center text-[10px] font-mono text-slate-500 font-bold">
                      <span>Bit 7</span>
                      <span>Bit 6</span>
                      <span>Bit 5</span>
                      <span>Bit 4</span>
                      <span>Bit 3</span>
                      <span>Bit 2</span>
                      <span>Bit 1</span>
                      <span>Bit 0</span>
                    </div>

                    {/* Row 1: MCU A Bits */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-cyan-400 font-bold flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                          {profileA.name}: {dataA.regName}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {dataA.isExtendedIo ? '확장 I/O (LDS/STS)' : '표준 I/O (IN/OUT)'}
                        </span>
                      </div>

                      <div className="grid grid-cols-8 gap-1.5">
                        {[7, 6, 5, 4, 3, 2, 1, 0].map((bitIdx) => {
                          const bitA = dataA.bits.find((b) => b.bit === bitIdx);
                          const result = compareBitFields(bitIdx, dataA, dataB);

                          let bgStyle = 'bg-slate-900/80 border-slate-800 text-slate-400';
                          if (result === 'identical') {
                            bgStyle = 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-bold';
                          } else if (result === 'mismatch') {
                            bgStyle = 'bg-amber-500/15 border-amber-500/60 text-amber-300 font-bold shadow-sm';
                          } else if (result === 'only_a') {
                            bgStyle = 'bg-rose-500/15 border-rose-500/60 text-rose-300 font-bold shadow-sm';
                          }

                          return (
                            <div
                              key={bitIdx}
                              title={`${bitA?.name || '—'}: ${bitA?.desc || '예약 비트'}`}
                              className={`p-2 rounded-xl border text-center transition flex flex-col justify-center items-center h-14 ${bgStyle}`}
                            >
                              <span className="text-xs font-mono font-bold leading-none truncate w-full">
                                {bitA?.name || '—'}
                              </span>
                              <span className="text-[9px] text-slate-500 mt-1">b{bitIdx}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Row 2: MCU B Bits */}
                    <div className="space-y-1 pt-2">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-indigo-400 font-bold flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-indigo-400" />
                          {profileB.name}: {dataB.regName}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {dataB.isExtendedIo ? '확장 I/O (LDS/STS)' : '표준 I/O (IN/OUT)'}
                        </span>
                      </div>

                      <div className="grid grid-cols-8 gap-1.5">
                        {[7, 6, 5, 4, 3, 2, 1, 0].map((bitIdx) => {
                          const bitB = dataB.bits.find((b) => b.bit === bitIdx);
                          const result = compareBitFields(bitIdx, dataA, dataB);

                          let bgStyle = 'bg-slate-900/80 border-slate-800 text-slate-400';
                          if (result === 'identical') {
                            bgStyle = 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-bold';
                          } else if (result === 'mismatch') {
                            bgStyle = 'bg-amber-500/15 border-amber-500/60 text-amber-300 font-bold shadow-sm';
                          } else if (result === 'only_b') {
                            bgStyle = 'bg-rose-500/15 border-rose-500/60 text-rose-300 font-bold shadow-sm';
                          }

                          return (
                            <div
                              key={bitIdx}
                              title={`${bitB?.name || '—'}: ${bitB?.desc || '예약 비트'}`}
                              className={`p-2 rounded-xl border text-center transition flex flex-col justify-center items-center h-14 ${bgStyle}`}
                            >
                              <span className="text-xs font-mono font-bold leading-none truncate w-full">
                                {bitB?.name || '—'}
                              </span>
                              <span className="text-[9px] text-slate-500 mt-1">b{bitIdx}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Migration Notes Callout if defined for this pair */}
                  {reg.migrationNotice && reg.migrationNotice.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1 text-xs">
                      <div className="flex items-center gap-2 font-bold text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>마이그레이션 호환성 유의사항: {reg.migrationNotice[0].summary}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed pl-6">
                        {reg.migrationNotice[0].workaround}
                      </p>
                    </div>
                  )}

                  {/* Register Specific Notes */}
                  {(dataA.notes || dataB.notes) && (
                    <div className="text-[11px] text-slate-400 space-y-1 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800">
                      {dataA.notes && (
                        <div>
                          <strong className="text-cyan-400 font-mono">[{profileA.name}]</strong> {dataA.notes}
                        </div>
                      )}
                      {dataB.notes && (
                        <div>
                          <strong className="text-indigo-400 font-mono">[{profileB.name}]</strong> {dataB.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 6. Cross-MCU Migration C Compatibility Header Generator */}
      <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-cyan-400" />
            <div>
              <h4 className="text-sm font-bold text-white">
                자동 생성 크로스-MCU 호환성 C 매크로 헤더 ({profileA.name} &harr; {profileB.name})
              </h4>
              <p className="text-[11px] text-slate-400">
                두 MCU 간 명칭이 다른 레지스터를 통일하여 동일한 소스 코드로 양쪽 MCU에서 컴파일할 수 있도록 지원합니다.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyMacro}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition shadow-md shadow-cyan-600/20 shrink-0"
          >
            {copiedCode ? <Check className="w-4 h-4 text-cyan-200" /> : <Copy className="w-4 h-4" />}
            {copiedCode ? '매크로 복사 완료!' : '호환성 헤더 복사'}
          </button>
        </div>

        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3.5 font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto max-h-[220px] overflow-y-auto select-text shadow-inner">
          <pre className="whitespace-pre">
            {generatedCompatibilityHeader}
          </pre>
        </div>
      </div>
    </div>
  );
};
