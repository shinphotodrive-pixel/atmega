import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Split,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  Terminal,
  Cpu,
  Layers
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export interface RegisterDefinition {
  name: string;
  description: string;
  bits: { index: number; name: string; desc: string }[];
}

const REGISTERS_DB: Record<string, RegisterDefinition> = {
  TCCR0A: {
    name: 'TCCR0A',
    description: 'Timer/Counter0 Control Register A (파형 생성 모드 WGM 및 OC0A/B 비교 출력 모드)',
    bits: [
      { index: 7, name: 'COM0A1', desc: '비교 출력 모드 A 비트 1' },
      { index: 6, name: 'COM0A0', desc: '비교 출력 모드 A 비트 0' },
      { index: 5, name: 'COM0B1', desc: '비교 출력 모드 B 비트 1' },
      { index: 4, name: 'COM0B0', desc: '비교 출력 모드 B 비트 0' },
      { index: 3, name: 'Reserved', desc: '예약 비트' },
      { index: 2, name: 'Reserved', desc: '예약 비트' },
      { index: 1, name: 'WGM01', desc: '파형 생성 모드 비트 1' },
      { index: 0, name: 'WGM00', desc: '파형 생성 모드 비트 0' }
    ]
  },
  TCCR0B: {
    name: 'TCCR0B',
    description: 'Timer/Counter0 Control Register B (클럭 분주비 선택 CS02:00 및 WGM02)',
    bits: [
      { index: 7, name: 'FOC0A', desc: '강제 비교 일치 A' },
      { index: 6, name: 'FOC0B', desc: '강제 비교 일치 B' },
      { index: 5, name: 'Reserved', desc: '예약 비트' },
      { index: 4, name: 'Reserved', desc: '예약 비트' },
      { index: 3, name: 'WGM02', desc: '파형 생성 모드 비트 2' },
      { index: 2, name: 'CS02', desc: '클럭 분주비 선택 비트 2' },
      { index: 1, name: 'CS01', desc: '클럭 분주비 선택 비트 1' },
      { index: 0, name: 'CS00', desc: '클럭 분주비 선택 비트 0' }
    ]
  },
  TIMSK0: {
    name: 'TIMSK0',
    description: 'Timer/Counter0 Interrupt Mask Register (오버플로우 및 비교 일치 인터럽트 허용)',
    bits: [
      { index: 7, name: 'Reserved', desc: '예약 비트' },
      { index: 6, name: 'Reserved', desc: '예약 비트' },
      { index: 5, name: 'Reserved', desc: '예약 비트' },
      { index: 4, name: 'Reserved', desc: '예약 비트' },
      { index: 3, name: 'Reserved', desc: '예약 비트' },
      { index: 2, name: 'OCIE0B', desc: 'Timer0 비교 일치 B 인터럽트 허용' },
      { index: 1, name: 'OCIE0A', desc: 'Timer0 비교 일치 A 인터럽트 허용' },
      { index: 0, name: 'TOIE0', desc: 'Timer0 오버플로우 인터럽트 허용' }
    ]
  },
  ADCSRA: {
    name: 'ADCSRA',
    description: 'ADC Control and Status Register A (변환 시작, 완료 플래그 및 프리스케일러)',
    bits: [
      { index: 7, name: 'ADEN', desc: 'ADC 전원 인에이블' },
      { index: 6, name: 'ADSC', desc: '변환 시작 (Start Conversion)' },
      { index: 5, name: 'ADATE', desc: '자동 트리거 허용' },
      { index: 4, name: 'ADIF', desc: 'ADC 인터럽트 플래그' },
      { index: 3, name: 'ADIE', desc: 'ADC 인터럽트 허용' },
      { index: 2, name: 'ADPS2', desc: '프리스케일러 분주비 비트 2' },
      { index: 1, name: 'ADPS1', desc: '프리스케일러 분주비 비트 1' },
      { index: 0, name: 'ADPS0', desc: '프리스케일러 분주비 비트 0' }
    ]
  },
  UCSR0B: {
    name: 'UCSR0B',
    description: 'USART Control and Status Register B (RX/TX 송수신 인에이블 및 인터럽트)',
    bits: [
      { index: 7, name: 'RXCIE0', desc: 'RX 수신 완료 인터럽트 허용' },
      { index: 6, name: 'TXCIE0', desc: 'TX 송신 완료 인터럽트 허용' },
      { index: 5, name: 'UDRIE0', desc: '데이터 레지스터 빈 상태 인터럽트 허용' },
      { index: 4, name: 'RXEN0', desc: '수신부(Receiver) 활성화' },
      { index: 3, name: 'TXEN0', desc: '송신부(Transmitter) 활성화' },
      { index: 2, name: 'UCSZ02', desc: '문자 크기 비트 2 (9-bit 모드)' },
      { index: 1, name: 'RXB80', desc: '수신된 9번째 데이터 비트' },
      { index: 0, name: 'TXB80', desc: '송신할 9번째 데이터 비트' }
    ]
  },
  PORTB: {
    name: 'PORTB',
    description: 'Port B Data Register (출력 전압 레벨 또는 입력 모드 시 내부 풀업 제어)',
    bits: [
      { index: 7, name: 'PORTB7', desc: 'PB7 출력 HIGH 또는 내부 풀업' },
      { index: 6, name: 'PORTB6', desc: 'PB6 출력 HIGH 또는 내부 풀업' },
      { index: 5, name: 'PORTB5', desc: 'PB5 (Arduino D13 LED) HIGH/LOW' },
      { index: 4, name: 'PORTB4', desc: 'PB4 출력 HIGH 또는 내부 풀업' },
      { index: 3, name: 'PORTB3', desc: 'PB3 출력 HIGH 또는 내부 풀업' },
      { index: 2, name: 'PORTB2', desc: 'PB2 출력 HIGH 또는 내부 풀업' },
      { index: 1, name: 'PORTB1', desc: 'PB1 출력 HIGH 또는 내부 풀업' },
      { index: 0, name: 'PORTB0', desc: 'PB0 출력 HIGH 또는 내부 풀업' }
    ]
  }
};

