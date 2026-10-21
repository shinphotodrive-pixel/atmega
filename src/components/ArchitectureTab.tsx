import React, { useState } from 'react';
import { Cpu, Zap, Layers, Activity, CheckCircle, BarChart3, AlertTriangle, ShieldCheck } from 'lucide-react';
import { MCU_PROFILES, SupportedMCU } from '../data/pinmapData';
import { PeripheralSignalVisualizer } from './PeripheralSignalVisualizer';
import { MemoryMapVisualizer } from './MemoryMapVisualizer';
import { FlashMemoryLayoutVisualizer } from './FlashMemoryLayoutVisualizer';
import { InterruptLatencyCalculator } from './InterruptLatencyCalculator';
import { InterruptResponseTimeEstimator } from './InterruptResponseTimeEstimator';
import { InterruptLatencyEstimator } from './InterruptLatencyEstimator';
import { InterruptVectorTableExplorer } from './InterruptVectorTableExplorer';
import { VirtualOscilloscopeOverlay } from './VirtualOscilloscopeOverlay';
import { InstructionPipelineVisualizer } from './InstructionPipelineVisualizer';
import { InstructionExecutionTimeProfiler } from './InstructionExecutionTimeProfiler';
import { InstructionCycleEstimator } from './InstructionCycleEstimator';
import { VirtualLogicAnalyzer } from './VirtualLogicAnalyzer';
import { EepromEnduranceEstimator } from './EepromEnduranceEstimator';
import { EepromDataLoggingLifeCycleSimulator } from './EepromDataLoggingLifeCycleSimulator';
import { DmaTransferConfigGuide } from './DmaTransferConfigGuide';
import { ClockPowerAnalyzer } from './ClockPowerAnalyzer';
import { AdcNoiseReductionCalibrationCalculator } from './AdcNoiseReductionCalibrationCalculator';
import { PowerConsumptionTimelineAnalyzer } from './PowerConsumptionTimelineAnalyzer';
import { GpioSignalParams, DEFAULT_GPIO_PARAMS } from '../data/gpioSignalTypes';

interface MCUModel {
  id: SupportedMCU;
  name: string;
  tag: string;
  flash: number;
  sram: number;
  eeprom: number;
  io: number;
  usart: number;
  pwm: number;
  adc: number;
  package: string;
  mips: string;
  priceIndex: string;
  strength: string;
  timers: string;
}

const MCU_MODELS: MCUModel[] = [
  {
    id: 'atmega2560',
    name: 'ATmega2560',
    tag: 'Arduino Mega 2560 플래그십',
    flash: 256,
    sram: 8,
    eeprom: 4,
    io: 86,
    usart: 4,
    pwm: 16,
    adc: 16,
    package: '100-pin TQFP (14x14mm)',
    mips: '16 MIPS @ 16MHz',
    priceIndex: '고용량 플래그십 (대형 프로젝트)',
    strength: '256KB 초대형 플래시 (128K Words, 3바이트 PC, RAMPZ 지원), 86 I/O, 4 USART, 16 PWM, 3D 프린터(Marlin) 및 대규모 산업 제어 표준',
    timers: '6개 (2x 8-bit, 4x 16-bit)'
  },
  {
    id: 'atmega640',
    name: 'ATmega640',
    tag: '100핀 고효율 양산 모델',
    flash: 64,
    sram: 8,
    eeprom: 4,
    io: 86,
    usart: 4,
    pwm: 15,
    adc: 16,
    package: '100-pin TQFP / CBGA',
    mips: '16 MIPS @ 16MHz',
    priceIndex: '비용 최적화 (가성비)',
    strength: 'ATmega2560과 동일한 86 I/O 및 4 USART를 유지하면서 64KB Flash로 고가 2560 대비 BOM 원가 대폭 절감',
    timers: '6개 (2x 8-bit, 4x 16-bit)'
  },
  {
    id: 'atmega128',
    name: 'ATmega128',
    tag: '산업용 클래식 스테디셀러',
    flash: 128,
    sram: 4,
    eeprom: 4,
    io: 53,
    usart: 2,
    pwm: 8,
    adc: 8,
    package: '64-pin TQFP / MLF',
    mips: '16 MIPS @ 16MHz (128A)',
    priceIndex: '중간 (산업용 신뢰성)',
    strength: '128KB 넉넉한 롬과 53개 I/O. 국내외 산업용 PLC, 모터 제어 보드 및 학계에서 가장 널리 검증된 8비트 표준',
    timers: '4개 (2x 8-bit, 2x 16-bit)'
  },
  {
    id: 'atmega328p',
    name: 'ATmega328P',
    tag: '아두이노 우노(Uno) 표준',
    flash: 32,
    sram: 2,
    eeprom: 1,
    io: 23,
    usart: 1,
    pwm: 6,
    adc: 8,
    package: '28-pin DIP / 32-pin TQFP',
    mips: '20 MIPS @ 20MHz',
    priceIndex: '초저가 / 초소형',
    strength: '브레드보드 친화형 28핀 DIP, PicoPower 저전력 기술 탑재, 전 세계 최대 규모의 오픈소스 소프트웨어 생태계 보유',
    timers: '3개 (2x 8-bit, 1x 16-bit)'
  }
];

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU: (mcu: SupportedMCU) => void;
  gpioParams?: GpioSignalParams;
  onUpdateGpioParams?: (newParams: Partial<GpioSignalParams>) => void;
  isOscilloscopeOpen?: boolean;
  onToggleOscilloscope?: (open: boolean) => void;
}

