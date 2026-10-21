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
  Activity,
  Layers,
  PieChart,
  FileCode2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type BatteryPresetId = 'cr2032' | 'cr2450' | '2x_aaa' | '2x_aa' | '18650_liion' | 'lifepo4' | 'custom';

export interface BatteryProfile {
  id: BatteryPresetId;
  name: string;
  nominalVoltage: number;
  capacityMah: number;
  usableFactor: number;
  selfDischargeAnnualPct: number;
  desc: string;
}

const BATTERY_PROFILES: BatteryProfile[] = [
  {
    id: 'cr2032',
    name: 'CR2032 코인 전지 (Coin Cell)',
    nominalVoltage: 3.0,
    capacityMah: 225,
    usableFactor: 0.85,
    selfDischargeAnnualPct: 1.0,
    desc: '초소형 무선 비콘 및 IoT 센서 표준 (3V, 225mAh)'
  },
  {
    id: 'cr2450',
    name: 'CR2450 대형 코인 전지',
    nominalVoltage: 3.0,
    capacityMah: 620,
    usableFactor: 0.85,
    selfDischargeAnnualPct: 1.0,
    desc: '장기 가동형 BLE 센서 및 전자 태그 (3V, 620mAh)'
  },
  {
    id: '2x_aaa',
    name: '2x AAA 알카라인 (직렬 3.0V)',
    nominalVoltage: 3.0,
    capacityMah: 1000,
    usableFactor: 0.80,
    selfDischargeAnnualPct: 2.0,
    desc: '휴대용 계측기 및 가전 리모컨 (1,000mAh)'
  },
  {
    id: '2x_aa',
    name: '2x AA 알카라인 (직렬 3.0V)',
    nominalVoltage: 3.0,
    capacityMah: 2400,
    usableFactor: 0.80,
    selfDischargeAnnualPct: 2.0,
    desc: '야외 환경 모니터링 노드 및 도어록 (2,400mAh)'
  },
  {
    id: '18650_liion',
    name: '18650 리튬이온 충전지 (3.7V)',
    nominalVoltage: 3.7,
    capacityMah: 2600,
    usableFactor: 0.90,
    selfDischargeAnnualPct: 3.0,
    desc: '고출력 LoRa/GSM 게이트웨이 기지국 (2,600mAh)'
  },
  {
    id: 'lifepo4',
    name: 'LiFePO4 리튬 인산철 (3.2V)',
    nominalVoltage: 3.2,
    capacityMah: 1500,
    usableFactor: 0.90,
    selfDischargeAnnualPct: 1.5,
    desc: 'AVR 정격 3.3V에 LDO 없이 직결 가능한 고안전성 셀'
  }
];

