import React, { useState, useMemo } from 'react';
import {
  HardDrive,
  Layers,
  Cpu,
  Zap,
  PieChart,
  BarChart3,
  Database,
  Sliders,
  RotateCcw,
  Info,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  ArrowRight,
  ArrowDown,
  Sparkles,
  Code2,
  FileText,
  Activity
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU: (mcu: SupportedMCU) => void;
}

interface MemoryScenario {
  id: string;
  name: string;
  desc: string;
  flashCodeBytes: number;
  flashRodataBytes: number;
  bootloaderBytes: number;
  dataBytes: number;
  bssBytes: number;
  heapBytes: number;
  stackBytes: number;
}

export const MemoryMapTab: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Hardware boundaries
  const totalFlashBytes = currentProfile.flash;
  const totalSramBytes = currentProfile.sram;
  const totalEepromBytes = currentProfile.eeprom;

  // IVT size: 4 bytes per vector for mega2560/640/128 (JMP), 2 bytes for 328P (RJMP)
  const vectorCount = selectedMCU === 'atmega328p' ? 26 : selectedMCU === 'atmega128' ? 35 : 57;
  const vectorBytes = selectedMCU === 'atmega328p' ? 26 * 2 : vectorCount * 4;

  // Scenarios presets tailored to selected MCU size
  const scenarios: MemoryScenario[] = useMemo(() => {
    const is328P = selectedMCU === 'atmega328p';
    const isSmall = totalFlashBytes <= 32768;

    return [
      {
        id: 'baremetal',
        name: '초경량 베어메탈 (Minimal Blink / GPIO)',
        desc: '간단한 레지스터 제어 및 기본 타이머 인터럽트만 사용하는 가벼운 펌웨어',
        flashCodeBytes: isSmall ? 850 : 1200,
        flashRodataBytes: isSmall ? 40 : 80,
        bootloaderBytes: isSmall ? 512 : 1024,
        dataBytes: 8,
        bssBytes: 24,
        heapBytes: 0,
        stackBytes: isSmall ? 32 : 48,
      },
      {
        id: 'typical_sensor',
        name: '일반 임베디드 (센서 로깅 & UART 링버퍼)',
        desc: 'ADC 샘플링, UART 원형 큐(RingBuffer), I2C 센서 라이브러리 및 FSM 제어 루프',
        flashCodeBytes: isSmall ? 6800 : 14500,
        flashRodataBytes: isSmall ? 420 : 1200,
        bootloaderBytes: isSmall ? 512 : 2048,
        dataBytes: isSmall ? 180 : 340,
        bssBytes: isSmall ? 520 : 1100,
        heapBytes: 0,
        stackBytes: isSmall ? 140 : 260,
      },
      {
        id: 'display_gui',
        name: '그래픽/통신 집약형 (OLED 128x64 프레임버퍼)',
        desc: '1KB 그래픽 SRAM 프레임버퍼(128x64), 폰트 테이블(PROGMEM), 모드버스/SPI 통신',
        flashCodeBytes: isSmall ? 18500 : 38000,
        flashRodataBytes: isSmall ? 3800 : 9500,
        bootloaderBytes: isSmall ? 1024 : 4096,
        dataBytes: isSmall ? 290 : 620,
        bssBytes: isSmall ? 1150 : 2800, // 1024B Framebuffer inside .bss!
        heapBytes: 0,
        stackBytes: isSmall ? 210 : 420,
      },
      {
        id: 'heavy_rtos',
        name: '멀티태스킹 / RTOS (FreeRTOS & 태스크 스택)',
        desc: '복수 태스크 개별 스택(TCB), 큐 버퍼, 동적 힙 할당 및 깊은 ISR 인터럽트 체인',
        flashCodeBytes: isSmall ? 24000 : 78000,
        flashRodataBytes: isSmall ? 2100 : 14000,
        bootloaderBytes: isSmall ? 1024 : 8192,
        dataBytes: isSmall ? 380 : 1200,
        bssBytes: isSmall ? 650 : 2400,
        heapBytes: isSmall ? 350 : 1800,
        stackBytes: isSmall ? 480 : 1600,
      }
    ];
  }, [selectedMCU, totalFlashBytes]);

  const [activeScenarioId, setActiveScenarioId] = useState<string>('typical_sensor');

  // Custom User Adjustable Sliders initialized from active scenario
  const currentScenario = useMemo(() => {
    return scenarios.find(s => s.id === activeScenarioId) || scenarios[1];
  }, [scenarios, activeScenarioId]);

  const [flashCodeBytes, setFlashCodeBytes] = useState<number>(currentScenario.flashCodeBytes);
  const [flashRodataBytes, setFlashRodataBytes] = useState<number>(currentScenario.flashRodataBytes);
  const [bootloaderBytes, setBootloaderBytes] = useState<number>(currentScenario.bootloaderBytes);
  const [dataBytes, setDataBytes] = useState<number>(currentScenario.dataBytes);
  const [bssBytes, setBssBytes] = useState<number>(currentScenario.bssBytes);
  const [heapBytes, setHeapBytes] = useState<number>(currentScenario.heapBytes);
  const [stackBytes, setStackBytes] = useState<number>(currentScenario.stackBytes);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sync state when switching scenario preset or MCU
  const handleSelectScenario = (sc: MemoryScenario) => {
    setActiveScenarioId(sc.id);
    setFlashCodeBytes(sc.flashCodeBytes);
    setFlashRodataBytes(sc.flashRodataBytes);
    setBootloaderBytes(sc.bootloaderBytes);
    setDataBytes(sc.dataBytes);
    setBssBytes(sc.bssBytes);
    setHeapBytes(sc.heapBytes);
    setStackBytes(sc.stackBytes);
  };

  // --------------------------------------------------------------------------
  // FLASH MEMORY CALCULATIONS:
  // Flash = .vectors (IVT) + .text (Code) + .rodata (PROGMEM) + .data_load (Initial values) + Free Flash + .bootloader
  // --------------------------------------------------------------------------
  const flashDataLoadBytes = dataBytes; // .data initial values occupy Flash (LMA) to copy to SRAM at boot!
  const totalUsedFlashBytes = vectorBytes + flashCodeBytes + flashRodataBytes + flashDataLoadBytes + bootloaderBytes;
  const freeFlashBytes = Math.max(0, totalFlashBytes - totalUsedFlashBytes);
  const flashUsedPercent = ((totalUsedFlashBytes / totalFlashBytes) * 100);
  const isFlashOverflow = totalUsedFlashBytes > totalFlashBytes;

  // Flash segments percent for visual bar
  const ivtPct = Math.min(100, (vectorBytes / totalFlashBytes) * 100);
  const textPct = Math.min(100, (flashCodeBytes / totalFlashBytes) * 100);
  const rodataPct = Math.min(100, (flashRodataBytes / totalFlashBytes) * 100);
  const dataLoadPct = Math.min(100, (flashDataLoadBytes / totalFlashBytes) * 100);
  const bootloaderPct = Math.min(100, (bootloaderBytes / totalFlashBytes) * 100);
  const freeFlashPct = Math.max(0, 100 - (ivtPct + textPct + rodataPct + dataLoadPct + bootloaderPct));

  // --------------------------------------------------------------------------
  // SRAM STATIC & DYNAMIC MEMORY CALCULATIONS:
  // SRAM starts at RAMSTART (0x0100 on 328P, 0x0200 on 2560/640/128)
  // Low to High: .data (VMA) -> .bss -> Heap (grows UP) -> Free RAM Margin -> Stack (grows DOWN from RAMEND)
  // --------------------------------------------------------------------------
  const totalStaticGlobalBytes = dataBytes + bssBytes; // Total global/static variables
  const totalUsedSramBytes = totalStaticGlobalBytes + heapBytes + stackBytes;
  const freeSramBytes = totalSramBytes - totalUsedSramBytes;
  const sramUsedPercent = ((totalUsedSramBytes / totalSramBytes) * 100);
  const isSramOverflow = freeSramBytes < 0;

  // SRAM segments percent for visual bar
  const dataPct = Math.min(100, (dataBytes / totalSramBytes) * 100);
  const bssPct = Math.min(100, (bssBytes / totalSramBytes) * 100);
  const heapPct = Math.min(100, (heapBytes / totalSramBytes) * 100);
  const stackPct = Math.min(100, (stackBytes / totalSramBytes) * 100);
  const freeSramPct = Math.max(0, 100 - (dataPct + bssPct + heapPct + stackPct));

  // Key Ratios:
  // How much space global variables vs stack vs code segment
  const codeVsGlobalRatio = (totalStaticGlobalBytes / Math.max(1, flashCodeBytes) * 100).toFixed(1);
  const stackVsSramRatio = ((stackBytes / totalSramBytes) * 100).toFixed(1);
  const globalVsSramRatio = ((totalStaticGlobalBytes / totalSramBytes) * 100).toFixed(1);

  // Formatted Memory Map Addresses
  const ramStartHex = selectedMCU === 'atmega328p' ? '0x0100' : '0x0200';
  const ramEndHex = `0x${(totalSramBytes + (selectedMCU === 'atmega328p' ? 0x0100 : 0x0200) - 1).toString(16).toUpperCase()}`;
  const flashStartHex = '0x0000';
  const flashEndHex = `0x${(totalFlashBytes - 1).toString(16).toUpperCase()}`;
  const bootloaderStartHex = `0x${(totalFlashBytes - bootloaderBytes).toString(16).toUpperCase()}`;

  // Linker symbols / avr-size Output Simulation
  const simulatedAvrSizeOutput = useMemo(() => {
    const textSegment = vectorBytes + flashCodeBytes + flashRodataBytes;
    const dataSegment = dataBytes;
    const bssSegment = bssBytes;
    const decTotal = textSegment + dataSegment + bssSegment;
    const hexTotal = decTotal.toString(16);

    return `   text\t   data\t    bss\t    dec\t    hex\tfilename
  ${textSegment}\t    ${dataSegment}\t   ${bssSegment}\t  ${decTotal}\t   ${hexTotal}\tfirmware.elf

=== AVR Memory Usage Summary ===
Device: ${currentProfile.name} (${selectedMCU})

Program (Flash):  ${(textSegment + dataSegment).toLocaleString()} bytes (${(((textSegment + dataSegment) / totalFlashBytes) * 100).toFixed(1)}% Full)
(.text + .data + .bootloader: ${(textSegment + dataSegment + bootloaderBytes).toLocaleString()} / ${totalFlashBytes.toLocaleString()} bytes)

Data (SRAM):     ${(dataSegment + bssSegment).toLocaleString()} bytes (${(((dataSegment + bssSegment) / totalSramBytes) * 100).toFixed(1)}% Full)
(.data + .bss: ${(dataSegment + bssSegment).toLocaleString()} / ${totalSramBytes.toLocaleString()} bytes)
Estimated Peak Stack: ${stackBytes} bytes (Leaves ${Math.max(0, freeSramBytes)} bytes free margin)

EEPROM:           0 bytes (0.0% Full)
(.eeprom: 0 / ${totalEepromBytes.toLocaleString()} bytes)`;
  }, [vectorBytes, flashCodeBytes, flashRodataBytes, dataBytes, bssBytes, bootloaderBytes, totalFlashBytes, totalSramBytes, totalEepromBytes, stackBytes, freeSramBytes, currentProfile, selectedMCU]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.85 } });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold tracking-wide uppercase">
              <Layers className="w-3.5 h-3.5" />
              AVR Harvard Architecture Memory Map Visualizer
            </div>
            <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              정적 메모리(SRAM) &amp; 플래시(Flash) 레이아웃 시각화
              <span className="text-xs font-mono font-normal text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-700/50">
                {currentProfile.name}
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-3xl leading-relaxed">
              AVR 하버드(Harvard) 아키텍처는 <span className="text-amber-300 font-semibold">프로그램 플래시(Flash)</span>와 <span className="text-cyan-300 font-semibold">데이터 SRAM</span>이 물리적으로 완전히 독립된 메모리 공간을 갖습니다.
              코드 세그먼트(`.text`), 읽기 전용 상수(`.rodata`), 전역 변수(`.data`, `.bss`), 동적 힙(`Heap`), 그리고 하향 성장하는 `Stack`의 
              상대적 점유 비율과 충돌 여부를 실시간으로 비교 시각화합니다.
            </p>
          </div>

          {/* MCU Selector Quick Switch */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/90 p-1.5 rounded-xl border border-slate-800 shrink-0">
            {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
              <button
                key={mcuId}
                onClick={() => onSelectMCU(mcuId)}
                className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex flex-col items-center ${
                  selectedMCU === mcuId
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span>{MCU_PROFILES[mcuId].name}</span>
                <span className={`text-[10px] ${selectedMCU === mcuId ? 'text-slate-900/80' : 'text-slate-500'}`}>
                  {MCU_PROFILES[mcuId].flash / 1024}K/{MCU_PROFILES[mcuId].sram / 1024}K
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Realistic Firmware Scenario Presets Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              전형적인 펌웨어 워크로드 시나리오 프리셋:
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              클릭 시 Flash / SRAM 점유율 파라미터 자동 로드
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {scenarios.map((sc) => {
              const isActive = activeScenarioId === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => handleSelectScenario(sc)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    isActive
                      ? 'bg-slate-900 border-amber-500/80 shadow-lg shadow-amber-950/40 ring-1 ring-amber-400/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${isActive ? 'text-amber-400' : 'text-slate-200'}`}>
                      {sc.name.split('(')[0]}
                    </span>
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {sc.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* High-level Space Occupancy Ratios & Comparison Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: Total Flash Usage */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>플래시(Flash) 점유율</span>
            <span className="text-[10px] font-mono text-amber-400">0x0000 ~ {flashEndHex}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black font-mono ${isFlashOverflow ? 'text-rose-400' : 'text-amber-300'}`}>
              {flashUsedPercent.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({totalUsedFlashBytes.toLocaleString()} / {totalFlashBytes.toLocaleString()} B)
            </span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isFlashOverflow ? 'bg-rose-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(100, flashUsedPercent)}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Total SRAM Usage */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>SRAM 총 점유율</span>
            <span className="text-[10px] font-mono text-cyan-400">{ramStartHex} ~ {ramEndHex}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black font-mono ${isSramOverflow ? 'text-rose-400' : 'text-cyan-300'}`}>
              {sramUsedPercent.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({totalUsedSramBytes.toLocaleString()} / {totalSramBytes.toLocaleString()} B)
            </span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isSramOverflow ? 'bg-rose-500' : 'bg-cyan-500'}`}
              style={{ width: `${Math.min(100, sramUsedPercent)}%` }}
            />
          </div>
        </div>

        {/* Metric 3: Global Variables vs Stack Space */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>전역 변수 vs 스택 비율</span>
            <span className="text-[10px] font-mono text-purple-400">SRAM 공간 내 비교</span>
          </div>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-2xl font-black text-purple-300">
              {globalVsSramRatio}% : {stackVsSramRatio}%
            </span>
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            전역: {totalStaticGlobalBytes}B (.data+.bss) | 스택: {stackBytes}B
          </div>
        </div>

        {/* Metric 4: Free SRAM Safety Headroom */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>SRAM 안전 여유 마진</span>
            <span className="text-[10px] font-mono text-emerald-400">스택 충돌 방지</span>
          </div>
          <div className="flex items-baseline gap-2 font-mono">
            <span className={`text-2xl font-black ${isSramOverflow ? 'text-rose-400' : freeSramBytes < 64 ? 'text-amber-400' : 'text-emerald-300'}`}>
              {isSramOverflow ? `-${Math.abs(freeSramBytes)} B 초과` : `${freeSramBytes} Bytes`}
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            {isSramOverflow 
              ? '스택이 전역 변수를 침범함 (크래시)' 
              : freeSramBytes < 64 
              ? '주의: 스택 마진이 64B 미만으로 임박' 
              : '충분한 스택 안전 마진 확보'}
          </div>
        </div>
      </div>

      {/* Visual Memory Segment Bars: Flash & SRAM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flash Memory Visual Layout Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  플래시(Flash) 비휘발성 프로그램 메모리 맵
                </h3>
              </div>
              <span className="text-xs font-mono text-amber-400 font-bold">
                {totalFlashBytes / 1024} KB ({totalFlashBytes.toLocaleString()} B)
              </span>
            </div>

            {/* Visual Multi-Segment Bar */}
            <div className="space-y-1.5">
              <div className="w-full h-8 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex relative">
                {/* 1. .vectors (IVT) */}
                <div
                  style={{ width: `${Math.max(1.5, ivtPct)}%` }}
                  className="bg-rose-600/90 h-full border-r border-rose-500/50 flex items-center justify-center text-[10px] font-bold text-white truncate px-0.5"
                  title={`인터럽트 벡터 테이블 (.vectors): ${vectorBytes} Bytes`}
                >
                  IVT
                </div>

                {/* 2. .text (Executable Code) */}
                <div
                  style={{ width: `${textPct}%` }}
                  className="bg-amber-600/80 h-full border-r border-amber-500/50 flex items-center justify-center text-[10px] font-bold text-white truncate px-1"
                  title={`실행 코드 (.text): ${flashCodeBytes.toLocaleString()} Bytes (${textPct.toFixed(1)}%)`}
                >
                  .text 코드 ({flashCodeBytes}B)
                </div>

                {/* 3. .rodata (PROGMEM) */}
                <div
                  style={{ width: `${Math.max(1.5, rodataPct)}%` }}
                  className="bg-orange-500/80 h-full border-r border-orange-400/50 flex items-center justify-center text-[10px] font-bold text-slate-950 truncate px-0.5"
                  title={`읽기 전용 상수 (.rodata/PROGMEM): ${flashRodataBytes.toLocaleString()} Bytes`}
                >
                  .rodata
                </div>

                {/* 4. .data_load (Flash LMA for initialized variables) */}
                <div
                  style={{ width: `${Math.max(1.5, dataLoadPct)}%` }}
                  className="bg-indigo-500/80 h-full border-r border-indigo-400/50 flex items-center justify-center text-[10px] font-bold text-white truncate px-0.5"
                  title={`초기값 플래시 복사본 (.data LMA): ${flashDataLoadBytes} Bytes`}
                >
                  .data초기값
                </div>

                {/* 5. Free Flash */}
                <div
                  style={{ width: `${freeFlashPct}%` }}
                  className="bg-slate-950 h-full flex items-center justify-center text-[10px] font-mono text-slate-500 truncate px-1"
                  title={`미사용 플래시 공간: ${freeFlashBytes.toLocaleString()} Bytes (${freeFlashPct.toFixed(1)}%)`}
                >
                  Free Flash ({freeFlashBytes.toLocaleString()}B)
                </div>

                {/* 6. Bootloader Section (BLS) */}
                <div
                  style={{ width: `${Math.max(2, bootloaderPct)}%` }}
                  className="bg-emerald-600/90 h-full flex items-center justify-center text-[10px] font-black text-slate-950 truncate px-1 border-l border-emerald-400"
                  title={`부트로더 섹션 (BLS): ${bootloaderBytes} Bytes (${bootloaderStartHex} ~ ${flashEndHex})`}
                >
                  BLS
                </div>
              </div>

              {/* Memory Address Labels */}
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 px-1">
                <span>0x0000 (IVT Reset)</span>
                <span>.text / .rodata</span>
                <span>{bootloaderStartHex} (Bootloader)</span>
              </div>
            </div>

            {/* Flash Segment Legend & Detailed Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono pt-2">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">.vectors (인터럽트 테이블)</span>
                <span className="text-rose-400 font-bold">{vectorBytes} B ({vectorCount}개)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">.text (기계어 코드 세그먼트)</span>
                <span className="text-amber-300 font-bold">{flashCodeBytes.toLocaleString()} B</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">.rodata (Flash 상수 문자열)</span>
                <span className="text-orange-400 font-bold">{flashRodataBytes.toLocaleString()} B</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">.data LMA (SRAM 복사 초기값)</span>
                <span className="text-indigo-400 font-bold">{flashDataLoadBytes} B</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">부트로더 공간 (BLS)</span>
                <span className="text-emerald-400 font-bold">{bootloaderBytes} B</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">잔여 플래시 공간 (Free)</span>
                <span className="text-slate-300 font-bold">{freeFlashBytes.toLocaleString()} B</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed pt-2">
            💡 <strong>Flash 특징</strong>: 초기화된 전역 변수(`.data`)는 부팅 시 플래시에서 SRAM으로 복사되므로 Flash와 SRAM 양쪽 모두의 공간을 점유합니다.
          </p>
        </div>

        {/* SRAM Static/Dynamic Memory Layout Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  정적 메모리(SRAM) 데이터 &amp; 스택 레이아웃
                </h3>
              </div>
              <span className="text-xs font-mono text-cyan-400 font-bold">
                {totalSramBytes / 1024} KB ({totalSramBytes.toLocaleString()} B)
              </span>
            </div>

            {/* Visual Multi-Segment Bar for SRAM */}
            <div className="space-y-1.5">
              <div className="w-full h-8 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex relative">
                {/* 1. .data (Initialized Globals) */}
                <div
                  style={{ width: `${Math.max(2, dataPct)}%` }}
                  className="bg-indigo-600/90 h-full border-r border-indigo-500/50 flex items-center justify-center text-[10px] font-bold text-white truncate px-1"
                  title={`초기화된 전역 변수 (.data): ${dataBytes} Bytes (${dataPct.toFixed(1)}%)`}
                >
                  .data ({dataBytes}B)
                </div>

                {/* 2. .bss (Uninitialized Globals) */}
                <div
                  style={{ width: `${Math.max(2, bssPct)}%` }}
                  className="bg-blue-600/80 h-full border-r border-blue-500/50 flex items-center justify-center text-[10px] font-bold text-white truncate px-1"
                  title={`0 초기화 전역 변수 (.bss): ${bssBytes} Bytes (${bssPct.toFixed(1)}%)`}
                >
                  .bss ({bssBytes}B)
                </div>

                {/* 3. Heap (Optional) */}
                {heapBytes > 0 && (
                  <div
                    style={{ width: `${heapPct}%` }}
                    className="bg-purple-600/80 h-full border-r border-purple-500/50 flex items-center justify-center text-[10px] font-bold text-white truncate px-1"
                    title={`동적 할당 힙 (Heap): ${heapBytes} Bytes`}
                  >
                    Heap
                  </div>
                )}

                {/* 4. Free Margin / Collision Alert */}
                {isSramOverflow ? (
                  <div
                    className="flex-1 bg-rose-600 h-full flex items-center justify-center text-[10px] font-black text-white animate-pulse"
                    title="스택이 전역 변수 영역을 침범하여 충돌 발생!"
                  >
                    ⚠️ STACK OVERFLOW ({Math.abs(freeSramBytes)}B)
                  </div>
                ) : (
                  <div
                    style={{ width: `${freeSramPct}%` }}
                    className="bg-slate-950 h-full flex items-center justify-center text-[10px] font-mono text-slate-500 truncate px-1"
                    title={`안전 여유 공간: ${freeSramBytes} Bytes (${freeSramPct.toFixed(1)}%)`}
                  >
                    Free SRAM ({freeSramBytes}B)
                  </div>
                )}

                {/* 5. Stack (Grows Downwards from RAMEND) */}
                {!isSramOverflow && (
                  <div
                    style={{ width: `${Math.max(3, stackPct)}%` }}
                    className="bg-rose-500/90 h-full border-l border-rose-400 flex items-center justify-center text-[10px] font-bold text-white truncate px-1"
                    title={`스택 영역 (Stack, RAMEND에서 하향 성장): ${stackBytes} Bytes (${stackPct.toFixed(1)}%)`}
                  >
                    ◀ Stack ({stackBytes}B)
                  </div>
                )}
              </div>

              {/* Memory Address & Direction Labels */}
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 px-1">
                <span>{ramStartHex} (.data 상향 성장 ➔)</span>
                <span className="text-cyan-400">Heap (▲) vs Stack (▼) 충돌점</span>
                <span className="text-rose-400">{ramEndHex} (◀ Stack 하향)</span>
              </div>
            </div>

            {/* SRAM Segment Legend & Detailed Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono pt-2">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">.data (초기화된 전역/정적 변수)</span>
                <span className="text-indigo-400 font-bold">{dataBytes} B</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">.bss (미초기화 전역/배열 버퍼)</span>
                <span className="text-blue-400 font-bold">{bssBytes} B</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">총 정적 전역 변수 점유량</span>
                <span className="text-purple-300 font-bold">{totalStaticGlobalBytes} B</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">동적 힙 공간 (Heap)</span>
                <span className="text-purple-400 font-bold">{heapBytes} B</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">피크 스택 (Stack Frame &amp; ISR)</span>
                <span className="text-rose-400 font-bold">{stackBytes} B</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-500 text-[10px] block">스택 충돌 방지 여유 마진</span>
                <span className={`font-bold ${isSramOverflow ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {isSramOverflow ? `-${Math.abs(freeSramBytes)} B` : `${freeSramBytes} B`}
                </span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed pt-2">
            💡 <strong>SRAM 특징</strong>: 스택 포인터(`SP`)는 최상단(`RAMEND`)에서 함수 호출 및 인터럽트 발생 시마다 아래로 자라나므로 전역 변수와의 거리가 좁혀집니다.
          </p>
        </div>
      </div>

      {/* Interactive Sliders: Fine-Tune Memory Components */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              메모리 세그먼트 크기 미세 조정 슬라이더
            </h3>
          </div>
          <button
            onClick={() => handleSelectScenario(currentScenario)}
            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>프리셋 값으로 초기화</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          {/* Slider 1: .text Code Size */}
          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-300 font-bold">.text 코드 크기:</span>
              <span className="text-amber-400 font-bold">{flashCodeBytes.toLocaleString()} B</span>
            </div>
            <input
              type="range"
              min={256}
              max={totalFlashBytes - 4096}
              step={128}
              value={flashCodeBytes}
              onChange={(e) => setFlashCodeBytes(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 block">
              컴파일된 C 함수 및 라이브러리 기계어
            </span>
          </div>

          {/* Slider 2: .data Initialized Globals */}
          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-300 font-bold">.data (초기화 변수):</span>
              <span className="text-indigo-400 font-bold">{dataBytes} B</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.round(totalSramBytes * 0.5)}
              step={8}
              value={dataBytes}
              onChange={(e) => setDataBytes(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 block">
              초기값 있는 전역/정적 변수 (Flash &amp; RAM 점유)
            </span>
          </div>

          {/* Slider 3: .bss Zero-init Buffers */}
          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-300 font-bold">.bss (배열/미초기화):</span>
              <span className="text-blue-400 font-bold">{bssBytes} B</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.round(totalSramBytes * 0.8)}
              step={16}
              value={bssBytes}
              onChange={(e) => setBssBytes(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 block">
              대형 통신 버퍼, 센서 배열, 링버퍼 (RAM만 점유)
            </span>
          </div>

          {/* Slider 4: Stack Depth */}
          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-300 font-bold">피크 스택 깊이:</span>
              <span className="text-rose-400 font-bold">{stackBytes} B</span>
            </div>
            <input
              type="range"
              min={16}
              max={Math.round(totalSramBytes * 0.6)}
              step={8}
              value={stackBytes}
              onChange={(e) => setStackBytes(Number(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 block">
              함수 호출 체인, 지역 변수 및 ISR 컨텍스트
            </span>
          </div>
        </div>
      </div>

      {/* Code & Linker Script Reference: avr-size and Linker Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Terminal avr-size output inspector */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  avr-size 시뮬레이션 및 링커 맵(Map) 해석
                </h3>
              </div>
              <button
                onClick={() => handleCopy(simulatedAvrSizeOutput, 'size')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-[11px] font-mono"
              >
                {copiedKey === 'size' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>복사 완료</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>출력 복사</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-4 bg-slate-950 rounded-2xl border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed select-all">
              {simulatedAvrSizeOutput}
            </pre>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed pt-2">
            컴파일 시 <code className="text-amber-300 font-mono">avr-size -C --mcu={selectedMCU} $(TARGET).elf</code>를 실행하면 
            플래시와 SRAM의 정확한 섹션별 크기를 확인할 수 있습니다.
          </p>
        </div>

        {/* C Code Optimization & Linker Rules Guide */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  SRAM 절약을 위한 3대 황금 코딩 규칙
                </h3>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  1. 문자열 상수는 무조건 PROGMEM(PSTR)으로 플래시에 격리
                </span>
                <code className="text-cyan-300 font-mono text-[11px] block">
                  uart_print(PSTR("Temperature: ")); // SRAM 0B 점유!
                </code>
                <p className="text-[10px] text-slate-400">
                  일반 큰따옴표 문자열은 `.data`로 인식되어 SRAM으로 통째 복사되므로 치명적인 RAM 낭비를 유발합니다.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  2. 링커 미사용 코드 가비지 컬렉션 플래그 적용
                </span>
                <code className="text-amber-300 font-mono text-[11px] block">
                  CFLAGS += -ffunction-sections -fdata-sections -Wl,--gc-sections
                </code>
                <p className="text-[10px] text-slate-400">
                  호출되지 않는 데드 코드(Dead Code)와 미사용 전역 변수를 링크 단계에서 100% 제거하여 Flash와 SRAM을 극대화합니다.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                  3. 런타임 잔여 SRAM 검사 함수 내장
                </span>
                <code className="text-emerald-300 font-mono text-[11px] block">
                  uint16_t free_ram(void) &#123; extern int __heap_start, *__brkval; int v; return (int)&amp;v - (__brkval == 0 ? (int)&amp;__heap_start : (int)__brkval); &#125;
                </code>
                <p className="text-[10px] text-slate-400">
                  현재 스택 포인터와 힙 경계 간의 남은 바이트를 실시간으로 측정하여 스택 오버플로우를 감지합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
