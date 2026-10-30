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
  RefreshCw,
  BarChart3,
  CircleDot
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type SleepModeId =
  | 'active'
  | 'idle'
  | 'adc_noise'
  | 'power_save'
  | 'power_down'
  | 'standby'
  | 'ext_standby';

interface ClockDomains {
  clkCpu: boolean;      // clk_CPU
  clkFlash: boolean;    // clk_FLASH
  clkIo: boolean;       // clk_I/O (Timers, USART, SPI)
  clkAdc: boolean;      // clk_ADC
  clkAsy: boolean;      // clk_ASY (Asynchronous Timer/Counter2 32.768kHz)
  mainOsc: boolean;     // Main Crystal / Internal RC Oscillator running
}

interface SleepModeDetail {
  id: SleepModeId;
  name: string;
  nameKo: string;
  cMacro: string;
  smBits: string; // SM2..0 or SM2..0 in SMCR/MCUCR
  clocks: ClockDomains;
  wakeSources: string[];
  wakeLatency: string;
  typicalCurrentMap: Record<SupportedMCU, {
    v5_16m: number;   // mA at 5V, 16MHz
    v3_8m: number;    // mA at 3.3V, 8MHz
    v1_1m?: number;   // mA at 1.8V, 1MHz
    isMicroAmp?: boolean; // if true, numbers are in µA
  }>;
  summary: string;
  color: string;
}

