import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Activity,
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Download,
  Settings2,
  Sliders,
  Clock,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
  Copy,
  Check,
  Search,
  Eye,
  EyeOff,
  Filter,
  BarChart2,
  Terminal,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

export interface ChannelConfig {
  id: number;
  name: string;
  pin: string;
  color: string;
  enabled: boolean;
  inverted: boolean;
  role: string; // e.g., 'SCK', 'MOSI', 'MISO', 'CS' or 'SCL', 'SDA'
}

export type ProtocolPresetType = 'spi' | 'i2c' | 'uart' | 'stepper' | 'interrupt_latency' | 'custom';

export interface DecodedPacket {
  id: number;
  timestampNs: number;
  protocol: string;
  channel: string;
  dataHex: string;
  dataAscii?: string;
  dataDec?: number;
  type: 'start' | 'data' | 'address' | 'ack' | 'nack' | 'stop' | 'sync' | 'trigger' | 'error';
  desc: string;
  latencyNs: number;
  latencyCycles: number;
}

interface Props {
  selectedMCU: SupportedMCU;
  isOpen?: boolean;
  onClose?: () => void;
}

// Standard AVR Clock Speeds
const AVR_CLOCK_SPEEDS = [
  { label: '20.0 MHz (50.0 ns / cycle)', valueHz: 20000000, cycleTimeNs: 50.0, note: 'ATmega328P/640 최고 스펙' },
  { label: '16.0 MHz (62.5 ns / cycle)', valueHz: 16000000, cycleTimeNs: 62.5, note: 'Arduino Uno / Mega 표준 크리스탈' },
  { label: '12.0 MHz (83.3 ns / cycle)', valueHz: 12000000, cycleTimeNs: 83.33, note: 'V-USB 소프트웨어 USB 클럭' },
  { label: '8.0 MHz (125.0 ns / cycle)', valueHz: 8000000, cycleTimeNs: 125.0, note: '내부 RC 오실레이터 / 3.3V 저전력' },
  { label: '4.0 MHz (250.0 ns / cycle)', valueHz: 4000000, cycleTimeNs: 250.0, note: '저전력 크리스탈 세팅' },
  { label: '1.0 MHz (1000.0 ns / cycle)', valueHz: 1000000, cycleTimeNs: 1000.0, note: '공장 출고 초기값 (CKDIV8=0)' }
];

// Timebase options for Logic Analyzer (time per major division)
const TIMEBASE_OPTIONS = [
  { label: '20 ns/div', valueNs: 20 },
  { label: '50 ns/div', valueNs: 50 },
  { label: '100 ns/div', valueNs: 100 },
  { label: '200 ns/div', valueNs: 200 },
  { label: '500 ns/div', valueNs: 500 },
  { label: '1.0 µs/div', valueNs: 1000 },
  { label: '2.0 µs/div', valueNs: 2000 },
  { label: '5.0 µs/div', valueNs: 5000 },
  { label: '10 µs/div', valueNs: 10000 },
  { label: '20 µs/div', valueNs: 20000 },
  { label: '50 µs/div', valueNs: 50000 },
  { label: '100 µs/div', valueNs: 100000 },
  { label: '200 µs/div', valueNs: 200000 },
  { label: '500 µs/div', valueNs: 500000 },
  { label: '1.0 ms/div', valueNs: 1000000 }
];

const CHANNEL_COLORS = [
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#3b82f6', // Blue
  '#14b8a6', // Teal
  '#f43f5e'  // Rose
];

