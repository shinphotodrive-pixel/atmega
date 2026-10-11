import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Layers,
  Cpu,
  Package,
  FileCode2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Download,
  Info,
  TrendingDown,
  Sparkles,
  Terminal,
  Search,
  ExternalLink,
  Sliders,
  Filter,
  Maximize2,
  ArrowRight,
  Split,
  FolderGit2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type BloatCategory =
  | 'duplicate_object'
  | 'redundant_archive'
  | 'float_printf_bloat'
  | 'dead_code'
  | 'healthy';

export interface ArtifactNode {
  id: string;
  name: string;
  archive: string;
  flashBytes: number;
  sramBytes: number;
  category: BloatCategory;
  duplicateOf?: string;
  symbols: string[];
  reason: string;
  remedy: string;
  remedySavings: number;
}

export interface MapScenario {
  id: string;
  name: string;
  desc: string;
  rawSampleMap: string;
  artifacts: ArtifactNode[];
}

const PRESET_SCENARIOS: MapScenario[] = [
  {
    id: 'duplicate_libs_and_math',
    name: '1. 다중 서브라이브러리 중복 객체 & libm 부동소수점 비대화 (전형적인 비대화)',
    desc: 'libcomm.a와 libsensors.a가 crc16.o, ringbuffer.o를 각각 별도 번들링하여 중복 탑재되고, 단 1회의 pow() 호출로 libm.a와 vfprintf_flt가 끌려온 사례',
    rawSampleMap: `Archive member included to satisfy reference by file (symbol)

libcomm.a(crc16.o)            obj/comm_driver.o (crc16_ccitt)
libsensors.a(crc16.o)         obj/sensor_bme280.o (crc16_ccitt)  [DUPLICATE]
libcomm.a(ringbuffer.o)       obj/uart.o (rb_push)
libsensors.a(ringbuffer.o)    obj/sensor_logger.o (rb_push)       [DUPLICATE]
libm.a(s_pow.o)               obj/sensor_math.o (pow)
libm.a(s_exp.o)               libm.a(s_pow.o) (exp)
libc.a(vfprintf_flt.o)        obj/logger.o (vfprintf)             [FLOAT_PRINTF]
libc.a(dtoa_flt.o)            libc.a(vfprintf_flt.o) (dtoa)`,
    artifacts: [
      {
        id: 'main_core',
        name: 'app_main.o',
        archive: 'App (Direct Object)',
        flashBytes: 2480,
        sramBytes: 124,
        category: 'healthy',
        symbols: ['main', 'system_init', 'event_loop'],
        reason: '주요 애플리케이션 진입점 및 코어 비즈니스 로직',
        remedy: '정상 배치됨',
        remedySavings: 0
      },
      {
        id: 'comm_crc16',
        name: 'crc16.o (in libcomm.a)',
        archive: 'libcomm.a',
        flashBytes: 460,
        sramBytes: 0,
        category: 'duplicate_object',
        duplicateOf: 'crc16.o (in libsensors.a)',
        symbols: ['crc16_ccitt', 'crc16_update'],
        reason: 'libsensors.a에도 완전히 동일한 CRC16 알고리즘 객체가 중복 링크되어 플래시 낭비',
        remedy: '공통 유틸리티 static library(libcommon.a)로 단일화하거나 개별 객체로 분리하여 링크',
        remedySavings: 460
      },
      {
        id: 'sensor_crc16',
        name: 'crc16.o (in libsensors.a)',
        archive: 'libsensors.a',
        flashBytes: 460,
        sramBytes: 0,
        category: 'duplicate_object',
        duplicateOf: 'crc16.o (in libcomm.a)',
        symbols: ['crc16_ccitt', 'crc16_update'],
        reason: 'libcomm.a와 중복 포함된 동일 바이너리 객체',
        remedy: '공통 유틸리티 라이브러리로 병합하여 1개 인스턴스만 유지',
        remedySavings: 460
      },
      {
        id: 'comm_ringbuf',
        name: 'ringbuffer.o (in libcomm.a)',
        archive: 'libcomm.a',
        flashBytes: 380,
        sramBytes: 64,
        category: 'duplicate_object',
        duplicateOf: 'ringbuffer.o (in libsensors.a)',
        symbols: ['rb_init', 'rb_push', 'rb_pop'],
        reason: '동일한 FIFO 링버퍼 구현체가 두 서브라이브러리에 별도 아카이브되어 중복 적재',
        remedy: '링버퍼 헤더 인라인화 또는 공통 아카이브 단일화',
        remedySavings: 380
      },
      {
        id: 'sensor_ringbuf',
        name: 'ringbuffer.o (in libsensors.a)',
        archive: 'libsensors.a',
        flashBytes: 380,
        sramBytes: 64,
        category: 'duplicate_object',
        duplicateOf: 'ringbuffer.o (in libcomm.a)',
        symbols: ['rb_init', 'rb_push', 'rb_pop'],
        reason: 'libcomm.a와 중복되는 원형 큐 버퍼 로직',
        remedy: 'libcommon.a로 분리 추출',
        remedySavings: 380
      },
      {
        id: 'libm_pow',
        name: 's_pow.o + s_exp.o (in libm.a)',
        archive: 'libm.a',
        flashBytes: 1840,
        sramBytes: 16,
        category: 'redundant_archive',
        symbols: ['pow', 'exp', '__ieee754_pow'],
        reason: '센서 수식에서 단 1곳의 정수 거듭제곱을 위해 전체 IEEE-754 부동소수점 거듭제곱 라이브러리가 유입됨',
        remedy: '정수형 비트 시프트 거듭제곱 또는 룩업 테이블(LUT) 대체 시 1.8KB 플래시 전액 회수',
        remedySavings: 1840
      },
      {
        id: 'libc_printf_flt',
        name: 'vfprintf_flt.o + dtoa.o (in libc.a)',
        archive: 'libc.a',
        flashBytes: 2360,
        sramBytes: 48,
        category: 'float_printf_bloat',
        symbols: ['vfprintf', 'dtoa', '__dtoa_flt'],
        reason: 'printf("%f") 지원을 위해 2.3KB의 대용량 부동소수점 포맷터가 링크됨',
        remedy: '정수형 정밀도 출력(dtostrf 또는 -lprintf_min 링크 플래그 적용)',
        remedySavings: 2360
      },
      {
        id: 'sensor_driver',
        name: 'sensor_bme280.o',
        archive: 'libsensors.a',
        flashBytes: 1120,
        sramBytes: 32,
        category: 'healthy',
        symbols: ['bme280_read', 'bme280_calibrate'],
        reason: '실제 사용되는 활성 온습도 기압 센서 드라이버',
        remedy: '정상 활용',
        remedySavings: 0
      }
    ]
  },
  {
    id: 'monolithic_whole_archive',
    name: '2. 모놀리식 라이브러리 미참조 데드코드 유입 (-Wl,--whole-archive)',
    desc: '서브모듈 전체 포함 옵션으로 인해 실제 호출되지 않는 12개의 테스트 루틴 및 미사용 프로토콜 파서가 플래시를 차지한 사례',
    rawSampleMap: `Archive member included to satisfy reference by file (symbol)

libprotocol.a(modbus_master.o)  obj/main.o (modbus_init)
libprotocol.a(modbus_slave.o)   obj/main.o (--whole-archive forced) [DEAD_CODE]
libprotocol.a(can_legacy.o)     obj/main.o (--whole-archive forced) [DEAD_CODE]
libprotocol.a(ascii_cli.o)      obj/main.o (--whole-archive forced) [DEAD_CODE]`,
    artifacts: [
      {
        id: 'proto_active',
        name: 'modbus_master.o',
        archive: 'libprotocol.a',
        flashBytes: 1450,
        sramBytes: 96,
        category: 'healthy',
        symbols: ['modbus_init', 'modbus_read_holding'],
        reason: '실제 시스템에서 주기적으로 통신하는 마스터 프로토콜',
        remedy: '정상',
        remedySavings: 0
      },
      {
        id: 'proto_slave_dead',
        name: 'modbus_slave.o (미사용 슬레이브 핸들러)',
        archive: 'libprotocol.a',
        flashBytes: 1280,
        sramBytes: 120,
        category: 'dead_code',
        symbols: ['modbus_slave_listen', 'modbus_reply'],
        reason: '마스터 전용 프로젝트임에도 라이브러리 전체 강제 적재로 슬레이브 핸들러가 포함됨',
        remedy: '--no-whole-archive 및 -Wl,--gc-sections 적용으로 미참조 섹션 자동 가비지 컬렉션',
        remedySavings: 1280
      },
      {
        id: 'proto_can_dead',
        name: 'can_legacy.o (레거시 CAN 파서)',
        archive: 'libprotocol.a',
        flashBytes: 980,
        sramBytes: 40,
        category: 'dead_code',
        symbols: ['can_filter_set', 'can_rx_interrupt'],
        reason: 'UART 전용 펌웨어에 미사용 CAN 버스 루틴이 통째로 유입됨',
        remedy: '컴파일러 플래그 -ffunction-sections 활성화 및 링커 GC 수행',
        remedySavings: 980
      },
      {
        id: 'proto_cli_dead',
        name: 'ascii_cli.o (디버그 CLI 콘솔)',
        archive: 'libprotocol.a',
        flashBytes: 1650,
        sramBytes: 80,
        category: 'dead_code',
        symbols: ['cli_parse_line', 'cli_print_help'],
        reason: '배포(Release) 빌드임에도 디버그용 CLI 명령어 파서가 링크에 잔류함',
        remedy: '릴리스 빌드 시 디버그 정의 매크로(#ifdef DEBUG_CLI)로 빌드 제외',
        remedySavings: 1650
      }
    ]
  }
];