const SLEEP_MODES_CATALOG: SleepModeDetail[] = [
  {
    id: 'active',
    name: 'Active Mode',
    nameKo: '정상 동작 모드 (Active)',
    cMacro: '/* Active Core Running */',
    smBits: 'None',
    clocks: {
      clkCpu: true,
      clkFlash: true,
      clkIo: true,
      clkAdc: true,
      clkAsy: true,
      mainOsc: true,
    },
    wakeSources: ['N/A (코어가 상시 실행 중)'],
    wakeLatency: '0 사이클 (상시 기동)',
    typicalCurrentMap: {
      atmega328p: { v5_16m: 9.2, v3_8m: 3.5, v1_1m: 0.35 },
      atmega2560: { v5_16m: 14.5, v3_8m: 5.8, v1_1m: 0.65 },
      atmega128:  { v5_16m: 15.0, v3_8m: 6.2 },
      atmega640:  { v5_16m: 13.8, v3_8m: 5.5, v1_1m: 0.60 },
    },
    summary: 'CPU, 플래시 버스, 모든 주변장치가 전력을 소비하며 명령어를 정상 인출 및 실행하는 기본 상태입니다.',
    color: '#38bdf8' // sky-400
  },
  {
    id: 'idle',
    name: 'Idle Mode',
    nameKo: '유휴 모드 (Idle)',
    cMacro: 'SLEEP_MODE_IDLE',
    smBits: '000',
    clocks: {
      clkCpu: false,
      clkFlash: false,
      clkIo: true,
      clkAdc: true,
      clkAsy: true,
      mainOsc: true,
    },
    wakeSources: ['모든 활성화된 인터럽트 (타이머, USART, SPI, ADC, 외부 핀, TWI)'],
    wakeLatency: '6 클럭 사이클 (즉각 복귀)',
    typicalCurrentMap: {
      atmega328p: { v5_16m: 3.1, v3_8m: 0.95, v1_1m: 0.08 },
      atmega2560: { v5_16m: 5.2, v3_8m: 1.80, v1_1m: 0.18 },
      atmega128:  { v5_16m: 5.8, v3_8m: 2.10 },
      atmega640:  { v5_16m: 4.9, v3_8m: 1.70, v1_1m: 0.16 },
    },
    summary: 'CPU 코어와 플래시 클럭만 멈추고 SPI, USART, ADC, 타이머는 계속 동작하여 통신이나 카운터 대기 시 약 65%의 전력을 절감합니다.',
    color: '#60a5fa' // blue-400
  },
  {
    id: 'adc_noise',
    name: 'ADC Noise Reduction',
    nameKo: 'ADC 노이즈 저감 모드',
    cMacro: 'SLEEP_MODE_ADC',
    smBits: '001',
    clocks: {
      clkCpu: false,
      clkFlash: false,
      clkIo: false,
      clkAdc: true,
      clkAsy: true,
      mainOsc: true,
    },
    wakeSources: ['ADC 변환 완료', '외부 인터럽트(INT0/1, PCINT)', 'TWI 주소 일치', 'Timer2', 'WDT'],
    wakeLatency: '6 클럭 사이클',
    typicalCurrentMap: {
      atmega328p: { v5_16m: 0.95, v3_8m: 0.32, v1_1m: 0.04 },
      atmega2560: { v5_16m: 2.10, v3_8m: 0.75, v1_1m: 0.09 },
      atmega128:  { v5_16m: 2.40, v3_8m: 0.85 },
      atmega640:  { v5_16m: 1.95, v3_8m: 0.70, v1_1m: 0.08 },
    },
    summary: 'CPU와 I/O 버스 노이즈를 완전 차단하고 ADC 컨버터만 단독 동작시켜 10비트 고정밀 아날로그 샘플링을 수행합니다.',
    color: '#a78bfa' // violet-400
  },
  {
    id: 'power_save',
    name: 'Power-save Mode',
    nameKo: '파워 세이브 모드 (Power-save)',
    cMacro: 'SLEEP_MODE_PWR_SAVE',
    smBits: '011',
    clocks: {
      clkCpu: false,
      clkFlash: false,
      clkIo: false,
      clkAdc: false,
      clkAsy: true, // Asynchronous Timer2 32.768kHz continues!
      mainOsc: false,
    },
    wakeSources: ['Timer2 비동기 오버플로우/비교 일치', '외부 인터럽트', 'TWI 주소 일치', 'WDT'],
    wakeLatency: '외부 쿼츠: ~65ms, 내부 RC: 6 사이클',
    typicalCurrentMap: {
      atmega328p: { v5_16m: 1.6, v3_8m: 0.85, v1_1m: 0.65, isMicroAmp: true },
      atmega2560: { v5_16m: 3.2, v3_8m: 1.80, v1_1m: 1.20, isMicroAmp: true },
      atmega128:  { v5_16m: 12.0, v3_8m: 6.50, isMicroAmp: true },
      atmega640:  { v5_16m: 3.0, v3_8m: 1.70, v1_1m: 1.15, isMicroAmp: true },
    },
    summary: '메인 발진기를 멈추지만 32.768kHz 저전력 크리스탈로 구동되는 비동기 Timer2는 유지하여 저전력 실시간 시계(RTC)를 상시 계측합니다.',
    color: '#34d399' // emerald-400
  },
  {
    id: 'standby',
    name: 'Standby Mode',
    nameKo: '스탠바이 모드 (Standby)',
    cMacro: 'SLEEP_MODE_STANDBY',
    smBits: '110',
    clocks: {
      clkCpu: false,
      clkFlash: false,
      clkIo: false,
      clkAdc: false,
      clkAsy: false,
      mainOsc: true, // Main oscillator keeps running!
    },
    wakeSources: ['외부 인터럽트 (INT0/1, PCINT)', 'TWI 주소 일치', 'WDT 리셋/인터럽트'],
    wakeLatency: '6 클럭 사이클 (초고속 웨이크업)',
    typicalCurrentMap: {
      atmega328p: { v5_16m: 0.82, v3_8m: 0.25, v1_1m: 0.03 },
      atmega2560: { v5_16m: 1.65, v3_8m: 0.55, v1_1m: 0.07 },
      atmega128:  { v5_16m: 1.90, v3_8m: 0.65 },
      atmega640:  { v5_16m: 1.55, v3_8m: 0.50, v1_1m: 0.06 },
    },
    summary: 'Power-down과 동일하게 모든 주변장치를 차단하지만 메인 크리스탈 발진기를 끄지 않아 6 사이클만에 즉시 최고 속도로 복귀합니다.',
    color: '#fbbf24' // amber-400
  },
  {
    id: 'ext_standby',
    name: 'Extended Standby Mode',
    nameKo: '확장 스탠바이 모드 (Ext Standby)',
    cMacro: 'SLEEP_MODE_EXT_STANDBY',
    smBits: '111',
    clocks: {
      clkCpu: false,
      clkFlash: false,
      clkIo: false,
      clkAdc: false,
      clkAsy: true, // Timer2 Async active
      mainOsc: true, // Main Osc active
    },
    wakeSources: ['Timer2 오버플로우', '외부 인터럽트', 'TWI 주소 일치', 'WDT'],
    wakeLatency: '6 클럭 사이클',
    typicalCurrentMap: {
      atmega328p: { v5_16m: 0.85, v3_8m: 0.27, v1_1m: 0.035 },
      atmega2560: { v5_16m: 1.72, v3_8m: 0.58, v1_1m: 0.075 },
      atmega128:  { v5_16m: 1.98, v3_8m: 0.68 },
      atmega640:  { v5_16m: 1.62, v3_8m: 0.53, v1_1m: 0.068 },
    },
    summary: 'Power-save와 Standby의 결합형으로, 메인 발진기와 32kHz 비동기 타이머2를 동시 유지하여 RTC 동작 및 초고속 복귀를 동시 보장합니다.',
    color: '#f97316' // orange-500
  },
  {
    id: 'power_down',
    name: 'Power-down Mode',
    nameKo: '파워다운 모드 (최대 절전)',
    cMacro: 'SLEEP_MODE_PWR_DOWN',
    smBits: '010',
    clocks: {
      clkCpu: false,
      clkFlash: false,
      clkIo: false,
      clkAdc: false,
      clkAsy: false,
      mainOsc: false,
    },
    wakeSources: ['외부 인터럽트 Low Level(INT0/1)', 'Pin Change(PCINT)', 'TWI 주소 수신', 'WDT'],
    wakeLatency: '외부 크리스탈: ~65ms (16K 사이클), 내부 RC: 6 사이클',
    typicalCurrentMap: {
      atmega328p: { v5_16m: 0.15, v3_8m: 0.10, v1_1m: 0.05, isMicroAmp: true },
      atmega2560: { v5_16m: 10.5, v3_8m: 5.20, v1_1m: 2.10, isMicroAmp: true },
      atmega128:  { v5_16m: 18.0, v3_8m: 8.50, isMicroAmp: true },
      atmega640:  { v5_16m: 9.8,  v3_8m: 4.90, v1_1m: 2.00, isMicroAmp: true },
    },
    summary: '모든 발진기와 클럭을 완전 정지시키는 극한의 절전 모드로, 배터리 구동 기기에서 수 개월~수 년간 슬립을 유지할 수 있는 핵심 모드입니다.',
    color: '#f43f5e' // rose-500
  }
];

