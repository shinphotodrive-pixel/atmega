import React, { useState, useMemo, useEffect } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Layers,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Download,
  Info,
  Sparkles,
  RefreshCw,
  Terminal,
  Search,
  Filter,
  FileCode2,
  Trash2,
  Play,
  Pause,
  RotateCcw,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export interface AllocEvent {
  id: string;
  type: 'malloc' | 'free';
  ptr: number;
  size: number;
  fileLine?: string;
  timestampMs: number;
  rawText: string;
}

export interface HeapBlock {
  ptr: number;
  size: number;
  allocId: string;
  allocTimestamp: number;
  fileLine: string;
  isFreed: boolean;
  freedTimestamp?: number;
  isLeaked: boolean;
}

// Preset Scenarios
const PRESET_SCENARIOS = [
  {
    name: '체커보드 힙 단편화 시나리오 (Severe Heap Fragmentation)',
    tag: '단편화율 75%+',
    desc: '작은 16B 버퍼와 큰 64B 버퍼를 교차 할당 후 작은 버퍼만 해제하여 연속 여유 공간이 파편화되는 전형적인 임베디드 버그',
    log: `[001] MALLOC ptr=0x0250 size=16 file=parser.c:32
[002] MALLOC ptr=0x0260 size=64 file=buffer.c:15
[003] MALLOC ptr=0x02A0 size=16 file=parser.c:32
[004] MALLOC ptr=0x02B0 size=64 file=buffer.c:15
[005] MALLOC ptr=0x02F0 size=16 file=parser.c:32
[006] MALLOC ptr=0x0300 size=64 file=buffer.c:15
[007] MALLOC ptr=0x0340 size=16 file=parser.c:32
[008] MALLOC ptr=0x0350 size=64 file=buffer.c:15
[009] FREE   ptr=0x0250 file=parser.c:48
[010] FREE   ptr=0x02A0 file=parser.c:48
[011] FREE   ptr=0x02F0 file=parser.c:48
[012] FREE   ptr=0x0340 file=parser.c:48`
  },
  {
    name: '통신 패킷 메모리 누수 시나리오 (Memory Leak Detection)',
    tag: '누수 발생',
    desc: 'UART 수신 인터럽트 핸들러에서 32B 패킷을 계속 할당하나 에러 발생 분기에서 free() 호출이 누락되어 SRAM이 고갈되는 시나리오',
    log: `[001] MALLOC ptr=0x0250 size=32 file=uart_rx.c:84
[002] MALLOC ptr=0x0270 size=32 file=uart_rx.c:84
[003] FREE   ptr=0x0250 file=process.c:120
[004] MALLOC ptr=0x0290 size=32 file=uart_rx.c:84
[005] MALLOC ptr=0x02B0 size=64 file=sensor_dht.c:42
[006] MALLOC ptr=0x02F0 size=32 file=uart_rx.c:84
[007] FREE   ptr=0x0290 file=process.c:120
[008] MALLOC ptr=0x0310 size=32 file=uart_rx.c:84
[009] MALLOC ptr=0x0330 size=128 file=json_encode.c:60
[010] MALLOC ptr=0x03B0 size=32 file=uart_rx.c:84`
  },
  {
    name: '스택-힙 충돌 위험 시나리오 (Stack Collision Hazard)',
    tag: '충돌 임박',
    desc: 'SRAM 용량이 작은 AVR 환경에서 거대 그래픽 버퍼(1,200 바이트)를 동적 할당하여 __brkval이 스택 포인터(SP) 영역을 침범하는 위험',
    log: `[001] MALLOC ptr=0x0250 size=128 file=oled_font.c:12
[002] MALLOC ptr=0x02D0 size=1024 file=framebuffer.c:50
[003] MALLOC ptr=0x06D0 size=256 file=lut_table.c:20
[004] MALLOC ptr=0x07D0 size=128 file=network_pkt.c:19`
  },
  {
    name: '정상 할당/해제 라이프사이클 (Clean RAII Pattern)',
    tag: '누수 0건',
    desc: '할당된 모든 힙 블록이 정해진 스코프 종료 시 정상적으로 해제되어 단편화와 누수가 없는 안전한 패턴',
    log: `[001] MALLOC ptr=0x0250 size=64 file=crypto.c:20
[002] MALLOC ptr=0x0290 size=128 file=modbus.c:35
[003] FREE   ptr=0x0290 file=modbus.c:80
[004] FREE   ptr=0x0250 file=crypto.c:55`
  }
];

