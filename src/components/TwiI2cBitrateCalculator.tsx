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
  Terminal,
  Info,
  Radio,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Layers,
  Sparkles,
  Gauge,
  RotateCcw
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

interface SclSpeedPreset {
  speedHz: number;
  label: string;
  modeName: string;
  badge: string;
  description: string;
}

const TWI_SPEED_PRESETS: SclSpeedPreset[] = [
  {
    speedHz: 50000,
    label: '50 kHz',
    modeName: 'Low-Speed Mode',
    badge: '저속 / 노이즈 내성',
    description: '긴 케이블 배선 또는 높은 기생 버스 커패시턴스 환경에서 안정적인 통신 보장'
  },
  {
    speedHz: 100000,
    label: '100 kHz',
    modeName: 'Standard Mode (Sm)',
    badge: 'I2C 표준 모드 (권장)',
    description: '가장 광범위하게 호환되는 I2C/SMBus 표준 속도. EEPROM, RTC, 센서 등 대다수 지원'
  },
  {
    speedHz: 250000,
    label: '250 kHz',
    modeName: 'Intermediate Speed',
    badge: '중간 속도',
    description: '표준 100kHz와 400kHz 사이의 균형 속도로 센서 스트리밍 대역폭 확보'
  },
  {
    speedHz: 400000,
    label: '400 kHz',
    modeName: 'Fast Mode (Fm)',
    badge: '고속 모드',
    description: 'OLED 디스플레이(SSD1306) 및 고주파 IMU 센서(MPU6050 등) 고속 데이터 전송'
  },
  {
    speedHz: 1000000,
    label: '1,000 kHz (1 MHz)',
    modeName: 'Fast Mode Plus (Fm+)',
    badge: '초고속 (하드웨어 한계)',
    description: 'AVR TWI 하드웨어 최대 한계 클록. 강력한 외부 풀업(1kΩ~2.2kΩ) 및 짧은 배선 필수'
  }
];

const CLOCK_PRESETS = [
  { fcpu: 1000000, label: '1.0 MHz', desc: '내부 RC 기본' },
  { fcpu: 4000000, label: '4.0 MHz', desc: '저전력 동작' },
  { fcpu: 8000000, label: '8.0 MHz', desc: '3.3V Pro Mini / 내부 RC' },
  { fcpu: 12000000, label: '12.0 MHz', desc: 'V-USB 클록' },
  { fcpu: 16000000, label: '16.0 MHz', desc: '표준 Uno / Mega 5V' },
  { fcpu: 20000000, label: '20.0 MHz', desc: 'AVR 정격 최대 클록' }
];

