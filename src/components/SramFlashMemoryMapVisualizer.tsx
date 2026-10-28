import React, { useState, useMemo } from 'react';
import {
  Layers,
  Cpu,
  Database,
  HardDrive,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Copy,
  Check,
  Zap,
  ShieldCheck,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Maximize2,
  Terminal,
  Activity,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  HelpCircle
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type MemoryDomainTab = 'flash' | 'data_sram' | 'combined';

interface BootloaderSizeOption {
  bootszBits: string;
  words: number;
  bytes: number;
  kb: number;
  bootStartWord: number;
  bootStartByte: number;
  label: string;
  popularNote?: string;
}

export const SramFlashMemoryMapVisualizer: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Active Memory Domain Tab (Program Flash vs Data/SRAM Space)
  const [activeDomain, setActiveDomain] = useState<MemoryDomainTab>('combined');

  // Bootloader Toggle: Standard (No Bootloader) vs 'Bootloader-Enabled'
  const [isBootloaderEnabled, setIsBootloaderEnabled] = useState<boolean>(true);

  // Selected Bootloader Size (index in options)
  const [selectedBootszIndex, setSelectedBootszIndex] = useState<number>(0);

  // Selected Segment for Deep Inspector
  const [selectedSegmentKey, setSelectedSegmentKey] = useState<string>('app_flash');

  // Copy Status
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // MCU Architecture Specifications
  const mcuSpecs = useMemo(() => {
    switch (selectedMCU) {
      case 'atmega2560':
        return {
          name: 'ATmega2560',
          flashBytes: 256 * 1024,
          flashWords: 128 * 1024,
          flashHexEnd: '0x3FFFF',
          pcBytes: 3,
          vectorCount: 57,
          vectorSizeBytes: 57 * 4, // 4 bytes (JMP)
          vectorHexEnd: '0x00E3',
          sramBytes: 8192,
          sramStartHex: '0x0200',
          sramEndHex: '0x21FF',
          ioRegCount: 64,
          extIoRegCount: 416,
          extIoEndHex: '0x01FF',
          hasXmem: true,
          defaultBootszIndex: 2, // 8KB STK500v2 default
          bootOptions: [
            { bootszBits: '11', words: 1024, bytes: 2048, kb: 2, bootStartWord: 0x1FC00, bootStartByte: 0x3F800, label: '1024 Words (2 KB)' },
            { bootszBits: '10', words: 2048, bytes: 4096, kb: 4, bootStartWord: 0x1F800, bootStartByte: 0x3F000, label: '2048 Words (4 KB)' },
            { bootszBits: '01', words: 4096, bytes: 8192, kb: 8, bootStartWord: 0x1F000, bootStartByte: 0x3E000, label: '4096 Words (8 KB)', popularNote: 'Arduino Mega 2560 STK500v2 기본값' },
            { bootszBits: '00', words: 8192, bytes: 16384, kb: 16, bootStartWord: 0x1E000, bootStartByte: 0x3C000, label: '8192 Words (16 KB)' }
          ] as BootloaderSizeOption[]
        };
      case 'atmega128':
        return {
          name: 'ATmega128',
          flashBytes: 128 * 1024,
          flashWords: 64 * 1024,
          flashHexEnd: '0x1FFFF',
          pcBytes: 2,
          vectorCount: 35,
          vectorSizeBytes: 35 * 4, // 4 bytes (JMP)
          vectorHexEnd: '0x008B',
          sramBytes: 4096,
          sramStartHex: '0x0100',
          sramEndHex: '0x10FF',
          ioRegCount: 64,
          extIoRegCount: 160,
          extIoEndHex: '0x00FF',
          hasXmem: true,
          defaultBootszIndex: 1, // 2KB or 4KB
          bootOptions: [
            { bootszBits: '11', words: 512, bytes: 1024, kb: 1, bootStartWord: 0xFE00, bootStartByte: 0x1FC00, label: '512 Words (1 KB)' },
            { bootszBits: '10', words: 1024, bytes: 2048, kb: 2, bootStartWord: 0xFC00, bootStartByte: 0x1F800, label: '1024 Words (2 KB)', popularNote: 'Optiboot MegaCore 호환' },
            { bootszBits: '01', words: 2048, bytes: 4096, kb: 4, bootStartWord: 0xF800, bootStartByte: 0x1F000, label: '2048 Words (4 KB)' },
            { bootszBits: '00', words: 4096, bytes: 8192, kb: 8, bootStartWord: 0xF000, bootStartByte: 0x1E000, label: '4096 Words (8 KB)' }
          ] as BootloaderSizeOption[]
        };
      case 'atmega640':
        return {
          name: 'ATmega640',
          flashBytes: 64 * 1024,
          flashWords: 32 * 1024,
          flashHexEnd: '0x0FFFF',
          pcBytes: 2,
          vectorCount: 57,
          vectorSizeBytes: 57 * 4,
          vectorHexEnd: '0x00E3',
          sramBytes: 8192,
          sramStartHex: '0x0200',
          sramEndHex: '0x21FF',
          ioRegCount: 64,
          extIoRegCount: 416,
          extIoEndHex: '0x01FF',
          hasXmem: true,
          defaultBootszIndex: 1,
          bootOptions: [
            { bootszBits: '11', words: 512, bytes: 1024, kb: 1, bootStartWord: 0x7E00, bootStartByte: 0xFC00, label: '512 Words (1 KB)' },
            { bootszBits: '10', words: 1024, bytes: 2048, kb: 2, bootStartWord: 0x7C00, bootStartByte: 0xF800, label: '1024 Words (2 KB)', popularNote: 'MegaCore 양산 권장' },
            { bootszBits: '01', words: 2048, bytes: 4096, kb: 4, bootStartWord: 0x7800, bootStartByte: 0xF000, label: '2048 Words (4 KB)' },
            { bootszBits: '00', words: 4096, bytes: 8192, kb: 8, bootStartWord: 0x7000, bootStartByte: 0xE000, label: '4096 Words (8 KB)' }
          ] as BootloaderSizeOption[]
        };
      case 'atmega328p':
      default:
        return {
          name: 'ATmega328P',
          flashBytes: 32 * 1024,
          flashWords: 16 * 1024,
          flashHexEnd: '0x7FFF',
          pcBytes: 2,
          vectorCount: 26,
          vectorSizeBytes: 26 * 4, // 26 vectors * 4 bytes (JMP)
          vectorHexEnd: '0x0067',
          sramBytes: 2048,
          sramStartHex: '0x0100',
          sramEndHex: '0x08FF',
          ioRegCount: 64,
          extIoRegCount: 160,
          extIoEndHex: '0x00FF',
          hasXmem: false,
          defaultBootszIndex: 0, // 512B Optiboot
          bootOptions: [
            { bootszBits: '11', words: 256, bytes: 512, kb: 0.5, bootStartWord: 0x3F00, bootStartByte: 0x7E00, label: '256 Words (512 Bytes / 0.5 KB)', popularNote: 'Arduino Uno Optiboot 표준 (초소형)' },
            { bootszBits: '10', words: 512, bytes: 1024, kb: 1.0, bootStartWord: 0x3E00, bootStartByte: 0x7C00, label: '512 Words (1024 Bytes / 1.0 KB)' },
            { bootszBits: '01', words: 1024, bytes: 2048, kb: 2.0, bootStartWord: 0x3C00, bootStartByte: 0x7800, label: '1024 Words (2048 Bytes / 2.0 KB)', popularNote: '구형 Arduino Duemilanove / ATmegaBOOT' },
            { bootszBits: '00', words: 2048, bytes: 4096, kb: 4.0, bootStartWord: 0x3800, bootStartByte: 0x7000, label: '2048 Words (4096 Bytes / 4.0 KB)' }
          ] as BootloaderSizeOption[]
        };
    }
  }, [selectedMCU]);

  // Current Bootloader Option
  const currentBootOption = mcuSpecs.bootOptions[selectedBootszIndex] || mcuSpecs.bootOptions[0];

  // Dynamic Calculation: Flash Memory Sections
  const flashLayout = useMemo(() => {
    const vectorBytes = mcuSpecs.vectorSizeBytes;
    const totalFlash = mcuSpecs.flashBytes;

    if (!isBootloaderEnabled) {
      // Standard Layout (No Bootloader)
      const appBytes = totalFlash - vectorBytes;
      const appStartByte = vectorBytes;
      const appEndByte = totalFlash - 1;

      return {
        vectorBytes,
        vectorStartHex: '0x000000',
        vectorEndHex: `0x${(vectorBytes - 1).toString(16).toUpperCase().padStart(6, '0')}`,
        appBytes,
        appKb: appBytes / 1024,
        appStartHex: `0x${appStartByte.toString(16).toUpperCase().padStart(6, '0')}`,
        appEndHex: `0x${appEndByte.toString(16).toUpperCase().padStart(6, '0')}`,
        appPct: (appBytes / totalFlash) * 100,
        bootBytes: 0,
        bootKb: 0,
        bootStartHex: 'N/A',
        bootEndHex: 'N/A',
        bootPct: 0,
        bootWords: 0,
        bootszBits: '11 (Unprogrammed)',
        bootrstBit: '1 (Unprogrammed - Reset to 0x0000)',
        totalFlashKb: totalFlash / 1024
      };
    } else {
      // 'Bootloader-Enabled' Layout
      const bootBytes = currentBootOption.bytes;
      const bootStartByte = currentBootOption.bootStartByte;
      const bootEndByte = totalFlash - 1;

      const appBytes = totalFlash - vectorBytes - bootBytes;
      const appStartByte = vectorBytes;
      const appEndByte = bootStartByte - 1;

      return {
        vectorBytes,
        vectorStartHex: '0x000000',
        vectorEndHex: `0x${(vectorBytes - 1).toString(16).toUpperCase().padStart(6, '0')}`,
        appBytes,
        appKb: appBytes / 1024,
        appStartHex: `0x${appStartByte.toString(16).toUpperCase().padStart(6, '0')}`,
        appEndHex: `0x${appEndByte.toString(16).toUpperCase().padStart(6, '0')}`,
        appPct: (appBytes / totalFlash) * 100,
        bootBytes,
        bootKb: currentBootOption.kb,
        bootStartHex: `0x${bootStartByte.toString(16).toUpperCase().padStart(6, '0')}`,
        bootEndHex: `0x${bootEndByte.toString(16).toUpperCase().padStart(6, '0')}`,
        bootPct: (bootBytes / totalFlash) * 100,
        bootWords: currentBootOption.words,
        bootszBits: currentBootOption.bootszBits,
        bootrstBit: '0 (Programmed - Reset to BOOT_START)',
        totalFlashKb: totalFlash / 1024
      };
    }
  }, [mcuSpecs, isBootloaderEnabled, currentBootOption]);

  // Delta calculation between Standard and Bootloader-Enabled
  const comparisonDelta = useMemo(() => {
    const stdAppBytes = mcuSpecs.flashBytes - mcuSpecs.vectorSizeBytes;
    const curAppBytes = flashLayout.appBytes;
    const byteDiff = stdAppBytes - curAppBytes;
    const pctDiff = (byteDiff / stdAppBytes) * 100;

    return {
      byteDiff,
      kbDiff: byteDiff / 1024,
      pctDiff
    };
  }, [mcuSpecs, flashLayout]);

  // Data Memory (SRAM & I/O Space) Layout
  const dataLayout = useMemo(() => {
    return {
      registers: {
        title: '32 General Purpose Registers (R0 ~ R31)',
        startHex: '0x0000',
        endHex: '0x001F',
        bytes: 32,
        desc: '단일 클럭 사이클 산술/논리 연산 레지스터 (X, Y, Z 16비트 포인터 페어 포함)',
        access: '1 사이클 직접 레지스터 조작'
      },
      standardIo: {
        title: '64 Standard I/O Registers',
        startHex: '0x0020',
        endHex: '0x005F',
        bytes: 64,
        desc: '포트 제어(PORTx, DDRx, PINx), 타이머(TCCRx), 인터럽트 플래그. in / out / cbi / sbi 명령 사용',
        access: '1 사이클 I/O 전용 명령 (0x00~0x3F)'
      },
      extIo: {
        title: `Extended I/O Registers (${mcuSpecs.extIoRegCount} Bytes)`,
        startHex: '0x0060',
        endHex: mcuSpecs.extIoEndHex,
        bytes: mcuSpecs.extIoRegCount,
        desc: '확장 타이머, 다중 USART, 추가 ADC 채널 제어 레지스터. 메모리 맵 방식으로 접근',
        access: '2 사이클 lds / sts 메모리 매핑 명령'
      },
      internalSram: {
        title: `Internal Data SRAM (${mcuSpecs.sramBytes / 1024} KB / ${mcuSpecs.sramBytes} Bytes)`,
        startHex: mcuSpecs.sramStartHex,
        endHex: mcuSpecs.sramEndHex,
        bytes: mcuSpecs.sramBytes,
        desc: '.data(초기화 전역 변수), .bss(0초기화 변수), Heap(malloc 동적할당), Stack(함수 호출 & 인터럽트 문맥 저장)',
        access: '2 사이클 ld / st 간접 주소 지정'
      },
      hasXmem: mcuSpecs.hasXmem,
      xmem: mcuSpecs.hasXmem
        ? {
            title: 'External SRAM (XMEM Interface, 최대 64 KB)',
            startHex: `0x${(parseInt(mcuSpecs.sramEndHex, 16) + 1).toString(16).toUpperCase()}`,
            endHex: '0xFFFF',
            desc: 'Port A/C를 통한 외부 비휘발성 SRAM 또는 확장 RAM 버스 인터페이스 (XMCRB 제어)',
            access: '대기 사이클(Wait States) 포함 버스 사이클'
          }
        : null
    };
  }, [mcuSpecs]);

  // Copy handler
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
    confetti({
      particleCount: 20,
      spread: 45,
      origin: { y: 0.8 }
    });
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <Layers className="w-3.5 h-3.5" /> SRAM / Flash Memory Map Visualizer
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              Data & I/O Space + Program Flash Layout
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-xs font-mono font-bold">
              {currentProfile.name}
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            SRAM/Flash 메모리 맵 시각화 도구
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {currentProfile.name}의 <strong>Data Space(범용 레지스터, 표준/확장 I/O, 내부 SRAM)</strong> 및{' '}
            <strong>Program Memory(Flash ROM)</strong>의 물리적 주소 배치를 그래픽으로 시각화하고,{' '}
            <strong className="text-amber-300">표준 레이아웃</strong>과{' '}
            <strong className="text-cyan-300">부트로더 활성화(Bootloader-Enabled) 레이아웃</strong>을 토글하여 실제 펌웨어가 사용할 수 있는 애플리케이션 가용 공간의 변화를 직관적으로 비교합니다.
          </p>
        </div>

        {/* Quick MCU Switcher */}
        {onSelectMCU && (
          <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 shrink-0">
            {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
              <button
                key={mcuId}
                onClick={() => onSelectMCU(mcuId)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                  selectedMCU === mcuId
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {MCU_PROFILES[mcuId].name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Control Toolbar: 1. Mode Toggle (Standard vs Bootloader-Enabled), 2. Bootloader Size Slider/Buttons, 3. View Switcher */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/70 pb-4">
          {/* Main Toggle: Standard vs Bootloader-Enabled */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-300">레이아웃 모드 전환:</span>
            <div className="flex items-center p-1 bg-slate-900 rounded-2xl border border-slate-800">
              <button
                onClick={() => setIsBootloaderEnabled(false)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  !isBootloaderEnabled
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>표준 단독 모드 (Standard Layout)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950/40 font-mono">No Bootloader</span>
              </button>
              <button
                onClick={() => setIsBootloaderEnabled(true)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  isBootloaderEnabled
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>부트로더 활성화 (Bootloader-Enabled)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950/40 font-mono">SPM / BOOTSZ</span>
              </button>
            </div>
          </div>

          {/* Domain Tab Switcher */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-mono mr-1">표시 영역:</span>
            {(['combined', 'flash', 'data_sram'] as MemoryDomainTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveDomain(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeDomain === tab
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white bg-slate-900/50'
                }`}
              >
                {tab === 'combined' && '전체 통합 뷰 (Combined)'}
                {tab === 'flash' && '플래시 ROM 뷰'}
                {tab === 'data_sram' && '데이터 SRAM & I/O 뷰'}
              </button>
            ))}
          </div>
        </div>

        {/* Bootloader Size (BOOTSZ) Selector (Visible when Bootloader is enabled) */}
        {isBootloaderEnabled && (
          <div className="space-y-2 pt-1 animate-fade-in">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                부트로더 할당 크기 선택 (BOOTSZ Fuse Configuration):
              </label>
              <span className="text-xs font-mono text-cyan-400 font-bold">
                BOOTSZ = {currentBootOption.bootszBits}b ({currentBootOption.bytes} 바이트 / {currentBootOption.words} 워드)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {mcuSpecs.bootOptions.map((opt, idx) => {
                const isSelected = selectedBootszIndex === idx;
                return (
                  <button
                    key={opt.bootszBits}
                    onClick={() => setSelectedBootszIndex(idx)}
                    className={`p-3 rounded-xl border text-left transition ${
                      isSelected
                        ? 'bg-cyan-950/50 border-cyan-500 text-white shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold font-mono text-cyan-300">{opt.label}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        BOOTSZ={opt.bootszBits}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-1">
                      시작: 0x{opt.bootStartByte.toString(16).toUpperCase()}
                    </div>
                    {opt.popularNote && (
                      <div className="text-[10px] text-amber-400 font-medium mt-1 leading-snug">
                        ★ {opt.popularNote}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Real-time Dynamic Comparison Banner */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
        {/* Stat 1: Total Flash */}
        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
          <span className="text-slate-400 block text-[11px]">총 플래시 용량</span>
          <span className="text-xl font-black text-white">{flashLayout.totalFlashKb} KB</span>
          <span className="text-slate-500 block text-[10px] mt-0.5">0x000000 ~ {flashLayout.appEndHex}</span>
        </div>

        {/* Stat 2: Vector Table */}
        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
          <span className="text-slate-400 block text-[11px]">인터럽트 벡터 테이블</span>
          <span className="text-xl font-black text-rose-400">{flashLayout.vectorBytes} B</span>
          <span className="text-slate-500 block text-[10px] mt-0.5">{mcuSpecs.vectorCount}개 벡터 (각 4B)</span>
        </div>

        {/* Stat 3: Usable Application Space */}
        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-cyan-500/30">
          <span className="text-slate-400 block text-[11px]">실제 가용 애플리케이션 공간</span>
          <span className="text-xl font-black text-cyan-400">
            {flashLayout.appKb.toFixed(2)} KB
          </span>
          <span className="text-cyan-300/80 block text-[10px] mt-0.5">
            {flashLayout.appPct.toFixed(1)}% ({flashLayout.appBytes.toLocaleString()} Bytes)
          </span>
        </div>

        {/* Stat 4: Bootloader Overhead & Delta */}
        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-amber-500/30">
          <span className="text-slate-400 block text-[11px]">부트로더 점유 및 공간 변동</span>
          <span className="text-xl font-black text-amber-400">
            {isBootloaderEnabled ? `${flashLayout.bootKb} KB` : '0 KB'}
          </span>
          <span className="text-amber-300/80 block text-[10px] mt-0.5">
            {isBootloaderEnabled ? (
              <span className="text-amber-300 font-bold">
                표준 대비 -{comparisonDelta.kbDiff.toFixed(2)} KB (-{comparisonDelta.pctDiff.toFixed(2)}%)
              </span>
            ) : (
              <span className="text-emerald-400">100% 앱 공간 할당됨</span>
            )}
          </span>
        </div>
      </div>

      {/* Graphical Memory Map Visualizer Section */}
      <div className="space-y-6">
        {/* Flash Memory Map Graphical Bar */}
        {(activeDomain === 'combined' || activeDomain === 'flash') && (
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  1. 프로그램 메모리 (Flash ROM: {flashLayout.totalFlashKb} KB) 레이아웃
                </h4>
              </div>
              <span className="text-xs font-mono text-slate-400">
                주소 범위: 0x000000 ~ {mcuSpecs.flashHexEnd}
              </span>
            </div>

            {/* Proportional Memory Bar Container */}
            <div className="space-y-2">
              <div className="h-14 w-full bg-slate-900 rounded-2xl p-1.5 flex gap-1 border border-slate-800 overflow-hidden shadow-inner">
                {/* 1. Vector Table Segment */}
                <div
                  onClick={() => setSelectedSegmentKey('vector_table')}
                  style={{ width: `${Math.max(3, (flashLayout.vectorBytes / mcuSpecs.flashBytes) * 100 * 2.5)}%` }}
                  className="h-full bg-rose-500/80 hover:bg-rose-500 rounded-xl transition cursor-pointer flex items-center justify-center relative group shadow-sm"
                  title={`Vector Table: ${flashLayout.vectorBytes} Bytes (0x000000 ~ ${flashLayout.vectorEndHex})`}
                >
                  <span className="text-[10px] font-mono font-bold text-white truncate px-1">
                    Vect
                  </span>
                </div>

                {/* 2. Application Flash Segment (RWW) */}
                <div
                  onClick={() => setSelectedSegmentKey('app_flash')}
                  style={{
                    width: `${
                      isBootloaderEnabled
                        ? (flashLayout.appBytes / mcuSpecs.flashBytes) * 100
                        : ((mcuSpecs.flashBytes - flashLayout.vectorBytes) / mcuSpecs.flashBytes) * 100
                    }%`
                  }}
                  className="h-full bg-cyan-600/80 hover:bg-cyan-500 rounded-xl transition cursor-pointer flex items-center justify-between px-3 relative group shadow-sm"
                >
                  <span className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-200 shrink-0" />
                    애플리케이션 영역 (Application Section: RWW)
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-100 shrink-0">
                    {flashLayout.appKb.toFixed(2)} KB ({flashLayout.appPct.toFixed(1)}%)
                  </span>
                </div>

                {/* 3. Bootloader Segment (NRWW) - only when enabled */}
                {isBootloaderEnabled && (
                  <div
                    onClick={() => setSelectedSegmentKey('boot_flash')}
                    style={{ width: `${Math.max(6, (flashLayout.bootBytes / mcuSpecs.flashBytes) * 100)}%` }}
                    className="h-full bg-amber-500/80 hover:bg-amber-400 rounded-xl transition cursor-pointer flex items-center justify-center px-2 relative group shadow-sm text-slate-950 font-bold"
                  >
                    <span className="text-xs font-mono truncate">
                      부트로더 ({flashLayout.bootKb} KB)
                    </span>
                  </div>
                )}
              </div>

              {/* Memory Address Scale Labels */}
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 px-1">
                <span>0x000000 (리셋 벡터 시작)</span>
                <span>
                  앱 시작: {flashLayout.appStartHex} ➔ 앱 끝:{' '}
                  <strong className="text-cyan-400">{flashLayout.appEndHex}</strong>
                </span>
                {isBootloaderEnabled && (
                  <span>
                    부트로더 시작: <strong className="text-amber-400">{flashLayout.bootStartHex}</strong> ➔ {mcuSpecs.flashHexEnd}
                  </span>
                )}
                {!isBootloaderEnabled && <span>플래시 끝: {mcuSpecs.flashHexEnd}</span>}
              </div>
            </div>

            {/* Quick Layout Legend & Boundary Explanation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  인터럽트 벡터 테이블 (Vector Table)
                </div>
                <div className="text-[11px] text-slate-400">
                  0x0000 ~ {flashLayout.vectorEndHex} ({flashLayout.vectorBytes} 바이트). 리셋 및 각 인터럽트 발생 시 CPU가 점프하는 하드웨어 주소 테이블.
                </div>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-cyan-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                  RWW 영역 (Application Section)
                </div>
                <div className="text-[11px] text-slate-400">
                  {flashLayout.appStartHex} ~ {flashLayout.appEndHex} ({flashLayout.appKb.toFixed(2)} KB).
                  Read-While-Write 허용 구간으로 SPM(자가 플래시 쓰기) 중에도 CPU가 계속 명령어를 페치하여 무정지 실행 가능.
                </div>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  NRWW 영역 (Bootloader Section)
                </div>
                <div className="text-[11px] text-slate-400">
                  {isBootloaderEnabled ? (
                    <>
                      {flashLayout.bootStartHex} ~ {mcuSpecs.flashHexEnd} ({flashLayout.bootKb} KB).
                      No-Read-While-Write 구간. 부트로더 프로그램이 상주하며 SPM 명령어로 RWW 애플리케이션 플래시를 프로그래밍함.
                    </>
                  ) : (
                    <span className="text-slate-500">부트로더 미사용: 전 구간이 애플리케이션 플래시로 개방됨 (0 바이트).</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Memory (SRAM & I/O Space) Graphical Map */}
        {(activeDomain === 'combined' || activeDomain === 'data_sram') && (
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  2. 데이터 공간 (Data Space: 범용 레지스터, I/O 레지스터 & 내부 SRAM) 레이아웃
                </h4>
              </div>
              <span className="text-xs font-mono text-slate-400">
                주소 범위: 0x0000 ~ {mcuSpecs.sramEndHex} (총 {mcuSpecs.sramBytes + dataLayout.registers.bytes + dataLayout.standardIo.bytes + dataLayout.extIo.bytes} 바이트)
              </span>
            </div>

            {/* Proportional Memory Bar Container for Data Space */}
            <div className="space-y-2">
              <div className="h-14 w-full bg-slate-900 rounded-2xl p-1.5 flex gap-1 border border-slate-800 overflow-hidden shadow-inner">
                {/* 1. Working Registers (R0~R31) */}
                <div
                  onClick={() => setSelectedSegmentKey('registers')}
                  style={{ width: '6%' }}
                  className="h-full bg-violet-600/80 hover:bg-violet-500 rounded-xl transition cursor-pointer flex items-center justify-center relative group shadow-sm text-[10px] font-mono font-bold text-white"
                  title="32 Working Registers (0x0000 ~ 0x001F)"
                >
                  R0-31
                </div>

                {/* 2. Standard I/O (0x0020 ~ 0x005F) */}
                <div
                  onClick={() => setSelectedSegmentKey('standard_io')}
                  style={{ width: '10%' }}
                  className="h-full bg-blue-600/80 hover:bg-blue-500 rounded-xl transition cursor-pointer flex items-center justify-center relative group shadow-sm text-[10px] font-mono font-bold text-white"
                  title="64 Standard I/O Registers (0x0020 ~ 0x005F)"
                >
                  Std I/O
                </div>

                {/* 3. Extended I/O (0x0060 ~ 0x00FF / 0x01FF) */}
                <div
                  onClick={() => setSelectedSegmentKey('ext_io')}
                  style={{ width: mcuSpecs.hasXmem ? '16%' : '12%' }}
                  className="h-full bg-indigo-600/80 hover:bg-indigo-500 rounded-xl transition cursor-pointer flex items-center justify-center relative group shadow-sm text-[10px] font-mono font-bold text-white"
                  title={`Extended I/O (${dataLayout.extIo.startHex} ~ ${dataLayout.extIo.endHex})`}
                >
                  Ext I/O
                </div>

                {/* 4. Internal SRAM (.data, .bss, heap, stack) */}
                <div
                  onClick={() => setSelectedSegmentKey('internal_sram')}
                  className="flex-1 h-full bg-emerald-600/80 hover:bg-emerald-500 rounded-xl transition cursor-pointer flex items-center justify-between px-3 relative group shadow-sm"
                >
                  <span className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                    <Database className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                    내부 데이터 SRAM (.data, .bss, Heap, Stack)
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-100 shrink-0">
                    {mcuSpecs.sramBytes / 1024} KB ({mcuSpecs.sramBytes} Bytes)
                  </span>
                </div>

                {/* 5. External SRAM (XMEM) if supported */}
                {mcuSpecs.hasXmem && (
                  <div
                    onClick={() => setSelectedSegmentKey('xmem')}
                    style={{ width: '12%' }}
                    className="h-full bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer flex items-center justify-center px-1 border border-slate-700 text-[10px] font-mono font-bold text-slate-300"
                    title="External SRAM (XMEM Interface: up to 64KB)"
                  >
                    XMEM (외부)
                  </div>
                )}
              </div>

              {/* Data Space Address Scale Labels */}
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 px-1">
                <span>0x0000 (R0 레지스터)</span>
                <span>0x0020 (I/O 포트 시작)</span>
                <span>
                  SRAM 시작: <strong className="text-emerald-400">{mcuSpecs.sramStartHex}</strong>
                </span>
                <span>
                  스택 탑 (RAMEND): <strong className="text-emerald-300">{mcuSpecs.sramEndHex}</strong>
                </span>
              </div>
            </div>

            {/* SRAM Structural Breakdown: Static Data vs Stack */}
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  SRAM 내부 동적 배치 구조 (Memory Sections & Stack Growth)
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  스택 포인터 초기화: SP = {mcuSpecs.sramEndHex} (RAMEND)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">.data 섹션 (초기화 변수)</span>
                  <span className="text-white font-bold">{mcuSpecs.sramStartHex}부터 상향 증가</span>
                </div>
                <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">.bss 섹션 (0초기화 변수)</span>
                  <span className="text-white font-bold">.data 직후 상향 증가</span>
                </div>
                <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Heap 힙 영역 (malloc)</span>
                  <span className="text-amber-400 font-bold">.bss 이후 상향 할당</span>
                </div>
                <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Stack 콜스택 (함수/ISR)</span>
                  <span className="text-cyan-400 font-bold">RAMEND({mcuSpecs.sramEndHex})에서 하향</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Segment Inspector & Fuse Configuration Helper */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols): Detailed Inspector for Selected Memory Segment */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <span className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              선택된 메모리 세그먼트 아키텍처 상세 정보 (Segment Architecture Inspector)
            </span>

            {/* Segment Selector Tabs */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              <button
                onClick={() => setSelectedSegmentKey('app_flash')}
                className={`px-3 py-1.5 rounded-lg font-mono transition ${
                  selectedSegmentKey === 'app_flash'
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                App Flash (RWW)
              </button>
              <button
                onClick={() => setSelectedSegmentKey('boot_flash')}
                className={`px-3 py-1.5 rounded-lg font-mono transition ${
                  selectedSegmentKey === 'boot_flash'
                    ? 'bg-amber-600 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Bootloader (NRWW)
              </button>
              <button
                onClick={() => setSelectedSegmentKey('vector_table')}
                className={`px-3 py-1.5 rounded-lg font-mono transition ${
                  selectedSegmentKey === 'vector_table'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Vector Table
              </button>
              <button
                onClick={() => setSelectedSegmentKey('internal_sram')}
                className={`px-3 py-1.5 rounded-lg font-mono transition ${
                  selectedSegmentKey === 'internal_sram'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Internal SRAM
              </button>
              <button
                onClick={() => setSelectedSegmentKey('standard_io')}
                className={`px-3 py-1.5 rounded-lg font-mono transition ${
                  selectedSegmentKey === 'standard_io'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Standard I/O
              </button>
              <button
                onClick={() => setSelectedSegmentKey('ext_io')}
                className={`px-3 py-1.5 rounded-lg font-mono transition ${
                  selectedSegmentKey === 'ext_io'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Extended I/O
              </button>
            </div>

            {/* Detailed Card for Selected Segment */}
            {selectedSegmentKey === 'app_flash' && (
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-cyan-400 text-sm">애플리케이션 플래시 섹션 (RWW)</span>
                  <span className="font-mono text-slate-400">
                    {flashLayout.appStartHex} ~ {flashLayout.appEndHex}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                  <div className="bg-slate-950 p-2 rounded">
                    <span className="text-slate-500 block">용량</span>
                    <span className="text-white font-bold">{flashLayout.appKb.toFixed(2)} KB</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded">
                    <span className="text-slate-500 block">접근 방식</span>
                    <span className="text-white font-bold">LPM (1~3 cycles)</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded">
                    <span className="text-slate-500 block">자가 프로그래밍</span>
                    <span className="text-emerald-400 font-bold">SPM 쓰기 허용</span>
                  </div>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed pt-1">
                  사용자의 메인 펌웨어 코드가 탑재되는 핵심 플래시 영역입니다. Read-While-Write(RWW) 특성을 보유하여
                  부트로더가 이 영역을 SPM으로 갱신하는 동안에도 CPU는 부트로더 영역의 코드를 중단 없이 실행할 수 있습니다.
                </p>
              </div>
            )}

            {selectedSegmentKey === 'boot_flash' && (
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-amber-400 text-sm">부트로더 플래시 섹션 (NRWW)</span>
                  <span className="font-mono text-slate-400">
                    {flashLayout.bootStartHex} ~ {mcuSpecs.flashHexEnd}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                  <div className="bg-slate-950 p-2 rounded">
                    <span className="text-slate-500 block">할당 크기</span>
                    <span className="text-white font-bold">{flashLayout.bootKb} KB ({flashLayout.bootWords} Words)</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded">
                    <span className="text-slate-500 block">BOOTSZ 퓨즈</span>
                    <span className="text-amber-400 font-bold">{flashLayout.bootszBits}</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded">
                    <span className="text-slate-500 block">SPM 실행 권한</span>
                    <span className="text-emerald-400 font-bold">전체 플래시 라이팅 허용</span>
                  </div>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed pt-1">
                  UART(Optiboot 등)나 USB를 통해 새 펌웨어를 다운로드받아 RWW 플래시에 페이지 단위로 기록하는 부트로더 프로그램 상주 공간입니다.
                  No-Read-While-Write(NRWW) 구간으로, 이 영역에 대한 쓰기/소거 작업 중에는 CPU가 정지(Halt)됩니다.
                </p>
              </div>
            )}

            {selectedSegmentKey === 'vector_table' && (
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-rose-400 text-sm">인터럽트 벡터 테이블 (Interrupt Vector Table)</span>
                  <span className="font-mono text-slate-400">
                    0x000000 ~ {flashLayout.vectorEndHex}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                  <div className="bg-slate-950 p-2 rounded">
                    <span className="text-slate-500 block">총 벡터 개수</span>
                    <span className="text-white font-bold">{mcuSpecs.vectorCount} 개</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded">
                    <span className="text-slate-500 block">벡터당 크기</span>
                    <span className="text-white font-bold">4 바이트 (JMP)</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded">
                    <span className="text-slate-500 block">재배치 지원</span>
                    <span className="text-cyan-400 font-bold">MCUCR (IVSEL) 지원</span>
                  </div>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed pt-1">
                  리셋 및 모든 주변장치 인터럽트(타이머, 외부 인터럽트, USART 등) 발생 시 실행될 점프 명령어(JMP)가 하드웨어적으로 할당된 주소 공간입니다.
                  부트로더 동작 시 `MCUCR` 레지스터의 `IVSEL` 비트를 설정하여 벡터 테이블을 부트로더 섹션 선두로 재배치할 수 있습니다.
                </p>
              </div>
            )}

            {selectedSegmentKey === 'internal_sram' && (
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-emerald-400 text-sm">내부 정적 SRAM (Internal Static RAM)</span>
                  <span className="font-mono text-slate-400">
                    {mcuSpecs.sramStartHex} ~ {mcuSpecs.sramEndHex}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                  <div className="bg-slate-950 p-2 rounded">
                    <span className="text-slate-500 block">SRAM 용량</span>
                    <span className="text-white font-bold">{mcuSpecs.sramBytes / 1024} KB ({mcuSpecs.sramBytes} B)</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded">
                    <span className="text-slate-500 block">접근 사이클</span>
                    <span className="text-emerald-400 font-bold">2 클록 사이클</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded">
                    <span className="text-slate-500 block">스택 탑 (RAMEND)</span>
                    <span className="text-white font-bold">{mcuSpecs.sramEndHex}</span>
                  </div>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed pt-1">
                  프로그램 실행 중 변수값 저장, 함수 매개변수 전달, 반환 주소 보관, ISR 문맥 보존을 수행하는 핵심 메모리입니다.
                  스택(Stack)과 힙(Heap)이 서로를 향해 자라나므로 충돌(Collision) 방지를 위한 여유 마진 설계가 중요합니다.
                </p>
              </div>
            )}

            {selectedSegmentKey === 'standard_io' && (
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-blue-400 text-sm">표준 64 I/O 레지스터 (0x0020 ~ 0x005F)</span>
                  <span className="font-mono text-slate-400">I/O 주소: 0x00 ~ 0x3F</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  포트 레지스터(PORTB, DDRB, PINB) 및 기본 타이머 제어 레지스터가 위치합니다.
                  단일 사이클 명령어인 `in`, `out`, `cbi`, `sbi`를 통해 1클럭(62.5ns @ 16MHz) 안에 즉각적인 비트 토글 및 제어가 가능합니다.
                </p>
              </div>
            )}

            {selectedSegmentKey === 'ext_io' && (
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-indigo-400 text-sm">확장 I/O 레지스터 (Extended I/O Space)</span>
                  <span className="font-mono text-slate-400">
                    {dataLayout.extIo.startHex} ~ {dataLayout.extIo.endHex} ({mcuSpecs.extIoRegCount} Bytes)
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  다채널 타이머(Timer 3, 4, 5) 및 추가 USART(1, 2, 3), 16비트 ADC 제어 레지스터 등이 위치합니다.
                  이 영역은 I/O 전용 명령(`in`/`out`) 대신 메모리 맵 접근 명령인 `lds`/`sts`(2 클럭)로만 읽고 쓸 수 있습니다.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Fuse Bits & Linker Script Generator */}
        <div className="lg:col-span-5 space-y-4">
          {/* Fuse Bits Prescription */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5 font-sans">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                하드웨어 퓨즈비트(Fuse Bits) 설정 가이드
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                BOOTRST & BOOTSZ
              </span>
            </div>

            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between items-center p-2 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-slate-400">BOOTRST (리셋 벡터 선택):</span>
                <span className="text-amber-400 font-bold">
                  {isBootloaderEnabled ? '0 (Programmed: 점프 ➔ 부트로더)' : '1 (Unprogrammed: 점프 ➔ 0x0000)'}
                </span>
              </div>

              <div className="flex justify-between items-center p-2 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-slate-400">BOOTSZ1:0 (부트로더 크기):</span>
                <span className="text-cyan-400 font-bold">
                  {isBootloaderEnabled ? `${flashLayout.bootszBits}b (${flashLayout.bootKb} KB)` : '11b (해제)'}
                </span>
              </div>

              <div className="flex justify-between items-center p-2 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-slate-400">부트로더 시작 진입점:</span>
                <span className="text-emerald-400 font-bold">
                  {isBootloaderEnabled ? flashLayout.bootStartHex : 'N/A (사용 안 함)'}
                </span>
              </div>
            </div>
          </div>

          {/* GNU Linker Script & avr-gcc Flag Snippet */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                GCC 링커 플래그 (-Wl,-Ttext) 생성기
              </span>
              <button
                onClick={() =>
                  handleCopy(
                    isBootloaderEnabled
                      ? `LDFLAGS += -Wl,--section-start=.text=${flashLayout.bootStartHex}`
                      : `# Standard application starting at flash origin\nLDFLAGS += -Wl,-Ttext=0x0000`,
                    'linker'
                  )
                }
                className="inline-flex items-center gap-1 text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 text-[10px] transition"
              >
                {copiedText === 'linker' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedText === 'linker' ? '복사됨' : '복사'}</span>
              </button>
            </div>

            <pre className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto leading-relaxed">
              {isBootloaderEnabled ? (
                <>
                  <span className="text-slate-500"># 부트로더 컴파일 링커 플래그</span>
                  {'\n'}
                  <span className="text-amber-400">LDFLAGS</span> += -Wl,--section-start=.text={flashLayout.bootStartHex}
                  {'\n'}
                  <span className="text-slate-500"># 벡터 테이블 부트로더로 리로케이션 (필요시)</span>
                  {'\n'}
                  MCUCR |= (1 &lt;&lt; IVCE);{'\n'}
                  MCUCR |= (1 &lt;&lt; IVSEL);
                </>
              ) : (
                <>
                  <span className="text-slate-500"># 표준 펌웨어 컴파일 (원점 0x0000 시작)</span>
                  {'\n'}
                  <span className="text-emerald-400">LDFLAGS</span> += -Wl,-Ttext=0x000000
                </>
              )}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
