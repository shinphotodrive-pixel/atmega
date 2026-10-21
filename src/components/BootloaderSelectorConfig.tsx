import React, { useState, useMemo } from 'react';
import {
  HardDrive,
  Cpu,
  Layers,
  Lock,
  Unlock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Terminal,
  Copy,
  Check,
  Sliders,
  RotateCcw,
  Sparkles,
  Info,
  ArrowRight,
  Code2,
  FileCode,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  FolderLock
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU: (mcu: SupportedMCU) => void;
}

export type BootloaderType = 'optiboot' | 'arduino_stk500v1' | 'megacore_stk500v2' | 'urboot' | 'custom_dfu';

interface BootloaderPreset {
  id: BootloaderType;
  name: string;
  badge: string;
  recommendedWords: Record<SupportedMCU, number>; // in words (1 word = 2 bytes)
  protocol: string;
  defaultBaud: number;
  description: string;
  features: string[];
}

const BOOTLOADER_PRESETS: BootloaderPreset[] = [
  {
    id: 'optiboot',
    name: 'Optiboot 8.x (초경량 초고속 표준 부트로더)',
    badge: '추천 (공간 최적화)',
    recommendedWords: {
      atmega328p: 256, // 512 Bytes
      atmega128: 512,  // 1024 Bytes
      atmega640: 512,  // 1024 Bytes
      atmega2560: 512  // 1024 Bytes
    },
    protocol: 'STK500v1',
    defaultBaud: 115200,
    description: 'Arduino Uno / MiniCore 기본 부트로더. 단 512바이트(256워드)만을 차지하여 사용자 애플리케이션 플래시 공간을 극대화합니다.',
    features: ['512B 초소형 바이너리', '115200bps 고속 플래싱', 'EEPROM 쓰기 지원', '소프트웨어 UART 오토 리셋']
  },
  {
    id: 'arduino_stk500v1',
    name: 'Arduino Standard STK500v1 (구형 아두이노 부트로더)',
    badge: '레거시 호환성',
    recommendedWords: {
      atmega328p: 1024, // 2048 Bytes
      atmega128: 1024,  // 2048 Bytes
      atmega640: 1024,  // 2048 Bytes
      atmega2560: 1024  // 2048 Bytes
    },
    protocol: 'STK500v1',
    defaultBaud: 57600,
    description: '과거 Duemilanove / Diecimila 시절 표준 부트로더. 1024워드(2KB) 공간을 점유하며 57600bps 보레이트로 동작합니다.',
    features: ['2KB 플래시 점유', '57600bps 보레이트', '폭넓은 레거시 툴체인 호환성']
  },
  {
    id: 'megacore_stk500v2',
    name: 'MegaCore / Wiring STK500v2 (대용량 플래시 표준)',
    badge: '대용량 MCU 전용',
    recommendedWords: {
      atmega328p: 1024, // 2048 Bytes
      atmega128: 1024,  // 2048 Bytes
      atmega640: 2048,  // 4096 Bytes
      atmega2560: 1024  // 2048 Bytes (Arduino Mega 2560 정품 2KB 표준)
    },
    protocol: 'STK500v2',
    defaultBaud: 115200,
    description: 'ATmega128, ATmega640, ATmega2560 등 64KB 이상의 대용량 플래시 및 16비트 주소 확장을 완벽 지원하는 안정적인 부트로더.',
    features: ['128KB+ 플래시 페이지 번지 확장 지원', '115200bps 통신', '타임아웃 워치독 복구']
  },
  {
    id: 'urboot',
    name: 'Urboot (차세대 모듈형 초소형 부트로더)',
    badge: '최신 오픈소스',
    recommendedWords: {
      atmega328p: 256,
      atmega128: 512,
      atmega640: 512,
      atmega2560: 512
    },
    protocol: 'STK500v1 / Dual',
    defaultBaud: 115200,
    description: 'Stefan Rueger가 개발한 고효율 어셈블리 기반 부트로더로 자동 보레이트 감지 및 워치독 생존 회로를 내장합니다.',
    features: ['자동 보레이트 캘리브레이션', '내부 RC 오실레이터 자동 튜닝', '초소형 풋프린트']
  },
  {
    id: 'custom_dfu',
    name: 'Custom / USB DFU / XMODEM 부트로더',
    badge: '산업용 커스텀',
    recommendedWords: {
      atmega328p: 2048, // 4096 Bytes
      atmega128: 2048,  // 4096 Bytes
      atmega640: 4096,  // 8192 Bytes
      atmega2560: 4096  // 8192 Bytes
    },
    protocol: 'Custom / XMODEM / DFU',
    defaultBaud: 115200,
    description: '산업용 필드 업데이트, 펌웨어 암호화(AES) 무결성 검증, XMODEM CRC 전송을 위해 최대 4096워드(8KB)까지 확장된 부트로더.',
    features: ['AES-128 무결성 검증 공간 확보', 'RS-485 반이중 통신 지원 가능', '대형 버퍼 탑재']
  }
];

