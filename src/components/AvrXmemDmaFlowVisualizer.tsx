import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  HardDrive,
  Cpu,
  Layers,
  Zap,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  Info,
  Terminal,
  Play,
  Pause,
  Download,
  ShieldCheck,
  ShieldAlert,
  Radio,
  FileCode2,
  Clock,
  Sparkles,
  TrendingUp,
  ArrowRight,
  Maximize2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type DecodingScheme = 'full_138' | 'partial_a15' | 'bank_gpio';
export type SramSpeedGrade = 15 | 45 | 55 | 70; // in nanoseconds
export type WaitStateSector = 0 | 1 | 2 | 3;

export interface XmemPreset {
  id: string;
  name: string;
  tag: string;
  desc: string;
  decoding: DecodingScheme;
  sramCapacityKb: number;
  sramSpeedNs: SramSpeedGrade;
  sector0Wait: WaitStateSector;
  sector1Wait: WaitStateSector;
  sectorBoundary: '0x4000' | '0x8000' | 'none';
  xmmMask: 0 | 1 | 2 | 3; // 0=Release none (use A15:A8), 1=Release PC7, 2=Release PC7:6, 3=Release PC7:5
  dmaBlockBytes: number;
}

const XMEM_PRESETS: XmemPreset[] = [
  {
    id: 'mega640_fast_64k',
    name: 'ATmega640 고속 64KB SRAM 무대기 (Zero Wait State)',
    tag: '초고속 0-Wait',
    desc: 'IS62C256 45ns 고속 SRAM을 부분 디코딩(A15)하여 0 대기 사이클로 16MHz 최대 대역폭 달성',
    decoding: 'partial_a15',
    sramCapacityKb: 64,
    sramSpeedNs: 45,
    sector0Wait: 0,
    sector1Wait: 0,
    sectorBoundary: 'none',
    xmmMask: 0,
    dmaBlockBytes: 4096
  },
  {
    id: 'mega128_74hc138_multi',
    name: 'ATmega128 74HC138 8-Bank 다중 주변장치 디코딩',
    tag: '74HC138 8-Bank',
    desc: '3-to-8 디코더로 8KB 단위 8개 세그먼트를 분할하여 외부 SRAM, 메모리 맵 LCD, FIFO 동시 매핑',
    decoding: 'full_138',
    sramCapacityKb: 32,
    sramSpeedNs: 55,
    sector0Wait: 1,
    sector1Wait: 2,
    sectorBoundary: '0x8000',
    xmmMask: 0,
    dmaBlockBytes: 8192
  },
  {
    id: 'mega640_banked_512k',
    name: 'ATmega640 512KB 대용량 뱅크 스위칭 (Bank Switching)',
    tag: '512KB 대용량',
    desc: 'PORTL 하위 4비트를 뱅크 선택선으로 활용하여 32KB 윈도우를 16개 뱅크로 확장 스위칭',
    decoding: 'bank_gpio',
    sramCapacityKb: 512,
    sramSpeedNs: 70,
    sector0Wait: 2,
    sector1Wait: 2,
    sectorBoundary: 'none',
    xmmMask: 0,
    dmaBlockBytes: 16384
  }
];

