import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Activity,
  Zap,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RotateCcw,
  Info,
  Layers,
  ArrowRight,
  TrendingUp,
  Cpu,
  Clock,
  Settings2,
  FileCode,
  ShieldAlert,
  HelpCircle,
  Radio
} from 'lucide-react';

export interface BusTimingSimulatorProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type BusProtocol = 'i2c' | 'spi';

export const BusTimingSimulator: React.FC<BusTimingSimulatorProps> = ({
  selectedMCU,
  onSelectMCU
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Active protocol
  const [protocol, setProtocol] = useState<BusProtocol>('i2c');

  // Common parameters
  const [supplyVoltage, setSupplyVoltage] = useState<number>(5.0); // 5.0V or 3.3V
  const [cpuFreqMhz, setCpuFreqMhz] = useState<number>(16.0); // 16MHz default AVR

  // I2C specific parameters
  const [i2cSpeedPreset, setI2cSpeedPreset] = useState<'standard' | 'fast' | 'fast_plus' | 'custom'>('standard');
  const [i2cTargetKhz, setI2cTargetKhz] = useState<number>(100);
  const [i2cPullupKohm, setI2cPullupKohm] = useState<number>(4.7); // 4.7kΩ standard
  const [i2cBusCapacitancePf, setI2cBusCapacitancePf] = useState<number>(150); // 150pF typical (PCB + 3 slaves)
  const [i2cDeviceCount, setI2cDeviceCount] = useState<number>(3);
  const [i2cCableLengthCm, setI2cCableLengthCm] = useState<number>(15);

  // SPI specific parameters
  const [spiPrescaler, setSpiPrescaler] = useState<number>(4); // f_cpu / 4 = 4MHz default
  const [spi2xDoubleSpeed, setSpi2xDoubleSpeed] = useState<boolean>(false);
  const [spiMode, setSpiMode] = useState<0 | 1 | 2 | 3>(0);
  const [spiLoadCapacitancePf, setSpiLoadCapacitancePf] = useState<number>(35); // 35pF typical SPI bus
  const [spiSeriesResistorOhm, setSpiSeriesResistorOhm] = useState<number>(22); // 22Ω damping resistor

  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Sync I2C speed presets
  const handleI2cPresetChange = (preset: 'standard' | 'fast' | 'fast_plus' | 'custom') => {
    setI2cSpeedPreset(preset);
    if (preset === 'standard') {
      setI2cTargetKhz(100);
      setI2cPullupKohm(4.7);
    } else if (preset === 'fast') {
      setI2cTargetKhz(400);
      setI2cPullupKohm(2.2);
    } else if (preset === 'fast_plus') {
      setI2cTargetKhz(1000);
      setI2cPullupKohm(1.0);
    }
  };

  // I2C Timing & Physics Calculations
  const i2cMetrics = useMemo(() => {
    // 1. Total effective capacitance: base PCB trace (20pF) + slave pins (10pF each) + cable (~0.7pF/cm)
    const effectiveCapPf = Math.max(
      i2cBusCapacitancePf,
      20 + i2cDeviceCount * 10 + Math.round(i2cCableLengthCm * 0.7)
    );

    // 2. Rise Time tr: time from 0.3*Vdd to 0.7*Vdd for RC exponential charging
    // ln(0.7) - ln(0.3) = ln(0.7/0.3) = 0.8473
    const rpOhms = i2cPullupKohm * 1000;
    const riseTimeNs = Math.round(0.8473 * rpOhms * (effectiveCapPf * 1e-12) * 1e9);

    // 3. Fall Time tf: sink driver (~30Ω internal NMOS + trace)
    const rSinkOhms = 35;
    const fallTimeNs = Math.round(0.8473 * rSinkOhms * (effectiveCapPf * 1e-12) * 1e9);

    // 4. I2C standard limits based on frequency
    let maxRiseTimeNs = 1000;
    let maxFallTimeNs = 300;
    let maxCapPf = 400;
    if (i2cTargetKhz > 400) {
      maxRiseTimeNs = 120; // Fast-mode Plus
      maxFallTimeNs = 120;
      maxCapPf = 550;
    } else if (i2cTargetKhz > 100) {
      maxRiseTimeNs = 300; // Fast-mode
      maxFallTimeNs = 300;
      maxCapPf = 400;
    }

    // 5. Min/Max allowed Pull-Up Resistor
    // Rp(max) = tr(max) / (0.8473 * Cb)
    const maxPullupKohm = +(maxRiseTimeNs / (0.8473 * effectiveCapPf)).toFixed(2);
    // Rp(min) = (Vdd - 0.4V) / 3mA
    const minPullupKohm = +((supplyVoltage - 0.4) / 3.0).toFixed(2);

    // 6. Vol (Low output voltage): Vol = Vdd * (Rsink / (Rp + Rsink))
    const volMv = Math.round((supplyVoltage * (rSinkOhms / (rpOhms + rSinkOhms))) * 1000);
    const maxAllowedVolMv = 400; // I2C spec: max 0.4V @ 3mA sink

    // 7. SCL Clock High/Low Period
    const clockPeriodNs = Math.round((1 / (i2cTargetKhz * 1000)) * 1e9);
    // Duty cycle nominal ~50%, but rise time cuts into high period
    const tLowNs = Math.round(clockPeriodNs * 0.5);
    const tHighNs = Math.round(clockPeriodNs * 0.5);
    const effectiveHighNs = tHighNs - riseTimeNs;

    // 8. TWI TWBR Register calculation for AVR 16MHz
    // F_SCL = F_CPU / (16 + 2 * TWBR * Prescaler)
    // TWBR = ((F_CPU / F_SCL) - 16) / (2 * Prescaler)
    let prescalerVal = 1;
    let prescalerBits = 0;
    let twbr = Math.round(((cpuFreqMhz * 1e6) / (i2cTargetKhz * 1000) - 16) / (2 * prescalerVal));
    if (twbr > 255) {
      prescalerVal = 4;
      prescalerBits = 1;
      twbr = Math.round(((cpuFreqMhz * 1e6) / (i2cTargetKhz * 1000) - 16) / (2 * prescalerVal));
    }
    twbr = Math.max(0, Math.min(255, twbr));
    const actualKhz = Math.round((cpuFreqMhz * 1e6) / (16 + 2 * twbr * prescalerVal) / 1000);

    // Violations check
    const isRiseTimeViolation = riseTimeNs > maxRiseTimeNs;
    const isCapViolation = effectiveCapPf > maxCapPf;
    const isVolViolation = volMv > maxAllowedVolMv;
    const isHighPeriodCollapsed = effectiveHighNs < (i2cTargetKhz >= 400 ? 500 : 1500);
    const isRpTooSmall = i2cPullupKohm < minPullupKohm;
    const isRpTooLarge = i2cPullupKohm > maxPullupKohm;

    const hasCriticalError = isRiseTimeViolation || isHighPeriodCollapsed || isVolViolation;
    const hasWarning = isCapViolation || isRpTooSmall || isRpTooLarge || (riseTimeNs > maxRiseTimeNs * 0.85);

    return {
      effectiveCapPf,
      riseTimeNs,
      fallTimeNs,
      maxRiseTimeNs,
      maxFallTimeNs,
      maxCapPf,
      minPullupKohm,
      maxPullupKohm,
      volMv,
      clockPeriodNs,
      tLowNs,
      tHighNs,
      effectiveHighNs,
      twbr,
      prescalerVal,
      prescalerBits,
      actualKhz,
      isRiseTimeViolation,
      isCapViolation,
      isVolViolation,
      isHighPeriodCollapsed,
      isRpTooSmall,
      isRpTooLarge,
      hasCriticalError,
      hasWarning
    };
  }, [
    i2cTargetKhz,
    i2cPullupKohm,
    i2cBusCapacitancePf,
    i2cDeviceCount,
    i2cCableLengthCm,
    supplyVoltage,
    cpuFreqMhz
  ]);

  // SPI Timing & Physics Calculations
  const spiMetrics = useMemo(() => {
    // Effective prescaler divider
    let divider = spiPrescaler;
    if (spi2xDoubleSpeed) {
      divider = Math.max(2, Math.floor(divider / 2));
    }

    const sckFreqMhz = +(cpuFreqMhz / divider).toFixed(3);
    const sckPeriodNs = +(1000 / sckFreqMhz).toFixed(1);
    const halfPeriodNs = +(sckPeriodNs / 2).toFixed(1);

    // Driver internal resistance ~30Ω + series resistor
    const totalDriverR = 30 + spiSeriesResistorOhm;
    // Rise/Fall time for push-pull CMOS: ~ 2.2 * R * C
    const riseTimeNs = +(2.2 * totalDriverR * (spiLoadCapacitancePf * 1e-12) * 1e9).toFixed(1);
    const fallTimeNs = riseTimeNs; // Symmetric for CMOS push-pull

    // Setup and Hold times
    // AVR SPI slave requirements: t_setup >= 10ns, t_hold >= 10ns
    const minSetupNs = 10;
    const minHoldNs = 10;
    const availableSetupNs = +(halfPeriodNs - riseTimeNs).toFixed(1);

    // Ringing/Reflection check: if propagation delay (td) > tr / 2
    // On PCB, velocity is ~15cm/ns.
    const isTimingViolation = availableSetupNs < minSetupNs;
    const isSlewRateSlow = riseTimeNs > halfPeriodNs * 0.4;
    const isDampingNeeded = spiSeriesResistorOhm < 10 && spiLoadCapacitancePf < 25;

    // SPCR / SPSR Register values
    // SPR[1:0] in SPCR: 00=/4, 01=/16, 10=/64, 11=/128
    let sprBits = 0;
    if (spiPrescaler === 16) sprBits = 1;
    else if (spiPrescaler === 64) sprBits = 2;
    else if (spiPrescaler === 128) sprBits = 3;

    return {
      sckFreqMhz,
      sckPeriodNs,
      halfPeriodNs,
      riseTimeNs,
      fallTimeNs,
      availableSetupNs,
      minSetupNs,
      minHoldNs,
      isTimingViolation,
      isSlewRateSlow,
      isDampingNeeded,
      sprBits
    };
  }, [cpuFreqMhz, spiPrescaler, spi2xDoubleSpeed, spiLoadCapacitancePf, spiSeriesResistorOhm]);

  // Generated C Initialization Snippet
  const generatedCode = useMemo(() => {
    if (protocol === 'i2c') {
      return `// ==========================================
// AVR TWI (I2C) 고신뢰성 버스 초기화 C 코드
// Target: ${selectedMCU.toUpperCase()} @ ${cpuFreqMhz}MHz
// 목표 속도: ${i2cTargetKhz} kHz (실제: ${i2cMetrics.actualKhz} kHz)
// ==========================================
#include <avr/io.h>

void i2c_master_init(void) {
  // 1. TWI 비트 전송률 레지스터 (TWBR) 설정
  // 계산식: TWBR = ((F_CPU / F_SCL) - 16) / (2 * Prescaler)
  TWBR = ${i2cMetrics.twbr}; // 0x${i2cMetrics.twbr.toString(16).toUpperCase()}

  // 2. TWI 상태 레지스터 (TWSR) 프리스케일러: ${i2cMetrics.prescalerVal}배
  TWSR = (TWSR & ~0x03) | ${i2cMetrics.prescalerBits}; // TWPS[1:0] = ${i2cMetrics.prescalerBits}

  // 3. TWI 활성화 (TWEA=ACK, TWEN=Enable)
  TWCR = (1 << TWEN) | (1 << TWEA);

  // 💡 하드웨어 팁:
  // 현재 버스 용량: ${i2cMetrics.effectiveCapPf} pF
  // 권장 풀업 저항 범위: ${i2cMetrics.minPullupKohm} kΩ ~ ${i2cMetrics.maxPullupKohm} kΩ (설정값: ${i2cPullupKohm} kΩ)
  // 계산된 상승 시간(tr): ${i2cMetrics.riseTimeNs} ns (규격 상한: ${i2cMetrics.maxRiseTimeNs} ns)
}`;
    } else {
      return `// ==========================================
// AVR 하드웨어 SPI 마스터 모드 초기화 C 코드
// Target: ${selectedMCU.toUpperCase()} @ ${cpuFreqMhz}MHz
// SCK 클럭: ${spiMetrics.sckFreqMhz} MHz (Prescaler f_cpu/${spiPrescaler}${spi2xDoubleSpeed ? ' + 2X' : ''})
// SPI Mode: ${spiMode} (CPOL=${spiMode >= 2 ? 1 : 0}, CPHA=${spiMode % 2 === 1 ? 1 : 0})
// ==========================================
#include <avr/io.h>

void spi_master_init(void) {
  // 1. SCK, MOSI, SS 핀을 출력(Output)으로 설정 (MISO는 입력)
  ${selectedMCU === 'atmega128' ? 'DDRB |= (1 << PB1) | (1 << PB2) | (1 << PB0);' : selectedMCU === 'atmega328p' ? 'DDRB |= (1 << PB5) | (1 << PB3) | (1 << PB2);' : 'DDRB |= (1 << PB1) | (1 << PB2) | (1 << PB0);'}

  // 2. SPCR (SPI Control Register)
  // SPE=1(Enable), MSTR=1(Master), CPOL/CPHA, SPR[1:0]
  SPCR = (1 << SPE) | (1 << MSTR)
       ${spiMode >= 2 ? '| (1 << CPOL)' : ''}
       ${spiMode % 2 === 1 ? '| (1 << CPHA)' : ''}
       | (${spiMetrics.sprBits} << SPR0);

  // 3. SPSR (SPI Status Register) 2배속 모드 제어
  ${spi2xDoubleSpeed ? 'SPSR |= (1 << SPI2X); // 2배속 활성화' : 'SPSR &= ~(1 << SPI2X); // 표준 속도'}

  // 💡 신호 무결성 팁:
  // 부하 용량 ${spiLoadCapacitancePf}pF 기준 상승 시간: ${spiMetrics.riseTimeNs} ns
  // 여유 셋업 마진: ${spiMetrics.availableSetupNs} ns (최소 규격: ${spiMetrics.minSetupNs} ns)
}`;
    }
  }, [protocol, selectedMCU, cpuFreqMhz, i2cTargetKhz, i2cMetrics, i2cPullupKohm, spiMetrics, spiPrescaler, spi2xDoubleSpeed, spiMode, spiLoadCapacitancePf]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div id="i2c-spi-bus-timing-simulator-card" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur-xl shadow-2xl space-y-7">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-500/10">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                I2C / SPI 버스 타이밍 & 신호 무결성 시뮬레이터
              </h3>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold">
                Bus Timing Simulator
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                {currentProfile.name}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              오픈 드레인(I2C) 풀업 RC 충전 곡선과 푸시풀(SPI) 전이 에지 특성을 시뮬레이션하여 <strong>보레이트(Baud Rate)</strong>, <strong>기생 용량(Bus Capacitance)</strong>, <strong>풀업/댐핑 저항</strong>에 따른 상승/하강 시간($t_r, t_f$) 및 셋업/홀드 마진 위반을 실시간 진단합니다.
            </p>
          </div>
        </div>

        {/* Protocol Switcher */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button
              onClick={() => setProtocol('i2c')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                protocol === 'i2c'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>I2C (TWI / Open-Drain)</span>
            </button>
            <button
              onClick={() => setProtocol('spi')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                protocol === 'spi'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>SPI (Push-Pull / High-Speed)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-Time Signal Integrity Status Banner */}
      {protocol === 'i2c' ? (
        <div className={`p-4.5 rounded-2xl border transition-all ${
          i2cMetrics.hasCriticalError
            ? 'bg-rose-950/60 border-rose-500 shadow-xl shadow-rose-950/20 ring-1 ring-rose-500'
            : i2cMetrics.hasWarning
            ? 'bg-amber-950/60 border-amber-500 shadow-xl shadow-amber-950/20'
            : 'bg-emerald-950/40 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
        }`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                i2cMetrics.hasCriticalError
                  ? 'bg-rose-500 text-white'
                  : i2cMetrics.hasWarning
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {i2cMetrics.hasCriticalError ? (
                  <AlertCircle className="w-5 h-5 animate-pulse" />
                ) : i2cMetrics.hasWarning ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-black uppercase tracking-wider ${
                    i2cMetrics.hasCriticalError
                      ? 'text-rose-300'
                      : i2cMetrics.hasWarning
                      ? 'text-amber-300'
                      : 'text-emerald-300'
                  }`}>
                    {i2cMetrics.hasCriticalError
                      ? '치명적 신호 무결성 위반: I2C 통신 중단 또는 ACK 손실 위험!'
                      : i2cMetrics.hasWarning
                      ? '경고: 신호 여유 마진 협소 (Noise Margin Low)'
                      : '정상: NXP I2C 버스 타이밍 표준 완벽 충족 (Pass)'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  {i2cMetrics.isRiseTimeViolation
                    ? `상승 시간(tr: ${i2cMetrics.riseTimeNs}ns)이 I2C ${i2cTargetKhz}kHz 규격 상한(${i2cMetrics.maxRiseTimeNs}ns)을 초과했습니다. 풀업 저항(Rp)을 ${i2cMetrics.maxPullupKohm}kΩ 이하로 낮추거나 버스 용량을 줄이세요.`
                    : i2cMetrics.isHighPeriodCollapsed
                    ? `RC 지연으로 인해 SCL 하이 레벨 유지 시간(tHIGH)이 기준치 미만으로 찌그러졌습니다. 클럭 스트레칭 타임아웃이 발생할 수 있습니다.`
                    : i2cMetrics.isVolViolation
                    ? `풀업 저항이 너무 강해 슬레이브의 싱크 전류로 인한 저레벨 전압(Vol: ${i2cMetrics.volMv}mV)이 0.4V를 초과하여 로우(0)로 인식되지 않습니다.`
                    : i2cMetrics.hasWarning
                    ? `현재 상승 시간(${i2cMetrics.riseTimeNs}ns)이 한계치(${i2cMetrics.maxRiseTimeNs}ns)에 근접해 있습니다. 케이블 연장 시 통신 에러가 발생할 수 있습니다.`
                    : `상승 시간(tr): ${i2cMetrics.riseTimeNs} ns (한계: ${i2cMetrics.maxRiseTimeNs} ns) • Vol: ${i2cMetrics.volMv} mV • 안정적인 RC 충전 곡선을 보장합니다.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800 text-xs font-mono">
              <div className="text-center">
                <span className="text-[10px] text-slate-400 block">상승 시간 (tr)</span>
                <span className={`font-bold ${i2cMetrics.isRiseTimeViolation ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {i2cMetrics.riseTimeNs} ns
                </span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div className="text-center">
                <span className="text-[10px] text-slate-400 block">총 버스 용량</span>
                <span className="font-bold text-cyan-400">{i2cMetrics.effectiveCapPf} pF</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div className="text-center">
                <span className="text-[10px] text-slate-400 block">TWBR 레지스터</span>
                <span className="font-bold text-amber-400">{i2cMetrics.twbr}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`p-4.5 rounded-2xl border transition-all ${
          spiMetrics.isTimingViolation
            ? 'bg-rose-950/60 border-rose-500 shadow-xl shadow-rose-950/20'
            : spiMetrics.isSlewRateSlow || spiMetrics.isDampingNeeded
            ? 'bg-amber-950/60 border-amber-500 shadow-xl shadow-amber-950/20'
            : 'bg-emerald-950/40 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
        }`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                spiMetrics.isTimingViolation
                  ? 'bg-rose-500 text-white'
                  : spiMetrics.isSlewRateSlow || spiMetrics.isDampingNeeded
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {spiMetrics.isTimingViolation ? (
                  <AlertCircle className="w-5 h-5 animate-pulse" />
                ) : spiMetrics.isSlewRateSlow || spiMetrics.isDampingNeeded ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <span className={`text-sm font-black uppercase tracking-wider ${
                  spiMetrics.isTimingViolation
                    ? 'text-rose-300'
                    : spiMetrics.isSlewRateSlow || spiMetrics.isDampingNeeded
                    ? 'text-amber-300'
                    : 'text-emerald-300'
                }`}>
                  {spiMetrics.isTimingViolation
                    ? '셋업 타임(tSetup) 위반: 고속 SPI 데이터 샘플링 에러!'
                    : spiMetrics.isDampingNeeded
                    ? '주의: 링잉/반사파(Ringing) 발생 가능 (시리즈 댐핑 저항 22~33Ω 권장)'
                    : '정상: 고속 푸시풀 SPI 신호 무결성 양호'}
                </span>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  {spiMetrics.isTimingViolation
                    ? `클럭 주기(${spiMetrics.sckPeriodNs}ns) 대비 상승 시간(${spiMetrics.riseTimeNs}ns)이 너무 커서 데이터 유효 셋업 시간(${spiMetrics.availableSetupNs}ns)이 최소 요구치(10ns) 미만으로 붕괴되었습니다. 프리스케일러를 낮추세요.`
                    : spiMetrics.isDampingNeeded
                    ? `빠른 CMOS 에지(tr < 3ns)와 짧은 배선에서 임피던스 불일치로 인한 오버슈트/언더슈트 및 이중 클러킹(Double-Clocking) 위험이 있습니다.`
                    : `SCK 클럭: ${spiMetrics.sckFreqMhz} MHz • 셋업 여유: ${spiMetrics.availableSetupNs} ns (최소: ${spiMetrics.minSetupNs} ns) • 안정적인 전송이 가능합니다.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800 text-xs font-mono">
              <div className="text-center">
                <span className="text-[10px] text-slate-400 block">SCK 주파수</span>
                <span className="font-bold text-purple-400">{spiMetrics.sckFreqMhz} MHz</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div className="text-center">
                <span className="text-[10px] text-slate-400 block">상승 시간 (tr)</span>
                <span className="font-bold text-cyan-400">{spiMetrics.riseTimeNs} ns</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div className="text-center">
                <span className="text-[10px] text-slate-400 block">셋업 마진</span>
                <span className={`font-bold ${spiMetrics.isTimingViolation ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {spiMetrics.availableSetupNs} ns
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Parameter Controls Sandbox */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              {protocol === 'i2c' ? 'I2C (TWI) 물리 계층 파라미터 제어' : 'SPI 고속 버스 파라미터 제어'}
            </h4>
          </div>

          {/* Voltage & CPU Clock Toggle */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">타깃 전압:</span>
            <button
              onClick={() => setSupplyVoltage(5.0)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                supplyVoltage === 5.0 ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400'
              }`}
            >
              5.0V
            </button>
            <button
              onClick={() => setSupplyVoltage(3.3)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                supplyVoltage === 3.3 ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400'
              }`}
            >
              3.3V
            </button>
          </div>
        </div>

        {protocol === 'i2c' ? (
          <div className="space-y-4">
            {/* Speed Preset Pills */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-mono">I2C 규격 속도:</span>
              <button
                onClick={() => handleI2cPresetChange('standard')}
                className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition ${
                  i2cSpeedPreset === 'standard'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Standard Mode (100 kHz)
              </button>
              <button
                onClick={() => handleI2cPresetChange('fast')}
                className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition ${
                  i2cSpeedPreset === 'fast'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Fast Mode (400 kHz)
              </button>
              <button
                onClick={() => handleI2cPresetChange('fast_plus')}
                className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition ${
                  i2cSpeedPreset === 'fast_plus'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                Fast Mode Plus (1.0 MHz)
              </button>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Target Khz */}
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center font-mono">
                  <span className="text-slate-300 font-semibold">클럭 주파수 (fSCL):</span>
                  <span className="text-cyan-400 font-bold">{i2cTargetKhz} kHz</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={1000}
                  step={10}
                  value={i2cTargetKhz}
                  onChange={(e) => {
                    setI2cTargetKhz(parseInt(e.target.value));
                    setI2cSpeedPreset('custom');
                  }}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>20 kHz</span>
                  <span>1000 kHz</span>
                </div>
              </div>

              {/* Pull-up Resistor */}
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center font-mono">
                  <span className="text-slate-300 font-semibold">풀업 저항 (Rp):</span>
                  <span className={`font-bold ${i2cMetrics.isRpTooLarge || i2cMetrics.isRpTooSmall ? 'text-rose-400' : 'text-amber-400'}`}>
                    {i2cPullupKohm.toFixed(1)} kΩ
                  </span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={20.0}
                  step={0.1}
                  value={i2cPullupKohm}
                  onChange={(e) => setI2cPullupKohm(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>1.0 kΩ</span>
                  <span>권장: {i2cMetrics.minPullupKohm}~{i2cMetrics.maxPullupKohm}kΩ</span>
                  <span>20 kΩ</span>
                </div>
              </div>

              {/* Total Capacitance */}
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center font-mono">
                  <span className="text-slate-300 font-semibold">기생 부하 용량 (Cb):</span>
                  <span className={`font-bold ${i2cMetrics.isCapViolation ? 'text-rose-400' : 'text-cyan-400'}`}>
                    {i2cBusCapacitancePf} pF
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={600}
                  step={10}
                  value={i2cBusCapacitancePf}
                  onChange={(e) => setI2cBusCapacitancePf(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>10 pF</span>
                  <span>한계: {i2cMetrics.maxCapPf} pF</span>
                  <span>600 pF</span>
                </div>
              </div>

              {/* Device count & Cable */}
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center font-mono">
                  <span className="text-slate-300 font-semibold">슬레이브 수 / 케이블:</span>
                  <span className="text-slate-200 font-bold">{i2cDeviceCount}개 / {i2cCableLengthCm}cm</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="range"
                    min={1}
                    max={12}
                    value={i2cDeviceCount}
                    onChange={(e) => setI2cDeviceCount(parseInt(e.target.value))}
                    className="w-full accent-slate-400 cursor-pointer"
                    title="슬레이브 디바이스 수"
                  />
                  <input
                    type="range"
                    min={5}
                    max={150}
                    step={5}
                    value={i2cCableLengthCm}
                    onChange={(e) => setI2cCableLengthCm(parseInt(e.target.value))}
                    className="w-full accent-slate-400 cursor-pointer"
                    title="케이블 길이 (cm)"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>1대 • 5cm</span>
                  <span>유효: {i2cMetrics.effectiveCapPf}pF</span>
                  <span>12대 • 1.5m</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* SPI Modes */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-mono">SPI 클럭 모드:</span>
              {([0, 1, 2, 3] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSpiMode(mode)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition ${
                    spiMode === mode
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Mode {mode} (CPOL={mode >= 2 ? 1 : 0}, CPHA={mode % 2 === 1 ? 1 : 0})
                </button>
              ))}
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Prescaler */}
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center font-mono">
                  <span className="text-slate-300 font-semibold">클럭 분주비 (Prescaler):</span>
                  <span className="text-purple-400 font-bold">f_cpu / {spiPrescaler}</span>
                </div>
                <select
                  value={spiPrescaler}
                  onChange={(e) => setSpiPrescaler(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-white font-mono text-xs"
                >
                  <option value={2}>f_cpu / 2 (8.0 MHz @ 16MHz)</option>
                  <option value={4}>f_cpu / 4 (4.0 MHz - 표준)</option>
                  <option value={8}>f_cpu / 8 (2.0 MHz)</option>
                  <option value={16}>f_cpu / 16 (1.0 MHz)</option>
                  <option value={32}>f_cpu / 32 (500 kHz)</option>
                  <option value={64}>f_cpu / 64 (250 kHz)</option>
                  <option value={128}>f_cpu / 128 (125 kHz)</option>
                </select>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 pt-1">
                  <input
                    type="checkbox"
                    checked={spi2xDoubleSpeed}
                    onChange={(e) => setSpi2xDoubleSpeed(e.target.checked)}
                    className="accent-purple-500 rounded"
                  />
                  <span>SPI2X 2배속 모드 활성화</span>
                </label>
              </div>

              {/* Load Capacitance */}
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center font-mono">
                  <span className="text-slate-300 font-semibold">부하 용량 (CLoad):</span>
                  <span className="text-cyan-400 font-bold">{spiLoadCapacitancePf} pF</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={200}
                  step={5}
                  value={spiLoadCapacitancePf}
                  onChange={(e) => setSpiLoadCapacitancePf(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>5 pF</span>
                  <span>표준 ~30pF</span>
                  <span>200 pF</span>
                </div>
              </div>

              {/* Series Damping Resistor */}
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center font-mono">
                  <span className="text-slate-300 font-semibold">시리즈 댐핑 저항 (Rs):</span>
                  <span className="text-amber-400 font-bold">{spiSeriesResistorOhm} Ω</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={2}
                  value={spiSeriesResistorOhm}
                  onChange={(e) => setSpiSeriesResistorOhm(parseInt(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0 Ω (무보정)</span>
                  <span>권장 22~33Ω</span>
                  <span>100 Ω</span>
                </div>
              </div>

              {/* Result Summary */}
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5 font-mono text-xs">
                <span className="text-slate-400 block text-[11px]">SPI 타이밍 사양:</span>
                <div className="flex justify-between">
                  <span className="text-slate-300">SCK 주기:</span>
                  <span className="font-bold text-white">{spiMetrics.sckPeriodNs} ns</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">상승/하강:</span>
                  <span className="font-bold text-cyan-300">{spiMetrics.riseTimeNs} ns</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">셋업 마진:</span>
                  <span className={`font-bold ${spiMetrics.isTimingViolation ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {spiMetrics.availableSetupNs} ns
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SVG Analog Timing & Signal Waveform Diagram */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              실시간 아날로그 타이밍 다이어그램 & 임계 전압 (Real-Time Waveform & Eye Margin)
            </h4>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {protocol === 'i2c' ? '오픈 드레인 RC 충전 지수 곡선' : 'CMOS 푸시풀 슬루율 & 셋업/홀드 윈도우'}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 overflow-hidden relative">
          <svg viewBox="0 0 800 240" className="w-full h-56 select-none font-mono">
            {/* Grid background */}
            <defs>
              <pattern id="timing-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.8" />
              </pattern>
              <linearGradient id="i2c-rise-grad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3" />
              </linearGradient>
            </defs>

            <rect width="800" height="240" fill="url(#timing-grid)" />

            {/* Voltage Threshold Lines */}
            {/* VDD line */}
            <line x1="60" y1="30" x2="780" y2="30" stroke="#475569" strokeDasharray="3 3" strokeWidth="1" />
            <text x="50" y="34" fill="#94a3b8" fontSize="10" textAnchor="end">VDD ({supplyVoltage}V)</text>

            {/* VIH (0.7 * VDD) line */}
            <line x1="60" y1="57" x2="780" y2="57" stroke="#10b981" strokeDasharray="2 2" strokeWidth="1" />
            <text x="50" y="61" fill="#10b981" fontSize="10" textAnchor="end">VIH ({(supplyVoltage * 0.7).toFixed(2)}V)</text>

            {/* VIL (0.3 * VDD) line */}
            <line x1="60" y1="93" x2="780" y2="93" stroke="#f59e0b" strokeDasharray="2 2" strokeWidth="1" />
            <text x="50" y="97" fill="#f59e0b" fontSize="10" textAnchor="end">VIL ({(supplyVoltage * 0.3).toFixed(2)}V)</text>

            {/* GND line */}
            <line x1="60" y1="120" x2="780" y2="120" stroke="#475569" strokeWidth="1" />
            <text x="50" y="124" fill="#94a3b8" fontSize="10" textAnchor="end">GND (0V)</text>

            {protocol === 'i2c' ? (
              /* I2C SCL & SDA Waveforms */
              <g>
                {/* Channel Label */}
                <text x="15" y="160" fill="#38bdf8" fontSize="11" fontWeight="bold">SCL</text>
                <text x="15" y="215" fill="#f59e0b" fontSize="11" fontWeight="bold">SDA</text>

                {/* Simulated SCL clock line with RC exponential rise */}
                {/* Cycle 1: low (120), rise to 30 with curve, high, drop to 120 */}
                {/* The rise slope is scaled by i2cMetrics.riseTimeNs */}
                {(() => {
                  const riseWidth = Math.max(12, Math.min(90, Math.round(i2cMetrics.riseTimeNs / 10)));
                  const fallWidth = 8;
                  const periodWidth = 220;
                  const lowWidth = periodWidth / 2;
                  const highWidth = periodWidth / 2 - riseWidth;

                  // Wave path for SCL
                  const dScl = `
                    M 70 120
                    L 140 120
                    C ${140 + riseWidth * 0.4} 70, ${140 + riseWidth * 0.7} 40, ${140 + riseWidth} 30
                    L ${140 + riseWidth + highWidth} 30
                    L ${140 + riseWidth + highWidth + fallWidth} 120
                    L ${140 + periodWidth} 120
                    C ${140 + periodWidth + riseWidth * 0.4} 70, ${140 + periodWidth + riseWidth * 0.7} 40, ${140 + periodWidth + riseWidth} 30
                    L ${140 + periodWidth + riseWidth + highWidth} 30
                    L ${140 + periodWidth + riseWidth + highWidth + fallWidth} 120
                    L 760 120
                  `;

                  // Wave path for SDA (data line)
                  const dSda = `
                    M 70 220
                    L 200 220
                    C ${200 + riseWidth * 0.4} 190, ${200 + riseWidth * 0.7} 170, ${200 + riseWidth} 160
                    L 450 160
                    L 460 220
                    L 760 220
                  `;

                  return (
                    <>
                      {/* SCL Curve */}
                      <path d={dScl} fill="none" stroke="#38bdf8" strokeWidth="2.5" />

                      {/* Rise time indicator bracket */}
                      <line x1="140" y1="135" x2={140 + riseWidth} y2="135" stroke="#f43f5e" strokeWidth="1.5" />
                      <line x1="140" y1="130" x2="140" y2="140" stroke="#f43f5e" strokeWidth="1.5" />
                      <line x1={140 + riseWidth} y1="130" x2={140 + riseWidth} y2="140" stroke="#f43f5e" strokeWidth="1.5" />
                      <text x={140 + riseWidth / 2} y="148" fill="#f43f5e" fontSize="9" textAnchor="middle">
                        tr = {i2cMetrics.riseTimeNs}ns {i2cMetrics.isRiseTimeViolation ? '(초과!)' : ''}
                      </text>

                      {/* SDA Curve */}
                      <path d={dSda} fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray={i2cMetrics.isRiseTimeViolation ? '4 2' : undefined} />

                      {/* Sampling Strobe Arrow */}
                      <line x1="280" y1="20" x2="280" y2="230" stroke="#a855f7" strokeDasharray="3 3" strokeWidth="1.2" />
                      <text x="280" y="16" fill="#c084fc" fontSize="9" textAnchor="middle">SDA 샘플링 지점</text>
                    </>
                  );
                })()}
              </g>
            ) : (
              /* SPI SCK, MOSI, MISO Waveforms */
              <g>
                <text x="15" y="65" fill="#c084fc" fontSize="11" fontWeight="bold">SCK</text>
                <text x="15" y="140" fill="#38bdf8" fontSize="11" fontWeight="bold">MOSI</text>
                <text x="15" y="215" fill="#34d399" fontSize="11" fontWeight="bold">MISO</text>

                {(() => {
                  const sckPeriodPx = 160;
                  const edgePx = Math.max(3, Math.min(25, Math.round(spiMetrics.riseTimeNs * 2)));

                  // SCK clock square wave with edge slope
                  let sckPath = 'M 70 90 ';
                  for (let i = 0; i < 4; i++) {
                    const startX = 70 + i * sckPeriodPx;
                    sckPath += `L ${startX + 20} 90 L ${startX + 20 + edgePx} 40 L ${startX + sckPeriodPx / 2} 40 L ${startX + sckPeriodPx / 2 + edgePx} 90 `;
                  }

                  // MOSI Data Wave
                  const mosiPath = `
                    M 70 150
                    L 140 150
                    L ${140 + edgePx} 115
                    L 380 115
                    L ${380 + edgePx} 150
                    L 760 150
                  `;

                  return (
                    <>
                      <path d={sckPath} fill="none" stroke="#c084fc" strokeWidth="2.5" />
                      <path d={mosiPath} fill="none" stroke="#38bdf8" strokeWidth="2" />

                      {/* Setup Margin Bracket */}
                      <line x1="90" y1="105" x2="170" y2="105" stroke="#10b981" strokeWidth="1.5" />
                      <text x="130" y="102" fill="#10b981" fontSize="9" textAnchor="middle">
                        tSetup 여유: {spiMetrics.availableSetupNs}ns
                      </text>

                      {/* Sampling Strobe on Clock Edge */}
                      <line x1="170" y1="30" x2="170" y2="230" stroke="#f59e0b" strokeDasharray="3 3" strokeWidth="1.2" />
                      <text x="170" y="24" fill="#f59e0b" fontSize="9" textAnchor="middle">
                        샘플 에지 ({spiMode % 2 === 0 ? 'Leading' : 'Trailing'})
                      </text>
                    </>
                  );
                })()}
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Generated C Code & Hardware Fix Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Box 1: C Hardware Driver Code */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                {protocol === 'i2c' ? 'AVR TWI 하드웨어 레지스터 초기화 C 코드' : 'AVR SPI 하드웨어 레지스터 초기화 C 코드'}
              </h4>
            </div>
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono transition flex items-center gap-1.5"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? '복사됨!' : 'C 코드 복사'}</span>
            </button>
          </div>

          <pre className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-56 leading-relaxed select-all">
            {generatedCode}
          </pre>
        </div>

        {/* Box 2: Engineering Troubleshooting & Hardware Fixes */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-3.5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              임베디드 하드웨어 신호 무결성 솔루션
            </h4>
          </div>

          <div className="space-y-2.5 text-xs">
            {protocol === 'i2c' ? (
              <>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="font-bold text-amber-300">1. 풀업 저항(Rp) 계산 최적화 법칙</div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    풀업 저항이 너무 크면 기생 용량으로 인해 파형이 둥글게 뭉개지고, 너무 작으면 슬레이브가 로우(0)로 끌어내리지 못해 Vol이 0.4V를 초과하여 로우 인식 에러가 발생합니다. 현재 조건에서 최적의 저항값은 <strong>{((i2cMetrics.minPullupKohm + i2cMetrics.maxPullupKohm) / 2).toFixed(1)} kΩ</strong>입니다.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="font-bold text-cyan-300">2. 장거리(1m 이상) I2C 케이블 전송 시 노이즈 대책</div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    선로 용량이 400pF을 초과할 경우 I2C 전용 버스 버퍼(PCA9515A / P82B715) 또는 능동형 상승 시간 가속기(Active Pull-up Accelerator)를 적용하세요.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="font-bold text-rose-300">3. 내부 풀업(PORTxn=1) 사용 금지 경고</div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    AVR 내부 풀업은 20kΩ~50kΩ으로 매우 약하여 100kHz에서도 파형이 심각하게 지연됩니다. 반드시 2.2kΩ~4.7kΩ 외장 저항을 배치하세요.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="font-bold text-purple-300">1. 고속 SPI 신호 반사 및 댐핑 저항(Rs)</div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    SCK와 MOSI 라인의 MCU 출력 핀 직후에 22Ω~33Ω 저항을 직렬 삽입하면 고속 CMOS 스위칭으로 인한 링잉(Ringing) 및 오버슈트를 차단할 수 있습니다.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="font-bold text-cyan-300">2. 다중 슬레이브 MISO 버스 충돌 방지</div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    복수의 슬레이브를 연결할 때 비활성 슬레이브의 MISO 핀이 고임피던스(Hi-Z / Tri-state)로 전환되는지 확인하세요.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="font-bold text-emerald-300">3. SPI 모드(CPOL / CPHA) 불일치 해결</div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    센서/플래시 메모리 데이터시트의 타이밍 다이어그램을 확인하여 첫 번째 비트 샘플링 에지(Leading vs Trailing)와 일치하도록 SPCR 레지스터를 일치시키세요.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
