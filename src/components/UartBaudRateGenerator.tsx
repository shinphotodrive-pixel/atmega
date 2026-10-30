import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Cpu,
  Clock,
  Zap,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Terminal,
  Info,
  Radio,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Layers,
  Sparkles,
  Gauge,
  RotateCcw
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

interface CommonBaudPreset {
  baud: number;
  label: string;
  category: 'Standard' | 'High-Speed' | 'Special';
  note: string;
}

const COMMON_BAUDS: CommonBaudPreset[] = [
  { baud: 2400, label: '2,400 bps', category: 'Standard', note: '장거리 RS-485 / RF 무선 모뎀' },
  { baud: 4800, label: '4,800 bps', category: 'Standard', note: 'GPS NMEA-0183 표준 속도' },
  { baud: 9600, label: '9,600 bps', category: 'Standard', note: '임베디드/산업용 가장 보편적 표준' },
  { baud: 19200, label: '19,200 bps', category: 'Standard', note: 'Modbus RTU / 산업용 PLC' },
  { baud: 31250, label: '31,250 bps', category: 'Special', note: 'MIDI 전자악기 표준 통신 규격' },
  { baud: 38400, label: '38,400 bps', category: 'Standard', note: 'HC-05 블루투스 AT 모드 기본' },
  { baud: 57600, label: '57,600 bps', category: 'Standard', note: 'Arduino Nano 부트로더 / 센서' },
  { baud: 115200, label: '115,200 bps', category: 'High-Speed', note: 'PC 시리얼 모니터 / 고속 디버깅 표준' },
  { baud: 230400, label: '230,400 bps', category: 'High-Speed', note: '고속 로깅 / 고빈도 센서 스트리밍' },
  { baud: 250000, label: '250,000 bps', category: 'Special', note: 'DMX512 무대 조명 제어 프로토콜' },
  { baud: 500000, label: '500,000 bps', category: 'High-Speed', note: '0.5 Mbps 초고속 버스' },
  { baud: 1000000, label: '1,000,000 bps', category: 'High-Speed', note: '1.0 Mbps 하드웨어 한계 초고속' }
];

const CLOCK_PRESETS = [
  { fcpu: 1000000, label: '1.0 MHz', desc: '내부 RC 공장 기본' },
  { fcpu: 4000000, label: '4.0 MHz', desc: '저전력 동작' },
  { fcpu: 7372800, label: '7.3728 MHz', desc: 'UART 무오차 황금 크리스털' },
  { fcpu: 8000000, label: '8.0 MHz', desc: '3.3V Pro Mini / 내부 RC' },
  { fcpu: 11059200, label: '11.0592 MHz', desc: 'UART 전용 0% 오차 크리스털' },
  { fcpu: 12000000, label: '12.0 MHz', desc: 'V-USB 표준' },
  { fcpu: 14745600, label: '14.7456 MHz', desc: 'UART 고속 무오차 크리스털' },
  { fcpu: 16000000, label: '16.0 MHz', desc: '표준 Uno / Mega 5V' },
  { fcpu: 18432000, label: '18.4320 MHz', desc: 'UART 초고속 0% 오차 크리스털' },
  { fcpu: 20000000, label: '20.0 MHz', desc: 'AVR 정격 최대 클록' }
];

