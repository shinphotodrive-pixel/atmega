import React, { useState, useMemo } from 'react';
import {
  Activity,
  Clock,
  Cpu,
  Layers,
  Copy,
  Check,
  Zap,
  Info,
  Sliders,
  Sparkles,
  ArrowRight,
  Eye,
  CheckCircle2,
  RefreshCw,
  Hash
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
}

interface SpiPrescalerConfig {
  label: string;
  divider: number;
  spr1: number;
  spr0: number;
  spi2x: number;
}

const SPI_PRESCALERS: SpiPrescalerConfig[] = [
  { label: 'fosc / 2 (Double Speed)', divider: 2, spr1: 0, spr0: 0, spi2x: 1 },
  { label: 'fosc / 4 (Normal Speed)', divider: 4, spr1: 0, spr0: 0, spi2x: 0 },
  { label: 'fosc / 8 (Double Speed)', divider: 8, spr1: 0, spr0: 1, spi2x: 1 },
  { label: 'fosc / 16 (Normal Speed)', divider: 16, spr1: 0, spr0: 1, spi2x: 0 },
  { label: 'fosc / 32 (Double Speed)', divider: 32, spr1: 1, spr0: 0, spi2x: 1 },
  { label: 'fosc / 64 (Normal Speed)', divider: 64, spr1: 1, spr0: 0, spi2x: 0 },
  { label: 'fosc / 128 (Normal Speed)', divider: 128, spr1: 1, spr0: 1, spi2x: 0 }
];

const CPU_FREQUENCIES = [
  { fcpu: 16000000, label: '16.0 MHz (Arduino Uno / Nano / Pro)' },
  { fcpu: 8000000, label: '8.0 MHz (3.3V 내부 / 외장 크리스탈)' },
  { fcpu: 20000000, label: '20.0 MHz (정격 최대 오버클럭)' },
  { fcpu: 12000000, label: '12.0 MHz (USB 크리스탈)' },
  { fcpu: 4000000, label: '4.0 MHz (저전력 크리스탈)' },
  { fcpu: 1000000, label: '1.0 MHz (디폴트 내부 RC)' }
];

