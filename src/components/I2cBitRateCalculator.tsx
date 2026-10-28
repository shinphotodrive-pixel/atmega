import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Cpu,
  Clock,
  Zap,
  Sliders,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Code2,
  Terminal,
  Info,
  Radio,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Layers,
  Sparkles,
  Gauge
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

interface BusSpeedPreset {
  speedHz: number;
  label: string;
  modeName: string;
  category: 'Standard' | 'Fast' | 'Fast+' | 'Custom';
  description: string;
}

const I2C_SPEED_PRESETS: BusSpeedPreset[] = [
  {
    speedHz: 50000,
    label: '50 kHz',
    modeName: 'Low-Speed / Long Wire',
    category: 'Standard',
    description: '긴 배선 또는 높은 기생 커패시턴스(배선 용량) 환경에서 노이즈 마진을 확보하는 저속 모드'
  },
  {
    speedHz: 100000,
    label: '100 kHz',
    modeName: 'Standard Mode (Sm)',
    category: 'Standard',
    description: 'I2C/SMBus 표준 모드. 대부분의 I2C 센서(EEPROM, RTC, 온습도 센서) 기본 지원'
  },
  {
    speedHz: 250000,
    label: '250 kHz',
    modeName: 'Intermediate Speed',
    category: 'Fast',
    description: '100kHz와 400kHz 사이의 균형 속도. 중간 부하 및 센서 스트리밍에 적합'
  },
  {
    speedHz: 400000,
    label: '400 kHz',
    modeName: 'Fast Mode (Fm)',
    category: 'Fast',
    description: '고속 모드. OLED 디스플레이(SSD1306), 고주파 IMU(MPU6050/ICM-20948) 데이터 수집'
  },
  {
    speedHz: 1000000,
    label: '1,000 kHz (1 MHz)',
    modeName: 'Fast Mode Plus (Fm+)',
    category: 'Fast+',
    description: '초고속 모드 (AVR 하드웨어 TWI 한계 및 슬루레이트/풀업 저항 R_pullup 정밀 설계 필수)'
  }
];

const CLOCK_PRESETS = [
  { fcpu: 1000000, label: '1.0 MHz (내부 RC 기본)', isCrystal: false },
  { fcpu: 4000000, label: '4.0 MHz (저전력 3.3V)', isCrystal: false },
  { fcpu: 8000000, label: '8.0 MHz (3.3V Pro Mini / 내부 RC)', isCrystal: false },
  { fcpu: 10000000, label: '10.0 MHz', isCrystal: true },
  { fcpu: 12000000, label: '12.0 MHz (USB V-USB)', isCrystal: true },
  { fcpu: 16000000, label: '16.0 MHz (5V 표준 Arduino Uno/Mega)', isCrystal: true },
  { fcpu: 20000000, label: '20.0 MHz (AVR 오버클럭 최대)', isCrystal: true }
];

