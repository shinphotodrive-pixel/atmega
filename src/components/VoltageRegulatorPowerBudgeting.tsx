import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Zap,
  Cpu,
  Layers,
  Activity,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  TrendingUp,
  Sliders,
  RotateCcw,
  ShieldCheck,
  Battery,
  Flame,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU: (mcu: SupportedMCU) => void;
}

export const VoltageRegulatorPowerBudgeting: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Operating parameters
  const [supplyVoltage, setSupplyVoltage] = useState<number>(5.0); // 3.3V or 5.0V
  const [regulatorType, setRegulatorType] = useState<'ldo_ams1117' | 'ldo_mcp1700' | 'buck_switching' | 'linear_7805'>('ldo_ams1117');
  const [inputVin, setInputVin] = useState<number>(9.0); // e.g. 9V / 12V adapter or battery
  const [clockMhz, setClockMhz] = useState<number>(16); // 1 to 20 MHz
  const [activeGpioCount, setActiveGpioCount] = useState<number>(12); // Number of active sourcing/sinking pins
  const [perPinCurrentMa, setPerPinCurrentMa] = useState<number>(8); // mA per pin (LEDs, relays, optocouplers)
  const [peripheralLoads, setPeripheralLoads] = useState<{
    usartActive: boolean;
    spiActive: boolean;
    twiActive: boolean;
    adcActive: boolean;
    pllActive: boolean;
  }>({
    usartActive: true,
    spiActive: true,
    twiActive: true,
    adcActive: true,
    pllActive: false
  });

  // Decoupling Capacitors & Trace Parasitics
  const [pcbTraceInductanceNh, setPcbTraceInductanceNh] = useState<number>(15); // nH (approx 10-25nH for typical PCB trace)
  const [decouplingMode, setDecouplingMode] = useState<'minimal' | 'recommended' | 'industrial'>('recommended');

  // Core MCU Dynamic Current estimation based on AVR Datasheet curves:
  // Typical Active Current: ~0.5mA / MHz at 5V; ~0.25mA / MHz at 3.3V
  const mcuCoreCurrentMa = useMemo(() => {
    const voltageScaling = supplyVoltage >= 4.5 ? 1.0 : (supplyVoltage / 5.0) * 0.7;
    const baseIdleMa = selectedMCU === 'atmega640' ? 2.5 : selectedMCU === 'atmega128' ? 3.0 : 1.2;
    const dynamicMhzFactor = selectedMCU === 'atmega328p' ? 0.35 : 0.52; // ATmega328P is PicoPower
    
    let current = baseIdleMa + (clockMhz * dynamicMhzFactor * voltageScaling);

    // Peripheral contributions
    if (peripheralLoads.usartActive) current += (selectedMCU === 'atmega640' ? 1.8 : 0.8);
    if (peripheralLoads.spiActive) current += 0.5;
    if (peripheralLoads.twiActive) current += 0.4;
    if (peripheralLoads.adcActive) current += 1.0;

    return Number(current.toFixed(2));
  }, [selectedMCU, clockMhz, supplyVoltage, peripheralLoads]);

  // GPIO Total Current
  const gpioTotalCurrentMa = useMemo(() => {
    return activeGpioCount * perPinCurrentMa;
  }, [activeGpioCount, perPinCurrentMa]);

  // Total Load Current (mA)
  const totalLoadCurrentMa = useMemo(() => {
    return Number((mcuCoreCurrentMa + gpioTotalCurrentMa).toFixed(2));
  }, [mcuCoreCurrentMa, gpioTotalCurrentMa]);

  // Maximum allowable ratings per MCU (AVR Absolute Maximum Ratings)
  const maxVccCurrentLimitMa = selectedMCU === 'atmega640' ? 400 : selectedMCU === 'atmega128' ? 400 : 200;
  const maxPerPinLimitMa = 40; // Absolute max 40mA per GPIO (20mA recommended)

  // Regulator specs
  const regProps = useMemo(() => {
    switch (regulatorType) {
      case 'ldo_ams1117':
        return {
          name: 'AMS1117-5.0 / 3.3 LDO',
          quiescentMa: 5.0,
          dropoutV: 1.1,
          efficiency: 0, // calculated dynamically below
          thermalResThetaJa: 90, // °C/W SOT-223
          maxCurrentMa: 800,
          typeDesc: '널리 사용되는 범용 저비용 LDO'
        };
      case 'ldo_mcp1700':
        return {
          name: 'Microchip MCP1700 Ultra-Low Iq LDO',
          quiescentMa: 0.002,
          dropoutV: 0.18,
          thermalResThetaJa: 130, // °C/W SOT-23
          maxCurrentMa: 250,
          typeDesc: '배터리 IoT 구동용 초저 누설 Iq LDO'
        };
      case 'buck_switching':
        return {
          name: '스위칭 벅 레귤레이터 (Buck DC-DC, e.g. MP2307/LM2596)',
          quiescentMa: 15.0,
          dropoutV: 0.5,
          thermalResThetaJa: 45, // °C/W SOIC-8
          maxCurrentMa: 2000,
          typeDesc: '고효율 강압 스위칭 컨버터 (발열 최소화)'
        };
      case 'linear_7805':
      default:
        return {
          name: 'LM7805 Classic Linear Regulator',
          quiescentMa: 6.0,
          dropoutV: 2.0,
          thermalResThetaJa: 54, // °C/W TO-220
          maxCurrentMa: 1500,
          typeDesc: '전통적인 리니어 레귤레이터 (방열판 권장)'
        };
    }
  }, [regulatorType]);

  // Power Calculations
  const powerAnalysis = useMemo(() => {
    const totalOutAmps = totalLoadCurrentMa / 1000;
    const vDrop = Math.max(0, inputVin - supplyVoltage);
    let powerLossWatts = 0;
    let efficiencyPercent = 0;

    if (regulatorType === 'buck_switching') {
      efficiencyPercent = 88; // ~88% typical efficiency
      const pOut = supplyVoltage * totalOutAmps;
      const pIn = pOut / (efficiencyPercent / 100);
      powerLossWatts = pIn - pOut;
    } else {
      // Linear / LDO: Power = (Vin - Vout) * Iload + Vin * Iq
      const iqAmps = regProps.quiescentMa / 1000;
      powerLossWatts = (vDrop * totalOutAmps) + (inputVin * iqAmps);
      const pOut = supplyVoltage * totalOutAmps;
      const pIn = (inputVin * (totalOutAmps + iqAmps));
      efficiencyPercent = pIn > 0 ? (pOut / pIn) * 100 : 0;
    }

    // Junction Temperature Rise (Ambient 25°C assumed)
    const ambientTempC = 25;
    const tempRiseC = powerLossWatts * regProps.thermalResThetaJa;
    const estimatedJunctionTempC = ambientTempC + tempRiseC;

    // Headroom check
    const isVinAdequate = (inputVin - supplyVoltage) >= regProps.dropoutV;

    return {
      powerLossWatts: Number(powerLossWatts.toFixed(3)),
      efficiencyPercent: Number(efficiencyPercent.toFixed(1)),
      estimatedJunctionTempC: Number(estimatedJunctionTempC.toFixed(1)),
      tempRiseC: Number(tempRiseC.toFixed(1)),
      isVinAdequate,
      vDrop: Number(vDrop.toFixed(2))
    };
  }, [inputVin, supplyVoltage, totalLoadCurrentMa, regulatorType, regProps]);

  // Decoupling Requirements & Transient Dip Prediction
  const decouplingAnalysis = useMemo(() => {
    // Current spike di/dt during simultaneous GPIO switching & internal clock edges:
    // Est: 30% of total load switches within 2ns (AVR output buffer slew rate ~ 2ns)
    const switchingAmps = (totalLoadCurrentMa * 0.4) / 1000;
    const deltaT_ns = 2.5; // nanoseconds rise time

    // Voltage droop without decoupling: deltaV = L * (di/dt)
    const deltaT_sec = deltaT_ns * 1e-9;
    const traceL_H = pcbTraceInductanceNh * 1e-9;
    const unbufferedDroopV = traceL_H * (switchingAmps / deltaT_sec);

    // Capacitor values recommendations based on mode and MCU
    let recBulkCapUf = 10;
    let recCeramicCapNf = 100; // 0.1 uF
    let ceramicCount = selectedMCU === 'atmega640' ? 5 : selectedMCU === 'atmega128' ? 4 : 2;

    if (decouplingMode === 'recommended') {
      recBulkCapUf = selectedMCU === 'atmega640' ? 47 : 22;
      recCeramicCapNf = 100;
      ceramicCount = selectedMCU === 'atmega640' ? 6 : selectedMCU === 'atmega128' ? 4 : 2;
    } else if (decouplingMode === 'industrial') {
      recBulkCapUf = 100;
      recCeramicCapNf = 100;
      ceramicCount = selectedMCU === 'atmega640' ? 8 : selectedMCU === 'atmega128' ? 6 : 3;
    }

    // Residual transient droop with active bypass capacitor network
    // DeltaV_filtered = (di * dt) / C_total + ESR * di
    const cTotalUf = (ceramicCount * (recCeramicCapNf / 1000)) + (recBulkCapUf * 0.1); // effective HF cap
    const cTotalFarad = cTotalUf * 1e-6;
    const esrOhm = 0.05; // 50mOhm for MLCC
    const filteredDroopMv = Math.min(supplyVoltage * 1000, ((switchingAmps * deltaT_sec) / cTotalFarad + switchingAmps * esrOhm) * 1000);

    const droopPercent = (filteredDroopMv / (supplyVoltage * 1000)) * 100;
    const stabilityStatus: 'good' | 'warning' | 'danger' =
      droopPercent < 3.0 ? 'good' : droopPercent < 7.0 ? 'warning' : 'danger';

    return {
      unbufferedDroopV: Number(unbufferedDroopV.toFixed(2)),
      filteredDroopMv: Number(filteredDroopMv.toFixed(1)),
      droopPercent: Number(droopPercent.toFixed(2)),
      stabilityStatus,
      recBulkCapUf,
      recCeramicCapNf,
      ceramicCount,
      switchingAmpsMa: Number((switchingAmps * 1000).toFixed(1))
    };
  }, [totalLoadCurrentMa, pcbTraceInductanceNh, decouplingMode, selectedMCU, supplyVoltage]);

  // Dynamic Frequency vs Power Stability Chart Data
  const chartData = useMemo(() => {
    const freqs = [1, 4, 8, 12, 16, 20];
    return freqs.map((f) => {
      const dynamicMcuMa = (selectedMCU === 'atmega328p' ? 0.35 : 0.52) * f + (selectedMCU === 'atmega640' ? 4.5 : 3.0);
      const totalMa = dynamicMcuMa + gpioTotalCurrentMa;
      const vDrop = Math.max(0, inputVin - supplyVoltage);
      const pLossW = regulatorType === 'buck_switching'
        ? ((supplyVoltage * totalMa / 1000) / 0.88) - (supplyVoltage * totalMa / 1000)
        : (vDrop * totalMa / 1000) + (inputVin * (regProps.quiescentMa / 1000));
      const jTempC = 25 + (pLossW * regProps.thermalResThetaJa);
      const droopMv = (decouplingAnalysis.filteredDroopMv * (f / clockMhz)).toFixed(1);

      return {
        freq: `${f}MHz`,
        mcuCurrent: Number(dynamicMcuMa.toFixed(1)),
        totalCurrent: Number(totalMa.toFixed(1)),
        temp: Number(jTempC.toFixed(1)),
        powerW: Number(pLossW.toFixed(2)),
        droopMv: Number(droopMv)
      };
    });
  }, [selectedMCU, gpioTotalCurrentMa, inputVin, supplyVoltage, regulatorType, regProps, decouplingAnalysis, clockMhz]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
            <Battery className="w-3.5 h-3.5" />
            Power Integrity & Decoupling Budgeting Tool
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            {currentProfile.name} 전압 레귤레이터 & 디커플링 전력 버짓 분석기
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            MCU의 동작 주파수(F_CPU), 활성 GPIO 포트 구동 전류 및 주변장치 전력 소모를 합산하여,
            레귤레이터 발열(접합 온도 Tj), 배터리 방전 효율, 디커플링 커패시터 용량 및 고속 스위칭 전압 강하(Droop)를 시뮬레이션합니다.
          </p>
        </div>

        <div className="text-right text-xs">
          <span className="text-slate-400 block font-mono">VCC 단일 허용 총전류</span>
          <span className="font-bold text-amber-400 font-mono text-sm">
            최대 {maxVccCurrentLimitMa} mA (현재 부하: {totalLoadCurrentMa} mA)
          </span>
        </div>
      </div>

      {/* Control Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Panel 1: Operating Power Supply & Regulator Selection */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            전원 공급원 및 레귤레이터
          </h4>

          {/* VCC Voltage */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 font-medium flex justify-between">
              <span>동작 전압 (VCC)</span>
              <span className="text-amber-400 font-mono font-bold">{supplyVoltage} V</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSupplyVoltage(5.0)}
                className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                  supplyVoltage === 5.0
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                5.0V 표준 구동
              </button>
              <button
                onClick={() => setSupplyVoltage(3.3)}
                className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                  supplyVoltage === 3.3
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                3.3V 저전력 구동
              </button>
            </div>
          </div>

          {/* Input Voltage (Vin) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-slate-400 font-medium">
              <span>입력 전압 (Vin 아답터/배터리)</span>
              <span className="text-white font-mono font-bold">{inputVin} V</span>
            </div>
            <input
              type="range"
              min="4.5"
              max="15.0"
              step="0.5"
              value={inputVin}
              onChange={(e) => setInputVin(parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>5V USB</span>
              <span>7.4V 2S LiPo</span>
              <span>9V 전원</span>
              <span>12V 산업용</span>
            </div>
          </div>

          {/* Regulator Topology */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 font-medium block">레귤레이터 토폴로지</label>
            <select
              value={regulatorType}
              onChange={(e) => setRegulatorType(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
            >
              <option value="ldo_ams1117">AMS1117 LDO (저비용 범용, 드롭아웃 1.1V)</option>
              <option value="ldo_mcp1700">Microchip MCP1700 (초저Iq 2µA, 드롭아웃 0.18V)</option>
              <option value="buck_switching">스위칭 벅 컨버터 (Buck DC-DC, 효율 88%)</option>
              <option value="linear_7805">LM7805 전통 리니어 (드롭아웃 2.0V)</option>
            </select>
            <p className="text-[10px] text-slate-400 leading-tight">
              {regProps.typeDesc} • 열저항(Theta-JA): {regProps.thermalResThetaJa} °C/W
            </p>
          </div>
        </div>

        {/* Panel 2: Microcontroller & GPIO Dynamic Loading */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            동작 주파수 & GPIO 부하 설정
          </h4>

          {/* Operating Clock */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-slate-400 font-medium">
              <span>동작 클럭 (F_CPU)</span>
              <span className="text-cyan-400 font-mono font-bold">{clockMhz} MHz</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={clockMhz}
              onChange={(e) => setClockMhz(parseInt(e.target.value))}
              className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>1MHz (RC)</span>
              <span>8MHz (내부)</span>
              <span>16MHz (크리스탈)</span>
              <span>20MHz (오버클럭)</span>
            </div>
          </div>

          {/* GPIO Active Sourcing/Sinking */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-slate-400 font-medium">
              <span>동시 구동 GPIO 핀 수 (최대 {currentProfile.io}개)</span>
              <span className="text-emerald-400 font-mono font-bold">{activeGpioCount} 핀</span>
            </div>
            <input
              type="range"
              min="0"
              max={Math.min(currentProfile.io, 40)}
              step="1"
              value={activeGpioCount}
              onChange={(e) => setActiveGpioCount(parseInt(e.target.value))}
              className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Per-Pin Current */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-slate-400 font-medium">
              <span>핀당 구동 전류 (LED, 트랜지스터)</span>
              <span className="text-emerald-400 font-mono font-bold">{perPinCurrentMa} mA / 핀</span>
            </div>
            <input
              type="range"
              min="1"
              max="25"
              step="1"
              value={perPinCurrentMa}
              onChange={(e) => setPerPinCurrentMa(parseInt(e.target.value))}
              className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="text-[10px] text-slate-400 font-mono flex justify-between">
              <span>권장 정격: ≤ 20mA</span>
              <span className="text-rose-400">절대 최대 한계: 40mA</span>
            </div>
          </div>
        </div>

        {/* Panel 3: Decoupling & PCB Parasitics */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            디커플링 커패시터 & PCB 기생 인덕턴스
          </h4>

          {/* Decoupling Level */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 font-medium block">디커플링 구성 등급</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['minimal', 'recommended', 'industrial'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setDecouplingMode(mode)}
                  className={`py-1 px-1.5 text-[11px] font-semibold rounded-lg border transition text-center ${
                    decouplingMode === mode
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {mode === 'minimal' && '최소형 (1개)'}
                  {mode === 'recommended' && '권장 표준'}
                  {mode === 'industrial' && '산업용 다중'}
                </button>
              ))}
            </div>
          </div>

          {/* Trace Inductance */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-slate-400 font-medium">
              <span>PCB 배선 기생 인덕턴스 (L_trace)</span>
              <span className="text-indigo-400 font-mono font-bold">{pcbTraceInductanceNh} nH</span>
            </div>
            <input
              type="range"
              min="5"
              max="40"
              step="1"
              value={pcbTraceInductanceNh}
              onChange={(e) => setPcbTraceInductanceNh(parseInt(e.target.value))}
              className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>5nH (넓은 플레인)</span>
              <span>15nH (일반)</span>
              <span>40nH (긴 배선)</span>
            </div>
          </div>

          {/* Recommended BOM */}
          <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-[11px] space-y-1 text-slate-300">
            <div className="text-amber-400 font-bold font-mono text-xs">권장 바이패스 커패시터 구성:</div>
            <div>• 세라믹 MLCC (0.1µF / 100nF): <strong className="text-white">{decouplingAnalysis.ceramicCount}개</strong> (VCC-GND 핀마다 인접 배치)</div>
            <div>• 전해/탄탈 벌크 커패시터: <strong className="text-white">{decouplingAnalysis.recBulkCapUf}µF</strong> (레귤레이터 출력단)</div>
          </div>
        </div>
      </div>

      {/* KPI Evaluation Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Current Load */}
        <div className={`p-4 rounded-xl border ${
          totalLoadCurrentMa > maxVccCurrentLimitMa
            ? 'bg-rose-950/30 border-rose-800 text-rose-300'
            : 'bg-slate-950/70 border-slate-800 text-slate-200'
        }`}>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>총 소비 전류 합산</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white mt-1">
            {totalLoadCurrentMa} <span className="text-xs font-normal text-slate-400">mA</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            MCU 코어: {mcuCoreCurrentMa}mA + GPIO: {gpioTotalCurrentMa}mA
          </div>
        </div>

        {/* Regulator Power Loss & Thermal Junction */}
        <div className={`p-4 rounded-xl border ${
          powerAnalysis.estimatedJunctionTempC > 85
            ? 'bg-rose-950/30 border-rose-800 text-rose-300'
            : powerAnalysis.estimatedJunctionTempC > 60
            ? 'bg-amber-950/30 border-amber-800 text-amber-300'
            : 'bg-slate-950/70 border-slate-800 text-slate-200'
        }`}>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>레귤레이터 손실 & 온도</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white mt-1">
            {powerAnalysis.estimatedJunctionTempC} <span className="text-xs font-normal text-slate-400">°C</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            손실 전력: {powerAnalysis.powerLossWatts}W (상온+25°C 기준)
          </div>
        </div>

        {/* Power Conversion Efficiency */}
        <div className="p-4 rounded-xl border bg-slate-950/70 border-slate-800 text-slate-200">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>전원 변환 효율</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white mt-1">
            {powerAnalysis.efficiencyPercent} <span className="text-xs font-normal text-slate-400">%</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            드롭아웃 마진: {(inputVin - supplyVoltage).toFixed(1)}V (정상 여유)
          </div>
        </div>

        {/* Dynamic Voltage Droop & Stability */}
        <div className={`p-4 rounded-xl border ${
          decouplingAnalysis.stabilityStatus === 'good'
            ? 'bg-emerald-950/20 border-emerald-800/50'
            : decouplingAnalysis.stabilityStatus === 'warning'
            ? 'bg-amber-950/20 border-amber-800/50'
            : 'bg-rose-950/20 border-rose-800/50'
        }`}>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>과도 전압 강하 (Droop)</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white mt-1">
            {decouplingAnalysis.filteredDroopMv} <span className="text-xs font-normal text-slate-400">mV</span>
          </div>
          <div className="text-[11px] font-semibold mt-1">
            {decouplingAnalysis.stabilityStatus === 'good' && (
              <span className="text-emerald-400">전원 무결성 매우 양호 ({decouplingAnalysis.droopPercent}%)</span>
            )}
            {decouplingAnalysis.stabilityStatus === 'warning' && (
              <span className="text-amber-400">주의: 디커플링 보강 권장 ({decouplingAnalysis.droopPercent}%)</span>
            )}
            {decouplingAnalysis.stabilityStatus === 'danger' && (
              <span className="text-rose-400">위험: 브라운아웃(BOD) 리셋 가능 ({decouplingAnalysis.droopPercent}%)</span>
            )}
          </div>
        </div>
      </div>

      {/* Recharts Visualizer: Frequency vs Total Load Current & Thermal Trajectory */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            클럭 주파수별 전력 소모 및 레귤레이터 접합 온도($T_j$) 프로파일
          </h4>
          <span className="text-[10px] text-slate-400 font-mono">1MHz ~ 20MHz 스윕 시뮬레이션</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="freq" stroke="#94a3b8" fontSize={11} />
              <YAxis yAxisId="left" stroke="#38bdf8" fontSize={11} unit="mA" domain={[0, 'auto']} />
              <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" fontSize={11} unit="°C" domain={[20, 120]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem' }}
                labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <ReferenceLine yAxisId="right" y={85} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: '열경고 85°C', fill: '#f43f5e', fontSize: 10 }} />
              <Line yAxisId="left" type="monotone" dataKey="totalCurrent" name="총 소비 전류 (mA)" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line yAxisId="left" type="monotone" dataKey="mcuCurrent" name="MCU 코어 전류 (mA)" stroke="#34d399" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="temp" name="레귤레이터 온도 (°C)" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Engineering Design Guidelines & PCB Tips */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 space-y-2">
        <div className="font-bold text-amber-400 flex items-center gap-1.5">
          <Info className="w-4 h-4" /> 하드웨어 엔지니어링 안정성 가이드라인
        </div>
        <ul className="list-disc list-inside space-y-1 text-slate-400 leading-relaxed">
          <li>
            <strong className="text-slate-200">VCC/GND 핀 분산 디커플링:</strong> {currentProfile.name}은 여러 쌍의 VCC/GND 핀을 가지고 있습니다. 각 VCC 핀과 가장 가까운 GND 핀 사이에 0.1µF MLCC를 물리적으로 3mm 이내에 배치해야 루프 인덕턴스를 최소화할 수 있습니다.
          </li>
          <li>
            <strong className="text-slate-200">AVCC 아날로그 필터:</strong> ADC를 정밀하게 사용할 경우, AVCC 핀은 디지털 VCC 라인과 직접 연결하지 말고 10µH 인덕터와 100nF 커패시터로 구성된 LC 로우패스 필터를 거쳐 연결하십시오.
          </li>
          <li>
            <strong className="text-slate-200">열 폭주(Thermal Runaway) 방지:</strong> 리니어 LDO(AMS1117/LM7805)는 입력 전압이 12V이고 부하가 150mA 이상일 경우 1W 이상의 열을 발산하여 방열판 없이 90°C를 초과할 수 있습니다. 9V 이상의 전원에서는 벅 스위칭 컨버터 사용을 적극 권장합니다.
          </li>
        </ul>
      </div>
    </div>
  );
};
