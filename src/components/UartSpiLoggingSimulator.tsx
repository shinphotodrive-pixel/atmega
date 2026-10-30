import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Radio,
  Clock,
  Terminal,
  Zap,
  Cpu,
  Copy,
  Check,
  Play,
  Pause,
  RotateCcw,
  Download,
  AlertTriangle,
  Sparkles,
  BarChart3,
  FileCode,
  ShieldAlert,
  ArrowRight,
  Send,
  Sliders,
  Filter
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

type ProtocolType = 'UART' | 'SPI';
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  id: number;
  timestampUs: number;
  level: LogLevel;
  source: string;
  message: string;
  byteCount: number;
  latencyUs: number;
}

export const UartSpiLoggingSimulator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // System Clock Frequency (Hz)
  const [fcpuPreset, setFcpuPreset] = useState<number>(16000000);
  const [isCustomFcpu, setIsCustomFcpu] = useState<boolean>(false);
  const [customFcpuStr, setCustomFcpuStr] = useState<string>('16000000');

  const effectiveFcpu = useMemo(() => {
    if (isCustomFcpu) {
      const parsed = parseFloat(customFcpuStr);
      return isNaN(parsed) || parsed <= 0 ? 16000000 : parsed;
    }
    return fcpuPreset;
  }, [isCustomFcpu, customFcpuStr, fcpuPreset]);

  // Protocol Selection
  const [protocol, setProtocol] = useState<ProtocolType>('UART');

  // UART Settings
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [dataBits, setDataBits] = useState<number>(8);
  const [stopBits, setStopBits] = useState<number>(1);
  const [parity, setParity] = useState<'None' | 'Even' | 'Odd'>('None');
  const [u2xDoubleSpeed, setU2xDoubleSpeed] = useState<boolean>(false);

  // SPI Settings
  const [spiPrescaler, setSpiPrescaler] = useState<number>(4); // f_osc / 4
  const [spi2x, setSpi2x] = useState<boolean>(false);

  // Logging Simulation State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [simLogs, setSimLogs] = useState<LogEntry[]>([
    {
      id: 1,
      timestampUs: 120,
      level: 'INFO',
      source: 'BOOT',
      message: `${currentProfile.name} Core Clock ${effectiveFcpu / 1e6}MHz Initialized`,
      byteCount: 38,
      latencyUs: 0
    },
    {
      id: 2,
      timestampUs: 1450,
      level: 'DEBUG',
      source: 'TIMER0',
      message: 'Prescaler /64, Normal Mode, TOV Interrupt Active',
      byteCount: 48,
      latencyUs: 0
    },
    {
      id: 3,
      timestampUs: 3200,
      level: 'INFO',
      source: 'ADC',
      message: 'ADC Ch0 Sample: 0x02FE (3.89V, Vref=AVCC)',
      byteCount: 37,
      latencyUs: 0
    }
  ]);
  const [customInputMsg, setCustomInputMsg] = useState<string>('Motor target speed reached: 2400 RPM');
  const [customLogLevel, setCustomLogLevel] = useState<LogLevel>('INFO');
  const [filterLevel, setFilterLevel] = useState<string>('ALL');

  // Code Generation State
  const [macroStyle, setMacroStyle] = useState<'progmem' | 'ringbuffer' | 'spi_binary'>('progmem');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Auto log simulation timer
  const simTimerRef = useRef<NodeJS.Timeout | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Calculate bits per character for UART (Start bit 1 + Data bits + Parity bit + Stop bits)
  const bitsPerUartChar = useMemo(() => {
    const parityBit = parity === 'None' ? 0 : 1;
    return 1 + dataBits + parityBit + stopBits;
  }, [dataBits, parity, stopBits]);

  // Calculate Byte Transmission Time (Microseconds)
  const byteLatencyUs = useMemo(() => {
    if (protocol === 'UART') {
      // 1 Char time = (bitsPerUartChar / baudRate) * 1e6
      return (bitsPerUartChar / baudRate) * 1000000;
    } else {
      // SPI: Effective SPI Clock = (spi2x ? 2 : 1) * effectiveFcpu / spiPrescaler
      const effectiveSpiClk = ((spi2x ? 2 : 1) * effectiveFcpu) / spiPrescaler;
      // 8 bits per byte
      return (8 / effectiveSpiClk) * 1000000;
    }
  }, [protocol, bitsPerUartChar, baudRate, spi2x, effectiveFcpu, spiPrescaler]);

  // CPU clock cycles per byte
  const cpuCyclesPerByte = useMemo(() => {
    return Math.round((byteLatencyUs / 1000000) * effectiveFcpu);
  }, [byteLatencyUs, effectiveFcpu]);

  // Standard sample message latency (e.g. 32 bytes message)
  const sampleMsgBytes = 32;
  const sampleMsgLatencyUs = byteLatencyUs * sampleMsgBytes;
  const sampleMsgLatencyMs = sampleMsgLatencyUs / 1000;
  const sampleMsgCycles = cpuCyclesPerByte * sampleMsgBytes;

  // CPU Stalling in typical 10ms control cycle (%)
  const controlLoopPeriodMs = 10; // typical 100Hz motor/sensor control loop
  const blockingPercentIn10ms = Math.min(100, (sampleMsgLatencyMs / controlLoopPeriodMs) * 100);

  // Add simulated log entry
  const addLogMessage = (msg: string, level: LogLevel = 'INFO', src: string = 'APP') => {
    const byteCount = new TextEncoder().encode(msg).length + 2; // + \r\n
    const latency = byteCount * byteLatencyUs;

    setSimLogs(prev => {
      const lastUs = prev.length > 0 ? prev[prev.length - 1].timestampUs : 0;
      const newEntry: LogEntry = {
        id: Date.now() + Math.random(),
        timestampUs: Math.round(lastUs + (latency * 1.5) + Math.random() * 2000),
        level,
        source: src,
        message: msg,
        byteCount,
        latencyUs: Math.round(latency)
      };
      // Keep last 30 logs
      return [...prev.slice(-29), newEntry];
    });
  };

  // Start / Stop periodic simulator
  useEffect(() => {
    if (isRunning) {
      const presets = [
        { msg: 'ADC Ch1 Temp Sensor: 24.8 C (Raw 0x01E4)', level: 'DEBUG' as LogLevel, src: 'ADC' },
        { msg: 'PWM Timer2 Duty update: 75% on OC2A (PB3)', level: 'INFO' as LogLevel, src: 'PWM' },
        { msg: 'UART RX buffer high watermark: 85% full', level: 'WARN' as LogLevel, src: 'COMM' },
        { msg: 'Heartbeat ping: Uptime 1420s, Heap free 892B', level: 'INFO' as LogLevel, src: 'SYS' },
        { msg: 'I2C Bus ACK timeout on 0x68 sensor register', level: 'ERROR' as LogLevel, src: 'I2C' },
        { msg: 'External INT0 triggered: Falling edge captured', level: 'DEBUG' as LogLevel, src: 'ISR' }
      ];

      simTimerRef.current = setInterval(() => {
        const item = presets[Math.floor(Math.random() * presets.length)];
        addLogMessage(item.msg, item.level, item.src);
      }, 1200);
    } else {
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
      }
    }
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, [isRunning, byteLatencyUs]);

  // Scroll to bottom when logs update
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [simLogs]);

  // Filtered logs
  const displayedLogs = useMemo(() => {
    if (filterLevel === 'ALL') return simLogs;
    return simLogs.filter(l => l.level === filterLevel);
  }, [simLogs, filterLevel]);

  // C Lightweight Logging Macro Code Generator
  const generatedCHeader = useMemo(() => {
    const isProgmem = macroStyle === 'progmem';
    const isRingBuffer = macroStyle === 'ringbuffer';
    const isSpi = macroStyle === 'spi_binary';

    if (isProgmem) {
      return `/* =========================================================================
 * avr_fast_log.h - Ultra-Lightweight Zero-SRAM UART Logging System
 * Target MCU : ${currentProfile.name} @ ${effectiveFcpu / 1e6} MHz
 * Config     : UART 8N1 @ ${baudRate} bps (Byte Latency: ${byteLatencyUs.toFixed(2)} µs)
 * Savings    : Saves ~2.4KB Flash & 100% String SRAM compared to printf()
 * ========================================================================= */
#ifndef AVR_FAST_LOG_H
#define AVR_FAST_LOG_H

#include <avr/io.h>
#include <avr/pgmspace.h>

/* --- Logging Level Filter (Set at compile time to eliminate dead code) --- */
#define LOG_LEVEL_DEBUG 0
#define LOG_LEVEL_INFO  1
#define LOG_LEVEL_WARN  2
#define LOG_LEVEL_ERROR 3
#define LOG_LEVEL_OFF   4

#ifndef ACTIVE_LOG_LEVEL
#define ACTIVE_LOG_LEVEL LOG_LEVEL_DEBUG
#endif

/* --- Low-level Polling UART Transmit Routine --- */
static inline void uart_putc(char c) {
    /* Wait until Transmit Data Register is Empty (UDRE0) */
    while (!(UCSR0A & (1 << UDRE0)));
    UDR0 = c;
}

/* Transmit String directly from Flash Program Memory (PROGMEM) without copying to SRAM */
static inline void uart_puts_P(const char *progmem_str) {
    char c;
    while ((c = pgm_read_byte(progmem_str++))) {
        uart_putc(c);
    }
}

/* Fast Lightweight Integer to Decimal Converter (No heavy sprintf/divmod library) */
static inline void uart_put_dec(uint16_t val) {
    char buf[6];
    char *p = buf + sizeof(buf) - 1;
    *p = '\\0';
    if (val == 0) {
        uart_putc('0');
        return;
    }
    while (val > 0) {
        *(--p) = (char)('0' + (val % 10));
        val /= 10;
    }
    while (*p) {
        uart_putc(*p++);
    }
}

/* Fast 8-bit Hexadecimal Output (e.g., "0x2A") */
static inline void uart_put_hex8(uint8_t b) {
    static const char hex_chars[] PROGMEM = "0123456789ABCDEF";
    uart_putc('0');
    uart_putc('x');
    uart_putc(pgm_read_byte(&hex_chars[(b >> 4) & 0x0F]));
    uart_putc(pgm_read_byte(&hex_chars[b & 0x0F]));
}

/* --- Zero-Overhead Logging Macros (String Literals stored in Flash via PSTR) --- */
#define LOG_RAW_P(pstr) uart_puts_P(PSTR(pstr))

#if (ACTIVE_LOG_LEVEL <= LOG_LEVEL_DEBUG)
  #define LOG_DEBUG(fmt) do { uart_puts_P(PSTR("[DBG] " fmt "\\r\\n")); } while(0)
  #define LOG_DEBUG_VAL(tag, val) do { uart_puts_P(PSTR("[DBG] " tag ": ")); uart_put_dec(val); uart_puts_P(PSTR("\\r\\n")); } while(0)
#else
  #define LOG_DEBUG(fmt) ((void)0)
  #define LOG_DEBUG_VAL(tag, val) ((void)0)
#endif

#if (ACTIVE_LOG_LEVEL <= LOG_LEVEL_INFO)
  #define LOG_INFO(fmt) do { uart_puts_P(PSTR("[INF] " fmt "\\r\\n")); } while(0)
  #define LOG_INFO_HEX(tag, val) do { uart_puts_P(PSTR("[INF] " tag ": ")); uart_put_hex8(val); uart_puts_P(PSTR("\\r\\n")); } while(0)
#else
  #define LOG_INFO(fmt) ((void)0)
  #define LOG_INFO_HEX(tag, val) ((void)0)
#endif

#if (ACTIVE_LOG_LEVEL <= LOG_LEVEL_WARN)
  #define LOG_WARN(fmt) do { uart_puts_P(PSTR("[WRN] " fmt "\\r\\n")); } while(0)
#else
  #define LOG_WARN(fmt) ((void)0)
#endif

#if (ACTIVE_LOG_LEVEL <= LOG_LEVEL_ERROR)
  #define LOG_ERROR(fmt) do { uart_puts_P(PSTR("[ERR] " fmt "\\r\\n")); } while(0)
#else
  #define LOG_ERROR(fmt) ((void)0)
#endif

/* Example Usage:
 * LOG_INFO("System Boot Finished");
 * LOG_DEBUG_VAL("ADC Value", 512);
 * LOG_INFO_HEX("Status Reg", 0x2A);
 */

#endif /* AVR_FAST_LOG_H */`;
    }

    if (isRingBuffer) {
      return `/* =========================================================================
 * avr_async_ringlog.h - Non-Blocking Interrupt-Driven Circular Buffer Logger
 * Target MCU : ${currentProfile.name} @ ${effectiveFcpu / 1e6} MHz
 * Zero-Wait  : CPU does NOT stall waiting for UART hardware register!
 * Buffer Size: 64 Bytes Circular FIFO (Customizable)
 * ========================================================================= */
#ifndef AVR_ASYNC_RINGLOG_H
#define AVR_ASYNC_RINGLOG_H

#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/pgmspace.h>

#define TX_RING_BUFFER_SIZE 64

typedef struct {
    volatile uint8_t buffer[TX_RING_BUFFER_SIZE];
    volatile uint8_t head;
    volatile uint8_t tail;
} RingBuffer_t;

static RingBuffer_t tx_ring;

/* Initialize UART with UDRIE0 Interrupt Support */
static inline void uart_async_init(void) {
    tx_ring.head = 0;
    tx_ring.tail = 0;

    /* Baud Rate Register Calculation (${baudRate} bps @ ${effectiveFcpu} Hz) */
    #define ASYNC_UBRR (${Math.round(effectiveFcpu / (16 * baudRate) - 1)})
    UBRR0H = (uint8_t)(ASYNC_UBRR >> 8);
    UBRR0L = (uint8_t)(ASYNC_UBRR);

    /* Enable TX and 8-bit mode */
    UCSR0B = (1 << TXEN0);
    UCSR0C = (1 << UCSZ01) | (1 << UCSZ00);
}

/* Non-blocking Enqueue Byte into Circular Buffer */
static inline void uart_async_putc(char c) {
    uint8_t next_head = (tx_ring.head + 1) % TX_RING_BUFFER_SIZE;
    if (next_head != tx_ring.tail) {
        tx_ring.buffer[tx_ring.head] = (uint8_t)c;
        tx_ring.head = next_head;
        /* Enable Data Register Empty Interrupt to start transmission */
        UCSR0B |= (1 << UDRIE0);
    }
}

/* Enqueue Flash String Non-blocking */
static inline void uart_async_puts_P(const char *progmem_str) {
    char c;
    while ((c = pgm_read_byte(progmem_str++))) {
        uart_async_putc(c);
    }
}

/* ISR for USART Data Register Empty - Transmits bytes in background */
ISR(USART_UDRE_vect) {
    if (tx_ring.head != tx_ring.tail) {
        UDR0 = tx_ring.buffer[tx_ring.tail];
        tx_ring.tail = (tx_ring.tail + 1) % TX_RING_BUFFER_SIZE;
    } else {
        /* Buffer is empty, disable interrupt to avoid infinite loop */
        UCSR0B &= ~(1 << UDRIE0);
    }
}

#define ASYNC_LOG(str) uart_async_puts_P(PSTR(str "\\r\\n"))

#endif /* AVR_ASYNC_RINGLOG_H */`;
    }

    // SPI Binary Packet Mode
    return `/* =========================================================================
 * avr_spi_telemetry_log.h - Ultra-High-Speed Binary SPI Packet Logger
 * Target MCU : ${currentProfile.name} @ ${effectiveFcpu / 1e6} MHz
 * Speed      : SPI Clock ${(effectiveFcpu / (spiPrescaler * (spi2x ? 0.5 : 1)) / 1e6).toFixed(2)} MHz (Byte Latency: ${byteLatencyUs.toFixed(2)} µs)
 * Throughput : 10~50x faster than UART; ideal for high-speed logic analyzers & blackboxes
 * ========================================================================= */
#ifndef AVR_SPI_TELEMETRY_LOG_H
#define AVR_SPI_TELEMETRY_LOG_H

#include <avr/io.h>

/* Standard 8-Byte High-Speed Telemetry Packet Header */
typedef struct __attribute__((packed)) {
    uint8_t sync_marker; /* 0xAA */
    uint8_t msg_id;      /* Message Type ID */
    uint16_t timestamp;  /* Millisecond Tick Counter */
    int16_t payload_val; /* Sensor or Status Value */
    uint16_t checksum;   /* Simple XOR or Fletcher CRC */
} SpiTelemetryPacket_t;

/* Initialize Hardware SPI as Master */
static inline void spi_logger_init(void) {
    /* Set MOSI and SCK as Output, SS as Output (Slave Select) */
    DDRB |= (1 << DDB3) | (1 << DDB5) | (1 << DDB2);
    PORTB |= (1 << PORTB2); // Deassert SS High

    /* Enable SPI, Master Mode, Clock Rate: f_osc/${spiPrescaler} */
    SPCR = (1 << SPE) | (1 << MSTR) ${spiPrescaler === 16 ? '| (1 << SPR0)' : spiPrescaler === 64 ? '| (1 << SPR1)' : ''};
    ${spi2x ? 'SPSR |= (1 << SPI2X); // Double Speed' : ''}
}

/* Transmit 1 Byte over SPI (100% Hardware Shift Register) */
static inline uint8_t spi_transfer(uint8_t data) {
    SPDR = data;
    while (!(SPSR & (1 << SPIF))); // Takes ~${(byteLatencyUs * 16).toFixed(0)} CPU cycles only
    return SPDR;
}

/* Send Fast Compact Telemetry Frame */
static inline void spi_send_telemetry(uint8_t id, int16_t val) {
    SpiTelemetryPacket_t pkt;
    pkt.sync_marker = 0xAA;
    pkt.msg_id = id;
    pkt.timestamp = (uint16_t)(TCNT1); // Use timer tick
    pkt.payload_val = val;
    pkt.checksum = (uint16_t)(pkt.sync_marker ^ pkt.msg_id ^ pkt.payload_val);

    PORTB &= ~(1 << PORTB2); // Assert SS Low
    const uint8_t *ptr = (const uint8_t *)&pkt;
    for (uint8_t i = 0; i < sizeof(SpiTelemetryPacket_t); i++) {
        spi_transfer(ptr[i]);
    }
    PORTB |= (1 << PORTB2);  // Release SS High
}

#endif /* AVR_SPI_TELEMETRY_LOG_H */`;
  }, [macroStyle, currentProfile, effectiveFcpu, baudRate, byteLatencyUs, spiPrescaler, spi2x]);

  const handleCopyCode = (key: string) => {
    navigator.clipboard.writeText(generatedCHeader);
    setCopiedKey(key);
    confetti({
      particleCount: 28,
      spread: 45,
      origin: { y: 0.85 }
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadCode = () => {
    const filename = macroStyle === 'progmem' 
      ? 'avr_fast_log.h' 
      : macroStyle === 'ringbuffer' 
      ? 'avr_async_ringlog.h' 
      : 'avr_spi_telemetry_log.h';
    const blob = new Blob([generatedCHeader], { type: 'text/x-csrc' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendCustomLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInputMsg.trim()) return;
    addLogMessage(customInputMsg.trim(), customLogLevel, 'USER');
    setCustomInputMsg('');
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl backdrop-blur relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute -top-32 -right-32 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-inner">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base md:text-lg font-bold text-white tracking-wide">
                  UART / SPI 실시간 로깅 시뮬레이터 & 경량 매크로 생성기
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  Zero-SRAM Log Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                선택한 MCU의 클럭 속도에 맞춰 시리얼 통신 지연 시간(Latency) 및 CPU 블로킹 오버헤드를 정밀 계산하고, 무거운 printf()를 대체하는 초경량 로깅 헤더 코드를 제공합니다.
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
              className="bg-slate-950 border border-slate-700 hover:border-cyan-500 text-xs text-cyan-300 font-mono rounded-xl px-2.5 py-1.5 focus:outline-none transition-colors"
            >
              {Object.keys(MCU_PROFILES).map((mcuKey) => (
                <option key={mcuKey} value={mcuKey}>
                  {MCU_PROFILES[mcuKey as SupportedMCU].name}
                </option>
              ))}
            </select>
          )}
          <span className="text-xs font-mono text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            {currentProfile.name}
          </span>
        </div>
      </div>

      {/* Control Configuration Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/70 p-4 rounded-2xl border border-slate-800 relative z-10">
        {/* 1. Protocol Mode Switch */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            통신 인터페이스 모드:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setProtocol('UART')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                protocol === 'UART'
                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-600/30'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>UART 직렬 통신</span>
            </button>
            <button
              onClick={() => setProtocol('SPI')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                protocol === 'SPI'
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>SPI 고속 버스</span>
            </button>
          </div>
        </div>

        {/* 2. System Clock Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              시스템 클럭 (F_CPU):
            </label>
            <button
              type="button"
              onClick={() => setIsCustomFcpu(!isCustomFcpu)}
              className="text-[10px] text-amber-400 hover:text-amber-300 underline font-mono"
            >
              {isCustomFcpu ? '프리셋 선택' : '직접 입력'}
            </button>
          </div>

          {isCustomFcpu ? (
            <div className="relative">
              <input
                type="number"
                value={customFcpuStr}
                onChange={(e) => setCustomFcpuStr(e.target.value)}
                placeholder="16000000"
                className="w-full bg-slate-900 border border-amber-500/50 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
              />
              <span className="absolute right-3 top-2 text-[10px] text-slate-500 font-mono">Hz</span>
            </div>
          ) : (
            <select
              value={fcpuPreset}
              onChange={(e) => setFcpuPreset(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            >
              <option value={16000000}>16.0 MHz (5V 표준 아두이노)</option>
              <option value={20000000}>20.0 MHz (최대 오버클럭)</option>
              <option value={8000000}>8.0 MHz (내부 RC / 3.3V 저전력)</option>
              <option value={1000000}>1.0 MHz (공장 출하 1MHz 기본값)</option>
            </select>
          )}
        </div>

        {/* 3. Baud Rate or SPI Prescaler */}
        <div className="space-y-2">
          {protocol === 'UART' ? (
            <>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  UART 통신 속도 (Baud Rate):
                </label>
                <label className="flex items-center gap-1 text-[11px] text-cyan-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={u2xDoubleSpeed}
                    onChange={(e) => setU2xDoubleSpeed(e.target.checked)}
                    className="accent-cyan-500 rounded"
                  />
                  <span>U2X 배속</span>
                </label>
              </div>
              <select
                value={baudRate}
                onChange={(e) => setBaudRate(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              >
                <option value={9600}>9600 bps (기본 느린 속도)</option>
                <option value={19200}>19200 bps</option>
                <option value={38400}>38400 bps</option>
                <option value={57600}>57600 bps</option>
                <option value={115200}>115200 bps (권장 표준)</option>
                <option value={230400}>230400 bps</option>
                <option value={250000}>250000 bps (16MHz 0% 오차)</option>
                <option value={500000}>500000 bps (고속 디버깅)</option>
                <option value={1000000}>1000000 bps (1 Mbps)</option>
                <option value={2000000}>2000000 bps (2 Mbps, 최대)</option>
              </select>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  SPI 클럭 분주비 (Prescaler):
                </label>
                <label className="flex items-center gap-1 text-[11px] text-indigo-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={spi2x}
                    onChange={(e) => setSpi2x(e.target.checked)}
                    className="accent-indigo-500 rounded"
                  />
                  <span>SPI2X 2배속</span>
                </label>
              </div>
              <select
                value={spiPrescaler}
                onChange={(e) => setSpiPrescaler(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              >
                <option value={2}>f_osc / 2 ({((effectiveFcpu / 2) / 1e6).toFixed(1)} MHz)</option>
                <option value={4}>f_osc / 4 ({((effectiveFcpu / 4) / 1e6).toFixed(1)} MHz, 표준)</option>
                <option value={8}>f_osc / 8 ({((effectiveFcpu / 8) / 1e6).toFixed(1)} MHz)</option>
                <option value={16}>f_osc / 16 ({((effectiveFcpu / 16) / 1e6).toFixed(2)} MHz)</option>
                <option value={32}>f_osc / 32 ({((effectiveFcpu / 32) / 1e6).toFixed(2)} MHz)</option>
                <option value={64}>f_osc / 64 ({((effectiveFcpu / 64) / 1e6).toFixed(2)} MHz)</option>
                <option value={128}>f_osc / 128 ({((effectiveFcpu / 128) / 1e6).toFixed(3)} MHz)</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* Latency & Hardware Overhead Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 relative z-10">
        {/* Metric 1: 1-Byte Latency */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>단일 바이트(1 Byte) 지연</span>
            <span className="text-[10px] font-mono text-cyan-400">{protocol === 'UART' ? '8N1 10-bit' : '8-bit SPI'}</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {byteLatencyUs < 1 ? `${(byteLatencyUs * 1000).toFixed(1)} ns` : `${byteLatencyUs.toFixed(2)} µs`}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {cpuCyclesPerByte.toLocaleString()} CPU 사이클 소요
          </div>
        </div>

        {/* Metric 2: 32-Byte Sample Message Blocking Time */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>32바이트 로그 메시지 지연</span>
            <span className="text-[10px] font-mono text-amber-400">블로킹 전송</span>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300">
            {sampleMsgLatencyMs >= 1 ? `${sampleMsgLatencyMs.toFixed(2)} ms` : `${sampleMsgLatencyUs.toFixed(1)} µs`}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            총 {sampleMsgCycles.toLocaleString()} 사이클 대기
          </div>
        </div>

        {/* Metric 3: Control Loop Blocking Overhead */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>10ms 제어 루프 점유율</span>
            <span className="text-[10px] font-mono text-rose-400">100Hz 루프 기준</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${blockingPercentIn10ms > 20 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {blockingPercentIn10ms.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-500">
              {blockingPercentIn10ms > 50 ? '심각한 루프 정체' : blockingPercentIn10ms > 10 ? '주의 필요' : '양호'}
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                blockingPercentIn10ms > 50 ? 'bg-rose-500' : blockingPercentIn10ms > 20 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, blockingPercentIn10ms)}%` }}
            />
          </div>
        </div>

        {/* Metric 4: printf() vs Light Macro Efficiency */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>printf() 대비 메모리 절감</span>
            <span className="text-[10px] font-mono text-emerald-400">avr-gcc 최적화</span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-300">
            -2.4 KB Flash
          </div>
          <div className="text-[11px] text-emerald-400/90 font-mono">
            SRAM 100% 절감 (PROGMEM)
          </div>
        </div>
      </div>

      {/* Warning Alert if Latency is High */}
      {protocol === 'UART' && baudRate <= 9600 && (
        <div className="p-3.5 bg-amber-950/30 border border-amber-600/50 rounded-2xl text-xs text-amber-300 leading-relaxed flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white">주의: 9600 bps의 높은 전송 지연 시간(1바이트당 1.04ms)</strong>
            <p className="text-[11px] text-amber-200/80 mt-0.5">
              인터럽트 서비스 루틴(ISR)이나 주기적 센서 제어 루프 내부에서 블로킹 방식으로 UART 출력을 호출하면 MCU가 수십 ms 동안 멈추게 됩니다. 고속 보레이트(115200bps 이상)로 상향하거나 비동기 링버퍼(Ring Buffer) 매크로를 사용하세요.
            </p>
          </div>
        </div>
      )}

      {/* Section: Live Serial Logging Simulator Console */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-inner space-y-0">
        {/* Console Header Bar */}
        <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {protocol} 실시간 펌웨어 로깅 시뮬레이션 콘솔
            </span>
            <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800/50">
              {protocol === 'UART' ? `${baudRate} bps` : `SPI ${(effectiveFcpu / spiPrescaler / 1e6).toFixed(2)}MHz`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter */}
            <div className="flex items-center gap-1 text-[11px] font-mono">
              <Filter className="w-3 h-3 text-slate-500" />
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-300 focus:outline-none"
              >
                <option value="ALL">전체 레벨</option>
                <option value="DEBUG">DEBUG만</option>
                <option value="INFO">INFO만</option>
                <option value="WARN">WARN만</option>
                <option value="ERROR">ERROR만</option>
              </select>
            </div>

            {/* Sim Controls */}
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                isRunning
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
              }`}
            >
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isRunning ? '일시 정지' : '자동 스트림 시작'}</span>
            </button>

            <button
              onClick={() => setSimLogs([])}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="콘솔 로그 초기화"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Log Stream Output Box */}
        <div
          ref={logContainerRef}
          className="p-4 h-64 overflow-y-auto font-mono text-xs space-y-1.5 custom-scrollbar bg-slate-950"
        >
          {displayedLogs.length === 0 ? (
            <div className="text-slate-600 text-center py-16 italic">
              로그 메시지가 없습니다. 상단의 "자동 스트림 시작"을 누르거나 아래에서 직접 메시지를 전송하세요.
            </div>
          ) : (
            displayedLogs.map((log) => {
              const levelColor =
                log.level === 'DEBUG'
                  ? 'text-cyan-400 bg-cyan-950/60 border-cyan-800/40'
                  : log.level === 'INFO'
                  ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40'
                  : log.level === 'WARN'
                  ? 'text-amber-400 bg-amber-950/60 border-amber-800/40'
                  : 'text-rose-400 bg-rose-950/60 border-rose-800/40';

              return (
                <div
                  key={log.id}
                  className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-500 text-[10px]">
                      [{(log.timestampUs / 1000).toFixed(2)}ms]
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${levelColor}`}>
                      {log.level}
                    </span>
                    <span className="text-indigo-400 font-semibold text-[11px]">
                      &lt;{log.source}&gt;
                    </span>
                    <span className="text-slate-200">
                      {log.message}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-500 shrink-0 font-mono">
                    <span>{log.byteCount} Bytes</span>
                    <span>•</span>
                    <span className="text-cyan-400 font-medium">
                      지연: {log.latencyUs > 1000 ? `${(log.latencyUs / 1000).toFixed(2)}ms` : `${log.latencyUs}µs`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Interactive Custom Message Sender */}
        <form onSubmit={handleSendCustomLog} className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center gap-2">
          <select
            value={customLogLevel}
            onChange={(e) => setCustomLogLevel(e.target.value as LogLevel)}
            className="bg-slate-950 border border-slate-700 text-xs rounded-xl px-2.5 py-1.5 text-slate-300 font-mono focus:outline-none"
          >
            <option value="DEBUG">DEBUG</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>

          <input
            type="text"
            value={customInputMsg}
            onChange={(e) => setCustomInputMsg(e.target.value)}
            placeholder="시뮬레이션할 펌웨어 로그 메시지를 입력하세요 (예: Sensor OK, Value=128)"
            className="flex-1 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
          />

          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-md shadow-cyan-600/20"
          >
            <Send className="w-3.5 h-3.5" />
            <span>로그 전송</span>
          </button>
        </form>
      </div>

      {/* printf() vs Lightweight Macro Benchmark Comparison Table */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            표준 printf() vs 경량 로깅 매크로 하드웨어 리소스 비교
          </h4>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/70">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                <th className="p-3">비교 항목</th>
                <th className="p-3 text-rose-400">표준 printf() (vfprintf)</th>
                <th className="p-3 text-emerald-400">초경량 매크로 (avr_fast_log.h)</th>
                <th className="p-3 text-cyan-400">개선 효과</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              <tr>
                <td className="p-3 font-semibold text-white">Flash ROM 크기</td>
                <td className="p-3 text-rose-400 font-bold">~1.8 KB ~ 4.2 KB</td>
                <td className="p-3 text-emerald-400 font-bold">~120 Bytes (직접 I/O)</td>
                <td className="p-3 text-cyan-300">Flash 95% 절약 (소형 MCU 필수)</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-white">SRAM 메모리 소비</td>
                <td className="p-3 text-rose-400 font-bold">문자열 전체 SRAM 복사</td>
                <td className="p-3 text-emerald-400 font-bold">0 Byte (PSTR/PROGMEM 저장)</td>
                <td className="p-3 text-cyan-300">SRAM 부족으로 인한 스택 오버플로우 방지</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-white">포맷팅 연산 지연</td>
                <td className="p-3 text-rose-400 font-bold">350~900 CPU 사이클/호출</td>
                <td className="p-3 text-emerald-400 font-bold">15~35 CPU 사이클</td>
                <td className="p-3 text-cyan-300">약 25배 이상 빠른 실행 속도</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-white">릴리스 빌드 최적화</td>
                <td className="p-3 text-slate-400">수동 주석 처리 필요</td>
                <td className="p-3 text-emerald-400 font-bold">컴파일 타임 0바이트 제거</td>
                <td className="p-3 text-cyan-300">#define ACTIVE_LOG_LEVEL 필터링 지원</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Lightweight C Code Header Generator */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              경량 로깅 헤더 파일 생성기 (C/C++ Bare-Metal)
            </h4>
          </div>

          {/* Style Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setMacroStyle('progmem')}
              className={`px-3 py-1.5 rounded-lg transition ${
                macroStyle === 'progmem'
                  ? 'bg-cyan-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Zero-SRAM (PROGMEM)
            </button>
            <button
              onClick={() => setMacroStyle('ringbuffer')}
              className={`px-3 py-1.5 rounded-lg transition ${
                macroStyle === 'ringbuffer'
                  ? 'bg-cyan-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              비동기 링버퍼 (Non-Blocking)
            </button>
            <button
              onClick={() => setMacroStyle('spi_binary')}
              className={`px-3 py-1.5 rounded-lg transition ${
                macroStyle === 'spi_binary'
                  ? 'bg-cyan-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              SPI 초고속 바이너리
            </button>
          </div>
        </div>

        {/* Code Output Window */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span className="text-white font-bold">
                {macroStyle === 'progmem'
                  ? 'avr_fast_log.h (Zero-SRAM PROGMEM Logger)'
                  : macroStyle === 'ringbuffer'
                  ? 'avr_async_ringlog.h (Interrupt Ring Buffer TX)'
                  : 'avr_spi_telemetry_log.h (High-Speed SPI Frame)'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadCode}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-[11px]"
                title="헤더 파일(.h) 다운로드"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.h 다운로드</span>
              </button>

              <button
                onClick={() => handleCopyCode('header')}
                className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition flex items-center gap-1.5 text-[11px] font-bold shadow-md shadow-cyan-600/20"
              >
                {copiedKey === 'header' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>복사 완료!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>코드 복사</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <pre className="p-4 text-xs font-mono text-cyan-300 overflow-x-auto leading-relaxed select-all max-h-96">
            {generatedCHeader}
          </pre>
        </div>
      </div>
    </div>
  );
};
