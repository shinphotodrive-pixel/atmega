import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Activity,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Download,
  Info,
  Sparkles,
  Zap,
  Cpu,
  Layers,
  ArrowRight,
  Code2,
  Play,
  RotateCcw,
  TrendingUp,
  Clock,
  ShieldCheck,
  Radio,
  FileCode2,
  Maximize2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type ProtocolType = 'i2c' | 'spi';
export type I2cTransferMode = 'write_burst' | 'read_random' | 'read_sequential';
export type SpiMode = 0 | 1 | 2 | 3;
export type SpiPrescaler = 4 | 16 | 64 | 128;

export interface SequencePreset {
  id: string;
  protocol: ProtocolType;
  name: string;
  device: string;
  tag: string;
  desc: string;
  // I2C specific
  i2cAddrHex?: string;
  i2cMode?: I2cTransferMode;
  i2cSubAddrHex?: string;
  i2cSpeedKhz?: 100 | 400;
  // SPI specific
  spiMode?: SpiMode;
  spiPrescaler?: SpiPrescaler;
  spiDoubleSpeed?: boolean;
  spiMsbFirst?: boolean;
  // Payload
  payloadHex: string;
}

const PRESET_SEQUENCES: SequencePreset[] = [
  {
    id: 'mpu6050_init',
    protocol: 'i2c',
    name: 'MPU-6050 IMU 초기화 시퀀스 (Burst Write)',
    device: 'MPU-6050 6축 센서',
    tag: 'I2C Burst',
    desc: '슬레이브 0x68의 PWR_MGMT_1(0x6B) 레지스터부터 내부 클럭 설정까지 연속 4바이트 버스트 기록',
    i2cAddrHex: '0x68',
    i2cMode: 'write_burst',
    i2cSubAddrHex: '0x6B',
    i2cSpeedKhz: 400,
    payloadHex: '0x00, 0x07, 0x00, 0x00'
  },
  {
    id: 'ds3231_rtc_read',
    protocol: 'i2c',
    name: 'DS3231 RTC 시간 읽기 (Repeated START)',
    device: 'DS3231 고정밀 RTC',
    tag: 'I2C Rep-START',
    desc: '초 레지스터(0x00) 주소 포인터 지정 후 Repeated START로 버스 점유 유지하며 3바이트(초/분/시) 수신',
    i2cAddrHex: '0x68',
    i2cMode: 'read_random',
    i2cSubAddrHex: '0x00',
    i2cSpeedKhz: 400,
    payloadHex: '0x35, 0x42, 0x14'
  },
  {
    id: 'at24c32_page_write',
    protocol: 'i2c',
    name: 'AT24C32 EEPROM 페이지 쓰기 (100kHz Standard)',
    device: 'AT24C32 32Kbit EEPROM',
    tag: 'I2C Standard',
    desc: '표준 100kHz 모드에서 16비트 메모리 주소(0x01, 0x20) 지정 후 데이터 4바이트 쓰기',
    i2cAddrHex: '0x50',
    i2cMode: 'write_burst',
    i2cSubAddrHex: '0x01',
    i2cSpeedKhz: 100,
    payloadHex: '0x20, 0xAA, 0x55, 0xFE'
  },
  {
    id: 'w25q128_flash_read',
    protocol: 'spi',
    name: 'W25Q128 Flash 메모리 고속 읽기 (Mode 0, SPI2X)',
    device: 'Winbond W25Q128 SPI Flash',
    tag: 'SPI 8MHz SPI2X',
    desc: 'Fast Read 명령(0x0B) + 24비트 주소 전송 후 4바이트 버스트 데이터 수신 (f_osc/2 배속)',
    spiMode: 0,
    spiPrescaler: 4,
    spiDoubleSpeed: true,
    spiMsbFirst: true,
    payloadHex: '0x0B, 0x00, 0x10, 0x00, 0xFF, 0x55, 0xAA, 0x3C'
  },
  {
    id: 'mcp4921_dac_out',
    protocol: 'spi',
    name: 'MCP4921 12-bit DAC 전압 출력 (Mode 0)',
    device: 'MCP4921 12비트 DAC',
    tag: 'SPI Mode 0',
    desc: '설정 비트 포함 16비트(2바이트) 디지털 코드 전송하여 아날로그 전압 정밀 변환',
    spiMode: 0,
    spiPrescaler: 4,
    spiDoubleSpeed: false,
    spiMsbFirst: true,
    payloadHex: '0x38, 0x00'
  },
  {
    id: 'nrf24l01_tx_payload',
    protocol: 'spi',
    name: 'nRF24L01+ RF 모듈 W_TX_PAYLOAD 명령 (Mode 0)',
    device: 'Nordic nRF24L01+ 2.4GHz RF',
    tag: 'SPI Multi-byte',
    desc: 'W_TX_PAYLOAD 명령(0xA0) 전송 후 무선 패킷 6바이트 전송',
    spiMode: 0,
    spiPrescaler: 16,
    spiDoubleSpeed: false,
    spiMsbFirst: true,
    payloadHex: '0xA0, 0x01, 0x02, 0x03, 0x04, 0x05'
  }
];

