import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Activity,
  Sliders,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Info,
  Clock,
  Sparkles,
  Check,
  Copy,
  Layers,
  ArrowRight,
  TrendingUp,
  Cpu,
  Bookmark,
  Radio,
  SlidersHorizontal
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { GpioSignalParams } from '../data/gpioSignalTypes';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  gpioParams?: GpioSignalParams;
  onUpdateGpioParams?: (newParams: Partial<GpioSignalParams>) => void;
}

export const GpioVisualizer: React.FC<Props> = ({
  selectedMCU,
  gpioParams,
  onUpdateGpioParams
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Frequency & Duty Cycle States (defaulting from gpioParams if available)
  const [frequencyHz, setFrequencyHz] = useState<number>(gpioParams?.frequencyHz || 50000);
  const [dutyCyclePct, setDutyCyclePct] = useState<number>(gpioParams?.dutyCyclePct ?? 50);
  const [voltageLevel, setVoltageLevel] = useState<number>(gpioParams?.voltageLevel || 5.0);
  const [displayCycles, setDisplayCycles] = useState<number>(3);
  const [transitionMode, setTransitionMode] = useState<'ideal' | 'realistic'>('realistic');
  const [showInvertedChannel, setShowInvertedChannel] = useState<boolean>(true);
  const [showClockTicks, setShowClockTicks] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Sync when external gpioParams change
  useEffect(() => {
    if (gpioParams) {
      setFrequencyHz(gpioParams.frequencyHz);
      setDutyCyclePct(gpioParams.dutyCyclePct);
      setVoltageLevel(gpioParams.voltageLevel);
    }
  }, [gpioParams?.frequencyHz, gpioParams?.dutyCyclePct, gpioParams?.voltageLevel]);

  // Sync back to parent if requested
  const handleFrequencyChange = (newFreq: number) => {
    const clamped = Math.max(10, Math.min(8000000, newFreq));
    setFrequencyHz(clamped);
    if (onUpdateGpioParams) {
      onUpdateGpioParams({ frequencyHz: clamped });
    }
  };

  const handleDutyCycleChange = (newDuty: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newDuty * 10) / 10));
    setDutyCyclePct(clamped);
    if (onUpdateGpioParams) {
      onUpdateGpioParams({ dutyCyclePct: clamped });
    }
  };

  // Timing Calculations
  const periodSec = useMemo(() => 1 / frequencyHz, [frequencyHz]);
  const highTimeSec = useMemo(() => periodSec * (dutyCyclePct / 100), [periodSec, dutyCyclePct]);
  const lowTimeSec = useMemo(() => periodSec * (1 - dutyCyclePct / 100), [periodSec, dutyCyclePct]);

  // CPU Machine cycles per period at standard 16 MHz
  const mcuClockHz = 16000000;
  const cyclesPerPeriod = useMemo(() => mcuClockHz / frequencyHz, [frequencyHz]);
  const cyclesHigh = useMemo(() => Math.round(cyclesPerPeriod * (dutyCyclePct / 100)), [cyclesPerPeriod, dutyCyclePct]);
  const cyclesLow = useMemo(() => Math.round(cyclesPerPeriod * (1 - dutyCyclePct / 100)), [cyclesPerPeriod, dutyCyclePct]);

  // Electrical Voltages
  const avgVoltage = useMemo(() => voltageLevel * (dutyCyclePct / 100), [voltageLevel, dutyCyclePct]);
  const rmsVoltage = useMemo(() => voltageLevel * Math.sqrt(dutyCyclePct / 100), [voltageLevel, dutyCyclePct]);

  // Format Time Strings (s, ms, µs, ns)
  const formatTime = (seconds: number) => {
    if (seconds >= 1) return `${seconds.toFixed(3)} s`;
    if (seconds >= 1e-3) return `${(seconds * 1e3).toFixed(2)} ms`;
    if (seconds >= 1e-6) return `${(seconds * 1e6).toFixed(2)} µs`;
    return `${(seconds * 1e9).toFixed(1)} ns`;
  };

  // Format Frequency
  const formatFrequency = (hz: number) => {
    if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)} MHz`;
    if (hz >= 1e3) return `${(hz / 1e3).toFixed(1)} kHz`;
    return `${hz} Hz`;
  };

  // SVG Refs & Animation
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 340 });
  const animPhaseRef = useRef<number>(0);
  const requestRef = useRef<number | null>(null);

  // Resize Observer for responsiveness
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setDimensions({
            width: Math.max(500, entry.contentRect.width),
            height: 350
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Animation loop for phase movement
  useEffect(() => {
    let lastTimestamp = performance.now();
    const animate = (timestamp: number) => {
      const dt = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      if (isPlaying) {
        // Move phase smoothly: 1 period per 2.5 seconds visually
        animPhaseRef.current = (animPhaseRef.current + dt * 0.4) % 1;
      }
      drawD3TimingDiagram();
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [
    dimensions,
    frequencyHz,
    dutyCyclePct,
    voltageLevel,
    displayCycles,
    transitionMode,
    showInvertedChannel,
    showClockTicks,
    isPlaying
  ]);

  // Main D3 Rendering Function
  const drawD3TimingDiagram = () => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const margin = { top: 40, right: 40, bottom: 45, left: 75 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Defs: Gradients, Markers, Filters
    const defs = svg.append('defs');

    // Arrowhead marker for measurement brackets
    defs.append('marker')
      .attr('id', 'dim-arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 5)
      .attr('refY', 5)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M 0 1.5 L 10 5 L 0 8.5 z')
      .attr('fill', '#f59e0b');

    defs.append('marker')
      .attr('id', 'dim-arrow-cyan')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 5)
      .attr('refY', 5)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M 0 1.5 L 10 5 L 0 8.5 z')
      .attr('fill', '#06b6d4');

    // Linear gradient for signal area fill
    const signalGradient = defs.append('linearGradient')
      .attr('id', 'signal-glow')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    signalGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#f59e0b')
      .attr('stop-opacity', 0.25);

    signalGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#f59e0b')
      .attr('stop-opacity', 0.0);

    const invertedGradient = defs.append('linearGradient')
      .attr('id', 'inverted-glow')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    invertedGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#06b6d4')
      .attr('stop-opacity', 0.2);

    invertedGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#06b6d4')
      .attr('stop-opacity', 0.0);

    // Main Group
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Total Time Range displayed
    const totalTimeSpan = displayCycles * periodSec;
    // Current animated offset time
    const animTimeOffset = animPhaseRef.current * periodSec;

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, totalTimeSpan])
      .range([0, innerWidth]);

    // Channel Layout
    const channel1Height = showInvertedChannel ? innerHeight * 0.45 : innerHeight * 0.75;
    const channel2Top = innerHeight * 0.55;
    const channel2Height = innerHeight * 0.35;

    // Background Grid
    const numGridCols = 10;
    const numGridRows = showInvertedChannel ? 6 : 4;

    const gridGroup = g.append('g').attr('class', 'grid');

    // Vertical grid lines
    for (let i = 0; i <= numGridCols; i++) {
      const xPos = (innerWidth / numGridCols) * i;
      gridGroup.append('line')
        .attr('x1', xPos)
        .attr('y1', 0)
        .attr('x2', xPos)
        .attr('y2', innerHeight)
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', i % 2 === 0 ? 'none' : '2,2');
    }

    // Horizontal grid lines
    for (let j = 0; j <= numGridRows; j++) {
      const yPos = (innerHeight / numGridRows) * j;
      gridGroup.append('line')
        .attr('x1', 0)
        .attr('y1', yPos)
        .attr('x2', innerWidth)
        .attr('y2', yPos)
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,4');
    }

    // Channel 1: Primary GPIO Pulse Track
    const ch1LowY = channel1Height;
    const ch1HighY = 20;

    // Threshold Guides (VIH = 0.7 * VCC, VIL = 0.3 * VCC)
    const vihY = ch1LowY - (ch1LowY - ch1HighY) * 0.7;
    const vilY = ch1LowY - (ch1LowY - ch1HighY) * 0.3;

    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', vihY)
      .attr('y2', vihY)
      .attr('stroke', '#10b981')
      .attr('stroke-width', 0.8)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.5);

    g.append('text')
      .attr('x', innerWidth - 5)
      .attr('y', vihY - 3)
      .attr('text-anchor', 'end')
      .attr('fill', '#10b981')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .attr('opacity', 0.7)
      .text(`VIH min (3.0V)`);

    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', vilY)
      .attr('y2', vilY)
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 0.8)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.5);

    g.append('text')
      .attr('x', innerWidth - 5)
      .attr('y', vilY + 10)
      .attr('text-anchor', 'end')
      .attr('fill', '#ef4444')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .attr('opacity', 0.7)
      .text(`VIL max (1.5V)`);

    // Slew rate rise/fall duration: ~15ns realistically for AVR output buffer
    const slewTime = transitionMode === 'realistic' ? Math.min(periodSec * 0.08, 20e-9) : 0;

    // Generate Points for Primary Waveform
    const sampleCount = Math.max(400, Math.round(innerWidth));
    const ch1Points: [number, number][] = [];
    const ch2Points: [number, number][] = [];

    for (let i = 0; i <= sampleCount; i++) {
      const fraction = i / sampleCount;
      const t = fraction * totalTimeSpan;
      // Effective phase in period [0, periodSec)
      const phaseT = ((t + animTimeOffset) % periodSec + periodSec) % periodSec;

      let ch1Val: number; // 0 (low) to 1 (high)
      const dutyEdge = highTimeSec;

      if (transitionMode === 'realistic' && slewTime > 0) {
        if (phaseT < slewTime) {
          // Rising edge
          ch1Val = 0.5 - 0.5 * Math.cos((Math.PI * phaseT) / slewTime);
        } else if (phaseT < dutyEdge) {
          ch1Val = 1;
        } else if (phaseT < dutyEdge + slewTime) {
          // Falling edge
          const fallFrac = (phaseT - dutyEdge) / slewTime;
          ch1Val = 0.5 + 0.5 * Math.cos(Math.PI * fallFrac);
        } else {
          ch1Val = 0;
        }
      } else {
        // Ideal step
        ch1Val = phaseT < dutyEdge ? 1 : 0;
      }

      const xPixel = xScale(t);
      const ch1YPixel = ch1LowY - ch1Val * (ch1LowY - ch1HighY);
      ch1Points.push([xPixel, ch1YPixel]);

      if (showInvertedChannel) {
        const ch2LowY = channel2Top + channel2Height;
        const ch2HighY = channel2Top + 10;
        const ch2Val = 1 - ch1Val; // Inverted complementary PWM
        const ch2YPixel = ch2LowY - ch2Val * (ch2LowY - ch2HighY);
        ch2Points.push([xPixel, ch2YPixel]);
      }
    }

    // Line Generator
    const lineGen = d3.line<[number, number]>()
      .x((d) => d[0])
      .y((d) => d[1]);

    // Area Generator for Signal Fill
    const areaGenCh1 = d3.area<[number, number]>()
      .x((d) => d[0])
      .y0(ch1LowY)
      .y1((d) => d[1]);

    // Draw Channel 1 Glow & Fill
    g.append('path')
      .datum(ch1Points)
      .attr('fill', 'url(#signal-glow)')
      .attr('d', areaGenCh1);

    // Draw Channel 1 Trace
    g.append('path')
      .datum(ch1Points)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2.5)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .attr('d', lineGen);

    // Channel 1 Label
    g.append('text')
      .attr('x', -60)
      .attr('y', (ch1LowY + ch1HighY) / 2)
      .attr('fill', '#f59e0b')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'monospace')
      .text('CH1 (GPIO)');

    // Logic 1 / Logic 0 Y-axis labels
    g.append('text')
      .attr('x', -10)
      .attr('y', ch1HighY + 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .text(`${voltageLevel.toFixed(1)}V (H)`);

    g.append('text')
      .attr('x', -10)
      .attr('y', ch1LowY + 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .text('0.0V (L)');

    // Inverted Channel 2 if enabled
    if (showInvertedChannel && ch2Points.length > 0) {
      const ch2LowY = channel2Top + channel2Height;
      const ch2HighY = channel2Top + 10;

      const areaGenCh2 = d3.area<[number, number]>()
        .x((d) => d[0])
        .y0(ch2LowY)
        .y1((d) => d[1]);

      g.append('path')
        .datum(ch2Points)
        .attr('fill', 'url(#inverted-glow)')
        .attr('d', areaGenCh2);

      g.append('path')
        .datum(ch2Points)
        .attr('fill', 'none')
        .attr('stroke', '#06b6d4')
        .attr('stroke-width', 2)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('d', lineGen);

      g.append('text')
        .attr('x', -60)
        .attr('y', (ch2LowY + ch2HighY) / 2)
        .attr('fill', '#06b6d4')
        .attr('font-size', '11px')
        .attr('font-weight', 'bold')
        .attr('font-family', 'monospace')
        .text('CH2 (~PWM)');

      g.append('text')
        .attr('x', -10)
        .attr('y', ch2HighY + 4)
        .attr('text-anchor', 'end')
        .attr('fill', '#64748b')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .text('HIGH');

      g.append('text')
        .attr('x', -10)
        .attr('y', ch2LowY + 4)
        .attr('text-anchor', 'end')
        .attr('fill', '#64748b')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .text('LOW');
    }

    // Measurement Annotations & Dimension Arrows
    // We anchor the annotation brackets to the first stationary period on the screen
    const firstPeriodStartX = xScale(0);
    const firstPeriodHighX = xScale(highTimeSec);
    const firstPeriodEndX = xScale(periodSec);

    // Period bracket (T) on top
    const dimY = 12;
    if (firstPeriodEndX > firstPeriodStartX + 20) {
      // Dimension line
      g.append('line')
        .attr('x1', firstPeriodStartX + 3)
        .attr('y1', dimY)
        .attr('x2', firstPeriodEndX - 3)
        .attr('y2', dimY)
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 1.5)
        .attr('marker-start', 'url(#dim-arrow)')
        .attr('marker-end', 'url(#dim-arrow)');

      // Downward tick marks
      g.append('line')
        .attr('x1', firstPeriodStartX)
        .attr('y1', dimY - 4)
        .attr('x2', firstPeriodStartX)
        .attr('y2', dimY + 6)
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 1.5);

      g.append('line')
        .attr('x1', firstPeriodEndX)
        .attr('y1', dimY - 4)
        .attr('x2', firstPeriodEndX)
        .attr('y2', dimY + 6)
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 1.5);

      // Period text
      const periodLabelX = (firstPeriodStartX + firstPeriodEndX) / 2;
      g.append('rect')
        .attr('x', periodLabelX - 45)
        .attr('y', dimY - 9)
        .attr('width', 90)
        .attr('height', 16)
        .attr('rx', 4)
        .attr('fill', '#0f172a')
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 0.8);

      g.append('text')
        .attr('x', periodLabelX)
        .attr('y', dimY + 3)
        .attr('text-anchor', 'middle')
        .attr('fill', '#f59e0b')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .attr('font-family', 'monospace')
        .text(`T = ${formatTime(periodSec)}`);
    }

    // High Pulse Width (T_HIGH) Dimension Bracket
    if (firstPeriodHighX > firstPeriodStartX + 30) {
      const highDimY = ch1HighY + 16;
      g.append('line')
        .attr('x1', firstPeriodStartX + 3)
        .attr('y1', highDimY)
        .attr('x2', firstPeriodHighX - 3)
        .attr('y2', highDimY)
        .attr('stroke', '#fbbf24')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '2,2');

      const highLabelX = (firstPeriodStartX + firstPeriodHighX) / 2;
      g.append('text')
        .attr('x', highLabelX)
        .attr('y', highDimY - 4)
        .attr('text-anchor', 'middle')
        .attr('fill', '#fbbf24')
        .attr('font-size', '9px')
        .attr('font-weight', 'semibold')
        .attr('font-family', 'monospace')
        .text(`TH: ${formatTime(highTimeSec)} (${dutyCyclePct}%)`);
    }

    // MCU Clock Ticks on top edge if enabled and frequency allows
    if (showClockTicks && cyclesPerPeriod <= 100 && cyclesPerPeriod >= 2) {
      const tickY = innerHeight + 5;
      const numTicks = Math.min(100, Math.round(displayCycles * cyclesPerPeriod));
      for (let k = 0; k <= numTicks; k++) {
        const tickTime = (k / mcuClockHz);
        if (tickTime > totalTimeSpan) break;
        const tickX = xScale(tickTime);
        g.append('line')
          .attr('x1', tickX)
          .attr('y1', tickY)
          .attr('x2', tickX)
          .attr('y2', tickY + (k % 4 === 0 ? 6 : 3))
          .attr('stroke', k % 4 === 0 ? '#6366f1' : '#334155')
          .attr('stroke-width', 1);
      }
    }

    // X-Axis (Time Base)
    const xAxis = d3.axisBottom(xScale)
      .ticks(Math.min(8, Math.floor(innerWidth / 90)))
      .tickFormat((d) => formatTime(d as number));

    const xAxisGroup = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisGroup.selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-family', 'monospace')
      .attr('font-size', '10px');

    xAxisGroup.selectAll('line').attr('stroke', '#334155');
    xAxisGroup.select('.domain').attr('stroke', '#475569');

    // Scanline / Trigger Indicator Cursor (Live sweep)
    const scanlineX = (animPhaseRef.current * innerWidth);
    g.append('line')
      .attr('x1', scanlineX)
      .attr('y1', 0)
      .attr('x2', scanlineX)
      .attr('y2', innerHeight)
      .attr('stroke', '#ec4899')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.8);

    g.append('circle')
      .attr('cx', scanlineX)
      .attr('cy', ch1HighY)
      .attr('r', 3)
      .attr('fill', '#ec4899');
  };

  // Quick Frequency Presets
  const frequencyPresets = [
    { label: '490 Hz', value: 490, desc: '표준 Arduino PWM (Timer0/2)' },
    { label: '976 Hz', value: 976, desc: 'Fast PWM 기본 모드' },
    { label: '5 kHz', value: 5000, desc: '가청 주파수 상한 / 솔레노이드' },
    { label: '25 kHz', value: 25000, desc: '4핀 PC 쿨링팬 규격' },
    { label: '50 kHz', value: 50000, desc: '고속 BLDC 모터 구동' },
    { label: '100 kHz', value: 100000, desc: 'I2C Standard SCL 속도' },
    { label: '1 MHz', value: 1000000, desc: 'SPI SCK / 하이엔드 토글' },
    { label: '8 MHz', value: 8000000, desc: '16MHz F_CPU 하드웨어 최고속도 (2클럭 토글)' }
  ];

  // Quick Duty Presets
  const dutyPresets = [10, 25, 50, 75, 90];

  // Generate Bare-metal C Code
  const generatedCCode = useMemo(() => {
    // Determine optimal prescaler and ICR1 for 16-bit Timer1 Fast PWM (Mode 14)
    const prescalers = [1, 8, 64, 256, 1024];
    let chosenPrescaler = 1;
    let chosenTop = 0;

    for (const N of prescalers) {
      const top = Math.round(mcuClockHz / (N * frequencyHz)) - 1;
      if (top > 0 && top <= 65535) {
        chosenPrescaler = N;
        chosenTop = top;
        break;
      }
    }

    const ocrValue = Math.round((chosenTop + 1) * (dutyCyclePct / 100));

    let csBits = 'CS10';
    if (chosenPrescaler === 8) csBits = 'CS11';
    if (chosenPrescaler === 64) csBits = '(1 << CS11) | (1 << CS10)';
    if (chosenPrescaler === 256) csBits = 'CS12';
    if (chosenPrescaler === 1024) csBits = '(1 << CS12) | (1 << CS10)';

    return `// ==============================================================================