export const DynamicMemoryAllocationTracker: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Total SRAM Specs in Bytes
  const sramSpecs = useMemo(() => {
    let totalSram = 2048; // ATmega328P
    let heapBase = 0x0200;
    let ramEnd = 0x08FF;

    if (selectedMCU === 'atmega128') {
      totalSram = 4096;
      heapBase = 0x0200;
      ramEnd = 0x10FF;
    } else if (selectedMCU === 'atmega640') {
      totalSram = 8192;
      heapBase = 0x0200;
      ramEnd = 0x21FF;
    }

    return { totalSram, heapBase, ramEnd };
  }, [selectedMCU]);

  const [rawLogText, setRawLogText] = useState<string>(PRESET_SCENARIOS[0].log);
  const [filterMode, setFilterMode] = useState<'all' | 'leaked' | 'active' | 'freed'>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedBlockPtr, setSelectedBlockPtr] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Parse Raw Logs into Allocation Events
  const parsedEvents = useMemo<AllocEvent[]>(() => {
    const lines = rawLogText.split('\n');
    const events: AllocEvent[] = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const isAlloc = /malloc/i.test(trimmed);
      const isFree = /free/i.test(trimmed);

      if (!isAlloc && !isFree) return;

      // Extract pointer (e.g. ptr=0x0250, or 0x0250, or -> 0x0250)
      const ptrMatch = trimmed.match(/ptr\s*=\s*(0x[0-9a-fA-F]+)/i) ||
                       trimmed.match(/(0x[0-9a-fA-F]{3,5})/i) ||
                       trimmed.match(/->\s*(0x[0-9a-fA-F]+)/i);

      // Extract size (e.g. size=64 or malloc(64))
      const sizeMatch = trimmed.match(/size\s*=\s*(\d+)/i) ||
                        trimmed.match(/malloc\s*\(\s*(\d+)\s*\)/i);

      // Extract file:line (e.g. file=parser.c:32)
      const fileMatch = trimmed.match(/file\s*=\s*([a-zA-Z0-9_\-\./]+:\d+)/i) ||
                        trimmed.match(/([a-zA-Z0-9_\-\.]+\.[ch]:\d+)/i);

      const ptrVal = ptrMatch ? parseInt(ptrMatch[1], 16) : sramSpecs.heapBase + idx * 32;
      const sizeVal = sizeMatch ? parseInt(sizeMatch[1], 10) : 32;
      const fileLine = fileMatch ? fileMatch[1] : `app.c:${idx + 10}`;

      events.push({
        id: `ev_${idx}`,
        type: isAlloc ? 'malloc' : 'free',
        ptr: ptrVal,
        size: sizeVal,
        fileLine,
        timestampMs: idx * 25 + 10,
        rawText: trimmed
      });
    });

    return events;
  }, [rawLogText, sramSpecs.heapBase]);

  // Construct Heap Memory State & Detect Leaks
  const heapAnalysis = useMemo(() => {
    const blocksMap = new Map<number, HeapBlock>();
    const allAllocations: HeapBlock[] = [];

    // Process events chronologically
    parsedEvents.forEach((ev) => {
      if (ev.type === 'malloc') {
        const block: HeapBlock = {
          ptr: ev.ptr,
          size: ev.size,
          allocId: ev.id,
          allocTimestamp: ev.timestampMs,
          fileLine: ev.fileLine || 'unknown',
          isFreed: false,
          isLeaked: true // Initially assumed leaked until freed
        };
        blocksMap.set(ev.ptr, block);
        allAllocations.push(block);
      } else if (ev.type === 'free') {
        const target = blocksMap.get(ev.ptr);
        if (target) {
          target.isFreed = true;
          target.isLeaked = false;
          target.freedTimestamp = ev.timestampMs;
        }
      }
    });

    // Active blocks currently occupying memory
    const activeBlocks = allAllocations.filter((b) => !b.isFreed);
    const freedBlocks = allAllocations.filter((b) => b.isFreed);
    const leakedBlocks = allAllocations.filter((b) => b.isLeaked);

    // Calculate memory stats
    const totalAllocatedBytes = activeBlocks.reduce((acc, b) => acc + b.size, 0);
    const totalLeakedBytes = leakedBlocks.reduce((acc, b) => acc + b.size, 0);

    // Sort active and freed blocks by address to analyze holes & fragmentation
    const sortedAll = [...allAllocations].sort((a, b) => a.ptr - b.ptr);

    // Find highest heap watermark (__brkval)
    let maxAddr = sramSpecs.heapBase;
    sortedAll.forEach((b) => {
      if (b.ptr + b.size > maxAddr) {
        maxAddr = b.ptr + b.size;
      }
    });

    const heapSpan = Math.max(0, maxAddr - sramSpecs.heapBase);

    // Calculate free holes inside the active heap region
    const holes: { start: number; size: number }[] = [];
    freedBlocks.forEach((fb) => {
      holes.push({ start: fb.ptr, size: fb.size });
    });

    const totalHoleBytes = holes.reduce((acc, h) => acc + h.size, 0);
    const largestHoleBytes = holes.length > 0 ? Math.max(...holes.map((h) => h.size)) : 0;

    // External Fragmentation Index:
    // If total free memory in heap > 0, Frag = (1 - (largest_free_block / total_free)) * 100%
    let fragmentationPct = 0;
    if (totalHoleBytes > 0) {
      fragmentationPct = Math.round((1 - largestHoleBytes / totalHoleBytes) * 100);
    }

    // Stack safety margin estimation (Assume Stack starts from RAMEND and grows down)
    const simulatedStackSize = 350; // typical ISR + local vars stack depth
    const stackTopAddr = sramSpecs.ramEnd - simulatedStackSize;
    const stackCollisionMargin = stackTopAddr - maxAddr;
    const isStackCollisionRisk = stackCollisionMargin < 128;

    return {
      allAllocations,
      activeBlocks,
      freedBlocks,
      leakedBlocks,
      totalAllocatedBytes,
      totalLeakedBytes,
      maxAddr,
      heapSpan,
      holes,
      totalHoleBytes,
      largestHoleBytes,
      fragmentationPct,
      stackCollisionMargin,
      isStackCollisionRisk
    };
  }, [parsedEvents, sramSpecs]);

  // Filtered Table List
  const displayedAllocations = useMemo(() => {
    return heapAnalysis.allAllocations.filter((b) => {
      if (filterMode === 'leaked' && !b.isLeaked) return false;
      if (filterMode === 'active' && b.isFreed) return false;
      if (filterMode === 'freed' && !b.isFreed) return false;

      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        const ptrHex = `0x${b.ptr.toString(16).toLowerCase()}`;
        return ptrHex.includes(q) || b.fileLine.toLowerCase().includes(q) || b.size.toString().includes(q);
      }
      return true;
    });
  }, [heapAnalysis.allAllocations, filterMode, searchFilter]);

  // Recommended C Code Wrapper Template
  const safeMallocCCode = useMemo(() => {
    return `/**
 * @file   safe_heap_tracker.h
 * @brief  AVR 힙 메모리 누수 방지 및 단편화 진단 래퍼
 * @target ${currentProfile.name} (SRAM: ${sramSpecs.totalSram} Bytes)
 */

#ifndef SAFE_HEAP_TRACKER_H
#define SAFE_HEAP_TRACKER_H

#include <stdlib.h>
#include <stdio.h>
#include <avr/io.h>

extern char *__brkval;
extern char __heap_start;

// 1. 현재 사용 가능한 잔여 힙/스택 여유 공간(Free RAM) 계산
static inline int free_ram(void) {
    char top_of_stack;
    return __brkval == 0 ? 
        ((int)&top_of_stack - (int)&__heap_start) : 
        ((int)&top_of_stack - (int)__brkval);
}

// 2. 단편화 방지 및 누수 추적용 malloc 래퍼 매크로
#define SAFE_MALLOC(size) \\
    tracked_malloc(size, __FILE__, __LINE__)

#define SAFE_FREE(ptr) \\
    tracked_free(ptr, __FILE__, __LINE__)

static inline void* tracked_malloc(size_t size, const char* file, int line) {
    if (free_ram() < (int)size + 64) {
        // [경고] 스택-힙 충돌 위험 임계치 도달! 할당 거부
        printf("[OUT_OF_MEMORY] %s:%d (Req: %uB, Free: %dB)\\r\\n", file, line, (unsigned)size, free_ram());
        return NULL;
    }
    void* ptr = malloc(size);
    printf("[MALLOC] ptr=0x%04X size=%u file=%s:%d\\r\\n", (unsigned int)(uintptr_t)ptr, (unsigned)size, file, line);
    return ptr;
}

static inline void tracked_free(void* ptr, const char* file, int line) {
    if (ptr != NULL) {
        printf("[FREE] ptr=0x%04X file=%s:%d\\r\\n", (unsigned int)(uintptr_t)ptr, file, line);
        free(ptr);
    }
}

#endif // SAFE_HEAP_TRACKER_H
`;
  }, [currentProfile.name, sramSpecs.totalSram]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(safeMallocCCode);
      setCopiedCode(true);
      confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 } });
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {}
  };

  const handleDownloadCode = () => {
    const blob = new Blob([safeMallocCCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `safe_heap_tracker.h`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-7 shadow-2xl backdrop-blur">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
              <Layers className="w-3.5 h-3.5" /> 힙 메모리 프로파일러 (Heap Profiler)
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              SRAM: {sramSpecs.totalSram} Bytes (0x{sramSpecs.heapBase.toString(16).toUpperCase()} ~ 0x{sramSpecs.ramEnd.toString(16).toUpperCase()})
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-rose-950/60 text-rose-300 border border-rose-800/40 text-xs font-mono font-bold">
              {currentProfile.name}
            </span>
            {heapAnalysis.leakedBlocks.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-md bg-red-950/80 text-red-300 border border-red-700/60 text-xs font-mono font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-400" />
                누수 {heapAnalysis.leakedBlocks.length}건 ({heapAnalysis.totalLeakedBytes}B)
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            동적 메모리 할당(malloc/free) 추적기 & 힙 단편화 분석기
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            임베디드 펌웨어 런타임에서 발생하는 malloc/free 로그를 실시간 파싱하여 힙 내부의 빈 공간 구멍(Holes)과 외부 단편화율(External Fragmentation)을 시각화하고, 해제되지 않은 메모리 누수(Memory Leak) 지점을 정확히 색출합니다.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyCode}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/20 flex items-center gap-1.5"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? '복사 완료!' : '안전 래퍼 C 코드'}</span>
          </button>
          <button
            onClick={handleDownloadCode}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.h 다운로드</span>
          </button>
        </div>
      </div>

      {/* Preset Scenarios Quick Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>테스트 시나리오 프리셋 선택 (Test Scenarios):</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {PRESET_SCENARIOS.map((sc, idx) => (
            <button
              key={idx}
              onClick={() => {
                setRawLogText(sc.log);
                confetti({ particleCount: 20, spread: 50, origin: { y: 0.7 } });
              }}
              className="p-3 rounded-2xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/50 text-left transition group"
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/40">
                  {sc.tag}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">#{idx + 1}</span>
              </div>
              <p className="text-xs font-bold text-slate-200 group-hover:text-rose-300 truncate">
                {sc.name}
              </p>
              <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                {sc.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Metric Dashcards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">총 할당 힙 크기</span>
          <span className="text-base font-bold text-cyan-400 font-mono">
            {heapAnalysis.totalAllocatedBytes} B
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            SRAM의 {((heapAnalysis.totalAllocatedBytes / sramSpecs.totalSram) * 100).toFixed(1)}% 점유
          </span>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">외부 단편화율</span>
          <span className={`text-base font-bold font-mono ${
            heapAnalysis.fragmentationPct > 50 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {heapAnalysis.fragmentationPct}%
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            홀(Hole): {heapAnalysis.holes.length}개 ({heapAnalysis.totalHoleBytes}B)
          </span>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">최대 연속 여유 블록</span>
          <span className="text-base font-bold text-violet-400 font-mono">
            {heapAnalysis.largestHoleBytes} B
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            단일 malloc 가능 최대 크기
          </span>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">감지된 메모리 누수</span>
          <span className={`text-base font-bold font-mono ${
            heapAnalysis.leakedBlocks.length > 0 ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            {heapAnalysis.leakedBlocks.length} 건 ({heapAnalysis.totalLeakedBytes}B)
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            {heapAnalysis.leakedBlocks.length > 0 ? 'free() 누락 탐지됨' : '누수 없음'}
          </span>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 col-span-2 sm:col-span-4 lg:col-span-1">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">스택 충돌 여유 마진</span>
          <span className={`text-base font-bold font-mono ${
            heapAnalysis.isStackCollisionRisk ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            {heapAnalysis.stackCollisionMargin} B
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            {heapAnalysis.isStackCollisionRisk ? '위험: 스택 충돌 직전!' : '안전 마진 확보'}
          </span>
        </div>
      </div>

      {/* 2D Heap Memory Map Visualizer */}
      <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-rose-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              2D 힙 메모리 맵 & 단편화 홀(Holes) 시각화
            </h4>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
              활성 점유 (Active)
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" />
              단편화 홀 (Freed Hole)
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" />
              누수 블록 (Leaked)
            </span>
          </div>
        </div>

        {/* Visual Memory Blocks Bar */}
        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800/90 space-y-2">
          <div className="h-14 w-full bg-slate-950 rounded-lg p-1.5 flex items-stretch gap-1 overflow-x-auto border border-slate-800">
            {heapAnalysis.allAllocations.map((blk) => {
              const isSelected = selectedBlockPtr === blk.ptr;
              let bgClass = 'bg-rose-500/80 hover:bg-rose-500 border-rose-400';
              if (blk.isFreed) {
                bgClass = 'bg-amber-500/40 hover:bg-amber-500/70 border-amber-400/60 dashed border';
              } else if (!blk.isLeaked) {
                bgClass = 'bg-emerald-500/80 hover:bg-emerald-500 border-emerald-400';
              }

              // Flex proportional width
              const widthWeight = Math.max(24, Math.min(180, blk.size * 1.5));

              return (
                <div
                  key={blk.allocId}
                  onClick={() => setSelectedBlockPtr(blk.ptr)}
                  style={{ width: `${widthWeight}px` }}
                  className={`rounded-md cursor-pointer transition flex flex-col justify-between p-1.5 text-[10px] font-mono shrink-0 select-none ${bgClass} ${
                    isSelected ? 'ring-2 ring-white scale-105 z-10' : ''
                  }`}
                  title={`주소: 0x${blk.ptr.toString(16).toUpperCase()} | 크기: ${blk.size}B | ${blk.fileLine} | 상태: ${
                    blk.isFreed ? '해제됨 (Hole)' : blk.isLeaked ? '누수됨 (Leaked)' : '사용 중'
                  }`}
                >
                  <div className="flex items-center justify-between text-white font-bold leading-none">
                    <span>0x{blk.ptr.toString(16).toUpperCase()}</span>
                    <span>{blk.size}B</span>
                  </div>
                  <div className="text-[9px] text-slate-200 truncate leading-none">
                    {blk.fileLine}
                  </div>
                </div>
              );
            })}

            {/* Remaining Free Space Bar */}
            <div className="flex-1 min-w-[80px] bg-slate-900 border border-slate-800 rounded-md flex items-center justify-center text-[10px] font-mono text-slate-500">
              잔여 힙/스택 공간 (Free RAM)
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
            <span>__heap_start: 0x{sramSpecs.heapBase.toString(16).toUpperCase()}</span>
            <span>최고 힙 경계 (__brkval): 0x{heapAnalysis.maxAddr.toString(16).toUpperCase()}</span>
            <span>RAMEND: 0x{sramSpecs.ramEnd.toString(16).toUpperCase()}</span>
          </div>
        </div>

        {/* Selected Block Quick Inspector */}
        {selectedBlockPtr !== null && (() => {
          const selected = heapAnalysis.allAllocations.find((b) => b.ptr === selectedBlockPtr);
          if (!selected) return null;
          return (
            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded font-bold ${
                  selected.isFreed ? 'bg-amber-950 text-amber-300' : selected.isLeaked ? 'bg-rose-950 text-rose-300' : 'bg-emerald-950 text-emerald-300'
                }`}>
                  {selected.isFreed ? 'FREED HOLE' : selected.isLeaked ? 'LEAKED' : 'ACTIVE'}
                </span>
                <span className="text-white font-bold">주소: 0x{selected.ptr.toString(16).toUpperCase()}</span>
                <span className="text-slate-400">크기: {selected.size} 바이트</span>
                <span className="text-cyan-400">소스: {selected.fileLine}</span>
              </div>
              <button
                onClick={() => setSelectedBlockPtr(null)}
                className="text-slate-500 hover:text-white text-[11px]"
              >
                닫기
              </button>
            </div>
          );
        })()}
      </div>

      {/* Two Column Section: Log Input & Leak Hunter Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Raw Log Input (5 cols) */}
        <div className="lg:col-span-5 space-y-3 bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-rose-400" />
              런타임 힙 할당 로그 입력 (Raw Log)
            </span>
            <button
              onClick={() => setRawLogText('')}
              className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 font-mono"
            >
              <Trash2 className="w-3 h-3" /> 비우기
            </button>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            시리얼 터미널이나 디버거에서 출력된 MALLOC/FREE 로그를 붙여넣으세요.
          </p>
          <textarea
            value={rawLogText}
            onChange={(e) => setRawLogText(e.target.value)}
            rows={12}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 font-mono text-xs focus:border-rose-500 focus:outline-none leading-relaxed"
            placeholder="[001] MALLOC ptr=0x0250 size=32 file=sensor.c:42&#10;[002] FREE   ptr=0x0250 file=sensor.c:80"
          />
        </div>

        {/* Right: Leak Hunter Table (7 cols) */}
        <div className="lg:col-span-7 space-y-3 bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              메모리 누수 & 블록 라이프사이클 추적표 ({displayedAllocations.length}개)
            </span>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1 text-[11px] font-mono">
              {[
                { id: 'all', label: '전체' },
                { id: 'leaked', label: '누수만' },
                { id: 'active', label: '점유 중' },
                { id: 'freed', label: '해제됨' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterMode(f.id as any)}
                  className={`px-2 py-0.5 rounded-lg border transition ${
                    filterMode === f.id
                      ? 'bg-rose-950 text-rose-300 border-rose-600 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="포인터 주소(0x..), 파일명, 크기로 검색..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:border-rose-500 focus:outline-none"
            />
          </div>

          {/* Allocation Table */}
          <div className="overflow-x-auto max-h-72 border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">포인터 주소</th>
                  <th className="py-2 px-2">크기</th>
                  <th className="py-2 px-3">발생 위치 (File:Line)</th>
                  <th className="py-2 px-2">상태 (Status)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/60 text-slate-300">
                {displayedAllocations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500 text-xs">
                      조건에 일치하는 할당 블록이 없습니다.
                    </td>
                  </tr>
                ) : (
                  displayedAllocations.map((blk) => (
                    <tr
                      key={blk.allocId}
                      className="hover:bg-slate-800/50 transition cursor-pointer"
                      onClick={() => setSelectedBlockPtr(blk.ptr)}
                    >
                      <td className="py-2 px-3 font-bold text-white">
                        0x{blk.ptr.toString(16).toUpperCase()}
                      </td>
                      <td className="py-2 px-2 text-cyan-400 font-bold">{blk.size} B</td>
                      <td className="py-2 px-3 text-slate-400">{blk.fileLine}</td>
                      <td className="py-2 px-2">
                        {blk.isFreed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/40">
                            <CheckCircle2 className="w-3 h-3 text-amber-400" />
                            해제됨 (Hole)
                          </span>
                        ) : blk.isLeaked ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/40 font-bold">
                            <XCircle className="w-3 h-3 text-rose-400" />
                            누수 (LEAK)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/40">
                            점유 중
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
