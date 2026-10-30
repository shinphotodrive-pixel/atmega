import React, { useState, useMemo } from 'react';
import {
  Cpu,
  Zap,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  Layers,
  Radio,
  Share2,
  Table,
  HelpCircle,
  FileText,
  ExternalLink,
  Flame,
  Power
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
  onNavigateToPin?: (pinName: string) => void;
}

export type CircuitSection = 'all' | 'power' | 'reset' | 'crystal';

interface McuHardwarePinout {
  vccPins: string;
  gndPins: string;
  avccPin: string;
  arefPin: string;
  resetPin: string;
  xtal1Pin: string;
  xtal2Pin: string;
  packageType: string;
}

const MCU_HARDWARE_PINS: Record<SupportedMCU, McuHardwarePinout> = {
  atmega328p: {
    vccPins: 'Pin 7 (DIP) / Pin 4, 6 (TQFP)',
    gndPins: 'Pin 8, 22 (DIP) / Pin 3, 5, 21 (TQFP)',
    avccPin: 'Pin 20 (DIP) / Pin 18 (TQFP)',
    arefPin: 'Pin 21 (DIP) / Pin 20 (TQFP)',
    resetPin: 'Pin 1 (DIP) / Pin 29 (TQFP)',
    xtal1Pin: 'Pin 9 (DIP) / Pin 7 (TQFP)',
    xtal2Pin: 'Pin 10 (DIP) / Pin 8 (TQFP)',
    packageType: '28-pin DIP / 32-pin TQFP'
  },
  atmega128: {
    vccPins: 'Pin 21, 52',
    gndPins: 'Pin 22, 53, 63',
    avccPin: 'Pin 64',
    arefPin: 'Pin 62',
    resetPin: 'Pin 20',
    xtal1Pin: 'Pin 24',
    xtal2Pin: 'Pin 23',
    packageType: '64-pin TQFP / MLF'
  },
  atmega2560: {
    vccPins: 'Pin 10, 31, 61, 80',
    gndPins: 'Pin 11, 32, 62, 81, 99',
    avccPin: 'Pin 100',
    arefPin: 'Pin 98',
    resetPin: 'Pin 30',
    xtal1Pin: 'Pin 34',
    xtal2Pin: 'Pin 33',
    packageType: '100-pin TQFP'
  },
  atmega640: {
    vccPins: 'Pin 10, 31, 61, 80',
    gndPins: 'Pin 11, 32, 62, 81, 99',
    avccPin: 'Pin 100',
    arefPin: 'Pin 98',
    resetPin: 'Pin 30',
    xtal1Pin: 'Pin 34',
    xtal2Pin: 'Pin 33',
    packageType: '100-pin TQFP'
  }
};

