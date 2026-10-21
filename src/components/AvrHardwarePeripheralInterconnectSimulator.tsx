import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Activity,
  Zap,
  Sliders,
  CheckCircle2,
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
  ShieldAlert,
  ShieldCheck,
  Radio,
  FileCode2,
  Clock,
  Layers,
  Sparkles,
  GitMerge
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type InterconnectPreset = 'ac_timer1_capture' | 'timer_adc_autotrigger' | 'wdt_timer_nesting' | 'analog_comp_shutdown';

export interface InterconnectScenario {
  id: InterconnectPreset;
  name: string;
  tag: string;
  desc: string;
  timerMode: 'normal' | 'ctc' | 'fast_pwm';
  acTriggerTarget: 'timer1_icp' | 'interrupt_only' | 'none';
  adcTriggerSource: 'timer0_ovf' | 'timer0_compa' | 'analog_comp' | 'none';
  wdtMode: 'interrupt' | 'system_reset' | 'interrupt_and_reset';
  timerIsrLoadUs: number;
  acIsrLoadUs: number;
  wdtTimeoutMs: number;
}

const PRESET_SCENARIOS: InterconnectScenario[] = [
  {
    id: 'ac_timer1_capture',
    name: '아날로그 비교기(AC) ➔ Timer1 캡처 연동 (ACIC=1)',
    tag: 'AC-Timer1 ICP',
    desc: '아날로그 비교기 출력이 하드웨어 내부에서 Timer1 Input Capture에 직접 연결되어 마이크로초 단위 영(Zero) 딜레이 타임스탬프 기록',
    timerMode: 'normal',
    acTriggerTarget: 'timer1_icp',
    adcTriggerSource: 'none',
    wdtMode: 'interrupt',
    timerIsrLoadUs: 15,
    acIsrLoadUs: 5,
    wdtTimeoutMs: 250
  },
  {
    id: 'timer_adc_autotrigger',
    name: 'Timer0 CTC ➔ ADC 자동 트리거 (ADATE) 정주기 샘플링',
    tag: 'ADC Auto-Trigger',
    desc: 'Timer0 Compare Match가 CPU 개입 없이 ADC 변환을 즉시 개시하여 지터(Jitter) 없는 정확한 주기 샘플링 수행',
    timerMode: 'ctc',
    acTriggerTarget: 'none',
    adcTriggerSource: 'timer0_compa',
    wdtMode: 'system_reset',
    timerIsrLoadUs: 8,
    acIsrLoadUs: 0,
    wdtTimeoutMs: 500
  },
  {
    id: 'wdt_timer_nesting',
    name: '긴 타이머 ISR 실행 중 WDT 타임아웃 락업 (Lock-up 위험 시나리오)',
    tag: 'Lockup 위험',
    desc: '타이머 ISR 내부에서 긴 블로킹 딜레이 수행 중 WDT_reset()이 누락되어 워치독 시스템 리셋이 발생하는 전형적인 락업 결함',
    timerMode: 'ctc',
    acTriggerTarget: 'none',
    adcTriggerSource: 'none',
    wdtMode: 'interrupt_and_reset',
    timerIsrLoadUs: 85,
    acIsrLoadUs: 10,
    wdtTimeoutMs: 64
  },
  {
    id: 'analog_comp_shutdown',
    name: '과전류 감지 시 아날로그 비교기 긴급 셧다운 (Safe Trip)',
    tag: 'Safety Trip',
    desc: 'ACSR 인터럽트가 최고 우선순위로 트리거되어 PWM 드라이버 출력을 즉시 안전 로우(Low) 레벨로 차단',
    timerMode: 'fast_pwm',
    acTriggerTarget: 'interrupt_only',
    adcTriggerSource: 'analog_comp',
    wdtMode: 'interrupt',
    timerIsrLoadUs: 20,
    acIsrLoadUs: 4,
    wdtTimeoutMs: 1000
  }
];

