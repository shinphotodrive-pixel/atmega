import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  AreaChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend
} from 'recharts';
import {
  Activity,
  Zap,
  Sliders,
  Cpu,
  RefreshCw,
  Copy,
  Check,
  Info,
  AlertTriangle,
  Play,
  Pause,
  Download,
  Settings2,
  Waves,
  Eye,
  Maximize2
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

export interface SignalVisualizerProps {
  selectedMCU: SupportedMCU;
}

// Frequency options in MHz
const CLOCK_OPTIONS = [
  { label: '16.0 MHz (기본 크리스탈)', value: 16000000 },
  { label: '20.0 MHz (ATmega328P 최대)', value: 20000000 },
  { label: '8.0 MHz (내부 RC 오실레이터)', value: 8000000 },
  { label: '4.0 MHz (저전력)', value: 4000000 },
  { label: '1.0 MHz (CKDIV8 기본 활성)', value: 1000000 }
];

// Prescalers for Timers
const TIMER_PRESCALERS = [1, 8, 64, 256, 1024];

// Prescalers for ADC
const ADC_PRESCALERS = [2, 4, 8, 16, 32, 64, 128];

export const PeripheralSignalVisualizer: React.FC<SignalVisualizerProps> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'pwm' | 'adc' | 'loopback'>('pwm');

  // Clock setting
  const [mcuFreq, setMcuFreq] = useState<number>(16000000);

  // ----------------------------------------------------
  // PWM Controls State
  // ----------------------------------------------------
  const timerOptions = useMemo(() => {
    if (selectedMCU === 'atmega640') {
      return [
        { id: 'timer0', name: 'Timer0 (8-bit)', bits: 8, pin: 'OC0A (PB7 / D13)', ocrMax: 255 },
        { id: 'timer1', name: 'Timer1 (16-bit)', bits: 16, pin: 'OC1A (PB5 / D11)', ocrMax: 65535 },
        { id: 'timer2', name: 'Timer2 (8-bit RTC)', bits: 8, pin: 'OC2A (PB4 / D10)', ocrMax: 255 },
        { id: 'timer3', name: 'Timer3 (16-bit)', bits: 16, pin: 'OC3A (PE3 / D5)', ocrMax: 65535 },
        { id: 'timer4', name: 'Timer4 (16-bit)', bits: 16, pin: 'OC4A (PH3 / D6)', ocrMax: 65535 },
        { id: 'timer5', name: 'Timer5 (16-bit)', bits: 16, pin: 'OC5A (PL3 / D46)', ocrMax: 65535 }
      ];
    } else if (selectedMCU === 'atmega128') {
      return [
        { id: 'timer0', name: 'Timer0 (8-bit)', bits: 8, pin: 'OC0 (PB4)', ocrMax: 255 },
        { id: 'timer1', name: 'Timer1 (16-bit)', bits: 16, pin: 'OC1A (PB5)', ocrMax: 65535 },
        { id: 'timer2', name: 'Timer2 (8-bit)', bits: 8, pin: 'OC2 (PB7)', ocrMax: 255 },
        { id: 'timer3', name: 'Timer3 (16-bit)', bits: 16, pin: 'OC3A (PE3)', ocrMax: 65535 }
      ];
    } else {
      // atmega328p
      return [
        { id: 'timer0', name: 'Timer0 (8-bit)', bits: 8, pin: 'OC0A (PD6 / D6)', ocrMax: 255 },
        { id: 'timer1', name: 'Timer1 (16-bit)', bits: 16, pin: 'OC1A (PB1 / D9)', ocrMax: 65535 },
        { id: 'timer2', name: 'Timer2 (8-bit)', bits: 8, pin: 'OC2A (PB3 / D11)', ocrMax: 255 }
      ];
    }
  }, [selectedMCU]);

  const [selectedTimerId, setSelectedTimerId] = useState<string>('timer0');
  const selectedTimer = timerOptions.find(t => t.id === selectedTimerId) || timerOptions[0];

  const [pwmMode, setPwmMode] = useState<'fast' | 'phase_correct'>('fast');
  const [timerPrescaler, setTimerPrescaler] = useState<number>(64);
  const [dutyCyclePct, setDutyCyclePct] = useState<number>(40); // 40%
  const [isInverted, setIsInverted] = useState<boolean>(false);
  const [cyclesToShow, setCyclesToShow] = useState<number>(3);
  const [showCounterRamp, setShowCounterRamp] = useState<boolean>(true);

  // 16-bit specific custom TOP (for Timer1/3/4/5 in ICR mode)
  const [useCustomTop, setUseCustomTop] = useState<boolean>(false);
  const [customTopValue, setCustomTopValue] = useState<number>(39999); // 50Hz RC servo default at 16MHz/N=8

  // ----------------------------------------------------
  // ADC Controls State
  // ----------------------------------------------------
  const [adcPrescaler, setAdcPrescaler] = useState<number>(128);
  const [adcResolution, setAdcResolution] = useState<10 | 8>(10);
  const [adcVref, setAdcVref] = useState<number>(5.0);
  const [signalType, setSignalType] = useState<'sine' | 'triangle' | 'dc' | 'sawtooth'>('sine');
  const [signalFreq, setSignalFreq] = useState<number>(100); // 100 Hz input wave
  const [signalAmplitude, setSignalAmplitude] = useState<number>(2.0); // 2V peak-to-peak
  const [signalOffset, setSignalOffset] = useState<number>(2.5); // 2.5V DC offset
  const [signalNoise, setSignalNoise] = useState<number>(0.05); // noise RMS in Volts
  const [adcAveraging, setAdcAveraging] = useState<boolean>(false);

  // ----------------------------------------------------
  // Loopback (PWM -> RC Filter -> ADC) Controls State
  // ----------------------------------------------------
  const [rcCutoffKHz, setRcCutoffKHz] = useState<number>(0.5); // 500 Hz cutoff

  // UI state
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // ----------------------------------------------------
  // Calculations: PWM
  // ----------------------------------------------------
  const pwmCalculations = useMemo(() => {
    const is16Bit = selectedTimer.bits === 16;
    let topVal = is16Bit ? (useCustomTop ? customTopValue : 1023) : 255;
    if (topVal < 1) topVal = 1;

    // Fast PWM: f = f_clk / (N * (TOP + 1))
    // Phase Correct: f = f_clk / (2 * N * TOP)
    let freqHz = 0;
    if (pwmMode === 'fast') {
      freqHz = mcuFreq / (timerPrescaler * (topVal + 1));
    } else {
      freqHz = mcuFreq / (2 * timerPrescaler * topVal);
    }

    const periodSec = 1 / freqHz;
    const periodUs = periodSec * 1000000;
    const periodMs = periodSec * 1000;

    const ocrValue = Math.round((dutyCyclePct / 100) * topVal);
    const effectiveDuty = isInverted ? 100 - dutyCyclePct : dutyCyclePct;
    const tHighUs = (effectiveDuty / 100) * periodUs;
    const tLowUs = periodUs - tHighUs;

    return {
      topVal,
      ocrValue,
      freqHz,
      periodSec,
      periodUs,
      periodMs,
      effectiveDuty,
      tHighUs,
      tLowUs
    };
  }, [selectedTimer, useCustomTop, customTopValue, pwmMode, mcuFreq, timerPrescaler, dutyCyclePct, isInverted]);

  // Generate PWM chart points
  const pwmChartData = useMemo(() => {
    const { periodUs, topVal, ocrValue } = pwmCalculations;
    const totalDurationUs = periodUs * cyclesToShow;
    const pointsPerCycle = 80;
    const totalPoints = Math.min(cyclesToShow * pointsPerCycle, 400);

    const data: Array<{
      timeUs: number;
      timeMs: number;
      voltage: number;
      counterLevel: number;
      ocrLevel: number;
      cycle: number;
    }> = [];

    const dt = totalDurationUs / totalPoints;

    for (let i = 0; i <= totalPoints; i++) {
      const t = i * dt;
      const cycleIndex = Math.floor(t / periodUs);
      const timeInCycle = t - cycleIndex * periodUs;
      const phaseNorm = timeInCycle / periodUs; // 0.0 to 1.0

      // Counter ramp
      let counterRatio = 0;
      if (pwmMode === 'fast') {
        counterRatio = phaseNorm;
      } else {
        // Dual slope
        if (phaseNorm < 0.5) {
          counterRatio = phaseNorm * 2;
        } else {
          counterRatio = (1.0 - phaseNorm) * 2;
        }
      }

      const counterVal = Math.floor(counterRatio * topVal);
      const isHigh = pwmMode === 'fast'
        ? counterVal < ocrValue
        : counterVal < ocrValue;

      const pinHigh = isInverted ? !isHigh : isHigh;
      const voltage = pinHigh ? 5.0 : 0.0;

      data.push({
        timeUs: parseFloat(t.toFixed(2)),
        timeMs: parseFloat((t / 1000).toFixed(4)),
        voltage,
        counterLevel: parseFloat((counterRatio * 5.0).toFixed(2)), // scaled to 0-5V for overlay
        ocrLevel: parseFloat(((ocrValue / topVal) * 5.0).toFixed(2)),
        cycle: cycleIndex + 1
      });
    }

    return data;
  }, [pwmCalculations, cyclesToShow, pwmMode, isInverted]);

  // ----------------------------------------------------
  // Calculations: ADC
  // ----------------------------------------------------
  const adcCalculations = useMemo(() => {
    const fAdcHz = mcuFreq / adcPrescaler;
    const fAdcKHz = fAdcHz / 1000;

    // Normal conversion = 13 ADC clock cycles
    const convCycles = 13;
    const convTimeUs = (convCycles / fAdcHz) * 1000000;
    const samplingRateSps = fAdcHz / convCycles;

    // AVR Hardware guideline: 50 kHz ~ 200 kHz for 10-bit resolution
    const isOptimalClock = fAdcKHz >= 50 && fAdcKHz <= 200;
    const isClockTooFast = fAdcKHz > 200;
    const isClockCriticalFast = fAdcKHz > 1000; // >1MHz resolution severely degrades
    const isClockTooSlow = fAdcKHz < 50;

    const maxCode = adcResolution === 10 ? 1023 : 255;
    const lsbMilliVolts = (adcVref / (maxCode + 1)) * 1000;

    // Nyquist limit
    const nyquistLimitHz = samplingRateSps / 2;
    const isAliasing = signalFreq >= nyquistLimitHz;

    return {
      fAdcHz,
      fAdcKHz,
      convTimeUs,
      samplingRateSps,
      isOptimalClock,
      isClockTooFast,
      isClockCriticalFast,
      isClockTooSlow,
      maxCode,
      lsbMilliVolts,
      nyquistLimitHz,
      isAliasing
    };
  }, [mcuFreq, adcPrescaler, adcResolution, adcVref, signalFreq]);

  // Generate ADC chart points
  const adcChartData = useMemo(() => {
    const { samplingRateSps, convTimeUs, maxCode } = adcCalculations;
    const signalPeriodSec = 1 / signalFreq;
    const totalSimDurationSec = Math.min(signalPeriodSec * 2.5, 0.05); // show 2.5 cycles or up to 50ms
    const totalSimDurationUs = totalSimDurationSec * 1000000;

    const continuousPointsCount = 200;
    const dtContinuousUs = totalSimDurationUs / continuousPointsCount;

    // ADC sampling timestamps
    const sampleIntervalUs = (1 / samplingRateSps) * 1000000;
    const samples: Array<{ timeUs: number; rawSample: number; quantVolts: number }> = [];

    let curSampleTimeUs = 0;
    let seed = 42;
    const pseudoNoise = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return (seed / 233280 - 0.5) * 2; // -1.0 to 1.0
    };

    const evalAnalog = (tUs: number) => {
      const tSec = tUs / 1000000;
      let wave = 0;
      if (signalType === 'sine') {
        wave = Math.sin(2 * Math.PI * signalFreq * tSec);
      } else if (signalType === 'triangle') {
        const p = (tSec * signalFreq) % 1;
        wave = p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
      } else if (signalType === 'sawtooth') {
        const p = (tSec * signalFreq) % 1;
        wave = 2 * p - 1;
      } else {
        // DC
        wave = 0;
      }

      const cleanVolts = signalOffset + (signalAmplitude / 2) * wave;
      const noisyVolts = cleanVolts + signalNoise * pseudoNoise();
      // Clamp to 0..Vref
      return Math.min(Math.max(noisyVolts, 0), adcVref);
    };

    while (curSampleTimeUs <= totalSimDurationUs) {
      const vIn = evalAnalog(curSampleTimeUs);
      const rawCode = Math.min(maxCode, Math.max(0, Math.round((vIn / adcVref) * maxCode)));
      const quantVolts = (rawCode / maxCode) * adcVref;
      samples.push({
        timeUs: curSampleTimeUs,
        rawSample: rawCode,
        quantVolts
      });
      curSampleTimeUs += sampleIntervalUs;
    }

    // Build merged timeline
    const data: Array<{
      timeUs: number;
      timeMs: number;
      analogVoltage: number;
      sampledPoint: number | null;
      quantizedStaircase: number;
      rawAdcValue: number | null;
      errorMv: number;
    }> = [];

    let sampleIdx = 0;
    let lastQuantVolts = samples.length > 0 ? samples[0].quantVolts : 0;
    let lastRawCode = samples.length > 0 ? samples[0].rawSample : 0;

    for (let i = 0; i <= continuousPointsCount; i++) {
      const tUs = i * dtContinuousUs;
      const analogV = evalAnalog(tUs);

      // Check if an ADC conversion completed near this time
      let sampleHere: number | null = null;
      let rawCodeHere: number | null = null;

      if (sampleIdx < samples.length && samples[sampleIdx].timeUs <= tUs) {
        sampleHere = samples[sampleIdx].quantVolts;
        rawCodeHere = samples[sampleIdx].rawSample;
        lastQuantVolts = samples[sampleIdx].quantVolts;
        lastRawCode = samples[sampleIdx].rawSample;
        sampleIdx++;
      }

      data.push({
        timeUs: parseFloat(tUs.toFixed(1)),
        timeMs: parseFloat((tUs / 1000).toFixed(3)),
        analogVoltage: parseFloat(analogV.toFixed(3)),
        sampledPoint: sampleHere !== null ? parseFloat(sampleHere.toFixed(3)) : null,
        quantizedStaircase: parseFloat(lastQuantVolts.toFixed(3)),
        rawAdcValue: rawCodeHere,
        errorMv: parseFloat(((analogV - lastQuantVolts) * 1000).toFixed(1))
      });
    }

    return data;
  }, [adcCalculations, signalFreq, signalType, signalOffset, signalAmplitude, signalNoise, adcVref]);

  // ----------------------------------------------------
  // Calculations: Loopback RC Filtered PWM into ADC
  // ----------------------------------------------------
  const loopbackChartData = useMemo(() => {
    const { periodUs, effectiveDuty } = pwmCalculations;
    const { samplingRateSps, maxCode } = adcCalculations;
    const simTimeUs = periodUs * 4;
    const points = 160;
    const dt = simTimeUs / points;

    // RC low-pass filter: y[k] = y[k-1] + alpha * (x[k] - y[k-1])
    // alpha = dt / (RC + dt), where RC = 1 / (2*pi*fc)
    const fcHz = rcCutoffKHz * 1000;
    const rcSec = 1 / (2 * Math.PI * fcHz);
    const rcUs = rcSec * 1000000;
    const alpha = dt / (rcUs + dt);

    const data: Array<{
      timeUs: number;
      pwmVoltage: number;
      filteredAnalog: number;
      adcReconstructed: number;
    }> = [];

    let currentFiltered = 2.5;
    const sampleIntervalUs = (1 / samplingRateSps) * 1000000;
    let nextSampleTime = 0;
    let lastSampledVolts = 2.5;

    for (let i = 0; i <= points; i++) {
      const t = i * dt;
      const timeInCycle = t % periodUs;
      const isHigh = (timeInCycle / periodUs) * 100 < effectiveDuty;
      const pwmV = isHigh ? 5.0 : 0.0;

      currentFiltered = currentFiltered + alpha * (pwmV - currentFiltered);

      if (t >= nextSampleTime) {
        const rawCode = Math.min(maxCode, Math.max(0, Math.round((currentFiltered / adcVref) * maxCode)));
        lastSampledVolts = (rawCode / maxCode) * adcVref;
        nextSampleTime += sampleIntervalUs;
      }

      data.push({
        timeUs: parseFloat(t.toFixed(1)),
        pwmVoltage: pwmV,
        filteredAnalog: parseFloat(currentFiltered.toFixed(3)),
        adcReconstructed: parseFloat(lastSampledVolts.toFixed(3))
      });
    }

    return data;
  }, [pwmCalculations, adcCalculations, rcCutoffKHz, adcVref]);

  // ----------------------------------------------------
  // Presets
  // ----------------------------------------------------
  const applyPreset = (presetName: string) => {
    if (presetName === 'servo') {
      // 50Hz RC Servo PWM: Period = 20ms, 1.5ms neutral (7.5% duty)
      setActiveTab('pwm');
      setMcuFreq(16000000);
      setTimerPrescaler(8);
      setPwmMode('fast');
      setUseCustomTop(true);
      setCustomTopValue(39999); // 16MHz / (8 * 40000) = 50Hz
      setDutyCyclePct(7.5); // 1.5ms / 20ms = 7.5%
      setIsInverted(false);
      setCyclesToShow(2);
    } else if (presetName === 'audio_fast') {
      // 31.25 kHz Fast PWM Audio DAC
      setActiveTab('pwm');
      setMcuFreq(16000000);
      setTimerPrescaler(1);
      setPwmMode('fast');
      setUseCustomTop(false);
      setDutyCyclePct(50);
      setIsInverted(false);
      setCyclesToShow(4);
    } else if (presetName === 'arduino_analog_write') {
      // Arduino default analogWrite: Timer0 = 976Hz or Timer1/2 = 490Hz (Prescaler 64)
      setActiveTab('pwm');
      setMcuFreq(16000000);
      setTimerPrescaler(64);
      setPwmMode('phase_correct');
      setUseCustomTop(false);
      setDutyCyclePct(65);
      setIsInverted(false);
      setCyclesToShow(3);
    } else if (presetName === 'adc_standard_sensor') {
      // Standard 10-bit ADC: 125kHz ADC clock (Prescaler 128 at 16MHz)
      setActiveTab('adc');
      setMcuFreq(16000000);
      setAdcPrescaler(128);
      setAdcResolution(10);
      setAdcVref(5.0);
      setSignalType('sine');
      setSignalFreq(60); // 60Hz mains
      setSignalAmplitude(3.0);
      setSignalOffset(2.5);
      setSignalNoise(0.04);
    } else if (presetName === 'adc_high_speed') {
      // High Speed ADC: Prescaler 16 -> 1MHz ADC Clock (76.9 kSPS)
      setActiveTab('adc');
      setMcuFreq(16000000);
      setAdcPrescaler(16);
      setAdcResolution(8); // 8-bit recommended above 200kHz
      setAdcVref(5.0);
      setSignalType('sawtooth');
      setSignalFreq(2000); // 2kHz
      setSignalAmplitude(4.0);
      setSignalOffset(2.0);
      setSignalNoise(0.02);
    } else if (presetName === 'loopback_rc') {
      // PWM D/A Converter via RC filter
      setActiveTab('loopback');
      setMcuFreq(16000000);
      setTimerPrescaler(8);
      setPwmMode('fast');
      setDutyCyclePct(60);
      setRcCutoffKHz(1.0);
    }
  };

  // ----------------------------------------------------
  // Generated Bare-Metal C Code for the current state
  // ----------------------------------------------------
  const generatedCCode = useMemo(() => {
    const is640 = selectedMCU === 'atmega640';
    const is128 = selectedMCU === 'atmega128';
    const is328 = selectedMCU === 'atmega328p';

    const csBits = timerPrescaler === 1 ? 'CS00' :
      timerPrescaler === 8 ? 'CS01' :
      timerPrescaler === 64 ? '(1 << CS01) | (1 << CS00)' :
      timerPrescaler === 256 ? '(1 << CS02)' :
      '(1 << CS02) | (1 << CS00)';

    const adpsBits = adcPrescaler === 2 ? '(1 << ADPS0)' :
      adcPrescaler === 4 ? '(1 << ADPS1)' :
      adcPrescaler === 8 ? '(1 << ADPS1) | (1 << ADPS0)' :
      adcPrescaler === 16 ? '(1 << ADPS2)' :
      adcPrescaler === 32 ? '(1 << ADPS2) | (1 << ADPS0)' :
      adcPrescaler === 64 ? '(1 << ADPS2) | (1 << ADPS1)' :
      '(1 << ADPS2) | (1 << ADPS1) | (1 << ADPS0)';

    return `/* ====================================================================
 * ${currentProfile.fullName} (${currentProfile.name}) Peripheral Signal Setup
 * F_CPU: ${(mcuFreq / 1000000).toFixed(1)} MHz
 * Auto-generated by Interactive Peripheral Signal Visualizer
 * ==================================================================== */

#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/delay.h>

#define F_CPU ${mcuFreq}UL

/* --- 1. PWM Configuration (${selectedTimer.name}) ---
 * Output Pin: ${selectedTimer.pin}
 * Mode: ${pwmMode === 'fast' ? 'Fast PWM' : 'Phase Correct PWM'}
 * Target Frequency: ${pwmCalculations.freqHz < 1000 ? pwmCalculations.freqHz.toFixed(1) + ' Hz' : (pwmCalculations.freqHz / 1000).toFixed(2) + ' kHz'}
 * Target Duty: ${dutyCyclePct}% (OCR Value: ${pwmCalculations.ocrValue})
 */
void pwm_init(void) {
    // 1) Set PWM pin as OUTPUT
${is640 ? '    DDRB |= (1 << PB7); // Set OC0A pin as Output' :
  is128 ? '    DDRB |= (1 << PB4); // Set OC0 pin as Output' :
  '    DDRD |= (1 << PD6); // Set OC0A (D6) pin as Output'}

    // 2) Configure Compare Output Mode and Waveform Generation Mode
${pwmMode === 'fast'
  ? `    TCCR0A = (1 << COM0A1) | (1 << WGM01) | (1 << WGM00); // Fast PWM, Non-inverting`
  : `    TCCR0A = (1 << COM0A1) | (1 << WGM00); // Phase Correct PWM`}

    // 3) Set Prescaler (${timerPrescaler})
    TCCR0B = ${csBits};

    // 4) Load Compare Register Value for ${dutyCyclePct}% Duty
    OCR0A = ${Math.min(255, pwmCalculations.ocrValue)};
}

