import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Calendar,
  Zap,
  Clock,
  Battery,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  TrendingDown,
  Sparkles,
  Layers,
  Cpu,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type McuState = 'active' | 'idle' | 'power_down';

export interface TimelineInterval {
  id: string;
  name: string;
  state: McuState;
  durationMs: number;
  currentMa: number;
  description: string;
}

export interface ScenarioPreset {
  id: string;
  title: string;
  desc: string;
  cyclePeriodMs: number;
  batteryMah: number;
  voltage: number;
  intervals: TimelineInterval[];
}

const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'env_sensor_node',
    title: '1. 주기적 IoT 환경 센서 노드 (10초 주기)',
    desc: 'BME280 온습도 센서 측정, LoRa 무선 패킷 전송 및 98% 딥슬립 전환 시나리오',
    cyclePeriodMs: 10000,
    batteryMah: 2400, // AA x 2
    voltage: 3.3,
    intervals: [
      { id: 'i1', name: '센서 웜업 & ADC 샘플링', state: 'active', durationMs: 40, currentMa: 8.5, description: 'I2C 통신 및 내부 10-bit ADC 변환' },
      { id: 'i2', name: 'LoRa RF 패킷 송신 (14dBm)', state: 'active', durationMs: 80, currentMa: 45.0, description: '무선 송신기 가동 및 패킷 브로드캐스팅' },
      { id: 'i3', name: 'ACK 수신 윈도우 대기', state: 'idle', durationMs: 120, currentMa: 10.5, description: 'CPU 코어 슬립, 수신 인터럽트 대기' },
      { id: 'i4', name: 'Power-down 딥슬립', state: 'power_down', durationMs: 9760, currentMa: 0.005, description: '128kHz WDT만 유지되는 극저전력 슬립' }
    ]
  },
  {
    id: 'ble_smart_beacon',
    title: '2. 초소형 BLE 스마트 비콘 (1초 주기, CR2032)',
    desc: '매 1초마다 짧은 광고(Adv) 패킷을 송출하고 대부분의 시간을 초절전 슬립으로 대기',
    cyclePeriodMs: 1000,
    batteryMah: 220, // CR2032
    voltage: 3.0,
    intervals: [
      { id: 'b1', name: 'BLE Adv 패킷 버스트 송출', state: 'active', durationMs: 8, currentMa: 18.0, description: '3채널 광고 패킷 송출' },
      { id: 'b2', name: '클럭 발진기 안정화 대기', state: 'idle', durationMs: 12, currentMa: 3.5, description: '크리스털 발진기 웜업' },
      { id: 'b3', name: 'Power-down 모드 (RTC 유지)', state: 'power_down', durationMs: 980, currentMa: 0.002, description: '0.15µA~2µA 딥슬립' }
    ]
  },
  {
    id: 'smart_water_meter',
    title: '3. 원격 수도 검침기 (60초 주기, 10년 수명)',
    desc: '1분 간격으로 초음파 펄스를 계측하고 Flash 로깅 후 장기 절전 유지',
    cyclePeriodMs: 60000,
    batteryMah: 2700, // Li-SOCl2
    voltage: 3.6,
    intervals: [
      { id: 'w1', name: '초음파 펄스 유량 계측', state: 'active', durationMs: 120, currentMa: 24.0, description: '타이머 캡처 및 아날로그 프론트엔드' },
      { id: 'w2', name: 'EEPROM 데이터 로깅', state: 'active', durationMs: 30, currentMa: 12.0, description: '비휘발성 플래시 기록' },
      { id: 'w3', name: '초저전력 Power-down', state: 'power_down', durationMs: 59850, currentMa: 0.003, description: '32.768kHz RTC 비동기 슬립' }
    ]
  }
];