export const TwiI2cBitrateCalculator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // System Clock State
  const [fcpu, setFcpu] = useState<number>(16000000);
  const [fcpuInputMhz, setFcpuInputMhz] = useState<string>('16.0');
  const [isCustomFcpu, setIsCustomFcpu] = useState<boolean>(false);

  // Desired TWI / SCL Frequency State
  const [desiredSpeedHz, setDesiredSpeedHz] = useState<number>(100000);
  const [speedInputKhz, setSpeedInputKhz] = useState<string>('100');
  const [isCustomSpeed, setIsCustomSpeed] = useState<boolean>(false);

  // Prescaler Selection (Auto or Manual)
  const [prescalerMode, setPrescalerMode] = useState<'auto' | 'manual'>('auto');
  const [manualTwps, setManualTwps] = useState<number>(0); // 0=1, 1=4, 2=16, 3=64

  // Hardware bus parameters
  const [pullupResistanceKohm, setPullupResistanceKohm] = useState<number>(4.7);
  const [busCapacitancePf, setBusCapacitancePf] = useState<number>(100);
  const [enableInternalPullups, setEnableInternalPullups] = useState<boolean>(false);

  // Copy status
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedRegisters, setCopiedRegisters] = useState<boolean>(false);

  // Prescaler lookup table
  const PRESCALER_CONFIGS = [
    { twps: 0, factor: 1, twsrBits: '0b00', hexMask: '0x00', label: '1 분주 (4⁰ = 1)' },
    { twps: 1, factor: 4, twsrBits: '0b01', hexMask: '0x01', label: '4 분주 (4¹ = 4)' },
    { twps: 2, factor: 16, twsrBits: '0b10', hexMask: '0x02', label: '16 분주 (4² = 16)' },
    { twps: 3, factor: 64, twsrBits: '0b11', hexMask: '0x03', label: '64 분주 (4³ = 64)' }
  ];

  // Frequency handlers
  const handleSelectClockPreset = (hz: number) => {
    setFcpu(hz);
    setFcpuInputMhz((hz / 1000000).toString());
    setIsCustomFcpu(false);
  };

  const handleCustomClockChange = (mhzStr: string) => {
    setFcpuInputMhz(mhzStr);
    const mhz = parseFloat(mhzStr);
    if (!isNaN(mhz) && mhz > 0 && mhz <= 30) {
      setFcpu(Math.round(mhz * 1000000));
      setIsCustomFcpu(true);
    }
  };

  const handleSelectSpeedPreset = (hz: number) => {
    setDesiredSpeedHz(hz);
    setSpeedInputKhz((hz / 1000).toString());
    setIsCustomSpeed(false);
  };

  const handleCustomSpeedChange = (khzStr: string) => {
    setSpeedInputKhz(khzStr);
    const khz = parseFloat(khzStr);
    if (!isNaN(khz) && khz > 0 && khz <= 2000) {
      setDesiredSpeedHz(Math.round(khz * 1000));
      setIsCustomSpeed(true);
    }
  };

  // ---------------------------------------------------------------------------
  // Calculations for all 4 Prescaler Options (4^0=1, 4^1=4, 4^2=16, 4^3=64)
  // Formula:
  //   SCL = F_CPU / (16 + 2 * TWBR * (4 ^ TWPS))
  //   TWBR = ((F_CPU / SCL) - 16) / (2 * (4 ^ TWPS))
  // ---------------------------------------------------------------------------
  const prescalerResults = useMemo(() => {
    return PRESCALER_CONFIGS.map((cfg) => {
      const rawTwbr = ((fcpu / desiredSpeedHz) - 16) / (2 * cfg.factor);
      const roundedTwbr = Math.round(rawTwbr);
      const clampedTwbr = Math.max(0, Math.min(255, roundedTwbr));

      // Actual SCL frequency achievable with clamped TWBR
      const actualSclHz = fcpu / (16 + 2 * clampedTwbr * cfg.factor);
      const errorPercent = ((actualSclHz - desiredSpeedHz) / desiredSpeedHz) * 100;
      const absError = Math.abs(errorPercent);

      const isValid = rawTwbr >= 0 && rawTwbr <= 255;
      const isTooFast = rawTwbr < 0; // Frequency exceeds hardware capability
      const isOverflow = rawTwbr > 255; // Prescaler too small, TWBR overflows 8-bit
      const isWarningLowTwbr = rawTwbr >= 0 && rawTwbr < 10 && cfg.factor === 1;

      return {
        ...cfg,
        rawTwbr,
        roundedTwbr,
        clampedTwbr,
        actualSclHz,
        actualSclKhz: actualSclHz / 1000,
        errorPercent,
        absError,
        isValid,
        isTooFast,
        isOverflow,
        isWarningLowTwbr
      };
    });
  }, [fcpu, desiredSpeedHz]);

  // Determine optimal prescaler automatically
  const optimalResult = useMemo(() => {
    const validConfigs = prescalerResults.filter((r) => r.isValid);
    if (validConfigs.length > 0) {
      // Prioritize settings where TWBR >= 10 if prescaler is 1, then smallest error
      const preferred = validConfigs.filter((r) => !r.isWarningLowTwbr);
      if (preferred.length > 0) {
        return preferred.reduce((best, curr) => (curr.absError < best.absError ? curr : best));
      }
      return validConfigs.reduce((best, curr) => (curr.absError < best.absError ? curr : best));
    }
    // Fallback if none are strictly valid (e.g., requested speed is out of hardware bounds)
    return prescalerResults[0];
  }, [prescalerResults]);

  // Active prescaler & calculations based on mode
  const activeTwps = prescalerMode === 'auto' ? optimalResult.twps : manualTwps;
  const activeResult = prescalerResults.find((r) => r.twps === activeTwps) || optimalResult;

  const twbrValue = activeResult.clampedTwbr;
  const actualSclHz = activeResult.actualSclHz;
  const actualSclKhz = actualSclHz / 1000;
  const desiredSpeedKhz = desiredSpeedHz / 1000;
  const errorPercent = activeResult.errorPercent;
  const absError = Math.abs(errorPercent);

  // MCU Pinout Details
  const pinDetails = useMemo(() => {
    switch (selectedMCU) {
      case 'atmega328p':
        return {
          sdaPin: 'PC4 (Pin 27 / Arduino A4)',
          sclPin: 'PC5 (Pin 28 / Arduino A5)',
          portLetter: 'C',
          sdaBit: 4,
          sclBit: 5,
          twintVect: 'TWI_vect',
          package: '28-DIP / 32-TQFP'
        };
      case 'atmega128':
        return {
          sdaPin: 'PD1 (Pin 26)',
          sclPin: 'PD0 (Pin 25)',
          portLetter: 'D',
          sdaBit: 1,
          sclBit: 0,
          twintVect: 'TWI_vect',
          package: '64-TQFP'
        };
      case 'atmega2560':
        return {
          sdaPin: 'PD1 (Pin 44 / Arduino Mega D20)',
          sclPin: 'PD0 (Pin 43 / Arduino Mega D21)',
          portLetter: 'D',
          sdaBit: 1,
          sclBit: 0,
          twintVect: 'TWI_vect',
          package: '100-TQFP'
        };
      case 'atmega640':
      default:
        return {
          sdaPin: 'PD1 (Pin 44)',
          sclPin: 'PD0 (Pin 43)',
          portLetter: 'D',
          sdaBit: 1,
          sclBit: 0,
          twintVect: 'TWI_vect',
          package: '100-TQFP'
        };
    }
  }, [selectedMCU]);

  // Bus Rise Time (t_r) Estimation according to NXP I2C Bus Spec
  // t_r ≈ 0.8473 * R_pullup * C_bus
  const estimatedRiseTimeNs = useMemo(() => {
    const rOhms = pullupResistanceKohm * 1000;
    const cFarads = busCapacitancePf * 1e-12;
    return 0.8473 * rOhms * cFarads * 1e9;
  }, [pullupResistanceKohm, busCapacitancePf]);

  const maxAllowedRiseTimeNs = useMemo(() => {
    if (desiredSpeedHz <= 100000) return 1000; // Standard Mode: 1000 ns
    if (desiredSpeedHz <= 400000) return 300; // Fast Mode: 300 ns
    return 120; // Fast Mode Plus: 120 ns
  }, [desiredSpeedHz]);

  const isRiseTimeExceeded = estimatedRiseTimeNs > maxAllowedRiseTimeNs;

  // Binary Representation of TWBR
  const twbrBinary = twbrValue.toString(2).padStart(8, '0');
  const twpsBinary = activeTwps.toString(2).padStart(2, '0');

  // Copy helper
  const handleCopy = (text: string, type: 'code' | 'registers') => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedRegisters(true);
      setTimeout(() => setCopiedRegisters(false), 2000);
    }
    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.7 }
    });
  };

  // Generated C-Code
  const generatedCode = useMemo(() => {
    return `// ==============================================================================
// AVR Hardware TWI (I2C) Master Initialization Code
// Target MCU      : ${currentProfile.name} (${pinDetails.package})
// F_CPU           : ${fcpu} Hz (${(fcpu / 1000000).toFixed(4)} MHz)
// Target TWI SCL  : ${(desiredSpeedHz / 1000).toFixed(1)} kHz
// Actual TWI SCL  : ${actualSclKhz.toFixed(2)} kHz (오차율: ${errorPercent >= 0 ? '+' : ''}${errorPercent.toFixed(2)}%)
// Hardware Pins   : SDA = ${pinDetails.sdaPin}, SCL = ${pinDetails.sclPin}
// ==============================================================================
#define F_CPU ${fcpu}UL
#include <avr/io.h>
#include <util/twi.h>
#include <stdbool.h>

/**
 * @brief TWI (I2C) 마스터 통신 초기화
 * TWBR = ${twbrValue} (0x${twbrValue.toString(16).padStart(2, '0').toUpperCase()}, 0b${twbrBinary})
 * TWSR Prescaler = 4^${activeTwps} = ${activeResult.factor} (TWPS1:0 = 0b${twpsBinary})
 */
void TWI_Master_Init(void) {
${enableInternalPullups ? `    // 1. 내부 풀업 활성화 (외부 풀업 저항 미연결 시 임시 사용)
    PORT${pinDetails.portLetter} |= (1 << PORT${pinDetails.portLetter}${pinDetails.sdaBit}) | (1 << PORT${pinDetails.portLetter}${pinDetails.sclBit});
` : `    // 1. 외부 풀업 저항(${pullupResistanceKohm}kΩ) 사용 권장 (I2C 오픈 드레인 버스 규격 준수)`}
    // 2. TWI 비트레이트 레지스터(TWBR) 설정
    // 공식: SCL = F_CPU / (16 + 2 * TWBR * 4^TWPS)
    TWBR = ${twbrValue}; // 0x${twbrValue.toString(16).padStart(2, '0').toUpperCase()} -> 실제 SCL: ${actualSclKhz.toFixed(2)} kHz

    // 3. TWI 상태 레지스터(TWSR) 내 프리스케일러 비트(TWPS1:TWPS0) 설정
    // TWPS 값: ${activeTwps} (분주비: 4^${activeTwps} = ${activeResult.factor})
    TWSR = (TWSR & ~((1 << TWPS1) | (1 << TWPS0))) | (${activeTwps === 0 ? '0' : activeTwps === 1 ? '(1 << TWPS0)' : activeTwps === 2 ? '(1 << TWPS1)' : '(1 << TWPS1) | (1 << TWPS0)'});

    // 4. TWI 모듈 활성화 (TWEN = 1)
    TWCR = (1 << TWEN);
}

/**
 * @brief I2C START 조건 전송 및 버스 획득
 */
bool TWI_Start(uint8_t slave_address_rw) {
    // START 조건 전송 요청 (TWINT 플래그 클리어, TWSTA 비트 셋, TWEN 활성화)
    TWCR = (1 << TWINT) | (1 << TWSTA) | (1 << TWEN);
    
    // 하드웨어 전송 완료 대기 (TWINT 비트가 1이 될 때까지)
    while (!(TWCR & (1 << TWINT)));

    // 상태 코드 검사 (START 0x08 또는 REPEATED START 0x10)
    uint8_t status = TW_STATUS;
    if ((status != TW_START) && (status != TW_REP_START)) {
        return false;
    }

    // 슬레이브 7비트 주소 + R/W 비트 전송
    TWDR = slave_address_rw;
    TWCR = (1 << TWINT) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT)));

    // ACK 응답 확인 (SLA+W ACK: 0x18, SLA+R ACK: 0x40)
    status = TW_STATUS;
    if ((status != TW_MT_SLA_ACK) && (status != TW_MR_SLA_ACK)) {
        return false;
    }

    return true;
}

