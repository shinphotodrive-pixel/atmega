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
  Plus,
  Trash2,
  Terminal,
  Cpu
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days';

export interface EepromVariableItem {
  id: string;
  name: string;
  sizeBytes: number;
  writeIntervalValue: number; // e.g. 10
  writeIntervalUnit: TimeUnit; // 'seconds' | 'minutes' | 'hours' | 'days'
  dirtyRatioPct: number; // % of writes that actually change the stored value (e.g. 80%)
  wearLevelSlots: number; // 1 = fixed address, 16 = 16-slot circular buffer
  description: string;
}

const DEFAULT_VARIABLES: EepromVariableItem[] = [
  {
    id: 'var_boot_count',
    name: 'boot_counter (부팅 횟수 누적 카운터)',
    sizeBytes: 2,
    writeIntervalValue: 1,
    writeIntervalUnit: 'days',
    dirtyRatioPct: 100,
    wearLevelSlots: 1,
    description: '기기 재부팅 시마다 1회 기록 (하루 평균 1~2회 전원 인가)'
  },
  {
    id: 'var_sys_settings',
    name: 'device_config (사용자 UI 설정값)',
    sizeBytes: 16,
    writeIntervalValue: 6,
    writeIntervalUnit: 'hours',
    dirtyRatioPct: 30,
    wearLevelSlots: 1,
    description: '디스플레이 밝기, 네트워크 설정 등 사용자 조작 시 갱신'
  },
  {
    id: 'var_sensor_log',
    name: 'telemetry_log (센서 측정값 주기적 저장)',
    sizeBytes: 4,
    writeIntervalValue: 10,
    writeIntervalUnit: 'seconds',
    dirtyRatioPct: 90,
    wearLevelSlots: 1,
    description: '온습도/전압/센서 주기적 로깅 (위험 안티패턴 가능성 높음)'
  }
];

