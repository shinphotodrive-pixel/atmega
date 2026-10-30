import React, { useState, useMemo } from 'react';
import {
  Search,
  Bug,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Code2,
  Copy,
  Check,
  Cpu,
  Zap,
  Filter,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  Terminal,
  RotateCcw,
  Sliders,
  Database
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type ErrataSeverity = 'critical' | 'major' | 'minor';
export type ErrataCategory = 'wdt' | 'bod_power' | 'adc' | 'twi_i2c' | 'usart' | 'eeprom' | 'flash_bus' | 'timer';

export interface AvrErrataRecord {
  errataCode: string;          // e.g. "ERR-328P-WDT-01"
  queryAliases: string[];      // common search patterns: ["WDT*", "WATCHDOG", "WDIF", "RESET_LOOP"]
  targetMcus: SupportedMCU[];
  category: ErrataCategory;
  categoryLabel: string;
  title: string;
  severity: ErrataSeverity;
  affectedRevisions: string;   // e.g. "Rev. A to C", "All Silicon Revisions"
  datasheetDocId: string;      // e.g. "DS80000738C §3.1"
  symptom: string;
  rootCause: string;
  hardwareFix: string;
  workaroundCode: string;
  workaroundNote: string;
}

const COMMON_ERRATA_DATABASE: AvrErrataRecord[] = [
  // --- ATmega328P Errata ---
  {
    errataCode: 'ERR-328P-WDT-01',
    queryAliases: ['WDT*', 'WATCHDOG*', 'WDIF*', 'RESET_LOOP', 'MCUSR*'],
    targetMcus: ['atmega328p'],
    category: 'wdt',
    categoryLabel: 'Watchdog & 리셋',
    title: '워치독 타이머 인터럽트 모드 실행 시 WDRF 플래그 미해제로 인한 무한 리셋 결함',
    severity: 'critical',
    affectedRevisions: 'Rev. A, Rev. B, Rev. C',
    datasheetDocId: 'Microchip DS80000738C §3.1 (Atmel Doc8271)',
    symptom: '워치독 타임아웃 발생 후 시스템이 부팅될 때 MCUSR의 WDRF 비트가 클리어되지 않으면 워치독이 최단 주기(16ms)로 고정되어 부트로더 진입 직후 무한 리셋 루프에 빠짐.',
    rootCause: '워치독 리셋 후 MCUSR의 WDRF 비트가 하드웨어적으로 1로 유지되며, WDE 비트를 끌 수 없도록 강제 락이 걸림. 초기화 루틴에서 MCUSR=0으로 리셋하지 않으면 WDE 해제 불가능.',
    hardwareFix: '하드웨어적 수정 불가 (소프트웨어 .init3 섹션 초기화 필수)',
    workaroundCode: `// 부팅 즉시(.init3) MCUSR 플래그 클리어 및 WDT 정지
#include <avr/wdt.h>

void wdt_init(void) __attribute__((naked)) __attribute__((section(".init3")));
void wdt_init(void) {
    MCUSR = 0;              // 1. 리셋 플래그 클리어 (필수!)
    wdt_disable();          // 2. 워치독 타이머 즉시 해제
}`,
    workaroundNote: 'main() 함수 진입 전 실행되는 .init3 섹션에 위 코드를 배치해야 부트로더 및 시스템 락업을 완벽 방지할 수 있습니다.'
  },
  {
    errataCode: 'ERR-328P-BOD-02',
    queryAliases: ['BOD*', 'BROWNOUT*', 'EEPROM*', 'POWER_GLITCH'],
    targetMcus: ['atmega328p'],
    category: 'bod_power',
    categoryLabel: 'BOD & 전원 전압',
    title: 'BOD 비활성화 상태에서 전원 차단(Power-down) 시 EEPROM 주소 0x00 번지 파괴 결함',
    severity: 'critical',
    affectedRevisions: '전 실리콘 리비전 (All Revisions)',
    datasheetDocId: 'Atmel AVR094 & Doc8271 §8.4',
    symptom: '전원 스위치를 끌 때 VCC가 서서히 강하되는 슬루율 구간에서 EEPROM 0x0000 번지 데이터가 0x00 또는 0xFF로 무단 덮어써짐.',
    rootCause: 'VCC가 MCU 최소 동작 전압(1.8V/2.7V) 이하로 떨어질 때 CPU 명령 디코더가 오작동하여 플래시/EEPROM 쓰기 시퀀스 스트로브를 우발적으로 발생시킴.',
    hardwareFix: '퓨즈비트에서 BODLEVEL을 최소 2.7V(0xFD) 또는 4.3V(0xFC)로 프로그래밍하여 전압 강하 즉시 CPU를 리셋 상태로 홀드.',
    workaroundCode: `// 1. EEPROM 주소 0x00 번지에는 더미(Dummy) 데이터를 배치하여 보호
// 2. 중요 설정값은 0x01 번지 이후에 저장
#include <avr/eeprom.h>

// avrdude 퓨즈 설정: BOD 2.7V 인에이블
// avrdude -c usbasp -p m328p -U efuse:w:0xFD:m`,
    workaroundNote: 'BOD 퓨즈를 반드시 켜고, EEPROM 주소 0x00 번지는 실사용 데이터 저장용으로 할당하지 않는 것이 업계 표준 권장사항입니다.'
  },
  {
    errataCode: 'ERR-328P-ADC-03',
    queryAliases: ['ADC*', 'ANALOG*', 'ADMUX*', 'VREF*', 'NOISE*'],
    targetMcus: ['atmega328p'],
    category: 'adc',
    categoryLabel: 'ADC & 아날로그',
    title: 'ADC 슬립 모드 복귀 또는 기준전압(VREF) 변경 직후 첫 번째 변환값 오차 결함',
    severity: 'major',
    affectedRevisions: 'Rev. A, Rev. B',
    datasheetDocId: 'Microchip DS80000738C §3.4',
    symptom: 'ADMUX의 REFS1:0을 내부 1.1V 밴드갭으로 전환하거나 ADC Noise Reduction 슬립 모드에서 깨어난 직후 샘플링 결과가 최대 15% 이상 왜곡됨.',
    rootCause: '내부 1.1V 기준 전압 버퍼 회로의 내부 커패시터 충전 시정수(약 1ms 소요)가 완료되기 전에 샘플/홀드 회로가 트리거됨.',
    hardwareFix: 'AREF 핀에 100nF 세라믹 디커플링 커패시터 필수 장착',
    workaroundCode: `// 기준전압 변경 또는 슬립 복귀 후 더미(Dummy) 읽기 1회 수행
ADMUX = (1 << REFS1) | (1 << REFS0); // 내부 1.1V 선택
_delay_ms(1);                         // 밴드갭 안정화 대기

ADCSRA |= (1 << ADSC);               // 첫 번째 더미 변환 시작
while (ADCSRA & (1 << ADSC));        // 완료 대기
volatile uint16_t dummy = ADC;       // 첫 변환값 폐기 (중요!)

// 이후 정상 샘플링 진행
ADCSRA |= (1 << ADSC);
while (ADCSRA & (1 << ADSC));
uint16_t real_adc = ADC;             // 유효 샘플값`,
    workaroundNote: 'ADMUX 변경 후 최소 1회의 더미 변환을 실행하여 폐기하면 10비트 전체 정밀도(ENOB ~9.6-bit)를 정상 회복합니다.'
  },
  {
    errataCode: 'ERR-328P-TWI-04',
    queryAliases: ['TWI*', 'I2C*', 'TWINT*', 'BUS_FREEZE*', 'LOCKUP*'],
    targetMcus: ['atmega328p'],
    category: 'twi_i2c',
    categoryLabel: 'TWI / I2C 버스',
    title: '고용량 버스에서 STOP 조건 수신 시 TWINT 플래그 미발생 및 I2C 버스 무한 락업',
    severity: 'major',
    affectedRevisions: 'Rev. A, Rev. B, Rev. C',
    datasheetDocId: 'Atmel Doc8271 §22.7 & Microchip Errata',
    symptom: 'I2C 슬레이브 모드에서 마스터가 STOP 조건을 전송할 때 SDA 신호의 상승 지연이 발생하면 TWINT가 세팅되지 않고 하드웨어가 영구 대기 상태에 머무름.',
    rootCause: 'SCL이 High인 상태에서 SDA의 상승 에지 감지 타이밍 윈도우가 노이즈 또는 과도한 버스 커패시턴스(>200pF)로 인해 미스 발생.',
    hardwareFix: 'I2C 풀업 저항을 4.7kΩ에서 2.2kΩ 또는 1.8kΩ으로 강화하여 상승 시간(Rise time) 단축',
    workaroundCode: `// 소프트웨어 타임아웃 워치독 루프 적용 (무한 대기 방지)
uint16_t timeout = 5000;
TWCR = (1 << TWINT) | (1 << TWEN) | (1 << TWSTO);
while (!(TWCR & (1 << TWINT))) {
    if (--timeout == 0) {
        // TWI 하드웨어 강제 리셋 및 버스 복구
        TWCR = 0; // TWI 비활성화
        TWCR = (1 << TWEN) | (1 << TWEA); // 재초기화
        break;
    }
}`,
    workaroundNote: 'while (!(TWCR & (1 << TWINT))); 형태의 순수 무한 루프 대신 반드시 타임아웃 카운터를 배치해야 합니다.'
  },

  // --- ATmega2560 Errata ---
  {
    errataCode: 'ERR-2560-RAMPZ-01',
    queryAliases: ['RAMPZ*', 'EIND*', 'FLASH*', 'FAR_ADDRESS*', 'INTERRUPT*'],
    targetMcus: ['atmega2560'],
    category: 'flash_bus',
    categoryLabel: 'Flash & RAMPZ/EIND',
    title: '256KB 플래시 128KB(64KW) 경계 초과 시 RAMPZ / EIND 레지스터 인터럽트 컨텍스트 미보존 결함',
    severity: 'critical',
    affectedRevisions: 'Rev. A, Rev. B, Rev. C, Rev. D',
    datasheetDocId: 'Microchip DS80000740A §2.1 (Atmel Doc2549)',
    symptom: '상위 128KB 플래시 영역에서 테이블 데이터를 읽거나 함수 포인터를 실행하는 도중 인터럽트(ISR)가 발생하면 메인 루프 복귀 후 엉뚱한 번지의 플래시를 읽어 펌웨어 붕괴.',
    rootCause: '표준 avr-gcc 컴파일러의 기본 ISR 프롤로그/에필로그가 RAMPZ와 EIND 레지스터를 스택에 백업하지 않아 인터럽트가 RAMPZ 상위 바이트를 오염시킴.',
    hardwareFix: '하드웨어적 수정 불가 (컴파일러 플래그 및 ISR 수동 보존 필수)',
    workaroundCode: `// RAMPZ 레지스터를 사용하는 ISR에 수동 백업 매크로 적용
ISR(TIMER1_COMPA_vect) {
    uint8_t sreg_save = SREG;
    uint8_t rampz_save = RAMPZ; // RAMPZ 명시적 백업
    uint8_t eind_save = EIND;   // EIND 명시적 백업

    // ISR 본문 로직 실행
    // ...

    EIND = eind_save;           // 복구
    RAMPZ = rampz_save;
    SREG = sreg_save;
}`,
    workaroundNote: 'ATmega2560에서 128KB 이상의 펌웨어를 작성할 때는 gcc 옵션에 -mrelax 및 pgm_read_byte_far() 사용 시 인터럽트 차단이 권장됩니다.'
  },
  {
    errataCode: 'ERR-2560-JTAG-02',
    queryAliases: ['JTAG*', 'JTAGEN*', 'PORTF*', 'ADC_NOISE*', 'ANALOG_OFFSET*'],
    targetMcus: ['atmega2560', 'atmega640'],
    category: 'adc',
    categoryLabel: 'JTAG & ADC 핀 충돌',
    title: 'JTAG 퓨즈(JTAGEN) 활성화 시 Port F (PF4~PF7 / ADC4~ADC7) 풀업 누설로 인한 ADC 오차',
    severity: 'major',
    affectedRevisions: 'All Revisions',
    datasheetDocId: 'Atmel Doc2549 §26.6',
    symptom: 'ADC4~ADC7 핀에 아날로그 센서를 연결했을 때 JTAGEN 퓨즈가 켜져 있으면 신호가 0.2V~0.5V 상향 편향(Offset Drift)됨.',
    rootCause: 'JTAG 하드웨어의 온칩 디버그(OCD) TDI/TMS/TCK/TDO 내부 고정 풀업 저항(~35kΩ)이 ADC 채널 임피던스를 왜곡.',
    hardwareFix: '퓨즈비트에서 JTAGEN을 프로그래밍 해제(High/1)하거나 MCUCR 레지스터에서 소프트웨어적으로 JTAG 비활성화',
    workaroundCode: `// 런타임에 JTAG 인터페이스를 4클럭 시퀀스로 소프트웨어 비활성화
#include <avr/io.h>

void disable_jtag_for_adc(void) {
    // MCUCR의 JTD 비트를 4사이클 이내에 연속으로 1로 기록해야 해제됨
    MCUCR |= (1 << JTD);
    MCUCR |= (1 << JTD);
}`,
    workaroundNote: 'JTAG 디버거를 연결하지 않는 양산 제품에서는 High Fuse의 JTAGEN 비트를 1로 설정하여 완전 비활성화하세요.'
  },
  {
    errataCode: 'ERR-2560-TIMER-04',
    queryAliases: ['TIMER*', 'ICR*', 'ICP*', 'INPUT_CAPTURE*', 'EDGE*'],
    targetMcus: ['atmega2560', 'atmega640'],
    category: 'timer',
    categoryLabel: '타이머 / 카운터',
    title: '16비트 Timer3/4/5 Input Capture(ICP) 에지 극성 반전 시 false 캡처 인터럽트 발생',
    severity: 'minor',
    affectedRevisions: 'Rev. A to C',
    datasheetDocId: 'Microchip Errata Sheet ATmega2560 §2.4',
    symptom: 'TCCR3B의 ICES3 비트를 0에서 1(또는 1에서 0)으로 토글하여 캡처 에지를 전환할 때 즉시 거짓 캡처 플래그(ICF3)가 세팅되어 불필요한 ISR 진입.',
    rootCause: '극성 반전 멀티플렉서 전환 과도 신호(Glitch)가 하드웨어 에지 검출기에 펄스로 오인식됨.',
    hardwareFix: '소프트웨어 플래그 수동 클리어 시퀀스 필수',
    workaroundCode: `// 에지 극성 전환 직후 반드시 ICFn 플래그에 1을 써서 클리어
TCCR3B ^= (1 << ICES3); // 극성 반전
TIFR3 = (1 << ICF3);    // 1을 써서 허위 발생 플래그 즉시 클리어!
TIMSK3 |= (1 << ICIE3); // 그 후 인터럽트 인에이블`,
    workaroundNote: '에지 변경과 인터럽트 인에이블 사이에 TIFRn 클리어가 반드시 포함되어야 합니다.'
  },

  // --- ATmega128 Errata ---
  {
    errataCode: 'ERR-128-M103C-01',
    queryAliases: ['M103C*', 'COMPATIBILITY*', 'ATMEGA103*', 'FUSE_M103C*', 'PORTE*'],
    targetMcus: ['atmega128'],
    category: 'flash_bus',
    categoryLabel: 'M103C 퓨즈 호환성',
    title: '공장 출하 기본 퓨즈 M103C=0 활성화로 인한 확장 I/O 및 신규 기능 영구 비활성화 결함',
    severity: 'critical',
    affectedRevisions: '전 생산 칩 (Factory Default Fuse)',
    datasheetDocId: 'Atmel Doc2467 §27 & Application Note AVR095',
    symptom: 'ATmega128을 구매하여 코딩 시 USART1, Timer3, Port F 풀 기능, 외부 인터럽트 4-7이 전혀 동작하지 않고 ATmega103 모드로 강제 동작함.',
    rootCause: 'Atmel 팩토리 출하 시 구형 ATmega103과의 하위 호환성을 위해 Extended Fuse의 M103C 비트가 0(Programmed)으로 기본 출하됨.',
    hardwareFix: 'ISP 프로그래머로 Extended Fuse를 0xFF(M103C=1, Unprogrammed)로 최초 1회 재기록 필수!',
    workaroundCode: `# avrdude로 M103C 퓨즈 해제 (순수 ATmega128 풀 기능 활성화)
avrdude -c usbasp -p m128 -U efuse:w:0xFF:m`,
    workaroundNote: 'ATmega128을 사용하는 모든 프로젝트에서 가장 빈번하게 발생하는 #1 결함입니다. 칩 납땜 즉시 M103C=1로 변경하세요.'
  },
  {
    errataCode: 'ERR-128-EEPROM-03',
    queryAliases: ['EEPROM*', 'EEWE*', 'POWERDOWN*', 'HALT*', 'LOCK*'],
    targetMcus: ['atmega128'],
    category: 'eeprom',
    categoryLabel: 'EEPROM & 파워다운',
    title: 'EEPROM 쓰기 완료 전 Power-down 진입 시 CPU 무한 정지(Halt) 및 발진 차단 결함',
    severity: 'major',
    affectedRevisions: 'Rev. A, Rev. B',
    datasheetDocId: 'Atmel Doc2467 §28 Errata #2',
    symptom: 'EEPROM 쓰기 중 sleep 명령어를 실행하여 파워다운으로 들어가면 EEPROM 내부 시퀀서가 멈추며 메인 오실레이터가 영구 정지됨.',
    rootCause: 'EEPROM 완료 인터럽트와 파워다운 슬립 시퀀서 간의 핸드셰이크 비동기 타이밍 버그.',
    hardwareFix: '슬립 진입 전 EECR의 EEWE 비트가 0이 될 때까지 폴링 대기 필수',
    workaroundCode: `// EEPROM 쓰기 완료를 반드시 확인한 후 슬립 모드 진입
while (EECR & (1 << EEWE)); // EEPROM 쓰기 끝날 때까지 대기
set_sleep_mode(SLEEP_MODE_PWR_DOWN);
sleep_enable();
sei();
sleep_cpu();`,
    workaroundNote: 'EEPROM 쓰기 직후 저전력 슬립 모드로 진입하는 배터리 구동 기기에서 필수 적용 사항입니다.'
  },
  {
    errataCode: 'ERR-128-ADC-02',
    queryAliases: ['ADC*', 'FREERUN*', 'AVCC*', 'NOISE*', 'CONVERSION*'],
    targetMcus: ['atmega128'],
    category: 'adc',
    categoryLabel: 'ADC 프리러닝 모드',
    title: 'ADC 프리러닝(Free Running) 모드에서 채널 변경 시 1 클럭 파이프라인 누락 결함',
    severity: 'minor',
    affectedRevisions: 'All Revisions',
    datasheetDocId: 'Atmel Doc2467 §28 Errata #4',
    symptom: '프리러닝 연속 변환 도중 ADMUX 채널을 변경하면 변경 직후의 변환 결과에 이전 채널의 아날로그 전압이 섞여 출력됨.',
    rootCause: 'ADC 샘플/홀드가 변환 사이클 시작 1.5 클럭 후에 래치되므로 ADMUX 변경 타이밍이 이전 변환 주기에 걸침.',
    hardwareFix: 'AVCC와 VCC 사이에 10µH 인덕터 및 100nF 커패시터 LC 필터 장착',
    workaroundCode: `// 채널 변경 시 프리러닝 중지 -> 단일 변환으로 1회 버리기
ADCSRA &= ~(1 << ADFR); // 프리러닝 해제
ADMUX = new_channel;
ADCSRA |= (1 << ADSC);  // 1회 더미 변환
while (ADCSRA & (1 << ADSC));
ADCSRA |= (1 << ADFR) | (1 << ADSC); // 프리러닝 재개`,
    workaroundNote: '다채널 센서를 스캔할 때는 프리러닝 대신 단일 변환(Single Conversion) 방식을 사용하는 것이 안전합니다.'
  },

  // --- ATmega640 Errata ---
  {
    errataCode: 'ERR-640-ADC-01',
    queryAliases: ['ADC*', 'PORTK*', 'DIFFERENTIAL*', 'GAIN*', 'OFFSET*'],
    targetMcus: ['atmega640'],
    category: 'adc',
    categoryLabel: 'ADC 차동 증폭기',
    title: 'Port K(ADC8~15) 10x/200x 차동 증폭기 모드에서 고온 시 오프셋 드리프트 결함',
    severity: 'minor',
    affectedRevisions: 'Rev. A',
    datasheetDocId: 'Microchip ATmega640 Errata DS80000739 §2.2',
    symptom: '차동 증폭기(10배/200배 게인) 사용 시 65°C 이상 고온에서 영점 오프셋이 ±12 LSB까지 증가함.',
    rootCause: '초기 실리콘의 차동 프리앰프 MOS 트랜지스터 열 드리프트 보정 바이어스 회로 미흡.',
    hardwareFix: '외부 정밀 연산증폭기(Op-Amp) 사용 또는 단극성(Single-Ended) 모드로 전환',
    workaroundCode: `// 부팅 및 주기적으로 차동 입력 양단을 동일 전압(GND)으로 연결하여 오프셋 캘리브레이션
// ADMUX에서 차동 채널 오프셋 측정 모드 선택 후 오프셋 보정값 차감
int16_t adc_offset = measure_zero_differential_offset();
int16_t calibrated_val = raw_adc - adc_offset;`,
    workaroundNote: '소프트웨어 오프셋 캘리브레이션 루틴을 1초 주기로 실행하면 정상 정밀도를 유지할 수 있습니다.'
  },
  {
    errataCode: 'ERR-640-SPI-02',
    queryAliases: ['SPI*', 'SS_PIN*', 'SLAVE_SELECT*', 'MSTR*', 'BUS_COLLISION*'],
    targetMcus: ['atmega640', 'atmega2560', 'atmega128', 'atmega328p'],
    category: 'flash_bus',
    categoryLabel: 'SPI 마스터 SS 핀',
    title: 'SPI 마스터 모드에서 /SS 핀이 입력 플로팅 시 예기치 않게 슬레이브로 강제 강등',
    severity: 'major',
    affectedRevisions: '전 AVR 아키텍처 공통',
    datasheetDocId: 'Microchip AVR Microcontroller Core Reference §19',
    symptom: 'SPI 마스터로 통신 중 갑자기 SPCR의 MSTR 비트가 0으로 클리어되며 SPI 클럭(SCK) 생성이 멈추고 시스템 정지.',
    rootCause: '하드웨어 /SS 핀이 입력(Input)으로 설정되어 Low 신호가 인가되면 AVR 하드웨어가 다중 마스터 충돌로 판단하여 자동으로 슬레이브 모드로 강등시킴.',
    hardwareFix: '하드웨어 /SS 핀(ATmega328P: PB2, ATmega2560: PB0)을 반드시 출력(Output)으로 설정하거나 10kΩ 풀업 저항 연결',
    workaroundCode: `// SPI 초기화 시 하드웨어 SS 핀을 반드시 출력(Output)으로 선언!
// 다른 핀을 소프트웨어 칩셀렉트로 쓰더라도 하드웨어 SS 핀은 반드시 출력이어야 함
DDRB |= (1 << DDB2);  // PB2(/SS) 핀을 무조건 출력으로 설정 (MSTR 강등 방지)
PORTB |= (1 << PORTB2); // High 유지

// 그 후 SPI 마스터 인에이블
SPCR = (1 << SPE) | (1 << MSTR) | (1 << SPR0);`,
    workaroundNote: 'SPI 통신 멈춤 현상의 90%가 하드웨어 SS 핀을 출력으로 설정하지 않아 발생합니다.'
  }
];

export const AvrErrataPatternSearch: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);
  const [expandedErrataId, setExpandedErrataId] = useState<string | null>(null);

  // Common Database Query Pattern Presets
  const queryPatternPresets = [
    { label: '전체 (ALL)', query: '', desc: '모든 에라타 표시' },
    { label: 'WDT* (워치독)', query: 'WDT*', desc: '워치독 무한 리셋 결함' },
    { label: 'BOD* (전원/EEPROM)', query: 'BOD*', desc: '전압 강하 시 데이터 파괴' },
    { label: 'ADC* (아날로그)', query: 'ADC*', desc: '기준전압 및 노이즈 오차' },
    { label: 'TWI* (I2C 락업)', query: 'TWI*', desc: '버스 정체 및 STOP 조건' },
    { label: 'FLASH* (RAMPZ)', query: 'FLASH*', desc: '128KB 초과 경계 침범' },
    { label: 'M103C* (ATmega128)', query: 'M103C*', desc: '구형 호환 퓨즈 강제' },
    { label: 'SPI* (SS 강등)', query: 'SPI*', desc: '마스터 핀 강제 슬레이브화' }
  ];

  // Pattern matching helper supporting wildcards (*, %)
  const matchesPattern = (text: string, pattern: string): boolean => {
    if (!pattern.trim()) return true;
    const cleanPattern = pattern.trim().toLowerCase();
    
    // Check if regex wildcard
    if (cleanPattern.includes('*') || cleanPattern.includes('%')) {
      const regexStr = '^' + cleanPattern.replace(/\*/g, '.*').replace(/%/g, '.*') + '$';
      try {
        const reg = new RegExp(regexStr, 'i');
        return reg.test(text.toLowerCase());
      } catch (e) {
        // Fallback to substring
        return text.toLowerCase().includes(cleanPattern.replace(/[*%]/g, ''));
      }
    }

    return text.toLowerCase().includes(cleanPattern);
  };

  // Filtered Errata Records
  const filteredErratas = useMemo(() => {
    return COMMON_ERRATA_DATABASE.filter((errata) => {
      // 1. MCU filter
      const matchesMcu = errata.targetMcus.includes(selectedMCU);
      if (!matchesMcu) return false;

      // 2. Category filter
      if (selectedCategory !== 'all' && errata.category !== selectedCategory) {
        return false;
      }

      // 3. Severity filter
      if (selectedSeverity !== 'all' && errata.severity !== selectedSeverity) {
        return false;
      }

      // 4. Query Pattern filter
      if (!searchQuery.trim()) return true;

      const q = searchQuery.trim().toLowerCase();

      // Check Errata Code
      if (matchesPattern(errata.errataCode, q)) return true;

      // Check Query Aliases
      const matchesAlias = errata.queryAliases.some(alias => matchesPattern(alias, q));
      if (matchesAlias) return true;

      // Check Title or Symptom
      if (errata.title.toLowerCase().includes(q.replace(/[*%]/g, ''))) return true;
      if (errata.symptom.toLowerCase().includes(q.replace(/[*%]/g, ''))) return true;
      if (errata.datasheetDocId.toLowerCase().includes(q.replace(/[*%]/g, ''))) return true;

      return false;
    });
  }, [selectedMCU, selectedCategory, selectedSeverity, searchQuery]);

  const handleCopy = (code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeKey(key);
    confetti({
      particleCount: 25,
      spread: 40,
      origin: { y: 0.85 }
    });
    setTimeout(() => setCopiedCodeKey(null), 2000);
  };

  const toggleExpand = (id: string) => {
    setExpandedErrataId(prev => prev === id ? null : id);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl backdrop-blur relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute -top-32 -right-32 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-inner">
              <Database className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base md:text-lg font-bold text-white tracking-wide">
                  AVR 에라타 데이터베이스 패턴 쿼리 &amp; 코드 검색기
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-500/40">
                  Pattern Query Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                선택된 {currentProfile.name}의 공통 에라타 코드 패턴(ERR-*, WDT-*, ADC-*, BOD-*) 및 와일드카드(*) 쿼리로 알려진 실리콘 결함과 C 언어 우회책을 검색합니다.
              </p>
            </div>
          </div>
        </div>

        {/* MCU Selector & Profile Badge */}
        <div className="flex items-center gap-2 shrink-0">
          {onSelectMCU && (
            <select
              value={selectedMCU}
              onChange={(e) => onSelectMCU(e.target.value as SupportedMCU)}
              className="bg-slate-950 border border-slate-700 hover:border-rose-500 text-xs text-rose-300 font-mono rounded-xl px-2.5 py-1.5 focus:outline-none transition-colors"
            >
              {Object.keys(MCU_PROFILES).map((mcuKey) => (
                <option key={mcuKey} value={mcuKey}>
                  {MCU_PROFILES[mcuKey as SupportedMCU].name}
                </option>
              ))}
            </select>
          )}
          <span className="text-xs font-mono text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-rose-400" />
            {currentProfile.name}
          </span>
        </div>
      </div>

      {/* Query Bar & Pattern Presets */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3 relative z-10">
        {/* Main Search Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="에라타 코드 또는 와일드카드 패턴 입력 (예: WDT*, ERR-*, *FREEZE*, ADC*, BOD*)"
              className="w-full bg-slate-900 border border-slate-700 focus:border-rose-500 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2 font-mono focus:outline-none focus:border-rose-500"
          >
            <option value="all">전체 서브시스템</option>
            <option value="wdt">WDT &amp; 리셋</option>
            <option value="bod_power">BOD &amp; 전원</option>
            <option value="adc">ADC &amp; 아날로그</option>
            <option value="twi_i2c">TWI / I2C 버스</option>
            <option value="flash_bus">Flash &amp; 메모리 버스</option>
            <option value="eeprom">EEPROM</option>
            <option value="timer">타이머/카운터</option>
          </select>

          {/* Severity Filter */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2 font-mono focus:outline-none focus:border-rose-500"
          >
            <option value="all">전체 심각도</option>
            <option value="critical">Critical (치명적 결함)</option>
            <option value="major">Major (주요 결함)</option>
            <option value="minor">Minor (경미한 오차)</option>
          </select>
        </div>

        {/* Database Query Pattern Quick Chips */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs font-mono">
          <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            공통 쿼리 패턴:
          </span>
          {queryPatternPresets.map((preset) => {
            const isActive = searchQuery === preset.query;
            return (
              <button
                key={preset.label}
                onClick={() => setSearchQuery(preset.query)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] transition ${
                  isActive
                    ? 'bg-rose-600 text-white border-rose-400 font-bold shadow-md shadow-rose-600/30'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
                title={preset.desc}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Query Status Bar */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
        <div>
          <span>{currentProfile.name} 검색 결과: </span>
          <span className="text-rose-400 font-bold">{filteredErratas.length}개</span>
          <span>의 에라타 패턴 매칭됨</span>
          {searchQuery && (
            <span className="text-amber-400 ml-2">
              (Pattern: <code className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">{searchQuery}</code>)
            </span>
          )}
        </div>

        <button
          onClick={() => {
            setSearchQuery('');
            setSelectedCategory('all');
            setSelectedSeverity('all');
          }}
          className="text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
        >
          <RotateCcw className="w-3 h-3" />
          <span>필터 초기화</span>
        </button>
      </div>

      {/* Errata Result Cards List */}
      <div className="space-y-4">
        {filteredErratas.length === 0 ? (
          <div className="p-12 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
            <Bug className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-sm font-bold text-slate-300">
              일치하는 에라타 패턴을 찾을 수 없습니다.
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              입력하신 쿼리 패턴(<code className="text-amber-400">{searchQuery}</code>)에 매칭되는 에라타 코드가 없습니다.
              상단의 공통 쿼리 칩을 클릭하거나 검색어를 비워 전체 목록을 조회하세요.
            </p>
          </div>
        ) : (
          filteredErratas.map((errata) => {
            const isExpanded = expandedErrataId === errata.errataCode;
            const severityColor =
              errata.severity === 'critical'
                ? 'text-rose-400 bg-rose-950/60 border-rose-600/60'
                : errata.severity === 'major'
                ? 'text-amber-400 bg-amber-950/60 border-amber-600/60'
                : 'text-cyan-400 bg-cyan-950/60 border-cyan-600/60';

            return (
              <div
                key={errata.errataCode}
                className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all space-y-4 shadow-lg"
              >
                {/* Top Row: Errata Code, Subsystem, Severity & Expand Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-slate-900 text-rose-300 border border-rose-900/50">
                      {errata.errataCode}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase border ${severityColor}`}>
                      {errata.severity}
                    </span>
                    <span className="text-[11px] font-mono text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-800/40">
                      {errata.categoryLabel}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      리비전: {errata.affectedRevisions}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-slate-500">
                    문서: {errata.datasheetDocId}
                  </span>
                </div>

                {/* Title & Symptom */}
                <div>
                  <h4 className="text-sm font-bold text-white leading-snug">
                    {errata.title}
                  </h4>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    <strong className="text-amber-400">결함 증상: </strong>
                    {errata.symptom}
                  </p>
                </div>

                {/* Root Cause & Hardware Fix */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-900/50 p-3.5 rounded-xl border border-slate-800/80">
                  <div>
                    <span className="font-bold text-slate-300 block mb-1">
                      🔍 하드웨어 원인 (Root Cause):
                    </span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      {errata.rootCause}
                    </p>
                  </div>
                  <div>
                    <span className="font-bold text-emerald-400 block mb-1">
                      🛠️ 하드웨어/퓨즈 해결책 (HW Fix):
                    </span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      {errata.hardwareFix}
                    </p>
                  </div>
                </div>

                {/* Firmware Workaround C Code Box */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                      <Code2 className="w-3.5 h-3.5" />
                      <span>펌웨어 우회 C 코드 (Workaround Implementation)</span>
                    </div>

                    <button
                      onClick={() => handleCopy(errata.workaroundCode, errata.errataCode)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-[11px] font-mono"
                    >
                      {copiedCodeKey === errata.errataCode ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">복사 완료</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>코드 복사</span>
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="p-3 bg-slate-900 rounded-xl border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto leading-relaxed select-all">
                    {errata.workaroundCode}
                  </pre>
                  <p className="text-[11px] text-slate-400 italic">
                    💡 {errata.workaroundNote}
                  </p>
                </div>

                {/* Pattern Match Details & Query Aliases */}
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-800/80">
                  <div className="flex items-center gap-1">
                    <span>매칭 쿼리 패턴: </span>
                    {errata.queryAliases.map((alias) => (
                      <span
                        key={alias}
                        onClick={() => setSearchQuery(alias)}
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 cursor-pointer border border-slate-800 transition"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>

                  <span className="text-emerald-400 font-semibold">
                    ✓ Verified Workaround
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