export const ArchitectureTab: React.FC<Props> = ({
  selectedMCU,
  onSelectMCU,
  gpioParams,
  onUpdateGpioParams,
  isOscilloscopeOpen: controlledOscilloscopeOpen,
  onToggleOscilloscope
}) => {
  const [activeMetric, setActiveMetric] = useState<'flash' | 'sram' | 'io' | 'usart' | 'pwm' | 'adc'>('flash');
  const [localOscilloscopeOpen, setLocalOscilloscopeOpen] = useState<boolean>(true);
  const [isLogicAnalyzerOpen, setIsLogicAnalyzerOpen] = useState<boolean>(true);

  const isScopeOpen = controlledOscilloscopeOpen !== undefined ? controlledOscilloscopeOpen : localOscilloscopeOpen;
  const setScopeOpen = (open: boolean) => {
    if (onToggleOscilloscope) {
      onToggleOscilloscope(open);
    } else {
      setLocalOscilloscopeOpen(open);
    }
  };

  const activeGpioParams = gpioParams || DEFAULT_GPIO_PARAMS[selectedMCU];

  const metricMeta = {
    flash: { label: 'Flash ROM', unit: 'KB', max: 256, desc: '프로그램 코드 저장 공간 (In-System Self-Programmable)' },
    sram: { label: 'Internal SRAM', unit: 'KB', max: 8, desc: '런타임 전역 변수, 스택, 힙 저장 공간' },
    io: { label: 'General I/O 핀', unit: '개', max: 86, desc: '소프트웨어 제어 가능한 물리 디지털/아날로그 입출력 핀' },
    usart: { label: '하드웨어 USART', unit: '채널', max: 4, desc: '전이중(Full Duplex) 비동기 시리얼 통신 포트' },
    pwm: { label: 'PWM 채널 수', unit: '채널', max: 16, desc: '모터 속도 및 LED 디밍 제어용 펄스 폭 변조 채널' },
    adc: { label: '10비트 ADC', unit: '채널', max: 16, desc: '10비트 고분해능 아날로그 입력 채널 (차동 200배 게인 포함)' }
  };

  const currentProfile = MCU_PROFILES[selectedMCU];

  return (
    <div className="space-y-6">
      {/* Target MCU Quick Selector Tabs */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 backdrop-blur shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-amber-400" /> 타겟 마이크로컨트롤러(MCU) 선택 및 가이드 전환
          </span>
          <span className="text-xs text-amber-400 font-medium">
            현재 집중 분석: <strong className="text-white underline">{currentProfile.name}</strong>
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {MCU_MODELS.map((mcu) => {
            const isSelected = selectedMCU === mcu.id;
            return (
              <button
                key={mcu.id}
                onClick={() => onSelectMCU(mcu.id)}
                className={`p-3.5 rounded-xl text-left transition-all border ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/40 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-base font-bold ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                    {mcu.name}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {mcu.package.split(' ')[0]}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">{mcu.tag}</div>
                <div className="text-[11px] font-mono text-slate-300 mt-2 flex gap-2">
                  <span>Flash: {mcu.flash}KB</span>
                  <span>•</span>
                  <span>SRAM: {mcu.sram}KB</span>
                  <span>•</span>
                  <span>I/O: {mcu.io}핀</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Intro Banner for currently active MCU */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
              <Cpu className="w-3.5 h-3.5" /> {currentProfile.fullName}
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              {currentProfile.name} 펌웨어 아키텍처 & 특징 심층 분석
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              {currentProfile.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl shrink-0">
            <Activity className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-[11px] text-slate-400">명령어 처리 속도</div>
              <div className="text-sm font-bold text-white">{currentProfile.maxFreq}</div>
            </div>
          </div>
        </div>

        {/* Key Strengths Checklist */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {currentProfile.keyStrengths.map((strength, idx) => (
            <div key={idx} className="flex items-start gap-2 text-slate-300">
              <CheckCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{strength}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3-MCU Metric Comparison Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-400" /> 3대 마이크로컨트롤러 정량 자원 비교
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">지표를 선택하여 3대 MCU의 하드웨어 스펙 차이를 시각적으로 확인하세요.</p>
          </div>
          <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(Object.keys(metricMeta) as Array<keyof typeof metricMeta>).map((k) => (
              <button
                key={k}
                onClick={() => setActiveMetric(k)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  activeMetric === k
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {metricMeta[k].label}
              </button>
            ))}
          </div>
        </div>

        {/* Visual Comparison Bars */}
        <div className="space-y-5 bg-slate-950/50 p-5 rounded-xl border border-slate-800/60 mb-6">
          <div className="text-xs font-medium text-slate-400 flex justify-between">
            <span>선택 지표: <strong className="text-amber-400">{metricMeta[activeMetric].label}</strong> ({metricMeta[activeMetric].desc})</span>
            <span>최대 기준: {metricMeta[activeMetric].max} {metricMeta[activeMetric].unit}</span>
          </div>

          <div className="space-y-4">
            {MCU_MODELS.map((mcu) => {
              const val = mcu[activeMetric];
              const pct = Math.max(10, (val / metricMeta[activeMetric].max) * 100);
              const isSelected = selectedMCU === mcu.id;

              return (
                <div key={mcu.name} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold flex items-center gap-2 text-slate-200">
                      {mcu.name}
                      {isSelected && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                          현재 선택됨
                        </span>
                      )}
                    </span>
                    <span className="font-mono font-bold text-sm text-white">
                      {val} <span className="text-xs font-normal text-slate-400">{metricMeta[activeMetric].unit}</span>
                    </span>
                  </div>
                  <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isSelected
                          ? 'bg-gradient-to-r from-amber-500 to-amber-300 shadow-sm shadow-amber-400'
                          : mcu.id === 'atmega128'
                          ? 'bg-gradient-to-r from-cyan-600 to-cyan-400'
                          : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3 Model Spec Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MCU_MODELS.map((mcu) => {
            const isSelected = selectedMCU === mcu.id;
            return (
              <div
                key={mcu.name}
                onClick={() => onSelectMCU(mcu.id)}
                className={`p-5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/5 border-amber-500/40 ring-1 ring-amber-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-1.5">
                      {mcu.name}
                    </h4>
                    <span className="text-xs text-amber-400/90 font-medium">{mcu.tag}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {mcu.package.split(' ')[0]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-3 font-mono">
                  <div className="bg-slate-900/90 p-2 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">Flash / SRAM</span>
                    <span className="font-bold text-white">{mcu.flash}KB / {mcu.sram}KB</span>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">I/O / USART</span>
                    <span className="font-bold text-white">{mcu.io}핀 / {mcu.usart}ch</span>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">PWM / ADC</span>
                    <span className="font-bold text-white">{mcu.pwm}ch / {mcu.adc}ch</span>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">타이머 구성</span>
                    <span className="font-bold text-slate-300">{mcu.timers.split(' ')[0]}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed border-t border-slate-800/80 pt-2.5">
                  {mcu.strength}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Virtual Oscilloscope (Real-time GPIO Signal Trace with Noise & Jitter Simulation) */}
      <div id="virtual-oscilloscope-section" className="scroll-mt-20 space-y-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-white">가상 오실로스코프 오버레이 (Virtual Oscilloscope DSO)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold">
                  {activeGpioParams.pinName} • {activeGpioParams.frequencyHz >= 1000000 ? `${(activeGpioParams.frequencyHz / 1000000).toFixed(2)} MHz` : activeGpioParams.frequencyHz >= 1000 ? `${(activeGpioParams.frequencyHz / 1000).toFixed(1)} kHz` : `${activeGpioParams.frequencyHz} Hz`} • {activeGpioParams.dutyCyclePct}% Duty
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Registers 탭의 GPIO 토글 파라미터가 실시간 연동되어 아날로그 노이즈({activeGpioParams.noiseMv}mV), 에지 지터({activeGpioParams.jitterNs}ns) 및 링잉 파형을 DSO 화면에 계측합니다.
              </p>
            </div>
          </div>
          <button
            onClick={() => setScopeOpen(!isScopeOpen)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all shadow-sm hover:scale-[1.02] shrink-0"
          >
            <Activity className="w-4 h-4" />
            {isScopeOpen ? '오실로스코프 접기' : '오실로스코프 열기'}
          </button>
        </div>

        {isScopeOpen && (
          <VirtualOscilloscopeOverlay
            selectedMCU={selectedMCU}
            gpioParams={activeGpioParams}
            onUpdateParams={onUpdateGpioParams}
            isOpen={isScopeOpen}
            onClose={() => setScopeOpen(false)}
          />
        )}
      </div>

      {/* Virtual Logic Analyzer (Multi-Channel Digital Timings & Transition Latency) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-white">가상 로직 분석기 (Virtual Logic Analyzer)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-semibold">
                  8-Ch Digital • VCD / Sigrok 호환 • 전이 지연(Latency) 계측
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                SPI, I2C, UART, 모터 펄스 및 인터럽트 신호를 MCU 클럭 속도({(16).toFixed(0)}MHz 시 62.5ns/clk) 및 어셈블리 I/O 전이 지연(sbi 2clk, out 1clk)과 연동하여 다채널 타이밍 다이어그램으로 정밀 시뮬레이션합니다.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsLogicAnalyzerOpen(!isLogicAnalyzerOpen)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition-all shadow-sm hover:scale-[1.02] shrink-0"
          >
            <Activity className="w-4 h-4" />
            {isLogicAnalyzerOpen ? '로직 분석기 접기' : '로직 분석기 열기'}
          </button>
        </div>

        {isLogicAnalyzerOpen && (
          <VirtualLogicAnalyzer
            selectedMCU={selectedMCU}
            isOpen={isLogicAnalyzerOpen}
            onClose={() => setIsLogicAnalyzerOpen(false)}
          />
        )}
      </div>

      {/* Interactive Peripheral Signal Visualizer (PWM & ADC Recharts Simulator) */}
      <PeripheralSignalVisualizer selectedMCU={selectedMCU} />

      {/* Memory Map Visualizer (Stacked Bar Chart: Flash, SRAM, EEPROM & Reserved Regions) */}
      <MemoryMapVisualizer selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Flash Memory Layout Visualizer (User Segments, Bootloader, Application Data & Address Scale) */}
      <FlashMemoryLayoutVisualizer selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Interrupt Vector Table Reference & Template C ISR Code Generator */}
      <InterruptVectorTableExplorer selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Interrupt Latency Calculator (Worst-Case Cycles & Nesting Overhead) */}
      <InterruptLatencyCalculator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Interrupt Latency Estimator (Entry & Exit Clock Cycles, Vector Table & Instruction Set Overhead) */}
      <InterruptLatencyEstimator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Interrupt Response Time Estimator (CPU Frequency, Instruction Count & Nested ISR Max Latency) */}
      <InterruptResponseTimeEstimator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Instruction Pipeline Visualizer (D3.js Animated Fetch-Decode-Execute Flow & Throughput) */}
      <InstructionPipelineVisualizer selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Instruction Execution Time Profiler (Cycle & Nanosecond Latency Analyzer for C & Assembly) */}
      <InstructionExecutionTimeProfiler selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Instruction Cycle Estimator (Sequence of AVR Assembly Operations to Calculate Clock Cycles & Execution Time) */}
      <InstructionCycleEstimator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* EEPROM Endurance Estimator (Write Frequency & Silicon Wear Calculator) */}
      <EepromEnduranceEstimator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* EEPROM Data Logging Life-Cycle Simulator (Address-Range Wear & Projected End of Life Warning) */}
      <EepromDataLoggingLifeCycleSimulator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* DMA (Direct Memory Access) Transfer Config Guide & Cycle Estimator */}
      <DmaTransferConfigGuide selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Clock-based Power Analyzer & Voltage-Frequency Operating Range Visualization */}
      <ClockPowerAnalyzer selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* ADC Noise Reduction & Calibration Calculator (Decoupling Cap, VREF & Sampling Rate on ENOB) */}
      <AdcNoiseReductionCalibrationCalculator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Power Consumption Timeline Analyzer (Active, Idle, Sleep Profiles, Peak/Avg Current & Battery Lifetime) */}
      <PowerConsumptionTimelineAnalyzer selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* MCU-Specific Architecture Deep Dives */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Layers className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">
            {selectedMCU === 'atmega640' && 'ATmega640: 대형 I/O & 확장 메모리'}
            {selectedMCU === 'atmega128' && 'ATmega128: M103C 모드 & ISP 주의점'}
            {selectedMCU === 'atmega328p' && 'ATmega328P: PicoPower & 28핀 DIP'}
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            {selectedMCU === 'atmega640' &&
              '86개 I/O 핀(Port A~L)과 4개 하드웨어 USART를 보유하여 다중 통신 센서 허브 및 대형 산업용 콘솔에 최적화되어 있습니다.'}
            {selectedMCU === 'atmega128' &&
              '출고 시 M103C 퓨즈가 켜져 있어 구형 ATmega103 모드로 동작하므로, Extended I/O를 쓰려면 필히 퓨즈에서 M103C를 해제(1)해야 합니다. 또한 ISP 다운로딩 핀은 PB1~3이 아니라 PE0(PDI)/PE1(PDO)입니다!'}
            {selectedMCU === 'atmega328p' &&
              '28핀 DIP 패키지로 만능기판 조립이 용이하며, Power-down 모드에서 0.1 µA, Power-save 모드에서 0.75 µA의 극한 절전을 실현하는 PicoPower 아키텍처가 적용되어 있습니다.'}
          </p>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300">
            {selectedMCU === 'atmega640' && '• 4x USART (0, 1, 2, 3)\n• 15x PWM (8-bit & 16-bit)\n• 외부 SRAM 64KB (XMEM)'}
            {selectedMCU === 'atmega128' && '• M103C Fuse: 반드시 Unprogrammed(1)\n• ISP: PE0(PDI), PE1(PDO), PB1(SCK)\n• 2x USART, 8x PWM, 8x ADC'}
            {selectedMCU === 'atmega328p' && '• 1x USART, 6x PWM, 8x ADC (TQFP)\n• Optiboot 부트로더: 512 Bytes\n• 전 세계 최대 Arduino 라이브러리'}
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Zap className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">타이머/카운터 & PWM 아키텍처</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            {selectedMCU === 'atmega640' &&
              '타이머가 무려 6개(Timer0/2 8비트, Timer1/3/4/5 16비트) 내장되어 총 15개의 PWM 채널을 하드웨어 수준에서 정밀 생성합니다.'}
            {selectedMCU === 'atmega128' &&
              'Timer0/2(8비트)와 Timer1/3(16비트) 총 4개 타이머를 통해 서보모터 구동(Timer1/3)과 시스템 시각 카운팅(Timer0/2)을 분리합니다.'}
            {selectedMCU === 'atmega328p' &&
              'Timer0(밀리초 millis), Timer1(16비트 정밀 서보모터/초음파 캡처), Timer2(비동기 PWM/톤 발생) 3개 타이머를 효율적으로 분배해야 합니다.'}
          </p>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300">
            {selectedMCU === 'atmega640' && '• Timer0: 8-bit (OC0A/B)\n• Timer1/3/4/5: 16-bit (OCxA/B/C)\n• Timer2: 8-bit 비동기 RTC'}
            {selectedMCU === 'atmega128' && '• Timer0: 8-bit (OC0)\n• Timer1/3: 16-bit (OC1A/B/C, OC3A/B/C)\n• Timer2: 8-bit 비동기'}
            {selectedMCU === 'atmega328p' && '• Timer0: 8-bit (millis/delay 사용)\n• Timer1: 16-bit (Servo, ICR1 캡처)\n• Timer2: 8-bit (Tone, Phase Correct)'}
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">메모리 계층 및 보존 신뢰성</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            모든 3종 MCU는 고신뢰성 플래시 메모리(10,000회 W/E) 및 EEPROM(100,000회 W/E)을 내장하고 있으며, 25°C 상온 기준 100년, 85°C 환경 기준 20년의 데이터 보존 수명을 보장합니다.
          </p>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300">
            • Flash: {currentProfile.flash} KB<br />
            • SRAM: {currentProfile.sram} KB<br />
            • EEPROM: {currentProfile.eeprom} KB
          </div>
        </div>
      </div>
    </div>
  );
};
