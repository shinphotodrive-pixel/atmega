import React, { useState } from 'react';
import {
  Cpu,
  Download,
  Filter,
  Layers,
  Sparkles,
  ExternalLink,
  ArrowRight,
  ShieldAlert,
  Zap,
  Code2,
  Copy,
  Check,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { SupportedMCU } from '../data/pinmapData';

interface Props {
  onSelectMCU: (mcu: SupportedMCU) => void;
}

interface UniversalMcuSpec {
  category: string;
  feature: string;
  avr: string; // ATmega (AVR)
  stm32: string; // STM32F0 / STM32F1
  pic: string; // Microchip PIC (PIC16 / PIC18)
  m8051: string; // Intel / Silicon Labs / STC 8051
  keyInsight: string;
}

const UNIVERSAL_SPECS: UniversalMcuSpec[] = [
  // 1. 코어 및 CPU 아키텍처
  {
    category: '코어 & 아키텍처',
    feature: 'CPU 코어 및 비트 수',
    avr: '8-bit AVR RISC (32개 범용 레지스터)',
    stm32: '32-bit ARM Cortex-M0 / M3 (Thumb-2)',
    pic: '8-bit PIC16 (기본) / PIC18 (확장 RISC)',
    m8051: '8-bit CISC (누산기 ACC, B 중심 복합명령어)',
    keyInsight: 'STM32는 32비트 고성능 연산 및 주소체계, AVR/PIC는 간결한 8비트 제어, 8051은 클래식 CISC'
  },
  {
    category: '코어 & 아키텍처',
    feature: '명령어 실행 주기 & MIPS',
    avr: '1사이클 대부분 명령 실행 (16~20 MIPS @ 16~20MHz)',
    stm32: '2~3단 파이프라인 (48~72 DMIPS @ 48~72MHz)',
    pic: '4클럭당 1명령어 (F_OSC / 4 = 16 MIPS @ 64MHz)',
    m8051: '클래식 12클럭 (최신 1T 코어는 1클럭당 1명령어)',
    keyInsight: 'AVR은 1클럭당 1명령어로 주파수 대비 순수 실행 효율이 8비트 중 최상급'
  },
  {
    category: '코어 & 아키텍처',
    feature: '메모리 모델 (Memory Architecture)',
    avr: 'Harvard 아키텍처 (Flash, SRAM 물리 분리, PROGMEM 필요)',
    stm32: 'Von Neumann 4GB 단일 평탄 주소 공간 (Linear Space)',
    pic: 'Modified Harvard (Bank Select Register; BSR 분할 관리)',
    m8051: '분리형 공간 (DATA 128B, IDATA 256B, XDATA 64KB, CODE)',
    keyInsight: '8051은 XDATA/CODE 접근 시 DPTR 포인터 관리 필요, STM32는 평탄한 단일 주소로 포인터 연산 가장 수월'
  },
  {
    category: '코어 & 아키텍처',
    feature: '인터럽트 컨트롤러 (NVIC vs 벡터)',
    avr: '고정 벡터 테이블, 플래그 클리어 시 자동 비활성화, 2레벨 우선순위',
    stm32: '하드웨어 NVIC (중첩 인터럽트, 최대 16단계 선점 우선순위)',
    pic: 'High / Low 2단계 우선순위 인터럽트 (PIC18)',
    m8051: '5~6개 고정 벡터, IP 레지스터 2레벨 우선순위',
    keyInsight: 'STM32의 NVIC는 초저지연 하드웨어 테일체이닝(Tail-chaining)과 중첩을 완벽 지원하여 실시간 처리에 최강'
  },

  // 2. 메모리 용량 및 대역폭
  {
    category: '메모리 & 용량',
    feature: '대표 제품 및 플래시 ROM',
    avr: 'ATmega328P(32KB), ATmega128(128KB), ATmega640(64KB)',
    stm32: 'STM32F030(32~64KB), STM32F072(128KB), STM32F103(64~128KB)',
    pic: 'PIC16F877A(14KB), PIC18F4550(32KB), PIC18F46K22(64KB)',
    m8051: 'AT89S52(8KB), STC8G1K(8KB), STC8A8K(64KB)',
    keyInsight: '전 제품군 모두 32~128KB 펌웨어 지원, STM32는 복잡한 RTOS/스택/통신 프로토콜 수용에 가장 유리'
  },
  {
    category: '메모리 & 용량',
    feature: '내부 SRAM 용량',
    avr: '2 KB (328P) ~ 4 KB (128) ~ 8 KB (640)',
    stm32: '4 KB ~ 16 KB (F030/F072) ~ 20 KB (F103)',
    pic: '368 B (16F) ~ 2 KB ~ 4 KB (PIC18)',
    m8051: '128 B (내부 표준) ~ 256 B (IDATA) + 외장 XDATA',
    keyInsight: '전통 8051 내부 RAM은 128~256바이트로 극소, AVR은 2~8KB로 8비트 중 넉넉하며 스택 오버플로우 위험 적음'
  },
  {
    category: '메모리 & 용량',
    feature: '내장 비휘발성 EEPROM',
    avr: '1 KB ~ 4 KB (바이트 단위 고내구성 100,000 W/E Cycles)',
    stm32: '일반 미탑재 (Flash 섹터 에뮬레이션 가상 라이브러리 사용)',
    pic: '256 B ~ 1 KB (하드웨어 EEPROM 내장, 1,000,000 W/E)',
    m8051: '전통 모델 미탑재 (외장 I2C 24C02 또는 최신 STC IAP 플래시)',
    keyInsight: 'AVR/PIC는 센서 캘리브레이션용 트루 EEPROM 내장으로 전원 차단 시 즉시 기록에 편리'
  },

  // 3. 전기적 특성 및 I/O
  {
    category: '전기적 특성 & I/O',
    feature: '동작 전압 범위 (VCC)',
    avr: '1.8V ~ 5.5V (5V 산업 노이즈 환경에 매우 강함)',
    stm32: '2.0V ~ 3.6V (기본 3.3V 전용, 일부 5V-Tolerant I/O 핀)',
    pic: '1.8V ~ 5.5V (고전압 노이즈 내성 우수)',
    m8051: '4.5V ~ 5.5V (클래식 5V), 최신 2.4V ~ 5.5V',
    keyInsight: '5V 산업용 센서/릴레이 직결은 AVR/PIC가 안전, 3.3V 최신 SPI/I2C 디지털 센서는 STM32가 레벨시프터 없이 직결'
  },
  {
    category: '전기적 특성 & I/O',
    feature: '핀당 싱크/소스 허용 전류 (Drive Current)',
    avr: '최대 20 ~ 40 mA (LED, 포토커플러, 릴레이 직접 드라이브)',
    stm32: '최대 8 ~ 25 mA (정격 8mA 권장, 초과 시 손상 주의)',
    pic: '최대 25 mA (양호한 출력 구동력)',
    m8051: '약 10 ~ 20 mA (준 양방향 포트, 내부 풀업 약함)',
    keyInsight: 'AVR은 핀당 40mA의 강력한 출력으로 외장 TR/FET 없이도 인디케이터나 부저 직접 구동 가능'
  },

  // 4. 주변장치 및 성능
  {
    category: '주변장치 & 성능',
    feature: 'DMA (Direct Memory Access)',
    avr: '미지원 (CPU 인터럽트/폴링 수동 레지스터 전송)',
    stm32: '지원 (5~7채널 DMA: ADC, USART, SPI 메모리 무부하 직결)',
    pic: '일부 상위 PIC18/PIC24만 지원 (기본 8비트는 미지원)',
    m8051: '미지원 (전통 아키텍처 한계)',
    keyInsight: 'STM32는 DMA 덕분에 CPU 개입률 0%로 고속 통신 버퍼링 및 연속 ADC 샘플링 수행'
  },
  {
    category: '주변장치 & 성능',
    feature: '내장 ADC 해상도 및 속도',
    avr: '10-bit SAR ADC (최대 15~76 kSPS, 200kHz ADC 클럭)',
    stm32: '12-bit SAR ADC (최대 1.0 ~ 2.0 MSPS 초고속 샘플링)',
    pic: '10-bit 또는 12-bit ADC (최대 100 kSPS)',
    m8051: '전통 모델 미탑재 (외장 ADC0804/0809 필요, 최신 10/12비트)',
    keyInsight: 'STM32는 12비트 1MSPS로 아날로그 오디오 분석, 모터 FOC 전류 피드백 루프에 압도적인 대역폭 제공'
  },
  {
    category: '주변장치 & 성능',
    feature: '고급 모터 제어 PWM',
    avr: 'Fast PWM, Phase Correct PWM (8/16비트)',
    stm32: '고급 제어 타이머 (TIM1: 6ch 보수 출력, Dead-time 삽입)',
    pic: 'CCP / ECCP 모듈 (풀 브리지/하프 브리지 PWM)',
    m8051: '소프트웨어 타이머 토글 또는 PCA(Programmable Counter Array)',
    keyInsight: 'STM32의 Dead-time 삽입 PWM은 BLDC/PMSM 3상 인버터 하이사이드/로우사이드 쇼트 방지에 필수 하드웨어'
  },

  // 5. 개발 환경 & 도구
  {
    category: '개발 생태계',
    feature: '컴파일러 & IDE 툴체인',
    avr: 'avr-gcc, Arduino IDE, Microchip Studio, PlatformIO',
    stm32: 'arm-none-eabi-gcc, STM32CubeIDE, Keil MDK, STM32CubeMX',
    pic: 'Microchip XC8 컴파일러, MPLAB X IDE, MCC 코드설정기',
    m8051: 'Keil C51, SDCC (Open Source Small Device C Compiler)',
    keyInsight: 'AVR은 아두이노 생태계로 진입장벽 최저, STM32는 GUI 핀/클럭 설정기(CubeMX)와 오픈 ARM GCC 지원'
  },
  {
    category: '개발 생태계',
    feature: '디버그 및 다운로드 인터페이스',
    avr: 'ISP (SPI 6핀: MISO/MOSI/SCK/RST), debugWIRE (단선), JTAG',
    stm32: 'SWD (단 2핀: SWDIO / SWCLK) via ST-LINK, JTAG',
    pic: 'ICSP (5핀: PGC, PGD, VPP, VDD, VSS) via PICkit / ICD',
    m8051: '전통 고전압 패러럴 ROM 롬라이터 또는 최신 UART ISP 부트로더',
    keyInsight: 'STM32 SWD는 단 2핀으로 실시간 변수 모니터링, 하드웨어 브레이크포인트를 제공하여 디버깅 생산성이 가장 높음'
  },
  {
    category: '개발 생태계',
    feature: '대표적인 양산 활용 분야',
    avr: '아두이노 센서 보드, 3D 프린터(Marlin), 산업용 PLC 릴레이 모듈',
    stm32: '드론 FC, 전동 킥보드/BLDC 인버터, 의료기기, 통신 게이트웨이',
    pic: '백색 가전(밥솥, 전자레인지, 세탁기), 자동차 전장 BCM 모듈',
    m8051: '초저가 적외선 리모컨, USB 키보드/마우스 컨트롤러, 스마트 전력량계',
    keyInsight: '가격과 신뢰성에 따라 가전은 PIC/8051, 쾌속 시제품 및 오픈소스는 AVR, 고성능 연산은 STM32'
  }
];

export const UniversalMcuComparisonTab: React.FC<Props> = ({ onSelectMCU }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeCodeExample, setActiveCodeExample] = useState<'gpio' | 'timer' | 'uart'>('gpio');
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);

  const categories = ['all', '코어 & 아키텍처', '메모리 & 용량', '전기적 특성 & I/O', '주변장치 & 성능', '개발 생태계'];

  const filteredSpecs = UNIVERSAL_SPECS.filter((row) => {
    const matchesCat = selectedCategory === 'all' || row.category === selectedCategory;
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      row.feature.toLowerCase().includes(q) ||
      row.avr.toLowerCase().includes(q) ||
      row.stm32.toLowerCase().includes(q) ||
      row.pic.toLowerCase().includes(q) ||
      row.m8051.toLowerCase().includes(q) ||
      row.keyInsight.toLowerCase().includes(q);

    return matchesCat && matchesSearch;
  });

  const exportUniversalCSV = () => {
    const header = ['카테고리', '사양 항목', 'AVR (ATmega)', 'STM32 (Cortex-M0/M3)', 'PIC (PIC16/18)', '8051 (Classic/1T)', '핵심 엔지니어링 인사이트'];
    const rows = UNIVERSAL_SPECS.map((r) => [
      `"${r.category}"`,
      `"${r.feature}"`,
      `"${r.avr}"`,
      `"${r.stm32}"`,
      `"${r.pic}"`,
      `"${r.m8051}"`,
      `"${r.keyInsight}"`
    ]);
    const csvContent = '\uFEFF' + [header.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'AVR_vs_STM32_vs_PIC_vs_8051_Comparison.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyCode = (code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeKey(key);
    setTimeout(() => setCopiedCodeKey(null), 2000);
  };

  // Code snippets comparison across the 4 MCU families
  const CODE_SNIPPETS = {
    gpio: {
      title: 'GPIO 핀 출력 설정 및 토글 (LED Blink 베어메탈 레지스터)',
      avr: `// === [AVR ATmega328P / 128 / 640] ===
#define F_CPU 16000000UL
#include <avr/io.h>
#include <util/delay.h>

int main(void) {
    // 1. PB5 (또는 특정 핀) 출력 방향 설정
    DDRB |= (1 << PB5);

    while (1) {
        // 2. PINB 토글 토글 트릭 (AVR 특유의 토글 레지스터)
        PINB |= (1 << PB5); 
        // 또는 PORTB ^= (1 << PB5);
        _delay_ms(500);
    }
}`,
      stm32: `// === [STM32F030 / STM32F103 (CMSIS LL/Register)] ===
#include "stm32f0xx.h"

int main(void) {
    // 1. GPIO 클럭 활성화 (AHB bus 클럭 인에이블 필수!)
    RCC->AHBENR |= RCC_AHBENR_GPIOCEN;

    // 2. PC13 범용 출력(01) 설정 (STM32F0: MODER 레지스터)
    GPIOC->MODER &= ~(3U << (13 * 2));
    GPIOC->MODER |=  (1U << (13 * 2));

    while (1) {
        // 3. 출력 데이터 레지스터 ODR 토글
        GPIOC->ODR ^= (1U << 13);
        
        // 딜레이 루프
        for (volatile int i = 0; i < 500000; i++);
    }
}`,
      pic: `// === [Microchip PIC18F4550 (XC8 컴파일러)] ===
#include <xc.h>
#define _XTAL_FREQ 20000000

void main(void) {
    // 1. TRIS 레지스터로 방향 설정 (0 = Output)
    TRISBbits.TRISB5 = 0;

    while (1) {
        // 2. LAT 레지스터를 통한 출력 래치 토글
        LATBbits.LATB5 = !LATBbits.LATB5;
        __delay_ms(500);
    }
}`,
      m8051: `// === [Intel / STC 8051 (Keil C51)] ===
#include <reg52.h>

// 8051 특유의 sbit 비트 주소 직접 선언
sbit LED_PIN = P1^0;

void delay_ms(unsigned int ms) {
    unsigned int i, j;
    for (i = 0; i < ms; i++)
        for (j = 0; j < 120; j++);
}

void main(void) {
    // 8051 포트는 준-양방향(Quasi-bidirectional)이므로 별도 DDR 불필요
    while (1) {
        LED_PIN = !LED_PIN; // 비트 반전 토글
        delay_ms(500);
    }
}`
    },

    timer: {
      title: '하드웨어 타이머 인터럽트 서비스 루틴 (ISR 선언 문법)',
      avr: `// === [AVR ATmega - avr-libc ISR 문법] ===
#include <avr/io.h>
#include <avr/interrupt.h>

// 타이머1 비교일치 A 인터럽트 핸들러
ISR(TIMER1_COMPA_vect) {
    PORTB ^= (1 << PB5); // LED 토글
}

void timer_init(void) {
    TCCR1B |= (1 << WGM12);  // CTC 모드
    OCR1A = 15624;           // 1초 주기 (16MHz / 1024)
    TIMSK1 |= (1 << OCIE1A); // 인터럽트 인에이블
    sei();                   // 글로벌 인터럽트 허용
}`,
      stm32: `// === [STM32 Cortex-M - NVIC 하드웨어 핸들러] ===
#include "stm32f0xx.h"

// Startup 어셈블리에 정의된 고정 벡터 함수 오버라이드
void TIM3_IRQHandler(void) {
    if (TIM3->SR & TIM_SR_UIF) {
        TIM3->SR &= ~TIM_SR_UIF; // 플래그 수동 클리어 필수!
        GPIOC->ODR ^= (1U << 13);
    }
}

void timer_init(void) {
    RCC->APB1ENR |= RCC_APB1ENR_TIM3EN;
    TIM3->PSC = 48000 - 1; // 1kHz 타이머 클럭 (48MHz / 48000)
    TIM3->ARR = 1000 - 1;  // 1초 주기
    TIM3->DIER |= TIM_DIER_UIE; // 갱신 인터럽트 허용
    NVIC_EnableIRQ(TIM3_IRQn);  // NVIC 코어 활성화
    TIM3->CR1 |= TIM_CR1_CEN;   // 카운터 시작
}`,
      pic: `// === [Microchip PIC - XC8 인터럽트 문법] ===
#include <xc.h>

// XC8 컴파일러 인터럽트 함수 키워드
void __interrupt() my_isr(void) {
    if (INTCONbits.TMR0IF) {
        INTCONbits.TMR0IF = 0; // 플래그 소프트웨어 클리어
        LATBbits.LATB5 = !LATBbits.LATB5;
    }
}

void timer_init(void) {
    T0CON = 0b00000111; // 1:256 프리스케일러
    INTCONbits.TMR0IE = 1;
    INTCONbits.GIE = 1; // 글로벌 인터럽트
    T0CONbits.TMR0ON = 1;
}`,
      m8051: `// === [Intel 8051 - Keil C51 interrupt 키워드] ===
#include <reg52.h>
sbit LED = P1^0;

// 'interrupt 1'은 8051 Timer0 인터럽트 벡터 번호 지정
void timer0_isr(void) interrupt 1 {
    TH0 = 0xFC; // 1ms 타이머 리로드 값
    TL0 = 0x66;
    LED = !LED;
}

void timer_init(void) {
    TMOD |= 0x01; // Timer0 Mode 1 (16비트)
    TH0 = 0xFC;
    TL0 = 0x66;
    ET0 = 1;      // Timer0 인터럽트 허용
    EA = 1;       // 글로벌 인터럽트 활성화
    TR0 = 1;      // 타이머 시작
}`
    },

    uart: {
      title: 'UART 시리얼 1바이트 송신 (Tx 레지스터 폴링)',
      avr: `// === [AVR ATmega USART0 Tx] ===
void UART_Transmit(uint8_t data) {
    // 송신 버퍼(UDR0)가 비어있는지(UDRE0 == 1) 대기
    while (!(UCSR0A & (1 << UDRE0)));
    UDR0 = data; // 전송 버퍼에 기록
}`,
      stm32: `// === [STM32 USART Tx] ===
void UART_Transmit(uint8_t data) {
    // STM32F0: ISR TXE 플래그 대기 (STM32F1: SR TXE)
    while (!(USART1->ISR & USART_ISR_TXE));
    USART1->TDR = data; // 송신 데이터 레지스터에 기록
}`,
      pic: `// === [Microchip PIC EUSART Tx] ===
void UART_Transmit(char data) {
    // TXIF (Transmit Interrupt Flag) 버퍼 빈 상태 확인
    while (!PIR1bits.TXIF);
    TXREG = data; // 송신 레지스터에 데이터 기록
}`,
      m8051: `// === [Intel 8051 UART Tx] ===
void UART_Transmit(char data) {
    SBUF = data; // 시리얼 버퍼에 직접 기록
    while (!TI); // 송신 완료 인터럽트 플래그(TI) 대기
    TI = 0;      // 플래그 수동 클리어 필수!
}`
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-2">
              <Cpu className="w-3.5 h-3.5" /> 4대 메이저 MCU 아키텍처 크로스 플랫폼 종합 분석
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              AVR (ATmega) vs STM32F vs Microchip PIC vs 8051 아키텍처 비교표
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              임베디드 하드웨어 개발 시 가장 빈번히 검토되는 4대 마이크로컨트롤러 가문(Family)의 CPU 코어,
              메모리 구조(Harvard vs Von Neumann), I/O 드라이브 능력, DMA/ADC, 툴체인 및 실제 C 레지스터 제어 코드를 정밀 대조합니다.
            </p>
          </div>
          <button
            onClick={exportUniversalCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition border border-slate-700 shadow-md shrink-0"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            4대 MCU 비교표 CSV 내보내기
          </button>
        </div>
      </div>

      {/* 4 Family Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* AVR Card */}
        <div className="bg-slate-900/70 border border-amber-500/40 rounded-2xl p-4 backdrop-blur shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-black text-amber-400 font-mono text-base">AVR (ATmega)</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono">8-bit RISC</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium mb-1">
              대표: ATmega328P • ATmega128 • ATmega640
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              1클럭당 1명령어 고효율 연산, 32개 범용 레지스터, 핀당 최대 40mA 강력한 구동력. 아두이노 생태계로 전 세계 시제품 및 양산에서 가장 직관적인 개발 속도 자랑.
            </p>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="text-amber-400">• 클럭: 16~20 MHz (16~20 MIPS)</div>
            <div>• 전압: 1.8V ~ 5.5V (5V 강세)</div>
            <div>• 특징: 1클럭 1명령어, EEPROM 내장</div>
            <div>• 툴: avr-gcc / Arduino / Microchip Studio</div>
          </div>
        </div>

        {/* STM32 Card */}
        <div className="bg-slate-900/70 border border-blue-500/40 rounded-2xl p-4 backdrop-blur shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-black text-blue-400 font-mono text-base">STM32 (Cortex-M)</span>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono">32-bit ARM</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium mb-1">
              대표: STM32F030 • STM32F072 • STM32F103
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              32비트 고속 연산, 다채널 하드웨어 DMA, 12비트 1MSPS 초고속 ADC, 단 2핀 SWD 디버깅 지원. 드론, 모터 FOC, 고성능 IoT 게이트웨이의 산업 표준.
            </p>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="text-blue-400">• 클럭: 48~72 MHz (48~72 DMIPS)</div>
            <div>• 전압: 2.0V ~ 3.6V (3.3V 표준)</div>
            <div>• 특징: 하드웨어 DMA, NVIC, 12bit ADC</div>
            <div>• 툴: STM32CubeIDE / Keil / SWD(ST-LINK)</div>
          </div>
        </div>

        {/* PIC Card */}
        <div className="bg-slate-900/70 border border-rose-500/40 rounded-2xl p-4 backdrop-blur shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-black text-rose-400 font-mono text-base">PIC (Microchip)</span>
              <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-mono">8/16-bit RISC</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium mb-1">
              대표: PIC16F877A • PIC18F4550 • PIC18F25K22
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              가전제품(세탁기, 밥솥, 에어컨) 및 자동차 전장에서 수십 년간 입증된 극한의 노이즈 내성, 고신뢰성 EEPROM 내장, 저비용 대량 양산의 최강자.
            </p>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="text-rose-400">• 클럭: 4클럭당 1명령어 (F_OSC/4)</div>
            <div>• 전압: 1.8V ~ 5.5V 광범위</div>
            <div>• 특징: 강력한 노이즈 내성, 고내구성 EEPROM</div>
            <div>• 툴: MPLAB X IDE / XC8 / PICkit</div>
          </div>
        </div>

        {/* 8051 Card */}
        <div className="bg-slate-900/70 border border-emerald-500/40 rounded-2xl p-4 backdrop-blur shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-black text-emerald-400 font-mono text-base">Intel / STC 8051</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">8-bit CISC</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium mb-1">
              대표: AT89S52 • STC8G • C8051F340
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              1980년대부터 이어진 임베디드 마이크로컨트롤러의 시조. 특유의 불리언(Boolean) 비트 연산 주소 체계와 칩당 몇백 원대의 극초저가 단가로 리모컨/키보드 등에 다수 탑재.
            </p>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="text-emerald-400">• 클럭: 12T (클래식) 또는 1T (초고속)</div>
            <div>• 전압: 전통 5V / 최신 2.4V ~ 5.5V</div>
            <div>• 특징: 비트 주소 지정 sbit, 초저가 BOM</div>
            <div>• 툴: Keil C51 / SDCC / STC-ISP</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur shadow-lg flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-indigo-400" /> 카테고리:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-xl transition-all border ${
                selectedCategory === cat
                  ? 'bg-indigo-500 text-white font-bold border-indigo-400 shadow-md shadow-indigo-500/20'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {cat === 'all' ? '전체 보기' : cat}
            </button>
          ))}
        </div>

        <div className="w-full md:w-72">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="사양 검색 (DMA, 전압, ADC, 툴체인...)"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Main 4-Way Comparison Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/70 shadow-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider">
              <th className="px-4 py-3.5 font-bold w-32">구분 카테고리</th>
              <th className="px-4 py-3.5 font-bold w-44">세부 사양 항목</th>
              <th className="px-4 py-3.5 font-bold bg-amber-500/10 text-amber-300 border-l border-r border-amber-500/20 w-56">
                AVR (ATmega)
              </th>
              <th className="px-4 py-3.5 font-bold bg-blue-500/10 text-blue-300 border-r border-blue-500/20 w-56">
                STM32 (Cortex-M0/M3)
              </th>
              <th className="px-4 py-3.5 font-bold bg-rose-500/10 text-rose-300 border-r border-rose-500/20 w-56">
                PIC (PIC16 / PIC18)
              </th>
              <th className="px-4 py-3.5 font-bold bg-emerald-500/10 text-emerald-300 border-r border-emerald-500/20 w-56">
                8051 (Classic / 1T)
              </th>
              <th className="px-4 py-3.5 font-bold text-slate-300">엔지니어링 선택 가이드</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
            {filteredSpecs.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
                <td className="px-4 py-3 text-slate-400 font-sans font-medium whitespace-nowrap">
                  {row.category}
                </td>
                <td className="px-4 py-3 font-bold text-white font-sans whitespace-nowrap">
                  {row.feature}
                </td>

                {/* AVR */}
                <td className="px-4 py-3 text-amber-300 bg-amber-500/5 border-l border-r border-slate-800/80 leading-relaxed">
                  {row.avr}
                </td>

                {/* STM32 */}
                <td className="px-4 py-3 text-blue-300 bg-blue-500/5 border-r border-slate-800/80 leading-relaxed">
                  {row.stm32}
                </td>

                {/* PIC */}
                <td className="px-4 py-3 text-rose-300 bg-rose-500/5 border-r border-slate-800/80 leading-relaxed">
                  {row.pic}
                </td>

                {/* 8051 */}
                <td className="px-4 py-3 text-emerald-300 bg-emerald-500/5 border-r border-slate-800/80 leading-relaxed">
                  {row.m8051}
                </td>

                {/* Insight */}
                <td className="px-4 py-3 text-slate-300 font-sans text-xs leading-relaxed">
                  💡 {row.keyInsight}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Interactive 4-Way C Code Snippet Comparison */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs text-indigo-400 font-mono font-bold mb-1">
              <Code2 className="w-4 h-4" /> BARE-METAL C CODE COMPARISON
            </div>
            <h3 className="text-base font-bold text-white">
              실전 펌웨어 C 언어 구현 코드 문법 비교: {CODE_SNIPPETS[activeCodeExample].title}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              동일한 하드웨어 동작을 수행하기 위해 4대 MCU 아키텍처별로 사용되는 레지스터 조작 문법의 차이를 비교합니다.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setActiveCodeExample('gpio')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeCodeExample === 'gpio'
                  ? 'bg-indigo-500 text-white font-bold shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1. GPIO 토글
            </button>
            <button
              onClick={() => setActiveCodeExample('timer')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeCodeExample === 'timer'
                  ? 'bg-indigo-500 text-white font-bold shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              2. 타이머 ISR
            </button>
            <button
              onClick={() => setActiveCodeExample('uart')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeCodeExample === 'uart'
                  ? 'bg-indigo-500 text-white font-bold shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              3. UART 송신
            </button>
          </div>
        </div>

        {/* 4-Column Code Box */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* AVR Code Box */}
          <div className="bg-slate-950 rounded-xl border border-amber-500/30 overflow-hidden flex flex-col">
            <div className="bg-slate-900/90 px-3.5 py-2 border-b border-amber-500/20 flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-amber-400">AVR (ATmega) C 코드</span>
              <button
                onClick={() => copyCode(CODE_SNIPPETS[activeCodeExample].avr, 'avr')}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition"
              >
                {copiedCodeKey === 'avr' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCodeKey === 'avr' ? '복사됨' : '복사'}
              </button>
            </div>
            <pre className="p-3.5 text-[11px] font-mono text-amber-200/90 leading-relaxed overflow-x-auto flex-1">
              <code>{CODE_SNIPPETS[activeCodeExample].avr}</code>
            </pre>
          </div>

          {/* STM32 Code Box */}
          <div className="bg-slate-950 rounded-xl border border-blue-500/30 overflow-hidden flex flex-col">
            <div className="bg-slate-900/90 px-3.5 py-2 border-b border-blue-500/20 flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-blue-400">STM32 (Cortex-M0/M3) C 코드</span>
              <button
                onClick={() => copyCode(CODE_SNIPPETS[activeCodeExample].stm32, 'stm32')}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition"
              >
                {copiedCodeKey === 'stm32' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCodeKey === 'stm32' ? '복사됨' : '복사'}
              </button>
            </div>
            <pre className="p-3.5 text-[11px] font-mono text-blue-200/90 leading-relaxed overflow-x-auto flex-1">
              <code>{CODE_SNIPPETS[activeCodeExample].stm32}</code>
            </pre>
          </div>

          {/* PIC Code Box */}
          <div className="bg-slate-950 rounded-xl border border-rose-500/30 overflow-hidden flex flex-col">
            <div className="bg-slate-900/90 px-3.5 py-2 border-b border-rose-500/20 flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-rose-400">Microchip PIC (XC8) C 코드</span>
              <button
                onClick={() => copyCode(CODE_SNIPPETS[activeCodeExample].pic, 'pic')}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition"
              >
                {copiedCodeKey === 'pic' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCodeKey === 'pic' ? '복사됨' : '복사'}
              </button>
            </div>
            <pre className="p-3.5 text-[11px] font-mono text-rose-200/90 leading-relaxed overflow-x-auto flex-1">
              <code>{CODE_SNIPPETS[activeCodeExample].pic}</code>
            </pre>
          </div>

          {/* 8051 Code Box */}
          <div className="bg-slate-950 rounded-xl border border-emerald-500/30 overflow-hidden flex flex-col">
            <div className="bg-slate-900/90 px-3.5 py-2 border-b border-emerald-500/20 flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-emerald-400">Intel / STC 8051 (Keil C51) C 코드</span>
              <button
                onClick={() => copyCode(CODE_SNIPPETS[activeCodeExample].m8051, 'm8051')}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition"
              >
                {copiedCodeKey === 'm8051' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCodeKey === 'm8051' ? '복사됨' : '복사'}
              </button>
            </div>
            <pre className="p-3.5 text-[11px] font-mono text-emerald-200/90 leading-relaxed overflow-x-auto flex-1">
              <code>{CODE_SNIPPETS[activeCodeExample].m8051}</code>
            </pre>
          </div>
        </div>
      </div>

      {/* Architectural Trade-off Summary */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-lg space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          4대 MCU 아키텍처별 하드웨어 선택 의사결정 전략 (Selection Strategy)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/30 space-y-1.5">
            <span className="font-bold text-amber-400 block text-sm">AVR을 선택해야 할 때:</span>
            <p className="text-slate-300 leading-relaxed">
              하드웨어 릴레이, 모터 드라이버, 5V 센서를 직접 다루며, 방대한 아두이노 라이브러리로 며칠 안에 프로토타입과 양산 보드를 완성해야 할 때 최고의 선택.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-blue-500/30 space-y-1.5">
            <span className="font-bold text-blue-400 block text-sm">STM32를 선택해야 할 때:</span>
            <p className="text-slate-300 leading-relaxed">
              32비트 고속 부동소수점 연산, DMA를 통한 무손실 고속 데이터 로깅, 12비트 초고속 ADC, FreeRTOS 실시간 운영체제가 필수적인 현대적 시스템에 필수.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-rose-500/30 space-y-1.5">
            <span className="font-bold text-rose-400 block text-sm">PIC를 선택해야 할 때:</span>
            <p className="text-slate-300 leading-relaxed">
              극도의 전기적 노이즈가 존재하는 공장 설비, 가전기기, 자동차 전장 부품에서 수십 년간 고장 없는 극한의 내구성과 저렴한 단가가 최우선일 때.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 space-y-1.5">
            <span className="font-bold text-emerald-400 block text-sm">8051을 선택해야 할 때:</span>
            <p className="text-slate-300 leading-relaxed">
              수십만~수백만 개 단위의 대량 양산에서 개당 100~300원대의 극단적인 BOM 원가 절감이 필요하며, 단순 스위치/리모컨 제어 로직을 구현할 때.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
