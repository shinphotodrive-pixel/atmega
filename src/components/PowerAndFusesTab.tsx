import React, { useState } from 'react';
import { Zap, AlertTriangle, ShieldCheck, Terminal, Copy, Check, LifeBuoy } from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { DynamicPowerConsumptionEstimator } from './DynamicPowerConsumptionEstimator';
import { SleepModeEnergyAdvisor } from './SleepModeEnergyAdvisor';
import { SleepModeDesignGuide } from './SleepModeDesignGuide';
import { EnergyEstimator } from './EnergyEstimator';
import { VoltageRegulatorPowerBudgeting } from './VoltageRegulatorPowerBudgeting';
import { BootloaderSizeCalculator, BootloaderWordSize } from './BootloaderSizeCalculator';
import { SimplePowerCalculator } from './SimplePowerCalculator';
import { DynamicPowerConsumptionCalculator } from './DynamicPowerConsumptionCalculator';
import { ThermalDissipationEstimator } from './ThermalDissipationEstimator';
import { AvrPowerConsumptionSimulator } from './AvrPowerConsumptionSimulator';
import { PowerScenarioSimulator } from './PowerScenarioSimulator';
import { McuErrataResolver } from './McuErrataResolver';
import { ErrataTracker } from './ErrataTracker';
import { MicrochipErrataLiveBrowser } from './MicrochipErrataLiveBrowser';
import { AvrErrataPatternSearch } from './AvrErrataPatternSearch';
import { EepromLifetimeCalculator } from './EepromLifetimeCalculator';
import { McuPowerConsumptionAnalyzer } from './McuPowerConsumptionAnalyzer';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU: (mcu: SupportedMCU) => void;
}

