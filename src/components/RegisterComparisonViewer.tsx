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
  ExternalLink,
  Zap,
  ShieldAlert,
  Flame
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export interface McuBitInfo {
  index: number;
  name: string;
  desc: string;
  isReserved?: boolean;
}

export interface McuRegisterProfile {
  regName: string;
  ioAddr: string;
  memAddr: string;
  isExtendedIo: boolean; // > 0x3F
  defaultVal: number;
  bits: McuBitInfo[];
  notes?: string;
}

export interface RegisterComparisonItem {
  id: string;
  category: 'timer' | 'usart' | 'adc' | 'comm' | 'interrupt' | 'system';
  categoryLabel: string;
  title: string;
  description: string;
  // Per MCU register info
  mcus: Partial<Record<SupportedMCU, McuRegisterProfile>>;
  // Porting notes between common pairings
  portingNotes?: {
    from: string;
    to: string;
    note: string;
    severity: 'critical' | 'warning' | 'info';
  }[];
}

// Master Comparison Database covering ATmega328P, ATmega128, ATmega640, ATmega2560
const REGISTER_COMPARISON_DB: RegisterComparisonItem[] = [
  // 1. Timer0 Control Register A
  {
    id: 'TCCR0A',
    category: 'timer',
    categoryLabel: '8비트 타이머0',
    title: 'Timer/Counter0 Control Register A (파형 생성 WGM 및 비교 출력 COM)',
    description: '타이머0의 카운팅 모드(Normal, CTC, Fast PWM, Phase Correct) 및 OC0A/OC0B 출력 핀 동작 제어',
    mcus: {
      atmega328p: {
        regName: 'TCCR0A',
        ioAddr: '0x24',
        memAddr: '0x44',
        isExtendedIo: false,
        defaultVal: 0x00,
        notes: 'WGM00 및 WGM01 비트가 여기에 있고 WGM02는 TCCR0B에 위치함.',
        bits: [
          { index: 7, name: 'COM0A1', desc: 'OC0A 비교 일치 출력 모드 비트 1' },
          { index: 6, name: 'COM0A0', desc: 'OC0A 비교 일치 출력 모드 비트 0' },
          { index: 5, name: 'COM0B1', desc: 'OC0B 비교 일치 출력 모드 비트 1' },
          { index: 4, name: 'COM0B0', desc: 'OC0B 비교 일치 출력 모드 비트 0' },
          { index: 3, name: 'Reserved', desc: '예약 비트 (항상 0)', isReserved: true },
          { index: 2, name: 'Reserved', desc: '예약 비트 (항상 0)', isReserved: true },
          { index: 1, name: 'WGM01', desc: '파형 생성 모드 비트 1' },
          { index: 0, name: 'WGM00', desc: '파형 생성 모드 비트 0' },
        ],
      },
      atmega128: {
        regName: 'TCCR0',
        ioAddr: '0x33',
        memAddr: '0x53',
        isExtendedIo: false,
        defaultVal: 0x00,
        notes: 'ATmega128의 Timer0은 단일 레지스터(TCCR0)로 제어되며 TCCR0A/B로 분리되어 있지 않습니다! COM01:00, WGM01:00, CS02:00이 한 레지스터에 통합되어 있습니다.',
        bits: [
          { index: 7, name: 'FOC0', desc: '강제 비교 일치 (Force Output Compare)' },
          { index: 6, name: 'WGM00', desc: '파형 생성 모드 비트 0' },
          { index: 5, name: 'COM01', desc: 'OC0 비교 일치 출력 모드 비트 1' },
          { index: 4, name: 'COM00', desc: 'OC0 비교 일치 출력 모드 비트 0' },
          { index: 3, name: 'WGM01', desc: '파형 생성 모드 비트 1' },
          { index: 2, name: 'CS02', desc: '클럭 분주비 선택 비트 2' },
          { index: 1, name: 'CS01', desc: '클럭 분주비 선택 비트 1' },
          { index: 0, name: 'CS00', desc: '클럭 분주비 선택 비트 0' },
        ],
      },
      atmega640: {
        regName: 'TCCR0A',
        ioAddr: '0x24',
        memAddr: '0x44',
        isExtendedIo: false,
        defaultVal: 0x00,
        notes: 'ATmega328P/2560과 동일한 TCCR0A 비트 레이아웃 (COM0A, COM0B, WGM01:00).',
        bits: [
          { index: 7, name: 'COM0A1', desc: 'OC0A 비교 일치 출력 모드 비트 1' },
          { index: 6, name: 'COM0A0', desc: 'OC0A 비교 일치 출력 모드 비트 0' },
          { index: 5, name: 'COM0B1', desc: 'OC0B 비교 일치 출력 모드 비트 1' },
          { index: 4, name: 'COM0B0', desc: 'OC0B 비교 일치 출력 모드 비트 0' },
          { index: 3, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 2, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 1, name: 'WGM01', desc: '파형 생성 모드 비트 1' },
          { index: 0, name: 'WGM00', desc: '파형 생성 모드 비트 0' },
        ],
      },
      atmega2560: {
        regName: 'TCCR0A',
        ioAddr: '0x24',
        memAddr: '0x44',
        isExtendedIo: false,
        defaultVal: 0x00,
        notes: 'ATmega328P와 완벽히 호환되는 8비트 Timer0 A 컨트롤러 구조.',
        bits: [
          { index: 7, name: 'COM0A1', desc: 'OC0A 비교 일치 출력 모드 비트 1' },
          { index: 6, name: 'COM0A0', desc: 'OC0A 비교 일치 출력 모드 비트 0' },
          { index: 5, name: 'COM0B1', desc: 'OC0B 비교 일치 출력 모드 비트 1' },
          { index: 4, name: 'COM0B0', desc: 'OC0B 비교 일치 출력 모드 비트 0' },
          { index: 3, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 2, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 1, name: 'WGM01', desc: '파형 생성 모드 비트 1' },
          { index: 0, name: 'WGM00', desc: '파형 생성 모드 비트 0' },
        ],
      },
    },
    portingNotes: [
      {
        from: 'atmega328p',
        to: 'atmega128',
        severity: 'critical',
        note: '치명적 차이: ATmega128에는 TCCR0A와 TCCR0B가 존재하지 않고 단일 TCCR0 레지스터를 사용합니다! TCCR0A = ... 코드는 컴파일 에러를 발생시키며, 비트 위치도 전혀 다릅니다(WGM00이 bit 6, COM01이 bit 5).',
      },
      {
        from: 'atmega328p',
        to: 'atmega2560',
        severity: 'info',
        note: 'TCCR0A 비트 구조 및 메모리 주소(0x44)가 100% 바이너리 호환됩니다.',
      },
    ],
  },

  // 2. Timer Interrupt Mask Register
  {
    id: 'TIMSK0',
    category: 'timer',
    categoryLabel: '타이머 인터럽트',
    title: 'Timer/Counter Interrupt Mask Register (TIMSK / TIMSK0)',
    description: '타이머 오버플로우(TOIE), 비교 일치(OCIEA/OCIEB) 인터럽트 활성화 비트 마스크',
    mcus: {
      atmega328p: {
        regName: 'TIMSK0',
        ioAddr: '—',
        memAddr: '0x6E',
        isExtendedIo: true,
        defaultVal: 0x00,
        notes: '확장 I/O 영역(0x6E)에 위치하여 IN/OUT 대신 LDS/STS 명령어를 사용합니다.',
        bits: [
          { index: 7, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 6, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 5, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 4, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 3, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 2, name: 'OCIE0B', desc: 'Timer0 출력 비교 B 일치 인터럽트 인에이블' },
          { index: 1, name: 'OCIE0A', desc: 'Timer0 출력 비교 A 일치 인터럽트 인에이블' },
          { index: 0, name: 'TOIE0', desc: 'Timer0 오버플로우 인터럽트 인에이블' },
        ],
      },
      atmega128: {
        regName: 'TIMSK',
        ioAddr: '0x37',
        memAddr: '0x57',
        isExtendedIo: false,
        defaultVal: 0x00,
        notes: 'ATmega128은 모든 타이머 인터럽트(Timer0, Timer1, Timer2)가 단일 TIMSK 레지스터(0x57)에 공유되어 있습니다! Timer0 오버플로우는 Bit 0, 비교 일치는 Bit 1(OCIE0)입니다.',
        bits: [
          { index: 7, name: 'OCIE2', desc: 'Timer2 출력 비교 인터럽트 인에이블' },
          { index: 6, name: 'TOIE2', desc: 'Timer2 오버플로우 인터럽트 인에이블' },
          { index: 5, name: 'TICIE1', desc: 'Timer1 입력 캡처 인터럽트 인에이블' },
          { index: 4, name: 'OCIE1A', desc: 'Timer1 출력 비교 A 인터럽트 인에이블' },
          { index: 3, name: 'OCIE1B', desc: 'Timer1 출력 비교 B 인터럽트 인에이블' },
          { index: 2, name: 'TOIE1', desc: 'Timer1 오버플로우 인터럽트 인에이블' },
          { index: 1, name: 'OCIE0', desc: 'Timer0 출력 비교 인터럽트 인에이블' },
          { index: 0, name: 'TOIE0', desc: 'Timer0 오버플로우 인터럽트 인에이블' },
        ],
      },
      atmega640: {
        regName: 'TIMSK0',
        ioAddr: '—',
        memAddr: '0x6E',
        isExtendedIo: true,
        defaultVal: 0x00,
        notes: 'Timer0 전용 독립 인터럽트 마스크 레지스터.',
        bits: [
          { index: 7, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 6, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 5, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 4, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 3, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 2, name: 'OCIE0B', desc: 'Timer0 출력 비교 B 인터럽트 인에이블' },
          { index: 1, name: 'OCIE0A', desc: 'Timer0 출력 비교 A 인터럽트 인에이블' },
          { index: 0, name: 'TOIE0', desc: 'Timer0 오버플로우 인터럽트 인에이블' },
        ],
      },
      atmega2560: {
        regName: 'TIMSK0',
        ioAddr: '—',
        memAddr: '0x6E',
        isExtendedIo: true,
        defaultVal: 0x00,
        notes: 'ATmega328P와 동일하게 0x6E에 위치하는 Timer0 독립 마스크 레지스터.',
        bits: [
          { index: 7, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 6, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 5, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 4, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 3, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 2, name: 'OCIE0B', desc: 'Timer0 출력 비교 B 인터럽트 인에이블' },
          { index: 1, name: 'OCIE0A', desc: 'Timer0 출력 비교 A 인터럽트 인에이블' },
          { index: 0, name: 'TOIE0', desc: 'Timer0 오버플로우 인터럽트 인에이블' },
        ],
      },
    },
    portingNotes: [
      {
        from: 'atmega328p',
        to: 'atmega128',
        severity: 'critical',
        note: '레지스터명 불일치: ATmega328P의 TIMSK0이 ATmega128에서는 TIMSK입니다. 또한 ATmega328P는 0x6E(확장 I/O)이지만 ATmega128은 0x57(표준 I/O)이므로 어셈블리/바이너리 명령어가 IN/OUT vs LDS/STS로 상이합니다.',
      },
    ],
  },

  // 3. USART Control & Status Register B
  {
    id: 'UCSR0B',
    category: 'usart',
    categoryLabel: 'USART0 시리얼',
    title: 'USART Control & Status Register B (RXEN, TXEN, RXCIE, UDRIE)',
    description: '수신/송신 모듈 인에이블 및 각 송수신 인터럽트 허용 플래그 제어',
    mcus: {
      atmega328p: {
        regName: 'UCSR0B',
        ioAddr: '—',
        memAddr: '0xC1',
        isExtendedIo: true,
        defaultVal: 0x00,
        notes: '확장 I/O 영역(0xC1)에 위치. RXCIE0, TXCIE0, UDRIE0, RXEN0, TXEN0, UCSZ02 등.',
        bits: [
          { index: 7, name: 'RXCIE0', desc: 'RX 수신 완료 인터럽트 인에이블' },
          { index: 6, name: 'TXCIE0', desc: 'TX 송신 완료 인터럽트 인에이블' },
          { index: 5, name: 'UDRIE0', desc: 'USART 데이터 레지스터 비움 인터럽트 인에이블' },
          { index: 4, name: 'RXEN0', desc: '수신 모듈 활성화 (RX 인에이블)' },
          { index: 3, name: 'TXEN0', desc: '송신 모듈 활성화 (TX 인에이블)' },
          { index: 2, name: 'UCSZ02', desc: '문자 크기 선택 비트 2 (UCSR0C와 조합)' },
          { index: 1, name: 'RXB80', desc: '수신 9번째 데이터 비트' },
          { index: 0, name: 'TXB80', desc: '송신 9번째 데이터 비트' },
        ],
      },
      atmega128: {
        regName: 'UCSR0B',
        ioAddr: '—',
        memAddr: '0x9A',
        isExtendedIo: true,
        defaultVal: 0x00,
        notes: 'ATmega128에서 UCSR0B는 메모리 주소 0x9A에 위치하며, 비트 이름은 접미사 0이 붙지 않는 RXCIE, TXCIE, UDRIE, RXEN, TXEN 형태입니다.',
        bits: [
          { index: 7, name: 'RXCIE', desc: 'RX 수신 완료 인터럽트 인에이블' },
          { index: 6, name: 'TXCIE', desc: 'TX 송신 완료 인터럽트 인에이블' },
          { index: 5, name: 'UDRIE', desc: '데이터 레지스터 비움 인터럽트 인에이블' },
          { index: 4, name: 'RXEN', desc: '수신 모듈 활성화' },
          { index: 3, name: 'TXEN', desc: '송신 모듈 활성화' },
          { index: 2, name: 'UCSZ2', desc: '문자 크기 선택 비트 2' },
          { index: 1, name: 'RXB8', desc: '수신 9번째 데이터 비트' },
          { index: 0, name: 'TXB8', desc: '송신 9번째 데이터 비트' },
        ],
      },
      atmega640: {
        regName: 'UCSR0B',
        ioAddr: '—',
        memAddr: '0xC1',
        isExtendedIo: true,
        defaultVal: 0x00,
        notes: '주소 0xC1, ATmega328P 및 ATmega2560과 완전히 동일한 비트 명칭 및 포지션.',
        bits: [
          { index: 7, name: 'RXCIE0', desc: 'RX 수신 완료 인터럽트 인에이블' },
          { index: 6, name: 'TXCIE0', desc: 'TX 송신 완료 인터럽트 인에이블' },
          { index: 5, name: 'UDRIE0', desc: '데이터 레지스터 비움 인터럽트 인에이블' },
          { index: 4, name: 'RXEN0', desc: '수신 모듈 활성화' },
          { index: 3, name: 'TXEN0', desc: '송신 모듈 활성화' },
          { index: 2, name: 'UCSZ02', desc: '문자 크기 선택 비트 2' },
          { index: 1, name: 'RXB80', desc: '수신 9번째 데이터 비트' },
          { index: 0, name: 'TXB80', desc: '송신 9번째 데이터 비트' },
        ],
      },
      atmega2560: {
        regName: 'UCSR0B',
        ioAddr: '—',
        memAddr: '0xC1',
        isExtendedIo: true,
        defaultVal: 0x00,
        notes: 'ATmega328P와 비트 레이아웃 및 주소(0xC1)가 100% 동일함.',
        bits: [
          { index: 7, name: 'RXCIE0', desc: 'RX 수신 완료 인터럽트 인에이블' },
          { index: 6, name: 'TXCIE0', desc: 'TX 송신 완료 인터럽트 인에이블' },
          { index: 5, name: 'UDRIE0', desc: '데이터 레지스터 비움 인터럽트 인에이블' },
          { index: 4, name: 'RXEN0', desc: '수신 모듈 활성화' },
          { index: 3, name: 'TXEN0', desc: '송신 모듈 활성화' },
          { index: 2, name: 'UCSZ02', desc: '문자 크기 선택 비트 2' },
          { index: 1, name: 'RXB80', desc: '수신 9번째 데이터 비트' },
          { index: 0, name: 'TXB80', desc: '송신 9번째 데이터 비트' },
        ],
      },
    },
    portingNotes: [
      {
        from: 'atmega328p',
        to: 'atmega128',
        severity: 'warning',
        note: '비트명 매크로 차이: avr-libc 헤더에서 ATmega328P는 RXEN0, TXEN0을 사용하지만 ATmega128은 RXEN, TXEN(또는 RXEN0/TXEN0 매크로 호환)을 참조합니다. 메모리 주소도 0xC1 vs 0x9A로 다릅니다.',
      },
    ],
  },

  // 4. ADC Control and Status Register A
  {
    id: 'ADCSRA',
    category: 'adc',
    categoryLabel: 'ADC 아날로그',
    title: 'ADC Control and Status Register A (ADCSRA / ADCSR)',
    description: 'ADC 모듈 활성화(ADEN), 변환 시작(ADSC), 자동 트리거(ADATE), 프리스케일러(ADPS2:0)',
    mcus: {
      atmega328p: {
        regName: 'ADCSRA',
        ioAddr: '—',
        memAddr: '0x7A',
        isExtendedIo: true,
        defaultVal: 0x00,
        notes: '확장 I/O 0x7A. ADEN, ADSC, ADATE, ADIF, ADIE, ADPS[2:0].',
        bits: [
          { index: 7, name: 'ADEN', desc: 'ADC 인에이블 (아날로그 컨버터 전원 켬)' },
          { index: 6, name: 'ADSC', desc: 'ADC 변환 시작 (Start Conversion)' },
          { index: 5, name: 'ADATE', desc: 'ADC 자동 트리거 인에이블 (Auto Trigger)' },
          { index: 4, name: 'ADIF', desc: 'ADC 인터럽트 플래그 (변환 완료 시 세트)' },
          { index: 3, name: 'ADIE', desc: 'ADC 인터럽트 인에이블' },
          { index: 2, name: 'ADPS2', desc: 'ADC 클럭 프리스케일러 선택 비트 2' },
          { index: 1, name: 'ADPS1', desc: 'ADC 클럭 프리스케일러 선택 비트 1' },
          { index: 0, name: 'ADPS0', desc: 'ADC 클럭 프리스케일러 선택 비트 0' },
        ],
      },
      atmega128: {
        regName: 'ADCSRA',
        ioAddr: '0x06',
        memAddr: '0x26',
        isExtendedIo: false,
        defaultVal: 0x00,
        notes: 'ATmega128에서는 표준 하위 I/O 영역(0x06, mem 0x26)에 위치하여 고속 IN/OUT 및 SBI/CBI 명령어로 1클럭 제어가 가능합니다! 비트 5는 ADFR(Free Running) 또는 ADATE 호환.',
        bits: [
          { index: 7, name: 'ADEN', desc: 'ADC 인에이블' },
          { index: 6, name: 'ADSC', desc: 'ADC 변환 시작' },
          { index: 5, name: 'ADFR', desc: 'ADC 프리 러닝 모드 선택 (또는 ADATE)' },
          { index: 4, name: 'ADIF', desc: 'ADC 인터럽트 플래그' },
          { index: 3, name: 'ADIE', desc: 'ADC 인터럽트 인에이블' },
          { index: 2, name: 'ADPS2', desc: 'ADC 프리스케일러 비트 2' },
          { index: 1, name: 'ADPS1', desc: 'ADC 프리스케일러 비트 1' },
          { index: 0, name: 'ADPS0', desc: 'ADC 프리스케일러 비트 0' },
        ],
      },
      atmega640: {
        regName: 'ADCSRA',
        ioAddr: '—',
        memAddr: '0x7A',
        isExtendedIo: true,
        defaultVal: 0x00,
        notes: '주소 0x7A, ATmega328P/2560과 동일.',
        bits: [
          { index: 7, name: 'ADEN', desc: 'ADC 인에이블' },
          { index: 6, name: 'ADSC', desc: 'ADC 변환 시작' },
          { index: 5, name: 'ADATE', desc: 'ADC 자동 트리거 인에이블' },
          { index: 4, name: 'ADIF', desc: 'ADC 인터럽트 플래그' },
          { index: 3, name: 'ADIE', desc: 'ADC 인터럽트 인에이블' },
          { index: 2, name: 'ADPS2', desc: 'ADC 프리스케일러 비트 2' },
          { index: 1, name: 'ADPS1', desc: 'ADC 프리스케일러 비트 1' },
          { index: 0, name: 'ADPS0', desc: 'ADC 프리스케일러 비트 0' },
        ],
      },
      atmega2560: {
        regName: 'ADCSRA',
        ioAddr: '—',
        memAddr: '0x7A',
        isExtendedIo: true,
        defaultVal: 0x00,
        notes: '주소 0x7A, 16채널 ADC 제어용 표준 ADCSRA.',
        bits: [
          { index: 7, name: 'ADEN', desc: 'ADC 인에이블' },
          { index: 6, name: 'ADSC', desc: 'ADC 변환 시작' },
          { index: 5, name: 'ADATE', desc: 'ADC 자동 트리거 인에이블' },
          { index: 4, name: 'ADIF', desc: 'ADC 인터럽트 플래그' },
          { index: 3, name: 'ADIE', desc: 'ADC 인터럽트 인에이블' },
          { index: 2, name: 'ADPS2', desc: 'ADC 프리스케일러 비트 2' },
          { index: 1, name: 'ADPS1', desc: 'ADC 프리스케일러 비트 1' },
          { index: 0, name: 'ADPS0', desc: 'ADC 프리스케일러 비트 0' },
        ],
      },
    },
    portingNotes: [
      {
        from: 'atmega328p',
        to: 'atmega128',
        severity: 'warning',
        note: 'I/O 주소 차이: ATmega328P는 0x7A(확장 I/O)이므로 SBI/CBI 단일 비트 조작 명령이 불가능하지만, ATmega128은 0x06(하위 I/O)에 위치하여 sbi(ADCSRA, ADSC)와 같은 1클럭 하드웨어 제어가 가능합니다.',
      },
    ],
  },

  // 5. TWI (I2C) Control Register
  {
    id: 'TWCR',
    category: 'comm',
    categoryLabel: 'TWI / I2C 버스',
    title: 'TWI Control Register (TWINT, TWEA, TWSTA, TWSTO, TWEN)',
    description: '2선식 직렬 인터페이스 START/STOP 조건 생성 및 인터럽트 플래그 클리어',
    mcus: {
      atmega328p: {
        regName: 'TWCR',
        ioAddr: '—',
        memAddr: '0xBC',
        isExtendedIo: true,
        defaultVal: 0x00,
        notes: '메모리 주소 0xBC.',
        bits: [
          { index: 7, name: 'TWINT', desc: 'TWI 인터럽트 플래그 (1을 써서 클리어)' },
          { index: 6, name: 'TWEA', desc: 'TWI ACK 응답 인에이블' },
          { index: 5, name: 'TWSTA', desc: 'TWI START 조건 생성 비트' },
          { index: 4, name: 'TWSTO', desc: 'TWI STOP 조건 생성 비트' },
          { index: 3, name: 'TWWC', desc: 'TWI 쓰기 충돌 플래그' },
          { index: 2, name: 'TWEN', desc: 'TWI 하드웨어 모듈 인에이블' },
          { index: 1, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 0, name: 'TWIE', desc: 'TWI 인터럽트 인에이블' },
        ],
      },
      atmega128: {
        regName: 'TWCR',
        ioAddr: '0x36',
        memAddr: '0x56',
        isExtendedIo: false,
        defaultVal: 0x00,
        notes: 'ATmega128은 TWCR이 I/O 주소 0x36 (메모리 0x56)에 위치하여 표준 I/O 공간에 속합니다.',
        bits: [
          { index: 7, name: 'TWINT', desc: 'TWI 인터럽트 플래그' },
          { index: 6, name: 'TWEA', desc: 'TWI ACK 응답 인에이블' },
          { index: 5, name: 'TWSTA', desc: 'TWI START 조건 생성 비트' },
          { index: 4, name: 'TWSTO', desc: 'TWI STOP 조건 생성 비트' },
          { index: 3, name: 'TWWC', desc: 'TWI 쓰기 충돌 플래그' },
          { index: 2, name: 'TWEN', desc: 'TWI 모듈 인에이블' },
          { index: 1, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 0, name: 'TWIE', desc: 'TWI 인터럽트 인에이블' },
        ],
      },
      atmega640: {
        regName: 'TWCR',
        ioAddr: '—',
        memAddr: '0xBC',
        isExtendedIo: true,
        defaultVal: 0x00,
        notes: '주소 0xBC.',
        bits: [
          { index: 7, name: 'TWINT', desc: 'TWI 인터럽트 플래그' },
          { index: 6, name: 'TWEA', desc: 'TWI ACK 응답 인에이블' },
          { index: 5, name: 'TWSTA', desc: 'TWI START 조건 생성' },
          { index: 4, name: 'TWSTO', desc: 'TWI STOP 조건 생성' },
          { index: 3, name: 'TWWC', desc: 'TWI 쓰기 충돌 플래그' },
          { index: 2, name: 'TWEN', desc: 'TWI 모듈 인에이블' },
          { index: 1, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 0, name: 'TWIE', desc: 'TWI 인터럽트 인에이블' },
        ],
      },
      atmega2560: {
        regName: 'TWCR',
        ioAddr: '—',
        memAddr: '0xBC',
        isExtendedIo: true,
        defaultVal: 0x00,
        notes: '주소 0xBC, 328P와 동일.',
        bits: [
          { index: 7, name: 'TWINT', desc: 'TWI 인터럽트 플래그' },
          { index: 6, name: 'TWEA', desc: 'TWI ACK 응답 인에이블' },
          { index: 5, name: 'TWSTA', desc: 'TWI START 조건 생성' },
          { index: 4, name: 'TWSTO', desc: 'TWI STOP 조건 생성' },
          { index: 3, name: 'TWWC', desc: 'TWI 쓰기 충돌 플래그' },
          { index: 2, name: 'TWEN', desc: 'TWI 모듈 인에이블' },
          { index: 1, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 0, name: 'TWIE', desc: 'TWI 인터럽트 인에이블' },
        ],
      },
    },
    portingNotes: [
      {
        from: 'atmega328p',
        to: 'atmega128',
        severity: 'info',
        note: '모든 비트의 기능 및 배치가 동일하나 메모리 매핑 주소(0xBC vs 0x56)가 다릅니다.',
      },
    ],
  },

  // 6. External Interrupt Control Register A
  {
    id: 'EICRA',
    category: 'interrupt',
    categoryLabel: '외부 인터럽트',
    title: 'External Interrupt Control Register A (EICRA / MCUCR)',
    description: 'INT0~INT3 핀의 신호 에지 감지 모드 (Low Level, Any Edge, Falling, Rising)',
    mcus: {
      atmega328p: {
        regName: 'EICRA',
        ioAddr: '—',
        memAddr: '0x69',
        isExtendedIo: true,
        defaultVal: 0x00,
        notes: 'INT0(ISC01:00) 및 INT1(ISC11:10) 감지 조건 설정.',
        bits: [
          { index: 7, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 6, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 5, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 4, name: 'Reserved', desc: '예약 비트', isReserved: true },
          { index: 3, name: 'ISC11', desc: 'INT1 감지 센스 비트 1' },
          { index: 2, name: 'ISC10', desc: 'INT1 감지 센스 비트 0' },
          { index: 1, name: 'ISC01', desc: 'INT0 감지 센스 비트 1' },
          { index: 0, name: 'ISC00', desc: 'INT0 감지 센스 비트 0' },
        ],
      },
      atmega128: {
        regName: 'EICRA',
        ioAddr: '—',
        memAddr: '0x6A',
        isExtendedIo: true,
        defaultVal: 0x00,
        notes: 'ATmega128은 EICRA가 4개의 외부 인터럽트(INT3, INT2, INT1, INT0)의 센스 제어 비트로 8비트가 꽉 차 있습니다! ISC31:30, ISC21:20, ISC11:10, ISC01:00.',
        bits: [
          { index: 7, name: 'ISC31', desc: 'INT3 센스 비트 1' },
          { index: 6, name: 'ISC30', desc: 'INT3 센스 비트 0' },
          { index: 5, name: 'ISC21', desc: 'INT2 센스 비트 1' },
          { index: 4, name: 'ISC20', desc: 'INT2 센스 비트 0' },
          { index: 3, name: 'ISC11', desc: 'INT1 센스 비트 1' },
          { index: 2, name: 'ISC10', desc: 'INT1 센스 비트 0' },
          { index: 1, name: 'ISC01', desc: 'INT0 센스 비트 1' },
          { index: 0, name: 'ISC00', desc: 'INT0 센스 비트 0' },
        ],
      },
      atmega640: {
        regName: 'EICRA',
        ioAddr: '—',
        memAddr: '0x69',
        isExtendedIo: true,
        defaultVal: 0x00,
        notes: 'INT0~INT3 4채널 지원.',
        bits: [
          { index: 7, name: 'ISC31', desc: 'INT3 센스 비트 1' },
          { index: 6, name: 'ISC30', desc: 'INT3 센스 비트 0' },
          { index: 5, name: 'ISC21', desc: 'INT2 센스 비트 1' },
          { index: 4, name: 'ISC20', desc: 'INT2 센스 비트 0' },
          { index: 3, name: 'ISC11', desc: 'INT1 센스 비트 1' },
          { index: 2, name: 'ISC10', desc: 'INT1 센스 비트 0' },
          { index: 1, name: 'ISC01', desc: 'INT0 센스 비트 1' },
          { index: 0, name: 'ISC00', desc: 'INT0 센스 비트 0' },
        ],
      },
      atmega2560: {
        regName: 'EICRA',
        ioAddr: '—',
        memAddr: '0x69',
        isExtendedIo: true,
        defaultVal: 0x00,
        notes: 'INT0~INT3 4채널 지원 (상위 INT4~INT7은 EICRB에서 제어).',
        bits: [
          { index: 7, name: 'ISC31', desc: 'INT3 센스 비트 1' },
          { index: 6, name: 'ISC30', desc: 'INT3 센스 비트 0' },
          { index: 5, name: 'ISC21', desc: 'INT2 센스 비트 1' },
          { index: 4, name: 'ISC20', desc: 'INT2 센스 비트 0' },
          { index: 3, name: 'ISC11', desc: 'INT1 센스 비트 1' },
          { index: 2, name: 'ISC10', desc: 'INT1 센스 비트 0' },
          { index: 1, name: 'ISC01', desc: 'INT0 센스 비트 1' },
          { index: 0, name: 'ISC00', desc: 'INT0 센스 비트 0' },
        ],
      },
    },
    portingNotes: [
      {
        from: 'atmega328p',
        to: 'atmega2560',
        severity: 'warning',
        note: 'ATmega328P는 EICRA의 상위 4비트가 Reserved이지만, ATmega2560/128에서는 INT2와 INT3의 감지 비트(ISC2, ISC3)로 사용됩니다. 0xFF나 상위 비트를 실수로 덮어쓰면 INT2/INT3 설정이 변경될 수 있습니다.',
      },
    ],
  },
];