export const AvrHardwarePeripheralInterconnectSimulator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  const [activeScenarioId, setActiveScenarioId] = useState<InterconnectPreset>('ac_timer1_capture');
  const [timerMode, setTimerMode] = useState<'normal' | 'ctc' | 'fast_pwm'>('normal');
  const [acTriggerTarget, setAcTriggerTarget] = useState<'timer1_icp' | 'interrupt_only' | 'none'>('timer1_icp');
  const [adcTriggerSource, setAdcTriggerSource] = useState<'timer0_ovf' | 'timer0_compa' | 'analog_comp' | 'none'>('none');
  const [wdtMode, setWdtMode] = useState<'interrupt' | 'system_reset' | 'interrupt_and_reset'>('interrupt');
  const [timerIsrLoadUs, setTimerIsrLoadUs] = useState<number>(15);
  const [acIsrLoadUs, setAcIsrLoadUs] = useState<number>(5);
  const [wdtTimeoutMs, setWdtTimeoutMs] = useState<number>(250);

  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simTick, setSimTick] = useState<number>(0);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Apply Preset
  const handleApplyPreset = (p: InterconnectScenario) => {
    setActiveScenarioId(p.id);
    setTimerMode(p.timerMode);
    setAcTriggerTarget(p.acTriggerTarget);
    setAdcTriggerSource(p.adcTriggerSource);
    setWdtMode(p.wdtMode);
    setTimerIsrLoadUs(p.timerIsrLoadUs);
    setAcIsrLoadUs(p.acIsrLoadUs);
    setWdtTimeoutMs(p.wdtTimeoutMs);
  };

  // Lockup & Priority Risk Analysis
  const riskAnalysis = useMemo(() => {
    // Total ISR execution time per second
    // If Timer fires every 1ms (1000 Hz) and takes `timerIsrLoadUs`
    const timerFreqHz = timerMode === 'ctc' ? 2000 : 1000;
    const timerTotalTimeMsPerSec = (timerFreqHz * timerIsrLoadUs) / 1000;
    const cpuOccupancyPct = Math.min(100, Math.round(timerTotalTimeMsPerSec / 10));

    // WDT margin: If single ISR execution exceeds 10% of WDT timeout, warning
    const maxSingleBlockMs = timerIsrLoadUs / 1000;
    const wdtMarginRatio = (maxSingleBlockMs / wdtTimeoutMs) * 100;

    const isStarvationRisk = cpuOccupancyPct > 80;
    const isWdtResetImminent = timerIsrLoadUs > 60 && wdtTimeoutMs <= 64;

    // ACIC link active check
    const isAcicActive = acTriggerTarget === 'timer1_icp';

    return {
      cpuOccupancyPct,
      isStarvationRisk,
      isWdtResetImminent,
      isAcicActive,
      wdtMarginRatio: wdtMarginRatio.toFixed(2),
      statusGrade: isWdtResetImminent ? 'DANGER' : isStarvationRisk ? 'WARNING' : 'HEALTHY'
    };
  }, [timerMode, timerIsrLoadUs, wdtTimeoutMs, acTriggerTarget]);

  // Registers computation
  const registers = useMemo(() => {
    // ACSR Register: ACD(7)=0, ACBG(6)=1 (Bandgap Vref), ACO(5), ACI(4)=1, ACIE(3)=1, ACIC(2)=(isAcicActive?1:0), ACIS1:0(1:0)=0b10 (Falling edge)
    const acicBit = riskAnalysis.isAcicActive ? 1 : 0;
    const acsrVal = (1 << 6) | (1 << 4) | (1 << 3) | (acicBit << 2) | 0x02;

    // ADCSRA / ADCSRB
    // ADATE(5) in ADCSRA
    let adcsraVal = (1 << 7) | (1 << 2) | (1 << 1) | (1 << 0); // ADEN, DIV128
    let adcsrbVal = 0;
    if (adcTriggerSource === 'timer0_ovf') {
      adcsraVal |= (1 << 5); // ADATE
      adcsrbVal = 0x04; // Timer0 Overflow
    } else if (adcTriggerSource === 'timer0_compa') {
      adcsraVal |= (1 << 5);
      adcsrbVal = 0x03; // Timer0 Compare Match A
    } else if (adcTriggerSource === 'analog_comp') {
      adcsraVal |= (1 << 5);
      adcsrbVal = 0x01; // Analog Comparator
    }

    // WDTCSR
    let wdtcsrVal = (1 << 3); // WDE
    if (wdtMode === 'interrupt') wdtcsrVal = (1 << 6); // WDIE
    else if (wdtMode === 'interrupt_and_reset') wdtcsrVal = (1 << 6) | (1 << 3); // WDIE | WDE

    return {
      acsrHex: `0x${acsrVal.toString(16).toUpperCase().padStart(2, '0')}`,
      adcsraHex: `0x${adcsraVal.toString(16).toUpperCase().padStart(2, '0')}`,
      adcsrbHex: `0x${adcsrbVal.toString(16).toUpperCase().padStart(2, '0')}`,
      wdtcsrHex: `0x${wdtcsrVal.toString(16).toUpperCase().padStart(2, '0')}`
    };
  }, [riskAnalysis, adcTriggerSource, wdtMode]);

  // C Source Code
  const generatedCCode = useMemo(() => {
    return `/* =========================================================================
 * AVR 하드웨어 주변장치 연동 (Interconnect) 및 락업 방지 펌웨어
 * Target MCU : ${currentProfile.name}
 * 연동 시나리오: ${PRESET_SCENARIOS.find((s) => s.id === activeScenarioId)?.name || 'Custom Interconnect'}
 * ========================================================================= */
#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/wdt.h>
#include <stdbool.h>

void hardware_interconnect_init(void) {
    cli();

    // 1. 아날로그 비교기(ACSR) 설정 (ACIC=${riskAnalysis.isAcicActive ? '1 (Timer1 ICP 직접 연동)' : '0'})
    ACSR = ${registers.acsrHex};

${riskAnalysis.isAcicActive ? `    // 2. Timer1 Input Capture Unit 설정 (하드웨어 제로 지연 타임스탬프)
    TCCR1B = (1 << CS10); // 클럭 1분주 동작
    TIMSK1 = (1 << ICIE1); // Input Capture 인터럽트 인에이블` : ''}

${adcTriggerSource !== 'none' ? `    // 3. ADC 자동 트리거 (ADATE) 연동 (ADCSRB 트리거 소스: ${adcTriggerSource})
    ADCSRB = ${registers.adcsrbHex};
    ADCSRA = ${registers.adcsraHex}; // ADEN, ADATE, ADPS2:0` : ''}

    // 4. 워치독 타이머 안전 설정
    wdt_reset();
    WDTCSR = (1 << WDCE) | (1 << WDE);
    WDTCSR = ${registers.wdtcsrHex}; // 타임아웃 주기에 맞춰 재설정

    sei();
}

${riskAnalysis.isAcicActive ? `// Timer1 Input Capture 인터럽트 (아날로그 비교기 이벤트 발생 시 하드웨어 자동 점프)
ISR(TIMER1_CAPT_vect) {
    uint16_t timestamp = ICR1; // 영(0) CPU 지연 정밀 캡처값
    wdt_reset(); // WDT 리셋으로 락업 방지
}` : ''}

// 타이머 주기 서비스 루틴
ISR(TIMER0_COMPA_vect) {
    // ISR 실행 시간을 ${timerIsrLoadUs} µs 이내로 최적화 유지 필수
    wdt_reset();
}
`;
  }, [currentProfile.name, activeScenarioId, riskAnalysis, registers, adcTriggerSource, timerIsrLoadUs]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.85 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-400 text-xs font-semibold mb-2">
            <GitMerge className="w-3.5 h-3.5" /> Hardware Event Trigger Routing & Lockup Diagnostics
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            AVR 하드웨어 주변장치 연동 시뮬레이터 (Peripheral Interconnect)
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Timer/Counter, Analog Comparator, ADC Auto-Trigger 및 Watchdog Timer 간의 
            <span className="text-violet-300 font-medium"> 하드웨어 내부 이벤트 트리거 경로</span>를 시각화하고, 
            비정상적인 인터럽트 점유로 인한 <span className="text-rose-400 font-medium"> 시스템 락업(Lock-up) 및 WDT 타임아웃</span> 가능성을 진단합니다.
          </p>
        </div>

        {/* Status Badge */}
        <div
          className={`p-3 rounded-xl border text-xs space-y-1 self-start lg:self-center ${
            riskAnalysis.statusGrade === 'DANGER'
              ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
              : riskAnalysis.statusGrade === 'WARNING'
              ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
              : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2 font-bold">
            {riskAnalysis.statusGrade === 'DANGER' ? (
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            ) : riskAnalysis.statusGrade === 'WARNING' ? (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            )}
            <span>시스템 안정성: {riskAnalysis.statusGrade}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            CPU ISR 점유율: <strong className="text-white">{riskAnalysis.cpuOccupancyPct}%</strong>
          </div>
        </div>
      </div>

      {/* Preset Banner */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            하드웨어 주변장치 연동 표준 시나리오
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {PRESET_SCENARIOS.map((p) => {
            const isSelected = activeScenarioId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleApplyPreset(p)}
                className={`text-left p-2.5 rounded-lg border transition-all text-xs flex flex-col justify-between ${
                  isSelected
                    ? 'bg-violet-950/40 border-violet-500/50 ring-1 ring-violet-500/40'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-semibold text-white truncate">{p.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                    {p.tag}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-1">{p.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Parameters & Interconnect Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Analog Comparator & Timer Linking */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-400" /> 아날로그 비교기(AC) 연동
          </h3>

          <div>
            <label className="text-xs text-slate-400 block mb-1">비교기 출력 라우팅 대상</label>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              <button
                onClick={() => setAcTriggerTarget('timer1_icp')}
                className={`py-1.5 rounded border transition-all font-semibold ${
                  acTriggerTarget === 'timer1_icp'
                    ? 'bg-violet-500 text-white border-violet-400'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                Timer1 ICP (ACIC)
              </button>
              <button
                onClick={() => setAcTriggerTarget('interrupt_only')}
                className={`py-1.5 rounded border transition-all font-semibold ${
                  acTriggerTarget === 'interrupt_only'
                    ? 'bg-violet-500 text-white border-violet-400'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                단독 인터럽트
              </button>
              <button
                onClick={() => setAcTriggerTarget('none')}
                className={`py-1.5 rounded border transition-all font-semibold ${
                  acTriggerTarget === 'none'
                    ? 'bg-violet-500 text-white border-violet-400'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                미사용
              </button>
            </div>
          </div>

          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>ACSR 레지스터 값:</span>
              <span className="font-mono text-emerald-400 font-bold">{registers.acsrHex}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>ACIC 비트 (비트 2):</span>
              <span className="font-mono text-violet-300 font-bold">
                {riskAnalysis.isAcicActive ? '1 (하드웨어 직접 연동)' : '0'}
              </span>
            </div>
          </div>
        </div>

        {/* Middle: ADC Auto-Trigger Source */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" /> ADC 하드웨어 자동 트리거 (ADATE)
          </h3>

          <div>
            <label className="text-xs text-slate-400 block mb-1">ADC 변환 개시 소스 (ADCSRB[2:0])</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => setAdcTriggerSource('none')}
                className={`p-2 rounded-lg border text-left ${
                  adcTriggerSource === 'none'
                    ? 'bg-cyan-950/40 border-cyan-400 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                수동 소프트웨어 개시
              </button>
              <button
                onClick={() => setAdcTriggerSource('timer0_compa')}
                className={`p-2 rounded-lg border text-left ${
                  adcTriggerSource === 'timer0_compa'
                    ? 'bg-cyan-950/40 border-cyan-400 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                Timer0 Compare A
              </button>
              <button
                onClick={() => setAdcTriggerSource('timer0_ovf')}
                className={`p-2 rounded-lg border text-left ${
                  adcTriggerSource === 'timer0_ovf'
                    ? 'bg-cyan-950/40 border-cyan-400 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                Timer0 Overflow
              </button>
              <button
                onClick={() => setAdcTriggerSource('analog_comp')}
                className={`p-2 rounded-lg border text-left ${
                  adcTriggerSource === 'analog_comp'
                    ? 'bg-cyan-950/40 border-cyan-400 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                아날로그 비교기(AC)
              </button>
            </div>
          </div>

          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>ADCSRA (ADATE 비트 5):</span>
              <span className="font-mono text-cyan-400 font-bold">{registers.adcsraHex}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>ADCSRB 소스 실렉트:</span>
              <span className="font-mono text-cyan-300 font-bold">{registers.adcsrbHex}</span>
            </div>
          </div>
        </div>

        {/* Right: WDT & ISR Load / Lockup Simulator */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" /> WDT 안전 마진 & ISR 락업 진단
          </h3>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>타이머 ISR 블로킹 실행 시간</span>
              <span className="text-rose-400 font-mono font-bold">{timerIsrLoadUs} µs</span>
            </div>
            <input
              type="range"
              min={2}
              max={100}
              step={1}
              value={timerIsrLoadUs}
              onChange={(e) => setTimerIsrLoadUs(parseInt(e.target.value))}
              className="w-full accent-rose-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>WDT 타임아웃 주기</span>
              <span className="text-amber-400 font-mono font-bold">{wdtTimeoutMs} ms</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-xs">
              {[16, 64, 250, 1000].map((t) => (
                <button
                  key={t}
                  onClick={() => setWdtTimeoutMs(t)}
                  className={`py-1 rounded border font-semibold ${
                    wdtTimeoutMs === t
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {t}ms
                </button>
              ))}
            </div>
          </div>

          {/* Lockup Warning */}
          {riskAnalysis.isWdtResetImminent && (
            <div className="p-2.5 bg-rose-950/40 border border-rose-500/60 rounded-lg text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong>워치독 리셋(WDT Reset) 락업 위험!</strong>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  ISR 실행 시간이 너무 길어 주기적 wdt_reset() 호출 타이밍을 놓치고 있습니다.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Embedded C Code Generator */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-violet-400" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                자동 생성된 하드웨어 주변장치 연동 C 소스 코드
              </h3>
              <p className="text-xs text-slate-400">
                선택한 ACIC 연동 및 ADC 자동 트리거 레지스터 설정이 완벽히 반영된 C 코드
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-500 text-white hover:bg-violet-400 transition-all flex items-center gap-1.5 shadow-md shadow-violet-500/20"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? '복사 완료!' : 'C 코드 복사'}
            </button>
          </div>
        </div>

        <pre className="p-4 bg-slate-900/90 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[320px] scrollbar-thin scrollbar-thumb-slate-700">
          <code>{generatedCCode}</code>
        </pre>
      </div>
    </div>
  );
};
