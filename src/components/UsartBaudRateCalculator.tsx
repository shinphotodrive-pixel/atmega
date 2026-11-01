import React, { useState, useMemo } from 'react';
import {
  Radio,
  Clock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Cpu,
  Layers,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Info,
  Sliders,
  Terminal,
  Activity,
  Gauge
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface UsartBaudRateCalculatorProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

interface ClockPreset {
  freq: number;
  label: string;
  desc: string;
  isGolden: boolean;
}

const CLOCK_PRESETS: ClockPreset[] = [
  { freq: 16000000, label: '16.0 MHz', desc: 'Arduino Uno / Mega (기본 5V)', isGolden: false },
  { freq: 8000000, label: '8.0 MHz', desc: '내부 RC / 3.3V Pro Mini', isGolden: false },
  { freq: 20000000, label: '20.0 MHz', desc: 'AVR 정격 최대 클럭 (5V)', isGolden: false },
  { freq: 11059200, label: '11.0592 MHz', desc: 'UART 황금 크리스탈 (0.00% 오차)', isGolden: true },
  { freq: 7372800, label: '7.3728 MHz', desc: 'UART 황금 크리스탈 (저전력 0% 오차)', isGolden: true },
  { freq: 14745600, label: '14.7456 MHz', desc: 'UART 고속 황금 크리스탈', isGolden: true },
  { freq: 18432000, label: '18.4320 MHz', desc: 'UART 초고속 황금 크리스탈', isGolden: true },
  { freq: 12000000, label: '12.0 MHz', desc: 'V-USB 표준 크리스탈', isGolden: false },
  { freq: 1000000, label: '1.0 MHz', desc: '공장 출고 기본 (8MHz/8 CKDIV8)', isGolden: false }
];

interface BaudPreset {
  baud: number;
  label: string;
  tag: string;
}

const BAUD_PRESETS: BaudPreset[] = [
  { baud: 9600, label: '9,600', tag: '산업용 표준' },
  { baud: 19200, label: '19,200', tag: 'Modbus / PLC' },
  { baud: 38400, label: '38,400', tag: 'HC-05 블루투스' },
  { baud: 57600, label: '57,600', tag: 'Optiboot' },
  { baud: 115200, label: '115,200', tag: 'Arduino PC 기본' },
  { baud: 230400, label: '230,400', tag: '고속 디버깅' },
  { baud: 250000, label: '250,000', tag: 'DMX-512 조명' },
  { baud: 500000, label: '500,000', tag: '0.5 Mbps 고속' },
  { baud: 1000000, label: '1,000,000', tag: '1.0 Mbps 초고속' }
];

export const UsartBaudRateCalculator: React.FC<UsartBaudRateCalculatorProps> = ({
  selectedMCU
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Frequency state (in Hz)
  const [fosc, setFosc] = useState<number>(16000000);
  const [customFoscMhz, setCustomFoscMhz] = useState<string>('16.0');
  const [isCustomFosc, setIsCustomFosc] = useState<boolean>(false);

  // Baud rate state
  const [desiredBaud, setDesiredBaud] = useState<number>(115200);
  const [customBaudInput, setCustomBaudInput] = useState<string>('115200');
  const [isCustomBaud, setIsCustomBaud] = useState<boolean>(false);

  // USART channel (0, 1, 2, 3 depending on MCU)
  const [channel, setChannel] = useState<number>(0);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Determine available channels
  const maxChannels = currentProfile.usart || 1;
  const validChannel = Math.min(channel, maxChannels - 1);

  // Handle preset frequency change
  const handleSelectClockPreset = (freq: number) => {
    setFosc(freq);
    setCustomFoscMhz((freq / 1000000).toString());
    setIsCustomFosc(false);
  };

  // Handle custom frequency change
  const handleCustomFreqChange = (valStr: string) => {
    setCustomFoscMhz(valStr);
    setIsCustomFosc(true);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 32) {
      setFosc(Math.round(parsed * 1000000));
    }
  };

  // Handle baud preset change
  const handleSelectBaudPreset = (baud: number) => {
    setDesiredBaud(baud);
    setCustomBaudInput(baud.toString());
    setIsCustomBaud(false);
  };

  // Handle custom baud change
  const handleCustomBaudChange = (valStr: string) => {
    setCustomBaudInput(valStr);
    setIsCustomBaud(true);
    const parsed = parseInt(valStr.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 4000000) {
      setDesiredBaud(parsed);
    }
  };

  // Calculation function for Normal ($U2X=0$) or Double Speed ($U2X=1$)
  const calculateModeResult = (isDoubleSpeed: boolean) => {
    const divisor = isDoubleSpeed ? 8 : 16;
    if (desiredBaud <= 0 || fosc <= 0) {
      return {
        ubrr: 0,
        ubrrFloat: 0,
        actualBaud: 0,
        errorPercent: 0,
        absError: 0,
        isValid: false,
        ubrrH: 0,
        ubrrL: 0,
        bitTimeUs: 0,
        status: 'unusable' as const,
        statusText: '입력값 오류',
        cumulativeDriftPercent: 0
      };
    }

    const ubrrFloat = fosc / (divisor * desiredBaud) - 1;
    let ubrr = Math.round(ubrrFloat);

    const isValid = ubrr >= 0 && ubrr <= 4095;
    if (ubrr < 0) ubrr = 0;
    if (ubrr > 4095) ubrr = 4095;

    const actualBaud = fosc / (divisor * (ubrr + 1));
    const errorPercent = ((actualBaud - desiredBaud) / desiredBaud) * 100;
    const absError = Math.abs(errorPercent);

    const ubrrH = (ubrr >> 8) & 0x0f;
    const ubrrL = ubrr & 0xff;
    const bitTimeUs = (1 / actualBaud) * 1000000;

    // Cumulative drift across standard 10-bit UART frame (1 Start + 8 Data + 1 Stop)
    // Rx samples in middle of stop bit (bit 9.5). Frame error occurs if drift > 50% bit period!
    const cumulativeDriftPercent = absError * 10;

    let status: 'optimal' | 'acceptable' | 'marginal' | 'unusable' = 'optimal';
    let statusText = '최적 (신뢰성 극대화)';

    if (!isValid) {
      status = 'unusable';
      statusText = 'UBRR 범위 초과 (설정 불가)';
    } else if (absError <= 0.5) {
      status = 'optimal';
      statusText = '최적 (오차 ≤ 0.5%)';
    } else if (absError <= 1.8) {
      status = 'acceptable';
      statusText = '양호 (표준 통신 안전)';
    } else if (absError <= 3.5) {
      status = 'marginal';
      statusText = '주의 (프레이밍 에러 위험)';
    } else {
      status = 'unusable';
      statusText = '사용 불가 (오차 > 3.5%)';
    }

    return {
      ubrr,
      ubrrFloat,
      actualBaud,
      errorPercent,
      absError,
      isValid,
      ubrrH,
      ubrrL,
      bitTimeUs,
      status,
      statusText,
      cumulativeDriftPercent
    };
  };

  const normalMode = useMemo(() => calculateModeResult(false), [fosc, desiredBaud]);
  const doubleSpeedMode = useMemo(() => calculateModeResult(true), [fosc, desiredBaud]);

  // Which mode is recommended?
  const recommendedMode = useMemo(() => {
    if (!normalMode.isValid && !doubleSpeedMode.isValid) return 'none';
    if (!normalMode.isValid) return 'double';
    if (!doubleSpeedMode.isValid) return 'normal';
    if (normalMode.absError <= doubleSpeedMode.absError) {
      // If error is identical, normal speed (16x oversampling) is preferred due to higher noise immunity
      return 'normal';
    }
    return 'double';
  }, [normalMode, doubleSpeedMode]);

  // Code Generation
  const generatedCode = useMemo(() => {
    const ch = validChannel;
    const chStr = ch.toString();
    const isDouble = recommendedMode === 'double';
    const activeResult = isDouble ? doubleSpeedMode : normalMode;

    const ubrrHHex = '0x' + activeResult.ubrrH.toString(16).toUpperCase().padStart(2, '0');
    const ubrrLHex = '0x' + activeResult.ubrrL.toString(16).toUpperCase().padStart(2, '0');
    const ubrrDec = activeResult.ubrr;

    return `/* =========================================================
 * AVR USART${chStr} 초기화 코드 (${currentProfile.name})
 * System Clock (f_osc): ${(fosc / 1000000).toFixed(4)} MHz
 * Target Baud: ${desiredBaud.toLocaleString()} bps
 * Mode: ${isDouble ? '2배속 모드 (Double Speed, U2X=1)' : '일반 모드 (Normal Speed, U2X=0)'}
 * Actual Baud: ${activeResult.actualBaud.toFixed(1)} bps (오차: ${activeResult.errorPercent >= 0 ? '+' : ''}${activeResult.errorPercent.toFixed(2)}%)
 * UBRR${chStr} 값: ${ubrrDec} (${ubrrHHex}:${ubrrLHex})
 * ========================================================= */
#include <avr/io.h>

void usart${chStr}_init(void) {
    // 1. 보레이트 레지스터 설정 (12-bit UBRR = UBRR${chStr}H:UBRR${chStr}L)
    UBRR${chStr}H = (uint8_t)(${ubrrHHex}); // 상위 4비트 (0x0F 마스킹)
    UBRR${chStr}L = (uint8_t)(${ubrrLHex}); // 하위 8비트

    // 2. 통신 속도 모드 제어 (U2X${chStr} 비트 설정)
    ${
      isDouble
        ? `UCSR${chStr}A |= (1 << U2X${chStr});  // 2배속 모드 활성화 (클럭 분주비 8)`
        : `UCSR${chStr}A &= ~(1 << U2X${chStr}); // 1배속 일반 모드 (클럭 분주비 16, 노이즈 필터링 최적)`
    }

    // 3. 송수신 모듈 활성화 (TXEN, RXEN)
    UCSR${chStr}B = (1 << RXEN${chStr}) | (1 << TXEN${chStr});

    // 4. 프레임 형식 설정: 비동기(Async), 8 데이터 비트, 패리티 없음(None), 1 정지 비트 (8N1)
    UCSR${chStr}C = (1 << UCSZ${chStr}1) | (1 << UCSZ${chStr}0);
}

// 1바이트 전송 함수 (블로킹 폴링 방식)
void usart${chStr}_transmit(uint8_t data) {
    // 송신 버퍼(UDRE${chStr})가 빌 때까지 대기
    while (!(UCSR${chStr}A & (1 << UDRE${chStr})));
    // 데이터 레지스터에 기록하여 전송 시작
    UDR${chStr} = data;
}

// 1바이트 수신 함수 (블로킹 수신)
uint8_t usart${chStr}_receive(void) {
    // 수신 완료(RXC${chStr}) 플래그가 세트될 때까지 대기
    while (!(UCSR${chStr}A & (1 << RXC${chStr})));
    return UDR${chStr};
}`;
  }, [validChannel, recommendedMode, doubleSpeedMode, normalMode, fosc, desiredBaud, currentProfile.name]);

  // Quick Table Data for current Fosc
  const quickTableData = useMemo(() => {
    return BAUD_PRESETS.map((bp) => {
      // Normal
      const nDiv = 16;
      const nFloat = fosc / (nDiv * bp.baud) - 1;
      let nUbrr = Math.round(nFloat);
      const nValid = nUbrr >= 0 && nUbrr <= 4095;
      if (nUbrr < 0) nUbrr = 0;
      if (nUbrr > 4095) nUbrr = 4095;
      const nActual = fosc / (nDiv * (nUbrr + 1));
      const nErr = ((nActual - bp.baud) / bp.baud) * 100;

      // Double
      const dDiv = 8;
      const dFloat = fosc / (dDiv * bp.baud) - 1;
      let dUbrr = Math.round(dFloat);
      const dValid = dUbrr >= 0 && dUbrr <= 4095;
      if (dUbrr < 0) dUbrr = 0;
      if (dUbrr > 4095) dUbrr = 4095;
      const dActual = fosc / (dDiv * (dUbrr + 1));
      const dErr = ((dActual - bp.baud) / bp.baud) * 100;

      const betterMode =
        Math.abs(nErr) <= Math.abs(dErr) ? 'Normal (U2X=0)' : '2배속 (U2X=1)';

      return {
        baud: bp.baud,
        label: bp.label,
        tag: bp.tag,
        nUbrr,
        nValid,
        nErr,
        dUbrr,
        dValid,
        dErr,
        betterMode
      };
    });
  }, [fosc]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getStatusBadge = (status: 'optimal' | 'acceptable' | 'marginal' | 'unusable') => {
    switch (status) {
      case 'optimal':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> 완벽 (최적 신뢰성)
          </span>
        );
      case 'acceptable':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            <Check className="w-3 h-3 text-cyan-400" /> 양호 (통신 가능)
          </span>
        );
      case 'marginal':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 text-amber-400" /> 주의 (한계 위험)
          </span>
        );
      case 'unusable':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <XCircle className="w-3 h-3 text-rose-400" /> 불가 (에러 발생)
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Radio className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-wide">
              USART 보레이트 & UBRRn 오차 정밀 계산기
            </h3>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              Normal (16x) vs Double Speed (8x)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            시스템 발진 클럭 주파수(<span className="font-mono text-cyan-300">f_osc</span>)와 목표 보레이트를 입력받아,
            일반 모드(<span className="font-mono text-slate-300">U2X=0</span>)와 2배속 모드(<span className="font-mono text-slate-300">U2X=1</span>)의 
            12비트 <span className="font-mono text-amber-300">UBRRn</span> 레지스터 분할값(UBRRnH:UBRRnL) 및 실제 오차율(Error %)을 실시간 비교 분석합니다.
          </p>
        </div>

        {/* Selected MCU & Hardware USART Channel Selector */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="text-xs text-slate-400 font-mono">대상 채널:</span>
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            {Array.from({ length: maxChannels }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setChannel(idx)}
                className={`px-2.5 py-1 text-xs font-mono rounded-md transition ${
                  validChannel === idx
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                USART{idx}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input Section Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. System Clock Frequency (f_osc) */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              1. 시스템 클럭 주파수 (f_osc)
            </label>
            <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
              {fosc.toLocaleString()} Hz ({(fosc / 1000000).toFixed(4)} MHz)
            </span>
          </div>

          {/* Quick Preset Buttons */}
          <div className="grid grid-cols-3 gap-1.5">
            {CLOCK_PRESETS.map((preset) => {
              const isSelected = !isCustomFosc && fosc === preset.freq;
              return (
                <button
                  key={preset.freq}
                  onClick={() => handleSelectClockPreset(preset.freq)}
                  className={`text-left p-2 rounded-lg border text-xs transition ${
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200 font-bold shadow-sm'
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono">
                    <span>{preset.label}</span>
                    {preset.isGolden && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="UART 황금 크리스탈" />
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {preset.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Manual MHz Input */}
          <div className="pt-2 border-t border-slate-800/60 flex items-center gap-2">
            <span className="text-xs text-slate-400 shrink-0">직접 입력 (MHz):</span>
            <div className="relative flex-1">
              <input
                type="number"
                step="0.0001"
                min="0.1"
                max="32"
                value={customFoscMhz}
                onChange={(e) => handleCustomFreqChange(e.target.value)}
                placeholder="예: 16.0"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="absolute right-3 top-1.5 text-[11px] text-slate-400 font-mono">MHz</span>
            </div>
            <button
              onClick={() => handleSelectClockPreset(16000000)}
              className="px-2.5 py-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            >
              16MHz 초기화
            </button>
          </div>
        </div>

        {/* 2. Desired Baud Rate */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              2. 목표 통신 보레이트 (Desired Baud Rate)
            </label>
            <span className="text-[11px] font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
              {desiredBaud.toLocaleString()} bps
            </span>
          </div>

          {/* Quick Preset Buttons */}
          <div className="grid grid-cols-3 gap-1.5">
            {BAUD_PRESETS.map((preset) => {
              const isSelected = !isCustomBaud && desiredBaud === preset.baud;
              return (
                <button
                  key={preset.baud}
                  onClick={() => handleSelectBaudPreset(preset.baud)}
                  className={`text-left p-2 rounded-lg border text-xs transition ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 font-bold shadow-sm'
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <div className="font-mono font-bold">{preset.label}</div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {preset.tag}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Manual Baud Input */}
          <div className="pt-2 border-t border-slate-800/60 flex items-center gap-2">
            <span className="text-xs text-slate-400 shrink-0">사용자 정의 보레이트:</span>
            <div className="relative flex-1">
              <input
                type="number"
                step="1"
                min="100"
                max="4000000"
                value={customBaudInput}
                onChange={(e) => handleCustomBaudChange(e.target.value)}
                placeholder="예: 115200"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
              <span className="absolute right-3 top-1.5 text-[11px] text-slate-400 font-mono">bps</span>
            </div>
            <button
              onClick={() => handleSelectBaudPreset(115200)}
              className="px-2.5 py-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            >
              115200 초기화
            </button>
          </div>
        </div>
      </div>

      {/* Side-by-Side Dual Mode Comparison Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Gauge className="w-4 h-4 text-cyan-400" />
            일반 모드(16x) vs 2배속 모드(8x) 레지스터 & 오차율 정밀 비교
          </h4>
          <span className="text-xs text-slate-400">
            {recommendedMode === 'normal' && (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> 일반 모드(U2X=0) 권장: 노이즈 내성 우수 & 오차 최소
              </span>
            )}
            {recommendedMode === 'double' && (
              <span className="text-cyan-400 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> 2배속 모드(U2X=1) 권장: 오차율 대폭 감소
              </span>
            )}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Normal Speed Mode (U2X = 0) */}
          <div
            className={`rounded-2xl border p-5 space-y-4 transition-all relative ${
              recommendedMode === 'normal'
                ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-emerald-500/60 shadow-lg shadow-emerald-950/20 ring-1 ring-emerald-500/30'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            {recommendedMode === 'normal' && (
              <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500 text-slate-950 flex items-center gap-1 shadow">
                <Sparkles className="w-3 h-3" /> 추천 설정 (Recommended)
              </div>
            )}

            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white">0</span>
                  <h5 className="text-base font-bold text-white">일반 비동기 모드 (Normal Speed)</h5>
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  UCSR{validChannel}A.U2X{validChannel} = 0 (16배 오버샘플링)
                </div>
              </div>
              <div>{getStatusBadge(normalMode.status)}</div>
            </div>

            {/* Formula display */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-300">
              <span className="text-cyan-400">UBRR</span> = round( f_osc / (16 × Baud) ) - 1
              <div className="text-[11px] text-slate-400 mt-1">
                = round({fosc.toLocaleString()} / (16 × {desiredBaud.toLocaleString()})) - 1 ={' '}
                <span className="text-amber-300 font-bold">{normalMode.ubrrFloat.toFixed(3)}</span> →{' '}
                <span className="text-emerald-400 font-bold">{normalMode.ubrr}</span>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 gap-3">
              {/* UBRR Total */}
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">UBRR{validChannel} (12-bit)</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold font-mono text-amber-300">{normalMode.ubrr}</span>
                  <span className="text-xs font-mono text-slate-400">
                    (0x{normalMode.ubrr.toString(16).toUpperCase().padStart(3, '0')})
                  </span>
                </div>
              </div>

              {/* Error Percent */}
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">보레이트 오차율 (Error %)</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className={`text-xl font-bold font-mono ${
                      Math.abs(normalMode.errorPercent) <= 0.5
                        ? 'text-emerald-400'
                        : Math.abs(normalMode.errorPercent) <= 2.0
                        ? 'text-cyan-400'
                        : Math.abs(normalMode.errorPercent) <= 3.5
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {normalMode.errorPercent >= 0 ? '+' : ''}
                    {normalMode.errorPercent.toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {normalMode.actualBaud.toFixed(1)} bps
                  </span>
                </div>
              </div>
            </div>

            {/* Register Split: UBRRnH & UBRRnL */}
            <div className="bg-slate-900/80 rounded-xl p-3.5 border border-slate-800/90 space-y-2">
              <span className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>하드웨어 레지스터 분할값</span>
                <span className="text-[10px] font-mono text-slate-400">
                  UBRR{validChannel}H : UBRR{validChannel}L
                </span>
              </span>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {/* UBRRnH */}
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-cyan-400 flex justify-between">
                    <span>UBRR{validChannel}H (상위 4비트)</span>
                    <span>Bits [3:0]</span>
                  </div>
                  <div className="text-base font-bold text-white mt-1">
                    0x0{normalMode.ubrrH.toString(16).toUpperCase()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    2진수: {normalMode.ubrrH.toString(2).padStart(4, '0')} (십진수: {normalMode.ubrrH})
                  </div>
                </div>

                {/* UBRRnL */}
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-amber-400 flex justify-between">
                    <span>UBRR{validChannel}L (하위 8비트)</span>
                    <span>Bits [7:0]</span>
                  </div>
                  <div className="text-base font-bold text-white mt-1">
                    0x{normalMode.ubrrL.toString(16).toUpperCase().padStart(2, '0')}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    2진수: {normalMode.ubrrL.toString(2).padStart(8, '0')} (십진수: {normalMode.ubrrL})
                  </div>
                </div>
              </div>
            </div>

            {/* Sampling Specs */}
            <div className="text-xs space-y-1.5 pt-2 border-t border-slate-800/60 text-slate-400">
              <div className="flex justify-between">
                <span>비트 오버샘플링:</span>
                <span className="font-mono text-slate-300">1비트당 16 클럭 주기</span>
              </div>
              <div className="flex justify-between">
                <span>Rx 샘플링 포인트:</span>
                <span className="font-mono text-cyan-300">7, 8, 9번째 틱 (다수결 투표 2/3)</span>
              </div>
              <div className="flex justify-between">
                <span>10비트 프레임 누적 편차:</span>
                <span className="font-mono text-slate-300">
                  약 ±{normalMode.cumulativeDriftPercent.toFixed(1)}% (허용 한계: &lt; 50%)
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Double Speed Mode (U2X = 1) */}
          <div
            className={`rounded-2xl border p-5 space-y-4 transition-all relative ${
              recommendedMode === 'double'
                ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-cyan-500/60 shadow-lg shadow-cyan-950/20 ring-1 ring-cyan-500/30'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            {recommendedMode === 'double' && (
              <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500 text-slate-950 flex items-center gap-1 shadow">
                <Sparkles className="w-3 h-3" /> 추천 설정 (Recommended)
              </div>
            )}

            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-cyan-500 flex items-center justify-center text-[10px] text-slate-950 font-bold">1</span>
                  <h5 className="text-base font-bold text-white">2배속 비동기 모드 (Double Speed)</h5>
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  UCSR{validChannel}A.U2X{validChannel} = 1 (8배 오버샘플링)
                </div>
              </div>
              <div>{getStatusBadge(doubleSpeedMode.status)}</div>
            </div>

            {/* Formula display */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-300">
              <span className="text-cyan-400">UBRR</span> = round( f_osc / (8 × Baud) ) - 1
              <div className="text-[11px] text-slate-400 mt-1">
                = round({fosc.toLocaleString()} / (8 × {desiredBaud.toLocaleString()})) - 1 ={' '}
                <span className="text-amber-300 font-bold">{doubleSpeedMode.ubrrFloat.toFixed(3)}</span> →{' '}
                <span className="text-cyan-400 font-bold">{doubleSpeedMode.ubrr}</span>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 gap-3">
              {/* UBRR Total */}
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">UBRR{validChannel} (12-bit)</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold font-mono text-amber-300">{doubleSpeedMode.ubrr}</span>
                  <span className="text-xs font-mono text-slate-400">
                    (0x{doubleSpeedMode.ubrr.toString(16).toUpperCase().padStart(3, '0')})
                  </span>
                </div>
              </div>

              {/* Error Percent */}
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">보레이트 오차율 (Error %)</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className={`text-xl font-bold font-mono ${
                      Math.abs(doubleSpeedMode.errorPercent) <= 0.5
                        ? 'text-emerald-400'
                        : Math.abs(doubleSpeedMode.errorPercent) <= 2.0
                        ? 'text-cyan-400'
                        : Math.abs(doubleSpeedMode.errorPercent) <= 3.5
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {doubleSpeedMode.errorPercent >= 0 ? '+' : ''}
                    {doubleSpeedMode.errorPercent.toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {doubleSpeedMode.actualBaud.toFixed(1)} bps
                  </span>
                </div>
              </div>
            </div>

            {/* Register Split: UBRRnH & UBRRnL */}
            <div className="bg-slate-900/80 rounded-xl p-3.5 border border-slate-800/90 space-y-2">
              <span className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>하드웨어 레지스터 분할값</span>
                <span className="text-[10px] font-mono text-slate-400">
                  UBRR{validChannel}H : UBRR{validChannel}L
                </span>
              </span>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {/* UBRRnH */}
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-cyan-400 flex justify-between">
                    <span>UBRR{validChannel}H (상위 4비트)</span>
                    <span>Bits [3:0]</span>
                  </div>
                  <div className="text-base font-bold text-white mt-1">
                    0x0{doubleSpeedMode.ubrrH.toString(16).toUpperCase()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    2진수: {doubleSpeedMode.ubrrH.toString(2).padStart(4, '0')} (십진수: {doubleSpeedMode.ubrrH})
                  </div>
                </div>

                {/* UBRRnL */}
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-amber-400 flex justify-between">
                    <span>UBRR{validChannel}L (하위 8비트)</span>
                    <span>Bits [7:0]</span>
                  </div>
                  <div className="text-base font-bold text-white mt-1">
                    0x{doubleSpeedMode.ubrrL.toString(16).toUpperCase().padStart(2, '0')}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    2진수: {doubleSpeedMode.ubrrL.toString(2).padStart(8, '0')} (십진수: {doubleSpeedMode.ubrrL})
                  </div>
                </div>
              </div>
            </div>

            {/* Sampling Specs */}
            <div className="text-xs space-y-1.5 pt-2 border-t border-slate-800/60 text-slate-400">
              <div className="flex justify-between">
                <span>비트 오버샘플링:</span>
                <span className="font-mono text-slate-300">1비트당 8 클럭 주기</span>
              </div>
              <div className="flex justify-between">
                <span>Rx 샘플링 포인트:</span>
                <span className="font-mono text-amber-300">3, 4, 5번째 틱 (다수결 투표 2/3)</span>
              </div>
              <div className="flex justify-between">
                <span>10비트 프레임 누적 편차:</span>
                <span className="font-mono text-slate-300">
                  약 ±{doubleSpeedMode.cumulativeDriftPercent.toFixed(1)}% (허용 한계: &lt; 50%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bit Sampling & Frame Drift Visualization */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
        <h4 className="text-xs font-bold text-slate-200 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            USART 비트 수신 샘플링 타이밍 & 노이즈 필터 메커니즘
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            1 비트 전송 시간: {normalMode.bitTimeUs.toFixed(2)} µs
          </span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Normal 16x sampling diagram */}
          <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800 text-xs space-y-2">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-slate-300 font-bold">16x 오버샘플링 (Normal Speed, U2X=0)</span>
              <span className="text-cyan-400">샘플: 7, 8, 9 틱</span>
            </div>
            {/* 16 grid ticks */}
            <div className="grid grid-cols-16 gap-0.5 h-8 bg-slate-950 p-1 rounded border border-slate-800">
              {Array.from({ length: 16 }).map((_, i) => {
                const isSample = i === 7 || i === 8 || i === 9;
                return (
                  <div
                    key={i}
                    className={`h-full rounded-sm flex items-center justify-center text-[9px] font-mono transition ${
                      isSample
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                        : 'bg-slate-850 text-slate-400 hover:bg-slate-800'
                    }`}
                    title={`Tick ${i} ${isSample ? '(Rx Majority Sample Point)' : ''}`}
                  >
                    {i}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              1비트를 16등분하여 정중앙인 <strong className="text-cyan-300">7, 8, 9번 틱</strong>에서 3회 연속 측정 후 2개 이상 일치하는 값을 채택합니다.
              노이즈 스파이크 필터링에 탁월합니다.
            </p>
          </div>

          {/* Double 8x sampling diagram */}
          <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-800 text-xs space-y-2">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-slate-300 font-bold">8x 오버샘플링 (Double Speed, U2X=1)</span>
              <span className="text-amber-400">샘플: 3, 4, 5 틱</span>
            </div>
            {/* 8 grid ticks */}
            <div className="grid grid-cols-8 gap-1 h-8 bg-slate-950 p-1 rounded border border-slate-800">
              {Array.from({ length: 8 }).map((_, i) => {
                const isSample = i === 3 || i === 4 || i === 5;
                return (
                  <div
                    key={i}
                    className={`h-full rounded-sm flex items-center justify-center text-[9px] font-mono transition ${
                      isSample
                        ? 'bg-amber-400 text-slate-950 font-bold shadow'
                        : 'bg-slate-850 text-slate-400 hover:bg-slate-800'
                    }`}
                    title={`Tick ${i} ${isSample ? '(Rx Majority Sample Point)' : ''}`}
                  >
                    {i}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              1비트를 8등분하여 <strong className="text-amber-300">3, 4, 5번 틱</strong>에서 측정합니다. 분주비가 작아 고속 통신 및 미세 보레이트 조정에 유리하나 수신 지터 마진이 다소 줄어듭니다.
            </p>
          </div>
        </div>
      </div>

      {/* Production Ready C Code Snippet */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono text-slate-200 font-bold">
              usart{validChannel}_init.c (자동 생성 초기화 C 코드)
            </span>
          </div>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700 active:scale-95"
          >
            {copiedCode ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-bold">복사 완료!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>코드 복사</span>
              </>
            )}
          </button>
        </div>
        <div className="p-4 overflow-x-auto max-h-72">
          <pre className="text-xs font-mono text-emerald-300/90 leading-relaxed">
            {generatedCode}
          </pre>
        </div>
      </div>

      {/* Quick Lookup Table: Common Baud Rates under current f_osc */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            현재 클럭({(fosc / 1000000).toFixed(4)} MHz) 기준 주요 보레이트 오차율 일괄 대조표
          </h4>
          <span className="text-[11px] font-mono text-slate-400">
            녹색: 완벽(≤0.5%) | 청색: 양호(≤2.0%) | 황색: 주의(≤3.5%) | 적색: 불가(&gt;3.5%)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60">
                <th className="py-2 px-3">목표 보레이트</th>
                <th className="py-2 px-3">용도/특징</th>
                <th className="py-2 px-3 text-center">일반 모드 (U2X=0) UBRR</th>
                <th className="py-2 px-3 text-center">일반 오차율 (%)</th>
                <th className="py-2 px-3 text-center">2배속 (U2X=1) UBRR</th>
                <th className="py-2 px-3 text-center">2배속 오차율 (%)</th>
                <th className="py-2 px-3 text-right">최적 권장 모드</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {quickTableData.map((row) => {
                const isCurrent = row.baud === desiredBaud;
                return (
                  <tr
                    key={row.baud}
                    onClick={() => handleSelectBaudPreset(row.baud)}
                    className={`cursor-pointer transition hover:bg-slate-850/60 ${
                      isCurrent ? 'bg-cyan-500/10 font-bold' : ''
                    }`}
                  >
                    <td className="py-2 px-3 text-white flex items-center gap-1.5">
                      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                      <span>{row.label} bps</span>
                    </td>
                    <td className="py-2 px-3 text-slate-400 text-[11px]">{row.tag}</td>
                    <td className="py-2 px-3 text-center text-slate-300">
                      {row.nValid ? row.nUbrr : '초과'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] ${
                          Math.abs(row.nErr) <= 0.5
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : Math.abs(row.nErr) <= 2.0
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : Math.abs(row.nErr) <= 3.5
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {row.nErr >= 0 ? '+' : ''}
                        {row.nErr.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center text-slate-300">
                      {row.dValid ? row.dUbrr : '초과'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] ${
                          Math.abs(row.dErr) <= 0.5
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : Math.abs(row.dErr) <= 2.0
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : Math.abs(row.dErr) <= 3.5
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {row.dErr >= 0 ? '+' : ''}
                        {row.dErr.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={`text-[11px] font-bold ${
                          row.betterMode.includes('2배속') ? 'text-cyan-400' : 'text-emerald-400'
                        }`}
                      >
                        {row.betterMode}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
