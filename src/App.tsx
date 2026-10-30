import React, { useState } from 'react';
import { ArchitectureTab } from './components/ArchitectureTab';
import { ComparisonTab } from './components/ComparisonTab';
import { UniversalMcuComparisonTab } from './components/UniversalMcuComparisonTab';
import { PinmapTab } from './components/PinmapTab';
import { RegistersTab } from './components/RegistersTab';
import { InterruptsTab } from './components/InterruptsTab';
import { PowerAndFusesTab } from './components/PowerAndFusesTab';
import { MemoryMapTab } from './components/MemoryMapTab';
import { ResourcesTab } from './components/ResourcesTab';
import { ProgramTab } from './components/ProgramTab';
import { GlobalRegisterSearch } from './components/GlobalRegisterSearch';
import { Cpu, HardDrive, Share2, Radio, Layers, Gauge, Activity, Table, Download, Zap, PieChart } from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from './data/pinmapData';
import { GpioSignalParams, DEFAULT_GPIO_PARAMS } from './data/gpioSignalTypes';
import confetti from 'canvas-confetti';

export default function App() {
  const [selectedMCU, setSelectedMCU] = useState<SupportedMCU>('atmega640');
  const [activeTab, setActiveTab] = useState<'comparison' | 'universal_comp' | 'arch' | 'pinmap' | 'registers' | 'interrupts' | 'power' | 'memorymap' | 'resources' | 'program'>('comparison');
  const [copiedShare, setCopiedShare] = useState(false);

  // Virtual Oscilloscope & GPIO Toggling Shared Parameters
  const [gpioParamsMap, setGpioParamsMap] = useState<Record<SupportedMCU, GpioSignalParams>>(DEFAULT_GPIO_PARAMS);
  const [isOscilloscopeOpen, setIsOscilloscopeOpen] = useState<boolean>(true);

  const handleUpdateGpioParams = (newParams: Partial<GpioSignalParams>) => {
    setGpioParamsMap((prev) => ({
      ...prev,
      [selectedMCU]: {
        ...prev[selectedMCU],
        ...newParams
      }
    }));
  };

  const handleNavigateToOscilloscope = () => {
    setActiveTab('arch');
    setIsOscilloscopeOpen(true);
    setTimeout(() => {
      const el = document.getElementById('virtual-oscilloscope-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);
  };

  const currentProfile = MCU_PROFILES[selectedMCU];

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedShare(true);
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.1 }
    });
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const handleSelectMCUAndSwitchTab = (mcu: SupportedMCU) => {
    setSelectedMCU(mcu);
    setActiveTab('arch');
  };

  const handleNavigateToRegister = (registerName: string, bitName?: string) => {
    setActiveTab('registers');
    setTimeout(() => {
      const el = document.getElementById(`register-card-${registerName}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-amber-400', 'bg-amber-500/10');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-amber-400', 'bg-amber-500/10');
        }, 2500);
      }
    }, 150);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-black text-slate-950 text-lg shadow-md shadow-amber-500/20">
                AVR
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                    AVR 펌웨어 개발
                  </h1>
                </div>
              </div>
            </div>

            {/* MCU Quick Switcher in Header */}
            <div className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
              {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => {
                const isSelected = selectedMCU === mcuId;
                return (
                  <button
                    key={mcuId}
                    onClick={() => setSelectedMCU(mcuId)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {MCU_PROFILES[mcuId].name}
                  </button>
                );
              })}
            </div>

            {/* Global Register & Bit Search Bar */}
            <div className="hidden lg:block">
              <GlobalRegisterSearch
                selectedMCU={selectedMCU}
                onSelectMCU={setSelectedMCU}
                onNavigateToRegister={handleNavigateToRegister}
              />
            </div>

            {/* Share / Export */}
            <div className="flex items-center gap-2">
              <div className="lg:hidden">
                <GlobalRegisterSearch
                  selectedMCU={selectedMCU}
                  onSelectMCU={setSelectedMCU}
                  onNavigateToRegister={handleNavigateToRegister}
                />
              </div>
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition"
                title="가이드 URL 복사"
              >
                <Share2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">{copiedShare ? '복사됨!' : '공유하기'}</span>
              </button>
            </div>
          </div>

          {/* Navigation Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center py-2 border-t border-slate-800/80 gap-2">
            {/* Desktop Tabs */}
            <nav className="flex items-center gap-1 overflow-x-auto text-xs custom-scrollbar">
              <button
                onClick={() => setActiveTab('comparison')}
                className={`whitespace-nowrap px-3.5 py-1.5 font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'comparison'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                AVR 4종 사양 비교
              </button>
              <button
                onClick={() => setActiveTab('universal_comp')}
                className={`whitespace-nowrap px-3.5 py-1.5 font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'universal_comp'
                    ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                    : 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                AVR vs STM32·PIC·8051 비교
              </button>
              <button
                onClick={() => setActiveTab('arch')}
                className={`whitespace-nowrap px-3 py-1.5 font-semibold rounded-lg transition-all ${
                  activeTab === 'arch'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                아키텍처 분석
              </button>
              <button
                onClick={() => setActiveTab('pinmap')}
                className={`whitespace-nowrap px-3 py-1.5 font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'pinmap'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span>하드웨어 핀맵 & 핀아웃 다이어그램</span>
              </button>
              <button
                onClick={() => setActiveTab('registers')}
                className={`whitespace-nowrap px-3 py-1.5 font-semibold rounded-lg transition-all ${
                  activeTab === 'registers'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                SFR 레지스터 계산기
              </button>
              <button
                onClick={() => setActiveTab('interrupts')}
                className={`whitespace-nowrap px-3 py-1.5 font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'interrupts'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                인터럽트 (IVT & 충돌 디버거)
              </button>
              <button
                onClick={() => setActiveTab('power')}
                className={`whitespace-nowrap px-3 py-1.5 font-semibold rounded-lg transition-all ${
                  activeTab === 'power'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                전력/퓨즈/에라타
              </button>
              <button
                onClick={() => setActiveTab('memorymap')}
                className={`whitespace-nowrap px-3.5 py-1.5 font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'memorymap'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <PieChart className="w-3.5 h-3.5 text-cyan-400" />
                <span>메모리 맵 (Flash & SRAM)</span>
              </button>
              <button
                onClick={() => setActiveTab('program')}
                className={`whitespace-nowrap px-3.5 py-1.5 font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'program'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                프로그램 다운로드
              </button>
              <button
                onClick={() => setActiveTab('resources')}
                className={`whitespace-nowrap px-3 py-1.5 font-semibold rounded-lg transition-all ${
                  activeTab === 'resources'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                오픈소스 & 강좌 허브
              </button>
            </nav>

            {/* Mobile MCU toggle */}
            <div className="flex md:hidden items-center justify-between gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto">
              <span className="text-[10px] text-slate-500 pl-1 font-mono shrink-0">타겟 MCU:</span>
              {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
                <button
                  key={mcuId}
                  onClick={() => setSelectedMCU(mcuId)}
                  className={`px-2 py-1 text-[11px] font-bold rounded-lg transition whitespace-nowrap ${
                    selectedMCU === mcuId ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400'
                  }`}
                >
                  {MCU_PROFILES[mcuId].name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Dynamic KPI Summary Header for Current Target MCU */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 backdrop-blur shadow-sm">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              <span>플래시 메모리</span>
            </div>
            <div className="text-xl font-black text-white font-mono">{currentProfile.flash} KB</div>
            <div className="text-[10px] text-amber-400/90 font-medium mt-0.5">10,000 W/E Cycles</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 backdrop-blur shadow-sm">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>내부 SRAM</span>
            </div>
            <div className="text-xl font-black text-white font-mono">{currentProfile.sram} KB</div>
            <div className="text-[10px] text-cyan-400/90 font-medium mt-0.5">
              EEPROM: {currentProfile.eeprom}KB
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 backdrop-blur shadow-sm">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>범용 I/O 핀</span>
            </div>
            <div className="text-xl font-black text-white font-mono">{currentProfile.io} 개</div>
            <div className="text-[10px] text-emerald-400/90 font-medium mt-0.5">
              {currentProfile.package.split(' ')[0]}
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 backdrop-blur shadow-sm">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
              <Radio className="w-3.5 h-3.5 text-indigo-400" />
              <span>USART 통신</span>
            </div>
            <div className="text-xl font-black text-white font-mono">{currentProfile.usart} 채널</div>
            <div className="text-[10px] text-indigo-400/90 font-medium mt-0.5">Full Duplex 지원</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 backdrop-blur shadow-sm">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
              <Activity className="w-3.5 h-3.5 text-rose-400" />
              <span>PWM 채널</span>
            </div>
            <div className="text-xl font-black text-white font-mono">{currentProfile.pwm} 채널</div>
            <div className="text-[10px] text-rose-400/90 font-medium mt-0.5">하드웨어 타이머 연동</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 backdrop-blur shadow-sm">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
              <span>10비트 ADC</span>
            </div>
            <div className="text-xl font-black text-white font-mono">{currentProfile.adc} 채널</div>
            <div className="text-[10px] text-amber-400/90 font-medium mt-0.5">
              {currentProfile.name} 아날로그
            </div>
          </div>
        </section>

        {/* Tab Router */}
        {activeTab === 'comparison' && (
          <ComparisonTab
            onSelectMCU={handleSelectMCUAndSwitchTab}
            onSwitchToUniversal={() => setActiveTab('universal_comp')}
          />
        )}
        {activeTab === 'universal_comp' && (
          <UniversalMcuComparisonTab onSelectMCU={handleSelectMCUAndSwitchTab} />
        )}
        {activeTab === 'arch' && (
          <ArchitectureTab
            selectedMCU={selectedMCU}
            onSelectMCU={setSelectedMCU}
            gpioParams={gpioParamsMap[selectedMCU]}
            onUpdateGpioParams={handleUpdateGpioParams}
            isOscilloscopeOpen={isOscilloscopeOpen}
            onToggleOscilloscope={setIsOscilloscopeOpen}
          />
        )}
        {activeTab === 'pinmap' && (
          <PinmapTab selectedMCU={selectedMCU} onSelectMCU={setSelectedMCU} />
        )}
        {activeTab === 'registers' && (
          <RegistersTab
            selectedMCU={selectedMCU}
            onSelectMCU={setSelectedMCU}
            gpioParams={gpioParamsMap[selectedMCU]}
            onUpdateGpioParams={handleUpdateGpioParams}
            onNavigateToOscilloscope={handleNavigateToOscilloscope}
          />
        )}
        {activeTab === 'interrupts' && (
          <InterruptsTab selectedMCU={selectedMCU} onSelectMCU={setSelectedMCU} />
        )}
        {activeTab === 'power' && (
          <PowerAndFusesTab selectedMCU={selectedMCU} onSelectMCU={setSelectedMCU} />
        )}
        {activeTab === 'memorymap' && (
          <MemoryMapTab selectedMCU={selectedMCU} onSelectMCU={setSelectedMCU} />
        )}
        {activeTab === 'resources' && (
          <ResourcesTab selectedMCU={selectedMCU} onSelectMCU={setSelectedMCU} />
        )}
        {activeTab === 'program' && (
          <ProgramTab selectedMCU={selectedMCU} onSelectMCU={setSelectedMCU} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800/80 py-8 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <div className="font-bold text-slate-300">
              AVR Microcontroller Firmware Optimization & Architecture Reference
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              ATmega640 (100-pin TQFP) • ATmega128 (64-pin TQFP) • ATmega328P (28-pin DIP / 32-pin TQFP)
            </p>
          </div>
          <div className="text-right text-[11px] text-slate-500">
            <span>MegaCore / MiniCore / Optiboot Bare-metal Engineering Suite</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
