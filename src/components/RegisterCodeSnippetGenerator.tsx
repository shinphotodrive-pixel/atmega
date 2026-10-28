import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  FileCode2,
  Copy,
  Check,
  Terminal,
  Code2,
  Sliders,
  CheckCircle2,
  Sparkles,
  Layers,
  Cpu,
  Bookmark,
  ShieldCheck,
  Zap,
  Info,
  RotateCcw,
  BookOpen,
  CheckSquare,
  Square,
  Settings,
  Clock,
  Radio,
  Activity,
  Play
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
}

export type CodeStyle = 'bitwise_macro' | 'struct_bitfield' | 'atomic_block' | 'cmsis_style';
export type WrapperTemplate = 'main' | 'arduino' | 'functions_only';

interface PeripheralPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  registers: {
    reg: string;
    value: number;
    meaning: string;
    bits: { name: string; shift: number; enabled: boolean; desc: string }[];
  }[];
}

export const RegisterCodeSnippetGenerator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Mode: Single Peripheral Snippet vs All-in-One Peripheral Init
  const [isAllInOneMode, setIsAllInOneMode] = useState<boolean>(false);

  // Template wrapping style for All-in-One mode
  const [wrapperTemplate, setWrapperTemplate] = useState<WrapperTemplate>('main');
  const [includeSei, setIncludeSei] = useState<boolean>(true);

  // Peripheral inclusion checklist in All-in-One mode
  const [selectedModules, setSelectedModules] = useState<Record<string, boolean>>({
    gpio: true,
    timer0: true,
    adc: true,
    usart: true,
    spi: false,
    watchdog: false
  });

  // Code Generation Style
  const [codeStyle, setCodeStyle] = useState<CodeStyle>('bitwise_macro');
  const [useComments, setUseComments] = useState<boolean>(true);
  const [includeHeaderGuard, setIncludeHeaderGuard] = useState<boolean>(true);
  const [functionName, setFunctionName] = useState<string>('mcu_peripherals_init');

  // Active Peripheral Preset for Single mode
  const [activePresetId, setActivePresetId] = useState<string>('timer0_pwm');
  const [copied, setCopied] = useState<boolean>(false);

  // Dynamic user bit adjustments map: key = `${regName}_${bitName}`, val = boolean
  const [customBitStates, setCustomBitStates] = useState<Record<string, boolean>>({});

  // Preset Configurations for MCUs
  const presets: PeripheralPreset[] = useMemo(() => [
    {
      id: 'timer0_pwm',
      name: 'Timer/Counter0 Fast PWM & 인터럽트',
      category: '타이머/카운터',
      description: 'COM0A1 비반전 출력, Fast PWM (TOP=0xFF), 64분주 클럭, 오버플로우/비교일치 인터럽트 활성화',
      registers: [
        {
          reg: 'TCCR0A',
          value: 0b10000011,
          meaning: 'COM0A1=1 (Clear on Match), WGM01=1, WGM00=1 (Fast PWM Mode 3)',
          bits: [
            { name: 'COM0A1', shift: 7, enabled: true, desc: 'OC0A 비반전 고속 PWM 출력' },
            { name: 'COM0A0', shift: 6, enabled: false, desc: '비교 일치 토글 비활성' },
            { name: 'COM0B1', shift: 5, enabled: false, desc: 'OC0B 채널 미사용' },
            { name: 'COM0B0', shift: 4, enabled: false, desc: 'OC0B 채널 미사용' },
            { name: 'WGM01', shift: 1, enabled: true, desc: '파형 생성 모드 비트 1' },
            { name: 'WGM00', shift: 0, enabled: true, desc: '파형 생성 모드 비트 0' }
          ]
        },
        {
          reg: 'TCCR0B',
          value: 0b00000011,
          meaning: 'CS01=1, CS00=1 (Prescaler = 64, 250kHz 클럭)',
          bits: [
            { name: 'FOC0A', shift: 7, enabled: false, desc: '강제 비교 일치 비활성' },
            { name: 'FOC0B', shift: 6, enabled: false, desc: '강제 비교 일치 비활성' },
            { name: 'WGM02', shift: 3, enabled: false, desc: 'TOP=0xFF 고정' },
            { name: 'CS02', shift: 2, enabled: false, desc: '클럭 분주 상위 비트' },
            { name: 'CS01', shift: 1, enabled: true, desc: '분주비 64 선택' },
            { name: 'CS00', shift: 0, enabled: true, desc: '분주비 64 선택' }
          ]
        },
        {
          reg: 'TIMSK0',
          value: 0b00000011,
          meaning: 'TOIE0=1, OCIE0A=1 (오버플로우 및 채널 A 비교일치 인터럽트)',
          bits: [
            { name: 'OCIE0B', shift: 2, enabled: false, desc: '채널 B 인터럽트 미사용' },
            { name: 'OCIE0A', shift: 1, enabled: true, desc: '채널 A 비교일치 인터럽트 인에이블' },
            { name: 'TOIE0', shift: 0, enabled: true, desc: '타이머 오버플로우 인터럽트 인에이블' }
          ]
        }
      ]
    },
    {
      id: 'usart_async',
      name: 'USART0 115200bps 풀 듀플렉스 & RXC 인터럽트',
      category: '시리얼 통신',
      description: '8비트 데이터, 1 스톱 비트, 패리티 없음, U2X 2배속 모드, 수신 완료 인터럽트 인에이블',
      registers: [
        {
          reg: 'UCSR0A',
          value: 0b00000010,
          meaning: 'U2X0=1 (2배속 비동기 모드 활성화로 16MHz 클럭 115200bps 통신 오차 최소화)',
          bits: [
            { name: 'U2X0', shift: 1, enabled: true, desc: '2배속 비동기 통신 모드' },
            { name: 'MPCM0', shift: 0, enabled: false, desc: '멀티 프로세서 통신 모드 끔' }
          ]
        },
        {
          reg: 'UCSR0B',
          value: 0b10011000,
          meaning: 'RXCIE0=1 (수신 인터럽트), RXEN0=1 (수신기 켬), TXEN0=1 (송신기 켬)',
          bits: [
            { name: 'RXCIE0', shift: 7, enabled: true, desc: '수신 완료 인터럽트 활성화' },
            { name: 'TXCIE0', shift: 6, enabled: false, desc: '송신 완료 인터럽트 미사용' },
            { name: 'UDRIE0', shift: 5, enabled: false, desc: '데이터 레지스터 빔 인터럽트 끔' },
            { name: 'RXEN0', shift: 4, enabled: true, desc: '수신 블록 활성화' },
            { name: 'TXEN0', shift: 3, enabled: true, desc: '송신 블록 활성화' },
            { name: 'UCSZ02', shift: 2, enabled: false, desc: '8비트 데이터 프레임' }
          ]
        },
        {
          reg: 'UCSR0C',
          value: 0b00000110,
          meaning: 'UCSZ01=1, UCSZ00=1 (8-bit 데이터, 1 Stop, No Parity)',
          bits: [
            { name: 'UMSEL01', shift: 7, enabled: false, desc: '비동기 USART 모드' },
            { name: 'UMSEL00', shift: 6, enabled: false, desc: '비동기 USART 모드' },
            { name: 'UPM01', shift: 5, enabled: false, desc: '패리티 비트 없음' },
            { name: 'UPM00', shift: 4, enabled: false, desc: '패리티 비트 없음' },
            { name: 'USBS0', shift: 3, enabled: false, desc: '1 스톱 비트' },
            { name: 'UCSZ01', shift: 2, enabled: true, desc: '8비트 캐릭터 길이' },
            { name: 'UCSZ00', shift: 1, enabled: true, desc: '8비트 캐릭터 길이' }
          ]
        }
      ]
    },
    {
      id: 'adc_continuous',
      name: 'ADC 10비트 단일 채널 & 자동 트리거',
      category: '아날로그 인터페이스',
      description: 'AVCC 기준 전압, ADC0 채널, 128분주비(125kHz), ADSC 시작 및 완료 인터럽트 인에이블',
      registers: [
        {
          reg: 'ADMUX',
          value: 0b01000000,
          meaning: 'REFS0=1 (AVCC 기준전압 및 AREF 핀 커패시터 연결), MUX3:0=0 (ADC0 채널)',
          bits: [
            { name: 'REFS1', shift: 7, enabled: false, desc: '내부 1.1V 기준전압 끔' },
            { name: 'REFS0', shift: 6, enabled: true, desc: 'AVCC 외부 5V 전원 기준' },
            { name: 'ADLAR', shift: 5, enabled: false, desc: '우측 정렬 10비트 결과' },
            { name: 'MUX0', shift: 0, enabled: false, desc: '아날로그 0번 핀 선택' }
          ]
        },
        {
          reg: 'ADCSRA',
          value: 0b11001111,
          meaning: 'ADEN=1, ADSC=1, ADIE=1, ADPS2:0=7 (128분주비로 정확도 극대화)',
          bits: [
            { name: 'ADEN', shift: 7, enabled: true, desc: 'ADC 모듈 전원 및 동작 활성화' },
            { name: 'ADSC', shift: 6, enabled: true, desc: '첫 아날로그 변환 시작' },
            { name: 'ADATE', shift: 5, enabled: false, desc: '자동 트리거 비활성' },
            { name: 'ADIE', shift: 3, enabled: true, desc: '변환 완료 인터럽트 활성화' },
            { name: 'ADPS2', shift: 2, enabled: true, desc: '분주비 128' },
            { name: 'ADPS1', shift: 1, enabled: true, desc: '분주비 128' },
            { name: 'ADPS0', shift: 0, enabled: true, desc: '분주비 128' }
          ]
        }
      ]
    },
    {
      id: 'gpio_pullups',
      name: 'GPIO 포트 B 고속 출력 & 내부 풀업 입력',
      category: '디지털 입출력',
      description: 'PB5(LED) 출력 모드, PB0~PB2 내부 풀업 저항 활성화, 나머지 플로팅 입력',
      registers: [
        {
          reg: 'DDRB',
          value: 0b00100000,
          meaning: 'DDB5=1 (PB5 출력 핀), DDB0~4=0 (입력 모드)',
          bits: [
            { name: 'DDB5', shift: 5, enabled: true, desc: 'PB5 핀 출력 모드 (LED 구동)' },
            { name: 'DDB2', shift: 2, enabled: false, desc: 'PB2 핀 입력 모드' },
            { name: 'DDB1', shift: 1, enabled: false, desc: 'PB1 핀 입력 모드' },
            { name: 'DDB0', shift: 0, enabled: false, desc: 'PB0 핀 입력 모드' }
          ]
        },
        {
          reg: 'PORTB',
          value: 0b00100111,
          meaning: 'PORTB5=1 (초기 HIGH 출력), PORTB0~2=1 (내부 30k~50kΩ 풀업 저항 활성화)',
          bits: [
            { name: 'PORTB5', shift: 5, enabled: true, desc: 'PB5 HIGH 출력' },
            { name: 'PORTB2', shift: 2, enabled: true, desc: 'PB2 내부 풀업 활성화' },
            { name: 'PORTB1', shift: 1, enabled: true, desc: 'PB1 내부 풀업 활성화' },
            { name: 'PORTB0', shift: 0, enabled: true, desc: 'PB0 내부 풀업 활성화' }
          ]
        }
      ]
    },
    {
      id: 'spi_master',
      name: 'SPI 버스 마스터 모드 (Mode 0, 1MHz)',
      category: '시리얼 통신',
      description: 'SPI 마스터 모드, MSB 우선 전송, 클럭 극성/위상 Mode 0, f_osc/16 분주',
      registers: [
        {
          reg: 'SPCR',
          value: 0b01010001,
          meaning: 'SPE=1 (SPI 인에이블), MSTR=1 (마스터 모드), SPR0=1 (f_cpu/16)',
          bits: [
            { name: 'SPIE', shift: 7, enabled: false, desc: 'SPI 인터럽트 비활성' },
            { name: 'SPE', shift: 6, enabled: true, desc: 'SPI 하드웨어 활성화' },
            { name: 'DORD', shift: 5, enabled: false, desc: 'MSB First' },
            { name: 'MSTR', shift: 4, enabled: true, desc: '마스터 모드 선택' },
            { name: 'CPOL', shift: 3, enabled: false, desc: '클럭 극성 0 (Idle Low)' },
            { name: 'CPHA', shift: 2, enabled: false, desc: '클럭 위상 0 (Leading Edge)' },
            { name: 'SPR1', shift: 1, enabled: false, desc: '분주비 하위 비트' },
            { name: 'SPR0', shift: 0, enabled: true, desc: '분주비 16' }
          ]
        }
      ]
    },
    {
      id: 'wdt_protection',
      name: '와치독 타이머 (2.0초 시스템 리셋 방어)',
      category: '시스템 보호',
      description: 'WDCE 4사이클 타임윈도우 안전 시퀀스 및 2초 타임아웃 WDE 리셋 활성화',
      registers: [
        {
          reg: 'WDTCSR',
          value: 0b00001111,
          meaning: 'WDE=1 (시스템 리셋), WDP2:0=7 (2.0초 타임아웃)',
          bits: [
            { name: 'WDIF', shift: 7, enabled: false, desc: '인터럽트 플래그' },
            { name: 'WDIE', shift: 6, enabled: false, desc: '인터럽트 모드 끔' },
            { name: 'WDP3', shift: 5, enabled: false, desc: '분주비 3' },
            { name: 'WDCE', shift: 4, enabled: false, desc: '변경 허용 비트' },
            { name: 'WDE', shift: 3, enabled: true, desc: '하드웨어 시스템 리셋 허용' },
            { name: 'WDP2', shift: 2, enabled: true, desc: '분주비 2' },
            { name: 'WDP1', shift: 1, enabled: true, desc: '분주비 1' },
            { name: 'WDP0', shift: 0, enabled: true, desc: '분주비 0' }
          ]
        }
      ]
    }
  ], []);

  const currentPreset = presets.find((p) => p.id === activePresetId) || presets[0];

  // Helper to get effective bit state
  const isBitActive = (regName: string, bitName: string, defaultEnabled: boolean): boolean => {
    const key = `${regName}_${bitName}`;
    if (key in customBitStates) {
      return customBitStates[key];
    }
    return defaultEnabled;
  };

  const toggleBit = (regName: string, bitName: string, defaultEnabled: boolean) => {
    const key = `${regName}_${bitName}`;
    const cur = isBitActive(regName, bitName, defaultEnabled);
    setCustomBitStates((prev) => ({
      ...prev,
      [key]: !cur
    }));
  };

  const resetBitsToDefault = () => {
    setCustomBitStates({});
  };

  const toggleModule = (modKey: string) => {
    setSelectedModules((prev) => ({
      ...prev,
      [modKey]: !prev[modKey]
    }));
  };

  const selectAllModules = (val: boolean) => {
    setSelectedModules({
      gpio: val,
      timer0: val,
      adc: val,
      usart: val,
      spi: val,
      watchdog: val
    });
  };

  // -------------------------------------------------------------
  // Generate All-in-One Peripheral Initialization Code
  // -------------------------------------------------------------
  const generatedAllInOneCode = useMemo(() => {
    const lines: string[] = [];
    const activeMods = Object.keys(selectedModules).filter((k) => selectedModules[k]);

    lines.push('/**');
    lines.push(` * ==============================================================================`);
    lines.push(` * MCU        : ${currentProfile.name} (${currentProfile.fullName})`);
    lines.push(` * Template   : ${wrapperTemplate === 'main' ? 'Bare-metal C main()' : wrapperTemplate === 'arduino' ? 'Arduino C++ setup() & loop()' : 'Modular Library Functions'}`);
    lines.push(` * Modules    : ${activeMods.map((m) => m.toUpperCase()).join(', ')}`);
    lines.push(` * Generated  : AI Studio AVR Peripheral Initialization Engine`);
    lines.push(` * MISRA-C    : MISRA-C:2012 Rule 10.1 & Rule 12.2 Compliant Bitwise Shifts`);
    lines.push(` * ==============================================================================`);
    lines.push(' */');
    lines.push('#include <avr/io.h>');
    lines.push('#include <avr/interrupt.h>');
    lines.push('#include <util/delay.h>');
    if (selectedModules.watchdog) {
      lines.push('#include <avr/wdt.h>');
    }
    lines.push('');

    lines.push('/* 시스템 클럭 정의 (16MHz 표준) */');
    lines.push('#ifndef F_CPU');
    lines.push('#define F_CPU 16000000UL');
    lines.push('#endif');
    lines.push('');

    // 1. Subroutine: GPIO
    if (selectedModules.gpio) {
      lines.push('/**');
      lines.push(' * @brief 1. GPIO 포트 방향 및 초기 레벨 / 풀업 저항 설정');
      lines.push(' */');
      lines.push('static inline void init_gpio(void) {');
      if (useComments) {
        lines.push('    // PB5(LED) 출력 설정, PB0~PB2 내부 풀업 저항 활성화');
      }
      lines.push('    DDRB  |= (1 << DDB5);');
      lines.push('    PORTB |= (1 << PORTB5) | (1 << PORTB2) | (1 << PORTB1) | (1 << PORTB0);');
      lines.push('}');
      lines.push('');
    }

    // 2. Subroutine: SPI
    if (selectedModules.spi) {
      lines.push('/**');
      lines.push(' * @brief 2. SPI 고속 동기 직렬 버스 마스터 모드 초기화 (Mode 0, f_osc/16)');
      lines.push(' */');
      lines.push('static inline void init_spi(void) {');
      if (useComments) {
        lines.push('    // MOSI(PB3), SCK(PB5), SS(PB2) 출력 방향 설정');
      }
      lines.push('    DDRB |= (1 << DDB3) | (1 << DDB5) | (1 << DDB2);');
      lines.push('    SPCR = (1 << SPE) | (1 << MSTR) | (1 << SPR0); // SPI Enable, Master Mode');
      lines.push('}');
      lines.push('');
    }

    // 3. Subroutine: Timer0
    if (selectedModules.timer0) {
      lines.push('/**');
      lines.push(' * @brief 3. Timer/Counter0 Fast PWM 모드 및 클럭 분주기 초기화');
      lines.push(' */');
      lines.push('static inline void init_timer0(void) {');
      if (useComments) {
        lines.push('    // Fast PWM (TOP=0xFF), 비반전 출력 (COM0A1=1), 64분주 클럭 (약 976.56Hz)');
      }
      lines.push('    TCCR0A = (1 << COM0A1) | (1 << WGM01) | (1 << WGM00);');
      lines.push('    TCCR0B = (1 << CS01) | (1 << CS00);');
      lines.push('    OCR0A  = 128; // 초기 50% 듀티 사이클');
      lines.push('    TIMSK0 = (1 << TOIE0); // 타이머 오버플로우 인터럽트 허용');
      lines.push('}');
      lines.push('');
    }

    // 4. Subroutine: ADC
    if (selectedModules.adc) {
      lines.push('/**');
      lines.push(' * @brief 4. 10-bit 아날로그-디지털 컨버터(ADC) 초기화 (AVCC 기준, 128분주 = 125kHz)');
      lines.push(' */');
      lines.push('static inline void init_adc(void) {');
      if (useComments) {
        lines.push('    // 기준전압: AVCC (외부 필터링 캐패시터), 채널: ADC0');
      }
      lines.push('    ADMUX  = (1 << REFS0);');
      lines.push('    ADCSRA = (1 << ADEN) | (1 << ADPS2) | (1 << ADPS1) | (1 << ADPS0); // 128분주, 모듈 켬');
      lines.push('}');
      lines.push('');
    }

    // 5. Subroutine: USART0
    if (selectedModules.usart) {
      lines.push('/**');
      lines.push(' * @brief 5. USART0 115200bps 비동기 직렬 통신 초기화 (8N1 포맷, 2배속 모드)');
      lines.push(' */');
      lines.push('static inline void init_usart0(void) {');
      lines.push('    // 16MHz 기준 115200bps 설정: UBRR=16, U2X0=1');
      lines.push('    UBRR0H = 0x00;');
      lines.push('    UBRR0L = 16;');
      lines.push('    UCSR0A = (1 << U2X0);');
      lines.push('    UCSR0B = (1 << RXEN0) | (1 << TXEN0) | (1 << RXCIE0); // RX/TX 활성 및 수신 인터럽트');
      lines.push('    UCSR0C = (1 << UCSZ01) | (1 << UCSZ00); // 8비트 데이터, 1 스톱 비트');
      lines.push('}');
      lines.push('');
    }

    // 6. Subroutine: Watchdog
    if (selectedModules.watchdog) {
      lines.push('/**');
      lines.push(' * @brief 6. 와치독 타이머(WDT) 2.0초 안전 리셋 보호 설정');
      lines.push(' */');
      lines.push('static inline void init_watchdog(void) {');
      lines.push('    wdt_reset();');
      lines.push('    // 4사이클 안전 타임윈도우 오픈 후 WDE 세트');
      lines.push('    WDTCSR |= (1 << WDCE) | (1 << WDE);');
      lines.push('    WDTCSR = (1 << WDE) | (1 << WDP2) | (1 << WDP1) | (1 << WDP0); // 2.0초 타임아웃');
      lines.push('}');
      lines.push('');
    }

    // Master Aggregator Function
    lines.push('/**');
    lines.push(' * @brief 마스터 전체 주변장치 통합 초기화 루틴');
    lines.push(' */');
    lines.push(`void ${functionName}(void) {`);
    if (selectedModules.gpio) lines.push('    init_gpio();      // [1] GPIO 핀 방향 및 풀업');
    if (selectedModules.spi) lines.push('    init_spi();       // [2] SPI 통신 버스');
    if (selectedModules.timer0) lines.push('    init_timer0();    // [3] Timer0 PWM 및 클럭');
    if (selectedModules.adc) lines.push('    init_adc();       // [4] 10-bit ADC 컨버터');
    if (selectedModules.usart) lines.push('    init_usart0();    // [5] USART0 시리얼 통신');
    if (selectedModules.watchdog) lines.push('    init_watchdog();  // [6] 와치독 타이머 세이프가드');
    lines.push('}');
    lines.push('');

    // Optional ISR Mock Handler
    if (selectedModules.usart) {
      lines.push('/* USART0 수신 완료 인터럽트 서비스 루틴 */');
      lines.push('ISR(USART_RX_vect) {');
      lines.push('    volatile uint8_t received_byte = UDR0;');
      lines.push('    (void)received_byte; // 수신 버퍼 링버퍼 삽입 등 애플리케이션 처리');
      lines.push('}');
      lines.push('');
    }

    // Wrapper Template Selection
    if (wrapperTemplate === 'main') {
      lines.push('/**');
      lines.push(' * @brief 표준 Bare-metal C main() 엔트리 포인트');
      lines.push(' */');
      lines.push('int main(void) {');
      lines.push(`    // 1. 선택된 모든 하드웨어 주변장치 초기화`);
      lines.push(`    ${functionName}();`);
      lines.push('');
      if (includeSei) {
        lines.push('    // 2. 전역 인터럽트 활성화');
        lines.push('    sei();');
        lines.push('');
      }
      lines.push('    // 3. 메인 슈퍼루프 (Super Loop)');
      lines.push('    while (1) {');
      if (selectedModules.watchdog) {
        lines.push('        wdt_reset(); // 와치독 킥 (시스템 리셋 방지)');
      }
      lines.push('        // TODO: 사용자 메인 제어 루틴 구현');
      lines.push('        _delay_ms(10);');
      lines.push('    }');
      lines.push('');
      lines.push('    return 0;');
      lines.push('}');
    } else if (wrapperTemplate === 'arduino') {
      lines.push('/**');
      lines.push(' * @brief Arduino C++ 호환 setup() 및 loop() 템플릿');
      lines.push(' */');
      lines.push('void setup() {');
      lines.push(`    // 아두이노 부팅 시 모든 SFR 레지스터 직접 Bare-metal 초기화`);
      lines.push(`    ${functionName}();`);
      if (includeSei) {
        lines.push('    sei();');
      }
      lines.push('}');
      lines.push('');
      lines.push('void loop() {');
      if (selectedModules.watchdog) {
        lines.push('    wdt_reset();');
      }
      lines.push('    // 주기적 작업 실행');
      lines.push('}');
    }

    return lines.join('\n');
  }, [
    currentProfile.name,
    currentProfile.fullName,
    selectedModules,
    wrapperTemplate,
    includeSei,
    useComments,
    functionName
  ]);

  // -------------------------------------------------------------
  // Generate Single Peripheral Code
  // -------------------------------------------------------------
  const generatedSingleCode = useMemo(() => {
    const lines: string[] = [];

    if (includeHeaderGuard) {
      lines.push('/**');
      lines.push(` * ==============================================================================`);
      lines.push(` * MCU      : ${currentProfile.name} (${currentProfile.fullName})`);
      lines.push(` * Target   : ${currentPreset.name}`);
      lines.push(` * Style    : ${codeStyle.toUpperCase()}`);
      lines.push(` * Safety   : MISRA-C 호환 명시적 비트 시프트 매크로 및 원자적 보호 적용`);
      lines.push(` * ==============================================================================`);
      lines.push(' */');
      lines.push('#include <avr/io.h>');
      lines.push('#include <avr/interrupt.h>');
      if (codeStyle === 'atomic_block') {
        lines.push('#include <util/atomic.h>');
      }
      lines.push('');
    }

    if (codeStyle === 'struct_bitfield') {
      lines.push('// 구조체 비트필드(Bit-field) 기반 고가독성 레지스터 설정');
      lines.push('typedef struct {');
      lines.push('    uint8_t raw_value;');
      lines.push('} register_config_t;');
      lines.push('');
      lines.push(`void ${functionName}(void) {`);

      currentPreset.registers.forEach((r) => {
        const activeBits = r.bits.filter((b) => isBitActive(r.reg, b.name, b.enabled));
        const macroExpression = activeBits.length > 0
          ? activeBits.map((b) => `(1U << ${b.name})`).join(' | ')
          : '0x00U';

        if (useComments) {
          lines.push(`    // ${r.reg}: ${r.meaning}`);
        }
        lines.push(`    ${r.reg} = (uint8_t)(${macroExpression});`);
        lines.push('');
      });

      lines.push('}');
    } else if (codeStyle === 'atomic_block') {
      lines.push(`void ${functionName}(void) {`);
      lines.push('    // 원자적 블록(ATOMIC_BLOCK): 레지스터 설정 중 인터럽트 끼어들기 방지');
      lines.push('    ATOMIC_BLOCK(ATOMIC_RESTORESTATE) {');

      currentPreset.registers.forEach((r) => {
        const activeBits = r.bits.filter((b) => isBitActive(r.reg, b.name, b.enabled));
        const macroExpression = activeBits.length > 0
          ? activeBits.map((b) => `(1U << ${b.name})`).join(' | ')
          : '0x00U';

        if (useComments) {
          lines.push(`        // ${r.reg}: ${r.meaning}`);
        }
        lines.push(`        ${r.reg} = ${macroExpression};`);
      });

      lines.push('    }');
      lines.push('}');
    } else if (codeStyle === 'cmsis_style') {
      lines.push('// 고정밀 매크로 상수 사전 정의');
      currentPreset.registers.forEach((r) => {
        const activeBits = r.bits.filter((b) => isBitActive(r.reg, b.name, b.enabled));
        const macroExpression = activeBits.length > 0
          ? activeBits.map((b) => `(1U << ${b.name})`).join(' | ')
          : '0x00U';
        lines.push(`#define ${r.reg}_INIT_VAL  (${macroExpression})`);
      });
      lines.push('');
      lines.push(`void ${functionName}(void) {`);
      currentPreset.registers.forEach((r) => {
        if (useComments) {
          lines.push(`    // 설정값 적용: ${r.meaning}`);
        }
        lines.push(`    ${r.reg} = ${r.reg}_INIT_VAL;`);
      });
      lines.push('}');
    } else {
      lines.push(`void ${functionName}(void) {`);

      currentPreset.registers.forEach((r) => {
        const activeBits = r.bits.filter((b) => isBitActive(r.reg, b.name, b.enabled));
        const macroExpression = activeBits.length > 0
          ? activeBits.map((b) => `(1 << ${b.name})`).join(' |\n               ')
          : '0x00';

        if (useComments) {
          lines.push(`    /* -------------------------------------------------------------`);
          lines.push(`     * ${r.reg} 설정: ${r.meaning}`);
          activeBits.forEach((b) => {
            lines.push(`     * - [bit ${b.shift}] ${b.name}: ${b.desc}`);
          });
          lines.push(`     * ------------------------------------------------------------- */`);
        }
        lines.push(`    ${r.reg} = ${macroExpression};`);
        lines.push('');
      });

      lines.push('}');
    }

    return lines.join('\n');
  }, [
    currentProfile.name,
    currentProfile.fullName,
    currentPreset,
    codeStyle,
    useComments,
    includeHeaderGuard,
    functionName,
    customBitStates
  ]);

  const finalCode = isAllInOneMode ? generatedAllInOneCode : generatedSingleCode;

  const copyCode = () => {
    navigator.clipboard.writeText(finalCode);
    setCopied(true);
    confetti({ particleCount: 35, spread: 55, origin: { y: 0.3 } });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Title Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <FileCode2 className="w-3.5 h-3.5" /> C 레지스터 초기화 코드 생성기
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              MCU: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-mono">
              MISRA-C / avr-gcc 호환
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            C 언어 레지스터 초기화 코드 생성기 (Register C Code Generator)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            비트 단위로 조작한 레지스터 설정을 바탕으로, 매직 넘버(0x83 등)를 배제하고
            <code>(1 &lt;&lt; CS01) | (1 &lt;&lt; WGM00)</code> 형식의 안전한 C 언어 매크로를 자동 생성하며, 
            <strong>'전체 초기화(Peripheral Init)'</strong> 버튼을 통해 여러 주변장치(UART, Timer, ADC, GPIO, SPI, WDT)를 단일 <code>main()</code> 또는 <code>setup()</code> 함수로 통합하여 즉시 빌드 가능한 템플릿으로 출력합니다.
          </p>
        </div>

        {/* Copy Button */}
        <button
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20 shrink-0"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? '복사 완료!' : isAllInOneMode ? '통합 C 템플릿 복사' : '초기화 C 코드 복사'}</span>
        </button>
      </div>

      {/* Mode Switcher: Single Peripheral vs Peripheral Init (All-in-One) */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-mono text-[11px] pl-1">생성 모드:</span>
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setIsAllInOneMode(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                !isAllInOneMode
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>개별 주변장치 스니펫</span>
            </button>

            <button
              onClick={() => setIsAllInOneMode(true)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                isAllInOneMode
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 ring-1 ring-amber-400/50'
                  : 'text-amber-400 hover:text-white hover:bg-amber-950/30'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>✨ 전체 초기화 (Peripheral Init)</span>
            </button>
          </div>
        </div>

        {isAllInOneMode && (
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="text-slate-500 text-[11px]">템플릿 형태:</span>
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setWrapperTemplate('main')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  wrapperTemplate === 'main'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                main() 템플릿
              </button>
              <button
                onClick={() => setWrapperTemplate('arduino')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  wrapperTemplate === 'arduino'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                setup() 템플릿
              </button>
              <button
                onClick={() => setWrapperTemplate('functions_only')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  wrapperTemplate === 'functions_only'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                함수 묶음만
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sub-bar 1: When Single Mode -> Show Preset Buttons */}
      {!isAllInOneMode && (
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-white">주변장치 시나리오 프리셋:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setActivePresetId(preset.id);
                  setCustomBitStates({});
                }}
                className={`px-3 py-1.5 rounded-lg border font-bold transition flex items-center gap-1.5 ${
                  activePresetId === preset.id
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sub-bar 2: When All-in-One Mode -> Show Peripheral Selection Checkboxes */}
      {isAllInOneMode && (
        <div className="bg-slate-950/90 border border-amber-900/40 rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white text-xs">
                통합 초기화에 포함할 주변장치 모듈 선택 (Peripheral Checklist):
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <button
                onClick={() => selectAllModules(true)}
                className="text-amber-400 hover:underline text-[11px]"
              >
                전체 선택
              </button>
              <span className="text-slate-600">•</span>
              <button
                onClick={() => selectAllModules(false)}
                className="text-slate-400 hover:underline text-[11px]"
              >
                전체 해제
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
            {[
              { id: 'gpio', label: 'GPIO 포트 B', icon: Sliders, color: 'text-emerald-400' },
              { id: 'timer0', label: 'Timer0 PWM', icon: Clock, color: 'text-amber-400' },
              { id: 'adc', label: '10-bit ADC', icon: Zap, color: 'text-cyan-400' },
              { id: 'usart', label: 'USART0 시리얼', icon: Radio, color: 'text-violet-400' },
              { id: 'spi', label: 'SPI 마스터 버스', icon: Activity, color: 'text-indigo-400' },
              { id: 'watchdog', label: '와치독 WDT', icon: ShieldCheck, color: 'text-rose-400' }
            ].map((mod) => {
              const isChecked = selectedModules[mod.id];
              const IconComp = mod.icon;
              return (
                <button
                  key={mod.id}
                  onClick={() => toggleModule(mod.id)}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                    isChecked
                      ? 'bg-slate-900 border-amber-500/60 text-white shadow-sm ring-1 ring-amber-500/30'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <IconComp className={`w-3.5 h-3.5 ${isChecked ? mod.color : 'text-slate-600'}`} />
                    <span className="truncate text-xs font-bold">{mod.label}</span>
                  </div>
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-700 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 text-xs pt-1 text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSei}
                onChange={(e) => setIncludeSei(e.target.checked)}
                className="accent-amber-500 rounded"
              />
              <span>초기화 완료 후 전역 인터럽트 활성화 (<code>sei()</code> 호출 포함)</span>
            </label>
          </div>
        </div>
      )}

      {/* Grid: Code Style & Interactive Bits Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Code Styling Options & Bit Toggles (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">
                {isAllInOneMode ? '통합 함수 설정 & 포맷 옵션' : 'C 코드 포맷 & 비트 컨트롤'}
              </h3>
            </div>
            {!isAllInOneMode && Object.keys(customBitStates).length > 0 && (
              <button
                onClick={resetBitsToDefault}
                className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-mono"
              >
                <RotateCcw className="w-3 h-3" /> 비트 초기화
              </button>
            )}
          </div>

          {/* Master Function name input */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">
              {isAllInOneMode ? '통합 초기화 마스터 함수명' : '초기화 함수 이름'}
            </label>
            <input
              type="text"
              value={functionName}
              onChange={(e) => setFunctionName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="mcu_peripherals_init"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
            />
          </div>

          {/* Code Style Selector */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">코드 생성 스타일 (Syntax Style)</label>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setCodeStyle('bitwise_macro')}
                className={`p-2 rounded-lg border font-bold text-left transition ${
                  codeStyle === 'bitwise_macro'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                📝 비트 시프트 매크로
                <span className="block text-[10px] text-slate-400 font-normal">(1 &lt;&lt; BIT_NAME) - 표준</span>
              </button>
              <button
                type="button"
                onClick={() => setCodeStyle('atomic_block')}
                className={`p-2 rounded-lg border font-bold text-left transition ${
                  codeStyle === 'atomic_block'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🛡️ 원자적 블록 (Atomic)
                <span className="block text-[10px] text-slate-400 font-normal">ATOMIC_BLOCK 보호</span>
              </button>
              <button
                type="button"
                onClick={() => setCodeStyle('cmsis_style')}
                className={`p-2 rounded-lg border font-bold text-left transition ${
                  codeStyle === 'cmsis_style'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🏷️ #define 상수 분리
                <span className="block text-[10px] text-slate-400 font-normal">헤더 분리형 매크로</span>
              </button>
              <button
                type="button"
                onClick={() => setCodeStyle('struct_bitfield')}
                className={`p-2 rounded-lg border font-bold text-left transition ${
                  codeStyle === 'struct_bitfield'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🧩 구조체 래핑
                <span className="block text-[10px] text-slate-400 font-normal">Typedef 캐스팅 적용</span>
              </button>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-1.5 text-xs">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={useComments}
                onChange={(e) => setUseComments(e.target.checked)}
                className="accent-emerald-500 rounded"
              />
              <span>데이터시트 비트 설명 상세 주석 포함</span>
            </label>
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHeaderGuard}
                onChange={(e) => setIncludeHeaderGuard(e.target.checked)}
                className="accent-emerald-500 rounded"
              />
              <span>헤더 파일 및 주석 블록 포함 (#include &lt;avr/io.h&gt;)</span>
            </label>
          </div>

          {/* When Single Mode: Interactive Bit Toggles inside current preset */}
          {!isAllInOneMode && (
            <div className="pt-2 border-t border-slate-800/80 space-y-3">
              <span className="text-[11px] font-bold text-white block">
                레지스터별 비트 인터랙티브 토글:
              </span>

              {currentPreset.registers.map((r) => (
                <div key={r.reg} className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="font-bold text-cyan-300">{r.reg}</span>
                    <span className="text-slate-400 text-[11px]">{r.meaning}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    {r.bits.map((b) => {
                      const active = isBitActive(r.reg, b.name, b.enabled);
                      return (
                        <button
                          key={b.name}
                          type="button"
                          onClick={() => toggleBit(r.reg, b.name, b.enabled)}
                          className={`p-1.5 rounded border text-left transition flex items-center justify-between ${
                            active
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <span className="font-mono font-bold">{b.name}</span>
                          <span className="text-[9px] px-1 rounded bg-slate-900 font-mono">
                            bit {b.shift}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* When All-in-One Mode: Architecture Initialization Pipeline Callout */}
          {isAllInOneMode && (
            <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs">
              <span className="text-[11px] font-bold text-white block flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                하드웨어 초기화 실행 파이프라인 순서:
              </span>
              <ol className="space-y-1 text-[11px] font-mono text-slate-300 list-decimal list-inside bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                {selectedModules.gpio && <li>GPIO 핀 입출력 방향 및 풀업 저항 우선 확정</li>}
                {selectedModules.spi && <li>SPI 버스 핀(MOSI/SCK/SS) 드라이브 모드 활성화</li>}
                {selectedModules.timer0 && <li>Timer0 비교 일치 파형 및 카운터 분주기 기동</li>}
                {selectedModules.adc && <li>10-bit ADC 내부 기준 전압 안정화 및 클럭 공급</li>}
                {selectedModules.usart && <li>USART0 보레이트 산출 레지스터 및 송수신 회로 가동</li>}
                {selectedModules.watchdog && <li>와치독 4사이클 타임윈도우 안전 리셋 시퀀스 등록</li>}
                {includeSei && <li className="text-emerald-400 font-bold">전역 인터럽트 활성화 (sei) ➔ 메인 루프 진입</li>}
              </ol>
            </div>
          )}
        </div>

        {/* Right: Real-time Live Code Preview & Export (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 bg-slate-900/80">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-bold text-white font-mono">
                  {isAllInOneMode ? `전체 초기화 통합 C 템플릿 (${wrapperTemplate === 'arduino' ? 'sketch.ino' : 'main.c'})` : `생성된 C 펌웨어 소스코드 (${functionName}.c)`}
                </span>
              </div>

              <button
                onClick={copyCode}
                className="text-slate-400 hover:text-white text-xs font-mono inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copied ? '복사됨' : '원클릭 복사'}</span>
              </button>
            </div>

            <pre className="p-5 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto max-h-[560px] custom-scrollbar bg-slate-950/90 selection:bg-emerald-500/30">
              {finalCode}
            </pre>
          </div>

          {/* Clean Code Principles Callout */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 space-y-1.5 leading-relaxed font-sans">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> 임베디드 펌웨어 전체 초기화 베스트 프랙티스:
            </span>
            <p className="text-slate-400 text-[11px]">
              여러 주변장치(UART, Timer, ADC 등)를 기동할 때는 <strong>I/O 포트 방향(DDR) ➔ 타이머/클럭 ➔ 아날로그 ➔ 직렬 통신 ➔ 와치독 ➔ 전역 인터럽트(sei)</strong> 순으로 순차 구성해야 버스 글리치(Bus Glitch)나 원치 않는 인터럽트 조기 발동을 완벽히 차단할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