// Presets for rapid side-by-side demonstration
interface ComparisonPreset {
  id: string;
  name: string;
  mcuA: SupportedMCU;
  mcuB: SupportedMCU;
  registerId: string;
  valA: number;
  valB: number;
  description: string;
}

const COMPARISON_PRESETS: ComparisonPreset[] = [
  {
    id: 'preset_timer0_pwm',
    name: '타이머0 Fast PWM 모드: ATmega328P ↔ ATmega128',
    mcuA: 'atmega328p',
    mcuB: 'atmega128',
    registerId: 'TCCR0A',
    valA: 0b10000011, // TCCR0A = 0x83 (COM0A1=1, WGM01:00=3)
    valB: 0b01101001, // TCCR0 = 0x69 (FOC0=0, WGM00=1, COM01=1, COM00=0, WGM01=1, CS02:00=1)
    description: 'ATmega328P의 분리형 TCCR0A/B와 ATmega128의 단일 통합형 TCCR0 레지스터의 구조적 불일치 및 비트 맵핑 차이를 극명하게 비교합니다.',
  },
  {
    id: 'preset_usart_rx_int',
    name: 'USART 115200 8N1 인터럽트: ATmega328P ↔ ATmega2560',
    mcuA: 'atmega328p',
    mcuB: 'atmega2560',
    registerId: 'UCSR0B',
    valA: 0b10011000, // RXCIE0=1, RXEN0=1, TXEN0=1 (0x98)
    valB: 0b10011000, // 0x98 (완벽 호환)
    description: 'ATmega328P와 ATmega2560의 USART0 제어 레지스터는 비트 정의 및 기능이 100% 동일하게 호환됩니다.',
  },
  {
    id: 'preset_timsk_overflow',
    name: '타이머 오버플로우 인터럽트: ATmega328P ↔ ATmega128',
    mcuA: 'atmega328p',
    mcuB: 'atmega128',
    registerId: 'TIMSK0',
    valA: 0b00000001, // TIMSK0 = 0x01 (TOIE0)
    valB: 0b00000001, // TIMSK = 0x01 (TOIE0)
    description: '값 자체는 0x01로 동일하지만, ATmega128은 상위 비트에 Timer1, Timer2 인터럽트가 공존하므로 비트 마스킹(|=, &=)에 각별한 주의가 필요합니다.',
  },
  {
    id: 'preset_eicra_edge',
    name: '외부 인터럽트 INT0/INT1 Rising Edge: ATmega328P ↔ ATmega2560',
    mcuA: 'atmega328p',
    mcuB: 'atmega2560',
    registerId: 'EICRA',
    valA: 0b00001111, // INT1 Rising(11), INT0 Rising(11)
    valB: 0b00001111, // 상위 4비트는 0 (INT2, INT3 미설정)
    description: 'ATmega2560은 상위 4비트(Bit 7:4)가 INT3, INT2용이므로 ATmega328P 코드를 포팅할 때 상위 비트를 클리어하거나 보존해야 합니다.',
  },
];