interface ComparePreset {
  id: string;
  name: string;
  regName: string;
  valA: number;
  valB: number;
  labelA: string;
  labelB: string;
  description: string;
}

const COMPARE_PRESETS: ComparePreset[] = [
  {
    id: 'timer0_mode',
    name: '타이머0: 일반 카운터(Normal) vs Fast PWM 모드',
    regName: 'TCCR0A',
    valA: 0b00000000, // 0x00: Normal mode, OC0A disconnected
    valB: 0b10000011, // 0x83: Fast PWM, COM0A1=1 (Non-inverting), WGM01:00=3
    labelA: '설정 A: 초기 리셋값 (일반 타이머)',
    labelB: '설정 B: 고속 PWM 출력 모드',
    description: 'WGM00/WGM01 비트가 세트되어 고속 단방향 PWM 모드로 변경되고, COM0A1 비트로 인해 OC0A 핀에 물리적 펄스가 출력됩니다.'
  },
  {
    id: 'usart_rx_int',
    name: 'USART0: 기본 폴링 송수신 vs 링버퍼 수신 인터럽트',
    regName: 'UCSR0B',
    valA: 0b00011000, // 0x18: RXEN=1, TXEN=1
    valB: 0b10011000, // 0x98: RXCIE=1, RXEN=1, TXEN=1
    labelA: '설정 A: 폴링 모드 (인터럽트 없음)',
    labelB: '설정 B: 비동기 RX 수신 인터럽트 구동',
    description: 'RXCIE0 비트가 활성화되어 수신 버퍼에 1바이트가 도착할 때마다 ISR(USART_RX_vect) 인터럽트가 자동 트리거됩니다.'
  },
  {
    id: 'adc_auto_trigger',
    name: 'ADC: 단일 변환(Single) vs 자유 가동 인터럽트(Auto-trigger)',
    regName: 'ADCSRA',
    valA: 0b10000111, // 0x87: ADEN=1, /128 prescaler
    valB: 0b11101111, // 0xEF: ADEN=1, ADSC=1, ADATE=1, ADIE=1, /128 prescaler
    labelA: '설정 A: 단일 수동 변환',
    labelB: '설정 B: 연속 자동 변환 및 인터럽트',
    description: 'ADATE(자동 트리거) 및 ADIE(인터럽트 허용) 비트가 1로 변경되어 주기적으로 아날로그 샘플링을 수행합니다.'
  },
  {
    id: 'portb_led_pullup',
    name: 'PORTB: 전체 LOW(출력 0V) vs LED 점등 & 풀업 활성화',
    regName: 'PORTB',
    valA: 0b00000000, // 0x00
    valB: 0b00100111, // 0x27: PB5 High (LED On), PB0-PB2 Pull-up High
    labelA: '설정 A: 초기값 (0x00)',
    labelB: '설정 B: PB5 LED 켬 & PB0~2 풀업',
    description: 'PB5가 1이 되어 온보드 LED가 점등되고, PB0~PB2는 내부 40kΩ 풀업 저항이 연결되어 버튼 입력이 안정화됩니다.'
  }
];

