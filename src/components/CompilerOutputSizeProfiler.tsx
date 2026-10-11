import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  PieChart,
  HardDrive,
  FileText,
  Search,
  Sparkles,
  Layers,
  ArrowRight,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  Cpu,
  Info,
  Terminal,
  Filter,
  BarChart2,
  Download
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export interface SymbolEntry {
  name: string;
  section: '.text' | '.data' | '.bss' | '.rodata' | '.eeprom';
  size: number; // in bytes
  address?: string;
  file?: string;
}

const SAMPLE_MAP_FILE = `Memory Configuration

Name             Origin             Length             Attributes
text             0x0000000000000000 0x0000000000008000 xr
data             0x0000000000800100 0x0000000000000800 rw !x
eeprom           0x0000000000810000 0x0000000000000400 rw !x

Linker script and memory map

.text           0x0000000000000000     0x1c80
 .text          0x0000000000000000       0x68 /usr/lib/avr/lib/avr5/crtatmega328p.o
                0x0000000000000000                __vectors
 .text.main     0x0000000000000068      0x1c4 build/main.o
                0x0000000000000068                main
 .text.uart_init
                0x000000000000022c       0x84 build/uart.o
                0x000000000000022c                uart_init
 .text.uart_transmit
                0x00000000000002b0       0x42 build/uart.o
                0x00000000000002b0                uart_transmit
 .text.timer0_init
                0x00000000000002f2       0x36 build/timer.o
                0x00000000000002f2                timer0_init
 .text.vfprintf_p
                0x0000000000000328      0x410 /usr/lib/avr/lib/avr5/libc.a(vfprintf_p.o)
                0x0000000000000328                vfprintf_P
 .text.display_update_buffer
                0x0000000000000738      0x5a2 build/oled_gui.o
                0x0000000000000738                display_update_buffer
 .text.font_lookup_table
                0x0000000000000cda      0x380 build/oled_gui.o
 .text.sensor_pid_calculate
                0x000000000000105a      0x270 build/motor_pid.o
                0x000000000000105a                sensor_pid_calculate
 .text.ring_buffer_pop
                0x00000000000012ca       0x48 build/ring_buffer.o
                0x00000000000012ca                ring_buffer_pop

.data           0x0000000000800100      0x140 load address 0x0000000000001c80
 .data.pid_gains
                0x0000000000800100       0x18 build/motor_pid.o
                0x0000000000800100                pid_gains
 .data.uart_rx_buffer
                0x0000000000800118       0x80 build/uart.o
                0x0000000000800118                uart_rx_buffer
 .data.system_config
                0x0000000000800198       0x40 build/main.o
                0x0000000000800198                system_config
 .data.state_machine_ctx
                0x00000000008001d8       0x68 build/main.o
                0x00000000008001d8                state_machine_ctx

.bss            0x0000000000800240      0x280
 .bss.display_framebuffer
                0x0000000000800240      0x200 build/oled_gui.o
                0x0000000000800240                display_framebuffer
 .bss.timer_ticks_ms
                0x0000000000800440        0x4 build/timer.o
                0x0000000000800440                timer_ticks_ms
 .bss.adc_raw_samples
                0x0000000000800444       0x40 build/adc.o
                0x0000000000800444                adc_raw_samples
 .bss.motor_encoder_steps
                0x0000000000800484        0x8 build/motor_pid.o
                0x0000000000800484                motor_encoder_steps
 .bss.debug_stats
                0x000000000080048c       0x34 build/main.o
                0x000000000080048c                debug_stats

OUTPUT(build/firmware.elf intel-hex)
`;

