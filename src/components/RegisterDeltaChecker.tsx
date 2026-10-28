import React, { useState, useMemo } from 'react';
import {
  GitCompare,
  ArrowRight,
  ArrowLeftRight,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  Terminal,
  Cpu,
  Layers,
  Search,
  Filter,
  Flame,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  FileCode2
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type PeripheralCategory = 'all' | 'timer' | 'gpio' | 'usart' | 'adc' | 'interrupt' | 'system';

export interface BitDef {
  index: number;
  name: string;
  desc: string;
  isReserved?: boolean;
}

export interface RegisterSchema {
  id: string;
  name: string;
  category: 'timer' | 'gpio' | 'usart' | 'adc' | 'interrupt' | 'system';
  description: string;
  // Specific bitfield name mapping per MCU (handles ATmega128 vs 328P vs 2560 differences)
  mcuRegisterNames: Partial<Record<SupportedMCU, string>>;
  ioAddress: Partial<Record<SupportedMCU, string>>;
  bits: Record<SupportedMCU, BitDef[]>;
}

// Preset definitions for MCU configurations
export interface ConfigPreset {
  id: string;
  title: string;
  description: string;
  values: Record<string, number>; // regId -> 8-bit value
}

// Common register definitions with cross-MCU mappings
const REGISTER_CATALOG: RegisterSchema[] = [
  // 1. Timer0 Control A
  {
    id: 'TCCR0A',
    name: 'TCCR0A (또는 TCCR0)',
    category: 'timer',
    description: '타이머/카운터 0 제어 레지스터 A (비교 출력 모드 COM 및 파형 WGM 설정)',
    mcuRegisterNames: {
      atmega328p: 'TCCR0A',
      atmega128: 'TCCR0',
      atmega640: 'TCCR0A',
      atmega2560: 'TCCR0A'
    },
    ioAddress: {
      atmega328p: '0x24 (0x44)',
      atmega128: '0x33 (0x53)',
      atmega640: '0x24 (0x44)',
      atmega2560: '0x24 (0x44)'
    },
    bits: {
      atmega328p: [
        { index: 7, name: 'COM0A1', desc: 'OC0A 출력 모드 상위 비트' },
        { index: 6, name: 'COM0A0', desc: 'OC0A 출력 모드 하위 비트' },
        { index: 5, name: 'COM0B1', desc: 'OC0B 출력 모드 상위 비트' },
        { index: 4, name: 'COM0B0', desc: 'OC0B 출력 모드 하위 비트' },
        { index: 3, name: '-', desc: '예약됨', isReserved: true },
        { index: 2, name: '-', desc: '예약됨', isReserved: true },
        { index: 1, name: 'WGM01', desc: '파형 생성 모드 비트 1 (CTC/Fast PWM)' },
        { index: 0, name: 'WGM00', desc: '파형 생성 모드 비트 0' }
      ],
      atmega128: [
        { index: 7, name: 'FOC0', desc: '강제 비교 일치' },
        { index: 6, name: 'WGM00', desc: '파형 생성 모드 비트 0' },
        { index: 5, name: 'COM01', desc: 'OC0 출력 모드 상위 비트' },
        { index: 4, name: 'COM00', desc: 'OC0 출력 모드 하위 비트' },
        { index: 3, name: 'WGM01', desc: '파형 생성 모드 비트 1' },
        { index: 2, name: 'CS02', desc: '클럭 분주비 선택 2' },
        { index: 1, name: 'CS01', desc: '클럭 분주비 선택 1' },
        { index: 0, name: 'CS00', desc: '클럭 분주비 선택 0' }
      ],
      atmega640: [
        { index: 7, name: 'COM0A1', desc: 'OC0A 출력 모드 상위 비트' },
        { index: 6, name: 'COM0A0', desc: 'OC0A 출력 모드 하위 비트' },
        { index: 5, name: 'COM0B1', desc: 'OC0B 출력 모드 상위 비트' },
        { index: 4, name: 'COM0B0', desc: 'OC0B 출력 모드 하위 비트' },
        { index: 3, name: '-', desc: '예약됨', isReserved: true },
        { index: 2, name: '-', desc: '예약됨', isReserved: true },
        { index: 1, name: 'WGM01', desc: '파형 생성 모드 비트 1' },
        { index: 0, name: 'WGM00', desc: '파형 생성 모드 비트 0' }
      ],
      atmega2560: [
        { index: 7, name: 'COM0A1', desc: 'OC0A 출력 모드 상위 비트' },
        { index: 6, name: 'COM0A0', desc: 'OC0A 출력 모드 하위 비트' },
        { index: 5, name: 'COM0B1', desc: 'OC0B 출력 모드 상위 비트' },
        { index: 4, name: 'COM0B0', desc: 'OC0B 출력 모드 하위 비트' },
        { index: 3, name: '-', desc: '예약됨', isReserved: true },
        { index: 2, name: '-', desc: '예약됨', isReserved: true },
        { index: 1, name: 'WGM01', desc: '파형 생성 모드 비트 1' },
        { index: 0, name: 'WGM00', desc: '파형 생성 모드 비트 0' }
      ]
    }
  },
  // 2. Timer0 Control B
  {
    id: 'TCCR0B',
    name: 'TCCR0B',
    category: 'timer',
    description: '타이머/카운터 0 제어 레지스터 B (프리스케일러 CS02:00 및 WGM02)',
    mcuRegisterNames: {
      atmega328p: 'TCCR0B',
      atmega128: 'TCCR0 (내장 합산)',
      atmega640: 'TCCR0B',
      atmega2560: 'TCCR0B'
    },
    ioAddress: {
      atmega328p: '0x25 (0x45)',
      atmega128: '0x33 (0x53)',
      atmega640: '0x25 (0x45)',
      atmega2560: '0x25 (0x45)'
    },
    bits: {
      atmega328p: [
        { index: 7, name: 'FOC0A', desc: '강제 비교 일치 A' },
        { index: 6, name: 'FOC0B', desc: '강제 비교 일치 B' },
        { index: 5, name: '-', desc: '예약됨', isReserved: true },
        { index: 4, name: '-', desc: '예약됨', isReserved: true },
        { index: 3, name: 'WGM02', desc: '파형 모드 비트 2' },
        { index: 2, name: 'CS02', desc: '분주비 CS02' },
        { index: 1, name: 'CS01', desc: '분주비 CS01' },
        { index: 0, name: 'CS00', desc: '분주비 CS00' }
      ],
      atmega128: [
        { index: 7, name: 'FOC0', desc: '강제 비교 일치' },
        { index: 6, name: 'WGM00', desc: '파형 모드 0' },
        { index: 5, name: 'COM01', desc: 'COM01' },
        { index: 4, name: 'COM00', desc: 'COM00' },
        { index: 3, name: 'WGM01', desc: '파형 모드 1' },
        { index: 2, name: 'CS02', desc: '분주비 CS02' },
        { index: 1, name: 'CS01', desc: '분주비 CS01' },
        { index: 0, name: 'CS00', desc: '분주비 CS00' }
      ],
      atmega640: [
        { index: 7, name: 'FOC0A', desc: '강제 비교 일치 A' },
        { index: 6, name: 'FOC0B', desc: '강제 비교 일치 B' },
        { index: 5, name: '-', desc: '예약됨', isReserved: true },
        { index: 4, name: '-', desc: '예약됨', isReserved: true },
        { index: 3, name: 'WGM02', desc: '파형 모드 비트 2' },
        { index: 2, name: 'CS02', desc: '분주비 CS02' },
        { index: 1, name: 'CS01', desc: '분주비 CS01' },
        { index: 0, name: 'CS00', desc: '분주비 CS00' }
      ],
      atmega2560: [
        { index: 7, name: 'FOC0A', desc: '강제 비교 일치 A' },
        { index: 6, name: 'FOC0B', desc: '강제 비교 일치 B' },
        { index: 5, name: '-', desc: '예약됨', isReserved: true },
        { index: 4, name: '-', desc: '예약됨', isReserved: true },
        { index: 3, name: 'WGM02', desc: '파형 모드 비트 2' },
        { index: 2, name: 'CS02', desc: '분주비 CS02' },
        { index: 1, name: 'CS01', desc: '분주비 CS01' },
        { index: 0, name: 'CS00', desc: '분주비 CS00' }
      ]
    }
  },
  // 3. Timer Interrupt Mask
  {
    id: 'TIMSK0',
    name: 'TIMSK0 (또는 TIMSK)',
    category: 'timer',
    description: '타이머 인터럽트 마스크 레지스터 (오버플로우 TOIE0 및 비교 일치 OCIE0A/B)',
    mcuRegisterNames: {
      atmega328p: 'TIMSK0',
      atmega128: 'TIMSK',
      atmega640: 'TIMSK0',
      atmega2560: 'TIMSK0'
    },
    ioAddress: {
      atmega328p: '0x6E',
      atmega128: '0x37 (0x57)',
      atmega640: '0x6E',
      atmega2560: '0x6E'
    },
    bits: {
      atmega328p: [
        { index: 7, name: '-', desc: '예약됨', isReserved: true },
        { index: 6, name: '-', desc: '예약됨', isReserved: true },
        { index: 5, name: '-', desc: '예약됨', isReserved: true },
        { index: 4, name: '-', desc: '예약됨', isReserved: true },
        { index: 3, name: '-', desc: '예약됨', isReserved: true },
        { index: 2, name: 'OCIE0B', desc: 'Timer0 Compare Match B 인터럽트 활성화' },
        { index: 1, name: 'OCIE0A', desc: 'Timer0 Compare Match A 인터럽트 활성화' },
        { index: 0, name: 'TOIE0', desc: 'Timer0 Overflow 인터럽트 활성화' }
      ],
      atmega128: [
        { index: 7, name: 'OCIE2', desc: 'Timer2 Compare Match 인터럽트' },
        { index: 6, name: 'TOIE2', desc: 'Timer2 Overflow 인터럽트' },
        { index: 5, name: 'TICIE1', desc: 'Timer1 Capture 인터럽트' },
        { index: 4, name: 'OCIE1A', desc: 'Timer1 Compare Match A' },
        { index: 3, name: 'OCIE1B', desc: 'Timer1 Compare Match B' },
        { index: 2, name: 'TOIE1', desc: 'Timer1 Overflow' },
        { index: 1, name: 'OCIE0', desc: 'Timer0 Compare Match' },
        { index: 0, name: 'TOIE0', desc: 'Timer0 Overflow' }
      ],
      atmega640: [
        { index: 7, name: '-', desc: '예약됨', isReserved: true },
        { index: 6, name: '-', desc: '예약됨', isReserved: true },
        { index: 5, name: '-', desc: '예약됨', isReserved: true },
        { index: 4, name: '-', desc: '예약됨', isReserved: true },
        { index: 3, name: '-', desc: '예약됨', isReserved: true },
        { index: 2, name: 'OCIE0B', desc: 'Timer0 Compare Match B' },
        { index: 1, name: 'OCIE0A', desc: 'Timer0 Compare Match A' },
        { index: 0, name: 'TOIE0', desc: 'Timer0 Overflow' }
      ],
      atmega2560: [
        { index: 7, name: '-', desc: '예약됨', isReserved: true },
        { index: 6, name: '-', desc: '예약됨', isReserved: true },
        { index: 5, name: '-', desc: '예약됨', isReserved: true },
        { index: 4, name: '-', desc: '예약됨', isReserved: true },
        { index: 3, name: '-', desc: '예약됨', isReserved: true },
        { index: 2, name: 'OCIE0B', desc: 'Timer0 Compare Match B' },
        { index: 1, name: 'OCIE0A', desc: 'Timer0 Compare Match A' },
        { index: 0, name: 'TOIE0', desc: 'Timer0 Overflow' }
      ]
    }
  },
  // 4. GPIO Port B Data Direction
  {
    id: 'DDRB',
    name: 'DDRB',
    category: 'gpio',
    description: '포트 B 데이터 입출력 방향 레지스터 (1: 출력, 0: 입력)',
    mcuRegisterNames: {
      atmega328p: 'DDRB',
      atmega128: 'DDRB',
      atmega640: 'DDRB',
      atmega2560: 'DDRB'
    },
    ioAddress: {
      atmega328p: '0x04 (0x24)',
      atmega128: '0x17 (0x37)',
      atmega640: '0x04 (0x24)',
      atmega2560: '0x04 (0x24)'
    },
    bits: {
      atmega328p: [
        { index: 7, name: 'DDB7', desc: 'PB7 (XTAL2) 입출력 방향' },
        { index: 6, name: 'DDB6', desc: 'PB6 (XTAL1) 입출력 방향' },
        { index: 5, name: 'DDB5', desc: 'PB5 (SCK/LED) 입출력 방향' },
        { index: 4, name: 'DDB4', desc: 'PB4 (MISO) 입출력 방향' },
        { index: 3, name: 'DDB3', desc: 'PB3 (MOSI/OC2A) 입출력 방향' },
        { index: 2, name: 'DDB2', desc: 'PB2 (SS/OC1B) 입출력 방향' },
        { index: 1, name: 'DDB1', desc: 'PB1 (OC1A) 입출력 방향' },
        { index: 0, name: 'DDB0', desc: 'PB0 (ICP1) 입출력 방향' }
      ],
      atmega128: [
        { index: 7, name: 'DDB7', desc: 'PB7 (OC2/OC1C) 방향' },
        { index: 6, name: 'DDB6', desc: 'PB6 (OC1B) 방향' },
        { index: 5, name: 'DDB5', desc: 'PB5 (OC1A) 방향' },
        { index: 4, name: 'DDB4', desc: 'PB4 (OC0) 방향' },
        { index: 3, name: 'DDB3', desc: 'PB3 (MISO) 방향' },
        { index: 2, name: 'DDB2', desc: 'PB2 (MOSI) 방향' },
        { index: 1, name: 'DDB1', desc: 'PB1 (SCK) 방향' },
        { index: 0, name: 'DDB0', desc: 'PB0 (SS) 방향' }
      ],
      atmega640: [
        { index: 7, name: 'DDB7', desc: 'PB7 (OC0A/OC1C) 방향' },
        { index: 6, name: 'DDB6', desc: 'PB6 (OC1B) 방향' },
        { index: 5, name: 'DDB5', desc: 'PB5 (OC1A) 방향' },
        { index: 4, name: 'DDB4', desc: 'PB4 (OC2A) 방향' },
        { index: 3, name: 'DDB3', desc: 'PB3 (MISO) 방향' },
        { index: 2, name: 'DDB2', desc: 'PB2 (MOSI) 방향' },
        { index: 1, name: 'DDB1', desc: 'PB1 (SCK) 방향' },
        { index: 0, name: 'DDB0', desc: 'PB0 (SS) 방향' }
      ],
      atmega2560: [
        { index: 7, name: 'DDB7', desc: 'PB7 (OC0A/OC1C) 방향' },
        { index: 6, name: 'DDB6', desc: 'PB6 (OC1B) 방향' },
        { index: 5, name: 'DDB5', desc: 'PB5 (OC1A) 방향' },
        { index: 4, name: 'DDB4', desc: 'PB4 (OC2A) 방향' },
        { index: 3, name: 'DDB3', desc: 'PB3 (MISO) 방향' },
        { index: 2, name: 'DDB2', desc: 'PB2 (MOSI) 방향' },
        { index: 1, name: 'DDB1', desc: 'PB1 (SCK) 방향' },
        { index: 0, name: 'DDB0', desc: 'PB0 (SS) 방향' }
      ]
    }
  },
  // 5. GPIO Port B Output Data
  {
    id: 'PORTB',
    name: 'PORTB',
    category: 'gpio',
    description: '포트 B 데이터 출력 또는 내부 풀업 저항 활성화 레지스터',
    mcuRegisterNames: {
      atmega328p: 'PORTB',
      atmega128: 'PORTB',
      atmega640: 'PORTB',
      atmega2560: 'PORTB'
    },
    ioAddress: {
      atmega328p: '0x05 (0x25)',
      atmega128: '0x18 (0x38)',
      atmega640: '0x05 (0x25)',
      atmega2560: '0x05 (0x25)'
    },
    bits: {
      atmega328p: [
        { index: 7, name: 'PORTB7', desc: 'PB7 출력값 또는 풀업' },
        { index: 6, name: 'PORTB6', desc: 'PB6 출력값 또는 풀업' },
        { index: 5, name: 'PORTB5', desc: 'PB5 출력값 또는 풀업' },
        { index: 4, name: 'PORTB4', desc: 'PB4 출력값 또는 풀업' },
        { index: 3, name: 'PORTB3', desc: 'PB3 출력값 또는 풀업' },
        { index: 2, name: 'PORTB2', desc: 'PB2 출력값 또는 풀업' },
        { index: 1, name: 'PORTB1', desc: 'PB1 출력값 또는 풀업' },
        { index: 0, name: 'PORTB0', desc: 'PB0 출력값 또는 풀업' }
      ],
      atmega128: [
        { index: 7, name: 'PORTB7', desc: 'PB7 출력값' },
        { index: 6, name: 'PORTB6', desc: 'PB6 출력값' },
        { index: 5, name: 'PORTB5', desc: 'PB5 출력값' },
        { index: 4, name: 'PORTB4', desc: 'PB4 출력값' },
        { index: 3, name: 'PORTB3', desc: 'PB3 출력값' },
        { index: 2, name: 'PORTB2', desc: 'PB2 출력값' },
        { index: 1, name: 'PORTB1', desc: 'PB1 출력값' },
        { index: 0, name: 'PORTB0', desc: 'PB0 출력값' }
      ],
      atmega640: [
        { index: 7, name: 'PORTB7', desc: 'PB7 출력값' },
        { index: 6, name: 'PORTB6', desc: 'PB6 출력값' },
        { index: 5, name: 'PORTB5', desc: 'PB5 출력값' },
        { index: 4, name: 'PORTB4', desc: 'PB4 출력값' },
        { index: 3, name: 'PORTB3', desc: 'PB3 출력값' },
        { index: 2, name: 'PORTB2', desc: 'PB2 출력값' },
        { index: 1, name: 'PORTB1', desc: 'PB1 출력값' },
        { index: 0, name: 'PORTB0', desc: 'PB0 출력값' }
      ],
      atmega2560: [
        { index: 7, name: 'PORTB7', desc: 'PB7 출력값' },
        { index: 6, name: 'PORTB6', desc: 'PB6 출력값' },
        { index: 5, name: 'PORTB5', desc: 'PB5 출력값' },
        { index: 4, name: 'PORTB4', desc: 'PB4 출력값' },
        { index: 3, name: 'PORTB3', desc: 'PB3 출력값' },
        { index: 2, name: 'PORTB2', desc: 'PB2 출력값' },
        { index: 1, name: 'PORTB1', desc: 'PB1 출력값' },
        { index: 0, name: 'PORTB0', desc: 'PB0 출력값' }
      ]
    }
  },
  // 6. USART Control B
  {
    id: 'UCSR0B',
    name: 'UCSR0B',
    category: 'usart',
    description: 'USART0 제어 및 상태 레지스터 B (RXEN, TXEN 및 인터럽트 RXCIE/TXCIE)',
    mcuRegisterNames: {
      atmega328p: 'UCSR0B',
      atmega128: 'UCSR0B',
      atmega640: 'UCSR0B',
      atmega2560: 'UCSR0B'
    },
    ioAddress: {
      atmega328p: '0xC1',
      atmega128: '0x0A (0x2A)',
      atmega640: '0xC1',
      atmega2560: '0xC1'
    },
    bits: {
      atmega328p: [
        { index: 7, name: 'RXCIE0', desc: 'RX 완료 인터럽트 활성화' },
        { index: 6, name: 'TXCIE0', desc: 'TX 완료 인터럽트 활성화' },
        { index: 5, name: 'UDRIE0', desc: '데이터 레지스터 빈자리 인터럽트' },
        { index: 4, name: 'RXEN0', desc: '수신기(Receiver) 활성화' },
        { index: 3, name: 'TXEN0', desc: '송신기(Transmitter) 활성화' },
        { index: 2, name: 'UCSZ02', desc: '데이터 크기 설정 비트 2' },
        { index: 1, name: 'RXB80', desc: '수신된 9번째 데이터 비트' },
        { index: 0, name: 'TXB80', desc: '송신할 9번째 데이터 비트' }
      ],
      atmega128: [
        { index: 7, name: 'RXCIE0', desc: 'RX 인터럽트 허용' },
        { index: 6, name: 'TXCIE0', desc: 'TX 인터럽트 허용' },
        { index: 5, name: 'UDRIE0', desc: 'UDRE 인터럽트 허용' },
        { index: 4, name: 'RXEN0', desc: '수신기 인에이블' },
        { index: 3, name: 'TXEN0', desc: '송신기 인에이블' },
        { index: 2, name: 'UCSZ02', desc: '문자 크기 2' },
        { index: 1, name: 'RXB80', desc: '수신 9비트' },
        { index: 0, name: 'TXB80', desc: '송신 9비트' }
      ],
      atmega640: [
        { index: 7, name: 'RXCIE0', desc: 'RX 인터럽트 허용' },
        { index: 6, name: 'TXCIE0', desc: 'TX 인터럽트 허용' },
        { index: 5, name: 'UDRIE0', desc: 'UDRE 인터럽트 허용' },
        { index: 4, name: 'RXEN0', desc: '수신 활성화' },
        { index: 3, name: 'TXEN0', desc: '송신 활성화' },
        { index: 2, name: 'UCSZ02', desc: '데이터 비트 2' },
        { index: 1, name: 'RXB80', desc: '수신 9비트' },
        { index: 0, name: 'TXB80', desc: '송신 9비트' }
      ],
      atmega2560: [
        { index: 7, name: 'RXCIE0', desc: 'RX 인터럽트 허용' },
        { index: 6, name: 'TXCIE0', desc: 'TX 인터럽트 허용' },
        { index: 5, name: 'UDRIE0', desc: 'UDRE 인터럽트 허용' },
        { index: 4, name: 'RXEN0', desc: '수신 활성화' },
        { index: 3, name: 'TXEN0', desc: '송신 활성화' },
        { index: 2, name: 'UCSZ02', desc: '데이터 비트 2' },
        { index: 1, name: 'RXB80', desc: '수신 9비트' },
        { index: 0, name: 'TXB80', desc: '송신 9비트' }
      ]
    }
  },
  // 7. ADC Control & Status Register A
  {
    id: 'ADCSRA',
    name: 'ADCSRA (또는 ADCSR)',
    category: 'adc',
    description: 'ADC 제어 및 상태 레지스터 A (ADEN 전원 인에이블, ADSC 변환 시작, 분주비 ADPS2:0)',
    mcuRegisterNames: {
      atmega328p: 'ADCSRA',
      atmega128: 'ADCSR',
      atmega640: 'ADCSRA',
      atmega2560: 'ADCSRA'
    },
    ioAddress: {
      atmega328p: '0x7A',
      atmega128: '0x06 (0x26)',
      atmega640: '0x7A',
      atmega2560: '0x7A'
    },
    bits: {
      atmega328p: [
        { index: 7, name: 'ADEN', desc: 'ADC 전원 인에이블 (1: 활성화)' },
        { index: 6, name: 'ADSC', desc: 'ADC 변환 시작 (Start Conversion)' },
        { index: 5, name: 'ADATE', desc: '자동 트리거 인에이블 (Auto Trigger)' },
        { index: 4, name: 'ADIF', desc: 'ADC 인터럽트 플래그' },
        { index: 3, name: 'ADIE', desc: 'ADC 변환 완료 인터럽트 허용' },
        { index: 2, name: 'ADPS2', desc: 'ADC 클럭 분주비 2' },
        { index: 1, name: 'ADPS1', desc: 'ADC 클럭 분주비 1' },
        { index: 0, name: 'ADPS0', desc: 'ADC 클럭 분주비 0' }
      ],
      atmega128: [
        { index: 7, name: 'ADEN', desc: 'ADC 인에이블' },
        { index: 6, name: 'ADSC', desc: 'ADC 변환 시작' },
        { index: 5, name: 'ADFR', desc: '프리러닝 모드 선택 (ATmega128 전용)' },
        { index: 4, name: 'ADIF', desc: 'ADC 인터럽트 플래그' },
        { index: 3, name: 'ADIE', desc: 'ADC 인터럽트 허용' },
        { index: 2, name: 'ADPS2', desc: '분주비 2' },
        { index: 1, name: 'ADPS1', desc: '분주비 1' },
        { index: 0, name: 'ADPS0', desc: '분주비 0' }
      ],
      atmega640: [
        { index: 7, name: 'ADEN', desc: 'ADC 인에이블' },
        { index: 6, name: 'ADSC', desc: 'ADC 변환 시작' },
        { index: 5, name: 'ADATE', desc: '자동 트리거' },
        { index: 4, name: 'ADIF', desc: '인터럽트 플래그' },
        { index: 3, name: 'ADIE', desc: '인터럽트 허용' },
        { index: 2, name: 'ADPS2', desc: '분주비 2' },
        { index: 1, name: 'ADPS1', desc: '분주비 1' },
        { index: 0, name: 'ADPS0', desc: '분주비 0' }
      ],
      atmega2560: [
        { index: 7, name: 'ADEN', desc: 'ADC 인에이블' },
        { index: 6, name: 'ADSC', desc: 'ADC 변환 시작' },
        { index: 5, name: 'ADATE', desc: '자동 트리거' },
        { index: 4, name: 'ADIF', desc: '인터럽트 플래그' },
        { index: 3, name: 'ADIE', desc: '인터럽트 허용' },
        { index: 2, name: 'ADPS2', desc: '분주비 2' },
        { index: 1, name: 'ADPS1', desc: '분주비 1' },
        { index: 0, name: 'ADPS0', desc: '분주비 0' }
      ]
    }
  },
  // 8. ADC Multiplexer Selection
  {
    id: 'ADMUX',
    name: 'ADMUX',
    category: 'adc',
    description: 'ADC 기준 전압(REFS1:0) 및 아날로그 채널 선택(MUX4:0 / MUX3:0)',
    mcuRegisterNames: {
      atmega328p: 'ADMUX',
      atmega128: 'ADMUX',
      atmega640: 'ADMUX',
      atmega2560: 'ADMUX'
    },
    ioAddress: {
      atmega328p: '0x7C',
      atmega128: '0x07 (0x27)',
      atmega640: '0x7C',
      atmega2560: '0x7C'
    },
    bits: {
      atmega328p: [
        { index: 7, name: 'REFS1', desc: '기준전압 선택 비트 1' },
        { index: 6, name: 'REFS0', desc: '기준전압 선택 비트 0 (AVcc/내부)' },
        { index: 5, name: 'ADLAR', desc: 'ADC 결과 좌측 정렬' },
        { index: 4, name: '-', desc: '예약됨', isReserved: true },
        { index: 3, name: 'MUX3', desc: '채널 선택 3' },
        { index: 2, name: 'MUX2', desc: '채널 선택 2' },
        { index: 1, name: 'MUX1', desc: '채널 선택 1' },
        { index: 0, name: 'MUX0', desc: '채널 선택 0' }
      ],
      atmega128: [
        { index: 7, name: 'REFS1', desc: '기준전압 1' },
        { index: 6, name: 'REFS0', desc: '기준전압 0' },
        { index: 5, name: 'ADLAR', desc: '결과 좌측 정렬' },
        { index: 4, name: 'MUX4', desc: '채널 선택 4' },
        { index: 3, name: 'MUX3', desc: '채널 선택 3' },
        { index: 2, name: 'MUX2', desc: '채널 선택 2' },
        { index: 1, name: 'MUX1', desc: '채널 선택 1' },
        { index: 0, name: 'MUX0', desc: '채널 선택 0' }
      ],
      atmega640: [
        { index: 7, name: 'REFS1', desc: '기준전압 1' },
        { index: 6, name: 'REFS0', desc: '기준전압 0' },
        { index: 5, name: 'ADLAR', desc: '좌측 정렬' },
        { index: 4, name: 'MUX4', desc: '채널 4' },
        { index: 3, name: 'MUX3', desc: '채널 3' },
        { index: 2, name: 'MUX2', desc: '채널 2' },
        { index: 1, name: 'MUX1', desc: '채널 1' },
        { index: 0, name: 'MUX0', desc: '채널 0' }
      ],
      atmega2560: [
        { index: 7, name: 'REFS1', desc: '기준전압 1' },
        { index: 6, name: 'REFS0', desc: '기준전압 0' },
        { index: 5, name: 'ADLAR', desc: '좌측 정렬' },
        { index: 4, name: 'MUX4', desc: '채널 4' },
        { index: 3, name: 'MUX3', desc: '채널 3' },
        { index: 2, name: 'MUX2', desc: '채널 2' },
        { index: 1, name: 'MUX1', desc: '채널 1' },
        { index: 0, name: 'MUX0', desc: '채널 0' }
      ]
    }
  },
  // 9. External Interrupt Mask
  {
    id: 'EIMSK',
    name: 'EIMSK',
    category: 'interrupt',
    description: '외부 인터럽트 인에이블 마스크 (INT0, INT1, ...)',
    mcuRegisterNames: {
      atmega328p: 'EIMSK',
      atmega128: 'EIMSK',
      atmega640: 'EIMSK',
      atmega2560: 'EIMSK'
    },
    ioAddress: {
      atmega328p: '0x1D (0x3D)',
      atmega128: '0x39 (0x59)',
      atmega640: '0x1D (0x3D)',
      atmega2560: '0x1D (0x3D)'
    },
    bits: {
      atmega328p: [
        { index: 7, name: '-', desc: '예약됨', isReserved: true },
        { index: 6, name: '-', desc: '예약됨', isReserved: true },
        { index: 5, name: '-', desc: '예약됨', isReserved: true },
        { index: 4, name: '-', desc: '예약됨', isReserved: true },
        { index: 3, name: '-', desc: '예약됨', isReserved: true },
        { index: 2, name: '-', desc: '예약됨', isReserved: true },
        { index: 1, name: 'INT1', desc: '외부 인터럽트 1 허용' },
        { index: 0, name: 'INT0', desc: '외부 인터럽트 0 허용' }
      ],
      atmega128: [
        { index: 7, name: 'INT7', desc: '외부 인터럽트 7 허용' },
        { index: 6, name: 'INT6', desc: '외부 인터럽트 6 허용' },
        { index: 5, name: 'INT5', desc: '외부 인터럽트 5 허용' },
        { index: 4, name: 'INT4', desc: '외부 인터럽트 4 허용' },
        { index: 3, name: 'INT3', desc: '외부 인터럽트 3 허용' },
        { index: 2, name: 'INT2', desc: '외부 인터럽트 2 허용' },
        { index: 1, name: 'INT1', desc: '외부 인터럽트 1 허용' },
        { index: 0, name: 'INT0', desc: '외부 인터럽트 0 허용' }
      ],
      atmega640: [
        { index: 7, name: 'INT7', desc: '외부 인터럽트 7' },
        { index: 6, name: 'INT6', desc: '외부 인터럽트 6' },
        { index: 5, name: 'INT5', desc: '외부 인터럽트 5' },
        { index: 4, name: 'INT4', desc: '외부 인터럽트 4' },
        { index: 3, name: 'INT3', desc: '외부 인터럽트 3' },
        { index: 2, name: 'INT2', desc: '외부 인터럽트 2' },
        { index: 1, name: 'INT1', desc: '외부 인터럽트 1' },
        { index: 0, name: 'INT0', desc: '외부 인터럽트 0' }
      ],
      atmega2560: [
        { index: 7, name: 'INT7', desc: '외부 인터럽트 7' },
        { index: 6, name: 'INT6', desc: '외부 인터럽트 6' },
        { index: 5, name: 'INT5', desc: '외부 인터럽트 5' },
        { index: 4, name: 'INT4', desc: '외부 인터럽트 4' },
        { index: 3, name: 'INT3', desc: '외부 인터럽트 3' },
        { index: 2, name: 'INT2', desc: '외부 인터럽트 2' },
        { index: 1, name: 'INT1', desc: '외부 인터럽트 1' },
        { index: 0, name: 'INT0', desc: '외부 인터럽트 0' }
      ]
    }
  },
  // 10. Sleep Mode Control
  {
    id: 'SMCR',
    name: 'SMCR (또는 MCUCR)',
    category: 'system',
    description: '절전 모드 제어 레지스터 (SE 절전 인에이블 및 SM2:0 수면 모드 선택)',
    mcuRegisterNames: {
      atmega328p: 'SMCR',
      atmega128: 'MCUCR',
      atmega640: 'SMCR',
      atmega2560: 'SMCR'
    },
    ioAddress: {
      atmega328p: '0x33 (0x53)',
      atmega128: '0x35 (0x55)',
      atmega640: '0x33 (0x53)',
      atmega2560: '0x33 (0x53)'
    },
    bits: {
      atmega328p: [
        { index: 7, name: '-', desc: '예약됨', isReserved: true },
        { index: 6, name: '-', desc: '예약됨', isReserved: true },
        { index: 5, name: '-', desc: '예약됨', isReserved: true },
        { index: 4, name: '-', desc: '예약됨', isReserved: true },
        { index: 3, name: 'SM2', desc: '수면 모드 비트 2' },
        { index: 2, name: 'SM1', desc: '수면 모드 비트 1' },
        { index: 1, name: 'SM0', desc: '수면 모드 비트 0' },
        { index: 0, name: 'SE', desc: '수면(Sleep) 인에이블' }
      ],
      atmega128: [
        { index: 7, name: 'SRE', desc: '외부 SRAM 활성화' },
        { index: 6, name: 'SRW10', desc: '웨이트 스테이트' },
        { index: 5, name: 'SE', desc: '수면 인에이블' },
        { index: 4, name: 'SM1', desc: '수면 모드 1' },
        { index: 3, name: 'SM0', desc: '수면 모드 0' },
        { index: 2, name: 'SM2', desc: '수면 모드 2' },
        { index: 1, name: 'IVSEL', desc: '인터럽트 벡터 선택' },
        { index: 0, name: 'IVCE', desc: '인터럽트 벡터 변경 허용' }
      ],
      atmega640: [
        { index: 7, name: '-', desc: '예약됨', isReserved: true },
        { index: 6, name: '-', desc: '예약됨', isReserved: true },
        { index: 5, name: '-', desc: '예약됨', isReserved: true },
        { index: 4, name: '-', desc: '예약됨', isReserved: true },
        { index: 3, name: 'SM2', desc: '수면 모드 2' },
        { index: 2, name: 'SM1', desc: '수면 모드 1' },
        { index: 1, name: 'SM0', desc: '수면 모드 0' },
        { index: 0, name: 'SE', desc: '수면 인에이블' }
      ],
      atmega2560: [
        { index: 7, name: '-', desc: '예약됨', isReserved: true },
        { index: 6, name: '-', desc: '예약됨', isReserved: true },
        { index: 5, name: '-', desc: '예약됨', isReserved: true },
        { index: 4, name: '-', desc: '예약됨', isReserved: true },
        { index: 3, name: 'SM2', desc: '수면 모드 2' },
        { index: 2, name: 'SM1', desc: '수면 모드 1' },
        { index: 1, name: 'SM0', desc: '수면 모드 0' },
        { index: 0, name: 'SE', desc: '수면 인에이블' }
      ]
    }
  }
];

// Built-in presets for common operational scenarios
const CONFIG_PRESETS: ConfigPreset[] = [
  {
    id: 'reset',
    title: '기본 공장 리셋 (Reset Default)',
    description: 'MCU 부팅 직후의 하드웨어 기본 초기 상태 (모든 제어 레지스터 0x00)',
    values: {
      TCCR0A: 0x00,
      TCCR0B: 0x00,
      TIMSK0: 0x00,
      DDRB: 0x00,
      PORTB: 0x00,
      UCSR0B: 0x00,
      ADCSRA: 0x00,
      ADMUX: 0x00,
      EIMSK: 0x00,
      SMCR: 0x00
    }
  },
  {
    id: 'fast_pwm',
    title: '고속 PWM 파형 발생 (Fast PWM 1kHz + OC0A)',
    description: '타이머0 비반전 Fast PWM 모드 활성화 (COM0A1=1, WGM01:00=3, 분주비 64)',
    values: {
      TCCR0A: 0x83, // COM0A1=1, WGM01=1, WGM00=1
      TCCR0B: 0x03, // CS01=1, CS00=1 (Prescaler 64)
      TIMSK0: 0x02, // OCIE0A=1 (Compare Match ISR)
      DDRB: 0x20,   // PB5 (LED or OC0A) 출력 설정
      PORTB: 0x00,
      UCSR0B: 0x00,
      ADCSRA: 0x00,
      ADMUX: 0x00,
      EIMSK: 0x00,
      SMCR: 0x00
    }
  },
  {
    id: 'uart_echo',
    title: 'USART 115200bps 통신 + RX 인터럽트',
    description: 'USART0 송수신 활성화 및 수신 완료(RXCIE0) 비동기 인터럽트 설정',
    values: {
      TCCR0A: 0x00,
      TCCR0B: 0x00,
      TIMSK0: 0x00,
      DDRB: 0x00,
      PORTB: 0x00,
      UCSR0B: 0x98, // RXCIE0=1, RXEN0=1, TXEN0=1
      ADCSRA: 0x00,
      ADMUX: 0x00,
      EIMSK: 0x00,
      SMCR: 0x00
    }
  },
  {
    id: 'adc_continuous',
    title: 'ADC 연속 샘플링 + 128 분주비 + ISR',
    description: 'ADC 전원 활성화, AVcc 기준전압(REFS0=1), 128분주, 완료 인터럽트 활성화',
    values: {
      TCCR0A: 0x00,
      TCCR0B: 0x00,
      TIMSK0: 0x00,
      DDRB: 0x00,
      PORTB: 0x00,
      UCSR0B: 0x00,
      ADCSRA: 0x8F, // ADEN=1, ADIE=1, ADPS2:0=7 (128분주)
      ADMUX: 0x40,  // REFS0=1 (AVcc)
      EIMSK: 0x00,
      SMCR: 0x00
    }
  },
  {
    id: 'power_down',
    title: '초저전력 Power-down 수면 + 외부 인터럽트',
    description: '파워다운 슬립 모드(SM1=1, SE=1) 및 INT0 활성화로 웨이크업 대기',
    values: {
      TCCR0A: 0x00,
      TCCR0B: 0x00,
      TIMSK0: 0x00,
      DDRB: 0x00,
      PORTB: 0xFF,  // 플로팅 핀 누설 전류 방지용 전체 풀업
      UCSR0B: 0x00,
      ADCSRA: 0x00, // ADC 셧다운으로 전력 절감
      ADMUX: 0x00,
      EIMSK: 0x01,  // INT0 허용
      SMCR: 0x05   // SM1=1 (Power-down), SE=1 (Sleep Enable)
    }
  }
];

export const RegisterDeltaChecker: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  // Config A and Config B MCU targets
  const [mcuA, setMcuA] = useState<SupportedMCU>(selectedMCU);
  const [mcuB, setMcuB] = useState<SupportedMCU>(selectedMCU);

  // Preset tracking
  const [presetA, setPresetA] = useState<string>('reset');
  const [presetB, setPresetB] = useState<string>('fast_pwm');

  // Register Values State
  const [valuesA, setValuesA] = useState<Record<string, number>>(() => {
    return { ...CONFIG_PRESETS[0].values };
  });

  const [valuesB, setValuesB] = useState<Record<string, number>>(() => {
    return { ...CONFIG_PRESETS[1].values };
  });

  // Filter & Search states
  const [selectedCategory, setSelectedCategory] = useState<PeripheralCategory>('all');
  const [filterDeltaOnly, setFilterDeltaOnly] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // UI state for copied code
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [activeExpandedReg, setActiveExpandedReg] = useState<string | null>(null);

  // Handle Preset Changes
  const applyPresetA = (presetId: string) => {
    setPresetA(presetId);
    const found = CONFIG_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setValuesA({ ...found.values });
    }
  };

  const applyPresetB = (presetId: string) => {
    setPresetB(presetId);
    const found = CONFIG_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setValuesB({ ...found.values });
    }
  };

  // Toggle single bit
  const toggleBitA = (regId: string, bitIndex: number) => {
    setValuesA((prev) => {
      const currentVal = prev[regId] ?? 0;
      const nextVal = currentVal ^ (1 << bitIndex);
      return { ...prev, [regId]: nextVal };
    });
    setPresetA('custom');
  };

  const toggleBitB = (regId: string, bitIndex: number) => {
    setValuesB((prev) => {
      const currentVal = prev[regId] ?? 0;
      const nextVal = currentVal ^ (1 << bitIndex);
      return { ...prev, [regId]: nextVal };
    });
    setPresetB('custom');
  };

  // Set direct hex/decimal value
  const setDirectValueA = (regId: string, val: number) => {
    setValuesA((prev) => ({ ...prev, [regId]: Math.max(0, Math.min(255, val)) }));
    setPresetA('custom');
  };

  const setDirectValueB = (regId: string, val: number) => {
    setValuesB((prev) => ({ ...prev, [regId]: Math.max(0, Math.min(255, val)) }));
    setPresetB('custom');
  };

  // Quick Action Utilities
  const handleSwapConfigs = () => {
    const tempVals = { ...valuesA };
    const tempPreset = presetA;
    const tempMcu = mcuA;

    setValuesA({ ...valuesB });
    setPresetA(presetB);
    setMcuA(mcuB);

    setValuesB(tempVals);
    setPresetB(tempPreset);
    setMcuB(tempMcu);
  };

  const handleCloneAToB = () => {
    setValuesB({ ...valuesA });
    setPresetB(presetA);
    setMcuB(mcuA);
  };

  const handleResetBoth = () => {
    applyPresetA('reset');
    applyPresetB('reset');
  };

  // Delta calculations
  const deltaAnalysis = useMemo(() => {
    let totalCompared = 0;
    let registersWithDelta = 0;
    let bitsSetDelta = 0; // 0 -> 1
    let bitsClearedDelta = 0; // 1 -> 0
    let crossMcuDiscrepancies = 0;

    const registerDiffs = REGISTER_CATALOG.map((schema) => {
      const valA = valuesA[schema.id] ?? 0;
      const valB = valuesB[schema.id] ?? 0;
      const isDiff = valA !== valB;
      const xorDiff = valA ^ valB;

      const bitsMcuA = schema.bits[mcuA] || schema.bits.atmega328p;
      const bitsMcuB = schema.bits[mcuB] || schema.bits.atmega328p;

      // Check cross-MCU naming or layout discrepancy
      const nameA = schema.mcuRegisterNames[mcuA] || schema.name;
      const nameB = schema.mcuRegisterNames[mcuB] || schema.name;
      const isMcuLayoutDiff = mcuA !== mcuB && (nameA !== nameB || schema.ioAddress[mcuA] !== schema.ioAddress[mcuB]);

      if (isMcuLayoutDiff) crossMcuDiscrepancies++;

      // Bit-by-bit comparison
      const bitChanges = Array.from({ length: 8 }, (_, idx) => {
        const bitIdx = 7 - idx; // 7 down to 0
        const bitValA = (valA >> bitIdx) & 1;
        const bitValB = (valB >> bitIdx) & 1;
        const bitInfoA: BitDef = bitsMcuA.find((b) => b.index === bitIdx) || { index: bitIdx, name: `Bit${bitIdx}`, desc: '', isReserved: false };
        const bitInfoB: BitDef = bitsMcuB.find((b) => b.index === bitIdx) || { index: bitIdx, name: `Bit${bitIdx}`, desc: '', isReserved: false };

        let changeType: 'unchanged_0' | 'unchanged_1' | 'set' | 'cleared' = 'unchanged_0';
        if (bitValA === 0 && bitValB === 1) {
          changeType = 'set'; // 0 -> 1
          bitsSetDelta++;
        } else if (bitValA === 1 && bitValB === 0) {
          changeType = 'cleared'; // 1 -> 0
          bitsClearedDelta++;
        } else if (bitValA === 1 && bitValB === 1) {
          changeType = 'unchanged_1';
        } else {
          changeType = 'unchanged_0';
        }

        return {
          index: bitIdx,
          valA: bitValA,
          valB: bitValB,
          changeType,
          infoA: bitInfoA,
          infoB: bitInfoB,
          nameDiff: bitInfoA.name !== bitInfoB.name
        };
      });

      totalCompared++;
      if (isDiff || (mcuA !== mcuB && isMcuLayoutDiff)) {
        registersWithDelta++;
      }

      return {
        schema,
        valA,
        valB,
        xorDiff,
        isDiff,
        isMcuLayoutDiff,
        nameA,
        nameB,
        addrA: schema.ioAddress[mcuA] || 'N/A',
        addrB: schema.ioAddress[mcuB] || 'N/A',
        bitChanges
      };
    });

    return {
      totalCompared,
      registersWithDelta,
      bitsSetDelta,
      bitsClearedDelta,
      totalFlippedBits: bitsSetDelta + bitsClearedDelta,
      crossMcuDiscrepancies,
      registerDiffs
    };
  }, [valuesA, valuesB, mcuA, mcuB]);

  // Filtered Register list
  const filteredRegisters = useMemo(() => {
    return deltaAnalysis.registerDiffs.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all' && item.schema.category !== selectedCategory) {
        return false;
      }

      // Delta Only filter
      if (filterDeltaOnly && !item.isDiff && !item.isMcuLayoutDiff) {
        return false;
      }

      // Search Query filter
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesName =
          item.schema.name.toLowerCase().includes(q) ||
          item.nameA.toLowerCase().includes(q) ||
          item.nameB.toLowerCase().includes(q) ||
          item.schema.description.toLowerCase().includes(q);
        const matchesBit = item.bitChanges.some(
          (b) =>
            b.infoA.name.toLowerCase().includes(q) ||
            b.infoB.name.toLowerCase().includes(q) ||
            b.infoA.desc.toLowerCase().includes(q)
        );
        return matchesName || matchesBit;
      }

      return true;
    });
  }, [deltaAnalysis, selectedCategory, filterDeltaOnly, searchQuery]);

  // Generate C Migration Code Snippet (from Config A to Config B)
  const migrationCode = useMemo(() => {
    const lines: string[] = [
      `// =================================================================`,
      `// [레지스터 델타 마이그레이션 C 펌웨어 코드]`,
      `// 기준 설정 A (${MCU_PROFILES[mcuA].name} - ${CONFIG_PRESETS.find((p) => p.id === presetA)?.title || '사용자 설정'})`,
      `//   ↓ 변환 (Transition)`,
      `// 목표 설정 B (${MCU_PROFILES[mcuB].name} - ${CONFIG_PRESETS.find((p) => p.id === presetB)?.title || '사용자 설정'})`,
      `// 총 변경 레지스터: ${deltaAnalysis.registersWithDelta}개, 반전 비트: ${deltaAnalysis.totalFlippedBits}개`,
      `// =================================================================`,
      `#include <avr/io.h>`,
      `#include <avr/interrupt.h>`,
      ``,
      `void Apply_Register_Delta_Config(void) {`
    ];

    if (mcuA !== mcuB) {
      lines.push(`    // 주의: 대상 MCU 아키텍처가 상이합니다 (${MCU_PROFILES[mcuA].name} -> ${MCU_PROFILES[mcuB].name})`);
      lines.push(`    // 레지스터 심볼 이름 및 주소 매핑을 반드시 컴파일러 타겟에 맞춰 검토하세요.`);
      lines.push(``);
    }

    let hasStatements = false;

    deltaAnalysis.registerDiffs.forEach((item) => {
      if (!item.isDiff && !item.isMcuLayoutDiff) return;
      hasStatements = true;

      const targetRegName = item.nameB;
      const setBits = item.bitChanges.filter((b) => b.changeType === 'set' && !b.infoB.isReserved);
      const clearedBits = item.bitChanges.filter((b) => b.changeType === 'cleared' && !b.infoB.isReserved);

      lines.push(`    // --- ${targetRegName} [0x${item.valA.toString(16).toUpperCase().padStart(2, '0')} -> 0x${item.valB.toString(16).toUpperCase().padStart(2, '0')}] ---`);

      // Option 1: Direct Assignment
      lines.push(`    ${targetRegName} = 0x${item.valB.toString(16).toUpperCase().padStart(2, '0')};`);

      // Option 2: Bitwise atomic modification explanation
      const setStr = setBits.map((b) => `(1 << ${b.infoB.name})`).join(' | ');
      const clrStr = clearedBits.map((b) => `(1 << ${b.infoB.name})`).join(' | ');

      if (setBits.length > 0 && clearedBits.length > 0) {
        lines.push(`    // 비트 단위 마이그레이션: ${targetRegName} = (${targetRegName} | (${setStr})) & ~(${clrStr});`);
      } else if (setBits.length > 0) {
        lines.push(`    // 비트 신규 세트: ${targetRegName} |= (${setStr});`);
      } else if (clearedBits.length > 0) {
        lines.push(`    // 비트 클리어: ${targetRegName} &= ~(${clrStr});`);
      }
      lines.push(``);
    });

    if (!hasStatements) {
      lines.push(`    // 두 구성 상태가 완벽히 일치합니다. 변경이 필요하지 않습니다.`);
    }

    lines.push(`}`);
    return lines.join('\n');
  }, [deltaAnalysis, mcuA, mcuB, presetA, presetB]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(migrationCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-2">
            <GitCompare className="w-3.5 h-3.5" />
            <span>MCU Register Delta Differential Engine</span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            레지스터 델타 확인기 (Register Delta Checker)
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Bitwise XOR & State Comparator
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            두 개의 서로 다른 MCU 작동 구성(Config A vs Config B) 또는 상이한 MCU 기종 간의 SFR 레지스터 비트맵 차이를
            실시간으로 비교 분석합니다. 변경된 비트(0→1 세트, 1→0 클리어)를 시각화하고 C 마이그레이션 코드를 자동 생성합니다.
          </p>
        </div>

        {/* Quick Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSwapConfigs}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 transition-all shadow-sm hover:border-slate-600"
            title="A와 B의 구성 및 타깃 MCU를 서로 맞바꿉니다."
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
            A ↔ B 맞교환
          </button>
          <button
            onClick={handleCloneAToB}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 transition-all shadow-sm hover:border-slate-600"
            title="A의 현재 레지스터 값을 B로 복제합니다."
          >
            <Copy className="w-3.5 h-3.5 text-emerald-400" />
            A 복사 → B
          </button>
          <button
            onClick={handleResetBoth}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-800/60 rounded-xl text-xs font-bold text-slate-300 hover:text-rose-300 transition-all"
            title="모든 레지스터를 공장 초기화 상태(0x00)로 리셋합니다."
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            전체 초기화
          </button>
        </div>
      </div>

      {/* Cross-MCU Architecture Notice (if different MCU chosen) */}
      {mcuA !== mcuB && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-300 block">이종 MCU 교차 비교 모드 활성화 ({MCU_PROFILES[mcuA].name} vs {MCU_PROFILES[mcuB].name})</span>
            <p className="text-amber-200/90 leading-relaxed">
              두 MCU 모델 간의 레지스터 메모리 주소 오프셋과 비트필드 배치(예: ATmega128의 결합형 TCCR0/TIMSK vs ATmega328P/2560의 분리형 TCCR0A/TCCR0B/TIMSK0)의
              구조적 편차가 감지되었습니다. 불일치 레지스터에는 노란색 아키텍처 경고 태그가 부착됩니다.
            </p>
          </div>
        </div>
      )}

      {/* Dual Configuration Control Panels: Config A vs Config B */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Panel A */}
        <div className="bg-slate-950/70 border-2 border-cyan-500/30 rounded-2xl p-4 shadow-lg space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 font-mono font-black text-xs flex items-center justify-center border border-cyan-500/40">
                A
              </span>
              <div>
                <h4 className="text-sm font-bold text-white">기준 설정 A (Baseline Config)</h4>
                <span className="text-[11px] text-slate-400">비교 기준이 되는 시작 상태</span>
              </div>
            </div>
            {/* Target MCU Select */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-mono">MCU:</span>
              <select
                value={mcuA}
                onChange={(e) => {
                  const val = e.target.value as SupportedMCU;
                  setMcuA(val);
                  if (onSelectMCU) onSelectMCU(val);
                }}
                className="bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-xs font-bold rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-cyan-400 outline-none"
              >
                {(['atmega328p', 'atmega128', 'atmega640', 'atmega2560'] as SupportedMCU[]).map((id) => (
                  <option key={id} value={id}>
                    {MCU_PROFILES[id].name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preset Selector */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              사전 설정 프리셋 (Presets)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {CONFIG_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPresetA(p.id)}
                  className={`px-2.5 py-1.5 text-left rounded-lg text-xs font-semibold transition-all border ${
                    presetA === p.id
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-sm'
                      : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="truncate font-medium">{p.title.split(' ')[0]} {p.title.split(' ')[1]}</div>
                </button>
              ))}
              <div
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center justify-center ${
                  presetA === 'custom'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                    : 'bg-slate-900/40 text-slate-500 border-slate-800/60'
                }`}
              >
                사용자 정의 편집중
              </div>
            </div>
          </div>
        </div>

        {/* Panel B */}
        <div className="bg-slate-950/70 border-2 border-emerald-500/30 rounded-2xl p-4 shadow-lg space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-black text-xs flex items-center justify-center border border-emerald-500/40">
                B
              </span>
              <div>
                <h4 className="text-sm font-bold text-white">비교 대상 설정 B (Target Delta Config)</h4>
                <span className="text-[11px] text-slate-400">전환 또는 차이를 검증할 목표 상태</span>
              </div>
            </div>
            {/* Target MCU Select */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-mono">MCU:</span>
              <select
                value={mcuB}
                onChange={(e) => {
                  const val = e.target.value as SupportedMCU;
                  setMcuB(val);
                }}
                className="bg-slate-900 border border-slate-700 text-emerald-300 font-mono text-xs font-bold rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-emerald-400 outline-none"
              >
                {(['atmega328p', 'atmega128', 'atmega640', 'atmega2560'] as SupportedMCU[]).map((id) => (
                  <option key={id} value={id}>
                    {MCU_PROFILES[id].name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preset Selector */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              사전 설정 프리셋 (Presets)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {CONFIG_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPresetB(p.id)}
                  className={`px-2.5 py-1.5 text-left rounded-lg text-xs font-semibold transition-all border ${
                    presetB === p.id
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-sm'
                      : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="truncate font-medium">{p.title.split(' ')[0]} {p.title.split(' ')[1]}</div>
                </button>
              ))}
              <div
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center justify-center ${
                  presetB === 'custom'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                    : 'bg-slate-900/40 text-slate-500 border-slate-800/60'
                }`}
              >
                사용자 정의 편집중
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delta Statistics Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <span className="text-[11px] text-slate-400 font-medium block">총 비교 레지스터</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-mono font-bold text-white">{deltaAnalysis.totalCompared}</span>
            <span className="text-xs text-slate-400">개 블록</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-amber-500/30 rounded-xl p-3">
          <span className="text-[11px] text-amber-300 font-medium block">차이 발생 레지스터 (Delta)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-mono font-bold text-amber-400">{deltaAnalysis.registersWithDelta}</span>
            <span className="text-xs text-amber-400/80">개 레지스터</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-3">
          <span className="text-[11px] text-emerald-300 font-medium block">신규 세트 비트 (0 → 1)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-mono font-bold text-emerald-400">+{deltaAnalysis.bitsSetDelta}</span>
            <span className="text-xs text-emerald-400/80">개 활성화</span>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-rose-500/30 rounded-xl p-3">
          <span className="text-[11px] text-rose-300 font-medium block">클리어된 비트 (1 → 0)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-mono font-bold text-rose-400">-{deltaAnalysis.bitsClearedDelta}</span>
            <span className="text-xs text-rose-400/80">개 비활성</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 font-semibold mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> 주변장치:
          </span>
          {[
            { id: 'all', label: '전체' },
            { id: 'timer', label: '타이머' },
            { id: 'gpio', label: 'GPIO' },
            { id: 'usart', label: 'USART' },
            { id: 'adc', label: 'ADC' },
            { id: 'interrupt', label: '인터럽트' },
            { id: 'system', label: '시스템' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as PeripheralCategory)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                selectedCategory === cat.id
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Delta Only Checkbox + Search */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300 font-medium">
            <input
              type="checkbox"
              checked={filterDeltaOnly}
              onChange={(e) => setFilterDeltaOnly(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>차이점만 보기 (Deltas Only)</span>
          </label>

          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="레지스터/비트명 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Register Delta Table / Card List */}
      <div className="space-y-4">
        {filteredRegisters.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-2xl">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-bold text-white">비교 대상 레지스터가 일치하거나 필터 조건에 맞는 항목이 없습니다.</p>
            <p className="text-xs text-slate-400 mt-1">
              '차이점만 보기' 체크를 해제하거나 프리셋을 변경하여 비트 차이를 발생시켜 보세요.
            </p>
          </div>
        ) : (
          filteredRegisters.map((item) => {
            const isExpanded = activeExpandedReg === item.schema.id;

            return (
              <div
                key={item.schema.id}
                className={`bg-slate-950/80 border rounded-2xl overflow-hidden transition-all shadow-md ${
                  item.isDiff
                    ? 'border-amber-500/40 hover:border-amber-400/60'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header row */}
                <div className="p-4 bg-slate-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase border ${
                        item.schema.category === 'timer'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          : item.schema.category === 'gpio'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : item.schema.category === 'usart'
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                          : item.schema.category === 'adc'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {item.schema.category}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-white font-mono">{item.schema.name}</h4>
                        {item.isDiff ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1">
                            <Activity className="w-3 h-3 text-amber-400" />
                            DELTA ({item.bitChanges.filter((b) => b.changeType !== 'unchanged_0' && b.changeType !== 'unchanged_1').length}비트 변경)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-medium">
                            동일 (MATCH)
                          </span>
                        )}
                        {item.isMcuLayoutDiff && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold">
                            MCU 기종 편차
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{item.schema.description}</p>
                    </div>
                  </div>

                  {/* Hex Value Side-by-Side Indicators */}
                  <div className="flex items-center gap-4 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                    <div className="text-right font-mono">
                      <span className="text-[10px] text-cyan-400 block font-sans font-bold">Config A ({item.nameA})</span>
                      <span className="text-sm font-bold text-cyan-300">
                        0x{item.valA.toString(16).toUpperCase().padStart(2, '0')}
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-500" />

                    <div className="text-left font-mono">
                      <span className="text-[10px] text-emerald-400 block font-sans font-bold">Config B ({item.nameB})</span>
                      <span className="text-sm font-bold text-emerald-300">
                        0x{item.valB.toString(16).toUpperCase().padStart(2, '0')}
                      </span>
                    </div>

                    <div className="border-l border-slate-800 pl-3">
                      <span className="text-[10px] text-slate-400 block font-sans">XOR Delta</span>
                      <span className="font-mono text-xs font-bold text-amber-400">
                        0x{item.xorDiff.toString(16).toUpperCase().padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bitfields Comparison Visualizer (8 bits row) */}
                <div className="p-4 space-y-3">
                  <div className="text-xs font-bold text-slate-400 flex items-center justify-between">
                    <span>비트필드 시각화 (Bit 7 → Bit 0)</span>
                    <span className="text-[11px] text-slate-500">클릭하여 각 설정의 비트를 직접 토글할 수 있습니다</span>
                  </div>

                  <div className="grid grid-cols-8 gap-1.5 sm:gap-2">
                    {item.bitChanges.map((b) => {
                      const isChanged = b.changeType === 'set' || b.changeType === 'cleared';

                      return (
                        <div
                          key={b.index}
                          className={`rounded-xl p-2 border flex flex-col items-center justify-between text-center transition-all ${
                            isChanged
                              ? b.changeType === 'set'
                                ? 'bg-emerald-950/30 border-emerald-500/50'
                                : 'bg-rose-950/30 border-rose-500/50'
                              : 'bg-slate-900/60 border-slate-800'
                          }`}
                        >
                          {/* Bit Index & Name */}
                          <div className="w-full">
                            <span className="text-[10px] font-mono text-slate-500 block">b{b.index}</span>
                            <span
                              className={`text-[11px] font-bold font-mono truncate block ${
                                isChanged ? 'text-white' : 'text-slate-400'
                              }`}
                              title={`${b.infoA.name} (${b.infoA.desc})`}
                            >
                              {b.infoA.name}
                            </span>
                          </div>

                          {/* Dual Value Interactive Buttons */}
                          <div className="my-2 flex flex-col gap-1 w-full">
                            {/* Value A Button */}
                            <button
                              onClick={() => toggleBitA(item.schema.id, b.index)}
                              className={`w-full py-1 rounded text-xs font-mono font-bold transition-all border ${
                                b.valA === 1
                                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                              }`}
                              title={`A [${item.nameA}]: 클릭하여 비트 토글 (현재 ${b.valA})`}
                            >
                              A:{b.valA}
                            </button>

                            {/* Value B Button */}
                            <button
                              onClick={() => toggleBitB(item.schema.id, b.index)}
                              className={`w-full py-1 rounded text-xs font-mono font-bold transition-all border ${
                                b.valB === 1
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                              }`}
                              title={`B [${item.nameB}]: 클릭하여 비트 토글 (현재 ${b.valB})`}
                            >
                              B:{b.valB}
                            </button>
                          </div>

                          {/* Delta Indicator Tag */}
                          <div className="mt-1">
                            {b.changeType === 'set' && (
                              <span className="inline-flex items-center text-[10px] font-mono font-bold text-emerald-400">
                                <ArrowUpRight className="w-3 h-3" /> SET
                              </span>
                            )}
                            {b.changeType === 'cleared' && (
                              <span className="inline-flex items-center text-[10px] font-mono font-bold text-rose-400">
                                <ArrowDownRight className="w-3 h-3" /> CLR
                              </span>
                            )}
                            {b.changeType === 'unchanged_1' && (
                              <span className="text-[10px] font-mono text-slate-500">SAME(1)</span>
                            )}
                            {b.changeType === 'unchanged_0' && (
                              <span className="text-[10px] font-mono text-slate-600">SAME(0)</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Quick Direct Hex Value Inputs */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-400 border-t border-slate-800/60">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-cyan-400 font-bold">A 값 (Hex):</span>
                        <input
                          type="text"
                          value={item.valA.toString(16).toUpperCase()}
                          onChange={(e) => {
                            const parsed = parseInt(e.target.value, 16);
                            if (!isNaN(parsed)) setDirectValueA(item.schema.id, parsed);
                          }}
                          className="w-14 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-emerald-400 font-bold">B 값 (Hex):</span>
                        <input
                          type="text"
                          value={item.valB.toString(16).toUpperCase()}
                          onChange={(e) => {
                            const parsed = parseInt(e.target.value, 16);
                            if (!isNaN(parsed)) setDirectValueB(item.schema.id, parsed);
                          }}
                          className="w-14 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveExpandedReg(isExpanded ? null : item.schema.id)}
                      className="text-xs font-medium text-slate-400 hover:text-slate-200 underline underline-offset-4"
                    >
                      {isExpanded ? '상세 비트 명세서 닫기' : '상세 비트 명세서 보기'}
                    </button>
                  </div>

                  {/* Expanded bit descriptions */}
                  {isExpanded && (
                    <div className="mt-3 p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-xs font-bold text-slate-300 block">비트별 기능 명세 (Datasheet Spec)</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {item.bitChanges.map((b) => (
                          <div
                            key={b.index}
                            className={`p-2 rounded-lg border ${
                              b.changeType === 'set'
                                ? 'bg-emerald-950/20 border-emerald-500/30'
                                : b.changeType === 'cleared'
                                ? 'bg-rose-950/20 border-rose-500/30'
                                : 'bg-slate-950 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-white">
                                Bit {b.index}: {b.infoA.name}
                                {b.nameDiff && ` (B: ${b.infoB.name})`}
                              </span>
                              <span className="font-mono text-[11px] text-slate-400">
                                {b.valA} → {b.valB}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">{b.infoA.desc || '비트 설명 없음'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* C Code Generation Output Box */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-slate-900/80 p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white">
              C/C++ 레지스터 델타 마이그레이션 펌웨어 코드 (Delta Transition Patch)
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
                <Copy className="w-3.5 h-3.5" /> 코드 복사
              </>
            )}
          </button>
        </div>

        <pre className="p-4 font-mono text-xs text-cyan-300/90 overflow-x-auto leading-relaxed bg-slate-950/90">
          {migrationCode}
        </pre>
      </div>
    </div>
  );
};
