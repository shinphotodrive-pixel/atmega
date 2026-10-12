import React, { useState } from 'react';
import { Calculator, Copy, Check, Terminal, ShieldAlert, Cpu } from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { MemoryMapD3Heatmap } from './MemoryMapD3Heatmap';
import { CommTimingCalculator } from './CommTimingCalculator';
import { AdcSamplingNoiseCalculator } from './AdcSamplingNoiseCalculator';
import { AdcNoiseResolutionSimulator } from './AdcNoiseResolutionSimulator';
import { InterruptVectorTableExplorer } from './InterruptVectorTableExplorer';
import { CodeSnippetGenerator } from './CodeSnippetGenerator';
import { BuildSystemGenerator } from './BuildSystemGenerator';
import { RegisterStatusDashboard } from './RegisterStatusDashboard';
import { RegisterSnapshotSimulator } from './RegisterSnapshotSimulator';
import { RegisterCodeSnippetGenerator } from './RegisterCodeSnippetGenerator';
import { RegisterConfigComparator } from './RegisterConfigComparator';
import { PeripheralRegisterTreeView } from './PeripheralRegisterTreeView';
import { SerialTimelineSimulator } from './SerialTimelineSimulator';
import { SerialDebugLogParser } from './SerialDebugLogParser';
import { BootloaderCustomizer } from './BootloaderCustomizer';
import { EepromDataVisualizer } from './EepromDataVisualizer';
import { FirmwareUnitTestGenerator } from './FirmwareUnitTestGenerator';
import { HardwareDebuggerConfigurator } from './HardwareDebuggerConfigurator';
import { SfrRegisterDifferential } from './SfrRegisterDifferential';
import { LiveRegisterWatcher } from './LiveRegisterWatcher';
import { GpioTogglingConfigurator } from './GpioTogglingConfigurator';
import { TimerPrescalerCalculator } from './TimerPrescalerCalculator';
import { UartBaudRateErrorCalculator } from './UartBaudRateErrorCalculator';
import { WatchdogTimeoutCalculator } from './WatchdogTimeoutCalculator';
import { SpiTimingDiagramVisualizer } from './SpiTimingDiagramVisualizer';
import { I2cBitRateCalculator } from './I2cBitRateCalculator';
import { GpioSignalParams, DEFAULT_GPIO_PARAMS } from '../data/gpioSignalTypes';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU: (mcu: SupportedMCU) => void;
  gpioParams?: GpioSignalParams;
  onUpdateGpioParams?: (newParams: Partial<GpioSignalParams>) => void;
  onNavigateToOscilloscope?: () => void;
}

