import React, { useState, useMemo } from 'react';
import { 
  Binary, 
  Copy, 
  Check, 
  RotateCcw, 
  Sparkles, 
  Zap, 
  Code2, 
  Cpu, 
  HelpCircle, 
  CheckSquare, 
  Square,
  ArrowRight,
  Flame,
  Info
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface BitDef {
  index: number;
  name: string;
  desc: string;
  reserved?: boolean;
}

interface RegisterPreset {
  name: string;
  category: string;
  desc: string;
  ioAddr?: string;
  defaultVal: number;
  bits: BitDef[];
  notes?: string;
}

// Preset register definitions covering AVR microcontrollers
const REGISTER_PRESETS: Record<string, RegisterPreset[]> = {
  atmega328p: [
    // GPIO Ports
    {
      name: 'PORTB',
      category: 'GPIO 출력 데이터',
      desc: 'Port B Data Register (출력 핀 High/Low 및 내부 풀업 저항 제어)',
      ioAddr: '0x05 (0x25)',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'PORTB7', desc: 'PB7 (XTAL2/TOSC2/PCINT7) 출력값 설정' },
        { index: 6, name: 'PORTB6', desc: 'PB6 (XTAL1/TOSC1/PCINT6) 출력값 설정' },
        { index: 5, name: 'PORTB5', desc: 'PB5 (SCK/PCINT5 - 아두이노 D13 내장 LED) 출력값 설정' },
        { index: 4, name: 'PORTB4', desc: 'PB4 (MISO/PCINT4) 출력값 설정' },
        { index: 3, name: 'PORTB3', desc: 'PB3 (MOSI/OC2A/PCINT3) 출력값 설정' },
        { index: 2, name: 'PORTB2', desc: 'PB2 (SS/OC1B/PCINT2) 출력값 설정' },
        { index: 1, name: 'PORTB1', desc: 'PB1 (OC1A/PCINT1) 출력값 설정' },
        { index: 0, name: 'PORTB0', desc: 'PB0 (ICP1/CLKO/PCINT0) 출력값 설정' },
      ],
      notes: 'I/O 주소 0x05로 0x00~0x1F 범위 내에 위치하여 단일 비트 조작 시 1클럭 sbi/cbi 명령어로 최적화됩니다.'
    },
    {
      name: 'DDRB',
      category: 'GPIO 입출력 방향',
      desc: 'Port B Data Direction Register (1: 출력, 0: 입력)',
      ioAddr: '0x04 (0x24)',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'DDB7', desc: 'PB7 입출력 방향 설정 (1: Output, 0: Input)' },
        { index: 6, name: 'DDB6', desc: 'PB6 입출력 방향 설정 (1: Output, 0: Input)' },
        { index: 5, name: 'DDB5', desc: 'PB5 (D13 LED) 입출력 방향 설정 (1: Output, 0: Input)' },
        { index: 4, name: 'DDB4', desc: 'PB4 입출력 방향 설정 (1: Output, 0: Input)' },
        { index: 3, name: 'DDB3', desc: 'PB3 입출력 방향 설정 (1: Output, 0: Input)' },
        { index: 2, name: 'DDB2', desc: 'PB2 입출력 방향 설정 (1: Output, 0: Input)' },
        { index: 1, name: 'DDB1', desc: 'PB1 입출력 방향 설정 (1: Output, 0: Input)' },
        { index: 0, name: 'DDB0', desc: 'PB0 입출력 방향 설정 (1: Output, 0: Input)' },
      ],
      notes: '1클럭 sbi/cbi 명령어로 원자적 제어 가능.'
    },
    {
      name: 'PORTD',
      category: 'GPIO 출력 데이터',
      desc: 'Port D Data Register (PD0~PD7 아두이노 D0~D7 디지털 핀)',
      ioAddr: '0x0B (0x2B)',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'PORTD7', desc: 'PD7 (AIN1/PCINT23) 출력 설정' },
        { index: 6, name: 'PORTD6', desc: 'PD6 (AIN0/OC0A/PCINT22) 출력 설정' },
        { index: 5, name: 'PORTD5', desc: 'PD5 (T1/OC0B/PCINT21) 출력 설정' },
        { index: 4, name: 'PORTD4', desc: 'PD4 (XCK/T0/PCINT20) 출력 설정' },
        { index: 3, name: 'PORTD3', desc: 'PD3 (INT1/OC2B/PCINT19) 출력 설정' },
        { index: 2, name: 'PORTD2', desc: 'PD2 (INT0/PCINT18) 출력 설정' },
        { index: 1, name: 'PORTD1', desc: 'PD1 (TXD/PCINT17) 출력 설정' },
        { index: 0, name: 'PORTD0', desc: 'PD0 (RXD/PCINT16) 출력 설정' },
      ],
    },
    {
      name: 'DDRD',
      category: 'GPIO 입출력 방향',
      desc: 'Port D Data Direction Register (1: 출력, 0: 입력)',
      ioAddr: '0x0A (0x2A)',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'DDD7', desc: 'PD7 입출력 방향 (1: Output, 0: Input)' },
        { index: 6, name: 'DDD6', desc: 'PD6 입출력 방향 (1: Output, 0: Input)' },
        { index: 5, name: 'DDD5', desc: 'PD5 입출력 방향 (1: Output, 0: Input)' },
        { index: 4, name: 'DDD4', desc: 'PD4 입출력 방향 (1: Output, 0: Input)' },
        { index: 3, name: 'DDD3', desc: 'PD3 입출력 방향 (1: Output, 0: Input)' },
        { index: 2, name: 'DDD2', desc: 'PD2 입출력 방향 (1: Output, 0: Input)' },
        { index: 1, name: 'DDD1', desc: 'PD1 (TXD) 방향 (1: Output, 0: Input)' },
        { index: 0, name: 'DDD0', desc: 'PD0 (RXD) 방향 (1: Output, 0: Input)' },
      ],
    },
    // Timers
    {
      name: 'TCCR0A',
      category: '타이머/카운터0',
      desc: 'Timer/Counter0 Control Register A (PWM 모드 및 비교 출력 모드 설정)',
      ioAddr: '0x24 (0x44)',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'COM0A1', desc: 'Compare Match Output A Mode bit 1' },
        { index: 6, name: 'COM0A0', desc: 'Compare Match Output A Mode bit 0' },
        { index: 5, name: 'COM0B1', desc: 'Compare Match Output B Mode bit 1' },
        { index: 4, name: 'COM0B0', desc: 'Compare Match Output B Mode bit 0' },
        { index: 3, name: 'Reserved', desc: '예약된 비트 (항상 0)', reserved: true },
        { index: 2, name: 'Reserved', desc: '예약된 비트 (항상 0)', reserved: true },
        { index: 1, name: 'WGM01', desc: 'Waveform Generation Mode bit 1 (CTC/PWM 설정)' },
        { index: 0, name: 'WGM00', desc: 'Waveform Generation Mode bit 0 (CTC/PWM 설정)' },
      ],
    },
    {
      name: 'TCCR0B',
      category: '타이머/카운터0',
      desc: 'Timer/Counter0 Control Register B (클럭 프리스케일러 및 WGM02)',
      ioAddr: '0x25 (0x45)',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'FOC0A', desc: 'Force Output Compare A' },
        { index: 6, name: 'FOC0B', desc: 'Force Output Compare B' },
        { index: 5, name: 'Reserved', desc: '예약된 비트 (항상 0)', reserved: true },
        { index: 4, name: 'Reserved', desc: '예약된 비트 (항상 0)', reserved: true },
        { index: 3, name: 'WGM02', desc: 'Waveform Generation Mode bit 2' },
        { index: 2, name: 'CS02', desc: 'Clock Select bit 2 (분주비 설정)' },
        { index: 1, name: 'CS01', desc: 'Clock Select bit 1 (분주비 설정)' },
        { index: 0, name: 'CS00', desc: 'Clock Select bit 0 (분주비 설정)' },
      ],
    },
    // USART
    {
      name: 'UCSR0B',
      category: 'USART 직렬통신',
      desc: 'USART Control and Status Register 0 B (송수신 인에이블 및 인터럽트 허용)',
      ioAddr: '0xC1',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'RXCIE0', desc: 'RX Complete Interrupt Enable 0 (수신 완료 인터럽트 활성화)' },
        { index: 6, name: 'TXCIE0', desc: 'TX Complete Interrupt Enable 0 (송신 완료 인터럽트 활성화)' },
        { index: 5, name: 'UDRIE0', desc: 'USART Data Register Empty Interrupt Enable 0' },
        { index: 4, name: 'RXEN0', desc: 'Receiver Enable 0 (UART 수신기 활성화)' },
        { index: 3, name: 'TXEN0', desc: 'Transmitter Enable 0 (UART 송신기 활성화)' },
        { index: 2, name: 'UCSZ02', desc: 'Character Size 0 bit 2 (데이터 비트 길이 9비트 시 1)' },
        { index: 1, name: 'RXB80', desc: 'Receive Data Bit 8 0 (9번째 수신 데이터 비트)' },
        { index: 0, name: 'TXB80', desc: 'Transmit Data Bit 8 0 (9번째 송신 데이터 비트)' },
      ],
    },
    // ADC
    {
      name: 'ADCSRA',
      category: 'ADC 아날로그-디지털',
      desc: 'ADC Control and Status Register A (ADC 인에이블, 변환 시작 및 프리스케일러)',
      ioAddr: '0x7A',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'ADEN', desc: 'ADC Enable (1: ADC 전원 인에이블)' },
        { index: 6, name: 'ADSC', desc: 'ADC Start Conversion (1을 쓰면 변환 개시)' },
        { index: 5, name: 'ADATE', desc: 'ADC Auto Trigger Enable (자동 트리거 활성화)' },
        { index: 4, name: 'ADIF', desc: 'ADC Interrupt Flag (변환 완료 시 1 세팅, 1을 써서 클리어)' },
        { index: 3, name: 'ADIE', desc: 'ADC Interrupt Enable (ADC 완료 인터럽트 인에이블)' },
        { index: 2, name: 'ADPS2', desc: 'ADC Prescaler Select bit 2' },
        { index: 1, name: 'ADPS1', desc: 'ADC Prescaler Select bit 1' },
        { index: 0, name: 'ADPS0', desc: 'ADC Prescaler Select bit 0' },
      ],
    },
    // SPI
    {
      name: 'SPCR',
      category: 'SPI 통신',
      desc: 'SPI Control Register (SPI 인에이블, 마스터/슬레이브, 클럭 속도)',
      ioAddr: '0x2C (0x4C)',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'SPIE', desc: 'SPI Interrupt Enable (SPI 인터럽트 허용)' },
        { index: 6, name: 'SPE', desc: 'SPI Enable (1: SPI 하드웨어 켜기)' },
        { index: 5, name: 'DORD', desc: 'Data Order (1: LSB 우선 송신, 0: MSB 우선)' },
        { index: 4, name: 'MSTR', desc: 'Master/Slave Select (1: SPI Master, 0: Slave)' },
        { index: 3, name: 'CPOL', desc: 'Clock Polarity (1: SCK idle High, 0: idle Low)' },
        { index: 2, name: 'CPHA', desc: 'Clock Phase (1: Leading edge 셋업, 0: 샘플)' },
        { index: 1, name: 'SPR1', desc: 'SPI Clock Rate Select bit 1' },
        { index: 0, name: 'SPR0', desc: 'SPI Clock Rate Select bit 0' },
      ],
    },
    // TWI / I2C
    {
      name: 'TWCR',
      category: 'TWI / I2C 통신',
      desc: 'TWI Control Register (START/STOP 조건 전송 및 인터럽트 클리어)',
      ioAddr: '0xBC',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'TWINT', desc: 'TWI Interrupt Flag (동작 완료 알림, 1을 써서 하드웨어 플래그 클리어)' },
        { index: 6, name: 'TWEA', desc: 'TWI Enable Acknowledge (ACK 비트 송신 활성화)' },
        { index: 5, name: 'TWSTA', desc: 'TWI START Condition (1을 쓰면 START 비트 생성)' },
        { index: 4, name: 'TWSTO', desc: 'TWI STOP Condition (1을 쓰면 STOP 비트 생성)' },
        { index: 3, name: 'TWWC', desc: 'TWI Write Collision Flag' },
        { index: 2, name: 'TWEN', desc: 'TWI Enable (1: I2C 통신 모듈 활성화)' },
        { index: 1, name: 'Reserved', desc: '예약된 비트 (항상 0)', reserved: true },
        { index: 0, name: 'TWIE', desc: 'TWI Interrupt Enable (인터럽트 허용)' },
      ],
    },
    // Watchdog
    {
      name: 'WDTCSR',
      category: '시스템 및 Watchdog',
      desc: 'Watchdog Timer Control Register (워치독 타임아웃 및 리셋/인터럽트 모드)',
      ioAddr: '0x60',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'WDIF', desc: 'Watchdog Interrupt Flag' },
        { index: 6, name: 'WDIE', desc: 'Watchdog Interrupt Enable (1: 인터럽트 모드)' },
        { index: 5, name: 'WDP3', desc: 'Watchdog Timer Prescaler bit 3' },
        { index: 4, name: 'WDCE', desc: 'Watchdog Change Enable (설정 변경 시 1로 세팅 필요)' },
        { index: 3, name: 'WDE', desc: 'Watchdog System Reset Enable (1: 시스템 리셋 활성화)' },
        { index: 2, name: 'WDP2', desc: 'Watchdog Timer Prescaler bit 2' },
        { index: 1, name: 'WDP1', desc: 'Watchdog Timer Prescaler bit 1' },
        { index: 0, name: 'WDP0', desc: 'Watchdog Timer Prescaler bit 0' },
      ],
    }
  ],
  atmega2560: [
    // GPIO Ports A
    {
      name: 'PORTA',
      category: 'GPIO 출력 데이터',
      desc: 'Port A Data Register (PA0~PA7 고밀도 8비트 입출력 포트)',
      ioAddr: '0x02 (0x22)',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'PORTA7', desc: 'PA7 (AD7) 출력 핀 데이터' },
        { index: 6, name: 'PORTA6', desc: 'PA6 (AD6) 출력 핀 데이터' },
        { index: 5, name: 'PORTA5', desc: 'PA5 (AD5) 출력 핀 데이터' },
        { index: 4, name: 'PORTA4', desc: 'PA4 (AD4) 출력 핀 데이터' },
        { index: 3, name: 'PORTA3', desc: 'PA3 (AD3) 출력 핀 데이터' },
        { index: 2, name: 'PORTA2', desc: 'PA2 (AD2) 출력 핀 데이터' },
        { index: 1, name: 'PORTA1', desc: 'PA1 (AD1) 출력 핀 데이터' },
        { index: 0, name: 'PORTA0', desc: 'PA0 (AD0) 출력 핀 데이터' },
      ],
      notes: 'I/O 주소 0x02로 1클럭 sbi/cbi 명령어 최적화 대상입니다.'
    },
    {
      name: 'DDRA',
      category: 'GPIO 입출력 방향',
      desc: 'Port A Data Direction Register (1: 출력, 0: 입력)',
      ioAddr: '0x01 (0x21)',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'DDA7', desc: 'PA7 입출력 방향 설정 (1: Out, 0: In)' },
        { index: 6, name: 'DDA6', desc: 'PA6 입출력 방향 설정 (1: Out, 0: In)' },
        { index: 5, name: 'DDA5', desc: 'PA5 입출력 방향 설정 (1: Out, 0: In)' },
        { index: 4, name: 'DDA4', desc: 'PA4 입출력 방향 설정 (1: Out, 0: In)' },
        { index: 3, name: 'DDA3', desc: 'PA3 입출력 방향 설정 (1: Out, 0: In)' },
        { index: 2, name: 'DDA2', desc: 'PA2 입출력 방향 설정 (1: Out, 0: In)' },
        { index: 1, name: 'DDA1', desc: 'PA1 입출력 방향 설정 (1: Out, 0: In)' },
        { index: 0, name: 'DDA0', desc: 'PA0 입출력 방향 설정 (1: Out, 0: In)' },
      ],
    },
    {
      name: 'PORTB',
      category: 'GPIO 출력 데이터',
      desc: 'Port B Data Register (PB7 아두이노 메가 D13 내장 LED)',
      ioAddr: '0x05 (0x25)',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'PORTB7', desc: 'PB7 (OC0A/OC1C/PCINT7 - Mega D13 LED) 출력' },
        { index: 6, name: 'PORTB6', desc: 'PB6 (OC1B/PCINT6) 출력' },
        { index: 5, name: 'PORTB5', desc: 'PB5 (OC1A/PCINT5) 출력' },
        { index: 4, name: 'PORTB4', desc: 'PB4 (OC2A/PCINT4) 출력' },
        { index: 3, name: 'PORTB3', desc: 'PB3 (MISO/PCINT3) 출력' },
        { index: 2, name: 'PORTB2', desc: 'PB2 (MOSI/PCINT2) 출력' },
        { index: 1, name: 'PORTB1', desc: 'PB1 (SCK/PCINT1) 출력' },
        { index: 0, name: 'PORTB0', desc: 'PB0 (SS/PCINT0) 출력' },
      ],
    },
    {
      name: 'DDRB',
      category: 'GPIO 입출력 방향',
      desc: 'Port B Data Direction Register (1: 출력, 0: 입력)',
      ioAddr: '0x04 (0x24)',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'DDB7', desc: 'PB7 (D13 LED) 방향 (1: Output, 0: Input)' },
        { index: 6, name: 'DDB6', desc: 'PB6 방향 (1: Output, 0: Input)' },
        { index: 5, name: 'DDB5', desc: 'PB5 방향 (1: Output, 0: Input)' },
        { index: 4, name: 'DDB4', desc: 'PB4 방향 (1: Output, 0: Input)' },
        { index: 3, name: 'DDB3', desc: 'PB3 방향 (1: Output, 0: Input)' },
        { index: 2, name: 'DDB2', desc: 'PB2 방향 (1: Output, 0: Input)' },
        { index: 1, name: 'DDB1', desc: 'PB1 방향 (1: Output, 0: Input)' },
        { index: 0, name: 'DDB0', desc: 'PB0 방향 (1: Output, 0: Input)' },
      ],
    },
    {
      name: 'PORTL',
      category: 'GPIO 확장 포트 L',
      desc: 'Port L Data Register (PL0~PL7 ATmega2560 확장 포트)',
      ioAddr: '0x10B',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'PORTL7', desc: 'PL7 (ICP3) 출력 데이터' },
        { index: 6, name: 'PORTL6', desc: 'PL6 출력 데이터' },
        { index: 5, name: 'PORTL5', desc: 'PL5 (OC5C) 출력 데이터' },
        { index: 4, name: 'PORTL4', desc: 'PL4 (OC5B) 출력 데이터' },
        { index: 3, name: 'PORTL3', desc: 'PL3 (OC5A) 출력 데이터' },
        { index: 2, name: 'PORTL2', desc: 'PL2 (T5) 출력 데이터' },
        { index: 1, name: 'PORTL1', desc: 'PL1 출력 데이터' },
        { index: 0, name: 'PORTL0', desc: 'PL0 출력 데이터' },
      ],
      notes: '확장 메모리 공간(Extended I/O: 0x10B)에 위치하므로 sbi 대신 LDS/STS 명령어가 생성됩니다.'
    },
    {
      name: 'ADCSRA',
      category: 'ADC 아날로그-디지털',
      desc: 'ADC Control and Status Register A',
      ioAddr: '0x7A',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'ADEN', desc: 'ADC Enable (1: ADC 전원 인에이블)' },
        { index: 6, name: 'ADSC', desc: 'ADC Start Conversion (1을 쓰면 변환 개시)' },
        { index: 5, name: 'ADATE', desc: 'ADC Auto Trigger Enable' },
        { index: 4, name: 'ADIF', desc: 'ADC Interrupt Flag' },
        { index: 3, name: 'ADIE', desc: 'ADC Interrupt Enable' },
        { index: 2, name: 'ADPS2', desc: 'ADC Prescaler Select bit 2' },
        { index: 1, name: 'ADPS1', desc: 'ADC Prescaler Select bit 1' },
        { index: 0, name: 'ADPS0', desc: 'ADC Prescaler Select bit 0' },
      ],
    },
    {
      name: 'UCSR0B',
      category: 'USART 직렬통신',
      desc: 'USART Control and Status Register 0 B',
      ioAddr: '0xC1',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'RXCIE0', desc: 'RX Complete Interrupt Enable 0' },
        { index: 6, name: 'TXCIE0', desc: 'TX Complete Interrupt Enable 0' },
        { index: 5, name: 'UDRIE0', desc: 'USART Data Register Empty Interrupt Enable 0' },
        { index: 4, name: 'RXEN0', desc: 'Receiver Enable 0' },
        { index: 3, name: 'TXEN0', desc: 'Transmitter Enable 0' },
        { index: 2, name: 'UCSZ02', desc: 'Character Size 0 bit 2' },
        { index: 1, name: 'RXB80', desc: 'Receive Data Bit 8 0' },
        { index: 0, name: 'TXB80', desc: 'Transmit Data Bit 8 0' },
      ],
    }
  ],
  atmega128: [
    {
      name: 'PORTA',
      category: 'GPIO 출력 데이터',
      desc: 'Port A Data Register (PA0~PA7)',
      ioAddr: '0x1B (0x3B)',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'PORTA7', desc: 'PA7 (AD7) 출력' },
        { index: 6, name: 'PORTA6', desc: 'PA6 (AD6) 출력' },
        { index: 5, name: 'PORTA5', desc: 'PA5 (AD5) 출력' },
        { index: 4, name: 'PORTA4', desc: 'PA4 (AD4) 출력' },
        { index: 3, name: 'PORTA3', desc: 'PA3 (AD3) 출력' },
        { index: 2, name: 'PORTA2', desc: 'PA2 (AD2) 출력' },
        { index: 1, name: 'PORTA1', desc: 'PA1 (AD1) 출력' },
        { index: 0, name: 'PORTA0', desc: 'PA0 (AD0) 출력' },
      ],
    },
    {
      name: 'DDRA',
      category: 'GPIO 입출력 방향',
      desc: 'Port A Data Direction Register',
      ioAddr: '0x1A (0x3A)',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'DDA7', desc: 'PA7 방향 (1: Output, 0: Input)' },
        { index: 6, name: 'DDA6', desc: 'PA6 방향 (1: Output, 0: Input)' },
        { index: 5, name: 'DDA5', desc: 'PA5 방향 (1: Output, 0: Input)' },
        { index: 4, name: 'DDA4', desc: 'PA4 방향 (1: Output, 0: Input)' },
        { index: 3, name: 'DDA3', desc: 'PA3 방향 (1: Output, 0: Input)' },
        { index: 2, name: 'DDA2', desc: 'PA2 방향 (1: Output, 0: Input)' },
        { index: 1, name: 'DDA1', desc: 'PA1 방향 (1: Output, 0: Input)' },
        { index: 0, name: 'DDA0', desc: 'PA0 방향 (1: Output, 0: Input)' },
      ],
    },
    {
      name: 'ADCSRA',
      category: 'ADC 아날로그-디지털',
      desc: 'ADC Control and Status Register',
      ioAddr: '0x06 (0x26)',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'ADEN', desc: 'ADC Enable' },
        { index: 6, name: 'ADSC', desc: 'ADC Start Conversion' },
        { index: 5, name: 'ADFR', desc: 'ADC Free Running Select (ATmega128 레거시 비트명)' },
        { index: 4, name: 'ADIF', desc: 'ADC Interrupt Flag' },
        { index: 3, name: 'ADIE', desc: 'ADC Interrupt Enable' },
        { index: 2, name: 'ADPS2', desc: 'ADC Prescaler bit 2' },
        { index: 1, name: 'ADPS1', desc: 'ADC Prescaler bit 1' },
        { index: 0, name: 'ADPS0', desc: 'ADC Prescaler bit 0' },
      ],
    }
  ],
  atmega640: [
    {
      name: 'PORTA',
      category: 'GPIO 출력 데이터',
      desc: 'Port A Data Register',
      ioAddr: '0x02 (0x22)',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'PORTA7', desc: 'PA7 출력' },
        { index: 6, name: 'PORTA6', desc: 'PA6 출력' },
        { index: 5, name: 'PORTA5', desc: 'PA5 출력' },
        { index: 4, name: 'PORTA4', desc: 'PA4 출력' },
        { index: 3, name: 'PORTA3', desc: 'PA3 출력' },
        { index: 2, name: 'PORTA2', desc: 'PA2 출력' },
        { index: 1, name: 'PORTA1', desc: 'PA1 출력' },
        { index: 0, name: 'PORTA0', desc: 'PA0 출력' },
      ],
    },
    {
      name: 'PORTB',
      category: 'GPIO 출력 데이터',
      desc: 'Port B Data Register',
      ioAddr: '0x05 (0x25)',
      defaultVal: 0x00,
      bits: [
        { index: 7, name: 'PORTB7', desc: 'PB7 출력' },
        { index: 6, name: 'PORTB6', desc: 'PB6 출력' },
        { index: 5, name: 'PORTB5', desc: 'PB5 출력' },
        { index: 4, name: 'PORTB4', desc: 'PB4 출력' },
        { index: 3, name: 'PORTB3', desc: 'PB3 출력' },
        { index: 2, name: 'PORTB2', desc: 'PB2 출력' },
        { index: 1, name: 'PORTB1', desc: 'PB1 출력' },
        { index: 0, name: 'PORTB0', desc: 'PB0 출력' },
      ],
    }
  ]
};

