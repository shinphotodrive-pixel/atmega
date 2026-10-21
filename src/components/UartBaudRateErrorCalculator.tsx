import React, { useState, useMemo } from 'react';
import {
  Calculator,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Copy,
  Check,
  Zap,
  Info,
  Radio,
  Clock,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Cpu,
  Sparkles,
  Layers,
  Code2
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
}

interface CommonBaudInfo {
  baud: number;
  label: string;
  category: 'Standard' | 'High-Speed' | 'Special';
}

const COMMON_BAUD_RATES: CommonBaudInfo[] = [
  { baud: 300, label: '300 bps (레거시/초저속)', category: 'Standard' },
  { baud: 1200, label: '1,200 bps (FSK/모뎀)', category: 'Standard' },
  { baud: 2400, label: '2,400 bps (RF 모듈)', category: 'Standard' },
  { baud: 4800, label: '4,800 bps (GPS/NMEA)', category: 'Standard' },
  { baud: 9600, label: '9,600 bps (산업용 표준/기본)', category: 'Standard' },
  { baud: 14400, label: '14,400 bps', category: 'Standard' },
  { baud: 19200, label: '19,200 bps (PLC/모드버스)', category: 'Standard' },
  { baud: 28800, label: '28,800 bps', category: 'Standard' },
  { baud: 31250, label: '31,250 bps (MIDI 악기 표준)', category: 'Special' },
  { baud: 38400, label: '38,400 bps (블루투스 HC-05)', category: 'Standard' },
  { baud: 57600, label: '57,600 bps (부트로더/센서)', category: 'Standard' },
  { baud: 76800, label: '76,800 bps', category: 'Standard' },
  { baud: 115200, label: '115,200 bps (Arduino/PC 통신)', category: 'High-Speed' },
  { baud: 230400, label: '230,400 bps (고속 디버깅)', category: 'High-Speed' },
  { baud: 250000, label: '250,000 bps (DMX-512 조명)', category: 'Special' },
  { baud: 460800, label: '460,800 bps (고속 스트리밍)', category: 'High-Speed' },
  { baud: 500000, label: '500,000 bps (0.5 Mbps)', category: 'High-Speed' },
  { baud: 1000000, label: '1,000,000 bps (1.0 Mbps)', category: 'High-Speed' },
  { baud: 2000000, label: '2,000,000 bps (2.0 Mbps 초고속)', category: 'High-Speed' }
];

const CLOCK_PRESETS = [
  { fcpu: 1000000, label: '1.0 MHz (내부 RC 기본)', isCrystal: false },
  { fcpu: 4000000, label: '4.0 MHz (저전력)', isCrystal: false },
  { fcpu: 7372800, label: '7.3728 MHz (UART 전용 무오차)', isCrystal: true },
  { fcpu: 8000000, label: '8.0 MHz (3.3V / 내부 RC)', isCrystal: false },
  { fcpu: 11059200, label: '11.0592 MHz (UART 황금 크리스탈)', isCrystal: true },
  { fcpu: 12000000, label: '12.0 MHz (V-USB 표준)', isCrystal: false },
  { fcpu: 14745600, label: '14.7456 MHz (UART 전용 고속)', isCrystal: true },
  { fcpu: 16000000, label: '16.0 MHz (Arduino Uno 5V 표준)', isCrystal: false },
  { fcpu: 18432000, label: '18.4320 MHz (UART 초고속 무오차)', isCrystal: true },
  { fcpu: 20000000, label: '20.0 MHz (AVR 정격 최대 클럭)', isCrystal: false }
];

