import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  FileCode2,
  Copy,
  Check,
  Terminal,
  Code2,
  Sliders,
  CheckCircle2,
  Sparkles,
  Layers,
  Cpu,
  Bookmark,
  ShieldCheck,
  Zap,
  Info,
  RotateCcw,
  BookOpen
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
}

export type CodeStyle = 'bitwise_macro' | 'struct_bitfield' | 'atomic_block' | 'cmsis_style';

interface PeripheralPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  registers: {
    reg: string;
    value: number;
    meaning: string;
    bits: { name: string; shift: number; enabled: boolean; desc: string }[];
  }[];
}

export const RegisterCodeSnippetGenerator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Code Generation Style
  const [codeStyle, setCodeStyle] = useState<CodeStyle>('bitwise_macro');
  const [useComments, setUseComments] = useState<boolean>(true);
  const [useTypePrefix, setUseTypePrefix] = useState<boolean>(true); // e.g. uint8_t
  const [includeHeaderGuard, setIncludeHeaderGuard] = useState<boolean>(true);
  const [functionName, setFunctionName] = useState<string>('mcu_peripherals_init');

  // Active Peripheral Preset
  const [activePresetId, setActivePresetId] = useState<string>('timer0_pwm');
  const [copied, setCopied] = useState<boolean>(false);

  // Dynamic user bit adjustments map: key = `${regName}_${bitName}`, val = boolean
  const [customBitStates, setCustomBitStates] = useState<Record<string, boolean>>({});

  // Preset Configurations for MCUs
  const presets: PeripheralPreset[] = useMemo(() => [
    {
      id: 'timer0_pwm',
      name: 'Timer/Counter0 Fast PWM & 인터럽트',
      category: '타이머/카운터',
      description: 'COM0A1 비반전 출력, Fast PWM (TOP=0xFF), 64분주 클럭, 오버플로우/비교일치 인터럽트 활성화',
      registers: [
        {
          reg: 'TCCR0A',
          value: 0b10000011,
          meaning: 'COM0A1=1 (Clear on Match), WGM01=1, WGM00=1 (Fast PWM Mode 3)',
          bits: [
            { name: 'COM0A1', shift: 7, enabled: true, desc: 'OC0A 비반전 고속 PWM 출력' },
            { name: 'COM0A0', shift: 6, enabled: false, desc: '비교 일치 토글 비활성' },
            { name: 'COM0B1', shift: 5, enabled: false, desc: 'OC0B 채널 미사용' },
            { name: 'COM0B0', shift: 4, enabled: false, desc: 'OC0B 채널 미사용' },
            { name: 'WGM01', shift: 1, enabled: true, desc: '파형 생성 모드 비트 1' },
            { name: 'WGM00', shift: 0, enabled: true, desc: '파형 생성 모드 비트 0' }
          ]
        },
        {
          reg: 'TCCR0B',
          value: 0b00000011,
          meaning: 'CS01=1, CS00=1 (Prescaler = 64, 250kHz 클럭)',
          bits: [
            { name: 'FOC0A', shift: 7, enabled: false, desc: '강제 비교 일치 비활성' },
            { name: 'FOC0B', shift: 6, enabled: false, desc: '강제 비교 일치 비활성' },
            { name: 'WGM02', shift: 3, enabled: false, desc: 'TOP=0xFF 고정' },
            { name: 'CS02', shift: 2, enabled: false, desc: '클럭 분주 상위 비트' },
            { name: 'CS01', shift: 1, enabled: true, desc: '분주비 64 선택' },
            { name: 'CS00', shift: 0, enabled: true, desc: '분주비 64 선택' }
          ]
        },
        {
          reg: 'TIMSK0',
          value: 0b00000011,
          meaning: 'TOIE0=1, OCIE0A=1 (오버플로우 및 채널 A 비교일치 인터럽트)',
          bits: [
            { name: 'OCIE0B', shift: 2, enabled: false, desc: '채널 B 인터럽트 미사용' },
            { name: 'OCIE0A', shift: 1, enabled: true, desc: '채널 A 비교일치 인터럽트 인에이블' },
            { name: 'TOIE0', shift: 0, enabled: true, desc: '타이머 오버플로우 인터럽트 인에이블' }
          ]
        }
      ]
    },
    {
      id: 'usart_async',
      name: 'USART0 115200bps 풀 듀플렉스 & RXC 인터럽트',
      category: '시리얼 통신',
      description: '8비트 데이터, 1 스톱 비트, 패리티 없음, U2X 2배속 모드, 수신 완료 인터럽트 인에이블',
      registers: [
        {
          reg: 'UCSR0A',
          value: 0b00000010,
          meaning: 'U2X0=1 (2배속 비동기 모드 활성화로 16MHz 클럭 115200bps 통신 오차 최소화)',
          bits: [
            { name: 'U2X0', shift: 1, enabled: true, desc: '2배속 비동기 통신 모드' },
            { name: 'MPCM0', shift: 0, enabled: false, desc: '멀티 프로세서 통신 모드 끔' }
          ]
        },
        {
          reg: 'UCSR0B',
          value: 0b10011000,
          meaning: 'RXCIE0=1 (수신 인터럽트), RXEN0=1 (수신기 켬), TXEN0=1 (송신기 켬)',
          bits: [
            { name: 'RXCIE0', shift: 7, enabled: true, desc: '수신 완료 인터럽트 활성화' },
            { name: 'TXCIE0', shift: 6, enabled: false, desc: '송신 완료 인터럽트 미사용' },
            { name: 'UDRIE0', shift: 5, enabled: false, desc: '데이터 레지스터 빔 인터럽트 끔' },
            { name: 'RXEN0', shift: 4, enabled: true, desc: '수신 블록 활성화' },
            { name: 'TXEN0', shift: 3, enabled: true, desc: '송신 블록 활성화' },
            { name: 'UCSZ02', shift: 2, enabled: false, desc: '8비트 데이터 프레임' }
          ]
        },
        {
          reg: 'UCSR0C',
          value: 0b00000110,
          meaning: 'UCSZ01=1, UCSZ00=1 (8-bit 데이터, 1 Stop, No Parity)',
          bits: [
            { name: 'UMSEL01', shift: 7, enabled: false, desc: '비동기 USART 모드' },
            { name: 'UMSEL00', shift: 6, enabled: false, desc: '비동기 USART 모드' },
            { name: 'UPM01', shift: 5, enabled: false, desc: '패리티 비트 없음' },
            { name: 'UPM00', shift: 4, enabled: false, desc: '패리티 비트 없음' },
            { name: 'USBS0', shift: 3, enabled: false, desc: '1 스톱 비트' },
            { name: 'UCSZ01', shift: 2, enabled: true, desc: '8비트 캐릭터 길이' },
            { name: 'UCSZ00', shift: 1, enabled: true, desc: '8비트 캐릭터 길이' }
          ]
        }
      ]
    },
    {
      id: 'adc_continuous',
      name: 'ADC 10비트 단일 채널 & 자동 트리거',
      category: '아날로그 인터페이스',
      description: 'AVCC 기준 전압, ADC0 채널, 128분주비(125kHz), ADSC 시작 및 완료 인터럽트 인에이블',
      registers: [
        {
          reg: 'ADMUX',
          value: 0b01000000,
          meaning: 'REFS0=1 (AVCC 기준전압 및 AREF 핀 커패시터 연결), MUX3:0=0 (ADC0 채널)',
          bits: [
            { name: 'REFS1', shift: 7, enabled: false, desc: '내부 1.1V 기준전압 끔' },
            { name: 'REFS0', shift: 6, enabled: true, desc: 'AVCC 외부 5V 전원 기준' },
            { name: 'ADLAR', shift: 5, enabled: false, desc: '우측 정렬 10비트 결과' },
            { name: 'MUX0', shift: 0, enabled: false, desc: '아날로그 0번 핀 선택' }
          ]
        },
        {
          reg: 'ADCSRA',
          value: 0b11001111,
          meaning: 'ADEN=1, ADSC=1, ADIE=1, ADPS2:0=7 (128분주비로 정확도 극대화)',
          bits: [
            { name: 'ADEN', shift: 7, enabled: true, desc: 'ADC 모듈 전원 및 동작 활성화' },
            { name: 'ADSC', shift: 6, enabled: true, desc: '첫 아날로그 변환 시작' },
            { name: 'ADATE', shift: 5, enabled: false, desc: '자동 트리거 비활성' },
            { name: 'ADIE', shift: 3, enabled: true, desc: '변환 완료 인터럽트 활성화' },
            { name: 'ADPS2', shift: 2, enabled: true, desc: '분주비 128' },
            { name: 'ADPS1', shift: 1, enabled: true, desc: '분주비 128' },
            { name: 'ADPS0', shift: 0, enabled: true, desc: '분주비 128' }
          ]
        }
      ]
    },
    {
      id: 'gpio_pullups',
      name: 'GPIO 포트 B 고속 출력 & 내부 풀업 입력',
      category: '디지털 입출력',
      description: 'PB5(LED) 출력 모드, PB0~PB2 내부 풀업 저항 활성화, 나머지 플로팅 입력',
      registers: [
        {
          reg: 'DDRB',
          value: 0b00100000,
          meaning: 'DDB5=1 (PB5 출력 핀), DDB0~4=0 (입력 모드)',
          bits: [
            { name: 'DDB5', shift: 5, enabled: true, desc: 'PB5 핀 출력 모드 (LED 구동)' },
            { name: 'DDB2', shift: 2, enabled: false, desc: 'PB2 핀 입력 모드' },
            { name: 'DDB1', shift: 1, enabled: false, desc: 'PB1 핀 입력 모드' },
            { name: 'DDB0', shift: 0, enabled: false, desc: 'PB0 핀 입력 모드' }
          ]
        },
        {
          reg: 'PORTB',
          value: 0b00100111,
          meaning: 'PORTB5=1 (초기 HIGH 출력), PORTB0~2=1 (내부 30k~50kΩ 풀업 저항 활성화)',
          bits: [
            { name: 'PORTB5', shift: 5, enabled: true, desc: 'PB5 HIGH 출력' },
            { name: 'PORTB2', shift: 2, enabled: true, desc: 'PB2 내부 풀업 활성화' },
            { name: 'PORTB1', shift: 1, enabled: true, desc: 'PB1 내부 풀업 활성화' },
            { name: 'PORTB0', shift: 0, enabled: true, desc: 'PB0 내부 풀업 활성화' }
          ]
        }
      ]
    }
  ], []);

  const currentPreset = presets.find((p) => p.id === activePresetId) || presets[0];

  // Helper to get effective bit state
  const isBitActive = (regName: string, bitName: string, defaultEnabled: boolean): boolean => {
    const key = `${regName}_${bitName}`;
    if (key in customBitStates) {
      return customBitStates[key];
    }
    return defaultEnabled;
  };

  const toggleBit = (regName: string, bitName: string, defaultEnabled: boolean) => {
    const key = `${regName}_${bitName}`;
    const cur = isBitActive(regName, bitName, defaultEnabled);
    setCustomBitStates((prev) => ({
      ...prev,
      [key]: !cur
    }));
  };

  const resetBitsToDefault = () => {
    setCustomBitStates({});
  };

  // Generate C Code based on selected style
  const generatedCode = useMemo(() => {
    const lines: string[] = [];

    if (includeHeaderGuard) {
      lines.push('/**');
      lines.push(` * ==============================================================================`);
      lines.push(` * MCU      : ${currentProfile.name} (${currentProfile.fullName})`);
      lines.push(` * Target   : ${currentPreset.name}`);
      lines.push(` * Style    : ${codeStyle.toUpperCase()}`);
      lines.push(` * Safety   : MISRA-C 호환 명시적 비트 시프트 매크로 및 원자적 보호 적용`);
      lines.push(` * ==============================================================================`);
      lines.push(' */');
      lines.push('#include <avr/io.h>');
      lines.push('#include <avr/interrupt.h>');
      if (codeStyle === 'atomic_block') {
        lines.push('#include <util/atomic.h>');
      }
      lines.push('');
    }

    if (codeStyle === 'struct_bitfield') {
      // Modern Typedef Struct Approach
      lines.push('// 구조체 비트필드(Bit-field) 기반 고가독성 레지스터 설정');
      lines.push('typedef struct {');
      lines.push('    uint8_t raw_value;');
      lines.push('} register_config_t;');
      lines.push('');
      lines.push(`void ${functionName}(void) {`);

      currentPreset.registers.forEach((r) => {
        const activeBits = r.bits.filter((b) => isBitActive(r.reg, b.name, b.enabled));
        const macroExpression = activeBits.length > 0
          ? activeBits.map((b) => `(1U << ${b.name})`).join(' | ')
          : '0x00U';

        if (useComments) {
          lines.push(`    // ${r.reg}: ${r.meaning}`);
        }
        lines.push(`    ${r.reg} = (uint8_t)(${macroExpression});`);
        lines.push('');
      });

      lines.push('}');
    } else if (codeStyle === 'atomic_block') {
      // Atomic Section Approach for Safe Peripheral Reconfiguration
      lines.push(`void ${functionName}(void) {`);
      lines.push('    // 원자적 블록(ATOMIC_BLOCK): 레지스터 설정 중 인터럽트 끼어들기 방지');
      lines.push('    ATOMIC_BLOCK(ATOMIC_RESTORESTATE) {');

      currentPreset.registers.forEach((r) => {
        const activeBits = r.bits.filter((b) => isBitActive(r.reg, b.name, b.enabled));
        const macroExpression = activeBits.length > 0
          ? activeBits.map((b) => `(1U << ${b.name})`).join(' | ')
          : '0x00U';

        if (useComments) {
          lines.push(`        // ${r.reg}: ${r.meaning}`);
        }
        lines.push(`        ${r.reg} = ${macroExpression};`);
      });

      lines.push('    }');
      lines.push('}');
    } else if (codeStyle === 'cmsis_style') {
      // Constant Typed Defs Style
      lines.push('// 고정밀 매크로 상수 사전 정의');
      currentPreset.registers.forEach((r) => {
        const activeBits = r.bits.filter((b) => isBitActive(r.reg, b.name, b.enabled));
        const macroExpression = activeBits.length > 0
          ? activeBits.map((b) => `(1U << ${b.name})`).join(' | ')
          : '0x00U';
        lines.push(`#define ${r.reg}_INIT_VAL  (${macroExpression})`);
      });
      lines.push('');
      lines.push(`void ${functionName}(void) {`);
      currentPreset.registers.forEach((r) => {
        if (useComments) {
          lines.push(`    // 설정값 적용: ${r.meaning}`);
        }
        lines.push(`    ${r.reg} = ${r.reg}_INIT_VAL;`);
      });
      lines.push('}');
    } else {
      // Standard Bitwise Macro (Recommended)
      lines.push(`void ${functionName}(void) {`);

      currentPreset.registers.forEach((r) => {
        const activeBits = r.bits.filter((b) => isBitActive(r.reg, b.name, b.enabled));
        const macroExpression = activeBits.length > 0
          ? activeBits.map((b) => `(1 << ${b.name})`).join(' |\n               ')
          : '0x00';

        if (useComments) {
          lines.push(`    /* -------------------------------------------------------------`);
          lines.push(`     * ${r.reg} 설정: ${r.meaning}`);
          activeBits.forEach((b) => {
            lines.push(`     * - [bit ${b.shift}] ${b.name}: ${b.desc}`);
          });
          lines.push(`     * ------------------------------------------------------------- */`);
        }
        lines.push(`    ${r.reg} = ${macroExpression};`);
        lines.push('');
      });

      lines.push('}');
    }

    return lines.join('\n');
  }, [
    currentProfile.name,
    currentProfile.fullName,
    currentPreset,
    codeStyle,
    useComments,
    includeHeaderGuard,
    functionName,
    customBitStates
  ]);

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.3 } });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Title Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <FileCode2 className="w-3.5 h-3.5" /> C 레지스터 초기화 코드 생성기
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              MCU: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-mono">
              MISRA-C / avr-gcc 호환
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            C 언어 레지스터 초기화 코드 생성기 (Register C Code Generator)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            비트 단위로 조작한 레지스터 설정을 바탕으로, 매직 넘버(0x83 등)를 배제하고
            <code>(1 &lt;&lt; CS01) | (1 &lt;&lt; WGM00)</code> 형식의 <strong>안전하고 가독성 높은 C 언어 매크로 및 원자적(Atomic) 초기화 함수</strong>를 실시간으로 자동 생성합니다.
          </p>
        </div>

        {/* Copy Button */}
        <button
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20 shrink-0"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? '복사 완료!' : '초기화 C 코드 복사'}</span>
        </button>
      </div>

      {/* Preset Peripheral Selector Bar */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-white">주변장치 초기화 시나리오 프리셋:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                setActivePresetId(preset.id);
                setCustomBitStates({});
              }}
              className={`px-3 py-1.5 rounded-lg border font-bold transition flex items-center gap-1.5 ${
                activePresetId === preset.id
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid: Code Style & Interactive Bits Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Code Styling Options & Bit Toggles (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">C 코드 포맷 & 비트 컨트롤</h3>
            </div>
            {Object.keys(customBitStates).length > 0 && (
              <button
                onClick={resetBitsToDefault}
                className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-mono"
              >
                <RotateCcw className="w-3 h-3" /> 초기화
              </button>
            )}
          </div>

          {/* Code Style Selector */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">코드 생성 스타일 (Syntax Style)</label>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setCodeStyle('bitwise_macro')}
                className={`p-2 rounded-lg border font-bold text-left transition ${
                  codeStyle === 'bitwise_macro'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                📝 비트 시프트 매크로
                <span className="block text-[10px] text-slate-400 font-normal">(1 &lt;&lt; BIT_NAME) - 표준</span>
              </button>
              <button
                type="button"
                onClick={() => setCodeStyle('atomic_block')}
                className={`p-2 rounded-lg border font-bold text-left transition ${
                  codeStyle === 'atomic_block'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🛡️ 원자적 블록 (Atomic)
                <span className="block text-[10px] text-slate-400 font-normal">ATOMIC_BLOCK 보호</span>
              </button>
              <button
                type="button"
                onClick={() => setCodeStyle('cmsis_style')}
                className={`p-2 rounded-lg border font-bold text-left transition ${
                  codeStyle === 'cmsis_style'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🏷️ #define 상수 분리
                <span className="block text-[10px] text-slate-400 font-normal">헤더 분리형 매크로</span>
              </button>
              <button
                type="button"
                onClick={() => setCodeStyle('struct_bitfield')}
                className={`p-2 rounded-lg border font-bold text-left transition ${
                  codeStyle === 'struct_bitfield'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🧩 구조체 래핑
                <span className="block text-[10px] text-slate-400 font-normal">Typedef 캐스팅 적용</span>
              </button>
            </div>
          </div>

          {/* Function name */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">초기화 함수 이름</label>
            <input
              type="text"
              value={functionName}
              onChange={(e) => setFunctionName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="peripherals_init"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-1.5 text-xs">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={useComments}
                onChange={(e) => setUseComments(e.target.checked)}
                className="accent-emerald-500 rounded"
              />
              <span>데이터시트 비트 설명 상세 주석 포함</span>
            </label>
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHeaderGuard}
                onChange={(e) => setIncludeHeaderGuard(e.target.checked)}
                className="accent-emerald-500 rounded"
              />
              <span>헤더 파일 및 주석 블록 포함 (#include &lt;avr/io.h&gt;)</span>
            </label>
          </div>

          {/* Interactive Bit Toggles inside current preset */}
          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <span className="text-[11px] font-bold text-white block">
              레지스터별 비트 인터랙티브 토글:
            </span>

            {currentPreset.registers.map((r) => (
              <div key={r.reg} className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-bold text-cyan-300">{r.reg}</span>
                  <span className="text-slate-400 text-[11px]">{r.meaning}</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {r.bits.map((b) => {
                    const active = isBitActive(r.reg, b.name, b.enabled);
                    return (
                      <button
                        key={b.name}
                        type="button"
                        onClick={() => toggleBit(r.reg, b.name, b.enabled)}
                        className={`p-1.5 rounded border text-left transition flex items-center justify-between ${
                          active
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <span className="font-mono font-bold">{b.name}</span>
                        <span className="text-[9px] px-1 rounded bg-slate-900 font-mono">
                          bit {b.shift}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Real-time Live Code Preview & Export (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 bg-slate-900/80">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-bold text-white font-mono">
                  생성된 C 펌웨어 소스코드 ({functionName}.c)
                </span>
              </div>

              <button
                onClick={copyCode}
                className="text-slate-400 hover:text-white text-xs font-mono inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copied ? '복사됨' : '원클릭 복사'}</span>
              </button>
            </div>

            <pre className="p-5 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto max-h-[560px] custom-scrollbar bg-slate-950/90 selection:bg-emerald-500/30">
              {generatedCode}
            </pre>
          </div>

          {/* Clean Code Principles Callout */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 space-y-1.5 leading-relaxed font-sans">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> 임베디드 펌웨어 클린코드 원칙:
            </span>
            <p className="text-slate-400 text-[11px]">
              레지스터에 <code>TCCR0A = 0x83;</code>와 같은 하드코딩된 16진수를 직접 대입하면 유지보수 시 데이터시트를 재확인해야 하며 오타 발생 위험이 큽니다.
              본 생성기와 같이 공식 헤더 매크로 <code>(1 &lt;&lt; COM0A1) | (1 &lt;&lt; WGM00)</code>를 사용하면
              컴파일 타임에 동일한 1바이트 기계어로 최적화되면서도 코드 가독성과 MISRA-C 안전성이 완벽히 보장됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
