import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Clock,
  Zap,
  Gauge,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  Terminal,
  FileCode2,
  Copy,
  Check,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Info,
  Scale,
  Activity,
  HardDrive
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

interface BuildFlagItem {
  id: string;
  flag: string;
  name: string;
  category: 'lto' | 'optimization' | 'sections' | 'toolchain' | 'debug';
  description: string;
  buildTimeImpactPercent: number; // + is slower, - is faster
  binarySizeImpactPercent: number; // - is smaller (saves flash), + is larger
  recommendedPhase: 'development' | 'production' | 'both';
  tradeoffExplanation: string;
}

const BUILD_FLAGS_DATABASE: BuildFlagItem[] = [
  {
    id: 'flto',
    flag: '-flto',
    name: 'Link-Time Optimization (LTO)',
    category: 'lto',
    description: '컴파일 단위 경계를 넘어 전체 ELF 바이너리 수준에서 인라인 및 불필요한 코드를 전역적으로 분석/제거합니다.',
    buildTimeImpactPercent: 185, // +185% build time increase (significantly slower)
    binarySizeImpactPercent: -18, // -18% flash size reduction (huge memory saving)
    recommendedPhase: 'production',
    tradeoffExplanation: '링커 단계에서 전체 중간 표현(GIMPLE)을 다시 파싱하고 전역 호출 그래프를 재구성하므로 빌드 시간은 2~3배 급증하지만, AVR 플래시 메모리를 평균 10~25% 극적으로 절약합니다.'
  },
  {
    id: 'flto-jobserver',
    flag: '-flto=auto',
    name: 'Parallelized LTO (-flto=auto / -flto=N)',
    category: 'lto',
    description: '호스트 CPU 코어 수에 맞추어 LTO 파티션을 멀티스레드로 병렬 최적화합니다.',
    buildTimeImpactPercent: 65, // only +65% instead of +185%
    binarySizeImpactPercent: -18,
    recommendedPhase: 'production',
    tradeoffExplanation: '단일 스레드 -flto 대비 빌드 시간을 약 50% 단축하면서도 동일한 플래시 메모리 절감율을 달성합니다.'
  },
  {
    id: 'ffunction-sections',
    flag: '-ffunction-sections -fdata-sections',
    name: 'Dead Code Strip Sections',
    category: 'sections',
    description: '모든 함수와 전역 변수를 독립 ELF 섹션으로 분리하여 링커의 -Wl,--gc-sections가 미사용 코드를 제거하도록 합니다.',
    buildTimeImpactPercent: 20, // +20% build time
    binarySizeImpactPercent: -14, // -14% flash size
    recommendedPhase: 'both',
    tradeoffExplanation: '오브젝트 파일의 섹션 헤더 테이블이 커져 컴파일이 약간 느려지지만, 라이브러리(avr-libc)의 미참조 서브루틴을 완전히 배제합니다.'
  },
  {
    id: 'opt-os',
    flag: '-Os',
    name: 'Optimize for Size (-Os)',
    category: 'optimization',
    description: '루프 언롤링을 억제하고 함수 인라이닝을 코드 크기 최소화 관점에서만 적용합니다.',
    buildTimeImpactPercent: 15,
    binarySizeImpactPercent: -22,
    recommendedPhase: 'both',
    tradeoffExplanation: 'AVR의 좁은 플래시에 가장 이상적인 표준 모드입니다.'
  },
  {
    id: 'opt-o0',
    flag: '-O0',
    name: 'No Optimization (Fastest Build -O0)',
    category: 'optimization',
    description: '모든 최적화 패스를 건너뛰고 1:1 어셈블리로 직결 컴파일합니다.',
    buildTimeImpactPercent: -65, // 65% faster compilation!
    binarySizeImpactPercent: 45, // 45% larger binary
    recommendedPhase: 'development',
    tradeoffExplanation: '빌드 속도가 압도적으로 빠르고 디버거(GDB)에서 변수 추적이 완벽하지만, 플래시 용량을 크게 낭비하므로 릴리즈 시에는 부적합합니다.'
  },
  {
    id: 'pipe',
    flag: '-pipe',
    name: 'In-Memory Pipeline (-pipe)',
    category: 'toolchain',
    description: '임시 파일을 디스크에 쓰지 않고 메모리 파이프를 통해 어셈블러 및 컴파일러 간 데이터를 전달합니다.',
    buildTimeImpactPercent: -12, // 12% faster build
    binarySizeImpactPercent: 0,
    recommendedPhase: 'both',
    tradeoffExplanation: '디스크 I/O 병목을 제거하여 순수 빌드 시간을 단축시키며 바이너리 크기에는 아무런 영향을 주지 않습니다.'
  },
  {
    id: 'g2',
    flag: '-g2 -gdwarf-2',
    name: 'DWARF-2 Debug Information',
    category: 'debug',
    description: 'ELF 파일 내에 C 소스 코드 라인 매핑 및 심볼 디버그 테이블을 생성합니다.',
    buildTimeImpactPercent: 18,
    binarySizeImpactPercent: 0, // HEX 변환 시 OBJCOPY가 제거하므로 Flash 실제 크기는 불변
    recommendedPhase: 'development',
    tradeoffExplanation: 'ELF 파일 크기는 3~5배 커지지만 플래시에 구워지는 .hex에는 포함되지 않습니다. 컴파일 시간은 약간 증가합니다.'
  },
  {
    id: 'mcall-prologues',
    flag: '-mcall-prologues',
    name: 'Subroutine Function Prologues',
    category: 'sections',
    description: '함수 진입 시 레지스터 Push/Pop 루틴을 공통 런타임 서브루틴 점프로 대체합니다.',
    buildTimeImpactPercent: 8,
    binarySizeImpactPercent: -5,
    recommendedPhase: 'production',
    tradeoffExplanation: '플래시를 수백 바이트 절약하지만 약간의 실행 속도 및 빌드 시간 지연이 발생합니다.'
  }
];