export const PowerAndFusesTab: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Common Fuse State
  const [ckdiv8, setCkdiv8] = useState<boolean>(false);
  const [clockSource, setClockSource] = useState<'ext_crystal' | 'internal_rc' | 'ext_low_freq'>('ext_crystal');
  const [eesave, setEesave] = useState<boolean>(true);
  const [bootrst, setBootrst] = useState<boolean>(true);
  const [bodLevel, setBodLevel] = useState<'disabled' | '2v7' | '4v3'>('2v7');

  // Bootloader Word Size State (512W, 1024W, 2048W, 4096W)
  const [bootloaderSize, setBootloaderSize] = useState<BootloaderWordSize>('512W');

  // Specific Fuses
  const [m103cDisabled, setM103cDisabled] = useState<boolean>(true); // For ATmega128: 1 = unprogrammed = ATmega128 mode (Good!)
  const [jtagEn, setJtagEn] = useState<boolean>(false); // 0 = programmed, 1 = unprogrammed

  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  // Calculate BOOTSZ1:0 bits (0 = programmed, 1 = unprogrammed)
  let bootsz1 = 1;
  let bootsz0 = 1;
  if (selectedMCU === 'atmega128' || selectedMCU === 'atmega640' || selectedMCU === 'atmega2560') {
    if (bootloaderSize === '512W') {
      bootsz1 = 1;
      bootsz0 = 1;
    } else if (bootloaderSize === '1024W') {
      bootsz1 = 1;
      bootsz0 = 0;
    } else if (bootloaderSize === '2048W') {
      bootsz1 = 0;
      bootsz0 = 1;
    } else if (bootloaderSize === '4096W') {
      bootsz1 = 0;
      bootsz0 = 0;
    } else {
      bootsz1 = 1;
      bootsz0 = 1;
    }
  } else {
    // ATmega328P
    if (bootloaderSize === '256W') {
      bootsz1 = 1;
      bootsz0 = 1;
    } else if (bootloaderSize === '512W') {
      bootsz1 = 1;
      bootsz0 = 0;
    } else if (bootloaderSize === '1024W') {
      bootsz1 = 0;
      bootsz0 = 1;
    } else if (bootloaderSize === '2048W' || bootloaderSize === '4096W') {
      bootsz1 = 0;
      bootsz0 = 0;
    }
  }

  // Fuse Calculation logic per MCU
  let lfuseVal = 0xFF;
  let hfuseVal = 0xD8;
  let efuseVal = 0xFF;
  let avrdudePart = 'm640';

  if (selectedMCU === 'atmega640' || selectedMCU === 'atmega2560') {
    avrdudePart = selectedMCU === 'atmega2560' ? 'm2560' : 'm640';
    // Low Fuse
    if (ckdiv8) lfuseVal &= ~0x80;
    if (clockSource === 'ext_crystal') lfuseVal = (lfuseVal & 0xC0) | 0x3F; // 16MHz Crystal
    else if (clockSource === 'internal_rc') lfuseVal = (lfuseVal & 0xC0) | 0x22;
    else lfuseVal = (lfuseVal & 0xC0) | 0x16;

    // High Fuse (Bit 7: OCDEN, 6: JTAGEN, 5: SPIEN, 4: WDTON, 3: EESAVE, 2: BOOTSZ1, 1: BOOTSZ0, 0: BOOTRST)
    hfuseVal = 0xD8;
    if (jtagEn) hfuseVal &= ~0x40; else hfuseVal |= 0x40; // JTAG
    hfuseVal &= ~0x20; // SPIEN enabled (0 = programmed)
    if (eesave) hfuseVal &= ~0x08; else hfuseVal |= 0x08;
    hfuseVal = (hfuseVal & ~0x06) | (bootsz1 << 2) | (bootsz0 << 1);
    if (bootrst) hfuseVal &= ~0x01; else hfuseVal |= 0x01;

    // Ext Fuse
    if (bodLevel === '2v7') efuseVal = 0xFD;
    else if (bodLevel === '4v3') efuseVal = 0xFC;
    else efuseVal = 0xFF;
  } else if (selectedMCU === 'atmega128') {
    avrdudePart = 'm128';
    // Low Fuse
    // ATmega128 doesn't have CKDIV8 bit in lfuse, has SUT1..0, CKSEL3..0
    if (clockSource === 'ext_crystal') lfuseVal = 0xFF; // 16MHz Ext Crystal + 64ms start-up
    else if (clockSource === 'internal_rc') lfuseVal = 0xC2; // 8MHz Internal RC
    else lfuseVal = 0xE9;

    // High Fuse:
    // Bit 7: OCDEN
    // Bit 6: JTAGEN
    // Bit 5: SPIEN
    // Bit 4: CKOPT
    // Bit 3: EESAVE
    // Bit 2: BOOTSZ1
    // Bit 1: BOOTSZ0
    // Bit 0: BOOTRST
    hfuseVal = 0xC8; // base
    if (jtagEn) hfuseVal &= ~0x40; else hfuseVal |= 0x40;
    hfuseVal &= ~0x20; // SPIEN (0 = programmed)
    if (eesave) hfuseVal &= ~0x08; else hfuseVal |= 0x08;
    hfuseVal = (hfuseVal & ~0x06) | (bootsz1 << 2) | (bootsz0 << 1);
    if (bootrst) hfuseVal &= ~0x01; else hfuseVal |= 0x01;

    // Extended Fuse in ATmega128:
    // Bit 1: M103C (0 = ATmega103 compatibility mode programmed, 1 = ATmega128 native mode unprogrammed)
    // Bit 0: WDTON
    efuseVal = 0xFF;
    if (!m103cDisabled) {
      efuseVal &= ~0x02; // 0 = programmed (M103 Compatibility mode - BAD)
    } else {
      efuseVal |= 0x02; // 1 = unprogrammed (Native ATmega128 mode - GOOD)
    }
  } else {
    // ATmega328P
    avrdudePart = 'm328p';
    // Low Fuse (Bit 7: CKDIV8, 6: CKOUT, 5..4: SUT, 3..0: CKSEL)
    if (ckdiv8) lfuseVal &= ~0x80;
    if (clockSource === 'ext_crystal') lfuseVal = (lfuseVal & 0xC0) | 0x3F;
    else if (clockSource === 'internal_rc') lfuseVal = (lfuseVal & 0xC0) | 0x22;
    else lfuseVal = (lfuseVal & 0xC0) | 0x16;

    // High Fuse (Bit 7: RSTDISBL, 6: DWEN, 5: SPIEN, 4: WDTON, 3: EESAVE, 2..1: BOOTSZ, 0: BOOTRST)
    hfuseVal = 0xD8; // base
    if (eesave) hfuseVal &= ~0x08; else hfuseVal |= 0x08;
    hfuseVal = (hfuseVal & ~0x06) | (bootsz1 << 2) | (bootsz0 << 1);
    if (bootrst) hfuseVal &= ~0x01; else hfuseVal |= 0x01;

    // Ext Fuse (BOD: 0xFD for 2.7V, 0xFC for 4.3V, 0xFF for disabled)
    if (bodLevel === '2v7') efuseVal = 0xFD;
    else if (bodLevel === '4v3') efuseVal = 0xFC;
    else efuseVal = 0xFF;
  }

  const lfuseHex = '0x' + (lfuseVal & 0xFF).toString(16).padStart(2, '0').toUpperCase();
  const hfuseHex = '0x' + (hfuseVal & 0xFF).toString(16).padStart(2, '0').toUpperCase();
  const efuseHex = '0x' + (efuseVal & 0xFF).toString(16).padStart(2, '0').toUpperCase();

  const avrdudeCmd = `avrdude -c usbasp -p ${avrdudePart} -U lfuse:w:${lfuseHex}:m -U hfuse:w:${hfuseHex}:m -U efuse:w:${efuseHex}:m`;

  const copyAvrdude = () => {
    navigator.clipboard.writeText(avrdudeCmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Target MCU Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 backdrop-blur shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            전력 및 퓨즈 분석 대상 MCU
          </span>
          <div className="flex flex-wrap gap-2">
            {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
              <button
                key={mcuId}
                onClick={() => onSelectMCU(mcuId)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                  selectedMCU === mcuId
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white'
                }`}
              >
                {MCU_PROFILES[mcuId].name}
              </button>
            ))}
          </div>
        </div>

        <div className="text-right text-xs">
          <span className="text-slate-400 block font-mono">동작 전압 및 안전 클럭</span>
          <span className="font-bold text-amber-400 font-mono text-sm">
            {currentProfile.operatingVoltage} • {currentProfile.maxFreq}
          </span>
        </div>
      </div>

      {/* Intro Box */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
              <Zap className="w-3.5 h-3.5" /> {currentProfile.name} Power Architecture & Reliability
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              {currentProfile.name} 전력 관리, 퓨즈 비트(Fuse Bits) & 에라타
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              {currentProfile.name}의 전압 대 주파수 안전 동작 곡선, 대기전류 절감 슬립 모드,
              퓨즈 비트 계산기 및 벽돌(Brick) 복구 방법, 전용 실리콘 에라타(Silicon Errata) 회피책을 확인하세요.
            </p>
          </div>
        </div>
      </div>

      {/* MCU 전력 소비 분석기 (클럭 주파수 F_CPU & 동작 전압 Vcc 기반 예상 소비 전류 mA 및 전력 소모량 mW 계산) */}
      <div id="mcu-power-consumption-analyzer-section" className="scroll-mt-20">
        <McuPowerConsumptionAnalyzer selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />
      </div>

      {/* Power Scenario Simulator (전력 시나리오 시뮬레이터: 클록, 전압, 주변장치 활성화 기반 실시간 소모 전류 추정) */}
      <PowerScenarioSimulator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Dynamic Power Consumption Calculator (Clock Frequency MHz & Operating Voltage V to Estimate Typ. Active & Idle mA) */}
      <DynamicPowerConsumptionCalculator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* AVR Power Consumption Simulator (Total Current Draw based on Active Peripherals, Clock Freq & Operating Voltage) */}
      <AvrPowerConsumptionSimulator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Simple Power Calculator (Operating Voltage VCC & Clock Frequency F_CPU to Estimate Typical Current Draw) */}
      <SimplePowerCalculator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Dynamic Power Consumption Estimator (Clock Freq, Voltage, Peripherals ADC/SPI/UART/Timer & Typical Profiles) */}
      <DynamicPowerConsumptionEstimator selectedMCU={selectedMCU} />

      {/* Sleep Mode Energy-Consumption Advisor (Idle, ADC Noise Reduction, Power-down, etc. & Peripherals) */}
      <SleepModeEnergyAdvisor selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* 저전력(Sleep) 모드 설계 가이드 (대기전류 차트 & 5대 클럭 도메인 활성화 매트릭스) */}
      <div id="sleep-mode-design-guide-section" className="scroll-mt-20">
        <SleepModeDesignGuide selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />
      </div>

      {/* Energy Estimator Component (Dynamic mA, Power-down, Duty Cycle, Battery Life) */}
      <EnergyEstimator selectedMCU={selectedMCU} />

      {/* Voltage Regulator & Decoupling Power Budgeting Tool */}
      <VoltageRegulatorPowerBudgeting selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Thermal Dissipation & Junction Temperature (TJ) Estimator based on θJA & Package Power */}
      <ThermalDissipationEstimator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* EEPROM 수명/내구성 계산기 (하루 예상 쓰기 횟수, 목표 서비스 연수, 100,000 W/E Cycles & 마모 레벨링 분석) */}
      <div id="eeprom-lifetime-calculator-section" className="scroll-mt-20">
        <EepromLifetimeCalculator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />
      </div>

      {/* Voltage vs Frequency & Sleep Mode Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Voltage vs Freq Card */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-lg space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            공급 전압(VCC) 대 동작 주파수 안전 동작 영역 (SOA) - {currentProfile.name}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {selectedMCU === 'atmega328p'
              ? 'ATmega328P는 PicoPower 기술이 적용되어 1.8V~5.5V에서 유연하게 작동하며, 4.5V 이상에서 20MHz 최대 클럭을 지원합니다.'
              : selectedMCU === 'atmega128'
              ? 'ATmega128A는 2.7V~5.5V 범위에서 구동되며, 4.5V 이상에서 16MHz 정격 클럭을 달성합니다. 3.3V에서는 8MHz 이하로 설정해야 안전합니다.'
              : 'ATmega640은 1.8V(최대 4MHz), 2.7V(최대 8MHz), 4.5V 이상(최대 16MHz)의 정격 전압 곡선을 준수해야 합니다.'}
          </p>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">1.8V ~ 2.7V 구간 (초저전력 배터리):</span>
              <span className="font-mono font-bold text-amber-400">
                {selectedMCU === 'atmega128' ? '미지원 (2.7V 이상 필요)' : '최대 0 ~ 4 MHz'}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  selectedMCU === 'atmega128' ? 'bg-slate-700 w-0' : 'bg-amber-500 w-[25%]'
                }`}
              />
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">2.7V ~ 4.5V 구간 (3.3V 리튬 배터리):</span>
              <span className="font-mono font-bold text-cyan-400">최대 0 ~ 8 MHz (3.3V 표준 권장)</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-cyan-500 h-full w-[50%]" />
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">4.5V ~ 5.5V 구간 (5V 산업 표준):</span>
              <span className="font-mono font-bold text-emerald-400">
                {selectedMCU === 'atmega328p' ? '최대 0 ~ 20 MHz (20 MIPS)' : '최대 0 ~ 16 MHz (16 MIPS)'}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full w-[100%]" />
            </div>
          </div>
        </div>

        {/* Sleep Modes & PRR Card */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-lg space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            초저전력 슬립 모드 & 파워 리덕션
          </h3>

          <div className="space-y-2 text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="font-bold text-white block">Power-down 모드 (최대 절전)</span>
              <p className="text-slate-400 text-[11px] mt-0.5">
                {selectedMCU === 'atmega328p'
                  ? 'PicoPower 기술 덕분에 WDT 동작 시에도 대기 전류가 단 0.75 µA(WDT Off 시 0.1 µA)로 극도로 낮습니다.'
                  : '외부 인터럽트나 WDT 신호로만 기동되며 대기 전류를 수 마이크로암페어 미만으로 억제합니다.'}
              </p>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="font-bold text-white block">Power-save 모드 (비동기 RTC 유지)</span>
              <p className="text-slate-400 text-[11px] mt-0.5">
                {selectedMCU === 'atmega328p'
                  ? 'TOSC1/2에 32.768kHz 크리스탈을 달아 Timer2를 비동기 구동하며 시계를 유지합니다.'
                  : 'TOSC 핀에 연결된 저전력 32.768kHz 크리스탈로 실시간 시계(RTC)를 상시 구동합니다.'}
              </p>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="font-bold text-white block">PRR (Power Reduction Register)</span>
              <p className="text-slate-400 text-[11px] mt-0.5">
                사용하지 않는 USART, TWI, SPI, ADC로 공급되는 내부 클럭 분배선을 차단하여 동적 전력을 절감합니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fuse Bits Calculator & Brick Recovery */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Fuse Configurator */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-400" />
              {currentProfile.name} 퓨즈 비트(Fuse Bits) 대화형 계산기
            </h3>
            <span className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded font-mono">
              AVR 논리: '0' = 기록(Programmed)
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* ATmega128 Specific M103C Fuse Alert */}
            {selectedMCU === 'atmega128' && (
              <div className="bg-rose-500/10 border border-rose-500/40 p-3.5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-400 font-mono text-[11px]">
                    🚨 ATmega128 핵심: M103C 호환 퓨즈 비트 설정
                  </span>
                  <span className="text-[10px] bg-rose-950 text-rose-300 px-2 py-0.5 rounded font-mono">
                    Extended Fuse Bit 1
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                  <input
                    type="checkbox"
                    checked={m103cDisabled}
                    onChange={(e) => setM103cDisabled(e.target.checked)}
                    className="rounded accent-rose-500 w-4 h-4"
                  />
                  <span className="font-semibold text-rose-200">
                    M103C 비활성화 (1 = Unprogrammed = 순수 ATmega128 네이티브 모드 활성화)
                  </span>
                </label>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  공장 출고 시 이 비트가 0(체크 해제 상태)으로 프로그램되어 있어 구형 ATmega103 모드로 동작합니다.
                  이 상태에서는 <strong>Extended I/O 및 2번째 USART(USART1), Timer3가 완전히 먹통</strong>이 됩니다. 반드시 Unprogrammed(1)로 설정해야 합니다!
                </p>
              </div>
            )}

            {/* Low Fuse Settings */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <span className="font-bold text-amber-400 block font-mono text-[11px]">1. Low Fuse (발진 클럭 설정)</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">발진 클럭 소스</label>
                  <select
                    value={clockSource}
                    onChange={(e) => setClockSource(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white"
                  >
                    <option value="ext_crystal">외부 크리스탈 (16MHz 고주파 발진)</option>
                    <option value="internal_rc">내부 RC 오실레이터 (8MHz 무크리스탈)</option>
                    <option value="ext_low_freq">32.768kHz 저주파 크리스탈</option>
                  </select>
                </div>
                {selectedMCU !== 'atmega128' && (
                  <div className="flex items-center pt-4">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={ckdiv8}
                        onChange={(e) => setCkdiv8(e.target.checked)}
                        className="rounded accent-amber-500 w-4 h-4"
                      />
                      <span>CKDIV8 (시스템 클럭 8분주 활성화)</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* High Fuse Settings */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-cyan-400 block font-mono text-[11px]">2. High Fuse (부트로더 & EEPROM 보존)</span>
                <span className="text-[10px] text-cyan-300 font-mono">
                  BOOTSZ = {bootloaderSize}
                </span>
              </div>
              <div className="space-y-1.5">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">부트로더 크기 (BOOTSZ1:0)</label>
                  <select
                    value={bootloaderSize}
                    onChange={(e) => setBootloaderSize(e.target.value as BootloaderWordSize)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white"
                  >
                    <option value="512W">512W (1,024 Bytes / 1KB)</option>
                    <option value="1024W">1024W (2,048 Bytes / 2KB)</option>
                    <option value="2048W">2048W (4,096 Bytes / 4KB)</option>
                    <option value="4096W">4096W (8,192 Bytes / 8KB)</option>
                    {selectedMCU === 'atmega328p' && (
                      <option value="256W">256W (512 Bytes - Optiboot 기본)</option>
                    )}
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={bootrst}
                    onChange={(e) => setBootrst(e.target.checked)}
                    className="rounded accent-amber-500 w-4 h-4"
                  />
                  <span>BOOTRST (리셋 발생 시 부트로더 주소로 즉시 점프)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={eesave}
                    onChange={(e) => setEesave(e.target.checked)}
                    className="rounded accent-amber-500 w-4 h-4"
                  />
                  <span>EESAVE (Chip Erase 시에도 EEPROM 저장 데이터 보존)</span>
                </label>
                {selectedMCU !== 'atmega328p' && (
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={jtagEn}
                      onChange={(e) => setJtagEn(e.target.checked)}
                      className="rounded accent-amber-500 w-4 h-4"
                    />
                    <span>JTAGEN (JTAG 활성화 - 해제 시 Port F 핀을 온전한 GPIO로 사용 가능)</span>
                  </label>
                )}
              </div>
            </div>

            {/* Extended Fuse Settings */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <span className="font-bold text-emerald-400 block font-mono text-[11px]">3. Extended Fuse (BOD 저전압 감지 리셋)</span>
              <div>
                <select
                  value={bodLevel}
                  onChange={(e) => setBodLevel(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white"
                >
                  <option value="2v7">BODLEVEL = 2.7V (권장 - 배터리 방전 시 EEPROM/플래시 보호)</option>
                  <option value="4v3">BODLEVEL = 4.3V (5V 산업 전용)</option>
                  <option value="disabled">BOD 비활성화</option>
                </select>
              </div>
            </div>
          </div>

          {/* Hex Result & avrdude Command */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Low Fuse</span>
                <span className="text-amber-400 font-bold text-sm">{lfuseHex}</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">High Fuse</span>
                <span className="text-cyan-400 font-bold text-sm">{hfuseHex}</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-emerald-400 font-bold block">Ext Fuse</span>
                <span className="text-emerald-400 font-bold text-sm">{efuseHex}</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span className="font-mono">avrdude 플래시 명령어:</span>
                <button
                  onClick={copyAvrdude}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 text-[10px] transition"
                >
                  {copiedCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedCmd ? '복사 완료' : '명령어 복사'}
                </button>
              </div>
              <pre className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-amber-300 overflow-x-auto">
                {avrdudeCmd}
              </pre>
            </div>
          </div>
        </div>

        {/* Brick Recovery Card */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-lg space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <LifeBuoy className="w-4 h-4 text-rose-400" />
            퓨즈 오설정 칩 '벽돌(Brick)' 복구 프로토콜 ({currentProfile.name})
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            클럭 퓨즈를 외부 크리스탈로 설정했으나 보드에 크리스탈이 없거나 배선이 불량할 때 ISP 장비가 칩 ID를 읽지 못해 벽돌 상태가 됩니다.
          </p>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border-l-4 border-rose-500 border-r border-t border-b border-slate-800">
              <strong className="text-white block font-bold">1단계: 1MHz 외부 클럭 신호 생성</strong>
              <p className="text-slate-400 mt-1 text-[11px]">
                정상 아두이노 보드의 Timer PWM 또는 펑션 제너레이터로 <strong>1MHz 5V 구형파(Square Wave)</strong>를 생성합니다.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border-l-4 border-amber-500 border-r border-t border-b border-slate-800">
              <strong className="text-white block font-bold">2단계: XTAL1 핀 주입 & ISP 연결</strong>
              <p className="text-slate-400 mt-1 text-[11px]">
                {selectedMCU === 'atmega328p'
                  ? '구형파를 ATmega328P의 XTAL1 (Pin 9) 핀에 직접 주입합니다.'
                  : selectedMCU === 'atmega128'
                  ? '구형파를 ATmega128의 XTAL1 (Pin 24) 핀에 주입하고 PE0(PDI)/PE1(PDO)를 ISP에 연결합니다.'
                  : '구형파를 ATmega640의 XTAL1 (Pin 34) 핀에 직접 주입합니다.'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border-l-4 border-emerald-500 border-r border-t border-b border-slate-800">
              <strong className="text-white block font-bold">3단계: 저속 클럭 강제 플래싱 (-B 32)</strong>
              <p className="text-slate-400 mt-1 text-[11px] font-mono text-emerald-400">
                avrdude -c usbasp -p {avrdudePart} -B 32 -U lfuse:w:0x62:m
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bootloader Size & Address Calculator (512W, 1024W, 2048W, 4096W & BOOTSZ0/1 Fuses) */}
      <BootloaderSizeCalculator
        selectedMCU={selectedMCU}
        selectedSize={bootloaderSize}
        onSelectSize={setBootloaderSize}
        bootrst={bootrst}
        onToggleBootrst={setBootrst}
      />

      {/* AVR 에라타 데이터베이스 패턴 쿼리 & 코드 검색기 (Common AVR Errata Codes & Database Pattern Query) */}
      <div id="avr-errata-pattern-search-section" className="scroll-mt-20">
        <AvrErrataPatternSearch selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />
      </div>

      {/* Microchip 에라타(Errata) 실시간 브라우저 (실리콘 리비전별 결함, 회피책 Workarounds & 레지스터 설정 가이드) */}
      <div id="microchip-errata-live-browser-section" className="scroll-mt-20">
        <MicrochipErrataLiveBrowser selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />
      </div>

      {/* Hardware Errata Tracker (실시간 에라타 검색 및 시각화 트래커) */}
      <ErrataTracker selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* MCU Errata Resolver (에라타 해결사) */}
      <McuErrataResolver
        selectedMCU={selectedMCU}
        onSelectMCU={onSelectMCU}
        m103cFuseState={m103cDisabled}
        onToggleM103c={setM103cDisabled}
      />
    </div>
  );
};
