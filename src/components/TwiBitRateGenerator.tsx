import React, { useState, useMemo } from 'react';
import {
  Network,
  Clock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Cpu,
  Layers,
  Sliders,
  Terminal,
  Activity,
  Gauge,
  Info,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Sparkles
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface TwiBitRateGeneratorProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

interface ClockPreset {
  freq: number;
  label: string;
  desc: string;
}

const CLOCK_PRESETS: ClockPreset[] = [
  { freq: 16000000, label: '16.0 MHz', desc: 'Arduino Uno / Mega (기본 5V)' },
  { freq: 8000000, label: '8.0 MHz', desc: '내부 RC / 3.3V Pro Mini' },
  { freq: 20000000, label: '20.0 MHz', desc: 'AVR 정격 최대 클럭 (5V)' },
  { freq: 12000000, label: '12.0 MHz', desc: 'V-USB 표준 크리스탈' },
  { freq: 11059200, label: '11.0592 MHz', desc: 'UART 황금 크리스탈' },
  { freq: 4000000, label: '4.0 MHz', desc: '저전력 크리스탈' },
  { freq: 1000000, label: '1.0 MHz', desc: '공장 기본 (8MHz / CKDIV8)' }
];

interface TwiSpeedPreset {
  rate: number;
  label: string;
  mode: 'Standard-mode (Sm)' | 'Fast-mode (Fm)' | 'Slow-mode' | 'Custom';
  desc: string;
  maxRiseNs: number;
  minLowUs: number;
  minHighUs: number;
}

const TWI_SPEED_PRESETS: TwiSpeedPreset[] = [
  {
    rate: 100000,
    label: '100 kHz',
    mode: 'Standard-mode (Sm)',
    desc: '산업 및 센서 표준 속도 (BMP280, DS3231, EEPROM 등)',
    maxRiseNs: 1000,
    minLowUs: 4.7,
    minHighUs: 4.0
  },
  {
    rate: 400000,
    label: '400 kHz',
    mode: 'Fast-mode (Fm)',
    desc: '고속 디스플레이/센서 (SSD1306 OLED, MPU6050 IMU)',
    maxRiseNs: 300,
    minLowUs: 1.3,
    minHighUs: 0.6
  },
  {
    rate: 50000,
    label: '50 kHz',
    mode: 'Slow-mode',
    desc: '긴 배선 및 노이즈 환경 (배선 용량 > 200pF)',
    maxRiseNs: 1000,
    minLowUs: 9.4,
    minHighUs: 8.0
  },
  {
    rate: 250000,
    label: '250 kHz',
    mode: 'Custom',
    desc: '안정성과 속도의 절충형 중속 모드',
    maxRiseNs: 500,
    minLowUs: 2.0,
    minHighUs: 1.5
  },
  {
    rate: 10000,
    label: '10 kHz',
    mode: 'Slow-mode',
    desc: 'SMBus 호환 / 극한의 원거리 통신',
    maxRiseNs: 1000,
    minLowUs: 47.0,
    minHighUs: 40.0
  }
];

interface PrescalerCalcResult {
  twpsIndex: number; // 0, 1, 2, 3
  twpsBits: '00' | '01' | '10' | '11';
  prescalerFactor: number; // 1, 4, 16, 64
  twbrExact: number;
  twbrInt: number;
  twbrHex: string;
  actualSclHz: number;
  actualSclKhz: number;
  errorPercent: number;
  periodUs: number;
  halfPeriodUs: number;
  isValid: boolean;
  isOverLimit: boolean;
  isNegative: boolean;
  isLowTwbrWarning: boolean; // TWBR < 10 warning for Master mode
  statusLevel: 'optimal' | 'acceptable' | 'warning' | 'invalid';
  statusMessage: string;
}

export const TwiBitRateGenerator: React.FC<TwiBitRateGeneratorProps> = ({
  selectedMCU
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Frequency inputs
  const [fosc, setFosc] = useState<number>(16000000);
  const [customFoscMhz, setCustomFoscMhz] = useState<string>('16.0');
  const [isCustomFosc, setIsCustomFosc] = useState<boolean>(false);

  // Desired TWI Bit Rate
  const [desiredSclHz, setDesiredSclHz] = useState<number>(100000);
  const [customSclKhz, setCustomSclKhz] = useState<string>('100.0');
  const [isCustomScl, setIsCustomScl] = useState<boolean>(false);

  // Selected Prescaler for detail inspection (defaults to best match)
  const [userSelectedPrescaler, setUserSelectedPrescaler] = useState<number | null>(null);

  // Bus Pull-up resistor estimation params
  const [busVcc, setBusVcc] = useState<number>(5.0); // 5.0V or 3.3V
  const [busCapacitancePf, setBusCapacitancePf] = useState<number>(100); // 100pF

  // UI state
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [includeFullExample, setIncludeFullExample] = useState<boolean>(true);

  // Sync clock when preset button clicked
  const handleSelectClockPreset = (freq: number) => {
    setFosc(freq);
    setCustomFoscMhz((freq / 1000000).toString());
    setIsCustomFosc(false);
  };

  const handleCustomFoscChange = (valStr: string) => {
    setCustomFoscMhz(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 30) {
      setFosc(Math.round(parsed * 1000000));
    }
  };

  // Sync SCL preset
  const handleSelectSclPreset = (rate: number) => {
    setDesiredSclHz(rate);
    setCustomSclKhz((rate / 1000).toString());
    setIsCustomScl(false);
  };

  const handleCustomSclChange = (valStr: string) => {
    setCustomSclKhz(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 1000) {
      setDesiredSclHz(Math.round(parsed * 1000));
    }
  };

  // Prescalers: 4^0=1, 4^1=4, 4^2=16, 4^3=64
  const PRESCALERS = [
    { index: 0, bits: '00' as const, factor: 1 },
    { index: 1, bits: '01' as const, factor: 4 },
    { index: 2, bits: '10' as const, factor: 16 },
    { index: 3, bits: '11' as const, factor: 64 }
  ];

  // Calculate results for all 4 prescaler options
  const prescalerResults: PrescalerCalcResult[] = useMemo(() => {
    return PRESCALERS.map((ps) => {
      // Formula: SCL = f_CPU / (16 + 2 * TWBR * 4^TWPS)
      // => TWBR = ((f_CPU / SCL) - 16) / (2 * 4^TWPS)
      const twbrExact = (fosc / desiredSclHz - 16) / (2 * ps.factor);
      const twbrInt = Math.round(twbrExact);
      const isNegative = twbrExact < 0;
      const isOverLimit = twbrInt > 255;
      const isValid = !isNegative && !isOverLimit && twbrInt >= 0 && twbrInt <= 255;

      // Actual SCL achieved
      let actualSclHz = 0;
      let actualSclKhz = 0;
      let errorPercent = 0;
      let periodUs = 0;
      let halfPeriodUs = 0;

      if (!isNegative) {
        // Clamp for safety in formula
        const clampedTwbr = Math.max(0, Math.min(255, twbrInt));
        actualSclHz = fosc / (16 + 2 * clampedTwbr * ps.factor);
        actualSclKhz = actualSclHz / 1000;
        errorPercent = ((actualSclHz - desiredSclHz) / desiredSclHz) * 100;
        periodUs = (1 / actualSclHz) * 1000000;
        halfPeriodUs = periodUs / 2;
      }

      // Check datasheet recommendation: TWBR >= 10 for master mode stability
      const isLowTwbrWarning = isValid && twbrInt < 10;

      let statusLevel: 'optimal' | 'acceptable' | 'warning' | 'invalid' = 'invalid';
      let statusMessage = '';

      if (isNegative) {
        statusLevel = 'invalid';
        statusMessage = `클럭(${fosc / 1000000}MHz) 대비 목표 주파수 초과 (최대: ${(fosc / 16 / 1000).toFixed(1)}kHz)`;
      } else if (isOverLimit) {
        statusLevel = 'invalid';
        statusMessage = `8비트 레지스터 오버플로우 (TWBR=${twbrInt} > 255)`;
      } else if (isLowTwbrWarning) {
        statusLevel = 'warning';
        statusMessage = `동작 가능하나 마스터 모드 권장(TWBR≥10) 미달 (안정성 저하 가능)`;
      } else if (Math.abs(errorPercent) <= 2.0) {
        statusLevel = 'optimal';
        statusMessage = '최적의 설정 (정밀 오차 2% 이내 & TWBR≥10 준수)';
      } else {
        statusLevel = 'acceptable';
        statusMessage = `동작 가능 (오차: ${errorPercent > 0 ? '+' : ''}${errorPercent.toFixed(2)}%)`;
      }

      const twbrHex = isValid
        ? '0x' + twbrInt.toString(16).toUpperCase().padStart(2, '0')
        : '--';

      return {
        twpsIndex: ps.index,
        twpsBits: ps.bits,
        prescalerFactor: ps.factor,
        twbrExact,
        twbrInt,
        twbrHex,
        actualSclHz,
        actualSclKhz,
        errorPercent,
        periodUs,
        halfPeriodUs,
        isValid,
        isOverLimit,
        isNegative,
        isLowTwbrWarning,
        statusLevel,
        statusMessage
      };
    });
  }, [fosc, desiredSclHz]);

  // Determine the best overall prescaler recommendation
  const bestPrescalerIndex = useMemo(() => {
    // 1st priority: valid, TWBR >= 10, lowest absolute error
    const masterSafe = prescalerResults.filter((r) => r.isValid && !r.isLowTwbrWarning);
    if (masterSafe.length > 0) {
      masterSafe.sort((a, b) => {
        const errA = Math.abs(a.errorPercent);
        const errB = Math.abs(b.errorPercent);
        if (Math.abs(errA - errB) < 0.05) {
          // If error is practically identical, pick higher TWBR (lower prescaler) for finer resolution
          return b.twbrInt - a.twbrInt;
        }
        return errA - errB;
      });
      return masterSafe[0].twpsIndex;
    }

    // 2nd priority: valid (TWBR < 10 allowed if unavoidable), lowest error
    const anyValid = prescalerResults.filter((r) => r.isValid);
    if (anyValid.length > 0) {
      anyValid.sort((a, b) => Math.abs(a.errorPercent) - Math.abs(b.errorPercent));
      return anyValid[0].twpsIndex;
    }

    // Fallback: 0
    return 0;
  }, [prescalerResults]);

  // Active prescaler (user selected or auto recommended)
  const activePrescalerIndex = userSelectedPrescaler !== null ? userSelectedPrescaler : bestPrescalerIndex;
  const activeResult = prescalerResults[activePrescalerIndex] || prescalerResults[0];

  // MCU Pin mapping info for TWI
  const twiPinInfo = useMemo(() => {
    switch (selectedMCU) {
      case 'atmega328p':
        return {
          sclPin: 'PC5 (Pin 28 / Arduino A5)',
          sdaPin: 'PC4 (Pin 27 / Arduino A4)',
          port: 'PORTC',
          ddr: 'DDRC',
          pinReg: 'PINC',
          sclBit: 'PORTC5',
          sdaBit: 'PORTC4',
          note: '아두이노 우노의 I2C 전용 헤더는 물리적으로 A4(SDA), A5(SCL)와 직결되어 있습니다.'
        };
      case 'atmega2560':
      case 'atmega640':
        return {
          sclPin: 'PD0 (Pin 43 / Arduino Mega Pin 21)',
          sdaPin: 'PD1 (Pin 44 / Arduino Mega Pin 20)',
          port: 'PORTD',
          ddr: 'DDRD',
          pinReg: 'PIND',
          sclBit: 'PORTD0',
          sdaBit: 'PORTD1',
          note: '아두이노 메가에서는 통신 핀 20(SDA), 21(SCL)에 하드웨어 풀업 저항(10kΩ)이 장착되어 있습니다.'
        };
      case 'atmega128':
        return {
          sclPin: 'PD0 (Pin 25)',
          sdaPin: 'PD1 (Pin 26)',
          port: 'PORTD',
          ddr: 'DDRD',
          pinReg: 'PIND',
          sclBit: 'PORTD0',
          sdaBit: 'PORTD1',
          note: '외부 풀업 저항 4.7kΩ을 VCC에 필히 연결해야 오픈 드레인 신호가 정상 상승합니다.'
        };
      default:
        return {
          sclPin: 'SCL Pin',
          sdaPin: 'SDA Pin',
          port: 'PORT',
          ddr: 'DDR',
          pinReg: 'PIN',
          sclBit: 'SCL',
          sdaBit: 'SDA',
          note: '하드웨어 오픈 드레인 핀에 외부 풀업 저항을 연결하십시오.'
        };
    }
  }, [selectedMCU]);

  // Bus Pull-up resistor calculations
  // Rp_min = (Vcc - Vol_max) / Iol = (Vcc - 0.4V) / 3mA
  // Rp_max = tr_max / (0.8473 * Cb)
  const pullUpCalc = useMemo(() => {
    const volMax = 0.4; // 0.4V max low voltage
    const iolMax = 0.003; // 3mA standard sink current
    const rpMinKohm = ((busVcc - volMax) / iolMax) / 1000;

    // Determine max rise time based on SCL speed
    // 100kHz standard mode: 1000ns; 400kHz fast mode: 300ns
    const trMaxNs = desiredSclHz <= 100000 ? 1000 : desiredSclHz <= 400000 ? 300 : 120;
    const cbFarad = busCapacitancePf * 1e-12;
    const trSecond = trMaxNs * 1e-9;
    const rpMaxOhm = trSecond / (0.8473 * cbFarad);
    const rpMaxKohm = rpMaxOhm / 1000;

    // Recommended standard resistor
    let recResistor = '4.7 kΩ';
    let recReason = '표준 100kHz 버스에 가장 널리 쓰이는 표준 풀업 값입니다.';
    if (desiredSclHz > 100000 || busCapacitancePf > 150) {
      recResistor = '2.2 kΩ';
      recReason = 'Fast-mode (400kHz) 또는 높은 버스 커패시턴스에서 빠른 상승 시간(tr ≤ 300ns)을 보장합니다.';
    } else if (busCapacitancePf <= 50 && desiredSclHz <= 50000) {
      recResistor = '10 kΩ';
      recReason = '초저전력 및 저용량 버스에서 전류 소모를 최소화합니다.';
    }

    return {
      rpMinKohm: rpMinKohm.toFixed(2),
      rpMaxKohm: rpMaxKohm.toFixed(2),
      trMaxNs,
      recResistor,
      recReason
    };
  }, [busVcc, busCapacitancePf, desiredSclHz]);

  // Generated C Code
  const generatedCode = useMemo(() => {
    const twbrVal = activeResult.isValid ? activeResult.twbrInt : 12;
    const twbrHex = activeResult.isValid ? activeResult.twbrHex : '0x0C';
    const ps = activeResult.twpsIndex;
    const psBits = activeResult.twpsBits;

    let twsrComment = '';
    let twsrCode = '';
    if (ps === 0) {
      twsrComment = '// TWPS1=0, TWPS0=0 (Prescaler = 1)';
      twsrCode = '    TWSR &= ~((1 << TWPS1) | (1 << TWPS0));';
    } else if (ps === 1) {
      twsrComment = '// TWPS1=0, TWPS0=1 (Prescaler = 4)';
      twsrCode = '    TWSR = (TWSR & ~(1 << TWPS1)) | (1 << TWPS0);';
    } else if (ps === 2) {
      twsrComment = '// TWPS1=1, TWPS0=0 (Prescaler = 16)';
      twsrCode = '    TWSR = (TWSR & ~(1 << TWPS0)) | (1 << TWPS1);';
    } else {
      twsrComment = '// TWPS1=1, TWPS0=1 (Prescaler = 64)';
      twsrCode = '    TWSR |= (1 << TWPS1) | (1 << TWPS0);';
    }

    if (!includeFullExample) {
      return `/* AVR TWI (I2C) 초기화 간략 코드 - ${currentProfile.name}
 * 시스템 클럭: ${(fosc / 1000000).toFixed(4)} MHz
 * 목표 SCL: ${(desiredSclHz / 1000).toFixed(1)} kHz (실제: ${activeResult.actualSclKhz.toFixed(2)} kHz, 오차: ${activeResult.errorPercent.toFixed(2)}%)
 */
void twi_init(void) {
    // 1. TWI 비트레이트 레지스터 설정 (TWBR = ${twbrVal})
    TWBR = ${twbrHex};

    // 2. TWI 상태 레지스터 프리스케일러 설정 ${twsrComment}
${twsrCode}

    // 3. TWI 하드웨어 활성화 (TWEN)
    TWCR = (1 << TWEN);
}`;
    }

    return `/* ===================================================================
 * AVR TWI (I2C Master) 하드웨어 드라이버 초기화 및 기본 송수신
 * 타겟 MCU : ${currentProfile.name} (${currentProfile.fullName})
 * 시스템 클럭 (F_CPU) : ${(fosc / 1000000).toFixed(4)} MHz
 * 목표 SCL 주파수      : ${(desiredSclHz / 1000).toFixed(1)} kHz
 * 실제 생성 주파수     : ${activeResult.actualSclKhz.toFixed(2)} kHz (오차: ${activeResult.errorPercent > 0 ? '+' : ''}${activeResult.errorPercent.toFixed(2)}%)
 * 하드웨어 핀         : SCL = ${twiPinInfo.sclPin}, SDA = ${twiPinInfo.sdaPin}
 * =================================================================== */

#define F_CPU ${fosc}UL
#include <avr/io.h>
#include <util/twi.h>

/**
 * @brief TWI (I2C) 마스터 모드 하드웨어 초기화
 */
void twi_init(void) {
    // 1. SDA / SCL 내부 풀업 활성화 (외부 풀업 저항 장착 강력 권장)
    ${twiPinInfo.port} |= (1 << ${twiPinInfo.sdaBit}) | (1 << ${twiPinInfo.sclBit});

    // 2. 비트레이트 레지스터 설정 (TWBR = ${twbrVal})
    // 공식: SCL = F_CPU / (16 + 2 * TWBR * 4^TWPS)
    TWBR = ${twbrHex};

    // 3. 프리스케일러 설정 (TWPS[1:0] = 0b${psBits}, 분주비 = ${activeResult.prescalerFactor})
${twsrCode}

    // 4. TWI 모듈 활성화
    TWCR = (1 << TWEN);
}

/**
 * @brief I2C START 조건 생성 및 대기
 */
uint8_t twi_start(void) {
    TWCR = (1 << TWINT) | (1 << TWSTA) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT))); // 플래그 셋 대기
    
    // 상태 레지스터 하위 3비트(프리스케일러) 마스킹 후 상태 검증
    uint8_t status = TW_STATUS; // (TWSR & 0xF8)
    if ((status != TW_START) && (status != TW_REP_START)) {
        return 0; // START 실패
    }
    return 1;
}

/**
 * @brief I2C 1바이트 데이터 송신 (주소 또는 데이터)
 */
uint8_t twi_write(uint8_t data) {
    TWDR = data;
    TWCR = (1 << TWINT) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT))); // 전송 완료 대기

    uint8_t status = TW_STATUS;
    // SLA+W ACK(0x18), SLA+R ACK(0x40), DATA ACK(0x28) 수신 여부 확인
    if ((status == TW_MT_SLA_ACK) || (status == TW_MR_SLA_ACK) || (status == TW_MT_DATA_ACK)) {
        return 1; // ACK 수신 성공
    }
    return 0; // NACK 수신
}

/**
 * @brief I2C STOP 조건 생성
 */
void twi_stop(void) {
    TWCR = (1 << TWINT) | (1 << TWSTO) | (1 << TWEN);
}`;
  }, [currentProfile, fosc, desiredSclHz, activeResult, twiPinInfo, includeFullExample]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md shadow-2xl space-y-6">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-semibold mb-2">
            <Network className="w-3.5 h-3.5 text-cyan-400" />
            <span>AVR 하드웨어 통신 서브시스템</span>
            <span className="text-slate-500">•</span>
            <span className="text-white font-mono">{currentProfile.name} TWI (I2C) Bit Rate Generator</span>
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            TWI (I2C) 비트레이트 발생기 & TWBR / TWSR 프리스케일러 분석기
          </h3>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            시스템 클럭(<span className="text-cyan-300 font-mono">f_CPU</span>)과 목표 통신 속도(<span className="text-cyan-300 font-mono">SCL</span>)를 입력하면 
            AVR 하드웨어 8비트 <strong className="text-white font-mono">TWBR</strong> 레지스터와 
            <strong className="text-white font-mono"> TWSR (TWPS1:0)</strong> 프리스케일러 4단계 분주비를 즉각 연산하여 
            오차율 및 버스 안정성을 실시간으로 검증합니다.
          </p>
        </div>

        {/* Target Hardware Summary Pill */}
        <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 p-3 rounded-xl shrink-0">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">선택된 MCU TWI 하드웨어</div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>{currentProfile.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                {currentProfile.package.split(' ')[0]}
              </span>
            </div>
            <div className="text-[11px] font-mono text-cyan-300">
              SCL: {twiPinInfo.sclPin.split(' ')[0]} | SDA: {twiPinInfo.sdaPin.split(' ')[0]}
            </div>
          </div>
        </div>
      </div>

      {/* Input Parameters Section: 2 Columns (Clock Frequency & Desired SCL Rate) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Box 1: System Clock (f_CPU / f_osc) */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-400" /> 1. 시스템 클럭 (f_CPU / f_osc)
            </span>
            <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
              {(fosc / 1000000).toFixed(4)} MHz ({fosc.toLocaleString()} Hz)
            </span>
          </div>

          {/* Quick presets */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
            {CLOCK_PRESETS.map((preset) => {
              const isActive = !isCustomFosc && fosc === preset.freq;
              return (
                <button
                  key={preset.freq}
                  onClick={() => handleSelectClockPreset(preset.freq)}
                  className={`p-2 rounded-lg border text-left transition ${
                    isActive
                      ? 'bg-cyan-500/20 border-cyan-500 text-white font-bold ring-1 ring-cyan-500/50'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-mono">{preset.label}</div>
                  <div className="text-[10px] text-slate-400 truncate">{preset.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Custom clock input */}
          <div className="pt-2 border-t border-slate-800/60 flex items-center gap-3">
            <label className="text-xs text-slate-400 shrink-0 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-slate-400" /> 사용자 지정 주파수 (MHz):
            </label>
            <div className="relative flex-1">
              <input
                type="number"
                step="0.0001"
                min="0.1"
                max="30"
                value={customFoscMhz}
                onChange={(e) => {
                  setIsCustomFosc(true);
                  handleCustomFoscChange(e.target.value);
                }}
                className={`w-full bg-slate-900 border rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none transition ${
                  isCustomFosc
                    ? 'border-cyan-500 ring-1 ring-cyan-500/40'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
                placeholder="예: 16.0"
              />
              <span className="absolute right-3 top-1.5 text-xs text-slate-500 font-mono">MHz</span>
            </div>
          </div>
        </div>

        {/* Box 2: Desired TWI Bit Rate (SCL Frequency) */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-cyan-400" /> 2. 목표 TWI (I2C) 비트레이트 (f_SCL)
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {(desiredSclHz / 1000).toFixed(1)} kHz ({desiredSclHz.toLocaleString()} bps)
            </span>
          </div>

          {/* SCL Quick Presets */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
            {TWI_SPEED_PRESETS.map((preset) => {
              const isActive = !isCustomScl && desiredSclHz === preset.rate;
              return (
                <button
                  key={preset.rate}
                  onClick={() => handleSelectSclPreset(preset.rate)}
                  className={`p-2 rounded-lg border text-left transition ${
                    isActive
                      ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold ring-1 ring-emerald-500/50'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono">{preset.label}</span>
                    <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400">{preset.mode.split(' ')[0]}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">{preset.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Custom SCL input */}
          <div className="pt-2 border-t border-slate-800/60 flex items-center gap-3">
            <label className="text-xs text-slate-400 shrink-0 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-slate-400" /> 사용자 지정 속도 (kHz):
            </label>
            <div className="relative flex-1">
              <input
                type="number"
                step="1"
                min="1"
                max="1000"
                value={customSclKhz}
                onChange={(e) => {
                  setIsCustomScl(true);
                  handleCustomSclChange(e.target.value);
                }}
                className={`w-full bg-slate-900 border rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none transition ${
                  isCustomScl
                    ? 'border-emerald-500 ring-1 ring-emerald-500/40'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
                placeholder="예: 100"
              />
              <span className="absolute right-3 top-1.5 text-xs text-slate-500 font-mono">kHz</span>
            </div>
          </div>
        </div>
      </div>

      {/* Theoretical Formula & Hardware Constraint Banner */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-mono">
        <div className="space-y-1">
          <div className="text-slate-400 flex items-center gap-2">
            <span className="text-amber-400 font-bold">AVR 데이터시트 공식:</span>
            <span className="text-white bg-slate-900 px-2.5 py-1 rounded border border-slate-700/80">
              f_SCL = f_CPU / [ 16 + 2 × TWBR × 4^(TWPS) ]
            </span>
          </div>
          <div className="text-slate-400 flex items-center gap-2">
            <span className="text-cyan-400 font-bold">TWBR 역산 공식:</span>
            <span className="text-cyan-300 bg-slate-900 px-2.5 py-1 rounded border border-slate-700/80">
              TWBR = [ (f_CPU / f_SCL) - 16 ] / [ 2 × 4^(TWPS) ]
            </span>
          </div>
        </div>

        <div className="text-right text-[11px] text-slate-400 space-y-0.5">
          <div>
            하드웨어 최대 SCL 한계: <strong className="text-white font-bold">{(fosc / 16 / 1000).toFixed(1)} kHz</strong> (TWBR=0, Prescaler=1 일 때)
          </div>
          <div className="text-amber-300">
            ★ 마스터 모드 권장치: <strong className="font-bold underline">TWBR ≥ 10</strong> (START 조건 타이밍 안정성 확보)
          </div>
        </div>
      </div>

      {/* 4-Prescaler Comparative Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            4가지 프리스케일러(TWPS1:0) 분주비별 TWBR 계산 및 오차 분석
          </h4>
          <span className="text-[11px] text-slate-400">
            카드를 클릭하여 상세 레지스터 비트맵과 C 코드를 전환할 수 있습니다.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {prescalerResults.map((result) => {
            const isBest = result.twpsIndex === bestPrescalerIndex;
            const isSelected = result.twpsIndex === activePrescalerIndex;

            let borderStyle = 'border-slate-800 hover:border-slate-700 bg-slate-950/60';
            if (isSelected) {
              borderStyle = 'border-cyan-500/80 bg-cyan-950/20 ring-2 ring-cyan-500/40 shadow-lg shadow-cyan-500/10';
            } else if (isBest) {
              borderStyle = 'border-emerald-500/50 bg-emerald-950/10 hover:border-emerald-500/80';
            }

            return (
              <div
                key={result.twpsIndex}
                onClick={() => setUserSelectedPrescaler(result.twpsIndex)}
                className={`p-4 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${borderStyle}`}
              >
                {/* Header of Card */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white font-mono">
                        분주비 4^{result.twpsIndex} = {result.prescalerFactor}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        TWPS=0b{result.twpsBits}
                      </span>
                    </div>
                    {isBest && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> 최적 추천
                      </span>
                    )}
                  </div>

                  {/* TWBR Main Value Display */}
                  <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 my-2.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] text-slate-400">TWBR 레지스터 값</span>
                      <span className="text-xs font-mono text-cyan-300">{result.twbrHex}</span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className={`text-2xl font-bold font-mono ${
                        result.isValid
                          ? result.isLowTwbrWarning ? 'text-amber-300' : 'text-white'
                          : 'text-rose-400'
                      }`}>
                        {result.isValid ? result.twbrInt : 'N/A'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        (정밀값: {result.isNegative ? '-' : result.twbrExact.toFixed(2)})
                      </span>
                    </div>
                  </div>

                  {/* Metrics list */}
                  <div className="space-y-1.5 text-xs font-mono pt-1">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">실제 SCL 주파수:</span>
                      <span className="font-bold text-white">
                        {result.isValid ? `${result.actualSclKhz.toFixed(2)} kHz` : '--'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">주파수 오차율:</span>
                      <span className={`font-bold flex items-center gap-0.5 ${
                        !result.isValid
                          ? 'text-slate-500'
                          : Math.abs(result.errorPercent) <= 2.0
                          ? 'text-emerald-400'
                          : Math.abs(result.errorPercent) <= 5.0
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}>
                        {result.isValid ? (
                          <>
                            {result.errorPercent > 0 ? (
                              <TrendingUp className="w-3 h-3 inline" />
                            ) : result.errorPercent < 0 ? (
                              <TrendingDown className="w-3 h-3 inline" />
                            ) : null}
                            {result.errorPercent > 0 ? '+' : ''}
                            {result.errorPercent.toFixed(2)}%
                          </>
                        ) : '--'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">SCL 1주기 (T):</span>
                      <span>{result.isValid ? `${result.periodUs.toFixed(2)} µs` : '--'}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">반주기 (t_LOW/HIGH):</span>
                      <span>{result.isValid ? `${result.halfPeriodUs.toFixed(2)} µs` : '--'}</span>
                    </div>
                  </div>
                </div>

                {/* Status Footer Badge */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                  <div className={`text-[11px] p-2 rounded-lg flex items-start gap-1.5 leading-snug ${
                    result.statusLevel === 'optimal'
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                      : result.statusLevel === 'acceptable'
                      ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                      : result.statusLevel === 'warning'
                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                  }`}>
                    {result.statusLevel === 'optimal' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400 mt-0.5" />
                    ) : result.statusLevel === 'warning' ? (
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                    ) : result.statusLevel === 'acceptable' ? (
                      <Info className="w-3.5 h-3.5 shrink-0 text-blue-400 mt-0.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 shrink-0 text-rose-400 mt-0.5" />
                    )}
                    <span>{result.statusMessage}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Prescaler Deep Dive: TWSR Bitfield Visualizer & Pin Mapping */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Box 1: TWSR Register Bitfield Layout (2 cols wide on desktop) */}
        <div className="lg:col-span-2 bg-slate-950/70 border border-slate-800/90 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              TWSR (TWI Status Register) 하드웨어 8비트 구조 & 비트마스크
            </h4>
            <span className="text-xs font-mono text-cyan-400">
              현재 선택: TWPS[1:0] = 0b{activeResult.twpsBits} (분주비: {activeResult.prescalerFactor})
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-white">TWSR</strong>의 상위 5비트(7~3)는 마스터/슬레이브 송수신 상태 코드(ACK/NACK 등)를 나타내며,
            하위 2비트(1~0)인 <strong className="text-cyan-300">TWPS1, TWPS0</strong>가 TWI 클럭의 분주비를 결정합니다.
            비트 2는 예약(Reserved)되어 있습니다.
          </p>

          {/* 8-bit Register Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                  <th className="p-2 border-r border-slate-800">Bit 7</th>
                  <th className="p-2 border-r border-slate-800">Bit 6</th>
                  <th className="p-2 border-r border-slate-800">Bit 5</th>
                  <th className="p-2 border-r border-slate-800">Bit 4</th>
                  <th className="p-2 border-r border-slate-800">Bit 3</th>
                  <th className="p-2 border-r border-slate-800">Bit 2</th>
                  <th className="p-2 border-r border-slate-800 bg-cyan-950/30 text-cyan-300">Bit 1</th>
                  <th className="p-2 bg-cyan-950/30 text-cyan-300">Bit 0</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-800 font-bold text-white bg-slate-950">
                  <td className="p-2.5 border-r border-slate-800 text-slate-400">TWS7</td>
                  <td className="p-2.5 border-r border-slate-800 text-slate-400">TWS6</td>
                  <td className="p-2.5 border-r border-slate-800 text-slate-400">TWS5</td>
                  <td className="p-2.5 border-r border-slate-800 text-slate-400">TWS4</td>
                  <td className="p-2.5 border-r border-slate-800 text-slate-400">TWS3</td>
                  <td className="p-2.5 border-r border-slate-800 text-slate-600">-</td>
                  <td className="p-2.5 border-r border-slate-800 bg-cyan-950/50 text-cyan-300">TWPS1</td>
                  <td className="p-2.5 bg-cyan-950/50 text-cyan-300">TWPS0</td>
                </tr>
                <tr className="bg-slate-900/40 text-[11px] text-slate-400">
                  <td colSpan={5} className="p-2 border-r border-slate-800 text-slate-400 font-sans">
                    TWI 상태 코드 (Read-Only, 0xF8 마스킹 검증)
                  </td>
                  <td className="p-2 border-r border-slate-800 text-slate-600">Reserved (0)</td>
                  <td className="p-2 border-r border-slate-800 font-bold text-cyan-300 bg-cyan-950/20">
                    {activeResult.twpsBits[0]}
                  </td>
                  <td className="p-2 font-bold text-cyan-300 bg-cyan-950/20">
                    {activeResult.twpsBits[1]}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Quick Bitmask Code Snippet */}
          <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 space-y-1">
            <div className="text-slate-500">// 안전한 TWSR 프리스케일러 비트 조작 C 코드:</div>
            {activeResult.twpsIndex === 0 && (
              <div className="text-cyan-300">
                TWSR &= ~((1 &lt;&lt; TWPS1) | (1 &lt;&lt; TWPS0)); <span className="text-slate-500">// 분주비 1 (TWPS1=0, TWPS0=0)</span>
              </div>
            )}
            {activeResult.twpsIndex === 1 && (
              <div className="text-cyan-300">
                TWSR = (TWSR &amp; ~(1 &lt;&lt; TWPS1)) | (1 &lt;&lt; TWPS0); <span className="text-slate-500">// 분주비 4 (TWPS1=0, TWPS0=1)</span>
              </div>
            )}
            {activeResult.twpsIndex === 2 && (
              <div className="text-cyan-300">
                TWSR = (TWSR &amp; ~(1 &lt;&lt; TWPS0)) | (1 &lt;&lt; TWPS1); <span className="text-slate-500">// 분주비 16 (TWPS1=1, TWPS0=0)</span>
              </div>
            )}
            {activeResult.twpsIndex === 3 && (
              <div className="text-cyan-300">
                TWSR |= (1 &lt;&lt; TWPS1) | (1 &lt;&lt; TWPS0); <span className="text-slate-500">// 분주비 64 (TWPS1=1, TWPS0=1)</span>
              </div>
            )}
            <div className="text-slate-500 text-[11px] pt-1 border-t border-slate-800">
              * 상태 검증 시: <code className="text-emerald-400 font-bold">uint8_t status = TWSR &amp; 0xF8;</code> 로 프리스케일러 비트를 제외해야 합니다.
            </div>
          </div>
        </div>

        {/* Box 2: Target MCU Hardware I2C Pinout */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-5 space-y-3 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-amber-400" />
              {currentProfile.name} TWI 핀 아키텍처
            </h4>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-500">I2C SCL (클럭 라인)</div>
                  <div className="font-mono font-bold text-white text-xs">{twiPinInfo.sclPin}</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                  {twiPinInfo.sclBit}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-500">I2C SDA (데이터 라인)</div>
                  <div className="font-mono font-bold text-white text-xs">{twiPinInfo.sdaPin}</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                  {twiPinInfo.sdaBit}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mt-3">
              {twiPinInfo.note}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
            <span>
              AVR 내부 풀업(20~50kΩ)은 상승 시간이 길어져 100k/400k에서 신호 왜곡을 유발하므로 반드시 2.2k~4.7kΩ 외부 풀업 저항을 연결하십시오.
            </span>
          </div>
        </div>
      </div>

      {/* Bus Physics & Pull-Up Resistor (Rp) Calculator */}
      <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              I2C 버스 물리 계층: 풀업 저항(R_p) 및 부하 커패시턴스(C_b) 계산기
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              I2C는 오픈 드레인(Open-Drain) 구조이므로 외부 풀업 저항이 High 상태를 만듭니다. 저항이 너무 작으면 과도 전류가 흐르고, 너무 크면 상승 시간이 규격을 초과합니다.
            </p>
          </div>

          {/* Quick voltage toggle */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 shrink-0">
            <span className="text-[11px] text-slate-400 px-2">VCC 전원:</span>
            <button
              onClick={() => setBusVcc(5.0)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition ${
                busVcc === 5.0 ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              5.0V
            </button>
            <button
              onClick={() => setBusVcc(3.3)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition ${
                busVcc === 3.3 ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              3.3V
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
          {/* Bus Capacitance Slider */}
          <div className="md:col-span-2 bg-slate-900/60 p-3.5 rounded-lg border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">버스 부하 커패시턴스 (C_b)</span>
              <span className="font-mono text-cyan-300 font-bold">{busCapacitancePf} pF</span>
            </div>
            <input
              type="range"
              min="10"
              max="400"
              step="10"
              value={busCapacitancePf}
              onChange={(e) => setBusCapacitancePf(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>10 pF (단일 보드)</span>
              <span>100 pF (일반 브레드보드)</span>
              <span>400 pF (I2C 규격 상한선)</span>
            </div>
          </div>

          {/* Calculated Min / Max Rp */}
          <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400">허용 풀업 저항 범위</span>
            <div className="text-sm font-bold font-mono text-white mt-1">
              {pullUpCalc.rpMinKohm} kΩ ~ {pullUpCalc.rpMaxKohm} kΩ
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              • 최소: I_OL(3mA) 기준 싱크 한계<br />
              • 최대: 상승 시간 t_r ≤ {pullUpCalc.trMaxNs}ns 기준
            </div>
          </div>

          {/* Recommended Standard Resistor */}
          <div className="bg-emerald-950/20 border border-emerald-500/30 p-3.5 rounded-lg flex flex-col justify-between">
            <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 권장 풀업 저항 (추천)
            </span>
            <div className="text-xl font-bold font-mono text-white my-1">
              {pullUpCalc.recResistor}
            </div>
            <div className="text-[10px] text-slate-400">
              {pullUpCalc.recReason}
            </div>
          </div>
        </div>
      </div>

      {/* Production-Ready C Code Generator */}
      <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              자동 생성된 AVR-GCC C 초기화 코드 ({currentProfile.name})
            </h4>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle full example vs compact init */}
            <button
              onClick={() => setIncludeFullExample(!includeFullExample)}
              className="text-xs px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              {includeFullExample ? '간략 초기화만 보기' : '전체 드라이버 코드 보기'}
            </button>

            {/* Copy button */}
            <button
              onClick={handleCopyCode}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                copiedCode
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
              }`}
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5" /> 복사 완료!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> 코드 복사
                </>
              )}
            </button>
          </div>
        </div>

        <div className="relative">
          <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800/80 text-xs font-mono text-cyan-200 overflow-x-auto leading-relaxed max-h-80 select-all">
            {generatedCode}
          </pre>
        </div>
      </div>
    </div>
  );
};
