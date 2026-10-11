import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Radio,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Download,
  Terminal,
  Activity,
  Layers,
  Sparkles,
  Info,
  Zap,
  TrendingUp,
  Cpu,
  FileCode2,
  Search,
  Filter
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export interface UartPacket {
  id: string;
  timestampMs: number;
  direction: 'RX' | 'TX';
  rawBytes: number[];
  header: number[];
  msgId: number;
  payloadLength: number;
  payload: number[];
  receivedChecksum: number;
  expectedChecksum: number;
  tail: number;
  isValid: boolean;
  errorReason?: string;
}

// Preset Test Packets
const PRESET_PACKETS: { name: string; bytesHex: string; desc: string }[] = [
  {
    name: '정상 텔레메트리 센서 패킷 (PASS)',
    bytesHex: 'AA 55 05 01 12 34 56 78 75 03',
    desc: 'Header: AA 55, Len: 5, ID: 01, Payload: 12 34 56 78, Sum Checksum: 75, Tail: 03 (완벽한 프로토콜 준수)'
  },
  {
    name: '모터 PWM 속도 제어 명령 (PASS)',
    bytesHex: 'AA 55 03 02 03 E8 EC 03',
    desc: 'Header: AA 55, Len: 3, ID: 02 (SET_SPEED), Payload: 03 E8 (1000 RPM), Checksum: EC, Tail: 03'
  },
  {
    name: '체크섬 변조/노이즈 손상 패킷 (FAIL)',
    bytesHex: 'AA 55 05 01 12 34 56 78 FF 03',
    desc: '체크섬이 0x75여야 하나 전송 노이즈로 0xFF로 변조되어 무결성 검증 실패 탐지'
  },
  {
    name: '헤더 싱크 손실 패킷 (FAIL)',
    bytesHex: 'FE 55 05 01 12 34 56 78 75 03',
    desc: '프리앰블 헤더 첫 바이트가 0xAA가 아닌 0xFE로 깨져 동기화 프레이밍 에러 발생'
  },
  {
    name: '길이 불일치 조기 단락 패킷 (FAIL)',
    bytesHex: 'AA 55 06 01 12 34 56 03',
    desc: '길이 필드는 6바이트로 선언되었으나 데이터가 3바이트만 수신되어 패킷 단락 발생'
  }
];

// Helper: Calculate 8-bit sum checksum
function calcChecksum8(bytes: number[]): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) {
    sum = (sum + bytes[i]) & 0xff;
  }
  return sum;
}