export const I2cSpiSequenceDesigner: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Protocol Selection
  const [protocol, setProtocol] = useState<ProtocolType>('i2c');

  // CPU Frequency
  const [cpuFreqMhz, setCpuFreqMhz] = useState<number>(16);

  // I2C Parameters
  const [i2cAddrHex, setI2cAddrHex] = useState<string>('0x68');
  const [i2cMode, setI2cMode] = useState<I2cTransferMode>('write_burst');
  const [i2cSubAddrHex, setI2cSubAddrHex] = useState<string>('0x6B');
  const [i2cSpeedKhz, setI2cSpeedKhz] = useState<100 | 400>(400);

  // SPI Parameters
  const [spiMode, setSpiMode] = useState<SpiMode>(0);
  const [spiPrescaler, setSpiPrescaler] = useState<SpiPrescaler>(4);
  const [spiDoubleSpeed, setSpiDoubleSpeed] = useState<boolean>(true);
  const [spiMsbFirst, setSpiMsbFirst] = useState<boolean>(true);

  // Payload Raw Input
  const [payloadInput, setPayloadInput] = useState<string>('0x00, 0x07, 0x00, 0x00');

  // Animation / Visualizer state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [cursorProgress, setCursorProgress] = useState<number>(0); // 0 to 1
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const animFrameRef = useRef<number | null>(null);

  // Load Preset
  const handleSelectPreset = (p: SequencePreset) => {
    setProtocol(p.protocol);
    setPayloadInput(p.payloadHex);
    if (p.protocol === 'i2c') {
      if (p.i2cAddrHex) setI2cAddrHex(p.i2cAddrHex);
      if (p.i2cMode) setI2cMode(p.i2cMode);
      if (p.i2cSubAddrHex) setI2cSubAddrHex(p.i2cSubAddrHex);
      if (p.i2cSpeedKhz) setI2cSpeedKhz(p.i2cSpeedKhz);
    } else {
      if (p.spiMode !== undefined) setSpiMode(p.spiMode);
      if (p.spiPrescaler !== undefined) setSpiPrescaler(p.spiPrescaler);
      if (p.spiDoubleSpeed !== undefined) setSpiDoubleSpeed(p.spiDoubleSpeed);
      if (p.spiMsbFirst !== undefined) setSpiMsbFirst(p.spiMsbFirst);
    }
    setCursorProgress(0);
    setIsPlaying(false);
  };

  // Parse Hex Payload bytes
  const parsedPayloadBytes = useMemo<number[]>(() => {
    const rawTokens = payloadInput.split(/[,\s]+/).filter((t) => t.trim().length > 0);
    const bytes: number[] = [];
    for (const tok of rawTokens) {
      let clean = tok.trim();
      let val = 0;
      if (clean.toLowerCase().startsWith('0x')) {
        val = parseInt(clean, 16);
      } else {
        val = parseInt(clean, 10);
      }
      if (!isNaN(val)) {
        bytes.push(val & 0xff);
      }
    }
    return bytes.length > 0 ? bytes : [0x00];
  }, [payloadInput]);

  // Parse Slave Address & Sub Address
  const slaveAddr7bit = useMemo<number>(() => {
    const clean = i2cAddrHex.trim();
    const val = clean.toLowerCase().startsWith('0x') ? parseInt(clean, 16) : parseInt(clean, 10);
    return isNaN(val) ? 0x68 : val & 0x7f;
  }, [i2cAddrHex]);

  const subAddrByte = useMemo<number>(() => {
    const clean = i2cSubAddrHex.trim();
    const val = clean.toLowerCase().startsWith('0x') ? parseInt(clean, 16) : parseInt(clean, 10);
    return isNaN(val) ? 0x00 : val & 0xff;
  }, [i2cSubAddrHex]);

  // I2C Calculations (TWBR & TWPS)
  // SCL_freq = CPU_freq / (16 + 2 * TWBR * 4^TWPS)
  // TWBR = (CPU_freq - 16 * SCL_freq) / (2 * SCL_freq * 4^TWPS)
  const i2cTiming = useMemo(() => {
    const fCpuHz = cpuFreqMhz * 1_000_000;
    const targetSclHz = i2cSpeedKhz * 1_000;

    let bestTwbr = 12;
    let bestTwps = 0;
    let minError = Infinity;
    let actualSclHz = targetSclHz;

    for (let twps = 0; twps <= 3; twps++) {
      const prescaler = Math.pow(4, twps);
      const calcTwbr = Math.round((fCpuHz - 16 * targetSclHz) / (2 * targetSclHz * prescaler));
      if (calcTwbr >= 0 && calcTwbr <= 255) {
        const achievedHz = fCpuHz / (16 + 2 * calcTwbr * prescaler);
        const err = Math.abs(achievedHz - targetSclHz);
        if (err < minError) {
          minError = err;
          bestTwbr = calcTwbr;
          bestTwps = twps;
          actualSclHz = achievedHz;
        }
      }
    }

    const clockPeriodUs = 1_000_000 / actualSclHz;
    const tHighUs = clockPeriodUs * 0.5;
    const tLowUs = clockPeriodUs * 0.5;

    // Datasheet specs
    const minHighUs = i2cSpeedKhz === 400 ? 0.6 : 4.0;
    const minLowUs = i2cSpeedKhz === 400 ? 1.3 : 4.7;
    const setupDataNs = i2cSpeedKhz === 400 ? 100 : 250;
    const holdDataNs = 300; // typical AVR internal delay

    return {
      twbr: bestTwbr,
      twps: bestTwps,
      actualSclHz: Math.round(actualSclHz),
      errorPct: (((actualSclHz - targetSclHz) / targetSclHz) * 100).toFixed(2),
      clockPeriodUs,
      tHighUs,
      tLowUs,
      minHighUs,
      minLowUs,
      setupDataNs,
      holdDataNs
    };
  }, [cpuFreqMhz, i2cSpeedKhz]);

  // SPI Calculations
  // SCK = F_CPU / (Prescaler / (SPI2X ? 2 : 1))
  const spiTiming = useMemo(() => {
    const fCpuHz = cpuFreqMhz * 1_000_000;
    const effectiveDivider = spiDoubleSpeed ? spiPrescaler / 2 : spiPrescaler;
    const sckHz = fCpuHz / effectiveDivider;
    const clockPeriodUs = 1_000_000 / sckHz;
    const halfPeriodUs = clockPeriodUs / 2;

    // SPCR bit flags
    let spr0 = 0;
    let spr1 = 0;
    if (spiPrescaler === 16) spr0 = 1;
    else if (spiPrescaler === 64) spr1 = 1;
    else if (spiPrescaler === 128) {
      spr0 = 1;
      spr1 = 1;
    }

    const cpol = (spiMode === 2 || spiMode === 3) ? 1 : 0;
    const cpha = (spiMode === 1 || spiMode === 3) ? 1 : 0;
    const dord = spiMsbFirst ? 0 : 1;
    const spi2x = spiDoubleSpeed ? 1 : 0;

    // SPCR = (1<<SPE) | (1<<MSTR) | (DORD<<DORD) | (CPOL<<CPOL) | (CPHA<<CPHA) | (SPR1<<SPR1) | (SPR0<<SPR0)
    const spcrVal = (1 << 6) | (1 << 4) | (dord << 5) | (cpol << 3) | (cpha << 2) | (spr1 << 1) | spr0;
    const spsrVal = spi2x ? 1 : 0;

    return {
      sckHz,
      sckMhz: (sckHz / 1_000_000).toFixed(3),
      clockPeriodUs,
      halfPeriodUs,
      cpol,
      cpha,
      dord,
      spi2x,
      spcrVal,
      spsrVal,
      spcrHex: `0x${spcrVal.toString(16).toUpperCase().padStart(2, '0')}`,
      spsrHex: `0x${spsrVal.toString(16).toUpperCase().padStart(2, '0')}`
    };
  }, [cpuFreqMhz, spiPrescaler, spiDoubleSpeed, spiMode, spiMsbFirst]);

  // Frame Sequence Generation for Waveform Visualization
  interface WaveformStep {
    id: string;
    byteIndex: number;
    byteLabel: string;
    bitIndex: number;
    bitLabel: string;
    clockLevelStart: 0 | 1;
    clockLevelEnd: 0 | 1;
    dataLevel: 0 | 1;
    phase: 'START' | 'REP_START' | 'ADDR' | 'RW' | 'ACK' | 'DATA' | 'NACK' | 'STOP' | 'CS_ASSERT' | 'CS_DEASSERT';
    isSamplingPoint?: boolean;
    note?: string;
  }

  const waveformSteps = useMemo<WaveformStep[]>(() => {
    const steps: WaveformStep[] = [];

    if (protocol === 'i2c') {
      let bIdx = 0;

      // 1. START Condition (SDA goes High -> Low while SCL is High)
      steps.push({
        id: 'start_cond',
        byteIndex: bIdx,
        byteLabel: 'START',
        bitIndex: 0,
        bitLabel: 'S',
        clockLevelStart: 1,
        clockLevelEnd: 1,
        dataLevel: 0,
        phase: 'START',
        note: 'START: SDA falls while SCL=1'
      });

      // Helper to push 8-bit byte + ACK
      const pushI2cByte = (val: number, label: string, isReadAck: boolean = false) => {
        bIdx++;
        for (let i = 7; i >= 0; i--) {
          const bitVal = (val >> i) & 1;
          steps.push({
            id: `b${bIdx}_bit${7 - i}`,
            byteIndex: bIdx,
            byteLabel: label,
            bitIndex: 7 - i,
            bitLabel: `b${i}`,
            clockLevelStart: 0,
            clockLevelEnd: 1,
            dataLevel: (bitVal === 1 ? 1 : 0) as 0 | 1,
            phase: label.startsWith('ADDR') ? 'ADDR' : 'DATA',
            isSamplingPoint: true
          });
        }
        // ACK / NACK bit (9th clock pulse)
        steps.push({
          id: `b${bIdx}_ack`,
          byteIndex: bIdx,
          byteLabel: label,
          bitIndex: 8,
          bitLabel: isReadAck ? 'NACK' : 'ACK',
          clockLevelStart: 0,
          clockLevelEnd: 1,
          dataLevel: isReadAck ? 1 : 0, // ACK is 0 (pulled low), NACK is 1 (released)
          phase: isReadAck ? 'NACK' : 'ACK',
          isSamplingPoint: true,
          note: isReadAck ? 'Master NACK: Data reception finished' : 'Slave ACK: 0V'
        });
      };

      if (i2cMode === 'write_burst') {
        // Address + Write (0)
        const addrByte = (slaveAddr7bit << 1) | 0;
        pushI2cByte(addrByte, `ADDR(0x${slaveAddr7bit.toString(16).toUpperCase()})+W`);
        // Sub-address / Register
        pushI2cByte(subAddrByte, `REG(0x${subAddrByte.toString(16).toUpperCase()})`);
        // Payload bytes
        parsedPayloadBytes.forEach((b, idx) => {
          pushI2cByte(b, `DATA[${idx}](0x${b.toString(16).toUpperCase().padStart(2, '0')})`);
        });
      } else if (i2cMode === 'read_random') {
        // Step A: Address + Write to point register
        const addrWriteByte = (slaveAddr7bit << 1) | 0;
        pushI2cByte(addrWriteByte, `ADDR(0x${slaveAddr7bit.toString(16).toUpperCase()})+W`);
        pushI2cByte(subAddrByte, `REG(0x${subAddrByte.toString(16).toUpperCase()})`);

        // Repeated START
        bIdx++;
        steps.push({
          id: 'rep_start_cond',
          byteIndex: bIdx,
          byteLabel: 'Sr (Rep-START)',
          bitIndex: 0,
          bitLabel: 'Sr',
          clockLevelStart: 1,
          clockLevelEnd: 1,
          dataLevel: 0,
          phase: 'REP_START',
          note: 'Repeated START: bus held without STOP'
        });

        // Step B: Address + Read (1)
        const addrReadByte = (slaveAddr7bit << 1) | 1;
        pushI2cByte(addrReadByte, `ADDR(0x${slaveAddr7bit.toString(16).toUpperCase()})+R`);

        // Payload received
        parsedPayloadBytes.forEach((b, idx) => {
          const isLast = idx === parsedPayloadBytes.length - 1;
          pushI2cByte(b, `READ[${idx}](0x${b.toString(16).toUpperCase().padStart(2, '0')})`, isLast);
        });
      } else {
        // Sequential read
        const addrReadByte = (slaveAddr7bit << 1) | 1;
        pushI2cByte(addrReadByte, `ADDR(0x${slaveAddr7bit.toString(16).toUpperCase()})+R`);
        parsedPayloadBytes.forEach((b, idx) => {
          const isLast = idx === parsedPayloadBytes.length - 1;
          pushI2cByte(b, `READ[${idx}](0x${b.toString(16).toUpperCase().padStart(2, '0')})`, isLast);
        });
      }

      // STOP Condition (SDA rises while SCL is High)
      steps.push({
        id: 'stop_cond',
        byteIndex: bIdx + 1,
        byteLabel: 'STOP',
        bitIndex: 0,
        bitLabel: 'P',
        clockLevelStart: 1,
        clockLevelEnd: 1,
        dataLevel: 1,
        phase: 'STOP',
        note: 'STOP: SDA rises while SCL=1'
      });
    } else {
      // SPI Protocol
      let bIdx = 0;

      // 1. /SS Assert (Low)
      steps.push({
        id: 'ss_assert',
        byteIndex: bIdx,
        byteLabel: '/SS Low',
        bitIndex: 0,
        bitLabel: 'CS=0',
        clockLevelStart: (spiTiming.cpol === 1 ? 1 : 0) as 0 | 1,
        clockLevelEnd: (spiTiming.cpol === 1 ? 1 : 0) as 0 | 1,
        dataLevel: 1,
        phase: 'CS_ASSERT',
        note: 'Slave Select (/SS) Driven Low'
      });

      // For each byte in payload
      parsedPayloadBytes.forEach((byteVal, byteIdx) => {
        bIdx++;
        for (let i = 0; i < 8; i++) {
          const bitPos = spiMsbFirst ? 7 - i : i;
          const bitVal = (byteVal >> bitPos) & 1;

          // Clock polarity & phase behavior
          // CPHA=0: Sample on leading edge, shift on trailing edge
          // CPHA=1: Shift on leading edge, sample on trailing edge
          const isSampleLeading = spiTiming.cpha === 0;

          steps.push({
            id: `spi_b${bIdx}_bit${i}`,
            byteIndex: bIdx,
            byteLabel: `BYTE[${byteIdx}](0x${byteVal.toString(16).toUpperCase().padStart(2, '0')})`,
            bitIndex: i,
            bitLabel: `D${bitPos}`,
            clockLevelStart: (spiTiming.cpol === 1 ? 1 : 0) as 0 | 1,
            clockLevelEnd: (spiTiming.cpol === 1 ? 0 : 1) as 0 | 1,
            dataLevel: (bitVal === 1 ? 1 : 0) as 0 | 1,
            phase: 'DATA',
            isSamplingPoint: true,
            note: isSampleLeading
              ? `Edge 1: Sample (D${bitPos}=${bitVal}), Edge 2: Shift`
              : `Edge 1: Shift, Edge 2: Sample (D${bitPos}=${bitVal})`
          });
        }
      });

      // 3. /SS De-assert (High)
      steps.push({
        id: 'ss_deassert',
        byteIndex: bIdx + 1,
        byteLabel: '/SS High',
        bitIndex: 0,
        bitLabel: 'CS=1',
        clockLevelStart: (spiTiming.cpol === 1 ? 1 : 0) as 0 | 1,
        clockLevelEnd: (spiTiming.cpol === 1 ? 1 : 0) as 0 | 1,
        dataLevel: 1,
        phase: 'CS_DEASSERT',
        note: 'Slave Select (/SS) Released High'
      });
    }

    return steps;
  }, [protocol, i2cMode, slaveAddr7bit, subAddrByte, parsedPayloadBytes, spiMsbFirst, spiTiming]);

  // Transmission Time & Efficiency Analysis
  const efficiencyMetrics = useMemo(() => {
    const payloadBytesCount = parsedPayloadBytes.length;
    const purePayloadBits = payloadBytesCount * 8;

    if (protocol === 'i2c') {
      // Total clock cycles:
      // START: ~1 cycle equivalent
      // STOP: ~1 cycle equivalent
      // Each byte: 8 data bits + 1 ACK bit = 9 SCL cycles
      let totalI2cBytes = 0;
      if (i2cMode === 'write_burst') {
        totalI2cBytes = 1 + 1 + payloadBytesCount; // ADDR + REG + DATA
      } else if (i2cMode === 'read_random') {
        totalI2cBytes = 1 + 1 + 1 + payloadBytesCount; // ADDR_W + REG + ADDR_R + DATA
      } else {
        totalI2cBytes = 1 + payloadBytesCount;
      }

      const totalSclCycles = totalI2cBytes * 9 + 2; // +2 for start and stop
      const totalTimeUs = totalSclCycles * i2cTiming.clockPeriodUs;
      const effectiveThroughputKbps = (purePayloadBits / totalTimeUs) * 1000;
      const rawBusKbps = i2cTiming.actualSclHz / 1000;
      const wireEfficiencyPct = (purePayloadBits / (totalSclCycles)) * 100;
      const overheadCycles = totalSclCycles - purePayloadBits;

      // Potential Optimization
      const fastModeTimeUs = totalSclCycles * (1_000_000 / 400_000);
      const timeSavingFastModeUs = Math.max(0, totalTimeUs - fastModeTimeUs);
      const burstSpeedupPct = ((purePayloadBits / totalSclCycles) / (8 / 20) * 100).toFixed(1);

      return {
        totalBytesTransmitted: totalI2cBytes,
        payloadBytesCount,
        totalTimeUs: Math.round(totalTimeUs * 10) / 10,
        totalCycles: totalSclCycles,
        overheadBits: overheadCycles,
        wireEfficiencyPct: Math.min(100, Math.round(wireEfficiencyPct * 10) / 10),
        effectiveThroughputKbps: Math.round(effectiveThroughputKbps),
        rawBusSpeedKbps: rawBusKbps,
        fastModeTimeUs: Math.round(fastModeTimeUs * 10) / 10,
        timeSavingFastModeUs: Math.round(timeSavingFastModeUs * 10) / 10,
        burstSpeedupPct
      };
    } else {
      // SPI
      const totalSpiBytes = payloadBytesCount;
      const totalSckCycles = totalSpiBytes * 8;
      // Chip Select setup/hold ~2 cycles
      const csOverheadUs = 0.5; // ~0.5µs AVR GPIO toggle latency
      const totalTimeUs = totalSckCycles * spiTiming.clockPeriodUs + csOverheadUs;
      const effectiveThroughputKbps = (purePayloadBits / totalTimeUs) * 1000;
      const rawBusKbps = spiTiming.sckHz / 1000;
      const wireEfficiencyPct = (purePayloadBits / (totalSckCycles + 2)) * 100;

      // Double speed benefit
      const doubleSpeedTimeUs = totalSckCycles * (spiTiming.clockPeriodUs / (spiDoubleSpeed ? 1 : 2)) + csOverheadUs;

      return {
        totalBytesTransmitted: totalSpiBytes,
        payloadBytesCount,
        totalTimeUs: Math.round(totalTimeUs * 100) / 100,
        totalCycles: totalSckCycles,
        overheadBits: 2,
        wireEfficiencyPct: Math.min(100, Math.round(wireEfficiencyPct * 10) / 10),
        effectiveThroughputKbps: Math.round(effectiveThroughputKbps),
        rawBusSpeedKbps: Math.round(rawBusKbps),
        doubleSpeedTimeUs: Math.round(doubleSpeedTimeUs * 100) / 100,
        timeSavingFastModeUs: Math.round((totalTimeUs - doubleSpeedTimeUs) * 100) / 100,
        burstSpeedupPct: '100'
      };
    }
  }, [protocol, parsedPayloadBytes, i2cMode, i2cTiming, spiTiming, spiDoubleSpeed]);

  // Animation controller
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    let startTime = performance.now();
    const durationMs = 4000; // 4 seconds full sweep

    const loop = (now: number) => {
      const elapsed = now - startTime;
      const prog = (elapsed % durationMs) / durationMs;
      setCursorProgress(prog);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]);

  // Generated C Source Code
  const generatedCCode = useMemo(() => {
    const payloadArrayDef = parsedPayloadBytes
      .map((b) => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`)
      .join(', ');

    if (protocol === 'i2c') {
      return `/* =========================================================================
 * AVR TWI / I2C 하드웨어 마스터 시퀀스 드라이버 (최적화 빌드)
 * Target MCU : ${currentProfile.name}
 * F_CPU      : ${cpuFreqMhz}000000UL (${cpuFreqMhz} MHz)
 * SCL Speed  : ${i2cSpeedKhz} kHz (TWBR=${i2cTiming.twbr}, TWPS=${i2cTiming.twps}) -> 실측 ${i2cTiming.actualSclHz} Hz
 * Slave Addr : 0x${slaveAddr7bit.toString(16).toUpperCase()}
 * ========================================================================= */
#include <avr/io.h>
#include <util/twi.h>
#include <stdbool.h>

#define F_CPU ${cpuFreqMhz}000000UL
#define SLAVE_ADDR 0x${slaveAddr7bit.toString(16).toUpperCase()}

// 1. TWI 하드웨어 초기화 (TWBR 및 프리스케일러 설정)
void i2c_init(void) {
    // TWPS 비트 클리어 및 설정 (프리스케일러: 4^${i2cTiming.twps})
    TWSR = (TWSR & ~0x03) | (${i2cTiming.twps} & 0x03);
    TWBR = ${i2cTiming.twbr}; // SCL = F_CPU / (16 + 2*TWBR*4^TWPS) = ${i2cTiming.actualSclHz} Hz
    TWCR = (1 << TWEN); // TWI 활성화
}

// 2. START / REPEATED START 송신
bool i2c_start(uint8_t address_with_rw) {
    TWCR = (1 << TWINT) | (1 << TWSTA) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT))); // 송신 완료 대기

    uint8_t status = TW_STATUS;
    if ((status != TW_START) && (status != TW_REP_START)) return false;

    // 슬레이브 주소 + R/W 비트 전송
    TWDR = address_with_rw;
    TWCR = (1 << TWINT) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT)));

    status = TW_STATUS;
    if ((status != TW_MT_SLA_ACK) && (status != TW_MR_SLA_ACK)) return false;
    return true;
}

