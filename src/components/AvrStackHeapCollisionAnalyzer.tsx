import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Layers,
  Cpu,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Copy,
  Check,
  Download,
  Info,
  TrendingDown,
  Terminal,
  Activity,
  Flame,
  ArrowRight,
  Sparkles,
  Search,
  Code2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

interface MapPreset {
  id: string;
  name: string;
  category: 'baremetal' | 'arduino' | 'deep_call' | 'heavy_isr';
  desc: string;
  dataBytes: number;
  bssBytes: number;
  heapBytes: number;
  callDepth: number;
  avgFrameSize: number;
  nestedIsrCount: number;
}

const PRESET_SCENARIOS: MapPreset[] = [
  {
    id: 'baremetal_sensor',
    name: '1. 경량 베어메탈 센서 루프 (안전 모드)',
    category: 'baremetal',
    desc: '동적 할당(malloc) 없이 정적 버퍼만 사용하며, 함수 호출 깊이가 얕은 전형적인 저전력 펌웨어',
    dataBytes: 64,
    bssBytes: 256,
    heapBytes: 0,
    callDepth: 4,
    avgFrameSize: 16,
    nestedIsrCount: 1
  },
  {
    id: 'typical_arduino',
    name: '2. 전형적인 아두이노 프로젝트 (String & 동적 버퍼)',
    category: 'arduino',
    desc: 'Arduino String 객체, Serial 링버퍼 및 JSON 라이브러리 사용으로 힙과 스택이 공존하는 구성',
    dataBytes: 280,
    bssBytes: 640,
    heapBytes: 350,
    callDepth: 7,
    avgFrameSize: 28,
    nestedIsrCount: 1
  },
  {
    id: 'deep_recursive',
    name: '3. 심층 파서 및 재귀 호출 (충돌 경고 위험군)',
    category: 'deep_call',
    desc: '복잡한 통신 패킷 파서, 깊은 switch-case 및 재귀/콜백으로 인해 스택 프레임이 급격히 증가하는 시나리오',
    dataBytes: 320,
    bssBytes: 780,
    heapBytes: 420,
    callDepth: 14,
    avgFrameSize: 42,
    nestedIsrCount: 2
  },
  {
    id: 'heavy_isr_collision',
    name: '4. 고주파 인터럽트 중첩 & RTOS 태스크 (치명적 충돌)',
    category: 'heavy_isr',
    desc: '타이머 + UART + 외부 핀 인터럽트가 다중 중첩되고 대형 로컬 버퍼로 인해 스택-힙 충돌이 발생하는 극한 상황',
    dataBytes: 450,
    bssBytes: 890,
    heapBytes: 520,
    callDepth: 12,
    avgFrameSize: 56,
    nestedIsrCount: 3
  }
];

