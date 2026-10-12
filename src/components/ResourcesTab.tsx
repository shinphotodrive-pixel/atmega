import React, { useState, useMemo } from 'react';
import { RESOURCES, ResourceItem } from '../data/resourcesData';
import { Github, Youtube, Search, ExternalLink, BookOpen, Star, Clock, CheckCircle2, Cpu } from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { PeripheralResourceLibrarian } from './PeripheralResourceLibrarian';
import { MakefileGenerator } from './MakefileGenerator';
import { IoPinProtectionDesigner } from './IoPinProtectionDesigner';
import { CompilerOutputSizeProfiler } from './CompilerOutputSizeProfiler';
import { BuildTimePerformanceAnalyzer } from './BuildTimePerformanceAnalyzer';
import { ExternalInterruptTutorial } from './ExternalInterruptTutorial';
import { BitBangTimingCalculator } from './BitBangTimingCalculator';
import { AvrPowerConsumptionSimulator } from './AvrPowerConsumptionSimulator';
import { CompilerOptimizationReportGenerator } from './CompilerOptimizationReportGenerator';
import { AvrStackHeapCollisionAnalyzer } from './AvrStackHeapCollisionAnalyzer';
import { BuildArtifactDependencyVisualizer } from './BuildArtifactDependencyVisualizer';
import { MemoryFragmentationAnalyzer } from './MemoryFragmentationAnalyzer';
import { PowerScenarioPlanner } from './PowerScenarioPlanner';
import { AvrMpuProtectionSimulator } from './AvrMpuProtectionSimulator';
import { DynamicMemoryAllocationTracker } from './DynamicMemoryAllocationTracker';
import { AvrInterruptLatencyAnalyzer } from './AvrInterruptLatencyAnalyzer';
import { CommunicationProtocolFrameAnalyzer } from './CommunicationProtocolFrameAnalyzer';
import { AvrWatchdogTuningGuide } from './AvrWatchdogTuningGuide';
import { InstructionExecutionTimeProfiler } from './InstructionExecutionTimeProfiler';
import { AvrLowPowerBatteryLifeCalculator } from './AvrLowPowerBatteryLifeCalculator';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU: (mcu: SupportedMCU) => void;
}