// 3. 단일 바이트 쓰기 및 ACK 확인
bool i2c_write(uint8_t data) {
    TWDR = data;
    TWCR = (1 << TWINT) | (1 << TWEN);
    while (!(TWCR & (1 << TWINT)));

    return (TW_STATUS == TW_MT_DATA_ACK);
}

// 4. STOP 조건 송신 (버스 해제)
void i2c_stop(void) {
    TWCR = (1 << TWINT) | (1 << TWSTO) | (1 << TWEN);
    while (TWCR & (1 << TWSTO)); // STOP 완료 대기
}

// 5. 최적화된 설계 시퀀스 실행 함수
void execute_designed_sequence(void) {
    const uint8_t payload[] = { ${payloadArrayDef} };
    const uint8_t payload_len = sizeof(payload);

${i2cMode === 'write_burst' ? `    // [Burst Write] 주소 포인터 지정 후 연속 쓰기 (Wire 효율: ${efficiencyMetrics.wireEfficiencyPct}%)
    if (!i2c_start((SLAVE_ADDR << 1) | TW_WRITE)) return;
    i2c_write(0x${subAddrByte.toString(16).toUpperCase().padStart(2, '0')}); // 서브 레지스터

    for (uint8_t i = 0; i < payload_len; i++) {
        if (!i2c_write(payload[i])) {
            i2c_stop(); // ACK 오류 발생 시 즉시 중단
            return;
        }
    }
    i2c_stop();` : `    // [Repeated START Read] 버스 점유 유지 고속 읽기
    if (!i2c_start((SLAVE_ADDR << 1) | TW_WRITE)) return;
    i2c_write(0x${subAddrByte.toString(16).toUpperCase().padStart(2, '0')}); // 읽을 레지스터 번지

    // Repeated START로 즉시 Read 모드 전환
    if (!i2c_start((SLAVE_ADDR << 1) | TW_READ)) return;
    
    uint8_t rx_buf[payload_len];
    for (uint8_t i = 0; i < payload_len; i++) {
        bool is_last = (i == payload_len - 1);
        TWCR = (1 << TWINT) | (1 << TWEN) | (is_last ? 0 : (1 << TWEA));
        while (!(TWCR & (1 << TWINT)));
        rx_buf[i] = TWDR;
    }
    i2c_stop();`}
}
`;
    } else {
      return `/* =========================================================================
 * AVR Hardware SPI 고속 마스터 시퀀스 드라이버 (최적화 빌드)
 * Target MCU : ${currentProfile.name}
 * F_CPU      : ${cpuFreqMhz}000000UL (${cpuFreqMhz} MHz)
 * SPI Mode   : Mode ${spiMode} (CPOL=${spiTiming.cpol}, CPHA=${spiTiming.cpha})
 * SCK Clock  : ${spiTiming.sckMhz} MHz (DIV ${spiPrescaler}${spiDoubleSpeed ? ' with 2X' : ''})
 * Order      : ${spiMsbFirst ? 'MSB First' : 'LSB First'}
 * SPCR=${spiTiming.spcrHex}, SPSR=${spiTiming.spsrHex}
 * ========================================================================= */