export const I2cBitRateCalculator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Frequency and Speed inputs
  const [fcpu, setFcpu] = useState<number>(16000000);
  const [fcpuInput, setFcpuInput] = useState<string>('16.0');
  const [isCustomFcpu, setIsCustomFcpu] = useState<boolean>(false);

  const [desiredSpeedHz, setDesiredSpeedHz] = useState<number>(100000);
  const [customSpeedInput, setCustomSpeedInput] = useState<string>('100');
  const [isCustomSpeed, setIsCustomSpeed] = useState<boolean>(false);

  // Manual or Auto prescaler
  const [autoSelectPrescaler, setAutoSelectPrescaler] = useState<boolean>(true);
  const [selectedTwps, setSelectedTwps] = useState<number>(0); // 0=1, 1=4, 2=16, 3=64

  // Hardware configuration options
  const [enableInternalPullups, setEnableInternalPullups] = useState<boolean>(false);
  const [busPullupResistorKohm, setBusPullupResistorKohm] = useState<number>(4.7);
  const [busCapacitancePf, setBusCapacitancePf] = useState<number>(100);
  const [i2cSlaveAddressHex, setI2cSlaveAddressHex] = useState<string>('0x68');

  // Interactive copy feedback
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedRegister, setCopiedRegister] = useState<boolean>(false);

  // Handle F_CPU presets
  const handleSelectClockPreset = (clockHz: number) => {
    setFcpu(clockHz);
    setFcpuInput((clockHz / 1000000).toString());
    setIsCustomFcpu(false);
  };

  const handleCustomClockChange = (valStr: string) => {
    setFcpuInput(valStr);
    const mhz = parseFloat(valStr);
    if (!isNaN(mhz) && mhz > 0 && mhz <= 30) {
      setFcpu(Math.round(mhz * 1000000));
      setIsCustomFcpu(true);
    }
  };

  // Handle Bus speed presets
  const handleSelectSpeedPreset = (hz: number) => {
    setDesiredSpeedHz(hz);
    setCustomSpeedInput((hz / 1000).toString());
    setIsCustomSpeed(false);
  };

  const handleCustomSpeedChange = (valStr: string) => {
    setCustomSpeedInput(valStr);
    const khz = parseFloat(valStr);
    if (!isNaN(khz) && khz > 0 && khz <= 2000) {
      setDesiredSpeedHz(Math.round(khz * 1000));
      setIsCustomSpeed(true);
    }
  };

  // -------------------------------------------------------------
  // AVR TWI (I2C) Baud Rate Formula:
  // SCL_Frequency = F_CPU / (16 + 2 * TWBR * (4 ^ TWPS))
  // Therefore:
  // TWBR = ((F_CPU / SCL_Frequency) - 16) / (2 * (4 ^ TWPS))
  // -------------------------------------------------------------
  const prescalerOptions = [
    { twpsBits: 0, factor: 1, label: '4⁰ = 1 분주 (TWPS = 0)' },
    { twpsBits: 1, factor: 4, label: '4¹ = 4 분주 (TWPS = 1)' },
    { twpsBits: 2, factor: 16, label: '4² = 16 분주 (TWPS = 2)' },
    { twpsBits: 3, factor: 64, label: '4³ = 64 분주 (TWPS = 3)' }
  ];

  // Evaluate calculation for each of the 4 prescalers
  const prescalerEvaluations = useMemo(() => {
    return prescalerOptions.map((opt) => {
      const rawTwbr = ((fcpu / desiredSpeedHz) - 16) / (2 * opt.factor);
      const roundedTwbr = Math.round(rawTwbr);
      const clampedTwbr = Math.max(0, Math.min(255, roundedTwbr));
      
      const actualSclHz = fcpu / (16 + 2 * clampedTwbr * opt.factor);
      const errorPercent = ((actualSclHz - desiredSpeedHz) / desiredSpeedHz) * 100;
      const absError = Math.abs(errorPercent);

      // Datasheet constraints:
      // In master mode, TWBR should be >= 10 when prescaler=1 if high clock stability is needed,
      // and TWBR must fit in an 8-bit register (0 <= TWBR <= 255).
      const isTwbrValid = rawTwbr >= 0 && rawTwbr <= 255;
      const isTwbrWarning = rawTwbr >= 0 && rawTwbr < 10 && opt.factor === 1;

      return {
        ...opt,
        rawTwbr,
        roundedTwbr,
        clampedTwbr,
        actualSclHz,
        errorPercent,
        absError,
        isTwbrValid,
        isTwbrWarning
      };
    });
  }, [fcpu, desiredSpeedHz]);

  // Optimal prescaler determination
  const optimalEvaluation = useMemo(() => {
    // Look for valid prescalers first (rawTwbr >= 0 and rawTwbr <= 255)
    const valid = prescalerEvaluations.filter((p) => p.isTwbrValid);
    if (valid.length > 0) {
      // Prefer ones where TWBR >= 10 if prescaler is 1, and smallest error
      const preferred = valid.filter((p) => !p.isTwbrWarning);
      if (preferred.length > 0) {
        return preferred.reduce((prev, curr) => (curr.absError < prev.absError ? curr : prev));
      }
      return valid.reduce((prev, curr) => (curr.absError < prev.absError ? curr : prev));
    }
    // Fallback if all out of range: pick the one closest to 0-255 range
    return prescalerEvaluations[0];
  }, [prescalerEvaluations]);

  // Active prescaler & calculations
  const activeTwps = autoSelectPrescaler ? optimalEvaluation.twpsBits : selectedTwps;
  const activeEvaluation = prescalerEvaluations.find((p) => p.twpsBits === activeTwps) || optimalEvaluation;

  const twbr = activeEvaluation.clampedTwbr;
  const rawTwbr = activeEvaluation.rawTwbr;
  const actualSclHz = activeEvaluation.actualSclHz;
  const actualSclKhz = actualSclHz / 1000;
  const targetSclKhz = desiredSpeedHz / 1000;
  const errorPercent = activeEvaluation.errorPercent;
  const absError = Math.abs(errorPercent);

  // Status flags
  const isTooFastForCpu = rawTwbr < 0;
  const isTwbrOverflow = rawTwbr > 255;
  const isLowTwbrWarning = rawTwbr >= 0 && rawTwbr < 10 && activeEvaluation.factor === 1;
  const isErrorSevere = absError > 5.0;

  // I2C Pin Mapping for selected MCU
  const pinDetails = useMemo(() => {
    if (selectedMCU === 'atmega328p') {
      return {
        sdaPin: 'PC4 (Pin 27 / Arduino A4)',
        sclPin: 'PC5 (Pin 28 / Arduino A5)',
        portLetter: 'C',
        sdaBit: 4,
        sclBit: 5,
        twintVector: 'TWI_vect',
        regPrefix: 'TW'
      };
    } else if (selectedMCU === 'atmega128') {
      return {
        sdaPin: 'PD1 (Pin 26)',
        sclPin: 'PD0 (Pin 25)',
        portLetter: 'D',
        sdaBit: 1,
        sclBit: 0,
        twintVector: 'TWI_vect',
        regPrefix: 'TW'
      };
    } else {
      // atmega640 / 1280 / 2560
      return {
        sdaPin: 'PD1 (Pin 44 / Mega 20)',
        sclPin: 'PD0 (Pin 43 / Mega 21)',
        portLetter: 'D',
        sdaBit: 1,
        sclBit: 0,
        twintVector: 'TWI_vect',
        regPrefix: 'TW'
      };
    }
  }, [selectedMCU]);

  // Pullup RC Time Constant & Maximum Bus Capacitance analysis
  const busRiseTimeNs = useMemo(() => {
    // t_r ~ 0.8473 * R_pullup * C_bus for I2C standard specification
    return 0.8473 * (busPullupResistorKohm * 1000) * (busCapacitancePf * 1e-12) * 1e9;
  }, [busPullupResistorKohm, busCapacitancePf]);

  const maxAllowedRiseTimeNs = useMemo(() => {
    if (desiredSpeedHz <= 100000) return 1000; // 1000ns for Standard mode
    return 300; // 300ns for Fast mode (400kHz)
  }, [desiredSpeedHz]);

  const isRiseTimeViolation = busRiseTimeNs > maxAllowedRiseTimeNs;

  // Generated C-Code initialization snippet
  const generatedCCode = useMemo(() => {
    const twpsBin = activeTwps.toString(2).padStart(2, '0');
    return `// ==============================================================================
// ${currentProfile.name} 하드웨어 I2C (TWI) 마스터 통신 초기화 루틴
// F_CPU: ${(fcpu / 1000000).toFixed(4)} MHz | 목표 SCL: ${(desiredSpeedHz / 1000).toFixed(1)} kHz | 실제 SCL: ${actualSclKhz.toFixed(2)} kHz (오차: ${errorPercent >= 0 ? '+' : ''}${errorPercent.toFixed(2)}%)
// 핀아웃: SDA=${pinDetails.sdaPin}, SCL=${pinDetails.sclPin}
// ==============================================================================
#define F_CPU ${fcpu}UL
#include <avr/io.h>
#include <util/twi.h>
#include <stdbool.h>

/**
 * @brief TWI (I2C) 버스 마스터 모드 초기화
 * TWBR = ${twbr} (0x${twbr.toString(16).padStart(2, '0').toUpperCase()})
 * TWSR Prescaler = 4^${activeTwps} = ${activeEvaluation.factor} (TWPS1:0 = 0b${twpsBin})
 */
void I2C_Init(void) {
${enableInternalPullups ? `    // SDA 및 SCL 내부 풀업 저항 활성화 (필요 시 외부 저항 권장)
    PORT${pinDetails.portLetter} |= (1 << PORT${pinDetails.portLetter}${pinDetails.sdaBit}) | (1 << PORT${pinDetails.portLetter}${pinDetails.sclBit});
` : `    // 외부 풀업 저항(${busPullupResistorKohm}kΩ) 사용 권장 (400kHz 고속 모드 시 2.2kΩ~4.7kΩ 필수)`}
    // 1. I2C 비트 전송률(Bit Rate) 레지스터 설정
    // 공식: SCL = F_CPU / (16 + 2 * TWBR * 4^TWPS)
    TWBR = ${twbr}; // 0x${twbr.toString(16).padStart(2, '0').toUpperCase()} -> ${actualSclKhz.toFixed(2)} kHz

    // 2. 프리스케일러 비트(TWPS1, TWPS0) 설정
    // TWSR 레지스터 하위 2비트: 0b${twpsBin} (분주비: ${activeEvaluation.factor})
    TWSR = (TWSR & ~((1 << TWPS1) | (1 << TWPS0))) | (${activeTwps === 0 ? '0' : activeTwps === 1 ? '(1 << TWPS0)' : activeTwps === 2 ? '(1 << TWPS1)' : '(1 << TWPS1) | (1 << TWPS0)'});

    // 3. TWI 하드웨어 활성화 (TWEN = 1)
    TWCR = (1 << TWEN);
}

/**
 * @brief I2C START 조건 전송 및 버스 점유
 */
bool I2C_Start(uint8_t slave_address_with_rw) {
    // START 신호 전송 요청
    TWCR = (1 << TWINT) | (1 << TWSTA) | (1 << TWEN);
    
    // 전송 완료 대기 (TWINT 플래그 셋 대기)
    while (!(TWCR & (1 << TWINT)));

    // 상태 코드 검사 (START 0x08 또는 REPEATED START 0x10)
    uint8_t status = TW_STATUS;
    if ((status != TW_START) && (status != TW_REP_START)) {
        return false;
    }

    // 슬레이브 주소 + R/W 비트 전송
    TWDR = slave_address_with_rw;
    TWCR = (1 << TWINT) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT)));

    // ACK 수신 확인 (SLA+W ACK: 0x18, SLA+R ACK: 0x40)
    status = TW_STATUS;
    if ((status != TW_MT_SLA_ACK) && (status != TW_MR_SLA_ACK)) {
        return false;
    }

    return true;
}