export const UartBaudRateErrorCalculator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // User input states
  const [fcpuInput, setFcpuInput] = useState<number>(16000000);
  const [customFcpuMhz, setCustomFcpuMhz] = useState<string>('16.0');
  const [isCustomFcpu, setIsCustomFcpu] = useState<boolean>(false);
  const [targetBaud, setTargetBaud] = useState<number>(115200);
  const [customBaudInput, setCustomBaudInput] = useState<string>('115200');
  const [selectedChannel, setSelectedChannel] = useState<number>(0);
  const [mode, setMode] = useState<'normal' | 'double_speed' | 'sync'>('normal');

  // Frame Format Configuration
  const [dataBits, setDataBits] = useState<number>(8);
  const [parity, setParity] = useState<'none' | 'even' | 'odd'>('none');
  const [stopBits, setStopBits] = useState<number>(1);

  // Copy code feedback
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedMacro, setCopiedMacro] = useState<boolean>(false);

  // Filter valid USART channels based on selected MCU
  const maxChannels = currentProfile.usart;
  const activeChannel = selectedChannel >= maxChannels ? 0 : selectedChannel;

  // Active F_CPU
  const currentFcpu = isCustomFcpu ? Math.max(1000, parseFloat(customFcpuMhz) * 1000000 || 16000000) : fcpuInput;

  // Calculate divisor based on mode
  const divisor = mode === 'sync' ? 2 : mode === 'double_speed' ? 8 : 16;

  // Real-time calculation for current inputs
  const calculation = useMemo(() => {
    // Exact floating-point UBRR
    const rawUbrr = currentFcpu / (divisor * targetBaud) - 1;
    const roundedUbrr = Math.round(rawUbrr);
    const clampedUbrr = Math.max(0, Math.min(4095, roundedUbrr));
    const isOutOfRange = rawUbrr < 0 || rawUbrr > 4095;

    // Actual baud generated
    const actualBaud = currentFcpu / (divisor * (clampedUbrr + 1));
    const errorPercent = ((actualBaud - targetBaud) / targetBaud) * 100;
    const absError = Math.abs(errorPercent);

    // Register splits (12-bit register)
    const ubrrH = (clampedUbrr >> 8) & 0x0F;
    const ubrrL = clampedUbrr & 0xFF;

    // Normal vs 2x Speed comparison for the current Baud
    const normalRawUbrr = currentFcpu / (16 * targetBaud) - 1;
    const normalUbrr = Math.max(0, Math.min(4095, Math.round(normalRawUbrr)));
    const normalActual = currentFcpu / (16 * (normalUbrr + 1));
    const normalError = ((normalActual - targetBaud) / targetBaud) * 100;

    const u2xRawUbrr = currentFcpu / (8 * targetBaud) - 1;
    const u2xUbrr = Math.max(0, Math.min(4095, Math.round(u2xRawUbrr)));
    const u2xActual = currentFcpu / (8 * (u2xUbrr + 1));
    const u2xError = ((u2xActual - targetBaud) / targetBaud) * 100;

    // Frame bit drift & sampling safety
    const parityBits = parity === 'none' ? 0 : 1;
    const totalFrameBits = 1 + dataBits + parityBits + stopBits; // Start(1) + Data + Parity + Stop
    // Time per nominal bit and actual bit in microseconds
    const nominalBitUs = (1 / targetBaud) * 1000000;
    const actualBitUs = (1 / actualBaud) * 1000000;
    const totalNominalFrameUs = nominalBitUs * totalFrameBits;
    const totalActualFrameUs = actualBitUs * totalFrameBits;
    const accumulatedDriftUs = totalActualFrameUs - totalNominalFrameUs;
    // Cumulative bit slip as % of 1 bit time at the middle of the stop bit (sampling instant)
    // UART receiver samples stop bit around 0.5 * bit_time after start of stop bit
    const samplingPointNominalUs = nominalBitUs * (totalFrameBits - stopBits + 0.5);
    const samplingPointActualUs = actualBitUs * (totalFrameBits - stopBits + 0.5);
    const stopBitDriftUs = samplingPointActualUs - samplingPointNominalUs;
    const stopBitDriftPercentOfBit = (stopBitDriftUs / nominalBitUs) * 100;

    // Reliability classification
    let status: 'perfect' | 'excellent' | 'acceptable' | 'warning' | 'critical';
    let statusLabel: string;
    let statusDesc: string;

    if (isOutOfRange) {
      status = 'critical';
      statusLabel = '설정 불가 (UBRR 오버플로우)';
      statusDesc = 'UBRR 레지스터(12-bit, 0~4095) 유효 범위를 벗어났습니다. 클럭 또는 보드레이트를 변경하십시오.';
    } else if (absError === 0) {
      status = 'perfect';
      statusLabel = '완벽 (0.00% 오차 없음)';
      statusDesc = '클럭과 완벽히 정합되어 프레이밍 에러가 전혀 발생하지 않는 최상의 통신 상태입니다.';
    } else if (absError <= 0.5) {
      status = 'excellent';
      statusLabel = '매우 우수 (오차 ≤ 0.5%)';
      statusDesc = '온도 변화나 전압 불안정에도 패킷 손실이 전혀 없는 안정적인 하드웨어 설계입니다.';
    } else if (absError <= 2.0) {
      status = 'acceptable';
      statusLabel = '정상 통신 가능 (오차 ≤ 2.0%)';
      statusDesc = 'RS-232 / UART 비동기 통신 규격 허용 오차 범위 내로, 일반적인 통신 환경에서 안전합니다.';
    } else if (absError <= 3.5) {
      status = 'warning';
      statusLabel = '주의 요망 (2.0% ~ 3.5% 경계선)';
      statusDesc = '긴 데이터 프레임 전송 시 비트 누적 슬립으로 인해 프레이밍 에러(Framing Error)가 발생할 위험이 있습니다. U2X 모드 활성화를 권장합니다.';
    } else {
      status = 'critical';
      statusLabel = '통신 장애 위험 (> 3.5% 오차 초과)';
      statusDesc = '수신단 샘플링 시점(8번째 클럭)이 인접 비트로 밀려나 데이터 변조 및 패킷 깨짐이 빈번하게 발생합니다!';
    }

    return {
      rawUbrr,
      roundedUbrr,
      clampedUbrr,
      isOutOfRange,
      actualBaud,
      errorPercent,
      absError,
      ubrrh: ubrrH,
      ubrrl: ubrrL,
      normalUbrr,
      normalActual,
      normalError,
      u2xUbrr,
      u2xActual,
      u2xError,
      totalFrameBits,
      nominalBitUs,
      actualBitUs,
      accumulatedDriftUs,
      stopBitDriftPercentOfBit,
      status,
      statusLabel,
      statusDesc
    };
  }, [currentFcpu, divisor, targetBaud, mode, dataBits, parity, stopBits]);

  // Channel pin names
  const channelPinMap: Record<SupportedMCU, string[]> = {
    atmega2560: [
      'RXD0: PE0 (Pin 2), TXD0: PE1 (Pin 3)',
      'RXD1: PD2 (Pin 45), TXD1: PD3 (Pin 46)',
      'RXD2: PH0 (Pin 12), TXD2: PH1 (Pin 13)',
      'RXD3: PJ0 (Pin 63), TXD3: PJ1 (Pin 64)'
    ],
    atmega328p: ['RXD0: PD0 (Pin 2), TXD0: PD1 (Pin 3)'],
    atmega128: [
      'RXD0: PE0 (Pin 2), TXD0: PE1 (Pin 3)',
      'RXD1: PD2 (Pin 27), TXD1: PD3 (Pin 28)'
    ],
    atmega640: [
      'RXD0: PE0 (Pin 2), TXD0: PE1 (Pin 3)',
      'RXD1: PD2 (Pin 45), TXD1: PD3 (Pin 46)',
      'RXD2: PH0 (Pin 12), TXD2: PH1 (Pin 13)',
      'RXD3: PJ0 (Pin 63), TXD3: PJ1 (Pin 64)'
    ]
  };

  const channelPins = channelPinMap[selectedMCU]?.[activeChannel] || 'RX/TX';

  // Matrix calculation for table
  const baudMatrix = useMemo(() => {
    return COMMON_BAUD_RATES.map((item) => {
      // Normal 1x
      const rawNorm = currentFcpu / (16 * item.baud) - 1;
      const ubrrNorm = Math.round(rawNorm);
      const safeNorm = Math.max(0, Math.min(4095, ubrrNorm));
      const actualNorm = currentFcpu / (16 * (safeNorm + 1));
      const errNorm = ((actualNorm - item.baud) / item.baud) * 100;
      const validNorm = rawNorm >= 0 && rawNorm <= 4095;

      // 2x Speed
      const raw2x = currentFcpu / (8 * item.baud) - 1;
      const ubrr2x = Math.round(raw2x);
      const safe2x = Math.max(0, Math.min(4095, ubrr2x));
      const actual2x = currentFcpu / (8 * (safe2x + 1));
      const err2x = ((actual2x - item.baud) / item.baud) * 100;
      const valid2x = raw2x >= 0 && raw2x <= 4095;

      // Determine recommended mode
      const absNorm = Math.abs(errNorm);
      const abs2x = Math.abs(err2x);
      let recommended: '1x' | '2x' | 'none' = '1x';
      if (!validNorm && !valid2x) {
        recommended = 'none';
      } else if (!validNorm) {
        recommended = '2x';
      } else if (!valid2x) {
        recommended = '1x';
      } else if (abs2x < absNorm) {
        recommended = '2x';
      } else {
        recommended = '1x';
      }

      return {
        baud: item.baud,
        label: item.label,
        category: item.category,
        normal: {
          ubrr: safeNorm,
          actual: actualNorm,
          error: errNorm,
          valid: validNorm
        },
        double: {
          ubrr: safe2x,
          actual: actual2x,
          error: err2x,
          valid: valid2x
        },
        recommended
      };
    });
  }, [currentFcpu]);

  // C Code Template Generator
  const generatedCCode = useMemo(() => {
    const ch = activeChannel;
    const isU2X = mode === 'double_speed';
    const isSync = mode === 'sync';
    const u2xBit = isU2X ? `(1 << U2X${ch})` : '0x00';
    const ucsrcConfig: string[] = [];

    // Data bits config (UCSZn1, UCSZn0 in UCSRnC, UCSZn2 in UCSRnB)
    let ucsz2Bit = '';
    if (dataBits === 8) {
      ucsrcConfig.push(`(1 << UCSZ${ch}1) | (1 << UCSZ${ch}0)`);
    } else if (dataBits === 7) {
      ucsrcConfig.push(`(1 << UCSZ${ch}1)`);
    } else if (dataBits === 6) {
      ucsrcConfig.push(`(1 << UCSZ${ch}0)`);
    } else if (dataBits === 5) {
      // 000
    } else if (dataBits === 9) {
      ucsrcConfig.push(`(1 << UCSZ${ch}1) | (1 << UCSZ${ch}0)`);
      ucsz2Bit = ` | (1 << UCSZ${ch}2)`;
    }

    if (stopBits === 2) {
      ucsrcConfig.push(`(1 << USBS${ch})`);
    }

    if (parity === 'even') {
      ucsrcConfig.push(`(1 << UPM${ch}1)`);
    } else if (parity === 'odd') {
      ucsrcConfig.push(`(1 << UPM${ch}1) | (1 << UPM${ch}0)`);
    }

    if (isSync) {
      ucsrcConfig.push(`(1 << UMSEL${ch}0)`);
    }

    const ucsrcValue = ucsrcConfig.length > 0 ? ucsrcConfig.join(' | ') : '0x00';

    return `// ============================================================================
// ${currentProfile.name} USART${ch} Bare-metal 드라이버
// 시스템 클럭 F_CPU: ${currentFcpu.toLocaleString()} Hz (${(currentFcpu / 1e6).toFixed(4)} MHz)
// 목표 보드레이트: ${targetBaud.toLocaleString()} bps
// 실제 생성 보드레이트: ${calculation.actualBaud.toFixed(2)} bps (오차율: ${calculation.errorPercent >= 0 ? '+' : ''}${calculation.errorPercent.toFixed(2)}%)
// 프레임 형식: ${dataBits}비트 데이터, ${parity.toUpperCase()} 패리티, ${stopBits} 스톱비트
// ============================================================================
#include <avr/io.h>

#define F_CPU ${Math.round(currentFcpu)}UL
#define TARGET_BAUD ${targetBaud}
#define UBRR_VAL ${calculation.clampedUbrr} // UBRR${ch}H=0x${calculation.ubrrh.toString(16).toUpperCase()}, UBRR${ch}L=0x${calculation.ubrrl.toString(16).padStart(2, '0').toUpperCase()}

/**
 * @brief USART${ch} 하드웨어 초기화 루틴
 */
void USART${ch}_Init(void) {
    // 1. 보드레이트 분주 레지스터 기록 (High 바이트 선행 기록 필수)
    UBRR${ch}H = (unsigned char)(UBRR_VAL >> 8);
    UBRR${ch}L = (unsigned char)UBRR_VAL;

    // 2. 제어 레지스터 A 설정: ${isU2X ? '2배속 모드(U2X) 활성화 (8분주)' : '1배속 일반 비동기 모드 (16분주)'}
    UCSR${ch}A = ${u2xBit};

    // 3. 수신(RX) 및 송신(TX) 하드웨어 인에이블${ucsz2Bit ? ' (9비트 설정 포함)' : ''}
    UCSR${ch}B = (1 << RXEN${ch}) | (1 << TXEN${ch})${ucsz2Bit};

    // 4. 프레임 형식 레지스터(UCSR${ch}C) 설정
    UCSR${ch}C = ${ucsrcValue};
}

/**
 * @brief 1바이트 폴링(Polling) 송신 함수
 */
void USART${ch}_Transmit(uint8_t data) {
    // UDR 송신 데이터 레지스터 버퍼가 비워질 때까지 대기
    while (!(UCSR${ch}A & (1 << UDRE${ch})));
    UDR${ch} = data;
}

/**
 * @brief 1바이트 수신 함수 (블로킹 대기 및 프레이밍/패리티 에러 점검)
 */
uint8_t USART${ch}_Receive(void) {
    // 수신 완료 플래그(RXC) 대기
    while (!(UCSR${ch}A & (1 << RXC${ch})));
    
    // 에러 상태 점검 (FE: 프레이밍 에러, DOR: 데이터 오버런, UPE: 패리티 에러)
    if (UCSR${ch}A & ((1 << FE${ch}) | (1 << DOR${ch}) | (1 << UPE${ch}))) {
        // 통신 오류 발생 시 에러 플래그 처리 로직
    }
    
    return UDR${ch};
}

/**
 * @brief 널 문자 종료 문자열 송신
 */
void USART${ch}_SendString(const char* str) {
    while (*str) {
        USART${ch}_Transmit((uint8_t)*str++);
    }
}`;
  }, [currentProfile.name, activeChannel, mode, currentFcpu, targetBaud, calculation, dataBits, parity, stopBits]);

  const setBaudMacroCode = useMemo(() => {
    const ch = activeChannel;
    return `// ============================================================================
// AVR-Libc 표준 <util/setbaud.h> 컴파일 타임 최적화 예제
// 컴파일러 프리프로세서가 클럭과 보드레이트 오차를 분석하여 자동으로 U2X를 선택합니다.
// ============================================================================
#define F_CPU ${Math.round(currentFcpu)}UL
#define BAUD ${targetBaud}
#define BAUD_TOL 2 // 허용 최대 오차율 (2% 초과 시 #warning 컴파일 경고 발생)

#include <avr/io.h>
#include <util/setbaud.h>

void USART${ch}_Init_AutoSetBaud(void) {
    UBRR${ch}H = UBRRH_VALUE;
    UBRR${ch}L = UBRRL_VALUE;
#if USE_2X
    UCSR${ch}A |= (1 << U2X${ch});  // 2배속 모드가 더 정밀할 때 자동 켜짐
#else
    UCSR${ch}A &= ~(1 << U2X${ch}); // 1배속 표준 모드
#endif
    UCSR${ch}B = (1 << RXEN${ch}) | (1 << TXEN${ch});
    UCSR${ch}C = (1 << UCSZ${ch}1) | (1 << UCSZ${ch}0); // 8N1
}`;
  }, [currentFcpu, targetBaud, activeChannel]);

  const handleCopyCode = (text: string, isMacro: boolean = false) => {
    navigator.clipboard.writeText(text);
    if (isMacro) {
      setCopiedMacro(true);
      setTimeout(() => setCopiedMacro(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const getStatusBadge = (error: number) => {
    const abs = Math.abs(error);
    if (abs === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <Sparkles className="w-3 h-3" /> 0.0% 완벽
        </span>
      );
    }
    if (abs <= 1.0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
          <CheckCircle className="w-3 h-3" /> 안전 (≤1%)
        </span>
      );
    }
    if (abs <= 2.0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
          <Check className="w-3 h-3" /> 정상 (≤2%)
        </span>
      );
    }
    if (abs <= 3.5) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <AlertTriangle className="w-3 h-3" /> 경고 (주의)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
        <XCircle className="w-3 h-3" /> 위험 (에러)
      </span>
    );
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Title Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <Radio className="w-3.5 h-3.5" /> USART/UART Baud Rate Calculator
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              MCU: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800/60 text-xs font-mono">
              가용 채널: USART 0 ~ {maxChannels - 1}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            USART/UART Baud Rate Calculator (보드레이트 오차율 & UBRR 계산기)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            목표 시스템 클럭 주파수(F_CPU)와 원하는 보드레이트(Baud Rate)를 입력하면 필요한 UBRR 레지스터 값(12-bit 및 UBRRH:UBRRL)과
            정수 분주 오차율(Baud Error %)을 실시간으로 계산하고 비트 샘플링 슬립에 따른 안정성을 사전에 진단합니다.
          </p>
        </div>

        {/* Quick Summary Pill */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-right flex-shrink-0 min-w-[200px]">
          <div className="text-[11px] text-slate-400 font-mono">현재 설정 오차율</div>
          <div className="flex items-center justify-end gap-1.5 mt-0.5">
            <span
              className={`text-xl font-mono font-black ${
                calculation.absError === 0
                  ? 'text-emerald-400'
                  : calculation.absError <= 2.0
                  ? 'text-cyan-400'
                  : calculation.absError <= 3.5
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {calculation.errorPercent >= 0 ? '+' : ''}
              {calculation.errorPercent.toFixed(2)}%
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            UBRR: <span className="font-mono text-amber-400 font-bold">{calculation.clampedUbrr}</span> (0x
            {calculation.clampedUbrr.toString(16).toUpperCase()})
          </div>
        </div>
      </div>

      {/* Main Control Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. System Clock (F_CPU) */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> 시스템 클럭 (F_CPU)
            </label>
            <button
              onClick={() => setIsCustomFcpu(!isCustomFcpu)}
              className="text-[10px] text-amber-400 hover:text-amber-300 underline font-mono"
            >
              {isCustomFcpu ? '프리셋 선택' : '직접 입력'}
            </button>
          </div>

          {isCustomFcpu ? (
            <div>
              <div className="relative">
                <input
                  type="number"
                  step="0.0001"
                  min="0.1"
                  max="40"
                  value={customFcpuMhz}
                  onChange={(e) => setCustomFcpuMhz(e.target.value)}
                  className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-400"
                  placeholder="예: 16.0"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">MHz</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                실제 클럭: <span className="text-amber-400 font-mono">{currentFcpu.toLocaleString()} Hz</span>
              </p>
            </div>
          ) : (
            <select
              value={fcpuInput}
              onChange={(e) => setFcpuInput(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
            >
              {CLOCK_PRESETS.map((clk) => (
                <option key={clk.fcpu} value={clk.fcpu}>
                  {clk.label}
                </option>
              ))}
            </select>
          )}

          {/* Quick Crystals Selection */}
          <div className="pt-1">
            <span className="text-[10px] font-semibold text-slate-400 block mb-1">통신 전용 무오차 크리스탈 추천:</span>
            <div className="flex flex-wrap gap-1">
              {[7372800, 11059200, 14745600, 18432000].map((cHz) => (
                <button
                  key={cHz}
                  onClick={() => {
                    setIsCustomFcpu(false);
                    setFcpuInput(cHz);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                    currentFcpu === cHz && !isCustomFcpu
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {(cHz / 1e6).toFixed(4)}M
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Target Baud Rate */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" /> 목표 보드레이트 (Baud)
            </label>
            <span className="text-[10px] text-slate-400 font-mono">bps</span>
          </div>

          <div className="relative">
            <input
              type="number"
              min="50"
              max="5000000"
              value={customBaudInput}
              onChange={(e) => {
                setCustomBaudInput(e.target.value);
                const val = parseInt(e.target.value, 10);
                if (val > 0) setTargetBaud(val);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-400"
              placeholder="예: 115200"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">bps</span>
          </div>

          {/* Quick Baud Rate Buttons */}
          <div className="pt-1">
            <span className="text-[10px] font-semibold text-slate-400 block mb-1">주요 표준 속도 퀵셋:</span>
            <div className="flex flex-wrap gap-1">
              {[9600, 19200, 38400, 57600, 115200, 230400].map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    setTargetBaud(b);
                    setCustomBaudInput(b.toString());
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                    targetBaud === b
                      ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {b >= 1000 ? `${b / 1000}k` : b}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3. USART Speed Mode (U2X & Sync) */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-400" /> 통신 모드 및 분주기 (Divisor)
          </label>

          <div className="space-y-1.5">
            <button
              onClick={() => setMode('normal')}
              className={`w-full text-left p-2 rounded-lg border text-xs transition flex items-center justify-between ${
                mode === 'normal'
                  ? 'bg-purple-950/60 border-purple-500 text-white font-semibold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div>
                <span className="block font-mono">표준 1배속 (U2X = 0)</span>
                <span className="text-[10px] text-slate-400">16 샘플/비트 (안정 노이즈 필터링)</span>
              </div>
              <span className="font-mono text-[11px] text-purple-400">÷16</span>
            </button>

            <button
              onClick={() => setMode('double_speed')}
              className={`w-full text-left p-2 rounded-lg border text-xs transition flex items-center justify-between ${
                mode === 'double_speed'
                  ? 'bg-amber-950/60 border-amber-500 text-white font-semibold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div>
                <span className="block font-mono">2배속 고속 모드 (U2X = 1)</span>
                <span className="text-[10px] text-slate-400">8 샘플/비트 (16MHz 115.2k 오차 완화)</span>
              </div>
              <span className="font-mono text-[11px] text-amber-400">÷8</span>
            </button>

            <button
              onClick={() => setMode('sync')}
              className={`w-full text-left p-2 rounded-lg border text-xs transition flex items-center justify-between ${
                mode === 'sync'
                  ? 'bg-cyan-950/60 border-cyan-500 text-white font-semibold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div>
                <span className="block font-mono">동기 마스터 모드 (UMSEL)</span>
                <span className="text-[10px] text-slate-400">외부 XCK 클럭 동기화 2분주</span>
              </div>
              <span className="font-mono text-[11px] text-cyan-400">÷2</span>
            </button>
          </div>
        </div>

        {/* 4. Peripheral Channel & Frame Format */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" /> 채널 & 프레임 (8N1)
          </label>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">대상 USART 채널</label>
            <select
              value={activeChannel}
              onChange={(e) => setSelectedChannel(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
            >
              {Array.from({ length: maxChannels }).map((_, idx) => (
                <option key={idx} value={idx}>
                  USART{idx} ({currentProfile.name})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-emerald-400/80 font-mono mt-1 truncate">{channelPins}</p>
          </div>

          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <div>
              <label className="text-[9px] text-slate-400 block">데이터 비트</label>
              <select
                value={dataBits}
                onChange={(e) => setDataBits(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-white font-mono"
              >
                <option value={5}>5-bit</option>
                <option value={6}>6-bit</option>
                <option value={7}>7-bit</option>
                <option value={8}>8-bit</option>
                <option value={9}>9-bit</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-slate-400 block">패리티</label>
              <select
                value={parity}
                onChange={(e) => setParity(e.target.value as 'none' | 'even' | 'odd')}
                className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-white font-mono"
              >
                <option value="none">None</option>
                <option value="even">Even</option>
                <option value="odd">Odd</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-slate-400 block">스톱 비트</label>
              <select
                value={stopBits}
                onChange={(e) => setStopBits(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[11px] text-white font-mono"
              >
                <option value={1}>1-bit</option>
                <option value={2}>2-bit</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Result Banner & Risk Diagnostics */}
      <div
        className={`rounded-2xl p-5 border transition-all ${
          calculation.status === 'perfect' || calculation.status === 'excellent'
            ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
            : calculation.status === 'acceptable'
            ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-300'
            : calculation.status === 'warning'
            ? 'bg-amber-950/30 border-amber-500/50 text-amber-300'
            : 'bg-rose-950/30 border-rose-500/60 text-rose-300'
        }`}
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 flex-shrink-0 mt-0.5">
              {calculation.status === 'perfect' || calculation.status === 'excellent' ? (
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              ) : calculation.status === 'acceptable' ? (
                <Check className="w-6 h-6 text-cyan-400" />
              ) : calculation.status === 'warning' ? (
                <AlertTriangle className="w-6 h-6 text-amber-400 animate-pulse" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-400 animate-bounce" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-white">{calculation.statusLabel}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/40 border border-white/10 text-white">
                  오차율: {calculation.errorPercent >= 0 ? '+' : ''}
                  {calculation.errorPercent.toFixed(3)}%
                </span>
                {mode === 'normal' && Math.abs(calculation.u2xError) < Math.abs(calculation.normalError) && (
                  <button
                    onClick={() => setMode('double_speed')}
                    className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500 text-slate-950 hover:bg-amber-400 transition shadow"
                  >
                    💡 2배속(U2X=1) 전환 시 오차 {calculation.u2xError.toFixed(2)}%로 개선
                  </button>
                )}
                {mode === 'double_speed' && Math.abs(calculation.normalError) < Math.abs(calculation.u2xError) && (
                  <button
                    onClick={() => setMode('normal')}
                    className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-500 text-white hover:bg-purple-400 transition shadow"
                  >
                    💡 표준(U2X=0) 전환 시 오차 {calculation.normalError.toFixed(2)}%로 개선
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">{calculation.statusDesc}</p>
            </div>
          </div>

          {/* Core Formula Box */}
          <div className="bg-slate-950/80 border border-white/10 rounded-xl p-3 font-mono text-[11px] text-slate-300 flex flex-col gap-1 w-full lg:w-auto">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">계산 공식:</span>
              <span className="text-amber-400 font-bold">
                UBRR = round({(currentFcpu / 1e6).toFixed(4)}M / ({divisor} × {targetBaud})) - 1
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">실제 생성 주파수:</span>
              <span className="text-white font-bold">{calculation.actualBaud.toFixed(2)} bps</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">비트 지속 시간:</span>
              <span className="text-cyan-400">
                {calculation.actualBitUs.toFixed(3)} µs (목표: {calculation.nominalBitUs.toFixed(3)} µs)
              </span>
            </div>
          </div>
        </div>

        {/* Visual Tolerance Bar */}
        <div className="mt-4 pt-3 border-t border-white/10 space-y-1.5">
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>허용 오차 한계선 (-3.5%)</span>
            <span className="text-emerald-400 font-bold">0.00% 무오차 이상선</span>
            <span>허용 오차 한계선 (+3.5%)</span>
          </div>

          <div className="relative h-4 bg-slate-950 rounded-full border border-slate-800 overflow-hidden flex items-center">
            {/* Zones */}
            <div className="absolute inset-y-0 left-0 w-[25%] bg-rose-500/20" title="통신 에러 구역" />
            <div className="absolute inset-y-0 left-[25%] w-[15%] bg-amber-500/20" title="주의 구역" />
            <div className="absolute inset-y-0 left-[40%] w-[20%] bg-emerald-500/20" title="안전 구역 (±1.0%)" />
            <div className="absolute inset-y-0 left-[60%] w-[15%] bg-amber-500/20" title="주의 구역" />
            <div className="absolute inset-y-0 left-[75%] w-[25%] bg-rose-500/20" title="통신 에러 구역" />

            {/* Zero Marker Line */}
            <div className="absolute inset-y-0 left-[50%] w-0.5 bg-emerald-400 shadow-sm" />

            {/* Current Position Marker */}
            {/* Clamp marker position between 0% and 100% where 50% is 0% error, and each 1% error is 7% width */}
            {(() => {
              const clampedPosition = Math.max(2, Math.min(98, 50 + calculation.errorPercent * 7.14));
              return (
                <div
                  className="absolute top-0 bottom-0 w-3 -ml-1.5 rounded-full bg-white border-2 border-slate-900 shadow-md transition-all duration-300"
                  style={{ left: `${clampedPosition}%` }}
                />
              );
            })()}
          </div>
          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>-7.0%</span>
            <span>-3.5%</span>
            <span>-1.0%</span>
            <span className="text-emerald-400 font-bold">0%</span>
            <span>+1.0%</span>
            <span>+3.5%</span>
            <span>+7.0%</span>
          </div>
        </div>
      </div>

      {/* Dual Detail Panels: Register Breakdown & Bit Slip Analyzer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel A: UBRR Register Bit-Field Visualizer */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-400" />
              UBRR{activeChannel} 12비트 레지스터 분할 구조
            </h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-800 font-bold">
              10진수: {calculation.clampedUbrr}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            AVR 8비트 아키텍처에서는 12비트 보드레이트 카운터를 4비트 상위 레지스터(<code>UBRR{activeChannel}H</code>)와
            8비트 하위 레지스터(<code>UBRR{activeChannel}L</code>)로 나누어 저장합니다.
          </p>

          {/* High Byte & Low Byte Visual Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            {/* UBRRnH */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-mono">UBRR{activeChannel}H (상위 4비트)</span>
                <span className="font-mono font-bold text-amber-400">
                  0x{calculation.ubrrh.toString(16).toUpperCase()}
                </span>
              </div>
              <div className="font-mono text-center text-lg font-bold text-white py-1 bg-slate-950 rounded border border-slate-800/80">
                {calculation.ubrrh}
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>Bit 11..8:</span>
                <span className="text-amber-300">
                  {calculation.ubrrh.toString(2).padStart(4, '0')}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                비트 15~12는 예약(Reserved)되어 있으며 항상 0으로 기록되어야 합니다.
              </p>
            </div>

            {/* UBRRnL */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-mono">UBRR{activeChannel}L (하위 8비트)</span>
                <span className="font-mono font-bold text-cyan-400">
                  0x{calculation.ubrrl.toString(16).padStart(2, '0').toUpperCase()}
                </span>
              </div>
              <div className="font-mono text-center text-lg font-bold text-white py-1 bg-slate-950 rounded border border-slate-800/80">
                {calculation.ubrrl}
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>Bit 7..0:</span>
                <span className="text-cyan-300">
                  {calculation.ubrrl.toString(2).padStart(8, '0')}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                UBRR{activeChannel}L에 기록되는 순간 내부 보드레이트 생성 프리스케일러가 리셋됩니다.
              </p>
            </div>
          </div>

          {/* Assembly / C Safe Write Order Warning */}
          <div className="bg-slate-900/90 border border-amber-500/20 rounded-lg p-3 text-[11px] text-slate-300 space-y-1">
            <div className="text-amber-400 font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> 레지스터 기록 순서 준수 사항
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              상위 바이트 <code>UBRR{activeChannel}H</code>를 먼저 쓰고, 그 다음 하위 바이트 <code>UBRR{activeChannel}L</code>을 써야 합니다.
              C 언어 <code>UBRR{activeChannel} = {calculation.clampedUbrr};</code> 대입문은 AVR-GCC 컴파일러가 바이트 순서를 자동으로 보장합니다.
            </p>
          </div>
        </div>

        {/* Panel B: Bit Sampling Drift & Framing Error Mechanics */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              프레임 비트 슬립(Bit Slip) & 샘플링 분석
            </h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 text-cyan-400 border border-slate-800">
              총 {calculation.totalFrameBits} 비트 프레임
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            UART는 스타트 비트의 하강 에지에서 동기화된 후 내부 카운터로 각 비트의 정중앙({mode === 'double_speed' ? '4번째' : '8번째'} 샘플)을 읽습니다.
            오차율이 누적되면 <strong>스톱 비트(Stop bit)</strong> 시점에서 샘플링 포인트가 경계를 벗어나 <strong>프레이밍 에러</strong>가 발생합니다.
          </p>

          {/* Metrics List */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">1 비트 공칭 시간</span>
              <span className="font-mono text-white font-bold text-sm">
                {calculation.nominalBitUs.toFixed(3)} µs
              </span>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">1 비트 실제 생성 시간</span>
              <span className="font-mono text-cyan-400 font-bold text-sm">
                {calculation.actualBitUs.toFixed(3)} µs
              </span>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">프레임 전체 누적 시간차</span>
              <span className={`font-mono font-bold text-sm ${Math.abs(calculation.accumulatedDriftUs) > calculation.nominalBitUs * 0.35 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {calculation.accumulatedDriftUs >= 0 ? '+' : ''}{calculation.accumulatedDriftUs.toFixed(3)} µs
              </span>
            </div>
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">스톱비트 샘플링 슬립율</span>
              <span className={`font-mono font-bold text-sm ${Math.abs(calculation.stopBitDriftPercentOfBit) > 35 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {calculation.stopBitDriftPercentOfBit >= 0 ? '+' : ''}{calculation.stopBitDriftPercentOfBit.toFixed(1)}% / bit
              </span>
            </div>
          </div>

          {/* Visual Frame Bit Stream Diagram */}
          <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
            <div className="text-[11px] text-slate-400 font-mono flex justify-between">
              <span>수신 프레임 비트 흐름 (시간 경과 →)</span>
              <span className="text-amber-400">누적 드리프트 점검</span>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] font-mono">
              <span className="px-2 py-1 bg-rose-950 text-rose-300 border border-rose-800 rounded font-bold">
                START
              </span>
              {Array.from({ length: dataBits }).map((_, i) => (
                <span key={i} className="px-1.5 py-1 bg-slate-800 text-slate-300 border border-slate-700 rounded text-center min-w-[28px]">
                  D{i}
                </span>
              ))}
              {parity !== 'none' && (
                <span className="px-1.5 py-1 bg-purple-950 text-purple-300 border border-purple-800 rounded">
                  PARITY
                </span>
              )}
              {Array.from({ length: stopBits }).map((_, i) => (
                <span
                  key={i}
                  className={`px-2 py-1 rounded font-bold border ${
                    calculation.absError > 3.5
                      ? 'bg-rose-950 text-rose-300 border-rose-600 animate-pulse'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  }`}
                >
                  STOP{stopBits > 1 ? i + 1 : ''}
                </span>
              ))}
            </div>
            <div className="text-[10px] text-slate-400 leading-relaxed">
              {calculation.absError <= 2.0 ? (
                <span className="text-emerald-400">
                  ✅ 수신 샘플링 포인트가 비트 셀 중앙 ±{Math.abs(calculation.stopBitDriftPercentOfBit).toFixed(1)}% 내에 머물러 안전합니다.
                </span>
              ) : (
                <span className="text-amber-400">
                  ⚠️ 수신 샘플링 포인트가 {Math.abs(calculation.stopBitDriftPercentOfBit).toFixed(1)}% 이동하여 비트 경계에 근접했습니다!
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full Baud Rate Comparison Matrix Table */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-400" />
              {(currentFcpu / 1e6).toFixed(4)} MHz 클럭 기준 표준 보드레이트 전체 대조표
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              행을 클릭하면 해당 보드레이트가 계산기에 즉시 적용됩니다.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> ≤ 1% (안전)
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> ≤ 3.5% (경고)
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-400" /> &gt; 3.5% (위험)
            </span>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-mono bg-slate-900/80">
                <th className="py-2.5 px-3">목표 보드레이트</th>
                <th className="py-2.5 px-3 bg-purple-950/20 text-purple-300">1배속 (U2X=0) UBRR</th>
                <th className="py-2.5 px-3 bg-purple-950/20 text-purple-300">1배속 실제 Baud</th>
                <th className="py-2.5 px-3 bg-purple-950/20 text-purple-300">1배속 오차율</th>
                <th className="py-2.5 px-3 bg-amber-950/20 text-amber-300">2배속 (U2X=1) UBRR</th>
                <th className="py-2.5 px-3 bg-amber-950/20 text-amber-300">2배속 실제 Baud</th>
                <th className="py-2.5 px-3 bg-amber-950/20 text-amber-300">2배속 오차율</th>
                <th className="py-2.5 px-3">권장 모드</th>
                <th className="py-2.5 px-3 text-right">적용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
              {baudMatrix.map((row) => {
                const isSelected = targetBaud === row.baud;
                return (
                  <tr
                    key={row.baud}
                    onClick={() => {
                      setTargetBaud(row.baud);
                      setCustomBaudInput(row.baud.toString());
                      if (row.recommended === '2x') setMode('double_speed');
                      else setMode('normal');
                    }}
                    className={`cursor-pointer transition hover:bg-slate-900 ${
                      isSelected ? 'bg-amber-500/10 font-semibold' : ''
                    }`}
                  >
                    <td className="py-2 px-3">
                      <div className="font-bold text-white">{row.baud.toLocaleString()} bps</div>
                      <div className="text-[10px] text-slate-500">{row.label}</div>
                    </td>

                    {/* Normal 1x */}
                    <td className="py-2 px-3 bg-purple-950/10 text-purple-200">
                      {row.normal.valid ? row.normal.ubrr : <span className="text-rose-500">N/A</span>}
                    </td>
                    <td className="py-2 px-3 bg-purple-950/10 text-slate-300">
                      {row.normal.valid ? `${row.normal.actual.toFixed(1)}` : '-'}
                    </td>
                    <td className="py-2 px-3 bg-purple-950/10">
                      {row.normal.valid ? (
                        <span
                          className={`font-bold ${
                            Math.abs(row.normal.error) <= 1.0
                              ? 'text-emerald-400'
                              : Math.abs(row.normal.error) <= 2.0
                              ? 'text-cyan-400'
                              : Math.abs(row.normal.error) <= 3.5
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {row.normal.error >= 0 ? '+' : ''}
                          {row.normal.error.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-rose-500">범위초과</span>
                      )}
                    </td>

                    {/* Double Speed 2x */}
                    <td className="py-2 px-3 bg-amber-950/10 text-amber-200">
                      {row.double.valid ? row.double.ubrr : <span className="text-rose-500">N/A</span>}
                    </td>
                    <td className="py-2 px-3 bg-amber-950/10 text-slate-300">
                      {row.double.valid ? `${row.double.actual.toFixed(1)}` : '-'}
                    </td>
                    <td className="py-2 px-3 bg-amber-950/10">
                      {row.double.valid ? (
                        <span
                          className={`font-bold ${
                            Math.abs(row.double.error) <= 1.0
                              ? 'text-emerald-400'
                              : Math.abs(row.double.error) <= 2.0
                              ? 'text-cyan-400'
                              : Math.abs(row.double.error) <= 3.5
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {row.double.error >= 0 ? '+' : ''}
                          {row.double.error.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-rose-500">범위초과</span>
                      )}
                    </td>

                    {/* Recommendation Badge */}
                    <td className="py-2 px-3">
                      {row.recommended === '2x' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          U2X = 1 권장
                        </span>
                      ) : row.recommended === '1x' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          U2X = 0 표준
                        </span>
                      ) : (
                        <span className="text-rose-400 text-[10px]">불가</span>
                      )}
                    </td>

                    {/* Action Button */}
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTargetBaud(row.baud);
                          setCustomBaudInput(row.baud.toString());
                          if (row.recommended === '2x') setMode('double_speed');
                          else setMode('normal');
                        }}
                        className="px-2.5 py-1 text-[10px] rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition"
                      >
                        선택
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Code Snippets & GCC setbaud.h Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Snippet 1: Complete Bare-Metal C Driver */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                <Code2 className="w-4 h-4 text-amber-400" />
                AVR C 드라이버 코드 ({currentProfile.name} USART{activeChannel})
              </h3>
              <button
                onClick={() => handleCopyCode(generatedCCode, false)}
                className="inline-flex items-center gap-1 text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-800 text-xs transition"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode ? '복사 완료!' : 'C 소스 복사'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              설정된 F_CPU 및 보드레이트와 12비트 UBRR 분할, {mode === 'double_speed' ? 'U2X 2배속' : '1배속'} 설정을 담은 즉시 컴파일 가능한 C 코드입니다.
            </p>
          </div>

          <pre className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64 custom-scrollbar">
            {generatedCCode}
          </pre>
        </div>

        {/* Snippet 2: AVR-libc <util/setbaud.h> Auto-Optimization Pattern */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                AVR-Libc &lt;util/setbaud.h&gt; 자동 최적화 매크로
              </h3>
              <button
                onClick={() => handleCopyCode(setBaudMacroCode, true)}
                className="inline-flex items-center gap-1 text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-800 text-xs transition"
              >
                {copiedMacro ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedMacro ? '복사 완료!' : '매크로 복사'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              컴파일 타임에 프리프로세서가 오차를 자동 검증하며, 허용 오차 초과 시 컴파일러 경고(#warning)를 출력하고 2배속 전환을 자동 결정합니다.
            </p>
          </div>

          <pre className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64 custom-scrollbar">
            {setBaudMacroCode}
          </pre>
        </div>
      </div>
    </div>
  );
};
