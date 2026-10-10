import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell
} from 'recharts';
import {
  Layers,
  Cpu,
  Database,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Info,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ArrowRight,
  Maximize2,
  FileCode,
  Zap,
  HelpCircle
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

export interface MemoryMapVisualizerProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export interface MemorySegment {
  id: string;
  name: string;
  nameKo: string;
  category: 'vector' | 'app' | 'boot' | 'reserved' | 'register' | 'io' | 'ext_io' | 'sram' | 'stack' | 'heap' | 'xmem' | 'eeprom_user' | 'eeprom_log' | 'eeprom_sys';
  startAddr: number; // in bytes
  endAddr: number;   // in bytes
  sizeBytes: number;
  color: string;
  isReserved: boolean;
  accessMode: string;
  linkerSection: string;
  description: string;
  keyRegisters?: string;
  hardwareNotes: string;
}

export interface MemorySpaceData {
  space: 'Flash' | 'SRAM' | 'EEPROM';
  title: string;
  totalBytes: number;
  segments: MemorySegment[];
}

export const MemoryMapVisualizer: React.FC<MemoryMapVisualizerProps> = ({
  selectedMCU,
  onSelectMCU
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Visualizer view states
  const [activeView, setActiveView] = useState<'all' | 'flash' | 'sram' | 'eeprom'>('all');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [addressFormat, setAddressFormat] = useState<'hex' | 'dec' | 'word'>('hex');
  const [copiedLinker, setCopiedLinker] = useState(false);

  // Interactive dynamic simulator values
  const [bootloaderSizeKB, setBootloaderSizeKB] = useState<number>(() => {
    if (selectedMCU === 'atmega328p') return 0.5; // 512B Optiboot
    return 4.0; // 4KB for mega128/640 default
  });
  const [simulatedCodeKB, setSimulatedCodeKB] = useState<number>(() => {
    if (selectedMCU === 'atmega328p') return 18.5;
    if (selectedMCU === 'atmega128') return 48.0;
    return 32.0;
  });
  const [simulatedStaticDataBytes, setSimulatedStaticDataBytes] = useState<number>(() => {
    if (selectedMCU === 'atmega328p') return 480;
    if (selectedMCU === 'atmega128') return 900;
    return 1600;
  });
  const [simulatedHeapBytes, setSimulatedHeapBytes] = useState<number>(256);
  const [simulatedStackBytes, setSimulatedStackBytes] = useState<number>(384);
  const [enableXmem, setEnableXmem] = useState<boolean>(false);

  // Helper formatting function
  const formatAddr = (addr: number, isWordAddressable = false): string => {
    if (addressFormat === 'dec') return `${addr.toLocaleString()} B`;
    if (addressFormat === 'word' && isWordAddressable) {
      const wordAddr = Math.floor(addr / 2);
      return `0x${wordAddr.toString(16).toUpperCase().padStart(4, '0')} (Word)`;
    }
    return `0x${addr.toString(16).toUpperCase().padStart(4, '0')}`;
  };

  const formatSize = (bytes: number): string => {
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(bytes % 1024 === 0 ? 0 : 2)} KB (${bytes.toLocaleString()} B)`;
    }
    return `${bytes.toLocaleString()} Bytes`;
  };

  // Build architectural memory segment models per MCU
  const memorySpaces = useMemo<Record<'flash' | 'sram' | 'eeprom', MemorySpaceData>>(() => {
    const flashTotalBytes = currentProfile.flash * 1024;
    const sramTotalBytes = currentProfile.sram * 1024;
    const eepromTotalBytes = currentProfile.eeprom * 1024;

    // 1. FLASH MEMORY MODEL
    let ivtVectors = 26;
    let ivtSizeBytes = 104; // 26 * 4 bytes
    if (selectedMCU === 'atmega128') {
      ivtVectors = 35;
      ivtSizeBytes = 140; // 35 * 4 bytes
    } else if (selectedMCU === 'atmega640') {
      ivtVectors = 57;
      ivtSizeBytes = 228; // 57 * 4 bytes
    }

    const bootBytes = Math.round(bootloaderSizeKB * 1024);
    const bootStartAddr = flashTotalBytes - bootBytes;
    const appEndAddr = bootStartAddr - 1;
    const appSizeBytes = appEndAddr - ivtSizeBytes + 1;

    // Reserved flash section (page alignment / High Lock bits boundary)
    const flashSegments: MemorySegment[] = [
      {
        id: 'flash_ivt',
        name: 'Interrupt Vector Table (IVT)',
        nameKo: '인터럽트 벡터 테이블',
        category: 'vector',
        startAddr: 0x0000,
        endAddr: ivtSizeBytes - 1,
        sizeBytes: ivtSizeBytes,
        color: '#6366f1', // Indigo
        isReserved: false,
        accessMode: 'CPU Hardware Jump / JMP / RJMP (2~3 clk)',
        linkerSection: '.vectors',
        description: `하드웨어 리셋 및 ${ivtVectors}개 인터럽트 서비스 루틴의 진입점 점프 테이블`,
        keyRegisters: 'MCUCR (IVSEL 비트로 부트로더 시작 번지로 재배치 가능)',
        hardwareNotes: 'IVSEL=1 설정 시 이 벡터 테이블 전체가 부트로더 시작 주소로 오프셋 이동됩니다.'
      },
      {
        id: 'flash_app',
        name: 'Application Flash Section (RWW)',
        nameKo: '사용자 펌웨어 프로그램 영역',
        category: 'app',
        startAddr: ivtSizeBytes,
        endAddr: appEndAddr,
        sizeBytes: appSizeBytes,
        color: '#3b82f6', // Blue
        isReserved: false,
        accessMode: 'PC Fetch (1 clk), LPM (3 clk)',
        linkerSection: '.text, .progmem, .rodata',
        description: '컴파일된 C/C++ 실행 코드, 상수 테이블 및 PROGMEM 문자열/폰트 데이터 저장 영역 (Read-While-Write 구역)',
        hardwareNotes: '부트로더가 이 구역을 SPM 명령어로 셀프 프로그래밍하는 동안 CPU가 부트로더 코드를 정상 실행할 수 있습니다.'
      },
      {
        id: 'flash_boot',
        name: 'Boot Loader Section (NRWW)',
        nameKo: '하드웨어 부트로더 구역',
        category: 'boot',
        startAddr: bootStartAddr,
        endAddr: flashTotalBytes - 1,
        sizeBytes: bootBytes,
        color: '#f59e0b', // Amber
        isReserved: false,
        accessMode: 'SPM (Self-Programming 4 clk), LPM (3 clk)',
        linkerSection: '.bootloader',
        description: 'UART, CAN, USB를 통한 펌웨어 업데이트를 수행하는 비휘발성 In-System Bootloader 구역 (Non-Read-While-Write)',
        keyRegisters: 'SPMCSR, BOOTRST Fuse, BOOTSZ[1:0] Fuses',
        hardwareNotes: 'BOOTRST 퓨즈가 활성화되면 MCU 리셋 직후 0x0000이 아닌 이 부트로더 시작 주소로 분기합니다.'
      }
    ];

    // 2. DATA MEMORY (SRAM & I/O & RESERVED BUS)
    const gpRegsSize = 32;       // 0x0000 - 0x001F
    const stdIoSize = 64;        // 0x0020 - 0x005F
    const extIoSize = selectedMCU === 'atmega640' ? 416 : 160; // mega640: 0x0060-0x01FF (416B), mega128/328: 0x0060-0x00FF (160B)
    const sramStartAddr = gpRegsSize + stdIoSize + extIoSize;
    const sramEndAddr = sramStartAddr + sramTotalBytes - 1;

    const dataSegments: MemorySegment[] = [
      {
        id: 'sram_gpr',
        name: 'General Purpose Registers (R0 ~ R31)',
        nameKo: '범용 작업 레지스터 파일 (32개)',
        category: 'register',
        startAddr: 0x0000,
        endAddr: 0x001F,
        sizeBytes: 32,
        color: '#8b5cf6', // Violet
        isReserved: false,
        accessMode: '단일 클럭 ALU 직접 접근 (1 clk), LDS/STS (2 clk)',
        linkerSection: 'Hardware Register Map',
        description: '32개의 8비트 고속 CPU 레지스터. R26~R31은 16비트 X, Y, Z 주소 포인터로 작동',
        hardwareNotes: 'ALU와 1사이클 내 직접 상호작용하므로 모든 산술/논리/비트 연산의 기본 단위입니다.'
      },
      {
        id: 'sram_stdio',
        name: 'Standard I/O Registers (64 Regs)',
        nameKo: '표준 I/O 제어 레지스터 (64개)',
        category: 'io',
        startAddr: 0x0020,
        endAddr: 0x005F,
        sizeBytes: 64,
        color: '#06b6d4', // Cyan
        isReserved: false,
        accessMode: 'IN / OUT (1 clk), CBI / SBI (1~2 clk)',
        linkerSection: 'Hardware I/O Space (I/O 0x00 ~ 0x3F)',
        description: 'PORT, DDR, PIN, 타이머, SREG 등 초고속 단일 사이클 I/O 명령어로 제어 가능한 주변장치 레지스터',
        keyRegisters: 'SREG, SPL, SPH, PORTx, DDRx, TCCRx',
        hardwareNotes: 'I/O 주소(0x00~0x3F)와 메모리 매핑 주소(0x0020~0x005F) 간 0x20 오프셋이 존재합니다.'
      },
      {
        id: 'sram_extio',
        name: `Extended I/O Registers (${extIoSize} Regs)`,
        nameKo: `확장 I/O 레지스터 (${extIoSize}개)`,
        category: 'ext_io',
        startAddr: 0x0060,
        endAddr: 0x005F + extIoSize,
        sizeBytes: extIoSize,
        color: '#0ea5e9', // Sky blue
        isReserved: false,
        accessMode: 'LDS / STS (2 clk), LDD / STD (2 clk)',
        linkerSection: 'Hardware Extended I/O Space',
        description: selectedMCU === 'atmega640'
          ? '4채널 USART, 6개 타이머, 16채널 ADC 제어를 위한 416바이트 대형 확장 레지스터 블록'
          : '확장 USART, 타이머 제어 등 추가 페리페럴 제어를 위한 160바이트 레지스터 블록',
        keyRegisters: 'UCSRnA/B/C, UBRRn, ADMUX, ADCSRA, TIMSKx',
        hardwareNotes: 'IN/OUT 명령어로는 접근할 수 없으며 일반 SRAM 메모리 명령어(LDS/STS)를 통해서만 제어됩니다.'
      },
      {
        id: 'sram_internal',
        name: `Internal SRAM (${currentProfile.sram} KB)`,
        nameKo: `내부 고속 SRAM (${currentProfile.sram} KB)`,
        category: 'sram',
        startAddr: sramStartAddr,
        endAddr: sramEndAddr,
        sizeBytes: sramTotalBytes,
        color: '#10b981', // Emerald
        isReserved: false,
        accessMode: 'LD / ST / PUSH / POP (2 clk)',
        linkerSection: '.data, .bss, .noinit, Heap, Stack',
        description: `초기화된 전역변수(.data), 미초기화 변수(.bss), malloc 힙(Heap), 함수 호출 및 ISR 스택(Stack) 저장 구역`,
        keyRegisters: 'SP (Stack Pointer: SPL/SPH)',
        hardwareNotes: `스택은 최상위 주소(RAMEND = ${formatAddr(sramEndAddr)})에서 하향(Downwards) 성장하며, 힙은 상향(Upwards) 성장합니다.`
      }
    ];

    // External Memory or Reserved Space
    if (selectedMCU === 'atmega128' || selectedMCU === 'atmega640') {
      const xmemStart = sramEndAddr + 1;
      const xmemEnd = 0xFFFF;
      const xmemSize = xmemEnd - xmemStart + 1;
      dataSegments.push({
        id: 'sram_xmem_or_reserved',
        name: enableXmem ? `External SRAM Interface (XMEM: ${Math.round(xmemSize / 1024)} KB)` : `Reserved / Unmapped Data Address Space (${Math.round(xmemSize / 1024)} KB)`,
        nameKo: enableXmem ? '외부 SRAM 확장 영역 (Port A/C 버스 활성화)' : '예약된 미매핑 주소 공간 (Reserved)',
        category: enableXmem ? 'xmem' : 'reserved',
        startAddr: xmemStart,
        endAddr: xmemEnd,
        sizeBytes: xmemSize,
        color: enableXmem ? '#a855f7' : '#475569', // Purple if active, Slate if reserved
        isReserved: !enableXmem,
        accessMode: enableXmem ? 'LDS / STS (XMEM 대기 사이클 1~3 Wait-states)' : '접근 불가 / 버스 플로팅 (0xFF 반환 또는 데이터 오염)',
        linkerSection: enableXmem ? '.ext_sram' : 'Reserved (DO NOT USE)',
        description: enableXmem
          ? 'Port A (AD0~AD7 멀티플렉스)와 Port C (A8~A15), Port G (WR, RD, ALE)를 통해 연결된 외부 SRAM 칩 주소 공간'
          : 'XMEM 비활성화 시 물리적으로 매핑되지 않은 예약 영역. 이 구역에 읽기/쓰기를 시도하면 버스 미정의 값(0xFF)이 반환됩니다.',
        keyRegisters: 'MCUCR (SRE 비트로 외부 버스 활성화), XMCRB',
        hardwareNotes: enableXmem
          ? '외부 SRAM 사용 시 Port A, Port C, Port G 제어핀이 GPIO로 동작하지 않고 메모리 버스 전용으로 고정됩니다.'
          : 'AVR 아키텍처는 데이터 버스가 16비트 주소선(최대 64KB)을 사용하므로 내부 SRAM 끝 주소부터 0xFFFF까지는 예약 공간으로 남습니다.'
      });
    } else {
      // ATmega328P: RAMEND=0x08FF, Reserved from 0x0900 to 0xFFFF (63,232 bytes)
      const resStart = sramEndAddr + 1;
      const resEnd = 0xFFFF;
      const resSize = resEnd - resStart + 1;
      dataSegments.push({
        id: 'sram_atmega328p_reserved',
        name: `Reserved / Unmapped Memory Space (${(resSize / 1024).toFixed(1)} KB)`,
        nameKo: '예약된 미매핑 주소 공간 (Reserved Area)',
        category: 'reserved',
        startAddr: resStart,
        endAddr: resEnd,
        sizeBytes: resSize,
        color: '#475569', // Dark Slate
        isReserved: true,
        accessMode: '접근 금지 / 하드웨어 미매핑 (Undefined Read 0xFF)',
        linkerSection: 'Reserved (No Hardware Decoded)',
        description: 'ATmega328P는 외부 메모리 인터페이스(XMEM) 핀이 없으므로 RAMEND(0x08FF) 초과 주소는 전체 예약 및 미할당 공간입니다.',
        hardwareNotes: '잘못된 와일드 포인터(Wild Pointer)나 오버플로된 스택이 이 구역을 참조하면 하드웨어 크래시가 발생할 수 있습니다.'
      });
    }

    // 3. EEPROM MEMORY MODEL
    const sysHeaderSize = selectedMCU === 'atmega328p' ? 32 : 64;
    const reservedGuardSize = selectedMCU === 'atmega328p' ? 32 : 128;
    const logSize = selectedMCU === 'atmega328p' ? 96 : 896;
    const userAppSize = eepromTotalBytes - sysHeaderSize - reservedGuardSize - logSize;

    const eepromSegments: MemorySegment[] = [
      {
        id: 'eeprom_header',
        name: 'System Calibration & Config Header',
        nameKo: '시스템 교정치 및 하드웨어 헤더 구역',
        category: 'eeprom_sys',
        startAddr: 0x0000,
        endAddr: sysHeaderSize - 1,
        sizeBytes: sysHeaderSize,
        color: '#eab308', // Yellow
        isReserved: false,
        accessMode: 'EECR / EEDR / EEAR 레지스터 (3.4ms Write Cycle)',
        linkerSection: '.eeprom (OS Header)',
        description: '오실레이터 교정 바이트, MAC/시리얼 고유 ID, 보드 리비전 메타데이터 저장 구역',
        keyRegisters: 'EEARH:EEARL, EEDR, EECR (EERE, EEPE, EEMPE)',
        hardwareNotes: '전원 투입 직후 리셋 루틴에서만 읽고, 빈번한 쓰기를 방지하여 100,000회 쓰기 내구성을 보호합니다.'
      },
      {
        id: 'eeprom_user',
        name: 'Application Non-Volatile Storage',
        nameKo: '사용자 런타임 영구 설정 공간',
        category: 'eeprom_user',
        startAddr: sysHeaderSize,
        endAddr: sysHeaderSize + userAppSize - 1,
        sizeBytes: userAppSize,
        color: '#f97316', // Orange
        isReserved: false,
        accessMode: 'eeprom_read_byte / eeprom_write_byte',
        linkerSection: '.eeprom (User App)',
        description: '통신 보드레이트, 센서 0점 오프셋, PID 계수, 사용자 패스워드 등 영구 보존 데이터 구역',
        keyRegisters: 'EECR, EEDR',
        hardwareNotes: '쓰기 시 약 3.4ms 동안 CPU 인터럽트 및 페리페럴 동작과 조율이 필요합니다.'
      },
      {
        id: 'eeprom_log',
        name: 'Ring-Buffer Crash/Event Log Area',
        nameKo: '이벤트 및 크래시 순환 로그 버퍼',
        category: 'eeprom_log',
        startAddr: sysHeaderSize + userAppSize,
        endAddr: eepromTotalBytes - reservedGuardSize - 1,
        sizeBytes: logSize,
        color: '#d97706', // Dark Amber
        isReserved: false,
        accessMode: 'Wear-leveling Round Robin Write',
        linkerSection: '.eeprom (Crash Log)',
        description: '와치독 리셋 오류 코드, 정전 감지 시점의 마지막 시스템 상태를 링 버퍼 방식으로 순환 보존',
        hardwareNotes: '단일 셀 쓰기 수명(10만 회) 소진을 방지하기 위해 소프트웨어 웨어 레벨링(Wear Leveling) 알고리즘 적용 구역입니다.'
      },
      {
        id: 'eeprom_reserved',
        name: 'Reserved Wear Guard & Alignment Margin',
        nameKo: '예약된 하이 엔드 가드 영역 (Reserved Guard)',
        category: 'reserved',
        startAddr: eepromTotalBytes - reservedGuardSize,
        endAddr: eepromTotalBytes - 1,
        sizeBytes: reservedGuardSize,
        color: '#64748b', // Slate
        isReserved: true,
        accessMode: '예약됨 (Reserved)',
        linkerSection: 'Reserved Guard Margin',
        description: 'EEPROM 주소 오버런(Overrun) 방지 가드 밴드 및 퓨즈 EESAVE 보호 테스트를 위한 예약 공간',
        hardwareNotes: 'EESAVE 퓨즈가 0(Programmed)으로 설정되어 있지 않으면 칩 이레이즈(Chip Erase) 시 EEPROM 전체가 0xFF로 초기화됩니다.'
      }
    ];

    return {
      flash: {
        space: 'Flash',
        title: `Flash ROM (${currentProfile.flash} KB)`,
        totalBytes: flashTotalBytes,
        segments: flashSegments
      },
      sram: {
        space: 'SRAM',
        title: `Data Memory (${selectedMCU === 'atmega328p' ? '2 KB' : selectedMCU === 'atmega128' ? '4 KB' : '8 KB'} SRAM + Registers)`,
        totalBytes: selectedMCU === 'atmega328p' ? 0x10000 : 0x10000, // 64KB Total Data Address Space
        segments: dataSegments
      },
      eeprom: {
        space: 'EEPROM',
        title: `EEPROM (${currentProfile.eeprom} KB)`,
        totalBytes: eepromTotalBytes,
        segments: eepromSegments
      }
    };
  }, [selectedMCU, bootloaderSizeKB, enableXmem]);

  // Active Segment Details
  const activeSegment = useMemo(() => {
    if (!selectedSegmentId) return null;
    const all = [
      ...memorySpaces.flash.segments,
      ...memorySpaces.sram.segments,
      ...memorySpaces.eeprom.segments
    ];
    return all.find((s) => s.id === selectedSegmentId) || null;
  }, [selectedSegmentId, memorySpaces]);

  // SRAM Dynamic collision calculations
  const sramCalculations = useMemo(() => {
    const sramCapacityBytes = currentProfile.sram * 1024;
    const staticTotal = simulatedStaticDataBytes;
    const heapTotal = simulatedHeapBytes;
    const stackTotal = simulatedStackBytes;
    const usedBytes = staticTotal + heapTotal + stackTotal;
    const freeBytes = sramCapacityBytes - usedBytes;
    const isCollision = freeBytes < 0;
    const isWarning = freeBytes >= 0 && freeBytes < sramCapacityBytes * 0.15;

    return {
      sramCapacityBytes,
      staticTotal,
      heapTotal,
      stackTotal,
      usedBytes,
      freeBytes,
      isCollision,
      isWarning,
      usagePercent: Math.min(100, Math.round((usedBytes / sramCapacityBytes) * 100))
    };
  }, [currentProfile.sram, simulatedStaticDataBytes, simulatedHeapBytes, simulatedStackBytes]);

  // Build Recharts Data for Stacked Bar Charts
  const overviewChartData = useMemo(() => {
    // 1. Flash breakdown normalized percentage
    const flashTotal = memorySpaces.flash.totalBytes;
    const flashIVTPct = Number(((memorySpaces.flash.segments[0].sizeBytes / flashTotal) * 100).toFixed(2));
    const flashBootPct = Number(((memorySpaces.flash.segments[2].sizeBytes / flashTotal) * 100).toFixed(2));
    const flashAppPct = Number((100 - flashIVTPct - flashBootPct).toFixed(2));

    // 2. Data Space Breakdown (Out of total 64KB Address Space)
    const dataSpaceTotal = 65536; // 64KB AVR data address space
    const gprPct = Number(((32 / dataSpaceTotal) * 100).toFixed(2));
    const stdIoPct = Number(((64 / dataSpaceTotal) * 100).toFixed(2));
    const extIoSize = selectedMCU === 'atmega640' ? 416 : 160;
    const extIoPct = Number(((extIoSize / dataSpaceTotal) * 100).toFixed(2));
    const sramSize = currentProfile.sram * 1024;
    const sramPct = Number(((sramSize / dataSpaceTotal) * 100).toFixed(2));
    const reservedDataPct = Number((100 - gprPct - stdIoPct - extIoPct - sramPct).toFixed(2));

    // 3. EEPROM breakdown
    const eepromTotal = memorySpaces.eeprom.totalBytes;
    const eepromSegs = memorySpaces.eeprom.segments;
    const eepromSysPct = Number(((eepromSegs[0].sizeBytes / eepromTotal) * 100).toFixed(2));
    const eepromUserPct = Number(((eepromSegs[1].sizeBytes / eepromTotal) * 100).toFixed(2));
    const eepromLogPct = Number(((eepromSegs[2].sizeBytes / eepromTotal) * 100).toFixed(2));
    const eepromResPct = Number(((eepromSegs[3].sizeBytes / eepromTotal) * 100).toFixed(2));

    return [
      {
        space: 'Flash ROM',
        displayLabel: `Flash (${currentProfile.flash}KB)`,
        totalKB: currentProfile.flash,
        ivt: flashIVTPct,
        app: flashAppPct,
        boot: flashBootPct,
        reserved: 0
      },
      {
        space: 'Data Memory',
        displayLabel: `Data (64KB Space)`,
        totalKB: 64,
        gpr: gprPct,
        stdio: stdIoPct,
        extio: extIoPct,
        sram: sramPct,
        reservedData: reservedDataPct
      },
      {
        space: 'EEPROM',
        displayLabel: `EEPROM (${currentProfile.eeprom}KB)`,
        totalKB: currentProfile.eeprom,
        sys: eepromSysPct,
        user: eepromUserPct,
        log: eepromLogPct,
        eepromRes: eepromResPct
      }
    ];
  }, [memorySpaces, selectedMCU, currentProfile]);

  // Copy Linker Script Memory config snippet
  const handleCopyLinker = () => {
    const flashBootStart = (memorySpaces.flash.totalBytes - Math.round(bootloaderSizeKB * 1024)).toString(16).toUpperCase();
    const snippet = `/* AVR GCC Linker Memory Configuration for ${currentProfile.name} */
MEMORY
{
  text   (rx)   : ORIGIN = 0x00000000, LENGTH = 0x${memorySpaces.flash.totalBytes.toString(16).toUpperCase()}
  boot   (rx)   : ORIGIN = 0x0000${flashBootStart}, LENGTH = 0x${Math.round(bootloaderSizeKB * 1024).toString(16).toUpperCase()}
  data   (rw!x) : ORIGIN = 0x00800060, LENGTH = 0x${(currentProfile.sram * 1024).toString(16).toUpperCase()}
  eeprom (rw!x) : ORIGIN = 0x00810000, LENGTH = 0x${memorySpaces.eeprom.totalBytes.toString(16).toUpperCase()}
}

/* avr-gcc compile flag example: */
-Wl,--section-start=.bootloader=0x${flashBootStart}
-Wl,--defsym=__stack=0x${(memorySpaces.sram.segments[3].endAddr).toString(16).toUpperCase()}
`;
    navigator.clipboard.writeText(snippet);
    setCopiedLinker(true);
    setTimeout(() => setCopiedLinker(false), 2200);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur shadow-xl space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  메모리 맵 시각화 도구 (Memory Map Visualizer)
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                  Stacked Bar Architecture
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                선택된 <strong className="text-amber-300">{currentProfile.name}</strong>의 하버드 구조 3대 독립 메모리 공간(Flash, Data/SRAM, EEPROM)과 예약 영역(Reserved)의 주소 배치도를 스택 바 차트로 정밀 분석합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Format Switch */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Target MCU switcher pills */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {(['atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcu) => (
              <button
                key={mcu}
                onClick={() => onSelectMCU && onSelectMCU(mcu)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedMCU === mcu
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mcu === 'atmega640' ? 'mega640' : mcu === 'atmega128' ? 'mega128' : 'mega328P'}
              </button>
            ))}
          </div>

          {/* Address format toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <span className="text-[10px] text-slate-400 px-2 font-mono">표기:</span>
            <button
              onClick={() => setAddressFormat('hex')}
              className={`px-2 py-1 rounded text-[11px] font-mono ${
                addressFormat === 'hex' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              16진수 (HEX)
            </button>
            <button
              onClick={() => setAddressFormat('dec')}
              className={`px-2 py-1 rounded text-[11px] font-mono ${
                addressFormat === 'dec' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              10진수 (Bytes)
            </button>
            <button
              onClick={() => setAddressFormat('word')}
              className={`px-2 py-1 rounded text-[11px] font-mono ${
                addressFormat === 'word' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Word (16-bit)
            </button>
          </div>

          <button
            onClick={handleCopyLinker}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-all shadow-sm"
          >
            {copiedLinker ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileCode className="w-3.5 h-3.5 text-amber-400" />}
            {copiedLinker ? '링커 복사됨!' : '링커 스크립트'}
          </button>
        </div>
      </div>

      {/* Main View Mode Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => { setActiveView('all'); setSelectedSegmentId(null); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeView === 'all'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            3대 독립 메모리 공간 종합 비교 (Stacked Bar)
          </button>

          <button
            onClick={() => { setActiveView('flash'); setSelectedSegmentId('flash_app'); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeView === 'flash'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Flash ROM 공간 ({currentProfile.flash} KB)
          </button>

          <button
            onClick={() => { setActiveView('sram'); setSelectedSegmentId('sram_internal'); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeView === 'sram'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            SRAM / 데이터 주소 공간 (64KB 버스)
          </button>

          <button
            onClick={() => { setActiveView('eeprom'); setSelectedSegmentId('eeprom_user'); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeView === 'eeprom'
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            EEPROM 비휘발성 저장 공간 ({currentProfile.eeprom} KB)
          </button>
        </div>

        {/* Quick metrics summary badge */}
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 px-2">
          <span>Flash: <strong className="text-blue-400">{currentProfile.flash}KB</strong></span>
          <span className="text-slate-600">•</span>
          <span>SRAM: <strong className="text-emerald-400">{currentProfile.sram}KB</strong></span>
          <span className="text-slate-600">•</span>
          <span>EEPROM: <strong className="text-orange-400">{currentProfile.eeprom}KB</strong></span>
        </div>
      </div>

      {/* VIEW 1: All Memory Spaces Overview Stacked Bar Visualizer */}
      {activeView === 'all' && (
        <div className="space-y-6">
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                  전체 주소 공간 레이아웃 스택 바 차트 (Address Space Layout Stacked Bar Chart)
                </h4>
                <p className="text-[11px] text-slate-400">
                  각 메모리 공간별 블록을 클릭하면 하단에 상세 주소 범위, 접근 명령어, 예약 구역(Reserved) 안전 수칙이 표시됩니다.
                </p>
              </div>
              <span className="text-[11px] text-amber-400/90 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                하버드 독립 버스 아키텍처 (Separate Address Spaces)
              </span>
            </div>

            {/* Visual Interactive Stacked Bars Component */}
            <div className="space-y-4 pt-1">
              {/* 1. Flash Stack Bar */}
              <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-400">1. Flash ROM 프로그램 공간</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      (총 {formatSize(memorySpaces.flash.totalBytes)} / {formatAddr(0)} ~ {formatAddr(memorySpaces.flash.totalBytes - 1)})
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">Word-addressed PC Fetch (1 clk)</span>
                </div>
                
                {/* Horizontal Segment Bar */}
                <div className="h-9 w-full bg-slate-950 rounded-lg p-0.5 flex overflow-hidden border border-slate-800">
                  {memorySpaces.flash.segments.map((seg) => {
                    const pct = Math.max(2, (seg.sizeBytes / memorySpaces.flash.totalBytes) * 100);
                    const isSelected = selectedSegmentId === seg.id;
                    return (
                      <button
                        key={seg.id}
                        onClick={() => setSelectedSegmentId(seg.id)}
                        style={{ width: `${pct}%`, backgroundColor: seg.color }}
                        title={`${seg.name}: ${formatAddr(seg.startAddr)} ~ ${formatAddr(seg.endAddr)} (${formatSize(seg.sizeBytes)})`}
                        className={`h-full relative transition-all group focus:outline-none flex items-center justify-center text-[10px] font-bold text-white tracking-tight px-1 overflow-hidden ${
                          isSelected ? 'ring-2 ring-white z-10 brightness-110 shadow-lg' : 'hover:brightness-110 opacity-90'
                        }`}
                      >
                        <span className="truncate drop-shadow-sm">{seg.nameKo}</span>
                        {seg.isReserved && (
                          <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Sub legend below Flash Bar */}
                <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] font-mono">
                  {memorySpaces.flash.segments.map((seg) => (
                    <button
                      key={seg.id}
                      onClick={() => setSelectedSegmentId(seg.id)}
                      className={`flex items-center gap-1.5 transition-all ${
                        selectedSegmentId === seg.id ? 'text-white font-bold underline' : 'text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
                      <span>{seg.nameKo}</span>
                      <span className="text-slate-400">[{formatAddr(seg.startAddr)}~{formatAddr(seg.endAddr)}]</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Data Memory / SRAM Stack Bar */}
              <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-400">2. Data Memory 공간 (SRAM & I/O + Reserved 64KB)</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      (내부 SRAM: {formatSize(currentProfile.sram * 1024)} | 총 어드레싱 공간 64KB)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">Byte-addressed LDS/STS (2 clk)</span>
                </div>

                {/* Horizontal Segment Bar */}
                <div className="h-9 w-full bg-slate-950 rounded-lg p-0.5 flex overflow-hidden border border-slate-800">
                  {memorySpaces.sram.segments.map((seg) => {
                    // For visualization, give meaningful minimum width so registers and IO aren't invisible
                    const rawPct = (seg.sizeBytes / 65536) * 100;
                    const visualPct = seg.isReserved ? Math.max(15, rawPct * 0.45) : Math.max(6, rawPct * 3.5);
                    const isSelected = selectedSegmentId === seg.id;
                    return (
                      <button
                        key={seg.id}
                        onClick={() => setSelectedSegmentId(seg.id)}
                        style={{ width: `${visualPct}%`, backgroundColor: seg.color }}
                        title={`${seg.name}: ${formatAddr(seg.startAddr)} ~ ${formatAddr(seg.endAddr)} (${formatSize(seg.sizeBytes)})`}
                        className={`h-full relative transition-all group focus:outline-none flex items-center justify-center text-[10px] font-bold text-white tracking-tight px-1 overflow-hidden ${
                          isSelected ? 'ring-2 ring-white z-10 brightness-110 shadow-lg' : 'hover:brightness-110 opacity-90'
                        }`}
                      >
                        <span className="truncate drop-shadow-sm">{seg.nameKo}</span>
                        {seg.isReserved && (
                          <span className="absolute top-0 right-0 w-2 h-2 bg-amber-400 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Sub legend below SRAM Bar */}
                <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] font-mono">
                  {memorySpaces.sram.segments.map((seg) => (
                    <button
                      key={seg.id}
                      onClick={() => setSelectedSegmentId(seg.id)}
                      className={`flex items-center gap-1.5 transition-all ${
                        selectedSegmentId === seg.id ? 'text-white font-bold underline' : 'text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
                      <span>{seg.nameKo}</span>
                      <span className="text-slate-400">[{formatAddr(seg.startAddr)}~{formatAddr(seg.endAddr)}]</span>
                      {seg.isReserved && <span className="text-amber-400 font-bold">(Reserved)</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. EEPROM Stack Bar */}
              <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-orange-400">3. EEPROM 비휘발성 저장 공간</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      (총 {formatSize(memorySpaces.eeprom.totalBytes)} / {formatAddr(0)} ~ {formatAddr(memorySpaces.eeprom.totalBytes - 1)})
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">EEAR/EEDR/EECR 독립 제어 (10만회 W/E)</span>
                </div>

                {/* Horizontal Segment Bar */}
                <div className="h-9 w-full bg-slate-950 rounded-lg p-0.5 flex overflow-hidden border border-slate-800">
                  {memorySpaces.eeprom.segments.map((seg) => {
                    const pct = Math.max(4, (seg.sizeBytes / memorySpaces.eeprom.totalBytes) * 100);
                    const isSelected = selectedSegmentId === seg.id;
                    return (
                      <button
                        key={seg.id}
                        onClick={() => setSelectedSegmentId(seg.id)}
                        style={{ width: `${pct}%`, backgroundColor: seg.color }}
                        title={`${seg.name}: ${formatAddr(seg.startAddr)} ~ ${formatAddr(seg.endAddr)} (${formatSize(seg.sizeBytes)})`}
                        className={`h-full relative transition-all group focus:outline-none flex items-center justify-center text-[10px] font-bold text-white tracking-tight px-1 overflow-hidden ${
                          isSelected ? 'ring-2 ring-white z-10 brightness-110 shadow-lg' : 'hover:brightness-110 opacity-90'
                        }`}
                      >
                        <span className="truncate drop-shadow-sm">{seg.nameKo}</span>
                        {seg.isReserved && (
                          <span className="absolute top-0 right-0 w-2 h-2 bg-amber-400 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Sub legend below EEPROM Bar */}
                <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] font-mono">
                  {memorySpaces.eeprom.segments.map((seg) => (
                    <button
                      key={seg.id}
                      onClick={() => setSelectedSegmentId(seg.id)}
                      className={`flex items-center gap-1.5 transition-all ${
                        selectedSegmentId === seg.id ? 'text-white font-bold underline' : 'text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
                      <span>{seg.nameKo}</span>
                      <span className="text-slate-400">[{formatAddr(seg.startAddr)}~{formatAddr(seg.endAddr)}]</span>
                      {seg.isReserved && <span className="text-amber-400 font-bold">(Reserved Guard)</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Recharts Stacked Percentage Comparison Chart */}
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                Recharts 정밀 스택 바 비율 분석 (Proportional Breakdown)
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">Recharts v3.x Stacked Bar</span>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={overviewChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 25, left: 20, bottom: 5 }}
                >
                  <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis type="category" dataKey="displayLabel" tick={{ fill: '#e2e8f0', fontSize: 11 }} width={120} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(value: any, name: any) => [`${value}%`, name]}
                  />
                  {/* Flash stacks */}
                  <Bar dataKey="ivt" stackId="stack" name="IVT 벡터" fill="#6366f1" />
                  <Bar dataKey="app" stackId="stack" name="Flash App Code" fill="#3b82f6" />
                  <Bar dataKey="boot" stackId="stack" name="Bootloader" fill="#f59e0b" />
                  {/* Data stacks */}
                  <Bar dataKey="gpr" stackId="stack" name="GP Regs (R0-R31)" fill="#8b5cf6" />
                  <Bar dataKey="stdio" stackId="stack" name="Standard I/O" fill="#06b6d4" />
                  <Bar dataKey="extio" stackId="stack" name="Extended I/O" fill="#0ea5e9" />
                  <Bar dataKey="sram" stackId="stack" name="Internal SRAM" fill="#10b981" />
                  <Bar dataKey="reservedData" stackId="stack" name="Reserved Address Space" fill="#475569" />
                  {/* EEPROM stacks */}
                  <Bar dataKey="sys" stackId="stack" name="System Header" fill="#eab308" />
                  <Bar dataKey="user" stackId="stack" name="User NV Data" fill="#f97316" />
                  <Bar dataKey="log" stackId="stack" name="Ring Log Buffer" fill="#d97706" />
                  <Bar dataKey="eepromRes" stackId="stack" name="Reserved Guard" fill="#64748b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: FLASH MEMORY DEEP DIVE WITH SIMULATOR */}
      {activeView === 'flash' && (
        <div className="space-y-5">
          {/* Flash Simulator Controls */}
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-1">
                <span>시뮬레이션 프로그램 코드 크기 (App Code Size):</span>
                <span className="text-blue-400 font-mono font-bold">{simulatedCodeKB.toFixed(1)} KB</span>
              </label>
              <input
                type="range"
                min={1}
                max={currentProfile.flash - bootloaderSizeKB - 1}
                step={0.5}
                value={simulatedCodeKB}
                onChange={(e) => setSimulatedCodeKB(parseFloat(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                <span>최소 (1 KB)</span>
                <span>사용률: {((simulatedCodeKB / (currentProfile.flash - bootloaderSizeKB)) * 100).toFixed(1)}%</span>
                <span>최대 ({(currentProfile.flash - bootloaderSizeKB - 1).toFixed(1)} KB)</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-1">
                <span>부트로더 할당 크기 (BOOTSZ Fuse 선택):</span>
                <span className="text-amber-400 font-mono font-bold">{bootloaderSizeKB} KB ({bootloaderSizeKB * 1024} B)</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[0.5, 1.0, 2.0, 4.0, 8.0]
                  .filter((size) => size <= currentProfile.flash * 0.15)
                  .map((size) => (
                    <button
                      key={size}
                      onClick={() => setBootloaderSizeKB(size)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                        bootloaderSizeKB === size
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {size >= 1 ? `${size} KB` : `${size * 1024} B`}
                    </button>
                  ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                * BOOTSZ0/BOOTSZ1 퓨즈 비트로 결정되며, 부트로더 시작 주소(Start Address)가 결정됩니다.
              </p>
            </div>
          </div>

          {/* Flash Stacked Layout Table */}
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              Flash 메모리 구역별 상세 주소 할당 (Memory Sections Breakdown)
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400">
                    <th className="pb-2">구역 (Section)</th>
                    <th className="pb-2">시작 주소 (Hex / Word)</th>
                    <th className="pb-2">종료 주소</th>
                    <th className="pb-2">크기 (Bytes / KB)</th>
                    <th className="pb-2">접근 권한 & 하드웨어 특성</th>
                    <th className="pb-2">선택</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {memorySpaces.flash.segments.map((seg) => {
                    const isSelected = selectedSegmentId === seg.id;
                    return (
                      <tr
                        key={seg.id}
                        className={`hover:bg-slate-900/60 transition-colors ${
                          isSelected ? 'bg-blue-500/10' : ''
                        }`}
                      >
                        <td className="py-2.5 font-sans font-medium text-slate-200 flex items-center gap-2">
                          <span className="w-3 h-3 rounded shrink-0" style={{ backgroundColor: seg.color }} />
                          <div>
                            <div className="text-white font-bold">{seg.nameKo}</div>
                            <div className="text-[10px] text-slate-400">{seg.name} ({seg.linkerSection})</div>
                          </div>
                        </td>
                        <td className="py-2.5 text-blue-300 font-bold">
                          {formatAddr(seg.startAddr, true)}
                        </td>
                        <td className="py-2.5 text-blue-300 font-bold">
                          {formatAddr(seg.endAddr, true)}
                        </td>
                        <td className="py-2.5 text-slate-300">
                          {formatSize(seg.sizeBytes)}
                        </td>
                        <td className="py-2.5 text-slate-400 font-sans text-[11px]">
                          {seg.accessMode}
                        </td>
                        <td className="py-2.5">
                          <button
                            onClick={() => setSelectedSegmentId(seg.id)}
                            className={`px-2 py-1 rounded text-[10px] font-sans font-semibold ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {isSelected ? '선택됨' : '상세보기'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: SRAM / DATA MEMORY WITH DYNAMIC HEAP/STACK COLLISION DETECTOR */}
      {activeView === 'sram' && (
        <div className="space-y-5">
          {/* SRAM Stack/Heap Collision Simulator */}
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-emerald-400" />
                  SRAM 동적 런타임 스택 & 힙 충돌 시뮬레이터 (Stack-Heap Collision Guard)
                </h4>
                <p className="text-[11px] text-slate-400">
                  전역 변수(.data, .bss), 동적 할당 힙(Heap, 상향 증가), 함수 호출 스택(Stack, RAMEND에서 하향 감소) 간 여유 공간을 계측합니다.
                </p>
              </div>

              {/* Status indicator */}
              <div>
                {sramCalculations.isCollision ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold animate-pulse">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    치명적 위험: 스택-힙 충돌 (Stack Overflow)!
                  </span>
                ) : sramCalculations.isWarning ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    경고: SRAM 잔여 메모리 15% 미만 ({sramCalculations.freeBytes} Bytes 남음)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    안전: 여유 SRAM {formatSize(sramCalculations.freeBytes)} (사용률 {sramCalculations.usagePercent}%)
                  </span>
                )}
              </div>
            </div>

            {/* Slider controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-semibold text-slate-300">정적 변수 (.data + .bss):</span>
                  <span className="font-mono text-cyan-400 font-bold">{simulatedStaticDataBytes} B</span>
                </div>
                <input
                  type="range"
                  min={128}
                  max={Math.floor(sramCalculations.sramCapacityBytes * 0.7)}
                  step={32}
                  value={simulatedStaticDataBytes}
                  onChange={(e) => setSimulatedStaticDataBytes(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400 mt-1">전역 변수, 정적 배열 및 버퍼</p>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-semibold text-slate-300">동적 힙 (malloc / new):</span>
                  <span className="font-mono text-amber-400 font-bold">{simulatedHeapBytes} B</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.floor(sramCalculations.sramCapacityBytes * 0.5)}
                  step={32}
                  value={simulatedHeapBytes}
                  onChange={(e) => setSimulatedHeapBytes(parseInt(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400 mt-1">상향(Upwards)으로 자라나는 동적 메모리</p>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-semibold text-slate-300">스택 깊이 (Call Stack + ISR):</span>
                  <span className="font-mono text-rose-400 font-bold">{simulatedStackBytes} B</span>
                </div>
                <input
                  type="range"
                  min={64}
                  max={Math.floor(sramCalculations.sramCapacityBytes * 0.7)}
                  step={32}
                  value={simulatedStackBytes}
                  onChange={(e) => setSimulatedStackBytes(parseInt(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400 mt-1">RAMEND에서 하향(Downwards)으로 성장</p>
              </div>
            </div>

            {/* Stack-Heap Visual Stacked Diagram */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <div className="flex justify-between text-xs mb-2">
                <span className="font-bold text-white">SRAM 메모리 점유 스택 바 (RAMSTART ~ RAMEND)</span>
                <span className="font-mono text-slate-400">
                  {formatAddr(memorySpaces.sram.segments[3].startAddr)} ~ {formatAddr(memorySpaces.sram.segments[3].endAddr)}
                </span>
              </div>

              <div className="h-8 w-full bg-slate-950 rounded-lg p-0.5 flex overflow-hidden border border-slate-800">
                {/* Static Data Bar */}
                <div
                  style={{ width: `${(simulatedStaticDataBytes / sramCalculations.sramCapacityBytes) * 100}%` }}
                  className="h-full bg-cyan-600 flex items-center justify-center text-[10px] font-bold text-white truncate px-1"
                  title={`.data + .bss: ${simulatedStaticDataBytes} B`}
                >
                  .data/.bss ({simulatedStaticDataBytes}B)
                </div>
                {/* Heap Bar */}
                <div
                  style={{ width: `${(simulatedHeapBytes / sramCalculations.sramCapacityBytes) * 100}%` }}
                  className="h-full bg-amber-600 flex items-center justify-center text-[10px] font-bold text-white truncate px-1"
                  title={`Heap: ${simulatedHeapBytes} B`}
                >
                  Heap ▲
                </div>
                {/* Free space margin */}
                <div
                  style={{ width: `${Math.max(0, (sramCalculations.freeBytes / sramCalculations.sramCapacityBytes) * 100)}%` }}
                  className={`h-full flex items-center justify-center text-[10px] font-bold truncate px-1 ${
                    sramCalculations.isCollision
                      ? 'bg-rose-900/80 text-rose-200 animate-pulse'
                      : 'bg-emerald-950 text-emerald-300'
                  }`}
                  title={`Free SRAM Headroom: ${sramCalculations.freeBytes} B`}
                >
                  {sramCalculations.isCollision ? 'COLLISION!' : `여유 공간 (${sramCalculations.freeBytes}B)`}
                </div>
                {/* Stack Bar */}
                <div
                  style={{ width: `${(simulatedStackBytes / sramCalculations.sramCapacityBytes) * 100}%` }}
                  className="h-full bg-rose-600 flex items-center justify-center text-[10px] font-bold text-white truncate px-1"
                  title={`Call Stack: ${simulatedStackBytes} B`}
                >
                  ▼ Stack ({simulatedStackBytes}B)
                </div>
              </div>
            </div>

            {/* Optional XMEM control for ATmega128 / ATmega640 */}
            {(selectedMCU === 'atmega128' || selectedMCU === 'atmega640') && (
              <div className="flex items-center justify-between bg-purple-950/30 p-3 rounded-lg border border-purple-800/40">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <div>
                    <span className="text-xs font-bold text-purple-300">외부 메모리 인터페이스 (XMEM) 활성화 토글</span>
                    <p className="text-[10px] text-purple-400/80">
                      Port A(AD0~7), Port C(A8~15), Port G(ALE/WR/RD)를 외부 64KB SRAM 버스로 전환합니다.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEnableXmem(!enableXmem)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    enableXmem
                      ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  {enableXmem ? 'XMEM 활성화됨 (Port A/C 잠김)' : 'XMEM 비활성 (기본 GPIO 모드)'}
                </button>
              </div>
            )}
          </div>

          {/* Data Memory Segments Table */}
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              데이터 주소 공간 세그먼트 (Data Address Space Segments & Reserved Regions)
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-sans">구역 명칭</th>
                    <th className="pb-2">시작 주소</th>
                    <th className="pb-2">종료 주소</th>
                    <th className="pb-2">크기</th>
                    <th className="pb-2 font-sans">상태 및 접근 명령어</th>
                    <th className="pb-2 font-sans">동작</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {memorySpaces.sram.segments.map((seg) => {
                    const isSelected = selectedSegmentId === seg.id;
                    return (
                      <tr
                        key={seg.id}
                        className={`hover:bg-slate-900/60 transition-colors ${
                          isSelected ? 'bg-emerald-500/10' : ''
                        }`}
                      >
                        <td className="py-2.5 font-sans font-medium text-slate-200 flex items-center gap-2">
                          <span className="w-3 h-3 rounded shrink-0" style={{ backgroundColor: seg.color }} />
                          <div>
                            <span className="text-white font-bold">{seg.nameKo}</span>
                            {seg.isReserved && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                RESERVED
                              </span>
                            )}
                            <div className="text-[10px] text-slate-400">{seg.name}</div>
                          </div>
                        </td>
                        <td className="py-2.5 text-emerald-400 font-bold">{formatAddr(seg.startAddr)}</td>
                        <td className="py-2.5 text-emerald-400 font-bold">{formatAddr(seg.endAddr)}</td>
                        <td className="py-2.5 text-slate-300">{formatSize(seg.sizeBytes)}</td>
                        <td className="py-2.5 text-slate-400 font-sans text-[11px]">{seg.accessMode}</td>
                        <td className="py-2.5">
                          <button
                            onClick={() => setSelectedSegmentId(seg.id)}
                            className={`px-2 py-1 rounded text-[10px] font-sans font-semibold ${
                              isSelected
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {isSelected ? '선택됨' : '상세보기'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: EEPROM DEEP DIVE */}
      {activeView === 'eeprom' && (
        <div className="space-y-5">
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-orange-400" />
                  EEPROM 비휘발성 메모리 구조 및 쓰기 마모도 보호 (Wear Leveling Protection)
                </h4>
                <p className="text-[11px] text-slate-400">
                  총 {currentProfile.eeprom} KB 용량에 대해 시스템 캘리브레이션 헤더, 사용자 설정 저장소, 링 버퍼 로그 구역, 예약 가드(Reserved)를 분할합니다.
                </p>
              </div>
              <div className="text-[11px] font-mono text-orange-300 bg-orange-500/10 px-2.5 py-1 rounded border border-orange-500/30">
                최대 100,000회 쓰기/삭제 보장 (3.4ms Write Cycle)
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-sans">EEPROM 블록</th>
                    <th className="pb-2">시작 오프셋</th>
                    <th className="pb-2">종료 오프셋</th>
                    <th className="pb-2">용량</th>
                    <th className="pb-2 font-sans">설명 및 권장 전략</th>
                    <th className="pb-2 font-sans">선택</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {memorySpaces.eeprom.segments.map((seg) => {
                    const isSelected = selectedSegmentId === seg.id;
                    return (
                      <tr
                        key={seg.id}
                        className={`hover:bg-slate-900/60 transition-colors ${
                          isSelected ? 'bg-orange-500/10' : ''
                        }`}
                      >
                        <td className="py-2.5 font-sans font-medium text-slate-200 flex items-center gap-2">
                          <span className="w-3 h-3 rounded shrink-0" style={{ backgroundColor: seg.color }} />
                          <div>
                            <span className="text-white font-bold">{seg.nameKo}</span>
                            {seg.isReserved && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                RESERVED GUARD
                              </span>
                            )}
                            <div className="text-[10px] text-slate-400">{seg.name}</div>
                          </div>
                        </td>
                        <td className="py-2.5 text-orange-300 font-bold">{formatAddr(seg.startAddr)}</td>
                        <td className="py-2.5 text-orange-300 font-bold">{formatAddr(seg.endAddr)}</td>
                        <td className="py-2.5 text-slate-300">{formatSize(seg.sizeBytes)}</td>
                        <td className="py-2.5 text-slate-400 font-sans text-[11px]">{seg.description}</td>
                        <td className="py-2.5">
                          <button
                            onClick={() => setSelectedSegmentId(seg.id)}
                            className={`px-2 py-1 rounded text-[10px] font-sans font-semibold ${
                              isSelected
                                ? 'bg-orange-600 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {isSelected ? '선택됨' : '상세보기'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SELECTED SEGMENT INSPECTOR PANEL (Deep Dive Card) */}
      {activeSegment && (
        <div className="bg-slate-950 rounded-xl p-5 border border-indigo-500/40 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-md shrink-0 shadow-sm" style={{ backgroundColor: activeSegment.color }} />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">
                    {activeSegment.nameKo}
                  </h4>
                  <span className="text-xs text-slate-400 font-mono">({activeSegment.name})</span>
                  {activeSegment.isReserved && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                      예약된 영역 (Reserved Region)
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  주소 범위: <strong className="text-amber-300">{formatAddr(activeSegment.startAddr, true)}</strong> ~ <strong className="text-amber-300">{formatAddr(activeSegment.endAddr, true)}</strong> • 총 크기: <strong className="text-emerald-400">{formatSize(activeSegment.sizeBytes)}</strong>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedSegmentId(null)}
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-900 border border-slate-800 self-start sm:self-auto"
            >
              인스펙터 닫기 ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-3 bg-slate-900/60 p-3.5 rounded-lg border border-slate-800/80">
              <div>
                <span className="text-slate-400 text-[11px] block mb-0.5">기능 설명:</span>
                <p className="text-slate-200 leading-relaxed font-sans">{activeSegment.description}</p>
              </div>

              <div>
                <span className="text-slate-400 text-[11px] block mb-0.5">접근 명령어 및 사이클 비용:</span>
                <p className="text-amber-300 font-mono font-medium">{activeSegment.accessMode}</p>
              </div>

              <div>
                <span className="text-slate-400 text-[11px] block mb-0.5">GCC 링커 섹션 명칭:</span>
                <code className="text-indigo-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                  {activeSegment.linkerSection}
                </code>
              </div>
            </div>

            <div className="space-y-3 bg-slate-900/60 p-3.5 rounded-lg border border-slate-800/80">
              {activeSegment.keyRegisters && (
                <div>
                  <span className="text-slate-400 text-[11px] block mb-0.5">관련 하드웨어 제어 레지스터:</span>
                  <p className="text-emerald-300 font-mono">{activeSegment.keyRegisters}</p>
                </div>
              )}

              <div>
                <span className="text-slate-400 text-[11px] block mb-0.5">하드웨어 주의사항 & 예약 영역 규칙:</span>
                <p className="text-slate-300 leading-relaxed font-sans">{activeSegment.hardwareNotes}</p>
              </div>

              {activeSegment.isReserved && (
                <div className="bg-amber-950/40 p-2.5 rounded border border-amber-600/40 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span className="text-[11px] text-amber-200 font-sans leading-tight">
                    <strong>주의:</strong> 이 예약 구역에 임의로 쓰기(Write)를 시도하면 버스 충돌, 전력 소모 급증, 또는 하드웨어 미정의 동작(Crash)이 발생할 수 있으므로 펌웨어 개발 시 접근을 엄격히 제한하십시오.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AVR Harvard Architecture Memory Model Architectural Notice */}
      <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <h5 className="font-bold text-white">AVR 하버드 아키텍처(Harvard Architecture) 주소 공간 분리의 핵심 원리</h5>
            <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
              AVR은 코드 영역(Flash ROM)과 데이터 영역(SRAM/IO)이 완전히 독립된 물리 버스와 주소 버스를 갖습니다. 프로그램 카운터(PC)는 16비트 워드(Word) 단위로 플래시를 패치하며, 데이터 버스는 8비트 바이트(Byte) 단위로 SRAM을 접근합니다. 이로 인해 0x0000 주소라도 Flash(리셋 벡터)와 SRAM(R0 레지스터), EEPROM(설정 0번지)이 완전히 다른 메모리 셀을 가리킵니다.
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-mono">
            {selectedMCU.toUpperCase()} • 16 MIPS @ 16MHz
          </span>
        </div>
      </div>
    </div>
  );
};