/**
 * @brief I2C 1바이트 쓰기
 */
bool I2C_Write(uint8_t data) {
    TWDR = data;
    TWCR = (1 << TWINT) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT)));

    // 데이터 바이트 전송 후 ACK(0x28) 수신 확인
    return (TW_STATUS == TW_MT_DATA_ACK);
}

/**
 * @brief I2C STOP 조건 전송 및 버스 반환
 */
void I2C_Stop(void) {
    TWCR = (1 << TWINT) | (1 << TWSTO) | (1 << TWEN);
}

// ==============================================================================
// 사용 예제: ${i2cSlaveAddressHex} 슬레이브 디바이스에 1바이트 쓰기
// ==============================================================================
void I2C_Example_Write(void) {
    I2C_Init();
    if (I2C_Start((${i2cSlaveAddressHex} << 1) | TW_WRITE)) {
        I2C_Write(0x00); // 레지스터 주소
        I2C_Write(0x55); // 전송 데이터
    }
    I2C_Stop();
}`;
  }, [
    currentProfile.name,
    fcpu,
    desiredSpeedHz,
    actualSclKhz,
    errorPercent,
    pinDetails,
    twbr,
    activeTwps,
    activeEvaluation,
    enableInternalPullups,
    busPullupResistorKohm,
    i2cSlaveAddressHex
  ]);

  const copyToClipboard = (text: string, type: 'code' | 'register') => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedRegister(true);
      setTimeout(() => setCopiedRegister(false), 2000);
    }
  };

  return (
    <div id="i2c-bitrate-calculator-section" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6 scroll-mt-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-2">
            <Radio className="w-3.5 h-3.5" /> I2C Bitrate Calculator (TWBR & Prescaler)
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>I2C Bitrate Calculator & TWBR 계산기</span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 border border-slate-700">
              {currentProfile.name}
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            시스템 클럭 주파수(F_CPU)와 목표 I2C 버스 SCL 속도(50kHz, 100kHz, 400kHz 등)를 선택하여
            ATmega 하드웨어 TWI 모듈의 <strong>TWBR (Two-Wire Bit Rate Register)</strong> 값과 <strong>TWPS 프리스케일러</strong> 설정을
            정밀 계산하고, 실제 달성 주파수와 오차율을 실시간으로 분석합니다.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Quick MCU Switcher */}
          {onSelectMCU && (
            <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 shrink-0">
              {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
                <button
                  key={mcuId}
                  onClick={() => onSelectMCU(mcuId)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                    selectedMCU === mcuId
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {MCU_PROFILES[mcuId].name}
                </button>
              ))}
            </div>
          )}

          {/* Quick Spec Badge */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-right shrink-0">
            <div className="text-[11px] text-slate-400 font-mono">하드웨어 I2C 핀아웃</div>
            <div className="text-xs font-bold font-mono text-cyan-400">
              SDA: {pinDetails.sdaPin}
            </div>
            <div className="text-xs font-bold font-mono text-cyan-400">
              SCL: {pinDetails.sclPin}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Controls & Calculations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Parameter Inputs (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Section 1: System Clock (F_CPU) */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                시스템 클럭 주파수 (F_CPU)
              </label>
              <span className="text-xs font-mono font-bold text-amber-400">
                {(fcpu / 1000000).toFixed(4)} MHz
              </span>
            </div>

            {/* Quick Clock Presets */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {CLOCK_PRESETS.map((preset) => (
                <button
                  key={preset.fcpu}
                  onClick={() => handleSelectClockPreset(preset.fcpu)}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-mono transition text-center border ${
                    !isCustomFcpu && fcpu === preset.fcpu
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  {preset.fcpu / 1000000}MHz
                </button>
              ))}
            </div>

            {/* Custom MHz Input */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-400">직접 입력 (MHz):</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.0001"
                  min="0.1"
                  max="30"
                  value={fcpuInput}
                  onChange={(e) => handleCustomClockChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                  placeholder="예: 16.0"
                />
                <span className="absolute right-2 top-1 text-[11px] text-slate-500 font-mono">MHz</span>
              </div>
            </div>
          </div>

          {/* Section 2: Desired I2C Bus Speed */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-cyan-400" />
                목표 I2C 버스 속도 (SCL Frequency)
              </label>
              <span className="text-xs font-mono font-bold text-cyan-400">
                {(desiredSpeedHz / 1000).toFixed(1)} kHz
              </span>
            </div>

            {/* Speed Presets */}
            <div className="space-y-1.5">
              {I2C_SPEED_PRESETS.map((preset) => (
                <button
                  key={preset.speedHz}
                  onClick={() => handleSelectSpeedPreset(preset.speedHz)}
                  className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition flex items-center justify-between ${
                    !isCustomSpeed && desiredSpeedHz === preset.speedHz
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-white shadow-sm'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-white'
                  }`}
                >
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      <span className="text-cyan-300 font-mono">{preset.label}</span>
                      <span className="text-[10px] text-slate-400 font-normal">({preset.modeName})</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{preset.description}</div>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      preset.category === 'Fast+'
                        ? 'bg-purple-900/40 text-purple-300 border border-purple-700/40'
                        : preset.category === 'Fast'
                        ? 'bg-blue-900/40 text-blue-300 border border-blue-700/40'
                        : 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40'
                    }`}
                  >
                    {preset.category}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom Speed Input */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-400">커스텀 주파수 (kHz):</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="2000"
                  value={customSpeedInput}
                  onChange={(e) => handleCustomSpeedChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                  placeholder="예: 400"
                />
                <span className="absolute right-2 top-1 text-[11px] text-slate-500 font-mono">kHz</span>
              </div>
            </div>
          </div>

          {/* Section 3: Prescaler Mode Setting */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-400" />
                프리스케일러 (TWPS) 설정 방식
              </label>
              <button
                onClick={() => setAutoSelectPrescaler(!autoSelectPrescaler)}
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border transition ${
                  autoSelectPrescaler
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {autoSelectPrescaler ? '✓ 최적 분주 자동 선택' : '수동 선택 모드'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {prescalerOptions.map((opt) => (
                <button
                  key={opt.twpsBits}
                  disabled={autoSelectPrescaler}
                  onClick={() => setSelectedTwps(opt.twpsBits)}
                  className={`p-2 rounded-lg border text-left text-xs transition ${
                    activeTwps === opt.twpsBits
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-white font-bold'
                      : autoSelectPrescaler
                      ? 'bg-slate-900/40 border-slate-800/60 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-emerald-400 font-bold">TWPS={opt.twpsBits}</span>
                    <span className="text-[10px] font-mono text-slate-400">1/{opt.factor}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">4^{opt.twpsBits} = {opt.factor} 분주</div>
                </button>
              ))}
            </div>
            {autoSelectPrescaler && (
              <p className="text-[11px] text-emerald-400/90 leading-tight">
                * 오차율이 가장 적고 TWBR 레지스터 오버플로(255 초과)를 방지하는 최적의 프리스케일러(TWPS={optimalEvaluation.twpsBits})가 자동 적용되었습니다.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Calculations & Comparison Table (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main Calculation Outcome Card */}
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/30 rounded-2xl p-5 shadow-xl space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  계산 결과 요약 (SFR Register Parameters)
                </h4>
              </div>
              <button
                onClick={() =>
                  copyToClipboard(
                    `TWBR = ${twbr}; // 0x${twbr.toString(16).padStart(2, '0').toUpperCase()}\nTWSR = (TWSR & 0xFC) | ${activeTwps}; // TWPS=${activeTwps}`,
                    'register'
                  )
                }
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition"
              >
                {copiedRegister ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedRegister ? '레지스터 복사됨' : '레지스터 설정 복사'}
              </button>
            </div>

            {/* Key Value Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* TWBR Value */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
                <div className="text-[10px] text-slate-400 font-medium">TWBR 비트레이트</div>
                <div className={`text-2xl font-black font-mono mt-0.5 ${isTooFastForCpu || isTwbrOverflow ? 'text-rose-400' : 'text-cyan-400'}`}>
                  {twbr}
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  0x{twbr.toString(16).padStart(2, '0').toUpperCase()} (8-bit)
                </div>
              </div>

              {/* TWPS Prescaler */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
                <div className="text-[10px] text-slate-400 font-medium">TWPS 프리스케일러</div>
                <div className="text-2xl font-black font-mono text-emerald-400 mt-0.5">
                  {activeTwps}
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  4^{activeTwps} = {activeEvaluation.factor} 분주
                </div>
              </div>

              {/* Actual SCL Frequency */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
                <div className="text-[10px] text-slate-400 font-medium">실제 SCL 주파수</div>
                <div className="text-2xl font-black font-mono text-white mt-0.5">
                  {actualSclKhz.toFixed(1)}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  kHz ({Math.round(actualSclHz).toLocaleString()} Hz)
                </div>
              </div>

              {/* Frequency Error Rate */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-center">
                <div className="text-[10px] text-slate-400 font-medium">클럭 주파수 오차</div>
                <div
                  className={`text-2xl font-black font-mono mt-0.5 ${
                    absError === 0
                      ? 'text-emerald-400'
                      : absError <= 2
                      ? 'text-cyan-400'
                      : absError <= 5
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {errorPercent >= 0 ? '+' : ''}{errorPercent.toFixed(2)}%
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  목표 {targetSclKhz.toFixed(1)} kHz 대비
                </div>
              </div>
            </div>

            {/* Formula Breakdown Banner */}
            <div className="bg-slate-950/90 rounded-xl p-3 border border-slate-800/80 text-xs font-mono text-slate-300 space-y-1.5">
              <div className="text-slate-400 text-[11px] flex items-center justify-between">
                <span>데이터시트 공식: SCL = F_CPU / (16 + 2 × TWBR × 4^TWPS)</span>
                <span className="text-cyan-400 font-bold">역산 공식: TWBR = ((F_CPU / SCL) - 16) / (2 × 4^TWPS)</span>
              </div>
              <div className="text-[11px] text-slate-300 bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800 overflow-x-auto whitespace-nowrap">
                TWBR = (({fcpu} / {desiredSpeedHz}) - 16) / (2 × {activeEvaluation.factor}) = ({(fcpu / desiredSpeedHz).toFixed(2)} - 16) / {2 * activeEvaluation.factor} = <strong className="text-cyan-300">{rawTwbr.toFixed(4)}</strong> ≈ <strong className="text-cyan-400">{twbr}</strong>
              </div>
            </div>

            {/* Diagnostics & Warning Alerts */}
            {isTooFastForCpu && (
              <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-300">
                <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong>[불가능한 속도 조합]</strong> 현재 F_CPU ({(fcpu / 1000000).toFixed(2)}MHz)에서는 목표 I2C 주파수({targetSclKhz}kHz)를 생성할 수 없습니다. TWBR이 음수({rawTwbr.toFixed(2)})로 산출됩니다. AVR 하드웨어 TWI 구조상 SCL은 최대 F_CPU / 16을 초과할 수 없습니다. 시스템 클럭을 올리거나 SCL 속도를 낮추십시오.
                </div>
              </div>
            )}

            {isTwbrOverflow && (
              <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong>[TWBR 오버플로 경고]</strong> 계산된 TWBR({rawTwbr.toFixed(2)})이 8비트 최대값(255)을 초과합니다. 프리스케일러(TWPS)를 더 큰 값(4, 16, 64)으로 설정하십시오.
                </div>
              </div>
            )}

            {isLowTwbrWarning && (
              <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong>[데이터시트 권장 사양 안내]</strong> ATmega 데이터시트에 따르면 마스터 모드에서 프리스케일러가 1일 때 정상 동작을 위해 <strong>TWBR ≥ 10</strong>을 권장합니다 (현재 TWBR = {twbr}). 신호 안정성을 위해 외부 풀업 저항값(2.2kΩ) 확인을 권장합니다.
                </div>
              </div>
            )}

            {!isTooFastForCpu && !isTwbrOverflow && !isLowTwbrWarning && (
              <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-300">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <strong>[최적의 설정]</strong> TWBR={twbr}, TWPS={activeTwps} 조합으로 오차율 {absError.toFixed(2)}%의 매우 정밀하고 안정적인 I2C SCL 클럭이 생성됩니다.
                </div>
              </div>
            )}
          </div>

          {/* Prescaler Matrix Comparison Table */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" /> 모든 프리스케일러(TWPS) 조합 비교표
              </span>
              <span className="text-[10px] text-slate-400 font-mono">F_CPU: {(fcpu / 1000000).toFixed(2)}MHz | 목표: {targetSclKhz}kHz</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                    <th className="py-1.5 px-2 font-semibold">TWPS 비트</th>
                    <th className="py-1.5 px-2 font-semibold">분주비 (4^TWPS)</th>
                    <th className="py-1.5 px-2 font-semibold">계산된 TWBR (정수)</th>
                    <th className="py-1.5 px-2 font-semibold">실제 주파수 (SCL)</th>
                    <th className="py-1.5 px-2 font-semibold">오차율 (%)</th>
                    <th className="py-1.5 px-2 font-semibold text-center">동작 상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {prescalerEvaluations.map((row) => {
                    const isSelected = activeTwps === row.twpsBits;
                    return (
                      <tr
                        key={row.twpsBits}
                        className={`transition cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/10 font-bold text-white'
                            : 'hover:bg-slate-900/60 text-slate-300'
                        }`}
                        onClick={() => {
                          setAutoSelectPrescaler(false);
                          setSelectedTwps(row.twpsBits);
                        }}
                      >
                        <td className="py-2 px-2 text-cyan-300">
                          TWPS = {row.twpsBits} {isSelected && <span className="text-[10px] ml-1 text-emerald-400">● 선택됨</span>}
                        </td>
                        <td className="py-2 px-2 text-slate-300">1/{row.factor}</td>
                        <td className="py-2 px-2">
                          <span className={row.isTwbrValid ? 'text-white' : 'text-rose-400 line-through'}>
                            {row.clampedTwbr}
                          </span>{' '}
                          <span className="text-[10px] text-slate-500">
                            (원값: {row.rawTwbr.toFixed(1)})
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          {(row.actualSclHz / 1000).toFixed(2)} kHz
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className={
                              row.absError <= 2
                                ? 'text-emerald-400'
                                : row.absError <= 5
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }
                          >
                            {row.errorPercent >= 0 ? '+' : ''}
                            {row.errorPercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center text-[10px]">
                          {!row.isTwbrValid ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-800/50">
                              범위초과 ({row.rawTwbr < 0 ? '<0' : '>255'})
                            </span>
                          ) : row.isTwbrWarning ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/50">
                              TWBR &lt; 10 주의
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                              정상 적용 가능
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Hardware Bus Line & Pull-up Resistor Engineering Assistant */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-purple-400" />
            <h4 className="text-sm font-bold text-white">
              I2C 하드웨어 버스 풀업 저항(R_pullup) & 상승 시간(t_r) 무결성 검증
            </h4>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {desiredSpeedHz <= 100000 ? 'Standard Mode (최대 tr ≤ 1000ns)' : 'Fast Mode (최대 tr ≤ 300ns)'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pullup Resistor Input */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 block font-medium">
              풀업 저항 값 (R_pullup)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="50"
                value={busPullupResistorKohm}
                onChange={(e) => setBusPullupResistorKohm(Math.max(0.5, parseFloat(e.target.value) || 4.7))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-purple-400"
              />
              <span className="text-xs font-mono text-slate-400">kΩ</span>
            </div>
            <div className="flex gap-1.5 pt-1">
              {[2.2, 3.3, 4.7, 10.0].map((r) => (
                <button
                  key={r}
                  onClick={() => setBusPullupResistorKohm(r)}
                  className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
                    busPullupResistorKohm === r
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {r}k
                </button>
              ))}
            </div>
          </div>

          {/* Bus Capacitance Input */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 block font-medium">
              버스 기생 용량 (C_bus)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="10"
                min="10"
                max="1000"
                value={busCapacitancePf}
                onChange={(e) => setBusCapacitancePf(Math.max(10, parseFloat(e.target.value) || 100))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-purple-400"
              />
              <span className="text-xs font-mono text-slate-400">pF</span>
            </div>
            <div className="text-[10px] text-slate-500">
              * 일반 PCB 패턴 + 커넥터 1개당 약 50~150pF (I2C 규격 상한: 400pF)
            </div>
          </div>

          {/* Calculated Rise Time Result */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
            <div>
              <div className="text-[10px] text-slate-400">예상 신호 상승 시간 ($t_r \approx 0.8473 \times R \times C$)</div>
              <div className={`text-xl font-black font-mono mt-1 ${isRiseTimeViolation ? 'text-rose-400' : 'text-purple-300'}`}>
                {busRiseTimeNs.toFixed(1)} ns
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                허용 한계: {maxAllowedRiseTimeNs} ns ({isRiseTimeViolation ? '⚠️ 규격 초과' : '✅ 규격 만족'})
              </div>
            </div>
            {isRiseTimeViolation ? (
              <div className="text-[10px] text-rose-300 mt-2 bg-rose-950/50 px-2 py-1 rounded border border-rose-800/40">
                풀업 저항이 너무 큽니다. {desiredSpeedHz >= 400000 ? '2.2kΩ' : '3.3kΩ'} 이하로 낮추어 상승 시간을 단축하십시오.
              </div>
            ) : (
              <div className="text-[10px] text-emerald-300 mt-2 bg-emerald-950/50 px-2 py-1 rounded border border-emerald-800/40">
                신호 슬루레이트와 상승 시간이 I2C 물리 계층 규격 내에 안전하게 안착합니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Code Generation Section */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Code2 className="w-4 h-4 text-cyan-400" />
            초기화 & 마스터 통신 C 소스코드 ({currentProfile.name} 하드웨어 TWI)
          </span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400 text-[11px]">슬레이브 7비트 주소:</span>
              <input
                type="text"
                value={i2cSlaveAddressHex}
                onChange={(e) => setI2cSlaveAddressHex(e.target.value)}
                className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-cyan-300 focus:outline-none"
                placeholder="0x68"
              />
            </div>
            <button
              onClick={() => copyToClipboard(generatedCCode, 'code')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-medium transition"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? '복사 완료' : 'C 코드 전체 복사'}
            </button>
          </div>
        </div>

        <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-72 custom-scrollbar leading-relaxed">
          {generatedCCode}
        </pre>
      </div>
    </div>
  );
};