export const PowerScenarioPlanner: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  const [selectedPresetId, setSelectedPresetId] = useState<string>('env_sensor_node');
  const [intervals, setIntervals] = useState<TimelineInterval[]>(SCENARIO_PRESETS[0].intervals);
  const [batteryCapacityMah, setBatteryCapacityMah] = useState<number>(2400);
  const [operatingVoltage, setOperatingVoltage] = useState<number>(3.3);
  const [batteryDerating, setBatteryDerating] = useState<number>(0.85); // 85% effective
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Apply Preset
  const handleSelectPreset = (preset: ScenarioPreset) => {
    setSelectedPresetId(preset.id);
    setIntervals(preset.intervals);
    setBatteryCapacityMah(preset.batteryMah);
    setOperatingVoltage(preset.voltage);
  };

  // Calculations
  const metrics = useMemo(() => {
    const totalCycleMs = intervals.reduce((acc, i) => acc + i.durationMs, 0);
    const totalCycleSec = totalCycleMs / 1000;

    // Peak Current
    const peakCurrentMa = Math.max(...intervals.map((i) => i.currentMa), 0.001);

    // Total Charge in mA*ms
    const totalChargeMaMs = intervals.reduce((acc, i) => acc + i.currentMa * i.durationMs, 0);

    // Average current (mA)
    const averageCurrentMa = totalCycleMs > 0 ? totalChargeMaMs / totalCycleMs : 0;
    const averageCurrentUa = averageCurrentMa * 1000;

    // State Durations & Charge Breakdown
    const activeTimeMs = intervals.filter((i) => i.state === 'active').reduce((a, b) => a + b.durationMs, 0);
    const idleTimeMs = intervals.filter((i) => i.state === 'idle').reduce((a, b) => a + b.durationMs, 0);
    const sleepTimeMs = intervals.filter((i) => i.state === 'power_down').reduce((a, b) => a + b.durationMs, 0);

    const activeCharge = intervals.filter((i) => i.state === 'active').reduce((a, b) => a + b.currentMa * b.durationMs, 0);
    const idleCharge = intervals.filter((i) => i.state === 'idle').reduce((a, b) => a + b.currentMa * b.durationMs, 0);
    const sleepCharge = intervals.filter((i) => i.state === 'power_down').reduce((a, b) => a + b.currentMa * b.durationMs, 0);

    const activeEnergyPct = totalChargeMaMs > 0 ? (activeCharge / totalChargeMaMs) * 100 : 0;
    const idleEnergyPct = totalChargeMaMs > 0 ? (idleCharge / totalChargeMaMs) * 100 : 0;
    const sleepEnergyPct = totalChargeMaMs > 0 ? (sleepCharge / totalChargeMaMs) * 100 : 0;

    // Battery Life Projection
    const effectiveCapacityMah = batteryCapacityMah * batteryDerating;
    const lifetimeHours = averageCurrentMa > 0 ? effectiveCapacityMah / averageCurrentMa : 0;
    const lifetimeDays = lifetimeHours / 24;
    const lifetimeYears = lifetimeDays / 365.25;

    return {
      totalCycleMs,
      totalCycleSec,
      peakCurrentMa,
      averageCurrentMa,
      averageCurrentUa,
      activeTimeMs,
      idleTimeMs,
      sleepTimeMs,
      activeEnergyPct,
      idleEnergyPct,
      sleepEnergyPct,
      lifetimeHours,
      lifetimeDays,
      lifetimeYears
    };
  }, [intervals, batteryCapacityMah, batteryDerating]);

  // Update interval
  const updateInterval = (id: string, field: keyof TimelineInterval, value: any) => {
    setIntervals((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeInterval = (id: string) => {
    if (intervals.length <= 1) return;
    setIntervals((prev) => prev.filter((item) => item.id !== id));
  };

  const addInterval = () => {
    const newId = `custom-${Date.now()}`;
    const newInt: TimelineInterval = {
      id: newId,
      name: '새 동작 구간',
      state: 'active',
      durationMs: 50,
      currentMa: 15.0,
      description: '사용자 지정 동작'
    };
    setIntervals([...intervals, newInt]);
  };

  const handleCopyCode = () => {
    const code = `// ==============================================================================
// AVR 전력 소비 시나리오 기반 듀티 사이클 스케줄러
// 타깃 MCU: ${currentProfile.name} (동작 전압: ${operatingVoltage}V)
// 전체 주기: ${metrics.totalCycleMs} ms | 평균 전류: ${metrics.averageCurrentMa.toFixed(4)} mA (${metrics.averageCurrentUa.toFixed(1)} µA)
// 예상 배터리 수명: ${metrics.lifetimeYears.toFixed(2)} 년 (${metrics.lifetimeDays.toFixed(0)} 일)
// ==============================================================================
#include <avr/io.h>
#include <avr/sleep.h>
#include <avr/wdt.h>
#include <avr/power.h>
#include <avr/interrupt.h>

void setup_power_scenario(void) {
    // 1. 미사용 주변장치 클럭 차단 (Power Reduction Register)
    power_all_disable();
    power_adc_enable(); // 필요한 장치만 선택적 활성화
    
    // 2. 슬립 모드 구성: Power-down (최대 절전)
    set_sleep_mode(SLEEP_MODE_PWR_DOWN);
}

void enter_deep_sleep_cycle(void) {
    sleep_enable();
    
    // 3. 슬립 중 BOD(Brown-out Detector) 누설 차단 매크로
    sleep_bod_disable();
    
    sei(); // 전역 인터럽트 활성화
    sleep_cpu(); // CPU 정지 및 딥슬립 진입
    
    // --- 워치독 또는 외부 인터럽트로 웨이크업 후 실행 재개 ---
    sleep_disable();
}
`;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.8 }
    });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 lg:p-8 backdrop-blur shadow-2xl space-y-8 relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-rose-600 rounded-2xl shadow-lg shadow-amber-500/20 text-slate-950 font-black">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl lg:text-2xl font-black text-white tracking-tight">
                  전력 소비 시나리오 플래너
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  MCU State Timeline & Battery Life Planner
                </span>
              </div>
              <p className="text-xs lg:text-sm text-slate-400 mt-1">
                프로젝트 주기에 따라 MCU 상태(Active, Idle, Power-down)가 어떻게 변경되는지 시간 축으로 배치하고, 각 구간별 소비 전류를 계산하여 전체 배터리 예상 수명을 시각화합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Target MCU Specs Badge */}
        <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs text-slate-300">
          <Cpu className="w-4 h-4 text-amber-400" />
          <span>MCU:</span>
          <span className="font-bold text-amber-300">{currentProfile.name}</span>
          <span className="text-[11px] text-slate-500 font-mono">
            ({operatingVoltage}V 동작)
          </span>
        </div>
      </div>

      {/* Scenario Presets Selector */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            실무 전력 시나리오 프리셋 선택:
          </span>
          <span className="text-[11px] text-slate-500">원클릭 시나리오 타임라인 로딩</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SCENARIO_PRESETS.map((p) => {
            const isSelected = p.id === selectedPresetId;
            return (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p)}
                className={`text-left p-4 rounded-2xl border transition-all relative ${
                  isSelected
                    ? 'bg-gradient-to-br from-amber-950/60 to-slate-900 border-amber-500 text-white shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/50'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-xs text-slate-200 mb-1 flex items-center justify-between">
                  <span>{p.title.split('(')[0]}</span>
                  {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                  {p.desc}
                </p>
                <div className="mt-2 pt-2 border-t border-slate-800/60 flex justify-between text-[10px] font-mono text-slate-500">
                  <span>주기: {p.cyclePeriodMs >= 1000 ? `${p.cyclePeriodMs / 1000}초` : `${p.cyclePeriodMs}ms`}</span>
                  <span className="text-amber-400 font-bold">{p.batteryMah} mAh</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Key Metrics KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            순간 피크 전류 (Peak Current)
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-rose-400 font-mono">
              {metrics.peakCurrentMa.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 font-mono">mA</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Active 페이즈 최대 부하
          </div>
        </div>

        <div className="bg-slate-950/80 border border-amber-900/40 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1">
            주기 평균 전류 (Average Current)
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-amber-400 font-mono">
              {metrics.averageCurrentMa >= 1
                ? metrics.averageCurrentMa.toFixed(3)
                : metrics.averageCurrentUa.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {metrics.averageCurrentMa >= 1 ? 'mA' : 'µA'}
            </span>
          </div>
          <div className="text-[11px] text-amber-300 mt-1 font-semibold flex items-center gap-1">
            <Zap className="w-3 h-3" />
            평균 소비 전력: {(metrics.averageCurrentMa * operatingVoltage).toFixed(2)} mW
          </div>
        </div>

        <div className="bg-slate-950/80 border border-emerald-900/40 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
            예상 배터리 수명 (Battery Life)
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-emerald-400 font-mono">
              {metrics.lifetimeYears >= 1
                ? metrics.lifetimeYears.toFixed(2)
                : metrics.lifetimeDays.toFixed(0)}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {metrics.lifetimeYears >= 1 ? '년 (Years)' : '일 (Days)'}
            </span>
          </div>
          <div className="text-[11px] text-emerald-300 mt-1 font-semibold flex items-center gap-1">
            <Battery className="w-3 h-3" />
            {batteryCapacityMah} mAh 배터리 기준
          </div>
        </div>

        <div className="bg-slate-950/80 border border-cyan-900/40 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-1">
            Active 시간 대 에너지 집중도
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-cyan-400 font-mono">
              {((metrics.activeTimeMs / metrics.totalCycleMs) * 100).toFixed(2)}%
            </span>
            <span className="text-xs text-slate-400 font-mono">시간 점유</span>
          </div>
          <div className="text-[11px] text-cyan-300 mt-1 font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            전체 에너지의 {metrics.activeEnergyPct.toFixed(1)}% 소비
          </div>
        </div>
      </div>

      {/* Visual Time-Axis Timeline Diagram */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              시간 축(Time Axis) MCU 상태 전이 다이어그램 (총 주기: {metrics.totalCycleMs} ms)
            </h3>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1 text-rose-400 font-bold">
              <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" /> Active
            </span>
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" /> Idle
            </span>
            <span className="flex items-center gap-1 text-cyan-400 font-bold">
              <span className="w-2.5 h-2.5 rounded bg-cyan-500 inline-block" /> Power-down
            </span>
          </div>
        </div>

        {/* Visual Timeline Bar */}
        <div className="h-10 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex p-1 gap-1">
          {intervals.map((item, idx) => {
            const widthPct = Math.max(3, (item.durationMs / metrics.totalCycleMs) * 100);
            const colorClass =
              item.state === 'active'
                ? 'bg-rose-500 text-white'
                : item.state === 'idle'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-cyan-600 text-white';

            return (
              <div
                key={item.id}
                className={`${colorClass} rounded-lg flex items-center justify-center text-[10px] font-bold font-mono overflow-hidden transition-all duration-300 relative group cursor-pointer`}
                style={{ width: `${widthPct}%` }}
                title={`${item.name}: ${item.durationMs}ms @ ${item.currentMa}mA`}
              >
                <span className="truncate px-1">
                  {item.name} ({item.currentMa >= 1 ? `${item.currentMa}mA` : `${item.currentMa * 1000}µA`})
                </span>
              </div>
            );
          })}
        </div>

        {/* Timeline breakdown info chips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono pt-1">
          <div className="p-2.5 bg-rose-950/30 border border-rose-900/50 rounded-xl flex items-center justify-between text-rose-300">
            <span>Active 상태 시간:</span>
            <span className="font-bold">{metrics.activeTimeMs} ms (에너지 {metrics.activeEnergyPct.toFixed(1)}%)</span>
          </div>
          <div className="p-2.5 bg-amber-950/30 border border-amber-900/50 rounded-xl flex items-center justify-between text-amber-300">
            <span>Idle 상태 시간:</span>
            <span className="font-bold">{metrics.idleTimeMs} ms (에너지 {metrics.idleEnergyPct.toFixed(1)}%)</span>
          </div>
          <div className="p-2.5 bg-cyan-950/30 border border-cyan-900/50 rounded-xl flex items-center justify-between text-cyan-300">
            <span>Power-down 슬립 시간:</span>
            <span className="font-bold">{metrics.sleepTimeMs} ms (에너지 {metrics.sleepEnergyPct.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {/* Interval Editor & Battery Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Intervals Table (8 cols) */}
        <div className="lg:col-span-8 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              구간별 MCU 상태 및 소비 전류 설정
            </span>
            <button
              onClick={addInterval}
              className="flex items-center gap-1 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>구간 추가</span>
            </button>
          </div>

          <div className="space-y-3">
            {intervals.map((item, idx) => (
              <div
                key={item.id}
                className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center text-xs"
              >
                <div className="sm:col-span-4 space-y-1">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateInterval(item.id, 'name', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white font-medium text-xs focus:border-amber-400 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateInterval(item.id, 'description', e.target.value)}
                    placeholder="설명"
                    className="w-full bg-transparent text-[11px] text-slate-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <select
                    value={item.state}
                    onChange={(e) => updateInterval(item.id, 'state', e.target.value as McuState)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                  >
                    <option value="active">Active (고속 동작)</option>
                    <option value="idle">Idle (클럭 정지)</option>
                    <option value="power_down">Power-down (딥슬립)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.001"
                      value={item.currentMa}
                      onChange={(e) => updateInterval(item.id, 'currentMa', Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-right text-xs font-mono text-white focus:border-amber-400 focus:outline-none"
                    />
                    <span className="text-[11px] text-slate-400 font-mono">mA</span>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={item.durationMs}
                      onChange={(e) => updateInterval(item.id, 'durationMs', Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-right text-xs font-mono text-white focus:border-amber-400 focus:outline-none"
                    />
                    <span className="text-[11px] text-slate-400 font-mono">ms</span>
                  </div>
                </div>

                <div className="sm:col-span-1 text-right">
                  <button
                    onClick={() => removeInterval(item.id)}
                    disabled={intervals.length <= 1}
                    className="p-1.5 text-slate-500 hover:text-rose-400 disabled:opacity-30 transition rounded"
                    title="구간 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Battery Settings & C Code Generator (4 cols) */}
        <div className="lg:col-span-4 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Battery className="w-3.5 h-3.5 text-emerald-400" />
                배터리 및 하드웨어 파라미터
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">배터리 용량 (mAh):</label>
                <input
                  type="number"
                  value={batteryCapacityMah}
                  onChange={(e) => setBatteryCapacityMah(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-emerald-400 focus:outline-none"
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
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-slate-400">배터리 유효 감쇄율:</span>
                  <span className="text-emerald-400 font-bold">{(batteryDerating * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={batteryDerating}
                  onChange={(e) => setBatteryDerating(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* C Code Generator Button */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <button
              onClick={handleCopyCode}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-500/20"
            >
              {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode ? 'C 초기화 코드 복사 완료!' : '절전 펌웨어 C 스켈레톤 복사'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
