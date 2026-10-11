import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Zap,
  Activity,
  Battery,
  Clock,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  TrendingDown,
  Sparkles,
  Info,
  Layers,
  Cpu,
  BarChart2,
  RotateCcw,
  ShieldCheck,
  Timer,
  Terminal,
  Download
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type PhaseType = 'active' | 'idle' | 'sleep' | 'custom';

export interface TimelinePhase {
  id: string;
  name: string;
  type: PhaseType;
  currentMa: number; // Current consumption in mA
  durationMs: number; // Duration in ms
  description: string;
}

export interface BatteryPreset {
  id: string;
  name: string;
  capacityMah: number;
  nominalVoltage: number;
  chemistry: string;
  selfDischargeAnnualPct: number;
  recommendedMaxPulseMa: number;
}

const BATTERY_PRESETS: BatteryPreset[] = [
  {
    id: 'cr2032',
    name: 'CR2032 코인셀 (3.0V 리튬)',
    capacityMah: 220,
    nominalVoltage: 3.0,
    chemistry: 'Li-MnO2',
    selfDischargeAnnualPct: 1.0,
    recommendedMaxPulseMa: 15
  },
  {
    id: 'cr2450',
    name: 'CR2450 고용량 코인셀 (3.0V)',
    capacityMah: 620,
    nominalVoltage: 3.0,
    chemistry: 'Li-MnO2',
    selfDischargeAnnualPct: 1.0,
    recommendedMaxPulseMa: 30
  },
  {
    id: 'aaa_x2',
    name: 'AAA 알카라인 2개 직렬 (3.0V)',
    capacityMah: 1000,
    nominalVoltage: 3.0,
    chemistry: 'Alkaline',
    selfDischargeAnnualPct: 2.0,
    recommendedMaxPulseMa: 150
  },
  {
    id: 'aa_x2',
    name: 'AA 알카라인 2개 직렬 (3.0V)',
    capacityMah: 2400,
    nominalVoltage: 3.0,
    chemistry: 'Alkaline',
    selfDischargeAnnualPct: 2.0,
    recommendedMaxPulseMa: 300
  },
  {
    id: 'li_socl2',
    name: 'ER14505 Li-SOCl2 일차전지 (3.6V 산업용)',
    capacityMah: 2700,
    nominalVoltage: 3.6,
    chemistry: 'Li-SOCl2 (10년 보장)',
    selfDischargeAnnualPct: 1.0,
    recommendedMaxPulseMa: 100
  },
  {
    id: 'li_ion_18650',
    name: '18650 2차전지 (3.7V Li-ion + LDO)',
    capacityMah: 2600,
    nominalVoltage: 3.7,
    chemistry: 'Li-ion 충전지',
    selfDischargeAnnualPct: 5.0,
    recommendedMaxPulseMa: 2000
  }
];

export interface TimelineScenario {
  id: string;
  name: string;
  category: 'iot' | 'ble' | 'meter' | 'industrial';
  description: string;
  operatingVoltage: number;
  batteryId: string;
  phases: TimelinePhase[];
}

