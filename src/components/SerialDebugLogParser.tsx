import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';
import {
  Terminal,
  Search,
  Filter,
  Copy,
  Check,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  AlertOctagon,
  Info,
  Cpu,
  Layers,
  Sparkles,
  Sliders,
  FileText,
  Clock,
  Radio,
  Download,
  Zap,
  ArrowRight,
  ShieldAlert,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface Props {
  selectedMCU: SupportedMCU;
}

export interface DecodedBit {
  bit: number;
  name: string;
  isSet: boolean;
  meaning: string;
  isError?: boolean;
  isWarning?: boolean;
}

export interface DecodedRegisterEvent {
  id: string;
  lineIndex: number;
  rawLine: string;
  timestamp?: string;
  registerName: string;
  rawValueHex: string;
  rawValueDec: number;
  severity: 'error' | 'warning' | 'info' | 'success';
  summary: string;
  category: 'system' | 'usart' | 'twi' | 'adc' | 'spi' | 'timer';
  bits: DecodedBit[];
  errorCodeDetail?: string;
}

// Built-in Sample Raw Logs per MCU
const SAMPLE_LOGS: Record<SupportedMCU, { title: string; desc: string; text: string }[]> = {
  atmega2560: [
    {
      title: 'Marlin 3D 프린터 부팅 & 4채널 USART 통신 로그',
      desc: 'ATmega2560 16MHz 기반 3D 프린터 및 다축 센서 정상 구동 로그',
      text: `[00:00:00.040] [BOOT] Marlin 2.1.2.4 Firmware Initializing on ATmega2560...
[00:00:00.045] [POWER] MCUSR=0x01 (PORF Power-On Reset Flag Set)
[00:00:00.050] [SYS] 256KB Flash Validated. Free SRAM: 5412 Bytes.
[00:00:00.100] [USART0] USB Host G-code Stream Ready. Baud=115200, UCSR0A=0x20
[00:00:00.110] [USART1] TFT Touch LCD Controller Connected. Baud=115200, UCSR1A=0x20
[00:00:00.120] [USART2] Bluetooth Remote Console Ready. Baud=9600, UCSR2A=0x20
[00:00:00.130] [USART3] Direct Extruder Feedback Sensor Ready. Baud=115200, UCSR3A=0x20
[00:00:00.200] [SPI] SD Card Slot Initialized. SPCR=0x50 (MSTR=1, SPE=1), SPSR=0x00
[00:00:00.300] [ADC] Hotend/Bed Thermistor Analog Lines Ready. ADCSRA=0x87, ADMUX=0x40
[00:00:01.000] [SYSTEM] All 6 Timers & 16 PWM Channels Initialized. Ready for Printing.`
    },
    {
      title: 'UART 버퍼 오버런 & I2C 통신 타임아웃 장애 로그',
      desc: '고속 G-code 전송 시 USART0 오버런(DOR0) 및 히팅베드 센서 I2C NACK 발생 로그',
      text: `[00:00:02.100] [PRINT] Streaming high-density circular micro-stepping coordinates...
[00:00:02.105] [WARN] Main loop processing latency spike: 220us!
[00:00:02.110] [ERROR] USART0 Buffer Overflow! UCSR0A=0x18 (FE0=0, DOR0=1 OverRun, UPE0=0) UDR0=0x47
[00:00:02.115] [TWI] Probing Chamber Temperature Sensor @ 0x48...
[00:00:02.120] [WARN] I2C Bus Error! TWSR=0x20 (SLA+W Transmitted, NACK Received!)
[00:00:03.000] [WATCHDOG] WDTCSR=0x48 (Watchdog Reset Imminent!)`
    }
  ],
  atmega640: [
    {
      title: 'UART Frame Error & TWI NACK 통신 장애 로그',
      desc: '보드레이트 불일치로 인한 USART0 프레임 에러(FE) 및 I2C 슬레이브 미응답(SLA+W NACK) 발생 로그',
      text: `[00:00:00.120] [BOOT] ATmega640 Core Booting... F_CPU=16000000Hz
[00:00:00.125] [SYS] MCUSR=0x03 (PORF=1, EXTRF=1, BORF=0, WDRF=0, JTRF=0)
[00:00:00.130] [SYS] SREG=0x80 (I-bit Global Interrupt Enabled)
[00:00:00.540] [INIT] USART0 Config: UBRR0=16, UCSR0A=0x00, UCSR0B=0x98, UCSR0C=0x06
[00:00:01.200] [TWI] Probing I2C Bus Address 0x68 (RTC Sensor)...
[00:00:01.205] [WARN] TWI Transmission failed! TWSR=0x20, TWCR=0xA4 (SLA+W NACK received)
[00:00:02.450] [UART] RX Packet incoming on Port 0...
[00:00:02.455] [ERROR] USART0 Receiver Corrupted! UCSR0A=0x14 (FE=1 Frame Error, DOR=0, UPE=0) UDR0=0xFF
[00:00:02.460] [UART] Packet checksum invalid. Flushing FIFO buffer.
[00:00:03.110] [ADC] Reading Channel 0 (Potentiometer)... ADCSRA=0x97 (ADEN=1, ADPS=128), ADMUX=0x40
[00:00:04.880] [SYS] Watchdog heartbeat pending... WDTCSR=0x48 (WDE=1, WDP=1s)`
    },
    {
      title: '정상 부팅 & 4채널 USART 초기화 로그',
      desc: 'ATmega640의 4개 UART 하드웨어 포트 및 ADC 정상 초기화 로그',
      text: `[00:00:00.050] [POWER] Reset Vector reached. MCUSR=0x01 (PORF Power-On Reset)
[00:00:00.055] [SYS] SREG=0x00
[00:00:00.100] [USART0] Baud=115200bps, UCSR0A=0x02 (U2X0=1), UCSR0B=0x18
[00:00:00.105] [USART1] RS-485 Port Ready, UCSR1A=0x20 (UDRE1=1), UCSR1B=0x18
[00:00:00.110] [USART2] GPS NMEA Port Ready, UCSR2A=0x00, UCSR2B=0x98
[00:00:00.115] [USART3] Telemetry Port Ready, UCSR3A=0x20 (UDRE3=1), UCSR3B=0x18
[00:00:00.200] [SPI] Master Mode Active. SPCR=0x50, SPSR=0x00
[00:00:00.300] [ADC] ADC Ready. ADCSRA=0x87, ADMUX=0x40
[00:00:01.000] [APP] Main loop started. SREG=0x80`
    }
  ],
  atmega128: [
    {
      title: '브라운아웃(BORF) 리셋 및 Watchdog 타임아웃 장애',
      desc: '전압 강하로 인한 Brown-out 리셋(BORF)과 WDT 타임아웃 리셋이 기록된 로그',
      text: `[00:00:00.010] [BOOT] ATmega128 System Restarted!
[00:00:00.015] [RESET_CAUSE] MCUSR=0x0C (BORF=1 Brown-out Reset, WDRF=1 Watchdog Reset)
[00:00:00.020] [CRITICAL] VCC dropped below BOD 2.7V threshold during Flash erase!
[00:00:00.100] [CONFIG] Checking M103C Compatibility Fuse... Native ATmega128 Mode.
[00:00:00.250] [USART0] UCSR0A=0x20 (UDRE0=1), UCSR0B=0x18, UCSR0C=0x06
[00:00:01.500] [SPI] Bus Collision! SPSR=0x40 (WCOL Write Collision Flag Set!)
[00:00:02.100] [TWI] TWSR=0x38 (Arbitration Lost in SLA+W or Data bytes)`
    },
    {
      title: 'USART 데이터 오버런(DOR) 및 패리티 에러 로그',
      desc: '인터럽트 지연으로 발생한 Data OverRun(DOR) 및 UPE 에러',
      text: `[00:00:01.000] [COM1] Incoming burst data from PC host...
[00:00:01.005] [WARN] ISR latency > 150us! Receiver buffer full.
[00:00:01.010] [ERROR] UCSR0A=0x1C (RXC=0, FE=1 Frame Error, DOR=1 Data OverRun, UPE=1 Parity Error)
[00:00:01.015] [COM1] Discarding corrupt byte UDR0=0x00
[00:00:01.020] [SYS] SREG=0x85 (I=1, V=0, N=1, Z=0, C=1)`
    }
  ],
  atmega328p: [
    {
      title: 'Arduino Uno Optiboot 정상 가동 & 센서 ADC 로그',
      desc: 'MCUSR 파워온 리셋 및 ADCSRA 완료 플래그 폴링 정상 시퀀스',
      text: `[00:00:00.000] [OPTIBOOT] Jumping to Sketch @ 0x0000...
[00:00:00.005] [SYS] MCUSR=0x01 (PORF=1 Power-On Reset)
[00:00:00.010] [UART] UCSR0A=0x22 (UDRE0=1, U2X0=1), UCSR0B=0x98, UCSR0C=0x06
[00:00:00.500] [ADC] Starting Conversion on A0... ADCSRA=0xD7 (ADEN=1, ADSC=1, ADPS=128)
[00:00:00.502] [ADC] Conversion finished! ADCSRA=0x97 (ADIF=1 Conversion Complete)
[00:00:01.000] [STATUS] System Running OK. SREG=0x80 (Interrupts Active)`
    },
    {
      title: '워치독(WDRF) 무한 리셋 루프 장애 로그',
      desc: 'WDT 비활성화 실패로 지속적 재부팅이 발생하는 전형적인 이슈 로그',
      text: `[00:00:00.000] [RESTART] System boot cycle #42
[00:00:00.002] [FATAL] Reset caused by Watchdog: MCUSR=0x08 (WDRF=1)
[00:00:00.004] [WARN] MCUSR not cleared early in bootloader!
[00:00:00.010] [WDT] WDTCSR=0x58 (WDCE=1, WDE=1, WDP=0b0000)
[00:00:00.015] [HALT] WDT timeout imminent before main() execution`
    }
  ]
};

// Decoder function for specific AVR Registers
export const decodeRegisterValue = (
  regName: string,
  val: number,
  mcu: SupportedMCU
): {
  category: DecodedRegisterEvent['category'];
  summary: string;
  severity: DecodedRegisterEvent['severity'];
  bits: DecodedBit[];
  errorCodeDetail?: string;
} => {
  const normName = regName.toUpperCase();

  // 1. MCUSR (Microcontroller Status Register)
  if (normName === 'MCUSR') {
    const porf = Boolean(val & 0x01);
    const extrf = Boolean(val & 0x02);
    const borf = Boolean(val & 0x04);
    const wdrf = Boolean(val & 0x08);
    const jtrf = Boolean(val & 0x10);

    const bits: DecodedBit[] = [
      { bit: 4, name: 'JTRF', isSet: jtrf, meaning: 'JTAG 리셋 플래그 (JTAG Reset)', isWarning: jtrf },
      { bit: 3, name: 'WDRF', isSet: wdrf, meaning: '워치독 타이머 리셋 플래그 (Watchdog Reset)', isError: wdrf },
      { bit: 2, name: 'BORF', isSet: borf, meaning: '브라운아웃 전압 강하 리셋 플래그 (Brown-out Reset)', isError: borf },
      { bit: 1, name: 'EXTRF', isSet: extrf, meaning: '외부 RESET 핀 리셋 플래그 (External Reset Pin)' },
      { bit: 0, name: 'PORF', isSet: porf, meaning: '전원 인가 리셋 플래그 (Power-on Reset)' }
    ];

    let severity: DecodedRegisterEvent['severity'] = 'info';
    let summary = '리셋 플래그 정상';
    let errDetail: string | undefined;

    if (wdrf) {
      severity = 'error';
      summary = '⚠️ 워치독 타이머(WDT) 만료로 인한 강제 시스템 리셋 감지!';
      errDetail = 'MCU 펌웨어 루프가 중단되었거나 WDT 카운터 클리어가 지연되어 리셋되었습니다.';
    } else if (borf) {
      severity = 'error';
      summary = '⚠️ 브라운아웃(BOD) 공급전압 강하 리셋 감지!';
      errDetail = '입력 전원 전압이 BOD 감지 임계전압(예: 2.7V 또는 4.3V) 이하로 급격히 떨어졌습니다.';
    } else if (jtrf) {
      severity = 'warning';
      summary = 'JTAG 인터페이스 리셋 발생';
    } else if (porf) {
      severity = 'success';
      summary = '정상 전원 인가(Power-on) 부팅';
    } else if (extrf) {
      severity = 'info';
      summary = '외부 리셋 핀 트리거 부팅';
    }

    return { category: 'system', summary, severity, bits, errorCodeDetail: errDetail };
  }

  // 2. UCSRnA (USART Control and Status Register n A)
  if (/^UCSR[0-3]A$/.test(normName)) {
    const channel = normName.charAt(4);
    const rxc = Boolean(val & 0x80);
    const txc = Boolean(val & 0x40);
    const udre = Boolean(val & 0x20);
    const fe = Boolean(val & 0x10);
    const dor = Boolean(val & 0x08);
    const upe = Boolean(val & 0x04);
    const u2x = Boolean(val & 0x02);
    const mpcm = Boolean(val & 0x01);

    const bits: DecodedBit[] = [
      { bit: 7, name: `RXC${channel}`, isSet: rxc, meaning: '수신 완료 플래그 (Receive Complete)' },
      { bit: 6, name: `TXC${channel}`, isSet: txc, meaning: '송신 완료 플래그 (Transmit Complete)' },
      { bit: 5, name: `UDRE${channel}`, isSet: udre, meaning: '송신 데이터 레지스터 비어있음 (Buffer Empty)' },
      { bit: 4, name: `FE${channel}`, isSet: fe, meaning: '프레임 오류 플래그 (Frame Error - 스톱비트 불일치)', isError: fe },
      { bit: 3, name: `DOR${channel}`, isSet: dor, meaning: '데이터 오버런 오류 (Data OverRun - 수신 버퍼 넘침)', isError: dor },
      { bit: 2, name: `UPE${channel}`, isSet: upe, meaning: '패리티 검사 오류 (Parity Error)', isError: upe },
      { bit: 1, name: `U2X${channel}`, isSet: u2x, meaning: '2배속 통신 활성화 (Double Transmission Speed)' },
      { bit: 0, name: `MPCM${channel}`, isSet: mpcm, meaning: '다중 프로세서 통신 모드 (Multi-processor)' }
    ];

    let severity: DecodedRegisterEvent['severity'] = 'info';
    let summary = `USART${channel} 상태 정상 (UDRE=${udre ? '1' : '0'})`;
    let errDetail: string | undefined;

    if (fe || dor || upe) {
      severity = 'error';
      const errors = [];
      if (fe) errors.push('FE(프레임 에러: 보드레이트 불일치)');
      if (dor) errors.push('DOR(데이터 오버런: ISR 처리 지연)');
      if (upe) errors.push('UPE(패리티 불일치)');
      summary = `🚨 USART${channel} 수신 오류 발생: ${errors.join(', ')}`;
      errDetail = '통신 속도(Baud) 설정값 불일치 또는 인터럽트 지연으로 인해 수신 데이터가 손실되었습니다.';
    } else if (u2x) {
      severity = 'success';
      summary = `USART${channel} 2배속 모드(U2X=1) 정상 운용 중`;
    }

    return { category: 'usart', summary, severity, bits, errorCodeDetail: errDetail };
  }

  // 3. TWSR (TWI / I2C Status Register)
  if (normName === 'TWSR') {
    const statusCode = val & 0xF8; // Mask lower 3 bits (TWPS1:0 & Reserved)
    const twps1 = Boolean(val & 0x02);
    const twps0 = Boolean(val & 0x01);

    const bits: DecodedBit[] = [
      { bit: 7, name: 'TWS7', isSet: Boolean(val & 0x80), meaning: `상태 비트 7 (0x${statusCode.toString(16).toUpperCase()})` },
      { bit: 6, name: 'TWS6', isSet: Boolean(val & 0x40), meaning: '상태 비트 6' },
      { bit: 5, name: 'TWS5', isSet: Boolean(val & 0x20), meaning: '상태 비트 5' },
      { bit: 4, name: 'TWS4', isSet: Boolean(val & 0x10), meaning: '상태 비트 4' },
      { bit: 3, name: 'TWS3', isSet: Boolean(val & 0x08), meaning: '상태 비트 3' },
      { bit: 2, name: 'Res', isSet: false, meaning: '예약된 비트 (항상 0)' },
      { bit: 1, name: 'TWPS1', isSet: twps1, meaning: '분주비 비트 1' },
      { bit: 0, name: 'TWPS0', isSet: twps0, meaning: '분주비 비트 0' }
    ];

    let severity: DecodedRegisterEvent['severity'] = 'info';
    let summary = `TWI 상태 코드 0x${statusCode.toString(16).toUpperCase().padStart(2, '0')}`;
    let errDetail: string | undefined;

    switch (statusCode) {
      case 0x08:
        summary = 'START 조건 정상 송신됨 (0x08)';
        severity = 'success';
        break;
      case 0x10:
        summary = '반복 START(Repeated START) 조건 송신됨 (0x10)';
        severity = 'success';
        break;
      case 0x18:
        summary = 'SLA+W 송신 완료 및 ACK 수신 성공 (0x18)';
        severity = 'success';
        break;
      case 0x20:
        severity = 'error';
        summary = '⚠️ SLA+W 송신 후 NACK(미응답) 수신됨 (0x20)';
        errDetail = '지정한 I2C 슬레이브 장치가 버스에 없거나 주소가 잘못되었습니다 (No ACK).';
        break;
      case 0x28:
        summary = '데이터 바이트 송신 완료 및 ACK 수신 성공 (0x28)';
        severity = 'success';
        break;
      case 0x30:
        severity = 'warning';
        summary = '데이터 바이트 송신 후 슬레이브 NACK 수신 (0x30)';
        errDetail = '슬레이브가 더 이상 데이터를 수신할 수 없는 상태입니다.';
        break;
      case 0x38:
        severity = 'error';
        summary = '🚨 TWI 버스 중재 실패(Arbitration Lost) (0x38)';
        errDetail = '다중 마스터 환경에서 다른 마스터 장치에 버스 점유권을 빼앗겼습니다.';
        break;
      case 0x40:
        summary = 'SLA+R 송신 완료 및 ACK 수신 성공 (0x40)';
        severity = 'success';
        break;
      case 0x48:
        severity = 'error';
        summary = '⚠️ SLA+R 송신 후 NACK 수신 (0x48)';
        errDetail = '읽기 모드 슬레이브 장치가 응답하지 않습니다.';
        break;
      case 0xF8:
        summary = '상태 플래그 미발생 (NO_INFO: 버스 대기 상태)';
        severity = 'info';
        break;
      default:
        summary = `TWI 상태 코드: 0x${statusCode.toString(16).toUpperCase()}`;
        break;
    }

    return { category: 'twi', summary, severity, bits, errorCodeDetail: errDetail };
  }

  // 4. SREG (Status Register)
  if (normName === 'SREG') {
    const i = Boolean(val & 0x80);
    const t = Boolean(val & 0x40);
    const h = Boolean(val & 0x20);
    const s = Boolean(val & 0x10);
    const v = Boolean(val & 0x08);
    const n = Boolean(val & 0x04);
    const z = Boolean(val & 0x02);
    const c = Boolean(val & 0x01);

    const bits: DecodedBit[] = [
      { bit: 7, name: 'I', isSet: i, meaning: '전역 인터럽트 활성화 (Global Interrupt Enable)' },
      { bit: 6, name: 'T', isSet: t, meaning: '비트 복사 저장소 (Bit Copy Storage)' },
      { bit: 5, name: 'H', isSet: h, meaning: '하프 캐리 플래그 (Half Carry)' },
      { bit: 4, name: 'S', isSet: s, meaning: '부호 플래그 (Sign Bit = N ⊕ V)' },
      { bit: 3, name: 'V', isSet: v, meaning: '2의 보수 오버플로 (Two\'s Complement Overflow)', isWarning: v },
      { bit: 2, name: 'N', isSet: n, meaning: '음수 플래그 (Negative)' },
      { bit: 1, name: 'Z', isSet: z, meaning: '0 플래그 (Zero Flag)' },
      { bit: 0, name: 'C', isSet: c, meaning: '캐리 플래그 (Carry Flag)' }
    ];

    const activeFlags = [];
    if (i) activeFlags.push('I(인터럽트 활성)');
    if (z) activeFlags.push('Z(Zero)');
    if (c) activeFlags.push('C(Carry)');
    if (n) activeFlags.push('N(Neg)');
    if (v) activeFlags.push('V(Overflow)');

    return {
      category: 'system',
      summary: `ALU 상태 레지스터: ${activeFlags.join(', ') || '플래그 없음'}`,
      severity: v ? 'warning' : 'info',
      bits
    };
  }

  // 5. ADCSRA (ADC Control and Status Register A)
  if (normName === 'ADCSRA') {
    const aden = Boolean(val & 0x80);
    const adsc = Boolean(val & 0x40);
    const adate = Boolean(val & 0x20);
    const adif = Boolean(val & 0x10);
    const adie = Boolean(val & 0x08);
    const prescaler = val & 0x07;
    const prescalerVal = [2, 2, 4, 8, 16, 32, 64, 128][prescaler] || 2;

    const bits: DecodedBit[] = [
      { bit: 7, name: 'ADEN', isSet: aden, meaning: 'ADC 모듈 활성화 (ADC Enable)' },
      { bit: 6, name: 'ADSC', isSet: adsc, meaning: '아날로그 변환 진행 중 (Start Conversion)' },
      { bit: 5, name: 'ADATE', isSet: adate, meaning: '자동 트리거 활성화 (Auto Trigger)' },
      { bit: 4, name: 'ADIF', isSet: adif, meaning: 'ADC 변환 완료 인터럽트 플래그 (Interrupt Flag)' },
      { bit: 3, name: 'ADIE', isSet: adie, meaning: 'ADC 완료 인터럽트 인에이블' },
      { bit: 2, name: 'ADPS2', isSet: Boolean(val & 0x04), meaning: '분주비 가중치 +4' },
      { bit: 1, name: 'ADPS1', isSet: Boolean(val & 0x02), meaning: '분주비 가중치 +2' },
      { bit: 0, name: 'ADPS0', isSet: Boolean(val & 0x01), meaning: '분주비 가중치 +1' }
    ];

    const summary = aden
      ? `ADC 활성화됨 (분주비: 1/${prescalerVal}, ${adsc ? '변환 진행 중' : adif ? '변환 완료됨' : '대기 상태'})`
      : 'ADC 모듈 비활성화 상태';

    return {
      category: 'adc',
      summary,
      severity: 'info',
      bits
    };
  }

  // 6. SPSR / SPCR (SPI Status / Control)
  if (normName === 'SPSR') {
    const spif = Boolean(val & 0x80);
    const wcol = Boolean(val & 0x40);
    const spi2x = Boolean(val & 0x01);

    const bits: DecodedBit[] = [
      { bit: 7, name: 'SPIF', isSet: spif, meaning: 'SPI 인터럽트 플래그 / 전송 완료' },
      { bit: 6, name: 'WCOL', isSet: wcol, meaning: '쓰기 충돌 오류 (Write Collision Flag)', isError: wcol },
      { bit: 5, name: 'Res', isSet: false, meaning: '예약된 비트' },
      { bit: 4, name: 'Res', isSet: false, meaning: '예약된 비트' },
      { bit: 3, name: 'Res', isSet: false, meaning: '예약된 비트' },
      { bit: 2, name: 'Res', isSet: false, meaning: '예약된 비트' },
      { bit: 1, name: 'Res', isSet: false, meaning: '예약된 비트' },
      { bit: 0, name: 'SPI2X', isSet: spi2x, meaning: '2배속 전송 활성화 (Double SPI Speed)' }
    ];

    const summary = wcol
      ? '🚨 SPI 쓰기 충돌(Write Collision) 감지! 데이터 송신 중 SPDR 덮어쓰기 발생'
      : `SPI 상태 정상 (전송완료: ${spif ? 'YES' : 'NO'}, 2배속: ${spi2x ? 'ON' : 'OFF'})`;

    return {
      category: 'spi',
      summary,
      severity: wcol ? 'error' : 'info',
      bits,
      errorCodeDetail: wcol ? 'SPDR 버퍼가 비워지기 전에 새로운 바이트를 기록하려 시도했습니다.' : undefined
    };
  }

  // 7. WDTCSR (Watchdog Timer Control)
  if (normName === 'WDTCSR' || normName === 'WDTCR') {
    const wdif = Boolean(val & 0x80);
    const wdie = Boolean(val & 0x40);
    const wdce = Boolean(val & 0x10);
    const wde = Boolean(val & 0x08);

    const bits: DecodedBit[] = [
      { bit: 7, name: 'WDIF', isSet: wdif, meaning: '워치독 인터럽트 플래그' },
      { bit: 6, name: 'WDIE', isSet: wdie, meaning: '워치독 인터럽트 인에이블' },
      { bit: 5, name: 'WDP3', isSet: Boolean(val & 0x20), meaning: '프리스케일러 비트 3' },
      { bit: 4, name: 'WDCE', isSet: wdce, meaning: '워치독 변경 활성화 (Change Enable)' },
      { bit: 3, name: 'WDE', isSet: wde, meaning: '워치독 시스템 리셋 활성화 (System Reset Enable)', isWarning: wde },
      { bit: 2, name: 'WDP2', isSet: Boolean(val & 0x04), meaning: '프리스케일러 비트 2' },
      { bit: 1, name: 'WDP1', isSet: Boolean(val & 0x02), meaning: '프리스케일러 비트 1' },
      { bit: 0, name: 'WDP0', isSet: Boolean(val & 0x01), meaning: '프리스케일러 비트 0' }
    ];

    return {
      category: 'system',
      summary: wde ? '워치독 시스템 리셋 감시자 동작 중 (WDE=1)' : '워치독 비활성화',
      severity: wde ? 'warning' : 'info',
      bits
    };
  }

  // Generic fallback for any other register
  const bits: DecodedBit[] = [];
  for (let b = 7; b >= 0; b--) {
    bits.push({
      bit: b,
      name: `Bit ${b}`,
      isSet: Boolean(val & (1 << b)),
      meaning: (val & (1 << b)) ? '1' : '0'
    });
  }

  return {
    category: 'system',
    summary: `${regName} 레지스터 값: 0x${val.toString(16).toUpperCase().padStart(2, '0')}`,
    severity: 'info',
    bits
  };
};

export const SerialDebugLogParser: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Raw log input text state
  const defaultSample = SAMPLE_LOGS[selectedMCU][0].text;
  const [logText, setLogText] = useState<string>(defaultSample);

  // Filter States
  const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'system' | 'usart' | 'twi' | 'adc' | 'spi'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // Regex Patterns supported
  // Matches expressions like:
  // MCUSR=0x03 or MCUSR: 0x03 or UCSR0A=0x14 or TWSR: 0x20 or SREG=128
  const REGISTER_EXTRACT_REGEX = /\b(MCUSR|UCSR[0-3]A|UCSR[0-3]B|UCSR[0-3]C|TWSR|TWCR|TWDR|SREG|ADCSRA|ADCSRB|ADMUX|SPCR|SPSR|WDTCSR|WDTCR|TIFR[0-5]|TIMSK[0-5]|EIFR|EIMSK|DDR[A-L]|PORT[A-L]|PIN[A-L])\s*[:=]\s*(0x[0-9A-Fa-f]+|\d+)\b/gi;

  // Timestamp extraction regex
  const TIMESTAMP_REGEX = /\[([0-9:.]+)\s*(?:AM|PM)?\]/i;

  // Parse Raw Logs
  const parsedEvents = useMemo(() => {
    const lines = logText.split('\n');
    const events: DecodedRegisterEvent[] = [];

    lines.forEach((line, idx) => {
      // Check timestamp
      const timeMatch = line.match(TIMESTAMP_REGEX);
      const timestamp = timeMatch ? timeMatch[1] : undefined;

      // Find all registers in the line
      let match: RegExpExecArray | null;
      // Reset regex state
      REGISTER_EXTRACT_REGEX.lastIndex = 0;

      while ((match = REGISTER_EXTRACT_REGEX.exec(line)) !== null) {
        const regName = match[1].toUpperCase();
        const rawValStr = match[2];
        const numVal = rawValStr.startsWith('0x') || rawValStr.startsWith('0X')
          ? parseInt(rawValStr, 16)
          : parseInt(rawValStr, 10);

        if (!isNaN(numVal) && numVal >= 0 && numVal <= 255) {
          const decoded = decodeRegisterValue(regName, numVal, selectedMCU);
          events.push({
            id: `evt_${idx}_${match.index}`,
            lineIndex: idx + 1,
            rawLine: line.trim(),
            timestamp,
            registerName: regName,
            rawValueHex: '0x' + numVal.toString(16).toUpperCase().padStart(2, '0'),
            rawValueDec: numVal,
            severity: decoded.severity,
            summary: decoded.summary,
            category: decoded.category,
            bits: decoded.bits,
            errorCodeDetail: decoded.errorCodeDetail
          });
        }
      }
    });

    return events;
  }, [logText, selectedMCU]);

  // Statistics
  const stats = useMemo(() => {
    const errorCount = parsedEvents.filter((e) => e.severity === 'error').length;
    const warnCount = parsedEvents.filter((e) => e.severity === 'warning').length;
    const totalLines = logText.split('\n').filter((l) => l.trim()).length;
    const regCount = parsedEvents.length;

    return { errorCount, warnCount, totalLines, regCount };
  }, [parsedEvents, logText]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return parsedEvents.filter((e) => {
      if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchesReg = e.registerName.toLowerCase().includes(q);
        const matchesSummary = e.summary.toLowerCase().includes(q);
        const matchesRaw = e.rawLine.toLowerCase().includes(q);
        const matchesBits = e.bits.some((b) => b.name.toLowerCase().includes(q) || b.meaning.toLowerCase().includes(q));
        if (!matchesReg && !matchesSummary && !matchesRaw && !matchesBits) return false;
      }
      return true;
    });
  }, [parsedEvents, severityFilter, categoryFilter, searchQuery]);

  // Generate Parsed Diagnostics Report
  const diagnosticsReport = useMemo(() => {
    const lines = [
      `# ========================================================`,
      `# [${currentProfile.name}] 시리얼 디버그 로그 파서 진단 보고서`,
      `# 분석 일시: ${new Date().toLocaleString()}`,
      `# 총 분석 라인: ${stats.totalLines} | 감지된 레지스터: ${stats.regCount} | 에러: ${stats.errorCount} | 경고: ${stats.warnCount}`,
      `# ========================================================`,
      ``
    ];

    if (stats.errorCount > 0) {
      lines.push(`## 🚨 감지된 주요 하드웨어 장애 및 에러:`);
      parsedEvents.filter((e) => e.severity === 'error').forEach((e) => {
        lines.push(`- [Line ${e.lineIndex}] ${e.registerName} (${e.rawValueHex}): ${e.summary}`);
        if (e.errorCodeDetail) lines.push(`  원인/해결: ${e.errorCodeDetail}`);
      });
      lines.push(``);
    }

    lines.push(`## 📋 세부 레지스터 디코딩 로그:`);
    parsedEvents.forEach((e) => {
      const activeBits = e.bits.filter((b) => b.isSet).map((b) => b.name).join(', ') || 'None';
      lines.push(`[Line ${e.lineIndex}] ${e.registerName}=${e.rawValueHex} (비트: ${activeBits}) -> ${e.summary}`);
    });

    return lines.join('\n');
  }, [currentProfile.name, stats, parsedEvents]);

  const handleCopyReport = () => {
    navigator.clipboard.writeText(diagnosticsReport);
    setCopiedReport(true);
    confetti({
      particleCount: 25,
      spread: 60,
      origin: { y: 0.6 }
    });
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleLoadSample = (sampleText: string) => {
    setLogText(sampleText);
    setExpandedEventId(null);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold font-mono">
              <Terminal className="w-3.5 h-3.5" />
              SERIAL DEBUG LOG PARSER
            </span>
            <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
              {currentProfile.name} • USART {currentProfile.usart}ch • TWI/SPI Reg Decoder
            </span>
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-emerald-400" />
            시리얼 디버그 로그 파서 &amp; 상태 레지스터 분석기
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            UART 터미널(Tera Term, PuTTY, Arduino 시리얼 모니터 등)에서 복사한 원시 로그를 붙여넣으면,
            정규표현식(Regex) 엔진이 <strong>MCUSR, UCSRnA, TWSR, SREG, ADCSRA</strong> 등의 특수 기능 레지스터(SFR) 값을 자동 검출하여
            하드웨어 에러 코드와 비트별 상태를 즉시 분해하여 진단합니다.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleCopyReport}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-all border border-slate-700"
          >
            {copiedReport ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copiedReport ? '복사 완료' : '진단 보고서 복사'}
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block mb-0.5">분석된 로그 라인</span>
          <span className="text-lg font-bold text-white font-mono">{stats.totalLines} 라인</span>
        </div>
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block mb-0.5">검출된 SFR 레지스터</span>
          <span className="text-lg font-bold text-cyan-400 font-mono">{stats.regCount} 개</span>
        </div>
        <div className={`p-3.5 rounded-xl border ${stats.errorCount > 0 ? 'bg-rose-950/40 border-rose-800/80 text-rose-300' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
          <span className="text-[11px] block mb-0.5 flex items-center gap-1">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
            하드웨어 에러 (Error)
          </span>
          <span className="text-lg font-bold font-mono text-rose-400">{stats.errorCount} 건</span>
        </div>
        <div className={`p-3.5 rounded-xl border ${stats.warnCount > 0 ? 'bg-amber-950/40 border-amber-800/80 text-amber-300' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
          <span className="text-[11px] block mb-0.5 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            상태 경고 (Warning)
          </span>
          <span className="text-lg font-bold font-mono text-amber-400">{stats.warnCount} 건</span>
        </div>
      </div>

      {/* Main Two Columns: Left = Raw Log Input & Presets, Right = Parsed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Raw Serial Log Input (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-400" />
                원시 시리얼 로그 입력 (Raw Log)
              </label>
              <button
                onClick={() => setLogText('')}
                className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
              >
                <RotateCcw className="w-3 h-3" />
                비우기
              </button>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] text-slate-500 font-mono self-center mr-1">샘플:</span>
              {SAMPLE_LOGS[selectedMCU].map((sample, sIdx) => (
                <button
                  key={sIdx}
                  onClick={() => handleLoadSample(sample.text)}
                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 transition"
                  title={sample.desc}
                >
                  {sample.title.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* Log Textarea */}
            <textarea
              value={logText}
              onChange={(e) => setLogText(e.target.value)}
              placeholder="여기에 UART 터미널 출력 로그를 붙여넣으세요 (예: [BOOT] MCUSR=0x03, UCSR0A=0x14)..."
              rows={16}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500 leading-relaxed custom-scrollbar whitespace-pre resize-none"
            />

            <div className="text-[11px] text-slate-500 flex items-center justify-between">
              <span>정규식 패턴: <code className="text-emerald-400 font-mono">REG=0xHEX</code> 또는 <code className="text-emerald-400 font-mono">REG: DEC</code></span>
              <span>{logText.length.toLocaleString()} 글자</span>
            </div>
          </div>
        </div>

        {/* Right Column: Parsed Diagnostics & Bit Explorer (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-cyan-400" />
                  디코딩된 레지스터 목록 ({filteredEvents.length}개)
                </span>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Severity Filter */}
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value as any)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">모든 심각도</option>
                  <option value="error">에러만 (Error)</option>
                  <option value="warning">경고만 (Warning)</option>
                  <option value="info">정보 (Info)</option>
                </select>

                {/* Category Filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as any)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">전체 모듈</option>
                  <option value="system">시스템/리셋</option>
                  <option value="usart">USART 통신</option>
                  <option value="twi">TWI (I2C)</option>
                  <option value="adc">ADC</option>
                  <option value="spi">SPI</option>
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="레지스터명(MCUSR, UCSR0A), 비트명(FE, WDRF), 키워드 검색..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Event List */}
            {filteredEvents.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                검색 조건과 일치하는 레지스터 로그가 없습니다.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                {filteredEvents.map((evt) => {
                  const isExpanded = expandedEventId === evt.id;

                  let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
                  let icon = <Info className="w-4 h-4 text-slate-400" />;

                  if (evt.severity === 'error') {
                    badgeColor = 'bg-rose-950/80 text-rose-300 border-rose-800';
                    icon = <AlertOctagon className="w-4 h-4 text-rose-400" />;
                  } else if (evt.severity === 'warning') {
                    badgeColor = 'bg-amber-950/80 text-amber-300 border-amber-800';
                    icon = <AlertTriangle className="w-4 h-4 text-amber-400" />;
                  } else if (evt.severity === 'success') {
                    badgeColor = 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
                    icon = <CheckCircle className="w-4 h-4 text-emerald-400" />;
                  }

                  return (
                    <div
                      key={evt.id}
                      className={`rounded-xl border transition-all ${
                        evt.severity === 'error'
                          ? 'border-rose-900/60 bg-rose-950/20'
                          : evt.severity === 'warning'
                          ? 'border-amber-900/60 bg-amber-950/20'
                          : 'border-slate-800 bg-slate-900/60'
                      }`}
                    >
                      {/* Card Header Bar */}
                      <div
                        onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                        className="p-3 cursor-pointer flex items-center justify-between gap-3 hover:bg-slate-900/80 rounded-xl transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {icon}
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white font-mono text-xs">
                              {evt.registerName}
                            </span>
                            <span className="font-mono text-xs text-cyan-400 font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                              {evt.rawValueHex}
                            </span>
                          </div>

                          <span className="text-[10px] text-slate-500 font-mono">
                            Line {evt.lineIndex}
                          </span>

                          <span className="text-xs text-slate-300 truncate hidden sm:inline">
                            {evt.summary}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-semibold ${badgeColor}`}>
                            {evt.category.toUpperCase()}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {/* Expanded Bit Details */}
                      {isExpanded && (
                        <div className="p-4 pt-1 border-t border-slate-800/80 space-y-3 text-xs bg-slate-950/50 rounded-b-xl">
                          {/* Raw Log Quote */}
                          <div className="text-[11px] font-mono text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800 overflow-x-auto">
                            <span className="text-slate-600 block text-[10px]">원시 로그 라인:</span>
                            {evt.rawLine}
                          </div>

                          {/* Error Detail Message if present */}
                          {evt.errorCodeDetail && (
                            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2">
                              <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <strong className="block font-semibold">장애 원인 및 권장 조치사항:</strong>
                                <span>{evt.errorCodeDetail}</span>
                              </div>
                            </div>
                          )}

                          {/* 8-Bit Breakdown Table */}
                          <div>
                            <span className="text-slate-400 text-[11px] font-bold block mb-1.5">
                              8비트 레지스터 상세 분해 (Bitwise Breakdown):
                            </span>
                            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 text-center font-mono">
                              {evt.bits.map((b) => (
                                <div
                                  key={b.bit}
                                  className={`p-2 rounded-lg border transition ${
                                    b.isSet
                                      ? b.isError
                                        ? 'bg-rose-950/80 border-rose-600 text-rose-200'
                                        : b.isWarning
                                        ? 'bg-amber-950/80 border-amber-600 text-amber-200'
                                        : 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                                      : 'bg-slate-900 border-slate-800 text-slate-600'
                                  }`}
                                  title={`${b.name} (Bit ${b.bit}): ${b.meaning}`}
                                >
                                  <span className="text-[10px] text-slate-400 block font-bold">
                                    b{b.bit}
                                  </span>
                                  <span className="text-xs font-bold block truncate">
                                    {b.name}
                                  </span>
                                  <span className="text-[11px] font-bold">
                                    {b.isSet ? '1' : '0'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Active Flags Descriptions */}
                          <div className="space-y-1 pt-1">
                            {evt.bits
                              .filter((b) => b.isSet)
                              .map((b) => (
                                <div key={b.bit} className="flex items-start gap-2 text-[11px]">
                                  <span className={`font-mono font-bold px-1.5 py-0.2 rounded text-[10px] ${
                                    b.isError ? 'bg-rose-950 text-rose-300' : 'bg-slate-800 text-cyan-300'
                                  }`}>
                                    {b.name}
                                  </span>
                                  <span className="text-slate-300">{b.meaning}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
