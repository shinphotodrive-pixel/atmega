import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Zap,
  Cpu,
  Layers,
  ArrowRight,
  Sliders,
  Copy,
  Check,
  Activity,
  AlertTriangle,
  Info,
  Clock,
  Terminal,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  GitCommit,
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type DmaChannel = 'CH0' | 'CH1' | 'CH2' | 'CH3';
export type AddressMode = 'fixed' | 'increment' | 'decrement' | 'reload';
export type TriggerCondition = 'software' | 'usart_rx' | 'usart_tx' | 'spi_complete' | 'adc_ready' | 'timer_match' | 'ext_int';

export const DmaTransferConfigGuide: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // DMA Configuration Parameters
  const [selectedChannel, setSelectedChannel] = useState<DmaChannel>('CH0');
  const [transferBlockSize, setTransferBlockSize] = useState<number>(64); // 1 ~ 65535 bytes
  const [burstSize, setBurstSize] = useState<1 | 2 | 4 | 8>(1); // 1, 2, 4, 8 bytes per bus arbitrated burst
  const [srcAddrMode, setSrcAddrMode] = useState<AddressMode>('increment');
  const [dstAddrMode, setDstAddrMode] = useState<AddressMode>('fixed');
  const [triggerSource, setTriggerSource] = useState<TriggerCondition>('usart_rx');
  const [srcMemoryType, setSrcMemoryType] = useState<'sram' | 'flash' | 'peripheral'>('sram');
  const [dstMemoryType, setDstMemoryType] = useState<'sram' | 'flash' | 'peripheral'>('peripheral');
  const [priorityLevel, setPriorityLevel] = useState<'low' | 'medium' | 'high' | 'very_high'>('high');
  const [enableInterruptOnComplete, setEnableInterruptOnComplete] = useState<boolean>(true);
  const [enableInterruptOnError, setEnableInterruptOnError] = useState<boolean>(true);
  const [clockFrequencyMhz, setClockFrequencyMhz] = useState<number>(16); // 16 MHz

  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Address mode bit encoding (2 bits: 00: Fixed, 01: Increment, 10: Decrement, 11: Block Reload)
  const addrModeBits = (mode: AddressMode): number => {
    switch (mode) {
      case 'fixed': return 0b00;
      case 'increment': return 0b01;
      case 'decrement': return 0b10;
      case 'reload': return 0b11;
    }
  };

  // Trigger Condition Code (4 bits)
  const triggerCode = (trig: TriggerCondition): { code: number; label: string; desc: string } => {
    switch (trig) {
      case 'software': return { code: 0x00, label: 'Manual SW Trigger', desc: '소프트웨어 플래그(DMAC_REQ) 세팅 즉시 전송 개시' };
      case 'usart_rx': return { code: 0x01, label: 'USARTn_RXC Event', desc: '수신 버퍼 데이터 수신 완료 시마다 1바이트씩 DMA 이동' };
      case 'usart_tx': return { code: 0x02, label: 'USARTn_DRE Event', desc: '송신 데이터 레지스터 비어있을 시 자동 버퍼 공급' };
      case 'spi_complete': return { code: 0x03, label: 'SPI_STC Event', desc: 'SPI 직렬 전송 완료 시 자동 연속 데이터 공급' };
      case 'adc_ready': return { code: 0x04, label: 'ADC_CONV_DONE Event', desc: '아날로그 변환 완료 즉시 SRAM 링버퍼로 자동 DMA 복사' };
      case 'timer_match': return { code: 0x05, label: 'TIMER_COMP Event', desc: '타이머 비교 일치 주기마다 정밀 샘플링 DMA 전송' };
      case 'ext_int': return { code: 0x06, label: 'EXT_INT0 Event', desc: '외부 인터럽트 핀 하강 에지 신호에 의해 비동기 개시' };
    }
  };

  // Priority code (2 bits)
  const priorityBits = (pri: 'low' | 'medium' | 'high' | 'very_high'): number => {
    switch (pri) {
      case 'low': return 0b00;
      case 'medium': return 0b01;
      case 'high': return 0b10;
      case 'very_high': return 0b11;
    }
  };

  // Burst size bits (2 bits)
  const burstBits = (b: 1 | 2 | 4 | 8): number => {
    switch (b) {
      case 1: return 0b00;
      case 2: return 0b01;
      case 4: return 0b10;
      case 8: return 0b11;
    }
  };

  // Calculate Register Values & Bitmasks
  const calculatedRegisters = useMemo(() => {
    // 1. DMA Channel Control Register A (DMAC_CTRLA): [7: ENABLE, 6: RESET, 5: REPEAT, 4: BURST_EN, 3-2: PRIORITY, 1-0: RESERVED]
    let ctrla = 0x80; // ENABLE = 1
    ctrla |= (priorityBits(priorityLevel) << 2);
    if (burstSize > 1) {
      ctrla |= 0x10; // BURST_EN
    }

    // 2. DMA Channel Control Register B (DMAC_CTRLB): [7-6: SRC_DIR, 5-4: DST_DIR, 3-2: BURST_LEN, 1: INT_ERR, 0: INT_TC]
    let ctrlb = 0x00;
    ctrlb |= (addrModeBits(srcAddrMode) << 6);
    ctrlb |= (addrModeBits(dstAddrMode) << 4);
    ctrlb |= (burstBits(burstSize) << 2);
    if (enableInterruptOnError) ctrlb |= 0x02; // ERR_IE
    if (enableInterruptOnComplete) ctrlb |= 0x01; // TC_IE (Transfer Complete Interrupt Enable)

    // 3. DMA Channel Trigger Selection Register (DMAC_TRIG): [7: SW_TRIG, 6-4: RESERVED, 3-0: TRIG_SRC]
    const trig = triggerCode(triggerSource);
    const trigReg = trig.code & 0x0F;

    // 4. Transfer Count Register (DMAC_CNT): 16-bit
    const cntReg = transferBlockSize & 0xFFFF;

    return {
      ctrlA: ctrla,
      ctrlB: ctrlb,
      trigReg,
      cntReg,
      trigInfo: trig
    };
  }, [
    priorityLevel,
    burstSize,
    srcAddrMode,
    dstAddrMode,
    enableInterruptOnError,
    enableInterruptOnComplete,
    triggerSource,
    transferBlockSize
  ]);

  // Timing & Cycle Calculation Engine
  // For DMA transfer:
  // Bus arbitration overhead: 2 cycles per burst
  // Read phase: 1 cycle (SRAM), 2 cycles (Flash/Perip)
  // Write phase: 1 cycle (SRAM), 2 cycles (Peripheral IO bus)
  // Total cycles = Number of bursts * (Bus Arbitration + BurstSize * (ReadCycles + WriteCycles))
  const timing = useMemo(() => {
    const readCyclesPerByte = srcMemoryType === 'flash' ? 2 : (srcMemoryType === 'peripheral' ? 2 : 1);
    const writeCyclesPerByte = dstMemoryType === 'peripheral' ? 2 : (dstMemoryType === 'sram' ? 1 : 2);
    const singleTransferCycle = readCyclesPerByte + writeCyclesPerByte;

    const burstCycles = 2 + (burstSize * singleTransferCycle);
    const totalBursts = Math.ceil(transferBlockSize / burstSize);
    const totalDmaCycles = totalBursts * burstCycles;

    // CPU Interrupt Latency Comparison (Conventional ISR approach):
    // If done via CPU ISR: Entry(4) + Push(12) + LDS/STS(4) + Pop(12) + RETI(4) = ~36 cycles per byte!
    const isrCyclesPerByte = 36;
    const totalCpuIsrCycles = transferBlockSize * isrCyclesPerByte;

    // Elapsed Time in Microseconds:
    const dmaElapsedUs = (totalDmaCycles / clockFrequencyMhz);
    const isrElapsedUs = (totalCpuIsrCycles / clockFrequencyMhz);

    // CPU Bandwidth Savings %:
    const cpuOffloadPercent = Math.min(99, Math.round(((totalCpuIsrCycles - totalDmaCycles) / totalCpuIsrCycles) * 100));

    return {
      totalDmaCycles,
      totalCpuIsrCycles,
      dmaElapsedUs: parseFloat(dmaElapsedUs.toFixed(2)),
      isrElapsedUs: parseFloat(isrElapsedUs.toFixed(2)),
      cpuOffloadPercent,
      speedupFactor: parseFloat((totalCpuIsrCycles / totalDmaCycles).toFixed(1))
    };
  }, [transferBlockSize, burstSize, srcMemoryType, dstMemoryType, clockFrequencyMhz]);

  // Code Generation for C Bare-metal initialization
  const generatedCSource = useMemo(() => {
    return `// ==============================================================================
// DMAC (Direct Memory Access Controller) Driver for ${currentProfile.name}
// Source Address Mode : ${srcAddrMode.toUpperCase()} (${srcMemoryType})
// Destination Mode    : ${dstAddrMode.toUpperCase()} (${dstMemoryType})
// Transfer Block Size : ${transferBlockSize} bytes | Trigger: ${calculatedRegisters.trigInfo.label}
// ==============================================================================
#include <avr/io.h>
#include <avr/interrupt.h>

void dma_${selectedChannel.toLowerCase()}_init(void *src_addr, void *dst_addr) {
    // 1. DMA 채널 소프트웨어 리셋 및 안전 비활성화
    DMAC_CH_CTRLA(${selectedChannel}) = 0x00;

    // 2. 소스/목적지 16비트 포인터 주소 로드
    DMAC_CH_SRCADDR(${selectedChannel}) = (uint16_t)src_addr;
    DMAC_CH_DSTADDR(${selectedChannel}) = (uint16_t)dst_addr;

    // 3. 16비트 전송 블록 크기 지정 (${transferBlockSize} Bytes)
    DMAC_CH_CNT(${selectedChannel})     = 0x${calculatedRegisters.cntReg.toString(16).padStart(4, '0').toUpperCase()}; // ${transferBlockSize}

    // 4. 주소 증감 모드, 버스트 길이, 인터럽트 마스크 설정
    // SRC_DIR=${addrModeBits(srcAddrMode)}, DST_DIR=${addrModeBits(dstAddrMode)}, BURST=${burstSize}B
    DMAC_CH_CTRLB(${selectedChannel}) = 0x${calculatedRegisters.ctrlB.toString(16).padStart(2, '0').toUpperCase()};

    // 5. 하드웨어 주변장치 트리거 이벤트 소스 라우팅 (${calculatedRegisters.trigInfo.label})
    DMAC_CH_TRIG(${selectedChannel})  = 0x${calculatedRegisters.trigReg.toString(16).padStart(2, '0').toUpperCase()};

    // 6. 채널 우선순위 지정 및 DMA 엔진 활성화
    DMAC_CH_CTRLA(${selectedChannel}) = 0x${calculatedRegisters.ctrlA.toString(16).padStart(2, '0').toUpperCase()};
}

${enableInterruptOnComplete ? `// 전송 완료(Transfer Complete) 인터럽트 서비스 루틴
ISR(DMAC_${selectedChannel}_TC_vect) {
    // DMAC 인터럽트 플래그 클리어
    DMAC_CH_INTFLAGS(${selectedChannel}) = 0x01;
    // 사용자 전송 완료 처리 콜백 호출
}` : ''}
`;
  }, [
    currentProfile.name,
    selectedChannel,
    srcAddrMode,
    srcMemoryType,
    dstAddrMode,
    dstMemoryType,
    transferBlockSize,
    calculatedRegisters,
    burstSize,
    enableInterruptOnComplete
  ]);

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCSource);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.3 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Title Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" /> DMA Transfer Config Guide
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              Target: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-mono">
              Zero CPU Overhead
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            DMA (Direct Memory Access) 전송 설정 및 사이클 분석 가이드
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            데이터 전송 크기, 소스/목적지 주소 모드(증가/고정/재로드), 인터럽트 트리거 조건을 입력하면
            필요한 <strong>DMAC 컨트롤러 레지스터 비트마스크(CTRLA, CTRLB, TRIG, CNT)</strong>를 자동 연산하고,
            기존 CPU 인터럽트 루프 대비 <strong>하드웨어 전송 소요 클럭 사이클과 CPU 부하 절감율</strong>을 실시간 시각화합니다.
          </p>
        </div>

        {/* Copy Button */}
        <button
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-cyan-500/20 shrink-0"
        >
          {copiedCode ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
          <span>{copiedCode ? 'C 드라이버 복사 완료' : 'DMAC 초기화 C 코드 복사'}</span>
        </button>
      </div>

      {/* Hero Comparative Benchmark Card: DMA vs CPU ISR */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 border border-cyan-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>DMA 하드웨어 전송 vs CPU 수동 ISR 복사 성능 대조</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {timing.speedupFactor}x Throughput
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {transferBlockSize}바이트 전송 시 CPU 코어 인터럽트 점유율 배제 및 버스 사이클 비교
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">CPU 부하 절감(Offload):</span>
            <span className="text-emerald-400 font-bold">+{timing.cpuOffloadPercent}% 여유 확보</span>
          </div>
        </div>

        {/* 2 Big Cycle Comparison Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* DMA Method */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-cyan-500/30 space-y-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                <Zap className="w-4 h-4" /> DMAC 하드웨어 엔진 직접 전송:
              </span>
              <span className="text-white font-bold text-sm">
                {timing.totalDmaCycles.toLocaleString()} 사이클 ({timing.dmaElapsedUs} µs)
              </span>
            </div>

            <div className="h-3.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative flex">
              <div
                className="bg-cyan-500 transition-all duration-700"
                style={{ width: `${Math.min(100, (timing.totalDmaCycles / timing.totalCpuIsrCycles) * 100)}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
              <span>{clockFrequencyMhz}MHz 시스템 클럭 기준</span>
              <span className="text-emerald-400 font-bold">
                CPU 코어 0% 개입 (백그라운드 전송)
              </span>
            </div>
          </div>

          {/* Conventional CPU ISR Method */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-rose-400" /> CPU 소프트웨어 ISR 루프 복사:
              </span>
              <span className="text-rose-400 font-bold text-sm">
                {timing.totalCpuIsrCycles.toLocaleString()} 사이클 ({timing.isrElapsedUs} µs)
              </span>
            </div>

            <div className="h-3.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative flex">
              <div
                className="bg-rose-500/80 transition-all duration-700 w-full"
              />
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
              <span>ISR 진입/복귀 및 레지스터 Push/Pop 오버헤드</span>
              <span className="text-rose-400 font-bold">
                CPU 대역폭 약 {timing.isrElapsedUs}µs 잠식
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Parameters Form (Left) & Registers/Bitmasks Display (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Transfer Configuration Parameters (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">전송 및 버스 파라미터 입력</h3>
          </div>

          {/* Channel Selector */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">DMAC 채널 선택</label>
            <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
              {(['CH0', 'CH1', 'CH2', 'CH3'] as DmaChannel[]).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setSelectedChannel(ch)}
                  className={`py-1.5 rounded-lg border font-bold transition text-center ${
                    selectedChannel === ch
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {/* Transfer Block Size */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1 font-medium">
              <span className="text-slate-400">데이터 블록 전송 크기:</span>
              <span className="text-cyan-400 font-bold font-mono">{transferBlockSize} Bytes</span>
            </div>
            <input
              type="range"
              min="1"
              max="1024"
              value={transferBlockSize}
              onChange={(e) => setTransferBlockSize(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
            />
            <div className="flex gap-1.5 mt-1.5 text-[10px] font-mono">
              {[16, 64, 128, 256, 512, 1024].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setTransferBlockSize(size)}
                  className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                >
                  {size}B
                </button>
              ))}
            </div>
          </div>

          {/* Source Address Mode & Memory Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-medium">소스(SRC) 주소 모드</label>
              <select
                value={srcAddrMode}
                onChange={(e) => setSrcAddrMode(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
              >
                <option value="increment">자동 증가 (+1 Inc)</option>
                <option value="fixed">고정 (Fixed I/O)</option>
                <option value="decrement">자동 감소 (-1 Dec)</option>
                <option value="reload">블록 재로드 (Reload)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1 font-medium">소스 메모리 영역</label>
              <select
                value={srcMemoryType}
                onChange={(e) => setSrcMemoryType(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
              >
                <option value="sram">SRAM 버퍼 (1-cycle)</option>
                <option value="flash">Flash ROM (2-cycle)</option>
                <option value="peripheral">주변장치 I/O (2-cycle)</option>
              </select>
            </div>
          </div>

          {/* Destination Address Mode & Memory Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-medium">목적지(DST) 주소 모드</label>
              <select
                value={dstAddrMode}
                onChange={(e) => setDstAddrMode(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
              >
                <option value="fixed">고정 (Fixed Periph)</option>
                <option value="increment">자동 증가 (+1 Inc)</option>
                <option value="decrement">자동 감소 (-1 Dec)</option>
                <option value="reload">블록 재로드 (Reload)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1 font-medium">목적지 메모리 영역</label>
              <select
                value={dstMemoryType}
                onChange={(e) => setDstMemoryType(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
              >
                <option value="peripheral">주변장치 TX 버퍼</option>
                <option value="sram">SRAM 링버퍼</option>
                <option value="flash">Flash (SPM 전용)</option>
              </select>
            </div>
          </div>

          {/* Trigger Source */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">인터럽트 트리거 조건 (Trigger Event)</label>
            <select
              value={triggerSource}
              onChange={(e) => setTriggerSource(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
            >
              <option value="usart_rx">USART_RXC (수신 바이트 도착 시)</option>
              <option value="usart_tx">USART_DRE (송신 버퍼 준비 시)</option>
              <option value="spi_complete">SPI_STC (SPI 전송 완료 시)</option>
              <option value="adc_ready">ADC_READY (ADC 변환 완료 즉시)</option>
              <option value="timer_match">TIMER_COMP (타이머 주기 트리거)</option>
              <option value="software">SOFTWARE (소프트웨어 수동 개시)</option>
              <option value="ext_int">EXT_INT0 (외부 핀 하강 에지)</option>
            </select>
            <span className="text-[10px] text-slate-500 mt-1 block">
              {calculatedRegisters.trigInfo.desc}
            </span>
          </div>

          {/* Burst Size & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-medium">버스 중재 버스트 길이</label>
              <div className="grid grid-cols-4 gap-1 text-xs font-mono">
                {([1, 2, 4, 8] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBurstSize(b)}
                    className={`py-1 rounded-lg border font-bold text-center ${
                      burstSize === b
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'
                    }`}
                  >
                    {b}B
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1 font-medium">채널 우선순위 (Priority)</label>
              <select
                value={priorityLevel}
                onChange={(e) => setPriorityLevel(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
              >
                <option value="low">Low (우선순위 낮음)</option>
                <option value="medium">Medium (중간)</option>
                <option value="high">High (높음 - 권장)</option>
                <option value="very_high">Very High (최우선)</option>
              </select>
            </div>
          </div>

          {/* Interrupt Flags Checkboxes */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enableInterruptOnComplete}
                onChange={(e) => setEnableInterruptOnComplete(e.target.checked)}
                className="accent-cyan-500 rounded"
              />
              <span>전송 완료(TC_IE) 인터럽트 벡터 활성화</span>
            </label>
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enableInterruptOnError}
                onChange={(e) => setEnableInterruptOnError(e.target.checked)}
                className="accent-cyan-500 rounded"
              />
              <span>버스 충돌/오류(ERR_IE) 인터럽트 활성화</span>
            </label>
          </div>
        </div>

        {/* Right Column: Calculated DMAC Registers & Bitmask Inspector (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">연산된 DMAC 레지스터 비트마스크 명세</h3>
              </div>
              <span className="text-[11px] font-mono text-cyan-300 font-bold">
                Channel: {selectedChannel}
              </span>
            </div>

            {/* Register Cards Grid */}
            <div className="space-y-3 font-mono text-xs">
              {/* CTRLA */}
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-bold">
                    DMAC_{selectedChannel}_CTRLA (제어 및 우선순위):
                  </span>
                  <span className="text-cyan-400 font-bold text-sm">
                    0x{calculatedRegisters.ctrlA.toString(16).padStart(2, '0').toUpperCase()}
                    <span className="text-slate-500 text-xs ml-1.5 font-normal">
                      (0b{calculatedRegisters.ctrlA.toString(2).padStart(8, '0')})
                    </span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex flex-wrap gap-2 pt-1 border-t border-slate-800/60 font-sans">
                  <span>• ENABLE: <strong className="text-emerald-400">1 (On)</strong></span>
                  <span>• PRIORITY: <strong className="text-cyan-400">{priorityLevel.toUpperCase()}</strong></span>
                  <span>• BURST_EN: <strong className="text-amber-400">{burstSize > 1 ? '1' : '0'}</strong></span>
                </div>
              </div>

              {/* CTRLB */}
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-bold">
                    DMAC_{selectedChannel}_CTRLB (주소 모드 & 인터럽트):
                  </span>
                  <span className="text-cyan-400 font-bold text-sm">
                    0x{calculatedRegisters.ctrlB.toString(16).padStart(2, '0').toUpperCase()}
                    <span className="text-slate-500 text-xs ml-1.5 font-normal">
                      (0b{calculatedRegisters.ctrlB.toString(2).padStart(8, '0')})
                    </span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex flex-wrap gap-2 pt-1 border-t border-slate-800/60 font-sans">
                  <span>• SRC_DIR: <strong className="text-cyan-300">{srcAddrMode}</strong></span>
                  <span>• DST_DIR: <strong className="text-cyan-300">{dstAddrMode}</strong></span>
                  <span>• TC_IE: <strong className="text-emerald-400">{enableInterruptOnComplete ? '1' : '0'}</strong></span>
                  <span>• ERR_IE: <strong className="text-rose-400">{enableInterruptOnError ? '1' : '0'}</strong></span>
                </div>
              </div>

              {/* TRIG */}
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-bold">
                    DMAC_{selectedChannel}_TRIG (트리거 이벤트 라우터):
                  </span>
                  <span className="text-amber-400 font-bold text-sm">
                    0x{calculatedRegisters.trigReg.toString(16).padStart(2, '0').toUpperCase()}
                    <span className="text-slate-500 text-xs ml-1.5 font-normal">
                      (Code: {calculatedRegisters.trigReg})
                    </span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 font-sans">
                  <span>• 연결된 주변장치 이벤트: <strong className="text-white">{calculatedRegisters.trigInfo.label}</strong></span>
                </div>
              </div>

              {/* CNT */}
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-bold">
                    DMAC_{selectedChannel}_CNT (전송 바이트 카운터):
                  </span>
                  <span className="text-emerald-400 font-bold text-sm">
                    0x{calculatedRegisters.cntReg.toString(16).padStart(4, '0').toUpperCase()}
                    <span className="text-slate-500 text-xs ml-1.5 font-normal">
                      ({transferBlockSize} 바이트)
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Architecture Insights Note */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 space-y-1.5 leading-relaxed font-sans">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> 하드웨어 아키텍처 관점 분석:
            </span>
            <p className="text-slate-400 text-[11px]">
              8비트 클래식 AVR(ATmega328P, ATmega128, ATmega640) 코어는 원래 내장 하드웨어 DMAC가 없어 CPU가 루프나 ISR에서 데이터를 이동해야 했으나,
              최신 AVR DB/DX/EA 패밀리 및 확장 아키텍처에서는 본 도구에 규격화된 전용 2~4채널 DMAC 컨트롤러를 탑재하여
              UART 대용량 패킷 버퍼링 및 고속 SPI TFT 디스플레이 프레임버퍼 전송 시 CPU 코어 프리징 없이 <strong>100% 비동기 하드웨어 전송</strong>을 수행합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
