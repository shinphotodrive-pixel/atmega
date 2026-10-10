import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';
import {
  FolderTree,
  ChevronRight,
  ChevronDown,
  Cpu,
  Clock,
  Radio,
  Share2,
  Activity,
  Zap,
  RotateCcw,
  Copy,
  Check,
  Search,
  Sliders,
  Code2,
  Info,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  ExternalLink
} from 'lucide-react';

interface Props {
  selectedMCU: SupportedMCU;
}

export interface RegisterBitDef {
  bit: number;
  name: string;
  description: string;
  readOnly?: boolean;
  group?: string; // Grouping like "WGM1[3:0]" or "CS0[2:0]"
}

export interface RegisterDef {
  name: string;
  fullName: string;
  offsetHex: string;
  description: string;
  defaultValue: number;
  bits: RegisterBitDef[]; // index 7 to 0
}

export interface PeripheralModuleDef {
  id: string;
  name: string;
  category: 'Timer' | 'UART' | 'SPI' | 'ADC' | 'TWI';
  icon: any;
  description: string;
  registers: RegisterDef[];
}

// Generate Peripheral Database for the selected MCU
const getPeripheralDatabase = (mcu: SupportedMCU): PeripheralModuleDef[] => {
  const isMega640 = mcu === 'atmega640';
  const isMega128 = mcu === 'atmega128';
  const isMega328 = mcu === 'atmega328p';

  const modules: PeripheralModuleDef[] = [];

  // 1. Timer / Counter 0 (8-bit)
  const timer0Regs: RegisterDef[] = [
    {
      name: isMega128 ? 'TCCR0' : 'TCCR0A',
      fullName: isMega128 ? 'Timer/Counter 0 Control Register' : 'Timer/Counter 0 Control Register A',
      offsetHex: isMega128 ? '0x53' : '0x44',
      description: 'Timer0 파형 생성 모드(WGM) 및 출력 비교 핀(OC0A/B) 동작 모드를 제어합니다.',
      defaultValue: 0x00,
      bits: isMega128
        ? [
            { bit: 7, name: 'FOC0', description: 'Force Output Compare (비-PWM 모드 시 즉시 비교 일치 강제)' },
            { bit: 6, name: 'WGM00', description: 'Waveform Generation Mode bit 0' },
            { bit: 5, name: 'COM01', description: 'Compare Match Output Mode bit 1 (OC0 핀 동작 선택)' },
            { bit: 4, name: 'COM00', description: 'Compare Match Output Mode bit 0' },
            { bit: 3, name: 'WGM01', description: 'Waveform Generation Mode bit 1' },
            { bit: 2, name: 'CS02', description: 'Clock Select bit 2 (프리스케일러 분주비)' },
            { bit: 1, name: 'CS01', description: 'Clock Select bit 1' },
            { bit: 0, name: 'CS00', description: 'Clock Select bit 0' },
          ]
        : [
            { bit: 7, name: 'COM0A1', description: 'Compare Output Mode A bit 1 (OC0A 핀 비트1)' },
            { bit: 6, name: 'COM0A0', description: 'Compare Output Mode A bit 0 (OC0A 핀 비트0)' },
            { bit: 5, name: 'COM0B1', description: 'Compare Output Mode B bit 1 (OC0B 핀 비트1)' },
            { bit: 4, name: 'COM0B0', description: 'Compare Output Mode B bit 0 (OC0B 핀 비트0)' },
            { bit: 3, name: 'Res', description: '예약된 비트 (항상 0)', readOnly: true },
            { bit: 2, name: 'Res', description: '예약된 비트 (항상 0)', readOnly: true },
            { bit: 1, name: 'WGM01', description: 'Waveform Generation Mode bit 1' },
            { bit: 0, name: 'WGM00', description: 'Waveform Generation Mode bit 0' },
          ]
    }
  ];

  if (!isMega128) {
    timer0Regs.push({
      name: 'TCCR0B',
      fullName: 'Timer/Counter 0 Control Register B',
      offsetHex: '0x45',
      description: '타이머0 강제 출력 비교(FOC0A/B) 및 클럭 소스 분주비(CS02:0)를 설정합니다.',
      defaultValue: 0x00,
      bits: [
        { bit: 7, name: 'FOC0A', description: 'Force Output Compare A' },
        { bit: 6, name: 'FOC0B', description: 'Force Output Compare B' },
        { bit: 5, name: 'Res', description: '예약된 비트', readOnly: true },
        { bit: 4, name: 'Res', description: '예약된 비트', readOnly: true },
        { bit: 3, name: 'WGM02', description: 'Waveform Generation Mode bit 2' },
        { bit: 2, name: 'CS02', description: 'Clock Select bit 2' },
        { bit: 1, name: 'CS01', description: 'Clock Select bit 1' },
        { bit: 0, name: 'CS00', description: 'Clock Select bit 0' },
      ]
    });
  }

  timer0Regs.push(
    {
      name: 'TCNT0',
      fullName: 'Timer/Counter 0 Register (Counter Value)',
      offsetHex: isMega128 ? '0x52' : '0x46',
      description: '8비트 타이머/카운터의 현재 누적 카운트 값입니다.',
      defaultValue: 0x00,
      bits: [
        { bit: 7, name: 'TCNT0.7', description: '카운터 최상위 비트 7' },
        { bit: 6, name: 'TCNT0.6', description: '카운터 비트 6' },
        { bit: 5, name: 'TCNT0.5', description: '카운터 비트 5' },
        { bit: 4, name: 'TCNT0.4', description: '카운터 비트 4' },
        { bit: 3, name: 'TCNT0.3', description: '카운터 비트 3' },
        { bit: 2, name: 'TCNT0.2', description: '카운터 비트 2' },
        { bit: 1, name: 'TCNT0.1', description: '카운터 비트 1' },
        { bit: 0, name: 'TCNT0.0', description: '카운터 최하위 비트 0' },
      ]
    },
    {
      name: isMega128 ? 'OCR0' : 'OCR0A',
      fullName: isMega128 ? 'Output Compare Register 0' : 'Output Compare Register 0 A',
      offsetHex: isMega128 ? '0x51' : '0x47',
      description: 'TCNT0 카운터 값과 상시 비교되는 8비트 비교 임계값입니다.',
      defaultValue: 0x00,
      bits: [
        { bit: 7, name: 'OCR0.7', description: '비교값 비트 7' },
        { bit: 6, name: 'OCR0.6', description: '비교값 비트 6' },
        { bit: 5, name: 'OCR0.5', description: '비교값 비트 5' },
        { bit: 4, name: 'OCR0.4', description: '비교값 비트 4' },
        { bit: 3, name: 'OCR0.3', description: '비교값 비트 3' },
        { bit: 2, name: 'OCR0.2', description: '비교값 비트 2' },
        { bit: 1, name: 'OCR0.1', description: '비교값 비트 1' },
        { bit: 0, name: 'OCR0.0', description: '비교값 비트 0' },
      ]
    }
  );

  modules.push({
    id: 'timer0',
    name: 'Timer/Counter 0 (8-bit)',
    category: 'Timer',
    icon: Clock,
    description: '기본 시스템 틱 타이머, 지연 루틴, 밀리초 타이머(millis) 및 8비트 PWM 발생기',
    registers: timer0Regs
  });

  // 2. Timer / Counter 1 (16-bit High Precision)
  const timer1Regs: RegisterDef[] = [
    {
      name: 'TCCR1A',
      fullName: 'Timer/Counter 1 Control Register A',
      offsetHex: isMega128 ? '0x4F' : '0x80',
      description: '16비트 타이머1의 출력 비교 핀(OC1A/B/C) 토글/클리어 모드 및 WGM11:10 제어',
      defaultValue: 0x00,
      bits: [
        { bit: 7, name: 'COM1A1', description: 'Compare Output Mode 1A bit 1' },
        { bit: 6, name: 'COM1A0', description: 'Compare Output Mode 1A bit 0' },
        { bit: 5, name: 'COM1B1', description: 'Compare Output Mode 1B bit 1' },
        { bit: 4, name: 'COM1B0', description: 'Compare Output Mode 1B bit 0' },
        { bit: 3, name: isMega328 ? 'Res' : 'COM1C1', description: isMega328 ? '예약됨' : 'Compare Output Mode 1C bit 1' },
        { bit: 2, name: isMega328 ? 'Res' : 'COM1C0', description: isMega328 ? '예약됨' : 'Compare Output Mode 1C bit 0' },
        { bit: 1, name: 'WGM11', description: 'Waveform Generation Mode bit 1' },
        { bit: 0, name: 'WGM10', description: 'Waveform Generation Mode bit 0' },
      ]
    },
    {
      name: 'TCCR1B',
      fullName: 'Timer/Counter 1 Control Register B',
      offsetHex: isMega128 ? '0x4E' : '0x81',
      description: '입력 캡처 노이즈 캔슬러(ICNC1), 에지 선택(ICES1), WGM13:12 및 분주비(CS12:10) 설정',
      defaultValue: 0x00,
      bits: [
        { bit: 7, name: 'ICNC1', description: 'Input Capture Noise Canceler (입력 캡처 4사이클 노이즈 필터)' },
        { bit: 6, name: 'ICES1', description: 'Input Capture Edge Select (1: 상승에지, 0: 하강에지)' },
        { bit: 5, name: 'Res', description: '예약된 비트', readOnly: true },
        { bit: 4, name: 'WGM13', description: 'Waveform Generation Mode bit 3' },
        { bit: 3, name: 'WGM12', description: 'Waveform Generation Mode bit 2' },
        { bit: 2, name: 'CS12', description: 'Clock Select bit 2 (1/256 or 1/1024 or Ext)' },
        { bit: 1, name: 'CS11', description: 'Clock Select bit 1 (1/8 or 1/64)' },
        { bit: 0, name: 'CS10', description: 'Clock Select bit 0 (No Prescaling)' },
      ]
    },
    {
      name: 'TIMSK1',
      fullName: isMega128 ? 'Timer/Counter Interrupt Mask Register (TIMSK)' : 'Timer/Counter 1 Interrupt Mask Register',
      offsetHex: isMega128 ? '0x57' : '0x6F',
      description: '타이머1 입력 캡처, 비교 일치(OCIE1A/B/C) 및 오버플로(TOIE1) 인터럽트 개별 활성화',
      defaultValue: 0x00,
      bits: [
        { bit: 7, name: 'Res', description: '예약된 비트', readOnly: true },
        { bit: 6, name: 'Res', description: '예약된 비트', readOnly: true },
        { bit: 5, name: 'ICIE1', description: 'Input Capture Interrupt Enable' },
        { bit: 4, name: 'Res', description: '예약된 비트', readOnly: true },
        { bit: 3, name: isMega328 ? 'Res' : 'OCIE1C', description: 'Output Compare C Interrupt Enable' },
        { bit: 2, name: 'OCIE1B', description: 'Output Compare B Interrupt Enable' },
        { bit: 1, name: 'OCIE1A', description: 'Output Compare A Interrupt Enable' },
        { bit: 0, name: 'TOIE1', description: 'Timer1 Overflow Interrupt Enable' },
      ]
    }
  ];

  modules.push({
    id: 'timer1',
    name: 'Timer/Counter 1 (16-bit High Precision)',
    category: 'Timer',
    icon: Clock,
    description: '16비트 고정밀 PWM, 입력 캡처(ICP1), 서보 모터 제어 및 고해상도 주기 측정',
    registers: timer1Regs
  });

  // 3. USART Channels
  const usartChannels = isMega640 ? [0, 1, 2, 3] : isMega128 ? [0, 1] : [0];

  usartChannels.forEach((ch) => {
    const chStr = ch.toString();
    const ucsraName = `UCSR${chStr}A`;
    const ucsrbName = `UCSR${chStr}B`;
    const ucsrcName = `UCSR${chStr}C`;

    modules.push({
      id: `usart${ch}`,
      name: `USART ${ch} (Hardware Serial)`,
      category: 'UART',
      icon: Radio,
      description: `전이중 비동기/동기 시리얼 통신 인터페이스 (채널 ${ch})`,
      registers: [
        {
          name: ucsraName,
          fullName: `USART Control and Status Register ${ch} A`,
          offsetHex: ch === 0 ? (isMega128 ? '0x0B' : '0xC0') : '0xC8',
          description: '수신 완료(RXC), 송신 완료(TXC), 데이터 레지스터 비어있음(UDRE), 프레임/오버런 에러 플래그',
          defaultValue: 0x20, // UDRE default is 1
          bits: [
            { bit: 7, name: `RXC${ch}`, description: 'USART Receive Complete (읽기 전용 플래그)', readOnly: true },
            { bit: 6, name: `TXC${ch}`, description: 'USART Transmit Complete (송신 완료)' },
            { bit: 5, name: `UDRE${ch}`, description: 'USART Data Register Empty (버퍼 준비 완료)', readOnly: true },
            { bit: 4, name: `FE${ch}`, description: 'Frame Error (스톱 비트 누락 오류)', readOnly: true },
            { bit: 3, name: `DOR${ch}`, description: 'Data OverRun (수신 버퍼 오버플로)', readOnly: true },
            { bit: 2, name: `UPE${ch}`, description: 'USART Parity Error (패리티 불일치)', readOnly: true },
            { bit: 1, name: `U2X${ch}`, description: 'Double the USART Transmission Speed (2배속 모드)' },
            { bit: 0, name: `MPCM${ch}`, description: 'Multi-processor Communication Mode' },
          ]
        },
        {
          name: ucsrbName,
          fullName: `USART Control and Status Register ${ch} B`,
          offsetHex: ch === 0 ? (isMega128 ? '0x0A' : '0xC1') : '0xC9',
          description: '송수신 인터럽트 활성화(RXCIE, TXCIE, UDRIE) 및 송수신기 인에이블(RXEN, TXEN)',
          defaultValue: 0x00,
          bits: [
            { bit: 7, name: `RXCIE${ch}`, description: 'RX Complete Interrupt Enable (수신 인터럽트 활성)' },
            { bit: 6, name: `TXCIE${ch}`, description: 'TX Complete Interrupt Enable (송신 완료 인터럽트 활성)' },
            { bit: 5, name: `UDRIE${ch}`, description: 'USART Data Register Empty Interrupt Enable' },
            { bit: 4, name: `RXEN${ch}`, description: 'Receiver Enable (수신기 활성화)' },
            { bit: 3, name: `TXEN${ch}`, description: 'Transmitter Enable (송신기 활성화)' },
            { bit: 2, name: `UCSZ${ch}2`, description: 'Character Size bit 2 (9비트 데이터 시 사용)' },
            { bit: 1, name: `RXB8${ch}`, description: 'Receive Data Bit 8 (9비트 프레임 9번째 비트)' },
            { bit: 0, name: `TXB8${ch}`, description: 'Transmit Data Bit 8 (9비트 프레임 9번째 비트)' },
          ]
        },
        {
          name: ucsrcName,
          fullName: `USART Control and Status Register ${ch} C`,
          offsetHex: ch === 0 ? (isMega128 ? '0x0D' : '0xC2') : '0xCA',
          description: '통신 모드(동기/비동기), 패리티 모드(UPM), 스톱 비트 수(USBS), 데이터 비트 수(UCSZ)',
          defaultValue: 0x06, // 8-N-1 default
          bits: [
            { bit: 7, name: isMega128 ? 'URSEL0' : `UMSEL${ch}1`, description: isMega128 ? 'Register Select (UBRRH vs UCSRC)' : 'USART Mode Select bit 1' },
            { bit: 6, name: `UMSEL${ch}0`, description: 'USART Mode Select bit 0 (0: 비동기 USART, 1: 동기 USART)' },
            { bit: 5, name: `UPM${ch}1`, description: 'Parity Mode bit 1 (00: 없음, 10: 짝수, 11: 홀수)' },
            { bit: 4, name: `UPM${ch}0`, description: 'Parity Mode bit 0' },
            { bit: 3, name: `USBS${ch}`, description: 'Stop Bit Select (0: 1-stop bit, 1: 2-stop bits)' },
            { bit: 2, name: `UCSZ${ch}1`, description: 'Character Size bit 1 (11: 8비트 데이터)' },
            { bit: 1, name: `UCSZ${ch}0`, description: 'Character Size bit 0' },
            { bit: 0, name: `UCPOL${ch}`, description: 'Clock Polarity (동기 모드 시 XCK 클럭 극성)' },
          ]
        }
      ]
    });
  });

  // 4. SPI (Serial Peripheral Interface)
  modules.push({
    id: 'spi',
    name: 'SPI (Serial Peripheral Interface)',
    category: 'SPI',
    icon: Share2,
    description: 'SD카드, TFT 디스플레이, RF 무선 모듈 통신을 위한 고속 전이중 동기 직렬 버스',
    registers: [
      {
        name: 'SPCR',
        fullName: 'SPI Control Register',
        offsetHex: isMega128 ? '0x0D' : '0x4C',
        description: 'SPI 인에이블(SPE), 마스터/슬레이브 선택(MSTR), 데이터 순서(DORD), 클럭 극성(CPOL/CPHA) 및 분주비(SPR1:0)',
        defaultValue: 0x00,
        bits: [
          { bit: 7, name: 'SPIE', description: 'SPI Interrupt Enable (SPI 인터럽트 활성화)' },
          { bit: 6, name: 'SPE', description: 'SPI Enable (SPI 모듈 활성화)' },
          { bit: 5, name: 'DORD', description: 'Data Order (0: MSB 우선 송신, 1: LSB 우선 송신)' },
          { bit: 4, name: 'MSTR', description: 'Master/Slave Select (1: SPI 마스터, 0: SPI 슬레이브)' },
          { bit: 3, name: 'CPOL', description: 'Clock Polarity (0: SCK 대기상태 LOW, 1: SCK 대기상태 HIGH)' },
          { bit: 2, name: 'CPHA', description: 'Clock Phase (0: 리딩 에지 샘플, 1: 트레일링 에지 샘플)' },
          { bit: 1, name: 'SPR1', description: 'SPI Clock Rate Select bit 1' },
          { bit: 0, name: 'SPR0', description: 'SPI Clock Rate Select bit 0' },
        ]
      },
      {
        name: 'SPSR',
        fullName: 'SPI Status Register',
        offsetHex: isMega128 ? '0x0E' : '0x4D',
        description: 'SPI 전송 완료 플래그(SPIF), 쓰기 충돌 오류(WCOL), 2배속 모드(SPI2X)',
        defaultValue: 0x00,
        bits: [
          { bit: 7, name: 'SPIF', description: 'SPI Interrupt Flag (1바이트 송수신 완료)', readOnly: true },
          { bit: 6, name: 'WCOL', description: 'Write COLlision Flag (송신 중 데이터 덮어쓰기 에러)', readOnly: true },
          { bit: 5, name: 'Res', description: '예약된 비트', readOnly: true },
          { bit: 4, name: 'Res', description: '예약된 비트', readOnly: true },
          { bit: 3, name: 'Res', description: '예약된 비트', readOnly: true },
          { bit: 2, name: 'Res', description: '예약된 비트', readOnly: true },
          { bit: 1, name: 'Res', description: '예약된 비트', readOnly: true },
          { bit: 0, name: 'SPI2X', description: 'Double SPI Speed Bit (1: SPI 클럭 주파수 2배)' },
        ]
      }
    ]
  });

  // 5. ADC (Analog-to-Digital Converter)
  modules.push({
    id: 'adc',
    name: 'ADC (10-bit Analog to Digital Converter)',
    category: 'ADC',
    icon: Activity,
    description: '10비트 연속 근사형 아날로그 디지털 컨버터 (온도 센서, 조도 센서, 조이스틱 입력)',
    registers: [
      {
        name: 'ADMUX',
        fullName: 'ADC Multiplexer Selection Register',
        offsetHex: isMega128 ? '0x07' : '0x7C',
        description: '기준 전압 선택(REFS1:0), 결과 좌측 정렬(ADLAR), 아날로그 입력 채널 선택(MUX4:0)',
        defaultValue: 0x00,
        bits: [
          { bit: 7, name: 'REFS1', description: 'Reference Selection bit 1 (00: AREF, 01: AVCC, 11: 내부 1.1V/2.56V)' },
          { bit: 6, name: 'REFS0', description: 'Reference Selection bit 0' },
          { bit: 5, name: 'ADLAR', description: 'ADC Left Adjust Result (1: 8비트 정밀도 상위 정렬)' },
          { bit: 4, name: 'MUX4', description: 'Analog Channel and Gain Selection bit 4' },
          { bit: 3, name: 'MUX3', description: 'Analog Channel and Gain Selection bit 3' },
          { bit: 2, name: 'MUX2', description: 'Analog Channel and Gain Selection bit 2' },
          { bit: 1, name: 'MUX1', description: 'Analog Channel and Gain Selection bit 1' },
          { bit: 0, name: 'MUX0', description: 'Analog Channel and Gain Selection bit 0' },
        ]
      },
      {
        name: 'ADCSRA',
        fullName: 'ADC Control and Status Register A',
        offsetHex: isMega128 ? '0x06' : '0x7A',
        description: 'ADC 인에이블(ADEN), 변환 시작(ADSC), 자동 트리거(ADATE), 인터럽트 플래그/인에이블, 분주비(ADPS2:0)',
        defaultValue: 0x00,
        bits: [
          { bit: 7, name: 'ADEN', description: 'ADC Enable (ADC 모듈 전원 및 회로 활성화)' },
          { bit: 6, name: 'ADSC', description: 'ADC Start Conversion (변환 시작)' },
          { bit: 5, name: 'ADATE', description: 'ADC Auto Trigger Enable (외부 트리거 소스 동기화)' },
          { bit: 4, name: 'ADIF', description: 'ADC Interrupt Flag (변환 완료 시 1 세트)' },
          { bit: 3, name: 'ADIE', description: 'ADC Interrupt Enable (완료 인터럽트 활성화)' },
          { bit: 2, name: 'ADPS2', description: 'ADC Prescaler Select bit 2 (1/2 ~ 1/128 분주비)' },
          { bit: 1, name: 'ADPS1', description: 'ADC Prescaler Select bit 1' },
          { bit: 0, name: 'ADPS0', description: 'ADC Prescaler Select bit 0' },
        ]
      },
      {
        name: 'ADCSRB',
        fullName: 'ADC Control and Status Register B',
        offsetHex: isMega128 ? '0x08' : '0x7B',
        description: 'ADC 자동 트리거 소스 선택(ADTS2:0) 및 아날로그 비교기 다중화',
        defaultValue: 0x00,
        bits: [
          { bit: 7, name: 'Res', description: '예약된 비트', readOnly: true },
          { bit: 6, name: 'ACME', description: 'Analog Comparator Multiplexer Enable' },
          { bit: 5, name: 'Res', description: '예약된 비트', readOnly: true },
          { bit: 4, name: 'Res', description: '예약된 비트', readOnly: true },
          { bit: 3, name: 'Res', description: '예약된 비트', readOnly: true },
          { bit: 2, name: 'ADTS2', description: 'ADC Auto Trigger Source bit 2 (000: 프리러닝 모드)' },
          { bit: 1, name: 'ADTS1', description: 'ADC Auto Trigger Source bit 1' },
          { bit: 0, name: 'ADTS0', description: 'ADC Auto Trigger Source bit 0' },
        ]
      }
    ]
  });

  return modules;
};

