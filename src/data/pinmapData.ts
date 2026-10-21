export interface PinDefinition {
  pin: string;
  name: string;
  physicalPin?: number | string;
  alt: string;
  reg: string;
  arduino: string;
  desc: string;
  category: 'gpio' | 'comm' | 'timer' | 'analog' | 'interrupt' | 'system' | 'memory';
}

export interface PortInfo {
  name: string;
  width: number;
  desc: string;
  registers: string;
  pins: PinDefinition[];
}

export type SupportedMCU = 'atmega640' | 'atmega128' | 'atmega328p' | 'atmega2560';

export interface MCUProfile {
  id: SupportedMCU;
  name: string;
  fullName: string;
  subtitle: string;
  package: string;
  flash: number;
  sram: number;
  eeprom: number;
  io: number;
  usart: number;
  pwm: number;
  adc: number;
  timers: string;
  maxFreq: string;
  operatingVoltage: string;
  tag: string;
  keyStrengths: string[];
  ports: Record<string, PortInfo>;
}

// -----------------------------------------------------------------
// 1. ATMEGA640 (100-pin TQFP, 86 I/O, Port A~L)
// -----------------------------------------------------------------
export const ATMEGA640_PORTS: Record<string, PortInfo> = {
  PORTA: {
    name: 'PORT A',
    width: 8,
    desc: '외부 메모리 인터페이스 (Address/Data 0~7 멀티플렉스 버스) 또는 8비트 범용 양방향 I/O',
    registers: 'DDRA (0x21), PORTA (0x22), PINA (0x20)',
    pins: [
      { pin: 'PA0', name: 'PA0 / AD0', physicalPin: 78, alt: 'AD0 (외부 메모리 주소/데이터 비트 0)', reg: 'DDRA0, PORTA0, PINA0', arduino: 'D22', desc: '외부 SRAM/EEPROM 확장 시 멀티플렉스 데이터/하위 주소 버스 비트 0', category: 'memory' },
      { pin: 'PA1', name: 'PA1 / AD1', physicalPin: 77, alt: 'AD1 (외부 메모리 주소/데이터 비트 1)', reg: 'DDRA1, PORTA1, PINA1', arduino: 'D23', desc: '외부 버스 비트 1', category: 'memory' },
      { pin: 'PA2', name: 'PA2 / AD2', physicalPin: 76, alt: 'AD2 (외부 메모리 주소/데이터 비트 2)', reg: 'DDRA2, PORTA2, PINA2', arduino: 'D24', desc: '외부 버스 비트 2', category: 'memory' },
      { pin: 'PA3', name: 'PA3 / AD3', physicalPin: 75, alt: 'AD3 (외부 메모리 주소/데이터 비트 3)', reg: 'DDRA3, PORTA3, PINA3', arduino: 'D25', desc: '외부 버스 비트 3', category: 'memory' },
      { pin: 'PA4', name: 'PA4 / AD4', physicalPin: 74, alt: 'AD4 (외부 메모리 주소/데이터 비트 4)', reg: 'DDRA4, PORTA4, PINA4', arduino: 'D26', desc: '외부 버스 비트 4', category: 'memory' },
      { pin: 'PA5', name: 'PA5 / AD5', physicalPin: 73, alt: 'AD5 (외부 메모리 주소/데이터 비트 5)', reg: 'DDRA5, PORTA5, PINA5', arduino: 'D27', desc: '외부 버스 비트 5', category: 'memory' },
      { pin: 'PA6', name: 'PA6 / AD6', physicalPin: 72, alt: 'AD6 (외부 메모리 주소/데이터 비트 6)', reg: 'DDRA6, PORTA6, PINA6', arduino: 'D28', desc: '외부 버스 비트 6', category: 'memory' },
      { pin: 'PA7', name: 'PA7 / AD7', physicalPin: 71, alt: 'AD7 (외부 메모리 주소/데이터 비트 7)', reg: 'DDRA7, PORTA7, PINA7', arduino: 'D29', desc: '외부 버스 비트 7', category: 'memory' },
    ]
  },
  PORTB: {
    name: 'PORT B',
    width: 8,
    desc: '하드웨어 SPI 버스, Timer/Counter0, Timer/Counter1, Timer/Counter2 파형 출력 및 핀 체인지 인터럽트',
    registers: 'DDRB (0x24), PORTB (0x25), PINB (0x23)',
    pins: [
      { pin: 'PB0', name: 'PB0 / SS / PCINT0', physicalPin: 19, alt: 'SS (SPI Slave Select), PCINT0', reg: 'DDRB0, PORTB0, PINB0', arduino: 'D53', desc: 'SPI 통신 슬레이브 선택 라인 및 핀 변경 인터럽트 0', category: 'comm' },
      { pin: 'PB1', name: 'PB1 / SCK / PCINT1', physicalPin: 20, alt: 'SCK (SPI Serial Clock), PCINT1', reg: 'DDRB1, PORTB1, PINB1', arduino: 'D52', desc: 'SPI 동기 클럭 라인 및 ISP 프로그래밍 SCK 라인', category: 'comm' },
      { pin: 'PB2', name: 'PB2 / MOSI / PCINT2', physicalPin: 21, alt: 'MOSI (Master Out Slave In), PCINT2', reg: 'DDRB2, PORTB2, PINB2', arduino: 'D51', desc: 'SPI 마스터 데이터 출력 / ISP 데이터 입력', category: 'comm' },
      { pin: 'PB3', name: 'PB3 / MISO / PCINT3', physicalPin: 22, alt: 'MISO (Master In Slave Out), PCINT3', reg: 'DDRB3, PORTB3, PINB3', arduino: 'D50', desc: 'SPI 마스터 데이터 입력 / ISP 데이터 출력', category: 'comm' },
      { pin: 'PB4', name: 'PB4 / OC0A / PCINT4', physicalPin: 23, alt: 'OC0A (Timer0 Compare A), PCINT4', reg: 'DDRB4, PORTB4, PINB4', arduino: 'D10', desc: '8비트 Timer0 비교 출력 파형 (PWM 출력)', category: 'timer' },
      { pin: 'PB5', name: 'PB5 / OC1A / PCINT5', physicalPin: 24, alt: 'OC1A (Timer1 Compare A), PCINT5', reg: 'DDRB5, PORTB5, PINB5', arduino: 'D11', desc: '16비트 Timer1 Compare A 파형 출력 (정밀 PWM)', category: 'timer' },
      { pin: 'PB6', name: 'PB6 / OC1B / PCINT6', physicalPin: 25, alt: 'OC1B (Timer1 Compare B), PCINT6', reg: 'DDRB6, PORTB6, PINB6', arduino: 'D12', desc: '16비트 Timer1 Compare B 파형 출력 (정밀 PWM)', category: 'timer' },
      { pin: 'PB7', name: 'PB7 / OC0B / OC1C / PCINT7', physicalPin: 26, alt: 'OC0B, OC1C, PCINT7', reg: 'DDRB7, PORTB7, PINB7', arduino: 'D13', desc: 'Timer0 Compare B / Timer1 Compare C 출력 (LED 핀 매핑)', category: 'timer' },
    ]
  },
  PORTC: {
    name: 'PORT C',
    width: 8,
    desc: '외부 메모리 인터페이스 상위 주소 버스(A8~A15) 또는 범용 디지털 I/O',
    registers: 'DDRC (0x27), PORTC (0x28), PINC (0x26)',
    pins: [
      { pin: 'PC0', name: 'PC0 / A8', physicalPin: 53, alt: 'A8 (외부 메모리 주소 비트 8)', reg: 'DDRC0, PORTC0, PINC0', arduino: 'D37', desc: '외부 메모리 공간 상위 주소 라인 8', category: 'memory' },
      { pin: 'PC1', name: 'PC1 / A9', physicalPin: 54, alt: 'A9 (외부 메모리 주소 비트 9)', reg: 'DDRC1, PORTC1, PINC1', arduino: 'D36', desc: '외부 메모리 공간 상위 주소 라인 9', category: 'memory' },
      { pin: 'PC2', name: 'PC2 / A10', physicalPin: 55, alt: 'A10 (외부 메모리 주소 비트 10)', reg: 'DDRC2, PORTC2, PINC2', arduino: 'D35', desc: '외부 메모리 공간 상위 주소 라인 10', category: 'memory' },
      { pin: 'PC3', name: 'PC3 / A11', physicalPin: 56, alt: 'A11 (외부 메모리 주소 비트 11)', reg: 'DDRC3, PORTC3, PINC3', arduino: 'D34', desc: '외부 메모리 공간 상위 주소 라인 11', category: 'memory' },
      { pin: 'PC4', name: 'PC4 / A12', physicalPin: 57, alt: 'A12 (외부 메모리 주소 비트 12)', reg: 'DDRC4, PORTC4, PINC4', arduino: 'D33', desc: '외부 메모리 공간 상위 주소 라인 12', category: 'memory' },
      { pin: 'PC5', name: 'PC5 / A13', physicalPin: 58, alt: 'A13 (외부 메모리 주소 비트 13)', reg: 'DDRC5, PORTC5, PINC5', arduino: 'D32', desc: '외부 메모리 공간 상위 주소 라인 13', category: 'memory' },
      { pin: 'PC6', name: 'PC6 / A14', physicalPin: 59, alt: 'A14 (외부 메모리 주소 비트 14)', reg: 'DDRC6, PORTC6, PINC6', arduino: 'D31', desc: '외부 메모리 공간 상위 주소 라인 14', category: 'memory' },
      { pin: 'PC7', name: 'PC7 / A15', physicalPin: 60, alt: 'A15 (외부 메모리 주소 비트 15)', reg: 'DDRC7, PORTC7, PINC7', arduino: 'D30', desc: '외부 메모리 공간 상위 주소 라인 15', category: 'memory' },
    ]
  },
  PORTD: {
    name: 'PORT D',
    width: 8,
    desc: '하드웨어 I2C (TWI) 버스, USART1 시리얼 통신, 외부 인터럽트 INT0~INT3, 타이머 클럭 입력',
    registers: 'DDRD (0x2A), PORTD (0x2B), PIND (0x29)',
    pins: [
      { pin: 'PD0', name: 'PD0 / SCL / INT0', physicalPin: 43, alt: 'SCL (TWI Clock), INT0', reg: 'DDRD0, PORTD0, PIND0', arduino: 'D21', desc: '2선 직렬 I2C 클럭 라인 및 하드웨어 외부 인터럽트 0', category: 'comm' },
      { pin: 'PD1', name: 'PD1 / SDA / INT1', physicalPin: 44, alt: 'SDA (TWI Data), INT1', reg: 'DDRD1, PORTD1, PIND1', arduino: 'D20', desc: '2선 직렬 I2C 데이터 라인 및 하드웨어 외부 인터럽트 1', category: 'comm' },
      { pin: 'PD2', name: 'PD2 / RXD1 / INT2', physicalPin: 45, alt: 'RXD1 (USART1 수신), INT2', reg: 'DDRD2, PORTD2, PIND2', arduino: 'D19', desc: 'USART1 시리얼 데이터 수신 및 외부 인터럽트 2', category: 'comm' },
      { pin: 'PD3', name: 'PD3 / TXD1 / INT3', physicalPin: 46, alt: 'TXD1 (USART1 송신), INT3', reg: 'DDRD3, PORTD3, PIND3', arduino: 'D18', desc: 'USART1 시리얼 데이터 송신 및 외부 인터럽트 3', category: 'comm' },
      { pin: 'PD4', name: 'PD4 / ICP1', physicalPin: 47, alt: 'ICP1 (Timer1 Input Capture)', reg: 'DDRD4, PORTD4, PIND4', arduino: 'D38', desc: '16비트 Timer1 입력 캡처 핀 (펄스폭/주기 측정)', category: 'timer' },
      { pin: 'PD5', name: 'PD5 / XCK1', physicalPin: 48, alt: 'XCK1 (USART1 동기 클럭)', reg: 'DDRD5, PORTD5, PIND5', arduino: 'D39', desc: 'USART1 동기 모드 클럭 입출력 핀', category: 'comm' },
      { pin: 'PD6', name: 'PD6 / T1', physicalPin: 49, alt: 'T1 (Timer1 외부 카운터 클럭)', reg: 'DDRD6, PORTD6, PIND6', arduino: 'D40', desc: 'Timer1 외부 펄스 카운팅 입력', category: 'timer' },
      { pin: 'PD7', name: 'PD7 / T0', physicalPin: 50, alt: 'T0 (Timer0 외부 카운터 클럭)', reg: 'DDRD7, PORTD7, PIND7', arduino: 'D41', desc: 'Timer0 외부 펄스 카운팅 입력', category: 'timer' },
    ]
  },
  PORTE: {
    name: 'PORT E',
    width: 8,
    desc: 'USART0 (기본 시스템 콘솔), 16비트 Timer3 PWM 출력 (OC3A/B/C), 아날로그 비교기 AIN0/1, 외부 인터럽트 INT4~INT7',
    registers: 'DDRE (0x2D), PORTE (0x2E), PINE (0x2C)',
    pins: [
      { pin: 'PE0', name: 'PE0 / RXD0 / PCINT8', physicalPin: 2, alt: 'RXD0 (USART0 수신), PCINT8', reg: 'DDRE0, PORTE0, PINE0', arduino: 'D0', desc: 'USART0 기본 시리얼 통신 수신 (부트로더 및 터미널 통신)', category: 'comm' },
      { pin: 'PE1', name: 'PE1 / TXD0', physicalPin: 3, alt: 'TXD0 (USART0 송신)', reg: 'DDRE1, PORTE1, PINE1', arduino: 'D1', desc: 'USART0 기본 시리얼 통신 송신 (디버그 콘솔 출력)', category: 'comm' },
      { pin: 'PE2', name: 'PE2 / XCK0 / AIN0', physicalPin: 4, alt: 'XCK0, AIN0 (아날로그 비교기 +)', reg: 'DDRE2, PORTE2, PINE2', arduino: 'D42', desc: 'USART0 동기 클럭 및 내장 아날로그 비교기 양의 입력', category: 'analog' },
      { pin: 'PE3', name: 'PE3 / OC3A / AIN1', physicalPin: 5, alt: 'OC3A (Timer3 PWM A), AIN1', reg: 'DDRE3, PORTE3, PINE3', arduino: 'D5', desc: '16비트 Timer3 Compare A 출력 및 아날로그 비교기 음의 입력', category: 'timer' },
      { pin: 'PE4', name: 'PE4 / OC3B / INT4', physicalPin: 6, alt: 'OC3B (Timer3 PWM B), INT4', reg: 'DDRE4, PORTE4, PINE4', arduino: 'D2', desc: '16비트 Timer3 Compare B 출력 및 외부 인터럽트 4', category: 'timer' },
      { pin: 'PE5', name: 'PE5 / OC3C / INT5', physicalPin: 7, alt: 'OC3C (Timer3 PWM C), INT5', reg: 'DDRE5, PORTE5, PINE5', arduino: 'D3', desc: '16비트 Timer3 Compare C 출력 및 외부 인터럽트 5', category: 'timer' },
      { pin: 'PE6', name: 'PE6 / T3 / INT6', physicalPin: 8, alt: 'T3 (Timer3 외부 클럭), INT6', reg: 'DDRE6, PORTE6, PINE6', arduino: 'D43', desc: 'Timer3 외부 카운터 클럭 및 외부 인터럽트 6', category: 'timer' },
      { pin: 'PE7', name: 'PE7 / ICP3 / INT7', physicalPin: 9, alt: 'ICP3 (Timer3 캡처), INT7', reg: 'DDRE7, PORTE7, PINE7', arduino: 'D44', desc: 'Timer3 입력 캡처 및 외부 인터럽트 7 (CLKOUT 옵션)', category: 'timer' },
    ]
  },
  PORTF: {
    name: 'PORT F',
    width: 8,
    desc: '10비트 고분해능 아날로그-디지털 변환기(ADC0~ADC7) 및 JTAG 테스트 인터페이스',
    registers: 'DDRF (0x30), PORTF (0x31), PINF (0x2F)',
    pins: [
      { pin: 'PF0', name: 'PF0 / ADC0', physicalPin: 97, alt: 'ADC0 (아날로그 입력 채널 0)', reg: 'DDRF0, PORTF0, PINF0', arduino: 'A0', desc: '10비트 ADC 단일 종단 입력 0', category: 'analog' },
      { pin: 'PF1', name: 'PF1 / ADC1', physicalPin: 96, alt: 'ADC1 (아날로그 입력 채널 1)', reg: 'DDRF1, PORTF1, PINF1', arduino: 'A1', desc: '10비트 ADC 단일 종단 입력 1', category: 'analog' },
      { pin: 'PF2', name: 'PF2 / ADC2', physicalPin: 95, alt: 'ADC2 (아날로그 입력 채널 2)', reg: 'DDRF2, PORTF2, PINF2', arduino: 'A2', desc: '10비트 ADC 단일 종단 입력 2', category: 'analog' },
      { pin: 'PF3', name: 'PF3 / ADC3', physicalPin: 94, alt: 'ADC3 (아날로그 입력 채널 3)', reg: 'DDRF3, PORTF3, PINF3', arduino: 'A3', desc: '10비트 ADC 단일 종단 입력 3', category: 'analog' },
      { pin: 'PF4', name: 'PF4 / ADC4 / TCK', physicalPin: 93, alt: 'ADC4, JTAG TCK', reg: 'DDRF4, PORTF4, PINF4', arduino: 'A4', desc: '10비트 ADC 입력 및 JTAG 테스트 클럭', category: 'analog' },
      { pin: 'PF5', name: 'PF5 / ADC5 / TMS', physicalPin: 92, alt: 'ADC5, JTAG TMS', reg: 'DDRF5, PORTF5, PINF5', arduino: 'A5', desc: '10비트 ADC 입력 및 JTAG 모드 선택', category: 'analog' },
      { pin: 'PF6', name: 'PF6 / ADC6 / TDO', physicalPin: 91, alt: 'ADC6, JTAG TDO', reg: 'DDRF6, PORTF6, PINF6', arduino: 'A6', desc: '10비트 ADC 입력 및 JTAG 데이터 출력', category: 'analog' },
      { pin: 'PF7', name: 'PF7 / ADC7 / TDI', physicalPin: 90, alt: 'ADC7, JTAG TDI', reg: 'DDRF7, PORTF7, PINF7', arduino: 'A7', desc: '10비트 ADC 입력 및 JTAG 데이터 입력 (차동 입력 지원)', category: 'analog' },
    ]
  },
  PORTG: {
    name: 'PORT G',
    width: 6,
    desc: '외부 메모리 버스 제어선 (WR, RD, ALE), TOSC 실시간 클럭 오실레이터 입력 (6비트 포트)',
    registers: 'DDRG (0x33), PORTG (0x34), PING (0x32)',
    pins: [
      { pin: 'PG0', name: 'PG0 / WR', physicalPin: 51, alt: 'WR (외부 메모리 쓰기 스트로브)', reg: 'DDRG0, PORTG0, PING0', arduino: 'D47', desc: '외부 SRAM 쓰기 동작 활성화 제어 신호', category: 'memory' },
      { pin: 'PG1', name: 'PG1 / RD', physicalPin: 52, alt: 'RD (외부 메모리 읽기 스트로브)', reg: 'DDRG1, PORTG1, PING1', arduino: 'D48', desc: '외부 SRAM 읽기 동작 활성화 제어 신호', category: 'memory' },
      { pin: 'PG2', name: 'PG2 / ALE', physicalPin: 70, alt: 'ALE (Address Latch Enable)', reg: 'DDRG2, PORTG2, PING2', arduino: 'D49', desc: '외부 멀티플렉스 버스 주소 래치 신호', category: 'memory' },
      { pin: 'PG3', name: 'PG3 / TOSC2', physicalPin: 42, alt: 'TOSC2 (타이머 발진기 2)', reg: 'DDRG3, PORTG3, PING3', arduino: 'D45', desc: '32.768kHz RTC용 비동기 크리스탈 연결 단자 2', category: 'system' },
      { pin: 'PG4', name: 'PG4 / TOSC1', physicalPin: 41, alt: 'TOSC1 (타이머 발진기 1)', reg: 'DDRG4, PORTG4, PING4', arduino: 'D46', desc: '32.768kHz RTC용 비동기 크리스탈 연결 단자 1', category: 'system' },
      { pin: 'PG5', name: 'PG5 / OC0B', physicalPin: 1, alt: 'OC0B (Timer0 Compare B 파형)', reg: 'DDRG5, PORTG5, PING5', arduino: 'D4', desc: 'Timer0 보조 PWM 파형 출력 핀', category: 'timer' },
    ]
  },
  PORTH: {
    name: 'PORT H',
    width: 8,
    desc: 'USART2 시리얼 통신, 16비트 Timer4 PWM (OC4A/B/C), Timer2 클럭/파형 출력',
    registers: 'DDRH (0x101), PORTH (0x102), PINH (0x100)',
    pins: [
      { pin: 'PH0', name: 'PH0 / RXD2', physicalPin: 12, alt: 'RXD2 (USART2 수신)', reg: 'DDRH0, PORTH0, PINH0', arduino: 'D17', desc: 'USART2 직렬 통신 데이터 수신 라인', category: 'comm' },
      { pin: 'PH1', name: 'PH1 / TXD2', physicalPin: 13, alt: 'TXD2 (USART2 송신)', reg: 'DDRH1, PORTH1, PINH1', arduino: 'D16', desc: 'USART2 직렬 통신 데이터 송신 라인', category: 'comm' },
      { pin: 'PH2', name: 'PH2 / XCK2', physicalPin: 14, alt: 'XCK2 (USART2 동기 클럭)', reg: 'DDRH2, PORTH2, PINH2', arduino: 'D7', desc: 'USART2 동기 모드 클럭 입출력', category: 'comm' },
      { pin: 'PH3', name: 'PH3 / OC4A', physicalPin: 15, alt: 'OC4A (Timer4 PWM A)', reg: 'DDRH3, PORTH3, PINH3', arduino: 'D6', desc: '16비트 Timer4 Compare A 출력 (PWM 파형 생성)', category: 'timer' },
      { pin: 'PH4', name: 'PH4 / OC4B', physicalPin: 16, alt: 'OC4B (Timer4 PWM B)', reg: 'DDRH4, PORTH4, PINH4', arduino: 'D7', desc: '16비트 Timer4 Compare B 출력 (PWM 파형 생성)', category: 'timer' },
      { pin: 'PH5', name: 'PH5 / OC4C', physicalPin: 17, alt: 'OC4C (Timer4 PWM C)', reg: 'DDRH5, PORTH5, PINH5', arduino: 'D8', desc: '16비트 Timer4 Compare C 출력 (PWM 파형 생성)', category: 'timer' },
      { pin: 'PH6', name: 'PH6 / OC2B', physicalPin: 18, alt: 'OC2B (Timer2 PWM B)', reg: 'DDRH6, PORTH6, PINH6', arduino: 'D9', desc: '8비트 Timer2 Compare B 비동기 PWM 출력', category: 'timer' },
      { pin: 'PH7', name: 'PH7 / T4', physicalPin: 27, alt: 'T4 (Timer4 카운터 클럭 입력)', reg: 'DDRH7, PORTH7, PINH7', arduino: 'D64', desc: 'Timer4 외부 이벤트 펄스 카운터 입력', category: 'timer' },
    ]
  },
  PORTJ: {
    name: 'PORT J',
    width: 8,
    desc: 'USART3 시리얼 통신, 핀 체인지 인터럽트 PCINT9~PCINT15',
    registers: 'DDRJ (0x104), PORTJ (0x105), PINJ (0x103)',
    pins: [
      { pin: 'PJ0', name: 'PJ0 / RXD3 / PCINT9', physicalPin: 63, alt: 'RXD3 (USART3 수신), PCINT9', reg: 'DDRJ0, PORTJ0, PINJ0', arduino: 'D15', desc: 'USART3 직렬 통신 데이터 수신 라인', category: 'comm' },
      { pin: 'PJ1', name: 'PJ1 / TXD3 / PCINT10', physicalPin: 64, alt: 'TXD3 (USART3 송신), PCINT10', reg: 'DDRJ1, PORTJ1, PINJ1', arduino: 'D14', desc: 'USART3 직렬 통신 데이터 송신 라인', category: 'comm' },
      { pin: 'PJ2', name: 'PJ2 / XCK3 / PCINT11', physicalPin: 65, alt: 'XCK3, PCINT11', reg: 'DDRJ2, PORTJ2, PINJ2', arduino: 'D65', desc: 'USART3 동기 클럭 및 핀 체인지 인터럽트 11', category: 'comm' },
      { pin: 'PJ3', name: 'PJ3 / PCINT12', physicalPin: 66, alt: 'PCINT12 (핀 체인지 인터럽트)', reg: 'DDRJ3, PORTJ3, PINJ3', arduino: 'D66', desc: '외부 신호 감지 인터럽트 12', category: 'interrupt' },
      { pin: 'PJ4', name: 'PJ4 / PCINT13', physicalPin: 67, alt: 'PCINT13 (핀 체인지 인터럽트)', reg: 'DDRJ4, PORTJ4, PINJ4', arduino: 'D67', desc: '외부 신호 감지 인터럽트 13', category: 'interrupt' },
      { pin: 'PJ5', name: 'PJ5 / PCINT14', physicalPin: 68, alt: 'PCINT14 (핀 체인지 인터럽트)', reg: 'DDRJ5, PORTJ5, PINJ5', arduino: 'D68', desc: '외부 신호 감지 인터럽트 14', category: 'interrupt' },
      { pin: 'PJ6', name: 'PJ6 / PCINT15', physicalPin: 69, alt: 'PCINT15 (핀 체인지 인터럽트)', reg: 'DDRJ6, PORTJ6, PINJ6', arduino: 'D69', desc: '외부 신호 감지 인터럽트 15', category: 'interrupt' },
    ]
  },
  PORTK: {
    name: 'PORT K',
    width: 8,
    desc: '추가 8채널 10비트 ADC (ADC8~ADC15) 및 핀 체인지 인터럽트 PCINT16~PCINT23',
    registers: 'DDRK (0x107), PORTK (0x108), PINK (0x106)',
    pins: [
      { pin: 'PK0', name: 'PK0 / ADC8 / PCINT16', physicalPin: 89, alt: 'ADC8, PCINT16', reg: 'DDRK0, PORTK0, PINK0', arduino: 'A8', desc: '10비트 ADC 8번 채널 아날로그 입력', category: 'analog' },
      { pin: 'PK1', name: 'PK1 / ADC9 / PCINT17', physicalPin: 88, alt: 'ADC9, PCINT17', reg: 'DDRK1, PORTK1, PINK1', arduino: 'A9', desc: '10비트 ADC 9번 채널 아날로그 입력', category: 'analog' },
      { pin: 'PK2', name: 'PK2 / ADC10 / PCINT18', physicalPin: 87, alt: 'ADC10, PCINT18', reg: 'DDRK2, PORTK2, PINK2', arduino: 'A10', desc: '10비트 ADC 10번 채널 아날로그 입력', category: 'analog' },
      { pin: 'PK3', name: 'PK3 / ADC11 / PCINT19', physicalPin: 86, alt: 'ADC11, PCINT19', reg: 'DDRK3, PORTK3, PINK3', arduino: 'A11', desc: '10비트 ADC 11번 채널 아날로그 입력', category: 'analog' },
      { pin: 'PK4', name: 'PK4 / ADC12 / PCINT20', physicalPin: 85, alt: 'ADC12, PCINT20', reg: 'DDRK4, PORTK4, PINK4', arduino: 'A12', desc: '10비트 ADC 12번 채널 아날로그 입력', category: 'analog' },
      { pin: 'PK5', name: 'PK5 / ADC13 / PCINT21', physicalPin: 84, alt: 'ADC13, PCINT21', reg: 'DDRK5, PORTK5, PINK5', arduino: 'A13', desc: '10비트 ADC 13번 채널 아날로그 입력', category: 'analog' },
      { pin: 'PK6', name: 'PK6 / ADC14 / PCINT22', physicalPin: 83, alt: 'ADC14, PCINT22', reg: 'DDRK6, PORTK6, PINK6', arduino: 'A14', desc: '10비트 ADC 14번 채널 아날로그 입력', category: 'analog' },
      { pin: 'PK7', name: 'PK7 / ADC15 / PCINT23', physicalPin: 82, alt: 'ADC15, PCINT23', reg: 'DDRK7, PORTK7, PINK7', arduino: 'A15', desc: '10비트 ADC 15번 채널 아날로그 입력 (차동 측정 가능)', category: 'analog' },
    ]
  },
  PORTL: {
    name: 'PORT L',
    width: 8,
    desc: '16비트 Timer5 PWM (OC5A/B/C), Timer5 캡처 및 클럭 입력, 고밀도 디지털 I/O',
    registers: 'DDRL (0x10A), PORTL (0x10B), PINL (0x109)',
    pins: [
      { pin: 'PL0', name: 'PL0 / ICP4', physicalPin: 35, alt: 'ICP4 (Timer4 입력 캡처)', reg: 'DDRL0, PORTL0, PINL0', arduino: 'D49', desc: 'Timer4 정밀 주기/펄스폭 측정 입력', category: 'timer' },
      { pin: 'PL1', name: 'PL1 / ICP5', physicalPin: 36, alt: 'ICP5 (Timer5 입력 캡처)', reg: 'DDRL1, PORTL1, PINL1', arduino: 'D48', desc: 'Timer5 정밀 주기/펄스폭 측정 입력', category: 'timer' },
      { pin: 'PL2', name: 'PL2 / T5', physicalPin: 37, alt: 'T5 (Timer5 외부 카운터 클럭)', reg: 'DDRL2, PORTL2, PINL2', arduino: 'D47', desc: 'Timer5 외부 펄스 이벤트 카운터 입력', category: 'timer' },
      { pin: 'PL3', name: 'PL3 / OC5A', physicalPin: 38, alt: 'OC5A (Timer5 PWM A)', reg: 'DDRL3, PORTL3, PINL3', arduino: 'D46', desc: '16비트 Timer5 Compare A 고정밀 PWM 파형 출력', category: 'timer' },
      { pin: 'PL4', name: 'PL4 / OC5B', physicalPin: 39, alt: 'OC5B (Timer5 PWM B)', reg: 'DDRL4, PORTL4, PINL4', arduino: 'D45', desc: '16비트 Timer5 Compare B 고정밀 PWM 파형 출력', category: 'timer' },
      { pin: 'PL5', name: 'PL5 / OC5C', physicalPin: 40, alt: 'OC5C (Timer5 PWM C)', reg: 'DDRL5, PORTL5, PINL5', arduino: 'D44', desc: '16비트 Timer5 Compare C 고정밀 PWM 파형 출력', category: 'timer' },
      { pin: 'PL6', name: 'PL6', physicalPin: 41, alt: '범용 디지털 I/O 6', reg: 'DDRL6, PORTL6, PINL6', arduino: 'D43', desc: 'MegaCore 매핑 고속 디지털 I/O 핀', category: 'gpio' },
      { pin: 'PL7', name: 'PL7', physicalPin: 42, alt: '범용 디지털 I/O 7', reg: 'DDRL7, PORTL7, PINL7', arduino: 'D42', desc: 'MegaCore 매핑 고속 디지털 I/O 핀', category: 'gpio' },
    ]
  }
};