export const CompilerOutputSizeProfiler: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  const [inputMapText, setInputMapText] = useState<string>(SAMPLE_MAP_FILE);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [sectionFilter, setSectionFilter] = useState<'all' | '.text' | '.data' | '.bss'>('all');
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'symbols' | 'raw'>('overview');

  // Parse Map File / Build summary
  const parsedData = useMemo(() => {
    const text = inputMapText;
    const lines = text.split('\n');

    let totalText = 0;
    let totalData = 0;
    let totalBss = 0;

    const symbols: SymbolEntry[] = [];

    // Simple robust regex parsing for GNU ld map file format
    // e.g. " .text.display_update_buffer" followed by address and hex size
    // or line with " .text.func 0x00000000 0x123 file.o"
    let currentSection: '.text' | '.data' | '.bss' | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match main section starts
      if (line.match(/^\.text\s+0x[0-9a-fA-F]+\s+0x([0-9a-fA-F]+)/)) {
        currentSection = '.text';
        continue;
      }
      if (line.match(/^\.data\s+0x[0-9a-fA-F]+\s+0x([0-9a-fA-F]+)/)) {
        currentSection = '.data';
        continue;
      }
      if (line.match(/^\.bss\s+0x[0-9a-fA-F]+\s+0x([0-9a-fA-F]+)/)) {
        currentSection = '.bss';
        continue;
      }

      // Match subsection symbol entries:
      // Pattern 1 (single line): " .text.foo 0x000010 0x24 file.o"
      // Pattern 2 (two lines): " .text.foo" \n " 0x000010 0x24 file.o"
      const subMatch = line.match(/^\s+(\.text[^\s]*|\.data[^\s]*|\.bss[^\s]*|\.rodata[^\s]*)\s+(0x[0-9a-fA-F]+)\s+(0x[0-9a-fA-F]+)\s+(.*)$/);
      if (subMatch) {
        const fullSec = subMatch[1];
        const addr = subMatch[2];
        const sizeHex = subMatch[3];
        const file = subMatch[4];
        const size = parseInt(sizeHex, 16);

        if (size > 0) {
          let secType: '.text' | '.data' | '.bss' = '.text';
          if (fullSec.startsWith('.data')) secType = '.data';
          else if (fullSec.startsWith('.bss')) secType = '.bss';

          // Extract cleaner symbol name
          let symName = fullSec.replace(/^\.(text|data|bss)\.?/, '');
          if (!symName) symName = fullSec;

          symbols.push({
            name: symName,
            section: secType,
            size,
            address: addr,
            file: file.trim()
          });
        }
        continue;
      }

      // Handle split line format
      const splitHeaderMatch = line.match(/^\s+(\.text\.[a-zA-Z0-9_]+|\.data\.[a-zA-Z0-9_]+|\.bss\.[a-zA-Z0-9_]+)$/);
      if (splitHeaderMatch && i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const splitDataMatch = nextLine.match(/^\s+(0x[0-9a-fA-F]+)\s+(0x[0-9a-fA-F]+)\s+(.*)$/);
        if (splitDataMatch) {
          const fullSec = splitHeaderMatch[1];
          const addr = splitDataMatch[1];
          const sizeHex = splitDataMatch[2];
          const file = splitDataMatch[3];
          const size = parseInt(sizeHex, 16);

          if (size > 0) {
            let secType: '.text' | '.data' | '.bss' = '.text';
            if (fullSec.startsWith('.data')) secType = '.data';
            else if (fullSec.startsWith('.bss')) secType = '.bss';

            let symName = fullSec.replace(/^\.(text|data|bss)\.?/, '');
            if (!symName) symName = fullSec;

            symbols.push({
              name: symName,
              section: secType,
              size,
              address: addr,
              file: file.trim()
            });
            i++; // skip next line
          }
        }
      }
    }

    // If map file didn't match detailed subsections (e.g. avr-size summary pasted),
    // parse fallback "text data bss dec hex filename" format
    if (symbols.length === 0) {
      const summaryMatch = text.match(/([0-9]+)\s+([0-9]+)\s+([0-9]+)\s+([0-9]+)\s+([0-9a-fA-F]+)/);
      if (summaryMatch) {
        totalText = parseInt(summaryMatch[1], 10);
        totalData = parseInt(summaryMatch[2], 10);
        totalBss = parseInt(summaryMatch[3], 10);
      }
    } else {
      // Calculate totals from parsed symbols
      totalText = symbols.filter((s) => s.section === '.text').reduce((sum, s) => sum + s.size, 0);
      totalData = symbols.filter((s) => s.section === '.data').reduce((sum, s) => sum + s.size, 0);
      totalBss = symbols.filter((s) => s.section === '.bss').reduce((sum, s) => sum + s.size, 0);
    }

    // Sort symbols descending by size
    symbols.sort((a, b) => b.size - a.size);

    const totalFlash = totalText + totalData; // Flash ROM holds .text + initialized .data
    const totalSram = totalData + totalBss;   // SRAM holds .data + uninitialized .bss

    return {
      symbols,
      totalText,
      totalData,
      totalBss,
      totalFlash,
      totalSram
    };
  }, [inputMapText]);

  // Flash & SRAM limits for selected MCU
  const mcuLimits = useMemo(() => {
    switch (selectedMCU) {
      case 'atmega328p':
        return { flash: 32768, sram: 2048, eeprom: 1024 };
      case 'atmega128':
        return { flash: 131072, sram: 4096, eeprom: 4096 };
      case 'atmega640':
      default:
        return { flash: 65536, sram: 8192, eeprom: 4096 };
    }
  }, [selectedMCU]);

  const flashPercent = Math.min(100, (parsedData.totalFlash / mcuLimits.flash) * 100);
  const sramPercent = Math.min(100, (parsedData.totalSram / mcuLimits.sram) * 100);

  // Filtered symbols
  const filteredSymbols = useMemo(() => {
    return parsedData.symbols.filter((sym) => {
      const matchSection = sectionFilter === 'all' || sym.section === sectionFilter;
      const q = searchFilter.toLowerCase().trim();
      const matchSearch = !q || sym.name.toLowerCase().includes(q) || (sym.file && sym.file.toLowerCase().includes(q));
      return matchSection && matchSearch;
    });
  }, [parsedData.symbols, sectionFilter, searchFilter]);

  // Donut Chart SVG Calculation
  const donutData = useMemo(() => {
    const total = (parsedData.totalText + parsedData.totalData + parsedData.totalBss) || 1;
    const textShare = (parsedData.totalText / total);
    const dataShare = (parsedData.totalData / total);
    const bssShare = (parsedData.totalBss / total);

    const circumference = 2 * Math.PI * 40; // r=40
    const textStroke = textShare * circumference;
    const dataStroke = dataShare * circumference;
    const bssStroke = bssShare * circumference;

    return {
      textShare,
      dataShare,
      bssShare,
      textStroke,
      dataStroke,
      bssStroke,
      circumference
    };
  }, [parsedData]);

  const handleCopyReport = () => {
    const report = `// ==============================================================================
// AVR Firmware Memory Consumption Report (${currentProfile.name})
// ==============================================================================
- Target MCU      : ${currentProfile.fullName}
- Flash Memory    : ${parsedData.totalFlash} / ${mcuLimits.flash} bytes (${flashPercent.toFixed(1)}%)
- SRAM Data Space : ${parsedData.totalSram} / ${mcuLimits.sram} bytes (${sramPercent.toFixed(1)}%)
- .text (Code)    : ${parsedData.totalText} bytes
- .data (Init)    : ${parsedData.totalData} bytes
- .bss (Zero-init): ${parsedData.totalBss} bytes

[Top 10 Largest Memory Consumers]
${parsedData.symbols.slice(0, 10).map((s, idx) => `${idx + 1}. [${s.section}] ${s.name} - ${s.size} bytes (${s.file || 'internal'})`).join('\n')}
`;
    navigator.clipboard.writeText(report);
    setCopied(true);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.3 } });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Title Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <PieChart className="w-3.5 h-3.5" /> Compiler Output Size Profiler
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              Target: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-mono">
              GNU ld / avr-gcc .map 분석기
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            컴파일러 빌드 결과물 크기 프로파일러 (Compiler Output Size Profiler)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            빌드 후 생성된 <strong>.map 파일</strong> 또는 <code>avr-size</code> 요약 텍스트를 붙여넣으면
            <strong>.text(코드), .data(초기화 데이터), .bss(미초기화 데이터)</strong> 세그먼트의 분포를 도넛 차트로 시각화하고,
            플래시/SRAM 메모리를 과도하게 점유하는 함수와 대형 버퍼를 즉각 추적합니다.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setInputMapText(SAMPLE_MAP_FILE)}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition border border-slate-700 inline-flex items-center gap-1.5"
            title="기본 샘플 .map 파일 로드"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>샘플 복원</span>
          </button>
          <button
            onClick={handleCopyReport}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition shadow-lg shadow-cyan-500/20 inline-flex items-center gap-1.5"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? '분석 요약 복사됨' : '분석 보고서 복사'}</span>
          </button>
        </div>
      </div>

      {/* Main Analysis Section: Donut Chart & Memory Footprint Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Donut Chart & Legend (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-cyan-400" /> 세그먼트 분포 도넛 차트
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              총합 {parsedData.totalText + parsedData.totalData + parsedData.totalBss} Bytes
            </span>
          </div>

          {/* SVG Donut Chart */}
          <div className="relative flex items-center justify-center py-2">
            <svg viewBox="0 0 100 100" className="w-44 h-44 -rotate-90 transform">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-slate-900"
                strokeWidth="16"
                fill="transparent"
              />

              {/* .text slice (Cyan) */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#06b6d4" // cyan-500
                strokeWidth="16"
                fill="transparent"
                strokeDasharray={`${donutData.textStroke} ${donutData.circumference}`}
                strokeDashoffset="0"
                className="transition-all duration-700"
              />

              {/* .data slice (Amber) */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#f59e0b" // amber-500
                strokeWidth="16"
                fill="transparent"
                strokeDasharray={`${donutData.dataStroke} ${donutData.circumference}`}
                strokeDashoffset={`-${donutData.textStroke}`}
                className="transition-all duration-700"
              />

              {/* .bss slice (Purple) */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#a855f7" // purple-500
                strokeWidth="16"
                fill="transparent"
                strokeDasharray={`${donutData.bssStroke} ${donutData.circumference}`}
                strokeDashoffset={`-${donutData.textStroke + donutData.dataStroke}`}
                className="transition-all duration-700"
              />
            </svg>

            {/* Inner text inside donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] text-slate-400 font-mono">Flash ROM</span>
              <span className="text-base font-black text-white font-mono">
                {((parsedData.totalFlash / 1024)).toFixed(2)} KB
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">
                {flashPercent.toFixed(1)}% 점유
              </span>
            </div>
          </div>

          {/* Donut Legend */}
          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-cyan-500 shrink-0" />
                <span className="text-slate-300 font-bold">.text (Code / ROM)</span>
              </div>
              <div className="text-right">
                <span className="text-cyan-400 font-bold">{parsedData.totalText.toLocaleString()} B</span>
                <span className="text-slate-500 ml-1.5 text-[10px]">({(donutData.textShare * 100).toFixed(1)}%)</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                <span className="text-slate-300 font-bold">.data (Init Data)</span>
              </div>
              <div className="text-right">
                <span className="text-amber-400 font-bold">{parsedData.totalData.toLocaleString()} B</span>
                <span className="text-slate-500 ml-1.5 text-[10px]">({(donutData.dataShare * 100).toFixed(1)}%)</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-500 shrink-0" />
                <span className="text-slate-300 font-bold">.bss (Zero-init SRAM)</span>
              </div>
              <div className="text-right">
                <span className="text-purple-400 font-bold">{parsedData.totalBss.toLocaleString()} B</span>
                <span className="text-slate-500 ml-1.5 text-[10px]">({(donutData.bssShare * 100).toFixed(1)}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Target Hardware Memory Budget & Progress Bars (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-5 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-400" /> {currentProfile.fullName} 메모리 한계 대비 예산
            </span>
            <span className="text-[11px] font-mono text-emerald-400">
              {flashPercent > 90 ? '⚠️ 플래시 용량 임계치' : '✅ 안정적 여유 공간'}
            </span>
          </div>

          {/* Flash Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" /> Flash ROM 점유 (.text + .data):
              </span>
              <span className="font-bold text-cyan-300">
                {parsedData.totalFlash.toLocaleString()} / {mcuLimits.flash.toLocaleString()} Bytes ({flashPercent.toFixed(1)}%)
              </span>
            </div>
            <div className="h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-800 flex">
              <div
                className="bg-cyan-500 transition-all duration-700"
                style={{ width: `${(parsedData.totalText / mcuLimits.flash) * 100}%` }}
                title={`.text: ${parsedData.totalText}B`}
              />
              <div
                className="bg-amber-500 transition-all duration-700"
                style={{ width: `${(parsedData.totalData / mcuLimits.flash) * 100}%` }}
                title={`.data: ${parsedData.totalData}B`}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 B</span>
              <span>남은 여유 플래시: <strong className="text-emerald-400">{(mcuLimits.flash - parsedData.totalFlash).toLocaleString()} Bytes</strong></span>
              <span>{mcuLimits.flash / 1024} KB</span>
            </div>
          </div>

          {/* SRAM Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" /> SRAM 정적 데이터 점유 (.data + .bss):
              </span>
              <span className="font-bold text-purple-300">
                {parsedData.totalSram.toLocaleString()} / {mcuLimits.sram.toLocaleString()} Bytes ({sramPercent.toFixed(1)}%)
              </span>
            </div>
            <div className="h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-800 flex">
              <div
                className="bg-amber-500 transition-all duration-700"
                style={{ width: `${(parsedData.totalData / mcuLimits.sram) * 100}%` }}
                title={`.data: ${parsedData.totalData}B`}
              />
              <div
                className="bg-purple-500 transition-all duration-700"
                style={{ width: `${(parsedData.totalBss / mcuLimits.sram) * 100}%` }}
                title={`.bss: ${parsedData.totalBss}B`}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 B</span>
              <span>남은 스택/힙 동적 가용 공간: <strong className="text-emerald-400">{(mcuLimits.sram - parsedData.totalSram).toLocaleString()} Bytes</strong></span>
              <span>{mcuLimits.sram} B</span>
            </div>
          </div>

          {/* Memory Optimization Tips */}
          <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1">
            <div className="font-bold text-amber-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> 플래시 및 SRAM 절약 엔지니어링 팁:
            </div>
            <ul className="text-[11px] text-slate-400 space-y-0.5 list-disc list-inside font-sans">
              <li>문자열 상수를 <code>PSTR("...")</code> 및 <code>PROGMEM</code>으로 선언하여 SRAM(.data) 대신 플래시(.text)에 저장하세요.</li>
              <li><code>sprintf</code> 대신 가벼운 직접 정수 변환 루틴(itoa)을 사용하여 부동소수점 라이브러리 오버헤드를 약 1.5KB 줄일 수 있습니다.</li>
              <li>사용하지 않는 함수 제거를 위해 컴파일러 플래그 <code>-ffunction-sections -Wl,--gc-sections</code>를 활성화하세요.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tabs: Symbol Breakdown Explorer vs Paste Raw Map */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('symbols')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition font-mono flex items-center gap-1.5 ${
                activeTab === 'symbols'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" /> 심볼별 크기 랭킹 ({parsedData.symbols.length}개)
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition font-mono flex items-center gap-1.5 ${
                activeTab === 'raw'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> .map 파일 / avr-size 입력 편집기
            </button>
          </div>

          {activeTab === 'symbols' && (
            <div className="flex items-center gap-2 text-xs">
              {/* Section Filter */}
              <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 font-mono text-[11px]">
                {(['all', '.text', '.data', '.bss'] as const).map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setSectionFilter(sec)}
                    className={`px-2 py-0.5 rounded transition ${
                      sectionFilter === sec ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {sec}
                  </button>
                ))}
              </div>

              {/* Search filter */}
              <div className="relative w-40">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="함수/변수 검색..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-2 py-1 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* Tab 1: Symbols Table */}
        {activeTab === 'symbols' && (
          <div className="overflow-x-auto max-h-96 custom-scrollbar">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 sticky top-0">
                <tr>
                  <th className="py-2.5 px-4 w-12 text-center">#</th>
                  <th className="py-2.5 px-4">심볼 명칭 (함수 / 전역 변수)</th>
                  <th className="py-2.5 px-4 w-28">세그먼트</th>
                  <th className="py-2.5 px-4 w-32 text-right">크기 (Bytes)</th>
                  <th className="py-2.5 px-4 w-40 text-right">비율 (%)</th>
                  <th className="py-2.5 px-4">오브젝트 파일 출처</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredSymbols.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                      일치하는 심볼이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredSymbols.map((sym, idx) => {
                    const totalSecSize = sym.section === '.text'
                      ? parsedData.totalText
                      : sym.section === '.data'
                      ? parsedData.totalData
                      : parsedData.totalBss;
                    const percentOfSection = totalSecSize > 0 ? (sym.size / totalSecSize) * 100 : 0;

                    return (
                      <tr key={idx} className="hover:bg-slate-900/60 transition">
                        <td className="py-2 px-4 text-center text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-4 font-bold text-white flex items-center gap-2">
                          <span>{sym.name}</span>
                          {sym.size > 500 && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              대형 심볼
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sym.section === '.text'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : sym.section === '.data'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          }`}>
                            {sym.section}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-right font-bold text-white">
                          {sym.size.toLocaleString()} B
                        </td>
                        <td className="py-2 px-4 text-right text-slate-400">
                          {percentOfSection.toFixed(1)}%
                        </td>
                        <td className="py-2 px-4 text-slate-500 text-[11px] truncate max-w-xs">
                          {sym.file || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Raw Map Paste Area */}
        {activeTab === 'raw' && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>GNU ld <code>.map</code> 파일 내용 또는 <code>avr-size</code> 출력 결과문을 붙여넣으세요:</span>
              <span className="text-slate-500 text-[11px] font-mono">
                {inputMapText.length.toLocaleString()} 글자 입력됨
              </span>
            </div>
            <textarea
              value={inputMapText}
              onChange={(e) => setInputMapText(e.target.value)}
              rows={12}
              placeholder="GNU ld map 파일 텍스트를 붙여넣으세요..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-400 leading-relaxed custom-scrollbar selection:bg-cyan-500/30"
            />
          </div>
        )}
      </div>
    </div>
  );
};