export const AvrXmemDmaFlowVisualizer: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const hasHardwareXmem = selectedMCU === 'atmega640' || selectedMCU === 'atmega128';

  // State Configurations
  const [activePresetId, setActivePresetId] = useState<string>('mega640_fast_64k');
  const [decodingScheme, setDecodingScheme] = useState<DecodingScheme>('partial_a15');
  const [sramCapacityKb, setSramCapacityKb] = useState<number>(64);
  const [sramSpeedNs, setSramSpeedNs] = useState<SramSpeedGrade>(45);
  const [cpuClockMhz, setCpuClockMhz] = useState<number>(16);

  // Wait States in XMCRA
  const [sector0Wait, setSector0Wait] = useState<WaitStateSector>(0);
  const [sector1Wait, setSector1Wait] = useState<WaitStateSector>(0);
  const [sectorBoundary, setSectorBoundary] = useState<'0x4000' | '0x8000' | 'none'>('none');
  const [xmmMask, setXmmMask] = useState<0 | 1 | 2 | 3>(0);
  const [dmaBlockBytes, setDmaBlockBytes] = useState<number>(4096);

  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Apply Preset
  const handleApplyPreset = (p: XmemPreset) => {
    setActivePresetId(p.id);
    setDecodingScheme(p.decoding);
    setSramCapacityKb(p.sramCapacityKb);
    setSramSpeedNs(p.sramSpeedNs);
    setSector0Wait(p.sector0Wait);
    setSector1Wait(p.sector1Wait);
    setSectorBoundary(p.sectorBoundary);
    setXmmMask(p.xmmMask);
    setDmaBlockBytes(p.dmaBlockBytes);
  };

  // Hardware Timing & Bus Calculations
  const busTiming = useMemo(() => {
    const clockPeriodNs = 1000 / cpuClockMhz; // 16MHz -> 62.5ns

    // Wait cycles for active sector (assuming Sector 0)
    const waitCycles = sector0Wait;
    const totalBusCycles = 2 + waitCycles; // Base access is 2 clock cycles
    const totalCycleTimeNs = totalBusCycles * clockPeriodNs;

    // Propagation delay of 74HC573 Latch ~18ns, 74HC138 Decoder ~15ns
    const latchPropagationNs = 18;
    const decoderPropagationNs = decodingScheme === 'full_138' ? 15 : 6;
    const dataSetupRequirementNs = 10; // AVR data bus setup time

    // Available Access Window for SRAM:
    // t_acc_available = totalCycleTimeNs - (ALE latch delay) - (decoder delay) - (AVR input setup)
    const availableSramAccessTimeNs = Math.round(totalCycleTimeNs - latchPropagationNs - decoderPropagationNs - dataSetupRequirementNs);
    const accessMarginNs = availableSramAccessTimeNs - sramSpeedNs;
    const isTimingSafe = accessMarginNs >= 0;

    // DMA / Block Transfer Throughput calculation
    // CPU Normal Loop (LD + ST) = 4 clock cycles per byte
    const cpuLoopCyclesPerByte = 4;
    const cpuBandwidthMBs = (cpuClockMhz / cpuLoopCyclesPerByte).toFixed(2);
    const cpuBlockTimeUs = Math.round((dmaBlockBytes * cpuLoopCyclesPerByte * clockPeriodNs) / 1000);

    // Unrolled Burst Assembly Loop = ~2.2 clock cycles per byte
    const unrolledCyclesPerByte = 2.2;
    const unrolledBandwidthMBs = (cpuClockMhz / unrolledCyclesPerByte).toFixed(2);
    const unrolledBlockTimeUs = Math.round((dmaBlockBytes * unrolledCyclesPerByte * clockPeriodNs) / 1000);

    // Hardware Coprocessor / FIFO Direct DMA = 1 clock cycle per byte
    const dmaCyclesPerByte = 1.0;
    const dmaBandwidthMBs = (cpuClockMhz / dmaCyclesPerByte).toFixed(2);
    const dmaBlockTimeUs = Math.round((dmaBlockBytes * dmaCyclesPerByte * clockPeriodNs) / 1000);

    return {
      clockPeriodNs: Math.round(clockPeriodNs * 10) / 10,
      totalBusCycles,
      totalCycleTimeNs: Math.round(totalCycleTimeNs),
      availableSramAccessTimeNs,
      accessMarginNs,
      isTimingSafe,
      latchPropagationNs,
      decoderPropagationNs,
      cpuBandwidthMBs,
      cpuBlockTimeUs,
      unrolledBandwidthMBs,
      unrolledBlockTimeUs,
      dmaBandwidthMBs,
      dmaBlockTimeUs
    };
  }, [cpuClockMhz, sector0Wait, decodingScheme, sramSpeedNs, dmaBlockBytes]);

  // Registers & Addresses Mapping
  const xmemRegisters = useMemo(() => {
    // XMCRA: SRE(7)=1, SRL2:0(6:4), SRW11:10(3:2), SRW01:00(1:0)
    let srlBits = 0;
    if (sectorBoundary === '0x4000') srlBits = 0b001;
    else if (sectorBoundary === '0x8000') srlBits = 0b010;

    const xmcraVal = (1 << 7) | (srlBits << 4) | (sector1Wait << 2) | sector0Wait;

    // XMCRB: XMBK(7)=0, XMM2:0(2:0)
    const xmcrbVal = xmmMask & 0x07;

    // Internal SRAM & External Window Boundaries
    const internalSramEnd = selectedMCU === 'atmega640' ? 0x21ff : selectedMCU === 'atmega128' ? 0x10ff : 0x08ff;
    const externalWindowStart = internalSramEnd + 1;
    const externalWindowEnd = 0xffff;
    const externalLinearBytes = externalWindowEnd - externalWindowStart + 1;

    return {
      xmcraVal,
      xmcraHex: `0x${xmcraVal.toString(16).toUpperCase().padStart(2, '0')}`,
      xmcrbVal,
      xmcrbHex: `0x${xmcrbVal.toString(16).toUpperCase().padStart(2, '0')}`,
      internalSramEndHex: `0x${internalSramEnd.toString(16).toUpperCase()}`,
      externalWindowStartHex: `0x${externalWindowStart.toString(16).toUpperCase()}`,
      externalWindowEndHex: `0x${externalWindowEnd.toString(16).toUpperCase()}`,
      externalLinearBytes,
      externalLinearKb: (externalLinearBytes / 1024).toFixed(1)
    };
  }, [selectedMCU, sectorBoundary, sector1Wait, sector0Wait, xmmMask]);

  // C Source Code & Linker Script Generator
  const generatedCCode = useMemo(() => {
    return `/* =========================================================================
 * AVR XMEM (External Memory Interface) 및 DMA 블록 전송 펌웨어
 * Target MCU : ${currentProfile.name}
 * F_CPU      : ${cpuClockMhz}000000UL (${cpuClockMhz} MHz)
 * SRAM 사양  : ${sramCapacityKb}KB (${sramSpeedNs}ns) - ${decodingScheme}
 * XMCRA=${xmemRegisters.xmcraHex}, XMCRB=${xmemRegisters.xmcrbHex}
 * ========================================================================= */
#include <avr/io.h>
#include <stdlib.h>
#include <string.h>

// 1. 외부 SRAM 인터페이스 하드웨어 활성화 (XMCRA & XMCRB)
void xmem_init(void) {
    // XMCRA 설정 (SRE=1, 대기 상태 설정: Sector0=${sector0Wait} Wait, Sector1=${sector1Wait} Wait)
    XMCRA = ${xmemRegisters.xmcraHex};

    // XMCRB 설정 (상위 주소 핀 마스킹 XMM=${xmmMask})
    XMCRB = ${xmemRegisters.xmcrbHex};
}

// 2. 외부 SRAM 전용 힙 포인터 정의 (시작: ${xmemRegisters.externalWindowStartHex})
#define EXT_SRAM_START ((volatile uint8_t *)${xmemRegisters.externalWindowStartHex})
#define EXT_SRAM_SIZE  ${xmemRegisters.externalLinearBytes}UL

// 3. 초고속 언롤링(Unrolled Burst) 블록 전송 루틴 (${busTiming.unrolledBandwidthMBs} MB/s)
void xmem_fast_block_copy(volatile uint8_t *dest, const volatile uint8_t *src, uint16_t len) {
    uint16_t blocks = len / 8;
    uint8_t remainder = len % 8;

    while (blocks--) {
        *dest++ = *src++;
        *dest++ = *src++;
        *dest++ = *src++;
        *dest++ = *src++;
        *dest++ = *src++;
        *dest++ = *src++;
        *dest++ = *src++;
        *dest++ = *src++;
    }

    while (remainder--) {
        *dest++ = *src++;
    }
}

/* =========================================================================
 * avr-gcc 링커(Linker) 옵션 - 외부 SRAM으로 malloc() 힙 영역 자동 재배치
 * Makefile 또는 컴파일 옵션에 아래 플래그를 추가하십시오:
 * 
 * LDFLAGS += -Wl,--defsym=__heap_start=0x80${xmemRegisters.externalWindowStartHex.replace('0x', '')},\\
 *                --defsym=__heap_end=0x80FFFF
 * ========================================================================= */
`;
  }, [currentProfile.name, cpuClockMhz, sramCapacityKb, sramSpeedNs, decodingScheme, xmemRegisters, sector0Wait, sector1Wait, xmmMask, busTiming.unrolledBandwidthMBs]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.85 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadCode = () => {
    const blob = new Blob([generatedCCode], { type: 'text/x-csrc' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avr_xmem_init_${selectedMCU}.c`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-2">
            <HardDrive className="w-3.5 h-3.5" /> High-Density External SRAM Bus & DMA Flow
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            AVR 외부 메모리 인터페이스 (XMEM) 및 DMA 데이터 흐름 시각화기
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            ATmega640 및 ATmega128과 같은 대용량 모델에서 <span className="text-cyan-300 font-medium">외부 SRAM 확장(74HC573 래치)</span> 시 
            어드레스 디코딩 방식에 따른 <span className="text-amber-400 font-medium">ALE/RD/WR 버스 타이밍 다이어그램</span>과 
            <span className="text-emerald-400 font-medium"> DMA/버스트 데이터 전송 효율</span>을 시각적으로 분석합니다.
          </p>
        </div>

        {/* Target Info Badge */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1 self-start lg:self-center">
          <div className="flex items-center gap-2 text-slate-400">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>타깃 MCU:</span>
            <span className="text-white font-bold">{currentProfile.name}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            XMEM 하드웨어: {hasHardwareXmem ? (
              <span className="text-emerald-400 font-bold">지원 (PORTA/PORTC 버스)</span>
            ) : (
              <span className="text-amber-400 font-bold">미지원 (비교 시뮬레이션 모드)</span>
            )}
          </div>
        </div>
      </div>

      {/* Non-XMEM MCU Warning (e.g. ATmega328P) */}
      {!hasHardwareXmem && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-300 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-sm text-amber-200">
              현재 선택된 {currentProfile.name}는 하드웨어 XMEM 인터페이스가 내장되어 있지 않습니다.
            </div>
            <p className="text-slate-300 leading-relaxed">
              ATmega328P와 같은 28/32핀 모델은 주소/데이터 다중화 버스(PORTA/PORTC)가 없으므로 SPI 직렬 SRAM(23LC1024)을 사용해야 합니다. 
              하드웨어 병렬 XMEM 64KB 확장을 시연하려면 상단 MCU 선택기에서 <strong>ATmega640</strong> 또는 <strong>ATmega128</strong>을 선택하십시오.
            </p>
          </div>
        </div>
      )}

      {/* Preset Banner */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            검증된 XMEM 외부 SRAM 확장 프리셋
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {XMEM_PRESETS.map((p) => {
            const isSelected = activePresetId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleApplyPreset(p)}
                className={`text-left p-2.5 rounded-lg border transition-all text-xs flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-500/50 ring-1 ring-cyan-500/40'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-semibold text-white truncate">{p.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {p.tag}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-1">{p.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Control Panel: Parameters Inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Col 1: Decoding Scheme & SRAM Capacity */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" /> 어드레스 디코딩 & SRAM 사양
          </h3>

          <div>
            <label className="text-xs text-slate-400 block mb-1">어드레스 디코딩 방식</label>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              <button
                onClick={() => setDecodingScheme('partial_a15')}
                className={`p-2 rounded-lg border transition-all font-semibold text-center ${
                  decodingScheme === 'partial_a15'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                부분 디코딩 (A15)
              </button>
              <button
                onClick={() => setDecodingScheme('full_138')}
                className={`p-2 rounded-lg border transition-all font-semibold text-center ${
                  decodingScheme === 'full_138'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                74HC138 (8-Bank)
              </button>
              <button
                onClick={() => setDecodingScheme('bank_gpio')}
                className={`p-2 rounded-lg border transition-all font-semibold text-center ${
                  decodingScheme === 'bank_gpio'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                GPIO 뱅킹 (512K)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">SRAM 속도 등급 (t_acc)</label>
              <select
                value={sramSpeedNs}
                onChange={(e) => setSramSpeedNs(parseInt(e.target.value) as SramSpeedGrade)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
              >
                <option value={15}>15 ns (초고속 IS61)</option>
                <option value={45}>45 ns (IS62C256)</option>
                <option value={55}>55 ns (표준 저전력)</option>
                <option value={70}>70 ns (AS6C62256)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">클럭 주파수 (F_CPU)</label>
              <select
                value={cpuClockMhz}
                onChange={(e) => setCpuClockMhz(parseInt(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
              >
                <option value={8}>8 MHz (125ns)</option>
                <option value={12}>12 MHz (83ns)</option>
                <option value={16}>16 MHz (62.5ns)</option>
                <option value={20}>20 MHz (50ns)</option>
              </select>
            </div>
          </div>

          {/* Timing Margin Result Box */}
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>SRAM 가용 액세스 윈도우:</span>
              <span className="font-mono text-white font-bold">{busTiming.availableSramAccessTimeNs} ns</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>타이밍 여유 마진 (Margin):</span>
              <span
                className={`font-mono font-bold ${
                  busTiming.isTimingSafe ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {busTiming.accessMarginNs} ns ({busTiming.isTimingSafe ? 'PASS (정상 작동)' : 'FAIL (대기 사이클 증가 필요!)'})
              </span>
            </div>
          </div>
        </div>

        {/* Col 2: Wait States in XMCRA */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" /> XMCRA 대기 사이클 (Wait State)
          </h3>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>하위 섹터(Sector 0) 대기 사이클</span>
              <span className="text-amber-400 font-mono font-bold">{sector0Wait} Wait ({2 + sector0Wait} Clocks)</span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-xs">
              {([0, 1, 2, 3] as WaitStateSector[]).map((w) => (
                <button
                  key={w}
                  onClick={() => setSector0Wait(w)}
                  className={`py-1.5 rounded border transition-all font-semibold ${
                    sector0Wait === w
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  +{w} Clks
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>상위 섹터(Sector 1) 대기 사이클</span>
              <span className="text-amber-400 font-mono font-bold">{sector1Wait} Wait ({2 + sector1Wait} Clocks)</span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-xs">
              {([0, 1, 2, 3] as WaitStateSector[]).map((w) => (
                <button
                  key={w}
                  onClick={() => setSector1Wait(w)}
                  className={`py-1.5 rounded border transition-all font-semibold ${
                    sector1Wait === w
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  +{w} Clks
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>XMCRA 레지스터 값:</span>
              <span className="font-mono text-cyan-400 font-bold">{xmemRegisters.xmcraHex}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>XMCRB 레지스터 값:</span>
              <span className="font-mono text-cyan-300 font-bold">{xmemRegisters.xmcrbHex}</span>
            </div>
          </div>
        </div>

        {/* Col 3: DMA & Burst Flow Simulation */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" /> DMA & 블록 전송 효율 분석
          </h3>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>전송 블록 버퍼 크기</span>
              <span className="text-emerald-400 font-mono font-bold">{(dmaBlockBytes / 1024).toFixed(1)} KB</span>
            </div>
            <input
              type="range"
              min={1024}
              max={32768}
              step={1024}
              value={dmaBlockBytes}
              onChange={(e) => setDmaBlockBytes(parseInt(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          {/* Transfer Comparison Cards */}
          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-slate-300 font-medium block">표준 CPU 루프 (LD+ST)</span>
                <span className="text-[10px] text-slate-500">4사이클/바이트 (25% 효율)</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-white font-bold block">{busTiming.cpuBandwidthMBs} MB/s</span>
                <span className="text-[10px] text-slate-400">{busTiming.cpuBlockTimeUs} µs</span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-cyan-300 font-medium block">언롤링 버스트 ASM 루프</span>
                <span className="text-[10px] text-slate-500">2.2사이클/바이트 (45% 효율)</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-cyan-400 font-bold block">{busTiming.unrolledBandwidthMBs} MB/s</span>
                <span className="text-[10px] text-cyan-300">{busTiming.unrolledBlockTimeUs} µs</span>
              </div>
            </div>

            <div className="p-2.5 bg-emerald-950/30 rounded-lg border border-emerald-500/40 flex justify-between items-center">
              <div>
                <span className="text-emerald-300 font-bold block">FIFO 코프로세서 Direct DMA</span>
                <span className="text-[10px] text-emerald-400">1사이클/바이트 (100% 버스 대역)</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-emerald-400 font-bold block">{busTiming.dmaBandwidthMBs} MB/s</span>
                <span className="text-[10px] text-emerald-300">{busTiming.dmaBlockTimeUs} µs</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timing Chart & Address Map Visualizer */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              XMEM 하드웨어 버스 사이클 타이밍 차트 (ALE / AD[7:0] / RD / WR)
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            1 사이클 = {busTiming.clockPeriodNs} ns (총 {busTiming.totalCycleTimeNs} ns)
          </span>
        </div>

        {/* SVG Timing Diagram */}
        <div className="w-full overflow-x-auto bg-slate-950/90 border border-slate-800/90 rounded-xl p-3 scrollbar-thin scrollbar-thumb-slate-700">
          <div className="min-w-[800px]">
            <svg viewBox="0 0 800 210" className="w-full h-52">
              {/* Grid Lines for Cycles */}
              {Array.from({ length: busTiming.totalBusCycles + 1 }).map((_, i) => {
                const x = 70 + i * (600 / busTiming.totalBusCycles);
                return (
                  <g key={`grid_${i}`}>
                    <line x1={x} y1={15} x2={x} y2={185} stroke="#1e293b" strokeDasharray="3,3" strokeWidth="1" />
                    <text x={x} y={198} fill="#64748b" fontSize="9" textAnchor="middle">
                      {i === 0 ? 'T0' : `Cycle ${i}`}
                    </text>
                  </g>
                );
              })}

              {/* Line Labels */}
              <text x="15" y="45" fill="#38bdf8" fontSize="10" fontWeight="bold">CLK</text>
              <text x="15" y="80" fill="#f59e0b" fontSize="10" fontWeight="bold">ALE</text>
              <text x="15" y="115" fill="#34d399" fontSize="10" fontWeight="bold">AD[7:0]</text>
              <text x="15" y="155" fill="#f43f5e" fontSize="10" fontWeight="bold">/RD, /WR</text>

              {/* 1. CLK Waveform */}
              {Array.from({ length: busTiming.totalBusCycles }).map((_, i) => {
                const cycleW = 600 / busTiming.totalBusCycles;
                const x = 70 + i * cycleW;
                const midX = x + cycleW / 2;
                const nextX = x + cycleW;
                return (
                  <path
                    key={`clk_${i}`}
                    d={`M ${x} 50 L ${x} 35 L ${midX} 35 L ${midX} 50 L ${nextX} 50`}
                    stroke="#38bdf8"
                    strokeWidth="2"
                    fill="none"
                  />
                );
              })}

              {/* 2. ALE Waveform (High during Cycle 1, then Low) */}
              {(() => {
                const cycleW = 600 / busTiming.totalBusCycles;
                const startX = 70;
                const endX = 70 + cycleW * busTiming.totalBusCycles;
                const c1Mid = startX + cycleW * 0.75;
                const c1End = startX + cycleW;
                return (
                  <path
                    d={`M ${startX} 70 L ${startX + 5} 65 L ${c1Mid} 65 L ${c1Mid + 10} 85 L ${endX} 85`}
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    fill="none"
                  />
                );
              })()}

              {/* 3. Multiplexed AD[7:0] (Address phase in Cycle 1 -> Tri-state -> Data phase) */}
              {(() => {
                const cycleW = 600 / busTiming.totalBusCycles;
                const startX = 70;
                const c1End = startX + cycleW;
                const endX = startX + cycleW * busTiming.totalBusCycles;

                return (
                  <g>
                    {/* Address Box in Cycle 1 */}
                    <rect x={startX + 5} y={105} width={cycleW - 10} height={18} fill="#10b981" fillOpacity="0.2" stroke="#10b981" strokeWidth="1.5" rx="3" />
                    <text x={startX + cycleW / 2} y={118} fill="#10b981" fontSize="9" fontWeight="bold" textAnchor="middle">
                      Low Address A[7:0]
                    </text>

                    {/* Data Box in Cycle 2..N */}
                    <rect x={c1End + 10} y={105} width={(endX - c1End) - 15} height={18} fill="#3b82f6" fillOpacity="0.2" stroke="#3b82f6" strokeWidth="1.5" rx="3" />
                    <text x={c1End + (endX - c1End) / 2} y={118} fill="#60a5fa" fontSize="9" fontWeight="bold" textAnchor="middle">
                      Data Phase D[7:0] ({sector0Wait > 0 ? `${sector0Wait} Wait 연장` : '2 사이클'})
                    </text>
                  </g>
                );
              })()}

              {/* 4. /RD & /WR Strobe (Active LOW during Data Phase) */}
              {(() => {
                const cycleW = 600 / busTiming.totalBusCycles;
                const startX = 70;
                const c1End = startX + cycleW;
                const endX = startX + cycleW * busTiming.totalBusCycles;

                return (
                  <path
                    d={`M ${startX} 145 L ${c1End + 5} 145 L ${c1End + 10} 165 L ${endX - 10} 165 L ${endX - 5} 145`}
                    stroke="#f43f5e"
                    strokeWidth="2.5"
                    fill="none"
                  />
                );
              })()}
            </svg>
          </div>
        </div>

        {/* Address Map Linear Bar */}
        <div className="space-y-1.5 pt-2">
          <div className="text-xs font-semibold text-slate-300 flex justify-between">
            <span>선형 주소 맵 (Linear Memory Address Space)</span>
            <span className="text-cyan-400 font-mono">가용 외부 SRAM: {xmemRegisters.externalLinearKb} KB</span>
          </div>

          <div className="h-6 w-full bg-slate-900 rounded-lg overflow-hidden flex border border-slate-800 text-[10px] font-bold">
            <div style={{ width: '12%' }} className="bg-slate-700 text-slate-300 flex items-center justify-center truncate px-1">
              I/O 레지스터
            </div>
            <div style={{ width: '18%' }} className="bg-amber-600 text-white flex items-center justify-center truncate px-1">
              내부 SRAM ({xmemRegisters.internalSramEndHex})
            </div>
            <div style={{ width: '70%' }} className="bg-cyan-600 text-white flex items-center justify-center truncate px-1">
              외부 확장 SRAM 윈도우 ({xmemRegisters.externalWindowStartHex} ~ 0xFFFF)
            </div>
          </div>
        </div>
      </div>

      {/* Embedded C Code Generator */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                자동 생성된 AVR C 및 Linker Script (외부 SRAM 힙 재배치)
              </h3>
              <p className="text-xs text-slate-400">
                XMCRA/XMCRB 초기화와 avr-gcc malloc() 힙 재배치 링커 플래그 완비
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-all flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? '복사 완료!' : 'C 코드 복사'}
            </button>
            <button
              onClick={handleDownloadCode}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> .c 파일 다운로드
            </button>
          </div>
        </div>

        <pre className="p-4 bg-slate-900/90 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[320px] scrollbar-thin scrollbar-thumb-slate-700">
          <code>{generatedCCode}</code>
        </pre>
      </div>
    </div>
  );
};
