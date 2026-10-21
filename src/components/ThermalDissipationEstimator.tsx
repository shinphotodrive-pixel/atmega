import React, { useState, useMemo } from 'react';
import {
  Thermometer,
  Flame,
  Zap,
  Cpu,
  Layers,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  Sliders,
  Copy,
  Check,
  RotateCcw,
  Gauge,
  TrendingUp,
  Activity,
  Sparkles,
  ArrowRight,
  Fan
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export interface PackageThermalSpec {
  id: string;
  name: string;
  pinCount: number;
  thetaJA: number; // °C/W in still air (JEDEC standard 4-layer PCB)
  thetaJC: number; // °C/W junction-to-case
  thetaJASingleLayer: number; // °C/W single-layer minimal copper
  description: string;
  hasExposedPad: boolean;
}

export const MCU_PACKAGE_THERMALS: Record<SupportedMCU, PackageThermalSpec[]> = {
  atmega328p: [
    {
      id: '28p3_pdip',
      name: '28-pin PDIP (28P3)',
      pinCount: 28,
      thetaJA: 60,
      thetaJC: 32,
      thetaJASingleLayer: 84,
      description: '쓰루홀 브레드보드 및 프로토타입용 패키지. 열 방출 경로가 리드 프레임에 제한됨.',
      hasExposedPad: false
    },
    {
      id: '32a_tqfp',
      name: '32-pin TQFP (32A)',
      pinCount: 32,
      thetaJA: 40,
      thetaJC: 18,
      thetaJASingleLayer: 60,
      description: '표준 표면실장(SMD) 플라스틱 패키지. Arduino Nano / Pro Mini 대표 패키지.',
      hasExposedPad: false
    },
    {
      id: '32m1a_qfn',
      name: '32-pin QFN/MLF (32M1-A)',
      pinCount: 32,
      thetaJA: 28,
      thetaJC: 12,
      thetaJASingleLayer: 45,
      description: '하단 방열 패드(Exposed Pad, EP) 포함. PCB 그라운드 플레인과 비아 연결 시 최상의 방열.',
      hasExposedPad: true
    }
  ],
  atmega128: [
    {
      id: '64a_tqfp',
      name: '64-pin TQFP (64A)',
      pinCount: 64,
      thetaJA: 42,
      thetaJC: 14,
      thetaJASingleLayer: 58,
      description: '64리드 TQFP 표준 패키지. 넓은 다이 크기와 핀 수로 양호한 열 전도성 확보.',
      hasExposedPad: false
    },
    {
      id: '64m1_qfn',
      name: '64-pin QFN/MLF (64M1)',
      pinCount: 64,
      thetaJA: 25,
      thetaJC: 9,
      thetaJASingleLayer: 38,
      description: '소형 고밀도 QFN 패키지. 중앙 방열판(Thermal Pad) 솔더링을 통해 낮은 θJA 달성.',
      hasExposedPad: true
    }
  ],
  atmega640: [
    {
      id: '100a_tqfp',
      name: '100-pin TQFP (100A)',
      pinCount: 100,
      thetaJA: 38,
      thetaJC: 12,
      thetaJASingleLayer: 52,
      description: '100핀 고다족 TQFP 패키지. Arduino Mega2560 계열과 동일 폼팩터.',
      hasExposedPad: false
    },
    {
      id: '100c1_cbga',
      name: '100-ball CBGA (100C1)',
      pinCount: 100,
      thetaJA: 32,
      thetaJC: 10,
      thetaJASingleLayer: 42,
      description: 'BGA 볼 어레이를 통한 PCB 내부 그라운드/전원 플레인 직접 열 확산.',
      hasExposedPad: false
    }
  ],
  atmega2560: [
    {
      id: '100a_tqfp',
      name: '100-pin TQFP (100A / ATmega2560-16AU)',
      pinCount: 100,
      thetaJA: 38,
      thetaJC: 12,
      thetaJASingleLayer: 52,
      description: 'Arduino Mega 2560 정품 표준 패키지. 100핀 TQFP로 핀 접촉 면적이 넓어 38°C/W 양호한 방열 특성 확보.',
      hasExposedPad: false
    },
    {
      id: '100c1_cbga',
      name: '100-ball CBGA (100C1)',
      pinCount: 100,
      thetaJA: 32,
      thetaJC: 10,
      thetaJASingleLayer: 42,
      description: 'BGA 볼 어레이를 통한 PCB 내부 그라운드/전원 플레인 직접 열 확산 (초고밀도 산업용 패키징).',
      hasExposedPad: false
    }
  ]
};

export type CoolingPresetId = 'still_enclosure' | 'standard_pcb' | 'solid_copper' | 'forced_air';

interface CoolingPreset {
  id: CoolingPresetId;
  name: string;
  multiplier: number;
  description: string;
}

const COOLING_PRESETS: CoolingPreset[] = [
  {
    id: 'still_enclosure',
    name: '밀폐 케이스 (Still Air in Enclosure)',
    multiplier: 1.25,
    description: '공기 순환이 차단된 방수/방진 함체 내부. 대류 열전달 저하로 θJA 25% 증가.'
  },
  {
    id: 'standard_pcb',
    name: '표준 2/4층 PCB (Natural Convection)',
    multiplier: 1.0,
    description: 'JEDEC 표준 4층 FR4 기판 기준. 일반 실온 대류 냉각 조건.'
  },
  {
    id: 'solid_copper',
    name: '대면적 GND 플레인 + 방열 비아 (Heavy Copper)',
    multiplier: 0.8,
    description: '2oz 동박 및 IC 하단 다층 서멀 비아(Thermal Vias) 적용. 방열 성능 20% 개선.'
  },
  {
    id: 'forced_air',
    name: '강제 공랭 팬 (Forced Air 200 LFM)',
    multiplier: 0.6,
    description: '냉각 팬에 의한 1m/s(200 LFM) 공기 유동. 열저항 대폭 감소.'
  }
];

export const ThermalDissipationEstimator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const availablePackages = MCU_PACKAGE_THERMALS[selectedMCU];

  // Selection states
  const [selectedPackageId, setSelectedPackageId] = useState<string>(() => availablePackages[0].id);
  const [coolingPresetId, setCoolingPresetId] = useState<CoolingPresetId>('standard_pcb');

  // Input states
  const [voltage, setVoltage] = useState<number>(selectedMCU === 'atmega128' ? 5.0 : 5.0);
  const [coreCurrentMa, setCoreCurrentMa] = useState<number>(18); // Internal MCU core current (typ 10~25mA at 16MHz)
  const [ioCurrentMa, setIoCurrentMa] = useState<number>(40); // Total external IO sink/source current (LEDs, relays, bus lines)
  const [vDropIo, setVDropIo] = useState<number>(0.5); // Internal transistor drop (VOL/VOH drop typ 0.4~0.6V at 20mA)
  const [ambientTemp, setAmbientTemp] = useState<number>(25); // °C

  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // Keep package selection valid when MCU switches
  const currentPackage = useMemo(() => {
    return availablePackages.find((pkg) => pkg.id === selectedPackageId) || availablePackages[0];
  }, [availablePackages, selectedPackageId]);

  const currentCooling = useMemo(() => {
    return COOLING_PRESETS.find((c) => c.id === coolingPresetId) || COOLING_PRESETS[1];
  }, [coolingPresetId]);

  // Electrical & Thermal Calculations
  const calculations = useMemo(() => {
    // 1. Core Silicon Power Dissipation: P_core = Vcc * I_core
    const pCoreWatts = voltage * (coreCurrentMa / 1000);
    const pCoreMilliwatts = pCoreWatts * 1000;

    // 2. I/O Pin Driver Dissipation inside chip die:
    // When sinking or sourcing current, power dissipated INSIDE the AVR die is: P_IO = V_drop * I_io
    // (Note: the remaining voltage drop is across external components like resistors or LEDs)
    const pIoWatts = vDropIo * (ioCurrentMa / 1000);
    const pIoMilliwatts = pIoWatts * 1000;

    // 3. Total Die Power Dissipation:
    const pTotalWatts = pCoreWatts + pIoWatts;
    const pTotalMilliwatts = pTotalWatts * 1000;

    // 4. Effective Thermal Resistance:
    const effectiveThetaJA = +(currentPackage.thetaJA * currentCooling.multiplier).toFixed(1);

    // 5. Temperature Rise Delta T:
    const deltaT = +(pTotalWatts * effectiveThetaJA).toFixed(2);

    // 6. Estimated Junction Temperature:
    const junctionTemp = +(ambientTemp + deltaT).toFixed(2);

    // 7. Case Temperature estimate (T_case = T_junction - P * theta_JC):
    const effectiveThetaJC = currentPackage.thetaJC;
    const caseTemp = +(junctionTemp - (pTotalWatts * effectiveThetaJC)).toFixed(2);

    // 8. Max Limits and Headroom:
    const maxAbsoluteTj = 125.0; // AVR Absolute Maximum Junction Temp
    const recommendedTj = 85.0; // Industrial spec continuous maximum
    const headroomToMax = +(maxAbsoluteTj - junctionTemp).toFixed(1);
    const headroomToRec = +(recommendedTj - junctionTemp).toFixed(1);

    // 9. Status severity:
    let status: 'safe' | 'nominal' | 'caution' | 'warning' | 'critical' = 'safe';
    let statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    let statusLabel = '안전 (Safe Operating Range)';
    let statusDesc = '접합부 온도(TJ)가 권장 기준치(85°C) 이하로 매우 안정적입니다.';

    if (junctionTemp >= maxAbsoluteTj) {
      status = 'critical';
      statusColor = 'text-rose-400 bg-rose-500/20 border-rose-500/50';
      statusLabel = '위험: 정격 초과 (Thermal Overstress)';
      statusDesc = '최대 허용 접합부 온도(125°C)를 초과하여 영구적인 실리콘 손상 위험이 있습니다!';
    } else if (junctionTemp >= 105) {
      status = 'warning';
      statusColor = 'text-orange-400 bg-orange-500/15 border-orange-500/40';
      statusLabel = '경고: 고온 동작 (Extended Temp Limit)';
      statusDesc = '105°C 이상의 고온으로 플래시/EEPROM 수명 저하 및 타이밍 오차가 발생할 수 있습니다.';
    } else if (junctionTemp >= 85) {
      status = 'caution';
      statusColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      statusLabel = '주의: 산업용 한계 근접 (Near Industrial Limit)';
      statusDesc = '산업용 정격(85°C)을 초과하였으므로 방열 비아 확충이나 I/O 전류 부하 감소를 권장합니다.';
    } else if (junctionTemp >= 60) {
      status = 'nominal';
      statusColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      statusLabel = '적정 (Moderate Temperature)';
      statusDesc = '통상적인 부하 상태이며 충분한 열적 여유(Headroom)를 확보하고 있습니다.';
    }

    // 10. Max allowable power before reaching 125°C from current Ambient:
    const maxAllowablePowerWatts = effectiveThetaJA > 0 ? (maxAbsoluteTj - ambientTemp) / effectiveThetaJA : 0;
    const maxAllowablePowerMw = +(maxAllowablePowerWatts * 1000).toFixed(0);

    return {
      pCoreMilliwatts,
      pIoMilliwatts,
      pTotalWatts,
      pTotalMilliwatts,
      effectiveThetaJA,
      effectiveThetaJC,
      deltaT,
      junctionTemp,
      caseTemp,
      maxAbsoluteTj,
      recommendedTj,
      headroomToMax,
      headroomToRec,
      status,
      statusColor,
      statusLabel,
      statusDesc,
      maxAllowablePowerMw
    };
  }, [voltage, coreCurrentMa, ioCurrentMa, vDropIo, ambientTemp, currentPackage, currentCooling]);

  // Copy thermal report
  const copyThermalReport = () => {
    const reportText = `========================================================
[AVR Thermal Dissipation & Junction Temp Report]
MCU: ${currentProfile.name} (${currentProfile.fullName})
Package: ${currentPackage.name} (θJA: ${calculations.effectiveThetaJA} °C/W, θJC: ${currentPackage.thetaJC} °C/W)
Cooling Condition: ${currentCooling.name}

[Operating Conditions]
- VCC Operating Voltage: ${voltage.toFixed(2)} V
- Core Silicon Current (ICC): ${coreCurrentMa} mA
- Total External I/O Pin Current (IIO): ${ioCurrentMa} mA (V_drop: ${vDropIo} V)
- Ambient Temperature (TA): ${ambientTemp} °C

[Power Dissipation Breakdown]
- Core Power (P_core): ${calculations.pCoreMilliwatts.toFixed(1)} mW
- I/O Drivers Dissipation (P_IO): ${calculations.pIoMilliwatts.toFixed(1)} mW
- Total Die Power (PD): ${calculations.pTotalMilliwatts.toFixed(1)} mW (${calculations.pTotalWatts.toFixed(4)} W)

[Thermal Estimation Results]
- Temperature Rise (ΔT): +${calculations.deltaT} °C
- Estimated Junction Temp (TJ): ${calculations.junctionTemp} °C
- Estimated Case Temp (TC): ${calculations.caseTemp} °C
- Thermal Headroom to 125°C: ${calculations.headroomToMax} °C
- Status: ${calculations.statusLabel}
- Max Allowable Power at ${ambientTemp}°C TA: ${calculations.maxAllowablePowerMw} mW
========================================================`;
    navigator.clipboard.writeText(reportText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const isIoCurrentExceeded = ioCurrentMa > 200;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold mb-2">
            <Thermometer className="w-3.5 h-3.5" /> Thermal Dissipation & Package θJA Estimator
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Flame className="w-5 h-5 text-rose-500" />
            {currentProfile.name} 접합부 온도(TJ) & 패키지 열저항(θJA) 계산기
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            공급 전압(V), 코어 동작 전류(ICC), 외부 I/O 구동 전류(IIO) 및 패키지별 열저항(θJA)을 기반으로
            다이 내부 발열량(mW)과 <strong>실제 실리콘 접합부 온도(Junction Temperature, TJ)</strong>를 정밀 추정합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onSelectMCU && (
            <div className="flex flex-wrap bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
                <button
                  key={mcuId}
                  onClick={() => onSelectMCU(mcuId)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    selectedMCU === mcuId
                      ? 'bg-rose-500 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {MCU_PROFILES[mcuId].name}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={copyThermalReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedReport ? '복사됨' : '열 보고서 복사'}
          </button>
        </div>
      </div>

      {/* Main Grid: Inputs vs Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Input Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Package Selector */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-rose-400" />
                1. 패키지 형태 및 열저항(θJA) 선택
              </label>
              <span className="text-[11px] font-mono text-rose-400">
                θJA: {currentPackage.thetaJA} °C/W
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availablePackages.map((pkg) => {
                const isSelected = pkg.id === currentPackage.id;
                return (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackageId(pkg.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-rose-500/10 border-rose-500/50 text-white shadow-sm'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-white">{pkg.name}</span>
                      {pkg.hasExposedPad && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          방열패드(EP)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>θJA = {pkg.thetaJA} °C/W</span>
                      <span>θJC = {pkg.thetaJC} °C/W</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {pkg.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cooling & Environment Preset */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 space-y-2.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Fan className="w-4 h-4 text-cyan-400" />
              2. PCB 방열 설계 및 주변 냉각 환경
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {COOLING_PRESETS.map((cool) => (
                <button
                  key={cool.id}
                  onClick={() => setCoolingPresetId(cool.id)}
                  className={`p-2.5 rounded-lg border text-left text-xs transition ${
                    coolingPresetId === cool.id
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                      : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-semibold text-white flex justify-between items-center">
                    <span>{cool.name}</span>
                    <span className="font-mono text-[10px] text-cyan-400">×{cool.multiplier}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">{cool.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Sliders: Voltage, ICC, IIO, Ambient */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 space-y-4">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-amber-400" />
              3. 전기적 파라미터 & 주변 온도 설정
            </label>

            {/* Voltage (VCC) */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">공급 전압 (VCC):</span>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[1.8, 2.7, 3.3, 5.0].map((v) => (
                      <button
                        key={v}
                        onClick={() => setVoltage(v)}
                        className={`px-1.5 py-0.5 text-[10px] rounded font-mono border ${
                          voltage === v
                            ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {v}V
                      </button>
                    ))}
                  </div>
                  <span className="font-mono font-bold text-amber-400">{voltage.toFixed(2)} V</span>
                </div>
              </div>
              <input
                type="range"
                min="1.8"
                max="5.5"
                step="0.1"
                value={voltage}
                onChange={(e) => setVoltage(parseFloat(e.target.value))}
                className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Core Current (ICC) */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">코어 동작 전류 (ICC):</span>
                <span className="font-mono font-bold text-white">{coreCurrentMa} mA</span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={coreCurrentMa}
                onChange={(e) => setCoreCurrentMa(parseInt(e.target.value))}
                className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>1 mA (슬립/저클럭)</span>
                <span>12~18 mA (16MHz Active typ)</span>
                <span>50 mA (최대 부하)</span>
              </div>
            </div>

            {/* Total I/O Current (IIO) */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 flex items-center gap-1">
                  총 I/O 출력 구동 전류 (Σ IIO):
                  {isIoCurrentExceeded && (
                    <span className="text-[10px] text-rose-400 font-bold">⚠️ VCC/GND 200mA 한계 초과!</span>
                  )}
                </span>
                <span className={`font-mono font-bold ${isIoCurrentExceeded ? 'text-rose-400' : 'text-cyan-400'}`}>
                  {ioCurrentMa} mA
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="250"
                step="5"
                value={ioCurrentMa}
                onChange={(e) => setIoCurrentMa(parseInt(e.target.value))}
                className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0 mA (부하 없음)</span>
                <span>40 mA (LED 2~3개)</span>
                <span>200 mA (AVR 절대 최대 정격 한계)</span>
              </div>
            </div>

            {/* V_drop on I/O */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">출력단 내부 트랜지스터 전압 강하 (Vdrop):</span>
                <span className="font-mono text-slate-300">{vDropIo.toFixed(2)} V</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={vDropIo}
                onChange={(e) => setVDropIo(parseFloat(e.target.value))}
                className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="text-[10px] text-slate-500">
                * 20mA 소스/싱크 시 내부 FET 온-저항(약 25Ω)에 의해 칩 내부에 발열되는 전압 드롭입니다.
              </div>
            </div>

            {/* Ambient Temperature (TA) */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">주변 대기 온도 (TA):</span>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 25, 45, 60, 85].map((t) => (
                      <button
                        key={t}
                        onClick={() => setAmbientTemp(t)}
                        className={`px-1.5 py-0.5 text-[10px] rounded font-mono border ${
                          ambientTemp === t
                            ? 'bg-rose-500 text-white font-bold border-rose-400'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {t}°C
                      </button>
                    ))}
                  </div>
                  <span className="font-mono font-bold text-rose-400">{ambientTemp} °C</span>
                </div>
              </div>
              <input
                type="range"
                min="-40"
                max="105"
                step="1"
                value={ambientTemp}
                onChange={(e) => setAmbientTemp(parseInt(e.target.value))}
                className="w-full accent-rose-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Thermal Dashboard, Gauges & Physics Breakdown (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Main Junction Temperature Card */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Thermometer className="w-4 h-4 text-rose-400" />
                예상 접합부 온도 (Junction Temp, TJ)
              </span>
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${calculations.statusColor}`}>
                {calculations.statusLabel}
              </span>
            </div>

            {/* Hero Value */}
            <div className="flex items-baseline gap-3">
              <span className="text-4xl sm:text-5xl font-mono font-extrabold text-white tracking-tight">
                {calculations.junctionTemp}
              </span>
              <span className="text-2xl font-mono text-rose-400 font-bold">°C</span>
              <span className="text-xs text-slate-400 font-mono ml-auto">
                온도 상승(ΔT): <strong className="text-amber-400">+{calculations.deltaT}°C</strong>
              </span>
            </div>

            {/* Visual Temperature Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>TA: {ambientTemp}°C</span>
                <span className="text-amber-400">권장 한계: 85°C</span>
                <span className="text-rose-400">절대 정격: 125°C</span>
              </div>
              <div className="h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative">
                {/* 85C marker line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                  style={{ left: `${Math.min(100, Math.max(0, ((85 - (-40)) / (135 - (-40))) * 100))}%` }}
                />
                {/* 125C marker line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10"
                  style={{ left: `${Math.min(100, Math.max(0, ((125 - (-40)) / (135 - (-40))) * 100))}%` }}
                />
                {/* Filled bar */}
                <div
                  className={`h-full transition-all duration-300 ${
                    calculations.junctionTemp >= 125
                      ? 'bg-rose-600'
                      : calculations.junctionTemp >= 85
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                      : calculations.junctionTemp >= 60
                      ? 'bg-gradient-to-r from-cyan-500 to-amber-500'
                      : 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(5, ((calculations.junctionTemp - (-40)) / (135 - (-40))) * 100))}%`
                  }}
                />
              </div>
            </div>

            {/* Description note */}
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              {calculations.statusDesc}
            </p>

            {/* Key Headroom Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block mb-0.5">산업용(85°C) 안전 여유:</span>
                <span
                  className={`font-bold text-sm ${
                    calculations.headroomToRec > 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {calculations.headroomToRec > 0 ? `+${calculations.headroomToRec}` : calculations.headroomToRec} °C
                </span>
              </div>
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block mb-0.5">절대최대(125°C) 마진:</span>
                <span
                  className={`font-bold text-sm ${
                    calculations.headroomToMax > 0 ? 'text-cyan-400' : 'text-rose-500 font-extrabold'
                  }`}
                >
                  {calculations.headroomToMax > 0 ? `+${calculations.headroomToMax}` : calculations.headroomToMax} °C
                </span>
              </div>
            </div>
          </div>

          {/* Power Dissipation Breakdown Card */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" /> 총 다이 소모 전력 (PD)
              </span>
              <span className="font-mono text-sm text-amber-400">
                {calculations.pTotalMilliwatts.toFixed(1)} mW
              </span>
            </div>

            {/* Stacked bar */}
            <div className="h-3 bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
              <div
                className="bg-rose-500 h-full transition-all"
                style={{
                  width: `${(calculations.pCoreMilliwatts / Math.max(1, calculations.pTotalMilliwatts)) * 100}%`
                }}
                title={`Core: ${calculations.pCoreMilliwatts.toFixed(1)} mW`}
              />
              <div
                className="bg-cyan-500 h-full transition-all"
                style={{
                  width: `${(calculations.pIoMilliwatts / Math.max(1, calculations.pTotalMilliwatts)) * 100}%`
                }}
                title={`I/O: ${calculations.pIoMilliwatts.toFixed(1)} mW`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                <span>코어 (Pcore):</span>
                <strong className="text-white ml-auto">{calculations.pCoreMilliwatts.toFixed(1)} mW</strong>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" />
                <span>I/O 드라이버 (PIO):</span>
                <strong className="text-white ml-auto">{calculations.pIoMilliwatts.toFixed(1)} mW</strong>
              </div>
            </div>

            <div className="border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>유효 열저항 (θJA_eff):</span>
                <span className="font-mono text-white">{calculations.effectiveThetaJA} °C/W</span>
              </div>
              <div className="flex justify-between">
                <span>패키지 표면 추정 온도 (TC):</span>
                <span className="font-mono text-slate-300">{calculations.caseTemp} °C</span>
              </div>
              <div className="flex justify-between">
                <span>TA={ambientTemp}°C 조건 최대 허용 전력:</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {calculations.maxAllowablePowerMw} mW
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Physics & PCB Layout Guidelines */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Gauge className="w-4 h-4 text-rose-400" />
            열 공식 (Thermal Ohm's Law)
          </div>
          <div className="font-mono text-[11px] text-amber-300 bg-slate-900 p-2 rounded border border-slate-800">
            TJ = TA + (PD × θJA)
            <br />
            PD = (VCC × ICC) + (Vdrop × IIO)
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            전기 회로의 V = I × R과 동일하게, 온도차(ΔT)는 소비 전력(PD)과 열저항(θJA)의 곱으로 결정됩니다.
          </p>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            전류 절대 정격 (Absolute Maximum)
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            • <strong>단일 I/O 핀 최대 DC 전류</strong>: 40.0 mA
            <br />
            • <strong>VCC 및 GND 핀 총합 전류</strong>: 200.0 mA (초과 시 본딩 와이어 단선 및 칩 소손)
            <br />
            • <strong>포트 그룹별 합산 전류 한계</strong>: 100~150 mA
          </p>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            PCB 방열 최적화 가이드
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            • <strong>QFN/MLF 패키지</strong>: 하단 방열 패드(Exposed Pad)에 0.3mm 직경 서멀 비아 4~9개를 배치하여 그라운드 플레인과 직접 연결하세요.
            <br />
            • <strong>동박 두께</strong>: 전원선 및 GND에 2oz(70µm) 동박을 적용하면 방열 효과가 극대화됩니다.
          </p>
        </div>
      </div>
    </div>
  );
};
