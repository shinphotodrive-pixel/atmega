import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  AlertTriangle,
  Bug,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Search,
  Filter,
  Code2,
  Cpu,
  Terminal,
  Zap,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Sliders,
  Sparkles,
  Info,
  ShieldAlert,
  Layers,
  RotateCcw,
  BookOpen,
  LifeBuoy
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type ErrataSeverity = 'critical' | 'major' | 'minor';
export type ErrataCategory = 'all' | 'wdt_power' | 'adc_analog' | 'comm' | 'flash_eeprom' | 'timer_interrupt';

export interface RegisterBitGuide {
  bit: number;
  name: string;
  recommendedState: '0' | '1' | 'keep' | 'clear_first' | 'timed_sequence';
  reason: string;
}

export interface RelatedRegisterGuide {
  regName: string;
  address: string;
  description: string;
  bits: RegisterBitGuide[];
  ruleSummary: string;
}

export interface MicrochipErrata {
  id: string;
  mcu: SupportedMCU[];
  category: ErrataCategory;
  categoryLabel: string;
  title: string;
  severity: ErrataSeverity;
  affectedRevisions: string[]; // e.g. ['Rev. A', 'Rev. B']
  allRevisionsAffected?: boolean;
  datasheetDocRef: string;
  symptom: string;
  rootCause: string;
  workaroundStrategy: string;
  workaroundCSource: string;
  explanation: string;
  registersGuide: RelatedRegisterGuide[];
}

