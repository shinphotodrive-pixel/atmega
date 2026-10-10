import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { getVectorTableByMCU, InterruptVector } from '../data/interruptVectorsData';
import { Activity, Bell, Check, Copy, Filter, Hash, Search, ShieldAlert, Terminal } from 'lucide-react';

interface Props {
  selectedMCU: SupportedMCU;
}

export const InterruptVectorTableExplorer: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const vectors = useMemo(() => getVectorTableByMCU(selectedMCU), [selectedMCU]);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedVector, setCopiedVector] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: '전체' },
    { id: 'external', label: '외부/핀체인지' },
    { id: 'timer', label: '타이머/카운터' },
    { id: 'comm', label: '통신(USART/SPI/TWI)' },
    { id: 'analog', label: 'ADC/비교기' },
    { id: 'system', label: '시스템/리셋' },
    { id: 'eeprom', label: 'EEPROM' }
  ];

  const filteredVectors = useMemo(() => {
    return vectors.filter((v) => {
      const matchesCat = selectedCategory === 'all' || v.category === selectedCategory;
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        v.vectorName.toLowerCase().includes(q) ||
        v.sourceName.toLowerCase().includes(q) ||
        v.enableRegister.toLowerCase().includes(q) ||
        v.programAddress.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q);

      return matchesCat && matchesSearch;
    });
  }, [vectors, selectedCategory, searchTerm]);

  const copyIsrSnippet = (vec: InterruptVector) => {
    const isrSnippet = `// ${vec.sourceName} ISR 인터럽트 서비스 루틴
ISR(${vec.vectorName}) {
    // 사용자 인터럽트 처리 코드 작성
    // 플래그는 하드웨어에 의해 자동 클리어됩니다.
}`;
    navigator.clipboard.writeText(isrSnippet);
    setCopiedVector(vec.vectorName);
    setTimeout(() => setCopiedVector(null), 2000);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-lg space-y-6">
      {/* Title & Info Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
              <span>{currentProfile.name} 인터럽트 벡터 테이블(Interrupt Vector Table) 탐색기</span>
              <span className="text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                우선순위 1번 ~ {vectors.length}번
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              플래시 프로그램 메모리 주소 오프셋과 활성화 레지스터 비트 및 ISR 선언 매크로를 확인하세요.
            </p>
          </div>
        </div>

        <span className="text-xs bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 font-mono text-amber-400 font-bold shrink-0">
          전역 활성화: sei() / SREG(I=1)
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-amber-400" /> 소스 필터:
          </span>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 text-[11px] rounded-lg transition-all border ${
                selectedCategory === cat.id
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="인터럽트명 검색 (INT0, USART, TIMER...)"
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Vector Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
            <tr>
              <th className="px-3 py-3 w-16 text-center">우선순위</th>
              <th className="px-3 py-3 w-28">벡터 주소 (Flash)</th>
              <th className="px-4 py-3 w-44">GCC 매크로 (ISR)</th>
              <th className="px-4 py-3">인터럽트 소스 (Source)</th>
              <th className="px-4 py-3">인터럽트 인에이블 (Enable)</th>
              <th className="px-3 py-3">플래그 레지스터</th>
              <th className="px-4 py-3">설명 및 동작 팁</th>
              <th className="px-3 py-3 w-24 text-center">ISR 코드</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredVectors.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-500">
                  검색 조건과 일치하는 인터럽트 벡터가 없습니다.
                </td>
              </tr>
            ) : (
              filteredVectors.map((vec) => {
                const isReset = vec.vectorNum === 1;

                return (
                  <tr key={vec.vectorNum} className="hover:bg-slate-900/60 transition-colors">
                    {/* Priority */}
                    <td className="px-3 py-2.5 text-center font-mono font-bold">
                      <span
                        className={`inline-block w-6 h-6 leading-6 rounded-full text-center text-xs ${
                          isReset
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : vec.vectorNum <= 5
                            ? 'bg-amber-500/10 text-amber-300'
                            : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        {vec.vectorNum}
                      </span>
                    </td>

                    {/* Program Address */}
                    <td className="px-3 py-2.5 font-mono text-cyan-400 font-bold">
                      {vec.programAddress}
                    </td>

                    {/* Vector Name (GCC Macro) */}
                    <td className="px-4 py-2.5 font-mono font-bold text-white">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300">
                        {vec.vectorName}
                      </span>
                    </td>

                    {/* Source Name */}
                    <td className="px-4 py-2.5 font-medium text-slate-200">
                      {vec.sourceName}
                    </td>

                    {/* Enable Register */}
                    <td className="px-4 py-2.5 font-mono text-amber-400 text-[11px]">
                      {vec.enableRegister}
                    </td>

                    {/* Flag Register */}
                    <td className="px-3 py-2.5 font-mono text-slate-400 text-[11px]">
                      {vec.flagRegister}
                    </td>

                    {/* Description */}
                    <td className="px-4 py-2.5 text-slate-300 text-[11px] leading-relaxed">
                      {vec.description}
                    </td>

                    {/* Action: Copy ISR snippet */}
                    <td className="px-3 py-2.5 text-center">
                      {!isReset ? (
                        <button
                          onClick={() => copyIsrSnippet(vec)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 hover:text-white transition border border-slate-700"
                          title="ISR 코드 복사"
                        >
                          {copiedVector === vec.vectorName ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedVector === vec.vectorName ? '복사됨' : 'ISR'}</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono">기본 진입</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Critical Interrupt Safety Guidelines Card */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
        <div className="flex items-center gap-2 text-rose-400 font-bold">
          <ShieldAlert className="w-4 h-4" />
          <span>AVR 인터럽트 설계 시 필수 주의사항 (Bare-metal Rules)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-300 text-[11px] leading-relaxed pt-1">
          <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
            <strong className="text-amber-400 block mb-0.5">1. volatile 키워드 필수</strong>
            ISR 내부에서 값이 변경되고 메인 루프에서 읽는 모든 전역 변수는 컴파일러 레지스터 캐싱 방지를 위해 반드시 <code className="bg-slate-800 px-1 rounded text-white">volatile uint8_t flag;</code>로 선언해야 합니다.
          </div>
          <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
            <strong className="text-cyan-400 block mb-0.5">2. ISR 실행 시간 극소화</strong>
            인터럽트 진입 시 전역 인터럽트 플래그(SREG I-bit)가 하드웨어에 의해 자동 클리어되므로, 긴 딜레이 루프나 복잡한 계산을 넣지 말고 플래그만 세트 후 복귀해야 합니다.
          </div>
          <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
            <strong className="text-emerald-400 block mb-0.5">3. 16비트 변수 원자성 보호</strong>
            메인 루프에서 2바이트 이상(16비트/32비트)의 인터럽트 공유 변수를 읽을 때는 읽기 도중 인터럽트가 끼어들지 못하게 <code className="bg-slate-800 px-1 rounded text-white">ATOMIC_BLOCK</code>으로 감싸야 합니다.
          </div>
        </div>
      </div>
    </div>
  );
};
