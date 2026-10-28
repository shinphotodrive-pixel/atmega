import React, { useState, useMemo } from 'react';
import {
  Zap,
  Battery,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Layers,
  Activity,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  Clock,
  Gauge,
  TrendingDown,
  ShieldCheck,
  Terminal,
  ArrowRight,
  Flame,
  PieChart
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type SleepMode =
  | 'active'
  | 'idle'
  | 'adc_noise'
  | 'power_down'
  | 'power_save'
  | 'standby';

export interface PeripheralSpec {
  id: string;
  name: string;
  category: 'analog' | 'timer' | 'comm' | 'system';
  baseCurrentUa: number; // typical at 5V, 16MHz
  prrReg: string;
  prrBit: string;
  description: string;
}

interface ScenarioPreset {
  id: string;
  name: string;
  desc: string;
  fCpuMhz: number;
  vcc: number;
  sleepMode: SleepMode;
  dutyCycle: number; // 0.1 ~ 100
  activePeripherals: string[];
}

export const PowerScenarioSimulator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // 1. Operating Condition Parameters
  const [fCpuMhz, setFCpuMhz] = useState<number>(16.0); // 0.032 ~ 20.0 MHz
  const [vcc, setVcc] = useState<number>(5.0); // 1.8 ~ 5.5 V
  const [sleepMode, setSleepMode] = useState<SleepMode>('power_down');
  const [dutyCyclePercent, setDutyCyclePercent] = useState<number>(5.0); // 5% Active, 95% Sleep
  const [batteryType, setBatteryType] = useState<number>(2400); // 2400mAh (AA x 2)

  // 2. Active Peripherals State
  const [activePeripherals, setActivePeripherals] = useState<Record<string, boolean>>({
    adc: true,
    timer0: true,
    timer1: false,
    timer2: false,
    timer3: false,
    usart0: true,
    usart1: false,
    spi: false,
    twi: true,
    ac: false,
    wdt: true,
    bod: true,
  });

  // 3. Saved Baseline Scenario for Side-by-Side Comparison
  const [savedScenario, setSavedScenario] = useState<{
    fCpu: number;
    vcc: number;
    avgMa: number;
    batteryDays: number;
    label: string;
  } | null>(null);

  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Dynamic Peripheral List based on selected MCU
  const peripheralList: PeripheralSpec[] = useMemo(() => {
    const list: PeripheralSpec[] = [
      {
        id: 'adc',
        name: 'ADC (10-bit 아날로그 컨버터 & 1.1V Bandgap)',
        category: 'analog',
        baseCurrentUa: 240,
        prrReg: 'PRR',
        prrBit: 'PRADC',
        description: '아날로그 전원, SAR 컨버터 클럭 및 밴드갭 기준전압원',
      },
      {
        id: 'timer0',
        name: 'Timer/Counter0 (8-bit 기본 시스템 틱/PWM)',
        category: 'timer',
        baseCurrentUa: 110,
        prrReg: 'PRR',
        prrBit: 'PRTIM0',
        description: 'millis() 타이머 카운터 및 PWM 발생 클럭',
      },
      {
        id: 'timer1',
        name: 'Timer/Counter1 (16-bit 고정밀 서보 & 캡처)',
        category: 'timer',
        baseCurrentUa: 140,
        prrReg: 'PRR',
        prrBit: 'PRTIM1',
        description: '16비트 타이머 카운터 및 출력 비교 레지스터',
      },
      {
        id: 'timer2',
        name: 'Timer/Counter2 (8-bit 비동기 RTC 타이머)',
        category: 'timer',
        baseCurrentUa: 120,
        prrReg: 'PRR',
        prrBit: 'PRTIM2',
        description: '32.768kHz TOSC 크리스털 구동 가능한 독립 타이머',
      },
      {
        id: 'usart0',
        name: 'USART0 (직렬 통신 송수신기)',
        category: 'comm',
        baseCurrentUa: 180,
        prrReg: 'PRR',
        prrBit: 'PRUSART0',
        description: '보드레이트 발생기 및 RX/TX 클럭 트리',
      },
      {
        id: 'spi',
        name: 'SPI (고속 직렬 주변기기 인터페이스)',
        category: 'comm',
        baseCurrentUa: 130,
        prrReg: 'PRR',
        prrBit: 'PRSPI',
        description: 'SPI 마스터/슬레이브 시프트 레지스터 및 분주기',
      },
      {
        id: 'twi',
        name: 'TWI / I2C (2선식 직렬 버스)',
        category: 'comm',
        baseCurrentUa: 150,
        prrReg: 'PRR',
        prrBit: 'PRTWI',
        description: 'I2C 버스 제어 상태 머신 및 슬루레이트 리미터',
      },
      {
        id: 'ac',
        name: 'Analog Comparator (아날로그 비교기)',
        category: 'analog',
        baseCurrentUa: 60,
        prrReg: 'ACSR',
        prrBit: 'ACD',
        description: 'AIN0/AIN1 전압 비교 연산증폭기',
      },
      {
        id: 'wdt',
        name: 'Watchdog Timer (독립 128kHz WDT 발진기)',
        category: 'system',
        baseCurrentUa: 6,
        prrReg: 'WDTCSR',
        prrBit: 'WDE',
        description: 'CPU와 분리된 상시 구동 저전력 128kHz 오실레이터',
      },
      {
        id: 'bod',
        name: 'BOD (갈색 전압 강하 감지기 - Brown-out Detector)',
        category: 'system',
        baseCurrentUa: 25,
        prrReg: 'FUSE',
        prrBit: 'BODLEVEL',
        description: '전압 강하 시 CPU 리셋을 유발하는 정밀 전압 비교기',
      },
    ];

    // Extra peripherals for high-density MCUs (ATmega128, ATmega640, ATmega2560)
    if (selectedMCU === 'atmega128' || selectedMCU === 'atmega640' || selectedMCU === 'atmega2560') {
      list.push(
        {
          id: 'usart1',
          name: 'USART1 (보조 시리얼 통신)',
          category: 'comm',
          baseCurrentUa: 180,
          prrReg: selectedMCU === 'atmega128' ? 'PRR' : 'PRR0',
          prrBit: 'PRUSART1',
          description: '두 번째 하드웨어 시리얼 포트',
        },
        {
          id: 'timer3',
          name: 'Timer/Counter3 (16-bit 확장 타이머)',
          category: 'timer',
          baseCurrentUa: 140,
          prrReg: selectedMCU === 'atmega128' ? 'PRR' : 'PRR1',
          prrBit: 'PRTIM3',
          description: '추가 16비트 PWM 및 입력 캡처 타이머',
        }
      );
    }

    return list;
  }, [selectedMCU]);

  // Safe Operating Area (SOA) Frequency Check based on Voltage
  const soaMaxFreqMhz = useMemo(() => {
    if (vcc < 2.7) return 4.0;
    if (vcc < 4.5) return (8.0 + ((vcc - 2.7) / (4.5 - 2.7)) * (selectedMCU === 'atmega328p' ? 12.0 : 8.0));
    return selectedMCU === 'atmega328p' ? 20.0 : 16.0;
  }, [vcc, selectedMCU]);

  const isOverclocked = fCpuMhz > soaMaxFreqMhz + 0.1;

  // Power Consumption Calculations
  // 1. Core Dynamic Active Current: scales linearly with fCpu and with voltage^1.6~2
  // Typ: ATmega328P ~ 0.5mA / MHz at 5V, ~ 0.25mA / MHz at 3.3V, ~ 0.12mA / MHz at 1.8V
  const voltageScaleFactor = Math.pow(vcc / 5.0, 1.7);

  const coreActiveCurrentMa = useMemo(() => {
    const baseCurrentPerMhz = selectedMCU === 'atmega2560' ? 0.65 : selectedMCU === 'atmega128' ? 0.75 : 0.52;
    // Static base leakage + dynamic active
    const staticLeakageMa = 0.08 * voltageScaleFactor;
    const dynamicMa = fCpuMhz * baseCurrentPerMhz * voltageScaleFactor;
    return staticLeakageMa + dynamicMa;
  }, [fCpuMhz, voltageScaleFactor, selectedMCU]);

  // 2. Peripherals Current Sum in Active Mode
  const peripheralsActiveCurrentMa = useMemo(() => {
    let sumUa = 0;
    peripheralList.forEach((p) => {
      if (activePeripherals[p.id]) {
        // Peripheral clock scales with frequency if it's timer or comm
        let freqFactor = 1.0;
        if (p.category === 'timer' || p.category === 'comm') {
          freqFactor = Math.max(0.1, fCpuMhz / 16.0);
        }
        sumUa += p.baseCurrentUa * freqFactor * voltageScaleFactor;
      }
    });
    return sumUa / 1000.0; // convert µA to mA
  }, [peripheralList, activePeripherals, fCpuMhz, voltageScaleFactor]);

  // Total Active Current
  const totalActiveCurrentMa = coreActiveCurrentMa + peripheralsActiveCurrentMa;

  // 3. Sleep Mode Current Calculation
  const sleepCurrentMa = useMemo(() => {
    let sleepUa = 0;

    switch (sleepMode) {
      case 'idle':
        // Core clocks stop, but peripherals keep running
        sleepUa = (coreActiveCurrentMa * 0.3 * 1000.0) + (peripheralsActiveCurrentMa * 1000.0 * 0.9);
        break;
      case 'adc_noise':
        // CPU & I/O clock stopped, ADC clock running
        sleepUa = 150 * voltageScaleFactor + (activePeripherals.adc ? 240 * voltageScaleFactor : 0);
        break;
      case 'power_save':
        // Main oscillator stopped, Timer2 asynchronous clock running if enabled
        sleepUa = 1.2 * voltageScaleFactor + (activePeripherals.timer2 ? 1.5 * voltageScaleFactor : 0);
        break;
      case 'standby':
        // Main crystal running, but internal clocks halted
        sleepUa = 80.0 * voltageScaleFactor;
        break;
      case 'power_down':
      default:
        // Deep sleep: only WDT, BOD and pin change interrupts live
        sleepUa = (selectedMCU === 'atmega328p' ? 0.15 : 0.9) * voltageScaleFactor;
        break;
    }

    // Always add WDT if active in sleep
    if (activePeripherals.wdt) sleepUa += 5.5 * (vcc / 5.0);
    // Always add BOD if active in sleep
    if (activePeripherals.bod) sleepUa += 22.0 * (vcc / 5.0);

    return sleepUa / 1000.0; // convert to mA
  }, [sleepMode, coreActiveCurrentMa, peripheralsActiveCurrentMa, activePeripherals, voltageScaleFactor, vcc, selectedMCU]);

  // 4. Weighted Average Current Draw (Duty Cycle based)
  const dutyFraction = dutyCyclePercent / 100.0;
  const avgCurrentMa = (totalActiveCurrentMa * dutyFraction) + (sleepCurrentMa * (1.0 - dutyFraction));
  const avgPowerMw = vcc * avgCurrentMa;

  // 5. Battery Life Estimation
  const batteryLifeHours = useMemo(() => {
    if (avgCurrentMa <= 0.00001) return 999999;
    // Assuming 85% usable battery capacity due to self-discharge and voltage cutoff
    const usableMah = batteryType * 0.85;
    return usableMah / avgCurrentMa;
  }, [batteryType, avgCurrentMa]);

  const batteryDays = batteryLifeHours / 24.0;
  const batteryYears = batteryDays / 365.25;

  // Breakdown percentages for visual stacked chart
  const breakdownData = useMemo(() => {
    const total = avgCurrentMa;
    if (total <= 0) return { core: 50, peri: 40, sleep: 10 };

    const activeCoreContrib = (coreActiveCurrentMa * dutyFraction);
    const activePeriContrib = (peripheralsActiveCurrentMa * dutyFraction);
    const sleepContrib = (sleepCurrentMa * (1.0 - dutyFraction));

    return {
      core: Math.max(1, (activeCoreContrib / total) * 100),
      peri: Math.max(1, (activePeriContrib / total) * 100),
      sleep: Math.max(1, (sleepContrib / total) * 100),
      coreMa: activeCoreContrib,
      periMa: activePeriContrib,
      sleepMa: sleepContrib,
    };
  }, [avgCurrentMa, coreActiveCurrentMa, peripheralsActiveCurrentMa, sleepCurrentMa, dutyFraction]);

  // Presets
  const applyPreset = (preset: ScenarioPreset) => {
    setFCpuMhz(preset.fCpuMhz);
    setVcc(preset.vcc);
    setSleepMode(preset.sleepMode);
    setDutyCyclePercent(preset.dutyCycle);

    const newMap: Record<string, boolean> = {};
    peripheralList.forEach((p) => {
      newMap[p.id] = preset.activePeripherals.includes(p.id);
    });
    setActivePeripherals(newMap);
  };

  const PRESETS: ScenarioPreset[] = [
    {
      id: 'high_perf',
      name: '산업용 고성능 구동 (5V / 16MHz)',
      desc: '100% 상시 가동, 모든 시리얼(UART/SPI/TWI) 및 타이머/ADC 전원 인가',
      fCpuMhz: 16.0,
      vcc: 5.0,
      sleepMode: 'active',
      dutyCycle: 100.0,
      activePeripherals: ['adc', 'timer0', 'timer1', 'timer2', 'usart0', 'spi', 'twi', 'wdt', 'bod'],
    },
    {
      id: 'iot_sensor',
      name: '배터리 IoT 환경 센서 노드 (3.3V / 8MHz)',
      desc: '10초 주기(1% Active): BME280 샘플링 + 무선 송신 후 Power-down 진입',
      fCpuMhz: 8.0,
      vcc: 3.3,
      sleepMode: 'power_down',
      dutyCycle: 1.0,
      activePeripherals: ['adc', 'twi', 'wdt'],
    },
    {
      id: 'ultra_low',
      name: '초저전력 슬립 센서 (1.8V / 1MHz)',
      desc: '0.1% 듀티 사이클, BOD 해제, WDT 인터럽트로만 깨어나는 극저전력',
      fCpuMhz: 1.0,
      vcc: 1.8,
      sleepMode: 'power_down',
      dutyCycle: 0.1,
      activePeripherals: ['wdt'],
    },
    {
      id: 'rtc_logger',
      name: 'RTC 정밀 데이터 로거 (3.3V / 4MHz)',
      desc: 'Timer2 32.768kHz 비동기 발진 기반 Power-save 모드 (5% Active)',
      fCpuMhz: 4.0,
      vcc: 3.3,
      sleepMode: 'power_save',
      dutyCycle: 5.0,
      activePeripherals: ['timer2', 'adc', 'spi', 'wdt', 'bod'],
    },
  ];

  // PRR Generation C Code
  const generatedPrrCode = useMemo(() => {
    const disabledPeripherals = peripheralList.filter((p) => !activePeripherals[p.id]);

    return `// ============================================================================
// ${currentProfile.name} 전력 최적화 초기화 루틴 (F_CPU: ${fCpuMhz}MHz, VCC: ${vcc}V)
// 예상 평균 소모 전류: ${avgCurrentMa < 1 ? (avgCurrentMa * 1000).toFixed(1) + ' µA' : avgCurrentMa.toFixed(3) + ' mA'}
// ============================================================================
#include <avr/io.h>
#include <avr/power.h>
#include <avr/sleep.h>
#include <avr/wdt.h>

void setup_power_reduction(void) {
    // 1. 미사용 주변장치 클럭 차단 (PRR 레지스터 구성)
    ${
      disabledPeripherals.length === 0
        ? '// 모든 주변장치가 활성화됨 (PRR = 0x00)'
        : disabledPeripherals
            .map((p) => `${p.prrReg} |= (1 << ${p.prrBit}); // ${p.name.split(' ')[0]} 절전 차단`)
            .join('\n    ')
    }

    ${
      !activePeripherals.ac
        ? '// 2. 아날로그 비교기 전원 차단\n    ACSR |= (1 << ACD);'
        : '// 2. 아날로그 비교기 활성화 상태 유지'
    }

    // 3. 권장 슬립 모드 구성
    set_sleep_mode(${
      sleepMode === 'power_down'
        ? 'SLEEP_MODE_PWR_DOWN'
        : sleepMode === 'power_save'
        ? 'SLEEP_MODE_PWR_SAVE'
        : sleepMode === 'adc_noise'
        ? 'SLEEP_MODE_ADC'
        : sleepMode === 'standby'
        ? 'SLEEP_MODE_STANDBY'
        : 'SLEEP_MODE_IDLE'
    });
}
`;
  }, [currentProfile, fCpuMhz, vcc, avgCurrentMa, peripheralList, activePeripherals, sleepMode]);

  const copyCode = () => {
    navigator.clipboard.writeText(generatedPrrCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const saveCurrentAsBaseline = () => {
    setSavedScenario({
      fCpu: fCpuMhz,
      vcc: vcc,
      avgMa: avgCurrentMa,
      batteryDays: batteryDays,
      label: `${vcc}V / ${fCpuMhz}MHz (${dutyCyclePercent}%)`,
    });
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              전력 시나리오 시뮬레이터
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono">
                {currentProfile.name}
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
            클록 주파수, 인가 전압(VCC), 개별 주변장치(PRR) 활성화 상태 및 슬립 듀티사이클을 조합하여
            실시간 예상 소모 전류(mA/µA), 소비 전력(mW), 배터리 연속 사용 수명을 정밀 추정합니다.
          </p>
        </div>

        {/* Live Power Result Badges */}
        <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800 shrink-0">
          <div className="text-right px-2">
            <span className="text-[10px] text-slate-400 block font-mono">평균 소모 전류</span>
            <span className="text-base font-bold font-mono text-emerald-300">
              {avgCurrentMa < 1.0
                ? `${(avgCurrentMa * 1000).toFixed(1)} µA`
                : `${avgCurrentMa.toFixed(2)} mA`}
            </span>
          </div>

          <div className="h-8 w-px bg-slate-800" />

          <div className="text-right px-2">
            <span className="text-[10px] text-slate-400 block font-mono">소비 전력</span>
            <span className="text-base font-bold font-mono text-cyan-300">
              {avgPowerMw < 1.0
                ? `${(avgPowerMw * 1000).toFixed(1)} µW`
                : `${avgPowerMw.toFixed(2)} mW`}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Preset Scenarios Quick Bar */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            대표 전력 시나리오 프리셋
          </span>
          <span className="text-[10px] text-slate-500">원클릭으로 주파수/전압/주변장치 일괄 설정</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className="p-2.5 rounded-lg text-left bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-slate-300 hover:text-white transition-all text-xs flex flex-col justify-between"
            >
              <span className="font-bold text-[11px] text-emerald-300 line-clamp-1">
                {preset.name}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                {preset.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Core Parameter Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Clock Frequency (F_CPU) */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              클록 주파수 (F_CPU)
            </span>
            <span className="font-mono text-sm font-bold text-cyan-300">{fCpuMhz} MHz</span>
          </div>

          <input
            type="range"
            min="0.1"
            max="20.0"
            step="0.1"
            value={fCpuMhz}
            onChange={(e) => setFCpuMhz(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />

          <div className="flex items-center justify-between gap-1 flex-wrap pt-1">
            {[1.0, 4.0, 8.0, 16.0, 20.0].map((freq) => (
              <button
                key={freq}
                onClick={() => setFCpuMhz(freq)}
                className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                  fCpuMhz === freq
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {freq}M
              </button>
            ))}
          </div>

          {/* Overclocking Warning if exceeding SOA */}
          {isOverclocked && (
            <div className="p-2 rounded bg-rose-950/40 border border-rose-500/40 text-[10px] text-rose-300 flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                현재 전압({vcc}V)에서 최대 정격({soaMaxFreqMhz.toFixed(1)}MHz)을 초과한 오버클록 상태입니다!
              </span>
            </div>
          )}
        </div>

        {/* Card 2: Operating Voltage (VCC) */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              공급 전압 (VCC)
            </span>
            <span className="font-mono text-sm font-bold text-amber-300">{vcc.toFixed(1)} V</span>
          </div>

          <input
            type="range"
            min="1.8"
            max="5.5"
            step="0.1"
            value={vcc}
            onChange={(e) => setVcc(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />

          <div className="flex items-center justify-between gap-1 flex-wrap pt-1">
            {[1.8, 2.7, 3.3, 4.5, 5.0].map((v) => (
              <button
                key={v}
                onClick={() => setVcc(v)}
                className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                  Math.abs(vcc - v) < 0.05
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {v}V
              </button>
            ))}
          </div>

          <div className="text-[10px] text-slate-400 leading-relaxed bg-slate-900/60 p-2 rounded border border-slate-800/60">
            💡 5.0V 대비 3.3V 구동 시 동적 전력($P \propto V^2$)이 <strong>약 56% 절감</strong>됩니다.
          </div>
        </div>

        {/* Card 3: Sleep Mode & Duty Cycle */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              동작 듀티 사이클 &amp; 슬립 모드
            </span>
            <span className="font-mono text-sm font-bold text-emerald-300">{dutyCyclePercent}% Active</span>
          </div>

          <input
            type="range"
            min="0.1"
            max="100.0"
            step="0.1"
            value={dutyCyclePercent}
            onChange={(e) => setDutyCyclePercent(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />

          {/* Sleep Mode Selector */}
          <div className="pt-1">
            <span className="text-[10px] text-slate-400 block mb-1">비동작 시 진입할 슬립 모드:</span>
            <select
              value={sleepMode}
              onChange={(e) => setSleepMode(e.target.value as SleepMode)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-bold text-white font-mono focus:outline-none focus:border-emerald-500"
            >
              <option value="power_down">Power-down (최대 절전: ~0.15µA)</option>
              <option value="power_save">Power-save (Timer2 RTC 보존: ~1.5µA)</option>
              <option value="adc_noise">ADC Noise Reduction (저잡음 변환)</option>
              <option value="standby">Standby (크리스털 즉시 재가동)</option>
              <option value="idle">Idle (CPU만 정지, 타이머/통신 가동)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Peripheral Activation State Matrix (PRR Controls) */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div>
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              주변장치 전원 및 클록 활성화 상태 (Power Reduction Register)
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              사용하지 않는 하드웨어 블록을 체크 해제하면 PRR 레지스터에 비트가 기록되어 클록이 완전 차단됩니다.
            </p>
          </div>

          {/* Quick toggle all */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => {
                const map: Record<string, boolean> = {};
                peripheralList.forEach((p) => (map[p.id] = true));
                setActivePeripherals(map);
              }}
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 border border-slate-800 transition"
            >
              전체 활성화
            </button>
            <button
              onClick={() => {
                const map: Record<string, boolean> = {};
                peripheralList.forEach((p) => (map[p.id] = false));
                setActivePeripherals(map);
              }}
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-emerald-400 border border-slate-800 transition"
            >
              전체 절전 차단 (PRR Sleep)
            </button>
          </div>
        </div>

        {/* Peripherals Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
          {peripheralList.map((p) => {
            const isActive = activePeripherals[p.id];
            const currentUa = Math.round(p.baseCurrentUa * voltageScaleFactor);

            return (
              <div
                key={p.id}
                onClick={() =>
                  setActivePeripherals((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                }
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isActive
                    ? 'bg-slate-900/90 border-cyan-500/40 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800/80 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="space-y-0.5 pr-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isActive ? 'bg-cyan-400' : 'bg-slate-600'
                      }`}
                    />
                    <span className="text-xs font-bold text-white">{p.name.split(' ')[0]}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                      {p.prrBit}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block line-clamp-1">
                    {p.description}
                  </span>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`text-xs font-mono font-bold block ${
                      isActive ? 'text-cyan-300' : 'text-slate-500 line-through'
                    }`}
                  >
                    +{currentUa} µA
                  </span>
                  <span
                    className={`text-[9px] font-bold ${
                      isActive ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {isActive ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Real-Time Estimation Results & Battery Life Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Visual Current Breakdown Bar & Metrics */}
        <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-400" />
                전류 소모 구성 비율 (Power Breakdown)
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Active: {totalActiveCurrentMa.toFixed(2)} mA | Sleep: {(sleepCurrentMa * 1000).toFixed(1)} µA
              </span>
            </div>

            {/* Visual Stacked Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-900 border border-slate-800">
                <div
                  style={{ width: `${breakdownData.core}%` }}
                  className="bg-cyan-500 transition-all duration-300"
                  title={`CPU 코어: ${breakdownData.core.toFixed(1)}%`}
                />
                <div
                  style={{ width: `${breakdownData.peri}%` }}
                  className="bg-teal-400 transition-all duration-300"
                  title={`주변장치: ${breakdownData.peri.toFixed(1)}%`}
                />
                <div
                  style={{ width: `${breakdownData.sleep}%` }}
                  className="bg-indigo-500 transition-all duration-300"
                  title={`슬립 대기 누설: ${breakdownData.sleep.toFixed(1)}%`}
                />
              </div>

              {/* Legend */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-500" />
                  CPU 코어 동적: {breakdownData.core.toFixed(1)}%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                  주변장치(PRR): {breakdownData.peri.toFixed(1)}%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  슬립 대기/WDT: {breakdownData.sleep.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Numeric Table Summary */}
            <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                <span className="text-[10px] text-slate-400 block font-mono">순수 코어 전류</span>
                <span className="font-mono font-bold text-cyan-300">
                  {coreActiveCurrentMa.toFixed(2)} mA
                </span>
              </div>
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                <span className="text-[10px] text-slate-400 block font-mono">주변장치 총합</span>
                <span className="font-mono font-bold text-teal-300">
                  {(peripheralsActiveCurrentMa * 1000).toFixed(0)} µA
                </span>
              </div>
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                <span className="text-[10px] text-slate-400 block font-mono">슬립 모드 누설</span>
                <span className="font-mono font-bold text-indigo-300">
                  {(sleepCurrentMa * 1000).toFixed(1)} µA
                </span>
              </div>
            </div>
          </div>

          {/* Scenario Comparison Action */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              현재 설정을 베이스라인 시나리오로 고정하여 개선치 비교
            </span>
            <button
              onClick={saveCurrentAsBaseline}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1"
            >
              기준 시나리오 저장
            </button>
          </div>
        </div>

        {/* Battery Life Forecast Card */}
        <div className="lg:col-span-5 bg-slate-950/80 border border-emerald-500/30 rounded-xl p-4 space-y-4 flex flex-col justify-between shadow-lg">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Battery className="w-4 h-4 text-emerald-400" />
                예상 배터리 수명 (Battery Life)
              </span>
              <select
                value={batteryType}
                onChange={(e) => setBatteryType(parseInt(e.target.value))}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-[11px] font-mono text-emerald-300"
              >
                <option value="220">CR2032 코인셀 (220 mAh)</option>
                <option value="1000">AAA 알카라인 x2 (1000 mAh)</option>
                <option value="2400">AA 알카라인 x2 (2400 mAh)</option>
                <option value="1200">Li-Po 소형 배터리 (1200 mAh)</option>
                <option value="3000">18650 리튬이온 (3000 mAh)</option>
              </select>
            </div>

            {/* Highlight Metric */}
            <div className="text-center p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1">
              <span className="text-[11px] text-slate-400 block font-mono">연속 동작 가능 기간</span>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-300">
                {batteryDays > 365
                  ? `${batteryYears.toFixed(1)}년 (${Math.round(batteryDays)}일)`
                  : batteryDays >= 1
                  ? `${batteryDays.toFixed(1)}일 (${Math.round(batteryLifeHours)}시간)`
                  : `${batteryLifeHours.toFixed(1)}시간`}
              </div>
              <span className="text-[10px] text-slate-500 block">
                배터리 자연 방전율 및 컷오프 전압을 고려한 실질 가용 용량(85%) 기준
              </span>
            </div>

            {/* Compared with baseline scenario */}
            {savedScenario && (
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">저장된 기준: {savedScenario.label}</span>
                  <span className="font-mono text-slate-300">{savedScenario.avgMa.toFixed(2)} mA</span>
                </div>
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-300">전류 절감율:</span>
                  <span
                    className={
                      avgCurrentMa < savedScenario.avgMa ? 'text-emerald-400' : 'text-rose-400'
                    }
                  >
                    {avgCurrentMa < savedScenario.avgMa
                      ? `▼ ${(((savedScenario.avgMa - avgCurrentMa) / savedScenario.avgMa) * 100).toFixed(1)}% 절감`
                      : `▲ ${(((avgCurrentMa - savedScenario.avgMa) / savedScenario.avgMa) * 100).toFixed(1)}% 증가`}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-2">
            💡 <strong>초저전력 팁:</strong> 딥슬립 진입 시 BOD(Brown-out Detector)를 슬립 중 비활성화하는
            <code>sleep_bod_disable()</code> 명령어를 사용하면 대기 전류를 20µA 추가 절감할 수 있습니다.
          </div>
        </div>
      </div>

      {/* 6. Optimized PRR C/C++ Code Generator */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-200">
              시뮬레이션 기반 맞춤형 PRR 절전 초기화 C 코드
            </span>
          </div>

          <button
            onClick={copyCode}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 flex items-center gap-1.5 transition-all"
          >
            {copiedCode ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">복사 완료!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>C 코드 복사</span>
              </>
            )}
          </button>
        </div>

        <pre className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800/80 text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed">
          {generatedPrrCode}
        </pre>
      </div>
    </div>
  );
};
