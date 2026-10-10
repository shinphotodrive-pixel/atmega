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
  AlertTriangle
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

export type BootloaderWordSize = '512W' | '1024W' | '2048W' | '4096W' | '256W';

interface Props {
  selectedMCU: SupportedMCU;
  selectedSize: BootloaderWordSize;
  onSelectSize: (size: BootloaderWordSize) => void;
  bootrst: boolean;
  onToggleBootrst: (enabled: boolean) => void;
  onApplyHfuse?: (hfuseHex: string) => void;
}

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
  selectedSize,
  onSelectSize,
  bootrst,
  onToggleBootrst
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
        supportedSizes: ['512W', '1024W', '2048W', '4096W'] as BootloaderWordSize[],
        fuseRegister: 'High Fuse (hfuse)',
        baseHfuseWithoutBoot: 0xC8, // OCDEN=1, JTAGEN=1, SPIEN=0, CKOPT=0, EESAVE=1
        nrwwBoundaryBytes: 114688, // 112KB boundary
        nrwwBoundaryWords: 57344
      };
    } else if (selectedMCU === 'atmega640') {
      return {
        name: 'ATmega640',
        totalFlashBytes: 65536,  // 64KB
        totalFlashWords: 32768,  // 32KW
        pageSizeWords: 128,      // 256 bytes
        pageSizeBytes: 256,
        supportedSizes: ['512W', '1024W', '2048W', '4096W'] as BootloaderWordSize[],
        fuseRegister: 'High Fuse (hfuse)',
        baseHfuseWithoutBoot: 0xD8, // OCDEN=1, JTAGEN=1, SPIEN=0, WDTON=1, EESAVE=1
        nrwwBoundaryBytes: 57344,  // 56KB boundary
        nrwwBoundaryWords: 28672
      };
    } else {
      // atmega328p
      return {
        name: 'ATmega328P',
        totalFlashBytes: 32768,  // 32KB
        totalFlashWords: 16384,  // 16KW
        pageSizeWords: 32,       // 64 bytes
        pageSizeBytes: 64,
        supportedSizes: ['256W', '512W', '1024W', '2048W', '4096W'] as BootloaderWordSize[],
        fuseRegister: 'High Fuse (hfuse)',
        baseHfuseWithoutBoot: 0xDC, // RSTDISBL=1, DWEN=1, SPIEN=0, WDTON=1, EESAVE=1
        nrwwBoundaryBytes: 28672,  // 28KB boundary
        nrwwBoundaryWords: 14336
      };
    }
  }, [selectedMCU]);

  // Calculation for current MCU + current Size
  const calc = useMemo(() => {
    const sizeConfig = BOOTLOADER_SIZES[selectedSize];
    const words = sizeConfig.words;
    const bytes = sizeConfig.bytes;

    let bootsz1: 0 | 1 = 1;
    let bootsz0: 0 | 1 = 1;
    let hardwareClamped = false;

    if (selectedMCU === 'atmega128' || selectedMCU === 'atmega640') {
      // Official AVR table for Mega128/640:
      // 512W  -> BOOTSZ1=1, BOOTSZ0=1
      // 1024W -> BOOTSZ1=1, BOOTSZ0=0
      // 2048W -> BOOTSZ1=0, BOOTSZ0=1
      // 4096W -> BOOTSZ1=0, BOOTSZ0=0
      if (selectedSize === '512W') {
        bootsz1 = 1;
        bootsz0 = 1;
      } else if (selectedSize === '1024W') {
        bootsz1 = 1;
        bootsz0 = 0;
      } else if (selectedSize === '2048W') {
        bootsz1 = 0;
        bootsz0 = 1;
      } else if (selectedSize === '4096W') {
        bootsz1 = 0;
        bootsz0 = 0;
      } else {
        // 256W fallback on Mega128/640:
        bootsz1 = 1;
        bootsz0 = 1;
      }
    } else {
      // ATmega328P:
      // 256W  -> BOOTSZ1=1, BOOTSZ0=1
      // 512W  -> BOOTSZ1=1, BOOTSZ0=0
      // 1024W -> BOOTSZ1=0, BOOTSZ0=1
      // 2048W -> BOOTSZ1=0, BOOTSZ0=0
      // 4096W -> Hardware limit is 2048W (00); custom linker address
      if (selectedSize === '256W') {
        bootsz1 = 1;
        bootsz0 = 1;
      } else if (selectedSize === '512W') {
        bootsz1 = 1;
        bootsz0 = 0;
      } else if (selectedSize === '1024W') {
        bootsz1 = 0;
        bootsz0 = 1;
      } else if (selectedSize === '2048W') {
        bootsz1 = 0;
        bootsz0 = 0;
      } else {
        // 4096W on 328P:
        bootsz1 = 0;
        bootsz0 = 0;
        hardwareClamped = true;
      }
    }

    const startWord = mcuHardware.totalFlashWords - words;
    const startByte = mcuHardware.totalFlashBytes - bytes;
    const endWord = mcuHardware.totalFlashWords - 1;
    const endByte = mcuHardware.totalFlashBytes - 1;

    const appSizeBytes = startByte;
    const appSizeWords = startWord;
    const appEndByte = startByte - 1;
    const appEndWord = startWord - 1;

    const pages = Math.round(bytes / mcuHardware.pageSizeBytes);
    const bootPercent = ((bytes / mcuHardware.totalFlashBytes) * 100).toFixed(1);
    const appPercent = ((appSizeBytes / mcuHardware.totalFlashBytes) * 100).toFixed(1);

    // High Fuse bit calculation
    // Bit 2: BOOTSZ1, Bit 1: BOOTSZ0, Bit 0: BOOTRST (0=programmed, 1=unprogrammed)
    const bootrstBit = bootrst ? 0 : 1;
    const bootszBitsVal = (bootsz1 << 2) | (bootsz0 << 1) | bootrstBit;
    const calculatedHfuse = (mcuHardware.baseHfuseWithoutBoot & ~0x07) | bootszBitsVal;

    const startWordHex = '0x' + startWord.toString(16).toUpperCase().padStart(4, '0');
    const startByteHex = '0x' + startByte.toString(16).toUpperCase().padStart(4, '0');
    const endByteHex = '0x' + endByte.toString(16).toUpperCase().padStart(4, '0');
    const endWordHex = '0x' + endWord.toString(16).toUpperCase().padStart(4, '0');
    const appEndByteHex = '0x' + appEndByte.toString(16).toUpperCase().padStart(4, '0');
    const hfuseHex = '0x' + (calculatedHfuse & 0xFF).toString(16).toUpperCase().padStart(2, '0');

    return {
      sizeConfig,
      words,
      bytes,
      pages,
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
  }, [selectedMCU, selectedSize, bootrst, mcuHardware]);

  // Code snippets
  const gccLdFlag = `-Wl,--section-start=.text=${calc.startByteHex}`;
  const makefileSnippet = `# AVR-GCC Bootloader Configuration for ${mcuHardware.name}
TARGET_MCU    = ${selectedMCU === 'atmega640' ? 'atmega640' : selectedMCU === 'atmega128' ? 'atmega128' : 'atmega328p'}
BOOT_START_HEX = ${calc.startByteHex}
BOOT_SIZE_WORDS = ${calc.words}

# 링커 옵션: .text 섹션을 부트로더 시작 주소로 재배치
LDFLAGS += -Wl,--section-start=.text=$(BOOT_START_HEX)
LDFLAGS += -Wl,--relax

# 부트로더 코드 크기 검증 매크로
CFLAGS += -DBOOT_START=$(BOOT_START_HEX) -DBOOT_SIZE=$(BOOT_SIZE_WORDS)`;

  const avrdudeHfuseCmd = `avrdude -c usbasp -p ${
    selectedMCU === 'atmega640' ? 'm640' : selectedMCU === 'atmega128' ? 'm128' : 'm328p'
  } -U hfuse:w:${calc.hfuseHex}:m`;

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-2">
            <HardDrive className="w-3.5 h-3.5" /> Bootloader Size & Address Engine
          </div>
          <h3 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-2">
            부트로더 크기 및 시작 주소 자동 계산기
            <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
              {mcuHardware.name}
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            원하는 부트로더 워드 크기(512W, 1024W, 2048W, 4096W)를 선택하면
            <strong> BOOTSZ0 / BOOTSZ1 퓨즈 비트</strong>와 Flash 메모리 내
            <strong> 워드 주소(PC) 및 바이트 주소(GCC 링커)</strong>를 즉시 계산합니다.
          </p>
        </div>

        {/* BOOTRST Quick Switch */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-300">BOOTRST 활성화</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  bootrst
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {bootrst ? '0 (Programmed)' : '1 (Unprogrammed)'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 block">
              {bootrst ? '리셋 시 부트로더 주소로 즉시 점프' : '리셋 시 일반 앱(0x0000)으로 점프'}
            </span>
          </div>
          <button
            onClick={() => onToggleBootrst(!bootrst)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              bootrst ? 'bg-amber-500' : 'bg-slate-800'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                bootrst ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Bootloader Size Selector Cards */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" /> 부트로더 워드 크기(Size) 선택 (1 Word = 2 Bytes):
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            선택된 크기: <span className="text-cyan-300 font-bold">{calc.sizeConfig.label}</span> ({calc.bytes} Bytes)
          </span>
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {(['512W', '1024W', '2048W', '4096W', '256W'] as BootloaderWordSize[]).map((sizeKey) => {
            const isSelected = selectedSize === sizeKey;
            const sizeInfo = BOOTLOADER_SIZES[sizeKey];
            const isSupported = mcuHardware.supportedSizes.includes(sizeKey);

            return (
              <button
                key={sizeKey}
                onClick={() => onSelectSize(sizeKey)}
                className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400/50'
                    : isSupported
                    ? 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60'
                    : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:border-slate-800'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-mono font-bold text-sm text-cyan-400">{sizeKey}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({sizeInfo.bytes < 1024 ? `${sizeInfo.bytes}B` : `${sizeInfo.bytes / 1024}KB`})
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-200 line-clamp-1">
                    {sizeInfo.words} Words
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                    {sizeInfo.recommendedBootloader}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-500">페이지 수:</span>
                  <span className="font-bold text-slate-300">
                    {Math.round(sizeInfo.bytes / mcuHardware.pageSizeBytes)} Pages
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {calc.hardwareClamped && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <strong>ATmega328P 실리콘 주의:</strong> ATmega328P의 내장 하드웨어 BOOTSZ 퓨즈 비트는 최대 2048W(4KB)까지만 직접 지원합니다.
              4096W(8KB) 선택 시 BOOTSZ1:0은 '00'(2048W)으로 자동 구성되며, 0x6000 시작 주소는 소프트웨어 링커 스크립트를 통해 바인딩됩니다.
            </div>
          </div>
        )}
      </div>

      {/* Calculated Results Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Start Address (Byte - GCC Linker) */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1 relative group">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold flex items-center gap-1 text-cyan-400">
              <FileCode className="w-3.5 h-3.5" /> 플래시 바이트 시작 주소 (Byte)
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
            {calc.startByteHex}
          </div>
          <p className="text-[11px] text-slate-400">
            10진수 {calc.startByte.toLocaleString()} 바이트 위치 (GCC 링커 <code>-Wl,--section-start=.text</code>에 입력)
          </p>
        </div>

        {/* Card 2: Start Address (Word - Program Counter) */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1 relative group">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold flex items-center gap-1 text-amber-400">
              <Cpu className="w-3.5 h-3.5" /> 프로그램 카운터 시작 주소 (Word)
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
            {calc.startWordHex}
          </div>
          <p className="text-[11px] text-slate-400">
            AVR 16비트 PC 점프 주소 (1 Word = 2 Bytes, <code>jmp {calc.startWordHex}</code>)
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
            BOOTRST({bootrst ? '0' : '1'}) 및 BOOTSZ({calc.bootsz1}{calc.bootsz0}) 포함 완성 바이트
          </p>
        </div>
      </div>

      {/* Fuse Bits Register Map Detail */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            {mcuHardware.fuseRegister} 레지스터 비트 맵 (Bit 7 ~ Bit 0):
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            * AVR 퓨즈는 '0'이 기록됨(Programmed/체크), '1'이 해제(Unprogrammed) 상태입니다.
          </span>
        </div>

        <div className="grid grid-cols-8 gap-1.5 text-center font-mono text-xs">
          {[
            {
              bit: 7,
              name: selectedMCU === 'atmega328p' ? 'RSTDISBL' : 'OCDEN',
              val: 1,
              isTarget: false,
              desc: '외부 리셋 핀 / On-Chip 디버그'
            },
            {
              bit: 6,
              name: selectedMCU === 'atmega328p' ? 'DWEN' : 'JTAGEN',
              val: 1,
              isTarget: false,
              desc: 'DebugWIRE / JTAG 인터페이스'
            },
            {
              bit: 5,
              name: 'SPIEN',
              val: 0,
              isTarget: false,
              desc: 'ISP 프로그래밍 허용 (필수 0)'
            },
            {
              bit: 4,
              name: selectedMCU === 'atmega128' ? 'CKOPT' : 'WDTON',
              val: selectedMCU === 'atmega128' ? 0 : 1,
              isTarget: false,
              desc: '발진기 풀스윙 / 하드웨어 WDT 상시 가동'
            },
            {
              bit: 3,
              name: 'EESAVE',
              val: 1,
              isTarget: false,
              desc: '칩 Erase 시 EEPROM 내용 보존'
            },
            {
              bit: 2,
              name: 'BOOTSZ1',
              val: calc.bootsz1,
              isTarget: true,
              desc: '부트로더 크기 선택 상위 비트'
            },
            {
              bit: 1,
              name: 'BOOTSZ0',
              val: calc.bootsz0,
              isTarget: true,
              desc: '부트로더 크기 선택 하위 비트'
            },
            {
              bit: 0,
              name: 'BOOTRST',
              val: calc.bootrstBit,
              isTarget: true,
              desc: '리셋 시 부트로더 벡터 점프 여부'
            }
          ].map((item) => (
            <div
              key={item.bit}
              className={`p-2 rounded-lg border flex flex-col justify-between ${
                item.isTarget
                  ? 'bg-cyan-950/60 border-cyan-400/80 shadow-md shadow-cyan-500/10'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="text-[10px] text-slate-400 font-sans">Bit {item.bit}</div>
              <div
                className={`font-bold text-[11px] my-1 truncate ${
                  item.isTarget ? 'text-cyan-300 font-extrabold' : 'text-slate-300'
                }`}
                title={item.desc}
              >
                {item.name}
              </div>
              <div
                className={`text-sm font-bold rounded py-0.5 ${
                  item.val === 0
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {item.val}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Visual Memory Allocation Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            {mcuHardware.name} Flash ROM 파티션 비율 다이어그램 (총 {mcuHardware.totalFlashBytes / 1024} KB)
          </span>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
              애플리케이션: {calc.appSizeBytes.toLocaleString()}B ({calc.appPercent}%)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              부트로더: {calc.bytes.toLocaleString()}B ({calc.bootPercent}%)
            </span>
          </div>
        </div>

        {/* Stacked Visual Bar */}
        <div className="w-full bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <div className="h-9 w-full bg-slate-900 rounded-xl overflow-hidden flex relative">
            {/* Application Section */}
            <div
              style={{ width: `${calc.appPercent}%` }}
              className="h-full bg-gradient-to-r from-cyan-600 to-cyan-500 flex items-center justify-between px-3 text-slate-950 font-bold text-xs select-none relative group transition-all duration-300"
            >
              <span className="font-mono text-[11px] truncate">
                0x0000 ~ {calc.appEndByteHex}
              </span>
              <span className="hidden sm:inline text-[10px] uppercase tracking-wider opacity-90">
                Application Code Section
              </span>
            </div>

            {/* Bootloader Section */}
            <div
              style={{ width: `${calc.bootPercent}%` }}
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 flex items-center justify-center px-2 text-slate-950 font-bold text-xs select-none relative group transition-all duration-300 min-w-[50px]"
            >
              <span className="font-mono text-[11px] truncate">{calc.startByteHex}</span>
            </div>
          </div>

          {/* Markers */}
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 px-1 mt-1.5">
            <span>0x0000 (리셋 벡터)</span>
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <ArrowRight className="w-3 h-3" /> 부트로더 경계: {calc.startByteHex} ({calc.startWordHex} W)
            </span>
            <span>{calc.endByteHex} (Flash Top)</span>
          </div>
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
