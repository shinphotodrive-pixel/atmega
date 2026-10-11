import React, { useState, useMemo } from 'react';
import {
  Activity,
  Zap,
  Clock,
  Cpu,
  Layers,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle,
  Sliders,
  Info,
  Code2,
  Sparkles,
  ArrowRight,
  Database,
  Radio,
  RefreshCw,
  Gauge
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

export interface I2cBusProtocolAnalyzerProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type I2cBusSpeedMode = 'standard_100k' | 'fast_400k' | 'fast_plus_1m';

interface CommonDevicePreset {
  name: string;
  address7Bit: number; // 7-bit hex
  desc: string;
  defaultRw: 'W' | 'R';
  samplePayload: number[];
}

const COMMON_I2C_DEVICES: CommonDevicePreset[] = [
  { name: 'OLED SSD1306 (0x3C)', address7Bit: 0x3C, desc: '128x64 그래픽 OLED 디스플레이 제어', defaultRw: 'W', samplePayload: [0x00, 0xAF] },
  { name: 'IMU MPU-6050 (0x68)', address7Bit: 0x68, desc: '6축 자이로/가속도 센서 (PWR_MGMT_1)', defaultRw: 'W', samplePayload: [0x6B, 0x00] },
  { name: 'EEPROM 24C32 (0x50)', address7Bit: 0x50, desc: '32Kbit I2C 직렬 EEPROM (메모리 주소)', defaultRw: 'W', samplePayload: [0x00, 0x10, 0xAA] },
  { name: '온도센서 TMP102 (0x48)', address7Bit: 0x48, desc: '고정밀 디지털 온도 센서 읽기', defaultRw: 'R', samplePayload: [0x00] },
  { name: 'RTC DS3231 (0x68)', address7Bit: 0x68, desc: '초정밀 실시간 시계 (초 레지스터 읽기)', defaultRw: 'R', samplePayload: [0x00] }
];

export const I2cBusProtocolAnalyzer: React.FC<I2cBusProtocolAnalyzerProps> = ({ selectedMCU }) => {
  const profile = MCU_PROFILES[selectedMCU];

  // 1. Bus Speed & F_CPU
  const [speedMode, setSpeedMode] = useState<I2cBusSpeedMode>('standard_100k');
  const [clockMhz, setClockMhz] = useState<number>(16.0);
  const fCpuHz = clockMhz * 1000000;

  // 2. Framing Parameters
  const [conditionStart, setConditionStart] = useState<'START' | 'REP_START'>('START');
  const [slaveAddressHex, setSlaveAddressHex] = useState<string>('3C');
  const [rwBit, setRwBit] = useState<'W' | 'R'>('W'); // 0 for Write, 1 for Read
  const [addressAck, setAddressAck] = useState<boolean>(true); // true = ACK, false = NACK
  const [dataPayloadHex, setDataPayloadHex] = useState<string>('00 AF');
  const [dataAck, setDataAck] = useState<boolean>(true);
  const [includeStop, setIncludeStop] = useState<boolean>(true);

  // 3. Copy Code state
  const [copiedCode, setCopiedCode] = useState(false);

  // Target SCL frequency based on mode
  const targetSclHz = useMemo(() => {
    switch (speedMode) {
      case 'standard_100k':
        return 100000;
      case 'fast_400k':
        return 400000;
      case 'fast_plus_1m':
        return 1000000;
      default:
        return 100000;
    }
  }, [speedMode]);

  // Hardware TWI Pins for selected MCU
  const twiPins = useMemo(() => {
    if (selectedMCU === 'atmega328p') {
      return { scl: 'PC5 (Pin 28 / A5)', sda: 'PC4 (Pin 27 / A4)', twiModule: 'TWI0' };
    }
    if (selectedMCU === 'atmega128') {
      return { scl: 'PD0 (Pin 25)', sda: 'PD1 (Pin 26)', twiModule: 'TWI0' };
    }
    return { scl: 'PD0 (Pin 43)', sda: 'PD1 (Pin 44)', twiModule: 'TWI0' };
  }, [selectedMCU]);

  // Numeric Address
  const slaveAddress7Bit = useMemo(() => {
    const parsed = parseInt(slaveAddressHex.replace(/[^0-9a-fA-F]/g, ''), 16);
    return isNaN(parsed) ? 0x3C : Math.min(0x7F, Math.max(0, parsed));
  }, [slaveAddressHex]);

  // Addressed Byte on bus: (addr << 1) | (rw === 'R' ? 1 : 0)
  const addressByteRaw = useMemo(() => {
    return (slaveAddress7Bit << 1) | (rwBit === 'R' ? 1 : 0);
  }, [slaveAddress7Bit, rwBit]);

  // Parsed Payload Bytes
  const payloadBytes = useMemo<number[]>(() => {
    const parts = dataPayloadHex.trim().split(/[\s,]+/);
    const bytes: number[] = [];
    for (const p of parts) {
      if (!p) continue;
      const b = parseInt(p, 16);
      if (!isNaN(b)) {
        bytes.push(b & 0xFF);
      }
    }
    return bytes.length > 0 ? bytes.slice(0, 4) : [0x00];
  }, [dataPayloadHex]);

  // Calculate TWBR & TWPS for AVR TWI:
  // SCL_freq = F_CPU / (16 + 2 * TWBR * 4^TWPS)
  // TWBR = ((F_CPU / SCL_freq) - 16) / (2 * 4^TWPS)
  const twiCalc = useMemo(() => {
    const prescalers = [
      { twps: 0, div: 1 },
      { twps: 1, div: 4 },
      { twps: 2, div: 16 },
      { twps: 3, div: 64 }
    ];

    let bestTwps = 0;
    let bestTwbr = 0;
    let bestActualScl = 0;
    let bestErrorPercent = 999;
    let isAchievable = false;

    for (const p of prescalers) {
      const rawTwbr = ((fCpuHz / targetSclHz) - 16) / (2 * p.div);
      const roundedTwbr = Math.round(rawTwbr);
      if (roundedTwbr >= 0 && roundedTwbr <= 255) {
        const actualScl = fCpuHz / (16 + 2 * roundedTwbr * p.div);
        const err = (Math.abs(actualScl - targetSclHz) / targetSclHz) * 100;
        if (err < bestErrorPercent) {
          bestErrorPercent = err;
          bestTwps = p.twps;
          bestTwbr = roundedTwbr;
          bestActualScl = actualScl;
          isAchievable = true;
        }
      }
    }

    // NXP Spec Timings (µs)
    const isFast = speedMode === 'fast_400k' || speedMode === 'fast_plus_1m';
    const tLowUs = isFast ? 1.3 : 4.7;
    const tHighUs = isFast ? 0.6 : 4.0;
    const tSuStaUs = isFast ? 0.6 : 4.7;
    const tHdStaUs = isFast ? 0.6 : 4.0;
    const tSuDatUs = isFast ? 0.1 : 0.25;
    const tHdDatUs = 0.0; // Min 0
    const tSuStoUs = isFast ? 0.6 : 4.0;
    const tBufUs = isFast ? 1.3 : 4.7;

    const actualPeriodUs = bestActualScl > 0 ? (1 / bestActualScl) * 1000000 : 10.0;

    return {
      bestTwps,
      bestTwbr,
      bestActualScl,
      bestErrorPercent,
      isAchievable,
      tLowUs,
      tHighUs,
      tSuStaUs,
      tHdStaUs,
      tSuDatUs,
      tHdDatUs,
      tSuStoUs,
      tBufUs,
      actualPeriodUs
    };
  }, [fCpuHz, targetSclHz, speedMode]);

  // Load Device Preset
  const handleSelectPreset = (p: CommonDevicePreset) => {
    setSlaveAddressHex(p.address7Bit.toString(16).toUpperCase());
    setRwBit(p.defaultRw);
    setDataPayloadHex(p.samplePayload.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' '));
  };

  // Generate Bit Stream for the Diagram
  // Sequence:
  // 1. START condition: SCL high, SDA falls
  // 2. Address Byte: 7 Address bits + 1 R/W bit
  // 3. Address ACK: SCL clock 9, SDA low (ACK) or high (NACK)
  // 4. Data Byte 1: 8 data bits + ACK
  // 5. STOP condition: SCL high, SDA rises
  const frameStream = useMemo(() => {
    interface BitCell {
      label: string;
      bitValue: number; // 0 or 1
      isAck?: boolean;
      isSpecial?: boolean;
      phase: string;
    }

    const cells: BitCell[] = [];

    // Address bits: MSB first (bit 6 down to 0)
    for (let i = 6; i >= 0; i--) {
      const bit = (slaveAddress7Bit >> i) & 1;
      cells.push({
        label: `A${i}`,
        bitValue: bit,
        phase: 'Slave Address'
      });
    }

    // R/W bit
    cells.push({
      label: rwBit === 'R' ? 'R(1)' : 'W(0)',
      bitValue: rwBit === 'R' ? 1 : 0,
      phase: 'R/W Bit'
    });

    // Address ACK
    cells.push({
      label: addressAck ? 'ACK' : 'NACK',
      bitValue: addressAck ? 0 : 1,
      isAck: true,
      phase: 'Addr ACK'
    });

    // Data byte 0 (first byte)
    const firstData = payloadBytes[0] || 0x00;
    for (let i = 7; i >= 0; i--) {
      const bit = (firstData >> i) & 1;
      cells.push({
        label: `D${i}`,
        bitValue: bit,
        phase: 'Data Byte'
      });
    }

    // Data ACK
    cells.push({
      label: dataAck ? 'ACK' : 'NACK',
      bitValue: dataAck ? 0 : 1,
      isAck: true,
      phase: 'Data ACK'
    });

    return cells;
  }, [slaveAddress7Bit, rwBit, addressAck, payloadBytes, dataAck]);

  // C Driver Code Snippet
  const generatedCCode = useMemo(() => {
    return `// ============================================================================
// AVR ${profile.name} TWI (I2C) 마스터 통신 C 드라이버
// SCL 목표 주파수: ${(targetSclHz / 1000).toFixed(0)} kHz (실제: ${(twiCalc.bestActualScl / 1000).toFixed(2)} kHz)
// TWBR: ${twiCalc.bestTwbr}, TWPS: ${twiCalc.bestTwps} (4^${twiCalc.bestTwps} = ${Math.pow(4, twiCalc.bestTwps)} 분주)
// 슬레이브 7-bit 주소: 0x${slaveAddress7Bit.toString(16).toUpperCase()} (${rwBit === 'W' ? 'WRITE' : 'READ'})
// ============================================================================
#include <avr/io.h>
#include <util/twi.h>

void i2c_init(void) {
    // 1. 비트레이트 레지스터 설정 (TWBR)
    TWBR = ${twiCalc.bestTwbr};
    // 2. 프리스케일러 비트 설정 (TWSR TWPS1:0)
    TWSR = (TWSR & ~0x03) | ${twiCalc.bestTwps};
}

uint8_t i2c_start(uint8_t address_rw) {
    // START 조건 전송
    TWCR = (1 << TWINT) | (1 << TWSTA) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT))); // 완료 대기

    // START / REP_START 전송 상태 확인
    if ((TW_STATUS != TW_START) && (TW_STATUS != TW_REP_START)) return 0;

    // 슬레이브 주소 + R/W 전송
    TWDR = address_rw;
    TWCR = (1 << TWINT) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT)));

    // ACK 수신 확인 (TW_MT_SLA_ACK: 0x18, TW_MR_SLA_ACK: 0x40)
    if ((TW_STATUS != TW_MT_SLA_ACK) && (TW_STATUS != TW_MR_SLA_ACK)) return 0;
    return 1;
}

void i2c_write(uint8_t data) {
    TWDR = data;
    TWCR = (1 << TWINT) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT)));
}

void i2c_stop(void) {
    // STOP 조건 전송
    TWCR = (1 << TWINT) | (1 << TWSTO) | (1 << TWEN);
}

void send_configured_transaction(void) {
    // 1. START 및 슬레이브 주소 (0x${addressByteRaw.toString(16).padStart(2, '0').toUpperCase()}) 전송
    if (i2c_start(0x${addressByteRaw.toString(16).padStart(2, '0').toUpperCase()})) {
${payloadBytes.map(b => `        i2c_write(0x${b.toString(16).padStart(2, '0').toUpperCase()}); // 데이터 바이트`).join('\n')}
    }
    // 2. STOP 전송
    i2c_stop();
}`;
  }, [profile.name, targetSclHz, twiCalc, slaveAddress7Bit, rwBit, addressByteRaw, payloadBytes]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg font-bold text-white tracking-wide">
                I2C Bus Protocol Analyzer
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-semibold">
                I2C(TWI) 프로토콜 타이밍 & 프레이밍 분석기
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                {profile.fullName} (SCL: {twiPins.scl}, SDA: {twiPins.sda})
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              START/STOP 조건, 7비트 주소 프레이밍, R/W 비트 및 ACK/NACK 상태를 정의하고 표준(100kHz)/고속(400kHz) 모드의 SCL/SDA 신호 정렬 타이밍 요구사항을 자동 계산합니다.
            </p>
          </div>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setSpeedMode('standard_100k')}
            className={`px-3 py-1.5 rounded-lg font-mono font-medium transition-all ${
              speedMode === 'standard_100k'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            표준 모드 (100 kHz)
          </button>
          <button
            onClick={() => setSpeedMode('fast_400k')}
            className={`px-3 py-1.5 rounded-lg font-mono font-medium transition-all ${
              speedMode === 'fast_400k'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            고속 모드 (400 kHz)
          </button>
          <button
            onClick={() => setSpeedMode('fast_plus_1m')}
            className={`px-3 py-1.5 rounded-lg font-mono font-medium transition-all ${
              speedMode === 'fast_plus_1m'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Fast+ (1.0 MHz)
          </button>
        </div>
      </div>

      {/* Preset Devices */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            자주 쓰이는 I2C 센서/디바이스 프리셋
          </span>
          <span className="text-slate-500">원클릭으로 슬레이브 주소와 데이터 프레이밍을 불러옵니다</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {COMMON_I2C_DEVICES.map((d, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectPreset(d)}
              className="text-left p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900 hover:border-slate-700 transition-all text-xs"
            >
              <div className="font-bold text-cyan-300 truncate">{d.name}</div>
              <div className="text-[10px] text-slate-400 truncate mt-0.5">{d.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Timing Metrics & TWBR Auto-Solver Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Actual SCL Frequency */}
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>실제 SCL 주파수</span>
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-cyan-400 font-mono mt-1">
            {(twiCalc.bestActualScl / 1000).toFixed(2)} <span className="text-xs text-slate-400 font-normal">kHz</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            오차: {twiCalc.bestErrorPercent.toFixed(2)}% (주기: {twiCalc.actualPeriodUs.toFixed(2)} µs)
          </div>
        </div>

        {/* TWBR Register Value */}
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>TWBR 레지스터 값</span>
            <Gauge className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-indigo-400 font-mono mt-1">
            {twiCalc.bestTwbr} <span className="text-xs text-slate-400 font-normal">(0x{twiCalc.bestTwbr.toString(16).toUpperCase()})</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            TWPS: {twiCalc.bestTwps} (4^{twiCalc.bestTwps} 분주)
          </div>
        </div>

        {/* Address Byte on Bus */}
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>첫 전송 주소 바이트</span>
            <Database className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 font-mono mt-1">
            0x{addressByteRaw.toString(16).padStart(2, '0').toUpperCase()}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            0b{addressByteRaw.toString(2).padStart(8, '0')} ({rwBit === 'W' ? 'WRITE' : 'READ'})
          </div>
        </div>

        {/* Bus Timing Compliance */}
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>NXP I2C 규격 적합성</span>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
            {twiCalc.isAchievable ? 'PASS' : 'WARN'}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            t_LOW ≥ {twiCalc.tLowUs}µs, t_HIGH ≥ {twiCalc.tHighUs}µs
          </div>
        </div>
      </div>

      {/* Interactive SCL / SDA Bus Protocol Waveform Diagram */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-inner">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white tracking-wide">
              I2C 비트 프레이밍 및 타이밍 파형 (Timing & Framing Waveform)
            </h4>
          </div>
          <div className="text-xs font-mono text-slate-400">
            총 {frameStream.length + 2} 비트 셀 (START + 8비트 주소 + ACK + 8비트 데이터 + ACK + STOP)
          </div>
        </div>

        {/* SVG Waveform Rendering */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 overflow-x-auto">
          <svg className="w-full min-w-[700px] h-44" viewBox="0 0 920 160">
            {/* Background Lines */}
            <line x1="20" y1="50" x2="900" y2="50" stroke="#334155" strokeDasharray="3 3" />
            <line x1="20" y1="110" x2="900" y2="110" stroke="#334155" strokeDasharray="3 3" />

            {/* Labels */}
            <text x="25" y="42" fill="#38bdf8" fontSize="11" fontFamily="monospace" fontWeight="bold">
              SCL (Clock)
            </text>
            <text x="25" y="102" fill="#f59e0b" fontSize="11" fontFamily="monospace" fontWeight="bold">
              SDA (Data)
            </text>

            {/* START condition */}
            {/* START: SCL is High, SDA falls from High to Low */}
            <g>
              <rect x="70" y="10" width="45" height="135" fill="rgba(56, 189, 248, 0.08)" rx="4" />
              {/* SCL stays high during start */}
              <path d="M 70 30 L 115 30" stroke="#38bdf8" strokeWidth="2.5" fill="none" />
              {/* SDA falls */}
              <path d="M 70 85 L 85 85 L 95 125 L 115 125" stroke="#f59e0b" strokeWidth="2.5" fill="none" />
              <text x="75" y="140" fill="#38bdf8" fontSize="9" fontFamily="monospace" fontWeight="bold">
                START
              </text>
            </g>

            {/* Bit Cells */}
            {frameStream.map((bit, idx) => {
              const startX = 120 + idx * 38;
              const cellWidth = 38;
              const midX = startX + cellWidth / 2;

              // SCL Waveform: Low then High then Low
              const sclPath = `M ${startX} 60 L ${startX + 8} 60 L ${startX + 12} 30 L ${startX + 26} 30 L ${startX + 30} 60 L ${startX + cellWidth} 60`;

              // SDA Waveform: Stable during SCL High
              const sdaY = bit.bitValue === 1 ? 85 : 125;
              const sdaPath = `M ${startX} ${sdaY} L ${startX + cellWidth} ${sdaY}`;

              return (
                <g key={idx}>
                  {/* Phase background tint for ACK */}
                  {bit.isAck && (
                    <rect x={startX} y="10" width={cellWidth} height="135" fill="rgba(16, 185, 129, 0.12)" rx="2" />
                  )}
                  {/* SCL */}
                  <path d={sclPath} stroke="#38bdf8" strokeWidth="2" fill="none" />
                  {/* SDA */}
                  <path d={sdaPath} stroke={bit.isAck ? '#10b981' : '#f59e0b'} strokeWidth="2.5" fill="none" />
                  {/* Bit Label */}
                  <text
                    x={midX}
                    y="22"
                    fill={bit.isAck ? '#34d399' : '#e2e8f0'}
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {bit.label}
                  </text>
                  {/* Bit Value */}
                  <text
                    x={midX}
                    y={sdaY > 100 ? 122 : 98}
                    fill={bit.isAck ? '#34d399' : '#f59e0b'}
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {bit.bitValue}
                  </text>
                </g>
              );
            })}

            {/* STOP condition */}
            {includeStop && (
              <g>
                {(() => {
                  const stopX = 120 + frameStream.length * 38 + 5;
                  return (
                    <>
                      <rect x={stopX} y="10" width="45" height="135" fill="rgba(239, 68, 68, 0.08)" rx="4" />
                      {/* SCL stays high */}
                      <path d={`M ${stopX} 30 L ${stopX + 45} 30`} stroke="#38bdf8" strokeWidth="2.5" fill="none" />
                      {/* SDA rises from low to high while SCL is high */}
                      <path
                        d={`M ${stopX} 125 L ${stopX + 15} 125 L ${stopX + 25} 85 L ${stopX + 45} 85`}
                        stroke="#ef4444"
                        strokeWidth="2.5"
                        fill="none"
                      />
                      <text x={stopX + 8} y="140" fill="#ef4444" fontSize="9" fontFamily="monospace" fontWeight="bold">
                        STOP
                      </text>
                    </>
                  );
                })()}
              </g>
            )}
          </svg>
        </div>

        {/* NXP I2C Bus Specification Timing Breakdown Table */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono pt-1">
          <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">t_LOW (SCL Low 시간)</span>
            <span className="text-cyan-300 font-bold">≥ {twiCalc.tLowUs} µs</span>
          </div>
          <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">t_HIGH (SCL High 시간)</span>
            <span className="text-cyan-300 font-bold">≥ {twiCalc.tHighUs} µs</span>
          </div>
          <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">t_SU;STA (START 셋업)</span>
            <span className="text-indigo-300 font-bold">≥ {twiCalc.tSuStaUs} µs</span>
          </div>
          <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">t_SU;DAT (데이터 셋업)</span>
            <span className="text-emerald-300 font-bold">≥ {twiCalc.tSuDatUs} µs</span>
          </div>
        </div>
      </div>

      {/* Configuration Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Framing Configuration */}
        <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white">프레이밍 & 슬레이브 주소 설정</h4>
          </div>

          <div className="space-y-3 text-xs">
            {/* Condition Start */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 font-medium block mb-1">시작 조건 (Condition)</label>
                <select
                  value={conditionStart}
                  onChange={e => setConditionStart(e.target.value as 'START' | 'REP_START')}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono outline-none"
                >
                  <option value="START">START 조건</option>
                  <option value="REP_START">REPEATED START 조건</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">정지 조건 (STOP)</label>
                <select
                  value={includeStop ? 'true' : 'false'}
                  onChange={e => setIncludeStop(e.target.value === 'true')}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono outline-none"
                >
                  <option value="true">포함 (STOP 전송)</option>
                  <option value="false">미포함 (버스 점유 유지)</option>
                </select>
              </div>
            </div>

            {/* 7-Bit Address & R/W */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 font-medium block mb-1">7-Bit 슬레이브 주소 (Hex)</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-slate-500 font-mono">0x</span>
                  <input
                    type="text"
                    value={slaveAddressHex}
                    onChange={e => setSlaveAddressHex(e.target.value)}
                    placeholder="3C"
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono outline-none uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">R/W 비트 상태</label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRwBit('W')}
                    className={`flex-1 py-1.5 rounded-lg font-mono font-bold border transition-all ${
                      rwBit === 'W'
                        ? 'bg-amber-600 text-white border-amber-500 shadow'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    WRITE (0)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRwBit('R')}
                    className={`flex-1 py-1.5 rounded-lg font-mono font-bold border transition-all ${
                      rwBit === 'R'
                        ? 'bg-cyan-600 text-white border-cyan-500 shadow'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    READ (1)
                  </button>
                </div>
              </div>
            </div>

            {/* Data Payload Hex */}
            <div>
              <label className="text-slate-400 font-medium block mb-1">데이터 페이로드 (Data Bytes Hex 공백 구분)</label>
              <input
                type="text"
                value={dataPayloadHex}
                onChange={e => setDataPayloadHex(e.target.value)}
                placeholder="00 AF"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono outline-none uppercase"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                전송 바이트 수: {payloadBytes.length}개 ({payloadBytes.map(b => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`).join(', ')})
              </span>
            </div>

            {/* ACK / NACK Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div>
                <div className="font-semibold text-slate-200">슬레이브 ACK 응답 시뮬레이션</div>
                <div className="text-[10px] text-slate-400">ACK (0) 정상 수신 vs NACK (1) 무응답 검증</div>
              </div>
              <input
                type="checkbox"
                checked={addressAck}
                onChange={e => setAddressAck(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right: Clock & C Source Generator */}
        <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-bold text-white">AVR TWI 하드웨어 C 드라이버</h4>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow transition-all"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? '복사 완료!' : '코드 복사'}
            </button>
          </div>

          <pre className="bg-slate-900/90 text-slate-200 font-mono text-xs p-3.5 rounded-xl border border-slate-800 overflow-x-auto leading-relaxed max-h-60 custom-scrollbar">
            {generatedCCode}
          </pre>
        </div>
      </div>
    </div>
  );
};
