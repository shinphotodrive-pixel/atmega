import React, { useState } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { Activity, AlertTriangle, Check, Copy, Cpu, Info, Sliders, Sparkles, Terminal } from 'lucide-react';

interface Props {
  selectedMCU: SupportedMCU;
}

export const AdcSamplingNoiseCalculator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // User Inputs
  const [adcFcpu, setAdcFcpu] = useState<number>(16000000);
  const [prescaler, setPrescaler] = useState<number>(128); // 2, 4, 8, 16, 32, 64, 128
  const [analogImpedanceKohm, setAnalogImpedanceKohm] = useState<number>(10); // Source impedance kΩ
  const [referenceVoltage, setReferenceVoltage] = useState<'avcc' | 'internal_1v1' | 'internal_2v56' | 'aref'>('avcc');
  const [useNoiseReductionSleep, setUseNoiseReductionSleep] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Available Prescalers in ADCSRA (ADPS2:0)
  const prescalerOptions = [
    { value: 2, bits: '001', label: '÷ 2' },
    { value: 4, bits: '010', label: '÷ 4' },
    { value: 8, bits: '011', label: '÷ 8' },
    { value: 16, bits: '100', label: '÷ 16' },
    { value: 32, bits: '101', label: '÷ 32' },
    { value: 64, bits: '110', label: '÷ 64' },
    { value: 128, bits: '111', label: '÷ 128 (표준 권장)' }
  ];

  // Calculations:
  // 1. ADC Clock Frequency (Hz)
  const adcClockHz = adcFcpu / prescaler;
  const adcClockKhz = adcClockHz / 1000;

  // Datasheet limits: 50 kHz ~ 200 kHz for full 10-bit resolution
  // Up to 1 MHz if only 8-bit resolution is required
  const isClockOptimal = adcClockKhz >= 50 && adcClockKhz <= 200;
  const isClockTooFast = adcClockKhz > 200;
  const isClockTooSlow = adcClockKhz < 50;

  // 2. Conversion Time:
  // Standard conversion takes 13 ADC clock cycles
  // First conversion after enable takes 25 ADC clock cycles
  const normalCycles = 13;
  const firstCycles = 25;
  const conversionTimeUs = (normalCycles / adcClockHz) * 1000000;
  const firstConversionTimeUs = (firstCycles / adcClockHz) * 1000000;
  const samplingRateKsps = 1000 / conversionTimeUs; // kSPS (kilo samples per second)

  // 3. Source Impedance & Sample/Hold Charging Time:
  // Datasheet states: R_in should be <= 10 kΩ.
  // Internal sampling capacitor C_S ≈ 14 pF.
  // Charging time constant τ = (R_source + R_mux) * C_S (R_mux ≈ 1~10 kΩ)
  const isImpedanceHigh = analogImpedanceKohm > 10;
  const isImpedanceVeryHigh = analogImpedanceKohm > 50;
  const recommendedCapacitorNf = analogImpedanceKohm > 10 ? Math.round((analogImpedanceKohm * 10) / 10) * 10 : 100;

  // 4. Noise & Effective Number of Bits (ENOB) Estimation:
  let estimatedEnob = 10.0;
  let noiseSources: string[] = [];

  if (isClockTooFast) {
    const penalty = Math.min(2.5, (adcClockKhz - 200) / 300);
    estimatedEnob -= penalty;
    noiseSources.push(`ADC 클럭 초과(${adcClockKhz.toFixed(0)}kHz > 200kHz): 내부 SAR 비교기 수렴 지연으로 하위 LSB 노이즈 급증 (-${penalty.toFixed(1)} Bit)`);
  }
  if (isImpedanceHigh) {
    const penalty = Math.min(2.0, (analogImpedanceKohm - 10) / 40);
    estimatedEnob -= penalty;
    noiseSources.push(`신호원 임피던스 과다(${analogImpedanceKohm}kΩ > 10kΩ): 1.5 ADC 사이클 S/H 충전 부족으로 이전 채널 고스트 크로스토크 발생 (-${penalty.toFixed(1)} Bit)`);
  }
  if (!useNoiseReductionSleep) {
    estimatedEnob -= 0.6;
    noiseSources.push('디지털 CPU 코어 스위칭 노이즈: Active 모드 변환 시 VCC 디지털 노이즈 유입 (-0.6 Bit)');
  }
  if (isClockTooSlow) {
    noiseSources.push(`ADC 클럭이 너무 느림(${adcClockKhz.toFixed(0)}kHz < 50kHz): S/H 커패시터 누설 전류로 변환 드리프트 발생 가능`);
  }

  const finalEnob = Math.max(6.0, Math.min(10.0, estimatedEnob));
  const lsbResolutionMv = (5000 / 1024); // 5V default

  // ADCSRA & ADMUX Register Values
  const selectedPrescalerOption = prescalerOptions.find((p) => p.value === prescaler) || prescalerOptions[6];
  const adpsBits = selectedPrescalerOption.bits;

  // Reference Voltage Configuration for ADMUX REFS1:0
  let refsBits = '01'; // AVCC with external capacitor at AREF
  let refName = 'AVCC (5V / 3.3V 전원 기준)';
  let refVoltageVal = 5.0;

  if (referenceVoltage === 'internal_1v1') {
    refsBits = selectedMCU === 'atmega128' ? '11' : '10'; // 1.1V internal bandgap
    refName = selectedMCU === 'atmega128' ? '내부 2.56V 밴드갭 기준' : '내부 1.1V 밴드갭 기준';
    refVoltageVal = selectedMCU === 'atmega128' ? 2.56 : 1.1;
  } else if (referenceVoltage === 'internal_2v56') {
    refsBits = '11';
    refName = '내부 2.56V 고정밀 기준 (REFS1:0 = 11)';
    refVoltageVal = 2.56;
  } else if (referenceVoltage === 'aref') {
    refsBits = '00';
    refName = '외부 AREF 핀 인가 전압 (REFS1:0 = 00)';
    refVoltageVal = 3.3;
  }

  // Recommended Auto-Tune Function
  const handleAutoTune = () => {
    // Find optimal prescaler for 50kHz <= adcClock <= 200kHz
    let bestP = 128;
    for (const opt of prescalerOptions) {
      const clk = (adcFcpu / opt.value) / 1000;
      if (clk >= 50 && clk <= 200) {
        bestP = opt.value;
        break;
      }
    }
    setPrescaler(bestP);
    setUseNoiseReductionSleep(true);
    if (analogImpedanceKohm > 10) {
      setAnalogImpedanceKohm(10);
    }
  };

  // Generate Bare-metal C Code
  const generateAdcCode = (): string => {
    return `// ============================================================
// ${currentProfile.name} 10비트 고정밀 저노이즈 ADC 초기화 C 코드
// F_CPU: ${(adcFcpu / 1000000).toFixed(4)} MHz, 분주비: ÷${prescaler} => ADC Clock: ${adcClockKhz.toFixed(1)} kHz
// 변환 시간: ${conversionTimeUs.toFixed(1)} µs, 샘플링 속도: ${samplingRateKsps.toFixed(2)} kSPS
// 기준 전압: ${refName}
// ============================================================
#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/sleep.h>

void ADC_Init_Optimized(void) {
    // 1. ADMUX 설정: 기준 전압(REFS1:0 = ${refsBits}) & 채널 0 선택 (MUX4:0 = 0)
    ADMUX = (${refsBits[0] === '1' ? '(1 << REFS1) | ' : ''}${refsBits[1] === '1' ? '(1 << REFS0)' : '0'});

    // 2. ADCSRA 설정: ADC 활성화(ADEN), 인터럽트 인에이블(ADIE), 프리스케일러(ADPS2:0 = ${adpsBits})
    ADCSRA = (1 << ADEN) | (1 << ADIE)
           ${adpsBits[0] === '1' ? '| (1 << ADPS2)' : ''}
           ${adpsBits[1] === '1' ? '| (1 << ADPS1)' : ''}
           ${adpsBits[2] === '1' ? '| (1 << ADPS0)' : ''};

    // 3. 디지털 입력 버퍼 차단 (DIDR0): 아날로그 핀 디지털 로직 누설 전류 차단
    ${selectedMCU === 'atmega328p' ? 'DIDR0 = (1 << ADC0D);' : 'DIDR0 = 0x01; // ADC0 핀 누설 전류 차단'}
}

${
  useNoiseReductionSleep
    ? `// 저노이즈 슬립 모드(ADC Noise Reduction) 기반 10비트 고정밀 읽기 루틴
uint16_t ADC_Read_LowNoise(uint8_t channel) {
    ADMUX = (ADMUX & 0xF0) | (channel & 0x0F);

    // CPU 및 I/O 클럭을 일시 정지시켜 디지털 스위칭 노이즈 완전 차단
    set_sleep_mode(SLEEP_MODE_ADC);
    sleep_enable();
    sei();
    sleep_cpu(); // ADC 변환이 완료되면 ADC 인터럽트가 발생하여 자동으로 깨어남
    sleep_disable();

    return ADC; // 10비트 결과값 (ADCL 선행 판독 후 ADCH 자동 병합)
}

ISR(ADC_vect) {
    // ADC 변환 완료 인터럽트 (CPU Wakeup 전용)
}`
    : `// 표준 폴링(Polling) 방식 ADC 읽기 루틴
uint16_t ADC_Read_Polling(uint8_t channel) {
    ADMUX = (ADMUX & 0xF0) | (channel & 0x0F);
    ADCSRA |= (1 << ADSC); // 변환 시작
    while (ADCSRA & (1 << ADSC)); // 완료 대기
    return ADC;
}`
}`;
  };

  const copyAdcCode = () => {
    navigator.clipboard.writeText(generateAdcCode());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-lg space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
              <span>{currentProfile.name} ADC 노이즈 & 샘플링 레이트 계산기</span>
              <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                10-bit SAR ADC
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              클럭 분주비와 아날로그 신호원 임피던스(kΩ)에 따른 최적 샘플링 속도 및 유효 비트수(ENOB)를 산출합니다.
            </p>
          </div>
        </div>

        <button
          onClick={handleAutoTune}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-md shadow-amber-500/20 shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          최적 저노이즈 자동 설정
        </button>
      </div>

      {/* Input Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-xs">
        {/* Input 1: F_CPU */}
        <div className="space-y-1.5">
          <label className="text-slate-400 font-bold flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-amber-400" /> 시스템 클럭 (F_CPU)
          </label>
          <select
            value={adcFcpu}
            onChange={(e) => setAdcFcpu(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
          >
            <option value={16000000}>16.000 MHz (5V 표준)</option>
            <option value={8000000}>8.000 MHz (3.3V 표준)</option>
            <option value={20000000}>20.000 MHz (328P 최대)</option>
            <option value={12000000}>12.000 MHz</option>
            <option value={4000000}>4.000 MHz (저전력)</option>
          </select>
          <span className="text-[10px] text-slate-500 block font-mono">
            현재: {(adcFcpu / 1000000).toFixed(2)} MHz
          </span>
        </div>

        {/* Input 2: Prescaler */}
        <div className="space-y-1.5">
          <label className="text-slate-400 font-bold flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" /> ADC 분주비 (ADPS2:0)
          </label>
          <select
            value={prescaler}
            onChange={(e) => setPrescaler(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono"
          >
            {prescalerOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} (비트: {opt.bits})
              </option>
            ))}
          </select>
          <span className="text-[10px] text-slate-500 block font-mono">
            ADC 클럭: <strong>{adcClockKhz.toFixed(1)} kHz</strong>
          </span>
        </div>

        {/* Input 3: Source Impedance */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-slate-400 font-bold flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" /> 신호원 임피던스
            </label>
            <span className={`font-mono font-bold ${isImpedanceHigh ? 'text-rose-400' : 'text-emerald-400'}`}>
              {analogImpedanceKohm} kΩ
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            step={1}
            value={analogImpedanceKohm}
            onChange={(e) => setAnalogImpedanceKohm(parseInt(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>1 kΩ</span>
            <span className="text-emerald-400">권장 10kΩ</span>
            <span>100 kΩ</span>
          </div>
        </div>

        {/* Input 4: Reference Voltage */}
        <div className="space-y-1.5">
          <label className="text-slate-400 font-bold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> 기준 전압 (VREF)
          </label>
          <select
            value={referenceVoltage}
            onChange={(e) => setReferenceVoltage(e.target.value as any)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
          >
            <option value="avcc">AVCC 핀 전원 기준 (권장)</option>
            <option value="internal_1v1">
              {selectedMCU === 'atmega128' ? '내부 2.56V 밴드갭' : '내부 1.1V 밴드갭'}
            </option>
            {selectedMCU !== 'atmega128' && (
              <option value="internal_2v56">내부 2.56V (640 전용)</option>
            )}
            <option value="aref">외부 AREF 핀 인가 전압</option>
          </select>
          <span className="text-[10px] text-slate-500 block font-mono">
            {refVoltageVal.toFixed(2)}V (LSB: {(refVoltageVal / 1024 * 1000).toFixed(2)} mV)
          </span>
        </div>
      </div>

      {/* Sleep Mode Toggle Checkbox */}
      <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
        <label className="flex items-center gap-2 cursor-pointer text-slate-200">
          <input
            type="checkbox"
            checked={useNoiseReductionSleep}
            onChange={(e) => setUseNoiseReductionSleep(e.target.checked)}
            className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
          />
          <span className="font-semibold text-white">
            ADC 노이즈 리덕션 슬립 모드(SLEEP_MODE_ADC) 적용
          </span>
        </label>
        <span className="text-[11px] text-slate-400">
          💡 변환 중 CPU 코어를 잠재워 고주파 디지털 노이즈 유입을 원천 차단합니다.
        </span>
      </div>

      {/* Calculated KPIs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* KPI 1: ADC Clock Speed */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <span className="text-slate-500 block text-[10px]">ADC 변환 클럭 주파수</span>
          <div className="flex items-baseline gap-1">
            <span
              className={`font-mono text-xl font-bold ${
                isClockOptimal ? 'text-emerald-400' : isClockTooFast ? 'text-rose-400' : 'text-amber-400'
              }`}
            >
              {adcClockKhz.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 font-mono">kHz</span>
          </div>
          <span
            className={`text-[10px] font-semibold block ${
              isClockOptimal ? 'text-emerald-500' : 'text-rose-400'
            }`}
          >
            {isClockOptimal ? '✓ 10비트 권장(50~200kHz)' : isClockTooFast ? '⚠️ 200kHz 초과(해상도 저하)' : '⚠️ 50kHz 미만(누설 드리프트)'}
          </span>
        </div>

        {/* KPI 2: Conversion Time */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <span className="text-slate-500 block text-[10px]">1회 변환 소요 시간 (13 Cycles)</span>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold text-cyan-400">
              {conversionTimeUs.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 font-mono">µs</span>
          </div>
          <span className="text-[10px] text-slate-500 block font-mono">
            초기 변환: {firstConversionTimeUs.toFixed(1)} µs (25 Cycles)
          </span>
        </div>

        {/* KPI 3: Sampling Rate (kSPS) */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <span className="text-slate-500 block text-[10px]">최대 샘플링 속도 (Sampling Rate)</span>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold text-amber-400">
              {samplingRateKsps.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 font-mono">kSPS</span>
          </div>
          <span className="text-[10px] text-slate-500 block font-mono">
            초당 {Math.round(samplingRateKsps * 1000).toLocaleString()} 회 샘플링
          </span>
        </div>

        {/* KPI 4: Estimated ENOB */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <span className="text-slate-500 block text-[10px]">추정 유효 비트수 (ENOB)</span>
          <div className="flex items-baseline gap-1">
            <span
              className={`font-mono text-xl font-bold ${
                finalEnob >= 9.5 ? 'text-emerald-400' : finalEnob >= 8.5 ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              {finalEnob.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ 10 Bits</span>
          </div>
          <span className="text-[10px] text-slate-500 block font-mono">
            유효 분해능: {Math.pow(2, finalEnob).toFixed(0)} 단계
          </span>
        </div>
      </div>

      {/* Engineering Warnings & Workarounds Banner */}
      {noiseSources.length > 0 && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-rose-300 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>ADC 노이즈 유입 및 해상도 저하 감지 ({noiseSources.length}건):</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
            {noiseSources.map((src, i) => (
              <li key={i}>{src}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Hardware Layout & Filtering Design Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
          <strong className="text-amber-400 block font-bold flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> 1. AVCC LC 노이즈 필터링 권장
          </strong>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            디지털 VCC와 아날로그 AVCC 사이에 <strong>10 µH 인덕터</strong>를 직렬 삽입하고, AVCC 핀과 GND 사이에 <strong>100 nF 커패시터</strong>를 최대한 가깝게 배치하여 고주파 노이즈를 억제하세요.
          </p>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
          <strong className="text-cyan-400 block font-bold flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> 2. AREF 핀 디커플링 설계
          </strong>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            AREF 핀을 내부 기준전압이나 AVCC로 사용할 때에도, 반드시 AREF 핀과 아날로그 GND 사이에 <strong>100 nF 세라믹 커패시터</strong>를 연결해야 내부 레퍼런스 지터가 억제됩니다.
          </p>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
          <strong className="text-emerald-400 block font-bold flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> 3. 고임피던스 완충 바이패스
          </strong>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            센서 임피던스가 10 kΩ을 초과하는 경우, ADC 핀 바로 앞에 <strong>{recommendedCapacitorNf} nF 필터 커패시터</strong>를 추가하거나 전치단에 <strong>레일 투 레일 Op-Amp 버퍼(Voltage Follower)</strong>를 장착하세요.
          </p>
        </div>
      </div>

      {/* Code Snippet Box */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span className="font-mono flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            10비트 고정밀 ADC 초기화 & 읽기 루틴 (C 언어)
          </span>
          <button
            onClick={copyAdcCode}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition border border-slate-700"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedCode ? '복사 완료' : 'ADC 코드 복사'}
          </button>
        </div>
        <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56 custom-scrollbar">
          {generateAdcCode()}
        </pre>
      </div>
    </div>
  );
};
