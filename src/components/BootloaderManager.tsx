import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  HardDrive,
  Cpu,
  Clock,
  Layers,
  Zap,
  Terminal,
  Check,
  Copy,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BarChart3,
  Sliders,
  ShieldCheck,
  Activity,
  ArrowRight,
  TrendingDown,
  RotateCcw,
  Sparkles
} from 'lucide-react';

export interface BootloaderManagerProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type BootloaderOptionId = 'optiboot' | 'standard_arduino' | 'stk500v2_megacore' | 'urboot' | 'no_bootloader';

export interface BootloaderOption {
  id: BootloaderOptionId;
  name: string;
  shortName: string;
  tagline: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  flashSizeBytes: Record<SupportedMCU, number>;
  protocol: string;
  defaultBaud: number;
  bootDelaySec: number;
  wdtProtection: boolean;
  eepromSupport: boolean;
  autobaudSupport: boolean;
  avrdudeProgrammer: string;
  recommended: boolean;
  summary: string;
  pros: string[];
  cons: string[];
}

const BOOTLOADER_OPTIONS: BootloaderOption[] = [
  {
    id: 'optiboot',
    name: 'Optiboot 8.x (초경량 고성능 표준 부트로더)',
    shortName: 'Optiboot',
    tagline: 'Arduino Uno 공식 표준 • 단 512바이트 점유',
    badge: '★ 공식 권장 (공간 절약)',
    badgeColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-950/60',
    badgeBorder: 'border-emerald-800/50',
    flashSizeBytes: {
      atmega328p: 512,  // 0.5 KB (256 Words)
      atmega128: 1024,  // 1.0 KB (512 Words)
      atmega640: 1024,  // 1.0 KB (512 Words)
      atmega2560: 1024  // 1.0 KB (512 Words)
    },
    protocol: 'STK500v1',
    defaultBaud: 115200,
    bootDelaySec: 1.0,
    wdtProtection: true,
    eepromSupport: true,
    autobaudSupport: false,
    avrdudeProgrammer: 'arduino / urclock',
    recommended: true,
    summary: '표준 아두이노 부트로더 대비 1.5KB의 소중한 플래시 메모리를 절약하며, 115,200bps의 빠른 업로드 속도와 Watchdog 타이머 무한 리셋 버그를 완벽 해결했습니다.',
    pros: [
      '단 512바이트만 점유 (구형 2KB 대비 1,536B 플래시 회수)',
      '115,200 bps 고속 업로드 지원',
      'Watchdog 타이머 리셋 루프 방지 코드 내장',
      '부팅 딜레이 단 1.0초 (빠른 앱 진입)'
    ],
    cons: [
      '128KB 초과 플래시(ATmega2560 등)에서는 64KW 뱅크 전환을 위해 1KB 버전 필요'
    ]
  },
  {
    id: 'standard_arduino',
    name: '구형 표준 Arduino Bootloader (ATmegaBOOT)',
    shortName: 'ATmegaBOOT',
    tagline: '구형 Duemilanove / Diecimila 레거시 부트로더',
    badge: '레거시 (비대함)',
    badgeColor: 'text-amber-400',
    badgeBg: 'bg-amber-950/60',
    badgeBorder: 'border-amber-800/50',
    flashSizeBytes: {
      atmega328p: 2048, // 2.0 KB
      atmega128: 2048,
      atmega640: 2048,
      atmega2560: 8192
    },
    protocol: 'STK500v1',
    defaultBaud: 57600,
    bootDelaySec: 2.5,
    wdtProtection: false,
    eepromSupport: true,
    autobaudSupport: false,
    avrdudeProgrammer: 'stk500v1',
    recommended: false,
    summary: '초기 아두이노 보드에 탑재된 구형 부트로더로 2KB~8KB의 거대한 플래시를 낭비하며 부팅 시 LED를 3회 깜빡이느라 지연이 깁니다.',
    pros: [
      '매우 오래된 레거시 개발 환경과 100% 호환'
    ],
    cons: [
      '2,048바이트(Optiboot의 4배)나 차지하여 사용자 코드 공간 잠식',
      '57,600 bps로 업로드 속도가 상대적으로 느림',
      'WDT 활성화 시 리셋 후 부트로더에서 무한 루프 발생 결함',
      '긴 부팅 지연 시간 (약 2.5초)'
    ]
  },
  {
    id: 'stk500v2_megacore',
    name: 'STK500v2 Wiring (MegaCore / 대용량 플래그십)',
    shortName: 'STK500v2',
    tagline: 'ATmega2560 / ATmega128 대용량 128KB+ 플래시 전용',
    badge: '대용량 칩 표준',
    badgeColor: 'text-sky-400',
    badgeBg: 'bg-sky-950/60',
    badgeBorder: 'border-sky-800/50',
    flashSizeBytes: {
      atmega328p: 2048,
      atmega128: 4096, // 4.0 KB
      atmega640: 4096, // 4.0 KB
      atmega2560: 4096 // 4.0 KB
    },
    protocol: 'STK500v2 / Wiring',
    defaultBaud: 115200,
    bootDelaySec: 1.8,
    wdtProtection: true,
    eepromSupport: true,
    autobaudSupport: false,
    avrdudeProgrammer: 'wiring / stk500v2',
    recommended: false,
    summary: '64K Words(128KB) 이상의 확장 주소(RAMPZ, EIND)를 처리할 수 있는 v2 프로토콜을 사용하며 ATmega2560 / ATmega128 산업용 표준입니다.',
    pros: [
      '256KB 대용량 플래시 전체 영역 완벽 플래싱 지원',
      '패킷 체크섬 및 양방향 핸드셰이크 프로토콜 안정성 우수',
      'MegaCore 및 Arduino Mega 2560 공식 채택'
    ],
    cons: [
      '4KB의 플래시 메모리 점유',
      'STK500v1 대비 패킷 오버헤드가 약간 큼'
    ]
  },
  {
    id: 'urboot',
    name: 'Urboot (오토보레이트 & 초경량 차세대 부트로더)',
    shortName: 'Urboot',
    tagline: '하드웨어 오토보레이트 동기화 • 단 256~512B',
    badge: '고급 (Auto-Baud)',
    badgeColor: 'text-purple-400',
    badgeBg: 'bg-purple-950/60',
    badgeBorder: 'border-purple-800/50',
    flashSizeBytes: {
      atmega328p: 256, // 256 Bytes!
      atmega128: 512,
      atmega640: 512,
      atmega2560: 512
    },
    protocol: 'STK500v1 (Autobaud)',
    defaultBaud: 115200, // detects any baud
    bootDelaySec: 0.8,
    wdtProtection: true,
    eepromSupport: true,
    autobaudSupport: true,
    avrdudeProgrammer: 'urclock / arduino',
    recommended: false,
    summary: '호스트가 보내는 동기화 바이트의 펄스 폭을 실시간 계측하여 임의의 보레이트(Auto-baud)에 즉각 동기화되며, 최소 256바이트까지 축소 가능합니다.',
    pros: [
      '완전 자동 보레이트 감지 (어떤 클럭 주파수나 시리얼 속도에서도 동작)',
      '단 256~512바이트의 극단적 최소 풋프린트',
      'EEPROM 읽기/쓰기 및 안전 벡터 테이블 탑재',
      '가장 빠른 부팅 딜레이 (0.8초)'
    ],
    cons: [
      'avrdude 7.x 이상 및 urclock 프로그래머 설정 필요'
    ]
  },
  {
    id: 'no_bootloader',
    name: '순수 베어메탈 (No Bootloader / 100% Raw Flash)',
    shortName: '순수 ISP',
    tagline: '부트로더 완전 제거 • 플래시 100% 사용자 전용',
    badge: '하드웨어 양산 최적',
    badgeColor: 'text-rose-400',
    badgeBg: 'bg-rose-950/60',
    badgeBorder: 'border-rose-800/50',
    flashSizeBytes: {
      atmega328p: 0,
      atmega128: 0,
      atmega640: 0,
      atmega2560: 0
    },
    protocol: 'ISP (In-System Programming / SPI / JTAG)',
    defaultBaud: 0,
    bootDelaySec: 0.0,
    wdtProtection: true,
    eepromSupport: true,
    autobaudSupport: false,
    avrdudeProgrammer: 'usbasp / atmelice_isp',
    recommended: false,
    summary: '부트로더를 아예 탑재하지 않고 100% 순수 ISP로만 펌웨어를 굽습니다. 플래시 메모리 낭비가 0바이트이며 부팅 딜레이가 0초입니다.',
    pros: [
      '플래시 메모리 100% 온전히 앱 코드로 사용 (0바이트 손실)',
      '전원 인가 즉시 0.00초 만에 main() 함수 실행 (초고속 부팅)',
      'UART 핀(RXD/TXD)을 부트로더 간섭 없이 순수 I/O로 활용 가능',
      '부트로더 손상으로 인한 벽돌(Brick) 위험 제로'
    ],
    cons: [
      'USB-to-Serial 업로드 불가, 항상 전용 프로그래머(USBasp 등) 필수'
    ]
  }
];

