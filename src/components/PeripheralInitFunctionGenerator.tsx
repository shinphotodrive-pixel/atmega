import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  FileCode2,
  Copy,
  Check,
  Code2,
  Cpu,
  Zap,
  Sliders,
  Sparkles,
  Settings,
  ShieldCheck,
  RotateCcw,
  BookOpen,
  Layers,
  Clock,
  Radio,
  Download,
  Info,
  ChevronDown,
  ChevronRight,
  Terminal,
  Activity
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
}

export type CodeStyle = 'bitwise_macro' | 'hex_macro' | 'compound_or';

interface ModuleRegisterBit {
  name: string;
  bitIndex: number;
  desc: string;
}

interface ModuleRegisterDef {
  name: string;
  desc: string;
  defaultVal: number;
  bits: ModuleRegisterBit[];
}

interface PeripheralModuleDef {
  id: string;
  name: string;
  koreanName: string;
  category: string;
  description: string;
  iconName: string;
  registers: ModuleRegisterDef[];
}

export const PeripheralInitFunctionGenerator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Customization Options
  const [funcName, setFuncName] = useState<string>('init_peripherals');
  const [codeStyle, setCodeStyle] = useState<CodeStyle>('bitwise_macro');
  const [includeComments, setIncludeComments] = useState<boolean>(true);
  const [includeHeaders, setIncludeHeaders] = useState<boolean>(true);
  const [includeSei, setIncludeSei] = useState<boolean>(true);
  const [includeAtomicSafety, setIncludeAtomicSafety] = useState<boolean>(true);
  const [includeHeaderPrototype, setIncludeHeaderPrototype] = useState<boolean>(false);
  const [includeArduinoSetup, setIncludeArduinoSetup] = useState<boolean>(false);

  // Enabled modules map
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({
    gpio: true,
    timer0: true,
    timer1: false,
    usart0: true,
    spi: false,
    twi: false,
    adc: true,
    wdt: false,
    extint: false
  });

  // Collapsed state for module cards
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    gpio: true,
    timer0: true,
    timer1: false,
    usart0: false,
    spi: false,
    twi: false,
    adc: false,
    wdt: false,
    extint: false
  });

  // Bit toggle values map: key = `${regName}_${bitIndex}`, value = boolean
  const [registerBits, setRegisterBits] = useState<Record<string, boolean>>({
    // GPIO initial (DDRB5 output for LED, PORTD2 pullup)
    DDRB_5: true,
    PORTD_2: true,
    // Timer0 Fast PWM (COM0A1=1, WGM01=1, WGM00=1, CS01=1, CS00=1 -> 64 prescaler)
    TCCR0A_7: true, // COM0A1
    TCCR0A_1: true, // WGM01
    TCCR0A_0: true, // WGM00
    TCCR0B_1: true, // CS01
    TCCR0B_0: true, // CS00
    // USART0 9600 8N1 @ 16MHz (RXEN0=1, TXEN0=1, UCSZ01=1, UCSZ00=1)
    UCSR0B_4: true, // RXEN0
    UCSR0B_3: true, // TXEN0
    UCSR0C_2: true, // UCSZ01
    UCSR0C_1: true, // UCSZ00
    // ADC Enable, Prescaler 128 (ADEN=1, ADPS2=1, ADPS1=1, ADPS0=1, REFS0=1)
    ADCSRA_7: true, // ADEN
    ADCSRA_2: true, // ADPS2
    ADCSRA_1: true, // ADPS1
    ADCSRA_0: true, // ADPS0
    ADMUX_6: true   // REFS0 (AVCC with external capacitor)
  });

  // Numeric register values (e.g. UBRR0 = 103, OCR0A = 128)
  const [numericRegisters, setNumericRegisters] = useState<Record<string, number>>({
    UBRR0: 103, // 9600 baud @ 16MHz
    OCR0A: 128, // 50% PWM duty
    OCR1A: 1000,
    TWBR: 72    // 100kHz I2C @ 16MHz
  });

  const [copied, setCopied] = useState<boolean>(false);
  const [copiedHeader, setCopiedHeader] = useState<boolean>(false);

  // Peripheral Definitions based on MCU
  const peripheralDefinitions: PeripheralModuleDef[] = useMemo(() => {
    const isM128 = selectedMCU === 'atmega128';
    const timsk0Name = isM128 ? 'TIMSK' : 'TIMSK0';
    const timsk1Name = isM128 ? 'TIMSK' : 'TIMSK1';
    const wdtRegName = isM128 ? 'WDTCR' : 'WDTCSR';
    const extIntRegA = isM128 ? 'EICRA' : 'EICRA';
    const extMaskReg = isM128 ? 'EIMSK' : 'EIMSK';

    return [
      {
        id: 'gpio',
        name: 'GPIO (I/O Ports)',
        koreanName: '디지털 입출력 포트 (DDR / PORT)',
        category: '기본 I/O',
        iconName: 'Cpu',
        description: '포트 방향(출력/입력) 및 내부 풀업 저항 설정',
        registers: [
          {
            name: 'DDRB',
            desc: 'Port B 데이터 방향 레지스터 (1=출력, 0=입력)',
            defaultVal: 0x00,
            bits: [
              { name: 'DDB7', bitIndex: 7, desc: 'PB7 (XTAL2 / Pin 13 in Mega)' },
              { name: 'DDB6', bitIndex: 6, desc: 'PB6 (XTAL1 / Pin 12 in Mega)' },
              { name: 'DDB5', bitIndex: 5, desc: 'PB5 (Arduino D13 Onboard LED / SCK)' },
              { name: 'DDB4', bitIndex: 4, desc: 'PB4 (MISO / D12)' },
              { name: 'DDB3', bitIndex: 3, desc: 'PB3 (MOSI / OC2A / D11)' },
              { name: 'DDB2', bitIndex: 2, desc: 'PB2 (SS / OC1B / D10)' },
              { name: 'DDB1', bitIndex: 1, desc: 'PB1 (OC1A / D9)' },
              { name: 'DDB0', bitIndex: 0, desc: 'PB0 (ICP1 / D8)' }
            ]
          },
          {
            name: 'PORTB',
            desc: 'Port B 출력 데이터 / 풀업 활성화 레지스터',
            defaultVal: 0x00,
            bits: [
              { name: 'PORTB7', bitIndex: 7, desc: 'PB7 High 출력 또는 입력 시 풀업' },
              { name: 'PORTB6', bitIndex: 6, desc: 'PB6 High 출력 또는 입력 시 풀업' },
              { name: 'PORTB5', bitIndex: 5, desc: 'PB5 High 출력 (LED On)' },
              { name: 'PORTB4', bitIndex: 4, desc: 'PB4 High 출력 또는 풀업' },
              { name: 'PORTB3', bitIndex: 3, desc: 'PB3 High 출력 또는 풀업' },
              { name: 'PORTB2', bitIndex: 2, desc: 'PB2 High 출력 또는 풀업' },
              { name: 'PORTB1', bitIndex: 1, desc: 'PB1 High 출력 또는 풀업' },
              { name: 'PORTB0', bitIndex: 0, desc: 'PB0 High 출력 또는 풀업' }
            ]
          },
          {
            name: 'DDRD',
            desc: 'Port D 데이터 방향 레지스터',
            defaultVal: 0x00,
            bits: [
              { name: 'DDD7', bitIndex: 7, desc: 'PD7 출력' },
              { name: 'DDD6', bitIndex: 6, desc: 'PD6 출력 (OC0A)' },
              { name: 'DDD5', bitIndex: 5, desc: 'PD5 출력 (OC0B)' },
              { name: 'DDD4', bitIndex: 4, desc: 'PD4 출력 (XCK/T0)' },
              { name: 'DDD3', bitIndex: 3, desc: 'PD3 출력 (INT1/OC2B)' },
              { name: 'DDD2', bitIndex: 2, desc: 'PD2 (INT0 / 버튼 입력)' },
              { name: 'DDD1', bitIndex: 1, desc: 'PD1 (TXD0 출력)' },
              { name: 'DDD0', bitIndex: 0, desc: 'PD0 (RXD0 입력)' }
            ]
          },
          {
            name: 'PORTD',
            desc: 'Port D 출력 데이터 / 풀업 활성화 레지스터',
            defaultVal: 0x00,
            bits: [
              { name: 'PORTD7', bitIndex: 7, desc: 'PD7 출력 상태' },
              { name: 'PORTD6', bitIndex: 6, desc: 'PD6 출력 상태' },
              { name: 'PORTD5', bitIndex: 5, desc: 'PD5 출력 상태' },
              { name: 'PORTD4', bitIndex: 4, desc: 'PD4 출력 상태' },
              { name: 'PORTD3', bitIndex: 3, desc: 'PD3 풀업' },
              { name: 'PORTD2', bitIndex: 2, desc: 'PD2 내부 풀업 활성화 (외부 버튼)' },
              { name: 'PORTD1', bitIndex: 1, desc: 'PD1 TX 초기 High 상태' },
              { name: 'PORTD0', bitIndex: 0, desc: 'PD0 풀업' }
            ]
          }
        ]
      },
      {
        id: 'timer0',
        name: 'Timer/Counter0 (8-bit)',
        koreanName: '타이머/카운터 0 (Fast PWM / CTC)',
        category: '타이머',
        iconName: 'Clock',
        description: '밀리초(millis) 틱 타임베이스, 고속 PWM 출력 및 오버플로우 인터럽트',
        registers: [
          {
            name: 'TCCR0A',
            desc: '타이머0 제어 레지스터 A (비교 출력 모드 & WGM 파형 모드)',
            defaultVal: 0x00,
            bits: [
              { name: 'COM0A1', bitIndex: 7, desc: 'OC0A 비반전 비교 일치 출력' },
              { name: 'COM0A0', bitIndex: 6, desc: 'OC0A 반전 출력 또는 토글' },
              { name: 'COM0B1', bitIndex: 5, desc: 'OC0B 비반전 비교 일치 출력' },
              { name: 'COM0B0', bitIndex: 4, desc: 'OC0B 반전 출력' },
              { name: 'WGM01', bitIndex: 1, desc: 'WGM01 파형 모드 비트 1 (Fast PWM/CTC)' },
              { name: 'WGM00', bitIndex: 0, desc: 'WGM00 파형 모드 비트 0 (Fast PWM)' }
            ]
          },
          {
            name: 'TCCR0B',
            desc: '타이머0 제어 레지스터 B (클럭 프리스케일러 선택 & FOC)',
            defaultVal: 0x00,
            bits: [
              { name: 'FOC0A', bitIndex: 7, desc: '강제 비교일치 A' },
              { name: 'FOC0B', bitIndex: 6, desc: '강제 비교일치 B' },
              { name: 'WGM02', bitIndex: 3, desc: 'WGM02 파형 모드 최상위 비트 (TOP=OCR0A)' },
              { name: 'CS02', bitIndex: 2, desc: '클럭 소스 2 (256/1024 분주)' },
              { name: 'CS01', bitIndex: 1, desc: '클럭 소스 1 (8/64 분주)' },
              { name: 'CS00', bitIndex: 0, desc: '클럭 소스 0 (분주 없음/64/1024 분주)' }
            ]
          },
          {
            name: timsk0Name,
            desc: `${timsk0Name} 타이머 인터럽트 마스크 레지스터`,
            defaultVal: 0x00,
            bits: [
              { name: isM128 ? 'OCIE0' : 'OCIE0B', bitIndex: 2, desc: '비교일치 B 인터럽트 허용' },
              { name: isM128 ? 'OCIE0' : 'OCIE0A', bitIndex: 1, desc: '비교일치 A 인터럽트 허용' },
              { name: isM128 ? 'TOIE0' : 'TOIE0', bitIndex: 0, desc: '오버플로우 인터럽트 허용 (Timer0 Overflow)' }
            ]
          }
        ]
      },
      {
        id: 'timer1',
        name: 'Timer/Counter1 (16-bit)',
        koreanName: '16비트 타이머 1 (정밀 서보 PWM / 캡처)',
        category: '타이머',
        iconName: 'Clock',
        description: '16비트 고해상도 주기 제어, 서보모터 구동 (ICR1 TOP 설정) 및 주파수 계측',
        registers: [
          {
            name: 'TCCR1A',
            desc: '타이머1 제어 레지스터 A',
            defaultVal: 0x00,
            bits: [
              { name: 'COM1A1', bitIndex: 7, desc: 'OC1A 비반전 출력' },
              { name: 'COM1A0', bitIndex: 6, desc: 'OC1A 반전/토글 출력' },
              { name: 'COM1B1', bitIndex: 5, desc: 'OC1B 비반전 출력' },
              { name: 'COM1B0', bitIndex: 4, desc: 'OC1B 반전 출력' },
              { name: 'WGM11', bitIndex: 1, desc: '파형 모드 WGM11' },
              { name: 'WGM10', bitIndex: 0, desc: '파형 모드 WGM10' }
            ]
          },
          {
            name: 'TCCR1B',
            desc: '타이머1 제어 레지스터 B (분주비 및 입력 캡처)',
            defaultVal: 0x00,
            bits: [
              { name: 'ICNC1', bitIndex: 7, desc: '입력 캡처 노이즈 캔슬러' },
              { name: 'ICES1', bitIndex: 6, desc: '입력 캡처 에지 선택 (1=상승, 0=하강)' },
              { name: 'WGM13', bitIndex: 4, desc: 'WGM13 (Mode 14: ICR1 TOP Fast PWM)' },
              { name: 'WGM12', bitIndex: 3, desc: 'WGM12 (CTC / Fast PWM 모드)' },
              { name: 'CS12', bitIndex: 2, desc: 'CS12 클럭 분주 선택' },
              { name: 'CS11', bitIndex: 1, desc: 'CS11 클럭 분주 선택 (8분주 등)' },
              { name: 'CS10', bitIndex: 0, desc: 'CS10 클럭 분주 선택' }
            ]
          },
          {
            name: timsk1Name,
            desc: `${timsk1Name} 16비트 타이머 인터럽트 마스크`,
            defaultVal: 0x00,
            bits: [
              { name: 'ICIE1', bitIndex: 5, desc: '입력 캡처 인터럽트 허용' },
              { name: 'OCIE1B', bitIndex: 2, desc: '비교일치 B 인터럽트 허용' },
              { name: 'OCIE1A', bitIndex: 1, desc: '비교일치 A 인터럽트 허용 (CTC 주기 ISR)' },
              { name: 'TOIE1', bitIndex: 0, desc: '오버플로우 인터럽트 허용' }
            ]
          }
        ]
      },
      {
        id: 'usart0',
        name: 'USART0 (UART Serial)',
        koreanName: '시리얼 비동기 통신 (UART 0)',
        category: '통신',
        iconName: 'Radio',
        description: 'PC 디버그 콘솔 및 센서 통신 (보드레이트, 송수신 버퍼 인터럽트)',
        registers: [
          {
            name: 'UCSR0A',
            desc: 'USART0 제어 및 상태 레지스터 A',
            defaultVal: 0x00,
            bits: [
              { name: 'RXC0', bitIndex: 7, desc: '수신 완료 플래그 (Read Only)' },
              { name: 'TXC0', bitIndex: 6, desc: '송신 완료 플래그' },
              { name: 'UDRE0', bitIndex: 5, desc: '데이터 레지스터 빈 상태 플래그' },
              { name: 'FE0', bitIndex: 4, desc: '프레임 에러' },
              { name: 'DOR0', bitIndex: 3, desc: '데이터 오버런 에러' },
              { name: 'UPE0', bitIndex: 2, desc: '패리티 에러' },
              { name: 'U2X0', bitIndex: 1, desc: '배속 모드 전송 (Double Speed, 8분주)' },
              { name: 'MPCM0', bitIndex: 0, desc: '멀티 프로세서 통신 모드' }
            ]
          },
          {
            name: 'UCSR0B',
            desc: 'USART0 제어 레지스터 B (송수신 인에이블 & 인터럽트)',
            defaultVal: 0x00,
            bits: [
              { name: 'RXCIE0', bitIndex: 7, desc: '수신 완료 인터럽트 허용 (USART_RX_vect)' },
              { name: 'TXCIE0', bitIndex: 6, desc: '송신 완료 인터럽트 허용' },
              { name: 'UDRIE0', bitIndex: 5, desc: '데이터 버퍼 빈 인터럽트 허용' },
              { name: 'RXEN0', bitIndex: 4, desc: '수신기(RX) 활성화' },
              { name: 'TXEN0', bitIndex: 3, desc: '송신기(TX) 활성화' },
              { name: 'UCSZ02', bitIndex: 2, desc: '문자 크기 최상위 비트 (9비트 전송)' }
            ]
          },
          {
            name: 'UCSR0C',
            desc: 'USART0 제어 레지스터 C (프레임 포맷 8N1)',
            defaultVal: 0x06,
            bits: [
              { name: 'UMSEL01', bitIndex: 7, desc: '모드 선택 1 (동기식/SPI 마스터)' },
              { name: 'UMSEL00', bitIndex: 6, desc: '모드 선택 0 (00=비동기 UART)' },
              { name: 'UPM01', bitIndex: 5, desc: '패리티 모드 1 (00=비활성)' },
              { name: 'UPM00', bitIndex: 4, desc: '패리티 모드 0' },
              { name: 'USBS0', bitIndex: 3, desc: '스톱 비트 선택 (0=1비트, 1=2비트)' },
              { name: 'UCSZ01', bitIndex: 2, desc: '문자 크기 비트 1 (8-bit=1)' },
              { name: 'UCSZ00', bitIndex: 1, desc: '문자 크기 비트 0 (8-bit=1)' }
            ]
          }
        ]
      },
      {
        id: 'spi',
        name: 'SPI (Serial Peripheral Interface)',
        koreanName: '고속 동기 통신 버스 (SPI 마스터)',
        category: '통신',
        iconName: 'Zap',
        description: 'SD카드, 디스플레이, 무선 트랜시버(NRF24L01) 연동 고속 직렬 버스',
        registers: [
          {
            name: 'SPCR',
            desc: 'SPI 제어 레지스터 (Master/Slave, 클럭 위상/극성, 주파수 분주비)',
            defaultVal: 0x00,
            bits: [
              { name: 'SPIE', bitIndex: 7, desc: 'SPI 인터럽트 허용' },
              { name: 'SPE', bitIndex: 6, desc: 'SPI 모듈 활성화 (SPI Enable)' },
              { name: 'DORD', bitIndex: 5, desc: '데이터 순서 (1=LSB First, 0=MSB First)' },
              { name: 'MSTR', bitIndex: 4, desc: '마스터/슬레이브 선택 (1=Master, 0=Slave)' },
              { name: 'CPOL', bitIndex: 3, desc: '클럭 극성 (1=SCK High 유휴상태)' },
              { name: 'CPHA', bitIndex: 2, desc: '클럭 위상 (1=후행 에지 샘플링)' },
              { name: 'SPR1', bitIndex: 1, desc: '클럭 레이트 분주비 1' },
              { name: 'SPR0', bitIndex: 0, desc: '클럭 레이트 분주비 0' }
            ]
          },
          {
            name: 'SPSR',
            desc: 'SPI 상태 레지스터 (배속 클럭 모드)',
            defaultVal: 0x00,
            bits: [
              { name: 'SPIF', bitIndex: 7, desc: '전송 완료 플래그 (Read Only)' },
              { name: 'WCOL', bitIndex: 6, desc: '쓰기 충돌 플래그' },
              { name: 'SPI2X', bitIndex: 0, desc: 'SPI 클럭 2배속 모드 (Double Speed)' }
            ]
          }
        ]
      },
      {
        id: 'twi',
        name: 'TWI / I2C (Two-Wire Interface)',
        koreanName: '2선식 시리얼 통신 버스 (I2C Master)',
        category: '통신',
        iconName: 'Layers',
        description: '온습도 센서, RTC 시계, EEPROM 연동 표준 100k/400kHz I2C 인터페이스',
        registers: [
          {
            name: 'TWSR',
            desc: 'TWI 상태 레지스터 (상태 코드 & 분주비 TWPS1:0)',
            defaultVal: 0x00,
            bits: [
              { name: 'TWPS1', bitIndex: 1, desc: '프리스케일러 비트 1' },
              { name: 'TWPS0', bitIndex: 0, desc: '프리스케일러 비트 0 (00=1분주)' }
            ]
          },
          {
            name: 'TWCR',
            desc: 'TWI 제어 레지스터 (시작/정지 조건, ACK 응답 및 인터럽트)',
            defaultVal: 0x00,
            bits: [
              { name: 'TWINT', bitIndex: 7, desc: 'TWI 인터럽트 플래그 (1 쓰면 클리어)' },
              { name: 'TWEA', bitIndex: 6, desc: 'ACK 자동 생성 허용' },
              { name: 'TWSTA', bitIndex: 5, desc: 'START 조건 전송' },
              { name: 'TWSTO', bitIndex: 4, desc: 'STOP 조건 전송' },
              { name: 'TWWC', bitIndex: 3, desc: '쓰기 충돌 플래그' },
              { name: 'TWEN', bitIndex: 2, desc: 'TWI 인터페이스 활성화' },
              { name: 'TWIE', bitIndex: 0, desc: 'TWI 인터럽트 허용' }
            ]
          }
        ]
      },
      {
        id: 'adc',
        name: 'ADC (Analog-to-Digital Converter)',
        koreanName: '아날로그 디지털 변환기 (ADC)',
        category: '아날로그',
        iconName: 'Activity',
        description: '10비트 SAR 아날로그 전압 측정, 기준 전압(Vref) 선택 및 클럭 프리스케일러',
        registers: [
          {
            name: 'ADMUX',
            desc: 'ADC 멀티플렉서 선택 레지스터 (Vref 선택, 결과 정렬, 채널 선택)',
            defaultVal: 0x00,
            bits: [
              { name: 'REFS1', bitIndex: 7, desc: '기준전압 선택 비트 1' },
              { name: 'REFS0', bitIndex: 6, desc: '기준전압 선택 비트 0 (01=AVCC + C at AREF)' },
              { name: 'ADLAR', bitIndex: 5, desc: 'ADC 결과 좌측 정렬 (1=8비트 정밀도 고속 읽기)' },
              { name: 'MUX3', bitIndex: 3, desc: '채널 선택 MUX3' },
              { name: 'MUX2', bitIndex: 2, desc: '채널 선택 MUX2' },
              { name: 'MUX1', bitIndex: 1, desc: '채널 선택 MUX1' },
              { name: 'MUX0', bitIndex: 0, desc: '채널 선택 MUX0 (0000=ADC0)' }
            ]
          },
          {
            name: 'ADCSRA',
            desc: 'ADC 제어 및 상태 레지스터 A (변환 활성화, 시작, 인터럽트, 분주비)',
            defaultVal: 0x00,
            bits: [
              { name: 'ADEN', bitIndex: 7, desc: 'ADC 모듈 활성화 (ADC Enable)' },
              { name: 'ADSC', bitIndex: 6, desc: '변환 시작 (Start Conversion)' },
              { name: 'ADATE', bitIndex: 5, desc: '자동 트리거 활성화' },
              { name: 'ADIF', bitIndex: 4, desc: '변환 완료 인터럽트 플래그' },
              { name: 'ADIE', bitIndex: 3, desc: '변환 완료 인터럽트 허용' },
              { name: 'ADPS2', bitIndex: 2, desc: '클럭 프리스케일러 2' },
              { name: 'ADPS1', bitIndex: 1, desc: '클럭 프리스케일러 1' },
              { name: 'ADPS0', bitIndex: 0, desc: '클럭 프리스케일러 0 (111=128분주, 16MHz/128=125kHz)' }
            ]
          }
        ]
      },
      {
        id: 'wdt',
        name: 'Watchdog Timer (WDT)',
        koreanName: '워치독 타이머 (시스템 먹통 방지 & 리셋)',
        category: '시스템',
        iconName: 'ShieldCheck',
        description: '무한 루프 방지 자동 하드웨어 리셋 또는 주기적 저전력 기상 인터럽트',
        registers: [
          {
            name: wdtRegName,
            desc: `${wdtRegName} 워치독 타이머 제어 레지스터`,
            defaultVal: 0x00,
            bits: [
              { name: isM128 ? 'WDIF' : 'WDIF', bitIndex: 7, desc: '워치독 인터럽트 플래그' },
              { name: isM128 ? 'WDIE' : 'WDIE', bitIndex: 6, desc: '워치독 인터럽트 모드 허용 (기상용)' },
              { name: isM128 ? 'WDCE' : 'WDCE', bitIndex: 4, desc: '설정 변경 안전 비트 (Change Enable, 4클럭 유효)' },
              { name: isM128 ? 'WDE' : 'WDE', bitIndex: 3, desc: '시스템 리셋 모드 활성화 (Watchdog Reset)' },
              { name: 'WDP3', bitIndex: 5, desc: '타임아웃 프리스케일러 비트 3' },
              { name: 'WDP2', bitIndex: 2, desc: '타임아웃 프리스케일러 비트 2' },
              { name: 'WDP1', bitIndex: 1, desc: '타임아웃 프리스케일러 비트 1' },
              { name: 'WDP0', bitIndex: 0, desc: '타임아웃 프리스케일러 비트 0' }
            ]
          }
        ]
      },
      {
        id: 'extint',
        name: 'External Interrupts (INT0/1)',
        koreanName: '외부 하드웨어 핀 인터럽트',
        category: '인터럽트',
        iconName: 'Zap',
        description: '하드웨어 핀 전위 변화(하강 에지, 상승 에지, 로우 레벨) 즉각 감지',
        registers: [
          {
            name: extIntRegA,
            desc: `${extIntRegA} 외부 인터럽트 감지 조건 제어 레지스터`,
            defaultVal: 0x00,
            bits: [
              { name: 'ISC11', bitIndex: 3, desc: 'INT1 감지 조건 비트 1 (10=하강 에지, 11=상승 에지)' },
              { name: 'ISC10', bitIndex: 2, desc: 'INT1 감지 조건 비트 0' },
              { name: 'ISC01', bitIndex: 1, desc: 'INT0 감지 조건 비트 1 (10=하강 에지)' },
              { name: 'ISC00', bitIndex: 0, desc: 'INT0 감지 조건 비트 0' }
            ]
          },
          {
            name: extMaskReg,
            desc: `${extMaskReg} 외부 인터럽트 마스크 레지스터 (핀 인터럽트 허용)`,
            defaultVal: 0x00,
            bits: [
              { name: isM128 ? 'INT1' : 'INT1', bitIndex: 1, desc: '외부 인터럽트 1 허용 (INT1)' },
              { name: isM128 ? 'INT0' : 'INT0', bitIndex: 0, desc: '외부 인터럽트 0 허용 (INT0)' }
            ]
          }
        ]
      }
    ];
  }, [selectedMCU]);

  // Helper: toggle bit
  const handleToggleBit = (regName: string, bitIndex: number) => {
    const key = `${regName}_${bitIndex}`;
    setRegisterBits((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Helper: calculate 8-bit register value
  const getRegisterValue = (reg: ModuleRegisterDef): number => {
    let val = 0;
    reg.bits.forEach((bit) => {
      if (registerBits[`${reg.name}_${bit.bitIndex}`]) {
        val |= (1 << bit.bitIndex);
      }
    });
    return val;
  };

  // Apply quick presets
  const applyPreset = (presetType: 'sensor' | 'motor' | 'comm' | 'lowpower' | 'all') => {
    const newBits: Record<string, boolean> = {};
    const newEnabled: Record<string, boolean> = {
      gpio: false,
      timer0: false,
      timer1: false,
      usart0: false,
      spi: false,
      twi: false,
      adc: false,
      wdt: false,
      extint: false
    };

    if (presetType === 'sensor') {
      // Sensor Node: ADC + USART + Timer0
      newEnabled.gpio = true;
      newEnabled.usart0 = true;
      newEnabled.adc = true;
      newEnabled.timer0 = true;
      // GPIO: D13 LED out
      newBits['DDRB_5'] = true;
      // USART 9600
      newBits['UCSR0B_4'] = true; // RXEN
      newBits['UCSR0B_3'] = true; // TXEN
      newBits['UCSR0C_2'] = true; // UCSZ01
      newBits['UCSR0C_1'] = true; // UCSZ00
      // ADC AVcc + 128 Prescaler
      newBits['ADMUX_6'] = true; // REFS0
      newBits['ADCSRA_7'] = true; // ADEN
      newBits['ADCSRA_2'] = true; // ADPS2
      newBits['ADCSRA_1'] = true; // ADPS1
      newBits['ADCSRA_0'] = true; // ADPS0
      // Timer0 CTC
      newBits['TCCR0A_1'] = true; // WGM01
      newBits['TCCR0B_1'] = true; // CS01
      newBits['TCCR0B_0'] = true; // CS00
      const timsk0 = selectedMCU === 'atmega128' ? 'TIMSK' : 'TIMSK0';
      newBits[`${timsk0}_1`] = true; // OCIE0A
    } else if (presetType === 'motor') {
      // Motor Controller: Fast PWM on Timer0 + Timer1 + GPIO
      newEnabled.gpio = true;
      newEnabled.timer0 = true;
      newEnabled.timer1 = true;
      newBits['DDRD_6'] = true; // OC0A pin
      newBits['DDRD_5'] = true; // OC0B pin
      newBits['DDRB_1'] = true; // OC1A pin
      newBits['DDRB_2'] = true; // OC1B pin
      // Timer0 Fast PWM
      newBits['TCCR0A_7'] = true; // COM0A1
      newBits['TCCR0A_5'] = true; // COM0B1
      newBits['TCCR0A_1'] = true; // WGM01
      newBits['TCCR0A_0'] = true; // WGM00
      newBits['TCCR0B_1'] = true; // CS01 (64 prescaler)
      newBits['TCCR0B_0'] = true; // CS00
      // Timer1 16-bit 50Hz Servo PWM
      newBits['TCCR1A_7'] = true; // COM1A1
      newBits['TCCR1A_5'] = true; // COM1B1
      newBits['TCCR1A_1'] = true; // WGM11
      newBits['TCCR1B_4'] = true; // WGM13
      newBits['TCCR1B_3'] = true; // WGM12
      newBits['TCCR1B_1'] = true; // CS11 (8 prescaler)
    } else if (presetType === 'comm') {
      // Comm Bridge: USART0 + SPI + TWI
      newEnabled.gpio = true;
      newEnabled.usart0 = true;
      newEnabled.spi = true;
      newEnabled.twi = true;
      // SPI Master Mode 0
      newBits['DDRB_2'] = true; // SS pin output
      newBits['DDRB_3'] = true; // MOSI output
      newBits['DDRB_5'] = true; // SCK output
      newBits['SPCR_6'] = true; // SPE
      newBits['SPCR_4'] = true; // MSTR
      newBits['SPCR_0'] = true; // SPR0
      // TWI Enable
      newBits['TWCR_2'] = true; // TWEN
      newBits['TWCR_6'] = true; // TWEA
      // USART
      newBits['UCSR0B_4'] = true;
      newBits['UCSR0B_3'] = true;
      newBits['UCSR0C_2'] = true;
      newBits['UCSR0C_1'] = true;
    } else if (presetType === 'lowpower') {
      // Low Power Logger: WDT interrupt + ExtInt + ADC
      newEnabled.wdt = true;
      newEnabled.extint = true;
      newEnabled.adc = true;
      const wdtReg = selectedMCU === 'atmega128' ? 'WDTCR' : 'WDTCSR';
      newBits[`${wdtReg}_6`] = true; // WDIE (Interrupt Mode)
      newBits[`${wdtReg}_5`] = true; // WDP3 (2s timeout)
      newBits[`${wdtReg}_0`] = true; // WDP0
      const extRegA = 'EICRA';
      const extMask = 'EIMSK';
      newBits[`${extRegA}_1`] = true; // ISC01 (Falling Edge)
      newBits[`${extMask}_0`] = true; // INT0 enable
      newBits['ADCSRA_7'] = false; // Disable ADC for sleep
    } else {
      // Enable all
      Object.keys(newEnabled).forEach((k) => {
        newEnabled[k] = true;
      });
      // Copy current register bits
      Object.assign(newBits, registerBits);
    }

    setEnabledModules(newEnabled);
    setRegisterBits(newBits);

    // Expand active modules
    const newExpanded: Record<string, boolean> = {};
    Object.keys(newEnabled).forEach((k) => {
      newExpanded[k] = newEnabled[k];
    });
    setExpandedModules(newExpanded);
  };

  // Generate the complete C Code
  const generatedCode = useMemo(() => {
    const lines: string[] = [];
    const dateStr = new Date().toISOString().split('T')[0];

    // Headers
    if (includeHeaders) {
      lines.push('/**');
      lines.push(` * @file      ${funcName}.c`);
      lines.push(` * @brief     AVR Peripheral Hardware Initialization Driver`);
      lines.push(` * @target    ${currentProfile.name} (${currentProfile.fullName})`);
      lines.push(` * @clock     16.000000 MHz (Standard System Oscillator)`);
      lines.push(` * @date      ${dateStr}`);
      lines.push(` * @generator ATmega Studio Register Configuration Engine`);
      lines.push(' */');
      lines.push('');
      lines.push('#include <avr/io.h>');
      lines.push('#include <avr/interrupt.h>');
      if (includeAtomicSafety) {
        lines.push('#include <util/atomic.h>');
      }
      lines.push('');
    }

    // Header Prototype
    if (includeHeaderPrototype) {
      lines.push('/* Peripheral Initialization Function Prototype */');
      lines.push(`void ${funcName}(void);`);
      lines.push('');
    }

    // Function definition
    lines.push('/**');
    lines.push(` * @brief Initializes all selected hardware peripherals on ${currentProfile.name}`);
    lines.push(' * Configures I/O ports, timers, serial communications, and analog subsystems.');
    lines.push(' */');
    lines.push(`void ${funcName}(void)`);
    lines.push('{');

    let sectionCount = 0;

    // Iterate through selected modules
    peripheralDefinitions.forEach((module) => {
      if (!enabledModules[module.id]) return;

      sectionCount++;
      if (sectionCount > 1) {
        lines.push('');
      }

      lines.push(`    /* ========================================================================= */`);
      lines.push(`    /* [${sectionCount}] ${module.name} - ${module.koreanName} */`);
      lines.push(`    /* ========================================================================= */`);

      // Special WDT timed sequence handler
      if (module.id === 'wdt') {
        const wdtReg = selectedMCU === 'atmega128' ? 'WDTCR' : 'WDTCSR';
        const wdtVal = getRegisterValue(module.registers[0]);
        const setBits = module.registers[0].bits.filter((b) => registerBits[`${wdtReg}_${b.bitIndex}`]);

        if (includeComments) {
          lines.push(`    // Watchdog Timed Sequence: 4-cycle timed critical window required by datasheet`);
        }
        lines.push(`    cli(); // Temporarily disable interrupts for timed sequence`);
        lines.push(`    wdt_reset();`);
        lines.push(`    /* Step 1: Set WDCE and WDE to unlock write access */`);
        lines.push(`    ${wdtReg} |= (1 << WDCE) | (1 << WDE);`);
        lines.push(`    /* Step 2: Write new timeout prescaler and operational mode */`);
        if (codeStyle === 'bitwise_macro') {
          if (setBits.length === 0) {
            lines.push(`    ${wdtReg} = 0x00; // Watchdog disabled`);
          } else {
            const macroStr = setBits.map((b) => `(1 << ${b.name})`).join(' | ');
            lines.push(`    ${wdtReg} = ${macroStr};`);
          }
        } else if (codeStyle === 'hex_macro') {
          const hexStr = `0x${wdtVal.toString(16).toUpperCase().padStart(2, '0')}`;
          const bitNames = setBits.map((b) => b.name).join(', ') || 'None';
          lines.push(`    ${wdtReg} = ${hexStr}; /* Bits: ${bitNames} */`);
        } else {
          const macroStr = setBits.map((b) => `(1 << ${b.name})`).join(' | ');
          lines.push(`    ${wdtReg} = ${macroStr};`);
        }
        return;
      }

      // Special 16-bit Timer1 Atomic Block wrapping if requested
      const isTimer1 = module.id === 'timer1';
      if (isTimer1 && includeAtomicSafety) {
        lines.push(`    /* 16-bit Register Atomic Safety: Prevents TEMP high-byte buffer corruption */`);
        lines.push(`    ATOMIC_BLOCK(ATOMIC_RESTORESTATE)`);
        lines.push(`    {`);
      }

      const indent = isTimer1 && includeAtomicSafety ? '        ' : '    ';

      // Iterate registers of module
      module.registers.forEach((reg) => {
        const setBits = reg.bits.filter((b) => registerBits[`${reg.name}_${b.bitIndex}`]);
        const regVal = getRegisterValue(reg);

        if (includeComments) {
          lines.push(`${indent}// ${reg.desc}`);
        }

        if (codeStyle === 'bitwise_macro') {
          if (setBits.length === 0) {
            lines.push(`${indent}${reg.name} = 0x00;`);
          } else {
            const bitStr = setBits.map((b) => `(1 << ${b.name})`).join(' | ');
            lines.push(`${indent}${reg.name} = ${bitStr};`);
          }
        } else if (codeStyle === 'hex_macro') {
          const hexStr = `0x${regVal.toString(16).toUpperCase().padStart(2, '0')}`;
          const bitSummary = setBits.map((b) => b.name).join(', ') || 'All 0';
          lines.push(`${indent}${reg.name} = ${hexStr}; /* [${bitSummary}] */`);
        } else {
          // compound_or
          if (setBits.length === 0) {
            lines.push(`${indent}${reg.name} = 0x00;`);
          } else {
            const bitStr = setBits.map((b) => `(1 << ${b.name})`).join(' | ');
            lines.push(`${indent}${reg.name} |= ${bitStr};`);
          }
        }

        // Add special companion registers (e.g. UBRR0, OCR0A, ICR1)
        if (reg.name === 'UCSR0C') {
          const ubrrVal = numericRegisters['UBRR0'] || 103;
          const ubrrH = (ubrrVal >> 8) & 0x0F;
          const ubrrL = ubrrVal & 0xFF;
          if (includeComments) {
            lines.push(`${indent}// USART0 Baud Rate Register (9600 bps @ 16MHz)`);
          }
          lines.push(`${indent}UBRR0H = (uint8_t)(0x${ubrrH.toString(16).toUpperCase().padStart(2, '0')});`);
          lines.push(`${indent}UBRR0L = (uint8_t)(0x${ubrrL.toString(16).toUpperCase().padStart(2, '0')});`);
        }

        if (reg.name === 'TCCR0B') {
          const ocrVal = numericRegisters['OCR0A'] || 128;
          if (includeComments) {
            lines.push(`${indent}// Timer0 Output Compare Register A (PWM Duty Cycle / CTC TOP)`);
          }
          lines.push(`${indent}OCR0A = ${ocrVal}; // 0x${ocrVal.toString(16).toUpperCase().padStart(2, '0')}`);
        }

        if (reg.name === 'TCCR1B') {
          const icrVal = 19999; // 50Hz 20ms period for servo
          const ocr1Val = numericRegisters['OCR1A'] || 1500;
          if (includeComments) {
            lines.push(`${indent}// Timer1 ICR1 (TOP for Mode 14 Fast PWM) & OCR1A Compare Value`);
          }
          lines.push(`${indent}ICR1 = ${icrVal};   // 20ms PWM period (50Hz) @ 16MHz/8`);
          lines.push(`${indent}OCR1A = ${ocr1Val};  // 1.5ms pulse neutral servo position`);
        }

        if (reg.name === 'TWSR') {
          const twbrVal = numericRegisters['TWBR'] || 72;
          if (includeComments) {
            lines.push(`${indent}// TWI Bit Rate Register (100kHz Standard SCL @ 16MHz)`);
          }
          lines.push(`${indent}TWBR = ${twbrVal};`);
        }
      });

      if (isTimer1 && includeAtomicSafety) {
        lines.push(`    }`);
      }
    });

    // Global Interrupt Enable
    if (includeSei) {
      lines.push('');
      lines.push(`    /* ========================================================================= */`);
      lines.push(`    /* Global Interrupt Enable                                                  */`);
      lines.push(`    /* ========================================================================= */`);
      if (includeComments) {
        lines.push(`    // Set Status Register (SREG) Global Interrupt Enable bit (I-bit)`);
      }
      lines.push(`    sei();`);
    }

    lines.push('}');

    // Arduino setup wrapper
    if (includeArduinoSetup) {
      lines.push('');
      lines.push('/**');
      lines.push(' * @brief Optional Arduino Framework setup() Integration Wrapper');
      lines.push(' */');
      lines.push('void setup()');
      lines.push('{');
      lines.push(`    ${funcName}(); // Run bare-metal hardware register initialization`);
      lines.push('}');
      lines.push('');
      lines.push('void loop()');
      lines.push('{');
      lines.push('    // Background processing loop');
      lines.push('}');
    }

    return lines.join('\n');
  }, [
    funcName,
    codeStyle,
    includeComments,
    includeHeaders,
    includeSei,
    includeAtomicSafety,
    includeHeaderPrototype,
    includeArduinoSetup,
    enabledModules,
    registerBits,
    numericRegisters,
    peripheralDefinitions,
    currentProfile,
    selectedMCU
  ]);

  // Copy to clipboard
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.8 }
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  // Copy .h header prototype
  const handleCopyHeader = async () => {
    const headerCode = [
      `#ifndef ${funcName.toUpperCase()}_H_`,
      `#define ${funcName.toUpperCase()}_H_`,
      '',
      '#include <avr/io.h>',
      '',
      '#ifdef __cplusplus',
      'extern "C" {',
      '#endif',
      '',
      `/**`,
      ` * @brief Initialize all configured peripherals for ${currentProfile.name}`,
      ` */`,
      `void ${funcName}(void);`,
      '',
      '#ifdef __cplusplus',
      '}',
      '#endif',
      '',
      `#endif /* ${funcName.toUpperCase()}_H_ */`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(headerCode);
      setCopiedHeader(true);
      setTimeout(() => setCopiedHeader(false), 2000);
    } catch {
      // fallback
    }
  };

  // Download C file
  const handleDownloadC = () => {
    const blob = new Blob([generatedCode], { type: 'text/x-csrc;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${funcName}.c`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeModuleCount = Object.values(enabledModules).filter(Boolean).length;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <FileCode2 className="w-5 h-5" />
            </span>
            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              C언어 주변장치 초기화 함수 자동 생성기
              <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                void {funcName}()
              </span>
            </h3>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
            선택한 {currentProfile.name} 주변장치(GPIO, 타이머, USART, SPI, I2C, ADC, WDT, 외부인터럽트)의
            레지스터 비트 설정값을 분석하여 C 임베디드 펌웨어용 원자적(Atomic) 초기화 함수를 실시간 자동 생성합니다.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyCode}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs shadow-lg transition-all ${
              copied
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-amber-500/25'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                복사 완료!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                초기화 함수 C코드 복사
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('firmware-performance-guide-section');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 font-semibold text-xs border border-slate-700 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>성능 최적화 가이드 &darr;</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadC}
            title="C 소스코드 파일 다운로드"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preset Strategy Buttons */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            초기화 프리셋 빠른 적용:
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            활성화된 주변장치: <strong className="text-amber-400">{activeModuleCount}개</strong>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyPreset('sensor')}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500/40 text-xs text-slate-300 hover:text-amber-300 font-medium transition flex items-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            스마트 센서 노드 (ADC + USART0 + Timer0)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('motor')}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-cyan-500/10 border border-slate-800 hover:border-cyan-500/40 text-xs text-slate-300 hover:text-cyan-300 font-medium transition flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            모터/서보 제어기 (Dual PWM + Timer1 ICR1)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('comm')}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-purple-500/10 border border-slate-800 hover:border-purple-500/40 text-xs text-slate-300 hover:text-purple-300 font-medium transition flex items-center gap-1.5"
          >
            <Radio className="w-3.5 h-3.5 text-purple-400" />
            통신 게이트웨이 (USART + SPI + I2C)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('lowpower')}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500/40 text-xs text-slate-300 hover:text-emerald-300 font-medium transition flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            초저전력 슬립 로거 (WDT 2초 + INT0 기상)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('all')}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-white font-medium transition"
          >
            전체 모듈 활성화
          </button>
        </div>
      </div>

      {/* Code Configuration Options Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80">
        {/* Function Name Input */}
        <div className="space-y-1 lg:col-span-2">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Terminal className="w-3 h-3 text-amber-400" />
            함수명 (C Function Identifier)
          </label>
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5">
            <span className="text-xs text-amber-400 font-mono">void</span>
            <input
              type="text"
              value={funcName}
              onChange={(e) => setFuncName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="init_peripherals"
              className="bg-transparent text-xs text-white font-mono focus:outline-none w-full"
            />
            <span className="text-xs text-slate-400 font-mono">(void)</span>
          </div>
        </div>

        {/* Code Style Selector */}
        <div className="space-y-1 lg:col-span-2">
          <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Code2 className="w-3 h-3 text-cyan-400" />
            비트 할당 표현 스타일
          </label>
          <select
            value={codeStyle}
            onChange={(e) => setCodeStyle(e.target.value as CodeStyle)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
          >
            <option value="bitwise_macro">(1 &lt;&lt; BIT_NAME) 시프트 매크로</option>
            <option value="hex_macro">16진수 값 + 주석 (0x83 /* ... */)</option>
            <option value="compound_or">누적 비트합 (REG |= (1 &lt;&lt; BIT))</option>
          </select>
        </div>

        {/* Toggles */}
        <div className="space-y-1 lg:col-span-2 flex flex-col justify-end">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={includeComments}
                onChange={(e) => setIncludeComments(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-amber-500"
              />
              설명 주석
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={includeSei}
                onChange={(e) => setIncludeSei(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-amber-500"
              />
              <span className="font-mono text-emerald-400">sei()</span> 포함
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={includeAtomicSafety}
                onChange={(e) => setIncludeAtomicSafety(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-amber-500"
              />
              원자적 보호
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={includeArduinoSetup}
                onChange={(e) => setIncludeArduinoSetup(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-amber-500"
              />
              Arduino 래퍼
            </label>
          </div>
        </div>
      </div>

      {/* Main Content: Left Peripheral Selector / Bit Toggles, Right Code Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Peripheral Modules & Register Bit Configurator */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              주변장치 모듈 및 레지스터 비트 설정 ({currentProfile.name})
            </h4>
            <span className="text-[11px] text-slate-400">
              체크박스로 모듈 포함 여부를 선택하고 비트를 토글하세요
            </span>
          </div>

          <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
            {peripheralDefinitions.map((mod) => {
              const isEnabled = !!enabledModules[mod.id];
              const isExpanded = !!expandedModules[mod.id];

              return (
                <div
                  key={mod.id}
                  className={`border rounded-2xl transition-all ${
                    isEnabled
                      ? 'bg-slate-900/80 border-slate-700 shadow-md'
                      : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                  }`}
                >
                  {/* Module Title Bar */}
                  <div className="flex items-center justify-between p-3.5">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEnabledModules((prev) => ({ ...prev, [mod.id]: checked }));
                          if (checked) {
                            setExpandedModules((prev) => ({ ...prev, [mod.id]: true }));
                          }
                        }}
                        className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white font-mono">{mod.name}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                            {mod.koreanName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{mod.description}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedModules((prev) => ({ ...prev, [mod.id]: !isExpanded }))}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Expanded Register Details */}
                  {isExpanded && isEnabled && (
                    <div className="border-t border-slate-800/80 p-3.5 space-y-4 bg-slate-950/40 rounded-b-2xl">
                      {mod.registers.map((reg) => {
                        const regVal = getRegisterValue(reg);
                        const hexVal = `0x${regVal.toString(16).toUpperCase().padStart(2, '0')}`;
                        const binVal = `0b${regVal.toString(2).padStart(8, '0')}`;

                        return (
                          <div key={reg.name} className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-amber-400">{reg.name}</span>
                                <span className="text-[11px] text-slate-400 hidden sm:inline">{reg.desc}</span>
                              </div>
                              <div className="flex items-center gap-2 font-mono text-[11px]">
                                <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                  {hexVal}
                                </span>
                                <span className="text-slate-400 text-[10px] hidden md:inline">
                                  {binVal}
                                </span>
                              </div>
                            </div>

                            {/* Bit Toggles Row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                              {reg.bits.map((bit) => {
                                const isBitSet = !!registerBits[`${reg.name}_${bit.bitIndex}`];
                                return (
                                  <button
                                    key={bit.name}
                                    type="button"
                                    onClick={() => handleToggleBit(reg.name, bit.bitIndex)}
                                    title={`Bit ${bit.bitIndex}: ${bit.desc}`}
                                    className={`flex items-center justify-between px-2 py-1.5 rounded-lg border text-left transition-all ${
                                      isBitSet
                                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-bold shadow-sm'
                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                                    }`}
                                  >
                                    <div className="flex flex-col truncate pr-1">
                                      <span className="text-[11px] font-mono leading-tight">{bit.name}</span>
                                      <span className="text-[9px] text-slate-500 truncate">{bit.desc}</span>
                                    </div>
                                    <span
                                      className={`text-[9px] font-mono px-1 rounded ${
                                        isBitSet ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-600'
                                      }`}
                                    >
                                      {isBitSet ? '1' : '0'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
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

        {/* Right Column: Live C Code Generator Output */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-200">생성된 C언어 펌웨어 소스</span>
              <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-mono">
                {generatedCode.split('\n').length} lines
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyHeader}
                className="text-[11px] font-medium text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition"
              >
                {copiedHeader ? '헤더(.h) 복사됨' : '헤더(.h) 프로토타입'}
              </button>
              <button
                type="button"
                onClick={handleCopyCode}
                className={`text-[11px] font-bold px-2.5 py-1 rounded transition flex items-center gap-1 ${
                  copied
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? '복사됨' : '복사'}
              </button>
            </div>
          </div>

          {/* Code Viewer Panel */}
          <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-4 font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto h-[600px] overflow-y-auto shadow-inner">
            <pre className="select-text whitespace-pre">
              {generatedCode.split('\n').map((line, idx) => {
                const lineNum = idx + 1;
                const isComment = line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*');
                const isHeader = line.includes('#include');
                const isFunc = line.includes(`void ${funcName}`) || line.includes('void setup');
                const isSei = line.includes('sei()') || line.includes('cli()');
                const isAtomic = line.includes('ATOMIC_BLOCK');

                return (
                  <div key={idx} className="table-row hover:bg-slate-900/60 transition-colors">
                    <span className="table-cell select-none text-slate-600 text-right pr-3 pl-1 text-[10px] w-8">
                      {lineNum}
                    </span>
                    <span
                      className={`table-cell ${
                        isComment
                          ? 'text-slate-500 italic'
                          : isHeader
                          ? 'text-purple-400'
                          : isFunc
                          ? 'text-emerald-400 font-bold'
                          : isAtomic
                          ? 'text-cyan-400 font-semibold'
                          : isSei
                          ? 'text-amber-400 font-bold'
                          : line.includes('=')
                          ? 'text-slate-200'
                          : 'text-slate-300'
                      }`}
                    >
                      {line}
                    </span>
                  </div>
                );
              })}
            </pre>
          </div>

          {/* Quick Guidance Box */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-400">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-slate-200 font-medium block">펌웨어 프로젝트 적용 방법:</span>
              <p className="text-[11px] leading-normal">
                생성된 <code className="text-amber-400 font-mono">{funcName}()</code> 함수를 main() 진입부의
                while(1) 메인 루프 실행 전에 한 번 호출하세요. 레지스터 설정 순서는 통신 및 타이머 클럭 안정을 고려하여
                포트(GPIO) &rarr; 타이머 &rarr; 직렬통신(USART/SPI/I2C) &rarr; 아날로그(ADC) &rarr; 인터럽트(sei) 순으로 배치되어 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
