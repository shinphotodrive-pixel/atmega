import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Battery,
  Zap,
  Clock,
  Cpu,
  Moon,
  TrendingDown,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Download,
  Info,
  Sparkles,
  Sliders,
  Code2,
  ArrowRight,
  ShieldCheck,
  Gauge,
  Flame,
  Activity
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type BatteryType = 'cr2032' | 'cr2450' | '2x_aaa' | '2x_aa' | '18650_liion' | 'lifepo4' | 'custom';

export interface BatteryPreset {
  id: BatteryType;
  name: string;
  nominalVoltage: number;
  capacityMah: number;
  selfDischargeAnnualPct: number;
  usableFactor: number; // typical 0.85
  description: string;
}

const BATTERY_PRESETS: BatteryPreset[] = [
  {
    id: 'cr2032',
    name: 'CR2032 코인 셀 (Coin Cell)',
    nominalVoltage: 3.0,
    capacityMah: 225,
    selfDischargeAnnualPct: 1.0,
    usableFactor: 0.85,
    description: '초소형 IoT 센서 노드 및 웨어러블에 널리 사용되는 3V 리튬 망간 코인 전지'
  },
  {
    id: 'cr2450',
    name: 'CR2450 대형 코인 셀',
    nominalVoltage: 3.0,
    capacityMah: 620,
    selfDischargeAnnualPct: 1.0,
    usableFactor: 0.85,
    description: 'BLE 비콘 및 장기 무선 센서용 고용량 3V 코인 전지'
  },
  {
    id: '2x_aaa',
    name: 'AAA 알카라인 2개 직렬 (2x AAA)',
    nominalVoltage: 3.0,
    capacityMah: 1000,
    selfDischargeAnnualPct: 2.0,
    usableFactor: 0.80,
    description: '휴대용 측정기 및 리모컨에 표준적인 1.5V x 2 알카라인 배터리'
  },
  {
    id: '2x_aa',
    name: 'AA 알카라인 2개 직렬 (2x AA)',
    nominalVoltage: 3.0,
    capacityMah: 2400,
    selfDischargeAnnualPct: 2.0,
    usableFactor: 0.80,
    description: '야외 환경 모니터링 및 스마트 도어록에 적합한 2,400mAh 배터리'
  },
  {
    id: '18650_liion',
    name: '18650 리튬 이온 셀 (Li-Ion 3.7V)',
    nominalVoltage: 3.7,
    capacityMah: 2600,
    selfDischargeAnnualPct: 3.0,
    usableFactor: 0.90,
    description: '고출력 무선 통신 모듈(LoRa/ESP)이 결합된 원격 기지국용 충전지'
  },
  {
    id: 'lifepo4',
    name: 'LiFePO4 리튬 인산철 셀 (3.2V)',
    nominalVoltage: 3.2,
    capacityMah: 1500,
    selfDischargeAnnualPct: 1.5,
    usableFactor: 0.90,
    description: 'AVR 3.3V 정격 전압에 LDO 없이 직접 인가 가능한 안전한 화학 배터리'
  },
  {
    id: 'custom',
    name: '사용자 정의 배터리 (Custom)',
    nominalVoltage: 3.3,
    capacityMah: 500,
    selfDischargeAnnualPct: 2.0,
    usableFactor: 0.85,
    description: '엔지니어가 지정한 용량 및 정격 전압'
  }
];

export type SleepModeId = 'power_down' | 'power_save' | 'standby' | 'idle';

export interface SleepModeConfig {
  id: SleepModeId;
  name: string;
  cMacro: string;
  typicalCurrentUa: number; // microamperes at 3.3V
  description: string;
  wakeSources: string;
}