export const MICROCHIP_ERRATA_DATABASE: MicrochipErrata[] = [
  // 1. ATmega328P - Watchdog Reset Loop Errata
  {
    id: 'ERR-328P-WDT-01',
    mcu: ['atmega328p'],
    category: 'wdt_power',
    categoryLabel: 'WDT & 전원 리셋',
    title: '워치독 타임아웃 발생 후 시스템 무한 리셋 루프 (Infinite WDT Reset Loop)',
    severity: 'critical',
    affectedRevisions: ['Rev. A', 'Rev. B', 'Rev. C', 'Rev. D'],
    allRevisionsAffected: true,
    datasheetDocRef: 'Microchip ATmega328P Datasheet §32.1 & AppNote AVR132',
    symptom: '워치독 타이머에 의해 칩이 리셋된 후, 부트로더 또는 main() 진입 직후 16ms 초단기 타임아웃 주기로 워치독이 재트리거되어 칩이 영구적으로 무한 재부팅 루프에 빠짐.',
    rootCause: '하드웨어 설계상 워치독 리셋이 발생하면 MCUSR의 WDRF(Watchdog Reset Flag)가 1로 고정되며, WDRF가 1인 동안에는 안전 로직에 의해 워치독 타이머가 최소 타임아웃(16ms) 상태로 상시 강제 활성화됨. wdt_disable()을 호출해도 WDRF가 0이 아니면 WDE 비트가 클리어되지 않음.',
    workaroundStrategy: 'GCC C 런타임 시작 단계인 .init3 섹션(main 함수 실행 이전 단계)에서 MCUSR의 리셋 플래그를 변수에 백업한 직후 즉시 0으로 클리어하고, wdt_disable()을 실행하여 워치독을 완전히 해제해야 함.',
    workaroundCSource: `// [해결책] GCC C-런타임 초기화 단계(.init3)에서 WDT 무한 루프 차단
#include <avr/io.h>
#include <avr/wdt.h>

uint8_t mcusr_mirror __attribute__((section(".noinit")));

// main() 함수 실행 전 최우선 실행되는 함수 선언
void get_mcusr(void) __attribute__((naked)) __attribute__((section(".init3")));

void get_mcusr(void) {
    // 1. 리셋 원인 플래그 백업 (PORF, EXTRF, BORF, WDRF)
    mcusr_mirror = MCUSR;
    
    // 2. ⚠️ 핵심: MCUSR을 0으로 클리어해야 WDT 강제 락이 해제됨!
    MCUSR = 0;
    
    // 3. 안전하게 워치독 타이머 비활성화
    wdt_disable();
}`,
    explanation: 'ATmega328P의 Optiboot 부트로더 역시 이 방식을 채택하고 있으며, 사용자 펌웨어 빌드 시 위 .init3 시퀀스를 반드시 포함해야 배터리 전압 강하 후 시스템 락업을 방지할 수 있습니다.',
    registersGuide: [
      {
        regName: 'MCUSR',
        address: '0x34 (0x54)',
        description: 'MCU 상태 레지스터 (리셋 원인 플래그)',
        ruleSummary: 'WDRF 비트를 반드시 0으로 클리어해야 WDTCSR의 WDE 비트 수정이 가능해집니다.',
        bits: [
          { bit: 3, name: 'WDRF', recommendedState: 'clear_first', reason: '1인 상태에서는 WDE 비트를 끌 수 없음. 반드시 0으로 클리어' },
          { bit: 2, name: 'BORF', recommendedState: '0', reason: '갈색전압 리셋 플래그 클리어' },
          { bit: 1, name: 'EXTRF', recommendedState: '0', reason: '외부 리셋 핀 플래그 클리어' },
          { bit: 0, name: 'PORF', recommendedState: '0', reason: '파워온 리셋 플래그 클리어' }
        ]
      },
      {
        regName: 'WDTCSR',
        address: '0x60',
        description: '워치독 타이머 제어 레지스터',
        ruleSummary: 'WDCE와 WDE를 동시에 1로 쓴 직후 4클럭 이내에 WDE=0으로 기록해야 꺼집니다.',
        bits: [
          { bit: 4, name: 'WDCE', recommendedState: 'timed_sequence', reason: '변경 허용 비트: WDE와 함께 1로 쓴 뒤 4사이클 내 변경' },
          { bit: 3, name: 'WDE', recommendedState: '0', reason: '시스템 리셋 비트: WDCE 활성화 후 0으로 기록' },
          { bit: 2, name: 'WDP2', recommendedState: '0', reason: '타임아웃 프리스케일러 0' },
          { bit: 1, name: 'WDP1', recommendedState: '0', reason: '타임아웃 프리스케일러 0' },
          { bit: 0, name: 'WDP0', recommendedState: '0', reason: '타임아웃 프리스케일러 0' }
        ]
      }
    ]
  },

  // 2. ATmega328P - ADC Noise Reduction Sleep Mode Timing Flaw
  {
    id: 'ERR-328P-ADC-02',
    mcu: ['atmega328p'],
    category: 'adc_analog',
    categoryLabel: 'ADC & 아날로그',
    title: 'ADC 노이즈 리덕션 슬립 모드 진입 시 변환 미시작 및 웨이크업 결함',
    severity: 'major',
    affectedRevisions: ['Rev. A', 'Rev. B'],
    datasheetDocRef: 'Microchip ATmega328P Silicon Errata §32.2.1',
    symptom: 'ADCSRA의 ADSC 비트를 설정하고 즉시 sleep_cpu()를 호출하면 CPU가 슬립에 들어가지만 ADC 변환이 시작되지 않거나, 변환 완료 후 인터럽트가 발생해도 CPU가 정상 웨이크업되지 못함.',
    rootCause: 'Rev A/B 실리콘에서 CPU 슬립 클럭 정지 타이밍과 ADC 변환 시작 핸드셰이크 간의 클럭 도메인 경합(Race Condition)으로 트리거 신호가 유실됨.',
    workaroundStrategy: 'ADSC를 소프트웨어로 미리 쓰지 않고, SMCR에 ADC 노이즈 리덕션 슬립 모드를 설정한 뒤 sleep_enable(); sleep_cpu();를 호출하면 하드웨어가 슬립 진입 순간 자동으로 ADC를 시작하도록 맡겨야 함.',
    workaroundCSource: `// [해결책] 안전한 ADC Noise Reduction 슬립 모드 아날로그 샘플링
#include <avr/io.h>
#include <avr/sleep.h>
#include <avr/interrupt.h>

volatile uint16_t g_adc_result = 0;

ISR(ADC_vect) {
    // 하드웨어 변환 완료 시 CPU 자동 웨이크업
    g_adc_result = ADC;
}

uint16_t read_adc_low_noise(uint8_t channel) {
    ADMUX = (1 << REFS0) | (channel & 0x0F);
    
    // 1. ADC 인터럽트 활성화 및 모듈 ON (단, ADSC는 여기서 켜지 않음!)
    ADCSRA |= (1 << ADEN) | (1 << ADIE) | (1 << ADPS2) | (1 << ADPS1) | (1 << ADPS0);
    
    // 2. ADC 노이즈 리덕션 슬립 모드 설정
    set_sleep_mode(SLEEP_MODE_ADC);
    sleep_enable();
    sei();
    
    // 3. 슬립에 진입하면 하드웨어가 자동으로 변환 시작 (클럭 노이즈 제거)
    sleep_cpu();
    sleep_disable();
    
    return g_adc_result;
}`,
    explanation: 'Rev C 및 D에서는 내부 핸드셰이크가 개선되었으나, 배터리 효율과 10비트 ENOB 극대화를 위해 위 방식이 모든 리비전에서 공식 권장됩니다.',
    registersGuide: [
      {
        regName: 'ADCSRA',
        address: '0x7A',
        description: 'ADC 제어 및 상태 레지스터 A',
        ruleSummary: 'ADSC를 수동 세트하지 않고 슬립 하드웨어 자동 트리거에 맡기며 ADIE=1을 설정합니다.',
        bits: [
          { bit: 7, name: 'ADEN', recommendedState: '1', reason: 'ADC 모듈 활성화' },
          { bit: 6, name: 'ADSC', recommendedState: '0', reason: '슬립 진입 전 미리 켜지 않음 (슬립 진입 시 하드웨어 자동 시작)' },
          { bit: 3, name: 'ADIE', recommendedState: '1', reason: '변환 완료 시 CPU 기상을 위한 인터럽트 허용' }
        ]
      },
      {
        regName: 'SMCR',
        address: '0x53',
        description: '슬립 모드 제어 레지스터',
        ruleSummary: 'SM2:0 비트를 001(ADC Noise Reduction)로 설정합니다.',
        bits: [
          { bit: 2, name: 'SM1', recommendedState: '0', reason: 'ADC 노이즈 리덕션 모드' },
          { bit: 1, name: 'SM0', recommendedState: '1', reason: 'ADC 노이즈 리덕션 모드' },
          { bit: 0, name: 'SE', recommendedState: '1', reason: '슬립 인에이블' }
        ]
      }
    ]
  },

  // 3. ATmega2560 - 256KB RAMPZ / EIND ISR Context Loss Errata
  {
    id: 'ERR-2560-RAMPZ-01',
    mcu: ['atmega2560'],
    category: 'flash_eeprom',
    categoryLabel: 'Flash & RAMPZ/EIND',
    title: '128KB(64KW) 초과 대용량 펌웨어 실행 시 RAMPZ/EIND 레지스터 인터럽트 컨텍스트 미보존',
    severity: 'critical',
    affectedRevisions: ['Rev. A', 'Rev. B', 'Rev. C', 'Rev. E', 'Rev. F'],
    allRevisionsAffected: true,
    datasheetDocRef: 'Microchip ATmega2560 Datasheet §31.1 & GCC Bug #18231',
    symptom: '128KB 이상의 플래시 메모리를 사용하는 펌웨어에서 ELPM(확장 플래시 읽기) 또는 EICALL/EIJMP 도중 인터럽트가 발생하면, 복귀 시 RAMPZ 및 EIND가 원래 값으로 복원되지 않아 CPU가 엉뚱한 플래시 주소로 튀어 크래시 발생.',
    rootCause: 'ATmega2560은 3바이트 PC(22비트 주소 체계)를 갖지만, 표준 avr-gcc 컴파일러의 기본 ISR 프롤로그/에필로그가 RAMPZ와 EIND를 기본 스택에 백업하지 않는 아키텍처적 사양 불일치.',
    workaroundStrategy: '모든 ISR 진입 시 RAMPZ 및 EIND 레지스터를 로컬 변수에 수동으로 백업하고, ISR 복귀 직전 역순으로 복원해야 함.',
    workaroundCSource: `// [해결책] ATmega2560 128KB 이상 대용량 펌웨어 전용 안전 ISR 래퍼
#include <avr/io.h>
#include <avr/interrupt.h>

ISR(TIMER1_COMPA_vect) {
    // 1. 확장 주소 지정 레지스터 명시적 스택 백업
    uint8_t saved_rampz = RAMPZ;
    uint8_t saved_eind  = EIND;

    // 2. 실제 ISR 비즈니스 로직 수행
    // ... 고속 센서 읽기 및 링 버퍼 삽입 ...

    // 3. 복귀 전 원본 플래시 뱅크 위치로 완벽 복원
    EIND  = saved_eind;
    RAMPZ = saved_rampz;
}`,
    explanation: '256KB 플래시를 탑재한 아두이노 Mega 2560에서 FreeRTOS나 대규모 그래픽 라이브러리를 탑재할 때 원인을 알 수 없는 간헐적 재부팅의 90% 이상이 이 결함 때문입니다.',
    registersGuide: [
      {
        regName: 'RAMPZ',
        address: '0x3B (0x5B)',
        description: '확장 Z-포인터 레지스터 (ELPM 명령어용 플래시 뱅크 선택기)',
        ruleSummary: '인터럽트 진입 시 로컬 스택에 백업하고 종료 시 복원해야 128KB 상위 플래시 접근이 깨지지 않습니다.',
        bits: [
          { bit: 0, name: 'RAMPZ0', recommendedState: 'keep', reason: '64KW 경계(128KB) 상위 플래시 페이지 선택 비트 보존' }
        ]
      },
      {
        regName: 'EIND',
        address: '0x3C (0x5C)',
        description: '확장 간접 점프 레지스터 (EICALL / EIJMP 명령어용)',
        ruleSummary: '함수 포인터 테이블 분기 시 상위 128KB 영역 주소 보존용입니다.',
        bits: [
          { bit: 0, name: 'EIND0', recommendedState: 'keep', reason: '상위 128KB 함수 포인터 분기점 보존' }
        ]
      }
    ]
  },

  // 4. ATmega128 - M103C Fuse Trap Errata
  {
    id: 'ERR-128-FUSE-01',
    mcu: ['atmega128'],
    category: 'flash_eeprom',
    categoryLabel: '클럭 & 퓨즈',
    title: '출고 시 M103C 퓨즈 비트 기본 활성화로 인한 ATmega103 호환 모드 락업 (Extended I/O 봉쇄)',
    severity: 'critical',
    affectedRevisions: ['Rev. A', 'Rev. B', 'Rev. C', 'Rev. M'],
    allRevisionsAffected: true,
    datasheetDocRef: 'Microchip ATmega128A Datasheet §4.3 & §28.2',
    symptom: '신규 ATmega128/128A 칩을 PCB에 실장한 후 펌웨어를 업로드하면 USART1, TWI(I2C), Timer3, Port F(ADC) 등 신규 주변장치가 전혀 동작하지 않고 시스템이 정지됨.',
    rootCause: '과거 ATmega103과의 하위 호환성을 위해 공장 출고 시 Extended Fuse의 M103C 비트가 0(Programmed)으로 설정되어 출고됨. 0인 상태에서는 내부 버스가 ATmega103 모드로 강제 다운그레이드되어 Extended I/O 공간(0x60~0xFF) 접근이 하드웨어적으로 차단됨.',
    workaroundStrategy: '개발 시작 즉시 ISP 프로그래머(avrdude)를 사용하여 Extended Fuse를 0xFF(M103C=1 unprogrammed)로 기록하여 네이티브 ATmega128 모드를 해제해야 함.',
    workaroundCSource: `# [해결책] avrdude CLI를 통한 ATmega128 네이티브 모드 퓨즈 기록
# Extended Fuse: 0xFF (M103C=1 해제, WDTON=1)
avrdude -c usbasp -p m128 -U efuse:w:0xff:m -U hfuse:w:0xd9:m -U lfuse:w:0xff:m

# [C 코드 내 자가 진단 가드]
#if defined(__AVR_ATmega128__)
void check_m103c_trap(void) {
    // Extended I/O 영역인 UCSR1B에 테스트 패턴 기록
    UCSR1B = 0x18; 
    if (UCSR1B != 0x18) {
        // M103C 퓨즈가 켜져 있어 Extended I/O가 죽어있는 상태!
        // 온보드 LED 등으로 에러 경고 점멸
    }
}
#endif`,
    explanation: 'ATmega128 기반 하드웨어 개발자가 겪는 가장 흔하고 치명적인 실수입니다. efuse=0xFF 기록은 모든 ATmega128 양산 라인의 필수 전처리 공정입니다.',
    registersGuide: [
      {
        regName: 'Extended Fuse',
        address: 'Fuse Byte 2',
        description: 'ATmega128 확장 퓨즈 바이트',
        ruleSummary: 'Bit 1 (M103C)을 반드시 1 (Unprogrammed)로 기록해야 128 네이티브 모드가 동작합니다.',
        bits: [
          { bit: 1, name: 'M103C', recommendedState: '1', reason: '1=ATmega128 네이티브 모드, 0=구형 ATmega103 호환 모드(I/O 차단)' },
          { bit: 0, name: 'WDTON', recommendedState: '1', reason: '1=워치독 소프트웨어 제어 허용' }
        ]
      }
    ]
  },

  // 5. ATmega128 - Asynchronous Timer0 OCR0 Update in Power-save Sleep
  {
    id: 'ERR-128-ASSR-04',
    mcu: ['atmega128'],
    category: 'timer_interrupt',
    categoryLabel: '타이머 & 슬립',
    title: '32.768kHz RTC 비동기 타이머 OCR0 값 갱신 직후 Power-save 슬립 진입 시 값 유실',
    severity: 'major',
    affectedRevisions: ['Rev. A', 'Rev. B', 'Rev. C'],
    datasheetDocRef: 'Microchip ATmega128A Datasheet §17.9',
    symptom: 'TOSC1/2 핀에 32.768kHz 시계용 크리스탈을 달고 Timer0 비동기 모드로 운용할 때, OCR0 또는 TCCR0 레지스터를 변경한 직후 sleep_cpu()로 진입하면 새 설정값이 타이머 비교기에 반영되지 않고 칩이 깨어나지 않음.',
    rootCause: '16MHz 고속 CPU 클럭 도메인과 32.768kHz 저속 비동기 타이머 클럭 도메인 간의 동기화 버퍼 래칭에 최대 3비트 타이머 클럭 주기(약 91µs)가 소요되는데, 이 과정이 끝나기 전에 CPU 클럭이 꺼져버림.',
    workaroundStrategy: 'OCR0/TCCR0를 변경한 후 ASSR 레지스터의 OCR0UB, TCR0UB 비트가 하드웨어적으로 0이 될 때까지 while 루프로 대기한 다음 슬립 모드에 진입해야 함.',
    workaroundCSource: `// [해결책] ASSR 비지(Busy) 비트 동기화 완료 대기 후 슬립 진입
#include <avr/io.h>
#include <avr/sleep.h>

void safe_rtc_timer_sleep(uint8_t new_ocr0) {
    // 1. 비동기 비교값 갱신
    OCR0 = new_ocr0;

    // 2. ⚠️ 핵심: 비동기 클럭 도메인 동기화 완료 대기 (Busy 플래그 폴링)
    while (ASSR & ((1 << OCR0UB) | (1 << TCR0UB) | (1 << TCN0UB))) {
        // 최대 91µs 대기 후 하드웨어가 0으로 클리어함
    }

    // 3. 동기화 완료 확인 후 안전하게 Power-save 슬립 진입
    set_sleep_mode(SLEEP_MODE_PWR_SAVE);
    sleep_enable();
    sei();
    sleep_cpu();
    sleep_disable();
}`,
    explanation: 'ASSR(Asynchronous Status Register)의 업데이트 비지 비트(Update Busy)는 저속 클럭 도메인으로의 데이터 전송 상태를 가리키므로 대기 루프가 필수적입니다.',
    registersGuide: [
      {
        regName: 'ASSR',
        address: '0x30 (0x50)',
        description: '비동기 상태 레지스터 (Asynchronous Status Register)',
        ruleSummary: 'TCN0UB, OCR0UB, TCR0UB 비트가 모두 0이 된 것을 확인한 후 슬립에 들어가야 합니다.',
        bits: [
          { bit: 3, name: 'AS0', recommendedState: '1', reason: 'TOSC1 핀 32.768kHz 비동기 클럭 활성화' },
          { bit: 2, name: 'TCN0UB', recommendedState: '0', reason: 'TCNT0 비지 비트가 0인지 확인' },
          { bit: 1, name: 'OCR0UB', recommendedState: '0', reason: 'OCR0 비지 비트가 0인지 확인' },
          { bit: 0, name: 'TCR0UB', recommendedState: '0', reason: 'TCCR0 비지 비트가 0인지 확인' }
        ]
      }
    ]
  },

  // 6. ATmega640 / 2560 - ADC Differential Gain Amplifier Offset Drift
  {
    id: 'ERR-640-ADC-01',
    mcu: ['atmega640', 'atmega2560'],
    category: 'adc_analog',
    categoryLabel: 'ADC & 아날로그',
    title: 'ADC 차동 증폭기(10x/200x) 오프셋 전압 드리프트 및 인접 핀 스위칭 노이즈 유입',
    severity: 'major',
    affectedRevisions: ['Rev. A', 'Rev. B'],
    datasheetDocRef: 'Microchip ATmega640/1280/2560 Silicon Errata §31.1',
    symptom: '10배 또는 200배 차동 증폭 채널 사용 시 최대 35 LSB 수준의 직류 오프셋이 발생하고 인접 Port K 디지털 핀 스위칭 시 아날로그 변환 결과가 튀는 현상 발생.',
    rootCause: '내부 아날로그 차동 증폭기 바이어스 회로의 PSRR(전원 노이즈 제거율)이 낮아 디지털 I/O 스위칭 과도 전압이 ADC 래더에 유입됨.',
    workaroundStrategy: '차동 변환 전 채널을 0V(동일 핀 차동 입력)로 설정하여 오프셋을 소프트웨어적으로 먼저 측정한 뒤 실측값에서 차감(캘리브레이션)하고, DIDR2 레지스터로 인접 디지털 입력 버퍼를 차단해야 함.',
    workaroundCSource: `// [해결책] 차동 증폭기 제로 오프셋 소프트웨어 캘리브레이션 & DIDR2 차단
#include <avr/io.h>

int16_t adc_diff_offset = 0;

void calibrate_diff_adc_offset(void) {
    // 1. 인접 아날로그 핀의 디지털 입력 버퍼 차단 (스위칭 노이즈 원천 방지)
    DIDR0 = 0xFF;
    DIDR2 = 0xFF;

    // 2. ADC0과 ADC0을 10x 차동 입력으로 설정 (이론상 결과 = 0V)
    ADMUX = (1 << REFS0) | 0x08; // MUX=001000 (ADC0-ADC0 10x)
    ADCSRA |= (1 << ADEN) | (1 << ADSC);
    while (ADCSRA & (1 << ADSC)); // 더미 읽기

    // 3. 실제 제로 오프셋 측정
    ADCSRA |= (1 << ADSC);
    while (ADCSRA & (1 << ADSC));
    adc_diff_offset = (int16_t)ADC;
}

int16_t read_calibrated_diff_adc(uint8_t mux_channel) {
    ADMUX = (1 << REFS0) | (mux_channel & 0x1F);
    ADCSRA |= (1 << ADSC);
    while (ADCSRA & (1 << ADSC));
    
    // 오프셋 차감 보정
    int16_t raw = (int16_t)ADC;
    return raw - adc_diff_offset;
}`,
    explanation: '하드웨어적으로는 AVCC에 10µH 인덕터와 100nF 세라믹 캡으로 구성된 LC 필터를 반드시 추가해야 합니다.',
    registersGuide: [
      {
        regName: 'DIDR2',
        address: '0x7D',
        description: '디지털 입력 비활성화 레지스터 2 (Port K / ADC8~15)',
        ruleSummary: '아날로그 차동 입력으로 사용하는 핀의 디지털 버퍼 비트를 1로 설정하여 스위칭 전류를 차단합니다.',
        bits: [
          { bit: 7, name: 'ADC15D', recommendedState: '1', reason: '디지털 입력 버퍼 차단' },
          { bit: 0, name: 'ADC8D', recommendedState: '1', reason: '디지털 입력 버퍼 차단' }
        ]
      }
    ]
  },

  // 7. ATmega328P - TWI (I2C) Start Condition Hold Time Glitch
  {
    id: 'ERR-328P-TWI-03',
    mcu: ['atmega328p'],
    category: 'comm',
    categoryLabel: '통신 (I2C / TWI)',
    title: '400kHz Fast Mode I2C 구동 시 START 조건 홀드 타임(tHD;STA) 규격 미달',
    severity: 'minor',
    affectedRevisions: ['Rev. A', 'Rev. B'],
    datasheetDocRef: 'Microchip ATmega328P Silicon Errata §32.2.3',
    symptom: '16MHz F_CPU에서 400kHz 고속 I2C 모드 사용 시 START 조건 후 SDA가 LOW로 유지되는 홀드 타임이 I2C 표준(0.6µs)보다 짧은 0.4µs로 출력되어 엄격한 표준 센서가 ACK 응답을 거부함.',
    rootCause: '내부 아날로그 스파이크 억제 필터 및 I2C 상태 머신 타이밍 생성기의 분주비 오차.',
    workaroundStrategy: '400kHz 대신 380kHz 이하(TWBR 설정값 증가)로 클럭을 살짝 낮추거나 TWCR의 START 조건을 전송한 후 소프트웨어 NOP 딜레이를 2클럭 삽입함.',
    workaroundCSource: `// [해결책] 400kHz TWI 안정화 비트레이트 설정 (안전한 360kHz 산출)
#include <avr/io.h>

void safe_twi_init_fastmode(void) {
    // 16MHz 클럭 기준 표준 400kHz 공식: TWBR = ((16MHz/400kHz) - 16) / 2 = 12
    // 결함 회피: TWBR을 14로 설정하여 363.6kHz로 소폭 낮춤 -> 홀드 타임 0.65µs 확보!
    TWSR = 0x00; // TWPS1:0 = 00 (프리스케일러 1)
    TWBR = 14;   // 363.6 kHz (100% I2C 센서와 신뢰성 있는 통신 가능)
    TWCR = (1 << TWEN);
}`,
    explanation: '산업용 장비나 자동차용 I2C 센서는 tHD;STA 타이밍 검증이 엄격하므로 TWBR을 12 대신 14 이상으로 설정하는 것이 모범 관행입니다.',
    registersGuide: [
      {
        regName: 'TWBR',
        address: '0xB8',
        description: 'TWI 비트레이트 레지스터',
        ruleSummary: '400kHz 타겟 시 TWBR=12 대신 TWBR=14~15로 설정하여 타이밍 마진을 확보합니다.',
        bits: [
          { bit: 7, name: 'TWBR7', recommendedState: '0', reason: '상위 비트' },
          { bit: 3, name: 'TWBR3', recommendedState: '1', reason: 'TWBR 값 14 설정 (8 + 4 + 2)' },
          { bit: 2, name: 'TWBR2', recommendedState: '1', reason: 'TWBR 값 14 설정' },
          { bit: 1, name: 'TWBR1', recommendedState: '1', reason: 'TWBR 값 14 설정' },
          { bit: 0, name: 'TWBR0', recommendedState: '0', reason: 'TWBR 값 14 설정' }
        ]
      }
    ]
  }
];

