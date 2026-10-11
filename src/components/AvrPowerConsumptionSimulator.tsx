import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
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
  Terminal
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type SleepMode = 'active' | 'idle' | 'adc_noise_reduction' | 'power_save' | 'standby' | 'power_down';

interface PeripheralItem {
  id: string;
  name: string;
  category: 'analog' | 'timer' | 'comm' | 'core';
  baseCurrentUa: number; // typical current consumption in µA at 5V / 16MHz
  prrRegister: string; // e.g. PRR or PRR0
  prrBit: string; // e.g. PRADC
  description: string;
}

export const AvrPowerConsumptionSimulator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // System Operating Parameters
  const [fCpuMhz, setFCpuMhz] = useState<number>(16); // 0.128 ~ 20 MHz
  const [vccVoltage, setVccVoltage] = useState<number>(5.0); // 1.8 ~ 5.5 V
  const [operatingMode, setOperatingMode] = useState<SleepMode>('active');
  const [activeDutyCyclePercent, setActiveDutyCyclePercent] = useState<number>(10); // 10% active, 90% sleep (typical IoT duty cycle)

  // Peripherals list for the MCU
  const peripheralsList: PeripheralItem[] = useMemo(() => {
    const list: PeripheralItem[] = [
      {
        id: 'adc',
        name: 'ADC (10-bit 아날로그-디지털 변환기 & 밴드갭)',
        category: 'analog',
        baseCurrentUa: 240,
        prrRegister: 'PRR',
        prrBit: 'PRADC',
        description: 'ADC 전원 및 내부 비교기, 1.1V 밴드갭 전압원 상시 동작 전류'
      },
      {
        id: 'timer0',
        name: 'Timer/Counter0 (8-bit 기본 시스템 틱 & PWM)',
        category: 'timer',
        baseCurrentUa: 110,
        prrRegister: 'PRR',
        prrBit: 'PRTIM0',
        description: 'millis() 타이머 카운터 및 PWM 발생 클럭 공급'
      },
      {
        id: 'timer1',
        name: 'Timer/Counter1 (16-bit 고정밀 서보 & 캡처)',
        category: 'timer',
        baseCurrentUa: 140,
        prrRegister: 'PRR',
        prrBit: 'PRTIM1',
        description: '16비트 타이머 카운터 및 비교 일치 레지스터'
      },
      {
        id: 'timer2',
        name: 'Timer/Counter2 (8-bit 비동기 RTC 클럭)',
        category: 'timer',
        baseCurrentUa: 120,
        prrRegister: 'PRR',
        prrBit: 'PRTIM2',
        description: '32.768kHz TOSC1/2 크리스털 연결 가능 비동기 타이머'
      },
      {
        id: 'usart0',
        name: 'USART0 (시리얼 통신 송수신기)',
        category: 'comm',
        baseCurrentUa: 180,
        prrRegister: 'PRR',
        prrBit: 'PRUSART0',
        description: '보드레이트 발생기 및 RX/TX 클럭 트리'
      },
      {
        id: 'spi',
        name: 'SPI (고속 직렬 주변기기 인터페이스)',
        category: 'comm',
        baseCurrentUa: 130,
        prrRegister: 'PRR',
        prrBit: 'PRSPI',
        description: 'SPI 시프트 레지스터 및 마스터 클럭 분주기'
      },
      {
        id: 'twi',
        name: 'TWI / I2C (2선식 직렬 버스)',
        category: 'comm',
        baseCurrentUa: 150,
        prrRegister: 'PRR',
        prrBit: 'PRTWI',
        description: 'I2C 슬루레이트 리미터 및 버스 상태 머신'
      },
      {
        id: 'ac',
        name: 'Analog Comparator (아날로그 비교기)',
        category: 'analog',
        baseCurrentUa: 75,
        prrRegister: 'ACSR',
        prrBit: 'ACD (Disable bit)',
        description: 'AIN0 / AIN1 핀 전압 비교기'
      },
      {
        id: 'wdt',
        name: 'Watchdog Timer (내부 128kHz WDT 오실레이터)',
        category: 'core',
        baseCurrentUa: 8,
        prrRegister: 'WDTCSR',
        prrBit: 'WDE',
        description: '독립 128kHz 초저전력 발진기'
      },
      {
        id: 'bod',
        name: 'Brown-out Detector (하드웨어 저전압 검출기)',
        category: 'core',
        baseCurrentUa: 25,
        prrRegister: 'FUSE',
        prrBit: 'BODLEVEL',
        description: '전압 강하 모니터링 내부 밴드갭 회로'
      }
    ];

    if (selectedMCU === 'atmega128' || selectedMCU === 'atmega640') {
      list.push(
        {
          id: 'usart1',
          name: 'USART1 (두 번째 시리얼 통신 포트)',
          category: 'comm',
          baseCurrentUa: 180,
          prrRegister: 'PRR0',
          prrBit: 'PRUSART1',
          description: '추가 USART 송수신 회로'
        },
        {
          id: 'timer3',
          name: 'Timer/Counter3 (16-bit 추가 타이머)',
          category: 'timer',
          baseCurrentUa: 140,
          prrRegister: 'PRR1',
          prrBit: 'PRTIM3',
          description: '추가 16비트 PWM 채널'
        }
      );
    }

    return list;
  }, [selectedMCU]);

  // Active peripherals checkbox state (defaults)
  const [activePeripherals, setActivePeripherals] = useState<Record<string, boolean>>({
    adc: true,
    timer0: true,
    timer1: false,
    timer2: false,
    usart0: true,
    spi: false,
    twi: false,
    ac: false,
    wdt: true,
    bod: true
  });

  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const togglePeripheral = (id: string) => {
    setActivePeripherals((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSelectAllPeripherals = (enabled: boolean) => {
    const updated: Record<string, boolean> = {};
    peripheralsList.forEach((p) => {
      updated[p.id] = enabled;
    });
    setActivePeripherals(updated);
  };

  // Power Consumption Physics Modeling Engine
  const powerModel = useMemo(() => {
    // 1. Core Dynamic CPU Current:
    // ATmega328P datasheet: Active supply current is approx 0.45 mA / MHz at 5V, 0.22 mA / MHz at 3.3V
    // Scaled by (Vcc / 5.0)^1.35
    const voltageScaling = (vccVoltage / 5.0) ** 1.35;
    const freqMhz = fCpuMhz;

    let baseCoreCurrentMa = 0;
    if (operatingMode === 'active') {
      baseCoreCurrentMa = (0.42 * freqMhz) * voltageScaling; // e.g. ~6.7mA @ 16MHz, 5V
    } else if (operatingMode === 'idle') {
      baseCoreCurrentMa = (0.16 * freqMhz) * voltageScaling; // Core clock halted, flash clock halted
    } else if (operatingMode === 'adc_noise_reduction') {
      baseCoreCurrentMa = 0.8 * voltageScaling; // Core halted, ADC clock running
    } else if (operatingMode === 'power_save') {
      baseCoreCurrentMa = 0.002 * voltageScaling; // Timer2 TOSC running only
    } else if (operatingMode === 'standby') {
      baseCoreCurrentMa = 0.08 * voltageScaling; // Crystal osc running, core stopped
    } else {
      // Power-down (Deep sleep)
      baseCoreCurrentMa = (selectedMCU === 'atmega328p' ? 0.00015 : 0.005) * voltageScaling; // 0.15µA ~ 5µA
    }

    // 2. Peripherals Current Summation (scaled by voltage and freq if clock-dependent)
    let peripheralsTotalUa = 0;
    const activePeripheralsBreakdown: { name: string; currentUa: number; prrBit: string }[] = [];

    peripheralsList.forEach((p) => {
      if (activePeripherals[p.id]) {
        let currentUa = p.baseCurrentUa * (vccVoltage / 5.0);

        // Adjust for sleep mode disabling specific peripherals automatically
        if (operatingMode === 'power_down' || operatingMode === 'power_save') {
          if (p.id !== 'wdt' && p.id !== 'bod' && !(operatingMode === 'power_save' && p.id === 'timer2')) {
            currentUa = 0; // Hardware sleep automatically cuts clocks
          }
        } else if (operatingMode === 'idle') {
          // Clock-dependent peripherals scale with frequency
          if (p.category === 'timer' || p.category === 'comm') {
            currentUa = (currentUa * (freqMhz / 16.0));
          }
        } else {
          // Active mode
          if (p.category === 'timer' || p.category === 'comm') {
            currentUa = (currentUa * (freqMhz / 16.0));
          }
        }

        if (currentUa > 0) {
          peripheralsTotalUa += currentUa;
          activePeripheralsBreakdown.push({
            name: p.name,
            currentUa: Math.round(currentUa),
            prrBit: p.prrBit
          });
        }
      }
    });

    const peripheralsTotalMa = peripheralsTotalUa / 1000;
    const totalCurrentMa = baseCoreCurrentMa + peripheralsTotalMa;
    const totalPowerMw = vccVoltage * totalCurrentMa;

    // 3. Duty Cycle Average Current (e.g. 10% Active + 90% Power-down sleep):
    const sleepCurrentMa = (0.00015 + (activePeripherals['wdt'] ? 0.008 : 0) + (activePeripherals['bod'] ? 0.025 : 0)) * (vccVoltage / 5.0);
    const averageDutyCurrentMa = (totalCurrentMa * (activeDutyCyclePercent / 100)) + (sleepCurrentMa * (1 - (activeDutyCyclePercent / 100)));

    // 4. Battery Lifetimes
    // CR2032 (220 mAh), 2xAA Alkaline (2400 mAh), LiPo 18650 (2600 mAh)
    const cr2032HoursContinuous = totalCurrentMa > 0 ? Math.round(220 / totalCurrentMa) : 999999;
    const cr2032HoursDutyCycle = averageDutyCurrentMa > 0 ? Math.round(220 / averageDutyCurrentMa) : 999999;
    const aaHoursDutyCycle = averageDutyCurrentMa > 0 ? Math.round(2400 / averageDutyCurrentMa) : 999999;

    return {
      baseCoreCurrentMa: parseFloat(baseCoreCurrentMa.toFixed(3)),
      peripheralsTotalMa: parseFloat(peripheralsTotalMa.toFixed(3)),
      totalCurrentMa: parseFloat(totalCurrentMa.toFixed(3)),
      totalPowerMw: parseFloat(totalPowerMw.toFixed(2)),
      averageDutyCurrentMa: parseFloat(averageDutyCurrentMa.toFixed(4)),
      cr2032HoursContinuous,
      cr2032HoursDutyCycle,
      aaHoursDutyCycle,
      activePeripheralsBreakdown
    };
  }, [
    fCpuMhz,
    vccVoltage,
    operatingMode,
    activeDutyCyclePercent,
    activePeripherals,
    peripheralsList,
    selectedMCU
  ]);

  // Generate PRR (Power Reduction Register) Configuration C Code
  const generatedPrrCode = useMemo(() => {
    const disabledBits: string[] = [];
    peripheralsList.forEach((p) => {
      // If unchecked, turn off peripheral by setting PRR bit to 1
      if (!activePeripherals[p.id] && p.prrBit.startsWith('PR')) {
        disabledBits.push(`(1 << ${p.prrBit})`);
      }
    });

    const prrValue = disabledBits.length > 0 ? disabledBits.join(' |\n           ') : '0x00';

    return `// ==============================================================================
// ${currentProfile.name} 초저전력 최적화 PRR(Power Reduction Register) 초기화 C 코드
// F_CPU: ${fCpuMhz}MHz, VCC: ${vccVoltage}V, 예상 소비 전류: ${powerModel.totalCurrentMa} mA
// ==============================================================================
#include <avr/io.h>
#include <avr/sleep.h>
#include <avr/power.h>

void power_saving_init(void) {
    // 1. 미사용 주변장치 클럭 완전 차단 (PRR 레지스터에 1을 기록하여 전력 절감)
    PRR = ${prrValue};

    ${!activePeripherals['ac'] ? `// 2. 아날로그 비교기(AC) 전원 차단 (ACD 비트 세팅으로 약 75µA 절약)\n    ACSR |= (1 << ACD);\n` : ''}
    ${!activePeripherals['adc'] ? `// 3. ADC 활성화 비트 차단 (ADEN 클리어로 약 240µA 절약)\n    ADCSRA &= ~(1 << ADEN);\n` : ''}
    // 4. 디지털 입력 버퍼 차단 (DIDR0: 플로팅 아날로그 핀의 누설 전류 방지)
    DIDR0 = 0x3F;

    // 5. 취침 슬립 모드 사전 구성 (${operatingMode.toUpperCase()})
    ${operatingMode === 'power_down' ? 'set_sleep_mode(SLEEP_MODE_PWR_DOWN);' : operatingMode === 'idle' ? 'set_sleep_mode(SLEEP_MODE_IDLE);' : 'set_sleep_mode(SLEEP_MODE_ADC);'}
}

// 듀티 사이클 주기적 저전력 수면 루틴 예제
void enter_deep_sleep(void) {
    sleep_enable();
    ${activePeripherals['bod'] === false ? 'sleep_bod_disable(); // 취침 직전 BOD를 차단하여 25µA 추가 절약' : ''}
    sleep_cpu();
    sleep_disable();
}
`;
  }, [
    currentProfile.name,
    fCpuMhz,
    vccVoltage,
    powerModel.totalCurrentMa,
    activePeripherals,
    peripheralsList,
    operatingMode
  ]);

  const copyCode = () => {
    navigator.clipboard.writeText(generatedPrrCode);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.3 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Title Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Battery className="w-3.5 h-3.5" /> AVR Power Consumption Simulator
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              MCU: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-mono">
              PRR Power Reduction Engine
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            AVR 전력 소비 시뮬레이터 (Power Consumption Simulator)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            클럭 속도(MHz), 공급 전압(Vcc), 활성화된 주변 장치(ADC, Timer, USART, SPI, TWI 등)를 체크박스로 선택하면
            <strong>예상 소비 전류(mA) 및 소모 전력(mW)</strong>을 실시간 계산하고, <strong>저전력 설계 권장 사항 및 PRR 레지스터 초기화 C 코드</strong>를 제공합니다.
          </p>
        </div>

        {/* Copy Action */}
        <button
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20 shrink-0"
        >
          {copiedCode ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
          <span>{copiedCode ? 'PRR 코드 복사 완료' : '저전력 C 코드 복사'}</span>
        </button>
      </div>

      {/* Metrics Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Current */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold">총 소비 전류 (I_CC):</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {powerModel.totalCurrentMa} <span className="text-sm font-normal text-slate-400">mA</span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            코어: {powerModel.baseCoreCurrentMa}mA + 주변기기: {powerModel.peripheralsTotalMa}mA
          </p>
        </div>

        {/* Metric 2: Power in mW */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold">소비 전력 (Power):</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            {powerModel.totalPowerMw} <span className="text-sm font-normal text-slate-400">mW</span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            P = {vccVoltage}V × {powerModel.totalCurrentMa}mA
          </p>
        </div>

        {/* Metric 3: Duty Cycle Avg Current */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold">듀티 평균 전류 ({activeDutyCyclePercent}% 동작):</span>
            <Gauge className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-300 font-mono">
            {powerModel.averageDutyCurrentMa} <span className="text-sm font-normal text-slate-400">mA</span>
          </div>
          <p className="text-[10px] text-slate-500">
            {100 - activeDutyCyclePercent}% 시간 슬립 모드 진입 시
          </p>
        </div>

        {/* Metric 4: Battery Lifetime */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold">CR2032 배터리 수명 (듀티 기준):</span>
            <Battery className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300 font-mono">
            {powerModel.cr2032HoursDutyCycle > 240 ? `${Math.round(powerModel.cr2032HoursDutyCycle / 24).toLocaleString()} 일` : `${powerModel.cr2032HoursDutyCycle} 시간`}
          </div>
          <p className="text-[10px] text-slate-500">
            AA 알카라인(2400mAh): 약 {Math.round(powerModel.aaHoursDutyCycle / 24).toLocaleString()}일
          </p>
        </div>
      </div>

      {/* Grid: Inputs Form (5 cols) & Peripheral Checkboxes (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: System Conditions (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">클럭 속도 및 공급 전압 설정</h3>
          </div>

          {/* 1. Supply Voltage (Vcc) */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1 font-medium">
              <span className="text-slate-400">공급 전압 (Vcc):</span>
              <span className="text-emerald-400 font-bold font-mono text-sm">{vccVoltage.toFixed(1)} V</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
              {[1.8, 3.3, 5.0].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVccVoltage(v)}
                  className={`py-1.5 rounded-lg border font-bold transition text-center ${
                    vccVoltage === v
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {v}V {v === 1.8 ? '(초저전력)' : v === 3.3 ? '(배터리)' : '(표준)'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 font-sans">
              💡 5V에서 3.3V로 전압을 낮추면 동적 전력($P \propto V^2$)이 <strong>약 56% 대폭 절감</strong>됩니다.
            </p>
          </div>

          {/* 2. Clock Speed (F_CPU) */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1 font-medium">
              <span className="text-slate-400">시스템 클럭 속도 (F_CPU):</span>
              <span className="text-cyan-400 font-bold font-mono text-sm">{fCpuMhz} MHz</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={fCpuMhz}
              onChange={(e) => setFCpuMhz(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <button onClick={() => setFCpuMhz(1)} className="hover:text-white">1 MHz (내부RC)</button>
              <button onClick={() => setFCpuMhz(4)} className="hover:text-white">4 MHz</button>
              <button onClick={() => setFCpuMhz(8)} className="hover:text-white">8 MHz</button>
              <button onClick={() => setFCpuMhz(16)} className="hover:text-white font-bold text-cyan-400">16 MHz</button>
              <button onClick={() => setFCpuMhz(20)} className="hover:text-white">20 MHz</button>
            </div>
          </div>

          {/* 3. Sleep / Operating Mode */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">동작 / 수면 모드 (Operating Mode)</label>
            <select
              value={operatingMode}
              onChange={(e) => setOperatingMode(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
            >
              <option value="active">Active (CPU 코어 및 주변장치 연속 동작)</option>
              <option value="idle">Idle (CPU 정지, 주변장치 클럭 유지)</option>
              <option value="adc_noise_reduction">ADC Noise Reduction (초저노이즈 변환 모드)</option>
              <option value="power_save">Power-save (32.768kHz RTC 타이머만 유지)</option>
              <option value="standby">Standby (크리스털 발진기 유지, 초고속 기상)</option>
              <option value="power_down">Power-down (최대 절전 딥슬립 - 0.15µA)</option>
            </select>
          </div>

          {/* 4. Active Duty Cycle Slider */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1 font-medium">
              <span className="text-slate-400">동작 듀티비 (Active Duty Cycle):</span>
              <span className="text-amber-400 font-bold font-mono">{activeDutyCyclePercent}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="100"
              step="0.5"
              value={activeDutyCyclePercent}
              onChange={(e) => setActiveDutyCyclePercent(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
              <span>1% (초저전력 센서 노드)</span>
              <span>10% (표준 비콘)</span>
              <span>100% (연속 동작)</span>
            </div>
          </div>
        </div>

        {/* Right: Peripheral Checkboxes & Low-Power Guidelines (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Peripherals Selection Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">활성화된 하드웨어 주변 장치 (PRR 레지스터)</h3>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => handleSelectAllPeripherals(true)}
                  className="text-cyan-400 hover:underline"
                >
                  전체 선택
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => handleSelectAllPeripherals(false)}
                  className="text-slate-400 hover:underline"
                >
                  전체 해제 (초저전력)
                </button>
              </div>
            </div>

            {/* Checkbox Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {peripheralsList.map((item) => {
                const isChecked = !!activePeripherals[item.id];
                return (
                  <div
                    key={item.id}
                    onClick={() => togglePeripheral(item.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition select-none flex items-start gap-2.5 ${
                      isChecked
                        ? 'bg-slate-900/90 border-emerald-500/50 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800/60 opacity-60 hover:opacity-100 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // handled by parent onClick
                      className="rounded accent-emerald-500 w-4 h-4 mt-0.5 shrink-0 cursor-pointer"
                    />
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200 truncate">{item.name.split(' (')[0]}</span>
                        <span className="text-[10px] text-amber-400 font-mono font-bold shrink-0 ml-1">
                          +{item.baseCurrentUa}µA
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug line-clamp-1 font-sans">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Low Power Engineering Recommendations Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">AVR 저전력 설계를 위한 핵심 권장 사항 (Golden Rules)</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-sans">
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-1">
                <strong className="text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 1. PRR 레지스터 적극 활용
                </strong>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  미사용 주변기기는 <code>PRR</code> 레지스터에 1을 기록하여 클럭 분배를 차단하세요. ADC는 <code>ADEN=0</code>, 비교기는 <code>ACD=1</code>을 설정하여 아날로그 회로 전류를 완전히 차단해야 합니다.
                </p>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-1">
                <strong className="text-cyan-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 2. 플로팅 핀(Floating Pin) 방지
                </strong>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  미연결 입력 핀이 플로팅 상태가 되면 중간 전압으로 인해 내부 CMOS 입력 버퍼에서 슛스루(Shoot-through) 누설 전류가 발생합니다. 모든 미사용 핀을 내부 풀업(PORTx=1)으로 고정하거나 <code>DIDR0</code>로 버퍼를 끄십시오.
                </p>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-1">
                <strong className="text-amber-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 3. 전압 하향화 (Vcc Scaling)
                </strong>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  5V 대신 3.3V 또는 2.7V로 구동하고, 클럭을 8MHz 내부 RC 오실레이터로 낮추면 외부 크리스털 구동 전류와 코어 소비 전력을 50% 이상 즉시 절감할 수 있습니다.
                </p>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-1">
                <strong className="text-purple-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 4. 슬립 모드 & BOD 비활성화
                </strong>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  슬립 모드 진입 시 <code>sleep_bod_disable()</code> 함수를 호출하여 브라운아웃 검출 회로를 일시 차단하면 슬립 상태 누설 전류를 25µA에서 0.2µA 이하로 극단적으로 낮출 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Generated C Source Code Panel */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-white font-mono">
              {currentProfile.name} 자동 연동 PRR 저전력 초기화 C 코드 (power_saving_init.c)
            </span>
          </div>

          <button
            onClick={copyCode}
            className="text-slate-400 hover:text-white text-xs font-mono inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copiedCode ? '복사됨' : '전체 복사'}</span>
          </button>
        </div>

        <pre className="p-5 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto max-h-[460px] custom-scrollbar bg-slate-950/90 selection:bg-emerald-500/30">
          {generatedPrrCode}
        </pre>
      </div>
    </div>
  );
};