const SLEEP_MODES: SleepModeConfig[] = [
  {
    id: 'power_down',
    name: 'Power-down 모드 (최대 절전)',
    cMacro: 'SLEEP_MODE_PWR_DOWN',
    typicalCurrentUa: 0.2, // 0.2 µA
    description: '모든 발진기와 클럭이 정지되는 최저 전력 모드 (외부 INT, 핀체인지, WDT로만 복귀)',
    wakeSources: 'INT0/INT1, Pin Change, TWI Address Match, Watchdog'
  },
  {
    id: 'power_save',
    name: 'Power-save 모드 (비동기 RTC 유지)',
    cMacro: 'SLEEP_MODE_PWR_SAVE',
    typicalCurrentUa: 0.8, // 0.8 µA
    description: 'TOSC1/2 32.768kHz 크리스털과 Timer2 RTC 카운터만 유지하는 실시간 시계 모드',
    wakeSources: 'Timer2 RTC 오버플로, 외부 인터럽트'
  },
  {
    id: 'standby',
    name: 'Standby 모드 (빠른 6사이클 복귀)',
    cMacro: 'SLEEP_MODE_STANDBY',
    typicalCurrentUa: 1.2, // 1.2 µA
    description: '크리스털 발진기를 끄지 않아 6 클럭 사이클(0.38µs)만에 즉각 기상 가능',
    wakeSources: '외부 인터럽트, 핀체인지'
  },
  {
    id: 'idle',
    name: 'Idle 모드 (주변장치 동작)',
    cMacro: 'SLEEP_MODE_IDLE',
    typicalCurrentUa: 1500, // 1.5 mA = 1500 µA
    description: 'CPU 클럭만 정지되며 USART, SPI, ADC, 타이머는 계속 동작하여 초고속 복귀',
    wakeSources: '모든 인터럽트 (타이머, UART, ADC 등)'
  }
];