// -----------------------------------------------------------------
// 2. ATMEGA128 (64-pin TQFP, 53 I/O, Port A~G)
// -----------------------------------------------------------------
export const ATMEGA128_PORTS: Record<string, PortInfo> = {
  PORTA: {
    name: 'PORT A',
    width: 8,
    desc: '외부 메모리 주소/데이터 버스 하위 바이트 (AD0~AD7) 또는 양방향 I/O',
    registers: 'DDRA (0x1A), PORTA (0x1B), PINA (0x19)',
    pins: [
      { pin: 'PA0', name: 'PA0 / AD0', physicalPin: 51, alt: 'AD0 (외부 버스 비트 0)', reg: 'DDRA0, PORTA0, PINA0', arduino: 'D22', desc: '외부 SRAM/EEPROM 확장 하위 멀티플렉스 버스 0', category: 'memory' },
      { pin: 'PA1', name: 'PA1 / AD1', physicalPin: 50, alt: 'AD1 (외부 버스 비트 1)', reg: 'DDRA1, PORTA1, PINA1', arduino: 'D23', desc: '외부 SRAM 버스 비트 1', category: 'memory' },
      { pin: 'PA2', name: 'PA2 / AD2', physicalPin: 49, alt: 'AD2 (외부 버스 비트 2)', reg: 'DDRA2, PORTA2, PINA2', arduino: 'D24', desc: '외부 SRAM 버스 비트 2', category: 'memory' },
      { pin: 'PA3', name: 'PA3 / AD3', physicalPin: 48, alt: 'AD3 (외부 버스 비트 3)', reg: 'DDRA3, PORTA3, PINA3', arduino: 'D25', desc: '외부 SRAM 버스 비트 3', category: 'memory' },
      { pin: 'PA4', name: 'PA4 / AD4', physicalPin: 47, alt: 'AD4 (외부 버스 비트 4)', reg: 'DDRA4, PORTA4, PINA4', arduino: 'D26', desc: '외부 SRAM 버스 비트 4', category: 'memory' },
      { pin: 'PA5', name: 'PA5 / AD5', physicalPin: 46, alt: 'AD5 (외부 버스 비트 5)', reg: 'DDRA5, PORTA5, PINA5', arduino: 'D27', desc: '외부 SRAM 버스 비트 5', category: 'memory' },
      { pin: 'PA6', name: 'PA6 / AD6', physicalPin: 45, alt: 'AD6 (외부 버스 비트 6)', reg: 'DDRA6, PORTA6, PINA6', arduino: 'D28', desc: '외부 SRAM 버스 비트 6', category: 'memory' },
      { pin: 'PA7', name: 'PA7 / AD7', physicalPin: 44, alt: 'AD7 (외부 버스 비트 7)', reg: 'DDRA7, PORTA7, PINA7', arduino: 'D29', desc: '외부 SRAM 버스 비트 7', category: 'memory' },
    ]
  },
  PORTB: {
    name: 'PORT B',
    width: 8,
    desc: '하드웨어 SPI 버스(SS, SCK, MOSI, MISO) 및 Timer0/1/2 PWM 출력',
    registers: 'DDRB (0x17), PORTB (0x18), PINB (0x16)',
    pins: [
      { pin: 'PB0', name: 'PB0 / SS', physicalPin: 10, alt: 'SS (SPI Slave Select)', reg: 'DDRB0, PORTB0, PINB0', arduino: 'D0 (SPI)', desc: '하드웨어 SPI 슬레이브 선택 라인', category: 'comm' },
      { pin: 'PB1', name: 'PB1 / SCK', physicalPin: 11, alt: 'SCK (SPI Serial Clock)', reg: 'DDRB1, PORTB1, PINB1', arduino: 'D1 (SPI)', desc: 'SPI 직렬 클럭 신호 (ISP 프로그래밍 SCK)', category: 'comm' },
      { pin: 'PB2', name: 'PB2 / MOSI', physicalPin: 12, alt: 'MOSI (Master Out Slave In)', reg: 'DDRB2, PORTB2, PINB2', arduino: 'D2 (SPI)', desc: 'SPI 마스터 송신 데이터 (ISP MOSI)', category: 'comm' },
      { pin: 'PB3', name: 'PB3 / MISO', physicalPin: 13, alt: 'MISO (Master In Slave Out)', reg: 'DDRB3, PORTB3, PINB3', arduino: 'D3 (SPI)', desc: 'SPI 마스터 수신 데이터 (ISP MISO)', category: 'comm' },
      { pin: 'PB4', name: 'PB4 / OC0', physicalPin: 14, alt: 'OC0 (Timer0 비교 출력)', reg: 'DDRB4, PORTB4, PINB4', arduino: 'D4 (PWM)', desc: '8비트 Timer0 비교 출력 PWM 라인', category: 'timer' },
      { pin: 'PB5', name: 'PB5 / OC1A', physicalPin: 15, alt: 'OC1A (Timer1 Compare A)', reg: 'DDRB5, PORTB5, PINB5', arduino: 'D5 (PWM)', desc: '16비트 Timer1 Compare A 정밀 PWM 출력', category: 'timer' },
      { pin: 'PB6', name: 'PB6 / OC1B', physicalPin: 16, alt: 'OC1B (Timer1 Compare B)', reg: 'DDRB6, PORTB6, PINB6', arduino: 'D6 (PWM)', desc: '16비트 Timer1 Compare B 정밀 PWM 출력', category: 'timer' },
      { pin: 'PB7', name: 'PB7 / OC2 / OC1C', physicalPin: 17, alt: 'OC2, OC1C', reg: 'DDRB7, PORTB7, PINB7', arduino: 'D7 (PWM)', desc: 'Timer2 또는 Timer1 Compare C PWM 파형 출력', category: 'timer' },
    ]
  },
  PORTC: {
    name: 'PORT C',
    width: 8,
    desc: '외부 메모리 주소 버스 상위 바이트 (A8~A15) 또는 범용 I/O',
    registers: 'DDRC (0x14), PORTC (0x15), PINC (0x13)',
    pins: [
      { pin: 'PC0', name: 'PC0 / A8', physicalPin: 35, alt: 'A8 (외부 메모리 주소 8)', reg: 'DDRC0, PORTC0, PINC0', arduino: 'D37', desc: '외부 SRAM 상위 주소 버스 8', category: 'memory' },
      { pin: 'PC1', name: 'PC1 / A9', physicalPin: 36, alt: 'A9 (외부 메모리 주소 9)', reg: 'DDRC1, PORTC1, PINC1', arduino: 'D36', desc: '외부 SRAM 상위 주소 버스 9', category: 'memory' },
      { pin: 'PC2', name: 'PC2 / A10', physicalPin: 37, alt: 'A10 (외부 메모리 주소 10)', reg: 'DDRC2, PORTC2, PINC2', arduino: 'D35', desc: '외부 SRAM 상위 주소 버스 10', category: 'memory' },
      { pin: 'PC3', name: 'PC3 / A11', physicalPin: 38, alt: 'A11 (외부 메모리 주소 11)', reg: 'DDRC3, PORTC3, PINC3', arduino: 'D34', desc: '외부 SRAM 상위 주소 버스 11', category: 'memory' },
      { pin: 'PC4', name: 'PC4 / A12', physicalPin: 39, alt: 'A12 (외부 메모리 주소 12)', reg: 'DDRC4, PORTC4, PINC4', arduino: 'D33', desc: '외부 SRAM 상위 주소 버스 12', category: 'memory' },
      { pin: 'PC5', name: 'PC5 / A13', physicalPin: 40, alt: 'A13 (외부 메모리 주소 13)', reg: 'DDRC5, PORTC5, PINC5', arduino: 'D32', desc: '외부 SRAM 상위 주소 버스 13', category: 'memory' },
      { pin: 'PC6', name: 'PC6 / A14', physicalPin: 41, alt: 'A14 (외부 메모리 주소 14)', reg: 'DDRC6, PORTC6, PINC6', arduino: 'D31', desc: '외부 SRAM 상위 주소 버스 14', category: 'memory' },
      { pin: 'PC7', name: 'PC7 / A15', physicalPin: 42, alt: 'A15 (외부 메모리 주소 15)', reg: 'DDRC7, PORTC7, PINC7', arduino: 'D30', desc: '외부 SRAM 상위 주소 버스 15', category: 'memory' },
    ]
  },
  PORTD: {
    name: 'PORT D',
    width: 8,
    desc: '하드웨어 I2C (SCL/SDA), USART1 시리얼, 외부 인터럽트 INT0~INT3',
    registers: 'DDRD (0x11), PORTD (0x12), PIND (0x10)',
    pins: [
      { pin: 'PD0', name: 'PD0 / SCL / INT0', physicalPin: 25, alt: 'SCL (TWI 클럭), INT0', reg: 'DDRD0, PORTD0, PIND0', arduino: 'D21', desc: 'I2C 직렬 버스 클럭 및 하드웨어 인터럽트 0', category: 'comm' },
      { pin: 'PD1', name: 'PD1 / SDA / INT1', physicalPin: 26, alt: 'SDA (TWI 데이터), INT1', reg: 'DDRD1, PORTD1, PIND1', arduino: 'D20', desc: 'I2C 직렬 버스 데이터 및 하드웨어 인터럽트 1', category: 'comm' },
      { pin: 'PD2', name: 'PD2 / RXD1 / INT2', physicalPin: 27, alt: 'RXD1 (USART1 수신), INT2', reg: 'DDRD2, PORTD2, PIND2', arduino: 'D19', desc: 'USART1 시리얼 데이터 수신 및 외부 인터럽트 2', category: 'comm' },
      { pin: 'PD3', name: 'PD3 / TXD1 / INT3', physicalPin: 28, alt: 'TXD1 (USART1 송신), INT3', reg: 'DDRD3, PORTD3, PIND3', arduino: 'D18', desc: 'USART1 시리얼 데이터 송신 및 외부 인터럽트 3', category: 'comm' },
      { pin: 'PD4', name: 'PD4 / ICP1', physicalPin: 29, alt: 'ICP1 (Timer1 캡처)', reg: 'DDRD4, PORTD4, PIND4', arduino: 'D38', desc: '16비트 Timer1 입력 캡처 (주기 측정)', category: 'timer' },
      { pin: 'PD5', name: 'PD5 / XCK1', physicalPin: 30, alt: 'XCK1 (USART1 동기 클럭)', reg: 'DDRD5, PORTD5, PIND5', arduino: 'D39', desc: 'USART1 동기 모드 클럭 입출력', category: 'comm' },
      { pin: 'PD6', name: 'PD6 / T1', physicalPin: 31, alt: 'T1 (Timer1 외부 클럭)', reg: 'DDRD6, PORTD6, PIND6', arduino: 'D40', desc: 'Timer1 외부 카운터 펄스 입력', category: 'timer' },
      { pin: 'PD7', name: 'PD7 / T0', physicalPin: 32, alt: 'T0 (Timer0 외부 클럭)', reg: 'DDRD7, PORTD7, PIND7', arduino: 'D41', desc: 'Timer0 외부 카운터 펄스 입력', category: 'timer' },
    ]
  },
  PORTE: {
    name: 'PORT E',
    width: 8,
    desc: 'USART0 (기본 콘솔), Timer3 PWM (OC3A/B/C), 외부 인터럽트 INT4~INT7, 아날로그 비교기',
    registers: 'DDRE (0x02), PORTE (0x03), PINE (0x01)',
    pins: [
      { pin: 'PE0', name: 'PE0 / RXD0 / PDI', physicalPin: 2, alt: 'RXD0 (USART0 수신), ISP PDI', reg: 'DDRE0, PORTE0, PINE0', arduino: 'D0', desc: 'USART0 기본 수신 및 ATmega128 전용 ISP 프로그래밍 데이터 입력(PDI)', category: 'comm' },
      { pin: 'PE1', name: 'PE1 / TXD0 / PDO', physicalPin: 3, alt: 'TXD0 (USART0 송신), ISP PDO', reg: 'DDRE1, PORTE1, PINE1', arduino: 'D1', desc: 'USART0 기본 송신 및 ATmega128 전용 ISP 프로그래밍 데이터 출력(PDO)', category: 'comm' },
      { pin: 'PE2', name: 'PE2 / XCK0 / AIN0', physicalPin: 4, alt: 'XCK0, AIN0 (아날로그 비교기+)', reg: 'DDRE2, PORTE2, PINE2', arduino: 'D42', desc: 'USART0 동기 클럭 및 내장 아날로그 비교기 양의 입력', category: 'analog' },
      { pin: 'PE3', name: 'PE3 / OC3A / AIN1', physicalPin: 5, alt: 'OC3A (Timer3 PWM A), AIN1', reg: 'DDRE3, PORTE3, PINE3', arduino: 'D5', desc: '16비트 Timer3 Compare A 출력 및 비교기 음의 입력', category: 'timer' },
      { pin: 'PE4', name: 'PE4 / OC3B / INT4', physicalPin: 6, alt: 'OC3B (Timer3 PWM B), INT4', reg: 'DDRE4, PORTE4, PINE4', arduino: 'D2', desc: '16비트 Timer3 Compare B 출력 및 외부 인터럽트 4', category: 'timer' },
      { pin: 'PE5', name: 'PE5 / OC3C / INT5', physicalPin: 7, alt: 'OC3C (Timer3 PWM C), INT5', reg: 'DDRE5, PORTE5, PINE5', arduino: 'D3', desc: '16비트 Timer3 Compare C 출력 및 외부 인터럽트 5', category: 'timer' },
      { pin: 'PE6', name: 'PE6 / T3 / INT6', physicalPin: 8, alt: 'T3 (Timer3 클럭), INT6', reg: 'DDRE6, PORTE6, PINE6', arduino: 'D43', desc: 'Timer3 외부 카운터 클럭 및 외부 인터럽트 6', category: 'timer' },
      { pin: 'PE7', name: 'PE7 / ICP3 / INT7', physicalPin: 9, alt: 'ICP3 (Timer3 캡처), INT7', reg: 'DDRE7, PORTE7, PINE7', arduino: 'D44', desc: 'Timer3 입력 캡처 및 외부 인터럽트 7 (CLKOUT)', category: 'timer' },
    ]
  },
  PORTF: {
    name: 'PORT F',
    width: 8,
    desc: '10비트 8채널 ADC (ADC0~ADC7) 및 JTAG 테스트 포트',
    registers: 'DDRF (0x10), PORTF (0x11), PINF (0x0F)',
    pins: [
      { pin: 'PF0', name: 'PF0 / ADC0', physicalPin: 61, alt: 'ADC0 (아날로그 입력 0)', reg: 'DDRF0, PORTF0, PINF0', arduino: 'A0', desc: '10비트 ADC 단일 종단 입력 채널 0', category: 'analog' },
      { pin: 'PF1', name: 'PF1 / ADC1', physicalPin: 60, alt: 'ADC1 (아날로그 입력 1)', reg: 'DDRF1, PORTF1, PINF1', arduino: 'A1', desc: '10비트 ADC 단일 종단 입력 채널 1', category: 'analog' },
      { pin: 'PF2', name: 'PF2 / ADC2', physicalPin: 59, alt: 'ADC2 (아날로그 입력 2)', reg: 'DDRF2, PORTF2, PINF2', arduino: 'A2', desc: '10비트 ADC 단일 종단 입력 채널 2', category: 'analog' },
      { pin: 'PF3', name: 'PF3 / ADC3', physicalPin: 58, alt: 'ADC3 (아날로그 입력 3)', reg: 'DDRF3, PORTF3, PINF3', arduino: 'A3', desc: '10비트 ADC 단일 종단 입력 채널 3', category: 'analog' },
      { pin: 'PF4', name: 'PF4 / ADC4 / TCK', physicalPin: 57, alt: 'ADC4, JTAG TCK', reg: 'DDRF4, PORTF4, PINF4', arduino: 'A4', desc: '10비트 ADC 및 JTAG 테스트 클럭 핀', category: 'analog' },
      { pin: 'PF5', name: 'PF5 / ADC5 / TMS', physicalPin: 56, alt: 'ADC5, JTAG TMS', reg: 'DDRF5, PORTF5, PINF5', arduino: 'A5', desc: '10비트 ADC 및 JTAG 모드 선택 핀', category: 'analog' },
      { pin: 'PF6', name: 'PF6 / ADC6 / TDO', physicalPin: 55, alt: 'ADC6, JTAG TDO', reg: 'DDRF6, PORTF6, PINF6', arduino: 'A6', desc: '10비트 ADC 및 JTAG 데이터 출력 핀', category: 'analog' },
      { pin: 'PF7', name: 'PF7 / ADC7 / TDI', physicalPin: 54, alt: 'ADC7, JTAG TDI', reg: 'DDRF7, PORTF7, PINF7', arduino: 'A7', desc: '10비트 ADC 및 JTAG 데이터 입력 핀 (차동 입력)', category: 'analog' },
    ]
  },
  PORTG: {
    name: 'PORT G',
    width: 5,
    desc: '외부 메모리 스트로브 (WR, RD, ALE) 및 TOSC RTC 크리스탈 (5비트 포트 PG0~PG4)',
    registers: 'DDRG (0x07), PORTG (0x08), PING (0x06)',
    pins: [
      { pin: 'PG0', name: 'PG0 / WR', physicalPin: 33, alt: 'WR (외부 메모리 쓰기)', reg: 'DDRG0, PORTG0, PING0', arduino: 'D47', desc: '외부 SRAM 쓰기 인에이블 제어 신호', category: 'memory' },
      { pin: 'PG1', name: 'PG1 / RD', physicalPin: 34, alt: 'RD (외부 메모리 읽기)', reg: 'DDRG1, PORTG1, PING1', arduino: 'D48', desc: '외부 SRAM 읽기 인에이블 제어 신호', category: 'memory' },
      { pin: 'PG2', name: 'PG2 / ALE', physicalPin: 43, alt: 'ALE (Address Latch Enable)', reg: 'DDRG2, PORTG2, PING2', arduino: 'D49', desc: '외부 주소 버스 래치 스트로브 신호', category: 'memory' },
      { pin: 'PG3', name: 'PG3 / TOSC2', physicalPin: 18, alt: 'TOSC2 (RTC 크리스탈 2)', reg: 'DDRG3, PORTG3, PING3', arduino: 'D45', desc: '32.768kHz RTC 비동기 발진자 단자 2', category: 'system' },
      { pin: 'PG4', name: 'PG4 / TOSC1', physicalPin: 19, alt: 'TOSC1 (RTC 크리스탈 1)', reg: 'DDRG4, PORTG4, PING4', arduino: 'D46', desc: '32.768kHz RTC 비동기 발진자 단자 1', category: 'system' },
    ]
  }
};