#include <avr/io.h>
#include <util/delay.h>

#define F_CPU ${cpuFreqMhz}000000UL

// CS 핀 정의 (표준 PORTB2 또는 PB0 등 사용자 환경에 맞춰 지정)
#define CS_PORT PORTB
#define CS_DDR  DDRB
#define CS_PIN  PB2

#define CS_LOW()   (CS_PORT &= ~(1 << CS_PIN))
#define CS_HIGH()  (CS_PORT |= (1 << CS_PIN))

// 1. SPI 하드웨어 초기화
void spi_init(void) {
    // MOSI, SCK, CS 출력 설정, MISO 입력 설정
    DDRB |= (1 << PB3) | (1 << PB5) | (1 << CS_PIN); // ATmega328P 기준 (MOSI:PB3, SCK:PB5)
    CS_HIGH(); // CS Idle High

    // SPSR 2배속 레지스터 설정
    SPSR = ${spiTiming.spsrHex}; // SPI2X = ${spiDoubleSpeed ? '1 (Double Speed)' : '0'}

    // SPCR 컨트롤 레지스터 설정 (SPE, MSTR, CPOL, CPHA, SPRx, DORD)
    SPCR = ${spiTiming.spcrHex};
}

// 2. 단일 바이트 초고속 전송/수신
static inline uint8_t spi_transfer(uint8_t data) {
    SPDR = data;
    while (!(SPSR & (1 << SPIF))); // 하드웨어 플래그 대기 (인라인화로 루프 오버헤드 최소화)
    return SPDR;
}