export const AvrLowPowerBatteryLifeCalculator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // User Parameter Inputs
  const [batteryType, setBatteryType] = useState<BatteryType>('cr2032');
  const [customCapacityMah, setCustomCapacityMah] = useState<number>(225);
  const [operatingVoltage, setOperatingVoltage] = useState<number>(3.0);
  const [operatingFreqMhz, setOperatingFreqMhz] = useState<number>(8); // 8MHz default for low-power

  // Active Mode Parameters
  const [activeCurrentMa, setActiveCurrentMa] = useState<number>(5.2); // 5.2 mA at 8MHz 3V
  const [activeDurationMs, setActiveDurationMs] = useState<number>(50); // 50ms active per cycle

  // Sleep Mode Parameters
  const [selectedSleepMode, setSelectedSleepMode] = useState<SleepModeId>('power_down');
  const [sleepDurationSec, setSleepDurationSec] = useState<number>(10); // 10 seconds sleep per cycle
  const [customSleepCurrentUa, setCustomSleepCurrentUa] = useState<number>(0.5); // 0.5 µA

  // Low power optimization flags
  const [disableBodInSleep, setDisableBodInSleep] = useState<boolean>(true);
  const [disableAdcInSleep, setDisableAdcInSleep] = useState<boolean>(true);
  const [pullupFloatingPins, setPullupFloatingPins] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Active Battery Definition
  const batteryObj = useMemo(() => {
    const found = BATTERY_PRESETS.find((b) => b.id === batteryType) || BATTERY_PRESETS[0];
    if (batteryType === 'custom') {
      return { ...found, capacityMah: customCapacityMah, nominalVoltage: operatingVoltage };
    }
    return found;
  }, [batteryType, customCapacityMah, operatingVoltage]);

  // Selected Sleep Definition
  const sleepModeObj = useMemo(() => {
    return SLEEP_MODES.find((s) => s.id === selectedSleepMode) || SLEEP_MODES[0];
  }, [selectedSleepMode]);

  // Calculations for Average Current and Battery Lifetime
  const calculations = useMemo(() => {
    const sleepDurationMs = sleepDurationSec * 1000;
    const totalCycleMs = activeDurationMs + sleepDurationMs;
    const activeDutyRatio = activeDurationMs / totalCycleMs;
    const sleepDutyRatio = sleepDurationMs / totalCycleMs;

    // Base Sleep Current (µA converted to mA)
    let sleepCurrentMa = (sleepModeObj.typicalCurrentUa || customSleepCurrentUa) / 1000;

    // Unoptimized Penalties if toggled OFF:
    if (!disableBodInSleep) sleepCurrentMa += 0.025; // BOD consumes ~25 µA
    if (!disableAdcInSleep) sleepCurrentMa += 0.220; // ADC left ON consumes ~220 µA
    if (!pullupFloatingPins) sleepCurrentMa += 0.045; // Floating inputs leak ~45 µA

    // Active Current
    const actualActiveMa = activeCurrentMa;

    // Weighted Average Current: (I_active * T_active + I_sleep * T_sleep) / T_cycle
    const averageCurrentMa = (actualActiveMa * activeDurationMs + sleepCurrentMa * sleepDurationMs) / totalCycleMs;
    const averageCurrentUa = averageCurrentMa * 1000;

    // Usable Capacity accounting for derating
    const usableCapacityMah = batteryObj.capacityMah * batteryObj.usableFactor;

    // Estimated Life in Hours:
    const totalLifeHours = averageCurrentMa > 0 ? usableCapacityMah / averageCurrentMa : 0;
    const totalLifeDays = totalLifeHours / 24;
    const totalLifeYears = totalLifeDays / 365.25;

    // Baseline if ALWAYS ACTIVE (No Sleep Mode):
    const alwaysActiveHours = usableCapacityMah / actualActiveMa;
    const alwaysActiveDays = alwaysActiveHours / 24;
    const lifeMultiplierVsAlwaysActive = alwaysActiveHours > 0 ? (totalLifeHours / alwaysActiveHours).toFixed(1) : '1';

    // Annual self-discharge loss factor
    const yearsWithSelfDischarge = totalLifeYears / (1 + (batteryObj.selfDischargeAnnualPct / 100) * Math.min(10, totalLifeYears));

    return {
      totalCycleMs,
      activeDutyRatio,
      sleepDutyRatio,
      sleepCurrentMa,
      sleepCurrentUa: sleepCurrentMa * 1000,
      averageCurrentMa,
      averageCurrentUa,
      usableCapacityMah,
      totalLifeHours,
      totalLifeDays,
      totalLifeYears,
      yearsWithSelfDischarge,
      alwaysActiveDays,
      lifeMultiplierVsAlwaysActive
    };
  }, [
    activeDurationMs,
    sleepDurationSec,
    activeCurrentMa,
    sleepModeObj,
    customSleepCurrentUa,
    disableBodInSleep,
    disableAdcInSleep,
    pullupFloatingPins,
    batteryObj
  ]);

  // C Source Code Template for Low Power Mode Transition
  const lowPowerCCode = useMemo(() => {
    return `/**
 * @file   avr_ultra_low_power_sleep.c
 * @target ${currentProfile.name} (${operatingFreqMhz}MHz, ${operatingVoltage}V)
 * @sleep  ${sleepModeObj.cMacro} (평균 전류: ${calculations.averageCurrentUa.toFixed(1)} µA)
 * @battery 예상 수명: ${calculations.yearsWithSelfDischarge.toFixed(2)} 년 (${calculations.totalLifeDays.toFixed(0)} 일)
 */

#include <avr/io.h>
#include <avr/sleep.h>
#include <avr/wdt.h>
#include <avr/power.h>
#include <avr/interrupt.h>

volatile uint8_t g_wdt_wakeup_flag = 0;

// 워치독 인터럽트 서비스 루틴: 슬립에서 깨어나 플래그만 세트
ISR(WDT_vect) {
    g_wdt_wakeup_flag = 1;
}

void setup_wdt_interval(void) {
    // 8초 주기 워치독 인터럽트 설정
    MCUSR &= ~(1 << WDRF);
    WDTCSR |= (1 << WDCE) | (1 << WDE);
    WDTCSR = (1 << WDIE) | (1 << WDP3) | (1 << WDP0); // 8.0초 타임아웃
}

void enter_ultra_low_power_sleep(void) {
    // 1. 슬립 진입 전 모든 플로팅 핀 내부 풀업 또는 출력 설정
    ${pullupFloatingPins ? `// 미사용 핀 누설 전류(수십 µA) 방지 풀업 설정
    PORTB = 0xFF;
    PORTC = 0xFF;
    PORTD = 0xFF;` : `// 플로팅 핀 풀업 미적용 (누설 전류 발생 가능)`}

    // 2. ADC 아날로그 블록 전원 차단 (약 200µA 절감)
    ${disableAdcInSleep ? `ADCSRA &= ~(1 << ADEN); // ADC 비활성화
    power_adc_disable();   // 디지털 클럭 게이팅` : `// ADC 활성 유지`}

    // 3. 슬립 모드 구성 (${sleepModeObj.name})
    set_sleep_mode(${sleepModeObj.cMacro});
    cli(); // 인터럽트 원자적 보호

    sleep_enable();

    // 4. 슬립 도중 BOD(Brown-Out Detection) 하드웨어 차단 (약 25µA 절감)
    ${disableBodInSleep ? `sleep_bod_disable();` : `// BOD 활성 유지`}

    sei(); // 전역 인터럽트 활성화와 동시에 슬립 진입
    sleep_cpu();

    // ==========================================
    // [WAKE-UP] 인터럽트 발생 후 여기서 실행 재개
    // ==========================================
    sleep_disable();

    ${disableAdcInSleep ? `power_adc_enable(); // 필요한 경우 ADC 복구
    ADCSRA |= (1 << ADEN);` : ``}
}

int main(void) {
    setup_wdt_interval();
    sei();

    while (1) {
        // [활성 구간] 센서 읽기 및 무선 통신 (${activeDurationMs}ms 동작)
        read_sensor_and_transmit();

        // [최대 절전 슬립 구간] (${sleepDurationSec}초 대기)
        enter_ultra_low_power_sleep();
    }
}
`;
  }, [
    currentProfile.name,
    operatingFreqMhz,
    operatingVoltage,
    sleepModeObj,
    calculations,
    pullupFloatingPins,
    disableAdcInSleep,
    disableBodInSleep,
    activeDurationMs,
    sleepDurationSec
  ]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(lowPowerCCode);
      setCopiedCode(true);
      confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 } });
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {}
  };

  const handleDownloadCode = () => {
    const blob = new Blob([lowPowerCCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `low_power_sleep_${selectedMCU}.c`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-7 shadow-2xl backdrop-blur">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Battery className="w-3.5 h-3.5" /> 저전력 배터리 수명 계산기 (Low-Power Life Calculator)
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              배터리: {batteryObj.name} ({batteryObj.capacityMah} mAh)
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-xs font-mono font-bold">
              {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 text-xs font-mono font-bold">
              평균 전류: {calculations.averageCurrentUa >= 1000 ? `${calculations.averageCurrentMa.toFixed(2)} mA` : `${calculations.averageCurrentUa.toFixed(1)} µA`}
            </span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            AVR 저전력 모드 배터리 수명 계산기 & 대기 전환 로직 빌더
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            MCU 동작 주파수, 전압, SLEEP 모드 시간 비율, 활성 전류를 종합하여 선택한 배터리 용량 기준 예상 수명(일/년)을 정밀 계산하고, BOD 차단 및 플로팅 핀 누설 전류를 억제하는 완성형 C 대기 전환 코드를 생성합니다.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyCode}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? '복사 완료!' : '슬립 C 코드 복사'}</span>
          </button>
          <button
            onClick={handleDownloadCode}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.c 다운로드</span>
          </button>
        </div>
      </div>

      {/* Primary Result KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Highlight Card: Expected Lifetime */}
        <div className="bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 p-4 rounded-2xl border border-emerald-500/40 col-span-2 sm:col-span-2 lg:col-span-2">
          <div className="flex items-center justify-between text-xs font-mono text-emerald-400">
            <span>예상 배터리 작동 수명 (Estimated Life)</span>
            <span className="text-[10px] bg-emerald-900/60 px-2 py-0.5 rounded-full border border-emerald-700/50">
              자가방전 {batteryObj.selfDischargeAnnualPct}% 반영
            </span>
          </div>
          <div className="text-3xl font-extrabold font-mono text-white mt-1.5 flex items-baseline gap-2">
            <span>{calculations.yearsWithSelfDischarge.toFixed(1)} 년</span>
            <span className="text-sm font-normal text-slate-400">({calculations.totalLifeDays.toFixed(0)} 일)</span>
          </div>
          <div className="text-xs text-emerald-300/90 mt-1 font-mono flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>상시 활성(Always Active) 가동 대비 수명 {calculations.lifeMultiplierVsAlwaysActive}배 연장!</span>
          </div>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">가중 평균 소비 전류</span>
          <span className="text-base font-bold text-cyan-400 font-mono">
            {calculations.averageCurrentUa >= 1000 ? `${calculations.averageCurrentMa.toFixed(2)} mA` : `${calculations.averageCurrentUa.toFixed(1)} µA`}
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            슬립: {calculations.sleepCurrentUa.toFixed(1)}µA | 활성: {activeCurrentMa}mA
          </span>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">슬립 시간 점유율 (Duty)</span>
          <span className="text-base font-bold text-violet-400 font-mono">
            {(calculations.sleepDutyRatio * 100).toFixed(2)}%
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            활성 {activeDurationMs}ms / 슬립 {sleepDurationSec}초
          </span>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 col-span-2 sm:col-span-4 lg:col-span-1">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">유효 배터리 용량</span>
          <span className="text-base font-bold text-amber-400 font-mono">
            {calculations.usableCapacityMah.toFixed(0)} mAh
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            공칭 {batteryObj.capacityMah}mAh x {(batteryObj.usableFactor * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Main Parameters Input Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950/50 p-5 rounded-2xl border border-slate-800">
        {/* Left Column: Battery & Operating Voltage (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
            <Battery className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              1. 배터리 종류 및 작동 환경
            </h4>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-300">배터리 종류 선택 (Battery Type)</label>
            <select
              value={batteryType}
              onChange={(e) => setBatteryType(e.target.value as BatteryType)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
            >
              {BATTERY_PRESETS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.capacityMah} mAh)
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 leading-snug">{batteryObj.description}</p>
          </div>

          {batteryType === 'custom' && (
            <div className="space-y-1.5 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <label className="text-xs text-slate-300">사용자 정의 용량 (mAh):</label>
              <input
                type="number"
                value={customCapacityMah}
                onChange={(e) => setCustomCapacityMah(parseInt(e.target.value) || 100)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">공급 전압 (Vcc):</label>
              <select
                value={operatingVoltage}
                onChange={(e) => setOperatingVoltage(parseFloat(e.target.value) || 3.3)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
              >
                <option value="5.0">5.0 V (표준 16MHz)</option>
                <option value="3.3">3.3 V (권장 저전력)</option>
                <option value="3.0">3.0 V (코인 셀 직접)</option>
                <option value="2.7">2.7 V (최소 안정 동작)</option>
                <option value="1.8">1.8 V (picoPower 한계)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">작동 클럭 (Freq):</label>
              <select
                value={operatingFreqMhz}
                onChange={(e) => setOperatingFreqMhz(parseFloat(e.target.value) || 8)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
              >
                <option value="16">16 MHz</option>
                <option value="8">8 MHz (내부 RC)</option>
                <option value="4">4 MHz</option>
                <option value="1">1 MHz (초절전)</option>
                <option value="0.128">128 kHz (저속 WDT)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Middle Column: Active & Sleep Timings (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              2. 활성(Active) 및 슬립(Sleep) 시간 비율
            </h4>
          </div>

          {/* Active Mode Inputs */}
          <div className="space-y-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-sans">활성 모드 소비 전류 (I_active):</span>
              <span className="text-amber-400 font-bold">{activeCurrentMa} mA</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="20.0"
              step="0.5"
              value={activeCurrentMa}
              onChange={(e) => setActiveCurrentMa(parseFloat(e.target.value) || 5.2)}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />

            <div className="flex items-center justify-between text-xs font-mono pt-1">
              <span className="text-slate-300 font-sans">활성 동작 시간 (T_active):</span>
              <span className="text-cyan-400 font-bold">{activeDurationMs} ms</span>
            </div>
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={activeDurationMs}
              onChange={(e) => setActiveDurationMs(parseInt(e.target.value) || 50)}
              className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          {/* Sleep Mode Inputs */}
          <div className="space-y-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            <label className="text-xs text-slate-300 block">적용할 SLEEP 모드 (Sleep Mode):</label>
            <select
              value={selectedSleepMode}
              onChange={(e) => setSelectedSleepMode(e.target.value as SleepModeId)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-violet-500 focus:outline-none"
            >
              {SLEEP_MODES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.typicalCurrentUa} µA)
                </option>
              ))}
            </select>

            <div className="flex items-center justify-between text-xs font-mono pt-1">
              <span className="text-slate-300 font-sans">슬립 유지 시간 (T_sleep):</span>
              <span className="text-violet-400 font-bold">{sleepDurationSec} 초 (sec)</span>
            </div>
            <input
              type="range"
              min="1"
              max="60"
              step="1"
              value={sleepDurationSec}
              onChange={(e) => setSleepDurationSec(parseInt(e.target.value) || 10)}
              className="w-full accent-violet-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>1초</span>
              <span>10초</span>
              <span>60초</span>
            </div>
          </div>
        </div>

        {/* Right Column: Optimization Switches & Leakage Prevention (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
            <Zap className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              3. 슬립 모드 누설 전류 방지 스위치
            </h4>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* BOD Disable Toggle */}
            <label className="flex items-start gap-2.5 p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={disableBodInSleep}
                onChange={(e) => setDisableBodInSleep(e.target.checked)}
                className="accent-emerald-500 rounded mt-0.5 w-4 h-4 shrink-0"
              />
              <div>
                <span className="font-bold text-white block">슬립 중 BOD 소프트웨어 비활성화</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  <code>sleep_bod_disable()</code> 호출로 20~25 µA 낭비 차단
                </span>
              </div>
            </label>

            {/* ADC Disable Toggle */}
            <label className="flex items-start gap-2.5 p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={disableAdcInSleep}
                onChange={(e) => setDisableAdcInSleep(e.target.checked)}
                className="accent-emerald-500 rounded mt-0.5 w-4 h-4 shrink-0"
              />
              <div>
                <span className="font-bold text-white block">슬립 진입 전 ADC 전원 차단</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  <code>ADCSRA &= ~(1 &lt;&lt; ADEN)</code>로 약 200~250 µA 누설 차단
                </span>
              </div>
            </label>

            {/* Floating Pin Pullup Toggle */}
            <label className="flex items-start gap-2.5 p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={pullupFloatingPins}
                onChange={(e) => setPullupFloatingPins(e.target.checked)}
                className="accent-emerald-500 rounded mt-0.5 w-4 h-4 shrink-0"
              />
              <div>
                <span className="font-bold text-white block">미사용 플로팅 핀 풀업/출력 처리</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  슈미트 트리거 중간 전압 누설(수십 µA) 원천 방지
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Code Snippet Viewer */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Code2 className="w-4 h-4 text-emerald-400" />
            최적화된 AVR 슬립 전환 루틴 & 기상(Wake-up) C 코드 스니펫
          </span>
          <button
            onClick={handleCopyCode}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-mono flex items-center gap-1"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? '복사됨!' : 'C 소스 복사'}</span>
          </button>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-400">
            <span>avr_ultra_low_power_sleep.c ({currentProfile.name})</span>
            <span>AVR-GCC avr/sleep.h / avr/wdt.h 완벽 호환</span>
          </div>
          <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-80">
            <code>{lowPowerCCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
