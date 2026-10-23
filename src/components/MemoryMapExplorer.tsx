import React, { useState, useMemo } from 'react';
import {
  Layers,
  Cpu,
  Database,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Copy,
  Check,
  ShieldAlert,
  ArrowRight,
  FileCode,
  Zap,
  Info,
  Maximize2,
  Flame,
  Activity,
  AlertCircle,
  HelpCircle,
  BarChart2
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

export interface MemoryMapExplorerProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type MemorySpaceTab = 'all' | 'program' | 'data' | 'eeprom';

export interface SegmentDetail {
  id: string;
  space: 'Program' | 'Data' | 'EEPROM';
  name: string;
  nameKo: string;
  category: string;
  startAddrHex: string;
  endAddrHex: string;
  startAddr: number;
  endAddr: number;
  sizeBytes: number;
  sizeFormatted: string;
  color: string;
  textColor: string;
  bgClass: string;
  borderClass: string;
  accessMode: string;
  cycles: string;
  linkerSection: string;
  description: string;
  overflowRisk: string;
  debugAdvice: string;
}

export const MemoryMapExplorer: React.FC<MemoryMapExplorerProps> = ({
  selectedMCU,
  onSelectMCU
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Active Space View
  const [activeTab, setActiveTab] = useState<MemorySpaceTab>('all');
  const [selectedSegment, setSelectedSegment] = useState<SegmentDetail | null>(null);
  const [addressDisplay, setAddressDisplay] = useState<'hex' | 'dec' | 'word'>('hex');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Allocation Simulation Controls
  const [simFlashCodeKB, setSimFlashCodeKB] = useState<number>(() => {
    if (selectedMCU === 'atmega328p') return 16.5;
    if (selectedMCU === 'atmega128') return 42.0;
    if (selectedMCU === 'atmega640') return 28.0;
    return 74.0;
  });

  const [simProgmemKB, setSimProgmemKB] = useState<number>(() => {
    if (selectedMCU === 'atmega328p') return 4.0;
    if (selectedMCU === 'atmega128') return 12.0;
    if (selectedMCU === 'atmega640') return 8.0;
    return 24.0;
  });

  const [simStaticDataBytes, setSimStaticDataBytes] = useState<number>(() => {
    if (selectedMCU === 'atmega328p') return 520;
    if (selectedMCU === 'atmega128') return 1200;
    return 1800;
  });

  const [simHeapBytes, setSimHeapBytes] = useState<number>(350);
  const [simStackDepthBytes, setSimStackDepthBytes] = useState<number>(450);
  const [simEepromBytes, setSimEepromBytes] = useState<number>(() => {
    return selectedMCU === 'atmega328p' ? 384 : 1024;
  });

  // Calculate Hardware Specs based on MCU
  const hardwareSpecs = useMemo(() => {
    const flashBytes = currentProfile.flash * 1024;
    const sramBytes = currentProfile.sram * 1024;
    const eepromBytes = currentProfile.eeprom * 1024;

    // IVT size
    let ivtBytes = 104; // default 328p (26 * 4)
    let ivtVectors = 26;
    if (selectedMCU === 'atmega128') {
      ivtBytes = 140; // 35 * 4
      ivtVectors = 35;
    } else if (selectedMCU === 'atmega640' || selectedMCU === 'atmega2560') {
      ivtBytes = 228; // 57 * 4
      ivtVectors = 57;
    }

    // Extended I/O size
    const extIoSize = (selectedMCU === 'atmega640' || selectedMCU === 'atmega2560') ? 416 : 160;
    const sramStartAddr = 32 + 64 + extIoSize;
    const ramEnd = sramStartAddr + sramBytes - 1;

    // Bootloader default size
    const bootloaderBytes = selectedMCU === 'atmega328p' ? 512 : 4096;
    const bootStartAddr = flashBytes - bootloaderBytes;

    return {
      flashBytes,
      sramBytes,
      eepromBytes,
      ivtBytes,
      ivtVectors,
      extIoSize,
      sramStartAddr,
      ramEnd,
      bootloaderBytes,
      bootStartAddr
    };
  }, [selectedMCU, currentProfile]);

  // Dynamic simulation calculations
  const simResults = useMemo(() => {
    const totalFlashUsed = Math.round(simFlashCodeKB * 1024 + simProgmemKB * 1024 + hardwareSpecs.ivtBytes + hardwareSpecs.bootloaderBytes);
    const flashCapacity = hardwareSpecs.flashBytes;
    const flashRemaining = flashCapacity - totalFlashUsed;
    const flashOverflow = totalFlashUsed > flashCapacity;
    const flashUsagePct = Math.min(100, Math.round((totalFlashUsed / flashCapacity) * 100));

    // SRAM Calculations
    const sramCapacity = hardwareSpecs.sramBytes;
    const sramStart = hardwareSpecs.sramStartAddr;
    const sramEnd = hardwareSpecs.ramEnd;

    // Heap starts right after .data and .bss
    const heapStart = sramStart + simStaticDataBytes;
    const heapEnd = heapStart + simHeapBytes;

    // Stack grows downwards from RAMEND
    const stackTop = sramEnd;
    const stackCurrentSP = stackTop - simStackDepthBytes;

    // Safety margin between Heap and Stack
    const freeSramMargin = stackCurrentSP - heapEnd;
    const isStackHeapCollision = freeSramMargin <= 0;
    const isSramWarning = freeSramMargin > 0 && freeSramMargin < 128; // Under 128 bytes is risky on AVR
    const sramUsedBytes = simStaticDataBytes + simHeapBytes + simStackDepthBytes;
    const sramUsagePct = Math.min(100, Math.round((sramUsedBytes / sramCapacity) * 100));

    // EEPROM Calculations
    const eepromCapacity = hardwareSpecs.eepromBytes;
    const eepromRemaining = eepromCapacity - simEepromBytes;
    const isEepromOverflow = simEepromBytes > eepromCapacity;
    const eepromUsagePct = Math.min(100, Math.round((simEepromBytes / eepromCapacity) * 100));

    return {
      totalFlashUsed,
      flashRemaining,
      flashOverflow,
      flashUsagePct,
      heapStart,
      heapEnd,
      stackTop,
      stackCurrentSP,
      freeSramMargin,
      isStackHeapCollision,
      isSramWarning,
      sramUsedBytes,
      sramUsagePct,
      eepromRemaining,
      isEepromOverflow,
      eepromUsagePct
    };
  }, [simFlashCodeKB, simProgmemKB, simStaticDataBytes, simHeapBytes, simStackDepthBytes, simEepromBytes, hardwareSpecs]);

  // Helper formatting for addresses
  const fmtAddr = (addr: number, isProgramSpace = false): string => {
    if (addressDisplay === 'dec') return `${addr.toLocaleString()} B`;
    if (addressDisplay === 'word' && isProgramSpace) {
      const wordVal = Math.floor(addr / 2);
      return `0x${wordVal.toString(16).toUpperCase().padStart(4, '0')} (Word)`;
    }
    const padLen = addr > 0xFFFF ? 6 : 4;
    return `0x${addr.toString(16).toUpperCase().padStart(padLen, '0')}`;
  };

  // Build segments for each memory space
  const programSegments: SegmentDetail[] = useMemo(() => {
    const { flashBytes, ivtBytes, ivtVectors, bootloaderBytes, bootStartAddr } = hardwareSpecs;
    const codeSizeBytes = Math.round(simFlashCodeKB * 1024);
    const progmemSizeBytes = Math.round(simProgmemKB * 1024);

    const seg1End = ivtBytes - 1;
    const seg2Start = ivtBytes;
    const seg2End = Math.min(bootStartAddr - 1, seg2Start + codeSizeBytes - 1);

    const seg3Start = seg2End + 1;
    const seg3End = Math.min(bootStartAddr - 1, seg3Start + progmemSizeBytes - 1);

    const segFreeStart = seg3End + 1;
    const segFreeEnd = Math.max(segFreeStart, bootStartAddr - 1);
    const freeSizeBytes = Math.max(0, bootStartAddr - segFreeStart);

    return [
      {
        id: 'prog_ivt',
        space: 'Program',
        name: 'Reset & Interrupt Vector Table (IVT)',
        nameKo: '인터럽트 벡터 테이블 (IVT)',
        category: 'Vector Table',
        startAddrHex: fmtAddr(0, true),
        endAddrHex: fmtAddr(seg1End, true),
        startAddr: 0,
        endAddr: seg1End,
        sizeBytes: ivtBytes,
        sizeFormatted: `${ivtBytes} B (${ivtVectors}개 벡터)`,
        color: '#f43f5e',
        textColor: 'text-rose-400',
        bgClass: 'bg-rose-500/15',
        borderClass: 'border-rose-500/40',
        accessMode: '하드웨어 자동 분기 (JMP/RJMP 2~3 clk)',
        cycles: '2~4 사이클',
        linkerSection: '.vectors',
        description: `하드웨어 리셋 및 주변장치 인터럽트 발생 시 CPU가 즉시 점프하는 4바이트(JMP) 또는 2바이트(RJMP) 명령어 테이블입니다.`,
        overflowRisk: '인터럽트 핸들러가 누락되면 __bad_interrupt(리셋)로 강제 분기합니다.',
        debugAdvice: '사용하지 않는 인터럽트는 ISR(BADISR_vect)을 정의하여 비정상 리셋을 가로채서 안전 모드로 전환하세요.'
      },
      {
        id: 'prog_text',
        space: 'Program',
        name: 'Executable Instructions (.text)',
        nameKo: '컴파일된 C/C++ 실행 코드 (.text)',
        category: 'Code Section',
        startAddrHex: fmtAddr(seg2Start, true),
        endAddrHex: fmtAddr(seg2End, true),
        startAddr: seg2Start,
        endAddr: seg2End,
        sizeBytes: codeSizeBytes,
        sizeFormatted: `${simFlashCodeKB.toFixed(1)} KB`,
        color: '#38bdf8',
        textColor: 'text-sky-400',
        bgClass: 'bg-sky-500/15',
        borderClass: 'border-sky-500/40',
        accessMode: 'PC 레지스터 단일 사이클 인출 (1 clk)',
        cycles: '1 사이클 파이프라인',
        linkerSection: '.text',
        description: '컴파일러에 의해 생성된 기계어 명령어가 저장되는 비휘발성 영역입니다. 플래시 메모리에서 직접 실행됩니다.',
        overflowRisk: '코드가 플래시 용량을 초과하면 avr-ld 링커 에러(section .text will not fit in region text)가 발생합니다.',
        debugAdvice: '최적화 플래그 `-Os` 및 `-flto`를 적용하고 인라인 함수(inline)를 과도하게 사용하지 마세요.'
      },
      {
        id: 'prog_rodata',
        space: 'Program',
        name: 'Flash Constants & PROGMEM (.rodata)',
        nameKo: '상수 데이터 및 PROGMEM 문자열 (.rodata)',
        category: 'Read-Only Data',
        startAddrHex: fmtAddr(seg3Start, true),
        endAddrHex: fmtAddr(seg3End, true),
        startAddr: seg3Start,
        endAddr: seg3End,
        sizeBytes: progmemSizeBytes,
        sizeFormatted: `${simProgmemKB.toFixed(1)} KB`,
        color: '#a855f7',
        textColor: 'text-purple-400',
        bgClass: 'bg-purple-500/15',
        borderClass: 'border-purple-500/40',
        accessMode: 'LPM (Load Program Memory, 3 clk) / ELPM (3 clk)',
        cycles: '3 사이클 (LPM Z+)',
        linkerSection: '.rodata, .progmem.data',
        description: '`PROGMEM` 키워드 또는 `F()` 매크로로 지정한 문자열, 폰트 비트맵, 룩업 테이블이 저장되는 플래시 구역입니다.',
        overflowRisk: '포인터를 일반 RAM 포인터로 잘못 취급하면 쓰레기 값(RAM 데이터)이 읽힙니다.',
        debugAdvice: '읽을 때는 반드시 `pgm_read_byte()`, `strcpy_P()`, `memcpy_P()` 함수를 사용해야 합니다.'
      },
      {
        id: 'prog_free',
        space: 'Program',
        name: 'Free Flash Memory Room',
        nameKo: '미사용 플래시 여유 공간',
        category: 'Unallocated Flash',
        startAddrHex: fmtAddr(segFreeStart, true),
        endAddrHex: fmtAddr(segFreeEnd, true),
        startAddr: segFreeStart,
        endAddr: segFreeEnd,
        sizeBytes: freeSizeBytes,
        sizeFormatted: `${(freeSizeBytes / 1024).toFixed(1)} KB 남음`,
        color: '#10b981',
        textColor: 'text-emerald-400',
        bgClass: 'bg-emerald-500/10',
        borderClass: 'border-emerald-500/30',
        accessMode: '소거 상태 (0xFF)',
        cycles: 'N/A',
        linkerSection: 'Unused',
        description: '추후 펌웨어 업데이트 및 기능 확장에 사용할 수 있는 여유 플래시 공간입니다.',
        overflowRisk: '0바이트 미만 시 오버플로우가 발생합니다.',
        debugAdvice: '여유 공간이 10% 이하일 경우 대형 라이브러리(printf, float 포맷) 분리를 고려하세요.'
      },
      {
        id: 'prog_boot',
        space: 'Program',
        name: 'Hardware Bootloader Section (NRWW)',
        nameKo: '하드웨어 부트로더 구역 (Optiboot / STK500)',
        category: 'Bootloader',
        startAddrHex: fmtAddr(bootStartAddr, true),
        endAddrHex: fmtAddr(flashBytes - 1, true),
        startAddr: bootStartAddr,
        endAddr: flashBytes - 1,
        sizeBytes: bootloaderBytes,
        sizeFormatted: `${(bootloaderBytes / 1024).toFixed(1)} KB (${bootloaderBytes} B)`,
        color: '#f59e0b',
        textColor: 'text-amber-400',
        bgClass: 'bg-amber-500/15',
        borderClass: 'border-amber-500/40',
        accessMode: 'SPM (Self-Programming, 4 clk), LPM (3 clk)',
        cycles: 'SPM 실행 중 CPU 정지(Halt)',
        linkerSection: '.bootloader',
        description: 'UART 시리얼로 펌웨어를 자가 플래싱하는 비휘발성 코드 영역입니다. BOOTSZ 퓨즈로 크기가 결정됩니다.',
        overflowRisk: '애플리케이션 코드가 부트로더 영역을 침범하면 부트로더 바이너리가 파손되어 벽돌이 됩니다.',
        debugAdvice: 'BOOTRST 퓨즈가 활성화되면 MCU 리셋 직후 이 구역의 시작 주소로 강제 분기합니다.'
      }
    ];
  }, [hardwareSpecs, simFlashCodeKB, simProgmemKB, addressDisplay]);

  // Data Space segments (SRAM + Register File + I/O Map)
  const dataSegments: SegmentDetail[] = useMemo(() => {
    const { sramStartAddr, extIoSize, ramEnd } = hardwareSpecs;
    const { heapStart, heapEnd, stackTop, stackCurrentSP } = simResults;

    return [
      {
        id: 'data_gpr',
        space: 'Data',
        name: 'General Purpose Registers (R0 ~ R31)',
        nameKo: '범용 CPU 레지스터 파일 (32개)',
        category: 'CPU Core Registers',
        startAddrHex: fmtAddr(0x0000),
        endAddrHex: fmtAddr(0x001F),
        startAddr: 0x0000,
        endAddr: 0x001F,
        sizeBytes: 32,
        sizeFormatted: '32 Bytes',
        color: '#6366f1',
        textColor: 'text-indigo-400',
        bgClass: 'bg-indigo-500/15',
        borderClass: 'border-indigo-500/40',
        accessMode: 'ALU 직접 단일 사이클 실행 (1 clk), LDS/STS (2 clk)',
        cycles: '1 사이클',
        linkerSection: 'Register File (R0-R31)',
        description: '32개의 초고속 8비트 작업 레지스터. R26~R31은 16비트 X, Y, Z 주소 포인터 쌍으로 동작합니다.',
        overflowRisk: '어셈블리 인라인 작성 시 컴파일러가 할당한 레지스터(R18~R27)를 파괴하면 크래시가 납니다.',
        debugAdvice: 'C 언어에서 임의로 레지스터를 조작할 때는 레지스터 보존 규약(ABI)을 준수해야 합니다.'
      },
      {
        id: 'data_io',
        space: 'Data',
        name: 'Standard I/O Registers (64 Regs)',
        nameKo: '표준 I/O 제어 레지스터 (64개)',
        category: 'I/O Peripherals',
        startAddrHex: fmtAddr(0x0020),
        endAddrHex: fmtAddr(0x005F),
        startAddr: 0x0020,
        endAddr: 0x005F,
        sizeBytes: 64,
        sizeFormatted: '64 Bytes (I/O 0x00~0x3F)',
        color: '#06b6d4',
        textColor: 'text-cyan-400',
        bgClass: 'bg-cyan-500/15',
        borderClass: 'border-cyan-500/40',
        accessMode: 'IN / OUT (1 clk), CBI / SBI (1~2 clk)',
        cycles: '1~2 사이클',
        linkerSection: 'Hardware I/O Space',
        description: 'PORT, DDR, PIN, SREG, 타이머/카운터, EEPROM 제어 등 핵심 주변장치 레지스터 블록입니다.',
        overflowRisk: 'I/O 주소(0x00~0x3F)와 메모리 매핑 주소(0x0020~0x005F)의 0x20 오프셋 혼동 주의.',
        debugAdvice: '단일 비트 토글 시 원자성(Atomic) 보장을 위해 `SBI/CBI` 명령어를 사용하세요.'
      },
      {
        id: 'data_extio',
        space: 'Data',
        name: `Extended I/O Registers (${extIoSize} Regs)`,
        nameKo: `확장 I/O 레지스터 (${extIoSize}개)`,
        category: 'Extended Peripherals',
        startAddrHex: fmtAddr(0x0060),
        endAddrHex: fmtAddr(0x005F + extIoSize),
        startAddr: 0x0060,
        endAddr: 0x005F + extIoSize,
        sizeBytes: extIoSize,
        sizeFormatted: `${extIoSize} Bytes`,
        color: '#0ea5e9',
        textColor: 'text-sky-400',
        bgClass: 'bg-sky-500/15',
        borderClass: 'border-sky-500/40',
        accessMode: 'LDS / STS (2 clk), LDD / STD (2 clk)',
        cycles: '2 사이클',
        linkerSection: 'Extended I/O Space',
        description: '다중 USART, 16비트 타이머 1/3/4/5, ADC 제어 레지스터가 위치하는 확장 메모리 블록입니다.',
        overflowRisk: 'IN/OUT 명령어로는 접근할 수 없으며 오직 LDS/STS 명령어로만 접근 가능합니다.',
        debugAdvice: '어셈블리 코드로 직접 제어 시 매핑 주소를 LDS/STS로 호출해야 합니다.'
      },
      {
        id: 'data_static',
        space: 'Data',
        name: 'Initialized Data & Zeroed BSS (.data + .bss)',
        nameKo: '정적/전역 변수 영역 (.data + .bss)',
        category: 'Static SRAM',
        startAddrHex: fmtAddr(sramStartAddr),
        endAddrHex: fmtAddr(heapStart - 1),
        startAddr: sramStartAddr,
        endAddr: Math.max(sramStartAddr, heapStart - 1),
        sizeBytes: simStaticDataBytes,
        sizeFormatted: `${simStaticDataBytes} Bytes`,
        color: '#3b82f6',
        textColor: 'text-blue-400',
        bgClass: 'bg-blue-500/15',
        borderClass: 'border-blue-500/40',
        accessMode: 'LDS / STS (2 clk)',
        cycles: '2 사이클',
        linkerSection: '.data, .bss, .noinit',
        description: '전역 변수 및 정적 변수 저장소입니다. .data는 플래시에서 초기값이 SRAM으로 복사되고, .bss는 0으로 초기화됩니다.',
        overflowRisk: '대형 배열(예: `char buffer[1024]`)을 전역으로 선언하면 SRAM의 대부분을 잠식합니다.',
        debugAdvice: '상수 문자열이나 룩업 테이블은 반드시 `PROGMEM` 키워드를 사용하여 플래시로 이전하세요.'
      },
      {
        id: 'data_heap',
        space: 'Data',
        name: 'Dynamic Heap (malloc / new)',
        nameKo: '동적 힙 할당 영역 (Heap - malloc)',
        category: 'Dynamic Heap',
        startAddrHex: fmtAddr(heapStart),
        endAddrHex: fmtAddr(heapEnd),
        startAddr: heapStart,
        endAddr: heapEnd,
        sizeBytes: simHeapBytes,
        sizeFormatted: `${simHeapBytes} Bytes (__brkval)`,
        color: '#f59e0b',
        textColor: 'text-amber-400',
        bgClass: 'bg-amber-500/15',
        borderClass: 'border-amber-500/40',
        accessMode: '포인터 간접 접근 (LD / ST, 2 clk)',
        cycles: '2 사이클',
        linkerSection: 'Heap (__brkval)',
        description: '`malloc()` 또는 C++ `new` 호출 시 저위 주소에서 고위 주소(상향)로 확장되는 동적 할당 공간입니다.',
        overflowRisk: '임베디드 AVR 환경에서 메모리 단편화(Fragmentation)가 발생하면 실제 여유 공간이 있어도 malloc이 실패(NULL 반환)합니다.',
        debugAdvice: '8비트 MCU에서는 malloc 사용을 지양하고 고정 크기 정적 버퍼 또는 풀 할당자(Pool Allocator)를 사용하세요.'
      },
      {
        id: 'data_free',
        space: 'Data',
        name: 'Free SRAM Collision Margin',
        nameKo: '스택-힙 충돌 방지 여유 공간 (Safety Margin)',
        category: 'Free SRAM Margin',
        startAddrHex: fmtAddr(heapEnd + 1),
        endAddrHex: fmtAddr(Math.max(heapEnd + 1, stackCurrentSP - 1)),
        startAddr: heapEnd + 1,
        endAddr: Math.max(heapEnd + 1, stackCurrentSP - 1),
        sizeBytes: Math.max(0, simResults.freeSramMargin),
        sizeFormatted: `${Math.max(0, simResults.freeSramMargin)} Bytes`,
        color: simResults.isStackHeapCollision ? '#ef4444' : simResults.isSramWarning ? '#f59e0b' : '#10b981',
        textColor: simResults.isStackHeapCollision ? 'text-rose-400' : simResults.isSramWarning ? 'text-amber-400' : 'text-emerald-400',
        bgClass: simResults.isStackHeapCollision ? 'bg-rose-500/20' : simResults.isSramWarning ? 'bg-amber-500/15' : 'bg-emerald-500/10',
        borderClass: simResults.isStackHeapCollision ? 'border-rose-500 animate-pulse' : simResults.isSramWarning ? 'border-amber-500' : 'border-emerald-500/30',
        accessMode: '미할당 미사용 영역',
        cycles: 'N/A',
        linkerSection: 'Unused Margin',
        description: '힙의 상한점(`__brkval`)과 하향 성장하는 스택 포인터(`SP`) 사이의 완충 구역입니다.',
        overflowRisk: '이 구역이 0바이트가 되면 스택과 힙이 서로의 변수/복귀번지를 덮어써 MCU가 무한 리셋되거나 폭주합니다.',
        debugAdvice: '최소 128~256바이트 이상의 안전 여유 마진을 항상 유지해야 인터럽트 중첩 시 안전합니다.'
      },
      {
        id: 'data_stack',
        space: 'Data',
        name: 'Call Stack & Local Variables (RAMEND ➔ SP)',
        nameKo: '콜 스택 & 지역 변수 (Stack - RAMEND)',
        category: 'Call Stack',
        startAddrHex: fmtAddr(stackCurrentSP),
        endAddrHex: fmtAddr(stackTop),
        startAddr: stackCurrentSP,
        endAddr: stackTop,
        sizeBytes: simStackDepthBytes,
        sizeFormatted: `${simStackDepthBytes} Bytes (SP: ${fmtAddr(stackCurrentSP)})`,
        color: '#ec4899',
        textColor: 'text-pink-400',
        bgClass: 'bg-pink-500/15',
        borderClass: 'border-pink-500/40',
        accessMode: 'PUSH / POP (2 clk), CALL / RET (3~4 clk)',
        cycles: '2~4 사이클',
        linkerSection: 'Stack (RAMEND)',
        description: '함수 호출 시 복귀 번지(PC), 지역 변수(Local vars), ISR 진입 시 레지스터 상태를 보관하며 최상단(RAMEND)에서 하향 확장합니다.',
        overflowRisk: '재귀 함수 호출(Recursion)이나 깊은 함수 중첩, ISR 내 대형 지역 배열 선언 시 스택 오버플로우가 즉시 발생합니다.',
        debugAdvice: '스택 포인터 레지스터 `SPH:SPL`은 리셋 시 자동으로 `RAMEND` 주소로 초기화됩니다.'
      }
    ];
  }, [hardwareSpecs, simResults, simStaticDataBytes, simHeapBytes, simStackDepthBytes, addressDisplay]);

  // EEPROM space segments
  const eepromSegments: SegmentDetail[] = useMemo(() => {
    const { eepromBytes } = hardwareSpecs;
    const userSizeBytes = Math.round(simEepromBytes * 0.7);
    const logSizeBytes = Math.round(simEepromBytes * 0.3);
    const freeSizeBytes = Math.max(0, eepromBytes - simEepromBytes);

    const seg1End = Math.max(0, userSizeBytes - 1);
    const seg2Start = seg1End + 1;
    const seg2End = Math.min(eepromBytes - 1, seg2Start + logSizeBytes - 1);
    const seg3Start = seg2End + 1;

    return [
      {
        id: 'eeprom_config',
        space: 'EEPROM',
        name: 'Persistent Configuration Records',
        nameKo: '영구 파라미터 & 환경 설정 영역',
        category: 'Configuration',
        startAddrHex: fmtAddr(0x0000),
        endAddrHex: fmtAddr(seg1End),
        startAddr: 0x0000,
        endAddr: seg1End,
        sizeBytes: userSizeBytes,
        sizeFormatted: `${userSizeBytes} Bytes`,
        color: '#10b981',
        textColor: 'text-emerald-400',
        bgClass: 'bg-emerald-500/15',
        borderClass: 'border-emerald-500/40',
        accessMode: 'EEAR / EEDR / EECR 레지스터 인터페이스 (약 3.4ms 소요)',
        cycles: '쓰기 주기 3.4ms 하드웨어 대기',
        linkerSection: '.eeprom (Origin 0x00810000)',
        description: '전원이 꺼져도 유지되는 기기 ID, 보정값(Calibration), 네트워크 IP, 센서 영점 등이 저장되는 영역입니다.',
        overflowRisk: '쓰기 시 EEMPE 및 EEPE 비트 타이밍 규약을 준수하지 않으면 쓰기 동작이 묵살됩니다.',
        debugAdvice: '불필요한 반복 쓰기로 인한 실리콘 열화를 방지하기 위해 `eeprom_update_byte()`를 사용하세요.'
      },
      {
        id: 'eeprom_log',
        space: 'EEPROM',
        name: 'Sensor Telemetry & Ring Buffer Logging',
        nameKo: '센서 로그 & 링 버퍼 이력 영역',
        category: 'Data Logging',
        startAddrHex: fmtAddr(seg2Start),
        endAddrHex: fmtAddr(seg2End),
        startAddr: seg2Start,
        endAddr: seg2End,
        sizeBytes: logSizeBytes,
        sizeFormatted: `${logSizeBytes} Bytes`,
        color: '#06b6d4',
        textColor: 'text-cyan-400',
        bgClass: 'bg-cyan-500/15',
        borderClass: 'border-cyan-500/40',
        accessMode: '바이트 단위 비동기 읽기/쓰기',
        cycles: '읽기 4 사이클, 쓰기 3.4ms',
        linkerSection: '.eeprom',
        description: '이벤트 발생 시점의 센서 데이터, 오류 코드, 부팅 횟수를 보관하는 순환 링 버퍼 공간입니다.',
        overflowRisk: '특정 주소에만 반복 기록할 경우 10만 회 쓰기 수명(Endurance)을 초과하여 섹터가 파손됩니다.',
        debugAdvice: '소프트웨어 웨어 레벨링(Wear-leveling) 알고리즘을 적용하여 주소를 순환 기록하세요.'
      },
      {
        id: 'eeprom_free',
        space: 'EEPROM',
        name: 'Unused EEPROM Capacity',
        nameKo: '미사용 EEPROM 여유 용량',
        category: 'Free EEPROM',
        startAddrHex: fmtAddr(seg3Start),
        endAddrHex: fmtAddr(eepromBytes - 1),
        startAddr: seg3Start,
        endAddr: eepromBytes - 1,
        sizeBytes: freeSizeBytes,
        sizeFormatted: `${freeSizeBytes} Bytes (${(freeSizeBytes / 1024).toFixed(2)} KB)`,
        color: simResults.isEepromOverflow ? '#ef4444' : '#64748b',
        textColor: simResults.isEepromOverflow ? 'text-rose-400' : 'text-slate-400',
        bgClass: simResults.isEepromOverflow ? 'bg-rose-500/20' : 'bg-slate-800/40',
        borderClass: simResults.isEepromOverflow ? 'border-rose-500' : 'border-slate-700/50',
        accessMode: '미할당 (0xFF 기본값)',
        cycles: 'N/A',
        linkerSection: 'Unused',
        description: '추가 비휘발성 데이터를 저장할 수 있는 남은 EEPROM 공간입니다.',
        overflowRisk: 'EEPROM 용량을 초과하여 기록하면 주소가 0x0000으로 랩어라운드되어 설정 데이터를 파괴할 수 있습니다.',
        debugAdvice: '쓰기 전 주소가 `E2END`를 넘지 않는지 상시 경계 검사(Boundary Check)를 수행하세요.'
      }
    ];
  }, [hardwareSpecs, simEepromBytes, simResults.isEepromOverflow, addressDisplay]);

  // Code snippets for debugging
  const codeSnippets = useMemo(() => {
    const freeRamCode = `// ==========================================
// AVR-GCC 실시간 잔여 SRAM 및 스택-힙 간격 측정 함수
// ==========================================
#include <avr/io.h>

extern int __heap_start, *__brkval;

/**
 * @brief 현재 스택 포인터와 힙 상한선 사이의 여유 바이트 계산
 * @return 0 이하이면 스택-힙 충돌(Stack-Heap Collision) 발생!
 */
int getFreeSram(void) {
  int free_memory;

  // 힙에 할당된 메모리가 없으면 __heap_start 사용
  if ((int)__brkval == 0) {
    free_memory = ((int)&free_memory) - ((int)&__heap_start);
  } else {
    free_memory = ((int)&free_memory) - ((int)__brkval);
  }

  return free_memory;
}

// 사용 예시:
void loop() {
  int freeBytes = getFreeSram();
  if (freeBytes < 128) {
    // ⚠️ 경고: SRAM 잔여량이 128B 미만! 즉시 경고등 점등 및 재설정
    PORTB |= (1 << PB5); 
  }
}`;

    const progmemCode = `// ==========================================
// 대용량 문자열을 플래시(.rodata)로 이전하여 SRAM 절약
// ==========================================
#include <avr/pgmspace.h>

// ❌ 나쁜 예: 100바이트의 SRAM 정적 영역(.data)을 불필요하게 점유
const char bad_msg[] = "System Error: Motor Overcurrent Detected at Hall Sensor #3!";

// ✅ 권장 1: F() 매크로를 사용하여 시리얼 출력 시 SRAM 0바이트 소모
Serial.println(F("System Error: Motor Overcurrent Detected at Hall Sensor #3!"));

// ✅ 권장 2: PROGMEM 지시어로 플래시 메모리에만 고정 배치
const char ok_msg[] PROGMEM = "System Error: Motor Overcurrent Detected at Hall Sensor #3!";

void printFlashMessage(const char *progmem_str) {
  char c;
  while ((c = pgm_read_byte(progmem_str++))) {
    USART_Transmit(c); // 플래시에서 1바이트씩 직접 로드 (LPM 명령어)
  }
}`;

    const eepromSafeCode = `// ==========================================
// EEPROM 경계 검사 및 수명 보존(Wear-reduction) 함수
// ==========================================
#include <avr/eeprom.h>

#define MAX_EEPROM_ADDR  E2END // ${selectedMCU === 'atmega328p' ? '0x03FF (1023)' : '0x0FFF (4095)'}

typedef struct {
  uint16_t bootCount;
  float calibrationFactor;
  uint8_t checksum;
} SystemConfig;

bool writeConfigSafely(uint16_t targetAddr, const SystemConfig *config) {
  // 1. 메모리 오버플로우 경계 검사 (Wrap-around 파괴 방지)
  if (targetAddr + sizeof(SystemConfig) > MAX_EEPROM_ADDR + 1) {
    return false; // 오버플로우 방지 차단!
  }

  // 2. eeprom_update_block: 기존 바이트와 비교하여 변경된 셀만 3.4ms 쓰기 수행
  // (동일한 데이터 재작성 시 실리콘 수명 10만 회 소모 차단)
  eeprom_update_block((const void*)config, (void*)targetAddr, sizeof(SystemConfig));
  return true;
}`;

    return {
      freeRamCode,
      progmemCode,
      eepromSafeCode
    };
  }, [selectedMCU]);

  const handleCopyCode = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  return (
    <div id="memory-map-explorer-card" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur-xl shadow-2xl space-y-7">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                메모리 맵 탐색기 & 오버플로우 디버거
              </h3>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                Memory Map Explorer
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                {currentProfile.name}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              독립된 3대 하버드 주소 공간(Program Flash, Data SRAM, Non-Volatile EEPROM)의 물리적 주소 배치를 실시간 계측하고, 임베디드 펌웨어의 치명적인 버그인 <strong>스택-힙 충돌(Stack-Heap Collision)</strong> 및 <strong>메모리 오버플로우</strong> 위험을 사전에 시뮬레이션 및 디버깅합니다.
            </p>
          </div>
        </div>

        {/* Top Controls: MCU Switcher & Address Format */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* MCU Pill Selector */}
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

          {/* Address Display Mode */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <span className="text-[10px] text-slate-400 px-2 font-mono">표기법:</span>
            <button
              onClick={() => setAddressDisplay('hex')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition ${
                addressDisplay === 'hex' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              HEX (16진수)
            </button>
            <button
              onClick={() => setAddressDisplay('dec')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition ${
                addressDisplay === 'dec' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              DEC (바이트)
            </button>
            <button
              onClick={() => setAddressDisplay('word')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition ${
                addressDisplay === 'word' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Word (16-Bit)
            </button>
          </div>
        </div>
      </div>

      {/* Real-Time Health & Collision Status Bar */}
      <div className={`p-4.5 rounded-2xl border transition-all ${
        simResults.isStackHeapCollision
          ? 'bg-rose-950/60 border-rose-500 shadow-xl shadow-rose-900/30 ring-1 ring-rose-500'
          : simResults.isSramWarning || simResults.flashOverflow || simResults.isEepromOverflow
          ? 'bg-amber-950/60 border-amber-500 shadow-xl shadow-amber-900/20'
          : 'bg-emerald-950/40 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              simResults.isStackHeapCollision
                ? 'bg-rose-500 text-white animate-bounce'
                : simResults.isSramWarning || simResults.flashOverflow || simResults.isEepromOverflow
                ? 'bg-amber-500 text-slate-950'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {simResults.isStackHeapCollision ? (
                <Flame className="w-5 h-5" />
              ) : simResults.isSramWarning || simResults.flashOverflow || simResults.isEepromOverflow ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-black uppercase tracking-wider ${
                  simResults.isStackHeapCollision
                    ? 'text-rose-300'
                    : simResults.isSramWarning || simResults.flashOverflow || simResults.isEepromOverflow
                    ? 'text-amber-300'
                    : 'text-emerald-300'
                }`}>
                  {simResults.isStackHeapCollision && '치명적 위험: 스택-힙 충돌 발생 (Stack-Heap Collision!)'}
                  {!simResults.isStackHeapCollision && simResults.isSramWarning && '경고: SRAM 안전 여유 마진 임계치 근접 (< 128 Bytes)'}
                  {!simResults.isStackHeapCollision && !simResults.isSramWarning && simResults.flashOverflow && '오류: 플래시 ROM 용량 초과 (Flash Overflow)'}
                  {!simResults.isStackHeapCollision && !simResults.isSramWarning && !simResults.flashOverflow && simResults.isEepromOverflow && '경고: EEPROM 할당 용량 초과 (Wrap-around 위험)'}
                  {!simResults.isStackHeapCollision && !simResults.isSramWarning && !simResults.flashOverflow && !simResults.isEepromOverflow && '정상: 모든 메모리 공간이 안정적인 안전 마진을 유지하고 있습니다'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                {simResults.isStackHeapCollision
                  ? `하향 성장하는 스택 포인터(SP: ${fmtAddr(simResults.stackCurrentSP)})가 상향 성장하는 힙 상한선(__brkval: ${fmtAddr(simResults.heapEnd)})을 침범했습니다! 실제 기기에서는 함수 리턴 번지가 파괴되어 무한 재부팅(Watchdog reset) 또는 알 수 없는 메모리 변조 버그가 발생합니다.`
                  : simResults.isSramWarning
                  ? `현재 남은 SRAM 안전 마진은 ${simResults.freeSramMargin}바이트에 불과합니다. ISR(인터럽트) 발생 시 레지스터 32개가 스택에 푸시되면 즉시 스택 오버플로우가 유발될 수 있습니다.`
                  : simResults.flashOverflow
                  ? `프로그램 크기가 ${currentProfile.name}의 물리적 플래시 크기(${currentProfile.flash} KB)를 초과하여 컴파일러 링킹이 거부됩니다.`
                  : `Flash 잔여: ${(simResults.flashRemaining / 1024).toFixed(1)} KB • SRAM 안전 마진: ${simResults.freeSramMargin} Bytes • EEPROM 잔여: ${simResults.eepromRemaining} Bytes`}
              </p>
            </div>
          </div>

          {/* Quick Metrics Badge */}
          <div className="flex items-center gap-3 shrink-0 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800 text-xs font-mono">
            <div className="text-center">
              <span className="text-[10px] text-slate-400 block">SRAM 마진</span>
              <span className={`font-bold ${simResults.freeSramMargin <= 0 ? 'text-rose-400' : simResults.freeSramMargin < 128 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {simResults.freeSramMargin} B
              </span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div className="text-center">
              <span className="text-[10px] text-slate-400 block">Flash 점유율</span>
              <span className="font-bold text-sky-400">{simResults.flashUsagePct}%</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div className="text-center">
              <span className="text-[10px] text-slate-400 block">SRAM 점유율</span>
              <span className={`font-bold ${simResults.sramUsagePct >= 95 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {simResults.sramUsagePct}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Memory Allocation Debugger Sliders */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white">
              가상 펌웨어 메모리 할당 시뮬레이터 (Allocation Sandbox)
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">
            슬라이더를 조절하여 코드 크기나 변수 할당 시 메모리 맵과 충돌 상태 변화를 실시간 관찰하세요.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {/* Flash Code Size */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-sky-400" />
                플래시 코드 크기 (.text):
              </span>
              <span className="text-sky-400 font-bold">{simFlashCodeKB.toFixed(1)} KB</span>
            </div>
            <input
              type="range"
              min={1}
              max={currentProfile.flash}
              step={0.5}
              value={simFlashCodeKB}
              onChange={(e) => setSimFlashCodeKB(parseFloat(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1 KB</span>
              <span>최대 {currentProfile.flash} KB</span>
            </div>
          </div>

          {/* PROGMEM Strings */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-purple-400" />
                PROGMEM / 상수 (.rodata):
              </span>
              <span className="text-purple-400 font-bold">{simProgmemKB.toFixed(1)} KB</span>
            </div>
            <input
              type="range"
              min={0}
              max={currentProfile.flash / 2}
              step={0.5}
              value={simProgmemKB}
              onChange={(e) => setSimProgmemKB(parseFloat(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 KB</span>
              <span>{(currentProfile.flash / 2).toFixed(0)} KB</span>
            </div>
          </div>

          {/* Static Data (.data + .bss) */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                전역/정적 변수 (.data + .bss):
              </span>
              <span className="text-blue-400 font-bold">{simStaticDataBytes} B</span>
            </div>
            <input
              type="range"
              min={64}
              max={hardwareSpecs.sramBytes - 256}
              step={32}
              value={simStaticDataBytes}
              onChange={(e) => setSimStaticDataBytes(parseInt(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>64 B</span>
              <span>{hardwareSpecs.sramBytes - 256} B</span>
            </div>
          </div>

          {/* Dynamic Heap (malloc) */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                동적 힙 할당 (malloc / new):
              </span>
              <span className="text-amber-400 font-bold">{simHeapBytes} B</span>
            </div>
            <input
              type="range"
              min={0}
              max={hardwareSpecs.sramBytes - 512}
              step={32}
              value={simHeapBytes}
              onChange={(e) => setSimHeapBytes(parseInt(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 B</span>
              <span>{hardwareSpecs.sramBytes - 512} B</span>
            </div>
          </div>

          {/* Call Stack Depth */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-pink-400" />
                스택 깊이 & 로컬 변수 (Stack):
              </span>
              <span className="text-pink-400 font-bold">{simStackDepthBytes} B</span>
            </div>
            <input
              type="range"
              min={64}
              max={hardwareSpecs.sramBytes - 256}
              step={32}
              value={simStackDepthBytes}
              onChange={(e) => setSimStackDepthBytes(parseInt(e.target.value))}
              className="w-full accent-pink-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>64 B (얕음)</span>
              <span>{hardwareSpecs.sramBytes - 256} B (과도)</span>
            </div>
          </div>

          {/* EEPROM Usage */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                EEPROM 저장 데이터:
              </span>
              <span className="text-emerald-400 font-bold">{simEepromBytes} B</span>
            </div>
            <input
              type="range"
              min={0}
              max={hardwareSpecs.eepromBytes + 256}
              step={32}
              value={simEepromBytes}
              onChange={(e) => setSimEepromBytes(parseInt(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 B</span>
              <span>{hardwareSpecs.eepromBytes} B ({currentProfile.eeprom}KB)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation for Address Spaces */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>전체 3대 메모리 공간 종합 뷰</span>
          </button>
          <button
            onClick={() => setActiveTab('program')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'program'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>프로그램 플래시 (Program Flash: {currentProfile.flash} KB)</span>
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'data'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>데이터 메모리 & SRAM (Data: {currentProfile.sram} KB)</span>
          </button>
          <button
            onClick={() => setActiveTab('eeprom')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'eeprom'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>비휘발성 EEPROM (EEPROM: {currentProfile.eeprom} KB)</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
          💡 임의의 메모리 블록을 클릭하면 주소 매핑 및 세부 가이드가 열립니다.
        </span>
      </div>

      {/* Visual Memory Blocks Layout */}
      <div className="space-y-6">
        {/* 1. Program Flash Space */}
        {(activeTab === 'all' || activeTab === 'program') && (
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-sky-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  1. 프로그램 플래시 메모리 공간 (Program Flash ROM Space)
                </h4>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-slate-400">
                  주소 범위: <strong className="text-sky-300">{fmtAddr(0, true)}</strong> ~ <strong className="text-sky-300">{fmtAddr(hardwareSpecs.flashBytes - 1, true)}</strong>
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">
                  총 용량: <strong className="text-white">{currentProfile.flash} KB</strong> ({hardwareSpecs.flashBytes.toLocaleString()} Bytes)
                </span>
              </div>
            </div>

            {/* Stacked Memory Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>0x0000 (IVT 리셋 번지)</span>
                <span>용량 점유: {simResults.flashUsagePct}% (잔여: {(simResults.flashRemaining / 1024).toFixed(1)} KB)</span>
                <span>{fmtAddr(hardwareSpecs.flashBytes - 1, true)} (최상위 번지)</span>
              </div>

              <div className="h-10 w-full bg-slate-900 rounded-xl overflow-hidden p-1 flex gap-1 border border-slate-800">
                {programSegments.map((seg) => {
                  const widthPct = Math.max(2, (seg.sizeBytes / hardwareSpecs.flashBytes) * 100);
                  const isSelected = selectedSegment?.id === seg.id;
                  return (
                    <button
                      key={seg.id}
                      onClick={() => setSelectedSegment(seg)}
                      title={`${seg.nameKo} (${seg.startAddrHex} ~ ${seg.endAddrHex})`}
                      style={{ width: `${widthPct}%`, backgroundColor: seg.color }}
                      className={`h-full rounded-lg transition-all relative group flex items-center justify-center overflow-hidden hover:opacity-90 ${
                        isSelected ? 'ring-2 ring-white scale-y-105 z-10 shadow-lg' : 'opacity-85'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-slate-950 font-mono truncate px-1 drop-shadow-sm">
                        {seg.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Program Segments Quick Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
              {programSegments.map((seg) => {
                const isSelected = selectedSegment?.id === seg.id;
                return (
                  <div
                    key={seg.id}
                    onClick={() => setSelectedSegment(seg)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? `${seg.bgClass} ${seg.borderClass} ring-1 ring-white/30 shadow-md`
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-xs font-bold truncate ${seg.textColor}`}>{seg.category}</span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">{seg.sizeFormatted}</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      <span>{seg.startAddrHex}</span>
                      <span>➔</span>
                      <span>{seg.endAddrHex}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Data Memory & SRAM Space */}
        {(activeTab === 'all' || activeTab === 'data') && (
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  2. 데이터 메모리 & SRAM 공간 (Data Memory & Internal SRAM)
                </h4>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-slate-400">
                  레지스터+I/O+SRAM: <strong className="text-indigo-300">{fmtAddr(0x0000)}</strong> ~ <strong className="text-indigo-300">{fmtAddr(hardwareSpecs.ramEnd)}</strong>
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">
                  내부 SRAM: <strong className="text-white">{currentProfile.sram} KB</strong> (0x{hardwareSpecs.sramStartAddr.toString(16).toUpperCase()} ~ 0x{hardwareSpecs.ramEnd.toString(16).toUpperCase()})
                </span>
              </div>
            </div>

            {/* Stacked Data Memory Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>0x0000 (R0 범용 레지스터)</span>
                <span className={simResults.freeSramMargin <= 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {simResults.freeSramMargin <= 0 ? '⚠️ 충돌 발생 (Collision)' : `SRAM 여유 마진: ${simResults.freeSramMargin} B`}
                </span>
                <span>{fmtAddr(hardwareSpecs.ramEnd)} (RAMEND 스택 시작)</span>
              </div>

              <div className="h-10 w-full bg-slate-900 rounded-xl overflow-hidden p-1 flex gap-1 border border-slate-800">
                {dataSegments.map((seg) => {
                  const totalDataSpan = hardwareSpecs.ramEnd + 1;
                  const widthPct = Math.max(2, (seg.sizeBytes / totalDataSpan) * 100);
                  const isSelected = selectedSegment?.id === seg.id;
                  return (
                    <button
                      key={seg.id}
                      onClick={() => setSelectedSegment(seg)}
                      title={`${seg.nameKo} (${seg.startAddrHex} ~ ${seg.endAddrHex})`}
                      style={{ width: `${widthPct}%`, backgroundColor: seg.color }}
                      className={`h-full rounded-lg transition-all relative group flex items-center justify-center overflow-hidden hover:opacity-90 ${
                        isSelected ? 'ring-2 ring-white scale-y-105 z-10 shadow-lg' : 'opacity-85'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-slate-950 font-mono truncate px-1 drop-shadow-sm">
                        {seg.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Data Segments Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
              {dataSegments.map((seg) => {
                const isSelected = selectedSegment?.id === seg.id;
                return (
                  <div
                    key={seg.id}
                    onClick={() => setSelectedSegment(seg)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? `${seg.bgClass} ${seg.borderClass} ring-1 ring-white/30 shadow-md`
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-xs font-bold truncate ${seg.textColor}`}>{seg.category}</span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">{seg.sizeFormatted}</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      <span>{seg.startAddrHex}</span>
                      <span>➔</span>
                      <span>{seg.endAddrHex}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Non-Volatile EEPROM Space */}
        {(activeTab === 'all' || activeTab === 'eeprom') && (
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  3. 비휘발성 EEPROM 주소 공간 (EEPROM Space)
                </h4>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-slate-400">
                  주소 범위: <strong className="text-emerald-300">{fmtAddr(0x0000)}</strong> ~ <strong className="text-emerald-300">{fmtAddr(hardwareSpecs.eepromBytes - 1)}</strong>
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">
                  용량: <strong className="text-white">{currentProfile.eeprom} KB</strong> ({hardwareSpecs.eepromBytes.toLocaleString()} Bytes)
                </span>
              </div>
            </div>

            {/* Stacked EEPROM Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>0x0000 (설정 레코드 시작 번지)</span>
                <span>용량 점유: {simResults.eepromUsagePct}% (잔여: {simResults.eepromRemaining} Bytes)</span>
                <span>{fmtAddr(hardwareSpecs.eepromBytes - 1)} (EEPROM 끝 E2END)</span>
              </div>

              <div className="h-10 w-full bg-slate-900 rounded-xl overflow-hidden p-1 flex gap-1 border border-slate-800">
                {eepromSegments.map((seg) => {
                  const widthPct = Math.max(3, (seg.sizeBytes / hardwareSpecs.eepromBytes) * 100);
                  const isSelected = selectedSegment?.id === seg.id;
                  return (
                    <button
                      key={seg.id}
                      onClick={() => setSelectedSegment(seg)}
                      title={`${seg.nameKo} (${seg.startAddrHex} ~ ${seg.endAddrHex})`}
                      style={{ width: `${widthPct}%`, backgroundColor: seg.color }}
                      className={`h-full rounded-lg transition-all relative group flex items-center justify-center overflow-hidden hover:opacity-90 ${
                        isSelected ? 'ring-2 ring-white scale-y-105 z-10 shadow-lg' : 'opacity-85'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-slate-950 font-mono truncate px-1 drop-shadow-sm">
                        {seg.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* EEPROM Segments Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {eepromSegments.map((seg) => {
                const isSelected = selectedSegment?.id === seg.id;
                return (
                  <div
                    key={seg.id}
                    onClick={() => setSelectedSegment(seg)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? `${seg.bgClass} ${seg.borderClass} ring-1 ring-white/30 shadow-md`
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-xs font-bold truncate ${seg.textColor}`}>{seg.category}</span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">{seg.sizeFormatted}</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      <span>{seg.startAddrHex}</span>
                      <span>➔</span>
                      <span>{seg.endAddrHex}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected Segment Detail Drawer */}
      {selectedSegment && (
        <div className={`p-5 rounded-2xl border transition-all ${selectedSegment.bgClass} ${selectedSegment.borderClass} shadow-xl space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div
                className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: selectedSegment.color }}
              />
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{selectedSegment.nameKo}</span>
                  <span className="text-xs font-normal text-slate-400">({selectedSegment.name})</span>
                </h4>
                <div className="text-[11px] font-mono text-slate-300 mt-0.5">
                  구역: <strong className="text-white">{selectedSegment.space} Space</strong> • 링커 섹션: <code className="text-amber-300">{selectedSegment.linkerSection}</code>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedSegment(null)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-black/30 border border-white/10"
            >
              닫기 ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] text-slate-400 block font-mono">시작 주소 ~ 종료 주소</span>
              <span className="font-mono font-bold text-amber-300">{selectedSegment.startAddrHex} ~ {selectedSegment.endAddrHex}</span>
            </div>
            <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] text-slate-400 block font-mono">할당 크기 (Byte / KB)</span>
              <span className="font-mono font-bold text-white">{selectedSegment.sizeFormatted} ({selectedSegment.sizeBytes.toLocaleString()} B)</span>
            </div>
            <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] text-slate-400 block font-mono">CPU 접근 모드 (명령어)</span>
              <span className="font-mono font-bold text-cyan-300 truncate block">{selectedSegment.accessMode}</span>
            </div>
            <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] text-slate-400 block font-mono">실행 레이턴시 (Cycles)</span>
              <span className="font-mono font-bold text-emerald-300">{selectedSegment.cycles}</span>
            </div>
          </div>

          <p className="text-xs text-slate-200 leading-relaxed">
            {selectedSegment.description}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 space-y-1">
              <div className="font-bold text-rose-300 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>오버플로우 및 메모리 누수 위험:</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {selectedSegment.overflowRisk}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 space-y-1">
              <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>펌웨어 엔지니어 디버깅 가이드:</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {selectedSegment.debugAdvice}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Embedded C/C++ Debugging Code Recipes */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white">
              실전 펌웨어 메모리 디버깅 C 소스 코드 템플릿
            </h4>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            avr-libc • PROGMEM • Runtime Free RAM Probe
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recipe 1: Free RAM Probe */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  1. 실시간 잔여 SRAM 측정 함수
                </span>
                <button
                  onClick={() => handleCopyCode('freeRam', codeSnippets.freeRamCode)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="코드 복사"
                >
                  {copiedCodeId === 'freeRam' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                현재 스택 포인터(SP)와 힙 최상위 번지(`__brkval`) 사이의 안전 거리를 실시간 반환하여 스택 오버플로우를 감지합니다.
              </p>
            </div>
            <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[10px] text-emerald-300 overflow-x-auto max-h-40 leading-relaxed">
              {codeSnippets.freeRamCode}
            </pre>
          </div>

          {/* Recipe 2: PROGMEM String Optimization */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  2. PROGMEM 플래시 상수 이전 기법
                </span>
                <button
                  onClick={() => handleCopyCode('progmem', codeSnippets.progmemCode)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="코드 복사"
                >
                  {copiedCodeId === 'progmem' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                문자열 상수를 SRAM이 아닌 플래시 ROM에 영구 상주시켜 소중한 내부 SRAM을 절약하는 표준 C 매크로입니다.
              </p>
            </div>
            <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[10px] text-sky-300 overflow-x-auto max-h-40 leading-relaxed">
              {codeSnippets.progmemCode}
            </pre>
          </div>

          {/* Recipe 3: Safe EEPROM Access */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5" />
                  3. EEPROM 경계 검사 & 마모 방지
                </span>
                <button
                  onClick={() => handleCopyCode('eeprom', codeSnippets.eepromSafeCode)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="코드 복사"
                >
                  {copiedCodeId === 'eeprom' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                `E2END`를 초과하는 오버플로우를 사전에 차단하고 `eeprom_update_block`으로 실리콘 마모를 최소화합니다.
              </p>
            </div>
            <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[10px] text-amber-300 overflow-x-auto max-h-40 leading-relaxed">
              {codeSnippets.eepromSafeCode}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
