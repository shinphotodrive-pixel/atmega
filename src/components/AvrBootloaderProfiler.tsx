import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  HardDrive,
  Cpu,
  Layers,
  Zap,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Download,
  Info,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Activity,
  Gauge,
  Lock,
  Unlock,
  Terminal,
  FileCode2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type BootloaderType = 'optiboot' | 'arduino_stk500' | 'custom';
export type SecurityMode = 'dev_unlocked' | 'boot_protect' | 'full_protect' | 'chip_erase_only';

export interface BootloaderProfileData {
  type: BootloaderType;
  name: string;
  subtitle: string;
  desc: string;
  codeSizeBytes: number;
  reservedPartitionBytes: number;
  defaultBaud: number;
  u2xEnabled: boolean;
  features: string[];
  protocol: string;
  wdtSupported: boolean;
  eepromSupport: boolean;
  virtualBoot: boolean;
  startupLatencyMs: number;
  bootSzBits: '11' | '10' | '01' | '00';
}

export const AvrBootloaderProfiler: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Active Bootloader Focus for Detail Panel (or 3-way compare)
  const [activeBootloader, setActiveBootloader] = useState<BootloaderType>('optiboot');

  // Custom Bootloader Configurator States
  const [customSizeChoice, setCustomSizeChoice] = useState<number>(1024);
  const [customBaud, setCustomBaud] = useState<number>(115200);
  const [customFeatures, setCustomFeatures] = useState<{
    wdtSafety: boolean;
    eepromRw: boolean;
    crcCheck: boolean;
    rs485Flow: boolean;
    bigBootSupport: boolean;
  }>({
    wdtSafety: true,
    eepromRw: false,
    crcCheck: true,
    rs485Flow: false,
    bigBootSupport: selectedMCU !== 'atmega328p'
  });

  // Operating Clock Frequency for Baud Rate & Timing Math
  const [cpuClockMhz, setCpuClockMhz] = useState<number>(16);

  // Security Mode Choice for Lock Bits
  const [securityMode, setSecurityMode] = useState<SecurityMode>('boot_protect');

  // Sample User App Size for Flash Slack & Upload Time Simulation
  const [sketchSizeBytes, setSketchSizeBytes] = useState<number>(18432); // 18 KB typical sketch

  const [copiedText, setCopiedText] = useState<string | null>(null);

  // MCU Specs
  const mcuSpecs = useMemo(() => {
    const flashBytes = currentProfile.flash;
    let optibootReserved = 512;
    let stk500Reserved = 2048;

    if (selectedMCU === 'atmega128' || selectedMCU === 'atmega640') {
      optibootReserved = 1024; // MegaCore Optiboot uses 1KB
      stk500Reserved = 4096; // STK500v2 on Mega uses 4KB
    }

    return {
      flashBytes,
      flashKB: flashBytes / 1024,
      optibootReserved,
      stk500Reserved,
      pageSizeBytes: selectedMCU === 'atmega328p' ? 128 : 256
    };
  }, [selectedMCU, currentProfile.flash]);

  // Bootloader Profiles for Comparison
  const bootloaderProfiles = useMemo<Record<BootloaderType, BootloaderProfileData>>(() => {
    // Custom calculated size
    let customEstimatedCodeSize = 512;
    if (customFeatures.wdtSafety) customEstimatedCodeSize += 96;
    if (customFeatures.eepromRw) customEstimatedCodeSize += 220;
    if (customFeatures.crcCheck) customEstimatedCodeSize += 180;
    if (customFeatures.rs485Flow) customEstimatedCodeSize += 64;
    if (customFeatures.bigBootSupport) customEstimatedCodeSize += 140;

    let customBootSz: '11' | '10' | '01' | '00' = '11';
    if (customSizeChoice === 1024) customBootSz = '10';
    else if (customSizeChoice === 2048) customBootSz = '01';
    else if (customSizeChoice === 4096) customBootSz = '00';

    return {
      optiboot: {
        type: 'optiboot',
        name: 'Optiboot v8.x',
        subtitle: '초경량 초고속 표준 부트로더',
        desc: '불필요한 모니터 명령을 제거하고 STK500v1 핵심 프로토콜만 컴팩트하게 인라인화하여 플래시 낭비를 극소화',
        codeSizeBytes: mcuSpecs.optibootReserved === 512 ? 504 : 980,
        reservedPartitionBytes: mcuSpecs.optibootReserved,
        defaultBaud: 115200,
        u2xEnabled: true,
        features: ['512B / 1KB 초소형 풋프린트', '고속 115200 bps 업로드', 'WDT 리셋 루프 방지', '가상 부트 파티션 지원'],
        protocol: 'STK500v1 Minimal',
        wdtSupported: true,
        eepromSupport: false,
        virtualBoot: true,
        startupLatencyMs: 16,
        bootSzBits: selectedMCU === 'atmega328p' ? '11' : '11'
      },
      arduino_stk500: {
        type: 'arduino_stk500',
        name: 'Arduino 기본 STK500',
        subtitle: '레거시 ATmegaBOOT / STK500v2',
        desc: '구형 Arduino Duemilanove 및 초기 Mega2560에 탑재된 표준 부트로더로 EEPROM 읽기/쓰기 및 모니터 커맨드 포함',
        codeSizeBytes: mcuSpecs.stk500Reserved === 2048 ? 1980 : 3840,
        reservedPartitionBytes: mcuSpecs.stk500Reserved,
        defaultBaud: 57600,
        u2xEnabled: false,
        features: ['2KB / 4KB 대형 풋프린트', 'EEPROM 읽기/쓰기 지원', '긴 리셋 부팅 지연 (약 1.5초)', 'STK500 풀 세트 지원'],
        protocol: selectedMCU === 'atmega328p' ? 'STK500v1 Full' : 'STK500v2 Full',
        wdtSupported: false,
        eepromSupport: true,
        virtualBoot: false,
        startupLatencyMs: 1400,
        bootSzBits: '01'
      },
      custom: {
        type: 'custom',
        name: '맞춤형 커스텀 부트로더',
        subtitle: '산업용 / 엔터프라이즈 전용',
        desc: 'RS-485 반이중 제어, CRC-32 펌웨어 무결성 검증, WDT 안전 롤백 등 사용자가 요구하는 특수 기능을 통합 구성',
        codeSizeBytes: customEstimatedCodeSize,
        reservedPartitionBytes: customSizeChoice,
        defaultBaud: customBaud,
        u2xEnabled: true,
        features: [
          customFeatures.wdtSafety ? 'WDT 안전 롤백' : '기본 WDT',
          customFeatures.crcCheck ? 'CRC-32 무결성 체크' : '단순 체크섬',
          customFeatures.rs485Flow ? 'RS-485 DE/RE 제어' : '표준 UART',
          customFeatures.eepromRw ? 'EEPROM 키 관리' : 'Flash 전용'
        ],
        protocol: 'Custom Secure STK',
        wdtSupported: customFeatures.wdtSafety,
        eepromSupport: customFeatures.eepromRw,
        virtualBoot: false,
        startupLatencyMs: 50,
        bootSzBits: customBootSz
      }
    };
  }, [mcuSpecs, customFeatures, customSizeChoice, customBaud, selectedMCU]);

  // Current Focused Profile
  const currentBoot = bootloaderProfiles[activeBootloader];

  // Calculations for Baud Rate Error & Upload Time
  const baudMath = useMemo(() => {
    const fCpuHz = cpuClockMhz * 1_000_000;
    const targetBaud = currentBoot.defaultBaud;
    const isU2x = currentBoot.u2xEnabled;

    const divisor = isU2x ? 8 : 16;
    const ubrr = Math.max(0, Math.round(fCpuHz / (divisor * targetBaud) - 1));
    const actualBaud = fCpuHz / (divisor * (ubrr + 1));
    const errorPct = ((actualBaud - targetBaud) / targetBaud) * 100;
    const absError = Math.abs(errorPct);

    // Upload time calculation for `sketchSizeBytes`
    // Protocol overhead: ~1.2x byte framing (1 start, 8 data, 1 stop = 10 bits/byte + packet sync)
    // Flash page write time: ~4.5ms per page
    const totalPages = Math.ceil(sketchSizeBytes / mcuSpecs.pageSizeBytes);
    const flashWriteLatencySec = (totalPages * 4.5) / 1000;
    const uartTransferSec = (sketchSizeBytes * 10) / actualBaud;
    const estimatedUploadSec = (uartTransferSec * 1.15 + flashWriteLatencySec).toFixed(2);

    return {
      ubrr,
      actualBaud: Math.round(actualBaud),
      errorPct: errorPct.toFixed(2),
      absError,
      isSafeError: absError < 2.5,
      estimatedUploadSec,
      uartTransferSec: uartTransferSec.toFixed(2)
    };
  }, [cpuClockMhz, currentBoot, sketchSizeBytes, mcuSpecs.pageSizeBytes]);

  // Security Lock Bits & Fuse Values Calculation
  const securityConfig = useMemo(() => {
    // Lock Bit mapping (Mode 1 to 4)
    // BLB12:BLB11 (Bootloader Protection)
    // BLB02:BLB01 (Application Protection)
    // LB2:LB1     (External Memory Lock)
    let lockHex = '0xFF';
    let lockDesc = '개발 단계: 모든 메모리 구역 읽기/쓰기 자유';
    let lockBits = '0b11111111';

    if (securityMode === 'boot_protect') {
      // BLB12:11 = 10 (부트로더 구역 SPM 쓰기 금지)
      // 0b11101111 = 0xEF or 0xCF depending on reserved bits
      lockHex = '0xCF';
      lockBits = '0b11001111';
      lockDesc = '부트로더 보호: 런타임 SPM에 의한 부트로더 코드 오염 및 자기 덮어쓰기 차단';
    } else if (securityMode === 'full_protect') {
      // BLB12:11 = 00, BLB02:01 = 10
      lockHex = '0x0F';
      lockBits = '0b00001111';
      lockDesc = '상용 보안: 부트로더와 앱 영역 상호 침범 차단 및 지적재산권(IP) 보호';
    } else if (securityMode === 'chip_erase_only') {
      // LB2:LB1 = 00 (칩 이레이즈 없이는 ISP/JTAG 프로그래머를 통한 덤프 불가)
      lockHex = '0x0C';
      lockBits = '0b00001100';
      lockDesc = '양산 최종 고정: 칩 전체 삭제 외 프로그래밍 및 코드 읽기 원천 봉쇄';
    }

    // High Fuse BOOTSZ calculation
    // BOOTRST is active low (0 = Enable reset to bootloader)
    let hfuseHex = '0xDE'; // ATmega328P 512B default
    if (selectedMCU === 'atmega328p') {
      if (currentBoot.reservedPartitionBytes === 512) hfuseHex = '0xDE';
      else if (currentBoot.reservedPartitionBytes === 1024) hfuseHex = '0xDC';
      else if (currentBoot.reservedPartitionBytes === 2048) hfuseHex = '0xDA';
      else hfuseHex = '0xD8';
    } else if (selectedMCU === 'atmega128') {
      // ATmega128 BOOTRST in High fuse (bit 0)
      if (currentBoot.reservedPartitionBytes === 1024) hfuseHex = '0xCE';
      else if (currentBoot.reservedPartitionBytes === 2048) hfuseHex = '0xCC';
      else if (currentBoot.reservedPartitionBytes === 4096) hfuseHex = '0xCA';
      else hfuseHex = '0xC8';
    } else {
      // ATmega640
      if (currentBoot.reservedPartitionBytes === 1024) hfuseHex = '0xDE';
      else if (currentBoot.reservedPartitionBytes === 2048) hfuseHex = '0xDC';
      else if (currentBoot.reservedPartitionBytes === 4096) hfuseHex = '0xDA';
      else hfuseHex = '0xD8';
    }

    // Start address in Hex
    const bootStartAddr = mcuSpecs.flashBytes - currentBoot.reservedPartitionBytes;
    const bootStartHex = `0x${bootStartAddr.toString(16).toUpperCase()}`;

    return {
      lockHex,
      lockBits,
      lockDesc,
      hfuseHex,
      bootStartHex,
      bootStartAddr
    };
  }, [securityMode, selectedMCU, currentBoot, mcuSpecs.flashBytes]);

  // Flash Memory Allocation Bar Percentages
  const flashBar = useMemo(() => {
    const total = mcuSpecs.flashBytes;
    const reserved = currentBoot.reservedPartitionBytes;
    const actualCode = currentBoot.codeSizeBytes;
    const usableForApp = total - reserved;

    const slackBytes = Math.max(0, reserved - actualCode);

    const appPct = (usableForApp / total) * 100;
    const codePct = (actualCode / total) * 100;
    const slackPct = (slackBytes / total) * 100;

    // Compared to standard Arduino bootloader, how much flash does Optiboot save?
    const optibootSavedBytes = mcuSpecs.stk500Reserved - mcuSpecs.optibootReserved;

    return {
      usableForApp,
      reserved,
      actualCode,
      slackBytes,
      appPct: appPct.toFixed(1),
      codePct: codePct.toFixed(2),
      slackPct: slackPct.toFixed(2),
      optibootSavedBytes
    };
  }, [mcuSpecs, currentBoot]);

  // Avrdude Flash Command Snippet
  const avrdudeCommand = useMemo(() => {
    const partCode = selectedMCU === 'atmega328p' ? 'm328p' : selectedMCU === 'atmega128' ? 'm128' : 'm640';
    const hexName = activeBootloader === 'optiboot' ? 'optiboot.hex' : activeBootloader === 'arduino_stk500' ? 'stk500.hex' : 'custom_boot.hex';

    return `# 1. 락 비트 해제 및 칩 지우기
avrdude -c usbasp -p ${partCode} -e -U lock:w:0xFF:m

# 2. 퓨즈 비트 설정 (BOOTRST 활성화, BOOTSZ 파티션 설정)
avrdude -c usbasp -p ${partCode} -U hfuse:w:${securityConfig.hfuseHex}:m

# 3. 부트로더 HEX 플래싱 & 보안 락 비트(${securityConfig.lockHex}) 잠금
avrdude -c usbasp -p ${partCode} -U flash:w:${hexName}:i -U lock:w:${securityConfig.lockHex}:m`;
  }, [selectedMCU, activeBootloader, securityConfig]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.85 } });
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleDownloadMakefile = () => {
    const content = `# Makefile Bootloader Build Configuration for ${currentProfile.name}
TARGET      = ${activeBootloader}
MCU         = ${selectedMCU}
F_CPU       = ${cpuClockMhz}000000UL
BAUD_RATE   = ${currentBoot.defaultBaud}
BOOTLOADER_ADDRESS = ${securityConfig.bootStartHex}

# Linker Section Relocation
LDFLAGS += -Wl,--section-start=.text=${securityConfig.bootStartHex}

# AVR-GCC Compiler Flags
CFLAGS  += -DF_CPU=$(F_CPU) -DBAUD_RATE=$(BAUD_RATE)
CFLAGS  += -Os -funsigned-char -funsigned-bitfields -fpack-struct -fshort-enums
CFLAGS  += -ffunction-sections -fdata-sections -Wl,--gc-sections

# Fuse & Lock Configuration
HFUSE   = ${securityConfig.hfuseHex}
LOCK    = ${securityConfig.lockHex}
`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Makefile.bootloader_${selectedMCU}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
            <HardDrive className="w-3.5 h-3.5" /> Bootloader Footprint & Security Profiler
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            AVR 부트로더 프로파일러 (Optiboot vs Arduino vs Custom 3-Way 비교 분석)
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            <span className="text-amber-300 font-medium">Optiboot</span>, 
            <span className="text-cyan-300 font-medium"> Arduino 기본 STK500</span>, 그리고 
            <span className="text-purple-300 font-medium"> 맞춤형 커스텀 부트로더</span>의 플래시 메모리 점유율, 
            Baud Rate 전송 오차율, 그리고 보안 퓨즈(Lock bits) 구성을 비교 분석합니다.
          </p>
        </div>

        {/* Target Info Badge */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1 self-start lg:self-center">
          <div className="flex items-center gap-2 text-slate-400">
            <Cpu className="w-4 h-4 text-amber-400" />
            <span>타깃 MCU:</span>
            <span className="text-white font-bold">{currentProfile.name}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            총 Flash: <span className="text-amber-400 font-mono">{mcuSpecs.flashKB} KB</span> ({mcuSpecs.flashBytes.toLocaleString()} Bytes)
          </div>
        </div>
      </div>

      {/* 3-Way Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.keys(bootloaderProfiles) as BootloaderType[]).map((bKey) => {
          const item = bootloaderProfiles[bKey];
          const isSelected = activeBootloader === bKey;

          return (
            <div
              key={bKey}
              onClick={() => setActiveBootloader(bKey)}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? bKey === 'optiboot'
                    ? 'bg-amber-950/40 border-amber-500/60 ring-2 ring-amber-500/30 shadow-lg shadow-amber-950/50'
                    : bKey === 'arduino_stk500'
                    ? 'bg-cyan-950/40 border-cyan-500/60 ring-2 ring-cyan-500/30 shadow-lg shadow-cyan-950/50'
                    : 'bg-purple-950/40 border-purple-500/60 ring-2 ring-purple-500/30 shadow-lg shadow-purple-950/50'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950/90'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    {item.name}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      bKey === 'optiboot'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : bKey === 'arduino_stk500'
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                        : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                    }`}
                  >
                    {item.reservedPartitionBytes} Bytes
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-medium mb-1">{item.subtitle}</div>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">{item.desc}</p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>플래시 점유율:</span>
                  <span className="font-mono text-white font-semibold">
                    {((item.reservedPartitionBytes / mcuSpecs.flashBytes) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>기본 통신 속도:</span>
                  <span className="font-mono text-emerald-400 font-semibold">{item.defaultBaud.toLocaleString()} bps</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>부팅 지연 시간:</span>
                  <span className="font-mono text-slate-300">{item.startupLatencyMs} ms</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Bootloader Configuration Sub-panel (if custom selected) */}
      {activeBootloader === 'custom' && (
        <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wider">
            <Sliders className="w-4 h-4 text-purple-400" /> 맞춤형 커스텀 부트로더 특수 기능 세부 빌드 설정
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">할당할 BOOTSZ 파티션 크기</label>
              <select
                value={customSizeChoice}
                onChange={(e) => setCustomSizeChoice(parseInt(e.target.value))}
                className="w-full bg-slate-900 border border-purple-500/40 rounded-lg p-2 text-white"
              >
                <option value={512}>512 Bytes (초경량)</option>
                <option value={1024}>1024 Bytes (1 KB 표준)</option>
                <option value={2048}>2048 Bytes (2 KB 확장)</option>
                <option value={4096}>4096 Bytes (4 KB 풀엔터프라이즈)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">커스텀 UART Baud Rate</label>
              <select
                value={customBaud}
                onChange={(e) => setCustomBaud(parseInt(e.target.value))}
                className="w-full bg-slate-900 border border-purple-500/40 rounded-lg p-2 text-white font-mono"
              >
                <option value={38400}>38,400 bps</option>
                <option value={57600}>57,600 bps</option>
                <option value={115200}>115,200 bps</option>
                <option value={230400}>230,400 bps</option>
                <option value={250000}>250,000 bps (0% 오차 @ 16MHz)</option>
                <option value={500000}>500,000 bps (초고속)</option>
              </select>
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-4 pt-4">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={customFeatures.wdtSafety}
                  onChange={(e) => setCustomFeatures({ ...customFeatures, wdtSafety: e.target.checked })}
                  className="rounded bg-slate-900 border-purple-500/40 text-purple-500 focus:ring-0"
                />
                WDT 안전 롤백 (+96B)
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={customFeatures.crcCheck}
                  onChange={(e) => setCustomFeatures({ ...customFeatures, crcCheck: e.target.checked })}
                  className="rounded bg-slate-900 border-purple-500/40 text-purple-500 focus:ring-0"
                />
                CRC-32 무결성 검증 (+180B)
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={customFeatures.rs485Flow}
                  onChange={(e) => setCustomFeatures({ ...customFeatures, rs485Flow: e.target.checked })}
                  className="rounded bg-slate-900 border-purple-500/40 text-purple-500 focus:ring-0"
                />
                RS-485 DE 흐름제어 (+64B)
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={customFeatures.eepromRw}
                  onChange={(e) => setCustomFeatures({ ...customFeatures, eepromRw: e.target.checked })}
                  className="rounded bg-slate-900 border-purple-500/40 text-purple-500 focus:ring-0"
                />
                EEPROM 읽기/쓰기 (+220B)
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Flash Memory Footprint Visualizer Bar */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              플래시 메모리 파티션 점유율 & 슬랙(Slack) 분석
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            시작 주소: <strong className="text-white font-mono">{securityConfig.bootStartHex}</strong> (Flash Top)
          </span>
        </div>

        {/* Visual Bar */}
        <div className="space-y-2">
          <div className="h-7 w-full bg-slate-900 rounded-lg overflow-hidden flex border border-slate-800 text-[10px] font-bold">
            {/* User Application Area */}
            <div
              style={{ width: `${flashBar.appPct}%` }}
              className="bg-emerald-600/90 text-white flex items-center justify-center truncate px-2"
              title={`사용자 앱 가용 영역: ${flashBar.usableForApp.toLocaleString()} Bytes`}
            >
              사용자 앱 가용 영역 ({flashBar.appPct}%)
            </div>

            {/* Bootloader Actual Code */}
            <div
              style={{ width: `${Math.max(1, parseFloat(flashBar.codePct))}%` }}
              className="bg-amber-500 text-slate-950 flex items-center justify-center truncate px-1"
              title={`부트로더 실제 코드: ${flashBar.actualCode} Bytes`}
            >
              Boot Code
            </div>

            {/* Slack / Wasted in Partition */}
            {parseFloat(flashBar.slackPct) > 0 && (
              <div
                style={{ width: `${Math.max(0.5, parseFloat(flashBar.slackPct))}%` }}
                className="bg-slate-700/80 text-slate-300 flex items-center justify-center truncate px-1"
                title={`파티션 내 유휴 슬랙: ${flashBar.slackBytes} Bytes`}
              >
                Slack
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded"></span> 
                앱 가용: <strong className="text-white font-mono">{flashBar.usableForApp.toLocaleString()} B</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-amber-500 rounded"></span> 
                부트로더 코드: <strong className="text-white font-mono">{flashBar.actualCode} B</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-slate-600 rounded"></span> 
                슬랙(여유): <strong className="text-slate-300 font-mono">{flashBar.slackBytes} B</strong>
              </span>
            </div>

            <div className="text-emerald-400 font-medium text-[11px]">
              {activeBootloader === 'optiboot' ? (
                <span>★ 레거시 STK500 대비 플래시 <strong>{flashBar.optibootSavedBytes} Bytes</strong> 절약 중!</span>
              ) : activeBootloader === 'arduino_stk500' ? (
                <span className="text-amber-400">Optiboot로 전환 시 1.5KB 이상의 Flash를 추가 확보할 수 있습니다.</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Baud Rate Optimization & Security Lock Bits Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Baud Rate & Upload Speed Optimization */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Baud Rate 전송 속도 및 오차율 최적화
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>F_CPU:</span>
              <select
                value={cpuClockMhz}
                onChange={(e) => setCpuClockMhz(parseInt(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-white"
              >
                <option value={8}>8 MHz (내부 RC)</option>
                <option value={12}>12 MHz (USB)</option>
                <option value={16}>16 MHz (표준 Uno/Mega)</option>
                <option value={20}>20 MHz (오버클럭)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[11px] block">타깃 전송 속도 (Baud Rate)</span>
              <span className="text-white font-mono font-bold text-sm">
                {currentBoot.defaultBaud.toLocaleString()} bps
              </span>
              <span className="text-[10px] text-slate-500 block">
                {currentBoot.u2xEnabled ? 'U2X(2배속 모드) 활성화' : 'U2X 비활성화 (표준 16분주)'}
              </span>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[11px] block">실제 클럭 분주 오차율</span>
              <span
                className={`font-mono font-bold text-sm flex items-center gap-1 ${
                  baudMath.isSafeError ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {baudMath.errorPct}%
                {baudMath.isSafeError ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                )}
              </span>
              <span className="text-[10px] text-slate-500 block">UBRR = {baudMath.ubrr} (목표 대비 안전 한계: ±2.5%)</span>
            </div>
          </div>

          {/* Upload Time Simulation Box */}
          <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-300">
              <span>테스트 펌웨어 스케치 크기:</span>
              <span className="font-mono text-amber-400 font-bold">{(sketchSizeBytes / 1024).toFixed(1)} KB</span>
            </div>
            <input
              type="range"
              min={2048}
              max={mcuSpecs.flashBytes - 4096}
              step={1024}
              value={sketchSizeBytes}
              onChange={(e) => setSketchSizeBytes(parseInt(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-400 pt-1">
              <span>예상 플래싱 소요 시간:</span>
              <span className="text-white font-mono font-semibold">
                약 {baudMath.estimatedUploadSec} 초 (UART: {baudMath.uartTransferSec}s + 페이지 쓰기 지연)
              </span>
            </div>
          </div>
        </div>

        {/* Right: Security Fuse Bits & Lock Bits Configuration */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                보안 퓨즈 비트(Fuse) & 락 비트(Lock bits) 구성
              </h3>
            </div>
            <span className="text-xs font-mono text-cyan-400 font-bold">
              Lock: {securityConfig.lockHex}
            </span>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">보안 보호 레벨 (Security Mode)</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => setSecurityMode('dev_unlocked')}
                className={`p-2 rounded-lg border text-left transition-all ${
                  securityMode === 'dev_unlocked'
                    ? 'bg-slate-800 border-amber-400 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Unlock className="w-3.5 h-3.5 text-amber-400" /> 개발 모드
                </div>
                <span className="text-[10px] text-slate-500 block">제한 없음 (0xFF)</span>
              </button>

              <button
                onClick={() => setSecurityMode('boot_protect')}
                className={`p-2 rounded-lg border text-left transition-all ${
                  securityMode === 'boot_protect'
                    ? 'bg-slate-800 border-cyan-400 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> 부트로더 보호 (권장)
                </div>
                <span className="text-[10px] text-slate-500 block">SPM 덮어쓰기 방지 ({securityConfig.lockHex})</span>
              </button>

              <button
                onClick={() => setSecurityMode('full_protect')}
                className={`p-2 rounded-lg border text-left transition-all ${
                  securityMode === 'full_protect'
                    ? 'bg-slate-800 border-indigo-400 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" /> 완전 분리 모드
                </div>
                <span className="text-[10px] text-slate-500 block">LPM/SPM 상호 침범 차단</span>
              </button>

              <button
                onClick={() => setSecurityMode('chip_erase_only')}
                className={`p-2 rounded-lg border text-left transition-all ${
                  securityMode === 'chip_erase_only'
                    ? 'bg-slate-800 border-rose-400 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> 양산 최종 고정
                </div>
                <span className="text-[10px] text-slate-500 block">외부 덤프 차단 (Chip Erase만 허용)</span>
              </button>
            </div>
          </div>

          {/* Fuse Registers Computed Readout */}
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>High Fuse (BOOTSZ & BOOTRST):</span>
              <span className="text-amber-400 font-mono font-bold">{securityConfig.hfuseHex}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Lock Fuse Byte:</span>
              <span className="text-cyan-400 font-mono font-bold">{securityConfig.lockHex}</span>
            </div>
            <p className="text-[11px] text-slate-400 pt-1 leading-relaxed border-t border-slate-800/80">
              {securityConfig.lockDesc}
            </p>
          </div>
        </div>
      </div>

      {/* 3-Way Comparative Feature Matrix Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-400" /> 3대 부트로더 기술 사양 종합 비교 매트릭스
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60">
                <th className="p-2.5">비교 항목</th>
                <th className="p-2.5 text-amber-400 font-bold">Optiboot v8.x</th>
                <th className="p-2.5 text-cyan-400 font-bold">Arduino 기본 STK500</th>
                <th className="p-2.5 text-purple-400 font-bold">맞춤형 커스텀 부트로더</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              <tr>
                <td className="p-2.5 font-semibold text-slate-400">플래시 예약 크기</td>
                <td className="p-2.5 font-mono text-emerald-400 font-bold">512B / 1KB</td>
                <td className="p-2.5 font-mono text-rose-400">2KB / 4KB</td>
                <td className="p-2.5 font-mono text-purple-300">{bootloaderProfiles.custom.reservedPartitionBytes} Bytes</td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold text-slate-400">업로드 통신 속도</td>
                <td className="p-2.5 font-mono text-white">115,200 bps</td>
                <td className="p-2.5 font-mono text-slate-400">57,600 bps</td>
                <td className="p-2.5 font-mono text-white">{customBaud.toLocaleString()} bps</td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold text-slate-400">부팅 초기 지연 시간</td>
                <td className="p-2.5 font-mono text-emerald-400">약 16 ms (즉시 실행)</td>
                <td className="p-2.5 font-mono text-slate-400">약 1,400 ms (1.4초)</td>
                <td className="p-2.5 font-mono text-white">약 50 ms</td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold text-slate-400">WDT 무한 리셋 방지</td>
                <td className="p-2.5 text-emerald-400">완벽 지원 (MCUSR 클리어)</td>
                <td className="p-2.5 text-rose-400">미지원 (WDT 루프 위험)</td>
                <td className="p-2.5 text-emerald-400">안전 롤백 메커니즘 탑재</td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold text-slate-400">EEPROM 읽기/쓰기</td>
                <td className="p-2.5 text-slate-500">제외 (코드 경량화)</td>
                <td className="p-2.5 text-emerald-400">지원</td>
                <td className="p-2.5 text-purple-300">{customFeatures.eepromRw ? '지원' : '선택적 제외'}</td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold text-slate-400">무결성 검증 (CRC)</td>
                <td className="p-2.5 text-slate-500">단순 체크섬</td>
                <td className="p-2.5 text-slate-500">단순 체크섬</td>
                <td className="p-2.5 text-emerald-400 font-semibold">{customFeatures.crcCheck ? 'CRC-32 하드웨어 검증' : '기본'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Flashing Commands & Makefile Generator */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                avrdude 플래싱 명령어 & 빌드 환경설정
              </h3>
              <p className="text-xs text-slate-400">
                선택한 부트로더({currentBoot.name}), BOOTSZ 퓨즈({securityConfig.hfuseHex}), 락 비트({securityConfig.lockHex}) 기반 즉시 실행 스크립트
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(avrdudeCommand, 'avrdude')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20"
            >
              {copiedText === 'avrdude' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedText === 'avrdude' ? '복사 완료!' : 'avrdude 명령 복사'}
            </button>
            <button
              onClick={handleDownloadMakefile}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Makefile 다운로드
            </button>
          </div>
        </div>

        <pre className="p-4 bg-slate-900/90 border border-slate-800 rounded-lg text-xs font-mono text-amber-200/90 overflow-x-auto leading-relaxed">
          <code>{avrdudeCommand}</code>
        </pre>
      </div>
    </div>
  );
};
