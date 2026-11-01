import React, { useState, useMemo } from 'react';
import {
  Database,
  Clock,
  Sliders,
  Copy,
  Check,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Info,
  ShieldCheck,
  ShieldAlert,
  Gauge,
  Activity,
  Layers,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  Sparkles,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
}

export const EepromEnduranceCalculator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Hardware EEPROM capacity in Bytes
  // currentProfile.eeprom is in KB (1, 4) -> convert to Bytes
  const totalEepromBytes = useMemo(() => {
    return currentProfile.eeprom * 1024;
  }, [currentProfile]);

  // User Inputs
  const [siliconEnduranceCycles, setSiliconEnduranceCycles] = useState<number>(100000); // 100,000 cycles standard AVR
  const [targetLifespanYears, setTargetLifespanYears] = useState<number>(10); // 10 years default
  const [recordSizeBytes, setRecordSizeBytes] = useState<number>(4); // e.g. 4-byte float/uint32 timestamp
  const [allocatedEepromBytes, setAllocatedEepromBytes] = useState<number>(totalEepromBytes); // default full EEPROM
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Sync allocated size when MCU changes
  React.useEffect(() => {
    setAllocatedEepromBytes(totalEepromBytes);
  }, [totalEepromBytes]);

  // Calculations
  const calculations = useMemo(() => {
    // Total lifespan in seconds
    const secondsPerYear = 365.25 * 24 * 3600;
    const totalLifespanSeconds = targetLifespanYears * secondsPerYear;

    // Fixed Address (No wear leveling)
    // One cell can endure siliconEnduranceCycles writes
    const fixedAddressMaxWrites = siliconEnduranceCycles;
    const fixedIntervalSeconds = totalLifespanSeconds / fixedAddressMaxWrites;
    const fixedWritesPerDay = fixedAddressMaxWrites / (targetLifespanYears * 365.25);

    // Wear Leveling (Circular slot rotation)
    // Number of available slots = floor(Allocated EEPROM / Record Size)
    const totalSlots = Math.max(1, Math.floor(allocatedEepromBytes / recordSizeBytes));
    const totalWearLeveledWrites = siliconEnduranceCycles * totalSlots;

    // Minimum write interval required to guarantee target lifespan
    const wearLeveledIntervalSeconds = +(totalLifespanSeconds / totalWearLeveledWrites).toFixed(2);
    const wearLeveledWritesPerDay = +(totalWearLeveledWrites / (targetLifespanYears * 365.25)).toFixed(1);
    const wearLeveledWritesPerHour = +(wearLeveledWritesPerDay / 24).toFixed(1);

    // Lifespan extension factor
    const extensionFactor = totalSlots;

    // Format interval nicely
    const formatDuration = (sec: number): string => {
      if (sec < 1) return `${(sec * 1000).toFixed(0)} ms`;
      if (sec < 60) return `${sec.toFixed(1)} 초`;
      if (sec < 3600) return `${(sec / 60).toFixed(1)} 분 (${Math.round(sec)}초)`;
      if (sec < 86400) return `${(sec / 3600).toFixed(1)} 시간`;
      return `${(sec / 86400).toFixed(1)} 일`;
    };

    return {
      totalLifespanSeconds,
      fixedIntervalSeconds,
      fixedIntervalFormatted: formatDuration(fixedIntervalSeconds),
      fixedWritesPerDay: Math.round(fixedWritesPerDay),
      totalSlots,
      totalWearLeveledWrites,
      wearLeveledIntervalSeconds,
      wearLeveledIntervalFormatted: formatDuration(wearLeveledIntervalSeconds),
      wearLeveledWritesPerDay,
      wearLeveledWritesPerHour,
      extensionFactor
    };
  }, [siliconEnduranceCycles, targetLifespanYears, recordSizeBytes, allocatedEepromBytes]);

  // Recording Frequency Scenarios Table
  const scenarioMatrix = useMemo(() => {
    const intervals = [
      { label: '매 1초마다 (1s)', intervalSec: 1 },
      { label: '매 5초마다 (5s)', intervalSec: 5 },
      { label: '매 10초마다 (10s)', intervalSec: 10 },
      { label: '매 1분마다 (60s)', intervalSec: 60 },
      { label: '매 5분마다 (300s)', intervalSec: 300 },
      { label: '매 1시간마다 (3600s)', intervalSec: 3600 }
    ];

    const secondsPerYear = 365.25 * 24 * 3600;

    return intervals.map((item) => {
      // Fixed life = (siliconEnduranceCycles * intervalSec) / secondsPerYear
      const fixedLifeYears = +((siliconEnduranceCycles * item.intervalSec) / secondsPerYear).toFixed(2);
      // Wear leveled life = fixedLifeYears * totalSlots
      const wlLifeYears = +(fixedLifeYears * calculations.totalSlots).toFixed(2);

      const meetsTarget = wlLifeYears >= targetLifespanYears;

      return {
        ...item,
        fixedLifeYears,
        wlLifeYears,
        meetsTarget
      };
    });
  }, [siliconEnduranceCycles, calculations.totalSlots, targetLifespanYears]);

  // Generated C Wear-Leveling Ring Buffer Code
  const generatedCImplementation = useMemo(() => {
    const slotCount = calculations.totalSlots;
    const recSize = recordSizeBytes;

    return `// =========================================================================
// AVR EEPROM 고신뢰성 웨어 레벨링 (Wear Leveling) 링버퍼 드라이버
// Target MCU     : ${currentProfile.name} (EEPROM 용량: ${totalEepromBytes.toLocaleString()} Bytes)
// 목표 수명      : ${targetLifespanYears}년 (실리콘 내구성: ${siliconEnduranceCycles.toLocaleString()}회 W/E)
// 할당 공간      : ${allocatedEepromBytes}B / 슬롯당 ${recSize}B -> 총 ${slotCount}개 슬롯
// 필요 최소 주기 : ${calculations.wearLeveledIntervalFormatted} 마다 기록 시 ${targetLifespanYears}년 완벽 보장
// =========================================================================
#include <avr/io.h>
#include <avr/eeprom.h>

#define EEPROM_SLOT_COUNT    ${slotCount}
#define EEPROM_RECORD_SIZE   ${recSize}
#define EEPROM_BASE_ADDR     0x0000

// 1. 순환 시퀀스 번호를 포함한 데이터 레코드 구조체
typedef struct {
    uint32_t seq_id;    // 롤오버 방지 32비트 순차 카운터 (최신 레코드 탐색용)
    uint8_t  payload[${Math.max(1, recSize - 4)}]; // 사용자 데이터 (센서값, 설정값 등)
} __attribute__((packed)) EepromRecord;

// 2. 최신 유효 레코드 탐색 (부팅 시 1회 실행)
uint16_t g_current_slot = 0;
uint32_t g_last_seq = 0;

void eeprom_wl_init(void) {
    uint32_t max_seq = 0;
    uint16_t best_slot = 0;
    EepromRecord temp;

    for (uint16_t i = 0; i < EEPROM_SLOT_COUNT; i++) {
        uint16_t addr = EEPROM_BASE_ADDR + (i * sizeof(EepromRecord));
        eeprom_read_block(&temp, (const void *)addr, sizeof(EepromRecord));
        
        // 0xFFFFFFFF는 미기록 빈 슬롯
        if (temp.seq_id != 0xFFFFFFFF && temp.seq_id >= max_seq) {
            max_seq = temp.seq_id;
            best_slot = i;
        }
    }

    g_last_seq = max_seq;
    // 다음 기록 슬롯 지정 (원형 링버퍼 순환)
    g_current_slot = (best_slot + 1) % EEPROM_SLOT_COUNT;
}

// 3. 웨어 레벨링 순환 기록 함수 (단일 셀 피로도를 ${slotCount}분의 1로 분산)
void eeprom_wl_write(const uint8_t *data_in) {
    EepromRecord new_rec;
    new_rec.seq_id = ++g_last_seq;
    
    for (uint8_t i = 0; i < sizeof(new_rec.payload); i++) {
        new_rec.payload[i] = data_in[i];
    }

    uint16_t write_addr = EEPROM_BASE_ADDR + (g_current_slot * sizeof(EepromRecord));
    
    // eeprom_update_block은 값이 다를 때만 실제 EEPROM 쓰기 사이클을 소모함
    eeprom_update_block(&new_rec, (void *)write_addr, sizeof(EepromRecord));

    // 다음 슬롯으로 전진
    g_current_slot = (g_current_slot + 1) % EEPROM_SLOT_COUNT;
}
`;
  }, [
    currentProfile,
    totalEepromBytes,
    targetLifespanYears,
    siliconEnduranceCycles,
    allocatedEepromBytes,
    recordSizeBytes,
    calculations
  ]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCImplementation);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.85 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div id="eeprom-endurance-calculator-section" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur-xl shadow-2xl space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
            <HardDrive className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                EEPROM 수명 & 웨어 레벨링 계산기 (Endurance Calculator)
              </h3>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                Wear Leveling Engine
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                {currentProfile.name} • {totalEepromBytes.toLocaleString()} B
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              MCU 내장 EEPROM의 <strong>총 재기록 보증 횟수(Rewrite Cycles)</strong>와 <strong>목표 제품 수명(Target Lifespan in Years)</strong>을 입력받아, 특정 셀 집중 마모를 방지하고 목표 수명을 달성하기 위한 <strong>필요 최소 웨어 레벨링 기록 주기(Required Wear Leveling Interval)</strong>와 순환 링버퍼 슬롯 크기를 산출합니다.
            </p>
          </div>
        </div>

        {/* Quick Lifespan Target Pills */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400 font-mono">목표 수명:</span>
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            {[1, 3, 5, 10, 15, 20].map((y) => (
              <button
                key={y}
                onClick={() => setTargetLifespanYears(y)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  targetLifespanYears === y
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {y}년
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main KPI Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Required Wear Leveling Interval */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4.5 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-emerald-400" /> 웨어 레벨링 시 허용 기록 주기
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-bold">
              {targetLifespanYears}년 보장
            </span>
          </div>
          <div className="text-3xl font-black text-emerald-400 font-mono tracking-tight mt-1">
            {calculations.wearLeveledIntervalFormatted}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            매 {calculations.wearLeveledIntervalSeconds}초마다 기록 가능 ({calculations.wearLeveledWritesPerDay.toLocaleString()}회/일)
          </p>
        </div>

        {/* KPI 2: Fixed Address Interval (Without Wear Leveling) */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4.5 relative overflow-hidden group hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> 고정 주소 기록 시 한계 주기
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40 font-bold">
              No Wear Leveling
            </span>
          </div>
          <div className="text-3xl font-black text-rose-400 font-mono tracking-tight mt-1">
            {calculations.fixedIntervalFormatted}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {calculations.fixedIntervalFormatted}보다 자주 쓰면 {targetLifespanYears}년 이내 실리콘 파괴
          </p>
        </div>

        {/* KPI 3: Available Slots & Extension Factor */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4.5 relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Layers className="w-3.5 h-3.5 text-cyan-400" /> 순환 슬롯 수 & 수명 증대
            </span>
            <span className="text-[10px] font-mono text-cyan-300 font-bold">
              {calculations.extensionFactor}x 배속
            </span>
          </div>
          <div className="text-3xl font-black text-cyan-400 font-mono tracking-tight mt-1">
            {calculations.totalSlots.toLocaleString()} <span className="text-sm font-normal text-slate-400">슬롯</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            {allocatedEepromBytes}B 공간 ÷ 레코드 {recordSizeBytes}B
          </p>
        </div>

        {/* KPI 4: Total Lifetime System Writes */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4.5 relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> 총 보장 기록 회수
            </span>
            <span className="text-[10px] font-mono text-amber-300 font-bold">
              누적 Writes
            </span>
          </div>
          <div className="text-3xl font-black text-amber-400 font-mono tracking-tight mt-1">
            {(calculations.totalWearLeveledWrites / 1_000_000).toFixed(1)}M <span className="text-sm font-normal text-slate-400">회</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            {calculations.totalWearLeveledWrites.toLocaleString()}회 안전 기록
          </p>
        </div>
      </div>

      {/* Interactive Sliders & Parameter Configuration */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              EEPROM 수명 파라미터 제어
            </h4>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            실시간 반응 수명 및 주기 산출 엔진
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Silicon Endurance Cycles */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold">실리콘 재기록 수명:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={10000}
                  max={1000000}
                  step={10000}
                  value={siliconEnduranceCycles}
                  onChange={(e) => setSiliconEnduranceCycles(Math.max(1000, parseInt(e.target.value) || 100000))}
                  className="w-24 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-right text-amber-400 font-bold text-xs"
                />
                <span className="text-amber-400 font-bold text-[11px]">회</span>
              </div>
            </div>
            <input
              type="range"
              min={10000}
              max={300000}
              step={10000}
              value={siliconEnduranceCycles}
              onChange={(e) => setSiliconEnduranceCycles(parseInt(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>10k (최소)</span>
              <span>100,000회 (AVR 표준)</span>
              <span>300k (고품질)</span>
            </div>
          </div>

          {/* Target Lifespan (Years) */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold">목표 제품 수명 (Lifespan):</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={targetLifespanYears}
                  onChange={(e) => setTargetLifespanYears(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                  className="w-16 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-right text-emerald-400 font-bold text-xs"
                />
                <span className="text-emerald-400 font-bold text-[11px]">년</span>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={targetLifespanYears}
              onChange={(e) => setTargetLifespanYears(parseInt(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1년 (단기)</span>
              <span>10년 (산업용 표준)</span>
              <span>30년 (고내구)</span>
            </div>
          </div>

          {/* Record Payload Size */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold">1회 기록 레코드 크기:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={64}
                  value={recordSizeBytes}
                  onChange={(e) => setRecordSizeBytes(Math.max(1, Math.min(64, parseInt(e.target.value) || 4)))}
                  className="w-16 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-right text-cyan-400 font-bold text-xs"
                />
                <span className="text-cyan-400 font-bold text-[11px]">B</span>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={32}
              step={1}
              value={recordSizeBytes}
              onChange={(e) => setRecordSizeBytes(parseInt(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1B (단일값)</span>
              <span>4B (uint32/float)</span>
              <span>32B (구조체)</span>
            </div>
          </div>

          {/* Allocated EEPROM for Wear Leveling */}
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 font-semibold">할당된 EEPROM 공간:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={64}
                  max={totalEepromBytes}
                  step={64}
                  value={allocatedEepromBytes}
                  onChange={(e) => setAllocatedEepromBytes(Math.max(64, Math.min(totalEepromBytes, parseInt(e.target.value) || 256)))}
                  className="w-20 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-right text-purple-400 font-bold text-xs"
                />
                <span className="text-purple-400 font-bold text-[11px]">B</span>
              </div>
            </div>
            <input
              type="range"
              min={64}
              max={totalEepromBytes}
              step={64}
              value={allocatedEepromBytes}
              onChange={(e) => setAllocatedEepromBytes(parseInt(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>64B (부분 버퍼)</span>
              <span>{Math.round(totalEepromBytes / 2)}B (50%)</span>
              <span>{totalEepromBytes}B (전체)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recording Frequency vs Expected Lifespan Matrix */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              기록 주기별 기대 제품 수명 비교표 (Recording Interval vs Lifespan)
            </h4>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            목표 수명: {targetLifespanYears}년 기준 통과(Pass/Fail) 판정
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">기록 주기 (Interval)</th>
                <th className="py-2.5 px-3">일일 쓰기 횟수</th>
                <th className="py-2.5 px-3">고정 주소 기록 시 수명</th>
                <th className="py-2.5 px-3">웨어 레벨링 적용 시 수명</th>
                <th className="py-2.5 px-3 text-right">수명 보장 여부</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono">
              {scenarioMatrix.map((sc, idx) => (
                <tr key={idx} className="hover:bg-slate-900/40 transition">
                  <td className="py-3 px-3 font-bold text-white">
                    {sc.label}
                  </td>
                  <td className="py-3 px-3 text-slate-300">
                    {(86400 / sc.intervalSec).toLocaleString()} 회/일
                  </td>
                  <td className="py-3 px-3 text-rose-400">
                    {sc.fixedLifeYears < 0.1 ? `${Math.round(sc.fixedLifeYears * 365.25)}일` : `${sc.fixedLifeYears}년`}
                  </td>
                  <td className="py-3 px-3 text-emerald-400 font-bold">
                    {sc.wlLifeYears >= 100 ? `${(sc.wlLifeYears / 100).toFixed(0)}세기 (${sc.wlLifeYears.toLocaleString()}년)` : `${sc.wlLifeYears}년`}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {sc.meetsTarget ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50 text-[11px] font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 통과 (Pass)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-700/50 text-[11px] font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" /> 미달 (Fail)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Production-grade C Wear-leveling Code Generator */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              생성된 C 언어 EEPROM 링버퍼 웨어 레벨링 드라이버 코드
            </h4>
          </div>
          <button
            onClick={handleCopyCode}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 shrink-0 font-sans"
          >
            {copiedCode ? <Check className="w-4 h-4 text-slate-950" /> : <Copy className="w-4 h-4" />}
            <span>{copiedCode ? '복사 완료!' : 'C 링버퍼 드라이버 코드 복사'}</span>
          </button>
        </div>

        <pre className="p-4 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed max-h-80 select-all">
          {generatedCImplementation}
        </pre>
      </div>
    </div>
  );
};