// Helper: Parse UART packet using standard framing [0xAA, 0x55, LEN, MSG_ID, PAYLOAD..., CHECKSUM, 0x03]
function parseUartPacket(rawBytes: number[], timestampMs: number, direction: 'RX' | 'TX' = 'RX'): UartPacket {
  const id = `pkt_${timestampMs}_${Math.random().toString(36).substr(2, 4)}`;

  if (rawBytes.length < 5) {
    return {
      id,
      timestampMs,
      direction,
      rawBytes,
      header: rawBytes.slice(0, 2),
      msgId: 0,
      payloadLength: 0,
      payload: [],
      receivedChecksum: 0,
      expectedChecksum: 0,
      tail: 0,
      isValid: false,
      errorReason: '패킷 길이 부족 (최소 5바이트 이상 필요)'
    };
  }

  const h0 = rawBytes[0];
  const h1 = rawBytes[1];
  const hasValidHeader = h0 === 0xaa && h1 === 0x55;

  if (!hasValidHeader) {
    return {
      id,
      timestampMs,
      direction,
      rawBytes,
      header: [h0, h1],
      msgId: rawBytes[3] || 0,
      payloadLength: rawBytes[2] || 0,
      payload: rawBytes.slice(4, rawBytes.length - 2),
      receivedChecksum: rawBytes[rawBytes.length - 2] || 0,
      expectedChecksum: 0,
      tail: rawBytes[rawBytes.length - 1] || 0,
      isValid: false,
      errorReason: `헤더 불일치 (예상 0xAA 0x55, 수신 0x${h0.toString(16).toUpperCase()} 0x${h1.toString(16).toUpperCase()})`
    };
  }

  const payloadLength = rawBytes[2];
  const msgId = rawBytes[3];
  const tail = rawBytes[rawBytes.length - 1];
  const receivedChecksum = rawBytes[rawBytes.length - 2];

  // Expected length = 2 (Header) + 1 (Len) + 1 (MsgID) + (Len - 1 Payload) + 1 (Checksum) + 1 (Tail)
  // Here Len represents msgId + payload bytes count
  const expectedTotalLen = 2 + 1 + payloadLength + 1 + 1;
  const actualPayload = rawBytes.slice(4, rawBytes.length - 2);

  if (rawBytes.length !== expectedTotalLen) {
    return {
      id,
      timestampMs,
      direction,
      rawBytes,
      header: [h0, h1],
      msgId,
      payloadLength,
      payload: actualPayload,
      receivedChecksum,
      expectedChecksum: 0,
      tail,
      isValid: false,
      errorReason: `길이 불일치 (선언 길이: ${payloadLength}B, 실제 수신: ${rawBytes.length}B)`
    };
  }

  if (tail !== 0x03) {
    return {
      id,
      timestampMs,
      direction,
      rawBytes,
      header: [h0, h1],
      msgId,
      payloadLength,
      payload: actualPayload,
      receivedChecksum,
      expectedChecksum: 0,
      tail,
      isValid: false,
      errorReason: `테일(종료 바이트) 오류 (예상 0x03, 수신 0x${tail.toString(16).toUpperCase()})`
    };
  }

  // Calculate checksum over [msgId + payload]
  const checksumRange = [msgId, ...actualPayload];
  const expectedChecksum = calcChecksum8(checksumRange);

  if (receivedChecksum !== expectedChecksum) {
    return {
      id,
      timestampMs,
      direction,
      rawBytes,
      header: [h0, h1],
      msgId,
      payloadLength,
      payload: actualPayload,
      receivedChecksum,
      expectedChecksum,
      tail,
      isValid: false,
      errorReason: `체크섬 불일치 (수신 0x${receivedChecksum.toString(16).toUpperCase()} != 계산 0x${expectedChecksum.toString(16).toUpperCase()})`
    };
  }

  return {
    id,
    timestampMs,
    direction,
    rawBytes,
    header: [h0, h1],
    msgId,
    payloadLength,
    payload: actualPayload,
    receivedChecksum,
    expectedChecksum,
    tail,
    isValid: true
  };
}

