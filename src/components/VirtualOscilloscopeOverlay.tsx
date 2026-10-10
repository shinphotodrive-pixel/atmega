import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Activity,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  RefreshCw,
  Sliders,
  Zap,
  Download,
  Eye,
  Layers,
  Settings2,
  Radio,
  Clock,
  Sparkles,
  HelpCircle,
  X,
  RotateCcw,
  Waves,
  Cpu,
  TrendingUp,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { GpioSignalParams } from '../data/gpioSignalTypes';

interface Props {
  selectedMCU: SupportedMCU;
  gpioParams: GpioSignalParams;
  onUpdateParams?: (newParams: Partial<GpioSignalParams>) => void;
  isOpen: boolean;
  onClose: () => void;
  isOverlayModal?: boolean;
}

// Available Time/Div steps (in seconds)
const TIME_DIV_OPTIONS = [
  { label: '50 ns/div', value: 50e-9 },
  { label: '100 ns/div', value: 100e-9 },
  { label: '200 ns/div', value: 200e-9 },
  { label: '500 ns/div', value: 500e-9 },
  { label: '1.0 µs/div', value: 1e-6 },
  { label: '2.0 µs/div', value: 2e-6 },
  { label: '5.0 µs/div', value: 5e-6 },
  { label: '10 µs/div', value: 10e-6 },
  { label: '20 µs/div', value: 20e-6 },
  { label: '50 µs/div', value: 50e-6 },
  { label: '100 µs/div', value: 100e-6 },
  { label: '200 µs/div', value: 200e-6 },
  { label: '500 µs/div', value: 500e-6 },
  { label: '1.0 ms/div', value: 1e-3 },
  { label: '2.0 ms/div', value: 2e-3 },
  { label: '5.0 ms/div', value: 5e-3 },
  { label: '10 ms/div', value: 10e-3 }
];

// Available Volts/Div steps (in Volts)
const VOLTS_DIV_OPTIONS = [
  { label: '200 mV/div', value: 0.2 },
  { label: '500 mV/div', value: 0.5 },
  { label: '1.0 V/div', value: 1.0 },
  { label: '2.0 V/div', value: 2.0 }
];

