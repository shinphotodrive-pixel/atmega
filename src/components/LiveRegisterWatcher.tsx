import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Eye,
  Activity,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  Sliders,
  Terminal,
  Send,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Cpu,
  Layers,
  Search,
  Filter,
  Check,
  Bell
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export interface WatchedRegister {
  id: string;
  name: string;
  addressHex: string;
  bitWidth: 8 | 16;
  value: number;
  prevValue: number;
  history: number[]; // Last 20 values
  bitLabels: string[];
  description: string;
}

// Default Registers per MCU
const DEFAULT_WATCH_LIST_BASE: Omit<WatchedRegister, 'value' | 'prevValue' | 'history'>[] = [
  {
    id: 'portb',
    name: 'PORTB',
    addressHex: '0x25',
    bitWidth: 8,
    bitLabels: ['PB7', 'PB6', 'PB5', 'PB4', 'PB3', 'PB2', 'PB1', 'PB0'],
    description: '포트 B 데이터 출력 레지스터 (PB5: Arduino 빌트인 LED)'
  },
  {
    id: 'ddrb',
    name: 'DDRB',
    addressHex: '0x24',
    bitWidth: 8,
    bitLabels: ['DDB7', 'DDB6', 'DDB5', 'DDB4', 'DDB3', 'DDB2', 'DDB1', 'DDB0'],
    description: '포트 B 핀 입출력 방향 설정 레지스터 (1: 출력, 0: 입력)'
  },
  {
    id: 'pinb',
    name: 'PINB',
    addressHex: '0x23',
    bitWidth: 8,
    bitLabels: ['PINB7', 'PINB6', 'PINB5', 'PINB4', 'PINB3', 'PINB2', 'PINB1', 'PINB0'],
    description: '포트 B 물리 핀 입력 전압 레벨 읽기 레지스터'
  },
  {
    id: 'tcnt1',
    name: 'TCNT1',
    addressHex: '0x84',
    bitWidth: 16,
    bitLabels: ['B15', 'B14', 'B13', 'B12', 'B11', 'B10', 'B9', 'B8', 'B7', 'B6', 'B5', 'B4', 'B3', 'B2', 'B1', 'B0'],
    description: '타이머/카운터 1 16비트 카운터 카운트 값 (0 ~ 65535)'
  },
  {
    id: 'tccr1b',
    name: 'TCCR1B',
    addressHex: '0x81',
    bitWidth: 8,
    bitLabels: ['ICNC1', 'ICES1', '-', 'WGM13', 'WGM12', 'CS12', 'CS11', 'CS10'],
    description: '타이머 1 제어 레지스터 B (프리스케일러 CS 및 모드 WGM 상위)'
  },
  {
    id: 'udr0',
    name: 'UDR0',
    addressHex: '0xC6',
    bitWidth: 8,
    bitLabels: ['TXB7', 'TXB6', 'TXB5', 'TXB4', 'TXB3', 'TXB2', 'TXB1', 'TXB0'],
    description: 'USART0 I/O 데이터 전송 및 수신 버퍼 레지스터'
  },
  {
    id: 'adc',
    name: 'ADC',
    addressHex: '0x78',
    bitWidth: 16,
    bitLabels: ['-', '-', '-', '-', '-', '-', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'],
    description: '10비트 아날로그 디지털 컨버터 변환 결과값 (0 ~ 1023)'
  },
  {
    id: 'sreg',
    name: 'SREG',
    addressHex: '0x5F',
    bitWidth: 8,
    bitLabels: ['I', 'T', 'H', 'S', 'V', 'N', 'Z', 'C'],
    description: 'AVR CPU 상태 레지스터 (I: 글로벌 인터럽트, Z: 제로 플래그, C: 캐리)'
  }
];

// Available Registers to Add
const AVAILABLE_REGISTERS_POOL: { name: string; addressHex: string; bitWidth: 8 | 16; bitLabels: string[]; desc: string }[] = [
  { name: 'PORTD', addressHex: '0x2B', bitWidth: 8, bitLabels: ['PD7', 'PD6', 'PD5', 'PD4', 'PD3', 'PD2', 'PD1', 'PD0'], desc: '포트 D 데이터 출력 레지스터' },
  { name: 'DDRD', addressHex: '0x2A', bitWidth: 8, bitLabels: ['DDD7', 'DDD6', 'DDD5', 'DDD4', 'DDD3', 'DDD2', 'DDD1', 'DDD0'], desc: '포트 D 방향 설정 레지스터' },
  { name: 'PIND', addressHex: '0x29', bitWidth: 8, bitLabels: ['PIND7', 'PIND6', 'PIND5', 'PIND4', 'PIND3', 'PIND2', 'PIND1', 'PIND0'], desc: '포트 D 핀 상태 읽기' },
  { name: 'OCR1A', addressHex: '0x88', bitWidth: 16, bitLabels: ['H7', 'H6', 'H5', 'H4', 'H3', 'H2', 'H1', 'H0', 'L7', 'L6', 'L5', 'L4', 'L3', 'L2', 'L1', 'L0'], desc: '타이머 1 출력 비교 A 일치 기준값' },
  { name: 'UCSR0A', addressHex: '0xC0', bitWidth: 8, bitLabels: ['RXC0', 'TXC0', 'UDRE0', 'FE0', 'DOR0', 'UPE0', 'U2X0', 'MPCM0'], desc: 'USART0 제어 및 상태 레지스터 A' },
  { name: 'ADMUX', addressHex: '0x7C', bitWidth: 8, bitLabels: ['REFS1', 'REFS0', 'ADLAR', '-', 'MUX3', 'MUX2', 'MUX1', 'MUX0'], desc: 'ADC 기준 전압 및 채널 선택 레지스터' },
  { name: 'ADCSRA', addressHex: '0x7A', bitWidth: 8, bitLabels: ['ADEN', 'ADSC', 'ADATE', 'ADIF', 'ADIE', 'ADPS2', 'ADPS1', 'ADPS0'], desc: 'ADC 활성화 및 변환 시작/분주비' },
  { name: 'WDTCSR', addressHex: '0x60', bitWidth: 8, bitLabels: ['WDIF', 'WDIE', 'WDP3', 'WDCE', 'WDE', 'WDP2', 'WDP1', 'WDP0'], desc: '워치독 타이머 제어 레지스터' },
  { name: 'SPCR', addressHex: '0x4C', bitWidth: 8, bitLabels: ['SPIE', 'SPE', 'DORD', 'MSTR', 'CPOL', 'CPHA', 'SPR1', 'SPR0'], desc: 'SPI 버스 제어 레지스터' }
];

export const LiveRegisterWatcher: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Watched Registers State
  const [watchList, setWatchList] = useState<WatchedRegister[]>(() => {
    return DEFAULT_WATCH_LIST_BASE.map((item) => ({
      ...item,
      value: item.id === 'portb' ? 0x20 : item.id === 'ddrb' ? 0x20 : item.id === 'sreg' ? 0x80 : 0,
      prevValue: 0,
      history: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    }));
  });

  // Simulation Stream Parameters
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [simSpeedMs, setSimSpeedMs] = useState<number>(300); // 300ms update
  const [scenarioMode, setScenarioMode] = useState<'pwm_sensor' | 'uart_comm' | 'gpio_relay'>('pwm_sensor');
  const [rawTerminalLogs, setRawTerminalLogs] = useState<string[]>([]);
  const [customStreamInput, setCustomStreamInput] = useState<string>('PORTB=0x20 TCNT1=0x1F40 ADC=512');
  const [alertRuleReg, setAlertRuleReg] = useState<string>('PORTB');
  const [alertRuleCondition, setAlertRuleCondition] = useState<string>('bit5_high');
  const [triggeredAlert, setTriggeredAlert] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Simulation Tick Counter
  const tickRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Update a specific register value
  const updateRegister = (regName: string, newVal: number) => {
    setWatchList((prev) =>
      prev.map((reg) => {
        if (reg.name.toUpperCase() === regName.toUpperCase()) {
          const clamped = reg.bitWidth === 16 ? newVal & 0xffff : newVal & 0xff;
          const newHistory = [...reg.history.slice(1), clamped];
          return {
            ...reg,
            prevValue: reg.value,
            value: clamped,
            history: newHistory
          };
        }
        return reg;
      })
    );
  };

  // Run Simulation Tick
  useEffect(() => {
    if (!isLiveStreaming) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      tickRef.current += 1;
      const t = tickRef.current;
      const timestamp = new Date().toLocaleTimeString('ko-KR', { hour12: false }) + `.${(Date.now() % 1000).toString().padStart(3, '0')}`;

      let logMsg = '';

      if (scenarioMode === 'pwm_sensor') {
        // TCNT1 ramps up
        const tcnt1Val = (t * 128) % 65536;
        // PORTB toggles PB5 on compare match
        const isCompMatch = (t % 8) < 4;
        const portbVal = isCompMatch ? 0x20 : 0x00;
        // ADC fluctuates with simulated noise around 512
        const adcNoise = Math.floor(Math.sin(t * 0.3) * 60 + 512 + (Math.random() * 10 - 5));
        const adclamped = Math.max(0, Math.min(1023, adcNoise));
        // SREG
        const sregVal = isCompMatch ? 0x82 : 0x80;

        updateRegister('TCNT1', tcnt1Val);
        updateRegister('PORTB', portbVal);
        updateRegister('ADC', adclamped);
        updateRegister('SREG', sregVal);

        logMsg = `[${timestamp}] TELEM: PORTB=0x${portbVal.toString(16).padStart(2, '0').toUpperCase()} TCNT1=0x${tcnt1Val.toString(16).padStart(4, '0').toUpperCase()} ADC=${adclamped} SREG=0x${sregVal.toString(16).padStart(2, '0').toUpperCase()}`;

        // Check Alert
        if (alertRuleReg === 'PORTB' && alertRuleCondition === 'bit5_high' && (portbVal & 0x20)) {
          setTriggeredAlert(`경보 트리거: PORTB PB5 (0x20) High 활성화 감지됨!`);
        } else if (alertRuleReg === 'TCNT1' && tcnt1Val > 50000) {
          setTriggeredAlert(`경보 트리거: TCNT1 카운터 한계(50,000) 초과 임박!`);
        }
      } else if (scenarioMode === 'uart_comm') {
        const chars = ['H', 'E', 'L', 'L', 'O', ' ', 'A', 'V', 'R', '!'];
        const charCode = chars[t % chars.length].charCodeAt(0);
        const ucsrVal = (t % 2 === 0) ? 0x20 : 0xa0; // UDRE0 or RXC0
        const sregVal = 0x80;

        updateRegister('UDR0', charCode);
        updateRegister('UCSR0A', ucsrVal);
        updateRegister('SREG', sregVal);

        logMsg = `[${timestamp}] UART_RX: UDR0='${String.fromCharCode(charCode)}'(0x${charCode.toString(16).toUpperCase()}) UCSR0A=0x${ucsrVal.toString(16).toUpperCase()}`;
      } else {
        // GPIO Relay mode
        const portbVal = (1 << (t % 6));
        const pinbVal = portbVal;
        const ddrbVal = 0x3f;

        updateRegister('PORTB', portbVal);
        updateRegister('PINB', pinbVal);
        updateRegister('DDRB', ddrbVal);

        logMsg = `[${timestamp}] GPIO_STATE: PORTB=0x${portbVal.toString(16).padStart(2, '0').toUpperCase()} PINB=0x${pinbVal.toString(16).padStart(2, '0').toUpperCase()}`;
      }

      setRawTerminalLogs((prev) => [logMsg, ...prev.slice(0, 39)]);
    }, simSpeedMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLiveStreaming, simSpeedMs, scenarioMode, alertRuleReg, alertRuleCondition]);

  // Handle Injecting Custom Text into Stream
  const handleInjectStream = () => {
    if (!customStreamInput.trim()) return;

    const parts = customStreamInput.split(/\s+/);
    parts.forEach((part) => {
      const [reg, valStr] = part.split('=');
      if (reg && valStr) {
        let valNum = 0;
        if (valStr.startsWith('0x') || valStr.startsWith('0X')) {
          valNum = parseInt(valStr, 16);
        } else {
          valNum = parseInt(valStr, 10);
        }
        if (!isNaN(valNum)) {
          updateRegister(reg, valNum);
        }
      }
    });

    const timestamp = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    setRawTerminalLogs((prev) => [`[${timestamp}] MANUAL_INJECT: ${customStreamInput}`, ...prev.slice(0, 39)]);
  };

  // Add register from pool
  const handleAddRegister = (item: typeof AVAILABLE_REGISTERS_POOL[0]) => {
    if (watchList.some((w) => w.name.toUpperCase() === item.name.toUpperCase())) {
      setShowAddModal(false);
      return;
    }

    const newEntry: WatchedRegister = {
      id: item.name.toLowerCase(),
      name: item.name,
      addressHex: item.addressHex,
      bitWidth: item.bitWidth,
      value: 0,
      prevValue: 0,
      history: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      bitLabels: item.bitLabels,
      description: item.desc
    };

    setWatchList((prev) => [...prev, newEntry]);
    setShowAddModal(false);
    confetti({ particleCount: 20, spread: 50, origin: { y: 0.7 } });
  };

  // Remove register
  const handleRemoveRegister = (id: string) => {
    setWatchList((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-7 shadow-2xl backdrop-blur">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <Eye className="w-3.5 h-3.5" /> 실시간 레지스터 와처 (Live Register Watcher)
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              감시 중인 SFR: {watchList.length}개
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 text-xs font-mono font-bold">
              {currentProfile.name}
            </span>
            {isLiveStreaming && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 text-[11px] font-mono font-bold flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                STREAM ACTIVE ({1000 / simSpeedMs} Hz)
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            SFR 실시간 레지스터 상태 변화 모니터 (Live Register Watcher)
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            관심 있는 중요 AVR 레지스터(PORTB, TCNT1, UDR0, ADC 등)를 와치리스트에 등록하고, 가상 시리얼 텔레메트리 스트림을 통해 실시간 비트 반전, 카운터 증가 및 인터럽트 플래그 변화를 시각적으로 추적합니다.
          </p>
        </div>

        {/* Global Control Bar */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className={`px-3.5 py-2 rounded-xl text-white text-xs font-bold transition shadow-lg flex items-center gap-1.5 ${
              isLiveStreaming
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
            }`}
          >
            {isLiveStreaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isLiveStreaming ? '스트림 일시정지' : '스트림 재생'}</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>레지스터 추가</span>
          </button>
        </div>
      </div>

      {/* Alert Banner if Triggered */}
      {triggeredAlert && (
        <div className="p-3.5 bg-rose-950/80 border border-rose-800 rounded-2xl flex items-center justify-between text-xs text-rose-200 font-mono animate-bounce">
          <div className="flex items-center gap-2 font-bold">
            <Bell className="w-4 h-4 text-rose-400" />
            <span>{triggeredAlert}</span>
          </div>
          <button
            onClick={() => setTriggeredAlert(null)}
            className="text-slate-400 hover:text-white text-[11px]"
          >
            닫기
          </button>
        </div>
      )}

      {/* Stream Controls & Scenario Quick Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
        {/* Scenario Switcher */}
        <div className="lg:col-span-6 space-y-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            시뮬레이션 시나리오 모드 (Telemetry Scenario):
          </span>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'pwm_sensor', label: 'PWM & ADC 센서', desc: 'TCNT1 램프, PB5 LED, ADC' },
              { id: 'uart_comm', label: 'UART 통신 스트림', desc: 'UDR0 문자, UCSR 플래그' },
              { id: 'gpio_relay', label: 'GPIO 릴레이 제어', desc: 'PORTB / PINB 비트 회전' }
            ].map((sc) => (
              <button
                key={sc.id}
                onClick={() => setScenarioMode(sc.id as any)}
                className={`p-2 rounded-xl border text-left transition ${
                  scenarioMode === sc.id
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-600 font-bold shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs truncate">{sc.label}</div>
                <div className="text-[9px] text-slate-500 truncate mt-0.5">{sc.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Speed Slider */}
        <div className="lg:col-span-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>수신 속도 (Tick Delay):</span>
            <span className="text-cyan-400 font-bold">{simSpeedMs} ms</span>
          </div>
          <input
            type="range"
            min="100"
            max="1000"
            step="50"
            value={simSpeedMs}
            onChange={(e) => setSimSpeedMs(parseInt(e.target.value) || 300)}
            className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg mt-2"
          />
          <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
            <span>고속 100ms (10Hz)</span>
            <span>저속 1000ms (1Hz)</span>
          </div>
        </div>

        {/* Watchpoint Alert Condition */}
        <div className="lg:col-span-3 space-y-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            와치포인트 경보 (Watchpoint Alert):
          </span>
          <select
            value={alertRuleCondition}
            onChange={(e) => setAlertRuleCondition(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
          >
            <option value="bit5_high">PORTB PB5 (0x20) == 1 일 때 경보</option>
            <option value="tcnt1_overflow">TCNT1 &gt; 50,000 일 때 경보</option>
            <option value="none">경보 비활성화</option>
          </select>
        </div>
      </div>

      {/* Watched Registers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {watchList.map((reg) => {
          const isChanged = reg.value !== reg.prevValue;
          const is16Bit = reg.bitWidth === 16;
          const hexString = `0x${reg.value.toString(16).toUpperCase().padStart(is16Bit ? 4 : 2, '0')}`;

          return (
            <div
              key={reg.id}
              className={`bg-slate-950/70 border rounded-2xl p-4 space-y-3 transition group relative ${
                isChanged ? 'border-cyan-500/80 shadow-md shadow-cyan-500/10' : 'border-slate-800'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white font-mono">{reg.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({reg.addressHex})</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                      {reg.bitWidth}-Bit
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{reg.description}</p>
                </div>
                <button
                  onClick={() => handleRemoveRegister(reg.id)}
                  className="opacity-0 group-hover:opacity-100 transition text-slate-500 hover:text-rose-400 p-1"
                  title="감시 목록에서 제거"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Numerical Value Presentation */}
              <div className="flex items-baseline justify-between bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-800/80">
                <div className="text-xl font-bold font-mono text-cyan-400 tracking-wider">
                  {hexString}
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  {reg.value.toLocaleString()} <span className="text-[10px] text-slate-500">dec</span>
                </div>
              </div>

              {/* Bit Breakdown Grid (8 or 16 bits) */}
              <div className="space-y-1">
                <span className="text-[9px] text-slate-500 block uppercase font-mono">비트 레벨 상태 (Bit Breakdown):</span>
                <div className={`grid gap-0.5 font-mono text-[9px] select-none ${is16Bit ? 'grid-cols-8' : 'grid-cols-8'}`}>
                  {Array.from({ length: reg.bitWidth }).map((_, idx) => {
                    const bitIdx = reg.bitWidth - 1 - idx;
                    const bitVal = (reg.value >> bitIdx) & 1;
                    const prevBitVal = (reg.prevValue >> bitIdx) & 1;
                    const bitChanged = bitVal !== prevBitVal;
                    const label = reg.bitLabels[idx] || `B${bitIdx}`;

                    return (
                      <div
                        key={bitIdx}
                        className={`p-1 rounded text-center transition flex flex-col items-center justify-center border ${
                          bitVal === 1
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60 font-bold'
                            : 'bg-slate-900 text-slate-500 border-slate-800'
                        } ${bitChanged ? 'ring-1 ring-cyan-400' : ''}`}
                        title={`${label} (Bit ${bitIdx}) = ${bitVal}`}
                      >
                        <span className="text-[8px] opacity-70 truncate max-w-[28px]">{label}</span>
                        <span className="text-[10px] font-bold mt-0.5">{bitVal}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mini Sparkline History Bar */}
              <div className="space-y-1 pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                  <span>변화 추이 (Trend)</span>
                  <span>{isChanged ? (reg.value > reg.prevValue ? '▲ 상승' : '▼ 하강') : '— 유지'}</span>
                </div>
                <div className="h-6 flex items-end gap-1 bg-slate-900/50 p-1 rounded-lg">
                  {reg.history.map((val, hIdx) => {
                    const maxPossible = is16Bit ? 65535 : 255;
                    const heightPct = Math.max(10, Math.min(100, (val / maxPossible) * 100));
                    return (
                      <div
                        key={hIdx}
                        style={{ height: `${heightPct}%` }}
                        className={`flex-1 rounded-sm transition-all ${
                          hIdx === reg.history.length - 1 ? 'bg-cyan-400' : 'bg-slate-700'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Serial Telemetry Terminal & Custom Packet Injector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        {/* Terminal Logs (8 cols) */}
        <div className="lg:col-span-8 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-cyan-400" />
              수신 중인 시리얼 디버그 텔레메트리 스트림 (Incoming Telemetry)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {rawTerminalLogs.length} 라인 수신됨
            </span>
          </div>
          <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800 h-44 overflow-y-auto font-mono text-xs text-slate-300 space-y-1">
            {rawTerminalLogs.length === 0 ? (
              <div className="text-slate-600 text-center py-10">데이터 스트림 대기 중...</div>
            ) : (
              rawTerminalLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`leading-relaxed ${
                    idx === 0 ? 'text-cyan-300 font-bold' : 'text-slate-400 opacity-90'
                  }`}
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Custom Packet Injector (4 cols) */}
        <div className="lg:col-span-4 space-y-2.5 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-amber-400" />
            수동 레지스터 값 주입 (Packet Injector)
          </span>
          <p className="text-[11px] text-slate-400 leading-snug">
            원하는 레지스터 값을 직접 입력하여 상태 변화를 테스트하세요.
          </p>
          <input
            type="text"
            value={customStreamInput}
            onChange={(e) => setCustomStreamInput(e.target.value)}
            placeholder="PORTB=0xFF TCNT1=0x8000"
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
          />
          <button
            onClick={handleInjectStream}
            className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-md shadow-cyan-600/20 flex items-center justify-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>패킷 전송 및 레지스터 갱신</span>
          </button>
        </div>
      </div>

      {/* Modal: Add Register from Pool */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                감시할 SFR 레지스터 추가
              </h4>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                닫기
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {AVAILABLE_REGISTERS_POOL.map((item) => (
                <button
                  key={item.name}
                  onClick={() => handleAddRegister(item)}
                  className="w-full p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-left transition flex items-center justify-between group"
                >
                  <div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-xs font-bold text-white group-hover:text-cyan-400">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-slate-500">{item.addressHex}</span>
                      <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400">
                        {item.bitWidth}B
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                  </div>
                  <Plus className="w-4 h-4 text-slate-500 group-hover:text-cyan-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