export const SerialProtocolDataLogger: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // UART Timing & Baud Rate Parameters
  const [fcpuHz, setFcpuHz] = useState<number>(16000000);
  const [targetBaud, setTargetBaud] = useState<number>(115200);
  const [useU2x, setUseU2x] = useState<boolean>(true); // U2X0 Double Speed mode

  // Packet Stream Logger State
  const [customInputHex, setCustomInputHex] = useState<string>('AA 55 05 01 12 34 56 78 75 03');
  const [packets, setPackets] = useState<UartPacket[]>(() => {
    return PRESET_PACKETS.map((p, idx) => {
      const bytes = p.bytesHex.split(' ').map((h) => parseInt(h, 16));
      return parseUartPacket(bytes, idx * 120 + 10);
    });
  });

  const [selectedPacketId, setSelectedPacketId] = useState<string>(packets[0]?.id || '');
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [filterValid, setFilterValid] = useState<'all' | 'valid' | 'invalid'>('all');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate Baud Rate Error & UBRR
  const baudCalculations = useMemo(() => {
    const divisor = useU2x ? 8 : 16;
    // UBRR formula
    const ubrrFloat = fcpuHz / (divisor * targetBaud) - 1;
    const ubrr = Math.max(0, Math.round(ubrrFloat));
    // Actual baud achieved
    const actualBaud = fcpuHz / (divisor * (ubrr + 1));
    // Error percentage
    const errorPct = ((actualBaud - targetBaud) / targetBaud) * 100;
    const absError = Math.abs(errorPct);

    // Bit timing
    const idealBitTimeUs = (1 / targetBaud) * 1000000;
    const actualBitTimeUs = (1 / actualBaud) * 1000000;
    const driftPerBitUs = actualBitTimeUs - idealBitTimeUs;
    const totalDrift10BitsUs = driftPerBitUs * 10;
    const driftPctOfBit = (Math.abs(totalDrift10BitsUs) / idealBitTimeUs) * 100;

    // Safety Rating: AVR UART tolerance is up to ~4.5% total frame drift
    let safetyLevel: 'safe' | 'caution' | 'danger' = 'safe';
    let safetyDesc = '우수 (오차율 ±2.0% 이내로 완벽한 통신 신뢰성 보장)';

    if (absError > 4.5) {
      safetyLevel = 'danger';
      safetyDesc = '위험 (오차율 > 4.5%로 프레이밍 에러 및 데이터 깨짐 발생 확실)';
    } else if (absError > 2.0) {
      safetyLevel = 'caution';
      safetyDesc = '주의 (오차율 2.0~4.5%로 케이블 지연이나 온도 변화 시 에러 위험)';
    }

    return {
      ubrr,
      actualBaud,
      errorPct,
      absError,
      idealBitTimeUs,
      actualBitTimeUs,
      driftPerBitUs,
      totalDrift10BitsUs,
      driftPctOfBit,
      safetyLevel,
      safetyDesc
    };
  }, [fcpuHz, targetBaud, useU2x]);

  // Handle Injecting a Packet
  const handleInjectPacket = (hexString: string) => {
    const cleanBytes = hexString
      .trim()
      .split(/\s+/)
      .map((h) => parseInt(h, 16))
      .filter((n) => !isNaN(n));

    if (cleanBytes.length === 0) return;

    const newPkt = parseUartPacket(cleanBytes, Date.now() % 100000, 'RX');
    setPackets((prev) => [newPkt, ...prev.slice(0, 49)]); // Keep last 50
    setSelectedPacketId(newPkt.id);
  };

  // Live Auto Stream Simulation
  useEffect(() => {
    if (!isLiveStreaming) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      // Pick random preset or slightly perturbed packet
      const preset = PRESET_PACKETS[Math.floor(Math.random() * PRESET_PACKETS.length)];
      const bytes = preset.bytesHex.split(' ').map((h) => parseInt(h, 16));
      const pkt = parseUartPacket(bytes, Date.now() % 100000, Math.random() > 0.3 ? 'RX' : 'TX');
      setPackets((prev) => [pkt, ...prev.slice(0, 49)]);
    }, 650);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLiveStreaming]);

  // Selected Packet Details
  const activePacket = useMemo(() => {
    return packets.find((p) => p.id === selectedPacketId) || packets[0];
  }, [packets, selectedPacketId]);

  // Filtered Packets
  const filteredPackets = useMemo(() => {
    return packets.filter((p) => {
      if (filterValid === 'valid') return p.isValid;
      if (filterValid === 'invalid') return !p.isValid;
      return true;
    });
  }, [packets, filterValid]);

  // Stats
  const validCount = packets.filter((p) => p.isValid).length;
  const invalidCount = packets.length - validCount;
  const passRate = packets.length > 0 ? ((validCount / packets.length) * 100).toFixed(1) : '100';

  // Generated C Driver Code Snippet (FSM Packet Parser)
  const generatedCParserCode = useMemo(() => {
    return `/**
 * @file    uart_packet_fsm_parser.c
 * @target  ${currentProfile.name} (F_CPU: ${(fcpuHz / 1000000).toFixed(4)}MHz, Baud: ${targetBaud}bps)
 * @brief   인터럽트 기반 고성능 UART 바이너리 패킷 FSM 상태 머신 파서
 * @details UBRR 설정값: ${baudCalculations.ubrr} (${useU2x ? 'U2X0=1 고속 모드' : 'U2X0=0 표준 모드'}), 오차율: ${baudCalculations.errorPct.toFixed(2)}%
 */

#include <avr/io.h>
#include <avr/interrupt.h>
#include <stdbool.h>
#include <stdint.h>

#define PACKET_HEADER_0  0xAA
#define PACKET_HEADER_1  0x55
#define PACKET_TAIL      0x03
#define MAX_PAYLOAD_LEN  32

typedef enum {
    STATE_WAIT_HEADER0,
    STATE_WAIT_HEADER1,
    STATE_WAIT_LENGTH,
    STATE_WAIT_MSG_ID,
    STATE_WAIT_PAYLOAD,
    STATE_WAIT_CHECKSUM,
    STATE_WAIT_TAIL
} parser_state_t;

typedef struct {
    uint8_t msg_id;
    uint8_t payload_len;
    uint8_t payload[MAX_PAYLOAD_LEN];
    bool    is_valid;
} rx_packet_t;

static volatile parser_state_t g_state = STATE_WAIT_HEADER0;
static volatile rx_packet_t     g_rx_packet;
static volatile uint8_t         g_payload_idx = 0;
static volatile uint8_t         g_calc_checksum = 0;

/**
 * @brief USART0 하드웨어 보레이트 및 수신 인터럽트 초기화
 */
void uart_protocol_init(void) {
    // 1. 보레이트 레지스터 설정 (UBRR = ${baudCalculations.ubrr})
    UBRR0H = (uint8_t)(${baudCalculations.ubrr} >> 8);
    UBRR0L = (uint8_t)(${baudCalculations.ubrr});

    ${useU2x ? '// 2. U2X0 비트 활성화 (2배속 모드로 보레이트 오차율 최소화)\n    UCSR0A |= (1 << U2X0);' : '// 2. 표준 1배속 모드\n    UCSR0A &= ~(1 << U2X0);'}

    // 3. 수신(RX) 활성화 및 수신 완료 인터럽트(RXCIE0) 활성화
    UCSR0B = (1 << RXEN0) | (1 << TXEN0) | (1 << RXCIE0);

    // 4. 비동기 8N1 모드 (8 데이터 비트, 무패리티, 1 스톱 비트)
    UCSR0C = (1 << UCSZ01) | (1 << UCSZ00);
}

/**
 * @brief USART0 수신 완료 ISR (인터럽트 구동 패킷 FSM 파서)
 */
ISR(USART0_RX_vect) {
    uint8_t byte = UDR0; // 수신 바이트 읽기

    switch (g_state) {
        case STATE_WAIT_HEADER0:
            if (byte == PACKET_HEADER_0) g_state = STATE_WAIT_HEADER1;
            break;

        case STATE_WAIT_HEADER1:
            if (byte == PACKET_HEADER_1) g_state = STATE_WAIT_LENGTH;
            else g_state = STATE_WAIT_HEADER0;
            break;

        case STATE_WAIT_LENGTH:
            g_rx_packet.payload_len = byte;
            g_payload_idx = 0;
            g_calc_checksum = 0; // 체크섬 초기화
            g_state = STATE_WAIT_MSG_ID;
            break;

        case STATE_WAIT_MSG_ID:
            g_rx_packet.msg_id = byte;
            g_calc_checksum = (g_calc_checksum + byte) & 0xFF;
            if (g_rx_packet.payload_len > 1) {
                g_state = STATE_WAIT_PAYLOAD;
            } else {
                g_state = STATE_WAIT_CHECKSUM;
            }
            break;

        case STATE_WAIT_PAYLOAD:
            if (g_payload_idx < MAX_PAYLOAD_LEN) {
                g_rx_packet.payload[g_payload_idx++] = byte;
                g_calc_checksum = (g_calc_checksum + byte) & 0xFF;
            }
            if (g_payload_idx >= (g_rx_packet.payload_len - 1)) {
                g_state = STATE_WAIT_CHECKSUM;
            }
            break;

        case STATE_WAIT_CHECKSUM:
            if (byte == g_calc_checksum) {
                g_state = STATE_WAIT_TAIL; // 체크섬 통과
            } else {
                g_state = STATE_WAIT_HEADER0; // 체크섬 오류 폐기
            }
            break;

        case STATE_WAIT_TAIL:
            if (byte == PACKET_TAIL) {
                g_rx_packet.is_valid = true; // 무결성 검증 완료 패킷 수신 완료!
            }
            g_state = STATE_WAIT_HEADER0;
            break;

        default:
            g_state = STATE_WAIT_HEADER0;
            break;
    }
}`;
  }, [currentProfile.name, fcpuHz, targetBaud, useU2x, baudCalculations]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCParserCode);
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
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <Radio className="w-3.5 h-3.5" /> 시리얼 프로토콜 데이터 로거 & 패킷 분석기
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono font-bold">
              Target: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-mono font-bold">
              {targetBaud} bps • UBRR: {baudCalculations.ubrr}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-bold border ${
                baudCalculations.safetyLevel === 'safe'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40'
                  : baudCalculations.safetyLevel === 'caution'
                  ? 'bg-amber-950/60 text-amber-300 border-amber-800/40'
                  : 'bg-rose-950/60 text-rose-300 border-rose-800/40'
              }`}
            >
              오차율: {baudCalculations.errorPct >= 0 ? '+' : ''}
              {baudCalculations.errorPct.toFixed(2)}% ({baudCalculations.safetyLevel.toUpperCase()})
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            UART 데이터 패킷 분석기 & 보레이트 타이밍 오류율 검증기
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            UART 직렬 통신 패킷의 헤더(Sync), 메시지 ID, 페이로드 길이, 체크섬 무결성을 1바이트 단위로 분석하여 
            프로토콜 준수 여부를 검증하고, 비트 타이밍 다이어그램을 통해 시스템 클럭 편차에 따른 누적 보레이트 오차율을 시각화합니다.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto">
          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition shadow-lg ${
              isLiveStreaming
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20 animate-pulse'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/20'
            }`}
          >
            {isLiveStreaming ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isLiveStreaming ? '패킷 스트림 정지' : '실시간 패킷 스트림 시작'}</span>
          </button>
          <button
            onClick={handleCopyCode}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition border border-slate-700"
          >
            {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
            <span>{copiedCode ? '복사됨!' : 'FSM 드라이버 복사'}</span>
          </button>
        </div>
      </div>

      {/* Section 1: Baud Rate & Bit Timing Diagram Analysis Card */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              UART 보레이트 레지스터(UBRR) 계산 및 비트 타이밍 도표
            </h4>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {baudCalculations.safetyDesc}
          </span>
        </div>

        {/* Timing Configuration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1 font-medium">시스템 클럭 (F_CPU):</label>
            <select
              value={fcpuHz}
              onChange={(e) => setFcpuHz(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
            >
              <option value={16000000}>16.0000 MHz (표준 크리스털)</option>
              <option value={8000000}>8.0000 MHz (내부 RC / 3.3V)</option>
              <option value={20000000}>20.0000 MHz (최대 오버클럭)</option>
              <option value={11059200}>11.0592 MHz (UART 0.00% 오차 전용 크리스털)</option>
              <option value={14745600}>14.7456 MHz (고속 통신 전용 크리스털)</option>
              <option value={18432000}>18.4320 MHz (고속 통신 전용)</option>
              <option value={12000000}>12.0000 MHz (V-USB 겸용)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1 font-medium">타깃 보레이트 (Baud Rate):</label>
            <select
              value={targetBaud}
              onChange={(e) => setTargetBaud(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
            >
              <option value={9600}>9,600 bps</option>
              <option value={19200}>19,200 bps</option>
              <option value={38400}>38,400 bps</option>
              <option value={57600}>57,600 bps</option>
              <option value={115200}>115,200 bps (표준 고속)</option>
              <option value={230400}>230,400 bps</option>
              <option value={250000}>250,000 bps (DMX512)</option>
              <option value={500000}>500,000 bps</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1 font-medium">2배속 모드 (U2X 비트):</label>
            <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
              <button
                onClick={() => setUseU2x(false)}
                className={`py-1.5 rounded-xl border font-bold transition text-center ${
                  !useU2x
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                1배속 (16분주)
              </button>
              <button
                onClick={() => setUseU2x(true)}
                className={`py-1.5 rounded-xl border font-bold transition text-center ${
                  useU2x
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                2배속 (8분주)
              </button>
            </div>
          </div>

          {/* Quick Metrics KPI */}
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 font-mono text-[11px] space-y-0.5">
            <div className="flex justify-between">
              <span className="text-slate-400">실제 생성 보레이트:</span>
              <span className="text-white font-bold">{Math.round(baudCalculations.actualBaud).toLocaleString()} bps</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">비트 지속 시간 (T_bit):</span>
              <span className="text-cyan-400 font-bold">{baudCalculations.actualBitTimeUs.toFixed(2)} µs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">프레임 누적 드리프트:</span>
              <span
                className={`font-bold ${
                  baudCalculations.safetyLevel === 'safe'
                    ? 'text-emerald-400'
                    : baudCalculations.safetyLevel === 'caution'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {baudCalculations.totalDrift10BitsUs.toFixed(3)} µs ({baudCalculations.driftPctOfBit.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Visual 10-Bit UART Frame Timing Diagram */}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              10-Bit UART 프레임 (Start + 8 Data Bits + Stop) 누적 위상 편차 타이밍 도표:
            </span>
            <span className="text-[10px] text-slate-500">
              샘플링 허용 한계: ±4.5% (스톱 비트 중심 8번째 클럭 틱 샘플링)
            </span>
          </div>

          <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3 font-mono text-xs">
            {/* Bit Cells Timeline */}
            <div className="grid grid-cols-10 gap-1 text-center">
              {['START', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'STOP'].map((bitName, idx) => {
                const bitDrift = (idx + 0.5) * baudCalculations.driftPerBitUs;
                const isOver = Math.abs(bitDrift) > baudCalculations.idealBitTimeUs * 0.45;

                return (
                  <div
                    key={bitName}
                    className={`p-2 rounded-xl border flex flex-col justify-between transition ${
                      idx === 0
                        ? 'bg-cyan-950/40 border-cyan-800/60 text-cyan-300'
                        : idx === 9
                        ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-[11px]">{bitName}</div>
                    <div className="text-[10px] text-slate-500 my-1">
                      {((idx + 0.5) * baudCalculations.idealBitTimeUs).toFixed(1)}µs
                    </div>
                    {/* Sampling point indicator */}
                    <div className="flex items-center justify-center">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isOver ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'
                        }`}
                        title="샘플링 시점"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Error Drift Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] text-slate-400">
                <span>타이밍 드리프트 마진 소모율:</span>
                <span
                  className={`font-bold ${
                    baudCalculations.safetyLevel === 'safe'
                      ? 'text-emerald-400'
                      : baudCalculations.safetyLevel === 'caution'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {baudCalculations.driftPctOfBit.toFixed(1)}% / 45.0% 허용치
                </span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    baudCalculations.safetyLevel === 'safe'
                      ? 'bg-emerald-500'
                      : baudCalculations.safetyLevel === 'caution'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, (baudCalculations.driftPctOfBit / 45) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Real-time Packet Stream Logger & Protocol Compliance Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Packet Stream Table */}
        <div className="lg:col-span-2 bg-slate-950/70 border border-slate-800/90 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <h4 className="font-bold text-white uppercase tracking-wider">
                실시간 패킷 수신 스트림 (총 {packets.length}개 로그)
              </h4>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <button
                onClick={() => setFilterValid('all')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  filterValid === 'all'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                전체 ({packets.length})
              </button>
              <button
                onClick={() => setFilterValid('valid')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  filterValid === 'valid'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                정상 PASS ({validCount})
              </button>
              <button
                onClick={() => setFilterValid('invalid')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  filterValid === 'invalid'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                오류 FAIL ({invalidCount})
              </button>
            </div>
          </div>

          {/* Preset Injections & Custom Send */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-[11px] text-slate-400 font-mono">테스트 패킷 주입:</span>
              {PRESET_PACKETS.map((pre, idx) => (
                <button
                  key={idx}
                  onClick={() => handleInjectPacket(pre.bytesHex)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-mono transition"
                  title={pre.desc}
                >
                  {pre.name.split('(')[0]}
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customInputHex}
                onChange={(e) => setCustomInputHex(e.target.value)}
                placeholder="16진수 바이트열 (예: AA 55 05 01 12 34 56 78 75 03)"
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
              />
              <button
                onClick={() => handleInjectPacket(customInputHex)}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-1 shrink-0"
              >
                <Send className="w-3 h-3" />
                <span>패킷 분석</span>
              </button>
            </div>
          </div>

          {/* Packet Table */}
          <div className="max-h-[360px] overflow-y-auto custom-scrollbar rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2">시간</th>
                  <th className="px-2 py-2">방향</th>
                  <th className="px-3 py-2">원시 헥사 바이트 (Raw Hex)</th>
                  <th className="px-2 py-2">길이</th>
                  <th className="px-2 py-2">체크섬</th>
                  <th className="px-3 py-2">검증 상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                {filteredPackets.map((pkt) => {
                  const isSelected = pkt.id === selectedPacketId;
                  const rawHexStr = pkt.rawBytes
                    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
                    .join(' ');

                  return (
                    <tr
                      key={pkt.id}
                      onClick={() => setSelectedPacketId(pkt.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-cyan-950/40 text-white'
                          : 'hover:bg-slate-900/60 text-slate-300'
                      }`}
                    >
                      <td className="px-3 py-2 text-slate-500 text-[11px] whitespace-nowrap">
                        +{pkt.timestampMs}ms
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            pkt.direction === 'RX'
                              ? 'bg-cyan-950 text-cyan-400'
                              : 'bg-amber-950 text-amber-400'
                          }`}
                        >
                          {pkt.direction}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-200 font-bold max-w-[220px] truncate">
                        {rawHexStr}
                      </td>
                      <td className="px-2 py-2 text-slate-400">{pkt.rawBytes.length}B</td>
                      <td className="px-2 py-2">
                        <span
                          className={`font-bold ${
                            pkt.receivedChecksum === pkt.expectedChecksum && pkt.isValid
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          0x{pkt.receivedChecksum.toString(16).toUpperCase().padStart(2, '0')}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {pkt.isValid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 text-[11px] font-bold">
                            <XCircle className="w-3.5 h-3.5" /> FAIL
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Selected Packet Structure Inspector */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-white">
              <span className="flex items-center gap-1.5">
                <Search className="w-4 h-4 text-cyan-400" /> 패킷 프레임 필드 분석
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  activePacket?.isValid
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                    : 'bg-rose-950/80 text-rose-300 border border-rose-800/40'
                }`}
              >
                {activePacket?.isValid ? 'PROTOCOL OK' : 'CORRUPTED'}
              </span>
            </div>

            {activePacket ? (
              <div className="space-y-3 text-xs font-mono">
                {/* 1. Header & Sync */}
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>프레임 헤더 (Preamble / Sync):</span>
                    <span className="text-cyan-300 font-bold">
                      {activePacket.header
                        .map((b) => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`)
                        .join(' ')}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    규격: 0xAA 0x55 (수신단 비트 동기화 바이트)
                  </div>
                </div>

                {/* 2. Length & MsgID */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">페이로드 길이:</span>
                    <span className="text-white font-bold text-sm">{activePacket.payloadLength} Bytes</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">명령 ID (MsgID):</span>
                    <span className="text-amber-400 font-bold text-sm">
                      0x{activePacket.msgId.toString(16).toUpperCase().padStart(2, '0')}
                    </span>
                  </div>
                </div>

                {/* 3. Payload Raw */}
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px] block">페이로드 데이터 (Payload):</span>
                  <div className="p-2 bg-slate-950 rounded-lg text-emerald-300 break-all text-xs font-bold select-all">
                    {activePacket.payload.length > 0
                      ? activePacket.payload
                          .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
                          .join(' ')
                      : '(페이로드 없음)'}
                  </div>
                </div>

                {/* 4. Checksum Comparison */}
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">수신 체크섬:</span>
                    <span className="text-white font-bold">
                      0x{activePacket.receivedChecksum.toString(16).toUpperCase().padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">계산 체크섬:</span>
                    <span className="text-cyan-300 font-bold">
                      0x{activePacket.expectedChecksum.toString(16).toUpperCase().padStart(2, '0')}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 pt-0.5 border-t border-slate-800">
                    종료 바이트 (Tail): 0x{activePacket.tail.toString(16).toUpperCase().padStart(2, '0')} (규격 0x03)
                  </div>
                </div>

                {/* Error Banner */}
                {activePacket.errorReason && (
                  <div className="p-2.5 bg-rose-950/40 border border-rose-600/50 rounded-xl text-[11px] text-rose-300 flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{activePacket.errorReason}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-500 text-xs py-8 text-center italic">
                좌측 표에서 분석할 패킷을 선택하세요.
              </div>
            )}
          </div>

          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>패킷 통과율:</span>
              <span className="text-emerald-400 font-bold">{passRate}%</span>
            </div>
            <div className="flex justify-between">
              <span>정상 / 오류:</span>
              <span>{validCount}건 / {invalidCount}건</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Generated Production C Driver (FSM State Machine) */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              {currentProfile.name} USART 인터럽트 구동 FSM 패킷 파서 C 소스코드
            </h4>
          </div>

          <button
            onClick={handleCopyCode}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-md shadow-cyan-600/20 flex items-center gap-1.5"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? '복사 완료!' : 'FSM 파서 C 코드 복사'}</span>
          </button>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
            <span>uart_packet_fsm_parser.c (AVR-GCC C99/C11)</span>
            <span className="text-cyan-400 font-bold">Interrupt-Driven FSM</span>
          </div>
          <pre className="p-5 font-mono text-xs text-cyan-300 overflow-x-auto max-h-[420px] leading-relaxed custom-scrollbar selection:bg-cyan-500/30">
            {generatedCParserCode}
          </pre>
        </div>
      </div>
    </div>
  );
};