interface BitManipulationSandboxProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export const BitManipulationSandbox: React.FC<BitManipulationSandboxProps> = ({
  selectedMCU,
  onSelectMCU
}) => {
  // MCU presets lookup with fallback
  const presetsForMCU = REGISTER_PRESETS[selectedMCU] || REGISTER_PRESETS['atmega328p'];
  
  // State
  const [selectedRegName, setSelectedRegName] = useState<string>(() => presetsForMCU[0]?.name || 'PORTA');
  const [isCustomReg, setIsCustomReg] = useState<boolean>(false);
  const [customRegName, setCustomRegName] = useState<string>('PORTA');
  const [bitFlags, setBitFlags] = useState<number>(0b00000001); // Default bit 0 checked
  const [cStyle, setCStyle] = useState<'shift' | 'bv' | 'hex'>('shift');
  const [activeTab, setActiveTab] = useState<'set' | 'clear' | 'toggle' | 'assign' | 'test' | 'all'>('set');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sync when selectedMCU changes if current register is not in new presets
  const currentPreset = useMemo(() => {
    if (isCustomReg) {
      return {
        name: customRegName.trim().toUpperCase() || 'CUSTOM_REG',
        category: '사용자 지정 레지스터',
        desc: '사용자가 직접 명명한 레지스터',
        ioAddr: '0x??',
        defaultVal: 0x00,
        bits: Array.from({ length: 8 }, (_, i) => {
          const idx = 7 - i;
          return {
            index: idx,
            name: `${(customRegName.trim().toUpperCase() || 'REG')}${idx}`,
            desc: `Bit ${idx} 플래그 제어`,
          };
        }),
      };
    }
    const found = presetsForMCU.find(p => p.name === selectedRegName);
    return found || presetsForMCU[0] || REGISTER_PRESETS['atmega328p'][0];
  }, [selectedMCU, presetsForMCU, selectedRegName, isCustomReg, customRegName]);

  const regName = currentPreset.name;

  // Toggle single bit
  const handleToggleBit = (index: number) => {
    setBitFlags(prev => prev ^ (1 << index));
  };

  // Preset operations
  const setAllBits = () => setBitFlags(0xFF);
  const clearAllBits = () => setBitFlags(0x00);
  const invertBits = () => setBitFlags(prev => (~prev) & 0xFF);
  const setHighNibble = () => setBitFlags(0xF0);
  const setLowNibble = () => setBitFlags(0x0F);
  const setAlternatingEven = () => setBitFlags(0x55);
  const setAlternatingOdd = () => setBitFlags(0xAA);

  // Formatted numeric values
  const hexVal = useMemo(() => `0x${bitFlags.toString(16).toUpperCase().padStart(2, '0')}`, [bitFlags]);
  const binVal = useMemo(() => `0b${bitFlags.toString(2).padStart(8, '0')}`, [bitFlags]);
  const decVal = bitFlags;

  // Active bits list (0..7)
  const activeBitIndices = useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < 8; i++) {
      if ((bitFlags & (1 << i)) !== 0) {
        indices.push(i);
      }
    }
    return indices;
  }, [bitFlags]);

  // C code formatting generator
  const formatBitMask = (index: number, style: 'shift' | 'bv' | 'hex') => {
    const bitObj = currentPreset.bits.find(b => b.index === index);
    const bitName = bitObj ? bitObj.name : `${regName}${index}`;
    if (style === 'shift') {
      return `(1 << ${bitName})`;
    } else if (style === 'bv') {
      return `_BV(${bitName})`;
    } else {
      return `0x${(1 << index).toString(16).toUpperCase().padStart(2, '0')}`;
    }
  };

  const getMaskExpression = (indices: number[], style: 'shift' | 'bv' | 'hex') => {
    if (indices.length === 0) return '0';
    if (style === 'hex') {
      let maskVal = 0;
      indices.forEach(idx => { maskVal |= (1 << idx); });
      return `0x${maskVal.toString(16).toUpperCase().padStart(2, '0')}`;
    }
    return indices.map(idx => formatBitMask(idx, style)).join(' | ');
  };

  // Generated C Snippets for each mode
  const codeSnippets = useMemo(() => {
    const active = activeBitIndices;
    const maskExpr = getMaskExpression(active, cStyle);

    // 1. Bit Set (|=)
    let setCode = '';
    if (active.length === 0) {
      setCode = `// 선택된 비트가 없습니다. 샌드박스에서 비트 플래그를 체크하세요.\n${regName} |= 0;`;
    } else {
      setCode = `${regName} |= ${maskExpr};`;
    }

    // 2. Bit Clear (&= ~)
    let clearCode = '';
    if (active.length === 0) {
      clearCode = `// 클리어할 비트를 체크하세요.\n${regName} &= ~0;`;
    } else if (active.length === 1) {
      if (cStyle === 'hex') {
        const invHex = (~(1 << active[0]) & 0xFF).toString(16).toUpperCase().padStart(2, '0');
        clearCode = `${regName} &= ~(0x${(1 << active[0]).toString(16).toUpperCase().padStart(2, '0')}); // 또는 ${regName} &= 0x${invHex};`;
      } else {
        clearCode = `${regName} &= ~${maskExpr};`;
      }
    } else {
      if (cStyle === 'hex') {
        let maskVal = 0;
        active.forEach(idx => { maskVal |= (1 << idx); });
        const invHex = ((~maskVal) & 0xFF).toString(16).toUpperCase().padStart(2, '0');
        clearCode = `${regName} &= ~(0x${maskVal.toString(16).toUpperCase().padStart(2, '0')}); // 또는 ${regName} &= 0x${invHex};`;
      } else {
        clearCode = `${regName} &= ~(${maskExpr});`;
      }
    }

    // 3. Bit Toggle (^=)
    let toggleCode = '';
    if (active.length === 0) {
      toggleCode = `// 토글할 비트를 체크하세요.\n${regName} ^= 0;`;
    } else {
      toggleCode = `${regName} ^= ${maskExpr};`;
    }

    // 4. Direct Assign (=)
    const assignCode = `${regName} = ${maskExpr}; // 최종 값: ${hexVal} (${binVal}, ${decVal})`;

    // 5. Bit Testing & Polling (if & while)
    let testCode = '';
    if (active.length === 0) {
      testCode = `// 검사할 비트를 선택하세요.`;
    } else if (active.length === 1) {
      const singleBit = active[0];
      const singleExpr = formatBitMask(singleBit, cStyle);
      testCode = `// 1. 비트 상태 조건 검사 (Bit Test)\nif (${regName} & ${singleExpr}) {\n    // ${currentPreset.bits.find(b => b.index === singleBit)?.name || singleBit} 비트가 HIGH(1)일 때 처리할 로직\n}\n\n// 2. 플래그가 1이 될 때까지 대기 (Hardware Polling / Wait loop)\nwhile (!(${regName} & ${singleExpr})); // 완료 대기`;
    } else {
      testCode = `// 여러 비트 동시 검사 (All matching bits must be set)\nif ((${regName} & (${maskExpr})) == (${maskExpr})) {\n    // 선택된 모든 비트가 1일 때 실행\n}\n\n// 선택된 비트 중 하나라도 1인지 검사 (Any bit set)\nif (${regName} & (${maskExpr})) {\n    // 하나 이상의 비트가 1일 때 실행\n}`;
    }

    // Full comprehensive C function snippet
    const allCode = `/* =========================================================
 * AVR GCC 최적화 비트 조작 코드 스니펫
 * 대상 레지스터: ${regName} (${currentPreset.desc})
 * 대상 MCU: ${MCU_PROFILES[selectedMCU]?.name || selectedMCU}
 * 현재 설정값: ${hexVal} (${binVal}, 10진수: ${decVal})
 * ========================================================= */
#include <avr/io.h>

void configure_${regName.toLowerCase()}_bits(void) {
    // 1. 비트 세팅 (Bit SET - OR 연산)
    ${regName} |= ${maskExpr};

    // 2. 비트 클리어 (Bit CLEAR - AND-NOT 연산)
    // ${regName} &= ~${active.length > 1 ? `(${maskExpr})` : maskExpr};

    // 3. 비트 토글 (Bit TOGGLE - XOR 연산)
    // ${regName} ^= ${maskExpr};

    // 4. 값 직접 대입 (DIRECT ASSIGNMENT)
    // ${regName} = ${maskExpr}; // ${hexVal}
}

// 비트 상태 폴링 및 조건 분기 예제
void check_${regName.toLowerCase()}_status(void) {
${testCode.split('\n').map(line => '    ' + line).join('\n')}
}`;

    return {
      set: setCode,
      clear: clearCode,
      toggle: toggleCode,
      assign: assignCode,
      test: testCode,
      all: allCode,
    };
  }, [regName, currentPreset, activeBitIndices, cStyle, hexVal, binVal, decVal, selectedMCU]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  // Is single bit in lower I/O space? (sbi / cbi candidates)
  const isSbiCbiCandidate = activeBitIndices.length === 1 && currentPreset.ioAddr && !currentPreset.ioAddr.startsWith('0x1');

  return (
    <div className="bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-slate-950/90 border border-cyan-500/30 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6 relative overflow-hidden">
      {/* Decorative ambient background */}
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400 border border-cyan-500/30 shadow-inner">
              <Binary className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-wide">
                  비트 조작 샌드박스 (Bit Manipulation Sandbox)
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-500/40">
                  Live Calculator
                </span>
              </div>
              <p className="text-xs text-slate-400">
                레지스터의 비트 플래그를 실시간으로 체크/언체크하여 16진수·2진수를 계산하고 최적화된 C 언어 비트 마스킹 코드를 생성합니다.
              </p>
            </div>
          </div>
        </div>

        {/* MCU & Presets quick badge */}
        <div className="flex items-center gap-2">
          {onSelectMCU && (
            <select
              value={selectedMCU}
              onChange={(e) => onSelectMCU(e.target.value as SupportedMCU)}
              className="bg-slate-950 border border-slate-700 hover:border-cyan-500 text-xs text-cyan-300 font-mono rounded-lg px-2.5 py-1.5 focus:outline-none transition-colors"
            >
              {Object.keys(MCU_PROFILES).map((mcuKey) => (
                <option key={mcuKey} value={mcuKey}>
                  {MCU_PROFILES[mcuKey as SupportedMCU].name}
                </option>
              ))}
            </select>
          )}
          <span className="text-[11px] font-mono text-slate-400 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            {MCU_PROFILES[selectedMCU]?.name || selectedMCU}
          </span>
        </div>
      </div>

      {/* Register Selection Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 relative z-10">
        <div className="md:col-span-8 flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
          <label className="text-xs font-semibold text-slate-300 whitespace-nowrap flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            타겟 레지스터 선택:
          </label>
          
          <div className="flex-1 w-full flex items-center gap-2">
            {!isCustomReg ? (
              <select
                value={selectedRegName}
                onChange={(e) => setSelectedRegName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 hover:border-cyan-500/60 text-white font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all cursor-pointer"
              >
                {presetsForMCU.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name} [{preset.category}] - {preset.desc.slice(0, 32)}...
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={customRegName}
                onChange={(e) => setCustomRegName(e.target.value.toUpperCase())}
                placeholder="예: PORTA, DDRB, UCSR0A"
                className="w-full bg-slate-900 border border-cyan-500/60 text-white font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all uppercase"
              />
            )}

            <button
              type="button"
              onClick={() => setIsCustomReg(!isCustomReg)}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 whitespace-nowrap transition-colors"
            >
              {isCustomReg ? '프리셋 목록' : '직접 입력'}
            </button>
          </div>
        </div>

        {/* Selected Register Info Card */}
        <div className="md:col-span-4 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 flex flex-col justify-center">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-cyan-400 font-mono text-sm">{regName}</span>
            {currentPreset.ioAddr && (
              <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                I/O: {currentPreset.ioAddr}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 truncate mt-1" title={currentPreset.desc}>
            {currentPreset.desc}
          </p>
        </div>
      </div>

      {/* Main Interactive Bit Flags Strip (Bit 7 down to Bit 0) */}
      <div className="space-y-3 relative z-10">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>8-Bit 플래그 인터랙티브 스위치 (Bit 7 ➔ Bit 0)</span>
            </h4>
            <span className="text-[11px] text-slate-500">
              클릭하여 각 비트의 0/1 상태를 전환하세요
            </span>
          </div>

          {/* Quick presets buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={setAllBits}
              className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
              title="모든 비트 1 설정 (0xFF)"
            >
              전체 1 (0xFF)
            </button>
            <button
              onClick={clearAllBits}
              className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
              title="모든 비트 0 클리어 (0x00)"
            >
              전체 0 (0x00)
            </button>
            <button
              onClick={invertBits}
              className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors flex items-center gap-1"
              title="모든 비트 반전 (~)"
            >
              <RotateCcw className="w-3 h-3 text-cyan-400" />
              반전 (~)
            </button>
            <button
              onClick={setHighNibble}
              className="px-2 py-1 text-[11px] bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded border border-slate-700/60 transition-colors"
              title="상위 4비트 설정 (0xF0)"
            >
              상위 4비트
            </button>
            <button
              onClick={setLowNibble}
              className="px-2 py-1 text-[11px] bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded border border-slate-700/60 transition-colors"
              title="하위 4비트 설정 (0x0F)"
            >
              하위 4비트
            </button>
            <button
              onClick={setAlternatingEven}
              className="px-2 py-1 text-[11px] bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded border border-slate-700/60 transition-colors"
              title="짝수 비트 패턴 (0x55)"
            >
              0x55
            </button>
            <button
              onClick={setAlternatingOdd}
              className="px-2 py-1 text-[11px] bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded border border-slate-700/60 transition-colors"
              title="홀수 비트 패턴 (0xAA)"
            >
              0xAA
            </button>
          </div>
        </div>

        {/* 8 Bit Cards Grid (MSB 7 to LSB 0) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {Array.from({ length: 8 }, (_, i) => {
            const bitIndex = 7 - i;
            const bitDef = currentPreset.bits.find(b => b.index === bitIndex);
            const bitName = bitDef ? bitDef.name : `${regName}${bitIndex}`;
            const isSet = (bitFlags & (1 << bitIndex)) !== 0;
            const weight = 1 << bitIndex;

            return (
              <div
                key={bitIndex}
                onClick={() => handleToggleBit(bitIndex)}
                className={`relative group cursor-pointer select-none rounded-xl p-3 border transition-all duration-200 flex flex-col justify-between items-center text-center ${
                  isSet
                    ? 'bg-gradient-to-b from-cyan-950/80 to-slate-900 border-cyan-400/80 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400/50 scale-[1.02]'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                {/* Header: Bit number & weight */}
                <div className="w-full flex items-center justify-between text-[10px] font-mono mb-1.5">
                  <span className={`px-1.5 py-0.5 rounded ${isSet ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-500 bg-slate-900'}`}>
                    Bit {bitIndex}
                  </span>
                  <span className="text-slate-500">
                    2<sup>{bitIndex}</sup> ({weight})
                  </span>
                </div>

                {/* Big Binary Value Display */}
                <div className="my-1.5 flex flex-col items-center">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center font-mono text-xl font-black transition-all ${
                      isSet
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-400/30'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}
                  >
                    {isSet ? '1' : '0'}
                  </div>
                </div>

                {/* Bit Name */}
                <div className="w-full mt-1">
                  <div className={`font-mono text-xs font-bold truncate ${isSet ? 'text-cyan-300' : 'text-slate-300'}`} title={bitName}>
                    {bitName}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5" title={bitDef?.desc}>
                    {bitDef?.desc || `비트 ${bitIndex}`}
                  </div>
                </div>

                {/* Active Checkbox visual indicator */}
                <div className="mt-2 text-slate-400">
                  {isSet ? (
                    <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-semibold">
                      <CheckSquare className="w-3.5 h-3.5" /> ON
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-slate-600">
                      <Square className="w-3.5 h-3.5" /> OFF
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Numeric Results & Calculation Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
        {/* Hexadecimal Display */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between shadow-inner">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold text-slate-300">16진수 표기 (Hexadecimal)</span>
            <span className="text-[10px] font-mono text-cyan-400">uint8_t</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
              {hexVal}
            </span>
            <button
              onClick={() => handleCopy(hexVal, 'hex')}
              className="text-xs text-slate-400 hover:text-cyan-400 p-1.5 rounded hover:bg-slate-900 transition-colors"
              title="16진수 복사"
            >
              {copiedKey === 'hex' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            상위 니블: 0x{hexVal.charAt(2)} ({(bitFlags >> 4) & 0x0F}) | 하위 니블: 0x{hexVal.charAt(3)} ({bitFlags & 0x0F})
          </p>
        </div>

        {/* Binary Display */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between shadow-inner">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold text-slate-300">2진수 표기 (Binary)</span>
            <span className="text-[10px] font-mono text-emerald-400">8-bit mask</span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-slate-500">
              0b
              {Array.from({ length: 8 }, (_, i) => {
                const bitIndex = 7 - i;
                const isSet = (bitFlags & (1 << bitIndex)) !== 0;
                return (
                  <span
                    key={bitIndex}
                    className={isSet ? 'text-cyan-400 font-extrabold underline decoration-cyan-500/50' : 'text-slate-600'}
                  >
                    {isSet ? '1' : '0'}
                  </span>
                );
              })}
            </div>
            <button
              onClick={() => handleCopy(binVal, 'bin')}
              className="text-xs text-slate-400 hover:text-cyan-400 p-1.5 rounded hover:bg-slate-900 transition-colors"
              title="2진수 복사"
            >
              {copiedKey === 'bin' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            활성화된 비트: {activeBitIndices.length > 0 ? activeBitIndices.map(i => `Bit ${i}`).join(', ') : '없음 (0)'}
          </p>
        </div>

        {/* Decimal & Weight Sum */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between shadow-inner">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold text-slate-300">10진수 / 비트 가중치 합</span>
            <span className="text-[10px] font-mono text-amber-400">0 ~ 255</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono text-white">
              {decVal}
              <span className="text-xs font-normal text-slate-500 ml-2">/ 255</span>
            </span>
            <button
              onClick={() => handleCopy(decVal.toString(), 'dec')}
              className="text-xs text-slate-400 hover:text-cyan-400 p-1.5 rounded hover:bg-slate-900 transition-colors"
              title="10진수 복사"
            >
              {copiedKey === 'dec' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${(decVal / 255) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* C Code Generation Section */}
      <div className="space-y-4 pt-2 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white tracking-wide">
              최적화된 C 언어 비트 마스킹 코드 출력
            </h4>
          </div>

          {/* C Style Selector: (1 << BIT) vs _BV(BIT) vs 0x?? */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setCStyle('shift')}
              className={`px-2.5 py-1 rounded transition-colors ${
                cStyle === 'shift'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="표준 C 쉬프트: (1 << BIT)"
            >
              (1 &lt;&lt; BIT)
            </button>
            <button
              onClick={() => setCStyle('bv')}
              className={`px-2.5 py-1 rounded transition-colors ${
                cStyle === 'bv'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="avr-libc 매크로: _BV(BIT)"
            >
              _BV(BIT)
            </button>
            <button
              onClick={() => setCStyle('hex')}
              className={`px-2.5 py-1 rounded transition-colors ${
                cStyle === 'hex'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="직접 16진수 마스크: 0x??"
            >
              0x?? (Hex)
            </button>
          </div>
        </div>

        {/* Operations Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setActiveTab('set')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'set'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>비트 세팅 (|=)</span>
          </button>
          <button
            onClick={() => setActiveTab('clear')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'clear'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>비트 클리어 (&amp;= ~)</span>
          </button>
          <button
            onClick={() => setActiveTab('toggle')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'toggle'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>비트 토글 (^=)</span>
          </button>
          <button
            onClick={() => setActiveTab('assign')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'assign'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>직접 대입 (=)</span>
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'test'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>조건 검사 &amp; 폴링 (if / while)</span>
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>전체 C 함수 스니펫</span>
          </button>
        </div>

        {/* Code Box */}
        <div className="relative group bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs overflow-x-auto">
          {/* Copy Button */}
          <button
            onClick={() => handleCopy(codeSnippets[activeTab], activeTab)}
            className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white border border-slate-700 hover:border-cyan-500 transition-all flex items-center gap-1.5 text-xs shadow-md"
          >
            {copiedKey === activeTab ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">복사 완료!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>코드 복사</span>
              </>
            )}
          </button>

          {/* Active Code View */}
          <pre className="text-cyan-300 leading-relaxed pr-24 whitespace-pre-wrap">
            {codeSnippets[activeTab]}
          </pre>
        </div>

        {/* Hardware & Microarchitecture Notice */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex items-start gap-3">
            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-slate-200 flex items-center gap-2">
                <span>AVR 하드웨어 단일 클럭 최적화</span>
                {isSbiCbiCandidate && (
                  <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 text-[10px] rounded font-mono border border-emerald-500/30">
                    sbi/cbi 지원
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                I/O 주소 0x00~0x1F 사이 레지스터의 단일 비트 조작 시, avr-gcc 컴파일러가 Read-Modify-Write 대신 1사이클 원자적(Atomic) <code className="text-amber-300 font-mono">sbi</code> / <code className="text-amber-300 font-mono">cbi</code> 어셈블리 명령어를 생성하여 인터럽트 충돌을 원천 차단합니다.
              </p>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex items-start gap-3">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-slate-200">
                PINx 레지스터 토글 팁 (Hardware Toggle)
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                AVR 아키텍처에서는 <code className="text-cyan-300 font-mono">PINx |= (1 &lt;&lt; PINx0)</code>와 같이 PIN 입력 레지스터에 1을 쓰면 해당 PORT 출력 핀이 1클럭만에 고속 토글됩니다 (Read 불필요).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
