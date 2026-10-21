import React, { useState, useMemo } from 'react';
import {
  HardDrive,
  Cpu,
  Terminal,
  Copy,
  Check,
  Shield,
  Layers,
  ArrowRight,
  Info,
  HelpCircle,
  FileCode,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  PieChart,
  Box
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

export type BootloaderWordSize = '512W' | '1024W' | '2048W' | '4096W' | '256W';

export type BootloaderType =
  | 'optiboot'
  | 'arduino_isp'
  | 'stk500v1'
  | 'stk500v2'
  | 'urboot'
  | 'custom_dfu';

interface Props {
  selectedMCU: SupportedMCU;
  selectedSize?: BootloaderWordSize;
  onSelectSize?: (size: BootloaderWordSize) => void;
  bootrst?: boolean;
  onToggleBootrst?: (enabled: boolean) => void;
  onApplyHfuse?: (hfuseHex: string) => void;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

interface BootTypeMeta {
  id: BootloaderType;
  name: string;
  tag: string;
  description: string;
  sizeMap: Record<SupportedMCU, { sizeKey: BootloaderWordSize; bytes: number; words: number }>;
  isNoBootloader?: boolean;
}

const BOOTLOADER_TYPES: BootTypeMeta[] = [
  {
    id: 'optiboot',
    name: 'Optiboot (초경량 고속)',
    tag: '512B ~ 1KB 점유',
    description: '공식 아두이노 Uno 및 Mega 표준. 플래시 메모리 낭비를 극소화하여 사용자 앱 공간을 최대로 확보합니다.',
    sizeMap: {
      atmega328p: { sizeKey: '256W', bytes: 512, words: 256 },
      atmega128: { sizeKey: '512W', bytes: 1024, words: 512 },
      atmega640: { sizeKey: '512W', bytes: 1024, words: 512 },
      atmega2560: { sizeKey: '512W', bytes: 1024, words: 512 }
    }
  },
  {
    id: 'arduino_isp',
    name: 'Arduino as ISP / Direct ICSP',
    tag: '0B (부트로더 미사용)',
    description: 'ISP 전용 프로그래머(USBAsp, ArduinoISP)로 직통 다운로드. 부트로더 영역이 없어 플래시 100%를 사용자 앱이 전량 사용합니다.',
    sizeMap: {
      atmega328p: { sizeKey: '256W', bytes: 0, words: 0 },
      atmega128: { sizeKey: '512W', bytes: 0, words: 0 },
      atmega640: { sizeKey: '512W', bytes: 0, words: 0 },
      atmega2560: { sizeKey: '512W', bytes: 0, words: 0 }
    },
    isNoBootloader: true
  },
  {
    id: 'stk500v1',
    name: 'Arduino STK500v1 (표준)',
    tag: '2KB (1024 Words)',
    description: '구형 Arduino Duemilanove 및 기본 ATmegaBOOT. 안정적인 통신 핸드셰이크를 보장합니다.',
    sizeMap: {
      atmega328p: { sizeKey: '1024W', bytes: 2048, words: 1024 },
      atmega128: { sizeKey: '1024W', bytes: 2048, words: 1024 },
      atmega640: { sizeKey: '1024W', bytes: 2048, words: 1024 },
      atmega2560: { sizeKey: '1024W', bytes: 2048, words: 1024 }
    }
  },
  {
    id: 'stk500v2',
    name: 'MegaCore / Wiring STK500v2',
    tag: '4KB (2048 Words)',
    description: 'Arduino Mega 및 대용량 ATmega640/128 계열 표준 부트로더. 64KB 초과 플래시 페이지 쓰기를 지원합니다.',
    sizeMap: {
      atmega328p: { sizeKey: '2048W', bytes: 4096, words: 2048 },
      atmega128: { sizeKey: '2048W', bytes: 4096, words: 2048 },
      atmega640: { sizeKey: '2048W', bytes: 4096, words: 2048 },
      atmega2560: { sizeKey: '2048W', bytes: 4096, words: 2048 }
    }
  },
  {
    id: 'urboot',
    name: 'Urboot (초소형 EEPROM 지원)',
    tag: '1KB (512 Words)',
    description: 'EEPROM 원격 읽기/쓰기 및 자동 보드레이트(Autobaud) 감지 기능을 갖춘 현대식 초소형 부트로더.',
    sizeMap: {
      atmega328p: { sizeKey: '512W', bytes: 1024, words: 512 },
      atmega128: { sizeKey: '512W', bytes: 1024, words: 512 },
      atmega640: { sizeKey: '512W', bytes: 1024, words: 512 },
      atmega2560: { sizeKey: '512W', bytes: 1024, words: 512 }
    }
  },
  {
    id: 'custom_dfu',
    name: 'Custom USB DFU / Dual-Bank OTA',
    tag: '8KB (4096 Words)',
    description: '복합 통신 프로토콜(CAN, USB, Modbus), 암호화 AES-128 서명 검증 및 안전 롤백을 갖춘 산업용 대형 부트로더.',
    sizeMap: {
      atmega328p: { sizeKey: '4096W', bytes: 8192, words: 4096 },
      atmega128: { sizeKey: '4096W', bytes: 8192, words: 4096 },
      atmega640: { sizeKey: '4096W', bytes: 8192, words: 4096 },
      atmega2560: { sizeKey: '4096W', bytes: 8192, words: 4096 }
    }
  }
];

interface BootSizeData {
  words: number;
  bytes: number;
  label: string;
  recommendedBootloader: string;
  description: string;
}

const BOOTLOADER_SIZES: Record<BootloaderWordSize, BootSizeData> = {
  '256W': {
    words: 256,
    bytes: 512,
    label: '256W (512 B)',
    recommendedBootloader: 'Optiboot v8.x (Arduino Uno 표준)',
    description: '최소 크기의 초경량 부트로더. 플래시 메모리 점유율을 1.5% 미만으로 최소화합니다.'
  },
  '512W': {
    words: 512,
    bytes: 1024,
    label: '512W (1,024 B / 1 KB)',
    recommendedBootloader: 'Optiboot Mega / Urboot (1KB)',
    description: 'UART 통신 및 EEPROM 읽기/쓰기 기능이 포함된 컴팩트 부트로더에 적합합니다.'
  },
  '1024W': {
    words: 1024,
    bytes: 2048,
    label: '1024W (2,048 B / 2 KB)',
    recommendedBootloader: '표준 STK500v1 / Arduino Duemilanove',
    description: '안정적인 핸드셰이크 프로토콜 및 다중 통신 속도 자동 감지(Autobaud)를 지원합니다.'
  },
  '2048W': {
    words: 2048,
    bytes: 4096,
    label: '2048W (4,096 B / 4 KB)',
    recommendedBootloader: 'Arduino Mega 2560 STK500v2 표준',
    description: '대형 플래시 페이지 쓰기 및 128KB 초과 확장 주소(RAMPZ) 처리를 위한 고기능 부트로더.'
  },
  '4096W': {
    words: 4096,
    bytes: 8192,
    label: '4096W (8,192 B / 8 KB)',
    recommendedBootloader: 'USB DFU, CAN 버스, 암호화 AES-128 부트로더',
    description: '복합 통신 프로토콜(CAN, USB, Modbus), 암호화 서명 검증, 이중 뱅크 복구 기능을 갖춘 산업용 부트로더.'
  }
};

export const BootloaderSizeCalculator: React.FC<Props> = ({
  selectedMCU,
  selectedSize: propSelectedSize,
  onSelectSize: propOnSelectSize,
  bootrst: propBootrst,
  onToggleBootrst: propOnToggleBootrst,
  onSelectMCU
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Internal state when not controlled
  const [internalSize, setInternalSize] = useState<BootloaderWordSize>(() => {
    return selectedMCU === 'atmega328p' ? '256W' : '512W';
  });
  const [internalBootrst, setInternalBootrst] = useState<boolean>(true);
  const [activeBootType, setActiveBootType] = useState<BootloaderType>('optiboot');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeSize = propSelectedSize !== undefined ? propSelectedSize : internalSize;
  const isBootrstActive = propBootrst !== undefined ? propBootrst : internalBootrst;

  const handleSelectSize = (newSize: BootloaderWordSize) => {
    if (propOnSelectSize) {
      propOnSelectSize(newSize);
    } else {
      setInternalSize(newSize);
    }
  };

  const handleToggleBootrst = (enabled: boolean) => {
    if (propOnToggleBootrst) {
      propOnToggleBootrst(enabled);
    } else {
      setInternalBootrst(enabled);
    }
  };

  const handleSelectBootType = (typeId: BootloaderType) => {
    setActiveBootType(typeId);
    const bootConfig = BOOTLOADER_TYPES.find((t) => t.id === typeId);
    if (bootConfig) {
      if (bootConfig.isNoBootloader) {
        handleToggleBootrst(false);
      } else {
        handleToggleBootrst(true);
        const targetSize = bootConfig.sizeMap[selectedMCU].sizeKey;
        handleSelectSize(targetSize);
      }
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Hardware specs based on MCU
  const mcuHardware = useMemo(() => {
    if (selectedMCU === 'atmega128') {
      return {
        name: 'ATmega128',
        totalFlashBytes: 131072, // 128KB
        totalFlashWords: 65536,  // 64KW
        pageSizeWords: 128,      // 256 bytes
        pageSizeBytes: 256,
        totalPages: 512,
        supportedSizes: ['512W', '1024W', '2048W', '4096W'] as BootloaderWordSize[],
        fuseRegister: 'High Fuse (hfuse)',
        baseHfuseWithoutBoot: 0xC8,
        nrwwBoundaryBytes: 114688,
        nrwwBoundaryWords: 57344
      };
    } else if (selectedMCU === 'atmega640') {
      return {
        name: 'ATmega640',
        totalFlashBytes: 65536,  // 64KB
        totalFlashWords: 32768,  // 32KW
        pageSizeWords: 128,      // 256 bytes
        pageSizeBytes: 256,
        totalPages: 256,
        supportedSizes: ['512W', '1024W', '2048W', '4096W'] as BootloaderWordSize[],
        fuseRegister: 'High Fuse (hfuse)',
        baseHfuseWithoutBoot: 0xD8,
        nrwwBoundaryBytes: 57344,
        nrwwBoundaryWords: 28672
      };
    } else if (selectedMCU === 'atmega2560') {
      return {
        name: 'ATmega2560',
        totalFlashBytes: 262144, // 256KB
        totalFlashWords: 131072, // 128KW
        pageSizeWords: 128,      // 256 bytes
        pageSizeBytes: 256,
        totalPages: 1024,
        supportedSizes: ['512W', '1024W', '2048W', '4096W'] as BootloaderWordSize[],
        fuseRegister: 'High Fuse (hfuse)',
        baseHfuseWithoutBoot: 0xD8,
        nrwwBoundaryBytes: 229376,
        nrwwBoundaryWords: 114688
      };
    } else {
      // ATmega328P
      return {
        name: 'ATmega328P',
        totalFlashBytes: 32768,  // 32KB
        totalFlashWords: 16384,  // 16KW
        pageSizeWords: 32,       // 64 bytes
        pageSizeBytes: 64,
        totalPages: 512,
        supportedSizes: ['256W', '512W', '1024W', '2048W', '4096W'] as BootloaderWordSize[],
        fuseRegister: 'High Fuse (hfuse)',
        baseHfuseWithoutBoot: 0xDC,
        nrwwBoundaryBytes: 28672,
        nrwwBoundaryWords: 14336
      };
    }
  }, [selectedMCU]);

  // Calculation for current MCU + current Size
  const calc = useMemo(() => {
    const isNoBoot = activeBootType === 'arduino_isp';

    let words = isNoBoot ? 0 : BOOTLOADER_SIZES[activeSize].words;
    let bytes = isNoBoot ? 0 : BOOTLOADER_SIZES[activeSize].bytes;

    let bootsz1: 0 | 1 = 1;
    let bootsz0: 0 | 1 = 1;
    let hardwareClamped = false;

    if (!isNoBoot) {
      if (selectedMCU === 'atmega128' || selectedMCU === 'atmega640' || selectedMCU === 'atmega2560') {
        if (activeSize === '512W') {
          bootsz1 = 1;
          bootsz0 = 1;
        } else if (activeSize === '1024W') {
          bootsz1 = 1;
          bootsz0 = 0;
        } else if (activeSize === '2048W') {
          bootsz1 = 0;
          bootsz0 = 1;
        } else if (activeSize === '4096W') {
          bootsz1 = 0;
          bootsz0 = 0;
        } else {
          bootsz1 = 1;
          bootsz0 = 1;
        }
      } else {
        // ATmega328P
        if (activeSize === '256W') {
          bootsz1 = 1;
          bootsz0 = 1;
        } else if (activeSize === '512W') {
          bootsz1 = 1;
          bootsz0 = 0;
        } else if (activeSize === '1024W') {
          bootsz1 = 0;
          bootsz0 = 1;
        } else if (activeSize === '2048W') {
          bootsz1 = 0;
          bootsz0 = 0;
        } else {
          bootsz1 = 0;
          bootsz0 = 0;
          hardwareClamped = true;
        }
      }
    }

    const startWord = mcuHardware.totalFlashWords - words;
    const startByte = mcuHardware.totalFlashBytes - bytes;
    const endWord = mcuHardware.totalFlashWords - 1;
    const endByte = mcuHardware.totalFlashBytes - 1;

    // Remaining Flash Space for User Applications
    const appSizeBytes = isNoBoot ? mcuHardware.totalFlashBytes : startByte;
    const appSizeWords = isNoBoot ? mcuHardware.totalFlashWords : startWord;
    const appEndByte = isNoBoot ? mcuHardware.totalFlashBytes - 1 : startByte - 1;
    const appEndWord = isNoBoot ? mcuHardware.totalFlashWords - 1 : startWord - 1;

    const bootPages = Math.round(bytes / mcuHardware.pageSizeBytes);
    const appPages = Math.round(appSizeBytes / mcuHardware.pageSizeBytes);

    const bootPercent = ((bytes / mcuHardware.totalFlashBytes) * 100).toFixed(1);
    const appPercent = ((appSizeBytes / mcuHardware.totalFlashBytes) * 100).toFixed(1);

    // High Fuse bit calculation
    const bootrstBit = isBootrstActive && !isNoBoot ? 0 : 1;
    const bootszBitsVal = (bootsz1 << 2) | (bootsz0 << 1) | bootrstBit;
    const calculatedHfuse = (mcuHardware.baseHfuseWithoutBoot & ~0x07) | bootszBitsVal;

    const startWordHex = '0x' + startWord.toString(16).toUpperCase().padStart(4, '0');
    const startByteHex = '0x' + startByte.toString(16).toUpperCase().padStart(4, '0');
    const endByteHex = '0x' + endByte.toString(16).toUpperCase().padStart(4, '0');
    const endWordHex = '0x' + endWord.toString(16).toUpperCase().padStart(4, '0');
    const appEndByteHex = '0x' + appEndByte.toString(16).toUpperCase().padStart(4, '0');
    const hfuseHex = '0x' + (calculatedHfuse & 0xFF).toString(16).toUpperCase().padStart(2, '0');

    return {
      isNoBoot,
      words,
      bytes,
      bootPages,
      appPages,
      bootsz1,
      bootsz0,
      bootrstBit,
      hardwareClamped,
      startWord,
      startByte,
      endWord,
      endByte,
      appSizeBytes,
      appSizeWords,
      appEndByte,
      appEndWord,
      bootPercent,
      appPercent,
      startWordHex,
      startByteHex,
      endWordHex,
      endByteHex,
      appEndByteHex,
      hfuseHex
    };
  }, [selectedMCU, activeSize, isBootrstActive, mcuHardware, activeBootType]);

  // Code snippets
  const gccLdFlag = calc.isNoBoot
    ? `# ISP 직접 플래싱 (부트로더 없음 - 0x0000 시작)`
    : `-Wl,--section-start=.text=${calc.startByteHex}`;

  const makefileSnippet = calc.isNoBoot
    ? `# ISP 직접 업로드 (부트로더 미사용 - Flash 100% 가용)
TARGET_MCU     = ${selectedMCU}
FLASH_AVAILABLE = ${mcuHardware.totalFlashBytes} Bytes (${mcuHardware.totalFlashBytes / 1024} KB)
BOOTRST_FUSE   = 1 (Unprogrammed - 리셋 시 0x0000 실행)
LDFLAGS        += -Wl,--relax`
    : `# AVR-GCC Bootloader Configuration for ${mcuHardware.name}
TARGET_MCU      = ${selectedMCU}
BOOT_START_HEX   = ${calc.startByteHex}
BOOT_SIZE_WORDS  = ${calc.words}
USER_APP_SPACE   = ${calc.appSizeBytes} Bytes (${(calc.appSizeBytes / 1024).toFixed(1)} KB)

# 링커 옵션: .text 섹션을 부트로더 시작 주소로 재배치
LDFLAGS += -Wl,--section-start=.text=$(BOOT_START_HEX)
LDFLAGS += -Wl,--relax

# 부트로더 코드 크기 검증 매크로
CFLAGS += -DBOOT_START=$(BOOT_START_HEX) -DBOOT_SIZE=$(BOOT_SIZE_WORDS)`;

  const avrdudeHfuseCmd = `avrdude -c usbasp -p ${
    selectedMCU === 'atmega640' ? 'm640' : selectedMCU === 'atmega128' ? 'm128' : 'm328p'
  } -U hfuse:w:${calc.hfuseHex}:m`;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-2">
            <HardDrive className="w-3.5 h-3.5" /> Bootloader Size & Application Flash Calculator
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            부트로더 크기 및 잔여 플래시 계산기 (Bootloader Size Calculator)
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
              {mcuHardware.name} ({mcuHardware.totalFlashBytes / 1024} KB)
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            타깃 MCU 및 특정 부트로더 유형(<strong>Optiboot, Arduino as ISP, STK500v1/v2, Urboot, Custom DFU</strong>)을 선택하여
            부트로더의 플래시 메모리 점유율과 <strong>사용자 애플리케이션이 실제로 사용할 수 있는 잔여 플래시 메모리 공간</strong>을 정밀 계산합니다.
          </p>
        </div>

        {/* MCU Selector Switcher */}
        {onSelectMCU && (
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0">
            {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcu) => (
              <button
                key={mcu}
                onClick={() => onSelectMCU(mcu)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedMCU === mcu
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {mcu === 'atmega2560' ? 'ATmega2560' : mcu === 'atmega640' ? 'ATmega640' : mcu === 'atmega128' ? 'ATmega128' : 'ATmega328P'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Primary KPI Card: Remaining Flash Memory Space for User Applications */}
      <div className="bg-gradient-to-r from-emerald-950/50 via-slate-950 to-slate-950 border border-emerald-500/40 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">
                사용자 애플리케이션 가용 잔여 플래시 메모리 (Remaining Flash Space)
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono flex items-baseline gap-2">
                <span>{calc.appSizeBytes.toLocaleString()} <span className="text-base text-slate-400 font-normal">Bytes</span></span>
                <span className="text-lg text-emerald-400 font-bold">({(calc.appSizeBytes / 1024).toFixed(2)} KB)</span>
              </div>
            </div>
          </div>
          <div className="text-right sm:border-l sm:border-slate-800 sm:pl-4">
            <div className="text-[11px] text-slate-400">전체 플래시 중 사용자 가용 비율</div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {calc.appPercent}%
            </div>
            <div className="text-[10px] text-slate-500">
              부트로더 점유: {calc.bytes.toLocaleString()}B ({calc.bootPercent}%)
            </div>
          </div>
        </div>

        {/* Visual Progress Bar for Flash Allocation */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-900 h-6 rounded-xl overflow-hidden flex relative border border-slate-800">
            {/* User Application Portion */}
            <div
              style={{ width: `${calc.appPercent}%` }}
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 flex items-center justify-between px-3 text-slate-950 font-bold text-xs select-none transition-all duration-300"
            >
              <span className="font-mono text-[11px] truncate">
                0x0000 ~ {calc.appEndByteHex}
              </span>
              <span className="hidden sm:inline text-[10px] uppercase font-bold tracking-wider">
                User Application ({calc.appPercent}%)
              </span>
            </div>

            {/* Bootloader Portion */}
            {!calc.isNoBoot && (
              <div
                style={{ width: `${calc.bootPercent}%` }}
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 flex items-center justify-center px-1 text-slate-950 font-bold text-[10px] select-none transition-all duration-300 min-w-[50px]"
                title={`부트로더 점유 영역: ${calc.bytes} Bytes (${calc.bootPercent}%)`}
              >
                <span className="font-mono truncate">{calc.bytes < 1024 ? `${calc.bytes}B` : `${calc.bytes / 1024}KB`}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 px-1">
            <span>0x0000 (리셋 벡터)</span>
            <span className="text-emerald-400 font-bold">
              사용자 앱 가용 페이지: {calc.appPages} / {mcuHardware.totalPages} Pages
            </span>
            <span>
              {calc.isNoBoot ? `${calc.endByteHex} (Flash Top - 부트로더 없음)` : `부트로더: ${calc.startByteHex} ~ ${calc.endByteHex}`}
            </span>
          </div>
        </div>
      </div>

      {/* Bootloader Type Selection (e.g., Optiboot, ArduinoISP, STK500v1/v2) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Box className="w-4 h-4 text-cyan-400" />
            부트로더 유형 선택 (Bootloader Type Selector):
          </label>
          <span className="text-[11px] text-slate-400">
            현재 선택: <strong className="text-cyan-300 font-mono">{BOOTLOADER_TYPES.find((t) => t.id === activeBootType)?.name}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BOOTLOADER_TYPES.map((bootType) => {
            const isSelected = activeBootType === bootType.id;
            const targetSizeMeta = bootType.sizeMap[selectedMCU];

            return (
              <button
                key={bootType.id}
                onClick={() => handleSelectBootType(bootType.id)}
                className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400/50'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-white">{bootType.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                        bootType.isNoBootloader
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      }`}
                    >
                      {bootType.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                    {bootType.description}
                  </p>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">
                    {bootType.isNoBootloader ? '부트로더 크기:' : `${mcuHardware.name} 크기:`}
                  </span>
                  <span className="font-bold text-amber-300">
                    {bootType.isNoBootloader
                      ? '0 바이트 (0%)'
                      : `${targetSizeMeta.bytes} Bytes (${targetSizeMeta.words} Words)`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Manual Hardware Word Size Selector & BOOTRST Switch */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              하드웨어 BOOTSZ 퓨즈 비트 및 워드 크기(Word Size) 수동 미세조정:
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              AVR 마이크로컨트롤러는 16비트 명령어 단위(1 Word = 2 Bytes)로 퓨즈 비트(BOOTSZ1:0)를 설정합니다.
            </span>
          </div>

          {/* BOOTRST Quick Switch */}
          <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-xl border border-slate-800 shrink-0">
            <div className="text-left">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-slate-200">BOOTRST</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                    isBootrstActive && !calc.isNoBoot
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isBootrstActive && !calc.isNoBoot ? '0 (Programmed)' : '1 (Unprogrammed)'}
                </span>
              </div>
              <span className="text-[9px] text-slate-400">
                {isBootrstActive && !calc.isNoBoot ? '리셋 시 부트로더 점프' : '리셋 시 0x0000 점프'}
              </span>
            </div>
            <button
              onClick={() => handleToggleBootrst(!isBootrstActive)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isBootrstActive && !calc.isNoBoot ? 'bg-amber-500' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isBootrstActive && !calc.isNoBoot ? 'translate-x-4' : 'translate-x-0'
                }`}
              ></span>
            </button>
          </div>
        </div>

        {/* Word Size Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(['256W', '512W', '1024W', '2048W', '4096W'] as BootloaderWordSize[]).map((sizeKey) => {
            const isSelected = activeSize === sizeKey && !calc.isNoBoot;
            const sizeInfo = BOOTLOADER_SIZES[sizeKey];
            const isSupported = mcuHardware.supportedSizes.includes(sizeKey);

            return (
              <button
                key={sizeKey}
                onClick={() => {
                  setActiveBootType('optiboot');
                  handleSelectSize(sizeKey);
                  handleToggleBootrst(true);
                }}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-400 text-white font-bold'
                    : isSupported
                    ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                    : 'bg-slate-900/40 border-slate-900 text-slate-500'
                }`}
              >
                <div className="font-mono text-xs">{sizeKey}</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {sizeInfo.bytes < 1024 ? `${sizeInfo.bytes}B` : `${sizeInfo.bytes / 1024}KB`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Calculated Results Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Start Address (Byte - GCC Linker) */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1 relative group">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold flex items-center gap-1 text-cyan-400">
              <FileCode className="w-3.5 h-3.5" /> 부트로더 바이트 시작 주소
            </span>
            <button
              onClick={() => copyToClipboard(calc.startByteHex, 'startByte')}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
              title="주소 복사"
            >
              {copiedKey === 'startByte' ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
          <div className="font-mono text-xl font-bold text-cyan-300 tracking-wide">
            {calc.isNoBoot ? '해당 없음 (0x0000)' : calc.startByteHex}
          </div>
          <p className="text-[11px] text-slate-400">
            {calc.isNoBoot ? '부트로더 없이 전역 공간 사용' : `GCC 링커 -Wl,--section-start=.text 입력값`}
          </p>
        </div>

        {/* Card 2: Start Address (Word - Program Counter) */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1 relative group">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold flex items-center gap-1 text-amber-400">
              <Cpu className="w-3.5 h-3.5" /> 프로그램 카운터(PC) 시작 주소
            </span>
            <button
              onClick={() => copyToClipboard(calc.startWordHex, 'startWord')}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
              title="워드 주소 복사"
            >
              {copiedKey === 'startWord' ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
          <div className="font-mono text-xl font-bold text-amber-300 tracking-wide">
            {calc.isNoBoot ? '0x0000' : calc.startWordHex}
          </div>
          <p className="text-[11px] text-slate-400">
            AVR 16비트 하드웨어 PC 점프 주소 (1 Word = 2 Bytes)
          </p>
        </div>

        {/* Card 3: BOOTSZ0 & BOOTSZ1 Fuses */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold text-emerald-400">BOOTSZ1 / BOOTSZ0 퓨즈</span>
            <span className="text-[10px] text-rose-400 font-mono">0=Programmed</span>
          </div>
          <div className="font-mono text-xl font-bold text-white flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-sm ${
                calc.bootsz1 === 0 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-800 text-slate-300'
              }`}
            >
              BOOTSZ1 = {calc.bootsz1}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-sm ${
                calc.bootsz0 === 0 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-800 text-slate-300'
              }`}
            >
              BOOTSZ0 = {calc.bootsz0}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            High Fuse 비트 2, 1 위치 (비트 조합: <code>{calc.bootsz1}{calc.bootsz0}b</code>)
          </p>
        </div>

        {/* Card 4: High Fuse Hex Value */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold text-purple-400">계산된 High Fuse (hfuse)</span>
            <button
              onClick={() => copyToClipboard(calc.hfuseHex, 'hfuse')}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
              title="hfuse 복사"
            >
              {copiedKey === 'hfuse' ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
          <div className="font-mono text-xl font-bold text-purple-300 tracking-wide">
            {calc.hfuseHex}
          </div>
          <p className="text-[11px] text-slate-400">
            BOOTRST({calc.bootrstBit}) 및 BOOTSZ({calc.bootsz1}{calc.bootsz0}) 완성 바이트
          </p>
        </div>
      </div>

      {/* Real-World User Application Capacity & Sizing Guide */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <PieChart className="w-4 h-4 text-emerald-400" />
          남은 플래시 메모리 기반 실제 펌웨어 기능 수용 가능성 분석
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {[
            { name: '기본 센서 + I2C/SPI OLED', sizeKb: 8.5, desc: 'U8g2 / Adafruit_GFX 디스플레이 GUI' },
            { name: '산업용 Modbus / RS485 통신', sizeKb: 14.2, desc: '링버퍼 시리얼 프로토콜 파서' },
            { name: 'SD 카드 로거 + FAT32 FS', sizeKb: 22.0, desc: 'SdFat 라이브러리 및 데이터 로깅' },
            { name: 'FreeRTOS 멀티태스킹 커널', sizeKb: 18.5, desc: '스케줄러, 태스크 큐 및 세마포어' }
          ].map((app, idx) => {
            const fits = calc.appSizeBytes >= app.sizeKb * 1024;
            const remainingAfterApp = calc.appSizeBytes - (app.sizeKb * 1024);

            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  fits
                    ? 'bg-slate-900/60 border-slate-800'
                    : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span className="text-white">{app.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${fits ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-400'}`}>
                      ~{app.sizeKb} KB
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{app.desc}</p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">적재 가능 여부:</span>
                  <span className={fits ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {fits ? `수용 가능 (+${(remainingAfterApp / 1024).toFixed(1)}KB 여유)` : '플래시 부족'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Developer Tooling: avr-gcc flag, Makefile, and avrdude command */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* GCC & Makefile Section */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
              <FileCode className="w-3.5 h-3.5 text-cyan-400" />
              AVR-GCC 링커 플래그 & Makefile 설정
            </span>
            <button
              onClick={() => copyToClipboard(makefileSnippet, 'makefile')}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 text-[10px] transition"
            >
              {copiedKey === 'makefile' ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              {copiedKey === 'makefile' ? '복사됨' : '설정 복사'}
            </button>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] text-slate-400 block">
              1. GCC 링커 스크립트 <code>--section-start</code> 파라미터 (바이트 단위):
            </span>
            <div className="flex items-center justify-between bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 font-mono text-xs text-cyan-300">
              <code>{gccLdFlag}</code>
              <button
                onClick={() => copyToClipboard(gccLdFlag, 'ldflag')}
                className="text-slate-400 hover:text-white text-[10px] ml-2"
              >
                {copiedKey === 'ldflag' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          <pre className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
            {makefileSnippet}
          </pre>
        </div>

        {/* Avrdude Command & Lock Bits */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              avrdude 퓨즈 쓰기 명령어 & Lock Bits 보호
            </span>
            <button
              onClick={() => copyToClipboard(avrdudeHfuseCmd, 'avrdude')}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 text-[10px] transition"
            >
              {copiedKey === 'avrdude' ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              {copiedKey === 'avrdude' ? '복사됨' : '명령어 복사'}
            </button>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] text-slate-400 block">
              High Fuse 단독 업데이트 명령어:
            </span>
            <pre className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-amber-300 overflow-x-auto">
              {avrdudeHfuseCmd}
            </pre>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5 text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-1 text-[11px]">
              <Shield className="w-3.5 h-3.5 text-rose-400" /> 부트로더 손상 방지용 Lock Bits (권장 설정):
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              사용자 애플리케이션의 버그로 인해 <code>SPM</code>(Store Program Memory) 명령어가 부트로더 영역을 덮어쓰는 사고를 방지하려면
              <strong> BLB12=0, BLB11=0 (Lock Bits = 0xCF)</strong>로 프로그래밍하여 부트로더 쓰기를 하드웨어적으로 잠금(Lock)하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
