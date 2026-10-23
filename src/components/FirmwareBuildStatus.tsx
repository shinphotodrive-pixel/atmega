import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Hammer,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Terminal,
  Cpu,
  Layers,
  FileCode2,
  ArrowRight,
  HardDrive,
  Copy,
  Check,
  Sparkles,
  Sliders,
  Gauge,
  Info,
  CheckCircle,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSendToFlasher?: (hexFileName: string) => void;
}

export type BuildStageId = 'idle' | 'preprocess' | 'compile' | 'link' | 'hexgen' | 'completed' | 'failed';

export interface CompilationStage {
  id: BuildStageId;
  name: string;
  tool: string;
  description: string;
  outputArtifact: string;
}

const BUILD_STAGES: CompilationStage[] = [
  {
    id: 'preprocess',
    name: '1. 전처리 (Pre-processing)',
    tool: 'avr-gcc -E / cpp',
    description: '헤더 파일(#include <avr/io.h>) 치환, F_CPU 매크로 치환 및 조건부 컴파일(#ifdef) 분기 해석',
    outputArtifact: 'main.i (Preprocessed C source)'
  },
  {
    id: 'compile',
    name: '2. 컴파일 (C to Machine Assembly)',
    tool: 'avr-gcc -S / as',
    description: 'C 소스 구문 분석(AST), -Os 코드 크기 최적화 및 AVR 8비트 RISC 명령어 어셈블리/오브젝트 생성',
    outputArtifact: 'main.o, mcu_peripherals.o (ELF Relocatable)'
  },
  {
    id: 'link',
    name: '3. 링킹 (Linking & Address Map)',
    tool: 'avr-ld / avr-gcc',
    description: '오브젝트 병합, IVT 벡터 주소(0x0000) 바인딩, avr-libc 런타임 시작 코드(crt0.o) 및 메모리 섹션 할당',
    outputArtifact: 'firmware.elf, firmware.map'
  },
  {
    id: 'hexgen',
    name: '4. 바이너리 & 헥스 생성 (Hex Extraction)',
    tool: 'avr-objcopy & avr-size',
    description: 'ELF에서 디버그 심볼을 제거하고 ISP 프로그래머용 Intel HEX (.hex) 추출 및 Flash/SRAM 메모리 점유율 산출',
    outputArtifact: 'firmware.hex (Intel HEX format)'
  }
];