export const RecommendedHardwareSchematicViewer: React.FC<Props> = ({
  selectedMCU,
  onSelectMCU,
  onNavigateToPin
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const pinout = MCU_HARDWARE_PINS[selectedMCU];

  // Active view tab
  const [activeTab, setActiveTab] = useState<CircuitSection>('all');

  // Interactive component inspector
  const [selectedComponent, setSelectedComponent] = useState<string | null>('c_decouple');

  // Copy state
  const [copiedBom, setCopiedBom] = useState<boolean>(false);

  const bomList = useMemo(() => {
    return [
      {
        id: 'c_decouple',
        name: 'VCC 디커플링 커패시터',
        spec: '100nF (0.1µF) X7R MLCC 50V',
        qty: selectedMCU === 'atmega2560' || selectedMCU === 'atmega640' ? '4개 (VCC 핀당 1개)' : selectedMCU === 'atmega128' ? '2개' : '2개',
        location: `${pinout.vccPins} 바로 옆에 5mm 이내 최단거리 배치`,
        purpose: '스위칭 고주파 노이즈 접지 바이패스 및 VCC 리플 억제'
      },
      {
        id: 'lc_avcc',
        name: 'AVCC LC 노이즈 필터',
        spec: '10µH SMD 인덕터 + 100nF 커패시터',
        qty: '인덕터 1개, 커패시터 1개',
        location: `VCC와 ${pinout.avccPin} 사이에 직렬 연결`,
        purpose: '디지털 로직 고주파 스위칭 노이즈가 아날로그 ADC 전원으로 유입되는 것 차단'
      },
      {
        id: 'c_aref',
        name: 'AREF 노이즈 바이패스 커패시터',
        spec: '100nF (0.1µF) 세라믹',
        qty: '1개',
        location: `${pinout.arefPin}과 아날로그 GND 사이`,
        purpose: '내부 기준 전압(1.1V/2.56V) 안정화 (★주의: 절대 VCC를 직접 결선하지 말 것!)'
      },
      {
        id: 'r_reset',
        name: 'RESET 풀업 저항',
        spec: '10kΩ 1% (또는 4.7kΩ~10kΩ)',
        qty: '1개',
        location: `${pinout.resetPin}과 VCC 사이 풀업`,
        purpose: '리셋 핀의 High-Z 플로팅 방지 및 안정적인 런타임 유지'
      },
      {
        id: 'd_reset',
        name: 'RESET 역전압 보호 다이오드',
        spec: '1N4148 고속 스위칭 다이오드',
        qty: '1개',
        location: `RESET(캐소드)에서 VCC(애노드) 방향 병렬 배치`,
        purpose: 'DTR 커패시터를 통한 자동 리셋 시 발생하는 +10V 이상 고전압 스파이크 래치업 방지'
      },
      {
        id: 'c_dtr',
        name: 'DTR 자동 리셋 커패시터',
        spec: '100nF (0.1µF) 세라믹',
        qty: '1개',
        location: `USB-UART DTR 핀과 ${pinout.resetPin} 사이 직렬 결선`,
        purpose: '시리얼 업로드 시 DTR Low 전환 신호를 순간적인 음의 펄스로 변환하여 MCU 자동 리셋'
      },
      {
        id: 'sw_reset',
        name: '수동 리셋 스위치',
        spec: 'SPST 택트 스위치 (Tact Switch)',
        qty: '1개',
        location: `${pinout.resetPin}과 GND 사이`,
        purpose: '사용자 하드웨어 수동 리셋 트리거'
      },
      {
        id: 'xtal',
        name: '메인 시스템 크리스탈',
        spec: '16.000 MHz (HC-49S 또는 3225 SMD, 18pF~20pF CL)',
        qty: '1개',
        location: `${pinout.xtal1Pin}과 ${pinout.xtal2Pin} 사이 최단 배선`,
        purpose: '정밀 하드웨어 시스템 클록 생성 (UART 보드레이트 타이밍 보장)'
      },
      {
        id: 'c_load',
        name: '크리스탈 부하 커패시터 (Load Caps)',
        spec: '22pF (또는 18pF~22pF) C0G/NP0 정밀 세라믹',
        qty: '2개',
        location: 'XTAL1-GND 1개, XTAL2-GND 1개',
        purpose: '크리스탈 공진 위상 유지 및 부하 용량(CL) 매칭'
      }
    ];
  }, [selectedMCU, pinout]);

  const activeCompDetail = useMemo(() => {
    return bomList.find((b) => b.id === selectedComponent) || bomList[0];
  }, [bomList, selectedComponent]);

  const copyBom = () => {
    const text = `[${currentProfile.name} 권장 표준 하드웨어 회로도 부품 규격 (BOM)]
1. VCC 디커플링: 100nF X7R x ${selectedMCU === 'atmega2560' ? 4 : 2}개 (${pinout.vccPins})
2. AVCC LC 필터: 10µH 인덕터 + 100nF 커패시터 (${pinout.avccPin})
3. AREF 안정화: 100nF 커패시터 to GND (${pinout.arefPin}) (※ VCC 직접 연결 금지)
4. RESET 회로: 10kΩ 풀업 저항, 1N4148 다이오드, 100nF DTR 커패시터 (${pinout.resetPin})
5. 크리스탈 회로: 16.0MHz 크리스탈 + 22pF C0G 부하 커패시터 2개 (${pinout.xtal1Pin}, ${pinout.xtal2Pin})`;

    navigator.clipboard.writeText(text);
    setCopiedBom(true);
    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.8 }
    });
    setTimeout(() => setCopiedBom(false), 2000);
  };

  return (
    <div id="recommended-hardware-schematic-section" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur shadow-2xl space-y-6 scroll-mt-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" /> 권장 하드웨어 회로도 뷰어
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              Reference Hardware Schematics & Decoupling Guide
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-800/40 text-xs font-mono font-bold">
              {currentProfile.name} ({pinout.packageType})
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            권장 하드웨어 회로도 (Recommended Hardware Schematics)
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {currentProfile.name}의 안정적인 구동과 아날로그 정밀도 유지를 위한
            <strong className="text-emerald-300 font-mono"> 전원부(Vcc/AVcc/GND/AREF) 디커플링</strong>,
            <strong className="text-amber-300 font-mono"> 리셋 회로(10kΩ 풀업 + 1N4148 + DTR 오토리셋)</strong>,
            <strong className="text-cyan-300 font-mono"> 16MHz 크리스탈 발진기(22pF 로드 커패시터)</strong> 표준 결선도를 시각적으로 보여줍니다.
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
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {MCU_PROFILES[mcuId].name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Filter Tabs: All vs Power vs Reset vs Crystal */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 p-2 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
          {[
            { id: 'all', label: '전체 통합 회로도 (Full Schematics)', icon: Layers },
            { id: 'power', label: '1. 전원부 & LC 필터 (Vcc/AVcc/GND)', icon: Power },
            { id: 'reset', label: '2. 리셋 & DTR 오토리셋 회로', icon: RotateCcw },
            { id: 'crystal', label: '3. 16MHz 크리스탈 발진 회로', icon: Zap }
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as CircuitSection)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 border ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={copyBom}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition border border-slate-700 shrink-0"
        >
          {copiedBom ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedBom ? '복사됨!' : '회로 부품표(BOM) 복사'}</span>
        </button>
      </div>

      {/* Primary Visual Circuit Schematic Card */}
      <div className="bg-slate-950/90 border border-emerald-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Schematic Circuit Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono font-bold text-white text-sm">
              {currentProfile.name} 표준 하드웨어 권장 회로도 (Schematic Diagram)
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            패키지: <strong className="text-amber-300">{pinout.packageType}</strong>
          </span>
        </div>

        {/* 3 Core Circuit Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Card 1: Power Supply & LC Filter Circuit */}
          {(activeTab === 'all' || activeTab === 'power') && (
            <div
              className={`p-5 rounded-2xl border transition space-y-4 ${
                selectedComponent === 'c_decouple' || selectedComponent === 'lc_avcc' || selectedComponent === 'c_aref'
                  ? 'bg-slate-900 border-emerald-500/70 shadow-xl ring-1 ring-emerald-500/40'
                  : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <Power className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-white">1. 전원부 & LC 필터</h4>
                    <span className="text-[10px] text-slate-400 font-mono">VCC / AVCC / GND / AREF</span>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-mono">
                  필수 안정화
                </span>
              </div>

              {/* Graphical Schematic Diagram for Power */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 font-mono text-[11px] space-y-3">
                {/* Visual Wire Routing */}
                <div className="space-y-2 text-slate-300">
                  <div className="flex items-center justify-between bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-emerald-400 font-bold">+5V / +3.3V 전원 레일</span>
                    <span className="text-[10px] text-slate-400">메인 레귤레이터 출력</span>
                  </div>

                  {/* VCC Decoupling */}
                  <div
                    onClick={() => setSelectedComponent('c_decouple')}
                    className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20 transition space-y-1"
                  >
                    <div className="flex justify-between items-center text-emerald-300 font-bold">
                      <span>• VCC 핀 ─┬─ [100nF MLCC] ── GND</span>
                      <span className="text-[10px] bg-emerald-950 px-1.5 py-0.2 rounded">최단거리</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      연결 핀: <span className="text-white">{pinout.vccPins}</span> (GND: {pinout.gndPins})
                    </div>
                  </div>

                  {/* AVCC LC Filter */}
                  <div
                    onClick={() => setSelectedComponent('lc_avcc')}
                    className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20 transition space-y-1"
                  >
                    <div className="flex justify-between items-center text-emerald-300 font-bold">
                      <span>• VCC ── [10µH 인덕터] ── AVCC ─┬─ [100nF] ── GND</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      연결 핀: <span className="text-white">{pinout.avccPin}</span> (아날로그 ADC 전원)
                    </div>
                  </div>

                  {/* AREF Capacitor */}
                  <div
                    onClick={() => setSelectedComponent('c_aref')}
                    className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 cursor-pointer hover:bg-rose-500/20 transition space-y-1"
                  >
                    <div className="flex justify-between items-center text-rose-300 font-bold">
                      <span>• AREF 핀 ── [100nF] ── GND (VCC 직접 연결 금지!)</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      연결 핀: <span className="text-white">{pinout.arefPin}</span> (내부 1.1V/2.56V 바이패스)
                    </div>
                  </div>
                </div>
              </div>

              {/* Power Design Tips */}
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex items-start gap-1.5 text-[11px] text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                  <span>각 VCC/GND 핀 쌍마다 100nF 커패시터를 5mm 이내 최단거리 배치</span>
                </div>
                <div className="flex items-start gap-1.5 text-[11px] text-rose-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                  <span>AREF 핀에 VCC를 직접 결선하면 내부 기준전압 선택 시 칩 소손</span>
                </div>
              </div>
            </div>
          )}

          {/* Card 2: RESET & DTR Auto-Reset Circuit */}
          {(activeTab === 'all' || activeTab === 'reset') && (
            <div
              className={`p-5 rounded-2xl border transition space-y-4 ${
                selectedComponent === 'r_reset' || selectedComponent === 'd_reset' || selectedComponent === 'c_dtr'
                  ? 'bg-slate-900 border-amber-500/70 shadow-xl ring-1 ring-amber-500/40'
                  : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <RotateCcw className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-white">2. 리셋 & DTR 오토리셋</h4>
                    <span className="text-[10px] text-slate-400 font-mono">10kΩ Pull-up + 1N4148 Diode</span>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/40 font-mono">
                  {pinout.resetPin}
                </span>
              </div>

              {/* Graphical Schematic Diagram for Reset */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 font-mono text-[11px] space-y-3">
                <div className="space-y-2 text-slate-300">
                  <div className="flex items-center justify-between bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-amber-400 font-bold">+5V (VCC) 전원 레일</span>
                    <span className="text-[10px] text-slate-400">풀업 전원</span>
                  </div>

                  {/* 10k Pull-up & Diode */}
                  <div
                    onClick={() => setSelectedComponent('r_reset')}
                    className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 cursor-pointer hover:bg-amber-500/20 transition space-y-1"
                  >
                    <div className="flex justify-between items-center text-amber-300 font-bold">
                      <span>• VCC ──┬── [10kΩ 저항] ──┬── RESET ({pinout.resetPin})</span>
                    </div>
                    <div className="text-[10px] text-amber-200">
                      <span>      └── [1N4148 다이오드] ┘ (ESD/스파이크 억제)</span>
                    </div>
                  </div>

                  {/* DTR Auto Reset Cap */}
                  <div
                    onClick={() => setSelectedComponent('c_dtr')}
                    className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 cursor-pointer hover:bg-amber-500/20 transition space-y-1"
                  >
                    <div className="flex justify-between items-center text-amber-300 font-bold">
                      <span>• USB DTR ── [100nF 커패시터] ── RESET</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      아두이노 부트로더 자동 스케치 업로드 필수 회로
                    </div>
                  </div>

                  {/* Manual Tact Switch */}
                  <div
                    onClick={() => setSelectedComponent('sw_reset')}
                    className="p-2 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer hover:bg-slate-800 transition space-y-1"
                  >
                    <div className="flex justify-between items-center text-slate-300 font-bold">
                      <span>• RESET 핀 ── [수동 택트 스위치] ── GND</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      버튼 클릭 시 RESET을 GND로 당겨 하드웨어 리셋 발생
                    </div>
                  </div>
                </div>
              </div>

              {/* Reset Design Tips */}
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex items-start gap-1.5 text-[11px] text-amber-300">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                  <span>1N4148 다이오드가 없으면 DTR 토글 시 +10V 스파이크로 칩 래치업 위험</span>
                </div>
                <div className="flex items-start gap-1.5 text-[11px] text-slate-400">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                  <span>10kΩ 풀업은 노이즈 리셋을 방지하는 최적의 밸런스 값</span>
                </div>
              </div>
            </div>
          )}

          {/* Card 3: Crystal Oscillator Circuit */}
          {(activeTab === 'all' || activeTab === 'crystal') && (
            <div
              className={`p-5 rounded-2xl border transition space-y-4 ${
                selectedComponent === 'xtal' || selectedComponent === 'c_load'
                  ? 'bg-slate-900 border-cyan-500/70 shadow-xl ring-1 ring-cyan-500/40'
                  : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    <Zap className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-white">3. 크리스탈 발진기 회로</h4>
                    <span className="text-[10px] text-slate-400 font-mono">16.0MHz + 22pF Load Caps</span>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 font-mono">
                  XTAL1 / XTAL2
                </span>
              </div>

              {/* Graphical Schematic Diagram for Crystal */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 font-mono text-[11px] space-y-3">
                <div className="space-y-2 text-slate-300">
                  <div className="flex items-center justify-between bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-cyan-400 font-bold">16.000 MHz 수정 발진자</span>
                    <span className="text-[10px] text-slate-400">시스템 클럭 소스</span>
                  </div>

                  {/* Crystal Symbol */}
                  <div
                    onClick={() => setSelectedComponent('xtal')}
                    className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 cursor-pointer hover:bg-cyan-500/20 transition space-y-1"
                  >
                    <div className="flex justify-between items-center text-cyan-300 font-bold">
                      <span>• XTAL1 ({pinout.xtal1Pin}) ── [ 16.0MHz Y1 ] ── XTAL2 ({pinout.xtal2Pin})</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      인버터 발진기 입력 및 출력 핀 사이에 병렬 결선
                    </div>
                  </div>

                  {/* Load Capacitors */}
                  <div
                    onClick={() => setSelectedComponent('c_load')}
                    className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 cursor-pointer hover:bg-cyan-500/20 transition space-y-1.5"
                  >
                    <div className="flex justify-between items-center text-cyan-300 font-bold">
                      <span>• XTAL1 ── [22pF C1] ── GND</span>
                    </div>
                    <div className="flex justify-between items-center text-cyan-300 font-bold">
                      <span>• XTAL2 ── [22pF C2] ── GND</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      부하 용량 공식: CL = (C1 * C2)/(C1 + C2) + C_stray ≈ 18pF~22pF
                    </div>
                  </div>

                  {/* Ground Guard Ring */}
                  <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[10px] text-slate-400">
                    PCB 아트웍: 크리스탈 하부에 GND 플레인을 깔고 가드 링(Guard Ring)으로 둘러싸기
                  </div>
                </div>
              </div>

              {/* Crystal Design Tips */}
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex items-start gap-1.5 text-[11px] text-cyan-300">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-cyan-400" />
                  <span>크리스탈 배선 길이는 10mm 이내로 최소화하여 기생 커패시턴스 억제</span>
                </div>
                <div className="flex items-start gap-1.5 text-[11px] text-slate-400">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                  <span>크리스탈 아래로는 고속 신호선(PWM, SPI)을 절대 통과시키지 말 것</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Selected Component Detailed Inspector Card */}
        {activeCompDetail && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-amber-500/20 text-amber-300 font-mono text-xs font-bold">
                  선택 부품 심층 가이드
                </span>
                <span className="text-white font-bold text-sm">{activeCompDetail.name}</span>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                권장 규격: {activeCompDetail.spec}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400 block text-[10px]">권장 수량</span>
                <span className="text-white font-bold block mt-0.5">{activeCompDetail.qty}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400 block text-[10px]">권장 배치 위치</span>
                <span className="text-cyan-300 font-bold block mt-0.5">{activeCompDetail.location}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400 block text-[10px]">설계 목적 및 효과</span>
                <span className="text-amber-300 font-bold block mt-0.5">{activeCompDetail.purpose}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Complete Hardware BOM Table */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Table className="w-4 h-4 text-emerald-400" />
            {currentProfile.name} 표준 하드웨어 권장 부품 목록표 (Bill of Materials - BOM)
          </span>
          <span className="text-[11px] font-mono text-slate-400">총 9개 핵심 부품 규격</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="py-2.5 px-3">부품명</th>
                <th className="py-2.5 px-3">권장 규격 / 값</th>
                <th className="py-2.5 px-3">필요 수량</th>
                <th className="py-2.5 px-3">연결 핀 및 배치 가이드</th>
                <th className="py-2.5 px-3">주요 기능 및 누락 시 위험성</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {bomList.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedComponent(item.id)}
                  className={`hover:bg-slate-900/60 cursor-pointer transition ${
                    selectedComponent === item.id ? 'bg-emerald-500/10 font-semibold' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 text-white font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {item.name}
                  </td>
                  <td className="py-2.5 px-3 text-cyan-300 font-bold">{item.spec}</td>
                  <td className="py-2.5 px-3 text-amber-300">{item.qty}</td>
                  <td className="py-2.5 px-3 text-slate-400">{item.location}</td>
                  <td className="py-2.5 px-3 text-slate-300">{item.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Common Hardware Pitfalls & Checklist (자주 하는 치명적 하드웨어 설계 실수 4선) */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          AVR 하드웨어 설계 시 자주 범하는 치명적 오류 체크리스트 (Hardware Design Pitfalls)
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-rose-500/30 space-y-1">
            <span className="font-bold text-rose-300 block">1. AREF 핀에 VCC를 직결하는 실수</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              펌웨어에서 내부 1.1V 또는 2.56V 밴드갭 기준전압을 활성화하는 순간, VCC(5V)와 내부 기준전압이 내부 스위치로 쇼트되어 칩 내부 레퍼런스 버퍼가 타버립니다. AREF 핀은 100nF 커패시터만 접지로 연결해야 합니다.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-rose-500/30 space-y-1">
            <span className="font-bold text-rose-300 block">2. AVCC 핀을 전원에 연결하지 않고 방치하는 실수</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              ADC를 사용하지 않더라도 AVCC는 Port C(328P) 또는 Port F(128/2560) 디지털 I/O의 전원으로도 공유됩니다. AVCC가 비어 있으면 해당 포트의 디지털 핀들이 오작동하거나 칩이 알 수 없는 리셋에 빠집니다.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-1">
            <span className="font-bold text-amber-300 block">3. DTR 오토리셋 회로에 1N4148 다이오드를 누락하는 경우</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              DTR 신호가 Low에서 High로 복귀할 때 100nF 커패시터의 전하 펌핑 효과로 RESET 핀에 +10V 이상의 과전압 스파이크가 발생합니다. 1N4148 클램핑 다이오드가 없으면 고전압으로 인한 MCU 래치업 또는 ESD 파손이 일어납니다.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-1">
            <span className="font-bold text-amber-300 block">4. 크리스탈 부하 커패시터(Load Caps) 미장착 또는 과대 용량</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              22pF 커패시터가 누락되면 크리스탈이 전혀 발진하지 못해 칩이 멈추거나 기동 시간이 매우 불안정해집니다. 또한 일반 전해 커패시터 대신 온도 계수가 우수한 C0G/NP0 등급의 세라믹 커패시터를 사용해야 합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
