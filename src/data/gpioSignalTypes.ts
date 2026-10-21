import { SupportedMCU } from './pinmapData';

export interface GpioSignalParams {
  mcu: SupportedMCU;
  pinName: string;
  pinPort: string;
  frequencyHz: number;
  dutyCyclePct: number;
  voltageLevel: number; // 5.0 or 3.3 V
  noiseMv: number; // 0 to 500 mV
  jitterNs: number; // 0 to 500 ns
  slewRateVPerUs: number; // 20 to 150 V/µs
  ringingEnabled: boolean;
  sourceMode: 'timer_pwm' | 'gpio_toggle' | 'spi_sck' | 'uart_tx';
  description: string;
}

export const DEFAULT_GPIO_PARAMS: Record<SupportedMCU, GpioSignalParams> = {
  atmega640: {
    mcu: 'atmega640',
    pinName: 'PB5 (OC1A / Pin 19)',
    pinPort: 'PORTB5',
    frequencyHz: 50000, // 50 kHz
    dutyCyclePct: 50,
    voltageLevel: 5.0,
    noiseMv: 65,
    jitterNs: 35,
    slewRateVPerUs: 80,
    ringingEnabled: true,
    sourceMode: 'gpio_toggle',
    description: 'PORTB.5 고속 구형파 토글 (Bare-metal Assembly / Timer1 CTC)'
  },
  atmega128: {
    mcu: 'atmega128',
    pinName: 'PB4 (OC0 / Pin 14)',
    pinPort: 'PORTB4',
    frequencyHz: 25000, // 25 kHz
    dutyCyclePct: 40,
    voltageLevel: 5.0,
    noiseMv: 80,
    jitterNs: 45,
    slewRateVPerUs: 70,
    ringingEnabled: true,
    sourceMode: 'timer_pwm',
    description: 'Timer0 8-bit Fast PWM (모터 드라이버 PWM 출력)'
  },
  atmega328p: {
    mcu: 'atmega328p',
    pinName: 'PB5 (SCK / Arduino D13 LED)',
    pinPort: 'PORTB5',
    frequencyHz: 10000, // 10 kHz
    dutyCyclePct: 50,
    voltageLevel: 5.0,
    noiseMv: 50,
    jitterNs: 28,
    slewRateVPerUs: 90,
    ringingEnabled: true,
    sourceMode: 'gpio_toggle',
    description: 'D13 (PB5) 고속 토글 루프 (PINB = 0x20 하드웨어 토글)'
  },
  atmega2560: {
    mcu: 'atmega2560',
    pinName: 'PB7 (Arduino D13 LED / OC0A / OC1C)',
    pinPort: 'PORTB7',
    frequencyHz: 50000, // 50 kHz
    dutyCyclePct: 50,
    voltageLevel: 5.0,
    noiseMv: 55,
    jitterNs: 30,
    slewRateVPerUs: 85,
    ringingEnabled: true,
    sourceMode: 'timer_pwm',
    description: 'Arduino Mega 2560 빌트인 LED (PB7) & Timer1 Fast PWM 출력'
  }
};