export const FirmwareBuildStatus: React.FC<Props> = ({ selectedMCU, onSendToFlasher }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Build Configuration
  const [optLevel, setOptLevel] = useState<'-Os' | '-O2' | '-O3' | '-O0'>('-Os');
  const [enableLto, setEnableLto] = useState<boolean>(true);
  const [enableAllWarnings, setEnableAllWarnings] = useState<boolean>(true);
  const [buildSimulationScenario, setBuildSimulationScenario] = useState<'success' | 'warning' | 'ram_overflow'>('success');
  const [buildSpeed, setBuildSpeed] = useState<'fast' | 'normal' | 'detailed'>('normal');

  // Build Execution State
  const [currentStage, setCurrentStage] = useState<BuildStageId>('idle');
  const [stageProgress, setStageProgress] = useState<number>(0);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [buildElapsedTime, setBuildElapsedTime] = useState<number>(0);
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);

  const consoleRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  // Target MCU Part for command
  const mcuPart = useMemo(() => {
    if (selectedMCU === 'atmega2560') return 'atmega2560';
    if (selectedMCU === 'atmega640') return 'atmega640';
    if (selectedMCU === 'atmega128') return 'atmega128';
    return 'atmega328p';
  }, [selectedMCU]);

  // Simulated Memory Footprints
  const memoryStats = useMemo(() => {
    const flashMax = currentProfile.flash * 1024;
    const sramMax = currentProfile.sram * 1024;
    const eepromMax = currentProfile.eeprom * 1024;

    if (buildSimulationScenario === 'ram_overflow') {
      return {
        flashUsed: Math.min(flashMax - 512, 18450),
        flashMax,
        sramUsed: sramMax + 240, // Overflow!
        sramMax,
        eepromUsed: 64,
        eepromMax
      };
    }

    const flashBase = selectedMCU === 'atmega2560' ? 4120 : selectedMCU === 'atmega128' ? 3680 : 3420;
    const sramBase = selectedMCU === 'atmega2560' ? 480 : selectedMCU === 'atmega128' ? 360 : 320;

    return {
      flashUsed: flashBase,
      flashMax,
      sramUsed: sramBase,
      sramMax,
      eepromUsed: 32,
      eepromMax
    };
  }, [currentProfile, selectedMCU, buildSimulationScenario]);

  // Flash & SRAM percentages
  const flashPct = ((memoryStats.flashUsed / memoryStats.flashMax) * 100).toFixed(1);
  const sramPct = Math.min(100, (memoryStats.sramUsed / memoryStats.sramMax) * 100).toFixed(1);
  const isSramOverflow = memoryStats.sramUsed > memoryStats.sramMax;

  // Build Duration Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isBuilding) {
      interval = setInterval(() => {
        setBuildElapsedTime((prev) => Math.round((prev + 0.1) * 10) / 10);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isBuilding]);

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [buildLogs]);

  // Start IDE Build Simulation
  const handleStartBuild = () => {
    if (isBuilding) return;

    setIsBuilding(true);
    setCurrentStage('preprocess');
    setStageProgress(5);
    setBuildElapsedTime(0);
    setBuildLogs([
      `[IDE] === Build Started: ${currentProfile.name} [Target: -mmcu=${mcuPart}] ===`,
      `[IDE] Toolchain: avr-gcc (GCC) 12.2.0 (Microchip AVR Toolchain 3.7.0)`,
      `[IDE] Compiler Flags: ${optLevel} ${enableLto ? '-flto ' : ''}${enableAllWarnings ? '-Wall -Wextra ' : ''}-DF_CPU=16000000UL`
    ]);

    const stepDelay = buildSpeed === 'fast' ? 260 : buildSpeed === 'detailed' ? 850 : 450;

    const timeline = [
      // 1. Preprocessing
      {
        stage: 'preprocess' as BuildStageId,
        pct: 20,
        log: `[avr-gcc] Preprocessing main.c, mcu_peripherals.c, interrupt_handlers.c...\n` +
             `[avr-gcc] Expanded <avr/io.h>, <avr/interrupt.h>, <util/delay.h>. Generated intermediate translation units (.i).`
      },
      // 2. Compilation
      {
        stage: 'compile' as BuildStageId,
        pct: 45,
        log: `[avr-gcc] Compiling C source into AVR RISC assembly (.s) and object files (.o)...\n` +
             `[avr-gcc] Applying ${optLevel} optimizations: Register allocation (r0~r31), constant folding, dead code elimination.`
      },
      ...(buildSimulationScenario === 'warning'
        ? [{
            stage: 'compile' as BuildStageId,
            pct: 60,
            log: `[avr-gcc] ⚠️ [WARNING] interrupt_handlers.c:42:15: variable 'g_tick_counter' modified in ISR but not declared 'volatile'.\n` +
                 `[avr-gcc] 💡 Tip: Add 'volatile' qualifier to prevent compiler register caching.`
          }]
        : []),
      // 3. Linking
      {
        stage: 'link' as BuildStageId,
        pct: 75,
        log: `[avr-ld] Linking object modules: main.o mcu_peripherals.o -o firmware.elf\n` +
             `[avr-ld] Assigning memory sections: .text -> 0x00000000, .data -> 0x00800100, .bss -> 0x00800180.\n` +
             `[avr-ld] Resolved Interrupt Vector Table (IVT) with 0 unresolved symbols.`
      },
      ...(buildSimulationScenario === 'ram_overflow'
        ? [{
            stage: 'failed' as BuildStageId,
            pct: 85,
            log: `[avr-ld] ❌ [FATAL LINK ERROR] region 'data' overflowed by ${memoryStats.sramUsed - memoryStats.sramMax} bytes!\n` +
                 `[avr-ld] Target SRAM: ${memoryStats.sramMax} bytes, Allocated: ${memoryStats.sramUsed} bytes.\n` +
                 `[IDE] 💥 Build Failed with error code 1. Reduce global buffer sizes or move static strings to PROGMEM.`
          }]
        : [
            // 4. Hex generation
            {
              stage: 'hexgen' as BuildStageId,
              pct: 95,
              log: `[avr-objcopy] Extracting loadable sections (.text, .data) into Intel HEX format...\n` +
                   `[avr-objcopy] Written 'firmware.hex' (Record type: 00 Data, Checksum verified).\n` +
                   `[avr-size] Memory Usage Report:\n` +
                   `  • Program Flash (.text + .data): ${memoryStats.flashUsed} bytes (${flashPct}% of ${currentProfile.flash}KB)\n` +
                   `  • Dynamic SRAM  (.data + .bss):  ${memoryStats.sramUsed} bytes (${sramPct}% of ${currentProfile.sram}KB)\n` +
                   `  • EEPROM Memory (.eeprom):       ${memoryStats.eepromUsed} bytes`
            },
            {
              stage: 'completed' as BuildStageId,
              pct: 100,
              log: `[IDE] 🎉 [BUILD SUCCESS] firmware.hex ready for ISP/Bootloader flashing! (Completed in ${((stepDelay * 5) / 1000).toFixed(2)}s)`
            }
          ])
    ];

    let stepIndex = 0;
    const executeStep = () => {
      if (stepIndex < timeline.length) {
        const item = timeline[stepIndex];
        setCurrentStage(item.stage);
        setStageProgress(item.pct);
        setBuildLogs((prev) => [...prev, item.log]);
        stepIndex++;
        timerRef.current = window.setTimeout(executeStep, stepDelay);
      } else {
        setIsBuilding(false);
        if (buildSimulationScenario !== 'ram_overflow') {
          confetti({ particleCount: 40, spread: 65, origin: { y: 0.6 } });
        }
      }
    };

    timerRef.current = window.setTimeout(executeStep, stepDelay);
  };

  const handleResetBuild = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsBuilding(false);
    setCurrentStage('idle');
    setStageProgress(0);
    setBuildElapsedTime(0);
    setBuildLogs([]);
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(buildLogs.join('\n'));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold tracking-wide uppercase mb-2">
            <Hammer className="w-3.5 h-3.5" />
            IDE Firmware Compilation Lifecycle Simulator
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-3">
            펌웨어 빌드 상태 & 컴파일 스테이지 트래커 (Firmware Build Status)
            <span className="text-xs font-mono font-normal text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-700/50">
              {currentProfile.name} • avr-gcc Toolchain
            </span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            전처리(Pre-processing)부터 컴파일, 링킹, Intel HEX 추출 및 Flash/SRAM 메모리 점유율 분석까지 임베디드 펌웨어의 4단계 빌드 파이프라인을 완전한 IDE 환경으로 시뮬레이션합니다.
          </p>
        </div>

        {/* Build Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto shrink-0">
          <button
            onClick={handleResetBuild}
            disabled={isBuilding && stageProgress < 100}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>초기화</span>
          </button>
          <button
            onClick={handleStartBuild}
            disabled={isBuilding}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg ${
              isBuilding
                ? 'bg-cyan-700 text-white cursor-wait opacity-80'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/20'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${isBuilding ? 'animate-spin' : ''}`} />
            <span>{isBuilding ? `컴파일 빌드 진행 중 (${stageProgress}%)` : '프로젝트 빌드 실행 (Build Project)'}</span>
          </button>
        </div>
      </div>

      {/* Build Parameter & Scenario Selector Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-xs">
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">컴파일러 최적화 옵션 (Optimization):</label>
          <select
            value={optLevel}
            onChange={(e) => setOptLevel(e.target.value as any)}
            disabled={isBuilding}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
          >
            <option value="-Os">-Os (Size 최적화 - 임베디드 표준 권장)</option>
            <option value="-O2">-O2 (Speed 속도 최적화)</option>
            <option value="-O3">-O3 (최대 속도, 인라인 확장으로 용량 증가)</option>
            <option value="-O0">-O0 (디버깅용 무최적화)</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] text-slate-400 block mb-1">시뮬레이션 시나리오 (Test Scenario):</label>
          <select
            value={buildSimulationScenario}
            onChange={(e) => setBuildSimulationScenario(e.target.value as any)}
            disabled={isBuilding}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
          >
            <option value="success">정상 클린 빌드 성공 (Clean Build 100%)</option>
            <option value="warning">컴파일러 경고 발생 (Missing Volatile)</option>
            <option value="ram_overflow">링커 SRAM 메모리 오버플로우 에러</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] text-slate-400 block mb-1">빌드 진행 속도:</label>
          <select
            value={buildSpeed}
            onChange={(e) => setBuildSpeed(e.target.value as any)}
            disabled={isBuilding}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
          >
            <option value="fast">고속 빌드 (Fast 1.5s)</option>
            <option value="normal">표준 IDE 속도 (Normal 2.5s)</option>
            <option value="detailed">단계별 학습 모드 (Detailed 4.5s)</option>
          </select>
        </div>

        <div className="flex flex-col justify-end">
          <label className="flex items-center gap-2 cursor-pointer text-slate-300 py-2">
            <input
              type="checkbox"
              checked={enableLto}
              onChange={(e) => setEnableLto(e.target.checked)}
              disabled={isBuilding}
              className="accent-cyan-500 rounded"
            />
            <span className="font-mono text-[11px]">-flto (Link-Time Optimization)</span>
          </label>
        </div>
      </div>

      {/* 4-Stage Visual Compilation Pipeline Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {BUILD_STAGES.map((st, idx) => {
          const isPassed =
            currentStage === 'completed' ||
            (currentStage === 'compile' && idx === 0) ||
            (currentStage === 'link' && idx <= 1) ||
            (currentStage === 'hexgen' && idx <= 2);
          const isCurrent = currentStage === st.id;
          const isFailedHere = currentStage === 'failed' && st.id === 'link';

          return (
            <div
              key={st.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between relative overflow-hidden ${
                isFailedHere
                  ? 'bg-rose-950/40 border-rose-500/70 shadow-lg shadow-rose-950/40'
                  : isCurrent
                  ? 'bg-cyan-950/40 border-cyan-400 shadow-xl shadow-cyan-950/50 ring-1 ring-cyan-400/40'
                  : isPassed
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400'
              }`}
            >
              {isCurrent && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-400/10 rounded-full blur-xl pointer-events-none" />
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    {st.name.split(' ')[1]}
                  </span>
                  {isPassed ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40 font-bold">
                      <Check className="w-3 h-3" /> 완료
                    </span>
                  ) : isCurrent ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-800/40 font-bold animate-pulse">
                      진행 중...
                    </span>
                  ) : isFailedHere ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-800/40 font-bold">
                      <XCircle className="w-3 h-3" /> 오류
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-600">대기</span>
                  )}
                </div>

                <div className="font-mono text-[11px] text-amber-400/90 mb-1.5">
                  {st.tool}
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {st.description}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[10px] font-mono text-slate-400 truncate">
                산출물: <span className="text-slate-200">{st.outputArtifact}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Memory Utilization Gauge & Artifact Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Flash ROM Utilization */}
        <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              Program Flash ROM 메모리 사용량 (.text + .data)
            </span>
            <span className="font-mono text-cyan-400 font-bold">
              {memoryStats.flashUsed.toLocaleString()} / {memoryStats.flashMax.toLocaleString()} Bytes ({flashPct}%)
            </span>
          </div>

          <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500 rounded-full"
              style={{ width: `${Math.min(100, Number(flashPct))}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>여유 공간: {(memoryStats.flashMax - memoryStats.flashUsed).toLocaleString()} Bytes</span>
            <span>최대 용량: {currentProfile.flash} KB</span>
          </div>
        </div>

        {/* Internal SRAM Utilization */}
        <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-amber-400" />
              Dynamic SRAM 메모리 점유 (.data + .bss 전역 변수)
            </span>
            <span className={`font-mono font-bold ${isSramOverflow ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`}>
              {memoryStats.sramUsed.toLocaleString()} / {memoryStats.sramMax.toLocaleString()} Bytes ({sramPct}%)
            </span>
          </div>

          <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isSramOverflow
                  ? 'bg-rose-500 shadow-md shadow-rose-500/50'
                  : 'bg-gradient-to-r from-amber-500 to-emerald-400'
              }`}
              style={{ width: `${sramPct}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>스택/힙 여유 공간: {isSramOverflow ? '오버플로우 (-' + (memoryStats.sramUsed - memoryStats.sramMax) + ' B)' : (memoryStats.sramMax - memoryStats.sramUsed).toLocaleString() + ' Bytes'}</span>
            <span>내부 SRAM: {currentProfile.sram} KB</span>
          </div>
        </div>
      </div>

      {/* Terminal Log Console */}
      <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>AVR-GCC Build Output Console</span>
            {isBuilding && <span className="text-[10px] text-cyan-300 animate-pulse">• Compiling... ({buildElapsedTime}s)</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLogs}
              disabled={buildLogs.length === 0}
              className="text-slate-400 hover:text-white flex items-center gap-1 transition text-[11px] disabled:opacity-50"
            >
              {copiedLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedLogs ? '로그 복사됨' : '로그 복사'}</span>
            </button>
          </div>
        </div>

        <div
          ref={consoleRef}
          className="p-4 h-48 overflow-y-auto font-mono text-xs text-slate-300 space-y-1.5 custom-scrollbar leading-relaxed"
        >
          {buildLogs.length === 0 ? (
            <div className="text-slate-600 italic py-12 text-center font-sans">
              상단의 "프로젝트 빌드 실행 (Build Project)" 버튼을 누르면 avr-gcc 컴파일 파이프라인의 실시간 빌드 로그가 출력됩니다.
            </div>
          ) : (
            buildLogs.map((log, idx) => (
              <div
                key={idx}
                className={`whitespace-pre-wrap ${
                  log.includes('SUCCESS')
                    ? 'text-emerald-400 font-bold bg-emerald-950/30 p-2 rounded border border-emerald-800/40'
                    : log.includes('FATAL') || log.includes('Failed')
                    ? 'text-rose-400 font-bold bg-rose-950/30 p-2 rounded border border-rose-800/40'
                    : log.includes('WARNING')
                    ? 'text-amber-300 bg-amber-950/30 p-2 rounded border border-amber-800/40'
                    : log.includes('avr-ld') || log.includes('avr-objcopy')
                    ? 'text-cyan-300'
                    : 'text-slate-300'
                }`}
              >
                {log}
              </div>
            ))
          )}
        </div>

        {/* Footer Bar after Build */}
        {currentStage === 'completed' && (
          <div className="px-4 py-2.5 bg-emerald-950/40 border-t border-emerald-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-bold font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>firmware.hex 빌드 완료 (크기: {memoryStats.flashUsed} 바이트)</span>
            </div>
            {onSendToFlasher && (
              <button
                onClick={() => onSendToFlasher('firmware.hex')}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition text-xs flex items-center gap-1 shadow-md shadow-emerald-600/20"
              >
                <span>가상 다운로더로 전송</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
