import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Cpu,
  Layers,
  Zap,
  RotateCcw,
  Info,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Radio,
  Share2,
  Check
} from 'lucide-react';

export interface PeripheralItem {
  id: string;
  name: string;
  category: 'spi' | 'i2c' | 'uart' | 'timer_pwm' | 'adc' | 'ext_int' | 'jtag_debug' | 'ext_mem' | 'gpio';
  badgeColor: string;
  description: string;
  pins: {
    pinName: string; // e.g. PB2, PE0, etc.
    functionName: string; // e.g. MOSI, OC1B, RXD0
    direction: 'Input' | 'Output' | 'Bidir' | 'Analog';
    notes?: string;
  }[];
}

interface PeripheralCatalogByMCU {
  [mcu: string]: PeripheralItem[];
}

export const MCU_PERIPHERALS: PeripheralCatalogByMCU = {
  atmega328p: [
    {
      id: 'spi_master',
      name: 'SPI Master (HW SPI)',
      category: 'spi',
      badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
      description: '고속 직렬 전송 인터페이스 (Flash, SD카드, 센서 통신)',
      pins: [
        { pinName: 'PB2', functionName: 'SS (Slave Select / Output)', direction: 'Output', notes: 'Master 모드 시 출력 권장 (입력 설정 시 Low 시 슬레이브 전환 주의)' },
        { pinName: 'PB3', functionName: 'MOSI (Master Out)', direction: 'Output', notes: 'DDRB3=1 필요' },
        { pinName: 'PB4', functionName: 'MISO (Master In)', direction: 'Input', notes: '풀업 또는 플로팅' },
        { pinName: 'PB5', functionName: 'SCK (SPI Clock)', direction: 'Output', notes: 'Arduino D13 (내장 LED와 연결됨)' }
      ]
    },
    {
      id: 'i2c_twi',
      name: 'I2C / TWI Bus',
      category: 'i2c',
      badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
      description: '2-Wire 시리얼 통신 버스 (4.7kΩ 풀업 저항 필수)',
      pins: [
        { pinName: 'PC4', functionName: 'SDA (Serial Data)', direction: 'Bidir', notes: 'Open-drain 드라이버로 제어됨' },
        { pinName: 'PC5', functionName: 'SCL (Serial Clock)', direction: 'Bidir', notes: 'I2C Master 클럭' }
      ]
    },
    {
      id: 'usart0',
      name: 'USART0 (Serial 0)',
      category: 'uart',
      badgeColor: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
      description: '부트로더 및 USB-UART 시리얼 모니터 기본 포트',
      pins: [
        { pinName: 'PD0', functionName: 'RXD0 (UART Receive)', direction: 'Input', notes: 'D0 핀 (외부 연결 시 시리얼 업로드 방해 주의)' },
        { pinName: 'PD1', functionName: 'TXD0 (UART Transmit)', direction: 'Output', notes: 'D1 핀 (PC 직렬 통신 출력)' }
      ]
    },
    {
      id: 'timer0_pwm',
      name: 'Timer0 PWM (8-bit Fast/Phase)',
      category: 'timer_pwm',
      badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
      description: 'Arduino millis() 기본 타이머 및 OC0A/OC0B PWM 출력',
      pins: [
        { pinName: 'PD6', functionName: 'OC0A (Timer0 PWM A)', direction: 'Output', notes: 'Arduino D6 (PWM)' },
        { pinName: 'PD5', functionName: 'OC0B (Timer0 PWM B)', direction: 'Output', notes: 'Arduino D5 (PWM)' }
      ]
    },
    {
      id: 'timer1_pwm',
      name: 'Timer1 PWM (16-bit High-Res)',
      category: 'timer_pwm',
      badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
      description: '16비트 서보 모터, 정밀 모터 제어 PWM',
      pins: [
        { pinName: 'PB1', functionName: 'OC1A (Timer1 PWM A)', direction: 'Output', notes: 'Arduino D9 (PWM)' },
        { pinName: 'PB2', functionName: 'OC1B (Timer1 PWM B)', direction: 'Output', notes: 'Arduino D10 (PWM) - SPI SS와 핀 충돌' }
      ]
    },
    {
      id: 'timer2_pwm',
      name: 'Timer2 PWM (8-bit Async)',
      category: 'timer_pwm',
      badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
      description: 'RTC 지원 비동기 8비트 타이머/PWM',
      pins: [
        { pinName: 'PB3', functionName: 'OC2A (Timer2 PWM A)', direction: 'Output', notes: 'Arduino D11 (PWM) - SPI MOSI와 핀 충돌' },
        { pinName: 'PD3', functionName: 'OC2B (Timer2 PWM B)', direction: 'Output', notes: 'Arduino D3 (PWM)' }
      ]
    },
    {
      id: 'adc_channels',
      name: 'ADC Channels (Analog 0~5)',
      category: 'adc',
      badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
      description: '10비트 SAR 아날로그-디지털 컨버터',
      pins: [
        { pinName: 'PC0', functionName: 'ADC0 (Analog Input 0)', direction: 'Analog' },
        { pinName: 'PC1', functionName: 'ADC1 (Analog Input 1)', direction: 'Analog' },
        { pinName: 'PC2', functionName: 'ADC2 (Analog Input 2)', direction: 'Analog' },
        { pinName: 'PC3', functionName: 'ADC3 (Analog Input 3)', direction: 'Analog' },
        { pinName: 'PC4', functionName: 'ADC4 (Analog Input 4)', direction: 'Analog', notes: 'I2C SDA와 핀 충돌' },
        { pinName: 'PC5', functionName: 'ADC5 (Analog Input 5)', direction: 'Analog', notes: 'I2C SCL와 핀 충돌' }
      ]
    },
    {
      id: 'ext_int',
      name: 'External Interrupts (INT0 / INT1)',
      category: 'ext_int',
      badgeColor: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
      description: '하드웨어 우선순위 비동기 외부 인터럽트',
      pins: [
        { pinName: 'PD2', functionName: 'INT0 (Hardware Interrupt 0)', direction: 'Input', notes: 'Arduino D2 (최우선 외부 인터럽트)' },
        { pinName: 'PD3', functionName: 'INT1 (Hardware Interrupt 1)', direction: 'Input', notes: 'Arduino D3 - Timer2 OC2B와 핀 충돌' }
      ]
    },
    {
      id: 'gpio_portb_led',
      name: 'GPIO Fast Blinking (PB5 / Builtin LED)',
      category: 'gpio',
      badgeColor: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
      description: 'PB5 핀을 범용 고속 GPIO 토글 출력으로 사용',
      pins: [
        { pinName: 'PB5', functionName: 'GPIO PB5 (LED Output)', direction: 'Output', notes: 'SPI SCK와 충돌하여 SPI 전송 시 LED가 점멸하거나 클럭 신호 감쇄' }
      ]
    }
  ],

  atmega128: [
    {
      id: 'spi_master',
      name: 'SPI Master (HW SPI)',
      category: 'spi',
      badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
      description: 'Port B 기반 하드웨어 SPI (⚠️ ISP 단자와 분리됨)',
      pins: [
        { pinName: 'PB0', functionName: 'SS (SPI Slave Select)', direction: 'Output' },
        { pinName: 'PB1', functionName: 'SCK (SPI Clock / ISP SCK)', direction: 'Output', notes: 'ISP 클럭 라인 공용' },
        { pinName: 'PB2', functionName: 'MOSI (Master Out)', direction: 'Output', notes: 'ATmega128은 ISP 다운로드 시 MOSI가 아닌 PDI(PE0) 사용' },
        { pinName: 'PB3', functionName: 'MISO (Master In)', direction: 'Input', notes: 'ATmega128은 ISP 다운로드 시 MISO가 아닌 PDO(PE1) 사용' }
      ]
    },
    {
      id: 'isp_flashing',
      name: 'ISP In-System Programming (PDI/PDO)',
      category: 'jtag_debug',
      badgeColor: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
      description: 'ATmega128 고유의 PE0(PDI)/PE1(PDO) 전용 다운로딩 인터페이스',
      pins: [
        { pinName: 'PE0', functionName: 'PDI (ISP Data Input)', direction: 'Input', notes: 'UART0 RXD0과 물리 핀 공유! 시리얼 칩과 직렬 충돌 주의' },
        { pinName: 'PE1', functionName: 'PDO (ISP Data Output)', direction: 'Output', notes: 'UART0 TXD0과 물리 핀 공유! ISP 라이팅 시 전송 충돌' },
        { pinName: 'PB1', functionName: 'SCK (ISP Serial Clock)', direction: 'Input', notes: 'SPI SCK와 공유' }
      ]
    },
    {
      id: 'usart0',
      name: 'USART0 (UART 0)',
      category: 'uart',
      badgeColor: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
      description: 'Port E 시리얼 통신 0 (⚠️ ISP 포트와 중첩)',
      pins: [
        { pinName: 'PE0', functionName: 'RXD0 (UART0 Rx)', direction: 'Input', notes: 'ISP PDI와 핀 충돌 (ISP 라이팅 중 시리얼 신호 간섭 발생)' },
        { pinName: 'PE1', functionName: 'TXD0 (UART0 Tx)', direction: 'Output', notes: 'ISP PDO와 핀 충돌' }
      ]
    },
    {
      id: 'usart1',
      name: 'USART1 (UART 1)',
      category: 'uart',
      badgeColor: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
      description: 'Port D 시리얼 통신 1',
      pins: [
        { pinName: 'PD2', functionName: 'RXD1 (UART1 Rx)', direction: 'Input', notes: '외부 인터럽트 INT2와 핀 충돌' },
        { pinName: 'PD3', functionName: 'TXD1 (UART1 Tx)', direction: 'Output', notes: '외부 인터럽트 INT3 및 Timer4와 핀 충돌' }
      ]
    },
    {
      id: 'i2c_twi',
      name: 'I2C / TWI Bus',
      category: 'i2c',
      badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
      description: '하드웨어 I2C 통신 (PD0/PD1)',
      pins: [
        { pinName: 'PD0', functionName: 'SCL (I2C Clock)', direction: 'Bidir', notes: '외부 인터럽트 INT0과 핀 공유' },
        { pinName: 'PD1', functionName: 'SDA (I2C Data)', direction: 'Bidir', notes: '외부 인터럽트 INT1과 핀 공유' }
      ]
    },
    {
      id: 'timer1_pwm',
      name: 'Timer1 PWM (3 Output Channels)',
      category: 'timer_pwm',
      badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
      description: '16비트 Timer1 Compare 파형 출력 (OC1A/B/C)',
      pins: [
        { pinName: 'PB5', functionName: 'OC1A (Timer1 PWM A)', direction: 'Output' },
        { pinName: 'PB6', functionName: 'OC1B (Timer1 PWM B)', direction: 'Output' },
        { pinName: 'PB7', functionName: 'OC1C (Timer1 PWM C)', direction: 'Output', notes: 'OC0/OC2 출력 옵션과 중복' }
      ]
    },
    {
      id: 'timer3_pwm',
      name: 'Timer3 PWM (OC3A/B/C)',
      category: 'timer_pwm',
      badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
      description: '16비트 Timer3 Compare 파형 출력 (Port E)',
      pins: [
        { pinName: 'PE3', functionName: 'OC3A (Timer3 PWM A)', direction: 'Output', notes: '외부 인터럽트 INT3과 공유' },
        { pinName: 'PE4', functionName: 'OC3B (Timer3 PWM B)', direction: 'Output', notes: '외부 인터럽트 INT4와 공유' },
        { pinName: 'PE5', functionName: 'OC3C (Timer3 PWM C)', direction: 'Output', notes: '외부 인터럽트 INT5와 공유' }
      ]
    },
    {
      id: 'jtag_interface',
      name: 'JTAG Debug Interface (JTAGEN Fuse)',
      category: 'jtag_debug',
      badgeColor: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
      description: '하드웨어 디버깅 및 바운더리 스캔 (PF4~PF7 점유)',
      pins: [
        { pinName: 'PF4', functionName: 'TCK (JTAG Clock)', direction: 'Input', notes: 'ADC4 채널 비활성화' },
        { pinName: 'PF5', functionName: 'TMS (JTAG Mode Select)', direction: 'Input', notes: 'ADC5 채널 비활성화' },
        { pinName: 'PF6', functionName: 'TDO (JTAG Data Output)', direction: 'Output', notes: 'ADC6 채널 비활성화' },
        { pinName: 'PF7', functionName: 'TDI (JTAG Data Input)', direction: 'Input', notes: 'ADC7 채널 비활성화' }
      ]
    },
    {
      id: 'adc_channels',
      name: 'ADC Channels (ADC0~ADC7)',
      category: 'adc',
      badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
      description: '10비트 8채널 아날로그 입력 포트 (Port F)',
      pins: [
        { pinName: 'PF0', functionName: 'ADC0 (Analog In 0)', direction: 'Analog' },
        { pinName: 'PF1', functionName: 'ADC1 (Analog In 1)', direction: 'Analog' },
        { pinName: 'PF2', functionName: 'ADC2 (Analog In 2)', direction: 'Analog' },
        { pinName: 'PF3', functionName: 'ADC3 (Analog Input 3)', direction: 'Analog' },
        { pinName: 'PF4', functionName: 'ADC4 (Analog Input 4)', direction: 'Analog', notes: 'JTAG TCK와 핀 충돌' },
        { pinName: 'PF5', functionName: 'ADC5 (Analog Input 5)', direction: 'Analog', notes: 'JTAG TMS와 핀 충돌' },
        { pinName: 'PF6', functionName: 'ADC6 (Analog Input 6)', direction: 'Analog', notes: 'JTAG TDO와 핀 충돌' },
        { pinName: 'PF7', functionName: 'ADC7 (Analog Input 7)', direction: 'Analog', notes: 'JTAG TDI와 핀 충돌' }
      ]
    },
    {
      id: 'ext_mem_bus',
      name: 'External Memory Interface (XMEM)',
      category: 'ext_mem',
      badgeColor: 'border-teal-500/30 bg-teal-500/10 text-teal-400',
      description: '외부 SRAM 버스 (Port A: AD0~7 멀티플렉스 데이터, Port C: A8~15 주소 버스)',
      pins: [
        { pinName: 'PA0', functionName: 'AD0 (Address/Data 0)', direction: 'Bidir' },
        { pinName: 'PA1', functionName: 'AD1 (Address/Data 1)', direction: 'Bidir' },
        { pinName: 'PA2', functionName: 'AD2 (Address/Data 2)', direction: 'Bidir' },
        { pinName: 'PA3', functionName: 'AD3 (Address/Data 3)', direction: 'Bidir' },
        { pinName: 'PG0', functionName: 'WR (Write Enable)', direction: 'Output' },
        { pinName: 'PG1', functionName: 'RD (Read Enable)', direction: 'Output' },
        { pinName: 'PG2', functionName: 'ALE (Address Latch)', direction: 'Output' }
      ]
    }
  ],

  atmega640: [
    {
      id: 'spi_master',
      name: 'SPI Master (HW SPI)',
      category: 'spi',
      badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
      description: 'Port B 고속 직렬 주변기기 통신',
      pins: [
        { pinName: 'PB0', functionName: 'SS (Slave Select)', direction: 'Output' },
        { pinName: 'PB1', functionName: 'SCK (SPI Clock)', direction: 'Output' },
        { pinName: 'PB2', functionName: 'MOSI (Master Out)', direction: 'Output' },
        { pinName: 'PB3', functionName: 'MISO (Master In)', direction: 'Input' }
      ]
    },
    {
      id: 'usart0',
      name: 'USART0 (Serial 0)',
      category: 'uart',
      badgeColor: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
      description: 'PE0/PE1 USB 시리얼 포트',
      pins: [
        { pinName: 'PE0', functionName: 'RXD0 (UART0 Rx)', direction: 'Input' },
        { pinName: 'PE1', functionName: 'TXD0 (UART0 Tx)', direction: 'Output' }
      ]
    },
    {
      id: 'usart1',
      name: 'USART1 (Serial 1)',
      category: 'uart',
      badgeColor: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
      description: 'PD2/PD3 하드웨어 시리얼 1',
      pins: [
        { pinName: 'PD2', functionName: 'RXD1 (UART1 Rx)', direction: 'Input' },
        { pinName: 'PD3', functionName: 'TXD1 (UART1 Tx)', direction: 'Output' }
      ]
    },
    {
      id: 'usart2',
      name: 'USART2 (Serial 2)',
      category: 'uart',
      badgeColor: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
      description: 'PH0/PH1 하드웨어 시리얼 2',
      pins: [
        { pinName: 'PH0', functionName: 'RXD2 (UART2 Rx)', direction: 'Input' },
        { pinName: 'PH1', functionName: 'TXD2 (UART2 Tx)', direction: 'Output' }
      ]
    },
    {
      id: 'usart3',
      name: 'USART3 (Serial 3)',
      category: 'uart',
      badgeColor: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
      description: 'PJ0/PJ1 하드웨어 시리얼 3',
      pins: [
        { pinName: 'PJ0', functionName: 'RXD3 (UART3 Rx)', direction: 'Input' },
        { pinName: 'PJ1', functionName: 'TXD3 (UART3 Tx)', direction: 'Output' }
      ]
    },
    {
      id: 'i2c_twi',
      name: 'I2C / TWI Bus',
      category: 'i2c',
      badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
      description: '하드웨어 I2C 통신 (PD0/PD1)',
      pins: [
        { pinName: 'PD0', functionName: 'SCL (I2C Clock)', direction: 'Bidir', notes: 'INT0 외부 인터럽트와 핀 공유' },
        { pinName: 'PD1', functionName: 'SDA (I2C Data)', direction: 'Bidir', notes: 'INT1 외부 인터럽트와 핀 공유' }
      ]
    },
    {
      id: 'timer0_pwm',
      name: 'Timer0 PWM (OC0A / OC0B)',
      category: 'timer_pwm',
      badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
      description: '8비트 Timer0 파형 출력 (PB4/PB7)',
      pins: [
        { pinName: 'PB4', functionName: 'OC0A (Timer0 PWM A)', direction: 'Output', notes: 'SPI MISO/MOSI와 인접 핀' },
        { pinName: 'PB7', functionName: 'OC0B (Timer0 PWM B)', direction: 'Output', notes: 'OC1C와 핀 공유' }
      ]
    },
    {
      id: 'timer1_pwm',
      name: 'Timer1 PWM (OC1A / OC1B / OC1C)',
      category: 'timer_pwm',
      badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
      description: '16비트 정밀 Timer1 파형 출력 (PB5/PB6/PB7)',
      pins: [
        { pinName: 'PB5', functionName: 'OC1A (Timer1 PWM A)', direction: 'Output' },
        { pinName: 'PB6', functionName: 'OC1B (Timer1 PWM B)', direction: 'Output' },
        { pinName: 'PB7', functionName: 'OC1C (Timer1 PWM C)', direction: 'Output', notes: 'OC0B와 핀 공유' }
      ]
    },
    {
      id: 'timer2_pwm',
      name: 'Timer2 PWM (OC2A / OC2B)',
      category: 'timer_pwm',
      badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
      description: '8비트 비동기 Timer2 파형 출력 (PB4/PH6)',
      pins: [
        { pinName: 'PB4', functionName: 'OC2A (Timer2 PWM A)', direction: 'Output', notes: 'OC0A와 핀 공유' },
        { pinName: 'PH6', functionName: 'OC2B (Timer2 PWM B)', direction: 'Output' }
      ]
    },
    {
      id: 'jtag_interface',
      name: 'JTAG Debug Interface (JTAGEN Fuse)',
      category: 'jtag_debug',
      badgeColor: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
      description: '하드웨어 온칩 디버거 (PF4~PF7)',
      pins: [
        { pinName: 'PF4', functionName: 'TCK (JTAG Clock)', direction: 'Input', notes: 'ADC4 채널 비활성화' },
        { pinName: 'PF5', functionName: 'TMS (JTAG Mode)', direction: 'Input', notes: 'ADC5 채널 비활성화' },
        { pinName: 'PF6', functionName: 'TDO (JTAG Data Out)', direction: 'Output', notes: 'ADC6 채널 비활성화' },
        { pinName: 'PF7', functionName: 'TDI (JTAG Data In)', direction: 'Input', notes: 'ADC7 채널 비활성화' }
      ]
    },
    {
      id: 'adc_group1',
      name: 'ADC Channels 0~7 (Port F)',
      category: 'adc',
      badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
      description: '10비트 SAR ADC 입력 채널 0~7 (JTAG과 공유)',
      pins: [
        { pinName: 'PF0', functionName: 'ADC0', direction: 'Analog' },
        { pinName: 'PF1', functionName: 'ADC1', direction: 'Analog' },
        { pinName: 'PF2', functionName: 'ADC2', direction: 'Analog' },
        { pinName: 'PF3', functionName: 'ADC3', direction: 'Analog' },
        { pinName: 'PF4', functionName: 'ADC4', direction: 'Analog', notes: 'JTAG TCK와 핀 충돌' },
        { pinName: 'PF5', functionName: 'ADC5', direction: 'Analog', notes: 'JTAG TMS와 핀 충돌' },
        { pinName: 'PF6', functionName: 'ADC6', direction: 'Analog', notes: 'JTAG TDO와 핀 충돌' },
        { pinName: 'PF7', functionName: 'ADC7', direction: 'Analog', notes: 'JTAG TDI와 핀 충돌' }
      ]
    },
    {
      id: 'ext_mem_xmem',
      name: 'External Memory (XMEM Bus)',
      category: 'ext_mem',
      badgeColor: 'border-teal-500/30 bg-teal-500/10 text-teal-400',
      description: 'Port A(AD0~7) & Port C(A8~15) 외부 메모리 확장 버스',
      pins: [
        { pinName: 'PA0', functionName: 'AD0', direction: 'Bidir' },
        { pinName: 'PA1', functionName: 'AD1', direction: 'Bidir' },
        { pinName: 'PA2', functionName: 'AD2', direction: 'Bidir' },
        { pinName: 'PA3', functionName: 'AD3', direction: 'Bidir' },
        { pinName: 'PC0', functionName: 'A8', direction: 'Output' },
        { pinName: 'PC1', functionName: 'A9', direction: 'Output' }
      ]
    }
  ]
};