/**
 * @brief 1바이트 데이터 송신
 */
bool TWI_Write(uint8_t data) {
    TWDR = data;
    TWCR = (1 << TWINT) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT)));

    // 데이터 전송 후 ACK(0x28) 수신 확인
    return (TW_STATUS == TW_MT_DATA_ACK);
}

/**
 * @brief I2C STOP 조건 전송 및 버스 해제
 */
void TWI_Stop(void) {
    TWCR = (1 << TWINT) | (1 << TWEN) | (1 << TWSTO);
    // STOP 조건이 버스에 실릴 때까지 잠시 대기
    while (TWCR & (1 << TWSTO));
}
`;
  }, [
    currentProfile.name,
    pinDetails,
    fcpu,
    desiredSpeedHz,
    actualSclKhz,
    errorPercent,
    twbrValue,
    twbrBinary,
    activeTwps,
    activeResult.factor,
    twpsBinary,
    enableInternalPullups,
    pullupResistanceKohm
  ]);

  const registerSnippet = `TWBR = ${twbrValue}; // 0x${twbrValue.toString(16).padStart(2, '0').toUpperCase()} (${twbrBinary}b)\nTWSR = (TWSR & 0xF8) | ${activeTwps}; // TWPS1:0 = ${activeTwps} (4^${activeTwps} = ${activeResult.factor} 분주)`;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Component Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <Radio className="w-3.5 h-3.5" /> TWI / I2C Bitrate Calculator
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              TWBR & TWPS 레지스터 자동 산출
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-xs font-mono font-bold">
              {currentProfile.name}
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            TWI/I2C 통신속도 & TWBR 비트레이트 계산기
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            시스템 클록 주파수(F_CPU)와 목표 TWI 주파수(SCL Clock)를 선택하면,
            AVR 하드웨어 공식에 따라 필요한 <strong className="text-cyan-300 font-mono">TWBR</strong> 레지스터 값과{' '}
            <strong className="text-amber-300 font-mono">TWPS</strong> 프리스케일러 분주비를 실시간으로 계산하고 오차율을 분석합니다.
          </p>
        </div>

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
      </div>

      {/* Main Calculation Inputs & Output Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (6 Cols): Frequency Selectors & Prescaler */}
        <div className="lg:col-span-6 space-y-5">
          {/* Section 1: System Clock (F_CPU) Selection */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                1. 시스템 클록 주파수 선택 (System Clock Frequency: F_CPU)
              </label>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                {(fcpu / 1000000).toFixed(4)} MHz
              </span>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CLOCK_PRESETS.map((preset) => {
                const isSelected = !isCustomFcpu && fcpu === preset.fcpu;
                return (
                  <button
                    key={preset.fcpu}
                    onClick={() => handleSelectClockPreset(preset.fcpu)}
                    className={`p-2.5 rounded-xl text-left border transition ${
                      isSelected
                        ? 'bg-amber-500/20 text-white border-amber-500/60 shadow-md shadow-amber-950/40 ring-1 ring-amber-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold font-mono text-amber-300">{preset.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{preset.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Custom Clock Input */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800/50">
              <span className="text-xs text-slate-400 shrink-0">커스텀 주파수 직접 입력:</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.001"
                  min="0.1"
                  max="30"
                  value={fcpuInputMhz}
                  onChange={(e) => handleCustomClockChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                  placeholder="예: 16.0"
                />
                <span className="absolute right-3 top-1.5 text-xs text-slate-500 font-mono">MHz</span>
              </div>
            </div>
          </div>

          {/* Section 2: Desired TWI Bus Frequency */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-cyan-400" />
                2. 목표 TWI / I2C 버스 주파수 선택 (Desired SCL Frequency)
              </label>
              <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
                {(desiredSpeedHz / 1000).toFixed(1)} kHz
              </span>
            </div>

            {/* Speed Presets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TWI_SPEED_PRESETS.map((preset) => {
                const isSelected = !isCustomSpeed && desiredSpeedHz === preset.speedHz;
                return (
                  <button
                    key={preset.speedHz}
                    onClick={() => handleSelectSpeedPreset(preset.speedHz)}
                    className={`p-3 rounded-xl text-left border transition ${
                      isSelected
                        ? 'bg-cyan-950/40 text-white border-cyan-500/60 shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold font-mono text-cyan-300">{preset.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-sans">
                        {preset.badge}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 font-medium mt-1">{preset.modeName}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{preset.description}</div>
                  </button>
                );
              })}
            </div>

            {/* Custom Speed Input */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800/50">
              <span className="text-xs text-slate-400 shrink-0">임의 SCL 주파수 입력:</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="2000"
                  value={speedInputKhz}
                  onChange={(e) => handleCustomSpeedChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                  placeholder="예: 100"
                />
                <span className="absolute right-3 top-1.5 text-xs text-slate-500 font-mono">kHz</span>
              </div>
            </div>
          </div>

          {/* Section 3: Prescaler Control (Auto vs Manual) */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-purple-400" />
                3. TWI 프리스케일러 모드 (TWPS Prescaler Mode)
              </label>
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setPrescalerMode('auto')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    prescalerMode === 'auto'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  자동 최적 탐색 (Auto)
                </button>
                <button
                  onClick={() => setPrescalerMode('manual')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    prescalerMode === 'manual'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  수동 선택 (Manual)
                </button>
              </div>
            </div>

            {prescalerMode === 'manual' ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {PRESCALER_CONFIGS.map((cfg) => {
                  const isSelected = manualTwps === cfg.twps;
                  return (
                    <button
                      key={cfg.twps}
                      onClick={() => setManualTwps(cfg.twps)}
                      className={`p-2.5 rounded-xl border text-center font-mono transition ${
                        isSelected
                          ? 'bg-purple-950/50 text-white border-purple-500 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="font-bold text-purple-300">TWPS = {cfg.twps}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{cfg.label}</div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-purple-950/30 border border-purple-800/40 rounded-xl text-xs">
                <div className="space-y-0.5">
                  <span className="text-purple-300 font-bold block">
                    자동 추천 최적 프리스케일러: 4^{optimalResult.twps} = {optimalResult.factor} 분주 (TWPS = {optimalResult.twps})
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    TWBR 유효 범위 [0, 255] 내에서 최소 통신 오차율을 갖는 분주비를 자동 채택했습니다.
                  </span>
                </div>
                <CheckCircle className="w-5 h-5 text-purple-400 shrink-0" />
              </div>
            )}
          </div>
        </div>

        {/* Right Column (6 Cols): Results Display & Register Visualization */}
        <div className="lg:col-span-6 space-y-5">
          {/* Main Calculation Result Box */}
          <div className="bg-slate-950/90 border border-cyan-500/40 rounded-2xl p-5 shadow-xl shadow-cyan-950/30 relative overflow-hidden space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                산출된 TWI 비트레이트 결과 (Calculated Outputs)
              </span>
              <button
                onClick={() => handleCopy(registerSnippet, 'registers')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition"
              >
                {copiedRegisters ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedRegisters ? '복사됨!' : '레지스터값 복사'}</span>
              </button>
            </div>

            {/* High-Impact Stat Badges */}
            <div className="grid grid-cols-2 gap-3 text-center">
              {/* TWBR Value */}
              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-mono">TWBR 레지스터 값</span>
                <span className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono tracking-tight block my-0.5">
                  {twbrValue}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  0x{twbrValue.toString(16).padStart(2, '0').toUpperCase()} • 0b{twbrBinary}
                </span>
              </div>

              {/* TWPS Prescaler Setting */}
              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-mono">TWPS 프리스케일러</span>
                <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight block my-0.5">
                  {activeResult.factor} 분주
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  TWPS1:0 = 0b{twpsBinary} (TWSR Bits 1:0)
                </span>
              </div>
            </div>

            {/* Precision & Error Breakdown */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">목표 주파수 (Target SCL):</span>
                <span className="text-white font-bold">{desiredSpeedKhz.toFixed(2)} kHz ({desiredSpeedHz.toLocaleString()} Hz)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">실제 달성 주파수 (Actual SCL):</span>
                <span className="text-cyan-300 font-bold">{actualSclKhz.toFixed(2)} kHz ({Math.round(actualSclHz).toLocaleString()} Hz)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">주파수 통신 오차율 (Error Rate):</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded ${
                    absError === 0
                      ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/40'
                      : absError <= 1.0
                      ? 'text-emerald-400 bg-emerald-950/40'
                      : absError <= 3.0
                      ? 'text-amber-400 bg-amber-950/40'
                      : 'text-rose-400 bg-rose-950/40'
                  }`}
                >
                  {errorPercent >= 0 ? '+' : ''}{errorPercent.toFixed(2)}%
                  {absError === 0 ? ' (완벽 일치)' : absError <= 1.0 ? ' (매우 우수)' : absError <= 3.0 ? ' (허용 가능)' : ' (오차 주의)'}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-800/70 pt-2">
                <span className="text-slate-400">하드웨어 I2C 핀:</span>
                <span className="text-emerald-400 font-bold">{pinDetails.sdaPin} / {pinDetails.sclPin}</span>
              </div>
            </div>

            {/* Validation & Warning Notice */}
            {activeResult.isTooFast && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong>요청 주파수 초과:</strong> 현재 F_CPU({(fcpu / 1000000).toFixed(1)}MHz)에서 하드웨어 최대 SCL은{' '}
                  {(fcpu / 16 / 1000).toFixed(0)} kHz입니다. TWBR이 0 미만이므로 달성할 수 없습니다.
                </div>
              </div>
            )}

            {activeResult.isWarningLowTwbr && (
              <div className="p-3 bg-amber-950/40 border border-amber-800/50 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong>데이터시트 권고 사항:</strong> 마스터 모드(1분주)에서 TWBR &lt; 10({twbrValue})일 경우 버스 노이즈나 슬루레이트 변동에 의해 SCL 대칭성이 저하될 수 있습니다. 필요 시 분주비를 변경하거나 외부 풀업 저항을 2.2kΩ 수준으로 보강하세요.
                </div>
              </div>
            )}
          </div>

          {/* Prescaler Matrix Comparison Table */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2.5">
            <span className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" /> 4개 프리스케일러별 계산 비교표 (Prescaler Matrix)
              </span>
              <span className="text-[11px] text-slate-500 font-mono">4⁰, 4¹, 4², 4³ 비교</span>
            </span>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                    <th className="py-2 px-2.5">TWPS</th>
                    <th className="py-2 px-2.5">분주비</th>
                    <th className="py-2 px-2.5">TWBR</th>
                    <th className="py-2 px-2.5">실제 SCL</th>
                    <th className="py-2 px-2.5">오차율</th>
                    <th className="py-2 px-2.5 text-right">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {prescalerResults.map((row) => {
                    const isRowActive = row.twps === activeTwps;
                    return (
                      <tr
                        key={row.twps}
                        className={`transition ${
                          isRowActive
                            ? 'bg-cyan-950/30 text-white font-bold'
                            : 'text-slate-400 hover:bg-slate-900/50'
                        }`}
                      >
                        <td className="py-2 px-2.5">
                          <span className={isRowActive ? 'text-cyan-400' : ''}>{row.twps}</span>
                        </td>
                        <td className="py-2 px-2.5">{row.factor}x</td>
                        <td className="py-2 px-2.5">
                          <span
                            className={
                              row.isValid
                                ? isRowActive
                                  ? 'text-cyan-300 font-bold'
                                  : 'text-slate-200'
                                : 'text-rose-400 line-through'
                            }
                          >
                            {row.clampedTwbr}
                          </span>
                        </td>
                        <td className="py-2 px-2.5">{row.actualSclKhz.toFixed(1)} kHz</td>
                        <td className="py-2 px-2.5">
                          <span
                            className={
                              row.absError <= 1.0
                                ? 'text-emerald-400'
                                : row.absError <= 5.0
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }
                          >
                            {row.errorPercent >= 0 ? '+' : ''}{row.errorPercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-right">
                          {row.twps === optimalResult.twps && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40">
                              최적
                            </span>
                          )}
                          {!row.isValid && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              범위초과
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

      {/* Section 4: Formula Walkthrough & Register Bitfield Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Formula Math Walkthrough Card */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
          <span className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <Calculator className="w-3.5 h-3.5 text-amber-400" />
            데이터시트 공식 유도 및 계산 단계 (Datasheet Mathematical Derivation)
          </span>

          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2 font-mono text-xs">
            <div className="text-slate-400 text-[11px]">1. 표준 AVR TWI 마스터 주파수 공식:</div>
            <div className="p-2 bg-slate-950 rounded border border-slate-800/80 text-amber-300 font-bold">
              SCL = F_CPU / (16 + 2 * TWBR * (4^TWPS))
            </div>

            <div className="text-slate-400 text-[11px] pt-1">2. TWBR에 대하여 정리:</div>
            <div className="p-2 bg-slate-950 rounded border border-slate-800/80 text-cyan-300 font-bold">
              TWBR = ((F_CPU / SCL) - 16) / (2 * (4^TWPS))
            </div>

            <div className="text-slate-400 text-[11px] pt-1">3. 현재 파라미터 대입 계산:</div>
            <div className="p-2 bg-slate-950 rounded border border-slate-800/80 text-emerald-300 text-[11px] leading-relaxed">
              TWBR = (({fcpu} / {desiredSpeedHz}) - 16) / (2 * {activeResult.factor})<br />
              TWBR = ({(fcpu / desiredSpeedHz).toFixed(2)} - 16) / {2 * activeResult.factor} = <strong className="text-white text-xs">{activeResult.rawTwbr.toFixed(4)}</strong> ➔ <strong className="text-amber-400 text-xs">{twbrValue}</strong>
            </div>
          </div>
        </div>

        {/* Register Bit-Field Visualizer (TWBR & TWSR) */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
          <span className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            하드웨어 SFR 비트필드 맵 (TWBR & TWSR Register Layout)
          </span>

          <div className="space-y-3 font-mono text-xs">
            {/* TWBR 8-bit */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span className="font-bold text-cyan-300">TWBR (TWI Bit Rate Register, 8-bit)</span>
                <span>값: {twbrValue} (0x{twbrValue.toString(16).padStart(2, '0').toUpperCase()})</span>
              </div>
              <div className="grid grid-cols-8 gap-1 text-center">
                {twbrBinary.split('').map((bit, idx) => (
                  <div
                    key={idx}
                    className={`p-1.5 rounded-lg border text-xs font-bold ${
                      bit === '1'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    <div className="text-[9px] text-slate-500 font-normal">Bit {7 - idx}</div>
                    <div>{bit}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* TWSR with TWPS1:0 highlighted */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span className="font-bold text-amber-300">TWSR (TWI Status Register, Bits 1:0 = TWPS1:0)</span>
                <span>분주비: 4^{activeTwps} ({activeResult.factor}x)</span>
              </div>
              <div className="grid grid-cols-8 gap-1 text-center">
                {['TWS7', 'TWS6', 'TWS5', 'TWS4', 'TWS3', '—', 'TWPS1', 'TWPS0'].map((name, idx) => {
                  const isTwpsBit = idx === 6 || idx === 7;
                  const bitVal = idx === 6 ? twpsBinary[0] : idx === 7 ? twpsBinary[1] : 'S';
                  return (
                    <div
                      key={idx}
                      className={`p-1.5 rounded-lg border text-xs font-bold ${
                        isTwpsBit
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 ring-1 ring-amber-500/40'
                          : 'bg-slate-900 text-slate-600 border-slate-800'
                      }`}
                    >
                      <div className="text-[9px] text-slate-500 font-normal truncate">{name}</div>
                      <div>{bitVal}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 5: Pull-up Resistor & Bus Rise Time (t_r) Calculator */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            하드웨어 풀업 저항(Pull-up) 및 상승 시간(Rise Time, t_r) 검증
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            NXP I2C Bus Specification v6 기준
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Pullup Resistor Input */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 block">외부 풀업 저항 (R_pullup)</label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="50"
                value={pullupResistanceKohm}
                onChange={(e) => setPullupResistanceKohm(parseFloat(e.target.value) || 4.7)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
              />
              <span className="absolute right-3 top-1.5 text-slate-500 font-mono">kΩ</span>
            </div>
          </div>

          {/* Bus Capacitance Input */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 block">버스 기생 커패시턴스 (C_bus)</label>
            <div className="relative">
              <input
                type="number"
                step="5"
                min="10"
                max="400"
                value={busCapacitancePf}
                onChange={(e) => setBusCapacitancePf(parseFloat(e.target.value) || 100)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
              />
              <span className="absolute right-3 top-1.5 text-slate-500 font-mono">pF</span>
            </div>
          </div>

          {/* Rise Time Result Box */}
          <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">예상 상승 시간 (t_r):</span>
              <span className={`font-mono font-bold ${isRiseTimeExceeded ? 'text-rose-400' : 'text-emerald-400'}`}>
                {estimatedRiseTimeNs.toFixed(1)} ns
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px] mt-1 pt-1 border-t border-slate-800">
              <span className="text-slate-400">규격 최대 한계:</span>
              <span className="text-slate-300 font-mono">{maxAllowedRiseTimeNs} ns ({isRiseTimeExceeded ? '⚠️ 초과' : '✅ 규격 준수'})</span>
            </div>
          </div>
        </div>

        <div className="pt-1 flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={enableInternalPullups}
              onChange={(e) => setEnableInternalPullups(e.target.checked)}
              className="accent-emerald-500 rounded cursor-pointer"
            />
            <span>내부 풀업 저항 병렬 활성화 코드 포함 (PORTx 레지스터 셋)</span>
          </label>
          <span className="text-[11px] text-slate-500">
            * 400kHz 고속 통신 시 2.2kΩ~4.7kΩ 외부 풀업 저항 장착 필수
          </span>
        </div>
      </div>

      {/* Section 6: C Code Generator & Output Preview */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold text-white">
              C 언어 TWI 마스터 초기화 & 통신 드라이버 ({currentProfile.name})
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              TWBR={twbrValue} • TWPS={activeTwps}
            </span>
          </div>

          <button
            onClick={() => handleCopy(generatedCode, 'code')}
            className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-cyan-600/20"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? '복사 완료!' : 'C 소스코드 복사'}</span>
          </button>
        </div>

        <pre className="p-4 overflow-x-auto max-h-[380px] overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed bg-slate-950 custom-scrollbar select-all">
          {generatedCode}
        </pre>
      </div>
    </div>
  );
};