export interface BootszConfig {
  words: number;
  bytes: number;
  bootszBits: [number, number]; // [BOOTSZ1, BOOTSZ0]: 0 = programmed, 1 = unprogrammed
  startAddressWord: number;
  startAddressByte: number;
  startHexWord: string;
  startHexByte: string;
}

export const MCU_BOOTSZ_SPECS: Record<SupportedMCU, BootszConfig[]> = {
  atmega328p: [
    {
      words: 256,
      bytes: 512,
      bootszBits: [1, 1], // BOOTSZ1=1, BOOTSZ0=1
      startAddressWord: 0x3F00,
      startAddressByte: 0x7E00,
      startHexWord: '0x3F00',
      startHexByte: '0x7E00'
    },
    {
      words: 512,
      bytes: 1024,
      bootszBits: [1, 0], // BOOTSZ1=1, BOOTSZ0=0
      startAddressWord: 0x3E00,
      startAddressByte: 0x7C00,
      startHexWord: '0x3E00',
      startHexByte: '0x7C00'
    },
    {
      words: 1024,
      bytes: 2048,
      bootszBits: [0, 1], // BOOTSZ1=0, BOOTSZ0=1
      startAddressWord: 0x3C00,
      startAddressByte: 0x7800,
      startHexWord: '0x3C00',
      startHexByte: '0x7800'
    },
    {
      words: 2048,
      bytes: 4096,
      bootszBits: [0, 0], // BOOTSZ1=0, BOOTSZ0=0
      startAddressWord: 0x3800,
      startAddressByte: 0x7000,
      startHexWord: '0x3800',
      startHexByte: '0x7000'
    }
  ],
  atmega128: [
    {
      words: 512,
      bytes: 1024,
      bootszBits: [1, 1],
      startAddressWord: 0xFE00,
      startAddressByte: 0x1FC00,
      startHexWord: '0xFE00',
      startHexByte: '0x1FC00'
    },
    {
      words: 1024,
      bytes: 2048,
      bootszBits: [1, 0],
      startAddressWord: 0xFC00,
      startAddressByte: 0x1F800,
      startHexWord: '0xFC00',
      startHexByte: '0x1F800'
    },
    {
      words: 2048,
      bytes: 4096,
      bootszBits: [0, 1],
      startAddressWord: 0xF800,
      startAddressByte: 0x1F000,
      startHexWord: '0xF800',
      startHexByte: '0x1F000'
    },
    {
      words: 4096,
      bytes: 8192,
      bootszBits: [0, 0],
      startAddressWord: 0xF000,
      startAddressByte: 0x1E000,
      startHexWord: '0xF000',
      startHexByte: '0x1E000'
    }
  ],
  atmega640: [
    {
      words: 512,
      bytes: 1024,
      bootszBits: [1, 1],
      startAddressWord: 0x7E00,
      startAddressByte: 0xFC00,
      startHexWord: '0x7E00',
      startHexByte: '0xFC00'
    },
    {
      words: 1024,
      bytes: 2048,
      bootszBits: [1, 0],
      startAddressWord: 0x7C00,
      startAddressByte: 0xF800,
      startHexWord: '0x7C00',
      startHexByte: '0xF800'
    },
    {
      words: 2048,
      bytes: 4096,
      bootszBits: [0, 1],
      startAddressWord: 0x7800,
      startAddressByte: 0xF000,
      startHexWord: '0x7800',
      startHexByte: '0xF000'
    },
    {
      words: 4096,
      bytes: 8192,
      bootszBits: [0, 0],
      startAddressWord: 0x7000,
      startAddressByte: 0xE000,
      startHexWord: '0x7000',
      startHexByte: '0xE000'
    }
  ],
  atmega2560: [
    {
      words: 1024,
      bytes: 2048,
      bootszBits: [1, 1], // BOOTSZ1=1, BOOTSZ0=1 (2KB Arduino Mega 2560 기본)
      startAddressWord: 0x1FC00,
      startAddressByte: 0x3F800,
      startHexWord: '0x1FC00',
      startHexByte: '0x3F800'
    },
    {
      words: 2048,
      bytes: 4096,
      bootszBits: [1, 0], // BOOTSZ1=1, BOOTSZ0=0 (4KB)
      startAddressWord: 0x1F800,
      startAddressByte: 0x3F000,
      startHexWord: '0x1F800',
      startHexByte: '0x3F000'
    },
    {
      words: 4096,
      bytes: 8192,
      bootszBits: [0, 1], // BOOTSZ1=0, BOOTSZ0=1 (8KB)
      startAddressWord: 0x1F000,
      startAddressByte: 0x3E000,
      startHexWord: '0x1F000',
      startHexByte: '0x3E000'
    },
    {
      words: 8192,
      bytes: 16384,
      bootszBits: [0, 0], // BOOTSZ1=0, BOOTSZ0=0 (16KB)
      startAddressWord: 0x1E000,
      startAddressByte: 0x3C000,
      startHexWord: '0x1E000',
      startHexByte: '0x3C000'
    }
  ]
};