export const SpiTimingDiagramVisualizer: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Pinout mapping per MCU
  const spiPinout = useMemo(() => {
    if (selectedMCU === 'atmega328p') {
      return { ss: 'PB2 (Pin 16)', mosi: 'PB3 (Pin 17)', miso: 'PB4 (Pin 18)', sck: 'PB5 (Pin 19)' };
    }
    if (selectedMCU === 'atmega128') {
      return { ss: 'PB0 (Pin 9)', mosi: 'PB2 (Pin 11)', miso: 'PB3 (Pin 12)', sck: 'PB1 (Pin 10)' };
    }
    // atmega640
    return { ss: 'PB0 (Pin 19)', mosi: 'PB2 (Pin 21)', miso: 'PB3 (Pin 22)', sck: 'PB1 (Pin 20)' };
  }, [selectedMCU]);

  // User Interactive States
  const [spiMode, setSpiMode] = useState<0 | 1 | 2 | 3>(0);
  const [selectedPrescalerIdx, setSelectedPrescalerIdx] = useState<number>(1); // fosc/4 default (4 MHz @ 16 MHz)
  const [fcpu, setFcpu] = useState<number>(16000000);
  const [dataOrder, setDataOrder] = useState<'MSB' | 'LSB'>('MSB');
  const [txHex, setTxHex] = useState<string>('A5'); // MOSI data: 0xA5 (10100101)
  const [rxHex, setRxHex] = useState<string>('3C'); // MISO data: 0x3C (00111100)
  const [showSampleMarkers, setShowSampleMarkers] = useState<boolean>(true);
  const [showHoldMargins, setShowHoldMargins] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Derived CPOL and CPHA
  const cpol = spiMode === 2 || spiMode === 3 ? 1 : 0;
  const cpha = spiMode === 1 || spiMode === 3 ? 1 : 0;

  const currentPrescaler = SPI_PRESCALERS[selectedPrescalerIdx];
  const sckFrequency = fcpu / currentPrescaler.divider;
  const sckPeriodNs = (1 / sckFrequency) * 1e9;
  const sckHalfPeriodNs = sckPeriodNs / 2;
  const byteTransferTimeUs = (sckPeriodNs * 8) / 1000;

  // Parsed 8-bit array for MOSI and MISO
  const { mosiBits, misoBits, txVal, rxVal } = useMemo(() => {
    let tVal = parseInt(txHex, 16);
    if (isNaN(tVal)) tVal = 0xa5;
    tVal = tVal & 0xff;

    let rVal = parseInt(rxHex, 16);
    if (isNaN(rVal)) rVal = 0x3c;
    rVal = rVal & 0xff;

    const bitsTx: number[] = [];
    const bitsRx: number[] = [];

    if (dataOrder === 'MSB') {
      for (let i = 7; i >= 0; i--) {
        bitsTx.push((tVal >> i) & 1);
        bitsRx.push((rVal >> i) & 1);
      }
    } else {
      for (let i = 0; i <= 7; i++) {
        bitsTx.push((tVal >> i) & 1);
        bitsRx.push((rVal >> i) & 1);
      }
    }

    return { mosiBits: bitsTx, misoBits: bitsRx, txVal: tVal, rxVal: rVal };
  }, [txHex, rxHex, dataOrder]);

  // SPCR and SPSR register bit calculations
  const { spcrHex, spsrHex, spcrBits, spsrBits } = useMemo(() => {
    const spe = 1; // SPI Enable
    const dord = dataOrder === 'LSB' ? 1 : 0;
    const mstr = 1; // Master mode
    const cpolBit = cpol;
    const cphaBit = cpha;
    const spr1Bit = currentPrescaler.spr1;
    const spr0Bit = currentPrescaler.spr0;
    const spie = 0;

    const spcrVal =
      (spie << 7) |
      (spe << 6) |
      (dord << 5) |
      (mstr << 4) |
      (cpolBit << 3) |
      (cphaBit << 2) |
      (spr1Bit << 1) |
      spr0Bit;

    const spi2xBit = currentPrescaler.spi2x;
    const spsrVal = spi2xBit;

    return {
      spcrHex: '0x' + spcrVal.toString(16).padStart(2, '0').toUpperCase(),
      spsrHex: '0x' + spsrVal.toString(16).padStart(2, '0').toUpperCase(),
      spcrBits: { spie, spe, dord, mstr, cpol: cpolBit, cpha: cphaBit, spr1: spr1Bit, spr0: spr0Bit },
      spsrBits: { spif: 0, wcol: 0, spi2x: spi2xBit }
    };
  }, [cpol, cpha, dataOrder, currentPrescaler]);

  // C Driver Code Generation
  const generatedCCode = useMemo(() => {
    return `// ============================================================================
// ${currentProfile.name} Master SPI Driver
// Mode: SPI Mode ${spiMode} (CPOL=${cpol}, CPHA=${cpha}) | Data Order: ${dataOrder} First
// SCK Freq: ${(sckFrequency / 1e6).toFixed(3)} MHz (Prescaler: ${currentPrescaler.label})
// Pins: SS=${spiPinout.ss}, MOSI=${spiPinout.mosi}, MISO=${spiPinout.miso}, SCK=${spiPinout.sck}
// ============================================================================
#include <avr/io.h>

void SPI_Master_Init(void) {
    // 1. MOSI, SCK, SS 핀을 출력(Output)으로 설정 (MISO는 자동으로 입력 동작)
    // ⚠️ Master 동작 시 SS 핀은 반드시 출력으로 두거나 High를 유지해야 합니다.
    ${selectedMCU === 'atmega328p' ? `DDRB |= (1 << DDB3) | (1 << DDB5) | (1 << DDB2); // MOSI, SCK, SS
    DDRB &= ~(1 << DDB4);                             // MISO 입력
    PORTB |= (1 << PORTB2);                            // SS 비활성화 (Active LOW)` : `DDRB |= (1 << DDB2) | (1 << DDB1) | (1 << DDB0); // MOSI, SCK, SS
    DDRB &= ~(1 << DDB3);                             // MISO 입력
    PORTB |= (1 << PORTB0);                            // SS 비활성화 (Active LOW)`}

    // 2. SPSR (SPI Status Register): 2배속 모드(SPI2X) 설정
    SPSR = ${currentPrescaler.spi2x ? '(1 << SPI2X)' : '0x00'}; // ${spsrHex}

    // 3. SPCR (SPI Control Register): Master, Mode ${spiMode}, 분주비
    SPCR = (1 << SPE) | (1 << MSTR)${dataOrder === 'LSB' ? ' | (1 << DORD)' : ''}${cpol ? ' | (1 << CPOL)' : ''}${cpha ? ' | (1 << CPHA)' : ''}${currentPrescaler.spr1 ? ' | (1 << SPR1)' : ''}${currentPrescaler.spr0 ? ' | (1 << SPR0)' : ''}; // ${spcrHex}
}

/**
 * @brief SPI 1바이트 동시 전송 및 수신 (Full-Duplex)
 * @param txData 보낼 데이터 바이트 (MOSI)
 * @return 수신된 데이터 바이트 (MISO)
 */
uint8_t SPI_Transfer(uint8_t txData) {
    // SPDR 레지스터에 기록하면 하드웨어 쉬프트 전송이 즉시 시작됩니다.
    SPDR = txData;

    // 전송 완료 플래그(SPIF)가 세팅될 때까지 대기 (${byteTransferTimeUs.toFixed(2)} µs 소요)
    while (!(SPSR & (1 << SPIF)));

    // 수신된 1바이트 반환
    return SPDR;
}`;
  }, [
    currentProfile.name,
    selectedMCU,
    spiMode,
    cpol,
    cpha,
    dataOrder,
    sckFrequency,
    currentPrescaler,
    spiPinout,
    spcrHex,
    spsrHex,
    byteTransferTimeUs
  ]);

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Waveform SVG Drawing Parameters
  // Total SVG width = 940, height = 300
  // Timeline starts at x = 110, ends at x = 900
  const svgWidth = 940;
  const svgHeight = 290;
  const startX = 110;
  const leadIn = 40; // SS low before SCK begins
  const leadOut = 40; // SS returns high after SCK finishes
  const bitWidth = 85; // 85px per bit * 8 bits = 680px
  const activeSckWidth = bitWidth * 8;
  const totalTransferWidth = leadIn + activeSckWidth + leadOut; // 760px

  // Channel Y coordinates
  const ySS = 45;
  const ySCK = 115;
  const yMOSI = 185;
  const yMISO = 255;
  const waveHeight = 28;

  // Build SCK Path
  // In each bit slot, there is a clock period:
  // CPOL = 0 (idle low): rises, then falls
  // CPOL = 1 (idle high): falls, then rises
  // CPHA = 0: Sample edge is 1st edge, Shift edge is 2nd edge
  // CPHA = 1: Shift edge is 1st edge, Sample edge is 2nd edge
  const sckStartX = startX + leadIn;

  // Points for SCK
  let sckD = `M ${startX} ${cpol === 0 ? ySCK + waveHeight : ySCK} L ${sckStartX} ${cpol === 0 ? ySCK + waveHeight : ySCK} `;
  for (let i = 0; i < 8; i++) {
    const bitX = sckStartX + i * bitWidth;
    const halfX = bitX + bitWidth / 2;
    const nextBitX = bitX + bitWidth;

    if (cpol === 0) {
      // Idle LOW: pulse up to HIGH at bitX (if CPHA=0) or stay low?
      // In Mode 0: idle low. First edge is rising at bitX + bitWidth*0.25 or bitWidth*0.5?
      // Standard representation: In bit i, SCK has a high pulse and a low pulse.
      // Mode 0 (CPOL=0, CPHA=0): first edge is rising at bitX, falling at halfX, low until nextBitX
      // Mode 1 (CPOL=0, CPHA=1): rising at halfX, falling at nextBitX
      // Mode 2 (CPOL=1, CPHA=0): falling at bitX, rising at halfX, high until nextBitX
      // Mode 3 (CPOL=1, CPHA=1): falling at halfX, rising at nextBitX
      // A clearer representation for both:
      // First edge occurs at bitX + bitWidth * 0.25 (or bitX if continuous clock)
      // To show 8 distinct clock pulses cleanly:
      // pulse rises at bitX, falls at halfX, low until nextBitX (CPOL=0)
      sckD += `L ${bitX} ${ySCK} L ${halfX} ${ySCK} L ${halfX} ${ySCK + waveHeight} L ${nextBitX} ${ySCK + waveHeight} `;
    } else {
      // CPOL = 1: pulse falls to LOW at bitX, rises at halfX
      sckD += `L ${bitX} ${ySCK + waveHeight} L ${halfX} ${ySCK + waveHeight} L ${halfX} ${ySCK} L ${nextBitX} ${ySCK} `;
    }
  }
  sckD += `L ${startX + totalTransferWidth} ${cpol === 0 ? ySCK + waveHeight : ySCK}`;

  // Sampling positions:
  // CPHA = 0: sampled on the leading (first) edge of each pulse (at bitX)
  // CPHA = 1: sampled on the trailing (second) edge of each pulse (at halfX)
  const sampleXPositions: number[] = [];
  const shiftXPositions: number[] = [];
  for (let i = 0; i < 8; i++) {
    const bitX = sckStartX + i * bitWidth;
    const halfX = bitX + bitWidth / 2;
    if (cpha === 0) {
      sampleXPositions.push(bitX);
      shiftXPositions.push(halfX);
    } else {
      shiftXPositions.push(bitX);
      sampleXPositions.push(halfX);
    }
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Title & Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <Activity className="w-3.5 h-3.5" /> SPI Timing Diagram Visualizer
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              MCU: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800/60 text-xs font-mono font-bold">
              모드 {spiMode} (CPOL={cpol}, CPHA={cpha})
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            SPI 타이밍 다이어그램 & 웨이브폼 분석기
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            선택된 SPI 모드(0, 1, 2, 3), 클럭 분주비 및 MCU 타이밍 파라미터에 기반하여
            <strong> SCK, MOSI, MISO, /SS</strong> 신호의 상호작용과 데이터 샘플링/쉬프트 에지 타이밍을 시각화합니다.
          </p>
        </div>

        {/* Real-time Clock Metric Badge */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-right flex-shrink-0 min-w-[220px]">
          <div className="text-[11px] text-slate-400 font-mono">실제 SPI SCK 주파수</div>
          <div className="text-2xl font-mono font-black text-cyan-400 mt-0.5">
            {sckFrequency >= 1000000
              ? `${(sckFrequency / 1000000).toFixed(2)} MHz`
              : `${(sckFrequency / 1000).toFixed(1)} kHz`}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            SCK 주기: <span className="font-mono text-amber-400 font-bold">{sckPeriodNs.toFixed(1)} ns</span> (1 Byte: {byteTransferTimeUs.toFixed(2)} µs)
          </div>
        </div>
      </div>

      {/* Control Grid: Mode / Clock / Payload */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. SPI Mode Picker */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" /> SPI 모드 (Mode 0~3)
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {([0, 1, 2, 3] as const).map((mode) => {
              const isSel = spiMode === mode;
              const modeCpol = mode === 2 || mode === 3 ? 1 : 0;
              const modeCpha = mode === 1 || mode === 3 ? 1 : 0;
              return (
                <button
                  key={mode}
                  onClick={() => setSpiMode(mode)}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    isSel
                      ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-md shadow-cyan-950/40'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div className="font-mono font-bold text-xs text-white">Mode {mode}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    CPOL={modeCpol}, CPHA={modeCpha}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 pt-1">
            {spiMode === 0 && '⚡ Mode 0: 대부분의 SD 카드, Flash 메모리(W25Q) 표준 규격'}
            {spiMode === 1 && '⚡ Mode 1: SCK 유휴 Low, 후행 에지에서 데이터 샘플링'}
            {spiMode === 2 && '⚡ Mode 2: SCK 유휴 High, 선행(하강) 에지에서 샘플링'}
            {spiMode === 3 && '⚡ Mode 3: SCK 유휴 High, 후행(상승) 에지에서 샘플링'}
          </p>
        </div>

        {/* 2. Clock Speed & Prescaler */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> SPI 클럭 분주비 (SPCR/SPSR)
          </label>
          <select
            value={selectedPrescalerIdx}
            onChange={(e) => setSelectedPrescalerIdx(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
          >
            {SPI_PRESCALERS.map((pre, idx) => (
              <option key={idx} value={idx}>
                {pre.label} (÷{pre.divider})
              </option>
            ))}
          </select>

          <div className="pt-2 border-t border-slate-800">
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              F_CPU 시스템 클럭
            </label>
            <select
              value={fcpu}
              onChange={(e) => setFcpu(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
            >
              {CPU_FREQUENCIES.map((c) => (
                <option key={c.fcpu} value={c.fcpu}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. Data Payloads (TX MOSI & RX MISO) */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-purple-400" /> 데이터 페이로드 (HEX 바이트)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">MOSI 송신 (TX)</span>
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                <span className="text-xs text-slate-500 font-mono mr-1">0x</span>
                <input
                  type="text"
                  maxLength={2}
                  value={txHex}
                  onChange={(e) => setTxHex(e.target.value.toUpperCase())}
                  className="w-full bg-transparent text-xs text-cyan-400 font-mono font-bold focus:outline-none uppercase"
                />
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">MISO 수신 (RX)</span>
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                <span className="text-xs text-slate-500 font-mono mr-1">0x</span>
                <input
                  type="text"
                  maxLength={2}
                  value={rxHex}
                  onChange={(e) => setRxHex(e.target.value.toUpperCase())}
                  className="w-full bg-transparent text-xs text-emerald-400 font-mono font-bold focus:outline-none uppercase"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">데이터 전송 순서:</span>
            <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-[10px] font-mono">
              <button
                onClick={() => setDataOrder('MSB')}
                className={`px-2 py-0.5 rounded ${
                  dataOrder === 'MSB' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                MSB First
              </button>
              <button
                onClick={() => setDataOrder('LSB')}
                className={`px-2 py-0.5 rounded ${
                  dataOrder === 'LSB' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                LSB First
              </button>
            </div>
          </div>
        </div>

        {/* 4. Display Toggles & Pinout */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-emerald-400" /> 타이밍 마커 표시 제어
          </label>
          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showSampleMarkers}
                onChange={(e) => setShowSampleMarkers(e.target.checked)}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>데이터 샘플링(Latch) 스트로브</span>
            </label>
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showHoldMargins}
                onChange={(e) => setShowHoldMargins(e.target.checked)}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>Setup / Hold 시간 마진 가이드</span>
            </label>
          </div>

          <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 font-mono space-y-0.5">
            <div>
              <span className="text-slate-500">MOSI:</span> {spiPinout.mosi}
            </div>
            <div>
              <span className="text-slate-500">MISO:</span> {spiPinout.miso}
            </div>
            <div>
              <span className="text-slate-500">SCK:</span> {spiPinout.sck} | <span className="text-slate-500">/SS:</span> {spiPinout.ss}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Waveform Canvas / SVG Container */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3 overflow-hidden shadow-inner">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">
              실시간 SPI 버스 웨이브폼 타임라인 (1 Byte 전송: 0x{txVal.toString(16).toUpperCase()} ⟷ 0x{rxVal.toString(16).toUpperCase()})
            </h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
              샘플링 에지: {cpha === 0 ? 'Leading Edge (1번째)' : 'Trailing Edge (2번째)'}
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
              쉬프트 에지: {cpha === 0 ? 'Trailing Edge (2번째)' : 'Leading Edge (1번째)'}
            </span>
          </div>
        </div>

        {/* Scrollable SVG Viewport */}
        <div className="overflow-x-auto custom-scrollbar pb-2">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full min-w-[880px] h-auto select-none"
            style={{ minHeight: '290px' }}
          >
            {/* Background Grid Lines */}
            <defs>
              <pattern id="spiGrid" width="42.5" height="40" patternUnits="userSpaceOnUse">
                <path d="M 42.5 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2 2" />
              </pattern>
            </defs>
            <rect width={svgWidth} height={svgHeight} fill="url(#spiGrid)" opacity="0.4" />

            {/* Bit Labels Header at Top */}
            {mosiBits.map((bitVal, idx) => {
              const xPos = sckStartX + idx * bitWidth + bitWidth / 2;
              const bitLabel = dataOrder === 'MSB' ? `b${7 - idx}` : `b${idx}`;
              return (
                <g key={idx}>
                  {/* Bit column separator line */}
                  <line
                    x1={sckStartX + idx * bitWidth}
                    y1={20}
                    x2={sckStartX + idx * bitWidth}
                    y2={svgHeight - 10}
                    stroke="#334155"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.5"
                  />
                  <text
                    x={xPos}
                    y={22}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    Bit {idx + 1} ({bitLabel})
                  </text>
                </g>
              );
            })}
            {/* Final column boundary */}
            <line
              x1={sckStartX + 8 * bitWidth}
              y1={20}
              x2={sckStartX + 8 * bitWidth}
              y2={svgHeight - 10}
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.5"
            />

            {/* CHANNEL 1: /SS (Slave Select) */}
            <g>
              <text x={20} y={ySS + 16} fill="#f43f5e" fontSize="12" fontFamily="monospace" fontWeight="bold">
                /SS (CS)
              </text>
              <text x={20} y={ySS + 28} fill="#64748b" fontSize="9" fontFamily="monospace">
                Active Low
              </text>
              {/* Path: High -> drops low at startX -> stays low -> rises at totalTransferWidth */}
              <path
                d={`M 15 ${ySS} L ${startX} ${ySS} L ${startX} ${ySS + waveHeight} L ${
                  startX + totalTransferWidth
                } ${ySS + waveHeight} L ${startX + totalTransferWidth} ${ySS} L ${svgWidth - 20} ${ySS}`}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {/* CHANNEL 2: SCK (Serial Clock) */}
            <g>
              <text x={20} y={ySCK + 16} fill="#38bdf8" fontSize="12" fontFamily="monospace" fontWeight="bold">
                SCK
              </text>
              <text x={20} y={ySCK + 28} fill="#64748b" fontSize="9" fontFamily="monospace">
                Idle {cpol === 0 ? 'LOW (0)' : 'HIGH (1)'}
              </text>
              {/* Render dynamic SCK waveform */}
              <path
                d={sckD}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {/* CHANNEL 3: MOSI (Master Out Slave In) */}
            <g>
              <text x={20} y={yMOSI + 16} fill="#a855f7" fontSize="12" fontFamily="monospace" fontWeight="bold">
                MOSI (TX)
              </text>
              <text x={20} y={yMOSI + 28} fill="#64748b" fontSize="9" fontFamily="monospace">
                0x{txVal.toString(16).toUpperCase()}
              </text>
              {/* Draw MOSI bit cells */}
              {mosiBits.map((b, idx) => {
                const cellX = sckStartX + idx * bitWidth;
                const nextCellX = cellX + bitWidth;
                const topY = yMOSI;
                const botY = yMOSI + waveHeight;
                const targetY = b === 1 ? topY : botY;

                return (
                  <g key={idx}>
                    {/* Digital eye cell outline */}
                    <path
                      d={`M ${cellX} ${topY} L ${nextCellX} ${topY} M ${cellX} ${botY} L ${nextCellX} ${botY} M ${cellX} ${topY} L ${
                        cellX + 6
                      } ${botY} M ${cellX} ${botY} L ${cellX + 6} ${topY}`}
                      stroke="#475569"
                      strokeWidth="1.2"
                      opacity="0.4"
                    />
                    {/* Active State Line */}
                    <line
                      x1={cellX}
                      y1={targetY}
                      x2={nextCellX}
                      y2={targetY}
                      stroke="#c084fc"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    {/* Transition crossover connector */}
                    {idx > 0 && (
                      <line
                        x1={cellX}
                        y1={mosiBits[idx - 1] === 1 ? topY : botY}
                        x2={cellX}
                        y2={targetY}
                        stroke="#c084fc"
                        strokeWidth="2.5"
                      />
                    )}
                    {/* Value Badge Text */}
                    <text
                      x={cellX + bitWidth / 2}
                      y={yMOSI + 18}
                      textAnchor="middle"
                      fill={b === 1 ? '#e9d5ff' : '#94a3b8'}
                      fontSize="12"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {b}
                    </text>
                  </g>
                );
              })}
              {/* Pre-transfer and Post-transfer idle high impedance / low */}
              <line
                x1={startX}
                y1={yMOSI + waveHeight / 2}
                x2={sckStartX}
                y2={yMOSI + waveHeight / 2}
                stroke="#64748b"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
              <line
                x1={sckStartX + 8 * bitWidth}
                y1={yMOSI + waveHeight / 2}
                x2={startX + totalTransferWidth}
                y2={yMOSI + waveHeight / 2}
                stroke="#64748b"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
            </g>

            {/* CHANNEL 4: MISO (Master In Slave Out) */}
            <g>
              <text x={20} y={yMISO + 16} fill="#10b981" fontSize="12" fontFamily="monospace" fontWeight="bold">
                MISO (RX)
              </text>
              <text x={20} y={yMISO + 28} fill="#64748b" fontSize="9" fontFamily="monospace">
                0x{rxVal.toString(16).toUpperCase()}
              </text>
              {/* Draw MISO bit cells */}
              {misoBits.map((b, idx) => {
                const cellX = sckStartX + idx * bitWidth;
                const nextCellX = cellX + bitWidth;
                const topY = yMISO;
                const botY = yMISO + waveHeight;
                const targetY = b === 1 ? topY : botY;

                return (
                  <g key={idx}>
                    {/* Digital eye cell outline */}
                    <path
                      d={`M ${cellX} ${topY} L ${nextCellX} ${topY} M ${cellX} ${botY} L ${nextCellX} ${botY} M ${cellX} ${topY} L ${
                        cellX + 6
                      } ${botY} M ${cellX} ${botY} L ${cellX + 6} ${topY}`}
                      stroke="#475569"
                      strokeWidth="1.2"
                      opacity="0.4"
                    />
                    {/* Active State Line */}
                    <line
                      x1={cellX}
                      y1={targetY}
                      x2={nextCellX}
                      y2={targetY}
                      stroke="#34d399"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    {/* Transition crossover connector */}
                    {idx > 0 && (
                      <line
                        x1={cellX}
                        y1={misoBits[idx - 1] === 1 ? topY : botY}
                        x2={cellX}
                        y2={targetY}
                        stroke="#34d399"
                        strokeWidth="2.5"
                      />
                    )}
                    {/* Value Badge Text */}
                    <text
                      x={cellX + bitWidth / 2}
                      y={yMISO + 18}
                      textAnchor="middle"
                      fill={b === 1 ? '#a7f3d0' : '#94a3b8'}
                      fontSize="12"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {b}
                    </text>
                  </g>
                );
              })}
              {/* Pre/post lines */}
              <line
                x1={startX}
                y1={yMISO + waveHeight / 2}
                x2={sckStartX}
                y2={yMISO + waveHeight / 2}
                stroke="#64748b"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
              <line
                x1={sckStartX + 8 * bitWidth}
                y1={yMISO + waveHeight / 2}
                x2={startX + totalTransferWidth}
                y2={yMISO + waveHeight / 2}
                stroke="#64748b"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
            </g>

            {/* SAMPLING STROBE MARKERS (Arrow Down with sample circle) */}
            {showSampleMarkers &&
              sampleXPositions.map((sX, idx) => (
                <g key={idx}>
                  <line
                    x1={sX}
                    y1={ySCK}
                    x2={sX}
                    y2={yMISO + waveHeight + 5}
                    stroke="#fbbf24"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                    opacity="0.85"
                  />
                  {/* Small strobe pulse circle on SCK */}
                  <circle cx={sX} cy={cpol === 0 ? ySCK : ySCK + waveHeight} r="3.5" fill="#fbbf24" />
                  {/* Sampling strobe indicator on MISO */}
                  <polygon
                    points={`${sX - 3},${yMISO - 4} ${sX + 3},${yMISO - 4} ${sX},${yMISO + 1}`}
                    fill="#fbbf24"
                  />
                </g>
              ))}

            {/* SETUP & HOLD TIME ANNOTATION ON FIRST BIT */}
            {showHoldMargins && (
              <g>
                {/* Visual marker bracket for Bit 1 sampling */}
                <rect
                  x={sampleXPositions[0] - 12}
                  y={yMOSI - 10}
                  width="24"
                  height="45"
                  fill="#38bdf8"
                  opacity="0.12"
                  rx="3"
                />
                <text
                  x={sampleXPositions[0]}
                  y={yMOSI - 12}
                  textAnchor="middle"
                  fill="#38bdf8"
                  fontSize="8.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  t_setup | t_hold
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Legend Footer */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>/SS: Slave 활성화 (LOW)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <span>SCK: {sckPeriodNs.toFixed(1)}ns (50% Duty)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
            <span>MOSI: 마스터 전송 데이터</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>MISO: 슬레이브 수신 데이터</span>
          </div>
        </div>
      </div>

      {/* Register Bit-Field Visualizer & Timing Specs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* SPCR / SPSR Register Bit-Fields */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" /> SPI 제어 레지스터 (SPCR & SPSR)
            </h4>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">
                SPCR: <strong className="text-cyan-400">{spcrHex}</strong>
              </span>
              <span className="text-slate-400">
                SPSR: <strong className="text-amber-400">{spsrHex}</strong>
              </span>
            </div>
          </div>

          {/* SPCR Bits */}
          <div>
            <span className="text-[10px] text-slate-400 font-mono block mb-1">
              SPCR (SPI Control Register) - 0x{((1 << 6) | (1 << 4) | (dataOrder === 'LSB' ? 1 << 5 : 0) | (cpol << 3) | (cpha << 2) | (currentPrescaler.spr1 << 1) | currentPrescaler.spr0).toString(16).toUpperCase()}
            </span>
            <div className="grid grid-cols-8 gap-1 text-center font-mono text-[10px]">
              <div className="bg-slate-900 border border-slate-800 rounded p-1">
                <span className="text-slate-500 block">SPIE</span>
                <span className="text-slate-400 font-bold">0</span>
              </div>
              <div className="bg-cyan-950/70 border border-cyan-600 rounded p-1">
                <span className="text-cyan-400 block">SPE</span>
                <span className="text-white font-bold">1</span>
              </div>
              <div className={`rounded p-1 border ${dataOrder === 'LSB' ? 'bg-purple-950/70 border-purple-500' : 'bg-slate-900 border-slate-800'}`}>
                <span className="text-slate-400 block">DORD</span>
                <span className="font-bold">{dataOrder === 'LSB' ? '1' : '0'}</span>
              </div>
              <div className="bg-cyan-950/70 border border-cyan-600 rounded p-1">
                <span className="text-cyan-400 block">MSTR</span>
                <span className="text-white font-bold">1</span>
              </div>
              <div className={`rounded p-1 border ${cpol ? 'bg-amber-950/70 border-amber-500' : 'bg-slate-900 border-slate-800'}`}>
                <span className="text-slate-400 block">CPOL</span>
                <span className="font-bold">{cpol}</span>
              </div>
              <div className={`rounded p-1 border ${cpha ? 'bg-amber-950/70 border-amber-500' : 'bg-slate-900 border-slate-800'}`}>
                <span className="text-slate-400 block">CPHA</span>
                <span className="font-bold">{cpha}</span>
              </div>
              <div className={`rounded p-1 border ${currentPrescaler.spr1 ? 'bg-emerald-950/70 border-emerald-500' : 'bg-slate-900 border-slate-800'}`}>
                <span className="text-slate-400 block">SPR1</span>
                <span className="font-bold">{currentPrescaler.spr1}</span>
              </div>
              <div className={`rounded p-1 border ${currentPrescaler.spr0 ? 'bg-emerald-950/70 border-emerald-500' : 'bg-slate-900 border-slate-800'}`}>
                <span className="text-slate-400 block">SPR0</span>
                <span className="font-bold">{currentPrescaler.spr0}</span>
              </div>
            </div>
          </div>

          {/* SPSR Bits */}
          <div>
            <span className="text-[10px] text-slate-400 font-mono block mb-1">
              SPSR (SPI Status Register)
            </span>
            <div className="grid grid-cols-8 gap-1 text-center font-mono text-[10px]">
              <div className="bg-slate-900 border border-slate-800 rounded p-1">
                <span className="text-slate-500 block">SPIF</span>
                <span className="text-slate-500 font-bold">0</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded p-1">
                <span className="text-slate-500 block">WCOL</span>
                <span className="text-slate-500 font-bold">0</span>
              </div>
              <div className="bg-slate-900/50 border border-slate-800/50 rounded p-1 text-slate-600">-</div>
              <div className="bg-slate-900/50 border border-slate-800/50 rounded p-1 text-slate-600">-</div>
              <div className="bg-slate-900/50 border border-slate-800/50 rounded p-1 text-slate-600">-</div>
              <div className="bg-slate-900/50 border border-slate-800/50 rounded p-1 text-slate-600">-</div>
              <div className="bg-slate-900/50 border border-slate-800/50 rounded p-1 text-slate-600">-</div>
              <div className={`rounded p-1 border ${currentPrescaler.spi2x ? 'bg-cyan-950/70 border-cyan-500' : 'bg-slate-900 border-slate-800'}`}>
                <span className="text-cyan-400 block">SPI2X</span>
                <span className="text-white font-bold">{currentPrescaler.spi2x}</span>
              </div>
            </div>
          </div>
        </div>

        {/* AVR Hardware Timing Parameters Table */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> {currentProfile.name} SPI 하드웨어 타이밍 사양
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">Vcc = 5.0V 표준</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">SCK 클럭 주기 (t_SCK)</span>
              <span className="text-sm font-bold text-cyan-400">{sckPeriodNs.toFixed(1)} ns</span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">SCK High / Low 펄스 폭</span>
              <span className="text-sm font-bold text-amber-400">{sckHalfPeriodNs.toFixed(1)} ns</span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">MISO 최소 셋업 시간 (t_MIS)</span>
              <span className="text-sm font-bold text-white">≥ 10.0 ns</span>
              <span className="text-[9px] text-emerald-400 block mt-0.5">안전 여유: {(sckHalfPeriodNs - 10).toFixed(1)}ns</span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">MISO 최소 홀드 시간 (t_MIH)</span>
              <span className="text-sm font-bold text-white">≥ 10.0 ns</span>
              <span className="text-[9px] text-emerald-400 block mt-0.5">데이터시트 표준 충족</span>
            </div>
          </div>
        </div>
      </div>

      {/* Production C Code Output */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white font-mono">
              생성된 Master SPI 드라이버 코드 (Mode {spiMode}, {(sckFrequency / 1e6).toFixed(2)} MHz)
            </h4>
          </div>
          <button
            onClick={copyCode}
            className="inline-flex items-center gap-1 text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-800 text-xs transition"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedCode ? '복사 완료' : 'C 코드 복사'}
          </button>
        </div>
        <pre className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56 custom-scrollbar">
          {generatedCCode}
        </pre>
      </div>
    </div>
  );
};