export const BootloaderManager: React.FC<BootloaderManagerProps> = ({
  selectedMCU,
  onSelectMCU
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Active Bootloader Selection
  const [selectedBootloaderId, setSelectedBootloaderId] = useState<BootloaderOptionId>('optiboot');

  // UART Auto-Baudrate Simulator Controls
  const [cpuFreqMhz, setCpuFreqMhz] = useState<number>(16.0); // 16, 8, 12, 20, 11.0592, 14.7456
  const [targetBaud, setTargetBaud] = useState<number>(115200);
  const [useU2xDoubleSpeed, setUseU2xDoubleSpeed] = useState<boolean>(true); // default on AVR bootloaders
  const [simUploadCodeKb, setSimUploadCodeKb] = useState<number>(16.0); // 16KB firmware payload

  // Burn Programmer tool selection
  const [burnerTool, setBurnerTool] = useState<'usbasp' | 'arduino_isp' | 'atmel_ice'>('usbasp');
  const [copiedBurnCmd, setCopiedBurnCmd] = useState<boolean>(false);

  // Active Option Details
  const activeOption = useMemo(() => {
    return BOOTLOADER_OPTIONS.find((b) => b.id === selectedBootloaderId) || BOOTLOADER_OPTIONS[0];
  }, [selectedBootloaderId]);

  // Memory Calculations
  const totalFlashBytes = currentProfile.flash * 1024;
  const bootloaderBytes = activeOption.flashSizeBytes[selectedMCU];
  const userAppBytes = totalFlashBytes - bootloaderBytes;
  const bootloaderPct = +((bootloaderBytes / totalFlashBytes) * 100).toFixed(2);
  const userAppPct = +(100 - bootloaderPct).toFixed(2);

  // Compare with Standard Arduino legacy (2048B on 328p, 4096B on mega)
  const legacyBytes = selectedMCU === 'atmega2560' ? 8192 : selectedMCU === 'atmega128' ? 4096 : 2048;
  const savedBytesVsLegacy = Math.max(0, legacyBytes - bootloaderBytes);

  // UART Baudrate and UBRR Calculations
  const baudCalculations = useMemo(() => {
    // Clock in Hz
    const fCpuHz = cpuFreqMhz * 1e6;
    const divider = useU2xDoubleSpeed ? 8 : 16;

    // Exact UBRR formula: UBRR = (fCpu / (divider * Baud)) - 1
    const ubrrFloat = fCpuHz / (divider * targetBaud) - 1;
    const ubrrInt = Math.max(0, Math.round(ubrrFloat));

    // Actual Baud generated
    const actualBaud = fCpuHz / (divider * (ubrrInt + 1));

    // Error percentage
    const errorPct = +(((actualBaud - targetBaud) / targetBaud) * 100).toFixed(2);
    const absError = Math.abs(errorPct);

    // Status evaluation:
    // <= 1.5% is IDEAL (green)
    // 1.5% ~ 3.5% is MARGINAL (yellow)
    // > 3.5% is CRITICAL FRAMING ERROR (red)
    const isErrorSafe = absError <= 1.5;
    const isErrorMarginal = absError > 1.5 && absError <= 3.5;
    const isErrorCritical = absError > 3.5;

    // Estimated transfer time for upload payload (1 start, 8 data, 1 stop = 10 bits/byte)
    // + 15% protocol overhead (ACK / page handshake)
    const bytesToUpload = simUploadCodeKb * 1024;
    const totalBits = bytesToUpload * 10 * 1.15;
    const uploadDurationSec = targetBaud > 0 ? +(totalBits / actualBaud).toFixed(2) : 0;

    return {
      ubrrInt,
      actualBaud: Math.round(actualBaud),
      errorPct,
      absError,
      isErrorSafe,
      isErrorMarginal,
      isErrorCritical,
      uploadDurationSec
    };
  }, [cpuFreqMhz, targetBaud, useU2xDoubleSpeed, simUploadCodeKb]);

  // Fuses calculation for the selected bootloader & MCU
  const fuseSettings = useMemo(() => {
    // Generate recommended fuses
    if (selectedMCU === 'atmega328p') {
      if (selectedBootloaderId === 'no_bootloader') {
        return { lfuse: '0xFF', hfuse: '0xDF', efuse: '0xFD', lock: '0xFF', note: 'BOOTRST=1 (0x0000 시작), 플래시 100% 개방' };
      } else if (selectedBootloaderId === 'optiboot') {
        return { lfuse: '0xFF', hfuse: '0xDE', efuse: '0xFD', lock: '0x0F', note: 'BOOTSZ=256단어(512B), BOOTRST=0(부트로더 진입)' };
      } else {
        return { lfuse: '0xFF', hfuse: '0xDA', efuse: '0xFD', lock: '0x0F', note: 'BOOTSZ=1024단어(2KB), BOOTRST=0' };
      }
    } else if (selectedMCU === 'atmega128') {
      if (selectedBootloaderId === 'no_bootloader') {
        return { lfuse: '0xFF', hfuse: '0xD9', efuse: '0xFF', lock: '0xFF', note: 'M103C=1(해제), BOOTRST=1' };
      } else {
        return { lfuse: '0xFF', hfuse: '0xCC', efuse: '0xFF', lock: '0x0F', note: 'M103C=1, BOOTSZ=512단어(1KB), BOOTRST=0' };
      }
    } else if (selectedMCU === 'atmega640') {
      if (selectedBootloaderId === 'no_bootloader') {
        return { lfuse: '0xFF', hfuse: '0xD9', efuse: '0xFF', lock: '0xFF', note: 'BOOTRST=1' };
      } else {
        return { lfuse: '0xFF', hfuse: '0xCE', efuse: '0xFD', lock: '0x0F', note: 'BOOTSZ=512단어(1KB), BOOTRST=0' };
      }
    } else {
      // atmega2560
      if (selectedBootloaderId === 'no_bootloader') {
        return { lfuse: '0xFF', hfuse: '0xD9', efuse: '0xFD', lock: '0xFF', note: 'BOOTRST=1 (앱 즉시 진입)' };
      } else {
        return { lfuse: '0xFF', hfuse: '0xD8', efuse: '0xFD', lock: '0x0F', note: 'BOOTSZ=4KB(STK500v2), BOOTRST=0' };
      }
    }
  }, [selectedMCU, selectedBootloaderId]);

  // Generated avrdude command to burn bootloader
  const generatedBurnCmd = useMemo(() => {
    const progPart = burnerTool === 'usbasp' ? '-c usbasp -B 1.5' : burnerTool === 'arduino_isp' ? '-c avrisp -P COM3 -b 19200' : '-c atmelice_isp';
    const mcuPart = selectedMCU === 'atmega2560' ? 'm2560' : selectedMCU === 'atmega640' ? 'm640' : selectedMCU === 'atmega128' ? 'm128' : 'm328p';
    const hexName = selectedBootloaderId === 'no_bootloader' ? '' : ` -U flash:w:${activeOption.shortName.toLowerCase()}_${selectedMCU}.hex:i`;

    return `avrdude -p ${mcuPart} ${progPart} -e -U lfuse:w:${fuseSettings.lfuse}:m -U hfuse:w:${fuseSettings.hfuse}:m -U efuse:w:${fuseSettings.efuse}:m -U lock:w:${fuseSettings.lock}:m${hexName}`;
  }, [selectedMCU, burnerTool, selectedBootloaderId, activeOption, fuseSettings]);

  const handleCopyBurnCmd = () => {
    navigator.clipboard.writeText(generatedBurnCmd);
    setCopiedBurnCmd(true);
    setTimeout(() => setCopiedBurnCmd(false), 2000);
  };

  return (
    <div id="bootloader-manager-card" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur-xl shadow-2xl space-y-7">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                부트로더 매니저 & 오토보레이트 분석기
              </h3>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                Bootloader Manager
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                {currentProfile.name}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Optiboot, 구형 표준 Arduino, STK500v2, Urboot 및 순수 ISP 베어메탈 등 <strong>다양한 부트로더 옵션의 플래시 메모리 점유율(Memory Footprint)</strong>을 비교하고, 클럭 주파수별 <strong>UART 오토보레이트 오차율(Error %)</strong>과 업로드 속도를 정밀 계산합니다.
            </p>
          </div>
        </div>

        {/* Target MCU switcher pills */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-400 font-mono">타깃 MCU:</span>
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcu) => (
              <button
                key={mcu}
                onClick={() => onSelectMCU && onSelectMCU(mcu)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedMCU === mcu
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mcu === 'atmega2560' ? '2560' : mcu === 'atmega640' ? '640' : mcu === 'atmega128' ? '128' : '328P'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bootloader Selection Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-amber-400" />
            1. 부트로더 옵션 선택 및 비교 (Select Bootloader Option)
          </span>
          <span className="text-[11px] text-emerald-400 font-mono bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
            Optiboot 선택 시 최대 1.5KB 플래시 회수
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {BOOTLOADER_OPTIONS.map((opt) => {
            const isSelected = selectedBootloaderId === opt.id;
            const sizeBytes = opt.flashSizeBytes[selectedMCU];
            const sizeKb = sizeBytes / 1024;

            return (
              <button
                key={opt.id}
                onClick={() => setSelectedBootloaderId(opt.id)}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between relative overflow-hidden ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/40 shadow-xl shadow-amber-500/10'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono ${opt.badgeBg} ${opt.badgeColor} ${opt.badgeBorder}`}>
                      {opt.badge}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {opt.protocol.split(' ')[0]}
                    </span>
                  </div>

                  <h4 className={`text-sm font-bold mt-1 ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                    {opt.shortName}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                    {opt.tagline}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 text-[11px]">플래시 점유:</span>
                  <span className={`font-black ${sizeBytes === 0 ? 'text-emerald-400' : sizeBytes <= 512 ? 'text-cyan-400' : 'text-amber-400'}`}>
                    {sizeBytes === 0 ? '0 Bytes (0%)' : `${sizeBytes.toLocaleString()} B (${sizeKb >= 1 ? sizeKb.toFixed(0) : sizeKb.toFixed(1)}KB)`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Memory Footprint Impact Comparison Section */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              2. 메모리 풋프린트(Memory Footprint) 점유 영향 시각화
            </h4>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span>총 플래시: <strong className="text-white">{currentProfile.flash} KB</strong></span>
            <span>•</span>
            <span>부트로더: <strong className="text-amber-400">{bootloaderBytes} B</strong> ({bootloaderPct}%)</span>
            <span>•</span>
            <span>앱 영역: <strong className="text-emerald-400">{(userAppBytes / 1024).toFixed(1)} KB</strong> ({userAppPct}%)</span>
          </div>
        </div>

        {/* Stacked Visual Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>0x0000 (사용자 애플리케이션 시작 번지)</span>
            {savedBytesVsLegacy > 0 && (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                구형 아두이노 부트로더 대비 {savedBytesVsLegacy.toLocaleString()} 바이트(Flash) 회수 완료!
              </span>
            )}
            <span>0x{totalFlashBytes.toString(16).toUpperCase()} (Flash End)</span>
          </div>

          <div className="h-9 w-full bg-slate-900 rounded-xl overflow-hidden p-1 flex gap-1 border border-slate-800">
            {/* User Application Portion */}
            <div
              style={{ width: `${userAppPct}%` }}
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-lg flex items-center justify-center overflow-hidden transition-all duration-500 relative group"
              title={`사용자 앱 펌웨어 공간: ${userAppBytes.toLocaleString()} Bytes (${userAppPct}%)`}
            >
              <span className="text-[11px] font-bold text-slate-950 font-mono truncate px-2">
                사용자 애플리케이션 가용 공간: {(userAppBytes / 1024).toFixed(1)} KB ({userAppPct}%)
              </span>
            </div>

            {/* Bootloader Portion */}
            {bootloaderBytes > 0 && (
              <div
                style={{ width: `${Math.max(3, bootloaderPct)}%` }}
                className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg flex items-center justify-center overflow-hidden transition-all duration-500 relative group"
                title={`부트로더 공간: ${bootloaderBytes.toLocaleString()} Bytes (${bootloaderPct}%)`}
              >
                <span className="text-[10px] font-bold text-slate-950 font-mono truncate px-1">
                  BLS ({bootloaderBytes}B)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono block">부트로더 플래시 점유</span>
            <span className="text-base font-black font-mono text-amber-400">{bootloaderBytes.toLocaleString()} Bytes</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">전체 용량의 {bootloaderPct}% 소모</span>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono block">부팅 지연 시간 (Boot Delay)</span>
            <span className="text-base font-black font-mono text-cyan-400">{activeOption.bootDelaySec} 초 (sec)</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">전원 투입 후 앱 실행까지</span>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono block">Watchdog 타이머 보호</span>
            <span className={`text-base font-black font-mono ${activeOption.wdtProtection ? 'text-emerald-400' : 'text-rose-400'}`}>
              {activeOption.wdtProtection ? '안전 (Safe)' : '루프 결함 위험!'}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {activeOption.wdtProtection ? 'WDT 리셋 후 정상 부팅' : 'WDT 발생 시 무한 재부팅'}
            </span>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono block">avrdude 프로그래머 플래그</span>
            <span className="text-base font-black font-mono text-purple-400 truncate block">
              -c {activeOption.avrdudeProgrammer.split(' ')[0]}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">{activeOption.protocol}</span>
          </div>
        </div>
      </div>

      {/* UART Auto-Baudrate & Timing Calculation Sandbox */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              3. UART 오토보레이트 & 업로드 오차율 계산기 (Auto-Baudrate Calculator)
            </h4>
          </div>

          <span className="text-[11px] text-slate-400 font-mono">
            클럭 주파수별 UBRR 레지스터 & 통신 오차율 정밀 계산
          </span>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* CPU Clock */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1.5">
            <span className="text-slate-300 font-semibold block">MCU 발진 클럭 (fCPU):</span>
            <select
              value={cpuFreqMhz}
              onChange={(e) => setCpuFreqMhz(parseFloat(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-white font-mono text-xs"
            >
              <option value={16.0}>16.0 MHz (아두이노 Uno/Mega 표준)</option>
              <option value={8.0}>8.0 MHz (내부 RC 발진기 / 3.3V Pro Mini)</option>
              <option value={12.0}>12.0 MHz (V-USB 전용 크리스털)</option>
              <option value={20.0}>20.0 MHz (최대 오버클럭)</option>
              <option value={11.0592}>11.0592 MHz (UART 0% 오차 크리스털)</option>
              <option value={14.7456}>14.7456 MHz (UART 고속 통신 크리스털)</option>
            </select>
            <span className="text-[10px] text-slate-500 font-mono block">1주기 = {(1000 / cpuFreqMhz).toFixed(1)} ns</span>
          </div>

          {/* Target Baudrate */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1.5">
            <span className="text-slate-300 font-semibold block">목표 전송 속도 (Baud Rate):</span>
            <select
              value={targetBaud}
              onChange={(e) => setTargetBaud(parseInt(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-white font-mono text-xs"
            >
              <option value={115200}>115,200 bps (Optiboot 디폴트)</option>
              <option value={57600}>57,600 bps (구형 아두이노)</option>
              <option value={38400}>38,400 bps</option>
              <option value={19200}>19,200 bps</option>
              <option value={9600}>9,600 bps</option>
              <option value={230400}>230,400 bps (고속 커스텀)</option>
              <option value={500000}>500,000 bps (초고속)</option>
              <option value={1000000}>1,000,000 bps (1 Mbps)</option>
            </select>
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 pt-0.5">
              <input
                type="checkbox"
                checked={useU2xDoubleSpeed}
                onChange={(e) => setUseU2xDoubleSpeed(e.target.checked)}
                className="accent-amber-500 rounded"
              />
              <span>U2X 2배속 모드 (분주비 8배)</span>
            </label>
          </div>

          {/* Firmware Payload Size */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1.5">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold">업로드 바이너리 크기:</span>
              <span className="text-cyan-400 font-bold">{simUploadCodeKb.toFixed(0)} KB</span>
            </div>
            <input
              type="range"
              min={2}
              max={currentProfile.flash}
              step={2}
              value={simUploadCodeKb}
              onChange={(e) => setSimUploadCodeKb(parseInt(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 font-mono block">플래시 라이팅 대상 용량</span>
          </div>

          {/* Real-time Calculation Result */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1 font-mono text-xs flex flex-col justify-between">
            <span className="text-slate-400 text-[10px]">계산 결과:</span>
            <div className="flex justify-between">
              <span className="text-slate-300">UBRR 레지스터:</span>
              <span className="font-bold text-white">{baudCalculations.ubrrInt} (0x{baudCalculations.ubrrInt.toString(16).toUpperCase()})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">실제 생성 속도:</span>
              <span className="font-bold text-slate-200">{baudCalculations.actualBaud.toLocaleString()} bps</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">보레이트 오차율:</span>
              <span className={`font-black ${baudCalculations.isErrorSafe ? 'text-emerald-400' : baudCalculations.isErrorMarginal ? 'text-amber-400' : 'text-rose-400 animate-pulse'}`}>
                {baudCalculations.errorPct > 0 ? `+${baudCalculations.errorPct}` : baudCalculations.errorPct}%
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-1">
              <span className="text-slate-300">예상 업로드 시간:</span>
              <span className="font-bold text-cyan-300">{baudCalculations.uploadDurationSec} 초</span>
            </div>
          </div>
        </div>

        {/* Warning Callout if Error > 2% */}
        {baudCalculations.isErrorCritical && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500 text-xs text-rose-300 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              <span>치명적 타이밍 오차 경고: 보레이트 오차가 허용 한계(±2.5%)를 초과했습니다!</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              현재 {cpuFreqMhz}MHz 클럭에서 {targetBaud}bps를 생성할 때 오차가 <strong>{baudCalculations.errorPct}%</strong>에 달합니다. avrdude 시리얼 업로드 시 프레이밍 에러(Framing Error)가 발생하여 <code>stk500_recv(): programmer is not responding</code> 오류가 유발됩니다. <strong>U2X 모드를 켜거나 보레이트를 57600bps로 변경</strong>하세요.
            </p>
          </div>
        )}
      </div>

      {/* Bootloader Burning Command & Fuses Configuration */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              4. 부트로더 굽기(Burn Bootloader) 및 퓨즈비트 설정 명령어
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">프로그래머:</span>
            <select
              value={burnerTool}
              onChange={(e) => setBurnerTool(e.target.value as any)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs"
            >
              <option value="usbasp">USBasp (ISP 6-Pin / 10-Pin)</option>
              <option value="arduino_isp">Arduino as ISP (COM3 / 19200bps)</option>
              <option value="atmel_ice">Atmel-ICE (하드웨어 디버거)</option>
            </select>

            <button
              onClick={handleCopyBurnCmd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold transition shadow-md shadow-emerald-600/20"
            >
              {copiedBurnCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedBurnCmd ? '명령어 복사됨!' : 'avrdude 명령어 복사'}</span>
            </button>
          </div>
        </div>

        {/* Fuses breakdown pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Low Fuse (lfuse):</span>
            <span className="font-bold text-white text-sm">{fuseSettings.lfuse}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">외부 크리스털 16MHz</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">High Fuse (hfuse):</span>
            <span className="font-bold text-amber-400 text-sm">{fuseSettings.hfuse}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">SPIEN=0, BOOTSZ/BOOTRST</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Extended Fuse (efuse):</span>
            <span className="font-bold text-sky-400 text-sm">{fuseSettings.efuse}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">BOD 레벨 감지 (2.7V)</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Lock Bits (lock):</span>
            <span className="font-bold text-purple-400 text-sm">{fuseSettings.lock}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">BLB1/BLB0 섹션 보호</span>
          </div>
        </div>

        {/* Live Terminal Command Block */}
        <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
          <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>터미널 실행 명령어 (PowerShell / Bash / CMD)</span>
            <span className="text-emerald-400 font-bold">Ready to Flash</span>
          </div>
          <pre className="p-4 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
            {generatedBurnCmd}
          </pre>
        </div>
      </div>
    </div>
  );
};
