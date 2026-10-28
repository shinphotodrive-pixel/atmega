import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Cpu,
  Activity,
  Sliders,
  Zap,
  Clock,
  Radio,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  Waves,
  Gauge,
  FileCode2,
  Terminal,
  ArrowRight,
  TrendingUp,
  Percent
} from 'lucide-react';
import confetti from 'canvas-confetti';

export interface RegisterLogicSimulatorProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type HardwareBlockType = 'timer0' | 'adc' | 'usart' | 'watchdog';

export const RegisterLogicSimulator: React.FC<RegisterLogicSimulatorProps> = ({
  selectedMCU,
  onSelectMCU
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Active Hardware Block Tab
  const [activeBlock, setActiveBlock] = useState<HardwareBlockType>('timer0');

  // System CPU Clock
  const [cpuFreqHz, setCpuFreqHz] = useState<number>(16000000); // 16MHz default

  // -------------------------------------------------------------
  // 1. Timer0 Registers State (TCCR0A, TCCR0B, OCR0A, OCR0B)
  // -------------------------------------------------------------
  const [tccr0a, setTccr0a] = useState<number>(0b10000011); // Fast PWM Non-inverting Mode 3
  const [tccr0b, setTccr0b] = useState<number>(0b00000011); // Prescaler 64
  const [ocr0a, setOcr0a] = useState<number>(128); // 50% Duty
  const [ocr0b, setOcr0b] = useState<number>(64);  // 25% Duty

  // -------------------------------------------------------------
  // 2. ADC Registers State (ADCSRA, ADMUX, ADCSRB)
  // -------------------------------------------------------------
  const [adcsra, setAdcsra] = useState<number>(0b10000111); // ADEN=1, ADPS=7 (/128)
  const [admux, setAdmux] = useState<number>(0b01000000);   // REFS=01 (AVCC), MUX=0000 (ADC0)
  const [adcsrb, setAdcsrb] = useState<number>(0b00000000); // Free Running mode

  // -------------------------------------------------------------
  // 3. USART0 Registers State (UBRR0, UCSR0A, UCSR0B, UCSR0C)
  // -------------------------------------------------------------
  const [ubrr0, setUbrr0] = useState<number>(16);           // 16MHz / (16 * (16+1)) = 58823 -> for 115200: UBRR=8 with U2X or UBRR=16 at 8MHz
  const [ucsr0a, setUcsr0a] = useState<number>(0b00000010); // U2X0 = 1 (Double Speed)
  const [ucsr0b, setUcsr0b] = useState<number>(0b00011000); // RXEN=1, TXEN=1
  const [ucsr0c, setUcsr0c] = useState<number>(0b00000110); // 8N1 (UCSZ=3, 8-bit, 1 stop, no parity)
  const [targetBaud, setTargetBaud] = useState<number>(115200);

  // -------------------------------------------------------------
  // 4. Watchdog Timer Registers State (WDTCSR)
  // -------------------------------------------------------------
  const [wdtcsr, setWdtcsr] = useState<number>(0b00001111); // WDE=1, WDP=7 (2.0s)

  // Copy code feedback
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Helper to toggle a bit in a register
  const toggleBit = (currentVal: number, bitIndex: number, setter: (val: number) => void) => {
    const mask = 1 << bitIndex;
    setter(currentVal ^ mask);
  };

  // -------------------------------------------------------------
  // Real-Time Hardware Calculation Engine: Timer0
  // -------------------------------------------------------------
  const timerCalculations = useMemo(() => {
    // Prescaler CS02:00
    const cs = tccr0b & 0x07;
    let prescaler = 0;
    let prescalerLabel = '타이머 정지 (No Clock)';
    if (cs === 1) { prescaler = 1; prescalerLabel = '1 분주 (직접 공급)'; }
    else if (cs === 2) { prescaler = 8; prescalerLabel = '8 분주'; }
    else if (cs === 3) { prescaler = 64; prescalerLabel = '64 분주'; }
    else if (cs === 4) { prescaler = 256; prescalerLabel = '256 분주'; }
    else if (cs === 5) { prescaler = 1024; prescalerLabel = '1024 분주'; }
    else if (cs === 6) { prescaler = 1; prescalerLabel = '외부 T0 핀 하강 엣지'; }
    else if (cs === 7) { prescaler = 1; prescalerLabel = '외부 T0 핀 상승 엣지'; }

    // WGM Mode: WGM02(TCCR0B.3), WGM01(TCCR0A.1), WGM00(TCCR0A.0)
    const wgm = ((tccr0b & (1 << 3)) ? 4 : 0) | (tccr0a & 0x03);
    let modeName = 'Normal';
    let topVal = 255;
    let isPwm = false;
    let isPhaseCorrect = false;

    if (wgm === 0) {
      modeName = 'Normal 카운터 (0x00 ~ 0xFF)';
      topVal = 255;
    } else if (wgm === 1) {
      modeName = 'PWM, Phase Correct (TOP=0xFF)';
      topVal = 255;
      isPwm = true;
      isPhaseCorrect = true;
    } else if (wgm === 2) {
      modeName = 'CTC (TOP=OCR0A)';
      topVal = Math.max(1, ocr0a);
    } else if (wgm === 3) {
      modeName = 'Fast PWM (TOP=0xFF)';
      topVal = 255;
      isPwm = true;
    } else if (wgm === 5) {
      modeName = 'PWM, Phase Correct (TOP=OCR0A)';
      topVal = Math.max(1, ocr0a);
      isPwm = true;
      isPhaseCorrect = true;
    } else if (wgm === 7) {
      modeName = 'Fast PWM (TOP=OCR0A)';
      topVal = Math.max(1, ocr0a);
      isPwm = true;
    }

    // COM0A1:0 Output Mode
    const com0a = (tccr0a >> 6) & 0x03;
    let com0aLabel = 'OC0A 핀 분리 (일반 GPIO)';
    if (com0a === 1) {
      com0aLabel = isPwm ? 'WGM 설정에 따라 토글/예약' : '비교 일치 시 OC0A 핀 토글(Toggle)';
    } else if (com0a === 2) {
      com0aLabel = isPwm ? '비반전 PWM (Clear on Compare, Set at BOTTOM)' : '비교 일치 시 OC0A 0V(LOW)';
    } else if (com0a === 3) {
      com0aLabel = isPwm ? '반전 PWM (Set on Compare, Clear at BOTTOM)' : '비교 일치 시 OC0A 5V(HIGH)';
    }

    // Frequencies
    const timerClockHz = prescaler > 0 ? cpuFreqHz / prescaler : 0;
    const tickTimeUs = timerClockHz > 0 ? (1 / timerClockHz) * 1000000 : 0;

    let pwmFreqHz = 0;
    if (prescaler > 0) {
      if (isPhaseCorrect) {
        pwmFreqHz = cpuFreqHz / (2 * prescaler * topVal);
      } else if (wgm === 2) {
        // CTC mode toggle frequency
        pwmFreqHz = cpuFreqHz / (2 * prescaler * (1 + topVal));
      } else {
        // Fast PWM
        pwmFreqHz = cpuFreqHz / (prescaler * (1 + topVal));
      }
    }

    // Duty Cycles
    let dutyPctA = 0;
    if (isPwm && topVal > 0) {
      if (com0a === 2) {
        dutyPctA = (ocr0a / topVal) * 100;
      } else if (com0a === 3) {
        dutyPctA = ((topVal - ocr0a) / topVal) * 100;
      } else {
        dutyPctA = 0;
      }
    }
    dutyPctA = Math.max(0, Math.min(100, dutyPctA));

    // Overflow Period
    const ovfPeriodMs = timerClockHz > 0 ? ((topVal + 1) / timerClockHz) * 1000 : 0;

    return {
      prescaler,
      prescalerLabel,
      modeName,
      topVal,
      isPwm,
      com0a,
      com0aLabel,
      timerClockHz,
      tickTimeUs,
      pwmFreqHz,
      dutyPctA,
      ovfPeriodMs
    };
  }, [cpuFreqHz, tccr0a, tccr0b, ocr0a]);

  // -------------------------------------------------------------
  // Real-Time Hardware Calculation Engine: ADC Converter
  // -------------------------------------------------------------
  const adcCalculations = useMemo(() => {
    const isEnabled = (adcsra & (1 << 7)) !== 0;
    const isAutoTrigger = (adcsra & (1 << 5)) !== 0;
    const isInterrupt = (adcsra & (1 << 3)) !== 0;

    // Prescaler ADPS2:0
    const adps = adcsra & 0x07;
    const prescalers = [2, 2, 4, 8, 16, 32, 64, 128];
    const prescalerVal = prescalers[adps];

    // ADC Clock
    const adcClockHz = isEnabled ? cpuFreqHz / prescalerVal : 0;
    const adcClockKhz = adcClockHz / 1000;

    // Spec compliance check: Microchip AVR datasheet dictates 50kHz ~ 200kHz for max 10-bit resolution
    let specStatus: 'optimal' | 'low' | 'high' | 'critical' = 'optimal';
    let specMessage = '';

    if (!isEnabled) {
      specStatus = 'low';
      specMessage = 'ADC 회로가 비활성화(ADEN=0)되어 전력이 차단된 절전 상태입니다.';
    } else if (adcClockKhz < 50) {
      specStatus = 'low';
      specMessage = `주의: ADC 클럭(${adcClockKhz.toFixed(1)}kHz)이 50kHz 미만입니다. 내부 샘플앤홀드 커패시터 누설 전류로 정밀도가 저하됩니다.`;
    } else if (adcClockKhz > 1000) {
      specStatus = 'critical';
      specMessage = `위험: ADC 클럭(${adcClockKhz.toFixed(1)}kHz)이 1MHz 절대 한계를 초과하여 아날로그 비교기 세틀링이 불가능합니다.`;
    } else if (adcClockKhz > 200) {
      specStatus = 'high';
      specMessage = `경고: 클럭(${adcClockKhz.toFixed(1)}kHz)이 200kHz를 초과하여 변환 속도는 빠르나 LSB 오차(DNL/INL)가 증가해 8-bit 유효 해상도로 동작합니다.`;
    } else {
      specStatus = 'optimal';
      specMessage = `최적 동작: ADC 클럭(${adcClockKhz.toFixed(1)}kHz)이 데이터시트 권장 50~200kHz 범위에 있어 최고 10-bit 정밀도(ENOB ~9.8bit)를 보장합니다.`;
    }

    // Conversion Times
    // Normal conversion: 13 ADC clock cycles
    // First conversion after enable: 25 ADC clock cycles
    const normalConversionUs = adcClockHz > 0 ? (13 / adcClockHz) * 1000000 : 0;
    const firstConversionUs = adcClockHz > 0 ? (25 / adcClockHz) * 1000000 : 0;
    const maxSps = normalConversionUs > 0 ? 1000000 / normalConversionUs : 0;

    // Voltage Reference
    const refs = (admux >> 6) & 0x03;
    let vrefVolts = 5.0;
    let vrefLabel = 'AVCC (5.0V 전원 전압)';
    if (refs === 0) {
      vrefVolts = 5.0; // External AREF
      vrefLabel = 'AREF 핀 외부 기준 전압';
    } else if (refs === 1) {
      vrefVolts = 5.0;
      vrefLabel = 'AVCC 핀 전원 (내부 필터링 커패시터 권장)';
    } else if (refs === 3 || refs === 2) {
      vrefVolts = 1.1; // Internal 1.1V for 328P/2560, or 2.56V for 128
      if (selectedMCU === 'atmega128') {
        vrefVolts = 2.56;
        vrefLabel = '내부 정밀 2.56V 밴드갭 기준 전압';
      } else {
        vrefVolts = 1.1;
        vrefLabel = '내부 정밀 1.1V 밴드갭 기준 전압 (미세 전압 전용)';
      }
    }

    const lsbMv = (vrefVolts / 1024) * 1000;

    return {
      isEnabled,
      isAutoTrigger,
      isInterrupt,
      prescalerVal,
      adcClockHz,
      adcClockKhz,
      specStatus,
      specMessage,
      normalConversionUs,
      firstConversionUs,
      maxSps,
      vrefVolts,
      vrefLabel,
      lsbMv
    };
  }, [cpuFreqHz, adcsra, admux, selectedMCU]);

  // -------------------------------------------------------------
  // Real-Time Hardware Calculation Engine: USART Serial
  // -------------------------------------------------------------
  const usartCalculations = useMemo(() => {
    const isU2x = (ucsr0a & (1 << 1)) !== 0; // U2X0
    const divisor = isU2x ? 8 : 16;
    const safeUbrr = Math.max(0, ubrr0);

    const actualBaud = cpuFreqHz / (divisor * (safeUbrr + 1));
    const baudErrorPct = targetBaud > 0 ? ((actualBaud - targetBaud) / targetBaud) * 100 : 0;
    const absError = Math.abs(baudErrorPct);

    let errorSeverity: 'safe' | 'warning' | 'fatal' = 'safe';
    let errorDesc = '';
    if (absError <= 1.5) {
      errorSeverity = 'safe';
      errorDesc = '✅ 통신 안전 범위: 비트 샘플링 중앙점(Center-sampling) 안정 확보';
    } else if (absError <= 2.5) {
      errorSeverity = 'warning';
      errorDesc = '⚠️ 주의: 프레임 후반 비트 마진 부족. 케이블 길이나 온도 변화 시 프레임 에러(FE) 가능성';
    } else {
      errorSeverity = 'fatal';
      errorDesc = '🚨 통신 불가 위험: 오차 2.5% 초과로 정지 비트(Stop Bit) 타이밍 엇갈림 발생';
    }

    const bitDurationUs = actualBaud > 0 ? (1 / actualBaud) * 1000000 : 0;
    // 10-bit frame (1 start + 8 data + 1 stop)
    const frameDurationUs = bitDurationUs * 10;
    const maxThroughputBytesSec = actualBaud > 0 ? actualBaud / 10 : 0;

    return {
      isU2x,
      divisor,
      safeUbrr,
      actualBaud,
      baudErrorPct,
      absError,
      errorSeverity,
      errorDesc,
      bitDurationUs,
      frameDurationUs,
      maxThroughputBytesSec
    };
  }, [cpuFreqHz, ubrr0, ucsr0a, targetBaud]);

  // -------------------------------------------------------------
  // Real-Time Hardware Calculation Engine: Watchdog Timer
  // -------------------------------------------------------------
  const wdtCalculations = useMemo(() => {
    const isWde = (wdtcsr & (1 << 3)) !== 0;
    const isWdie = (wdtcsr & (1 << 6)) !== 0;

    // Prescaler WDP3:0 -> WDP3 is bit 5, WDP2:0 are bits 2:0
    const wdp = ((wdtcsr & (1 << 5)) ? 8 : 0) | (wdtcsr & 0x07);

    // Timeout mappings based on 128kHz internal oscillator
    const timeoutMap: Record<number, { periodMs: number; label: string }> = {
      0: { periodMs: 16, label: '16 ms (약 2,048 사이클)' },
      1: { periodMs: 32, label: '32 ms (약 4,096 사이클)' },
      2: { periodMs: 64, label: '64 ms (약 8,192 사이클)' },
      3: { periodMs: 125, label: '125 ms (약 16,384 사이클)' },
      4: { periodMs: 250, label: '250 ms (약 32,768 사이클)' },
      5: { periodMs: 500, label: '500 ms (약 65,536 사이클)' },
      6: { periodMs: 1000, label: '1.0 초 (약 131,072 사이클)' },
      7: { periodMs: 2000, label: '2.0 초 (약 262,144 사이클)' },
      8: { periodMs: 4000, label: '4.0 초 (약 524,288 사이클)' },
      9: { periodMs: 8000, label: '8.0 초 (약 1,048,576 사이클)' }
    };

    const targetInfo = timeoutMap[wdp] || { periodMs: 2000, label: '2.0 초' };

    let modeDescription = '와치독 정지 (Disabled)';
    let modeSeverity: 'safe' | 'alert' | 'danger' = 'safe';

    if (isWdie && !isWde) {
      modeDescription = '인터럽트 모드 (WDT 인터럽트 발생 후 CPU 정상 유지 - 절전 웨이크업용)';
      modeSeverity = 'safe';
    } else if (!isWdie && isWde) {
      modeDescription = '시스템 리셋 모드 (타임아웃 시 하드웨어 강제 리셋 - 펌웨어 멈춤 복구)';
      modeSeverity = 'alert';
    } else if (isWdie && isWde) {
      modeDescription = '인터럽트 + 리셋 2단계 모드 (첫 타임아웃 시 데이터 백업 ISR ➔ 2회차 타임아웃 시 시스템 리셋)';
      modeSeverity = 'danger';
    }

    return {
      isWde,
      isWdie,
      wdp,
      periodMs: targetInfo.periodMs,
      periodLabel: targetInfo.label,
      modeDescription,
      modeSeverity
    };
  }, [wdtcsr]);

  // -------------------------------------------------------------
  // Presets Application
  // -------------------------------------------------------------
  const handleApplyPreset = (type: 'fast_pwm_1k' | 'ctc_audio' | 'adc_precision' | 'uart_115200' | 'wdt_safety') => {
    if (type === 'fast_pwm_1k') {
      setActiveBlock('timer0');
      setTccr0a(0b10000011); // Fast PWM Mode 3, Non-inverting
      setTccr0b(0b00000011); // Prescaler 64 -> ~976.56 Hz at 16MHz
      setOcr0a(128);         // 50% Duty
    } else if (type === 'ctc_audio') {
      setActiveBlock('timer0');
      setTccr0a(0b01000010); // CTC Mode 2, Toggle OC0A
      setTccr0b(0b00000011); // Prescaler 64
      setOcr0a(141);         // 16MHz / (2 * 64 * (1+141)) = 440.14 Hz (A4 音)
    } else if (type === 'adc_precision') {
      setActiveBlock('adc');
      setAdcsra(0b10000111); // ADEN=1, ADPS=7 (/128 -> 125kHz @ 16MHz)
      setAdmux(0b01000000);  // AVCC Ref
    } else if (type === 'uart_115200') {
      setActiveBlock('usart');
      setCpuFreqHz(16000000);
      setTargetBaud(115200);
      setUcsr0a(0b00000010); // U2X0 = 1
      setUbrr0(16);          // 16MHz / (8 * (16+1)) = 117647 bps -> or UBRR=16 for 115200 (error 2.1%) or 8 for 115200 at 8MHz
      setUcsr0b(0b00011000);
      setUcsr0c(0b00000110);
    } else if (type === 'wdt_safety') {
      setActiveBlock('watchdog');
      setWdtcsr(0b00001111); // 2.0s reset
    }

    confetti({
      particleCount: 30,
      spread: 50,
      origin: { y: 0.7 }
    });
  };

  // -------------------------------------------------------------
  // Dynamic C Code Snippet Generator
  // -------------------------------------------------------------
  const generatedCCode = useMemo(() => {
    if (activeBlock === 'timer0') {
      return `/* Timer0 Hardware Configuration (${timerCalculations.modeName}) */
/* Frequency: ${timerCalculations.pwmFreqHz.toFixed(2)} Hz, Duty: ${timerCalculations.dutyPctA.toFixed(1)}% */
#include <avr/io.h>

void timer0_hardware_init(void) {
    // 1. 파형 출력 핀 (OC0A = PD6 on 328P / PB7 on 2560) 출력 방향 설정
    DDRD |= (1 << PD6);

    // 2. TCCR0A: ${timerCalculations.com0aLabel}
    TCCR0A = 0x${tccr0a.toString(16).padStart(2, '0').toUpperCase()}; // 0b${tccr0a.toString(2).padStart(8, '0')}

    // 3. TCCR0B: ${timerCalculations.prescalerLabel}
    TCCR0B = 0x${tccr0b.toString(16).padStart(2, '0').toUpperCase()}; // 0b${tccr0b.toString(2).padStart(8, '0')}

    // 4. OCR0A 비교 일치 레지스터 (Duty Value)
    OCR0A = ${ocr0a};
}`;
    }

    if (activeBlock === 'adc') {
      return `/* 10-bit ADC Hardware Configuration */
/* Clock: ${adcCalculations.adcClockKhz.toFixed(2)} kHz, 1 LSB: ${adcCalculations.lsbMv.toFixed(2)} mV */
#include <avr/io.h>

void adc_hardware_init(void) {
    // 1. ADMUX: 기준 전압(${adcCalculations.vrefLabel}) 및 채널 선택
    ADMUX = 0x${admux.toString(16).padStart(2, '0').toUpperCase()};

    // 2. ADCSRA: 전원 인에이블 및 분주비(/${adcCalculations.prescalerVal}) 설정
    ADCSRA = 0x${adcsra.toString(16).padStart(2, '0').toUpperCase()};
}

uint16_t adc_read_single(void) {
    ADCSRA |= (1 << ADSC); // 변환 시작
    while (ADCSRA & (1 << ADSC)); // 완료 대기 (13 ADC 클럭 소요)
    return ADC;
}`;
    }

    if (activeBlock === 'usart') {
      return `/* USART0 Hardware Configuration */
/* Target: ${targetBaud} bps, Actual: ${usartCalculations.actualBaud.toFixed(0)} bps (${usartCalculations.baudErrorPct.toFixed(2)}% Error) */
#include <avr/io.h>

void usart0_hardware_init(void) {
    // 1. 보드레이트 분주 레지스터 기록
    UBRR0H = (unsigned char)(${usartCalculations.safeUbrr} >> 8);
    UBRR0L = (unsigned char)(${usartCalculations.safeUbrr});

    // 2. UCSR0A: U2X0 2배속 모드 = ${usartCalculations.isU2x ? '1' : '0'}
    UCSR0A = 0x${ucsr0a.toString(16).padStart(2, '0').toUpperCase()};

    // 3. UCSR0B: 송수신 모듈 인에이블
    UCSR0B = 0x${ucsr0b.toString(16).padStart(2, '0').toUpperCase()};

    // 4. UCSR0C: 8N1 프레임 포맷
    UCSR0C = 0x${ucsr0c.toString(16).padStart(2, '0').toUpperCase()};
}`;
    }

    return `/* Watchdog Timer Hardware Configuration */
/* Timeout: ${wdtCalculations.periodLabel} (${wdtCalculations.modeDescription}) */
#include <avr/io.h>
#include <avr/wdt.h>

void watchdog_hardware_init(void) {
    cli();
    wdt_reset();
    // 안전 시퀀스: WDCE 및 WDE 동시 세트 후 4사이클 이내에 설정
    WDTCSR |= (1 << WDCE) | (1 << WDE);
    WDTCSR = 0x${wdtcsr.toString(16).padStart(2, '0').toUpperCase()};
    sei();
}`;
  }, [activeBlock, tccr0a, tccr0b, ocr0a, timerCalculations, admux, adcsra, adcCalculations, targetBaud, usartCalculations, ucsr0a, ucsr0b, ucsr0c, wdtCalculations, wdtcsr]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl backdrop-blur-md">
      {/* 1. Top Header & Clock Control */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Cpu className="w-4 h-4" />
            </span>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              레지스터 로직 시뮬레이터 (Register Logic Simulator)
            </h3>
            <span className="text-xs text-amber-400 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-800/40 font-mono">
              Live Hardware Physical Reaction Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            비트 값을 변경하면 내부 실리콘 하드웨어 블록(타이머 PWM 주파수, ADC 아날로그 샘플링 속도, USART 보레이트 오차율, WDT 타임아웃)의 가상 결과값을 실시간으로 물리 연산하여 대시보드에 시뮬레이션합니다.
          </p>
        </div>

        {/* Global Clock Selector */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0">
          <span className="text-[11px] font-mono text-slate-400 pl-2">MCU 클럭 (F_CPU):</span>
          {[16000000, 8000000, 20000000, 1000000].map((freq) => (
            <button
              key={freq}
              onClick={() => setCpuFreqHz(freq)}
              className={`px-2.5 py-1 text-xs font-mono font-bold rounded-xl transition ${
                cpuFreqHz === freq
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {(freq / 1000000).toFixed(0)}MHz
            </button>
          ))}
        </div>
      </div>

      {/* 2. Block Selector Tabs & Quick Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
          <button
            onClick={() => setActiveBlock('timer0')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeBlock === 'timer0'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>타이머0 (PWM & 주파수)</span>
          </button>

          <button
            onClick={() => setActiveBlock('adc')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeBlock === 'adc'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>10-bit ADC (샘플링 & 분해능)</span>
          </button>

          <button
            onClick={() => setActiveBlock('usart')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeBlock === 'usart'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>USART0 (통신 & 오차율)</span>
          </button>

          <button
            onClick={() => setActiveBlock('watchdog')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeBlock === 'watchdog'
                ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>와치독 타이머 (WDT 리셋)</span>
          </button>
        </div>

        {/* Quick Scenario Preset Dropdown/Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
          <span className="text-slate-500 text-[11px]">추천 프리셋:</span>
          {activeBlock === 'timer0' && (
            <>
              <button
                onClick={() => handleApplyPreset('fast_pwm_1k')}
                className="px-2.5 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900 text-amber-300 border border-amber-800/40 text-[11px]"
              >
                1kHz 모터 PWM
              </button>
              <button
                onClick={() => handleApplyPreset('ctc_audio')}
                className="px-2.5 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/40 text-[11px]"
              >
                CTC 440Hz 음원
              </button>
            </>
          )}

          {activeBlock === 'adc' && (
            <button
              onClick={() => handleApplyPreset('adc_precision')}
              className="px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/40 text-[11px]"
            >
              최고 정밀도 (125kHz)
            </button>
          )}

          {activeBlock === 'usart' && (
            <button
              onClick={() => handleApplyPreset('uart_115200')}
              className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/40 text-[11px]"
            >
              115200bps U2X 설정
            </button>
          )}

          {activeBlock === 'watchdog' && (
            <button
              onClick={() => handleApplyPreset('wdt_safety')}
              className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/40 text-[11px]"
            >
              2.0s 시스템 세이프가드
            </button>
          )}
        </div>
      </div>

      {/* 3. Real-Time Hardware Calculation Metric Cards */}
      {activeBlock === 'timer0' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">PWM 출력 주파수</span>
            <span className="text-base font-black text-amber-400 block mt-0.5">
              {timerCalculations.pwmFreqHz >= 1000
                ? `${(timerCalculations.pwmFreqHz / 1000).toFixed(2)} kHz`
                : `${timerCalculations.pwmFreqHz.toFixed(2)} Hz`}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
              {timerCalculations.modeName}
            </span>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">OC0A 듀티 사이클 (Duty)</span>
            <span className="text-base font-black text-emerald-400 block mt-0.5">
              {timerCalculations.dutyPctA.toFixed(1)} %
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
              OCR0A = {ocr0a} / {timerCalculations.topVal}
            </span>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">타이머 카운터 클럭 (TCNT0)</span>
            <span className="text-base font-black text-cyan-400 block mt-0.5">
              {(timerCalculations.timerClockHz / 1000).toFixed(2)} kHz
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              1틱 = {timerCalculations.tickTimeUs.toFixed(2)} µs
            </span>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">오버플로우 주기 (TOV0)</span>
            <span className="text-base font-black text-violet-400 block mt-0.5">
              {timerCalculations.ovfPeriodMs.toFixed(3)} ms
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
              분주: {timerCalculations.prescalerLabel}
            </span>
          </div>
        </div>
      )}

      {activeBlock === 'adc' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">ADC 변환 클럭 주파수</span>
            <span className={`text-base font-black block mt-0.5 ${
              adcCalculations.specStatus === 'optimal'
                ? 'text-cyan-400'
                : adcCalculations.specStatus === 'critical'
                ? 'text-rose-400'
                : 'text-amber-400'
            }`}>
              {adcCalculations.adcClockKhz.toFixed(2)} kHz
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              분주비: /{adcCalculations.prescalerVal} (권장: 50~200kHz)
            </span>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">초당 샘플링 속도 (Throughput)</span>
            <span className="text-base font-black text-emerald-400 block mt-0.5">
              {adcCalculations.maxSps.toFixed(0)} SPS
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              1회 변환 소요: {adcCalculations.normalConversionUs.toFixed(1)} µs
            </span>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">1 LSB 전압 분해능</span>
            <span className="text-base font-black text-amber-400 block mt-0.5">
              {adcCalculations.lsbMv.toFixed(3)} mV
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
              {adcCalculations.vrefLabel}
            </span>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">실효 해상도 (ENOB) 판정</span>
            <span className={`text-base font-black block mt-0.5 ${
              adcCalculations.specStatus === 'optimal' ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {adcCalculations.specStatus === 'optimal' ? '~9.8 Bits (정밀)' : '~8.2 Bits (오차증가)'}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              최초 변환 지연: {adcCalculations.firstConversionUs.toFixed(1)} µs
            </span>
          </div>
        </div>
      )}

      {activeBlock === 'usart' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">실제 생성 통신속도</span>
            <span className="text-base font-black text-emerald-400 block mt-0.5">
              {usartCalculations.actualBaud.toFixed(0)} bps
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              목표: {targetBaud} bps (UBRR={usartCalculations.safeUbrr})
            </span>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">보레이트 오차율 (Percentage Error)</span>
            <span className={`text-base font-black block mt-0.5 ${
              usartCalculations.errorSeverity === 'safe'
                ? 'text-emerald-400'
                : usartCalculations.errorSeverity === 'warning'
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}>
              {usartCalculations.baudErrorPct >= 0 ? '+' : ''}{usartCalculations.baudErrorPct.toFixed(2)} %
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
              {usartCalculations.isU2x ? 'U2X 2배속 활성 (8분주)' : '표준 1배속 (16분주)'}
            </span>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">1비트 펄스폭 (Bit Time)</span>
            <span className="text-base font-black text-cyan-400 block mt-0.5">
              {usartCalculations.bitDurationUs.toFixed(2)} µs
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              1바이트(10비트): {usartCalculations.frameDurationUs.toFixed(1)} µs
            </span>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">최대 데이터 전송 대역폭</span>
            <span className="text-base font-black text-violet-400 block mt-0.5">
              {(usartCalculations.maxThroughputBytesSec / 1024).toFixed(2)} KB/s
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {(usartCalculations.actualBaud / 1000).toFixed(1)} kbit/s
            </span>
          </div>
        </div>
      )}

      {activeBlock === 'watchdog' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">와치독 타임아웃 주기</span>
            <span className="text-base font-black text-rose-400 block mt-0.5">
              {wdtCalculations.periodLabel.split(' ')[0]} {wdtCalculations.periodLabel.split(' ')[1]}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              프리스케일러 WDP3:0 = {wdtCalculations.wdp}
            </span>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">발진자 클럭 주파수</span>
            <span className="text-base font-black text-amber-400 block mt-0.5">
              128.0 kHz
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              전용 온칩 저전력 RC 발진자
            </span>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">하드웨어 동작 모드</span>
            <span className={`text-base font-black block mt-0.5 ${
              wdtCalculations.isWde ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              {wdtCalculations.isWde ? '시스템 리셋 인에이블' : '인터럽트 전용 모드'}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              WDE={wdtCalculations.isWde ? '1' : '0'}, WDIE={wdtCalculations.isWdie ? '1' : '0'}
            </span>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[11px] block">허용 한계 CPU 클럭 수</span>
            <span className="text-base font-black text-cyan-400 block mt-0.5">
              {((wdtCalculations.periodMs / 1000) * cpuFreqHz).toLocaleString()} Clks
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {cpuFreqHz / 1000000}MHz 기준 wdt_reset() 마진
            </span>
          </div>
        </div>
      )}

      {/* 4. Silicon Spec Diagnostic Warning Banner */}
      {activeBlock === 'adc' && adcCalculations.specStatus !== 'optimal' && (
        <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
          adcCalculations.specStatus === 'critical'
            ? 'bg-rose-950/50 border-rose-700/60 text-rose-300'
            : 'bg-amber-950/50 border-amber-700/60 text-amber-300'
        }`}>
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-sm">하드웨어 아날로그 대역폭 규격 경보</div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              {adcCalculations.specMessage}
            </p>
          </div>
        </div>
      )}

      {activeBlock === 'usart' && usartCalculations.errorSeverity !== 'safe' && (
        <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
          usartCalculations.errorSeverity === 'fatal'
            ? 'bg-rose-950/50 border-rose-700/60 text-rose-300'
            : 'bg-amber-950/50 border-amber-700/60 text-amber-300'
        }`}>
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-sm">보레이트 클럭 불일치 및 통신 오류 경보</div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              {usartCalculations.errorDesc} (오차율: {usartCalculations.baudErrorPct.toFixed(2)}%)
              <br />
              <strong>해결책:</strong> U2X0 비트를 세트하여 8분주 2배속 모드로 전환하거나, 11.0592MHz / 14.7456MHz와 같은 통신 전용 주파수 크리스털을 사용하세요.
            </p>
          </div>
        </div>
      )}

      {/* 5. Interactive Bit Toggles & Real-time Live Signal Waveform Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive 8-Bit Matrix Controls */}
        <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-cyan-400" />
                레지스터 비트 컨트롤 패널 (Interactive 8-Bit Toggles)
              </h4>
              <span className="text-[11px] text-slate-400">
                비트 타일을 클릭하여 실시간으로 1 / 0을 전환하고 하드웨어 반응을 확인하세요
              </span>
            </div>
          </div>

          {/* Block-specific registers */}
          {activeBlock === 'timer0' && (
            <div className="space-y-4">
              {/* TCCR0A Register */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-bold text-white">TCCR0A (제어 레지스터 A)</span>
                  <span className="text-amber-400">
                    0x{tccr0a.toString(16).padStart(2, '0').toUpperCase()} (0b{tccr0a.toString(2).padStart(8, '0')})
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-1.5 text-center font-mono text-xs">
                  {[
                    { name: 'COM0A1', bit: 7, desc: 'OC0A 모드 1' },
                    { name: 'COM0A0', bit: 6, desc: 'OC0A 모드 0' },
                    { name: 'COM0B1', bit: 5, desc: 'OC0B 모드 1' },
                    { name: 'COM0B0', bit: 4, desc: 'OC0B 모드 0' },
                    { name: '-', bit: 3, desc: '예약' },
                    { name: '-', bit: 2, desc: '예약' },
                    { name: 'WGM01', bit: 1, desc: '파형 모드 1' },
                    { name: 'WGM00', bit: 0, desc: '파형 모드 0' }
                  ].map((b) => {
                    const isSet = (tccr0a & (1 << b.bit)) !== 0;
                    const isReserved = b.name === '-';
                    return (
                      <button
                        key={b.bit}
                        disabled={isReserved}
                        onClick={() => toggleBit(tccr0a, b.bit, setTccr0a)}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-between transition-all ${
                          isReserved
                            ? 'opacity-25 bg-slate-950 border-slate-900 cursor-not-allowed'
                            : isSet
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm ring-1 ring-amber-500/40'
                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                        title={b.desc}
                      >
                        <span className="text-[9px] font-bold truncate max-w-full">{b.name}</span>
                        <span className={`text-base font-black my-0.5 ${isSet ? 'text-amber-300' : 'text-slate-500'}`}>
                          {isSet ? '1' : '0'}
                        </span>
                        <span className="text-[8px] text-slate-500">[{b.bit}]</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TCCR0B Register */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-bold text-white">TCCR0B (제어 레지스터 B)</span>
                  <span className="text-cyan-400">
                    0x{tccr0b.toString(16).padStart(2, '0').toUpperCase()} (0b{tccr0b.toString(2).padStart(8, '0')})
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-1.5 text-center font-mono text-xs">
                  {[
                    { name: 'FOC0A', bit: 7, desc: '강제비교 A' },
                    { name: 'FOC0B', bit: 6, desc: '강제비교 B' },
                    { name: '-', bit: 5, desc: '예약' },
                    { name: '-', bit: 4, desc: '예약' },
                    { name: 'WGM02', bit: 3, desc: '파형 모드 2' },
                    { name: 'CS02', bit: 2, desc: '분주비 2' },
                    { name: 'CS01', bit: 1, desc: '분주비 1' },
                    { name: 'CS00', bit: 0, desc: '분주비 0' }
                  ].map((b) => {
                    const isSet = (tccr0b & (1 << b.bit)) !== 0;
                    const isReserved = b.name === '-';
                    return (
                      <button
                        key={b.bit}
                        disabled={isReserved}
                        onClick={() => toggleBit(tccr0b, b.bit, setTccr0b)}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-between transition-all ${
                          isReserved
                            ? 'opacity-25 bg-slate-950 border-slate-900 cursor-not-allowed'
                            : isSet
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm ring-1 ring-cyan-500/40'
                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                        title={b.desc}
                      >
                        <span className="text-[9px] font-bold truncate max-w-full">{b.name}</span>
                        <span className={`text-base font-black my-0.5 ${isSet ? 'text-cyan-300' : 'text-slate-500'}`}>
                          {isSet ? '1' : '0'}
                        </span>
                        <span className="text-[8px] text-slate-500">[{b.bit}]</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* OCR0A Compare Value Slider */}
              <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs">
                <div className="flex justify-between items-center font-mono">
                  <span className="text-slate-400">OCR0A 비교 일치 레지스터 (PWM Duty 조절):</span>
                  <span className="text-emerald-400 font-bold">
                    {ocr0a} <span className="text-slate-500">(0x{ocr0a.toString(16).padStart(2, '0').toUpperCase()})</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={ocr0a}
                  onChange={(e) => setOcr0a(Number(e.target.value))}
                  className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {activeBlock === 'adc' && (
            <div className="space-y-4">
              {/* ADCSRA Register */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-bold text-white">ADCSRA (ADC 제어 및 상태 레지스터 A)</span>
                  <span className="text-cyan-400">
                    0x{adcsra.toString(16).padStart(2, '0').toUpperCase()} (0b{adcsra.toString(2).padStart(8, '0')})
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-1.5 text-center font-mono text-xs">
                  {[
                    { name: 'ADEN', bit: 7, desc: '전원 켜기' },
                    { name: 'ADSC', bit: 6, desc: '변환 시작' },
                    { name: 'ADATE', bit: 5, desc: '자동 트리거' },
                    { name: 'ADIF', bit: 4, desc: '인터럽트 플래그' },
                    { name: 'ADIE', bit: 3, desc: '인터럽트 허용' },
                    { name: 'ADPS2', bit: 2, desc: '분주비 2' },
                    { name: 'ADPS1', bit: 1, desc: '분주비 1' },
                    { name: 'ADPS0', bit: 0, desc: '분주비 0' }
                  ].map((b) => {
                    const isSet = (adcsra & (1 << b.bit)) !== 0;
                    return (
                      <button
                        key={b.bit}
                        onClick={() => toggleBit(adcsra, b.bit, setAdcsra)}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-between transition-all ${
                          isSet
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm ring-1 ring-cyan-500/40'
                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                        title={b.desc}
                      >
                        <span className="text-[9px] font-bold truncate max-w-full">{b.name}</span>
                        <span className={`text-base font-black my-0.5 ${isSet ? 'text-cyan-300' : 'text-slate-500'}`}>
                          {isSet ? '1' : '0'}
                        </span>
                        <span className="text-[8px] text-slate-500">[{b.bit}]</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ADMUX Register */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-bold text-white">ADMUX (멀티플렉서 및 기준 전압 레지스터)</span>
                  <span className="text-amber-400">
                    0x{admux.toString(16).padStart(2, '0').toUpperCase()} (0b{admux.toString(2).padStart(8, '0')})
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-1.5 text-center font-mono text-xs">
                  {[
                    { name: 'REFS1', bit: 7, desc: '기준전압 1' },
                    { name: 'REFS0', bit: 6, desc: '기준전압 0' },
                    { name: 'ADLAR', bit: 5, desc: '좌측정렬' },
                    { name: 'MUX4', bit: 4, desc: '채널선택 4' },
                    { name: 'MUX3', bit: 3, desc: '채널선택 3' },
                    { name: 'MUX2', bit: 2, desc: '채널선택 2' },
                    { name: 'MUX1', bit: 1, desc: '채널선택 1' },
                    { name: 'MUX0', bit: 0, desc: '채널선택 0' }
                  ].map((b) => {
                    const isSet = (admux & (1 << b.bit)) !== 0;
                    return (
                      <button
                        key={b.bit}
                        onClick={() => toggleBit(admux, b.bit, setAdmux)}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-between transition-all ${
                          isSet
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm ring-1 ring-amber-500/40'
                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                        title={b.desc}
                      >
                        <span className="text-[9px] font-bold truncate max-w-full">{b.name}</span>
                        <span className={`text-base font-black my-0.5 ${isSet ? 'text-amber-300' : 'text-slate-500'}`}>
                          {isSet ? '1' : '0'}
                        </span>
                        <span className="text-[8px] text-slate-500">[{b.bit}]</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeBlock === 'usart' && (
            <div className="space-y-4">
              {/* UCSR0A Register */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-bold text-white">UCSR0A (상태 및 배속 제어)</span>
                  <span className="text-emerald-400">
                    0x{ucsr0a.toString(16).padStart(2, '0').toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-1.5 text-center font-mono text-xs">
                  {[
                    { name: 'RXC0', bit: 7, desc: '수신완료' },
                    { name: 'TXC0', bit: 6, desc: '송신완료' },
                    { name: 'UDRE0', bit: 5, desc: '송신버퍼빔' },
                    { name: 'FE0', bit: 4, desc: '프레임에러' },
                    { name: 'DOR0', bit: 3, desc: '오버런' },
                    { name: 'UPE0', bit: 2, desc: '패리티에러' },
                    { name: 'U2X0', bit: 1, desc: '2배속 모드' },
                    { name: 'MPCM0', bit: 0, desc: '멀티통신' }
                  ].map((b) => {
                    const isSet = (ucsr0a & (1 << b.bit)) !== 0;
                    return (
                      <button
                        key={b.bit}
                        onClick={() => toggleBit(ucsr0a, b.bit, setUcsr0a)}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-between transition-all ${
                          isSet
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm ring-1 ring-emerald-500/40'
                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                        title={b.desc}
                      >
                        <span className="text-[9px] font-bold truncate max-w-full">{b.name}</span>
                        <span className={`text-base font-black my-0.5 ${isSet ? 'text-emerald-300' : 'text-slate-500'}`}>
                          {isSet ? '1' : '0'}
                        </span>
                        <span className="text-[8px] text-slate-500">[{b.bit}]</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* UBRR0 Baud Rate Divisor Input */}
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">UBRR0 보레이트 분주 레지스터:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={4095}
                      value={ubrr0}
                      onChange={(e) => setUbrr0(Number(e.target.value))}
                      className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white text-right font-bold focus:outline-none focus:border-emerald-400"
                    />
                    <span className="text-slate-500">(0x{ubrr0.toString(16).toUpperCase()})</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>목표 기준 보드레이트:</span>
                  <select
                    value={targetBaud}
                    onChange={(e) => setTargetBaud(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-white focus:outline-none"
                  >
                    {[9600, 19200, 38400, 57600, 115200, 230400, 250000, 500000].map((b) => (
                      <option key={b} value={b}>
                        {b.toLocaleString()} bps
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeBlock === 'watchdog' && (
            <div className="space-y-4">
              {/* WDTCSR Register */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-bold text-white">WDTCSR (와치독 제어 및 상태 레지스터)</span>
                  <span className="text-rose-400">
                    0x{wdtcsr.toString(16).padStart(2, '0').toUpperCase()} (0b{wdtcsr.toString(2).padStart(8, '0')})
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-1.5 text-center font-mono text-xs">
                  {[
                    { name: 'WDIF', bit: 7, desc: '인터럽트 플래그' },
                    { name: 'WDIE', bit: 6, desc: '인터럽트 허용' },
                    { name: 'WDP3', bit: 5, desc: '분주비 3' },
                    { name: 'WDCE', bit: 4, desc: '변경 허용' },
                    { name: 'WDE', bit: 3, desc: '리셋 허용' },
                    { name: 'WDP2', bit: 2, desc: '분주비 2' },
                    { name: 'WDP1', bit: 1, desc: '분주비 1' },
                    { name: 'WDP0', bit: 0, desc: '분주비 0' }
                  ].map((b) => {
                    const isSet = (wdtcsr & (1 << b.bit)) !== 0;
                    return (
                      <button
                        key={b.bit}
                        onClick={() => toggleBit(wdtcsr, b.bit, setWdtcsr)}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-between transition-all ${
                          isSet
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm ring-1 ring-rose-500/40'
                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                        title={b.desc}
                      >
                        <span className="text-[9px] font-bold truncate max-w-full">{b.name}</span>
                        <span className={`text-base font-black my-0.5 ${isSet ? 'text-rose-300' : 'text-slate-500'}`}>
                          {isSet ? '1' : '0'}
                        </span>
                        <span className="text-[8px] text-slate-500">[{b.bit}]</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1 leading-relaxed">
                <div className="font-bold text-amber-300 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  동작 모드: {wdtCalculations.modeDescription}
                </div>
                <p className="text-[11px] text-slate-400">
                  타임아웃 {wdtCalculations.periodLabel} 동안 <code className="text-cyan-300">wdt_reset()</code> 함수가 호출되지 않으면 하드웨어 시스템 리셋 또는 보호 인터럽트가 실행됩니다.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Live Simulated Waveform & Physical Reaction Diagram */}
        <div className="lg:col-span-5 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Waves className="w-4 h-4 text-emerald-400" />
              가상 하드웨어 출력 반응 (Live Physical Reaction)
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">실시간 파형 시뮬레이션</span>
          </div>

          {/* Timer0 Live PWM Waveform Visualizer */}
          {activeBlock === 'timer0' && (
            <div className="space-y-3">
              <div className="bg-slate-900 rounded-xl p-3 border border-slate-800">
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-2">
                  <span>OC0A 파형 (듀티 {timerCalculations.dutyPctA.toFixed(1)}%)</span>
                  <span className="text-amber-400 font-bold">
                    {timerCalculations.pwmFreqHz.toFixed(1)} Hz
                  </span>
                </div>

                {/* SVG Square Wave */}
                <div className="h-24 w-full bg-slate-950 rounded-lg p-2 border border-slate-800/80 flex items-center justify-center">
                  {timerCalculations.prescaler === 0 ? (
                    <span className="text-xs font-mono text-slate-500">타이머 정지 (클럭 공급 없음)</span>
                  ) : timerCalculations.com0a === 0 ? (
                    <span className="text-xs font-mono text-slate-500">OC0A 핀 분리 상태 (파형 출력 안 됨)</span>
                  ) : (
                    <svg viewBox="0 0 300 60" className="w-full h-full stroke-amber-400 fill-none" strokeWidth="2.5">
                      {/* Render 3 cycles of PWM */}
                      {(() => {
                        const dutyFrac = timerCalculations.dutyPctA / 100;
                        const periodW = 100;
                        const highW = Math.max(2, Math.min(periodW - 2, periodW * dutyFrac));
                        const lowW = periodW - highW;
                        let d = '';
                        for (let i = 0; i < 3; i++) {
                          const startX = i * periodW;
                          d += `M ${startX} 50 L ${startX} 10 L ${startX + highW} 10 L ${startX + highW} 50 L ${startX + periodW} 50 `;
                        }
                        return <path d={d} />;
                      })()}
                    </svg>
                  )}
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>하이(HIGH) 유지 시간:</span>
                  <span className="text-emerald-400 font-bold">
                    {timerCalculations.pwmFreqHz > 0
                      ? `${((1 / timerCalculations.pwmFreqHz) * (timerCalculations.dutyPctA / 100) * 1000).toFixed(3)} ms`
                      : '0 ms'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>로우(LOW) 유지 시간:</span>
                  <span className="text-slate-300">
                    {timerCalculations.pwmFreqHz > 0
                      ? `${((1 / timerCalculations.pwmFreqHz) * ((100 - timerCalculations.dutyPctA) / 100) * 1000).toFixed(3)} ms`
                      : '0 ms'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ADC Conversion Timing Pipeline Diagram */}
          {activeBlock === 'adc' && (
            <div className="space-y-3">
              <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 space-y-2">
                <div className="text-[10px] font-mono text-slate-400 flex justify-between">
                  <span>13-클럭 순차 비교형(SAR) 변환 파이프라인</span>
                  <span className="text-cyan-400 font-bold">{adcCalculations.normalConversionUs.toFixed(1)} µs</span>
                </div>

                {/* Pipeline visual bar */}
                <div className="h-8 w-full bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex font-mono text-[9px] text-center font-bold">
                  <div
                    className="h-full bg-amber-500/30 text-amber-300 border-r border-amber-500/50 flex items-center justify-center"
                    style={{ width: `${(1.5 / 13) * 100}%` }}
                    title="1.5 클럭: 샘플앤홀드 커패시터 충전 구간"
                  >
                    S&H
                  </div>
                  <div
                    className="h-full bg-cyan-500/30 text-cyan-300 flex items-center justify-center flex-1"
                    title="11.5 클럭: 10비트 순차 근사 변환(SAR)"
                  >
                    10-Bit SAR 연속 근사 변환 (11.5 Clks)
                  </div>
                </div>

                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>샘플앤홀드 (1.5 Clks)</span>
                  <span>데이터 레지스터(ADC) 래치 완료</span>
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>전압 입력 감도:</span>
                  <span className="text-amber-400 font-bold">0.0V ~ {adcCalculations.vrefVolts.toFixed(2)}V</span>
                </div>
                <div className="flex justify-between">
                  <span>양자화 스텝 크기 (1 LSB):</span>
                  <span className="text-cyan-400 font-bold">{adcCalculations.lsbMv.toFixed(3)} mV</span>
                </div>
              </div>
            </div>
          )}

          {/* USART Serial Frame Diagram */}
          {activeBlock === 'usart' && (
            <div className="space-y-3">
              <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 space-y-2">
                <div className="text-[10px] font-mono text-slate-400 flex justify-between">
                  <span>10-Bit 직렬 비동기 프레임 다이어그램 (8N1)</span>
                  <span className="text-emerald-400 font-bold">{usartCalculations.frameDurationUs.toFixed(1)} µs</span>
                </div>

                {/* Serial Bit Packet Visual */}
                <div className="h-9 w-full bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex font-mono text-[9px] text-center font-bold">
                  <div className="h-full bg-rose-500/30 text-rose-300 border-r border-rose-500/50 flex items-center justify-center w-[10%]">
                    START
                  </div>
                  <div className="h-full bg-emerald-500/30 text-emerald-300 border-r border-emerald-500/50 flex items-center justify-center flex-1">
                    8 Data Bits (D0 ~ D7)
                  </div>
                  <div className="h-full bg-cyan-500/30 text-cyan-300 flex items-center justify-center w-[10%]">
                    STOP
                  </div>
                </div>

                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>Start (LOW)</span>
                  <span>LSB First ➔ MSB</span>
                  <span>Stop (HIGH)</span>
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>1개 비트 전송 소요 시간:</span>
                  <span className="text-emerald-400 font-bold">{usartCalculations.bitDurationUs.toFixed(2)} µs</span>
                </div>
                <div className="flex justify-between">
                  <span>통신 안정성:</span>
                  <span className={usartCalculations.errorSeverity === 'safe' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {usartCalculations.absError <= 1.5 ? '완전 안정 (Safe)' : '불안정 위험'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Watchdog Countdown Gauge */}
          {activeBlock === 'watchdog' && (
            <div className="space-y-3">
              <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 space-y-2">
                <div className="text-[10px] font-mono text-slate-400 flex justify-between">
                  <span>와치독 안전 마진 바 (Timeout Gauge)</span>
                  <span className="text-rose-400 font-bold">{wdtCalculations.periodLabel.split(' ')[0]} {wdtCalculations.periodLabel.split(' ')[1]}</span>
                </div>

                <div className="h-6 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (wdtCalculations.periodMs / 8000) * 100)}%` }}
                  />
                </div>

                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>16 ms (최소)</span>
                  <span>2.0 초 (표준)</span>
                  <span>8.0 초 (최대)</span>
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>wdt_reset() 호출 주기 권장:</span>
                  <span className="text-cyan-400 font-bold">
                    {(wdtCalculations.periodMs * 0.5).toFixed(0)} ms 이내 (50% 안전마진)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. Dynamic C Code Output Box */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              실시간 동기화 Bare-metal C 하드웨어 초기화 코드
            </h4>
          </div>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 shrink-0"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'C 코드 복사 완료!' : '초기화 C 코드 복사'}</span>
          </button>
        </div>

        <pre className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto max-h-48 leading-relaxed select-all">
          {generatedCCode}
        </pre>
      </div>
    </div>
  );
};
