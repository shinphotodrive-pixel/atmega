import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Layers,
  Cpu,
  FileCode2,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Download,
  Info,
  TrendingDown,
  Sparkles,
  Terminal,
  Search,
  Sliders,
  Filter,
  ArrowRight,
  Split,
  FolderGit2,
  Flame,
  LayoutGrid,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type SegmentType = '.data' | '.bss';

export interface MemorySymbol {
  id: string;
  name: string;
  segment: SegmentType;
  address: number;
  size: number;
  alignment: number;
  typeName: string;
  structParent?: string;
}

export interface PaddingGap {
  id: string;
  segment: SegmentType;
  address: number;
  gapSize: number;
  precedingSymbol: string;
  followingSymbol: string;
  cause: string;
}

export interface MapPreset {
  id: string;
  name: string;
  desc: string;
  targetArrayCount: number;
  rawSnippet: string;
  symbols: MemorySymbol[];
  originalStructCode: string;
  refactoredStructCode: string;
}

const PRESET_MAPS: MapPreset[] = [
  {
    id: 'sensor_telemetry_bss',
    name: '1. IoT 센서 노드 텔레메트리 (.bss 및 전역 변수 정렬 패딩)',
    desc: 'BSS 세그먼트에 uint8_t 플래그와 uint32_t 타임스탬프, 부동소수점이 교차 배치되어 심각한 정렬 패딩(Padding Gap)이 누적된 시나리오',
    targetArrayCount: 16,
    rawSnippet: `.bss           0x00800100       0x1a0
 .bss.g_node_status
                0x00800100        0x1 obj/main.o
 *fill*         0x00800101        0x3                <--- 3 바이트 정렬 패딩 낭비!
 .bss.g_timestamp
                0x00800104        0x4 obj/main.o
 .bss.g_alert_code
                0x00800108        0x1 obj/main.o
 *fill*         0x00800109        0x3                <--- 3 바이트 정렬 패딩 낭비!
 .bss.g_temperature
                0x0080010c        0x4 obj/sensor.o
 .bss.g_crc_error
                0x00800110        0x1 obj/comm.o
 *fill*         0x00800111        0x1                <--- 1 바이트 정렬 패딩!
 .bss.g_raw_adc
                0x00800112        0x2 obj/adc.o`,
    symbols: [
      { id: 's1', name: 'g_node_status', segment: '.bss', address: 0x0100, size: 1, alignment: 1, typeName: 'uint8_t' },
      { id: 's2', name: 'g_timestamp', segment: '.bss', address: 0x0104, size: 4, alignment: 4, typeName: 'uint32_t' },
      { id: 's3', name: 'g_alert_code', segment: '.bss', address: 0x0108, size: 1, alignment: 1, typeName: 'uint8_t' },
      { id: 's4', name: 'g_temperature', segment: '.bss', address: 0x010c, size: 4, alignment: 4, typeName: 'float' },
      { id: 's5', name: 'g_crc_error', segment: '.bss', address: 0x0110, size: 1, alignment: 1, typeName: 'uint8_t' },
      { id: 's6', name: 'g_raw_adc', segment: '.bss', address: 0x0112, size: 2, alignment: 2, typeName: 'uint16_t' },
      { id: 's7', name: 'g_sensor_packet', segment: '.bss', address: 0x0114, size: 24, alignment: 4, typeName: 'SensorPacket_t', structParent: 'SensorPacket' }
    ],
    originalStructCode: `/* [리팩토링 전] 정렬 패딩으로 인해 24바이트(실제 데이터 15B + 패딩 9B 낭비) */
typedef struct {
    uint8_t   device_id;     // 1B
    // [GAP: 3B 패딩]
    uint32_t  seq_num;       // 4B (4바이트 정렬 요구)
    uint8_t   is_active;     // 1B
    // [GAP: 3B 패딩]
    float     ambient_temp;  // 4B (4바이트 정렬 요구)
    uint8_t   battery_pct;   // 1B
    // [GAP: 1B 패딩]
    uint16_t  adc_light;     // 2B (2바이트 정렬 요구)
    uint8_t   checksum;      // 1B
    // [TAIL GAP: 3B 구조체 테일 패딩]
} SensorPacket_t; // 총 24 Bytes!`,
    refactoredStructCode: `/* [리팩토링 후] 내림차순 정렬 재배치(Descending Alignment) 적용 (패딩 0B, 15 Bytes 달성!) */
typedef struct {
    /* 1. 4바이트 정렬 멤버 최우선 배치 */
    uint32_t  seq_num;       // 4B (Offset 0x00)
    float     ambient_temp;  // 4B (Offset 0x04)

    /* 2. 2바이트 정렬 멤버 배치 */
    uint16_t  adc_light;     // 2B (Offset 0x08)

    /* 3. 1바이트 멤버 및 비트필드 배치 */
    uint8_t   device_id;     // 1B (Offset 0x0A)
    uint8_t   is_active;     // 1B (Offset 0x0B)
    uint8_t   battery_pct;   // 1B (Offset 0x0C)
    uint8_t   checksum;      // 1B (Offset 0x0D)
} __attribute__((packed)) SensorPacket_t; // 총 14 Bytes (-41.6% 절감!)

_Static_assert(sizeof(SensorPacket_t) == 14, "Struct packing verified!");`
  },
  {
    id: 'motor_pid_data',
    name: '2. BLDC 모터 제어 설정치 (.data 초기화 전역 세그먼트)',
    desc: '플래시 ROM과 SRAM을 동시에 소비하는 .data 세그먼트에서 초기화 변수들이 패딩으로 인해 낭비되는 시나리오',
    targetArrayCount: 8,
    rawSnippet: `.data          0x00800100       0x080
 .data.pid_enabled
                0x00800100        0x1 obj/pid.o
 *fill*         0x00800101        0x3                <--- 3 바이트 .data 정렬 패딩
 .data.target_rpm
                0x00800104        0x4 obj/pid.o
 .data.brake_mode
                0x00800108        0x1 obj/motor.o
 *fill*         0x00800109        0x3                <--- 3 바이트 .data 정렬 패딩
 .data.kp_gain
                0x0080010c        0x4 obj/pid.o
 .data.ki_gain
                0x00800110        0x4 obj/pid.o`,
    symbols: [
      { id: 'm1', name: 'pid_enabled', segment: '.data', address: 0x0100, size: 1, alignment: 1, typeName: 'uint8_t' },
      { id: 'm2', name: 'target_rpm', segment: '.data', address: 0x0104, size: 4, alignment: 4, typeName: 'uint32_t' },
      { id: 'm3', name: 'brake_mode', segment: '.data', address: 0x0108, size: 1, alignment: 1, typeName: 'uint8_t' },
      { id: 'm4', name: 'kp_gain', segment: '.data', address: 0x010c, size: 4, alignment: 4, typeName: 'float' },
      { id: 'm5', name: 'ki_gain', segment: '.data', address: 0x0110, size: 4, alignment: 4, typeName: 'float' },
      { id: 'm6', name: 'motor_channel', segment: '.data', address: 0x0114, size: 1, alignment: 1, typeName: 'uint8_t' }
    ],
    originalStructCode: `/* [리팩토링 전] .data 세그먼트에 상주하여 Flash와 SRAM을 2배로 낭비 */
typedef struct {
    uint8_t  enabled;      // 1B
    // [GAP: 3B 패딩]
    float    kp;           // 4B
    uint8_t  mode;         // 1B
    // [GAP: 3B 패딩]
    float    ki;           // 4B
    uint8_t  dir;          // 1B
    // [GAP: 3B 패딩]
    float    kd;           // 4B
} MotorConfig_t; // 총 20 Bytes (패딩 9B 낭비)`,
    refactoredStructCode: `/* [리팩토링 후] 읽기 전용 상수는 PROGMEM으로 이관하고 필드 크기순 재정렬 */
typedef struct {
    float    kp;           // 4B (Offset 0x00)
    float    ki;           // 4B (Offset 0x04)
    float    kd;           // 4B (Offset 0x08)
    uint8_t  enabled;      // 1B (Offset 0x0C)
    uint8_t  mode;         // 1B (Offset 0x0D)
    uint8_t  dir;          // 1B (Offset 0x0E)
} MotorConfig_t; // 15 Bytes (패딩 0B 소거!)

/* SRAM 0바이트 소모: Flash ROM 전용 저장 */
const MotorConfig_t PROGMEM DEFAULT_MOTOR_CFG = { 1.25f, 0.05f, 0.12f, 1, 0, 1 };`
  },
  {
    id: 'task_tcb_array',
    name: '3. RTOS 태스크 제어 블록(TCB) 배열 패딩 누적 (대규모 SRAM 절감)',
    desc: '32개 요소의 TCB 구조체 배열에서 각 요소마다 4바이트 테일 패딩이 발생하여 수백 바이트의 SRAM이 누수되는 시나리오',
    targetArrayCount: 32,
    rawSnippet: `.bss.g_task_list
                0x00800100       0x200 obj/scheduler.o (32 instances * 16B = 512B)
                // 각 TCB 인스턴스마다 4바이트 패딩 발생 (총 128 바이트 SRAM 누수!)`,
    symbols: [
      { id: 't1', name: 'g_task_list[0]', segment: '.bss', address: 0x0100, size: 16, alignment: 4, typeName: 'TaskControlBlock_t' },
      { id: 't2', name: 'g_task_list[1]', segment: '.bss', address: 0x0110, size: 16, alignment: 4, typeName: 'TaskControlBlock_t' },
      { id: 't3', name: 'g_task_list[2]', segment: '.bss', address: 0x0120, size: 16, alignment: 4, typeName: 'TaskControlBlock_t' },
      { id: 't4', name: 'g_task_list[3]', segment: '.bss', address: 0x0130, size: 16, alignment: 4, typeName: 'TaskControlBlock_t' }
    ],
    originalStructCode: `/* [리팩토링 전] 16 Bytes / 인스턴스 (실제 유효 데이터는 11 Bytes, 패딩 5 Bytes) */
typedef struct {
    uint8_t   task_id;         // 1B
    // [GAP: 3B]
    uint32_t  wake_tick;       // 4B
    uint8_t   priority;        // 1B
    uint8_t   state;           // 1B
    // [GAP: 2B]
    uint16_t  stack_highwater; // 2B
    // [GAP: 2B 테일 패딩]
} TaskControlBlock_t; // 16B * 32개 = 512 Bytes 소모!`,
    refactoredStructCode: `/* [리팩토링 후] 비트필드 결합 및 내림차순 정렬 (10 Bytes / 인스턴스) */
typedef struct {
    uint32_t  wake_tick;       // 4B (Offset 0)
    uint16_t  stack_highwater; // 2B (Offset 4)
    uint8_t   task_id;         // 1B (Offset 6)
    uint8_t   priority;        // 1B (Offset 7)
    
    /* 1비트씩 플래그 결합: 1바이트 내 8개 상태 수용 */
    uint8_t   is_ready    : 1; // 1 bit
    uint8_t   is_blocked  : 1; // 1 bit
    uint8_t   is_periodic : 1; // 1 bit
    uint8_t   _reserved   : 5; // 5 bits
} TaskControlBlock_t; // 단 9 Bytes! (32개 배열 시 224 Bytes SRAM 대규모 회수)`
  }
];