export const AvrLowPowerEnergyProfiler: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // System Hardware Parameters
  const [cpuClockMhz, setCpuClockMhz] = useState<number>(8);
  const [operatingVoltage, setOperatingVoltage] = useState<number>(3.3);
  const [batteryType, setBatteryType] = useState<BatteryPresetId>('cr2032');
  const [customCapacityMah, setCustomCapacityMah] = useState<number>(225);

  // Execution Times for EACH Mode (in milliseconds)
  const [activeDurationMs, setActiveDurationMs] = useState<number>(30); // 30ms active
  const [idleDurationMs, setIdleDurationMs] = useState<number>(120); // 120ms idle (waiting for ADC/UART)
  const [standbyDurationMs, setStandbyDurationMs] = useState<number>(250); // 250ms standby (fast wake)
  const [powerDownDurationMs, setPowerDownDurationMs] = useState<number>(9600); // 9600ms deep sleep

  // Low power hardware flags
  const [disableBodInSleep, setDisableBodInSleep] = useState<boolean>(true);
  const [wdtEnabledInSleep, setWdtEnabledInSleep] = useState<boolean>(true);
  const [prrPowerReduction, setPrrPowerReduction] = useState<boolean>(true);

  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Active Battery Definition
  const batteryObj = useMemo(() => {
    const found = BATTERY_PROFILES.find((b) => b.id === batteryType) || BATTERY_PROFILES[0];
    if (batteryType === 'custom') {
      return {
        ...found,
        capacityMah: customCapacityMah,
        nominalVoltage: operatingVoltage
      };
    }
    return found;
  }, [batteryType, customCapacityMah, operatingVoltage]);

  // Current Consumption Modeling per state based on Voltage and Frequency
  const stateCurrents = useMemo(() => {
    // Voltage scaling factor (relative to 5.0V)
    const vScale = operatingVoltage / 5.0;
    // Frequency scaling factor (relative to 16MHz)
    const fScale = cpuClockMhz / 16.0;

    // 1. Active Current (at 5V 16MHz: ~9.2mA; scales linearly with V and F)
    let activeCurrentMa = 9.2 * vScale * fScale;
    if (prrPowerReduction) activeCurrentMa *= 0.85; // PRR saves ~15% by gating unused clocks

    // 2. Idle Mode Current (CPU halted, peripherals running: ~2.8mA at 5V 16MHz)
    let idleCurrentMa = 2.8 * vScale * fScale;
    if (prrPowerReduction) idleCurrentMa *= 0.80;

    // 3. Standby Mode Current (Oscillator running for fast 6-cycle wake: ~25µA at 5V, ~18µA at 3.3V)
    const standbyCurrentUa = 25 * vScale;
    const standbyCurrentMa = standbyCurrentUa / 1000;

    // 4. Power-down Mode Current (All clocks halted: ~0.1µA at 3V, ~0.2µA at 5V)
    let powerDownCurrentUa = 0.15 * vScale;
    if (wdtEnabledInSleep) powerDownCurrentUa += 4.5; // WDT oscillator consumes ~4.5µA
    if (!disableBodInSleep) powerDownCurrentUa += 20.0; // BOD left ON consumes ~20µA
    const powerDownCurrentMa = powerDownCurrentUa / 1000;

    return {
      activeCurrentMa: Math.max(0.1, activeCurrentMa),
      idleCurrentMa: Math.max(0.05, idleCurrentMa),
      standbyCurrentMa,
      standbyCurrentUa,
      powerDownCurrentMa,
      powerDownCurrentUa
    };
  }, [operatingVoltage, cpuClockMhz, prrPowerReduction, wdtEnabledInSleep, disableBodInSleep]);

  // Total Cycle, Energy & Lifetime Calculations
  const calculations = useMemo(() => {
    const totalCycleMs = activeDurationMs + idleDurationMs + standbyDurationMs + powerDownDurationMs;
    const safeCycleMs = Math.max(1, totalCycleMs);

    // Duty Ratios (%)
    const activeDutyPct = (activeDurationMs / safeCycleMs) * 100;
    const idleDutyPct = (idleDurationMs / safeCycleMs) * 100;
    const standbyDutyPct = (standbyDurationMs / safeCycleMs) * 100;
    const powerDownDutyPct = (powerDownDurationMs / safeCycleMs) * 100;

    // Charge consumed per phase (in mA·ms)
    const activeCharge = stateCurrents.activeCurrentMa * activeDurationMs;
    const idleCharge = stateCurrents.idleCurrentMa * idleDurationMs;
    const standbyCharge = stateCurrents.standbyCurrentMa * standbyDurationMs;
    const powerDownCharge = stateCurrents.powerDownCurrentMa * powerDownDurationMs;

    const totalChargePerCycle = activeCharge + idleCharge + standbyCharge + powerDownCharge;

    // Weighted Average Current: I_avg = Total Charge / Total Time (in mA)
    const avgCurrentMa = totalChargePerCycle / safeCycleMs;
    const avgCurrentUa = avgCurrentMa * 1000;

    // Energy Consumed per cycle (in millijoules: mJ = V * mA * ms = V * mC)
    const activeEnergyMj = (operatingVoltage * activeCharge) / 1000;
    const idleEnergyMj = (operatingVoltage * idleCharge) / 1000;
    const standbyEnergyMj = (operatingVoltage * standbyCharge) / 1000;
    const powerDownEnergyMj = (operatingVoltage * powerDownCharge) / 1000;
    const totalEnergyMj = activeEnergyMj + idleEnergyMj + standbyEnergyMj + powerDownEnergyMj;

    // Energy Proportion Breakdown (%)
    const activeEnergyPct = totalEnergyMj > 0 ? (activeEnergyMj / totalEnergyMj) * 100 : 0;
    const idleEnergyPct = totalEnergyMj > 0 ? (idleEnergyMj / totalEnergyMj) * 100 : 0;
    const standbyEnergyPct = totalEnergyMj > 0 ? (standbyEnergyMj / totalEnergyMj) * 100 : 0;
    const powerDownEnergyPct = totalEnergyMj > 0 ? (powerDownEnergyMj / totalEnergyMj) * 100 : 0;

    // Usable Battery Capacity (accounting for derating)
    const usableCapacityMah = batteryObj.capacityMah * batteryObj.usableFactor;

    // Battery Lifespan Estimates
    const totalLifeHours = avgCurrentMa > 0 ? usableCapacityMah / avgCurrentMa : 0;
    const totalLifeDays = totalLifeHours / 24;
    const totalLifeYears = totalLifeDays / 365.25;

    // Accounting for annual self-discharge loss
    const yearsWithSelfDischarge =
      totalLifeYears / (1 + (batteryObj.selfDischargeAnnualPct / 100) * Math.min(10, totalLifeYears));

    // Baseline comparison: If ALWAYS in Active mode (No sleep at all)
    const alwaysActiveHours = usableCapacityMah / stateCurrents.activeCurrentMa;
    const alwaysActiveDays = alwaysActiveHours / 24;
    const lifeMultiplier = alwaysActiveHours > 0 ? (totalLifeHours / alwaysActiveHours).toFixed(1) : '1';

    return {
      totalCycleMs,
      totalCycleSec: (totalCycleMs / 1000).toFixed(2),
      activeDutyPct: activeDutyPct.toFixed(1),
      idleDutyPct: idleDutyPct.toFixed(1),
      standbyDutyPct: standbyDutyPct.toFixed(1),
      powerDownDutyPct: powerDownDutyPct.toFixed(1),
      avgCurrentMa: avgCurrentMa.toFixed(4),
      avgCurrentUa: Math.round(avgCurrentUa * 10) / 10,
      totalEnergyMj: totalEnergyMj.toFixed(2),
      activeEnergyPct: activeEnergyPct.toFixed(1),
      idleEnergyPct: idleEnergyPct.toFixed(1),
      standbyEnergyPct: standbyEnergyPct.toFixed(1),
      powerDownEnergyPct: powerDownEnergyPct.toFixed(1),
      totalLifeDays: Math.round(totalLifeDays),
      totalLifeYears: totalLifeYears.toFixed(2),
      yearsWithSelfDischarge: yearsWithSelfDischarge.toFixed(2),
      alwaysActiveDays: Math.round(alwaysActiveDays),
      lifeMultiplier
    };
  }, [
    activeDurationMs,
    idleDurationMs,
    standbyDurationMs,
    powerDownDurationMs,
    stateCurrents,
    operatingVoltage,
    batteryObj
  ]);

  // C Source Code Template
  const generatedCCode = useMemo(() => {
    return `/* =========================================================================
 * AVR 멀티 스테이트 저전력 스케줄러 펌웨어
 * Target MCU : ${currentProfile.name}
 * F_CPU      : ${cpuClockMhz}000000UL (${cpuClockMhz} MHz, ${operatingVoltage}V)
 * 평균 소비전류: ${calculations.avgCurrentUa} µA (예상 배터리 수명: ${calculations.totalLifeYears}년)
 * 듀티 사이클: Active(${calculations.activeDutyPct}%) / Idle(${calculations.idleDutyPct}%) / Standby(${calculations.standbyDutyPct}%) / PowerDown(${calculations.powerDownDutyPct}%)
 * ========================================================================= */
#include <avr/io.h>
#include <avr/sleep.h>
#include <avr/wdt.h>
#include <avr/power.h>
#include <avr/interrupt.h>
#include <util/delay.h>

// 1. 미사용 주변장치 클럭 완전 차단 (PRR 레지스터)
void setup_power_reduction(void) {
${prrPowerReduction ? `    // PRR 레지스터를 통해 미사용 모듈(SPI, TWI, USART) 클럭 차단
    power_twi_disable();
    power_spi_disable();` : '    // PRR 절전 비활성화 상태'}
}

// 2. Idle 모드 진입 (CPU 정지, ADC/타이머 유지, 약 ${idleDurationMs}ms 대기)
void enter_idle_mode(void) {
    set_sleep_mode(SLEEP_MODE_IDLE);
    sleep_enable();
    sleep_cpu();
    sleep_disable();
}

// 3. Standby 모드 진입 (외부 크리스털 발진기 유지, 초고속 6클럭 기상)
void enter_standby_mode(void) {
    set_sleep_mode(SLEEP_MODE_STANDBY);
    sleep_enable();
    sleep_cpu();
    sleep_disable();
}

// 4. Power-down 딥 슬립 모드 진입 (최저 전력 ${stateCurrents.powerDownCurrentUa.toFixed(1)} µA)
void enter_power_down_mode(void) {
    set_sleep_mode(SLEEP_MODE_PWR_DOWN);
    sleep_enable();

${disableBodInSleep ? `    // BOD(Brown-out Detector) 슬립 중 셧다운으로 추가 20µA 절감
    MCUCR |= (1 << BODS) | (1 << BODSE);
    MCUCR = (MCUCR & ~(1 << BODSE)) | (1 << BODS);` : ''}

    sleep_cpu();
    sleep_disable();
}

int main(void) {
    setup_power_reduction();

    while (1) {
        // [Phase 1] Active 모드: 센서 측정 및 무선 패킷 처리 (~${activeDurationMs} ms)
        // do_sensor_reading();

        // [Phase 2] Idle 모드: ADC 변환 완료 또는 버퍼 전송 대기 (~${idleDurationMs} ms)
        enter_idle_mode();

        // [Phase 3] Standby 모드: 중간 휴지기 빠른 복귀 대기 (~${standbyDurationMs} ms)
        enter_standby_mode();

        // [Phase 4] Power-down 모드: WDT 또는 외부 인터럽트 기상까지 딥 슬립 (~${powerDownDurationMs} ms)
        enter_power_down_mode();
    }
}
`;
  }, [
    currentProfile.name,
    cpuClockMhz,
    operatingVoltage,
    calculations,
    prrPowerReduction,
    idleDurationMs,
    stateCurrents,
    disableBodInSleep,
    activeDurationMs,
    standbyDurationMs,
    powerDownDurationMs
  ]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.85 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadCode = () => {
    const blob = new Blob([generatedCCode], { type: 'text/x-csrc' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avr_lowpower_profile_${selectedMCU}.c`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-2">
            <Zap className="w-3.5 h-3.5" /> Multi-Phase Low-Power Energy & Lifespan Profiler
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            AVR 저전력 모드 에너지 프로파일러 (Idle · Standby · Power-down 다구간 분석)
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            클럭 속도, 전압, 그리고 <span className="text-emerald-400 font-medium">각 슬립 모드(Idle, Standby, Power-down)의 실행 시간</span>을 
            입력하면 다중 듀티 사이클에 따른 <span className="text-cyan-300 font-medium"> 가중 평균 전류 소모량(I_avg)</span>과 
            <span className="text-amber-400 font-medium"> 배터리 예상 수명</span>을 실시간 계산하고 시각화합니다.
          </p>
        </div>

        {/* Quick Average Current Readout */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1 self-start lg:self-center">
          <div className="flex items-center gap-2 text-slate-400">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>가중 평균 전류 (I_avg):</span>
            <span className="text-white font-mono font-bold text-sm">{calculations.avgCurrentUa} µA</span>
          </div>
          <div className="text-[11px] text-slate-400 flex justify-between">
            <span>예상 배터리 수명:</span>
            <span className="text-emerald-400 font-bold">{calculations.totalLifeYears} 년 ({calculations.totalLifeDays}일)</span>
          </div>
        </div>
      </div>

      {/* Control Panel: Parameters Inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Col 1: Voltage, Clock & Battery */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" /> 클럭 주파수, 전압 & 배터리 선택
          </h3>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>동작 전압 (Vcc)</span>
              <span className="text-cyan-400 font-mono font-bold">{operatingVoltage.toFixed(1)} V</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-xs">
              {[1.8, 2.7, 3.3, 5.0].map((v) => (
                <button
                  key={v}
                  onClick={() => setOperatingVoltage(v)}
                  className={`py-1 rounded border font-semibold ${
                    operatingVoltage === v
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {v}V
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>MCU 클럭 주파수</span>
              <span className="text-white font-mono font-bold">{cpuClockMhz} MHz</span>
            </div>
            <div className="grid grid-cols-5 gap-1 text-xs">
              {[1, 4, 8, 16, 20].map((f) => (
                <button
                  key={f}
                  onClick={() => setCpuClockMhz(f)}
                  className={`py-1 rounded border font-semibold ${
                    cpuClockMhz === f
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {f}MHz
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">전원 배터리 종류</label>
            <select
              value={batteryType}
              onChange={(e) => setBatteryType(e.target.value as BatteryPresetId)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
            >
              {BATTERY_PROFILES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.capacityMah} mAh)
                </option>
              ))}
            </select>
          </div>

          {/* Current Consumption per State Box */}
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs space-y-1.5">
            <div className="font-semibold text-slate-300">상태별 계산된 소비 전류 (Current):</div>
            <div className="flex justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> Active:
              </span>
              <span className="font-mono text-white font-bold">{stateCurrents.activeCurrentMa.toFixed(2)} mA</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> Idle:
              </span>
              <span className="font-mono text-amber-300">{stateCurrents.idleCurrentMa.toFixed(2)} mA</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span> Standby:
              </span>
              <span className="font-mono text-indigo-300">{stateCurrents.standbyCurrentUa.toFixed(1)} µA</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Power-down:
              </span>
              <span className="font-mono text-emerald-400 font-bold">{stateCurrents.powerDownCurrentUa.toFixed(2)} µA</span>
            </div>
          </div>
        </div>

        {/* Col 2: Execution Time for EACH Sleep Mode */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" /> 각 동작/슬립 모드별 실행 시간 (Duration)
          </h3>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> Active 모드 시간
              </span>
              <span className="text-rose-400 font-mono font-bold">{activeDurationMs} ms</span>
            </div>
            <input
              type="range"
              min={1}
              max={200}
              step={1}
              value={activeDurationMs}
              onChange={(e) => setActiveDurationMs(parseInt(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> Idle 모드 시간 (UART/ADC 대기)
              </span>
              <span className="text-amber-400 font-mono font-bold">{idleDurationMs} ms</span>
            </div>
            <input
              type="range"
              min={0}
              max={1000}
              step={10}
              value={idleDurationMs}
              onChange={(e) => setIdleDurationMs(parseInt(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span> Standby 모드 시간 (고속 복귀)
              </span>
              <span className="text-indigo-400 font-mono font-bold">{standbyDurationMs} ms</span>
            </div>
            <input
              type="range"
              min={0}
              max={2000}
              step={50}
              value={standbyDurationMs}
              onChange={(e) => setStandbyDurationMs(parseInt(e.target.value))}
              className="w-full accent-indigo-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Power-down 모드 시간 (딥 슬립)
              </span>
              <span className="text-emerald-400 font-mono font-bold">{powerDownDurationMs} ms ({(powerDownDurationMs / 1000).toFixed(1)}s)</span>
            </div>
            <input
              type="range"
              min={500}
              max={60000}
              step={500}
              value={powerDownDurationMs}
              onChange={(e) => setPowerDownDurationMs(parseInt(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          <div className="p-2.5 bg-slate-900/70 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex justify-between">
            <span>1사이클 총 주기 시간:</span>
            <span className="text-white font-mono font-bold">{calculations.totalCycleMs} ms ({calculations.totalCycleSec}초)</span>
          </div>
        </div>

        {/* Col 3: Optimization Switches & Key Lifetime Metrics */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" /> 전력 절감 옵션 & 배터리 수명 지표
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between bg-slate-900/70 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-300">슬립 중 BOD 비활성화 (BODS)</span>
              <input
                type="checkbox"
                checked={disableBodInSleep}
                onChange={(e) => setDisableBodInSleep(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between bg-slate-900/70 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-300">슬립 중 WDT 오실레이터 유지</span>
              <input
                type="checkbox"
                checked={wdtEnabledInSleep}
                onChange={(e) => setWdtEnabledInSleep(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between bg-slate-900/70 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-300">PRR 미사용 주변장치 클럭 차단</span>
              <input
                type="checkbox"
                checked={prrPowerReduction}
                onChange={(e) => setPrrPowerReduction(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[10px] block">예상 배터리 수명</span>
              <span className="text-emerald-400 font-mono font-bold text-sm">
                {calculations.totalLifeYears} 년
              </span>
              <span className="text-[10px] text-slate-500 block">({calculations.totalLifeDays} 일)</span>
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[10px] block">상시 동작 대비 배수</span>
              <span className="text-cyan-400 font-mono font-bold text-sm">
                {calculations.lifeMultiplier} 배
              </span>
              <span className="text-[10px] text-slate-500 block">수명 연장 배율</span>
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[10px] block">1사이클 소모 에너지</span>
              <span className="text-white font-mono font-bold text-sm">
                {calculations.totalEnergyMj} mJ
              </span>
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[10px] block">자가방전 고려 실효수명</span>
              <span className="text-amber-400 font-mono font-bold text-sm">
                {calculations.yearsWithSelfDischarge} 년
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visualizers: Multi-Phase Stacked Duty Timeline & Energy Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Visualizer 1: Time Duty Cycle (%) */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-white uppercase flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" /> 모드별 시간 점유율 (Time Duty Cycle)
            </h4>
            <span className="text-xs text-slate-400 font-mono">총 {calculations.totalCycleMs} ms</span>
          </div>

          {/* Stacked Bar */}
          <div className="h-7 w-full bg-slate-900 rounded-lg overflow-hidden flex border border-slate-800 text-[10px] font-bold">
            <div style={{ width: `${Math.max(1, parseFloat(calculations.activeDutyPct))}%` }} className="bg-rose-500 text-white flex items-center justify-center truncate px-1">
              Active {calculations.activeDutyPct}%
            </div>
            <div style={{ width: `${Math.max(1, parseFloat(calculations.idleDutyPct))}%` }} className="bg-amber-500 text-slate-950 flex items-center justify-center truncate px-1">
              Idle {calculations.idleDutyPct}%
            </div>
            <div style={{ width: `${Math.max(1, parseFloat(calculations.standbyDutyPct))}%` }} className="bg-indigo-500 text-white flex items-center justify-center truncate px-1">
              Standby {calculations.standbyDutyPct}%
            </div>
            <div style={{ width: `${Math.max(1, parseFloat(calculations.powerDownDutyPct))}%` }} className="bg-emerald-500 text-slate-950 flex items-center justify-center truncate px-1">
              Power-down {calculations.powerDownDutyPct}%
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-1">
            <div>• Active: <strong className="text-rose-400">{activeDurationMs}ms</strong> ({calculations.activeDutyPct}%)</div>
            <div>• Idle: <strong className="text-amber-400">{idleDurationMs}ms</strong> ({calculations.idleDutyPct}%)</div>
            <div>• Standby: <strong className="text-indigo-400">{standbyDurationMs}ms</strong> ({calculations.standbyDutyPct}%)</div>
            <div>• Power-down: <strong className="text-emerald-400">{powerDownDurationMs}ms</strong> ({calculations.powerDownDutyPct}%)</div>
          </div>
        </div>

        {/* Visualizer 2: Energy Drain Breakdown (%) */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-white uppercase flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> 실질 배터리 에너지 소모 비율 (Energy Drain %)
            </h4>
            <span className="text-xs text-slate-400 font-mono">총 {calculations.totalEnergyMj} mJ</span>
          </div>

          {/* Stacked Energy Bar */}
          <div className="h-7 w-full bg-slate-900 rounded-lg overflow-hidden flex border border-slate-800 text-[10px] font-bold">
            <div style={{ width: `${Math.max(1, parseFloat(calculations.activeEnergyPct))}%` }} className="bg-rose-500 text-white flex items-center justify-center truncate px-1">
              Active {calculations.activeEnergyPct}%
            </div>
            <div style={{ width: `${Math.max(1, parseFloat(calculations.idleEnergyPct))}%` }} className="bg-amber-500 text-slate-950 flex items-center justify-center truncate px-1">
              Idle {calculations.idleEnergyPct}%
            </div>
            <div style={{ width: `${Math.max(0.5, parseFloat(calculations.standbyEnergyPct))}%` }} className="bg-indigo-500 text-white flex items-center justify-center truncate px-1">
              Std {calculations.standbyEnergyPct}%
            </div>
            <div style={{ width: `${Math.max(0.5, parseFloat(calculations.powerDownEnergyPct))}%` }} className="bg-emerald-500 text-slate-950 flex items-center justify-center truncate px-1">
              P-down {calculations.powerDownEnergyPct}%
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
            <strong>에너지 인사이트:</strong> Active 모드가 전체 시간의 불과 <strong>{calculations.activeDutyPct}%</strong>를 차지하지만, 
            실제 배터리 에너지의 <strong>{calculations.activeEnergyPct}%</strong>를 소모합니다. Active 시간의 단축이 배터리 수명 극대화의 핵심입니다.
          </p>
        </div>
      </div>

      {/* Embedded C Code Generator */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                자동 생성된 AVR C 멀티 스테이트 저전력 스케줄러 소스 코드
              </h3>
              <p className="text-xs text-slate-400">
                Idle, Standby, Power-down 전이 시퀀스와 BOD 셧다운 루틴 완비
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? '복사 완료!' : 'C 코드 복사'}
            </button>
            <button
              onClick={handleDownloadCode}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> .c 파일 다운로드
            </button>
          </div>
        </div>

        <pre className="p-4 bg-slate-900/90 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[320px] scrollbar-thin scrollbar-thumb-slate-700">
          <code>{generatedCCode}</code>
        </pre>
      </div>
    </div>
  );
};
