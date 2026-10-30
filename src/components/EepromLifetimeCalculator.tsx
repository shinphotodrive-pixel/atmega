import React, { useState, useMemo } from 'react';
import {
  Database,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  TrendingDown,
  TrendingUp,
  Sliders,
  RotateCcw,
  Code2,
  Info,
  Layers,
  Thermometer,
  ShieldAlert,
  Flame,
  Gauge,
  ArrowRight,
  Sparkles,
  Calendar,
  RefreshCw,
  Cpu
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export const EepromLifetimeCalculator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // 1. User Inputs: Daily write frequency
  const [dailyWrites, setDailyWrites] = useState<number>(50);
  const [dailyWritesInput, setDailyWritesInput] = useState<string>('50');

  // 2. User Inputs: Target service lifespan (in years)
  const [targetYears, setTargetYears] = useState<number>(5);
  const [targetYearsInput, setTargetYearsInput] = useState<string>('5');

  // 3. User Inputs: Payload size per write (bytes)
  const [payloadBytes, setPayloadBytes] = useState<number>(4);

  // 4. Dirty write ratio: % of writes that actually change byte value (eeprom_update_byte optimization)
  const [dirtyRatioPct, setDirtyRatioPct] = useState<number>(100);

  // 5. Operating ambient temperature
  const [tempCondition, setTempCondition] = useState<'25c' | '85c'>('25c');

  // 6. Wear leveling slot count slider (1 = single fixed address)
  const [customSlots, setCustomSlots] = useState<number>(8);

  // Copy state for C code snippet
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // MCU EEPROM Capacity in Bytes
  const eepromCapacityBytes = useMemo(() => {
    switch (selectedMCU) {
      case 'atmega2560':
      case 'atmega640':
      case 'atmega128':
        return 4096; // 4 KB
      case 'atmega328p':
      default:
        return 1024; // 1 KB
    }
  }, [selectedMCU]);

  // Guaranteed endurance from official Microchip/Atmel AVR Datasheet
  const GUARANTEED_CYCLES = 100000; // 100,000 W/E Cycles

  // Frequency preset handlers
  const handleDailyPreset = (val: number) => {
    setDailyWrites(val);
    setDailyWritesInput(val.toString());
  };

  const handleCustomDailyChange = (valStr: string) => {
    setDailyWritesInput(valStr);
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 1000000) {
      setDailyWrites(parsed);
    }
  };

  // Target years preset handlers
  const handleYearsPreset = (val: number) => {
    setTargetYears(val);
    setTargetYearsInput(val.toString());
  };

  const handleCustomYearsChange = (valStr: string) => {
    setTargetYearsInput(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
      setTargetYears(parsed);
    }
  };

  // ---------------------------------------------------------------------------
  // Calculations
  // ---------------------------------------------------------------------------
  const stats = useMemo(() => {
    // Effective daily writes considering dirty-write filtering
    const effectiveDailyWrites = dailyWrites * (dirtyRatioPct / 100);
    const annualWrites = effectiveDailyWrites * 365.25;
    const totalTargetCycles = annualWrites * targetYears;

    // Single fixed-address cell statistics
    const singleCellLifeDays = effectiveDailyWrites > 0 ? GUARANTEED_CYCLES / effectiveDailyWrites : Infinity;
    const singleCellLifeYears = singleCellLifeDays / 365.25;

    // Percentage of endurance consumed over target lifespan
    const singleCellConsumptionPct = (totalTargetCycles / GUARANTEED_CYCLES) * 100;

    // Wear leveling necessity verdict
    let necessityLevel: 'safe' | 'warning' | 'critical';
    let necessityBadge: string;
    let necessityDesc: string;

    if (singleCellLifeYears < targetYears) {
      necessityLevel = 'critical';
      necessityBadge = '마모 레벨링 필수 (MANDATORY)';
      necessityDesc = `단일 주소에 계속 기록할 경우 목표 서비스 기간(${targetYears}년)에 도달하기 전 약 ${singleCellLifeYears >= 1 ? `${singleCellLifeYears.toFixed(1)}년` : `${Math.round(singleCellLifeDays)}일`} 만에 10만 회 보증 수명이 소진되어 셀 손상(Write Failure)이 발생합니다.`;
    } else if (singleCellConsumptionPct > 60) {
      necessityLevel = 'warning';
      necessityBadge = '마모 레벨링 권장 (RECOMMENDED)';
      necessityDesc = `단일 주소 쓰기로도 이론상 버티지만, 목표 기간 내 보증 사이클의 ${singleCellConsumptionPct.toFixed(0)}%를 소모합니다. 전원 불안정이나 온도 스트레스 마진 확보를 위해 링 버퍼 분산 저장을 적극 권장합니다.`;
    } else {
      necessityLevel = 'safe';
      necessityBadge = '단일 주소 쓰기 안전 (SAFE)';
      necessityDesc = `목표 서비스 기간(${targetYears}년) 동안 총 ${Math.round(totalTargetCycles).toLocaleString()}회만 기록되어 보증 수명의 단 ${singleCellConsumptionPct.toFixed(1)}%만 사용합니다. 추가 마모 레벨링 없이도 안전합니다.`;
    }

    // Recommended wear leveling slots
    // Goal: Keep consumption under 40% of endurance over target lifespan
    const targetSafeConsumption = 0.5; // 50% max consumption
    const minRequiredSlots = Math.max(1, Math.ceil(totalTargetCycles / (GUARANTEED_CYCLES * targetSafeConsumption)));
    const maxPossibleSlots = Math.max(1, Math.floor((eepromCapacityBytes * 0.8) / Math.max(1, payloadBytes)));
    const recommendedSlots = Math.min(maxPossibleSlots, Math.max(minRequiredSlots, customSlots));

    // Wear leveled statistics with current customSlots
    const effectiveSlots = Math.max(1, customSlots);
    const leveledDailyPerCell = effectiveDailyWrites / effectiveSlots;
    const leveledLifeDays = leveledDailyPerCell > 0 ? GUARANTEED_CYCLES / leveledDailyPerCell : Infinity;
    const leveledLifeYears = leveledLifeDays / 365.25;
    const leveledConsumptionPct = singleCellConsumptionPct / effectiveSlots;

    // Memory usage
    const memoryUsedBytes = effectiveSlots * payloadBytes;
    const memoryUsagePct = (memoryUsedBytes / eepromCapacityBytes) * 100;

    // Data retention from datasheet
    const dataRetentionYears = tempCondition === '25c' ? '100년 (25°C 상온 기준)' : '20년 (85°C 고온 한계 기준)';

    return {
      effectiveDailyWrites,
      annualWrites,
      totalTargetCycles,
      singleCellLifeDays,
      singleCellLifeYears,
      singleCellConsumptionPct,
      necessityLevel,
      necessityBadge,
      necessityDesc,
      minRequiredSlots,
      maxPossibleSlots,
      recommendedSlots,
      effectiveSlots,
      leveledLifeYears,
      leveledConsumptionPct,
      memoryUsedBytes,
      memoryUsagePct,
      dataRetentionYears
    };
  }, [dailyWrites, dirtyRatioPct, targetYears, customSlots, payloadBytes, eepromCapacityBytes, tempCondition]);

  // C code snippet for Circular Buffer Wear Leveling
  const cCodeSnippet = useMemo(() => {
    return `// ============================================================================
// ${currentProfile.name} EEPROM Circular Ring-Buffer Wear Leveling Driver
// - EEPROM 용량: ${eepromCapacityBytes} 바이트 (보증 쓰기 주기: 100,000 W/E Cycles)
// - 슬롯 개수: ${stats.effectiveSlots}개 (각 슬롯 페이로드: ${payloadBytes}바이트)
// - 예상 수명 배율: 단일 주소 대비 ${stats.effectiveSlots}배 수명 연장 (${stats.leveledLifeYears.toFixed(1)}년)
// ============================================================================

#include <avr/io.h>
#include <avr/eeprom.h>
#include <stdint.h>
#include <stdbool.h>

#define WEAR_LEVEL_SLOTS   ${stats.effectiveSlots}
#define PAYLOAD_SIZE_BYTES ${payloadBytes}
#define EEPROM_START_ADDR  0x0020 // 32번지부터 배치

// 레코드 구조체: 시퀀스 카운터 + 실제 데이터
typedef struct {
    uint32_t seq_id;                    // 4바이트 시퀀스 (가장 최신 슬롯 추적용)
    uint8_t  payload[PAYLOAD_SIZE_BYTES]; // 사용자 데이터
} __attribute__((packed)) EepromRecord;

// 1. 최신 기록 슬롯 탐색 (부팅 시 1회 호출)
static uint16_t current_slot_idx = 0;
static uint32_t current_max_seq = 0;

void EEPROM_WearLevel_Init(void) {
    current_max_seq = 0;
    current_slot_idx = 0;

    for (uint16_t i = 0; i < WEAR_LEVEL_SLOTS; i++) {
        uint16_t addr = EEPROM_START_ADDR + (i * sizeof(EepromRecord));
        uint32_t seq = eeprom_read_dword((uint32_t*)addr);

        // 비어있는 미기록 셀(0xFFFFFFFF) 제외 및 최신 시퀀스 검색
        if (seq != 0xFFFFFFFF && seq >= current_max_seq) {
            current_max_seq = seq;
            current_slot_idx = i;
        }
    }
}

// 2. 새로운 데이터 쓰기 (다음 슬롯으로 순환하여 기록)
bool EEPROM_WearLevel_Write(const uint8_t* data) {
    // 다음 슬롯 인덱스 계산 (원형 순환)
    uint16_t next_slot = (current_slot_idx + 1) % WEAR_LEVEL_SLOTS;
    uint16_t addr = EEPROM_START_ADDR + (next_slot * sizeof(EepromRecord));

    EepromRecord record;
    record.seq_id = current_max_seq + 1;
    for (uint8_t i = 0; i < PAYLOAD_SIZE_BYTES; i++) {
        record.payload[i] = data[i];
    }

    // eeprom_update_block: 변경된 바이트만 실제 물리 셀 기록(Write-wear 방지)
    eeprom_update_block(&record, (void*)addr, sizeof(EepromRecord));

    current_slot_idx = next_slot;
    current_max_seq++;
    return true;
}

// 3. 최신 데이터 읽기
bool EEPROM_WearLevel_ReadLatest(uint8_t* out_data) {
    uint16_t addr = EEPROM_START_ADDR + (current_slot_idx * sizeof(EepromRecord));
    EepromRecord record;
    eeprom_read_block(&record, (const void*)addr, sizeof(EepromRecord));

    for (uint8_t i = 0; i < PAYLOAD_SIZE_BYTES; i++) {
        out_data[i] = record.payload[i];
    }
    return true;
}
`;
  }, [currentProfile.name, eepromCapacityBytes, stats.effectiveSlots, payloadBytes, stats.leveledLifeYears]);

  const copyCode = () => {
    navigator.clipboard.writeText(cCodeSnippet);
    setCopiedCode(true);
    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.8 }
    });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div id="eeprom-lifetime-calculator-section" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur shadow-2xl space-y-6 scroll-mt-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <Database className="w-3.5 h-3.5" /> EEPROM 수명 & 내구성 분석기
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              100,000 W/E Cycles Endurance Evaluator
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-xs font-mono font-bold">
              {currentProfile.name} ({eepromCapacityBytes.toLocaleString()} Bytes)
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            EEPROM 수명/내구성 계산기 (EEPROM Lifetime & Wear-Leveling Advisor)
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            하루 예상 쓰기 횟수와 목표 서비스 연수(Target Service Years)를 입력하면, Atmel/Microchip 공식 데이터시트의
            <strong className="text-cyan-300 font-mono"> 보증 쓰기 주기(100,000 W/E Cycles)</strong>를 기반으로 예상 수명 통계와
            <strong className="text-amber-300 font-mono"> 마모 레벨링(Wear Leveling) 필요 여부</strong> 및 링 버퍼 분산 효과를 정밀 분석합니다.
          </p>
        </div>

        {/* Quick MCU Switcher */}
        {onSelectMCU && (
          <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 shrink-0">
            {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
              <button
                key={mcuId}
                onClick={() => onSelectMCU(mcuId)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                  selectedMCU === mcuId
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {MCU_PROFILES[mcuId].name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Control & Input Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (6 cols): Primary Inputs */}
        <div className="lg:col-span-6 space-y-4">
          {/* Card 1: Daily Writes Input */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-cyan-400" />
                1. 하루 예상 쓰기 횟수 (Estimated Daily Writes)
              </label>
              <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
                {dailyWrites.toLocaleString()} 회/일
              </span>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {[
                { val: 1, label: '1회/일', desc: '일일 전원 카운터' },
                { val: 10, label: '10회/일', desc: '간헐적 설정 변경' },
                { val: 50, label: '50회/일', desc: '작업 세션 상태' },
                { val: 240, label: '240회/일', desc: '6분 주기 센서' },
                { val: 1440, label: '1,440회/일', desc: '1분 주기 로깅 (위험)' },
                { val: 86400, label: '86,400회/일', desc: '1초 주기 루프 (치명적)' }
              ].map((preset) => {
                const isSelected = dailyWrites === preset.val;
                return (
                  <button
                    key={preset.val}
                    onClick={() => handleDailyPreset(preset.val)}
                    className={`p-2 rounded-xl text-left border transition ${
                      isSelected
                        ? 'bg-cyan-500/20 text-white border-cyan-500/60 shadow-sm ring-1 ring-cyan-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold font-mono text-cyan-300">{preset.label}</div>
                    <div className="text-[10px] text-slate-400 truncate">{preset.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Direct Number Input */}
            <div className="pt-1">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-mono">
                <span>직접 쓰기 횟수 입력:</span>
                <span className="text-[11px] text-slate-500">
                  {dailyWrites >= 86400
                    ? `(매 ${(86400 / dailyWrites).toFixed(1)}초마다 1회 쓰기)`
                    : dailyWrites >= 1440
                    ? `(매 ${(1440 / dailyWrites).toFixed(1)}분마다 1회 쓰기)`
                    : `(매 ${(24 / dailyWrites).toFixed(2)}시간마다 1회 쓰기)`}
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  value={dailyWritesInput}
                  onChange={(e) => handleCustomDailyChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
                  placeholder="예: 50"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">writes / day</span>
              </div>
            </div>
          </div>

          {/* Card 2: Target Service Years Input */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-400" />
                2. 제품 목표 서비스 연수 (Target Service Lifespan)
              </label>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                {targetYears} 년 보증
              </span>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {[1, 3, 5, 7, 10, 15].map((years) => {
                const isSelected = targetYears === years;
                return (
                  <button
                    key={years}
                    onClick={() => handleYearsPreset(years)}
                    className={`py-2 px-1 text-center rounded-xl border transition ${
                      isSelected
                        ? 'bg-amber-500/20 text-white border-amber-500/60 shadow-sm ring-1 ring-amber-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold font-mono text-amber-300">{years}년</div>
                  </button>
                );
              })}
            </div>

            {/* Direct Number Input */}
            <div className="pt-1">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-mono">
                <span>직접 서비스 연수 입력:</span>
                <span className="text-[11px] text-slate-500">
                  (총 {Math.round(targetYears * 365.25).toLocaleString()}일 동안 무고장 보증 목표)
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0.5"
                  max="40"
                  step="0.5"
                  value={targetYearsInput}
                  onChange={(e) => handleCustomYearsChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                  placeholder="예: 5"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">years</span>
              </div>
            </div>
          </div>

          {/* Card 3: Additional Engineering Parameters (Payload, Dirty Ratio, Temp) */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <span className="text-xs font-bold text-slate-200 block border-b border-slate-800/70 pb-2">
              3. 하드웨어 세부 변수 (데이터 크기 & 온도 & 업데이트 최적화)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Payload Size */}
              <div>
                <label className="text-slate-400 block mb-1">기록 크기 (Payload)</label>
                <select
                  value={payloadBytes}
                  onChange={(e) => setPayloadBytes(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-mono"
                >
                  <option value={1}>1 Byte (상태 플래그)</option>
                  <option value={2}>2 Bytes (uint16_t)</option>
                  <option value={4}>4 Bytes (float/uint32)</option>
                  <option value={8}>8 Bytes (타임스탬프/더블)</option>
                  <option value={16}>16 Bytes (구조체 설정값)</option>
                  <option value={32}>32 Bytes (레코드 블록)</option>
                </select>
              </div>

              {/* Dirty Write Filter */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-400">실제 변경율 (Dirty %)</label>
                  <span className="text-cyan-400 font-mono">{dirtyRatioPct}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="10"
                  value={dirtyRatioPct}
                  onChange={(e) => setDirtyRatioPct(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 block truncate">eeprom_update 적용 시 절감</span>
              </div>

              {/* Operating Temp */}
              <div>
                <label className="text-slate-400 block mb-1">동작 주변 온도</label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => setTempCondition('25c')}
                    className={`py-1.5 px-2 text-center rounded-xl border text-[11px] font-mono transition ${
                      tempCondition === '25c'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    25°C 상온
                  </button>
                  <button
                    onClick={() => setTempCondition('85c')}
                    className={`py-1.5 px-2 text-center rounded-xl border text-[11px] font-mono transition ${
                      tempCondition === '85c'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    85°C 고온
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                  보존: {tempCondition === '25c' ? '100년' : '20년'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (6 cols): Analysis & Statistics & Wear-Leveling Verdict */}
        <div className="lg:col-span-6 space-y-4">
          {/* Main Verdict Card */}
          <div
            className={`rounded-2xl p-5 border shadow-xl transition space-y-4 ${
              stats.necessityLevel === 'critical'
                ? 'bg-rose-950/40 border-rose-700/60 text-rose-200 shadow-rose-950/20'
                : stats.necessityLevel === 'warning'
                ? 'bg-amber-950/40 border-amber-700/60 text-amber-200 shadow-amber-950/20'
                : 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200 shadow-emerald-950/20'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider block opacity-75">
                  마모 레벨링 필요 여부 분석 판정 결과
                </span>
                <h4 className="text-lg font-black flex items-center gap-2">
                  {stats.necessityLevel === 'critical' ? (
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  ) : stats.necessityLevel === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  )}
                  <span>{stats.necessityBadge}</span>
                </h4>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                  stats.necessityLevel === 'critical'
                    ? 'bg-rose-500 text-slate-950 border-rose-400'
                    : stats.necessityLevel === 'warning'
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-emerald-500 text-slate-950 border-emerald-400'
                }`}
              >
                소진율 {stats.singleCellConsumptionPct.toFixed(1)}%
              </span>
            </div>

            <p className="text-xs leading-relaxed opacity-90 border-t border-slate-800/60 pt-2.5">
              {stats.necessityDesc}
            </p>

            {/* Stat Row */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block font-mono">단일 셀 예상 잔존 수명</span>
                <span
                  className={`text-xl sm:text-2xl font-black font-mono block mt-0.5 ${
                    stats.singleCellLifeYears < targetYears ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {stats.singleCellLifeYears >= 100
                    ? '> 100년'
                    : stats.singleCellLifeYears >= 1
                    ? `${stats.singleCellLifeYears.toFixed(1)} 년`
                    : `${Math.round(stats.singleCellLifeDays)} 일`}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  목표 {targetYears}년 대비 {stats.singleCellLifeYears < targetYears ? '조기 사망 위험' : '충족'}
                </span>
              </div>

              <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block font-mono">목표 기간 내 총 소모 사이클</span>
                <span className="text-xl sm:text-2xl font-black font-mono text-cyan-400 block mt-0.5">
                  {Math.round(stats.totalTargetCycles).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  / 100,000 회 보증 ({((stats.totalTargetCycles / GUARANTEED_CYCLES) * 100).toFixed(0)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Wear Leveling Simulator Card */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                원형 링 버퍼(Circular Buffer) 마모 레벨링 효과 시뮬레이터
              </span>
              <span className="text-[11px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                {stats.effectiveSlots}개 슬롯 분산
              </span>
            </div>

            {/* Slider to adjust slots */}
            <div>
              <div className="flex justify-between items-center text-xs font-mono mb-1.5">
                <span className="text-slate-400">분산 슬롯 개수 (Ring Buffer Slots):</span>
                <span className="text-purple-300 font-bold">{customSlots} 개 슬롯 (수명 {customSlots}배 연장)</span>
              </div>
              <input
                type="range"
                min="1"
                max={Math.min(64, stats.maxPossibleSlots)}
                step="1"
                value={customSlots}
                onChange={(e) => setCustomSlots(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>1개 (단일 고정 주소)</span>
                <span>추천: {stats.recommendedSlots}개</span>
                <span>최대 가용: {Math.min(64, stats.maxPossibleSlots)}개</span>
              </div>
            </div>

            {/* Wear Leveling Results Breakdown */}
            <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3.5 space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">마모 레벨링 적용 후 수명:</span>
                <span className="text-emerald-400 font-bold text-sm">
                  {stats.leveledLifeYears >= 100
                    ? '> 100년 (초장기 반영구)'
                    : `${stats.leveledLifeYears.toFixed(1)}년 (${(stats.leveledLifeYears / stats.singleCellLifeYears).toFixed(0)}배 증대)`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">목표 기간 내 셀당 소진율:</span>
                <span className="text-cyan-300 font-bold">
                  {stats.leveledConsumptionPct.toFixed(1)}% ({stats.leveledConsumptionPct <= 40 ? '✅ 초안전' : '⚠️ 주의'})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">소요 EEPROM 메모리:</span>
                <span className="text-slate-300">
                  {stats.memoryUsedBytes} Bytes ({stats.memoryUsagePct.toFixed(1)}% of {eepromCapacityBytes}B)
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-800/80 pt-2 text-[11px]">
                <span className="text-slate-400">데이터시트 보존 신뢰성:</span>
                <span className="text-amber-400">{stats.dataRetentionYears}</span>
              </div>
            </div>

            {/* Visual Ring Buffer Slots */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400 font-mono block">
                EEPROM 링 버퍼 순환 구조 시각화 (Active Write Head: Slot 0)
              </span>
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900/50 rounded-xl border border-slate-800/60 max-h-24 overflow-y-auto">
                {Array.from({ length: Math.min(32, stats.effectiveSlots) }).map((_, i) => (
                  <div
                    key={i}
                    className={`px-2 py-1 rounded text-[10px] font-mono border text-center transition ${
                      i === 0
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/60 font-bold ring-1 ring-purple-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    #{i}
                  </div>
                ))}
                {stats.effectiveSlots > 32 && (
                  <div className="px-2 py-1 rounded text-[10px] font-mono text-slate-500 border border-dashed border-slate-800 flex items-center">
                    +{stats.effectiveSlots - 32}개 더 있음
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Comparison: Fixed Single Cell vs Wear-Leveled Ring Buffer */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            단일 주소 고정 기록 vs 마모 레벨링(Wear Leveling) 적용 정밀 비교
          </span>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold">
            {stats.effectiveSlots}배 수명 증대 효과
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
          {/* Card 1: Fixed Single Address */}
          <div className="p-4 rounded-xl border bg-slate-950 border-slate-800 space-y-2">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-300 text-sm">단일 고정 주소 쓰기 (Naive Write)</span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-bold">1개 슬롯</span>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>동작 방식:</span>
                <span className="text-slate-300">동일한 EEPROM 주소에 매회 덮어쓰기</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>일일 셀당 쓰기 횟수:</span>
                <span className="text-white font-bold">{Math.round(stats.effectiveDailyWrites).toLocaleString()} 회/일</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>목표 기간({targetYears}년) 소진율:</span>
                <span className={`font-bold ${stats.singleCellConsumptionPct > 80 ? 'text-rose-400' : 'text-amber-400'}`}>
                  {stats.singleCellConsumptionPct.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1.5">
                <span className="text-slate-400">예상 고장 시점 (Time-to-Failure):</span>
                <span className={`font-bold ${stats.singleCellLifeYears < targetYears ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {stats.singleCellLifeYears >= 100
                    ? '> 100년'
                    : stats.singleCellLifeYears >= 1
                    ? `${stats.singleCellLifeYears.toFixed(1)} 년`
                    : `${Math.round(stats.singleCellLifeDays)} 일 후 고장`}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Wear Leveling Buffer */}
          <div className="p-4 rounded-xl border bg-slate-900 border-purple-500/60 shadow-lg space-y-2 ring-1 ring-purple-500/40">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="font-bold text-white text-sm">마모 레벨링 원형 링 버퍼 (Wear Leveled)</span>
              <span className="text-[10px] bg-purple-500 text-white px-2 py-0.5 rounded font-bold">
                {stats.effectiveSlots}개 슬롯 분산
              </span>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>동작 방식:</span>
                <span className="text-purple-300">N개 슬롯을 라운드로빈 순환 기록</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>일일 셀당 쓰기 횟수:</span>
                <span className="text-emerald-400 font-bold">
                  {(stats.effectiveDailyWrites / stats.effectiveSlots).toFixed(2)} 회/일 ({stats.effectiveSlots}배 경감)
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>목표 기간({targetYears}년) 소진율:</span>
                <span className="text-emerald-400 font-bold">
                  {stats.leveledConsumptionPct.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1.5">
                <span className="text-slate-400">예상 고장 시점 (Time-to-Failure):</span>
                <span className="text-emerald-400 font-bold">
                  {stats.leveledLifeYears >= 100
                    ? '> 100년 (영구 보존)'
                    : `${stats.leveledLifeYears.toFixed(1)} 년`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Production-Ready Wear Leveling C Source Code */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold text-white">
              C 언어 EEPROM 마모 레벨링 링 버퍼 드라이버 소스코드 ({currentProfile.name})
            </span>
          </div>
          <button
            onClick={copyCode}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? '복사 완료!' : 'C 소스코드 복사'}</span>
          </button>
        </div>
        <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-72 custom-scrollbar leading-relaxed">
          {cCodeSnippet}
        </pre>
      </div>
    </div>
  );
};