/* --- 2. ADC Configuration ---
 * Clock Prescaler: ${adcPrescaler} -> ADC Clock: ${adcCalculations.fAdcKHz.toFixed(1)} kHz
 * Resolution: ${adcResolution}-bit (${adcResolution === 10 ? '0 ~ 1023' : '8-bit left-adjusted 0 ~ 255'})
 * Sample Rate: ~${Math.round(adcCalculations.samplingRateSps)} SPS (${adcCalculations.convTimeUs.toFixed(1)} µs per conversion)
 */
void adc_init(void) {
    // Select VREF (AVCC with external capacitor) & Channel ADC0
    ADMUX = (1 << REFS0)${adcResolution === 8 ? ' | (1 << ADLAR)' : ''};

    // ADCSRA: Enable ADC, Set Clock Prescaler (${adcPrescaler})
    ADCSRA = (1 << ADEN) | ${adpsBits};
}

uint16_t adc_read(uint8_t channel) {
    // Mask and select channel (0-7 on 128/328, 0-15 on 640)
    ADMUX = (ADMUX & 0xF0) | (channel & 0x0F);

    // Start single conversion
    ADCSRA |= (1 << ADSC);

    // Wait for conversion completion (ADIF flag or ADSC cleared)
    while (ADCSRA & (1 << ADSC));

    // Return 10-bit result
    return ADC;
}

