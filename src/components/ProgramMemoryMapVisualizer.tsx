import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  PieChart as PieIcon,
  Layers,
  HardDrive,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  ArrowRight,
  TrendingDown,
  Terminal,
  Activity,
  ShieldCheck,
  Zap
} from 'lucide-react';

export interface ProgramMemoryMapVisualizerProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export interface MemorySlice {
  id: string;
  name: string;
  nameKo: string;
  section: string;
  bytes: number;
  color: string;
  description: string;
  isFree?: boolean;
}

export const ProgramMemoryMapVisualizer: React.FC<ProgramMemoryMapVisualizerProps> = ({
  selectedMCU,
  onSelectMCU
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Preset payload selection
  const [preset, setPreset] = useState<'blink' | 'medium' | 'large' | 'overflow'>('medium');

  // Interactive Sizing Sliders
  const [codeKb, setCodeKb] = useState<number>(() => {
    if (selectedMCU === 'atmega328p') return 14.5;
    if (selectedMCU === 'atmega128') return 38.0;
    if (selectedMCU === 'atmega640') return 24.0;
    return 64.0;
  });

  const [dataBytes, setDataBytes] = useState<number>(580);     // .data (Initialized global vars)
  const [bssBytes, setBssBytes] = useState<number>(280);       // .bss (Zeroed uninitialized vars)
  const [progmemBytes, setProgmemBytes] = useState<number>(1400); // .rodata / PROGMEM string tables
  const [heapBytes, setHeapBytes] = useState<number>(220);     // Heap dynamic malloc
  const [stackBytes, setStackBytes] = useState<number>(380);   // Call stack + local vars + ISR context
  const [bootloaderType, setBootloaderType] = useState<'optiboot' | 'standard' | 'none'>('optiboot');

  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  // Apply Presets
  const handleApplyPreset = (p: 'blink' | 'medium' | 'large' | 'overflow') => {
    setPreset(p);
    const flashKb = currentProfile.flash;
    const sramKb = currentProfile.sram;

    if (p === 'blink') {
      setCodeKb(+(flashKb * 0.12).toFixed(1));
      setDataBytes(120);
      setBssBytes(80);
      setProgmemBytes(250);
      setHeapBytes(0);
      setStackBytes(140);
      setBootloaderType('optiboot');
    } else if (p === 'medium') {
      setCodeKb(+(flashKb * 0.45).toFixed(1));
      setDataBytes(450);
      setBssBytes(260);
      setProgmemBytes(1200);
      setHeapBytes(180);
      setStackBytes(350);
      setBootloaderType('optiboot');
    } else if (p === 'large') {
      setCodeKb(+(flashKb * 0.78).toFixed(1));
      setDataBytes(Math.round(sramKb * 1024 * 0.28));
      setBssBytes(Math.round(sramKb * 1024 * 0.18));
      setProgmemBytes(3500);
      setHeapBytes(Math.round(sramKb * 1024 * 0.15));
      setStackBytes(Math.round(sramKb * 1024 * 0.22));
      setBootloaderType('optiboot');
    } else if (p === 'overflow') {
      // Intentionally induce high memory pressure
      setCodeKb(+(flashKb * 0.98).toFixed(1));
      setDataBytes(Math.round(sramKb * 1024 * 0.42));
      setBssBytes(Math.round(sramKb * 1024 * 0.28));
      setProgmemBytes(2000);
      setHeapBytes(Math.round(sramKb * 1024 * 0.25));
      setStackBytes(Math.round(sramKb * 1024 * 0.28)); // Causes Stack-Heap Collision!
      setBootloaderType('standard');
    }
  };

  // Hardware Memory Capacities
  const totalFlashBytes = currentProfile.flash * 1024;
  const totalSramBytes = currentProfile.sram * 1024;

  // IVT Size (ATmega328P = 104B, mega128 = 140B, mega640/2560 = 228B)
  const ivtBytes = useMemo(() => {
    if (selectedMCU === 'atmega128') return 140;
    if (selectedMCU === 'atmega640' || selectedMCU === 'atmega2560') return 228;
    return 104;
  }, [selectedMCU]);

  // Bootloader size
  const bootloaderBytes = useMemo(() => {
    if (bootloaderType === 'none') return 0;
    if (bootloaderType === 'optiboot') {
      return selectedMCU === 'atmega328p' ? 512 : 1024;
    }
    // Standard Arduino
    return selectedMCU === 'atmega2560' ? 8192 : selectedMCU === 'atmega128' ? 4096 : 2048;
  }, [bootloaderType, selectedMCU]);

  // Flash Memory Calculations
  const codeSizeBytes = Math.round(codeKb * 1024);
  const flashUsedBytes = ivtBytes + codeSizeBytes + progmemBytes + dataBytes + bootloaderBytes;
  const flashFreeBytes = totalFlashBytes - flashUsedBytes;
  const isFlashOverflow = flashFreeBytes < 0;
  const flashUsagePct = Math.min(100, +((flashUsedBytes / totalFlashBytes) * 100).toFixed(1));
  const flashFreePct = Math.max(0, +(100 - flashUsagePct).toFixed(1));

  // SRAM Memory Calculations
  // .data + .bss + heap + stack
  const sramUsedBytes = dataBytes + bssBytes + heapBytes + stackBytes;
  const sramFreeMarginBytes = totalSramBytes - sramUsedBytes;
  const isStackHeapCollision = sramFreeMarginBytes <= 0;
  const isSramWarning = sramFreeMarginBytes > 0 && sramFreeMarginBytes < 128;
  const sramUsagePct = Math.min(100, +((sramUsedBytes / totalSramBytes) * 100).toFixed(1));
  const sramFreePct = Math.max(0, +(100 - sramUsagePct).toFixed(1));

  // Flash Slices for Donut Chart
  const flashSlices: MemorySlice[] = useMemo(() => {
    const list: MemorySlice[] = [
      {
        id: 'flash_ivt',
        name: 'Interrupt Vectors (IVT)',
        nameKo: '인터럽트 벡터 테이블',
        section: '.vectors (0x0000)',
        bytes: ivtBytes,
        color: '#f43f5e', // Rose
        description: '리셋 및 하드웨어 인터럽트 분기 주소'
      },
      {
        id: 'flash_code',
        name: 'Executable Code (.text)',
        nameKo: '실행 C/C++ 기계어 코드',
        section: '.text',
        bytes: codeSizeBytes,
        color: '#38bdf8', // Sky
        description: '컴파일된 프로그램 실행 명령어'
      },
      {
        id: 'flash_progmem',
        name: 'PROGMEM Constants (.rodata)',
        nameKo: '플래시 상수 & 문자열',
        section: '.rodata',
        bytes: progmemBytes,
        color: '#a855f7', // Purple
        description: 'F() 매크로 및 PROGMEM 룩업 테이블'
      },
      {
        id: 'flash_data_init',
        name: 'Data Initializers (.data LMA)',
        nameKo: '전역 변수 초기값 롬 미러',
        section: '.data (Load)',
        bytes: dataBytes,
        color: '#6366f1', // Indigo
        description: '부팅 시 SRAM으로 복사될 초기값 저장소'
      }
    ];

    if (bootloaderBytes > 0) {
      list.push({
        id: 'flash_boot',
        name: 'Bootloader Section (BLS)',
        nameKo: '하드웨어 부트로더',
        section: '.bootloader',
        bytes: bootloaderBytes,
        color: '#f59e0b', // Amber
        description: `${bootloaderType === 'optiboot' ? 'Optiboot' : 'Standard'} 시리얼 업로더`
      });
    }

    // Free Space
    list.push({
      id: 'flash_free',
      name: 'Free Flash Headroom',
      nameKo: '예상 잔여 플래시 공간',
      section: 'Unallocated',
      bytes: Math.max(0, flashFreeBytes),
      color: isFlashOverflow ? '#ef4444' : '#10b981', // Emerald or Red
      description: isFlashOverflow ? '용량 초과 오버플로우!' : '추가 기능 구현 가용 여유 공간',
      isFree: true
    });

    return list;
  }, [ivtBytes, codeSizeBytes, progmemBytes, dataBytes, bootloaderBytes, bootloaderType, flashFreeBytes, isFlashOverflow]);

  // SRAM Slices for Donut Chart
  const sramSlices: MemorySlice[] = useMemo(() => {
    return [
      {
        id: 'sram_data',
        name: 'Initialized Globals (.data)',
        nameKo: '초기화된 전역/정적 변수',
        section: '.data (VMA)',
        bytes: dataBytes,
        color: '#3b82f6', // Blue
        description: '초기값이 할당된 전역 및 정적 변수'
      },
      {
        id: 'sram_bss',
        name: 'Uninitialized Globals (.bss)',
        nameKo: '0으로 초기화되는 전역 변수',
        section: '.bss',
        bytes: bssBytes,
        color: '#06b6d4', // Cyan
        description: '초기값 없는 전역 변수 (부팅 시 0 클리어)'
      },
      {
        id: 'sram_heap',
        name: 'Dynamic Heap (malloc)',
        nameKo: '동적 힙 할당 메모리',
        section: 'Heap (__brkval)',
        bytes: heapBytes,
        color: '#f59e0b', // Amber
        description: 'malloc() / new 호출로 상향 성장하는 메모리'
      },
      {
        id: 'sram_stack',
        name: 'Call Stack & Locals (SP)',
        nameKo: '콜 스택 & 지역 변수',
        section: 'Stack (RAMEND)',
        bytes: stackBytes,
        color: '#ec4899', // Pink
        description: '함수 복귀번지, 로컬 변수, ISR 컨텍스트 (하향 성장)'
      },
      {
        id: 'sram_free',
        name: 'Free Collision Margin',
        nameKo: '예상 잔여 SRAM 안전 마진',
        section: 'Free Margin',
        bytes: Math.max(0, sramFreeMarginBytes),
        color: isStackHeapCollision ? '#ef4444' : isSramWarning ? '#f59e0b' : '#10b981',
        description: isStackHeapCollision
          ? '스택-힙 충돌로 런타임 셧다운 위험!'
          : isSramWarning
          ? '안전 여유 마진 임계치 근접 (< 128B)'
          : '스택과 힙 간의 완충 안전 구역',
        isFree: true
      }
    ];
  }, [dataBytes, bssBytes, heapBytes, stackBytes, sramFreeMarginBytes, isStackHeapCollision, isSramWarning]);

  // Helper to generate SVG Donut Segments
  const renderDonutSegments = (slices: MemorySlice[], total: number, isSram = false) => {
    let cumulativeAngle = 0;
    const radius = 70;
    const strokeWidth = 26;
    const center = 90;

    return slices.map((slice) => {
      const fraction = Math.max(0, slice.bytes / total);
      const angle = fraction * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle = endAngle;

      if (fraction <= 0.001) return null;

      // Arc path calculation
      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;

      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);

      const largeArcFlag = angle > 180 ? 1 : 0;
      const pathData = fraction >= 0.999
        ? `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius}`
        : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;

      const isHovered = hoveredSlice === slice.id;

      return (
        <path
          key={slice.id}
          d={pathData}
          fill="none"
          stroke={slice.color}
          strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
          strokeLinecap="butt"
          onMouseEnter={() => setHoveredSlice(slice.id)}
          onMouseLeave={() => setHoveredSlice(null)}
          className="transition-all duration-300 cursor-pointer hover:opacity-90"
        />
      );
    });
  };

  const handleCopyAvrSize = () => {
    const text = `AVR Memory Usage Breakdown
--------------------------
Device: ${selectedMCU}
Program (Flash): ${flashUsedBytes.toLocaleString()} bytes (${flashUsagePct}% Full)
  - Code (.text): ${codeSizeBytes.toLocaleString()} bytes
  - Data Init (.data): ${dataBytes.toLocaleString()} bytes
  - Constants (.rodata): ${progmemBytes.toLocaleString()} bytes
  - Vectors (IVT): ${ivtBytes} bytes
  - Bootloader: ${bootloaderBytes} bytes
  - Free Flash Margin: ${Math.max(0, flashFreeBytes).toLocaleString()} bytes (${flashFreePct}%)

Data (Internal SRAM): ${sramUsedBytes.toLocaleString()} bytes (${sramUsagePct}% Full)
  - Initialized (.data): ${dataBytes.toLocaleString()} bytes
  - Uninitialized (.bss): ${bssBytes.toLocaleString()} bytes
  - Dynamic Heap: ${heapBytes.toLocaleString()} bytes
  - Call Stack: ${stackBytes.toLocaleString()} bytes
  - Free Stack-Heap Margin: ${Math.max(0, sramFreeMarginBytes).toLocaleString()} bytes (${sramFreePct}%)`;

    navigator.clipboard.writeText(text);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div id="program-memory-map-visualizer-card" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur-xl shadow-2xl space-y-7">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-500/10">
            <PieIcon className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                메모리 맵 시각화 도구 (Flash & SRAM Memory Donut Visualizer)
              </h3>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold">
                Donut Chart Analyzer
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                {currentProfile.name}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              컴파일된 펌웨어의 <strong>플래시 ROM(.text, .data LMA, .rodata, IVT, 부트로더)</strong>과 <strong>SRAM(.data, .bss, 힙, 스택)</strong> 메모리 점유 구조를 독립된 <strong>도넛 차트(Donut Chart)</strong>로 실시간 시각화하고 예상 잔여 공간을 정밀 산출합니다.
            </p>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-400 font-mono">시뮬레이션 프리셋:</span>
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => handleApplyPreset('blink')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                preset === 'blink' ? 'bg-cyan-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              초소형 (~10%)
            </button>
            <button
              onClick={() => handleApplyPreset('medium')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                preset === 'medium' ? 'bg-cyan-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              중형 (~45%)
            </button>
            <button
              onClick={() => handleApplyPreset('large')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                preset === 'large' ? 'bg-cyan-500 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              대형 (~80%)
            </button>
            <button
              onClick={() => handleApplyPreset('overflow')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                preset === 'overflow' ? 'bg-rose-500 text-white font-bold shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              오버플로우 테스트
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Health Banner */}
      <div className={`p-4 rounded-2xl border transition-all ${
        isFlashOverflow || isStackHeapCollision
          ? 'bg-rose-950/60 border-rose-500 shadow-xl shadow-rose-950/20 ring-1 ring-rose-500'
          : isSramWarning
          ? 'bg-amber-950/60 border-amber-500 shadow-xl shadow-amber-950/20'
          : 'bg-emerald-950/40 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isFlashOverflow || isStackHeapCollision
                ? 'bg-rose-500 text-white animate-bounce'
                : isSramWarning
                ? 'bg-amber-500 text-slate-950'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {isFlashOverflow || isStackHeapCollision ? (
                <AlertCircle className="w-5 h-5" />
              ) : isSramWarning ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <span className={`text-sm font-black uppercase tracking-wider ${
                isFlashOverflow || isStackHeapCollision
                  ? 'text-rose-300'
                  : isSramWarning
                  ? 'text-amber-300'
                  : 'text-emerald-300'
              }`}>
                {isFlashOverflow && '치명적 에러: 플래시 ROM 용량 초과 (Section .text will not fit in region text)'}
                {!isFlashOverflow && isStackHeapCollision && '치명적 에러: SRAM 스택-힙 충돌 (Stack-Heap Collision) 발생!'}
                {!isFlashOverflow && !isStackHeapCollision && isSramWarning && '주의: SRAM 잔여 안전 마진 임계치 근접 (< 128 Bytes)'}
                {!isFlashOverflow && !isStackHeapCollision && !isSramWarning && '정상: 플래시 및 SRAM 안전 여유 마진 확보됨 (Healthy)'}
              </span>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                {isFlashOverflow
                  ? `플래시 용량(${currentProfile.flash}KB) 대비 ${Math.abs(flashFreeBytes).toLocaleString()} 바이트 초과되었습니다. GCC 최적화 플래그 -Os 및 -flto를 적용하세요.`
                  : isStackHeapCollision
                  ? `동적 힙과 콜 스택이 서로의 메모리 영역을 침범했습니다! 실제 칩에서 함수 리턴 주소가 파괴되어 무한 재부팅(Watchdog reset)이 발생합니다.`
                  : isSramWarning
                  ? `남은 SRAM 안전 마진이 ${sramFreeMarginBytes}바이트로 협소합니다. 인터럽트 핸들러 중첩 시 스택 오버플로우 위험이 있습니다.`
                  : `Flash 잔여: ${(Math.max(0, flashFreeBytes) / 1024).toFixed(1)} KB (${flashFreePct}%) • SRAM 잔여 마진: ${Math.max(0, sramFreeMarginBytes).toLocaleString()} Bytes (${sramFreePct}%)`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyAvrSize}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-mono font-bold transition flex items-center gap-1.5 border border-slate-700 shadow-md"
            >
              {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCmd ? '복사 완료!' : 'avr-size 메모리 리포트 복사'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dual Donut Charts Display */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut 1: Program Flash ROM */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-sky-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                1. 플래시 메모리 점유 구조 (Program Flash ROM)
              </h4>
            </div>
            <span className="text-xs font-mono text-sky-400 font-bold">
              총 {currentProfile.flash} KB ({totalFlashBytes.toLocaleString()} B)
            </span>
          </div>

          {/* Donut Graphic & Center Stats */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
            <div className="relative w-48 h-48 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 180 180" className="w-48 h-48 transform -rotate-90">
                {/* Background Ring */}
                <circle cx="90" cy="90" r="70" fill="none" stroke="#1e293b" strokeWidth="26" />
                {renderDonutSegments(flashSlices, totalFlashBytes)}
              </svg>

              {/* Center Donut Hole Callout */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[10px] text-slate-400 font-mono">점유율</span>
                <span className={`text-2xl font-black font-mono tracking-tight ${isFlashOverflow ? 'text-rose-400' : 'text-white'}`}>
                  {flashUsagePct}%
                </span>
                <span className={`text-[11px] font-mono font-bold ${isFlashOverflow ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {isFlashOverflow ? 'OVERFLOW' : `${(Math.max(0, flashFreeBytes) / 1024).toFixed(1)} KB 여유`}
                </span>
              </div>
            </div>

            {/* Slices Legend & Breakdown */}
            <div className="space-y-1.5 text-xs w-full max-w-xs font-mono">
              {flashSlices.map((s) => {
                const pct = +((s.bytes / totalFlashBytes) * 100).toFixed(1);
                const isHovered = hoveredSlice === s.id;
                return (
                  <div
                    key={s.id}
                    onMouseEnter={() => setHoveredSlice(s.id)}
                    onMouseLeave={() => setHoveredSlice(null)}
                    className={`flex items-center justify-between p-1.5 rounded-lg transition cursor-pointer ${
                      isHovered ? 'bg-slate-800/80 ring-1 ring-white/20' : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-slate-300 truncate font-sans">{s.nameKo}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-white font-bold">
                        {s.bytes >= 1024 ? `${(s.bytes / 1024).toFixed(1)}KB` : `${s.bytes}B`}
                      </span>
                      <span className="text-slate-500 text-[10px] w-10 text-right">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between font-mono">
            <span>예상 잔여 플래시 공간:</span>
            <span className={`font-bold text-xs ${isFlashOverflow ? 'text-rose-400' : 'text-emerald-400'}`}>
              {isFlashOverflow ? `-${Math.abs(flashFreeBytes).toLocaleString()} Bytes 초과!` : `${flashFreeBytes.toLocaleString()} Bytes (${(flashFreeBytes / 1024).toFixed(1)} KB)`}
            </span>
          </div>
        </div>

        {/* Donut 2: Internal SRAM */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                2. 내부 SRAM 메모리 점유 구조 (Internal SRAM)
              </h4>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-bold">
              총 {currentProfile.sram} KB ({totalSramBytes.toLocaleString()} B)
            </span>
          </div>

          {/* Donut Graphic & Center Stats */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
            <div className="relative w-48 h-48 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 180 180" className="w-48 h-48 transform -rotate-90">
                {/* Background Ring */}
                <circle cx="90" cy="90" r="70" fill="none" stroke="#1e293b" strokeWidth="26" />
                {renderDonutSegments(sramSlices, totalSramBytes, true)}
              </svg>

              {/* Center Donut Hole Callout */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[10px] text-slate-400 font-mono">점유율</span>
                <span className={`text-2xl font-black font-mono tracking-tight ${isStackHeapCollision ? 'text-rose-400' : 'text-white'}`}>
                  {sramUsagePct}%
                </span>
                <span className={`text-[11px] font-mono font-bold ${isStackHeapCollision ? 'text-rose-400' : isSramWarning ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {isStackHeapCollision ? '충돌 (COLLISION)' : `${sramFreeMarginBytes} B 마진`}
                </span>
              </div>
            </div>

            {/* Slices Legend & Breakdown */}
            <div className="space-y-1.5 text-xs w-full max-w-xs font-mono">
              {sramSlices.map((s) => {
                const pct = +((s.bytes / totalSramBytes) * 100).toFixed(1);
                const isHovered = hoveredSlice === s.id;
                return (
                  <div
                    key={s.id}
                    onMouseEnter={() => setHoveredSlice(s.id)}
                    onMouseLeave={() => setHoveredSlice(null)}
                    className={`flex items-center justify-between p-1.5 rounded-lg transition cursor-pointer ${
                      isHovered ? 'bg-slate-800/80 ring-1 ring-white/20' : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-slate-300 truncate font-sans">{s.nameKo}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-white font-bold">{s.bytes.toLocaleString()} B</span>
                      <span className="text-slate-500 text-[10px] w-10 text-right">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between font-mono">
            <span>예상 잔여 SRAM 안전 마진:</span>
            <span className={`font-bold text-xs ${isStackHeapCollision ? 'text-rose-400' : isSramWarning ? 'text-amber-400' : 'text-emerald-400'}`}>
              {isStackHeapCollision ? `⚠️ ${Math.abs(sramFreeMarginBytes)} Bytes 스택 침범!` : `${sramFreeMarginBytes.toLocaleString()} Bytes (${sramFreePct}%)`}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Sizing Sliders for Custom Memory Simulation */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              3. 섹션별 메모리 할당 시뮬레이션 슬라이더 (Section Payload Sliders)
            </h4>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            슬라이더를 조절하여 도넛 차트와 잔여 공간의 변화를 실시간 확인하세요.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 text-xs">
          {/* Slider 1: Flash Code (.text) */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold">실행 코드 (.text):</span>
              <span className="text-sky-400 font-bold">{codeKb.toFixed(1)} KB</span>
            </div>
            <input
              type="range"
              min={1}
              max={currentProfile.flash}
              step={0.5}
              value={codeKb}
              onChange={(e) => setCodeKb(parseFloat(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1 KB</span>
              <span>최대 {currentProfile.flash} KB</span>
            </div>
          </div>

          {/* Slider 2: PROGMEM (.rodata) */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold">PROGMEM (.rodata):</span>
              <span className="text-purple-400 font-bold">{progmemBytes.toLocaleString()} B</span>
            </div>
            <input
              type="range"
              min={0}
              max={8000}
              step={100}
              value={progmemBytes}
              onChange={(e) => setProgmemBytes(parseInt(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 B</span>
              <span>8,000 B</span>
            </div>
          </div>

          {/* Slider 3: Initialized Data (.data) */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold">전역 변수 (.data + .bss):</span>
              <span className="text-blue-400 font-bold">{(dataBytes + bssBytes).toLocaleString()} B</span>
            </div>
            <input
              type="range"
              min={32}
              max={totalSramBytes - 256}
              step={32}
              value={dataBytes + bssBytes}
              onChange={(e) => {
                const total = parseInt(e.target.value);
                setDataBytes(Math.round(total * 0.65));
                setBssBytes(Math.round(total * 0.35));
              }}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>32 B</span>
              <span>{totalSramBytes - 256} B</span>
            </div>
          </div>

          {/* Slider 4: Dynamic Heap */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold">동적 힙 (Heap):</span>
              <span className="text-amber-400 font-bold">{heapBytes.toLocaleString()} B</span>
            </div>
            <input
              type="range"
              min={0}
              max={totalSramBytes / 2}
              step={32}
              value={heapBytes}
              onChange={(e) => setHeapBytes(parseInt(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 B</span>
              <span>{Math.round(totalSramBytes / 2)} B</span>
            </div>
          </div>

          {/* Slider 5: Call Stack */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold">콜 스택 (Stack):</span>
              <span className="text-pink-400 font-bold">{stackBytes.toLocaleString()} B</span>
            </div>
            <input
              type="range"
              min={64}
              max={totalSramBytes / 1.5}
              step={32}
              value={stackBytes}
              onChange={(e) => setStackBytes(parseInt(e.target.value))}
              className="w-full accent-pink-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>64 B</span>
              <span>{Math.round(totalSramBytes / 1.5)} B</span>
            </div>
          </div>
        </div>

        {/* Bootloader Type Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono">부트로더 설정:</span>
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setBootloaderType('optiboot')}
                className={`px-3 py-1 rounded-lg font-mono text-xs font-semibold transition ${
                  bootloaderType === 'optiboot' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Optiboot ({selectedMCU === 'atmega328p' ? '512B' : '1KB'})
              </button>
              <button
                onClick={() => setBootloaderType('standard')}
                className={`px-3 py-1 rounded-lg font-mono text-xs font-semibold transition ${
                  bootloaderType === 'standard' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Standard ({selectedMCU === 'atmega2560' ? '8KB' : selectedMCU === 'atmega128' ? '4KB' : '2KB'})
              </button>
              <button
                onClick={() => setBootloaderType('none')}
                className={`px-3 py-1 rounded-lg font-mono text-xs font-semibold transition ${
                  bootloaderType === 'none' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                부트로더 없음 (0B)
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            💡 부트로더를 <strong className="text-white">Optiboot</strong>로 선택 시 표준 대비 최대 1.5KB의 플래시가 즉시 확보됩니다.
          </div>
        </div>
      </div>

      {/* Memory Section Reference Matrix Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-cyan-400" />
            4. 섹션별 주소 배치 & 메모리 특성 일람표 (ELF Section Memory Map)
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            avr-gcc / avr-ld 링커 스크립트 규격
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3 font-semibold">구분</th>
                <th className="p-3 font-semibold">섹션명 (ELF)</th>
                <th className="p-3 font-semibold">섹션 설명</th>
                <th className="p-3 font-semibold text-right">점유 크기</th>
                <th className="p-3 font-semibold text-center">메모리 유형</th>
                <th className="p-3 font-semibold">접근 특성 & 최적화 가이드</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              <tr className="hover:bg-slate-900/40">
                <td className="p-3"><span className="px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/40">Flash</span></td>
                <td className="p-3 font-bold text-sky-300">.text</td>
                <td className="p-3 font-sans">컴파일된 기계어 실행 코드</td>
                <td className="p-3 text-right font-bold text-white">{codeSizeBytes.toLocaleString()} B</td>
                <td className="p-3 text-center text-slate-400">비휘발성 (ROM)</td>
                <td className="p-3 text-[11px] font-sans text-slate-400">PC 레지스터 단일 클럭 인출, -Os 최적화 적용</td>
              </tr>
              <tr className="hover:bg-slate-900/40">
                <td className="p-3"><span className="px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/40">Flash</span></td>
                <td className="p-3 font-bold text-purple-300">.rodata</td>
                <td className="p-3 font-sans">상수 문자열 및 PROGMEM 룩업 테이블</td>
                <td className="p-3 text-right font-bold text-white">{progmemBytes.toLocaleString()} B</td>
                <td className="p-3 text-center text-slate-400">비휘발성 (ROM)</td>
                <td className="p-3 text-[11px] font-sans text-slate-400">LPM 명령어로 3사이클 인출, pgm_read_byte() 사용</td>
              </tr>
              <tr className="hover:bg-slate-900/40">
                <td className="p-3"><span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/40">Flash+RAM</span></td>
                <td className="p-3 font-bold text-blue-300">.data</td>
                <td className="p-3 font-sans">초기화된 전역 및 정적(static) 변수</td>
                <td className="p-3 text-right font-bold text-white">{dataBytes.toLocaleString()} B</td>
                <td className="p-3 text-center text-amber-400">ROM ➔ RAM</td>
                <td className="p-3 text-[11px] font-sans text-slate-400">부팅 시 crt0.o에 의해 플래시에서 SRAM으로 복사됨</td>
              </tr>
              <tr className="hover:bg-slate-900/40">
                <td className="p-3"><span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/40">RAM</span></td>
                <td className="p-3 font-bold text-cyan-300">.bss</td>
                <td className="p-3 font-sans">초기값 없는 전역 변수 (부팅 시 0 클리어)</td>
                <td className="p-3 text-right font-bold text-white">{bssBytes.toLocaleString()} B</td>
                <td className="p-3 text-center text-cyan-400">휘발성 (SRAM)</td>
                <td className="p-3 text-[11px] font-sans text-slate-400">부팅 시 0으로 채워짐, 대형 버퍼 과다 선언 주의</td>
              </tr>
              <tr className="hover:bg-slate-900/40">
                <td className="p-3"><span className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/40">RAM</span></td>
                <td className="p-3 font-bold text-amber-300">Heap</td>
                <td className="p-3 font-sans">동적 힙 할당 영역 (malloc / calloc / new)</td>
                <td className="p-3 text-right font-bold text-white">{heapBytes.toLocaleString()} B</td>
                <td className="p-3 text-center text-amber-400">상향 성장 (▲)</td>
                <td className="p-3 text-[11px] font-sans text-slate-400">단편화 위험, 8비트 AVR에서는 정적 할당 권장</td>
              </tr>
              <tr className="hover:bg-slate-900/40">
                <td className="p-3"><span className="px-2 py-0.5 rounded bg-pink-950 text-pink-400 border border-pink-800/40">RAM</span></td>
                <td className="p-3 font-bold text-pink-300">Stack</td>
                <td className="p-3 font-sans">함수 복귀 주소, 로컬 변수, ISR 컨텍스트</td>
                <td className="p-3 text-right font-bold text-white">{stackBytes.toLocaleString()} B</td>
                <td className="p-3 text-center text-pink-400">하향 성장 (▼)</td>
                <td className="p-3 text-[11px] font-sans text-slate-400">RAMEND에서 시작, 재귀 호출 및 대형 로컬 배열 금지</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
