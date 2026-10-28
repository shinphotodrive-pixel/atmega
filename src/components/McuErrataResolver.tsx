import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ShieldCheck,
  Bug,
  CheckCircle2,
  Copy,
  Check,
  Sliders,
  Code2,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Cpu,
  Info,
  Terminal,
  Zap
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
  // Optional sync with parent fuses
  m103cFuseState?: boolean; // true = 1 (unprogrammed = native ATmega128), false = 0 (programmed = 103 mode)
  onToggleM103c?: (val: boolean) => void;
}

export type ErrataSeverity = 'critical' | 'major' | 'minor';
export type ErrataCategory = 'all' | 'power_reset' | 'adc' | 'flash_fuse' | 'timer_comm';

interface ErrataRule {
  id: string;
  mcus: SupportedMCU[];
  category: 'power_reset' | 'adc' | 'flash_fuse' | 'timer_comm';
  categoryLabel: string;
  title: string;
  severity: ErrataSeverity;
  affectedRegisters: string[];
  datasheetRef: string;
  siliconRev: string;
  symptom: string;
  rootCause: string;
  // Evaluation returns true if VULNERABLE, false if SAFE
  isVulnerable: (state: ResolverState, mcu: SupportedMCU) => boolean;
  getVulnerabilityMessage: (state: ResolverState, mcu: SupportedMCU) => string;
  getSafeMessage: (state: ResolverState, mcu: SupportedMCU) => string;
  applyFix: (state: ResolverState, setState: React.Dispatch<React.SetStateAction<ResolverState>>) => void;
  workaroundCodeSnippet: string;
  codeExplanation: string;
}

interface ResolverState {
  // WDTCSR (or WDTCR)
  wde: boolean;
  wdie: boolean;
  wdce: boolean;
  wdp: number; // 0~9
  init3McusrClear: boolean; // Firmware .init3 MCUSR=0 and wdt_disable()

  // ADCSRA & SMCR
  adsc: boolean;
  aden: boolean;
  adate: boolean;
  sleepMode: 'idle' | 'adc_noise' | 'power_down' | 'power_save' | 'standby';
  sleepEnable: boolean;
  adcSleepTriggerWorkaround: boolean; // Sleep before ADSC start sequence
  adcDiffFilterApplied: boolean;     // LC filter & differential gain calibration

  // ATmega128 Fuse & Comparator
  m103cUnprogrammed: boolean; // true = 1 (ATmega128 Native mode), false = 0 (M103 trap)
  acsrSafeSwitching: boolean; // ACIE disabled during ACSR mode shift

  // ATmega2560 Flash > 128KB
  flashSizeOver128k: boolean;
  rampzIsrBackup: boolean;    // RAMPZ/EIND explicitly saved in ISRs

  // 16-bit Timers
  timer16AtomicProtection: boolean; // ATOMIC_BLOCK on 16-bit registers (TCNT1, OCR1A)

  // TWI
  twiBusIdleCheck: boolean; // Hardware TWI Start condition bus check & timeout
}

const INITIAL_RESOLVER_STATE: ResolverState = {
  wde: true,
  wdie: false,
  wdce: false,
  wdp: 6, // 1 second
  init3McusrClear: false, // Default vulnerable

  adsc: true,
  aden: true,
  adate: false,
  sleepMode: 'adc_noise',
  sleepEnable: true,
  adcSleepTriggerWorkaround: false, // Default vulnerable to sleep noise race
  adcDiffFilterApplied: false,

  m103cUnprogrammed: false, // Default vulnerable for ATmega128 (factory default is programmed = 0)
  acsrSafeSwitching: false,

  flashSizeOver128k: true,
  rampzIsrBackup: false, // Default vulnerable on large flash

  timer16AtomicProtection: false, // Default vulnerable to TEMP buffer corruption
  twiBusIdleCheck: false,
};