const PRESET_SCENARIOS: TimelineScenario[] = [
  {
    id: 'lora_sensor_node',
    name: '1. LoRa / Sub-GHz IoT 환경 센서 노드 (10초 주기)',
    category: 'iot',
    description: 'BME280 온습도 센서 측정, LoRa 무선 송신, 딥슬립(Power-down) 전환 시나리오',
    operatingVoltage: 3.3,
    batteryId: 'aa_x2',
    phases: [
      { id: 'p1', name: 'Active TX (LoRa 전송)', type: 'active', currentMa: 42.0, durationMs: 60, description: 'RF 송신기 14dBm 패킷 송출 및 MCU 연산' },
      { id: 'p2', name: 'Sensor ADC 샘플링', type: 'active', currentMa: 8.5, durationMs: 40, description: 'I2C 온습도 측정 및 ADC 변환' },
      { id: 'p3', name: 'Idle (RX 수신 윈도우)', type: 'idle', currentMa: 11.2, durationMs: 150, description: 'LoRa ACK 수신 대기 및 타이머 구동' },
      { id: 'p4', name: 'Deep Sleep (Power-down)', type: 'sleep', currentMa: 0.005, durationMs: 9750, description: 'WDT 128kHz 발진기만 유지되는 극저전력 슬립' }
    ]
  },
  {
    id: 'ble_beacon_tracker',
    name: '2. BLE 비콘 & 자산 트래커 (1초 주기, CR2032 코인셀)',
    category: 'ble',
    description: '초경량 iBeacon/Eddystone 패킷 브로드캐스팅 및 99% 이상 딥슬립 구조',
    operatingVoltage: 3.0,
    batteryId: 'cr2032',
    phases: [
      { id: 'b1', name: 'Active (BLE Adv 송출)', type: 'active', currentMa: 16.5, durationMs: 6, description: '3개 채널(37,38,39) 광고 패킷 버스트 전송' },
      { id: 'b2', name: 'Idle (클럭 안정화 대기)', type: 'idle', currentMa: 3.2, durationMs: 14, description: '크리스털 발진기 웜업 및 PLL 락' },
      { id: 'b3', name: 'Ultra Deep Sleep', type: 'sleep', currentMa: 0.002, durationMs: 980, description: 'RTC 타이머 인터럽트 대기 딥슬립' }
    ]
  },
  {
    id: 'smart_meter_logger',
    name: '3. 스마트 유량계 & 원격 검침기 (60초 주기, Li-SOCl2)',
    category: 'meter',
    description: '초음파 유량 펄스 계측 후 1분마다 원격 업링크하는 10년 수명 설계',
    operatingVoltage: 3.6,
    batteryId: 'li_socl2',
    phases: [
      { id: 'm1', name: 'Pulse Measurement', type: 'active', currentMa: 22.0, durationMs: 80, description: '아날로그 프론트엔드 및 타이머 캡처 계측' },
      { id: 'm2', name: 'Flash EEPROM 기록', type: 'active', currentMa: 12.0, durationMs: 25, description: '비휘발성 메모리 데이터 로깅' },
      { id: 'm3', name: 'Periodic Sleep', type: 'sleep', currentMa: 0.003, durationMs: 59895, description: '비동기 32.768kHz RTC 타이머 슬립 모드' }
    ]
  },
  {
    id: 'industrial_controller',
    name: '4. 고부하 산업용 제어기 (1초 주기, Active 35%)',
    category: 'industrial',
    description: 'CAN 통신 및 모터 PWM 제어가 활발하여 듀티 사이클이 높은 고전력 시스템',
    operatingVoltage: 5.0,
    batteryId: 'li_ion_18650',
    phases: [
      { id: 'i1', name: 'High-speed Control', type: 'active', currentMa: 28.0, durationMs: 350, description: 'PID 알고리즘 연산 및 CAN 버스 송수신' },
      { id: 'i2', name: 'Idle Standby', type: 'idle', currentMa: 9.5, durationMs: 450, description: '주변장치 유지 및 인터럽트 대기' },
      { id: 'i3', name: 'Light Sleep', type: 'sleep', currentMa: 1.2, durationMs: 200, description: 'ADC 노이즈 리덕션 슬립' }
    ]
  }
];