// ${currentProfile.name} 16-bit Timer1 정밀 하드웨어 PWM 생성 C 코드
// 설정 주파수: ${formatFrequency(frequencyHz)} • 듀티비: ${dutyCyclePct}%
// F_CPU: 16,000,000 Hz | 분주비: ${chosenPrescaler} | TOP(ICR1): ${chosenTop} | OCR1A: ${ocrValue}
// ==============================================================================
#include <avr/io.h>

void init_gpio_pwm(void) {
    // 1. PWM 출력 핀 출력 모드(DDR) 설정 (OC1A 핀)
    DDRB |= (1 << DDB5); // ATmega640/328P: PB5, ATmega128: PB5/OC1A

    // 2. Fast PWM 모드 14 (TOP = ICR1) 및 비반전(Non-Inverting) 출력 설정
    // COM1A1=1: Match 시 LOW, Bottom 도달 시 HIGH 토글
    // WGM13=1, WGM12=1, WGM11=1: Fast PWM Mode 14
    TCCR1A = (1 << COM1A1) | (1 << WGM11);
    TCCR1B = (1 << WGM13) | (1 << WGM12) | (1 << ${csBits});

    // 3. 주파수 및 듀티 사이클 레지스터 로드
    ICR1  = ${chosenTop};  // 주기 결정 (TOP) -> f = F_CPU / (N * (1 + TOP))
    OCR1A = ${ocrValue};  // 듀티비 결정 -> Duty = OCR1A / (TOP + 1)
}

