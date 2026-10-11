import React, { useState, useMemo, useEffect } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { getVectorTableByMCU, InterruptVector } from '../data/interruptVectorsData';
import {
  Bell,
  Check,
  Copy,
  Download,
  Filter,
  Sparkles,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  Code2,
  FileCode2,
  RotateCcw,
  Search,
  Zap,
  Cpu,
  Layers,
  ArrowUpDown,
  AlertTriangle,
  Info,
  CheckCircle2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type IsrMode = 'standard' | 'noblock' | 'empty' | 'naked';

export interface SelectedVectorConfig {
  mode: IsrMode;
  userComment: string;
}

export const InterruptVectorTableGenerator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const allVectors = useMemo(() => getVectorTableByMCU(selectedMCU), [selectedMCU]);

  // Selected Vectors Map: vectorName -> config
  const [selectedVectors, setSelectedVectors] = useState<Record<string, SelectedVectorConfig>>(() => {
    // Default selection: Timer0 overflow & USART0 RX
    const init: Record<string, SelectedVectorConfig> = {};
    if (selectedMCU === 'atmega328p') {
      init['TIMER0_OVF_vect'] = { mode: 'standard', userComment: '1ms 타이머 틱(Tick) 카운터 증가' };
      init['USART_RX_vect'] = { mode: 'standard', userComment: '시리얼 링버퍼(Ring Buffer) 바이트 수신' };
    } else if (selectedMCU === 'atmega128') {
      init['TIMER0_OVF_vect'] = { mode: 'standard', userComment: '1ms 시스템 틱 생성' };
      init['USART0_RX_vect'] = { mode: 'standard', userComment: 'USART0 수신 데이터 링버퍼 삽입' };
      init['INT0_vect'] = { mode: 'standard', userComment: '외부 비상 정지 버튼 에지 감지' };
    } else {
      init['TIMER0_OVF_vect'] = { mode: 'standard', userComment: '시스템 밀리초 타이머 틱' };
      init['USART0_RX_vect'] = { mode: 'standard', userComment: 'USART0 시리얼 패킷 수신' };
      init['INT0_vect'] = { mode: 'standard', userComment: '외부 센서 트리거 신호 감지' };
    }
    return init;
  });

  // Re-sync defaults when selectedMCU changes
  useEffect(() => {
    const next: Record<string, SelectedVectorConfig> = {};
    if (selectedMCU === 'atmega328p') {
      next['TIMER0_OVF_vect'] = { mode: 'standard', userComment: '1ms 시스템 틱 카운터' };
      next['USART_RX_vect'] = { mode: 'standard', userComment: 'USART0 시리얼 링버퍼 수신' };
    } else if (selectedMCU === 'atmega128') {
      next['TIMER0_OVF_vect'] = { mode: 'standard', userComment: '1ms 시스템 틱 생성' };
      next['USART0_RX_vect'] = { mode: 'standard', userComment: 'USART0 링버퍼 수신' };
      next['INT0_vect'] = { mode: 'standard', userComment: '외부 비상 인터럽트 감지' };
    } else {
      next['TIMER0_OVF_vect'] = { mode: 'standard', userComment: '1ms 시스템 타이머 틱' };
      next['USART0_RX_vect'] = { mode: 'standard', userComment: 'USART0 패킷 수신' };
      next['INT0_vect'] = { mode: 'standard', userComment: '외부 인터럽트 0 감지' };
    }
    setSelectedVectors(next);
  }, [selectedMCU]);

  // Options State
  const [includeBadIsr, setIncludeBadIsr] = useState<boolean>(true);
  const [includeInitFunc, setIncludeInitFunc] = useState<boolean>(true);
  const [enableGlobalSei, setEnableGlobalSei] = useState<boolean>(true);
  const [relocateBootloader, setRelocateBootloader] = useState<boolean>(false); // IVSEL bit
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'visual_table' | 'code_preview' | 'priority_guide'>('visual_table');

  const categories = [
    { id: 'all', label: '전체 벡터' },
    { id: 'external', label: '외부/핀체인지' },
    { id: 'timer', label: '타이머/카운터' },
    { id: 'comm', label: '통신(USART/SPI/TWI)' },
    { id: 'analog', label: '아날로그(ADC/비교기)' },
    { id: 'system', label: '시스템/리셋' },
    { id: 'eeprom', label: 'EEPROM/기타' }
  ];

  // Filtered vectors for visualization
  const filteredVectors = useMemo(() => {
    return allVectors.filter((v) => {
      const matchCat = filterCategory === 'all' || v.category === filterCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        v.vectorName.toLowerCase().includes(q) ||
        v.sourceName.toLowerCase().includes(q) ||
        v.programAddress.toLowerCase().includes(q) ||
        v.enableRegister.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [allVectors, filterCategory, searchQuery]);

  // Vector Toggle Handler
  const toggleVector = (vectorName: string, defaultComment: string = '사용자 인터럽트 루틴') => {
    setSelectedVectors((prev) => {
      const next = { ...prev };
      if (next[vectorName]) {
        delete next[vectorName];
      } else {
        next[vectorName] = {
          mode: 'standard',
          userComment: defaultComment
        };
      }
      return next;
    });
  };

  const updateVectorMode = (vectorName: string, mode: IsrMode) => {
    setSelectedVectors((prev) => {
      if (!prev[vectorName]) return prev;
      return {
        ...prev,
        [vectorName]: {
          ...prev[vectorName],
          mode
        }
      };
    });
  };

  // Presets
  const applyPreset = (preset: 'timer_uart' | 'sensors_external' | 'lowpower_wdt' | 'all_comm') => {
    const next: Record<string, SelectedVectorConfig> = {};
    if (preset === 'timer_uart') {
      next['TIMER0_OVF_vect'] = { mode: 'standard', userComment: '1ms 시스템 틱 카운터 증가' };
      const uartRx = allVectors.find((v) => v.vectorName.includes('USART') && v.vectorName.includes('RX'));
      if (uartRx) next[uartRx.vectorName] = { mode: 'standard', userComment: '시리얼 바이트 링버퍼 수신' };
    } else if (preset === 'sensors_external') {
      const int0 = allVectors.find((v) => v.vectorName === 'INT0_vect');
      if (int0) next['INT0_vect'] = { mode: 'standard', userComment: '외부 엔코더 / 비상 센서 에지 감지' };
      const adc = allVectors.find((v) => v.vectorName === 'ADC_vect');
      if (adc) next['ADC_vect'] = { mode: 'standard', userComment: 'ADC 10비트 변환 완료 데이터 처리' };
    } else if (preset === 'lowpower_wdt') {
      const wdt = allVectors.find((v) => v.vectorName === 'WDT_vect');
      if (wdt) next['WDT_vect'] = { mode: 'standard', userComment: '워치독 타이머 저전력 슬립 주기 웨이크업' };
      const pcint = allVectors.find((v) => v.vectorName.includes('PCINT0'));
      if (pcint) next[pcint.vectorName] = { mode: 'standard', userComment: '스위치 입력 핀체인지 웨이크업' };
    } else if (preset === 'all_comm') {
      allVectors
        .filter((v) => v.category === 'comm')
        .forEach((v) => {
          next[v.vectorName] = { mode: 'standard', userComment: `${v.sourceName} 핸들러` };
        });
    }
    setSelectedVectors(next);
  };

  // Generate C Code Template
  const generatedCSource = useMemo(() => {
    const activeNames = Object.keys(selectedVectors);
    const mcuHeader = selectedMCU === 'atmega640' ? 'iom640.h' : selectedMCU === 'atmega128' ? 'iom128.h' : 'iom328p.h';

    let code = `/**\n`;
    code += ` * =============================================================================\n`;
    code += ` * @file    interrupt_handlers.c\n`;
    code += ` * @target  ${currentProfile.name} (Flash: ${currentProfile.flash}KB, SRAM: ${currentProfile.sram}KB)\n`;
    code += ` * @brief   AVR 인터럽트 벡터 테이블 및 ISR(Interrupt Service Routine) 템플릿\n`;
    code += ` * @details 자동 생성된 최적화 인터럽트 벡터 핸들러 및 하드웨어 초기화 코드\n`;
    code += ` * =============================================================================\n`;
    code += ` */\n\n`;

    code += `#include <avr/io.h>\n`;
    code += `#include <avr/interrupt.h>\n`;
    code += `#include <stdbool.h>\n`;
    code += `#include <stdint.h>\n\n`;

    // Global Volatile Flags & Counters
    code += `/* =============================================================================\n`;
    code += ` * 1. 인터럽트 공유 전역 변수 (반드시 volatile 수식어 명시 필수)\n`;
    code += ` * ============================================================================= */\n`;
    code += `volatile uint32_t g_system_tick_ms = 0;   // 1ms 시스템 밀리초 틱\n`;
    code += `volatile bool     g_event_pending  = false; // 인터럽트 이벤트 수신 플래그\n\n`;

    // ISR Declarations
    code += `/* =============================================================================\n`;
    code += ` * 2. 인터럽트 서비스 루틴 (ISR) 정의\n`;
    code += ` *    - 총 ${activeNames.length}개 벡터 활성화\n`;
    code += ` * ============================================================================= */\n\n`;

    if (activeNames.length === 0) {
      code += `// [알림] 현재 선택된 ISR이 없습니다. 상단 벡터 테이블에서 인터럽트를 체크하세요.\n\n`;
    }

    activeNames.forEach((vecName) => {
      const vecObj = allVectors.find((v) => v.vectorName === vecName);
      const conf = selectedVectors[vecName];
      const comment = conf?.userComment || vecObj?.description || '인터럽트 처리 루틴';
      const mode = conf?.mode || 'standard';

      code += `/**\n`;
      code += ` * @brief  ${vecObj ? `${vecObj.sourceName} (${vecObj.programAddress})` : vecName}\n`;
      code += ` * @addr   ${vecObj?.programAddress || 'N/A'}, 우선순위: #${vecObj?.vectorNum || 'N/A'}\n`;
      code += ` * @reg    활성화: ${vecObj?.enableRegister || 'N/A'}, 플래그: ${vecObj?.flagRegister || 'N/A'}\n`;
      code += ` */\n`;

      if (mode === 'standard') {
        code += `ISR(${vecName}) {\n`;
        code += `    // ${comment}\n`;
        if (vecName.includes('TIMER0_OVF')) {
          code += `    g_system_tick_ms++;\n`;
        } else if (vecName.includes('RX')) {
          code += `    // uint8_t rx_data = UDR0; // UDR 레지스터 읽기로 플래그 자동 클리어\n`;
        } else {
          code += `    g_event_pending = true;\n`;
        }
        code += `}\n\n`;
      } else if (mode === 'noblock') {
        code += `// ISR_NOBLOCK: 중첩 인터럽트(Nested Interrupt) 허용 (진입 즉시 sei() 실행)\n`;
        code += `ISR(${vecName}, ISR_NOBLOCK) {\n`;
        code += `    // ${comment} (고우선순위 인터럽트 선점 가능)\n`;
        code += `}\n\n`;
      } else if (mode === 'empty') {
        code += `// EMPTY_INTERRUPT: 플래그 클리어 및 슬립 웨이크업용 빈 핸들러 (코드 크기 극소화)\n`;
        code += `EMPTY_INTERRUPT(${vecName});\n\n`;
      } else if (mode === 'naked') {
        code += `// ISR_NAKED: 컴파일러의 레지스터 Push/Pop 프롤로그/에필로그 생략 (RTOS 컨텍스트 스위칭 전용)\n`;
        code += `ISR(${vecName}, ISR_NAKED) {\n`;
        code += `    // 주의: 어셈블리로 레지스터를 직접 백업/복원하고 reti를 수동 호출해야 합니다.\n`;
        code += `    __asm__ __volatile__("reti");\n`;
        code += `}\n\n`;
      }
    });

    // BADISR Catch-all safety trap
    if (includeBadIsr) {
      code += `/**\n`;
      code += ` * @brief  예외 처리: 등록되지 않은 예기치 못한 인터럽트 안전 포획 (Safety Trap)\n`;
      code += ` * @note   부유 노이즈 등으로 허위 인터럽트 발생 시 MCU가 0x0000(리셋)으로 재부팅되는 현상 방지\n`;
      code += ` */\n`;
      code += `ISR(BADISR_vect) {\n`;
      code += `    // 정의되지 않은 인터럽트 감지 - 페일세이프(Fail-Safe) 조치 또는 로그 기록\n`;
      code += `    // while (1); // 또는 안전 상태로 전환 후 워치독 리셋 유도\n`;
      code += `}\n\n`;
    }

    // Hardware Initialization Function
    if (includeInitFunc) {
      code += `/* =============================================================================\n`;
      code += ` * 3. 인터럽트 하드웨어 레지스터 초기화 함수\n`;
      code += ` * ============================================================================= */\n`;
      code += `void interrupt_system_init(void) {\n`;
      code += `    // 1. 초기화 중 안전을 위해 전역 인터럽트 임시 비활성화\n`;
      code += `    cli();\n\n`;

      if (relocateBootloader) {
        code += `    // [IVSEL] 인터럽트 벡터 테이블을 부트로더 섹션 시작 주소로 재배치\n`;
        code += `    MCUCR = (1 << IVCE);              // 4사이클 이내에 변경 활성화\n`;
        code += `    MCUCR = (1 << IVSEL);             // 부트로더 섹션으로 벡터 이동\n\n`;
      }

      code += `    // 2. 선택된 개별 인터럽트 소스 마스크 레지스터 활성화\n`;
      activeNames.forEach((vecName) => {
        const v = allVectors.find((item) => item.vectorName === vecName);
        if (v && v.enableRegister && !v.enableRegister.includes('상시')) {
          code += `    // ${v.sourceName}: ${v.enableRegister}\n`;
        }
      });

      if (activeNames.some((v) => v.includes('TIMER0'))) {
        code += `    // Timer0 Prescaler 64 설정 & 오버플로우 인터럽트 인에이블\n`;
        code += `    TCCR0B |= (1 << CS01) | (1 << CS00);\n`;
        code += `    TIMSK0 |= (1 << TOIE0);\n\n`;
      }

      if (enableGlobalSei) {
        code += `    // 3. 전역 인터럽트 활성화 (SREG I 비트 = 1)\n`;
        code += `    sei();\n`;
      }
      code += `}\n`;
    }

    return code;
  }, [
    selectedMCU,
    selectedVectors,
    allVectors,
    includeBadIsr,
    includeInitFunc,
    enableGlobalSei,
    relocateBootloader,
    currentProfile
  ]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCSource);
    setCopiedCode(true);
    confetti({
      particleCount: 30,
      spread: 60,
      origin: { y: 0.7 }
    });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([generatedCSource], { type: 'text/x-csrc;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `interrupt_${selectedMCU}.c`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedCount = Object.keys(selectedVectors).length;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur shadow-2xl space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
              <Bell className="w-3.5 h-3.5" /> 인터럽트 벡터 테이블 생성기
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono font-bold">
              Target: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-mono">
              하드웨어 우선순위: 1번 ~ {allVectors.length}번
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-mono font-bold">
              {selectedCount}개 벡터 선택됨
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            AVR 인터럽트 벡터 테이블 & ISR 코드 생성기
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {currentProfile.name}의 플래시 메모리 인터럽트 벡터 주소를 기반으로, 하드웨어 우선순위 구조를 분석하고 
            중첩 인터럽트(<code>ISR_NOBLOCK</code>), BADISR 안전 트랩 및 하드웨어 초기화 C 소스코드를 원클릭으로 생성합니다.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto">
          <button
            onClick={handleCopyCode}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-lg shadow-rose-600/20"
          >
            {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedCode ? '복사 완료!' : 'ISR 코드 복사'}</span>
          </button>
          <button
            onClick={handleDownloadFile}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition border border-slate-700"
          >
            <Download className="w-4 h-4 text-rose-400" />
            <span>.c 파일 저장</span>
          </button>
        </div>
      </div>

      {/* Preset Quick Toolbar */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-white">추천 인터럽트 세트 프리셋:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => applyPreset('timer_uart')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-rose-500 text-slate-300 hover:text-white transition font-mono"
            title="시스템 타이머 틱 및 USART 수신 링버퍼"
          >
            ⏱️ 1ms 타이머 + USART 링버퍼
          </button>
          <button
            onClick={() => applyPreset('sensors_external')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-500 text-slate-300 hover:text-white transition font-mono"
            title="외부 엔코더 INT0 및 ADC 변환 완료 인터럽트"
          >
            ⚡ 외부 센서(INT0) + ADC 완료
          </button>
          <button
            onClick={() => applyPreset('lowpower_wdt')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500 text-slate-300 hover:text-white transition font-mono"
            title="워치독 타이머 및 핀체인지 슬립 웨이크업"
          >
            🌙 저전력 슬립(WDT + PCINT)
          </button>
          <button
            onClick={() => applyPreset('all_comm')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-white transition font-mono"
            title="USART, SPI, TWI 모든 통신 인터럽트"
          >
            📡 통신 인터페이스 종합(USART/SPI/TWI)
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setActiveTab('visual_table')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeTab === 'visual_table'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            인터럽트 벡터 시각화 & 선택 ({selectedCount}/{allVectors.length})
          </button>
          <button
            onClick={() => setActiveTab('code_preview')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeTab === 'code_preview'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            생성된 C 언어 ISR 템플릿 코드
          </button>
          <button
            onClick={() => setActiveTab('priority_guide')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeTab === 'priority_guide'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            우선순위 & 중첩(Nested) 규칙 가이드
          </button>
        </div>

        {/* Global Options Toggles */}
        <div className="hidden md:flex items-center gap-4 text-xs font-mono text-slate-300">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeBadIsr}
              onChange={(e) => setIncludeBadIsr(e.target.checked)}
              className="accent-rose-500 rounded"
            />
            <span>BADISR 안전 트랩 포함</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={enableGlobalSei}
              onChange={(e) => setEnableGlobalSei(e.target.checked)}
              className="accent-rose-500 rounded"
            />
            <span>전역 sei() 활성화</span>
          </label>
        </div>
      </div>

      {/* Tab 1: Visual Vector Table */}
      {activeTab === 'visual_table' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
                <Filter className="w-3.5 h-3.5 text-amber-400" /> 카테고리:
              </span>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFilterCategory(cat.id)}
                  className={`px-2.5 py-1 text-[11px] rounded-lg transition border ${
                    filterCategory === cat.id
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="벡터명, 주소(0x0002), 레지스터 검색..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 font-mono"
              />
            </div>
          </div>

          {/* Vectors Grid List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto custom-scrollbar pr-1">
            {filteredVectors.map((vec) => {
              const isSelected = !!selectedVectors[vec.vectorName];
              const conf = selectedVectors[vec.vectorName];
              const isReset = vec.vectorNum === 1;

              return (
                <div
                  key={vec.vectorName}
                  className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                    isSelected
                      ? 'bg-rose-950/30 border-rose-500/60 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/40'
                      : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                        #{vec.vectorNum}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-white">
                            {vec.vectorName}
                          </span>
                          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40">
                            {vec.programAddress}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 font-medium">
                          {vec.sourceName}
                        </div>
                      </div>
                    </div>

                    {!isReset ? (
                      <button
                        onClick={() => toggleVector(vec.vectorName, `${vec.sourceName} 핸들러`)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 ${
                          isSelected
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {isSelected ? <Check className="w-3.5 h-3.5" /> : null}
                        <span>{isSelected ? '선택됨' : '추가'}</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40 font-mono">
                        시스템 리셋 (고정)
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {vec.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
                    <div>
                      <span className="text-slate-500 block">활성화 레지스터:</span>
                      <span className="text-emerald-400 truncate block font-bold">{vec.enableRegister}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">인터럽트 플래그:</span>
                      <span className="text-amber-400 truncate block font-bold">{vec.flagRegister}</span>
                    </div>
                  </div>

                  {/* Mode Selector for Selected Vector */}
                  {isSelected && !isReset && (
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-400 text-[10px] font-mono">동작 모드:</span>
                      <div className="flex items-center gap-1 font-mono text-[10px]">
                        <button
                          onClick={() => updateVectorMode(vec.vectorName, 'standard')}
                          className={`px-2 py-0.5 rounded transition ${
                            conf?.mode === 'standard' ? 'bg-rose-500 text-white font-bold' : 'text-slate-400 bg-slate-900'
                          }`}
                        >
                          기본 (원자적)
                        </button>
                        <button
                          onClick={() => updateVectorMode(vec.vectorName, 'noblock')}
                          className={`px-2 py-0.5 rounded transition ${
                            conf?.mode === 'noblock' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 bg-slate-900'
                          }`}
                          title="중첩 인터럽트 허용 (ISR_NOBLOCK)"
                        >
                          중첩(NOBLOCK)
                        </button>
                        <button
                          onClick={() => updateVectorMode(vec.vectorName, 'empty')}
                          className={`px-2 py-0.5 rounded transition ${
                            conf?.mode === 'empty' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 bg-slate-900'
                          }`}
                          title="슬립 웨이크업용 빈 핸들러"
                        >
                          빈핸들러
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Code Preview */}
      {activeTab === 'code_preview' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-950 p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-4 text-slate-300">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeInitFunc}
                  onChange={(e) => setIncludeInitFunc(e.target.checked)}
                  className="accent-rose-500 rounded"
                />
                <span>초기화 함수(interrupt_system_init) 포함</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={relocateBootloader}
                  onChange={(e) => setRelocateBootloader(e.target.checked)}
                  className="accent-rose-500 rounded"
                />
                <span>부트로더 벡터 재배치(IVSEL) 코드 생성</span>
              </label>
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              파일: <span className="text-white font-bold">interrupt_{selectedMCU}.c</span>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-3.5 h-3.5 text-rose-400" />
                <span>AVR-GCC C99/C11 Interrupt Service Routine Source</span>
              </div>
              <button
                onClick={handleCopyCode}
                className="text-rose-400 hover:text-white flex items-center gap-1 transition"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? '복사됨' : '전체 복사'}</span>
              </button>
            </div>
            <pre className="p-5 font-mono text-xs text-emerald-300 overflow-x-auto max-h-[500px] leading-relaxed custom-scrollbar selection:bg-rose-500/30">
              {generatedCSource}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 3: Priority & Rules Guide */}
      {activeTab === 'priority_guide' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <ArrowUpDown className="w-4 h-4" />
              1. AVR 하드웨어 고정 우선순위 규칙 (Fixed Hardware Priority)
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              AVR 마이크로컨트롤러는 <strong>프로그램 메모리 주소가 낮을수록 높은 우선순위</strong>를 갖는 하드웨어 고정 방식을 채택합니다.
            </p>
            <ul className="space-y-1.5 text-slate-400 font-mono text-[11px] list-disc list-inside">
              <li><strong className="text-white">우선순위 1위:</strong> 0x0000 (RESET)</li>
              <li><strong className="text-white">우선순위 2위:</strong> 0x0002 (INT0 - 외부 인터럽트 0)</li>
              <li><strong className="text-white">우선순위 3위:</strong> 0x0004 (INT1 - 외부 인터럽트 1)</li>
              <li><strong className="text-white">이후 순서:</strong> 타이머(Timer) ➔ 통신(USART/SPI/TWI) ➔ 아날로그(ADC) 순</li>
            </ul>
            <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-amber-300 text-[11px] leading-relaxed">
              💡 두 개 이상의 인터럽트 플래그가 동시에 세트될 경우, 주소가 더 낮은 인터럽트가 먼저 서비스됩니다.
            </div>
          </div>

          <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <Zap className="w-4 h-4" />
              2. 중첩 인터럽트 (Nested Interrupts)와 주의사항
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              기본적으로 AVR은 ISR 진입 시 SREG의 전역 인터럽트 플래그(I-bit)를 하드웨어적으로 자동 클리어(0)하여 다른 인터럽트를 차단합니다.
            </p>
            <div className="space-y-2 text-[11px] text-slate-300">
              <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="font-bold text-rose-300 block mb-0.5">기본 모드 (ISR_BLOCK):</span>
                인터럽트 루틴 실행 중에는 다른 인터럽트가 대기(Pending)하며, 실행이 끝나고 <code>RETI</code> 명령어가 실행된 직후 다음 인터럽트가 처리됩니다.
              </div>
              <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                <span className="font-bold text-amber-300 block mb-0.5">중첩 모드 (ISR_NOBLOCK):</span>
                ISR 함수 진입 즉시 <code>sei()</code>를 실행하여 더 중요한 인터럽트가 현재 루틴을 중단하고 선점(Preemption)할 수 있도록 허용합니다. (스택 오버플로우 위험 주의)
              </div>
            </div>
          </div>

          <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <ShieldCheck className="w-4 h-4" />
              3. BADISR_vect 세이프가드 (Crash 방지 트랩)
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              코드에 정의되지 않은 인터럽트가 외부 노이즈나 잘못된 레지스터 설정으로 인해 트리거되면, 
              기본적으로 프로그램 카운터가 0x0000(리셋 벡터)으로 튕겨나가 <strong>MCU가 갑자기 재부팅</strong>됩니다.
            </p>
            <p className="text-emerald-300 font-mono text-[11px]">
              <code>ISR(BADISR_vect) &#123; /* 안전 트랩 */ &#125;</code>을 정의하면 이러한 비정상적인 인터럽트를 안전하게 포획하여 예기치 못한 시스템 다운을 방지할 수 있습니다.
            </p>
          </div>

          <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <Cpu className="w-4 h-4" />
              4. IVSEL 벡터 테이블 재배치 (MCUCR 레지스터)
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              부트로더(Bootloader)를 구현할 때는 <code>MCUCR</code> 레지스터의 <code>IVSEL</code> 비트를 설정하여, 
              벡터 테이블의 기준 주소를 Flash 시작점(0x0000)에서 부트로더 섹션 시작점으로 옮겨야 부트로더 독립 실행이 가능합니다.
            </p>
            <pre className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 font-mono text-[10px] text-cyan-300">
              MCUCR = (1 &lt;&lt; IVCE); // 4사이클 타임시퀀스 활성화{'\n'}
              MCUCR = (1 &lt;&lt; IVSEL); // 부트로더 섹션으로 벡터 이동
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