// -----------------------------------------------------------------
// 3. ATMEGA328P (28-pin DIP / 32-pin TQFP, 23 I/O, Port B, C, D)
// -----------------------------------------------------------------
export const ATMEGA328P_PORTS: Record<string, PortInfo> = {
  PORTB: {
    name: 'PORT B',
    width: 6,
    desc: 'SPI 버스, Timer1 16비트 PWM (OC1A/B), Timer2 PWM (OC2A), 크리스탈 XTAL1/2 (PB6/7)',
    registers: 'DDRB (0x04), PORTB (0x05), PINB (0x03)',
    pins: [
      { pin: 'PB0', name: 'PB0 / ICP1 / PCINT0', physicalPin: 14, alt: 'ICP1 (Timer1 캡처), PCINT0', reg: 'DDRB0, PORTB0, PINB0', arduino: 'D8', desc: 'Timer1 입력 캡처 및 핀 체인지 인터럽트 0', category: 'timer' },
      { pin: 'PB1', name: 'PB1 / OC1A / PCINT1', physicalPin: 15, alt: 'OC1A (Timer1 PWM A), PCINT1', reg: 'DDRB1, PORTB1, PINB1', arduino: 'D9 (PWM)', desc: '16비트 Timer1 Compare A 정밀 PWM 출력', category: 'timer' },
      { pin: 'PB2', name: 'PB2 / SS / OC1B / PCINT2', physicalPin: 16, alt: 'SS (SPI Slave Select), OC1B', reg: 'DDRB2, PORTB2, PINB2', arduino: 'D10 (PWM)', desc: 'SPI 슬레이브 선택 라인 및 Timer1 PWM B 출력', category: 'comm' },
      { pin: 'PB3', name: 'PB3 / MOSI / OC2A / PCINT3', physicalPin: 17, alt: 'MOSI, OC2A (Timer2 PWM)', reg: 'DDRB3, PORTB3, PINB3', arduino: 'D11 (PWM)', desc: 'SPI 마스터 송신 데이터 라인 / Timer2 PWM 출력', category: 'comm' },
      { pin: 'PB4', name: 'PB4 / MISO / PCINT4', physicalPin: 18, alt: 'MISO, PCINT4', reg: 'DDRB4, PORTB4, PINB4', arduino: 'D12', desc: 'SPI 마스터 수신 데이터 라인', category: 'comm' },
      { pin: 'PB5', name: 'PB5 / SCK / PCINT5', physicalPin: 19, alt: 'SCK (SPI Clock), PCINT5', reg: 'DDRB5, PORTB5, PINB5', arduino: 'D13 (LED)', desc: 'SPI 직렬 클럭 신호 (아두이노 온보드 빌트인 LED 매핑)', category: 'comm' },
      { pin: 'PB6', name: 'PB6 / XTAL1 / PCINT6', physicalPin: 9, alt: 'XTAL1 (외부 오실레이터 입력)', reg: 'DDRB6, PORTB6, PINB6', arduino: 'XTAL1', desc: '외부 크리스탈 입력 또는 내부 RC 선택 시 일반 GPIO', category: 'system' },
      { pin: 'PB7', name: 'PB7 / XTAL2 / PCINT7', physicalPin: 10, alt: 'XTAL2 (외부 오실레이터 출력)', reg: 'DDRB7, PORTB7, PINB7', arduino: 'XTAL2', desc: '외부 크리스탈 출력 또는 내부 RC 선택 시 일반 GPIO', category: 'system' },
    ]
  },
  PORTC: {
    name: 'PORT C',
    width: 7,
    desc: '10비트 ADC (ADC0~ADC5), 하드웨어 I2C (SDA/SCL), 리셋 핀(PC6 / RESET)',
    registers: 'DDRC (0x07), PORTC (0x08), PINC (0x06)',
    pins: [
      { pin: 'PC0', name: 'PC0 / ADC0 / PCINT8', physicalPin: 23, alt: 'ADC0, PCINT8', reg: 'DDRC0, PORTC0, PINC0', arduino: 'A0', desc: '10비트 ADC 아날로그 입력 채널 0', category: 'analog' },
      { pin: 'PC1', name: 'PC1 / ADC1 / PCINT9', physicalPin: 24, alt: 'ADC1, PCINT9', reg: 'DDRC1, PORTC1, PINC1', arduino: 'A1', desc: '10비트 ADC 아날로그 입력 채널 1', category: 'analog' },
      { pin: 'PC2', name: 'PC2 / ADC2 / PCINT10', physicalPin: 25, alt: 'ADC2, PCINT10', reg: 'DDRC2, PORTC2, PINC2', arduino: 'A2', desc: '10비트 ADC 아날로그 입력 채널 2', category: 'analog' },
      { pin: 'PC3', name: 'PC3 / ADC3 / PCINT11', physicalPin: 26, alt: 'ADC3, PCINT11', reg: 'DDRC3, PORTC3, PINC3', arduino: 'A3', desc: '10비트 ADC 아날로그 입력 채널 3', category: 'analog' },
      { pin: 'PC4', name: 'PC4 / ADC4 / SDA / PCINT12', physicalPin: 27, alt: 'SDA (TWI/I2C 데이터), ADC4', reg: 'DDRC4, PORTC4, PINC4', arduino: 'A4 (SDA)', desc: '2선 직렬 I2C 데이터 라인 및 아날로그 4번', category: 'comm' },
      { pin: 'PC5', name: 'PC5 / ADC5 / SCL / PCINT13', physicalPin: 28, alt: 'SCL (TWI/I2C 클럭), ADC5', reg: 'DDRC5, PORTC5, PINC5', arduino: 'A5 (SCL)', desc: '2선 직렬 I2C 클럭 라인 및 아날로그 5번', category: 'comm' },
      { pin: 'PC6', name: 'PC6 / RESET / PCINT14', physicalPin: 1, alt: 'RESET (하드웨어 리셋 핀)', reg: 'DDRC6, PORTC6, PINC6', arduino: 'RESET', desc: 'Active Low 리셋 입력 (RSTDISBL 퓨즈 시에만 일반 GPIO 전환 가능)', category: 'system' },
    ]
  },
  PORTD: {
    name: 'PORT D',
    width: 8,
    desc: '하드웨어 USART (RXD/TXD), 외부 인터럽트 INT0/INT1, Timer0/2 PWM 출력 (OC0A/B, OC2B)',
    registers: 'DDRD (0x0A), PORTD (0x0B), PIND (0x09)',
    pins: [
      { pin: 'PD0', name: 'PD0 / RXD / PCINT16', physicalPin: 2, alt: 'RXD (USART 시리얼 수신)', reg: 'DDRD0, PORTD0, PIND0', arduino: 'D0 (RX)', desc: 'USART 기본 시리얼 데이터 수신 (부트로더 통신)', category: 'comm' },
      { pin: 'PD1', name: 'PD1 / TXD / PCINT17', physicalPin: 3, alt: 'TXD (USART 시리얼 송신)', reg: 'DDRD1, PORTD1, PIND1', arduino: 'D1 (TX)', desc: 'USART 기본 시리얼 데이터 송신 (디버깅 콘솔)', category: 'comm' },
      { pin: 'PD2', name: 'PD2 / INT0 / PCINT18', physicalPin: 4, alt: 'INT0 (하드웨어 외부 인터럽트 0)', reg: 'DDRD2, PORTD2, PIND2', arduino: 'D2', desc: '외부 비동기 엣지/레벨 인터럽트 0', category: 'interrupt' },
      { pin: 'PD3', name: 'PD3 / INT1 / OC2B / PCINT19', physicalPin: 5, alt: 'INT1, OC2B (Timer2 PWM B)', reg: 'DDRD3, PORTD3, PIND3', arduino: 'D3 (PWM)', desc: '외부 인터럽트 1 및 8비트 Timer2 PWM 출력', category: 'timer' },
      { pin: 'PD4', name: 'PD4 / T0 / XCK / PCINT20', physicalPin: 6, alt: 'T0 (Timer0 외부 클럭), XCK', reg: 'DDRD4, PORTD4, PIND4', arduino: 'D4', desc: 'Timer0 외부 카운터 클럭 및 USART 동기 클럭', category: 'timer' },
      { pin: 'PD5', name: 'PD5 / T1 / OC0B / PCINT21', physicalPin: 11, alt: 'T1 (Timer1 클럭), OC0B (Timer0 PWM)', reg: 'DDRD5, PORTD5, PIND5', arduino: 'D5 (PWM)', desc: 'Timer1 외부 클럭 입력 및 Timer0 PWM B 파형 출력', category: 'timer' },
      { pin: 'PD6', name: 'PD6 / AIN0 / OC0A / PCINT22', physicalPin: 12, alt: 'AIN0, OC0A (Timer0 PWM A)', reg: 'DDRD6, PORTD6, PIND6', arduino: 'D6 (PWM)', desc: 'Timer0 PWM A 출력 및 아날로그 비교기 + 입력', category: 'timer' },
      { pin: 'PD7', name: 'PD7 / AIN1 / PCINT23', physicalPin: 13, alt: 'AIN1 (아날로그 비교기 - 입력)', reg: 'DDRD7, PORTD7, PIND7', arduino: 'D7', desc: '내장 아날로그 비교기 음의 입력 및 핀 체인지 인터럽트 23', category: 'analog' },
    ]
  }
};

