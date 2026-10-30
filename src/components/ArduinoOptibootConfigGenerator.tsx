import React, { useState, useMemo } from 'react';
import {
  Cpu,
  HardDrive,
  FileCode,
  Copy,
  Check,
  Download,
  Settings,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  Terminal,
  Radio,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

type BootloaderType = 'optiboot' | 'arduino_standard';
type ClockSourceType = 'ext_crystal' | 'internal_rc';
type OsccalCalibMode = 'fixed' | 'uart_autotune' | 'eeprom_stored';

interface BootSizeOption {
  sizeBytes: number;
  label: string;
  bootszBits: string; // BOOTSZ1:0
  hfuseOptiboot: number; // typical hfuse
  efuseValue?: number;
}

export const ArduinoOptibootConfigGenerator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // 1. Bootloader Engine
  const [bootType, setBootType] = useState<BootloaderType>('optiboot');

  // 2. Clock Source & Internal RC OSCCAL
  const [clockSource, setClockSource] = useState<ClockSourceType>('ext_crystal');
  const [targetFcpu, setTargetFcpu] = useState<number>(16000000);
  const [osccalMode, setOsccalMode] = useState<OsccalCalibMode>('fixed');
  const [customOsccalHex, setCustomOsccalHex] = useState<number>(0x68); // 0x00 ~ 0xFF (Factory typical: 0x68-0x80)

  // 3. Bootloader Size & Baud Rate
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [selectedUart, setSelectedUart] = useState<number>(0);
  const [ledPin, setLedPin] = useState<string>(selectedMCU === 'atmega328p' ? 'B5' : 'B7');
  const [supportEeprom, setSupportEeprom] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // MCU Specs Map
  const mcuConfig = useMemo(() => {
    if (selectedMCU === 'atmega328p') {
      return {
        name: 'ATmega328P',
        part: 'atmega328p',
        avrdudePart: 'm328p',
        flashBytes: 32768, // 32 KB
        pageSizeBytes: 128,
        defaultLed: 'B5',
        maxUart: 1,
        bootSizes: [
          { sizeBytes: 512, label: '512 Bytes (0.5 KB - Optiboot 기본)', bootszBits: '11', hfuseOptiboot: 0xDE },
          { sizeBytes: 1024, label: '1024 Bytes (1 KB - 권장)', bootszBits: '10', hfuseOptiboot: 0xDC },
          { sizeBytes: 2048, label: '2048 Bytes (2 KB - 표준 Arduino)', bootszBits: '01', hfuseOptiboot: 0xDA },
          { sizeBytes: 4096, label: '4096 Bytes (4 KB - 확장 기능)', bootszBits: '00', hfuseOptiboot: 0xD8 },
        ] as BootSizeOption[],
        defaultOptibootSize: 512,
        defaultStandardSize: 2048,
        lfuseExt: 0xFF, // 16MHz Crystal
        lfuseRc: 0xE2,  // 8MHz Internal RC
        efuse: 0xFD
      };
    } else if (selectedMCU === 'atmega128') {
      return {
        name: 'ATmega128',
        part: 'atmega128',
        avrdudePart: 'm128',
        flashBytes: 131072, // 128 KB
        pageSizeBytes: 256,
        defaultLed: 'B7',
        maxUart: 2,
        bootSizes: [
          { sizeBytes: 1024, label: '1024 Bytes (1 KB - Optiboot)', bootszBits: '11', hfuseOptiboot: 0xCC },
          { sizeBytes: 2048, label: '2048 Bytes (2 KB - 권장)', bootszBits: '10', hfuseOptiboot: 0xCA },
          { sizeBytes: 4096, label: '4096 Bytes (4 KB - 표준 ATmegaBOOT)', bootszBits: '01', hfuseOptiboot: 0xC8 },
          { sizeBytes: 8192, label: '8192 Bytes (8 KB - STK500v2)', bootszBits: '00', hfuseOptiboot: 0xC0 },
        ] as BootSizeOption[],
        defaultOptibootSize: 1024,
        defaultStandardSize: 4096,
        lfuseExt: 0xFF,
        lfuseRc: 0xE4,
        efuse: 0xFF
      };
    } else if (selectedMCU === 'atmega640') {
      return {
        name: 'ATmega640',
        part: 'atmega640',
        avrdudePart: 'm640',
        flashBytes: 65536, // 64 KB
        pageSizeBytes: 256,
        defaultLed: 'B7',
        maxUart: 4,
        bootSizes: [
          { sizeBytes: 1024, label: '1024 Bytes (1 KB - Optiboot)', bootszBits: '11', hfuseOptiboot: 0xDC },
          { sizeBytes: 2048, label: '2048 Bytes (2 KB - 권장)', bootszBits: '10', hfuseOptiboot: 0xDA },
          { sizeBytes: 4096, label: '4096 Bytes (4 KB - 표준)', bootszBits: '01', hfuseOptiboot: 0xD8 },
          { sizeBytes: 8192, label: '8192 Bytes (8 KB)', bootszBits: '00', hfuseOptiboot: 0xD0 },
        ] as BootSizeOption[],
        defaultOptibootSize: 1024,
        defaultStandardSize: 4096,
        lfuseExt: 0xFF,
        lfuseRc: 0xE2,
        efuse: 0xFD
      };
    } else {
      // atmega2560
      return {
        name: 'ATmega2560',
        part: 'atmega2560',
        avrdudePart: 'm2560',
        flashBytes: 262144, // 256 KB
        pageSizeBytes: 256,
        defaultLed: 'B7',
        maxUart: 4,
        bootSizes: [
          { sizeBytes: 1024, label: '1024 Bytes (1 KB - Optiboot v8+)', bootszBits: '11', hfuseOptiboot: 0xDE },
          { sizeBytes: 2048, label: '2048 Bytes (2 KB - Optiboot 권장)', bootszBits: '10', hfuseOptiboot: 0xDC },
          { sizeBytes: 4096, label: '4096 Bytes (4 KB)', bootszBits: '01', hfuseOptiboot: 0xDA },
          { sizeBytes: 8192, label: '8192 Bytes (8 KB - Arduino Mega STK500v2 기본)', bootszBits: '00', hfuseOptiboot: 0xD8 },
        ] as BootSizeOption[],
        defaultOptibootSize: 1024,
        defaultStandardSize: 8192,
        lfuseExt: 0xFF,
        lfuseRc: 0xE2,
        efuse: 0xFD
      };
    }
  }, [selectedMCU]);

  // Selected Bootloader Size State
  const [selectedBootSize, setSelectedBootSize] = useState<number>(() => {
    return bootType === 'optiboot' ? mcuConfig.defaultOptibootSize : mcuConfig.defaultStandardSize;
  });

  // Keep size in sync if bootType or MCU changes
  React.useEffect(() => {
    const validSizes = mcuConfig.bootSizes.map(b => b.sizeBytes);
    if (!validSizes.includes(selectedBootSize)) {
      setSelectedBootSize(bootType === 'optiboot' ? mcuConfig.defaultOptibootSize : mcuConfig.defaultStandardSize);
    }
  }, [selectedMCU, bootType, mcuConfig]);

  // Update clock presets when clock source changes
  React.useEffect(() => {
    if (clockSource === 'internal_rc') {
      setTargetFcpu(8000000);
      setBaudRate(38400); // 38400 or 57600 is safer on 8MHz RC
    } else {
      setTargetFcpu(16000000);
      setBaudRate(bootType === 'optiboot' ? 115200 : 57600);
    }
  }, [clockSource, bootType]);

  // Calculations for Flash Start Address
  const flashStartByte = mcuConfig.flashBytes - selectedBootSize;
  const flashStartWord = flashStartByte / 2; // AVR Instructions are 16-bit Words
  const flashStartByteHex = `0x${flashStartByte.toString(16).toUpperCase()}`;
  const flashStartWordHex = `0x${flashStartWord.toString(16).toUpperCase()}`;
  const userAppSpaceBytes = flashStartByte;
  const userAppPercent = ((userAppSpaceBytes / mcuConfig.flashBytes) * 100).toFixed(1);

  // Selected BootSize Option metadata
  const currentBootSizeOption = useMemo(() => {
    return mcuConfig.bootSizes.find(b => b.sizeBytes === selectedBootSize) || mcuConfig.bootSizes[0];
  }, [mcuConfig, selectedBootSize]);

  // Computed Fuses
  const activeLfuse = clockSource === 'internal_rc' ? mcuConfig.lfuseRc : mcuConfig.lfuseExt;
  const activeHfuse = currentBootSizeOption.hfuseOptiboot;
  const activeEfuse = mcuConfig.efuse;
  const activeLockBits = 0x2F; // Lock Bootloader from Application SPME overwrite

  // Internal RC Oscillator estimated error with OSCCAL offset
  const osccalOffsetPercent = useMemo(() => {
    // 0x68 is roughly nominal center (0% deviation). 1 step is ~0.4% freq change
    const delta = customOsccalHex - 0x68;
    return (delta * 0.4).toFixed(1);
  }, [customOsccalHex]);

  // Generated Makefile Content
  const generatedMakefile = useMemo(() => {
    const isOpti = bootType === 'optiboot';
    const isRc = clockSource === 'internal_rc';

    return `# ==============================================================================
# Production AVR Bootloader Makefile
# Target MCU     : ${mcuConfig.name} (${mcuConfig.part})
# Bootloader Type: ${isOpti ? 'Optiboot (Ultra-fast & Compact)' : 'Standard Arduino Bootloader (ATmegaBOOT/STK500v2)'}
# Flash Size     : ${mcuConfig.flashBytes / 1024} KB (${mcuConfig.flashBytes.toLocaleString()} Bytes)
# Bootloader Size: ${selectedBootSize} Bytes (${(selectedBootSize / 1024).toFixed(1)} KB)
# Boot Start Addr: ${flashStartByteHex} (Word: ${flashStartWordHex})
# Clock Source   : ${isRc ? `Internal RC 8.0 MHz (OSCCAL: 0x${customOsccalHex.toString(16).toUpperCase()})` : `External Crystal ${(targetFcpu / 1e6).toFixed(1)} MHz`}
# ==============================================================================

# Target MCU Architecture
MCU_TARGET       = ${mcuConfig.part}
AVRDUDE_MCU      = ${mcuConfig.avrdudePart}
F_CPU            = ${targetFcpu}L
BAUD_RATE        = ${baudRate}
UART_CHANNEL     = ${selectedUart}
LED_PIN          = ${ledPin}

# Flash Section Start Address for Linker
# --section-start=.text=${flashStartByteHex} specifies the exact BLS entry point
BOOT_START_BYTE  = ${flashStartByteHex}
BOOT_START_WORD  = ${flashStartWordHex}
LDSECTION        = --section-start=.text=$(BOOT_START_BYTE)

# Toolchain Definitions
CC               = avr-gcc
OBJCOPY          = avr-objcopy
OBJDUMP          = avr-objdump
SIZE             = avr-size
AVRDUDE          = avrdude

# Target Hex & Elf Names
TARGET           = ${isOpti ? 'optiboot' : 'ATmegaBOOT'}_${mcuConfig.part}_${targetFcpu / 1e6}mhz
OPTIMIZE         = -Os -fno-inline-small-functions -fno-split-wide-types -mshort-calls -Wall

# Preprocessor & Build Configuration Flags
CFLAGS           = -g -Wall $(OPTIMIZE) -mmcu=$(MCU_TARGET) -DF_CPU=$(F_CPU)
CFLAGS          += -DBAUD_RATE=$(BAUD_RATE)
CFLAGS          += -DLED_START_FLASHES=3
CFLAGS          += -DUART=$(UART_CHANNEL)
${isOpti && supportEeprom ? 'CFLAGS          += -DSUPPORT_EEPROM=1' : '# CFLAGS          += -DSUPPORT_EEPROM=0'}
${isOpti ? 'CFLAGS          += -DVIRTUAL_BOOT_PARTITION' : ''}

# ------------------------------------------------------------------------------
# Internal RC Oscillator Calibration (OSCCAL) Configuration
# ------------------------------------------------------------------------------
${isRc ? `# Enabled Internal RC Oscillator Calibration Mode: ${osccalMode}
${osccalMode === 'fixed' 
  ? `CFLAGS          += -DCALIBRATE_RC=1 -DOSCCAL_VALUE=0x${customOsccalHex.toString(16).toUpperCase()} # Factory Tuned` 
  : osccalMode === 'uart_autotune'
  ? `CFLAGS          += -DCALIBRATE_RC=2 -DAUTO_CALIBRATE_OSCCAL=1 # Tunes OSCCAL on first UART byte`
  : `CFLAGS          += -DCALIBRATE_RC=3 -DLOAD_OSCCAL_EEPROM=0x${(selectedMCU === 'atmega328p' ? '3FF' : 'FFF')} # Load from top EEPROM`}` 
: `# External Crystal in use; Hardware crystal frequency is precise, OSCCAL not needed.`}

# Fuse Bit Configurations
# BOOTSZ: ${currentBootSizeOption.bootszBits} (Allocates ${selectedBootSize} Bytes)
LFUSE            = 0x${activeLfuse.toString(16).toUpperCase()}
HFUSE            = 0x${activeHfuse.toString(16).toUpperCase()}
EFUSE            = 0x${activeEfuse.toString(16).toUpperCase()}
LOCK             = 0x${activeLockBits.toString(16).toUpperCase()}

# Programmer Configuration for Flashing
PROGRAMMER       = usbasp
PORT             = usb

# ------------------------------------------------------------------------------
# Build Targets
# ------------------------------------------------------------------------------
all: $(TARGET).hex $(TARGET).lst
\t@echo "=== Bootloader Build Successful ==="
\t@$(SIZE) -C --mcu=$(MCU_TARGET) $(TARGET).elf

$(TARGET).elf: ${isOpti ? 'optiboot.c' : 'ATmegaBOOT.c'}
\t$(CC) $(CFLAGS) -Wl,$(LDSECTION) -o $@ $^

$(TARGET).hex: $(TARGET).elf
\t$(OBJCOPY) -j .text -j .data -O ihex $< $@

$(TARGET).lst: $(TARGET).elf
\t$(OBJDUMP) -h -S $< > $@

clean:
\trm -rf *.o *.elf *.hex *.lst *.map

# ------------------------------------------------------------------------------
# Avrdude In-System Programming (ISP) Targets
# ------------------------------------------------------------------------------
# 1. Program Fuses (Sets Bootloader Start Address & Clock Source)
fuses:
\t$(AVRDUDE) -c $(PROGRAMMER) -p $(AVRDUDE_MCU) -P $(PORT) \\
\t  -U lfuse:w:$(LFUSE):m \\
\t  -U hfuse:w:$(HFUSE):m \\
\t  -U efuse:w:$(EFUSE):m

# 2. Flash Bootloader Binary & Lock Memory
isp: $(TARGET).hex
\t$(AVRDUDE) -c $(PROGRAMMER) -p $(AVRDUDE_MCU) -P $(PORT) -e \\
\t  -U flash:w:$(TARGET).hex:i \\
\t  -U lock:w:$(LOCK):m

.PHONY: all clean fuses isp
`;
  }, [
    bootType,
    clockSource,
    mcuConfig,
    selectedBootSize,
    flashStartByteHex,
    flashStartWordHex,
    customOsccalHex,
    targetFcpu,
    baudRate,
    selectedUart,
    ledPin,
    supportEeprom,
    osccalMode,
    currentBootSizeOption,
    activeLfuse,
    activeHfuse,
    activeEfuse,
    activeLockBits,
    selectedMCU
  ]);

  const handleCopyCode = (key: string) => {
    navigator.clipboard.writeText(generatedMakefile);
    setCopiedKey(key);
    confetti({
      particleCount: 32,
      spread: 50,
      origin: { y: 0.85 }
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadMakefile = () => {
    const blob = new Blob([generatedMakefile], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Makefile.${mcuConfig.part}.bootloader`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl backdrop-blur relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute -top-32 -right-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-inner">
              <HardDrive className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base md:text-lg font-bold text-white tracking-wide">
                  Optiboot & 표준 Arduino 부트로더 구성 생성기
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                  Bootloader Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                선택한 MCU의 플래시 시작 주소, 부트로더 할당 크기(1KB/2KB/4KB), 퓨즈비트, 그리고 내부 RC 오실레이터 보정(OSCCAL)을 포함한 빌드용 Makefile을 생성합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Selected MCU Profile Tag */}
        <div className="flex items-center gap-2 shrink-0">
          {onSelectMCU && (
            <select
              value={selectedMCU}
              onChange={(e) => onSelectMCU(e.target.value as SupportedMCU)}
              className="bg-slate-950 border border-slate-700 hover:border-emerald-500 text-xs text-emerald-300 font-mono rounded-xl px-2.5 py-1.5 focus:outline-none transition-colors"
            >
              {Object.keys(MCU_PROFILES).map((mcuKey) => (
                <option key={mcuKey} value={mcuKey}>
                  {MCU_PROFILES[mcuKey as SupportedMCU].name}
                </option>
              ))}
            </select>
          )}
          <span className="text-xs font-mono text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            {mcuConfig.name} ({mcuConfig.flashBytes / 1024} KB Flash)
          </span>
        </div>
      </div>

      {/* Interactive Flash Allocation Visualizer Bar */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">플래시 메모리 할당:</span>
            <span className="text-white font-bold">{mcuConfig.flashBytes.toLocaleString()} Bytes 전체</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <span className="text-cyan-400">사용자 앱: {userAppSpaceBytes.toLocaleString()} B ({userAppPercent}%)</span>
            <span>•</span>
            <span className="text-emerald-400 font-bold">부트로더(BLS): {selectedBootSize.toLocaleString()} B</span>
          </div>
        </div>

        {/* Multi-segmented Memory Bar */}
        <div className="w-full h-7 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex">
          {/* User Application Area */}
          <div
            style={{ width: `${userAppPercent}%` }}
            className="bg-gradient-to-r from-cyan-600/80 to-blue-600/80 h-full flex items-center justify-between px-3 text-[10px] font-bold text-white transition-all duration-300"
          >
            <span>User Application Flash (0x0000 ➔ {flashStartByteHex})</span>
            <span>{userAppPercent}%</span>
          </div>

          {/* Bootloader Section */}
          <div
            style={{ width: `${(100 - parseFloat(userAppPercent))}%` }}
            className="bg-gradient-to-r from-emerald-600 to-amber-600 h-full flex items-center justify-center text-[10px] font-black text-slate-950 transition-all duration-300 px-1 border-l border-emerald-400"
          >
            BLS ({selectedBootSize}B)
          </div>
        </div>

        {/* Start Address Callouts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono pt-1">
          <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[10px] block">부트로더 바이트 시작 번지 (Byte)</span>
            <span className="text-amber-400 font-bold">{flashStartByteHex}</span>
          </div>
          <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[10px] block">부트로더 워드 시작 번지 (Word)</span>
            <span className="text-cyan-400 font-bold">{flashStartWordHex}</span>
          </div>
          <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[10px] block">BOOTSZ1:0 퓨즈 비트</span>
            <span className="text-emerald-400 font-bold">0b{currentBootSizeOption.bootszBits}</span>
          </div>
          <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
            <span className="text-slate-500 text-[10px] block">플래시 페이지(Page) 점유</span>
            <span className="text-purple-400 font-bold">
              {Math.ceil(selectedBootSize / mcuConfig.pageSizeBytes)} Pages ({mcuConfig.pageSizeBytes}B/Page)
            </span>
          </div>
        </div>
      </div>

      {/* 2-Column Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
        {/* Left Column: Bootloader Engine & Size Configuration */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-inner">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              1. 부트로더 엔진 및 플래시 크기 선택
            </h4>
          </div>

          {/* Engine Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              부트로더 엔진 유형:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setBootType('optiboot')}
                className={`p-3 rounded-xl border text-left transition ${
                  bootType === 'optiboot'
                    ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md shadow-emerald-950/40 ring-1 ring-emerald-400/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-emerald-400">Optiboot (권장)</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded">
                    512B / 1KB
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  빠른 업로드(115200bps), 초소형 플래시 점유, 최신 아두이노 표준.
                </p>
              </button>

              <button
                onClick={() => setBootType('arduino_standard')}
                className={`p-3 rounded-xl border text-left transition ${
                  bootType === 'arduino_standard'
                    ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-md shadow-cyan-950/40 ring-1 ring-cyan-400/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-cyan-400">표준 Arduino (STK500v2)</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 rounded">
                    2KB / 8KB
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Mega2560 128KB 초과 지원 STK500v2 프로토콜, ATmegaBOOT 호환.
                </p>
              </button>
            </div>
          </div>

          {/* Bootloader Allocation Size Radio / Select */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-slate-300">
                부트로더 할당 크기 (Boot Size):
              </label>
              <span className="font-mono text-emerald-400 font-bold">
                {selectedBootSize} Bytes ({flashStartByteHex})
              </span>
            </div>

            <div className="space-y-1.5">
              {mcuConfig.bootSizes.map((opt) => (
                <label
                  key={opt.sizeBytes}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition text-xs font-mono ${
                    selectedBootSize === opt.sizeBytes
                      ? 'bg-slate-900 border-emerald-500 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="bootSize"
                      checked={selectedBootSize === opt.sizeBytes}
                      onChange={() => setSelectedBootSize(opt.sizeBytes)}
                      className="accent-emerald-500"
                    />
                    <span className="font-bold">{opt.label}</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    BOOTSZ: {opt.bootszBits}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Communication & Pin Parameters */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">UART 통신 속도 (Baud):</label>
              <select
                value={baudRate}
                onChange={(e) => setBaudRate(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 font-mono text-white focus:outline-none focus:border-emerald-500"
              >
                <option value={115200}>115200 bps (Optiboot 표준)</option>
                <option value={57600}>57600 bps (Standard 표준)</option>
                <option value={38400}>38400 bps (RC 오실레이터 안전)</option>
                <option value={19200}>19200 bps</option>
                <option value={9600}>9600 bps</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">상태 표시 LED 핀:</label>
              <input
                type="text"
                value={ledPin}
                onChange={(e) => setLedPin(e.target.value.toUpperCase())}
                placeholder="예: B5 또는 B7"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 font-mono text-white focus:outline-none focus:border-emerald-500 uppercase"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Clock Source & Internal RC OSCCAL Calibration */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-inner">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Zap className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              2. 클럭 소스 및 내부 RC 오실레이터(OSCCAL) 보정
            </h4>
          </div>

          {/* Clock Source Switch */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              클럭 소스 (Clock Source):
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setClockSource('ext_crystal')}
                className={`p-3 rounded-xl border text-left transition ${
                  clockSource === 'ext_crystal'
                    ? 'bg-amber-950/50 border-amber-500 text-white ring-1 ring-amber-400/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs text-amber-400 mb-0.5">외부 크리스털 (External)</div>
                <div className="text-[11px] text-slate-400">16.0 MHz / 8.0 MHz (오차 ±0.1% 미만, 보정 불필요)</div>
              </button>

              <button
                onClick={() => setClockSource('internal_rc')}
                className={`p-3 rounded-xl border text-left transition ${
                  clockSource === 'internal_rc'
                    ? 'bg-amber-950/50 border-amber-500 text-white ring-1 ring-amber-400/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs text-amber-400 mb-0.5">내부 RC 오실레이터</div>
                <div className="text-[11px] text-slate-400">8.0 MHz (공장 출하 오차 ±10%, OSCCAL 튜닝 필수)</div>
              </button>
            </div>
          </div>

          {/* OSCCAL Tuning Panel (Visible when Internal RC is active) */}
          {clockSource === 'internal_rc' ? (
            <div className="p-3.5 bg-amber-950/20 border border-amber-600/40 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  OSCCAL 레지스터 보정 방식:
                </span>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-700/60">
                  8.0 MHz RC
                </span>
              </div>

              {/* Mode Selection */}
              <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                <button
                  onClick={() => setOsccalMode('fixed')}
                  className={`p-2 rounded-lg border text-center transition ${
                    osccalMode === 'fixed'
                      ? 'bg-amber-600 text-white border-amber-400 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  고정 OSCCAL 값
                </button>
                <button
                  onClick={() => setOsccalMode('uart_autotune')}
                  className={`p-2 rounded-lg border text-center transition ${
                    osccalMode === 'uart_autotune'
                      ? 'bg-amber-600 text-white border-amber-400 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  UART 자동 보정
                </button>
                <button
                  onClick={() => setOsccalMode('eeprom_stored')}
                  className={`p-2 rounded-lg border text-center transition ${
                    osccalMode === 'eeprom_stored'
                      ? 'bg-amber-600 text-white border-amber-400 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  EEPROM 저장값
                </button>
              </div>

              {/* Slider for Fixed Value */}
              {osccalMode === 'fixed' && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-300">OSCCAL 주입 값:</span>
                    <span className="text-amber-400 font-bold">
                      0x{customOsccalHex.toString(16).toUpperCase()} ({customOsccalHex} / 예상 오차 {osccalOffsetPercent}%)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0x00}
                    max={0xFF}
                    value={customOsccalHex}
                    onChange={(e) => setCustomOsccalHex(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    0x68은 AVR 팩토리 표준 중앙값입니다. 온습도 및 전압에 따라 보레이트 오차가 발생할 경우 슬라이더를 미세 조정하세요.
                  </p>
                </div>
              )}

              {osccalMode === 'uart_autotune' && (
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  부트로더 진입 직후 아두이노 IDE가 전송하는 첫 수신 바이트(0x30 0x20)의 스타트 비트 너비를 타이머로 역계산하여 OSCCAL을 실시간 자동 보정합니다.
                </p>
              )}

              {osccalMode === 'eeprom_stored' && (
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  공장 캘리브레이션 지그에서 정밀 측정 후 EEPROM 최상단 주소에 기록된 1바이트 튜닝값을 부팅 시 자동으로 읽어 OSCCAL 레지스터에 로드합니다.
                </p>
              )}
            </div>
          ) : (
            <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1 text-xs">
              <span className="font-bold text-slate-300 block">외부 크리스털 발진기 운용</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                16.0MHz 또는 8.0MHz 외부 쿼츠 크리스털과 22pF 부하 커패시터가 연결되어 주파수 편차가 ±30ppm 수준으로 극히 낮으므로 별도의 OSCCAL 튜닝이 필요하지 않습니다.
              </p>
            </div>
          )}

          {/* Fuse Preview Row */}
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono space-y-1.5">
            <span className="text-slate-400 text-[11px] block font-semibold">자동 산출 퓨즈비트 (Target Fuses):</span>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">LOW</span>
                <span className="text-amber-400 font-bold">0x{activeLfuse.toString(16).toUpperCase()}</span>
              </div>
              <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">HIGH</span>
                <span className="text-emerald-400 font-bold">0x{activeHfuse.toString(16).toUpperCase()}</span>
              </div>
              <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">EXT</span>
                <span className="text-cyan-400 font-bold">0x{activeEfuse.toString(16).toUpperCase()}</span>
              </div>
              <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">LOCK</span>
                <span className="text-rose-400 font-bold">0x{activeLockBits.toString(16).toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Generated Makefile Snippet Output Window */}
      <div className="space-y-3 pt-2 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              생성된 부트로더 빌드 Makefile 스니펫
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadMakefile}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
              title="Makefile 다운로드"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Makefile 다운로드</span>
            </button>

            <button
              onClick={() => handleCopyCode('makefile')}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 text-xs font-bold shadow-md shadow-emerald-600/20"
            >
              {copiedKey === 'makefile' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-200" />
                  <span>복사 완료!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Makefile 복사</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code Block */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-white font-bold">
                Makefile.{mcuConfig.part}.bootloader
              </span>
            </div>
            <span className="text-[11px] text-emerald-400 font-mono">
              Ready to Build (make all &amp; make isp)
            </span>
          </div>

          <pre className="p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed select-all max-h-96">
            {generatedMakefile}
          </pre>
        </div>
      </div>
    </div>
  );
};
