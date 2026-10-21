import React, { useState, useMemo } from 'react';
import {
  Database,
  Clock,
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  TrendingDown,
  Sliders,
  RotateCcw,
  Code2,
  Info,
  Layers,
  Thermometer,
  ShieldAlert,
  Flame,
  FileCode,
  Gauge,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Cpu
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  LineChart,
  Line,
  ReferenceLine
} from 'recharts';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

// Preset writing scenarios
interface WritePreset {
  id: string;
  name: string;
  description: string;
  freqHz: number;
  payloadBytes: number;
  dirtyRatio: number; // 0..1 (fraction of writes that actually change value)
  category: 'fatal' | 'warning' | 'balanced' | 'safe';
}

const WRITE_PRESETS: WritePreset[] = [
  {
    id: 'fatal_imu',
    name: 'IMU Blackbox Telemetry (100 Hz)',
    description: '드론 자세 제어 센서 원시 데이터 직교 기록 (고위험 안티패턴)',
    freqHz: 100,
    payloadBytes: 6,
    dirtyRatio: 0.95,
    category: 'fatal'
  },
  {
    id: 'gps_tracker',
    name: 'GPS 위치 로깅 (1 Hz)',
    description: '차량 관제 단말기 1초 주기 위도/경도 저장',
    freqHz: 1,
    payloadBytes: 8,
    dirtyRatio: 0.70,
    category: 'warning'
  },
  {
    id: 'adc_temp_logger',
    name: '환경 센서 주기 기록 (0.1 Hz / 10초)',
    description: '산업용 온습도계 10초 주기 플랜트 모니터링',
    freqHz: 0.1,
    payloadBytes: 4,
    dirtyRatio: 0.50,
    category: 'warning'
  },
  {
    id: 'meter_kwh',
    name: '스마트 전력량계 누적치 (1회 / 분 = 0.0167 Hz)',
    description: '전력량계 60초 주기 누적 전력량 저장',
    freqHz: 1 / 60,
    payloadBytes: 4,
    dirtyRatio: 0.40,
    category: 'balanced'
  },
  {
    id: 'runtime_hours',
    name: '장비 가동 누적 시간계 (1회 / 시간 = 0.00028 Hz)',
    description: '산업용 펌프/모터 총 가동 시간 보존',
    freqHz: 1 / 3600,
    payloadBytes: 4,
    dirtyRatio: 1.0,
    category: 'safe'
  },
  {
    id: 'user_settings',
    name: '사용자 환경설정 저장 (1회 / 일 = 0.0000116 Hz)',
    description: 'UI 볼륨/밝기/네트워크 설정 변경 시에만 온디맨드 쓰기',
    freqHz: 1 / 86400,
    payloadBytes: 16,
    dirtyRatio: 0.20,
    category: 'safe'
  }
];

// MCU-specific EEPROM specifications
interface McuEepromSpec {
  sizeBytes: number;
  nominalEndurance: number; // cycles @ 25°C
  writeTimeMs: number; // ms per byte/page
  pageSizeBytes: number;
  retention25CYears: number;
  retention85CYears: number;
  chargePumpCurrentMa: number;
  voltageMin: number;
  voltageMax: number;
  eraseWriteModes: string;
}

const MCU_EEPROM_SPECS: Record<SupportedMCU, McuEepromSpec> = {
  atmega328p: {
    sizeBytes: 1024, // 1 KB
    nominalEndurance: 100000,
    writeTimeMs: 3.4,
    pageSizeBytes: 4,
    retention25CYears: 100,
    retention85CYears: 20,
    chargePumpCurrentMa: 3.0,
    voltageMin: 1.8,
    voltageMax: 5.5,
    eraseWriteModes: 'Erase+Write (3.4ms), Erase Only (1.8ms), Write Only (1.8ms)'
  },
  atmega128: {
    sizeBytes: 4096, // 4 KB
    nominalEndurance: 100000,
    writeTimeMs: 8.5, // classic mega128 calibrated osc cycle (~8.5ms)
    pageSizeBytes: 8,
    retention25CYears: 100,
    retention85CYears: 20,
    chargePumpCurrentMa: 4.5,
    voltageMin: 2.7,
    voltageMax: 5.5,
    eraseWriteModes: 'Atomic Erase+Write (~8.5ms)'
  },
  atmega640: {
    sizeBytes: 4096, // 4 KB
    nominalEndurance: 100000,
    writeTimeMs: 3.4,
    pageSizeBytes: 8,
    retention25CYears: 100,
    retention85CYears: 20,
    chargePumpCurrentMa: 3.2,
    voltageMin: 1.8,
    voltageMax: 5.5,
    eraseWriteModes: 'Erase+Write (3.4ms), Erase Only (1.8ms), Write Only (1.8ms)'
  },
  atmega2560: {
    sizeBytes: 4096, // 4 KB
    nominalEndurance: 100000,
    writeTimeMs: 3.4,
    pageSizeBytes: 8,
    retention25CYears: 100,
    retention85CYears: 20,
    chargePumpCurrentMa: 3.2,
    voltageMin: 1.8,
    voltageMax: 5.5,
    eraseWriteModes: 'Erase+Write (3.4ms), Erase Only (1.8ms), Write Only (1.8ms)'
  }
};