export const BuildArtifactDependencyVisualizer: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('duplicate_libs_and_math');
  const [activeTab, setActiveTab] = useState<'visualizer' | 'raw_map' | 'patches'>('visualizer');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedPatch, setCopiedPatch] = useState<boolean>(false);

  const currentScenario = useMemo(() => {
    return PRESET_SCENARIOS.find((s) => s.id === selectedScenarioId) || PRESET_SCENARIOS[0];
  }, [selectedScenarioId]);

  // Bloat Aggregation Metrics
  const metrics = useMemo(() => {
    const list = currentScenario.artifacts;
    const totalFlash = list.reduce((acc, a) => acc + a.flashBytes, 0);
    const totalSram = list.reduce((acc, a) => acc + a.sramBytes, 0);

    const duplicateFlash = list
      .filter((a) => a.category === 'duplicate_object')
      .reduce((acc, a) => acc + a.remedySavings, 0);

    const redundantArchiveFlash = list
      .filter((a) => a.category === 'redundant_archive')
      .reduce((acc, a) => acc + a.remedySavings, 0);

    const floatPrintfFlash = list
      .filter((a) => a.category === 'float_printf_bloat')
      .reduce((acc, a) => acc + a.remedySavings, 0);

    const deadCodeFlash = list
      .filter((a) => a.category === 'dead_code')
      .reduce((acc, a) => acc + a.remedySavings, 0);

    const totalBloatFlash = duplicateFlash + redundantArchiveFlash + floatPrintfFlash + deadCodeFlash;
    const netOptimizedFlash = totalFlash - totalBloatFlash;
    const bloatPercent = totalFlash > 0 ? ((totalBloatFlash / totalFlash) * 100).toFixed(1) : '0';

    // Redundancy Health Score (100 = 0 bloat, down to 0)
    const healthScore = Math.max(10, Math.round(100 - Number(bloatPercent)));

    return {
      totalFlash,
      totalSram,
      duplicateFlash,
      redundantArchiveFlash,
      floatPrintfFlash,
      deadCodeFlash,
      totalBloatFlash,
      netOptimizedFlash,
      bloatPercent,
      healthScore
    };
  }, [currentScenario]);

  // Filtered Artifacts
  const filteredArtifacts = useMemo(() => {
    return currentScenario.artifacts.filter((a) => {
      const matchCategory =
        categoryFilter === 'all'
          ? true
          : categoryFilter === 'bloat_only'
          ? a.category !== 'healthy'
          : a.category === categoryFilter;

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.archive.toLowerCase().includes(q) ||
        a.symbols.some((s) => s.toLowerCase().includes(q)) ||
        a.reason.toLowerCase().includes(q);

      return matchCategory && matchSearch;
    });
  }, [currentScenario, categoryFilter, searchQuery]);

  // Generated Linker / Compiler Patch Code
  const generatedMakefilePatch = useMemo(() => {
    return `# ==============================================================================
# AVR 빌드 바이너리 비대화 제거 및 정적 라이브러리 중복 제거 패치
# 타깃 MCU: ${currentProfile.name} (Flash: ${currentProfile.flash} KB, SRAM: ${currentProfile.sram} B)
# 회수 가능한 플래시 용량: ${metrics.totalBloatFlash} Bytes (-${metrics.bloatPercent}%)
# ==============================================================================

# 1. 데드 코드 및 미참조 함수/데이터 가비지 컬렉션 (필수 1순위)
CFLAGS  += -ffunction-sections -fdata-sections
LDFLAGS += -Wl,--gc-sections
LDFLAGS += -Wl,--print-gc-sections   # 제거된 함수 목록 빌드 터미널에 출력

# 2. 부동소수점 vfprintf 비대화(-2.3KB) 해결: 정수 전용 경량 포맷터 교체
# 기존: -Wl,-u,vfprintf -lprintf_flt (비대화 원인)
# 변경: 정수 출력 전용 미니 포맷터 지정
LDFLAGS += -Wl,-u,vfprintf -lprintf_min

# 3. 중복 아카이브 방지 및 링커 그룹 순환 해석
# 서브라이브러리들이 상호 참조할 때 --whole-archive 대신 그룹 지정
LIBS    += -Wl,--start-group -lcomm -lsensors -lcommon -Wl,--end-group

# 4. libm.a 불필요한 부동소수점 종속성 제거
# 센서 정수 계산 시 -lm 링크 제외 권장
# LIBS  := $(filter-out -lm, $(LIBS))

# 5. 바이너리 크기 및 중복 심볼 분석 검증 타깃
check-bloat:
\t@echo "=== [AVR-NM] 다중 정의 또는 중복 심볼 검사 ==="
\t@avr-nm --size-sort --print-size --radix=d main.elf | tail -n 20
\t@echo "=== [AVR-SIZE] 최적화 후 바이너리 점유율 ==="
\t@avr-size --format=avr --mcu=${selectedMCU} main.elf
`;
  }, [currentProfile, metrics, selectedMCU]);

  const handleCopyPatch = () => {
    navigator.clipboard.writeText(generatedMakefilePatch);
    setCopiedPatch(true);
    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.8 }
    });
    setTimeout(() => setCopiedPatch(false), 2000);
  };

  const handleDownloadPatch = () => {
    const blob = new Blob([generatedMakefilePatch], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avr_bloat_optimization_${selectedMCU}.patch.mk`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 lg:p-8 backdrop-blur shadow-2xl space-y-8 relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg shadow-purple-500/20 text-slate-950 font-black">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl lg:text-2xl font-black text-white tracking-tight">
                  빌드 아티팩트 종속성 분석기
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Build Artifact Dependency Visualizer
                </span>
              </div>
              <p className="text-xs lg:text-sm text-slate-400 mt-1">
                .map 파일과 정적 라이브러리(.a / .o) 포함 관계를 추적하여 중복 객체 포함 및 잉여 라이브러리로 인한 바이너리 비대화(Bloat)를 감지하고 맞춤형 경량화 패치를 제안합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Target MCU Badge */}
        <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs text-slate-300">
          <Cpu className="w-4 h-4 text-purple-400" />
          <span>타깃:</span>
          <span className="font-bold text-purple-300">{currentProfile.name}</span>
          <span className="text-[11px] text-slate-500 font-mono">
            (Flash: {currentProfile.flash}KB / SRAM: {currentProfile.sram}B)
          </span>
        </div>
      </div>

      {/* Scenario Selector */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <FolderGit2 className="w-3.5 h-3.5 text-purple-400" />
            분석할 .map 파일 빌드 아티팩트 시나리오:
          </span>
          <span className="text-[11px] text-slate-500">실제 GNU ld 링커 출력 구조 분석</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PRESET_SCENARIOS.map((s) => {
            const isSelected = s.id === selectedScenarioId;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedScenarioId(s.id)}
                className={`text-left p-4 rounded-2xl border transition-all relative ${
                  isSelected
                    ? 'bg-gradient-to-br from-purple-950/60 to-slate-900 border-purple-500 text-white shadow-lg shadow-purple-950/40 ring-1 ring-purple-500/50'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-xs text-slate-200 mb-1 flex items-center justify-between">
                  <span>{s.name}</span>
                  {isSelected && <Check className="w-4 h-4 text-purple-400 shrink-0" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{s.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bloat Summary Metrics Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            분석 대상 총 바이너리
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-white font-mono">
              {metrics.totalFlash}
            </span>
            <span className="text-xs text-slate-400 font-mono">Bytes Flash</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {currentProfile.name} ROM의 {((metrics.totalFlash / (currentProfile.flash * 1024)) * 100).toFixed(1)}% 점유
          </div>
        </div>

        <div className="bg-slate-950/80 border border-rose-900/50 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider mb-1">
            감지된 바이너리 비대화 (Bloat)
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-rose-400 font-mono">
              {metrics.totalBloatFlash}
            </span>
            <span className="text-xs text-slate-400 font-mono">Bytes 낭비</span>
          </div>
          <div className="text-[11px] text-rose-400/90 mt-1 flex items-center gap-1 font-semibold">
            <AlertTriangle className="w-3 h-3" />
            전체 용량의 {metrics.bloatPercent}%가 중복/잉여
          </div>
        </div>

        <div className="bg-slate-950/80 border border-emerald-900/50 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
            최적화 후 예상 크기
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-emerald-400 font-mono">
              {metrics.netOptimizedFlash}
            </span>
            <span className="text-xs text-slate-400 font-mono">Bytes</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
            <TrendingDown className="w-3 h-3" />
            {metrics.totalBloatFlash} Bytes 즉시 감축 가능
          </div>
        </div>

        <div className="bg-slate-950/80 border border-purple-900/50 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider mb-1">
            라이브러리 경량화 건전도
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-purple-400 font-mono">
              {metrics.healthScore}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ 100 점</span>
          </div>
          <div className="text-[11px] text-purple-300 mt-1 flex items-center gap-1 font-semibold">
            <Sparkles className="w-3 h-3" />
            {metrics.healthScore > 80 ? '비교적 양호한 구성' : '심각한 중복 라이브러리 정리 필요'}
          </div>
        </div>
      </div>

      {/* Tabs: Visualizer vs Raw Map vs Patches */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              아티팩트 종속성 & 중복 객체 추적 트리
            </h3>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('visualizer')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeTab === 'visualizer'
                  ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              1. 종속성 & 비대화 시각화 트리
            </button>
            <button
              onClick={() => setActiveTab('patches')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeTab === 'patches'
                  ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              2. 링커/컴파일러 경량화 패치
            </button>
            <button
              onClick={() => setActiveTab('raw_map')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeTab === 'raw_map'
                  ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              3. .map 원문 분석 로그
            </button>
          </div>
        </div>

        {/* Tab 1: Visualizer */}
        {activeTab === 'visualizer' && (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
                  <Filter className="w-3 h-3 text-purple-400" /> 필터:
                </span>
                {[
                  { id: 'all', label: '전체 객체' },
                  { id: 'bloat_only', label: '비대화/중복만' },
                  { id: 'duplicate_object', label: '중복 객체 (.o)' },
                  { id: 'redundant_archive', label: '잉여 libm.a' },
                  { id: 'float_printf_bloat', label: 'printf 부동소수점' },
                  { id: 'dead_code', label: '데드코드' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setCategoryFilter(f.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
                      categoryFilter === f.id
                        ? 'bg-purple-600 text-white border-purple-500 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="객체, 심볼, 라이브러리 검색..."
                  className="bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono w-full sm:w-56"
                />
              </div>
            </div>

            {/* List of Artifacts */}
            <div className="space-y-3">
              {filteredArtifacts.map((node) => {
                const isBloat = node.category !== 'healthy';

                return (
                  <div
                    key={node.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      node.category === 'duplicate_object'
                        ? 'bg-rose-950/20 border-rose-800/60 hover:border-rose-600'
                        : node.category === 'redundant_archive'
                        ? 'bg-amber-950/20 border-amber-800/60 hover:border-amber-600'
                        : node.category === 'float_printf_bloat'
                        ? 'bg-purple-950/20 border-purple-800/60 hover:border-purple-600'
                        : node.category === 'dead_code'
                        ? 'bg-red-950/20 border-red-800/60 hover:border-red-600'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-purple-400" />
                          {node.name}
                        </span>

                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                          {node.archive}
                        </span>

                        {isBloat ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                              node.category === 'duplicate_object'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : node.category === 'redundant_archive'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : node.category === 'float_printf_bloat'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                : 'bg-red-500/20 text-red-300 border-red-500/30'
                            }`}
                          >
                            {node.category.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            정상 필수 코드
                          </span>
                        )}
                      </div>

                      {/* Memory footprint metrics */}
                      <div className="flex items-center gap-3 font-mono text-xs">
                        <span className="text-slate-400">
                          Flash: <strong className="text-white">{node.flashBytes}B</strong>
                        </span>
                        <span className="text-slate-400">
                          SRAM: <strong className="text-slate-300">{node.sramBytes}B</strong>
                        </span>
                        {node.remedySavings > 0 && (
                          <span className="text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/60">
                            절감 가능: -{node.remedySavings}B
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Reasons & Remedies */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 text-xs">
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          비대화 원인 분석:
                        </div>
                        <p className="text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                          {node.reason}
                        </p>
                      </div>

                      <div>
                        <div className="text-[11px] font-bold text-emerald-400 mb-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          구체적 최적화 권장 조치:
                        </div>
                        <p className="text-slate-300 leading-relaxed bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-900/40">
                          {node.remedy}
                        </p>
                      </div>
                    </div>

                    {/* Exported Symbols Chips */}
                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-mono">포함된 주요 심볼:</span>
                      {node.symbols.map((sym, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-mono text-[10px] border border-slate-800"
                        >
                          {sym}()
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Patches */}
        {activeTab === 'patches' && (
          <div className="space-y-4">
            <div className="p-4 bg-purple-950/30 border border-purple-800/50 rounded-2xl text-xs text-purple-200 leading-relaxed flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <strong>원클릭 바이너리 경량화 패치 안내:</strong> 위 분석에서 식별된 중복 객체 포함 해소, 부동소수점 포맷터 경량화, 미참조 섹션 가비지 컬렉션을 즉시 적용할 수 있는 Makefile 플래그 스켈레톤입니다. 이를 복사하여 빌드 시스템에 병합하면 타깃 Flash ROM을 대폭 확보할 수 있습니다.
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-purple-400" />
                  Makefile / Linker Optimization Flags Patch
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyPatch}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition"
                  >
                    {copiedPatch ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPatch ? '복사됨!' : '패치 복사'}</span>
                  </button>
                  <button
                    onClick={handleDownloadPatch}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white transition font-bold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.mk 다운로드</span>
                  </button>
                </div>
              </div>
              <pre className="p-4 text-xs font-mono text-purple-300/90 overflow-x-auto leading-relaxed max-h-80 selection:bg-purple-500/30">
                {generatedMakefilePatch}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 3: Raw Map */}
        {activeTab === 'raw_map' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs text-slate-300 flex items-start gap-3">
              <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <strong>GNU ld 맵 파일 아카이브 포함 섹션 (Archive member included...):</strong> 링커는 오브젝트 파일들이 요구하는 외부 심볼을 만족하기 위해 정적 아카이브(.a)에서 필요한 멤버(.o)를 추출합니다. 이 섹션을 파싱하면 어떤 파일이 어떤 원인으로 라이브러리를 끌고 들어왔는지 역추적할 수 있습니다.
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
                <span>build/output.map (Archive Member References)</span>
              </div>
              <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-72 selection:bg-purple-500/30">
                {currentScenario.rawSampleMap}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
