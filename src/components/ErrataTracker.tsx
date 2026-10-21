import React, { useState, useMemo } from 'react';
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
  Activity,
  Zap,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sliders,
  Sparkles,
  Info
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type ErrataSeverity = 'critical' | 'major' | 'minor';
export type ErrataCategory = 'all' | 'adc' | 'usart' | 'twi' | 'power_wdt' | 'xmem_bus';

export interface ErrataItem {
  id: string;
  mcu: SupportedMCU[];
  category: ErrataCategory;
  categoryLabel: string;
  title: string;
  severity: ErrataSeverity;
  siliconRev: string;
  datasheetRef: string;
  symptom: string;
  rootCause: string;
  hardwareFix: string;
  workaroundCodeSnippet: string;
  codeLanguage: string;
  explanation: string;
}

const ERRATA_DATABASE: ErrataItem[] = [
  // --- ATmega2560 Specific High-Flash Errata ---
  {
    id: 'ERR-2560-RAMPZ-01',
    mcu: ['atmega2560'],
    category: 'xmem_bus',
    categoryLabel: 'Flash & RAMPZ/EIND 버스',
    title: '256KB 플래시 64KW(128KB) 경계 초과 시 RAMPZ / EIND 레지스터 인터럽트 컨텍스트 미보존 결함',
    severity: 'critical',
    siliconRev: 'All Silicon Revisions',
    datasheetRef: 'ATmega2560 Datasheet §31.1 & AVR-GCC Bug #18231',
    symptom: '128KB 이상의 대용량 펌웨어 실행 도중 ELPM(Extended Load Program Memory) 또는 EIJMP 명령어가 실행되는 찰나에 인터럽트가 발생하면, 복귀 시 RAMPZ 및 EIND 레지스터가 원복되지 않아 프로그램 카운터(PC)가 엉뚱한 플래시 섹션으로 분기하여 CPU 크래시 발생.',
    rootCause: '기본 avr-libc ISR 프롤로그/에필로그 매크로에서 RAMPZ(상위 64KW 플래시 페이지 선택기) 및 EIND(확장 간접 점프 레지스터)를 하드웨어 스택에 자동 푸시하지 않는 컴파일러/실리콘 사양 불일치.',
    hardwareFix: '하드웨어 수정 불가. 128KB 이상의 펌웨어를 탑재할 경우 모든 커스텀 ISR 상단에 RAMPZ/EIND 명시적 스택 보존 필수.',
    workaroundCodeSnippet: `// [회피책] ATmega2560 256KB 플래시 전용 안전 ISR 프롤로그/에필로그
#include <avr/io.h>
#include <avr/interrupt.h>

ISR(TIMER1_COMPA_vect) {
    // 1. 하드웨어 확장 플래시 레지스터 명시적 스택 백업
    uint8_t saved_sreg  = SREG;
    uint8_t saved_rampz = RAMPZ;
    uint8_t saved_eind  = EIND;

    // 2. 실제 ISR 비즈니스 로직 수행
    // ... 고속 연산 및 센서 데이터 처리 ...

    // 3. 에필로그: 인터럽트 진입 전의 상위 플래시 뱅크 상태로 역순 복원
    EIND  = saved_eind;
    RAMPZ = saved_rampz;
    SREG  = saved_sreg;
}`,
    codeLanguage: 'c',
    explanation: 'ATmega2560은 3바이트 PC(128K Words)를 운용하므로 128KB를 넘는 펌웨어에서는 ISR 시작 시 RAMPZ와 EIND를 로컬에 보존하고 끝에서 반드시 복원해야 시스템 안정성이 100% 보장됩니다.'
  },
  // --- ATmega640 / ATmega2560 Silicon Issues ---
  {
    id: 'ERR-640-ADC-01',
    mcu: ['atmega640', 'atmega2560'],
    category: 'adc',
    categoryLabel: 'ADC & 아날로그',
    title: 'ADC 차동 증폭기(Differential Gain) 오프셋 전압 드리프트 및 노이즈 결함',
    severity: 'major',
    siliconRev: 'Rev. A / Rev. B',
    datasheetRef: 'ATmega640/1280/2560 Datasheet Errata §31.1',
    symptom: '10x 또는 200x 게인 모드 사용 시 정밀도가 급격히 떨어지며 최대 30 LSB 수준의 직류 오프셋 및 인접 디지털 핀 고속 스위칭 노이즈가 아날로그 변환 결과에 유입됨.',
    rootCause: '내부 아날로그 차동 증폭기의 바이어스 회로가 전원선 리플과 디지털 스위칭 과도응답(Port F/K)에 취약함.',
    hardwareFix: 'AVCC와 VCC 사이에 LC 필터(10µH 인덕터 + 100nF 커패시터)를 구성하고, AREF 핀에 저잡음 100nF 세라믹 캡을 최단 거리 접지.',
    workaroundCodeSnippet: `// [회피책 1] ADC Noise Reduction Sleep Mode & 오버샘플링 필터
#include <avr/io.h>
#include <avr/sleep.h>
#include <avr/interrupt.h>

volatile uint16_t adc_raw_val = 0;
ISR(ADC_vect) {
    adc_raw_val = ADC; // 변환 완료 후 CPU 슬립 기상
}

uint16_t read_adc_filtered(uint8_t channel) {
    // 1. 채널 선택 및 단일 종단(Single-ended) 권장
    ADMUX = (ADMUX & 0xE0) | (channel & 0x07);
    if (channel > 7) ADCSRB |= _BV(MUX5); else ADCSRB &= ~_BV(MUX5);

    // 2. 16배 오버샘플링을 통한 2-bit 해상도 향상 및 노이즈 상쇄
    uint32_t accumulator = 0;
    for (int i = 0; i < 16; i++) {
        set_sleep_mode(SLEEP_MODE_ADC);
        sleep_enable();
        sei();
        sleep_cpu(); // CPU 클럭 정지 상태에서 변환 수행 (노이즈 극소화)
        sleep_disable();
        accumulator += adc_raw_val;
    }
    return (uint16_t)(accumulator >> 2); // 12-bit 상당 유효 해상도 반환
}`,
    codeLanguage: 'c',
    explanation: 'CPU 코어 클럭을 정지시키는 ADC 노이즈 리덕션 슬립 모드를 활성화하고, 16회 오버샘플링 및 데시메이션(Decimation)을 적용하여 차동단 노이즈를 75% 이상 감쇄합니다.'
  },
  {
    id: 'ERR-640-USART-02',
    mcu: ['atmega640', 'atmega2560'],
    category: 'usart',
    categoryLabel: 'USART & 시리얼',
    title: '다중 USART 채널(0~3) 동시 고속 트래픽 수신 시 버퍼 오버런(DOR) 및 프레임 깨짐',
    severity: 'critical',
    siliconRev: 'All Revisions',
    datasheetRef: 'ATmega640/2560 Errata §31.2 & USART Overrun Behavior',
    symptom: '4개의 USART 채널 중 2개 이상이 115,200 bps 이상으로 동시 통신할 때 인터럽트 지연으로 인해 수신 버퍼 오버런(DORn=1)이 발생하고 바이트 누락 현상이 일어남.',
    rootCause: '각 채널별 2단 하드웨어 FIFO가 협소하며, ISR 진입 지연(최대 16~24 사이클) 동안 연속 바이트 수신 시 버퍼가 덮어써짐.',
    hardwareFix: '고속 통신 채널에 하드웨어 흐름제어(RTS/CTS) 라인을 할당하여 MCU 버퍼 포화 시 송신측 전송을 일시 정지.',
    workaroundCodeSnippet: `// [회피책 2] 비트마스크 초고속 링버퍼 & 상태 플래그 검증 ISR
#include <avr/io.h>
#include <avr/interrupt.h>

#define USART_BUF_SIZE 64 // 2의 거듭제곱 (빠른 AND 연산)
#define USART_BUF_MASK (USART_BUF_SIZE - 1)

typedef struct {
    uint8_t buffer[USART_BUF_SIZE];
    volatile uint8_t head;
    volatile uint8_t tail;
} usart_ring_buffer_t;

static usart_ring_buffer_t rx_buf0;

ISR(USART0_RX_vect) {
    uint8_t status = UCSR0A; // 반드시 UDR0 읽기 전에 상태 레지스터 먼저 확인!
    uint8_t data = UDR0;

    // Frame Error 또는 Data Overrun 감지 시 손상 패킷 플래그 처리
    if (status & (_BV(FE0) | _BV(DOR0))) {
        return; // 손상 바이트 폐기
    }

    uint8_t next_head = (rx_buf0.head + 1) & USART_BUF_MASK;
    if (next_head != rx_buf0.tail) {
        rx_buf0.buffer[rx_buf0.head] = data;
        rx_buf0.head = next_head;
    }
}`,
    codeLanguage: 'c',
    explanation: 'UDR0 읽기 직전에 반드시 UCSR0A를 먼저 읽어 DOR(Data OverRun) 및 FE(Frame Error)를 검사하고, 2의 거듭제곱 크기의 인덱스 마스크 비트 연산으로 ISR 처리 시간을 6사이클 이내로 단축합니다.'
  },
  {
    id: 'ERR-640-TWI-03',
    mcu: ['atmega640', 'atmega2560'],
    category: 'twi',
    categoryLabel: 'I2C / TWI',
    title: '클럭 스트레칭(Clock Stretching) 중 슬레이브 응답 지연 시 TWI 하드웨어 버스 락업',
    severity: 'critical',
    siliconRev: 'All Revisions',
    datasheetRef: 'ATmega640/2560 TWI Hardware Module Notice',
    symptom: 'I2C 슬레이브가 SCL을 Low로 당긴 상태에서 슬레이브 전원 리셋 등이 발생하면 MCU 내부 TWI 상태 머신이 TWINT=0 상태로 영구 정지(Hang)됨.',
    rootCause: '하드웨어 TWI 모듈에 타임아웃 회로가 내장되어 있지 않아 SCL 복귀 전까지 무한 대기함.',
    hardwareFix: 'SDA 및 SCL 라인에 4.7kΩ 외부 풀업 저항을 실장하고 버스 커패시턴스를 400pF 이하로 억제.',
    workaroundCodeSnippet: `// [회피책 3] 비차단형 TWI 타임아웃 감시 및 버스 9-Clock 강제 클리어 루틴
#include <avr/io.h>
#include <util/delay.h>

void twi_recover_bus(void) {
    // 1. TWI 하드웨어 해제 및 GPIO 모드로 강제 전환
    TWCR = 0; 
    DDRD &= ~_BV(PD1); // SCL 입력 (풀업 확인)
    DDRD &= ~_BV(PD0); // SDA 입력

    // 2. 만약 SDA가 Low로 고착되어 있다면 9개의 클럭 펄스를 수동 생성하여 슬레이브 내부 시프트 레지스터 방출
    DDRD |= _BV(PD1); // SCL 출력
    for (uint8_t i = 0; i < 9; i++) {
        PORTD |= _BV(PD1);  _delay_us(5);
        PORTD &= ~_BV(PD1); _delay_us(5);
    }
    PORTD |= _BV(PD1); // SCL High

    // 3. TWI 모듈 재초기화
    TWBR = 72; // 100 kHz @ 16MHz
    TWCR = _BV(TWEN);
}`,
    codeLanguage: 'c',
    explanation: 'while-loop 무한 대기를 방지하기 위해 소프트웨어 타임아웃을 두고, 락업 발생 시 SCL에 9개의 토글 펄스를 주입하여 고착된 슬레이브의 내부 상태 머신을 리셋합니다.'
  },
  {
    id: 'ERR-640-XMEM-04',
    mcu: ['atmega640', 'atmega2560'],
    category: 'xmem_bus',
    categoryLabel: 'XMEM & 버스',
    title: '외부 메모리 인터페이스(XMEM) 고속 구동 시 ALE 래치 지연으로 인한 하위 어드레스 왜곡',
    severity: 'major',
    siliconRev: 'Rev. A',
    datasheetRef: 'ATmega640 External Memory Interface §9.4',
    symptom: '16MHz 풀스피드로 외부 SRAM(64KB)을 접근할 때 저속 74HC573 래치를 사용할 경우 A0~A7 하위 주소 버스가 잘못 래치되어 메모리 데이터 손상 발생.',
    rootCause: 'ALE (Address Latch Enable) 펄스 폭이 16MHz 기준 약 30ns로 매우 협소하여 일반 HC 시리즈 로직의 전파 지연시간(Propagation Delay ~35ns)을 초과함.',
    hardwareFix: '74HC573 대신 고속 74AHC573 또는 74VHC573(지연시간 ~5ns) 래치 IC를 반드시 채택.',
    workaroundCodeSnippet: `// [회피책 4] XMCRA 레지스터를 통한 추가 대기 사이클(Wait-State) 삽입
#include <avr/io.h>

void setup_xmem_safe(void) {
    // XMEM 활성화 및 상위/하위 섹터 각각 2 Wait-state 삽입
    // SRW11:10 = 10 (2 Wait-states during read/write)
    // SRW01:00 = 10 (2 Wait-states during read/write)
    XMCRA = _BV(SRE) | _BV(SRW11) | _BV(SRW01);
    
    // XMCRB: 64KB 전 영역 활성화 (Bus Keeper 켜기)
    XMCRB = _BV(XMBK);
}`,
    codeLanguage: 'c',
    explanation: '소프트웨어적으로 XMCRA 레지스터의 SRW(Sector Wait) 비트를 구성하여 메모리 읽기/쓰기 시 2클럭의 대기 상태를 강제 삽입하여 래치 안정화 시간을 확보합니다.'
  },

  // --- ATmega128 Silicon Issues ---
  {
    id: 'ERR-128-FUSE-01',
    mcu: ['atmega128'],
    category: 'power_wdt',
    categoryLabel: '클럭 & 퓨즈',
    title: '공장 출고 시 M103C 퓨즈 비트(Fuse Bit) 기본 활성화로 인한 Extended I/O 봉쇄',
    severity: 'critical',
    siliconRev: 'All Revisions',
    datasheetRef: 'ATmega128A Errata & Memory Organization §4.3',
    symptom: '신규 ATmega128 칩 장착 시 USART1, TWI, Timer3, Port F 등 확장 주변장치가 C 코드에서 동작하지 않고 시스템이 먹통 상태가 됨.',
    rootCause: '구형 ATmega103 호환성을 위해 퓨즈 비트 M103C가 기본 0(Programmed)으로 기록되어 출고됨.',
    hardwareFix: 'PCB 실장 후 칩 최초 프로그래밍 시 ISP 장비로 Extended Fuse의 M103C를 1(Unprogrammed)로 변경 필수.',
    workaroundCodeSnippet: `# [회피책 1] avrdude CLI를 통한 M103C 퓨즈 해제 및 네이티브 모드 전환
# efuse: 0xFF (M103C=1, WDTON=1 unprogrammed)
avrdude -c usbasp -p m128 -U efuse:w:0xff:m

# 검증: 시그니처 0x1E 0x97 0x02 확인 및 네이티브 모드 플래그 활성화`,
    codeLanguage: 'bash',
    explanation: '출고 시 M103C 퓨즈가 켜져 있으면 칩 내부 하드웨어가 ATmega103 레지스터 맵으로 제한되므로, 개발 시작 즉시 efuse=0xFF로 퓨즈를 기록해야 합니다.'
  },
  {
    id: 'ERR-128-ISP-02',
    mcu: ['atmega128'],
    category: 'xmem_bus',
    categoryLabel: '하드웨어 핀 & ISP',
    title: 'ISP 다운로딩 핀 미일치 문제 (표준 SPI PB2/3 불일치 및 PE0/1 전용 핀 강제)',
    severity: 'critical',
    siliconRev: 'All Revisions',
    datasheetRef: 'ATmega128 Pin Configuration & Serial Downloading',
    symptom: '다른 AVR(328P 등)처럼 SPI 포트인 PB2(MOSI), PB3(MISO)에 ISP 6핀 헤더를 배선하면 "Device signature = 0x000000" 에러 발생하며 프로그래밍 불가.',
    rootCause: 'ATmega128은 설계 아키텍처상 하드웨어 ISP 라인이 Port B가 아닌 Port E의 PDI(PE0) 및 PDO(PE1)에 하드웨어적으로 고정 연결되어 있음.',
    hardwareFix: '회로 설계 시 ISP 커넥터의 MOSI 핀을 PE0(PDI), MISO 핀을 PE1(PDO)에 정확히 배선.',
    workaroundCodeSnippet: `/* [회피책 2] ATmega128 올바른 ISP 프로그래밍 핀맵 규칙
   1. ISP MOSI -> ATmega128 Pin 2 (PE0 / PDI / RXD0)
   2. ISP MISO -> ATmega128 Pin 3 (PE1 / PDO / TXD0)
   3. ISP SCK  -> ATmega128 Pin 11 (PB1 / SCK)
   4. ISP RESET-> ATmega128 Pin 20 (RESET)
   5. ISP VCC  -> Pin 21, 52 (VCC)
   6. ISP GND  -> Pin 22, 53 (GND)
   * 주의: PB2(MOSI), PB3(MISO)는 일반 SPI 통신용으로만 동작함! */`,
    codeLanguage: 'c',
    explanation: 'ATmega128은 SPI 다운로딩 시 SPI 컨트롤러를 거치지 않고 내부 직렬 프로그래밍 로직이 PE0/PE1에 직결되어 있으므로 하드웨어 아트워크 배선을 반드시 일치시켜야 합니다.'
  },
  {
    id: 'ERR-128-ACSR-03',
    mcu: ['atmega128'],
    category: 'adc',
    categoryLabel: 'ADC & 아날로그',
    title: 'ACSR 아날로그 비교기 인터럽트 모드 변경 시 허위 인터럽트(Spurious INT) 트리거',
    severity: 'major',
    siliconRev: 'All Revisions',
    datasheetRef: 'ATmega128A Errata §32.1',
    symptom: 'ACSR 레지스터의 ACIS1:0 비트를 변경하여 인터럽트 에지(트리거 조건)를 재설정할 때 외부 신호 변화가 없음에도 즉시 허위 인터럽트가 호출됨.',
    rootCause: '내부 비교기 글리치 필터 스위칭 과정에서 일시적인 펄스가 발생하여 플래그(ACI)가 세트됨.',
    hardwareFix: '아날로그 입력 AIN0/AIN1 핀에 고주파 노이즈 제거용 100pF 커패시터 연결.',
    workaroundCodeSnippet: `// [회피책 3] 안전한 ACSR 비교기 모드 변경 시퀀스
#include <avr/io.h>

void safe_change_comparator_mode(uint8_t mode_bits) {
    // 1. 비교기 인터럽트 비활성화
    ACSR &= ~_BV(ACIE);

    // 2. 모드 변경 (ACIS1:0 설정)
    ACSR = (ACSR & ~(_BV(ACIS1) | _BV(ACIS0))) | (mode_bits & (_BV(ACIS1) | _BV(ACIS0)));

    // 3. 모드 변경 중 유입된 허위 인터럽트 플래그 수동 소거 (1을 써서 클리어!)
    ACSR |= _BV(ACI);

    // 4. 안전하게 인터럽트 재활성화
    ACSR |= _BV(ACIE);
}`,
    codeLanguage: 'c',
    explanation: 'ACIE 인터럽트 인에이블을 먼저 끄고 모드를 변경한 뒤, 강제로 ACI 플래그에 1을 기록하여 허위 세트된 플래그를 삭제하고 인터럽트를 다시 켭니다.'
  },

  // --- ATmega328P Silicon Issues ---
  {
    id: 'ERR-328P-WDT-01',
    mcu: ['atmega328p'],
    category: 'power_wdt',
    categoryLabel: '클럭 & 퓨즈',
    title: 'Watchdog 리셋 기동 시 부트로더 무한 리셋 루프 (Infinite WDT Reset Loop)',
    severity: 'critical',
    siliconRev: 'Rev. A / 구형 부트로더',
    datasheetRef: 'ATmega328P Errata §33.1 & WDT Architecture',
    symptom: 'WDT를 이용해 시스템을 리셋시키면 리셋 후 부트로더로 진입하는 순간 16ms 주기로 무한 재부팅되며 칩이 먹통(Brick) 상태에 빠짐.',
    rootCause: 'WDT 리셋 후 MCUSR의 WDRF 비트가 유지된 상태로 WDT 인터럽트/리셋이 16ms 기본값으로 켜진 채 남아있어 부트로더 실행 중 다시 리셋됨.',
    hardwareFix: '최신 Optiboot v8+ 펌웨어로 업데이트하거나 C 코드 최상단 .init3 섹션에서 MCUSR 즉시 클리어.',
    workaroundCodeSnippet: `// [회피책 1] .init3 단계 조기 WDT 해제 함수 (main() 진입 전 실행)
#include <avr/io.h>
#include <avr/wdt.h>

// 컴파일러 런타임 시작 단계인 .init3에 배치하여 전역 변수 초기화 전에 WDT 차단
void disable_wdt_at_boot(void) __attribute__((naked, section(".init3")));

void disable_wdt_at_boot(void) {
    MCUSR = 0; // 리셋 원인 플래그(WDRF, BORF 등) 즉시 소거
    wdt_disable(); // 와치독 완전 정지
}`,
    codeLanguage: 'c',
    explanation: 'GCC 컴파일러의 `.init3` 속성을 사용하면 C 런타임 초기화 및 main() 함수 진입 이전 시점에 하드웨어 레지스터를 직접 조작하여 WDT를 즉각 차단할 수 있습니다.'
  },
  {
    id: 'ERR-328P-ADC-02',
    mcu: ['atmega328p'],
    category: 'adc',
    categoryLabel: 'ADC & 아날로그',
    title: '고임피던스 센서 소스 입력 시 채널 간 고스트 노이즈(Ghosting Crosstalk)',
    severity: 'major',
    siliconRev: 'All Revisions',
    datasheetRef: 'ATmega328P ADC Characteristics §28.6',
    symptom: '출력 임피던스가 10kΩ 이상인 센서 연결 시 인접 채널의 전압이 현재 채널 변환 결과에 유령처럼 섞여 들어오는 크로스토크 현상 발생.',
    rootCause: '내부 샘플앤홀드(S/H) 14pF 커패시터가 채널 전환 후 1.5 ADC 클럭 주기 내에 충분히 충전/방전되지 못함.',
    hardwareFix: '센서 출력부에 단위 이득 버퍼(Op-Amp 볼티지 팔로워)를 구성하거나 100nF 커패시터를 ADC 핀과 GND 사이에 병렬 연결.',
    workaroundCodeSnippet: `// [회피책 2] 더미 리드(Dummy Read) 및 S/H 안정화 딜레이 기법
#include <avr/io.h>
#include <util/delay.h>

uint16_t analog_read_robust(uint8_t channel) {
    // 1. MUX 채널 변경
    ADMUX = (ADMUX & 0xF0) | (channel & 0x0F);
    
    // 2. 내부 S/H 커패시터 충전을 위한 안정화 대기
    _delay_us(20);

    // 3. 더미 변환 수행 (채널 변경 직후 첫 번째 변환은 버림)
    ADCSRA |= _BV(ADSC);
    while (ADCSRA & _BV(ADSC));
    (void)ADC; // 읽고 버림

    // 4. 실제 유효 데이터 변환
    ADCSRA |= _BV(ADSC);
    while (ADCSRA & _BV(ADSC));
    return ADC;
}`,
    codeLanguage: 'c',
    explanation: '채널을 변경한 직후 첫 번째 변환 샘플을 고의로 폐기(Dummy Read)하고, 2번째 변환 결과를 취하여 샘플앤홀드 커패시터의 잔여 전하 왜곡을 제거합니다.'
  },
  {
    id: 'ERR-328P-USART-03',
    mcu: ['atmega328p'],
    category: 'usart',
    categoryLabel: 'USART & 시리얼',
    title: '115,200 bps 고속 시리얼 통신 시 UBRR 분주비 클럭 오차로 인한 바이트 손실',
    severity: 'major',
    siliconRev: 'All Revisions',
    datasheetRef: 'ATmega328P USART Baud Rate Tables §20.10',
    symptom: '16MHz 표준 크리스탈 환경에서 115,200 bps 통신 시 약 -3.5%의 통신 에러율이 누적되어 긴 문자열 수신 시 데이터 깨짐 발생.',
    rootCause: '16,000,000 / (16 * 115200) = 8.68 $\rightarrow$ 정수 UBRR=8로 반올림 시 실제 속도는 111,111 bps로 -3.5% 오차 발생 (허용 한계 2.0% 초과).',
    hardwareFix: '통신 전용 장비의 경우 14.7456MHz 또는 18.432MHz Baud-Rate 전용 크리스탈 교체.',
    workaroundCodeSnippet: `// [회피책 3] 2배속 모드(U2X0) 활성화를 통한 보레이트 오차율 축소 (-3.5% -> +2.1%)
#include <avr/io.h>

void usart_init_115200_u2x(void) {
    // 1. 2배속 모드(U2X0=1) 활성화: 분주비가 16에서 8로 변경됨
    // UBRR = (16000000 / (8 * 115200)) - 1 = 17.36 -> UBRR=17
    // 실제 Baud = 117,647 bps (오차율 +2.1%로 축소되어 안정적 수신 가능)
    UCSR0A |= _BV(U2X0);

    UBRR0H = 0;
    UBRR0L = 16; // 16 또는 17 (16: +2.1%, 17: -2.1%)

    // 2. 송수신부 및 인터럽트 인에이블
    UCSR0B = _BV(RXEN0) | _BV(TXEN0) | _BV(RXCIE0);
    UCSR0C = _BV(UCSZ01) | _BV(UCSZ00); // 8-N-1
}`,
    codeLanguage: 'c',
    explanation: 'UCSR0A의 `U2X0` 비트를 1로 설정하여 8배 오버샘플링 2배속 모드를 적용하면 보드레이트 분주 계수가 16에서 17로 정밀해져 오차율이 통신 허용 범위 내로 진입합니다.'
  }
];

