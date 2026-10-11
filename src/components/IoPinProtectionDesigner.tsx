import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Activity,
  Cpu,
  Sliders,
  Copy,
  Check,
  Download,
  AlertTriangle,
  Info,
  Terminal,
  HelpCircle,
  FileCode,
  Layers,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
}

export const IoPinProtectionDesigner: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // User Design Parameters
  const [mcuVoltage, setMcuVoltage] = useState<3.3 | 5.0>(5.0);
  const [signalDirection, setSignalDirection] = useState<'output' | 'input'>('output');
  const [loadType, setLoadType] = useState<'resistive' | 'inductive' | 'capacitive' | 'logic_transceiver'>('inductive');
  const [targetMaxCurrentMa, setTargetMaxCurrentMa] = useState<number>(15); // mA
  const [externalVoltage, setExternalVoltage] = useState<number>(12); // e.g. 12V relay, 24V PLC, or 3.3V sensor
  const [esdEnvironment, setEsdEnvironment] = useState<'standard' | 'harsh_industrial'>('harsh_industrial');
  const [pullConfig, setPullConfig] = useState<'none' | 'pullup' | 'pulldown'>('pullup');

  const [copiedBom, setCopiedBom] = useState<boolean>(false);

  // MCU Pin Absolute Maximum Ratings
  // ATmega328P / 128 / 640: Max DC Current per I/O Pin is 40mA, Recommended safe continuous is 20mA. Total VCC/GND 200mA.
  const pinMaxSafeCurrentMa = 20;
  const pinAbsoluteMaxCurrentMa = 40;

  // Design Calculation Engine
  const calculation = useMemo(() => {
    const isOverCurrent = targetMaxCurrentMa > pinMaxSafeCurrentMa;
    const isFatalCurrent = targetMaxCurrentMa >= pinAbsoluteMaxCurrentMa;

    // 1. Series Resistor calculation (R_series)
    // For output driving: R_series = (V_mcu - V_drop) / I_target. If direct driving a LED or base of BJT
    // For input protection against overvoltage / ESD: clamping diodes in AVR take max 1mA.
    // R_in_min = (V_external_max - (V_mcu + 0.5)) / 0.001A
    let recommendedSeriesResistance = 220; // default 220 ohm
    let seriesPowerRatingWatt = 0.125; // 1/8W
    let protectionNote = '';

    if (signalDirection === 'output') {
      if (loadType === 'resistive') {
        // e.g. Driving LED (2V drop) or resistive load
        const vDrop = 2.0; // typical LED drop
        const voltageAcrossR = Math.max(0.5, mcuVoltage - vDrop);
        recommendedSeriesResistance = Math.round((voltageAcrossR / (targetMaxCurrentMa / 1000)));
        // Standard E24 rounding approx
        seriesPowerRatingWatt = Math.ceil(((targetMaxCurrentMa / 1000) ** 2 * recommendedSeriesResistance) * 1000) / 1000;
        protectionNote = `출력 핀 보호용 직렬 한류 저항: 부하 단락(Short-to-GND) 발생 시 MCU 핀 전류를 ${targetMaxCurrentMa}mA 이내로 엄격히 제한합니다.`;
      } else if (loadType === 'inductive') {
        // Driving relay/solenoid requires a transistor or MOSFET driver!
        recommendedSeriesResistance = 1000; // 1k ohm Gate/Base resistor
        protectionNote = `⚠️ 인덕티브 코일 부하(릴레이/솔레노이드/모터)는 MCU GPIO로 직접 구동 시 역기전력(BEMF)에 의해 MCU 내부 트랜지스터가 즉시 파괴됩니다. NPN BJT(2N2222) 또는 N-ch Logic MOSFET(2N7000/AO3400) 스위칭 구조가 필수이며, 1kΩ 베이스/게이트 보호 저항이 권장됩니다.`;
      } else if (loadType === 'capacitive') {
        // Inrush current limiter
        recommendedSeriesResistance = 330;
        protectionNote = `용량성 부하의 전원 충전 시 순간 돌입 전류(Inrush Current)를 흡수하여 I/O 드라이버 피크 스트레스를 방지합니다.`;
      } else {
        recommendedSeriesResistance = 100;
        protectionNote = `고속 통신 라인 링잉 억제 및 임피던스 정합용 직렬 댐핑 저항.`;
      }
    } else {
      // Input Direction Protection
      if (externalVoltage > mcuVoltage) {
        // Overvoltage input (e.g. 12V signal to 5V pin)
        // R_series = (V_ext - (V_mcu + 0.5V)) / 1mA (max AVR clamping diode current is 1mA)
        const vDiff = externalVoltage - (mcuVoltage + 0.5);
        recommendedSeriesResistance = Math.max(1000, Math.round(vDiff / 0.001)); // at least 1k~10k
        protectionNote = `외부 과전압(${externalVoltage}V)이 인가될 때 내부 클램핑 다이오드로 유입되는 전류를 1mA 이하로 안전하게 억제합니다.`;
      } else {
        recommendedSeriesResistance = 1000; // 1k ohm
        protectionNote = `ESD 스파이크 및 외부 노이즈 차단용 직렬 저항. 내부 클램핑 다이오드와 함께 1차 보호 네트워크를 구성합니다.`;
      }
    }

    // Standard E24 standard value snapping
    const standardResistors = [10, 22, 33, 47, 68, 100, 150, 220, 270, 330, 470, 680, 1000, 1500, 2200, 3300, 4700, 10000, 22000, 47000, 100000];
    const snappedResistor = standardResistors.reduce((prev, curr) => {
      return (Math.abs(curr - recommendedSeriesResistance) < Math.abs(prev - recommendedSeriesResistance) ? curr : prev);
    });

    // 2. Pull-up / Pull-down recommendation
    let recommendedPullResistor = 10000; // 10k ohm
    let pullTypeDesc = '';
    if (pullConfig === 'pullup') {
      recommendedPullResistor = esdEnvironment === 'harsh_industrial' ? 4700 : 10000; // 4.7k for noise immunity
      pullTypeDesc = `${recommendedPullResistor >= 1000 ? `${recommendedPullResistor / 1000}kΩ` : `${recommendedPullResistor}Ω`} 풀업 저항 (MCU 내부 풀업 30k~50kΩ보다 외부 풀업 저항이 노이즈 내성이 훨씬 우수합니다)`;
    } else if (pullConfig === 'pulldown') {
      recommendedPullResistor = esdEnvironment === 'harsh_industrial' ? 4700 : 10000;
      pullTypeDesc = `${recommendedPullResistor >= 1000 ? `${recommendedPullResistor / 1000}kΩ` : `${recommendedPullResistor}Ω`} 풀다운 저항 (플로팅 방지 및 기본 LOW 상태 고정)`;
    } else {
      pullTypeDesc = '풀업/풀다운 미사용 (푸시풀 구동)';
    }

    // 3. Flyback Diode (for inductive loads)
    const isFlybackNeeded = loadType === 'inductive';
    let flybackDiodePart = '1N4148 (소형 신호 / 릴레이 < 150mA)';
    let flybackSpecs = 'Vr: 100V, If: 200mA, 고속 복구(trr < 4ns)';

    if (targetMaxCurrentMa > 150 || externalVoltage > 12) {
      flybackDiodePart = '1N4007 또는 1N5819 (쇼트키 다이오드)';
      flybackSpecs = 'Vr: 40V~1000V, If: 1A, 낮은 순방향 전압강하(Vf < 0.45V)로 역기전력 신속 흡수';
    }

    // 4. Clamping / TVS Diode recommendation
    let tvsDiode = 'SMAJ5.0A (단방향 TVS, 400W ESD/서지 방어)';
    if (mcuVoltage === 3.3) {
      tvsDiode = 'SMAJ3.3A 또는 PESD3V3L1BA (ESD 방어)';
    }

    return {
      snappedResistor,
      seriesPowerRatingWatt: Math.max(0.125, seriesPowerRatingWatt),
      protectionNote,
      recommendedPullResistor,
      pullTypeDesc,
      isFlybackNeeded,
      flybackDiodePart,
      flybackSpecs,
      tvsDiode,
      isOverCurrent,
      isFatalCurrent
    };
  }, [mcuVoltage, signalDirection, loadType, targetMaxCurrentMa, externalVoltage, esdEnvironment, pullConfig]);

  // BOM Text for Copying
  const bomText = `// ==============================================================================
// AVR I/O 핀 인터페이스 보호 설계 BOM 및 회로 파라미터 (${currentProfile.name})
// ==============================================================================
- MCU 동작 전압 (V_MCU)       : ${mcuVoltage}V
- 핀 신호 방향                : ${signalDirection === 'output' ? '출력 (Output Driver)' : '입력 (Input Sensor)'}
- 부하 타입                   : ${loadType.toUpperCase()}
- 부하 전압 레벨              : ${externalVoltage}V
- 목표 최대 전류              : ${targetMaxCurrentMa} mA

[권장 보호 부품 명세서 (BOM)]
1. 직렬 보호 저항 (R_series)   : ${calculation.snappedResistor >= 1000 ? `${calculation.snappedResistor / 1000}kΩ` : `${calculation.snappedResistor}Ω`} (정격 전력: 1/8W 이상, 오차 5%)
2. 풀업/풀다운 저항           : ${pullConfig !== 'none' ? `${calculation.pullTypeDesc}` : '미사용'}
3. 플라이백 환류 다이오드      : ${calculation.isFlybackNeeded ? `${calculation.flybackDiodePart} (${calculation.flybackSpecs})` : '해당 없음 (비인덕티브)'}
4. 과전압/TVS 클램핑 다이오드  : ${calculation.tvsDiode}
5. 스위칭 트랜지스터 (인덕티브): ${calculation.isFlybackNeeded ? '2N7000 (N-ch MOSFET) 또는 2N2222 (NPN BJT)' : '직접 구동 가능'}
`;

  const copyBom = () => {
    navigator.clipboard.writeText(bomText);
    setCopiedBom(true);
    confetti({
      particleCount: 30,
      spread: 50,
      origin: { y: 0.3 }
    });
    setTimeout(() => setCopiedBom(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Title Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> I/O Pin Protection Designer
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              MCU: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-mono">
              Safe I_PIN: Max {pinMaxSafeCurrentMa}mA
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            I/O 핀 인터페이스 보호 회로 설계 도구
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            MCU 동작 전압(3.3V/5V), 핀 전류 허용치, 신호 방향 및 부하 성격(인덕티브/저항성/과전압 센서)을 고려하여
            최적의 **직렬 댐핑 저항(R_series), 외부 풀업/풀다운 저항, BEMF 플라이백 다이오드 및 TVS 다이오드** 사양을 자동 계산하고 배포용 회로도를 제안합니다.
          </p>
        </div>

        {/* Copy Action */}
        <button
          onClick={copyBom}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20 shrink-0"
        >
          {copiedBom ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
          <span>{copiedBom ? 'BOM 복사 완료' : '부품 명세서(BOM) 복사'}</span>
        </button>
      </div>

      {/* Warning Notice if Current Exceeds Limit */}
      {calculation.isOverCurrent && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${
          calculation.isFatalCurrent
            ? 'bg-rose-950/40 border-rose-500/60 text-rose-200'
            : 'bg-amber-950/40 border-amber-500/60 text-amber-200'
        }`}>
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <strong className="font-bold text-white">
              {calculation.isFatalCurrent
                ? '치명적 과전류 경고: MCU 핀 정격 한계(40mA) 초과!'
                : '주의: 권장 연속 허용 전류(20mA) 초과'}
            </strong>
            <p className="leading-relaxed">
              설정된 목표 부하 전류({targetMaxCurrentMa}mA)는 {currentProfile.name} GPIO 단일 핀의 안전 운용 한계치({pinMaxSafeCurrentMa}mA)를 초과합니다.
              GPIO 단독 구동 시 포트 내부 MOSFET 열화 및 전원 강하가 발생하므로 <strong>MOSFET/BJT 버퍼 회로</strong>를 반드시 적용해야 합니다.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Input Parameters & Calculated Protection Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Parameters (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">입력 인터페이스 파라미터</h3>
          </div>

          {/* 1. MCU Voltage */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">MCU 전원 공급 전압 (V_MCU)</label>
            <div className="grid grid-cols-2 gap-2">
              {[5.0, 3.3].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMcuVoltage(v as any)}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold font-mono transition text-center ${
                    mcuVoltage === v
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {v}V 시스템 {v === 5.0 ? '(표준 AVR)' : '(3.3V 저전력)'}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Signal Direction */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">신호 방향 (I/O Direction)</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSignalDirection('output')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition text-center ${
                  signalDirection === 'output'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                📤 출력 드라이버 (Output)
              </button>
              <button
                type="button"
                onClick={() => setSignalDirection('input')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition text-center ${
                  signalDirection === 'input'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                📥 센서/신호 입력 (Input)
              </button>
            </div>
          </div>

          {/* 3. Load Type */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">부하/신호원 성격 (Load Type)</label>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setLoadType('inductive')}
                className={`p-2 rounded-lg border font-bold text-left transition ${
                  loadType === 'inductive'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🌀 인덕티브 코일
                <span className="block text-[10px] text-slate-400 font-normal">릴레이/모터/솔레노이드</span>
              </button>
              <button
                type="button"
                onClick={() => setLoadType('resistive')}
                className={`p-2 rounded-lg border font-bold text-left transition ${
                  loadType === 'resistive'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                💡 저항성 부하
                <span className="block text-[10px] text-slate-400 font-normal">LED / 광절연기 / 히터</span>
              </button>
              <button
                type="button"
                onClick={() => setLoadType('capacitive')}
                className={`p-2 rounded-lg border font-bold text-left transition ${
                  loadType === 'capacitive'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🔋 용량성 부하
                <span className="block text-[10px] text-slate-400 font-normal">장거리 케이블 / 필터 커패시터</span>
              </button>
              <button
                type="button"
                onClick={() => setLoadType('logic_transceiver')}
                className={`p-2 rounded-lg border font-bold text-left transition ${
                  loadType === 'logic_transceiver'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                📡 고속 로직/통신
                <span className="block text-[10px] text-slate-400 font-normal">SPI / UART / I2C 버스</span>
              </button>
            </div>
          </div>

          {/* 4. Target Current & External Voltage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-400 font-medium">목표 전류 (mA):</span>
                <span className="text-emerald-400 font-bold font-mono">{targetMaxCurrentMa} mA</span>
              </div>
              <input
                type="number"
                min="1"
                max="100"
                value={targetMaxCurrentMa}
                onChange={(e) => setTargetMaxCurrentMa(Math.max(1, Number(e.target.value)))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">안전 한계: 20mA 이하 권장</span>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-400 font-medium">외부 전압 (V_EXT):</span>
                <span className="text-cyan-400 font-bold font-mono">{externalVoltage} V</span>
              </div>
              <input
                type="number"
                min="1"
                max="48"
                step="0.5"
                value={externalVoltage}
                onChange={(e) => setExternalVoltage(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">릴레이(12V/24V) 또는 센서 레벨</span>
            </div>
          </div>

          {/* 5. Pull-up / Pull-down Selection */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">풀업 / 풀다운 구성</label>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {(['pullup', 'pulldown', 'none'] as const).map((cfg) => (
                <button
                  key={cfg}
                  type="button"
                  onClick={() => setPullConfig(cfg)}
                  className={`py-1.5 px-2 rounded-lg border font-bold transition text-center ${
                    pullConfig === cfg
                      ? 'bg-violet-500/20 border-violet-400 text-violet-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cfg === 'pullup' ? '풀업(Pull-up)' : cfg === 'pulldown' ? '풀다운(Pull-down)' : '없음(None)'}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Environmental Harshness */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">설치 환경 및 ESD 노이즈 등급</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setEsdEnvironment('standard')}
                className={`py-1.5 px-2 rounded-lg border font-bold transition text-center ${
                  esdEnvironment === 'standard'
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
              >
                일반 실내 (Standard)
              </button>
              <button
                type="button"
                onClick={() => setEsdEnvironment('harsh_industrial')}
                className={`py-1.5 px-2 rounded-lg border font-bold transition text-center ${
                  esdEnvironment === 'harsh_industrial'
                    ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
              >
                🏭 산업용 현장 (Harsh Industrial)
              </button>
            </div>
          </div>
        </div>

        {/* Right Output: Circuit Schematic & Component Specifications (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Circuit Diagram Visual Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">제안된 보호 인터페이스 회로도 (Schematic Topology)</h3>
              </div>
              <span className="text-[11px] font-mono text-cyan-300 font-bold">
                {signalDirection === 'output' ? '출력 드라이버 토폴로지' : '입력 인터페이스 토폴로지'}
              </span>
            </div>

            {/* ASCII / Graphic Circuit Rendering */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto custom-scrollbar">
              {signalDirection === 'output' && loadType === 'inductive' ? (
                <pre className="text-amber-300 font-mono">
{`+-------------------------------------------------------------------------+
| [AVR GPIO Output] ---[ R_gate: ${calculation.snappedResistor}Ω ]---+                             |
|                                       |                                 |
|                                [ R_pd: 10kΩ ] (Pull-down to GND)        |
|                                       |                                 |
|                                       v Gate                            |
|                            [ Logic N-MOSFET (2N7000/AO3400) ]           |
|                                       | Source                          |
|                                      GND                                |
|                                                                         |
|                                       ^ Drain                           |
|                                       |                                 |
|                     +-----------------+-----------------+               |
|                     |                                   |               |
|            [ Inductive Load (Relay) ]         [ Flyback Diode ]         |
|                     |                          (Cathode to V_EXT)       |
|                     |                          ${calculation.flybackDiodePart}
|                     +-----------------+-----------------+               |
|                                       |                                 |
|                                  +V_EXT (${externalVoltage}V)                      |
+-------------------------------------------------------------------------+`}
                </pre>
              ) : signalDirection === 'output' ? (
                <pre className="text-emerald-300 font-mono">
{`+-------------------------------------------------------------------------+
| [AVR GPIO Out] ---[ R_series: ${calculation.snappedResistor}Ω ]---+---> [ Load: ${loadType} ] ---> GND |
|                                       |                                 |
|                                 [ TVS Clamping ] (Optional ESD)         |
|                                   ${calculation.tvsDiode}               |
|                                       |                                 |
|                                      GND                                |
+-------------------------------------------------------------------------+`}
                </pre>
              ) : (
                <pre className="text-cyan-300 font-mono">
{`+-------------------------------------------------------------------------+
| [ Ext Signal: ${externalVoltage}V ] ---[ R_series: ${calculation.snappedResistor >= 1000 ? `${calculation.snappedResistor/1000}kΩ` : `${calculation.snappedResistor}Ω`} ]---+---> [ AVR GPIO Input ]
|                                                |                        |
|                                                +---[ ${calculation.pullTypeDesc} ]
|                                                |                        |
|                                          [ Clamping Diode/TVS ]         |
|                                                |                        |
|                                               GND                       |
+-------------------------------------------------------------------------+`}
                </pre>
              )}
            </div>

            {/* Protection Design Commentary */}
            <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> 회로 설계 분석 및 엔지니어링 권고:
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                {calculation.protectionNote}
              </p>
            </div>
          </div>

          {/* Component Specifications Summary Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3.5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">산출된 권장 보호 부품 명세서 (BOM)</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              {/* 1. Series Resistor */}
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] block font-sans">1. 직렬 보호 저항 (R_series)</span>
                <div className="text-emerald-400 font-bold text-base">
                  {calculation.snappedResistor >= 1000 ? `${calculation.snappedResistor / 1000} kΩ` : `${calculation.snappedResistor} Ω`}
                </div>
                <div className="text-[11px] text-slate-500 font-sans">
                  정격 전력: 1/8W (0.125W) 이상, 허용 오차 ±5%
                </div>
              </div>

              {/* 2. Pull-up / Pull-down */}
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] block font-sans">2. 풀업/풀다운 저항</span>
                <div className="text-violet-400 font-bold text-base">
                  {pullConfig !== 'none' ? `${calculation.recommendedPullResistor / 1000} kΩ` : '미사용 (None)'}
                </div>
                <div className="text-[11px] text-slate-500 font-sans">
                  {pullConfig !== 'none' ? `${calculation.pullTypeDesc}` : '푸시풀 출력 전용'}
                </div>
              </div>

              {/* 3. Flyback Diode */}
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] block font-sans">3. 플라이백 다이오드 (역기전력 BEMF 방어)</span>
                <div className="text-amber-400 font-bold text-sm truncate">
                  {calculation.isFlybackNeeded ? calculation.flybackDiodePart : '해당 없음 (저항성)'}
                </div>
                <div className="text-[11px] text-slate-500 font-sans">
                  {calculation.isFlybackNeeded ? calculation.flybackSpecs : '인덕티브 부하 시에만 필수'}
                </div>
              </div>

              {/* 4. TVS / Clamping Diode */}
              <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] block font-sans">4. TVS 서지/ESD 억제 소자</span>
                <div className="text-cyan-400 font-bold text-sm truncate">
                  {calculation.tvsDiode}
                </div>
                <div className="text-[11px] text-slate-500 font-sans">
                  IEC 61000-4-2 (±15kV 공기방전 방어)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
