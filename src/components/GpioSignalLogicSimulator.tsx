import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SupportedMCU, MCU_PROFILES, PinDefinition } from '../data/pinmapData';
import {
  Activity,
  Zap,
  Sliders,
  Cpu,
  Layers,
  RotateCcw,
  Play,
  Pause,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  Radio,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
  onNavigateToPin?: (pinName: string) => void;
}

export const GpioSignalLogicSimulator: React.FC<Props> = ({ selectedMCU, onSelectMCU, onNavigateToPin }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const portKeys = useMemo(() => Object.keys(currentProfile.ports), [currentProfile]);

  // Selected Port and Pin State
  const [selectedPort, setSelectedPort] = useState<string>(() => {
    return portKeys.includes('PORTB') ? 'PORTB' : portKeys[0];
  });

  // Re-sync selectedPort when MCU changes
  useEffect(() => {
    if (!currentProfile.ports[selectedPort]) {
      setSelectedPort(Object.keys(currentProfile.ports)[0]);
    }
  }, [selectedMCU, currentProfile, selectedPort]);

  const currentPortInfo = currentProfile.ports[selectedPort] || Object.values(currentProfile.ports)[0];
  const currentPortPins = currentPortInfo.pins;

  const [selectedPinName, setSelectedPinName] = useState<string>(() => {
    return currentPortPins[0]?.pin || 'PB0';
  });

  // Re-sync pin when port changes
  useEffect(() => {
    if (!currentPortPins.some((p) => p.pin === selectedPinName)) {
      setSelectedPinName(currentPortPins[0]?.pin || 'PB0');
    }
  }, [selectedPort, currentPortPins, selectedPinName]);

  const activePinObj = currentPortPins.find((p) => p.pin === selectedPinName) || currentPortPins[0];

  // Hardware State
  const [vccLevel, setVccLevel] = useState<5.0 | 3.3>(5.0);
  const [ddrBit, setDdrBit] = useState<0 | 1>(0); // 0 = Input, 1 = Output
  const [portBit, setPortBit] = useState<0 | 1>(1); // In input: 0=High-Z, 1=Pull-up; In output: 0=Low, 1=High
  const [externalInput, setExternalInput] = useState<'open' | 'gnd' | 'vcc'>('open'); // Switch / External Circuit

  // Auto Toggle Generator
  const [isAutoToggling, setIsAutoToggling] = useState<boolean>(false);
  const [toggleFreqHz, setToggleFreqHz] = useState<number>(2); // 1Hz, 2Hz, 5Hz
  const [waveformHistory, setWaveformHistory] = useState<number[]>([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Derive Pin Logic & Voltage Level
  const simulationResult = useMemo(() => {
    let voltage = 0.0;
    let pinBit: 0 | 1 = 0;
    let stateLabel = '';
    let impedanceLabel = '';
    let isFloating = false;
    let powerLossWarning = false;

    if (ddrBit === 1) {
      // Output Mode
      if (portBit === 1) {
        voltage = vccLevel;
        pinBit = 1;
        stateLabel = `OUTPUT HIGH (${vccLevel.toFixed(1)}V Push-Pull)`;
        impedanceLabel = 'Low-Z (출력 구동 ~20mA 소싱)';
      } else {
        voltage = 0.0;
        pinBit = 0;
        stateLabel = 'OUTPUT LOW (0.0V Push-Pull)';
        impedanceLabel = 'Low-Z (출력 싱킹 ~20mA 싱크)';
      }

      // Check external short-circuit conflict
      if (portBit === 1 && externalInput === 'gnd') {
        powerLossWarning = true;
      }
    } else {
      // Input Mode
      const hasPullUp = portBit === 1;

      if (externalInput === 'gnd') {
        voltage = 0.0;
        pinBit = 0;
        stateLabel = hasPullUp ? 'INPUT LOW (스위치 GND 연결, 풀업 전류 ~140µA)' : 'INPUT LOW (0.0V GND)';
        impedanceLabel = hasPullUp ? 'Pull-up 활성 (GND 도통)' : 'High-Z (GND 직결)';
      } else if (externalInput === 'vcc') {
        voltage = vccLevel;
        pinBit = 1;
        stateLabel = `INPUT HIGH (외부 ${vccLevel.toFixed(1)}V 인가)`;
        impedanceLabel = 'High-Z (외부 소스 구동)';
      } else {
        // Open / Floating
        if (hasPullUp) {
          voltage = vccLevel;
          pinBit = 1;
          stateLabel = `INPUT HIGH (내부 풀업 ~35kΩ 유지, ${vccLevel.toFixed(1)}V)`;
          impedanceLabel = 'Pull-up 활성화 (~35kΩ VCC)';
        } else {
          // Tri-state Floating (불안정 전압)
          voltage = vccLevel * 0.42; // 약 2.1V 부유 전압 시뮬레이션
          isFloating = true;
          // Schmitt trigger hysteresis
          pinBit = voltage >= vccLevel * 0.6 ? 1 : 0;
          stateLabel = 'FLOATING / TRI-STATE (고임피던스 부유 상태, 노이즈 취약)';
          impedanceLabel = 'High-Z (>100MΩ 플로팅)';
          powerLossWarning = true;
        }
      }
    }

    // Schmitt Trigger Thresholds
    const vih = vccLevel * 0.6; // High threshold
    const vil = vccLevel * 0.3; // Low threshold

    return {
      voltage,
      pinBit,
      stateLabel,
      impedanceLabel,
      isFloating,
      powerLossWarning,
      vih,
      vil
    };
  }, [ddrBit, portBit, externalInput, vccLevel]);

  // Waveform History Update
  useEffect(() => {
    setWaveformHistory((prev) => [...prev.slice(1), simulationResult.pinBit]);
  }, [simulationResult.pinBit]);

  // Auto Toggle Loop
  useEffect(() => {
    if (!isAutoToggling) return;

    const intervalMs = Math.round(1000 / (toggleFreqHz * 2));
    const timer = setInterval(() => {
      if (ddrBit === 1) {
        setPortBit((prev) => (prev === 1 ? 0 : 1));
      } else {
        setExternalInput((prev) => (prev === 'gnd' ? 'open' : 'gnd'));
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isAutoToggling, toggleFreqHz, ddrBit]);

  // Manual Toggle
  const handleManualToggle = () => {
    if (ddrBit === 1) {
      setPortBit((prev) => (prev === 1 ? 0 : 1));
    } else {
      setExternalInput((prev) => (prev === 'gnd' ? 'open' : 'gnd'));
    }
  };

  // Momentary Switch Press
  const handlePressSwitch = () => {
    setExternalInput('gnd');
  };

  const handleReleaseSwitch = () => {
    setExternalInput('open');
  };

  // Reset to Safe Default
  const handleResetDefaults = () => {
    setIsAutoToggling(false);
    setDdrBit(0);
    setPortBit(1);
    setExternalInput('open');
    setVccLevel(5.0);
  };

  // Generate C Code Snippet for selected pin
  const portLetter = selectedPort.replace('PORT', '');
  const bitNum = activePinObj.pin.replace(/[^0-9]/g, '') || '0';
  const pinConstant = `P${portLetter}${bitNum}`;

  const generatedCCode = useMemo(() => {
    if (ddrBit === 1) {
      return `// ${currentProfile.name} ${activePinObj.pin} 출력 모드 설정 및 제어
DDR${portLetter} |= (1 << ${pinConstant}); // 출력(OUTPUT) 설정

// 핀 ${portBit === 1 ? 'HIGH (VCC)' : 'LOW (GND)'} 출력
${portBit === 1 ? `PORT${portLetter} |= (1 << ${pinConstant});` : `PORT${portLetter} &= ~(1 << ${pinConstant});`}

// 핀 상태 1사이클 고속 반전 (PINx 레지스터 1 쓰기 기법)
PIN${portLetter} = (1 << ${pinConstant});`;
    } else {
      if (portBit === 1) {
        return `// ${currentProfile.name} ${activePinObj.pin} 내부 풀업 입력 모드
DDR${portLetter} &= ~(1 << ${pinConstant}); // 입력(INPUT) 설정
PORT${portLetter} |= (1 << ${pinConstant});  // 내부 풀업 저항 활성화 (~35kΩ)

// 디지털 핀 입력 값 읽기 (0 또는 1)
uint8_t pin_state = (PIN${portLetter} & (1 << ${pinConstant})) ? 1 : 0;
if (pin_state == 0) {
    // 버튼 눌림 (Active-Low 감지)
}`;
      } else {
        return `// ${currentProfile.name} ${activePinObj.pin} 고임피던스(Tri-state) 입력 모드
DDR${portLetter} &= ~(1 << ${pinConstant}); // 입력(INPUT) 설정
PORT${portLetter} &= ~(1 << ${pinConstant}); // 풀업 비활성화 (외부 풀업/풀다운 저항 필수)

// 주의: 미연결 시 플로팅(Floating) 노이즈 발생
uint8_t pin_state = (PIN${portLetter} & (1 << ${pinConstant})) ? 1 : 0;`;
      }
    }
  }, [currentProfile.name, activePinObj.pin, portLetter, pinConstant, ddrBit, portBit]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.8 }
    });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur shadow-2xl space-y-6 animate-fade-in">
      {/* Title & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" /> GPIO 신호 로직 시뮬레이터
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono font-bold">
              {currentProfile.name} • {activePinObj.pin}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-mono font-bold">
              VCC: {vccLevel.toFixed(1)}V
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            GPIO 핀 신호 로직 & 풀업 전압 시뮬레이터
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            DDR(입력/출력 방향) 및 PORT(출력값/풀업 인에이블) 레지스터 설정에 따른 핀의 물리 전압(V)과 
            내부 풀업 저항(~35kΩ) 동작, 슈미트 트리거 입력 감지 및 핀 토글을 실시간으로 시뮬레이션합니다.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleResetDefaults}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition border border-slate-700 flex items-center gap-1.5"
            title="초기 안전 상태(입력 풀업)로 리셋"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>기본값 복원</span>
          </button>
        </div>
      </div>

      {/* Grid: Pin & Hardware Configuration Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1: Pin Selector & Power VCC */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-white">
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cyan-400" /> 1. 대상 핀 선택
            </span>
            <span className="text-[11px] text-slate-500 font-mono">Pin Selection</span>
          </div>

          {/* Port Selector Buttons */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1 font-medium">포트 그룹 선택:</label>
            <div className="flex flex-wrap gap-1">
              {portKeys.map((pKey) => (
                <button
                  key={pKey}
                  onClick={() => setSelectedPort(pKey)}
                  className={`px-2 py-1 text-xs font-mono font-bold rounded-lg transition ${
                    selectedPort === pKey
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {pKey}
                </button>
              ))}
            </div>
          </div>

          {/* Pin Selector inside current Port */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1 font-medium">포트 핀 선택:</label>
            <select
              value={selectedPinName}
              onChange={(e) => setSelectedPinName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
            >
              {currentPortPins.map((pin) => (
                <option key={pin.pin} value={pin.pin}>
                  {pin.pin} (Pin {pin.physicalPin || '-'}) - {pin.alt || pin.name}
                </option>
              ))}
            </select>
          </div>

          {/* Active Pin Info Badge */}
          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800/80 text-xs font-mono space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">물리적 패키지 핀:</span>
              <span className="text-cyan-300 font-bold">
                {activePinObj.physicalPin ? `Pin ${activePinObj.physicalPin}` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">대체 기능(Alt):</span>
              <span className="text-amber-400 font-bold truncate max-w-[140px]">{activePinObj.alt || 'General GPIO'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">아두이노 핀:</span>
              <span className="text-emerald-400 font-bold">{activePinObj.arduino || '-'}</span>
            </div>
          </div>

          {/* Target VCC Toggle */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1 font-medium">공급 전원 전압 (VCC):</label>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                onClick={() => setVccLevel(5.0)}
                className={`py-1.5 rounded-xl border font-bold transition ${
                  vccLevel === 5.0
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                5.0V (표준 VCC)
              </button>
              <button
                onClick={() => setVccLevel(3.3)}
                className={`py-1.5 rounded-xl border font-bold transition ${
                  vccLevel === 3.3
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                3.3V (저전력 VCC)
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Register Controls (DDR & PORT) */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-white">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-amber-400" /> 2. AVR I/O 레지스터 제어
            </span>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/40">
              DDR{portLetter} • PORT{portLetter}
            </span>
          </div>

          {/* 1. DDRxn Control */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-mono text-slate-300 font-bold">DDR{portLetter}.{bitNum} (방향 레지스터):</span>
              <span className="font-mono font-bold text-amber-400">
                {ddrBit === 0 ? '0 (INPUT 입력 모드)' : '1 (OUTPUT 출력 모드)'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                onClick={() => setDdrBit(0)}
                className={`py-2 px-3 rounded-xl border font-bold transition text-left flex flex-col ${
                  ddrBit === 0
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>INPUT (입력)</span>
                <span className="text-[10px] opacity-80">DDR=0 (수신 대기)</span>
              </button>
              <button
                onClick={() => setDdrBit(1)}
                className={`py-2 px-3 rounded-xl border font-bold transition text-left flex flex-col ${
                  ddrBit === 1
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>OUTPUT (출력)</span>
                <span className="text-[10px] opacity-80">DDR=1 (구동 전압)</span>
              </button>
            </div>
          </div>

          {/* 2. PORTxn Control */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-mono text-slate-300 font-bold">PORT{portLetter}.{bitNum} (데이터/풀업 레지스터):</span>
              <span className="font-mono font-bold text-cyan-400">
                {ddrBit === 0
                  ? portBit === 1
                    ? '1 (내부 풀업 ON)'
                    : '0 (High-Z 플로팅)'
                  : portBit === 1
                  ? `1 (HIGH ${vccLevel.toFixed(1)}V)`
                  : '0 (LOW 0V)'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                onClick={() => setPortBit(0)}
                className={`py-2 px-3 rounded-xl border font-bold transition text-left flex flex-col ${
                  portBit === 0
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>{ddrBit === 0 ? 'High-Z (풀업 OFF)' : 'LOW (0V)'}</span>
                <span className="text-[10px] opacity-80">PORT=0 설정</span>
              </button>

              <button
                onClick={() => setPortBit(1)}
                className={`py-2 px-3 rounded-xl border font-bold transition text-left flex flex-col ${
                  portBit === 1
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>{ddrBit === 0 ? '내부 풀업 (ON)' : `HIGH (${vccLevel.toFixed(1)}V)`}</span>
                <span className="text-[10px] opacity-80">PORT=1 설정</span>
              </button>
            </div>
          </div>

          {/* 3. External Input Circuit (Only in Input Mode) */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium">외부 회로 연결 (스위치/센서):</span>
              <span className="font-mono text-[11px] text-amber-400">
                {externalInput === 'open' && '스위치 열림 (미연결)'}
                {externalInput === 'gnd' && '스위치 누름 (GND 접지)'}
                {externalInput === 'vcc' && `외부 High (${vccLevel.toFixed(1)}V 인가)`}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
              <button
                onClick={() => setExternalInput('open')}
                className={`py-1.5 px-2 rounded-lg border text-center transition ${
                  externalInput === 'open'
                    ? 'bg-slate-800 border-emerald-400 text-emerald-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                열림 (Open)
              </button>
              <button
                onClick={() => setExternalInput('gnd')}
                className={`py-1.5 px-2 rounded-lg border text-center transition ${
                  externalInput === 'gnd'
                    ? 'bg-slate-800 border-rose-400 text-rose-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                GND 접지
              </button>
              <button
                onClick={() => setExternalInput('vcc')}
                className={`py-1.5 px-2 rounded-lg border text-center transition ${
                  externalInput === 'vcc'
                    ? 'bg-slate-800 border-cyan-400 text-cyan-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                VCC 인가
              </button>
            </div>
          </div>
        </div>

        {/* Card 3: Realtime Voltage Gauge & PINxn Status */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-white">
              <span className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400" /> 3. 실시간 전압 & PIN 읽기 결과
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40">
                PIN{portLetter}.{bitNum} = {simulationResult.pinBit}
              </span>
            </div>

            {/* Voltage Level Display */}
            <div className="mt-3 p-4 bg-slate-900/90 rounded-2xl border border-slate-800 text-center space-y-1">
              <span className="text-[11px] text-slate-400 font-mono block">핀 패드 물리 전압 (V_PIN)</span>
              <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white flex items-center justify-center gap-2">
                <span className={simulationResult.pinBit === 1 ? 'text-emerald-400' : 'text-slate-400'}>
                  {simulationResult.voltage.toFixed(2)}
                </span>
                <span className="text-base text-slate-500 font-normal">V</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold mt-1 bg-slate-950 border border-slate-800">
                <span
                  className={`w-2 h-2 rounded-full ${
                    simulationResult.pinBit === 1 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                  }`}
                />
                <span className={simulationResult.pinBit === 1 ? 'text-emerald-300' : 'text-slate-400'}>
                  디지털 로직: {simulationResult.pinBit === 1 ? 'HIGH (1)' : 'LOW (0)'}
                </span>
              </div>
            </div>

            {/* Schmitt Trigger Threshold Indicators */}
            <div className="mt-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] font-mono space-y-1.5 text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">상태 모드:</span>
                <span className="font-bold text-white truncate max-w-[170px]">{simulationResult.stateLabel}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">임피던스 상태:</span>
                <span className="text-cyan-400 font-bold">{simulationResult.impedanceLabel}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                <span>V_IH (High 임계치): ≥{simulationResult.vih.toFixed(2)}V</span>
                <span>V_IL (Low 임계치): ≤{simulationResult.vil.toFixed(2)}V</span>
              </div>
            </div>

            {/* Warning Callout if Floating or Conflict */}
            {simulationResult.powerLossWarning && (
              <div className="mt-2 p-2.5 bg-amber-950/40 border border-amber-600/50 rounded-xl text-[11px] text-amber-300 leading-relaxed flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  {simulationResult.isFloating
                    ? '⚠️ 플로팅(Floating) 경고: 입력 풀업이 없어 전압이 부유하며, 슈미트 트리거 누설 전류가 발생합니다.'
                    : '⚠️ 출력 단락 경고: 출력 HIGH 상태에서 외부 GND에 직결되어 과전류가 유입될 수 있습니다.'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section: Interactive Circuit Diagram & Realtime Toggle Control */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              AVR I/O 핀 내부 등가 회로 & 실시간 핀 토글 컨트롤러
            </h4>
          </div>

          {/* Interactive Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleManualToggle}
              className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-md shadow-cyan-600/20 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>수동 1회 토글 (Toggle)</span>
            </button>

            {ddrBit === 0 && (
              <button
                onMouseDown={handlePressSwitch}
                onMouseUp={handleReleaseSwitch}
                onTouchStart={handlePressSwitch}
                onTouchEnd={handleReleaseSwitch}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-600/20 flex items-center gap-1 select-none active:scale-95"
              >
                <span>스위치 누르기 (누르는 동안 GND)</span>
              </button>
            )}

            <button
              onClick={() => setIsAutoToggling(!isAutoToggling)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                isAutoToggling
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {isAutoToggling ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{isAutoToggling ? `자동 토글 정지 (${toggleFreqHz}Hz)` : `자동 토글 시작 (${toggleFreqHz}Hz)`}</span>
            </button>

            {/* Frequency Selector */}
            <select
              value={toggleFreqHz}
              onChange={(e) => setToggleFreqHz(Number(e.target.value))}
              disabled={isAutoToggling}
              className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white font-mono focus:outline-none"
            >
              <option value={1}>1 Hz</option>
              <option value={2}>2 Hz</option>
              <option value={5}>5 Hz</option>
              <option value={10}>10 Hz</option>
            </select>
          </div>
        </div>

        {/* Simplified Equivalent Circuit Block Diagram */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-900/60 rounded-xl border border-slate-800/80 font-mono text-xs">
          {/* Block 1: Pull-up P-FET & VCC */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
            <div className="flex justify-between items-center text-slate-400">
              <span>내부 풀업 회로 (Pull-Up)</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  ddrBit === 0 && portBit === 1
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                    : 'bg-slate-900 text-slate-500'
                }`}
              >
                {ddrBit === 0 && portBit === 1 ? '도통 (ON)' : '차단 (OFF)'}
              </span>
            </div>
            <div className="text-[11px] text-slate-300">
              • VCC: <strong>{vccLevel.toFixed(1)}V</strong>
              <br />
              • 풀업 저항 R_PU: <strong>약 35 kΩ (20~50kΩ)</strong>
              <br />
              • 조건: DDR=0 AND PORT=1 AND PUD=0
            </div>
          </div>

          {/* Block 2: Push-Pull Output Driver */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
            <div className="flex justify-between items-center text-slate-400">
              <span>출력 드라이버 (Push-Pull)</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  ddrBit === 1
                    ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/50'
                    : 'bg-slate-900 text-slate-500'
                }`}
              >
                {ddrBit === 1 ? '활성 (Active)' : '비활성 (Hi-Z)'}
              </span>
            </div>
            <div className="text-[11px] text-slate-300">
              • P-FET (상단): {ddrBit === 1 && portBit === 1 ? 'ON (VCC 구동)' : 'OFF'}
              <br />
              • N-FET (하단): {ddrBit === 1 && portBit === 0 ? 'ON (GND 구동)' : 'OFF'}
              <br />
              • 최대 소싱/싱킹 전류: <strong>20 mA</strong>
            </div>
          </div>

          {/* Block 3: Schmitt Trigger & PIN Register */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
            <div className="flex justify-between items-center text-slate-400">
              <span>슈미트 트리거 입력 버퍼</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800/50">
                PIN{portLetter}.{bitNum} = {simulationResult.pinBit}
              </span>
            </div>
            <div className="text-[11px] text-slate-300">
              • V_IH = {simulationResult.vih.toFixed(2)}V / V_IL = {simulationResult.vil.toFixed(2)}V
              <br />
              • 노이즈 방지 히스테리시스 윈도우 내장
              <br />
              • CPU 클럭 1주기 후 PIN 래치 동기화
            </div>
          </div>
        </div>

        {/* Live Mini Waveform Timeline */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> 실시간 PIN 로직 파형 스트림:
            </span>
            <span className="text-emerald-400 font-bold">
              현재: {simulationResult.pinBit === 1 ? 'HIGH (1)' : 'LOW (0)'}
            </span>
          </div>

          {/* Digital Scope Waveform Graph */}
          <div className="h-14 bg-slate-950 rounded-xl border border-slate-800 p-2 flex items-center gap-1 overflow-hidden">
            {waveformHistory.map((val, idx) => (
              <div key={idx} className="flex-1 h-full flex flex-col justify-end items-center relative">
                <div
                  className={`w-full transition-all duration-150 rounded-sm ${
                    val === 1
                      ? 'h-full bg-emerald-500/80 border-t-2 border-emerald-400'
                      : 'h-1.5 bg-slate-800 border-t border-slate-600'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Live Generated C Code Snippet */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
            <span>현재 설정에 부합하는 Bare-metal C 코드 (AVR-GCC)</span>
            <button
              onClick={handleCopyCode}
              className="text-cyan-400 hover:text-white flex items-center gap-1 transition"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? '복사됨!' : '코드 복사'}</span>
            </button>
          </div>
          <pre className="p-4 text-xs font-mono text-cyan-300 overflow-x-auto leading-relaxed select-all">
            {generatedCCode}
          </pre>
        </div>
      </div>
    </div>
  );
};
