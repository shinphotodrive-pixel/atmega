import React, { useState } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { Radio, Cpu, Copy, Check, Terminal, Zap, ArrowRight } from 'lucide-react';

interface Props {
  selectedMCU: SupportedMCU;
}

export const CommTimingCalculator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Common Clock Input
  const [commFcpu, setCommFcpu] = useState<number>(16000000);
  const [activeCommTab, setActiveCommTab] = useState<'i2c' | 'spi' | 'usart'>('i2c');

  // I2C Parameters
  const [targetI2cSpeedHz, setTargetI2cSpeedHz] = useState<number>(100000); // 100k, 400k, or custom
  const [i2cPrescalerPower, setI2cPrescalerPower] = useState<number>(0); // 0 -> 1, 1 -> 4, 2 -> 16, 3 -> 64
  const [customI2cInput, setCustomI2cInput] = useState<string>('100');

  // SPI Parameters
  const [targetSpiSpeedKhz, setTargetSpiSpeedKhz] = useState<number>(4000); // target kHz
  const [spiDoubleSpeed2X, setSpiDoubleSpeed2X] = useState<boolean>(false); // SPI2X in SPSR
  const [spiMode, setSpiMode] = useState<number>(0); // Mode 0, 1, 2, 3 (CPOL / CPHA)
  const [spiDataOrder, setSpiDataOrder] = useState<'MSB' | 'LSB'>('MSB');

  // USART Parameters
  const [usartTargetBaud, setUsartTargetBaud] = useState<number>(115200);
  const [usartUseU2X, setUsartUseU2X] = useState<boolean>(false);

  // Copy feedback states
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // -------------------------------------------------------------
  // I2C Calculations: SCL = F_CPU / (16 + 2 * TWBR * 4^TWPS)
  // TWBR = ((F_CPU / SCL) - 16) / (2 * 4^TWPS)
  // -------------------------------------------------------------
  const twpsValue = i2cPrescalerPower;
  const twpsFactor = Math.pow(4, twpsValue);
  const rawTwbr = ((commFcpu / targetI2cSpeedHz) - 16) / (2 * twpsFactor);
  const calculatedTwbr = Math.round(rawTwbr);
  const safeTwbr = Math.max(0, Math.min(255, calculatedTwbr));
  const actualI2cSpeedHz = commFcpu / (16 + 2 * safeTwbr * twpsFactor);
  const i2cErrorPercent = ((actualI2cSpeedHz - targetI2cSpeedHz) / targetI2cSpeedHz) * 100;
  const isTwbrOutOfRange = rawTwbr < 0 || rawTwbr > 255;

  // Recommended TWPS Auto-detection
  const findOptimalI2c = () => {
    for (let p = 0; p <= 3; p++) {
      const factor = Math.pow(4, p);
      const twbr = Math.round(((commFcpu / targetI2cSpeedHz) - 16) / (2 * factor));
      if (twbr >= 10 && twbr <= 255) {
        setI2cPrescalerPower(p);
        return;
      }
    }
  };

  // -------------------------------------------------------------
  // SPI Calculations: SCK = F_CPU / Prescaler
  // Prescalers: 2 (SPI2X=1, SPR=00), 4 (SPI2X=0, SPR=00), 8 (SPI2X=1, SPR=01),
  //             16 (SPI2X=0, SPR=01), 32 (SPI2X=1, SPR=10), 64 (SPI2X=0/1), 128 (SPI2X=0, SPR=11)
  // -------------------------------------------------------------
  interface SpiOption {
    sprBits: number; // 0, 1, 2, 3 for SPR1:SPR0
    spi2x: boolean;
    divider: number;
    clockKhz: number;
    errorKhz: number;
  }

  const spiDividers: { sprBits: number; spi2x: boolean; divider: number }[] = [
    { sprBits: 0, spi2x: true, divider: 2 },
    { sprBits: 0, spi2x: false, divider: 4 },
    { sprBits: 1, spi2x: true, divider: 8 },
    { sprBits: 1, spi2x: false, divider: 16 },
    { sprBits: 2, spi2x: true, divider: 32 },
    { sprBits: 2, spi2x: false, divider: 64 },
    { sprBits: 3, spi2x: false, divider: 128 },
  ];

  const spiOptions: SpiOption[] = spiDividers.map((opt) => {
    const clockKhz = (commFcpu / opt.divider) / 1000;
    return {
      ...opt,
      clockKhz,
      errorKhz: Math.abs(clockKhz - targetSpiSpeedKhz)
    };
  });

  // Find closest SPI option
  const optimalSpi = [...spiOptions].sort((a, b) => a.errorKhz - b.errorKhz)[0];

  // -------------------------------------------------------------
  // USART Calculations: UBRR = F_CPU / (Div * Baud) - 1
  // -------------------------------------------------------------
  const usartDivisor = usartUseU2X ? 8 : 16;
  const rawUbrr = Math.round(commFcpu / (usartDivisor * usartTargetBaud) - 1);
  const safeUbrr = Math.max(0, rawUbrr);
  const actualUsartBaud = commFcpu / (usartDivisor * (safeUbrr + 1));
  const usartErrorPercent = ((actualUsartBaud - usartTargetBaud) / usartTargetBaud) * 100;

  // Code Generation
  const generateCode = (): string => {
    if (activeCommTab === 'i2c') {
      const pinInfo =
        selectedMCU === 'atmega328p'
          ? 'PC4 (SDA, Pin 27), PC5 (SCL, Pin 28)'
          : 'PD1 (SDA), PD0 (SCL)';

      return `// ============================================================
// ${currentProfile.name} I2C/TWI 하드웨어 마스터 초기화 C 코드
// F_CPU: ${(commFcpu / 1000000).toFixed(4)} MHz, 목표 SCL: ${(targetI2cSpeedHz / 1000).toFixed(1)} kHz
// 실제 SCL: ${(actualI2cSpeedHz / 1000).toFixed(2)} kHz (오차: ${i2cErrorPercent >= 0 ? '+' : ''}${i2cErrorPercent.toFixed(2)}%)
// 물리 핀: ${pinInfo}
// ============================================================
#include <avr/io.h>

void I2C_Master_Init(void) {
    // 1. 비트 전송률 레지스터(TWBR) 설정
    TWBR = ${safeTwbr}; // 계산값: ${safeTwbr} (0x${safeTwbr.toString(16).padStart(2, '0').toUpperCase()})

    // 2. 프리스케일러(TWPS1:0) 설정 (4^${twpsValue} = ${twpsFactor} 분주)
    TWSR = (TWSR & ~0x03) | ${twpsValue};

    // 3. TWI 하드웨어 활성화 및 ACK 자동 응답 인에이블
    TWCR = (1 << TWEN) | (1 << TWEA);
}

void I2C_Start(void) {
    TWCR = (1 << TWINT) | (1 << TWSTA) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT))); // START 전송 완료 플래그 대기
}

void I2C_Write(uint8_t data) {
    TWDR = data;
    TWCR = (1 << TWINT) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT))); // 데이터 전송 완료 대기
}

void I2C_Stop(void) {
    TWCR = (1 << TWINT) | (1 << TWSTO) | (1 << TWEN);
}`;
    } else if (activeCommTab === 'spi') {
      const ssPin =
        selectedMCU === 'atmega328p' ? 'PB2 (D10)' : 'PB0 (SS)';
      const mosiPin =
        selectedMCU === 'atmega328p' ? 'PB3 (D11)' : 'PB2 (MOSI)';
      const sckPin =
        selectedMCU === 'atmega328p' ? 'PB5 (D13)' : 'PB1 (SCK)';

      return `// ============================================================
// ${currentProfile.name} 하드웨어 SPI 마스터 초기화 C 코드
// F_CPU: ${(commFcpu / 1000000).toFixed(4)} MHz, 목표 SCK: ${targetSpiSpeedKhz} kHz
// 선택 분주비: F_CPU / ${optimalSpi.divider} => 실제 SCK: ${optimalSpi.clockKhz.toFixed(2)} kHz
// SPI 모드: Mode ${spiMode} (${spiMode === 0 || spiMode === 1 ? 'CPOL=0' : 'CPOL=1'}, ${spiMode === 0 || spiMode === 2 ? 'CPHA=0' : 'CPHA=1'}), 순서: ${spiDataOrder}
// 물리 핀: MOSI(${mosiPin}), SCK(${sckPin}), SS(${ssPin})
// ============================================================
#include <avr/io.h>

void SPI_Master_Init(void) {
    // 1. MOSI, SCK, SS 핀을 출력(Output) 방향으로 설정
    // ★ 주의: 마스터 모드 유지 위해 SS 핀은 반드시 출력으로 설정해야 함!
    ${
      selectedMCU === 'atmega328p'
        ? 'DDRB |= (1 << DDB3) | (1 << DDB5) | (1 << DDB2);'
        : 'DDRB |= (1 << DDB2) | (1 << DDB1) | (1 << DDB0);'
    }

    // 2. 2배속 모드(SPI2X) 설정 (${optimalSpi.spi2x ? '활성화' : '비활성화'})
    SPSR = ${optimalSpi.spi2x ? '(1 << SPI2X)' : '0x00'};

    // 3. SPCR 레지스터 제어 (SPE=1, MSTR=1, Prescaler: SPR1:0=${optimalSpi.sprBits})
    SPCR = (1 << SPE) | (1 << MSTR)
         ${spiDataOrder === 'LSB' ? '| (1 << DORD) ' : ''}
         ${spiMode === 2 || spiMode === 3 ? '| (1 << CPOL) ' : ''}
         ${spiMode === 1 || spiMode === 3 ? '| (1 << CPHA) ' : ''}
         ${optimalSpi.sprBits & 1 ? '| (1 << SPR0) ' : ''}
         ${optimalSpi.sprBits & 2 ? '| (1 << SPR1) ' : ''};
}

uint8_t SPI_Transfer(uint8_t data) {
    SPDR = data;
    while (!(SPSR & (1 << SPIF))); // 전송 완료 플래그 폴링 대기
    return SPDR;
}`;
    } else {
      // USART
      const uartName = selectedMCU === 'atmega328p' ? '0' : '0';
      return `// ============================================================
// ${currentProfile.name} USART${uartName} 비동기 통신 타이밍 C 코드
// F_CPU: ${(commFcpu / 1000000).toFixed(4)} MHz, 목표 Baud: ${usartTargetBaud} bps
// 계산 UBRR: ${safeUbrr} (0x${safeUbrr.toString(16).padStart(4, '0').toUpperCase()}), 모드: ${usartUseU2X ? '2배속(U2X=1)' : '표준(1배속)'}
// 실제 Baud: ${actualUsartBaud.toFixed(2)} bps (오차: ${usartErrorPercent >= 0 ? '+' : ''}${usartErrorPercent.toFixed(2)}%)
// ============================================================
#include <avr/io.h>

void USART${uartName}_Init(void) {
    UBRR${uartName}H = (uint8_t)(${safeUbrr} >> 8);
    UBRR${uartName}L = (uint8_t)(${safeUbrr} & 0xFF);
    UCSR${uartName}A = ${usartUseU2X ? `(1 << U2X${uartName})` : '0x00'};
    UCSR${uartName}B = (1 << RXEN${uartName}) | (1 << TXEN${uartName});
    UCSR${uartName}C = (1 << UCSZ${uartName}1) | (1 << UCSZ${uartName}0); // 8비트 데이터, 1스톱비트
}`;
    }
  };

  const copyCodeToClipboard = () => {
    navigator.clipboard.writeText(generateCode());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-lg space-y-6">
      {/* Title & Protocol Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
              <span>{currentProfile.name} 통신 타이밍 계산기 (I2C / SPI / USART)</span>
            </h3>
            <p className="text-xs text-slate-400">
              시스템 클럭(F_CPU)과 목표 전송 속도를 입력받아 최적의 Prescaler와 BRR/UBRR 값을 자동 산출합니다.
            </p>
          </div>
        </div>

        {/* Tab switch for Protocols */}
        <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveCommTab('i2c')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeCommTab === 'i2c'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            I2C / TWI
          </button>
          <button
            onClick={() => setActiveCommTab('spi')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeCommTab === 'spi'
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            SPI 버스
          </button>
          <button
            onClick={() => setActiveCommTab('usart')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeCommTab === 'usart'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            USART 시리얼
          </button>
        </div>
      </div>

      {/* Common Clock Input Row */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-slate-300">공통 시스템 클럭 (F_CPU):</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[16000000, 8000000, 20000000, 11059200, 4000000].map((freq) => (
            <button
              key={freq}
              onClick={() => setCommFcpu(freq)}
              className={`px-2.5 py-1 rounded-lg font-mono border transition ${
                commFcpu === freq
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {(freq / 1000000).toFixed(freq % 1000000 === 0 ? 0 : 4)} MHz
            </button>
          ))}
          <div className="flex items-center gap-1 font-mono text-cyan-400 ml-2">
            <span>현재: <strong>{(commFcpu / 1000000).toFixed(4)} MHz</strong></span>
          </div>
        </div>
      </div>

      {/* TAB 1: I2C (TWI) Timing Calculator */}
      {activeCommTab === 'i2c' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Input 1: Target Speed */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <label className="text-xs text-slate-400 font-bold block">1. 목표 I2C SCL 주파수</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTargetI2cSpeedHz(100000)}
                  className={`p-2 rounded-lg text-xs font-mono font-bold border ${
                    targetI2cSpeedHz === 100000
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  100 kHz (Standard)
                </button>
                <button
                  onClick={() => setTargetI2cSpeedHz(400000)}
                  className={`p-2 rounded-lg text-xs font-mono font-bold border ${
                    targetI2cSpeedHz === 400000
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  400 kHz (Fast)
                </button>
              </div>

              <div className="pt-2">
                <label className="text-[11px] text-slate-500 block mb-1">사용자 직접 입력 (kHz):</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={customI2cInput}
                    onChange={(e) => {
                      setCustomI2cInput(e.target.value);
                      const val = parseFloat(e.target.value);
                      if (val > 0) setTargetI2cSpeedHz(val * 1000);
                    }}
                    placeholder="100"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                  <button
                    onClick={findOptimalI2c}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[11px] shrink-0 border border-slate-700"
                  >
                    최적 분주 자동탐색
                  </button>
                </div>
              </div>
            </div>

            {/* Input 2: Prescaler TWPS */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <label className="text-xs text-slate-400 font-bold block">2. TWSR 프리스케일러 (TWPS1:0)</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { power: 0, div: 1, label: '4^0 = 1 분주' },
                  { power: 1, div: 4, label: '4^1 = 4 분주' },
                  { power: 2, div: 16, label: '4^2 = 16 분주' },
                  { power: 3, div: 64, label: '4^3 = 64 분주' }
                ].map((item) => (
                  <button
                    key={item.power}
                    onClick={() => setI2cPrescalerPower(item.power)}
                    className={`p-2 rounded-lg font-mono border text-left ${
                      i2cPrescalerPower === item.power
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div>{item.label}</div>
                    <span className="text-[10px] text-slate-500">TWPS = {item.power}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Output: Computed Values */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between space-y-2 text-xs">
              <div>
                <span className="font-bold text-slate-400 block mb-2">3. 산출된 레지스터 값</span>
                <div className="space-y-1.5 font-mono">
                  <div className="flex justify-between items-center bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400">TWBR 레지스터:</span>
                    <span className={`font-bold text-sm ${isTwbrOutOfRange ? 'text-rose-400' : 'text-cyan-400'}`}>
                      {safeTwbr} <span className="text-[11px] text-slate-500">(0x{safeTwbr.toString(16).padStart(2, '0').toUpperCase()})</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400">실제 생성 SCL:</span>
                    <span className="font-bold text-white">{(actualI2cSpeedHz / 1000).toFixed(2)} kHz</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400">속도 오차율:</span>
                    <span className={`font-bold ${Math.abs(i2cErrorPercent) > 2 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {i2cErrorPercent >= 0 ? '+' : ''}{i2cErrorPercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              {isTwbrOutOfRange && (
                <div className="text-[11px] text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                  ⚠️ TWBR 값이 0~255 범위를 벗어났습니다. 프리스케일러(TWPS)를 변경하세요.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SPI Timing Calculator */}
      {activeCommTab === 'spi' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Input 1: Target Speed */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <label className="text-xs text-slate-400 font-bold block">1. 목표 SPI SCK 클럭 속도</label>
              <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                {[1000, 2000, 4000, 8000, 500, 250].map((khz) => (
                  <button
                    key={khz}
                    onClick={() => setTargetSpiSpeedKhz(khz)}
                    className={`p-1.5 rounded-lg border text-center ${
                      targetSpiSpeedKhz === khz
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {khz >= 1000 ? `${khz / 1000} MHz` : `${khz} kHz`}
                  </button>
                ))}
              </div>

              <div className="pt-1">
                <label className="text-[11px] text-slate-500 block mb-1">사용자 지정 (kHz):</label>
                <input
                  type="number"
                  value={targetSpiSpeedKhz}
                  onChange={(e) => setTargetSpiSpeedKhz(Math.max(1, parseInt(e.target.value) || 1000))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>

            {/* Input 2: SPI Mode & Format */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
              <label className="text-xs text-slate-400 font-bold block">2. SPI 모드 & 비트 전송 순서</label>

              <div>
                <span className="text-[11px] text-slate-400 block mb-1">클럭 극성/위상 (SPI Mode 0~3):</span>
                <div className="grid grid-cols-2 gap-1.5 font-mono">
                  {[
                    { mode: 0, label: 'Mode 0 (CPOL=0, CPHA=0 - 표준)' },
                    { mode: 1, label: 'Mode 1 (CPOL=0, CPHA=1)' },
                    { mode: 2, label: 'Mode 2 (CPOL=1, CPHA=0)' },
                    { mode: 3, label: 'Mode 3 (CPOL=1, CPHA=1)' }
                  ].map((m) => (
                    <button
                      key={m.mode}
                      onClick={() => setSpiMode(m.mode)}
                      className={`p-1.5 rounded-lg border text-left text-[11px] ${
                        spiMode === m.mode
                          ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setSpiDataOrder('MSB')}
                  className={`flex-1 p-1.5 rounded-lg font-mono border text-center ${
                    spiDataOrder === 'MSB'
                      ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  MSB First (DORD=0)
                </button>
                <button
                  onClick={() => setSpiDataOrder('LSB')}
                  className={`flex-1 p-1.5 rounded-lg font-mono border text-center ${
                    spiDataOrder === 'LSB'
                      ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  LSB First (DORD=1)
                </button>
              </div>
            </div>

            {/* Output: Prescaler Table */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between text-xs space-y-2">
              <div>
                <span className="font-bold text-slate-400 block mb-1">3. 하드웨어 분주비(Prescaler) 대조표</span>
                <div className="space-y-1 font-mono text-[11px] max-h-36 overflow-y-auto custom-scrollbar">
                  {spiOptions.map((opt, i) => {
                    const isBest = opt.divider === optimalSpi.divider && opt.spi2x === optimalSpi.spi2x;
                    return (
                      <div
                        key={i}
                        className={`flex justify-between items-center p-1.5 rounded border ${
                          isBest
                            ? 'bg-indigo-500/20 border-indigo-500/80 text-white font-bold'
                            : 'bg-slate-900 border-slate-800/60 text-slate-400'
                        }`}
                      >
                        <span>
                          F_CPU / {opt.divider} {opt.spi2x ? '(SPI2X=1)' : '(1배속)'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={isBest ? 'text-indigo-300 font-bold' : 'text-slate-300'}>
                            {opt.clockKhz >= 1000 ? `${(opt.clockKhz / 1000).toFixed(2)} MHz` : `${opt.clockKhz.toFixed(0)} kHz`}
                          </span>
                          {isBest && <span className="text-[10px] bg-indigo-500 text-white px-1 rounded">최적</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-indigo-300 text-[11px] font-mono">
                ✓ 추천 설정: <strong>SPCR (SPR1:0={optimalSpi.sprBits})</strong>, <strong>SPSR (SPI2X={optimalSpi.spi2x ? '1' : '0'})</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: USART Timing Calculator */}
      {activeCommTab === 'usart' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <label className="text-xs text-slate-400 font-bold block">1. 목표 보드레이트 (Baud Rate)</label>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {[9600, 19200, 38400, 57600, 115200, 230400].map((b) => (
                  <button
                    key={b}
                    onClick={() => setUsartTargetBaud(b)}
                    className={`p-2 rounded-lg border text-center ${
                      usartTargetBaud === b
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {b.toLocaleString()} bps
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
              <label className="text-xs text-slate-400 font-bold block">2. U2X 2배속 모드 제어</label>
              <label className="flex items-center gap-2 cursor-pointer bg-slate-900 p-3 rounded-lg border border-slate-800 text-slate-200">
                <input
                  type="checkbox"
                  checked={usartUseU2X}
                  onChange={(e) => setUsartUseU2X(e.target.checked)}
                  className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
                />
                <span>U2X (8분주 배속 모드 활성화)</span>
              </label>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                16MHz 클럭에서 115,200bps 통신 시 1배속에서는 오차가 -3.5%로 매우 높지만, U2X 모드를 켜면 오차가 <strong>+2.1%</strong>로 대폭 줄어듭니다.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
              <label className="text-xs text-slate-400 font-bold block">3. 계산된 UBRR 및 오차율</label>
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">UBRR 값:</span>
                <span className="text-amber-400 font-bold text-sm">
                  {safeUbrr} (0x{safeUbrr.toString(16).padStart(4, '0').toUpperCase()})
                </span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">실제 보드레이트:</span>
                <span className="text-white font-bold">{actualUsartBaud.toFixed(2)} bps</span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">보드레이트 오차:</span>
                <span className={`font-bold ${Math.abs(usartErrorPercent) > 2 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {usartErrorPercent >= 0 ? '+' : ''}{usartErrorPercent.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generated C Code & Copy */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span className="font-mono flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            {activeCommTab.toUpperCase()} 하드웨어 초기화 C 코드
          </span>
          <button
            onClick={copyCodeToClipboard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition border border-slate-700"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedCode ? '복사 완료' : '초기화 코드 복사'}
          </button>
        </div>
        <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56 custom-scrollbar">
          {generateCode()}
        </pre>
      </div>
    </div>
  );
};