export const PeripheralRegisterTreeView: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const peripheralDb = useMemo(() => getPeripheralDatabase(selectedMCU), [selectedMCU]);

  // States
  const [selectedModuleId, setSelectedModuleId] = useState<string>('timer0');
  const [selectedRegName, setSelectedRegName] = useState<string>('TCCR0A');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    Timer: true,
    UART: true,
    SPI: true,
    ADC: true
  });

  // Track live register values in a dictionary: { "TCCR0A": 0x42, ... }
  const [registerValues, setRegisterValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    peripheralDb.forEach((mod) => {
      mod.registers.forEach((reg) => {
        initial[reg.name] = reg.defaultValue;
      });
    });
    return initial;
  });

  const [copiedKind, setCopiedKind] = useState<string | null>(null);

  // Active module & register
  const activeModule = useMemo(() => {
    return peripheralDb.find((m) => m.id === selectedModuleId) || peripheralDb[0];
  }, [peripheralDb, selectedModuleId]);

  const activeRegister = useMemo(() => {
    return activeModule.registers.find((r) => r.name === selectedRegName) || activeModule.registers[0];
  }, [activeModule, selectedRegName]);

  const currentVal = registerValues[activeRegister.name] ?? activeRegister.defaultValue;

  // Toggle a single bit in the active register
  const handleToggleBit = (bitIndex: number) => {
    const bitMask = 1 << bitIndex;
    const isCurrentlySet = Boolean(currentVal & bitMask);
    const newVal = isCurrentlySet ? (currentVal & ~bitMask) : (currentVal | bitMask);

    setRegisterValues((prev) => ({
      ...prev,
      [activeRegister.name]: newVal
    }));
  };

  // Direct Hex/Dec input change
  const handleDirectValueChange = (newVal: number) => {
    const safeVal = Math.max(0, Math.min(255, newVal));
    setRegisterValues((prev) => ({
      ...prev,
      [activeRegister.name]: safeVal
    }));
  };

  // Quick reset
  const handleResetToDefault = () => {
    setRegisterValues((prev) => ({
      ...prev,
      [activeRegister.name]: activeRegister.defaultValue
    }));
  };

  const handleSetAllBits = () => {
    setRegisterValues((prev) => ({
      ...prev,
      [activeRegister.name]: 0xFF
    }));
  };

  const handleClearAllBits = () => {
    setRegisterValues((prev) => ({
      ...prev,
      [activeRegister.name]: 0x00
    }));
  };

  // Toggle category collapse
  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  // Copy C Code
  const generatedCInitCode = useMemo(() => {
    // Generate bitwise C assignment for the active module's registers
    const lines = activeModule.registers.map((reg) => {
      const val = registerValues[reg.name] ?? reg.defaultValue;
      const setBits = reg.bits.filter((b) => Boolean(val & (1 << b.bit)) && !b.readOnly);

      if (setBits.length === 0) {
        return `    ${reg.name} = 0x00; // ${reg.fullName}`;
      }

      const bitOrExpr = setBits.map((b) => `(1 << ${b.name})`).join(' | ');
      return `    ${reg.name} = ${bitOrExpr}; // 0x${val.toString(16).toUpperCase().padStart(2, '0')}`;
    });

    return `// ========================================================
// [${currentProfile.name}] ${activeModule.name} 하드웨어 초기화 코드
// ========================================================
#include <avr/io.h>

void ${activeModule.id.toUpperCase()}_Init(void) {
${lines.join('\n')}
}`;
  }, [activeModule, currentProfile.name, registerValues]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCInitCode);
    setCopiedKind('code');
    confetti({
      particleCount: 25,
      spread: 60,
      origin: { y: 0.7 }
    });
    setTimeout(() => setCopiedKind(null), 2000);
  };

  // Filter modules/registers by search query
  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return peripheralDb;
    const q = searchQuery.toLowerCase().trim();

    return peripheralDb.filter((mod) => {
      const matchesMod = mod.name.toLowerCase().includes(q) || mod.category.toLowerCase().includes(q);
      const matchesReg = mod.registers.some((r) =>
        r.name.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q) ||
        r.bits.some((b) => b.name.toLowerCase().includes(q))
      );
      return matchesMod || matchesReg;
    });
  }, [peripheralDb, searchQuery]);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold font-mono">
              <FolderTree className="w-3.5 h-3.5" />
              PERIPHERAL REGISTER TREE VIEW
            </span>
            <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
              {currentProfile.name} • 계층형 하드웨어 레지스터 &amp; 비트필드 스위치
            </span>
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-cyan-400" />
            주변장치 레지스터 트리 뷰 &amp; 인터랙티브 비트필드 조작기
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            <strong>Timer, UART, SPI, ADC</strong> 등 {currentProfile.name}의 하드웨어 모듈을 트리 구조로 드릴다운하여,
            각 레지스터의 8개 비트 스위치를 직접 토글하고 실시간 계산된 16진수/10진수/2진수 값과
            임베디드 C 언어 초기화 코드를 즉시 생성합니다.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-lg shadow-cyan-950/40"
          >
            {copiedKind === 'code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedKind === 'code' ? '복사 완료!' : '초기화 C 코드 복사'}
          </button>
        </div>
      </div>

      {/* Main Grid: Left = Peripheral Tree Navigation (4 cols), Right = Bitfield Inspector & Value Calculator (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Peripheral Tree View (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="모듈, 레지스터, 비트명 검색..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Tree Container */}
            <div className="space-y-2 max-h-[580px] overflow-y-auto custom-scrollbar pr-1">
              {filteredModules.map((mod) => {
                const isSelectedModule = selectedModuleId === mod.id;
                const IconComponent = mod.icon;

                return (
                  <div key={mod.id} className="rounded-xl border border-slate-800/80 bg-slate-900/50 overflow-hidden">
                    {/* Module Node */}
                    <div
                      onClick={() => {
                        setSelectedModuleId(mod.id);
                        setSelectedRegName(mod.registers[0].name);
                      }}
                      className={`p-2.5 cursor-pointer flex items-center justify-between gap-2 transition ${
                        isSelectedModule ? 'bg-cyan-950/40 text-cyan-300 font-bold border-l-4 border-cyan-500' : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <IconComponent className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <span className="text-xs truncate">{mod.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                        {mod.registers.length} regs
                      </span>
                    </div>

                    {/* Child Registers */}
                    {isSelectedModule && (
                      <div className="bg-slate-950/70 border-t border-slate-800/80 p-1.5 space-y-1">
                        {mod.registers.map((reg) => {
                          const isSelectedReg = selectedRegName === reg.name;
                          const regVal = registerValues[reg.name] ?? reg.defaultValue;

                          return (
                            <div
                              key={reg.name}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRegName(reg.name);
                              }}
                              className={`p-2 rounded-lg cursor-pointer flex items-center justify-between text-xs font-mono transition ${
                                isSelectedReg
                                  ? 'bg-cyan-900/40 text-white border border-cyan-500/50 font-bold shadow-sm'
                                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                <span>{reg.name}</span>
                                <span className="text-[10px] text-slate-500">({reg.offsetHex})</span>
                              </div>
                              <span className="text-[11px] text-cyan-400 font-bold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                0x{regVal.toString(16).toUpperCase().padStart(2, '0')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Bitfield Inspector & Interactive Value Calculator (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-5">
            {/* Register Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    {activeRegister.name}
                    <span className="text-xs text-slate-400 font-sans font-normal">
                      — {activeRegister.fullName}
                    </span>
                  </h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                  {activeRegister.description}
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <button
                  onClick={handleClearAllBits}
                  className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850 transition"
                  title="모든 비트 0으로 초기화"
                >
                  Clear (0x00)
                </button>
                <button
                  onClick={handleSetAllBits}
                  className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850 transition"
                  title="모든 비트 1로 세트"
                >
                  Set (0xFF)
                </button>
                <button
                  onClick={handleResetToDefault}
                  className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850 transition"
                  title="데이터시트 초기값 복원"
                >
                  <RotateCcw className="w-3 h-3 inline mr-1" />
                  기본값
                </button>
              </div>
            </div>

            {/* Live Calculated Value Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/70 p-4 rounded-xl border border-slate-800">
              {/* Hex View & Direct Input */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-mono block">16진수 (HEX)</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono text-cyan-400 font-bold">0x</span>
                  <input
                    type="text"
                    maxLength={2}
                    value={currentVal.toString(16).toUpperCase().padStart(2, '0')}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 16);
                      if (!isNaN(v)) handleDirectValueChange(v);
                    }}
                    className="w-14 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-base font-mono font-bold text-white focus:outline-none focus:border-cyan-500 text-center"
                  />
                </div>
              </div>

              {/* Decimal View */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-mono block">10진수 (DEC)</span>
                <span className="text-base font-mono font-bold text-amber-400 block pt-0.5">
                  {currentVal}
                </span>
              </div>

              {/* Binary View */}
              <div className="space-y-1 sm:col-span-2">
                <span className="text-[10px] text-slate-400 font-mono block">2진수 (BIN 8-bit)</span>
                <span className="text-base font-mono font-bold text-emerald-400 block pt-0.5 tracking-widest">
                  0b{currentVal.toString(2).padStart(8, '0')}
                </span>
              </div>
            </div>

            {/* 8-Bit Interactive Toggle Switches Bar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  비트필드 인터랙티브 스위치 (Bit 7 down to Bit 0)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  클릭하여 0 ↔ 1 즉시 전환
                </span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {activeRegister.bits.map((b) => {
                  const isSet = Boolean(currentVal & (1 << b.bit));
                  const isReadOnly = b.readOnly;

                  return (
                    <div
                      key={b.bit}
                      onClick={() => !isReadOnly && handleToggleBit(b.bit)}
                      className={`p-2.5 rounded-xl border text-center transition-all select-none ${
                        isReadOnly
                          ? 'bg-slate-950/60 border-slate-800 text-slate-600 cursor-not-allowed opacity-60'
                          : isSet
                          ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 ring-1 ring-cyan-500/50 cursor-pointer shadow-lg shadow-cyan-950/30'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 cursor-pointer'
                      }`}
                      title={b.description}
                    >
                      <span className="text-[10px] font-mono text-slate-500 block">
                        Bit {b.bit}
                      </span>
                      <strong className={`block text-xs font-mono my-1 truncate ${isSet ? 'text-white' : 'text-slate-400'}`}>
                        {b.name}
                      </strong>
                      <div className="flex items-center justify-center pt-0.5">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                            isSet
                              ? 'bg-cyan-500 text-slate-950'
                              : 'bg-slate-800 text-slate-500 border border-slate-700'
                          }`}
                        >
                          {isSet ? '1' : '0'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bit-field Descriptions Table */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                비트별 데이터시트 정의 및 동작 해설
              </span>

              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="divide-y divide-slate-800/80">
                  {activeRegister.bits.map((b) => {
                    const isSet = Boolean(currentVal & (1 << b.bit));

                    return (
                      <div
                        key={b.bit}
                        className={`p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition ${
                          isSet ? 'bg-cyan-950/20' : 'bg-slate-950/40 hover:bg-slate-900/30'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            onClick={() => !b.readOnly && handleToggleBit(b.bit)}
                            disabled={b.readOnly}
                            className={`w-7 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                              isSet ? 'bg-cyan-500 justify-end' : 'bg-slate-800 justify-start'
                            } ${b.readOnly ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <span className="w-4 h-4 rounded-full bg-white block" />
                          </button>

                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="font-bold text-white text-xs">{b.name}</span>
                            <span className="text-[10px] text-slate-500">(Bit {b.bit})</span>
                            {b.readOnly && (
                              <span className="text-[9px] px-1.5 py-0.2 bg-slate-800 text-amber-400 rounded">
                                READ ONLY
                              </span>
                            )}
                          </div>

                          <span className="text-slate-300 text-xs sm:truncate">
                            {b.description}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto font-mono text-[11px]">
                          <span className={isSet ? 'text-cyan-400 font-bold' : 'text-slate-500'}>
                            상태: {isSet ? '1 (SET / ACTIVE)' : '0 (CLEARED)'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Generated C Code Snippet for this Module */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-cyan-400" />
                  실시간 자동 생성된 C 초기화 코드
                </span>
                <span className="text-[11px] font-mono text-cyan-400">
                  {activeModule.name}
                </span>
              </div>

              <pre className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 custom-scrollbar">
                {generatedCInitCode}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