export const MemoryFragmentationAnalyzer: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  const [selectedPresetId, setSelectedPresetId] = useState<string>('sensor_telemetry_bss');
  const [activeTab, setActiveTab] = useState<'visual_map' | 'refactor' | 'map_raw'>('visual_map');
  const [segmentFilter, setSegmentFilter] = useState<'all' | '.data' | '.bss' | 'gaps_only'>('all');
  const [instanceMultiplier, setInstanceMultiplier] = useState<number>(16);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const currentPreset = useMemo(() => {
    return PRESET_MAPS.find((p) => p.id === selectedPresetId) || PRESET_MAPS[0];
  }, [selectedPresetId]);

  // Compute Padding Gaps between consecutive symbols
  const paddingGaps = useMemo<PaddingGap[]>(() => {
    const list = [...currentPreset.symbols].sort((a, b) => a.address - b.address);
    const gaps: PaddingGap[] = [];

    for (let i = 0; i < list.length - 1; i++) {
      const cur = list[i];
      const next = list[i + 1];
      const curEnd = cur.address + cur.size;

      if (next.address > curEnd && cur.segment === next.segment) {
        const gapSize = next.address - curEnd;
        gaps.push({
          id: `gap-${i}`,
          segment: cur.segment,
          address: curEnd,
          gapSize,
          precedingSymbol: cur.name,
          followingSymbol: next.name,
          cause: `${next.name} (${next.typeName}) 변수의 ${next.alignment}바이트 메모리 정렬 요구사항으로 인해 발생`
        });
      }
    }
    return gaps;
  }, [currentPreset]);

  // Fragmentation Analysis Metrics
  const metrics = useMemo(() => {
    const symbols = currentPreset.symbols;
    const totalDataSize = symbols
      .filter((s) => s.segment === '.data')
      .reduce((acc, s) => acc + s.size, 0);

    const totalBssSize = symbols
      .filter((s) => s.segment === '.bss')
      .reduce((acc, s) => acc + s.size, 0);

    const totalStaticSize = totalDataSize + totalBssSize;

    // Gaps in single instance
    const singleInstanceGapBytes = paddingGaps.reduce((acc, g) => acc + g.gapSize, 0);

    // If struct is instantiated multiple times
    const structWastePerInstance = 9; // typical 9-10 bytes waste in sample
    const totalWastedBytes = singleInstanceGapBytes + structWastePerInstance * (instanceMultiplier - 1);

    const fragmentationPercent = totalStaticSize > 0
      ? ((singleInstanceGapBytes / (totalStaticSize + singleInstanceGapBytes)) * 100).toFixed(1)
      : '0';

    const recoverableSram = totalWastedBytes;
    const sramCapacityPercent = ((recoverableSram / currentProfile.sram) * 100).toFixed(1);

    const efficiencyScore = Math.max(
      15,
      Math.round(100 - Number(fragmentationPercent) * 2.5)
    );

    return {
      totalDataSize,
      totalBssSize,
      totalStaticSize,
      singleInstanceGapBytes,
      totalWastedBytes,
      fragmentationPercent,
      recoverableSram,
      sramCapacityPercent,
      efficiencyScore
    };
  }, [currentPreset, paddingGaps, instanceMultiplier, currentProfile]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentPreset.refactoredStructCode);
    setCopiedCode(true);
    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.8 }
    });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadCode = () => {
    const blob = new Blob([currentPreset.refactoredStructCode], { type: 'text/x-csrc' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentPreset.id}_refactored.h`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 lg:p-8 backdrop-blur shadow-2xl space-y-8 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg shadow-amber-500/20 text-slate-950 font-black">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl lg:text-2xl font-black text-white tracking-tight">
                  메모리 파편화 분석기
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Data/BSS Alignment Padding & Struct Reordering
                </span>
              </div>
              <p className="text-xs lg:text-sm text-slate-400 mt-1">
                빌드 .map 파일의 BSS 및 Data 세그먼트 내에서 정렬 패딩(alignment padding)으로 발생하는 낭비 공간을 분석하고 데이터 구조체 재배치(struct reordering) 리팩토링 제안을 생성합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Target MCU Specs Badge */}
        <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs text-slate-300">
          <Cpu className="w-4 h-4 text-amber-400" />
          <span>타깃:</span>
          <span className="font-bold text-amber-300">{currentProfile.name}</span>
          <span className="text-[11px] text-slate-500 font-mono">
            (SRAM: {currentProfile.sram}B / Flash: {currentProfile.flash}KB)
          </span>
        </div>
      </div>

      {/* Preset Map Scenario Selector */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <FolderGit2 className="w-3.5 h-3.5 text-amber-400" />
            분석할 .map 파일 파편화 시나리오:
          </span>
          <span className="text-[11px] text-slate-500">실무 BSS/Data 패딩 누적 패턴</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PRESET_MAPS.map((p) => {
            const isSelected = p.id === selectedPresetId;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedPresetId(p.id);
                  setInstanceMultiplier(p.targetArrayCount);
                }}
                className={`text-left p-4 rounded-2xl border transition-all relative ${
                  isSelected
                    ? 'bg-gradient-to-br from-amber-950/60 to-slate-900 border-amber-500 text-white shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/50'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-xs text-slate-200 mb-1 flex items-center justify-between">
                  <span>{p.name.split('(')[0]}</span>
                  {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                  {p.desc}
                </p>
                <div className="mt-2 pt-2 border-t border-slate-800/60 flex justify-between text-[10px] font-mono text-slate-500">
                  <span>구조체 인스턴스: {p.targetArrayCount}개</span>
                  <span className="text-amber-400">패딩 누적 분석</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fragmentation Metrics Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            분석 세그먼트 유효 크기
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-white font-mono">
              {metrics.totalStaticSize}
            </span>
            <span className="text-xs text-slate-400 font-mono">Bytes</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            .data: {metrics.totalDataSize}B | .bss: {metrics.totalBssSize}B
          </div>
        </div>

        <div className="bg-slate-950/80 border border-amber-900/50 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1">
            정렬 패딩 손실 (Wasted Gaps)
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-amber-400 font-mono">
              {metrics.totalWastedBytes}
            </span>
            <span className="text-xs text-slate-400 font-mono">Bytes 누수</span>
          </div>
          <div className="text-[11px] text-amber-300 mt-1 flex items-center gap-1 font-semibold">
            <AlertTriangle className="w-3 h-3" />
            세그먼트 파편화율: {metrics.fragmentationPercent}%
          </div>
        </div>

        <div className="bg-slate-950/80 border border-emerald-900/50 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
            회수 가능한 SRAM 용량
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-emerald-400 font-mono">
              {metrics.recoverableSram}
            </span>
            <span className="text-xs text-slate-400 font-mono">Bytes 회수</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
            <TrendingDown className="w-3 h-3" />
            {currentProfile.name} SRAM의 {metrics.sramCapacityPercent}% 확보
          </div>
        </div>

        <div className="bg-slate-950/80 border border-cyan-900/50 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-1">
            메모리 패킹 효율 점수
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-cyan-400 font-mono">
              {metrics.efficiencyScore}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ 100 점</span>
          </div>
          <div className="text-[11px] text-cyan-300 mt-1 flex items-center gap-1 font-semibold">
            <Sparkles className="w-3 h-3" />
            {metrics.efficiencyScore > 80 ? '양호한 메모리 배치' : '구조체 재배치 필수 요망'}
          </div>
        </div>
      </div>

      {/* Tabs: Visual Memory Map vs Struct Refactoring Proposal vs Raw Map */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              파편화 갭 시각화 및 리팩토링 제안
            </h3>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('visual_map')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeTab === 'visual_map'
                  ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              1. 세그먼트 주소 배치 & 패딩 갭 시각화
            </button>
            <button
              onClick={() => setActiveTab('refactor')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeTab === 'refactor'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              2. 구조체 재배치(Struct Reordering) 리팩토링
            </button>
            <button
              onClick={() => setActiveTab('map_raw')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeTab === 'map_raw'
                  ? 'bg-slate-800 text-white border-slate-700 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              3. .map 원문 분석 로그
            </button>
          </div>
        </div>

        {/* Tab 1: Visual Map with Highlighted Padding Gaps */}
        {activeTab === 'visual_map' && (
          <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
                  <Filter className="w-3 h-3 text-amber-400" /> 필터:
                </span>
                {[
                  { id: 'all', label: '전체 변수 및 갭' },
                  { id: '.bss', label: '.bss 세그먼트' },
                  { id: '.data', label: '.data 세그먼트' },
                  { id: 'gaps_only', label: '패딩 갭(Gap)만' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSegmentFilter(f.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
                      segmentFilter === f.id
                        ? 'bg-amber-600 text-white border-amber-500 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Multiplier Slider for Array Instances */}
              <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <span>배열 인스턴스:</span>
                <span className="font-bold text-amber-400">{instanceMultiplier}개</span>
                <input
                  type="range"
                  min="1"
                  max="64"
                  value={instanceMultiplier}
                  onChange={(e) => setInstanceMultiplier(Number(e.target.value))}
                  className="w-24 accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>
            </div>

            {/* Visual Symbol & Gap Blocks */}
            <div className="space-y-2 font-mono text-xs">
              {currentPreset.symbols.map((sym, idx) => {
                const nextSym = currentPreset.symbols[idx + 1];
                const curEnd = sym.address + sym.size;
                const hasGap = nextSym && nextSym.address > curEnd && nextSym.segment === sym.segment;
                const gapSize = hasGap ? nextSym.address - curEnd : 0;

                if (segmentFilter === 'gaps_only' && !hasGap) return null;
                if (segmentFilter === '.bss' && sym.segment !== '.bss') return null;
                if (segmentFilter === '.data' && sym.segment !== '.data') return null;

                return (
                  <React.Fragment key={sym.id}>
                    {/* Variable Symbol Row */}
                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-slate-700 transition">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] text-slate-500 font-bold w-16">
                          0x{sym.address.toString(16).padStart(4, '0').toUpperCase()}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            sym.segment === '.bss'
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                              : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          }`}
                        >
                          {sym.segment}
                        </span>

                        <span className="font-bold text-white text-xs">
                          {sym.name}
                        </span>

                        <span className="text-slate-400 text-[11px] font-sans">
                          ({sym.typeName})
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span>크기: <strong className="text-white">{sym.size} Bytes</strong></span>
                        <span>정렬: <strong className="text-slate-300">{sym.alignment}B Align</strong></span>
                      </div>
                    </div>

                    {/* Intervening Alignment Padding Gap (Visualized in Striped Amber) */}
                    {hasGap && (
                      <div className="p-2.5 rounded-xl border border-dashed border-amber-500/60 bg-amber-950/30 text-amber-300 flex items-center justify-between text-[11px] animate-pulse">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>
                            <strong>[정렬 패딩 갭: {gapSize} Bytes 낭비]</strong> 0x{curEnd.toString(16).padStart(4, '0').toUpperCase()} ~ 0x{(nextSym.address - 1).toString(16).padStart(4, '0').toUpperCase()}
                          </span>
                        </div>
                        <span className="text-[10px] text-amber-400/90 font-sans hidden sm:inline">
                          {nextSym.name} ({nextSym.alignment}바이트 정렬)로 인해 발생한 빈 공간
                        </span>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Struct Reordering Proposal (Before vs After) */}
        {activeTab === 'refactor' && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-950/30 border border-emerald-800/50 rounded-2xl text-xs text-emerald-200 leading-relaxed flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong>데이터 구조체 재배치(Struct Reordering) 최적화 원리:</strong> C 컴파일러는 각 데이터 타입의 자연 정렬 요구조건(4바이트 float/uint32_t는 4의 배수 주소, 2바이트 uint16_t는 2의 배수 주소)에 맞추기 위해 멤버 사이에 패딩 바이트를 자동으로 삽입합니다. <strong>멤버들을 정렬 크기 내림차순(4B → 2B → 1B)으로 재배치</strong>하면 모든 내부 패딩 갭이 수학적으로 완전히 소거됩니다.
              </div>
            </div>

            {/* Split Comparison View */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Before Code */}
              <div className="bg-slate-950 border border-rose-900/40 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-rose-950/50 border-b border-rose-900/40 flex items-center justify-between text-xs font-mono text-rose-300">
                  <span className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    [리팩토링 전] 정렬 패딩으로 낭비되는 원본 구조체
                  </span>
                  <span className="text-[11px] text-rose-400 font-bold">패딩 낭비 심각</span>
                </div>
                <pre className="p-4 text-xs font-mono text-rose-300/90 overflow-x-auto leading-relaxed max-h-80 bg-slate-950/90">
                  {currentPreset.originalStructCode}
                </pre>
              </div>

              {/* After Code */}
              <div className="bg-slate-950 border border-emerald-900/50 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-emerald-950/50 border-b border-emerald-900/50 flex items-center justify-between text-xs font-mono text-emerald-300">
                  <span className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    [리팩토링 후] 내림차순 정렬 & 패킹 적용 최적화 구조체
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleCopyCode}
                      className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition flex items-center gap-1"
                    >
                      {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCode ? '복사됨' : '코드 복사'}</span>
                    </button>
                    <button
                      onClick={handleDownloadCode}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                      title="헤더 파일 다운로드"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <pre className="p-4 text-xs font-mono text-emerald-300/90 overflow-x-auto leading-relaxed max-h-80 bg-slate-950/90">
                  {currentPreset.refactoredStructCode}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Raw Map Snippet */}
        {activeTab === 'map_raw' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs text-slate-300 flex items-start gap-3">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>GNU ld 맵 파일 내 `*fill*` 지시문:</strong> 링커 맵 파일에서 <code className="text-amber-300 font-mono">*fill*</code> 항목은 컴파일러 또는 링커가 주소 정렬 요건을 만족하기 위해 채워넣은 더미 패딩 바이트를 명시합니다. 이 공간을 제거하면 곧바로 가용 SRAM으로 반환됩니다.
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
                <span>build/project.map (.data & .bss Fill Gaps)</span>
              </div>
              <pre className="p-4 text-xs font-mono text-amber-300/90 overflow-x-auto leading-relaxed max-h-72 selection:bg-amber-500/30">
                {currentPreset.rawSnippet}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