export type LockBitMode = 'mode1' | 'mode2' | 'mode3' | 'mode4';

export const BootloaderSelectorConfig: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const bootszList = MCU_BOOTSZ_SPECS[selectedMCU];

  // Selection states
  const [selectedPresetId, setSelectedPresetId] = useState<BootloaderType>('optiboot');
  const [selectedWordSize, setSelectedWordSize] = useState<number>(() => {
    return BOOTLOADER_PRESETS[0].recommendedWords[selectedMCU] || bootszList[0].words;
  });

  // Boot Reset Vector Fuse (BOOTRST: 0 = Programmed, Reset to BLS; 1 = Unprogrammed, Reset to 0x0000)
  const [bootrst, setBootrst] = useState<boolean>(true); // true = Programmed (0 in bit)

  // Flash Section Lock Bits
  // BLB1: Boot Loader Section Lock Bits (BLB12, BLB11)
  const [blb1Mode, setBlb1Mode] = useState<LockBitMode>('mode2'); // Mode 2: SPM is not allowed to write to BLS (Standard protection)
  // BLB0: Application Section Lock Bits (BLB02, BLB01)
  const [blb0Mode, setBlb0Mode] = useState<LockBitMode>('mode1'); // Mode 1: No restrictions
  // LB: Global Memory Lock Bits (LB2, LB1)
  const [lbMode, setLbMode] = useState<'mode1' | 'mode2' | 'mode3'>('mode1'); // Mode 1: No lock

  const [copiedLinker, setCopiedLinker] = useState<boolean>(false);
  const [copiedAvrdude, setCopiedAvrdude] = useState<boolean>(false);

  // Sync selected word size if MCU changes
  const activeBootsz = useMemo(() => {
    const found = bootszList.find((b) => b.words === selectedWordSize);
    return found || bootszList[0];
  }, [bootszList, selectedWordSize]);

  // Handle Preset Selection
  const handleSelectPreset = (preset: BootloaderPreset) => {
    setSelectedPresetId(preset.id);
    const recWords = preset.recommendedWords[selectedMCU];
    // Find closest valid bootsz
    const match = bootszList.find((b) => b.words === recWords);
    if (match) {
      setSelectedWordSize(match.words);
    } else {
      setSelectedWordSize(bootszList[0].words);
    }
  };

  // Lock Byte Calculation:
  // Bit 7: 1 (Reserved)
  // Bit 6: 1 (Reserved)
  // Bit 5: BLB12
  // Bit 4: BLB11
  // Bit 3: BLB02
  // Bit 2: BLB01
  // Bit 1: LB2
  // Bit 0: LB1
  // (In AVR lock bits: 1 = unprogrammed / permitted, 0 = programmed / locked)
  const lockBitCalculation = useMemo(() => {
    let blb12 = 1;
    let blb11 = 1;
    if (blb1Mode === 'mode2') {
      blb12 = 1;
      blb11 = 0;
    } else if (blb1Mode === 'mode3') {
      blb12 = 0;
      blb11 = 0;
    } else if (blb1Mode === 'mode4') {
      blb12 = 0;
      blb11 = 1;
    }

    let blb02 = 1;
    let blb01 = 1;
    if (blb0Mode === 'mode2') {
      blb02 = 1;
      blb01 = 0;
    } else if (blb0Mode === 'mode3') {
      blb02 = 0;
      blb01 = 0;
    } else if (blb0Mode === 'mode4') {
      blb02 = 0;
      blb01 = 1;
    }

    let lb2 = 1;
    let lb1 = 1;
    if (lbMode === 'mode2') {
      lb2 = 1;
      lb1 = 0;
    } else if (lbMode === 'mode3') {
      lb2 = 0;
      lb1 = 0;
    }

    const lockValue = (1 << 7) | (1 << 6) | (blb12 << 5) | (blb11 << 4) | (blb02 << 3) | (blb01 << 2) | (lb2 << 1) | lb1;
    const lockHex = '0x' + lockValue.toString(16).toUpperCase().padStart(2, '0');

    return {
      blb12,
      blb11,
      blb02,
      blb01,
      lb2,
      lb1,
      lockValue,
      lockHex
    };
  }, [blb1Mode, blb0Mode, lbMode]);

  // High Fuse Calculation for BOOTSZ1:0 & BOOTRST
  const fuseCalculation = useMemo(() => {
    // Standard High Fuse templates
    // ATmega328P: Default High Fuse = 0xD9 (BOOTSZ=00, BOOTRST=1 unprogrammed) or 0xDE (Optiboot 512B BOOTSZ=11, BOOTRST=0)
    // ATmega128: Default High Fuse = 0x99 / 0xC9
    // ATmega640: Default High Fuse = 0x99 / 0xD8
    const [bootsz1, bootsz0] = activeBootsz.bootszBits;
    const bootrstBit = bootrst ? 0 : 1; // 0 = programmed (checked in UI)

    let baseHfuse = 0xD8;
    if (selectedMCU === 'atmega328p') {
      // ATmega328P High Fuse layout:
      // Bit 7: RSTDISBL (1)
      // Bit 6: DWEN (1)
      // Bit 5: SPIEN (0)
      // Bit 4: WDTON (1)
      // Bit 3: EESAVE (1)
      // Bit 2: BOOTSZ1
      // Bit 1: BOOTSZ0
      // Bit 0: BOOTRST
      const hfuse = 0xD0 | (bootsz1 << 2) | (bootsz0 << 1) | bootrstBit;
      return {
        hfuseHex: '0x' + hfuse.toString(16).toUpperCase(),
        bootsz1,
        bootsz0,
        bootrstBit
      };
    } else if (selectedMCU === 'atmega128') {
      // ATmega128 High Fuse:
      // Bit 7: OCDEN (1)
      // Bit 6: JTAGEN (1)
      // Bit 5: SPIEN (0)
      // Bit 4: CKOPT (0)
      // Bit 3: EESAVE (1)
      // Bit 2: BOOTSZ1
      // Bit 1: BOOTSZ0
      // Bit 0: BOOTRST
      const hfuse = 0xC8 | (bootsz1 << 2) | (bootsz0 << 1) | bootrstBit;
      return {
        hfuseHex: '0x' + hfuse.toString(16).toUpperCase(),
        bootsz1,
        bootsz0,
        bootrstBit
      };
    } else {
      // ATmega640 High Fuse:
      const hfuse = 0xD8 | (bootsz1 << 2) | (bootsz0 << 1) | bootrstBit;
      return {
        hfuseHex: '0x' + hfuse.toString(16).toUpperCase(),
        bootsz1,
        bootsz0,
        bootrstBit
      };
    }
  }, [activeBootsz, bootrst, selectedMCU]);

  // Flash Capacity & Sections Breakdown
  const flashMetrics = useMemo(() => {
    const totalFlashBytes = currentProfile.flash * 1024;
    const bootloaderBytes = activeBootsz.bytes;
    const appFlashBytes = totalFlashBytes - bootloaderBytes;
    const appPct = +((appFlashBytes / totalFlashBytes) * 100).toFixed(1);
    const bootPct = +((bootloaderBytes / totalFlashBytes) * 100).toFixed(1);

    return {
      totalFlashBytes,
      totalFlashKb: currentProfile.flash,
      bootloaderBytes,
      bootloaderKb: +(bootloaderBytes / 1024).toFixed(2),
      appFlashBytes,
      appFlashKb: +(appFlashBytes / 1024).toFixed(2),
      appPct,
      bootPct
    };
  }, [currentProfile.flash, activeBootsz]);

  // Generated Linker & Avrdude snippets
  const linkerFlag = `-Wl,--section-start=.text=${activeBootsz.startHexByte}`;
  const avrdudeLockCmd = `avrdude -p ${selectedMCU} -c usbasp -U hfuse:w:${fuseCalculation.hfuseHex}:m -U lock:w:${lockBitCalculation.lockHex}:m`;

  const copyToClipboard = (text: string, type: 'linker' | 'avrdude') => {
    navigator.clipboard.writeText(text);
    if (type === 'linker') {
      setCopiedLinker(true);
      setTimeout(() => setCopiedLinker(false), 2000);
    } else {
      setCopiedAvrdude(true);
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.4 } });
      setTimeout(() => setCopiedAvrdude(false), 2000);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Module Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <HardDrive className="w-3.5 h-3.5" /> Bootloader Selector & Configuration
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              Target: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs font-mono">
              BLS: {activeBootsz.startHexByte} ({activeBootsz.startHexWord} Word)
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-amber-400" />
            부트로더 설정기 & 플래시 섹션 락비트 계산기 (Bootloader & Lock Bits)
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            선택한 ATmega MCU의 플래시 아키텍처에 맞춰 <strong>부트로더 시작 주소(BLS, Word & Byte)</strong>를 자동 산출하고,
            SPM/LPM 접근 차단 및 부트로더 자가 덮어쓰기 방지를 위한 <strong>플래시 섹션 락비트(BLB0, BLB1, LB)</strong>를 계산합니다.
          </p>
        </div>

        {/* MCU Selector Buttons */}
        <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0">
          {(['atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
            <button
              key={mcuId}
              onClick={() => onSelectMCU(mcuId)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                selectedMCU === mcuId
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {MCU_PROFILES[mcuId].name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Inputs & Presets (7 cols) vs Memory Map & Lock Matrix (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Presets & Parameters (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Bootloader Preset Selector */}
          <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 space-y-3">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-amber-400" />
              1. 부트로더 유형(Preset) 선택
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {BOOTLOADER_PRESETS.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                const recWords = preset.recommendedWords[selectedMCU];
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-sm ring-1 ring-amber-500/30'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white truncate pr-1">
                          {preset.name.split('(')[0]}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                          {preset.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                        {preset.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-[10px] font-mono text-slate-500">
                      <span>권장 크기: <strong className="text-amber-400">{recWords}W ({recWords * 2}B)</strong></span>
                      <span className="text-cyan-400">{preset.defaultBaud}bps</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. BOOTSZ Size & Start Address Radio Selection */}
          <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                2. 하드웨어 BOOTSZ 크기 및 부트로더 시작 주소 (BLS)
              </label>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                선택됨: {activeBootsz.bytes} 바이트 ({activeBootsz.words} 워드)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {bootszList.map((cfg) => {
                const isSelected = cfg.words === activeBootsz.words;
                return (
                  <button
                    key={cfg.words}
                    onClick={() => setSelectedWordSize(cfg.words)}
                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/50 text-white shadow-sm ring-1 ring-cyan-500/30'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center font-bold mb-1">
                      <span className="text-white font-mono">{cfg.words} Words ({cfg.bytes} Bytes)</span>
                      <span className="text-[10px] font-mono text-cyan-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                        BOOTSZ = {cfg.bootszBits.join('')}
                      </span>
                    </div>
                    <div className="space-y-0.5 text-[11px] font-mono text-slate-400">
                      <div className="flex justify-between">
                        <span>Word 시작 주소:</span>
                        <span className="text-amber-400 font-bold">{cfg.startHexWord}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Byte 시작 주소 (Linker):</span>
                        <span className="text-emerald-400 font-bold">{cfg.startHexByte}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* BOOTRST Checkbox */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={bootrst}
                  onChange={(e) => setBootrst(e.target.checked)}
                  className="accent-amber-500 rounded w-4 h-4"
                />
                <span className="font-semibold">
                  BOOTRST 퓨즈 프로그래밍 (전원 인가 / 리셋 시 부트로더 번지로 점프)
                </span>
              </label>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${bootrst ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30' : 'text-slate-500 bg-slate-900'}`}>
                {bootrst ? '리셋 벡터 -> BLS' : '리셋 벡터 -> 0x0000'}
              </span>
            </div>
          </div>

          {/* 3. Flash Section Lock Bits Configuration */}
          <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-rose-400" />
                3. 플래시 섹션 락비트 (Flash Section Lock Bits & Memory Security)
              </label>
              <span className="text-[11px] font-mono text-rose-400 font-bold">
                계산된 Lock Byte: {lockBitCalculation.lockHex}
              </span>
            </div>

            {/* BLB1: Boot Loader Section Lock */}
            <div className="space-y-1.5 text-xs">
              <span className="font-semibold text-slate-300 block">
                • 부트로더 영역 보호 (BLB1 Mode - Boot Loader Section):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'mode1', label: 'Mode 1 (11): 제한 없음', desc: 'SPM 및 LPM 자유 접근 허용' },
                  { id: 'mode2', label: 'Mode 2 (10): SPM 쓰기 차단 (권장)', desc: '부트로더가 스스로를 덮어쓰거나 파괴하는 버그 방지' },
                  { id: 'mode3', label: 'Mode 3 (00): SPM 쓰기 + App LPM 차단', desc: '앱에서 부트로더 코드 역공학(IP) 추출 원천 차단' },
                  { id: 'mode4', label: 'Mode 4 (01): App LPM 읽기만 차단', desc: '외부 앱에서의 부트로더 코드 메모리 읽기 제한' }
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setBlb1Mode(m.id as LockBitMode)}
                    className={`p-2 rounded-lg border text-left transition ${
                      blb1Mode === m.id
                        ? 'bg-rose-500/10 border-rose-500/50 text-white font-bold'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-[11px] text-white flex items-center justify-between">
                      <span>{m.label}</span>
                      {blb1Mode === m.id && <Check className="w-3.5 h-3.5 text-rose-400" />}
                    </div>
                    <p className="text-[10px] text-slate-500 font-normal mt-0.5">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* BLB0: Application Section Lock */}
            <div className="space-y-1.5 text-xs">
              <span className="font-semibold text-slate-300 block">
                • 애플리케이션 영역 보호 (BLB0 Mode - Application Section):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'mode1', label: 'Mode 1 (11): 제한 없음 (표준)', desc: '부트로더에서 앱 플래시를 자유롭게 쓰고 업데이트 가능' },
                  { id: 'mode2', label: 'Mode 2 (10): SPM 쓰기 차단', desc: '부트로더가 앱 영역을 덮어쓰지 못하도록 영구 고정' },
                  { id: 'mode3', label: 'Mode 3 (00): 쓰기 및 부트로더 읽기 차단', desc: '부트로더와 앱 영역 상호 격리' },
                  { id: 'mode4', label: 'Mode 4 (01): 부트로더 LPM 읽기 차단', desc: '부트로더에서 앱 코드 읽기 금지' }
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setBlb0Mode(m.id as LockBitMode)}
                    className={`p-2 rounded-lg border text-left transition ${
                      blb0Mode === m.id
                        ? 'bg-amber-500/10 border-amber-500/50 text-white font-bold'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-[11px] text-white flex items-center justify-between">
                      <span>{m.label}</span>
                      {blb0Mode === m.id && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <p className="text-[10px] text-slate-500 font-normal mt-0.5">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* LB: Global Flash & EEPROM Security Lock */}
            <div className="space-y-1.5 text-xs">
              <span className="font-semibold text-slate-300 block">
                • 전역 칩 보안 락 (LB Mode - Chip Erase Protection):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'mode1', label: 'LB Mode 1 (11)', desc: '보안 해제 (개발 모드)' },
                  { id: 'mode2', label: 'LB Mode 2 (10)', desc: '추가 라이팅 금지' },
                  { id: 'mode3', label: 'LB Mode 3 (00)', desc: '펌웨어 덤프/복제 완전 차단' }
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setLbMode(m.id as 'mode1' | 'mode2' | 'mode3')}
                    className={`p-2 rounded-lg border text-left transition ${
                      lbMode === m.id
                        ? 'bg-purple-500/10 border-purple-500/50 text-white font-bold'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-[11px] text-white flex items-center justify-between">
                      <span>{m.label}</span>
                      {lbMode === m.id && <Check className="w-3.5 h-3.5 text-purple-400" />}
                    </div>
                    <p className="text-[10px] text-slate-500 font-normal mt-0.5">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Memory Map Visualization & Output Code / Commands (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Visual Memory Map Card */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                {currentProfile.name} 플래시 메모리 섹션 맵
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                총 {flashMetrics.totalFlashKb} KB
              </span>
            </div>

            {/* Stacked Memory Bar */}
            <div className="space-y-1.5">
              <div className="h-6 bg-slate-900 rounded-xl overflow-hidden flex border border-slate-800 p-0.5">
                {/* App Flash */}
                <div
                  className="bg-gradient-to-r from-emerald-600 to-cyan-600 h-full rounded-l-lg transition-all duration-300 flex items-center justify-center text-[10px] font-mono font-bold text-white shadow-inner"
                  style={{ width: `${flashMetrics.appPct}%` }}
                  title={`Application Section: ${flashMetrics.appFlashKb} KB (${flashMetrics.appPct}%)`}
                >
                  {flashMetrics.appPct > 30 && `App: ${flashMetrics.appFlashKb}KB`}
                </div>
                {/* Bootloader Flash */}
                <div
                  className="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-r-lg transition-all duration-300 flex items-center justify-center text-[10px] font-mono font-bold text-slate-950 shadow-inner"
                  style={{ width: `${Math.max(5, flashMetrics.bootPct)}%` }}
                  title={`Bootloader Section (BLS): ${flashMetrics.bootloaderBytes} Bytes (${flashMetrics.bootPct}%)`}
                >
                  BLS
                </div>
              </div>

              {/* Memory Address Pointers */}
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 px-1">
                <span>0x0000 (Reset Vector)</span>
                <span className="text-amber-400 font-bold">BLS: {activeBootsz.startHexByte}</span>
                <span>0x{(flashMetrics.totalFlashBytes - 1).toString(16).toUpperCase()}</span>
              </div>
            </div>

            {/* Numerical Breakdown Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-0.5">
                <span className="text-[10px] text-slate-400 block">사용자 앱 가용 플래시:</span>
                <span className="text-base font-bold text-emerald-400">
                  {flashMetrics.appFlashKb} <span className="text-xs font-normal">KB</span>
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {flashMetrics.appFlashBytes.toLocaleString()} Bytes ({flashMetrics.appPct}%)
                </span>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-0.5">
                <span className="text-[10px] text-slate-400 block">부트로더 점유 영역:</span>
                <span className="text-base font-bold text-amber-400">
                  {activeBootsz.bytes} <span className="text-xs font-normal">Bytes</span>
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {activeBootsz.words} Words ({flashMetrics.bootPct}%)
                </span>
              </div>
            </div>

            {/* BLS Address Summary Table */}
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Word 주소 (PC 단위):</span>
                <span className="text-cyan-400 font-bold">{activeBootsz.startHexWord}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Byte 주소 (링커/HEX):</span>
                <span className="text-emerald-400 font-bold">{activeBootsz.startHexByte}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">BOOTSZ 비트 (High Fuse):</span>
                <span className="text-amber-400 font-bold">BOOTSZ1={activeBootsz.bootszBits[0]}, BOOTSZ0={activeBootsz.bootszBits[1]}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">계산된 High Fuse (hfuse):</span>
                <span className="text-white font-bold">{fuseCalculation.hfuseHex}</span>
              </div>
            </div>
          </div>

          {/* GNU Linker & Makefile Section Start Flag */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-cyan-400" />
                avr-gcc 링커(Linker) 플래그 설정
              </span>
              <button
                onClick={() => copyToClipboard(linkerFlag, 'linker')}
                className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-mono transition"
              >
                {copiedLinker ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLinker ? '복사됨' : '복사'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto">
              {linkerFlag}
            </pre>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              * avr-gcc 또는 Makefile에서 <code className="text-slate-300">LDFLAGS</code>에 추가하여 부트로더의 <code className="text-slate-300">.text</code> 섹션 진입점을 BLS 바이트 주소로 강제 지정합니다.
            </p>
          </div>

          {/* Avrdude Command Snippet */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-amber-400" />
                avrdude 퓨즈 & 락비트 라이팅 명령어
              </span>
              <button
                onClick={() => copyToClipboard(avrdudeLockCmd, 'avrdude')}
                className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-mono transition"
              >
                {copiedAvrdude ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAvrdude ? '명령어 복사 완료' : '복사'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono text-amber-300 overflow-x-auto select-all leading-relaxed">
              {avrdudeLockCmd}
            </pre>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              * ISP 프로그래머(USBasp 등)를 연결하고 위 명령어를 실행하면 부트로더 파티션 크기(BOOTSZ), 부트 리셋(BOOTRST) 및 락비트(BLB0/BLB1/LB)가 한 번에 칩에 기록됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
