import React, { useState } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { BatteryCharging, Gauge, Moon, Sliders, TrendingDown, Zap } from 'lucide-react';

interface Props {
  selectedMCU: SupportedMCU;
}

interface SleepModeStat {
  modeName: string;
  korName: string;
  desc: string;
  currentFactor: number; // relative to active current
  absoluteCurrent_uA: number; // typical at selected voltage
  savingsPercent: number;
  color: string;
  wakeSources: string;
}

export const EnergyEstimator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // User Interactive Inputs
  const [voltage, setVoltage] = useState<number>(() => (selectedMCU === 'atmega128' ? 5.0 : 3.3));
  const [freqMHz, setFreqMHz] = useState<number>(16.0);
  const [dutyCycleActive, setDutyCycleActive] = useState<number>(10); // % of time in Active mode
  const [batteryCapacity_mAh, setBatteryCapacity_mAh] = useState<number>(1000); // e.g. 1000mAh battery

  // Voltage range check per MCU
  const minVoltage = selectedMCU === 'atmega128' ? 2.7 : 1.8;
  const maxVoltage = 5.5;

  // Max freq check based on SOA
  const safeMaxFreq =
    voltage < 2.7
      ? 4.0
      : voltage < 4.5
      ? 8.0
      : selectedMCU === 'atmega328p'
      ? 20.0
      : 16.0;

  const isOverclocked = freqMHz > safeMaxFreq;

  // Active Current Model (mA) based on Microchip Datasheet curves:
  // I_active ≈ Freq * k_freq * (V/5)^1.3 + I_static
  const getActiveCurrent_mA = (mcu: SupportedMCU, v: number, f: number): number => {
    let k_freq = 0.55; // mA per MHz at 5V
    let i_static = 0.8; // mA

    if (mcu === 'atmega328p') {
      k_freq = 0.45; // PicoPower efficiency
      i_static = 0.3;
    } else if (mcu === 'atmega128') {
      k_freq = 0.95; // older process
      i_static = 1.8;
    } else {
      // atmega640
      k_freq = 0.65;
      i_static = 1.0;
    }

    const voltageScaling = Math.pow(v / 5.0, 1.4);
    const current = (f * k_freq + i_static) * voltageScaling;
    return Math.max(0.1, current);
  };

  const activeCurrent_mA = getActiveCurrent_mA(selectedMCU, voltage, freqMHz);
  const activePower_mW = activeCurrent_mA * voltage;

  // Sleep Modes Current Data (uA typical)
  const getSleepModes = (mcu: SupportedMCU, v: number): SleepModeStat[] => {
    // scale factor with voltage
    const vFactor = Math.pow(v / 3.3, 1.2);

    if (mcu === 'atmega328p') {
      const idle_uA = activeCurrent_mA * 1000 * 0.35;
      const adc_noise_uA = 220 * vFactor;
      const power_save_uA = 1.2 * vFactor;
      const power_down_uA = 0.2 * vFactor;
      const standby_uA = 0.9 * vFactor;

      return [
        {
          modeName: 'Active (동작 중)',
          korName: '전원 정상 동작',
          desc: 'CPU 코어 및 모든 클럭 버스가 전속력으로 명령어를 실행하는 상태',
          currentFactor: 1.0,
          absoluteCurrent_uA: activeCurrent_mA * 1000,
          savingsPercent: 0,
          color: '#ef4444',
          wakeSources: '상시 동작'
        },
        {
          modeName: 'Idle 모드',
          korName: 'CPU 정지 / 주변장치 동작',
          desc: 'CPU와 플래시 클럭 정지, 타이머/USART/SPI 클럭은 계속 유지',
          currentFactor: 0.35,
          absoluteCurrent_uA: idle_uA,
          savingsPercent: Math.round((1 - idle_uA / (activeCurrent_mA * 1000)) * 100),
          color: '#f97316',
          wakeSources: '모든 인터럽트 / USART 수신'
        },
        {
          modeName: 'ADC Noise Reduction',
          korName: 'ADC 저노이즈 모드',
          desc: 'CPU 및 I/O 클럭을 멈추어 고정밀 10비트 아날로그 변환 노이즈 억제',
          currentFactor: 0.05,
          absoluteCurrent_uA: adc_noise_uA,
          savingsPercent: 95,
          color: '#eab308',
          wakeSources: 'ADC 완료 인터럽트, 외부 인터럽트'
        },
        {
          modeName: 'Power-save 모드',
          korName: '절전 (RTC 시계 유지)',
          desc: '32.768kHz 저주파 크리스탈로 Timer2만 구동하며 시스템 시각 유지',
          currentFactor: 0.0003,
          absoluteCurrent_uA: power_save_uA,
          savingsPercent: 99.9,
          color: '#06b6d4',
          wakeSources: 'Timer2 비동기 오버플로우, 외부 핀'
        },
        {
          modeName: 'Power-down 모드',
          korName: '최대 절전 (초저전력)',
          desc: '모든 내부 오실레이터 정지, SRAM 데이터만 보존 (PicoPower 0.2µA)',
          currentFactor: 0.00005,
          absoluteCurrent_uA: power_down_uA,
          savingsPercent: 99.99,
          color: '#10b981',
          wakeSources: 'INT0/INT1 외부 인터럽트, WDT, 핀 체인지'
        }
      ];
    } else if (mcu === 'atmega128') {
      const idle_uA = activeCurrent_mA * 1000 * 0.45;
      const adc_noise_uA = 900 * vFactor;
      const power_save_uA = 12 * vFactor;
      const power_down_uA = 4.5 * vFactor;

      return [
        {
          modeName: 'Active (동작 중)',
          korName: '전원 정상 동작',
          desc: '128KB 플래시 및 페리페럴 전원 인가 동작 상태',
          currentFactor: 1.0,
          absoluteCurrent_uA: activeCurrent_mA * 1000,
          savingsPercent: 0,
          color: '#ef4444',
          wakeSources: '상시 동작'
        },
        {
          modeName: 'Idle 모드',
          korName: 'CPU 정지 / 페리페럴 동작',
          desc: 'CPU 클럭만 차단하고 2개 USART 및 타이머를 구동',
          currentFactor: 0.45,
          absoluteCurrent_uA: idle_uA,
          savingsPercent: 55,
          color: '#f97316',
          wakeSources: '인터럽트, USART0/1'
        },
        {
          modeName: 'ADC Noise Reduction',
          korName: 'ADC 변환 대기 모드',
          desc: 'ADC 정확도를 높이기 위한 내부 I/O 버스 차단',
          currentFactor: 0.12,
          absoluteCurrent_uA: adc_noise_uA,
          savingsPercent: 88,
          color: '#eab308',
          wakeSources: 'ADC 인터럽트'
        },
        {
          modeName: 'Power-save 모드',
          korName: '절전 (TOSC 타이머 유지)',
          desc: 'TOSC1/2 비동기 타이머 클럭만 유지',
          currentFactor: 0.002,
          absoluteCurrent_uA: power_save_uA,
          savingsPercent: 99.8,
          color: '#06b6d4',
          wakeSources: 'Timer0 비동기, INT0~7'
        },
        {
          modeName: 'Power-down 모드',
          korName: '최대 절전 모드',
          desc: '모든 클럭 정지, SRAM 보존 (약 4~10µA)',
          currentFactor: 0.0006,
          absoluteCurrent_uA: power_down_uA,
          savingsPercent: 99.95,
          color: '#10b981',
          wakeSources: '외부 인터럽트 INT0~7, WDT'
        }
      ];
    } else {
      // atmega640
      const idle_uA = activeCurrent_mA * 1000 * 0.4;
      const adc_noise_uA = 650 * vFactor;
      const power_save_uA = 6.5 * vFactor;
      const power_down_uA = 1.5 * vFactor;

      return [
        {
          modeName: 'Active (동작 중)',
          korName: '전원 정상 동작',
          desc: '86개 I/O 및 4개 USART 전속력 실행 상태',
          currentFactor: 1.0,
          absoluteCurrent_uA: activeCurrent_mA * 1000,
          savingsPercent: 0,
          color: '#ef4444',
          wakeSources: '상시 동작'
        },
        {
          modeName: 'Idle 모드',
          korName: 'CPU 정지 / 4개 USART 유지',
          desc: 'CPU 정지, 4채널 통신 인터페이스는 수신 대기 상태 유지',
          currentFactor: 0.4,
          absoluteCurrent_uA: idle_uA,
          savingsPercent: 60,
          color: '#f97316',
          wakeSources: '모든 인터럽트 / USART0~3'
        },
        {
          modeName: 'ADC Noise Reduction',
          korName: 'ADC 200배 게인 노이즈 저감',
          desc: '16개 ADC 채널 차동 증폭 시 디지털 클럭 노이즈 억제',
          currentFactor: 0.09,
          absoluteCurrent_uA: adc_noise_uA,
          savingsPercent: 91,
          color: '#eab308',
          wakeSources: 'ADC 변환 인터럽트'
        },
        {
          modeName: 'Power-save 모드',
          korName: '절전 (RTC 타이머 유지)',
          desc: 'TOSC 크리스탈로 Timer2 비동기 계측 유지',
          currentFactor: 0.001,
          absoluteCurrent_uA: power_save_uA,
          savingsPercent: 99.9,
          color: '#06b6d4',
          wakeSources: 'Timer2 RTC 오버플로우'
        },
        {
          modeName: 'Power-down 모드',
          korName: '최대 절전 모드',
          desc: '최대 절전 상태 (외부 인터럽트 및 WDT로 복귀)',
          currentFactor: 0.0002,
          absoluteCurrent_uA: power_down_uA,
          savingsPercent: 99.98,
          color: '#10b981',
          wakeSources: '외부 인터럽트, 핀 체인지, WDT'
        }
      ];
    }
  };

  const sleepModes = getSleepModes(selectedMCU, voltage);
  const powerDownMode = sleepModes.find((m) => m.modeName.includes('Power-down')) || sleepModes[sleepModes.length - 1];

  // Weighted Average Current based on Active Duty Cycle
  // Average Current = (Active_Current * Duty) + (PowerDown_Current * (1 - Duty))
  const dutyFraction = dutyCycleActive / 100.0;
  const avgCurrent_mA =
    activeCurrent_mA * dutyFraction +
    (powerDownMode.absoluteCurrent_uA / 1000.0) * (1.0 - dutyFraction);

  // Battery life estimation
  const batteryLifeHours = batteryCapacity_mAh / Math.max(0.0001, avgCurrent_mA);
  const batteryLifeDays = batteryLifeHours / 24;
  const batteryLifeYears = batteryLifeDays / 365;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-lg space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>{currentProfile.name} Energy Estimator (소비 전력 & 배터리 수명 계산기)</span>
            </h3>
            <p className="text-xs text-slate-400">
              클럭 주파수와 동작 전압에 따른 동적 전류(mA)를 산출하고 슬립 모드별 절감율을 시각화합니다.
            </p>
          </div>
        </div>
        <span className="text-xs bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 font-mono text-cyan-400 font-bold">
          전력 모델: Microchip Silicon Curves
        </span>
      </div>

      {/* Interactive Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800/80">
        {/* Slider 1: Voltage */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <label className="text-slate-400 font-medium flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-amber-400" /> 동작 전압 (VCC)
            </label>
            <span className="font-mono font-bold text-amber-400 text-sm">{voltage.toFixed(1)} V</span>
          </div>
          <input
            type="range"
            min={minVoltage}
            max={maxVoltage}
            step={0.1}
            value={voltage}
            onChange={(e) => setVoltage(parseFloat(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>{minVoltage.toFixed(1)}V</span>
            <span>3.3V</span>
            <span>5.0V</span>
            <span>{maxVoltage.toFixed(1)}V</span>
          </div>
        </div>

        {/* Slider 2: Clock Frequency */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <label className="text-slate-400 font-medium flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" /> 클럭 주파수 (F_CPU)
            </label>
            <span className={`font-mono font-bold text-sm ${isOverclocked ? 'text-rose-400' : 'text-cyan-400'}`}>
              {freqMHz.toFixed(1)} MHz
            </span>
          </div>
          <input
            type="range"
            min={1.0}
            max={selectedMCU === 'atmega328p' ? 20.0 : 16.0}
            step={0.5}
            value={freqMHz}
            onChange={(e) => setFreqMHz(parseFloat(e.target.value))}
            className="w-full accent-cyan-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>1.0MHz</span>
            <span>8.0MHz</span>
            <span>16.0MHz</span>
            {selectedMCU === 'atmega328p' && <span>20.0MHz</span>}
          </div>
        </div>

        {/* Slider 3: Active Duty Cycle */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <label className="text-slate-400 font-medium flex items-center gap-1">
              <Moon className="w-3.5 h-3.5 text-emerald-400" /> 액티브 듀티비 (Active %)
            </label>
            <span className="font-mono font-bold text-emerald-400 text-sm">{dutyCycleActive}%</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={100}
            step={0.5}
            value={dutyCycleActive}
            onChange={(e) => setDutyCycleActive(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0.1% (초절전)</span>
            <span>10% (센서노드)</span>
            <span>100% (연속작동)</span>
          </div>
        </div>

        {/* Slider 4: Battery Capacity */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <label className="text-slate-400 font-medium flex items-center gap-1">
              <BatteryCharging className="w-3.5 h-3.5 text-indigo-400" /> 배터리 용량 (mAh)
            </label>
            <span className="font-mono font-bold text-indigo-400 text-sm">{batteryCapacity_mAh} mAh</span>
          </div>
          <input
            type="range"
            min={100}
            max={3000}
            step={50}
            value={batteryCapacity_mAh}
            onChange={(e) => setBatteryCapacity_mAh(parseInt(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>CR2032 (220)</span>
            <span>1,000 (LiPo)</span>
            <span>3,000 (18650)</span>
          </div>
        </div>
      </div>

      {/* Overclock Warning if any */}
      {isOverclocked && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <span className="font-bold">⚠️ 전압 곡선(SOA) 초과 경고:</span>
          <span>
            {voltage.toFixed(1)}V 전압에서 권장 최대 클럭은 {safeMaxFreq} MHz 이하입니다.
            현재 설정({freqMHz}MHz)은 플래시 변조 및 오동작을 일으킬 수 있습니다.
          </span>
        </div>
      )}

      {/* KPI Calculated Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <span className="text-slate-500 block text-[10px]">액티브 소비 전류 (Active)</span>
          <span className="font-mono text-xl font-bold text-rose-400">
            {activeCurrent_mA.toFixed(2)} <span className="text-xs font-normal text-slate-400">mA</span>
          </span>
          <span className="text-[10px] text-slate-500 block">소비전력: {activePower_mW.toFixed(1)} mW</span>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <span className="text-slate-500 block text-[10px]">Power-down 대기 전류</span>
          <span className="font-mono text-xl font-bold text-emerald-400">
            {powerDownMode.absoluteCurrent_uA < 1
              ? `${(powerDownMode.absoluteCurrent_uA * 1000).toFixed(0)} nA`
              : `${powerDownMode.absoluteCurrent_uA.toFixed(2)} µA`}
          </span>
          <span className="text-[10px] text-emerald-500 font-semibold block">99.9%+ 절감</span>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <span className="text-slate-500 block text-[10px]">듀티비 가중 평균 전류</span>
          <span className="font-mono text-xl font-bold text-amber-400">
            {avgCurrent_mA < 1 ? `${(avgCurrent_mA * 1000).toFixed(1)} µA` : `${avgCurrent_mA.toFixed(3)} mA`}
          </span>
          <span className="text-[10px] text-slate-500 block">Duty: {dutyCycleActive}% 기준</span>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <span className="text-slate-500 block text-[10px]">예상 배터리 가동 수명</span>
          <span className="font-mono text-xl font-bold text-cyan-400">
            {batteryLifeDays < 30
              ? `${batteryLifeDays.toFixed(1)} 일`
              : batteryLifeYears < 1.0
              ? `${(batteryLifeDays / 30.5).toFixed(1)} 개월`
              : `${batteryLifeYears.toFixed(1)} 년`}
          </span>
          <span className="text-[10px] text-slate-500 block font-mono">
            ({Math.round(batteryLifeHours).toLocaleString()} 시간)
          </span>
        </div>
      </div>

      {/* Comparative Sleep Mode Horizontal Bar Graph */}
      <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-white flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-emerald-400" /> 슬립 모드별 소비 전류 & 전력 절감율 비교 그래프
          </span>
          <span className="text-[10px] text-slate-500 font-mono">기준: Active {activeCurrent_mA.toFixed(2)} mA</span>
        </div>

        <div className="space-y-2.5">
          {sleepModes.map((mode, idx) => {
            const currentStr =
              mode.absoluteCurrent_uA >= 1000
                ? `${(mode.absoluteCurrent_uA / 1000).toFixed(2)} mA`
                : `${mode.absoluteCurrent_uA.toFixed(1)} µA`;

            // Bar length calculation (logarithmic or normalized for visual clarity)
            const barWidthPercent =
              idx === 0
                ? 100
                : idx === 1
                ? 40
                : idx === 2
                ? 15
                : idx === 3
                ? 5
                : 2;

            return (
              <div key={idx} className="space-y-1 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: mode.color }} />
                    <span className="font-mono text-white">{mode.modeName}</span>
                    <span className="text-[10px] text-slate-400 hidden sm:inline">({mode.korName})</span>
                  </span>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-slate-400 text-[11px]">복귀 소스: {mode.wakeSources}</span>
                    <span className="font-bold text-white text-xs">{currentStr}</span>
                    <span className="text-[11px] text-emerald-400 font-semibold w-14 text-right">
                      {mode.savingsPercent === 0 ? '기준' : `-${mode.savingsPercent}%`}
                    </span>
                  </div>
                </div>

                <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${barWidthPercent}%`,
                      backgroundColor: mode.color
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