export const BuildTimePerformanceAnalyzer: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // User Project Parameters
  const [sourceFileCount, setSourceFileCount] = useState<number>(18);
  const [locCount, setLocCount] = useState<number>(4500); // Lines of code
  const [cpuCores, setCpuCores] = useState<number>(8); // host cores
  const [useParallelMake, setUseParallelMake] = useState<boolean>(true); // make -jN
  const [profileMode, setProfileMode] = useState<'custom' | 'dev_fast' | 'prod_compact'>('custom');

  // Selected Flags State
  const [enabledFlags, setEnabledFlags] = useState<Record<string, boolean>>({
    flto: true,
    'flto-jobserver': true,
    'ffunction-sections': true,
    'opt-os': true,
    'opt-o0': false,
    pipe: true,
    g2: false,
    'mcall-prologues': false
  });

  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);

  // Toggle flag
  const toggleFlag = (id: string) => {
    setEnabledFlags((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      // mutually exclusive adjustments
      if (id === 'opt-o0' && next['opt-o0']) {
        next['opt-os'] = false;
        next['flto'] = false;
        next['flto-jobserver'] = false;
      }
      if (id === 'opt-os' && next['opt-os']) {
        next['opt-o0'] = false;
      }
      if (id === 'flto' && !next['flto']) {
        next['flto-jobserver'] = false;
      }
      return next;
    });
    setProfileMode('custom');
  };

  // Presets
  const applyPreset = (preset: 'dev_fast' | 'prod_compact') => {
    if (preset === 'dev_fast') {
      setEnabledFlags({
        flto: false,
        'flto-jobserver': false,
        'ffunction-sections': false,
        'opt-os': false,
        'opt-o0': true,
        pipe: true,
        g2: true,
        'mcall-prologues': false
      });
      setProfileMode('dev_fast');
    } else {
      setEnabledFlags({
        flto: true,
        'flto-jobserver': true,
        'ffunction-sections': true,
        'opt-os': true,
        'opt-o0': false,
        pipe: true,
        g2: false,
        'mcall-prologues': true
      });
      setProfileMode('prod_compact');
    }
  };

  // Performance Simulation Model
  const stats = useMemo(() => {
    // Base Single-Core Compile time baseline: approx 0.15s per source file (at 250 LOC/file)
    const baseTimeSec = Math.max(0.5, (sourceFileCount * 0.18) + (locCount / 30000));
    const baseFlashBytes = Math.min(65536, Math.max(2048, locCount * 3.8));

    let timeMultiplier = 1.0;
    let sizeMultiplier = 1.0;

    // Evaluate Flags Impact
    BUILD_FLAGS_DATABASE.forEach((flagItem) => {
      if (enabledFlags[flagItem.id]) {
        // Special case: if -flto and -flto=auto both enabled, use the parallelized cost
        if (flagItem.id === 'flto' && enabledFlags['flto-jobserver']) {
          return; // skip single-thread LTO penalty
        }
        timeMultiplier += (flagItem.buildTimeImpactPercent / 100);
        sizeMultiplier += (flagItem.binarySizeImpactPercent / 100);
      }
    });

    // Make -jN parallelization factor on non-LTO compilation phase
    let parallelBenefit = 1.0;
    if (useParallelMake && cpuCores > 1) {
      // Amdahl's law approximation: 80% of compile is parallelizable, 20% linking is serial
      const p = 0.82;
      const speedup = 1 / ((1 - p) + (p / cpuCores));
      parallelBenefit = 1 / speedup;
    }

    const estimatedBuildTimeSec = Math.max(0.3, baseTimeSec * timeMultiplier * parallelBenefit);
    const estimatedFlashBytes = Math.max(512, Math.round(baseFlashBytes * Math.max(0.3, sizeMultiplier)));

    const isLtoActive = enabledFlags['flto'];
    const isParallelLto = enabledFlags['flto-jobserver'];

    // Comparison delta for LTO
    // Baseline without LTO:
    const sizeWithoutLto = Math.round(estimatedFlashBytes / (isLtoActive ? 0.82 : 1.0));
    const timeWithoutLto = Math.max(0.2, estimatedBuildTimeSec / (isLtoActive ? (isParallelLto ? 1.65 : 2.85) : 1.0));

    return {
      estimatedBuildTimeSec: parseFloat(estimatedBuildTimeSec.toFixed(2)),
      estimatedFlashBytes,
      isLtoActive,
      isParallelLto,
      sizeWithoutLto,
      timeWithoutLto,
      ltoSizeSavedBytes: sizeWithoutLto - estimatedFlashBytes,
      ltoTimeExtraSec: parseFloat((estimatedBuildTimeSec - timeWithoutLto).toFixed(2))
    };
  }, [sourceFileCount, locCount, cpuCores, useParallelMake, enabledFlags]);

  // Generate Recommended Makefile snippet
  const generatedFlagsSnippet = useMemo(() => {
    const flags: string[] = [];
    if (enabledFlags['opt-o0']) flags.push('-O0');
    else if (enabledFlags['opt-os']) flags.push('-Os');

    if (enabledFlags['pipe']) flags.push('-pipe');
    if (enabledFlags['ffunction-sections']) flags.push('-ffunction-sections -fdata-sections');
    if (enabledFlags['flto']) {
      if (enabledFlags['flto-jobserver']) flags.push('-flto=auto');
      else flags.push('-flto');
    }
    if (enabledFlags['mcall-prologues']) flags.push('-mcall-prologues');
    if (enabledFlags['g2']) flags.push('-g2 -gdwarf-2');

    return `# ==============================================================================
# 최적화 빌드 플래그 설정 (${profileMode === 'dev_fast' ? '개발 속도 최우선 모드' : '배포 크기 최우선 모드'})
# ==============================================================================
# 1. C/C++ 컴파일 플래그
CFLAGS  = -mmcu=${currentProfile.id} -DF_CPU=16000000UL
CFLAGS += ${flags.join(' ')}

# 2. 링커 플래그
LDFLAGS = -mmcu=${currentProfile.id}
${enabledFlags['ffunction-sections'] ? 'LDFLAGS += -Wl,--gc-sections\n' : ''}${enabledFlags['flto'] ? `LDFLAGS += ${enabledFlags['flto-jobserver'] ? '-flto=auto' : '-flto'}\n` : ''}
# 3. 병렬 컴파일 실행 (make 터미널 호출 시):
# make -j${cpuCores}
`;
  }, [enabledFlags, profileMode, currentProfile.id, cpuCores]);

  const copySnippet = () => {
    navigator.clipboard.writeText(generatedFlagsSnippet);
    setCopiedSnippet(true);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.3 } });
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Title Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" /> Build Time Performance Analyzer
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              Target: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-mono">
              LTO Trade-off Engine
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            컴파일 빌드 속도 및 LTO 트레이드오프 분석기
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            avr-gcc 주요 컴파일러 플래그가 **컴파일 빌드 소요 시간(Build Speed)**과 **바이너리 플래시 크기(Binary Size)**에 미치는 영향을 비교 분석합니다.
            특히 **링크 타임 최적화(LTO)**의 플래시 절감 효과와 빌드 지연 트레이드오프를 수치로 검증하세요.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => applyPreset('dev_fast')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition border inline-flex items-center gap-1.5 ${
              profileMode === 'dev_fast'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>⚡ 초고속 개발 빌드 (-O0/No LTO)</span>
          </button>
          <button
            onClick={() => applyPreset('prod_compact')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition border inline-flex items-center gap-1.5 ${
              profileMode === 'prod_compact'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>📦 프로덕션 최소 크기 (-Os/LTO)</span>
          </button>
        </div>
      </div>

      {/* LTO Trade-off Spotlight Hero Card */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-indigo-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>링크 타임 최적화(LTO) 핵심 트레이드오프 분석</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  stats.isLtoActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                }`}>
                  {stats.isLtoActive ? 'LTO 활성화됨 (-flto)' : 'LTO 비활성 상태'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                LTO 적용 유무에 따른 예상 빌드 시간 증가량과 플래시 절약 바이트 수치 직접 대조
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">LTO 적용 시 플래시 절감율:</span>
            <span className="text-emerald-400 font-bold">-18% ~ -25%</span>
          </div>
        </div>

        {/* 2 Big Comparison Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gauge 1: Flash Memory Saving */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-emerald-400" /> 바이너리 플래시 ROM 크기:
              </span>
              <span className="text-emerald-400 font-bold text-sm">
                {stats.estimatedFlashBytes.toLocaleString()} Bytes
              </span>
            </div>

            <div className="h-3.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative flex">
              <div
                className="bg-emerald-500 transition-all duration-700"
                style={{ width: `${Math.min(100, (stats.estimatedFlashBytes / currentProfile.flash) * 100)}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
              <span>{currentProfile.name} 총 플래시: {Math.round(currentProfile.flash / 1024)} KB</span>
              {stats.isLtoActive ? (
                <span className="text-emerald-300 font-bold flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" /> LTO로 약 {stats.ltoSizeSavedBytes.toLocaleString()} Bytes 절약 중
                </span>
              ) : (
                <span className="text-amber-400">LTO 미적용 (플래시 절약 기회 누락)</span>
              )}
            </div>
          </div>

          {/* Gauge 2: Build Time Elapsed */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" /> 전역 빌드 소요 시간:
              </span>
              <span className="text-amber-400 font-bold text-sm">
                {stats.estimatedBuildTimeSec} 초 (sec)
              </span>
            </div>

            <div className="h-3.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative flex">
              <div
                className="bg-amber-500 transition-all duration-700"
                style={{ width: `${Math.min(100, (stats.estimatedBuildTimeSec / 10) * 100)}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
              <span>make -j{useParallelMake ? cpuCores : 1} 병렬 컴파일 기준</span>
              {stats.isLtoActive ? (
                <span className="text-amber-300 font-bold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-rose-400" /> LTO로 빌드 시간 +{stats.ltoTimeExtraSec}초 소요
                </span>
              ) : (
                <span className="text-emerald-400">초고속 즉시 링크 완료</span>
              )}
            </div>
          </div>
        </div>

        {/* LTO Best Practice Recommendation Box */}
        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans flex items-start gap-2.5">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white">🚀 실무 엔지니어 권장 워크플로우:</strong>
            <p className="text-slate-400 mt-0.5">
              일상적인 개발 및 유닛 테스트/디버깅 루프에서는 LTO를 끄고(<code>make DEV=1</code>) 빌드 시간을 0.5초 이내로 단축하여 개발 생산성을 유지하세요.
              반면 배포용 릴리즈 펌웨어를 생성할 때는 반드시 <code>-flto=auto</code>를 적용하여 AVR의 좁은 플래시 메모리 여유를 확보해야 합니다.
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Environment Settings & Flag Toggles */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Project Scale & Host Environment (4 cols) */}
        <div className="lg:col-span-4 bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">프로젝트 규모 및 호스트 환경</h3>
          </div>

          {/* Source files count */}
          <div>
            <div className="flex justify-between text-xs mb-1 font-medium">
              <span className="text-slate-400">C/C++ 소스 파일 개수:</span>
              <span className="text-cyan-400 font-bold font-mono">{sourceFileCount} 개</span>
            </div>
            <input
              type="range"
              min="1"
              max="60"
              value={sourceFileCount}
              onChange={(e) => setSourceFileCount(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
            />
          </div>

          {/* Code lines (LOC) */}
          <div>
            <div className="flex justify-between text-xs mb-1 font-medium">
              <span className="text-slate-400">전체 코드 라인 수 (LOC):</span>
              <span className="text-cyan-400 font-bold font-mono">{locCount.toLocaleString()} 라인</span>
            </div>
            <input
              type="range"
              min="500"
              max="25000"
              step="500"
              value={locCount}
              onChange={(e) => setLocCount(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
            />
          </div>

          {/* CPU Cores & Parallel make */}
          <div>
            <div className="flex justify-between text-xs mb-1 font-medium">
              <span className="text-slate-400">호스트 빌드 머신 CPU 코어 수:</span>
              <span className="text-emerald-400 font-bold font-mono">{cpuCores} Cores</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
              {[1, 4, 8, 16].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCpuCores(c)}
                  className={`py-1.5 rounded-lg border font-bold transition text-center ${
                    cpuCores === c
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {c}C
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
            <input
              type="checkbox"
              checked={useParallelMake}
              onChange={(e) => setUseParallelMake(e.target.checked)}
              className="accent-emerald-500 rounded w-4 h-4 cursor-pointer"
            />
            <span><code>make -j{cpuCores}</code> 병렬 컴파일 활성화</span>
          </label>
        </div>

        {/* Right: Compiler Flags Impact Matrix (8 cols) */}
        <div className="lg:col-span-8 bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">컴파일러 플래그별 속도/크기 영향 분석 매트릭스</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">클릭하여 플래그 On/Off 토글</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {BUILD_FLAGS_DATABASE.map((item) => {
              const isChecked = !!enabledFlags[item.id];
              const isSlower = item.buildTimeImpactPercent > 0;
              const isSmaller = item.binarySizeImpactPercent < 0;

              return (
                <div
                  key={item.id}
                  onClick={() => toggleFlag(item.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition select-none flex flex-col justify-between space-y-2 ${
                    isChecked
                      ? 'bg-slate-900/90 border-cyan-500/50 shadow-sm'
                      : 'bg-slate-950/40 border-slate-800/60 opacity-60 hover:opacity-100 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // parent onClick
                          className="accent-cyan-500 rounded w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="font-mono text-xs font-bold text-white">{item.flag}</span>
                      </div>

                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                        item.recommendedPhase === 'development'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : item.recommendedPhase === 'production'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {item.recommendedPhase === 'development' ? '개발용' : item.recommendedPhase === 'production' ? '배포용' : '공통'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-snug font-sans">
                      {item.description}
                    </p>
                  </div>

                  {/* Impact Badges */}
                  <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-slate-800/80">
                    <span className={`flex items-center gap-1 ${isSlower ? 'text-rose-400' : 'text-emerald-400'}`}>
                      <Clock className="w-3 h-3" />
                      빌드 시간: {item.buildTimeImpactPercent > 0 ? `+${item.buildTimeImpactPercent}%` : `${item.buildTimeImpactPercent}%`}
                    </span>

                    <span className={`flex items-center gap-1 ${isSmaller ? 'text-emerald-400 font-bold' : item.binarySizeImpactPercent > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                      <HardDrive className="w-3 h-3" />
                      바이너리 크기: {item.binarySizeImpactPercent > 0 ? `+${item.binarySizeImpactPercent}%` : `${item.binarySizeImpactPercent}%`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Generated Makefile Flags Config Output */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-white font-mono">
              Makefile 적용 권장 플래그 스니펫 ({profileMode === 'dev_fast' ? '초고속 개발 모드' : '배포 최소화 모드'})
            </span>
          </div>

          <button
            onClick={copySnippet}
            className="text-slate-400 hover:text-white text-xs font-mono inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition"
          >
            {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copiedSnippet ? '복사됨' : '스니펫 복사'}</span>
          </button>
        </div>

        <pre className="p-4 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto max-h-48 custom-scrollbar bg-slate-950/90">
          {generatedFlagsSnippet}
        </pre>
      </div>
    </div>
  );
};
