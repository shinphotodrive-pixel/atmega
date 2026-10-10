import React, { useState, useMemo } from 'react';
import JSZip from 'jszip';
import {
  PERIPHERAL_DRIVERS,
  PeripheralDriver,
  generateMakefileForDrivers,
  generateCMakeListsForDrivers,
  generateCombinedMain
} from '../data/peripheralLibraryData';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  BookOpen,
  Search,
  Download,
  Copy,
  Check,
  FileCode,
  Layers,
  Cpu,
  Zap,
  ShieldCheck,
  Archive,
  Terminal,
  Activity,
  Code2,
  ChevronRight,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
  ExternalLink,
  PackageCheck
} from 'lucide-react';

interface Props {
  selectedMCU: SupportedMCU;
}

export const PeripheralResourceLibrarian: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedParadigm, setSelectedParadigm] = useState<string>('all');
  const [selectedLicense, setSelectedLicense] = useState<string>('all');

  // Selected driver for code inspection
  const [activeDriverId, setActiveDriverId] = useState<string>(PERIPHERAL_DRIVERS[0].id);

  // Active view tab inside code inspector: 'header' | 'source' | 'example' | 'makefile' | 'cmake' | 'api'
  const [codeTab, setCodeTab] = useState<'header' | 'source' | 'example' | 'makefile' | 'cmake' | 'api'>('header');

  // Multi-selection for batch export
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([
    PERIPHERAL_DRIVERS[0].id,
    PERIPHERAL_DRIVERS[1].id,
    PERIPHERAL_DRIVERS[2].id
  ]);

  // UI status feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Filtered driver list
  const filteredDrivers = useMemo(() => {
    return PERIPHERAL_DRIVERS.filter((driver) => {
      // MCU compatibility check
      if (!driver.supportedMcus.includes(selectedMCU)) return false;

      // Category filter
      if (selectedCategory !== 'all' && driver.category !== selectedCategory) return false;

      // Paradigm filter
      if (selectedParadigm !== 'all' && driver.paradigm !== selectedParadigm) return false;

      // License filter
      if (selectedLicense !== 'all' && driver.license !== selectedLicense) return false;

      // Search query
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      const matchesName = driver.name.toLowerCase().includes(q);
      const matchesFiles =
        driver.headerFileName.toLowerCase().includes(q) || driver.sourceFileName.toLowerCase().includes(q);
      const matchesDesc = driver.shortDesc.toLowerCase().includes(q);
      const matchesRegisters = driver.registersUsed.some((r) => r.toLowerCase().includes(q));
      const matchesApi = driver.apiFunctions.some(
        (fn) => fn.name.toLowerCase().includes(q) || fn.desc.toLowerCase().includes(q)
      );
      const matchesFeatures = driver.features.some((f) => f.toLowerCase().includes(q));

      return matchesName || matchesFiles || matchesDesc || matchesRegisters || matchesApi || matchesFeatures;
    });
  }, [selectedMCU, selectedCategory, selectedParadigm, selectedLicense, searchQuery]);

  // Active driver object
  const activeDriver = useMemo(() => {
    return PERIPHERAL_DRIVERS.find((d) => d.id === activeDriverId) || filteredDrivers[0] || PERIPHERAL_DRIVERS[0];
  }, [activeDriverId, filteredDrivers]);

  // Drivers currently checked for batch export
  const driversToExport = useMemo(() => {
    return PERIPHERAL_DRIVERS.filter(
      (d) => selectedDriverIds.includes(d.id) && d.supportedMcus.includes(selectedMCU)
    );
  }, [selectedDriverIds, selectedMCU]);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  // Single file download
  const handleDownloadSingleFile = (fileName: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Toggle batch select item
  const toggleSelectDriver = (id: string) => {
    setSelectedDriverIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const allCompatibleIds = PERIPHERAL_DRIVERS.filter((d) => d.supportedMcus.includes(selectedMCU)).map(
      (d) => d.id
    );
    setSelectedDriverIds(allCompatibleIds);
  };

  const handleDeselectAll = () => {
    setSelectedDriverIds([]);
  };

  // Batch Export ZIP bundle
  const handleExportZip = async (exportAll: boolean = false) => {
    try {
      setIsExportingZip(true);
      const drivers = exportAll
        ? PERIPHERAL_DRIVERS.filter((d) => d.supportedMcus.includes(selectedMCU))
        : driversToExport;

      if (drivers.length === 0) {
        setExportNotice('선택된 드라이버가 없습니다. 체크박스를 선택해 주세요.');
        setTimeout(() => setExportNotice(null), 3000);
        setIsExportingZip(false);
        return;
      }

      const zip = new JSZip();

      // Create include directory
      const includeFolder = zip.folder('include');
      const srcFolder = zip.folder('src');

      drivers.forEach((driver) => {
        includeFolder?.file(driver.headerFileName, driver.headerCode(selectedMCU));
        srcFolder?.file(driver.sourceFileName, driver.sourceCode(selectedMCU));
      });

      // Add main.c
      zip.file('src/main.c', generateCombinedMain(selectedMCU, drivers));

      // Add Makefile
      zip.file('Makefile', generateMakefileForDrivers(selectedMCU, drivers));

      // Add CMakeLists.txt
      zip.file('CMakeLists.txt', generateCMakeListsForDrivers(selectedMCU, drivers));

      // Add README.md
      const readmeContent = `# ${currentProfile.name} Bare-Metal Peripheral Drivers
Generated on ${new Date().toISOString().slice(0, 10)} by Peripheral Resource Librarian

Target Microcontroller: ${currentProfile.name} (${currentProfile.fullName})
Clock Frequency (F_CPU): 16.0 MHz
Build System: GNU Make / avr-gcc / CMake

## 📦 Bundled Peripheral Drivers (${drivers.length})
${drivers
  .map(
    (d, i) =>
      `${i + 1}. **${d.name}**
   - Header: \`include/${d.headerFileName}\`
   - Source: \`src/${d.sourceFileName}\`
   - Paradigm: ${d.paradigm}
   - License: ${d.license}
   - Registers Used: ${d.registersUsed.join(', ')}
   - Memory Impact: ~${d.flashBytes} bytes Flash, ~${d.sramBytes} bytes SRAM`
  )
  .join('\n\n')}

## 🚀 How to Build & Flash

### Using GNU Make:
\`\`\`bash
# 1. Compile firmware
make

# 2. Inspect memory footprint
make print_size

# 3. Flash to target MCU via avrdude (adjust PORT in Makefile if needed)
make flash
\`\`\`

### Using CMake:
\`\`\`bash
mkdir build && cd build
cmake ..
cmake --build .
\`\`\`

---
Generated by Google AI Studio MCU Engineering Dashboard.
`;
      zip.file('README.md', readmeContent);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedMCU}_peripheral_drivers_bundle.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportNotice(
        `성공적으로 ${drivers.length}개 드라이버 패키지 (${selectedMCU.toUpperCase()})가 ZIP으로 다운로드되었습니다!`
      );
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err) {
      console.error(err);
      setExportNotice('ZIP 생성 중 오류가 발생했습니다.');
      setTimeout(() => setExportNotice(null), 4000);
    } finally {
      setIsExportingZip(false);
    }
  };

  // Determine active code content based on current tab
  const getActiveCode = () => {
    switch (codeTab) {
      case 'header':
        return {
          fileName: activeDriver.headerFileName,
          content: activeDriver.headerCode(selectedMCU),
          lang: 'c'
        };
      case 'source':
        return {
          fileName: activeDriver.sourceFileName,
          content: activeDriver.sourceCode(selectedMCU),
          lang: 'c'
        };
      case 'example':
        return {
          fileName: 'main_example.c',
          content: activeDriver.exampleUsage(selectedMCU),
          lang: 'c'
        };
      case 'makefile':
        return {
          fileName: 'Makefile',
          content: generateMakefileForDrivers(selectedMCU, [activeDriver]),
          lang: 'makefile'
        };
      case 'cmake':
        return {
          fileName: 'CMakeLists.txt',
          content: generateCMakeListsForDrivers(selectedMCU, [activeDriver]),
          lang: 'cmake'
        };
      default:
        return {
          fileName: activeDriver.headerFileName,
          content: activeDriver.headerCode(selectedMCU),
          lang: 'c'
        };
    }
  };

  const activeCodeData = getActiveCode();

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Component Title & MCU Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold mb-1">
            <BookOpen className="w-4 h-4" />
            <span>Bare-Metal Peripheral Resource Librarian</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-slate-400 font-mono">AVR-GCC / C99 / C++ Ready</span>
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <span>주변장치 드라이버 라이브러리 및 C 헤더 익스포터</span>
            <span className="text-xs px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono">
              {currentProfile.name} 맞춤 최적화
            </span>
          </h3>
          <p className="text-xs md:text-sm text-slate-400 mt-1.5 leading-relaxed max-w-4xl">
            {currentProfile.name}의 하드웨어 주변장치(UART, 16비트 타이머 PWM, I2C/TWI, SPI, 10비트 ADC, EEPROM, WDT)를
            레지스터 단위로 직접 구동하는 고품질 오픈소스 C 헤더(`.h`) 및 구현(`.c`) 드라이버를 검색하고,
            선택한 드라이버들을 Makefile 및 통합 `main.c`와 함께 즉시 ZIP 번들로 내보낼 수 있습니다.
          </p>
        </div>

        {/* Global Batch Export Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => handleExportZip(false)}
            disabled={isExportingZip || driversToExport.length === 0}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all shadow-md ${
              driversToExport.length > 0 && !isExportingZip
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border border-amber-400 shadow-amber-500/20'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>선택한 {driversToExport.length}개 드라이버 ZIP 내보내기</span>
          </button>

          <button
            onClick={() => handleExportZip(true)}
            disabled={isExportingZip}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all hover:text-white"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>전체 {filteredDrivers.length}종 일괄 내보내기</span>
          </button>
        </div>
      </div>

      {/* Export notification toast */}
      {exportNotice && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-700/60 rounded-xl text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportNotice}</span>
          </div>
          <button
            onClick={() => setExportNotice(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs ml-4"
          >
            닫기
          </button>
        </div>
      )}

      {/* Search & Category Filter Controls */}
      <div className="space-y-3 p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="드라이버, 함수명(uart_init, twi_write), 레지스터(UBRRn, TCCR1A) 검색..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Select Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-400">선택 ({driversToExport.length}/{filteredDrivers.length}):</span>
            <button
              onClick={handleSelectAll}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              전체 선택
            </button>
            <button
              onClick={handleDeselectAll}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 transition-colors"
            >
              선택 해제
            </button>
          </div>
        </div>

        {/* Category Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/60">
          <span className="text-xs text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-amber-400" /> 주변장치:
          </span>
          {[
            { id: 'all', label: '전체 보기' },
            { id: 'uart', label: 'UART / 통신' },
            { id: 'timer', label: '타이머 / PWM' },
            { id: 'i2c', label: 'I2C / TWI' },
            { id: 'spi', label: 'SPI 버스' },
            { id: 'adc', label: 'ADC / 아날로그' },
            { id: 'eeprom', label: 'EEPROM' },
            { id: 'power', label: 'WDT / 절전' },
            { id: 'interrupt', label: '외부 인터럽트' },
            { id: 'sensor', label: '센서 / RTC' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all border ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Paradigm & License Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400">구현 아키텍처:</span>
            {['all', 'Bare-Metal', 'ISR Ring-Buffer', 'Defensive / Safe', 'Modular HAL'].map((p) => (
              <button
                key={p}
                onClick={() => setSelectedParadigm(p)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  selectedParadigm === p
                    ? 'bg-slate-700 text-amber-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p === 'all' ? '전체 패러다임' : p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">오픈소스 라이선스:</span>
            {['all', 'MIT', 'BSD-3-Clause', 'Apache-2.0'].map((lic) => (
              <button
                key={lic}
                onClick={() => setSelectedLicense(lic)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  selectedLicense === lic
                    ? 'bg-slate-700 text-emerald-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lic === 'all' ? '전체 라이선스' : lic}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout: Driver Selection Card List (Left) & Live Code Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Driver Catalog List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>사용 가능한 주변장치 드라이버 ({filteredDrivers.length}개)</span>
            <span>체크 시 ZIP 번들에 포함</span>
          </div>

          <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
            {filteredDrivers.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                검색 조건에 맞는 주변장치 드라이버가 없습니다.
              </div>
            ) : (
              filteredDrivers.map((driver) => {
                const isActive = activeDriver.id === driver.id;
                const isChecked = selectedDriverIds.includes(driver.id);

                return (
                  <div
                    key={driver.id}
                    onClick={() => setActiveDriverId(driver.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-2.5 relative group ${
                      isActive
                        ? 'bg-slate-800/90 border-amber-500/80 shadow-lg shadow-amber-500/5'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    {/* Top Row: Checkbox, Title, and Paradigm */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectDriver(driver.id);
                          }}
                          className="text-slate-400 hover:text-white transition-colors"
                          title={isChecked ? '번들 제외' : '번들 포함'}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                        <div>
                          <h4 className="text-xs md:text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                            {driver.name}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 mt-0.5">
                            <span className="text-amber-400/90">{driver.headerFileName}</span>
                            <span className="text-slate-600">/</span>
                            <span className="text-cyan-400/90">{driver.sourceFileName}</span>
                          </div>
                        </div>
                      </div>

                      <ChevronRight
                        className={`w-4 h-4 transition-transform shrink-0 ${
                          isActive ? 'text-amber-400 translate-x-1' : 'text-slate-600'
                        }`}
                      />
                    </div>

                    {/* Metadata line: No static pills, clean inline separators */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span className="text-amber-400/90">{driver.categoryLabel}</span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span>{driver.paradigm}</span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="font-mono text-emerald-400/90">{driver.license}</span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="font-mono text-slate-400">Flash ~{driver.flashBytes}B</span>
                    </div>

                    {/* Short Description */}
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {driver.shortDesc}
                    </p>

                    {/* Bottom quick actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                      <div className="flex items-center gap-1 text-slate-400">
                        <Cpu className="w-3 h-3 text-amber-400" />
                        <span className="font-mono truncate max-w-[180px]">
                          {driver.registersUsed.slice(0, 3).join(', ')}
                          {driver.registersUsed.length > 3 ? '…' : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-xs">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadSingleFile(driver.headerFileName, driver.headerCode(selectedMCU));
                          }}
                          className="px-2 py-0.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded transition-colors"
                          title="헤더(.h) 다운로드"
                        >
                          .h 받기
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadSingleFile(driver.sourceFileName, driver.sourceCode(selectedMCU));
                          }}
                          className="px-2 py-0.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded transition-colors"
                          title="소스(.c) 다운로드"
                        >
                          .c 받기
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Code Viewer, API Reference & Quick Inject (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Active Driver Card Header */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="text-amber-400 font-semibold">{activeDriver.categoryLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeDriver.paradigm}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-400">{activeDriver.license} License</span>
                </div>
                <h3 className="text-base md:text-lg font-bold text-white mt-0.5">
                  {activeDriver.name}
                </h3>
              </div>

              {/* Action buttons for active driver */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    handleCopy(activeCodeData.content, `${activeDriver.id}-${codeTab}`)
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                >
                  {copiedKey === `${activeDriver.id}-${codeTab}` ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">복사됨!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>코드 복사</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() =>
                    handleDownloadSingleFile(activeCodeData.fileName, activeCodeData.content)
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{activeCodeData.fileName} 다운로드</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-xs font-mono">
              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Flash 예상</span>
                <span className="text-amber-300 font-bold">~{activeDriver.flashBytes} Bytes</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">SRAM 점유</span>
                <span className="text-cyan-300 font-bold">~{activeDriver.sramBytes} Bytes</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">MCU 타깃</span>
                <span className="text-emerald-300 font-bold">{selectedMCU.toUpperCase()}</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">인터럽트 벡터</span>
                <span className="text-slate-300 font-bold truncate block">
                  {activeDriver.interruptVectors.length > 0
                    ? activeDriver.interruptVectors.join(', ')
                    : 'None (폴링)'}
                </span>
              </div>
            </div>

            {/* Registers used list */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-semibold text-[11px]">직접 제어 레지스터:</span>
              {activeDriver.registersUsed.map((reg) => (
                <span
                  key={reg}
                  className="font-mono text-[11px] text-amber-300/90 bg-amber-950/40 border border-amber-800/50 px-1.5 py-0.5 rounded"
                >
                  {reg}
                </span>
              ))}
            </div>
          </div>

          {/* Code Viewer Tabs (Header, Source, Example, Makefile, CMake, API) */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                onClick={() => setCodeTab('header')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                  codeTab === 'header'
                    ? 'bg-slate-800 text-amber-300 shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>{activeDriver.headerFileName}</span>
              </button>
              <button
                onClick={() => setCodeTab('source')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                  codeTab === 'source'
                    ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{activeDriver.sourceFileName}</span>
              </button>
              <button
                onClick={() => setCodeTab('example')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                  codeTab === 'example'
                    ? 'bg-slate-800 text-emerald-300 shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>main.c 예제</span>
              </button>
              <button
                onClick={() => setCodeTab('api')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                  codeTab === 'api'
                    ? 'bg-slate-800 text-purple-300 shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>API 레퍼런스</span>
              </button>
              <button
                onClick={() => setCodeTab('makefile')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  codeTab === 'makefile'
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Makefile
              </button>
              <button
                onClick={() => setCodeTab('cmake')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  codeTab === 'cmake'
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                CMake
              </button>
            </div>

            {/* Tab Content Display */}
            {codeTab === 'api' ? (
              /* API Function Reference Table */
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span>{activeDriver.name} 공개 API 목록 ({activeDriver.apiFunctions.length}개 함수)</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">헤더에 선언된 C99 함수</span>
                </div>

                <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
                  {activeDriver.apiFunctions.map((fn) => (
                    <div
                      key={fn.name}
                      className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-amber-300">{fn.name}()</span>
                        <span className="font-mono text-[11px] text-slate-400">반환: {fn.returns}</span>
                      </div>
                      <div className="p-2 bg-slate-950 rounded border border-slate-800/80 font-mono text-[11px] text-cyan-300 overflow-x-auto">
                        <code>{fn.signature}</code>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{fn.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Monospace Code Editor Box */
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner flex flex-col">
                <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
                    <span className="text-slate-200 font-semibold">{activeCodeData.fileName}</span>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <span>{activeCodeData.content.split('\n').length} lines</span>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <span>{activeCodeData.content.length} characters</span>
                  </div>
                  <button
                    onClick={() =>
                      handleCopy(activeCodeData.content, `${activeDriver.id}-${codeTab}`)
                    }
                    className="text-xs text-slate-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>클립보드 복사</span>
                  </button>
                </div>

                <div className="relative overflow-x-auto max-h-[520px] bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200 selection:bg-amber-500/30">
                  <pre className="overflow-x-auto">
                    <code>
                      {activeCodeData.content.split('\n').map((line, idx) => (
                        <div key={idx} className="flex hover:bg-slate-900/50 -mx-4 px-4 py-0.5">
                          <span className="w-9 shrink-0 text-slate-600 select-none text-right pr-4 text-[11px]">
                            {idx + 1}
                          </span>
                          <span className="whitespace-pre">{line}</span>
                        </div>
                      ))}
                    </code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