export const RegisterComparisonViewer: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  // MCU Pair selection
  const [mcuA, setMcuA] = useState<SupportedMCU>(selectedMCU);
  const [mcuB, setMcuB] = useState<SupportedMCU>(
    selectedMCU === 'atmega328p' ? 'atmega128' : 'atmega328p'
  );

  // Selected register ID from database
  const [selectedRegId, setSelectedRegId] = useState<string>('TCCR0A');

  // Runtime bit states for MCU A and MCU B
  const [valA, setValA] = useState<number>(0b10000011);
  const [valB, setValB] = useState<number>(0b01101001);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [copiedCodeType, setCopiedCodeType] = useState<string | null>(null);

  // Sync MCU A if prop changes
  React.useEffect(() => {
    if (mcuA !== selectedMCU) {
      setMcuA(selectedMCU);
      if (mcuB === selectedMCU) {
        setMcuB(selectedMCU === 'atmega328p' ? 'atmega128' : 'atmega328p');
      }
    }
  }, [selectedMCU]);

  // Current active register spec
  const currentRegSpec = useMemo(() => {
    return REGISTER_COMPARISON_DB.find((r) => r.id === selectedRegId) || REGISTER_COMPARISON_DB[0];
  }, [selectedRegId]);

  // MCU Profiles
  const profileA = MCU_PROFILES[mcuA];
  const profileB = MCU_PROFILES[mcuB];

  const regInfoA = currentRegSpec.mcus[mcuA];
  const regInfoB = currentRegSpec.mcus[mcuB];

  // Bit-by-bit XOR difference calculation
  const xorDiff = useMemo(() => (valA ^ valB) & 0xff, [valA, valB]);

  // Diff bit count
  const diffBitCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 8; i++) {
      if ((xorDiff & (1 << i)) !== 0) count++;
    }
    return count;
  }, [xorDiff]);

  // Bit toggle handler
  const toggleBitA = (bitIdx: number) => {
    setValA((prev) => prev ^ (1 << bitIdx));
  };

  const toggleBitB = (bitIdx: number) => {
    setValB((prev) => prev ^ (1 << bitIdx));
  };

  // Swap MCUs
  const handleSwapMcus = () => {
    const tempMcu = mcuA;
    const tempVal = valA;
    setMcuA(mcuB);
    setMcuB(tempMcu);
    setValA(valB);
    setValB(tempVal);
    if (onSelectMCU) onSelectMCU(mcuB);
  };

  // Apply Preset
  const handleApplyPreset = (preset: ComparisonPreset) => {
    setMcuA(preset.mcuA);
    setMcuB(preset.mcuB);
    setSelectedRegId(preset.registerId);
    setValA(preset.valA);
    setValB(preset.valB);
    if (onSelectMCU) onSelectMCU(preset.mcuA);
  };

  // Sync A to B / B to A
  const syncAtoB = () => setValB(valA);
  const syncBtoA = () => setValA(valB);

  // Copy code helper
  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeType(type);
    setTimeout(() => setCopiedCodeType(null), 2000);
  };

  // Filtered registers
  const filteredRegs = useMemo(() => {
    return REGISTER_COMPARISON_DB.filter((r) => {
      const matchCat = categoryFilter === 'all' || r.category === categoryFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [categoryFilter, searchQuery]);

  // Check porting alerts between current pair
  const currentPortingNote = useMemo(() => {
    if (!currentRegSpec.portingNotes) return null;
    return (
      currentRegSpec.portingNotes.find(
        (pn) =>
          (pn.from === mcuA && pn.to === mcuB) ||
          (pn.from === mcuB && pn.to === mcuA)
      ) || null
    );
  }, [currentRegSpec, mcuA, mcuB]);

  // Generate Portable C/C++ Code Snippet
  const portableCodeSnippet = useMemo(() => {
    const regNameA = regInfoA ? regInfoA.regName : '/* Unmapped */';
    const regNameB = regInfoB ? regInfoB.regName : '/* Unmapped */';
    const hexA = `0x${valA.toString(16).toUpperCase().padStart(2, '0')}`;
    const hexB = `0x${valB.toString(16).toUpperCase().padStart(2, '0')}`;

    return `// ============================================================================
// Cross-MCU Portable Register Configuration Snippet
// Target Pair: ${profileA.name} <---> ${profileB.name}
// Register Focus: ${currentRegSpec.id}
// ============================================================================
#include <avr/io.h>

void init_peripheral_${currentRegSpec.id.toLowerCase()}(void) {
#if defined(__AVR_${profileA.name.toUpperCase()}__)
    // [${profileA.name}] ${regNameA} = ${hexA} (0b${valA.toString(2).padStart(8, '0')})
    // Memory Address: ${regInfoA?.memAddr || 'N/A'} (${regInfoA?.isExtendedIo ? 'Extended I/O: LDS/STS' : 'Standard I/O: IN/OUT'})
    ${regNameA} = ${hexA};

#elif defined(__AVR_${profileB.name.toUpperCase()}__)
    // [${profileB.name}] ${regNameB} = ${hexB} (0b${valB.toString(2).padStart(8, '0')})
    // Memory Address: ${regInfoB?.memAddr || 'N/A'} (${regInfoB?.isExtendedIo ? 'Extended I/O: LDS/STS' : 'Standard I/O: IN/OUT'})
    ${regNameB} = ${hexB};

#else
    #error "Unsupported AVR MCU model for ${currentRegSpec.id} initialization!"
#endif
}`;
  }, [profileA, profileB, regInfoA, regInfoB, currentRegSpec, valA, valB]);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
              <GitCompare className="w-5 h-5" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              레지스터 비교 뷰어
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono">
                Cross-MCU Register Diff Viewer
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
            두 개의 서로 다른 AVR MCU 모델을 나란히 배치하여 주변장치 레지스터의 비트 필드 구성(Bit-fields),
            메모리 매핑 주소(I/O Address), 그리고 런타임 비트 설정 상태(0/1)의 불일치를 실시간으로 시각화하고
            크로스-포팅 안전성을 검증합니다.
          </p>
        </div>

        {/* Quick Dual MCU Selector Controls */}
        <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800 shrink-0">
          {/* MCU Model A */}
          <div className="text-left">
            <span className="text-[10px] text-cyan-400 font-bold block px-1">MCU 모델 A</span>
            <select
              value={mcuA}
              onChange={(e) => {
                const nextMcu = e.target.value as SupportedMCU;
                setMcuA(nextMcu);
                if (onSelectMCU) onSelectMCU(nextMcu);
              }}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-bold text-white font-mono focus:outline-none focus:border-cyan-500"
            >
              <option value="atmega328p">ATmega328P</option>
              <option value="atmega128">ATmega128</option>
              <option value="atmega640">ATmega640</option>
              <option value="atmega2560">ATmega2560</option>
            </select>
          </div>

          {/* Swap Button */}
          <button
            onClick={handleSwapMcus}
            title="MCU A와 B 위치 교환 (Swap)"
            className="p-2 mt-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all"
          >
            <ArrowLeftRight className="w-4 h-4 text-cyan-400" />
          </button>

          {/* MCU Model B */}
          <div className="text-left">
            <span className="text-[10px] text-indigo-400 font-bold block px-1">MCU 모델 B</span>
            <select
              value={mcuB}
              onChange={(e) => setMcuB(e.target.value as SupportedMCU)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-bold text-white font-mono focus:outline-none focus:border-indigo-500"
            >
              <option value="atmega328p">ATmega328P</option>
              <option value="atmega128">ATmega128</option>
              <option value="atmega640">ATmega640</option>
              <option value="atmega2560">ATmega2560</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Preset Scenarios Quick Bar */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          대표적인 크로스-MCU 포팅 차이점 프리셋 시나리오
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {COMPARISON_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleApplyPreset(preset)}
              className={`p-2.5 rounded-lg text-left border transition-all text-xs flex flex-col justify-between ${
                selectedRegId === preset.registerId && mcuA === preset.mcuA && mcuB === preset.mcuB
                  ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="font-bold text-[11px] text-white line-clamp-1">{preset.name}</span>
              <span className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                {preset.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Register Selection Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {(
            [
              { id: 'all', label: '전체' },
              { id: 'timer', label: '타이머/카운터' },
              { id: 'usart', label: 'USART 시리얼' },
              { id: 'adc', label: 'ADC 아날로그' },
              { id: 'comm', label: '통신 (I2C/SPI)' },
              { id: 'interrupt', label: '외부 인터럽트' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all font-medium ${
                categoryFilter === cat.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="레지스터 검색 (TCCR, TIMSK, UCSR...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      </div>

      {/* Selected Register Tab Pill Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {filteredRegs.map((reg) => (
          <button
            key={reg.id}
            onClick={() => setSelectedRegId(reg.id)}
            className={`px-3 py-2 rounded-xl border text-xs font-mono font-bold transition-all shrink-0 flex items-center gap-2 ${
              selectedRegId === reg.id
                ? 'bg-gradient-to-r from-cyan-900/50 to-blue-900/50 border-cyan-500 text-cyan-300 shadow-md'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <span>{reg.id}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800/80 font-sans font-normal text-slate-400">
              {reg.categoryLabel}
            </span>
          </button>
        ))}
      </div>

      {/* Porting Alert Callout (If applicable for this register & pair) */}
      {currentPortingNote && (
        <div
          className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
            currentPortingNote.severity === 'critical'
              ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
              : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
          }`}
        >
          {currentPortingNote.severity === 'critical' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-0.5">
            <span className="font-bold">
              {currentPortingNote.severity === 'critical'
                ? '🚨 하드웨어 포팅 치명적 비호환 경고'
                : '⚠️ 크로스 MCU 포팅 유의사항'}
              :
            </span>
            <p className="text-slate-300">{currentPortingNote.note}</p>
          </div>
        </div>
      )}

      {/* 4. Side-by-Side Dual MCU Register Comparison Workstation */}
      <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-stretch">
        {/* LEFT: MCU Model A Panel */}
        <div className="lg:col-span-5 bg-slate-950/80 border border-cyan-500/30 rounded-2xl p-4 space-y-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-mono text-sm font-bold text-cyan-300">
                  {profileA.name} ({profileA.package})
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/50 font-mono">
                기준 모델 A
              </span>
            </div>

            {/* Register Specs & Memory Address */}
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
              <div>
                <span className="text-slate-500 block">레지스터 명칭:</span>
                <span className="font-mono font-bold text-white">
                  {regInfoA ? regInfoA.regName : '미지원 (Unmapped)'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">메모리 / I/O 주소:</span>
                <span className="font-mono text-cyan-300">
                  {regInfoA ? `${regInfoA.memAddr} (${regInfoA.ioAddr})` : '—'}
                </span>
              </div>
              <div className="col-span-2 text-[10px] text-slate-400">
                {regInfoA?.isExtendedIo ? (
                  <span className="text-amber-400 font-semibold">
                    ⚠️ 확장 I/O 공간: IN/OUT 사용 불가, LDS/STS 필수
                  </span>
                ) : (
                  <span className="text-emerald-400 font-semibold">
                    🛡️ 표준 I/O 공간: 1클럭 IN/OUT 및 SBI/CBI 지원
                  </span>
                )}
              </div>
            </div>

            {/* Current Value Preview */}
            <div className="flex items-center justify-between bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/40 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">현재 설정값 (Hex / Dec)</span>
                <span className="font-mono font-bold text-white text-sm">
                  0x{valA.toString(16).toUpperCase().padStart(2, '0')}{' '}
                  <span className="text-xs text-slate-400">({valA}d)</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-[10px] block">2진수 바이너리</span>
                <span className="font-mono text-cyan-300 font-bold">
                  0b{valA.toString(2).padStart(8, '0')}
                </span>
              </div>
            </div>

            {/* 8-Bit Interactive Switch Grid (Bit 7 down to 0) */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-300 block">
                8비트 비트필드 조작 (클릭하여 0/1 토글):
              </span>
              <div className="grid grid-cols-8 gap-1.5">
                {[7, 6, 5, 4, 3, 2, 1, 0].map((bitIdx) => {
                  const bitVal = (valA & (1 << bitIdx)) !== 0 ? 1 : 0;
                  const bitDef = regInfoA?.bits.find((b) => b.index === bitIdx);
                  const isDiffWithB = (xorDiff & (1 << bitIdx)) !== 0;

                  return (
                    <button
                      key={bitIdx}
                      onClick={() => toggleBitA(bitIdx)}
                      title={`${bitDef?.name || `Bit${bitIdx}`}: ${bitDef?.desc || ''}`}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-center ${
                        isDiffWithB
                          ? 'border-amber-400/80 shadow-md shadow-amber-950/40 ring-1 ring-amber-400/40'
                          : 'border-slate-800 hover:border-slate-700'
                      } ${
                        bitVal === 1
                          ? 'bg-cyan-500/20 text-cyan-200 font-bold'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      <span className="text-[9px] text-slate-400 font-mono">b{bitIdx}</span>
                      <span
                        className={`text-sm font-mono font-bold my-0.5 ${
                          bitVal === 1 ? 'text-cyan-300' : 'text-slate-500'
                        }`}
                      >
                        {bitVal}
                      </span>
                      <span className="text-[9px] font-mono font-bold truncate max-w-full text-slate-300">
                        {bitDef?.name || `b${bitIdx}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Hex Preset buttons for A */}
          <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-800/80">
            <span className="text-[10px] text-slate-500 font-mono">Quick Set:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setValA(0x00)}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-800"
              >
                0x00
              </button>
              <button
                onClick={() => setValA(0xff)}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-800"
              >
                0xFF
              </button>
              <button
                onClick={() => setValA((p) => ~p & 0xff)}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-800"
              >
                Invert (~A)
              </button>
            </div>
          </div>
        </div>

        {/* MIDDLE: Diff Engine & Comparison Metric Column */}
        <div className="lg:col-span-1 flex flex-col items-center justify-center p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
          <div className="text-center space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              비트 차이
            </span>
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center border font-mono font-bold text-lg ${
                diffBitCount > 0
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 animate-pulse'
                  : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
              }`}
            >
              {diffBitCount}
            </div>
            <span className="text-[9px] text-slate-400 block font-mono">
              {diffBitCount === 0 ? '완전 일치' : `${diffBitCount}개 불일치`}
            </span>
          </div>

          {/* XOR Diff Mask */}
          <div className="text-center w-full bg-slate-900/60 p-1.5 rounded-lg border border-slate-800/80">
            <span className="text-[9px] text-slate-500 block font-mono">XOR 마스크</span>
            <span className="text-[11px] font-mono font-bold text-amber-300">
              0x{xorDiff.toString(16).toUpperCase().padStart(2, '0')}
            </span>
          </div>

          {/* Sync actions */}
          <div className="flex flex-col gap-1.5 w-full">
            <button
              onClick={syncAtoB}
              title="A 설정값을 B로 동기화 복사"
              className="w-full py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-cyan-300 border border-slate-800 transition-all flex items-center justify-center gap-1"
            >
              A → B
            </button>
            <button
              onClick={syncBtoA}
              title="B 설정값을 A로 동기화 복사"
              className="w-full py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-indigo-300 border border-slate-800 transition-all flex items-center justify-center gap-1"
            >
              B → A
            </button>
          </div>
        </div>

        {/* RIGHT: MCU Model B Panel */}
        <div className="lg:col-span-5 bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-4 space-y-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
                <span className="font-mono text-sm font-bold text-indigo-300">
                  {profileB.name} ({profileB.package})
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 font-mono">
                비교 대상 B
              </span>
            </div>

            {/* Register Specs & Memory Address */}
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
              <div>
                <span className="text-slate-500 block">레지스터 명칭:</span>
                <span className="font-mono font-bold text-white">
                  {regInfoB ? regInfoB.regName : '미지원 (Unmapped)'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">메모리 / I/O 주소:</span>
                <span className="font-mono text-indigo-300">
                  {regInfoB ? `${regInfoB.memAddr} (${regInfoB.ioAddr})` : '—'}
                </span>
              </div>
              <div className="col-span-2 text-[10px] text-slate-400">
                {regInfoB?.isExtendedIo ? (
                  <span className="text-amber-400 font-semibold">
                    ⚠️ 확장 I/O 공간: IN/OUT 사용 불가, LDS/STS 필수
                  </span>
                ) : (
                  <span className="text-emerald-400 font-semibold">
                    🛡️ 표준 I/O 공간: 1클럭 IN/OUT 및 SBI/CBI 지원
                  </span>
                )}
              </div>
            </div>

            {/* Current Value Preview */}
            <div className="flex items-center justify-between bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/40 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">현재 설정값 (Hex / Dec)</span>
                <span className="font-mono font-bold text-white text-sm">
                  0x{valB.toString(16).toUpperCase().padStart(2, '0')}{' '}
                  <span className="text-xs text-slate-400">({valB}d)</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-[10px] block">2진수 바이너리</span>
                <span className="font-mono text-indigo-300 font-bold">
                  0b{valB.toString(2).padStart(8, '0')}
                </span>
              </div>
            </div>

            {/* 8-Bit Interactive Switch Grid (Bit 7 down to 0) */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-300 block">
                8비트 비트필드 조작 (클릭하여 0/1 토글):
              </span>
              <div className="grid grid-cols-8 gap-1.5">
                {[7, 6, 5, 4, 3, 2, 1, 0].map((bitIdx) => {
                  const bitVal = (valB & (1 << bitIdx)) !== 0 ? 1 : 0;
                  const bitDef = regInfoB?.bits.find((b) => b.index === bitIdx);
                  const isDiffWithA = (xorDiff & (1 << bitIdx)) !== 0;

                  return (
                    <button
                      key={bitIdx}
                      onClick={() => toggleBitB(bitIdx)}
                      title={`${bitDef?.name || `Bit${bitIdx}`}: ${bitDef?.desc || ''}`}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-center ${
                        isDiffWithA
                          ? 'border-amber-400/80 shadow-md shadow-amber-950/40 ring-1 ring-amber-400/40'
                          : 'border-slate-800 hover:border-slate-700'
                      } ${
                        bitVal === 1
                          ? 'bg-indigo-500/20 text-indigo-200 font-bold'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      <span className="text-[9px] text-slate-400 font-mono">b{bitIdx}</span>
                      <span
                        className={`text-sm font-mono font-bold my-0.5 ${
                          bitVal === 1 ? 'text-indigo-300' : 'text-slate-500'
                        }`}
                      >
                        {bitVal}
                      </span>
                      <span className="text-[9px] font-mono font-bold truncate max-w-full text-slate-300">
                        {bitDef?.name || `b${bitIdx}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Hex Preset buttons for B */}
          <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-800/80">
            <span className="text-[10px] text-slate-500 font-mono">Quick Set:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setValB(0x00)}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-800"
              >
                0x00
              </button>
              <button
                onClick={() => setValB(0xff)}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-800"
              >
                0xFF
              </button>
              <button
                onClick={() => setValB((p) => ~p & 0xff)}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-800"
              >
                Invert (~B)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Bit-by-Bit Detailed Side-by-Side Comparison Matrix */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden space-y-2">
        <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-white">
              비트별 상세 비교 매트릭스 ({profileA.name} ↔ {profileB.name})
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">
            불일치 비트는 <strong className="text-amber-400">황색 배경</strong>으로 강조됩니다.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 text-[11px] font-mono border-b border-slate-800">
              <tr>
                <th className="px-3 py-2 text-center w-14">비트</th>
                <th className="px-3 py-2 w-1/4 text-cyan-300">{profileA.name} 비트명 / 설명</th>
                <th className="px-3 py-2 text-center w-20 text-cyan-300">값 A</th>
                <th className="px-3 py-2 text-center w-16">상태</th>
                <th className="px-3 py-2 text-center w-20 text-indigo-300">값 B</th>
                <th className="px-3 py-2 w-1/4 text-indigo-300">{profileB.name} 비트명 / 설명</th>
                <th className="px-3 py-2 text-slate-300">포팅 시 기능 영향 분석</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {[7, 6, 5, 4, 3, 2, 1, 0].map((bitIdx) => {
                const bitValA = (valA & (1 << bitIdx)) !== 0 ? 1 : 0;
                const bitValB = (valB & (1 << bitIdx)) !== 0 ? 1 : 0;
                const defA = regInfoA?.bits.find((b) => b.index === bitIdx);
                const defB = regInfoB?.bits.find((b) => b.index === bitIdx);
                const valDiff = bitValA !== bitValB;
                const nameDiff = (defA?.name || '') !== (defB?.name || '');

                return (
                  <tr
                    key={bitIdx}
                    className={`transition-colors ${
                      valDiff
                        ? 'bg-amber-950/20 hover:bg-amber-900/30'
                        : 'hover:bg-slate-900/40'
                    }`}
                  >
                    {/* Bit Index */}
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-400">
                      b{bitIdx}
                    </td>

                    {/* MCU A Definition */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-white">
                        <span>{defA?.name || '—'}</span>
                        {defA?.isReserved && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-500 font-sans">
                            Reserved
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 leading-snug">
                        {defA?.desc || '정의 없음'}
                      </div>
                    </td>

                    {/* Value A */}
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-xs ${
                          bitValA === 1
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {bitValA}
                      </span>
                    </td>

                    {/* Match Badge */}
                    <td className="px-3 py-2.5 text-center">
                      {valDiff ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                          불일치
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                          일치
                        </span>
                      )}
                    </td>

                    {/* Value B */}
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-xs ${
                          bitValB === 1
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {bitValB}
                      </span>
                    </td>

                    {/* MCU B Definition */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-white">
                        <span>{defB?.name || '—'}</span>
                        {defB?.isReserved && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-500 font-sans">
                            Reserved
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 leading-snug">
                        {defB?.desc || '정의 없음'}
                      </div>
                    </td>

                    {/* Impact Analysis */}
                    <td className="px-3 py-2.5 text-[11px] text-slate-300">
                      {nameDiff ? (
                        <span className="text-amber-300 font-semibold">
                          ⚠️ 비트 역할 다름: {defA?.name || 'none'} vs {defB?.name || 'none'}
                        </span>
                      ) : valDiff ? (
                        <span className="text-cyan-300">
                          설정값 차이: {profileA.name}은 {bitValA ? '활성' : '비활성'},{' '}
                          {profileB.name}은 {bitValB ? '활성' : '비활성'}
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          동일 비트명 및 동일 동작 상태 (호환 보장)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Portable C/C++ Header / Migration Code Snippet */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-200">
              크로스-MCU 호환 C/C++ 조건부 초기화 코드 스니펫 (#if defined)
            </span>
          </div>

          <button
            onClick={() => handleCopy(portableCodeSnippet, 'portable')}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 flex items-center gap-1.5 transition-all"
          >
            {copiedCodeType === 'portable' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">복사 완료!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>C 코드 복사</span>
              </>
            )}
          </button>
        </div>

        <pre className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800/80 text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed">
          {portableCodeSnippet}
        </pre>
      </div>
    </div>
  );
};