export const PowerConsumptionTimelineAnalyzer: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // State
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('lora_sensor_node');
  const [phases, setPhases] = useState<TimelinePhase[]>(PRESET_SCENARIOS[0].phases);
  const [operatingVoltage, setOperatingVoltage] = useState<number>(3.3);
  const [selectedBatteryId, setSelectedBatteryId] = useState<string>('aa_x2');
  const [customBatteryMah, setCustomBatteryMah] = useState<number>(2400);
  const [batteryDeratingFactor, setBatteryDeratingFactor] = useState<number>(0.85); // 85% effective usable capacity
  const [hoveredPhaseId, setHoveredPhaseId] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // Load Preset
  const handleSelectScenario = (scen: TimelineScenario) => {
    setSelectedScenarioId(scen.id);
    setPhases(scen.phases);
    setOperatingVoltage(scen.operatingVoltage);
    setSelectedBatteryId(scen.batteryId);
    const bat = BATTERY_PRESETS.find((b) => b.id === scen.batteryId);
    if (bat) setCustomBatteryMah(bat.capacityMah);
  };

  // Battery Model
  const currentBattery = useMemo(() => {
    return BATTERY_PRESETS.find((b) => b.id === selectedBatteryId) || BATTERY_PRESETS[0];
  }, [selectedBatteryId]);

  // Update specific phase parameter
  const updatePhase = (id: string, field: 'currentMa' | 'durationMs' | 'name', value: any) => {
    setPhases((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // Math Calculations
  const timelineMetrics = useMemo(() => {
    const totalDurationMs = phases.reduce((acc, p) => acc + p.durationMs, 0);
    const totalDurationSec = totalDurationMs / 1000;

    // Peak current
    const peakCurrentMa = Math.max(...phases.map((p) => p.currentMa), 0.001);

    // Total Charge consumed in one cycle: Q = sum(I_i * t_i) in mA*ms
    const totalChargeMaMs = phases.reduce((acc, p) => acc + p.currentMa * p.durationMs, 0);
    const totalChargeMah = totalChargeMaMs / (1000 * 3600); // in mAh per cycle

    // Average current: I_avg = Q_cycle / T_cycle
    const averageCurrentMa = totalDurationMs > 0 ? totalChargeMaMs / totalDurationMs : 0;
    const averageCurrentUa = averageCurrentMa * 1000;

    // Energy per cycle in mJ (V * I * t)
    const cycleEnergyMj = (operatingVoltage * totalChargeMaMs) / 1000;

    // Average and Peak Power in mW
    const averagePowerMw = operatingVoltage * averageCurrentMa;
    const peakPowerMw = operatingVoltage * peakCurrentMa;

    // Active Phase time & energy breakdown
    const activeTimeMs = phases
      .filter((p) => p.type === 'active')
      .reduce((acc, p) => acc + p.durationMs, 0);
    const activeDutyCyclePercent = totalDurationMs > 0 ? (activeTimeMs / totalDurationMs) * 100 : 0;

    const activeEnergyMj = phases
      .filter((p) => p.type === 'active')
      .reduce((acc, p) => acc + (operatingVoltage * p.currentMa * p.durationMs) / 1000, 0);
    const activeEnergyPercent = cycleEnergyMj > 0 ? (activeEnergyMj / cycleEnergyMj) * 100 : 0;

    // Battery Life Projection
    const effectiveCapacityMah = customBatteryMah * batteryDeratingFactor;
    // Lifetime in hours = Capacity (mAh) / Average Current (mA)
    const lifetimeHours = averageCurrentMa > 0 ? effectiveCapacityMah / averageCurrentMa : 0;
    const lifetimeDays = lifetimeHours / 24;
    const lifetimeMonths = lifetimeDays / 30.4375;
    const lifetimeYears = lifetimeDays / 365.25;

    // Check if peak current exceeds battery pulse rating
    const isPeakExceeded = peakCurrentMa > currentBattery.recommendedMaxPulseMa;

    return {
      totalDurationMs,
      totalDurationSec,
      peakCurrentMa,
      averageCurrentMa,
      averageCurrentUa,
      cycleEnergyMj,
      averagePowerMw,
      peakPowerMw,
      activeDutyCyclePercent,
      activeEnergyPercent,
      lifetimeHours,
      lifetimeDays,
      lifetimeMonths,
      lifetimeYears,
      effectiveCapacityMah,
      isPeakExceeded
    };
  }, [phases, operatingVoltage, customBatteryMah, batteryDeratingFactor, currentBattery]);

  // SVG Chart Waveform Coordinates
  const chartPoints = useMemo(() => {
    const totalT = timelineMetrics.totalDurationMs;
    if (totalT <= 0) return { segments: [], maxI: 1 };

    let elapsed = 0;
    const segments: {
      phase: TimelinePhase;
      startX: number;
      endX: number;
      y: number;
      currentMa: number;
      color: string;
    }[] = [];

    const typeColors: Record<PhaseType, string> = {
      active: '#f43f5e', // Rose-500
      idle: '#f59e0b', // Amber-500
      sleep: '#06b6d4', // Cyan-500
      custom: '#a855f7' // Purple-500
    };

    const maxI = Math.max(timelineMetrics.peakCurrentMa * 1.15, 0.1);

    phases.forEach((p) => {
      const startPct = (elapsed / totalT) * 100;
      elapsed += p.durationMs;
      const endPct = (elapsed / totalT) * 100;
      const heightPct = (p.currentMa / maxI) * 100;

      segments.push({
        phase: p,
        startX: startPct,
        endX: endPct,
        y: heightPct,
        currentMa: p.currentMa,
        color: typeColors[p.type] || '#f43f5e'
      });
    });

    return { segments, maxI };
  }, [phases, timelineMetrics]);

  // Copy Power Budget Summary
  const handleCopyReport = () => {
    const text = `=== [AVR 전력 소비 타임라인 분석 리포트] ===
MCU 타깃: ${currentProfile.name} (동작 전압: ${operatingVoltage}V)
주기(Period): ${timelineMetrics.totalDurationMs} ms (${timelineMetrics.totalDurationSec.toFixed(2)} 초)
피크 전류(Peak): ${timelineMetrics.peakCurrentMa.toFixed(2)} mA
평균 전류(Avg): ${timelineMetrics.averageCurrentMa.toFixed(4)} mA (${timelineMetrics.averageCurrentUa.toFixed(1)} µA)
평균 소비 전력: ${timelineMetrics.averagePowerMw.toFixed(3)} mW
주기당 소비 에너지: ${timelineMetrics.cycleEnergyMj.toFixed(3)} mJ
Active 듀티 사이클: ${timelineMetrics.activeDutyCyclePercent.toFixed(2)}% (에너지 비중: ${timelineMetrics.activeEnergyPercent.toFixed(1)}%)

[배터리 수명 예측]
배터리: ${currentBattery.name} (${customBatteryMah} mAh, 유효 효율 ${(batteryDeratingFactor * 100).toFixed(0)}%)
예상 수명: ${timelineMetrics.lifetimeDays.toFixed(1)} 일 (${timelineMetrics.lifetimeYears.toFixed(2)} 년)
`;
    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.8 }
    });
    setTimeout(() => setCopiedReport(false), 2000);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 lg:p-8 backdrop-blur shadow-2xl space-y-8 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-br from-rose-500 to-amber-500 rounded-2xl shadow-lg shadow-rose-500/20 text-slate-950 font-black">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl lg:text-2xl font-black text-white tracking-tight">
                  전력 소비 타임라인 분석기
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Power Timeline & Battery Life Analyzer
                </span>
              </div>
              <p className="text-xs lg:text-sm text-slate-400 mt-1">
                Active, Idle, Sleep 각 동작 모드의 전류와 지속 시간을 입력받아 주기 동안의 피크/평균 전류를 그래프로 시각화하고 배터리 기대 수명을 정밀 계산합니다.
              </p>
            </div>
          </div>
        </div>

        {/* MCU Badge */}
        <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs text-slate-300">
          <Cpu className="w-4 h-4 text-rose-400" />
          <span>MCU:</span>
          <span className="font-bold text-rose-300">{currentProfile.name}</span>
          <span className="text-[11px] text-slate-500 font-mono">
            ({operatingVoltage}V 구동)
          </span>
        </div>
      </div>

      {/* Scenario Preset Selector */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-rose-400" />
            실무 타임라인 듀티 사이클 시나리오 선택:
          </span>
          <span className="text-[11px] text-slate-500">실시간 파형 및 배터리 모델 연동</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESET_SCENARIOS.map((scen) => {
            const isSelected = scen.id === selectedScenarioId;
            return (
              <button
                key={scen.id}
                onClick={() => handleSelectScenario(scen)}
                className={`text-left p-4 rounded-2xl border transition-all relative ${
                  isSelected
                    ? 'bg-gradient-to-br from-rose-950/60 to-slate-900 border-rose-500 text-white shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/50'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-xs text-slate-200 mb-1 flex items-center justify-between">
                  <span>{scen.name.split('(')[0]}</span>
                  {isSelected && <Check className="w-4 h-4 text-rose-400 shrink-0" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                  {scen.description}
                </p>
                <div className="mt-2 pt-2 border-t border-slate-800/60 flex justify-between text-[10px] font-mono text-slate-500">
                  <span>전압: {scen.operatingVoltage}V</span>
                  <span className="text-amber-400 font-bold">
                    {scen.phases.reduce((a, b) => a + b.durationMs, 0) >= 1000
                      ? `${(scen.phases.reduce((a, b) => a + b.durationMs, 0) / 1000).toFixed(1)}초 주기`
                      : `${scen.phases.reduce((a, b) => a + b.durationMs, 0)}ms`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary KPI Metrics Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Peak Current */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            순간 피크 전류 (Peak Current)
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-rose-400 font-mono">
              {timelineMetrics.peakCurrentMa.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 font-mono">mA</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            피크 전력: {timelineMetrics.peakPowerMw.toFixed(1)} mW
          </div>
        </div>

        {/* Average Current */}
        <div className="bg-slate-950/80 border border-amber-900/40 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1">
            주기 평균 전류 (Average Current)
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-amber-400 font-mono">
              {timelineMetrics.averageCurrentMa >= 1
                ? timelineMetrics.averageCurrentMa.toFixed(3)
                : timelineMetrics.averageCurrentUa.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {timelineMetrics.averageCurrentMa >= 1 ? 'mA' : 'µA'}
            </span>
          </div>
          <div className="text-[11px] text-amber-300/90 mt-1 flex items-center gap-1 font-semibold">
            <Zap className="w-3 h-3" />
            평균 전력: {timelineMetrics.averagePowerMw.toFixed(3)} mW
          </div>
        </div>

        {/* Battery Life Projection */}
        <div className="bg-slate-950/80 border border-emerald-900/40 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
            예상 배터리 수명 (Battery Life)
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-emerald-400 font-mono">
              {timelineMetrics.lifetimeYears >= 1
                ? timelineMetrics.lifetimeYears.toFixed(2)
                : timelineMetrics.lifetimeDays.toFixed(0)}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {timelineMetrics.lifetimeYears >= 1 ? '년 (Years)' : '일 (Days)'}
            </span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
            <Battery className="w-3 h-3" />
            {currentBattery.name.split('(')[0]} 기준
          </div>
        </div>

        {/* Active Energy vs Time Proportion */}
        <div className="bg-slate-950/80 border border-cyan-900/40 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-1">
            Active 듀티 & 에너지 집중도
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-cyan-400 font-mono">
              {timelineMetrics.activeDutyCyclePercent.toFixed(2)}%
            </span>
            <span className="text-xs text-slate-400 font-mono">시간 점유</span>
          </div>
          <div className="text-[11px] text-cyan-300 mt-1 flex items-center gap-1 font-semibold">
            <Sparkles className="w-3 h-3" />
            총 에너지의 {timelineMetrics.activeEnergyPercent.toFixed(1)}% 소비
          </div>
        </div>
      </div>

      {/* SVG Timeline Waveform Chart */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              동작 모드별 전류 소비 파형 (Timeline Waveform Profile)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1 text-rose-400 font-bold">
              <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" /> Active
            </span>
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" /> Idle
            </span>
            <span className="flex items-center gap-1 text-cyan-400 font-bold">
              <span className="w-2.5 h-2.5 rounded bg-cyan-500 inline-block" /> Sleep
            </span>
            <span className="text-slate-400 border-l border-slate-800 pl-3">
              총 주기: <strong className="text-white">{timelineMetrics.totalDurationMs} ms</strong>
            </span>
          </div>
        </div>

        {/* Interactive SVG Chart Container */}
        <div className="relative h-60 w-full bg-slate-950 border border-slate-800/80 rounded-xl overflow-hidden p-2 flex flex-col justify-between">
          {/* Y-Axis Guideline for Peak & Average */}
          <div
            className="absolute left-0 right-0 border-b border-dashed border-amber-500/70 z-10 pointer-events-none flex justify-between px-3 text-[10px] font-mono text-amber-400 font-bold"
            style={{
              bottom: `${Math.min(
                95,
                Math.max(5, (timelineMetrics.averageCurrentMa / (chartPoints.maxI || 1)) * 200)
              )}px`
            }}
          >
            <span>── 평균 전류 (I_avg: {timelineMetrics.averageCurrentMa >= 1 ? `${timelineMetrics.averageCurrentMa.toFixed(2)} mA` : `${timelineMetrics.averageCurrentUa.toFixed(1)} µA`})</span>
            <span>{((timelineMetrics.averageCurrentMa / (chartPoints.maxI || 1)) * 100).toFixed(0)}%</span>
          </div>

          {/* SVG Canvas */}
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 200">
            <defs>
              <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.05" />
              </linearGradient>
              <linearGradient id="idleGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
              </linearGradient>
              <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Grid horizontal lines */}
            {[0, 50, 100, 150].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="1000"
                y2={y}
                stroke="#1e293b"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ))}

            {/* Step Waveform Rectangles */}
            {chartPoints.segments &&
              chartPoints.segments.map((seg, idx) => {
                const x = (seg.startX / 100) * 1000;
                const width = Math.max(2, ((seg.endX - seg.startX) / 100) * 1000);
                const height = Math.max(3, (seg.currentMa / chartPoints.maxI) * 180);
                const y = 200 - height;
                const isHovered = hoveredPhaseId === seg.phase.id;

                const fillGrad =
                  seg.phase.type === 'active'
                    ? 'url(#activeGrad)'
                    : seg.phase.type === 'idle'
                    ? 'url(#idleGrad)'
                    : 'url(#sleepGrad)';

                return (
                  <g
                    key={idx}
                    onMouseEnter={() => setHoveredPhaseId(seg.phase.id)}
                    onMouseLeave={() => setHoveredPhaseId(null)}
                    className="cursor-pointer transition-opacity"
                  >
                    {/* Shaded Area */}
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill={fillGrad}
                      stroke={seg.color}
                      strokeWidth={isHovered ? 3 : 1.5}
                      className="transition-all duration-150"
                    />

                    {/* Step Top Bar */}
                    <line
                      x1={x}
                      y1={y}
                      x2={x + width}
                      y2={y}
                      stroke={seg.color}
                      strokeWidth={isHovered ? 4 : 2}
                    />

                    {/* Label on wider segments */}
                    {width > 60 && (
                      <text
                        x={x + width / 2}
                        y={Math.max(20, y - 8)}
                        textAnchor="middle"
                        fill={seg.color}
                        fontSize="11"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {seg.currentMa >= 1 ? `${seg.currentMa.toFixed(1)}mA` : `${(seg.currentMa * 1000).toFixed(0)}µA`}
                      </text>
                    )}
                  </g>
                );
              })}
          </svg>

          {/* Time axis labels */}
          <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-900">
            <span>0 ms</span>
            <span>{(timelineMetrics.totalDurationMs * 0.25).toFixed(0)} ms</span>
            <span>{(timelineMetrics.totalDurationMs * 0.5).toFixed(0)} ms</span>
            <span>{(timelineMetrics.totalDurationMs * 0.75).toFixed(0)} ms</span>
            <span className="text-white font-bold">{timelineMetrics.totalDurationMs} ms (Period)</span>
          </div>
        </div>

        {/* Phase-by-Phase Interactive Breakdown Table & Duration Sliders */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span>동작 페이즈(Phase)별 세부 파라미터 미세 조정:</span>
            <span className="text-[11px] text-slate-500">슬라이더 및 수치를 변경하여 실시간 재계측</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {phases.map((phase) => {
              const isHovered = hoveredPhaseId === phase.id;
              const typeColor =
                phase.type === 'active'
                  ? 'border-rose-500/50 bg-rose-950/20'
                  : phase.type === 'idle'
                  ? 'border-amber-500/50 bg-amber-950/20'
                  : 'border-cyan-500/50 bg-cyan-950/20';

              return (
                <div
                  key={phase.id}
                  onMouseEnter={() => setHoveredPhaseId(phase.id)}
                  onMouseLeave={() => setHoveredPhaseId(null)}
                  className={`p-3.5 rounded-2xl border transition-all ${typeColor} ${
                    isHovered ? 'ring-1 ring-white/50 shadow-lg' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-white truncate">{phase.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold font-mono bg-slate-900 text-slate-300">
                      {phase.type}
                    </span>
                  </div>

                  {/* Current mA input */}
                  <div className="space-y-1 mb-2">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-slate-400">전류:</span>
                      <span className="text-white font-bold">
                        {phase.currentMa >= 1 ? `${phase.currentMa} mA` : `${(phase.currentMa * 1000).toFixed(1)} µA`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={phase.type === 'sleep' ? '0.001' : '0.5'}
                      max={phase.type === 'active' ? '80' : '25'}
                      step={phase.type === 'sleep' ? '0.001' : '0.5'}
                      value={phase.currentMa}
                      onChange={(e) => updatePhase(phase.id, 'currentMa', Number(e.target.value))}
                      className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </div>

                  {/* Duration ms input */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-slate-400">시간:</span>
                      <span className="text-amber-300 font-bold">{phase.durationMs} ms</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={phase.type === 'sleep' ? 60000 : 2000}
                      step={phase.type === 'sleep' ? 50 : 5}
                      value={phase.durationMs}
                      onChange={(e) => updatePhase(phase.id, 'durationMs', Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Battery Configuration & Life Expectancy Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Battery Selector & Environmental Derating (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Battery className="w-3.5 h-3.5 text-emerald-400" /> 배터리 모델 및 용량 설정
            </span>
            <span className="text-[11px] text-slate-500 font-mono">화학계열별 특성</span>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] text-slate-400 block">배터리 종류 선택:</label>
            <select
              value={selectedBatteryId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedBatteryId(id);
                const b = BATTERY_PRESETS.find((x) => x.id === id);
                if (b) setCustomBatteryMah(b.capacityMah);
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            >
              {BATTERY_PRESETS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.capacityMah} mAh)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">공칭 용량 (mAh):</label>
              <input
                type="number"
                value={customBatteryMah}
                onChange={(e) => setCustomBatteryMah(Math.max(1, Number(e.target.value)))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">동작 전압 (V):</label>
              <input
                type="number"
                step="0.1"
                min="1.8"
                max="5.5"
                value={operatingVoltage}
                onChange={(e) => setOperatingVoltage(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Derating Factor Slider */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-slate-400">자연방전/온도 감쇄 계수 (Derating):</span>
              <span className="text-emerald-400 font-bold">{(batteryDeratingFactor * 100).toFixed(0)}% 유효</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.0"
              step="0.05"
              value={batteryDeratingFactor}
              onChange={(e) => setBatteryDeratingFactor(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <span className="text-[10px] text-slate-500 block">
              펄스 방전 저항 및 저온(-10°C~상온) 환경 고려 시 80~85% 권장
            </span>
          </div>

          {timelineMetrics.isPeakExceeded && (
            <div className="p-3 bg-amber-950/40 border border-amber-600/60 rounded-xl text-xs text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>코인셀 피크 전류 경고:</strong> 순간 피크({timelineMetrics.peakCurrentMa.toFixed(1)}mA)가 권장 한도({currentBattery.recommendedMaxPulseMa}mA)를 초과합니다. 전압 강하(V-drop) 방지를 위해 100µF~470µF 저ESR 바이패스 탄탈 커패시터를 병렬 연결하세요.
              </span>
            </div>
          )}
        </div>

        {/* Right: Low-Power Design Recommendations & Report Actions (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                저전력 설계 권장 조치 & 최적화 인사이트
              </span>
              <button
                onClick={handleCopyReport}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold transition border border-slate-700"
              >
                {copiedReport ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedReport ? '복사됨!' : '리포트 복사'}</span>
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl">
                <div className="font-bold text-rose-300 mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  Active 시간 단축이 배터리 수명의 80%를 결정
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Active 모드가 전체 주기의 단 {timelineMetrics.activeDutyCyclePercent.toFixed(2)}%에 불과하지만 총 에너지의 {timelineMetrics.activeEnergyPercent.toFixed(1)}%를 소모합니다. 무선 전송 시 통신 속도를 높이거나(예: LoRa SF7 사용, UART 보드레이트 115200bps 상향) 센서 연산 루틴을 고속화하여 Active 시간을 줄이면 배터리 수명이 2배 이상 연장됩니다.
                </p>
              </div>

              <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl">
                <div className="font-bold text-cyan-300 mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  Power-down 슬립 중 BOD 및 미사용 주변장치 차단
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  슬립 모드에서 Brown-out Detector(BOD)가 상시 동작하면 20~25µA의 누설 전류가 발생합니다. AVR의 <code className="text-cyan-300 font-mono">sleep_bod_disable()</code> 매크로를 사용하여 슬립 직전 BOD를 차단하고, PRR(Power Reduction Register)로 ADC와 타이머 클럭을 분리하세요.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Summary Pill Bar */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">1년 기준 총 전력 소모량:</span>
            <span className="font-bold text-amber-300">
              {((timelineMetrics.averageCurrentMa * 24 * 365) / 1000).toFixed(2)} Ah / 년
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