export const VirtualLogicAnalyzer: React.FC<Props> = ({
  selectedMCU,
  isOpen = true,
  onClose
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Logic Analyzer Running State
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [triggerArmed, setTriggerArmed] = useState<boolean>(false);
  const [triggerFired, setTriggerFired] = useState<boolean>(true);
  const [runMode, setRunMode] = useState<'run' | 'single' | 'stop'>('run');

  // MCU Clock & Hardware Specs
  const [clockSpeedHz, setClockSpeedHz] = useState<number>(16000000); // 16 MHz default
  const [loadCapacitancePf, setLoadCapacitancePf] = useState<number>(30); // 30 pF capacitive load
  const [slewDisplayMode, setSlewDisplayMode] = useState<'ideal' | 'realistic'>('realistic');

  // Active Protocol Preset
  const [activePreset, setActivePreset] = useState<ProtocolPresetType>('spi');
  const [sampleRateMsps, setSampleRateMsps] = useState<number>(100); // 100 MSa/s virtual sampling

  // Timebase & Horizontal Window
  const [timebaseNs, setTimebaseNs] = useState<number>(500); // 500 ns/div default
  const [scrollOffsetNs, setScrollOffsetNs] = useState<number>(0);
  const [totalWindowNs, setTotalWindowNs] = useState<number>(5000); // 5 µs window

  // Trigger Configuration
  const [triggerChannel, setTriggerChannel] = useState<number>(0);
  const [triggerEdge, setTriggerEdge] = useState<'rising' | 'falling' | 'any'>('falling');
  const [preTriggerPct, setPreTriggerPct] = useState<number>(20); // 20% pre-trigger

  // Cursors
  const [showCursors, setShowCursors] = useState<boolean>(true);
  const [cursorANs, setCursorANs] = useState<number>(1000);
  const [cursorBNs, setCursorBNs] = useState<number>(3200);
  const [isDraggingCursor, setIsDraggingCursor] = useState<'A' | 'B' | null>(null);

  // Active Screen Tab
  const [activeTab, setActiveTab] = useState<'diagram' | 'packets' | 'measurements' | 'latency_analysis'>('diagram');
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [copiedVcd, setCopiedVcd] = useState<boolean>(false);

  // Canvas Reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Clock cycle period in nanoseconds
  const cycleTimeNs = useMemo(() => (1e9 / clockSpeedHz), [clockSpeedHz]);

  // AVR Hardware I/O Slew Rate & Propagation Delay calculations
  // AVR Output driver impedance Ron is ~25 Ohm (5V) to 40 Ohm (3V).
  // t_rise (10% to 90%) = 2.2 * Ron * Cload + intrinsic Gate Delay (~3ns)
  const hardwareTransitionMetrics = useMemo(() => {
    const rDriver = 30; // 30 ohms typical for ATmega output buffer
    const tRiseFallNs = 2.2 * rDriver * (loadCapacitancePf * 1e-12) * 1e9 + 4.5;
    const sbiCbiCycles = 2; // AVR instruction: sbi/cbi takes 2 clock cycles
    const sbiCbiLatencyNs = sbiCbiCycles * cycleTimeNs;
    const outPortCycles = 1; // AVR instruction: out PORTx, rXX takes 1 clock cycle
    const outPortLatencyNs = outPortCycles * cycleTimeNs;
    const pinSyncDelayNs = 1.25 * cycleTimeNs; // Input synchronization pipeline delay
    const isrEntryHardwareCycles = 4; // 4 cycles hardware push PC + jump to vector table
    const isrEntryHardwareNs = isrEntryHardwareCycles * cycleTimeNs;

    return {
      tRiseFallNs: Number(tRiseFallNs.toFixed(2)),
      sbiCbiCycles,
      sbiCbiLatencyNs: Number(sbiCbiLatencyNs.toFixed(1)),
      outPortCycles,
      outPortLatencyNs: Number(outPortLatencyNs.toFixed(1)),
      pinSyncDelayNs: Number(pinSyncDelayNs.toFixed(1)),
      isrEntryHardwareCycles,
      isrEntryHardwareNs: Number(isrEntryHardwareNs.toFixed(1))
    };
  }, [loadCapacitancePf, cycleTimeNs]);

  // Default Pin mapping according to selected MCU & Preset
  const defaultChannels = useMemo<ChannelConfig[]>(() => {
    const is640 = selectedMCU === 'atmega640';
    const is128 = selectedMCU === 'atmega128';

    if (activePreset === 'spi') {
      return [
        { id: 0, name: 'SCK (Clock)', pin: is640 ? 'PB1 (SCK)' : is128 ? 'PB1 (SCK)' : 'PB5 (SCK/D13)', color: CHANNEL_COLORS[0], enabled: true, inverted: false, role: 'Clock' },
        { id: 1, name: 'MOSI (Master Out)', pin: is640 ? 'PB2 (MOSI)' : is128 ? 'PB2 (MOSI)' : 'PB3 (MOSI/D11)', color: CHANNEL_COLORS[1], enabled: true, inverted: false, role: 'Data TX' },
        { id: 2, name: 'MISO (Slave Out)', pin: is640 ? 'PB3 (MISO)' : is128 ? 'PB3 (MISO)' : 'PB4 (MISO/D12)', color: CHANNEL_COLORS[2], enabled: true, inverted: false, role: 'Data RX' },
        { id: 3, name: 'CS / SS (Chip Select)', pin: is640 ? 'PB0 (SS)' : is128 ? 'PB0 (SS)' : 'PB2 (SS/D10)', color: CHANNEL_COLORS[3], enabled: true, inverted: false, role: 'Enable' },
        { id: 4, name: 'D4 (IRQ / Busy)', pin: is640 ? 'PE4 (INT4)' : is128 ? 'PD0 (INT0)' : 'PD2 (INT0/D2)', color: CHANNEL_COLORS[4], enabled: false, inverted: false, role: 'Strobe' },
        { id: 5, name: 'D5 (Spare)', pin: is640 ? 'PG0' : is128 ? 'PE2' : 'PD4 (D4)', color: CHANNEL_COLORS[5], enabled: false, inverted: false, role: 'GPIO' },
        { id: 6, name: 'D6 (Spare)', pin: is640 ? 'PG1' : is128 ? 'PE3' : 'PD5 (D5)', color: CHANNEL_COLORS[6], enabled: false, inverted: false, role: 'GPIO' },
        { id: 7, name: 'D7 (Debug Pulse)', pin: is640 ? 'PB7' : is128 ? 'PB7' : 'PD7 (D7)', color: CHANNEL_COLORS[7], enabled: false, inverted: false, role: 'Debug' }
      ];
    } else if (activePreset === 'i2c') {
      return [
        { id: 0, name: 'SCL (TWI Clock)', pin: is640 ? 'PD0 (SCL)' : is128 ? 'PD0 (SCL)' : 'PC5 (SCL/A5)', color: CHANNEL_COLORS[0], enabled: true, inverted: false, role: 'Clock' },
        { id: 1, name: 'SDA (TWI Data)', pin: is640 ? 'PD1 (SDA)' : is128 ? 'PD1 (SDA)' : 'PC4 (SDA/A4)', color: CHANNEL_COLORS[1], enabled: true, inverted: false, role: 'Bi-dir Data' },
        { id: 2, name: 'INT / ALERT', pin: is640 ? 'PD2 (INT2)' : is128 ? 'PD2 (INT2)' : 'PD2 (INT0/D2)', color: CHANNEL_COLORS[2], enabled: true, inverted: false, role: 'Sensor IRQ' },
        { id: 3, name: 'PWR_EN (Vdd Gate)', pin: is640 ? 'PA0' : is128 ? 'PA0' : 'PB0 (D8)', color: CHANNEL_COLORS[3], enabled: false, inverted: false, role: 'Control' },
        { id: 4, name: 'D4 (Pullup Mon)', pin: is640 ? 'PA1' : is128 ? 'PA1' : 'PB1 (D9)', color: CHANNEL_COLORS[4], enabled: false, inverted: false, role: 'Monitor' },
        { id: 5, name: 'D5 (Spare)', pin: is640 ? 'PA2' : is128 ? 'PA2' : 'PD3 (D3)', color: CHANNEL_COLORS[5], enabled: false, inverted: false, role: 'GPIO' },
        { id: 6, name: 'D6 (Spare)', pin: is640 ? 'PA3' : is128 ? 'PA3' : 'PD6 (D6)', color: CHANNEL_COLORS[6], enabled: false, inverted: false, role: 'GPIO' },
        { id: 7, name: 'D7 (Heartbeat)', pin: is640 ? 'PB7' : is128 ? 'PB7' : 'PD7 (D7)', color: CHANNEL_COLORS[7], enabled: false, inverted: false, role: 'Status' }
      ];
    } else if (activePreset === 'uart') {
      return [
        { id: 0, name: 'TXD (Transmitter)', pin: is640 ? 'PE1 (TXD0)' : is128 ? 'PE1 (TXD0)' : 'PD1 (TXD/D1)', color: CHANNEL_COLORS[0], enabled: true, inverted: false, role: 'Async TX' },
        { id: 1, name: 'RXD (Receiver)', pin: is640 ? 'PE0 (RXD0)' : is128 ? 'PE0 (RXD0)' : 'PD0 (RXD/D0)', color: CHANNEL_COLORS[1], enabled: true, inverted: false, role: 'Async RX' },
        { id: 2, name: 'RTS / CTS (Flow)', pin: is640 ? 'PE2' : is128 ? 'PE2' : 'PD2 (D2)', color: CHANNEL_COLORS[2], enabled: true, inverted: false, role: 'Flow Control' },
        { id: 3, name: 'UDRE Interrupt', pin: is640 ? 'PB4' : is128 ? 'PB4' : 'PD4 (D4)', color: CHANNEL_COLORS[3], enabled: true, inverted: false, role: 'ISR Strobe' },
        { id: 4, name: 'D4 (Spare)', pin: is640 ? 'PC0' : is128 ? 'PC0' : 'PD5 (D5)', color: CHANNEL_COLORS[4], enabled: false, inverted: false, role: 'GPIO' },
        { id: 5, name: 'D5 (Spare)', pin: is640 ? 'PC1' : is128 ? 'PC1' : 'PD6 (D6)', color: CHANNEL_COLORS[5], enabled: false, inverted: false, role: 'GPIO' },
        { id: 6, name: 'D6 (Spare)', pin: is640 ? 'PC2' : is128 ? 'PC2' : 'PB0 (D8)', color: CHANNEL_COLORS[6], enabled: false, inverted: false, role: 'GPIO' },
        { id: 7, name: 'D7 (Frame Err)', pin: is640 ? 'PC3' : is128 ? 'PC3' : 'PB5 (D13)', color: CHANNEL_COLORS[7], enabled: false, inverted: false, role: 'Error Flag' }
      ];
    } else if (activePreset === 'interrupt_latency') {
      return [
        { id: 0, name: 'EXT_INT (Pin IRQ)', pin: is640 ? 'PD0 (INT0)' : is128 ? 'PD0 (INT0)' : 'PD2 (INT0/D2)', color: CHANNEL_COLORS[0], enabled: true, inverted: false, role: 'Trigger Edge' },
        { id: 1, name: 'ISR_ENTRY (SBI)', pin: is640 ? 'PB5 (OC1A)' : is128 ? 'PB4 (OC0)' : 'PB5 (D13 LED)', color: CHANNEL_COLORS[1], enabled: true, inverted: false, role: 'First ISR Op' },
        { id: 2, name: 'TIMER0_OVF (Tick)', pin: is640 ? 'PB4 (OC0A)' : is128 ? 'PB4 (OC0)' : 'PD6 (OC0A/D6)', color: CHANNEL_COLORS[2], enabled: true, inverted: false, role: 'SysTick OVF' },
        { id: 3, name: 'MAIN_TASK_SYNC', pin: is640 ? 'PA0' : is128 ? 'PA0' : 'PB0 (D8)', color: CHANNEL_COLORS[3], enabled: true, inverted: false, role: 'Main Loop' },
        { id: 4, name: 'D4 (Jitter Trace)', pin: is640 ? 'PA1' : is128 ? 'PA1' : 'PB1 (D9)', color: CHANNEL_COLORS[4], enabled: false, inverted: false, role: 'Jitter' },
        { id: 5, name: 'D5 (ADC Trigger)', pin: is640 ? 'PF0 (ADC0)' : is128 ? 'PF0 (ADC0)' : 'PC0 (A0)', color: CHANNEL_COLORS[5], enabled: false, inverted: false, role: 'Analog Strobe' },
        { id: 6, name: 'D6 (EEPROM Busy)', pin: is640 ? 'PA2' : is128 ? 'PA2' : 'PD3 (D3)', color: CHANNEL_COLORS[6], enabled: false, inverted: false, role: 'NVM Lock' },
        { id: 7, name: 'D7 (Watchdog Pulse)', pin: is640 ? 'PB7' : is128 ? 'PB7' : 'PD7 (D7)', color: CHANNEL_COLORS[7], enabled: false, inverted: false, role: 'WDT Reset' }
      ];
    } else {
      // Custom / General 8-Channel
      return [
        { id: 0, name: 'Ch 0 (CLK / Step)', pin: is640 ? 'PB1' : is128 ? 'PB1' : 'PB5 (D13)', color: CHANNEL_COLORS[0], enabled: true, inverted: false, role: 'Signal' },
        { id: 1, name: 'Ch 1 (Data / Dir)', pin: is640 ? 'PB2' : is128 ? 'PB2' : 'PB4 (D12)', color: CHANNEL_COLORS[1], enabled: true, inverted: false, role: 'Signal' },
        { id: 2, name: 'Ch 2 (Strobe / En)', pin: is640 ? 'PB3' : is128 ? 'PB3' : 'PB3 (D11)', color: CHANNEL_COLORS[2], enabled: true, inverted: false, role: 'Control' },
        { id: 3, name: 'Ch 3 (IRQ Line)', pin: is640 ? 'PD0' : is128 ? 'PD0' : 'PD2 (D2)', color: CHANNEL_COLORS[3], enabled: true, inverted: false, role: 'Interrupt' },
        { id: 4, name: 'Ch 4 (PWM 1)', pin: is640 ? 'PB4' : is128 ? 'PB4' : 'PD3 (D3)', color: CHANNEL_COLORS[4], enabled: true, inverted: false, role: 'PWM' },
        { id: 5, name: 'Ch 5 (PWM 2)', pin: is640 ? 'PB5' : is128 ? 'PB5' : 'PD5 (D5)', color: CHANNEL_COLORS[5], enabled: true, inverted: false, role: 'PWM' },
        { id: 6, name: 'Ch 6 (Flag A)', pin: is640 ? 'PB6' : is128 ? 'PB6' : 'PD6 (D6)', color: CHANNEL_COLORS[6], enabled: true, inverted: false, role: 'Flag' },
        { id: 7, name: 'Ch 7 (Flag B)', pin: is640 ? 'PB7' : is128 ? 'PB7' : 'PD7 (D7)', color: CHANNEL_COLORS[7], enabled: true, inverted: false, role: 'Flag' }
      ];
    }
  }, [selectedMCU, activePreset]);

  const [channels, setChannels] = useState<ChannelConfig[]>(defaultChannels);

  // Sync channels on preset or MCU change
  useEffect(() => {
    setChannels(defaultChannels);
  }, [defaultChannels]);

  // Simulation time frame / live tick state
  const [animTimeOffset, setAnimTimeOffset] = useState<number>(0);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setAnimTimeOffset(prev => (prev + 35) % 100000);
    }, 40);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Generate Digital Signal Waveforms based on Active Preset & Clock Latencies
  const signalData = useMemo(() => {
    // We simulate samples along the timeline from t = 0 to totalWindowNs
    // Sampling resolution: step of 5 ns or 10 ns
    const numSamples = 1000;
    const stepNs = totalWindowNs / numSamples;
    const clkNs = cycleTimeNs; // AVR clock period

    // Arrays for each channel 0-7
    const samples: number[][] = Array.from({ length: 8 }, () => new Array(numSamples).fill(0));
    const decodedPacketsList: DecodedPacket[] = [];

    const phaseOffset = animTimeOffset;

    if (activePreset === 'spi') {
      // SPI Mode 0: SCK idle low, data sampled on rising edge, shifted on falling edge
      // SS active low
      const sckPeriodNs = 4 * clkNs; // SPI clock = Fosc / 4 (e.g. 250ns @ 16MHz)
      const byteTransferTimeNs = 8 * sckPeriodNs;
      const csLeadLagNs = 2 * clkNs; // AVR SS setup time: 2 clock cycles

      // Mock SPI transaction: Master writes 0x9F (Read ID), Slave replies 0x1F
      const mosiByte = 0x9f; // 10011111 (MSB first)
      const misoByte = 0x1f; // 00011111 (MSB first)

      const startOffset = ((phaseOffset * 2) % (totalWindowNs * 1.5)) - 500;

      for (let i = 0; i < numSamples; i++) {
        const t = i * stepNs;
        const relT = t - startOffset;

        // CS: Active Low during byte transfer
        const csActive = relT >= csLeadLagNs && relT <= (csLeadLagNs + byteTransferTimeNs + csLeadLagNs);
        samples[3][i] = csActive ? 0 : 1;

        if (relT >= csLeadLagNs && relT < (csLeadLagNs + byteTransferTimeNs)) {
          const bitIndex = Math.floor((relT - csLeadLagNs) / sckPeriodNs);
          const bitPhase = (relT - csLeadLagNs) % sckPeriodNs;

          // SCK
          samples[0][i] = bitPhase < sckPeriodNs / 2 ? 0 : 1;

          // MOSI: MSB first (bit 7 down to 0)
          const mosiBit = (mosiByte >> (7 - Math.min(bitIndex, 7))) & 1;
          samples[1][i] = mosiBit;

          // MISO: MSB first
          const misoBit = (misoByte >> (7 - Math.min(bitIndex, 7))) & 1;
          samples[2][i] = misoBit;
        } else {
          samples[0][i] = 0; // SCK idle low
          samples[1][i] = 1; // MOSI idle high
          samples[2][i] = 1; // MISO idle high/pullup
        }

        // Hardware SBI latency on IRQ pin (Ch 4)
        samples[4][i] = (relT >= (csLeadLagNs + byteTransferTimeNs + hardwareTransitionMetrics.sbiCbiLatencyNs)) ? 1 : 0;
      }

      // Add decoded packet entries
      decodedPacketsList.push({
        id: 1,
        timestampNs: Math.round(startOffset + csLeadLagNs),
        protocol: 'SPI (Mode 0)',
        channel: 'MOSI / MISO',
        dataHex: '0x9F',
        dataAscii: 'RDID',
        dataDec: 159,
        type: 'data',
        desc: 'Master TX: Flash JEDEC ID Command (0x9F)',
        latencyNs: Number(hardwareTransitionMetrics.sbiCbiLatencyNs.toFixed(1)),
        latencyCycles: 2
      });

      decodedPacketsList.push({
        id: 2,
        timestampNs: Math.round(startOffset + csLeadLagNs + sckPeriodNs * 4),
        protocol: 'SPI (Mode 0)',
        channel: 'MISO',
        dataHex: '0x1F',
        dataAscii: 'Adesto',
        dataDec: 31,
        type: 'data',
        desc: 'Slave RX: Manufacturer ID Response (0x1F)',
        latencyNs: Number((4 * clkNs).toFixed(1)),
        latencyCycles: 4
      });

    } else if (activePreset === 'i2c') {
      // I2C 400kHz Fast-mode (Period = 2.5 µs = 2500 ns)
      const sclPeriodNs = 2500;
      const startOffset = ((phaseOffset * 2.2) % (totalWindowNs * 1.8)) - 800;

      for (let i = 0; i < numSamples; i++) {
        const t = i * stepNs;
        const relT = t - startOffset;

        // START Condition: SDA drops while SCL is High
        if (relT < 0) {
          samples[0][i] = 1; // SCL High
          samples[1][i] = 1; // SDA High
        } else if (relT >= 0 && relT < 400) {
          samples[0][i] = 1; // SCL stays High
          samples[1][i] = 0; // SDA pulled LOW -> START condition!
        } else if (relT >= 400 && relT < 3600) {
          // Address 0x68 (0b1101000) + W (0) + ACK (0)
          const bitT = relT - 400;
          const bitIndex = Math.floor(bitT / 350);
          const bitPhase = bitT % 350;

          // SCL toggle
          samples[0][i] = bitPhase < 175 ? 0 : 1;

          // SDA bits: [1, 1, 0, 1, 0, 0, 0, 0 (W), 0 (ACK)]
          const addrBits = [1, 1, 0, 1, 0, 0, 0, 0, 0];
          const currBit = bitIndex < addrBits.length ? addrBits[bitIndex] : 1;
          samples[1][i] = currBit;
        } else if (relT >= 3600 && relT < 4200) {
          // STOP condition: SDA rises while SCL is High
          samples[0][i] = 1;
          samples[1][i] = relT > 3900 ? 1 : 0;
        } else {
          samples[0][i] = 1;
          samples[1][i] = 1;
        }

        // INT alert line
        samples[2][i] = (relT > 1000 && relT < 2800) ? 0 : 1;
      }

      decodedPacketsList.push({
        id: 1,
        timestampNs: Math.round(startOffset),
        protocol: 'I2C / TWI',
        channel: 'SDA / SCL',
        dataHex: 'START',
        type: 'start',
        desc: 'I2C START Condition detected (SDA falling while SCL=1)',
        latencyNs: 0,
        latencyCycles: 0
      });

      decodedPacketsList.push({
        id: 2,
        timestampNs: Math.round(startOffset + 400),
        protocol: 'I2C / TWI',
        channel: 'SDA',
        dataHex: '0x68 + W',
        dataAscii: 'RTC/IMU',
        dataDec: 104,
        type: 'address',
        desc: 'Slave Address 0x68 (DS3231 / MPU6050) + Write Bit',
        latencyNs: Number((hardwareTransitionMetrics.pinSyncDelayNs).toFixed(1)),
        latencyCycles: 1
      });

      decodedPacketsList.push({
        id: 3,
        timestampNs: Math.round(startOffset + 3200),
        protocol: 'I2C / TWI',
        channel: 'SDA',
        dataHex: 'ACK (0)',
        type: 'ack',
        desc: 'Slave Acknowledged address transmission (SDA pulled Low)',
        latencyNs: Number((clkNs).toFixed(1)),
        latencyCycles: 1
      });

    } else if (activePreset === 'uart') {
      // UART 115200 baud -> 1 bit = 8.68 µs = 8680 ns (scaled for 5µs view to ~800ns for clarity)
      const bitNs = 600; // Fast UART simulation time window
      const startOffset = ((phaseOffset * 2) % (totalWindowNs * 1.5)) - 400;

      // Byte: 'A' = 0x41 = 0b01000001
      // Framing: Start (0), Bit 0 (1), Bit 1 (0), Bit 2 (0), Bit 3 (0), Bit 4 (0), Bit 5 (0), Bit 6 (1), Bit 7 (0), Stop (1)
      const uartBits = [0, 1, 0, 0, 0, 0, 0, 1, 0, 1];

      for (let i = 0; i < numSamples; i++) {
        const t = i * stepNs;
        const relT = t - startOffset;

        if (relT < 0 || relT >= (uartBits.length * bitNs)) {
          samples[0][i] = 1; // TXD Idle HIGH
          samples[1][i] = 1; // RXD Idle HIGH
          samples[2][i] = 0; // RTS Active Low (0 = Clear)
          samples[3][i] = 0; // UDRE ISR Idle
        } else {
          const bitIdx = Math.floor(relT / bitNs);
          samples[0][i] = uartBits[Math.min(bitIdx, uartBits.length - 1)];
          // RX echo delayed by 3 bits
          const rxBitIdx = bitIdx - 3;
          samples[1][i] = (rxBitIdx >= 0 && rxBitIdx < uartBits.length) ? uartBits[rxBitIdx] : 1;
          samples[2][i] = 0;
          // UDRE Interrupt fires when UDR register becomes empty (at start of stop bit)
          samples[3][i] = (bitIdx === 8) ? 1 : 0;
        }
      }

      decodedPacketsList.push({
        id: 1,
        timestampNs: Math.round(startOffset),
        protocol: 'USART (Async)',
        channel: 'TXD0',
        dataHex: '0x41',
        dataAscii: "'A'",
        dataDec: 65,
        type: 'data',
        desc: "ASCII Character 'A' (8-N-1 format, LSB first)",
        latencyNs: Number(hardwareTransitionMetrics.outPortLatencyNs.toFixed(1)),
        latencyCycles: 1
      });

    } else if (activePreset === 'interrupt_latency') {
      // AVR Hardware Interrupt Latency Simulation:
      // 1. External pin INT0 falls (0 ns)
      // 2. Hardware Synchronization (1.5 cycles) + 4-cycle PC push & Vector Jump = ~5.5 cycles (~344 ns @ 16MHz)
      // 3. ISR Entry: First instruction `sbi PORTB, 5` (2 cycles = 125 ns)
      // 4. Pin flips HIGH at t = 5.5 + 2 = 7.5 cycles (468.75 ns @ 16MHz)
      const triggerTimeNs = 800;
      const isrVectorLatencyNs = hardwareTransitionMetrics.isrEntryHardwareNs + hardwareTransitionMetrics.pinSyncDelayNs;
      const sbiExecutionLatencyNs = hardwareTransitionMetrics.sbiCbiLatencyNs;
      const totalTurnaroundNs = isrVectorLatencyNs + sbiExecutionLatencyNs;

      for (let i = 0; i < numSamples; i++) {
        const t = i * stepNs;

        // Ch 0: External Interrupt INT0 Pin (Falling Edge trigger)
        samples[0][i] = t < triggerTimeNs ? 1 : 0;

        // Ch 1: ISR Port Toggle (PB5 / D13) flips high after hardware vector jump + prologue SBI
        samples[1][i] = (t >= (triggerTimeNs + totalTurnaroundNs) && t < (triggerTimeNs + totalTurnaroundNs + 1800)) ? 1 : 0;

        // Ch 2: Timer0 1kHz Tick Overlap
        const timerPhase = (t + animTimeOffset * 10) % 2000;
        samples[2][i] = timerPhase < 800 ? 1 : 0;

        // Ch 3: Main task loop activity (interrupted during ISR)
        const isrActive = t >= triggerTimeNs && t < (triggerTimeNs + totalTurnaroundNs + 1800);
        samples[3][i] = isrActive ? 0 : ((t % 500) < 250 ? 1 : 0);
      }

      decodedPacketsList.push({
        id: 1,
        timestampNs: triggerTimeNs,
        protocol: 'AVR Core',
        channel: 'INT0 Pin',
        dataHex: 'EXT_INT0',
        type: 'trigger',
        desc: 'External Interrupt Pin Falling Edge Trigger detected',
        latencyNs: 0,
        latencyCycles: 0
      });

      decodedPacketsList.push({
        id: 2,
        timestampNs: Math.round(triggerTimeNs + isrVectorLatencyNs),
        protocol: 'AVR Core',
        channel: 'Core Vector',
        dataHex: '0x0002 JMP',
        type: 'sync',
        desc: `Vector Table Jump (4 Clocks Push PC + 1.25 Clock Pin Sync)`,
        latencyNs: Number(isrVectorLatencyNs.toFixed(1)),
        latencyCycles: 5.5
      });

      decodedPacketsList.push({
        id: 3,
        timestampNs: Math.round(triggerTimeNs + totalTurnaroundNs),
        protocol: 'AVR Core',
        channel: 'PORTB.5',
        dataHex: 'SBI PORTB,5',
        type: 'data',
        desc: `First ISR Instruction Executed (Total Latency: ${totalTurnaroundNs.toFixed(1)} ns)`,
        latencyNs: Number(totalTurnaroundNs.toFixed(1)),
        latencyCycles: Math.round(totalTurnaroundNs / clkNs)
      });

    } else {
      // Custom / Multi-channel square waves
      for (let ch = 0; ch < 8; ch++) {
        const periodCh = (ch + 1) * 300 * (clkNs / 62.5);
        for (let i = 0; i < numSamples; i++) {
          const t = i * stepNs + animTimeOffset * (ch + 1);
          samples[ch][i] = (t % periodCh) < (periodCh / 2) ? 1 : 0;
        }
      }
    }

    return {
      numSamples,
      stepNs,
      samples,
      decodedPacketsList
    };
  }, [totalWindowNs, cycleTimeNs, activePreset, animTimeOffset, hardwareTransitionMetrics]);

  // Measurements per active channel
  const channelMeasurements = useMemo(() => {
    return channels.map((ch, idx) => {
      const data = signalData.samples[idx];
      let highCount = 0;
      let edges = 0;
      for (let i = 0; i < data.length; i++) {
        if (data[i] === 1) highCount++;
        if (i > 0 && data[i] !== data[i - 1]) edges++;
      }
      const duty = Math.round((highCount / data.length) * 100);
      const estPeriodNs = edges >= 2 ? (totalWindowNs / (edges / 2)) : 0;
      const estFreqHz = estPeriodNs > 0 ? (1e9 / estPeriodNs) : 0;

      return {
        id: ch.id,
        name: ch.name,
        pin: ch.pin,
        enabled: ch.enabled,
        color: ch.color,
        duty,
        edges,
        periodNs: Number(estPeriodNs.toFixed(1)),
        freqHz: Math.round(estFreqHz),
        riseTimeNs: hardwareTransitionMetrics.tRiseFallNs,
        instrLatencyCycles: hardwareTransitionMetrics.sbiCbiCycles
      };
    });
  }, [channels, signalData, totalWindowNs, hardwareTransitionMetrics]);

  // Delta between Cursor A and Cursor B
  const cursorStats = useMemo(() => {
    const deltaNs = Math.abs(cursorBNs - cursorANs);
    const deltaCycles = deltaNs / cycleTimeNs;
    const freqKhz = deltaNs > 0 ? (1e6 / deltaNs) : 0;
    return {
      deltaNs: Number(deltaNs.toFixed(1)),
      deltaCycles: Number(deltaCycles.toFixed(2)),
      freqKhz: Number(freqKhz.toFixed(2))
    };
  }, [cursorANs, cursorBNs, cycleTimeNs]);

  // Render Logic Analyzer Timing Diagram onto Canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Grid Configuration
    const labelWidth = 160; // Left column for channel badges
    const graphWidth = width - labelWidth;
    const numDivisions = 10;
    const divWidth = graphWidth / numDivisions;

    // Draw Grid Lines (Vertical Time Grid)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i <= numDivisions; i++) {
      const x = labelWidth + i * divWidth;
      ctx.beginPath();
      ctx.moveTo(x, 24);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Top Time Marker Labels
      const timeValNs = scrollOffsetNs + (i / numDivisions) * totalWindowNs;
      ctx.fillStyle = '#64748b';
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      let timeText = `${Math.round(timeValNs)} ns`;
      if (timeValNs >= 1000) {
        timeText = `${(timeValNs / 1000).toFixed(2)} µs`;
      }
      ctx.fillText(timeText, x, 16);
    }

    // Top Header separator line
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(0, 24);
    ctx.lineTo(width, 24);
    ctx.stroke();

    // Active enabled channels
    const activeChannels = channels.filter(ch => ch.enabled);
    if (activeChannels.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('활성화된 채널이 없습니다. 좌측 패널에서 채널을 켜주세요.', width / 2, height / 2);
      return;
    }

    const availableHeight = height - 28;
    const trackHeight = Math.max(38, Math.min(65, availableHeight / activeChannels.length));
    const waveHeight = trackHeight * 0.55;

    // Draw each active channel's waveform
    activeChannels.forEach((ch, trackIndex) => {
      const topY = 28 + trackIndex * trackHeight;
      const baselineY = topY + trackHeight * 0.78;
      const highY = baselineY - waveHeight;

      // Track alternating background
      if (trackIndex % 2 === 1) {
        ctx.fillStyle = '#0f172a33';
        ctx.fillRect(0, topY, width, trackHeight);
      }

      // Track horizontal boundary
      ctx.strokeStyle = '#1e293b88';
      ctx.beginPath();
      ctx.moveTo(0, topY + trackHeight);
      ctx.lineTo(width, topY + trackHeight);
      ctx.stroke();

      // Channel Label Badge on Left
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(2, topY + 4, labelWidth - 8, trackHeight - 8);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(2, topY + 4, labelWidth - 8, trackHeight - 8);

      // Color accent pip
      ctx.fillStyle = ch.color;
      ctx.fillRect(6, topY + 8, 4, trackHeight - 16);

      // Text names
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(ch.name, 16, topY + 18);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(ch.pin, 16, topY + 32);

      // Waveform trace
      const channelRawData = signalData.samples[ch.id];
      if (!channelRawData) return;

      const numSamples = channelRawData.length;
      ctx.strokeStyle = ch.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = ch.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();

      let prevVal = channelRawData[0];
      const startY = prevVal === 1 ? highY : baselineY;
      ctx.moveTo(labelWidth, startY);

      // Draw digital trace with optional realistic slew
      for (let s = 1; s < numSamples; s++) {
        const val = channelRawData[s];
        const x = labelWidth + (s / numSamples) * graphWidth;
        const currentY = val === 1 ? highY : baselineY;

        if (val !== prevVal) {
          // Transition edge
          if (slewDisplayMode === 'realistic') {
            // Realistic AVR slew transition slope (e.g. 5-15ns)
            const slewPixels = Math.max(3, (hardwareTransitionMetrics.tRiseFallNs / totalWindowNs) * graphWidth);
            ctx.lineTo(x - slewPixels / 2, prevVal === 1 ? highY : baselineY);
            ctx.lineTo(x + slewPixels / 2, currentY);
          } else {
            // Instant crisp ideal square step
            ctx.lineTo(x, prevVal === 1 ? highY : baselineY);
            ctx.lineTo(x, currentY);
          }
          prevVal = val;
        } else {
          ctx.lineTo(x, currentY);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0; // reset shadow

      // Shaded area under High logic state
      ctx.save();
      ctx.fillStyle = `${ch.color}15`;
      ctx.beginPath();
      let inHigh = false;
      let highStartX = labelWidth;

      for (let s = 0; s < numSamples; s++) {
        const val = channelRawData[s];
        const x = labelWidth + (s / numSamples) * graphWidth;
        if (val === 1 && !inHigh) {
          inHigh = true;
          highStartX = x;
        } else if (val === 0 && inHigh) {
          inHigh = false;
          ctx.fillRect(highStartX, highY, x - highStartX, waveHeight);
        }
      }
      if (inHigh) {
        ctx.fillRect(highStartX, highY, labelWidth + graphWidth - highStartX, waveHeight);
      }
      ctx.restore();

      // Protocol Ribbon Overlay on channel if applicable
      if (activePreset === 'spi' && ch.id === 1) {
        // Draw byte ribbon over MOSI
        const bubbleX = labelWidth + graphWidth * 0.35;
        const bubbleW = graphWidth * 0.28;
        ctx.fillStyle = '#0284c7dd';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bubbleX, topY + 2, bubbleW, 14, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('0x9F (JEDEC RDID CMD)', bubbleX + bubbleW / 2, topY + 12);
      } else if (activePreset === 'i2c' && ch.id === 1) {
        // Draw I2C Address Ribbon
        const bubbleX = labelWidth + graphWidth * 0.22;
        const bubbleW = graphWidth * 0.38;
        ctx.fillStyle = '#059669dd';
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bubbleX, topY + 2, bubbleW, 14, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ADDR: 0x68 [W] + ACK (0)', bubbleX + bubbleW / 2, topY + 12);
      } else if (activePreset === 'interrupt_latency' && ch.id === 1) {
        // Highlight Latency Window
        const latStartX = labelWidth + (800 / totalWindowNs) * graphWidth;
        const latEndX = labelWidth + ((800 + hardwareTransitionMetrics.isrEntryHardwareNs + hardwareTransitionMetrics.sbiCbiLatencyNs) / totalWindowNs) * graphWidth;
        const latW = Math.max(12, latEndX - latStartX);

        ctx.fillStyle = '#dc262644';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(latStartX, topY - 2, latW, trackHeight + 4);
        ctx.setLineDash([]);

        ctx.fillStyle = '#fca5a5';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`ISR 대기: ${hardwareTransitionMetrics.isrEntryHardwareCycles + 2} 사이클`, latStartX + 4, topY + 12);
      }
    });

    // Draw Cursors A & B
    if (showCursors) {
      // Cursor A (Amber)
      const cursorAX = labelWidth + ((cursorANs - scrollOffsetNs) / totalWindowNs) * graphWidth;
      if (cursorAX >= labelWidth && cursorAX <= width) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(cursorAX, 0);
        ctx.lineTo(cursorAX, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Cursor A Flag Top
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.roundRect(cursorAX - 22, 2, 44, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`A:${Math.round(cursorANs)}ns`, cursorAX, 14);
      }

      // Cursor B (Purple)
      const cursorBX = labelWidth + ((cursorBNs - scrollOffsetNs) / totalWindowNs) * graphWidth;
      if (cursorBX >= labelWidth && cursorBX <= width) {
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(cursorBX, 0);
        ctx.lineTo(cursorBX, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Cursor B Flag Top
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.roundRect(cursorBX - 22, 2, 44, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`B:${Math.round(cursorBNs)}ns`, cursorBX, 14);
      }
    }
  }, [
    channels,
    signalData,
    scrollOffsetNs,
    totalWindowNs,
    slewDisplayMode,
    hardwareTransitionMetrics,
    showCursors,
    cursorANs,
    cursorBNs,
    activePreset
  ]);

  // Keep Canvas in sync with size & props
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth || 800;
      canvas.height = Math.max(340, channels.filter(c => c.enabled).length * 52 + 40);
      renderCanvas();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [channels, renderCanvas]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Handle Dragging Cursors on Canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const labelWidth = 160;
    const graphWidth = canvas.width - labelWidth;

    if (x < labelWidth) return;

    const clickedTimeNs = scrollOffsetNs + ((x - labelWidth) / graphWidth) * totalWindowNs;
    const distA = Math.abs(clickedTimeNs - cursorANs);
    const distB = Math.abs(clickedTimeNs - cursorBNs);

    if (distA < distB && distA < totalWindowNs * 0.1) {
      setIsDraggingCursor('A');
    } else if (distB <= distA && distB < totalWindowNs * 0.1) {
      setIsDraggingCursor('B');
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingCursor) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const labelWidth = 160;
    const graphWidth = canvas.width - labelWidth;

    const boundedX = Math.max(labelWidth, Math.min(canvas.width, x));
    const newTimeNs = scrollOffsetNs + ((boundedX - labelWidth) / graphWidth) * totalWindowNs;

    if (isDraggingCursor === 'A') {
      setCursorANs(Math.round(newTimeNs));
    } else if (isDraggingCursor === 'B') {
      setCursorBNs(Math.round(newTimeNs));
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCursor(null);
  };

  // Zoom Controls
  const handleZoomIn = () => {
    setTotalWindowNs(prev => Math.max(200, Math.round(prev * 0.7)));
  };

  const handleZoomOut = () => {
    setTotalWindowNs(prev => Math.min(50000, Math.round(prev * 1.4)));
  };

  const handleResetZoom = () => {
    setTotalWindowNs(5000);
    setScrollOffsetNs(0);
    setCursorANs(1000);
    setCursorBNs(3200);
  };

  // Channel Toggle
  const toggleChannel = (id: number) => {
    setChannels(prev =>
      prev.map(ch => (ch.id === id ? { ...ch, enabled: !ch.enabled } : ch))
    );
  };

  // Channel Inversion Toggle
  const toggleInvert = (id: number) => {
    setChannels(prev =>
      prev.map(ch => (ch.id === id ? { ...ch, inverted: !ch.inverted } : ch))
    );
  };

  // Export to VCD (Value Change Dump standard logic analyzer format for PulseView / GTKWave)
  const generateVcd = () => {
    let vcd = `$date\n  ${new Date().toISOString()}\n$end\n`;
    vcd += `$version\n  AVR-Studio Virtual Logic Analyzer v2.0\n$end\n`;
    vcd += `$timescale 1ns $end\n`;
    vcd += `$scope module ${selectedMCU.toUpperCase()}_LOGIC_ANALYZER $end\n`;

    channels.forEach(ch => {
      if (ch.enabled) {
        vcd += `$var wire 1 ${String.fromCharCode(33 + ch.id)} ${ch.name.replace(/\s+/g, '_')} $end\n`;
      }
    });
    vcd += `$upscope $end\n$enddefinitions $end\n`;
    vcd += `#0\n$dumpvars\n`;

    channels.forEach(ch => {
      if (ch.enabled) {
        const initialVal = signalData.samples[ch.id][0] || 0;
        vcd += `${initialVal}${String.fromCharCode(33 + ch.id)}\n`;
      }
    });
    vcd += `$end\n`;

    for (let s = 1; s < signalData.numSamples; s++) {
      const timeNs = Math.round(s * signalData.stepNs);
      let changes = '';
      channels.forEach(ch => {
        if (ch.enabled) {
          const curr = signalData.samples[ch.id][s];
          const prev = signalData.samples[ch.id][s - 1];
          if (curr !== prev) {
            changes += `${curr}${String.fromCharCode(33 + ch.id)}\n`;
          }
        }
      });
      if (changes.length > 0) {
        vcd += `#${timeNs}\n${changes}`;
      }
    }
    return vcd;
  };

  const handleDownloadVcd = () => {
    const vcdData = generateVcd();
    const blob = new Blob([vcdData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedMCU}_trace_${activePreset}.vcd`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyVcd = () => {
    const vcdData = generateVcd();
    navigator.clipboard.writeText(vcdData);
    setCopiedVcd(true);
    setTimeout(() => setCopiedVcd(false), 2000);
  };

  const handleDownloadCsv = () => {
    const activeChs = channels.filter(c => c.enabled);
    let csv = `Timestamp_ns,Time_us,${activeChs.map(c => `"${c.name} (${c.pin})"`).join(',')}\n`;
    for (let s = 0; s < signalData.numSamples; s++) {
      const timeNs = Math.round(s * signalData.stepNs);
      const timeUs = (timeNs / 1000).toFixed(3);
      const vals = activeChs.map(c => signalData.samples[c.id][s]);
      csv += `${timeNs},${timeUs},${vals.join(',')}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedMCU}_logic_data.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ${
        isMaximized ? 'fixed inset-4 z-50 flex flex-col' : 'w-full mb-6'
      }`}
    >
      {/* Top Header Bar */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-500/10">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">가상 로직 분석기 (Virtual Logic Analyzer)</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                8-Channel Digital
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {currentProfile.name}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              GPIO 핀 다채널 디지털 파형 타이밍 시뮬레이션 및 MCU 클럭 기반 하드웨어 전이 지연(Transition Latency) 정밀 분석
            </p>
          </div>
        </div>

        {/* Header Right Action Tools */}
        <div className="flex items-center gap-2">
          {/* Play / Pause / Single Trigger Controls */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
            <button
              onClick={() => {
                setIsRunning(!isRunning);
                setRunMode(isRunning ? 'stop' : 'run');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isRunning
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isRunning ? 'RUNNING' : 'PAUSED'}
            </button>

            <button
              onClick={() => {
                setIsRunning(false);
                setRunMode('single');
                setTriggerFired(true);
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                runMode === 'single'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
              title="Single Shot Trigger Capture"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              SINGLE
            </button>

            <button
              onClick={handleResetZoom}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
              title="파형 및 줌 리셋"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Export & Maximize */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
            <button
              onClick={handleDownloadVcd}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              title="PulseView / Sigrok 호환 VCD 파일 다운로드"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              VCD 내보내기
            </button>

            <button
              onClick={handleCopyVcd}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              title="VCD 텍스트 클립보드 복사"
            >
              {copiedVcd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleDownloadCsv}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              title="CSV 데이터 다운로드"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
            </button>
          </div>

          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl border border-slate-800 transition-all"
            title={isMaximized ? '기본 크기로 축소' : '전체화면 확대'}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl border border-slate-800 transition-all"
              title="닫기"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Control Bar: Clock Selector, Presets & Hardware Latency Parameters */}
      <div className="bg-slate-950/80 px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        {/* Protocol Preset Selector */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">프로토콜 프리셋:</span>
          <div className="inline-flex bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            {[
              { id: 'spi', label: 'SPI Bus (4Ch)' },
              { id: 'i2c', label: 'I2C / TWI (3Ch)' },
              { id: 'uart', label: 'UART / USART' },
              { id: 'interrupt_latency', label: '인터럽트 지연 (ISR)' },
              { id: 'custom', label: '사용자 정의 (8Ch)' }
            ].map(preset => (
              <button
                key={preset.id}
                onClick={() => setActivePreset(preset.id as ProtocolPresetType)}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  activePreset === preset.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* MCU Clock Speed Selector */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            MCU 클럭:
          </span>
          <select
            value={clockSpeedHz}
            onChange={e => setClockSpeedHz(Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
          >
            {AVR_CLOCK_SPEEDS.map(speed => (
              <option key={speed.valueHz} value={speed.valueHz}>
                {speed.label}
              </option>
            ))}
          </select>
          <div className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-cyan-400">
            1 Clock = {cycleTimeNs.toFixed(1)} ns
          </div>
        </div>

        {/* Transition Latency Display & Slew Mode */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
            <span className="text-slate-400">슬루/부하:</span>
            <select
              value={loadCapacitancePf}
              onChange={e => setLoadCapacitancePf(Number(e.target.value))}
              className="bg-transparent text-slate-200 font-mono focus:outline-none"
            >
              <option value={15}>15 pF (초경량)</option>
              <option value={30}>30 pF (표준 PCB)</option>
              <option value={50}>50 pF (긴 배선)</option>
              <option value={100}>100 pF (무거운 부하)</option>
            </select>
            <span className="text-slate-500 font-mono">({hardwareTransitionMetrics.tRiseFallNs} ns)</span>
          </div>

          <div className="inline-flex bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setSlewDisplayMode('ideal')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                slewDisplayMode === 'ideal' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="수학적 이상 0/1 계단 펄스"
            >
              이상적(Ideal)
            </button>
            <button
              onClick={() => setSlewDisplayMode('realistic')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                slewDisplayMode === 'realistic' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="AVR 실장 I/O 버퍼 상승/하강 시간 및 지연 반영"
            >
              AVR 실장 슬루
            </button>
          </div>
        </div>
      </div>

      {/* Main Analysis Display Tabs Header */}
      <div className="px-5 pt-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {[
            { id: 'diagram', label: '타이밍 다이어그램', icon: Activity },
            { id: 'packets', label: '프로토콜 패킷 디코더', icon: Terminal, count: signalData.decodedPacketsList.length },
            { id: 'measurements', label: '채널 측정 통계', icon: BarChart2 },
            { id: 'latency_analysis', label: 'AVR 명령어 전이 지연', icon: Zap }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10 rounded-t-lg'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 font-mono">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Viewport Zoom & Timebase status */}
        <div className="flex items-center gap-2 pb-2">
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1">
            <button
              onClick={handleZoomIn}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-all"
              title="시간축 확대 (Zoom In)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-300 px-1.5">
              총 {totalWindowNs >= 1000 ? `${(totalWindowNs / 1000).toFixed(2)} µs` : `${totalWindowNs} ns`}
            </span>
            <button
              onClick={handleZoomOut}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-all"
              title="시간축 축소 (Zoom Out)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer ml-2">
            <input
              type="checkbox"
              checked={showCursors}
              onChange={e => setShowCursors(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
            />
            커서 (A/B)
          </label>
        </div>
      </div>

      {/* Body: Active Tab Content */}
      <div className="flex-1 p-4 bg-slate-950/60 overflow-y-auto">
        {activeTab === 'diagram' && (
          <div className="space-y-4">
            {/* Canvas Timing Diagram Box */}
            <div
              ref={containerRef}
              className="relative w-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-inner"
            >
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="w-full block cursor-crosshair select-none"
              />

              {/* Cursor Delta HUD Float overlay */}
              {showCursors && (
                <div className="absolute top-8 right-3 bg-slate-900/90 border border-slate-700 backdrop-blur-md rounded-xl p-2.5 text-xs shadow-xl flex items-center gap-4 text-slate-300 pointer-events-none">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                    <span className="font-mono text-amber-300">A: {cursorANs} ns</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block"></span>
                    <span className="font-mono text-purple-300">B: {cursorBNs} ns</span>
                  </div>
                  <div className="h-4 w-px bg-slate-700"></div>
                  <div className="font-mono text-cyan-300 font-bold">
                    ΔT: {cursorStats.deltaNs} ns ({cursorStats.freqKhz} kHz)
                  </div>
                  <div className="font-mono text-emerald-400 font-bold">
                    ΔCycles: {cursorStats.deltaCycles} clk
                  </div>
                </div>
              )}
            </div>

            {/* Quick Channel Manager Strip below canvas */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold text-slate-200">채널 활성화 & 핀 매핑:</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {channels.map(ch => (
                  <div
                    key={ch.id}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                      ch.enabled
                        ? 'bg-slate-950 border-slate-700 text-slate-200'
                        : 'bg-slate-950/40 border-slate-850 text-slate-500 opacity-60'
                    }`}
                  >
                    <button
                      onClick={() => toggleChannel(ch.id)}
                      className="w-2.5 h-2.5 rounded-full transition-transform hover:scale-125"
                      style={{ backgroundColor: ch.enabled ? ch.color : '#475569' }}
                      title="채널 On/Off"
                    />
                    <span className="font-medium text-[11px]">{ch.name.split(' ')[0]}</span>
                    <span className="text-[10px] font-mono text-slate-400">({ch.pin.split(' ')[0]})</span>
                    <button
                      onClick={() => toggleInvert(ch.id)}
                      className={`text-[9px] px-1 rounded font-mono ${
                        ch.inverted ? 'bg-amber-500/20 text-amber-300' : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title="신호 반전(Invert Polarity)"
                    >
                      {ch.inverted ? 'INV' : 'NOR'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Timing & Latency Insights Callout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                  <Zap className="w-3.5 h-3.5" />
                  AVR I/O 포트 토글 레이턴시
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  AVR <code className="text-cyan-300 font-mono">sbi/cbi</code> 명령어는 2 클럭 사이클(
                  {hardwareTransitionMetrics.sbiCbiLatencyNs} ns)이 소요되며, 바이트 단위{' '}
                  <code className="text-cyan-300 font-mono">out PORTx</code>는 1 사이클(
                  {hardwareTransitionMetrics.outPortLatencyNs} ns)만에 물리 핀 전이를 완료합니다.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  동기화 파이프라인 지연 (PINx)
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  외부 신호가 입력될 때 AVR 하드웨어 슈미트 트리거와 2단 D 플립플롭 동기화기를 통과하므로{' '}
                  <span className="text-emerald-300 font-mono">{hardwareTransitionMetrics.pinSyncDelayNs} ns</span>
                  (약 1~1.5 클럭)의 입력 전파 지연이 발생합니다.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-purple-400 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  기생 커패시턴스 & 상승 슬루율
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  부하용량 {loadCapacitancePf} pF 환경에서 AVR 내부 MOS 드라이버 저항(약 30Ω)으로 인해 신호 상승/하강
                  시간은 <span className="text-purple-300 font-mono">{hardwareTransitionMetrics.tRiseFallNs} ns</span>
                  입니다. 고속 SPI/TWI 설계 시 타이밍 마진을 고려하십시오.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Decoded Protocol Packets */}
        {activeTab === 'packets' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-bold text-white">디코딩된 프로토콜 패킷 스트림</span>
                  <span className="text-xs text-slate-400 font-mono">({activePreset.toUpperCase()})</span>
                </div>
                <span className="text-xs text-slate-400">총 {signalData.decodedPacketsList.length}개 트랜잭션 감지됨</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5">타임스탬프</th>
                      <th className="px-4 py-2.5">프로토콜</th>
                      <th className="px-4 py-2.5">채널</th>
                      <th className="px-4 py-2.5">유형</th>
                      <th className="px-4 py-2.5">데이터 (HEX / ASCII)</th>
                      <th className="px-4 py-2.5">설명</th>
                      <th className="px-4 py-2.5 text-right">전이 지연</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 font-mono">
                    {signalData.decodedPacketsList.map(pkt => (
                      <tr key={pkt.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="px-4 py-2.5 text-cyan-400">{pkt.timestampNs} ns</td>
                        <td className="px-4 py-2.5 text-slate-300">{pkt.protocol}</td>
                        <td className="px-4 py-2.5 text-slate-400">{pkt.channel}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              pkt.type === 'start'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : pkt.type === 'ack'
                                ? 'bg-cyan-500/20 text-cyan-300'
                                : pkt.type === 'trigger'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-slate-800 text-slate-200'
                            }`}
                          >
                            {pkt.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-bold text-white">
                          <span className="text-cyan-300">{pkt.dataHex}</span>
                          {pkt.dataAscii && (
                            <span className="ml-2 text-slate-400 font-normal">({pkt.dataAscii})</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-300 font-sans">{pkt.desc}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-emerald-400">
                          {pkt.latencyNs} ns ({pkt.latencyCycles} clk)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-400 flex items-center gap-3">
              <Info className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                디코더는 마이크로초(µs) 미만의 초미세 지터와 하드웨어 클럭 왜곡을 필터링하여 프레임 동기화 및 바이트
                경계를 자동 정렬합니다. VCD 파일 내보내기를 통해 Sigrok / PulseView에서 추가 프로토콜 스택 분석이 가능합니다.
              </span>
            </div>
          </div>
        )}

        {/* Tab 3: Channel Measurements */}
        {activeTab === 'measurements' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white">채널별 측정 지표 및 엣지 통계</span>
                </div>
                <span className="text-xs text-slate-400">클럭 주파수: {(clockSpeedHz / 1e6).toFixed(1)} MHz</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5">채널</th>
                      <th className="px-4 py-2.5">매핑된 MCU 핀</th>
                      <th className="px-4 py-2.5">상태</th>
                      <th className="px-4 py-2.5">추정 주파수</th>
                      <th className="px-4 py-2.5">주기 (Period)</th>
                      <th className="px-4 py-2.5">듀티비 (Duty)</th>
                      <th className="px-4 py-2.5">상승 시간 (Rise Time)</th>
                      <th className="px-4 py-2.5 text-right">전이 명령 사이클</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 font-mono">
                    {channelMeasurements.map(ch => (
                      <tr key={ch.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="px-4 py-2.5 flex items-center gap-2 font-bold text-white">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ch.color }}></span>
                          {ch.name}
                        </td>
                        <td className="px-4 py-2.5 text-slate-300 font-semibold">{ch.pin}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              ch.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {ch.enabled ? 'ACTIVE' : 'MUTED'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-cyan-400 font-bold">
                          {ch.freqHz > 0 ? `${(ch.freqHz / 1000).toFixed(1)} kHz` : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-300">
                          {ch.periodNs > 0 ? `${ch.periodNs} ns` : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-amber-300 font-bold">{ch.duty}%</td>
                        <td className="px-4 py-2.5 text-purple-400">{ch.riseTimeNs} ns</td>
                        <td className="px-4 py-2.5 text-right text-emerald-400 font-bold">
                          {ch.instrLatencyCycles} cycles ({hardwareTransitionMetrics.sbiCbiLatencyNs} ns)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: AVR Instruction Transition Latency Breakdown */}
        {activeTab === 'latency_analysis' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: Assembly Instruction Latency Comparison */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  AVR I/O 조작 어셈블리 명령어별 물리 핀 전이 지연
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  AVR 마이크로컨트롤러는 I/O 공간 매핑 방식에 따라 포트 조작 명령어의 소요 사이클이 다릅니다. 현재{' '}
                  <span className="text-cyan-300 font-mono">{(clockSpeedHz / 1e6).toFixed(1)} MHz</span> 클럭 기준:
                </p>

                <div className="space-y-2 text-xs font-mono">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-white">sbi / cbi PORTx, bit</div>
                      <div className="text-[11px] text-slate-400 font-sans">하위 32개 I/O 레지스터 단일 비트 세트/클리어</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-cyan-400">2 사이클</div>
                      <div className="text-[11px] text-slate-400">{hardwareTransitionMetrics.sbiCbiLatencyNs} ns</div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-white">out PORTx, rXX</div>
                      <div className="text-[11px] text-slate-400 font-sans">8비트 전체 포트 동시 갱신</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400">1 사이클</div>
                      <div className="text-[11px] text-slate-400">{hardwareTransitionMetrics.outPortLatencyNs} ns</div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-white">sbi PINx, bit (Hardware Toggle)</div>
                      <div className="text-[11px] text-slate-400 font-sans">ATmega328P/640 고속 하드웨어 토글 지원</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-purple-400">2 사이클</div>
                      <div className="text-[11px] text-slate-400">{hardwareTransitionMetrics.sbiCbiLatencyNs} ns</div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-white">sts (Extended I/O Memory)</div>
                      <div className="text-[11px] text-slate-400 font-sans">ATmega640/128 상위 포트(Port F~L) 접근 시</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-amber-400">2 사이클</div>
                      <div className="text-[11px] text-slate-400">{hardwareTransitionMetrics.sbiCbiLatencyNs} ns</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Box 2: Interrupt Entry & Slew Rate Budgets */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  하드웨어 인터럽트 진입 & 신호 무결성 예산
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  물리적 인터럽트 핀의 레벨 변화로부터 ISR 내부 첫 번째 I/O 출력 펄스가 인가되기까지의 실제 지연입니다:
                </p>

                <div className="space-y-2 text-xs">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 font-mono">
                    <div className="flex justify-between text-slate-300">
                      <span>1. PINx 입력 동기화 (Sync Delay):</span>
                      <span className="text-cyan-400">{hardwareTransitionMetrics.pinSyncDelayNs} ns</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>2. 하드웨어 PC 스택 푸시 + 벡터 점프:</span>
                      <span className="text-cyan-400">{hardwareTransitionMetrics.isrEntryHardwareNs} ns (4 clk)</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>3. ISR 내 첫 명령어 (sbi PORT, pin):</span>
                      <span className="text-cyan-400">{hardwareTransitionMetrics.sbiCbiLatencyNs} ns (2 clk)</span>
                    </div>
                    <div className="border-t border-slate-800 pt-1.5 flex justify-between font-bold text-white text-sm">
                      <span className="text-emerald-400">총 인터럽트 응답 지연:</span>
                      <span className="text-emerald-400">
                        {(
                          hardwareTransitionMetrics.pinSyncDelayNs +
                          hardwareTransitionMetrics.isrEntryHardwareNs +
                          hardwareTransitionMetrics.sbiCbiLatencyNs
                        ).toFixed(1)}{' '}
                        ns (약 7.25 클럭)
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1 font-mono">
                    <div className="font-bold text-slate-200">RC 슬루율 공식 (10% ~ 90% Rise Time):</div>
                    <div className="text-[11px] text-slate-400 font-sans">
                      t_r = 2.2 × R_driver × C_load + t_gate ={' '}
                      <span className="text-purple-300 font-mono font-bold">
                        {hardwareTransitionMetrics.tRiseFallNs} ns
                      </span>{' '}
                      (부하 {loadCapacitancePf} pF 기준)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info Strip */}
      <div className="bg-slate-950 px-5 py-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            샘플링: 가상 {sampleRateMsps} MSa/s
          </span>
          <span>버퍼 깊이: {signalData.numSamples} Samples</span>
          <span>
            선택된 MCU: <strong className="text-white">{currentProfile.fullName}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span>단축키: 드래그로 커서 A/B 이동</span>
          <span className="text-slate-600">|</span>
          <span className="text-cyan-400 font-medium">Standard VCD / Sigrok Export Ready</span>
        </div>
      </div>
    </div>
  );
};