export const SleepModeDesignGuide: React.FC<Props> = ({
  selectedMCU,
  onSelectMCU
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Voltage Condition Selector: 5V vs 3.3V vs 1.8V
  const [voltageCondition, setVoltageCondition] = useState<'v5_16m' | 'v3_8m' | 'v1_1m'>('v5_16m');
  const [selectedModeId, setSelectedModeId] = useState<SleepModeId>('power_down');
  const [disableAdcBeforeSleep, setDisableAdcBeforeSleep] = useState<boolean>(true);
  const [wdtEnabledInSleep, setWdtEnabledInSleep] = useState<boolean>(false);
  const [disableBodInSleep, setDisableBodInSleep] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Active Selected Mode
  const activeMode = useMemo(() => {
    return SLEEP_MODES_CATALOG.find((m) => m.id === selectedModeId) || SLEEP_MODES_CATALOG[4];
  }, [selectedModeId]);

  // Current Calculation Helper (returns current in microamps for easy comparison)
  const getCurrentMicroamps = (mode: SleepModeDetail): number => {
    const data = mode.typicalCurrentMap[selectedMCU] || mode.typicalCurrentMap.atmega328p;
    let val = data[voltageCondition];
    if (val === undefined) {
      val = data.v3_8m; // fallback
    }

    let uA = data.isMicroAmp ? val : val * 1000;

    // Add WDT overhead in Power-down/Power-save if enabled (~4.2µA on 328P, ~8µA on 2560)
    if (wdtEnabledInSleep && (mode.id === 'power_down' || mode.id === 'power_save' || mode.id === 'standby')) {
      uA += selectedMCU === 'atmega328p' ? 4.2 : 8.5;
    }

    // Add ADC leakage if ADC is not disabled (~220µA)
    if (!disableAdcBeforeSleep && (mode.id === 'power_down' || mode.id === 'power_save' || mode.id === 'standby')) {
      uA += 230.0;
    }

    // Add BOD leakage if BOD in sleep is not disabled (~20µA)
    if (!disableBodInSleep && (mode.id === 'power_down' || mode.id === 'power_save')) {
      uA += 20.0;
    }

    return uA;
  };

  const activeModeCurrentUa = getCurrentMicroamps(activeMode);
  const activeBaseCurrentUa = getCurrentMicroamps(SLEEP_MODES_CATALOG[0]); // Active mode base
  const reductionRatio = ((1 - activeModeCurrentUa / activeBaseCurrentUa) * 100).toFixed(1);

  // Formatted Current Display
  const formatCurrent = (uA: number) => {
    if (uA >= 1000) {
      return `${(uA / 1000).toFixed(2)} mA`;
    }
    return `${uA.toFixed(uA < 1 ? 2 : 1)} µA`;
  };

  // C Firmware Snippet for the selected sleep mode
  const generatedCSource = useMemo(() => {
    if (activeMode.id === 'active') {
      return `/* Active Mode - Normal Execution */
void loop(void) {
    // Normal firmware tasks running continuously
}`;
    }

    const needsBodTimedSequence = disableBodInSleep && (selectedMCU === 'atmega328p' || selectedMCU === 'atmega2560');

    return `/* =========================================================================
 * ${currentProfile.name} ${activeMode.nameKo} 진입 및 웨이크업 제어 코드
 * 전력 절감율: 기본 Active 대비 ${reductionRatio}% 절감
 * 예상 대기전류: ${formatCurrent(activeModeCurrentUa)} (@ ${voltageCondition === 'v5_16m' ? '5.0V 16MHz' : voltageCondition === 'v3_8m' ? '3.3V 8MHz' : '1.8V 1MHz'})
 * ========================================================================= */
#include <avr/io.h>
#include <avr/sleep.h>
#include <avr/interrupt.h>
#include <avr/wdt.h>

void enter_${activeMode.id}_mode(void) {
    /* 1. 슬립 모드 구성 (SMCR 레지스터 SM2..0 설정) */
    set_sleep_mode(${activeMode.cMacro});

${disableAdcBeforeSleep ? `    /* 2. ADC 내부 아날로그 버퍼 차단 (~230µA 누설 전류 원천 방지) */
    uint8_t prev_adcsra = ADCSRA;
    ADCSRA &= ~(1 << ADEN);` : `    /* [주의] ADEN이 켜져 있으면 약 230µA가 지속 소모됩니다 */`}

${wdtEnabledInSleep ? `    /* 3. 워치독 인터럽트 타이머 8초 웨이크업 가동 (주기적 기동용) */
    wdt_enable(WDTO_8S);
    WDTCSR |= (1 << WDIE);` : `    /* 워치독 비활성화 (순수 외부 인터럽트 웨이크업) */
    wdt_disable();`}

    /* 4. 전역 인터럽트 활성화 및 슬립 인에이블 */
    cli();
    sleep_enable();

${needsBodTimedSequence ? `    /* 5. 런타임 BOD(Brown-out Detector) 슬립 비활성화 (BODS 4사이클 시퀀스) */
    MCUCR |= (1 << BODSE) | (1 << BODS);
    MCUCR = (MCUCR & ~(1 << BODSE)) | (1 << BODS);
    sei();           // 원자적 인터럽트 허용
    sleep_cpu();     // 즉시 CPU 슬립 진입!` : `    sei();
    sleep_cpu();`}

    /* =====================================================================
     * WAKE-UP EVENT! (인터럽트 복귀 후 아래 명령어가 실행됩니다)
     * ===================================================================== */
    sleep_disable(); // 재수면 방지

${disableAdcBeforeSleep ? `    /* ADC 재가동 */
    ADCSRA = prev_adcsra;` : ''}
}`;
  }, [activeMode, currentProfile, reductionRatio, activeModeCurrentUa, voltageCondition, disableAdcBeforeSleep, wdtEnabledInSleep, disableBodInSleep, selectedMCU]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCSource);
    setCopiedKey('code');
    confetti({
      particleCount: 28,
      spread: 45,
      origin: { y: 0.85 }
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl backdrop-blur relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute -top-32 -right-32 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shadow-inner">
              <Moon className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base md:text-lg font-bold text-white tracking-wide">
                  저전력(Sleep) 모드 설계 가이드 &amp; 대화형 클럭 도메인 차트
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                  Low-Power Architecture
                </span>
              </div>
              <p className="text-xs text-slate-400">
                선택된 {currentProfile.name}의 각 슬립 모드(Idle, Power-down, Standby 등)별 대기전류 소모값과 5대 클럭 도메인 차단 조합을 분석하고 최적화 펌웨어 코드를 생성합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Selected MCU Profile Tag */}
        <div className="flex items-center gap-2 shrink-0">
          {onSelectMCU && (
            <select
              value={selectedMCU}
              onChange={(e) => onSelectMCU(e.target.value as SupportedMCU)}
              className="bg-slate-950 border border-slate-700 hover:border-indigo-500 text-xs text-indigo-300 font-mono rounded-xl px-2.5 py-1.5 focus:outline-none transition-colors"
            >
              {Object.keys(MCU_PROFILES).map((mcuKey) => (
                <option key={mcuKey} value={mcuKey}>
                  {MCU_PROFILES[mcuKey as SupportedMCU].name}
                </option>
              ))}
            </select>
          )}
          <span className="text-xs font-mono text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            {currentProfile.name}
          </span>
        </div>
      </div>

      {/* Operating Condition Switcher Toolbar */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mr-1">
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            전압/주파수 조건:
          </span>
          <button
            onClick={() => setVoltageCondition('v5_16m')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition ${
              voltageCondition === 'v5_16m'
                ? 'bg-indigo-600 text-white border-indigo-400 font-bold shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            5.0V @ 16 MHz (산업 표준)
          </button>
          <button
            onClick={() => setVoltageCondition('v3_8m')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition ${
              voltageCondition === 'v3_8m'
                ? 'bg-indigo-600 text-white border-indigo-400 font-bold shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            3.3V @ 8 MHz (리튬 배터리 권장)
          </button>
          {selectedMCU !== 'atmega128' && (
            <button
              onClick={() => setVoltageCondition('v1_1m')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition ${
                voltageCondition === 'v1_1m'
                  ? 'bg-indigo-600 text-white border-indigo-400 font-bold shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              1.8V @ 1 MHz (극저전력)
            </button>
          )}
        </div>

        {/* Leakage Prevention Toggles */}
        <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={disableAdcBeforeSleep}
              onChange={(e) => setDisableAdcBeforeSleep(e.target.checked)}
              className="accent-indigo-500 rounded"
            />
            <span title="슬립 진입 전 ADEN=0 설정하여 230µA 누설 방지">ADC 차단</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={wdtEnabledInSleep}
              onChange={(e) => setWdtEnabledInSleep(e.target.checked)}
              className="accent-indigo-500 rounded"
            />
            <span title="워치독 타이머를 주기적 웨이크업용으로 가동">+WDT (~4.2µA)</span>
          </label>
        </div>
      </div>

      {/* Interactive Sleep Mode Comparison Bar Chart (Log Scale & Percentage) */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4 relative z-10 shadow-inner">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              {currentProfile.name} 슬립 모드별 예상 대기전류 비교 차트
            </h4>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            막대를 클릭하여 상세 클럭 도메인 및 C 코드를 확인하세요
          </span>
        </div>

        {/* Comparative Bars */}
        <div className="space-y-2.5 pt-1">
          {SLEEP_MODES_CATALOG.map((mode) => {
            const currentUa = getCurrentMicroamps(mode);
            const isSelected = selectedModeId === mode.id;

            // Logarithmic width calculation (1µA ~ 20mA span)
            // Log scale: min = log10(0.05) ~ -1.3, max = log10(20000) ~ 4.3
            const logVal = Math.log10(Math.max(0.05, currentUa));
            const minLog = -1.3;
            const maxLog = 4.3;
            const barWidthPercent = Math.min(100, Math.max(3, ((logVal - minLog) / (maxLog - minLog)) * 100));

            return (
              <div
                key={mode.id}
                onClick={() => setSelectedModeId(mode.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-slate-900 border-indigo-500 shadow-md shadow-indigo-950/50 ring-1 ring-indigo-400/40 scale-[1.01]'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/40'
                }`}
              >
                <div className="w-full sm:w-48 shrink-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: mode.color }}
                    />
                    <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                      {mode.nameKo}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 pl-4.5">
                    {mode.cMacro}
                  </div>
                </div>

                {/* Progress bar visual */}
                <div className="flex-1 w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800/80 relative">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${barWidthPercent}%`,
                      backgroundColor: mode.color,
                      opacity: isSelected ? 1 : 0.8
                    }}
                  />
                </div>

                {/* Current Value Display */}
                <div className="w-28 text-right font-mono shrink-0">
                  <span className={`text-xs font-bold ${isSelected ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {formatCurrent(currentUa)}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {mode.id === 'active' ? 'Base (100%)' : `-${((1 - currentUa / activeBaseCurrentUa) * 100).toFixed(0)}%`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Clock Domains Matrix & Wakeup Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        {/* Left Column: Clock Domain Activation Matrix (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-inner">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                AVR 5대 클럭 도메인 활성화/정지 매트릭스
              </h4>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              SMCR.SM2:0 = {activeMode.smBits}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            AVR 아키텍처는 전력 절감을 위해 내부 클럭 트리를 세부 도메인별로 분리 차단합니다.
            선택된 <strong className="text-white">{activeMode.nameKo}</strong>에서의 클럭 분배 상태입니다:
          </p>

          {/* Matrix Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
            {/* clk_CPU */}
            <div className={`p-3 rounded-xl border flex flex-col justify-between ${
              activeMode.clocks.clkCpu 
                ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300' 
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}>
              <span className="text-[10px] uppercase font-bold text-slate-400">clk_CPU</span>
              <span className="font-bold text-xs mt-1">CPU 코어 클럭</span>
              <span className="text-[10px] mt-2 font-bold">
                {activeMode.clocks.clkCpu ? '✓ ACTIVE 가동' : '✗ HALTED 정지'}
              </span>
            </div>

            {/* clk_FLASH */}
            <div className={`p-3 rounded-xl border flex flex-col justify-between ${
              activeMode.clocks.clkFlash 
                ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300' 
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}>
              <span className="text-[10px] uppercase font-bold text-slate-400">clk_FLASH</span>
              <span className="font-bold text-xs mt-1">플래시 메모리 버스</span>
              <span className="text-[10px] mt-2 font-bold">
                {activeMode.clocks.clkFlash ? '✓ ACTIVE 가동' : '✗ HALTED 정지'}
              </span>
            </div>

            {/* clk_I/O */}
            <div className={`p-3 rounded-xl border flex flex-col justify-between ${
              activeMode.clocks.clkIo 
                ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300' 
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}>
              <span className="text-[10px] uppercase font-bold text-slate-400">clk_I/O</span>
              <span className="font-bold text-xs mt-1">주변장치 I/O 클럭</span>
              <span className="text-[10px] mt-2 font-bold">
                {activeMode.clocks.clkIo ? '✓ ACTIVE 가동' : '✗ HALTED 정지'}
              </span>
            </div>

            {/* clk_ADC */}
            <div className={`p-3 rounded-xl border flex flex-col justify-between ${
              activeMode.clocks.clkAdc 
                ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300' 
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}>
              <span className="text-[10px] uppercase font-bold text-slate-400">clk_ADC</span>
              <span className="font-bold text-xs mt-1">ADC 프리스케일러</span>
              <span className="text-[10px] mt-2 font-bold">
                {activeMode.clocks.clkAdc ? '✓ ACTIVE 가동' : '✗ HALTED 정지'}
              </span>
            </div>

            {/* clk_ASY */}
            <div className={`p-3 rounded-xl border flex flex-col justify-between ${
              activeMode.clocks.clkAsy 
                ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300' 
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}>
              <span className="text-[10px] uppercase font-bold text-slate-400">clk_ASY (32kHz)</span>
              <span className="font-bold text-xs mt-1">비동기 Timer2 RTC</span>
              <span className="text-[10px] mt-2 font-bold">
                {activeMode.clocks.clkAsy ? '✓ ACTIVE 가동' : '✗ HALTED 정지'}
              </span>
            </div>

            {/* Main Oscillator */}
            <div className={`p-3 rounded-xl border flex flex-col justify-between ${
              activeMode.clocks.mainOsc 
                ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300' 
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}>
              <span className="text-[10px] uppercase font-bold text-slate-400">Main OSC</span>
              <span className="font-bold text-xs mt-1">메인 크리스탈 발진기</span>
              <span className="text-[10px] mt-2 font-bold">
                {activeMode.clocks.mainOsc ? '✓ RUNNING 구동' : '✗ STOPPED 차단'}
              </span>
            </div>
          </div>

          {/* Wakeup Latency & Sources */}
          <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 text-xs space-y-2">
            <div className="flex justify-between items-center text-slate-300">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-amber-400" />
                웨이크업 지연 시간 (Wake-up Latency):
              </span>
              <span className="font-mono font-bold text-amber-400">{activeMode.wakeLatency}</span>
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              <strong className="text-slate-300">복귀 가능 트리거 소스: </strong>
              {activeMode.wakeSources.join(', ')}
            </div>
          </div>
        </div>

        {/* Right Column: Optimized C Code Generator (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-inner flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  C 언어 슬립 제어 펌웨어 스니펫
                </h4>
              </div>

              <button
                onClick={handleCopyCode}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1 text-[11px] font-bold shadow-md shadow-emerald-600/20"
              >
                {copiedKey === 'code' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-200" />
                    <span>복사 완료</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>코드 복사</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto leading-relaxed select-all max-h-80">
              {generatedCSource}
            </pre>
          </div>

          {/* Expert Sleep Tip Callout */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-300 leading-relaxed space-y-1">
            <span className="font-bold text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              저전력 설계 황금률 (Golden Rules)
            </span>
            <p className="text-slate-400">
              1. 슬립 진입 전 모든 미사용 I/O 핀은 내부 풀업(`PORTx=0xFF`)을 켜거나 출력으로 고정하여 플로팅 누설을 방지하세요.<br />
              2. ADC를 끄지 않으면 슬립 중에도 약 230µA가 누설되므로 `ADCSRA &amp;= ~(1 &lt;&lt; ADEN)`이 필수입니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
