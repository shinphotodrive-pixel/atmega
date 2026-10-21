import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Layers,
  HardDrive,
  Database,
  Cpu,
  Info,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Code2,
  Copy,
  Check,
  Sparkles,
  HelpCircle,
  Eye,
  FileCode2,
  ShieldAlert
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type MemoryDomain = 'all' | 'flash' | 'sram';

export interface MemoryRangeItem {
  id: string;
  name: string;
  domain: 'flash' | 'sram';
  category: 'vector' | 'text' | 'rodata' | 'data_lma' | 'boot' | 'free_flash' | 'reg' | 'io' | 'ext_io' | 'data_vma' | 'bss' | 'heap' | 'free_sram' | 'stack';
  startAddr: number;
  endAddr: number;
  sizeBytes: number;
  color: string;
  textColor: string;
  borderColor: string;
  linkerSection: string;
  description: string;
  cExample: string;
  hardwareNotes: string;
}

export interface MemoryPreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  textSize: number;
  rodataSize: number;
  dataSize: number;
  bssSize: number;
  heapSize: number;
  stackSize: number;
  bootSize: number;
}

export const MemoryMapExplorer: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Active view domain
  const [activeDomain, setActiveDomain] = useState<MemoryDomain>('all');

  // Interactive firmware sizing simulation
  const [textSize, setTextSize] = useState<number>(() => {
    return selectedMCU === 'atmega328p' ? 8400 : selectedMCU === 'atmega128' ? 24500 : 16800;
  });
  const [rodataSize, setRodataSize] = useState<number>(() => {
    return selectedMCU === 'atmega328p' ? 1200 : selectedMCU === 'atmega128' ? 4200 : 2500;
  });
  const [dataSize, setDataSize] = useState<number>(() => {
    return selectedMCU === 'atmega328p' ? 256 : selectedMCU === 'atmega128' ? 640 : 512;
  });
  const [bssSize, setBssSize] = useState<number>(() => {
    return selectedMCU === 'atmega328p' ? 512 : selectedMCU === 'atmega128' ? 1280 : 2048;
  });
  const [heapSize, setHeapSize] = useState<number>(128);
  const [stackSize, setStackSize] = useState<number>(() => {
    return selectedMCU === 'atmega328p' ? 256 : 512;
  });
  const [bootSize, setBootSize] = useState<number>(() => {
    return selectedMCU === 'atmega328p' ? 512 : 2048;
  });

  // Selected or hovered segment
  const [hoveredRange, setHoveredRange] = useState<MemoryRangeItem | null>(null);
  const [selectedRange, setSelectedRange] = useState<MemoryRangeItem | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Hardware boundaries
  const totalFlashBytes = currentProfile.flash * 1024;
  const totalSramBytes = currentProfile.sram * 1024;

  const sramBaseAddr = selectedMCU === 'atmega640' ? 0x0200 : 0x0100;
  const sramEndAddr = sramBaseAddr + totalSramBytes - 1;
  const flashEndAddr = totalFlashBytes - 1;

  // Interrupt Vector Table size
  const ivtSize = selectedMCU === 'atmega640' ? 228 : selectedMCU === 'atmega128' ? 140 : 104;

  // Dynamic Segment Layout Builder
  const memoryRanges = useMemo<{ flashRanges: MemoryRangeItem[]; sramRanges: MemoryRangeItem[] }>(() => {
    // --- 1. FLASH MEMORY LAYOUT ---
    const flashRanges: MemoryRangeItem[] = [];

    // [1] Interrupt Vector Table
    flashRanges.push({
      id: 'flash-ivt',
      name: '인터럽트 벡터 테이블 (IVT)',
      domain: 'flash',
      category: 'vector',
      startAddr: 0x0000,
      endAddr: ivtSize - 1,
      sizeBytes: ivtSize,
      color: '#F59E0B',
      textColor: '#78350F',
      borderColor: '#D97706',
      linkerSection: '.vectors',
      description: '하드웨어 리셋 및 인터럽트 발생 시 CPU가 점프할 ISR 핸들러 주소 테이블 (RESET, INT0, TIMER, USART, ADC 등)',
      cExample: 'ISR(TIMER1_COMPA_vect) { /* 이 인터럽트의 점프 벡터가 IVT에 배치됨 */ }',
      hardwareNotes: selectedMCU === 'atmega640'
        ? '57개 벡터 (각 4바이트 32비트 JMP 명령어, 총 228바이트)'
        : selectedMCU === 'atmega128'
        ? '35개 벡터 (각 4바이트 JMP 명령어, 총 140바이트)'
        : '26개 벡터 (각 4바이트 RJMP/JMP 명령어, 총 104바이트)'
    });

    // [2] .text Section (Executable Instructions)
    const textStart = ivtSize;
    const textEnd = textStart + textSize - 1;
    flashRanges.push({
      id: 'flash-text',
      name: '코드 세그먼트 (.text)',
      domain: 'flash',
      category: 'text',
      startAddr: textStart,
      endAddr: textEnd,
      sizeBytes: textSize,
      color: '#3B82F6',
      textColor: '#1E3A8A',
      borderColor: '#2563EB',
      linkerSection: '.text',
      description: '컴파일된 C/C++ 실행 머신 코드(함수 본체, 연산 루프, 라이브러리 드라이버 등)',
      cExample: 'void setup() {\n    pinMode(13, OUTPUT);\n    Serial.begin(115200);\n}',
      hardwareNotes: '하버드 아키텍처 특성상 명령 인출 버스를 통해 16/32비트 단위로 페치됩니다.'
    });

    // [3] .rodata / PROGMEM
    const rodataStart = textEnd + 1;
    const rodataEnd = rodataStart + rodataSize - 1;
    flashRanges.push({
      id: 'flash-rodata',
      name: '읽기 전용 상수 (.rodata / PROGMEM)',
      domain: 'flash',
      category: 'rodata',
      startAddr: rodataStart,
      endAddr: rodataEnd,
      sizeBytes: rodataSize,
      color: '#8B5CF6',
      textColor: '#4C1D95',
      borderColor: '#7C3AED',
      linkerSection: '.progmem.data / .rodata',
      description: 'Flash에 영구 보존되는 문자열 리터럴, 폰트 비트맵, 사인파 룩업 테이블 (SRAM 절약의 핵심)',
      cExample: 'const char splashMsg[] PROGMEM = "Welcome to AVR System";\n// pgm_read_byte(&splashMsg[i])로 읽음',
      hardwareNotes: 'SRAM 소진을 막기 위해 F() 매크로나 PROGMEM 지시어를 선언한 데이터가 여기에 배치됩니다.'
    });

    // [4] .data LMA (Flash Image for Initialized Globals)
    const dataLmaStart = rodataEnd + 1;
    const dataLmaEnd = dataLmaStart + dataSize - 1;
    flashRanges.push({
      id: 'flash-data-lma',
      name: '초기화 데이터 플래시 원본 (.data LMA)',
      domain: 'flash',
      category: 'data_lma',
      startAddr: dataLmaStart,
      endAddr: dataLmaEnd,
      sizeBytes: dataSize,
      color: '#EC4899',
      textColor: '#831843',
      borderColor: '#DB2777',
      linkerSection: '.data (Load Memory Address)',
      description: '초기값이 존재하는 전역/정적 변수의 초기값 복사본 (부팅 시 __do_copy_data 루틴이 SRAM으로 복사)',
      cExample: 'int baudRate = 115200; // 초기값 115200이 Flash LMA에 저장됨',
      hardwareNotes: '이 데이터는 Flash 용량과 SRAM 용량을 둘 다 동시에 소비합니다 (LMA in Flash, VMA in SRAM).'
    });

    // [5] Bootloader Section (At high flash memory)
    const bootStart = totalFlashBytes - bootSize;
    const bootEnd = totalFlashBytes - 1;

    // [6] Free Flash Headroom
    const freeFlashStart = dataLmaEnd + 1;
    const freeFlashEnd = bootStart - 1;
    const freeFlashSize = Math.max(0, freeFlashEnd - freeFlashStart + 1);

    if (freeFlashSize > 0) {
      flashRanges.push({
        id: 'flash-free',
        name: '가용 미할당 플래시 여유 공간 (Free Flash)',
        domain: 'flash',
        category: 'free_flash',
        startAddr: freeFlashStart,
        endAddr: freeFlashEnd,
        sizeBytes: freeFlashSize,
        color: '#1E293B',
        textColor: '#94A3B8',
        borderColor: '#334155',
        linkerSection: 'Unused Flash Headroom',
        description: '새로운 펌웨어 기능, 라이브러리 추가 및 OTA 업데이트를 수용할 수 있는 미사용 플래시 영역',
        cExample: '// 0xFF 상태의 빈 플래시 페이지',
        hardwareNotes: '부트로더 파티션 직전까지 애플리케이션 코드를 추가로 확장할 수 있습니다.'
      });
    }

    flashRanges.push({
      id: 'flash-boot',
      name: '부트로더 섹션 (Bootloader / BOOTSZ)',
      domain: 'flash',
      category: 'boot',
      startAddr: bootStart,
      endAddr: bootEnd,
      sizeBytes: bootSize,
      color: '#EF4444',
      textColor: '#7F1D1D',
      borderColor: '#DC2626',
      linkerSection: '.bootloader',
      description: 'ISP 장비 없이 시리얼 포트를 통해 플래시를 자가 프로그래밍(SPM)할 수 있는 부트로더 영역 (Optiboot/STK500)',
      cExample: 'BOOTRST 퓨즈가 프로그래밍되면 CPU 리셋 시 0x0000이 아닌 이 부트로더 시작 주소로 점프합니다.',
      hardwareNotes: `BOOTSZ 퓨즈 비트 설정에 따라 ${bootSize}바이트(0x${bootStart.toString(16).toUpperCase()})로 락 비트 보호가 적용됩니다.`
    });

    // --- 2. SRAM MEMORY LAYOUT ---
    const sramRanges: MemoryRangeItem[] = [];

    // [1] 32 General Purpose Registers
    sramRanges.push({
      id: 'sram-regs',
      name: '범용 작업 레지스터 (R0 ~ R31)',
      domain: 'sram',
      category: 'reg',
      startAddr: 0x0000,
      endAddr: 0x001F,
      sizeBytes: 32,
      color: '#F59E0B',
      textColor: '#78350F',
      borderColor: '#D97706',
      linkerSection: 'Hardware Register File',
      description: '단일 사이클 연산을 수행하는 32개 8비트 레지스터 (X=R27:R26, Y=R29:R28, Z=R31:R30 포인터 포함)',
      cExample: 'register uint8_t fastVar asm("r16"); // 고속 레지스터 변수',
      hardwareNotes: '산술/논리 연산이 1사이클 만에 처리되는 초고속 레지스터 파일입니다.'
    });

    // [2] Standard I/O Registers (64 bytes)
    sramRanges.push({
      id: 'sram-io',
      name: '표준 I/O 레지스터 (Standard I/O 64B)',
      domain: 'sram',
      category: 'io',
      startAddr: 0x0020,
      endAddr: 0x005F,
      sizeBytes: 64,
      color: '#10B981',
      textColor: '#064E3B',
      borderColor: '#059669',
      linkerSection: 'I/O Memory (0x00 ~ 0x3F)',
      description: '포트 입출력(PORTB, DDRB, PINB), 타이머 제어, 인터럽트 플래그, SREG 상태 레지스터',
      cExample: 'PORTB |= (1 << PB5); // in/out, sbi/cbi 단일 사이클 어셈블리로 직접 접근',
      hardwareNotes: '하드웨어 주변장치 제어용으로 in/out 명령어로 1클럭 내에 직접 액세스 가능합니다.'
    });

    // [3] Extended I/O Registers (if ATmega128 or ATmega640)
    const extIoEnd = sramBaseAddr - 1;
    if (extIoEnd >= 0x0060) {
      const extIoSize = extIoEnd - 0x0060 + 1;
      sramRanges.push({
        id: 'sram-ext-io',
        name: `확장 I/O 레지스터 (Ext I/O ${extIoSize}B)`,
        domain: 'sram',
        category: 'ext_io',
        startAddr: 0x0060,
        endAddr: extIoEnd,
        sizeBytes: extIoSize,
        color: '#14B8A6',
        textColor: '#134E4A',
        borderColor: '#0D9488',
        linkerSection: 'Extended I/O Space',
        description: '추가 USART(1~3), 16비트 타이머 3/4/5, 외부 메모리 컨트롤러 레지스터',
        cExample: 'UCSR1B = (1 << RXEN1); // lds/sts 명령어로 2사이클에 접근',
        hardwareNotes: 'I/O 영역이 64개를 초과하는 대규모 MCU를 위한 메모리 매핑 확장 공간입니다.'
      });
    }

    // [4] .data VMA (Initialized Globals in SRAM)
    const dataVmaStart = sramBaseAddr;
    const dataVmaEnd = dataVmaStart + dataSize - 1;
    sramRanges.push({
      id: 'sram-data-vma',
      name: '초기화된 전역/정적 변수 (.data VMA)',
      domain: 'sram',
      category: 'data_vma',
      startAddr: dataVmaStart,
      endAddr: dataVmaEnd,
      sizeBytes: dataSize,
      color: '#EC4899',
      textColor: '#831843',
      borderColor: '#DB2777',
      linkerSection: '.data (Virtual Memory Address)',
      description: 'C 런타임 시작 시 Flash LMA에서 초기값을 복사받아 런타임 동안 읽고 쓸 수 있는 전역 변수 공간',
      cExample: 'int packetCounter = 0; // 초기값을 가지는 전역 변수',
      hardwareNotes: 'RAM의 최하단에 정적으로 배치되어 전원이 꺼질 때까지 주소가 고정됩니다.'
    });

    // [5] .bss Section (Zero-Initialized Globals)
    const bssStart = dataVmaEnd + 1;
    const bssEnd = bssStart + bssSize - 1;
    sramRanges.push({
      id: 'sram-bss',
      name: '0 초기화 전역/정적 버퍼 (.bss)',
      domain: 'sram',
      category: 'bss',
      startAddr: bssStart,
      endAddr: bssEnd,
      sizeBytes: bssSize,
      color: '#3B82F6',
      textColor: '#1E3A8A',
      borderColor: '#2563EB',
      linkerSection: '.bss',
      description: '초기값이 0이거나 초기화되지 않은 전역 변수 및 고정 배열 버퍼 (__do_clear_bss에 의해 0 클리어)',
      cExample: 'uint8_t rxBuffer[256]; // 256바이트 시리얼 수신 링버퍼',
      hardwareNotes: 'Flash 용량을 차지하지 않고 SRAM 공간만 할당받으므로 대용량 버퍼에 유리합니다.'
    });

    // [6] Heap (malloc dynamic allocation)
    const heapStart = bssEnd + 1;
    const heapEnd = heapStart + heapSize - 1;
    sramRanges.push({
      id: 'sram-heap',
      name: '동적 할당 힙 (Heap / malloc)',
      domain: 'sram',
      category: 'heap',
      startAddr: heapStart,
      endAddr: heapEnd,
      sizeBytes: heapSize,
      color: '#8B5CF6',
      textColor: '#4C1D95',
      borderColor: '#7C3AED',
      linkerSection: 'Heap (__brkval)',
      description: 'malloc() / calloc() / new 연산자로 런타임에 동적으로 할당되는 가변 메모리 (상위 주소로 확장)',
      cExample: 'char *buf = (char *)malloc(64); // 힙 영역에서 64바이트 할당',
      hardwareNotes: '임베디드에서는 메모리 파편화 및 누수를 방지하기 위해 사용을 최소화하는 것이 정석입니다.'
    });

    // [7] Call Stack (grows downwards from RAMEND)
    const stackStart = sramEndAddr - stackSize + 1;
    const stackEnd = sramEndAddr;
    sramRanges.push({
      id: 'sram-stack',
      name: '호출 스택 (Call Stack / Locals / ISR)',
      domain: 'sram',
      category: 'stack',
      startAddr: stackStart,
      endAddr: stackEnd,
      sizeBytes: stackSize,
      color: '#06B6D4',
      textColor: '#164E63',
      borderColor: '#0891B2',
      linkerSection: 'Stack (SP -> RAMEND)',
      description: '함수 로컬 변수, 함수 복귀 주소(PC PUSH), 인터럽트 ISR 진입 시 레지스터 백업 공간 (하향 성장)',
      cExample: 'void process() {\n    uint8_t temp[16]; // 스택 프레임에 16바이트 할당\n}',
      hardwareNotes: `스택 포인터(SP)가 최상단 RAMEND(0x${stackEnd.toString(16).toUpperCase()})에서 시작하여 하위 주소로 자라납니다.`
    });

    // [8] Free SRAM Gap between Heap and Stack
    const freeSramStart = heapEnd + 1;
    const freeSramEnd = stackStart - 1;
    const freeSramSize = Math.max(0, freeSramEnd - freeSramStart + 1);

    if (freeSramSize > 0) {
      sramRanges.push({
        id: 'sram-free',
        name: '미할당 잔여 SRAM 안전 여유공간 (Free SRAM Margin)',
        domain: 'sram',
        category: 'free_sram',
        startAddr: freeSramStart,
        endAddr: freeSramEnd,
        sizeBytes: freeSramSize,
        color: '#1E293B',
        textColor: '#94A3B8',
        borderColor: '#334155',
        linkerSection: 'Stack-Heap Safety Gap',
        description: '스택(하향)과 힙(상향)이 충돌하지 않도록 지켜주는 완충 공간 (스택 오버플로우 방어벽)',
        cExample: 'int freeRam() {\n    extern int __heap_start, *__brkval;\n    int v;\n    return (int)&v - (__brkval == 0 ? (int)&__heap_start : (int)__brkval);\n}',
        hardwareNotes: '이 공간이 0으로 줄어들면 스택이 힙이나 전역 변수를 덮어써 시스템 리셋/패닉이 발생합니다!'
      });
    }

    return { flashRanges, sramRanges };
  }, [selectedMCU, totalFlashBytes, totalSramBytes, sramBaseAddr, sramEndAddr, ivtSize, textSize, rodataSize, dataSize, bssSize, heapSize, stackSize, bootSize]);

  // Presets
  const PRESETS: MemoryPreset[] = [
    {
      id: 'preset-blinky',
      name: '기본 블링크 / 센서 노드 (Minimal Blinky)',
      badge: '초경량',
      description: '최소한의 코드와 전역 변수만 사용하는 초경량 IoT 센서 펌웨어',
      textSize: selectedMCU === 'atmega328p' ? 2400 : 3800,
      rodataSize: 200,
      dataSize: 64,
      bssSize: 128,
      heapSize: 0,
      stackSize: 128,
      bootSize: selectedMCU === 'atmega328p' ? 512 : 1024
    },
    {
      id: 'preset-logger',
      name: '대용량 링버퍼 데이터 로거 (Serial & ADC RingBuffer)',
      badge: '대용량 RAM',
      description: 'UART 및 ADC 수신 패킷 링버퍼를 크게 할당하여 데이터 유실을 방지하는 구조',
      textSize: selectedMCU === 'atmega328p' ? 9500 : 18000,
      rodataSize: 1200,
      dataSize: 256,
      bssSize: selectedMCU === 'atmega328p' ? 1024 : 3072,
      heapSize: 64,
      stackSize: 256,
      bootSize: selectedMCU === 'atmega328p' ? 512 : 2048
    },
    {
      id: 'preset-ui',
      name: 'OLED/LCD 메뉴 그래픽 펌웨어 (Font Bitmaps)',
      badge: 'PROGMEM 최적화',
      description: '폰트와 그래픽 비트맵을 Flash(PROGMEM)에 대거 탑재하여 SRAM 고갈을 방지하는 구조',
      textSize: selectedMCU === 'atmega328p' ? 14000 : 38000,
      rodataSize: selectedMCU === 'atmega328p' ? 6000 : 16000,
      dataSize: 384,
      bssSize: 512,
      heapSize: 128,
      stackSize: 384,
      bootSize: selectedMCU === 'atmega328p' ? 512 : 2048
    }
  ];

  const applyPreset = (preset: MemoryPreset) => {
    setTextSize(preset.textSize);
    setRodataSize(preset.rodataSize);
    setDataSize(preset.dataSize);
    setBssSize(preset.bssSize);
    setHeapSize(preset.heapSize);
    setStackSize(preset.stackSize);
    setBootSize(preset.bootSize);
  };

  // Occupancy metrics
  const flashUsedBytes = ivtSize + textSize + rodataSize + dataSize + bootSize;
  const flashUsedPercent = Math.min(100, +((flashUsedBytes / totalFlashBytes) * 100).toFixed(1));
  const sramUsedBytes = dataSize + bssSize + heapSize + stackSize;
  const sramUsedPercent = Math.min(100, +((sramUsedBytes / totalSramBytes) * 100).toFixed(1));

  const activeRange = hoveredRange || selectedRange || memoryRanges.flashRanges[1];

  const handleCopyAddr = (range: MemoryRangeItem) => {
    const text = `[${range.name}]\nAddress: 0x${range.startAddr.toString(16).toUpperCase()} ~ 0x${range.endAddr.toString(16).toUpperCase()} (${range.sizeBytes} Bytes)\nLinker Section: ${range.linkerSection}\nPurpose: ${range.description}`;
    navigator.clipboard.writeText(text);
    setCopiedText(range.id);
    confetti({ particleCount: 20, spread: 40, origin: { y: 0.3 } });
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
            <Layers className="w-3.5 h-3.5" /> Interactive Memory Map & Linker Segment Explorer
          </div>
          <h3 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Memory Map Explorer (Flash vs SRAM 메모리 맵 탐색기)</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            <strong>{currentProfile.name}</strong>의 <strong>플래시 롬(Flash ROM)</strong>과 <strong>SRAM(내부 데이터 메모리)</strong>의
            물리적 주소 배치(Vector Table, .text, .data, .bss, Heap, Stack)를 동적으로 시각화하고, 주소 영역 호버 시 용도와 C 언어 선언 예시를 확인하세요.
          </p>
        </div>

        {/* View Domain Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveDomain('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeDomain === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Flash & SRAM 전체
          </button>
          <button
            onClick={() => setActiveDomain('flash')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeDomain === 'flash'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Flash ROM ({currentProfile.flash}KB)
          </button>
          <button
            onClick={() => setActiveDomain('sram')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeDomain === 'sram'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            SRAM ({currentProfile.sram}KB)
          </button>
        </div>
      </div>

      {/* Preset Scenarios Strip */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 시뮬레이션 프리셋 시나리오:
          </span>
          <span className="text-[11px] text-slate-500">클릭 시 각 펌웨어 유형의 전형적인 메모리 점유 구조가 자동 반영됩니다</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/90 text-left transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-200 group-hover:text-amber-300">
                  {preset.name}
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-800">
                  {preset.badge}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                {preset.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Overview Occupancy Meter Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Flash ROM Occupancy */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-cyan-400" /> Flash ROM 점유율:
            </span>
            <div className="font-mono text-xs">
              <span className="text-cyan-400 font-bold">{(flashUsedBytes / 1024).toFixed(2)} KB</span>
              <span className="text-slate-500"> / {currentProfile.flash} KB ({flashUsedPercent}%)</span>
            </div>
          </div>
          <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${Math.min(100, (ivtSize / totalFlashBytes) * 100)}%` }}
              className="bg-amber-500 h-full"
              title="IVT"
            />
            <div
              style={{ width: `${Math.min(100, (textSize / totalFlashBytes) * 100)}%` }}
              className="bg-blue-500 h-full"
              title=".text"
            />
            <div
              style={{ width: `${Math.min(100, (rodataSize / totalFlashBytes) * 100)}%` }}
              className="bg-purple-500 h-full"
              title=".rodata"
            />
            <div
              style={{ width: `${Math.min(100, (dataSize / totalFlashBytes) * 100)}%` }}
              className="bg-pink-500 h-full"
              title=".data LMA"
            />
            <div
              style={{ width: `${Math.min(100, ((totalFlashBytes - flashUsedBytes) / totalFlashBytes) * 100)}%` }}
              className="bg-slate-800 h-full"
              title="Free"
            />
            <div
              style={{ width: `${Math.min(100, (bootSize / totalFlashBytes) * 100)}%` }}
              className="bg-rose-500 h-full"
              title="Bootloader"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>0x0000 (IVT)</span>
            <span>여유 공간: {((totalFlashBytes - flashUsedBytes) / 1024).toFixed(2)} KB</span>
            <span>0x{flashEndAddr.toString(16).toUpperCase()} (BOOTSZ)</span>
          </div>
        </div>

        {/* SRAM Occupancy */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Database className="w-4 h-4 text-emerald-400" /> SRAM 내부 램 점유율:
            </span>
            <div className="font-mono text-xs">
              <span className="text-emerald-400 font-bold">{sramUsedBytes} Bytes</span>
              <span className="text-slate-500"> / {totalSramBytes} Bytes ({sramUsedPercent}%)</span>
            </div>
          </div>
          <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${Math.min(100, (dataSize / totalSramBytes) * 100)}%` }}
              className="bg-pink-500 h-full"
              title=".data VMA"
            />
            <div
              style={{ width: `${Math.min(100, (bssSize / totalSramBytes) * 100)}%` }}
              className="bg-blue-500 h-full"
              title=".bss"
            />
            <div
              style={{ width: `${Math.min(100, (heapSize / totalSramBytes) * 100)}%` }}
              className="bg-purple-500 h-full"
              title="Heap"
            />
            <div
              style={{ width: `${Math.min(100, ((totalSramBytes - sramUsedBytes) / totalSramBytes) * 100)}%` }}
              className="bg-slate-800 h-full"
              title="Free Stack Gap"
            />
            <div
              style={{ width: `${Math.min(100, (stackSize / totalSramBytes) * 100)}%` }}
              className="bg-cyan-500 h-full"
              title="Call Stack"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>0x{sramBaseAddr.toString(16).toUpperCase()} (.data)</span>
            <span>안전 버퍼: {totalSramBytes - sramUsedBytes} Bytes</span>
            <span>0x{sramEndAddr.toString(16).toUpperCase()} (RAMEND)</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Memory Map Layout (Dual Column: Flash Stack vs SRAM Stack) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Flash ROM Layout Column (3 or 6 cols) */}
        {(activeDomain === 'all' || activeDomain === 'flash') && (
          <div className={activeDomain === 'all' ? 'lg:col-span-4 space-y-3' : 'lg:col-span-6 space-y-3'}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <HardDrive className="w-4 h-4" /> Flash ROM (0x0000 ~ 0x{flashEndAddr.toString(16).toUpperCase()})
              </span>
              <span className="text-[11px] font-mono text-slate-400">{currentProfile.flash} KB</span>
            </div>

            <div className="space-y-1.5">
              {memoryRanges.flashRanges.map((range) => {
                const isHovered = hoveredRange?.id === range.id;
                const isSelected = selectedRange?.id === range.id;
                const isFree = range.category === 'free_flash';

                return (
                  <div
                    key={range.id}
                    onMouseEnter={() => setHoveredRange(range)}
                    onMouseLeave={() => setHoveredRange(null)}
                    onClick={() => setSelectedRange(range)}
                    style={{
                      borderLeftColor: range.color,
                      borderLeftWidth: '4px'
                    }}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected || isHovered
                        ? 'bg-slate-800/90 border-slate-600 shadow-lg scale-[1.01]'
                        : isFree
                        ? 'bg-slate-950/40 border-dashed border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: range.color }}
                        />
                        <span className="text-xs font-bold text-white font-mono">
                          {range.name.split(' (')[0]}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 font-bold">
                        {range.sizeBytes >= 1024
                          ? `${(range.sizeBytes / 1024).toFixed(1)} KB`
                          : `${range.sizeBytes} B`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-slate-500">
                      <span>0x{range.startAddr.toString(16).padStart(4, '0').toUpperCase()} ~ 0x{range.endAddr.toString(16).padStart(4, '0').toUpperCase()}</span>
                      <span className="text-slate-400">{range.linkerSection}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SRAM Layout Column (3 or 6 cols) */}
        {(activeDomain === 'all' || activeDomain === 'sram') && (
          <div className={activeDomain === 'all' ? 'lg:col-span-4 space-y-3' : 'lg:col-span-6 space-y-3'}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-4 h-4" /> Data Space (0x0000 ~ 0x{sramEndAddr.toString(16).toUpperCase()})
              </span>
              <span className="text-[11px] font-mono text-slate-400">{currentProfile.sram} KB SRAM</span>
            </div>

            <div className="space-y-1.5">
              {memoryRanges.sramRanges.map((range) => {
                const isHovered = hoveredRange?.id === range.id;
                const isSelected = selectedRange?.id === range.id;
                const isFree = range.category === 'free_sram';

                return (
                  <div
                    key={range.id}
                    onMouseEnter={() => setHoveredRange(range)}
                    onMouseLeave={() => setHoveredRange(null)}
                    onClick={() => setSelectedRange(range)}
                    style={{
                      borderLeftColor: range.color,
                      borderLeftWidth: '4px'
                    }}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected || isHovered
                        ? 'bg-slate-800/90 border-slate-600 shadow-lg scale-[1.01]'
                        : isFree
                        ? 'bg-slate-950/40 border-dashed border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: range.color }}
                        />
                        <span className="text-xs font-bold text-white font-mono">
                          {range.name.split(' (')[0]}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 font-bold">
                        {range.sizeBytes >= 1024
                          ? `${(range.sizeBytes / 1024).toFixed(1)} KB`
                          : `${range.sizeBytes} B`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-slate-500">
                      <span>0x{range.startAddr.toString(16).padStart(4, '0').toUpperCase()} ~ 0x{range.endAddr.toString(16).padStart(4, '0').toUpperCase()}</span>
                      <span className="text-slate-400">{range.linkerSection}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Detail Inspector Card (4 or 6 cols) */}
        <div className={activeDomain === 'all' ? 'lg:col-span-4 space-y-4' : 'lg:col-span-6 space-y-4'}>
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full inline-block shrink-0 shadow-sm"
                  style={{ backgroundColor: activeRange.color }}
                />
                <div>
                  <h4 className="text-sm font-bold text-white font-mono">
                    {activeRange.name}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    링커 섹션: <strong className="text-amber-400">{activeRange.linkerSection}</strong>
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleCopyAddr(activeRange)}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors border border-slate-800 flex items-center gap-1"
                title="주소 및 설명 정보 복사"
              >
                {copiedText === activeRange.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText === activeRange.id ? '복사됨!' : '정보 복사'}</span>
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">시작 ~ 종료 주소</span>
                <span className="text-white font-bold">
                  0x{activeRange.startAddr.toString(16).padStart(4, '0').toUpperCase()} ~ 0x{activeRange.endAddr.toString(16).padStart(4, '0').toUpperCase()}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">할당 크기 (Byte / KB)</span>
                <span className="text-amber-400 font-bold">
                  {activeRange.sizeBytes.toLocaleString()} B ({+(activeRange.sizeBytes / 1024).toFixed(2)} KB)
                </span>
              </div>
            </div>

            {/* Purpose & Description */}
            <div className="space-y-1 text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-cyan-400" /> 역할 및 상세 용도:
              </span>
              <p className="text-slate-400 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                {activeRange.description}
              </p>
            </div>

            {/* C Source Declaration Example */}
            <div className="space-y-1 text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1">
                <Code2 className="w-3.5 h-3.5 text-emerald-400" /> C 언어 변수/함수 선언 예시:
              </span>
              <pre className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-emerald-300 font-mono text-[11px] overflow-x-auto leading-relaxed">
                <code>{activeRange.cExample}</code>
              </pre>
            </div>

            {/* Hardware Notes & Warnings */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <strong className="text-amber-400 block font-sans font-semibold">
                하드웨어 아키텍처 특성:
              </strong>
              <p className="leading-relaxed">{activeRange.hardwareNotes}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Sizing Sliders Drawer */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              동적 메모리 할당 시뮬레이터 (펌웨어 섹션 크기 조절)
            </h4>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            슬라이더를 움직여 실제 코드/버퍼 증가에 따른 메모리 맵 변화를 관찰하세요
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Text Size */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">코드 크기 (.text):</span>
              <span className="font-mono font-bold text-cyan-400">{(textSize / 1024).toFixed(1)} KB</span>
            </div>
            <input
              type="range"
              min={1000}
              max={totalFlashBytes * 0.85}
              step={500}
              value={textSize}
              onChange={(e) => setTextSize(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          {/* Rodata Size */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">상수/PROGMEM (.rodata):</span>
              <span className="font-mono font-bold text-purple-400">{(rodataSize / 1024).toFixed(1)} KB</span>
            </div>
            <input
              type="range"
              min={0}
              max={totalFlashBytes * 0.4}
              step={200}
              value={rodataSize}
              onChange={(e) => setRodataSize(parseInt(e.target.value, 10))}
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>

          {/* Data Size */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">초기화 전역 변수 (.data):</span>
              <span className="font-mono font-bold text-pink-400">{dataSize} B</span>
            </div>
            <input
              type="range"
              min={16}
              max={totalSramBytes * 0.4}
              step={16}
              value={dataSize}
              onChange={(e) => setDataSize(parseInt(e.target.value, 10))}
              className="w-full accent-pink-500 cursor-pointer"
            />
          </div>

          {/* BSS Size */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">0 초기화 버퍼 (.bss):</span>
              <span className="font-mono font-bold text-blue-400">{bssSize} B</span>
            </div>
            <input
              type="range"
              min={32}
              max={totalSramBytes * 0.6}
              step={32}
              value={bssSize}
              onChange={(e) => setBssSize(parseInt(e.target.value, 10))}
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