export const EepromEndurancePredictor: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // MCU EEPROM Hardware Specs
  const eepromCapacityBytes = useMemo(() => {
    switch (selectedMCU) {
      case 'atmega328p':
        return 1024; // 1 KB
      case 'atmega128':
      case 'atmega640':
      case 'atmega2560':
      default:
        return 4096; // 4 KB
    }
  }, [selectedMCU]);

  // Guaranteed cycle limit per byte (Atmel/Microchip Datasheet: 100,000 W/E cycles)
  const [ratedCycles, setRatedCycles] = useState<number>(100000);
  // Silicon Margin multiplier (typical silicon survives 2x ~ 3x rated before bit flip)
  const [siliconMarginX, setSiliconMarginX] = useState<number>(1.5);
  // Ambient Operating Temperature (°C)
  const [ambientTempC, setAmbientTempC] = useState<number>(35);

  // Variable list state
  const [variables, setVariables] = useState<EepromVariableItem[]>(DEFAULT_VARIABLES);
  const [selectedVarId, setSelectedVarId] = useState<string>(DEFAULT_VARIABLES[2].id);

  // New variable form state
  const [newVarName, setNewVarName] = useState<string>('runtime_stat');
  const [newVarSize, setNewVarSize] = useState<number>(4);
  const [newVarInterval, setNewVarInterval] = useState<number>(1);
  const [newVarUnit, setNewVarUnit] = useState<TimeUnit>('minutes');
  const [newVarDirty, setNewVarDirty] = useState<number>(80);
  const [newVarSlots, setNewVarSlots] = useState<number>(1);

  // Copy status
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Selected variable for detail inspection
  const activeVariable = variables.find((v) => v.id === selectedVarId) || variables[0];

  // Convert write interval to frequency in Writes Per Second (Hz)
  const getWritesPerSecond = (val: number, unit: TimeUnit): number => {
    if (val <= 0) return 0;
    switch (unit) {
      case 'seconds':
        return 1 / val;
      case 'minutes':
        return 1 / (val * 60);
      case 'hours':
        return 1 / (val * 3600);
      case 'days':
        return 1 / (val * 86400);
    }
  };

  // Convert seconds to human-readable duration
  const formatDuration = (totalSeconds: number): string => {
    if (!isFinite(totalSeconds) || totalSeconds <= 0) return '무제한 (0회 쓰기)';
    if (totalSeconds < 60) return `${totalSeconds.toFixed(1)} 초`;
    const minutes = totalSeconds / 60;
    if (minutes < 60) return `${minutes.toFixed(1)} 분`;
    const hours = minutes / 60;
    if (hours < 48) return `${hours.toFixed(1)} 시간`;
    const days = hours / 24;
    if (days < 365) return `${days.toFixed(1)} 일 (${(days / 30.4).toFixed(1)} 개월)`;
    const years = days / 365.25;
    if (years < 1000) return `${years.toFixed(1)} 년`;
    return '1,000년 이상 (안전)';
  };

  // Temperature acceleration derating factor (Arrhenius model approximation for EEPROM oxide trap)
  // Higher temp causes faster charge leakage and oxide breakdown
  const tempDeratingFactor = useMemo(() => {
    if (ambientTempC <= 25) return 1.0;
    if (ambientTempC <= 55) return 1.15;
    if (ambientTempC <= 70) return 1.35;
    return 1.65; // At 85°C high temp
  }, [ambientTempC]);

  // Comprehensive Calculations for Active Variable
  const varPrediction = useMemo(() => {
    if (!activeVariable) return null;

    const writesPerSec = getWritesPerSecond(activeVariable.writeIntervalValue, activeVariable.writeIntervalUnit);
    const writesPerDay = writesPerSec * 86400;
    const writesPerYear = writesPerDay * 365.25;

    // Actual physical writes if using standard unconditional eeprom_write_byte
    const effectiveCyclesLimit = (ratedCycles * siliconMarginX) / tempDeratingFactor;

    // 1. Direct Unconditional Write (Worst Case / No Wear Leveling / Fixed Address)
    const directSecondsToFailure = writesPerSec > 0 ? effectiveCyclesLimit / writesPerSec : Infinity;

    // 2. Dirty-Check Optimized Write (e.g. EEPROM.update / eeprom_update_byte)
    // Only writes when data actually changes
    const dirtyFraction = Math.max(0.01, activeVariable.dirtyRatioPct / 100);
    const dirtyEffectiveWritesPerSec = writesPerSec * dirtyFraction;
    const dirtySecondsToFailure = dirtyEffectiveWritesPerSec > 0 ? effectiveCyclesLimit / dirtyEffectiveWritesPerSec : Infinity;

    // 3. Circular Wear Leveling Buffer (Distributed across N slots)
    const slots = Math.max(1, activeVariable.wearLevelSlots);
    const wearLevelSecondsToFailure = directSecondsToFailure * slots;

    // 4. Combined Best Practice: Dirty Check + Wear Leveling
    const bestCaseSecondsToFailure = dirtySecondsToFailure * slots;

    // Lifespan severity rating based on direct write
    let severity: 'fatal' | 'warning' | 'moderate' | 'safe' = 'safe';
    const directDays = directSecondsToFailure / 86400;
    if (directDays < 30) severity = 'fatal';
    else if (directDays < 365) severity = 'warning';
    else if (directDays < 365 * 5) severity = 'moderate';
    else severity = 'safe';

    return {
      writesPerSec,
      writesPerDay,
      writesPerYear,
      effectiveCyclesLimit,
      directSecondsToFailure,
      dirtySecondsToFailure,
      wearLevelSecondsToFailure,
      bestCaseSecondsToFailure,
      severity
    };
  }, [activeVariable, ratedCycles, siliconMarginX, tempDeratingFactor]);

  // Total EEPROM Memory Allocation Summary Across All Variables
  const totalAllocatedBytes = useMemo(() => {
    return variables.reduce((sum, v) => sum + v.sizeBytes * Math.max(1, v.wearLevelSlots), 0);
  }, [variables]);

  const eepromUsagePct = (totalAllocatedBytes / eepromCapacityBytes) * 100;

  // Add new variable handler
  const handleAddVariable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVarName.trim()) return;

    const newId = `var_${Date.now()}`;
    const newItem: EepromVariableItem = {
      id: newId,
      name: newVarName.trim(),
      sizeBytes: Math.max(1, newVarSize),
      writeIntervalValue: Math.max(1, newVarInterval),
      writeIntervalUnit: newVarUnit,
      dirtyRatioPct: Math.max(1, Math.min(100, newVarDirty)),
      wearLevelSlots: Math.max(1, newVarSlots),
      description: '사용자 정의 EEPROM 변수'
    };

    setVariables((prev) => [...prev, newItem]);
    setSelectedVarId(newId);
    setNewVarName('');
  };

  // Remove variable handler
  const handleRemoveVariable = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (variables.length <= 1) return;
    setVariables((prev) => prev.filter((v) => v.id !== id));
    if (selectedVarId === id) {
      const remaining = variables.filter((v) => v.id !== id);
      setSelectedVarId(remaining[0].id);
    }
  };

  // Apply Quick Preset
  const applyPresetScenario = (scenario: 'high_freq' | 'periodic' | 'event_driven' | 'wear_leveled') => {
    if (scenario === 'high_freq') {
      // 100Hz IMU Blackbox
      const item: EepromVariableItem = {
        id: `var_telemetry_${Date.now()}`,
        name: 'raw_imu_telemetry (안티패턴: 100ms 주기)',
        sizeBytes: 6,
        writeIntervalValue: 100,
        writeIntervalUnit: 'seconds',
        dirtyRatioPct: 95,
        wearLevelSlots: 1,
        description: '루프 내 무차별 쓰기 (초고속 EEPROM 파괴 안티패턴)'
      };
      setVariables((prev) => [...prev, item]);
      setSelectedVarId(item.id);
    } else if (scenario === 'periodic') {
      const item: EepromVariableItem = {
        id: `var_periodic_${Date.now()}`,
        name: 'hourly_power_kwh (1시간 주기 전력량 저장)',
        sizeBytes: 4,
        writeIntervalValue: 1,
        writeIntervalUnit: 'hours',
        dirtyRatioPct: 90,
        wearLevelSlots: 1,
        description: '스마트 미터기 1시간 단위 누적 적산 전력량 저장'
      };
      setVariables((prev) => [...prev, item]);
      setSelectedVarId(item.id);
    } else if (scenario === 'event_driven') {
      const item: EepromVariableItem = {
        id: `var_event_${Date.now()}`,
        name: 'user_calibration (캘리브레이션 오프셋)',
        sizeBytes: 8,
        writeIntervalValue: 7,
        writeIntervalUnit: 'days',
        dirtyRatioPct: 15,
        wearLevelSlots: 1,
        description: '장비 영점 교정 시에만 기록 (주 1회 이하 이벤트성)'
      };
      setVariables((prev) => [...prev, item]);
      setSelectedVarId(item.id);
    } else if (scenario === 'wear_leveled') {
      const item: EepromVariableItem = {
        id: `var_leveled_${Date.now()}`,
        name: 'sensor_wear_ring (32-슬롯 링버퍼 레벨링)',
        sizeBytes: 4,
        writeIntervalValue: 1,
        writeIntervalUnit: 'minutes',
        dirtyRatioPct: 80,
        wearLevelSlots: 32,
        description: '32개 순환 슬롯에 분산 기록하여 수명을 32배 연장'
      };
      setVariables((prev) => [...prev, item]);
      setSelectedVarId(item.id);
    }
  };

  // Copy C-Code handler
  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.7 }
    });
  };

  // C Driver Code Generation
  const generatedCCode = useMemo(() => {
    if (!activeVariable) return '';
    const slots = activeVariable.wearLevelSlots;
    const isRing = slots > 1;

    return `// ==============================================================================
// ${currentProfile.name} EEPROM 무결성 & 수명 연장 최적화 C 드라이버
// 변수명         : ${activeVariable.name}
// 데이터 크기     : ${activeVariable.sizeBytes} Bytes | 슬롯 수: ${slots}
// 쓰기 주기       : ${activeVariable.writeIntervalValue} ${activeVariable.writeIntervalUnit}
// 예상 도달 수명   : ${varPrediction ? formatDuration(varPrediction.bestCaseSecondsToFailure) : '계산중'}
// ==============================================================================
#include <avr/io.h>
#include <avr/eeprom.h>
#include <stdbool.h>

#define EEPROM_SLOT_COUNT ${slots}
#define VAR_SIZE          ${activeVariable.sizeBytes}

// EEPROM 시작 할당 주소 (EEMEM 속성 활용)
uint8_t EEMEM eeprom_storage_buffer[EEPROM_SLOT_COUNT * VAR_SIZE];
${isRing ? `uint8_t EEMEM eeprom_head_index = 0;\n` : ''}
/**
 * @brief 하드웨어 수명 보호형 Dirty-Check 업데이트 함수
 * 값이 기존과 동일할 경우 불필요한 플래시 산화막 소거/기록을 스킵하여 10만 회 수명 보존
 */
void EEPROM_SafeUpdateBlock(const void* src, void* eeprom_dst, size_t n) {
    const uint8_t* p_src = (const uint8_t*)src;
    uint8_t* p_dst = (uint8_t*)eeprom_dst;

    for (size_t i = 0; i < n; i++) {
        // eeprom_update_byte: 내부적으로 eeprom_read_byte 수행 후 불일치 시에만 eeprom_write_byte 호출
        eeprom_update_byte(p_dst + i, p_src[i]);
    }
}
${isRing ? `
/**
 * @brief ${slots}개 순환 링버퍼 웨어 레벨링(Wear-Leveling) 기록 함수
 * 물리적 주소를 순환 회전하여 단일 셀 집중 마모를 방지하고 수명을 ${slots}배 연장합니다.
 */
void EEPROM_Write_WearLeveled(const uint8_t* payload) {
    // 1. 현재 헤드 인덱스 로드
    uint8_t head = eeprom_read_byte(&eeprom_head_index);
    if (head >= EEPROM_SLOT_COUNT) head = 0;

    // 2. 해당 슬롯 위치에 데이터 기록
    uint8_t* slot_addr = &eeprom_storage_buffer[head * VAR_SIZE];
    EEPROM_SafeUpdateBlock(payload, slot_addr, VAR_SIZE);

    // 3. 인덱스 전진 후 갱신
    head = (head + 1) % EEPROM_SLOT_COUNT;
    eeprom_update_byte(&eeprom_head_index, head);
}
` : ''}`;
  }, [activeVariable, currentProfile.name, varPrediction]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <Database className="w-3.5 h-3.5" /> EEPROM Endurance Predictor
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              Silicon Wear & Time-to-Failure Simulator
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-xs font-mono font-bold">
              {currentProfile.name} ({eepromCapacityBytes} B)
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            EEPROM 수명 & 고장 시점 예측기 (EEPROM Endurance Predictor)
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            임베디드 펌웨어에서 저장할 <strong>변수별 기록 주기(Write Frequency)</strong>와 <strong>데이터 크기</strong>를 설정하면,
            {currentProfile.name}의 하드웨어 EEPROM 보증 수명(10만 회 W/E)을 기반으로{' '}
            <strong className="text-amber-300">예상 고장 도달 시점(Time-to-Failure)</strong>을 정밀 산출하고,{' '}
            <strong className="text-cyan-300">Dirty-Check (EEPROM.update)</strong> 및{' '}
            <strong className="text-emerald-300">웨어 레벨링(Wear-Leveling)</strong> 적용 시의 수명 연장 효과를 비교 분석합니다.
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

      {/* Quick Scenario Preset Buttons */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            대표적 기록 시나리오 원클릭 추가 (Quick Scenario Presets):
          </span>
          <span className="text-[11px] text-slate-500">클릭 시 변수 목록에 즉시 추가</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <button
            onClick={() => applyPresetScenario('high_freq')}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/60 hover:bg-rose-950/20 text-left transition group"
          >
            <span className="text-rose-400 font-bold block text-[11px] group-hover:underline">
              🚨 100ms 주기 고빈도 기록
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">센서 루프 내 무차별 쓰기 안티패턴</span>
          </button>

          <button
            onClick={() => applyPresetScenario('periodic')}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/60 hover:bg-cyan-950/20 text-left transition group"
          >
            <span className="text-cyan-400 font-bold block text-[11px] group-hover:underline">
              ⏱️ 1시간 단위 적산 전력량
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">정기적 상태 백업 (4 바이트)</span>
          </button>

          <button
            onClick={() => applyPresetScenario('event_driven')}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/60 hover:bg-emerald-950/20 text-left transition group"
          >
            <span className="text-emerald-400 font-bold block text-[11px] group-hover:underline">
              🛡️ 주 1회 캘리브레이션
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">사용자 조작 이벤트성 (영구 안정)</span>
          </button>

          <button
            onClick={() => applyPresetScenario('wear_leveled')}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/60 hover:bg-purple-950/20 text-left transition group"
          >
            <span className="text-purple-400 font-bold block text-[11px] group-hover:underline">
              🔄 32-슬롯 순환 링버퍼
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">1분 주기 쓰기 + 32배 수명 연장</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left (Variables Manager) & Right (Endurance Prediction & Comparison) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Variables List & Configuration Form */}
        <div className="lg:col-span-5 space-y-4">
          {/* Section 1: Variable List */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-amber-400" />
                모니터링 대상 EEPROM 변수 목록 ({variables.length}개)
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                할당: {totalAllocatedBytes} / {eepromCapacityBytes} B ({eepromUsagePct.toFixed(1)}%)
              </span>
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
              {variables.map((item) => {
                const isSelected = item.id === selectedVarId;
                const writesPerSec = getWritesPerSecond(item.writeIntervalValue, item.writeIntervalUnit);
                const daysToDie = (ratedCycles * siliconMarginX) / (writesPerSec * 86400 * tempDeratingFactor);

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedVarId(item.id)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-950/40 border-amber-500 text-white shadow-md shadow-amber-950/30 ring-1 ring-amber-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs font-mono text-amber-300 truncate max-w-[200px]">
                          {item.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                          {item.sizeBytes} B
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        주기: 매 {item.writeIntervalValue} {item.writeIntervalUnit === 'seconds' ? '초' : item.writeIntervalUnit === 'minutes' ? '분' : item.writeIntervalUnit === 'hours' ? '시간' : '일'} | 슬롯: {item.wearLevelSlots}x
                      </div>
                      <div className="text-[10px] flex items-center gap-1 font-mono">
                        <span className="text-slate-500">무보호 수명:</span>
                        <span
                          className={`font-bold ${
                            daysToDie < 30
                              ? 'text-rose-400'
                              : daysToDie < 365
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {formatDuration(daysToDie * 86400)}
                        </span>
                      </div>
                    </div>

                    {variables.length > 1 && (
                      <button
                        onClick={(e) => handleRemoveVariable(item.id, e)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                        title="변수 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Add Custom Variable Form */}
          <form onSubmit={handleAddVariable} className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 border-b border-slate-800/70 pb-2">
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              신규 EEPROM 변수 추가 및 기록 주기 지정
            </span>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">변수 명칭 (Variable Name)</label>
                <input
                  type="text"
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                  placeholder="예: high_score_data"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">크기 (Bytes)</label>
                  <select
                    value={newVarSize}
                    onChange={(e) => setNewVarSize(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                  >
                    <option value={1}>1 Byte (uint8_t / char)</option>
                    <option value={2}>2 Bytes (uint16_t / int)</option>
                    <option value={4}>4 Bytes (uint32_t / float)</option>
                    <option value={8}>8 Bytes (double / int64)</option>
                    <option value={16}>16 Bytes (작은 구조체)</option>
                    <option value={32}>32 Bytes (블록 데이터)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">웨어레벨링 슬롯 수</label>
                  <select
                    value={newVarSlots}
                    onChange={(e) => setNewVarSlots(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                  >
                    <option value={1}>1개 (고정 단일 주소)</option>
                    <option value={4}>4개 슬롯 (4배 수명)</option>
                    <option value={8}>8개 슬롯 (8배 수명)</option>
                    <option value={16}>16개 슬롯 (16배 수명)</option>
                    <option value={32}>32개 슬롯 (32배 수명)</option>
                  </select>
                </div>
              </div>

              {/* Write Frequency Input */}
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 block">쓰기 주기 (Write Frequency)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={newVarInterval}
                    onChange={(e) => setNewVarInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-24 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  <select
                    value={newVarUnit}
                    onChange={(e) => setNewVarUnit(e.target.value as TimeUnit)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="seconds">초 마다 (Seconds)</option>
                    <option value="minutes">분 마다 (Minutes)</option>
                    <option value="hours">시간 마다 (Hours)</option>
                    <option value="days">일 마다 (Days)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1">
                  <span>실제 값 변경 비율 (Dirty Ratio):</span>
                  <span className="font-mono text-cyan-300 font-bold">{newVarDirty}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={newVarDirty}
                  onChange={(e) => setNewVarDirty(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-cyan-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>변수 등록 및 수명 시뮬레이션</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column (7 cols): Projected Time-To-Failure & Comparative Verdict */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main Stat Card: Projected Time-to-Failure for Selected Variable */}
          {varPrediction && (
            <div
              className={`rounded-2xl p-5 border shadow-xl space-y-4 transition-all ${
                varPrediction.severity === 'fatal'
                  ? 'bg-rose-950/40 border-rose-500/80 shadow-rose-950/30'
                  : varPrediction.severity === 'warning'
                  ? 'bg-amber-950/40 border-amber-500/80 shadow-amber-950/30'
                  : 'bg-emerald-950/40 border-emerald-500/80 shadow-emerald-950/30'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  {varPrediction.severity === 'fatal' ? (
                    <Flame className="w-5 h-5 text-rose-400 animate-bounce" />
                  ) : varPrediction.severity === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  ) : (
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  )}
                  <div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider block font-mono">
                      {activeVariable.name}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      쓰기 빈도: 매 {activeVariable.writeIntervalValue} {activeVariable.writeIntervalUnit} ({varPrediction.writesPerDay.toFixed(1)} 회/일)
                    </span>
                  </div>
                </div>

                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold font-mono border ${
                    varPrediction.severity === 'fatal'
                      ? 'bg-rose-950 text-rose-300 border-rose-700'
                      : varPrediction.severity === 'warning'
                      ? 'bg-amber-950 text-amber-300 border-amber-700'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  }`}
                >
                  {varPrediction.severity === 'fatal'
                    ? '💥 치명적 마모 (수명 30일 미만)'
                    : varPrediction.severity === 'warning'
                    ? '⚠️ 마모 주의 (수명 1년 미만)'
                    : '🛡️ 안정적 수명 (1년 이상)'}
                </span>
              </div>

              {/* Main Big TTF Highlight */}
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                <div>
                  <span className="text-[11px] text-slate-400 block font-mono">
                    예상 고장 도달 시점 (Projected Time-to-Failure)
                  </span>
                  <span
                    className={`text-2xl sm:text-3xl font-black font-mono tracking-tight my-0.5 block ${
                      varPrediction.severity === 'fatal'
                        ? 'text-rose-400'
                        : varPrediction.severity === 'warning'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {formatDuration(varPrediction.directSecondsToFailure)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono block">
                    * 무조건 쓰기(Direct Write) 기준 10만 회 수명 소진 시점
                  </span>
                </div>

                {/* Compare with Best Practice Box */}
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center sm:text-right shrink-0">
                  <span className="text-[10px] text-slate-400 block font-mono">
                    Dirty-Check + 웨어레벨링 적용 시:
                  </span>
                  <span className="text-sm font-bold font-mono text-cyan-300 block">
                    {formatDuration(varPrediction.bestCaseSecondsToFailure)}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold block">
                    최대 {(varPrediction.bestCaseSecondsToFailure / Math.max(1, varPrediction.directSecondsToFailure)).toFixed(1)}배 수명 연장
                  </span>
                </div>
              </div>

              {/* 4 Multi-Strategy Comparison Table */}
              <div className="space-y-1.5 font-mono text-xs">
                <span className="text-[11px] font-bold text-slate-300 block mb-1">
                  쓰기 전략별 예상 수명 비교 (Endurance by Write Strategy):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {/* Strategy 1: Direct Write */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-slate-400 flex justify-between">
                      <span>1. 무조건 덮어쓰기 (Direct)</span>
                      <span className="text-rose-400 font-bold">기본 안티패턴</span>
                    </div>
                    <div className="text-white font-bold text-sm">
                      {formatDuration(varPrediction.directSecondsToFailure)}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      값이 같아도 매번 플래시 산화막 소거/기록 수행. 가장 빠른 셀 파괴 유발.
                    </p>
                  </div>

                  {/* Strategy 2: Dirty Check Update */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-slate-400 flex justify-between">
                      <span>2. 변경 검사 (EEPROM.update)</span>
                      <span className="text-cyan-400 font-bold">권장 표준</span>
                    </div>
                    <div className="text-cyan-300 font-bold text-sm">
                      {formatDuration(varPrediction.dirtySecondsToFailure)}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      기존 값과 동일하면 쓰기 동작을 건너뛰어 실질 쓰기 횟수 절감.
                    </p>
                  </div>

                  {/* Strategy 3: Wear-Leveling */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-slate-400 flex justify-between">
                      <span>3. 순환 버퍼 웨어레벨링</span>
                      <span className="text-purple-400 font-bold">{activeVariable.wearLevelSlots}개 슬롯</span>
                    </div>
                    <div className="text-purple-300 font-bold text-sm">
                      {formatDuration(varPrediction.wearLevelSecondsToFailure)}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      물리적 셀 주소를 순환하며 마모를 분산하여 셀 수명 {activeVariable.wearLevelSlots}배 보존.
                    </p>
                  </div>

                  {/* Strategy 4: Optimal Combined */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-emerald-800/60 space-y-1">
                    <div className="text-slate-400 flex justify-between">
                      <span>4. 최적화 결합 (Update + Ring)</span>
                      <span className="text-emerald-400 font-bold">최고 신뢰성</span>
                    </div>
                    <div className="text-emerald-300 font-bold text-sm">
                      {formatDuration(varPrediction.bestCaseSecondsToFailure)}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      변경 검사와 다중 슬롯 회전 결합으로 반영구적 보존 달성.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Environmental Degradation Tuning (Temp & Silicon Margin) */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 text-xs">
            <span className="font-bold text-white flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              하드웨어 실리콘 마모 환경 파라미터 (Hardware Physical Stress Parameters)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] font-mono">
              <div>
                <label className="text-slate-400 block mb-1">보증 수명 주기 (W/E Cycles)</label>
                <select
                  value={ratedCycles}
                  onChange={(e) => setRatedCycles(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-white"
                >
                  <option value={100000}>100,000 회 (AVR 공식 보증치)</option>
                  <option value={50000}>50,000 회 (가혹 환경 마진)</option>
                  <option value={200000}>200,000 회 (상온 실험실 평균)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">실리콘 여유 마진 계수</label>
                <select
                  value={siliconMarginX}
                  onChange={(e) => setSiliconMarginX(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-white"
                >
                  <option value={1.0}>1.0x (엄격한 최악 조건)</option>
                  <option value={1.5}>1.5x (일반적 실리콘 마진)</option>
                  <option value={2.0}>2.0x (안정적 품질 로트)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">주변 동작 온도 (°C)</label>
                <select
                  value={ambientTempC}
                  onChange={(e) => setAmbientTempC(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-white"
                >
                  <option value={25}>25°C (상온 무디레이팅)</option>
                  <option value={55}>55°C (케이스 내부 발열: x1.15)</option>
                  <option value={85}>85°C (산업용 극한 환경: x1.65)</option>
                </select>
              </div>
            </div>
          </div>

          {/* C-Code Driver Snippet for Safe EEPROM Updates */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-slate-300 font-bold">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                C 언어 EEPROM 수명 보호 드라이버 스니펫
              </span>
              <button
                onClick={() => handleCopyCode(generatedCCode)}
                className="inline-flex items-center gap-1 text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 text-[10px] transition"
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode ? '복사됨' : '코드 복사'}</span>
              </button>
            </div>
            <pre className="p-3.5 text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-[220px] leading-relaxed custom-scrollbar select-all">
              {generatedCCode}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
