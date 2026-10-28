import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  FileCode2,
  Code2,
  Copy,
  Check,
  Download,
  Terminal,
  Sliders,
  Sparkles,
  Zap,
  CheckCircle2,
  Layers,
  Cpu,
  Clock,
  Radio,
  Activity,
  ShieldCheck,
  Play,
  RotateCcw,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type TemplateType = 'baremetal_c' | 'modern_cpp' | 'event_driven' | 'arduino_compat';

export const CodeTemplateGenerator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // 1. Template Type
  const [templateType, setTemplateType] = useState<TemplateType>('baremetal_c');

  // 2. System Clock
  const [clockFreqHz, setClockFreqHz] = useState<number>(16000000);

  // 3. Module Inclusions & Register Configurations
  // GPIO
  const [enableGpio, setEnableGpio] = useState<boolean>(true);
  const [ledPinMode, setLedPinMode] = useState<'output_toggle' | 'output_fixed'>('output_toggle');
  const [buttonPullup, setButtonPullup] = useState<boolean>(true);

  // Timer
  const [enableTimer, setEnableTimer] = useState<boolean>(true);
  const [timerMode, setTimerMode] = useState<'ctc_1ms' | 'fast_pwm_1khz' | 'ovf_tick'>('ctc_1ms');
  const [timerDutyPercent, setTimerDutyPercent] = useState<number>(50);

  // Interrupts
  const [enableExtInt, setEnableExtInt] = useState<boolean>(true);
  const [extIntSense, setExtIntSense] = useState<'falling' | 'rising' | 'change' | 'low'>('falling');
  const [enableGlobalInterrupt, setEnableGlobalInterrupt] = useState<boolean>(true);

  // USART
  const [enableUsart, setEnableUsart] = useState<boolean>(true);
  const [usartBaud, setUsartBaud] = useState<number>(115200);
  const [usartRxInterrupt, setUsartRxInterrupt] = useState<boolean>(true);

  // ADC
  const [enableAdc, setEnableAdc] = useState<boolean>(false);
  const [adcChannel, setAdcChannel] = useState<number>(0);
  const [adcAutoSample, setAdcAutoSample] = useState<boolean>(false);

  // Watchdog
  const [enableWdt, setEnableWdt] = useState<boolean>(false);
  const [wdtPeriod, setWdtPeriod] = useState<'1S' | '2S' | '500MS'>('1S');

  // Copy state
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Helper MCU Specific Pins & Registers
  const mcuSpecifics = useMemo(() => {
    const is328p = selectedMCU === 'atmega328p';
    const is128 = selectedMCU === 'atmega128';
    const is2560 = selectedMCU === 'atmega2560';
    const is640 = selectedMCU === 'atmega640';

    return {
      ledPort: is328p ? 'PORTB' : is128 ? 'PORTB' : 'PORTB',
      ledDdr: is328p ? 'DDRB' : is128 ? 'DDRB' : 'DDRB',
      ledPin: is328p ? 'PB5' : is128 ? 'PB4' : 'PB7',
      ledPinIdx: is328p ? 5 : is128 ? 4 : 7,
      buttonPort: is328p ? 'PORTD' : is128 ? 'PORTD' : 'PORTD',
      buttonDdr: is328p ? 'DDRD' : is128 ? 'DDRD' : 'DDRD',
      buttonPin: is328p ? 'PIND' : is128 ? 'PIND' : 'PIND',
      buttonBit: is328p ? 'PD2' : is128 ? 'PD0' : 'PD0',
      buttonBitIdx: is328p ? 2 : 0,
      intVector: is328p ? 'INT0_vect' : 'INT0_vect',
      timer1CompVect: 'TIMER1_COMPA_vect',
      timer0OvfVect: 'TIMER0_OVF_vect',
      usartRxVect: is128 ? 'USART0_RX_vect' : 'USART_RX_vect',
      udrReg: is128 ? 'UDR0' : 'UDR0',
      ubrrReg: is128 ? 'UBRR0' : 'UBRR0',
      ubrrhReg: is128 ? 'UBRR0H' : 'UBRR0H',
      ubrrlReg: is128 ? 'UBRR0L' : 'UBRR0L',
      ucsrAReg: is128 ? 'UCSR0A' : 'UCSR0A',
      ucsrBReg: is128 ? 'UCSR0B' : 'UCSR0B',
      ucsrCReg: is128 ? 'UCSR0C' : 'UCSR0C',
      u2xBit: is128 ? 'U2X0' : 'U2X0',
      rxenBit: is128 ? 'RXEN0' : 'RXEN0',
      txenBit: is128 ? 'TXEN0' : 'TXEN0',
      rxcieBit: is128 ? 'RXCIE0' : 'RXCIE0',
      eicraReg: is128 ? 'EICRA' : 'EICRA',
      eimskReg: is128 ? 'EIMSK' : 'EIMSK',
      timer0Reg: is128 ? 'TCCR0' : 'TCCR0A',
    };
  }, [selectedMCU]);

  // Math Calculations for Registers
  // 1. USART Baud Rate Calculation
  const ubrrVal = Math.max(0, Math.round(clockFreqHz / (16 * usartBaud) - 1));

  // 2. Timer1 CTC 1ms Calculation: F_CPU / (64 * 1000) - 1
  const timer1Top1ms = Math.max(1, Math.min(65535, Math.round(clockFreqHz / (64 * 1000) - 1)));
  const timer1PwmOcr = Math.round((20000 - 1) * (timerDutyPercent / 100)); // for 50Hz/1kHz

  // 3. Ext Int Sense Bits (ISC01, ISC00)
  const extIntBits = useMemo(() => {
    switch (extIntSense) {
      case 'falling':
        return '(1 << ISC01)';
      case 'rising':
        return '(1 << ISC01) | (1 << ISC00)';
      case 'change':
        return '(1 << ISC00)';
      case 'low':
      default:
        return '0';
    }
  }, [extIntSense]);

  // Real-time Register Preview List
  const registerPreview = useMemo(() => {
    const list: { reg: string; hex: string; bin: string; note: string }[] = [];

    if (enableGpio) {
      const ddrVal = 1 << mcuSpecifics.ledPinIdx;
      const portVal = buttonPullup ? 1 << mcuSpecifics.buttonBitIdx : 0;
      list.push({
        reg: mcuSpecifics.ledDdr,
        hex: `0x${ddrVal.toString(16).toUpperCase().padStart(2, '0')}`,
        bin: `0b${ddrVal.toString(2).padStart(8, '0')}`,
        note: `${mcuSpecifics.ledPin} 출력 설정`,
      });
      list.push({
        reg: mcuSpecifics.buttonPort,
        hex: `0x${portVal.toString(16).toUpperCase().padStart(2, '0')}`,
        bin: `0b${portVal.toString(2).padStart(8, '0')}`,
        note: buttonPullup ? `${mcuSpecifics.buttonBit} 풀업 활성화` : '기본 상태',
      });
    }

    if (enableTimer) {
      if (timerMode === 'ctc_1ms') {
        list.push({
          reg: 'TCCR1B',
          hex: '0x0B',
          bin: '0b00001011',
          note: 'CTC 모드(WGM12=1), 분주비 64(CS11:10=3)',
        });
        list.push({
          reg: 'OCR1A',
          hex: `0x${timer1Top1ms.toString(16).toUpperCase().padStart(4, '0')}`,
          bin: `${timer1Top1ms}d`,
          note: `1ms 주기 일치 카운트값`,
        });
        list.push({
          reg: 'TIMSK1',
          hex: '0x02',
          bin: '0b00000010',
          note: 'OCIE1A 비교일치 인터럽트 인에이블',
        });
      } else if (timerMode === 'fast_pwm_1khz') {
        list.push({
          reg: 'TCCR1A',
          hex: '0x82',
          bin: '0b10000010',
          note: 'Fast PWM Mode 14 (ICR1 TOP, COM1A1 비반전)',
        });
        list.push({
          reg: 'TCCR1B',
          hex: '0x1A',
          bin: '0b00011010',
          note: 'WGM13:12=3, 분주비 8(CS11=1)',
        });
      }
    }

    if (enableExtInt) {
      list.push({
        reg: mcuSpecifics.eicraReg,
        hex: extIntSense === 'falling' ? '0x02' : extIntSense === 'rising' ? '0x03' : '0x01',
        bin: extIntBits,
        note: `INT0 ${extIntSense.toUpperCase()} 에지 트리거`,
      });
      list.push({
        reg: mcuSpecifics.eimskReg,
        hex: '0x01',
        bin: '0b00000001',
        note: 'INT0 인터럽트 허용',
      });
    }

    if (enableUsart) {
      list.push({
        reg: mcuSpecifics.ubrrReg,
        hex: `0x${ubrrVal.toString(16).toUpperCase().padStart(4, '0')}`,
        bin: `${ubrrVal}d`,
        note: `${usartBaud} bps 분주비`,
      });
      list.push({
        reg: mcuSpecifics.ucsrBReg,
        hex: usartRxInterrupt ? '0x98' : '0x18',
        bin: usartRxInterrupt ? '0b10011000' : '0b00011000',
        note: usartRxInterrupt ? 'RXEN, TXEN, RXCIE 인터럽트' : 'RXEN, TXEN 폴링',
      });
    }

    return list;
  }, [
    enableGpio,
    enableTimer,
    enableExtInt,
    enableUsart,
    timerMode,
    timer1Top1ms,
    buttonPullup,
    extIntSense,
    extIntBits,
    usartBaud,
    usartRxInterrupt,
    ubrrVal,
    mcuSpecifics,
  ]);

  // Code Generation Engine
  const generatedSourceCode = useMemo(() => {
    const fCpuDef = `#define F_CPU ${clockFreqHz}UL`;

    // 1. Baremetal C Template
    if (templateType === 'baremetal_c') {
      return `/**
 * ==============================================================================
 * @file    main.c
 * @brief   ${currentProfile.fullName} 표준 베어메탈 펌웨어 템플릿
 * @target  ${currentProfile.name} (${currentProfile.package})
 * @freq    ${(clockFreqHz / 1e6).toFixed(1)} MHz
 * @author  AI Studio AVR Firmware Architect
 * ==============================================================================
 */

${fCpuDef}

#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/delay.h>
#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
${enableWdt ? '#include <avr/wdt.h>\n' : ''}
// -----------------------------------------------------------------------------
// 전역 플래그 및 공유 변수 (인터럽트 안전 volatile)
// -----------------------------------------------------------------------------
${enableTimer ? 'volatile uint32_t g_system_tick_ms = 0;\n' : ''}${
        enableExtInt ? 'volatile bool g_button_pressed = false;\n' : ''
      }${enableUsart && usartRxInterrupt ? 'volatile char g_rx_last_byte = 0;\nvolatile bool g_rx_received = false;\n' : ''}
// -----------------------------------------------------------------------------
// 주변장치 인터럽트 서비스 루틴 (ISRs)
// -----------------------------------------------------------------------------
${
  enableTimer && timerMode === 'ctc_1ms'
    ? `ISR(${mcuSpecifics.timer1CompVect}) {
    // 1ms 주기 타이머 틱 인터럽트
    g_system_tick_ms++;
}
`
    : ''
}${
        enableExtInt
          ? `ISR(${mcuSpecifics.intVector}) {
    // 외부 인터럽트 INT0 트리거 (${extIntSense} 에지)
    g_button_pressed = true;
    ${enableGpio ? `${mcuSpecifics.ledPort} ^= (1 << ${mcuSpecifics.ledPin}); // LED 토글 반응` : ''}
}
`
          : ''
      }${
        enableUsart && usartRxInterrupt
          ? `ISR(${mcuSpecifics.usartRxVect}) {
    // USART0 수신 완료 인터럽트
    g_rx_last_byte = ${mcuSpecifics.udrReg};
    g_rx_received = true;
}
`
          : ''
      }
// -----------------------------------------------------------------------------
// 하드웨어 레지스터 초기화 함수
// -----------------------------------------------------------------------------
static void init_system_peripherals(void) {
${
  enableGpio
    ? `    // 1. GPIO 포트 방향 및 초기 레벨 설정
    ${mcuSpecifics.ledDdr} |= (1 << ${mcuSpecifics.ledPin});   // ${mcuSpecifics.ledPin} 출력(LED)
    ${mcuSpecifics.buttonDdr} &= ~(1 << ${mcuSpecifics.buttonBit}); // ${mcuSpecifics.buttonBit} 입력(버튼)
    ${buttonPullup ? `${mcuSpecifics.buttonPort} |= (1 << ${mcuSpecifics.buttonBit});  // 내부 풀업 저항 활성화\n` : ''}`
    : ''
}${
        enableTimer
          ? `
    // 2. 타이머/카운터 1 설정 (${timerMode === 'ctc_1ms' ? '1ms CTC 모드' : 'Fast PWM 모드'})
${
  timerMode === 'ctc_1ms'
    ? `    TCCR1A = 0x00;                                   // CTC 모드
    TCCR1B = (1 << WGM12) | (1 << CS11) | (1 << CS10); // WGM12 CTC, 분주비 64
    OCR1A  = ${timer1Top1ms};                                  // 1ms 일치값 (F_CPU / (64 * 1000) - 1)
    TIMSK1 |= (1 << OCIE1A);                            // Timer1 비교 일치 인터럽트 활성화`
    : `    TCCR1A = (1 << COM1A1) | (1 << WGM11);          // Fast PWM Mode 14 (비반전)
    TCCR1B = (1 << WGM13) | (1 << WGM12) | (1 << CS11); // 분주비 8
    ICR1   = 19999;                                  // TOP (20ms 주기)
    OCR1A  = ${timer1PwmOcr};                                  // 듀티 사이클 (${timerDutyPercent}%)`
}
`
          : ''
      }${
        enableExtInt
          ? `
    // 3. 외부 인터럽트 (INT0) 트리거 조건 설정
    ${mcuSpecifics.eicraReg} |= ${extIntBits}; // ${extIntSense} 에지 감지
    ${mcuSpecifics.eimskReg} |= (1 << INT0);                  // INT0 인에이블
`
          : ''
      }${
        enableUsart
          ? `
    // 4. USART0 직렬 통신 (${usartBaud} bps, 8N1)
    ${mcuSpecifics.ubrrhReg} = (uint8_t)(${ubrrVal} >> 8);
    ${mcuSpecifics.ubrrlReg} = (uint8_t)(${ubrrVal});
    ${mcuSpecifics.ucsrBReg} = (1 << ${mcuSpecifics.rxenBit}) | (1 << ${mcuSpecifics.txenBit})${usartRxInterrupt ? ` | (1 << ${mcuSpecifics.rxcieBit})` : ''};
    ${mcuSpecifics.ucsrCReg} = (1 << UCSZ01) | (1 << UCSZ00); // 8비트 데이터, 패리티 없음, 1스톱 비트
`
          : ''
      }${
        enableAdc
          ? `
    // 5. ADC (10-bit 아날로그 컨버터)
    ADMUX  = (1 << REFS0) | (${adcChannel} & 0x07); // AVCC 기준전압, 채널 ${adcChannel}
    ADCSRA = (1 << ADEN) | (1 << ADPS2) | (1 << ADPS1) | (1 << ADPS0); // ADC 활성화, 분주비 128
`
          : ''
      }${
        enableWdt
          ? `
    // 6. 워치독 타이머 (${wdtPeriod})
    wdt_enable(WDTO_${wdtPeriod});
`
          : ''
      }${
        enableGlobalInterrupt
          ? `
    // 전역 인터럽트 활성화
    sei();
`
          : ''
      }}

${
  enableUsart
    ? `// -----------------------------------------------------------------------------
// USART 문자 송신 유틸리티
// -----------------------------------------------------------------------------
static void usart_putchar(char c) {
    while (!(${mcuSpecifics.ucsrAReg} & (1 << UDRE0))); // 버퍼 빌 때까지 대기
    ${mcuSpecifics.udrReg} = c;
}

static void usart_puts(const char *str) {
    while (*str) {
        usart_putchar(*str++);
    }
}
`
    : ''
}
// -----------------------------------------------------------------------------
// 메인 엔트리 포인트 (Super-loop Architecture)
// -----------------------------------------------------------------------------
int main(void) {
    // 1. MCU 하드웨어 레지스터 일괄 초기화
    init_system_peripherals();

    ${
      enableUsart
        ? `usart_puts("\\r\\n=== [${currentProfile.name}] System Boot Complete ===\\r\\n");`
        : ''
    }

    uint32_t last_heartbeat = 0;

    // 2. 메인 무한 루프
    while (1) {
        ${enableWdt ? 'wdt_reset(); // 워치독 타이머 주기적 리셋' : ''}
${
  enableTimer
    ? `        // 500ms 주기 하트비트 LED 점멸
        if (g_system_tick_ms - last_heartbeat >= 500) {
            last_heartbeat = g_system_tick_ms;
            ${enableGpio ? `${mcuSpecifics.ledPort} ^= (1 << ${mcuSpecifics.ledPin});` : ''}
            ${enableUsart ? `usart_puts("[Tick] 500ms Heartbeat OK\\r\\n");` : ''}
        }`
    : `        // 일반 딜레이 기반 루프
        ${enableGpio ? `${mcuSpecifics.ledPort} ^= (1 << ${mcuSpecifics.ledPin});\n        _delay_ms(500);` : ''}`
}

${
  enableExtInt
    ? `        // 버튼 인터럽트 이벤트 핸들링
        if (g_button_pressed) {
            g_button_pressed = false;
            ${enableUsart ? `usart_puts("[Event] External Button INT0 Fired!\\r\\n");` : ''}
        }`
    : ''
}

${
  enableUsart && usartRxInterrupt
    ? `        // USART 수신 데이터 에코
        if (g_rx_received) {
            g_rx_received = false;
            usart_puts("Echo: ");
            usart_putchar(g_rx_last_byte);
            usart_puts("\\r\\n");
        }`
    : ''
}
    }

    return 0;
}
`;
    }

    // 2. Modern C++ Template
    if (templateType === 'modern_cpp') {
      return `/**
 * ==============================================================================
 * @file    main.cpp
 * @brief   ${currentProfile.fullName} Modern C++ Object-Oriented Firmware
 * @target  ${currentProfile.name}
 * ==============================================================================
 */

${fCpuDef}

#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/delay.h>
#include <stdint.h>

namespace mcu {

class HardwareSystem {
public:
    static void init() {
        // GPIO Configuration
        ${mcuSpecifics.ledDdr} |= (1 << ${mcuSpecifics.ledPin});
        ${mcuSpecifics.buttonDdr} &= ~(1 << ${mcuSpecifics.buttonBit});
        ${mcuSpecifics.buttonPort} |= (1 << ${mcuSpecifics.buttonBit});

        ${
          enableTimer
            ? `// Timer1 Setup (1ms Tick)
        TCCR1B = (1 << WGM12) | (1 << CS11) | (1 << CS10);
        OCR1A  = ${timer1Top1ms};
        TIMSK1 |= (1 << OCIE1A);`
            : ''
        }

        ${
          enableUsart
            ? `// Serial Configuration (${usartBaud} bps)
        ${mcuSpecifics.ubrrhReg} = static_cast<uint8_t>(${ubrrVal} >> 8);
        ${mcuSpecifics.ubrrlReg} = static_cast<uint8_t>(${ubrrVal});
        ${mcuSpecifics.ucsrBReg} = (1 << ${mcuSpecifics.rxenBit}) | (1 << ${mcuSpecifics.txenBit});`
            : ''
        }

        sei();
    }

    static inline void toggleLed() {
        ${mcuSpecifics.ledPort} ^= (1 << ${mcuSpecifics.ledPin});
    }

    static inline bool isButtonPressed() {
        return !(${mcuSpecifics.buttonPin} & (1 << ${mcuSpecifics.buttonBit}));
    }
};

} // namespace mcu

int main() {
    mcu::HardwareSystem::init();

    while (true) {
        mcu::HardwareSystem::toggleLed();
        _delay_ms(500);
    }
    return 0;
}
`;
    }

    // 3. Event-Driven Template
    if (templateType === 'event_driven') {
      return `/**
 * ==============================================================================
 * @file    event_loop.c
 * @brief   ${currentProfile.fullName} 비동기 이벤트 루프 템플릿
 * @target  ${currentProfile.name}
 * ==============================================================================
 */

${fCpuDef}

#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/sleep.h>
#include <stdint.h>
#include <stdbool.h>

typedef enum {
    EVENT_NONE        = 0,
    EVENT_TICK_1MS    = (1 << 0),
    EVENT_BUTTON_EDGE = (1 << 1),
    EVENT_UART_RX     = (1 << 2)
} SystemEvent_t;

static volatile uint8_t g_event_flags = EVENT_NONE;

ISR(${mcuSpecifics.timer1CompVect}) {
    g_event_flags |= EVENT_TICK_1MS;
}

ISR(${mcuSpecifics.intVector}) {
    g_event_flags |= EVENT_BUTTON_EDGE;
}

static void init_hardware(void) {
    ${mcuSpecifics.ledDdr} |= (1 << ${mcuSpecifics.ledPin});
    ${mcuSpecifics.buttonPort} |= (1 << ${mcuSpecifics.buttonBit});

    // 1ms Timer
    TCCR1B = (1 << WGM12) | (1 << CS11) | (1 << CS10);
    OCR1A  = ${timer1Top1ms};
    TIMSK1 |= (1 << OCIE1A);

    // INT0
    ${mcuSpecifics.eicraReg} |= ${extIntBits};
    ${mcuSpecifics.eimskReg} |= (1 << INT0);

    set_sleep_mode(SLEEP_MODE_IDLE);
    sei();
}

int main(void) {
    init_hardware();

    while (1) {
        // 이벤트 큐 대기
        if (g_event_flags == EVENT_NONE) {
            sleep_mode(); // CPU 절전 대기
        }

        uint8_t active_events;
        cli();
        active_events = g_event_flags;
        g_event_flags = EVENT_NONE;
        sei();

        if (active_events & EVENT_BUTTON_EDGE) {
            ${mcuSpecifics.ledPort} ^= (1 << ${mcuSpecifics.ledPin});
        }
    }
    return 0;
}
`;
    }

    // 4. Arduino / PlatformIO Compatible Template
    return `/**
 * ==============================================================================
 * @file    sketch.ino / main.cpp (Arduino / PlatformIO)
 * @brief   ${currentProfile.fullName} 아두이노 프레임워크 레지스터 제어 템플릿
 * ==============================================================================
 */

#include <Arduino.h>

void setup() {
    // 1. 아두이노 표준 핀 대신 초고속 직접 레지스터 매핑
    ${mcuSpecifics.ledDdr} |= (1 << ${mcuSpecifics.ledPin});   // On-board LED Output
    ${mcuSpecifics.buttonPort} |= (1 << ${mcuSpecifics.buttonBit}); // Input Pullup

    // 2. 하드웨어 타이머1 1ms 인터럽트
    noInterrupts();
    TCCR1A = 0;
    TCCR1B = (1 << WGM12) | (1 << CS11) | (1 << CS10); // CTC, /64
    OCR1A  = ${timer1Top1ms};
    TIMSK1 |= (1 << OCIE1A);
    interrupts();

    Serial.begin(${usartBaud});
    Serial.println(F("[${currentProfile.name}] High-Speed Register Template Started"));
}

ISR(TIMER1_COMPA_vect) {
    // 1ms 하드웨어 인터럽트 루틴
}

void loop() {
    // 500ms LED 토글
    ${mcuSpecifics.ledPort} ^= (1 << ${mcuSpecifics.ledPin});
    delay(500);
}
`;
  }, [
    templateType,
    clockFreqHz,
    enableGpio,
    enableTimer,
    enableExtInt,
    enableUsart,
    enableAdc,
    enableWdt,
    enableGlobalInterrupt,
    timerMode,
    timerDutyPercent,
    timer1Top1ms,
    timer1PwmOcr,
    extIntSense,
    extIntBits,
    usartBaud,
    usartRxInterrupt,
    ubrrVal,
    adcChannel,
    wdtPeriod,
    buttonPullup,
    mcuSpecifics,
    currentProfile,
  ]);

  // Copy Code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedSourceCode);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Download File
  const handleDownloadFile = () => {
    const ext =
      templateType === 'modern_cpp'
        ? 'cpp'
        : templateType === 'arduino_compat'
        ? 'ino'
        : 'c';
    const filename = `firmware_${selectedMCU}.${ext}`;
    const blob = new Blob([generatedSourceCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Presets
  const applyPresetScenario = (scenario: 'blink' | 'timer_uart' | 'sensor' | 'all') => {
    if (scenario === 'blink') {
      setEnableGpio(true);
      setEnableTimer(false);
      setEnableExtInt(true);
      setEnableUsart(false);
      setEnableAdc(false);
      setEnableWdt(false);
    } else if (scenario === 'timer_uart') {
      setEnableGpio(true);
      setEnableTimer(true);
      setTimerMode('ctc_1ms');
      setEnableExtInt(false);
      setEnableUsart(true);
      setUsartBaud(115200);
      setEnableAdc(false);
      setEnableWdt(false);
    } else if (scenario === 'sensor') {
      setEnableGpio(true);
      setEnableTimer(true);
      setEnableExtInt(true);
      setEnableUsart(true);
      setEnableAdc(true);
      setEnableWdt(true);
    } else {
      setEnableGpio(true);
      setEnableTimer(true);
      setEnableExtInt(true);
      setEnableUsart(true);
      setEnableAdc(true);
      setEnableWdt(true);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
              <FileCode2 className="w-5 h-5" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              코드 템플릿 제너레이터
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono">
                {currentProfile.name}
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
            선택된 MCU와 설정된 레지스터 값(GPIO 입출력, 타이머/카운터, 외부/내부 인터럽트, 시리얼 통신)을
            바탕으로 즉시 빌드 가능한 표준 C/C++ 펌웨어 소스 코드를 생성하고 원클릭 복사합니다.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            onClick={handleCopyCode}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
          >
            {copiedCode ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
            <span>{copiedCode ? '복사 완료!' : 'C 소스 코드 복사'}</span>
          </button>

          <button
            onClick={handleDownloadFile}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>파일 다운로드</span>
          </button>
        </div>
      </div>

      {/* 2. Preset Scenarios Quick Bar */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            빠른 레지스터 구성 템플릿 프리셋
          </span>
          <span className="text-[10px] text-slate-500">원클릭으로 주변장치 모듈 조합 선택</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <button
            onClick={() => applyPresetScenario('blink')}
            className="p-2.5 rounded-lg text-left bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all text-xs"
          >
            <span className="font-bold text-[11px] text-cyan-300 block">LED 점멸 &amp; 버튼 INT0</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              DDRB 출력, PORTD 풀업 및 외부 인터럽트 반응
            </span>
          </button>

          <button
            onClick={() => applyPresetScenario('timer_uart')}
            className="p-2.5 rounded-lg text-left bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all text-xs"
          >
            <span className="font-bold text-[11px] text-emerald-300 block">
              1ms 타이머 틱 &amp; 115200 UART
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Timer1 CTC 1ms 시스템 틱과 직렬 통신 로깅
            </span>
          </button>

          <button
            onClick={() => applyPresetScenario('sensor')}
            className="p-2.5 rounded-lg text-left bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all text-xs"
          >
            <span className="font-bold text-[11px] text-amber-300 block">
              ADC 센서 &amp; WDT 감시 루프
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              10비트 ADC 변환 + 1초 워치독 안전 리셋
            </span>
          </button>

          <button
            onClick={() => applyPresetScenario('all')}
            className="p-2.5 rounded-lg text-left bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all text-xs"
          >
            <span className="font-bold text-[11px] text-indigo-300 block">전체 주변장치 통합 풀세트</span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              GPIO + Timer + INT + USART + ADC + WDT
            </span>
          </button>
        </div>
      </div>

      {/* 3. Configuration Workstation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Interactive Peripheral & Register Checkbox Controls */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              레지스터 구성 및 파라미터 조작
            </span>
            <span className="text-[11px] text-cyan-300 font-mono">F_CPU: {(clockFreqHz / 1e6).toFixed(1)}MHz</span>
          </div>

          {/* Template Format Selector */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 block">템플릿 아키텍처 형식:</label>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {(
                [
                  { id: 'baremetal_c', label: '베어메탈 C (main.c)' },
                  { id: 'modern_cpp', label: 'Modern C++ 클래스' },
                  { id: 'event_driven', label: '비동기 이벤트 루프' },
                  { id: 'arduino_compat', label: '아두이노/PIO 호환' },
                ] as const
              ).map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => setTemplateType(fmt.id)}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    templateType === fmt.id
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                      : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clock Selector */}
          <div className="space-y-1 pt-1">
            <label className="text-[11px] font-bold text-slate-300 block">시스템 클럭 (F_CPU):</label>
            <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
              {[16000000, 8000000, 4000000, 1000000].map((hz) => (
                <button
                  key={hz}
                  onClick={() => setClockFreqHz(hz)}
                  className={`py-1 rounded border text-center transition-all ${
                    clockFreqHz === hz
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {(hz / 1e6).toFixed(0)} MHz
                </button>
              ))}
            </div>
          </div>

          {/* Modules Toggles */}
          <div className="space-y-3 pt-2">
            {/* 1. GPIO Block */}
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableGpio}
                    onChange={(e) => setEnableGpio(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>GPIO 포트 레지스터 (DDR, PORT, PIN)</span>
                </label>
                <span className="text-[10px] text-cyan-300 font-mono">
                  LED: {mcuSpecifics.ledPin} | BTN: {mcuSpecifics.buttonBit}
                </span>
              </div>
              {enableGpio && (
                <div className="pl-5 text-xs space-y-1.5">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={buttonPullup}
                      onChange={(e) => setButtonPullup(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-cyan-500"
                    />
                    <span>버튼 핀 내부 풀업 저항(Pull-up) 활성화</span>
                  </label>
                </div>
              )}
            </div>

            {/* 2. Timer Block */}
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableTimer}
                    onChange={(e) => setEnableTimer(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>타이머/카운터 1 (Timer1 16-bit)</span>
                </label>
                <span className="text-[10px] text-cyan-300 font-mono">TCCR1A/B, OCR1A</span>
              </div>
              {enableTimer && (
                <div className="pl-5 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTimerMode('ctc_1ms')}
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        timerMode === 'ctc_1ms'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      1ms CTC 틱
                    </button>
                    <button
                      onClick={() => setTimerMode('fast_pwm_1khz')}
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        timerMode === 'fast_pwm_1khz'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Fast PWM
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. External Interrupts Block */}
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableExtInt}
                    onChange={(e) => setEnableExtInt(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>외부 인터럽트 (INT0 / EICRA / EIMSK)</span>
                </label>
                <span className="text-[10px] text-cyan-300 font-mono">INT0_vect</span>
              </div>
              {enableExtInt && (
                <div className="pl-5 flex items-center gap-1.5 text-xs">
                  {(['falling', 'rising', 'change', 'low'] as const).map((sense) => (
                    <button
                      key={sense}
                      onClick={() => setExtIntSense(sense)}
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${
                        extIntSense === sense
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {sense}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 4. USART Serial Block */}
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableUsart}
                    onChange={(e) => setEnableUsart(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>USART0 시리얼 통신 (UBRR0 / UCSR0B)</span>
                </label>
                <span className="text-[10px] text-cyan-300 font-mono">{usartBaud} bps</span>
              </div>
              {enableUsart && (
                <div className="pl-5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    {[9600, 57600, 115200].map((b) => (
                      <button
                        key={b}
                        onClick={() => setUsartBaud(b)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          usartBaud === b
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>

                  <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={usartRxInterrupt}
                      onChange={(e) => setUsartRxInterrupt(e.target.checked)}
                      className="rounded bg-slate-800 text-cyan-500"
                    />
                    <span>RX 수신 ISR</span>
                  </label>
                </div>
              )}
            </div>

            {/* 5. ADC & Watchdog Toggles */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <label className="flex items-center gap-2 font-bold text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableAdc}
                    onChange={(e) => setEnableAdc(e.target.checked)}
                    className="rounded bg-slate-800 text-cyan-500"
                  />
                  <span>ADC 변환기</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Ch 0</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <label className="flex items-center gap-2 font-bold text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableWdt}
                    onChange={(e) => setEnableWdt(e.target.checked)}
                    className="rounded bg-slate-800 text-cyan-500"
                  />
                  <span>Watchdog WDT</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">1 Sec</span>
              </div>
            </div>
          </div>

          {/* Calculated Register Value Preview Table */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              생성 코드 반영 레지스터 Hex 값 미리보기
            </span>
            <div className="space-y-1">
              {registerPreview.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-1.5 rounded bg-slate-900/80 border border-slate-800/80 text-[10px] font-mono"
                >
                  <span className="text-cyan-300 font-bold">{item.reg}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{item.hex}</span>
                    <span className="text-slate-400 text-[9px] font-sans truncate max-w-[120px]">
                      {item.note}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Code Viewer & Terminal Info */}
        <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">
                  생성된 펌웨어 소스 코드 ({templateType === 'modern_cpp' ? 'main.cpp' : 'main.c'})
                </span>
              </div>

              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-mono">
                {generatedSourceCode.split('\n').length} lines
              </span>
            </div>

            {/* Code Box */}
            <pre className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed max-h-[520px] overflow-y-auto">
              {generatedSourceCode}
            </pre>
          </div>

          {/* Compilation Command Guide */}
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                AVR-GCC 단일 명령 빌드 커맨드:
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Target: {currentProfile.name}</span>
            </div>
            <pre className="p-2 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-amber-300 overflow-x-auto">
              avr-gcc -Wall -Os -DF_CPU={clockFreqHz}UL -mmcu={currentProfile.name.toLowerCase()} -o main.elf main.c
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
