import React, { useState, useMemo } from 'react';
import {
  Moon,
  Zap,
  Battery,
  Sliders,
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
  Cpu,
  Layers,
  ArrowRight,
  ShieldAlert,
  Info,
  Code2,
  Clock,
  Sparkles,
  TrendingDown,
  Gauge,
  Flame,
  Radio,
  Timer,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

export interface SleepModeEnergyAdvisorProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type AvrSleepMode =
  | 'idle'
  | 'adc_noise_reduction'
  | 'power_down'
  | 'power_save'
  | 'standby'
  | 'ext_standby';

interface SleepModeDefinition {
  id: AvrSleepMode;
  name: string;
  nameKo: string;
  cMacro: string;
  smBits: string;
  description: string;
  clkCpu: boolean;
  clkFlash: boolean;
  clkIO: boolean;
  clkAdc: boolean;
  clkAsy: boolean;
  oscillatorHalted: boolean;
  wakeSources: string[];
  wakeLatencyCycles: number | string;
  color: string;
}

const SLEEP_MODES: SleepModeDefinition[] = [
  {
    id: 'idle',
    name: 'Idle Mode',
    nameKo: '아이들 모드',
    cMacro: 'SLEEP_MODE_IDLE',
    smBits: 'SM2:0 = 000',
    description: 'CPU와 플래시 클럭만 중지되며, I/O 클럭, ADC, SPI, USART, 타이머는 계속 동작하여 빠른 복귀가 가능합니다.',
    clkCpu: false,
    clkFlash: false,
    clkIO: true,
    clkAdc: true,
    clkAsy: true,
    oscillatorHalted: false,
    wakeSources: ['모든 외부/핀체인지 인터럽트', '타이머 오버플로/비교일치', 'SPI 전송완료', 'USART RX/TX', 'ADC 변환완료', 'WDT', '아날로그 비교기'],
    wakeLatencyCycles: '6 클럭 사이클 (~0.38 µs)',
    color: '#3b82f6' // Blue
  },
  {
    id: 'adc_noise_reduction',
    name: 'ADC Noise Reduction',
    nameKo: 'ADC 노이즈 감소 모드',
    cMacro: 'SLEEP_MODE_ADC',
    smBits: 'SM2:0 = 001',
    description: 'CPU, Flash 및 I/O 클럭을 중지하여 고정밀 10비트 ADC 변환 시 디지털 스위칭 잡음을 원천 차단합니다.',
    clkCpu: false,
    clkFlash: false,
    clkIO: false,
    clkAdc: true,
    clkAsy: true,
    oscillatorHalted: false,
    wakeSources: ['ADC 변환완료', '외부 인터럽트(INT0/1, PCINT)', '타이머2 비동기 인터럽트', 'WDT', 'TWI 주소일치'],
    wakeLatencyCycles: '6 클럭 사이클 (~0.38 µs)',
    color: '#06b6d4' // Cyan
  },
  {
    id: 'power_down',
    name: 'Power-down Mode',
    nameKo: '파워다운 모드 (극초절전)',
    cMacro: 'SLEEP_MODE_PWR_DOWN',
    smBits: 'SM2:0 = 010',
    description: '메인 오실레이터를 포함한 모든 클럭이 정지하는 최저 전력 모드로, 나노암페어(nA) 대기 전류를 실현합니다.',
    clkCpu: false,
    clkFlash: false,
    clkIO: false,
    clkAdc: false,
    clkAsy: false,
    oscillatorHalted: true,
    wakeSources: ['외부 로우레벨/핀체인지 인터럽트(INT, PCINT)', 'WDT 타임아웃 인터럽트', 'TWI(I2C) 하드웨어 주소 일치'],
    wakeLatencyCycles: '16,000 클럭 사이클 (~1 ms 크리스탈 기상)',
    color: '#10b981' // Emerald
  },
  {
    id: 'power_save',
    name: 'Power-save Mode',
    nameKo: '파워세이브 모드 (RTC 유지)',
    cMacro: 'SLEEP_MODE_PWR_SAVE',
    smBits: 'SM2:0 = 011',
    description: '파워다운과 유사하지만 Timer2에 연결된 32.768kHz 외장 시계 크리스탈(TOSC)이 계속 동작하여 실시간 시계(RTC)를 유지합니다.',
    clkCpu: false,
    clkFlash: false,
    clkIO: false,
    clkAdc: false,
    clkAsy: true,
    oscillatorHalted: true,
    wakeSources: ['타이머2 오버플로/비교일치(RTC 틱)', '외부 인터럽트(INT, PCINT)', 'WDT', 'TWI 주소일치'],
    wakeLatencyCycles: '16,000 클럭 사이클 (~1 ms)',
    color: '#8b5cf6' // Violet
  },
  {
    id: 'standby',
    name: 'Standby Mode',
    nameKo: '스탠바이 모드 (고속 기상)',
    cMacro: 'SLEEP_MODE_STANDBY',
    smBits: 'SM2:0 = 110',
    description: '파워다운 상태와 동일하나 메인 크리스탈 오실레이터가 정지하지 않고 계속 발진하여 단 6사이클 만에 기상합니다.',
    clkCpu: false,
    clkFlash: false,
    clkIO: false,
    clkAdc: false,
    clkAsy: false,
    oscillatorHalted: false,
    wakeSources: ['외부 인터럽트(INT, PCINT)', 'WDT', 'TWI 주소일치'],
    wakeLatencyCycles: '6 클럭 사이클 (~0.38 µs)',
    color: '#f59e0b' // Amber
  },
  {
    id: 'ext_standby',
    name: 'Extended Standby Mode',
    nameKo: '확장 스탠바이 모드',
    cMacro: 'SLEEP_MODE_EXT_STANDBY',
    smBits: 'SM2:0 = 111',
    description: '파워세이브 상태에서 메인 오실레이터까지 유지하여 비동기 32kHz 타이머 구동과 초고속 6사이클 기상을 동시 지원합니다.',
    clkCpu: false,
    clkFlash: false,
    clkIO: false,
    clkAdc: false,
    clkAsy: true,
    oscillatorHalted: false,
    wakeSources: ['타이머2 비동기 인터럽트', '외부 인터럽트(INT, PCINT)', 'WDT', 'TWI 주소일치'],
    wakeLatencyCycles: '6 클럭 사이클 (~0.38 µs)',
    color: '#ec4899' // Pink
  }
];

export const SleepModeEnergyAdvisor: React.FC<SleepModeEnergyAdvisorProps> = ({
  selectedMCU,
  onSelectMCU
}) => {
  const profile = MCU_PROFILES[selectedMCU];

  // 1. Core Operating Conditions
  const [selectedSleepMode, setSelectedSleepMode] = useState<AvrSleepMode>('power_down');
  const [voltage, setVoltage] = useState<number>(() => (selectedMCU === 'atmega128' ? 5.0 : 3.3));
  const [frequencyMhz, setFrequencyMhz] = useState<number>(16.0);

  // 2. Peripheral Power Consumers
  const [enableAdc, setEnableAdc] = useState<boolean>(false); // ADEN in ADCSRA
  const [enableAnalogComp, setEnableAnalogComp] = useState<boolean>(false); // ACD in ACSR
  const [enableBod, setEnableBod] = useState<boolean>(true); // BOD fuse / software sleep BOD
  const [enableBodsDisable, setEnableBodsDisable] = useState<boolean>(true); // BODS bit in MCUCR (Sleep BOD Disable)
  const [enableWdt, setEnableWdt] = useState<boolean>(true); // WDT in WDTCSR (128kHz osc)
  const [enableInternalBandgap, setEnableInternalBandgap] = useState<boolean>(false); // Bandgap 1.1V
  const [enableTimer2Rtc, setEnableTimer2Rtc] = useState<boolean>(false); // 32.768kHz crystal on TOSC
  const [floatingPinsCount, setFloatingPinsCount] = useState<number>(0); // Floating input GPIOs

  // 3. System Duty Cycle & Battery Configuration
  const [activeDurationMs, setActiveDurationMs] = useState<number>(20); // Active time per cycle
  const [sleepDurationSec, setSleepDurationSec] = useState<number>(10); // Sleep interval
  const [batteryCapacityMah, setBatteryCapacityMah] = useState<number>(220); // e.g. CR2032 = 220mAh, 2x AAA = 1000mAh
  const [batterySelfDischargeRate, setBatterySelfDischargeRate] = useState<number>(1.5); // % per year

  // 4. Code Generation Tab
  const [codeTab, setCodeTab] = useState<'standard' | 'bods_optimized' | 'wdt_wakeup' | 'rtc_wakeup'>('bods_optimized');
  const [copiedCode, setCopiedCode] = useState(false);

  // Sleep mode metadata
  const currentSleepDef = useMemo(() => {
    return SLEEP_MODES.find(m => m.id === selectedSleepMode) || SLEEP_MODES[2];
  }, [selectedSleepMode]);

  // Electrical Model Calculations
  const calculations = useMemo(() => {
    const isPicoPower = selectedMCU === 'atmega328p';
    const v = voltage;
    const f = frequencyMhz;

    // --- 1. Active Mode Current (mA) ---
    // Scaled by frequency and voltage
    let baseActive_mA = 0;
    if (isPicoPower) {
      // ATmega328P: ~0.2 mA/MHz at 3.3V, ~0.55 mA/MHz at 5V + static
      const k = 0.08 * Math.pow(v / 3.3, 1.4);
      baseActive_mA = f * k * 4.2 + 0.3 * (v / 5.0);
    } else if (selectedMCU === 'atmega128') {
      // Classic ATmega128A: ~0.8 mA/MHz at 5V, higher static leakage
      baseActive_mA = f * 0.9 * (v / 5.0) + 1.2;
    } else {
      // ATmega640
      baseActive_mA = f * 0.75 * (v / 5.0) + 0.8;
    }

    // --- 2. Base Sleep Core Current (µA) ---
    // Grounded in Microchip datasheet typical characteristics
    let baseCoreSleep_uA = 0;

    switch (selectedSleepMode) {
      case 'idle':
        // Idle: CPU stopped, but peripheral clock distribution network is active
        // ~35% of active current
        baseCoreSleep_uA = (baseActive_mA * 0.35) * 1000;
        break;

      case 'adc_noise_reduction':
        // ADC Noise: CPU and IO stopped, ADC and main osc running
        // ~15% of active current + ADC core
        baseCoreSleep_uA = (baseActive_mA * 0.12) * 1000;
        break;

      case 'standby':
        // Main high-speed crystal oscillator running, everything else stopped
        // Typically 35 µA at 3.3V, 75 µA at 5V on 328P; higher on mega128
        baseCoreSleep_uA = isPicoPower ? 35 * (v / 3.3) : 95 * (v / 5.0);
        break;

      case 'ext_standby':
        // Main oscillator + 32kHz async timer
        baseCoreSleep_uA = isPicoPower ? 38 * (v / 3.3) : 105 * (v / 5.0);
        break;

      case 'power_save':
        // Power-down + 32.768kHz crystal oscillator
        // 328P: ~0.8 µA at 3.3V, ~1.4 µA at 5V
        const rtcLeakage = isPicoPower ? 0.75 * (v / 3.3) : 2.5 * (v / 5.0);
        const pwrSaveBase = isPicoPower ? 0.2 * (v / 3.3) : 5.0 * (v / 5.0);
        baseCoreSleep_uA = pwrSaveBase + rtcLeakage;
        break;

      case 'power_down':
      default:
        // Deepest sleep: All clocks halted
        // ATmega328P: 0.1 µA @ 1.8V, 0.2 µA @ 3.3V, 0.9 µA @ 5V (without WDT)
        // ATmega128: 3.5 µA @ 3.3V, 8.0 µA @ 5V
        if (isPicoPower) {
          baseCoreSleep_uA = v <= 2.0 ? 0.1 : v <= 3.3 ? 0.25 : 0.85;
        } else if (selectedMCU === 'atmega128') {
          baseCoreSleep_uA = 3.5 * Math.pow(v / 3.3, 1.2);
        } else {
          baseCoreSleep_uA = 2.0 * Math.pow(v / 3.3, 1.2);
        }
        break;
    }

    // --- 3. Peripheral Additive Current (µA) ---
    // Check which peripherals are enabled AND whether they actually consume power in this sleep mode
    let adcCurrent_uA = 0;
    if (enableAdc) {
      // In Power-down / Standby / Power-save, if ADEN is NOT cleared before sleep,
      // the ADC voltage reference and bias ladder remain active and draw ~230 µA!
      // In Idle / ADC mode, active conversion draws ~250 µA.
      adcCurrent_uA = 230 * (v / 3.3);
    }

    let acCurrent_uA = 0;
    if (enableAnalogComp) {
      // Analog Comparator draws ~70 µA if not disabled via ACSR (ACD=1)
      acCurrent_uA = 70 * (v / 3.3);
    }

    let bodCurrent_uA = 0;
    if (enableBod) {
      // If BOD is active during sleep:
      // ATmega328P has software BOD disable (BODS in MCUCR), saving 20-25 µA!
      // If BODS disable is enabled and sleep mode is Power-down / Power-save: BOD is disabled during sleep
      const isBodSleeping = enableBodsDisable && isPicoPower && (selectedSleepMode === 'power_down' || selectedSleepMode === 'power_save');
      if (!isBodSleeping) {
        bodCurrent_uA = isPicoPower ? 20 * (v / 3.3) : 40 * (v / 5.0);
      }
    }

    let wdtCurrent_uA = 0;
    if (enableWdt) {
      // Watchdog Timer 128kHz internal low-power RC oscillator
      // ~4.5 µA at 3.3V on 328P, ~8 µA on mega128
      wdtCurrent_uA = isPicoPower ? 4.5 * (v / 3.3) : 8.5 * (v / 5.0);
    }

    let bandgapCurrent_uA = 0;
    if (enableInternalBandgap) {
      // Bandgap voltage reference (1.1V) consumes ~15 µA
      bandgapCurrent_uA = 15 * (v / 3.3);
    }

    let timer2Current_uA = 0;
    if (enableTimer2Rtc && (selectedSleepMode === 'idle' || selectedSleepMode === 'adc_noise_reduction')) {
      timer2Current_uA = 10 * (v / 3.3);
    }

    let floatingPinLeakage_uA = 0;
    if (floatingPinsCount > 0) {
      // A floating digital input pin sitting near VCC/2 causes shoot-through current
      // in the CMOS inverter buffer: ~100 to 250 µA per floating pin!
      floatingPinLeakage_uA = floatingPinsCount * 140 * (v / 3.3);
    }

    const totalPeripheralSleep_uA =
      adcCurrent_uA +
      acCurrent_uA +
      bodCurrent_uA +
      wdtCurrent_uA +
      bandgapCurrent_uA +
      timer2Current_uA +
      floatingPinLeakage_uA;

    // --- 4. Total Sleep Current ---
    const totalSleep_uA = baseCoreSleep_uA + totalPeripheralSleep_uA;
    const totalSleep_mA = totalSleep_uA / 1000;

    // --- 5. Duty Cycle & Battery Lifetime ---
    const cycleTotalSeconds = (activeDurationMs / 1000) + sleepDurationSec;
    const activeDutyFraction = (activeDurationMs / 1000) / cycleTotalSeconds;
    const sleepDutyFraction = sleepDurationSec / cycleTotalSeconds;

    // Average system current (mA)
    const avgCurrent_mA = (baseActive_mA * activeDutyFraction) + (totalSleep_mA * sleepDutyFraction);
    const avgCurrent_uA = avgCurrent_mA * 1000;

    // Battery Life (Hours & Years)
    const effectiveCapacityMah = batteryCapacityMah * 0.95; // 95% usable derating
    const lifeHours = avgCurrent_mA > 0 ? effectiveCapacityMah / avgCurrent_mA : 999999;
    const lifeDays = lifeHours / 24;
    const lifeYears = lifeDays / 365.25;

    // Active vs Sleep savings ratio
    const currentReductionRatio = baseActive_mA > 0 ? (1 - (totalSleep_mA / baseActive_mA)) * 100 : 0;

    return {
      baseActive_mA,
      baseCoreSleep_uA,
      adcCurrent_uA,
      acCurrent_uA,
      bodCurrent_uA,
      wdtCurrent_uA,
      bandgapCurrent_uA,
      timer2Current_uA,
      floatingPinLeakage_uA,
      totalPeripheralSleep_uA,
      totalSleep_uA,
      totalSleep_mA,
      activeDutyFraction,
      sleepDutyFraction,
      avgCurrent_mA,
      avgCurrent_uA,
      lifeHours,
      lifeDays,
      lifeYears,
      currentReductionRatio
    };
  }, [
    selectedMCU,
    selectedSleepMode,
    voltage,
    frequencyMhz,
    enableAdc,
    enableAnalogComp,
    enableBod,
    enableBodsDisable,
    enableWdt,
    enableInternalBandgap,
    enableTimer2Rtc,
    floatingPinsCount,
    activeDurationMs,
    sleepDurationSec,
    batteryCapacityMah
  ]);

  // Breakdown segments for proportional visualization
  const breakdownItems = useMemo(() => {
    const total = calculations.totalSleep_uA || 0.001;
    return [
      { name: 'MCU 코어 슬립 누설', val: calculations.baseCoreSleep_uA, color: currentSleepDef.color },
      { name: 'ADC 모듈 미해제 누설', val: calculations.adcCurrent_uA, color: '#f59e0b' },
      { name: '아날로그 비교기(AC)', val: calculations.acCurrent_uA, color: '#ec4899' },
      { name: 'Brown-out Detector (BOD)', val: calculations.bodCurrent_uA, color: '#ef4444' },
      { name: 'Watchdog Timer (WDT)', val: calculations.wdtCurrent_uA, color: '#8b5cf6' },
      { name: 'Bandgap 기준전압', val: calculations.bandgapCurrent_uA, color: '#14b8a6' },
      { name: '플로팅 입력 핀 누설', val: calculations.floatingPinLeakage_uA, color: '#dc2626' }
    ].filter(i => i.val > 0.01).map(i => ({
      ...i,
      percent: (i.val / total) * 100
    }));
  }, [calculations, currentSleepDef.color]);

  // Generate C Code
  const generatedCCode = useMemo(() => {
    if (codeTab === 'bods_optimized') {
      return `// ============================================================================
// ${profile.name} 초저전력 Power-down 슬립 + BODS 절전 C 코드
// 목표 소비 전류: 약 ${calculations.totalSleep_uA.toFixed(2)} µA (@ ${voltage}V)
// ============================================================================
#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/sleep.h>
#include <avr/power.h>

void enter_ultra_low_power_sleep(void) {
    // 1. ADC 모듈 전원 차단 (ADEN=0: 약 230 µA 누설 방지 필수!)
    ADCSRA &= ~(1 << ADEN);
    
    // 2. 아날로그 비교기 비활성화 (ACD=1: 약 70 µA 절감)
    ACSR |= (1 << ACD);

    // 3. 사용하지 않는 모든 디지털 핀 풀업 설정 (플로팅 슛스루 누설 방지)
    // DDRB = 0; PORTB = 0xFF; DDRC = 0; PORTC = 0xFF; DDRD = 0; PORTD = 0xFF;

    // 4. 슬립 모드 선택: ${currentSleepDef.cMacro}
    set_sleep_mode(${currentSleepDef.cMacro});
    
    // 5. 슬립 준비
    cli(); // 인터럽트 일시 정지 (경쟁 상태 방지)
    sleep_enable();

#if defined(BODS) && defined(BODSE)
    // 6. 슬립 중 BOD 자동 차단 (PicoPower 전용: 20 µA 절감)
    // 3사이클 이내에 BODS 쓰기 필수 하드웨어 시퀀스
    MCUCR |= (1 << BODS) | (1 << BODSE);
    MCUCR = (MCUCR & ~(1 << BODSE)) | (1 << BODS);
#endif

    sei();        // 전역 인터럽트 허용
    sleep_cpu();  // <--- MCU 정지 및 슬립 진입 (${calculations.totalSleep_uA.toFixed(2)} µA)

    // ========================================================================
    // 7. 기상 후 실행 (Wake-up): 인터럽트 루틴 실행 후 여기로 복귀
    // ========================================================================
    sleep_disable(); // 슬립 방지
    
    // 필요 시 ADC 다시 켜기
    // ADCSRA |= (1 << ADEN);
}`;
    }

    if (codeTab === 'wdt_wakeup') {
      return `// ============================================================================
// Watchdog Timer 주기적 기상 (WDT Periodic Wakeup)
// 주기: 8초마다 깨어나 센서 측정 후 다시 슬립 (배터리 수명: 약 ${calculations.lifeYears.toFixed(1)}년)
// ============================================================================
#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/sleep.h>
#include <avr/wdt.h>

volatile uint8_t g_wdt_fired = 0;

ISR(WDT_vect) {
    g_wdt_fired = 1; // 8초 주기 WDT 인터럽트 발생 시 플래그 설정
}

void setup_wdt_8sec(void) {
    MCUSR &= ~(1 << WDRF); // WDT 리셋 플래그 클리어
    // WDT 설정 변경 활성화 시퀀스
    WDTCSR |= (1 << WDCE) | (1 << WDE);
    // 8초 타임아웃 + 인터럽트 모드 (WDP3:0 = 1001, WDIE = 1)
    WDTCSR = (1 << WDIE) | (1 << WDP3) | (1 << WDP0);
}

void main_loop(void) {
    setup_wdt_8sec();
    while (1) {
        // 초절전 슬립 진입
        set_sleep_mode(SLEEP_MODE_PWR_DOWN);
        sleep_enable();
        sleep_cpu();
        sleep_disable();

        // 기상 후 1회 처리
        if (g_wdt_fired) {
            g_wdt_fired = 0;
            // 센서 측정 및 무선 송신 (${activeDurationMs}ms 활성 동작)
        }
    }
}`;
    }

    if (codeTab === 'rtc_wakeup') {
      return `// ============================================================================
// 32.768kHz RTC 크리스탈 기반 Power-save 모드 (Timer2 비동기 구동)
// 대기 전류: 약 ${calculations.totalSleep_uA.toFixed(2)} µA (시계 시간 정확히 유지)
// ============================================================================
#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/sleep.h>

ISR(TIMER2_OVF_vect) {
    // 1초마다 RTC 카운터 갱신
}

void setup_rtc_timer2(void) {
    // 1. 비동기 32.768kHz 크리스탈 발진기 활성화
    ASSR |= (1 << AS2);
    // 2. 128분주 (32768 / 128 / 256 = 딱 1초 주기)
    TCCR2B = (1 << CS22) | (1 << CS20);
    // 3. 레지스터 동기화 대기
    while (ASSR & ((1 << TCN2UB) | (1 << TCR2BUB)));
    // 4. 오버플로 인터럽트 인에이블
    TIMSK2 |= (1 << TOIE2);
}

void enter_power_save_rtc(void) {
    set_sleep_mode(SLEEP_MODE_PWR_SAVE);
    sleep_enable();
    sei();
    sleep_cpu();
    sleep_disable();
}`;
    }

    // standard
    return `// ============================================================================
// 표준 AVR-Libc <avr/sleep.h> 슬립 모드 구현
// 모드: ${currentSleepDef.cMacro} (${currentSleepDef.name})
// ============================================================================
#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/sleep.h>

void enter_sleep_mode(void) {
    set_sleep_mode(${currentSleepDef.cMacro});
    sleep_enable();
    sei();
    sleep_cpu();
    sleep_disable();
}`;
  }, [codeTab, profile.name, calculations, voltage, currentSleepDef, activeDurationMs]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <Moon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg font-bold text-white tracking-wide">
                Sleep Mode Energy-Consumption Advisor
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold">
                AVR 저전력 슬립 모드 어드바이저
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                {profile.fullName} ({voltage}V, {frequencyMhz}MHz)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              AVR 슬립 모드(Idle, ADC Noise Reduction, Power-down 등)와 주변장치 전원 설정에 따른 대기 소비 전류(µA) 및 배터리 수명을 실시간 예측합니다.
            </p>
          </div>
        </div>

        {/* Quick MCU Switch if prop provided */}
        {onSelectMCU && (
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs self-start lg:self-center">
            {(['atmega328p', 'atmega128', 'atmega640'] as SupportedMCU[]).map(mcu => (
              <button
                key={mcu}
                onClick={() => onSelectMCU(mcu)}
                className={`px-2.5 py-1 rounded-lg font-mono font-medium transition-all ${
                  selectedMCU === mcu
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mcu === 'atmega328p' ? '328P (PicoPower)' : mcu === 'atmega128' ? 'M128' : 'M640'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Sleep Current */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 relative overflow-hidden">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>슬립 모드 대기 전류</span>
            <Moon className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
            {calculations.totalSleep_uA < 1000 ? (
              <>
                {calculations.totalSleep_uA.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-400">µA</span>
              </>
            ) : (
              <>
                {calculations.totalSleep_mA.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-400">mA</span>
              </>
            )}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            코어 {calculations.baseCoreSleep_uA.toFixed(1)}µA + 주변장치 {calculations.totalPeripheralSleep_uA.toFixed(1)}µA
          </div>
        </div>

        {/* Energy Savings % */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>활성 대비 에너지 절감율</span>
            <TrendingDown className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-400 font-mono mt-1">
            {calculations.currentReductionRatio.toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            활성 {calculations.baseActive_mA.toFixed(1)}mA → 슬립 {calculations.totalSleep_uA.toFixed(1)}µA
          </div>
        </div>

        {/* Projected Battery Life */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>예상 배터리 수명 ({batteryCapacityMah}mAh)</span>
            <Battery className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono mt-1">
            {calculations.lifeYears >= 1 ? (
              <>
                {calculations.lifeYears.toFixed(1)}{' '}
                <span className="text-xs font-normal text-slate-400">년</span>
              </>
            ) : (
              <>
                {calculations.lifeDays.toFixed(0)}{' '}
                <span className="text-xs font-normal text-slate-400">일</span>
              </>
            )}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            평균 전류: {calculations.avgCurrent_uA.toFixed(1)} µA (듀티비 {((calculations.activeDutyFraction) * 100).toFixed(2)}%)
          </div>
        </div>

        {/* Wake-up Latency */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>기상 응답 지연 (Wake Latency)</span>
            <Timer className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-sm font-bold text-indigo-300 font-mono mt-2 truncate">
            {currentSleepDef.wakeLatencyCycles}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 truncate">
            {currentSleepDef.oscillatorHalted ? '⚠️ 크리스탈 안정화 대기 필요' : '✅ 발진기 유지 즉시 기상'}
          </div>
        </div>
      </div>

      {/* 6 AVR Sleep Modes Selection Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Moon className="w-3.5 h-3.5 text-emerald-400" />
            AVR 하드웨어 슬립 모드 선택 (SM2:0 레지스터)
          </span>
          <span className="text-slate-500">클릭하여 슬립 모드별 전력 및 클럭 상태를 비교하세요</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SLEEP_MODES.map(mode => {
            const isSelected = selectedSleepMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setSelectedSleepMode(mode.id)}
                className={`text-left p-3.5 rounded-xl border transition-all relative overflow-hidden group ${
                  isSelected
                    ? 'bg-slate-800/90 border-emerald-500/80 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block"
                      style={{ backgroundColor: mode.color }}
                    />
                    <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                      {mode.nameKo}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                    {mode.smBits}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                  {mode.description}
                </p>

                {/* Clock Status Tags */}
                <div className="flex items-center gap-1.5 text-[9px] font-mono flex-wrap">
                  <span className={`px-1.5 py-0.2 rounded ${mode.clkCpu ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-900 text-slate-500'}`}>
                    CPU: {mode.clkCpu ? 'ON' : 'OFF'}
                  </span>
                  <span className={`px-1.5 py-0.2 rounded ${mode.clkIO ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-900 text-slate-500'}`}>
                    IO: {mode.clkIO ? 'ON' : 'OFF'}
                  </span>
                  <span className={`px-1.5 py-0.2 rounded ${mode.clkAdc ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-900 text-slate-500'}`}>
                    ADC: {mode.clkAdc ? 'ON' : 'OFF'}
                  </span>
                  <span className={`px-1.5 py-0.2 rounded ${mode.clkAsy ? 'bg-violet-500/20 text-violet-300' : 'bg-slate-900 text-slate-500'}`}>
                    ASY: {mode.clkAsy ? 'ON' : 'OFF'}
                  </span>
                </div>

                {isSelected && (
                  <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-bl" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Proportional Current Breakdown Bar */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 shadow-inner">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-white flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            슬립 소비 전류 상세 구성 비율 (Current Breakdown)
          </span>
          <span className="font-mono text-emerald-400 font-bold">
            총 {calculations.totalSleep_uA.toFixed(2)} µA
          </span>
        </div>

        {/* Proportional Bar */}
        <div className="w-full h-8 bg-slate-900 rounded-xl border border-slate-700/80 overflow-hidden flex shadow-inner">
          {breakdownItems.map((item, idx) => (
            <div
              key={idx}
              style={{
                width: `${item.percent}%`,
                backgroundColor: item.color
              }}
              className="h-full relative group cursor-pointer transition-all hover:brightness-110 flex items-center justify-center px-1 overflow-hidden"
              title={`${item.name}: ${item.val.toFixed(2)} µA (${item.percent.toFixed(1)}%)`}
            >
              {item.percent > 12 && (
                <span className="text-[10px] font-bold text-white truncate drop-shadow whitespace-nowrap">
                  {item.val.toFixed(1)}µA
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-1">
          {breakdownItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: item.color }} />
              <span className="text-slate-400">{item.name}:</span>
              <span className="font-mono text-slate-200 font-semibold">{item.val.toFixed(2)} µA</span>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration Grid: System Voltage & Peripherals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Operating Voltage & Frequency & Battery */}
        <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white">동작 전압, 주파수 및 배터리 주기 설정</h4>
          </div>

          <div className="space-y-4 text-xs">
            {/* Operating Voltage */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-semibold">동작 전압 (Supply Voltage VCC)</label>
                <span className="font-mono text-cyan-400 font-bold">{voltage.toFixed(1)} V</span>
              </div>
              <div className="flex items-center gap-2">
                {[1.8, 2.7, 3.3, 5.0].map(v => (
                  <button
                    key={v}
                    disabled={selectedMCU === 'atmega128' && v < 2.7}
                    onClick={() => setVoltage(v)}
                    className={`flex-1 py-1.5 rounded-lg font-mono text-xs font-semibold border transition-all ${
                      voltage === v
                        ? 'bg-cyan-600 text-white border-cyan-500 shadow'
                        : selectedMCU === 'atmega128' && v < 2.7
                        ? 'bg-slate-900/40 text-slate-600 border-slate-900 cursor-not-allowed'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {v}V
                  </button>
                ))}
              </div>
            </div>

            {/* System Clock Frequency */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-semibold">시스템 클럭 (F_CPU)</label>
                <span className="font-mono text-cyan-400 font-bold">{frequencyMhz} MHz</span>
              </div>
              <input
                type="range"
                min="1"
                max={selectedMCU === 'atmega328p' ? 20 : 16}
                step="1"
                value={frequencyMhz}
                onChange={e => setFrequencyMhz(parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>1 MHz (초절전)</span>
                <span>8 MHz (3.3V 표준)</span>
                <span>16 MHz (표준)</span>
                {selectedMCU === 'atmega328p' && <span>20 MHz</span>}
              </div>
            </div>

            {/* Duty Cycle Parameters */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-slate-400 font-medium block mb-1">활성 동작 시간 (Active)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    value={activeDurationMs}
                    onChange={e => setActiveDurationMs(parseInt(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <span className="absolute right-2.5 top-1.5 text-slate-500 font-mono">ms</span>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">슬립 유지 시간 (Sleep)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    max="3600"
                    value={sleepDurationSec}
                    onChange={e => setSleepDurationSec(parseFloat(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <span className="absolute right-2.5 top-1.5 text-slate-500 font-mono">초</span>
                </div>
              </div>
            </div>

            {/* Battery Capacity */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-semibold">배터리 용량 (Battery Capacity)</label>
                <span className="font-mono text-amber-400 font-bold">{batteryCapacityMah} mAh</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'CR2032 (220mAh)', mah: 220 },
                  { label: '2x AAA (1000mAh)', mah: 1000 },
                  { label: '18650 (2600mAh)', mah: 2600 }
                ].map(b => (
                  <button
                    key={b.mah}
                    onClick={() => setBatteryCapacityMah(b.mah)}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-mono border text-center transition-all ${
                      batteryCapacityMah === b.mah
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Peripherals & Leakage Switches */}
        <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Zap className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white">주변장치 전원 상태 및 누설 전류 스위치</h4>
          </div>

          <div className="space-y-3 text-xs">
            {/* ADC Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div>
                <div className="font-semibold text-slate-200">ADC 모듈 활성화 (ADCSRA ADEN=1)</div>
                <div className="text-[10px] text-slate-400">슬립 진입 전 끄지 않으면 슬립 중에도 바이어스 회로가 약 230 µA 소비</div>
              </div>
              <input
                type="checkbox"
                checked={enableAdc}
                onChange={e => setEnableAdc(e.target.checked)}
                className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Analog Comparator Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div>
                <div className="font-semibold text-slate-200">아날로그 비교기 인에이블 (ACSR ACD=0)</div>
                <div className="text-[10px] text-slate-400">ACD=1로 끄지 않으면 대기 중 약 70 µA 상시 소비</div>
              </div>
              <input
                type="checkbox"
                checked={enableAnalogComp}
                onChange={e => setEnableAnalogComp(e.target.checked)}
                className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
              />
            </div>

            {/* BOD & BODS Toggle */}
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-200">Brown-out Detector (BOD 전원 감시)</div>
                  <div className="text-[10px] text-slate-400">퓨즈로 인에이블 시 상시 20~25 µA 소비</div>
                </div>
                <input
                  type="checkbox"
                  checked={enableBod}
                  onChange={e => setEnableBod(e.target.checked)}
                  className="w-4 h-4 rounded accent-rose-500 cursor-pointer"
                />
              </div>

              {enableBod && selectedMCU === 'atmega328p' && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                  <span className="text-emerald-400 font-medium">
                    PicoPower 슬립 중 BOD 자동 차단 (MCUCR BODS=1)
                  </span>
                  <input
                    type="checkbox"
                    checked={enableBodsDisable}
                    onChange={e => setEnableBodsDisable(e.target.checked)}
                    className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Watchdog Timer */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div>
                <div className="font-semibold text-slate-200">Watchdog Timer (WDT 인터럽트 기상용)</div>
                <div className="text-[10px] text-slate-400">독립 128kHz 저전력 오실레이터 구동으로 약 4.5 µA 소비</div>
              </div>
              <input
                type="checkbox"
                checked={enableWdt}
                onChange={e => setEnableWdt(e.target.checked)}
                className="w-4 h-4 rounded accent-violet-500 cursor-pointer"
              />
            </div>

            {/* Floating GPIO Pins Leakage Simulator */}
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-rose-300">플로팅(Floating) 미사용 입력 핀 개수</div>
                  <div className="text-[10px] text-slate-400">입력 풀업 없이 떠있는 핀은 CMOS 슛스루로 핀당 ~140 µA 누설!</div>
                </div>
                <span className="font-mono text-rose-400 font-bold">{floatingPinsCount} 개</span>
              </div>
              <input
                type="range"
                min="0"
                max="16"
                step="1"
                value={floatingPinsCount}
                onChange={e => setFloatingPinsCount(parseInt(e.target.value) || 0)}
                className="w-full accent-rose-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Wake-up Sources Matrix for Current Mode */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-white flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            [{currentSleepDef.nameKo}]에서 사용 가능한 하드웨어 기상 소스 (Wake-up Sources)
          </span>
          <span className="text-slate-400 font-mono text-[11px]">
            기상 지연: {currentSleepDef.wakeLatencyCycles}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {currentSleepDef.wakeSources.map((source, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-300 flex items-center gap-1"
            >
              <Check className="w-3 h-3 text-emerald-400" />
              {source}
            </span>
          ))}
        </div>
      </div>

      {/* Code Generator & Bare-Metal AVR C Source */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white tracking-wide">
              저전력 슬립 모드 펌웨어 C 소스코드 생성기 (AVR-GCC)
            </h4>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setCodeTab('bods_optimized')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                codeTab === 'bods_optimized' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              BODS 극초절전
            </button>
            <button
              onClick={() => setCodeTab('wdt_wakeup')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                codeTab === 'wdt_wakeup' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              WDT 8초 주기 기상
            </button>
            <button
              onClick={() => setCodeTab('rtc_wakeup')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                codeTab === 'rtc_wakeup' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              RTC 32kHz 파워세이브
            </button>
            <button
              onClick={() => setCodeTab('standard')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                codeTab === 'standard' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              표준 구현
            </button>
          </div>
        </div>

        {/* Code Content Box */}
        <div className="relative">
          <pre className="bg-slate-900/90 text-slate-200 font-mono text-xs p-4 rounded-xl border border-slate-800 overflow-x-auto leading-relaxed max-h-72">
            {generatedCCode}
          </pre>

          <button
            onClick={handleCopyCode}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 shadow transition-all"
          >
            {copiedCode ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">복사 완료!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>코드 복사</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
