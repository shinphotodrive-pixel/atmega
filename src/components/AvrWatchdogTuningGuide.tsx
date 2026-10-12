import React, { useState, useMemo, useEffect } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  ShieldAlert,
  Clock,
  Cpu,
  Zap,
  Check,
  Copy,
  AlertTriangle,
  Code2,
  RefreshCw,
  Info,
  Sparkles,
  Sliders,
  CheckCircle2,
  HelpCircle,
  Download,
  Terminal,
  Activity,
  Flame,
  XCircle,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export interface WdtTimeoutOption {
  value: string;
  nominalMs: number;
  label: string;
  macro: string;
  wdpBits: string;
  cycles: number;
  is328pOnly?: boolean;
}

const WDT_TIMEOUT_OPTIONS: WdtTimeoutOption[] = [
  { value: '15ms', nominalMs: 15, label: '15 ms (2K 사이클)', macro: 'WDTO_15MS', wdpBits: '0b0000', cycles: 2048 },
  { value: '30ms', nominalMs: 30, label: '30 ms (4K 사이클)', macro: 'WDTO_30MS', wdpBits: '0b0001', cycles: 4096 },
  { value: '60ms', nominalMs: 60, label: '60 ms (8K 사이클)', macro: 'WDTO_60MS', wdpBits: '0b0010', cycles: 8192 },
  { value: '120ms', nominalMs: 120, label: '120 ms (16K 사이클)', macro: 'WDTO_120MS', wdpBits: '0b0011', cycles: 16384 },
  { value: '250ms', nominalMs: 250, label: '250 ms (32K 사이클)', macro: 'WDTO_250MS', wdpBits: '0b0100', cycles: 32768 },
  { value: '500ms', nominalMs: 500, label: '500 ms (64K 사이클)', macro: 'WDTO_500MS', wdpBits: '0b0101', cycles: 65536 },
  { value: '1s', nominalMs: 1000, label: '1.0 초 (128K 사이클)', macro: 'WDTO_1S', wdpBits: '0b0110', cycles: 131072 },
  { value: '2s', nominalMs: 2000, label: '2.0 초 (256K 사이클)', macro: 'WDTO_2S', wdpBits: '0b0111', cycles: 262144 },
  { value: '4s', nominalMs: 4000, label: '4.0 초 (512K 사이클)', macro: 'WDTO_4S', wdpBits: '0b1000', cycles: 524288, is328pOnly: true },
  { value: '8s', nominalMs: 8000, label: '8.0 초 (1,024K 사이클)', macro: 'WDTO_8S', wdpBits: '0b1001', cycles: 1048576, is328pOnly: true }
];

