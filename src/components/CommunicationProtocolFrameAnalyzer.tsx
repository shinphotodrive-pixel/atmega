import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Activity,
  Radio,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Download,
  Info,
  Sparkles,
  Zap,
  Terminal,
  Cpu,
  Layers,
  ArrowRight,
  Code2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type CommProtocol = 'uart' | 'spi' | 'i2c';

export interface FrameBit {
  index: number;
  label: string;
  role: 'idle' | 'start' | 'data' | 'parity' | 'stop' | 'ack' | 'nack';
  level: 0 | 1;
  timeUs: number;
  isValid: boolean;
  errorDesc?: string;
}

export interface PresetSequence {
  protocol: CommProtocol;
  name: string;
  tag: string;
  desc: string;
  inputHex: string;
  baudRate?: number;
  parity?: 'none' | 'even' | 'odd';
  stopBits?: 1 | 2;
  spiMode?: 0 | 1 | 2 | 3;
  i2cSpeed?: 100 | 400;
  hasError?: boolean;
}

const PRESET_SEQUENCES: PresetSequence[] = [
  {
    protocol: 'uart',
    name: '정상 8N1 센서 데이터 프레임 (PASS)',
    tag: 'UART PASS',
    desc: 'Baud 115200, 8 데이터 비트, No Parity, 1 Stop Bit 정상 프레임',
    inputHex: '55 A0',
    baudRate: 115200,
    parity: 'none',
    stopBits: 1
  },
  {
    protocol: 'uart',
    name: '패리티 비트 노이즈 반전 손상 (PARITY ERROR)',
    tag: 'UART FAIL',
    desc: 'Even Parity 모드에서 전송 노이즈로 패리티 비트가 반전되어 수신 에러 유발',
    inputHex: '3C',
    baudRate: 115200,
    parity: 'even',
    stopBits: 1,
    hasError: true
  },
  {
    protocol: 'uart',
    name: '정지 비트 누락 프레이밍 에러 (FRAMING ERROR)',
    tag: 'UART FAIL',
    desc: '라인 글리치로 인해 정지 비트 위치에서 HIGH가 아닌 LOW가 감지되어 프레이밍 에러 발생',
    inputHex: 'FF',
    baudRate: 115200,
    parity: 'none',
    stopBits: 1,
    hasError: true
  },
  {
    protocol: 'spi',
    name: 'MCP4921 12비트 DAC 전송 (Mode 0, PASS)',
    tag: 'SPI Mode 0',
    desc: 'CPOL=0, CPHA=0 모드로 2바이트 명령 및 DAC 전압 코드 전송',
    inputHex: '30 FF',
    spiMode: 0
  },
  {
    protocol: 'spi',
    name: 'W25Q64 Flash 메모리 Read 명령 (Mode 3, PASS)',
    tag: 'SPI Mode 3',
    desc: 'CPOL=1, CPHA=1 고속 플래시 메모리 식별 바이트 전송',
    inputHex: '03 00 00',
    spiMode: 3
  },
  {
    protocol: 'i2c',
    name: 'AT24C32 EEPROM 바이트 쓰기 (ACK 정상)',
    tag: 'I2C PASS',
    desc: '슬레이브 주소 0x50 + W(0) 전송 후 정상 ACK 수신',
    inputHex: 'A0 00 12',
    i2cSpeed: 100
  },
  {
    protocol: 'i2c',
    name: '슬레이브 주소 불응답 NACK 장애 (NACK ERROR)',
    tag: 'I2C FAIL',
    desc: '존재하지 않는 0x7E 주소 호출로 9번째 클럭에서 NACK(1) 반환',
    inputHex: 'FC 01',
    i2cSpeed: 100,
    hasError: true
  }
];