// -----------------------------------------------------------------
// MCU Profiles Summary Dictionary
// -----------------------------------------------------------------
export const MCU_PROFILES: Record<SupportedMCU, MCUProfile> = {
  atmega640: {
    id: 'atmega640',
    name: 'ATmega640',
    fullName: 'Microchip ATmega640 (100-pin TQFP/CBGA)',
    subtitle: '대규모 I/O(86핀) & 4개 USART를 갖춘 고효율 양산 최적화 8비트 RISC',
    package: '100-pin TQFP / CBGA',
    flash: 64,
    sram: 8,
    eeprom: 4,
    io: 86,
    usart: 4,
    pwm: 15,
    adc: 16,
    timers: '6개 (2x 8-bit, 4x 16-bit Timer 1/3/4/5)',
    maxFreq: '16 MHz (16 MIPS)',
    operatingVoltage: '1.8V ~ 5.5V',
    tag: '대형 I/O & 비용 절감',
    keyStrengths: [
      'ATmega2560과 동일한 100핀 물리 폼팩터 및 86 I/O, 4개 USART, 15 PWM 유지',
      'Flash 용량만 64KB로 슬림화하여 고가의 대용량 2560 대비 BOM 원가를 30~50% 절감',
      '외부 SRAM(XMEM) 최대 64KB 확장 지원으로 데이터 버퍼링 극대화'
    ],
    ports: ATMEGA640_PORTS
  },
  atmega128: {
    id: 'atmega128',
    name: 'ATmega128',
    fullName: 'Microchip ATmega128 / ATmega128A (64-pin TQFP)',
    subtitle: '산업용 임베디드 표준 & 대학 교육의 전설! 128KB Flash & 53 I/O',
    package: '64-pin TQFP / MLF',
    flash: 128,
    sram: 4,
    eeprom: 4,
    io: 53,
    usart: 2,
    pwm: 8,
    adc: 8,
    timers: '4개 (2x 8-bit Timer0/2, 2x 16-bit Timer1/3)',
    maxFreq: '16 MHz (ATmega128A 기준)',
    operatingVoltage: '2.7V ~ 5.5V (ATmega128A)',
    tag: '산업용 스테디셀러',
    keyStrengths: [
      '국내외 산업용 제어기, 로봇 공학, 학계에서 가장 널리 입증된 클래식 아키텍처',
      '128KB 넉넉한 플래시 메모리와 53개 물리 I/O 라인 (Port A~G)',
      '★ 주의: ISP 프로그래밍 시 PB1~PB3이 아닌 PE0(PDI) / PE1(PDO) 핀을 사용해야 함',
      '★ M103C 호환 퓨즈 비트 해제 필수 (기본 출고 시 ATmega103 호환 모드로 묶여 있음)'
    ],
    ports: ATMEGA128_PORTS
  },
  atmega328p: {
    id: 'atmega328p',
    name: 'ATmega328P',
    fullName: 'Microchip ATmega328P / ATmega328 (28-pin DIP / 32-pin TQFP)',
    subtitle: '전 세계 아두이노 우노(Uno) 표준 & 초소형 Pico-Power 임베디드 코어',
    package: '28-pin DIP / 32-pin TQFP',
    flash: 32,
    sram: 2,
    eeprom: 1,
    io: 23,
    usart: 1,
    pwm: 6,
    adc: 8,
    timers: '3개 (2x 8-bit Timer0/2, 1x 16-bit Timer1)',
    maxFreq: '20 MHz (20 MIPS)',
    operatingVoltage: '1.8V ~ 5.5V (PicoPower)',
    tag: '초소형 / 아두이노 우노 표준',
    keyStrengths: [
      '28핀 DIP 패키지로 브레드보드 및 시제품 즉시 개발 가능 (전 세계 최대 오픈소스 라이브러리)',
      '초저전력 PicoPower 기술 적용: Power-save 모드 0.75 µA',
      'Timer1(16비트)을 이용한 정밀 서보모터/초음파 센서 제어 표준 모델',
      'Optiboot 부트로더 탑재 시 단 512바이트만 점유 (31.5KB 앱 가용 공간)'
    ],
    ports: ATMEGA328P_PORTS
  },
  atmega2560: {
    id: 'atmega2560',
    name: 'ATmega2560',
    fullName: 'Microchip ATmega2560-16AU (100-pin TQFP / CBGA)',
    subtitle: '전 세계 아두이노 메가 2560 정품 표준! 256KB 대용량 플래시 & 86 I/O 플래그십',
    package: '100-pin TQFP (14x14mm) / 100-ball CBGA',
    flash: 256,
    sram: 8,
    eeprom: 4,
    io: 86,
    usart: 4,
    pwm: 16,
    adc: 16,
    timers: '6개 (2x 8-bit Timer0/2, 4x 16-bit Timer1/3/4/5)',
    maxFreq: '16 MHz (16 MIPS @ 5V)',
    operatingVoltage: '4.5V ~ 5.5V (16MHz), 1.8V ~ 5.5V (저전압)',
    tag: 'Arduino Mega 2560 플래그십',
    keyStrengths: [
      '256KB 초대형 플래시 메모리 (128K Words, 3바이트 PC 스택, EIND/RAMPZ/ELPM 지원)',
      '8KB SRAM & 4KB EEPROM 탑재로 FreeRTOS 실시간 OS, 3D 프린터(Marlin) 및 대용량 버퍼 운용 최적화',
      '4개 독립 하드웨어 고속 USART 채널 + 16채널 10-bit 고정밀 ADC 내장',
      '외부 메모리 인터페이스(XMEM) 지원으로 최대 64KB 외부 SRAM/주변기기 버스 직접 확장 가능'
    ],
    ports: ATMEGA640_PORTS // 100-pin TQFP pinout and ports are 100% pin-compatible with ATmega640/1280
  }
};