export const AvrWatchdogTuningGuide: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Available timeouts based on MCU
  const availableTimeouts = useMemo(() => {
    if (selectedMCU === 'atmega128') {
      return WDT_TIMEOUT_OPTIONS.filter((opt) => !opt.is328pOnly);
    }
    return WDT_TIMEOUT_OPTIONS;
  }, [selectedMCU]);

  // Main state
  const [selectedTimeoutValue, setSelectedTimeoutValue] = useState<string>('1s');
  const [mainLoopIntervalMs, setMainLoopIntervalMs] = useState<number>(200); // 200ms normal task
  const [enableHardwareWdton, setEnableHardwareWdton] = useState<boolean>(false);
  const [includeInit3Trap, setIncludeInit3Trap] = useState<boolean>(true);
  const [includeBlockingChunking, setIncludeBlockingChunking] = useState<boolean>(true);
  const [isSimulatingHang, setIsSimulatingHang] = useState<boolean>(false);
  const [simTimerSec, setSimTimerSec] = useState<number>(0);
  const [simResetTriggered, setSimResetTriggered] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const activeTimeout = useMemo(() => {
    return availableTimeouts.find((o) => o.value === selectedTimeoutValue) || availableTimeouts[6];
  }, [availableTimeouts, selectedTimeoutValue]);

  // Oscillator drift calculations (128 kHz nominal ± 10%)
  const oscDrift = useMemo(() => {
    const minMs = Math.round(activeTimeout.nominalMs * 0.9);
    const maxMs = Math.round(activeTimeout.nominalMs * 1.15);
    const safetyMarginRatio = (activeTimeout.nominalMs / Math.max(1, mainLoopIntervalMs)).toFixed(1);
    const isMarginDangerous = activeTimeout.nominalMs <= mainLoopIntervalMs * 1.5;

    return { minMs, maxMs, safetyMarginRatio, isMarginDangerous };
  }, [activeTimeout, mainLoopIntervalMs]);

  // Fuse configuration calculation
  const fuseCalculations = useMemo(() => {
    let fuseName = 'High Fuse (hfuse)';
    let normalHex = '0xDF';
    let wdtonHex = '0xD7';
    let avrdudePart = 'm328p';

    if (selectedMCU === 'atmega128') {
      fuseName = 'Extended Fuse (efuse) / Fuse High';
      normalHex = '0xFF';
      wdtonHex = '0xDF';
      avrdudePart = 'm128';
    } else if (selectedMCU === 'atmega640') {
      fuseName = 'High Fuse (hfuse)';
      normalHex = '0xDF';
      wdtonHex = '0xD7';
      avrdudePart = 'm640';
    }

    const activeFuseHex = enableHardwareWdton ? wdtonHex : normalHex;
    const avrdudeCmd = `avrdude -c usbasp -p ${avrdudePart} -U hfuse:w:${activeFuseHex}:m`;

    return { fuseName, normalHex, wdtonHex, activeFuseHex, avrdudePart, avrdudeCmd };
  }, [selectedMCU, enableHardwareWdton]);

  // Simulation timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isSimulatingHang) {
      interval = setInterval(() => {
        setSimTimerSec((prev) => {
          const next = prev + 100;
          if (next >= activeTimeout.nominalMs) {
            setSimResetTriggered(true);
            setIsSimulatingHang(false);
            return activeTimeout.nominalMs;
          }
          return next;
        });
      }, 100);
    } else {
      setSimTimerSec(0);
    }

    return () => clearInterval(interval);
  }, [isSimulatingHang, activeTimeout.nominalMs]);

  // Generated C Code Snippet
  const generatedCCode = useMemo(() => {
    const codeLines: string[] = [];
    codeLines.push(`/**`);
    codeLines.push(` * @file   watchdog_tuning_template.c`);
    codeLines.push(` * @target ${currentProfile.name} (${selectedMCU.toUpperCase()})`);
    codeLines.push(` * @wdt    타임아웃: ${activeTimeout.label} (${activeTimeout.macro})`);
    codeLines.push(` * @mode   ${enableHardwareWdton ? '하드웨어 퓨즈 강제 활성화 (WDTON=0)' : '소프트웨어 제어 (WDTCSR)'}`);
    codeLines.push(` */`);
    codeLines.push(``);
    codeLines.push(`#include <avr/io.h>`);
    codeLines.push(`#include <avr/wdt.h>`);
    codeLines.push(`#include <avr/interrupt.h>`);
    codeLines.push(`#include <util/delay.h>`);
    codeLines.push(``);

    if (includeInit3Trap) {
      codeLines.push(`/**`);
      codeLines.push(` * @brief [치명적 버그 방지] .init3 단계 WDT 해제 함수`);
      codeLines.push(` * 워치독 리셋 후 MCU 재부팅 시 WDT가 최단 주기(15ms)로 유지되어`);
      codeLines.push(` * 부트로더나 C 런타임 초기화 도중 무한 재부팅 루프에 빠지는 현상을 원천 방지합니다.`);
      codeLines.push(` */`);
      codeLines.push(`void disable_wdt_on_boot(void) __attribute__((naked, section(".init3")));`);
      codeLines.push(`void disable_wdt_on_boot(void) {`);
      codeLines.push(`    MCUSR = 0; // 리셋 원인 플래그(WDRF, BORF 등) 클리어`);
      codeLines.push(`    wdt_disable(); // 워치독 타이머 안전 해제`);
      codeLines.push(`}`);
      codeLines.push(``);
    }

    codeLines.push(`int main(void) {`);
    codeLines.push(`    // 1. 하드웨어 주변장치 초기화 루틴 수행 (GPIO, UART, SPI 등)`);
    codeLines.push(`    // ...`);
    codeLines.push(``);
    codeLines.push(`    // 2. 워치독 타이머 활성화 (${activeTimeout.macro})`);
    codeLines.push(`    wdt_enable(${activeTimeout.macro});`);
    codeLines.push(``);
    codeLines.push(`    while (1) {`);
    codeLines.push(`        // [권장 위치 1: 메인 슈퍼루프 주기적 킥]`);
    codeLines.push(`        wdt_reset(); // 개의 밥을 주어 타이머를 0으로 리셋`);
    codeLines.push(``);
    codeLines.push(`        // 비즈니스 로직 실행 (평균 주기: 약 ${mainLoopIntervalMs}ms)`);
    codeLines.push(`        process_sensor_telemetry();`);
    codeLines.push(`        process_communication_packet();`);
    codeLines.push(``);

    if (includeBlockingChunking) {
      codeLines.push(`        // [권장 위치 2: 장기 블로킹 루프 대기 시 분할 킥]`);
      codeLines.push(`        // 센서 응답 대기나 EEPROM/Flash 쓰기 등 장시간 소요 시 분할 처리:`);
      codeLines.push(`        uint16_t wait_timeout = 0;`);
      codeLines.push(`        while (!is_sensor_data_ready()) {`);
      codeLines.push(`            wdt_reset(); // 대기 루프 도중 타임아웃 방지`);
      codeLines.push(`            _delay_ms(5);`);
      codeLines.push(`            if (++wait_timeout > 200) {`);
      codeLines.push(`                // 1초 이상 무응답 시 센서 에러 처리 후 루프 탈출`);
      codeLines.push(`                handle_sensor_error();`);
      codeLines.push(`                break;`);
      codeLines.push(`            }`);
      codeLines.push(`        }`);
    }

    codeLines.push(`    }`);
    codeLines.push(`}`);
    codeLines.push(``);
    codeLines.push(`/**`);
    codeLines.push(` * [절대 금지 안티패턴 경고]`);
    codeLines.push(` * 타이머 인터럽트(ISR(TIMERx_OVF_vect)) 내부에 wdt_reset()을 넣지 마십시오!`);
    codeLines.push(` * 메인 루프가 교착 상태(Deadlock)에 빠져도 인터럽트가 계속 밥을 주어 리셋되지 않습니다.`);
    codeLines.push(` */`);

    return codeLines.join('\n');
  }, [
    currentProfile.name,
    selectedMCU,
    activeTimeout,
    enableHardwareWdton,
    includeInit3Trap,
    mainLoopIntervalMs,
    includeBlockingChunking
  ]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedCCode);
      setCopiedCode(true);
      confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 } });
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {}
  };

  const handleDownloadCode = () => {
    const blob = new Blob([generatedCCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wdt_tuning_${selectedMCU}.c`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-7 shadow-2xl backdrop-blur">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" /> 워치독 타이머 튜닝 가이드 (Watchdog Tuning)
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              WDT 타임아웃: {activeTimeout.label}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-800/40 text-xs font-mono font-bold">
              {currentProfile.name}
            </span>
            {enableHardwareWdton ? (
              <span className="px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-300 border border-rose-700/60 text-[11px] font-mono font-bold flex items-center gap-1">
                WDTON 퓨즈 강제 활성화 (Always On)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 text-[11px] font-mono font-bold flex items-center gap-1">
                소프트웨어 동적 제어 (WDTCSR)
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            AVR 워치독 타이머(WDT) 튜닝 가이드 & 리셋 방지 C 코드 생성기
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            워치독 타임아웃 주기를 기반으로 시스템 안전 마진을 분석하고, 메인 루프 및 장시간 대기 구간의 올바른 <code>wdt_reset()</code> 호출 위치와 WDTON 퓨즈 비트, 무한 재부팅 루프를 방지하는 <code>.init3</code> 보호 C 코드를 자동 생성합니다.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyCode}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-600/20 flex items-center gap-1.5"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? '복사 완료!' : 'WDT 코드 복사'}</span>
          </button>
          <button
            onClick={handleDownloadCode}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.c 다운로드</span>
          </button>
        </div>
      </div>

      {/* KPI Dashcards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">설정된 타임아웃</span>
          <span className="text-base font-bold text-amber-400 font-mono">
            {activeTimeout.nominalMs} ms
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            {activeTimeout.macro} ({activeTimeout.cycles.toLocaleString()} cyc)
          </span>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">실제 발진 오차 범위</span>
          <span className="text-base font-bold text-cyan-400 font-mono">
            {oscDrift.minMs} ~ {oscDrift.maxMs} ms
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            128 kHz RC 발진기 (±10~15%)
          </span>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">메인 태스크 루프 주기</span>
          <span className="text-base font-bold text-violet-400 font-mono">
            {mainLoopIntervalMs} ms
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            while(1) 1회 회전 소요 시간
          </span>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">안전 마진 배율</span>
          <span className={`text-base font-bold font-mono ${
            oscDrift.isMarginDangerous ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            {oscDrift.safetyMarginRatio}x
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            {oscDrift.isMarginDangerous ? '마진 부족: 오작동 리셋 위험' : '권장 마진 확보 (2x 이상)'}
          </span>
        </div>

        <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 col-span-2 sm:col-span-4 lg:col-span-1">
          <span className="text-[10px] text-slate-500 block uppercase font-mono">퓨즈 비트 (WDTON)</span>
          <span className="text-base font-bold text-white font-mono">
            {fuseCalculations.activeFuseHex}
          </span>
          <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
            {enableHardwareWdton ? '하드웨어 상시 On' : '소프트웨어 On/Off'}
          </span>
        </div>
      </div>

      {/* Main Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 bg-slate-950/50 p-5 rounded-2xl border border-slate-800">
        {/* Left: Timeout Selector & Sliders (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              1. 타임아웃 주기 및 메인 루프 시간 설정
            </h4>
          </div>

          {/* Timeout Selector */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 flex items-center justify-between">
              <span>WDT 타임아웃 주기 선택 (Timeout Period)</span>
              <span className="font-mono text-amber-400 font-bold">{activeTimeout.label}</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {availableTimeouts.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedTimeoutValue(opt.value)}
                  className={`p-2 rounded-xl border text-center transition font-mono ${
                    selectedTimeoutValue === opt.value
                      ? 'bg-amber-950 text-amber-300 border-amber-500 font-bold shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs">{opt.value}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">{opt.nominalMs}ms</div>
                </button>
              ))}
            </div>
          </div>

          {/* Main Loop Slider */}
          <div className="space-y-1.5 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-sans">메인 태스크 루프 1회 회전 소요 시간</span>
              <span className="text-violet-400 font-bold">{mainLoopIntervalMs} ms</span>
            </div>
            <input
              type="range"
              min="10"
              max="3000"
              step="10"
              value={mainLoopIntervalMs}
              onChange={(e) => setMainLoopIntervalMs(parseInt(e.target.value) || 200)}
              className="w-full accent-violet-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>10 ms (초고속)</span>
              <span>1000 ms (1초)</span>
              <span>3000 ms (장주기)</span>
            </div>
          </div>

          {/* Options Checkboxes */}
          <div className="space-y-2 pt-1">
            <label className="flex items-start gap-2.5 p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={includeInit3Trap}
                onChange={(e) => setIncludeInit3Trap(e.target.checked)}
                className="accent-amber-500 rounded mt-0.5 w-4 h-4 shrink-0"
              />
              <div className="text-xs">
                <span className="font-bold text-white block">.init3 단계 워치독 해제 트랩 포함 (강력 권장)</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  부트로더 재부팅 무한 루프(Infinite WDT Reset Loop)를 예방하기 위해 C 런타임 초기화 전에 MCUSR=0 및 wdt_disable()을 실행합니다.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={includeBlockingChunking}
                onChange={(e) => setIncludeBlockingChunking(e.target.checked)}
                className="accent-amber-500 rounded mt-0.5 w-4 h-4 shrink-0"
              />
              <div className="text-xs">
                <span className="font-bold text-white block">장시간 블로킹/대기 루프 분할 킥 템플릿 포함</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  센서 응답 대기, I2C/EEPROM 쓰기 시 5~10ms 단위로 쪼개어 wdt_reset()을 호출하는 방어 코드를 생성합니다.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Right: Fuse Configuration & Hang Simulation (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
            <Zap className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              2. WDTON 퓨즈 비트 & 교착 상태(Deadlock) 시뮬레이션
            </h4>
          </div>

          {/* Fuse Settings Box */}
          <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2.5 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-white font-bold font-sans">WDTON 하드웨어 퓨즈 설정</span>
              <button
                onClick={() => setEnableHardwareWdton(!enableHardwareWdton)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                  enableHardwareWdton
                    ? 'bg-rose-950 text-rose-300 border-rose-600'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {enableHardwareWdton ? 'WDTON 활성화 (0)' : 'WDTON 비활성화 (1)'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
              {enableHardwareWdton
                ? 'WDTON 퓨즈가 프로그래밍되면 전원 인가 직후부터 하드웨어적으로 WDT가 항상 동작하며, 소프트웨어로 해제할 수 없습니다.'
                : '기본 출하 상태에서는 소프트웨어(wdt_enable)로 WDT를 켜고 끌 수 있습니다.'}
            </p>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-emerald-400 text-[11px] break-all">
              {fuseCalculations.avrdudeCmd}
            </div>
          </div>

          {/* Interactive Deadlock Simulation */}
          <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  펌웨어 멈춤(Hang) 시뮬레이션
                </span>
              </div>
              <button
                onClick={() => {
                  setSimResetTriggered(false);
                  setIsSimulatingHang(!isSimulatingHang);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  isSimulatingHang
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                {isSimulatingHang ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isSimulatingHang ? '무한 루프 중단' : '교착(Hang) 발생 시험'}</span>
              </button>
            </div>

            {/* Visual Watchdog Countdown Bar */}
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between text-slate-400">
                <span>경과 시간: {simTimerSec} ms</span>
                <span className="text-amber-400 font-bold">임계치: {activeTimeout.nominalMs} ms</span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  style={{ width: `${Math.min(100, (simTimerSec / activeTimeout.nominalMs) * 100)}%` }}
                  className={`h-full transition-all ${
                    simResetTriggered ? 'bg-rose-600' : simTimerSec > activeTimeout.nominalMs * 0.7 ? 'bg-amber-500' : 'bg-cyan-500'
                  }`}
                />
              </div>
            </div>

            {simResetTriggered && (
              <div className="p-2.5 bg-rose-950/80 border border-rose-800 rounded-lg text-rose-200 text-xs font-mono flex items-center gap-2 animate-bounce">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>[WDRF 리셋 트리거!] WDT 타임아웃 초과로 MCU가 강제 하드웨어 리셋되었습니다.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Code Architecture Best Practice Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* DO: Proper Placement */}
        <div className="p-4 bg-emerald-950/30 border border-emerald-800/40 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>올바른 wdt_reset() 배치 위치 (DO)</span>
          </div>
          <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
            <li><strong>메인 슈퍼루프 최상단/최하단:</strong> 1회 순회마다 주기적으로 리셋하여 루프 정지 시 즉시 복구.</li>
            <li><strong>긴 폴링/지연 대기 루프:</strong> <code>while (!ready)</code> 루프 내부에서 타임아웃 가드와 함께 킥.</li>
            <li><strong>EEPROM/플래시 페이지 기록 직전:</strong> 연속 쓰기 동작 전 리셋하여 타임아웃 여유 확보.</li>
          </ul>
        </div>

        {/* DON'T: Fatal Anti-Pattern */}
        <div className="p-4 bg-rose-950/30 border border-rose-800/40 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
            <XCircle className="w-4 h-4" />
            <span>치명적 안티패턴: 절대 하지 마세요 (DON'T)</span>
          </div>
          <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
            <li><strong>타이머 ISR 내부 호출 금지:</strong> <code>ISR(TIMER0_OVF_vect)</code> 안에 넣으면 메인 코드가 먹통이 되어도 타이머가 계속 밥을 주어 WDT가 무력화됩니다.</li>
            <li><strong>타임아웃보다 긴 _delay_ms() 금지:</strong> 단일 호출로 <code>_delay_ms(2000)</code>를 실행하면 즉시 리셋됩니다.</li>
            <li><strong>.init3 트랩 생략 금지:</strong> 생략 시 부트로더 15ms 리셋 루프 벽돌(Brick) 현상이 발생합니다.</li>
          </ul>
        </div>
      </div>

      {/* Embedded C Code Viewer */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Code2 className="w-4 h-4 text-amber-400" />
            완성형 WDT 방어 프로덕션 C 소스 코드 스니펫
          </span>
          <button
            onClick={handleCopyCode}
            className="text-xs text-amber-400 hover:text-amber-300 font-mono flex items-center gap-1"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? '복사됨!' : 'C 소스 복사'}</span>
          </button>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-400">
            <span>watchdog_tuning_{selectedMCU}.c ({activeTimeout.macro})</span>
            <span>AVR-GCC avr-libc / .init3 완벽 호환</span>
          </div>
          <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-80">
            <code>{generatedCCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
