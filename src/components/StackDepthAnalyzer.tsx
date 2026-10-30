import React, { useState, useMemo } from 'react';
import {
  Layers,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Cpu,
  Zap,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Clock,
  ArrowDown,
  HelpCircle,
  Activity,
  Code2,
  Sliders,
  ChevronRight,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { getVectorTableByMCU } from '../data/interruptVectorsData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

interface CallDepthNode {
  name: string;
  depth: number;
  stackBytes: number;
  isIsr?: boolean;
  desc: string;
}

export const StackDepthAnalyzer: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const allVectors = useMemo(() => getVectorTableByMCU(selectedMCU), [selectedMCU]);

  // MCU SRAM Architecture parameters
  const totalSramBytes = currentProfile.sram; // 2048 (328P), 4096 (128), 8192 (2560/640)
  // PC Push size: ATmega2560 has 22-bit PC (3 bytes); Others have 16-bit PC (2 bytes)
  const pcStackBytes = selectedMCU === 'atmega2560' ? 3 : 2;

  // -------------------------------------------------------------
  // Scenario Configuration State
  // -------------------------------------------------------------
  // 1. Static RAM allocation (.data + .bss + Heap)
  const [dataBssBytes, setDataBssBytes] = useState<number>(Math.round(totalSramBytes * 0.35)); // ~35% typical
  const [heapBytes, setHeapBytes] = useState<number>(0); // dynamic malloc

  // 2. Main Call Tree Depth (before interrupt triggers)
  const [mainCallDepth, setMainCallDepth] = useState<number>(3); // main -> task -> subtask
  const [mainFramePerCallBytes, setMainFramePerCallBytes] = useState<number>(14); // avg frame (PC + saved regs + locals)

  // 3. ISR Configuration
  const [selectedVector, setSelectedVector] = useState<string>(() => {
    return allVectors.find((v) => v.vectorName.includes('TIMER1_COMPA'))?.vectorName || allVectors[1]?.vectorName || 'TIMER1_COMPA_vect';
  });
  const [isrType, setIsrType] = useState<'standard' | 'nested_noblock' | 'naked'>('standard');
  const [isrLocalBytes, setIsrLocalBytes] = useState<number>(8); // local buffers/temps in ISR
  const [savedRegsCount, setSavedRegsCount] = useState<number>(6); // R18-R23 + SREG + R0/R1

  // 4. ISR Internal Function Call Depth & Recursion Simulation
  const [isrChildCallDepth, setIsrChildCallDepth] = useState<number>(1); // calls 1 helper func
  const [isrChildFrameBytes, setIsrChildFrameBytes] = useState<number>(16); // e.g. ringbuffer or math helper
  const [isRecursiveCall, setIsRecursiveCall] = useState<boolean>(false);
  const [recursionDepth, setRecursionDepth] = useState<number>(1); // Re-entrant nesting or recursive depth
  const [nestedIsrLevel, setNestedIsrLevel] = useState<number>(1); // 1 = single ISR, 2+ = nested ISRs interrupting each other

  // Copy code feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // -------------------------------------------------------------
  // Calculations
  // -------------------------------------------------------------
  // Main Stack Usage
  const mainStackBytes = useMemo(() => {
    // Top-level main + each call adds (pcStackBytes + frame)
    return 8 + mainCallDepth * (pcStackBytes + mainFramePerCallBytes);
  }, [mainCallDepth, pcStackBytes, mainFramePerCallBytes]);

  // Single ISR Stack Frame:
  // PC push (2 or 3) + SREG & R0/R1 (3) + Saved Registers + Local variables
  const singleIsrFrameBytes = useMemo(() => {
    if (isrType === 'naked') return pcStackBytes; // naked only pushes PC by hardware
    const sregAndFixed = 3; // __zero_reg__ (R1), __tmp_reg__ (R0), SREG
    return pcStackBytes + sregAndFixed + savedRegsCount + isrLocalBytes;
  }, [isrType, pcStackBytes, savedRegsCount, isrLocalBytes]);

  // Nested Child Calls from ISR
  const isrChildCallsBytes = useMemo(() => {
    return isrChildCallDepth * (pcStackBytes + isrChildFrameBytes);
  }, [isrChildCallDepth, pcStackBytes, isrChildFrameBytes]);

  // Total ISR Stack Consumption (accounting for nested ISRs or recursion)
  const totalIsrStackBytes = useMemo(() => {
    const singleIsrTotal = singleIsrFrameBytes + isrChildCallsBytes;
    if (isrType === 'nested_noblock') {
      // Nested interrupts (ISR_NOBLOCK allows higher/same priority ISRs to preempt!)
      const multiplier = Math.max(1, nestedIsrLevel);
      return singleIsrTotal * multiplier;
    } else if (isRecursiveCall) {
      // Recursive algorithm inside ISR or deep call chain
      const recursiveOverhead = (recursionDepth - 1) * (pcStackBytes + isrChildFrameBytes + 6);
      return singleIsrTotal + recursiveOverhead;
    }
    return singleIsrTotal;
  }, [singleIsrFrameBytes, isrChildCallsBytes, isrType, nestedIsrLevel, isRecursiveCall, recursionDepth, pcStackBytes, isrChildFrameBytes]);

  // Peak Total Stack Footprint
  const peakStackBytes = mainStackBytes + totalIsrStackBytes;

  // Available Stack headroom
  // Stack starts at RAMEND and grows DOWN. Static variables (.data + .bss) and Heap start at RAMSTART and grow UP.
  const staticAllocatedBytes = dataBssBytes + heapBytes;
  const availableStackSpace = Math.max(0, totalSramBytes - staticAllocatedBytes);
  const remainingFreeSram = availableStackSpace - peakStackBytes;

  // Stack Utilization %
  const stackUtilizationPercent = availableStackSpace > 0 
    ? (peakStackBytes / availableStackSpace) * 100 
    : 100;

  // Overall SRAM Utilization %
  const overallSramUsed = staticAllocatedBytes + peakStackBytes;
  const overallSramPercent = (overallSramUsed / totalSramBytes) * 100;

  // Overflow Severity Evaluation
  const isOverflow = remainingFreeSram < 0;
  const isNearOverflow = remainingFreeSram >= 0 && remainingFreeSram < Math.max(32, totalSramBytes * 0.05); // Less than 5% or 32B margin
  const isWarning = !isOverflow && !isNearOverflow && remainingFreeSram < Math.max(64, totalSramBytes * 0.12);

  const overflowSeverity = useMemo(() => {
    if (isOverflow) return 'CRITICAL';
    if (isNearOverflow) return 'HIGH_RISK';
    if (isWarning) return 'WARNING';
    return 'SAFE';
  }, [isOverflow, isNearOverflow, isWarning]);

  // Memory Bar Percentages
  const dataBssPct = Math.min(100, (dataBssBytes / totalSramBytes) * 100);
  const heapPct = Math.min(100 - dataBssPct, (heapBytes / totalSramBytes) * 100);
  const stackPct = Math.min(100 - dataBssPct - heapPct, (peakStackBytes / totalSramBytes) * 100);
  const freePct = Math.max(0, 100 - (dataBssPct + heapPct + stackPct));

  // Quick Presets
  const applyPreset = (presetName: 'typical' | 'nested_heavy' | 'recursive_disaster' | 'minimal') => {
    if (presetName === 'typical') {
      setDataBssBytes(Math.round(totalSramBytes * 0.35));
      setHeapBytes(0);
      setMainCallDepth(3);
      setMainFramePerCallBytes(12);
      setIsrType('standard');
      setIsrLocalBytes(8);
      setSavedRegsCount(6);
      setIsrChildCallDepth(1);
      setIsrChildFrameBytes(12);
      setIsRecursiveCall(false);
      setRecursionDepth(1);
      setNestedIsrLevel(1);
    } else if (presetName === 'nested_heavy') {
      setDataBssBytes(Math.round(totalSramBytes * 0.55));
      setHeapBytes(64);
      setMainCallDepth(4);
      setMainFramePerCallBytes(18);
      setIsrType('nested_noblock');
      setIsrLocalBytes(24);
      setSavedRegsCount(12);
      setIsrChildCallDepth(2);
      setIsrChildFrameBytes(28);
      setIsRecursiveCall(false);
      setNestedIsrLevel(3);
    } else if (presetName === 'recursive_disaster') {
      setDataBssBytes(Math.round(totalSramBytes * 0.65));
      setHeapBytes(128);
      setMainCallDepth(5);
      setMainFramePerCallBytes(24);
      setIsrType('standard');
      setIsrLocalBytes(16);
      setSavedRegsCount(10);
      setIsrChildCallDepth(1);
      setIsrChildFrameBytes(20);
      setIsRecursiveCall(true);
      setRecursionDepth(8); // Deep recursive calls
      setNestedIsrLevel(1);
    } else {
      // minimal
      setDataBssBytes(Math.round(totalSramBytes * 0.15));
      setHeapBytes(0);
      setMainCallDepth(1);
      setMainFramePerCallBytes(6);
      setIsrType('standard');
      setIsrLocalBytes(2);
      setSavedRegsCount(4);
      setIsrChildCallDepth(0);
      setIsrChildFrameBytes(0);
      setIsRecursiveCall(false);
      setRecursionDepth(1);
      setNestedIsrLevel(1);
    }
  };

  // Stack Protection C Code Snippet
  const generatedCGuardCode = useMemo(() => {
    return `/* =========================================================================
 * AVR GCC Stack Paint & Runtime Canary Guard (SRAM Monitor)
 * Target MCU : ${currentProfile.name} (Total SRAM: ${totalSramBytes} Bytes)
 * Stack Growth : Grows DOWNWARDS from RAMEND (0x${(totalSramBytes + 0x100 - 1).toString(16).toUpperCase()})
 * ========================================================================= */
#include <avr/io.h>
#include <avr/interrupt.h>

#define STACK_CANARY_MAGIC 0x5A

/* Linker symbols provided by avr-libc */
extern uint8_t _end;       /* End of BSS segment in SRAM */
extern uint8_t *__brkval;  /* End of Heap allocation */

/* 1. Paint entire free SRAM with canary byte at .init3 (Before main & BSS setup) */
void __attribute__((naked, section(".init3"))) stack_paint_canary(void) {
    uint8_t *p = &_end;
    /* Paint all RAM between BSS end and current Stack Pointer with 0x5A */
    while (p < (uint8_t *)SP) {
        *p++ = STACK_CANARY_MAGIC;
    }
}

/* 2. Runtime Stack Watermark / Peak Depth Analyzer (returns minimum free bytes) */
uint16_t get_stack_watermark_free_bytes(void) {
    const uint8_t *p = &_end;
    uint16_t unused_bytes = 0;
    while (p < (uint8_t *)SP && *p == STACK_CANARY_MAGIC) {
        unused_bytes++;
        p++;
    }
    return unused_bytes;
}

/* 3. Fast SP Collision Check (Call inside critical loops or SysTick ISR) */
static inline uint8_t check_stack_overflow_violation(void) {
    uint8_t *heap_limit = __brkval ? __brkval : &_end;
    /* If Stack Pointer has invaded the Heap/BSS boundary, Overflow occurred! */
    if ((uint8_t *)SP <= (heap_limit + 32)) {
        /* CRITICAL: Stack Overflow Trap! */
        cli(); // Disable interrupts immediately to protect SRAM data
        // Trigger safe hardware reset or error blink code here
        return 1;
    }
    return 0;
}

/* Safe Leaf ISR Example without stack bloat */
ISR(${selectedVector}) {
    // 1. Avoid heavy function calls inside ISR
    // 2. Avoid local arrays (e.g. char buf[64])
    // 3. Keep variables static or use volatile global flags
}
`;
  }, [currentProfile, totalSramBytes, selectedVector]);

  const handleCopyCode = (key: string) => {
    navigator.clipboard.writeText(generatedCGuardCode);
    setCopiedKey(key);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.85 } });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Overview */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold tracking-wide uppercase">
              <Layers className="w-3.5 h-3.5" />
              Interrupt & Stack Overflow Debugger
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-3">
              인터럽트 & 스택 오버플로우 디버거 (Interrupt & Stack Overflow Debugger)
              <span className="text-xs font-mono font-normal text-rose-300 bg-rose-950/80 px-2.5 py-1 rounded-lg border border-rose-700/50">
                {currentProfile.name} • SRAM {totalSramBytes.toLocaleString()} B
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-3xl leading-relaxed">
              AVR 하드웨어는 <span className="text-white font-medium">스택(Stack)이 SRAM 최상단(RAMEND)에서 아래로 하향 성장</span>합니다.
              ISR 진입 시 Program Counter(PC) 푸시와 SREG 보존, 레지스터 프레임 할당, 재귀 호출 및 중첩 인터럽트(`ISR_NOBLOCK`)로 인해
              스택이 전역 변수(`.data`/`.bss`)와 힙(Heap) 영역을 침범하는 치명적 <strong>스택 오버플로우</strong> 위험을 정적으로 시뮬레이션합니다.
            </p>
          </div>

          {/* Quick Preset Selector */}
          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl shrink-0 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              위험도 시뮬레이션 시나리오
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-xs font-medium">
              <button
                onClick={() => applyPreset('minimal')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition text-left"
              >
                🌱 가벼운 ISR (안전)
              </button>
              <button
                onClick={() => applyPreset('typical')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition text-left"
              >
                ⚖️ 일반 펌웨어
              </button>
              <button
                onClick={() => applyPreset('nested_heavy')}
                className="px-2.5 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-800/50 transition text-left"
              >
                ⚠️ 중첩 ISR 경합
              </button>
              <button
                onClick={() => applyPreset('recursive_disaster')}
                className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/50 transition text-left"
              >
                💥 재귀 호출 참사
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Status & Risk Banner */}
      <div
        className={`p-5 rounded-3xl border transition-all shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          overflowSeverity === 'CRITICAL'
            ? 'bg-rose-950/40 border-rose-600/80 shadow-rose-950/20'
            : overflowSeverity === 'HIGH_RISK'
            ? 'bg-amber-950/40 border-amber-600/80 shadow-amber-950/20'
            : overflowSeverity === 'WARNING'
            ? 'bg-yellow-950/30 border-yellow-600/60 shadow-yellow-950/20'
            : 'bg-emerald-950/30 border-emerald-600/50 shadow-emerald-950/20'
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`p-3 rounded-2xl shrink-0 ${
              overflowSeverity === 'CRITICAL'
                ? 'bg-rose-600/20 text-rose-400 border border-rose-500/40 animate-pulse'
                : overflowSeverity === 'HIGH_RISK'
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40'
                : overflowSeverity === 'WARNING'
                ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/40'
                : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
            }`}
          >
            {overflowSeverity === 'CRITICAL' ? (
              <ShieldAlert className="w-6 h-6" />
            ) : overflowSeverity === 'HIGH_RISK' ? (
              <AlertTriangle className="w-6 h-6" />
            ) : overflowSeverity === 'WARNING' ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <ShieldCheck className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">
                {overflowSeverity === 'CRITICAL' && '치명적 스택 오버플로우 발생! (Stack Collision Crash)'}
                {overflowSeverity === 'HIGH_RISK' && '스택 오버플로우 임박 (High Risk Warning)'}
                {overflowSeverity === 'WARNING' && '스택 여유 공간 부족 (Caution Advised)'}
                {overflowSeverity === 'SAFE' && '스택 여유 공간 안전 (Safe Operation Margin)'}
              </h3>
              <span
                className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full uppercase border ${
                  overflowSeverity === 'CRITICAL'
                    ? 'bg-rose-950 text-rose-300 border-rose-600'
                    : overflowSeverity === 'HIGH_RISK'
                    ? 'bg-amber-950 text-amber-300 border-amber-600'
                    : overflowSeverity === 'WARNING'
                    ? 'bg-yellow-950 text-yellow-300 border-yellow-600'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-600'
                }`}
              >
                {overflowSeverity}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              {overflowSeverity === 'CRITICAL' && (
                <>
                  피크 스택 소비량({peakStackBytes} Bytes)이 가용 SRAM({availableStackSpace} Bytes)을 초과하여{' '}
                  <span className="text-rose-300 font-bold underline">
                    {Math.abs(remainingFreeSram)} Bytes만큼 전역 변수(.data/.bss) 및 힙 영역을 파괴
                  </span>
                  하고 있습니다. 런타임 변수 오염, 무한 WDT 리셋, CPU 락업이 발생합니다!
                </>
              )}
              {overflowSeverity === 'HIGH_RISK' && (
                <>
                  스택 여유 마진이 단 {remainingFreeSram} Bytes에 불과합니다. ISR 내부에서 추가 함수 호출이나 예기치 않은 인터럽트가 중첩될 경우 즉시 메모리 침범이 발생합니다.
                </>
              )}
              {overflowSeverity === 'WARNING' && (
                <>
                  가용 스택 공간의 {stackUtilizationPercent.toFixed(1)}%가 점유 중입니다. 인터럽트 내 지역 배열 크기를 줄이거나 중첩 ISR을 차단하는 것이 안전합니다.
                </>
              )}
              {overflowSeverity === 'SAFE' && (
                <>
                  충분한 스택 안전 마진({remainingFreeSram} Bytes)을 확보하고 있습니다. 정상적인 함수 호출 체인 및 단일 ISR 처리에 적합합니다.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Quick Numbers */}
        <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-800 text-right">
          <div className="text-xs text-slate-400">스택 점유율 (가용 공간 대비)</div>
          <div
            className={`text-2xl font-black font-mono ${
              overflowSeverity === 'CRITICAL'
                ? 'text-rose-400'
                : overflowSeverity === 'HIGH_RISK'
                ? 'text-amber-400'
                : overflowSeverity === 'WARNING'
                ? 'text-yellow-400'
                : 'text-emerald-400'
            }`}
          >
            {stackUtilizationPercent.toFixed(1)}%
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            {isOverflow ? `-${Math.abs(remainingFreeSram)} B 초과` : `${remainingFreeSram} B 잔여`}
          </div>
        </div>
      </div>

      {/* Visual SRAM Memory Map Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {currentProfile.name} SRAM 물리적 메모리 배치도 (RAMSTART ➔ RAMEND)
            </h3>
          </div>
          <div className="text-xs font-mono text-slate-400 flex items-center gap-3">
            <span>RAMSTART: 0x0100</span>
            <span>➔</span>
            <span className="text-cyan-400">
              RAMEND: 0x{(totalSramBytes + 0x100 - 1).toString(16).toUpperCase()} ({totalSramBytes} B)
            </span>
          </div>
        </div>

        {/* Multi-segmented Memory Map Bar */}
        <div className="space-y-2">
          <div className="w-full h-8 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex relative">
            {/* .data + .bss (Static data grows UP) */}
            <div
              style={{ width: `${dataBssPct}%` }}
              className="bg-indigo-600/80 h-full border-r border-indigo-500/50 flex items-center justify-center text-[10px] font-bold text-white truncate px-1 transition-all"
              title={`.data + .bss 정적 전역 변수: ${dataBssBytes} Bytes (${dataBssPct.toFixed(1)}%)`}
            >
              .data + .bss ({dataBssBytes}B)
            </div>

            {/* Heap (Malloc grows UP) */}
            {heapBytes > 0 && (
              <div
                style={{ width: `${heapPct}%` }}
                className="bg-purple-600/80 h-full border-r border-purple-500/50 flex items-center justify-center text-[10px] font-bold text-white truncate px-1 transition-all"
                title={`Heap (동적 메모리): ${heapBytes} Bytes (${heapPct.toFixed(1)}%)`}
              >
                Heap ({heapBytes}B)
              </div>
            )}

            {/* Free Margin or Collision Zone */}
            {isOverflow ? (
              <div
                className="flex-1 bg-rose-600/90 h-full flex items-center justify-center text-[10px] font-black text-white animate-pulse tracking-wide"
                title="스택이 전역 변수 영역을 침범하여 충돌 발생!"
              >
                ⚠️ STACK COLLISION OVERFLOW ({Math.abs(remainingFreeSram)}B OVERFLOW)
              </div>
            ) : (
              <div
                style={{ width: `${freePct}%` }}
                className="bg-slate-900/60 h-full flex items-center justify-center text-[10px] font-mono text-slate-400 truncate px-1"
                title={`안전 여유 공간: ${remainingFreeSram} Bytes`}
              >
                Free Space ({remainingFreeSram}B)
              </div>
            )}

            {/* Stack (Grows DOWNWARDS from RAMEND) */}
            {!isOverflow && (
              <div
                style={{ width: `${stackPct}%` }}
                className={`h-full border-l flex items-center justify-center text-[10px] font-bold text-white truncate px-1 transition-all ${
                  overflowSeverity === 'HIGH_RISK'
                    ? 'bg-amber-600/90 border-amber-400'
                    : overflowSeverity === 'WARNING'
                    ? 'bg-yellow-600/90 border-yellow-400'
                    : 'bg-rose-500/90 border-rose-400'
                }`}
                title={`Stack (피크 스택 프레임): ${peakStackBytes} Bytes (${stackPct.toFixed(1)}%)`}
              >
                Stack ◀ ({peakStackBytes}B)
              </div>
            )}
          </div>

          {/* Direction indicators */}
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 px-1">
            <span className="flex items-center gap-1">
              ▲ 정적 전역 변수 & 힙 상향 성장 (Growth UP ➔)
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              (◀ Growth DOWN 하향 성장) 스택 포인터(SP) ▲
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono pt-1 text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-indigo-600" />
            <span>.data + .bss ({dataBssBytes} B)</span>
          </div>
          {heapBytes > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-purple-600" />
              <span>Heap ({heapBytes} B)</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-800" />
            <span>여유 마진 ({Math.max(0, remainingFreeSram)} B)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-500" />
            <span>총 스택 소비량 ({peakStackBytes} B)</span>
          </div>
        </div>
      </div>

      {/* Two Column Interactive Simulator Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Application Call Tree & Static Memory */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              1. 애플리케이션 기본 스택 & 정적 메모리 모델
            </h3>
          </div>

          {/* Static Variables (.data + .bss) Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-slate-300">
                전역 변수 점유량 (.data + .bss):
              </label>
              <span className="font-mono text-indigo-400 font-bold">
                {dataBssBytes} B ({((dataBssBytes / totalSramBytes) * 100).toFixed(0)}%)
              </span>
            </div>
            <input
              type="range"
              min={32}
              max={Math.round(totalSramBytes * 0.9)}
              step={16}
              value={dataBssBytes}
              onChange={(e) => setDataBssBytes(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              전역 배열, 버퍼, 구조체, 상수 문자열(Flash 미이전 시)이 점유하는 SRAM 크기입니다.
            </p>
          </div>

          {/* Heap Memory Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-slate-300">
                동적 힙 메모리 (Heap - malloc / free):
              </label>
              <span className="font-mono text-purple-400 font-bold">
                {heapBytes} B
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.round(totalSramBytes * 0.3)}
              step={16}
              value={heapBytes}
              onChange={(e) => setHeapBytes(Number(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              AVR 8비트 환경에서는 힙 단편화와 스택 충돌 방지를 위해 동적 할당을 지양해야 합니다.
            </p>
          </div>

          {/* Main Call Depth Slider */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-slate-300">
                메인 루프 함수 중첩 깊이 (Call Depth):
              </label>
              <span className="font-mono text-cyan-400 font-bold">
                Level {mainCallDepth} (main ➔ f1 ➔ f2...)
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              value={mainCallDepth}
              onChange={(e) => setMainCallDepth(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          {/* Frame per Call */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-slate-300">
                함수당 평균 스택 프레임 (반환주소 + 레지스터 + 지역변수):
              </label>
              <span className="font-mono text-white font-bold">
                {mainFramePerCallBytes + pcStackBytes} B (PC {pcStackBytes}B + Frame {mainFramePerCallBytes}B)
              </span>
            </div>
            <input
              type="range"
              min={4}
              max={48}
              step={2}
              value={mainFramePerCallBytes}
              onChange={(e) => setMainFramePerCallBytes(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          {/* Main Stack Subtotal Summary Box */}
          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs flex justify-between items-center font-mono">
            <span className="text-slate-400">메인 루프 기본 스택 소비량:</span>
            <span className="text-cyan-400 font-bold text-sm">{mainStackBytes} Bytes</span>
          </div>
        </div>

        {/* Right Column: ISR Call Tree & Frame Overhead */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              2. 인터럽트(ISR) 스택 프레임 & 중첩/재귀 시뮬레이션
            </h3>
          </div>

          {/* Vector Selection & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                대상 인터럽트 벡터:
              </label>
              <select
                value={selectedVector}
                onChange={(e) => setSelectedVector(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 rounded-xl px-2.5 py-2 focus:outline-none focus:border-amber-500"
              >
                {allVectors.map((v) => (
                  <option key={v.vectorName} value={v.vectorName}>
                    {v.vectorName} - {v.sourceName.slice(0, 20)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                ISR 컴파일러 속성:
              </label>
              <select
                value={isrType}
                onChange={(e) => setIsrType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-amber-400 rounded-xl px-2.5 py-2 focus:outline-none focus:border-amber-500"
              >
                <option value="standard">표준 ISR() (단일 블로킹, SREG.I=0)</option>
                <option value="nested_noblock">ISR_NOBLOCK (중첩 인터럽트 허용)</option>
                <option value="naked">ISR_NAKED (프롤로그/에필로그 생략)</option>
              </select>
            </div>
          </div>

          {/* Hardware & Register Frame Components */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-300 font-semibold border-b border-slate-800 pb-1.5">
              <span>ISR 프롤로그 하드웨어/레지스터 백업 내역</span>
              <span className="font-mono text-amber-400">
                {singleIsrFrameBytes} Bytes / 프레임
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
              <div className="flex justify-between">
                <span>하드웨어 PC 푸시:</span>
                <span className="text-white font-bold">{pcStackBytes} Bytes</span>
              </div>
              <div className="flex justify-between">
                <span>SREG 및 R0/R1 백업:</span>
                <span className="text-white font-bold">3 Bytes</span>
              </div>
              <div className="flex justify-between">
                <span>보존 범용 레지스터 ({savedRegsCount}개):</span>
                <span className="text-amber-300 font-bold">{savedRegsCount} Bytes</span>
              </div>
              <div className="flex justify-between">
                <span>ISR 지역 변수/임시 버퍼:</span>
                <span className="text-cyan-300 font-bold">{isrLocalBytes} Bytes</span>
              </div>
            </div>
          </div>

          {/* Saved Registers & Local Bytes Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">보존 레지스터 개수:</span>
                <span className="font-mono text-amber-400 font-bold">{savedRegsCount}개</span>
              </div>
              <input
                type="range"
                min={2}
                max={16}
                value={savedRegsCount}
                onChange={(e) => setSavedRegsCount(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">ISR 지역 배열/버퍼:</span>
                <span className="font-mono text-cyan-400 font-bold">{isrLocalBytes} Bytes</span>
              </div>
              <input
                type="range"
                min={0}
                max={64}
                step={4}
                value={isrLocalBytes}
                onChange={(e) => setIsrLocalBytes(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>
          </div>

          {/* ISR Internal Function Calls & Recursion */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            {isrType === 'nested_noblock' ? (
              <div className="p-3 bg-amber-950/30 border border-amber-600/40 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-amber-300 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    중첩 인터럽트 깊이 (Nested Preemption Level):
                  </span>
                  <span className="font-mono font-bold text-amber-400 text-sm">
                    {nestedIsrLevel} 단계 중첩
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={nestedIsrLevel}
                  onChange={(e) => setNestedIsrLevel(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <p className="text-[10px] text-amber-200/80 leading-relaxed">
                  `ISR_NOBLOCK` 사용 시 인터럽트가 실행되는 도중 다른 고우선순위 인터럽트가 가로채면서 스택 프레임이 배수로 누적됩니다.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-300">
                    <input
                      type="checkbox"
                      checked={isRecursiveCall}
                      onChange={(e) => setIsRecursiveCall(e.target.checked)}
                      className="accent-rose-500 rounded"
                    />
                    <span>ISR 내부 함수 재귀 호출 (Recursive Call) 시뮬레이션</span>
                  </label>
                  {isRecursiveCall && (
                    <span className="font-mono text-rose-400 font-bold">
                      {recursionDepth}회 재귀
                    </span>
                  )}
                </div>

                {isRecursiveCall && (
                  <div className="p-3 bg-rose-950/30 border border-rose-600/40 rounded-xl space-y-1.5">
                    <input
                      type="range"
                      min={2}
                      max={12}
                      value={recursionDepth}
                      onChange={(e) => setRecursionDepth(Number(e.target.value))}
                      className="w-full accent-rose-500 cursor-pointer"
                    />
                    <p className="text-[10px] text-rose-300">
                      임베디드 ISR 내부에서 재귀 함수(예: 퀵정렬, 트리 순회)를 실행할 경우 즉시 스택이 폭발(Stack Bomb)합니다!
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ISR Stack Subtotal */}
          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs flex justify-between items-center font-mono">
            <span className="text-slate-400">인터럽트(ISR) 피크 스택 소비량:</span>
            <span className="text-amber-400 font-bold text-sm">+{totalIsrStackBytes} Bytes</span>
          </div>
        </div>
      </div>

      {/* Stack Breakdown Tree & Stack Overflow Pitfalls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stack Layer Stackup Visualizer (1 Column) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <ArrowDown className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              스택 프레임 계층 구조 (Top ➔ Down)
            </h3>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-slate-500 text-[10px] block">RAMEND (스택 최상단)</span>
                <span className="text-white font-bold">main() 베이스 프레임</span>
              </div>
              <span className="text-cyan-400 font-bold">8 B</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-slate-500 text-[10px] block">함수 호출 체인</span>
                <span className="text-cyan-300">Level 1~{mainCallDepth} Stack Frames</span>
              </div>
              <span className="text-cyan-400 font-bold">
                {mainStackBytes - 8} B
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 flex justify-between items-center">
              <div>
                <span className="text-amber-400 text-[10px] block">⚡ 인터럽트 트리거</span>
                <span className="text-white font-bold">{selectedVector} Frame</span>
              </div>
              <span className="text-amber-300 font-bold">
                +{singleIsrFrameBytes} B
              </span>
            </div>

            {(isrChildCallDepth > 0 || isRecursiveCall || nestedIsrLevel > 1) && (
              <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 flex justify-between items-center">
                <div>
                  <span className="text-rose-400 text-[10px] block">💥 ISR 내부 중첩/재귀</span>
                  <span className="text-rose-200">
                    {isrType === 'nested_noblock'
                      ? `중첩 ISR x${nestedIsrLevel}`
                      : isRecursiveCall
                      ? `재귀 x${recursionDepth}`
                      : `Helper Call Depth ${isrChildCallDepth}`}
                  </span>
                </div>
                <span className="text-rose-400 font-bold">
                  +{totalIsrStackBytes - singleIsrFrameBytes} B
                </span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center font-bold text-sm">
              <span className="text-white">피크 스택 깊이 (Peak):</span>
              <span className="text-rose-400">{peakStackBytes} Bytes</span>
            </div>
          </div>
        </div>

        {/* Static Analysis Prevention Guide (2 Columns) */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                런타임 스택 카나리아(Stack Canary) & 정적 분석 방어 C 코드
              </h3>
            </div>
            <button
              onClick={() => handleCopyCode('guard')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold self-start sm:self-auto"
            >
              {copiedKey === 'guard' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">복사 완료!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>스택 감시 코드 복사</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            AVR-GCC는 런타임 하드웨어 MPU(메모리 보호 장치)가 없으므로, 부팅 단계(`section .init3`)에서 미사용 SRAM 영역 전체를 
            <code className="text-amber-300 font-mono mx-1">0x5A</code> 카나리아 바이트로 페인팅하여 잔여 스택 수위(Watermark)를 측정하고 
            스택 침범 시 안전하게 트랩하는 기법이 필수적입니다.
          </p>

          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
              <span>avr_stack_guard.c - SRAM Watermark & SP Collision Guard</span>
              <span className="text-emerald-400 font-bold">Production Ready</span>
            </div>
            <pre className="p-4 text-xs font-mono text-cyan-300 overflow-x-auto leading-relaxed select-all max-h-56">
              {generatedCGuardCode}
            </pre>
          </div>

          {/* Compiler flags tip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="font-bold text-white block mb-1">
                GCC 컴파일 타임 스택 분석 플래그
              </span>
              <code className="text-amber-400 font-mono text-[11px] block">
                -fstack-usage -Wstack-usage=128
              </code>
              <p className="text-[10px] text-slate-400 mt-1">
                컴파일 시 함수별 `.su` 파일을 생성하여 스택 소비량이 128B 초과 시 경고 발생.
              </p>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="font-bold text-white block mb-1">
                재귀 호출 및 거대 로컬 버퍼 금지
              </span>
              <code className="text-rose-400 font-mono text-[11px] block">
                volatile char rx_buf[64]; // static 전역 배치
              </code>
              <p className="text-[10px] text-slate-400 mt-1">
                ISR 내부에 지역 배열 선언 시 즉시 스택 프레임이 부풀어 오르므로 정적 전역 선언 권장.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
