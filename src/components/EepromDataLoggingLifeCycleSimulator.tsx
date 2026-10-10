import React, { useState, useMemo, useEffect } from 'react';
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
  Cpu,
  Play,
  Pause,
  RefreshCw,
  HardDrive,
  Calendar,
  AlertOctagon,
  LifeBuoy
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LineChart,
  Line,
  ReferenceLine,
  AreaChart,
  Area
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
  freqUnit: 'hz' | 'sec' | 'min' | 'hour' | 'day';
  freqValue: number;
  entrySizeBytes: number;
  startAddr: number;
  endAddr: number;
  strategy: 'single_fixed' | 'wear_leveling_ring' | 'eeprom_update_filter';
  dirtyRatio: number; // 0..1
}

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
    writeTimeMs: 8.5,
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
  }
};

const LOGGING_PRESETS: WritePreset[] = [
  {
    id: 'rapid_sensor',
    name: '고속 센서 로깅 (10 Hz, 4B, 단일 주소)',
    description: 'IMU/ADC 원시 데이터를 주소 0x0000에 100ms마다 지속 덮어쓰기 (극위험 안티패턴)',
    freqUnit: 'hz',
    freqValue: 10,
    entrySizeBytes: 4,
    startAddr: 0,
    endAddr: 3,
    strategy: 'single_fixed',
    dirtyRatio: 0.95
  },
  {
    id: 'gps_tracker',
    name: 'GPS 위치 단말기 (1초마다, 8B, 64B 슬롯 링버퍼)',
    description: '차량 관제 단말기 1초 주기 위경도/속도 로그를 64바이트 링버퍼에 분산 저장',
    freqUnit: 'sec',
    freqValue: 1,
    entrySizeBytes: 8,
    startAddr: 0,
    endAddr: 63,
    strategy: 'wear_leveling_ring',
    dirtyRatio: 0.8
  },
  {
    id: 'plant_telemetry',
    name: '산업용 환경 텔레메트리 (10초마다, 16B, 256B 범위)',
    description: '온습도/압력 센서 10초 주기 데이터를 256B 범위 내 순환 기록',
    freqUnit: 'sec',
    freqValue: 10,
    entrySizeBytes: 16,
    startAddr: 32,
    endAddr: 287,
    strategy: 'wear_leveling_ring',
    dirtyRatio: 0.6
  },
  {
    id: 'kwh_meter',
    name: '스마트 전력량계 누적치 (1분마다, 4B, eeprom_update)',
    description: '전력량계 60초 주기 적산치 저장 (변화가 없을 시 쓰기 생략)',
    freqUnit: 'min',
    freqValue: 1,
    entrySizeBytes: 4,
    startAddr: 16,
    endAddr: 19,
    strategy: 'eeprom_update_filter',
    dirtyRatio: 0.4
  },
  {
    id: 'runtime_odometer',
    name: '가동시간/오도미터 (1시간마다, 4B, 전역 순환)',
    description: '장비 누적 운전 시간(Hour Meter)을 512바이트 풀에 고르게 분산',
    freqUnit: 'hour',
    freqValue: 1,
    entrySizeBytes: 4,
    startAddr: 0,
    endAddr: 511,
    strategy: 'wear_leveling_ring',
    dirtyRatio: 1.0
  },
  {
    id: 'user_config',
    name: '사용자 시스템 설정 (1일 1회, 32B, 변경시만)',
    description: '네트워크 IP / 보드 설정 변경 시에만 가끔 기록',
    freqUnit: 'day',
    freqValue: 1,
    entrySizeBytes: 32,
    startAddr: 0,
    endAddr: 31,
    strategy: 'eeprom_update_filter',
    dirtyRatio: 0.1
  }
];

