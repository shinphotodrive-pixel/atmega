import React, { useState, useMemo } from 'react';
import {
  Zap,
  Activity,
  Cpu,
  Battery,
  Sliders,
  Check,
  Copy,
  Info,
  AlertTriangle,
  Layers,
  Power,
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Moon,
  Clock,
  Radio,
  FileCode2,
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
}

// Peripheral module definition
interface PeripheralItem {
  id: string;
  name: string;
  category: 'ADC' | 'SPI' | 'UART' | 'Timer' | 'Other';
  description: string;
  prrBitName: string;
  prrReg: 'PRR' | 'PRR0' | 'PRR1';
  baseCurrent_mA: number; // typical at 5V, 16MHz
  scalingType: 'analog' | 'clock_scaled' | 'constant';
  applicableMCUs: SupportedMCU[];
}

const ALL_PERIPHERALS: PeripheralItem[] = [
  // ADC
  {
    id: 'adc',
    name: '10-bit ADC (아날로그 변환기)',
    category: 'ADC',
    description: 'Bandgap 기준전압 회로, 샘플앤홀드 증폭기 및 SAR ADC 코어',
    prrBitName: 'PRADC',
    prrReg: 'PRR',
    baseCurrent_mA: 0.28,
    scalingType: 'analog',
    applicableMCUs: ['atmega328p', 'atmega128', 'atmega640'],
  },
  // SPI
  {
    id: 'spi',
    name: 'SPI 버스 컨트롤러',
    category: 'SPI',
    description: '고속 직렬 동기 통신 모듈 (SCK, MOSI, MISO, SS 클럭 생성기)',
    prrBitName: 'PRSPI',
    prrReg: 'PRR',
    baseCurrent_mA: 0.16,
    scalingType: 'clock_scaled',
    applicableMCUs: ['atmega328p', 'atmega128', 'atmega640'],
  },
  // UART / USART
  {
    id: 'usart0',
    name: 'USART0 (직렬 통신 포트 0)',
    category: 'UART',
    description: '비동기/동기 시리얼 통신 송수신기 및 보레이트 생성기',
    prrBitName: 'PRUSART0',
    prrReg: 'PRR',
    baseCurrent_mA: 0.20,
    scalingType: 'clock_scaled',
    applicableMCUs: ['atmega328p', 'atmega128', 'atmega640'],
  },
  {
    id: 'usart1',
    name: 'USART1 (직렬 통신 포트 1)',
    category: 'UART',
    description: '보조 고속 USART 하드웨어 트랜시버',
    prrBitName: 'PRUSART1',
    prrReg: 'PRR1',
    baseCurrent_mA: 0.20,
    scalingType: 'clock_scaled',
    applicableMCUs: ['atmega128', 'atmega640'],
  },
  {
    id: 'usart2',
    name: 'USART2 (직렬 통신 포트 2)',
    category: 'UART',
    description: 'ATmega640 4ch USART 중 3번째 하드웨어 포트',
    prrBitName: 'PRUSART2',
    prrReg: 'PRR1',
    baseCurrent_mA: 0.19,
    scalingType: 'clock_scaled',
    applicableMCUs: ['atmega640'],
  },
  // Timers
  {
    id: 'timer0',
    name: 'Timer/Counter0 (8-bit 기본)',
    category: 'Timer',
    description: '8비트 타이머, 밀리초 millis() 생성 및 8비트 PWM',
    prrBitName: 'PRTIM0',
    prrReg: 'PRR',
    baseCurrent_mA: 0.12,
    scalingType: 'clock_scaled',
    applicableMCUs: ['atmega328p', 'atmega128', 'atmega640'],
  },
  {
    id: 'timer1',
    name: 'Timer/Counter1 (16-bit 정밀)',
    category: 'Timer',
    description: '16비트 고정밀 타이머, 입력 캡처 및 16비트 Phase-Correct PWM',
    prrBitName: 'PRTIM1',
    prrReg: 'PRR',
    baseCurrent_mA: 0.15,
    scalingType: 'clock_scaled',
    applicableMCUs: ['atmega328p', 'atmega128', 'atmega640'],
  },
  {
    id: 'timer2',
    name: 'Timer/Counter2 (8-bit 비동기 RTC)',
    category: 'Timer',
    description: 'TOSC1/2 32.768kHz 비동기 크리스탈 구동 가능한 8비트 타이머',
    prrBitName: 'PRTIM2',
    prrReg: 'PRR',
    baseCurrent_mA: 0.14,
    scalingType: 'clock_scaled',
    applicableMCUs: ['atmega328p', 'atmega128', 'atmega640'],
  },
  {
    id: 'timer3',
    name: 'Timer/Counter3 (16-bit 확장)',
    category: 'Timer',
    description: '16비트 추가 범용 타이머/카운터',
    prrBitName: 'PRTIM3',
    prrReg: 'PRR1',
    baseCurrent_mA: 0.15,
    scalingType: 'clock_scaled',
    applicableMCUs: ['atmega128', 'atmega640'],
  },
  // Other peripherals
  {
    id: 'twi',
    name: 'TWI / I2C 버스 인터페이스',
    category: 'Other',
    description: '2-Wire Serial I2C 통신 모듈 및 주소 매칭 로직',
    prrBitName: 'PRTWI',
    prrReg: 'PRR',
    baseCurrent_mA: 0.13,
    scalingType: 'clock_scaled',
    applicableMCUs: ['atmega328p', 'atmega128', 'atmega640'],
  },
];

