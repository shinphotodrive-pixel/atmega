import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Radio,
  Cpu,
  Zap,
  Sliders,
  Copy,
  Check,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
  Terminal,
  Activity
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type ProtocolType = 'usart' | 'i2c' | 'spi';

export const InterfaceProtocolConfigurator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Active Protocol Tab
  const [activeProtocol, setActiveProtocol] = useState<ProtocolType>('usart');

  // Global Clock Frequency
  const [clockMhz, setClockMhz] = useState<number>(() => {
    return selectedMCU === 'atmega328p' ? 16 : 16;
  });

  // -------------------------------------------------------------
  // 1. USART States
  // -------------------------------------------------------------
  const [usartPort, setUsartPort] = useState<number>(0);
  const [targetBaud, setTargetBaud] = useState<number>(115200);
  const [customBaudInput, setCustomBaudInput] = useState<string>('115200');
  const [useU2x, setUseU2x] = useState<boolean>(true); // Default to U2X for 115200 accuracy
  const [dataBits, setDataBits] = useState<number>(8);
  const [parity, setParity] = useState<'None' | 'Even' | 'Odd'>('None');
  const [stopBits, setStopBits] = useState<number>(1);

  // Available USART ports for current MCU
  const availableUsartPorts = useMemo(() => {
    if (selectedMCU === 'atmega640') return [0, 1, 2, 3];
    if (selectedMCU === 'atmega128') return [0, 1];
    return [0]; // ATmega328P has USART0
  }, [selectedMCU]);

  // Fallback if port exceeds MCU
  const safeUsartPort = availableUsartPorts.includes(usartPort) ? usartPort : 0;

  // -------------------------------------------------------------
  // 2. I2C (TWI) States
  // -------------------------------------------------------------
  const [targetI2cKhz, setTargetI2cKhz] = useState<number>(100); // 100 kHz standard, 400 kHz fast
  const [customI2cInput, setCustomI2cInput] = useState<string>('100');
  const [i2cPrescalerPower, setI2cPrescalerPower] = useState<number>(0); // 0 -> 1, 1 -> 4, 2 -> 16, 3 -> 64

  // -------------------------------------------------------------
  // 3. SPI States
  // -------------------------------------------------------------
  const [spiDivider, setSpiDivider] = useState<number>(4); // 2, 4, 8, 16, 32, 64, 128
  const [spiMode, setSpiMode] = useState<number>(0); // Mode 0, 1, 2, 3
  const [spiDataOrder, setSpiDataOrder] = useState<'MSB' | 'LSB'>('MSB');
  const [isSpiMaster, setIsSpiMaster] = useState<boolean>(true);

  // Copy state
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const fCpuHz = clockMhz * 1000000;

  // -------------------------------------------------------------
  // USART Math
  // -------------------------------------------------------------
  const usartCalculations = useMemo(() => {
    const divisor = useU2x ? 8 : 16;
    const rawUbbr = fCpuHz / (divisor * targetBaud) - 1;
    const ubbr = Math.max(0, Math.min(4095, Math.round(rawUbbr)));
    const actualBaud = fCpuHz / (divisor * (ubbr + 1));
    const errorPercent = ((actualBaud - targetBaud) / targetBaud) * 100;
    const ubbrH = (ubbr >> 8) & 0x0F;
    const ubbrL = ubbr & 0xFF;

    // Safety status
    const absErr = Math.abs(errorPercent);
    const status: 'safe' | 'marginal' | 'hazardous' =
      absErr <= 1.0 ? 'safe' : absErr <= 2.0 ? 'marginal' : 'hazardous';

    return {
      rawUbbr,
      ubbr,
      ubbrH,
      ubbrL,
      actualBaud: Math.round(actualBaud),
      errorPercent: +errorPercent.toFixed(2),
      status
    };
  }, [fCpuHz, targetBaud, useU2x]);

  // -------------------------------------------------------------
  // I2C (TWI) Math: SCL = F_CPU / (16 + 2 * TWBR * 4^TWPS)
  // -------------------------------------------------------------
  const i2cCalculations = useMemo(() => {
    const targetHz = targetI2cKhz * 1000;
    const prescalerFactor = Math.pow(4, i2cPrescalerPower); // 1, 4, 16, 64
    const rawTwbr = (fCpuHz / targetHz - 16) / (2 * prescalerFactor);
    const twbr = Math.max(0, Math.min(255, Math.round(rawTwbr)));
    const actualHz = fCpuHz / (16 + 2 * twbr * prescalerFactor);
    const actualKhz = +(actualHz / 1000).toFixed(2);
    const errorPercent = ((actualHz - targetHz) / targetHz) * 100;

    const isTwbrValid = twbr >= 10 && twbr <= 255;
    const isOverclocked = actualKhz > 400; // ATmega TWI limit is 400kHz

    // Pull-up resistor recommendation
    const recommendedPullUp =
      actualKhz > 100
        ? '2.2 kΩ ~ 3.3 kΩ (고속 Fast-mode 상승시간 충족)'
        : '4.7 kΩ ~ 10 kΩ (표준 100kHz 모드)';

    return {
      rawTwbr,
      twbr,
      twpsBits: i2cPrescalerPower,
      prescalerFactor,
      actualKhz,
      errorPercent: +errorPercent.toFixed(2),
      isTwbrValid,
      isOverclocked,
      recommendedPullUp
    };
  }, [fCpuHz, targetI2cKhz, i2cPrescalerPower]);

  // -------------------------------------------------------------
  // SPI Math: SCK = F_CPU / Divisor
  // -------------------------------------------------------------
  const spiCalculations = useMemo(() => {
    let spr1 = 0;
    let spr0 = 0;
    let spi2x = 0;

    switch (spiDivider) {
      case 2:
        spr1 = 0; spr0 = 0; spi2x = 1;
        break;
      case 4:
        spr1 = 0; spr0 = 0; spi2x = 0;
        break;
      case 8:
        spr1 = 0; spr0 = 1; spi2x = 1;
        break;
      case 16:
        spr1 = 0; spr0 = 1; spi2x = 0;
        break;
      case 32:
        spr1 = 1; spr0 = 0; spi2x = 1;
        break;
      case 64:
        spr1 = 1; spr0 = 0; spi2x = 0;
        break;
      case 128:
        spr1 = 1; spr0 = 1; spi2x = 0;
        break;
      default:
        spr1 = 0; spr0 = 0; spi2x = 0;
    }

    const sckHz = fCpuHz / spiDivider;
    const sckKhz = +(sckHz / 1000).toFixed(1);
    const byteTimeUs = +((8 / sckHz) * 1000000).toFixed(2);
    const maxThroughputKbPerSec = +((sckHz / 8) / 1024).toFixed(1);

    // CPOL & CPHA
    const cpol = spiMode === 2 || spiMode === 3 ? 1 : 0;
    const cpha = spiMode === 1 || spiMode === 3 ? 1 : 0;

    return {
      spr1,
      spr0,
      spi2x,
      cpol,
      cpha,
      sckHz,
      sckKhz,
      byteTimeUs,
      maxThroughputKbPerSec
    };
  }, [fCpuHz, spiDivider, spiMode]);

  // -------------------------------------------------------------
  // C Code Generation for Each Protocol
  // -------------------------------------------------------------
  const generatedCode = useMemo(() => {
    if (activeProtocol === 'usart') {
      const p = safeUsartPort;
      const isMega = selectedMCU !== 'atmega328p' || p > 0;
      const u2xBit = isMega ? `U2X${p}` : 'U2X0';
      const ucsraReg = isMega ? `UCSR${p}A` : 'UCSR0A';
      const ucsrbReg = isMega ? `UCSR${p}B` : 'UCSR0B';
      const ucsrcReg = isMega ? `UCSR${p}C` : 'UCSR0C';
      const ubrrhReg = isMega ? `UBRR${p}H` : 'UBRR0H';
      const ubrrlReg = isMega ? `UBRR${p}L` : 'UBRR0L';
      const udrReg = isMega ? `UDR${p}` : 'UDR0';
      const rxenBit = isMega ? `RXEN${p}` : 'RXEN0';
      const txenBit = isMega ? `TXEN${p}` : 'TXEN0';
      const ucsz0Bit = isMega ? `UCSZ${p}0` : 'UCSZ00';
      const ucsz1Bit = isMega ? `UCSZ${p}1` : 'UCSZ01';

      return `// ============================================================================
// ${currentProfile.name} - USART${p} Initialization Code (${targetBaud} bps @ ${clockMhz}MHz)
// Actual Baud: ${usartCalculations.actualBaud} bps | Error: ${usartCalculations.errorPercent}%
// ============================================================================
#include <avr/io.h>

void usart${p}_init(void) {
    // 1. Set Baud Rate Registers (UBRR = ${usartCalculations.ubbr})
    ${ubrrhReg} = (uint8_t)(${usartCalculations.ubbr} >> 8);
    ${ubrrlReg} = (uint8_t)(${usartCalculations.ubbr});

    // 2. Configure Transmission Speed (${useU2x ? 'Double Speed U2X=1' : 'Normal Speed U2X=0'})
    ${ucsraReg} = ${useU2x ? `(1 << ${u2xBit})` : '0x00'};

    // 3. Enable Receiver and Transmitter
    ${ucsrbReg} = (1 << ${rxenBit}) | (1 << ${txenBit});

    // 4. Set Frame Format: 8 Data Bits, 1 Stop Bit, No Parity (8N1)
    ${ucsrcReg} = (1 << ${ucsz1Bit}) | (1 << ${ucsz0Bit});
}

void usart${p}_transmit(uint8_t data) {
    // Wait for empty transmit buffer
    while (!(${ucsraReg} & (1 << UDRE${p})));
    // Put data into buffer, sends the data
    ${udrReg} = data;
}`;
    }

    if (activeProtocol === 'i2c') {
      return `// ============================================================================
// ${currentProfile.name} - I2C (TWI) Master Initialization Code (${i2cCalculations.actualKhz} kHz @ ${clockMhz}MHz)
// TWBR = ${i2cCalculations.twbr} | Prescaler 4^TWPS = ${i2cCalculations.prescalerFactor} | Error: ${i2cCalculations.errorPercent}%
// ============================================================================
#include <avr/io.h>
#include <util/twi.h>

void i2c_init(void) {
    // 1. Set TWI Bit Rate Register (TWBR = ${i2cCalculations.twbr})
    TWBR = ${i2cCalculations.twbr};

    // 2. Set TWI Status Register Prescaler Bits (TWPS1:0 = ${i2cCalculations.twpsBits})
    TWSR = ${i2cCalculations.twpsBits}; // 4^${i2cCalculations.twpsBits} = ${i2cCalculations.prescalerFactor}

    // 3. Enable TWI Peripheral & Auto Acknowledge
    TWCR = (1 << TWEN) | (1 << TWEA);
}

void i2c_start(void) {
    TWCR = (1 << TWINT) | (1 << TWSTA) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT)));
}

void i2c_stop(void) {
    TWCR = (1 << TWINT) | (1 << TWSTO) | (1 << TWEN);
}`;
    }

    // SPI
    return `// ============================================================================
// ${currentProfile.name} - SPI Master Initialization Code (SCK = ${spiCalculations.sckKhz} kHz @ ${clockMhz}MHz)
// Divisor: F_CPU / ${spiDivider} | Mode: ${spiMode} (CPOL=${spiCalculations.cpol}, CPHA=${spiCalculations.cpha}) | Order: ${spiDataOrder}
// ============================================================================
#include <avr/io.h>

void spi_init_master(void) {
    // 1. Configure Port Directions: MOSI, SCK, SS as Outputs; MISO as Input
    // (${selectedMCU === 'atmega128' ? 'ATmega128 Port B: PB0=SS, PB1=SCK, PB2=MOSI, PB3=MISO' : 'ATmega328P: PB2=SS, PB3=MOSI, PB4=MISO, PB5=SCK'})
    ${
      selectedMCU === 'atmega128'
        ? 'DDRB |= (1 << PB0) | (1 << PB1) | (1 << PB2); // SS, SCK, MOSI Output\n    DDRB &= ~(1 << PB3); // MISO Input'
        : 'DDRB |= (1 << PB2) | (1 << PB3) | (1 << PB5); // SS, MOSI, SCK Output\n    DDRB &= ~(1 << PB4); // MISO Input'
    }

    // 2. Set Double Speed Bit in SPSR (${spiCalculations.spi2x ? 'SPI2X = 1' : 'SPI2X = 0'})
    SPSR = ${spiCalculations.spi2x ? '(1 << SPI2X)' : '0x00'};

    // 3. Enable SPI, Master Mode, Clock Rate & Phase (SPCR)
    SPCR = (1 << SPE) | (1 << MSTR)
         ${spiCalculations.spr1 ? '| (1 << SPR1)' : ''}
         ${spiCalculations.spr0 ? '| (1 << SPR0)' : ''}
         ${spiCalculations.cpol ? '| (1 << CPOL)' : ''}
         ${spiCalculations.cpha ? '| (1 << CPHA)' : ''}
         ${spiDataOrder === 'LSB' ? '| (1 << DORD)' : ''};
}

uint8_t spi_transfer(uint8_t data) {
    SPDR = data;
    while (!(SPSR & (1 << SPIF))); // Wait for transmission complete
    return SPDR;
}`;
  }, [
    activeProtocol,
    currentProfile.name,
    selectedMCU,
    clockMhz,
    safeUsartPort,
    targetBaud,
    useU2x,
    usartCalculations,
    i2cCalculations,
    spiCalculations,
    spiDivider,
    spiMode,
    spiDataOrder
  ]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopiedSection('code');
    confetti({
      particleCount: 30,
      spread: 60,
      origin: { y: 0.2 }
    });
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-2">
            <Radio className="w-3.5 h-3.5" /> Hardware Serial Interface Protocol Configurator
          </div>
          <h3 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Interface Protocol Configurator (통신 프로토콜 레지스터 설정기)</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            <strong>{currentProfile.name}</strong>의 클럭 주파수(F_CPU)를 바탕으로 <strong>USART UBRR 보드레이트 레지스터</strong>,{' '}
            <strong>I2C(TWI) TWBR/TWPS 주파수 설정</strong>, <strong>SPI 분주비(Divisor) 및 모드</strong>를 정밀 계산하고 C 초기화 코드를 자동 생성합니다.
          </p>
        </div>

        {/* Clock Speed Input Controls */}
        <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800 shrink-0">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-mono">시스템 클럭 (F_CPU)</span>
            <span className="text-sm font-bold font-mono text-cyan-400">{clockMhz} MHz</span>
          </div>
          <div className="flex gap-1 border-l border-slate-800 pl-3">
            {[8, 16, 20].map((mhz) => (
              <button
                key={mhz}
                onClick={() => setClockMhz(mhz)}
                className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-all border ${
                  clockMhz === mhz
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                }`}
              >
                {mhz}M
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Protocol Selection Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 p-2 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveProtocol('usart')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeProtocol === 'usart'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>1. USART Baud Rate (UBRR)</span>
          </button>
          <button
            onClick={() => setActiveProtocol('i2c')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeProtocol === 'i2c'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>2. I2C (TWI) SCL Frequency (TWBR)</span>
          </button>
          <button
            onClick={() => setActiveProtocol('spi')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeProtocol === 'spi'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>3. SPI Clock Divisor (SPCR/SPSR)</span>
          </button>
        </div>

        <span className="text-xs text-slate-500 font-mono hidden sm:inline">
          {currentProfile.name} • USART {currentProfile.usart}ch • I2C 1ch • SPI 1ch
        </span>
      </div>

      {/* ============================================================= */}
      {/* 1. USART Configuration Panel */}
      {/* ============================================================= */}
      {activeProtocol === 'usart' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Controls (6 cols) */}
            <div className="lg:col-span-6 space-y-4 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-4 h-4" /> USART 설정 입력
              </h4>

              {/* Port Selector (if MCU has > 1 port) */}
              {availableUsartPorts.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">USART 포트 채널 선택:</label>
                  <div className="flex gap-2">
                    {availableUsartPorts.map((p) => (
                      <button
                        key={p}
                        onClick={() => setUsartPort(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
                          safeUsartPort === p
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                        }`}
                      >
                        USART{p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Baud Rate Presets */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-slate-400 font-semibold">목표 전송 속도 (Target Baud Rate):</label>
                  <span className="font-mono font-bold text-amber-400">{targetBaud.toLocaleString()} bps</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[9600, 19200, 38400, 57600, 115200, 230400, 500000, 1000000].map((b) => (
                    <button
                      key={b}
                      onClick={() => setTargetBaud(b)}
                      className={`px-2 py-1.5 text-xs font-mono rounded-lg transition-all border ${
                        targetBaud === b
                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-500/20'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                      }`}
                    >
                      {b >= 1000000 ? `${b / 1000000}M` : b >= 1000 ? `${b / 1000}k` : b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Double Speed Mode (U2X) Switch */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">배속 전송 모드 (U2Xn = 1)</span>
                  <span className="text-[11px] text-slate-400">
                    분주비를 16에서 8로 축소하여 115,200 bps 등의 고속 보드레이트 오차율 대폭 완화
                  </span>
                </div>
                <button
                  onClick={() => setUseU2x(!useU2x)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    useU2x ? 'bg-amber-500' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                      useU2x ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Frame Format Options */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">데이터 비트</label>
                  <select
                    value={dataBits}
                    onChange={(e) => setDataBits(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-white font-mono"
                  >
                    <option value={8}>8 비트 (기본)</option>
                    <option value={7}>7 비트</option>
                    <option value={9}>9 비트</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">패리티</label>
                  <select
                    value={parity}
                    onChange={(e) => setParity(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-white font-mono"
                  >
                    <option value="None">None (없음)</option>
                    <option value="Even">Even (짝수)</option>
                    <option value="Odd">Odd (홀수)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">정지 비트</label>
                  <select
                    value={stopBits}
                    onChange={(e) => setStopBits(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-white font-mono"
                  >
                    <option value={1}>1 Stop Bit</option>
                    <option value={2}>2 Stop Bits</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Right Calculations KPI (6 cols) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase">산출 UBRR 값</span>
                  <div className="text-2xl font-black font-mono text-amber-400">
                    {usartCalculations.ubbr}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    UBRRH: 0x0{usartCalculations.ubbrH} | UBRRL: 0x{usartCalculations.ubbrL.toString(16).padStart(2, '0').toUpperCase()}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase">실제 달성 속도</span>
                  <div className="text-2xl font-black font-mono text-white">
                    {usartCalculations.actualBaud.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-400">bps</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    목표: {targetBaud.toLocaleString()} bps
                  </div>
                </div>
              </div>

              {/* Error Rate Gauge Card */}
              <div
                className={`p-4 rounded-xl border space-y-2 ${
                  usartCalculations.status === 'safe'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : usartCalculations.status === 'marginal'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                    : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    {usartCalculations.status === 'safe' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    )}
                    보드레이트 오차율: {usartCalculations.errorPercent > 0 ? `+${usartCalculations.errorPercent}` : usartCalculations.errorPercent}%
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-950/80">
                    {usartCalculations.status === 'safe'
                      ? '안정적 (Safe ≤ 1%)'
                      : usartCalculations.status === 'marginal'
                      ? '주의 (1~2%)'
                      : '프레이밍 에러 위험 (>2%)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {usartCalculations.status === 'safe'
                    ? '오차율이 1.0% 이내로 PC 및 타 마이크로컨트롤러와 장시간 데이터 패킷 송수신 시 프레이밍 에러 없이 안정적입니다.'
                    : usartCalculations.status === 'marginal'
                    ? '오차가 1~2% 사이입니다. U2X=1 배속 모드를 켜거나 통신 속도를 조정하는 것을 권장합니다.'
                    : '오차가 2%를 초과하여 비트 샘플링 타이밍이 어긋나 패킷 손실 및 글리치가 발생합니다! U2X 배속을 켜거나 클럭을 변경하세요.'}
                </p>
              </div>

              {/* Formula Callout */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 space-y-1">
                <span className="text-[10px] text-slate-500 font-sans block">계산 수식:</span>
                <div>UBRR = (F_CPU / ({useU2x ? '8' : '16'} × Baud)) - 1</div>
                <div>Actual = F_CPU / ({useU2x ? '8' : '16'} × (UBRR + 1))</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 2. I2C (TWI) Configuration Panel */}
      {/* ============================================================= */}
      {activeProtocol === 'i2c' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Controls (6 cols) */}
            <div className="lg:col-span-6 space-y-4 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
              <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4" /> I2C (TWI) 버스 설정 입력
              </h4>

              {/* Speed Presets */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-slate-400 font-semibold">목표 SCL 버스 주파수:</label>
                  <span className="font-mono font-bold text-cyan-400">{targetI2cKhz} kHz</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[50, 100, 250, 400].map((khz) => (
                    <button
                      key={khz}
                      onClick={() => setTargetI2cKhz(khz)}
                      className={`px-3 py-2 text-xs font-mono rounded-lg transition-all border ${
                        targetI2cKhz === khz
                          ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-md shadow-cyan-500/20'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                      }`}
                    >
                      {khz} kHz
                    </button>
                  ))}
                </div>
              </div>

              {/* Prescaler Selection */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-semibold">
                  TWI 프리스케일러 (TWPS1:0 비트):
                </label>
                <div className="grid grid-cols-4 gap-2 font-mono text-xs">
                  {[0, 1, 2, 3].map((p) => {
                    const factor = Math.pow(4, p);
                    return (
                      <button
                        key={p}
                        onClick={() => setI2cPrescalerPower(p)}
                        className={`p-2 rounded-lg border transition-all text-center ${
                          i2cPrescalerPower === p
                            ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                        }`}
                      >
                        <div>4^{p} ({factor})</div>
                        <div className="text-[10px] opacity-75">TWPS={p}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hardware Pull-up Advice */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-cyan-400" /> 외부 풀업 저항 권장치:
                </span>
                <p className="text-slate-400 leading-relaxed">
                  {i2cCalculations.recommendedPullUp}
                </p>
                <p className="text-[11px] text-slate-500">
                  ※ AVR 내부 풀업(약 20~50kΩ)은 I2C 버스 구동에 너무 약하므로 외장 풀업 저항 장착이 필수입니다.
                </p>
              </div>
            </div>

            {/* Right Calculations (6 cols) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase">연산된 TWBR 값</span>
                  <div className="text-2xl font-black font-mono text-cyan-400">
                    {i2cCalculations.twbr}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    16진수: 0x{i2cCalculations.twbr.toString(16).padStart(2, '0').toUpperCase()}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase">실제 SCL 주파수</span>
                  <div className="text-2xl font-black font-mono text-white">
                    {i2cCalculations.actualKhz}{' '}
                    <span className="text-xs font-normal text-slate-400">kHz</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    오차: {i2cCalculations.errorPercent > 0 ? `+${i2cCalculations.errorPercent}` : i2cCalculations.errorPercent}%
                  </div>
                </div>
              </div>

              {/* Validity Warning */}
              {!i2cCalculations.isTwbrValid ? (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs text-rose-300 space-y-1">
                  <span className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" /> TWBR 유효 범위 벗어남 경고:
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    Atmel 데이터시트 규격 상 마스터 모드에서 <strong>TWBR 값은 최소 10 이상</strong>이어야 합니다. 현재 값({i2cCalculations.twbr})은 불안정하므로 프리스케일러(TWPS)를 변경하세요.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs text-emerald-300 space-y-1">
                  <span className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 정상 범위 (TWBR ≥ 10):
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    선택한 클럭({clockMhz}MHz)에서 완벽히 유효한 I2C 타이밍을 충족합니다.
                  </p>
                </div>
              )}

              {/* Formula */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 space-y-1">
                <span className="text-[10px] text-slate-500 font-sans block">계산 수식:</span>
                <div>SCL_Freq = F_CPU / (16 + 2 × TWBR × 4^TWPS)</div>
                <div>TWBR = ((F_CPU / SCL_Freq) - 16) / (2 × 4^TWPS)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 3. SPI Configuration Panel */}
      {/* ============================================================= */}
      {activeProtocol === 'spi' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Controls (6 cols) */}
            <div className="lg:col-span-6 space-y-4 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4" /> SPI 클럭 분주비 & 모드 설정
              </h4>

              {/* Clock Divisor Selector */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-semibold">
                  SPI 클럭 분주비 (Clock Divisor):
                </label>
                <div className="grid grid-cols-4 gap-2 font-mono text-xs">
                  {[2, 4, 8, 16, 32, 64, 128].map((div) => (
                    <button
                      key={div}
                      onClick={() => setSpiDivider(div)}
                      className={`p-2 rounded-lg border transition-all text-center ${
                        spiDivider === div
                          ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-md shadow-emerald-500/20'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                      }`}
                    >
                      <div>F_CPU / {div}</div>
                      <div className="text-[10px] opacity-75">
                        {+((clockMhz / div) * 1000).toFixed(0)} kHz
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* SPI Mode Selector (0, 1, 2, 3) */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-semibold">
                  SPI 모드 (CPOL / CPHA):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {[
                    { mode: 0, cpol: 0, cpha: 0, label: 'Mode 0 (표준)' },
                    { mode: 1, cpol: 0, cpha: 1, label: 'Mode 1' },
                    { mode: 2, cpol: 1, cpha: 0, label: 'Mode 2' },
                    { mode: 3, cpol: 1, cpha: 1, label: 'Mode 3' }
                  ].map((m) => (
                    <button
                      key={m.mode}
                      onClick={() => setSpiMode(m.mode)}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        spiMode === m.mode
                          ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="font-bold">{m.label}</div>
                      <div className="text-[10px] opacity-75 font-mono">
                        CPOL={m.cpol}, CPHA={m.cpha}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Order (MSB vs LSB) */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-semibold">데이터 비트 순서 (DORD):</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSpiDataOrder('MSB')}
                    className={`px-3 py-1 text-xs rounded-lg font-mono font-bold border transition-all ${
                      spiDataOrder === 'MSB'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    MSB First (표준)
                  </button>
                  <button
                    onClick={() => setSpiDataOrder('LSB')}
                    className={`px-3 py-1 text-xs rounded-lg font-mono font-bold border transition-all ${
                      spiDataOrder === 'LSB'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    LSB First
                  </button>
                </div>
              </div>
            </div>

            {/* Right Calculations (6 cols) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase">산출 SCK 주파수</span>
                  <div className="text-2xl font-black font-mono text-emerald-400">
                    {spiCalculations.sckKhz >= 1000
                      ? `${+(spiCalculations.sckKhz / 1000).toFixed(2)} MHz`
                      : `${spiCalculations.sckKhz} kHz`}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    분주비: 1 / {spiDivider}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase">최대 데이터 대역폭</span>
                  <div className="text-2xl font-black font-mono text-white">
                    {spiCalculations.maxThroughputKbPerSec}{' '}
                    <span className="text-xs font-normal text-slate-400">KB/s</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    1바이트 전송 시간: {spiCalculations.byteTimeUs} µs
                  </div>
                </div>
              </div>

              {/* Register Bit Mapping breakdown */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
                <div className="text-slate-400 font-sans font-bold flex items-center justify-between">
                  <span>하드웨어 레지스터 비트 배치:</span>
                  <span className="text-emerald-400">SPCR & SPSR</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-[9px] text-slate-500 block">SPSR (배속)</span>
                    <span className="font-bold text-white">
                      SPI2X = {spiCalculations.spi2x}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-[9px] text-slate-500 block">SPCR (분주비)</span>
                    <span className="font-bold text-emerald-400">
                      SPR1:0 = {spiCalculations.spr1}{spiCalculations.spr0}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-[9px] text-slate-500 block">SPCR (모드)</span>
                    <span className="font-bold text-white">
                      CPOL={spiCalculations.cpol}, CPHA={spiCalculations.cpha}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generated C Source Code Panel */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-amber-400" />
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                {activeProtocol.toUpperCase()} 프로덕션 C 드라이버 초기화 소스코드
              </h4>
              <p className="text-[11px] text-slate-400">
                선택한 클럭({clockMhz}MHz) 및 레지스터 설정값이 반영된 즉시 컴파일 가능한 C 함수
              </p>
            </div>
          </div>

          <button
            onClick={handleCopyCode}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20 shrink-0"
          >
            {copiedSection === 'code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSection === 'code' ? '복사 완료!' : 'C 소스 복사'}</span>
          </button>
        </div>

        <pre className="p-4 bg-slate-900/90 border border-slate-800 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed max-h-[300px]">
          <code>{generatedCode}</code>
        </pre>
      </div>
    </div>
  );
};