export const AvrStackHeapCollisionAnalyzer: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Presets & Custom Configuration State
  const [selectedPresetId, setSelectedPresetId] = useState<string>('typical_arduino');
  const [dataBytes, setDataBytes] = useState<number>(280);
  const [bssBytes, setBssBytes] = useState<number>(640);
  const [heapBytes, setHeapBytes] = useState<number>(350);
  const [callDepth, setCallDepth] = useState<number>(7);
  const [avgFrameSize, setAvgFrameSize] = useState<number>(28);
  const [nestedIsrCount, setNestedIsrCount] = useState<number>(1);

  const [activeTab, setActiveTab] = useState<'calc' | 'asm_tips' | 'watermark'>('calc');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  // Architecture Specs based on MCU
  const sramTotal = currentProfile.sram;
  const isLargeMcu = selectedMCU === 'atmega640'; // 640/1280/2560 has 3-byte PC & starts RAM at 0x0200
  const ramStart = isLargeMcu ? 0x0200 : 0x0100;
  const ramEnd = ramStart + sramTotal - 1;
  const pcReturnBytes = isLargeMcu ? 3 : 2; // Return address pushed to stack on CALL
  const calleeSavedRegsBytes = 4; // R28:R29 frame pointer + typical saved regs (R2-R17)
  const isrContextOverhead = 26; // PC + SREG + R0/R1 + working registers saved on ISR entry

  // Handle Preset Selection
  const applyPreset = (preset: MapPreset) => {
    setSelectedPresetId(preset.id);
    setDataBytes(preset.dataBytes);
    setBssBytes(preset.bssBytes);
    setHeapBytes(preset.heapBytes);
    setCallDepth(preset.callDepth);
    setAvgFrameSize(preset.avgFrameSize);
    setNestedIsrCount(preset.nestedIsrCount);
  };

  // Stack & Memory Math Calculations
  const analysis = useMemo(() => {
    // 1. Static memory footprint
    const staticTotal = dataBytes + bssBytes;

    // 2. Per-call stack consumption: PC address + Frame Pointer / Saved Regs + Local Variables
    const singleFrameSize = pcReturnBytes + calleeSavedRegsBytes + avgFrameSize;
    const baseCallStack = callDepth * singleFrameSize;

    // 3. Nested ISR stack impact
    const isrStackImpact = nestedIsrCount * isrContextOverhead;

    // 4. Worst-case Peak Stack
    const peakStack = baseCallStack + isrStackImpact;

    // 5. Total SRAM consumed in worst case
    const totalAllocated = staticTotal + heapBytes + peakStack;

    // 6. Safety margin remaining (Free gap between Heap top and Stack bottom)
    const safetyMarginBytes = sramTotal - totalAllocated;
    const safetyMarginPercent = (safetyMarginBytes / sramTotal) * 100;

    // Physical Memory Boundaries
    const bssEndAddr = ramStart + staticTotal;
    const heapTopAddr = bssEndAddr + heapBytes;
    const stackBottomAddr = ramEnd - peakStack + 1;

    // Collision Detection Status
    let riskLevel: 'safe' | 'warning' | 'danger' | 'collision' = 'safe';
    if (safetyMarginBytes < 0) {
      riskLevel = 'collision';
    } else if (safetyMarginPercent < 10) {
      riskLevel = 'danger';
    } else if (safetyMarginPercent < 25) {
      riskLevel = 'warning';
    }

    return {
      staticTotal,
      singleFrameSize,
      baseCallStack,
      isrStackImpact,
      peakStack,
      totalAllocated,
      safetyMarginBytes,
      safetyMarginPercent,
      bssEndAddr,
      heapTopAddr,
      stackBottomAddr,
      riskLevel
    };
  }, [
    dataBytes,
    bssBytes,
    heapBytes,
    callDepth,
    avgFrameSize,
    nestedIsrCount,
    sramTotal,
    ramStart,
    ramEnd,
    pcReturnBytes
  ]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    confetti({
      particleCount: 20,
      spread: 45,
      origin: { y: 0.85 }
    });
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  // Inline Assembly Code Snippet 1: Get Stack Pointer
  const asmGetSPCode = `// ==============================================================================
// 1. 런타임 현재 스택 포인터(SP: SPH + SPL) 읽기 함수 (AVR Inline Assembly)
// ==============================================================================
#include <avr/io.h>
#include <stdint.h>

/**
 * @brief 현재 실행 중인 함수의 스택 탑 주소를 즉시 읽어옵니다.
 * @return 16비트 SP 레지스터 값 (0x${ramStart.toString(16).toUpperCase()} ~ 0x${ramEnd.toString(16).toUpperCase()})
 * @note 레지스터 손상 없이 컴파일러 안전하게 SP 값을 반환합니다.
 */
static inline uint16_t get_runtime_stack_pointer(void) {
    uint16_t sp_val;
    __asm__ __volatile__ (
        "in %A0, __SP_L__ \\n\\t"
        "in %B0, __SP_H__ \\n\\t"
        : "=r" (sp_val)
    );
    return sp_val;
}

/**
 * @brief 힙 포인터(__brkval)와 스택 포인터 간의 안전 여유 공간(Free Margin) 반환
 * @return 잔여 여유 바이트 수 (0 이하이면 스택/힙 오버플로우 충돌 발생!)
 */
extern int __heap_start;
extern int *__brkval;

int get_free_sram_margin(void) {
    uint16_t sp = get_runtime_stack_pointer();
    uint16_t heap_top = (__brkval == 0) ? (uint16_t)&__heap_start : (uint16_t)__brkval;
    
    // 스택(하향 성장)과 힙(상향 성장) 사이의 안전 갭
    return (int)(sp - heap_top);
}`;

  // Inline Assembly Code Snippet 2: Stack Painting & Watermark High-water Check
  const asmWatermarkCode = `// ==============================================================================
// 2. 스택 페인팅(Stack Painting) & 워터마크 고수위 측정 (High-Water Mark)
// ==============================================================================
#include <avr/io.h>
#include <stdint.h>

#define STACK_CANARY_MAGIC   0x55 // 미사용 SRAM 영역을 0x55 패턴으로 채움

extern uint8_t _end;     // .bss 세그먼트의 끝 (힙/스택 시작 경계)
extern uint8_t __heap_start;

/**
 * @brief MCU 부팅 즉시(main 함수 진입 전) 미사용 SRAM을 0x55로 페인팅합니다.
 * @section .init3 단계에 등록되어 C 런타임 초기화 도중 자동 실행됩니다.
 */
void __attribute__((naked, section(".init3"))) stack_paint_init(void) {
    __asm__ __volatile__ (
        "ldi r30, lo8(_end)          \\n\\t"
        "ldi r31, hi8(_end)          \\n\\t"
        "ldi r24, %0                 \\n\\t" // 0x55 매직 바이트
        ".L_paint_loop:              \\n\\t"
        "st  Z+, r24                 \\n\\t"
        "in  r25, __SP_L__           \\n\\t"
        "in  r26, __SP_H__           \\n\\t"
        "cp  r30, r25                \\n\\t"
        "cpc r31, r26                \\n\\t"
        "brlo .L_paint_loop          \\n\\t"
        :
        : "M" (STACK_CANARY_MAGIC)
        : "r24", "r25", "r26", "r30", "r31"
    );
}

/**
 * @brief 부팅 후 지금까지 사용된 최대 스택 점유 바이트(Peak Stack)를 역추적 계산합니다.
 * @return 펌웨어 동작 중 기록된 최대 스택 점유 크기 (Bytes)
 */
uint16_t get_max_stack_usage(void) {
    const uint8_t *p = &_end;
    // 0x55가 유지된 미오염 바이트를 스캔
    while (*p == STACK_CANARY_MAGIC && p < (uint8_t*)RAMEND) {
        p++;
    }
    // RAMEND에서 가장 깊게 내려온 지점까지의 거리
    return (uint16_t)((uint8_t*)RAMEND - p);
}`;

  // Inline Assembly Code Snippet 3: Hardware Sentinel Guard Check
  const asmGuardCheckCode = `// ==============================================================================
// 3. 스택 가드 센티넬(Sentinel Check) 및 비상 세이프가드 ISR
// ==============================================================================
#include <avr/io.h>
#include <avr/wdt.h>

#define STACK_COLLISION_THRESHOLD  32 // 32바이트 미만 접근 시 긴급 비상 조치

void verify_stack_integrity(void) {
    uint16_t current_sp = get_runtime_stack_pointer();
    uint16_t safe_boundary = (uint16_t)&_end + STACK_COLLISION_THRESHOLD;

    if (current_sp <= safe_boundary) {
        // [비상 경보] 스택-힙 충돌 감지!
        // 1. 액추에이터/모터/PWM 즉시 정지
        PORTB &= ~0b00100000;
        TCCR0A = 0; // PWM 출력 차단
        
        // 2. 비상 상태 로깅 (EEPROM 또는 안전 레지스터)
        // 3. 워치독 리셋 트리거
        wdt_enable(WDTO_15MS);
        while (1) {
            // 리셋 대기
        }
    }
}`;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 lg:p-8 backdrop-blur shadow-2xl space-y-8 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-br from-rose-500 to-amber-600 rounded-2xl shadow-lg shadow-rose-500/20 text-slate-950 font-black">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl lg:text-2xl font-black text-white tracking-tight">
                  AVR 스택/힙 충돌 분석기
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Stack & Heap Collision Profiler
                </span>
              </div>
              <p className="text-xs lg:text-sm text-slate-400 mt-1">
                컴파일 맵 파일의 섹션 정보(.data / .bss / Heap)와 함수 호출 트리 깊이를 기반으로 스택 오버플로우 발생 위험을 산출하고 런타임 스택 검증 어셈블리 팁을 제공합니다.
              </p>
            </div>
          </div>
        </div>

        {/* MCU Specs Badge */}
        <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs text-slate-300">
          <Cpu className="w-4 h-4 text-rose-400" />
          <span>타깃 MCU:</span>
          <span className="font-bold text-rose-300">{currentProfile.name}</span>
          <span className="text-[11px] text-slate-500 font-mono">
            (SRAM: {sramTotal}B / 0x{ramStart.toString(16).padStart(4, '0').toUpperCase()} ~ 0x{ramEnd.toString(16).padStart(4, '0').toUpperCase()})
          </span>
        </div>
      </div>

      {/* Preset Scenario Selector */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-rose-400" />
            실무 메모리 부하 시나리오 프리셋 선택:
          </span>
          <span className="text-[11px] text-slate-500">원클릭 파라미터 자동 로딩</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {PRESET_SCENARIOS.map((preset) => {
            const isSelected = preset.id === selectedPresetId;
            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={`text-left p-3.5 rounded-2xl border transition-all relative ${
                  isSelected
                    ? 'bg-gradient-to-br from-rose-950/60 to-slate-900 border-rose-500 text-white shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/50'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-xs text-slate-200 mb-1 flex items-center justify-between">
                  <span>{preset.name}</span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {preset.desc}
                </p>
                <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>정적: {preset.dataBytes + preset.bssBytes}B</span>
                  <span>깊이: {preset.callDepth}단계</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Analysis Engine: Controls vs Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Parameters (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-rose-400" />
              메모리 섹션 & 호출 트리 파라미터
            </span>
            <span className="text-[11px] text-slate-500 font-mono">.map & 코드 기준</span>
          </div>

          {/* Static .data size */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1 font-mono">
              <span className="text-slate-300">.data 세그먼트 (초기화 전역):</span>
              <span className="text-blue-400 font-bold">{dataBytes} Bytes</span>
            </div>
            <input
              type="range"
              min="0"
              max={Math.floor(sramTotal * 0.7)}
              step="16"
              value={dataBytes}
              onChange={(e) => {
                setDataBytes(Number(e.target.value));
                setSelectedPresetId('custom');
              }}
              className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
            />
          </div>

          {/* Static .bss size */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1 font-mono">
              <span className="text-slate-300">.bss 세그먼트 (미초기화/버퍼):</span>
              <span className="text-cyan-400 font-bold">{bssBytes} Bytes</span>
            </div>
            <input
              type="range"
              min="0"
              max={Math.floor(sramTotal * 0.8)}
              step="16"
              value={bssBytes}
              onChange={(e) => {
                setBssBytes(Number(e.target.value));
                setSelectedPresetId('custom');
              }}
              className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
            />
          </div>

          {/* Heap size */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1 font-mono">
              <span className="text-slate-300">Heap 할당량 (malloc / String):</span>
              <span className="text-purple-400 font-bold">{heapBytes} Bytes</span>
            </div>
            <input
              type="range"
              min="0"
              max={Math.floor(sramTotal * 0.6)}
              step="16"
              value={heapBytes}
              onChange={(e) => {
                setHeapBytes(Number(e.target.value));
                setSelectedPresetId('custom');
              }}
              className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
            />
          </div>

          <div className="pt-2 border-t border-slate-800/80 space-y-3.5">
            {/* Call Stack Depth */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1 font-mono">
                <span className="text-slate-300 flex items-center gap-1">
                  호출 트리 최대 깊이 (Call Depth):
                </span>
                <span className="text-amber-400 font-bold">{callDepth} 단계 (Call Levels)</span>
              </div>
              <input
                type="range"
                min="1"
                max="24"
                step="1"
                value={callDepth}
                onChange={(e) => {
                  setCallDepth(Number(e.target.value));
                  setSelectedPresetId('custom');
                }}
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
              />
            </div>

            {/* Average Frame Size per Function */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1 font-mono">
                <span className="text-slate-300">함수당 평균 로컬 프레임 크기:</span>
                <span className="text-amber-400 font-bold">{avgFrameSize} Bytes / 함수</span>
              </div>
              <input
                type="range"
                min="4"
                max="128"
                step="4"
                value={avgFrameSize}
                onChange={(e) => {
                  setAvgFrameSize(Number(e.target.value));
                  setSelectedPresetId('custom');
                }}
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
              />
            </div>

            {/* Nested ISR count */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1 font-mono">
                <span className="text-slate-300">인터럽트 중첩 레벨 (Nested ISRs):</span>
                <span className="text-rose-400 font-bold">{nestedIsrCount}개 중첩 (+{nestedIsrCount * isrContextOverhead}B)</span>
              </div>
              <input
                type="range"
                min="0"
                max="4"
                step="1"
                value={nestedIsrCount}
                onChange={(e) => {
                  setNestedIsrCount(Number(e.target.value));
                  setSelectedPresetId('custom');
                }}
                className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Right Column: 1D Memory Layout Visualizer & Risk Status (7 cols) */}
        <div className="lg:col-span-7 space-y-4 flex flex-col justify-between">
          {/* Risk Level Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
              analysis.riskLevel === 'collision'
                ? 'bg-rose-950/80 border-rose-500 text-rose-200 shadow-xl shadow-rose-950/50 animate-pulse ring-1 ring-rose-500'
                : analysis.riskLevel === 'danger'
                ? 'bg-rose-950/50 border-rose-600/70 text-rose-300'
                : analysis.riskLevel === 'warning'
                ? 'bg-amber-950/50 border-amber-600/70 text-amber-300'
                : 'bg-emerald-950/50 border-emerald-600/70 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-3">
              {analysis.riskLevel === 'collision' || analysis.riskLevel === 'danger' ? (
                <ShieldAlert className="w-8 h-8 text-rose-400 shrink-0" />
              ) : analysis.riskLevel === 'warning' ? (
                <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />
              ) : (
                <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
              )}
              <div>
                <div className="text-sm font-black tracking-tight">
                  {analysis.riskLevel === 'collision'
                    ? '⚠️ 치명적 충돌 감지 (STACK-HEAP COLLISION OVERFLOW!)'
                    : analysis.riskLevel === 'danger'
                    ? '위험 경고: 스택 오버플로우 임계치 도달 (위험 여유분 < 10%)'
                    : analysis.riskLevel === 'warning'
                    ? '주의: 동적 부하 시 스택 오버플로우 발생 가능성 주의'
                    : '안전: 충분한 스택 안전 마진(Safety Margin) 확보됨'}
                </div>
                <div className="text-xs opacity-90 mt-0.5">
                  {analysis.safetyMarginBytes < 0 ? (
                    <span>
                      스택과 힙이 <strong className="underline">{Math.abs(analysis.safetyMarginBytes)} Bytes</strong> 겹쳐 메모리 오염 및 하드 리셋이 불가피합니다!
                    </span>
                  ) : (
                    <span>
                      최악 조건 피크 스택 기준 잔여 안전 마진: <strong>{analysis.safetyMarginBytes} Bytes</strong> ({analysis.safetyMarginPercent.toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right font-mono shrink-0 hidden sm:block">
              <div className="text-xs opacity-75">SRAM 총 점유율</div>
              <div className="text-lg font-black">
                {((analysis.totalAllocated / sramTotal) * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* 1D Memory Map Visual Bar */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">
                시작: 0x{ramStart.toString(16).padStart(4, '0').toUpperCase()} (RAMSTART)
              </span>
              <span className="text-white font-bold">
                1D SRAM 메모리 배치도 ({sramTotal} Bytes)
              </span>
              <span className="text-slate-400">
                끝: 0x{ramEnd.toString(16).padStart(4, '0').toUpperCase()} (RAMEND)
              </span>
            </div>

            {/* Segmented Progress Bar */}
            <div className="h-10 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 relative flex p-1 gap-1">
              {/* .data */}
              <div
                className="bg-blue-600 rounded-lg flex items-center justify-center text-[10px] font-bold text-white font-mono overflow-hidden transition-all duration-300"
                style={{ width: `${Math.max(2, (dataBytes / sramTotal) * 100)}%` }}
                title={`.data 세그먼트: ${dataBytes} Bytes`}
              >
                {dataBytes > 80 && '.data'}
              </div>

              {/* .bss */}
              <div
                className="bg-cyan-600 rounded-lg flex items-center justify-center text-[10px] font-bold text-white font-mono overflow-hidden transition-all duration-300"
                style={{ width: `${Math.max(2, (bssBytes / sramTotal) * 100)}%` }}
                title={`.bss 세그먼트: ${bssBytes} Bytes`}
              >
                {bssBytes > 80 && '.bss'}
              </div>

              {/* Heap */}
              {heapBytes > 0 && (
                <div
                  className="bg-purple-600 rounded-lg flex items-center justify-center text-[10px] font-bold text-white font-mono overflow-hidden transition-all duration-300"
                  style={{ width: `${Math.max(2, (heapBytes / sramTotal) * 100)}%` }}
                  title={`Heap 동적 할당: ${heapBytes} Bytes (상향 성장 ↑)`}
                >
                  {heapBytes > 80 && 'Heap ↑'}
                </div>
              )}

              {/* Free Margin Gap (or Collision Zone) */}
              <div
                className={`rounded-lg flex items-center justify-center text-[10px] font-bold font-mono overflow-hidden transition-all duration-300 flex-1 ${
                  analysis.safetyMarginBytes < 0
                    ? 'bg-rose-600/80 text-white animate-pulse border border-rose-400'
                    : 'bg-slate-800/60 text-slate-400 border border-slate-700/60'
                }`}
                title={
                  analysis.safetyMarginBytes < 0
                    ? `충돌 침범: ${Math.abs(analysis.safetyMarginBytes)}B`
                    : `안전 여유분: ${analysis.safetyMarginBytes}B`
                }
              >
                {analysis.safetyMarginBytes < 0 ? (
                  <span>충돌! (-{Math.abs(analysis.safetyMarginBytes)}B)</span>
                ) : (
                  <span>여유 {analysis.safetyMarginBytes}B</span>
                )}
              </div>

              {/* Stack */}
              <div
                className="bg-amber-600 rounded-lg flex items-center justify-center text-[10px] font-bold text-white font-mono overflow-hidden transition-all duration-300"
                style={{ width: `${Math.max(2, (analysis.peakStack / sramTotal) * 100)}%` }}
                title={`Stack: ${analysis.peakStack} Bytes (하향 성장 ↓)`}
              >
                {analysis.peakStack > 80 && 'Stack ↓'}
              </div>
            </div>

            {/* Address Labels under Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono text-slate-400 pt-1">
              <div>
                <span className="text-slate-500 block">정적 경계 (__bss_end):</span>
                <span className="text-cyan-300 font-bold">
                  0x{analysis.bssEndAddr.toString(16).toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">힙 상단 (__brkval):</span>
                <span className="text-purple-300 font-bold">
                  0x{analysis.heapTopAddr.toString(16).toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">최대 스택 침범 하단:</span>
                <span className="text-amber-300 font-bold">
                  0x{Math.max(0, analysis.stackBottomAddr).toString(16).toUpperCase()}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block">스택 초기 탑 (SP init):</span>
                <span className="text-rose-300 font-bold">
                  0x{ramEnd.toString(16).toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
              <div className="text-[10px] text-slate-400">정적 할당 합계</div>
              <div className="text-base font-bold text-cyan-400 font-mono mt-0.5">
                {analysis.staticTotal} B
              </div>
              <div className="text-[9px] text-slate-500">.data + .bss</div>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
              <div className="text-[10px] text-slate-400">함수 호출 스택</div>
              <div className="text-base font-bold text-amber-400 font-mono mt-0.5">
                {analysis.baseCallStack} B
              </div>
              <div className="text-[9px] text-slate-500">{callDepth}단계 × {analysis.singleFrameSize}B</div>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
              <div className="text-[10px] text-slate-400">인터럽트(ISR) 오버헤드</div>
              <div className="text-base font-bold text-rose-400 font-mono mt-0.5">
                {analysis.isrStackImpact} B
              </div>
              <div className="text-[9px] text-slate-500">{nestedIsrCount}중첩 × {isrContextOverhead}B</div>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
              <div className="text-[10px] text-slate-400">최악 피크 스택 합계</div>
              <div className="text-base font-bold text-amber-300 font-mono mt-0.5">
                {analysis.peakStack} B
              </div>
              <div className="text-[9px] text-slate-500">호출스택 + ISR</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Assembly Verification Tips, Stack Painting, & Sentinel Guard */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              런타임 스택 안전 검증 & 인라인 어셈블리 개발 팁
            </h3>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('calc')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeTab === 'calc'
                  ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              1. SP 직접 읽기 (Inline Asm)
            </button>
            <button
              onClick={() => setActiveTab('watermark')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeTab === 'watermark'
                  ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              2. 스택 페인팅 & 워터마크 (.init3)
            </button>
            <button
              onClick={() => setActiveTab('asm_tips')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeTab === 'asm_tips'
                  ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              3. 비상 세이프가드 센티넬
            </button>
          </div>
        </div>

        {/* Tab 1: SP Read */}
        {activeTab === 'calc' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs text-slate-300 flex items-start gap-3">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong>SP (Stack Pointer) 인라인 어셈블리 원리:</strong> AVR은 16비트 스택 포인터를 두 개의 8비트 I/O 레지스터 <code className="text-blue-300 font-mono">SPL (0x3D)</code>과 <code className="text-blue-300 font-mono">SPH (0x3E)</code>에 저장합니다. GCC의 <code className="text-blue-300 font-mono">__asm__ __volatile__</code> 명령어를 통해 범용 레지스터 오염 없이 하드웨어 스택 포인터를 직접 획득할 수 있습니다.
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
                <span>src/stack_checker.c (SP 직접 획득 함수)</span>
                <button
                  onClick={() => handleCopy(asmGetSPCode, 'sp_code')}
                  className="flex items-center gap-1 text-slate-400 hover:text-white transition"
                >
                  {copiedSnippet === 'sp_code' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedSnippet === 'sp_code' ? '복사됨!' : '코드 복사'}</span>
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-cyan-300/90 overflow-x-auto leading-relaxed max-h-60 selection:bg-rose-500/30">
                {asmGetSPCode}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 2: Watermark */}
        {activeTab === 'watermark' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs text-slate-300 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>스택 페인팅(Stack Painting) 기법:</strong> AVR 부팅 초기 단계인 <code className="text-amber-300 font-mono">.init3</code> 섹션에서 미사용 SRAM 영역 전체를 <code className="text-amber-300 font-mono">0x55</code> 매직 바이트로 채워둔 뒤, 런타임에 0x55가 어디까지 침범당했는지를 역스캔하여 <strong>역대 최대 스택 점유율(High-Water Mark)</strong>을 1바이트 오차 없이 정밀 계측합니다.
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
                <span>src/stack_watermark.c (고수위 워터마크 자동 측정)</span>
                <button
                  onClick={() => handleCopy(asmWatermarkCode, 'watermark_code')}
                  className="flex items-center gap-1 text-slate-400 hover:text-white transition"
                >
                  {copiedSnippet === 'watermark_code' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedSnippet === 'watermark_code' ? '복사됨!' : '코드 복사'}</span>
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-amber-300/90 overflow-x-auto leading-relaxed max-h-60 selection:bg-rose-500/30">
                {asmWatermarkCode}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 3: Sentinel Guard */}
        {activeTab === 'asm_tips' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs text-slate-300 flex items-start gap-3">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong>비상 세이프가드 센티넬(Sentinel Check):</strong> 메인 루프나 워치독 타이머 틱마다 스택 포인터가 힙/BSS 경계로부터 안전 거리(예: 32바이트) 이내로 접근했는지 감시하고, 충돌 발생 직전 모터/PWM을 비상 정지시킨 후 안전하게 리셋을 유도합니다.
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
                <span>src/stack_sentinel.c (비상 세이프가드 가드 루틴)</span>
                <button
                  onClick={() => handleCopy(asmGuardCheckCode, 'guard_code')}
                  className="flex items-center gap-1 text-slate-400 hover:text-white transition"
                >
                  {copiedSnippet === 'guard_code' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedSnippet === 'guard_code' ? '복사됨!' : '코드 복사'}</span>
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-rose-300/90 overflow-x-auto leading-relaxed max-h-60 selection:bg-rose-500/30">
                {asmGuardCheckCode}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
