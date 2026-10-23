import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { REGISTER_DATABASE, RegisterDefinition, BitInfo } from './RegisterStatusDashboard';
import {
  Sliders,
  Code2,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  Search,
  Zap,
  Terminal,
  Cpu,
  Bookmark,
  Layers,
  ArrowRight,
  ShieldCheck,
  SlidersHorizontal,
  Flame
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
}

type OperationMode = 'assign' | 'set' | 'clear' | 'toggle' | 'test' | 'bv';

export const BitManipulationAssistant: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Filter registers that support this MCU
  const availableRegisters = useMemo(() => {
    return REGISTER_DATABASE.filter(
      (reg) => !reg.mcuSupport || reg.mcuSupport.includes(selectedMCU)
    );
  }, [selectedMCU]);

  // Selected Register (defaults to ADCSRA or first available)
  const [selectedRegName, setSelectedRegName] = useState<string>('ADCSRA');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [operationMode, setOperationMode] = useState<OperationMode>('assign');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Active Register Definition
  const currentRegister = useMemo(() => {
    return (
      availableRegisters.find((r) => r.name === selectedRegName) ||
      availableRegisters[0] || {
        name: 'CUSTOM_REG',
        addr: '0x00',
        category: 'system' as const,
        categoryLabel: '사용자 지정',
        desc: '사용자 지정 8비트 SFR 레지스터',
        defaultVal: 0x00,
        bits: Array.from({ length: 8 }, (_, i) => ({
          bit: 7 - i,
          name: `BIT${7 - i}`,
          rw: 'R/W' as const,
          reset: 0,
          desc: `Bit ${7 - i} 제어`,
          onMeaning: 'Active (1)',
          offMeaning: 'Inactive (0)'
        }))
      }
    );
  }, [availableRegisters, selectedRegName]);

  // Bit State: Array of 8 booleans (index 0 = Bit 0, index 7 = Bit 7)
  const [selectedBits, setSelectedBits] = useState<boolean[]>(() => {
    const initial = new Array(8).fill(false);
    // Default to defaultVal of register
    const def = currentRegister.defaultVal;
    for (let i = 0; i < 8; i++) {
      initial[i] = ((def >> i) & 1) === 1;
    }
    return initial;
  });

  // When register changes, reset bits to register's default value
  React.useEffect(() => {
    const nextBits = new Array(8).fill(false);
    const def = currentRegister.defaultVal;
    for (let i = 0; i < 8; i++) {
      nextBits[i] = ((def >> i) & 1) === 1;
    }
    setSelectedBits(nextBits);
  }, [currentRegister]);

  // Categories for filter
  const categories = useMemo(() => {
    const cats = new Set(availableRegisters.map((r) => r.category));
    return [
      { id: 'all', label: '전체' },
      ...Array.from(cats).map((c) => {
        const sample = availableRegisters.find((r) => r.category === c);
        return { id: c, label: sample?.categoryLabel.split(' ')[0] || c.toUpperCase() };
      })
    ];
  }, [availableRegisters]);

  // Filtered register list for dropdown/search
  const filteredRegisters = useMemo(() => {
    return availableRegisters.filter((r) => {
      const matchCat = categoryFilter === 'all' || r.category === categoryFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.desc.toLowerCase().includes(q) ||
        r.bits.some((b) => b.name.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [availableRegisters, categoryFilter, searchQuery]);

  // Toggle single bit
  const handleToggleBit = (bitIndex: number) => {
    setSelectedBits((prev) => {
      const next = [...prev];
      next[bitIndex] = !next[bitIndex];
      return next;
    });
  };

  // Batch actions
  const handleSelectAll = () => setSelectedBits(new Array(8).fill(true));
  const handleClearAll = () => setSelectedBits(new Array(8).fill(false));
  const handleInvertAll = () => setSelectedBits((prev) => prev.map((b) => !b));
  const handleResetToDefault = () => {
    const next = new Array(8).fill(false);
    const def = currentRegister.defaultVal;
    for (let i = 0; i < 8; i++) {
      next[i] = ((def >> i) & 1) === 1;
    }
    setSelectedBits(next);
  };

  // Numerical Mask Calculations
  const calculatedHexValue = useMemo(() => {
    let val = 0;
    for (let i = 0; i < 8; i++) {
      if (selectedBits[i]) val |= 1 << i;
    }
    return val;
  }, [selectedBits]);

  const hexString = useMemo(() => {
    return '0x' + calculatedHexValue.toString(16).toUpperCase().padStart(2, '0');
  }, [calculatedHexValue]);

  const binaryString = useMemo(() => {
    return '0b' + calculatedHexValue.toString(2).padStart(8, '0');
  }, [calculatedHexValue]);

  // Active Bit Names List (ordered from MSB Bit 7 down to LSB Bit 0)
  const activeBitNames = useMemo(() => {
    const list: { bit: number; name: string }[] = [];
    for (let i = 7; i >= 0; i--) {
      if (selectedBits[i]) {
        const bitDef = currentRegister.bits.find((b) => b.bit === i);
        list.push({ bit: i, name: bitDef?.name || `BIT${i}` });
      }
    }
    return list;
  }, [selectedBits, currentRegister]);

  // Inactive Bit Names List
  const inactiveBitNames = useMemo(() => {
    const list: { bit: number; name: string }[] = [];
    for (let i = 7; i >= 0; i--) {
      if (!selectedBits[i]) {
        const bitDef = currentRegister.bits.find((b) => b.bit === i);
        list.push({ bit: i, name: bitDef?.name || `BIT${i}` });
      }
    }
    return list;
  }, [selectedBits, currentRegister]);

  // Build Symbolic (1 << BIT) C-Expression
  const symbolicShiftExpression = useMemo(() => {
    if (activeBitNames.length === 0) return '0x00';
    return activeBitNames.map((b) => `(1 << ${b.name})`).join(' | ');
  }, [activeBitNames]);

  // Build _BV(BIT) Expression
  const bvMacroExpression = useMemo(() => {
    if (activeBitNames.length === 0) return '0x00';
    return activeBitNames.map((b) => `_BV(${b.name})`).join(' | ');
  }, [activeBitNames]);

  // Formatted C-Code Generation for Different Patterns
  const generatedCodeSnippets = useMemo(() => {
    const reg = currentRegister.name;
    const expr = symbolicShiftExpression;
    const bvExpr = bvMacroExpression;

    return {
      assign: `// [할당 연산자 =]: 선택된 비트를 세트하고 나머지 모든 비트는 0으로 초기화
${reg} = ${expr}; // ${hexString} (${binaryString})`,

      set: `// [비트 세트 |=]: 기존 다른 비트 상태를 유지하면서 선택된 비트만 High로 세트
${reg} |= ${expr};`,

      clear: `// [비트 클리어 &= ~]: 기존 다른 비트 상태를 유지하면서 선택된 비트만 Low로 클리어
// ⚠️ 주의: 반드시 ~((1<<A) | (1<<B)) 처럼 괄호로 묶어야 연산자 우선순위 버그를 방지합니다.
${reg} &= ~(${expr});`,

      toggle: `// [비트 반전 ^=]: 선택된 비트의 현재 로직 상태를 토글 (0 -> 1, 1 -> 0)
${reg} ^= ${expr};`,

      test: `// [비트 상태 검사]: 해당 비트가 세트되어 있는지 조건문 또는 폴링 대기
if (${reg} & (${expr})) {
    // ${activeBitNames.map((b) => b.name).join(', ')} 비트가 1로 활성화된 경우 실행
}

// 또는 하드웨어 플래그 완료 대기 폴링 (예: 수신 또는 변환 완료 대기):
while (!(${reg} & (${activeBitNames[0]?.name ? `(1 << ${activeBitNames[0].name})` : '0x01'})));`,

      bv: `// [AVR-libc _BV() 매크로 형식]: #include <avr/sfr_defs.h> (_BV(x) == (1 << (x)))
${reg} = ${bvExpr};`
    };
  }, [currentRegister.name, symbolicShiftExpression, bvMacroExpression, hexString, binaryString, activeBitNames]);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wide uppercase mb-2">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            C-Code Bit Manipulation Assistant & Macro Solver
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-3">
            비트 조작 어시스턴트 (Bit Manipulation Assistant)
            <span className="text-xs font-mono font-normal text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-700/50">
              Clean Code • Zero-Cost Abstraction
            </span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            SFR 레지스터의 비트를 클릭하여 마스크를 시각적으로 조합하고, 매직 넘버(<code className="text-rose-400 font-mono">0x87</code> 등) 대신 가독성과 이식성이 뛰어난 <code className="text-amber-400 font-mono">(1 &lt;&lt; BIT)</code> C 매크로 표현식을 즉시 계산하여 안전한 펌웨어 코드를 작성하세요.
          </p>
        </div>

        {/* Selected Register Badge & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <div className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-right">
            <div className="text-[10px] text-slate-500 uppercase font-mono font-bold">타겟 레지스터</div>
            <div className="font-mono text-base font-black text-amber-400 flex items-center gap-1.5 justify-end">
              <span>{currentRegister.name}</span>
              <span className="text-xs text-slate-500 font-normal">({currentRegister.addr})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Register Selection & Search Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="레지스터 또는 비트명 검색 (예: ADCSRA, ADEN, TCCR1A)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        <div className="md:col-span-4 flex items-center gap-2">
          <span className="text-xs text-slate-400 shrink-0 font-medium">분류:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition cursor-pointer"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3 flex items-center gap-2">
          <span className="text-xs text-slate-400 shrink-0 font-medium">레지스터:</span>
          <select
            value={selectedRegName}
            onChange={(e) => setSelectedRegName(e.target.value)}
            className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-amber-500/40 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-400 transition cursor-pointer"
          >
            {filteredRegisters.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name} ({r.addr}) - {r.categoryLabel.split(' ')[0]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Register Meta Info & Batch Operations Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-slate-400 font-mono font-bold text-amber-400">{currentRegister.name}:</span>
          <span className="truncate max-w-xl">{currentRegister.desc}</span>
        </div>

        {/* Batch Bit Actions */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            onClick={handleSelectAll}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
          >
            전체 1 (0xFF)
          </button>
          <button
            onClick={handleClearAll}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
          >
            전체 0 (0x00)
          </button>
          <button
            onClick={handleInvertAll}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
          >
            비트 반전 (~)
          </button>
          <button
            onClick={handleResetToDefault}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 transition flex items-center gap-1"
            title="리셋 시 초기값 복원"
          >
            <RotateCcw className="w-3 h-3" />
            리셋 기본값
          </button>
        </div>
      </div>

      {/* 8-Bit Interactive Manipulation Grid (Bit 7 down to Bit 0) */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs font-bold text-slate-400 px-1">
          <span className="flex items-center gap-1.5 text-white">
            <Sliders className="w-4 h-4 text-amber-400" />
            8비트 SFR 레지스터 비트 토글 스위치 (Bit 7 MSB → Bit 0 LSB)
          </span>
          <span className="font-mono text-slate-500">클릭하여 비트를 켜거나 끄세요</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {Array.from({ length: 8 }, (_, i) => {
            const bitNum = 7 - i; // Bit 7 down to Bit 0
            const isBitSet = selectedBits[bitNum];
            const bitDef = currentRegister.bits.find((b) => b.bit === bitNum) || {
              bit: bitNum,
              name: `BIT${bitNum}`,
              rw: 'R/W' as const,
              reset: 0,
              desc: `Bit ${bitNum} 기능`,
              onMeaning: '활성화 (1)',
              offMeaning: '비활성화 (0)'
            };

            return (
              <div
                key={bitNum}
                onClick={() => handleToggleBit(bitNum)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none relative overflow-hidden group ${
                  isBitSet
                    ? 'bg-gradient-to-b from-amber-500/20 to-amber-600/10 border-amber-500 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/40'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                {/* Top: Bit Number & R/W Badge */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-slate-400 font-bold">
                    Bit {bitNum}
                  </span>
                  <span
                    className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                      bitDef.rw === 'R'
                        ? 'bg-slate-800 text-slate-400'
                        : bitDef.rw === 'W'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/40'
                        : 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/40'
                    }`}
                  >
                    {bitDef.rw}
                  </span>
                </div>

                {/* Middle: Big Bit Name & State Indicator */}
                <div className="my-2 text-center">
                  <div
                    className={`font-mono font-black text-sm tracking-tight truncate ${
                      isBitSet ? 'text-amber-300' : 'text-slate-300 group-hover:text-white'
                    }`}
                    title={bitDef.name}
                  >
                    {bitDef.name}
                  </div>
                  <div
                    className={`text-xl font-mono font-black my-1 transition-transform group-hover:scale-110 ${
                      isBitSet ? 'text-amber-400' : 'text-slate-600'
                    }`}
                  >
                    {isBitSet ? '1' : '0'}
                  </div>
                  <div
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                      isBitSet ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {isBitSet ? 'SET' : 'CLR'}
                  </div>
                </div>

                {/* Bottom: Bit Description Tooltip text */}
                <div className="pt-2 border-t border-slate-800/60 text-[10px] text-slate-400 truncate text-center">
                  {isBitSet ? bitDef.onMeaning : bitDef.offMeaning}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Calculated Real-time Values Dashboard (Hex, Binary, C-Expression) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Hexadecimal & Decimal Value */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
            <span>계산된 16진수 마스크 (Hex)</span>
            <span className="text-[10px] font-mono text-slate-500">10진수: {calculatedHexValue}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-2xl font-black text-amber-400">{hexString}</span>
            <button
              onClick={() => handleCopy(hexString, 'hex')}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono transition"
            >
              {copiedKey === 'hex' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey === 'hex' ? '복사됨' : '복사'}
            </button>
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-2">
            가중치: {activeBitNames.map((b) => `0x${(1 << b.bit).toString(16).toUpperCase().padStart(2, '0')}`).join(' + ') || '0x00'}
          </div>
        </div>

        {/* Card 2: Binary Bit Pattern */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
            <span>2진수 비트 패턴 (Binary)</span>
            <span className="text-[10px] font-mono text-amber-400">{activeBitNames.length}개 비트 활성</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-2xl font-black text-cyan-400 tracking-wider">
              {binaryString}
            </span>
            <button
              onClick={() => handleCopy(binaryString, 'bin')}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono transition"
            >
              {copiedKey === 'bin' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey === 'bin' ? '복사됨' : '복사'}
            </button>
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-2">
            MSB [7..4]: {binaryString.slice(2, 6)} | LSB [3..0]: {binaryString.slice(6, 10)}
          </div>
        </div>

        {/* Card 3: Symbolic Shift Expression */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
            <span>클린 C 심볼릭 시프트 마스크</span>
            <span className="text-[10px] font-mono text-emerald-400">Self-documenting</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="font-mono text-xs font-bold text-emerald-400 truncate max-w-[200px]">
              {symbolicShiftExpression}
            </div>
            <button
              onClick={() => handleCopy(symbolicShiftExpression, 'sym')}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono transition shrink-0 ml-2"
            >
              {copiedKey === 'sym' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey === 'sym' ? '복사됨' : '복사'}
            </button>
          </div>
          <div className="text-[11px] font-mono text-slate-500 mt-2">
            avr-gcc 최적화로 런타임 연산 오버헤드 0 (LDI 1사이클)
          </div>
        </div>
      </div>

      {/* C Code Generation by Operation Mode */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Terminal className="w-4 h-4 text-amber-400" />
            C 코드 비트 연산자별 표준 구현 패턴 (Click to switch pattern)
          </div>

          {/* Operation Mode Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setOperationMode('assign')}
              className={`px-2.5 py-1 rounded-lg transition font-bold ${
                operationMode === 'assign' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              할당 (=)
            </button>
            <button
              onClick={() => setOperationMode('set')}
              className={`px-2.5 py-1 rounded-lg transition font-bold ${
                operationMode === 'set' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              세트 (|=)
            </button>
            <button
              onClick={() => setOperationMode('clear')}
              className={`px-2.5 py-1 rounded-lg transition font-bold ${
                operationMode === 'clear' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              클리어 (&= ~)
            </button>
            <button
              onClick={() => setOperationMode('toggle')}
              className={`px-2.5 py-1 rounded-lg transition font-bold ${
                operationMode === 'toggle' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              토글 (^=)
            </button>
            <button
              onClick={() => setOperationMode('test')}
              className={`px-2.5 py-1 rounded-lg transition font-bold ${
                operationMode === 'test' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              검사/폴링 (&)
            </button>
            <button
              onClick={() => setOperationMode('bv')}
              className={`px-2.5 py-1 rounded-lg transition font-bold ${
                operationMode === 'bv' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              _BV() 매크로
            </button>
          </div>
        </div>

        {/* Code Snippet Box with Copy Button */}
        <div className="relative">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="text-slate-400 font-mono">
              타겟: <strong className="text-white">{currentRegister.name}</strong> • 연산: <strong className="text-amber-400">{operationMode.toUpperCase()}</strong>
            </span>
            <button
              onClick={() => handleCopy(generatedCodeSnippets[operationMode], `snippet_${operationMode}`)}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold transition flex items-center gap-1.5 border border-amber-500/40 text-xs"
            >
              {copiedKey === `snippet_${operationMode}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey === `snippet_${operationMode}` ? '코드 복사 완료!' : 'C 코드 복사'}
            </button>
          </div>

          <pre className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-48 custom-scrollbar">
            {generatedCodeSnippets[operationMode]}
          </pre>
        </div>
      </div>

      {/* Clean Code Principles & Anti-Pattern Warnings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 font-bold text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            왜 매직 넘버 대신 (1 &lt;&lt; BIT)를 써야 하는가? (Clean Code)
          </div>
          <p className="text-slate-300 leading-relaxed">
            <code className="text-rose-400 font-mono">ADCSRA = 0x87;</code>처럼 16진수 숫자를 직접 쓰면 동료 개발자가 데이터시트를 일일이 뒤져보기 전까지 무슨 비트가 설정되었는지 전혀 알 수 없습니다.
          </p>
          <p className="text-slate-400 leading-relaxed">
            반면 <code className="text-amber-300 font-mono">(1 &lt;&lt; ADEN) | (1 &lt;&lt; ADPS2)</code>로 작성하면 코드 자체가 명확한 문서 역할을 하며, avr-gcc 컴파일러가 컴파일 타임에 동일한 <code className="text-emerald-400 font-mono">ldi r24, 0x87</code> 명령어로 최적화하므로 런타임 속도 저하나 코드 크기 증가가 전혀 발생하지 않습니다.
          </p>
        </div>

        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            다중 비트 클리어 연산자 우선순위 함정 주의
          </div>
          <p className="text-slate-300 leading-relaxed">
            여러 비트를 동시에 클리어할 때 가장 흔히 범하는 실수는 괄호를 빠뜨리는 것입니다:
          </p>
          <div className="bg-slate-900 p-2 rounded border border-slate-800 font-mono text-[11px] space-y-1">
            <div className="text-rose-400">❌ REG &= ~ (1 &lt;&lt; A) | (1 &lt;&lt; B); // 연산자 우선순위로 버그 발생!</div>
            <div className="text-emerald-400">✅ REG &= ~((1 &lt;&lt; A) | (1 &lt;&lt; B)); // 올바른 괄호 묶음</div>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            C 언어에서 비트 NOT(<code className="text-amber-300">~</code>)은 비트 OR(<code className="text-amber-300">|</code>)보다 우선순위가 훨씬 높기 때문에 괄호가 없으면 의도치 않게 모든 비트가 1로 뒤바뀔 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
};
