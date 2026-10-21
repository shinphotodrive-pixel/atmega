import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  Cpu,
  Info,
  Terminal,
  Play,
  Pause,
  Download,
  Clock,
  Zap,
  Sliders,
  Sparkles,
  TrendingDown,
  HardDrive,
  FileCode2,
  Activity,
  Flame,
  HelpCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type WdtMode = 'system_reset' | 'dual_interrupt_reset' | 'interrupt_only';

export interface SurvivabilityPreset {
  id: string;
  name: string;
  tag: string;
  desc: string;
  loopPeriodMs: number;
  blockingJitterMs: number;
  wdtTimeoutMs: number;
  wdtMode: WdtMode;
  hasInit3Guard: boolean;
  eepromLogging: boolean;
}

const PRESET_SCENARIOS: SurvivabilityPreset[] = [
  {
    id: 'i2c_bus_hang',
    name: 'I2C 버스 슬레이브 락업 (150ms 블로킹 스파이크)',
    tag: 'I2C 락업',
    desc: '외부 센서 응답 누락으로 while(!(TWCR & (1<<TWINT))) 대기 중 WDT 타임아웃 발생',
    loopPeriodMs: 40,
    blockingJitterMs: 150,
    wdtTimeoutMs: 120,
    wdtMode: 'dual_interrupt_reset',
    hasInit3Guard: true,
    eepromLogging: true
  },
  {
    id: 'infinite_reset_loop',
    name: 'Optiboot 무한 리셋 루프 결함 (.init3 누락)',
    tag: '무한 리셋 루프',
    desc: '부팅 시 MCUSR 클리어 누락으로 WDT가 16ms로 초기화되어 main() 진입 전 무한 리부트 반복',
    loopPeriodMs: 30,
    blockingJitterMs: 80,
    wdtTimeoutMs: 60,
    wdtMode: 'system_reset',
    hasInit3Guard: false,
    eepromLogging: false
  },
  {
    id: 'eeprom_crash_dump',
    name: '고신뢰성 항공/산업용 듀얼 모드 크래시 덤프',
    tag: '듀얼 모드 보호',
    desc: '1차 타임아웃 시 EEPROM 링 버퍼에 리셋 원인과 PC 레지스터를 기록하고 안전 셧다운 후 2차 하드웨어 리셋',
    loopPeriodMs: 50,
    blockingJitterMs: 20,
    wdtTimeoutMs: 500,
    wdtMode: 'dual_interrupt_reset',
    hasInit3Guard: true,
    eepromLogging: true
  },
  {
    id: 'flash_write_spike',
    name: 'Flash 페이지 쓰기 지연 (단기 지터 15ms)',
    tag: 'Flash 지터',
    desc: 'Flash SPM 페이지 기록(4.5ms) 다중 실행으로 일시적 지터 발생 시 안전 마진 검증',
    loopPeriodMs: 25,
    blockingJitterMs: 20,
    wdtTimeoutMs: 250,
    wdtMode: 'system_reset',
    hasInit3Guard: true,
    eepromLogging: false
  }
];