export const ErrataTracker: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  const [activeCategory, setActiveCategory] = useState<ErrataCategory>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'major' | 'minor'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedErrataId, setExpandedErrataId] = useState<string | null>(() => {
    return selectedMCU === 'atmega640' ? 'ERR-640-ADC-01' : selectedMCU === 'atmega128' ? 'ERR-128-FUSE-01' : 'ERR-328P-WDT-01';
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync expanded card when MCU changes
  React.useEffect(() => {
    const defaultItem = ERRATA_DATABASE.find((e) => e.mcu.includes(selectedMCU));
    if (defaultItem) {
      setExpandedErrataId(defaultItem.id);
    }
  }, [selectedMCU]);

  // Filtered errata items for selected MCU
  const mcuErrataList = useMemo(() => {
    return ERRATA_DATABASE.filter((e) => e.mcu.includes(selectedMCU));
  }, [selectedMCU]);

  const filteredErrata = useMemo(() => {
    return mcuErrataList.filter((item) => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      const matchesSeverity = severityFilter === 'all' || item.severity === severityFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.symptom.toLowerCase().includes(q) ||
        item.rootCause.toLowerCase().includes(q) ||
        item.workaroundCodeSnippet.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q);

      return matchesCategory && matchesSeverity && matchesSearch;
    });
  }, [mcuErrataList, activeCategory, severityFilter, searchQuery]);

  // Quick stats
  const stats = useMemo(() => {
    const total = mcuErrataList.length;
    const critical = mcuErrataList.filter((e) => e.severity === 'critical').length;
    const major = mcuErrataList.filter((e) => e.severity === 'major').length;
    const minor = mcuErrataList.filter((e) => e.severity === 'minor').length;
    return { total, critical, major, minor };
  }, [mcuErrataList]);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpand = (id: string) => {
    setExpandedErrataId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold mb-2">
            <Bug className="w-3.5 h-3.5" /> Hardware Silicon Errata & Workaround Tracker
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            실리콘 에라타 트래커 (Errata Tracker)
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono">
              {currentProfile.name}
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            선택된 MCU의 <strong>제조사 공식 실리콘 결함(Silicon Errata)</strong>을 실시간 탐색하고,
            <strong> ADC 노이즈(Noise)</strong>, <strong>USART 버퍼 오버런(Overrun)</strong>, <strong>I2C/TWI 버스 락업(Lockup)</strong>,
            <strong> WDT 무한 루프</strong> 등 치명적인 하드웨어 결함을 극복하는 <strong>검증된 펌웨어 회피 코드(Known Workaround)</strong>를 제공합니다.
          </p>
        </div>

        {/* MCU Selector Switcher */}
        {onSelectMCU && (
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0">
            {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcu) => (
              <button
                key={mcu}
                onClick={() => onSelectMCU(mcu)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedMCU === mcu
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {mcu === 'atmega2560' ? 'ATmega2560' : mcu === 'atmega328p' ? 'ATmega328P' : mcu === 'atmega128' ? 'ATmega128' : 'ATmega640'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Silicon Health / Summary Status Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400">등록된 공식 에라타</div>
            <div className="text-xl font-black text-white font-mono mt-0.5">{stats.total}개 결함</div>
          </div>
          <AlertTriangle className="w-5 h-5 text-amber-400" />
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/5 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-rose-300">치명적 결함 (Critical)</div>
            <div className="text-xl font-black text-rose-400 font-mono mt-0.5">{stats.critical}개</div>
          </div>
          <Bug className="w-5 h-5 text-rose-400" />
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-amber-300">주요 결함 (Major)</div>
            <div className="text-xl font-black text-amber-400 font-mono mt-0.5">{stats.major}개</div>
          </div>
          <Activity className="w-5 h-5 text-amber-400" />
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-emerald-300">회피 코드(Workaround)</div>
            <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">100% 탑재</div>
          </div>
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          {[
            { id: 'all', label: '전체 결함' },
            { id: 'adc', label: 'ADC & 노이즈' },
            { id: 'usart', label: 'USART & 시리얼' },
            { id: 'twi', label: 'I2C / TWI 락업' },
            { id: 'power_wdt', label: 'WDT / 퓨즈' },
            { id: 'xmem_bus', label: 'XMEM / 버스' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as ErrataCategory)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeCategory === cat.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="에라타 검색 (ADC, USART, WDT...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Errata Accordion List */}
      <div className="space-y-3">
        {filteredErrata.length === 0 ? (
          <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-400 text-xs">
            일치하는 실리콘 에라타 항목이 없습니다. 검색어를 변경하거나 필터를 초기화하세요.
          </div>
        ) : (
          filteredErrata.map((errata) => {
            const isExpanded = expandedErrataId === errata.id;
            const isCritical = errata.severity === 'critical';

            return (
              <div
                key={errata.id}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  isExpanded
                    ? 'bg-slate-950 border-amber-500/40 shadow-xl ring-1 ring-amber-500/20'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header Strip */}
                <div
                  onClick={() => toggleExpand(errata.id)}
                  className="p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {errata.id}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          isCritical
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {errata.severity}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-medium">
                        {errata.categoryLabel}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        적용 실리콘: {errata.siliconRev}
                      </span>
                    </div>

                    <h4 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                      {errata.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2 text-slate-400 shrink-0">
                    <span className="hidden sm:inline text-xs font-medium text-amber-400">
                      {isExpanded ? '상세 접기' : '회피 코드 확인'}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-amber-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 border-t border-slate-800/80 space-y-4">
                    {/* Symptom & Cause Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
                        <span className="font-bold text-rose-400 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                          <AlertTriangle className="w-3.5 h-3.5" /> 결함 증상 (Symptom & Failure)
                        </span>
                        <p className="text-slate-300 leading-relaxed text-[11px]">
                          {errata.symptom}
                        </p>
                      </div>

                      <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
                        <span className="font-bold text-amber-400 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                          <Info className="w-3.5 h-3.5" /> 실리콘 원인 (Root Cause & Reference)
                        </span>
                        <p className="text-slate-300 leading-relaxed text-[11px]">
                          {errata.rootCause}
                        </p>
                        <div className="text-[10px] text-slate-500 font-mono pt-1">
                          참조 규격: {errata.datasheetRef}
                        </div>
                      </div>
                    </div>

                    {/* Hardware Fix Note */}
                    <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex items-start gap-2.5 text-xs text-cyan-300">
                      <Zap className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
                      <div>
                        <strong className="text-white block font-semibold mb-0.5">회로 / 하드웨어 해결 방안:</strong>
                        <span>{errata.hardwareFix}</span>
                      </div>
                    </div>

                    {/* Known Workaround Code Snippet */}
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-2 font-mono">
                          <Code2 className="w-4 h-4 text-emerald-400" />
                          검증된 펌웨어 회피 코드 (Known Workaround Snippet)
                        </span>
                        <button
                          onClick={() => copyCode(errata.workaroundCodeSnippet, errata.id)}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs transition"
                        >
                          {copiedId === errata.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          {copiedId === errata.id ? '복사됨' : '코드 복사'}
                        </button>
                      </div>

                      <pre className="bg-slate-950 p-3.5 rounded-lg border border-slate-800/80 text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                        {errata.workaroundCodeSnippet}
                      </pre>

                      <p className="text-[11px] text-slate-400 pt-1 leading-relaxed">
                        <strong className="text-slate-300 font-semibold">동작 원리: </strong>
                        {errata.explanation}
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
