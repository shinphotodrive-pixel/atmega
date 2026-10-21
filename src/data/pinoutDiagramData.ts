import { SupportedMCU } from './pinmapData';

export type BadgeType =
  | 'gnd'
  | 'power'
  | 'control'
  | 'port'
  | 'func'
  | 'digital'
  | 'analog'
  | 'pwm'
  | 'serial';

export interface PinBadge {
  text: string;
  type: BadgeType;
}

export interface DiagramPin {
  pinNumber: number;
  label: string; // e.g. PC6, PD0, VCC, GND
  port?: string; // e.g. PORTC
  arduino?: string; // e.g. RESET, D0, D13, A0
  side: 'left' | 'right' | 'top' | 'bottom';
  badges: PinBadge[];
  desc: string;
}

export interface McuDiagramProfile {
  id: SupportedMCU;
  name: string;
  chipLabel: string;
  packageType: string;
  subtitle: string;
  totalPins: number;
  pins: DiagramPin[];
  notes?: string[];
}

// -------------------------------------------------------------
// 1. ATmega328P (28-pin DIP Pighixxx standard pinout)
// -------------------------------------------------------------
export const ATMEGA328P_DIAGRAM: McuDiagramProfile = {
  id: 'atmega328p',
  name: 'ATmega328P',
  chipLabel: 'ATMEGA328P',
  packageType: '28-pin DIP (DIP-28)',
  subtitle: 'The Unofficial Arduino & ATmega328P Pinout Diagram',
  totalPins: 28,
  notes: [
    '28-pin DIP 패키지: 아두이노 우노(Uno) 및 브레드보드 자작 키트의 글로벌 표준',
    '디지털 핀 D0~D13 (PWM: D3, D5, D6, D9, D10, D11)',
    '아날로그 핀 A0~A5 (I2C: A4=SDA, A5=SCL / PC4, PC5)',
    'SPI 통신: D10(SS), D11(MOSI), D12(MISO), D13(SCK)'
  ],
  pins: [
    // Left Side (Pins 1..14)
    {
      pinNumber: 1,
      label: 'PC6',
      port: 'PORTC',
      arduino: 'RESET',
      side: 'left',
      badges: [
        { text: 'RESET', type: 'control' },
        { text: 'PCINT14', type: 'func' },
        { text: 'PC6', type: 'port' }
      ],
      desc: 'Active Low 하드웨어 리셋 핀 / 핀체인지 인터럽트 14'
    },
    {
      pinNumber: 2,
      label: 'PD0',
      port: 'PORTD',
      arduino: '0',
      side: 'left',
      badges: [
        { text: '0', type: 'digital' },
        { text: 'RXD', type: 'serial' },
        { text: 'PCINT16', type: 'func' },
        { text: 'PD0', type: 'port' }
      ],
      desc: 'USART0 시리얼 데이터 수신(RX) / 아두이노 디지털 0번'
    },
    {
      pinNumber: 3,
      label: 'PD1',
      port: 'PORTD',
      arduino: '1',
      side: 'left',
      badges: [
        { text: '1', type: 'digital' },
        { text: 'TXD', type: 'serial' },
        { text: 'PCINT17', type: 'func' },
        { text: 'PD1', type: 'port' }
      ],
      desc: 'USART0 시리얼 데이터 송신(TX) / 아두이노 디지털 1번'
    },
    {
      pinNumber: 4,
      label: 'PD2',
      port: 'PORTD',
      arduino: '2',
      side: 'left',
      badges: [
        { text: '2', type: 'digital' },
        { text: 'INT0', type: 'func' },
        { text: 'PCINT18', type: 'func' },
        { text: 'PD2', type: 'port' }
      ],
      desc: '외부 하드웨어 인터럽트 0 / 아두이노 디지털 2번'
    },
    {
      pinNumber: 5,
      label: 'PD3',
      port: 'PORTD',
      arduino: '3',
      side: 'left',
      badges: [
        { text: 'OC2B', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: '3', type: 'digital' },
        { text: 'INT1', type: 'func' },
        { text: 'PCINT19', type: 'func' },
        { text: 'PD3', type: 'port' }
      ],
      desc: 'Timer2 PWM B 출력 / 외부 인터럽트 1 / 아두이노 디지털 3번'
    },
    {
      pinNumber: 6,
      label: 'PD4',
      port: 'PORTD',
      arduino: '4',
      side: 'left',
      badges: [
        { text: 'T0', type: 'func' },
        { text: '4', type: 'digital' },
        { text: 'XCK', type: 'func' },
        { text: 'PCINT20', type: 'func' },
        { text: 'PD4', type: 'port' }
      ],
      desc: 'Timer0 외부 클럭 입력 / USART 클럭 / 아두이노 디지털 4번'
    },
    {
      pinNumber: 7,
      label: 'VCC',
      side: 'left',
      badges: [{ text: 'VCC', type: 'power' }],
      desc: '메인 디지털 전원 입력 (+1.8V ~ +5.5V)'
    },
    {
      pinNumber: 8,
      label: 'GND',
      side: 'left',
      badges: [{ text: 'GND', type: 'gnd' }],
      desc: '디지털 시스템 접지 (0V)'
    },
    {
      pinNumber: 9,
      label: 'PB6',
      port: 'PORTB',
      arduino: 'XTAL1',
      side: 'left',
      badges: [
        { text: 'OSC1', type: 'func' },
        { text: 'XTAL1', type: 'func' },
        { text: 'PCINT6', type: 'func' },
        { text: 'PB6', type: 'port' }
      ],
      desc: '외부 크리스탈 오실레이터 입력 1 / GPIO PB6'
    },
    {
      pinNumber: 10,
      label: 'PB7',
      port: 'PORTB',
      arduino: 'XTAL2',
      side: 'left',
      badges: [
        { text: 'OSC2', type: 'func' },
        { text: 'XTAL2', type: 'func' },
        { text: 'PCINT7', type: 'func' },
        { text: 'PB7', type: 'port' }
      ],
      desc: '외부 크리스탈 오실레이터 출력 2 / GPIO PB7'
    },
    {
      pinNumber: 11,
      label: 'PD5',
      port: 'PORTD',
      arduino: '5',
      side: 'left',
      badges: [
        { text: 'OC0B', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: '5', type: 'digital' },
        { text: 'T1', type: 'func' },
        { text: 'PCINT21', type: 'func' },
        { text: 'PD5', type: 'port' }
      ],
      desc: 'Timer0 PWM B 출력 / Timer1 클럭 / 아두이노 디지털 5번'
    },
    {
      pinNumber: 12,
      label: 'PD6',
      port: 'PORTD',
      arduino: '6',
      side: 'left',
      badges: [
        { text: 'OC0A', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: '6', type: 'digital' },
        { text: 'AIN0', type: 'func' },
        { text: 'PCINT22', type: 'func' },
        { text: 'PD6', type: 'port' }
      ],
      desc: 'Timer0 PWM A 출력 / 아날로그 비교기 (+) / 아두이노 디지털 6번'
    },
    {
      pinNumber: 13,
      label: 'PD7',
      port: 'PORTD',
      arduino: '7',
      side: 'left',
      badges: [
        { text: '7', type: 'digital' },
        { text: 'AIN1', type: 'func' },
        { text: 'PCINT23', type: 'func' },
        { text: 'PD7', type: 'port' }
      ],
      desc: '아날로그 비교기 (-) / 아두이노 디지털 7번'
    },
    {
      pinNumber: 14,
      label: 'PB0',
      port: 'PORTB',
      arduino: '8',
      side: 'left',
      badges: [
        { text: 'ICP1', type: 'func' },
        { text: '8', type: 'digital' },
        { text: 'CLKO', type: 'func' },
        { text: 'PCINT0', type: 'func' },
        { text: 'PB0', type: 'port' }
      ],
      desc: 'Timer1 입력 캡처 / 시스템 클럭 출력 / 아두이노 디지털 8번'
    },

    // Right Side (Pins 28..15 from top to bottom)
    {
      pinNumber: 28,
      label: 'PC5',
      port: 'PORTC',
      arduino: 'A5',
      side: 'right',
      badges: [
        { text: 'PC5', type: 'port' },
        { text: 'PCINT13', type: 'func' },
        { text: 'ADC5', type: 'analog' },
        { text: 'A5', type: 'digital' },
        { text: 'SCL', type: 'serial' }
      ],
      desc: 'I2C 클럭 라인 (SCL) / 10-bit ADC 채널 5 / 아두이노 아날로그 A5'
    },
    {
      pinNumber: 27,
      label: 'PC4',
      port: 'PORTC',
      arduino: 'A4',
      side: 'right',
      badges: [
        { text: 'PC4', type: 'port' },
        { text: 'PCINT12', type: 'func' },
        { text: 'ADC4', type: 'analog' },
        { text: 'A4', type: 'digital' },
        { text: 'SDA', type: 'serial' }
      ],
      desc: 'I2C 데이터 라인 (SDA) / 10-bit ADC 채널 4 / 아두이노 아날로그 A4'
    },
    {
      pinNumber: 26,
      label: 'PC3',
      port: 'PORTC',
      arduino: 'A3',
      side: 'right',
      badges: [
        { text: 'PC3', type: 'port' },
        { text: 'PCINT11', type: 'func' },
        { text: 'ADC3', type: 'analog' },
        { text: 'A3', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 3 / 아두이노 아날로그 A3'
    },
    {
      pinNumber: 25,
      label: 'PC2',
      port: 'PORTC',
      arduino: 'A2',
      side: 'right',
      badges: [
        { text: 'PC2', type: 'port' },
        { text: 'PCINT10', type: 'func' },
        { text: 'ADC2', type: 'analog' },
        { text: 'A2', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 2 / 아두이노 아날로그 A2'
    },
    {
      pinNumber: 24,
      label: 'PC1',
      port: 'PORTC',
      arduino: 'A1',
      side: 'right',
      badges: [
        { text: 'PC1', type: 'port' },
        { text: 'PCINT9', type: 'func' },
        { text: 'ADC1', type: 'analog' },
        { text: 'A1', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 1 / 아두이노 아날로그 A1'
    },
    {
      pinNumber: 23,
      label: 'PC0',
      port: 'PORTC',
      arduino: 'A0',
      side: 'right',
      badges: [
        { text: 'PC0', type: 'port' },
        { text: 'PCINT8', type: 'func' },
        { text: 'ADC0', type: 'analog' },
        { text: 'A0', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 0 / 아두이노 아날로그 A0'
    },
    {
      pinNumber: 22,
      label: 'GND',
      side: 'right',
      badges: [{ text: 'GND', type: 'gnd' }],
      desc: '디지털 시스템 접지 (0V)'
    },
    {
      pinNumber: 21,
      label: 'AREF',
      side: 'right',
      badges: [{ text: 'AREF', type: 'analog' }],
      desc: 'ADC 아날로그 기준 전압 입력 핀 (100nF 디커플링 권장)'
    },
    {
      pinNumber: 20,
      label: 'AVCC',
      side: 'right',
      badges: [{ text: 'AVCC', type: 'power' }],
      desc: 'ADC 아날로그 전원 공급 핀 (10µH LC 필터 권장)'
    },
    {
      pinNumber: 19,
      label: 'PB5',
      port: 'PORTB',
      arduino: '13',
      side: 'right',
      badges: [
        { text: 'PB5', type: 'port' },
        { text: 'PCINT5', type: 'func' },
        { text: 'SCK', type: 'serial' },
        { text: '13', type: 'digital' }
      ],
      desc: 'SPI 직렬 클럭(SCK) / 아두이노 내장 LED 연결 핀 (D13)'
    },
    {
      pinNumber: 18,
      label: 'PB4',
      port: 'PORTB',
      arduino: '12',
      side: 'right',
      badges: [
        { text: 'PB4', type: 'port' },
        { text: 'PCINT4', type: 'func' },
        { text: 'MISO', type: 'serial' },
        { text: '12', type: 'digital' }
      ],
      desc: 'SPI 마스터 입력 슬레이브 출력 (MISO) / 아두이노 디지털 12번'
    },
    {
      pinNumber: 17,
      label: 'PB3',
      port: 'PORTB',
      arduino: '11',
      side: 'right',
      badges: [
        { text: 'PB3', type: 'port' },
        { text: 'PCINT3', type: 'func' },
        { text: 'OC2A', type: 'func' },
        { text: '11', type: 'digital' },
        { text: 'PWM', type: 'pwm' },
        { text: 'MOSI', type: 'serial' }
      ],
      desc: 'SPI 마스터 출력 슬레이브 입력 (MOSI) / Timer2 PWM / 아두이노 D11'
    },
    {
      pinNumber: 16,
      label: 'PB2',
      port: 'PORTB',
      arduino: '10',
      side: 'right',
      badges: [
        { text: 'PB2', type: 'port' },
        { text: 'PCINT2', type: 'func' },
        { text: 'OC1B', type: 'func' },
        { text: '10', type: 'digital' },
        { text: 'PWM', type: 'pwm' },
        { text: 'SS', type: 'func' }
      ],
      desc: 'SPI 슬레이브 선택(SS) / 16-bit Timer1 PWM B / 아두이노 D10'
    },
    {
      pinNumber: 15,
      label: 'PB1',
      port: 'PORTB',
      arduino: '9',
      side: 'right',
      badges: [
        { text: 'PB1', type: 'port' },
        { text: 'PCINT1', type: 'func' },
        { text: 'OC1A', type: 'func' },
        { text: '9', type: 'digital' },
        { text: 'PWM', type: 'pwm' }
      ],
      desc: '16-bit Timer1 PWM A 출력 / 아두이노 디지털 9번'
    }
  ]
};

// -------------------------------------------------------------
// 2. ATmega128 (64-pin TQFP Pighixxx standard pinout)
// -------------------------------------------------------------
export const ATMEGA128_DIAGRAM: McuDiagramProfile = {
  id: 'atmega128',
  name: 'ATmega128',
  chipLabel: 'ATMEGA128A',
  packageType: '64-pin TQFP (TQFP-64)',
  subtitle: 'The Unofficial Classic Embedded ATmega128/128A Pinout Diagram',
  totalPins: 64,
  notes: [
    '64-pin TQFP 패키지: 국내 산업용 제어기, 로봇 공학 및 대학 실습의 표준 스테디셀러',
    '★ ISP 프로그래밍 주의: SCK=PB1(11핀), MOSI대체=PE0(PDI, 2핀), MISO대체=PE1(PDO, 3핀)',
    '★ 기본 출고 시 M103C 퓨즈 비트가 0으로 프로그래밍되어 ATmega103 호환 모드로 동작하므로 퓨즈 해제 필수',
    '외부 메모리 인터페이스(XMEM) 지원: Port A (AD0~AD7), Port C (A8~A15), PG0~PG2(/WR, /RD, ALE)'
  ],
  pins: [
    // Left Side (Pins 1..32)
    {
      pinNumber: 1,
      label: 'PEN',
      side: 'left',
      badges: [{ text: 'PEN', type: 'control' }],
      desc: 'Programming Enable (ISP 다운로드 활성화 핀)'
    },
    {
      pinNumber: 2,
      label: 'PE0',
      port: 'PORTE',
      arduino: 'D0',
      side: 'left',
      badges: [
        { text: 'D0', type: 'digital' },
        { text: 'RXD0', type: 'serial' },
        { text: 'PDI', type: 'serial' },
        { text: 'PCINT8', type: 'func' },
        { text: 'PE0', type: 'port' }
      ],
      desc: 'USART0 RX / ★ ISP 프로그래밍 데이터 입력(PDI) / GPIO PE0'
    },
    {
      pinNumber: 3,
      label: 'PE1',
      port: 'PORTE',
      arduino: 'D1',
      side: 'left',
      badges: [
        { text: 'D1', type: 'digital' },
        { text: 'TXD0', type: 'serial' },
        { text: 'PDO', type: 'serial' },
        { text: 'PE1', type: 'port' }
      ],
      desc: 'USART0 TX / ★ ISP 프로그래밍 데이터 출력(PDO) / GPIO PE1'
    },
    {
      pinNumber: 4,
      label: 'PE2',
      port: 'PORTE',
      arduino: 'D2',
      side: 'left',
      badges: [
        { text: 'XCK0', type: 'serial' },
        { text: 'AIN0', type: 'analog' },
        { text: 'PE2', type: 'port' }
      ],
      desc: 'USART0 동기 클럭 / 아날로그 비교기 양의 입력 (+) / GPIO PE2'
    },
    {
      pinNumber: 5,
      label: 'PE3',
      port: 'PORTE',
      arduino: 'D3',
      side: 'left',
      badges: [
        { text: 'OC3A', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'AIN1', type: 'analog' },
        { text: 'PE3', type: 'port' }
      ],
      desc: '16-bit Timer3 PWM A 출력 / 아날로그 비교기 음의 입력 (-) / GPIO PE3'
    },
    {
      pinNumber: 6,
      label: 'PE4',
      port: 'PORTE',
      arduino: 'D4',
      side: 'left',
      badges: [
        { text: 'OC3B', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'INT4', type: 'func' },
        { text: 'PE4', type: 'port' }
      ],
      desc: '16-bit Timer3 PWM B 출력 / 외부 인터럽트 4 / GPIO PE4'
    },
    {
      pinNumber: 7,
      label: 'PE5',
      port: 'PORTE',
      arduino: 'D5',
      side: 'left',
      badges: [
        { text: 'OC3C', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'INT5', type: 'func' },
        { text: 'PE5', type: 'port' }
      ],
      desc: '16-bit Timer3 PWM C 출력 / 외부 인터럽트 5 / GPIO PE5'
    },
    {
      pinNumber: 8,
      label: 'PE6',
      port: 'PORTE',
      arduino: 'D6',
      side: 'left',
      badges: [
        { text: 'T3', type: 'func' },
        { text: 'INT6', type: 'func' },
        { text: 'PE6', type: 'port' }
      ],
      desc: 'Timer3 외부 클럭 입력 / 외부 인터럽트 6 / GPIO PE6'
    },
    {
      pinNumber: 9,
      label: 'PE7',
      port: 'PORTE',
      arduino: 'D7',
      side: 'left',
      badges: [
        { text: 'ICP3', type: 'func' },
        { text: 'INT7', type: 'func' },
        { text: 'PE7', type: 'port' }
      ],
      desc: 'Timer3 입력 캡처 / 외부 인터럽트 7 / GPIO PE7'
    },
    {
      pinNumber: 10,
      label: 'PB0',
      port: 'PORTB',
      arduino: 'D8',
      side: 'left',
      badges: [
        { text: 'SS', type: 'serial' },
        { text: 'PCINT0', type: 'func' },
        { text: 'PB0', type: 'port' }
      ],
      desc: 'SPI 슬레이브 선택(SS) / 핀체인지 인터럽트 0 / GPIO PB0'
    },
    {
      pinNumber: 11,
      label: 'PB1',
      port: 'PORTB',
      arduino: 'D9',
      side: 'left',
      badges: [
        { text: 'SCK', type: 'serial' },
        { text: 'PCINT1', type: 'func' },
        { text: 'PB1', type: 'port' }
      ],
      desc: '★ SPI 동기 클럭 및 ISP 다운로드 SCK 핀 / GPIO PB1'
    },
    {
      pinNumber: 12,
      label: 'PB2',
      port: 'PORTB',
      arduino: 'D10',
      side: 'left',
      badges: [
        { text: 'MOSI', type: 'serial' },
        { text: 'PCINT2', type: 'func' },
        { text: 'PB2', type: 'port' }
      ],
      desc: '하드웨어 SPI 마스터 데이터 출력 (일반 런타임 MOSI)'
    },
    {
      pinNumber: 13,
      label: 'PB3',
      port: 'PORTB',
      arduino: 'D11',
      side: 'left',
      badges: [
        { text: 'MISO', type: 'serial' },
        { text: 'PCINT3', type: 'func' },
        { text: 'PB3', type: 'port' }
      ],
      desc: '하드웨어 SPI 마스터 데이터 입력 (일반 런타임 MISO)'
    },
    {
      pinNumber: 14,
      label: 'PB4',
      port: 'PORTB',
      arduino: 'D12',
      side: 'left',
      badges: [
        { text: 'OC0', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'PB4', type: 'port' }
      ],
      desc: '8-bit Timer0 PWM 출력 / GPIO PB4'
    },
    {
      pinNumber: 15,
      label: 'PB5',
      port: 'PORTB',
      arduino: 'D13',
      side: 'left',
      badges: [
        { text: 'OC1A', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'PB5', type: 'port' }
      ],
      desc: '16-bit Timer1 PWM A 출력 / GPIO PB5'
    },
    {
      pinNumber: 16,
      label: 'PB6',
      port: 'PORTB',
      arduino: 'D14',
      side: 'left',
      badges: [
        { text: 'OC1B', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'PB6', type: 'port' }
      ],
      desc: '16-bit Timer1 PWM B 출력 / GPIO PB6'
    },
    {
      pinNumber: 17,
      label: 'PB7',
      port: 'PORTB',
      arduino: 'D15',
      side: 'left',
      badges: [
        { text: 'OC2', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'OC1C', type: 'func' },
        { text: 'PB7', type: 'port' }
      ],
      desc: '8-bit Timer2 PWM / 16-bit Timer1 PWM C 출력'
    },
    {
      pinNumber: 18,
      label: 'PG3',
      port: 'PORTG',
      side: 'left',
      badges: [
        { text: 'TOSC2', type: 'func' },
        { text: 'PG3', type: 'port' }
      ],
      desc: 'RTC 32.768kHz 오실레이터 핀 2 / GPIO PG3'
    },
    {
      pinNumber: 19,
      label: 'PG4',
      port: 'PORTG',
      side: 'left',
      badges: [
        { text: 'TOSC1', type: 'func' },
        { text: 'PG4', type: 'port' }
      ],
      desc: 'RTC 32.768kHz 오실레이터 핀 1 / GPIO PG4'
    },
    {
      pinNumber: 20,
      label: 'RESET',
      side: 'left',
      badges: [{ text: 'RESET', type: 'control' }],
      desc: 'Active Low 하드웨어 리셋 핀'
    },
    {
      pinNumber: 21,
      label: 'VCC',
      side: 'left',
      badges: [{ text: 'VCC', type: 'power' }],
      desc: '디지털 전원 공급 (+2.7V ~ +5.5V)'
    },
    {
      pinNumber: 22,
      label: 'GND',
      side: 'left',
      badges: [{ text: 'GND', type: 'gnd' }],
      desc: '디지털 접지 (0V)'
    },
    {
      pinNumber: 23,
      label: 'XTAL2',
      side: 'left',
      badges: [
        { text: 'OSC2', type: 'func' },
        { text: 'XTAL2', type: 'func' }
      ],
      desc: '외부 메인 크리스탈 오실레이터 출력 핀'
    },
    {
      pinNumber: 24,
      label: 'XTAL1',
      side: 'left',
      badges: [
        { text: 'OSC1', type: 'func' },
        { text: 'XTAL1', type: 'func' }
      ],
      desc: '외부 메인 크리스탈 오실레이터 입력 핀'
    },
    {
      pinNumber: 25,
      label: 'PD0',
      port: 'PORTD',
      arduino: 'D18',
      side: 'left',
      badges: [
        { text: 'SCL', type: 'serial' },
        { text: 'INT0', type: 'func' },
        { text: 'PD0', type: 'port' }
      ],
      desc: 'I2C 클럭 (SCL) / 외부 인터럽트 0 / GPIO PD0'
    },
    {
      pinNumber: 26,
      label: 'PD1',
      port: 'PORTD',
      arduino: 'D19',
      side: 'left',
      badges: [
        { text: 'SDA', type: 'serial' },
        { text: 'INT1', type: 'func' },
        { text: 'PD1', type: 'port' }
      ],
      desc: 'I2C 데이터 (SDA) / 외부 인터럽트 1 / GPIO PD1'
    },
    {
      pinNumber: 27,
      label: 'PD2',
      port: 'PORTD',
      arduino: 'D20',
      side: 'left',
      badges: [
        { text: 'RXD1', type: 'serial' },
        { text: 'INT2', type: 'func' },
        { text: 'PD2', type: 'port' }
      ],
      desc: 'USART1 시리얼 수신 (RX) / 외부 인터럽트 2 / GPIO PD2'
    },
    {
      pinNumber: 28,
      label: 'PD3',
      port: 'PORTD',
      arduino: 'D21',
      side: 'left',
      badges: [
        { text: 'TXD1', type: 'serial' },
        { text: 'INT3', type: 'func' },
        { text: 'PD3', type: 'port' }
      ],
      desc: 'USART1 시리얼 송신 (TX) / 외부 인터럽트 3 / GPIO PD3'
    },
    {
      pinNumber: 29,
      label: 'PD4',
      port: 'PORTD',
      arduino: 'D22',
      side: 'left',
      badges: [
        { text: 'ICP1', type: 'func' },
        { text: 'PD4', type: 'port' }
      ],
      desc: 'Timer1 입력 캡처 (펄스폭 측정) / GPIO PD4'
    },
    {
      pinNumber: 30,
      label: 'PD5',
      port: 'PORTD',
      arduino: 'D23',
      side: 'left',
      badges: [
        { text: 'XCK1', type: 'serial' },
        { text: 'PD5', type: 'port' }
      ],
      desc: 'USART1 동기 클럭 입출력 / GPIO PD5'
    },
    {
      pinNumber: 31,
      label: 'PD6',
      port: 'PORTD',
      arduino: 'D24',
      side: 'left',
      badges: [
        { text: 'T1', type: 'func' },
        { text: 'PD6', type: 'port' }
      ],
      desc: 'Timer1 외부 카운터 클럭 입력 / GPIO PD6'
    },
    {
      pinNumber: 32,
      label: 'PD7',
      port: 'PORTD',
      arduino: 'D25',
      side: 'left',
      badges: [
        { text: 'T2', type: 'func' },
        { text: 'PD7', type: 'port' }
      ],
      desc: 'Timer2 외부 카운터 클럭 입력 / GPIO PD7'
    },

    // Right Side (Pins 64..33 from top to bottom)
    {
      pinNumber: 64,
      label: 'AVCC',
      side: 'right',
      badges: [{ text: 'AVCC', type: 'power' }],
      desc: '아날로그 ADC 전원 공급 핀 (VCC ±0.3V 이내)'
    },
    {
      pinNumber: 63,
      label: 'GND',
      side: 'right',
      badges: [{ text: 'GND', type: 'gnd' }],
      desc: '아날로그 접지 (0V)'
    },
    {
      pinNumber: 62,
      label: 'AREF',
      side: 'right',
      badges: [{ text: 'AREF', type: 'analog' }],
      desc: 'ADC 아날로그 기준 전압 핀'
    },
    {
      pinNumber: 61,
      label: 'PF0',
      port: 'PORTF',
      arduino: 'A0',
      side: 'right',
      badges: [
        { text: 'PF0', type: 'port' },
        { text: 'ADC0', type: 'analog' },
        { text: 'A0', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 0 / GPIO PF0'
    },
    {
      pinNumber: 60,
      label: 'PF1',
      port: 'PORTF',
      arduino: 'A1',
      side: 'right',
      badges: [
        { text: 'PF1', type: 'port' },
        { text: 'ADC1', type: 'analog' },
        { text: 'A1', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 1 / GPIO PF1'
    },
    {
      pinNumber: 59,
      label: 'PF2',
      port: 'PORTF',
      arduino: 'A2',
      side: 'right',
      badges: [
        { text: 'PF2', type: 'port' },
        { text: 'ADC2', type: 'analog' },
        { text: 'A2', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 2 / GPIO PF2'
    },
    {
      pinNumber: 58,
      label: 'PF3',
      port: 'PORTF',
      arduino: 'A3',
      side: 'right',
      badges: [
        { text: 'PF3', type: 'port' },
        { text: 'ADC3', type: 'analog' },
        { text: 'A3', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 3 / GPIO PF3'
    },
    {
      pinNumber: 57,
      label: 'PF4',
      port: 'PORTF',
      arduino: 'A4',
      side: 'right',
      badges: [
        { text: 'PF4', type: 'port' },
        { text: 'ADC4', type: 'analog' },
        { text: 'TCK', type: 'func' },
        { text: 'A4', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 4 / JTAG 클럭 (TCK)'
    },
    {
      pinNumber: 56,
      label: 'PF5',
      port: 'PORTF',
      arduino: 'A5',
      side: 'right',
      badges: [
        { text: 'PF5', type: 'port' },
        { text: 'ADC5', type: 'analog' },
        { text: 'TMS', type: 'func' },
        { text: 'A5', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 5 / JTAG 모드 선택 (TMS)'
    },
    {
      pinNumber: 55,
      label: 'PF6',
      port: 'PORTF',
      arduino: 'A6',
      side: 'right',
      badges: [
        { text: 'PF6', type: 'port' },
        { text: 'ADC6', type: 'analog' },
        { text: 'TDO', type: 'func' },
        { text: 'A6', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 6 / JTAG 데이터 출력 (TDO)'
    },
    {
      pinNumber: 54,
      label: 'PF7',
      port: 'PORTF',
      arduino: 'A7',
      side: 'right',
      badges: [
        { text: 'PF7', type: 'port' },
        { text: 'ADC7', type: 'analog' },
        { text: 'TDI', type: 'func' },
        { text: 'A7', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 7 / JTAG 데이터 입력 (TDI)'
    },
    {
      pinNumber: 53,
      label: 'GND',
      side: 'right',
      badges: [{ text: 'GND', type: 'gnd' }],
      desc: '디지털 시스템 접지 (0V)'
    },
    {
      pinNumber: 52,
      label: 'VCC',
      side: 'right',
      badges: [{ text: 'VCC', type: 'power' }],
      desc: '디지털 시스템 전원 공급 (+2.7V ~ +5.5V)'
    },
    {
      pinNumber: 51,
      label: 'PA0',
      port: 'PORTA',
      side: 'right',
      badges: [
        { text: 'PA0', type: 'port' },
        { text: 'AD0', type: 'func' }
      ],
      desc: '외부 메모리 인터페이스 Address/Data 비트 0'
    },
    {
      pinNumber: 50,
      label: 'PA1',
      port: 'PORTA',
      side: 'right',
      badges: [
        { text: 'PA1', type: 'port' },
        { text: 'AD1', type: 'func' }
      ],
      desc: '외부 메모리 인터페이스 Address/Data 비트 1'
    },
    {
      pinNumber: 49,
      label: 'PA2',
      port: 'PORTA',
      side: 'right',
      badges: [
        { text: 'PA2', type: 'port' },
        { text: 'AD2', type: 'func' }
      ],
      desc: '외부 메모리 인터페이스 Address/Data 비트 2'
    },
    {
      pinNumber: 48,
      label: 'PA3',
      port: 'PORTA',
      side: 'right',
      badges: [
        { text: 'PA3', type: 'port' },
        { text: 'AD3', type: 'func' }
      ],
      desc: '외부 메모리 인터페이스 Address/Data 비트 3'
    },
    {
      pinNumber: 47,
      label: 'PA4',
      port: 'PORTA',
      side: 'right',
      badges: [
        { text: 'PA4', type: 'port' },
        { text: 'AD4', type: 'func' }
      ],
      desc: '외부 메모리 인터페이스 Address/Data 비트 4'
    },
    {
      pinNumber: 46,
      label: 'PA5',
      port: 'PORTA',
      side: 'right',
      badges: [
        { text: 'PA5', type: 'port' },
        { text: 'AD5', type: 'func' }
      ],
      desc: '외부 메모리 인터페이스 Address/Data 비트 5'
    },
    {
      pinNumber: 45,
      label: 'PA6',
      port: 'PORTA',
      side: 'right',
      badges: [
        { text: 'PA6', type: 'port' },
        { text: 'AD6', type: 'func' }
      ],
      desc: '외부 메모리 인터페이스 Address/Data 비트 6'
    },
    {
      pinNumber: 44,
      label: 'PA7',
      port: 'PORTA',
      side: 'right',
      badges: [
        { text: 'PA7', type: 'port' },
        { text: 'AD7', type: 'func' }
      ],
      desc: '외부 메모리 인터페이스 Address/Data 비트 7'
    },
    {
      pinNumber: 43,
      label: 'PG2',
      port: 'PORTG',
      side: 'right',
      badges: [
        { text: 'PG2', type: 'port' },
        { text: 'ALE', type: 'func' }
      ],
      desc: 'Address Latch Enable (외부 SRAM 주소 디먹싱 신호)'
    },
    {
      pinNumber: 42,
      label: 'PC7',
      port: 'PORTC',
      side: 'right',
      badges: [
        { text: 'PC7', type: 'port' },
        { text: 'A15', type: 'func' }
      ],
      desc: '외부 메모리 상위 주소 버스 A15'
    },
    {
      pinNumber: 41,
      label: 'PC6',
      port: 'PORTC',
      side: 'right',
      badges: [
        { text: 'PC6', type: 'port' },
        { text: 'A14', type: 'func' }
      ],
      desc: '외부 메모리 상위 주소 버스 A14'
    },
    {
      pinNumber: 40,
      label: 'PC5',
      port: 'PORTC',
      side: 'right',
      badges: [
        { text: 'PC5', type: 'port' },
        { text: 'A13', type: 'func' }
      ],
      desc: '외부 메모리 상위 주소 버스 A13'
    },
    {
      pinNumber: 39,
      label: 'PC4',
      port: 'PORTC',
      side: 'right',
      badges: [
        { text: 'PC4', type: 'port' },
        { text: 'A12', type: 'func' }
      ],
      desc: '외부 메모리 상위 주소 버스 A12'
    },
    {
      pinNumber: 38,
      label: 'PC3',
      port: 'PORTC',
      side: 'right',
      badges: [
        { text: 'PC3', type: 'port' },
        { text: 'A11', type: 'func' }
      ],
      desc: '외부 메모리 상위 주소 버스 A11'
    },
    {
      pinNumber: 37,
      label: 'PC2',
      port: 'PORTC',
      side: 'right',
      badges: [
        { text: 'PC2', type: 'port' },
        { text: 'A10', type: 'func' }
      ],
      desc: '외부 메모리 상위 주소 버스 A10'
    },
    {
      pinNumber: 36,
      label: 'PC1',
      port: 'PORTC',
      side: 'right',
      badges: [
        { text: 'PC1', type: 'port' },
        { text: 'A9', type: 'func' }
      ],
      desc: '외부 메모리 상위 주소 버스 A9'
    },
    {
      pinNumber: 35,
      label: 'PC0',
      port: 'PORTC',
      side: 'right',
      badges: [
        { text: 'PC0', type: 'port' },
        { text: 'A8', type: 'func' }
      ],
      desc: '외부 메모리 상위 주소 버스 A8'
    },
    {
      pinNumber: 34,
      label: 'PG1',
      port: 'PORTG',
      side: 'right',
      badges: [
        { text: 'PG1', type: 'port' },
        { text: 'RD', type: 'control' }
      ],
      desc: 'External Memory Read Strobe (/RD Active Low)'
    },
    {
      pinNumber: 33,
      label: 'PG0',
      port: 'PORTG',
      side: 'right',
      badges: [
        { text: 'PG0', type: 'port' },
        { text: 'WR', type: 'control' }
      ],
      desc: 'External Memory Write Strobe (/WR Active Low)'
    }
  ]
};

// -------------------------------------------------------------
// 3. ATmega640 (100-pin TQFP Pighixxx standard pinout)
// -------------------------------------------------------------
export const ATMEGA640_DIAGRAM: McuDiagramProfile = {
  id: 'atmega640',
  name: 'ATmega640',
  chipLabel: 'ATMEGA640',
  packageType: '100-pin TQFP (TQFP-100)',
  subtitle: 'The Unofficial High-Density ATmega640 / Mega Family Pinout Diagram',
  totalPins: 100,
  notes: [
    '100-pin TQFP 패키지: ATmega1280 / ATmega2560 (Arduino Mega)와 100% 동일한 물리 핀맵 호환',
    '총 86개 범용 I/O 라인 (Port A~L), 4개 하드웨어 USART (USART0~3)',
    '16개 아날로그 ADC 채널 (ADC0~ADC15 / Port F & Port K)',
    '15개 하드웨어 PWM 채널 (Timer 0/1/2/3/4/5 연동)',
    '외부 메모리(XMEM) 64KB 확장: Port A (AD0~7), Port C (A8~15), PG0(/WR), PG1(/RD), PG2(ALE)'
  ],
  pins: [
    // Left Side: Pins 1 to 50
    {
      pinNumber: 1,
      label: 'PG5',
      port: 'PORTG',
      arduino: 'D4',
      side: 'left',
      badges: [
        { text: 'OC0B', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'PG5', type: 'port' },
        { text: 'D4', type: 'digital' }
      ],
      desc: 'Timer0 PWM B 출력 / 아두이노 디지털 4번'
    },
    {
      pinNumber: 2,
      label: 'PE0',
      port: 'PORTE',
      arduino: 'D0',
      side: 'left',
      badges: [
        { text: 'RXD0', type: 'serial' },
        { text: 'PCINT8', type: 'func' },
        { text: 'PE0', type: 'port' },
        { text: 'D0', type: 'digital' }
      ],
      desc: 'USART0 수신 (기본 시리얼 RX0) / 아두이노 D0'
    },
    {
      pinNumber: 3,
      label: 'PE1',
      port: 'PORTE',
      arduino: 'D1',
      side: 'left',
      badges: [
        { text: 'TXD0', type: 'serial' },
        { text: 'PE1', type: 'port' },
        { text: 'D1', type: 'digital' }
      ],
      desc: 'USART0 송신 (기본 시리얼 TX0) / 아두이노 D1'
    },
    {
      pinNumber: 4,
      label: 'PE2',
      port: 'PORTE',
      side: 'left',
      badges: [
        { text: 'XCK0', type: 'serial' },
        { text: 'AIN0', type: 'analog' },
        { text: 'PE2', type: 'port' }
      ],
      desc: 'USART0 동기 클럭 / 아날로그 비교기 (+)'
    },
    {
      pinNumber: 5,
      label: 'PE3',
      port: 'PORTE',
      arduino: 'D5',
      side: 'left',
      badges: [
        { text: 'OC3A', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'AIN1', type: 'analog' },
        { text: 'PE3', type: 'port' },
        { text: 'D5', type: 'digital' }
      ],
      desc: '16-bit Timer3 PWM A / 아두이노 D5'
    },
    {
      pinNumber: 6,
      label: 'PE4',
      port: 'PORTE',
      arduino: 'D2',
      side: 'left',
      badges: [
        { text: 'OC3B', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'INT4', type: 'func' },
        { text: 'PE4', type: 'port' },
        { text: 'D2', type: 'digital' }
      ],
      desc: '16-bit Timer3 PWM B / 외부 인터럽트 4 / 아두이노 D2'
    },
    {
      pinNumber: 7,
      label: 'PE5',
      port: 'PORTE',
      arduino: 'D3',
      side: 'left',
      badges: [
        { text: 'OC3C', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'INT5', type: 'func' },
        { text: 'PE5', type: 'port' },
        { text: 'D3', type: 'digital' }
      ],
      desc: '16-bit Timer3 PWM C / 외부 인터럽트 5 / 아두이노 D3'
    },
    {
      pinNumber: 8,
      label: 'PE6',
      port: 'PORTE',
      side: 'left',
      badges: [
        { text: 'T3', type: 'func' },
        { text: 'INT6', type: 'func' },
        { text: 'PE6', type: 'port' }
      ],
      desc: 'Timer3 외부 클럭 / 외부 인터럽트 6'
    },
    {
      pinNumber: 9,
      label: 'PE7',
      port: 'PORTE',
      side: 'left',
      badges: [
        { text: 'ICP3', type: 'func' },
        { text: 'INT7', type: 'func' },
        { text: 'PE7', type: 'port' }
      ],
      desc: 'Timer3 입력 캡처 / 외부 인터럽트 7'
    },
    {
      pinNumber: 10,
      label: 'VCC',
      side: 'left',
      badges: [{ text: 'VCC', type: 'power' }],
      desc: '메인 디지털 전원 입력 (+1.8V ~ +5.5V)'
    },
    {
      pinNumber: 11,
      label: 'GND',
      side: 'left',
      badges: [{ text: 'GND', type: 'gnd' }],
      desc: '디지털 시스템 접지 (0V)'
    },
    {
      pinNumber: 12,
      label: 'PH0',
      port: 'PORTH',
      arduino: 'D17',
      side: 'left',
      badges: [
        { text: 'RXD2', type: 'serial' },
        { text: 'PH0', type: 'port' },
        { text: 'D17', type: 'digital' }
      ],
      desc: 'USART2 시리얼 수신 (RX2) / 아두이노 D17'
    },
    {
      pinNumber: 13,
      label: 'PH1',
      port: 'PORTH',
      arduino: 'D16',
      side: 'left',
      badges: [
        { text: 'TXD2', type: 'serial' },
        { text: 'PH1', type: 'port' },
        { text: 'D16', type: 'digital' }
      ],
      desc: 'USART2 시리얼 송신 (TX2) / 아두이노 D16'
    },
    {
      pinNumber: 14,
      label: 'PH2',
      port: 'PORTH',
      side: 'left',
      badges: [
        { text: 'XCK2', type: 'serial' },
        { text: 'PH2', type: 'port' }
      ],
      desc: 'USART2 동기 모드 클럭'
    },
    {
      pinNumber: 15,
      label: 'PH3',
      port: 'PORTH',
      arduino: 'D6',
      side: 'left',
      badges: [
        { text: 'OC4A', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'PH3', type: 'port' },
        { text: 'D6', type: 'digital' }
      ],
      desc: '16-bit Timer4 PWM A / 아두이노 D6'
    },
    {
      pinNumber: 16,
      label: 'PH4',
      port: 'PORTH',
      arduino: 'D7',
      side: 'left',
      badges: [
        { text: 'OC4B', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'PH4', type: 'port' },
        { text: 'D7', type: 'digital' }
      ],
      desc: '16-bit Timer4 PWM B / 아두이노 D7'
    },
    {
      pinNumber: 17,
      label: 'PH5',
      port: 'PORTH',
      arduino: 'D8',
      side: 'left',
      badges: [
        { text: 'OC4C', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'PH5', type: 'port' },
        { text: 'D8', type: 'digital' }
      ],
      desc: '16-bit Timer4 PWM C / 아두이노 D8'
    },
    {
      pinNumber: 18,
      label: 'PH6',
      port: 'PORTH',
      arduino: 'D9',
      side: 'left',
      badges: [
        { text: 'OC2B', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'PH6', type: 'port' },
        { text: 'D9', type: 'digital' }
      ],
      desc: 'Timer2 PWM B / 아두이노 D9'
    },
    {
      pinNumber: 19,
      label: 'PB0',
      port: 'PORTB',
      arduino: 'D53',
      side: 'left',
      badges: [
        { text: 'SS', type: 'serial' },
        { text: 'PCINT0', type: 'func' },
        { text: 'PB0', type: 'port' },
        { text: 'D53', type: 'digital' }
      ],
      desc: 'SPI 슬레이브 선택 (SS) / 아두이노 D53'
    },
    {
      pinNumber: 20,
      label: 'PB1',
      port: 'PORTB',
      arduino: 'D52',
      side: 'left',
      badges: [
        { text: 'SCK', type: 'serial' },
        { text: 'PCINT1', type: 'func' },
        { text: 'PB1', type: 'port' },
        { text: 'D52', type: 'digital' }
      ],
      desc: 'SPI 직렬 클럭 (SCK) / 아두이노 D52'
    },
    {
      pinNumber: 21,
      label: 'PB2',
      port: 'PORTB',
      arduino: 'D51',
      side: 'left',
      badges: [
        { text: 'MOSI', type: 'serial' },
        { text: 'PCINT2', type: 'func' },
        { text: 'PB2', type: 'port' },
        { text: 'D51', type: 'digital' }
      ],
      desc: 'SPI 마스터 출력 (MOSI) / 아두이노 D51'
    },
    {
      pinNumber: 22,
      label: 'PB3',
      port: 'PORTB',
      arduino: 'D50',
      side: 'left',
      badges: [
        { text: 'MISO', type: 'serial' },
        { text: 'PCINT3', type: 'func' },
        { text: 'PB3', type: 'port' },
        { text: 'D50', type: 'digital' }
      ],
      desc: 'SPI 마스터 입력 (MISO) / 아두이노 D50'
    },
    {
      pinNumber: 23,
      label: 'PB4',
      port: 'PORTB',
      arduino: 'D10',
      side: 'left',
      badges: [
        { text: 'OC2A', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'PB4', type: 'port' },
        { text: 'D10', type: 'digital' }
      ],
      desc: 'Timer2 PWM A / 아두이노 D10'
    },
    {
      pinNumber: 24,
      label: 'PB5',
      port: 'PORTB',
      arduino: 'D11',
      side: 'left',
      badges: [
        { text: 'OC1A', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'PB5', type: 'port' },
        { text: 'D11', type: 'digital' }
      ],
      desc: '16-bit Timer1 PWM A / 아두이노 D11'
    },
    {
      pinNumber: 25,
      label: 'PB6',
      port: 'PORTB',
      arduino: 'D12',
      side: 'left',
      badges: [
        { text: 'OC1B', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'PB6', type: 'port' },
        { text: 'D12', type: 'digital' }
      ],
      desc: '16-bit Timer1 PWM B / 아두이노 D12'
    },
    {
      pinNumber: 26,
      label: 'PB7',
      port: 'PORTB',
      arduino: 'D13',
      side: 'left',
      badges: [
        { text: 'OC0A', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'PB7', type: 'port' },
        { text: 'D13', type: 'digital' }
      ],
      desc: 'Timer0 PWM A / 아두이노 보드 LED (D13)'
    },
    {
      pinNumber: 27,
      label: 'PH7',
      port: 'PORTH',
      side: 'left',
      badges: [
        { text: 'T4', type: 'func' },
        { text: 'PH7', type: 'port' }
      ],
      desc: 'Timer4 외부 클럭 카운팅 입력'
    },
    {
      pinNumber: 28,
      label: 'PG3',
      port: 'PORTG',
      side: 'left',
      badges: [
        { text: 'TOSC2', type: 'func' },
        { text: 'PG3', type: 'port' }
      ],
      desc: 'RTC 32.768kHz 오실레이터 핀 2'
    },
    {
      pinNumber: 29,
      label: 'PG4',
      port: 'PORTG',
      side: 'left',
      badges: [
        { text: 'TOSC1', type: 'func' },
        { text: 'PG4', type: 'port' }
      ],
      desc: 'RTC 32.768kHz 오실레이터 핀 1'
    },
    {
      pinNumber: 30,
      label: 'RESET',
      side: 'left',
      badges: [{ text: 'RESET', type: 'control' }],
      desc: 'Active Low 하드웨어 리셋 입력'
    },
    {
      pinNumber: 31,
      label: 'VCC',
      side: 'left',
      badges: [{ text: 'VCC', type: 'power' }],
      desc: '디지털 시스템 전원 입력 (+1.8V ~ +5.5V)'
    },
    {
      pinNumber: 32,
      label: 'GND',
      side: 'left',
      badges: [{ text: 'GND', type: 'gnd' }],
      desc: '디지털 시스템 접지 (0V)'
    },
    {
      pinNumber: 33,
      label: 'XTAL2',
      side: 'left',
      badges: [
        { text: 'OSC2', type: 'func' },
        { text: 'XTAL2', type: 'func' }
      ],
      desc: '외부 크리스탈 오실레이터 출력 핀'
    },
    {
      pinNumber: 34,
      label: 'XTAL1',
      side: 'left',
      badges: [
        { text: 'OSC1', type: 'func' },
        { text: 'XTAL1', type: 'func' }
      ],
      desc: '외부 크리스탈 오실레이터 입력 핀'
    },
    {
      pinNumber: 35,
      label: 'PL0',
      port: 'PORTL',
      arduino: 'D49',
      side: 'left',
      badges: [
        { text: 'ICP4', type: 'func' },
        { text: 'PL0', type: 'port' },
        { text: 'D49', type: 'digital' }
      ],
      desc: 'Timer4 입력 캡처 / 아두이노 D49'
    },
    {
      pinNumber: 36,
      label: 'PL1',
      port: 'PORTL',
      arduino: 'D48',
      side: 'left',
      badges: [
        { text: 'ICP5', type: 'func' },
        { text: 'PL1', type: 'port' },
        { text: 'D48', type: 'digital' }
      ],
      desc: 'Timer5 입력 캡처 / 아두이노 D48'
    },
    {
      pinNumber: 37,
      label: 'PL2',
      port: 'PORTL',
      arduino: 'D47',
      side: 'left',
      badges: [
        { text: 'T5', type: 'func' },
        { text: 'PL2', type: 'port' },
        { text: 'D47', type: 'digital' }
      ],
      desc: 'Timer5 외부 클럭 입력 / 아두이노 D47'
    },
    {
      pinNumber: 38,
      label: 'PL3',
      port: 'PORTL',
      arduino: 'D46',
      side: 'left',
      badges: [
        { text: 'OC5A', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'PL3', type: 'port' },
        { text: 'D46', type: 'digital' }
      ],
      desc: '16-bit Timer5 PWM A / 아두이노 D46'
    },
    {
      pinNumber: 39,
      label: 'PL4',
      port: 'PORTL',
      arduino: 'D45',
      side: 'left',
      badges: [
        { text: 'OC5B', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'PL4', type: 'port' },
        { text: 'D45', type: 'digital' }
      ],
      desc: '16-bit Timer5 PWM B / 아두이노 D45'
    },
    {
      pinNumber: 40,
      label: 'PL5',
      port: 'PORTL',
      arduino: 'D44',
      side: 'left',
      badges: [
        { text: 'OC5C', type: 'func' },
        { text: 'PWM', type: 'pwm' },
        { text: 'PL5', type: 'port' },
        { text: 'D44', type: 'digital' }
      ],
      desc: '16-bit Timer5 PWM C / 아두이노 D44'
    },
    {
      pinNumber: 41,
      label: 'PL6',
      port: 'PORTL',
      arduino: 'D43',
      side: 'left',
      badges: [
        { text: 'PL6', type: 'port' },
        { text: 'D43', type: 'digital' }
      ],
      desc: '범용 GPIO PL6 / 아두이노 D43'
    },
    {
      pinNumber: 42,
      label: 'PL7',
      port: 'PORTL',
      arduino: 'D42',
      side: 'left',
      badges: [
        { text: 'PL7', type: 'port' },
        { text: 'D42', type: 'digital' }
      ],
      desc: '범용 GPIO PL7 / 아두이노 D42'
    },
    {
      pinNumber: 43,
      label: 'PD0',
      port: 'PORTD',
      arduino: 'D21',
      side: 'left',
      badges: [
        { text: 'SCL', type: 'serial' },
        { text: 'INT0', type: 'func' },
        { text: 'PD0', type: 'port' },
        { text: 'D21', type: 'digital' }
      ],
      desc: 'I2C 클럭 라인 (SCL) / 외부 인터럽트 0 / 아두이노 D21'
    },
    {
      pinNumber: 44,
      label: 'PD1',
      port: 'PORTD',
      arduino: 'D20',
      side: 'left',
      badges: [
        { text: 'SDA', type: 'serial' },
        { text: 'INT1', type: 'func' },
        { text: 'PD1', type: 'port' },
        { text: 'D20', type: 'digital' }
      ],
      desc: 'I2C 데이터 라인 (SDA) / 외부 인터럽트 1 / 아두이노 D20'
    },
    {
      pinNumber: 45,
      label: 'PD2',
      port: 'PORTD',
      arduino: 'D19',
      side: 'left',
      badges: [
        { text: 'RXD1', type: 'serial' },
        { text: 'INT2', type: 'func' },
        { text: 'PD2', type: 'port' },
        { text: 'D19', type: 'digital' }
      ],
      desc: 'USART1 시리얼 수신 (RX1) / 아두이노 D19'
    },
    {
      pinNumber: 46,
      label: 'PD3',
      port: 'PORTD',
      arduino: 'D18',
      side: 'left',
      badges: [
        { text: 'TXD1', type: 'serial' },
        { text: 'INT3', type: 'func' },
        { text: 'PD3', type: 'port' },
        { text: 'D18', type: 'digital' }
      ],
      desc: 'USART1 시리얼 송신 (TX1) / 아두이노 D18'
    },
    {
      pinNumber: 47,
      label: 'PD4',
      port: 'PORTD',
      arduino: 'D38',
      side: 'left',
      badges: [
        { text: 'ICP1', type: 'func' },
        { text: 'PD4', type: 'port' },
        { text: 'D38', type: 'digital' }
      ],
      desc: 'Timer1 입력 캡처 / 아두이노 D38'
    },
    {
      pinNumber: 48,
      label: 'PD5',
      port: 'PORTD',
      arduino: 'D39',
      side: 'left',
      badges: [
        { text: 'XCK1', type: 'serial' },
        { text: 'PD5', type: 'port' },
        { text: 'D39', type: 'digital' }
      ],
      desc: 'USART1 동기 클럭 / 아두이노 D39'
    },
    {
      pinNumber: 49,
      label: 'PD6',
      port: 'PORTD',
      arduino: 'D40',
      side: 'left',
      badges: [
        { text: 'T1', type: 'func' },
        { text: 'PD6', type: 'port' },
        { text: 'D40', type: 'digital' }
      ],
      desc: 'Timer1 외부 클럭 카운팅 / 아두이노 D40'
    },
    {
      pinNumber: 50,
      label: 'PD7',
      port: 'PORTD',
      arduino: 'D41',
      side: 'left',
      badges: [
        { text: 'T0', type: 'func' },
        { text: 'PD7', type: 'port' },
        { text: 'D41', type: 'digital' }
      ],
      desc: 'Timer0 외부 클럭 카운팅 / 아두이노 D41'
    },

    // Right Side: Pins 100 down to 51
    {
      pinNumber: 100,
      label: 'AVCC',
      side: 'right',
      badges: [{ text: 'AVCC', type: 'power' }],
      desc: '아날로그 ADC 전원 공급 핀 (10µH LC 필터링 권장)'
    },
    {
      pinNumber: 99,
      label: 'GND',
      side: 'right',
      badges: [{ text: 'GND', type: 'gnd' }],
      desc: '아날로그 접지 (AGND)'
    },
    {
      pinNumber: 98,
      label: 'AREF',
      side: 'right',
      badges: [{ text: 'AREF', type: 'analog' }],
      desc: 'ADC 아날로그 기준 전압 핀 (100nF 커패시터 바이패스)'
    },
    {
      pinNumber: 97,
      label: 'PF0',
      port: 'PORTF',
      arduino: 'A0',
      side: 'right',
      badges: [
        { text: 'PF0', type: 'port' },
        { text: 'ADC0', type: 'analog' },
        { text: 'A0', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 0 / 아두이노 A0'
    },
    {
      pinNumber: 96,
      label: 'PF1',
      port: 'PORTF',
      arduino: 'A1',
      side: 'right',
      badges: [
        { text: 'PF1', type: 'port' },
        { text: 'ADC1', type: 'analog' },
        { text: 'A1', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 1 / 아두이노 A1'
    },
    {
      pinNumber: 95,
      label: 'PF2',
      port: 'PORTF',
      arduino: 'A2',
      side: 'right',
      badges: [
        { text: 'PF2', type: 'port' },
        { text: 'ADC2', type: 'analog' },
        { text: 'A2', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 2 / 아두이노 A2'
    },
    {
      pinNumber: 94,
      label: 'PF3',
      port: 'PORTF',
      arduino: 'A3',
      side: 'right',
      badges: [
        { text: 'PF3', type: 'port' },
        { text: 'ADC3', type: 'analog' },
        { text: 'A3', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 3 / 아두이노 A3'
    },
    {
      pinNumber: 93,
      label: 'PF4',
      port: 'PORTF',
      arduino: 'A4',
      side: 'right',
      badges: [
        { text: 'PF4', type: 'port' },
        { text: 'ADC4', type: 'analog' },
        { text: 'TCK', type: 'func' },
        { text: 'A4', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 4 / JTAG 클럭 (TCK)'
    },
    {
      pinNumber: 92,
      label: 'PF5',
      port: 'PORTF',
      arduino: 'A5',
      side: 'right',
      badges: [
        { text: 'PF5', type: 'port' },
        { text: 'ADC5', type: 'analog' },
        { text: 'TMS', type: 'func' },
        { text: 'A5', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 5 / JTAG 상태 선택 (TMS)'
    },
    {
      pinNumber: 91,
      label: 'PF6',
      port: 'PORTF',
      arduino: 'A6',
      side: 'right',
      badges: [
        { text: 'PF6', type: 'port' },
        { text: 'ADC6', type: 'analog' },
        { text: 'TDO', type: 'func' },
        { text: 'A6', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 6 / JTAG 데이터 출력 (TDO)'
    },
    {
      pinNumber: 90,
      label: 'PF7',
      port: 'PORTF',
      arduino: 'A7',
      side: 'right',
      badges: [
        { text: 'PF7', type: 'port' },
        { text: 'ADC7', type: 'analog' },
        { text: 'TDI', type: 'func' },
        { text: 'A7', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 7 / JTAG 데이터 입력 (TDI)'
    },
    {
      pinNumber: 89,
      label: 'PK0',
      port: 'PORTK',
      arduino: 'A8',
      side: 'right',
      badges: [
        { text: 'PK0', type: 'port' },
        { text: 'ADC8', type: 'analog' },
        { text: 'PCINT16', type: 'func' },
        { text: 'A8', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 8 / 핀체인지 16 / 아두이노 A8'
    },
    {
      pinNumber: 88,
      label: 'PK1',
      port: 'PORTK',
      arduino: 'A9',
      side: 'right',
      badges: [
        { text: 'PK1', type: 'port' },
        { text: 'ADC9', type: 'analog' },
        { text: 'PCINT17', type: 'func' },
        { text: 'A9', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 9 / 핀체인지 17 / 아두이노 A9'
    },
    {
      pinNumber: 87,
      label: 'PK2',
      port: 'PORTK',
      arduino: 'A10',
      side: 'right',
      badges: [
        { text: 'PK2', type: 'port' },
        { text: 'ADC10', type: 'analog' },
        { text: 'PCINT18', type: 'func' },
        { text: 'A10', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 10 / 핀체인지 18 / 아두이노 A10'
    },
    {
      pinNumber: 86,
      label: 'PK3',
      port: 'PORTK',
      arduino: 'A11',
      side: 'right',
      badges: [
        { text: 'PK3', type: 'port' },
        { text: 'ADC11', type: 'analog' },
        { text: 'PCINT19', type: 'func' },
        { text: 'A11', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 11 / 핀체인지 19 / 아두이노 A11'
    },
    {
      pinNumber: 85,
      label: 'PK4',
      port: 'PORTK',
      arduino: 'A12',
      side: 'right',
      badges: [
        { text: 'PK4', type: 'port' },
        { text: 'ADC12', type: 'analog' },
        { text: 'PCINT20', type: 'func' },
        { text: 'A12', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 12 / 핀체인지 20 / 아두이노 A12'
    },
    {
      pinNumber: 84,
      label: 'PK5',
      port: 'PORTK',
      arduino: 'A13',
      side: 'right',
      badges: [
        { text: 'PK5', type: 'port' },
        { text: 'ADC13', type: 'analog' },
        { text: 'PCINT21', type: 'func' },
        { text: 'A13', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 13 / 핀체인지 21 / 아두이노 A13'
    },
    {
      pinNumber: 83,
      label: 'PK6',
      port: 'PORTK',
      arduino: 'A14',
      side: 'right',
      badges: [
        { text: 'PK6', type: 'port' },
        { text: 'ADC14', type: 'analog' },
        { text: 'PCINT22', type: 'func' },
        { text: 'A14', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 14 / 핀체인지 22 / 아두이노 A14'
    },
    {
      pinNumber: 82,
      label: 'PK7',
      port: 'PORTK',
      arduino: 'A15',
      side: 'right',
      badges: [
        { text: 'PK7', type: 'port' },
        { text: 'ADC15', type: 'analog' },
        { text: 'PCINT23', type: 'func' },
        { text: 'A15', type: 'digital' }
      ],
      desc: '10-bit ADC 채널 15 / 핀체인지 23 / 아두이노 A15'
    },
    {
      pinNumber: 81,
      label: 'GND',
      side: 'right',
      badges: [{ text: 'GND', type: 'gnd' }],
      desc: '디지털 시스템 접지 (0V)'
    },
    {
      pinNumber: 80,
      label: 'VCC',
      side: 'right',
      badges: [{ text: 'VCC', type: 'power' }],
      desc: '디지털 시스템 전원 공급 (+1.8V ~ +5.5V)'
    },
    {
      pinNumber: 79,
      label: 'PJ7',
      port: 'PORTJ',
      side: 'right',
      badges: [{ text: 'PJ7', type: 'port' }],
      desc: '범용 GPIO PJ7'
    },
    {
      pinNumber: 78,
      label: 'PA0',
      port: 'PORTA',
      arduino: 'D22',
      side: 'right',
      badges: [
        { text: 'PA0', type: 'port' },
        { text: 'AD0', type: 'func' },
        { text: 'D22', type: 'digital' }
      ],
      desc: 'XMEM 데이터/하위 주소 버스 0 / 아두이노 D22'
    },
    {
      pinNumber: 77,
      label: 'PA1',
      port: 'PORTA',
      arduino: 'D23',
      side: 'right',
      badges: [
        { text: 'PA1', type: 'port' },
        { text: 'AD1', type: 'func' },
        { text: 'D23', type: 'digital' }
      ],
      desc: 'XMEM 데이터/하위 주소 버스 1 / 아두이노 D23'
    },
    {
      pinNumber: 76,
      label: 'PA2',
      port: 'PORTA',
      arduino: 'D24',
      side: 'right',
      badges: [
        { text: 'PA2', type: 'port' },
        { text: 'AD2', type: 'func' },
        { text: 'D24', type: 'digital' }
      ],
      desc: 'XMEM 데이터/하위 주소 버스 2 / 아두이노 D24'
    },
    {
      pinNumber: 75,
      label: 'PA3',
      port: 'PORTA',
      arduino: 'D25',
      side: 'right',
      badges: [
        { text: 'PA3', type: 'port' },
        { text: 'AD3', type: 'func' },
        { text: 'D25', type: 'digital' }
      ],
      desc: 'XMEM 데이터/하위 주소 버스 3 / 아두이노 D25'
    },
    {
      pinNumber: 74,
      label: 'PA4',
      port: 'PORTA',
      arduino: 'D26',
      side: 'right',
      badges: [
        { text: 'PA4', type: 'port' },
        { text: 'AD4', type: 'func' },
        { text: 'D26', type: 'digital' }
      ],
      desc: 'XMEM 데이터/하위 주소 버스 4 / 아두이노 D26'
    },
    {
      pinNumber: 73,
      label: 'PA5',
      port: 'PORTA',
      arduino: 'D27',
      side: 'right',
      badges: [
        { text: 'PA5', type: 'port' },
        { text: 'AD5', type: 'func' },
        { text: 'D27', type: 'digital' }
      ],
      desc: 'XMEM 데이터/하위 주소 버스 5 / 아두이노 D27'
    },
    {
      pinNumber: 72,
      label: 'PA6',
      port: 'PORTA',
      arduino: 'D28',
      side: 'right',
      badges: [
        { text: 'PA6', type: 'port' },
        { text: 'AD6', type: 'func' },
        { text: 'D28', type: 'digital' }
      ],
      desc: 'XMEM 데이터/하위 주소 버스 6 / 아두이노 D28'
    },
    {
      pinNumber: 71,
      label: 'PA7',
      port: 'PORTA',
      arduino: 'D29',
      side: 'right',
      badges: [
        { text: 'PA7', type: 'port' },
        { text: 'AD7', type: 'func' },
        { text: 'D29', type: 'digital' }
      ],
      desc: 'XMEM 데이터/하위 주소 버스 7 / 아두이노 D29'
    },
    {
      pinNumber: 70,
      label: 'PG2',
      port: 'PORTG',
      side: 'right',
      badges: [
        { text: 'PG2', type: 'port' },
        { text: 'ALE', type: 'func' }
      ],
      desc: 'Address Latch Enable (외부 메모리 주소 디먹싱)'
    },
    {
      pinNumber: 69,
      label: 'PJ6',
      port: 'PORTJ',
      side: 'right',
      badges: [
        { text: 'PJ6', type: 'port' },
        { text: 'PCINT15', type: 'func' }
      ],
      desc: '범용 GPIO PJ6 / 핀체인지 15'
    },
    {
      pinNumber: 68,
      label: 'PJ5',
      port: 'PORTJ',
      side: 'right',
      badges: [
        { text: 'PJ5', type: 'port' },
        { text: 'PCINT14', type: 'func' }
      ],
      desc: '범용 GPIO PJ5 / 핀체인지 14'
    },
    {
      pinNumber: 67,
      label: 'PJ4',
      port: 'PORTJ',
      side: 'right',
      badges: [
        { text: 'PJ4', type: 'port' },
        { text: 'PCINT13', type: 'func' }
      ],
      desc: '범용 GPIO PJ4 / 핀체인지 13'
    },
    {
      pinNumber: 66,
      label: 'PJ3',
      port: 'PORTJ',
      side: 'right',
      badges: [
        { text: 'PJ3', type: 'port' },
        { text: 'PCINT12', type: 'func' }
      ],
      desc: '범용 GPIO PJ3 / 핀체인지 12'
    },
    {
      pinNumber: 65,
      label: 'PJ2',
      port: 'PORTJ',
      side: 'right',
      badges: [
        { text: 'PJ2', type: 'port' },
        { text: 'XCK3', type: 'serial' },
        { text: 'PCINT11', type: 'func' }
      ],
      desc: 'USART3 동기 클럭 / 핀체인지 11'
    },
    {
      pinNumber: 64,
      label: 'PJ1',
      port: 'PORTJ',
      arduino: 'D14',
      side: 'right',
      badges: [
        { text: 'PJ1', type: 'port' },
        { text: 'TXD3', type: 'serial' },
        { text: 'D14', type: 'digital' }
      ],
      desc: 'USART3 시리얼 송신 (TX3) / 아두이노 D14'
    },
    {
      pinNumber: 63,
      label: 'PJ0',
      port: 'PORTJ',
      arduino: 'D15',
      side: 'right',
      badges: [
        { text: 'PJ0', type: 'port' },
        { text: 'RXD3', type: 'serial' },
        { text: 'D15', type: 'digital' }
      ],
      desc: 'USART3 시리얼 수신 (RX3) / 아두이노 D15'
    },
    {
      pinNumber: 62,
      label: 'GND',
      side: 'right',
      badges: [{ text: 'GND', type: 'gnd' }],
      desc: '디지털 시스템 접지 (0V)'
    },
    {
      pinNumber: 61,
      label: 'VCC',
      side: 'right',
      badges: [{ text: 'VCC', type: 'power' }],
      desc: '디지털 시스템 전원 공급 (+1.8V ~ +5.5V)'
    },
    {
      pinNumber: 60,
      label: 'PC7',
      port: 'PORTC',
      arduino: 'D30',
      side: 'right',
      badges: [
        { text: 'PC7', type: 'port' },
        { text: 'A15', type: 'func' },
        { text: 'D30', type: 'digital' }
      ],
      desc: 'XMEM 상위 주소 버스 A15 / 아두이노 D30'
    },
    {
      pinNumber: 59,
      label: 'PC6',
      port: 'PORTC',
      arduino: 'D31',
      side: 'right',
      badges: [
        { text: 'PC6', type: 'port' },
        { text: 'A14', type: 'func' },
        { text: 'D31', type: 'digital' }
      ],
      desc: 'XMEM 상위 주소 버스 A14 / 아두이노 D31'
    },
    {
      pinNumber: 58,
      label: 'PC5',
      port: 'PORTC',
      arduino: 'D32',
      side: 'right',
      badges: [
        { text: 'PC5', type: 'port' },
        { text: 'A13', type: 'func' },
        { text: 'D32', type: 'digital' }
      ],
      desc: 'XMEM 상위 주소 버스 A13 / 아두이노 D32'
    },
    {
      pinNumber: 57,
      label: 'PC4',
      port: 'PORTC',
      arduino: 'D33',
      side: 'right',
      badges: [
        { text: 'PC4', type: 'port' },
        { text: 'A12', type: 'func' },
        { text: 'D33', type: 'digital' }
      ],
      desc: 'XMEM 상위 주소 버스 A12 / 아두이노 D33'
    },
    {
      pinNumber: 56,
      label: 'PC3',
      port: 'PORTC',
      arduino: 'D34',
      side: 'right',
      badges: [
        { text: 'PC3', type: 'port' },
        { text: 'A11', type: 'func' },
        { text: 'D34', type: 'digital' }
      ],
      desc: 'XMEM 상위 주소 버스 A11 / 아두이노 D34'
    },
    {
      pinNumber: 55,
      label: 'PC2',
      port: 'PORTC',
      arduino: 'D35',
      side: 'right',
      badges: [
        { text: 'PC2', type: 'port' },
        { text: 'A10', type: 'func' },
        { text: 'D35', type: 'digital' }
      ],
      desc: 'XMEM 상위 주소 버스 A10 / 아두이노 D35'
    },
    {
      pinNumber: 54,
      label: 'PC1',
      port: 'PORTC',
      arduino: 'D36',
      side: 'right',
      badges: [
        { text: 'PC1', type: 'port' },
        { text: 'A9', type: 'func' },
        { text: 'D36', type: 'digital' }
      ],
      desc: 'XMEM 상위 주소 버스 A9 / 아두이노 D36'
    },
    {
      pinNumber: 53,
      label: 'PC0',
      port: 'PORTC',
      arduino: 'D37',
      side: 'right',
      badges: [
        { text: 'PC0', type: 'port' },
        { text: 'A8', type: 'func' },
        { text: 'D37', type: 'digital' }
      ],
      desc: 'XMEM 상위 주소 버스 A8 / 아두이노 D37'
    },
    {
      pinNumber: 52,
      label: 'PG1',
      port: 'PORTG',
      side: 'right',
      badges: [
        { text: 'PG1', type: 'port' },
        { text: 'RD', type: 'control' }
      ],
      desc: 'XMEM Read Strobe (/RD Active Low)'
    },
    {
      pinNumber: 51,
      label: 'PG0',
      port: 'PORTG',
      side: 'right',
      badges: [
        { text: 'PG0', type: 'port' },
        { text: 'WR', type: 'control' }
      ],
      desc: 'XMEM Write Strobe (/WR Active Low)'
    }
  ]
};

export const ATMEGA2560_DIAGRAM: McuDiagramProfile = {
  id: 'atmega2560',
  name: 'ATmega2560',
  chipLabel: 'ATMEGA2560',
  packageType: '100-pin TQFP (TQFP-100)',
  subtitle: 'Arduino Mega 2560 정품 표준 플래그십 (256KB Flash, 8KB SRAM, 86 I/O)',
  totalPins: 100,
  notes: [
    '100-pin TQFP 패키지: Arduino Mega 2560 정품 표준 플래그십 마이크로컨트롤러',
    '총 86개 범용 I/O 라인 (Port A~L), 4개 독립 하드웨어 USART (USART0~3)',
    '16개 아날로그 ADC 채널 (ADC0~ADC15 / Port F & Port K)',
    '16개 하드웨어 PWM 채널 (Timer 0/1/2/3/4/5 고분해능 연동)',
    '256KB 대용량 플래시(128KW) 및 3바이트 Program Counter(PC) 구조'
  ],
  pins: ATMEGA640_DIAGRAM.pins
};

export const MCU_DIAGRAM_MAP: Record<SupportedMCU, McuDiagramProfile> = {
  atmega328p: ATMEGA328P_DIAGRAM,
  atmega128: ATMEGA128_DIAGRAM,
  atmega640: ATMEGA640_DIAGRAM,
  atmega2560: ATMEGA2560_DIAGRAM
};

export const BADGE_STYLES: Record<BadgeType, { bg: string; text: string; border: string; label: string }> = {
  gnd: { bg: '#18181b', text: '#ffffff', border: '#3f3f46', label: 'GND (접지)' },
  power: { bg: '#dc2626', text: '#ffffff', border: '#b91c1c', label: 'POWER (VCC/AVCC)' },
  control: { bg: '#eab308', text: '#713f12', border: '#ca8a04', label: 'CONTROL (RESET/RD/WR)' },
  port: { bg: '#fef08a', text: '#713f12', border: '#facc15', label: 'PORT PIN (포트 핀)' },
  func: { bg: '#ffffff', text: '#1e293b', border: '#94a3b8', label: 'MCU PIN FUNC (클럭/기능)' },
  digital: { bg: '#92400e', text: '#ffffff', border: '#78350f', label: 'DIGITAL / ARDUINO PIN' },
  analog: { bg: '#16a34a', text: '#ffffff', border: '#15803d', label: 'ANALOG-RELATED PIN (ADC)' },
  pwm: { bg: '#fb7185', text: '#881337', border: '#f43f5e', label: 'PWM PIN (타이머 출력)' },
  serial: { bg: '#38bdf8', text: '#0c4a6e', border: '#0284c7', label: 'SERIAL PIN (UART/SPI/I2C)' }
};