export const RegisterConfigComparator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  const [selectedPresetId, setSelectedPresetId] = useState<string>('timer0_mode');
  const [selectedReg, setSelectedReg] = useState<string>('TCCR0A');
  const [valA, setValA] = useState<number>(0b00000000);
  const [valB, setValB] = useState<number>(0b10000011);
  const [labelA, setLabelA] = useState<string>('설정 A (이전 버전)');
  const [labelB, setLabelB] = useState<string>('설정 B (현재 버전)');
  const [copiedDiff, setCopiedDiff] = useState<boolean>(false);

  const regDef = useMemo(() => {
    return REGISTERS_DB[selectedReg] || REGISTERS_DB.TCCR0A;
  }, [selectedReg]);

  // Load Preset
  const handleApplyPreset = (p: ComparePreset) => {
    setSelectedPresetId(p.id);
    setSelectedReg(p.regName);
    setValA(p.valA);
    setValB(p.valB);
    setLabelA(p.labelA);
    setLabelB(p.labelB);
  };

  const toggleBitA = (bitIndex: number) => {
    setValA((prev) => prev ^ (1 << bitIndex));
  };

  const toggleBitB = (bitIndex: number) => {
    setValB((prev) => prev ^ (1 << bitIndex));
  };

  // Compute Bit Differences
  const bitDifferences = useMemo(() => {
    const diffMask = valA ^ valB;
    const diffList: {
      index: number;
      bitName: string;
      desc: string;
      bitA: number;
      bitB: number;
      changeType: 'turned_on' | 'turned_off' | 'unchanged';
      explanation: string;
    }[] = [];

    for (let i = 7; i >= 0; i--) {
      const bitA = (valA & (1 << i)) !== 0 ? 1 : 0;
      const bitB = (valB & (1 << i)) !== 0 ? 1 : 0;
      const isDiff = (diffMask & (1 << i)) !== 0;

      let changeType: 'turned_on' | 'turned_off' | 'unchanged' = 'unchanged';
      if (isDiff) {
        changeType = bitB === 1 ? 'turned_on' : 'turned_off';
      }

      const bitInfo = regDef.bits.find((b) => b.index === i) || {
        index: i,
        name: `Bit ${i}`,
        desc: '일반 비트'
      };

      let explanation = '설정 상태 동일 (변화 없음)';
      if (changeType === 'turned_on') {
        explanation = `0 → 1 로 활성화됨 (${bitInfo.name}: ${bitInfo.desc})`;
      } else if (changeType === 'turned_off') {
        explanation = `1 → 0 으로 비활성화/클리어됨 (${bitInfo.name})`;
      }

      diffList.push({
        index: i,
        bitName: bitInfo.name,
        desc: bitInfo.desc,
        bitA,
        bitB,
        changeType,
        explanation
      });
    }

    const changedCount = diffList.filter((d) => d.changeType !== 'unchanged').length;

    return { diffList, changedCount, diffMask };
  }, [valA, valB, regDef]);

  // C Code Diff Generator
  const generatedCodeDiff = useMemo(() => {
    return `// ==============================================================================
// ${selectedReg} 레지스터 설정 차이점 비교 (Diff)
// 타깃 MCU: ${currentProfile.name}
// ==============================================================================

// [설정 A: ${labelA}]
${selectedReg} = 0x${valA.toString(16).padStart(2, '0').toUpperCase()}; // 0b${valA.toString(2).padStart(8, '0')}

// [설정 B: ${labelB}]
${selectedReg} = 0x${valB.toString(16).padStart(2, '0').toUpperCase()}; // 0b${valB.toString(2).padStart(8, '0')}

/* 차이 나는 비트 마스크: 0x${bitDifferences.diffMask.toString(16).padStart(2, '0').toUpperCase()} (총 ${bitDifferences.changedCount}개 비트 변경) */
${bitDifferences.diffList
  .filter((d) => d.changeType !== 'unchanged')
  .map(
    (d) =>
      `// • Bit ${d.index} [${d.bitName}]: ${d.bitA} -> ${d.bitB} (${d.changeType === 'turned_on' ? 'SET' : 'CLEARED'}) : ${d.desc}`
  )
  .join('\n')}
