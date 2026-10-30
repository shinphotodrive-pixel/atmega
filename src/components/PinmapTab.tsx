import React, { useState, useMemo } from 'react';
import { MCU_PROFILES, SupportedMCU, PinDefinition } from '../data/pinmapData';
import { Search, Compass, Cpu, Layers, ExternalLink, Filter } from 'lucide-react';
import { PinMultiplexingConflictChecker } from './PinMultiplexingConflictChecker';
import { GpioSignalLogicSimulator } from './GpioSignalLogicSimulator';
import { PinoutDiagramViewer } from './PinoutDiagramViewer';
import { RecommendedHardwareSchematicViewer } from './RecommendedHardwareSchematicViewer';
import { PinMultiplexingSimulator } from './PinMultiplexingSimulator';
import { GpioVoltageDropCalculator } from './GpioVoltageDropCalculator';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU: (mcu: SupportedMCU) => void;
}

export const PinmapTab: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const portKeys = Object.keys(currentProfile.ports);

  const [selectedPortKey, setSelectedPortKey] = useState<string>(() => {
    return portKeys.includes('PORTB') ? 'PORTB' : portKeys[0];
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Handle port reset if selected MCU changes and current port key doesn't exist
  React.useEffect(() => {
    if (!currentProfile.ports[selectedPortKey]) {
      setSelectedPortKey(Object.keys(currentProfile.ports)[0]);
    }
  }, [selectedMCU, currentProfile, selectedPortKey]);

  const categories = [
    { id: 'all', label: '전체' },
    { id: 'comm', label: '통신 (UART/SPI/I2C)' },
    { id: 'timer', label: '타이머 / PWM' },
    { id: 'analog', label: 'ADC / 비교기' },
    { id: 'memory', label: '외부 메모리' },
    { id: 'interrupt', label: '외부 인터럽트' },
    { id: 'gpio', label: '범용 GPIO' },
  ];

  const currentPort = currentProfile.ports[selectedPortKey] || Object.values(currentProfile.ports)[0];

  // Filtering
  const displayedPins = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    // If no query and 'all' category, just return the current port's pins
    if (!q && selectedCategory === 'all') {
      return currentPort.pins;
    }

    // Search across all ports of the CURRENT selected MCU:
    let allPins: (PinDefinition & { portName: string })[] = [];
    Object.entries(currentProfile.ports).forEach(([pName, pInfo]) => {
      pInfo.pins.forEach((pin) => {
        allPins.push({ ...pin, portName: pName });
      });
    });

    return allPins.filter((pin) => {
      const matchesCategory = selectedCategory === 'all' || pin.category === selectedCategory;
      const matchesSearch =
        !q ||
        pin.pin.toLowerCase().includes(q) ||
        pin.name.toLowerCase().includes(q) ||
        pin.alt.toLowerCase().includes(q) ||
        pin.reg.toLowerCase().includes(q) ||
        pin.arduino.toLowerCase().includes(q) ||
        pin.desc.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [selectedPortKey, searchQuery, selectedCategory, currentPort, currentProfile]);

  const isCrossPortSearch = searchQuery.trim().length > 0 || selectedCategory !== 'all';

  const handleNavigateToPin = (pinName: string) => {
    // Determine which port this pin belongs to
    for (const [pName, pInfo] of Object.entries(currentProfile.ports)) {
      if (pInfo.pins.some((p) => p.pin === pinName)) {
        setSelectedPortKey(pName);
        setSearchQuery(pinName);
        setSelectedCategory('all');
        // Scroll to pin table smoothly
        const el = document.getElementById('pin-table-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
        break;
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* MCU Switcher at the top of the Pinmap tab */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 backdrop-blur shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            핀맵 대상 MCU 전환 (Target MCU)
          </span>
          <div className="flex flex-wrap gap-2">
            {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
              <button
                key={mcuId}
                onClick={() => {
                  onSelectMCU(mcuId);
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                  selectedMCU === mcuId
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white'
                }`}
              >
                {MCU_PROFILES[mcuId].name} ({MCU_PROFILES[mcuId].package.split(' ')[0]})
              </button>
            ))}
          </div>
        </div>

        <div className="text-right text-xs">
          <span className="text-slate-400 block font-mono">패키지 & I/O 규모</span>
          <span className="font-bold text-amber-400 font-mono text-sm">
            {currentProfile.package} • {currentProfile.io}개 I/O ({portKeys.length}개 포트 그룹)
          </span>
        </div>
      </div>

      {/* Header Info */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-2">
              <Compass className="w-3.5 h-3.5" /> {currentProfile.name} Physical Pinout & Port Map
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              {currentProfile.name} 하드웨어 핀맵 & 포트(Port) 인터랙티브 탐색기
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              {currentProfile.name}의 총 {currentProfile.io}개 I/O 라인({portKeys.join(', ')})의 물리적 핀 번호, 대체 기능(Alternate Functions),
              제어 레지스터(DDRx, PORTx, PINx), 아두이노 보드 매핑 정보를 실시간 검색하고 필터링하세요.
            </p>
          </div>
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center gap-3 shrink-0">
            <Cpu className="w-8 h-8 text-amber-400" />
            <div>
              <div className="text-[11px] text-slate-400">총 범용 I/O</div>
              <div className="text-base font-bold text-white">{currentProfile.io}개 핀</div>
            </div>
          </div>
        </div>

        {/* ATmega128 Specific ISP Warning Callout */}
        {selectedMCU === 'atmega128' && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2">
            <span className="font-bold shrink-0">⚠️ ATmega128 ISP 배선 주의:</span>
            <span>
              ATmega128은 일반적인 AVR(PB2/PB3 MOSI/MISO)과 달리, ISP 다운로딩 데이터 선이 <strong>PE0 (Pin 2: PDI)</strong> 및 <strong>PE1 (Pin 3: PDO)</strong>에 연결되어야 합니다. SCK는 <strong>PB1 (Pin 11)</strong>입니다.
            </span>
          </div>
        )}
      </div>

      {/* Official Pighixxx Hardware Pinout Diagram Visualizer & Image Exporter (ATmega328P, ATmega128, ATmega640) */}
      <PinoutDiagramViewer
        selectedMCU={selectedMCU}
        onSelectMCU={onSelectMCU}
        onNavigateToPin={handleNavigateToPin}
      />

      {/* 권장 하드웨어 회로도 뷰어 (전원부 Vcc/AVcc/GND, 리셋 회로, 16MHz 크리스탈 표준 결선도) */}
      <div id="recommended-hardware-schematic-section" className="scroll-mt-20">
        <RecommendedHardwareSchematicViewer
          selectedMCU={selectedMCU}
          onSelectMCU={onSelectMCU}
          onNavigateToPin={handleNavigateToPin}
        />
      </div>

      {/* 핀 멀티플렉싱 시뮬레이터 (Pin Multiplexing Simulator: 대체 기능 하이라이트 & 실시간 SFR 레지스터 비트 매핑) */}
      <div id="pin-multiplexing-simulator-section" className="scroll-mt-20">
        <PinMultiplexingSimulator
          selectedMCU={selectedMCU}
          onSelectMCU={onSelectMCU}
          onNavigateToPin={handleNavigateToPin}
        />
      </div>

      {/* Pin Multiplexing Conflict Checker */}
      <PinMultiplexingConflictChecker
        selectedMCU={selectedMCU}
        onSelectMCU={onSelectMCU}
        onNavigateToPin={handleNavigateToPin}
      />

      {/* GPIO Signal Logic Simulator (Pull-up, Direction, Real-time Voltage & Toggle Controls) */}
      <GpioSignalLogicSimulator
        selectedMCU={selectedMCU}
        onSelectMCU={onSelectMCU}
        onNavigateToPin={handleNavigateToPin}
      />

      {/* GPIO 전압 강하(Voltage Drop) 계산기 & 핀 손상 위험도 시각화 */}
      <div id="gpio-voltage-drop-calculator-section" className="scroll-mt-20">
        <GpioVoltageDropCalculator
          selectedMCU={selectedMCU}
          onSelectMCU={onSelectMCU}
          onNavigateToPin={handleNavigateToPin}
        />
      </div>

      {/* Control Panel: Port Selector & Filters */}
      <div id="pin-table-section" className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-lg space-y-4">
        {/* Port Buttons */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" /> {currentProfile.name} 포트 선택 ({portKeys.length}개 그룹)
            </label>
            {isCrossPortSearch && (
              <span className="text-xs text-amber-400 font-medium">
                ⚡ 전체 포트 대상 검색/필터링 모드 활성화됨 ({displayedPins.length}개 핀 일치)
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {portKeys.map((portKey) => {
              const isSelected = selectedPortKey === portKey && !isCrossPortSearch;
              return (
                <button
                  key={portKey}
                  onClick={() => {
                    setSelectedPortKey(portKey);
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className={`px-3 py-1.5 text-xs font-mono rounded-xl transition-all border ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {portKey}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search and Category Filter */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-slate-800/80">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="핀 이름, 대체기능 검색 (예: SCL, RXD, PWM, ADC, PCINT...)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="md:col-span-7 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> 기능 필터:
            </span>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 text-[11px] rounded-lg transition-colors border ${
                  selectedCategory === cat.id
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Port Header */}
        {!isCrossPortSearch && (
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-amber-400 font-mono">{currentPort.name}</span>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                  {currentPort.width}비트 폭
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{currentPort.desc}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-right">
              <span className="text-[10px] text-slate-400 block font-mono">I/O SFR 레지스터 주소</span>
              <span className="text-xs font-mono font-bold text-cyan-400">{currentPort.registers}</span>
            </div>
          </div>
        )}

        {/* Pin Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">포트 & 핀명</th>
                <th className="px-3 py-3">물리 핀 번호</th>
                <th className="px-4 py-3">대체 기능 (Alternate Function)</th>
                <th className="px-4 py-3">관련 제어 레지스터</th>
                <th className="px-3 py-3">아두이노/보드 매핑</th>
                <th className="px-4 py-3">적용 설명 및 하드웨어 팁</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/50">
              {displayedPins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    검색 조건과 일치하는 핀이 없습니다. 다른 키워드로 검색해보세요.
                  </td>
                </tr>
              ) : (
                displayedPins.map((pin) => (
                  <tr key={pin.pin} className="hover:bg-slate-900/60 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-white">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        {pin.pin}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-cyan-400">
                      {pin.physicalPin ? `Pin ${pin.physicalPin}` : '-'}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <span className="inline-block px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                        {pin.alt}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">{pin.reg}</td>
                    <td className="px-3 py-3 font-mono font-bold text-emerald-400">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                        {pin.arduino}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 leading-relaxed">{pin.desc}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Framework Support Callout */}
      <div className="bg-gradient-to-r from-emerald-950/40 to-slate-900/60 border border-emerald-500/30 rounded-2xl p-6 backdrop-blur shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
            <Cpu className="w-5 h-5" /> {currentProfile.name} 권장 아두이노/컴파일러 코어
          </div>
          <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
            {selectedMCU === 'atmega640' &&
              'MCUdude MegaCore의 "AVR style 100-pin" 설정을 선택하면 86개 전체 I/O 핀이 1:1로 매핑됩니다.'}
            {selectedMCU === 'atmega128' &&
              'MCUdude MegaCore에서 "ATmega128"을 선택하면 M103C 퓨즈 자동 해제 및 PE0(PDI)/PE1(PDO) ISP 업로드를 직관적으로 지원합니다.'}
            {selectedMCU === 'atmega328p' &&
              '아두이노 우노(Arduino Uno) 기본 보드 설정 또는 MCUdude MiniCore를 사용하여 내부 8MHz RC 구동 및 BOD 설정을 최적화할 수 있습니다.'}
          </p>
        </div>
        <a
          href={
            selectedMCU === 'atmega328p'
              ? 'https://github.com/MCUdude/MiniCore'
              : 'https://github.com/MCUdude/MegaCore'
          }
          target="_blank"
          rel="noopener noreferrer"
          className="whitespace-nowrap inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-all shadow-md shadow-emerald-500/20"
        >
          {selectedMCU === 'atmega328p' ? 'MiniCore 저장소 열기' : 'MegaCore 저장소 열기'} <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