export const DynamicPowerConsumptionEstimator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Default voltage based on MCU
  const defaultVoltage = selectedMCU === 'atmega128' ? 5.0 : 3.3;

  // 1. Inputs: Frequency, Voltage, Selected Peripherals
  const [clockFreqMHz, setClockFreqMHz] = useState<number>(16.0);
  const [voltage, setVoltage] = useState<number>(defaultVoltage);
  const [temperature, setTemperature] = useState<'25C' | '85C'>('25C');
  const [wdtEnabled, setWdtEnabled] = useState<boolean>(false);
  const [bodEnabled, setBodEnabled] = useState<boolean>(true);

  // Enabled peripherals
  const [enabledPeripherals, setEnabledPeripherals] = useState<Record<string, boolean>>({
    adc: true,
    spi: true,
    usart0: true,
    timer0: true,
    timer1: false,
    timer2: false,
    timer3: false,
    usart1: false,
    usart2: false,
    twi: false,
  });

  // Battery and duty cycle modeling
  const [dutyCycleActive, setDutyCycleActive] = useState<number>(5); // 5% Active, 95% Sleep
  const [batteryCapMah, setBatteryCapMah] = useState<number>(1000);
  const [selectedBatteryType, setSelectedBatteryType] = useState<string>('custom');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Filter available peripherals for the selected MCU
  const availablePeripherals = useMemo(() => {
    return ALL_PERIPHERALS.filter((p) => p.applicableMCUs.includes(selectedMCU));
  }, [selectedMCU]);

  // Safe operating area frequency check
  const minSafeVoltage = selectedMCU === 'atmega128' ? 2.7 : 1.8;
  const maxSafeFreq = useMemo(() => {
    if (voltage < 2.7) return 4.0;
    if (voltage < 4.5) return 8.0;
    if (selectedMCU === 'atmega328p') return 20.0;
    return 16.0;
  }, [voltage, selectedMCU]);

  const isOverclocked = clockFreqMHz > maxSafeFreq;
  const isUnderVoltage = voltage < minSafeVoltage;

  // Toggle peripheral
  const togglePeripheral = (id: string) => {
    setEnabledPeripherals((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const selectAllPeripherals = (enabled: boolean) => {
    const updated: Record<string, boolean> = {};
    availablePeripherals.forEach((p) => {
      updated[p.id] = enabled;
    });
    setEnabledPeripherals(updated);
  };

  // 2. MCU Specific Datasheet Current Profiles & Scaling
  // Active Core Consumption: I_core = (f * k_freq + I_static) * (V/5)^voltage_exp
  const calculations = useMemo(() => {
    let k_freq = 0.52; // mA/MHz @ 5V
    let i_static = 0.5; // quiescent core mA
    let v_exp = 1.35;
    let mcuProcessFactor = 1.0;

    if (selectedMCU === 'atmega328p') {
      k_freq = 0.40; // PicoPower 0.13um
      i_static = 0.25;
      v_exp = 1.25;
      mcuProcessFactor = 0.85;
    } else if (selectedMCU === 'atmega128') {
      k_freq = 0.88; // 0.35um standard CMOS
      i_static = 1.6;
      v_exp = 1.45;
      mcuProcessFactor = 1.45;
    } else {
      // atmega640
      k_freq = 0.58;
      i_static = 0.75;
      v_exp = 1.32;
      mcuProcessFactor = 1.05;
    }

    const voltageScaling = Math.pow(voltage / 5.0, v_exp);

    // Baseline CPU Core Active Current (Core + Flash Memory + Internal Buses)
    const cpuCoreCurrent_mA = (clockFreqMHz * k_freq + i_static) * voltageScaling;

    // Peripherals Active Current Calculations
    let totalPeripheralsCurrent_mA = 0;
    let totalPeripheralsMaxPotential_mA = 0;
    const peripheralBreakdown: { item: PeripheralItem; current_mA: number; isEnabled: boolean }[] = [];

    availablePeripherals.forEach((p) => {
      const isEnabled = !!enabledPeripherals[p.id];
      let itemCurrent = 0;

      if (p.scalingType === 'analog') {
        // Analog blocks (like ADC Bandgap/SampleHold) scale with voltage
        itemCurrent = p.baseCurrent_mA * Math.pow(voltage / 5.0, 1.2) * mcuProcessFactor;
      } else if (p.scalingType === 'clock_scaled') {
        // Clocked blocks scale with frequency & voltage (dynamic CMOS: C * V^2 * f)
        const freqRatio = Math.max(0.1, clockFreqMHz / 16.0);
        itemCurrent = p.baseCurrent_mA * freqRatio * voltageScaling * mcuProcessFactor;
      } else {
        itemCurrent = p.baseCurrent_mA * (voltage / 5.0) * mcuProcessFactor;
      }

      totalPeripheralsMaxPotential_mA += itemCurrent;
      if (isEnabled) {
        totalPeripheralsCurrent_mA += itemCurrent;
      }

      peripheralBreakdown.push({
        item: p,
        current_mA: itemCurrent,
        isEnabled,
      });
    });

    // Optional Static Blocks: WDT & BOD
    const wdtCurrent_uA = wdtEnabled ? (selectedMCU === 'atmega328p' ? 4.2 : 8.0) * (voltage / 3.3) : 0;
    const bodCurrent_uA = bodEnabled ? (selectedMCU === 'atmega328p' ? 18.0 : 25.0) * (voltage / 3.3) : 0;
    const staticBlocks_mA = (wdtCurrent_uA + bodCurrent_uA) / 1000;

    // Total Active Current
    const totalActiveCurrent_mA = cpuCoreCurrent_mA + totalPeripheralsCurrent_mA + staticBlocks_mA;
    const totalActivePower_mW = totalActiveCurrent_mA * voltage;

    // Potential savings from disabled peripherals (Power Reduction Register clock gating)
    const prrSavings_mA = totalPeripheralsMaxPotential_mA - totalPeripheralsCurrent_mA;
    const prrSavingsPercent =
      totalPeripheralsMaxPotential_mA > 0
        ? Math.round((prrSavings_mA / (cpuCoreCurrent_mA + totalPeripheralsMaxPotential_mA + staticBlocks_mA)) * 100)
        : 0;

    // 3. Standby & Sleep Current Profiles based on Datasheet Tables
    const tempLeakageFactor = temperature === '85C' ? 6.5 : 1.0;
    const vFactor = Math.pow(voltage / 3.3, 1.2);

    let basePowerDown_uA = 0.2;
    let basePowerSave_uA = 1.2;
    let baseStandby_uA = 0.9;
    let idleCoreRatio = 0.32;

    if (selectedMCU === 'atmega328p') {
      basePowerDown_uA = 0.15;
      basePowerSave_uA = 1.1;
      baseStandby_uA = 0.8;
      idleCoreRatio = 0.30;
    } else if (selectedMCU === 'atmega128') {
      basePowerDown_uA = 4.2;
      basePowerSave_uA = 11.0;
      baseStandby_uA = 9.5;
      idleCoreRatio = 0.45;
    } else {
      // atmega640
      basePowerDown_uA = 0.5;
      basePowerSave_uA = 2.0;
      baseStandby_uA = 1.8;
      idleCoreRatio = 0.35;
    }

    const sleepProfiles = [
      {
        id: 'active',
        name: 'Active (완전 동작 모드)',
        desc: 'CPU 코어 및 선택된 주변장치 전체 클럭 구동',
        current_mA: totalActiveCurrent_mA,
        current_uA: totalActiveCurrent_mA * 1000,
        badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
        barColor: 'bg-rose-500',
        ratio: 1.0,
      },
      {
        id: 'idle',
        name: 'Idle 모드 (CPU 정지)',
        desc: 'CPU 코어 클럭 차단, 선택된 주변장치는 동작 지속',
        current_mA: (cpuCoreCurrent_mA * idleCoreRatio) + totalPeripheralsCurrent_mA + staticBlocks_mA,
        current_uA: ((cpuCoreCurrent_mA * idleCoreRatio) + totalPeripheralsCurrent_mA + staticBlocks_mA) * 1000,
        badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
        barColor: 'bg-amber-500',
        ratio: ((cpuCoreCurrent_mA * idleCoreRatio) + totalPeripheralsCurrent_mA + staticBlocks_mA) / totalActiveCurrent_mA,
      },
      {
        id: 'adc_noise_reduction',
        name: 'ADC Noise Reduction',
        desc: 'CPU 및 I/O 클럭 정지, ADC 및 타이머2만 구동',
        current_mA: ((enabledPeripherals['adc'] ? 0.22 : 0.02) * voltageScaling) + staticBlocks_mA + (basePowerSave_uA * vFactor * tempLeakageFactor / 1000),
        current_uA: (((enabledPeripherals['adc'] ? 0.22 : 0.02) * voltageScaling) + staticBlocks_mA + (basePowerSave_uA * vFactor * tempLeakageFactor / 1000)) * 1000,
        badgeColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
        barColor: 'bg-yellow-500',
        ratio: 0.1,
      },
      {
        id: 'power_save',
        name: 'Power-save (RTC 유지)',
        desc: '32.768kHz 저주파 크리스탈로 Timer2 비동기 RTC만 유지',
        current_mA: (basePowerSave_uA * vFactor * tempLeakageFactor + wdtCurrent_uA + bodCurrent_uA) / 1000,
        current_uA: basePowerSave_uA * vFactor * tempLeakageFactor + wdtCurrent_uA + bodCurrent_uA,
        badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
        barColor: 'bg-cyan-500',
        ratio: 0.002,
      },
      {
        id: 'standby',
        name: 'Standby 모드',
        desc: '메인 크리스탈 오실레이터 유지, 6사이클 초고속 기상',
        current_mA: (baseStandby_uA * vFactor * tempLeakageFactor + (clockFreqMHz * 0.015) + wdtCurrent_uA + bodCurrent_uA) / 1000,
        current_uA: (baseStandby_uA * vFactor * tempLeakageFactor + (clockFreqMHz * 0.015) + wdtCurrent_uA + bodCurrent_uA) * 1000,
        badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40',
        barColor: 'bg-indigo-500',
        ratio: 0.01,
      },
      {
        id: 'power_down',
        name: 'Power-down (최대 절전)',
        desc: '모든 오실레이터 정지, SRAM 데이터만 보존 (초저전력 대기)',
        current_mA: (basePowerDown_uA * vFactor * tempLeakageFactor + wdtCurrent_uA + bodCurrent_uA) / 1000,
        current_uA: basePowerDown_uA * vFactor * tempLeakageFactor + wdtCurrent_uA + bodCurrent_uA,
        badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        barColor: 'bg-emerald-500',
        ratio: (basePowerDown_uA * vFactor * tempLeakageFactor + wdtCurrent_uA + bodCurrent_uA) / 1000 / totalActiveCurrent_mA,
      },
    ];

    // Average current & Battery runtime modeling
    const activeFraction = dutyCycleActive / 100;
    const sleepFraction = 1 - activeFraction;
    const powerDownCurrent_mA = sleepProfiles.find((p) => p.id === 'power_down')!.current_mA;
    const averageCurrent_mA = (totalActiveCurrent_mA * activeFraction) + (powerDownCurrent_mA * sleepFraction);

    const runtimeHours = averageCurrent_mA > 0 ? batteryCapMah / averageCurrent_mA : 0;
    const runtimeDays = runtimeHours / 24;
    const runtimeYears = runtimeDays / 365.25;

    return {
      cpuCoreCurrent_mA,
      totalPeripheralsCurrent_mA,
      staticBlocks_mA,
      wdtCurrent_uA,
      bodCurrent_uA,
      totalActiveCurrent_mA,
      totalActivePower_mW,
      prrSavings_mA,
      prrSavingsPercent,
      peripheralBreakdown,
      sleepProfiles,
      averageCurrent_mA,
      runtimeHours,
      runtimeDays,
      runtimeYears,
    };
  }, [
    selectedMCU,
    clockFreqMHz,
    voltage,
    temperature,
    wdtEnabled,
    bodEnabled,
    enabledPeripherals,
    availablePeripherals,
    dutyCycleActive,
    batteryCapMah,
  ]);

  // Generate bare-metal PRR (Power Reduction Register) C code
  const generatedPrrCode = useMemo(() => {
    const disabledItems = calculations.peripheralBreakdown.filter((p) => !p.isEnabled);
    const prr0Bits = disabledItems.filter((p) => p.item.prrReg === 'PRR' || p.item.prrReg === 'PRR0').map((p) => `(1 << ${p.item.prrBitName})`);
    const prr1Bits = disabledItems.filter((p) => p.item.prrReg === 'PRR1').map((p) => `(1 << ${p.item.prrBitName})`);

    const lines: string[] = [
      `// ===============================================================`,
      `// [${currentProfile.name}] 동적 절전 파워 게이팅 (PRR 설정) C 코드`,
      `// 시스템 클럭: ${clockFreqMHz} MHz | 동작 전압: ${voltage.toFixed(1)} V`,
      `// 예상 소모 전류: Active ${calculations.totalActiveCurrent_mA.toFixed(2)} mA (절감: -${calculations.prrSavings_mA.toFixed(2)} mA)`,
      `// ===============================================================`,
      `#include <avr/io.h>`,
      `#include <avr/power.h>`,
      `#include <avr/sleep.h>`,
      ``,
      `void setup_low_power_peripherals(void) {`,
    ];

    if (selectedMCU === 'atmega128') {
      lines.push(`    // ATmega128A는 하드웨어 레지스터 직접 비트맵핑 또는 전원 관리 레지스터를 사용합니다.`);
      if (!enabledPeripherals['adc']) {
        lines.push(`    ADCSRA &= ~(1 << ADEN); // ADC 비활성화 (약 0.3~0.5mA 절감)`);
      }
      if (!enabledPeripherals['usart0']) {
        lines.push(`    UCSR0B &= ~((1 << RXEN0) | (1 << TXEN0)); // USART0 클럭 차단`);
      }
      if (!enabledPeripherals['usart1']) {
        lines.push(`    UCSR1B &= ~((1 << RXEN1) | (1 << TXEN1)); // USART1 클럭 차단`);
      }
      if (!enabledPeripherals['spi']) {
        lines.push(`    SPCR &= ~(1 << SPE); // SPI 모듈 차단`);
      }
    } else {
      // ATmega328P or ATmega640 with PRR/PRR0/PRR1
      const prrName = selectedMCU === 'atmega640' ? 'PRR0' : 'PRR';
      if (prr0Bits.length > 0) {
        lines.push(`    // 사용하지 않는 페리페럴 내부 클럭 분배 차단 (${prrName})`);
        lines.push(`    ${prrName} |= ${prr0Bits.join(' | ')};`);
      } else {
        lines.push(`    // 모든 ${prrName} 페리페럴이 활성화됨`);
      }

      if (selectedMCU === 'atmega640' && prr1Bits.length > 0) {
        lines.push(`    // 확장 페리페럴 클럭 차단 (PRR1)`);
        lines.push(`    PRR1 |= ${prr1Bits.join(' | ')};`);
      }

      if (!enabledPeripherals['adc']) {
        lines.push(``);
        lines.push(`    // ADC 전력 절감: ADEN 비트 클리어 선행 필요`);
        lines.push(`    ADCSRA &= ~(1 << ADEN);`);
      }
    }

    if (!bodEnabled) {
      lines.push(``);
      lines.push(`    // 슬립 직전 BOD 차단 (PicoPower MCU 지원: sleep_bod_disable 매크로)`);
      lines.push(`    // MCUCR |= (1 << BODS) | (1 << BODSE);`);
      lines.push(`    // MCUCR = (MCUCR & ~(1 << BODSE)) | (1 << BODS);`);
    }

    lines.push(`}`);
    return lines.join('\n');
  }, [calculations, currentProfile.name, clockFreqMHz, voltage, selectedMCU, enabledPeripherals, bodEnabled]);

  const copyCode = () => {
    navigator.clipboard.writeText(generatedPrrCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Battery Presets handler
  const handleBatterySelect = (type: string) => {
    setSelectedBatteryType(type);
    if (type === 'cr2032') {
      setBatteryCapMah(220);
      setVoltage(3.0);
    } else if (type === '2aaa') {
      setBatteryCapMah(1000);
      setVoltage(3.0);
    } else if (type === 'li-ion') {
      setBatteryCapMah(2600);
      setVoltage(3.7);
    } else if (type === 'usb5v') {
      setBatteryCapMah(5000);
      setVoltage(5.0);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
            <Zap className="w-3.5 h-3.5" /> Dynamic Power Consumption Estimator
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            동적 소비 전류 & 전력 프로파일 예측기
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-300 font-mono font-normal">
              {currentProfile.name}
            </span>
          </h2>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            클럭 주파수, 공급 전압, 개별 페리페럴 모듈(ADC, SPI, UART, Timer) 선택에 따른 활성(Active) 및 대기(Standby) 상태의 총 mA 전류를 마이크로칩 공식 데이터시트 프로파일 기반으로 실시간 계산합니다.
          </p>
        </div>

        {/* Quick Summary Pill */}
        <div className="flex items-center gap-3 bg-slate-950 px-4 py-3 rounded-xl border border-slate-800 self-start md:self-auto">
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block font-mono">예상 총 활성 전류</span>
            <span className="text-xl font-extrabold text-amber-400 font-mono">
              {calculations.totalActiveCurrent_mA.toFixed(2)}{' '}
              <span className="text-xs font-normal text-slate-400">mA</span>
            </span>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block font-mono">소비 전력 (P=V×I)</span>
            <span className="text-xl font-extrabold text-emerald-400 font-mono">
              {calculations.totalActivePower_mW.toFixed(1)}{' '}
              <span className="text-xs font-normal text-slate-400">mW</span>
            </span>
          </div>
        </div>
      </div>

      {/* Safety / Overclock Warning */}
      {isOverclocked && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <strong>안전 동작 영역(SOA) 경고:</strong> 현재 인가 전압 <strong>{voltage.toFixed(1)}V</strong>에서 {currentProfile.name}의 공식 보증 최대 클럭은 <strong>{maxSafeFreq} MHz</strong>입니다. ({clockFreqMHz} MHz는 오버클럭 상태이며 데이터 손상 위험이 있습니다)
          </div>
        </div>
      )}

      {isUnderVoltage && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <strong>최저 구동 전압 미달 경고:</strong> {currentProfile.name}의 데이터시트 정격 최저 구동 전압은 <strong>{minSafeVoltage}V</strong>입니다.
          </div>
        </div>
      )}

      {/* Primary Input Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Input 1: Clock Frequency */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              시스템 클럭 주파수 (F_CPU)
            </label>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {clockFreqMHz} MHz
            </span>
          </div>

          <input
            type="range"
            min="0.5"
            max={selectedMCU === 'atmega328p' ? 20 : 16}
            step="0.5"
            value={clockFreqMHz}
            onChange={(e) => setClockFreqMHz(parseFloat(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />

          <div className="flex flex-wrap gap-1.5 pt-1">
            {[1, 4, 8, 12, 16, ...(selectedMCU === 'atmega328p' ? [20] : [])].map((f) => (
              <button
                key={f}
                onClick={() => setClockFreqMHz(f)}
                className={`text-[10px] px-2 py-1 rounded-md font-mono transition border ${
                  clockFreqMHz === f
                    ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {f}MHz
              </button>
            ))}
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            동적 CMOS 소비 전류는 주파수($f$)에 비례하여 선형적으로 증가합니다 ($I = C \cdot V^2 \cdot f$).
          </p>
        </div>

        {/* Input 2: Operating Voltage */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-400" />
              동작 공급 전압 (VCC)
            </label>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {voltage.toFixed(1)} V
            </span>
          </div>

          <input
            type="range"
            min={minSafeVoltage}
            max="5.5"
            step="0.1"
            value={voltage}
            onChange={(e) => setVoltage(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />

          <div className="flex flex-wrap gap-1.5 pt-1">
            {[...(selectedMCU !== 'atmega128' ? [1.8] : []), 2.7, 3.3, 5.0].map((v) => (
              <button
                key={v}
                onClick={() => setVoltage(v)}
                className={`text-[10px] px-2 py-1 rounded-md font-mono transition border ${
                  Math.abs(voltage - v) < 0.05
                    ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {v}V
              </button>
            ))}
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            공급 전압을 5V에서 3.3V로 낮추면 동적 전력 손실($V^2$)이 56% 이상 획기적으로 절감됩니다.
          </p>
        </div>

        {/* Input 3: Environment & Static Blocks */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-cyan-400" />
              동작 환경 및 감시 모듈
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {/* Temp toggle */}
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">동작 온도 (누설전류 영향)</span>
              <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                <button
                  onClick={() => setTemperature('25C')}
                  className={`flex-1 py-1 text-[11px] font-mono rounded font-medium transition ${
                    temperature === '25C' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
                  }`}
                >
                  25°C 상온
                </button>
                <button
                  onClick={() => setTemperature('85C')}
                  className={`flex-1 py-1 text-[11px] font-mono rounded font-medium transition ${
                    temperature === '85C' ? 'bg-rose-500 text-slate-950 font-bold' : 'text-slate-400'
                  }`}
                >
                  85°C 산업
                </button>
              </div>
            </div>

            {/* WDT & BOD */}
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  checked={wdtEnabled}
                  onChange={(e) => setWdtEnabled(e.target.checked)}
                  className="rounded accent-cyan-500 w-3.5 h-3.5"
                />
                <span>WDT 오실레이터 활성</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  checked={bodEnabled}
                  onChange={(e) => setBodEnabled(e.target.checked)}
                  className="rounded accent-cyan-500 w-3.5 h-3.5"
                />
                <span>BOD 저전압 감시 활성</span>
              </label>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-900 flex justify-between">
            <span>WDT: +{(calculations.wdtCurrent_uA).toFixed(1)} µA</span>
            <span>BOD: +{(calculations.bodCurrent_uA).toFixed(1)} µA</span>
          </div>
        </div>
      </div>

      {/* Peripheral Selection Matrix */}
      <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              동작 페리페럴 모듈 선택 (Peripheral Power Gating Matrix)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              사용 중인 모듈을 체크하세요. 체크 해제된 모듈은 파워 리덕션 레지스터(PRR) 클럭 게이팅을 통해 전류가 차단됩니다.
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => selectAllPeripherals(true)}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition text-[11px]"
            >
              전체 활성화
            </button>
            <button
              onClick={() => selectAllPeripherals(false)}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition text-[11px]"
            >
              전체 차단 (초저전력)
            </button>
          </div>
        </div>

        {/* Peripheral Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {calculations.peripheralBreakdown.map(({ item, current_mA, isEnabled }) => {
            const categoryColors: Record<string, string> = {
              ADC: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
              SPI: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
              UART: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
              Timer: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
              Other: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
            };

            return (
              <div
                key={item.id}
                onClick={() => togglePeripheral(item.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                  isEnabled
                    ? 'bg-slate-900/90 border-amber-500/40 shadow-sm shadow-amber-500/10'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-60 hover:opacity-90'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold border ${categoryColors[item.category] || 'text-slate-300'}`}>
                      {item.category}
                    </span>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => {}} // handled by parent div
                      className="rounded accent-amber-500 w-4 h-4 cursor-pointer pointer-events-none"
                    />
                  </div>
                  <h4 className="text-xs font-bold text-white leading-tight">{item.name}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-2 mt-2 border-t border-slate-800/70 flex items-center justify-between text-xs font-mono">
                  <span className="text-[10px] text-slate-500">
                    PRR: {item.prrBitName}
                  </span>
                  <span className={`font-bold ${isEnabled ? 'text-amber-400' : 'text-slate-500 line-through'}`}>
                    +{current_mA.toFixed(3)} mA
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* PRR Savings Banner */}
        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <TrendingDown className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              선택 해제된 모듈의 클럭 차단(Clock Gating)을 통해{' '}
              <strong className="text-emerald-400 font-mono">-{calculations.prrSavings_mA.toFixed(3)} mA</strong> 절감 중
              ({calculations.prrSavingsPercent}% 총 전력 절감 기여)
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            선택된 페리페럴 합계: <strong className="text-white">+{calculations.totalPeripheralsCurrent_mA.toFixed(3)} mA</strong>
          </div>
        </div>
      </div>

      {/* Consumption Breakdown: Visual Stack & Breakdown Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Stacked Bar & Current Allocation */}
        <div className="lg:col-span-6 bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            활성 모드 전류 분배 다이어그램 (Active Current Stack)
          </h3>

          {/* Visual Stack Bar */}
          <div className="space-y-1.5">
            <div className="h-6 w-full bg-slate-900 rounded-lg overflow-hidden flex border border-slate-800">
              {/* CPU Core */}
              <div
                style={{ width: `${(calculations.cpuCoreCurrent_mA / calculations.totalActiveCurrent_mA) * 100}%` }}
                className="bg-indigo-500 h-full relative group transition-all"
                title={`CPU Core: ${calculations.cpuCoreCurrent_mA.toFixed(2)} mA`}
              />
              {/* ADC */}
              {calculations.peripheralBreakdown.find((p) => p.item.id === 'adc')?.isEnabled && (
                <div
                  style={{
                    width: `${((calculations.peripheralBreakdown.find((p) => p.item.id === 'adc')?.current_mA || 0) / calculations.totalActiveCurrent_mA) * 100}%`,
                  }}
                  className="bg-rose-500 h-full relative group transition-all"
                  title="ADC Block"
                />
              )}
              {/* SPI */}
              {calculations.peripheralBreakdown.find((p) => p.item.id === 'spi')?.isEnabled && (
                <div
                  style={{
                    width: `${((calculations.peripheralBreakdown.find((p) => p.item.id === 'spi')?.current_mA || 0) / calculations.totalActiveCurrent_mA) * 100}%`,
                  }}
                  className="bg-cyan-500 h-full relative group transition-all"
                  title="SPI Bus"
                />
              )}
              {/* USARTs */}
              <div
                style={{
                  width: `${
                    (calculations.peripheralBreakdown
                      .filter((p) => p.item.category === 'UART' && p.isEnabled)
                      .reduce((sum, p) => sum + p.current_mA, 0) /
                      calculations.totalActiveCurrent_mA) *
                    100
                  }%`,
                }}
                className="bg-amber-500 h-full relative group transition-all"
                title="UART Modules"
              />
              {/* Timers */}
              <div
                style={{
                  width: `${
                    (calculations.peripheralBreakdown
                      .filter((p) => p.item.category === 'Timer' && p.isEnabled)
                      .reduce((sum, p) => sum + p.current_mA, 0) /
                      calculations.totalActiveCurrent_mA) *
                    100
                  }%`,
                }}
                className="bg-emerald-500 h-full relative group transition-all"
                title="Timers"
              />
              {/* Static Blocks */}
              <div
                style={{ width: `${(calculations.staticBlocks_mA / calculations.totalActiveCurrent_mA) * 100}%` }}
                className="bg-purple-500 h-full relative group transition-all"
                title="WDT & BOD"
              />
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-[11px] pt-1">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded bg-indigo-500 inline-block" /> CPU 코어 & 버스
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" /> ADC 아날로그
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded bg-cyan-500 inline-block" /> SPI 컨트롤러
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" /> USART 모듈
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> 타이머 카운터
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded bg-purple-500 inline-block" /> WDT / BOD
              </span>
            </div>
          </div>

          {/* Allocation Table */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-300 font-medium">CPU 코어 및 플래시 메모리 구동 전류:</span>
              <span className="font-mono font-bold text-indigo-400">
                {calculations.cpuCoreCurrent_mA.toFixed(3)} mA ({((calculations.cpuCoreCurrent_mA / calculations.totalActiveCurrent_mA) * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-300 font-medium">선택된 활성 페리페럴 총 전류:</span>
              <span className="font-mono font-bold text-amber-400">
                {calculations.totalPeripheralsCurrent_mA.toFixed(3)} mA ({((calculations.totalPeripheralsCurrent_mA / calculations.totalActiveCurrent_mA) * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-300 font-medium">상시 감시 회로 (WDT + BOD):</span>
              <span className="font-mono font-bold text-purple-400">
                {calculations.staticBlocks_mA.toFixed(3)} mA ({((calculations.staticBlocks_mA / calculations.totalActiveCurrent_mA) * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="flex justify-between items-center text-xs p-3 rounded-lg bg-slate-900 border border-amber-500/30">
              <span className="text-white font-bold">최종 활성 모드 총 소모 전류:</span>
              <span className="font-mono font-extrabold text-amber-400 text-sm">
                {calculations.totalActiveCurrent_mA.toFixed(3)} mA
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Standby & Sleep Mode Current Profiles */}
        <div className="lg:col-span-6 bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Moon className="w-4 h-4 text-cyan-400" />
              데이터시트 슬립 & 대기 모드별 소비 전류 프로파일
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              {temperature} • {voltage.toFixed(1)}V
            </span>
          </div>

          <div className="space-y-2.5">
            {calculations.sleepProfiles.map((profile) => {
              const isMicroAmps = profile.current_uA < 1000;
              const formattedCurrent = isMicroAmps
                ? `${profile.current_uA.toFixed(2)} µA`
                : `${profile.current_mA.toFixed(2)} mA`;

              const power_uW = (profile.current_uA * voltage).toFixed(1);

              return (
                <div
                  key={profile.id}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${profile.barColor}`} />
                      {profile.name}
                    </span>
                    <div className="text-right">
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${profile.badgeColor}`}>
                        {formattedCurrent}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="line-clamp-1">{profile.desc}</span>
                    <span className="font-mono text-slate-500 shrink-0">
                      {power_uW} µW
                    </span>
                  </div>

                  {/* Micro Visual Bar */}
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${profile.barColor}`}
                      style={{
                        width: `${Math.max(1, Math.min(100, (profile.current_mA / calculations.totalActiveCurrent_mA) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Battery Life Estimator & Duty Cycle Calculator */}
      <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Battery className="w-4 h-4 text-emerald-400" />
            배터리 수명 및 듀티 사이클(Duty Cycle) 기반 평균 전력 예측
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            Active {dutyCycleActive}% + Power-down {(100 - dutyCycleActive)}%
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Battery preset & capacity */}
          <div className="space-y-2">
            <label className="text-xs text-slate-300 block font-medium">전원원 및 배터리 용량</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'cr2032', label: 'CR2032 (220mAh, 3V)' },
                { id: '2aaa', label: '2x AAA (1000mAh, 3V)' },
                { id: 'li-ion', label: '18650 Li-ion (2600mAh)' },
                { id: 'usb5v', label: '보조배터리 (5000mAh)' },
              ].map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleBatterySelect(b.id)}
                  className={`text-[11px] p-2 rounded-lg text-left border transition ${
                    selectedBatteryType === b.id
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="pt-2">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>직접 용량 지정:</span>
                <span className="font-mono text-emerald-400 font-bold">{batteryCapMah} mAh</span>
              </div>
              <input
                type="number"
                min="10"
                max="50000"
                step="50"
                value={batteryCapMah}
                onChange={(e) => {
                  setSelectedBatteryType('custom');
                  setBatteryCapMah(Math.max(1, parseInt(e.target.value) || 1));
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          {/* Duty Cycle Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium">활성(Active) 모드 체류 비율</span>
              <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {dutyCycleActive}%
              </span>
            </div>

            <input
              type="range"
              min="0.1"
              max="100"
              step="0.1"
              value={dutyCycleActive}
              onChange={(e) => setDutyCycleActive(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />

            <div className="flex justify-between text-[11px] text-slate-500">
              <span>0.1% (센서 노드 극한 절전)</span>
              <span>10% (주기적 통신)</span>
              <span>100% (상시 구동)</span>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>시간당 활성 시간:</span>
                <span className="font-mono text-white font-bold">{(dutyCycleActive * 36).toFixed(1)} 초/시간</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>평균 실효 소모 전류:</span>
                <span className="font-mono text-amber-400 font-bold">
                  {calculations.averageCurrent_mA < 1
                    ? `${(calculations.averageCurrent_mA * 1000).toFixed(1)} µA`
                    : `${calculations.averageCurrent_mA.toFixed(3)} mA`}
                </span>
              </div>
            </div>
          </div>

          {/* Estimated Runtime Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                예상 배터리 연속 구동 시간
              </span>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {calculations.runtimeYears >= 1 ? (
                  <>
                    약 {calculations.runtimeYears.toFixed(1)}{' '}
                    <span className="text-sm font-normal text-slate-400">년 ({Math.round(calculations.runtimeDays)} 일)</span>
                  </>
                ) : calculations.runtimeDays >= 1 ? (
                  <>
                    약 {calculations.runtimeDays.toFixed(1)}{' '}
                    <span className="text-sm font-normal text-slate-400">일 ({Math.round(calculations.runtimeHours)} 시간)</span>
                  </>
                ) : (
                  <>
                    약 {calculations.runtimeHours.toFixed(1)}{' '}
                    <span className="text-sm font-normal text-slate-400">시간</span>
                  </>
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 space-y-1">
              <div className="flex justify-between">
                <span>상시 Active 시 수명:</span>
                <span className="font-mono text-slate-300">
                  {(batteryCapMah / calculations.totalActiveCurrent_mA).toFixed(1)} 시간
                </span>
              </div>
              <div className="flex justify-between">
                <span>Power-down 대기만 할 때:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {(batteryCapMah / (calculations.sleepProfiles.find((p) => p.id === 'power_down')!.current_mA * 24 * 365.25)).toFixed(1)} 년
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* C Code Generator for PRR (Power Reduction Register) */}
      <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-amber-400" />
            하드웨어 절전 파워 게이팅 (PRR / sleep.h) C 초기화 코드
          </h3>
          <button
            onClick={copyCode}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs transition"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedCode ? '복사 완료' : '코드 복사'}
          </button>
        </div>

        <p className="text-xs text-slate-400">
          선택된 페리페럴 설정에 맞춰 미사용 모듈의 클럭을 차단하는 PRR(Power Reduction Register) 비트마스크 초기화 C 코드입니다.
        </p>

        <pre className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 text-xs font-mono text-amber-300 overflow-x-auto leading-relaxed">
          {generatedPrrCode}
        </pre>
      </div>
    </div>
  );
};