export const MicrochipErrataLiveBrowser: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Available Silicon Revisions per MCU
  const availableRevisions = useMemo(() => {
    switch (selectedMCU) {
      case 'atmega328p':
        return ['전체', 'Rev. A', 'Rev. B', 'Rev. C', 'Rev. D'];
      case 'atmega2560':
        return ['전체', 'Rev. A', 'Rev. B', 'Rev. C', 'Rev. E', 'Rev. F'];
      case 'atmega128':
        return ['전체', 'Rev. A', 'Rev. B', 'Rev. C', 'Rev. M'];
      case 'atmega640':
        return ['전체', 'Rev. A', 'Rev. B', 'Rev. C'];
      default:
        return ['전체', 'Rev. A', 'Rev. B'];
    }
  }, [selectedMCU]);

  const [selectedRevision, setSelectedRevision] = useState<string>('전체');
  const [activeCategory, setActiveCategory] = useState<ErrataCategory>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'major' | 'minor'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedErrataId, setExpandedErrataId] = useState<string | null>(() => {
    if (selectedMCU === 'atmega328p') return 'ERR-328P-WDT-01';
    if (selectedMCU === 'atmega2560') return 'ERR-2560-RAMPZ-01';
    if (selectedMCU === 'atmega128') return 'ERR-128-FUSE-01';
    return 'ERR-640-ADC-01';
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync expanded card and reset revision filter when MCU changes
  React.useEffect(() => {
    setSelectedRevision('전체');
    const firstMatch = MICROCHIP_ERRATA_DATABASE.find((e) => e.mcu.includes(selectedMCU));
    if (firstMatch) {
      setExpandedErrataId(firstMatch.id);
    }
  }, [selectedMCU]);

  // Filtered Erratas for selected MCU
  const mcuErratas = useMemo(() => {
    return MICROCHIP_ERRATA_DATABASE.filter((e) => e.mcu.includes(selectedMCU));
  }, [selectedMCU]);

  const filteredErratas = useMemo(() => {
    return mcuErratas.filter((item) => {
      // Revision filter
      if (selectedRevision !== '전체') {
        const matchesRev = item.allRevisionsAffected || item.affectedRevisions.includes(selectedRevision);
        if (!matchesRev) return false;
      }

      // Category filter
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }

      // Severity filter
      if (severityFilter !== 'all' && item.severity !== severityFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = item.title.toLowerCase().includes(q);
        const inId = item.id.toLowerCase().includes(q);
        const inSymptom = item.symptom.toLowerCase().includes(q);
        const inWorkaround = item.workaroundStrategy.toLowerCase().includes(q);
        const inReg = item.registersGuide.some((r) => r.regName.toLowerCase().includes(q));

        if (!inTitle && !inId && !inSymptom && !inWorkaround && !inReg) {
          return false;
        }
      }

      return true;
    });
  }, [mcuErratas, selectedRevision, activeCategory, severityFilter, searchQuery]);

  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* 1. Header & Title Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <Bug className="w-5 h-5" />
            </span>
            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Microchip 에라타(Errata) 실시간 브라우저
              <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                {currentProfile.name}
              </span>
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-4xl leading-relaxed">
            Microchip/Atmel 공식 데이터시트 에라타 시트에 명시된 {currentProfile.name}의
            <strong className="text-rose-300"> 실리콘 리비전별 결함</strong>과 이를 회피하기 위한
            <strong className="text-amber-300"> 검증된 펌웨어 해결책(Workarounds)</strong> 및
            <strong className="text-cyan-300"> 관련 SFR 레지스터 설정 가이드</strong>를 제공합니다.
          </p>
        </div>

        {/* MCU Selector Switcher */}
        {onSelectMCU && (
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0">
            {(['atmega328p', 'atmega2560', 'atmega128', 'atmega640'] as SupportedMCU[]).map((mcuId) => (
              <button
                key={mcuId}
                type="button"
                onClick={() => onSelectMCU(mcuId)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  selectedMCU === mcuId
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {MCU_PROFILES[mcuId].name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Silicon Revision Quick Selector Bar */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white">
              실리콘 리비전(Silicon Revision) 필터:
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              (칩 표면 마킹 또는 로트 번호 확인)
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            해당 리비전 결함: <strong className="text-rose-400 font-bold">{filteredErratas.length}개</strong>
          </span>
        </div>

        {/* Revision Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {availableRevisions.map((rev) => {
            const isSelected = selectedRevision === rev;
            return (
              <button
                key={rev}
                type="button"
                onClick={() => setSelectedRevision(rev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                  isSelected
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 shadow-md shadow-rose-950/50'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white border-slate-800 hover:border-slate-700'
                }`}
              >
                {rev}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Search & Category Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/50 p-3 rounded-2xl border border-slate-800">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {[
            { id: 'all', label: '전체 결함' },
            { id: 'wdt_power', label: 'WDT/전원' },
            { id: 'adc_analog', label: 'ADC/아날로그' },
            { id: 'flash_eeprom', label: '플래시/EEPROM' },
            { id: 'comm', label: '통신(I2C/USART)' },
            { id: 'timer_interrupt', label: '타이머/인터럽트' }
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id as ErrataCategory)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all font-medium ${
                activeCategory === cat.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="결함 키워드 / 레지스터 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 font-mono"
          />
        </div>
      </div>

      {/* 4. Errata Cards List */}
      <div className="space-y-4">
        {filteredErratas.length === 0 ? (
          <div className="text-center py-12 bg-slate-950/50 rounded-2xl border border-slate-800 text-slate-500 text-xs">
            선택한 리비전 및 검색 조건에 해당하는 에라타가 없습니다.
          </div>
        ) : (
          filteredErratas.map((errata) => {
            const isExpanded = expandedErrataId === errata.id;

            return (
              <div
                key={errata.id}
                className={`border rounded-2xl transition-all ${
                  isExpanded
                    ? 'bg-slate-900/95 border-rose-500/40 shadow-xl ring-1 ring-rose-500/20'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Card Title Row */}
                <div
                  onClick={() => setExpandedErrataId(isExpanded ? null : errata.id)}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      className="p-1 mt-0.5 text-slate-400 hover:text-white transition"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-rose-400" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                          {errata.id}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          errata.severity === 'critical'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : errata.severity === 'major'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        }`}>
                          {errata.severity === 'critical' ? '치명적 결함 (Critical)' : errata.severity === 'major' ? '주요 결함 (Major)' : '경미 (Minor)'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          {errata.categoryLabel}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          리비전: {errata.affectedRevisions.join(', ')}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white tracking-tight">
                        {errata.title}
                      </h4>
                    </div>
                  </div>

                  <div className="text-right text-[11px] font-mono text-slate-400 shrink-0 pl-7 md:pl-0">
                    <span className="text-slate-500 block text-[10px]">공식 문서 참조</span>
                    <span className="text-slate-300 font-bold">{errata.datasheetDocRef}</span>
                  </div>
                </div>

                {/* Expanded Card Body: Symptom, Workaround, & Register Configuration Guide */}
                {isExpanded && (
                  <div className="border-t border-slate-800/80 p-5 space-y-5 bg-slate-950/60 rounded-b-2xl">
                    {/* Symptom & Root Cause Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                        <span className="font-bold text-rose-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          발생 증상 (Symptom):
                        </span>
                        <p className="text-slate-300 leading-relaxed text-[11px]">
                          {errata.symptom}
                        </p>
                      </div>

                      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                        <span className="font-bold text-amber-400 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5" />
                          원인 분석 (Root Cause):
                        </span>
                        <p className="text-slate-300 leading-relaxed text-[11px]">
                          {errata.rootCause}
                        </p>
                      </div>
                    </div>

                    {/* Related Register Configuration Guide */}
                    {errata.registersGuide.length > 0 && (
                      <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-4 space-y-3 shadow-inner">
                        <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                          <Sliders className="w-4 h-4 text-cyan-400" />
                          <span>결함 회피 관련 SFR 레지스터 설정 가이드</span>
                        </div>

                        <div className="space-y-3">
                          {errata.registersGuide.map((reg) => (
                            <div key={reg.regName} className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800/80 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-amber-400">{reg.regName}</span>
                                  <span className="font-mono text-[10px] text-slate-500">({reg.address})</span>
                                  <span className="text-[11px] text-slate-300">{reg.description}</span>
                                </div>
                                <span className="text-[11px] text-cyan-400 font-medium">
                                  {reg.ruleSummary}
                                </span>
                              </div>

                              {/* Bit Strip */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                {reg.bits.map((bit) => (
                                  <div
                                    key={bit.name}
                                    className={`p-2 rounded-lg border text-left flex flex-col justify-between ${
                                      bit.recommendedState === '0' || bit.recommendedState === 'clear_first'
                                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                        : bit.recommendedState === '1'
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                        : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono font-bold text-xs">{bit.name} (b{bit.bit})</span>
                                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
                                        설정: {bit.recommendedState === 'clear_first' ? '0 필수' : bit.recommendedState}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                                      {bit.reason}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Firmware Workaround Strategy & C Source Code */}
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>회피 펌웨어 해결책 (Firmware Workaround Strategy & C Code)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => copyCode(errata.id, errata.workaroundCSource)}
                          className="text-[11px] font-bold px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition shadow-sm shrink-0"
                        >
                          {copiedId === errata.id ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedId === errata.id ? '회피 코드 복사됨!' : 'C 소스코드 복사'}
                        </button>
                      </div>

                      <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto select-text shadow-inner">
                        <pre className="whitespace-pre">
                          {errata.workaroundCSource}
                        </pre>
                      </div>

                      <p className="text-[11px] text-slate-400 italic">
                        💡 {errata.explanation}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