int main(void) {
    init_gpio_pwm();
    while (1) {
        // 하드웨어 타이머에 의해 CPU 개입 없이 실시간 신호 출력 유지
    }
}`;
  }, [frequencyHz, dutyCyclePct, currentProfile.name]);

  const copyCodeToClipboard = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/30 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-md shadow-amber-500/10">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-white tracking-tight">
                GPIO Visualizer (D3 디지털 신호 타이밍 다이어그램)
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                D3.js SVG Vector Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              사용자가 설정한 주파수(<span className="font-mono text-amber-400 font-semibold">{formatFrequency(frequencyHz)}</span>) 및 듀티비(<span className="font-mono text-amber-400 font-semibold">{dutyCyclePct}%</span>)에 따른 실시간 디지털 펄스 전이 타이밍과 전기적 파라미터를 시각화합니다.
            </p>
          </div>
        </div>

        {/* Play/Pause & Cycle Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
              isPlaying
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? '스윕 정지 (Pause)' : '실시간 스윕 (Run)'}
          </button>

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <span className="text-[10px] text-slate-500 px-2 font-sans font-semibold">표시 주기:</span>
            {[1, 2, 3, 4, 6].map((cycles) => (
              <button
                key={cycles}
                onClick={() => setDisplayCycles(cycles)}
                className={`px-2 py-0.5 rounded-lg text-xs transition ${
                  displayCycles === cycles
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cycles}T
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main D3 Chart Canvas Area */}
      <div ref={containerRef} className="relative bg-slate-950 rounded-2xl border border-slate-800 p-4 shadow-inner overflow-hidden">
        {/* Top Info Overlay Badge */}
        <div className="absolute top-3 left-4 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>F: <strong className="text-amber-400">{formatFrequency(frequencyHz)}</strong></span>
            <span className="text-slate-600">|</span>
            <span>Duty: <strong className="text-amber-400">{dutyCyclePct}%</strong></span>
            <span className="text-slate-600">|</span>
            <span>Period: <strong className="text-white">{formatTime(periodSec)}</strong></span>
            <span className="text-slate-600">|</span>
            <span>Level: <strong className="text-emerald-400">{voltageLevel}V</strong></span>
          </div>
        </div>

        {/* Svg rendered by D3 */}
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full select-none"
        />

        {/* View Options Toggle Pill Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2 border-t border-slate-900 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
              <input
                type="checkbox"
                checked={showInvertedChannel}
                onChange={(e) => setShowInvertedChannel(e.target.checked)}
                className="accent-cyan-500 rounded cursor-pointer"
              />
              <span className="text-[11px]">상보적 반전 신호(CH2 ~PWM) 표시</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
              <input
                type="checkbox"
                checked={showClockTicks}
                onChange={(e) => setShowClockTicks(e.target.checked)}
                className="accent-indigo-500 rounded cursor-pointer"
              />
              <span className="text-[11px]">16MHz CPU 머신 클럭 틱 표시</span>
            </label>

            <button
              onClick={() => setTransitionMode(transitionMode === 'realistic' ? 'ideal' : 'realistic')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                transitionMode === 'realistic'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {transitionMode === 'realistic' ? '실제 RC 슬루율 곡선 (15ns)' : '이상적 스텝 사각파'}
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-500">
            1 클럭 주기 @ 16MHz = 62.5 ns
          </div>
        </div>
      </div>

      {/* Interactive Controls & Real-Time Parameter Adjustments */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Sliders & Quick Buttons */}
        <div className="lg:col-span-7 space-y-5 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-2 text-sm font-bold text-white mb-1">
            <Sliders className="w-4 h-4 text-amber-400" />
            GPIO 신호 생성 파라미터 조절
          </div>

          {/* Frequency Control */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                신호 주파수 (Frequency)
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="10"
                  max="8000000"
                  value={frequencyHz}
                  onChange={(e) => handleFrequencyChange(Number(e.target.value))}
                  className="w-28 px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-amber-400 text-right focus:border-amber-400 focus:outline-none"
                />
                <span className="text-xs text-slate-400 font-mono">Hz</span>
              </div>
            </div>

            {/* Slider with Logarithmic feel */}
            <input
              type="range"
              min="1"
              max="6.9"
              step="0.01"
              value={Math.log10(frequencyHz)}
              onChange={(e) => handleFrequencyChange(Math.round(Math.pow(10, Number(e.target.value))))}
              className="w-full accent-amber-500 cursor-pointer"
            />

            {/* Quick Frequency Preset Buttons */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {frequencyPresets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handleFrequencyChange(preset.value)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono border transition ${
                    frequencyHz === preset.value
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                  title={preset.desc}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duty Cycle Control */}
          <div className="space-y-2 pt-3 border-t border-slate-800/80">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                듀티 사이클 (Duty Cycle)
              </span>
              <span className="font-mono text-sm font-bold text-amber-400">
                {dutyCyclePct.toFixed(1)} %
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={dutyCyclePct}
              onChange={(e) => handleDutyCycleChange(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />

            {/* Quick Duty Presets */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">빠른 설정:</span>
              {dutyPresets.map((duty) => (
                <button
                  key={duty}
                  onClick={() => handleDutyCycleChange(duty)}
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-mono border transition ${
                    Math.abs(dutyCyclePct - duty) < 0.1
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {duty}%
                </button>
              ))}
            </div>
          </div>

          {/* Voltage Reference Switch */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
            <span className="text-slate-300 font-semibold">로직 전압 기준 (VCC)</span>
            <div className="flex gap-2">
              {[5.0, 3.3].map((v) => (
                <button
                  key={v}
                  onClick={() => setVoltageLevel(v)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition ${
                    voltageLevel === v
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {v}V TTL/CMOS
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Quantitative Timing Metrics Table */}
        <div className="lg:col-span-5 space-y-4 bg-slate-950/60 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-white mb-3">
              <Zap className="w-4 h-4 text-emerald-400" />
              실시간 전기적 & 타이밍 계측치
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">신호 주기 (T = 1/f)</span>
                <span className="font-bold text-white">{formatTime(periodSec)}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">하이 펄스 폭 (T_HIGH)</span>
                <span className="font-bold text-amber-400">{formatTime(highTimeSec)}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">로우 펄스 폭 (T_LOW)</span>
                <span className="font-bold text-slate-300">{formatTime(lowTimeSec)}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">16MHz 머신 클럭 주기수</span>
                <span className="font-bold text-indigo-300">
                  {cyclesPerPeriod >= 1 ? `${cyclesPerPeriod.toLocaleString()} 사이클` : '< 1 사이클 (한계 초과)'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">평균 직류 전압 (V_AVG)</span>
                <span className="font-bold text-emerald-400">{avgVoltage.toFixed(2)} V</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">실효 전압 (V_RMS)</span>
                <span className="font-bold text-cyan-400">{rmsVoltage.toFixed(2)} V</span>
              </div>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              AVR의 <code className="text-amber-300 font-mono">sbi/cbi</code> 명령어는 각각 2클럭(125ns)을 소모하므로, 순수 소프트웨어 토글의 물리적 한계는 <strong>4 MHz</strong>입니다. 그 이상의 고속 신호는 16-bit 하드웨어 타이머(OCxA) 모드로 생성해야 지터가 발생하지 않습니다.
            </span>
          </div>
        </div>
      </div>

      {/* Bare-Metal C Implementation Code Snippet */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Cpu className="w-4 h-4 text-amber-400" />
            선택된 주파수/듀티비에 최적화된 bare-metal AVR-GCC Timer1 C 코드
          </div>
          <button
            onClick={copyCodeToClipboard}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 transition flex items-center gap-1.5"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedCode ? '복사 완료' : '코드 복사'}
          </button>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed border border-slate-800 max-h-56">
          <pre>{generatedCCode}</pre>
        </div>
      </div>
    </div>
  );
};