export const VirtualOscilloscopeOverlay: React.FC<Props> = ({
  selectedMCU,
  gpioParams,
  onUpdateParams,
  isOpen,
  onClose,
  isOverlayModal = false
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Oscilloscope run state
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [isSingleShot, setIsSingleShot] = useState<boolean>(false);
  const [hasSingleTriggered, setHasSingleTriggered] = useState<boolean>(false);

  // Timebase & Vertical scale
  const [timeDiv, setTimeDiv] = useState<number>(10e-6); // 10 µs/div default
  const [voltsDiv, setVoltsDiv] = useState<number>(1.0); // 1.0 V/div
  const [xOffsetSec, setXOffsetSec] = useState<number>(0); // Horizontal offset
  const [yOffsetVolts, setYOffsetVolts] = useState<number>(0); // Vertical offset (volts)

  // Trigger settings
  const [triggerLevel, setTriggerLevel] = useState<number>(2.5); // 2.5V default
  const [triggerEdge, setTriggerEdge] = useState<'rising' | 'falling'>('rising');
  const [triggerMode, setTriggerMode] = useState<'auto' | 'norm' | 'single'>('auto');

  // Persistence & Phosphor
  const [persistenceMode, setPersistenceMode] = useState<'none' | 'decay' | 'infinite'>('decay');

  // Interactive Cursors
  const [showCursors, setShowCursors] = useState<boolean>(false);
  const [cursorX1Ratio, setCursorX1Ratio] = useState<number>(0.3); // 30% width
  const [cursorX2Ratio, setCursorX2Ratio] = useState<number>(0.7); // 70% width
  const [cursorY1Volts, setCursorY1Volts] = useState<number>(0.5);
  const [cursorY2Volts, setCursorY2Volts] = useState<number>(4.5);

  // View modes
  const [activeScreenTab, setActiveScreenTab] = useState<'trace' | 'fft' | 'eye'>('trace');
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  // Live measurements (updated per frame with noise/jitter variation)
  const [measurements, setMeasurements] = useState({
    vpp: 5.0,
    vmax: 5.05,
    vmin: -0.05,
    vrms: 3.54,
    freq: gpioParams.frequencyHz,
    period: 1 / gpioParams.frequencyHz,
    duty: gpioParams.dutyCyclePct,
    riseTimeNs: 24.5,
    jitterRmsNs: gpioParams.jitterNs
  });

  // Calculate Auto-Scale time/div based on current GPIO frequency
  const autoScale = useCallback(() => {
    const period = 1 / gpioParams.frequencyHz;
    // We want about 3 to 5 periods across 10 divisions, so timeDiv ≈ (period * 3.5) / 10
    const idealTimeDiv = (period * 3.5) / 10;
    let closestTimeDiv = TIME_DIV_OPTIONS[0].value;
    let minDiff = Math.abs(TIME_DIV_OPTIONS[0].value - idealTimeDiv);

    for (const opt of TIME_DIV_OPTIONS) {
      const diff = Math.abs(opt.value - idealTimeDiv);
      if (diff < minDiff) {
        minDiff = diff;
        closestTimeDiv = opt.value;
      }
    }

    setTimeDiv(closestTimeDiv);
    setVoltsDiv(gpioParams.voltageLevel <= 3.3 ? 0.5 : 1.0);
    setYOffsetVolts(0);
    setXOffsetSec(0);
    setTriggerLevel(gpioParams.voltageLevel / 2);
  }, [gpioParams.frequencyHz, gpioParams.voltageLevel]);

  // Run autoScale whenever frequency changes drastically
  useEffect(() => {
    autoScale();
  }, [gpioParams.frequencyHz, autoScale]);

  // ----------------------------------------------------
  // Real-time Canvas Waveform Animation Loop
  // ----------------------------------------------------
  const animationFrameId = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);
  const jitterOffsetRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let destroyed = false;

    // Pseudo Gaussian noise using Box-Muller transform
    const randomGaussian = () => {
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };

    const render = () => {
      if (destroyed) return;

      const width = canvas.width;
      const height = canvas.height;

      // Grid division metrics (10 horizontal divisions, 8 vertical divisions)
      const numDivX = 10;
      const numDivY = 8;
      const divWidth = width / numDivX;
      const divHeight = height / numDivY;

      // Handling persistence background clearing
      if (persistenceMode === 'none') {
        ctx.fillStyle = '#050c14'; // CRT dark oscilloscope background
        ctx.fillRect(0, 0, width, height);
      } else if (persistenceMode === 'decay') {
        ctx.fillStyle = 'rgba(5, 12, 20, 0.22)'; // Phosphor decay trail
        ctx.fillRect(0, 0, width, height);
      } else {
        // Infinite persistence: don't clear background except for grid
        ctx.fillStyle = 'rgba(5, 12, 20, 0.02)';
        ctx.fillRect(0, 0, width, height);
      }

      // Draw Oscilloscope Graticule (Grid)
      ctx.save();
      ctx.strokeStyle = 'rgba(16, 75, 75, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);

      // Vertical grid lines
      for (let i = 1; i < numDivX; i++) {
        const x = i * divWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal grid lines
      for (let j = 1; j < numDivY; j++) {
        const y = j * divHeight;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Center crosshairs (solid with tick marks)
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(20, 110, 110, 0.7)';
      ctx.lineWidth = 1;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.beginPath();
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, height);
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Sub-ticks on center axes
      const tickSize = 3;
      for (let i = 0; i <= numDivX * 5; i++) {
        const x = (i * divWidth) / 5;
        ctx.beginPath();
        ctx.moveTo(x, centerY - tickSize);
        ctx.lineTo(x, centerY + tickSize);
        ctx.stroke();
      }
      for (let j = 0; j <= numDivY * 5; j++) {
        const y = (j * divHeight) / 5;
        ctx.beginPath();
        ctx.moveTo(centerX - tickSize, y);
        ctx.lineTo(centerX + tickSize, y);
        ctx.stroke();
      }
      ctx.restore();

      // Signal parameters
      const f = gpioParams.frequencyHz;
      const nominalT = 1 / f;
      const duty = gpioParams.dutyCyclePct / 100;
      const vcc = gpioParams.voltageLevel;
      const noiseVolts = (gpioParams.noiseMv / 1000) * 0.7; // RMS noise amplitude
      const jitterSec = (gpioParams.jitterNs * 1e-9); // Jitter std deviation
      const totalTimeWindow = numDivX * timeDiv; // Total time across screen (10 div)

      // Time offset & trigger phase
      if (isRunning) {
        frameCountRef.current++;
        // Edge jitter fluctuation per frame
        jitterOffsetRef.current = randomGaussian() * jitterSec;
        phaseRef.current += (1 / 60); // Time elapsed
      }

      // Ground (0V) Y position: centerY is 0V + yOffsetVolts
      // Invert Y because canvas Y goes downwards
      const voltsToY = (v: number) => {
        const vRel = (v - yOffsetVolts);
        const divOffset = vRel / voltsDiv;
        return centerY - divOffset * divHeight;
      };

      const groundY = voltsToY(0);

      // Draw Ground Reference Marker '1 ⏚' on left margin
      ctx.fillStyle = '#06b6d4';
      ctx.font = '10px monospace';
      ctx.fillText('1⏚', 4, groundY + 3);

      // Draw Trigger Level Reference Marker 'T' on right margin
      const trigY = voltsToY(triggerLevel);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('T', width - 12, trigY + 3);

      // Generate Waveform Trace
      ctx.save();
      ctx.strokeStyle = '#22d3ee'; // Phosphor Cyan trace (CH1)
      ctx.lineWidth = 2.0;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 8;
      ctx.lineJoin = 'round';
      ctx.beginPath();

      const numSamples = Math.min(width, 1000);
      let prevY = 0;

      // Rise/Fall transition time simulation (slew rate)
      const riseTimeSec = Math.max(10e-9, vcc / (gpioParams.slewRateVPerUs * 1e6));

      for (let px = 0; px < numSamples; px++) {
        const ratio = px / numSamples;
        const screenTime = ratio * totalTimeWindow + xOffsetSec;

        // Apply cycle-to-cycle timing jitter
        const effectiveTime = screenTime + jitterOffsetRef.current;
        const timeInPeriod = ((effectiveTime % nominalT) + nominalT) % nominalT;
        const dutyThreshold = nominalT * duty;

        // Ideal square wave state with finite slope
        let idealV = 0;
        if (timeInPeriod < riseTimeSec) {
          // Rising edge transition
          idealV = (timeInPeriod / riseTimeSec) * vcc;
        } else if (timeInPeriod < dutyThreshold) {
          // High plateau
          idealV = vcc;
        } else if (timeInPeriod < dutyThreshold + riseTimeSec) {
          // Falling edge transition
          const tFall = timeInPeriod - dutyThreshold;
          idealV = vcc * (1 - (tFall / riseTimeSec));
        } else {
          // Low plateau
          idealV = 0;
        }

        // Add Analog Noise (Gaussian white noise)
        const sampleNoise = randomGaussian() * noiseVolts;

        // Add Transient Ringing / Overshoot if enabled
        let ringing = 0;
        if (gpioParams.ringingEnabled) {
          const timeSinceRise = timeInPeriod;
          const timeSinceFall = timeInPeriod - dutyThreshold;
          if (timeSinceRise > 0 && timeSinceRise < 80e-9) {
            // Ringing after rising edge (damping oscillation)
            const decay = Math.exp(-timeSinceRise / 25e-9);
            ringing = 0.45 * Math.sin(timeSinceRise * 2 * Math.PI * 50e6) * decay;
          } else if (timeSinceFall > 0 && timeSinceFall < 80e-9) {
            // Ringing after falling edge (undershoot bounce)
            const decay = Math.exp(-timeSinceFall / 25e-9);
            ringing = -0.35 * Math.sin(timeSinceFall * 2 * Math.PI * 50e6) * decay;
          }
        }

        const totalVolts = idealV + sampleNoise + ringing;
        const plotY = voltsToY(totalVolts);

        const canvasX = (px / numSamples) * width;

        if (px === 0) {
          ctx.moveTo(canvasX, plotY);
        } else {
          ctx.lineTo(canvasX, plotY);
        }
        prevY = plotY;
      }

      ctx.stroke();
      ctx.restore();

      // If active screen is Eye Diagram / Persistent Jitter Overlay, draw multiple ghost sweeps
      if (activeScreenTab === 'eye') {
        ctx.save();
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)'; // Magenta ghost traces
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let g = 0; g < 4; g++) {
          const ghostJitter = randomGaussian() * jitterSec * 1.5;
          for (let px = 0; px < numSamples; px += 2) {
            const ratio = px / numSamples;
            const screenTime = ratio * totalTimeWindow + xOffsetSec;
            const effectiveTime = screenTime + ghostJitter;
            const timeInPeriod = ((effectiveTime % nominalT) + nominalT) % nominalT;
            const dutyThreshold = nominalT * duty;
            let v = timeInPeriod < dutyThreshold ? vcc : 0;
            v += randomGaussian() * noiseVolts * 0.8;
            const py = voltsToY(v);
            const cx = (px / numSamples) * width;
            if (px === 0) ctx.moveTo(cx, py);
            else ctx.lineTo(cx, py);
          }
        }
        ctx.stroke();
        ctx.restore();
      }

      // Draw Cursors if enabled
      if (showCursors) {
        ctx.save();
        // Vertical Time Cursors (A and B)
        const curX1 = cursorX1Ratio * width;
        const curX2 = cursorX2Ratio * width;

        ctx.strokeStyle = '#eab308'; // Amber Cursor 1
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(curX1, 0);
        ctx.lineTo(curX1, height);
        ctx.stroke();
        ctx.fillStyle = '#eab308';
        ctx.font = '10px monospace';
        ctx.fillText('C1', curX1 + 3, 14);

        ctx.strokeStyle = '#a855f7'; // Purple Cursor 2
        ctx.beginPath();
        ctx.moveTo(curX2, 0);
        ctx.lineTo(curX2, height);
        ctx.stroke();
        ctx.fillStyle = '#a855f7';
        ctx.fillText('C2', curX2 + 3, 14);

        // Delta-T indicator bar
        const deltaSec = Math.abs(cursorX2Ratio - cursorX1Ratio) * totalTimeWindow;
        ctx.fillStyle = 'rgba(234, 179, 8, 0.15)';
        ctx.fillRect(Math.min(curX1, curX2), 0, Math.abs(curX2 - curX1), 20);

        ctx.restore();
      }

      // Update Live Measurements periodically
      if (frameCountRef.current % 15 === 0) {
        const measuredJitter = gpioParams.jitterNs * (0.9 + Math.random() * 0.2);
        const noisePerturb = (Math.random() - 0.5) * (gpioParams.noiseMv / 1000);
        const calculatedVpp = vcc + Math.abs(noisePerturb) * 2;
        const calculatedFreq = f * (1 + (measuredJitter * 1e-9) / nominalT * (Math.random() - 0.5));
        const calculatedDuty = gpioParams.dutyCyclePct + (Math.random() - 0.5) * 0.4;

        setMeasurements({
          vpp: Math.max(0, calculatedVpp),
          vmax: vcc + Math.abs(noisePerturb),
          vmin: -Math.abs(noisePerturb),
          vrms: Math.sqrt(vcc * vcc * (gpioParams.dutyCyclePct / 100)),
          freq: calculatedFreq,
          period: 1 / calculatedFreq,
          duty: calculatedDuty,
          riseTimeNs: 24.5 + (Math.random() - 0.5) * 2.0,
          jitterRmsNs: measuredJitter
        });
      }

      // Loop if running
      if (isRunning) {
        animationFrameId.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      destroyed = true;
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [
    isRunning,
    timeDiv,
    voltsDiv,
    xOffsetSec,
    yOffsetVolts,
    triggerLevel,
    triggerEdge,
    persistenceMode,
    showCursors,
    cursorX1Ratio,
    cursorX2Ratio,
    activeScreenTab,
    gpioParams
  ]);

  // Download oscilloscope screen snapshot
  const handleDownloadSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `oscillo_${selectedMCU}_${gpioParams.frequencyHz}Hz.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Export CSV waveform
  const handleExportCSV = () => {
    const totalTimeWindow = 10 * timeDiv;
    const numPoints = 200;
    const lines = ['Time_Seconds,Voltage_Volts,Pin,MCU'];
    const f = gpioParams.frequencyHz;
    const T = 1 / f;
    const duty = gpioParams.dutyCyclePct / 100;

    for (let i = 0; i < numPoints; i++) {
      const t = (i / numPoints) * totalTimeWindow;
      const tMod = ((t % T) + T) % T;
      const v = tMod < T * duty ? gpioParams.voltageLevel : 0;
      lines.push(`${t.toExponential(6)},${v.toFixed(3)},${gpioParams.pinName},${selectedMCU}`);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gpio_waveform_${gpioParams.frequencyHz}Hz.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) {
    return null;
  }

  const containerClasses = isOverlayModal
    ? 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md'
    : 'relative bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl space-y-5';

  return (
    <div className={containerClasses}>
      <div className={`w-full ${isOverlayModal ? 'max-w-6xl max-h-[92vh] overflow-y-auto bg-slate-950/95 border border-cyan-500/30 rounded-2xl p-5 shadow-2xl space-y-5' : 'space-y-5'}`}>
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono">
                Digital Storage Oscilloscope DSO-2000AVR
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono">
                TRIG'D (CH1)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                {currentProfile.name}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              가상 오실로스코프 신호 분석기 (Virtual Oscilloscope)
              <span className="text-xs font-mono text-cyan-300/80 font-normal">
                [{gpioParams.pinName}]
              </span>
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              Registers 탭에서 전달받은 GPIO 토글 주파수({gpioParams.frequencyHz.toLocaleString()} Hz) 및 듀티비({gpioParams.dutyCyclePct}%)를 기반으로
              실시간 펄스 파형, 고주파 아날로그 노이즈(V_noise), 에지 지터(T_jitter) 및 PCB 오버슈트 링잉을 시뮬레이션합니다.
            </p>
          </div>

          {/* Quick Action Tools */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                isRunning
                  ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20'
                  : 'bg-rose-500 text-white hover:bg-rose-400 shadow-md shadow-rose-500/20'
              }`}
            >
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isRunning ? 'RUN' : 'STOP'}
            </button>

            <button
              onClick={autoScale}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition-all"
              title="최적 Time/Div 및 Volts/Div 자동 조정"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AUTO SET
            </button>

            <button
              onClick={handleDownloadSnapshot}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
              title="화면 캡처 PNG 저장"
            >
              <Download className="w-4 h-4" />
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-all"
                title="오실로스코프 오버레이 닫기"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Sync Status Banner */}
        <div className="bg-slate-950/80 border border-cyan-500/20 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-cyan-300">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Registers 탭 파라미터 동기화:</span>
            <span className="font-bold text-white">{gpioParams.frequencyHz.toLocaleString()} Hz</span>
            <span className="text-slate-500">•</span>
            <span className="text-amber-400 font-bold">{gpioParams.dutyCyclePct}% Duty</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400 font-bold">{gpioParams.voltageLevel}V VCC</span>
            <span className="text-slate-500">•</span>
            <span className="text-rose-400">{gpioParams.noiseMv}mV Noise</span>
            <span className="text-slate-500">•</span>
            <span className="text-violet-400">{gpioParams.jitterNs}ns Jitter</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>화면 모드:</span>
            <button
              onClick={() => setActiveScreenTab('trace')}
              className={`px-2 py-0.5 rounded font-bold ${
                activeScreenTab === 'trace' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'hover:text-white'
              }`}
            >
              실시간 파형 (Trace)
            </button>
            <button
              onClick={() => setActiveScreenTab('eye')}
              className={`px-2 py-0.5 rounded font-bold ${
                activeScreenTab === 'eye' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40' : 'hover:text-white'
              }`}
            >
              지터 축적 / Eye Mode
            </button>
            <button
              onClick={handleExportCSV}
              className="text-cyan-400 hover:underline inline-flex items-center gap-1"
            >
              CSV 내보내기
            </button>
          </div>
        </div>

        {/* Main Grid: Screen + Side Control Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Oscilloscope Screen (3 Columns) */}
          <div className="lg:col-span-3 space-y-3">
            <div className="relative bg-[#050c14] rounded-2xl border-2 border-slate-800 shadow-inner overflow-hidden p-1">
              {/* OSD Top Overlay inside screen */}
              <div className="absolute top-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-cyan-300/90 pointer-events-none select-none z-10">
                <div className="flex items-center gap-3 bg-slate-950/70 px-2.5 py-1 rounded-md border border-slate-800/80">
                  <span className="text-cyan-400 font-bold">CH1: {voltsDiv >= 1 ? `${voltsDiv.toFixed(1)}V/div` : `${(voltsDiv * 1000).toFixed(0)}mV/div`} DC</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-emerald-400 font-bold">
                    TB: {timeDiv >= 1e-3 ? `${(timeDiv * 1000).toFixed(1)}ms/div` : timeDiv >= 1e-6 ? `${(timeDiv * 1e6).toFixed(1)}µs/div` : `${(timeDiv * 1e9).toFixed(0)}ns/div`}
                  </span>
                  <span className="text-slate-500">|</span>
                  <span className="text-amber-400">Trig: {triggerLevel.toFixed(2)}V {triggerEdge === 'rising' ? '↗' : '↘'}</span>
                </div>

                <div className="bg-slate-950/70 px-2.5 py-1 rounded-md border border-slate-800/80 text-[10px] text-slate-300">
                  {isRunning ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> AUTO / ACQ
                    </span>
                  ) : (
                    <span className="text-rose-400 font-bold">HOLD / STOP</span>
                  )}
                </div>
              </div>

              {/* Main Oscilloscope Canvas */}
              <canvas
                ref={canvasRef}
                width={800}
                height={420}
                className="w-full h-[320px] sm:h-[400px] block rounded-xl cursor-crosshair"
              />

              {/* OSD Bottom Measurements Bar inside screen */}
              <div className="absolute bottom-3 left-4 right-4 bg-slate-950/80 backdrop-blur-sm border border-slate-800 rounded-lg px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-300 pointer-events-none select-none z-10">
                <div className="flex items-center gap-3">
                  <span>Vpp: <strong className="text-cyan-300">{measurements.vpp.toFixed(2)}V</strong></span>
                  <span>Vmax: <strong className="text-emerald-300">{measurements.vmax.toFixed(2)}V</strong></span>
                  <span>Vmin: <strong className="text-slate-400">{measurements.vmin.toFixed(2)}V</strong></span>
                  <span>Vrms: <strong className="text-blue-300">{measurements.vrms.toFixed(2)}V</strong></span>
                </div>
                <div className="flex items-center gap-3">
                  <span>Freq: <strong className="text-cyan-300">{measurements.freq >= 1e6 ? `${(measurements.freq / 1e6).toFixed(3)}MHz` : measurements.freq >= 1e3 ? `${(measurements.freq / 1e3).toFixed(2)}kHz` : `${measurements.freq.toFixed(1)}Hz`}</strong></span>
                  <span>Period: <strong className="text-white">{measurements.period >= 1e-3 ? `${(measurements.period * 1e3).toFixed(2)}ms` : `${(measurements.period * 1e6).toFixed(2)}µs`}</strong></span>
                  <span>+Duty: <strong className="text-amber-300">{measurements.duty.toFixed(1)}%</strong></span>
                  <span>Jitter: <strong className="text-rose-300">{measurements.jitterRmsNs.toFixed(1)}ns</strong></span>
                </div>
              </div>
            </div>

            {/* Bottom Real-time Measurement HUD Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-400 block font-mono">측정 주파수 (f_meas)</span>
                <div className="text-sm font-bold text-cyan-400 font-mono mt-0.5">
                  {measurements.freq >= 1e6
                    ? `${(measurements.freq / 1e6).toFixed(4)} MHz`
                    : measurements.freq >= 1e3
                    ? `${(measurements.freq / 1e3).toFixed(3)} kHz`
                    : `${measurements.freq.toFixed(2)} Hz`}
                </div>
                <span className="text-[9px] text-slate-500 font-mono">공칭: {gpioParams.frequencyHz.toLocaleString()} Hz</span>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-400 block font-mono">양(+)의 펄스 듀티 사이클</span>
                <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">
                  {measurements.duty.toFixed(2)} %
                </div>
                <span className="text-[9px] text-slate-500 font-mono">설정값: {gpioParams.dutyCyclePct}%</span>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-400 block font-mono">실효 피크-투-피크 전압 (Vpp)</span>
                <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                  {measurements.vpp.toFixed(2)} V
                </div>
                <span className="text-[9px] text-slate-500 font-mono">V_OH: {gpioParams.voltageLevel}V</span>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                <span className="text-[10px] text-slate-400 block font-mono">에지 지터 (Cycle-to-Cycle)</span>
                <div className="text-sm font-bold text-rose-400 font-mono mt-0.5">
                  {measurements.jitterRmsNs.toFixed(1)} ns
                </div>
                <span className="text-[9px] text-slate-500 font-mono">Trise: ~{measurements.riseTimeNs.toFixed(1)}ns</span>
              </div>
            </div>
          </div>

          {/* Oscilloscope Control Panel (1 Column) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4 text-xs font-sans">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-cyan-400" />
                스코프 노브 & 제어부
              </span>
              <button
                onClick={autoScale}
                className="text-[10px] text-cyan-400 hover:underline font-mono"
              >
                Auto Set
              </button>
            </div>

            {/* Horizontal Timebase (Time/Div) */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-slate-300 font-semibold">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  Time / Div (수평 스케일)
                </span>
                <span className="font-mono text-cyan-400 font-bold">
                  {TIME_DIV_OPTIONS.find((o) => o.value === timeDiv)?.label || `${timeDiv} s`}
                </span>
              </div>
              <select
                value={timeDiv}
                onChange={(e) => setTimeDiv(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              >
                {TIME_DIV_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Vertical Scale (Volts/Div) */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-slate-300 font-semibold">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Volts / Div (수직 스케일)
                </span>
                <span className="font-mono text-amber-400 font-bold">
                  {VOLTS_DIV_OPTIONS.find((o) => o.value === voltsDiv)?.label || `${voltsDiv} V`}
                </span>
              </div>
              <select
                value={voltsDiv}
                onChange={(e) => setVoltsDiv(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              >
                {VOLTS_DIV_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Vertical Offset (Position Y) */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Vertical Position (Y Offset)</span>
                <span className="font-mono text-slate-300">{yOffsetVolts.toFixed(2)} V</span>
              </div>
              <input
                type="range"
                min="-3.0"
                max="3.0"
                step="0.1"
                value={yOffsetVolts}
                onChange={(e) => setYOffsetVolts(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Trigger Controls */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex justify-between text-slate-300 font-semibold">
                <span>트리거 설정 (Trigger)</span>
                <span className="font-mono text-amber-400 text-[11px]">{triggerLevel.toFixed(2)} V</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTriggerEdge('rising')}
                  className={`py-1 rounded-lg border text-xs font-semibold ${
                    triggerEdge === 'rising'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  상승 에지 (↗)
                </button>
                <button
                  type="button"
                  onClick={() => setTriggerEdge('falling')}
                  className={`py-1 rounded-lg border text-xs font-semibold ${
                    triggerEdge === 'falling'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  하강 에지 (↘)
                </button>
              </div>

              <input
                type="range"
                min="0.5"
                max="4.5"
                step="0.05"
                value={triggerLevel}
                onChange={(e) => setTriggerLevel(Number(e.target.value))}
                className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Phosphor Persistence Mode */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-pink-400" />
                형광체 잔상 (Persistence / 지터 관측)
              </label>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => setPersistenceMode('none')}
                  className={`py-1 text-[11px] rounded-lg border font-medium ${
                    persistenceMode === 'none'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  OFF
                </button>
                <button
                  type="button"
                  onClick={() => setPersistenceMode('decay')}
                  className={`py-1 text-[11px] rounded-lg border font-medium ${
                    persistenceMode === 'decay'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  잔상 감쇄
                </button>
                <button
                  type="button"
                  onClick={() => setPersistenceMode('infinite')}
                  className={`py-1 text-[11px] rounded-lg border font-medium ${
                    persistenceMode === 'infinite'
                      ? 'bg-pink-500/20 border-pink-500 text-pink-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  무한 축적
                </button>
              </div>
            </div>

            {/* Signal Noise & Jitter Tweakers (Live Updates) */}
            {onUpdateParams && (
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <span className="font-semibold text-slate-300 block">신호 무결성 실시간 가변</span>

                {/* Noise adjustment */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>노이즈 레벨 (V_noise)</span>
                    <span className="font-mono text-rose-400 font-bold">{gpioParams.noiseMv} mV</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="400"
                    step="10"
                    value={gpioParams.noiseMv}
                    onChange={(e) => onUpdateParams({ noiseMv: Number(e.target.value) })}
                    className="w-full accent-rose-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Jitter adjustment */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>타이밍 지터 (T_jitter)</span>
                    <span className="font-mono text-violet-400 font-bold">{gpioParams.jitterNs} ns</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    step="5"
                    value={gpioParams.jitterNs}
                    onChange={(e) => onUpdateParams({ jitterNs: Number(e.target.value) })}
                    className="w-full accent-violet-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Duty Cycle adjustment */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>듀티비 실시간 튜닝</span>
                    <span className="font-mono text-amber-400 font-bold">{gpioParams.dutyCyclePct}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="95"
                    step="1"
                    value={gpioParams.dutyCyclePct}
                    onChange={(e) => onUpdateParams({ dutyCyclePct: Number(e.target.value) })}
                    className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Measurement Cursors toggle */}
            <div className="pt-2 border-t border-slate-800">
              <label className="flex items-center justify-between text-xs cursor-pointer text-slate-300">
                <span className="font-semibold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-yellow-400" />
                  계측 커서 (Cursors C1/C2)
                </span>
                <input
                  type="checkbox"
                  checked={showCursors}
                  onChange={(e) => setShowCursors(e.target.checked)}
                  className="rounded accent-cyan-500 w-4 h-4"
                />
              </label>

              {showCursors && (
                <div className="mt-2 p-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono space-y-1 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-yellow-400">ΔT (시간차):</span>
                    <span className="font-bold text-white">
                      {((Math.abs(cursorX2Ratio - cursorX1Ratio) * 10 * timeDiv) * 1e6).toFixed(2)} µs
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cyan-400">1/ΔT (등가주파수):</span>
                    <span className="font-bold text-cyan-300">
                      {((1 / (Math.abs(cursorX2Ratio - cursorX1Ratio) * 10 * timeDiv)) / 1000).toFixed(2)} kHz
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Technical Insights & Signal Integrity Guide Footer */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 text-xs text-slate-400 leading-relaxed grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <span className="text-white font-bold flex items-center gap-1.5 text-[11px]">
              <Waves className="w-3.5 h-3.5 text-cyan-400" />
              아날로그 노이즈 해석
            </span>
            <p className="text-[11px] text-slate-400">
              MCU 내부 전원선(VCC/GND) 임피던스와 스위칭 전류로 인해 발생하는 접지 바운스(Ground Bounce) 및 열잡음입니다. 디커플링 커패시터(100nF MLCC)를 VCC 핀 최근접 배치하여 감쇄시킵니다.
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-white font-bold flex items-center gap-1.5 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-violet-400" />
              에지 지터 (Jitter) 해석
            </span>
            <p className="text-[11px] text-slate-400">
              클록 오실레이터의 위상 잡음(Phase Noise) 및 인터럽트 지연(Interrupt Latency) 편차에 의해 구형파의 상승/하강 전환 시점이 시간 축에서 흔들리는 현상입니다. '무한 축적' 모드로 지터 폭을 직접 관측할 수 있습니다.
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-white font-bold flex items-center gap-1.5 text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              오버슈트 & 링잉 (Ringing)
            </span>
            <p className="text-[11px] text-slate-400">
              PCB 배선 기생 인덕턴스(L_trace)와 MCU 핀 커패시턴스(C_pin)가 LC 공진 회로를 형성하여 전이 에지 직후 감쇄 진동을 발생시킵니다. 직렬 댐핑 저항(22~47Ω)으로 억제합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