`;
  }, [selectedReg, currentProfile, labelA, labelB, valA, valB, bitDifferences]);

  const handleCopyDiff = () => {
    navigator.clipboard.writeText(generatedCodeDiff);
    setCopiedDiff(true);
    confetti({
      particleCount: 20,
      spread: 45,
      origin: { y: 0.8 }
    });
    setTimeout(() => setCopiedDiff(false), 2000);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 lg:p-8 backdrop-blur shadow-2xl space-y-8 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-indigo-600 rounded-2xl shadow-lg shadow-amber-500/20 text-slate-950 font-black">
              <Split className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl lg:text-2xl font-black text-white tracking-tight">
                  레지스터 설정 비교기
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Register Differential Comparator
                </span>
              </div>
              <p className="text-xs lg:text-sm text-slate-400 mt-1">
                두 개의 서로 다른 레지스터 설정값(이전 버전 vs 현재 설정값 또는 리셋 기본값 vs 최적화값)을 비교하여 차이가 나는 비트 필드만을 정밀하게 하이라이트합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Register Selector Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-bold">비교할 레지스터:</span>
          <select
            value={selectedReg}
            onChange={(e) => setSelectedReg(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-amber-300 font-mono font-bold focus:border-amber-400 focus:outline-none"
          >
            {Object.keys(REGISTERS_DB).map((reg) => (
              <option key={reg} value={reg}>
                {reg} ({REGISTERS_DB[reg].description.split('(')[0]})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Presets Bar */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            빠른 레지스터 설정 비교 시나리오:
          </span>
          <span className="text-[11px] text-slate-500">클릭 시 자동 설정 비교</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {COMPARE_PRESETS.map((p) => {
            const isSelected = p.id === selectedPresetId;
            return (
              <button
                key={p.id}
                onClick={() => handleApplyPreset(p)}
                className={`text-left p-3 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-amber-950/40 border-amber-500 text-white shadow-md ring-1 ring-amber-500/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs text-slate-200 mb-1 truncate">{p.name}</div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {p.regName}: 0x{p.valA.toString(16).padStart(2, '0').toUpperCase()} → 0x{p.valB.toString(16).padStart(2, '0').toUpperCase()}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Side-by-Side Bit Controls: Config A vs Config B */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Config A Box */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <input
              type="text"
              value={labelA}
              onChange={(e) => setLabelA(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-200 focus:outline-none focus:border-b border-amber-400"
            />
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-900/50">
              0x{valA.toString(16).padStart(2, '0').toUpperCase()} (0b{valA.toString(2).padStart(8, '0')})
            </span>
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1.5 font-mono">
              <span>비트 클릭하여 토글 (MSB Bit 7 ~ LSB Bit 0):</span>
              <span className="text-slate-500">{selectedReg} A</span>
            </div>
            <div className="grid grid-cols-8 gap-1.5 font-mono text-center">
              {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => {
                const isSet = (valA & (1 << bit)) !== 0;
                const isDiff = ((valA ^ valB) & (1 << bit)) !== 0;
                const bitInfo = regDef.bits.find((b) => b.index === bit);

                return (
                  <button
                    key={bit}
                    onClick={() => toggleBitA(bit)}
                    className={`py-2 rounded-xl border flex flex-col items-center transition-all ${
                      isSet
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                    } ${isDiff ? 'ring-2 ring-rose-500/60' : ''}`}
                    title={bitInfo?.name}
                  >
                    <span className="text-[9px] text-slate-400 font-sans truncate w-full px-0.5">
                      {bitInfo?.name || `B${bit}`}
                    </span>
                    <span className="text-xs mt-0.5">{isSet ? '1' : '0'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Config B Box */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <input
              type="text"
              value={labelB}
              onChange={(e) => setLabelB(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-200 focus:outline-none focus:border-b border-emerald-400"
            />
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-900/50">
              0x{valB.toString(16).padStart(2, '0').toUpperCase()} (0b{valB.toString(2).padStart(8, '0')})
            </span>
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1.5 font-mono">
              <span>비트 클릭하여 토글 (MSB Bit 7 ~ LSB Bit 0):</span>
              <span className="text-slate-500">{selectedReg} B</span>
            </div>
            <div className="grid grid-cols-8 gap-1.5 font-mono text-center">
              {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => {
                const isSet = (valB & (1 << bit)) !== 0;
                const isDiff = ((valA ^ valB) & (1 << bit)) !== 0;
                const bitInfo = regDef.bits.find((b) => b.index === bit);

                return (
                  <button
                    key={bit}
                    onClick={() => toggleBitB(bit)}
                    className={`py-2 rounded-xl border flex flex-col items-center transition-all ${
                      isSet
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                    } ${isDiff ? 'ring-2 ring-rose-500/60' : ''}`}
                    title={bitInfo?.name}
                  >
                    <span className="text-[9px] text-slate-400 font-sans truncate w-full px-0.5">
                      {bitInfo?.name || `B${bit}`}
                    </span>
                    <span className="text-xs mt-0.5">{isSet ? '1' : '0'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Differential Breakdown Table (Only Difference Highlighted) */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              차이가 나는 비트 필드 정밀 하이라이트 (총 {bitDifferences.changedCount}개 비트 변경됨)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyDiff}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700"
            >
              {copiedDiff ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedDiff ? '복사됨!' : 'C 코드 Diff 복사'}</span>
            </button>
          </div>
        </div>

        {/* List of bits with differences emphasized */}
        <div className="space-y-2">
          {bitDifferences.diffList.map((item) => {
            const isDiff = item.changeType !== 'unchanged';

            return (
              <div
                key={item.index}
                className={`p-3 rounded-xl border text-xs font-mono transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                  item.changeType === 'turned_on'
                    ? 'bg-emerald-950/30 border-emerald-500/70 text-emerald-200 ring-1 ring-emerald-500/30'
                    : item.changeType === 'turned_off'
                    ? 'bg-rose-950/30 border-rose-500/70 text-rose-200 ring-1 ring-rose-500/30'
                    : 'bg-slate-900/40 border-slate-800/60 text-slate-500 opacity-60'
                }`}
              >
                {/* Left: Bit position & Name */}
                <div className="flex items-center gap-2.5">
                  <span className="w-6 font-bold text-slate-400">B{item.index}</span>
                  <span className="px-2 py-0.5 rounded font-bold bg-slate-800 border border-slate-700 text-white">
                    {item.bitName}
                  </span>
                  <span className="text-[11px] font-sans text-slate-300">
                    {item.desc}
                  </span>
                </div>

                {/* Right: Change Type Badge & Values */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-400 font-bold">{item.bitA}</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className="text-emerald-400 font-bold">{item.bitB}</span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      item.changeType === 'turned_on'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-extrabold'
                        : item.changeType === 'turned_off'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-extrabold'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}
                  >
                    {item.changeType === 'turned_on'
                      ? '▲ SET (0 → 1)'
                      : item.changeType === 'turned_off'
                      ? '▼ CLEARED (1 → 0)'
                      : '동일'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