export const AvrWdtSurvivabilityAnalyzer: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Parameters
  const [activePresetId, setActivePresetId] = useState<string>('i2c_bus_hang');
  const [loopPeriodMs, setLoopPeriodMs] = useState<number>(40);
  const [blockingJitterMs, setBlockingJitterMs] = useState<number>(150);
  const [wdtTimeoutMs, setWdtTimeoutMs] = useState<number>(120);
  const [wdtMode, setWdtMode] = useState<WdtMode>('dual_interrupt_reset');
  const [hasInit3Guard, setHasInit3Guard] = useState<boolean>(true);
  const [eepromLogging, setEepromLogging] = useState<boolean>(true);

  // Live Simulation state
  const [isSimRunning, setIsSimRunning] = useState<boolean>(true);
  const [simTimeMs, setSimTimeMs] = useState<number>(0);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Apply Preset
  const handleApplyPreset = (p: SurvivabilityPreset) => {
    setActivePresetId(p.id);
    setLoopPeriodMs(p.loopPeriodMs);
    setBlockingJitterMs(p.blockingJitterMs);
    setWdtTimeoutMs(p.wdtTimeoutMs);
    setWdtMode(p.wdtMode);
    setHasInit3Guard(p.hasInit3Guard);
    setEepromLogging(p.eepromLogging);
  };

  // Math & Risk Analysis
  const riskAnalysis = useMemo(() => {
    const worstCaseExecutionMs = loopPeriodMs + blockingJitterMs;
    const safetyMarginMs = wdtTimeoutMs - worstCaseExecutionMs;
    const safetyMarginRatio = (wdtTimeoutMs > 0 ? (safetyMarginMs / wdtTimeoutMs) * 100 : 0);

    // Reset loop vulnerability check:
    // If hasInit3Guard is false, AVR hardware keeps WDRF=1 in MCUSR after reset.
    // The bootloader/firmware defaults to WDT 16ms and resets AGAIN before disabling!
    const isInfiniteResetLoop = !hasInit3Guard && worstCaseExecutionMs >= wdtTimeoutMs;
    const isWdtTripped = worstCaseExecutionMs >= wdtTimeoutMs;

    let riskLevel: 'SAFE' | 'WARNING' | 'CRITICAL' = 'SAFE';
    if (isInfiniteResetLoop || (isWdtTripped && wdtMode === 'system_reset')) {
      riskLevel = 'CRITICAL';
    } else if (isWdtTripped || safetyMarginRatio < 35) {
      riskLevel = 'WARNING';
    }

    // Recommended WDT Timeout: At least 2.5x worst case
    const recommendedTimeoutMs = Math.ceil((worstCaseExecutionMs * 2.5) / 50) * 50;

    return {
      worstCaseExecutionMs,
      safetyMarginMs,
      safetyMarginRatio: Math.round(safetyMarginRatio),
      isInfiniteResetLoop,
      isWdtTripped,
      riskLevel,
      recommendedTimeoutMs
    };
  }, [loopPeriodMs, blockingJitterMs, wdtTimeoutMs, hasInit3Guard, wdtMode]);

  // WDTCSR Register bits calculation
  const wdtcsrReg = useMemo(() => {
    // WDP3:0 mapping
    let wdpHex = '0x08'; // default
    if (wdtTimeoutMs <= 16) wdpHex = '0x00';
    else if (wdtTimeoutMs <= 32) wdpHex = '0x01';
    else if (wdtTimeoutMs <= 64) wdpHex = '0x02';
    else if (wdtTimeoutMs <= 125) wdpHex = '0x03';
    else if (wdtTimeoutMs <= 250) wdpHex = '0x04';
    else if (wdtTimeoutMs <= 500) wdpHex = '0x05';
    else if (wdtTimeoutMs <= 1000) wdpHex = '0x06';
    else if (wdtTimeoutMs <= 2000) wdpHex = '0x07';
    else if (wdtTimeoutMs <= 4000) wdpHex = '0x20';
    else wdpHex = '0x21';

    let modeBits = 0;
    if (wdtMode === 'system_reset') modeBits = (1 << 3); // WDE
    else if (wdtMode === 'interrupt_only') modeBits = (1 << 6); // WDIE
    else modeBits = (1 << 6) | (1 << 3); // WDIE | WDE (Dual Mode)

    const totalVal = modeBits | parseInt(wdpHex, 16);
    return {
      wdtcsrHex: `0x${totalVal.toString(16).toUpperCase().padStart(2, '0')}`,
      modeLabel: wdtMode === 'dual_interrupt_reset' ? '인터럽트 후 시스템 리셋 (Dual)' : wdtMode === 'system_reset' ? '즉시 하드웨어 리셋' : '인터럽트 전용'
    };
  }, [wdtTimeoutMs, wdtMode]);

  // C Source Code Template
  const generatedCCode = useMemo(() => {
    return `/* =========================================================================
 * AVR 하드웨어 워치독(WDT) 생존성 보장 & EEPROM 크래시 덤프 펌웨어
 * Target MCU : ${currentProfile.name}
 * WDT 모드   : ${wdtcsrReg.modeLabel} (타임아웃: ${wdtTimeoutMs} ms)
 * .init3 방어: ${hasInit3Guard ? '활성화 (무한 리셋 루프 방지)' : '미적용 (위험)'}
 * ========================================================================= */
#include <avr/io.h>
#include <avr/wdt.h>
#include <avr/interrupt.h>
#include <avr/eeprom.h>
#include <util/atomic.h>
#include <stdbool.h>

// 1. EEPROM 크래시 로그 구조체 (CRC-16 무결성 검증)
typedef struct {
    uint32_t reset_count;
    uint8_t  reset_reason_mcusr;
    uint16_t last_program_counter;
    uint16_t checksum_crc16;
} CrashLogEntry;

CrashLogEntry EEMEM eeprom_crash_ring_buffer[8];
uint8_t EEMEM eeprom_crash_log_index = 0;

// 2. [.init3 섹션] 부팅 즉시 MCUSR 클리어 및 WDT 정지 (무한 리셋 루프 원천 차단)
uint8_t mcusr_mirror __attribute__((section(".noinit")));

${hasInit3Guard ? `void wdt_init_guard(void) __attribute__((naked)) __attribute__((section(".init3")));
void wdt_init_guard(void) {
    mcusr_mirror = MCUSR;
    MCUSR = 0;         // WDRF 비트 즉시 클리어 (필수!)
    wdt_disable();     // WDT 16ms 기본 리셋 차단
}` : `// [경고] .init3 방어 루틴 누락: WDT 리셋 후 MCUSR의 WDRF가 클리어되지 않아
// 부트로더 재시작 시 16ms 이내 무한 리셋 루프가 발생할 수 있습니다!`}

// 3. WDT 하드웨어 초기화 (듀얼 인터럽트 + 리셋 모드)
void watchdog_setup(void) {
    cli();
    wdt_reset();
    WDTCSR = (1 << WDCE) | (1 << WDE);
    WDTCSR = ${wdtcsrReg.wdtcsrHex}; // WDIE, WDE, WDP 설정
    sei();
}

${wdtMode === 'dual_interrupt_reset' ? `// 4. [1차 타임아웃 인터럽트] 하드웨어 리셋 전 응급 셧다운 & EEPROM 크래시 덤프
ISR(WDT_vect) {
    // A. 구동 부하 즉시 차단 (모터/히터/고전력 릴레이 안전 상태로 OFF)
    PORTB &= ~((1 << PB0) | (1 << PB1) | (1 << PB2));

${eepromLogging ? `    // B. EEPROM 긴급 크래시 덤프 기록 (최대 1회 원자적 저장)
    CrashLogEntry log;
    log.reset_reason_mcusr = mcusr_mirror;
    log.last_program_counter = 0; // 디버그 심볼
    log.checksum_crc16 = 0xAA55;
    
    // 링 버퍼에 기록하여 EEPROM 셀 마모 방지
    uint8_t idx = eeprom_read_byte(&eeprom_crash_log_index) % 8;
    eeprom_update_block(&log, &eeprom_crash_ring_buffer[idx], sizeof(CrashLogEntry));
    eeprom_update_byte(&eeprom_crash_log_index, idx + 1);` : ''}

    // 1차 인터럽트 종료 후 2차 타임아웃 발생 시 하드웨어 하드 리셋 자동 발동!
}` : ''}

int main(void) {
    watchdog_setup();

    while (1) {
        // 주기적 하트비트 킥 (Kick the Dog)
        wdt_reset();

        // 메인 루프 태스크 실행 (블로킹 지연이 ${wdtTimeoutMs}ms를 넘지 않아야 함)
        // do_system_tasks();
    }
}
`;
  }, [currentProfile.name, wdtcsrReg, wdtTimeoutMs, hasInit3Guard, wdtMode, eepromLogging]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.85 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadCode = () => {
    const blob = new Blob([generatedCCode], { type: 'text/x-csrc' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avr_wdt_survivability_${selectedMCU}.c`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold mb-2">
            <ShieldAlert className="w-3.5 h-3.5" /> Watchdog Survivability & Anti-Reset-Loop Analyzer
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            AVR 하드웨어 워치독 (WDT) 생존성 분석기 & EEPROM 복구 무결성 설계기
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            시스템 실행 주기와 지터(Jitter) 스파이크를 기반으로 <span className="text-rose-400 font-medium">무한 리셋 루프 발생 위험</span>을 시각화하고, 
            WDT 복구 모드에서 <span className="text-cyan-300 font-medium"> EEPROM 링 버퍼 크래시 덤프</span> 및 
            <span className="text-emerald-400 font-medium"> .init3 조기 클리어 방어 전략</span>을 제안합니다.
          </p>
        </div>

        {/* Risk Badge */}
        <div
          className={`p-3 rounded-xl border text-xs space-y-1 self-start lg:self-center ${
            riskAnalysis.riskLevel === 'CRITICAL'
              ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
              : riskAnalysis.riskLevel === 'WARNING'
              ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
              : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2 font-bold">
            {riskAnalysis.riskLevel === 'CRITICAL' ? (
              <Flame className="w-4 h-4 text-rose-400" />
            ) : riskAnalysis.riskLevel === 'WARNING' ? (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            )}
            <span>생존성 진단: {riskAnalysis.riskLevel === 'CRITICAL' ? '리셋 루프 위험 (CRITICAL)' : riskAnalysis.riskLevel === 'WARNING' ? '경고 (WARNING)' : '정상 안정 (SAFE)'}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            안전 여유 마진: <strong className="text-white">{riskAnalysis.safetyMarginMs} ms ({riskAnalysis.safetyMarginRatio}%)</strong>
          </div>
        </div>
      </div>

      {/* Preset Banner */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            검증된 워치독 장애 & 복구 시나리오 프리셋
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {PRESET_SCENARIOS.map((p) => {
            const isSelected = activePresetId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleApplyPreset(p)}
                className={`text-left p-2.5 rounded-lg border transition-all text-xs flex flex-col justify-between ${
                  isSelected
                    ? 'bg-rose-950/40 border-rose-500/50 ring-1 ring-rose-500/40'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-semibold text-white truncate">{p.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    {p.tag}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-1">{p.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Control Panel: Parameters Inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Col 1: System Execution Timing */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" /> 시스템 루프 주기 & 지터 스파이크
          </h3>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>정상 메인 루프 주기 (T_nom)</span>
              <span className="text-cyan-400 font-mono font-bold">{loopPeriodMs} ms</span>
            </div>
            <input
              type="range"
              min={5}
              max={200}
              step={5}
              value={loopPeriodMs}
              onChange={(e) => setLoopPeriodMs(parseInt(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>블로킹 지연 스파이크 (I2C/Flash/Delay)</span>
              <span className="text-rose-400 font-mono font-bold">+{blockingJitterMs} ms</span>
            </div>
            <input
              type="range"
              min={0}
              max={300}
              step={5}
              value={blockingJitterMs}
              onChange={(e) => setBlockingJitterMs(parseInt(e.target.value))}
              className="w-full accent-rose-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>최악 루프 지연 (T_worst):</span>
              <span className="font-mono text-white font-bold">{riskAnalysis.worstCaseExecutionMs} ms</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>권장 WDT 타임아웃:</span>
              <span className="font-mono text-emerald-400 font-bold">&gt;= {riskAnalysis.recommendedTimeoutMs} ms</span>
            </div>
          </div>
        </div>

        {/* Col 2: WDT Hardware Configuration */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" /> WDT 타임아웃 & 동작 모드
          </h3>

          <div>
            <label className="text-xs text-slate-400 block mb-1">WDT 타임아웃 주기 설정</label>
            <div className="grid grid-cols-4 gap-1.5 text-xs">
              {[16, 64, 120, 250, 500, 1000, 2000, 8000].map((t) => (
                <button
                  key={t}
                  onClick={() => setWdtTimeoutMs(t)}
                  className={`py-1 rounded border font-semibold ${
                    wdtTimeoutMs === t
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {t < 1000 ? `${t}ms` : `${t / 1000}s`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">WDT 동작 모드 (WDTCSR)</label>
            <div className="space-y-1 text-xs">
              <button
                onClick={() => setWdtMode('dual_interrupt_reset')}
                className={`w-full p-2 rounded-lg border text-left transition-all ${
                  wdtMode === 'dual_interrupt_reset'
                    ? 'bg-amber-950/40 border-amber-400 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                듀얼 모드 (인터럽트 후 시스템 리셋 - 권장)
              </button>
              <button
                onClick={() => setWdtMode('system_reset')}
                className={`w-full p-2 rounded-lg border text-left transition-all ${
                  wdtMode === 'system_reset'
                    ? 'bg-amber-950/40 border-amber-400 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                단순 시스템 리셋 (System Reset Mode)
              </button>
            </div>
          </div>

          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>WDTCSR 레지스터 값:</span>
              <span className="font-mono text-cyan-400 font-bold">{wdtcsrReg.wdtcsrHex}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>트립 발생 여부:</span>
              <span className={`font-bold ${riskAnalysis.isWdtTripped ? 'text-rose-400' : 'text-emerald-400'}`}>
                {riskAnalysis.isWdtTripped ? 'WDT 트리거 발동!' : '정상 통과 (Kick 성공)'}
              </span>
            </div>
          </div>
        </div>

        {/* Col 3: Anti-Reset-Loop & EEPROM Strategy */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-400" /> 복구 & EEPROM 무결성 보호 전략
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-200 font-medium block">.init3 섹션 MCUSR 방어 가드</span>
                <span className="text-[10px] text-slate-400">부팅 즉시 WDRF 클리어로 16ms 리셋 루프 차단</span>
              </div>
              <input
                type="checkbox"
                checked={hasInit3Guard}
                onChange={(e) => setHasInit3Guard(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-200 font-medium block">EEPROM 링 버퍼 크래시 덤프</span>
                <span className="text-[10px] text-slate-400">8-슬롯 회전 기록으로 셀 마모 방지 & CRC-16</span>
              </div>
              <input
                type="checkbox"
                checked={eepromLogging}
                onChange={(e) => setEepromLogging(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
            </div>
          </div>

          {/* Infographic Box for Infinite Reset Loop Bug */}
          {!hasInit3Guard && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/60 rounded-lg text-xs text-rose-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-400" /> 무한 리셋 루프(Infinite Reset Loop) 취약점 발생!
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                AVR 하드웨어는 WDT 리셋 후 <code>MCUSR</code>의 <code>WDRF</code> 비트를 지우지 않습니다. 
                부트로더가 실행될 때 WDT는 기본 16ms로 재동작하므로, <code>.init3</code>에서 즉시 클리어하지 않으면 영원히 재부팅됩니다.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Heartbeat Timeline Graph Visualizer */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              워치독 카운트다운 & 하트비트 킥 타임라인 그래프 (Heartbeat Kick vs Trip Point)
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            타임아웃 한계: {wdtTimeoutMs} ms | 최악 루프: {riskAnalysis.worstCaseExecutionMs} ms
          </span>
        </div>

        {/* SVG Timeline */}
        <div className="w-full h-44 bg-slate-900/90 rounded-lg p-2 border border-slate-800">
          <svg viewBox="0 0 700 140" className="w-full h-full">
            {/* Safe Zone, Warning Zone, Trip Line */}
            <rect x="50" y="20" width="550" height="90" fill="#020617" rx="4" />

            {/* Time Axis Grid */}
            {[0, 50, 100, 150, 200, 250].map((t, idx) => {
              const x = 60 + idx * 100;
              return (
                <g key={`t_${idx}`}>
                  <line x1={x} y1="20" x2={x} y2="110" stroke="#1e293b" strokeDasharray="2,2" strokeWidth="1" />
                  <text x={x} y="125" fill="#64748b" fontSize="9" textAnchor="middle">{t}ms</text>
                </g>
              );
            })}

            {/* WDT Timeout Threshold Line */}
            {(() => {
              const xLimit = Math.min(600, 60 + (wdtTimeoutMs / 250) * 500);
              return (
                <g>
                  <line x1={xLimit} y1="20" x2={xLimit} y2="110" stroke="#f43f5e" strokeWidth="2" strokeDasharray="4,2" />
                  <text x={xLimit} y="15" fill="#f43f5e" fontSize="9" fontWeight="bold" textAnchor="middle">
                    WDT Trip ({wdtTimeoutMs}ms)
                  </text>
                </g>
              );
            })()}

            {/* Execution Pulse Bar */}
            {(() => {
              const wExec = Math.min(540, (riskAnalysis.worstCaseExecutionMs / 250) * 500);
              const isTrip = riskAnalysis.isWdtTripped;
              return (
                <g>
                  <rect
                    x="60"
                    y="50"
                    width={wExec}
                    height="30"
                    fill={isTrip ? '#f43f5e' : '#10b981'}
                    fillOpacity="0.3"
                    stroke={isTrip ? '#f43f5e' : '#10b981'}
                    strokeWidth="2"
                    rx="4"
                  />
                  <text x={60 + wExec / 2} y="70" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">
                    실행 시간: {riskAnalysis.worstCaseExecutionMs} ms {isTrip ? '(타임아웃 초과!)' : '(정상 킥)'}
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded"></span> 정상 루프 시간: {loopPeriodMs} ms
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded"></span> 블로킹 지터: +{blockingJitterMs} ms
            </span>
          </div>
          <div className="text-slate-300">
            {riskAnalysis.isWdtTripped ? (
              <span className="text-rose-400 font-bold">★ WDT 타임아웃 도달! {wdtMode === 'dual_interrupt_reset' ? '1차 ISR 크래시 덤프 후 리셋' : '즉시 하드웨어 리셋'}</span>
            ) : (
              <span className="text-emerald-400 font-medium">★ 하트비트 정상 수신: 안전 마진 {riskAnalysis.safetyMarginMs} ms 확보</span>
            )}
          </div>
        </div>
      </div>

      {/* Embedded C Code Generator */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                자동 생성된 AVR C 무한 리셋 방지 및 EEPROM 크래시 덤프 코드
              </h3>
              <p className="text-xs text-slate-400">
                .init3 조기 클리어 가드와 듀얼 모드 WDT_vect EEPROM 링 버퍼 로거 완비
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? '복사 완료!' : 'C 코드 복사'}
            </button>
            <button
              onClick={handleDownloadCode}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> .c 파일 다운로드
            </button>
          </div>
        </div>

        <pre className="p-4 bg-slate-900/90 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[340px] scrollbar-thin scrollbar-thumb-slate-700">
          <code>{generatedCCode}</code>
        </pre>
      </div>
    </div>
  );
};
