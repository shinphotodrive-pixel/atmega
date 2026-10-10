import React, { useState, useMemo, useCallback } from 'react';
import {
  HardDrive,
  Layers,
  Cpu,
  Sliders,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle,
  ShieldCheck,
  RefreshCw,
  Info,
  FileCode,
  Zap,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Settings,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Binary
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

export interface FlashMemoryLayoutVisualizerProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type SegmentCategory = 'vector' | 'code' | 'rodata' | 'data' | 'custom' | 'bootloader' | 'ota' | 'reserved';

export interface FlashSegment {
  id: string;
  name: string;
  nameKo: string;
  section: string;
  category: SegmentCategory;
  startAddr: number; // in bytes
  sizeBytes: number;
  color: string;
  isLocked?: boolean;
  isBootloader?: boolean;
  isVector?: boolean;
  enabled: boolean;
  description: string;
}

interface MCUFlashSpec {
  totalBytes: number;
  pageSizeBytes: number;
  pageCount: number;
  vectorSizeBytes: number;
  vectorCount: number;
  defaultBootloaderBytes: number;
  bootloaderOptions: {
    sizeBytes: number;
    label: string;
    fuseBits: string;
    bootResetWordAddr: number;
    bootResetByteAddr: number;
  }[];
}

const MCU_FLASH_SPECS: Record<SupportedMCU, MCUFlashSpec> = {
  atmega328p: {
    totalBytes: 32 * 1024, // 32,768 Bytes (16,384 Words)
    pageSizeBytes: 128,    // 64 Words
    pageCount: 256,
    vectorSizeBytes: 104,   // 26 vectors * 4 bytes
    vectorCount: 26,
    defaultBootloaderBytes: 512, // 512 Bytes (Optiboot)
    bootloaderOptions: [
      { sizeBytes: 0, label: '부트로더 미사용 (0B / 전체 플래시 앱 전용)', fuseBits: 'BOOTRST=1 (Unprogrammed)', bootResetWordAddr: 0x0000, bootResetByteAddr: 0x0000 },
      { sizeBytes: 512, label: '512 Bytes (256 Words) - Arduino Optiboot 기본', fuseBits: 'BOOTSZ=11, BOOTRST=0', bootResetWordAddr: 0x3F00, bootResetByteAddr: 0x7E00 },
      { sizeBytes: 1024, label: '1024 Bytes (512 Words) - 1KB 부트로더', fuseBits: 'BOOTSZ=10, BOOTRST=0', bootResetWordAddr: 0x3E00, bootResetByteAddr: 0x7C00 },
      { sizeBytes: 2048, label: '2048 Bytes (1024 Words) - Arduino 구형 Duemilanove', fuseBits: 'BOOTSZ=01, BOOTRST=0', bootResetWordAddr: 0x3C00, bootResetByteAddr: 0x7800 },
      { sizeBytes: 4096, label: '4096 Bytes (2048 Words) - 4KB 대형 부트로더', fuseBits: 'BOOTSZ=00, BOOTRST=0', bootResetWordAddr: 0x3800, bootResetByteAddr: 0x7000 }
    ]
  },
  atmega128: {
    totalBytes: 128 * 1024, // 131,072 Bytes (65,536 Words)
    pageSizeBytes: 256,     // 128 Words
    pageCount: 512,
    vectorSizeBytes: 140,    // 35 vectors * 4 bytes
    vectorCount: 35,
    defaultBootloaderBytes: 4096, // 4KB default
    bootloaderOptions: [
      { sizeBytes: 0, label: '부트로더 미사용 (0B / 전체 플래시 앱 전용)', fuseBits: 'BOOTRST=1 (Unprogrammed)', bootResetWordAddr: 0x0000, bootResetByteAddr: 0x0000 },
      { sizeBytes: 1024, label: '1024 Bytes (512 Words) - 1KB 최소형 부트로더', fuseBits: 'BOOTSZ=11, BOOTRST=0', bootResetWordAddr: 0xFE00, bootResetByteAddr: 0x1FC00 },
      { sizeBytes: 2048, label: '2048 Bytes (1024 Words) - 2KB 부트로더', fuseBits: 'BOOTSZ=10, BOOTRST=0', bootResetWordAddr: 0xFC00, bootResetByteAddr: 0x1F800 },
      { sizeBytes: 4096, label: '4096 Bytes (2048 Words) - 4KB STK500v2 표준 부트로더', fuseBits: 'BOOTSZ=01, BOOTRST=0', bootResetWordAddr: 0xF800, bootResetByteAddr: 0x1F000 },
      { sizeBytes: 8192, label: '8192 Bytes (4096 Words) - 8KB 네트워크/SD 복합 부트로더', fuseBits: 'BOOTSZ=00, BOOTRST=0', bootResetWordAddr: 0xF000, bootResetByteAddr: 0x1E000 }
    ]
  },
  atmega640: {
    totalBytes: 64 * 1024, // 65,536 Bytes (32,768 Words)
    pageSizeBytes: 256,    // 128 Words
    pageCount: 256,
    vectorSizeBytes: 228,   // 57 vectors * 4 bytes
    vectorCount: 57,
    defaultBootloaderBytes: 4096, // 4KB default
    bootloaderOptions: [
      { sizeBytes: 0, label: '부트로더 미사용 (0B / 전체 플래시 앱 전용)', fuseBits: 'BOOTRST=1 (Unprogrammed)', bootResetWordAddr: 0x0000, bootResetByteAddr: 0x0000 },
      { sizeBytes: 1024, label: '1024 Bytes (512 Words) - 1KB 최소형 부트로더', fuseBits: 'BOOTSZ=11, BOOTRST=0', bootResetWordAddr: 0x7E00, bootResetByteAddr: 0xFC00 },
      { sizeBytes: 2048, label: '2048 Bytes (1024 Words) - 2KB 부트로더', fuseBits: 'BOOTSZ=10, BOOTRST=0', bootResetWordAddr: 0x7C00, bootResetByteAddr: 0xF800 },
      { sizeBytes: 4096, label: '4096 Bytes (2048 Words) - 4KB 산업용 콘솔 부트로더', fuseBits: 'BOOTSZ=01, BOOTRST=0', bootResetWordAddr: 0x7800, bootResetByteAddr: 0xF000 },
      { sizeBytes: 8192, label: '8192 Bytes (4096 Words) - 8KB CAN/Modbus 복합 부트로더', fuseBits: 'BOOTSZ=00, BOOTRST=0', bootResetWordAddr: 0x7000, bootResetByteAddr: 0xE000 }
    ]
  }
};

// Preset scenarios
interface LayoutPreset {
  id: string;
  name: string;
  tag: string;
  desc: string;
  bootloaderSize: number;
  segments: (spec: MCUFlashSpec) => Omit<FlashSegment, 'id'>[];
}

const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'standard-arduino',
    name: '표준 Arduino / Optiboot 레이아웃',
    tag: '기본 권장',
    desc: 'Arduino 프레임워크 기반 표준 스케치 구조. 상단 Optiboot 부트로더와 하단 애플리케이션 코드가 분리되어 있습니다.',
    bootloaderSize: 512,
    segments: (spec) => [
      {
        name: '인터럽트 벡터 테이블',
        nameKo: '인터럽트 벡터 테이블',
        section: '.vectors',
        category: 'vector',
        startAddr: 0,
        sizeBytes: spec.vectorSizeBytes,
        color: '#6366f1', // Indigo
        isLocked: true,
        isVector: true,
        enabled: true,
        description: '리셋 및 외부 인터럽트, 타이머, USART 등 하드웨어 ISR 점프 벡터 테이블'
      },
      {
        name: '애플리케이션 펌웨어',
        nameKo: '애플리케이션 코드',
        section: '.text',
        category: 'code',
        startAddr: spec.vectorSizeBytes,
        sizeBytes: Math.round(spec.totalBytes * 0.42),
        color: '#3b82f6', // Blue
        enabled: true,
        description: 'setup(), loop(), 드라이버 및 C/C++ 실행 머신코드'
      },
      {
        name: 'PROGMEM 상수 & 문자열',
        nameKo: '읽기 전용 상수',
        section: '.rodata',
        category: 'rodata',
        startAddr: spec.vectorSizeBytes + Math.round(spec.totalBytes * 0.42),
        sizeBytes: Math.round(spec.totalBytes * 0.12),
        color: '#06b6d4', // Cyan
        enabled: true,
        description: 'F() 매크로 및 PROGMEM으로 플래시에 고정 배치된 상수 문자열, 룩업 테이블'
      },
      {
        name: '초기화 변수 복사 이미지',
        nameKo: '초기화 데이터 LMA',
        section: '.data (LMA)',
        category: 'data',
        startAddr: spec.vectorSizeBytes + Math.round(spec.totalBytes * 0.42) + Math.round(spec.totalBytes * 0.12),
        sizeBytes: 480,
        color: '#10b981', // Emerald
        enabled: true,
        description: '부팅 시 C 런타임(crt0)이 SRAM으로 복사할 전역/정적 변수 초기값의 플래시 저장 이미지'
      }
    ]
  },
  {
    id: 'industrial-baremetal',
    name: '산업용 베어메탈 (부트로더 미사용)',
    tag: '최대 플래시 확보',
    desc: 'ISP/JTAG 전용 양산 펌웨어로 부트로더를 전혀 사용하지 않아 플래시 메모리 공간을 100% 온전히 활용합니다.',
    bootloaderSize: 0,
    segments: (spec) => [
      {
        name: '인터럽트 벡터 테이블',
        nameKo: '인터럽트 벡터 테이블',
        section: '.vectors',
        category: 'vector',
        startAddr: 0,
        sizeBytes: spec.vectorSizeBytes,
        color: '#6366f1',
        isLocked: true,
        isVector: true,
        enabled: true,
        description: '고속 베어메탈 인터럽트 디스패치 벡터'
      },
      {
        name: '제어 엔진 펌웨어',
        nameKo: '코어 애플리케이션',
        section: '.text',
        category: 'code',
        startAddr: spec.vectorSizeBytes,
        sizeBytes: Math.round(spec.totalBytes * 0.55),
        color: '#3b82f6',
        enabled: true,
        description: 'PID 제어 루프, 통신 프로토콜 스택, 필터링 알고리즘 머신코드'
      },
      {
        name: '공장 캘리브레이션 테이블',
        nameKo: '정밀 교정 테이블',
        section: '.cal_table',
        category: 'custom',
        startAddr: Math.round(spec.totalBytes * 0.85),
        sizeBytes: 1024,
        color: '#f59e0b', // Amber
        enabled: true,
        description: '센서 ADC 비선형 보정 및 온도 보상 계수 고정 메모리 블록'
      }
    ]
  },
  {
    id: 'dual-bank-ota',
    name: 'Dual-Bank 무선 OTA 분할 레이아웃',
    tag: 'OTA 원격 업데이트',
    desc: '현재 실행 중인 Slot A와 무선으로 다운로드되는 신규 펌웨어 Slot B, 상단 보안 부트로더로 구성된 구조.',
    bootloaderSize: 4096,
    segments: (spec) => {
      const availableAppSpace = spec.totalBytes - 4096 - spec.vectorSizeBytes;
      const slotSize = Math.floor((availableAppSpace - 512) / 2);
      return [
        {
          name: '인터럽트 벡터 테이블',
          nameKo: '인터럽트 벡터 테이블',
          section: '.vectors',
          category: 'vector',
          startAddr: 0,
          sizeBytes: spec.vectorSizeBytes,
          color: '#6366f1',
          isLocked: true,
          isVector: true,
          enabled: true,
          description: '기본 하드웨어 ISR 점프 벡터'
        },
        {
          name: 'Slot A: 활성 펌웨어 (Active App)',
          nameKo: '슬롯 A 활성 펌웨어',
          section: '.text_slot_a',
          category: 'code',
          startAddr: spec.vectorSizeBytes,
          sizeBytes: slotSize,
          color: '#3b82f6',
          enabled: true,
          description: '현재 MCU가 실행 중인 주 펌웨어 영역'
        },
        {
          name: 'Slot B: OTA 수신 버퍼 (Staging App)',
          nameKo: '슬롯 B OTA 다운로드 영역',
          section: '.ota_staging',
          category: 'ota',
          startAddr: spec.vectorSizeBytes + slotSize,
          sizeBytes: slotSize,
          color: '#8b5cf6', // Violet
          enabled: true,
          description: '무선(Wi-Fi/Bluetooth/LoRa)으로 새 펌웨어 바이너리를 수신하여 검증하는 스테이징 영역'
        },
        {
          name: 'OTA 메타데이터 & SHA-256 서명',
          nameKo: 'OTA 보안 메타데이터',
          section: '.ota_meta',
          category: 'custom',
          startAddr: spec.vectorSizeBytes + slotSize * 2,
          sizeBytes: 512,
          color: '#ec4899', // Pink
          enabled: true,
          description: '슬롯 버전 번호, 체크섬 CRC32 및 ECDSA/SHA256 암호 서명 저장소'
        }
      ];
    }
  },
  {
    id: 'gui-progmem-assets',
    name: '임베디드 GUI & 폰트/비트맵 에셋 레이아웃',
    tag: 'OLED / TFT UI',
    desc: 'OLED 또는 컬러 TFT LCD 구동을 위한 고용량 한글 폰트 테이블, UI 아이콘, 스플래시 이미지 PROGMEM 특화 구성.',
    bootloaderSize: 2048,
    segments: (spec) => [
      {
        name: '인터럽트 벡터 테이블',
        nameKo: '인터럽트 벡터 테이블',
        section: '.vectors',
        category: 'vector',
        startAddr: 0,
        sizeBytes: spec.vectorSizeBytes,
        color: '#6366f1',
        isLocked: true,
        isVector: true,
        enabled: true,
        description: '타이머 및 SPI 디스플레이 동기화 ISR 벡터'
      },
      {
        name: 'GUI 제어 & 렌더링 코드',
        nameKo: '디스플레이 구동 코드',
        section: '.text',
        category: 'code',
        startAddr: spec.vectorSizeBytes,
        sizeBytes: Math.round(spec.totalBytes * 0.35),
        color: '#3b82f6',
        enabled: true,
        description: 'UI 위젯 트리, 버튼 입력 이벤트, SPI DMA/바운딩 박스 렌더러'
      },
      {
        name: '한글/영문 비트맵 폰트 (Font ROM)',
        nameKo: '폰트 룩업 테이블',
        section: '.font_assets',
        category: 'rodata',
        startAddr: spec.vectorSizeBytes + Math.round(spec.totalBytes * 0.35),
        sizeBytes: Math.round(spec.totalBytes * 0.25),
        color: '#14b8a6', // Teal
        enabled: true,
        description: '16x16 조합형 완성형 한글 글리프 및 ASCII 8x16 비트맵 폰트'
      },
      {
        name: 'UI 아이콘 & 스플래시 비트맵',
        nameKo: '그래픽 이미지 에셋',
        section: '.bitmap_assets',
        category: 'custom',
        startAddr: spec.vectorSizeBytes + Math.round(spec.totalBytes * 0.60),
        sizeBytes: Math.round(spec.totalBytes * 0.15),
        color: '#f97316', // Orange
        enabled: true,
        description: '부팅 로고 및 1-bit / 16-bit RGB565 아이콘 그래픽 배열'
      }
    ]
  }
];

