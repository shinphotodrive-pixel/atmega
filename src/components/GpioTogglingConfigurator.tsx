import React, { useState } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { GpioSignalParams } from '../data/gpioSignalTypes';
import {
  Activity,
  Sliders,
  Zap,
  Radio,
  Clock,
  Layers,
  ArrowRight,
  Copy,
  Check,
  TrendingUp,
  Cpu,
  RotateCcw,
  ShieldAlert,
  Waves
} from 'lucide-react';

interface Props {
  selectedMCU: SupportedMCU;
  gpioParams: GpioSignalParams;
  onUpdateParams: (newParams: Partial<GpioSignalParams>) => void;
  onNavigateToOscilloscope: () => void;
}

export const GpioTogglingConfigurator: React.FC<Props> = ({
  selectedMCU,
  gpioParams,
  onUpdateParams,
  onNavigateToOscilloscope
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const [copiedCode, setCopiedCode] = useState(false);

  // Common frequency presets
  const FREQ_PRESETS = [
    { label: '50 Hz (RC 서보 PWM)', freq: 50, duty: 7.5, mode: 'timer_pwm' as const },
    { label: '490 Hz (표준 아두이노 PWM)', freq: 490, duty: 50, mode: 'timer_pwm' as const },
    { label: '1 kHz (버저 / 오디오 톤)', freq: 1000, duty: 50, mode: 'gpio_toggle' as const },
    { label: '10 kHz (DC 모터 H-Bridge)', freq: 10000, duty: 40, mode: 'timer_pwm' as const },
    { label: '50 kHz (고속 스위칭)', freq: 50000, duty: 50, mode: 'gpio_toggle' as const },
    { label: '100 kHz (I2C SCL 기준)', freq: 100000, duty: 50, mode: 'gpio_toggle' as const },
    { label: '1 MHz (SPI 저속 / 클록)', freq: 1000000, duty: 50, mode: 'gpio_toggle' as const },
    { label: '4 MHz (16MHz/4 고속 루프)', freq: 4000000, duty: 50, mode: 'gpio_toggle' as const }
  ];

  // Pin options per MCU
  const pinOptions = React.useMemo(() => {
    if (selectedMCU === 'atmega640') {
      return [
        { name: 'PB5 (OC1A / Pin 19)', port: 'PORTB5', desc: 'Timer1 16-bit Fast PWM / OC1A' },
        { name: 'PB7 (OC0A / Pin 26)', port: 'PORTB7', desc: 'Timer0 8-bit Fast PWM / OC0A' },
        { name: 'PE3 (OC3A / Pin 7)', port: 'PORTE3', desc: 'Timer3 16-bit PWM / OC3A' },
        { name: 'PH3 (OC4A / Pin 16)', port: 'PORTH3', desc: 'Timer4 16-bit PWM / OC4A' },
        { name: 'PL3 (OC5A / Pin 38)', port: 'PORTL3', desc: 'Timer5 16-bit PWM / OC5A' }
      ];
    } else if (selectedMCU === 'atmega128') {
      return [
        { name: 'PB4 (OC0 / Pin 14)', port: 'PORTB4', desc: 'Timer0 8-bit Fast PWM / OC0' },
        { name: 'PB5 (OC1A / Pin 15)', port: 'PORTB5', desc: 'Timer1 16-bit Fast PWM / OC1A' },
        { name: 'PB7 (OC2 / Pin 17)', port: 'PORTB7', desc: 'Timer2 8-bit RTC / OC2' },
        { name: 'PE3 (OC3A / Pin 5)', port: 'PORTE3', desc: 'Timer3 16-bit Fast PWM / OC3A' }
      ];
    } else {
      return [
        { name: 'PB5 (SCK / Arduino D13 LED)', port: 'PORTB5', desc: 'D13 온보드 LED / PINB 고속 토글' },
        { name: 'PD6 (OC0A / Pin 12 / D6)', port: 'PORTD6', desc: 'Timer0 8-bit Fast PWM / OC0A' },
        { name: 'PB1 (OC1A / Pin 15 / D9)', port: 'PORTB1', desc: 'Timer1 16-bit Fast PWM / OC1A' },
        { name: 'PB3 (OC2A / Pin 17 / D11)', port: 'PORTB3', desc: 'Timer2 8-bit Fast PWM / OC2A' }
      ];
    }
  }, [selectedMCU]);

  // Period calculations
  const periodUs = (1 / gpioParams.frequencyHz) * 1000000;
  const highTimeUs = (periodUs * gpioParams.dutyCyclePct) / 100;
  const lowTimeUs = periodUs - highTimeUs;
  const cpuCyclesPerPeriod = Math.round(16000000 / gpioParams.frequencyHz);

  // Generated C Code
  const generatedCode = React.useMemo(() => {
    const isPWM = gpioParams.sourceMode === 'timer_pwm';
    if (isPWM) {
      return `// ==========================================
// ${currentProfile.name} 하드웨어 타이머 PWM 설정
// 주파수: ${gpioParams.frequencyHz.toLocaleString()} Hz, 듀티비: ${gpioParams.dutyCyclePct}%
// 출력 핀: ${gpioParams.pinName}
// ==========================================
#include <avr/io.h>

#define F_CPU 16000000UL

void PWM_Init(void) {
    // 1. 해당 핀 출력 방향(DDR) 활성화
    DDRB |= (1 << DDB5);

    // 2. Fast PWM 모드 및 비반전(Non-Inverting) 출력 설정
    // TCCR1A = (1 << COM1A1) | (1 << WGM11);
    // TCCR1B = (1 << WGM13) | (1 << WGM12) | (1 << CS10); // 1분주

    // 3. 주파수 및 듀티비 레지스터 로드
    // ICR1  = ${Math.max(1, Math.round(16000000 / gpioParams.frequencyHz) - 1)}; // TOP (주파수 결정)
    // OCR1A = ${Math.max(1, Math.round((16000000 / gpioParams.frequencyHz) * (gpioParams.dutyCyclePct / 100)))}; // COMPARE (듀티비 결정)
}`;
    } else {
      return `// ==========================================
// ${currentProfile.name} 초고속 GPIO 토글 (Bit-banging)
// 목표 주파수: ${gpioParams.frequencyHz.toLocaleString()} Hz, 듀티: ${gpioParams.dutyCyclePct}%
// ==========================================
#include <avr/io.h>
#include <util/delay.h>

#define F_CPU 16000000UL

int main(void) {
    // 출력 모드 설정
    DDRB |= (1 << DDB5);

    while (1) {
        // AVR 특유의 PIN 레지스터 1 쓰기로 1사이클 하드웨어 토글 토글
        PINB = (1 << PINB5);
        // 계산된 딜레이: High ${highTimeUs.toFixed(2)} µs / Low ${lowTimeUs.toFixed(2)} µs
        _delay_us(${Math.max(0.1, highTimeUs).toFixed(1)});
    }
}`;
    }
  }, [gpioParams, currentProfile.name, highTimeUs, lowTimeUs]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
            <Waves className="w-3.5 h-3.5" /> GPIO Toggling & Signal Generator (RegistersTab)
          </div>
          <h3 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            GPIO 토글링 주파수 & 듀티 사이클 파라미터 제어기
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-normal">
              Architecture 가상 오실로스코프 연동
            </span>
          </h3>
          <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
            타이머 PWM 및 소프트웨어 GPIO 루프의 토글 주파수($f$), 듀티 사이클(Duty Cycle), 동작 전압, 노이즈 및 지터 파라미터를 설정합니다.
            설정된 신호 파라미터는 <strong>Architecture 탭의 '가상 오실로스코프(Virtual Oscilloscope)'</strong>와 실시간으로 동기화되어 아날로그 파형 및 지터 노이즈를 계측합니다.
          </p>
        </div>

        {/* Big Action Link Button to Oscilloscope */}
        <button
          onClick={onNavigateToOscilloscope}
          className="group inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
        >
          <Activity className="w-4 h-4 text-slate-950 group-hover:animate-pulse" />
          <span>가상 오실로스코프에서 신호 관측</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Preset Quick Select Buttons */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
          주요 표준 응용 주파수 프리셋 (원클릭 로드)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {FREQ_PRESETS.map((preset) => {
            const isSelected =
              gpioParams.frequencyHz === preset.freq &&
              gpioParams.dutyCyclePct === preset.duty &&
              gpioParams.sourceMode === preset.mode;
            return (
              <button
                key={preset.label}
                onClick={() =>
                  onUpdateParams({
                    frequencyHz: preset.freq,
                    dutyCyclePct: preset.duty,
                    sourceMode: preset.mode,
                    description: preset.label
                  })
                }
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-white shadow-sm ring-1 ring-cyan-500/30'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <div className="text-[11px] font-bold truncate">{preset.label}</div>
                <div className="flex items-center justify-between text-[10px] font-mono mt-1 text-slate-400">
                  <span>{preset.freq >= 1000000 ? `${preset.freq / 1000000} MHz` : preset.freq >= 1000 ? `${preset.freq / 1000} kHz` : `${preset.freq} Hz`}</span>
                  <span className="text-cyan-400 font-semibold">{preset.duty}% Duty</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Parameters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Frequency & Mode */}
        <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4.5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              1. 토글 주파수 & 생성 모드
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-bold">
              {gpioParams.frequencyHz.toLocaleString()} Hz
            </span>
          </div>

          {/* Mode Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 font-medium">신호 생성 메커니즘</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdateParams({ sourceMode: 'gpio_toggle' })}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  gpioParams.sourceMode === 'gpio_toggle'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                소프트웨어 GPIO 루프
              </button>
              <button
                type="button"
                onClick={() => onUpdateParams({ sourceMode: 'timer_pwm' })}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  gpioParams.sourceMode === 'timer_pwm'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                하드웨어 타이머 PWM
              </button>
            </div>
          </div>

          {/* Frequency Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">토글 주파수 ($f$)</span>
              <span className="font-mono font-bold text-cyan-400">
                {gpioParams.frequencyHz >= 1000000
                  ? `${(gpioParams.frequencyHz / 1000000).toFixed(3)} MHz`
                  : gpioParams.frequencyHz >= 1000
                  ? `${(gpioParams.frequencyHz / 1000).toFixed(2)} kHz`
                  : `${gpioParams.frequencyHz} Hz`}
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="4000000"
              step="100"
              value={gpioParams.frequencyHz}
              onChange={(e) => onUpdateParams({ frequencyHz: Number(e.target.value) })}
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>10 Hz</span>
              <span>100 kHz</span>
              <span>1 MHz</span>
              <span>4 MHz</span>
            </div>
          </div>

          {/* Target Output Pin */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 font-medium">대상 관측 GPIO 핀 ({currentProfile.name})</label>
            <select
              value={gpioParams.pinName}
              onChange={(e) => {
                const found = pinOptions.find((p) => p.name === e.target.value);
                if (found) {
                  onUpdateParams({ pinName: found.name, pinPort: found.port });
                }
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              {pinOptions.map((pin) => (
                <option key={pin.name} value={pin.name}>
                  {pin.name} - {pin.desc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Column 2: Duty Cycle & Voltage */}
        <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4.5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              2. 듀티 사이클 & 논리 전압 레벨
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold">
              {gpioParams.dutyCyclePct.toFixed(1)}% Duty
            </span>
          </div>

          {/* Duty Cycle Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">듀티 사이클 (펄스 폭 비율)</span>
              <span className="font-mono font-bold text-amber-400">{gpioParams.dutyCyclePct.toFixed(1)} %</span>
            </div>
            <input
              type="range"
              min="1"
              max="99"
              step="0.5"
              value={gpioParams.dutyCyclePct}
              onChange={(e) => onUpdateParams({ dutyCyclePct: Number(e.target.value) })}
              className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <button
                type="button"
                onClick={() => onUpdateParams({ dutyCyclePct: 10 })}
                className="hover:text-amber-300"
              >
                10%
              </button>
              <button
                type="button"
                onClick={() => onUpdateParams({ dutyCyclePct: 25 })}
                className="hover:text-amber-300"
              >
                25%
              </button>
              <button
                type="button"
                onClick={() => onUpdateParams({ dutyCyclePct: 50 })}
                className="hover:text-amber-300 font-bold text-amber-400"
              >
                50% (정방형)
              </button>
              <button
                type="button"
                onClick={() => onUpdateParams({ dutyCyclePct: 75 })}
                className="hover:text-amber-300"
              >
                75%
              </button>
              <button
                type="button"
                onClick={() => onUpdateParams({ dutyCyclePct: 90 })}
                className="hover:text-amber-300"
              >
                90%
              </button>
            </div>
          </div>

          {/* Operating VCC */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 font-medium">MCU VCC 동작 전압 (하이 레벨 V_OH)</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdateParams({ voltageLevel: 5.0 })}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  gpioParams.voltageLevel === 5.0
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                5.0V (표준 16MHz)
              </button>
              <button
                type="button"
                onClick={() => onUpdateParams({ voltageLevel: 3.3 })}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  gpioParams.voltageLevel === 3.3
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                3.3V (저전압 8MHz)
              </button>
            </div>
          </div>

          {/* Quick Timing Readouts */}
          <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800/80 text-[11px] font-mono space-y-1 text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">주기 (T = 1/f):</span>
              <span className="font-bold text-white">
                {periodUs >= 1000 ? `${(periodUs / 1000).toFixed(2)} ms` : `${periodUs.toFixed(3)} µs`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">High 폭 (T_HIGH):</span>
              <span className="text-emerald-400">
                {highTimeUs >= 1000 ? `${(highTimeUs / 1000).toFixed(2)} ms` : `${highTimeUs.toFixed(3)} µs`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Low 폭 (T_LOW):</span>
              <span className="text-sky-400">
                {lowTimeUs >= 1000 ? `${(lowTimeUs / 1000).toFixed(2)} ms` : `${lowTimeUs.toFixed(3)} µs`}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800">
              <span className="text-slate-400">CPU 사이클/주기:</span>
              <span className="text-amber-400 font-bold">{cpuCyclesPerPeriod} 클록</span>
            </div>
          </div>
        </div>

        {/* Column 3: Signal Noise & Jitter Simulation Params */}
        <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4.5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-rose-400" />
              3. 아날로그 노이즈 & 에지 지터 (Jitter)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 font-bold">
              {gpioParams.noiseMv} mV / {gpioParams.jitterNs} ns
            </span>
          </div>

          {/* Noise Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">전원 리플 & 열 잡음 (V_noise)</span>
              <span className="font-mono font-bold text-rose-400">{gpioParams.noiseMv} mV</span>
            </div>
            <input
              type="range"
              min="0"
              max="400"
              step="5"
              value={gpioParams.noiseMv}
              onChange={(e) => onUpdateParams({ noiseMv: Number(e.target.value) })}
              className="w-full accent-rose-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 mV (이상적)</span>
              <span>100 mV</span>
              <span>250 mV</span>
              <span>400 mV (불량)</span>
            </div>
          </div>

          {/* Jitter Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">에지 타이밍 지터 (T_jitter RMS)</span>
              <span className="font-mono font-bold text-violet-400">{gpioParams.jitterNs} ns</span>
            </div>
            <input
              type="range"
              min="0"
              max="250"
              step="5"
              value={gpioParams.jitterNs}
              onChange={(e) => onUpdateParams({ jitterNs: Number(e.target.value) })}
              className="w-full accent-violet-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 ns</span>
              <span>50 ns</span>
              <span>150 ns</span>
              <span>250 ns (심각)</span>
            </div>
          </div>

          {/* PCB Ringing & Slew Rate */}
          <div className="space-y-2 pt-1 border-t border-slate-800">
            <label className="flex items-center justify-between text-xs cursor-pointer text-slate-300">
              <span className="font-medium">기생 인덕턴스 오버슈트 링잉(Ringing) 모사</span>
              <input
                type="checkbox"
                checked={gpioParams.ringingEnabled}
                onChange={(e) => onUpdateParams({ ringingEnabled: e.target.checked })}
                className="rounded accent-rose-500 w-4 h-4"
              />
            </label>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>슬루율(Slew Rate):</span>
              <span className="font-mono text-cyan-400">{gpioParams.slewRateVPerUs} V/µs (약 25ns 상승시간)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Code Snippet & Link Callout */}
      <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white font-mono">
              {currentProfile.name} {gpioParams.sourceMode === 'timer_pwm' ? 'Timer Hardware PWM' : 'Bare-metal PIN Toggle'} C Source
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? '복사 완료' : '코드 복사'}
            </button>
            <button
              onClick={onNavigateToOscilloscope}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition-all"
            >
              <Activity className="w-3.5 h-3.5" />
              오실로스코프로 이동
            </button>
          </div>
        </div>
        <pre className="text-[11px] font-mono text-cyan-200/90 bg-slate-950 p-3 rounded-lg border border-slate-800/80 overflow-x-auto leading-relaxed">
          {generatedCode}
        </pre>
      </div>
    </div>
  );
};