export const ResourcesTab: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const [filterType, setFilterType] = useState<'all' | 'github' | 'youtube' | 'doc'>('all');
  const [mcuFilter, setMcuFilter] = useState<'all' | SupportedMCU | 'stm32' | 'pic' | '8051'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredResources = useMemo(() => {
    return RESOURCES.filter((item: ResourceItem) => {
      const matchesType = filterType === 'all' || item.type === filterType;
      const matchesMCU = mcuFilter === 'all' || item.mcuCategory === 'all' || item.mcuCategory === mcuFilter;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.tag.toLowerCase().includes(q) ||
        item.features.some((f) => f.toLowerCase().includes(q));

      return matchesType && matchesMCU && matchesSearch;
    });
  }, [filterType, mcuFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Intro Box */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
              <BookOpen className="w-3.5 h-3.5" /> Curated Open Source & Engineering Media
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              ATmega640 / ATmega128 / ATmega328P 오픈소스 & YouTube 강좌 허브
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              검증된 부트로더(MegaCore, MiniCore, Optiboot), 베어메탈 드라이버 컬렉션,
              12V HVPP 퓨즈 복구 하드웨어 및 레지스터 직접 제어 핵심 비디오 강좌를 즉시 열람할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      {/* Peripheral Resource Librarian Component */}
      <PeripheralResourceLibrarian selectedMCU={selectedMCU} />

      {/* Makefile Generator (Compiler Flags -Os/-ffunction-sections, Target F_CPU, MCU & avrdude skeleton) */}
      <MakefileGenerator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* I/O Pin Protection Designer (Series Resistor, Pull-up/down, Flyback Diode & TVS Clamping) */}
      <IoPinProtectionDesigner selectedMCU={selectedMCU} />

      {/* Compiler Output Size Profiler (.map file parser & donut chart segment visualizer) */}
      <CompilerOutputSizeProfiler selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Build Time Performance Analyzer (Compiler Flags Optimization & LTO Impact Trade-off) */}
      <BuildTimePerformanceAnalyzer selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* External Interrupt (EICRA/EIMSK) Tutorial & Safe ISR Writing Guide */}
      <ExternalInterruptTutorial selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Bit-banging Protocol Timing Calculator (Microsecond Delays & NOP Assembly Generator) */}
      <BitBangTimingCalculator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* AVR Power Consumption Simulator (Clock, Vcc, Peripherals Checklist & mA Calculator) */}
      <AvrPowerConsumptionSimulator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Compiler Optimization Report Generator (Data/BSS/Stack, Struct Memory Alignment & Padding Gaps) */}
      <CompilerOptimizationReportGenerator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* AVR Stack/Heap Collision Analyzer (Map Section & Call Tree Depth Profiler) */}
      <AvrStackHeapCollisionAnalyzer selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Build Artifact Dependency Visualizer (.map Archive Member Inclusion & Bloat Eliminator) */}
      <BuildArtifactDependencyVisualizer selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Memory Fragmentation Analyzer (BSS & Data Alignment Padding & Struct Reordering Refactor) */}
      <MemoryFragmentationAnalyzer selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Power Scenario Planner (Timeline State Transitions, Charge Per Interval & Battery Life) */}
      <PowerScenarioPlanner selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* AVR MPU Protection Simulator (Memory Zones, Lock Bits & Segment Violations) */}
      <AvrMpuProtectionSimulator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Dynamic Memory Allocation (malloc/free) Tracker & Heap Fragmentation Analyzer */}
      <DynamicMemoryAllocationTracker selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* AVR Interrupt Latency Analyzer (Context Switching Overhead & Stack Overflow Guide) */}
      <AvrInterruptLatencyAnalyzer selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* AVR Communication Protocol Frame Analyzer (UART, SPI, I2C Timing & Error Diagnostics) */}
      <CommunicationProtocolFrameAnalyzer selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* AVR Watchdog Timer (WDT) Tuning Guide & Reset Prevention C Code Generator */}
      <AvrWatchdogTuningGuide selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* AVR Instruction Execution Time & Cycle Profiler (Bottleneck Analysis & Optimization Advisor) */}
      <InstructionExecutionTimeProfiler selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* AVR Low-Power Mode Battery Life Calculator & Standby Transition Optimizer */}
      <AvrLowPowerBatteryLifeCalculator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          {/* MCU Target Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
              <Cpu className="w-3.5 h-3.5 text-amber-400" /> MCU 필터:
            </span>
            <button
              onClick={() => setMcuFilter('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all border ${
                mcuFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              전체 MCU
            </button>
            <button
              onClick={() => setMcuFilter('atmega640')}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all border ${
                mcuFilter === 'atmega640'
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              ATmega640 전용
            </button>
            <button
              onClick={() => setMcuFilter('atmega128')}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all border ${
                mcuFilter === 'atmega128'
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              ATmega128 전용
            </button>
            <button
              onClick={() => setMcuFilter('atmega328p')}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all border ${
                mcuFilter === 'atmega328p'
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              ATmega328P 전용
            </button>
            <button
              onClick={() => setMcuFilter('stm32')}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all border ${
                mcuFilter === 'stm32'
                  ? 'bg-blue-500 text-white font-bold border-blue-400 shadow-md shadow-blue-500/20'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-blue-300'
              }`}
            >
              STM32
            </button>
            <button
              onClick={() => setMcuFilter('pic')}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all border ${
                mcuFilter === 'pic'
                  ? 'bg-rose-500 text-white font-bold border-rose-400 shadow-md shadow-rose-500/20'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-rose-300'
              }`}
            >
              PIC
            </button>
            <button
              onClick={() => setMcuFilter('8051')}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all border ${
                mcuFilter === '8051'
                  ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-emerald-300'
              }`}
            >
              8051
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="키워드 검색 (Optiboot, MiniCore, I2C, M103C...)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Media type toggle */}
        <div className="flex gap-2 pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all border ${
              filterType === 'all'
                ? 'bg-slate-800 text-white border-slate-700'
                : 'bg-slate-950 text-slate-500 border-slate-900 hover:text-slate-300'
            }`}
          >
            전체 형식
          </button>
          <button
            onClick={() => setFilterType('github')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all border ${
              filterType === 'github'
                ? 'bg-slate-800 text-amber-300 border-slate-700'
                : 'bg-slate-950 text-slate-500 border-slate-900 hover:text-slate-300'
            }`}
          >
            <Github className="w-3.5 h-3.5" /> GitHub 저장소만
          </button>
          <button
            onClick={() => setFilterType('youtube')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all border ${
              filterType === 'youtube'
                ? 'bg-rose-950 text-rose-300 border-rose-800'
                : 'bg-slate-950 text-slate-500 border-slate-900 hover:text-slate-300'
            }`}
          >
            <Youtube className="w-3.5 h-3.5" /> YouTube 영상만
          </button>
        </div>
      </div>

      {/* Resource Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredResources.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
            검색 조건과 일치하는 오픈소스 및 영상 리소스가 없습니다.
          </div>
        ) : (
          filteredResources.map((item) => {
            const isGithub = item.type === 'github';

            return (
              <div
                key={item.id}
                className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 backdrop-blur shadow-lg flex flex-col justify-between transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                        item.type === 'github'
                          ? 'bg-slate-800 text-amber-300 border-slate-700'
                          : item.type === 'doc'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}
                    >
                      {item.type === 'github' && <Github className="w-3 h-3" />}
                      {item.type === 'doc' && <BookOpen className="w-3 h-3" />}
                      {item.type === 'youtube' && <Youtube className="w-3 h-3" />}
                      {item.badge}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 font-mono">
                      {item.type === 'github' && <Star className="w-3 h-3 text-amber-400" />}
                      {item.type === 'doc' && <BookOpen className="w-3 h-3 text-blue-400" />}
                      {item.type === 'youtube' && <Clock className="w-3 h-3 text-rose-400" />}
                      {item.starsOrDuration}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                      {item.title}
                    </h3>
                    <span className="text-xs text-amber-400/90 font-medium">{item.tag}</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>

                  <div className="space-y-1 pt-1 border-t border-slate-800/80">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">핵심 강점 & 지원 항목:</span>
                    <div className="grid grid-cols-1 gap-1">
                      {item.features.map((f, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800/80">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition-all shadow-md ${
                      isGithub
                        ? 'bg-slate-800 hover:bg-slate-700 text-white'
                        : 'bg-rose-600 hover:bg-rose-500 text-white'
                    }`}
                  >
                    {isGithub ? '📦 GitHub 저장소 소스 바로가기' : '🎬 YouTube 비디오 강좌 시청하기'}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
