import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Layers,
  Cpu,
  Database,
  HardDrive,
  Sliders,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  Copy,
  Check,
  Zap,
  ShieldCheck,
  ArrowRight,
  TrendingDown,
  Terminal,
  Activity,
  Maximize2,
  FileCode2,
  Clock,
  Sparkles
} from 'lucide-react';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type MemoryViewMode = 'all' | 'flash' | 'sram' | 'io';

export interface MemorySegmentItem {
  id: string;
  name: string;
  nameKo: string;
  space: 'flash' | 'sram' | 'io';
  startAddrHex: string;
  endAddrHex: string;
  startAddr: number;
  endAddr: number;
  sizeBytes: number;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  accessMode: string;
  accessCycles: string;
  allowedInstructions: string[];
  description: string;
  keyRegistersOrSymbols?: string;
  hardwareNotes: string;
}

export const McuMemorySpaceVisualizer: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  const [viewMode, setViewMode] = useState<MemoryViewMode>('all');
  const [searchAddr, setSearchAddr] = useState<string>('');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('sram_internal');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // MCU specific architecture boundaries
  const mcuArch = useMemo(() => {
    const is328p = selectedMCU === 'atmega328p';
    const is128 = selectedMCU === 'atmega128';
    const is640 = selectedMCU === 'atmega640';
    const is2560 = selectedMCU === 'atmega2560';

    return {
      flashBytes: is2560 ? 256 * 1024 : is128 ? 128 * 1024 : is640 ? 64 * 1024 : 32 * 1024,
      flashWords: is2560 ? 128 * 1024 : is128 ? 64 * 1024 : is640 ? 32 * 1024 : 16 * 1024,
      flashEndHex: is2560 ? '0x3FFFF' : is128 ? '0x1FFFF' : is640 ? '0x0FFFF' : '0x07FFF',
      vectorTableSize: is2560 ? 57 * 4 : is640 ? 57 * 4 : is128 ? 35 * 4 : 26 * 4, // 4 bytes per vector on >8KW
      bootloaderSizeBytes: is328p ? 512 * 2 : 1024 * 2, // default 512W or 1024W
      sramBytes: is2560 || is640 ? 8192 : is128 ? 4096 : 2048,
      sramStartHex: is2560 || is640 ? '0x0200' : '0x0100',
      sramEndHex: is2560 || is640 ? '0x21FF' : is128 ? '0x10FF' : '0x08FF',
      ramendDec: is2560 || is640 ? 0x21ff : is128 ? 0x10ff : 0x08ff,
      extIoCount: is2560 || is640 ? 416 : 160,
      extIoEndHex: is2560 || is640 ? '0x01FF' : '0x00FF',
      hasXmem: is128 || is640 || is2560,
    };
  }, [selectedMCU]);

  // Comprehensive Segments Database per MCU
  const segments = useMemo<MemorySegmentItem[]>(() => {
    const list: MemorySegmentItem[] = [];

    // -------------------------------------------------------------
    // 1. FLASH PROGRAM MEMORY SEGMENTS
    // -------------------------------------------------------------
    // Vector Table
    list.push({
      id: 'flash_vectors',
      name: 'Reset & Interrupt Vectors',
      nameKo: '리셋 및 인터럽트 벡터 테이블',
      space: 'flash',
      startAddrHex: '0x0000',
      endAddrHex: `0x${(mcuArch.vectorTableSize - 1).toString(16).toUpperCase().padStart(4, '0')}`,
      startAddr: 0,
      endAddr: mcuArch.vectorTableSize - 1,
      sizeBytes: mcuArch.vectorTableSize,
      colorClass: 'text-cyan-400',
      borderClass: 'border-cyan-500/50',
      bgClass: 'bg-cyan-950/40',
      accessMode: 'R / Exec (JMP/CALL)',
      accessCycles: '2~3 클럭 (RJMP / JMP)',
      allowedInstructions: ['RESET', 'JMP', 'RJMP', 'LPM'],
      description: 'MCU 파워온 리셋 벡터 및 모든 하드웨어 인터럽트의 분기 점프 주소 테이블입니다.',
      keyRegistersOrSymbols: '__vectors, RESET_vect, INT0_vect, TIMER1_COMPA_vect',
      hardwareNotes: '부트로더 활성화 및 BOOTRST 퓨즈 프로그래밍 시 부트 섹션으로 벡터를 리맵핑할 수 있습니다.',
    });

    // Application Code & PROGMEM
    const appStart = mcuArch.vectorTableSize;
    const appEnd = mcuArch.flashBytes - mcuArch.bootloaderSizeBytes - 1;
    list.push({
      id: 'flash_app',
      name: 'Application Flash (.text & .rodata)',
      nameKo: '사용자 펌웨어 코드 및 PROGMEM 상수 영역',
      space: 'flash',
      startAddrHex: `0x${appStart.toString(16).toUpperCase().padStart(4, '0')}`,
      endAddrHex: `0x${appEnd.toString(16).toUpperCase().padStart(4, '0')}`,
      startAddr: appStart,
      endAddr: appEnd,
      sizeBytes: appEnd - appStart + 1,
      colorClass: 'text-blue-400',
      borderClass: 'border-blue-500/50',
      bgClass: 'bg-blue-950/40',
      accessMode: 'R / Exec (Fetch / LPM)',
      accessCycles: '1 클럭 실행 / 3 클럭 LPM',
      allowedInstructions: ['CALL', 'RCALL', 'ICALL', 'LPM', 'ELPM (2560)'],
      description: '컴파일된 C/C++ 실행 인스트럭션(.text)과 PROGMEM으로 선언된 플래시 상수 테이블(.rodata)이 저장되는 주 메모리입니다.',
      keyRegistersOrSymbols: '.text, .rodata, pgm_read_byte(), RAMPZ',
      hardwareNotes: selectedMCU === 'atmega2560'
        ? '128KB(64KW)를 초과하는 주소는 16비트 포인터로 직접 접근할 수 없으며 RAMPZ 레지스터와 ELPM 명령어를 사용해야 합니다.'
        : '16비트 PC 범위 내에서 고속 1클럭 인스트럭션 페치가 수행됩니다.',
    });

    // Bootloader Section
    const bootStart = mcuArch.flashBytes - mcuArch.bootloaderSizeBytes;
    const bootEnd = mcuArch.flashBytes - 1;
    list.push({
      id: 'flash_boot',
      name: 'Bootloader Flash Section',
      nameKo: '부트로더 영역 (Optiboot / SPM Self-Programming)',
      space: 'flash',
      startAddrHex: `0x${bootStart.toString(16).toUpperCase().padStart(5, '0')}`,
      endAddrHex: `0x${bootEnd.toString(16).toUpperCase().padStart(5, '0')}`,
      startAddr: bootStart,
      endAddr: bootEnd,
      sizeBytes: mcuArch.bootloaderSizeBytes,
      colorClass: 'text-indigo-400',
      borderClass: 'border-indigo-500/50',
      bgClass: 'bg-indigo-950/40',
      accessMode: 'R / W / Exec (SPM Allowed)',
      accessCycles: 'SPM 페이지 기록 3.7ms',
      allowedInstructions: ['SPM (Self-Programming)', 'LPM', 'JMP'],
      description: 'UART 또는 USB를 통해 플래시 메모리를 자체 재기록(In-System Self-Programming)할 수 있는 특권 부트로더 섹션입니다.',
      keyRegistersOrSymbols: 'SPMCSR, BOOTRST, BOOTSZ1:0, Optiboot',
      hardwareNotes: '하드웨어 Lock Bits 설정을 통해 애플리케이션 영역에서 부트로더 코드의 덮어쓰기나 유출을 방지할 수 있습니다.',
    });

    // -------------------------------------------------------------
    // 2. SRAM & DATA SPACE SEGMENTS
    // -------------------------------------------------------------
    // 32 General Purpose Registers
    list.push({
      id: 'sram_registers',
      name: 'General Purpose Registers (R0 ~ R31)',
      nameKo: '32개 범용 작업 레지스터 (R0 ~ R31)',
      space: 'sram',
      startAddrHex: '0x0000',
      endAddrHex: '0x001F',
      startAddr: 0x0000,
      endAddr: 0x001F,
      sizeBytes: 32,
      colorClass: 'text-emerald-400',
      borderClass: 'border-emerald-500/50',
      bgClass: 'bg-emerald-950/40',
      accessMode: 'R / W (Single-Cycle Core ALU)',
      accessCycles: '1 클럭 즉각 연산',
      allowedInstructions: ['MOV', 'ADD', 'SUB', 'AND', 'OR', 'LDI (R16~R31)', 'LD/ST'],
      description: 'CPU ALU와 1클럭 버스로 직결된 32개의 초고속 범용 레지스터입니다. R26~R31은 16비트 포인터 쌍(X, Y, Z 레지스터)으로 동작합니다.',
      keyRegistersOrSymbols: 'R0~R31, X(R27:R26), Y(R29:R28), Z(R31:R30)',
      hardwareNotes: 'LDI(상수 로드) 명령어는 R16~R31에서만 동작하며, Z 레지스터는 플래시 LPM 읽기 및 테이블 간접 점프(IJMP)에 사용됩니다.',
    });

    // Standard I/O Space (0x0020 ~ 0x005F)
    list.push({
      id: 'io_standard',
      name: 'Standard I/O Memory (64 Registers)',
      nameKo: '표준 I/O 메모리 공간 (I/O 0x00 ~ 0x3F)',
      space: 'io',
      startAddrHex: '0x0020',
      endAddrHex: '0x005F',
      startAddr: 0x0020,
      endAddr: 0x005F,
      sizeBytes: 64,
      colorClass: 'text-amber-400',
      borderClass: 'border-amber-500/50',
      bgClass: 'bg-amber-950/40',
      accessMode: 'R / W (IN / OUT / SBI / CBI)',
      accessCycles: '1 클럭 IN/OUT, 1~2 클럭 SBI/CBI',
      allowedInstructions: ['IN', 'OUT', 'SBI (0x00~0x1F)', 'CBI', 'SBIC', 'SBIS'],
      description: '하위 64개의 전통적인 입출력 제어 레지스터입니다. IN/OUT 명령어로 1클럭 읽기/쓰기가 가능하며, 0x00~0x1F는 SBI/CBI로 1비트 원자적 조작이 가능합니다.',
      keyRegistersOrSymbols: 'PORTB, DDRB, PINB, SREG, SPL/SPH, TCCR0A/B, MCUCR',
      hardwareNotes: '데이터 공간 주소(0x0020~0x005F)에서 0x0020을 빼면 I/O 공간 주소(0x00~0x3F)가 됩니다.',
    });

    // Extended I/O Space (0x0060 ~ 0x00FF or 0x01FF)
    const extIoEnd = mcuArch.extIoCount === 416 ? 0x01ff : 0x00ff;
    list.push({
      id: 'io_extended',
      name: 'Extended I/O Memory (Extended SFRs)',
      nameKo: '확장 I/O 메모리 공간 (Extended SFRs)',
      space: 'io',
      startAddrHex: '0x0060',
      endAddrHex: mcuArch.extIoEndHex,
      startAddr: 0x0060,
      endAddr: extIoEnd,
      sizeBytes: mcuArch.extIoCount,
      colorClass: 'text-orange-400',
      borderClass: 'border-orange-500/50',
      bgClass: 'bg-orange-950/40',
      accessMode: 'R / W (LDS / STS Only)',
      accessCycles: '2 클럭 LDS / STS',
      allowedInstructions: ['LDS', 'STS', 'LDD', 'STD'],
      description: '현대적인 고기능 AVR에서 추가된 타이머, 16채널 ADC, 다중 USART, 절전 PRR 등을 수용하기 위한 확장 I/O 공간입니다.',
      keyRegistersOrSymbols: 'TIMSK1, UCSR0B, ADCSRA, PRR, EICRA, WDTCSR',
      hardwareNotes: '중요: IN/OUT 및 SBI/CBI 명령어를 사용할 수 없으며, 반드시 2클럭 메모리 매핑 명령어(LDS/STS)로만 읽고 써야 합니다.',
    });

    // Internal SRAM
    const sramStart = extIoEnd + 1;
    const sramEnd = sramStart + mcuArch.sramBytes - 1;
    list.push({
      id: 'sram_internal',
      name: 'Internal SRAM (.data, .bss, Heap & Stack)',
      nameKo: '내부 SRAM 데이터 메모리 (.data, .bss, 힙 및 콜 스택)',
      space: 'sram',
      startAddrHex: mcuArch.sramStartHex,
      endAddrHex: mcuArch.sramEndHex,
      startAddr: sramStart,
      endAddr: sramEnd,
      sizeBytes: mcuArch.sramBytes,
      colorClass: 'text-teal-400',
      borderClass: 'border-teal-500/50',
      bgClass: 'bg-teal-950/40',
      accessMode: 'R / W (LD / ST / PUSH / POP)',
      accessCycles: '2 클럭 LD/ST, 2 클럭 PUSH/POP',
      allowedInstructions: ['LD', 'ST', 'LDS', 'STS', 'PUSH', 'POP', 'RCALL'],
      description: '런타임 전역 변수(.data/.bss), malloc() 동적 힙(Heap), 그리고 함수 복귀 주소와 로컬 변수가 푸시되는 콜 스택(Call Stack)이 위치합니다.',
      keyRegistersOrSymbols: 'SP(Stack Pointer = RAMEND), __heap_start, __bss_start',
      hardwareNotes: `스택은 최상단 RAMEND(${mcuArch.sramEndHex})에서 아래로 자라고, 힙은 .bss 끝에서 위로 자랍니다. 두 영역이 맞닿으면 스택 오버플로우 크래시가 발생합니다.`,
    });

    // External Memory (if supported)
    if (mcuArch.hasXmem) {
      list.push({
        id: 'sram_xmem',
        name: 'External Memory Space (XMEM Interface)',
        nameKo: '외부 메모리 확장 공간 (XMEM 핀 버스 인터페이스)',
        space: 'sram',
        startAddrHex: `0x${(sramEnd + 1).toString(16).toUpperCase().padStart(4, '0')}`,
        endAddrHex: '0xFFFF',
        startAddr: sramEnd + 1,
        endAddr: 0xffff,
        sizeBytes: 0xffff - (sramEnd + 1) + 1,
        colorClass: 'text-purple-400',
        borderClass: 'border-purple-500/50',
        bgClass: 'bg-purple-950/40',
        accessMode: 'R / W (External Bus Cycles)',
        accessCycles: '2~4 클럭 (Wait States 프로그래밍 가능)',
        allowedInstructions: ['LD', 'ST', 'LDS', 'STS'],
        description: 'Port A/C 및 ALE(Address Latch Enable) 핀을 활성화하여 최대 56~60KB의 외장 SRAM 또는 메모리 매핑 주변장치를 연결하는 버스입니다.',
        keyRegistersOrSymbols: 'XMCRB, XMCRA, ALE, RD, WR',
        hardwareNotes: '외부 SRAM을 사용할 경우 Port A와 Port C의 일반 GPIO 기능이 16비트 주소/데이터 멀티플렉스 버스로 전환됩니다.',
      });
    }

    return list;
  }, [selectedMCU, mcuArch]);

  // Selected Segment Details
  const selectedSegment = useMemo(() => {
    return segments.find((s) => s.id === selectedSegmentId) || segments[0];
  }, [segments, selectedSegmentId]);

  // Address Search Result
  const searchMatch = useMemo(() => {
    const q = searchAddr.trim().toLowerCase();
    if (!q) return null;

    let targetNum = NaN;
    if (q.startsWith('0x')) {
      targetNum = parseInt(q.slice(2), 16);
    } else {
      targetNum = parseInt(q, 10);
    }

    if (isNaN(targetNum)) return null;

    // Search across all segments
    return segments.find((s) => targetNum >= s.startAddr && targetNum <= s.endAddr) || null;
  }, [searchAddr, segments]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              MCU 3대 메모리 공간 맵 시각화
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono">
                {currentProfile.name}
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
            현재 선택된 {currentProfile.name}의 <strong>플래시(Program)</strong>, <strong>SRAM(Data)</strong>,
            그리고 <strong>I/O 레지스터(Standard &amp; Extended SFR)</strong> 3대 메모리 공간의 물리적 경계와
            어셈블리 접근 인스트럭션, 링커 배치 섹션을 한눈에 대조 분석합니다.
          </p>
        </div>

        {/* View Mode Filters */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0 text-xs">
          {(
            [
              { id: 'all', label: '3대 영역 나란히' },
              { id: 'flash', label: '플래시 (Flash)' },
              { id: 'sram', label: '데이터 (SRAM)' },
              { id: 'io', label: 'I/O 레지스터' },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id)}
              className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
                viewMode === mode.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Interactive Address Search & Lookup Bar */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="메모리 주소 검색 (예: 0x0044, 0x0100, 0x08FF, 0x24)..."
              value={searchAddr}
              onChange={(e) => setSearchAddr(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {searchMatch ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">검색 결과:</span>
              <span className={`px-2 py-0.5 rounded font-bold font-mono ${searchMatch.bgClass} ${searchMatch.colorClass} border ${searchMatch.borderClass}`}>
                {searchMatch.nameKo} ({searchMatch.startAddrHex} ~ {searchMatch.endAddrHex})
              </span>
            </div>
          ) : searchAddr.trim() ? (
            <span className="text-xs text-slate-500">일치하는 영역 없음</span>
          ) : null}
        </div>

        {/* Quick Statistics Tag Bar */}
        <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
          <span className="px-2 py-0.5 rounded bg-blue-950/40 text-blue-300 border border-blue-800/40">
            Flash: {currentProfile.flash}KB
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
            SRAM: {currentProfile.sram}KB
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/40">
            I/O: 64 Std + {mcuArch.extIoCount} Ext
          </span>
          <span className="px-2 py-0.5 rounded bg-teal-950/40 text-teal-300 border border-teal-800/40">
            RAMEND: {mcuArch.sramEndHex}
          </span>
        </div>
      </div>

      {/* 3. Three-Column Side-by-Side Visual Memory Space Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* Column 1: Flash Program Memory (플래시 프로그램 공간) */}
        {(viewMode === 'all' || viewMode === 'flash') && (
          <div className="bg-slate-950/80 border border-blue-500/30 rounded-2xl p-4 space-y-3 shadow-lg flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    1. 플래시 프로그램 메모리 (Flash)
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40 font-mono font-bold">
                  {currentProfile.flash} KB ({mcuArch.flashWords / 1024} KW)
                </span>
              </div>

              <div className="text-[11px] text-slate-400 leading-snug">
                비휘발성 플래시 공간으로 16비트 워드(Word) 단위 인스트럭션 및 PROGMEM 상수가 상주합니다.
              </div>

              {/* Flash Segments Stack */}
              <div className="space-y-2 pt-1">
                {segments
                  .filter((s) => s.space === 'flash')
                  .map((seg) => {
                    const isSelected = selectedSegmentId === seg.id;
                    const isHighlighted = searchMatch?.id === seg.id;

                    return (
                      <div
                        key={seg.id}
                        onClick={() => setSelectedSegmentId(seg.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                          isSelected
                            ? 'ring-2 ring-blue-400 shadow-md shadow-blue-950/50 ' + seg.bgClass + ' ' + seg.borderClass
                            : isHighlighted
                            ? 'ring-2 ring-amber-400 ' + seg.bgClass
                            : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold font-mono ${seg.colorClass}`}>
                            {seg.nameKo}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 font-bold">
                            {seg.sizeBytes >= 1024
                              ? `${(seg.sizeBytes / 1024).toFixed(1)} KB`
                              : `${seg.sizeBytes} B`}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                          <span>{seg.startAddrHex}</span>
                          <span className="text-slate-600">➔</span>
                          <span>{seg.endAddrHex}</span>
                        </div>

                        <div className="mt-1.5 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 truncate max-w-[150px]">
                            {seg.allowedInstructions.slice(0, 3).join(', ')}
                          </span>
                          <span className="text-blue-300 text-[9px] font-mono">
                            {seg.accessMode.split(' ')[0]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="pt-2 text-[10px] text-slate-500 font-mono border-t border-slate-800/60">
              Address Scale: 0x0000 ➔ {mcuArch.flashEndHex}
            </div>
          </div>
        )}

        {/* Column 2: Data Memory & Internal SRAM (데이터 공간 및 내부 SRAM) */}
        {(viewMode === 'all' || viewMode === 'sram') && (
          <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-4 space-y-3 shadow-lg flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    2. 데이터 메모리 &amp; SRAM
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-mono font-bold">
                  {currentProfile.sram} KB (RAMEND: {mcuArch.sramEndHex})
                </span>
              </div>

              <div className="text-[11px] text-slate-400 leading-snug">
                R0~R31 레지스터, I/O 맵 및 내부 SRAM이 단일 선형 주소 공간으로 매핑됩니다.
              </div>

              {/* SRAM Segments Stack */}
              <div className="space-y-2 pt-1">
                {segments
                  .filter((s) => s.space === 'sram')
                  .map((seg) => {
                    const isSelected = selectedSegmentId === seg.id;
                    const isHighlighted = searchMatch?.id === seg.id;

                    return (
                      <div
                        key={seg.id}
                        onClick={() => setSelectedSegmentId(seg.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                          isSelected
                            ? 'ring-2 ring-emerald-400 shadow-md shadow-emerald-950/50 ' + seg.bgClass + ' ' + seg.borderClass
                            : isHighlighted
                            ? 'ring-2 ring-amber-400 ' + seg.bgClass
                            : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold font-mono ${seg.colorClass}`}>
                            {seg.nameKo}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 font-bold">
                            {seg.sizeBytes >= 1024
                              ? `${(seg.sizeBytes / 1024).toFixed(1)} KB`
                              : `${seg.sizeBytes} B`}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                          <span>{seg.startAddrHex}</span>
                          <span className="text-slate-600">➔</span>
                          <span>{seg.endAddrHex}</span>
                        </div>

                        <div className="mt-1.5 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 truncate max-w-[150px]">
                            {seg.allowedInstructions.slice(0, 3).join(', ')}
                          </span>
                          <span className="text-emerald-300 text-[9px] font-mono">
                            {seg.accessMode.split(' ')[0]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="pt-2 text-[10px] text-slate-500 font-mono border-t border-slate-800/60 flex items-center justify-between">
              <span>Stack: RAMEND({mcuArch.sramEndHex}) ↓</span>
              <span>Heap: .bss ↑</span>
            </div>
          </div>
        )}

        {/* Column 3: I/O Memory Space (I/O 레지스터 공간) */}
        {(viewMode === 'all' || viewMode === 'io') && (
          <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 space-y-3 shadow-lg flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    3. I/O 레지스터 메모리 (SFR)
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40 font-mono font-bold">
                  64 Std + {mcuArch.extIoCount} Ext
                </span>
              </div>

              <div className="text-[11px] text-slate-400 leading-snug">
                1클럭 IN/OUT(표준 I/O)과 2클럭 LDS/STS(확장 I/O)의 물리적 명령어가 구분됩니다.
              </div>

              {/* IO Segments Stack */}
              <div className="space-y-2 pt-1">
                {segments
                  .filter((s) => s.space === 'io')
                  .map((seg) => {
                    const isSelected = selectedSegmentId === seg.id;
                    const isHighlighted = searchMatch?.id === seg.id;

                    return (
                      <div
                        key={seg.id}
                        onClick={() => setSelectedSegmentId(seg.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                          isSelected
                            ? 'ring-2 ring-amber-400 shadow-md shadow-amber-950/50 ' + seg.bgClass + ' ' + seg.borderClass
                            : isHighlighted
                            ? 'ring-2 ring-cyan-400 ' + seg.bgClass
                            : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold font-mono ${seg.colorClass}`}>
                            {seg.nameKo}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 font-bold">
                            {seg.sizeBytes} 개 SFR
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                          <span>{seg.startAddrHex}</span>
                          <span className="text-slate-600">➔</span>
                          <span>{seg.endAddrHex}</span>
                        </div>

                        <div className="mt-1.5 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 truncate max-w-[150px]">
                            {seg.accessCycles}
                          </span>
                          <span className="text-amber-300 text-[9px] font-mono">
                            {seg.allowedInstructions[0]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="pt-2 text-[10px] text-slate-500 font-mono border-t border-slate-800/60">
              Boundary: 0x005F(Std) vs 0x0060(Ext)
            </div>
          </div>
        )}
      </div>

      {/* 4. Interactive Selected Segment Deep-Dive Inspector */}
      {selectedSegment && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${selectedSegment.bgClass} border ${selectedSegment.borderClass}`} />
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{selectedSegment.nameKo}</span>
                <span className="text-xs text-slate-400 font-mono">({selectedSegment.name})</span>
              </h4>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                주소 범위: {selectedSegment.startAddrHex} ~ {selectedSegment.endAddrHex}
              </span>
              <span className="px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                크기: {selectedSegment.sizeBytes >= 1024 ? `${(selectedSegment.sizeBytes / 1024).toFixed(1)} KB` : `${selectedSegment.sizeBytes} Bytes`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Box 1: Hardware Access & Instructions */}
            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800/80 space-y-2">
              <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                하드웨어 접근 규격 &amp; 명령어
              </span>
              <div className="space-y-1 text-slate-300">
                <div>
                  <span className="text-slate-500">액세스 모드: </span>
                  <strong className="text-white font-mono">{selectedSegment.accessMode}</strong>
                </div>
                <div>
                  <span className="text-slate-500">소요 클럭 주기: </span>
                  <span className="text-emerald-400 font-mono">{selectedSegment.accessCycles}</span>
                </div>
                <div>
                  <span className="text-slate-500">사용 가능 어셈블리: </span>
                  <div className="flex flex-wrap gap-1 mt-1 font-mono">
                    {selectedSegment.allowedInstructions.map((ins, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-slate-950 text-cyan-300 border border-slate-800 text-[10px]">
                        {ins}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Box 2: Description & Linker Details */}
            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800/80 space-y-2">
              <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                영역 개요 &amp; 링커 심볼
              </span>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {selectedSegment.description}
              </p>
              {selectedSegment.keyRegistersOrSymbols && (
                <div className="pt-1 text-[11px] font-mono text-slate-400">
                  <span className="text-slate-500">주요 심볼/레지스터: </span>
                  <span className="text-amber-200">{selectedSegment.keyRegistersOrSymbols}</span>
                </div>
              )}
            </div>

            {/* Box 3: Hardware Design Notes */}
            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800/80 space-y-2">
              <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                MCU 하드웨어 설계 유의사항
              </span>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {selectedSegment.hardwareNotes}
              </p>
              <div className="pt-1">
                <button
                  onClick={() =>
                    copyToClipboard(
                      `// ${selectedSegment.nameKo} (${selectedSegment.startAddrHex} - ${selectedSegment.endAddrHex})\n` +
                      `#define SEGMENT_START ${selectedSegment.startAddrHex}\n` +
                      `#define SEGMENT_SIZE  ${selectedSegment.sizeBytes}`
                    )
                  }
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono flex items-center gap-1 transition"
                >
                  {copiedText ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  <span>주소 매크로 복사</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