export const EepromDataLoggingLifeCycleSimulator: React.FC<Props> = ({
  selectedMCU,
  onSelectMCU
}) => {
  const spec = MCU_EEPROM_SPECS[selectedMCU];

  // User input states
  const [logEntrySize, setLogEntrySize] = useState<number>(4); // Bytes per entry
  const [freqUnit, setFreqUnit] = useState<'hz' | 'sec' | 'min' | 'hour' | 'day'>('sec');
  const [freqValue, setFreqValue] = useState<number>(1); // e.g. 1 sec, or 10 hz
  const [startAddress, setStartAddress] = useState<number>(0);
  const [endAddress, setEndAddress] = useState<number>(63);
  const [loggingStrategy, setLoggingStrategy] = useState<'single_fixed' | 'wear_leveling_ring' | 'eeprom_update_filter'>('wear_leveling_ring');
  const [dirtyRatioPercent, setDirtyRatioPercent] = useState<number>(75); // % of writes where data differs
  const [operatingTempC, setOperatingTempC] = useState<number>(25);
  const [viewTab, setViewTab] = useState<'map' | 'lifecycle' | 'comparison' | 'code'>('map');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Animated Virtual Burn-in Simulator state
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulatedWritesCount, setSimulatedWritesCount] = useState<number>(0);
  const [simSpeed, setSimSpeed] = useState<number>(500); // writes added per tick

  // Normalize address range
  const safeStart = Math.min(Math.max(0, startAddress), spec.sizeBytes - 1);
  const safeEnd = Math.max(safeStart, Math.min(spec.sizeBytes - 1, endAddress));
  const allocatedRangeBytes = safeEnd - safeStart + 1;
  const safeEntrySize = Math.max(1, Math.min(allocatedRangeBytes, logEntrySize));

  // Number of cyclic slots in the target address range
  const totalSlotsInRange = Math.max(1, Math.floor(allocatedRangeBytes / safeEntrySize));

  // Convert user frequency into writes per second (Hz)
  const writesPerSecond = useMemo(() => {
    const val = Math.max(0.00000001, freqValue);
    switch (freqUnit) {
      case 'hz':
        return val;
      case 'sec':
        return 1 / val;
      case 'min':
        return 1 / (val * 60);
      case 'hour':
        return 1 / (val * 3600);
      case 'day':
        return 1 / (val * 86400);
      default:
        return 1;
    }
  }, [freqUnit, freqValue]);

  // Temperature Derating
  const tempDerating = useMemo(() => {
    if (operatingTempC <= 25) return 1.0;
    if (operatingTempC <= 50) return 1.0 - ((operatingTempC - 25) / 25) * 0.08;
    if (operatingTempC <= 85) return 0.92 - ((operatingTempC - 50) / 35) * 0.17;
    return Math.max(0.3, 0.75 - ((operatingTempC - 85) / 20) * 0.25);
  }, [operatingTempC]);

  const deratedEndurance = Math.round(spec.nominalEndurance * tempDerating);

  // Life-cycle calculations
  const calculations = useMemo(() => {
    const writesPerSec = writesPerSecond;
    const writesPerDay = writesPerSec * 86400;
    const writesPerYear = writesPerDay * 365.25;

    // Effective cell endurance
    const cellLimit = deratedEndurance;

    // 1. Single Fixed Address (No wear leveling, direct write to start address)
    const singleFixedSeconds = cellLimit / writesPerSec;
    const singleFixedDays = singleFixedSeconds / 86400;
    const singleFixedYears = singleFixedDays / 365.25;

    // 2. eeprom_update() on Fixed Address (Only dirty writes touch oxide)
    const dirtyFraction = Math.max(0.01, dirtyRatioPercent / 100);
    const updateFilteredSeconds = cellLimit / (writesPerSec * dirtyFraction);
    const updateFilteredDays = updateFilteredSeconds / 86400;
    const updateFilteredYears = updateFilteredDays / 365.25;

    // 3. Wear-leveling Ring Buffer over [startAddress, endAddress]
    // Every slot gets written once per totalSlotsInRange transactions
    const ringBufferSeconds = (cellLimit * totalSlotsInRange) / writesPerSec;
    const ringBufferDays = ringBufferSeconds / 86400;
    const ringBufferYears = ringBufferDays / 365.25;

    // 4. Combined Ring Buffer + eeprom_update()
    const combinedSeconds = (cellLimit * totalSlotsInRange) / (writesPerSec * dirtyFraction);
    const combinedDays = combinedSeconds / 86400;
    const combinedYears = combinedDays / 365.25;

    // Active strategy lifespan
    let activeLifespanSeconds = singleFixedSeconds;
    if (loggingStrategy === 'wear_leveling_ring') {
      activeLifespanSeconds = ringBufferSeconds;
    } else if (loggingStrategy === 'eeprom_update_filter') {
      activeLifespanSeconds = updateFilteredSeconds;
    }

    const activeYears = activeLifespanSeconds / (86400 * 365.25);
    const activeDays = activeLifespanSeconds / 86400;
    const activeHours = activeLifespanSeconds / 3600;

    // End of Life date projected from current time
    const now = new Date();
    const eolDate = new Date(now.getTime() + activeLifespanSeconds * 1000);

    // Hardware write cycle latency check
    const writeTimeSec = spec.writeTimeMs / 1000;
    const isOverdriven = writesPerSec > (1000 / spec.writeTimeMs);
    const cpuBusSaturation = Math.min(100, (writesPerSec * writeTimeSec) * 100);

    return {
      writesPerSec,
      writesPerDay,
      writesPerYear,
      cellLimit,
      singleFixedSeconds,
      singleFixedDays,
      singleFixedYears,
      updateFilteredSeconds,
      updateFilteredYears,
      ringBufferSeconds,
      ringBufferYears,
      combinedSeconds,
      combinedYears,
      activeLifespanSeconds,
      activeYears,
      activeDays,
      activeHours,
      eolDate,
      isOverdriven,
      cpuBusSaturation
    };
  }, [
    writesPerSecond,
    deratedEndurance,
    dirtyRatioPercent,
    totalSlotsInRange,
    loggingStrategy,
    spec.writeTimeMs
  ]);

  // EOL Alert Classification
  const eolStatus = useMemo(() => {
    if (calculations.isOverdriven) {
      return {
        level: 'fatal',
        badge: '하드웨어 과포화 (Overdrive)',
        color: 'text-rose-400',
        bg: 'bg-rose-950/60 border-rose-500/50 text-rose-200',
        alertTitle: '치명적: 쓰기 주파수가 EEPROM 하드웨어 속도를 초과함',
        alertDesc: `AVR 내부 고전압 차지펌프 쓰기 시간(${spec.writeTimeMs}ms)보다 쓰기 주기가 짧아 MCU가 락업(Lock-up)되거나 쓰기 버퍼가 즉각 손실됩니다.`
      };
    }
    if (calculations.activeYears < (30 / 365.25)) { // under 30 days
      return {
        level: 'critical',
        badge: '즉각 수명 종료 (Immediate EOL)',
        color: 'text-rose-400',
        bg: 'bg-rose-950/60 border-rose-500/50 text-rose-200',
        alertTitle: '경고: 칩 수명이 30일 이내에 완전히 소진됩니다!',
        alertDesc: `단일 주소 고빈도 기록으로 인해 실리콘 산화막(SiO₂) 터널링 마모가 급속도로 누적되어 조기 칩 사망(Brick)이 발생합니다. 순환 링버퍼 웨어레벨링을 즉시 적용하십시오.`
      };
    }
    if (calculations.activeYears < 1.0) { // under 1 year
      return {
        level: 'warning',
        badge: '1년 미만 조기 EOL 위험',
        color: 'text-amber-400',
        bg: 'bg-amber-950/60 border-amber-500/50 text-amber-200',
        alertTitle: '주의: 칩 수명이 1년 이내에 종료될 것으로 예상됩니다.',
        alertDesc: `상용 제품 출하 시 보증 기간(1~3년)을 채우지 못하고 현장 필드 불량(RMA)을 초래할 수 있습니다. 할당 주소 범위를 늘리거나 로깅 주기를 완화하세요.`
      };
    }
    if (calculations.activeYears < 5.0) { // 1 to 5 years
      return {
        level: 'moderate',
        badge: '중기 수명 보존 (1~5년)',
        color: 'text-yellow-400',
        bg: 'bg-yellow-950/50 border-yellow-500/40 text-yellow-200',
        alertTitle: '권장: 일반 가전/프로토타입 수준 수명 확보',
        alertDesc: `1~5년 내 정상 동작하나 장기 운용 산업용 기기(10년 보증)의 경우 eeprom_update() 필터나 외부 I2C EEPROM/FRAM 추가 적용이 추천됩니다.`
      };
    }
    return {
      level: 'safe',
      badge: '장기 신뢰성 인증 (5년+ 안전)',
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200',
      alertTitle: '안전: 실리콘 데이터 보존 수명(Retention) 한계까지 안전',
      alertDesc: `주소 분산 및 주기 설정이 우수하여 산화막 파손 위험이 극히 낮습니다. 칩 수명보다 자연 방전 보존 기간(${operatingTempC <= 25 ? '100년' : '20년'})이 먼저 도달합니다.`
    };
  }, [calculations, spec.writeTimeMs, operatingTempC]);

  // Format Lifespan String
  const formatTimeSpan = (seconds: number): string => {
    if (!isFinite(seconds) || seconds > 1e9) return '> 100년 (영구 유지)';
    if (seconds < 60) return `${seconds.toFixed(1)}초`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}분`;
    if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}시간`;
    const days = seconds / 86400;
    if (days < 365) return `${days.toFixed(1)}일`;
    const years = days / 365.25;
    return `${years.toFixed(2)}년`;
  };

  // Virtual Burn-in animation tick
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isSimulating) {
      interval = setInterval(() => {
        setSimulatedWritesCount((prev) => {
          const maxWrites = calculations.cellLimit * (loggingStrategy === 'wear_leveling_ring' ? totalSlotsInRange : 1);
          if (prev >= maxWrites) {
            setIsSimulating(false);
            return maxWrites;
          }
          return prev + simSpeed;
        });
      }, 50);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSimulating, simSpeed, calculations.cellLimit, loggingStrategy, totalSlotsInRange]);

  // Heatmap Block Representation (64 blocks across EEPROM chip)
  const heatmapBlocks = useMemo(() => {
    const totalBlocks = 64;
    const bytesPerBlock = spec.sizeBytes / totalBlocks;

    return Array.from({ length: totalBlocks }, (_, i) => {
      const blockStart = i * bytesPerBlock;
      const blockEnd = blockStart + bytesPerBlock - 1;

      // Check overlap with user defined address range [safeStart, safeEnd]
      const overlaps = Math.max(blockStart, safeStart) <= Math.min(blockEnd, safeEnd);

      let wearRatio = 0; // 0..1
      let writesOnBlock = 0;

      if (overlaps) {
        if (loggingStrategy === 'single_fixed') {
          // only block containing safeStart gets hit
          if (safeStart >= blockStart && safeStart <= blockEnd) {
            wearRatio = Math.min(1, simulatedWritesCount / calculations.cellLimit);
            writesOnBlock = simulatedWritesCount;
          }
        } else {
          // evenly distributed in allocated range
          const writesPerSlot = simulatedWritesCount / totalSlotsInRange;
          wearRatio = Math.min(1, writesPerSlot / calculations.cellLimit);
          writesOnBlock = Math.round(writesPerSlot);
        }
      }

      return {
        index: i,
        blockStart,
        blockEnd,
        overlaps,
        wearRatio,
        writesOnBlock
      };
    });
  }, [
    spec.sizeBytes,
    safeStart,
    safeEnd,
    loggingStrategy,
    simulatedWritesCount,
    calculations.cellLimit,
    totalSlotsInRange
  ]);

  // Strategy Comparison Data for Chart
  const strategyChartData = useMemo(() => {
    return [
      {
        name: '단일 고정 주소',
        years: Math.min(50, Number(calculations.singleFixedYears.toFixed(2))),
        display: formatTimeSpan(calculations.singleFixedSeconds),
        color: '#f43f5e',
        tag: '위험'
      },
      {
        name: 'eeprom_update() 필터',
        years: Math.min(50, Number(calculations.updateFilteredYears.toFixed(2))),
        display: formatTimeSpan(calculations.updateFilteredSeconds),
        color: '#fbbf24',
        tag: '조건부'
      },
      {
        name: `순환 링버퍼 (${totalSlotsInRange}슬롯)`,
        years: Math.min(50, Number(calculations.ringBufferYears.toFixed(2))),
        display: formatTimeSpan(calculations.ringBufferSeconds),
        color: '#38bdf8',
        tag: '권장'
      },
      {
        name: '링버퍼 + update() 복합',
        years: Math.min(50, Number(calculations.combinedYears.toFixed(2))),
        display: formatTimeSpan(calculations.combinedSeconds),
        color: '#10b981',
        tag: '최적'
      }
    ];
  }, [calculations, totalSlotsInRange]);

  // Life-cycle Survival Curve Data (0% to 100% time)
  const survivalCurveData = useMemo(() => {
    const points = [];
    const totalDuration = calculations.activeLifespanSeconds;
    const steps = 10;

    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const curSeconds = frac * totalDuration;
      const remainingEndurance = Math.max(0, 100 - frac * 100);
      const cellCycles = Math.round(frac * calculations.cellLimit);

      let label = '';
      if (curSeconds < 86400) {
        label = `${(curSeconds / 3600).toFixed(1)}h`;
      } else if (curSeconds < 86400 * 365) {
        label = `${(curSeconds / 86400).toFixed(0)}d`;
      } else {
        label = `${(curSeconds / (86400 * 365.25)).toFixed(1)}y`;
      }

      points.push({
        step: i,
        label,
        endurancePct: remainingEndurance,
        cycles: cellCycles
      });
    }
    return points;
  }, [calculations.activeLifespanSeconds, calculations.cellLimit]);

  const handleCopyCode = (codeStr: string, key: string) => {
    navigator.clipboard.writeText(codeStr);
    setCopiedCode(key);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleApplyPreset = (p: WritePreset) => {
    setFreqUnit(p.freqUnit);
    setFreqValue(p.freqValue);
    setLogEntrySize(p.entrySizeBytes);
    setStartAddress(p.startAddr);
    setEndAddress(Math.min(spec.sizeBytes - 1, p.endAddr));
    setLoggingStrategy(p.strategy);
    setDirtyRatioPercent(Math.round(p.dirtyRatio * 100));
    setSimulatedWritesCount(0);
    setIsSimulating(false);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background ambient accents */}
      <div className="absolute -top-32 -right-32 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  EEPROM Data Logging Life-Cycle Simulator
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  Address Wear & EOL Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                특정 주소 범위 반복 데이터 기록 시 실리콘 산화막 마모 속도 시뮬레이션 및 수명 만료(End of Life) 경보 예측
              </p>
            </div>
          </div>
        </div>

        {/* MCU Selector Quick Switch */}
        <div className="flex items-center gap-2 self-start lg:self-auto">
          <span className="text-[11px] font-medium text-slate-400 mr-1 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-rose-400" /> 대상 MCU:
          </span>
          {(['atmega328p', 'atmega128', 'atmega640'] as SupportedMCU[]).map((mcu) => (
            <button
              key={mcu}
              onClick={() => onSelectMCU?.(mcu)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                selectedMCU === mcu
                  ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/25 ring-2 ring-rose-400 font-bold'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
              }`}
            >
              {MCU_PROFILES[mcu].name}
            </button>
          ))}
        </div>
      </div>

      {/* Target MCU EEPROM Snapshot Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>내장 EEPROM 용량</span>
            <HardDrive className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="text-base font-bold font-mono text-cyan-300">
            {spec.sizeBytes.toLocaleString()} <span className="text-xs text-slate-400">Bytes</span>
          </div>
          <div className="text-[10px] text-slate-500">0x000 ~ 0x{(spec.sizeBytes - 1).toString(16).toUpperCase()}</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>공칭 W/E 사이클</span>
            <Sparkles className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="text-base font-bold font-mono text-emerald-300">
            {spec.nominalEndurance.toLocaleString()} <span className="text-xs text-slate-400">회</span>
          </div>
          <div className="text-[10px] text-slate-500">25°C 상온 표준 보증</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>온도 디레이팅 적용</span>
            <Thermometer className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-base font-bold font-mono text-amber-300">
            {deratedEndurance.toLocaleString()} <span className="text-xs text-slate-400">회</span>
          </div>
          <div className="text-[10px] text-slate-500">{operatingTempC}°C ({(tempDerating * 100).toFixed(0)}% 보정)</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>하드웨어 쓰기 시간</span>
            <Clock className="w-3 h-3 text-indigo-400" />
          </div>
          <div className="text-base font-bold font-mono text-indigo-300">
            {spec.writeTimeMs} <span className="text-xs text-slate-400">ms</span>
          </div>
          <div className="text-[10px] text-slate-500">최대 {(1000 / spec.writeTimeMs).toFixed(0)} writes/s</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>할당 주소 범위</span>
            <Layers className="w-3 h-3 text-rose-400" />
          </div>
          <div className="text-base font-bold font-mono text-rose-300">
            {allocatedRangeBytes} <span className="text-xs text-slate-400">Bytes</span>
          </div>
          <div className="text-[10px] text-slate-500">0x{safeStart.toString(16).toUpperCase()} ~ 0x{safeEnd.toString(16).toUpperCase()}</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1">
          <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
            <span>순환 분산 슬롯</span>
            <RotateCcw className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="text-base font-bold font-mono text-cyan-300">
            {totalSlotsInRange} <span className="text-xs text-slate-400">Slots</span>
          </div>
          <div className="text-[10px] text-slate-500">슬롯당 {safeEntrySize}B 로깅</div>
        </div>
      </div>

      {/* Realistic Logging Preset Buttons */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            실무 산업용 데이터 로깅 시나리오 프리셋:
          </label>
          <span className="text-[11px] text-slate-500">클릭 시 주파수, 크기, 주소 범위가 즉시 설정됩니다</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {LOGGING_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => handleApplyPreset(p)}
              className="text-left p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 transition-all group"
            >
              <div className="text-[11px] font-bold text-slate-200 group-hover:text-rose-300 truncate">
                {p.name.split('(')[0]}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                {p.freqValue}{p.freqUnit} • {p.entrySizeBytes}B
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Simulator Interactive Grid (Left: Config Inputs, Right: EOL Health & Displays) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Logging Parameters Setup (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-rose-400" />
              로깅 파라미터 & 주소 범위 설정
            </h4>
            <span className="text-[10px] font-mono text-slate-500">User Configuration</span>
          </div>

          {/* 1. Log Entry Size */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-rose-400" />
                로그 엔트리 크기 (Entry Size):
              </label>
              <span className="font-mono text-xs font-bold text-rose-300">
                {logEntrySize} Bytes
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {[1, 2, 4, 8, 16, 32].map((bytes) => (
                <button
                  key={bytes}
                  onClick={() => setLogEntrySize(bytes)}
                  className={`py-1.5 text-xs font-mono rounded-lg transition-all ${
                    logEntrySize === bytes
                      ? 'bg-rose-600 text-white font-bold shadow-md shadow-rose-600/30 ring-1 ring-rose-400'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {bytes}B
                </button>
              ))}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center justify-between">
              <span>센서 1개 float: 4B</span>
              <span>위치 GPS: 8B</span>
              <span>환경 복합: 16B</span>
            </div>
          </div>

          {/* 2. Logging Frequency (Value + Unit) */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                데이터 업데이트 주기 (Frequency):
              </label>
              <span className="font-mono text-xs font-bold text-amber-300">
                {calculations.writesPerSec >= 1
                  ? `${calculations.writesPerSec.toFixed(2)} writes/sec`
                  : `1회 / ${formatTimeSpan(1 / calculations.writesPerSec)}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.001"
                step="any"
                value={freqValue}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) setFreqValue(val);
                }}
                className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
              />
              <div className="grid grid-cols-5 gap-1 flex-1">
                {(['hz', 'sec', 'min', 'hour', 'day'] as const).map((unit) => (
                  <button
                    key={unit}
                    onClick={() => setFreqUnit(unit)}
                    className={`py-1 text-xs font-mono rounded-md uppercase transition-all ${
                      freqUnit === unit
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {unit === 'hz' ? 'Hz' : unit === 'sec' ? '초' : unit === 'min' ? '분' : unit === 'hour' ? '시' : '일'}
                  </button>
                ))}
              </div>
            </div>

            {calculations.isOverdriven && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong>하드웨어 과부하:</strong> 하드웨어 EEPROM 쓰기 완료에 {spec.writeTimeMs}ms가 소요되어
                  초당 최대 {(1000 / spec.writeTimeMs).toFixed(0)}회만 처리 가능합니다!
                </div>
              </div>
            )}
          </div>

          {/* 3. Address Range Bounds (Start & End) */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                할당 주소 범위 (Address Range):
              </label>
              <span className="font-mono text-xs font-bold text-cyan-300">
                0x{safeStart.toString(16).toUpperCase()} ~ 0x{safeEnd.toString(16).toUpperCase()} ({allocatedRangeBytes}B)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 font-mono">시작 주소 (Start Addr):</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs font-mono text-slate-500">0x</span>
                  <input
                    type="number"
                    min="0"
                    max={spec.sizeBytes - 1}
                    value={startAddress}
                    onChange={(e) => setStartAddress(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-mono">종료 주소 (End Addr):</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs font-mono text-slate-500">0x</span>
                  <input
                    type="number"
                    min="0"
                    max={spec.sizeBytes - 1}
                    value={endAddress}
                    onChange={(e) => setEndAddress(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            </div>

            {/* Quick Range Presets */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-500">범위 프리셋:</span>
              {[
                { label: '단일(4B)', start: 0, end: 3 },
                { label: '64B', start: 0, end: 63 },
                { label: '256B', start: 0, end: 255 },
                { label: '512B', start: 0, end: 511 },
                { label: `전체(${spec.sizeBytes}B)`, start: 0, end: spec.sizeBytes - 1 }
              ].map((range) => (
                <button
                  key={range.label}
                  onClick={() => {
                    setStartAddress(range.start);
                    setEndAddress(Math.min(spec.sizeBytes - 1, range.end));
                  }}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-slate-400 border border-slate-800"
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Logging Strategy Selection */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
              데이터 기록 전략 (Logging Strategy):
            </label>
            <div className="space-y-1.5">
              {[
                {
                  id: 'single_fixed',
                  name: '단일 고정 주소 직접 덮어쓰기',
                  badge: '안티패턴',
                  badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
                  desc: '시작 주소 한 곳에 매번 write(). 동일 셀만 혹사하여 수명 급감'
                },
                {
                  id: 'wear_leveling_ring',
                  name: `순환 링버퍼 웨어레벨링 (${totalSlotsInRange}개 슬롯)`,
                  badge: '권장 패턴',
                  badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
                  desc: '할당된 주소 범위 내에서 차례대로 다음 슬롯으로 순환 이동하여 기록'
                },
                {
                  id: 'eeprom_update_filter',
                  name: '변경 감지 조건부 쓰기 (eeprom_update)',
                  badge: '지능형 필터',
                  badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                  desc: '기존 값과 동일하면 고전압 쓰기를 건너뛰어 산화막 마모 0회 달성'
                }
              ].map((strat) => (
                <button
                  key={strat.id}
                  onClick={() => setLoggingStrategy(strat.id as any)}
                  className={`w-full p-2.5 rounded-xl border text-left transition-all ${
                    loggingStrategy === strat.id
                      ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md ring-1 ring-indigo-500/30'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{strat.name}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${strat.badgeColor}`}>
                      {strat.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{strat.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 5. Dirty Write Ratio & Temperature */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
                <span>실제 값 변경률:</span>
                <span className="font-mono text-amber-300">{dirtyRatioPercent}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={dirtyRatioPercent}
                onChange={(e) => setDirtyRatioPercent(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 mt-2"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
                <span>동작 온도:</span>
                <span className="font-mono text-rose-300">{operatingTempC}°C</span>
              </div>
              <input
                type="range"
                min="0"
                max="85"
                step="5"
                value={operatingTempC}
                onChange={(e) => setOperatingTempC(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400 mt-2"
              />
            </div>
          </div>
        </div>

        {/* Right Column: EOL Warning Card, Interactive Wear Heatmap & Life-Cycle Predictions (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* EOL Primary Projected Warning Banner */}
          <div className={`border rounded-2xl p-5 relative overflow-hidden transition-all ${eolStatus.bg}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <AlertOctagon className={`w-4 h-4 ${eolStatus.color}`} />
                  예상 수명 만료 (End of Life) 경보 & 전망
                </span>
                <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white flex items-baseline gap-2">
                  <span>{formatTimeSpan(calculations.activeLifespanSeconds)}</span>
                  {calculations.activeYears >= 1 && (
                    <span className="text-xs font-normal text-slate-300 font-sans">
                      (약 {calculations.activeYears.toFixed(2)}년)
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono text-slate-300 flex items-center gap-1 mt-1">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  예상 칩 사망 일자: <strong className="text-white">{calculations.eolDate.toLocaleDateString()} {calculations.eolDate.toLocaleTimeString()}</strong>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex flex-col sm:items-end">
                <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${
                  eolStatus.level === 'fatal' || eolStatus.level === 'critical'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                    : eolStatus.level === 'warning'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : eolStatus.level === 'moderate'
                    ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300'
                    : 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                }`}>
                  {eolStatus.badge}
                </span>
                <p className="text-[11px] text-slate-300 mt-1 sm:text-right max-w-xs leading-relaxed">
                  {eolStatus.alertDesc}
                </p>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-700/50">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">초당 쓰기 부하</div>
                <div className="text-sm font-bold font-mono text-rose-200 mt-0.5">
                  {calculations.writesPerSec >= 1
                    ? `${calculations.writesPerSec.toFixed(2)} writes/s`
                    : `${(calculations.writesPerSec * 60).toFixed(2)} writes/m`}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">연간 누적 쓰기</div>
                <div className="text-sm font-bold font-mono text-amber-200 mt-0.5">
                  {calculations.writesPerYear > 1e6
                    ? `${(calculations.writesPerYear / 1e6).toFixed(2)}M 회/년`
                    : `${Math.round(calculations.writesPerYear).toLocaleString()} 회/년`}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">웨어레벨링 수명 배율</div>
                <div className="text-sm font-bold font-mono text-cyan-200 mt-0.5">
                  {loggingStrategy === 'wear_leveling_ring' ? `x${totalSlotsInRange}배 연장` : '1배 (단일)'}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">하드웨어 버스 점유율</div>
                <div className="text-sm font-bold font-mono text-indigo-200 mt-0.5">
                  {calculations.cpuBusSaturation.toFixed(1)}% 점유
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Visualizer Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            {[
              { id: 'map', label: 'EEPROM 주소별 실시간 마모 히트맵', icon: HardDrive },
              { id: 'lifecycle', label: '수명 감쇄 곡선 (Survial Curve)', icon: TrendingDown },
              { id: 'comparison', label: '전략별 수명 비교', icon: Layers },
              { id: 'code', label: '안전 로깅 C 소스코드 생성', icon: Code2 }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setViewTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    viewTab === tab.id
                      ? 'bg-slate-800 text-rose-300 border border-rose-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab 1: Address Range Wear Heatmap & Virtual Burn-in Simulator */}
          {viewTab === 'map' && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                    칩 실리콘 주소별 마모도 시각화 (64 블록 히트맵)
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    전체 {spec.sizeBytes}바이트 공간 중 <strong>0x{safeStart.toString(16).toUpperCase()} ~ 0x{safeEnd.toString(16).toUpperCase()}</strong> 영역의 산화막 피로도를 표시합니다.
                  </p>
                </div>

                {/* Virtual Burn-in Simulator Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSimulating(!isSimulating)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                      isSimulating
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                        : 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30'
                    }`}
                  >
                    {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {isSimulating ? '시뮬레이션 일시정지' : '가상 가속 쓰기 실행'}
                  </button>
                  <button
                    onClick={() => {
                      setIsSimulating(false);
                      setSimulatedWritesCount(0);
                    }}
                    title="초기화"
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 64-Block Visual Heatmap Grid */}
              <div className="space-y-2">
                <div className="grid grid-cols-16 gap-1 p-2 bg-slate-900/90 border border-slate-800 rounded-xl">
                  {heatmapBlocks.map((block) => {
                    const isHot = block.wearRatio > 0.8;
                    const isMedium = block.wearRatio > 0.3;
                    const isLow = block.wearRatio > 0.01;

                    return (
                      <div
                        key={block.index}
                        title={`블록 #${block.index}: 0x${block.blockStart.toString(16).toUpperCase()} - 0x${block.blockEnd.toString(16).toUpperCase()} (${block.overlaps ? '로깅 영역' : '미사용'})\n누적 쓰기: ${block.writesOnBlock.toLocaleString()}회 (${(block.wearRatio * 100).toFixed(1)}% 마모)`}
                        className={`h-7 rounded flex items-center justify-center text-[9px] font-mono cursor-help transition-all ${
                          !block.overlaps
                            ? 'bg-slate-950/80 border border-slate-800/80 text-slate-600'
                            : isHot
                            ? 'bg-rose-600 border border-rose-400 text-white animate-pulse font-bold'
                            : isMedium
                            ? 'bg-amber-500 border border-amber-300 text-slate-950 font-bold'
                            : isLow
                            ? 'bg-cyan-600 border border-cyan-400 text-white'
                            : 'bg-indigo-950/60 border border-indigo-500/50 text-indigo-300'
                        }`}
                      >
                        {block.overlaps ? (block.wearRatio > 0 ? `${Math.round(block.wearRatio * 100)}%` : '0%') : '·'}
                      </div>
                    );
                  })}
                </div>

                {/* Heatmap Legend */}
                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-slate-950 border border-slate-800" /> 미할당 영역
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-indigo-900 border border-indigo-500" /> 할당됨 (정상)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-cyan-600" /> 경미한 마모 (1~30%)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-amber-500" /> 주의 (30~80%)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-rose-600" /> 수명 만료 (80~100% EOL)
                    </span>
                  </div>
                  <div className="font-mono text-cyan-300">
                    누적 시뮬레이션 쓰기: {simulatedWritesCount.toLocaleString()} 회
                  </div>
                </div>
              </div>

              {/* Diagnosis box */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-slate-300 leading-relaxed">
                  {loggingStrategy === 'single_fixed' ? (
                    <span>
                      <strong className="text-rose-400">단일 고정 주소 안티패턴 감지:</strong> 할당 주소 범위가 {allocatedRangeBytes}바이트임에도 불구하고 첫 주소 0x{safeStart.toString(16).toUpperCase()} 한 곳에만 쓰기가 집중되어
                      주변 메모리는 멀쩡한 채 해당 셀만 <strong>{formatTimeSpan(calculations.singleFixedSeconds)}</strong> 만에 영구 고장납니다.
                    </span>
                  ) : (
                    <span>
                      <strong className="text-emerald-400">순환 링버퍼 마모 분산 정상 가동:</strong> {allocatedRangeBytes}바이트 범위를 {totalSlotsInRange}개 슬롯({safeEntrySize}B씩)으로 분할하여 순차 기록하므로,
                      단일 셀 대비 <strong>{totalSlotsInRange}배</strong>의 수명 연장 효과({formatTimeSpan(calculations.ringBufferSeconds)})를 발휘합니다.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Survival Curve Simulator */}
          {viewTab === 'lifecycle' && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-rose-400" />
                    운용 시간에 따른 산화막(Oxide) 잔여 내구성 감쇄 곡선
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    전하 트랩(Fowler-Nordheim Tunneling) 누적에 따른 잔여 쓰기 보증 비율
                  </p>
                </div>
                <span className="text-[10px] font-mono bg-rose-950 text-rose-300 px-2 py-0.5 rounded border border-rose-800/50">
                  {loggingStrategy === 'wear_leveling_ring' ? `링버퍼 ${totalSlotsInRange}배 연장` : '단일 고정'}
                </span>
              </div>

              <div className="h-52 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={survivalCurveData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="enduranceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="label"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      unit="%"
                      domain={[0, 100]}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs space-y-1">
                              <div className="font-bold text-white">경과 시간: {data.label}</div>
                              <div className="text-rose-400 font-mono">
                                잔여 산화막 수명: {data.endurancePct.toFixed(1)}%
                              </div>
                              <div className="text-slate-400 font-mono">
                                누적 셀 사이클: {data.cycles.toLocaleString()} / {calculations.cellLimit.toLocaleString()}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="endurancePct"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#enduranceGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
                <span>0 시간 (100% 신품)</span>
                <span className="text-rose-400 font-bold">End of Life 도달: {formatTimeSpan(calculations.activeLifespanSeconds)}</span>
              </div>
            </div>
          )}

          {/* Tab 3: Strategy Comparison Chart */}
          {viewTab === 'comparison' && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div>
                <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  소프트웨어 설계 전략에 따른 예상 수명 비교 (년 단위)
                </h5>
                <p className="text-[11px] text-slate-400">
                  단일 주소 덮어쓰기 대비 웨어레벨링과 eeprom_update() 적용 시 칩 수명의 극적 개선 효과
                </p>
              </div>

              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={strategyChartData}
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
                              <div className="text-rose-400 font-mono">예상 수명: {item.display}</div>
                              <div className="text-slate-400 font-mono">차트 환산치: {item.years}년</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="years" radius={[0, 6, 6, 0]}>
                      {strategyChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {strategyChartData.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-slate-200 truncate">{item.name}</span>
                    </div>
                    <span className="font-mono font-bold text-white shrink-0">{item.display}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: C Source Code Generator */}
          {viewTab === 'code' && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    수명 보존 순환 링 버퍼 C/C++ 드라이버 코드
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    주소 0x{safeStart.toString(16).toUpperCase()}~0x{safeEnd.toString(16).toUpperCase()} 영역을 순환하는 고신뢰성 임베디드 펌웨어 코드
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleCopyCode(
                      `#include <avr/eeprom.h>
#include <string.h>

// EEPROM Data Logging Configuration
#define EEPROM_START_ADDR  0x${safeStart.toString(16).toUpperCase()}
#define ENTRY_SIZE         ${safeEntrySize}
#define TOTAL_SLOTS        ${totalSlotsInRange}

// 1. 단조 증가 시퀀스 번호를 포함한 패킷 구조체
struct __attribute__((packed)) LogRecord {
    uint32_t seqNumber;   // 부팅 후 최신 슬롯 탐색용
    uint8_t  payload[${Math.max(1, safeEntrySize - 4)}];
};

static uint16_t currentSlot = 0;
static uint32_t currentSeq = 0;

// 부팅 시 전원 차단 전 마지막 유효 슬롯 탐색 (O(N) 순회)
void eeprom_logger_init(void) {
    uint32_t maxSeq = 0;
    for (uint16_t i = 0; i < TOTAL_SLOTS; i++) {
        uint16_t addr = EEPROM_START_ADDR + (i * sizeof(LogRecord));
        uint32_t seq = eeprom_read_dword((uint32_t*)addr);
        if (seq != 0xFFFFFFFF && seq > maxSeq) {
            maxSeq = seq;
            currentSlot = i;
            currentSeq = seq;
        }
    }
}

// 다음 순환 슬롯에 기록 (단일 셀 마모를 ${totalSlotsInRange}개 슬롯으로 분산)
void eeprom_log_entry(const void* data, uint8_t len) {
    currentSlot = (currentSlot + 1) % TOTAL_SLOTS;
    currentSeq++;
    
    LogRecord rec;
    rec.seqNumber = currentSeq;
    memset(rec.payload, 0, sizeof(rec.payload));
    memcpy(rec.payload, data, len > sizeof(rec.payload) ? sizeof(rec.payload) : len);
    
    uint16_t targetAddr = EEPROM_START_ADDR + (currentSlot * sizeof(LogRecord));
    // eeprom_update_block()은 변경된 바이트만 선택적으로 지우고 기록합니다.
    eeprom_update_block(&rec, (void*)targetAddr, sizeof(LogRecord));
}`,
                      'ring_code'
                    )
                  }
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold shadow-md shadow-emerald-600/30"
                >
                  {copiedCode === 'ring_code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode === 'ring_code' ? '복사 완료' : '전체 코드 복사'}
                </button>
              </div>

              <pre className="p-3 bg-slate-900 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed max-h-72">
{`#include <avr/eeprom.h>

#define EEPROM_START_ADDR  0x${safeStart.toString(16).toUpperCase()}
#define ENTRY_SIZE         ${safeEntrySize}
#define TOTAL_SLOTS        ${totalSlotsInRange}

// 순환 링 버퍼로 EEPROM ${allocatedRangeBytes}바이트 공간을 균등 마모 (수명 ${totalSlotsInRange}배 연장)
void logSensorData(uint32_t sensorValue) {
    static uint16_t slot = 0;
    uint16_t addr = EEPROM_START_ADDR + (slot * ENTRY_SIZE);
    
    // [중요] eeprom_write 대신 eeprom_update 사용으로 중복 쓰기 방어
    eeprom_update_dword((uint32_t*)addr, sensorValue);
    
    // 다음 슬롯으로 순환 이동
    slot = (slot + 1) % TOTAL_SLOTS;
}`}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
