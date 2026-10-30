import React, { useState, useMemo } from 'react';
import {
  HardDrive,
  Cpu,
  Layers,
  Zap,
  Terminal,
  Check,
  Copy,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  RotateCcw,
  Sparkles,
  Info,
  ArrowRight,
  Upload,
  Download,
  FileCode,
  Shield,
  ShieldCheck,
  FileText,
  Clock,
  Play
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type BootloaderSourceType = 'optiboot' | 'arduino_official' | 'custom_hex';

interface BootszSpec {
  words: number;
  bytes: number;
  bootszBits: [number, number]; // [BOOTSZ1, BOOTSZ0]: 0 = programmed, 1 = unprogrammed
  startAddressWord: number;
  startAddressByte: number;
  startHexWord: string;
  startHexByte: string;
}

const MCU_BOOTSZ_SPECS: Record<SupportedMCU, BootszSpec[]> = {
  atmega328p: [
    { words: 256, bytes: 512, bootszBits: [1, 1], startAddressWord: 0x3F00, startAddressByte: 0x7E00, startHexWord: '0x3F00', startHexByte: '0x7E00' },
    { words: 512, bytes: 1024, bootszBits: [1, 0], startAddressWord: 0x3E00, startAddressByte: 0x7C00, startHexWord: '0x3E00', startHexByte: '0x7C00' },
    { words: 1024, bytes: 2048, bootszBits: [0, 1], startAddressWord: 0x3C00, startAddressByte: 0x7800, startHexWord: '0x3C00', startHexByte: '0x7800' },
    { words: 2048, bytes: 4096, bootszBits: [0, 0], startAddressWord: 0x3800, startAddressByte: 0x7000, startHexWord: '0x3800', startHexByte: '0x7000' }
  ],
  atmega128: [
    { words: 512, bytes: 1024, bootszBits: [1, 1], startAddressWord: 0xFE00, startAddressByte: 0x1FC00, startHexWord: '0xFE00', startHexByte: '0x1FC00' },
    { words: 1024, bytes: 2048, bootszBits: [1, 0], startAddressWord: 0xFC00, startAddressByte: 0x1F800, startHexWord: '0xFC00', startHexByte: '0x1F800' },
    { words: 2048, bytes: 4096, bootszBits: [0, 1], startAddressWord: 0xF800, startAddressByte: 0x1F000, startHexWord: '0xF800', startHexByte: '0x1F000' },
    { words: 4096, bytes: 8192, bootszBits: [0, 0], startAddressWord: 0xF000, startAddressByte: 0x1E000, startHexWord: '0xF000', startHexByte: '0x1E000' }
  ],
  atmega640: [
    { words: 512, bytes: 1024, bootszBits: [1, 1], startAddressWord: 0x7E00, startAddressByte: 0xFC00, startHexWord: '0x7E00', startHexByte: '0xFC00' },
    { words: 1024, bytes: 2048, bootszBits: [1, 0], startAddressWord: 0x7C00, startAddressByte: 0xF800, startHexWord: '0x7C00', startHexByte: '0xF800' },
    { words: 2048, bytes: 4096, bootszBits: [0, 1], startAddressWord: 0x7800, startAddressByte: 0xF000, startHexWord: '0x7800', startHexByte: '0xF000' },
    { words: 4096, bytes: 8192, bootszBits: [0, 0], startAddressWord: 0x7000, startAddressByte: 0xE000, startHexWord: '0x7000', startHexByte: '0xE000' }
  ],
  atmega2560: [
    { words: 1024, bytes: 2048, bootszBits: [1, 1], startAddressWord: 0x1FC00, startAddressByte: 0x3F800, startHexWord: '0x1FC00', startHexByte: '0x3F800' },
    { words: 2048, bytes: 4096, bootszBits: [1, 0], startAddressWord: 0x1F800, startAddressByte: 0x3F000, startHexWord: '0x1F800', startHexByte: '0x3F000' },
    { words: 4096, bytes: 8192, bootszBits: [0, 1], startAddressWord: 0x1F000, startAddressByte: 0x3E000, startHexWord: '0x1F000', startHexByte: '0x3E000' },
    { words: 8192, bytes: 16384, bootszBits: [0, 0], startAddressWord: 0x1E000, startAddressByte: 0x3C000, startHexWord: '0x1E000', startHexByte: '0x3C000' }
  ]
};

// Preset Hex Snippets
const PRESET_HEX_FILES: Record<SupportedMCU, Record<'optiboot' | 'arduino_official', { filename: string; sizeBytes: number; protocol: string; defaultBaud: number; hexPreview: string }>> = {
  atmega328p: {
    optiboot: {
      filename: 'optiboot_atmega328.hex',
      sizeBytes: 512,
      protocol: 'STK500v1',
      defaultBaud: 115200,
      hexPreview: `:107E0000112484EBAFEDC6CFB6E0DEBFCDBF10E0A0
:107E1000A0E6B0E0ECE5F1E002C005900D92A036B107D2
:107E2000D9F710E0A0E6B0E001C01D92A036B107E1F702
:107E300004E0C4E1D1E004C02297FE010E94F67D97FB57
:107E400085E08093C00080E18093C10086E08093C200BD
:107E500080E18093C4008EE08093C50085E08093C00030
:047FFE00FFCF000033
:00000001FF`
    },
    arduino_official: {
      filename: 'ATmegaBOOT_168_atmega328.hex',
      sizeBytes: 2048,
      protocol: 'STK500v1',
      defaultBaud: 57600,
      hexPreview: `:107800000C94343C0C94513C0C94513C0C94513C11
:107810000C94513C0C94513C0C94513C0C94513C01
:107820000C94513C0C94513C0C94513C0C94513CF1
:107830000C94513C0C94513C0C94513C0C94513CE1
:107840000C94513C0C94513C0C94513C0C94513CD1
:00000001FF`
    }
  },
  atmega128: {
    optiboot: {
      filename: 'optiboot_atmega128.hex',
      sizeBytes: 1024,
      protocol: 'STK500v1',
      defaultBaud: 115200,
      hexPreview: `:10FC00000C9400FE0C942BFE0C942BFE0C942BFE35
:10FC10000C942BFE0C942BFE0C942BFE0C942BFE25
:10FC2000112484EBACEDC6CFB6E0DEBFCDBF10E0A0
:00000001FF`
    },
    arduino_official: {
      filename: 'ATmegaBOOT_128.hex',
      sizeBytes: 4096,
      protocol: 'STK500v2',
      defaultBaud: 57600,
      hexPreview: `:10F000000C9440F80C945DF80C945DF80C945DF8B7
:10F010000C945DF80C945DF80C945DF80C945DF8A7
:10F0200011248FE590E08093600080E18093610023
:00000001FF`
    }
  },
  atmega2560: {
    optiboot: {
      filename: 'optiboot_atmega2560.hex',
      sizeBytes: 1024,
      protocol: 'STK500v1',
      defaultBaud: 115200,
      hexPreview: `:103F80000C9400FD0C942BFD0C942BFD0C942BFDF4
:103F90000C942BFD0C942BFD0C942BFD0C942BFDE4
:103FA000112484EBACEDC6CFB6E0DEBFCDBF10E000
:00000001FF`
    },
    arduino_official: {
      filename: 'stk500boot_v2_mega2560.hex',
      sizeBytes: 8192,
      protocol: 'STK500v2',
      defaultBaud: 115200,
      hexPreview: `:10E000000C9400F00C942CF00C942CF00C942CF0B4
:10E010000C942CF00C942CF00C942CF00C942CF0A4
:10E020000C942CF00C942CF00C942CF00C942CF094
:00000001FF`
    }
  },
  atmega640: {
    optiboot: {
      filename: 'optiboot_atmega640.hex',
      sizeBytes: 1024,
      protocol: 'STK500v1',
      defaultBaud: 115200,
      hexPreview: `:10FC00000C9400FE0C942BFE0C942BFE0C942BFE35
:10FC10000C942BFE0C942BFE0C942BFE0C942BFE25
:00000001FF`
    },
    arduino_official: {
      filename: 'stk500boot_v2_mega640.hex',
      sizeBytes: 4096,
      protocol: 'STK500v2',
      defaultBaud: 115200,
      hexPreview: `:10F000000C9440F80C945DF80C945DF80C945DF8B7
:10F010000C945DF80C945DF80C945DF80C945DF8A7
:00000001FF`
    }
  }
};

export const BootloaderConfigManager: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const bootszList = MCU_BOOTSZ_SPECS[selectedMCU];

  // 1. Bootloader Source Selection
  const [bootloaderType, setBootloaderType] = useState<BootloaderSourceType>('optiboot');

  // Custom Hex state
  const [customFileName, setCustomFileName] = useState<string>('my_bootloader.hex');
  const [customFileSize, setCustomFileSize] = useState<number>(1024); // in bytes
  const [customHexContent, setCustomHexContent] = useState<string>('');
  const [customProtocol, setCustomProtocol] = useState<string>('STK500v1 / DFU');
  const [customBaud, setCustomBaud] = useState<number>(115200);

  // 2. Hardware Options
  const [bootrst, setBootrst] = useState<boolean>(true); // 0 = programmed (reset to BLS)
  const [eesave, setEesave] = useState<boolean>(true);   // 0 = programmed (preserve EEPROM during chip erase)
  const [bodLevel, setBodLevel] = useState<'2v7' | '4v3' | 'disabled'>('2v7');
  const [clockSource, setClockSource] = useState<'ext_crystal' | 'internal_rc'>('ext_crystal');

  // Copy state
  const [copiedAvrdude, setCopiedAvrdude] = useState<boolean>(false);
  const [copiedHex, setCopiedHex] = useState<boolean>(false);

  // Active Hex Details based on selection
  const activeBootloaderInfo = useMemo(() => {
    if (bootloaderType === 'optiboot') {
      const preset = PRESET_HEX_FILES[selectedMCU].optiboot;
      return {
        name: `Optiboot for ${currentProfile.name}`,
        filename: preset.filename,
        sizeBytes: preset.sizeBytes,
        protocol: preset.protocol,
        defaultBaud: preset.defaultBaud,
        hexPreview: preset.hexPreview,
        desc: '단 512B~1KB의 초소형 바이너리로 플래시 공간을 극대화하며 빠른 업로드(115200) 및 WDT 무한루프 버그 완벽 패치.'
      };
    } else if (bootloaderType === 'arduino_official') {
      const preset = PRESET_HEX_FILES[selectedMCU].arduino_official;
      return {
        name: `Arduino Official (${currentProfile.name === 'ATmega2560' ? 'STK500v2' : 'ATmegaBOOT'})`,
        filename: preset.filename,
        sizeBytes: preset.sizeBytes,
        protocol: preset.protocol,
        defaultBaud: preset.defaultBaud,
        hexPreview: preset.hexPreview,
        desc: '아두이노 정품 보드 출고 시 라이팅되는 표준 레거시 부트로더. 폭넓은 IDE 및 구형 프로그래머와의 호환성 보장.'
      };
    } else {
      // Custom Hex
      return {
        name: customFileName || 'Custom Bootloader Hex',
        filename: customFileName || 'custom_bootloader.hex',
        sizeBytes: customFileSize,
        protocol: customProtocol,
        defaultBaud: customBaud,
        hexPreview: customHexContent || `// Custom Hex File Loaded: ${customFileName} (${customFileSize} Bytes)\n:107E0000112484EBAFEDC6CFB6E0DEBFCDBF10E0A0\n:00000001FF`,
        desc: '사용자가 직접 컴파일한 커스텀 hex 파일(DFU, 암호화, RS-485 통신 등). 실제 바이트 크기에 맞춘 BOOTSZ 자동 할당.'
      };
    }
  }, [bootloaderType, selectedMCU, currentProfile.name, customFileName, customFileSize, customHexContent, customProtocol, customBaud]);

  // ---------------------------------------------------------------------------
  // Automatically Calculate Optimal BOOTSZ Tier based on Required Bootloader Size
  // ---------------------------------------------------------------------------
  const optimalBootsz = useMemo(() => {
    const requiredBytes = activeBootloaderInfo.sizeBytes;
    // Find the smallest bootsz tier that can fit the required bytes
    const sorted = [...bootszList].sort((a, b) => a.bytes - b.bytes);
    const matched = sorted.find((b) => b.bytes >= requiredBytes) || sorted[sorted.length - 1];
    return matched;
  }, [activeBootloaderInfo.sizeBytes, bootszList]);

  // Flash Memory Metrics
  const flashMetrics = useMemo(() => {
    const totalFlashBytes = currentProfile.flash * 1024;
    const bootloaderBytes = optimalBootsz.bytes;
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
  }, [currentProfile.flash, optimalBootsz]);

  // ---------------------------------------------------------------------------
  // Calculate Exact Fuse Bytes (LFUSE, HFUSE, EFUSE)
  // ---------------------------------------------------------------------------
  const fuseCalculation = useMemo(() => {
    const [bootsz1, bootsz0] = optimalBootsz.bootszBits;

    // 1. High Fuse (HFUSE)
    let hfuse = 0xFF;

    if (selectedMCU === 'atmega328p') {
      // Bit 7: RSTDISBL (1=unprog), Bit 6: DWEN (1=unprog), Bit 5: SPIEN (0=prog), Bit 4: WDTON (1=unprog)
      // Bit 3: EESAVE, Bit 2: BOOTSZ1, Bit 1: BOOTSZ0, Bit 0: BOOTRST
      hfuse = 0xD8; // Default base (SPIEN=0)
      if (eesave) hfuse &= ~0x08; else hfuse |= 0x08;
      hfuse = (hfuse & ~0x06) | (bootsz1 << 2) | (bootsz0 << 1);
      if (bootrst) hfuse &= ~0x01; else hfuse |= 0x01;
    } else if (selectedMCU === 'atmega128') {
      // Bit 7: OCDEN, 6: JTAGEN, 5: SPIEN, 4: WDTON, 3: EESAVE, 2: BOOTSZ1, 1: BOOTSZ0, 0: BOOTRST
      hfuse = 0xC8; // JTAG disabled, SPIEN programmed
      if (eesave) hfuse &= ~0x08; else hfuse |= 0x08;
      hfuse = (hfuse & ~0x06) | (bootsz1 << 2) | (bootsz0 << 1);
      if (bootrst) hfuse &= ~0x01; else hfuse |= 0x01;
    } else {
      // ATmega640 / ATmega2560
      // Bit 7: OCDEN, 6: JTAGEN, 5: SPIEN, 4: WDTON, 3: EESAVE, 2: BOOTSZ1, 1: BOOTSZ0, 0: BOOTRST
      hfuse = 0xD8;
      if (eesave) hfuse &= ~0x08; else hfuse |= 0x08;
      hfuse = (hfuse & ~0x06) | (bootsz1 << 2) | (bootsz0 << 1);
      if (bootrst) hfuse &= ~0x01; else hfuse |= 0x01;
    }

    // 2. Low Fuse (LFUSE)
    let lfuse = 0xFF;
    if (clockSource === 'ext_crystal') {
      lfuse = selectedMCU === 'atmega328p' ? 0xFF : 0xDF;
    } else {
      // 8MHz Internal RC
      lfuse = 0xE2;
    }

    // 3. Extended Fuse (EFUSE)
    let efuse = 0xFD;
    if (selectedMCU === 'atmega328p') {
      efuse = bodLevel === '2v7' ? 0xFD : bodLevel === '4v3' ? 0xFC : 0xFF;
    } else if (selectedMCU === 'atmega128') {
      efuse = 0xFF; // M103C unprogrammed
    } else {
      // ATmega640 / ATmega2560: 0xFD (2.7V BOD)
      efuse = bodLevel === '2v7' ? 0xFD : bodLevel === '4v3' ? 0xFC : 0xFF;
    }

    return {
      hfuseHex: '0x' + (hfuse & 0xFF).toString(16).toUpperCase().padStart(2, '0'),
      lfuseHex: '0x' + (lfuse & 0xFF).toString(16).toUpperCase().padStart(2, '0'),
      efuseHex: '0x' + (efuse & 0xFF).toString(16).toUpperCase().padStart(2, '0'),
      bootsz1,
      bootsz0
    };
  }, [selectedMCU, optimalBootsz, eesave, bootrst, clockSource, bodLevel]);

  // Avrdude Flash & Fuse Commands
  const avrdudeBurnBootloaderCmd = useMemo(() => {
    return `# 1. 퓨즈 비트 프로그래밍 및 칩 완전 소거 (Chip Erase & Fuses)
avrdude -c usbasp -p ${selectedMCU} -e -U lock:w:0x3F:m -U efuse:w:${fuseCalculation.efuseHex}:m -U hfuse:w:${fuseCalculation.hfuseHex}:m -U lfuse:w:${fuseCalculation.lfuseHex}:m

# 2. 부트로더 HEX 파일 다운로드 및 락비트 잠금 (Bootloader Flash & Lock)
avrdude -c usbasp -p ${selectedMCU} -U flash:w:${activeBootloaderInfo.filename}:i -U lock:w:0x0F:m`;
  }, [selectedMCU, fuseCalculation, activeBootloaderInfo.filename]);

  // Handle Custom Hex File Upload
  const handleHexFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCustomFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCustomHexContent(content);

      // Parse Intel HEX to estimate total binary size
      const lines = content.split('\n');
      let byteCount = 0;
      for (const line of lines) {
        if (line.startsWith(':') && line.length >= 11) {
          const len = parseInt(line.substring(1, 3), 16);
          const recType = parseInt(line.substring(7, 9), 16);
          if (recType === 0) {
            byteCount += len;
          }
        }
      }

      if (byteCount > 0) {
        setCustomFileSize(byteCount);
      } else {
        // Fallback to file size approximation
        setCustomFileSize(Math.min(16384, Math.max(512, Math.round(file.size / 3))));
      }

      setBootloaderType('custom_hex');
      confetti({ particleCount: 30, spread: 60, origin: { y: 0.7 } });
    };
    reader.readAsText(file);
  };

  const copyAvrdude = () => {
    navigator.clipboard.writeText(avrdudeBurnBootloaderCmd);
    setCopiedAvrdude(true);
    confetti({ particleCount: 35, spread: 65, origin: { y: 0.8 } });
    setTimeout(() => setCopiedAvrdude(false), 2000);
  };

  const copyHex = () => {
    navigator.clipboard.writeText(activeBootloaderInfo.hexPreview);
    setCopiedHex(true);
    setTimeout(() => setCopiedHex(false), 2000);
  };

  const downloadHex = () => {
    const element = document.createElement('a');
    const file = new Blob([activeBootloaderInfo.hexPreview], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = activeBootloaderInfo.filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div id="bootloader-config-manager-section" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur shadow-2xl space-y-6 scroll-mt-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <HardDrive className="w-3.5 h-3.5" /> 부트로더 설정 관리자 (Bootloader Configuration Manager)
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              Optiboot • Arduino Official • Custom HEX Parser
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-xs font-mono font-bold">
              {currentProfile.name} ({currentProfile.flash}KB Flash)
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            부트로더 설정 관리자 (Bootloader Configuration Manager)
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            선택한 MCU({currentProfile.name})에 맞춰 <strong className="text-emerald-300 font-mono">Optiboot</strong>,
            <strong className="text-cyan-300 font-mono"> Arduino 공식 부트로더</strong>, 혹은
            <strong className="text-amber-300 font-mono"> 커스텀 부트로더 hex 파일</strong>을 선택 및 업로드하고,
            각 부트로더의 점유 메모리 크기(Bytes/Words)와 <strong className="text-purple-300 font-mono">최적 퓨즈 비트(BOOTSZ, BOOTRST, HFUSE)</strong> 설정을 실시간으로 자동 계산하여 제안합니다.
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

      {/* 1. Bootloader Selection Options Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            1. 부트로더 소스 선택 (Optiboot vs Arduino 공식 vs 커스텀 HEX):
          </label>
          <span className="text-[11px] font-mono text-slate-400">
            원하는 부트로더를 선택하거나 .hex 파일을 직접 업로드하세요.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Optiboot */}
          <div
            onClick={() => setBootloaderType('optiboot')}
            className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-3 ${
              bootloaderType === 'optiboot'
                ? 'bg-emerald-950/40 border-emerald-500 shadow-xl ring-2 ring-emerald-500/50'
                : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  ★ 공식 강력 권장
                </span>
                <span className="text-xs font-bold font-mono text-white">
                  {PRESET_HEX_FILES[selectedMCU].optiboot.sizeBytes} Bytes
                </span>
              </div>
              <h4 className="text-base font-black text-white">Optiboot 8.x 표준 부트로더</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Arduino Uno/MiniCore 공식 표준. 초경량 크기로 애플리케이션 플래시 공간을 최대화하며 빠른 115,200bps 통신 지원.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">프로토콜: STK500v1</span>
              <span className="text-emerald-400 font-bold">115,200 bps</span>
            </div>
          </div>

          {/* Card 2: Arduino Official Legacy Bootloader */}
          <div
            onClick={() => setBootloaderType('arduino_official')}
            className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-3 ${
              bootloaderType === 'arduino_official'
                ? 'bg-cyan-950/40 border-cyan-500 shadow-xl ring-2 ring-cyan-500/50'
                : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  레거시 표준
                </span>
                <span className="text-xs font-bold font-mono text-white">
                  {PRESET_HEX_FILES[selectedMCU].arduino_official.sizeBytes} Bytes
                </span>
              </div>
              <h4 className="text-base font-black text-white">Arduino 공식 정품 부트로더</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {currentProfile.name === 'ATmega2560'
                  ? 'Arduino Mega 2560 공식 STK500v2 부트로더 (8KB 또는 2KB 점유)'
                  : 'ATmegaBOOT 레거시 부트로더 (구형 툴체인 및 전통적 배포판과 100% 호환)'}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">프로토콜: {PRESET_HEX_FILES[selectedMCU].arduino_official.protocol}</span>
              <span className="text-cyan-400 font-bold">{PRESET_HEX_FILES[selectedMCU].arduino_official.defaultBaud.toLocaleString()} bps</span>
            </div>
          </div>

          {/* Card 3: Custom Bootloader HEX File */}
          <div
            onClick={() => setBootloaderType('custom_hex')}
            className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-3 ${
              bootloaderType === 'custom_hex'
                ? 'bg-amber-950/40 border-amber-500 shadow-xl ring-2 ring-amber-500/50'
                : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  사용자 지정
                </span>
                <span className="text-xs font-bold font-mono text-amber-400">
                  {customFileSize} Bytes
                </span>
              </div>
              <h4 className="text-base font-black text-white">커스텀 부트로더 HEX 파일</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                DFU, 암호화 펌웨어, CAN/RS-485 통신 등 직접 컴파일한 .hex 파일을 업로드하여 퓨즈를 산출합니다.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800/80">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-mono font-bold cursor-pointer transition w-full justify-center">
                <Upload className="w-3.5 h-3.5" />
                <span>HEX 파일 업로드 (.hex)</span>
                <input type="file" accept=".hex" onChange={handleHexFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Custom HEX Configuration Bar (Shown if Custom HEX selected) */}
      {bootloaderType === 'custom_hex' && (
        <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/40 space-y-3 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
            <span className="text-xs font-bold text-amber-400 font-mono flex items-center gap-1.5">
              <FileCode className="w-4 h-4" /> 커스텀 부트로더 바이너리 파라미터 조절
            </span>
            <span className="text-xs font-mono text-slate-400">
              현재 지정 파일: <strong className="text-white">{customFileName}</strong> ({customFileSize} Bytes)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div>
              <label className="text-slate-400 block mb-1">바이너리 점유 크기 (Bytes)</label>
              <select
                value={customFileSize}
                onChange={(e) => setCustomFileSize(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-mono"
              >
                <option value={512}>512 Bytes (256 Words)</option>
                <option value={1024}>1,024 Bytes (512 Words)</option>
                <option value={2048}>2,048 Bytes (1,024 Words)</option>
                <option value={4096}>4,096 Bytes (2,048 Words)</option>
                <option value={8192}>8,192 Bytes (4,096 Words)</option>
                <option value={16384}>16,384 Bytes (8,192 Words)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">다운로드 보레이트 (Baud)</label>
              <select
                value={customBaud}
                onChange={(e) => setCustomBaud(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-mono"
              >
                <option value={57600}>57,600 bps</option>
                <option value={115200}>115,200 bps</option>
                <option value={230400}>230,400 bps</option>
                <option value={250000}>250,000 bps</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">통신 프로토콜</label>
              <input
                type="text"
                value={customProtocol}
                onChange={(e) => setCustomProtocol(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-mono"
                placeholder="STK500v1 / DFU / XMODEM"
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. Memory Footprint Breakdown & Proposal Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Memory Allocation Visualization (6 cols) */}
        <div className="lg:col-span-6 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              2. 플래시 메모리 점유 크기 (Memory Footprint)
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400">
              총 {currentProfile.flash} KB Flash
            </span>
          </div>

          {/* Flash Allocation Visual Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-emerald-400 font-bold">
                애플리케이션 영역: {flashMetrics.appFlashBytes.toLocaleString()} B ({flashMetrics.appPct}%)
              </span>
              <span className="text-amber-400 font-bold">
                부트로더: {flashMetrics.bootloaderBytes.toLocaleString()} B ({flashMetrics.bootPct}%)
              </span>
            </div>
            <div className="h-4 w-full bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
              <div
                style={{ width: `${flashMetrics.appPct}%` }}
                className="bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                title={`Application: ${flashMetrics.appFlashBytes} Bytes`}
              />
              <div
                style={{ width: `${flashMetrics.bootPct}%` }}
                className="bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-500"
                title={`Bootloader: ${flashMetrics.bootloaderBytes} Bytes`}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0x0000 (Reset Vector)</span>
              <span>{optimalBootsz.startHexByte} (BLS Start)</span>
              <span>0x{(flashMetrics.totalFlashBytes - 1).toString(16).toUpperCase()} (End)</span>
            </div>
          </div>

          {/* Detailed Statistics Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">부트로더 점유 크기</span>
              <span className="text-lg font-black text-amber-400 block mt-0.5">
                {flashMetrics.bootloaderBytes.toLocaleString()} Bytes
              </span>
              <span className="text-[10px] text-slate-500">
                {optimalBootsz.words.toLocaleString()} Words ({flashMetrics.bootPct}%)
              </span>
            </div>

            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">가용 사용자 플래시</span>
              <span className="text-lg font-black text-emerald-400 block mt-0.5">
                {flashMetrics.appFlashKb} KB
              </span>
              <span className="text-[10px] text-slate-500">
                {flashMetrics.appFlashBytes.toLocaleString()} Bytes ({flashMetrics.appPct}%)
              </span>
            </div>

            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">부트로더 시작 바이트 번지</span>
              <span className="text-sm font-bold text-cyan-300 block mt-0.5">
                {optimalBootsz.startHexByte}
              </span>
              <span className="text-[10px] text-slate-500">
                워드 주소: {optimalBootsz.startHexWord}
              </span>
            </div>

            <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">할당된 BOOTSZ 규격</span>
              <span className="text-sm font-bold text-purple-300 block mt-0.5">
                BOOTSZ1={optimalBootsz.bootszBits[0]}, BOOTSZ0={optimalBootsz.bootszBits[1]}
              </span>
              <span className="text-[10px] text-slate-500">
                {optimalBootsz.words} Words Section
              </span>
            </div>
          </div>
        </div>

        {/* Right: Automated Fuse Bits Calculation & Proposal (6 cols) */}
        <div className="lg:col-span-6 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" />
              3. 자동 계산된 최적 퓨즈 비트 (Fuse Bits Proposal)
            </span>
            <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950/60 px-2.5 py-0.5 rounded border border-purple-800/40">
              HFUSE: {fuseCalculation.hfuseHex}
            </span>
          </div>

          {/* Fuse Options Toggles */}
          <div className="space-y-2 text-xs font-mono">
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:bg-slate-850">
              <div className="space-y-0.5">
                <span className="text-white font-bold block">BOOTRST (리셋 시 부트로더 즉시 점프)</span>
                <span className="text-[10px] text-slate-400">0=Programmed: 전원 인가 시 {optimalBootsz.startHexByte} 번지로 자동 점프</span>
              </div>
              <input
                type="checkbox"
                checked={bootrst}
                onChange={(e) => setBootrst(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:bg-slate-850">
              <div className="space-y-0.5">
                <span className="text-white font-bold block">EESAVE (칩 소거 시 EEPROM 보존)</span>
                <span className="text-[10px] text-slate-400">0=Programmed: 펌웨어 업로드 시 사용자 EEPROM 데이터 보호</span>
              </div>
              <input
                type="checkbox"
                checked={eesave}
                onChange={(e) => setEesave(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
            </label>
          </div>

          {/* Resulting Fuse Values Proposal Cards */}
          <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Low Fuse (LFUSE)</span>
              <span className="text-base font-black text-cyan-400 block my-0.5">
                {fuseCalculation.lfuseHex}
              </span>
              <span className="text-[9px] text-slate-400">16MHz Crystal</span>
            </div>

            <div className="bg-slate-900 p-2.5 rounded-xl border border-amber-500/50 shadow-md">
              <span className="text-[10px] text-amber-400 font-bold block">High Fuse (HFUSE)</span>
              <span className="text-base font-black text-amber-300 block my-0.5">
                {fuseCalculation.hfuseHex}
              </span>
              <span className="text-[9px] text-amber-400 font-bold">BOOTSZ={optimalBootsz.words}W</span>
            </div>

            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Ext Fuse (EFUSE)</span>
              <span className="text-base font-black text-purple-400 block my-0.5">
                {fuseCalculation.efuseHex}
              </span>
              <span className="text-[9px] text-slate-400">2.7V BOD</span>
            </div>
          </div>

          {/* Recommendation Banner */}
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <div className="space-y-0.5">
              <span className="font-bold block">최적화 설정 제안:</span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {bootloaderType === 'optiboot'
                  ? `Optiboot을 사용할 경우 구형 2KB 대비 ${(flashMetrics.totalFlashKb * 1024 - flashMetrics.appFlashBytes - 512).toLocaleString()} 바이트의 플래시가 절약되어 대용량 펌웨어에 훨씬 유리합니다.`
                  : `선택하신 부트로더 규격(${activeBootloaderInfo.sizeBytes}B)에 맞춰 ${optimalBootsz.words}워드(${optimalBootsz.bytes}B) 섹션과 시작 주소 ${optimalBootsz.startHexByte}가 정확히 할당되었습니다.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Production Avrdude Commands & Hex Preview */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-bold text-white">
              avrdude 퓨즈 라이팅 & 부트로더 플래시 일괄 실행 커맨드
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadHex}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>.hex 다운로드</span>
            </button>
            <button
              onClick={copyAvrdude}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-mono font-bold transition shadow-md shadow-emerald-500/20"
            >
              {copiedAvrdude ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAvrdude ? '복사 완료!' : 'avrdude 명령어 복사'}</span>
            </button>
          </div>
        </div>
        <pre className="p-4 text-xs font-mono text-emerald-300 overflow-x-auto max-h-56 custom-scrollbar leading-relaxed">
          {avrdudeBurnBootloaderCmd}
        </pre>
      </div>

      {/* 4. Hex File Content Preview */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>선택된 HEX 파일 미리보기 ({activeBootloaderInfo.filename})</span>
          </div>
          <button
            onClick={copyHex}
            className="text-slate-400 hover:text-white text-[11px] font-mono flex items-center gap-1"
          >
            {copiedHex ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedHex ? '복사됨' : 'HEX 복사'}</span>
          </button>
        </div>
        <pre className="p-3.5 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-40 custom-scrollbar leading-relaxed">
          {activeBootloaderInfo.hexPreview}
        </pre>
      </div>
    </div>
  );
};