// 3. 최적화된 설계 시퀀스 실행 함수 (블록 버스트 전송)
void execute_designed_sequence(void) {
    const uint8_t payload[] = { ${payloadArrayDef} };
    const uint8_t payload_len = sizeof(payload);
    uint8_t rx_data[payload_len];

    // CS Assert (Low)
    CS_LOW();

    // 포인터 증가를 이용한 초고속 파이프라인 버스트 전송
    const uint8_t *tx_ptr = payload;
    uint8_t *rx_ptr = rx_data;
    for (uint8_t i = 0; i < payload_len; i++) {
        *rx_ptr++ = spi_transfer(*tx_ptr++);
    }

    // CS De-assert (High)
    CS_HIGH();
}
`;
    }
  }, [
    protocol,
    currentProfile.name,
    cpuFreqMhz,
    i2cSpeedKhz,
    i2cTiming,
    slaveAddr7bit,
    subAddrByte,
    i2cMode,
    parsedPayloadBytes,
    efficiencyMetrics.wireEfficiencyPct,
    spiMode,
    spiTiming,
    spiPrescaler,
    spiDoubleSpeed,
    spiMsbFirst
  ]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.85 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadCode = () => {
    const blob = new Blob([generatedCCode], { type: 'text/x-csrc' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${protocol}_sequence_${selectedMCU}.c`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-2">
            <Activity className="w-3.5 h-3.5" /> Hardware Waveform & Bit Transmission Engine
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            I2C / SPI 통신 시퀀스 설계기 & 타이밍 다이어그램 최적화기
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            전송할 바이트 시퀀스를 입력하면 <span className="text-cyan-300 font-medium">데이터시트 타이밍 파라미터</span>(SCL/SDA, SCK/MOSI/CS)를 바탕으로 
            클럭과 데이터 라인의 파형을 동적으로 시각화하고, <span className="text-amber-400 font-medium">프로토콜 오버헤드 개선 방안</span> 및 
            임베디드 C 코드를 자동으로 도출합니다.
          </p>
        </div>

        {/* Protocol Selector Buttons */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-start lg:self-center">
          <button
            onClick={() => setProtocol('i2c')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              protocol === 'i2c'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> I2C (TWI) 설계
          </button>
          <button
            onClick={() => setProtocol('spi')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              protocol === 'spi'
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" /> SPI 고속 버스 설계
          </button>
        </div>
      </div>

      {/* Preset Selector Banner */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            검증된 센서 & 메모리 표준 통신 프리셋
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {PRESET_SEQUENCES.map((p) => {
            const isSelected =
              p.protocol === protocol &&
              p.payloadHex === payloadInput &&
              (protocol === 'i2c' ? p.i2cAddrHex === i2cAddrHex : p.spiMode === spiMode);

            return (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p)}
                className={`text-left p-2.5 rounded-lg border transition-all text-xs flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-500/50 ring-1 ring-cyan-500/40'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-semibold text-white truncate">{p.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      p.protocol === 'i2c'
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    }`}
                  >
                    {p.tag}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-1">{p.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Control Panel: Parameters Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Clock & MCU Parameters */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" /> MCU & 클럭 시스템 파라미터
          </h3>

          <div>
            <label className="text-xs text-slate-400 flex justify-between mb-1">
              <span>F_CPU 클럭 주파수</span>
              <span className="text-cyan-400 font-bold">{cpuFreqMhz} MHz</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[8, 12, 16, 20].map((f) => (
                <button
                  key={f}
                  onClick={() => setCpuFreqMhz(f)}
                  className={`py-1 text-xs rounded border transition-all font-semibold ${
                    cpuFreqMhz === f
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {f} MHz
                </button>
              ))}
            </div>
          </div>

          {protocol === 'i2c' ? (
            <>
              <div>
                <label className="text-xs text-slate-400 flex justify-between mb-1">
                  <span>I2C 버스 전송 속도 (SCL)</span>
                  <span className="text-cyan-300 font-semibold">{i2cSpeedKhz} kHz</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setI2cSpeedKhz(100)}
                    className={`py-1.5 text-xs rounded-lg border font-semibold ${
                      i2cSpeedKhz === 100
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    Standard (100 kHz)
                  </button>
                  <button
                    onClick={() => setI2cSpeedKhz(400)}
                    className={`py-1.5 text-xs rounded-lg border font-semibold ${
                      i2cSpeedKhz === 400
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    Fast Mode (400 kHz)
                  </button>
                </div>
              </div>

              {/* Hardware Register Computed readout */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>TWBR 레지스터 값:</span>
                  <span className="text-emerald-400 font-mono font-bold">{i2cTiming.twbr}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>TWPS 프리스케일러:</span>
                  <span className="text-cyan-400 font-mono">4^{i2cTiming.twps} (분주 {Math.pow(4, i2cTiming.twps)})</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>실제 도달 SCL:</span>
                  <span className="text-white font-mono font-semibold">{i2cTiming.actualSclHz.toLocaleString()} Hz</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>오차율:</span>
                  <span className="text-emerald-300 font-mono">{i2cTiming.errorPct}%</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs text-slate-400 flex justify-between mb-1">
                  <span>SPI 클럭 분주비 (Prescaler)</span>
                  <span className="text-indigo-400 font-bold">f_osc / {spiPrescaler}</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {([4, 16, 64, 128] as SpiPrescaler[]).map((pre) => (
                    <button
                      key={pre}
                      onClick={() => setSpiPrescaler(pre)}
                      className={`py-1 text-xs rounded border transition-all font-semibold ${
                        spiPrescaler === pre
                          ? 'bg-indigo-500 text-white border-indigo-400'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      /{pre}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-900/70 p-2.5 rounded-lg border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-200 font-medium block">SPI2X 배속 모드</span>
                  <span className="text-[11px] text-slate-400">클럭 속도 2배 가속 ({spiTiming.sckMhz} MHz)</span>
                </div>
                <input
                  type="checkbox"
                  checked={spiDoubleSpeed}
                  onChange={(e) => setSpiDoubleSpeed(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-indigo-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
              </div>

              {/* SPI Register Computed readout */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>SPCR (Control Reg):</span>
                  <span className="text-indigo-400 font-mono font-bold">{spiTiming.spcrHex}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>SPSR (Status Reg):</span>
                  <span className="text-cyan-400 font-mono font-bold">{spiTiming.spsrHex}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>SCK 클럭 주파수:</span>
                  <span className="text-emerald-400 font-mono font-bold">{spiTiming.sckMhz} MHz</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Middle Column: Protocol Specific Frame Options */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" /> 통신 프레임 & 어드레싱 구조
          </h3>

          {protocol === 'i2c' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">슬레이브 주소 (7-bit)</label>
                  <input
                    type="text"
                    value={i2cAddrHex}
                    onChange={(e) => setI2cAddrHex(e.target.value)}
                    placeholder="0x68"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Decimal: {slaveAddr7bit} (0b{slaveAddr7bit.toString(2).padStart(7, '0')})
                  </span>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">서브 레지스터 주소</label>
                  <input
                    type="text"
                    value={i2cSubAddrHex}
                    onChange={(e) => setI2cSubAddrHex(e.target.value)}
                    placeholder="0x00"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">0x{subAddrByte.toString(16).toUpperCase().padStart(2, '0')}</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">트랜잭션 시퀀스 모드</label>
                <select
                  value={i2cMode}
                  onChange={(e) => setI2cMode(e.target.value as I2cTransferMode)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                >
                  <option value="write_burst">연속 버스트 쓰기 (Burst Write: ADDR+W ➔ REG ➔ DATA... ➔ STOP)</option>
                  <option value="read_random">레지스터 지정 읽기 (Repeated START: ADDR+W ➔ REG ➔ Sr ➔ ADDR+R)</option>
                  <option value="read_sequential">단순 순차 읽기 (Sequential Read: ADDR+R ➔ DATA... ➔ STOP)</option>
                </select>
              </div>

              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-cyan-400" /> I2C 버스 타이밍 표준 요건
                </div>
                <p className="text-[11px] leading-relaxed">
                  SCL Low 시간 최소 {i2cTiming.minLowUs}µs, High 최소 {i2cTiming.minHighUs}µs 요구. 
                  풀업 저항 R_p는 버스 정전용량(C_b)에 따라 2.2kΩ~4.7kΩ을 권장합니다.
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs text-slate-400 block mb-1">SPI 클럭 모드 (CPOL & CPHA)</label>
                <div className="grid grid-cols-2 gap-2">
                  {([0, 1, 2, 3] as SpiMode[]).map((m) => {
                    const cpol = (m === 2 || m === 3) ? 1 : 0;
                    const cpha = (m === 1 || m === 3) ? 1 : 0;
                    return (
                      <button
                        key={m}
                        onClick={() => setSpiMode(m)}
                        className={`p-2 rounded-lg border text-left text-xs ${
                          spiMode === m
                            ? 'bg-indigo-950/60 border-indigo-400 ring-1 ring-indigo-400/40 text-white font-bold'
                            : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="flex justify-between">
                          <span>Mode {m}</span>
                          <span className="text-[10px] text-slate-500 font-mono">CPOL={cpol}, CPHA={cpha}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {cpha === 0 ? 'Leading Edge Sample' : 'Trailing Edge Sample'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-900/70 p-2.5 rounded-lg border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-200 font-medium block">데이터 비트 순서 (DORD)</span>
                  <span className="text-[11px] text-slate-400">{spiMsbFirst ? 'MSB First (최상위 비트 우선)' : 'LSB First (최하위 비트 우선)'}</span>
                </div>
                <button
                  onClick={() => setSpiMsbFirst(!spiMsbFirst)}
                  className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white hover:bg-slate-700"
                >
                  {spiMsbFirst ? 'MSB First' : 'LSB First'}
                </button>
              </div>

              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-400" /> SPI 하드웨어 핀아웃 ({currentProfile.name})
                </div>
                <p className="text-[11px] leading-relaxed">
                  MOSI (PB3), MISO (PB4), SCK (PB5), /SS (PB2). 마스터 모드 시 /SS 핀은 반드시 출력으로 설정하거나 
                  외부에서 항상 HIGH를 유지해야 마스터 상태가 유지됩니다.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Right Column: Payload Data Input & Quick Metrics */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" /> 전송 데이터 페이로드 입력
          </h3>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              페이로드 바이트 배열 (16진수 0x.. 쉼표 구분)
            </label>
            <textarea
              rows={3}
              value={payloadInput}
              onChange={(e) => setPayloadInput(e.target.value)}
              placeholder="0xAA, 0x55, 0x01, 0xFF"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono resize-none focus:outline-none focus:border-cyan-500"
            />
            <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1">
              <span>총 {parsedPayloadBytes.length} 바이트</span>
              <span className="font-mono">
                [{parsedPayloadBytes.map((b) => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(', ')}]
              </span>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
              <span className="text-slate-400 text-[11px] block">총 트랜잭션 소요 시간</span>
              <span className="text-white font-mono font-bold text-sm">
                {efficiencyMetrics.totalTimeUs} µs
              </span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
              <span className="text-slate-400 text-[11px] block">유효 페이로드 대역폭</span>
              <span className="text-cyan-400 font-mono font-bold text-sm">
                {efficiencyMetrics.effectiveThroughputKbps.toLocaleString()} kbps
              </span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
              <span className="text-slate-400 text-[11px] block">비트 전송 효율 (Efficiency)</span>
              <span className="text-emerald-400 font-mono font-bold text-sm">
                {efficiencyMetrics.wireEfficiencyPct}%
              </span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
              <span className="text-slate-400 text-[11px] block">프로토콜 오버헤드 비트</span>
              <span className="text-amber-400 font-mono font-bold text-sm">
                {efficiencyMetrics.overheadBits} bits
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Waveform Visualization Canvas & Diagram */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                데이터시트 타이밍 파형 다이어그램 (Timing Diagram Waveform)
              </h3>
              <p className="text-xs text-slate-400">
                {protocol === 'i2c'
                  ? `SCL (${i2cSpeedKhz}kHz) 및 SDA 라인 - START, 7-bit 주소, ACK, 데이터 바이트, STOP 시퀀스`
                  : `SCK (${spiTiming.sckMhz}MHz Mode ${spiMode}), MOSI 데이터 라인, /SS 칩 셀렉트 라인`}
              </p>
            </div>
          </div>

          {/* Interactive Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                isPlaying
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
              }`}
            >
              {isPlaying ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" /> 정지
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> 파형 재생
                </>
              )}
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setCursorProgress(0);
              }}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
              title="초기화"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrub Bar */}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="text-[11px] font-mono">0.0 µs</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={cursorProgress}
            onChange={(e) => {
              setIsPlaying(false);
              setCursorProgress(parseFloat(e.target.value));
            }}
            className="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
          <span className="text-[11px] font-mono">
            {(cursorProgress * efficiencyMetrics.totalTimeUs).toFixed(1)} / {efficiencyMetrics.totalTimeUs} µs
          </span>
        </div>

        {/* SVG Waveform Visualizer */}
        <div className="w-full overflow-x-auto bg-slate-950/90 border border-slate-800/90 rounded-xl p-3 scrollbar-thin scrollbar-thumb-slate-700">
          <div className="min-w-[920px]">
            {/* SVG Canvas */}
            <svg viewBox={`0 0 ${Math.max(920, waveformSteps.length * 36 + 60)} 240`} className="w-full h-60">
              <defs>
                <linearGradient id="gradScl" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="gradSda" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="gradCs" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0.05" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {waveformSteps.map((_, i) => {
                const x = 50 + i * 36;
                return (
                  <line
                    key={`grid_${i}`}
                    x1={x}
                    y1={20}
                    x2={x}
                    y2={210}
                    stroke="#1e293b"
                    strokeDasharray="2,2"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Line Labels */}
              {protocol === 'i2c' ? (
                <>
                  <text x="10" y="70" fill="#06b6d4" fontSize="12" fontWeight="bold">
                    SCL
                  </text>
                  <text x="10" y="150" fill="#10b981" fontSize="12" fontWeight="bold">
                    SDA
                  </text>
                </>
              ) : (
                <>
                  <text x="10" y="55" fill="#818cf8" fontSize="11" fontWeight="bold">
                    /SS
                  </text>
                  <text x="10" y="115" fill="#06b6d4" fontSize="11" fontWeight="bold">
                    SCK
                  </text>
                  <text x="10" y="175" fill="#10b981" fontSize="11" fontWeight="bold">
                    MOSI
                  </text>
                </>
              )}

              {/* Render Waveform Lines based on Protocol */}
              {protocol === 'i2c' ? (
                <>
                  {/* SCL Waveform */}
                  {waveformSteps.map((step, idx) => {
                    const x = 50 + idx * 36;
                    const nextX = x + 36;
                    const highY = 45;
                    const lowY = 85;

                    let pathD = '';
                    if (step.phase === 'START' || step.phase === 'REP_START' || step.phase === 'STOP') {
                      // START / STOP: SCL stays high
                      pathD = `M ${x} ${highY} L ${nextX} ${highY}`;
                    } else {
                      // Standard clock pulse: Low for half, High for half
                      const midX = x + 18;
                      pathD = `M ${x} ${lowY} L ${midX} ${lowY} L ${midX} ${highY} L ${nextX} ${highY}`;
                    }

                    return (
                      <g key={`scl_${idx}`}>
                        <path d={pathD} stroke="#06b6d4" strokeWidth="2.5" fill="none" />
                        {step.isSamplingPoint && (
                          <circle cx={x + 27} cy={45} r="3" fill="#38bdf8" stroke="#082f49" strokeWidth="1" />
                        )}
                      </g>
                    );
                  })}

                  {/* SDA Waveform */}
                  {waveformSteps.map((step, idx) => {
                    const x = 50 + idx * 36;
                    const nextX = x + 36;
                    const highY = 125;
                    const lowY = 165;

                    let pathD = '';
                    if (step.phase === 'START') {
                      // High -> Low transition
                      const midX = x + 18;
                      pathD = `M ${x} ${highY} L ${midX} ${highY} L ${midX} ${lowY} L ${nextX} ${lowY}`;
                    } else if (step.phase === 'REP_START') {
                      // Repeated START: Low -> High -> Low transition
                      pathD = `M ${x} ${lowY} L ${x + 10} ${highY} L ${x + 25} ${lowY} L ${nextX} ${lowY}`;
                    } else if (step.phase === 'STOP') {
                      // Low -> High transition while SCL is high
                      const midX = x + 18;
                      pathD = `M ${x} ${lowY} L ${midX} ${lowY} L ${midX} ${highY} L ${nextX} ${highY}`;
                    } else {
                      // Data level
                      const currentY = step.dataLevel === 1 ? highY : lowY;
                      pathD = `M ${x} ${currentY} L ${nextX} ${currentY}`;
                    }

                    const strokeColor =
                      step.phase === 'ACK'
                        ? '#34d399'
                        : step.phase === 'NACK'
                        ? '#f87171'
                        : step.phase === 'START' || step.phase === 'STOP' || step.phase === 'REP_START'
                        ? '#f59e0b'
                        : '#10b981';

                    return (
                      <g key={`sda_${idx}`}>
                        <path d={pathD} stroke={strokeColor} strokeWidth="2.5" fill="none" />
                        {/* Bit Annotation Label */}
                        <text
                          x={x + 18}
                          y={195}
                          textAnchor="middle"
                          fill={strokeColor}
                          fontSize="10"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {step.bitLabel}
                        </text>
                        {/* Byte boundary label */}
                        {step.bitIndex === 0 && (
                          <text
                            x={x + 18}
                            y={28}
                            fill="#94a3b8"
                            fontSize="9"
                            fontWeight="600"
                            textAnchor="middle"
                          >
                            {step.byteLabel}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </>
              ) : (
                <>
                  {/* SPI /SS Waveform */}
                  {waveformSteps.map((step, idx) => {
                    const x = 50 + idx * 36;
                    const nextX = x + 36;
                    const highY = 40;
                    const lowY = 65;

                    let currentY = lowY;
                    if (step.phase === 'CS_ASSERT') {
                      currentY = highY;
                    } else if (step.phase === 'CS_DEASSERT') {
                      currentY = highY;
                    }

                    const d = `M ${x} ${currentY} L ${nextX} ${currentY}`;
                    return <path key={`ss_${idx}`} d={d} stroke="#818cf8" strokeWidth="2.5" fill="none" />;
                  })}

                  {/* SPI SCK Waveform */}
                  {waveformSteps.map((step, idx) => {
                    const x = 50 + idx * 36;
                    const nextX = x + 36;
                    const idleY = spiTiming.cpol === 1 ? 95 : 130;
                    const activeY = spiTiming.cpol === 1 ? 130 : 95;

                    let pathD = '';
                    if (step.phase === 'CS_ASSERT' || step.phase === 'CS_DEASSERT') {
                      pathD = `M ${x} ${idleY} L ${nextX} ${idleY}`;
                    } else {
                      const midX = x + 18;
                      pathD = `M ${x} ${idleY} L ${midX} ${idleY} L ${midX} ${activeY} L ${nextX} ${activeY}`;
                    }

                    return (
                      <g key={`sck_${idx}`}>
                        <path d={pathD} stroke="#06b6d4" strokeWidth="2.5" fill="none" />
                        {step.isSamplingPoint && (
                          <circle
                            cx={spiTiming.cpha === 0 ? x + 18 : x + 32}
                            cy={activeY}
                            r="3"
                            fill="#38bdf8"
                            stroke="#082f49"
                            strokeWidth="1"
                          />
                        )}
                      </g>
                    );
                  })}

                  {/* SPI MOSI Waveform */}
                  {waveformSteps.map((step, idx) => {
                    const x = 50 + idx * 36;
                    const nextX = x + 36;
                    const highY = 155;
                    const lowY = 185;

                    const currentY = step.dataLevel === 1 ? highY : lowY;
                    const pathD = `M ${x} ${currentY} L ${nextX} ${currentY}`;

                    return (
                      <g key={`mosi_${idx}`}>
                        <path d={pathD} stroke="#10b981" strokeWidth="2.5" fill="none" />
                        <text
                          x={x + 18}
                          y={205}
                          textAnchor="middle"
                          fill="#10b981"
                          fontSize="10"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {step.bitLabel}
                        </text>
                        {step.bitIndex === 0 && (
                          <text
                            x={x + 18}
                            y={28}
                            fill="#94a3b8"
                            fontSize="9"
                            fontWeight="600"
                            textAnchor="middle"
                          >
                            {step.byteLabel}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </>
              )}

              {/* Interactive Cursor Sweep Line */}
              {cursorProgress > 0 && (
                <line
                  x1={50 + cursorProgress * (waveformSteps.length * 36)}
                  y1={20}
                  x2={50 + cursorProgress * (waveformSteps.length * 36)}
                  y2={215}
                  stroke="#f43f5e"
                  strokeWidth="2"
                  strokeDasharray="4,2"
                />
              )}
            </svg>
          </div>
        </div>

        {/* Legend / Status Badges */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-cyan-400"></span>
            <span>Clock Line ({protocol === 'i2c' ? 'SCL' : 'SCK'})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
            <span>Data Line ({protocol === 'i2c' ? 'SDA' : 'MOSI'})</span>
          </div>
          {protocol === 'i2c' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                <span>START / STOP Condition</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span>Slave ACK (0V Low)</span>
              </div>
            </>
          )}
          {protocol === 'spi' && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-indigo-400"></span>
              <span>/SS (Slave Select Low Active)</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-sky-400 bg-sky-400"></span>
            <span>하드웨어 샘플링 시점 (Sampling Edge)</span>
          </div>
        </div>
      </div>

      {/* Sequence Optimization Suggestions & Efficiency Advisor */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">
              비트 전송 효율 개선 & 시퀀스 최적화 제안 (Optimization Advisor)
            </h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
            Wire Efficiency: {efficiencyMetrics.wireEfficiencyPct}%
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Burst Transmission Benefit */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase">
              <Zap className="w-4 h-4" /> 버스트(Burst) 연속 전송 극대화
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              단일 바이트마다 STOP/START를 반복하면 매 바이트마다 <strong>10클럭(주소 7bit + RW 1bit + ACK + START/STOP)</strong>의 
              순수 오버헤드가 누적됩니다.
            </p>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>단일 전송 시 바이트당 클럭:</span>
                <span className="text-rose-400 font-mono">19 Cycles</span>
              </div>
              <div className="flex justify-between">
                <span>버스트 전송 시 바이트당 클럭:</span>
                <span className="text-emerald-400 font-mono">9 Cycles</span>
              </div>
              <div className="text-emerald-300 font-semibold pt-1">
                ➔ 전송 효율 최대 52% 개선 달성!
              </div>
            </div>
          </div>

          {/* Card 2: Repeated START vs STOP+START */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase">
              <ShieldCheck className="w-4 h-4" /> Repeated START를 통한 버스 점유 유지
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              레지스터 읽기 시 STOP 후 재시작하는 대신 <strong>Repeated START (Sr)</strong>를 사용하면, 
              멀티 마스터 환경에서 버스 중재(Arbitration) 탈취를 원천 방지하고 버스 유휴 지연을 제거합니다.
            </p>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>I2C 버스 유휴 지연 제거:</span>
                <span className="text-cyan-400 font-mono">~4.7 µs 절감</span>
              </div>
              <div className="text-slate-300 font-medium">
                하드웨어 멀티 마스터 버스 점유 보장
              </div>
            </div>
          </div>

          {/* Card 3: Speed / Prescaler Upgrade Recommendation */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase">
              <Clock className="w-4 h-4" /> 클럭 및 배속(SPI2X / 400kHz) 가속 제안
            </div>
            {protocol === 'i2c' ? (
              <>
                <p className="text-xs text-slate-300 leading-relaxed">
                  표준 100kHz에서 Fast Mode(400kHz)로 승격 시 전체 전송 시간이 
                  <strong> {efficiencyMetrics.totalTimeUs} µs</strong>에서 
                  <strong> {efficiencyMetrics.fastModeTimeUs} µs</strong>로 약 75% 대폭 단축됩니다.
                </p>
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 text-[11px] text-slate-400">
                  <span className="text-amber-300 block font-medium">하드웨어 체크포인트:</span>
                  풀업 저항을 2.2kΩ 수준으로 낮추어 상승 시간(Rise Time)을 300ns 이내로 유지하십시오.
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-300 leading-relaxed">
                  AVR 하드웨어 <strong>SPSR의 SPI2X(비트 0)</strong>를 설정하면 클럭 분주기가 2배 가속되어 
                  최대 <strong>{spiTiming.sckMhz} MHz</strong>의 고속 대역폭을 얻을 수 있습니다.
                </p>
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 text-[11px] text-slate-400">
                  <span className="text-emerald-300 block font-medium">소프트웨어 루프 최적화:</span>
                  바이트 전송 시 인라인 함수 및 포인터 증분(*ptr++)을 사용해 폴링 간격 지연을 최소화하세요.
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Embedded C Code Generator */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                자동 생성된 AVR C 임베디드 시퀀스 드라이버 코드
              </h3>
              <p className="text-xs text-slate-400">
                선택한 MCU({currentProfile.name}) 레지스터 및 설정된 타이밍 파라미터가 정확히 반영된 C 소스 코드
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-all flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? '복사 완료!' : 'C 코드 복사'}
            </button>
            <button
              onClick={handleDownloadCode}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> .c 파일 다운로드
            </button>
          </div>
        </div>

        <pre className="p-4 bg-slate-900/90 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[360px] scrollbar-thin scrollbar-thumb-slate-700">
          <code>{generatedCCode}</code>
        </pre>
      </div>
    </div>
  );
};