// ATmega2560 shares 100% pin-compatible 100-pin TQFP pinout and peripherals with ATmega640
MCU_PERIPHERALS.atmega2560 = MCU_PERIPHERALS.atmega640;

// Preset configurations for user convenience
interface ConflictPreset {
  id: string;
  name: string;
  description: string;
  targetMCU: SupportedMCU;
  enabledPeripherals: string[];
}

export const CONFLICT_PRESETS: ConflictPreset[] = [
  {
    id: 'mega2560_spi_pwm_usart',
    name: 'Arduino Mega 2560: SPI (D50~53) + 4채널 멀티 USART + 고밀도 Timer PWM 동시 구동',
    description: 'PB0~PB3 (SPI SS/SCK/MOSI/MISO) 및 PB4/PB7 (Timer0/1 PWM OC0A/OC1C) 핀 충돌과 JTAG/ADC PF4~7 경합 상태를 종합 검사합니다.',
    targetMCU: 'atmega2560',
    enabledPeripherals: ['spi_master', 'usart0', 'usart1', 'usart2', 'timer0_pwm', 'timer1_pwm', 'jtag_interface', 'adc_group1']
  },
  {
    id: 'uno_spi_timer',
    name: 'Arduino Uno: SPI Master + Timer1 & Timer2 PWM 동시 활성화 (고전적 핀 충돌)',
    description: 'PB2(SS vs OC1B) 및 PB3(MOSI vs OC2A)에서 타이머 PWM 출력과 SPI 전송이 충돌합니다.',
    targetMCU: 'atmega328p',
    enabledPeripherals: ['spi_master', 'timer1_pwm', 'timer2_pwm']
  },
  {
    id: 'uno_i2c_adc',
    name: 'Arduino Uno: I2C 센서 버스 + 6채널 전체 ADC 스캔',
    description: 'PC4(SDA vs ADC4)와 PC5(SCL vs ADC5)가 겹쳐서 I2C 통신 중 아날로그 센서 측정이 불가능해집니다.',
    targetMCU: 'atmega328p',
    enabledPeripherals: ['i2c_twi', 'adc_channels']
  },
  {
    id: 'uno_spi_gpio_led',
    name: 'Arduino Uno: 고속 SPI 버스 통신 + D13 LED 고속 토글 GPIO',
    description: 'PB5 핀에 SPI SCK 클럭과 LED 제어 GPIO가 중첩되어 통신 클럭 파형 왜곡 발생.',
    targetMCU: 'atmega328p',
    enabledPeripherals: ['spi_master', 'gpio_portb_led']
  },
  {
    id: 'm128_isp_uart',
    name: 'ATmega128: ISP 프로그래밍 라인 + USART0(시리얼 디버그) 결합',
    description: 'ATmega128 고유의 특성: PE0(PDI vs RXD0) 및 PE1(PDO vs TXD0)이 공유되어 ISP 퓨징/다운로딩 중 시리얼 간섭 발생!',
    targetMCU: 'atmega128',
    enabledPeripherals: ['isp_flashing', 'usart0']
  },
  {
    id: 'm128_jtag_adc',
    name: 'ATmega128: JTAG 하드웨어 디버거 + ADC 8채널 풀스캔',
    description: 'PF4~PF7(TCK, TMS, TDO, TDI)이 JTAGEN 퓨즈로 점유되어 ADC4~ADC7 아날로그 전압 측정 불가.',
    targetMCU: 'atmega128',
    enabledPeripherals: ['jtag_interface', 'adc_channels']
  },
  {
    id: 'm640_multi_usart_pwm',
    name: 'ATmega640: 다채널 타이머 PWM(Timer0/1) + SPI 버스 동시 구동',
    description: 'PB4(OC0A vs OC2A) 및 PB7(OC0B vs OC1C)에서 타이머 비교 출력 채널이 상호 배타적으로 충돌합니다.',
    targetMCU: 'atmega640',
    enabledPeripherals: ['spi_master', 'timer0_pwm', 'timer1_pwm', 'timer2_pwm']
  }
];

interface PinMultiplexingConflictCheckerProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
  onNavigateToPin?: (pinName: string) => void;
}

export const PinMultiplexingConflictChecker: React.FC<PinMultiplexingConflictCheckerProps> = ({
  selectedMCU,
  onSelectMCU,
  onNavigateToPin
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const catalog = MCU_PERIPHERALS[selectedMCU] || MCU_PERIPHERALS.atmega328p;

  // Selected enabled peripherals
  const [enabledIds, setEnabledIds] = useState<string[]>(() => {
    if (selectedMCU === 'atmega328p') {
      return ['spi_master', 'timer1_pwm'];
    } else if (selectedMCU === 'atmega128') {
      return ['isp_flashing', 'usart0'];
    } else {
      return ['spi_master', 'timer0_pwm', 'timer1_pwm'];
    }
  });

  // When MCU changes, make sure enabled IDs belong to current MCU
  React.useEffect(() => {
    const validIds = catalog.map((p) => p.id);
    setEnabledIds((prev) => {
      const filtered = prev.filter((id) => validIds.includes(id));
      if (filtered.length === 0) {
        return validIds.slice(0, 2);
      }
      return filtered;
    });
  }, [selectedMCU, catalog]);

  // Toggle peripheral
  const togglePeripheral = (id: string) => {
    setEnabledIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setEnabledIds(catalog.map((c) => c.id));
  };

  const clearAll = () => {
    setEnabledIds([]);
  };

  const applyPreset = (preset: ConflictPreset) => {
    if (preset.targetMCU !== selectedMCU && onSelectMCU) {
      onSelectMCU(preset.targetMCU);
    }
    setEnabledIds(preset.enabledPeripherals);
  };

  // Analyze conflicts by pin
  const conflictAnalysis = useMemo(() => {
    const pinUsageMap: Record<
      string,
      {
        pinName: string;
        physicalPin?: number | string;
        functions: {
          peripheralId: string;
          peripheralName: string;
          functionName: string;
          direction: string;
          notes?: string;
        }[];
      }
    > = {};

    // Find physical pin from current profile
    const findPhysicalPin = (pName: string) => {
      for (const port of Object.values(currentProfile.ports)) {
        for (const pinDef of port.pins) {
          if (pinDef.pin === pName) {
            return pinDef.physicalPin;
          }
        }
      }
      return undefined;
    };

    // Populate usage
    enabledIds.forEach((pId) => {
      const p = catalog.find((c) => c.id === pId);
      if (!p) return;

      p.pins.forEach((pinReq) => {
        if (!pinUsageMap[pinReq.pinName]) {
          pinUsageMap[pinReq.pinName] = {
            pinName: pinReq.pinName,
            physicalPin: findPhysicalPin(pinReq.pinName),
            functions: []
          };
        }
        pinUsageMap[pinReq.pinName].functions.push({
          peripheralId: p.id,
          peripheralName: p.name,
          functionName: pinReq.functionName,
          direction: pinReq.direction,
          notes: pinReq.notes
        });
      });
    });

    const conflicts: {
      pinName: string;
      physicalPin?: number | string;
      functions: {
        peripheralId: string;
        peripheralName: string;
        functionName: string;
        direction: string;
        notes?: string;
      }[];
      severity: 'critical' | 'warning' | 'info';
      reason: string;
      solution: string;
    }[] = [];

    const safePins: {
      pinName: string;
      physicalPin?: number | string;
      functions: {
        peripheralId: string;
        peripheralName: string;
        functionName: string;
        direction: string;
        notes?: string;
      }[];
    }[] = [];

    Object.values(pinUsageMap).forEach((item) => {
      if (item.functions.length > 1) {
        // Evaluate conflict severity & specific domain message
        let severity: 'critical' | 'warning' | 'info' = 'critical';
        let reason = `${item.functions.length}개의 주변장치가 동일 물리 핀 (${item.pinName})을 서로 다른 용도로 동시 점유하려 합니다.`;
        let solution = '주변장치 중 하나의 핀 매핑을 다른 타이머/채널로 변경하거나 소프트웨어 I/O로 분리하세요.';

        // Specific well-known AVR conflict knowledge base
        const fnNames = item.functions.map((f) => f.functionName.toUpperCase()).join(' / ');
        const periphNames = item.functions.map((f) => f.peripheralName).join(' vs ');

        if (item.pinName === 'PB2' && fnNames.includes('SS') && fnNames.includes('OC1B')) {
          severity = 'critical';
          reason = 'SPI Master의 SS(Slave Select) 핀과 Timer1의 Compare B(OC1B) 정밀 PWM 출력이 충돌합니다.';
          solution = 'SPI 통신 중 SS 핀이 Low로 떨어지면 AVR SPI Master 하드웨어가 자동으로 Slave 모드로 강제 강등됩니다. Timer1 OC1B 출력을 사용해야 한다면 SPI의 SS 핀을 일반 GPIO 출력으로 고정하거나 소프트웨어 SS 핀을 채택하세요.';
        } else if (item.pinName === 'PB3' && fnNames.includes('MOSI') && fnNames.includes('OC2A')) {
          severity = 'critical';
          reason = 'SPI 직렬 송신 데이터 라인(MOSI)과 Timer2 8비트 PWM 출력(OC2A)이 동일 물리 라인을 점유합니다.';
          solution = '하드웨어 SPI 통신 중에는 MOSI 핀의 제어권이 SPI 시프트 레지스터로 넘어가므로 타이머 PWM 구동이 불가능합니다. PWM은 Timer0 또는 Timer1의 여유 채널(OC1A 등)로 재배치하십시오.';
        } else if (item.pinName === 'PB5' && fnNames.includes('SCK') && fnNames.includes('LED')) {
          severity = 'warning';
          reason = 'SPI Serial Clock(SCK) 핀에 아두이노 온보드 LED 및 범용 GPIO 토글 신호가 연결되어 있습니다.';
          solution = 'SPI 고속 통신 시 온보드 LED가 고속 점멸하여 소비전력이 증가하거나, 보드 내부 풀다운 저항/LED 버퍼로 인해 SPI 신호 상승 시간이 지연(Rise Time Degradation)될 수 있습니다.';
        } else if ((item.pinName === 'PC4' || item.pinName === 'PC5') && fnNames.includes('ADC') && (fnNames.includes('SDA') || fnNames.includes('SCL'))) {
          severity = 'critical';
          reason = `I2C 버스 라인(${fnNames.includes('SDA') ? 'SDA' : 'SCL'})과 ADC 아날로그 입력 채널이 중복 할당되었습니다.`;
          solution = 'I2C 버스는 통신을 위해 4.7kΩ 외부 풀업 저항이 5V/3.3V에 연결되어 있어야 합니다. 이 상태에서 ADC 아날로그 측정을 시도하면 풀업 전압이 측정값에 유입되어 왜곡되며, I2C 통신 자체도 ADC 변환 노이즈로 중단될 수 있습니다. 아날로그 센서는 ADC0~ADC3으로 이동하세요.';
        } else if ((item.pinName === 'PE0' || item.pinName === 'PE1') && (fnNames.includes('PDI') || fnNames.includes('PDO')) && fnNames.includes('UART')) {
          severity = 'critical';
          reason = 'ATmega128 고유 위험: PE0/PE1은 ISP 프로그래밍 데이터 라인(PDI/PDO)이면서 동시의 USART0 시리얼 포트입니다.';
          solution = 'USB-Serial 변환 칩(CH340/FT232)이 TXD0/RXD0 라인에 직결되어 있는 경우, ISP 프로그래머(AVRISP mkII, USBasp)로 플래싱할 때 버스 충돌로 펌웨어 라이팅 실패(Target Device Not Responding)가 발생합니다. 시리얼 라인에 1kΩ 직렬 저항 또는 점퍼 핀을 설계하여 분리해야 합니다.';
        } else if (item.pinName.startsWith('PF') && fnNames.includes('ADC') && (fnNames.includes('JTAG') || fnNames.includes('TCK') || fnNames.includes('TMS') || fnNames.includes('TDO') || fnNames.includes('TDI'))) {
          severity = 'critical';
          reason = 'JTAG 온칩 디버그 인터페이스(PF4~PF7)가 활성화되어 있어 해당 핀들의 10비트 ADC 아날로그 기능이 차단되었습니다.';
          solution = 'JTAGEN 퓨즈 비트가 0(인에이블)으로 설정되어 있으면 포트 F의 핀들이 JTAG 전용 상태로 고정됩니다. ADC4~ADC7 채널을 사용하려면 JTAGEN 퓨즈를 1(디스에이블)로 변경하거나, 프로그램 내에서 MCUCR 레지스터의 JTD 비트를 2회 연속 1로 설정하여 소프트웨어적으로 JTAG을 비활성화해야 합니다.';
        } else if (fnNames.includes('INT') && fnNames.includes('UART')) {
          severity = 'warning';
          reason = `외부 하드웨어 인터럽트 핀과 UART 시리얼 라인이 공유되어 시리얼 데이터 수신 시 불필요한 인터럽트가 폭주할 수 있습니다.`;
          solution = 'UART 수신 시 매 보드레이트 비트 천이마다 외부 인터럽트 루틴(ISR)이 유발될 수 있으므로 전용 UART RXC 인터럽트를 사용하거나 외부 신호 핀을 다른 포트로 이동하세요.';
        }

        conflicts.push({
          pinName: item.pinName,
          physicalPin: item.physicalPin,
          functions: item.functions,
          severity,
          reason,
          solution
        });
      } else {
        safePins.push(item);
      }
    });

    return {
      conflicts,
      safePins,
      totalAssignedPins: Object.keys(pinUsageMap).length
    };
  }, [enabledIds, catalog, currentProfile]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Title & Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold mb-2">
            <ShieldAlert className="w-3.5 h-3.5" /> Hardware Pin Multiplexing & Conflict Checker
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            핀 멀티플렉싱 하드웨어 충돌 검사기 (Pin Conflict Analyzer)
          </h3>
          <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            동일한 물리 I/O 핀에 복수의 주변장치(SPI vs Timer PWM vs ADC vs UART vs JTAG)를 동시 활성화할 때 발생하는
            하드웨어 신호 경합(Signal Contention), 버스 충돌, 퓨즈 제약 사항을 사전에 진단하고 회로 해결 방안을 제안합니다.
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 px-4 py-3 rounded-xl shrink-0">
          {conflictAnalysis.conflicts.length > 0 ? (
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
              <div>
                <div className="text-xs font-bold font-mono">
                  {conflictAnalysis.conflicts.length}개 물리 핀 충돌 감지!
                </div>
                <div className="text-[11px] text-slate-400">즉각적인 회로/핀 재배치 권장</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
              <div>
                <div className="text-xs font-bold font-mono">핀 충돌 없음 (Conflict Free)</div>
                <div className="text-[11px] text-slate-400">
                  {conflictAnalysis.safePins.length}개 핀 정상 할당됨
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Presets Bar */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> 실무 핀 충돌 시나리오 프리셋 (Click to Simulate)
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            실제 현장 빈출 충돌 케이스 즉시 재현
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {CONFLICT_PRESETS.map((preset) => {
            const isMatchMCU = preset.targetMCU === selectedMCU;
            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={`text-left p-2.5 rounded-lg border text-xs transition-all flex flex-col justify-between ${
                  isMatchMCU
                    ? 'bg-slate-900 border-slate-700 hover:border-amber-500/50 hover:bg-slate-850'
                    : 'bg-slate-950/40 border-slate-800/60 opacity-70 hover:opacity-100 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-semibold text-white truncate">{preset.name.split(':')[0]}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">
                      {preset.targetMCU.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {preset.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Peripheral Selection Checklist */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              {currentProfile.name} 사용 예정 하드웨어 주변장치 선택 ({enabledIds.length}/{catalog.length}개 인에이블)
            </h4>
            <p className="text-[11px] text-slate-400">
              프로젝트에서 동시에 사용하려는 주변장치를 체크하세요. 동일 핀에 물려있는 기능이 있으면 아래에 경고가 표시됩니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            >
              모두 선택
            </button>
            <button
              onClick={clearAll}
              className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            >
              초기화
            </button>
          </div>
        </div>

        {/* Peripheral Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {catalog.map((peri) => {
            const isEnabled = enabledIds.includes(peri.id);
            // Check if this peripheral has any conflict
            const hasConflict = conflictAnalysis.conflicts.some((c) =>
              c.functions.some((f) => f.peripheralId === peri.id)
            );

            return (
              <div
                key={peri.id}
                onClick={() => togglePeripheral(peri.id)}
                className={`cursor-pointer p-3 rounded-xl border transition-all select-none relative overflow-hidden ${
                  isEnabled
                    ? hasConflict
                      ? 'bg-rose-950/20 border-rose-500/50 shadow-sm shadow-rose-950'
                      : 'bg-cyan-950/20 border-cyan-500/50 shadow-sm shadow-cyan-950'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 opacity-60 hover:opacity-90'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                        isEnabled
                          ? hasConflict
                            ? 'bg-rose-500 border-rose-400 text-slate-950'
                            : 'bg-cyan-500 border-cyan-400 text-slate-950'
                          : 'border-slate-700 bg-slate-900'
                      }`}
                    >
                      {isEnabled && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-xs font-bold text-white">{peri.name}</span>
                  </div>
                  {hasConflict && isEnabled && (
                    <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 font-bold">
                      <AlertTriangle className="w-2.5 h-2.5" /> 충돌
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 leading-snug mb-2 pl-6">
                  {peri.description}
                </p>

                {/* Pins Used summary */}
                <div className="flex flex-wrap gap-1 pl-6">
                  {peri.pins.map((p) => {
                    const pinHasConflict = conflictAnalysis.conflicts.some((c) => c.pinName === p.pinName);
                    return (
                      <span
                        key={p.pinName}
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          pinHasConflict && isEnabled
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                        title={`${p.functionName} (${p.direction})`}
                      >
                        {p.pinName}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Conflict Results Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            하드웨어 핀 점유 및 충돌 분석 상세 리포트
          </h4>
          <span className="text-xs font-mono text-slate-400">
            총 {conflictAnalysis.totalAssignedPins}개 핀 사용 중 •{' '}
            <strong className="text-rose-400">{conflictAnalysis.conflicts.length}개 충돌</strong>
          </span>
        </div>

        {/* If Conflicts exist */}
        {conflictAnalysis.conflicts.length > 0 ? (
          <div className="grid grid-cols-1 gap-3.5">
            {conflictAnalysis.conflicts.map((conf, idx) => (
              <div
                key={conf.pinName}
                className="bg-rose-950/20 border border-rose-500/40 rounded-xl p-4 shadow-lg space-y-3 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />

                {/* Pin Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-500/20 pb-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center font-mono font-bold text-rose-300 text-sm">
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white font-mono">{conf.pinName}</span>
                        {conf.physicalPin && (
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300">
                            물리 핀: Pin {conf.physicalPin}
                          </span>
                        )}
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-500 text-slate-950 uppercase">
                          {conf.severity === 'critical' ? '치명적 신호 충돌' : '주의 요망 (신호 왜곡)'}
                        </span>
                      </div>
                      <div className="text-xs text-rose-300 font-medium mt-0.5">
                        {conf.reason}
                      </div>
                    </div>
                  </div>

                  {onNavigateToPin && (
                    <button
                      onClick={() => onNavigateToPin(conf.pinName)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-amber-300 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
                    >
                      핀 상세 스펙 보기 <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Conflicting Functions Matrix */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {conf.functions.map((fn, fIdx) => (
                    <div
                      key={fIdx}
                      className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 text-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                          <span className="font-semibold text-white">{fn.peripheralName}</span>
                          <span className="font-mono text-cyan-400 font-bold">{fn.direction}</span>
                        </div>
                        <div className="font-mono font-bold text-amber-300 text-xs mb-1">
                          기능: {fn.functionName}
                        </div>
                        {fn.notes && (
                          <p className="text-[11px] text-slate-400 leading-snug">{fn.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Engineering Solution Recommendation */}
                <div className="bg-slate-950/90 border border-amber-500/30 rounded-lg p-3 text-xs flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-300">엔지니어 권장 해결책 (Hardware Fix): </span>
                    <span className="text-slate-300 leading-relaxed">{conf.solution}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-5 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h5 className="text-sm font-bold text-white">
              현재 활성화된 주변장치 간 물리적 핀 충돌이 없습니다!
            </h5>
            <p className="text-xs text-slate-400 max-w-xl mx-auto">
              선택된 {enabledIds.length}개 주변장치가 각각 고유한 I/O 핀을 할당받아 정상 작동할 수 있습니다.
              배선 및 펌웨어 설계 시 상호 간섭 없이 안전하게 신호 라인을 구성할 수 있습니다.
            </p>
          </div>
        )}

        {/* Safe Assigned Pins Summary Grid */}
        {conflictAnalysis.safePins.length > 0 && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              정상 할당된 안전 핀 목록 ({conflictAnalysis.safePins.length}개 핀)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {conflictAnalysis.safePins.map((item) => (
                <div
                  key={item.pinName}
                  className="bg-slate-900 border border-slate-800/80 rounded-lg p-2 text-xs font-mono"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{item.pinName}</span>
                    {item.physicalPin && (
                      <span className="text-[10px] text-cyan-400">P{item.physicalPin}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-emerald-400 truncate mt-0.5">
                    {item.functions[0]?.functionName}
                  </div>
                  <div className="text-[9px] text-slate-500 truncate">
                    {item.functions[0]?.peripheralName}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Guide Note */}
      <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-400 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            <strong>멀티플렉싱 하드웨어 원리:</strong> AVR 마이크로컨트롤러는 핀 수 제한을 극복하기 위해 하나의 물리 핀에 다중 모듈(GPIO/타이머/통신/ADC)을 매핑하며, 제어 레지스터(SPCR, TWCR, ADCSRA, TCCR 등) 활성화 비트에 따라 우선순위 오버라이드가 발생합니다.
          </span>
        </div>
      </div>
    </div>
  );
};