int main(void) {
    pwm_init();
    adc_init();

    while (1) {
        // Read analog voltage from Channel 0
        uint16_t sensor_val = adc_read(0);

        // Adjust PWM duty dynamically based on ADC input (0-1023 -> 0-255)
        OCR0A = (uint8_t)(sensor_val >> 2);

        _delay_ms(10);
    }
    return 0;
}
`;
  }, [selectedMCU, currentProfile, mcuFreq, selectedTimer, pwmMode, timerPrescaler, dutyCyclePct, pwmCalculations, adcPrescaler, adcCalculations, adcResolution]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleDownloadCode = () => {
    const blob = new Blob([generatedCCode], { type: 'text/x-c;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedMCU}_peripheral_signals.c`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Component Title & Quick Context */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Activity className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Interactive Peripheral Signal Visualizer
            </h3>
            <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-amber-500/20">
              Recharts Oscilloscope
            </span>
          </div>
          <p className="text-xs text-slate-400">
            선택된 <strong className="text-slate-200">{currentProfile.name}</strong>의 주파수 및 클록 분주비 설정을 기반으로 <strong>PWM 펄스폭 변조 출력 파형</strong>과 <strong>10비트 ADC 신호 샘플링 & 양자화 계단파</strong>를 실시간 인터랙티브 시뮬레이션합니다.
          </p>
        </div>

        {/* Global MCU Clock Frequency Setting */}
        <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <Cpu className="w-4 h-4 text-amber-400" />
            <span className="font-semibold">MCU 클록 (F_CPU):</span>
          </div>
          <select
            value={mcuFreq}
            onChange={(e) => setMcuFreq(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-amber-400 px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {CLOCK_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Preset Quick Actions */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-amber-400" /> 신속 프리셋:
        </span>
        <button
          onClick={() => applyPreset('servo')}
          className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition text-[11px]"
        >
          50Hz RC 서보 모터
        </button>
        <button
          onClick={() => applyPreset('arduino_analog_write')}
          className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition text-[11px]"
        >
          490Hz 아두이노 PWM
        </button>
        <button
          onClick={() => applyPreset('audio_fast')}
          className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition text-[11px]"
        >
          31.25kHz 오디오 고속 PWM
        </button>
        <button
          onClick={() => applyPreset('adc_standard_sensor')}
          className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition text-[11px]"
        >
          60Hz 사인파 10비트 ADC
        </button>
        <button
          onClick={() => applyPreset('adc_high_speed')}
          className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition text-[11px]"
        >
          1MHz 고속 ADC (8-bit)
        </button>
        <button
          onClick={() => applyPreset('loopback_rc')}
          className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition text-[11px]"
        >
          PWM RC 필터 D/A 루프백
        </button>
      </div>

      {/* Main Tab Segmented Controller */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('pwm')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'pwm'
              ? 'border-amber-400 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>PWM 펄스폭 변조 오실로스코프</span>
        </button>

        <button
          onClick={() => setActiveTab('adc')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'adc'
              ? 'border-amber-400 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Waves className="w-4 h-4" />
          <span>ADC 신호 샘플링 & 양자화 시각화</span>
        </button>

        <button
          onClick={() => setActiveTab('loopback')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'loopback'
              ? 'border-amber-400 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>폐루프 RC 필터 D/A & ADC 계측</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: PWM SIGNAL VISUALIZER
         ========================================================================= */}
      {activeTab === 'pwm' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            {/* Timer & Pin Selector */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                하드웨어 타이머 & 출력 핀
              </label>
              <select
                value={selectedTimerId}
                onChange={(e) => setSelectedTimerId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:ring-1 focus:ring-amber-500"
              >
                {timerOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} - {t.pin}
                  </option>
                ))}
              </select>
            </div>

            {/* PWM Mode */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                PWM 동작 모드
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-0.5 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setPwmMode('fast')}
                  className={`text-xs py-1 rounded font-medium transition ${
                    pwmMode === 'fast'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Fast PWM
                </button>
                <button
                  type="button"
                  onClick={() => setPwmMode('phase_correct')}
                  className={`text-xs py-1 rounded font-medium transition ${
                    pwmMode === 'phase_correct'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Phase Correct
                </button>
              </div>
            </div>

            {/* Prescaler */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                타이머 분주비 (Prescaler N)
              </label>
              <select
                value={timerPrescaler}
                onChange={(e) => setTimerPrescaler(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-amber-400 font-mono focus:ring-1 focus:ring-amber-500"
              >
                {TIMER_PRESCALERS.map((ps) => (
                  <option key={ps} value={ps}>
                    ÷ {ps} ({((mcuFreq / ps) / 1000).toFixed(1)} kHz tick)
                  </option>
                ))}
              </select>
            </div>

            {/* Output Polarity */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                출력 극성 (COMxx) & 뷰 제어
              </label>
              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInverted}
                    onChange={(e) => setIsInverted(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
                  />
                  <span>반전 (Inverting)</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCounterRamp}
                    onChange={(e) => setShowCounterRamp(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
                  />
                  <span>카운터 램프 겹쳐보기</span>
                </label>
              </div>
            </div>
          </div>

          {/* Duty Cycle Interactive Slider & Realtime Metrics */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">
                    듀티 사이클 (Duty Cycle): <strong className="text-amber-400 font-mono text-base">{dutyCyclePct}%</strong>
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    (OCR 값: {pwmCalculations.ocrValue} / {pwmCalculations.topVal})
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  슬라이더를 조절하면 펄스의 High/Low 폭과 TCNT 비교 시점이 실시간 갱신됩니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">표시 주기 수:</span>
                {[1, 2, 3, 5].map((cnt) => (
                  <button
                    key={cnt}
                    onClick={() => setCyclesToShow(cnt)}
                    className={`px-2 py-0.5 text-xs font-mono rounded ${
                      cyclesToShow === cnt
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {cnt}T
                  </button>
                ))}
              </div>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={dutyCyclePct}
              onChange={(e) => setDutyCyclePct(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />

            {/* Key Calculated Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">PWM 주파수 (f_PWM)</span>
                <span className="text-sm sm:text-base font-mono font-bold text-amber-400">
                  {pwmCalculations.freqHz >= 1000
                    ? `${(pwmCalculations.freqHz / 1000).toFixed(3)} kHz`
                    : `${pwmCalculations.freqHz.toFixed(1)} Hz`}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                  {pwmMode === 'fast' ? 'f_clk / [N·(TOP+1)]' : 'f_clk / [2·N·TOP]'}
                </span>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">펄스 주기 (Period T)</span>
                <span className="text-sm sm:text-base font-mono font-bold text-white">
                  {pwmCalculations.periodUs >= 1000
                    ? `${pwmCalculations.periodMs.toFixed(3)} ms`
                    : `${pwmCalculations.periodUs.toFixed(2)} µs`}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                  1 주기 시간
                </span>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">High 시간 (t_HIGH)</span>
                <span className="text-sm sm:text-base font-mono font-bold text-emerald-400">
                  {pwmCalculations.tHighUs >= 1000
                    ? `${(pwmCalculations.tHighUs / 1000).toFixed(3)} ms`
                    : `${pwmCalculations.tHighUs.toFixed(2)} µs`}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                  {isInverted ? '반전 Low 구간' : '5V 인가 시간'}
                </span>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Low 시간 (t_LOW)</span>
                <span className="text-sm sm:text-base font-mono font-bold text-slate-300">
                  {pwmCalculations.tLowUs >= 1000
                    ? `${(pwmCalculations.tLowUs / 1000).toFixed(3)} ms`
                    : `${pwmCalculations.tLowUs.toFixed(2)} µs`}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                  0V 그라운드 시간
                </span>
              </div>
            </div>
          </div>

          {/* Recharts Oscilloscope Display */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 shadow-inner">
            <div className="flex items-center justify-between mb-3 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-slate-300 font-semibold">
                  채널 1 (CH1): {selectedTimer.pin} PWM 출력 파형
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                <span>시간 축: µs</span>
                <span>전압 축: 0 ~ 5.0 V</span>
              </div>
            </div>

            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={pwmChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="timeUs"
                    stroke="#64748b"
                    fontSize={11}
                    tickFormatter={(val) => `${val}µs`}
                    label={{ value: '경과 시간 (µs)', position: 'insideBottom', offset: -12, fill: '#64748b', fontSize: 11 }}
                  />
                  <YAxis
                    domain={[-0.2, 5.5]}
                    stroke="#64748b"
                    fontSize={11}
                    ticks={[0, 1.0, 2.5, 3.3, 5.0]}
                    tickFormatter={(val) => `${val}V`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    labelFormatter={(label) => `시각: ${label} µs`}
                    formatter={(value: any, name: any) => {
                      if (name === 'PWM 출력 전압 (CH1)') return [`${value} V`, '출력 핀 전압'];
                      if (name === 'TCNT 카운터 램프 (0-5V 스케일)') return [`${value} V`, 'TCNT 값 (스케일)'];
                      if (name === 'OCR 비교 기준 레벨') return [`${value} V`, 'OCR 비교 임계값'];
                      return [value, name];
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={32}
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                  />

                  {/* Counter Ramp (Sawtooth or Triangle) */}
                  {showCounterRamp && (
                    <Line
                      type="monotone"
                      dataKey="counterLevel"
                      name="TCNT 카운터 램프 (0-5V 스케일)"
                      stroke="#6366f1"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}

                  {/* OCR Compare Threshold line */}
                  {showCounterRamp && (
                    <ReferenceLine
                      y={((pwmCalculations.ocrValue / pwmCalculations.topVal) * 5.0)}
                      stroke="#f59e0b"
                      strokeDasharray="3 3"
                      label={{ value: `OCR = ${pwmCalculations.ocrValue}`, fill: '#f59e0b', fontSize: 10, position: 'right' }}
                    />
                  )}

                  {/* Main Digital Waveform */}
                  <Area
                    type="stepAfter"
                    dataKey="voltage"
                    name="PWM 출력 전압 (CH1)"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="#10b981"
                    fillOpacity={0.15}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-900 font-mono">
              <span>수평 분주 (Timebase): 1 눈금 ≈ {(pwmCalculations.periodUs / 4).toFixed(1)} µs</span>
              <span>수직 스케일: 1.0 V / div (TTL High: 5.0V, Low: 0.0V)</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: ADC SIGNAL SAMPLING & QUANTIZATION VISUALIZER
         ========================================================================= */}
      {activeTab === 'adc' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            {/* ADC Prescaler */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                ADC 클록 분주비 (ADPS2:0)
              </label>
              <select
                value={adcPrescaler}
                onChange={(e) => setAdcPrescaler(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-amber-400 font-mono focus:ring-1 focus:ring-amber-500"
              >
                {ADC_PRESCALERS.map((ps) => {
                  const fKHz = (mcuFreq / ps) / 1000;
                  return (
                    <option key={ps} value={ps}>
                      ÷ {ps} ({fKHz.toFixed(1)} kHz ADC Clock)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* ADC Reference Voltage */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                기준 전압 (VREF 선택)
              </label>
              <select
                value={adcVref}
                onChange={(e) => setAdcVref(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:ring-1 focus:ring-amber-500"
              >
                <option value={5.0}>AVCC (5.0V 기본)</option>
                <option value={3.3}>AREF 외장 3.3V</option>
                {selectedMCU === 'atmega128' && <option value={2.56}>내부 2.56V VREF</option>}
                {selectedMCU === 'atmega640' && <option value={2.56}>내부 2.56V VREF</option>}
                {selectedMCU === 'atmega640' && <option value={1.1}>내부 1.1V VREF</option>}
                {selectedMCU === 'atmega328p' && <option value={1.1}>내부 1.1V Bandgap VREF</option>}
              </select>
            </div>

            {/* Resolution */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                해상도 (Resolution)
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-0.5 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setAdcResolution(10)}
                  className={`text-xs py-1 rounded font-medium transition ${
                    adcResolution === 10
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  10-bit (0-1023)
                </button>
                <button
                  type="button"
                  onClick={() => setAdcResolution(8)}
                  className={`text-xs py-1 rounded font-medium transition ${
                    adcResolution === 8
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  8-bit (ADLAR)
                </button>
              </div>
            </div>

            {/* Input Signal Waveform */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                입력 아날로그 신호 형태
              </label>
              <select
                value={signalType}
                onChange={(e) => setSignalType(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:ring-1 focus:ring-amber-500"
              >
                <option value="sine">정현파 (Sine Wave)</option>
                <option value="triangle">삼각파 (Triangle Wave)</option>
                <option value="sawtooth">톱니파 (Sawtooth Wave)</option>
                <option value="dc">고정 DC 직류 전압 (가변저항)</option>
              </select>
            </div>
          </div>

          {/* Analog Signal Parameters Controls */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">신호 주파수 (Frequency):</span>
                  <span className="font-mono font-bold text-amber-400">{signalFreq} Hz</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={1000}
                  step={10}
                  value={signalFreq}
                  onChange={(e) => setSignalFreq(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">신호 진폭 (Vpp):</span>
                  <span className="font-mono font-bold text-cyan-400">{signalAmplitude.toFixed(1)} V</span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={adcVref}
                  step={0.1}
                  value={signalAmplitude}
                  onChange={(e) => setSignalAmplitude(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">DC 오프셋 (Offset):</span>
                  <span className="font-mono font-bold text-slate-300">{signalOffset.toFixed(2)} V</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={adcVref}
                  step={0.1}
                  value={signalOffset}
                  onChange={(e) => setSignalOffset(Number(e.target.value))}
                  className="w-full accent-slate-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>
            </div>

            {/* ADC Hardware Warnings & Diagnostic */}
            <div className="pt-2">
              {adcCalculations.isOptimalClock ? (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
                  <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>
                    <strong>적정 ADC 클록 속도:</strong> 현재 ADC 클록은 <strong>{adcCalculations.fAdcKHz.toFixed(1)} kHz</strong>로, AVR 데이터시트의 10비트 고분해능 권장 범위(50 kHz ~ 200 kHz)를 완벽하게 충족합니다.
                  </span>
                </div>
              ) : adcCalculations.isClockTooFast ? (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    <strong>고속 클록 주의:</strong> 현재 ADC 클록이 <strong>{adcCalculations.fAdcKHz.toFixed(1)} kHz</strong>로 권장(200 kHz)을 초과했습니다. 변환 속도는 빠르지만 유효 분해능(ENOB)이 저하될 수 있으므로 8비트 모드 사용을 권장합니다.
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center gap-2 text-xs text-indigo-300">
                  <Info className="w-4 h-4 shrink-0 text-indigo-400" />
                  <span>
                    <strong>저속 클록 알림:</strong> 현재 ADC 클록이 <strong>{adcCalculations.fAdcKHz.toFixed(1)} kHz</strong>로 50 kHz 미만입니다. 내부 샘플&홀드 커패시터 누설 전류로 인한 오차가 발생할 수 있습니다.
                  </span>
                </div>
              )}
            </div>

            {/* Key ADC Performance Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">ADC 클록 주파수</span>
                <span className="text-sm sm:text-base font-mono font-bold text-amber-400">
                  {adcCalculations.fAdcKHz.toFixed(1)} kHz
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                  F_CPU ÷ {adcPrescaler}
                </span>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">단일 변환 시간 (t_conv)</span>
                <span className="text-sm sm:text-base font-mono font-bold text-white">
                  {adcCalculations.convTimeUs.toFixed(1)} µs
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                  13 클록 사이클 소요
                </span>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">샘플링 속도 (Rate)</span>
                <span className="text-sm sm:text-base font-mono font-bold text-emerald-400">
                  {adcCalculations.samplingRateSps >= 1000
                    ? `${(adcCalculations.samplingRateSps / 1000).toFixed(2)} kSPS`
                    : `${Math.round(adcCalculations.samplingRateSps)} SPS`}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                  최대 초당 샘플 수
                </span>
              </div>

              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">1 LSB 전압 해상도</span>
                <span className="text-sm sm:text-base font-mono font-bold text-cyan-400">
                  {adcCalculations.lsbMilliVolts.toFixed(2)} mV
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                  VREF / {adcCalculations.maxCode + 1}
                </span>
              </div>
            </div>
          </div>

          {/* Recharts ADC Waveform Display */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 shadow-inner">
            <div className="flex items-center justify-between mb-3 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-mono text-slate-300 font-semibold">
                  CH2: 입력 아날로그 신호 (보라) vs ADC 디지털 양자화 계단파 (주황 계단 & 녹색 샘플링 스트로브)
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                <span>VREF: {adcVref.toFixed(1)}V</span>
                <span>LSB: {adcCalculations.lsbMilliVolts.toFixed(1)}mV</span>
              </div>
            </div>

            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={adcChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="timeMs"
                    stroke="#64748b"
                    fontSize={11}
                    tickFormatter={(val) => `${val}ms`}
                    label={{ value: '경과 시간 (ms)', position: 'insideBottom', offset: -12, fill: '#64748b', fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, Math.ceil(adcVref + 0.2)]}
                    stroke="#64748b"
                    fontSize={11}
                    tickFormatter={(val) => `${val}V`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    labelFormatter={(label) => `시각: ${label} ms`}
                    formatter={(value: any, name: any, item: any) => {
                      if (name === '아날로그 연속 입력 신호') return [`${value} V`, name];
                      if (name === 'ADC 복원 계단파 (Quantized)') return [`${value} V`, name];
                      if (name === 'ADC 샘플 스트로브') {
                        const raw = item?.payload?.rawAdcValue;
                        return [`${value} V (Code: ${raw ?? '-'})`, '샘플링 변환값'];
                      }
                      return [value, name];
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={32}
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                  />

                  {/* VREF reference line */}
                  <ReferenceLine
                    y={adcVref}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{ value: `VREF = ${adcVref}V`, fill: '#ef4444', fontSize: 10, position: 'right' }}
                  />

                  {/* Continuous Analog Input wave */}
                  <Line
                    type="monotone"
                    dataKey="analogVoltage"
                    name="아날로그 연속 입력 신호"
                    stroke="#818cf8"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />

                  {/* Quantized reconstructed staircase */}
                  <Line
                    type="stepAfter"
                    dataKey="quantizedStaircase"
                    name="ADC 복원 계단파 (Quantized)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />

                  {/* Sample strobe points */}
                  <Line
                    type="linear"
                    dataKey="sampledPoint"
                    name="ADC 샘플 스트로브"
                    stroke="#10b981"
                    strokeWidth={0}
                    dot={{ r: 4, fill: '#10b981', stroke: '#0f172a', strokeWidth: 1.5 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-900 font-mono">
              <span>샘플링 간격: {(1000000 / adcCalculations.samplingRateSps).toFixed(1)} µs 마다 녹색 점 샘플링</span>
              <span>양자화 오차: 최대 ±{(adcCalculations.lsbMilliVolts / 2).toFixed(2)} mV</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: CLOSED-LOOP RC FILTER & ADC LOOPBACK
         ========================================================================= */}
      {activeTab === 'loopback' && (
        <div className="space-y-6">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-400" />
                  PWM 기반 저가형 D/A 변환기 및 ADC 루프백 검증
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  PWM 구형파 출력을 RC 1차 저역통과 필터(Low-Pass Filter)로 평활화하여 아날로그 직류 전압을 생성한 뒤, MCU의 ADC 채널로 재측정하는 하드웨어 회로 시뮬레이션입니다.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800 text-xs font-mono">
                <span className="text-slate-400">이론적 평균 DC:</span>
                <span className="font-bold text-amber-400">
                  {((5.0 * pwmCalculations.effectiveDuty) / 100).toFixed(2)} V
                </span>
              </div>
            </div>

            {/* RC Cutoff Control */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">RC 필터 차단 주파수 (Cutoff fc):</span>
                  <span className="font-mono font-bold text-emerald-400">{rcCutoffKHz.toFixed(2)} kHz</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={5.0}
                  step={0.1}
                  value={rcCutoffKHz}
                  onChange={(e) => setRcCutoffKHz(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  차단 주파수가 낮을수록 리플(Ripple)이 줄어들지만 정착 시간(Settling Time)이 길어집니다.
                </span>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">입력 PWM 듀티비 (Duty):</span>
                  <span className="font-mono font-bold text-amber-400">{dutyCyclePct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={dutyCyclePct}
                  onChange={(e) => setDutyCyclePct(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Loopback Recharts Display */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 shadow-inner">
            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={loopbackChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="timeUs"
                    stroke="#64748b"
                    fontSize={11}
                    tickFormatter={(val) => `${val}µs`}
                    label={{ value: '경과 시간 (µs)', position: 'insideBottom', offset: -12, fill: '#64748b', fontSize: 11 }}
                  />
                  <YAxis
                    domain={[-0.2, 5.5]}
                    stroke="#64748b"
                    fontSize={11}
                    ticks={[0, 1.25, 2.5, 3.75, 5.0]}
                    tickFormatter={(val) => `${val}V`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    labelFormatter={(label) => `시각: ${label} µs`}
                  />
                  <Legend
                    verticalAlign="top"
                    height={32}
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                  />

                  {/* Raw PWM Pulse */}
                  <Area
                    type="stepAfter"
                    dataKey="pwmVoltage"
                    name="1. PWM 출력 핀 신호 (0/5V)"
                    stroke="#64748b"
                    strokeWidth={1}
                    fill="#64748b"
                    fillOpacity={0.1}
                    isAnimationActive={false}
                  />

                  {/* Filtered Analog DC curve */}
                  <Line
                    type="monotone"
                    dataKey="filteredAnalog"
                    name="2. RC 필터 통과 아날로그 전압"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />

                  {/* ADC Reconstructed Samples */}
                  <Line
                    type="stepAfter"
                    dataKey="adcReconstructed"
                    name="3. ADC 복원 디지털 측정값"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-900 font-mono">
              <span>PWM 주파수: {pwmCalculations.freqHz >= 1000 ? (pwmCalculations.freqHz / 1000).toFixed(2) + ' kHz' : pwmCalculations.freqHz.toFixed(0) + ' Hz'}</span>
              <span>RC 시정수 τ = {(1000 / (2 * Math.PI * rcCutoffKHz)).toFixed(1)} µs</span>
            </div>
          </div>
        </div>
      )}

      {/* Generated AVR-GCC C Code Snippet Box */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white font-mono">
              {currentProfile.name}_peripheral_setup.c (AVR-GCC 초기화 코드)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">복사 완료!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>코드 복사</span>
                </>
              )}
            </button>
            <button
              onClick={handleDownloadCode}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>C 파일 저장</span>
            </button>
          </div>
        </div>
        <pre className="p-4 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-60 bg-slate-950/90">
          {generatedCCode}
        </pre>
      </div>
    </div>
  );
};