export const CommunicationProtocolFrameAnalyzer: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Protocol & Parameters State
  const [protocol, setProtocol] = useState<CommProtocol>('uart');
  const [inputHex, setInputHex] = useState<string>('55 A0');
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [parity, setParity] = useState<'none' | 'even' | 'odd'>('none');
  const [stopBits, setStopBits] = useState<1 | 2>(1);
  const [spiMode, setSpiMode] = useState<0 | 1 | 2 | 3>(0);
  const [i2cSpeedKhz, setI2cSpeedKhz] = useState<number>(100);
  const [pullupResistanceKohm, setPullupResistanceKohm] = useState<number>(4.7);
  const [busCapacitancePf, setBusCapacitancePf] = useState<number>(100);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Parse Raw Bytes
  const rawBytes = useMemo<number[]>(() => {
    return inputHex
      .trim()
      .split(/[\s,]+/)
      .map((h) => parseInt(h.replace(/^0x/i, ''), 16))
      .filter((n) => !isNaN(n));
  }, [inputHex]);

  // Frame Decomposition Engine
  const frameAnalysis = useMemo(() => {
    const bits: FrameBit[] = [];
    const errors: string[] = [];

    if (protocol === 'uart') {
      const bitDurationUs = (1 / baudRate) * 1e6;
      let currentTimeUs = 0;

      // Initial Idle Line (1)
      bits.push({ index: 0, label: 'IDLE', role: 'idle', level: 1, timeUs: currentTimeUs, isValid: true });
      currentTimeUs += bitDurationUs;

      rawBytes.forEach((byte, byteIdx) => {
        // Start bit: Always 0
        bits.push({
          index: bits.length,
          label: `START[${byteIdx}]`,
          role: 'start',
          level: 0,
          timeUs: currentTimeUs,
          isValid: true
        });
        currentTimeUs += bitDurationUs;

        // 8 Data Bits (LSB First: D0 to D7)
        let onesCount = 0;
        for (let b = 0; b < 8; b++) {
          const bitVal = ((byte >> b) & 1) as (0 | 1);
          if (bitVal === 1) onesCount++;
          bits.push({
            index: bits.length,
            label: `D${b}`,
            role: 'data',
            level: bitVal,
            timeUs: currentTimeUs,
            isValid: true
          });
          currentTimeUs += bitDurationUs;
        }

        // Parity bit (if configured)
        if (parity !== 'none') {
          let expectedParity = 0;
          if (parity === 'even') {
            expectedParity = (onesCount % 2 === 0) ? 0 : 1;
          } else {
            expectedParity = (onesCount % 2 === 0) ? 1 : 0;
          }

          // Check if simulating error in preset
          const actualParity = (byteIdx === 0 && inputHex.includes('3C')) ? ((expectedParity ^ 1) as 0 | 1) : expectedParity as 0 | 1;
          const isParityValid = actualParity === expectedParity;

          if (!isParityValid) {
            errors.push(`바이트 [${byteIdx}] 0x${byte.toString(16).toUpperCase()}: 패리티 비트 오류 (${parity.toUpperCase()} 기대값 ${expectedParity} != 실제 ${actualParity})`);
          }

          bits.push({
            index: bits.length,
            label: `PARITY`,
            role: 'parity',
            level: actualParity,
            timeUs: currentTimeUs,
            isValid: isParityValid,
            errorDesc: isParityValid ? undefined : '패리티 비트 불일치'
          });
          currentTimeUs += bitDurationUs;
        }

        // Stop bit(s): Always 1
        for (let s = 0; s < stopBits; s++) {
          const actualStop = (byteIdx === 0 && inputHex.includes('FF')) ? 0 : 1;
          const isStopValid = actualStop === 1;

          if (!isStopValid) {
            errors.push(`바이트 [${byteIdx}] 0x${byte.toString(16).toUpperCase()}: 정지 비트 누락 (Framing Error: STOP bit is LOW)`);
          }

          bits.push({
            index: bits.length,
            label: `STOP${stopBits > 1 ? s + 1 : ''}`,
            role: 'stop',
            level: actualStop,
            timeUs: currentTimeUs,
            isValid: isStopValid,
            errorDesc: isStopValid ? undefined : '프레이밍 에러'
          });
          currentTimeUs += bitDurationUs;
        }
      });

      return {
        bits,
        errors,
        totalTimeUs: currentTimeUs,
        totalBytes: rawBytes.length,
        protocolDesc: `UART ${baudRate} bps, 8-Bit, ${parity.toUpperCase()} Parity, ${stopBits} Stop Bit`
      };

    } else if (protocol === 'spi') {
      const spiClkPeriodUs = 1; // 1 MHz nominal
      let currentTimeUs = 0;

      // SS asserts LOW
      bits.push({ index: 0, label: '/SS LOW', role: 'start', level: 0, timeUs: currentTimeUs, isValid: true });
      currentTimeUs += spiClkPeriodUs;

      rawBytes.forEach((byte, byteIdx) => {
        // 8 Bits MSB First
        for (let b = 7; b >= 0; b--) {
          const bitVal = ((byte >> b) & 1) as (0 | 1);
          bits.push({
            index: bits.length,
            label: `MOSI[D${b}]`,
            role: 'data',
            level: bitVal,
            timeUs: currentTimeUs,
            isValid: true
          });
          currentTimeUs += spiClkPeriodUs;
        }
      });

      // SS deasserts HIGH
      bits.push({ index: bits.length, label: '/SS HIGH', role: 'stop', level: 1, timeUs: currentTimeUs, isValid: true });
      currentTimeUs += spiClkPeriodUs;

      return {
        bits,
        errors,
        totalTimeUs: currentTimeUs,
        totalBytes: rawBytes.length,
        protocolDesc: `SPI Mode ${spiMode} (CPOL=${spiMode >= 2 ? 1 : 0}, CPHA=${spiMode % 2 === 1 ? 1 : 0}), MSB First`
      };

    } else {
      // I2C
      const i2cBitUs = (1 / (i2cSpeedKhz * 1000)) * 1e6;
      let currentTimeUs = 0;

      // START condition (SDA falls)
      bits.push({ index: 0, label: 'START', role: 'start', level: 0, timeUs: currentTimeUs, isValid: true });
      currentTimeUs += i2cBitUs;

      rawBytes.forEach((byte, byteIdx) => {
        // 8 Data/Address Bits (MSB First)
        for (let b = 7; b >= 0; b--) {
          const bitVal = ((byte >> b) & 1) as (0 | 1);
          bits.push({
            index: bits.length,
            label: byteIdx === 0 && b === 0 ? 'R/W' : `D${b}`,
            role: 'data',
            level: bitVal,
            timeUs: currentTimeUs,
            isValid: true
          });
          currentTimeUs += i2cBitUs;
        }

        // ACK/NACK (9th clock)
        const isNack = byteIdx === 0 && inputHex.includes('FC');
        const ackLevel = isNack ? 1 : 0;
        const isAckValid = !isNack;

        if (isNack) {
          errors.push(`슬레이브 주소 0x${(byte >> 1).toString(16).toUpperCase()}: 수신 응답 없음 (NACK received - Slave Unreachable)`);
        }

        bits.push({
          index: bits.length,
          label: isNack ? 'NACK' : 'ACK',
          role: isNack ? 'nack' : 'ack',
          level: ackLevel,
          timeUs: currentTimeUs,
          isValid: isAckValid,
          errorDesc: isAckValid ? undefined : '슬레이브 미응답 (NACK)'
        });
        currentTimeUs += i2cBitUs;
      });

      // STOP condition
      bits.push({ index: bits.length, label: 'STOP', role: 'stop', level: 1, timeUs: currentTimeUs, isValid: true });
      currentTimeUs += i2cBitUs;

      // I2C Pull-up Rise Time Check:
      // tr = 0.8473 * R * C
      const riseTimeNs = 0.8473 * (pullupResistanceKohm * 1000) * (busCapacitancePf * 1e-12) * 1e9;
      const maxRiseTimeNs = i2cSpeedKhz === 100 ? 1000 : 300;
      if (riseTimeNs > maxRiseTimeNs) {
        errors.push(`풀업 저항 상승 시간 초과: ${riseTimeNs.toFixed(1)}ns (I2C 규격 상한: ${maxRiseTimeNs}ns) - 신호 왜곡 위험`);
      }

      return {
        bits,
        errors,
        totalTimeUs: currentTimeUs,
        totalBytes: rawBytes.length,
        protocolDesc: `I2C ${i2cSpeedKhz} kHz (풀업: ${pullupResistanceKohm}kΩ, 부하용량: ${busCapacitancePf}pF)`
      };
    }
  }, [
    protocol,
    rawBytes,
    baudRate,
    parity,
    stopBits,
    spiMode,
    i2cSpeedKhz,
    pullupResistanceKohm,
    busCapacitancePf,
    inputHex
  ]);

  // C Driver Template for Protocol
  const generatedDriverCode = useMemo(() => {
    if (protocol === 'uart') {
      return `/**
 * @file   uart_frame_driver.c
 * @target ${currentProfile.name}
 * @brief  UART ${baudRate} bps 8${parity === 'none' ? 'N' : parity === 'even' ? 'E' : 'O'}${stopBits} 초기화 및 프레임 전송 함수
 */
#include <avr/io.h>

void uart_init(void) {
    // 1. 보레이트 설정 (U2X0 2배속 모드)
    uint16_t ubrr = (F_CPU / (8UL * ${baudRate}UL)) - 1;
    UBRR0H = (uint8_t)(ubrr >> 8);
    UBRR0L = (uint8_t)ubrr;
    UCSR0A = (1 << U2X0);

    // 2. 프레임 포맷 설정
    UCSR0C = (1 << UCSZ01) | (1 << UCSZ00) // 8-bit Data
             ${parity === 'even' ? '| (1 << UPM01)' : parity === 'odd' ? '| (1 << UPM01) | (1 << UPM00)' : ''}
             ${stopBits === 2 ? '| (1 << USBS0)' : ''};

    // 3. 송수신 활성화
    UCSR0B = (1 << RXEN0) | (1 << TXEN0);
}

void uart_send_byte(uint8_t data) {
    while (!(UCSR0A & (1 << UDRE0))); // 전송 버퍼 빌 때까지 대기
    UDR0 = data;
}
`;
    } else if (protocol === 'spi') {
      return `/**
 * @file   spi_frame_driver.c
 * @target ${currentProfile.name}
 * @brief  SPI Mode ${spiMode} 마스터 초기화 및 전송 루틴
 */
#include <avr/io.h>

void spi_master_init(void) {
    // MOSI, SCK, /SS 출력 설정
    DDRB |= (1 << PB3) | (1 << PB5) | (1 << PB2);
    PORTB |= (1 << PB2); // /SS High (비활성)

    // SPCR: SPI 활성화, 마스터 모드, 모드 ${spiMode}
    SPCR = (1 << SPE) | (1 << MSTR)
           ${spiMode >= 2 ? '| (1 << CPOL)' : ''}
           ${spiMode % 2 === 1 ? '| (1 << CPHA)' : ''}
           | (1 << SPR0); // f_osc / 16
}

uint8_t spi_transfer(uint8_t data) {
    SPDR = data;
    while (!(SPSR & (1 << SPIF))); // 전송 완료 대기
    return SPDR;
}
`;
    } else {
      return `/**
 * @file   twi_i2c_driver.c
 * @target ${currentProfile.name}
 * @brief  I2C (TWI) ${i2cSpeedKhz} kHz 마스터 전송 루틴
 */
#include <avr/io.h>
#include <util/twi.h>

void i2c_init(void) {
    // SCL 주파수 = F_CPU / (16 + 2 * TWBR * 4^TWPS)
    TWSR = 0; // Prescaler = 1
    TWBR = ((F_CPU / (${i2cSpeedKhz}000UL)) - 16) / 2;
}

void i2c_start(void) {
    TWCR = (1 << TWINT) | (1 << TWSTA) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT)));
}

void i2c_write(uint8_t data) {
    TWDR = data;
    TWCR = (1 << TWINT) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT)));
}

void i2c_stop(void) {
    TWCR = (1 << TWINT) | (1 << TWSTO) | (1 << TWEN);
}
`;
    }
  }, [protocol, currentProfile.name, baudRate, parity, stopBits, spiMode, i2cSpeedKhz]);

  const handleApplyPreset = (preset: PresetSequence) => {
    setProtocol(preset.protocol);
    setInputHex(preset.inputHex);
    if (preset.baudRate) setBaudRate(preset.baudRate);
    if (preset.parity) setParity(preset.parity);
    if (preset.stopBits) setStopBits(preset.stopBits);
    if (preset.spiMode !== undefined) setSpiMode(preset.spiMode);
    if (preset.i2cSpeed) setI2cSpeedKhz(preset.i2cSpeed);

    confetti({ particleCount: 20, spread: 50, origin: { y: 0.7 } });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedDriverCode);
      setCopiedCode(true);
      confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 } });
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {}
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-7 shadow-2xl backdrop-blur">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-400 text-xs font-semibold">
              <Activity className="w-3.5 h-3.5" /> 통신 프로토콜 프레임 분석기 (Protocol Frame Analyzer)
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono uppercase">
              {protocol.toUpperCase()} PROTOCOL
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-violet-950/60 text-violet-300 border border-violet-800/40 text-xs font-mono font-bold">
              {currentProfile.name}
            </span>
            {frameAnalysis.errors.length > 0 ? (
              <span className="px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-300 border border-rose-700/60 text-[11px] font-mono font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                에러 {frameAnalysis.errors.length}건 감지됨
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 text-[11px] font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                프레임 무결성 통과 (PASS)
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            AVR 통신 프로토콜 프레임 분석기 & 타이밍 다이어그램 진단기
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            UART, SPI, I2C 통신 데이터 시퀀스를 입력받아 시작 비트, 페이로드 데이터 비트, 패리티, 정지 비트 및 ACK/NACK 슬롯을 나노초/마이크로초 단위 타이밍 다이어그램으로 분해하고 전송 오류 가능성을 정밀 진단합니다.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-lg shadow-violet-600/20 flex items-center gap-1.5"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? '복사됨!' : 'C 드라이버 복사'}</span>
          </button>
        </div>
      </div>

      {/* Preset Scenarios */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>프로토콜 테스트 시나리오 프리셋 (Presets):</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
          {PRESET_SEQUENCES.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handleApplyPreset(preset)}
              className="p-2.5 rounded-2xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-violet-500/50 text-left transition group"
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                  preset.hasError
                    ? 'bg-rose-950 text-rose-300 border-rose-800/40 font-bold'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-800/40'
                }`}>
                  {preset.tag}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-200 group-hover:text-violet-300 truncate">
                {preset.name}
              </p>
              <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                {preset.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Main Parameters Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 bg-slate-950/50 p-5 rounded-2xl border border-slate-800">
        {/* Protocol Switcher (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            1. 프로토콜 방식 선택 (Protocol)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'uart', label: 'UART (시리얼)', desc: 'Start/Data/Stop' },
              { id: 'spi', label: 'SPI (동기식)', desc: 'SS/SCK/MOSI' },
              { id: 'i2c', label: 'I2C (TWI)', desc: 'SDA/SCL + ACK' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setProtocol(p.id as CommProtocol)}
                className={`p-2.5 rounded-xl border text-left transition ${
                  protocol === p.id
                    ? 'bg-violet-950 text-violet-300 border-violet-500 font-bold shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold truncate">{p.label}</div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>

          {/* Hex Input Sequence */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>전송 바이트 시퀀스 (Hex Bytes)</span>
              <span className="font-mono text-cyan-400 text-[11px]">{rawBytes.length} 바이트</span>
            </label>
            <input
              type="text"
              value={inputHex}
              onChange={(e) => setInputHex(e.target.value)}
              placeholder="예: 55 A0 FF"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:border-violet-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Protocol Specific Controls (8 cols) */}
        <div className="lg:col-span-8 space-y-3">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            2. 하드웨어 물리 파라미터 (Hardware Parameters)
          </label>

          {protocol === 'uart' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">보레이트 (Baud Rate):</label>
                <select
                  value={baudRate}
                  onChange={(e) => setBaudRate(parseInt(e.target.value) || 115200)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-violet-500 focus:outline-none"
                >
                  <option value="9600">9,600 bps (104.17 µs/bit)</option>
                  <option value="19200">19,200 bps (52.08 µs/bit)</option>
                  <option value="38400">38,400 bps (26.04 µs/bit)</option>
                  <option value="57600">57,600 bps (17.36 µs/bit)</option>
                  <option value="115200">115,200 bps (8.68 µs/bit)</option>
                  <option value="250000">250,000 bps (4.00 µs/bit)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">패리티 비트 (Parity):</label>
                <select
                  value={parity}
                  onChange={(e) => setParity(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-violet-500 focus:outline-none"
                >
                  <option value="none">None (8N1 표준)</option>
                  <option value="even">Even (짝수 패리티)</option>
                  <option value="odd">Odd (홀수 패리티)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">정지 비트 (Stop Bits):</label>
                <select
                  value={stopBits}
                  onChange={(e) => setStopBits(parseInt(e.target.value) as 1 | 2)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-violet-500 focus:outline-none"
                >
                  <option value="1">1 Stop Bit</option>
                  <option value="2">2 Stop Bits</option>
                </select>
              </div>
            </div>
          )}

          {protocol === 'spi' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">SPI 모드 (CPOL / CPHA):</label>
                <select
                  value={spiMode}
                  onChange={(e) => setSpiMode(parseInt(e.target.value) as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-violet-500 focus:outline-none"
                >
                  <option value="0">Mode 0 (CPOL=0, CPHA=0: 상승 에지 샘플링)</option>
                  <option value="1">Mode 1 (CPOL=0, CPHA=1: 하강 에지 샘플링)</option>
                  <option value="2">Mode 2 (CPOL=1, CPHA=0: 하강 에지 샘플링)</option>
                  <option value="3">Mode 3 (CPOL=1, CPHA=1: 상승 에지 샘플링)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">전송 비트 순서 (Bit Order):</label>
                <div className="p-2 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
                  MSB First (D7부터 전송, 표준 AVR SPCR 설정)
                </div>
              </div>
            </div>
          )}

          {protocol === 'i2c' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">I2C 클럭 속도:</label>
                <select
                  value={i2cSpeedKhz}
                  onChange={(e) => setI2cSpeedKhz(parseInt(e.target.value) || 100)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-violet-500 focus:outline-none"
                >
                  <option value="100">Standard (100 kHz, 10 µs/bit)</option>
                  <option value="400">Fast Mode (400 kHz, 2.5 µs/bit)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">풀업 저항 (Pull-up):</label>
                <input
                  type="number"
                  step="0.1"
                  value={pullupResistanceKohm}
                  onChange={(e) => setPullupResistanceKohm(parseFloat(e.target.value) || 4.7)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">버스 부하 커패시턴스 (pF):</label>
                <input
                  type="number"
                  value={busCapacitancePf}
                  onChange={(e) => setBusCapacitancePf(parseInt(e.target.value) || 100)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Diagnostics Alerts */}
      {frameAnalysis.errors.length > 0 && (
        <div className="p-4 bg-rose-950/80 border border-rose-800 rounded-2xl space-y-1.5">
          <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>프레임 분석 오류 및 잠재적 통신 장애 감지됨:</span>
          </div>
          <ul className="list-disc list-inside text-[11px] font-mono text-rose-200/90 space-y-0.5">
            {frameAnalysis.errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Interactive Timing Waveform Chart (SVG) */}
      <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
            <Activity className="w-4 h-4 text-violet-400" />
            디지털 로직 신호 타이밍 다이어그램 (Timing Diagram)
          </span>
          <span className="text-slate-400 text-[11px]">
            총 전송 소요 시간: {frameAnalysis.totalTimeUs.toFixed(2)} µs
          </span>
        </div>

        {/* Scrollable Waveform Canvas */}
        <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 overflow-x-auto">
          <div className="min-w-[650px] space-y-2">
            <svg viewBox={`0 0 ${Math.max(650, frameAnalysis.bits.length * 28 + 60)} 90`} className="w-full select-none">
              {/* Grid Lines */}
              <line x1="40" y1="20" x2="1000" y2="20" stroke="#334155" strokeDasharray="2 2" />
              <line x1="40" y1="60" x2="1000" y2="60" stroke="#334155" />

              {/* Y Axis Labels */}
              <text x="5" y="24" fill="#94a3b8" fontSize="9" fontFamily="monospace">HIGH</text>
              <text x="5" y="64" fill="#94a3b8" fontSize="9" fontFamily="monospace">LOW</text>

              {/* Stepped Digital Path */}
              {(() => {
                let pathD = '';
                const startX = 40;
                const bitW = 28;

                frameAnalysis.bits.forEach((b, idx) => {
                  const x1 = startX + idx * bitW;
                  const x2 = x1 + bitW;
                  const y = b.level === 1 ? 20 : 60;

                  if (idx === 0) {
                    pathD += `M ${x1},${y} L ${x2},${y} `;
                  } else {
                    const prevY = frameAnalysis.bits[idx - 1].level === 1 ? 20 : 60;
                    if (prevY !== y) {
                      pathD += `L ${x1},${y} `;
                    }
                    pathD += `L ${x2},${y} `;
                  }
                });

                return (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2.5"
                  />
                );
              })()}

              {/* Bit Boundaries & Labels */}
              {frameAnalysis.bits.map((b, idx) => {
                const x = 40 + idx * 28;
                return (
                  <g key={idx}>
                    <line x1={x} y1="10" x2={x} y2="70" stroke="#1e293b" />
                    {/* Bit Role Label */}
                    <text
                      x={x + 14}
                      y="80"
                      fill={!b.isValid ? '#f43f5e' : b.role === 'start' ? '#38bdf8' : b.role === 'stop' ? '#fbbf24' : '#94a3b8'}
                      fontSize="7.5"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fontWeight={!b.isValid ? 'bold' : 'normal'}
                    >
                      {b.label}
                    </text>
                    {/* Bit Level Number */}
                    <text
                      x={x + 14}
                      y={b.level === 1 ? '16' : '72'}
                      fill={b.level === 1 ? '#34d399' : '#64748b'}
                      fontSize="8"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {b.level}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Frame Bits Dissection Table */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
          <Layers className="w-4 h-4 text-cyan-400" />
          비트 단위 프레임 구조 분해표 (Bit-by-Bit Dissection)
        </span>

        <div className="overflow-x-auto max-h-60 border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2 px-3">비트 순서</th>
                <th className="py-2 px-3">필드 명칭</th>
                <th className="py-2 px-2">역할 (Role)</th>
                <th className="py-2 px-2">논리 레벨</th>
                <th className="py-2 px-3">누적 시간 (µs)</th>
                <th className="py-2 px-3">진단 상태 (Diagnostics)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/60 text-slate-300">
              {frameAnalysis.bits.map((b) => (
                <tr key={b.index} className="hover:bg-slate-800/40">
                  <td className="py-1.5 px-3 font-bold text-slate-400">#{b.index}</td>
                  <td className="py-1.5 px-3 text-white font-bold">{b.label}</td>
                  <td className="py-1.5 px-2 uppercase text-slate-400 text-[10px]">{b.role}</td>
                  <td className="py-1.5 px-2">
                    <span className={`px-1.5 py-0.2 rounded font-bold ${
                      b.level === 1 ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {b.level} ({b.level === 1 ? 'HIGH' : 'LOW'})
                    </span>
                  </td>
                  <td className="py-1.5 px-3 text-cyan-400">{b.timeUs.toFixed(2)} µs</td>
                  <td className="py-1.5 px-3">
                    {b.isValid ? (
                      <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> 정상
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold text-[10px] flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> {b.errorDesc || '오류'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