export const FlashMemoryLayoutVisualizer: React.FC<FlashMemoryLayoutVisualizerProps> = ({
  selectedMCU,
  onSelectMCU
}) => {
  const spec = MCU_FLASH_SPECS[selectedMCU] || MCU_FLASH_SPECS.atmega328p;
  const profile = MCU_PROFILES[selectedMCU];

  // Selected preset & bootloader size
  const [selectedPresetId, setSelectedPresetId] = useState<string>('standard-arduino');
  const [bootloaderSizeBytes, setBootloaderSizeBytes] = useState<number>(() => {
    if (selectedMCU === 'atmega328p') return 512;
    return 4096;
  });

  // Segments state
  const [segments, setSegments] = useState<FlashSegment[]>(() => {
    const preset = LAYOUT_PRESETS[0];
    const baseSegments = preset.segments(spec);
    return baseSegments.map((s, idx) => ({
      ...s,
      id: `seg_${Date.now()}_${idx}`
    }));
  });

  // Selected segment for editing/inspecting
  const [selectedSegId, setSelectedSegId] = useState<string | null>(null);

  // Address format mode (Hex Byte vs Word Address)
  const [addressDisplayMode, setAddressDisplayMode] = useState<'hex-byte' | 'word' | 'decimal'>('hex-byte');

  // Modal / Drawer state for adding custom segment
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSegName, setNewSegName] = useState('사용자 정의 데이터');
  const [newSegSection, setNewSegSection] = useState('.custom_data');
  const [newSegSize, setNewSegSize] = useState<number>(1024);
  const [newSegCategory, setNewSegCategory] = useState<SegmentCategory>('custom');
  const [newSegColor, setNewSegColor] = useState('#f59e0b');
  const [newSegAddressMode, setNewSegAddressMode] = useState<'auto' | 'manual'>('auto');
  const [newSegManualAddr, setNewSegManualAddr] = useState<number>(0);
  const [newSegDesc, setNewSegDesc] = useState('사용자 지정 플래시 메모리 섹션');

  // Active code generation tab
  const [activeCodeTab, setActiveCodeTab] = useState<'gcc' | 'linker' | 'c_source' | 'platformio'>('gcc');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Switch preset handler
  const handleApplyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = LAYOUT_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    // find suitable bootloader size
    const validBootSizes = spec.bootloaderOptions.map(b => b.sizeBytes);
    let chosenBoot = preset.bootloaderSize;
    if (!validBootSizes.includes(chosenBoot)) {
      chosenBoot = validBootSizes[validBootSizes.length - 2] || spec.defaultBootloaderBytes;
    }
    setBootloaderSizeBytes(chosenBoot);

    const baseSegments = preset.segments(spec);
    setSegments(
      baseSegments.map((s, idx) => ({
        ...s,
        id: `seg_${Date.now()}_${idx}`
      }))
    );
    setSelectedSegId(null);
  };

  // Re-adjust segments when MCU changes
  const prevMcuRef = React.useRef(selectedMCU);
  React.useEffect(() => {
    if (prevMcuRef.current !== selectedMCU) {
      prevMcuRef.current = selectedMCU;
      // Re-apply current preset for new MCU specs
      const preset = LAYOUT_PRESETS.find(p => p.id === selectedPresetId) || LAYOUT_PRESETS[0];
      const validBootSizes = spec.bootloaderOptions.map(b => b.sizeBytes);
      let chosenBoot = preset.bootloaderSize;
      if (!validBootSizes.includes(chosenBoot)) {
        chosenBoot = validBootSizes[1] || spec.defaultBootloaderBytes;
      }
      setBootloaderSizeBytes(chosenBoot);

      const baseSegments = preset.segments(spec);
      setSegments(
        baseSegments.map((s, idx) => ({
          ...s,
          id: `seg_${Date.now()}_${idx}`
        }))
      );
      setSelectedSegId(null);
    }
  }, [selectedMCU, selectedPresetId, spec]);

  // Construct Bootloader Segment (if enabled)
  const bootloaderSegment: FlashSegment | null = useMemo(() => {
    if (bootloaderSizeBytes <= 0) return null;
    const start = spec.totalBytes - bootloaderSizeBytes;
    return {
      id: 'bootloader_fixed',
      name: '하드웨어 부트로더 (Boot Section)',
      nameKo: '부트로더 섹션',
      section: '.bootloader',
      category: 'bootloader',
      startAddr: start,
      sizeBytes: bootloaderSizeBytes,
      color: '#e11d48', // Rose 600
      isLocked: true,
      isBootloader: true,
      enabled: true,
      description: `BOOTSZ 퓨즈에 의해 보호되는 하드웨어 부트로더 영역 (리셋 진입 주소 0x${Math.floor(start / 2).toString(16).toUpperCase().padStart(4, '0')} Word)`
    };
  }, [bootloaderSizeBytes, spec.totalBytes]);

  // Combine user segments + bootloader segment
  const allActiveSegments: FlashSegment[] = useMemo(() => {
    const list = segments.filter(s => s.enabled);
    if (bootloaderSegment) {
      list.push(bootloaderSegment);
    }
    // Sort primarily by start address
    return list.sort((a, b) => a.startAddr - b.startAddr);
  }, [segments, bootloaderSegment]);

  // Address calculations, gaps, collisions & metrics
  const layoutAnalysis = useMemo(() => {
    const totalFlash = spec.totalBytes;
    let totalUsedBytes = 0;
    const collisions: { segA: FlashSegment; segB: FlashSegment; overlapBytes: number }[] = [];
    const outOfBounds: { seg: FlashSegment; excessBytes: number }[] = [];

    // Calculate total used (sum of active segments)
    for (const seg of allActiveSegments) {
      totalUsedBytes += seg.sizeBytes;
      const endAddr = seg.startAddr + seg.sizeBytes;
      if (endAddr > totalFlash) {
        outOfBounds.push({
          seg,
          excessBytes: endAddr - totalFlash
        });
      }
    }

    // Check collisions between segments
    for (let i = 0; i < allActiveSegments.length; i++) {
      for (let j = i + 1; j < allActiveSegments.length; j++) {
        const a = allActiveSegments[i];
        const b = allActiveSegments[j];
        const aStart = a.startAddr;
        const aEnd = a.startAddr + a.sizeBytes;
        const bStart = b.startAddr;
        const bEnd = b.startAddr + b.sizeBytes;

        const maxStart = Math.max(aStart, bStart);
        const minEnd = Math.min(aEnd, bEnd);
        if (maxStart < minEnd) {
          collisions.push({
            segA: a,
            segB: b,
            overlapBytes: minEnd - maxStart
          });
        }
      }
    }

    // Calculate free blocks / gaps
    const sorted = [...allActiveSegments].sort((a, b) => a.startAddr - b.startAddr);
    interface MemoryGap {
      startAddr: number;
      endAddr: number;
      sizeBytes: number;
    }
    const gaps: MemoryGap[] = [];
    let currentPtr = 0;

    for (const seg of sorted) {
      if (seg.startAddr > currentPtr) {
        gaps.push({
          startAddr: currentPtr,
          endAddr: seg.startAddr,
          sizeBytes: seg.startAddr - currentPtr
        });
      }
      currentPtr = Math.max(currentPtr, seg.startAddr + seg.sizeBytes);
    }

    if (currentPtr < totalFlash) {
      gaps.push({
        startAddr: currentPtr,
        endAddr: totalFlash,
        sizeBytes: totalFlash - currentPtr
      });
    }

    const totalFreeBytes = Math.max(0, totalFlash - totalUsedBytes);
    const usagePercent = Math.min(100, (totalUsedBytes / totalFlash) * 100);
    const largestContiguousFree = gaps.reduce((max, g) => Math.max(max, g.sizeBytes), 0);

    // Page utilization
    const pagesUsed = Math.ceil(totalUsedBytes / spec.pageSizeBytes);
    const totalPages = spec.pageCount;

    return {
      totalUsedBytes,
      totalFreeBytes,
      usagePercent,
      collisions,
      outOfBounds,
      gaps,
      largestContiguousFree,
      pagesUsed,
      totalPages,
      isOverflow: totalUsedBytes > totalFlash || collisions.length > 0 || outOfBounds.length > 0
    };
  }, [allActiveSegments, spec]);

  // Format addresses based on chosen display mode
  const formatAddr = useCallback((byteAddr: number): string => {
    if (addressDisplayMode === 'decimal') {
      return `${byteAddr.toLocaleString()} B`;
    }
    if (addressDisplayMode === 'word') {
      const wordAddr = Math.floor(byteAddr / 2);
      return `0x${wordAddr.toString(16).toUpperCase().padStart(4, '0')} (Word)`;
    }
    // Hex Byte
    const hexLength = spec.totalBytes > 65536 ? 5 : 4;
    return `0x${byteAddr.toString(16).toUpperCase().padStart(hexLength, '0')}`;
  }, [addressDisplayMode, spec.totalBytes]);

  // Auto-pack function: sequentially arranges non-locked segments starting right after vector table
  const handleAutoPack = () => {
    const vectorSeg = segments.find(s => s.isVector);
    const vectorSize = vectorSeg ? vectorSeg.sizeBytes : spec.vectorSizeBytes;
    let nextStart = vectorSize;

    const newSegs = segments.map(seg => {
      if (seg.isVector) {
        return { ...seg, startAddr: 0 };
      }
      const updated = { ...seg, startAddr: nextStart };
      nextStart += seg.sizeBytes;
      return updated;
    });

    setSegments(newSegs);
  };

  // Add custom segment
  const handleAddSegment = () => {
    const size = Math.max(1, newSegSize);
    let start = newSegManualAddr;

    if (newSegAddressMode === 'auto') {
      // Find the first gap that fits, or right after the last user segment before bootloader
      const bootStart = bootloaderSegment ? bootloaderSegment.startAddr : spec.totalBytes;
      const sortedNonBoot = segments
        .filter(s => s.enabled)
        .sort((a, b) => a.startAddr - b.startAddr);

      let candidate = spec.vectorSizeBytes;
      for (const s of sortedNonBoot) {
        if (!s.isVector && s.startAddr >= candidate) {
          candidate = Math.max(candidate, s.startAddr + s.sizeBytes);
        }
      }
      start = candidate;
    }

    const newSeg: FlashSegment = {
      id: `seg_${Date.now()}`,
      name: newSegName.trim() || '사용자 커스텀 섹션',
      nameKo: newSegName.trim() || '사용자 커스텀 섹션',
      section: newSegSection.startsWith('.') ? newSegSection.trim() : `.${newSegSection.trim()}`,
      category: newSegCategory,
      startAddr: start,
      sizeBytes: size,
      color: newSegColor,
      enabled: true,
      description: newSegDesc.trim() || '사용자 정의 플래시 메모리 영역'
    };

    setSegments([...segments, newSeg]);
    setIsAddModalOpen(false);
    setSelectedSegId(newSeg.id);
  };

  // Remove segment
  const handleRemoveSegment = (id: string) => {
    setSegments(segments.filter(s => s.id !== id));
    if (selectedSegId === id) {
      setSelectedSegId(null);
    }
  };

  // Toggle segment
  const handleToggleSegment = (id: string) => {
    setSegments(segments.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  // Update segment size
  const handleUpdateSegmentSize = (id: string, newSize: number) => {
    const validSize = Math.max(1, Math.min(spec.totalBytes, newSize));
    setSegments(segments.map(s => s.id === id ? { ...s, sizeBytes: validSize } : s));
  };

  // Update segment start address
  const handleUpdateSegmentAddress = (id: string, newAddress: number) => {
    const validAddr = Math.max(0, Math.min(spec.totalBytes - 1, newAddress));
    setSegments(segments.map(s => s.id === id ? { ...s, startAddr: validAddr } : s));
  };

  // Active selected segment object
  const activeSelectedSegment = useMemo(() => {
    if (!selectedSegId) return null;
    if (selectedSegId === 'bootloader_fixed') return bootloaderSegment;
    return segments.find(s => s.id === selectedSegId) || null;
  }, [selectedSegId, bootloaderSegment, segments]);

  // Current Bootloader Fuse configuration info
  const currentBootOption = useMemo(() => {
    return (
      spec.bootloaderOptions.find(b => b.sizeBytes === bootloaderSizeBytes) ||
      spec.bootloaderOptions[0]
    );
  }, [spec.bootloaderOptions, bootloaderSizeBytes]);

  // Generate Code Snippets
  const generatedCode = useMemo(() => {
    const nonStandardSegs = allActiveSegments.filter(
      s => s.section !== '.vectors' && s.section !== '.text' && s.section !== '.rodata' && s.section !== '.data (LMA)'
    );

    // 1. GCC Linker Flags
    const gccFlags = allActiveSegments
      .map(s => `-Wl,--section-start=${s.section}=0x${s.startAddr.toString(16).toUpperCase()}`)
      .join(' \\\n  ');

    const gccCmd = `avr-gcc -mmcu=${selectedMCU} -O2 main.o \\\n  ${gccFlags} \\\n  -o firmware.elf`;

    // 2. Custom Linker Script (.ld)
    const customLd = `/* AVR GNU ld Linker Script for ${profile.fullName} (${spec.totalBytes / 1024}KB Flash) */
MEMORY
{
  flash (rx) : ORIGIN = 0x00000000, LENGTH = ${spec.totalBytes}
}

SECTIONS
{
  /* 하드웨어 인터럽트 벡터 테이블 */
  .vectors 0x0000 : {
    KEEP(*(.vectors))
  } > flash

  /* 애플리케이션 실행 머신코드 */
  .text : {
    *(.text)
    *(.text.*)
  } > flash

  .rodata : {
    *(.rodata)
    *(.rodata.*)
  } > flash

${nonStandardSegs
  .map(
    s => `  /* ${s.name} (${s.description}) */
  ${s.section} 0x${s.startAddr.toString(16).toUpperCase()} : {
    KEEP(*(${s.section}))
  } > flash`
  )
  .join('\n\n')}
}`;

    // 3. C Source placement code
    const cSourceExamples = nonStandardSegs
      .map(s => {
        const varName = s.section.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_/, 'g_');
        return `// [${s.name}] 플래시 섹션 (${s.section}) 고정 배치 예시
__attribute__((section("${s.section}"))) __attribute__((used))
const uint8_t ${varName}[${s.sizeBytes}] = {
  0xAA, 0x55, /* ... ${s.sizeBytes} 바이트 데이터 ... */
};`;
      })
      .join('\n\n');

    const cFullCode = `#include <avr/io.h>
#include <avr/pgmspace.h>

${cSourceExamples || `// 사용자 정의 커스텀 섹션이 추가되면 여기에 C/C++ PROGMEM 매핑 코드가 자동 생성됩니다.
// 예시:
__attribute__((section(".my_section"))) __attribute__((used))
const char g_firmware_version[] = "v2.4.0-PROD";`}

// 플래시에서 직접 읽어오는 헬퍼 함수
uint8_t read_custom_flash_byte(uint16_t addr) {
  return pgm_read_byte(addr);
}`;

    // 4. PlatformIO / Makefile configuration
    const pioConfig = `[env:${selectedMCU}]
platform = atmelavr
board = ${selectedMCU === 'atmega328p' ? 'uno' : selectedMCU === 'atmega128' ? 'mega128' : 'mega640'}
framework = arduino

; Flash Memory Layout Linker Flags
build_flags =
${allActiveSegments
  .map(s => `  -Wl,--section-start=${s.section}=0x${s.startAddr.toString(16).toUpperCase()}`)
  .join('\n')}`;

    return {
      gccCmd,
      customLd,
      cFullCode,
      pioConfig
    };
  }, [allActiveSegments, selectedMCU, profile.fullName, spec.totalBytes]);

  // Copy to clipboard helper
  const handleCopyCode = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg font-bold text-white tracking-wide">
                Flash Memory Layout Visualizer
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-semibold">
                {profile.fullName} ({spec.totalBytes / 1024} KB)
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                페이지당 {spec.pageSizeBytes} B ({spec.pageCount} Pages)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              사용자 정의 펌웨어 세그먼트(.text, .rodata, .data), 부트로더 및 커스텀 섹션을 플래시 메모리 주소 스케일 위에 매핑하고 여유 공간을 실시간으로 추적합니다.
            </p>
          </div>
        </div>

        {/* MCU Selector & Address Mode Toggle */}
        <div className="flex items-center gap-2 flex-wrap self-start lg:self-center">
          {/* Address Display Toggle */}
          <div className="bg-slate-950/80 p-1 rounded-xl border border-slate-800 flex items-center text-xs">
            <button
              onClick={() => setAddressDisplayMode('hex-byte')}
              className={`px-2.5 py-1 rounded-lg font-mono font-medium transition-all ${
                addressDisplayMode === 'hex-byte'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="바이트 단위 16진수 주소 (0x0000)"
            >
              Hex 바이트
            </button>
            <button
              onClick={() => setAddressDisplayMode('word')}
              className={`px-2.5 py-1 rounded-lg font-mono font-medium transition-all ${
                addressDisplayMode === 'word'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="AVR 프로그램 카운터(PC) 16비트 워드 주소 (0x0000 Word)"
            >
              PC 워드 주소
            </button>
            <button
              onClick={() => setAddressDisplayMode('decimal')}
              className={`px-2.5 py-1 rounded-lg font-mono font-medium transition-all ${
                addressDisplayMode === 'decimal'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="10진수 바이트 크기 표기"
            >
              10진수 (B)
            </button>
          </div>

          {/* Quick MCU Switch if prop provided */}
          {onSelectMCU && (
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
              {(['atmega328p', 'atmega128', 'atmega640'] as SupportedMCU[]).map(mcu => (
                <button
                  key={mcu}
                  onClick={() => onSelectMCU(mcu)}
                  className={`px-2.5 py-1 rounded-lg font-mono font-medium transition-all ${
                    selectedMCU === mcu
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mcu === 'atmega328p' ? '328P (32K)' : mcu === 'atmega128' ? 'M128 (128K)' : 'M640 (64K)'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preset Scenarios Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            실전 플래시 파티션 레이아웃 프리셋
          </span>
          <span className="text-slate-500">클릭 시 실전 펌웨어 아키텍처 설정이 즉시 로드됩니다</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {LAYOUT_PRESETS.map(preset => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleApplyPreset(preset.id)}
                className={`text-left p-3 rounded-xl border transition-all relative overflow-hidden group ${
                  isSelected
                    ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md shadow-indigo-500/10'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className={`text-xs font-bold ${isSelected ? 'text-indigo-300' : 'text-slate-200'}`}>
                    {preset.name}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    isSelected
                      ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {preset.tag}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                  {preset.desc}
                </p>
                {isSelected && (
                  <div className="absolute top-0 right-0 w-2 h-2 bg-indigo-500 rounded-bl" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Collision or Overflow Warnings */}
      {layoutAnalysis.isOverflow && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/50 space-y-2 text-rose-200 animate-pulse">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            플래시 메모리 레이아웃 충돌 / 용량 초과 감지!
          </div>
          {layoutAnalysis.outOfBounds.length > 0 && (
            <p className="text-xs">
              • 한계 용량 초과: {layoutAnalysis.outOfBounds.map(o => `[${o.seg.name}] 세그먼트가 플래시 끝 주소(${formatAddr(spec.totalBytes)})를 ${o.excessBytes.toLocaleString()}B 초과했습니다.`).join(' ')}
            </p>
          )}
          {layoutAnalysis.collisions.length > 0 && (
            <div className="text-xs space-y-1">
              {layoutAnalysis.collisions.map((c, idx) => (
                <div key={idx}>
                  • 주소 충돌: [{c.segA.name} ({formatAddr(c.segA.startAddr)}~{formatAddr(c.segA.startAddr + c.segA.sizeBytes)})]와 [{c.segB.name} ({formatAddr(c.segB.startAddr)}~{formatAddr(c.segB.startAddr + c.segB.sizeBytes)})] 사이에 {c.overlapBytes.toLocaleString()} Bytes 중복 할당이 발생했습니다.
                </div>
              ))}
            </div>
          )}
          <div className="pt-1 text-xs text-rose-300/80 font-mono">
            💡 '세그먼트 자동 정렬(Auto-Pack)' 버튼을 누르거나 주소/크기 슬라이더를 조정하여 충돌을 해소하십시오.
          </div>
        </div>
      )}

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Flash */}
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>총 플래시 용량</span>
            <Cpu className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-lg font-bold text-white font-mono mt-1">
            {(spec.totalBytes / 1024).toFixed(0)} KB
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {spec.totalBytes.toLocaleString()} Bytes (0x0000 ~ {formatAddr(spec.totalBytes)})
          </div>
        </div>

        {/* Used Flash */}
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>사용 중인 공간 (Used)</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
              layoutAnalysis.usagePercent > 90 ? 'bg-rose-500/20 text-rose-300' : 'bg-indigo-500/20 text-indigo-300'
            }`}>
              {layoutAnalysis.usagePercent.toFixed(1)}%
            </span>
          </div>
          <div className={`text-lg font-bold font-mono mt-1 ${
            layoutAnalysis.usagePercent > 90 ? 'text-rose-400' : 'text-indigo-400'
          }`}>
            {(layoutAnalysis.totalUsedBytes / 1024).toFixed(2)} KB
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {layoutAnalysis.totalUsedBytes.toLocaleString()} Bytes ({layoutAnalysis.pagesUsed} / {spec.pageCount} Pages)
          </div>
        </div>

        {/* Available / Free Space */}
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>여유 공간 (Available)</span>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
            {(layoutAnalysis.totalFreeBytes / 1024).toFixed(2)} KB
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {layoutAnalysis.totalFreeBytes.toLocaleString()} Bytes ({(100 - layoutAnalysis.usagePercent).toFixed(1)}% 미사용)
          </div>
        </div>

        {/* Largest Contiguous Block */}
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>최대 단일 여유 블록</span>
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-cyan-400 font-mono mt-1">
            {(layoutAnalysis.largestContiguousFree / 1024).toFixed(2)} KB
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {layoutAnalysis.largestContiguousFree.toLocaleString()} Bytes 연속 가용
          </div>
        </div>
      </div>

      {/* Visual Memory Address Scale Ruler */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/90 space-y-4 shadow-inner">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm font-bold text-white tracking-wide">
              플래시 메모리 주소 스케일 시각화 (Flash Memory Address Scale)
            </h4>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleAutoPack}
              className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="인터럽트 벡터 테이블 이후부터 세그먼트들을 순차적으로 빈틈없이 연속 배치합니다"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              세그먼트 자동 정렬 (Auto-Pack)
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              세그먼트 추가
            </button>
          </div>
        </div>

        {/* Address Scale Top Labels */}
        <div className="flex justify-between text-[11px] font-mono text-slate-400 px-1 select-none">
          <span>{formatAddr(0)} (Flash Start / Vector Table)</span>
          <span>{formatAddr(Math.floor(spec.totalBytes / 4))}</span>
          <span>{formatAddr(Math.floor(spec.totalBytes / 2))} (50%)</span>
          <span>{formatAddr(Math.floor((spec.totalBytes * 3) / 4))}</span>
          <span>{formatAddr(spec.totalBytes)} (End)</span>
        </div>

        {/* Proportional Memory Bar */}
        <div className="relative w-full h-14 bg-slate-900 rounded-xl border border-slate-700/80 overflow-hidden flex shadow-inner">
          {/* Subtle Page Grid Lines Behind Segments */}
          <div className="absolute inset-0 pointer-events-none opacity-15 flex justify-between">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="h-full border-r border-slate-400 w-full" />
            ))}
          </div>

          {/* Render Active Segments */}
          {allActiveSegments.map(seg => {
            const leftPercent = Math.max(0, Math.min(100, (seg.startAddr / spec.totalBytes) * 100));
            const widthPercent = Math.max(0.6, Math.min(100 - leftPercent, (seg.sizeBytes / spec.totalBytes) * 100));
            const isSelected = selectedSegId === seg.id;

            return (
              <div
                key={seg.id}
                onClick={() => setSelectedSegId(isSelected ? null : seg.id)}
                style={{
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  backgroundColor: seg.color
                }}
                className={`absolute top-0 bottom-0 cursor-pointer transition-all border-r border-slate-950/60 flex flex-col justify-center px-1.5 overflow-hidden group select-none ${
                  isSelected
                    ? 'ring-2 ring-white z-20 brightness-110 shadow-lg'
                    : 'opacity-90 hover:opacity-100 hover:brightness-110 hover:z-10'
                }`}
                title={`${seg.name} (${seg.section})\n주소: ${formatAddr(seg.startAddr)} ~ ${formatAddr(seg.startAddr + seg.sizeBytes)}\n크기: ${seg.sizeBytes.toLocaleString()} B (${((seg.sizeBytes / spec.totalBytes) * 100).toFixed(1)}%)`}
              >
                {widthPercent > 5 && (
                  <span className="text-[11px] font-bold text-white truncate drop-shadow-md">
                    {seg.section}
                  </span>
                )}
                {widthPercent > 9 && (
                  <span className="text-[9px] font-mono text-white/90 truncate drop-shadow-sm">
                    {(seg.sizeBytes / 1024).toFixed(1)}K
                  </span>
                )}
              </div>
            );
          })}

          {/* Available Space Stripes Indicator */}
          {layoutAnalysis.gaps.map((gap, gIdx) => {
            const left = (gap.startAddr / spec.totalBytes) * 100;
            const width = (gap.sizeBytes / spec.totalBytes) * 100;
            if (width < 0.2) return null;
            return (
              <div
                key={`gap_${gIdx}`}
                style={{ left: `${left}%`, width: `${width}%` }}
                className="absolute top-0 bottom-0 pointer-events-none flex items-center justify-center overflow-hidden"
              >
                <div className="w-full h-full opacity-30 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:6px_6px]" />
                {width > 12 && (
                  <span className="absolute text-[10px] font-mono font-medium text-emerald-400 bg-slate-950/80 px-2 py-0.5 rounded border border-emerald-500/30 whitespace-nowrap shadow">
                    여유 {((gap.sizeBytes / 1024)).toFixed(1)}KB
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-indigo-500 inline-block" />
              <span className="text-slate-400">인터럽트 벡터 (.vectors)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-500 inline-block" />
              <span className="text-slate-400">코드 (.text)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-cyan-500 inline-block" />
              <span className="text-slate-400">상수 (.rodata)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
              <span className="text-slate-400">초기화 데이터 (.data)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-rose-600 inline-block" />
              <span className="text-slate-400">부트로더 (.bootloader)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
              <span className="text-slate-400">사용자 커스텀</span>
            </div>
          </div>
          <div className="text-slate-500 text-[11px] font-mono">
            {allActiveSegments.length}개 세그먼트 매핑됨
          </div>
        </div>
      </div>

      {/* Bootloader & Hardware BOOTSZ Configuration Box */}
      <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-rose-400" />
            <h4 className="text-xs font-bold text-white">
              하드웨어 부트로더 (BOOTSZ 퓨즈 및 진입 주소 매핑)
            </h4>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">퓨즈 비트:</span>
            <span className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-500/40 text-rose-300 font-semibold">
              {currentBootOption.fuseBits}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-1">
          {spec.bootloaderOptions.map(opt => {
            const isSelected = bootloaderSizeBytes === opt.sizeBytes;
            return (
              <button
                key={opt.sizeBytes}
                onClick={() => setBootloaderSizeBytes(opt.sizeBytes)}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-rose-950/50 border-rose-500 text-white shadow-md shadow-rose-900/20'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">
                    {opt.sizeBytes === 0 ? '0 B' : `${(opt.sizeBytes / 1024).toFixed(1)} KB`}
                  </span>
                  {isSelected && <span className="w-2 h-2 rounded-full bg-rose-500" />}
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-1">
                  {opt.label.split(' - ')[1] || opt.label}
                </div>
                {opt.sizeBytes > 0 && (
                  <div className="text-[9px] font-mono text-rose-300/80 mt-1">
                    시작: {formatAddr(opt.bootResetByteAddr)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Segments Table & Real-Time Editor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white tracking-wide">
              세그먼트 파티션 상세 목록 & 크기 조정
            </h4>
          </div>
          <span className="text-xs text-slate-400">
            슬라이더나 입력창을 통해 크기/주소를 조정하면 레이아웃 스케일이 즉시 갱신됩니다
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/60">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-900/80 text-slate-400 font-medium border-b border-slate-800">
                <th className="py-2.5 px-3">상태</th>
                <th className="py-2.5 px-3">세그먼트 이름</th>
                <th className="py-2.5 px-3 font-mono">섹션 태그</th>
                <th className="py-2.5 px-3 font-mono">시작 주소</th>
                <th className="py-2.5 px-3 font-mono">끝 주소</th>
                <th className="py-2.5 px-3">크기 (바이트 / KB)</th>
                <th className="py-2.5 px-3 text-right">점유율</th>
                <th className="py-2.5 px-3 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {allActiveSegments.map(seg => {
                const endAddr = seg.startAddr + seg.sizeBytes;
                const isSelected = selectedSegId === seg.id;
                const percent = ((seg.sizeBytes / spec.totalBytes) * 100).toFixed(1);

                return (
                  <tr
                    key={seg.id}
                    onClick={() => setSelectedSegId(isSelected ? null : seg.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-950/40 text-white'
                        : 'hover:bg-slate-900/50'
                    }`}
                  >
                    {/* Status / Color indicator */}
                    <td className="py-2 px-3">
                      <span
                        className="w-3 h-3 rounded-full inline-block border border-white/20"
                        style={{ backgroundColor: seg.color }}
                      />
                    </td>

                    {/* Name */}
                    <td className="py-2 px-3 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span>{seg.name}</span>
                        {seg.isLocked && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                            고정
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        {seg.description}
                      </div>
                    </td>

                    {/* Section */}
                    <td className="py-2 px-3 font-mono text-cyan-300">
                      {seg.section}
                    </td>

                    {/* Start Address */}
                    <td className="py-2 px-3 font-mono text-slate-300">
                      {seg.isLocked ? (
                        formatAddr(seg.startAddr)
                      ) : (
                        <input
                          type="number"
                          value={seg.startAddr}
                          onClick={e => e.stopPropagation()}
                          onChange={e => handleUpdateSegmentAddress(seg.id, parseInt(e.target.value) || 0)}
                          className="w-24 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      )}
                    </td>

                    {/* End Address */}
                    <td className="py-2 px-3 font-mono text-slate-400">
                      {formatAddr(endAddr)}
                    </td>

                    {/* Size Editor */}
                    <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                      {seg.isLocked && seg.isVector ? (
                        <span className="font-mono text-slate-400">
                          {seg.sizeBytes.toLocaleString()} B ({spec.vectorCount} ISR)
                        </span>
                      ) : seg.isBootloader ? (
                        <span className="font-mono text-rose-300">
                          {seg.sizeBytes.toLocaleString()} B ({(seg.sizeBytes / 1024).toFixed(1)} KB)
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="64"
                            max={spec.totalBytes}
                            step="64"
                            value={seg.sizeBytes}
                            onChange={e => handleUpdateSegmentSize(seg.id, parseInt(e.target.value))}
                            className="w-24 accent-indigo-500"
                          />
                          <input
                            type="number"
                            value={seg.sizeBytes}
                            onChange={e => handleUpdateSegmentSize(seg.id, parseInt(e.target.value) || 0)}
                            className="w-20 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                          />
                          <span className="text-[11px] text-slate-500 font-mono">
                            {(seg.sizeBytes / 1024).toFixed(1)}K
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Percentage */}
                    <td className="py-2 px-3 text-right font-mono font-medium text-slate-400">
                      {percent}%
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 text-center" onClick={e => e.stopPropagation()}>
                      {!seg.isLocked && (
                        <button
                          onClick={() => handleRemoveSegment(seg.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                          title="세그먼트 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspector Panel for Selected Segment */}
      {activeSelectedSegment && (
        <div className="bg-slate-950/90 border border-indigo-500/40 rounded-xl p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full inline-block"
                style={{ backgroundColor: activeSelectedSegment.color }}
              />
              <h4 className="text-sm font-bold text-white">
                선택된 세그먼트 상세 분석: {activeSelectedSegment.name} ({activeSelectedSegment.section})
              </h4>
            </div>
            <button
              onClick={() => setSelectedSegId(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              닫기 ✕
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">시작 ~ 끝 주소</span>
              <span className="font-mono text-indigo-300 font-bold">
                {formatAddr(activeSelectedSegment.startAddr)} ~ {formatAddr(activeSelectedSegment.startAddr + activeSelectedSegment.sizeBytes)}
              </span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">점유 플래시 페이지</span>
              <span className="font-mono text-cyan-300 font-bold">
                Page {Math.floor(activeSelectedSegment.startAddr / spec.pageSizeBytes)} ~ {Math.floor((activeSelectedSegment.startAddr + activeSelectedSegment.sizeBytes - 1) / spec.pageSizeBytes)}
              </span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">크기 (Bytes / Words)</span>
              <span className="font-mono text-emerald-300 font-bold">
                {activeSelectedSegment.sizeBytes.toLocaleString()} B ({Math.floor(activeSelectedSegment.sizeBytes / 2).toLocaleString()} Words)
              </span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-500 block text-[10px]">GNU ld 링커 플래그</span>
              <span className="font-mono text-amber-300 font-bold truncate block" title={`-Wl,--section-start=${activeSelectedSegment.section}=0x${activeSelectedSegment.startAddr.toString(16).toUpperCase()}`}>
                -Wl,--section-start={activeSelectedSegment.section}=0x{activeSelectedSegment.startAddr.toString(16).toUpperCase()}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
            {activeSelectedSegment.description}
          </p>
        </div>
      )}

      {/* Code Generation / Linker Export Panel */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white tracking-wide">
              빌드 도구 연동 코드 & 링커 스크립트 생성기 (Code Generator)
            </h4>
          </div>

          {/* Code Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveCodeTab('gcc')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                activeCodeTab === 'gcc' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              avr-gcc 플래그
            </button>
            <button
              onClick={() => setActiveCodeTab('linker')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                activeCodeTab === 'linker' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              GNU ld 스크립트
            </button>
            <button
              onClick={() => setActiveCodeTab('c_source')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                activeCodeTab === 'c_source' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              C/C++ PROGMEM 소스
            </button>
            <button
              onClick={() => setActiveCodeTab('platformio')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                activeCodeTab === 'platformio' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              PlatformIO 설정
            </button>
          </div>
        </div>

        {/* Code Content Box */}
        <div className="relative">
          <pre className="bg-slate-900/90 text-slate-200 font-mono text-xs p-4 rounded-xl border border-slate-800 overflow-x-auto leading-relaxed max-h-72">
            {activeCodeTab === 'gcc' && generatedCode.gccCmd}
            {activeCodeTab === 'linker' && generatedCode.customLd}
            {activeCodeTab === 'c_source' && generatedCode.cFullCode}
            {activeCodeTab === 'platformio' && generatedCode.pioConfig}
          </pre>

          <button
            onClick={() => {
              const codeToCopy =
                activeCodeTab === 'gcc'
                  ? generatedCode.gccCmd
                  : activeCodeTab === 'linker'
                  ? generatedCode.customLd
                  : activeCodeTab === 'c_source'
                  ? generatedCode.cFullCode
                  : generatedCode.pioConfig;
              handleCopyCode(codeToCopy, activeCodeTab);
            }}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 shadow transition-all"
          >
            {copyFeedback === activeCodeTab ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">복사 완료!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>코드 복사</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal: Add Custom Segment */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                <h4 className="text-sm font-bold text-white">신규 플래시 세그먼트 정의</h4>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕ 닫기
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">세그먼트 표시 이름</label>
                <input
                  type="text"
                  value={newSegName}
                  onChange={e => setNewSegName(e.target.value)}
                  placeholder="예: OLED 폰트 테이블, 센서 교정 데이터"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">링커 섹션 식별자 (Section)</label>
                  <input
                    type="text"
                    value={newSegSection}
                    onChange={e => setNewSegSection(e.target.value)}
                    placeholder=".font_table"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">크기 (Bytes)</label>
                  <input
                    type="number"
                    min="1"
                    max={spec.totalBytes}
                    value={newSegSize}
                    onChange={e => setNewSegSize(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">배치 시작 주소 결정 방식</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewSegAddressMode('auto')}
                    className={`p-2 rounded-lg border text-left ${
                      newSegAddressMode === 'auto'
                        ? 'bg-indigo-950/60 border-indigo-500 text-white font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    자동 정렬 (Auto-Pack)
                    <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                      이전 세그먼트 바로 뒤에 연속 배치
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSegAddressMode('manual')}
                    className={`p-2 rounded-lg border text-left ${
                      newSegAddressMode === 'manual'
                        ? 'bg-indigo-950/60 border-indigo-500 text-white font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    수동 고정 주소 지정
                    <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                      원하는 플래시 시작 오프셋 설정
                    </span>
                  </button>
                </div>
              </div>

              {newSegAddressMode === 'manual' && (
                <div>
                  <label className="text-slate-400 font-medium block mb-1">수동 시작 바이트 주소 (Dec 또는 Hex)</label>
                  <input
                    type="number"
                    min="0"
                    max={spec.totalBytes - 1}
                    value={newSegManualAddr}
                    onChange={e => setNewSegManualAddr(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    16진수: {formatAddr(newSegManualAddr)}
                  </span>
                </div>
              )}

              <div>
                <label className="text-slate-400 font-medium block mb-1">세그먼트 색상 테마</label>
                <div className="flex items-center gap-2">
                  {['#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#06b6d4', '#84cc16', '#eab308'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewSegColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        newSegColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-80 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">용도 설명</label>
                <input
                  type="text"
                  value={newSegDesc}
                  onChange={e => setNewSegDesc(e.target.value)}
                  placeholder="예: 영문 8x16 비트맵 폰트 데이터 배열"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAddSegment}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow"
              >
                세그먼트 추가 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
