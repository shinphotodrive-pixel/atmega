import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Sliders,
  Cpu,
  Layers,
  Zap,
  Info,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  Gauge,
  HelpCircle,
  FileCode,
  Compass,
  CornerDownRight,
  Activity
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

export interface InstructionPipelineVisualizerProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export interface PipelineInstruction {
  id: string;
  pc: number; // Address in flash
  mnemonic: string;
  operands: string;
  category: 'alu' | 'branch' | 'memory' | 'call' | 'io';
  words: number; // 1 or 2 words (16-bit or 32-bit)
  standardCycles: number;
  description: string;
  branchOutcome?: 'taken' | 'not_taken'; // For branch instructions
  isBubble?: boolean; // Represents a flushed pipeline bubble (NOP/Flush)
  bubbleReason?: string;
}

export interface PipelinePreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  scenarioHighlight: string;
  instructions: PipelineInstruction[];
}

// Preset assembly instruction sequences
const PRESETS: PipelinePreset[] = [
  {
    id: 'linear_alu',
    name: '단일 사이클 연속 산술/논리 파이프라인 (이상적인 1 CPI)',
    badge: '100% Throughput',
    description: '분기나 2워드 지연 없이 인출(Fetch)과 실행(Execute)이 완벽히 병렬 오버랩되어 매 클럭마다 1개의 명령어가 완료됩니다.',
    scenarioHighlight: 'AVR RISC의 32개 범용 레지스터 동시 2-포트 읽기 & 1-포트 쓰기 구조 덕분에 레지스터 간 연산이 1클럭에 완료됩니다.',
    instructions: [
      { id: 'i1', pc: 0x0040, mnemonic: 'LDI', operands: 'R16, 0x55', category: 'alu', words: 1, standardCycles: 1, description: '즉칫값 0x55를 R16에 로드' },
      { id: 'i2', pc: 0x0041, mnemonic: 'ADD', operands: 'R16, R17', category: 'alu', words: 1, standardCycles: 1, description: 'R16 = R16 + R17 연산 수행' },
      { id: 'i3', pc: 0x0042, mnemonic: 'SUBI', operands: 'R16, 0x01', category: 'alu', words: 1, standardCycles: 1, description: 'R16에서 1 감산 (플래그 갱신)' },
      { id: 'i4', pc: 0x0043, mnemonic: 'MOV', operands: 'R0, R16', category: 'alu', words: 1, standardCycles: 1, description: 'R16의 계산 결과를 R0로 고속 복사' },
      { id: 'i5', pc: 0x0044, mnemonic: 'OUT', operands: 'PORTB, R16', category: 'io', words: 1, standardCycles: 1, description: 'PORTB 출력 핀 레지스터로 결과 1클럭 즉시 출력' },
      { id: 'i6', pc: 0x0045, mnemonic: 'NOP', operands: '', category: 'alu', words: 1, standardCycles: 1, description: 'No Operation (타이밍 동기화용 1사이클)' }
    ]
  },
  {
    id: 'branch_taken',
    name: '조건 분기 성립 (Branch Taken) 파이프라인 플러시',
    badge: '2 Cycles (1 Stall)',
    description: '조건 분기가 참(Taken)이 되면, 이미 프리페치(Prefetch)된 다음 명령어가 무효화(Flush / Bubble 삽입)되며 2사이클이 소요됩니다.',
    scenarioHighlight: 'BRNE/BREQ 분기 성립 시 타깃 주소로 PC가 재로딩되면서 1클럭의 파이프라인 버블 패널티가 발생합니다.',
    instructions: [
      { id: 'b1', pc: 0x0100, mnemonic: 'CPI', operands: 'R16, 0x00', category: 'alu', words: 1, standardCycles: 1, description: 'R16과 0 비교 (Z 플래그 세트)' },
      { id: 'b2', pc: 0x0101, mnemonic: 'BREQ', operands: 'target_loop', category: 'branch', words: 1, standardCycles: 2, branchOutcome: 'taken', description: 'Zero 플래그 참 -> target_loop로 분기 점프' },
      { id: 'b3', pc: 0x0102, mnemonic: 'LDI', operands: 'R18, 0x10', category: 'alu', words: 1, standardCycles: 1, isBubble: true, bubbleReason: '분기 성립으로 인한 프리페치 무효화 (Flush/Bubble)', description: '[버블] 원래 순차 주소였으나 폐기됨' },
      { id: 'b4', pc: 0x0120, mnemonic: 'target: LDI', operands: 'R17, 0xFF', category: 'alu', words: 1, standardCycles: 1, description: '분기 타깃 주소 명령어가 새로 인출되어 실행됨' },
      { id: 'b5', pc: 0x0121, mnemonic: 'INC', operands: 'R17', category: 'alu', words: 1, standardCycles: 1, description: 'R17 값 1 증가' }
    ]
  },
  {
    id: 'branch_not_taken',
    name: '조건 분기 불성립 (Branch Not Taken) 1 사이클 통과',
    badge: '1 Cycle (No Stall)',
    description: '조건 분기 조건이 거짓(False)이면 분기하지 않고 다음 순차 명령어로 넘어가므로, 프리페치된 파이프라인이 그대로 유지되어 1사이클만 소요됩니다.',
    scenarioHighlight: '루프 종료 검사 시 분기하지 않는 마지막 패스는 파이프라인 지연 없이 단 1사이클로 즉시 실행됩니다.',
    instructions: [
      { id: 'nt1', pc: 0x0150, mnemonic: 'CPI', operands: 'R20, 0x05', category: 'alu', words: 1, standardCycles: 1, description: 'R20과 5 비교 (Z 플래그 클리어)' },
      { id: 'nt2', pc: 0x0151, mnemonic: 'BREQ', operands: 'exit_func', category: 'branch', words: 1, standardCycles: 1, branchOutcome: 'not_taken', description: 'Zero 플래그 거짓 -> 분기 안 함 (순차 실행 계속)' },
      { id: 'nt3', pc: 0x0152, mnemonic: 'ADD', operands: 'R20, R21', category: 'alu', words: 1, standardCycles: 1, description: '프리페치된 다음 명령어가 버블 없이 즉시 실행' },
      { id: 'nt4', pc: 0x0153, mnemonic: 'STS', operands: '0x0200, R20', category: 'memory', words: 2, standardCycles: 2, description: '2워드(32비트) SRAM 쓰기 (2 사이클)' }
    ]
  },
  {
    id: 'sram_twoword',
    name: '2워드 메모리 직접 접근 (LDS / STS) 파이프라인',
    badge: '2 Words / 2 Cycles',
    description: '16비트 주소를 포함하는 32비트 2워드 명령어(LDS, STS, JMP, CALL)는 플래시 버스에서 2번에 걸쳐 인출되므로 2사이클이 필요합니다.',
    scenarioHighlight: '하버드 아키텍처이므로 데이터 SRAM 버스와 플래시 프로그램 버스가 분리되어 있으나 명령어 길이가 2워드라 2클럭이 걸립니다.',
    instructions: [
      { id: 'm1', pc: 0x0200, mnemonic: 'LDS', operands: 'R24, 0x0140 (Word 1)', category: 'memory', words: 2, standardCycles: 2, description: 'SRAM 0x0140 번지에서 R24로 직접 로드 (사이클 1: 명령어 인출, 사이클 2: 16비트 주소 인출 & SRAM 읽기)' },
      { id: 'm2', pc: 0x0202, mnemonic: 'ADIW', operands: 'R24, 0x01', category: 'alu', words: 1, standardCycles: 2, description: '16비트 레지스터 쌍(R25:R24) 1 워드 증가 (2 사이클 연산)' },
      { id: 'm3', pc: 0x0203, mnemonic: 'STS', operands: '0x0140, R24', category: 'memory', words: 2, standardCycles: 2, description: '계산된 R24 값을 SRAM 0x0140에 다시 직접 저장 (2 사이클)' }
    ]
  },
  {
    id: 'call_ret',
    name: '서브루틴 호출 및 복귀 (CALL & RET) 스택 파이프라인',
    badge: '4 Cycles / Stack',
    description: 'CALL은 2워드 인출 + 복귀 주소(PC) 2바이트 스택 PUSH로 4사이클, RET은 스택에서 PC 2바이트 POP 후 파이프라인 재충전으로 4~5사이클 소요됩니다.',
    scenarioHighlight: '함수 호출 및 인터럽트 발생 시 스택 메모리 조작과 파이프라인 재충전 오버헤드를 체계적으로 확인합니다.',
    instructions: [
      { id: 'c1', pc: 0x0300, mnemonic: 'CALL', operands: 'delay_ms', category: 'call', words: 2, standardCycles: 4, description: '함수 호출: 다음 PC 스택 PUSH (2사이클) + 타깃 주소 인출 (2사이클) = 4사이클' },
      { id: 'c2', pc: 0x0400, mnemonic: 'sub: PUSH', operands: 'R16', category: 'memory', words: 1, standardCycles: 2, description: '레지스터 보존: SP 감소 및 SRAM 스택 쓰기 (2사이클)' },
      { id: 'c3', pc: 0x0401, mnemonic: 'POP', operands: 'R16', category: 'memory', words: 1, standardCycles: 2, description: '레지스터 복원: SRAM 스택 읽기 및 SP 증가 (2사이클)' },
      { id: 'c4', pc: 0x0402, mnemonic: 'RET', operands: '', category: 'call', words: 1, standardCycles: 4, description: '복귀: 스택에서 이전 PC 2바이트 POP 후 파이프라인 재충전 (4사이클)' }
    ]
  }
];

