import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { getVectorTableByMCU, InterruptVector } from '../data/interruptVectorsData';
import {
  Activity,
  Bell,
  Check,
  Copy,
  Filter,
  Hash,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Code2,
  Sliders,
  Sparkles,
  Zap,
  Layers,
  ArrowRight,
  Info,
  RotateCcw,
  BookOpen
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type IsrExecutionMode = 'standard' | 'noblock' | 'naked' | 'empty';

export const InterruptVectorTableExplorer: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const vectors = useMemo(() => getVectorTableByMCU(selectedMCU), [selectedMCU]);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [addressDisplayMode, setAddressDisplayMode] = useState<'word' | 'byte'>('byte');
  const [copiedVector, setCopiedVector] = useState<string | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState<boolean>(false);

  // Active selected vector for template generation
  const [activeVector, setActiveVector] = useState<InterruptVector>(() => {
    // Default to first non-reset vector (e.g. INT0_vect)
    return vectors.find((v) => v.vectorNum === 2) || vectors[0];
  });

  // Template ISR Configuration States
  const [isrMode, setIsrMode] = useState<IsrExecutionMode>('standard');
  const [includeVolatileFlag, setIncludeVolatileFlag] = useState<boolean>(true);
  const [includeInitFunction, setIncludeInitFunction] = useState<boolean>(true);
  const [includeAtomicSnippet, setIncludeAtomicSnippet] = useState<boolean>(true);

  // Keep activeVector valid when selectedMCU changes
  React.useEffect(() => {
    const matching = vectors.find((v) => v.vectorName === activeVector?.vectorName);
    if (matching) {
      setActiveVector(matching);
    } else {
      setActiveVector(vectors.find((v) => v.vectorNum === 2) || vectors[0]);
    }
  }, [selectedMCU, vectors]);

  const categories = [
    { id: 'all', label: '전체' },
    { id: 'external', label: '외부/핀체인지' },
    { id: 'timer', label: '타이머/카운터' },
    { id: 'comm', label: '통신(USART/SPI/TWI)' },
    { id: 'analog', label: 'ADC/비교기' },
    { id: 'system', label: '시스템/리셋' },
    { id: 'eeprom', label: 'EEPROM' }
  ];

  // Helper to calculate Byte Address vs Word Address
  // In AVR, program memory word = 2 bytes.
  // ATmega328P: RJMP instructions (1 word = 2 bytes step): vec 1 = 0x0000, vec 2 = 0x0002 byte
  // ATmega128 / ATmega640: JMP instructions (2 words = 4 bytes step): vec 1 = 0x0000, vec 2 = 0x0004 byte
  const getFormattedAddress = (vec: InterruptVector, mode: 'word' | 'byte') => {
    const rawHex = vec.programAddress.replace('0x', '');
    const num = parseInt(rawHex, 16);

    if (mode === 'byte') {
      // In ATmega328P, datasheet vector table lists Word addresses (0x0000, 0x0001 or 0x0002)
      // Usually vector 1 = 0x0000, vector 2 = 0x0002.
      // If the table provides Word address, byte address = word * 2.
      // Let's compute clean byte address:
      let byteAddr: number;
      if (selectedMCU === 'atmega328p') {
        byteAddr = (vec.vectorNum - 1) * 2; // 2 bytes per RJMP vector
      } else {
        byteAddr = (vec.vectorNum - 1) * 4; // 4 bytes per JMP vector in 640/128
      }
      return '0x' + byteAddr.toString(16).toUpperCase().padStart(4, '0');
    } else {
      // Word Address (Program Counter units)
      let wordAddr: number;
      if (selectedMCU === 'atmega328p') {
        wordAddr = (vec.vectorNum - 1) * 1;
      } else {
        wordAddr = (vec.vectorNum - 1) * 2;
      }
      return '0x' + wordAddr.toString(16).toUpperCase().padStart(4, '0');
    }
  };

  const filteredVectors = useMemo(() => {
    return vectors.filter((v) => {
      const matchesCat = selectedCategory === 'all' || v.category === selectedCategory;
      const q = searchTerm.toLowerCase().trim();
      const byteAddr = getFormattedAddress(v, 'byte').toLowerCase();
      const wordAddr = getFormattedAddress(v, 'word').toLowerCase();
      const matchesSearch =
        !q ||
        v.vectorName.toLowerCase().includes(q) ||
        v.sourceName.toLowerCase().includes(q) ||
        v.enableRegister.toLowerCase().includes(q) ||
        v.programAddress.toLowerCase().includes(q) ||
        byteAddr.includes(q) ||
        wordAddr.includes(q) ||
        v.description.toLowerCase().includes(q);

      return matchesCat && matchesSearch;
    });
  }, [vectors, selectedCategory, searchTerm, addressDisplayMode, selectedMCU]);

  // Generate Comprehensive ISR C Code Snippet
  const generatedCIsrSnippet = useMemo(() => {
    if (!activeVector) return '';

    const isReset = activeVector.vectorNum === 1;
    if (isReset) {
      return `// ==============================================================================
// ${currentProfile.name} - RESET Vector (0x0000)
// 리셋 벡터는 하드웨어에 의해 기본 진입점으로 고정되며 일반 ISR()로 선언하지 않습니다.
// C 런타임 시작 코드(crt0.S)가 호출된 후 main() 함수로 제어가 전달됩니다.
// ==============================================================================
#include <avr/io.h>

int main(void) {
    // 시스템 초기화
    while (1) {
        // 메인 루프
    }
}`;
    }

    let isrHeader = '';
    let isrBody = '';
    let modeComment = '';

    if (isrMode === 'noblock') {
      isrHeader = `ISR(${activeVector.vectorName}, ISR_NOBLOCK)`;
      modeComment = `// [ISR_NOBLOCK]: 진입 즉시 전역 인터럽트(sei)를 허용하여 더 급한 고우선순위 인터럽트가 중첩될 수 있도록 합니다.`;
      isrBody = `    // ⚠️ 주의: 동일한 인터럽트가 재진입하여 스택 오버플로우가 나지 않도록 플래그를 가장 먼저 클리어하세요.
    ${includeVolatileFlag ? 'g_interruptCount++;\n    g_eventFlag = 1;' : '// 사용자 처리 로직'}`;
    } else if (isrMode === 'naked') {
      isrHeader = `ISR(${activeVector.vectorName}, ISR_NAKED)`;
      modeComment = `// [ISR_NAKED]: 컴파일러가 프롤로그/에필로그(PUSH/POP SREG, 레지스터 백업)를 전혀 생성하지 않습니다.
// 초저지연 어셈블리 작성 시 사용하며, 반드시 마지막에 reti() 어셈블리로 복귀해야 합니다.`;
      isrBody = `    __asm__ __volatile__ (
        "push r24       \\n\\t"
        "in   r24, __SREG__ \\n\\t"
        "push r24       \\n\\t"
        // 사용자 초고속 어셈블리 또는 단일 포트 토글
        "pop  r24       \\n\\t"
        "out  __SREG__, r24 \\n\\t"
        "pop  r24       \\n\\t"
        "reti           \\n\\t"
    );`;
    } else if (isrMode === 'empty') {
      isrHeader = `EMPTY_INTERRUPT(${activeVector.vectorName});`;
      modeComment = `// [EMPTY_INTERRUPT]: 본체 없이 단순 reti() 명령어로 복귀하여 하드웨어 플래그만 자동 클리어합니다.`;
      isrBody = ``;
    } else {
      isrHeader = `ISR(${activeVector.vectorName})`;
      modeComment = `// [표준 안전 모드]: SREG 및 사용 레지스터 자동 백업/복원. 진입 시 전역 인터럽트 자동 차단.`;
      isrBody = `    // ${activeVector.sourceName} 처리 루틴
    ${includeVolatileFlag ? 'g_eventFlag = 1;\n    g_interruptCount++;' : '// 사용자 작업 수행'}
    // 하드웨어 인터럽트 플래그는 ISR 진입 시 자동 클리어됩니다.`;
    }

    const volatileSection = includeVolatileFlag
      ? `// 1. volatile 인터럽트 공유 전역 변수 선언 (컴파일러 최적화 캐싱 방지)
volatile uint8_t  g_eventFlag = 0;
volatile uint16_t g_interruptCount = 0;
`
      : '';

    const initSection = includeInitFunction
      ? `
// 2. ${activeVector.sourceName} 활성화 초기화 함수
void init_${activeVector.vectorName.toLowerCase()}(void) {
    // 관련 활성화 레지스터: ${activeVector.enableRegister}
    // 관련 플래그 레지스터: ${activeVector.flagRegister}
    
    // (1) 해당 주변장치 인터럽트 인에이블 비트 설정 (예시)
    // ${activeVector.enableRegister} |= (1 << ...);

    // (2) 전역 인터럽트 활성화 (SREG I-bit = 1)
    sei();
}
`
      : '';

    const atomicSection = includeAtomicSnippet
      ? `
// 3. 메인 루프에서 16비트 인터럽트 공유 변수를 원자적(Atomic)으로 안전하게 읽기
#include <util/atomic.h>

void process_interrupt_data(void) {
    uint16_t local_count;
    ATOMIC_BLOCK(ATOMIC_RESTORESTATE) {
        // 인터럽트 차단 상태에서 안전하게 16비트 변수 복사
        local_count = g_interruptCount;
        g_eventFlag = 0;
    }
    // 복사된 local_count를 바탕으로 안전하게 작업 수행
}
`
      : '';

    return `// ==============================================================================
// ${currentProfile.name} - ${activeVector.sourceName} (${activeVector.vectorName})
// 플래시 주소: Byte ${getFormattedAddress(activeVector, 'byte')} / Word ${getFormattedAddress(activeVector, 'word')} (우선순위 #${activeVector.vectorNum})
// ==============================================================================
#include <avr/io.h>
#include <avr/interrupt.h>

${volatileSection}${initSection}
${modeComment}
${isrMode === 'empty' ? isrHeader : `${isrHeader} {\n${isrBody}\n}`}
${atomicSection}`;
  }, [
    activeVector,
    isrMode,
    includeVolatileFlag,
    includeInitFunction,
    includeAtomicSnippet,
    currentProfile.name,
    selectedMCU
  ]);

  const copyIsrSnippet = (vec: InterruptVector) => {
    const isrSnippet = `// ${vec.sourceName} ISR (${vec.vectorName})
// Flash Address: ${getFormattedAddress(vec, 'byte')}
ISR(${vec.vectorName}) {
    // 사용자 인터럽트 처리 코드 작성
    // ${vec.flagRegister} 플래그는 하드웨어에 의해 자동 클리어됩니다.
}`;
    navigator.clipboard.writeText(isrSnippet);
    setCopiedVector(vec.vectorName);
    setTimeout(() => setCopiedVector(null), 2000);
  };

  const copyFullTemplate = () => {
    navigator.clipboard.writeText(generatedCIsrSnippet);
    setCopiedTemplate(true);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.4 } });
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Title & Info Banner */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
              <Bell className="w-3.5 h-3.5" /> Interrupt Vector Table Reference
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              MCU: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-mono">
              총 {vectors.length}개 인터럽트 벡터 (우선순위 1 ~ {vectors.length})
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-rose-400" />
            {currentProfile.name} 인터럽트 벡터 테이블(IVT) 및 템플릿 C 코드 생성기
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            각 인터럽트 서비스 루틴(ISR)의 <strong>플래시 메모리 주소(Word & Byte)</strong>, 하드웨어 우선순위, 활성화 레지스터 및 플래그를 참조하고,
            선택한 벡터의 <strong>AVR-GCC 템플릿 C 소스코드(표준, 중첩, Naked 등)</strong>를 자동 생성합니다.
          </p>
        </div>

        {/* Target MCU Switcher Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onSelectMCU && (
            <div className="flex flex-wrap bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0">
              {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
                <button
                  key={mcuId}
                  onClick={() => onSelectMCU(mcuId)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    selectedMCU === mcuId
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {MCU_PROFILES[mcuId].name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Vector Table Quick Specs Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80">
          <span className="text-[10px] text-slate-500 block">리셋 벡터 (Reset)</span>
          <span className="text-rose-400 font-bold">0x0000 (Priority #1)</span>
        </div>
        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80">
          <span className="text-[10px] text-slate-500 block">벡터 테이블 간격 (Spacing)</span>
          <span className="text-cyan-400 font-bold">
            {selectedMCU === 'atmega328p' ? '2 Bytes (1 Word RJMP)' : '4 Bytes (2 Words JMP)'}
          </span>
        </div>
        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80">
          <span className="text-[10px] text-slate-500 block">전역 인터럽트 활성화</span>
          <span className="text-emerald-400 font-bold">sei() / SREG (I=1)</span>
        </div>
        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80">
          <span className="text-[10px] text-slate-500 block">부트로더 재배치 지원</span>
          <span className="text-amber-400 font-bold">MCUCR (IVSEL/IVCE)</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-amber-400" /> 소스 필터:
          </span>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 text-xs rounded-xl transition-all border ${
                selectedCategory === cat.id
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Address Display Mode Toggle */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-mono shrink-0">
            <button
              onClick={() => setAddressDisplayMode('byte')}
              className={`px-2 py-0.5 rounded-lg transition ${
                addressDisplayMode === 'byte' ? 'bg-rose-500 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="바이트 단위 주소 (HEX 파일 및 어셈블리 링커 기준)"
            >
              Byte 주소
            </button>
            <button
              onClick={() => setAddressDisplayMode('word')}
              className={`px-2 py-0.5 rounded-lg transition ${
                addressDisplayMode === 'word' ? 'bg-rose-500 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="워드 단위 주소 (프로그램 카운터 PC 단위)"
            >
              Word 주소
            </button>
          </div>

          <div className="relative w-full md:w-56">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="인터럽트 검색 (INT0, TIMER, 0x04...)"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>
      </div>

      {/* Vector Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/70 shadow-xl max-h-96 custom-scrollbar">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800 sticky top-0 z-10 backdrop-blur">
            <tr>
              <th className="px-3 py-3 w-16 text-center">우선순위</th>
              <th className="px-3 py-3 w-28">플래시 주소 ({addressDisplayMode.toUpperCase()})</th>
              <th className="px-4 py-3 w-48">GCC 벡터 매크로</th>
              <th className="px-4 py-3">인터럽트 소스 (Source)</th>
              <th className="px-4 py-3">활성화 레지스터 (Enable)</th>
              <th className="px-3 py-3">플래그 레지스터 (Flag)</th>
              <th className="px-3 py-3 w-36 text-center">동작</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredVectors.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-500">
                  검색 조건과 일치하는 인터럽트 벡터가 없습니다.
                </td>
              </tr>
            ) : (
              filteredVectors.map((vec) => {
                const isReset = vec.vectorNum === 1;
                const isSelected = activeVector?.vectorNum === vec.vectorNum;
                const formattedAddr = getFormattedAddress(vec, addressDisplayMode);

                return (
                  <tr
                    key={vec.vectorNum}
                    onClick={() => setActiveVector(vec)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-rose-500/10 border-l-4 border-l-rose-500'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    {/* Priority */}
                    <td className="px-3 py-2 text-center font-mono font-bold">
                      <span
                        className={`inline-block w-6 h-6 leading-6 rounded-full text-center text-xs ${
                          isReset
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black'
                            : vec.vectorNum <= 5
                            ? 'bg-amber-500/10 text-amber-300'
                            : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        {vec.vectorNum}
                      </span>
                    </td>

                    {/* Program Address */}
                    <td className="px-3 py-2 font-mono text-cyan-400 font-bold">
                      {formattedAddr}
                    </td>

                    {/* Vector Name (GCC Macro) */}
                    <td className="px-4 py-2 font-mono font-bold text-white">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300">
                        {vec.vectorName}
                      </span>
                    </td>

                    {/* Source Name */}
                    <td className="px-4 py-2 font-medium text-slate-200">
                      <div>{vec.sourceName}</div>
                      <div className="text-[10px] text-slate-500 line-clamp-1">{vec.description}</div>
                    </td>

                    {/* Enable Register */}
                    <td className="px-4 py-2 font-mono text-amber-400 text-[11px]">
                      {vec.enableRegister}
                    </td>

                    {/* Flag Register */}
                    <td className="px-3 py-2 font-mono text-slate-400 text-[11px]">
                      {vec.flagRegister}
                    </td>

                    {/* Action buttons */}
                    <td className="px-3 py-2 text-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setActiveVector(vec)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                          isSelected
                            ? 'bg-rose-500 text-white border-rose-400'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                        title="템플릿 C 코드 생성기로 선택"
                      >
                        선택
                      </button>
                      {!isReset && (
                        <button
                          onClick={() => copyIsrSnippet(vec)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 hover:text-white transition border border-slate-700"
                          title="빠른 ISR 코드 복사"
                        >
                          {copiedVector === vec.vectorName ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedVector === vec.vectorName ? '복사됨' : '복사'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Interactive Template ISR C Code Generator Section */}
      <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-emerald-400" />
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>템플릿 ISR C 소스코드 생성기</span>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  {activeVector.vectorName}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  ({getFormattedAddress(activeVector, 'byte')})
                </span>
              </h4>
              <p className="text-[11px] text-slate-400">
                인터럽트 실행 모드 및 부가 코드 옵션을 선택하여 프로덕션에 즉시 사용할 수 있는 완벽한 C 코드를 생성합니다.
              </p>
            </div>
          </div>

          <button
            onClick={copyFullTemplate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-600/20 shrink-0"
          >
            {copiedTemplate ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
            <span>{copiedTemplate ? '전체 코드 복사 완료!' : '전체 C 템플릿 복사'}</span>
          </button>
        </div>

        {/* Generator Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mode Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" /> ISR 실행 모드 (Execution Mode)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'standard', name: '표준 모드 (Standard)', desc: '안전한 기본 ISR' },
                { id: 'noblock', name: '중첩 모드 (ISR_NOBLOCK)', desc: 'sei 즉시 실행 중첩 허용' },
                { id: 'naked', name: '초저지연 (ISR_NAKED)', desc: '프롤로그 없는 순수 어셈블리' },
                { id: 'empty', name: '더미 클리어 (EMPTY)', desc: '하드웨어 플래그만 클리어' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setIsrMode(m.id as IsrExecutionMode)}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    isrMode === m.id
                      ? 'bg-rose-500/10 border-rose-500/50 text-white font-bold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs text-white flex justify-between items-center">
                    <span>{m.name}</span>
                    {isrMode === m.id && <Check className="w-3.5 h-3.5 text-rose-400" />}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Code Inclusions Checkboxes */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 부가 안전 코드 포함 옵션
            </label>
            <div className="space-y-2 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={includeVolatileFlag}
                  onChange={(e) => setIncludeVolatileFlag(e.target.checked)}
                  className="accent-rose-500 rounded"
                />
                <span>volatile 전역 플래그 변수 선언 (<code className="text-amber-400">volatile uint8_t</code>)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={includeInitFunction}
                  onChange={(e) => setIncludeInitFunction(e.target.checked)}
                  className="accent-rose-500 rounded"
                />
                <span>레지스터 설정 및 전역 인터럽트 활성화 함수 (<code className="text-cyan-400">init_...()</code>)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={includeAtomicSnippet}
                  onChange={(e) => setIncludeAtomicSnippet(e.target.checked)}
                  className="accent-rose-500 rounded"
                />
                <span>메인 루프 원자적 변수 읽기 (<code className="text-emerald-400">ATOMIC_BLOCK</code>) 스니펫</span>
              </label>
            </div>
          </div>
        </div>

        {/* Live Code Output Window */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-rose-400" />
              <span>Generated C ISR Code ({activeVector.vectorName})</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono font-bold">
              avr-gcc Ready
            </span>
          </div>
          <pre className="p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed max-h-64 custom-scrollbar select-all">
            {generatedCIsrSnippet}
          </pre>
        </div>
      </div>

      {/* Critical Bare-metal Safety Rules */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
        <div className="flex items-center gap-2 text-rose-400 font-bold">
          <ShieldAlert className="w-4 h-4" />
          <span>AVR 인터럽트 설계 시 필수 아키텍처 규칙 (Bare-metal Guidelines)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-300 text-[11px] leading-relaxed pt-1">
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800/80">
            <strong className="text-amber-400 block mb-0.5">1. volatile 키워드 필수</strong>
            ISR 내부에서 값이 변경되고 메인 루프에서 읽는 모든 전역 변수는 컴파일러 레지스터 캐싱 방지를 위해 반드시 <code className="bg-slate-800 px-1 rounded text-white">volatile uint8_t flag;</code>로 선언해야 합니다.
          </div>
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800/80">
            <strong className="text-cyan-400 block mb-0.5">2. ISR 실행 시간 극소화</strong>
            인터럽트 진입 시 전역 인터럽트 플래그(SREG I-bit)가 하드웨어에 의해 자동 클리어되므로, 긴 딜레이 루프나 복잡한 계산을 넣지 말고 플래그만 세트 후 복귀해야 합니다.
          </div>
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800/80">
            <strong className="text-emerald-400 block mb-0.5">3. 16비트 변수 원자성 보호</strong>
            메인 루프에서 2바이트 이상(16비트/32비트)의 인터럽트 공유 변수를 읽을 때는 읽기 도중 인터럽트가 끼어들지 못하게 <code className="bg-slate-800 px-1 rounded text-white">ATOMIC_BLOCK</code>으로 감싸야 합니다.
          </div>
        </div>
      </div>
    </div>
  );
};
