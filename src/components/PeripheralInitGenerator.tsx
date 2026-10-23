import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  FileCode2,
  Copy,
  Check,
  Download,
  Settings,
  Cpu,
  Zap,
  Sliders,
  Terminal,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  Layers,
  Flame,
  Radio,
  Clock,
  Activity,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export const PeripheralInitGenerator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // -------------------------------------------------------------
  // Peripheral Inclusions
  // -------------------------------------------------------------
  const [includeUsart, setIncludeUsart] = useState<boolean>(true);
  const [includeI2c, setIncludeI2c] = useState<boolean>(true);
  const [includeTimer1, setIncludeTimer1] = useState<boolean>(true);
  const [includeAdc, setIncludeAdc] = useState<boolean>(true);
  const [includeGpio, setIncludeGpio] = useState<boolean>(true);
  const [includeWdt, setIncludeWdt] = useState<boolean>(false);
  const [includeGlobalInterrupt, setIncludeGlobalInterrupt] = useState<boolean>(true);

  // -------------------------------------------------------------
  // System Clock
  // -------------------------------------------------------------
  const [fcpuHz, setFcpuHz] = useState<number>(16000000);

  // -------------------------------------------------------------
  // USART Config
  // -------------------------------------------------------------
  const maxUsartChannels = currentProfile.usart;
  const [usartChannel, setUsartChannel] = useState<number>(0);
  const [usartBaud, setUsartBaud] = useState<number>(115200);
  const [usartU2x, setUsartU2x] = useState<boolean>(false);
  const [usartRxInterrupt, setUsartRxInterrupt] = useState<boolean>(false);
  const [usartDataBits, setUsartDataBits] = useState<number>(8);

  // -------------------------------------------------------------
  // I2C (TWI) Config
  // -------------------------------------------------------------
  const [i2cSpeedKhz, setI2cSpeedKhz] = useState<number>(100);
  const [i2cPrescaler, setI2cPrescaler] = useState<number>(1); // TWPS = 0 -> 4^0 = 1

  // -------------------------------------------------------------
  // Timer1 PWM / CTC Config
  // -------------------------------------------------------------
  const [timer1Mode, setTimer1Mode] = useState<'fast_pwm' | 'ctc' | 'normal'>('fast_pwm');
  const [timer1FreqHz, setTimer1FreqHz] = useState<number>(1000); // 1 kHz PWM or CTC
  const [timer1DutyPct, setTimer1DutyPct] = useState<number>(50); // 50% duty
  const [timer1Prescaler, setTimer1Prescaler] = useState<number>(8); // 1, 8, 64, 256, 1024

  // -------------------------------------------------------------
  // ADC Config
  // -------------------------------------------------------------
  const [adcVref, setAdcVref] = useState<'avcc' | 'internal' | 'aref'>('avcc');
  const [adcPrescaler, setAdcPrescaler] = useState<number>(128); // 16MHz / 128 = 125kHz
  const [adcLeftAdjust, setAdcLeftAdjust] = useState<boolean>(false);
  const [adcAutoTrigger, setAdcAutoTrigger] = useState<boolean>(false);

  // -------------------------------------------------------------
  // Watchdog Config
  // -------------------------------------------------------------
  const [wdtTimeout, setWdtTimeout] = useState<'250ms' | '500ms' | '1s' | '2s'>('1s');

  // Active view: 'header' (mcu_peripherals.h) vs 'main' (example main.c)
  const [activeTab, setActiveTab] = useState<'header' | 'main'>('header');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // -------------------------------------------------------------
  // Calculations
  // -------------------------------------------------------------
  // USART UBRR
  const safeUsartCh = usartChannel >= maxUsartChannels ? 0 : usartChannel;
  const usartDivisor = usartU2x ? 8 : 16;
  const ubrrCalc = Math.round(fcpuHz / (usartDivisor * usartBaud) - 1);
  const safeUbrr = Math.max(0, Math.min(4095, ubrrCalc));
  const actualBaud = fcpuHz / (usartDivisor * (safeUbrr + 1));
  const baudErrorPct = ((actualBaud - usartBaud) / usartBaud) * 100;

  // I2C TWBR
  // SCL = F_CPU / (16 + 2 * TWBR * 4^TWPS)
  // TWBR = ((F_CPU / SCL) - 16) / (2 * 4^TWPS)
  const sclHz = i2cSpeedKhz * 1000;
  const twbrCalc = Math.round(((fcpuHz / sclHz) - 16) / (2 * i2cPrescaler));
  const safeTwbr = Math.max(0, Math.min(255, twbrCalc));
  const actualSclKhz = (fcpuHz / (16 + 2 * safeTwbr * i2cPrescaler)) / 1000;

  // Timer1 TOP and Compare
  // Mode 14 Fast PWM: f = F_CPU / (N * (1 + TOP)) => TOP = (F_CPU / (N * f)) - 1
  const timer1TopCalc = Math.round(fcpuHz / (timer1Prescaler * timer1FreqHz)) - 1;
  const safeTimer1Top = Math.max(1, Math.min(65535, timer1TopCalc));
  const safeTimer1Ocr = Math.round((safeTimer1Top + 1) * (timer1DutyPct / 100));

  // ADC Clock frequency
  const adcClockKhz = (fcpuHz / adcPrescaler) / 1000;
  const isAdcClockOptimal = adcClockKhz >= 50 && adcClockKhz <= 200;

  // -------------------------------------------------------------
  // C Header Code Generator (Single-Header Library Pattern)
  // -------------------------------------------------------------
  const generatedHeaderCode = useMemo(() => {
    const isAtmega328p = selectedMCU === 'atmega328p';
    const isAtmega128 = selectedMCU === 'atmega128';
    const isAtmega640 = selectedMCU === 'atmega640';
    const isAtmega2560 = selectedMCU === 'atmega2560';

    const headerGuard = `MCU_PERIPHERALS_${selectedMCU.toUpperCase()}_H`;

    // Prescaler CS bits for Timer1
    let timer1CsBits = 'CS10';
    if (timer1Prescaler === 8) timer1CsBits = '(1 << CS11)';
    else if (timer1Prescaler === 64) timer1CsBits = '(1 << CS11) | (1 << CS10)';
    else if (timer1Prescaler === 256) timer1CsBits = '(1 << CS12)';
    else if (timer1Prescaler === 1024) timer1CsBits = '(1 << CS12) | (1 << CS10)';

    // ADC Prescaler bits
    let adcPsBits = '(1 << ADPS2) | (1 << ADPS1) | (1 << ADPS0)'; // 128
    if (adcPrescaler === 64) adcPsBits = '(1 << ADPS2) | (1 << ADPS1)';
    else if (adcPrescaler === 32) adcPsBits = '(1 << ADPS2) | (1 << ADPS0)';
    else if (adcPrescaler === 16) adcPsBits = '(1 << ADPS2)';
    else if (adcPrescaler === 8) adcPsBits = '(1 << ADPS1) | (1 << ADPS0)';

    // ADC VREF bits
    let adcVrefBits = '(1 << REFS0)'; // AVCC with cap
    if (adcVref === 'internal') {
      adcVrefBits = isAtmega328p ? '(1 << REFS1) | (1 << REFS0)' : '(1 << REFS1) | (1 << REFS0)';
    } else if (adcVref === 'aref') {
      adcVrefBits = '0x00';
    }

    // Default LED pin for GPIO init
    let ledPort = 'PORTB';
    let ledDdr = 'DDRB';
    let ledPin = 'PB5';
    if (isAtmega2560) ledPin = 'PB7';

    return `/**
 * ==============================================================================
 * @file    mcu_peripherals.h
 * @brief   ${currentProfile.name} 하드웨어 주변장치 초기화 및 제어 드라이버
 * @target  ${currentProfile.name} (${currentProfile.package})
 * @freq    ${(fcpuHz / 1e6).toFixed(1)} MHz
 * @gen     AVR 펌웨어 개발 - Peripheral Initialization Generator
 * ==============================================================================
 */

#ifndef ${headerGuard}
#define ${headerGuard}

#define F_CPU ${fcpuHz}UL

#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/delay.h>
#include <stdint.h>
#include <stdbool.h>
${includeWdt ? '#include <avr/wdt.h>\n' : ''}
#ifdef __cplusplus
extern "C" {
#endif

/* ==============================================================================
 * 1. 시스템 매크로 정의 (System Defines)
 * ============================================================================== */
#define MCU_NAME            "${currentProfile.name}"
#define MCU_F_CPU           ${fcpuHz}UL
${includeUsart ? `#define USART_BAUD_TARGET   ${usartBaud}UL\n#define USART_UBRR_VALUE    ${safeUbrr}U\n` : ''}
${includeI2c ? `#define TWI_FREQ_KHZ        ${i2cSpeedKhz}U\n#define TWI_TWBR_VALUE      ${safeTwbr}U\n` : ''}
${includeTimer1 ? `#define TIMER1_FREQ_HZ      ${timer1FreqHz}UL\n#define TIMER1_TOP_VALUE    ${safeTimer1Top}U\n#define TIMER1_DUTY_PCT     ${timer1DutyPct}U\n` : ''}

/* ==============================================================================
 * 2. 주변장치 초기화 함수 프로토타입 (Function Prototypes)
 * ============================================================================== */
void peripherals_init(void);

${includeGpio ? `void gpio_init(void);\nvoid gpio_led_toggle(void);\nvoid gpio_led_set(bool state);\n` : ''}
${includeUsart ? `void usart${safeUsartCh}_init(void);\nvoid usart${safeUsartCh}_transmit(uint8_t data);\nvoid usart${safeUsartCh}_print(const char* str);\nuint8_t usart${safeUsartCh}_receive(void);\nbool usart${safeUsartCh}_is_data_available(void);\n` : ''}
${includeI2c ? `void twi_init(void);\nbool twi_start(uint8_t address);\nvoid twi_stop(void);\nbool twi_write(uint8_t data);\nuint8_t twi_read_ack(void);\nuint8_t twi_read_nack(void);\n` : ''}
${includeTimer1 ? `void timer1_init(void);\nvoid timer1_set_duty(uint8_t duty_pct);\n` : ''}
${includeAdc ? `void adc_init(void);\nuint16_t adc_read(uint8_t channel);\n` : ''}
${includeWdt ? `void watchdog_init(void);\nvoid watchdog_feed(void);\n` : ''}

/* ==============================================================================
 * 3. 주변장치 초기화 구현부 (Implementation)
 * ============================================================================== */

${includeGpio ? `/**
 * @brief  GPIO 핀 입출력 방향 및 풀업 저항 초기화
 */
static inline void gpio_init(void) {
    // 빌트인 LED 핀 (${ledPin}) 출력 모드 설정
    ${ledDdr} |= (1 << ${ledPin});
    ${ledPort} &= ~(1 << ${ledPin}); // 초기 상태: LOW
}

static inline void gpio_led_toggle(void) {
    // PIN 하드웨어 레지스터 기록을 통한 단 1사이클 고속 비트 반전
    PINB |= (1 << ${ledPin});
}

static inline void gpio_led_set(bool state) {
    if (state) {
        ${ledPort} |= (1 << ${ledPin});
    } else {
        ${ledPort} &= ~(1 << ${ledPin});
    }
}
` : ''}

${includeUsart ? `/**
 * @brief  USART${safeUsartCh} 시리얼 통신 초기화 (${usartBaud} bps, 8N1)
 *         오차율: ${baudErrorPct.toFixed(2)}% | UBRR: ${safeUbrr}
 */
static inline void usart${safeUsartCh}_init(void) {
    // 1. 보드레이트 상위/하위 레지스터 설정
    UBRR${safeUsartCh}H = (uint8_t)(USART_UBRR_VALUE >> 8);
    UBRR${safeUsartCh}L = (uint8_t)(USART_UBRR_VALUE & 0xFF);

    // 2. ${usartU2x ? '2배속 모드(U2X0) 활성화' : '표준 1배속 비동기 모드'}
    UCSR${safeUsartCh}A = ${usartU2x ? `(1 << U2X${safeUsartCh})` : '0x00'};

    // 3. 수신(RXEN) 및 송신(TXEN) 인에이블${usartRxInterrupt ? ' & 수신 인터럽트(RXCIE) 활성화' : ''}
    UCSR${safeUsartCh}B = (1 << RXEN${safeUsartCh}) | (1 << TXEN${safeUsartCh})${usartRxInterrupt ? ` | (1 << RXCIE${safeUsartCh})` : ''};

    // 4. 프레임 형식: 8비트 데이터, 1스톱비트, 패리티 없음 (8N1)
    UCSR${safeUsartCh}C = (1 << UCSZ${safeUsartCh}1) | (1 << UCSZ${safeUsartCh}0);
}

static inline void usart${safeUsartCh}_transmit(uint8_t data) {
    // 송신 버퍼(UDRE)가 빌 때까지 폴링 대기
    while (!(UCSR${safeUsartCh}A & (1 << UDRE${safeUsartCh})));
    UDR${safeUsartCh} = data;
}

static inline void usart${safeUsartCh}_print(const char* str) {
    while (*str) {
        usart${safeUsartCh}_transmit((uint8_t)*str++);
    }
}

static inline uint8_t usart${safeUsartCh}_receive(void) {
    // 수신 완료(RXC) 대기
    while (!(UCSR${safeUsartCh}A & (1 << RXC${safeUsartCh})));
    return UDR${safeUsartCh};
}

static inline bool usart${safeUsartCh}_is_data_available(void) {
    return (UCSR${safeUsartCh}A & (1 << RXC${safeUsartCh})) != 0;
}
` : ''}

${includeI2c ? `/**
 * @brief  I2C (TWI) 마스터 모드 초기화 (${i2cSpeedKhz} kHz)
 *         TWBR = ${safeTwbr}, TWPS 분주 = ${i2cPrescaler}
 */
static inline void twi_init(void) {
    // 1. 전송속도 비트레이트 레지스터 설정
    TWBR = TWI_TWBR_VALUE;

    // 2. 프리스케일러 비트 설정 (TWPS1:0 = ${i2cPrescaler === 1 ? '0' : i2cPrescaler === 4 ? '1' : i2cPrescaler === 16 ? '2' : '3'})
    TWSR = (TWSR & ~0x03) | ${i2cPrescaler === 1 ? '0' : i2cPrescaler === 4 ? '1' : i2cPrescaler === 16 ? '2' : '3'};

    // 3. TWI 하드웨어 활성화 및 ACK 자동 응답 인에이블
    TWCR = (1 << TWEN) | (1 << TWEA);
}

static inline bool twi_start(uint8_t address) {
    // START 신호 전송 요청
    TWCR = (1 << TWINT) | (1 << TWSTA) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT)));

    // 주소 및 R/W 비트 전송
    TWDR = address;
    TWCR = (1 << TWINT) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT)));

    uint8_t status = TWSR & 0xF8;
    return (status == 0x18 || status == 0x40); // SLA+W ACK (0x18) or SLA+R ACK (0x40)
}

static inline void twi_stop(void) {
    // STOP 신호 전송
    TWCR = (1 << TWINT) | (1 << TWSTO) | (1 << TWEN);
    _delay_us(5);
}

static inline bool twi_write(uint8_t data) {
    TWDR = data;
    TWCR = (1 << TWINT) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT)));
    return ((TWSR & 0xF8) == 0x28); // Data ACK
}

static inline uint8_t twi_read_ack(void) {
    TWCR = (1 << TWINT) | (1 << TWEN) | (1 << TWEA);
    while (!(TWCR & (1 << TWINT)));
    return TWDR;
}

static inline uint8_t twi_read_nack(void) {
    TWCR = (1 << TWINT) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT)));
    return TWDR;
}
` : ''}

${includeTimer1 ? `/**
 * @brief  16-bit Timer1 초기화 (${timer1Mode === 'fast_pwm' ? 'Fast PWM Mode 14' : timer1Mode === 'ctc' ? 'CTC Mode 4' : 'Normal Mode'})
 *         목표 주파수: ${timer1FreqHz} Hz | TOP = ${safeTimer1Top} | OCR1A = ${safeTimer1Ocr} (${timer1DutyPct}%)
 */
static inline void timer1_init(void) {
    // 1. PWM 출력 핀 (OC1A: ${isAtmega328p ? 'PB1' : 'PB5'}) 출력 모드 설정
    DDRB |= (1 << ${isAtmega328p ? 'DDB1' : 'DDB5'});

    ${timer1Mode === 'fast_pwm' ? `// Fast PWM Mode 14 (TOP = ICR1, Clear OC1A on Compare Match)
    TCCR1A = (1 << COM1A1) | (1 << WGM11);
    TCCR1B = (1 << WGM13) | (1 << WGM12) | ${timer1CsBits};

    ICR1  = TIMER1_TOP_VALUE; // 주기 결정
    OCR1A = ${safeTimer1Ocr};         // 듀티 사이클 결정` : timer1Mode === 'ctc' ? `// CTC Mode 4 (TOP = OCR1A, Toggle OC1A on Compare Match)
    TCCR1A = (1 << COM1A0);
    TCCR1B = (1 << WGM12) | ${timer1CsBits};
    OCR1A  = TIMER1_TOP_VALUE;` : `// Normal Mode
    TCCR1A = 0x00;
    TCCR1B = ${timer1CsBits};`}
}

static inline void timer1_set_duty(uint8_t duty_pct) {
    if (duty_pct > 100) duty_pct = 100;
    OCR1A = (uint16_t)(((uint32_t)ICR1 + 1) * duty_pct / 100);
}
` : ''}

${includeAdc ? `/**
 * @brief  10-Bit ADC 초기화 (기준전압: ${adcVref.toUpperCase()}, 변환 클럭: ${adcClockKhz.toFixed(1)} kHz)
 */
static inline void adc_init(void) {
    // 1. 기준 전압 선택 및 우측 정렬
    ADMUX = ${adcVrefBits}${adcLeftAdjust ? ' | (1 << ADLAR)' : ''};

    // 2. ADC 인에이블 및 분주비 ${adcPrescaler} 설정
    ADCSRA = (1 << ADEN) | ${adcPsBits};
}

static inline uint16_t adc_read(uint8_t channel) {
    // 채널 선택 (0~7번 채널 마스크)
    ADMUX = (ADMUX & 0xF0) | (channel & 0x0F);

    // 샘플링 안정화를 위한 짧은 지연
    _delay_us(10);

    // 단일 변환 시작 (ADSC=1)
    ADCSRA |= (1 << ADSC);

    // 변환 완료 폴링 대기 (ADSC가 0으로 복귀할 때까지)
    while (ADCSRA & (1 << ADSC));

    // 10비트 결과 반환 (ADCL 먼저 읽은 후 ADCH 자동 병합)
    return ADC;
}
` : ''}

${includeWdt ? `/**
 * @brief  워치독 타이머 (WDT) 초기화 (${wdtTimeout})
 */
static inline void watchdog_init(void) {
    // 4사이클 타임아웃 방지 시퀀스 (WDCE & WDE 동시 세트)
    wdt_enable(${wdtTimeout === '250ms' ? 'WDTO_250MS' : wdtTimeout === '500ms' ? 'WDTO_500MS' : wdtTimeout === '1s' ? 'WDTO_1S' : 'WDTO_2S'});
}

static inline void watchdog_feed(void) {
    wdt_reset();
}
` : ''}

/* ==============================================================================
 * 4. 마스터 통합 초기화 함수 (Master Hardware Initializer)
 * ============================================================================== */
static inline void peripherals_init(void) {
${includeWdt ? '    watchdog_init();\n' : ''}${includeGpio ? '    gpio_init();\n' : ''}${includeUsart ? `    usart${safeUsartCh}_init();\n` : ''}${includeI2c ? '    twi_init();\n' : ''}${includeTimer1 ? '    timer1_init();\n' : ''}${includeAdc ? '    adc_init();\n' : ''}${includeGlobalInterrupt ? '\n    // 전역 인터럽트 활성화 (SREG I-Bit)\n    sei();\n' : ''}}

#ifdef __cplusplus
}
#endif

#endif /* ${headerGuard} */
`;
  }, [
    selectedMCU,
    currentProfile,
    fcpuHz,
    includeUsart,
    includeI2c,
    includeTimer1,
    includeAdc,
    includeGpio,
    includeWdt,
    includeGlobalInterrupt,
    safeUsartCh,
    usartBaud,
    usartU2x,
    usartRxInterrupt,
    safeUbrr,
    baudErrorPct,
    i2cSpeedKhz,
    safeTwbr,
    i2cPrescaler,
    timer1Mode,
    timer1FreqHz,
    timer1DutyPct,
    timer1Prescaler,
    safeTimer1Top,
    safeTimer1Ocr,
    adcVref,
    adcPrescaler,
    adcClockKhz,
    adcLeftAdjust,
    wdtTimeout
  ]);

  // -------------------------------------------------------------
  // Example main.c Usage Code Generator
  // -------------------------------------------------------------
  const generatedMainCode = useMemo(() => {
    return `// ==============================================================================
// @file    main.c
// @brief   mcu_peripherals.h를 활용한 ${currentProfile.name} 펌웨어 메인 프로그램
// ==============================================================================
#include "mcu_peripherals.h"

int main(void) {
    // 1. 하드웨어 주변장치 원클릭 일괄 초기화
    peripherals_init();

    ${includeUsart ? `usart${safeUsartCh}_print("\\r\\n=== ${currentProfile.name} System Booted ===\\r\\n");` : ''}

    // 2. 메인 슈퍼루프
    while (1) {
        ${includeWdt ? 'watchdog_feed(); // 워치독 리셋\n        ' : ''}${includeGpio ? 'gpio_led_toggle(); // LED 점멸\n        ' : ''}${includeAdc ? 'uint16_t sensor_val = adc_read(0); // ADC0 채널 판독\n        ' : ''}${includeUsart && includeAdc ? `// 시리얼 디버그 출력\n        // usart${safeUsartCh}_print("ADC: ...");\n        ` : ''}_delay_ms(500);
    }

    return 0;
}
`;
  }, [currentProfile.name, safeUsartCh, includeWdt, includeGpio, includeAdc, includeUsart]);

  // -------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------
  const handleCopyCode = () => {
    const textToCopy = activeTab === 'header' ? generatedHeaderCode : generatedMainCode;
    navigator.clipboard.writeText(textToCopy);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.6 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadHeader = () => {
    const filename = activeTab === 'header' ? 'mcu_peripherals.h' : 'main.c';
    const content = activeTab === 'header' ? generatedHeaderCode : generatedMainCode;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    confetti({ particleCount: 45, spread: 70, origin: { y: 0.6 } });
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold tracking-wide uppercase mb-2">
            <FileCode2 className="w-3.5 h-3.5" />
            Auto-Generated Bare-Metal C Header Driver
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-3">
            주변장치 초기화 C 헤더 생성기 (Peripheral Initialization Generator)
            <span className="text-xs font-mono font-normal text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-700/50">
              mcu_peripherals.h • {currentProfile.name}
            </span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            레지스터 계산 결과(USART UBRR, I2C TWBR, Timer1 Fast PWM TOP, 10-bit ADC, GPIO 등)를 결합하여,
            임베디드 프로젝트에 바로 <code className="text-cyan-300 font-mono">#include "mcu_peripherals.h"</code>하여 사용할 수 있는
            프로덕션 레디 C 헤더 파일을 원클릭으로 생성하고 내보냅니다.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto shrink-0">
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 hover:text-white"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? '복사 완료!' : '코드 복사'}</span>
          </button>
          <button
            onClick={handleDownloadHeader}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-lg shadow-cyan-600/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{activeTab === 'header' ? 'mcu_peripherals.h 다운로드' : 'main.c 다운로드'}</span>
          </button>
        </div>
      </div>

      {/* Module Selection Pills */}
      <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
          <span className="flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-cyan-400" />
            헤더 파일에 포함할 주변장치 모듈 선택 (Toggle Inclusions)
          </span>
          <span className="text-[11px] font-mono text-cyan-400">
            F_CPU: {(fcpuHz / 1e6).toFixed(0)} MHz
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          <label className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-2 select-none ${
            includeUsart ? 'bg-cyan-950/40 border-cyan-500/60 text-white font-semibold' : 'bg-slate-900/60 border-slate-800 text-slate-500'
          }`}>
            <input
              type="checkbox"
              checked={includeUsart}
              onChange={(e) => setIncludeUsart(e.target.checked)}
              className="accent-cyan-500 rounded"
            />
            <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>USART 시리얼</span>
          </label>

          <label className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-2 select-none ${
            includeI2c ? 'bg-cyan-950/40 border-cyan-500/60 text-white font-semibold' : 'bg-slate-900/60 border-slate-800 text-slate-500'
          }`}>
            <input
              type="checkbox"
              checked={includeI2c}
              onChange={(e) => setIncludeI2c(e.target.checked)}
              className="accent-cyan-500 rounded"
            />
            <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>I2C (TWI) 마스터</span>
          </label>

          <label className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-2 select-none ${
            includeTimer1 ? 'bg-cyan-950/40 border-cyan-500/60 text-white font-semibold' : 'bg-slate-900/60 border-slate-800 text-slate-500'
          }`}>
            <input
              type="checkbox"
              checked={includeTimer1}
              onChange={(e) => setIncludeTimer1(e.target.checked)}
              className="accent-cyan-500 rounded"
            />
            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Timer1 PWM/CTC</span>
          </label>

          <label className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-2 select-none ${
            includeAdc ? 'bg-cyan-950/40 border-cyan-500/60 text-white font-semibold' : 'bg-slate-900/60 border-slate-800 text-slate-500'
          }`}>
            <input
              type="checkbox"
              checked={includeAdc}
              onChange={(e) => setIncludeAdc(e.target.checked)}
              className="accent-cyan-500 rounded"
            />
            <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>10-Bit ADC</span>
          </label>

          <label className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-2 select-none ${
            includeGpio ? 'bg-cyan-950/40 border-cyan-500/60 text-white font-semibold' : 'bg-slate-900/60 border-slate-800 text-slate-500'
          }`}>
            <input
              type="checkbox"
              checked={includeGpio}
              onChange={(e) => setIncludeGpio(e.target.checked)}
              className="accent-cyan-500 rounded"
            />
            <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>GPIO & LED</span>
          </label>

          <label className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-2 select-none ${
            includeWdt ? 'bg-cyan-950/40 border-cyan-500/60 text-white font-semibold' : 'bg-slate-900/60 border-slate-800 text-slate-500'
          }`}>
            <input
              type="checkbox"
              checked={includeWdt}
              onChange={(e) => setIncludeWdt(e.target.checked)}
              className="accent-cyan-500 rounded"
            />
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>워치독 (WDT)</span>
          </label>
        </div>
      </div>

      {/* Interactive Parameter Tuners Accordion / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* Module 1: USART Parameters */}
        {includeUsart && (
          <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-white border-b border-slate-800/80 pb-2">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <Radio className="w-3.5 h-3.5" /> USART 파라미터
              </span>
              <span className="font-mono text-[10px] text-emerald-400">
                UBRR: {safeUbrr}
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">통신 포트:</label>
                <select
                  value={safeUsartCh}
                  onChange={(e) => setUsartChannel(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 font-mono text-xs text-white"
                >
                  {Array.from({ length: maxUsartChannels }, (_, i) => (
                    <option key={i} value={i}>USART{i}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">보레이트 (Baud Rate):</label>
                <select
                  value={usartBaud}
                  onChange={(e) => setUsartBaud(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 font-mono text-xs text-white"
                >
                  {[9600, 19200, 38400, 57600, 115200, 250000].map((b) => (
                    <option key={b} value={b}>{b.toLocaleString()} bps</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-400">
                  <input
                    type="checkbox"
                    checked={usartU2x}
                    onChange={(e) => setUsartU2x(e.target.checked)}
                    className="accent-cyan-500 rounded"
                  />
                  <span>U2X 2배속 모드</span>
                </label>
                <span className={`text-[10px] font-mono ${Math.abs(baudErrorPct) > 2 ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                  오차: {baudErrorPct.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Module 2: I2C (TWI) Parameters */}
        {includeI2c && (
          <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-white border-b border-slate-800/80 pb-2">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <Zap className="w-3.5 h-3.5" /> I2C (TWI) 파라미터
              </span>
              <span className="font-mono text-[10px] text-emerald-400">
                TWBR: {safeTwbr}
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">SCL 통신 속도:</label>
                <select
                  value={i2cSpeedKhz}
                  onChange={(e) => setI2cSpeedKhz(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 font-mono text-xs text-white"
                >
                  <option value={50}>50 kHz (저속 센서)</option>
                  <option value={100}>100 kHz (Standard-Mode)</option>
                  <option value={400}>400 kHz (Fast-Mode)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">TWPS 프리스케일러:</label>
                <select
                  value={i2cPrescaler}
                  onChange={(e) => setI2cPrescaler(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 font-mono text-xs text-white"
                >
                  <option value={1}>1x (TWPS = 0)</option>
                  <option value={4}>4x (TWPS = 1)</option>
                  <option value={16}>16x (TWPS = 2)</option>
                  <option value={64}>64x (TWPS = 3)</option>
                </select>
              </div>

              <div className="text-[10px] text-slate-400 pt-1 flex justify-between font-mono">
                <span>실제 SCL 주파수:</span>
                <span className="text-white font-bold">{actualSclKhz.toFixed(1)} kHz</span>
              </div>
            </div>
          </div>
        )}

        {/* Module 3: Timer1 PWM / CTC Parameters */}
        {includeTimer1 && (
          <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-white border-b border-slate-800/80 pb-2">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <Clock className="w-3.5 h-3.5" /> Timer1 파라미터
              </span>
              <span className="font-mono text-[10px] text-emerald-400">
                TOP: {safeTimer1Top}
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">동작 모드:</label>
                <select
                  value={timer1Mode}
                  onChange={(e) => setTimer1Mode(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 font-mono text-xs text-white"
                >
                  <option value="fast_pwm">Fast PWM (Mode 14)</option>
                  <option value="ctc">CTC 모드 (Mode 4)</option>
                  <option value="normal">Normal 오버플로우 모드</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">목표 주파수 / 듀티비:</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={timer1FreqHz}
                    onChange={(e) => setTimer1FreqHz(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-1.5 font-mono text-xs text-white"
                  >
                    <option value={490}>490 Hz (Uno)</option>
                    <option value={976}>976 Hz</option>
                    <option value={1000}>1 kHz</option>
                    <option value={5000}>5 kHz</option>
                    <option value={20000}>20 kHz</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={timer1DutyPct}
                    onChange={(e) => setTimer1DutyPct(Math.max(0, Math.min(100, Number(e.target.value))))}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-1.5 font-mono text-xs text-amber-400 text-center"
                    placeholder="Duty %"
                  />
                </div>
              </div>

              <div className="text-[10px] text-slate-400 pt-1 flex justify-between font-mono">
                <span>OCR1A 레지스터:</span>
                <span className="text-amber-400 font-bold">{safeTimer1Ocr}</span>
              </div>
            </div>
          </div>
        )}

        {/* Module 4: ADC Parameters */}
        {includeAdc && (
          <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-white border-b border-slate-800/80 pb-2">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <Activity className="w-3.5 h-3.5" /> 10-Bit ADC 파라미터
              </span>
              <span className={`font-mono text-[10px] ${isAdcClockOptimal ? 'text-emerald-400' : 'text-amber-400'}`}>
                {adcClockKhz.toFixed(0)} kHz
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">기준 전압 (VREF):</label>
                <select
                  value={adcVref}
                  onChange={(e) => setAdcVref(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 font-mono text-xs text-white"
                >
                  <option value="avcc">AVCC (+5V / +3.3V 전원 기준)</option>
                  <option value="internal">내부 1.1V / 2.56V 밴드갭</option>
                  <option value="aref">외부 AREF 핀 인가 전압</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">ADC 클럭 분주비:</label>
                <select
                  value={adcPrescaler}
                  onChange={(e) => setAdcPrescaler(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 font-mono text-xs text-white"
                >
                  <option value={128}>128 분주 (16MHz 시 125kHz - 권장)</option>
                  <option value={64}>64 분주 (250kHz)</option>
                  <option value={32}>32 분주 (500kHz)</option>
                  <option value={16}>16 분주 (1MHz)</option>
                </select>
              </div>

              <div className="text-[10px] text-slate-400 pt-1 flex justify-between font-mono">
                <span>정확도 권장 범위:</span>
                <span className={isAdcClockOptimal ? 'text-emerald-400' : 'text-amber-400'}>
                  50~200 kHz ({isAdcClockOptimal ? '적합' : '초과'})
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Code Viewer Tabs & Window */}
      <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
        {/* Tab Switcher Bar */}
        <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('header')}
              className={`px-3 py-1.5 rounded-lg font-mono font-bold transition flex items-center gap-1.5 ${
                activeTab === 'header'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>mcu_peripherals.h (완성형 드라이버 헤더)</span>
            </button>
            <button
              onClick={() => setActiveTab('main')}
              className={`px-3 py-1.5 rounded-lg font-mono font-bold transition flex items-center gap-1.5 ${
                activeTab === 'main'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>main.c (초기화 호출 예제)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
            <span>Target: {currentProfile.name}</span>
            <span className="text-slate-600">|</span>
            <span>ANSI C99 / avr-gcc</span>
          </div>
        </div>

        {/* Code Pre Box */}
        <pre className="p-4 sm:p-5 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[480px] custom-scrollbar selection:bg-cyan-500/30 selection:text-cyan-200">
          {activeTab === 'header' ? generatedHeaderCode : generatedMainCode}
        </pre>
      </div>
    </div>
  );
};