export const EepromEnduranceEstimator: React.FC<Props> = ({
  selectedMCU,
  onSelectMCU
}) => {
  const spec = MCU_EEPROM_SPECS[selectedMCU];

  // User input states
  const [freqHz, setFreqHz] = useState<number>(1.0); // Write frequency in Hz
  const [payloadBytes, setPayloadBytes] = useState<number>(4); // Bytes written per transaction
  const [allocatedEepromBytes, setAllocatedEepromBytes] = useState<number>(512); // Pool size for wear-leveling
  const [operatingTempC, setOperatingTempC] = useState<number>(25); // Ambient operating temperature
  const [dirtyRatioPercent, setDirtyRatioPercent] = useState<number>(50); // % of writes that change value
  const [useWearLeveling, setUseWearLeveling] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'simulator' | 'comparison' | 'code' | 'physics'>('simulator');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Temperature derating factor
  const tempDeratingFactor = useMemo(() => {
    // 25°C -> 1.0 (100k cycles)
    // 50°C -> 0.92 (92k cycles)
    // 85°C -> 0.75 (75k cycles)
    // 105°C -> 0.50 (50k cycles)
    if (operatingTempC <= 25) return 1.0;
    if (operatingTempC <= 50) return 1.0 - ((operatingTempC - 25) / 25) * 0.08;
    if (operatingTempC <= 85) return 0.92 - ((operatingTempC - 50) / 35) * 0.17;
    return Math.max(0.3, 0.75 - ((operatingTempC - 85) / 20) * 0.25);
  }, [operatingTempC]);

  const effectiveEndurancePerCell = useMemo(() => {
    return Math.round(spec.nominalEndurance * tempDeratingFactor);
  }, [spec.nominalEndurance, tempDeratingFactor]);

  // Wear leveling slots available
  const wearSlots = useMemo(() => {
    const safePayload = Math.max(1, payloadBytes);
    const clampedPool = Math.min(spec.sizeBytes, Math.max(safePayload, allocatedEepromBytes));
    return Math.max(1, Math.floor(clampedPool / safePayload));
  }, [payloadBytes, allocatedEepromBytes, spec.sizeBytes]);

  // Lifespan calculations
  const calculations = useMemo(() => {
    const safeFreq = Math.max(0.0000001, freqHz);
    const writesPerSec = safeFreq;
    const writesPerDay = writesPerSec * 86400;
    const writesPerYear = writesPerDay * 365.25;

    // 1. Direct Fixed Cell (No wear leveling, no update check)
    // Every write hits the same cell(s)
    const naiveSeconds = effectiveEndurancePerCell / writesPerSec;
    const naiveDays = naiveSeconds / 86400;
    const naiveYears = naiveDays / 365.25;

    // 2. EEPROM.update() filtered only (Fixed cell, but only dirty writes trigger erase/write)
    const dirtyFactor = Math.max(0.01, dirtyRatioPercent / 100);
    const updateFilteredSeconds = effectiveEndurancePerCell / (writesPerSec * dirtyFactor);
    const updateFilteredDays = updateFilteredSeconds / 86400;
    const updateFilteredYears = updateFilteredDays / 365.25;

    // 3. Wear-leveling ring buffer (Round-robin across wearSlots)
    const wearLevelingSeconds = (effectiveEndurancePerCell * wearSlots) / writesPerSec;
    const wearLevelingDays = wearLevelingSeconds / 86400;
    const wearLevelingYears = wearLevelingDays / 365.25;

    // 4. Combined: Wear-leveling + EEPROM.update() dirty check
    const combinedSeconds = (effectiveEndurancePerCell * wearSlots) / (writesPerSec * dirtyFactor);
    const combinedDays = combinedSeconds / 86400;
    const combinedYears = combinedDays / 365.25;

    // Hardware write speed limit check:
    // AVR EEPROM write takes writeTimeMs (3.4ms or 8.5ms). Max theoretical frequency:
    const maxHardwareFreq = 1000 / spec.writeTimeMs;
    const isHardwareOverdriven = freqHz > maxHardwareFreq;
    const cpuBlockingTimeSecPerSec = Math.min(1.0, (freqHz * spec.writeTimeMs) / 1000);
    const cpuBlockingPercent = cpuBlockingTimeSecPerSec * 100;

    // Active strategy result
    let activeSeconds = naiveSeconds;
    if (useWearLeveling) {
      activeSeconds = combinedSeconds;
    } else {
      activeSeconds = updateFilteredSeconds;
    }
    const activeDays = activeSeconds / 86400;
    const activeYears = activeDays / 365.25;

    return {
      writesPerSec,
      writesPerDay,
      writesPerYear,
      naiveSeconds,
      naiveDays,
      naiveYears,
      updateFilteredYears,
      wearLevelingYears,
      combinedYears,
      activeSeconds,
      activeDays,
      activeYears,
      maxHardwareFreq,
      isHardwareOverdriven,
      cpuBlockingPercent,
      wearSlots
    };
  }, [
    freqHz,
    effectiveEndurancePerCell,
    wearSlots,
    dirtyRatioPercent,
    useWearLeveling,
    spec.writeTimeMs
  ]);

  // Format lifespan in human-friendly string
  const formatLifespan = (seconds: number) => {
    if (!isFinite(seconds) || seconds <= 0) return '0초';
    if (seconds < 60) return `${seconds.toFixed(1)}초`;
    const minutes = seconds / 60;
    if (minutes < 60) return `${minutes.toFixed(1)}분`;
    const hours = minutes / 60;
    if (hours < 48) return `${hours.toFixed(1)}시간`;
    const days = hours / 24;
    if (days < 90) return `${days.toFixed(1)}일`;
    const months = days / 30.44;
    if (months < 24) return `${months.toFixed(1)}개월`;
    const years = days / 365.25;
    if (years >= 1000) return `1,000+ 년 (영구 보존)`;
    return `${years.toFixed(1)}년`;
  };

  // Status Level evaluation
  const statusInfo = useMemo(() => {
    const years = calculations.activeYears;
    if (calculations.isHardwareOverdriven) {
      return {
        level: 'critical',
        color: 'text-rose-400',
        badgeBg: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
        title: '하드웨어 주파수 한계 초과 (EEPE 지연 병목)',
        desc: `AVR 하드웨어 EEPROM 쓰기 사이클(${spec.writeTimeMs}ms)보다 빠른 주파수(${freqHz}Hz)입니다. CPU가 100% 멈추거나 데이터가 누락됩니다!`
      };
    }
    if (years < 1 / 12) {
      // Less than 1 month
      return {
        level: 'critical',
        color: 'text-rose-400',
        badgeBg: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
        title: '극단적 파괴 위험 (1개월 미만 소진)',
        desc: '동일 어드레스 반복 쓰기로 인해 플로팅 게이트 산화막(Oxide)이 단기간에 영구 절연 파괴됩니다. 즉시 웨어레벨링을 적용하거나 RAM 버퍼링을 사용하세요.'
      };
    }
    if (years < 1) {
      // 1 month ~ 1 year
      return {
        level: 'warning',
        color: 'text-amber-400',
        badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
        title: '주의 필요 (1년 미만 조기 마모)',
        desc: '상용 제품의 보증 기간(1~2년) 내에 필드 불량으로 이어질 수 있습니다. EEPROM.update() 필터링 또는 링 버퍼 분산 저장이 권장됩니다.'
      };
    }
    if (years < 5) {
      // 1 ~ 5 years
      return {
        level: 'moderate',
        color: 'text-yellow-400',
        badgeBg: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
        title: '단기 운용 가능 (1~5년 수명)',
        desc: '단기 프로토타입이나 비정기 장비에는 적합하나, 10년 보증 산업용 컨트롤러에는 부족합니다.'
      };
    }
    if (years < 20) {
      // 5 ~ 20 years
      return {
        level: 'safe',
        color: 'text-emerald-400',
        badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
        title: '산업용 안정 등급 (5~20년 수명)',
        desc: '일반적인 산업용 제어 장비 및 스마트 가전의 목표 수명(MTBF 10년)을 안전하게 충족합니다.'
      };
    }
    return {
      level: 'excellent',
      color: 'text-cyan-400',
      badgeBg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
      title: '영구 보존 등급 (20년+ 무제한)',
      desc: `EEPROM 소자 마모 한계보다 실리콘의 전하 보존 수명(${operatingTempC <= 25 ? '100년' : '20년'})이 먼저 도래할 만큼 안전합니다.`
    };
  }, [calculations, spec.writeTimeMs, freqHz, operatingTempC]);

  // Chart data: 4 Strategy Comparison
  const strategyComparisonData = useMemo(() => {
    return [
      {
        name: '단일 고정 주소',
        years: Math.min(100, Number(calculations.naiveYears.toFixed(2))),
        display: formatLifespan(calculations.naiveSeconds),
        color: '#f43f5e',
        tag: '위험'
      },
      {
        name: 'EEPROM.update()만 적용',
        years: Math.min(100, Number(calculations.updateFilteredYears.toFixed(2))),
        display: formatLifespan(calculations.updateFilteredYears * 365.25 * 86400),
        color: '#fbbf24',
        tag: '조건부'
      },
      {
        name: `웨어레벨링 (${calculations.wearSlots} 슬롯)`,
        years: Math.min(100, Number(calculations.wearLevelingYears.toFixed(2))),
        display: formatLifespan(calculations.wearLevelingYears * 365.25 * 86400),
        color: '#38bdf8',
        tag: '권장'
      },
      {
        name: '웨어레벨링 + update() 복합',
        years: Math.min(100, Number(calculations.combinedYears.toFixed(2))),
        display: formatLifespan(calculations.combinedYears * 365.25 * 86400),
        color: '#10b981',
        tag: '최적'
      }
    ];
  }, [calculations]);

  // Degradation projection over time (0% to 100% of cell endurance over 10 points)
  const degradationCurveData = useMemo(() => {
    const points = [];
    const totalHours = Math.max(1, (calculations.activeSeconds / 3600));
    const stepHours = totalHours / 10;

    for (let i = 0; i <= 10; i++) {
      const currentH = Math.round(i * stepHours);
      const usedPct = Math.min(100, (i / 10) * 100);
      const remainingPct = 100 - usedPct;
      const cellCyclesUsed = Math.round((usedPct / 100) * effectiveEndurancePerCell);

      let timeLabel = '';
      if (currentH < 48) {
        timeLabel = `${currentH}h`;
      } else if (currentH < 24 * 60) {
        timeLabel = `${Math.round(currentH / 24)}d`;
      } else if (currentH < 24 * 365.25) {
        timeLabel = `${(currentH / (24 * 30.44)).toFixed(1)}mo`;
      } else {
        timeLabel = `${(currentH / (24 * 365.25)).toFixed(1)}y`;
      }

      points.push({
        step: i,
        timeLabel,
        remainingPct,
        usedPct,
        cellCyclesUsed
      });
    }
    return points;
  }, [calculations.activeSeconds, effectiveEndurancePerCell]);

  const handleCopyCode = (codeStr: string, key: string) => {
    navigator.clipboard.writeText(codeStr);
    setCopiedCode(key);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleApplyPreset = (p: WritePreset) => {
    setFreqHz(p.freqHz);
    setPayloadBytes(p.payloadBytes);
    setDirtyRatioPercent(Math.round(p.dirtyRatio * 100));
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute -top-32 -right-32 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  EEPROM Endurance Estimator
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Reliability Calculator
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                쓰기 주파수(Hz) 및 마모 분산(Wear-Leveling) 알고리즘에 따른 EEPROM 소자 수명 예측 & 실리콘 내구성 분석
              </p>
            </div>
          </div>
        </div>

        {/* MCU Selector Quick Pills */}
        <div className="flex items-center gap-2 self-start lg:self-auto">
          <span className="text-[11px] font-medium text-slate-400 mr-1 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" /> 대상 MCU:
          </span>
          {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcu) => (
            <button
              key={mcu}
              onClick={() => onSelectMCU?.(mcu)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                selectedMCU === mcu
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25 ring-2 ring-cyan-400'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
              }`}
            >
              {MCU_PROFILES[mcu].name}
            </button>
          ))}
        </div>
      </div>

      {/* Target MCU EEPROM Specification Snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>용량 (EEPROM)</span>
            <Layers className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="text-lg font-bold font-mono text-cyan-300">
            {spec.sizeBytes.toLocaleString()} <span className="text-xs text-slate-400">Bytes</span>
          </div>
          <div className="text-[10px] text-slate-500">{spec.sizeBytes / 1024} KB 내장 메모리</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>공칭 W/E 수명</span>
            <Sparkles className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="text-lg font-bold font-mono text-emerald-300">
            {spec.nominalEndurance.toLocaleString()} <span className="text-xs text-slate-400">Cycles</span>
          </div>
          <div className="text-[10px] text-slate-500">25°C 상온 보증 기준</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>하드웨어 쓰기 시간</span>
            <Clock className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-lg font-bold font-mono text-amber-300">
            {spec.writeTimeMs} <span className="text-xs text-slate-400">ms</span>
          </div>
          <div className="text-[10px] text-slate-500">최대 한계: {(1000 / spec.writeTimeMs).toFixed(0)} Hz</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>페이지 크기</span>
            <FileCode className="w-3 h-3 text-indigo-400" />
          </div>
          <div className="text-lg font-bold font-mono text-indigo-300">
            {spec.pageSizeBytes} <span className="text-xs text-slate-400">Bytes</span>
          </div>
          <div className="text-[10px] text-slate-500">SPM/버퍼 페이지 단위</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>데이터 보존 수명</span>
            <ShieldCheck className="w-3 h-3 text-purple-400" />
          </div>
          <div className="text-lg font-bold font-mono text-purple-300">
            {operatingTempC <= 25 ? `${spec.retention25CYears}년` : `${spec.retention85CYears}년`}
          </div>
          <div className="text-[10px] text-slate-500">{operatingTempC}°C 환경 산화막 전하</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>동작 전압 범위</span>
            <Zap className="w-3 h-3 text-pink-400" />
          </div>
          <div className="text-lg font-bold font-mono text-pink-300">
            {spec.voltageMin}~{spec.voltageMax} <span className="text-xs text-slate-400">V</span>
          </div>
          <div className="text-[10px] text-slate-500">차지펌프 동작 보장</div>
        </div>
      </div>

      {/* Preset Buttons */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" /> 대표 임베디드 시나리오 프리셋:
          </span>
          <span className="text-[11px] text-slate-500">클릭 시 주파수 및 파라미터 자동 적용</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {WRITE_PRESETS.map((preset) => {
            const isMatch = Math.abs(freqHz - preset.freqHz) < 0.000001;
            const badgeColor =
              preset.category === 'fatal'
                ? 'border-rose-500/40 hover:border-rose-400 bg-rose-500/10 text-rose-300'
                : preset.category === 'warning'
                ? 'border-amber-500/40 hover:border-amber-400 bg-amber-500/10 text-amber-300'
                : preset.category === 'balanced'
                ? 'border-blue-500/40 hover:border-blue-400 bg-blue-500/10 text-blue-300'
                : 'border-emerald-500/40 hover:border-emerald-400 bg-emerald-500/10 text-emerald-300';

            return (
              <button
                key={preset.id}
                onClick={() => handleApplyPreset(preset)}
                className={`p-2.5 rounded-xl border text-left transition-all relative ${badgeColor} ${
                  isMatch ? 'ring-2 ring-cyan-400 scale-[1.02] shadow-lg' : 'opacity-85 hover:opacity-100'
                }`}
              >
                <div className="text-[11px] font-bold truncate leading-tight">{preset.name}</div>
                <div className="text-[10px] font-mono mt-1 opacity-80">
                  {preset.freqHz >= 1
                    ? `${preset.freqHz} Hz`
                    : preset.freqHz >= 1 / 60
                    ? `${(preset.freqHz * 60).toFixed(0)}회/분`
                    : preset.freqHz >= 1 / 3600
                    ? `${(preset.freqHz * 3600).toFixed(0)}회/시간`
                    : `${(preset.freqHz * 86400).toFixed(0)}회/일`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Interactive Controls & Results Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Input Parameters (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-950/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              쓰기 파라미터 설정
            </h4>
            <button
              onClick={() => {
                setFreqHz(1.0);
                setPayloadBytes(4);
                setAllocatedEepromBytes(512);
                setOperatingTempC(25);
                setDirtyRatioPercent(50);
                setUseWearLeveling(true);
              }}
              className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 font-mono transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> 초기화
            </button>
          </div>

          {/* 1. Write Frequency in Hz */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                쓰기 주파수 (Write Frequency):
              </label>
              <span className="font-mono text-xs font-bold text-cyan-300 bg-cyan-950/70 px-2 py-0.5 rounded border border-cyan-800/60">
                {freqHz >= 1
                  ? `${freqHz.toFixed(freqHz >= 10 ? 1 : 2)} Hz`
                  : freqHz >= 1 / 60
                  ? `${(freqHz * 60).toFixed(2)} writes/min`
                  : freqHz >= 1 / 3600
                  ? `${(freqHz * 3600).toFixed(2)} writes/hr`
                  : `${(freqHz * 86400).toFixed(2)} writes/day`}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="-4.94" // ~0.00001157 Hz (1/day)
                max="2.3" // ~200 Hz
                step="0.05"
                value={Math.log10(Math.max(0.00001, freqHz))}
                onChange={(e) => {
                  const val = Math.pow(10, parseFloat(e.target.value));
                  setFreqHz(parseFloat(val.toFixed(6)));
                }}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                min="0.000001"
                max="300"
                value={freqHz}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) setFreqHz(val);
                }}
                className="w-28 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
              />
              <span className="text-xs text-slate-400 font-mono">Hz</span>
              <span className="text-[11px] text-slate-500 ml-auto">
                {freqHz > 0 ? `주기: ${formatLifespan(1 / freqHz)} 당 1회` : ''}
              </span>
            </div>

            {calculations.isHardwareOverdriven && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong>하드웨어 과부하 경고:</strong> EEPROM 쓰기 완료에 최소 {spec.writeTimeMs}ms가 소요되어
                  초당 최대 {(1000 / spec.writeTimeMs).toFixed(0)}회만 처리 가능합니다.
                </div>
              </div>
            )}
          </div>

          {/* 2. Payload Size (Bytes per transaction) */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                트랜잭션당 기록 크기 (Payload):
              </label>
              <span className="font-mono text-xs font-bold text-indigo-300">
                {payloadBytes} Bytes
              </span>
            </div>
            <div className="flex items-center gap-2">
              {[1, 2, 4, 8, 16, 32].map((bytes) => (
                <button
                  key={bytes}
                  onClick={() => setPayloadBytes(bytes)}
                  className={`flex-1 py-1 text-xs font-mono rounded-lg transition-all ${
                    payloadBytes === bytes
                      ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {bytes}B
                </button>
              ))}
            </div>
          </div>

          {/* 3. Wear Leveling Allocation Pool */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                웨어레벨링 할당 풀 (Pool Size):
              </label>
              <span className="font-mono text-xs font-bold text-cyan-300">
                {allocatedEepromBytes} B ({calculations.wearSlots}개 슬롯)
              </span>
            </div>
            <input
              type="range"
              min={payloadBytes}
              max={spec.sizeBytes}
              step={payloadBytes}
              value={allocatedEepromBytes}
              onChange={(e) => setAllocatedEepromBytes(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>최소 {payloadBytes}B (단일슬롯)</span>
              <span>전체 {spec.sizeBytes}B (최대 분산)</span>
            </div>
          </div>

          {/* 4. Operating Temperature Derating */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                동작 온도 (Temperature Derating):
              </label>
              <span className="font-mono text-xs font-bold text-amber-300">
                {operatingTempC}°C ({Math.round(tempDeratingFactor * 100)}% 내구성)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {[25, 50, 70, 85, 105].map((temp) => (
                <button
                  key={temp}
                  onClick={() => setOperatingTempC(temp)}
                  className={`flex-1 py-1 text-xs font-mono rounded-lg transition-all ${
                    operatingTempC === temp
                      ? 'bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {temp}°C
                </button>
              ))}
            </div>
            <div className="text-[10px] text-slate-500 flex items-center justify-between">
              <span>25°C 상온 (100k W/E, 100년 보존)</span>
              <span>85°C 자동차/공업용 (75k W/E, 20년 보존)</span>
            </div>
          </div>

          {/* 5. Dirty Write Ratio (EEPROM.update() filtering) */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                실제 변경 비율 (Dirty Write Rate):
              </label>
              <span className="font-mono text-xs font-bold text-emerald-300">
                {dirtyRatioPercent}%
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={dirtyRatioPercent}
              onChange={(e) => setDirtyRatioPercent(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
            <div className="text-[10px] text-slate-500">
              * `EEPROM.update()` 사용 시 기존 값과 일치하면 하드웨어 쓰기를 생략하여 수명을 연장합니다.
            </div>
          </div>

          {/* Toggle Wear Leveling Mode */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              onClick={() => setUseWearLeveling(!useWearLeveling)}
              className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                useWearLeveling
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-md shadow-cyan-500/10'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                순환 버퍼 웨어레벨링 활성화
              </span>
              <span className="font-mono font-bold">
                {useWearLeveling ? 'ON (x' + calculations.wearSlots + '배 수명)' : 'OFF (단일 셀)'}
              </span>
            </button>
          </div>
        </div>

        {/* Right Column: Key Lifespan Predictions & Health Diagnostics (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main Primary Lifespan Display Card */}
          <div className={`border rounded-2xl p-6 relative overflow-hidden transition-all ${statusInfo.badgeBg}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-cyan-400" /> 예상 EEPROM 파손/수명 한계
                </span>
                <div className="mt-1 text-4xl sm:text-5xl font-black font-mono tracking-tight text-white flex items-baseline gap-2">
                  <span>{formatLifespan(calculations.activeSeconds)}</span>
                  {calculations.activeYears >= 1 && (
                    <span className="text-sm font-normal text-slate-300 font-sans">
                      ({calculations.activeYears.toFixed(2)}년)
                    </span>
                  )}
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex flex-col sm:items-end">
                <div className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${
                  statusInfo.level === 'critical'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                    : statusInfo.level === 'warning'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : statusInfo.level === 'moderate'
                    ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300'
                    : 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                }`}>
                  {statusInfo.title}
                </div>
                <div className="text-[11px] text-slate-300 mt-1 sm:text-right max-w-xs">
                  {statusInfo.desc}
                </div>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-700/50">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">초당 쓰기 횟수</div>
                <div className="text-sm font-bold font-mono text-cyan-200 mt-0.5">
                  {calculations.writesPerSec >= 1
                    ? `${calculations.writesPerSec.toFixed(2)} writes/s`
                    : `${(calculations.writesPerSec * 60).toFixed(2)} writes/m`}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">연간 누적 쓰기</div>
                <div className="text-sm font-bold font-mono text-indigo-200 mt-0.5">
                  {calculations.writesPerYear > 1e6
                    ? `${(calculations.writesPerYear / 1e6).toFixed(2)}M 회/년`
                    : `${Math.round(calculations.writesPerYear).toLocaleString()} 회/년`}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">단일 셀 내구성</div>
                <div className="text-sm font-bold font-mono text-emerald-200 mt-0.5">
                  {effectiveEndurancePerCell.toLocaleString()} Cycles
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">CPU 블로킹 점유율</div>
                <div className="text-sm font-bold font-mono text-amber-200 mt-0.5">
                  {calculations.cpuBlockingPercent >= 100
                    ? '100% (포화)'
                    : `${calculations.cpuBlockingPercent.toFixed(2)}%`}
                </div>
              </div>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            {[
              { id: 'simulator', label: '수명 감쇄 시뮬레이터', icon: TrendingDown },
              { id: 'comparison', label: '전략별 수명 비교', icon: Layers },
              { id: 'code', label: 'C/C++ 방어 코드 생성', icon: Code2 },
              { id: 'physics', label: '실리콘 물리/BOD 안전 가이드', icon: ShieldCheck }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab 1: Degradation Curve Simulator */}
          {activeTab === 'simulator' && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-cyan-400" />
                    운용 시간에 따른 산화막(Oxide) 잔여 내구성 감쇄 곡선
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    Fowler-Nordheim 터널링에 의한 절연 산화막 전하 트랩(Charge Trapping) 진행률 시뮬레이션
                  </p>
                </div>
                <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800/50">
                  {useWearLeveling ? `웨이레벨링 ${calculations.wearSlots}배 연장 적용` : '단일 고정 셀'}
                </span>
              </div>

              <div className="h-52 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={degradationCurveData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="timeLabel"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      unit="%"
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs space-y-1">
                              <div className="font-bold text-white">경과 시간: {data.timeLabel}</div>
                              <div className="text-cyan-400 font-mono">잔여 내구성: {data.remainingPct.toFixed(1)}%</div>
                              <div className="text-amber-400 font-mono">누적 W/E 사이클: {data.cellCyclesUsed.toLocaleString()} 회</div>
                              <div className="text-rose-400 font-mono">마모율: {data.usedPct.toFixed(1)}%</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine y={20} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: '경고 한계 (20%)', fill: '#f43f5e', fontSize: 10 }} />
                    <Line
                      type="monotone"
                      dataKey="remainingPct"
                      stroke="#38bdf8"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#0284c7' }}
                      activeDot={{ r: 6, fill: '#38bdf8' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <div className="text-slate-500">초기 100% 구간</div>
                  <div className="text-emerald-400 font-bold mt-0.5">결함 없는 안전 기록</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <div className="text-slate-500">20% 임계 구간</div>
                  <div className="text-amber-400 font-bold mt-0.5">쓰기 시간 지연 & 재시도 발생</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <div className="text-slate-500">0% 마모 한계</div>
                  <div className="text-rose-400 font-bold mt-0.5">비트 플립 / EERE 영구 에러</div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Strategy Comparison */}
          {activeTab === 'comparison' && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    소프트웨어 설계 기법에 따른 수명 극대화 비교
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    웨어레벨링과 변경 감지 캐시가 하드웨어 수명에 미치는 절대적 영향 (년 단위 비교)
                  </p>
                </div>
              </div>

              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={strategyComparisonData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" fontSize={11} unit="년" />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} width={130} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs space-y-1">
                              <div className="font-bold text-white">{item.name}</div>
                              <div className="text-cyan-400 font-mono">환산 수명: {item.display}</div>
                              <div className="text-slate-400 font-mono">그래프 환산치: {item.years}년</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="years" radius={[0, 6, 6, 0]}>
                      {strategyComparisonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Comparison Table */}
              <div className="space-y-1.5">
                {strategyComparisonData.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-slate-200">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-slate-400 text-[11px]">{item.tag}</span>
                      <span className="font-bold text-white">{item.display}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: C/C++ Code Snippets */}
          {activeTab === 'code' && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    수명 보존 방어 프로그래밍 C/C++ 템플릿
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    실제 펌웨어에서 EEPROM 수명을 수십 배 연장하는 검증된 코드 패턴
                  </p>
                </div>
              </div>

              {/* Snippet 1: EEPROM.update() pattern */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-bold flex items-center gap-1 text-cyan-300">
                    <FileCode className="w-3.5 h-3.5" /> 1. 변경 감지 조건부 쓰기 (EEPROM.update / eeprom_update_block)
                  </span>
                  <button
                    onClick={() =>
                      handleCopyCode(
                        `#include <EEPROM.h>

// [추천] EEPROM.write() 대신 EEPROM.update() 필수 사용!
// 내부적으로 eeprom_read_byte() 후 값이 다를 때만 EEWE/EEPE를 트리거합니다.
void safeWriteConfig(uint16_t addr, float sensorValue) {
    // float 데이터를 바이트 단위로 update
    EEPROM.put(addr, sensorValue); 
    // EEPROM.put()은 내부적으로 update()를 호출하여 동일한 값이면 산화막 마모 0회!
}`,
                        'snippet1'
                      )
                    }
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono"
                  >
                    {copiedCode === 'snippet1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedCode === 'snippet1' ? '복사됨' : '복사'}
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
{`#include <EEPROM.h>

// [규칙 1] 무조건 EEPROM.write() 금지 -> EEPROM.update() 또는 EEPROM.put() 사용!
// 내부적으로 기존 EEPROM 셀 값을 먼저 읽어와 변경된 경우에만 고전압 쓰기를 실행합니다.
void saveSetpoint(uint16_t addr, float targetTemp) {
    EEPROM.put(addr, targetTemp); // 불필요한 고전압 차지펌프 사이클 방지!
}`}
                </pre>
              </div>

              {/* Snippet 2: Circular Ring Buffer Wear Leveling */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-bold flex items-center gap-1 text-indigo-300">
                    <Layers className="w-3.5 h-3.5" /> 2. 순환 링 버퍼 웨어레벨링 구현 (수명 {calculations.wearSlots}배 연장)
                  </span>
                  <button
                    onClick={() =>
                      handleCopyCode(
                        `#include <avr/eeprom.h>

#define RECORD_SIZE       ${payloadBytes}
#define POOL_SIZE         ${allocatedEepromBytes}
#define TOTAL_SLOTS       (POOL_SIZE / RECORD_SIZE) // ${calculations.wearSlots} slots

struct __attribute__((packed)) LogRecord {
    uint32_t seqNumber;   // 단조 증가 시퀀스 번호
    uint8_t  payload[${Math.max(1, payloadBytes - 4)}];
};

static uint16_t currentSlot = 0;
static uint32_t currentSeq = 0;

// 부팅 시 가장 최근 저장된 최신 시퀀스 슬롯 탐색 (O(N))
void initWearLeveling() {
    uint32_t maxSeq = 0;
    for (uint16_t i = 0; i < TOTAL_SLOTS; i++) {
        uint32_t seq = eeprom_read_dword((uint32_t*)(i * sizeof(LogRecord)));
        if (seq != 0xFFFFFFFF && seq > maxSeq) {
            maxSeq = seq;
            currentSlot = i;
            currentSeq = seq;
        }
    }
}

// 다음 순환 슬롯에 차례대로 기록 (단일 셀 마모를 ${calculations.wearSlots}개로 분산)
void writeNextRecord(const uint8_t* data) {
    currentSlot = (currentSlot + 1) % TOTAL_SLOTS;
    currentSeq++;
    
    LogRecord rec;
    rec.seqNumber = currentSeq;
    memcpy(rec.payload, data, sizeof(rec.payload));
    
    eeprom_update_block(&rec, (void*)(currentSlot * sizeof(LogRecord)), sizeof(LogRecord));
}`,
                        'snippet2'
                      )
                    }
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono"
                  >
                    {copiedCode === 'snippet2' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedCode === 'snippet2' ? '복사됨' : '복사'}
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
{`// 순환 버퍼(Circular Buffer) 구조체로 EEPROM ${allocatedEepromBytes}B 영역을 균등 마모
#define SLOTS  ${calculations.wearSlots}  // 총 ${calculations.wearSlots}개 슬롯 순환 기록

void logDataWithWearLeveling(uint32_t value) {
    static uint16_t slot = 0;
    uint16_t eepromAddr = slot * ${payloadBytes};
    
    // 차례대로 다음 주소로 이동하며 기록 (수명 ${calculations.wearSlots}배 연장 효과)
    eeprom_update_dword((uint32_t*)eepromAddr, value);
    slot = (slot + 1) % SLOTS;
}`}
                </pre>
              </div>
            </div>
          )}

          {/* Tab 4: Silicon Physics & Reliability Guide */}
          {activeTab === 'physics' && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                AVR EEPROM 물리적 마모 메커니즘 및 전원 손실 방어
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-400" />
                    플로팅 게이트(Floating Gate) 피로도
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    EEPROM은 절연 산화막(SiO₂ Layer)을 관통하는 Fowler-Nordheim 고전압 터널링(약 12~15V의 내부 차지펌프 전압)을 이용합니다.
                    100,000회를 초과하면 산화막 내부에 전자 트랩(Trap) 결함이 영구 누적되어 문턱전압(Vth)이 쉬프트되며, 0과 1을 판별하지 못하는
                    영구 셀 고장이 발생합니다.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    BOD(Brown-out Detection) 퓨즈 활성화 필수
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    EEPROM 쓰기 도중({spec.writeTimeMs}ms) 전원이 꺼지면 내부 레지스터 포인터가 오동작하여 전혀 엉뚱한 셀의 데이터가 오염됩니다.
                    반드시 퓨즈 비트에서 <strong>BODLEVEL</strong>을 설정(예: 2.7V 또는 4.3V)하여 전압 강하 시 MCU를 즉시 리셋 상태로 고정해야 합니다.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    홀드업 커패시터(Hold-up Capacitor) 계산
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    전원 차단 감지 후 마지막 중요 상태를 EEPROM에 기록하려면 커패시터 에너지가 필요합니다:
                    <br />
                    <code className="text-emerald-300 font-mono text-[10px]">C = (I_total × t_write) / ΔV</code>
                    <br />
                    예: 20mA 소비, 3.4ms 쓰기, 전압 여유 1V → 최소 <strong>68µF</strong> 커패시터가 VCC 라인에 필요합니다.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-purple-300 flex items-center gap-1.5">
                    <Thermometer className="w-4 h-4 text-purple-400" />
                    온도와 데이터 보존 기간(Retention)의 상관관계
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    아레니우스(Arrhenius) 방정식에 의해 온도가 10°C 상승할 때마다 전하 유출 속도가 약 2배 가속됩니다.
                    25°C 상온에서는 100년간 보존되나, 85°C 고온 환경에서는 20년으로 감소하며, 105°C 이상 극한 환경에서는 10년 미만으로 급감합니다.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