export const RegistersTab: React.FC<Props> = ({
  selectedMCU,
  onSelectMCU,
  gpioParams,
  onUpdateGpioParams,
  onNavigateToOscilloscope
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const activeGpioParams = gpioParams || DEFAULT_GPIO_PARAMS[selectedMCU];

  // USART State
  const [usartFcpu, setUsartFcpu] = useState<number>(16000000);
  const [usartCustomFcpu, setUsartCustomFcpu] = useState<string>('16000000');
  const [isCustomFcpuMode, setIsCustomFcpuMode] = useState<boolean>(false);
  const [usartBaud, setUsartBaud] = useState<number>(115200);
  const [usartCustomBaud, setUsartCustomBaud] = useState<string>('115200');
  const [isCustomBaudMode, setIsCustomBaudMode] = useState<boolean>(false);
  const [usartU2X, setUsartU2X] = useState<boolean>(false);
  const [usartPort, setUsartPort] = useState<number>(0);

  // I2C State
  const [i2cFcpu, setI2cFcpu] = useState<number>(16000000);
  const [i2cScl, setI2cScl] = useState<number>(100000);
  const [i2cTwps, setI2cTwps] = useState<number>(0);

  // Copy state
  const [copiedUsart, setCopiedUsart] = useState<boolean>(false);
  const [copiedI2c, setCopiedI2c] = useState<boolean>(false);
  const [copiedAtomic, setCopiedAtomic] = useState<boolean>(false);

  // Ensure selected usartPort is valid for the current MCU
  const maxUsartChannels = currentProfile.usart;
  const currentUsartChannel = usartPort >= maxUsartChannels ? 0 : usartPort;

  // Active F_CPU and Baud
  const effectiveUsartFcpu = isCustomFcpuMode ? (parseFloat(usartCustomFcpu) || 16000000) : usartFcpu;
  const effectiveUsartBaud = isCustomBaudMode ? (parseInt(usartCustomBaud, 10) || 115200) : usartBaud;

  // USART Calculation
  const divisor = usartU2X ? 8 : 16;
  const ubrrVal = Math.round(effectiveUsartFcpu / (divisor * effectiveUsartBaud) - 1);
  const safeUbrr = ubrrVal < 0 ? 0 : Math.min(4095, ubrrVal);
  const actualBaud = effectiveUsartFcpu / (divisor * (safeUbrr + 1));
  const baudError = ((actualBaud - effectiveUsartBaud) / effectiveUsartBaud) * 100;
  const isBaudErrorHigh = Math.abs(baudError) > 2.0;

  // I2C Calculation
  const twpsPrescaler = Math.pow(4, i2cTwps);
  let twbrVal = Math.round(((i2cFcpu / i2cScl) - 16) / (2 * twpsPrescaler));
  if (twbrVal < 0) twbrVal = 0;
  if (twbrVal > 255) twbrVal = 255;
  const actualScl = i2cFcpu / (16 + 2 * twbrVal * twpsPrescaler);

  // MCU-specific Register Naming adjustments:
  // ATmega328P has 1 USART (UBRR0 or UBRR0L/H), ATmega128 has 2 (UBRR0/UBRR1), ATmega640 has 4 (UBRR0~3)
  const isATmega328P = selectedMCU === 'atmega328p';
  const isATmega128 = selectedMCU === 'atmega128';

  const ubrrHReg = `UBRR${currentUsartChannel}H`;
  const ubrrLReg = `UBRR${currentUsartChannel}L`;
  const ucsrAReg = `UCSR${currentUsartChannel}A`;
  const ucsrBReg = `UCSR${currentUsartChannel}B`;
  const ucsrCReg = `UCSR${currentUsartChannel}C`;
  const udrReg = `UDR${currentUsartChannel}`;

  // USART Code Generator
  const usartCode = `// ==========================================
// ${currentProfile.name} USART${currentUsartChannel} 초기화 C 코드 (Bare-metal)
// F_CPU: ${effectiveUsartFcpu.toLocaleString()} Hz, Baud: ${effectiveUsartBaud} bps
// U2X 배속: ${usartU2X ? '활성화 (8분주)' : '비활성화 (16분주)'}
// ==========================================
#include <avr/io.h>

#define F_CPU ${Math.round(effectiveUsartFcpu)}UL
#define BAUD ${effectiveUsartBaud}
#define UBRR_VAL ${safeUbrr}

void USART${currentUsartChannel}_Init(void) {
    // 1. 보드레이트 상위/하위 바이트 설정
    ${ubrrHReg} = (unsigned char)(UBRR_VAL >> 8);
    ${ubrrLReg} = (unsigned char)UBRR_VAL;

    // 2. ${usartU2X ? '2배속 모드(U2X) 활성화' : '표준 1배속 모드 설정'}
    ${ucsrAReg} = ${usartU2X ? `(1 << U2X${currentUsartChannel})` : '0x00'};

    // 3. 수신(RX) 및 송신(TX) 하드웨어 인에이블
    ${ucsrBReg} = (1 << RXEN${currentUsartChannel}) | (1 << TXEN${currentUsartChannel});

    // 4. 프레임 형식: 8비트 데이터, 패리티 없음, 1스톱비트 (8N1)
    ${ucsrCReg} = (1 << UCSZ${currentUsartChannel}1) | (1 << UCSZ${currentUsartChannel}0);
}

void USART${currentUsartChannel}_Transmit(unsigned char data) {
    // 송신 버퍼(UDR)가 빌 때까지 폴링 대기
    while (!(${ucsrAReg} & (1 << UDRE${currentUsartChannel})));
    ${udrReg} = data;
}

unsigned char USART${currentUsartChannel}_Receive(void) {
    // 데이터 수신 완료 대기
    while (!(${ucsrAReg} & (1 << RXC${currentUsartChannel})));
    return ${udrReg};
}`;

  // I2C Code Generator
  const i2cCode = `// ==========================================
// ${currentProfile.name} I2C (TWI) Master 초기화 C 코드
// F_CPU: ${i2cFcpu.toLocaleString()} Hz, SCL: ${(actualScl / 1000).toFixed(1)} kHz
// TWBR: ${twbrVal}, Prescaler (TWPS): 4^${i2cTwps} = ${twpsPrescaler}
// ==========================================
#include <avr/io.h>

void TWI_Master_Init(void) {
    // 1. TWBR 전송속도 레지스터 기록
    TWBR = ${twbrVal};

    // 2. TWSR 프리스케일러 비트 설정 (TWPS1:0 = ${i2cTwps})
    TWSR = (TWSR & ~0x03) | ${i2cTwps};

    // 3. TWI 하드웨어 모듈 및 ACK 생성 인에이블
    TWCR = (1 << TWEN) | (1 << TWEA);
}

void TWI_Start(void) {
    TWCR = (1 << TWINT) | (1 << TWSTA) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT))); // START 신호 전송 완료 대기
}

void TWI_Stop(void) {
    TWCR = (1 << TWINT) | (1 << TWSTO) | (1 << TWEN);
}`;

  const atomicCode = `// ==========================================
// ${currentProfile.name} 16비트 레지스터(TCNT1/OCR1A 등) 안전 Atomic 접근
// 컴파일러 중간 임시 버퍼(TEMP) 인터럽트 오염 방지 표준
// ==========================================
#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/atomic.h>

// 방법 1: util/atomic.h 표준 매크로 활용 (권장)
uint16_t Read_Timer1_Safe(void) {
    uint16_t timer_val;
    ATOMIC_BLOCK(ATOMIC_RESTORESTATE) {
        // 이 블록 내부에서 SREG 자동 백업 후 cli() 호출
        // 블록 종료 시 원래 인터럽트 플래그로 자동 복원
        timer_val = TCNT1;
    }
    return timer_val;
}

// 방법 2: 수동 SREG 상태 레지스터 백업 기반
void Write_OCR1A_Atomic(uint16_t val) {
    uint8_t sreg_backup = SREG;
    cli(); // 전역 인터럽트 차단
    OCR1A = val; // High바이트 -> Low바이트 순서로 자동 쓰기
    SREG = sreg_backup; // 이전 인터럽트 복구
}`;

  const copyToClipboard = (text: string, type: 'usart' | 'i2c' | 'atomic') => {
    navigator.clipboard.writeText(text);
    if (type === 'usart') {
      setCopiedUsart(true);
      setTimeout(() => setCopiedUsart(false), 2000);
    } else if (type === 'i2c') {
      setCopiedI2c(true);
      setTimeout(() => setCopiedI2c(false), 2000);
    } else {
      setCopiedAtomic(true);
      setTimeout(() => setCopiedAtomic(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Target MCU Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 backdrop-blur shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            SFR 계산 대상 MCU
          </span>
          <div className="flex gap-2">
            {(['atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
              <button
                key={mcuId}
                onClick={() => onSelectMCU(mcuId)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                  selectedMCU === mcuId
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white'
                }`}
              >
                {MCU_PROFILES[mcuId].name}
              </button>
            ))}
          </div>
        </div>

        <div className="text-right text-xs">
          <span className="text-slate-400 block font-mono">가용 통신 하드웨어</span>
          <span className="font-bold text-amber-400 font-mono text-sm">
            USART {currentProfile.usart}개 채널 • I2C(TWI) 1개 채널
          </span>
        </div>
      </div>

      {/* Intro Box */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
              <Calculator className="w-3.5 h-3.5" /> {currentProfile.name} Register Configuration Engine
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              {currentProfile.name} SFR 레지스터 계산기 & C 코드 생성기
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              {currentProfile.name}의 클럭 주파수별 UBRR 보드레이트 오차율 및 TWI(I2C) TWBR 비트레이트를 실시간으로 산출하고,
              16비트 레지스터 TEMP 버퍼 오염 방지용 원자적(Atomic) 접근 소스코드를 생성합니다.
            </p>
          </div>
        </div>
      </div>

      {/* D3.js Memory Map Heatmap (SRAM / EEPROM / IO Registers) */}
      <MemoryMapD3Heatmap selectedMCU={selectedMCU} />

      {/* Live Register Watcher (Custom Watch List & Simulated Serial Stream) */}
      <LiveRegisterWatcher selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Real-time Register Status Dashboard (Live Bit Monitor & Datasheet Inspector) */}
      <RegisterStatusDashboard selectedMCU={selectedMCU} />

      {/* Register Snapshot Simulator (Interactive SFR to Hardware Physical Reaction: Pins, PWM, Overflow) */}
      <RegisterSnapshotSimulator selectedMCU={selectedMCU} />

      {/* C Register Initialization Code Generator (Clean Bitwise Shift Macros & Atomic Blocks) */}
      <RegisterCodeSnippetGenerator selectedMCU={selectedMCU} />

      {/* SFR Register Differential Tool (Cross-MCU Mapping & Migration Hurdles) */}
      <SfrRegisterDifferential selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />

      {/* Peripheral Register Tree View (Interactive Bit-field Explorer & Live Value Updater) */}
      <PeripheralRegisterTreeView selectedMCU={selectedMCU} />

      {/* GPIO Toggling Frequency & Duty Cycle Configurator (Virtual Oscilloscope Linked) */}
      <GpioTogglingConfigurator
        selectedMCU={selectedMCU}
        gpioParams={activeGpioParams}
        onUpdateParams={onUpdateGpioParams || (() => {})}
        onNavigateToOscilloscope={onNavigateToOscilloscope || (() => {})}
      />

      {/* Timer/Counter Configuration Wizard (Auto-generate TCCR, OCR, TCNT Register Values & C Code) */}
      <TimerPrescalerCalculator selectedMCU={selectedMCU} />

      {/* UART Baud Rate Error Calculator (UBRR & Percentage Error Analyzer to avoid communication failures) */}
      <UartBaudRateErrorCalculator selectedMCU={selectedMCU} />

      {/* Watchdog Timer (WDT) Timeout Calculator (Prescaler Settings, Timeout Period & WDTCSR Configuration) */}
      <WatchdogTimeoutCalculator selectedMCU={selectedMCU} />

      {/* SPI Timing Diagram Visualizer (Modes 0/1/2/3, SCK/MOSI/MISO/SS Waveforms & Hardware Timing Parameters) */}
      <SpiTimingDiagramVisualizer selectedMCU={selectedMCU} />

      {/* I2C Bit Rate Calculator (TWBR & Prescaler TWPS Auto-Solver & Error Analyzer) */}
      <I2cBitRateCalculator selectedMCU={selectedMCU} />

      {/* Communications Timing Calculator (I2C / SPI / USART Prescalers & BRR/UBRR) */}
      <CommTimingCalculator selectedMCU={selectedMCU} />

      {/* Serial Communication Timeline Simulator (Packet Latency & Waveform Analyzer) */}
      <SerialTimelineSimulator selectedMCU={selectedMCU} />

      {/* Serial Debug Log Parser & Status Register Analyzer */}
      <SerialDebugLogParser selectedMCU={selectedMCU} />

      {/* ADC Noise & Resolution Simulator (Vref, Expected Signal Range, Quantization Error & PCB Noise Impact on ENOB) */}
      <AdcNoiseResolutionSimulator selectedMCU={selectedMCU} />

      {/* ADC Sampling Rate & Noise Reduction Calculator */}
      <AdcSamplingNoiseCalculator selectedMCU={selectedMCU} />

      {/* Interrupt Vector Table Explorer */}
      <InterruptVectorTableExplorer selectedMCU={selectedMCU} />

      {/* Complete BSP C Code Snippet Generator */}
      <CodeSnippetGenerator selectedMCU={selectedMCU} />

      {/* Build System Generator (Makefile & CMakeLists.txt) */}
      <BuildSystemGenerator selectedMCU={selectedMCU} />

      {/* Bootloader Customizer (BOOTSZ, Optiboot, Linker & Fuse Build Flags) */}
      <BootloaderCustomizer selectedMCU={selectedMCU} />

      {/* EEPROM Data Visualizer & Hex-Dump Inspector */}
      <EepromDataVisualizer selectedMCU={selectedMCU} />

      {/* Firmware Unit Test Generator (GoogleTest, Unity, Mock Structures & Test Simulator) */}
      <FirmwareUnitTestGenerator selectedMCU={selectedMCU} />

      {/* Hardware Debugger Configurator (JTAG vs debugWIRE, CKDIV8, JTAGEN, DWEN, OCDEN & Hardware Stepping) */}
      <HardwareDebuggerConfigurator selectedMCU={selectedMCU} />

      {/* Grid: 2 Calculators */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calculator 1: USART/UART Baud Rate Calculator */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-lg flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                USART/UART Baud Rate Calculator ({currentProfile.name})
              </h3>
              <span className="text-[11px] font-mono bg-slate-950 text-slate-400 border border-slate-800 px-2 py-0.5 rounded">
                UBRR = F_CPU / ({usartU2X ? '8' : '16'}×Baud) - 1
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Target F_CPU */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-slate-400">시스템 클럭 (F_CPU)</label>
                  <button
                    type="button"
                    onClick={() => setIsCustomFcpuMode(!isCustomFcpuMode)}
                    className="text-[10px] text-amber-400 hover:text-amber-300 underline font-mono"
                  >
                    {isCustomFcpuMode ? '프리셋' : '직접입력'}
                  </button>
                </div>
                {isCustomFcpuMode ? (
                  <div className="relative">
                    <input
                      type="number"
                      value={usartCustomFcpu}
                      onChange={(e) => setUsartCustomFcpu(e.target.value)}
                      placeholder="16000000"
                      className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                    />
                    <span className="absolute right-2 top-1.5 text-[10px] text-slate-500 font-mono">Hz</span>
                  </div>
                ) : (
                  <select
                    value={usartFcpu}
                    onChange={(e) => setUsartFcpu(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value={16000000}>16.000 MHz (5V 표준)</option>
                    <option value={8000000}>8.000 MHz (3.3V / 내부RC)</option>
                    <option value={11059200}>11.0592 MHz (통신 0% 오차)</option>
                    <option value={14745600}>14.7456 MHz (통신 전용)</option>
                    <option value={18432000}>18.4320 MHz (초고속 전용)</option>
                    <option value={20000000}>20.000 MHz (328P 최대)</option>
                    <option value={4000000}>4.000 MHz (저전력)</option>
                    <option value={1000000}>1.000 MHz (초기 퓨즈)</option>
                  </select>
                )}
              </div>

              {/* Target Baud Rate */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-slate-400">목표 보드레이트 (Baud)</label>
                  <button
                    type="button"
                    onClick={() => setIsCustomBaudMode(!isCustomBaudMode)}
                    className="text-[10px] text-amber-400 hover:text-amber-300 underline font-mono"
                  >
                    {isCustomBaudMode ? '프리셋' : '직접입력'}
                  </button>
                </div>
                {isCustomBaudMode ? (
                  <div className="relative">
                    <input
                      type="number"
                      value={usartCustomBaud}
                      onChange={(e) => setUsartCustomBaud(e.target.value)}
                      placeholder="115200"
                      className="w-full bg-slate-950 border border-cyan-500/50 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                    />
                    <span className="absolute right-2 top-1.5 text-[10px] text-slate-500 font-mono">bps</span>
                  </div>
                ) : (
                  <select
                    value={usartBaud}
                    onChange={(e) => setUsartBaud(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value={2400}>2,400 bps</option>
                    <option value={4800}>4,800 bps</option>
                    <option value={9600}>9,600 bps</option>
                    <option value={19200}>19,200 bps</option>
                    <option value={38400}>38,400 bps</option>
                    <option value={57600}>57,600 bps</option>
                    <option value={115200}>115,200 bps</option>
                    <option value={230400}>230,400 bps</option>
                    <option value={250000}>250,000 bps (DMX)</option>
                    <option value={500000}>500,000 bps</option>
                    <option value={1000000}>1,000,000 bps (1M)</option>
                  </select>
                )}
              </div>

              {/* USART Channel */}
              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">USART 채널 선택</label>
                <select
                  value={currentUsartChannel}
                  onChange={(e) => setUsartPort(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value={0}>USART0 {selectedMCU === 'atmega328p' ? '(PD0/PD1)' : '(PE0/PE1)'}</option>
                  {maxUsartChannels > 1 && (
                    <option value={1}>USART1 (PD2/PD3)</option>
                  )}
                  {maxUsartChannels > 2 && (
                    <option value={2}>USART2 (PH0/PH1)</option>
                  )}
                  {maxUsartChannels > 3 && (
                    <option value={3}>USART3 (PJ0/PJ1)</option>
                  )}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
              <input
                type="checkbox"
                id="u2x-check"
                checked={usartU2X}
                onChange={(e) => setUsartU2X(e.target.checked)}
                className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="u2x-check" className="text-xs text-slate-300 cursor-pointer">
                <strong>U2X (2배속 비동기 모드 활성화)</strong>: 8분주로 나누어 16MHz 클럭에서 115200bps 통신 오차를 대폭 낮춤
              </label>
            </div>

            {/* Result Display Box */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">계산된 UBRR 값:</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {safeUbrr} <span className="text-xs text-slate-500">(0x{safeUbrr.toString(16).padStart(4, '0').toUpperCase()})</span>
                  <span className="text-[11px] text-slate-400 ml-2 font-normal">
                    [{ubrrHReg}: {(safeUbrr >> 8) & 0x0F}, {ubrrLReg}: {safeUbrr & 0xFF}]
                  </span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">실제 생성 보드레이트:</span>
                <span className="font-mono text-white">{actualBaud.toFixed(2)} bps</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">통신 오차율 (Percentage Error):</span>
                <span className={`font-mono font-bold ${isBaudErrorHigh ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {baudError >= 0 ? '+' : ''}{baudError.toFixed(2)}% {isBaudErrorHigh ? '(⚠️ 불안정: U2X 체크 권장)' : '(✅ 안정적 통신)'}
                </span>
              </div>
            </div>
          </div>

          {/* Code Snippet Box */}
          <div className="relative">
            <div className="flex justify-between items-center mb-1 text-[11px] text-slate-400">
              <span className="flex items-center gap-1 font-mono">
                <Terminal className="w-3.5 h-3.5 text-amber-400" /> C 언어 초기화 루틴 ({currentProfile.name})
              </span>
              <button
                onClick={() => copyToClipboard(usartCode, 'usart')}
                className="inline-flex items-center gap-1 text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 text-[10px] transition"
              >
                {copiedUsart ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedUsart ? '복사 완료' : '코드 복사'}
              </button>
            </div>
            <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 custom-scrollbar">
              {usartCode}
            </pre>
          </div>
        </div>

        {/* Calculator 2: I2C (TWI) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-lg flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                I2C / TWI 통신속도 & TWBR 계산기
              </h3>
              <span className="text-[11px] font-mono bg-slate-950 text-slate-400 border border-slate-800 px-2 py-0.5 rounded">
                SCL = F_CPU / (16 + 2×TWBR×4^TWPS)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">시스템 클럭 (F_CPU)</label>
                <select
                  value={i2cFcpu}
                  onChange={(e) => setI2cFcpu(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value={16000000}>16.000 MHz (5V 표준)</option>
                  <option value={8000000}>8.000 MHz (3.3V 표준)</option>
                  <option value={20000000}>20.000 MHz</option>
                  <option value={4000000}>4.000 MHz</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">목표 SCL 버스 속도</label>
                <select
                  value={i2cScl}
                  onChange={(e) => setI2cScl(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value={100000}>100 kHz (Standard Mode)</option>
                  <option value={400000}>400 kHz (Fast Mode)</option>
                  <option value={50000}>50 kHz (저속 안정 모드)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-400 block mb-1">프리스케일러 (TWPS)</label>
                <select
                  value={i2cTwps}
                  onChange={(e) => setI2cTwps(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value={0}>4^0 = 1 분주 (일반적)</option>
                  <option value={1}>4^1 = 4 분주</option>
                  <option value={2}>4^2 = 16 분주</option>
                  <option value={3}>4^3 = 64 분주</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">계산된 TWBR 비트레이트 값:</span>
                <span className="font-mono font-bold text-cyan-400 text-sm">
                  {twbrVal} <span className="text-xs text-slate-500">(0x{twbrVal.toString(16).padStart(2, '0').toUpperCase()})</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">실제 생성 SCL 버스 주파수:</span>
                <span className="font-mono text-white">{(actualScl / 1000).toFixed(2)} kHz</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">핀 연결:</span>
                <span className="font-mono text-emerald-400">
                  {selectedMCU === 'atmega328p' ? 'PC4(SDA), PC5(SCL)' : 'PD1(SDA), PD0(SCL)'}
                </span>
              </div>
            </div>
          </div>

          {/* Code Snippet Box */}
          <div className="relative">
            <div className="flex justify-between items-center mb-1 text-[11px] text-slate-400">
              <span className="flex items-center gap-1 font-mono">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" /> C 언어 TWI 마스터 루틴
              </span>
              <button
                onClick={() => copyToClipboard(i2cCode, 'i2c')}
                className="inline-flex items-center gap-1 text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 text-[10px] transition"
              >
                {copiedI2c ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedI2c ? '복사 완료' : '코드 복사'}
              </button>
            </div>
            <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 custom-scrollbar">
              {i2cCode}
            </pre>
          </div>
        </div>
      </div>

      {/* Critical Bare-metal Architecture Guidelines: Atomic & Bit Ops */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atomic Register Access Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              16비트 레지스터 TEMP 버퍼 오염 방지 & Atomic 접근
            </h3>
            <button
              onClick={() => copyToClipboard(atomicCode, 'atomic')}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 text-[10px] transition"
            >
              {copiedAtomic ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copiedAtomic ? '복사 완료' : '코드 복사'}
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {currentProfile.name}은 8비트 데이터 버스 구조이므로 16비트 타이머 레지스터(TCNT1, OCR1A, ICR1 등)를 읽고 쓸 때
            하드웨어 내부 <strong>8비트 임시 버퍼(TEMP)</strong>를 반드시 거칩니다.
          </p>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
            <div className="text-amber-400 font-semibold font-mono">• 16비트 쓰기 규칙: High 바이트 선행 후 Low 바이트</div>
            <div className="text-cyan-400 font-semibold font-mono">• 16비트 읽기 규칙: Low 바이트 선행 후 High 바이트</div>
            <div className="text-rose-400 text-[11px]">
              ⚠️ 인터럽트 루틴(ISR) 내에서 16비트 레지스터를 접근할 때 메인 루틴의 TEMP 버퍼가 파괴될 수 있으므로, 임계 구역에서는 <code className="bg-slate-800 px-1 rounded">ATOMIC_BLOCK</code>이 필수입니다.
            </div>
          </div>

          <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 custom-scrollbar">
            {atomicCode}
          </pre>
        </div>

        {/* Bit Manipulation Standards Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              GCC 비트 조작 표준과 단일 사이클 SBI / CBI 어셈블리 변환
            </h3>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            과거 비표준 매크로였던 <code className="text-rose-400 bg-slate-950 px-1 rounded">sbi()</code>, <code className="text-rose-400 bg-slate-950 px-1 rounded">cbi()</code> 대신
            표준 avr-gcc 문법을 사용하여 단 1사이클 하드웨어 고속 I/O를 실현합니다.
          </p>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-1">1. 비트 셋 (Bit Set - High 출력 / 인에이블)</span>
              <code className="text-emerald-400 font-mono block bg-slate-900 p-2 rounded border border-slate-800">
                PORTB |= (1 &lt;&lt; PB5); // 빌트인 LED On
              </code>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">2. 비트 클리어 (Bit Clear - Low 출력 / 디스에이블)</span>
              <code className="text-amber-400 font-mono block bg-slate-900 p-2 rounded border border-slate-800">
                PORTB &= ~(1 &lt;&lt; PB5); // 빌트인 LED Off
              </code>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">3. 하드웨어 비트 토글 (단 62.5ns 초고속 반전)</span>
              <code className="text-cyan-400 font-mono block bg-slate-900 p-2 rounded border border-slate-800">
                PINB |= (1 &lt;&lt; PB5); // AVR 하드웨어 토글 레지스터 가속
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
