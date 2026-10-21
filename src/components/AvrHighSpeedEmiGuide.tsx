import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Activity,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  Cpu,
  Info,
  Radio,
  FileCode2,
  Sparkles,
  Zap,
  ShieldCheck,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export const AvrHighSpeedEmiGuide: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // User Inputs
  const [signalClockMhz, setSignalClockMhz] = useState<number>(16); // Clock / Baud rate in MHz
  const [traceLengthMm, setTraceLengthMm] = useState<number>(75); // PCB trace length in mm
  const [pcbLayerType, setPcbLayerType] = useState<'2_layer' | '4_layer'>('2_layer');
  const [traceWidthMm, setTraceWidthMm] = useState<number>(0.25); // 0.25 mm ~ 10 mil
  const [dielectricConst, setDielectricConst] = useState<number>(4.4); // FR-4 Er = 4.2~4.5

  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // EMI & High Speed Signal Integrity Math
  const emiMath = useMemo(() => {
    // Rise time approximation for AVR 5V/3.3V CMOS output: tr ~ 3ns to 5ns
    const riseTimeNs = 4.0; // 4ns typical
    const propagationDelayPsPerMm = 6.0; // ~6 ps/mm in FR4 (approx 150 mm/ns = 15 cm/ns)

    // Critical Length: l_crit = t_rise / (2 * t_pd)
    // Beyond this length, trace must be treated as transmission line!
    const critLengthMm = Math.round((riseTimeNs * 1000) / (2 * propagationDelayPsPerMm));

    const isTransmissionLine = traceLengthMm > critLengthMm;

    // Characteristic Impedance Z0 (Microstrip approximation):
    // Z0 ~ (87 / sqrt(Er + 1.41)) * ln(5.98 * h / (0.8 * w + t))
    // For 2-layer (h=1.6mm): Z0 ~ 110-130 ohms
    // For 4-layer (h=0.2mm to GND plane): Z0 ~ 50-65 ohms
    const z0 = pcbLayerType === '4_layer' ? 55 : 120;

    // AVR Internal Driver Output Impedance: R_drv ~ 25 to 30 ohms
    const rDriver = 28;

    // Series Source Termination Resistor: Rs = Z0 - R_drv
    const rSeriesTermination = Math.max(0, Math.round(z0 - rDriver));

    // Decoupling Capacitor Recommendations:
    // High-frequency resonance: 100nF (0402/0603) + 10nF (for >16MHz harmonics) + 10µF Bulk
    const recommendedHighFreqCap = '100nF (0402/0603 X7R)';
    const recommendedHarmonicCap = signalClockMhz >= 16 ? '10nF MLCC' : '47nF MLCC';
    const recommendedBulkCap = '10µF (0805 or 탄탈)';

    // EMI Risk Level:
    let emiRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (signalClockMhz >= 16 && traceLengthMm > 100) emiRisk = 'HIGH';
    else if (traceLengthMm > critLengthMm || signalClockMhz >= 12) emiRisk = 'MEDIUM';

    return {
      riseTimeNs,
      critLengthMm,
      isTransmissionLine,
      z0,
      rDriver,
      rSeriesTermination,
      recommendedHighFreqCap,
      recommendedHarmonicCap,
      recommendedBulkCap,
      emiRisk
    };
  }, [signalClockMhz, traceLengthMm, pcbLayerType, traceWidthMm, dielectricConst]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold mb-2">
            <Radio className="w-3.5 h-3.5" /> High-Speed Signal Integrity & PCB EMC Design
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            AVR 고속 통신 EMI 대책 & 신호 무결성 가이드
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            클럭 속도와 PCB 배선 길이를 분석하여 <span className="text-rose-400 font-medium">임피던스 불일치 반사파(Ringing)</span> 및 
            EMI 노이즈를 억제하는 <span className="text-emerald-400 font-medium"> 직렬 터미네이션 저항($R_s$) 계산</span>과 
            디커플링 커패시터 배치 지침을 제공합니다.
          </p>
        </div>

        {/* Risk Badge */}
        <div
          className={`p-3 rounded-xl border text-xs space-y-1 self-start lg:self-center ${
            emiMath.emiRisk === 'HIGH'
              ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
              : emiMath.emiRisk === 'MEDIUM'
              ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
              : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2 font-bold">
            {emiMath.emiRisk === 'HIGH' ? (
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            ) : emiMath.emiRisk === 'MEDIUM' ? (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            )}
            <span>EMI 방사 위험도: {emiMath.emiRisk}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            임계 배선 길이 ($l_c$): <strong className="text-white">{emiMath.critLengthMm} mm</strong>
          </div>
        </div>
      </div>

      {/* Input Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Col 1: Clock & Trace Length */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-rose-400" /> 통신 클럭 & 배선 길이
          </h3>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>통신 신호 주파수</span>
              <span className="text-rose-400 font-mono font-bold">{signalClockMhz} MHz</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-xs">
              {[4, 8, 16, 20].map((clk) => (
                <button
                  key={clk}
                  onClick={() => setSignalClockMhz(clk)}
                  className={`py-1 rounded border font-semibold ${
                    signalClockMhz === clk
                      ? 'bg-rose-500 text-white border-rose-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {clk}MHz
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>PCB 트레이스 배선 길이</span>
              <span className="text-white font-mono font-bold">{traceLengthMm} mm</span>
            </div>
            <input
              type="range"
              min={10}
              max={250}
              step={5}
              value={traceLengthMm}
              onChange={(e) => setTraceLengthMm(parseInt(e.target.value))}
              className="w-full accent-rose-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-500 mt-1">
              <span>10 mm (칩 인접)</span>
              <span>임계: {emiMath.critLengthMm} mm</span>
              <span>250 mm (원거리)</span>
            </div>
          </div>
        </div>

        {/* Col 2: PCB Layer & Stackup */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" /> PCB 스택업 & 특성 임피던스
          </h3>

          <div>
            <label className="text-xs text-slate-400 block mb-1">PCB 레이어 구조</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => setPcbLayerType('2_layer')}
                className={`p-2 rounded-lg border font-semibold ${
                  pcbLayerType === '2_layer'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                2-Layer 표준 (Z0 ~120Ω)
              </button>
              <button
                onClick={() => setPcbLayerType('4_layer')}
                className={`p-2 rounded-lg border font-semibold ${
                  pcbLayerType === '4_layer'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                4-Layer GND 평면 (Z0 ~55Ω)
              </button>
            </div>
          </div>

          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>특성 임피던스 (Z0):</span>
              <span className="font-mono text-emerald-400 font-bold">{emiMath.z0} Ω</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>전송선로(Transmission Line) 판정:</span>
              <span className="font-semibold text-white">
                {emiMath.isTransmissionLine ? '예 (터미네이션 필수)' : '아니오 (집중 정수 회로)'}
              </span>
            </div>
          </div>
        </div>

        {/* Col 3: Termination & Decoupling Recommendations */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" /> 계산된 부품 값 & 레이아웃 권장
          </h3>

          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs space-y-2">
            <div className="flex justify-between items-center text-slate-400">
              <span>직렬 댐핑 저항 (Rs):</span>
              <span className="text-amber-400 font-mono font-bold text-sm">
                {emiMath.rSeriesTermination > 0 ? `${emiMath.rSeriesTermination} Ω` : '불필요 (직결)'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              송신 핀(MOSI/SCK/TX) 바로 옆 1~3mm 이내에 직렬 배치하여 링잉 감쇠
            </div>

            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300 space-y-1">
              <div className="font-semibold text-white">디커플링 커패시터 권장 배치:</div>
              <div>• 고주파 노이즈: {emiMath.recommendedHighFreqCap}</div>
              <div>• 고차 고조파 노이즈: {emiMath.recommendedHarmonicCap}</div>
              <div>• 벌크 전원 충전: {emiMath.recommendedBulkCap}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
