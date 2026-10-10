import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Cpu, ArrowRight, CornerDownLeft, Sliders, ExternalLink } from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { REGISTER_DATABASE, RegisterDefinition, BitInfo } from './RegisterStatusDashboard';

export interface SearchResultItem {
  type: 'register' | 'bit';
  registerName: string;
  registerDesc: string;
  category: string;
  categoryLabel: string;
  bitName?: string;
  bitIndex?: number;
  bitDesc?: string;
  mcuSupport?: SupportedMCU[];
}

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU: (mcu: SupportedMCU) => void;
  onNavigateToRegister: (registerName: string, bitName?: string) => void;
}

export const GlobalRegisterSearch: React.FC<Props> = ({
  selectedMCU,
  onSelectMCU,
  onNavigateToRegister
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter results
  const searchResults = useMemo<SearchResultItem[]>(() => {
    const q = query.trim().toUpperCase();
    if (!q || q.length < 2) return [];

    const results: SearchResultItem[] = [];

    REGISTER_DATABASE.forEach((reg) => {
      const regMatches = reg.name.toUpperCase().includes(q) || reg.desc.toUpperCase().includes(q);
      
      // Check bits
      const matchedBits: BitInfo[] = [];
      reg.bits.forEach((b) => {
        if (b.name.toUpperCase().includes(q) || b.desc.toUpperCase().includes(q)) {
          matchedBits.push(b);
        }
      });

      if (regMatches) {
        results.push({
          type: 'register',
          registerName: reg.name,
          registerDesc: reg.desc,
          category: reg.category,
          categoryLabel: reg.categoryLabel,
          mcuSupport: reg.mcuSupport
        });
      }

      matchedBits.forEach((b) => {
        // Avoid duplicate if register already added and bit is identical name
        results.push({
          type: 'bit',
          registerName: reg.name,
          registerDesc: reg.desc,
          category: reg.category,
          categoryLabel: reg.categoryLabel,
          bitName: b.name,
          bitIndex: b.bit,
          bitDesc: b.desc,
          mcuSupport: reg.mcuSupport
        });
      });
    });

    // Sort: exact matches first, then startsWith, then includes
    return results.slice(0, 15);
  }, [query]);

  // Handle keyboard navigation inside dropdown
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, searchResults.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + Math.max(1, searchResults.length)) % Math.max(1, searchResults.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0 && searchResults[selectedIndex]) {
        handleSelectItem(searchResults[selectedIndex]);
      }
    }
  };

  const handleSelectItem = (item: SearchResultItem) => {
    // Check if target requires switching MCU
    if (item.mcuSupport && !item.mcuSupport.includes(selectedMCU)) {
      onSelectMCU(item.mcuSupport[0]);
    }
    onNavigateToRegister(item.registerName, item.bitName);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xs md:max-w-sm">
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder="레지스터 / 비트 검색 (예: ADCSRA, TXEN0)..."
          className="w-full pl-9 pr-16 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition shadow-inner"
        />
        {query ? (
          <button
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-2 p-1 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="absolute right-2.5 hidden sm:flex items-center gap-0.5 text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
            <span>⌘K</span>
          </div>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 max-h-96 flex flex-col">
          <div className="px-3 py-2 bg-slate-950/60 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>검색 결과: <strong className="text-amber-400">{searchResults.length}건</strong></span>
            <span className="text-[10px] text-slate-400">↑↓ 이동, Enter 선택</span>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar flex-1">
            {searchResults.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                '{query}' 에 해당하는 레지스터나 비트필드가 없습니다.
              </div>
            ) : (
              searchResults.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const isSupported = !item.mcuSupport || item.mcuSupport.includes(selectedMCU);

                return (
                  <button
                    key={`${item.type}-${item.registerName}-${item.bitName ?? ''}-${idx}`}
                    onClick={() => handleSelectItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full text-left px-3.5 py-2.5 flex items-start gap-3 transition-colors ${
                      isSelected ? 'bg-amber-500/15 text-white' : 'hover:bg-slate-800/50 text-slate-200'
                    }`}
                  >
                    <div className="mt-0.5">
                      {item.type === 'register' ? (
                        <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-[10px] font-bold font-mono">
                          REG
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 text-[10px] font-bold font-mono">
                          BIT
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-white">
                          {item.type === 'bit' ? (
                            <>
                              <span className="text-amber-300 font-extrabold">{item.bitName}</span>
                              <span className="text-slate-400 font-normal text-[11px] ml-1">
                                in {item.registerName} [b{item.bitIndex}]
                              </span>
                            </>
                          ) : (
                            <span className="text-amber-400">{item.registerName}</span>
                          )}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {item.categoryLabel}
                        </span>
                        {!isSupported && item.mcuSupport && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800 font-mono">
                            {item.mcuSupport.map(m => MCU_PROFILES[m].name).join(', ')} 전용
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {item.type === 'bit' ? item.bitDesc : item.registerDesc}
                      </p>
                    </div>

                    <div className="self-center flex items-center text-slate-400">
                      <CornerDownLeft className="w-3.5 h-3.5 opacity-60" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
