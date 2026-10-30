import React, { useState, useMemo } from 'react';
import {
  Zap,
  Activity,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  RotateCcw,
  Cpu,
  Info,
  CheckCircle2,
  TrendingDown,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Layers,
  CircleDot
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES, PinDefinition } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
  onNavigateToPin?: (pinName: string) => void;
}

type DriveMode = 'source' | 'sink'; // Source (HIGH -> Load -> GND) vs Sink (VCC -> Load -> Pin LOW)

interface LoadPreset {
  id: string;
  name: string;
  resistance: number;
  ledVf?: number; // Forward voltage if diode/LED
  desc: string;
  category: 'safe' | 'caution' | 'dangerous';
}

export const GpioVoltageDropCalculator: React.FC<Props> = ({
  selectedMCU,
  onSelectMCU,
  onNavigateToPin
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Flatten all pins of the current MCU for pin selection
  const allPins = useMemo(() => {
    const list: (PinDefinition & { portName: string })[] = [];
    Object.entries(currentProfile.ports).forEach(([pName, pInfo]) => {
      pInfo.pins.forEach((pin) => {
        list.push({ ...pin, portName: pName });
      });
    });
    return list;
  }, [currentProfile]);

  // Selected Pin
  const [selectedPinName, setSelectedPinName] = useState<string>(() => {
    return allPins.find(p => p.pin === 'PB5')?.pin || allPins[0]?.pin || 'PB0';
  });

  // Operating parameters
  const [vcc, setVcc] = useState<number>(5.0); // 5.0V or 3.3V or custom
  const [driveMode, setDriveMode] = useState<DriveMode>('source');
  const [loadResistance, setLoadResistance] = useState<number>(220); // Ohms
  const [hasLedLoad, setHasLedLoad] = useState<boolean>(true);
  const [ledVf, setLedVf] = useState<number>(2.0); // LED Forward Voltage (typically ~2.0V for Red/Green, ~3.0V for Blue/White)

  // Quick Load Presets
  const loadPresets: LoadPreset[] = [
    {
      id: 'led_220',
      name: '표준 LED + 220Ω',
      resistance: 220,
      ledVf: 2.0,
      desc: '아두이노 실습 표준 LED 회로 (~12mA 소싱)',
      category: 'safe'
    },
    {
      id: 'led_330',
      name: '고효율 LED + 330Ω',
      resistance: 330,
      ledVf: 2.0,
      desc: '저전력 안정 구동 LED 회로 (~8.5mA 소싱)',
      category: 'safe'
    },
    {
      id: 'bjt_base',
      name: 'NPN 트랜지스터 베이스 (1kΩ)',
      resistance: 1000,
      ledVf: 0.7, // Vbe
      desc: '2N2222/2N3904 베이스 스위칭 회로 (~4.1mA)',
      category: 'safe'
    },
    {
      id: 'i2c_pullup',
      name: 'I2C/SPI 버스 풀업 (4.7kΩ)',
      resistance: 4700,
      ledVf: 0,
      desc: '통신 버스 풀업 저항 싱크 구동 (~1mA)',
      category: 'safe'
    },
    {
      id: 'buzzer_direct',
      name: '피에조 부저 직결 (100Ω)',
      resistance: 100,
      ledVf: 0,
      desc: '소형 패시브 부저 직결 (~40mA 임계 경계)',
      category: 'caution'
    },
    {
      id: 'relay_direct',
      name: '5V 릴레이 코일 직결 (70Ω, 위험)',
      resistance: 70,
      ledVf: 0,
      desc: 'MCU 핀 전류 한계 초과! BJT/MOSFET 드라이버 필수',
      category: 'dangerous'
    },
    {
      id: 'short_circuit',
      name: '단락 사고 (GND 직접 접촉 1Ω)',
      resistance: 1,
      ledVf: 0,
      desc: 'VCC ➔ GND 단락! 실리콘 본딩와이어 영구 소손 위험',
      category: 'dangerous'
    }
  ];

  // Selected Pin Object
  const currentPinObj = useMemo(() => {
    return allPins.find(p => p.pin === selectedPinName) || allPins[0];
  }, [allPins, selectedPinName]);

  // AVR Internal Output MOSFET On-Resistance (R_ON):
  // At 5V: PMOS R_OH ~ 25 ohms, NMOS R_OL ~ 20 ohms
  // At 3.3V: PMOS R_OH ~ 40 ohms, NMOS R_OL ~ 32 ohms
  const rInternalOn = useMemo(() => {
    const isSource = driveMode === 'source';
    if (vcc >= 4.5) {
      return isSource ? 25 : 20; // Ohms at 5V
    } else {
      return isSource ? 40 : 32; // Ohms at 3.3V
    }
  }, [vcc, driveMode]);

  // Limits from AVR Datasheet (DC Electrical Characteristics):
  // Recommended Continuous DC Current per pin: 20 mA
  // Absolute Maximum Rating per pin: 40 mA
  const recommendedCurrentMa = 20.0;
  const absMaxCurrentMa = 40.0;

  // Circuit Current Calculation:
  // Effective driving voltage = VCC - (hasLedLoad ? ledVf : 0)
  // Total Loop Resistance = rInternalOn + loadResistance
  const effectiveDrivingVoltage = Math.max(0, vcc - (hasLedLoad ? ledVf : 0));
  const totalResistance = Math.max(0.1, rInternalOn + loadResistance);
  const currentA = effectiveDrivingVoltage / totalResistance;
  const currentMa = currentA * 1000;

  // Internal Voltage Drop on MCU Output MOSFET:
  // deltaV = I * R_ON
  const voltageDropInternal = currentA * rInternalOn;

  // Actual Terminal Pin Voltage:
  // When Sourcing: V_pin = VCC - deltaV
  // When Sinking: V_pin = 0V + deltaV
  const terminalPinVoltage = driveMode === 'source'
    ? Math.max(0, vcc - voltageDropInternal)
    : Math.min(vcc, voltageDropInternal);

  // Power Dissipated inside the Silicon Pin Transistor:
  // P = I^2 * R_ON = I * deltaV (in mW)
  const internalPowerDissipatedMw = currentA * voltageDropInternal * 1000;

  // Damage Severity Rating:
  const damageRisk = useMemo(() => {
    if (currentMa > absMaxCurrentMa) {
      return {
        level: 'CRITICAL_DAMAGE',
        title: '치명적 핀 소손 위험 (Absolute Maximum Exceeded)',
        color: 'text-rose-400',
        bg: 'bg-rose-950/40 border-rose-600',
        badge: '위험 (소손 확정)',
        desc: `전류(${currentMa.toFixed(1)}mA)가 데이터시트 절대 최대 정격(${absMaxCurrentMa}mA)을 초과했습니다. 실리콘 본딩 와이어 열화, 내부 드라이버 FET 파괴, 칩 래치업(Latch-up) 영구 고장이 발생합니다.`
      };
    } else if (currentMa > recommendedCurrentMa) {
      return {
        level: 'CAUTION_OVERSTRESS',
        title: '과부하 경고 (Recommended 20mA Exceeded)',
        color: 'text-amber-400',
        bg: 'bg-amber-950/40 border-amber-600',
        badge: '주의 (수명 단축)',
        desc: `권장 상시 전류(${recommendedCurrentMa}mA)를 초과하여 전압 강하가 심화(${voltageDropInternal.toFixed(2)}V 드롭)되고 칩 발열(${internalPowerDissipatedMw.toFixed(1)}mW)이 누적됩니다. 연속 운용 시 트랜지스터 버퍼를 권장합니다.`
      };
    } else {
      return {
        level: 'SAFE',
        title: '안전 정상 운용 (Safe Operating Area)',
        color: 'text-emerald-400',
        bg: 'bg-emerald-950/40 border-emerald-600',
        badge: '정상 안전',
        desc: `권장 정격 범위 내(${currentMa.toFixed(1)}mA / 20mA)로 동작하여 전압 강하(${voltageDropInternal.toFixed(2)}V)가 미미하고 장기 신뢰성이 우수합니다.`
      };
    }
  }, [currentMa, absMaxCurrentMa, recommendedCurrentMa, voltageDropInternal, internalPowerDissipatedMw]);

  // Apply a preset
  const handleApplyPreset = (preset: LoadPreset) => {
    setLoadResistance(preset.resistance);
    if (preset.ledVf !== undefined && preset.ledVf > 0) {
      setHasLedLoad(true);
      setLedVf(preset.ledVf);
    } else {
      setHasLedLoad(false);
    }
  };

  // SVG Characteristic Curve Generator (V_pin vs Load Current from 0 to 50mA)
  const svgCurveData = useMemo(() => {
    const points: { iMa: number; vPin: number; x: number; y: number }[] = [];
    const maxI = 50; // 0 to 50mA on X axis
    const width = 360;
    const height = 140;
    const padding = { left: 40, right: 20, top: 20, bottom: 25 };

    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    for (let i = 0; i <= maxI; i += 2) {
      const drop = (i / 1000) * rInternalOn;
      const vOut = driveMode === 'source' ? Math.max(0, vcc - drop) : Math.min(vcc, drop);
      const x = padding.left + (i / maxI) * plotW;
      const y = padding.top + plotH - (vOut / (vcc || 5)) * plotH;
      points.push({ iMa: i, vPin: vOut, x, y });
    }

    // Path string
    const pathD = points.reduce((acc, p, idx) => {
      return `${acc} ${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }, '');

    // Current Operating point (x, y)
    const clampedCurrentMa = Math.min(maxI, Math.max(0, currentMa));
    const currentX = padding.left + (clampedCurrentMa / maxI) * plotW;
    const currentY = padding.top + plotH - (Math.min(vcc, terminalPinVoltage) / (vcc || 5)) * plotH;

    // Boundary lines (20mA and 40mA X positions)
    const line20X = padding.left + (20 / maxI) * plotW;
    const line40X = padding.left + (40 / maxI) * plotW;

    return {
      width,
      height,
      padding,
      plotW,
      plotH,
      pathD,
      currentX,
      currentY,
      line20X,
      line40X
    };
  }, [vcc, rInternalOn, driveMode, currentMa, terminalPinVoltage]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl backdrop-blur relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute -top-32 -right-32 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-inner">
              <TrendingDown className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base md:text-lg font-bold text-white tracking-wide">
                  GPIO 전압 강하(Voltage Drop) &amp; 핀 손상 위험도 계산기
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/40">
                  Electrical Stress Simulator
                </span>
              </div>
              <p className="text-xs text-slate-400">
                선택된 {currentProfile.name} 핀의 내부 MOSFET On-저항($R_{'{ON}'}$)과 외부 부하 저항에 따른 실시간 전압 강하($\Delta V$) 및 40mA 절대 최대 정격 초과 손상 위험을 분석합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Selected MCU Profile Tag */}
        <div className="flex items-center gap-2 shrink-0">
          {onSelectMCU && (
            <select
              value={selectedMCU}
              onChange={(e) => onSelectMCU(e.target.value as SupportedMCU)}
              className="bg-slate-950 border border-slate-700 hover:border-amber-500 text-xs text-amber-300 font-mono rounded-xl px-2.5 py-1.5 focus:outline-none transition-colors"
            >
              {Object.keys(MCU_PROFILES).map((mcuKey) => (
                <option key={mcuKey} value={mcuKey}>
                  {MCU_PROFILES[mcuKey as SupportedMCU].name}
                </option>
              ))}
            </select>
          )}
          <span className="text-xs font-mono text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            {currentProfile.name}
          </span>
        </div>
      </div>

      {/* Main Real-time Damage Severity Card */}
      <div className={`p-5 rounded-2xl border transition-all shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${damageRisk.bg}`}>
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 shrink-0">
            {damageRisk.level === 'CRITICAL_DAMAGE' ? (
              <ShieldAlert className="w-6 h-6 text-rose-400 animate-pulse" />
            ) : damageRisk.level === 'CAUTION_OVERSTRESS' ? (
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-white">
                {damageRisk.title}
              </h4>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase border ${
                damageRisk.level === 'CRITICAL_DAMAGE'
                  ? 'bg-rose-950 text-rose-300 border-rose-500'
                  : damageRisk.level === 'CAUTION_OVERSTRESS'
                  ? 'bg-amber-950 text-amber-300 border-amber-500'
                  : 'bg-emerald-950 text-emerald-300 border-emerald-500'
              }`}>
                {damageRisk.badge}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
              {damageRisk.desc}
            </p>
          </div>
        </div>

        {/* Quick Numbers Display */}
        <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-800 text-right">
          <span className="text-xs text-slate-400 font-mono">출력 단자 전압 (V_pin)</span>
          <span className={`text-2xl font-black font-mono ${damageRisk.color}`}>
            {terminalPinVoltage.toFixed(2)} V
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            강하: {voltageDropInternal.toFixed(2)}V (전류: {currentMa.toFixed(1)}mA)
          </span>
        </div>
      </div>

      {/* 2-Column Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        {/* Left Column: Input Parameters & Presets (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-inner">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                1. 타깃 핀 및 부하 회로 조건 설정
              </h4>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              R_ON: ~{rInternalOn}Ω
            </span>
          </div>

          {/* Pin Selector & Drive Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                계산 대상 GPIO 핀:
              </label>
              <select
                value={selectedPinName}
                onChange={(e) => setSelectedPinName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-xs font-mono text-amber-300 rounded-xl px-2.5 py-2 focus:outline-none focus:border-amber-500"
              >
                {allPins.map((p) => (
                  <option key={p.pin} value={p.pin}>
                    {p.pin} ({p.arduino}) - {p.alt || p.desc.slice(0, 16)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                구동 모드 (Drive Mode):
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setDriveMode('source')}
                  className={`py-2 rounded-xl text-xs font-bold transition border ${
                    driveMode === 'source'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  소싱 (HIGH 출력)
                </button>
                <button
                  onClick={() => setDriveMode('sink')}
                  className={`py-2 rounded-xl text-xs font-bold transition border ${
                    driveMode === 'sink'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  싱킹 (LOW 입력)
                </button>
              </div>
            </div>
          </div>

          {/* VCC Selector */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-slate-300">
                공급 전압 (VCC):
              </label>
              <span className="font-mono text-amber-400 font-bold">{vcc.toFixed(1)} V</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setVcc(5.0)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition ${
                  vcc === 5.0
                    ? 'bg-amber-600 text-white border-amber-400 font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                5.0V (표준 5V 전원)
              </button>
              <button
                onClick={() => setVcc(3.3)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition ${
                  vcc === 3.3
                    ? 'bg-amber-600 text-white border-amber-400 font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                3.3V (저전압 전원)
              </button>
              <input
                type="range"
                min={1.8}
                max={5.5}
                step={0.1}
                value={vcc}
                onChange={(e) => setVcc(Number(e.target.value))}
                className="flex-1 accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Load Resistance Slider */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-slate-300">
                외부 부하 저항 (Load Resistance):
              </label>
              <span className="font-mono text-cyan-400 font-bold">
                {loadResistance >= 1000 ? `${(loadResistance / 1000).toFixed(1)} kΩ` : `${loadResistance} Ω`}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={1000}
              step={1}
              value={loadResistance}
              onChange={(e) => setLoadResistance(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1 Ω (단락 위험)</span>
              <span>220 Ω (LED 표준)</span>
              <span>1 kΩ (트랜지스터)</span>
            </div>
          </div>

          {/* LED / Diode Forward Voltage Drop Toggle */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={hasLedLoad}
                  onChange={(e) => setHasLedLoad(e.target.checked)}
                  className="accent-amber-500 rounded"
                />
                <span>LED 또는 다이오드 순방향 전압 강하 (Vf) 고려</span>
              </label>
              {hasLedLoad && (
                <span className="font-mono text-amber-400 font-bold">Vf = {ledVf.toFixed(1)}V</span>
              )}
            </div>

            {hasLedLoad && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setLedVf(1.8)}
                  className={`px-2 py-1 rounded text-[11px] font-mono border ${
                    ledVf === 1.8 ? 'bg-red-600 text-white border-red-400' : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  적색 (1.8V)
                </button>
                <button
                  onClick={() => setLedVf(2.1)}
                  className={`px-2 py-1 rounded text-[11px] font-mono border ${
                    ledVf === 2.1 ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  녹색/황색 (2.1V)
                </button>
                <button
                  onClick={() => setLedVf(3.0)}
                  className={`px-2 py-1 rounded text-[11px] font-mono border ${
                    ledVf === 3.0 ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  청색/백색 (3.0V)
                </button>
                <input
                  type="range"
                  min={0.5}
                  max={4.0}
                  step={0.1}
                  value={ledVf}
                  onChange={(e) => setLedVf(Number(e.target.value))}
                  className="flex-1 accent-amber-500 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Quick Load Preset Chips */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              일반 부하 회로 프리셋:
            </span>
            <div className="flex flex-wrap gap-1.5 text-xs font-mono">
              {loadPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] transition ${
                    loadResistance === preset.resistance
                      ? 'bg-amber-600 text-white border-amber-400 font-bold'
                      : preset.category === 'dangerous'
                      ? 'bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                  title={preset.desc}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Visual V_out vs Current Curve Chart & Metrics (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-inner flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  2. 실시간 V_out vs 부하 전류 특성 곡선
                </h4>
              </div>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/40">
                I-V Characteristic
              </span>
            </div>

            {/* SVG Plot Graph */}
            <div className="bg-slate-950 rounded-xl p-2 border border-slate-800/80">
              <svg
                viewBox={`0 0 ${svgCurveData.width} ${svgCurveData.height}`}
                className="w-full h-auto overflow-visible select-none font-mono"
              >
                {/* Background Grid Lines */}
                <line
                  x1={svgCurveData.padding.left}
                  y1={svgCurveData.padding.top}
                  x2={svgCurveData.padding.left + svgCurveData.plotW}
                  y2={svgCurveData.padding.top}
                  stroke="#334155"
                  strokeDasharray="2,2"
                />
                <line
                  x1={svgCurveData.padding.left}
                  y1={svgCurveData.padding.top + svgCurveData.plotH / 2}
                  x2={svgCurveData.padding.left + svgCurveData.plotW}
                  y2={svgCurveData.padding.top + svgCurveData.plotH / 2}
                  stroke="#334155"
                  strokeDasharray="2,2"
                />
                <line
                  x1={svgCurveData.padding.left}
                  y1={svgCurveData.padding.top + svgCurveData.plotH}
                  x2={svgCurveData.padding.left + svgCurveData.plotW}
                  y2={svgCurveData.padding.top + svgCurveData.plotH}
                  stroke="#475569"
                />

                {/* Y Axis Labels */}
                <text x={svgCurveData.padding.left - 6} y={svgCurveData.padding.top + 4} fill="#94a3b8" fontSize="9" textAnchor="end">
                  {vcc.toFixed(1)}V
                </text>
                <text x={svgCurveData.padding.left - 6} y={svgCurveData.padding.top + svgCurveData.plotH / 2 + 3} fill="#64748b" fontSize="8" textAnchor="end">
                  {(vcc / 2).toFixed(1)}V
                </text>
                <text x={svgCurveData.padding.left - 6} y={svgCurveData.padding.top + svgCurveData.plotH + 3} fill="#94a3b8" fontSize="9" textAnchor="end">
                  0V
                </text>

                {/* X Axis 20mA (Recommended) and 40mA (Absolute Max) Vertical Thresholds */}
                <line
                  x1={svgCurveData.line20X}
                  y1={svgCurveData.padding.top}
                  x2={svgCurveData.line20X}
                  y2={svgCurveData.padding.top + svgCurveData.plotH}
                  stroke="#eab308"
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                />
                <line
                  x1={svgCurveData.line40X}
                  y1={svgCurveData.padding.top}
                  x2={svgCurveData.line40X}
                  y2={svgCurveData.padding.top + svgCurveData.plotH}
                  stroke="#f43f5e"
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                />

                <text x={svgCurveData.line20X} y={svgCurveData.padding.top + svgCurveData.plotH + 14} fill="#eab308" fontSize="8" textAnchor="middle">
                  20mA
                </text>
                <text x={svgCurveData.line40X} y={svgCurveData.padding.top + svgCurveData.plotH + 14} fill="#f43f5e" fontSize="8" textAnchor="middle">
                  40mA(Max)
                </text>

                {/* Voltage Characteristic Curve Path */}
                <path
                  d={svgCurveData.pathD}
                  fill="none"
                  stroke={driveMode === 'source' ? '#38bdf8' : '#22d3ee'}
                  strokeWidth="2.5"
                />

                {/* Operating Point Indicator (Pulsing Dot) */}
                <circle
                  cx={svgCurveData.currentX}
                  cy={svgCurveData.currentY}
                  r="5"
                  fill={currentMa > absMaxCurrentMa ? '#f43f5e' : currentMa > recommendedCurrentMa ? '#f59e0b' : '#10b981'}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </svg>
            </div>

            {/* Electrical Detailed Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">회로 흐름 전류 (I_load)</span>
                <span className={`text-base font-bold ${damageRisk.color}`}>
                  {currentMa.toFixed(1)} mA
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">내부 전압 강하 (ΔV_drop)</span>
                <span className="text-base font-bold text-amber-300">
                  {voltageDropInternal.toFixed(2)} V
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">핀 소모 전력 (P_loss)</span>
                <span className="text-base font-bold text-rose-300">
                  {internalPowerDissipatedMw.toFixed(1)} mW
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">권장 한계 잔여 여유</span>
                <span className={`text-base font-bold ${recommendedCurrentMa - currentMa >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(recommendedCurrentMa - currentMa).toFixed(1)} mA
                </span>
              </div>
            </div>
          </div>

          {/* Actionable Hardware Tip */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-300 leading-relaxed space-y-1">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              하드웨어 설계 권장 사항:
            </span>
            <p className="text-slate-400">
              {currentMa > 20
                ? '릴레이, 솔레노이드, 고휘도 파워 LED 등 20mA 초과 부하는 MCU 직결을 피하고 NPN 트랜지스터(2N2222) 또는 N-채널 MOSFET(2N7000/AO3400) 스위칭 버퍼 회로를 반드시 구성하세요.'
                : '현재 부하는 20mA 이내로 안전합니다. 다만 동일 포트 내 다수 핀이 동시 구동될 경우 패키지 전체 VCC/GND 합산 한도(ATmega328P: 200mA)를 초과하지 않도록 주의하세요.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