// Pipeline cycle state for visualization
interface CycleSnapshot {
  cycleIndex: number; // 1-based (T1, T2, ...)
  fetchInst: PipelineInstruction | null;
  decodeInst: PipelineInstruction | null;
  executeInst: PipelineInstruction | null;
  writebackInst: PipelineInstruction | null;
  activeBus: 'program' | 'data' | 'both' | 'idle';
  activeALU: boolean;
  activeSREG: boolean;
  activeGPR: boolean;
  statusText: string;
  isBubbleCycle: boolean;
  cumulativeCompleted: number;
}

export const InstructionPipelineVisualizer: React.FC<InstructionPipelineVisualizerProps> = ({
  selectedMCU,
  onSelectMCU
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const [selectedPresetId, setSelectedPresetId] = useState<string>('linear_alu');
  const [currentCycle, setCurrentCycle] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1000); // ms per cycle
  const [viewMode, setViewMode] = useState<'block_diagram' | 'pipeline_matrix'>('block_diagram');
  const [simClockMhz, setSimClockMhz] = useState<number>(selectedMCU === 'atmega328p' ? 20 : 16);

  // SVG ref for D3 rendering
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Sync clock when MCU changes
  useEffect(() => {
    setSimClockMhz(selectedMCU === 'atmega328p' ? 20 : 16);
  }, [selectedMCU]);

  const activePreset = useMemo(() => {
    return PRESETS.find(p => p.id === selectedPresetId) || PRESETS[0];
  }, [selectedPresetId]);

  // Compute the cycle-by-cycle sequence of the pipeline based on AVR 2-stage RISC architecture:
  // Stage 1: Instruction Fetch (IF) from Flash ROM into IR
  // Stage 2: Instruction Execute (IE) - Decode, ALU calculate, Register read/write, PC update
  const cycleTimeline = useMemo<CycleSnapshot[]>(() => {
    const list = activePreset.instructions;
    const snapshots: CycleSnapshot[] = [];

    // Let's model the cycle progression
    let completedCount = 0;

    if (activePreset.id === 'linear_alu') {
      // Ideal 2-stage pipelining:
      // Cycle 1: Fetch I1, Execute None
      // Cycle 2: Fetch I2, Execute I1
      // Cycle 3: Fetch I3, Execute I2
      // ...
      const totalCycles = list.length + 1;
      for (let t = 1; t <= totalCycles; t++) {
        const fetchIdx = t - 1 < list.length ? t - 1 : -1;
        const execIdx = t - 2 >= 0 && t - 2 < list.length ? t - 2 : -1;

        if (execIdx >= 0) completedCount++;

        snapshots.push({
          cycleIndex: t,
          fetchInst: fetchIdx >= 0 ? list[fetchIdx] : null,
          decodeInst: execIdx >= 0 ? list[execIdx] : null, // In AVR, decode occurs at start of execute stage
          executeInst: execIdx >= 0 ? list[execIdx] : null,
          writebackInst: execIdx >= 0 ? list[execIdx] : null,
          activeBus: fetchIdx >= 0 && execIdx >= 0 ? 'both' : fetchIdx >= 0 ? 'program' : 'data',
          activeALU: execIdx >= 0 && list[execIdx].category === 'alu',
          activeSREG: execIdx >= 0 && list[execIdx].mnemonic !== 'NOP',
          activeGPR: execIdx >= 0,
          statusText:
            execIdx >= 0 && fetchIdx >= 0
              ? `[T${t}] ${list[fetchIdx].mnemonic} 인출(Flash)과 ${list[execIdx].mnemonic} 실행(ALU)이 동시 오버랩 수행 중`
              : fetchIdx >= 0
              ? `[T${t}] 첫 명령어 ${list[fetchIdx].mnemonic} 인출 (파이프라인 충전 시작)`
              : `[T${t}] 마지막 명령어 ${list[execIdx].mnemonic} 실행 완료`,
          isBubbleCycle: false,
          cumulativeCompleted: completedCount
        });
      }
    } else if (activePreset.id === 'branch_taken') {
      // Branch taken:
      // T1: Fetch CPI
      // T2: Fetch BREQ, Execute CPI
      // T3: Fetch LDI(b3), Execute BREQ (Branch condition evaluated -> TRUE! Flushes prefetched LDI)
      // T4: Flush bubble (Bubble in Exec), Fetch target LDI(b4) (PC reloaded to 0x0120)
      // T5: Fetch INC(b5), Execute target LDI(b4)
      // T6: Fetch None, Execute INC(b5)
      const bCPI = list[0];
      const bBREQ = list[1];
      const bBubble = list[2];
      const bTargetLDI = list[3];
      const bINC = list[4];

      snapshots.push({
        cycleIndex: 1,
        fetchInst: bCPI,
        decodeInst: null,
        executeInst: null,
        writebackInst: null,
        activeBus: 'program',
        activeALU: false,
        activeSREG: false,
        activeGPR: false,
        statusText: '[T1] CPI R16, 0x00 인출 (Flash ROM -> IR)',
        isBubbleCycle: false,
        cumulativeCompleted: 0
      });

      snapshots.push({
        cycleIndex: 2,
        fetchInst: bBREQ,
        decodeInst: bCPI,
        executeInst: bCPI,
        writebackInst: bCPI,
        activeBus: 'both',
        activeALU: true,
        activeSREG: true,
        activeGPR: true,
        statusText: '[T2] BREQ 인출 중 CPI 비교 연산 완료 (Z-flag = 1 세트)',
        isBubbleCycle: false,
        cumulativeCompleted: 1
      });

      snapshots.push({
        cycleIndex: 3,
        fetchInst: bBubble,
        decodeInst: bBREQ,
        executeInst: bBREQ,
        writebackInst: null,
        activeBus: 'both',
        activeALU: true,
        activeSREG: false,
        activeGPR: false,
        statusText: '[T3] BREQ 조건 판별: Z=1 (참). 분기 성립! 직전 프리페치된 명령어 무효화 트리거',
        isBubbleCycle: false,
        cumulativeCompleted: 1
      });

      snapshots.push({
        cycleIndex: 4,
        fetchInst: bTargetLDI,
        decodeInst: null,
        executeInst: { ...bBubble, mnemonic: '[STALL / FLUSH]' },
        writebackInst: null,
        activeBus: 'program',
        activeALU: false,
        activeSREG: false,
        activeGPR: false,
        statusText: '[T4 버블 발생] 파이프라인 플러시(버블): 폐기된 명령어 NOP 처리 & 타깃 0x0120 인출',
        isBubbleCycle: true,
        cumulativeCompleted: 2 // BREQ completes
      });

      snapshots.push({
        cycleIndex: 5,
        fetchInst: bINC,
        decodeInst: bTargetLDI,
        executeInst: bTargetLDI,
        writebackInst: bTargetLDI,
        activeBus: 'both',
        activeALU: true,
        activeSREG: false,
        activeGPR: true,
        statusText: '[T5] 타깃 LDI R17, 0xFF 실행 및 INC R17 인출 (파이프라인 정상 궤도 회복)',
        isBubbleCycle: false,
        cumulativeCompleted: 3
      });

      snapshots.push({
        cycleIndex: 6,
        fetchInst: null,
        decodeInst: bINC,
        executeInst: bINC,
        writebackInst: bINC,
        activeBus: 'data',
        activeALU: true,
        activeSREG: true,
        activeGPR: true,
        statusText: '[T6] INC R17 실행 완료',
        isBubbleCycle: false,
        cumulativeCompleted: 4
      });
    } else if (activePreset.id === 'branch_not_taken') {
      // Branch not taken:
      // T1: Fetch CPI
      // T2: Fetch BREQ, Exec CPI
      // T3: Fetch ADD, Exec BREQ (Evaluated FALSE -> 1 cycle, No flush!)
      // T4: Fetch STS (Word 1), Exec ADD
      // T5: Fetch STS (Word 2), Exec STS (Cycle 1)
      // T6: Fetch None, Exec STS (Cycle 2: SRAM write)
      snapshots.push({
        cycleIndex: 1,
        fetchInst: list[0],
        decodeInst: null,
        executeInst: null,
        writebackInst: null,
        activeBus: 'program',
        activeALU: false,
        activeSREG: false,
        activeGPR: false,
        statusText: '[T1] CPI R20, 0x05 명령어 인출',
        isBubbleCycle: false,
        cumulativeCompleted: 0
      });
      snapshots.push({
        cycleIndex: 2,
        fetchInst: list[1],
        decodeInst: list[0],
        executeInst: list[0],
        writebackInst: list[0],
        activeBus: 'both',
        activeALU: true,
        activeSREG: true,
        activeGPR: true,
        statusText: '[T2] BREQ 인출 중 CPI 비교 실행 (Z-flag = 0 클리어)',
        isBubbleCycle: false,
        cumulativeCompleted: 1
      });
      snapshots.push({
        cycleIndex: 3,
        fetchInst: list[2],
        decodeInst: list[1],
        executeInst: list[1],
        writebackInst: null,
        activeBus: 'both',
        activeALU: false,
        activeSREG: false,
        activeGPR: false,
        statusText: '[T3] BREQ 조건 검사: Z=0 (거짓). 분기 불성립! 플러시 없이 프리페치된 ADD 즉시 실행 대기',
        isBubbleCycle: false,
        cumulativeCompleted: 2
      });
      snapshots.push({
        cycleIndex: 4,
        fetchInst: list[3],
        decodeInst: list[2],
        executeInst: list[2],
        writebackInst: list[2],
        activeBus: 'both',
        activeALU: true,
        activeSREG: true,
        activeGPR: true,
        statusText: '[T4] ADD R20, R21 실행 & STS 1워드 인출 (지연 없음, CPI = 1.0 유지)',
        isBubbleCycle: false,
        cumulativeCompleted: 3
      });
      snapshots.push({
        cycleIndex: 5,
        fetchInst: null,
        decodeInst: list[3],
        executeInst: list[3],
        writebackInst: null,
        activeBus: 'program',
        activeALU: false,
        activeSREG: false,
        activeGPR: true,
        statusText: '[T5] STS 주소 버스 인출 및 SRAM 어드레싱',
        isBubbleCycle: false,
        cumulativeCompleted: 3
      });
      snapshots.push({
        cycleIndex: 6,
        fetchInst: null,
        decodeInst: null,
        executeInst: list[3],
        writebackInst: list[3],
        activeBus: 'data',
        activeALU: false,
        activeSREG: false,
        activeGPR: true,
        statusText: '[T6] SRAM 데이터 버스에 R20 값 기록 완료 (2사이클 완료)',
        isBubbleCycle: false,
        cumulativeCompleted: 4
      });
    } else {
      // Generic multi-cycle approximation
      const totalSteps = 7;
      for (let t = 1; t <= totalSteps; t++) {
        const fetchIdx = Math.min(Math.floor((t - 1) / 1.5), list.length - 1);
        const execIdx = Math.max(0, Math.min(Math.floor((t - 2) / 1.5), list.length - 1));

        snapshots.push({
          cycleIndex: t,
          fetchInst: t < totalSteps ? list[fetchIdx] : null,
          decodeInst: t > 1 ? list[execIdx] : null,
          executeInst: t > 1 ? list[execIdx] : null,
          writebackInst: t > 1 ? list[execIdx] : null,
          activeBus: t % 2 === 0 ? 'both' : 'program',
          activeALU: true,
          activeSREG: true,
          activeGPR: true,
          statusText: `[T${t}] ${list[execIdx]?.mnemonic} 다중 사이클 처리 진행 중`,
          isBubbleCycle: false,
          cumulativeCompleted: Math.min(list.length, Math.floor(t / 1.6))
        });
      }
    }

    return snapshots;
  }, [activePreset]);

  // Current active snapshot
  const activeCycleData = useMemo(() => {
    return cycleTimeline[Math.min(currentCycle - 1, cycleTimeline.length - 1)] || cycleTimeline[0];
  }, [cycleTimeline, currentCycle]);

  // Total cycles in timeline
  const totalCycles = cycleTimeline.length;

  // Auto-play timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentCycle(prev => {
          if (prev >= totalCycles) {
            return 1; // loop
          }
          return prev + 1;
        });
      }, playbackSpeed);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, playbackSpeed, totalCycles]);

  // Reset cycle when preset changes
  useEffect(() => {
    setCurrentCycle(1);
    setIsPlaying(false);
  }, [selectedPresetId]);

  // Calculations for Throughput & CPI
  const throughputMetrics = useMemo(() => {
    const totalInsts = activePreset.instructions.filter(i => !i.isBubble).length;
    const cpi = Number((totalCycles / totalInsts).toFixed(2));
    const mips = Number((simClockMhz / cpi).toFixed(2));
    const theoreticalMaxMips = simClockMhz;
    const efficiencyPct = Math.round((mips / theoreticalMaxMips) * 100);

    // Comparison against classic non-pipelined core (CPI ~ 2.0) & CISC 8051 (12 clocks per machine cycle)
    const nonPipelinedMips = Number((simClockMhz / 2.0).toFixed(2));
    const cisc8051Mips = Number((simClockMhz / 12.0).toFixed(2));
    const speedupVs8051 = Number((mips / cisc8051Mips).toFixed(1));
    const speedupVsNonPipe = Number((mips / nonPipelinedMips).toFixed(2));

    return {
      totalInsts,
      totalCycles,
      cpi,
      mips,
      theoreticalMaxMips,
      efficiencyPct,
      nonPipelinedMips,
      cisc8051Mips,
      speedupVs8051,
      speedupVsNonPipe
    };
  }, [activePreset, totalCycles, simClockMhz]);

  // ==========================================
  // D3.js Pipeline Block Diagram Rendering
  // ==========================================
  useEffect(() => {
    if (!svgRef.current || viewMode !== 'block_diagram') return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 860;
    const height = 360;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', 'translate(0, 0)');

    // Definitions (Gradients and Markers)
    const defs = svg.append('defs');

    // Glow filter
    const filter = defs.append('filter').attr('id', 'glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    filter.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

    // Arrow markers
    const createMarker = (id: string, color: string) => {
      defs
        .append('marker')
        .attr('id', id)
        .attr('viewBox', '0 0 10 10')
        .attr('refX', 7)
        .attr('refY', 5)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto-start-reverse')
        .append('path')
        .attr('d', 'M 0 1 L 10 5 L 0 9 z')
        .attr('fill', color);
    };

    createMarker('arrow-cyan', '#06b6d4');
    createMarker('arrow-emerald', '#10b981');
    createMarker('arrow-amber', '#f59e0b');
    createMarker('arrow-violet', '#8b5cf6');
    createMarker('arrow-rose', '#f43f5e');
    createMarker('arrow-slate', '#64748b');

    // Block Definitions in Architectural Layout
    // 1. Program Counter (PC)
    // 2. Flash Program Memory (16-bit)
    // 3. Instruction Register (IR) & Decoder
    // 4. 32 General Purpose Registers (R0-R31)
    // 5. 8-bit Arithmetic Logic Unit (ALU)
    // 6. Status Register (SREG)
    // 7. Data SRAM / I/O Bus

    const isFetchActive = !!activeCycleData.fetchInst;
    const isExecuteActive = !!activeCycleData.executeInst && !activeCycleData.isBubbleCycle;
    const isBubbleActive = activeCycleData.isBubbleCycle;

    interface ArchNode {
      id: string;
      title: string;
      subtitle: string;
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      bgColor: string;
      borderColor: string;
      isActive: boolean;
      tag: string;
    }

    const nodes: ArchNode[] = [
      {
        id: 'pc',
        title: 'Program Counter (PC)',
        subtitle: isFetchActive ? `PC: 0x${activeCycleData.fetchInst?.pc.toString(16).toUpperCase().padStart(4, '0')}` : 'PC: Idle',
        x: 40,
        y: 45,
        w: 160,
        h: 60,
        color: '#10b981',
        bgColor: isFetchActive ? '#064e3b' : '#0f172a',
        borderColor: isFetchActive ? '#10b981' : '#334155',
        isActive: isFetchActive,
        tag: 'Stage 1: Fetch'
      },
      {
        id: 'flash',
        title: 'Flash Program ROM',
        subtitle: `${currentProfile.flash}KB (16-bit Bus)`,
        x: 40,
        y: 140,
        w: 160,
        h: 80,
        color: '#10b981',
        bgColor: isFetchActive ? '#064e3b' : '#0f172a',
        borderColor: isFetchActive ? '#34d399' : '#334155',
        isActive: isFetchActive,
        tag: 'Harvard Prog Bus'
      },
      {
        id: 'ir_decoder',
        title: 'IR & Opcode Decoder',
        subtitle: isFetchActive
          ? `IR: ${activeCycleData.fetchInst?.mnemonic} ${activeCycleData.fetchInst?.operands}`
          : isExecuteActive
          ? `Exec: ${activeCycleData.executeInst?.mnemonic}`
          : 'Opcode Decoder',
        x: 250,
        y: 90,
        w: 190,
        h: 95,
        color: isBubbleActive ? '#f43f5e' : isExecuteActive ? '#f59e0b' : '#38bdf8',
        bgColor: isBubbleActive ? '#4c0519' : isExecuteActive ? '#451a03' : '#0f172a',
        borderColor: isBubbleActive ? '#f43f5e' : isExecuteActive ? '#f59e0b' : '#334155',
        isActive: isExecuteActive || isBubbleActive,
        tag: isBubbleActive ? 'BUBBLE / FLUSH' : 'Control Unit'
      },
      {
        id: 'gpr',
        title: '32 General Purpose Regs',
        subtitle: 'R0 ~ R31 (Dual-port Read)',
        x: 490,
        y: 40,
        w: 180,
        h: 80,
        color: '#8b5cf6',
        bgColor: isExecuteActive && activeCycleData.activeGPR ? '#2e1065' : '#0f172a',
        borderColor: isExecuteActive && activeCycleData.activeGPR ? '#a78bfa' : '#334155',
        isActive: isExecuteActive && activeCycleData.activeGPR,
        tag: '1-Cycle Access'
      },
      {
        id: 'alu',
        title: '8-bit AVR RISC ALU',
        subtitle: isExecuteActive ? `Op: ${activeCycleData.executeInst?.mnemonic} (HW Multiplier)` : 'ALU & Multiplier',
        x: 490,
        y: 160,
        w: 180,
        h: 80,
        color: '#06b6d4',
        bgColor: isExecuteActive && activeCycleData.activeALU ? '#083344' : '#0f172a',
        borderColor: isExecuteActive && activeCycleData.activeALU ? '#22d3ee' : '#334155',
        isActive: isExecuteActive && activeCycleData.activeALU,
        tag: 'Stage 2: Execute'
      },
      {
        id: 'sreg',
        title: 'Status Register (SREG)',
        subtitle: 'I | T | H | S | V | N | Z | C',
        x: 710,
        y: 80,
        w: 130,
        h: 70,
        color: '#eab308',
        bgColor: isExecuteActive && activeCycleData.activeSREG ? '#422006' : '#0f172a',
        borderColor: isExecuteActive && activeCycleData.activeSREG ? '#facc15' : '#334155',
        isActive: isExecuteActive && activeCycleData.activeSREG,
        tag: 'CPU Flags'
      },
      {
        id: 'sram',
        title: 'Data SRAM / I/O Bus',
        subtitle: `${currentProfile.sram}KB Data Memory`,
        x: 710,
        y: 190,
        w: 130,
        h: 80,
        color: '#ec4899',
        bgColor: activeCycleData.executeInst?.category === 'memory' ? '#500724' : '#0f172a',
        borderColor: activeCycleData.executeInst?.category === 'memory' ? '#f472b6' : '#334155',
        isActive: activeCycleData.executeInst?.category === 'memory',
        tag: 'Harvard Data Bus'
      }
    ];

    // Pipeline Stage Containers (Background Bounding Boxes)
    // Stage 1 Boundary: Fetch Stage (Green Glow)
    g.append('rect')
      .attr('x', 20)
      .attr('y', 20)
      .attr('width', 200)
      .attr('height', 240)
      .attr('rx', 16)
      .attr('fill', '#064e3b')
      .attr('fill-opacity', isFetchActive ? 0.2 : 0.05)
      .attr('stroke', '#10b981')
      .attr('stroke-width', isFetchActive ? 1.5 : 0.8)
      .attr('stroke-dasharray', isFetchActive ? 'none' : '4,4');

    g.append('text')
      .attr('x', 32)
      .attr('y', 36)
      .attr('fill', '#10b981')
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .text('STAGE 1: INSTRUCTION FETCH');

    // Stage 2 Boundary: Execute Stage (Cyan / Amber Glow)
    g.append('rect')
      .attr('x', 235)
      .attr('y', 20)
      .attr('width', 615)
      .attr('height', 260)
      .attr('rx', 16)
      .attr('fill', isBubbleActive ? '#4c0519' : '#0c4a6e')
      .attr('fill-opacity', isExecuteActive || isBubbleActive ? 0.2 : 0.05)
      .attr('stroke', isBubbleActive ? '#f43f5e' : '#06b6d4')
      .attr('stroke-width', isExecuteActive || isBubbleActive ? 1.5 : 0.8)
      .attr('stroke-dasharray', isExecuteActive ? 'none' : '4,4');

    g.append('text')
      .attr('x', 250)
      .attr('y', 36)
      .attr('fill', isBubbleActive ? '#f43f5e' : '#06b6d4')
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .text(isBubbleActive ? 'STAGE 2: PIPELINE FLUSH (NOP / BUBBLE)' : 'STAGE 2: DECODE, EXECUTE & WRITEBACK');

    // Draw Connecting Data/Address Bus Lines
    interface BusWire {
      d: string;
      color: string;
      marker: string;
      active: boolean;
      label?: string;
      labelX?: number;
      labelY?: number;
    }

    const wires: BusWire[] = [
      // PC to Flash Address Bus
      {
        d: 'M 120 105 L 120 140',
        color: isFetchActive ? '#10b981' : '#475569',
        marker: isFetchActive ? 'url(#arrow-emerald)' : 'url(#arrow-slate)',
        active: isFetchActive,
        label: '16-bit PC',
        labelX: 125,
        labelY: 125
      },
      // Flash to IR 16-bit Instruction Bus
      {
        d: 'M 200 170 L 250 145',
        color: isFetchActive ? '#10b981' : '#475569',
        marker: isFetchActive ? 'url(#arrow-emerald)' : 'url(#arrow-slate)',
        active: isFetchActive,
        label: '16-bit Flash Bus',
        labelX: 200,
        labelY: 155
      },
      // IR/Decoder to GPR (Register Select)
      {
        d: 'M 440 120 L 490 85',
        color: isExecuteActive ? '#8b5cf6' : '#475569',
        marker: isExecuteActive ? 'url(#arrow-violet)' : 'url(#arrow-slate)',
        active: isExecuteActive,
        label: 'Rd, Rr Select',
        labelX: 440,
        labelY: 98
      },
      // GPR to ALU (Dual-port read)
      {
        d: 'M 580 120 L 580 160',
        color: isExecuteActive ? '#06b6d4' : '#475569',
        marker: isExecuteActive ? 'url(#arrow-cyan)' : 'url(#arrow-slate)',
        active: isExecuteActive,
        label: 'Operand A, B',
        labelX: 585,
        labelY: 142
      },
      // ALU to GPR (Writeback loop)
      {
        d: 'M 520 160 L 520 120',
        color: isExecuteActive ? '#10b981' : '#475569',
        marker: isExecuteActive ? 'url(#arrow-emerald)' : 'url(#arrow-slate)',
        active: isExecuteActive,
        label: 'Writeback Rd',
        labelX: 475,
        labelY: 142
      },
      // ALU to SREG (Flag updates)
      {
        d: 'M 670 180 L 710 130',
        color: isExecuteActive && activeCycleData.activeSREG ? '#eab308' : '#475569',
        marker: isExecuteActive && activeCycleData.activeSREG ? 'url(#arrow-amber)' : 'url(#arrow-slate)',
        active: isExecuteActive && activeCycleData.activeSREG,
        label: 'Flag Update',
        labelX: 660,
        labelY: 150
      },
      // SREG/ALU to Data SRAM
      {
        d: 'M 670 215 L 710 225',
        color: activeCycleData.executeInst?.category === 'memory' ? '#ec4899' : '#475569',
        marker: activeCycleData.executeInst?.category === 'memory' ? 'url(#arrow-rose)' : 'url(#arrow-slate)',
        active: activeCycleData.executeInst?.category === 'memory',
        label: '8-bit SRAM Bus',
        labelX: 660,
        labelY: 235
      }
    ];

    // Render Bus wires
    wires.forEach(w => {
      const path = g
        .append('path')
        .attr('d', w.d)
        .attr('fill', 'none')
        .attr('stroke', w.color)
        .attr('stroke-width', w.active ? 2.5 : 1.2)
        .attr('marker-end', w.marker);

      if (w.active) {
        path.attr('stroke-dasharray', '4,4').attr('filter', 'url(#glow)');

        // Animate stroke dash offset to show current flow!
        path
          .append('animate')
          .attr('attributeName', 'stroke-dashoffset')
          .attr('from', '8')
          .attr('to', '0')
          .attr('dur', '0.6s')
          .attr('repeatCount', 'indefinite');
      }

      if (w.label) {
        g.append('text')
          .attr('x', w.labelX || 0)
          .attr('y', w.labelY || 0)
          .attr('fill', w.active ? '#cbd5e1' : '#64748b')
          .attr('font-size', '9px')
          .attr('font-family', 'monospace')
          .text(w.label);
      }
    });

    // Render Architectural Nodes
    nodes.forEach(n => {
      const nodeG = g.append('g').attr('transform', `translate(${n.x}, ${n.y})`);

      // Rect
      const rect = nodeG
        .append('rect')
        .attr('width', n.w)
        .attr('height', n.h)
        .attr('rx', 10)
        .attr('fill', n.bgColor)
        .attr('stroke', n.borderColor)
        .attr('stroke-width', n.isActive ? 2 : 1);

      if (n.isActive) {
        rect.attr('filter', 'url(#glow)');
      }

      // Tag pill
      nodeG
        .append('rect')
        .attr('x', n.w - 76)
        .attr('y', 6)
        .attr('width', 70)
        .attr('height', 16)
        .attr('rx', 4)
        .attr('fill', n.borderColor)
        .attr('fill-opacity', 0.25);

      nodeG
        .append('text')
        .attr('x', n.w - 41)
        .attr('y', 17)
        .attr('text-anchor', 'middle')
        .attr('fill', n.color)
        .attr('font-size', '8px')
        .attr('font-weight', 'bold')
        .text(n.tag);

      // Title
      nodeG
        .append('text')
        .attr('x', 12)
        .attr('y', 24)
        .attr('fill', '#ffffff')
        .attr('font-size', '11px')
        .attr('font-weight', 'bold')
        .text(n.title);

      // Subtitle / Dynamic Instruction Value
      nodeG
        .append('text')
        .attr('x', 12)
        .attr('y', 44)
        .attr('fill', n.isActive ? n.color : '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .text(n.subtitle);

      // Extra status info line inside box
      if (n.id === 'pc' && isFetchActive) {
        nodeG
          .append('text')
          .attr('x', 12)
          .attr('y', 55)
          .attr('fill', '#34d399')
          .attr('font-size', '8px')
          .text('PC <- PC + 1');
      } else if (n.id === 'ir_decoder' && isBubbleActive) {
        nodeG
          .append('text')
          .attr('x', 12)
          .attr('y', 68)
          .attr('fill', '#fb7185')
          .attr('font-size', '9px')
          .attr('font-weight', 'bold')
          .text('⚠️ Branch Stall Bubble!');
      } else if (n.id === 'ir_decoder' && isExecuteActive) {
        nodeG
          .append('text')
          .attr('x', 12)
          .attr('y', 68)
          .attr('fill', '#fbbf24')
          .attr('font-size', '9px')
          .text(activeCycleData.executeInst?.description || '');
      } else if (n.id === 'alu' && isExecuteActive) {
        nodeG
          .append('text')
          .attr('x', 12)
          .attr('y', 62)
          .attr('fill', '#67e8f9')
          .attr('font-size', '9px')
          .text('1-Cycle Execution');
      }
    });

    // Bottom Bus Description Banner
    const bannerG = g.append('g').attr('transform', 'translate(40, 295)');

    bannerG
      .append('rect')
      .attr('width', 780)
      .attr('height', 48)
      .attr('rx', 8)
      .attr('fill', '#090d16')
      .attr('stroke', '#1e293b');

    // Animated clock indicator
    const clockPulse = bannerG.append('circle').attr('cx', 24).attr('cy', 24).attr('r', 8).attr('fill', '#06b6d4');

    clockPulse.append('animate').attr('attributeName', 'opacity').attr('values', '1; 0.3; 1').attr('dur', '0.8s').attr('repeatCount', 'indefinite');

    bannerG
      .append('text')
      .attr('x', 42)
      .attr('y', 20)
      .attr('fill', '#38bdf8')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .text(`CLOCK CYCLE T${activeCycleData.cycleIndex} (${simClockMhz} MHz System Clock)`);

    bannerG
      .append('text')
      .attr('x', 42)
      .attr('y', 36)
      .attr('fill', activeCycleData.isBubbleCycle ? '#fb7185' : '#cbd5e1')
      .attr('font-size', '10.5px')
      .text(activeCycleData.statusText);

    // Harvard Architecture Advantage Pill
    bannerG
      .append('text')
      .attr('x', 760)
      .attr('y', 28)
      .attr('text-anchor', 'end')
      .attr('fill', '#10b981')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .text(`Harvard Bus: ${activeCycleData.activeBus.toUpperCase()} BUS ACTIVE`);
  }, [activeCycleData, viewMode, currentProfile, simClockMhz]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-6 shadow-xl relative overflow-hidden">
      {/* Header & Badges */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">AVR RISC 명령어 파이프라인 시각화 (Instruction Pipeline Visualizer)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  D3.js Animated
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  2-Stage Harvard Pipeline
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentProfile.name}의 Fetch(인출)-Decode(해독)-Execute(실행) 2단계 파이프라인과 명령어 처리량(MIPS/CPI)을 D3.js 애니메이션으로 시뮬레이션합니다.
              </p>
            </div>
          </div>
        </div>

        {/* View Mode & Preset Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
            <button
              onClick={() => setViewMode('block_diagram')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'block_diagram' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              블록 다이어그램 (D3 Flow)
            </button>
            <button
              onClick={() => setViewMode('pipeline_matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'pipeline_matrix' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              타임-스페이스 행렬 (Cycle Grid)
            </button>
          </div>
        </div>
      </div>

      {/* Preset Selector Tabs */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
          <span>명령어 시나리오 프리셋 선택 (Pipeline Scenarios)</span>
          <span className="text-[11px] font-mono text-cyan-400">{activePreset.badge}</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
          {PRESETS.map(preset => {
            const isSelected = preset.id === selectedPresetId;
            return (
              <button
                key={preset.id}
                onClick={() => setSelectedPresetId(preset.id)}
                className={`text-left p-3 rounded-xl border transition-all relative ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-500/40'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'}`}>
                    {preset.badge}
                  </span>
                  {isSelected && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
                </div>
                <div className={`text-xs font-bold leading-tight ${isSelected ? 'text-white' : 'text-slate-300'}`}>{preset.name}</div>
                <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">{preset.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Controls & Playback Bar */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Playback Button Group */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${
              isPlaying
                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? '일시 정지' : '자동 재생'}
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentCycle(prev => (prev < totalCycles ? prev + 1 : 1));
            }}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-700/60 text-xs font-semibold transition-all"
            title="1 클럭 전진 (Step Cycle)"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>다음 사이클 (Step)</span>
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentCycle(1);
            }}
            className="p-2 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition-all"
            title="T1으로 초기화"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Current Cycle Pill */}
          <div className="ml-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">클럭 사이클:</span>
            <span className="text-cyan-400 font-bold text-sm">
              T{currentCycle} / T{totalCycles}
            </span>
          </div>
        </div>

        {/* Speed & Clock Sliders */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <label className="text-[11px] text-slate-400 font-medium whitespace-nowrap">애니메이션 속도:</label>
            <select
              value={playbackSpeed}
              onChange={e => setPlaybackSpeed(Number(e.target.value))}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value={1500}>0.67 Hz (천천히 교육용)</option>
              <option value={1000}>1.0 Hz (기본 1초/클럭)</option>
              <option value={500}>2.0 Hz (빠르게)</option>
              <option value={250}>4.0 Hz (초고속)</option>
            </select>
          </div>

          <div className="flex items-center gap-2.5">
            <label className="text-[11px] text-slate-400 font-medium whitespace-nowrap">가상 클럭 주파수:</label>
            <div className="flex items-center gap-1.5">
              {[8, 16, 20].map(freq => (
                <button
                  key={freq}
                  onClick={() => setSimClockMhz(freq)}
                  className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-all ${
                    simClockMhz === freq
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {freq}MHz
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Visualizer Area (D3 Block Diagram or Matrix) */}
      {viewMode === 'block_diagram' ? (
        <div className="bg-slate-950 rounded-2xl border border-slate-800/80 p-3 md:p-4 relative">
          <div className="flex items-center justify-between mb-2 px-2">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>AVR RISC 하버드 아키텍처 파이프라인 블록 흐름 (D3 Canvas)</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Flash 인출 (Fetch)
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> 디코더 (Decode)
              </span>
              <span className="flex items-center gap-1 text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400" /> ALU 실행 (Execute)
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-400" /> 버블/플러시 (Bubble)
              </span>
            </div>
          </div>

          {/* SVG D3 Container */}
          <div className="w-full overflow-x-auto flex justify-center">
            <svg ref={svgRef} className="w-full max-w-[880px] min-w-[720px] h-[360px]" />
          </div>

          {/* Active Instructions In-Flight Tracker Banner */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-850">
            <div className="bg-slate-900/70 border border-emerald-500/30 rounded-xl p-3 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                IF
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="text-[11px] font-bold text-emerald-300 flex items-center gap-2">
                  <span>현재 인출 중인 명령어 (Stage 1: Fetch from Flash)</span>
                  {activeCycleData.fetchInst && (
                    <span className="font-mono text-[10px] bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800">
                      PC: 0x{activeCycleData.fetchInst.pc.toString(16).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono text-white font-bold truncate">
                  {activeCycleData.fetchInst ? `${activeCycleData.fetchInst.mnemonic} ${activeCycleData.fetchInst.operands}` : '인출 유휴 (Idle / 파이프라인 드레인)'}
                </div>
                <div className="text-[11px] text-slate-400 truncate">{activeCycleData.fetchInst?.description || '다음 실행 클럭을 위한 16비트 프리페치 대기'}</div>
              </div>
            </div>

            <div
              className={`rounded-xl p-3 flex items-start gap-3 border ${
                activeCycleData.isBubbleCycle
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  : 'bg-slate-900/70 border-cyan-500/30 text-cyan-200'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                  activeCycleData.isBubbleCycle ? 'bg-rose-500/20 text-rose-300' : 'bg-cyan-500/20 text-cyan-300'
                }`}
              >
                EX
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="text-[11px] font-bold flex items-center gap-2">
                  <span className={activeCycleData.isBubbleCycle ? 'text-rose-300' : 'text-cyan-300'}>
                    현재 실행 중인 명령어 (Stage 2: Execute / Writeback)
                  </span>
                  {activeCycleData.isBubbleCycle && <span className="text-[10px] bg-rose-500/20 px-1.5 py-0.2 rounded font-bold">1 Stall Bubble</span>}
                </div>
                <div className="text-xs font-mono text-white font-bold truncate">
                  {activeCycleData.isBubbleCycle
                    ? '⚠️ NOP (파이프라인 버블 / 플러시 처리)'
                    : activeCycleData.executeInst
                    ? `${activeCycleData.executeInst.mnemonic} ${activeCycleData.executeInst.operands}`
                    : '실행 유휴 (파이프라인 충전 대기)'}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {activeCycleData.isBubbleCycle
                    ? '분기 성립(Branch Taken)으로 인해 이미 프리페치된 명령어가 폐기되어 1사이클 소모'
                    : activeCycleData.executeInst?.description || '첫 명령어가 인출되는 중입니다.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Time-Space Cycle Matrix (Gantt Chart View) */
        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>클럭 사이클별 파이프라인 타임-스페이스 행렬 (Time-Space Pipeline Trace)</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">가로: 클럭 사이클 (T) • 세로: 프로그램 명령어 (Inst)</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3 text-left font-mono">PC</th>
                  <th className="py-2 px-3 text-left font-mono">명령어 (Assembly)</th>
                  <th className="py-2 px-3 text-left">종류</th>
                  {cycleTimeline.map(c => (
                    <th
                      key={c.cycleIndex}
                      className={`py-2 px-2.5 text-center font-mono transition-all ${
                        c.cycleIndex === currentCycle ? 'bg-cyan-500/20 text-cyan-300 font-bold border-b-2 border-cyan-400' : ''
                      }`}
                    >
                      T{c.cycleIndex}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 font-mono">
                {activePreset.instructions.map((inst, instIdx) => {
                  return (
                    <tr key={inst.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400">0x{inst.pc.toString(16).toUpperCase()}</td>
                      <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                        <span className={inst.isBubble ? 'text-rose-400 line-through' : ''}>
                          {inst.mnemonic} {inst.operands}
                        </span>
                        {inst.isBubble && <span className="text-[9px] font-sans px-1 rounded bg-rose-500/20 text-rose-300">Discarded</span>}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-400 text-[11px]">{inst.category.toUpperCase()}</td>

                      {/* Render Cell for each Cycle */}
                      {cycleTimeline.map(cycle => {
                        const isCurrentActiveCycle = cycle.cycleIndex === currentCycle;
                        let cellContent = '-';
                        let cellClass = 'text-slate-600 bg-slate-950/20';

                        if (cycle.fetchInst?.id === inst.id) {
                          cellContent = 'FETCH';
                          cellClass = 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40';
                        } else if (cycle.executeInst?.id === inst.id) {
                          if (cycle.isBubbleCycle || inst.isBubble) {
                            cellContent = 'FLUSH';
                            cellClass = 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40';
                          } else {
                            cellContent = 'EXEC';
                            cellClass = 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40';
                          }
                        }

                        return (
                          <td
                            key={cycle.cycleIndex}
                            className={`py-2.5 px-2 text-center text-[10px] transition-all ${cellClass} ${
                              isCurrentActiveCycle ? 'ring-1 ring-cyan-400' : ''
                            }`}
                          >
                            {cellContent}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Throughput & CPI Analytics KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: CPI */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>평균 사이클 수 (CPI)</span>
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white flex items-baseline gap-1.5">
            <span>{throughputMetrics.cpi}</span>
            <span className="text-xs font-normal text-slate-400">Cycles/Inst</span>
          </div>
          <div className="text-[11px] text-cyan-400 font-medium">
            {throughputMetrics.cpi === 1.0 ? '이상적 최고 속도 (1 클럭당 1 명령어)' : `${throughputMetrics.totalCycles} 사이클 / ${throughputMetrics.totalInsts} 명령어`}
          </div>
        </div>

        {/* KPI 2: Real MIPS */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>실효 처리량 (Throughput)</span>
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 flex items-baseline gap-1.5">
            <span>{throughputMetrics.mips}</span>
            <span className="text-xs font-normal text-slate-400">MIPS @ {simClockMhz}MHz</span>
          </div>
          <div className="text-[11px] text-slate-400">
            이론 최대치 {throughputMetrics.theoreticalMaxMips} MIPS 대비 <span className="text-emerald-300 font-bold">{throughputMetrics.efficiencyPct}%</span> 효율
          </div>
        </div>

        {/* KPI 3: Speedup vs Non-pipelined */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>비-파이프라인 대비 가속</span>
            <Flame className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-300 flex items-baseline gap-1.5">
            <span>{throughputMetrics.speedupVsNonPipe}x</span>
            <span className="text-xs font-normal text-slate-400">배 가속</span>
          </div>
          <div className="text-[11px] text-slate-400">
            비-파이프라인(CPI=2.0) {throughputMetrics.nonPipelinedMips} MIPS 대비 단축
          </div>
        </div>

        {/* KPI 4: Speedup vs CISC 8051 */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>CISC 8051 대비 성능</span>
            <Activity className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-purple-300 flex items-baseline gap-1.5">
            <span>{throughputMetrics.speedupVs8051}x</span>
            <span className="text-xs font-normal text-slate-400">배 고속</span>
          </div>
          <div className="text-[11px] text-slate-400">
            8051(12클럭=1머신사이클) 대비 압도적 연산력
          </div>
        </div>
      </div>

      {/* Architectural Deep-Dive Insights Card */}
      <div className="bg-gradient-to-r from-cyan-950/30 via-slate-950 to-slate-950 border border-slate-800 rounded-xl p-4 text-xs space-y-2.5">
        <div className="flex items-center gap-2 font-bold text-white">
          <Info className="w-4 h-4 text-cyan-400" />
          <span>AVR RISC 파이프라인 아키텍처 기술 해설: 단일 사이클 실행의 원리</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-400 text-[11px] leading-relaxed">
          <div className="space-y-1 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60">
            <div className="text-slate-200 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              1. 하버드 분리 버스 구조
            </div>
            <p>
              폰 노이만 아키텍처와 달리 플래시 프로그램 버스(16비트)와 데이터 SRAM 버스(8비트)가 물리적으로 완전히 분리되어 있어,
              ALU가 이전 명령어의 데이터를 SRAM이나 레지스터에 기록하는 바로 그 클럭에 동시에 다음 명령어를 플래시에서 인출(Fetch)할 수 있습니다.
            </p>
          </div>

          <div className="space-y-1 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60">
            <div className="text-slate-200 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              2. 32개 범용 레지스터 파일 (Fast ALU)
            </div>
            <p>
              32개의 범용 레지스터(R0~R31)는 2개의 읽기 포트와 1개의 쓰기 포트를 보유합니다.
              따라서 <code className="text-cyan-300">ADD R16, R17</code> 같은 명령어가 단 1사이클 내에 두 레지스터를 동시 읽고, ALU 덧셈을 수행하며,
              목적 레지스터에 기록(Writeback)까지 완료합니다.
            </p>
          </div>

          <div className="space-y-1 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60">
            <div className="text-slate-200 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              3. 분기 플러시 & 2워드 페널티
            </div>
            <p>
              조건 분기(<code className="text-rose-300">BREQ/BRNE</code>) 성립 시, 이미 프리페치되어 파이프라인에 진입한 순차 명령어가 무효화되어
              1사이클의 버블(Stall NOP)이 삽입됩니다. 32비트 명령어인 <code className="text-rose-300">LDS, STS, CALL</code> 역시 2번의 플래시 버스 인출이 필요하므로 2~4사이클이 소요됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