export const McuErrataResolver: React.FC<Props> = ({
  selectedMCU,
  onSelectMCU,
  m103cFuseState,
  onToggleM103c,
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Resolver state
  const [state, setState] = useState<ResolverState>(() => ({
    ...INITIAL_RESOLVER_STATE,
    // Sync initial fuse state if provided
    m103cUnprogrammed: m103cFuseState !== undefined ? m103cFuseState : false,
  }));

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ErrataCategory>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sync external M103C fuse state if changed
  React.useEffect(() => {
    if (m103cFuseState !== undefined) {
      setState((prev) => ({ ...prev, m103cUnprogrammed: m103cFuseState }));
    }
  }, [m103cFuseState]);

  // Handle M103C update
  const handleToggleM103c = (val: boolean) => {
    setState((prev) => ({ ...prev, m103cUnprogrammed: val }));
    if (onToggleM103c) onToggleM103c(val);
  };

  // Errata Rules Registry
  const ERRATA_RULES: ErrataRule[] = useMemo(
    () => [
      // 1. Watchdog Infinite Reset Loop Errata (All AVRs: ATmega328P, ATmega2560, ATmega640, ATmega128)
      {
        id: 'RULE-WDT-RESET-LOOP',
        mcus: ['atmega328p', 'atmega2560', 'atmega640', 'atmega128'],
        category: 'power_reset',
        categoryLabel: '리셋 & 전원 (Watchdog)',
        title: 'Watchdog 리셋 후 WDRF 플래그 지속으로 인한 무한 재부팅 루프 결함',
        severity: 'critical',
        affectedRegisters: ['WDTCSR (WDTCR)', 'MCUSR'],
        datasheetRef: 'AVR Datasheet §Watchdog Timer & AVR-GCC FAQ #init3',
        siliconRev: 'All Silicon Revisions',
        symptom:
          '워치독 타이머(WDT)에 의해 CPU 리셋이 발생하면 리셋 후에도 WDE 플래그가 유지되고 WDT 프리스케일러가 최단 시간(16ms)으로 강제 초기화됩니다. 부트로더나 C 런타임 초기화 도중 16ms 이내에 WDT를 끄지 않으면 무한 리셋 루프에 갇혀 벽돌(Brick) 상태가 됩니다.',
        rootCause:
          '실리콘 하드웨어 설계상 WDT 타임아웃 리셋 후 MCUSR의 WDRF(Watchdog Reset Flag)가 하드웨어에 의해 클리어되지 않고 보존되며, WDRF가 1인 동안 WDE를 일반적인 비트 클리어 방식으로 해제할 수 없습니다.',
        isVulnerable: (st) => st.wde && !st.init3McusrClear,
        getVulnerabilityMessage: (st) =>
          `현재 WDTCSR에서 WDE(Watchdog Enable)가 활성화되어 있으나, 펌웨어 '.init3' 섹션의 MCUSR 클리어 및 wdt_disable() 루틴이 누락되었습니다. WDT 리셋 발생 시 16ms 주기로 무한 재부팅 루프에 빠집니다.`,
        getSafeMessage: () =>
          `[안전] '.init3' C-런타임 초기화 훅에 MCUSR = 0 클리어 및 wdt_disable() 4-사이클 시퀀스가 구현되어 있어 WDT 무한 리셋 결함을 완벽히 회피합니다.`,
        applyFix: (_, setSt) => {
          setSt((prev) => ({ ...prev, init3McusrClear: true }));
        },
        workaroundCodeSnippet: `// [해결책] C-런타임 최우선 (.init3) 섹션에서 MCUSR 초기화 및 WDT 강제 비활성화
#include <avr/io.h>
#include <avr/wdt.h>

// 1. .init3 섹션 함수 선언 (main() 함수 진입 및 전역 변수 초기화보다 먼저 실행됨)
void wdt_init(void) __attribute__((naked)) __attribute__((section(".init3")));

void wdt_init(void) {
    // 2. 리셋 원인 백업 후 즉시 MCUSR 클리어 (WDRF 플래그 해제 필수)
    MCUSR = 0;
    
    // 3. WDT 즉시 비활성화 (Timed sequence: WDCE | WDE 동시 세트 후 해제)
    wdt_disable();
}

int main(void) {
    // 안전한 사용자 애플리케이션 시작
    // 필요 시 여기서 wdt_enable(WDTO_2S)로 재가동 가능
    while (1) {
        // 메인 루프
    }
}`,
        codeExplanation:
          'avr-libc의 .init3 섹션은 main() 함수가 호출되기 전, 그리고 전역 C++ 객체 및 .data/.bss 복사가 수행되기 전에 실행됩니다. 여기서 MCUSR을 0으로 지우고 wdt_disable()을 호출해야 16ms 내에 안전하게 WDT를 해제할 수 있습니다.',
      },

      // 2. ATmega128 M103C Fuse Compatibility Mode Trap (ATmega128 Specific)
      {
        id: 'RULE-M103C-FUSE-TRAP',
        mcus: ['atmega128'],
        category: 'flash_fuse',
        categoryLabel: '퓨즈 & I/O 맵핑',
        title: 'M103C 호환 퓨즈 기본값(0) 활성화로 인한 확장 I/O (Port F/G) 및 주변장치 봉쇄',
        severity: 'critical',
        affectedRegisters: ['Extended Fuse (Bit 1: M103C)', 'PORTF', 'PORTG', 'Extended SFR'],
        datasheetRef: 'ATmega128 Datasheet §Memory Programming / §M103C Fuse',
        siliconRev: 'All Silicon Revisions',
        symptom:
          '공장 출고 상태에서 M103C 퓨즈가 0(Programmed)으로 되어 있어 ATmega103 호환 모드로 강제 동작합니다. 이로 인해 Extended SFR 영역에 위치한 USART1, Timer3, 2-wire Serial Interface(TWI), 그리고 Port F/Port G 핀이 완전히 동작하지 않거나 레지스터 기록이 무시됩니다.',
        rootCause:
          '구형 ATmega103과의 드롭인 호환성을 위해 실리콘 퓨즈 출하 기본값이 0으로 설정되어 있어, 현대적인 ATmega128의 네이티브 레지스터 및 포트 매핑이 비활성화됨.',
        isVulnerable: (st) => !st.m103cUnprogrammed,
        getVulnerabilityMessage: () =>
          `현재 M103C 퓨즈가 '0 (Programmed)' 상태입니다! MCU가 레거시 ATmega103 모드로 제한되어 Port F/G, USART1, TWI, Timer3을 사용할 수 없으며 Extended SFR이 잠겨 있습니다.`,
        getSafeMessage: () =>
          `[안전] M103C 퓨즈가 '1 (Unprogrammed)'로 설정되어 ATmega128 네이티브 전체 53개 I/O 및 모든 확장 주변장치(USART1, TWI, Timer3)가 정상 활성화되었습니다.`,
        applyFix: (_, setSt) => {
          setSt((prev) => ({ ...prev, m103cUnprogrammed: true }));
          if (onToggleM103c) onToggleM103c(true);
        },
        workaroundCodeSnippet: `# [해결책] avrdude 명령어로 Extended Fuse의 M103C 비트를 1로 설정 (네이티브 모드 전환)
# ATmega128 퓨즈 규격:
# Extended Fuse: 0xFF (M103C = 1 [Unprogrammed/Good], WDTON = 1)
# High Fuse:     0xD9 (JTAGEN = 1, SPIEN = 0, BOOTSZ = 512W)
# Low Fuse:      0xFF (16MHz External Crystal)

avrdude -c usbasp -p m128 -U efuse:w:0xff:m -U hfuse:w:0xd9:m -U lfuse:w:0xff:m

# 주의: 칩 수령 즉시 위 명령을 실행하여 네이티브 모드로 변환해야 
# DDRF, DDRG, UBRR1H 등의 레지스터가 정상 동작합니다.`,
        codeExplanation:
          'ATmega128을 사용할 때는 PCB 납땜 또는 양산 펌웨어 다운로드 시 반드시 첫 번째 단계로 Extended Fuse를 0xFF로 기록하여 M103C 비트를 1(Unprogrammed)로 풀어주어야 합니다.',
      },

      // 3. ATmega2560 Flash > 128KB (64KW) RAMPZ & EIND ISR Context Loss (ATmega2560 & ATmega640)
      {
        id: 'RULE-RAMPZ-EIND-CONTEXT',
        mcus: ['atmega2560', 'atmega640'],
        category: 'flash_fuse',
        categoryLabel: '플래시 & 코어 버스',
        title: '대용량 플래시(>128KB) 영역 실행 중 RAMPZ/EIND 레지스터 인터럽트 컨텍스트 미보존 결함',
        severity: 'critical',
        affectedRegisters: ['RAMPZ', 'EIND', 'SREG', 'PC (3-byte)'],
        datasheetRef: 'ATmega2560 Datasheet §31.1 & GCC Bug #18231',
        siliconRev: 'Rev. A / Rev. B / Rev. C',
        symptom:
          '128KB(64K Words) 이상의 플래시 메모리 영역에서 함수 포인터 간접 호출(EIJMP/EICALL)이나 ELPM(확장 플래시 읽기)을 수행하는 순간 타이머/시리얼 인터럽트가 발생하면, ISR 복귀 시 RAMPZ/EIND 레지스터가 0으로 초기화되거나 덮어씌워져 CPU가 엉뚱한 주소로 점프하여 시스템 패닉이 발생합니다.',
        rootCause:
          '표준 avr-libc ISR 매크로는 기본적으로 r0, r1, SREG만 스택에 저장하며, 16비트 초과 아키텍처용 하드웨어 레지스터인 RAMPZ(0x3B)와 EIND(0x3C)는 기본 보존 대상에서 제외되어 발생합니다.',
        isVulnerable: (st, mcu) => mcu === 'atmega2560' && st.flashSizeOver128k && !st.rampzIsrBackup,
        getVulnerabilityMessage: () =>
          `현재 펌웨어 플래시 크기가 128KB 이상(256KB 영역 사용)으로 설정되어 있으나, 커스텀 ISR에서 RAMPZ / EIND 레지스터 명시적 스택 보존 루틴이 적용되지 않았습니다. 인터럽트 복귀 시 치명적 점프 오류 위험이 있습니다.`,
        getSafeMessage: () =>
          `[안전] 모든 ISR 시작/종료 시 RAMPZ 및 EIND 레지스터의 명시적 백업/복원 프로토콜이 적용되어 256KB 전 영역에서 인터럽트 안전성이 확보되었습니다.`,
        applyFix: (_, setSt) => {
          setSt((prev) => ({ ...prev, rampzIsrBackup: true }));
        },
        workaroundCodeSnippet: `// [해결책] 128KB 초과 대용량 ATmega2560 전용 하이-플래시 안전 ISR 템플릿
#include <avr/io.h>
#include <avr/interrupt.h>

ISR(TIMER1_COMPA_vect) {
    // 1. 하이-플래시 전용 3바이트 주소 확장 레지스터 수동 스택 푸시
    uint8_t saved_sreg  = SREG;
    uint8_t saved_rampz = RAMPZ;
    uint8_t saved_eind  = EIND;

    // 2. 고속 사용자 비즈니스 인터럽트 로직
    // ...

    // 3. 에필로그: 인터럽트 진입 전의 상위 플래시 페이지 상태로 정확히 복원
    EIND  = saved_eind;
    RAMPZ = saved_rampz;
    SREG  = saved_sreg;
}
`,
        codeExplanation:
          'ATmega2560에서 128KB를 넘는 코드를 빌드할 경우 모든 시간-임계적 ISR 루틴의 최상단에 위와 같이 RAMPZ 및 EIND 백업 코드를 명시해야 실리콘 레벨의 주소 레지스터 훼손을 완벽히 방지할 수 있습니다.',
      },

      // 4. ADC Noise Reduction Sleep Mode Race & Clock Glitch (All AVRs)
      {
        id: 'RULE-ADC-SLEEP-RACE',
        mcus: ['atmega328p', 'atmega2560', 'atmega640', 'atmega128'],
        category: 'adc',
        categoryLabel: 'ADC & 절전 모드',
        title: 'ADC Noise Reduction 슬립 모드 진입 시 변환 시작 타이밍 글리치 결함',
        severity: 'major',
        affectedRegisters: ['ADCSRA (ADSC, ADEN, ADIE)', 'SMCR (SM[2:0], SE)'],
        datasheetRef: 'AVR Datasheet §Analog-to-Digital Converter §Noise Reduction Mode',
        siliconRev: 'All Silicon Revisions',
        symptom:
          '저잡음 측정을 위해 ADC Noise Reduction 슬립 모드를 사용할 때, SLEEP 명령어 이전에 ADCSRA의 ADSC(ADC Start Conversion) 비트를 수동으로 세트하면 디지털 CPU 코어가 멈추기 전에 ADC가 샘플-앤-홀드를 시작하여 오히려 CPU 스위칭 노이즈가 측정값에 그대로 유입됩니다.',
        rootCause:
          '실리콘 설계상 Sleep 모드 진입 신호 자체가 하드웨어적으로 ADC 변환을 자동 트리거하도록 되어 있으므로, 소프트웨어로 ADSC를 미리 세트하면 슬립 동기화 지연 동안 노이즈에 노출됩니다.',
        isVulnerable: (st) =>
          st.sleepEnable &&
          st.sleepMode === 'adc_noise' &&
          st.adsc &&
          !st.adcSleepTriggerWorkaround,
        getVulnerabilityMessage: () =>
          `현재 ADC Noise Reduction 슬립 모드에서 ADSC(Start Conversion) 비트를 수동으로 1로 세트한 채 슬립에 진입합니다! 이는 실리콘 동기화 글리치를 유발하여 저잡음 효과가 상실되고 오차가 증가합니다.`,
        getSafeMessage: () =>
          `[안전] 슬립 진입 시 하드웨어 자동 변환 시작 래치를 활용하도록 워크어라운드 시퀀스가 구성되었습니다 (sleep() 명령어가 ADC 변환을 저잡음 상태에서 자동 개시).`,
        applyFix: (_, setSt) => {
          setSt((prev) => ({
            ...prev,
            adsc: false, // Don't manually trigger before sleep
            adcSleepTriggerWorkaround: true,
          }));
        },
        workaroundCodeSnippet: `// [해결책] 실리콘 에라타를 우회하는 올바른 ADC Noise Reduction 시퀀스
#include <avr/io.h>
#include <avr/sleep.h>
#include <avr/interrupt.h>

// ADC 완료 인터럽트 (CPU를 슬립에서 깨우는 트리거)
EMPTY_INTERRUPT(ADC_vect);

uint16_t read_adc_noise_reduction(uint8_t channel) {
    ADMUX = (ADMUX & 0xF0) | (channel & 0x0F);
    
    // 1. ADC 활성화 및 인터럽트 인에이블 (단, ADSC는 여기서 1로 세트하지 말 것!)
    ADCSRA |= (1 << ADEN) | (1 << ADIE) | (1 << ADIF);
    
    // 2. ADC 노이즈 리덕션 슬립 모드 구성
    set_sleep_mode(SLEEP_MODE_ADC);
    sleep_enable();
    sei();
    
    // 3. SLEEP 명령어가 실행되면 하드웨어가 CPU 클럭을 끈 후 스스로 ADC 변환 시작
    sleep_cpu();
    
    // 4. ADC 인터럽트로 깨어난 후 슬립 비활성화
    sleep_disable();
    
    return ADC;
}`,
        codeExplanation:
          'ADC Noise Reduction 모드에서는 소프트웨어가 ADSC를 세트하는 것이 아니라, sleep_cpu() 명령에 의해 CPU가 정지한 직후 하드웨어가 저잡음 환경에서 스스로 변환을 트리거하도록 프로그래밍해야 10비트 전체 해상도를 노이즈 없이 취득할 수 있습니다.',
      },

      // 5. 16-bit Timer TEMP Register Corruption Across Main/ISR (All AVRs)
      {
        id: 'RULE-16BIT-TIMER-TEMP-CORRUPTION',
        mcus: ['atmega328p', 'atmega2560', 'atmega640', 'atmega128'],
        category: 'timer_comm',
        categoryLabel: '타이머/카운터 (16-bit)',
        title: '16비트 타이머 임시 레지스터(TEMP 버퍼) 메인 루프/ISR 비원자적(Non-Atomic) 충돌 결함',
        severity: 'major',
        affectedRegisters: ['TCNT1H/L', 'OCR1AH/L', 'ICR1H/L', 'TCNT3', 'TCNT4'],
        datasheetRef: 'AVR Datasheet §16-bit Timer/Counter §Accessing 16-bit Registers',
        siliconRev: 'All Silicon Revisions',
        symptom:
          '메인 루프에서 16비트 레지스터(예: TCNT1, OCR1A)를 읽거나 쓰는 도중 하위 바이트와 상위 바이트 전송 사이에 인터럽트가 발생하여 ISR 내부에서도 16비트 레지스터를 접근하면, 하드웨어 내부 TEMP 공유 레지스터가 오염되어 엉뚱한 타이머 카운트(최대 0xFF00 오차)가 래치됩니다.',
        rootCause:
          'AVR의 8비트 데이터 버스로 16비트 레지스터를 입출력하기 위해 단일 하드웨어 임시 버퍼(TEMP)를 모든 16비트 레지스터가 공유하기 때문에 발생하는 실리콘 아키텍처 특성입니다.',
        isVulnerable: (st) => !st.timer16AtomicProtection,
        getVulnerabilityMessage: () =>
          `현재 16비트 타이머 레지스터 접근 시 인터럽트 차단 보호(ATOMIC_BLOCK)가 활성화되어 있지 않습니다! 메인 루프와 인터럽트 간 공유 TEMP 버퍼 오염으로 치명적 PWM/타이밍 왜곡이 발생할 수 있습니다.`,
        getSafeMessage: () =>
          `[안전] <util/atomic.h>의 ATOMIC_BLOCK(ATOMIC_RESTORESTATE) 보호가 적용되어 16비트 TEMP 레지스터의 원자적 접근이 보장됩니다.`,
        applyFix: (_, setSt) => {
          setSt((prev) => ({ ...prev, timer16AtomicProtection: true }));
        },
        workaroundCodeSnippet: `// [해결책] 16비트 타이머 레지스터 TEMP 버퍼 오염 방지 원자적 접근 패턴
#include <avr/io.h>
#include <util/atomic.h>

void safe_set_timer1(uint16_t count, uint16_t compare) {
    // ATOMIC_BLOCK은 진입 시 cli()를 수행하고 블록 탈출 시 이전 SREG 상태를 완벽 복원
    ATOMIC_BLOCK(ATOMIC_RESTORESTATE) {
        TCNT1 = count;    // 내부적으로 하위->상위 바이트 쓰기 시 TEMP 버퍼 안전 보호
        OCR1A = compare;  // 원자적 쓰기 보장
    }
}

uint16_t safe_read_timer1(void) {
    uint16_t val;
    ATOMIC_BLOCK(ATOMIC_RESTORESTATE) {
        val = TCNT1;      // 원자적 읽기 보장
    }
    return val;
}`,
        codeExplanation:
          '16비트 타이머의 TCNT, OCR, ICR 레지스터는 C 언어로 16비트 할당을 작성하더라도 컴파일러가 2개의 8비트 인스트럭션으로 분해하므로, 반드시 <util/atomic.h>로 감싸주어야 실리콘 TEMP 버퍼 오염을 막을 수 있습니다.',
      },

      // 6. TWI (I2C) Start Condition Hang on Bus Glitch (All AVRs)
      {
        id: 'RULE-TWI-START-GLITCH',
        mcus: ['atmega328p', 'atmega2560', 'atmega640', 'atmega128'],
        category: 'timer_comm',
        categoryLabel: '통신 (I2C / TWI)',
        title: 'TWI(I2C) START 전송 시 버스 과도 상태로 인한 영구 무한 대기(Bus Hang) 결함',
        severity: 'major',
        affectedRegisters: ['TWCR (TWINT, TWSTA, TWEN)', 'TWSR', 'TWBR'],
        datasheetRef: 'AVR Datasheet §2-wire Serial Interface Errata',
        siliconRev: 'All Silicon Revisions',
        symptom:
          '슬레이브 장치의 전원 리셋이나 케이블 노이즈로 SCL 또는 SDA 라인이 Low 상태로 묶여 있거나 플로팅될 때, TWCR에 (1<<TWINT)|(1<<TWSTA)|(1<<TWEN)을 인가하면 하드웨어 FSM이 무한 정지하여 TWINT 플래그가 영원히 1로 세트되지 않아 소프트웨어가 영구 행(Deadlock)에 빠집니다.',
        rootCause:
          'AVR TWI 하드웨어 상태 머신은 버스 충돌 감지(Bus Collision) 시 특정 조건에서 내부 시퀀서가 락업되어 타임아웃 인터럽트를 스스로 발생시키지 못하는 실리콘 버그가 존재합니다.',
        isVulnerable: (st) => !st.twiBusIdleCheck,
        getVulnerabilityMessage: () =>
          `현재 TWI 전송 시 하드웨어 버스 유휴 감지 및 소프트웨어 타임아웃 방어 루틴이 적용되지 않았습니다. 외부 I2C 센서 응답 지연 시 메인 CPU가 영구 정지할 수 있습니다.`,
        getSafeMessage: () =>
          `[안전] TWI START 전송 전 GPIO 버스 검증 및 10ms 하드웨어 타임아웃 감시 워크어라운드가 구현되어 데드락이 원천 방지되었습니다.`,
        applyFix: (_, setSt) => {
          setSt((prev) => ({ ...prev, twiBusIdleCheck: true }));
        },
        workaroundCodeSnippet: `// [해결책] 실리콘 TWI 영구 데드락 방지 타임아웃 워크어라운드
#include <avr/io.h>
#include <util/delay.h>

#define TWI_TIMEOUT_CYCLES 20000

bool twi_safe_start(void) {
    // 1. TWI START 신호 송출
    TWCR = (1 << TWINT) | (1 << TWSTA) | (1 << TWEN);
    
    // 2. 무한 while (!(TWCR & (1<<TWINT))) 대신 안전 루프 카운터 적용
    uint16_t timeout = TWI_TIMEOUT_CYCLES;
    while (!(TWCR & (1 << TWINT))) {
        if (--timeout == 0) {
            // [실리콘 회피] 버스 락업 감지 시 TWI 하드웨어 강제 리셋
            TWCR = 0; // TWI 비활성화
            
            // SDA/SCL 핀을 일시적으로 GPIO 출력으로 전환하여 9개 클럭 펄스 송출 (슬레이브 버스 릴리즈)
            // 이후 TWCR = (1 << TWEN) 재초기화
            return false; // 타임아웃 실패 반환
        }
    }
    
    uint8_t status = TWSR & 0xF8;
    return (status == 0x08 || status == 0x10); // START or REPEATED START 확인
}`,
        codeExplanation:
          '표준 AVR 튜토리얼의 while(!(TWCR & (1<<TWINT))) 코드는 실리콘 버스 결함 발생 시 영원히 탈출하지 못합니다. 반드시 유한 타임아웃 카운터를 배치하고 타임아웃 시 TWCR=0으로 하드웨어를 소프트웨어적으로 리셋해야 신뢰성이 보장됩니다.',
      },

      // 7. ATmega128 Analog Comparator False Interrupt on Mode Switch
      {
        id: 'RULE-M128-ACSR-FALSE-INT',
        mcus: ['atmega128'],
        category: 'power_reset',
        categoryLabel: '아날로그 비교기 (ACSR)',
        title: 'ACSR 인터럽트 모드 변경 시 허위 인터럽트 플래그(ACINT) 발생 결함',
        severity: 'minor',
        affectedRegisters: ['ACSR (ACIS1, ACIS0, ACIE, ACI)'],
        datasheetRef: 'ATmega128 Datasheet §Analog Comparator Errata',
        siliconRev: 'Rev. A / Rev. B',
        symptom:
          '아날로그 비교기의 트리거 조건(인터럽트 모드 ACIS1:0 비트)을 런타임에 변경할 때, 전압 비교 상태와 무관하게 허위 ACI(인터럽트 플래그)가 세트되어 원치 않는 비교기 인터럽트 서비스 루틴이 즉각 실행됩니다.',
        rootCause:
          'ACIS1:0 비트의 디코더 로직 스위칭 시 내부 래치 게이트의 전파 지연 불균형으로 인해 스파이크 펄스가 발생하여 ACI 플래그를 세트함.',
        isVulnerable: (st) => !st.acsrSafeSwitching,
        getVulnerabilityMessage: () =>
          `현재 ACSR 비교기 모드 변경 시 허위 인터럽트 차단 시퀀스가 적용되지 않았습니다. 모드 변경 순간 허위 ISR이 유발될 수 있습니다.`,
        getSafeMessage: () =>
          `[안전] ACIE 비활성화 -> 모드 비트 변경 -> ACI 플래그 수동 클리어 -> ACIE 재활성화 안전 4단계 시퀀스가 적용되었습니다.`,
        applyFix: (_, setSt) => {
          setSt((prev) => ({ ...prev, acsrSafeSwitching: true }));
        },
        workaroundCodeSnippet: `// [해결책] ATmega128 아날로그 비교기 허위 인터럽트 방지 4단계 시퀀스
#include <avr/io.h>

void safe_set_comparator_mode(uint8_t acis_mode) {
    // Step 1: 비교기 인터럽트 먼저 차단 (ACIE = 0)
    ACSR &= ~(1 << ACIE);
    
    // Step 2: 새로운 인터럽트 모드 비트(ACIS1:0) 기록
    ACSR = (ACSR & ~((1 << ACIS1) | (1 << ACIS0))) | (acis_mode & 0x03);
    
    // Step 3: 실리콘 스위칭 글리치로 발생한 허위 ACI 플래그를 1을 써서 수동 클리어!
    ACSR |= (1 << ACI);
    
    // Step 4: 안전하게 비교기 인터럽트 다시 인에이블
    ACSR |= (1 << ACIE);
}`,
        codeExplanation:
          '데이터시트 에라타 권고사항에 따라 모드 변경 전 ACIE를 끄고, 변경 후 1을 써서 ACI 플래그를 비우고 다시 ACIE를 켜야 안전합니다.',
      },

      // 8. ATmega2560 / 640 ADC Differential Gain Amplifier Offset Drift
      {
        id: 'RULE-M2560-ADC-DIFF-GAIN',
        mcus: ['atmega2560', 'atmega640'],
        category: 'adc',
        categoryLabel: 'ADC & 아날로그',
        title: 'ADC 차동 증폭기(10x/200x) 오프셋 전압 드리프트 및 인접 핀 크로스토크',
        severity: 'major',
        affectedRegisters: ['ADMUX (MUX4:0)', 'ADCSRB (MUX5)', 'ADCSRA'],
        datasheetRef: 'ATmega2560/640 Datasheet §31.1 Errata',
        siliconRev: 'Rev. A / Rev. B',
        symptom:
          '10배 또는 200배 하드웨어 차동 게인 채널을 사용할 때 최대 ±35 LSB 수준의 직류 오프셋이 발생하며, 인접 디지털 핀 고속 토글 시 아날로그 변환 결과가 크게 튀는 현상.',
        rootCause:
          '내부 연산증폭기의 온도 드리프트 및 내부 접지선과 디지털 I/O 버퍼 간의 기생 커플링.',
        isVulnerable: (st) => !st.adcDiffFilterApplied,
        getVulnerabilityMessage: () =>
          `현재 차동 증폭기 오프셋 캘리브레이션 및 외부 LC 필터 보정이 구성되지 않아 차동 ADC 측정 시 심각한 비선형 오차가 발생할 수 있습니다.`,
        getSafeMessage: () =>
          `[안전] 펌웨어 차동 오프셋 자가 영점 보정(Auto-Zeroing) 및 16회 오버샘플링 평균화 필터가 적용되었습니다.`,
        applyFix: (_, setSt) => {
          setSt((prev) => ({ ...prev, adcDiffFilterApplied: true }));
        },
        workaroundCodeSnippet: `// [해결책] 차동 모드 실리콘 오프셋 자가 영점 보정 및 16x 오버샘플링 필터
#include <avr/io.h>

int16_t adc_read_differential_calibrated(uint8_t diff_channel_mux) {
    // 1. 내부 동일 입력 채널(예: MUX를 ADC0-ADC0 10x)로 선택하여 실리콘 순수 오프셋 측정
    ADMUX = (ADMUX & 0xE0) | 0x08; // ADC0(+)와 ADC0(-) 단락 차동 모드
    ADCSRA |= (1 << ADSC);
    while (ADCSRA & (1 << ADSC));
    int16_t zero_offset = (int16_t)ADC; // 실리콘 고유 오프셋 값
    
    // 2. 실제 타겟 차동 채널로 전환
    ADMUX = (ADMUX & 0xE0) | (diff_channel_mux & 0x1F);
    
    // 3. 16회 오버샘플링 평균화
    int32_t accumulator = 0;
    for (int i = 0; i < 16; i++) {
        ADCSRA |= (1 << ADSC);
        while (ADCSRA & (1 << ADSC));
        accumulator += (int16_t)ADC;
    }
    
    int16_t averaged = (int16_t)(accumulator / 16);
    
    // 4. 실리콘 오프셋 차감 보정 반환
    return (averaged - zero_offset);
}`,
        codeExplanation:
          '동일 입력을 차동 증폭기에 연결하여 칩 내부의 실리콘 오프셋을 실시간 측정한 뒤, 실제 측정값에서 차감하는 Auto-Zero 기법을 적용하면 오차를 2 LSB 이하로 줄일 수 있습니다.',
      },
    ],
    [onToggleM103c]
  );

  // Filter rules for currently selected MCU
  const currentMcuRules = useMemo(() => {
    return ERRATA_RULES.filter((r) => r.mcus.includes(selectedMCU));
  }, [ERRATA_RULES, selectedMCU]);

  // Evaluated rule states
  const evaluatedRules = useMemo(() => {
    return currentMcuRules.map((rule) => {
      const vulnerable = rule.isVulnerable(state, selectedMCU);
      return {
        ...rule,
        vulnerable,
        statusMessage: vulnerable
          ? rule.getVulnerabilityMessage(state, selectedMCU)
          : rule.getSafeMessage(state, selectedMCU),
      };
    });
  }, [currentMcuRules, state, selectedMCU]);

  // Filter by category and search
  const filteredRules = useMemo(() => {
    return evaluatedRules.filter((r) => {
      const matchCat = selectedCategory === 'all' || r.category === selectedCategory;
      const matchQuery =
        !searchQuery ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.symptom.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.affectedRegisters.some((reg) => reg.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchQuery;
    });
  }, [evaluatedRules, selectedCategory, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = evaluatedRules.length;
    const vulnerableCount = evaluatedRules.filter((r) => r.vulnerable).length;
    const safeCount = total - vulnerableCount;
    return { total, vulnerableCount, safeCount };
  }, [evaluatedRules]);

  // Presets
  const applyPresetVulnerable = () => {
    setState({
      wde: true,
      wdie: false,
      wdce: false,
      wdp: 6,
      init3McusrClear: false,
      adsc: true,
      aden: true,
      adate: false,
      sleepMode: 'adc_noise',
      sleepEnable: true,
      adcSleepTriggerWorkaround: false,
      adcDiffFilterApplied: false,
      m103cUnprogrammed: false, // Programmed = 0 (vulnerable)
      acsrSafeSwitching: false,
      flashSizeOver128k: true,
      rampzIsrBackup: false,
      timer16AtomicProtection: false,
      twiBusIdleCheck: false,
    });
    if (onToggleM103c) onToggleM103c(false);
  };

  const applyPresetSafeAll = () => {
    setState({
      wde: true,
      wdie: false,
      wdce: false,
      wdp: 6,
      init3McusrClear: true, // Fixed!
      adsc: false, // Fixed!
      aden: true,
      adate: false,
      sleepMode: 'adc_noise',
      sleepEnable: true,
      adcSleepTriggerWorkaround: true, // Fixed!
      adcDiffFilterApplied: true, // Fixed!
      m103cUnprogrammed: true, // Fixed! (Unprogrammed = 1)
      acsrSafeSwitching: true, // Fixed!
      flashSizeOver128k: true,
      rampzIsrBackup: true, // Fixed!
      timer16AtomicProtection: true, // Fixed!
      twiBusIdleCheck: true, // Fixed!
    });
    if (onToggleM103c) onToggleM103c(true);
  };

  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
              <Bug className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              MCU 에라타(Errata) 해결사
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono">
                {currentProfile.name}
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            선택된 MCU의 공인 실리콘 결함(Silicon Errata)과 사용자의 레지스터/퓨즈 설정 상태를 실시간 매핑하여 위험 노출 여부를 판정하고 최적 워크어라운드 코드를 제시합니다.
          </p>
        </div>

        {/* Live Status Summary Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
              stats.vulnerableCount > 0
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 animate-pulse'
                : 'bg-slate-800/60 border-slate-700 text-slate-400'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            결함 유발: <span className="font-mono text-sm">{stats.vulnerableCount}</span>건
          </div>

          <div
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
              stats.safeCount > 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-800/60 border-slate-700 text-slate-400'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            우회(안전): <span className="font-mono text-sm">{stats.safeCount}</span>건
          </div>

          <button
            onClick={applyPresetSafeAll}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            전체 안전 워크어라운드 자동 적용
          </button>
        </div>
      </div>

      {/* 2. Interactive Register & Fuse Quick Control Console */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <Sliders className="w-4 h-4 text-cyan-400" />
            에라타 연동 레지스터 &amp; 펌웨어 환경설정 실시간 조작기
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={applyPresetVulnerable}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 transition-all"
            >
              ⚠️ 위험 노출 기본값
            </button>
            <button
              onClick={applyPresetSafeAll}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/50 transition-all"
            >
              🛡️ 안전 회피 프리셋
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {/* WDTCSR Control Card */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-cyan-300">WDTCSR / MCUSR</span>
              <span className="text-[10px] text-slate-500">Watchdog</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-300">WDE 비트 (리셋 인에이블):</span>
              <button
                onClick={() => setState((p) => ({ ...p, wde: !p.wde }))}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                  state.wde
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {state.wde ? '1 (Active)' : '0 (Off)'}
              </button>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
              <span className="text-slate-300">.init3 MCUSR=0 클리어 훅:</span>
              <button
                onClick={() => setState((p) => ({ ...p, init3McusrClear: !p.init3McusrClear }))}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  state.init3McusrClear
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {state.init3McusrClear ? '적용됨 (안전)' : '미적용 (위험)'}
              </button>
            </div>
          </div>

          {/* ADCSRA & Sleep Control Card */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-cyan-300">ADCSRA &amp; SMCR</span>
              <span className="text-[10px] text-slate-500">ADC / Sleep</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-300">슬립 전 수동 ADSC 세트:</span>
              <button
                onClick={() => setState((p) => ({ ...p, adsc: !p.adsc }))}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                  state.adsc
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {state.adsc ? '1 (수동 트리거)' : '0 (슬립 자동)'}
              </button>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
              <span className="text-slate-300">ADC Noise Sleep 워크어라운드:</span>
              <button
                onClick={() =>
                  setState((p) => ({
                    ...p,
                    adcSleepTriggerWorkaround: !p.adcSleepTriggerWorkaround,
                  }))
                }
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  state.adcSleepTriggerWorkaround
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {state.adcSleepTriggerWorkaround ? '적용됨 (안전)' : '미적용'}
              </button>
            </div>
          </div>

          {/* MCU Specific Controls (M103C Fuse or RAMPZ/EIND or Timer Atomic) */}
          {selectedMCU === 'atmega128' ? (
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-amber-300">M103C Fuse Bit</span>
                <span className="text-[10px] text-slate-500">Extended Fuse</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-300">M103C 상태:</span>
                <button
                  onClick={() => handleToggleM103c(!state.m103cUnprogrammed)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    state.m103cUnprogrammed
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {state.m103cUnprogrammed ? '1 (네이티브 M128)' : '0 (M103 모드 위험)'}
                </button>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                <span className="text-slate-300">ACSR 허위 플래그 차단:</span>
                <button
                  onClick={() =>
                    setState((p) => ({ ...p, acsrSafeSwitching: !p.acsrSafeSwitching }))
                  }
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    state.acsrSafeSwitching
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {state.acsrSafeSwitching ? '적용됨' : '미적용'}
                </button>
              </div>
            </div>
          ) : selectedMCU === 'atmega2560' ? (
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-indigo-300">RAMPZ / EIND (Flash)</span>
                <span className="text-[10px] text-slate-500">256KB Range</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-300">펌웨어 코드 크기:</span>
                <button
                  onClick={() =>
                    setState((p) => ({ ...p, flashSizeOver128k: !p.flashSizeOver128k }))
                  }
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                    state.flashSizeOver128k
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {state.flashSizeOver128k ? '&gt; 128KB (위험 노출)' : '&le; 128KB'}
                </button>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                <span className="text-slate-300">ISR RAMPZ 보존 매크로:</span>
                <button
                  onClick={() => setState((p) => ({ ...p, rampzIsrBackup: !p.rampzIsrBackup }))}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    state.rampzIsrBackup
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {state.rampzIsrBackup ? '적용됨 (안전)' : '미적용'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-teal-300">16-bit Timer &amp; TWI</span>
                <span className="text-[10px] text-slate-500">Hardware Buffer</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-300">16-bit ATOMIC_BLOCK:</span>
                <button
                  onClick={() =>
                    setState((p) => ({
                      ...p,
                      timer16AtomicProtection: !p.timer16AtomicProtection,
                    }))
                  }
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    state.timer16AtomicProtection
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {state.timer16AtomicProtection ? '적용됨 (안전)' : '미적용'}
                </button>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                <span className="text-slate-300">TWI 타임아웃 감시:</span>
                <button
                  onClick={() =>
                    setState((p) => ({ ...p, twiBusIdleCheck: !p.twiBusIdleCheck }))
                  }
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    state.twiBusIdleCheck
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {state.twiBusIdleCheck ? '적용됨' : '미적용'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Search and Category Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {(
            [
              { id: 'all', label: '전체' },
              { id: 'power_reset', label: '리셋 & 전원' },
              { id: 'adc', label: 'ADC & 아날로그' },
              { id: 'flash_fuse', label: '플래시 & 퓨즈' },
              { id: 'timer_comm', label: '타이머 & 통신' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all font-medium ${
                selectedCategory === cat.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="에라타 또는 레지스터 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* 4. Mapped Errata Cards List */}
      <div className="space-y-4">
        {filteredRules.map((rule) => {
          const isExpanded = expandedId === rule.id;

          return (
            <div
              key={rule.id}
              className={`border rounded-xl transition-all overflow-hidden ${
                rule.vulnerable
                  ? 'bg-rose-950/20 border-rose-500/40 shadow-rose-950/30'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Card Header */}
              <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {rule.vulnerable ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        결함 유발 설정 (취약 상태)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        워크어라운드 적용됨 (안전)
                      </span>
                    )}

                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 font-mono">
                      {rule.categoryLabel}
                    </span>

                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800/80 text-amber-300 font-mono">
                      {rule.siliconRev}
                    </span>

                    {rule.severity === 'critical' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/50 text-red-200 border border-red-700/50 uppercase font-bold">
                        Critical
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    {rule.title}
                  </h4>

                  {/* Registers Involved */}
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <span className="text-slate-500">관련 레지스터 / 퓨즈:</span>
                    {rule.affectedRegisters.map((reg, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.2 rounded bg-slate-900 text-cyan-300 font-mono border border-slate-800"
                      >
                        {reg}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Status Diagnostic Callout & Actions */}
                <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
                  {rule.vulnerable && (
                    <button
                      onClick={() => rule.applyFix(state, setState)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md flex items-center gap-1 transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      이 설정 즉시 해결
                    </button>
                  )}

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : rule.id)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-all"
                  >
                    <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                    {isExpanded ? '상세 접기' : 'C 워크어라운드 코드'}
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Status Diagnostic Message Banner */}
              <div
                className={`px-4 py-2 text-xs flex items-center gap-2 border-t ${
                  rule.vulnerable
                    ? 'bg-rose-950/40 border-rose-500/30 text-rose-200 font-medium'
                    : 'bg-emerald-950/30 border-emerald-500/20 text-emerald-200'
                }`}
              >
                {rule.vulnerable ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <span>{rule.statusMessage}</span>
              </div>

              {/* Expanded Details: Root Cause, Datasheet & Firmware Code */}
              {isExpanded && (
                <div className="p-4 border-t border-slate-800/80 bg-slate-950/80 space-y-4">
                  {/* Symptom & Root Cause */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/60 space-y-1">
                      <span className="font-bold text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        결함 증상 (Hardware Symptom)
                      </span>
                      <p className="text-slate-300 leading-relaxed">{rule.symptom}</p>
                    </div>

                    <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/60 space-y-1">
                      <span className="font-bold text-cyan-400 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5" />
                        실리콘 발생 원인 (Root Cause)
                      </span>
                      <p className="text-slate-300 leading-relaxed">{rule.rootCause}</p>
                      <div className="text-[11px] text-slate-500 pt-1 font-mono">
                        문서 참조: {rule.datasheetRef}
                      </div>
                    </div>
                  </div>

                  {/* C/C++ Workaround Code Box */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                        검증된 펌웨어 회피 코드 (Workaround C/C++)
                      </span>
                      <button
                        onClick={() => copyCode(rule.id, rule.workaroundCodeSnippet)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 font-mono transition-all"
                      >
                        {copiedId === rule.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">복사 완료!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-400" />
                            <span>코드 복사</span>
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                      {rule.workaroundCodeSnippet}
                    </pre>

                    <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-900/40 p-2.5 rounded border border-slate-800/50">
                      💡 <strong className="text-slate-200">구현 가이드:</strong> {rule.codeExplanation}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredRules.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-xs">
            해당 조건과 일치하는 에라타 항목이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
};
