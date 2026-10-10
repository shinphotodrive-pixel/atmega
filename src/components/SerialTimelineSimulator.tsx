import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Send,
  Zap,
  Radio,
  Clock,
  Layers,
  Sparkles,
  Info,
  Activity,
  ArrowRight
} from 'lucide-react';

interface Props {
  selectedMCU: SupportedMCU;
}

type ProtocolType = 'usart' | 'spi' | 'i2c';

export const SerialTimelineSimulator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Protocol selection
  const [protocol, setProtocol] = useState<ProtocolType>('usart');

  // Payload settings
  const [payloadText, setPayloadText] = useState<string>('Hello, AVR!');
  const [payloadType, setPayloadType] = useState<'text' | 'bytes'>('text');
  const [byteLength, setByteLength] = useState<number>(12); // when in byte mode

  // System Clock
  const [fcpu, setFcpu] = useState<number>(16000000);

  // USART Configuration
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [dataBits, setDataBits] = useState<number>(8);
  const [parity, setParity] = useState<'none' | 'even' | 'odd'>('none');
  const [stopBits, setStopBits] = useState<number>(1);

  // SPI Configuration
  const [spiPrescaler, setSpiPrescaler] = useState<number>(4); // F_CPU / 4 = 4MHz default
  const [spiByteGapUs, setSpiByteGapUs] = useState<number>(0.5); // Microcontroller CS / byte-to-byte gap in microseconds

  // I2C Configuration
  const [i2cSpeed, setI2cSpeed] = useState<number>(100000); // 100kHz standard mode

  // Simulation Animation State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [simProgress, setSimProgress] = useState<number>(0); // 0 to 1
  const [simSpeed, setSimSpeed] = useState<number>(1); // 0.25x, 0.5x, 1x, 2x
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Calculate actual byte count
  const effectiveBytes = useMemo(() => {
    if (payloadType === 'text') {
      return Math.max(1, new TextEncoder().encode(payloadText).length);
    }
    return Math.max(1, byteLength);
  }, [payloadType, payloadText, byteLength]);

  // Serial timing calculations
  const timing = useMemo(() => {
    let bitDurationUs = 0;
    let byteDurationUs = 0;
    let totalDurationUs = 0;
    let framingBitsPerByte = 8;
    let overheadPercentage = 0;
    let throughputKBps = 0;

    if (protocol === 'usart') {
      // 1 Start bit + Data bits (5~8) + Parity bit (0 or 1) + Stop bits (1 or 2)
      const parityBits = parity === 'none' ? 0 : 1;
      const totalBitsPerFrame = 1 + dataBits + parityBits + stopBits;
      bitDurationUs = (1 / baudRate) * 1e6;
      byteDurationUs = totalBitsPerFrame * bitDurationUs;
      totalDurationUs = byteDurationUs * effectiveBytes;
      framingBitsPerByte = totalBitsPerFrame;
      overheadPercentage = ((totalBitsPerFrame - dataBits) / totalBitsPerFrame) * 100;
      throughputKBps = (effectiveBytes / (totalDurationUs / 1e6)) / 1024;
    } else if (protocol === 'spi') {
      // SPI: SCK frequency = F_CPU / prescaler
      const spiClockHz = fcpu / spiPrescaler;
      bitDurationUs = (1 / spiClockHz) * 1e6;
      // 8 clock cycles + byte gap
      byteDurationUs = 8 * bitDurationUs + spiByteGapUs;
      totalDurationUs = byteDurationUs * effectiveBytes;
      framingBitsPerByte = 8;
      overheadPercentage = (spiByteGapUs / byteDurationUs) * 100;
      throughputKBps = (effectiveBytes / (totalDurationUs / 1e6)) / 1024;
    } else if (protocol === 'i2c') {
      // I2C: 100kHz / 400kHz / 1MHz
      // Overhead: START (1 bit) + 7-bit Addr + R/W (1 bit) + ACK (1 bit) + STOP (1 bit)
      // Each data byte: 8 bits + 1 ACK bit = 9 bits
      bitDurationUs = (1 / i2cSpeed) * 1e6;
      const addrHeaderBits = 1 + 8 + 1; // START + ADDR+RW + ACK = 10 bits
      const stopBitsCount = 1;
      const dataBitsTotal = effectiveBytes * 9; // 8 bits + 1 ACK per byte
      const totalBits = addrHeaderBits + dataBitsTotal + stopBitsCount;
      byteDurationUs = 9 * bitDurationUs;
      totalDurationUs = totalBits * bitDurationUs;
      framingBitsPerByte = 9;
      overheadPercentage = ((totalBits - effectiveBytes * 8) / totalBits) * 100;
      throughputKBps = (effectiveBytes / (totalDurationUs / 1e6)) / 1024;
    }

    // CPU cycles consumed at F_CPU
    const cpuCycles = Math.round((totalDurationUs / 1e6) * fcpu);

    return {
      bitDurationUs,
      byteDurationUs,
      totalDurationUs,
      totalDurationMs: totalDurationUs / 1000,
      framingBitsPerByte,
      overheadPercentage,
      throughputKBps,
      cpuCycles
    };
  }, [
    protocol,
    baudRate,
    dataBits,
    parity,
    stopBits,
    fcpu,
    spiPrescaler,
    spiByteGapUs,
    i2cSpeed,
    effectiveBytes
  ]);

  // Comparative metrics across the 3 protocols for the exact same payload
  const comparisonProtocols = useMemo(() => {
    // 1. USART @ 115200 (10 bits/byte)
    const usartTimeUs = effectiveBytes * 10 * (1 / 115200) * 1e6;
    // 2. I2C Standard @ 100kHz (9 bits/byte + header)
    const i2c100kTimeUs = (10 + effectiveBytes * 9 + 1) * (1 / 100000) * 1e6;
    // 3. I2C Fast @ 400kHz
    const i2c400kTimeUs = (10 + effectiveBytes * 9 + 1) * (1 / 400000) * 1e6;
    // 4. SPI @ 4MHz (F_CPU/4, 8 bits + 0.5us gap)
    const spi4mTimeUs = effectiveBytes * (8 * (1 / 4000000) * 1e6 + 0.5);
    // 5. SPI @ 8MHz (F_CPU/2)
    const spi8mTimeUs = effectiveBytes * (8 * (1 / 8000000) * 1e6 + 0.2);

    const maxTime = Math.max(usartTimeUs, i2c100kTimeUs, i2c400kTimeUs, spi4mTimeUs, spi8mTimeUs);

    return [
      {
        id: 'usart_115k',
        name: 'USART (115,200 bps 8N1)',
        timeUs: usartTimeUs,
        timeFormatted: usartTimeUs > 1000 ? `${(usartTimeUs / 1000).toFixed(2)} ms` : `${usartTimeUs.toFixed(1)} µs`,
        ratio: (usartTimeUs / maxTime) * 100,
        color: 'from-amber-500 to-amber-600',
        textColor: 'text-amber-400'
      },
      {
        id: 'i2c_100k',
        name: 'I2C Standard (100 kHz)',
        timeUs: i2c100kTimeUs,
        timeFormatted: i2c100kTimeUs > 1000 ? `${(i2c100kTimeUs / 1000).toFixed(2)} ms` : `${i2c100kTimeUs.toFixed(1)} µs`,
        ratio: (i2c100kTimeUs / maxTime) * 100,
        color: 'from-cyan-500 to-cyan-600',
        textColor: 'text-cyan-400'
      },
      {
        id: 'i2c_400k',
        name: 'I2C Fast Mode (400 kHz)',
        timeUs: i2c400kTimeUs,
        timeFormatted: i2c400kTimeUs > 1000 ? `${(i2c400kTimeUs / 1000).toFixed(2)} ms` : `${i2c400kTimeUs.toFixed(1)} µs`,
        ratio: (i2c400kTimeUs / maxTime) * 100,
        color: 'from-blue-500 to-blue-600',
        textColor: 'text-blue-400'
      },
      {
        id: 'spi_4m',
        name: 'SPI Master (4.0 MHz, F_CPU/4)',
        timeUs: spi4mTimeUs,
        timeFormatted: spi4mTimeUs > 1000 ? `${(spi4mTimeUs / 1000).toFixed(2)} ms` : `${spi4mTimeUs.toFixed(1)} µs`,
        ratio: (spi4mTimeUs / maxTime) * 100,
        color: 'from-emerald-500 to-emerald-600',
        textColor: 'text-emerald-400'
      },
      {
        id: 'spi_8m',
        name: 'SPI High Speed (8.0 MHz, F_CPU/2)',
        timeUs: spi8mTimeUs,
        timeFormatted: spi8mTimeUs > 1000 ? `${(spi8mTimeUs / 1000).toFixed(2)} ms` : `${spi8mTimeUs.toFixed(1)} µs`,
        ratio: (spi8mTimeUs / maxTime) * 100,
        color: 'from-purple-500 to-purple-600',
        textColor: 'text-purple-400'
      }
    ];
  }, [effectiveBytes]);

  // Animation controller
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    lastTimeRef.current = performance.now();

    const loop = (time: number) => {
      const deltaMs = time - lastTimeRef.current;
      lastTimeRef.current = time;

      // Realistic visual animation: we normalize total duration to a human-friendly visual cycle (e.g. 3.0s base)
      const baseCycleMs = 3000;
      const progressIncrement = (deltaMs / baseCycleMs) * simSpeed;

      setSimProgress((prev) => {
        const next = prev + progressIncrement;
        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, simSpeed]);

  const handlePlayPause = () => {
    if (simProgress >= 1) {
      setSimProgress(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setSimProgress(0);
  };

  // Generate sample bit waveform pattern for 1 byte (e.g. ASCII 'A' = 0x41 = 0b01000001, LSB first)
  const sampleByteVal = 0x41; // 'A'
  const waveformBits = useMemo(() => {
    if (protocol === 'usart') {
      // Idle(1) -> Start(0) -> D0..D7 -> Parity -> Stop(1) -> Idle(1)
      const bits: { label: string; level: 0 | 1; type: 'idle' | 'start' | 'data' | 'parity' | 'stop' }[] = [];
      bits.push({ label: 'IDLE', level: 1, type: 'idle' });
      bits.push({ label: 'START', level: 0, type: 'start' });

      let paritySum = 0;
      for (let i = 0; i < dataBits; i++) {
        const bitVal = ((sampleByteVal >> i) & 1) as 0 | 1;
        bits.push({ label: `D${i} (${bitVal})`, level: bitVal, type: 'data' });
        if (bitVal === 1) paritySum++;
      }

      if (parity !== 'none') {
        const parityVal = parity === 'even' ? (paritySum % 2 === 0 ? 0 : 1) : (paritySum % 2 === 1 ? 0 : 1);
        bits.push({ label: `PAR (${parityVal})`, level: parityVal, type: 'parity' });
      }

      for (let s = 0; s < stopBits; s++) {
        bits.push({ label: `STOP${s + 1}`, level: 1, type: 'stop' });
      }
      bits.push({ label: 'IDLE', level: 1, type: 'idle' });
      return bits;
    } else if (protocol === 'spi') {
      // SPI MOSI sample bits (MSB first: 0b01000001)
      const bits: { label: string; level: 0 | 1; type: 'idle' | 'data' }[] = [];
      bits.push({ label: 'CS High', level: 1, type: 'idle' });
      for (let i = 7; i >= 0; i--) {
        const bitVal = ((sampleByteVal >> i) & 1) as 0 | 1;
        bits.push({ label: `b${i} (${bitVal})`, level: bitVal, type: 'data' });
      }
      bits.push({ label: 'CS High', level: 1, type: 'idle' });
      return bits;
    } else {
      // I2C: START -> 7-bit Addr (0x50) + W(0) + ACK(0) -> Data(0x41) + ACK(0) -> STOP
      const bits: { label: string; level: 0 | 1; type: 'start' | 'data' | 'stop' }[] = [];
      bits.push({ label: 'START', level: 0, type: 'start' });
      // 8 data bits
      for (let i = 7; i >= 0; i--) {
        const bitVal = ((sampleByteVal >> i) & 1) as 0 | 1;
        bits.push({ label: `D${i} (${bitVal})`, level: bitVal, type: 'data' });
      }
      bits.push({ label: 'ACK', level: 0, type: 'data' });
      bits.push({ label: 'STOP', level: 1, type: 'stop' });
      return bits;
    }
  }, [protocol, dataBits, parity, stopBits]);

  // Current bytes transferred during simulation
  const currentTransferredBytes = Math.floor(simProgress * effectiveBytes);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
            <Timer className="w-3.5 h-3.5" /> 직렬 통신 타임라인 시뮬레이터 (Serial Timeline Simulator)
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            {currentProfile.name} 통신 속도별 전송 지연 & 패킷 타임라인 시뮬레이션
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            UART/USART, SPI, I2C(TWI) 통신 속도 설정 및 페이로드 바이트 크기에 따른 1비트 주기,
            1바이트 프레이밍 오버헤드, 총 전송 지연 시간(µs/ms)과 신호 파형을 실시간으로 시각화합니다.
          </p>
        </div>

        {/* Global MCU Clock badge */}
        <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800 text-xs font-mono">
          <span className="text-slate-400">클럭 F_CPU:</span>
          <select
            value={fcpu}
            onChange={(e) => setFcpu(Number(e.target.value))}
            className="bg-slate-900 text-amber-400 font-bold border border-slate-800 rounded px-2 py-1 focus:outline-none"
          >
            <option value={16000000}>16.0 MHz (5V 표준)</option>
            <option value={8000000}>8.0 MHz (3.3V 저전력)</option>
            <option value={20000000}>20.0 MHz (328P 최대)</option>
            <option value={11059200}>11.0592 MHz (통신 0% 오차)</option>
            <option value={14745600}>14.7456 MHz (통신 전용)</option>
          </select>
        </div>
      </div>

      {/* Protocol Selection Tabs & Payload Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Protocol & Speed Settings */}
        <div className="bg-slate-950/70 p-4.5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-amber-400" /> 통신 프로토콜 선택
            </span>
            <span className="text-[10px] text-slate-500 font-mono">하드웨어 제어</span>
          </div>

          {/* Protocol Switcher Buttons */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800">
            <button
              onClick={() => setProtocol('usart')}
              className={`py-1.5 text-xs font-bold rounded-lg transition ${
                protocol === 'usart'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              USART (UART)
            </button>
            <button
              onClick={() => setProtocol('spi')}
              className={`py-1.5 text-xs font-bold rounded-lg transition ${
                protocol === 'spi'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              SPI 버스
            </button>
            <button
              onClick={() => setProtocol('i2c')}
              className={`py-1.5 text-xs font-bold rounded-lg transition ${
                protocol === 'i2c'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              I2C (TWI)
            </button>
          </div>

          {/* Conditional Protocol Param Form */}
          {protocol === 'usart' && (
            <div className="space-y-3 pt-1 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">통신 보드레이트 (Baud Rate)</label>
                <select
                  value={baudRate}
                  onChange={(e) => setBaudRate(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono"
                >
                  <option value={9600}>9,600 bps (기본 시리얼)</option>
                  <option value={19200}>19,200 bps</option>
                  <option value={38400}>38,400 bps</option>
                  <option value={57600}>57,600 bps</option>
                  <option value={115200}>115,200 bps (고속 표준)</option>
                  <option value={230400}>230,400 bps (초고속)</option>
                  <option value={500000}>500,000 bps (0.5 Mbps)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">데이터 비트</label>
                  <select
                    value={dataBits}
                    onChange={(e) => setDataBits(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono"
                  >
                    <option value={8}>8 bits</option>
                    <option value={7}>7 bits</option>
                    <option value={9}>9 bits</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">패리티 비트</label>
                  <select
                    value={parity}
                    onChange={(e) => setParity(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono"
                  >
                    <option value="none">없음 (N)</option>
                    <option value="even">짝수 (E)</option>
                    <option value="odd">홀수 (O)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">스톱 비트</label>
                  <select
                    value={stopBits}
                    onChange={(e) => setStopBits(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white font-mono"
                  >
                    <option value={1}>1 bit</option>
                    <option value={2}>2 bits</option>
                  </select>
                </div>
              </div>
              <div className="text-[11px] text-amber-400/90 font-mono bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                • 프레임 구조: 1 Start + {dataBits} Data + {parity !== 'none' ? '1 Parity' : '0 Parity'} + {stopBits} Stop = {1 + dataBits + (parity !== 'none' ? 1 : 0) + stopBits} bits/바이트
              </div>
            </div>
          )}

          {protocol === 'spi' && (
            <div className="space-y-3 pt-1 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">SPI SCK 클럭 분주비 (SPCR / SPSR)</label>
                <select
                  value={spiPrescaler}
                  onChange={(e) => setSpiPrescaler(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono"
                >
                  <option value={2}>F_CPU / 2 = {(fcpu / 2 / 1e6).toFixed(1)} MHz (SPI2X 2배속)</option>
                  <option value={4}>F_CPU / 4 = {(fcpu / 4 / 1e6).toFixed(1)} MHz (표준 4MHz)</option>
                  <option value={8}>F_CPU / 8 = {(fcpu / 8 / 1e6).toFixed(1)} MHz</option>
                  <option value={16}>F_CPU / 16 = {(fcpu / 16 / 1e6).toFixed(1)} MHz (1.0MHz)</option>
                  <option value={32}>F_CPU / 32 = {(fcpu / 32 / 1e6).toFixed(1)} MHz</option>
                  <option value={64}>F_CPU / 64 = {(fcpu / 64 / 1e6).toFixed(1)} MHz (250kHz)</option>
                  <option value={128}>F_CPU / 128 = {(fcpu / 128 / 1e6).toFixed(1)} MHz (125kHz)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  바이트 간 소프트웨어 인터벌 / SS 지연 ({spiByteGapUs} µs)
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.25"
                  value={spiByteGapUs}
                  onChange={(e) => setSpiByteGapUs(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="text-[11px] text-cyan-400/90 font-mono bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                • SPI 클럭 주기: {(1 / (fcpu / spiPrescaler) * 1e9).toFixed(1)} ns / 1 bit
              </div>
            </div>
          )}

          {protocol === 'i2c' && (
            <div className="space-y-3 pt-1 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">I2C (TWI) 버스 통신 속도</label>
                <select
                  value={i2cSpeed}
                  onChange={(e) => setI2cSpeed(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono"
                >
                  <option value={100000}>100 kHz (표준 Standard Mode)</option>
                  <option value={400000}>400 kHz (고속 Fast Mode)</option>
                  <option value={1000000}>1.0 MHz (Fast Mode Plus)</option>
                  <option value={50000}>50 kHz (저속 노이즈 환경)</option>
                </select>
              </div>

              <div className="text-[11px] text-emerald-400/90 font-mono bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                • I2C 패킷 구조: START(1b) + 7bit주소+W(8b) + ACK(1b) + 데이터별(8b+ACK 1b) + STOP(1b)
              </div>
            </div>
          )}
        </div>

        {/* Middle Col: Payload Input & Quick Presets */}
        <div className="bg-slate-950/70 p-4.5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-indigo-400" /> 전송 페이로드 (Data Payload)
            </span>
            <span className="text-xs font-mono font-bold text-amber-400">
              {effectiveBytes} Bytes
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setPayloadType('text')}
              className={`flex-1 py-1 text-xs rounded-lg font-semibold transition border ${
                payloadType === 'text'
                  ? 'bg-indigo-500 text-white border-indigo-400 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              텍스트 문자열
            </button>
            <button
              onClick={() => setPayloadType('bytes')}
              className={`flex-1 py-1 text-xs rounded-lg font-semibold transition border ${
                payloadType === 'bytes'
                  ? 'bg-indigo-500 text-white border-indigo-400 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              바이트 크기 직접 지정
            </button>
          </div>

          {payloadType === 'text' ? (
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">송신 문자열 입력</label>
              <textarea
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                rows={3}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                placeholder="전송할 아스키 문자열을 입력하세요..."
              />
            </div>
          ) : (
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>데이터 바이트 수</span>
                <span className="font-mono text-white font-bold">{byteLength} Bytes</span>
              </div>
              <input
                type="range"
                min="1"
                max="256"
                value={byteLength}
                onChange={(e) => setByteLength(Number(e.target.value))}
                className="w-full accent-indigo-400"
              />
              <div className="flex gap-1.5 mt-2 flex-wrap text-[10px] font-mono">
                {[1, 8, 16, 32, 64, 128, 256].map((b) => (
                  <button
                    key={b}
                    onClick={() => setByteLength(b)}
                    className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800"
                  >
                    {b}B
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Payload Preset Buttons */}
          <div className="pt-2 border-t border-slate-800/80">
            <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">실전 패킷 프리셋:</span>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <button
                onClick={() => {
                  setPayloadType('text');
                  setPayloadText('$GPGGA,123519,4807.038,N*47');
                }}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800"
              >
                🛰️ GPS NMEA 문장 (28B)
              </button>
              <button
                onClick={() => {
                  setPayloadType('text');
                  setPayloadText('{"temp":24.5,"hum":58}');
                }}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800"
              >
                🌡️ IoT JSON 센서 (22B)
              </button>
              <button
                onClick={() => {
                  setPayloadType('bytes');
                  setByteLength(64);
                }}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800"
              >
                📦 EEPROM 64B 페이지 쓰기
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: Calculated Delay & Throughput KPIs */}
        <div className="bg-slate-950/70 p-4.5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-3">
          <div className="border-b border-slate-800 pb-2.5 flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" /> 실시간 계산된 전송 지연
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-mono">
              F_CPU {(fcpu / 1e6).toFixed(1)}MHz
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">총 전송 지연 (Latency)</span>
              <span className="text-lg font-black text-white font-mono">
                {timing.totalDurationMs < 1
                  ? `${timing.totalDurationUs.toFixed(1)} µs`
                  : `${timing.totalDurationMs.toFixed(3)} ms`}
              </span>
              <span className="text-[10px] text-emerald-400 font-mono block mt-0.5">
                {timing.cpuCycles.toLocaleString()} CPU 클럭
              </span>
            </div>

            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">실효 전송률 (Throughput)</span>
              <span className="text-lg font-black text-cyan-400 font-mono">
                {timing.throughputKBps < 1000
                  ? `${timing.throughputKBps.toFixed(2)} KB/s`
                  : `${(timing.throughputKBps / 1024).toFixed(2)} MB/s`}
              </span>
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                순수 페이로드 기준
              </span>
            </div>

            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">1비트 전송 소요 시간</span>
              <span className="text-sm font-bold text-white font-mono">
                {timing.bitDurationUs < 1
                  ? `${(timing.bitDurationUs * 1000).toFixed(1)} ns`
                  : `${timing.bitDurationUs.toFixed(2)} µs`}
              </span>
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                1/{protocol === 'usart' ? baudRate : protocol === 'i2c' ? i2cSpeed : fcpu / spiPrescaler} 초
              </span>
            </div>

            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block mb-0.5">프로토콜 오버헤드 비율</span>
              <span className="text-sm font-bold text-amber-400 font-mono">
                {timing.overheadPercentage.toFixed(1)} %
              </span>
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                {protocol === 'usart' ? 'Start/Stop 비트 비중' : protocol === 'i2c' ? 'ACK 및 주소 헤더' : 'CS 딜레이'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Live Animation & Timeline Progress Bar */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePlayPause}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition shadow-md ${
                isPlaying
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? '일시 정지' : '전송 시뮬레이션 시작'}</span>
            </button>
            <button
              onClick={handleReset}
              className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition"
              title="처음으로 리셋"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 text-xs text-slate-400 font-mono">
              <span>속도:</span>
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setSimSpeed(s)}
                  className={`px-1.5 py-0.5 rounded text-[11px] ${
                    simSpeed === s ? 'bg-amber-500 text-slate-950 font-bold' : 'hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="text-right text-xs font-mono">
            <span className="text-slate-400 mr-2">진행률:</span>
            <span className="text-white font-bold">{Math.round(simProgress * 100)}%</span>
            <span className="text-slate-500 mx-2">|</span>
            <span className="text-amber-400 font-bold">
              {currentTransferredBytes} / {effectiveBytes} Bytes 전송 완료
            </span>
          </div>
        </div>

        {/* Animated Visual Bus Pipe */}
        <div className="relative bg-slate-900 h-8 rounded-xl border border-slate-800 overflow-hidden flex items-center">
          {/* Progress fill */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-amber-500/20 via-cyan-500/30 to-emerald-500/40 border-r-2 border-amber-400 transition-all duration-75"
            style={{ width: `${simProgress * 100}%` }}
          />

          {/* TX Serial Packet Capsule flying */}
          <div
            className="absolute top-1 bottom-1 flex items-center gap-1.5 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black font-mono text-[10px] shadow-lg shadow-amber-500/40 -translate-x-1/2 transition-all duration-75"
            style={{ left: `${Math.max(5, Math.min(95, simProgress * 100))}%` }}
          >
            <Zap className="w-3 h-3 animate-pulse" />
            <span>Tx Packet [{currentTransferredBytes}B]</span>
          </div>
        </div>
      </div>

      {/* 1 Byte Signal Waveform Visualizer (Hardware Logic Analyzer) */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {protocol.toUpperCase()} 신호 레벨 로직 애널라이저 파형 (1바이트 프레임 샘플)
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            샘플 데이터: 0x41 ('A') LSB First
          </span>
        </div>

        {/* Waveform Canvas / SVG Container */}
        <div className="overflow-x-auto bg-slate-900/90 p-4 rounded-xl border border-slate-800/80 custom-scrollbar">
          <div className="min-w-[640px]">
            {/* Bit Labels */}
            <div className="grid grid-flow-col auto-cols-fr gap-1 text-center font-mono text-[10px] mb-2 text-slate-400">
              {waveformBits.map((b, idx) => (
                <div
                  key={idx}
                  className={`p-1 rounded ${
                    b.type === 'start'
                      ? 'bg-rose-500/20 text-rose-300 font-bold'
                      : b.type === 'stop'
                      ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                      : b.type === 'parity'
                      ? 'bg-purple-500/20 text-purple-300'
                      : b.type === 'idle'
                      ? 'bg-slate-800/40 text-slate-500'
                      : 'bg-amber-500/10 text-amber-300'
                  }`}
                >
                  {b.label}
                </div>
              ))}
            </div>

            {/* Square Digital Waveform Path */}
            <div className="relative h-16 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center px-2">
              <svg className="w-full h-12" preserveAspectRatio="none" viewBox="0 0 1000 60">
                {/* Horizontal reference lines */}
                <line x1="0" y1="12" x2="1000" y2="12" stroke="#334155" strokeDasharray="3 3" />
                <line x1="0" y1="48" x2="1000" y2="48" stroke="#334155" strokeDasharray="3 3" />

                {/* Draw rectangular square wave pulses */}
                {(() => {
                  const segWidth = 1000 / waveformBits.length;
                  let pathD = '';

                  waveformBits.forEach((bit, idx) => {
                    const xStart = idx * segWidth;
                    const xEnd = (idx + 1) * segWidth;
                    const y = bit.level === 1 ? 12 : 48; // High = 12, Low = 48

                    if (idx === 0) {
                      pathD += `M ${xStart} ${y} L ${xEnd} ${y}`;
                    } else {
                      // Transition edge from previous level
                      pathD += ` L ${xStart} ${y} L ${xEnd} ${y}`;
                    }
                  });

                  return (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })()}
              </svg>
            </div>

            {/* Voltage levels labels */}
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1.5 px-2">
              <span>HIGH (VCC = 5V / 3.3V) : 비트 1</span>
              <span>1비트 폭: {timing.bitDurationUs.toFixed(2)} µs</span>
              <span>LOW (GND = 0V) : 비트 0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Protocol Cross-Comparison Latency Bar Chart */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white">
              동일 페이로드 ({effectiveBytes} Bytes) 기준 프로토콜별 전송 소요 시간 정밀 비교
            </h4>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">가로 막대가 짧을수록 고속 전송</span>
        </div>

        <div className="space-y-3">
          {comparisonProtocols.map((p) => (
            <div key={p.id} className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300 font-semibold">{p.name}</span>
                <span className={`font-bold ${p.textColor}`}>{p.timeFormatted}</span>
              </div>
              <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800 flex">
                <div
                  className={`h-full bg-gradient-to-r ${p.color} transition-all duration-300 rounded-full`}
                  style={{ width: `${Math.max(2, p.ratio)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs text-slate-400 leading-relaxed">
          💡 <span className="text-slate-200 font-bold">임베디드 엔지니어링 팁:</span> SPI 버스는 최대 8MHz 클럭으로 대용량 플래시 메모리/디스플레이에 가장 압도적인 전송 속도를 제공합니다.
          반면 USART는 비동기 선로 2선(TX/RX)만으로 장거리 전송이 유리하며, I2C는 주소 체계 덕분에 센서 10여 개를 2선(SDA/SCL)에 병렬 연결할 때 가장 효율적입니다.
        </div>
      </div>
    </div>
  );
};
