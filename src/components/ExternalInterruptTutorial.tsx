import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Zap,
  Activity,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  ArrowRight,
  Copy,
  Check,
  Terminal,
  ShieldAlert,
  ShieldCheck,
  BookOpen,
  Info,
  Clock,
  HelpCircle,
  Sparkles,
  TrendingUp,
  FileCode2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type InterruptTriggerMode = 'low_level' | 'any_edge' | 'falling_edge' | 'rising_edge';

interface InterruptChannelInfo {
  channel: string; // e.g. INT0, INT1, INT2
  vectorName: string; // e.g. INT0_vect
  pinName: string; // e.g. PD2, PD3, etc.
  iscBit1: string; // e.g. ISC01
  iscBit0: string; // e.g. ISC00
  maskBit: string; // e.g. INT0
  flagBit: string; // e.g. INTF0
  priorityRank: number; // 2nd after RESET (vector address)
  regCtrl: string; // EICRA or EICRB
  regMask: string; // EIMSK
  regFlag: string; // EIFR
}

export const ExternalInterruptTutorial: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Selected Channels & Modes
  const [selectedChannelId, setSelectedChannelId] = useState<string>('INT0');
  const [triggerMode, setTriggerMode] = useState<InterruptTriggerMode>('falling_edge');
  const [pullupState, setPullupState] = useState<'pullup' | 'pulldown' | 'none'>('pullup');
  const [useVolatileFlag, setUseVolatileFlag] = useState<boolean>(true);
  const [includeDebounceGuide, setIncludeDebounceGuide] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // MCU Interrupt Channels Spec
  const interruptChannels: InterruptChannelInfo[] = useMemo(() => {
    switch (selectedMCU) {
      case 'atmega328p':
        return [
          {
            channel: 'INT0',
            vectorName: 'INT0_vect',
            pinName: 'PD2 (Arduino D2)',
            iscBit1: 'ISC01',
            iscBit0: 'ISC00',
            maskBit: 'INT0',
            flagBit: 'INTF0',
            priorityRank: 2, // Address 0x0002
            regCtrl: 'EICRA',
            regMask: 'EIMSK',
            regFlag: 'EIFR'
          },
          {
            channel: 'INT1',
            vectorName: 'INT1_vect',
            pinName: 'PD3 (Arduino D3)',
            iscBit1: 'ISC11',
            iscBit0: 'ISC10',
            maskBit: 'INT1',
            flagBit: 'INTF1',
            priorityRank: 3, // Address 0x0004
            regCtrl: 'EICRA',
            regMask: 'EIMSK',
            regFlag: 'EIFR'
          }
        ];
      case 'atmega128':
        return [
          {
            channel: 'INT0',
            vectorName: 'INT0_vect',
            pinName: 'PD0 (SCL / INT0)',
            iscBit1: 'ISC01',
            iscBit0: 'ISC00',
            maskBit: 'INT0',
            flagBit: 'INTF0',
            priorityRank: 2,
            regCtrl: 'EICRA',
            regMask: 'EIMSK',
            regFlag: 'EIFR'
          },
          {
            channel: 'INT1',
            vectorName: 'INT1_vect',
            pinName: 'PD1 (SDA / INT1)',
            iscBit1: 'ISC11',
            iscBit0: 'ISC10',
            maskBit: 'INT1',
            flagBit: 'INTF1',
            priorityRank: 3,
            regCtrl: 'EICRA',
            regMask: 'EIMSK',
            regFlag: 'EIFR'
          },
          {
            channel: 'INT2',
            vectorName: 'INT2_vect',
            pinName: 'PD2 (RXD1 / INT2)',
            iscBit1: 'ISC21',
            iscBit0: 'ISC20',
            maskBit: 'INT2',
            flagBit: 'INTF2',
            priorityRank: 4,
            regCtrl: 'EICRA',
            regMask: 'EIMSK',
            regFlag: 'EIFR'
          },
          {
            channel: 'INT3',
            vectorName: 'INT3_vect',
            pinName: 'PD3 (TXD1 / INT3)',
            iscBit1: 'ISC31',
            iscBit0: 'ISC30',
            maskBit: 'INT3',
            flagBit: 'INTF3',
            priorityRank: 5,
            regCtrl: 'EICRA',
            regMask: 'EIMSK',
            regFlag: 'EIFR'
          },
          {
            channel: 'INT4',
            vectorName: 'INT4_vect',
            pinName: 'PE4 (INT4)',
            iscBit1: 'ISC41',
            iscBit0: 'ISC40',
            maskBit: 'INT4',
            flagBit: 'INTF4',
            priorityRank: 6,
            regCtrl: 'EICRB',
            regMask: 'EIMSK',
            regFlag: 'EIFR'
          }
        ];
      case 'atmega640':
      default:
        return [
          {
            channel: 'INT0',
            vectorName: 'INT0_vect',
            pinName: 'PD0 (SCL / INT0)',
            iscBit1: 'ISC01',
            iscBit0: 'ISC00',
            maskBit: 'INT0',
            flagBit: 'INTF0',
            priorityRank: 2,
            regCtrl: 'EICRA',
            regMask: 'EIMSK',
            regFlag: 'EIFR'
          },
          {
            channel: 'INT1',
            vectorName: 'INT1_vect',
            pinName: 'PD1 (SDA / INT1)',
            iscBit1: 'ISC11',
            iscBit0: 'ISC10',
            maskBit: 'INT1',
            flagBit: 'INTF1',
            priorityRank: 3,
            regCtrl: 'EICRA',
            regMask: 'EIMSK',
            regFlag: 'EIFR'
          },
          {
            channel: 'INT2',
            vectorName: 'INT2_vect',
            pinName: 'PD2 (RXD1 / INT2)',
            iscBit1: 'ISC21',
            iscBit0: 'ISC20',
            maskBit: 'INT2',
            flagBit: 'INTF2',
            priorityRank: 4,
            regCtrl: 'EICRA',
            regMask: 'EIMSK',
            regFlag: 'EIFR'
          },
          {
            channel: 'INT3',
            vectorName: 'INT3_vect',
            pinName: 'PD3 (TXD1 / INT3)',
            iscBit1: 'ISC31',
            iscBit0: 'ISC30',
            maskBit: 'INT3',
            flagBit: 'INTF3',
            priorityRank: 5,
            regCtrl: 'EICRA',
            regMask: 'EIMSK',
            regFlag: 'EIFR'
          },
          {
            channel: 'INT4',
            vectorName: 'INT4_vect',
            pinName: 'PE4 (OC3B / INT4)',
            iscBit1: 'ISC41',
            iscBit0: 'ISC40',
            maskBit: 'INT4',
            flagBit: 'INTF4',
            priorityRank: 6,
            regCtrl: 'EICRB',
            regMask: 'EIMSK',
            regFlag: 'EIFR'
          }
        ];
    }
  }, [selectedMCU]);

  const activeChannel = interruptChannels.find((c) => c.channel === selectedChannelId) || interruptChannels[0];

  // ISC Bit Configuration
  const triggerSpecs = useMemo(() => {
    switch (triggerMode) {
      case 'low_level':
        return {
          name: 'LOW 레벨 지속 (Low Level)',
          isc1Val: 0,
          isc0Val: 0,
          cMacro: `0`,
          comment: '입력 핀이 LOW(GND) 상태로 유지되는 동안 지속적으로 인터럽트 반복 트리거',
          useCase: '비상 정지(E-Stop), I2C 버스 감지 또는 Power-down 슬립 모드에서의 비동기 웨이크업'
        };
      case 'any_edge':
        return {
          name: '양방향 논리 변화 (Any Edge / Toggle)',
          isc1Val: 0,
          isc0Val: 1,
          cMacro: `(1 << ${activeChannel.iscBit0})`,
          comment: '신호가 HIGH->LOW 또는 LOW->HIGH로 변화할 때마다 트리거',
          useCase: '로터리 엔코더 위상 펄스 캡처, 양방향 토글 스위치 모니터링'
        };
      case 'falling_edge':
        return {
          name: '하강 에지 (Falling Edge - HIGH -> LOW)',
          isc1Val: 1,
          isc0Val: 0,
          cMacro: `(1 << ${activeChannel.iscBit1})`,
          comment: '신호가 HIGH에서 LOW로 떨어지는 순간 단 1회 에지 트리거',
          useCase: '내부 풀업 저항을 활성화한 푸시 버튼(Push Button to GND), 센서 액티브 로우 신호'
        };
      case 'rising_edge':
      default:
        return {
          name: '상승 에지 (Rising Edge - LOW -> HIGH)',
          isc1Val: 1,
          isc0Val: 1,
          cMacro: `(1 << ${activeChannel.iscBit1}) | (1 << ${activeChannel.iscBit0})`,
          comment: '신호가 LOW에서 HIGH로 솟아오르는 순간 단 1회 에지 트리거',
          useCase: '풀다운 저항 기반 외부 신호 감지, 액티브 하이 펄스 카운팅, 포토인터럽터 통과 순간'
        };
    }
  }, [triggerMode, activeChannel]);

  // Port name and bit extraction (e.g. PD2 -> DDRD, PORTD, PIND2)
  const pinDetails = useMemo(() => {
    const portChar = activeChannel.pinName.includes('PD') ? 'D' : (activeChannel.pinName.includes('PE') ? 'E' : 'B');
    const pinIndex = activeChannel.pinName.match(/P[D|E|B]([0-7])/)?.[1] || '2';
    return {
      ddr: `DDR${portChar}`,
      port: `PORT${portChar}`,
      pin: `PIN${portChar}`,
      bitName: `P${portChar}${pinIndex}`,
      bitNum: pinIndex
    };
  }, [activeChannel]);

  // Generated C Source Code
  const generatedSourceCode = useMemo(() => {
    return `// ==============================================================================
// ${currentProfile.name} 외부 인터럽트 ${activeChannel.channel} 설정 및 안전 ISR 템플릿
// Trigger Mode : ${triggerSpecs.name}
// Hardware Pin : ${activeChannel.pinName} (Vector: ${activeChannel.vectorName})
// Vector Prior : Reset 다음 ${activeChannel.priorityRank}번째 최우선순위 인터럽트
// ==============================================================================
#include <avr/io.h>
#include <avr/interrupt.h>
#include <stdbool.h>

// 1. 메인 루프와 상태를 공유하는 휘발성(volatile) 전역 플래그 변수
${useVolatileFlag ? `volatile bool g_${activeChannel.channel.toLowerCase()}_triggered = false;
volatile uint32_t g_${activeChannel.channel.toLowerCase()}_count = 0;` : `// volatile 플래그 변수`}

void ext_interrupt_${activeChannel.channel.toLowerCase()}_init(void) {
    // [단계 1] 전역 인터럽트 일시 차단
    cli();

    // [단계 2] 해당 핀을 입력(Input) 모드로 설정하고 풀업 저항 활성화
    ${pinDetails.ddr} &= ~(1 << ${pinDetails.bitName});  // 입력 모드 설정
    ${pullupState === 'pullup' ? `${pinDetails.port} |= (1 << ${pinDetails.bitName});   // 내부 풀업 저항(30k~50kΩ) 켬` : `${pinDetails.port} &= ~(1 << ${pinDetails.bitName});  // 플로팅 또는 외부 저항 사용`}

    // [단계 3] 트리거 에지 조건 설정 (${activeChannel.regCtrl})
    // ${triggerSpecs.comment}
    ${activeChannel.regCtrl} &= ~((1 << ${activeChannel.iscBit1}) | (1 << ${activeChannel.iscBit0})); // 기존 비트 클리어
    ${triggerSpecs.cMacro !== '0' ? `${activeChannel.regCtrl} |= ${triggerSpecs.cMacro};` : '// LOW 레벨은 00이므로 추가 OR 불필요'}

    // [단계 4] 이전 잔여 플래그 클리어 (EIFR에 1을 써서 이전 노이즈 플래그 초기화)
    ${activeChannel.regFlag} |= (1 << ${activeChannel.flagBit});

    // [단계 5] 인터럽트 마스크 허용 (${activeChannel.regMask})
    ${activeChannel.regMask} |= (1 << ${activeChannel.maskBit});

    // [단계 6] 전역 인터럽트 활성화
    sei();
}

/**
 * [단계 7] 외부 인터럽트 서비스 루틴 (ISR) 작성 원칙:
 * 1. ISR 내부에서는 _delay_ms()나 무한 대기 루프를 절대로 호출하지 마십시오.
 * 2. 복잡한 연산 대신 플래그만 세팅하고 메인 루프에서 작업을 처리하게 설계하십시오.
 * 3. 메인과 공유하는 변수에는 반드시 'volatile' 한정자를 붙여 컴파일러 최적화를 방지하십시오.
 */
ISR(${activeChannel.vectorName}) {
${useVolatileFlag ? `    g_${activeChannel.channel.toLowerCase()}_triggered = true;
    g_${activeChannel.channel.toLowerCase()}_count++;` : `    // 하드웨어 이벤트 즉시 처리 루틴`}
${includeDebounceGuide && triggerMode !== 'low_level' ? `    // [소프트웨어 채터링 방지]: 기계식 스위치는 5~20ms 동안 바운싱이 발생할 수 있습니다.
    // 실무에서는 ISR 내에서 타이머 타임스탬프를 비교하거나 플래그를 세팅 후
    // 메인 루프에서 타이머 기반 디바운싱을 수행하는 것이 가장 안전합니다.` : ''}
}
`;
  }, [
    currentProfile.name,
    activeChannel,
    triggerSpecs,
    pinDetails,
    pullupState,
    useVolatileFlag,
    includeDebounceGuide,
    triggerMode
  ]);

  const copyCode = () => {
    navigator.clipboard.writeText(generatedSourceCode);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.3 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Title Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" /> External Interrupt Tutorial
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              Target: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-mono">
              EICRA / EICRB / EIMSK
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            외부 인터럽트(EICRA/EIMSK) 설정 튜토리얼 & 안전 ISR 가이드
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            인터럽트 트리거 조건(하강/상승 에지, 토글, LOW 레벨)을 선택하면
            <strong>EICRA, EICRB 레지스터 비트마스크(ISCxx)</strong>와 <strong>EIMSK 마스크</strong>가 적용된
            프로덕션 C 언어 초기화 코드와 함께 <strong>실행 우선순위, volatile 메모리 배리어 및 안전 ISR 작성 가이드</strong>를 대화형 카드로 제공합니다.
          </p>
        </div>

        {/* Copy Button */}
        <button
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20 shrink-0"
        >
          {copiedCode ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
          <span>{copiedCode ? '튜토리얼 코드 복사됨' : 'C 인터럽트 코드 복사'}</span>
        </button>
      </div>

      {/* Interactive Trigger & Channel Selection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">외부 인터럽트 핀 및 트리거 설정</h3>
          </div>

          {/* 1. Channel Selector */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">인터럽트 채널 선택</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 font-mono text-xs">
              {interruptChannels.map((ch) => (
                <button
                  key={ch.channel}
                  type="button"
                  onClick={() => setSelectedChannelId(ch.channel)}
                  className={`py-1.5 rounded-lg border font-bold transition text-center ${
                    selectedChannelId === ch.channel
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {ch.channel}
                </button>
              ))}
            </div>
            <div className="mt-2 p-2 bg-slate-900/80 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 flex justify-between">
              <span>물리 핀: <strong className="text-cyan-300">{activeChannel.pinName}</strong></span>
              <span>벡터명: <strong className="text-amber-400">{activeChannel.vectorName}</strong></span>
            </div>
          </div>

          {/* 2. Trigger Mode Selector */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">인터럽트 트리거 감지 조건 (ISC Bits)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setTriggerMode('falling_edge')}
                className={`p-2.5 rounded-xl border font-bold text-left transition ${
                  triggerMode === 'falling_edge'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                📉 하강 에지 (Falling)
                <span className="block text-[10px] text-slate-400 font-normal">HIGH → LOW (버튼 풀업 권장)</span>
              </button>

              <button
                type="button"
                onClick={() => setTriggerMode('rising_edge')}
                className={`p-2.5 rounded-xl border font-bold text-left transition ${
                  triggerMode === 'rising_edge'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                📈 상승 에지 (Rising)
                <span className="block text-[10px] text-slate-400 font-normal">LOW → HIGH (펄스 카운트)</span>
              </button>

              <button
                type="button"
                onClick={() => setTriggerMode('any_edge')}
                className={`p-2.5 rounded-xl border font-bold text-left transition ${
                  triggerMode === 'any_edge'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🔄 양방향 에지 (Toggle)
                <span className="block text-[10px] text-slate-400 font-normal">신호 변화 시마다 (엔코더)</span>
              </button>

              <button
                type="button"
                onClick={() => setTriggerMode('low_level')}
                className={`p-2.5 rounded-xl border font-bold text-left transition ${
                  triggerMode === 'low_level'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                ⏸️ LOW 레벨 (Level)
                <span className="block text-[10px] text-slate-400 font-normal">GND 유지 시 지속 트리거</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 font-sans leading-tight">
              💡 {triggerSpecs.useCase}
            </p>
          </div>

          {/* 3. Pull-up Resistor Configuration */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">핀 입력 저항 모드</label>
            <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setPullupState('pullup')}
                className={`py-1.5 rounded-lg border font-bold transition text-center ${
                  pullupState === 'pullup'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                내부 풀업 (ON)
              </button>
              <button
                type="button"
                onClick={() => setPullupState('pulldown')}
                className={`py-1.5 rounded-lg border font-bold transition text-center ${
                  pullupState === 'pulldown'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                외부 풀다운
              </button>
              <button
                type="button"
                onClick={() => setPullupState('none')}
                className={`py-1.5 rounded-lg border font-bold transition text-center ${
                  pullupState === 'none'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                플로팅 (None)
              </button>
            </div>
          </div>

          {/* 4. Options */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={useVolatileFlag}
                onChange={(e) => setUseVolatileFlag(e.target.checked)}
                className="accent-amber-500 rounded"
              />
              <span><code>volatile</code> 플래그 변수 생성 (컴파일러 최적화 방지)</span>
            </label>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeDebounceGuide}
                onChange={(e) => setIncludeDebounceGuide(e.target.checked)}
                className="accent-amber-500 rounded"
              />
              <span>스위치 채터링(바운싱) 방지 디바운스 가이드 주석 포함</span>
            </label>
          </div>
        </div>

        {/* Right Tutorial Cards & Priority Table (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Hardware Priority & Registers Breakdown Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">하드웨어 레지스터 비트 및 우선순위 매핑</h3>
              </div>
              <span className="text-[11px] font-mono text-amber-400 font-bold">
                {activeChannel.channel} (우선순위 #{activeChannel.priorityRank})
              </span>
            </div>

            {/* 3 Step Register Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-xs">
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] block font-sans">1. 에지 센싱 제어 레지스터</span>
                <div className="text-cyan-300 font-bold">{activeChannel.regCtrl}</div>
                <div className="text-[11px] text-amber-400">
                  {activeChannel.iscBit1}={triggerSpecs.isc1Val}, {activeChannel.iscBit0}={triggerSpecs.isc0Val}
                </div>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] block font-sans">2. 인터럽트 마스크 허용</span>
                <div className="text-emerald-300 font-bold">{activeChannel.regMask}</div>
                <div className="text-[11px] text-white">
                  (1 &lt;&lt; {activeChannel.maskBit})
                </div>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] block font-sans">3. 잔여 플래그 클리어</span>
                <div className="text-rose-300 font-bold">{activeChannel.regFlag}</div>
                <div className="text-[11px] text-slate-300">
                  (1 &lt;&lt; {activeChannel.flagBit})
                </div>
              </div>
            </div>

            {/* Execution Priority Explanation */}
            <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans space-y-1">
              <div className="font-bold text-amber-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> 인터럽트 실행 우선순위 (Interrupt Priority Rule):
              </div>
              <p className="text-[11px] text-slate-400">
                AVR 마이크로컨트롤러에서 <strong>{activeChannel.channel}</strong>은 리셋(RESET) 바로 다음에 위치하는 <strong>우선순위 #{activeChannel.priorityRank}</strong> 인터럽트입니다.
                타이머 오버플로우나 UART 통신 인터럽트와 동시에 발생할 경우 하드웨어적으로 {activeChannel.channel}이 가장 먼저 실행됩니다.
              </p>
            </div>
          </div>

          {/* Interactive Tutorial: 4 Golden Rules of ISR */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">안전한 ISR(인터럽트 서비스 루틴) 작성 4대 수칙</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-sans">
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <strong className="text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 1. 초단시간 실행 (Keep it Short)
                </strong>
                <p className="text-slate-400 text-[11px]">
                  ISR 안에서는 절대 <code>_delay_ms()</code>나 루프를 돌지 마십시오. 인터럽트 처리 중에는 기본적으로 타 인터럽트가 전역 차단됩니다.
                </p>
              </div>

              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <strong className="text-cyan-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 2. volatile 키워드 필수
                </strong>
                <p className="text-slate-400 text-[11px]">
                  ISR 내부에서 수정하고 메인 루프에서 읽는 모든 공유 플래그 변수에는 반드시 <code>volatile</code>을 지정하여 레지스터 캐싱을 방지해야 합니다.
                </p>
              </div>

              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <strong className="text-amber-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 3. 플래그 기반 비동기 위임
                </strong>
                <p className="text-slate-400 text-[11px]">
                  ISR에서는 <code>flag = true;</code>만 변경하고, 모터 구동이나 디스플레이 출력 등 무거운 작업은 메인 <code>while(1)</code> 루프에 위임하세요.
                </p>
              </div>

              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <strong className="text-rose-300 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> 4. 기계식 스위치 채터링 방지
                </strong>
                <p className="text-slate-400 text-[11px]">
                  에지 트리거 사용 시 접점 바운싱으로 인해 1번 누름에 10회 이상 ISR이 재진입될 수 있습니다. 타이머 시간차 검증(디바운싱)을 병행하십시오.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Code Viewer Panel */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-white font-mono">
              {currentProfile.name} {activeChannel.channel} Bare-Metal C 드라이버 & ISR 구현 소스
            </span>
          </div>

          <button
            onClick={copyCode}
            className="text-slate-400 hover:text-white text-xs font-mono inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copiedCode ? '복사됨' : '전체 복사'}</span>
          </button>
        </div>

        <pre className="p-5 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto max-h-[480px] custom-scrollbar bg-slate-950/90 selection:bg-amber-500/30">
          {generatedSourceCode}
        </pre>
      </div>
    </div>
  );
};
