import React, { useState, useMemo, useRef } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';
import {
  Activity,
  Sliders,
  Copy,
  Check,
  RotateCcw,
  Search,
  Filter,
  Info,
  Terminal,
  Zap,
  ShieldCheck,
  Layers,
  Sparkles,
  Cpu,
  Download,
  Upload,
  FileJson,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

interface Props {
  selectedMCU: SupportedMCU;
}

export interface BitInfo {
  bit: number;
  name: string;
  rw: 'R/W' | 'R' | 'W';
  reset: number;
  desc: string;
  onMeaning: string;
  offMeaning: string;
}

export interface RegisterDefinition {
  name: string;
  addr: string;
  category: 'gpio' | 'adc' | 'usart' | 'spi' | 'twi' | 'timer' | 'system';
  categoryLabel: string;
  desc: string;
  bits: BitInfo[];
  defaultVal: number;
  mcuSupport?: SupportedMCU[]; // if specified, only on these MCUs
}

// Comprehensive Datasheet-accurate Register Definitions for ATmega640, ATmega128, and ATmega328P
export const REGISTER_DATABASE: RegisterDefinition[] = [
  // --- [ADC Subsystem] ---
  {
    name: 'ADCSRA',
    addr: '0x7A',
    category: 'adc',
    categoryLabel: 'ADC 제어',
    desc: 'ADC Control and Status Register A (ADC 동작 인에이블, 변환 시작, 분주비 설정)',
    defaultVal: 0x00,
    bits: [
      {
        bit: 7,
        name: 'ADEN',
        rw: 'R/W',
        reset: 0,
        desc: 'ADC Enable (ADC 모듈 전원 공급 및 활성화)',
        onMeaning: 'ADC 활성화 (변환 가능 상태)',
        offMeaning: 'ADC 비활성화 (전력 절감)'
      },
      {
        bit: 6,
        name: 'ADSC',
        rw: 'R/W',
        reset: 0,
        desc: 'ADC Start Conversion (1회 또는 첫 변환 시작)',
        onMeaning: '아날로그 변환 진행 중',
        offMeaning: '변환 완료 또는 대기'
      },
      {
        bit: 5,
        name: 'ADATE',
        rw: 'R/W',
        reset: 0,
        desc: 'ADC Auto Trigger Enable (자동 트리거 활성화)',
        onMeaning: '선택된 트리거 소스로 자동 변환',
        offMeaning: '단일 변환 모드 수동 시작'
      },
      {
        bit: 4,
        name: 'ADIF',
        rw: 'R/W',
        reset: 0,
        desc: 'ADC Interrupt Flag (변환 완료 시 1 세트)',
        onMeaning: '변환 완료 인터럽트 플래그 세트됨',
        offMeaning: '변환 미완료 또는 플래그 클리어됨'
      },
      {
        bit: 3,
        name: 'ADIE',
        rw: 'R/W',
        reset: 0,
        desc: 'ADC Interrupt Enable (완료 인터럽트 인에이블)',
        onMeaning: 'ADC 변환 완료 시 ISR 인터럽트 발생',
        offMeaning: '인터럽트 비활성화 (폴링 필요)'
      },
      {
        bit: 2,
        name: 'ADPS2',
        rw: 'R/W',
        reset: 0,
        desc: 'ADC Prescaler Select Bit 2 (분주비 최상위 비트)',
        onMeaning: '분주비 가중치 +4',
        offMeaning: '0'
      },
      {
        bit: 1,
        name: 'ADPS1',
        rw: 'R/W',
        reset: 0,
        desc: 'ADC Prescaler Select Bit 1',
        onMeaning: '분주비 가중치 +2',
        offMeaning: '0'
      },
      {
        bit: 0,
        name: 'ADPS0',
        rw: 'R/W',
        reset: 0,
        desc: 'ADC Prescaler Select Bit 0 (최하위 비트)',
        onMeaning: '분주비 가중치 +1',
        offMeaning: '0'
      }
    ]
  },
  {
    name: 'ADMUX',
    addr: '0x7C',
    category: 'adc',
    categoryLabel: 'ADC 멀티플렉서',
    desc: 'ADC Multiplexer Selection Register (기준 전압 VREF 및 아날로그 입력 채널 선택)',
    defaultVal: 0x00,
    bits: [
      {
        bit: 7,
        name: 'REFS1',
        rw: 'R/W',
        reset: 0,
        desc: 'Reference Selection Bit 1 (기준 전압 선택 상위)',
        onMeaning: '내부 1.1V / 2.56V 밴드갭 기준전압 선택',
        offMeaning: 'AREF 또는 AVCC 전원 기준'
      },
      {
        bit: 6,
        name: 'REFS0',
        rw: 'R/W',
        reset: 0,
        desc: 'Reference Selection Bit 0 (기준 전압 선택 하위)',
        onMeaning: 'AVCC(5V/3.3V)를 기준 전압으로 사용',
        offMeaning: '외부 AREF 핀 전압 사용'
      },
      {
        bit: 5,
        name: 'ADLAR',
        rw: 'R/W',
        reset: 0,
        desc: 'ADC Left Adjust Result (10비트 결과 좌측 정렬)',
        onMeaning: '좌측 정렬 (ADCH만으로 8비트 고속 판독)',
        offMeaning: '우측 정렬 (기본 10비트 정렬)'
      },
      {
        bit: 4,
        name: 'MUX4',
        rw: 'R/W',
        reset: 0,
        desc: 'Analog Channel Select Bit 4 (차동 게인 증폭 채널)',
        onMeaning: '차동 증폭 채널 선택',
        offMeaning: '단일 입력 채널'
      },
      {
        bit: 3,
        name: 'MUX3',
        rw: 'R/W',
        reset: 0,
        desc: 'Analog Channel Select Bit 3',
        onMeaning: '채널 인덱스 Bit 3 세트',
        offMeaning: '채널 인덱스 Bit 3 클리어'
      },
      {
        bit: 2,
        name: 'MUX2',
        rw: 'R/W',
        reset: 0,
        desc: 'Analog Channel Select Bit 2',
        onMeaning: '채널 인덱스 Bit 2 세트',
        offMeaning: '채널 인덱스 Bit 2 클리어'
      },
      {
        bit: 1,
        name: 'MUX1',
        rw: 'R/W',
        reset: 0,
        desc: 'Analog Channel Select Bit 1',
        onMeaning: '채널 인덱스 Bit 1 세트',
        offMeaning: '채널 인덱스 Bit 1 클리어'
      },
      {
        bit: 0,
        name: 'MUX0',
        rw: 'R/W',
        reset: 0,
        desc: 'Analog Channel Select Bit 0',
        onMeaning: '채널 인덱스 Bit 0 세트',
        offMeaning: '채널 인덱스 Bit 0 클리어'
      }
    ]
  },

  // --- [USART0 Subsystem] ---
  {
    name: 'UCSR0A',
    addr: '0xC0',
    category: 'usart',
    categoryLabel: 'USART0 제어 A',
    desc: 'USART Control and Status Register 0 A (송수신 완료 플래그 및 배속 모드)',
    defaultVal: 0x20, // UDRE0 defaults to 1 when empty
    bits: [
      {
        bit: 7,
        name: 'RXC0',
        rw: 'R',
        reset: 0,
        desc: 'USART Receive Complete (새로운 수신 데이터 버퍼 도착)',
        onMeaning: '수신 버퍼(UDR0)에 읽지 않은 데이터 있음',
        offMeaning: '수신 버퍼 비어있음'
      },
      {
        bit: 6,
        name: 'TXC0',
        rw: 'R/W',
        reset: 0,
        desc: 'USART Transmit Complete (쉬프트 레지스터 프레임 전송 완료)',
        onMeaning: '송신 완전 완료됨',
        offMeaning: '송신 중이거나 플래그 클리어됨'
      },
      {
        bit: 5,
        name: 'UDRE0',
        rw: 'R',
        reset: 1,
        desc: 'USART Data Register Empty (송신 버퍼가 새 데이터를 받을 준비됨)',
        onMeaning: '송신 레지스터 쓰기 가능 (비어있음)',
        offMeaning: '송신 레지스터가 데이터로 차있음'
      },
      {
        bit: 4,
        name: 'FE0',
        rw: 'R',
        reset: 0,
        desc: 'Frame Error (스톱 비트 검출 실패 오류)',
        onMeaning: '프레임 수신 에러 발생',
        offMeaning: '프레임 정상'
      },
      {
        bit: 3,
        name: 'DOR0',
        rw: 'R',
        reset: 0,
        desc: 'Data OverRun (수신 버퍼 오버플로우로 데이터 유실)',
        onMeaning: '데이터 오버런 에러',
        offMeaning: '오버런 없음'
      },
      {
        bit: 2,
        name: 'UPE0',
        rw: 'R',
        reset: 0,
        desc: 'USART Parity Error (패리티 비트 불일치)',
        onMeaning: '패리티 검사 실패 에러',
        offMeaning: '패리티 정상'
      },
      {
        bit: 1,
        name: 'U2X0',
        rw: 'R/W',
        reset: 0,
        desc: 'Double the USART Transmission Speed (2배속 모드: 8분주 샘플링)',
        onMeaning: '2배속 모드 활성화 (오차율 감소 효과)',
        offMeaning: '표준 1배속 (16분주 샘플링)'
      },
      {
        bit: 0,
        name: 'MPCM0',
        rw: 'R/W',
        reset: 0,
        desc: 'Multi-processor Communication Mode (다중 프로세서 통신 모드)',
        onMeaning: '주소 프레임만 수신 필터링',
        offMeaning: '모든 수신 데이터 수신'
      }
    ]
  },
  {
    name: 'UCSR0B',
    addr: '0xC1',
    category: 'usart',
    categoryLabel: 'USART0 제어 B',
    desc: 'USART Control and Status Register 0 B (송수신 인에이블 및 인터럽트 활성화)',
    defaultVal: 0x00,
    bits: [
      {
        bit: 7,
        name: 'RXCIE0',
        rw: 'R/W',
        reset: 0,
        desc: 'RX Complete Interrupt Enable (수신 완료 인터럽트 활성화)',
        onMeaning: '데이터 수신 완료 시 ISR(USART_RX_vect) 발생',
        offMeaning: '수신 인터럽트 차단'
      },
      {
        bit: 6,
        name: 'TXCIE0',
        rw: 'R/W',
        reset: 0,
        desc: 'TX Complete Interrupt Enable (송신 완료 인터럽트 활성화)',
        onMeaning: '송신 완료 시 ISR(USART_TX_vect) 발생',
        offMeaning: '송신 인터럽트 차단'
      },
      {
        bit: 5,
        name: 'UDRIE0',
        rw: 'R/W',
        reset: 0,
        desc: 'Data Register Empty Interrupt Enable (버퍼 비었음 인터럽트)',
        onMeaning: '버퍼 비었을 때 ISR 자동 호출 (논스톱 송신)',
        offMeaning: 'UDRE 인터럽트 비활성'
      },
      {
        bit: 4,
        name: 'RXEN0',
        rw: 'R/W',
        reset: 0,
        desc: 'Receiver Enable (USART 수신기 하드웨어 활성화)',
        onMeaning: 'RX 핀 수신 활성화',
        offMeaning: '수신기 비활성화'
      },
      {
        bit: 3,
        name: 'TXEN0',
        rw: 'R/W',
        reset: 0,
        desc: 'Transmitter Enable (USART 송신기 하드웨어 활성화)',
        onMeaning: 'TX 핀 송신 활성화',
        offMeaning: '송신기 비활성화'
      },
      {
        bit: 2,
        name: 'UCSZ02',
        rw: 'R/W',
        reset: 0,
        desc: 'Character Size Bit 2 (데이터 9비트 모드 설정용)',
        onMeaning: '9비트 데이터 프레임 모드',
        offMeaning: '5~8비트 데이터 프레임 모드'
      },
      {
        bit: 1,
        name: 'RXB80',
        rw: 'R',
        reset: 0,
        desc: 'Receive Data Bit 8 (9비트 수신 시 9번째 비트 저장소)',
        onMeaning: '수신 9번째 비트 1',
        offMeaning: '수신 9번째 비트 0'
      },
      {
        bit: 0,
        name: 'TXB80',
        rw: 'R/W',
        reset: 0,
        desc: 'Transmit Data Bit 8 (9비트 송신 시 9번째 비트 지정)',
        onMeaning: '송신 9번째 비트 1',
        offMeaning: '송신 9번째 비트 0'
      }
    ]
  },
  {
    name: 'UCSR0C',
    addr: '0xC2',
    category: 'usart',
    categoryLabel: 'USART0 제어 C',
    desc: 'USART Control and Status Register 0 C (통신 모드, 패리티, 스톱비트 및 8N1 설정)',
    defaultVal: 0x06, // UCSZ01:0 defaults to 8-bit (0b00000110)
    bits: [
      {
        bit: 7,
        name: 'UMSEL01',
        rw: 'R/W',
        reset: 0,
        desc: 'USART Mode Select Bit 1 (동기/비동기/SPI 마스터 모드)',
        onMeaning: '동기 또는 Master SPI 모드',
        offMeaning: '비동기 모드(UART) 선택'
      },
      {
        bit: 6,
        name: 'UMSEL00',
        rw: 'R/W',
        reset: 0,
        desc: 'USART Mode Select Bit 0',
        onMeaning: '동기 USART 모드',
        offMeaning: '비동기 UART 모드'
      },
      {
        bit: 5,
        name: 'UPM01',
        rw: 'R/W',
        reset: 0,
        desc: 'Parity Mode Bit 1 (패리티 생성 및 검사)',
        onMeaning: '패리티 검사 활성화 (Even 또는 Odd)',
        offMeaning: '패리티 비트 없음 (No Parity; 기본)'
      },
      {
        bit: 4,
        name: 'UPM00',
        rw: 'R/W',
        reset: 0,
        desc: 'Parity Mode Bit 0',
        onMeaning: '홀수 패리티(Odd)',
        offMeaning: '짝수 패리티(Even) 또는 무패리티'
      },
      {
        bit: 3,
        name: 'USBS0',
        rw: 'R/W',
        reset: 0,
        desc: 'Stop Bit Select (스톱 비트 수 선택)',
        onMeaning: '2 스톱 비트 (2 Stop bits)',
        offMeaning: '1 스톱 비트 (1 Stop bit; 기본)'
      },
      {
        bit: 2,
        name: 'UCSZ01',
        rw: 'R/W',
        reset: 1,
        desc: 'Character Size Bit 1 (데이터 비트 크기)',
        onMeaning: '8비트 데이터 프레임 구성',
        offMeaning: '7비트 이하 데이터 프레임'
      },
      {
        bit: 1,
        name: 'UCSZ00',
        rw: 'R/W',
        reset: 1,
        desc: 'Character Size Bit 0',
        onMeaning: '8비트 데이터 프레임 구성',
        offMeaning: '7비트 이하 데이터 프레임'
      },
      {
        bit: 0,
        name: 'UCPOL0',
        rw: 'R/W',
        reset: 0,
        desc: 'Clock Polarity (동기 모드 클럭 극성)',
        onMeaning: '하강 에지 송신 / 상승 에지 샘플링',
        offMeaning: '상승 에지 송신 / 하강 에지 샘플링'
      }
    ]
  },

  // --- [SPI Subsystem] ---
  {
    name: 'SPCR',
    addr: '0x4C',
    category: 'spi',
    categoryLabel: 'SPI 제어 레지스터',
    desc: 'SPI Control Register (SPI 모듈 활성화, 마스터/슬레이브, 데이터 순서, 클럭 모드)',
    defaultVal: 0x00,
    bits: [
      {
        bit: 7,
        name: 'SPIE',
        rw: 'R/W',
        reset: 0,
        desc: 'SPI Interrupt Enable (SPI 전송 완료 인터럽트 허용)',
        onMeaning: 'SPIF 세트 시 ISR(SPI_STC_vect) 호출',
        offMeaning: '인터럽트 비활성'
      },
      {
        bit: 6,
        name: 'SPE',
        rw: 'R/W',
        reset: 0,
        desc: 'SPI Enable (하드웨어 SPI 주변장치 인에이블)',
        onMeaning: 'SPI 모듈 활성화 (SCK/MOSI/MISO 구동)',
        offMeaning: 'SPI 모듈 꺼짐'
      },
      {
        bit: 5,
        name: 'DORD',
        rw: 'R/W',
        reset: 0,
        desc: 'Data Order (전송 데이터 비트 순서)',
        onMeaning: 'LSB 우선 전송 (Bit 0 first)',
        offMeaning: 'MSB 우선 전송 (Bit 7 first; 표준)'
      },
      {
        bit: 4,
        name: 'MSTR',
        rw: 'R/W',
        reset: 0,
        desc: 'Master/Slave Select (SPI 마스터 모드 선택)',
        onMeaning: 'SPI 마스터 모드 (클럭 생성)',
        offMeaning: 'SPI 슬레이브 모드 (외부 클럭 수신)'
      },
      {
        bit: 3,
        name: 'CPOL',
        rw: 'R/W',
        reset: 0,
        desc: 'Clock Polarity (SCK 대기 상태 극성)',
        onMeaning: 'SCK 유휴 시 High 레벨 유지',
        offMeaning: 'SCK 유휴 시 Low 레벨 유지 (기본)'
      },
      {
        bit: 2,
        name: 'CPHA',
        rw: 'R/W',
        reset: 0,
        desc: 'Clock Phase (데이터 샘플링 에지 위상)',
        onMeaning: '후행 에지에서 데이터 샘플링',
        offMeaning: '선행 에지에서 데이터 샘플링'
      },
      {
        bit: 1,
        name: 'SPR1',
        rw: 'R/W',
        reset: 0,
        desc: 'SPI Clock Rate Select Bit 1 (SCK 분주비 상위)',
        onMeaning: '분주비 가중치 +2',
        offMeaning: '0'
      },
      {
        bit: 0,
        name: 'SPR0',
        rw: 'R/W',
        reset: 0,
        desc: 'SPI Clock Rate Select Bit 0 (SCK 분주비 하위)',
        onMeaning: '분주비 가중치 +1',
        offMeaning: '0'
      }
    ]
  },
  {
    name: 'SPSR',
    addr: '0x4D',
    category: 'spi',
    categoryLabel: 'SPI 상태 레지스터',
    desc: 'SPI Status Register (전송 완료 플래그 및 배속 클럭 2X)',
    defaultVal: 0x00,
    bits: [
      {
        bit: 7,
        name: 'SPIF',
        rw: 'R',
        reset: 0,
        desc: 'SPI Interrupt Flag (시리얼 1바이트 송수신 완료)',
        onMeaning: '전송 완료 플래그 세트됨',
        offMeaning: '전송 미완료'
      },
      {
        bit: 6,
        name: 'WCOL',
        rw: 'R',
        reset: 0,
        desc: 'Write COLlision Flag (전송 중 SPDR 덮어쓰기 충돌)',
        onMeaning: '쓰기 충돌 발생',
        offMeaning: '충돌 없음'
      },
      { bit: 5, name: 'Res5', rw: 'R', reset: 0, desc: '예약된 비트', onMeaning: '-', offMeaning: '-' },
      { bit: 4, name: 'Res4', rw: 'R', reset: 0, desc: '예약된 비트', onMeaning: '-', offMeaning: '-' },
      { bit: 3, name: 'Res3', rw: 'R', reset: 0, desc: '예약된 비트', onMeaning: '-', offMeaning: '-' },
      { bit: 2, name: 'Res2', rw: 'R', reset: 0, desc: '예약된 비트', onMeaning: '-', offMeaning: '-' },
      { bit: 1, name: 'Res1', rw: 'R', reset: 0, desc: '예약된 비트', onMeaning: '-', offMeaning: '-' },
      {
        bit: 0,
        name: 'SPI2X',
        rw: 'R/W',
        reset: 0,
        desc: 'Double SPI Speed Bit (SPI 클럭 주파수 2배속 활성화)',
        onMeaning: 'SCK 주파수 2배속 가속 (최대 F_CPU/2)',
        offMeaning: '기본 SCK 분주비'
      }
    ]
  },

  // --- [TWI / I2C Subsystem] ---
  {
    name: 'TWCR',
    addr: '0xBC',
    category: 'twi',
    categoryLabel: 'TWI(I2C) 제어',
    desc: 'TWI Control Register (인터럽트 플래그 클리어, START/STOP 조건 발생 및 ACK 생성)',
    defaultVal: 0x00,
    bits: [
      {
        bit: 7,
        name: 'TWINT',
        rw: 'R/W',
        reset: 0,
        desc: 'TWI Interrupt Flag (동작 완료 시 1 세트; 1을 써서 클리어 및 다음 작업 시작)',
        onMeaning: '현재 TWI 작업 완료 (버스 홀드 중)',
        offMeaning: 'TWI 작업 진행 중 또는 대기'
      },
      {
        bit: 6,
        name: 'TWEA',
        rw: 'R/W',
        reset: 0,
        desc: 'TWI Enable Acknowledge Bit (수신 시 ACK 신호 생성)',
        onMeaning: '수신 후 SDA선으로 ACK(0) 응답 전송',
        offMeaning: 'NACK(1) 응답 전송'
      },
      {
        bit: 5,
        name: 'TWSTA',
        rw: 'R/W',
        reset: 0,
        desc: 'TWI START Condition Bit (START 신호 송출)',
        onMeaning: '마스터 START 또는 Repeated START 생성',
        offMeaning: 'START 조건 미생성'
      },
      {
        bit: 4,
        name: 'TWSTO',
        rw: 'R/W',
        reset: 0,
        desc: 'TWI STOP Condition Bit (STOP 신호 송출)',
        onMeaning: '마스터 STOP 조건 생성 및 버스 해제',
        offMeaning: 'STOP 조건 미생성'
      },
      {
        bit: 3,
        name: 'TWWC',
        rw: 'R',
        reset: 0,
        desc: 'TWI Write Collision Flag (TWINT가 0일 때 TWDR 기록 충돌)',
        onMeaning: '쓰기 충돌 에러',
        offMeaning: '정상'
      },
      {
        bit: 2,
        name: 'TWEN',
        rw: 'R/W',
        reset: 0,
        desc: 'TWI Enable Bit (TWI/I2C 하드웨어 활성화)',
        onMeaning: 'SDA/SCL 핀 TWI 제어권 인수 활성화',
        offMeaning: 'TWI 모듈 꺼짐'
      },
      { bit: 1, name: 'Res1', rw: 'R', reset: 0, desc: '예약된 비트', onMeaning: '-', offMeaning: '-' },
      {
        bit: 0,
        name: 'TWIE',
        rw: 'R/W',
        reset: 0,
        desc: 'TWI Interrupt Enable (인터럽트 활성화)',
        onMeaning: 'TWINT 발생 시 ISR(TWI_vect) 자동 실행',
        offMeaning: '인터럽트 비활성'
      }
    ]
  },
  {
    name: 'TWSR',
    addr: '0xB9',
    category: 'twi',
    categoryLabel: 'TWI(I2C) 상태 & 분주',
    desc: 'TWI Status Register (상위 5비트: 버스 상태 코드, 하위 2비트: 비트레이트 분주비 TWPS)',
    defaultVal: 0xF8, // Default status code 0xF8 (No state info)
    bits: [
      { bit: 7, name: 'TWS7', rw: 'R', reset: 1, desc: 'TWI 상태 코드 Bit 7', onMeaning: '1', offMeaning: '0' },
      { bit: 6, name: 'TWS6', rw: 'R', reset: 1, desc: 'TWI 상태 코드 Bit 6', onMeaning: '1', offMeaning: '0' },
      { bit: 5, name: 'TWS5', rw: 'R', reset: 1, desc: 'TWI 상태 코드 Bit 5', onMeaning: '1', offMeaning: '0' },
      { bit: 4, name: 'TWS4', rw: 'R', reset: 1, desc: 'TWI 상태 코드 Bit 4', onMeaning: '1', offMeaning: '0' },
      { bit: 3, name: 'TWS3', rw: 'R', reset: 1, desc: 'TWI 상태 코드 Bit 3', onMeaning: '1', offMeaning: '0' },
      { bit: 2, name: 'Res2', rw: 'R', reset: 0, desc: '예약된 비트 (항상 0)', onMeaning: '-', offMeaning: '-' },
      {
        bit: 1,
        name: 'TWPS1',
        rw: 'R/W',
        reset: 0,
        desc: 'TWI Prescaler Bit 1 (분주비 선택: 4^TWPS)',
        onMeaning: '분주비 16배 또는 64배',
        offMeaning: '분주비 1배 또는 4배'
      },
      {
        bit: 0,
        name: 'TWPS0',
        rw: 'R/W',
        reset: 0,
        desc: 'TWI Prescaler Bit 0',
        onMeaning: '분주비 4배 또는 64배',
        offMeaning: '분주비 1배 또는 16배'
      }
    ]
  },

  // --- [GPIO Ports: PORTB, DDRB, PINB] ---
  {
    name: 'DDRB',
    addr: '0x24',
    category: 'gpio',
    categoryLabel: 'PORTB 입출력 방향',
    desc: 'Port B Data Direction Register (1 = 출력 Output, 0 = 입력 Input)',
    defaultVal: 0x00,
    bits: [
      { bit: 7, name: 'DDB7', rw: 'R/W', reset: 0, desc: 'PB7 핀 방향', onMeaning: '출력 (Output)', offMeaning: '입력 (Input)' },
      { bit: 6, name: 'DDB6', rw: 'R/W', reset: 0, desc: 'PB6 핀 방향', onMeaning: '출력 (Output)', offMeaning: '입력 (Input)' },
      { bit: 5, name: 'DDB5', rw: 'R/W', reset: 0, desc: 'PB5 핀 방향 (Uno 내장 LED)', onMeaning: '출력 (Output)', offMeaning: '입력 (Input)' },
      { bit: 4, name: 'DDB4', rw: 'R/W', reset: 0, desc: 'PB4 핀 방향 (MISO)', onMeaning: '출력 (Output)', offMeaning: '입력 (Input)' },
      { bit: 3, name: 'DDB3', rw: 'R/W', reset: 0, desc: 'PB3 핀 방향 (MOSI)', onMeaning: '출력 (Output)', offMeaning: '입력 (Input)' },
      { bit: 2, name: 'DDB2', rw: 'R/W', reset: 0, desc: 'PB2 핀 방향 (SS)', onMeaning: '출력 (Output)', offMeaning: '입력 (Input)' },
      { bit: 1, name: 'DDB1', rw: 'R/W', reset: 0, desc: 'PB1 핀 방향 (SCK)', onMeaning: '출력 (Output)', offMeaning: '입력 (Input)' },
      { bit: 0, name: 'DDB0', rw: 'R/W', reset: 0, desc: 'PB0 핀 방향 (ICP1)', onMeaning: '출력 (Output)', offMeaning: '입력 (Input)' }
    ]
  },
  {
    name: 'PORTB',
    addr: '0x25',
    category: 'gpio',
    categoryLabel: 'PORTB 출력 & 풀업',
    desc: 'Port B Data Register (출력 시 High/Low 결정, 입력 시 내부 풀업저항 활성화)',
    defaultVal: 0x00,
    bits: [
      { bit: 7, name: 'PORTB7', rw: 'R/W', reset: 0, desc: 'PB7 출력 값 또는 풀업', onMeaning: 'High 출력 / 풀업 On', offMeaning: 'Low 출력 / 풀업 Off' },
      { bit: 6, name: 'PORTB6', rw: 'R/W', reset: 0, desc: 'PB6 출력 값 또는 풀업', onMeaning: 'High 출력 / 풀업 On', offMeaning: 'Low 출력 / 풀업 Off' },
      { bit: 5, name: 'PORTB5', rw: 'R/W', reset: 0, desc: 'PB5 출력 값 또는 풀업', onMeaning: 'High 출력 / 풀업 On', offMeaning: 'Low 출력 / 풀업 Off' },
      { bit: 4, name: 'PORTB4', rw: 'R/W', reset: 0, desc: 'PB4 출력 값 또는 풀업', onMeaning: 'High 출력 / 풀업 On', offMeaning: 'Low 출력 / 풀업 Off' },
      { bit: 3, name: 'PORTB3', rw: 'R/W', reset: 0, desc: 'PB3 출력 값 또는 풀업', onMeaning: 'High 출력 / 풀업 On', offMeaning: 'Low 출력 / 풀업 Off' },
      { bit: 2, name: 'PORTB2', rw: 'R/W', reset: 0, desc: 'PB2 출력 값 또는 풀업', onMeaning: 'High 출력 / 풀업 On', offMeaning: 'Low 출력 / 풀업 Off' },
      { bit: 1, name: 'PORTB1', rw: 'R/W', reset: 0, desc: 'PB1 출력 값 또는 풀업', onMeaning: 'High 출력 / 풀업 On', offMeaning: 'Low 출력 / 풀업 Off' },
      { bit: 0, name: 'PORTB0', rw: 'R/W', reset: 0, desc: 'PB0 출력 값 또는 풀업', onMeaning: 'High 출력 / 풀업 On', offMeaning: 'Low 출력 / 풀업 Off' }
    ]
  },

  // --- [Timer1 16-bit Subsystem] ---
  {
    name: 'TCCR1A',
    addr: '0x80',
    category: 'timer',
    categoryLabel: '타이머1 제어 A',
    desc: 'Timer/Counter1 Control Register A (PWM 출력 핀 비교 일치 모드 및 WGM 저위 비트)',
    defaultVal: 0x00,
    bits: [
      { bit: 7, name: 'COM1A1', rw: 'R/W', reset: 0, desc: 'OC1A 비교 출력 모드 상위', onMeaning: '비반전 PWM 또는 일치 시 클리어', offMeaning: '일반 포트 분리' },
      { bit: 6, name: 'COM1A0', rw: 'R/W', reset: 0, desc: 'OC1A 비교 출력 모드 하위', onMeaning: '비교 일치 시 토글', offMeaning: '토글 안함' },
      { bit: 5, name: 'COM1B1', rw: 'R/W', reset: 0, desc: 'OC1B 비교 출력 모드 상위', onMeaning: 'OC1B 비반전 PWM', offMeaning: '일반 포트' },
      { bit: 4, name: 'COM1B0', rw: 'R/W', reset: 0, desc: 'OC1B 비교 출력 모드 하위', onMeaning: 'OC1B 토글', offMeaning: '토글 안함' },
      { bit: 3, name: 'COM1C1', rw: 'R/W', reset: 0, desc: 'OC1C 모드 (128/640 전용)', onMeaning: 'OC1C PWM 활성화', offMeaning: '포트 분리' },
      { bit: 2, name: 'COM1C0', rw: 'R/W', reset: 0, desc: 'OC1C 모드 하위', onMeaning: 'OC1C 토글', offMeaning: '토글 안함' },
      { bit: 1, name: 'WGM11', rw: 'R/W', reset: 0, desc: 'Waveform Generation Mode Bit 1', onMeaning: '모드 가중치 +2', offMeaning: '0' },
      { bit: 0, name: 'WGM10', rw: 'R/W', reset: 0, desc: 'Waveform Generation Mode Bit 0', onMeaning: '모드 가중치 +1', offMeaning: '0' }
    ]
  },
  {
    name: 'TCCR1B',
    addr: '0x81',
    category: 'timer',
    categoryLabel: '타이머1 제어 B',
    desc: 'Timer/Counter1 Control Register B (입력 캡처 노이즈 캔슬러, WGM 상위, 클럭 프리스케일러 CS)',
    defaultVal: 0x00,
    bits: [
      { bit: 7, name: 'ICNC1', rw: 'R/W', reset: 0, desc: 'Input Capture Noise Canceler', onMeaning: '입력 캡처 디지털 필터 4사이클 딜레이', offMeaning: '필터 미사용' },
      { bit: 6, name: 'ICES1', rw: 'R/W', reset: 0, desc: 'Input Capture Edge Select', onMeaning: '상승 에지에서 캡처', offMeaning: '하강 에지에서 캡처' },
      { bit: 5, name: 'Res5', rw: 'R', reset: 0, desc: '예약된 비트', onMeaning: '-', offMeaning: '-' },
      { bit: 4, name: 'WGM13', rw: 'R/W', reset: 0, desc: 'Waveform Generation Mode Bit 3', onMeaning: 'ICR1 기반 CTC/PWM 모드', offMeaning: '0' },
      { bit: 3, name: 'WGM12', rw: 'R/W', reset: 0, desc: 'Waveform Generation Mode Bit 2', onMeaning: 'CTC 모드 (OCR1A 탑) 활성화', offMeaning: '일반 모드' },
      { bit: 2, name: 'CS12', rw: 'R/W', reset: 0, desc: 'Clock Select Bit 2 (분주비)', onMeaning: '256 또는 1024 분주', offMeaning: '1 또는 8 또는 64 분주' },
      { bit: 1, name: 'CS11', rw: 'R/W', reset: 0, desc: 'Clock Select Bit 1', onMeaning: '8 또는 64 분주', offMeaning: '1 또는 256 분주' },
      { bit: 0, name: 'CS10', rw: 'R/W', reset: 0, desc: 'Clock Select Bit 0 (타이머 시작)', onMeaning: '분주비 가중치 (타이머 클럭 구동 시작)', offMeaning: '타이머 정지 (No clock source)' }
    ]
  },

  // --- [System & Global Status Register] ---
  {
    name: 'SREG',
    addr: '0x5F',
    category: 'system',
    categoryLabel: '글로벌 상태 레지스터',
    desc: 'AVR Core Status Register (I: 글로벌 인터럽트 플래그, 연산 제로 플래그, 캐리 플래그 등)',
    defaultVal: 0x00,
    bits: [
      {
        bit: 7,
        name: 'I',
        rw: 'R/W',
        reset: 0,
        desc: 'Global Interrupt Enable (전역 인터럽트 허용: sei() / cli())',
        onMeaning: '전역 인터럽트 활성화 (모든 ISR 동작 가능)',
        offMeaning: '전역 인터럽트 차단 (Atomic 상태)'
      },
      { bit: 6, name: 'T', rw: 'R/W', reset: 0, desc: 'Bit Copy Storage (BLD/BST 비트 복사 임시 비트)', onMeaning: '1', offMeaning: '0' },
      { bit: 5, name: 'H', rw: 'R/W', reset: 0, desc: 'Half Carry Flag (BCD 연산 하프 캐리)', onMeaning: '하프 캐리 발생', offMeaning: '없음' },
      { bit: 4, name: 'S', rw: 'R/W', reset: 0, desc: 'Sign Bit (N ⊕ V 부호 플래그)', onMeaning: '음수 결과', offMeaning: '양수 결과' },
      { bit: 3, name: 'V', rw: 'R/W', reset: 0, desc: 'Two\'s Complement Overflow Flag (2의 보수 오버플로우)', onMeaning: '오버플로우 발생', offMeaning: '정상' },
      { bit: 2, name: 'N', rw: 'R/W', reset: 0, desc: 'Negative Flag (최상위 비트 MSB 결과 음수)', onMeaning: '음수 결과 (Bit 7 == 1)', offMeaning: '양수 (Bit 7 == 0)' },
      { bit: 1, name: 'Z', rw: 'R/W', reset: 0, desc: 'Zero Flag (산술 및 논리 연산 결과가 0)', onMeaning: '연산 결과 0 (Zero)', offMeaning: '연산 결과 0 아님' },
      { bit: 0, name: 'C', rw: 'R/W', reset: 0, desc: 'Carry Flag (연산 캐리 또는 보로우 발생)', onMeaning: '캐리 발생', offMeaning: '캐리 없음' }
    ]
  }
];

export const RegisterStatusDashboard: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Store runtime register values in state: map of registerName -> number (0~255)
  const [registerValues, setRegisterValues] = useState<{ [regName: string]: number }>(() => {
    const initial: { [regName: string]: number } = {};
    REGISTER_DATABASE.forEach((r) => {
      initial[r.name] = r.defaultVal;
    });
    return initial;
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeRegModal, setActiveRegModal] = useState<RegisterDefinition | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [pasteJsonText, setPasteJsonText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export register state as JSON file
  const exportJSON = () => {
    const activeRegistersDetail = REGISTER_DATABASE.map((r) => {
      const val = registerValues[r.name] ?? r.defaultVal;
      const activeBits = r.bits
        .filter((b) => (val & (1 << b.bit)) !== 0)
        .map((b) => b.name);

      return {
        name: r.name,
        address: r.addr,
        category: r.category,
        categoryLabel: r.categoryLabel,
        currentValueHex: '0x' + val.toString(16).toUpperCase().padStart(2, '0'),
        currentValueBin: '0b' + val.toString(2).padStart(8, '0'),
        currentValueDec: val,
        defaultValueHex: '0x' + r.defaultVal.toString(16).toUpperCase().padStart(2, '0'),
        isModified: val !== r.defaultVal,
        activeBits,
        description: r.desc
      };
    });

    const exportData = {
      schema: 'avr-register-backup-v1',
      targetMCU: selectedMCU,
      targetMCUName: currentProfile.name,
      exportedAt: new Date().toISOString(),
      registerValues: registerValues,
      registersDetail: activeRegistersDetail
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedMCU}_registers_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export register state as CSV file (with UTF-8 BOM)
  const exportCSV = () => {
    const headers = [
      '레지스터명',
      '주소',
      '카테고리',
      '현재값(Hex)',
      '현재값(Bin)',
      '현재값(Dec)',
      '기본값(Hex)',
      '변경여부',
      '활성 비트 플래그',
      '레지스터 설명'
    ];

    const rows = REGISTER_DATABASE.map((r) => {
      const val = registerValues[r.name] ?? r.defaultVal;
      const activeBits = r.bits
        .filter((b) => (val & (1 << b.bit)) !== 0)
        .map((b) => b.name)
        .join('|');

      return [
        `"${r.name}"`,
        `"${r.addr}"`,
        `"${r.categoryLabel}"`,
        `"0x${val.toString(16).toUpperCase().padStart(2, '0')}"`,
        `"0b${val.toString(2).padStart(8, '0')}"`,
        `"${val}"`,
        `"0x${r.defaultVal.toString(16).toUpperCase().padStart(2, '0')}"`,
        `"${val !== r.defaultVal ? '변경됨' : '기본값'}"`,
        `"${activeBits || '없음'}"`,
        `"${r.desc.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedMCU}_registers_status_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Process raw parsed JSON object to restore register state
  const restoreFromParsedJSON = (parsed: any): boolean => {
    try {
      let candidateMap: { [key: string]: any } = {};

      if (parsed.registerValues && typeof parsed.registerValues === 'object') {
        candidateMap = parsed.registerValues;
      } else if (parsed.registersDetail && Array.isArray(parsed.registersDetail)) {
        parsed.registersDetail.forEach((item: any) => {
          if (item.name && item.currentValueDec !== undefined) {
            candidateMap[item.name] = Number(item.currentValueDec);
          }
        });
      } else if (typeof parsed === 'object') {
        candidateMap = parsed;
      }

      const validKeys = Object.keys(candidateMap);
      if (validKeys.length === 0) {
        setRestoreStatus({
          message: '유효한 레지스터 데이터를 찾을 수 없습니다. 올바른 백업 JSON 파일인지 확인하세요.',
          type: 'error'
        });
        return false;
      }

      let restoredCount = 0;
      setRegisterValues((prev) => {
        const next = { ...prev };
        validKeys.forEach((key) => {
          const rawVal = candidateMap[key];
          const numVal = typeof rawVal === 'number' ? rawVal : parseInt(String(rawVal), 16) || parseInt(String(rawVal), 10);
          if (!isNaN(numVal) && numVal >= 0 && numVal <= 255) {
            next[key] = numVal;
            restoredCount++;
          }
        });
        return next;
      });

      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.2 }
      });

      setRestoreStatus({
        message: `[${currentProfile.name}] ${restoredCount}개 레지스터 설정을 성공적으로 복구했습니다!`,
        type: 'success'
      });
      setTimeout(() => setRestoreStatus(null), 5000);
      return true;
    } catch (err: any) {
      setRestoreStatus({
        message: `복구 실패: JSON 구문 오류 (${err.message || '알 수 없는 오류'})`,
        type: 'error'
      });
      return false;
    }
  };

  // Handle file upload input
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        restoreFromParsedJSON(parsed);
      } catch (err: any) {
        setRestoreStatus({
          message: '선택한 파일이 유효한 JSON 포맷이 아닙니다.',
          type: 'error'
        });
      }
      // Reset input value so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Handle direct text paste restore
  const handlePasteRestore = () => {
    if (!pasteJsonText.trim()) return;
    try {
      const parsed = JSON.parse(pasteJsonText);
      const ok = restoreFromParsedJSON(parsed);
      if (ok) {
        setIsRestoreModalOpen(false);
        setPasteJsonText('');
      }
    } catch (err: any) {
      setRestoreStatus({
        message: 'JSON 텍스트 구문 분석에 실패했습니다. 올바른 JSON 형태인지 확인하세요.',
        type: 'error'
      });
    }
  };

  // Toggle single bit
  const handleToggleBit = (regName: string, bitIndex: number) => {
    setRegisterValues((prev) => {
      const currentVal = prev[regName] ?? 0;
      const mask = 1 << bitIndex;
      const nextVal = (currentVal & mask) ? (currentVal & ~mask) : (currentVal | mask);
      return {
        ...prev,
        [regName]: nextVal
      };
    });
  };

  // Set whole register value directly (from input)
  const handleSetRegValue = (regName: string, val: number) => {
    const clamped = Math.max(0, Math.min(255, isNaN(val) ? 0 : val));
    setRegisterValues((prev) => ({
      ...prev,
      [regName]: clamped
    }));
  };

  // Reset all to defaults
  const handleResetAll = () => {
    const resetVals: { [name: string]: number } = {};
    REGISTER_DATABASE.forEach((r) => {
      resetVals[r.name] = r.defaultVal;
    });
    setRegisterValues(resetVals);
  };

  // Quick preset loader
  const applyPreset = (presetName: string) => {
    setRegisterValues((prev) => {
      const next = { ...prev };
      if (presetName === 'uart_115200') {
        next['UCSR0A'] = 0x02; // U2X0 = 1
        next['UCSR0B'] = (1 << 4) | (1 << 3) | (1 << 7); // RXEN0 | TXEN0 | RXCIE0
        next['UCSR0C'] = (1 << 2) | (1 << 1); // 8N1
      } else if (presetName === 'adc_enable') {
        next['ADCSRA'] = (1 << 7) | (1 << 2) | (1 << 1) | (1 << 0); // ADEN | Prescaler 128
        next['ADMUX'] = (1 << 6); // REFS0 = AVCC with cap
      } else if (presetName === 'spi_master') {
        next['SPCR'] = (1 << 6) | (1 << 4) | (1 << 0); // SPE | MSTR | SPR0 (4MHz)
        next['SPSR'] = (1 << 0); // SPI2X
      } else if (presetName === 'gpio_output_led') {
        next['DDRB'] = 0xFF; // All PB pins as output
        next['PORTB'] = 0x20; // PB5 High (Uno LED)
      } else if (presetName === 'timer1_ctc') {
        next['TCCR1B'] = (1 << 3) | (1 << 2) | (1 << 0); // WGM12 (CTC) | CS12 | CS10 (1024 Prescaler)
        next['SREG'] = 0x80; // Global Interrupt Enabled
      }
      return next;
    });
  };

  // Filtered registers
  const filteredRegisters = useMemo(() => {
    return REGISTER_DATABASE.filter((reg) => {
      if (reg.mcuSupport && !reg.mcuSupport.includes(selectedMCU)) {
        return false;
      }
      const matchesCat = selectedCategory === 'all' || reg.category === selectedCategory;
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        reg.name.toLowerCase().includes(q) ||
        reg.desc.toLowerCase().includes(q) ||
        reg.bits.some((b) => b.name.toLowerCase().includes(q) || b.desc.toLowerCase().includes(q));

      return matchesCat && matchesSearch;
    });
  }, [selectedCategory, searchTerm, selectedMCU]);

  // Compute modified registers count
  const modifiedCount = useMemo(() => {
    let count = 0;
    REGISTER_DATABASE.forEach((r) => {
      if ((registerValues[r.name] ?? r.defaultVal) !== r.defaultVal) {
        count++;
      }
    });
    return count;
  }, [registerValues]);

  // Generate live C code snippet for all currently altered or active registers
  const liveCodeSnippet = useMemo(() => {
    const lines: string[] = [
      `// ========================================================`,
      `// [${currentProfile.name}] 실시간 레지스터 초기화 C 코드 스니펫`,
      `// 데이터시트 비트 플래그 매핑 자동 생성기`,
      `// ========================================================`,
      `#include <avr/io.h>`,
      ``,
      `void Register_Hardware_Init(void) {`
    ];

    let hasLines = false;
    REGISTER_DATABASE.forEach((reg) => {
      const val = registerValues[reg.name] ?? reg.defaultVal;
      // If register has been modified or is important (e.g., ADCSRA, UCSR0B with non-zero bits)
      if (val !== 0) {
        const activeBits: string[] = [];
        reg.bits.forEach((b) => {
          if ((val & (1 << b.bit)) && b.name && !b.name.startsWith('Res')) {
            activeBits.push(`(1 << ${b.name})`);
          }
        });

        const bitExpr = activeBits.length > 0 ? activeBits.join(' | ') : `0x${val.toString(16).toUpperCase().padStart(2, '0')}`;
        lines.push(`    // ${reg.name} (${reg.desc.split('(')[0].trim()})`);
        lines.push(`    ${reg.name} = ${bitExpr}; // 0x${val.toString(16).toUpperCase().padStart(2, '0')} (0b${val.toString(2).padStart(8, '0')})`);
        lines.push(``);
        hasLines = true;
      }
    });

    if (!hasLines) {
      lines.push(`    // (모든 레지스터가 출하 리셋 기본값 0x00 상태입니다)`);
    }

    lines.push(`}`);
    return lines.join('\n');
  }, [registerValues, currentProfile.name]);

  const copyLiveSnippet = () => {
    navigator.clipboard.writeText(liveCodeSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const categories = [
    { id: 'all', label: '전체 레지스터' },
    { id: 'gpio', label: 'GPIO 포트 (PORT/DDR)' },
    { id: 'adc', label: 'ADC 아날로그' },
    { id: 'usart', label: 'USART0 시리얼' },
    { id: 'spi', label: 'SPI 통신' },
    { id: 'twi', label: 'TWI (I2C)' },
    { id: 'timer', label: '타이머1 (16비트)' },
    { id: 'system', label: 'SREG (글로벌 상태)' }
  ];

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* Dashboard Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-2">
            <Activity className="w-3.5 h-3.5" /> 실시간 레지스터 상태 대시보드 (Live Bit Monitor)
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            {currentProfile.name} SFR 비트 상태 실시간 인스펙터
            {modifiedCount > 0 && (
              <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-mono font-normal">
                {modifiedCount}개 레지스터 변경됨
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            데이터시트 기준 SFR(Special Function Register)의 8비트 플래그를 개별 클릭하여 실시간으로 토글하고,
            Hex(16진수), Binary(2진수), 십진수 값의 변화 및 동작 의미를 즉각 검증할 수 있습니다.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Hidden File Input for JSON restore */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={exportJSON}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white text-xs font-semibold transition border border-slate-700 shadow-sm"
            title="현재 레지스터 전체 설정을 JSON 파일로 백업 다운로드"
          >
            <FileJson className="w-3.5 h-3.5 text-amber-400" />
            JSON 백업 다운로드
          </button>

          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white text-xs font-semibold transition border border-slate-700 shadow-sm"
            title="현재 레지스터 전체 상태를 CSV(엑셀 호환) 파일로 내보내기"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
            CSV 상태 내보내기
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 hover:text-white text-xs font-semibold transition border border-indigo-700/60 shadow-sm"
            title="이전에 백업한 JSON 파일을 업로드하여 레지스터 설정 복구"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            JSON 백업 복구
          </button>

          <button
            onClick={handleResetAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition border border-slate-700 shadow-sm"
            title="모든 레지스터를 데이터시트 초기 출하값으로 리셋"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            초기 리셋값 복원
          </button>

          <button
            onClick={copyLiveSnippet}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20"
          >
            {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedSnippet ? 'C 코드 복사됨!' : '설정 C 코드 복사'}
          </button>
        </div>
      </div>

      {/* Restore Status Alert Banner */}
      {restoreStatus && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
            restoreStatus.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300 shadow-md shadow-emerald-900/20'
              : 'bg-rose-950/70 border-rose-500/40 text-rose-300 shadow-md shadow-rose-900/20'
          }`}
        >
          <div className="flex items-center gap-2">
            {restoreStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{restoreStatus.message}</span>
          </div>
          <button
            onClick={() => setRestoreStatus(null)}
            className="text-slate-400 hover:text-white text-xs font-mono ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Quick Preset Selector Bar */}
      <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <span className="text-slate-400 font-semibold flex items-center gap-1.5 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 빠른 동작 프리셋 로드:
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => applyPreset('uart_115200')}
            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 hover:border-amber-500/40 rounded-lg transition font-mono text-[11px]"
          >
            ⚡ UART 115200 8N1 + RX/TX
          </button>
          <button
            onClick={() => applyPreset('adc_enable')}
            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-800 hover:border-emerald-500/40 rounded-lg transition font-mono text-[11px]"
          >
            ⚡ ADC 128분주 + AVCC
          </button>
          <button
            onClick={() => applyPreset('spi_master')}
            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 hover:border-cyan-500/40 rounded-lg transition font-mono text-[11px]"
          >
            ⚡ SPI 마스터 4MHz 모드0
          </button>
          <button
            onClick={() => applyPreset('gpio_output_led')}
            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-rose-300 border border-slate-800 hover:border-rose-500/40 rounded-lg transition font-mono text-[11px]"
          >
            ⚡ PORTB 출력 + PB5 High
          </button>
          <button
            onClick={() => applyPreset('timer1_ctc')}
            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-slate-800 hover:border-indigo-500/40 rounded-lg transition font-mono text-[11px]"
          >
            ⚡ Timer1 CTC + 1024분주 + SREG.I
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        {/* Categories */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500 flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" /> 모듈:
          </span>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition border ${
                selectedCategory === c.id
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm shadow-amber-500/20'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="레지스터/비트 검색 (ADEN, U2X, SPE...)"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Register Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRegisters.length === 0 ? (
          <div className="col-span-2 text-center py-10 bg-slate-950/60 rounded-xl border border-slate-800 text-slate-500 text-xs">
            검색어와 일치하는 레지스터가 없습니다.
          </div>
        ) : (
          filteredRegisters.map((reg) => {
            const currentVal = registerValues[reg.name] ?? reg.defaultVal;
            const isModified = currentVal !== reg.defaultVal;
            const hexStr = '0x' + currentVal.toString(16).toUpperCase().padStart(2, '0');
            const binStr = currentVal.toString(2).padStart(8, '0');

            return (
              <div
                key={reg.name}
                id={`register-card-${reg.name}`}
                className={`bg-slate-950/80 rounded-2xl border p-4.5 transition-all shadow-md flex flex-col justify-between scroll-mt-24 ${
                  isModified
                    ? 'border-amber-500/50 ring-1 ring-amber-500/20 shadow-amber-500/5'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Top Register Info Row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-base text-white tracking-wider">
                        {reg.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
                        {reg.addr}
                      </span>
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded font-sans font-medium">
                        {reg.categoryLabel}
                      </span>
                    </div>

                    {/* Numeric Hex/Dec input & details button */}
                    <div className="flex items-center gap-2 font-mono">
                      <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-xs">
                        <span className="text-amber-400 font-bold">{hexStr}</span>
                        <span className="text-slate-600 mx-1.5">|</span>
                        <span className="text-slate-400 text-[11px]">{currentVal}d</span>
                      </div>
                      <button
                        onClick={() => setActiveRegModal(reg)}
                        className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition"
                        title="데이터시트 비트 상세 명세서 보기"
                      >
                        <Info className="w-3.5 h-3.5 text-slate-400 hover:text-amber-400" />
                      </button>
                    </div>
                  </div>

                  {/* Register Short Description */}
                  <p className="text-[11px] text-slate-400 mb-3.5 leading-snug line-clamp-1">
                    {reg.desc}
                  </p>

                  {/* Interactive 8-Bit Strip (Bits 7 to 0) */}
                  <div className="space-y-1 mb-3">
                    <div className="grid grid-cols-8 gap-1 text-center font-mono">
                      {[7, 6, 5, 4, 3, 2, 1, 0].map((bitIdx) => {
                        const bitDef = reg.bits.find((b) => b.bit === bitIdx);
                        const isSet = (currentVal & (1 << bitIdx)) !== 0;
                        const bitName = bitDef?.name || `b${bitIdx}`;

                        return (
                          <button
                            key={bitIdx}
                            onClick={() => handleToggleBit(reg.name, bitIdx)}
                            className={`flex flex-col items-center justify-between p-1.5 rounded-xl border text-center transition-all ${
                              isSet
                                ? 'bg-amber-500 text-slate-950 font-black border-amber-400 shadow-md shadow-amber-500/20 scale-[1.02]'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                            }`}
                            title={`Bit ${bitIdx}: ${bitName} - ${bitDef?.desc || ''}\n현재: ${isSet ? '1 (활성)' : '0 (해제)'}`}
                          >
                            <span className="text-[9px] uppercase tracking-tighter truncate w-full font-bold">
                              {bitName}
                            </span>
                            <span className={`text-xs my-0.5 font-mono ${isSet ? 'font-black' : 'text-slate-500'}`}>
                              {isSet ? '1' : '0'}
                            </span>
                            <span className="text-[8px] opacity-70">
                              b{bitIdx}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Bottom Active Flags Breakdown */}
                <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800/80 text-[11px] font-sans">
                  <div className="flex items-center justify-between text-slate-500 text-[10px] font-mono mb-1">
                    <span>현재 활성 플래그 요약:</span>
                    <span className="text-slate-400">0b{binStr.slice(0, 4)} {binStr.slice(4)}</span>
                  </div>
                  <div className="text-slate-300 flex flex-wrap gap-1 text-[10px]">
                    {reg.bits.filter((b) => (currentVal & (1 << b.bit)) !== 0).length === 0 ? (
                      <span className="text-slate-500 italic">설정된 비트 없음 (0x00)</span>
                    ) : (
                      reg.bits
                        .filter((b) => (currentVal & (1 << b.bit)) !== 0)
                        .map((b) => (
                          <span
                            key={b.bit}
                            className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono"
                          >
                            <span className="font-bold">{b.name}</span>: {b.onMeaning.split('(')[0]}
                          </span>
                        ))
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Real-time Code Output Section */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="bg-slate-900/80 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-white">
              실시간 레지스터 비트 매핑 C 언어 초기화 루틴
            </span>
          </div>
          <button
            onClick={copyLiveSnippet}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
          >
            {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedSnippet ? '복사됨' : '복사'}
          </button>
        </div>
        <pre className="p-4 text-[11px] font-mono text-emerald-300/90 leading-relaxed overflow-x-auto max-h-56 custom-scrollbar">
          <code>{liveCodeSnippet}</code>
        </pre>
      </div>

      {/* Modal / Slide-over: Detailed Register Datasheet Bit Inspector */}
      {activeRegModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-mono font-black text-white">{activeRegModal.name}</h4>
                  <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    주소: {activeRegModal.addr}
                  </span>
                  <span className="text-xs text-amber-400 font-sans font-medium">
                    {activeRegModal.categoryLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{activeRegModal.desc}</p>
              </div>
              <button
                onClick={() => setActiveRegModal(null)}
                className="text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-bold"
              >
                닫기
              </button>
            </div>

            {/* Bit Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] font-mono">
                    <th className="p-2.5 w-12">Bit</th>
                    <th className="p-2.5 w-20">비트명</th>
                    <th className="p-2.5 w-14">R/W</th>
                    <th className="p-2.5 w-16">리셋값</th>
                    <th className="p-2.5">데이터시트 설명 & 기능</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans text-xs">
                  {activeRegModal.bits.map((b) => {
                    const isSet = ((registerValues[activeRegModal.name] ?? activeRegModal.defaultVal) & (1 << b.bit)) !== 0;

                    return (
                      <tr key={b.bit} className={isSet ? 'bg-amber-500/5' : 'hover:bg-slate-800/40'}>
                        <td className="p-2.5 font-mono text-slate-400 font-bold">{b.bit}</td>
                        <td className="p-2.5 font-mono font-bold text-amber-400">{b.name}</td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-500">{b.rw}</td>
                        <td className="p-2.5 font-mono text-slate-400">{b.reset}</td>
                        <td className="p-2.5 space-y-1">
                          <div className="text-slate-200 font-medium">{b.desc}</div>
                          <div className="text-[11px] text-slate-400">
                            • <span className="text-emerald-400">1 (Set):</span> {b.onMeaning}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            • <span className="text-slate-500">0 (Clear):</span> {b.offMeaning}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setActiveRegModal(null)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition"
              >
                확인 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