export const UartBaudRateGenerator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // User Inputs: Clock Frequency
  const [fcpu, setFcpu] = useState<number>(16000000);
  const [fcpuInputMhz, setFcpuInputMhz] = useState<string>('16.0');
  const [isCustomFcpu, setIsCustomFcpu] = useState<boolean>(false);

  // User Inputs: Target Baud Rate
  const [targetBaud, setTargetBaud] = useState<number>(115200);
  const [baudInputStr, setBaudInputStr] = useState<string>('115200');
  const [isCustomBaud, setIsCustomBaud] = useState<boolean>(false);

  // U2X Double Speed Mode Toggle
  const [isU2X, setIsU2X] = useState<boolean>(false);

  // Target USART Channel Selection
  const [selectedChannel, setSelectedChannel] = useState<number>(0);

  // Copy Feedback
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedUbrr, setCopiedUbrr] = useState<boolean>(false);

  // MCU USART Channels Specs
  const usartChannels = useMemo(() => {
    switch (selectedMCU) {
      case 'atmega2560':
      case 'atmega640':
        return [
          { ch: 0, rxPin: 'PE0 (RXD0)', txPin: 'PE1 (TXD0)', name: 'USART0' },
          { ch: 1, rxPin: 'PD2 (RXD1)', txPin: 'PD3 (TXD1)', name: 'USART1' },
          { ch: 2, rxPin: 'PH0 (RXD2)', txPin: 'PH1 (TXD2)', name: 'USART2' },
          { ch: 3, rxPin: 'PJ0 (RXD3)', txPin: 'PJ1 (TXD3)', name: 'USART3' }
        ];
      case 'atmega128':
        return [
          { ch: 0, rxPin: 'PE0 (RXD0)', txPin: 'PE1 (TXD0)', name: 'USART0' },
          { ch: 1, rxPin: 'PD2 (RXD1)', txPin: 'PD3 (TXD1)', name: 'USART1' }
        ];
      case 'atmega328p':
      default:
        return [
          { ch: 0, rxPin: 'PD0 (RXD)', txPin: 'PD1 (TXD)', name: 'USART0 (Arduino D0/D1)' }
        ];
    }
  }, [selectedMCU]);

  const activeChannelInfo = usartChannels[selectedChannel] || usartChannels[0];

  // Frequency Handlers
  const handleSelectClockPreset = (hz: number) => {
    setFcpu(hz);
    setFcpuInputMhz((hz / 1000000).toString());
    setIsCustomFcpu(false);
  };

  const handleCustomClockChange = (mhzStr: string) => {
    setFcpuInputMhz(mhzStr);
    const mhz = parseFloat(mhzStr);
    if (!isNaN(mhz) && mhz > 0 && mhz <= 30) {
      setFcpu(Math.round(mhz * 1000000));
      setIsCustomFcpu(true);
    }
  };

  // Baud Handlers
  const handleSelectBaudPreset = (baud: number) => {
    setTargetBaud(baud);
    setBaudInputStr(baud.toString());
    setIsCustomBaud(false);
  };

  const handleCustomBaudChange = (baudStr: string) => {
    setBaudInputStr(baudStr);
    const b = parseInt(baudStr, 10);
    if (!isNaN(b) && b > 0 && b <= 2500000) {
      setTargetBaud(b);
      setIsCustomBaud(true);
    }
  };

  // ---------------------------------------------------------------------------
  // Calculations for Normal (U2X=0, 16x) and Double Speed (U2X=1, 8x)
  // Formula:
  //   Normal (U2X=0):       UBRR = (F_CPU / (16 * Baud)) - 1
  //   Double Speed (U2X=1): UBRR = (F_CPU / (8 * Baud)) - 1
  //   Actual Baud = F_CPU / (Divisor * (UBRR + 1))
  //   Error (%) = ((Actual Baud - Target Baud) / Target Baud) * 100%
  // ---------------------------------------------------------------------------
  const calcMode = (u2x: boolean) => {
    const divisor = u2x ? 8 : 16;
    const rawUbrr = fcpu / (divisor * targetBaud) - 1;
    const roundedUbrr = Math.round(rawUbrr);
    const clampedUbrr = Math.max(0, Math.min(4095, roundedUbrr)); // 12-bit register (0..4095)

    const actualBaud = fcpu / (divisor * (clampedUbrr + 1));
    const errorPct = ((actualBaud - targetBaud) / targetBaud) * 100;
    const absError = Math.abs(errorPct);

    const ubrrH = (clampedUbrr >> 8) & 0x0f;
    const ubrrL = clampedUbrr & 0xff;

    const isValid = rawUbrr >= 0 && rawUbrr <= 4095;
    const isUnderflow = rawUbrr < 0; // Baud too high for clock
    const isOverflow = rawUbrr > 4095; // Baud too low for clock

    return {
      u2x,
      divisor,
      rawUbrr,
      roundedUbrr,
      clampedUbrr,
      ubrrH,
      ubrrL,
      ubrrHex: `0x${clampedUbrr.toString(16).padStart(4, '0').toUpperCase()}`,
      ubrrBinary: clampedUbrr.toString(2).padStart(12, '0'),
      actualBaud,
      errorPct,
      absError,
      isValid,
      isUnderflow,
      isOverflow
    };
  };

  const normalCalc = useMemo(() => calcMode(false), [fcpu, targetBaud]);
  const doubleSpeedCalc = useMemo(() => calcMode(true), [fcpu, targetBaud]);

  // Current Active Mode Calculation
  const activeCalc = isU2X ? doubleSpeedCalc : normalCalc;

  // Error Assessment Rating
  const errorVerdict = useMemo(() => {
    const err = activeCalc.absError;
    if (activeCalc.isUnderflow) {
      return {
        level: 'fatal',
        badge: '클록 대비 과도한 고속 (UBRR < 0)',
        color: 'text-rose-400 bg-rose-950/60 border-rose-800/60',
        desc: `현재 F_CPU(${(fcpu / 1000000).toFixed(1)}MHz)에서 생성 가능한 최대 속도는 ${(fcpu / (activeCalc.divisor * 1) / 1000).toFixed(0)}kbps (UBRR=0)입니다.`
      };
    }
    if (err <= 0.2) {
      return {
        level: 'perfect',
        badge: '완벽한 타이밍 (오차 0.2% 이내)',
        color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60',
        desc: 'UART 전용 주파수 수준의 무오차 정밀 통신. 최고 신뢰성 보장.'
      };
    }
    if (err <= 1.5) {
      return {
        level: 'good',
        badge: '매우 우수 (오차 1.5% 이내)',
        color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40',
        desc: '상용 표준 통신 규격 만족. 장거리 케이블 환경에서도 안정적.'
      };
    }
    if (err <= 2.5) {
      return {
        level: 'marginal',
        badge: '허용 범위 내 (오차 2.5% 이하)',
        color: 'text-amber-400 bg-amber-950/40 border-amber-800/40',
        desc: '통신은 가능하나, 슬루레이트나 노이즈가 결합되면 패킷 드롭 가능.'
      };
    }
    if (err <= 3.75) {
      return {
        level: 'warning',
        badge: '임계 경고 (U2X 전환 강력 권장)',
        color: 'text-amber-400 bg-amber-950/60 border-amber-800/60',
        desc: '10비트 프레임 끝에서 누적 스큐로 인해 프레이밍 에러(FE) 위험 높음.'
      };
    }
    return {
      level: 'danger',
      badge: '통신 불능 / 프레이밍 에러 (오차 3.75% 초과)',
      color: 'text-rose-400 bg-rose-950/60 border-rose-800/60',
      desc: '허용 한계를 초과하여 글자 깨짐(Garbage characters) 및 FE0 발생 확실.'
    };
  }, [activeCalc, fcpu]);

  // Is U2X Recommended over Normal?
  const isU2xRecommended = useMemo(() => {
    return doubleSpeedCalc.absError < normalCalc.absError && normalCalc.absError > 2.0;
  }, [normalCalc, doubleSpeedCalc]);

  // Copy helper
  const handleCopy = (text: string, type: 'code' | 'ubrr') => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedUbrr(true);
      setTimeout(() => setCopiedUbrr(false), 2000);
    }
    confetti({
      particleCount: 25,
      spread: 55,
      origin: { y: 0.7 }
    });
  };

  // C Source Code Snippet
  const generatedCCode = useMemo(() => {
    const chStr = activeChannelInfo.ch.toString();
    const ubrrHReg = selectedMCU === 'atmega328p' ? 'UBRR0H' : `UBRR${chStr}H`;
    const ubrrLReg = selectedMCU === 'atmega328p' ? 'UBRR0L' : `UBRR${chStr}L`;
    const ucsraReg = selectedMCU === 'atmega328p' ? 'UCSR0A' : `UCSR${chStr}A`;
    const ucsrbReg = selectedMCU === 'atmega328p' ? 'UCSR0B' : `UCSR${chStr}B`;
    const ucsrcReg = selectedMCU === 'atmega328p' ? 'UCSR0C' : `UCSR${chStr}C`;
    const u2xBit = selectedMCU === 'atmega328p' ? 'U2X0' : `U2X${chStr}`;
    const rxenBit = selectedMCU === 'atmega328p' ? 'RXEN0' : `RXEN${chStr}`;
    const txenBit = selectedMCU === 'atmega328p' ? 'TXEN0' : `TXEN${chStr}`;
    const ucshz0Bit = selectedMCU === 'atmega328p' ? 'UCSZ00' : `UCSZ${chStr}0`;
    const ucshz1Bit = selectedMCU === 'atmega328p' ? 'UCSZ01' : `UCSZ${chStr}1`;
    const udrReg = selectedMCU === 'atmega328p' ? 'UDR0' : `UDR${chStr}`;
    const udreBit = selectedMCU === 'atmega328p' ? 'UDRE0' : `UDRE${chStr}`;
    const rxcBit = selectedMCU === 'atmega328p' ? 'RXC0' : `RXC${chStr}`;

    return `// ==============================================================================
// ${currentProfile.name} ${activeChannelInfo.name} Baud Rate Configuration
// F_CPU          : ${fcpu} Hz (${(fcpu / 1000000).toFixed(4)} MHz)
// Target Baud    : ${targetBaud} bps
// Actual Baud    : ${Math.round(activeCalc.actualBaud)} bps (오차율: ${activeCalc.errorPct >= 0 ? '+' : ''}${activeCalc.errorPct.toFixed(2)}%)
// Mode           : ${isU2X ? 'Double Speed (U2X = 1, 8x 오버샘플링)' : 'Normal Speed (U2X = 0, 16x 오버샘플링)'}
// UBRR Register  : ${activeCalc.clampedUbrr} (0x${activeCalc.clampedUbrr.toString(16).padStart(4, '0').toUpperCase()}) [High: ${activeCalc.ubrrH}, Low: ${activeCalc.ubrrL}]
// Hardware Pins  : RX=${activeChannelInfo.rxPin}, TX=${activeChannelInfo.txPin}
// ==============================================================================
#define F_CPU ${fcpu}UL
#include <avr/io.h>

/**
 * @brief ${activeChannelInfo.name} 통신 초기화 루틴 (${targetBaud} bps, 8N1)
 */
void USART_Init(void) {
    // 1. 보드레이트 생성기(UBRR) 설정 (12-bit 레지스터)
    ${ubrrHReg} = (uint8_t)(${activeCalc.clampedUbrr} >> 8); // High 4-bit: 0x0${activeCalc.ubrrH.toString(16).toUpperCase()}
    ${ubrrLReg} = (uint8_t)(${activeCalc.clampedUbrr} & 0xFF); // Low 8-bit: 0x${activeCalc.ubrrL.toString(16).padStart(2, '0').toUpperCase()}

${isU2X ? `    // 2. 2배속 모드(U2X) 활성화 (오차율 ${normalCalc.errorPct.toFixed(2)}% -> ${doubleSpeedCalc.errorPct.toFixed(2)}% 개선)
    ${ucsraReg} |= (1 << ${u2xBit});
` : `    // 2. 표준 속도 모드 (U2X = 0)
    ${ucsraReg} &= ~(1 << ${u2xBit});
`}
    // 3. 송신기(TX) 및 수신기(RX) 활성화
    ${ucsrbReg} = (1 << ${rxenBit}) | (1 << ${txenBit});

    // 4. 프레임 포맷 설정: 8 데이터 비트, 무패리티, 1 스톱 비트 (8N1)
    ${ucsrcReg} = (1 << ${ucshz1Bit}) | (1 << ${ucshz0Bit});
}

/**
 * @brief 1바이트 전송 함수 (폴링 방식)
 */
void USART_Transmit(uint8_t data) {
    // 송신 데이터 버퍼(UDRE)가 빌 때까지 대기
    while (!(${ucsraReg} & (1 << ${udreBit})));
    // 데이터 버퍼에 적재하여 전송 시작
    ${udrReg} = data;
}

/**
 * @brief 1바이트 수신 함수 (폴링 방식)
 */
uint8_t USART_Receive(void) {
    // 데이터 수신 완료(RXC) 플래그 셋 대기
    while (!(${ucsraReg} & (1 << ${rxcBit})));
    return ${udrReg};
}
`;
  }, [
    currentProfile.name,
    activeChannelInfo,
    selectedMCU,
    fcpu,
    targetBaud,
    isU2X,
    activeCalc,
    normalCalc.errorPct,
    doubleSpeedCalc.errorPct
  ]);

  const ubrrSnippet = `// UBRR Register Values for ${targetBaud} bps @ ${(fcpu / 1000000).toFixed(2)}MHz (${isU2X ? 'U2X=1' : 'U2X=0'})\nUBRRH = ${activeCalc.ubrrH}; // 0x0${activeCalc.ubrrH.toString(16).toUpperCase()}\nUBRRL = ${activeCalc.ubrrL}; // 0x${activeCalc.ubrrL.toString(16).padStart(2, '0').toUpperCase()}\n${isU2X ? 'UCSRA |= (1 << U2X); // 2배속 모드' : 'UCSRA &= ~(1 << U2X);'}`;

  return (
    <div id="usart-baud-rate-calculator-section" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur shadow-2xl space-y-6 scroll-mt-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <Calculator className="w-3.5 h-3.5" /> USART Baud Rate Calculator
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              UBRRn Register & Double Speed (U2Xn) Calculator
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-xs font-mono font-bold">
              {currentProfile.name}
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            USART 보드레이트 계산기 (USART Baud Rate Calculator)
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            목표 보드레이트(Target Baud Rate)와 시스템 클록(F_CPU)을 선택하고,
            <strong className="text-purple-300 font-mono">Double Speed (U2Xn)</strong> 모드를 토글하여 필요한 12비트 <strong className="text-amber-300 font-mono">UBRRn</strong> 레지스터 값(UBRRnH / UBRRnL),
            실제 생성 보드레이트(Actual Baud Rate), 그리고 <strong className="text-cyan-300 font-mono">통신 오차율(Percentage of Error %)</strong>을 실시간으로 계산하고 검증합니다.
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

      {/* Control Grid: 1. System Clock & Channel, 2. Target Baud Rate & U2X */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (6 cols): System Clock & Target Baud */}
        <div className="lg:col-span-6 space-y-4">
          {/* Section 1: System Clock (F_CPU) */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                1. 시스템 클록 주파수 (System Clock: F_CPU)
              </label>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                {(fcpu / 1000000).toFixed(4)} MHz
              </span>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {CLOCK_PRESETS.map((preset) => {
                const isSelected = !isCustomFcpu && fcpu === preset.fcpu;
                return (
                  <button
                    key={preset.fcpu}
                    onClick={() => handleSelectClockPreset(preset.fcpu)}
                    className={`p-2 rounded-xl text-left border transition ${
                      isSelected
                        ? 'bg-amber-500/20 text-white border-amber-500/60 shadow-sm ring-1 ring-amber-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold font-mono text-amber-300">{preset.label}</div>
                    <div className="text-[10px] text-slate-400 truncate">{preset.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Custom Clock Input */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800/50">
              <span className="text-xs text-slate-400 shrink-0">커스텀 주파수 직접 입력:</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.001"
                  min="0.1"
                  max="30"
                  value={fcpuInputMhz}
                  onChange={(e) => handleCustomClockChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                  placeholder="예: 16.0"
                />
                <span className="absolute right-3 top-1.5 text-xs text-slate-500 font-mono">MHz</span>
              </div>
            </div>
          </div>

          {/* Section 2: Target Baud Rate */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-cyan-400" />
                2. 목표 통신속도 (Target Baud Rate)
              </label>
              <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
                {targetBaud.toLocaleString()} bps
              </span>
            </div>

            {/* Baud Rate Presets Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {COMMON_BAUDS.map((preset) => {
                const isSelected = !isCustomBaud && targetBaud === preset.baud;
                return (
                  <button
                    key={preset.baud}
                    onClick={() => handleSelectBaudPreset(preset.baud)}
                    className={`p-2 rounded-xl text-left border transition ${
                      isSelected
                        ? 'bg-cyan-950/40 text-white border-cyan-500/60 shadow-sm ring-1 ring-cyan-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold font-mono text-cyan-300">{preset.label}</div>
                    <div className="text-[10px] text-slate-500 truncate">{preset.note}</div>
                  </button>
                );
              })}
            </div>

            {/* Custom Baud Rate Input */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800/50">
              <span className="text-xs text-slate-400 shrink-0">임의 보드레이트 직접 입력:</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  step="1"
                  min="300"
                  max="2500000"
                  value={baudInputStr}
                  onChange={(e) => handleCustomBaudChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                  placeholder="예: 115200"
                />
                <span className="absolute right-3 top-1.5 text-xs text-slate-500 font-mono">bps</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (6 cols): U2X Mode Toggle, Channel & Calculated Outputs */}
        <div className="lg:col-span-6 space-y-4">
          {/* Section 3: U2X Double Speed Mode Toggle & Channel Selector */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 border-b border-slate-800/70 pb-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              3. U2X 모드 토글 & USART 채널 지정
            </span>

            {/* U2X Mode Toggle Box */}
            <div
              onClick={() => setIsU2X(!isU2X)}
              className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                isU2X
                  ? 'bg-purple-950/40 border-purple-500 text-white shadow-md shadow-purple-950/30'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">U2X 2배속 모드 (Double Speed: U2X = 1)</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                      isU2X ? 'bg-purple-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isU2X ? '8배 오버샘플링' : '16배 오버샘플링 (표준)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  분주비를 16에서 8로 낮추어, 16MHz 클록에서 115200bps 등 고속 통신 시의 정수 반올림 오차율을 획기적으로 개선합니다.
                </p>
              </div>

              {/* Toggle Switch */}
              <div
                className={`w-12 h-6 rounded-full transition-colors p-1 flex items-center shrink-0 ${
                  isU2X ? 'bg-purple-500 justify-end' : 'bg-slate-800 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-md" />
              </div>
            </div>

            {/* Channel Selector (If MCU supports multi-USART) */}
            {usartChannels.length > 1 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">하드웨어 USART 채널 선택:</span>
                  <span className="font-mono text-cyan-400">
                    RX: {activeChannelInfo.rxPin} | TX: {activeChannelInfo.txPin}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs font-mono">
                  {usartChannels.map((c) => (
                    <button
                      key={c.ch}
                      onClick={() => setSelectedChannel(c.ch)}
                      className={`p-2 rounded-xl border text-center transition ${
                        selectedChannel === c.ch
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 font-bold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Main Calculation Output Box */}
          <div className="bg-slate-950/90 border border-amber-500/40 rounded-2xl p-5 shadow-xl shadow-amber-950/20 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Gauge className="w-4 h-4 text-amber-400" />
                계산된 UBRR 레지스터 & 오차율 산출 결과
              </span>
              <button
                onClick={() => handleCopy(ubrrSnippet, 'ubrr')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition"
              >
                {copiedUbrr ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUbrr ? '복사됨!' : '레지스터값 복사'}</span>
              </button>
            </div>

            {/* Stat Cards: UBRR Decimal & UBRRH/UBRRL */}
            <div className="grid grid-cols-2 gap-3 text-center">
              {/* UBRR Value */}
              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-mono">UBRR 전체 레지스터 값</span>
                <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight block my-0.5">
                  {activeCalc.clampedUbrr}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {activeCalc.ubrrHex} • 12-bit
                </span>
              </div>

              {/* UBRRH & UBRRL Split */}
              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-mono">UBRRH : UBRRL 분할 바이트</span>
                <span className="text-xl sm:text-2xl font-black text-cyan-400 font-mono tracking-tight block my-0.5">
                  0x0{activeCalc.ubrrH.toString(16).toUpperCase()} : 0x{activeCalc.ubrrL.toString(16).padStart(2, '0').toUpperCase()}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  High: {activeCalc.ubrrH} | Low: {activeCalc.ubrrL}
                </span>
              </div>
            </div>

            {/* Precision & Error Breakdown */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">목표 보드레이트 (Target):</span>
                <span className="text-white font-bold">{targetBaud.toLocaleString()} bps</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">실제 생성 보드레이트 (Actual):</span>
                <span className="text-amber-300 font-bold">{Math.round(activeCalc.actualBaud).toLocaleString()} bps</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">통신 잠재 오차율 (Error Rate):</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded ${
                    activeCalc.absError <= 1.0
                      ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/40'
                      : activeCalc.absError <= 2.5
                      ? 'text-amber-400 bg-amber-950/40'
                      : 'text-rose-400 bg-rose-950/60 border border-rose-800/60'
                  }`}
                >
                  {activeCalc.errorPct >= 0 ? '+' : ''}{activeCalc.errorPct.toFixed(2)}% ({errorVerdict.badge})
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-800/70 pt-2">
                <span className="text-slate-400">적용 분주 모드:</span>
                <span className="text-purple-300 font-bold">
                  {isU2X ? 'Double Speed (8분주 / U2X=1)' : 'Normal Speed (16분주 / U2X=0)'}
                </span>
              </div>
            </div>

            {/* Verdict Explanation Banner */}
            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${errorVerdict.color}`}>
              {activeCalc.absError > 3.75 ? (
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : activeCalc.absError > 2.0 ? (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <span className="font-bold block">{errorVerdict.badge}</span>
                <span className="text-[11px] opacity-90 block leading-relaxed">{errorVerdict.desc}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Comparison: Normal Speed (U2X=0) vs Double Speed (U2X=1) */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            표준 모드(U2X=0) vs 2배속 모드(U2X=1) 나란히 비교 (Side-by-Side Mode Comparison)
          </span>
          {isU2xRecommended && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> U2X 모드 사용 시 오차 대폭 개선 권장!
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
          {/* Normal Mode Card */}
          <div
            onClick={() => setIsU2X(false)}
            className={`p-4 rounded-xl border cursor-pointer transition ${
              !isU2X
                ? 'bg-slate-900 border-amber-500/70 shadow-md ring-1 ring-amber-500/50'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700 opacity-80'
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-white text-sm">Normal Speed Mode (U2X = 0)</span>
              {!isU2X && <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-bold">현재 선택됨</span>}
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>계산 공식:</span>
                <span className="text-slate-300">UBRR = (F_CPU / (16 * Baud)) - 1</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>계산된 UBRR 값:</span>
                <span className="font-bold text-amber-400">{normalCalc.clampedUbrr} (0x{normalCalc.clampedUbrr.toString(16).toUpperCase()})</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[10px]">
                <span>UBRRH : UBRRL 분할:</span>
                <span className="text-cyan-400">0x0{normalCalc.ubrrH.toString(16).toUpperCase()} : 0x{normalCalc.ubrrL.toString(16).padStart(2, '0').toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>실제 생성 보드레이트:</span>
                <span className="text-white font-mono">{normalCalc.actualBaud.toFixed(2)} bps</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1.5">
                <span className="text-slate-400">잠재 통신 오차율:</span>
                <span
                  className={`font-bold px-1.5 py-0.5 rounded ${
                    normalCalc.absError <= 1.5
                      ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/40'
                      : normalCalc.absError <= 2.5
                      ? 'text-amber-400 bg-amber-950/40'
                      : 'text-rose-400 bg-rose-950/60 border border-rose-800/60'
                  }`}
                >
                  {normalCalc.errorPct >= 0 ? '+' : ''}{normalCalc.errorPct.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Double Speed Mode Card */}
          <div
            onClick={() => setIsU2X(true)}
            className={`p-4 rounded-xl border cursor-pointer transition ${
              isU2X
                ? 'bg-slate-900 border-purple-500/70 shadow-md ring-1 ring-purple-500/50'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700 opacity-80'
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-white text-sm">Double Speed Mode (U2X = 1)</span>
              {isU2X && <span className="text-[10px] bg-purple-500 text-white px-2 py-0.5 rounded font-bold">현재 선택됨</span>}
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>계산 공식:</span>
                <span className="text-slate-300">UBRR = (F_CPU / (8 * Baud)) - 1</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>계산된 UBRR 값:</span>
                <span className="font-bold text-purple-300">{doubleSpeedCalc.clampedUbrr} (0x{doubleSpeedCalc.clampedUbrr.toString(16).toUpperCase()})</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[10px]">
                <span>UBRRH : UBRRL 분할:</span>
                <span className="text-cyan-400">0x0{doubleSpeedCalc.ubrrH.toString(16).toUpperCase()} : 0x{doubleSpeedCalc.ubrrL.toString(16).padStart(2, '0').toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>실제 생성 보드레이트:</span>
                <span className="text-white font-mono">{doubleSpeedCalc.actualBaud.toFixed(2)} bps</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1.5">
                <span className="text-slate-400">잠재 통신 오차율:</span>
                <span
                  className={`font-bold px-1.5 py-0.5 rounded ${
                    doubleSpeedCalc.absError <= 1.5
                      ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/40'
                      : doubleSpeedCalc.absError <= 2.5
                      ? 'text-amber-400 bg-amber-950/40'
                      : 'text-rose-400 bg-rose-950/60 border border-rose-800/60'
                  }`}
                >
                  {doubleSpeedCalc.errorPct >= 0 ? '+' : ''}{doubleSpeedCalc.errorPct.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Production C-Code Generator */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono font-bold text-white">
              C 언어 USART 초기화 & 드라이버 코드 ({currentProfile.name})
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              UBRR={activeCalc.clampedUbrr} • {isU2X ? 'U2X=1' : 'U2X=0'}
            </span>
          </div>

          <button
            onClick={() => handleCopy(generatedCCode, 'code')}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-amber-500/20"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? '복사 완료!' : 'C 소스코드 복사'}</span>
          </button>
        </div>

        <pre className="p-4 overflow-x-auto max-h-[380px] overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed bg-slate-950 custom-scrollbar select-all">
          {generatedCCode}
        </pre>
      </div>
    </div>
  );
};
