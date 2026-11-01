import React, { useState, useMemo } from 'react';
import {
  Cpu,
  Clock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Layers,
  Sliders,
  Terminal,
  Activity,
  Gauge,
  Info,
  Radio,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface SpiClockPrescalerCalculatorProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

interface ClockPreset {
  freq: number;
  label: string;
  desc: string;
}

const CLOCK_PRESETS: ClockPreset[] = [
  { freq: 16000000, label: '16.0 MHz', desc: 'Arduino Uno / Mega (기본 5V)' },
  { freq: 8000000, label: '8.0 MHz', desc: '내부 RC / 3.3V Pro Mini' },
  { freq: 20000000, label: '20.0 MHz', desc: 'AVR 정격 최대 클럭 (5V)' },
  { freq: 12000000, label: '12.0 MHz', desc: 'V-USB 표준 크리스탈' },
  { freq: 11059200, label: '11.0592 MHz', desc: 'UART 황금 크리스탈' },
  { freq: 4000000, label: '4.0 MHz', desc: '저전력 크리스탈' },
  { freq: 1000000, label: '1.0 MHz', desc: '공장 기본 (8MHz / CKDIV8)' }
];

interface DevicePreset {
  name: string;
  maxSckHz: number;
  mode: number; // 0, 1, 2, 3
  dord: 'MSB' | 'LSB';
  desc: string;
}

const DEVICE_PRESETS: DevicePreset[] = [
  { name: 'SD 카드 (초기화)', maxSckHz: 400000, mode: 0, dord: 'MSB', desc: 'SD 카드 규격 초기화 단계 (≤ 400 kHz)' },
  { name: 'SD 카드 (정상 통신)', maxSckHz: 25000000, mode: 0, dord: 'MSB', desc: '고속 데이터 읽기/쓰기 (AVR 최대 클럭 활용)' },
  { name: 'W5500 이더넷', maxSckHz: 80000000, mode: 0, dord: 'MSB', desc: '하드웨어 TCP/IP 컨트롤러 (최대 80MHz)' },
  { name: 'NRF24L01+ RF 모듈', maxSckHz: 10000000, mode: 0, dord: 'MSB', desc: '2.4GHz 무선 송수신 (최대 10MHz)' },
  { name: 'MAX7219 LED 매트릭스', maxSckHz: 10000000, mode: 0, dord: 'MSB', desc: '7세그먼트 / 8x8 LED 도트 매트릭스' },
  { name: 'RC522 RFID 리더', maxSckHz: 10000000, mode: 0, dord: 'MSB', desc: '13.56MHz 비접촉식 스마트카드 리더' },
  { name: 'MCP2515 CAN 컨트롤러', maxSckHz: 10000000, mode: 0, dord: 'MSB', desc: '차량용 CAN 버스 인터페이스' },
  { name: 'SSD1306 SPI OLED', maxSckHz: 10000000, mode: 0, dord: 'MSB', desc: '0.96인치 128x64 그래픽 디스플레이' },
  { name: '25LC256 SPI EEPROM', maxSckHz: 20000000, mode: 0, dord: 'MSB', desc: '32KB 고속 SPI 비휘발성 메모리' }
];

interface PrescalerOption {
  divisor: number;
  spi2x: number; // 0 or 1
  spr1: number;  // 0 or 1
  spr0: number;  // 0 or 1
  label: string;
}

const PRESCALER_CONFIGS: PrescalerOption[] = [
  { divisor: 2, spi2x: 1, spr1: 0, spr0: 0, label: 'f_osc / 2 (2x 더블스피드)' },
  { divisor: 4, spi2x: 0, spr1: 0, spr0: 0, label: 'f_osc / 4 (표준 기본값)' },
  { divisor: 8, spi2x: 1, spr1: 0, spr0: 1, label: 'f_osc / 8 (2x 더블스피드)' },
  { divisor: 16, spi2x: 0, spr1: 0, spr0: 1, label: 'f_osc / 16 (표준)' },
  { divisor: 32, spi2x: 1, spr1: 1, spr0: 0, label: 'f_osc / 32 (2x 더블스피드)' },
  { divisor: 64, spi2x: 0, spr1: 1, spr0: 0, label: 'f_osc / 64 (표준)' },
  { divisor: 128, spi2x: 0, spr1: 1, spr0: 1, label: 'f_osc / 128 (최대 분주)' }
];

export const SpiClockPrescalerCalculator: React.FC<SpiClockPrescalerCalculatorProps> = ({
  selectedMCU
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Mode: Master vs Slave
  const [spiRole, setSpiRole] = useState<'master' | 'slave'>('master');

  // System Clock Frequency (Hz)
  const [fosc, setFosc] = useState<number>(16000000);
  const [customFoscMhz, setCustomFoscMhz] = useState<string>('16.0');
  const [isCustomFosc, setIsCustomFosc] = useState<boolean>(false);

  // Target SPI Baud Rate for Master mode (Hz)
  const [targetBaudHz, setTargetBaudHz] = useState<number>(4000000); // 4 MHz default
  const [customBaudKhz, setCustomBaudKhz] = useState<string>('4000.0');
  const [isCustomBaud, setIsCustomBaud] = useState<boolean>(false);

  // External SCK for Slave mode (Hz)
  const [externalSckHz, setExternalSckHz] = useState<number>(2000000); // 2 MHz
  const [customExtSckKhz, setCustomExtSckKhz] = useState<string>('2000.0');

  // Selected Prescaler Divider for Master (defaults to auto best)
  const [userSelectedDivisor, setUserSelectedDivisor] = useState<number | null>(null);

  // SPI Protocol Settings
  const [spiMode, setSpiMode] = useState<number>(0); // 0, 1, 2, 3
  const [dataOrder, setDataOrder] = useState<'MSB' | 'LSB'>('MSB'); // DORD
  const [interruptEnable, setInterruptEnable] = useState<boolean>(false); // SPIE

  // Copy code feedback
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [includeFullExample, setIncludeFullExample] = useState<boolean>(true);

  // Clock preset handler
  const handleSelectClockPreset = (freq: number) => {
    setFosc(freq);
    setCustomFoscMhz((freq / 1000000).toString());
    setIsCustomFosc(false);
  };

  const handleCustomFoscChange = (valStr: string) => {
    setCustomFoscMhz(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 30) {
      setFosc(Math.round(parsed * 1000000));
    }
  };

  // Target Baud preset handler
  const handleSelectBaudPreset = (rate: number) => {
    setTargetBaudHz(rate);
    setCustomBaudKhz((rate / 1000).toString());
    setIsCustomBaud(false);
  };

  const handleCustomBaudChange = (valStr: string) => {
    setCustomBaudKhz(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 20000) {
      setTargetBaudHz(Math.round(parsed * 1000));
    }
  };

  // Device preset selector
  const handleSelectDevicePreset = (device: DevicePreset) => {
    setTargetBaudHz(device.maxSckHz);
    setCustomBaudKhz((device.maxSckHz / 1000).toString());
    setIsCustomBaud(false);
    setSpiMode(device.mode);
    setDataOrder(device.dord);
  };

  // Derive CPOL and CPHA from spiMode
  // Mode 0: CPOL=0, CPHA=0
  // Mode 1: CPOL=0, CPHA=1
  // Mode 2: CPOL=1, CPHA=0
  // Mode 3: CPOL=1, CPHA=1
  const cpol = (spiMode === 2 || spiMode === 3) ? 1 : 0;
  const cpha = (spiMode === 1 || spiMode === 3) ? 1 : 0;

  // Master mode: Calculate results for all 7 prescalers
  const masterCalculations = useMemo(() => {
    return PRESCALER_CONFIGS.map((cfg) => {
      const actualSckHz = fosc / cfg.divisor;
      const actualSckKhz = actualSckHz / 1000;
      const actualSckMhz = actualSckHz / 1000000;
      const errorPercent = ((actualSckHz - targetBaudHz) / targetBaudHz) * 100;
      const bitTimeNs = (1 / actualSckHz) * 1000000000;
      const byteTimeUs = (8 / actualSckHz) * 1000000;

      // Status assessment:
      // In SPI, if actual > target, device might fail if target was device max.
      // If actual <= target, safe!
      const exceedsTarget = actualSckHz > targetBaudHz;
      const diffPercent = Math.abs(errorPercent);

      let status: 'optimal' | 'safe_slow' | 'exceeds' = 'safe_slow';
      let statusDesc = '';

      if (actualSckHz <= targetBaudHz) {
        if (diffPercent <= 25.0 || actualSckHz === fosc / 2) {
          status = 'optimal';
          statusDesc = '최적의 설정 (규격 이내 최대 전송 속도)';
        } else {
          status = 'safe_slow';
          statusDesc = '안전 동작 (목표 속도보다 보수적으로 낮음)';
        }
      } else {
        status = 'exceeds';
        statusDesc = '목표 주파수 초과 (타겟 디바이스 최대 클럭 확인 필요)';
      }

      return {
        ...cfg,
        actualSckHz,
        actualSckKhz,
        actualSckMhz,
        errorPercent,
        bitTimeNs,
        byteTimeUs,
        exceedsTarget,
        status,
        statusDesc
      };
    });
  }, [fosc, targetBaudHz]);

  // Determine optimal divider for target baud
  // Best choice is the highest frequency <= targetBaudHz
  // If all exceed, pick the smallest one (/128)
  const bestDivider = useMemo(() => {
    const underOrEqual = masterCalculations.filter((c) => c.actualSckHz <= targetBaudHz);
    if (underOrEqual.length > 0) {
      // Pick the highest frequency among those under target (smallest divisor)
      underOrEqual.sort((a, b) => b.actualSckHz - a.actualSckHz);
      return underOrEqual[0].divisor;
    }
    // If all exceed, pick the lowest frequency (/128)
    return 128;
  }, [masterCalculations, targetBaudHz]);

  const activeDivisor = userSelectedDivisor !== null ? userSelectedDivisor : bestDivider;
  const activeMasterCalc = masterCalculations.find((c) => c.divisor === activeDivisor) || masterCalculations[0];

  // Slave Mode Calculations
  const slaveCalculations = useMemo(() => {
    const maxSafeSckHz = fosc / 2; // AVR hardware absolute max in slave mode
    const recSafeSckHz = fosc / 4; // Recommended conservative safe limit
    const currentExtRatio = externalSckHz / fosc;
    const isExceeded = externalSckHz > maxSafeSckHz;
    const isWarning = externalSckHz > recSafeSckHz && !isExceeded;

    return {
      maxSafeSckHz,
      maxSafeSckKhz: maxSafeSckHz / 1000,
      recSafeSckHz,
      recSafeSckKhz: recSafeSckHz / 1000,
      currentExtRatio,
      isExceeded,
      isWarning,
      minPulseWidthNs: (2 / fosc) * 1000000000 // t_SCKL, t_SCKH >= 2 CPU cycles
    };
  }, [fosc, externalSckHz]);

  // Register Bitfield Values
  // SPCR: SPIE(7), SPE(6), DORD(5), MSTR(4), CPOL(3), CPHA(2), SPR1(1), SPR0(0)
  // SPSR: SPIF(7), WCOL(6), -(5..1), SPI2X(0)
  const registers = useMemo(() => {
    const spieBit = interruptEnable ? 1 : 0;
    const speBit = 1; // Always enabled in driver
    const dordBit = dataOrder === 'LSB' ? 1 : 0;
    const mstrBit = spiRole === 'master' ? 1 : 0;
    const cpolBit = cpol;
    const cphaBit = cpha;
    const spr1Bit = spiRole === 'master' ? activeMasterCalc.spr1 : 0;
    const spr0Bit = spiRole === 'master' ? activeMasterCalc.spr0 : 0;
    const spi2xBit = spiRole === 'master' ? activeMasterCalc.spi2x : 0;

    const spcrVal =
      (spieBit << 7) |
      (speBit << 6) |
      (dordBit << 5) |
      (mstrBit << 4) |
      (cpolBit << 3) |
      (cphaBit << 2) |
      (spr1Bit << 1) |
      (spr0Bit << 0);

    const spsrVal = spi2xBit << 0;

    return {
      spcr: {
        val: spcrVal,
        hex: '0x' + spcrVal.toString(16).toUpperCase().padStart(2, '0'),
        bin: spcrVal.toString(2).padStart(8, '0'),
        bits: [spieBit, speBit, dordBit, mstrBit, cpolBit, cphaBit, spr1Bit, spr0Bit]
      },
      spsr: {
        val: spsrVal,
        hex: '0x' + spsrVal.toString(16).toUpperCase().padStart(2, '0'),
        bin: spsrVal.toString(2).padStart(8, '0'),
        bits: [0, 0, 0, 0, 0, 0, 0, spi2xBit]
      }
    };
  }, [interruptEnable, dataOrder, spiRole, cpol, cpha, activeMasterCalc]);

  // Target MCU SPI Pin Mapping
  const spiPinInfo = useMemo(() => {
    switch (selectedMCU) {
      case 'atmega328p':
        return {
          port: 'PORTB',
          ddr: 'DDRB',
          pinReg: 'PINB',
          sck: { pin: 'PB5', arduino: 'D13', phys: '19', bit: 'DDB5' },
          miso: { pin: 'PB4', arduino: 'D12', phys: '18', bit: 'DDB4' },
          mosi: { pin: 'PB3', arduino: 'D11', phys: '17', bit: 'DDB3' },
          ss: { pin: 'PB2', arduino: 'D10', phys: '16', bit: 'DDB2' },
          masterDdrCode: 'DDRB |= (1 << DDB3) | (1 << DDB5) | (1 << DDB2); // MOSI, SCK, SS 출력\nDDRB &= ~(1 << DDB4); // MISO 입력',
          slaveDdrCode: 'DDRB |= (1 << DDB4); // MISO 출력\nDDRB &= ~((1 << DDB3) | (1 << DDB5) | (1 << DDB2)); // MOSI, SCK, SS 입력'
        };
      case 'atmega2560':
      case 'atmega640':
        return {
          port: 'PORTB',
          ddr: 'DDRB',
          pinReg: 'PINB',
          sck: { pin: 'PB1', arduino: 'D52', phys: '20', bit: 'DDB1' },
          miso: { pin: 'PB3', arduino: 'D50', phys: '22', bit: 'DDB3' },
          mosi: { pin: 'PB2', arduino: 'D51', phys: '21', bit: 'DDB2' },
          ss: { pin: 'PB0', arduino: 'D53', phys: '19', bit: 'DDB0' },
          masterDdrCode: 'DDRB |= (1 << DDB2) | (1 << DDB1) | (1 << DDB0); // MOSI, SCK, SS 출력\nDDRB &= ~(1 << DDB3); // MISO 입력',
          slaveDdrCode: 'DDRB |= (1 << DDB3); // MISO 출력\nDDRB &= ~((1 << DDB2) | (1 << DDB1) | (1 << DDB0)); // MOSI, SCK, SS 입력'
        };
      case 'atmega128':
        return {
          port: 'PORTB',
          ddr: 'DDRB',
          pinReg: 'PINB',
          sck: { pin: 'PB1', arduino: 'N/A', phys: '11', bit: 'DDB1' },
          miso: { pin: 'PB3', arduino: 'N/A', phys: '13', bit: 'DDB3' },
          mosi: { pin: 'PB2', arduino: 'N/A', phys: '12', bit: 'DDB2' },
          ss: { pin: 'PB0', arduino: 'N/A', phys: '10', bit: 'DDB0' },
          masterDdrCode: 'DDRB |= (1 << DDB2) | (1 << DDB1) | (1 << DDB0); // MOSI, SCK, SS 출력\nDDRB &= ~(1 << DDB3); // MISO 입력',
          slaveDdrCode: 'DDRB |= (1 << DDB3); // MISO 출력\nDDRB &= ~((1 << DDB2) | (1 << DDB1) | (1 << DDB0)); // MOSI, SCK, SS 입력'
        };
      default:
        return {
          port: 'PORTB',
          ddr: 'DDRB',
          pinReg: 'PINB',
          sck: { pin: 'SCK', arduino: 'SCK', phys: '-', bit: 'SCK' },
          miso: { pin: 'MISO', arduino: 'MISO', phys: '-', bit: 'MISO' },
          mosi: { pin: 'MOSI', arduino: 'MOSI', phys: '-', bit: 'MOSI' },
          ss: { pin: 'SS', arduino: 'SS', phys: '-', bit: 'SS' },
          masterDdrCode: '// MOSI, SCK, SS Output, MISO Input',
          slaveDdrCode: '// MISO Output, MOSI, SCK, SS Input'
        };
    }
  }, [selectedMCU]);

  // Generate C Code
  const generatedCode = useMemo(() => {
    const isMaster = spiRole === 'master';
    const clkMhz = (fosc / 1000000).toFixed(4);

    if (!includeFullExample) {
      if (isMaster) {
        return `/* AVR SPI Master 초기화 간략 코드 - ${currentProfile.name}
 * 시스템 클럭: ${clkMhz} MHz | 목표: ${(targetBaudHz / 1000).toFixed(1)} kHz
 * 설정 분주비: ${activeMasterCalc.label} (실제: ${activeMasterCalc.actualSckKhz.toFixed(2)} kHz)
 */
void spi_init_master(void) {
    // 1. GPIO 방향 설정 (MOSI, SCK, SS 출력 / MISO 입력)
    ${spiPinInfo.masterDdrCode}
    
    // 2. SPI 더블 스피드 설정 (SPI2X = ${registers.spsr.bits[7]})
    SPSR = ${registers.spsr.hex};

    // 3. SPI Control Register 설정 (SPCR = ${registers.spcr.hex})
    // SPE=1, MSTR=1, CPOL=${cpol}, CPHA=${cpha}, SPR1=${activeMasterCalc.spr1}, SPR0=${activeMasterCalc.spr0}
    SPCR = ${registers.spcr.hex};
}`;
      } else {
        return `/* AVR SPI Slave 초기화 간략 코드 - ${currentProfile.name}
 * 시스템 클럭: ${clkMhz} MHz (허용 SCK: 최대 ${(slaveCalculations.maxSafeSckKhz).toFixed(1)} kHz)
 */
void spi_init_slave(void) {
    // 1. GPIO 방향 설정 (MISO 출력 / MOSI, SCK, SS 입력)
    ${spiPinInfo.slaveDdrCode}

    // 2. SPI Control Register 설정 (SPCR = ${registers.spcr.hex})
    // SPE=1, MSTR=0, CPOL=${cpol}, CPHA=${cpha}, SPIE=${interruptEnable ? 1 : 0}
    SPCR = ${registers.spcr.hex};
}`;
      }
    }

    if (isMaster) {
      return `/* ===================================================================
 * AVR SPI Master 하드웨어 드라이버 초기화 및 송수신 함수
 * 타겟 MCU : ${currentProfile.name} (${currentProfile.fullName})
 * 시스템 클럭 (F_CPU) : ${clkMhz} MHz (${fosc.toLocaleString()} Hz)
 * 목표 SCK 주파수      : ${(targetBaudHz / 1000).toFixed(1)} kHz
 * 실제 생성 SCK 주파수 : ${activeMasterCalc.actualSckKhz.toFixed(2)} kHz (${activeMasterCalc.actualSckMhz.toFixed(3)} MHz)
 * 설정 분주비          : ${activeMasterCalc.label}
 * SPI 모드             : Mode ${spiMode} (CPOL=${cpol}, CPHA=${cpha})
 * 데이터 전송 순서     : ${dataOrder} First
 * =================================================================== */

#define F_CPU ${fosc}UL
#include <avr/io.h>

/**
 * @brief SPI 마스터 하드웨어 초기화
 */
void spi_init_master(void) {
    // 1. SPI 핀 방향 설정
    // SCK(${spiPinInfo.sck.pin}), MOSI(${spiPinInfo.mosi.pin}), SS(${spiPinInfo.ss.pin}) -> OUTPUT
    // MISO(${spiPinInfo.miso.pin}) -> INPUT
    ${spiPinInfo.masterDdrCode}

    // 중요: SS 핀을 HIGH로 초기화 (마스터 모드가 슬레이브로 강제 강등되는 현상 방지)
    ${spiPinInfo.port} |= (1 << ${spiPinInfo.ss.pin});

    // 2. SPSR (SPI Status Register) 설정
    // SPI2X = ${activeMasterCalc.spi2x} (2배속 클럭 모드 ${activeMasterCalc.spi2x ? '활성화' : '비활성화'})
    SPSR = ${registers.spsr.hex};

    // 3. SPCR (SPI Control Register) 설정
    // [SPIE=${interruptEnable ? 1 : 0}][SPE=1][DORD=${dataOrder === 'LSB' ? 1 : 0}][MSTR=1][CPOL=${cpol}][CPHA=${cpha}][SPR1=${activeMasterCalc.spr1}][SPR0=${activeMasterCalc.spr0}]
    SPCR = ${registers.spcr.hex};
}

/**
 * @brief SPI 1바이트 동시 송수신 (Full-Duplex)
 * @param data 송신할 1바이트 데이터
 * @return 수신된 1바이트 데이터
 */
uint8_t spi_transfer(uint8_t data) {
    // 송신 데이터를 SPDR에 기록 (전송 자동 개시)
    SPDR = data;

    // 전송 완료 플래그(SPIF)가 셋될 때까지 폴링 대기
    while (!(SPSR & (1 << SPIF)));

    // 수신된 1바이트 반환
    return SPDR;
}`;
    } else {
      return `/* ===================================================================
 * AVR SPI Slave 모드 하드웨어 드라이버 초기화 및 인터럽트 루틴
 * 타겟 MCU : ${currentProfile.name} (${currentProfile.fullName})
 * 시스템 클럭 (F_CPU) : ${clkMhz} MHz
 * 최대 허용 외부 SCK   : ${(slaveCalculations.maxSafeSckKhz).toFixed(1)} kHz (F_CPU / 2 절대 한계)
 * 권장 안전 외부 SCK   : ${(slaveCalculations.recSafeSckKhz).toFixed(1)} kHz (F_CPU / 4 안정 권장)
 * SPI 모드             : Mode ${spiMode} (CPOL=${cpol}, CPHA=${cpha})
 * =================================================================== */

#define F_CPU ${fosc}UL
#include <avr/io.h>
#include <avr/interrupt.h>

volatile uint8_t spi_rx_data = 0;
volatile uint8_t spi_data_ready = 0;

/**
 * @brief SPI 슬레이브 모드 초기화
 */
void spi_init_slave(void) {
    // 1. SPI 핀 방향 설정
    // MISO(${spiPinInfo.miso.pin}) -> OUTPUT
    // MOSI(${spiPinInfo.mosi.pin}), SCK(${spiPinInfo.sck.pin}), SS(${spiPinInfo.ss.pin}) -> INPUT
    ${spiPinInfo.slaveDdrCode}

    // 2. SPCR (SPI Control Register) 설정 (MSTR = 0)
    // [SPIE=${interruptEnable ? 1 : 0}][SPE=1][DORD=${dataOrder === 'LSB' ? 1 : 0}][MSTR=0][CPOL=${cpol}][CPHA=${cpha}][SPR1=0][SPR0=0]
    SPCR = ${registers.spcr.hex};

    ${interruptEnable ? '// 글로벌 인터럽트 활성화\n    sei();' : ''}
}

${interruptEnable ? `/**
 * @brief SPI 전송 완료 인터럽트 서비스 루틴 (SPI_STC)
 */
ISR(SPI_STC_vect) {
    // 마스터로부터 수신된 데이터 읽기
    spi_rx_data = SPDR;
    spi_data_ready = 1;

    // 다음 마스터 트랜잭션에 응답할 바이트 미리 버퍼에 로드 (옵션)
    // SPDR = next_response_byte;
}` : `/**
 * @brief 폴링 기반 SPI 슬레이브 1바이트 수신
 */
uint8_t spi_slave_receive(void) {
    // 마스터에 의한 전송 완료 플래그 대기
    while (!(SPSR & (1 << SPIF)));
    return SPDR;
}`}`;
    }
  }, [
    spiRole,
    fosc,
    targetBaudHz,
    activeMasterCalc,
    currentProfile,
    spiMode,
    cpol,
    cpha,
    dataOrder,
    interruptEnable,
    registers,
    spiPinInfo,
    slaveCalculations,
    includeFullExample
  ]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md shadow-2xl space-y-6">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-2">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span>고속 전이중 동기식 직렬 통신</span>
            <span className="text-slate-500">•</span>
            <span className="text-white font-mono">{currentProfile.name} SPI Prescaler Calculator</span>
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            SPI 클럭 프리스케일러 계산기 & SPCR / SPSR 레지스터 분석기
          </h3>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            AVR 하드웨어 SPI 모듈의 마스터(Master) 및 슬레이브(Slave) 모드를 선택하고, 
            시스템 클럭(<span className="text-indigo-300 font-mono">f_osc</span>)과 목표 보레이트에 맞춘 
            <strong className="text-white font-mono"> SPCR (SPR1:0)</strong> 및 
            <strong className="text-white font-mono"> SPSR (SPI2X)</strong> 더블 스피드 분주비 7종을 즉시 분석합니다.
          </p>
        </div>

        {/* Target Hardware Summary Pill */}
        <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 p-3 rounded-xl shrink-0">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">선택된 MCU SPI 하드웨어</div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>{currentProfile.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                {currentProfile.package.split(' ')[0]}
              </span>
            </div>
            <div className="text-[11px] font-mono text-indigo-300">
              SCK: {spiPinInfo.sck.pin} | MOSI: {spiPinInfo.mosi.pin} | MISO: {spiPinInfo.miso.pin}
            </div>
          </div>
        </div>
      </div>

      {/* Role Selection Bar: Master vs Slave */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/80 p-2 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setSpiRole('master')}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
              spiRole === 'master'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>SPI Master (클럭 생성기 & 컨트롤러)</span>
          </button>
          <button
            onClick={() => setSpiRole('slave')}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
              spiRole === 'slave'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-1 ring-purple-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Radio className="w-4 h-4 text-purple-300" />
            <span>SPI Slave (외부 SCK 수신 & SS 제어)</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 font-mono px-3">
          {spiRole === 'master' ? (
            <span className="text-indigo-300">
              ★ MSTR=1 | 내부 클럭 분주 발생 (SPR1:0, SPI2X 활성)
            </span>
          ) : (
            <span className="text-purple-300">
              ★ MSTR=0 | 외부 SCK 동기화 (최대 허용 주파수: F_CPU / 2)
            </span>
          )}
        </div>
      </div>

      {/* Top Controls: System Clock & Target Frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Box 1: System Clock (f_osc / f_CPU) */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-400" /> 1. 시스템 클럭 (f_osc / f_CPU)
            </span>
            <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
              {(fosc / 1000000).toFixed(4)} MHz ({fosc.toLocaleString()} Hz)
            </span>
          </div>

          {/* Quick presets */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
            {CLOCK_PRESETS.map((preset) => {
              const isActive = !isCustomFosc && fosc === preset.freq;
              return (
                <button
                  key={preset.freq}
                  onClick={() => handleSelectClockPreset(preset.freq)}
                  className={`p-2 rounded-lg border text-left transition ${
                    isActive
                      ? 'bg-indigo-500/20 border-indigo-500 text-white font-bold ring-1 ring-indigo-500/50'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-mono">{preset.label}</div>
                  <div className="text-[10px] text-slate-400 truncate">{preset.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Custom clock input */}
          <div className="pt-2 border-t border-slate-800/60 flex items-center gap-3">
            <label className="text-xs text-slate-400 shrink-0 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-slate-400" /> 커스텀 주파수 (MHz):
            </label>
            <div className="relative flex-1">
              <input
                type="number"
                step="0.0001"
                min="0.1"
                max="30"
                value={customFoscMhz}
                onChange={(e) => {
                  setIsCustomFosc(true);
                  handleCustomFoscChange(e.target.value);
                }}
                className={`w-full bg-slate-900 border rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none transition ${
                  isCustomFosc
                    ? 'border-indigo-500 ring-1 ring-indigo-500/40'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
                placeholder="예: 16.0"
              />
              <span className="absolute right-3 top-1.5 text-xs text-slate-500 font-mono">MHz</span>
            </div>
          </div>
        </div>

        {/* Box 2: Target SPI Baud Rate (Master) OR External SCK (Slave) */}
        {spiRole === 'master' ? (
          <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-indigo-400" /> 2. 목표 SPI 통신 속도 (Target SCK)
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {(targetBaudHz / 1000).toFixed(1)} kHz ({(targetBaudHz / 1000000).toFixed(2)} MHz)
              </span>
            </div>

            {/* Quick Speed Presets */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
              {[
                { rate: 8000000, label: '8.0 MHz', desc: '16MHz / 2 (최대)' },
                { rate: 4000000, label: '4.0 MHz', desc: '표준 고속' },
                { rate: 2000000, label: '2.0 MHz', desc: '중속 안정' },
                { rate: 1000000, label: '1.0 MHz', desc: '1.0 MHz 표준' },
                { rate: 500000, label: '500 kHz', desc: '저속 장거리' },
                { rate: 400000, label: '400 kHz', desc: 'SD 카드 Init' },
                { rate: 250000, label: '250 kHz', desc: '16MHz / 64' },
                { rate: 125000, label: '125 kHz', desc: '16MHz / 128' }
              ].map((p) => {
                const isActive = !isCustomBaud && targetBaudHz === p.rate;
                return (
                  <button
                    key={p.rate}
                    onClick={() => handleSelectBaudPreset(p.rate)}
                    className={`p-2 rounded-lg border text-left transition ${
                      isActive
                        ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold ring-1 ring-emerald-500/50'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-mono">{p.label}</div>
                    <div className="text-[10px] text-slate-400 truncate">{p.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Custom speed input */}
            <div className="pt-2 border-t border-slate-800/60 flex items-center gap-3">
              <label className="text-xs text-slate-400 shrink-0 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-slate-400" /> 커스텀 목표 속도 (kHz):
              </label>
              <div className="relative flex-1">
                <input
                  type="number"
                  step="10"
                  min="10"
                  max="20000"
                  value={customBaudKhz}
                  onChange={(e) => {
                    setIsCustomBaud(true);
                    handleCustomBaudChange(e.target.value);
                  }}
                  className={`w-full bg-slate-900 border rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none transition ${
                    isCustomBaud
                      ? 'border-emerald-500 ring-1 ring-emerald-500/40'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                  placeholder="예: 4000"
                />
                <span className="absolute right-3 top-1.5 text-xs text-slate-500 font-mono">kHz</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-purple-400" /> 2. 외부 마스터 SCK 클럭 입력 검증
              </span>
              <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                {(externalSckHz / 1000).toFixed(1)} kHz ({(externalSckHz / 1000000).toFixed(2)} MHz)
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              슬레이브 모드에서는 내부 분주 레지스터(SPR1:0, SPI2X)가 클럭 속도에 관여하지 않으며,
              외부 마스터가 공급하는 SCK를 내부 클럭 동기화 회로로 샘플링합니다.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-500">최대 한계 주파수 (F_CPU / 2)</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {(slaveCalculations.maxSafeSckKhz).toFixed(1)} kHz
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-500">권장 안전 주파수 (F_CPU / 4)</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">
                  {(slaveCalculations.recSafeSckKhz).toFixed(1)} kHz
                </div>
              </div>
            </div>

            {/* Test input */}
            <div className="pt-2 border-t border-slate-800/60 flex items-center gap-3">
              <label className="text-xs text-slate-400 shrink-0">마스터 입력 SCK (kHz):</label>
              <input
                type="number"
                step="100"
                min="10"
                max="20000"
                value={customExtSckKhz}
                onChange={(e) => {
                  setCustomExtSckKhz(e.target.value);
                  const p = parseFloat(e.target.value);
                  if (!isNaN(p) && p > 0) setExternalSckHz(Math.round(p * 1000));
                }}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Target Peripheral Device Quick Selection Bar (Master only) */}
      {spiRole === 'master' && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
              자주 사용되는 SPI 주변 장치 프리셋 원클릭 적용
            </span>
            <span className="text-[11px] text-slate-500">
              클릭 시 장치의 최대 클럭 규격 및 SPI 모드/전송순서가 자동 설정됩니다.
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {DEVICE_PRESETS.map((dev) => (
              <button
                key={dev.name}
                onClick={() => handleSelectDevicePreset(dev)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs transition flex items-center gap-1.5"
                title={dev.desc}
              >
                <span className="font-medium">{dev.name}</span>
                <span className="text-[10px] px-1 rounded bg-slate-800 text-indigo-300 font-mono">
                  {(dev.maxSckHz / 1000000 >= 1) ? `${dev.maxSckHz / 1000000}MHz` : `${dev.maxSckHz / 1000}kHz`}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">M{dev.mode}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Master Mode: 7 Prescaler Divider Comparative Table */}
      {spiRole === 'master' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              AVR 하드웨어 7가지 SPI 클럭 분주비 비교표 (SPR1:0 & SPI2X)
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">
              현재 선택된 분주비: <strong className="text-indigo-300">{activeMasterCalc.label}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400">
                  <th className="p-3">분주비</th>
                  <th className="p-3 text-center">SPI2X</th>
                  <th className="p-3 text-center">SPR1</th>
                  <th className="p-3 text-center">SPR0</th>
                  <th className="p-3 text-right">SCK 주파수</th>
                  <th className="p-3 text-right">목표 대비 오차</th>
                  <th className="p-3 text-right">1바이트 전송시간 (8 SCK)</th>
                  <th className="p-3 text-center">상태 평가</th>
                  <th className="p-3 text-center">선택</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {masterCalculations.map((calc) => {
                  const isSelected = calc.divisor === activeDivisor;
                  const isBest = calc.divisor === bestDivider;

                  return (
                    <tr
                      key={calc.divisor}
                      onClick={() => setUserSelectedDivisor(calc.divisor)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? 'bg-indigo-950/30 font-bold'
                          : isBest
                          ? 'bg-emerald-950/15 hover:bg-slate-900/60'
                          : 'hover:bg-slate-900/40'
                      }`}
                    >
                      <td className="p-3 text-white flex items-center gap-2">
                        <span>f_osc / {calc.divisor}</span>
                        {isBest && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> 최적
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center text-cyan-400">{calc.spi2x}</td>
                      <td className="p-3 text-center text-indigo-300">{calc.spr1}</td>
                      <td className="p-3 text-center text-indigo-300">{calc.spr0}</td>
                      <td className="p-3 text-right font-bold text-white">
                        {calc.actualSckMhz >= 1
                          ? `${calc.actualSckMhz.toFixed(3)} MHz`
                          : `${calc.actualSckKhz.toFixed(2)} kHz`}
                      </td>
                      <td className="p-3 text-right">
                        <span
                          className={`flex items-center justify-end gap-1 ${
                            calc.exceedsTarget
                              ? 'text-rose-400 font-bold'
                              : Math.abs(calc.errorPercent) <= 5.0
                              ? 'text-emerald-400 font-bold'
                              : 'text-slate-300'
                          }`}
                        >
                          {calc.errorPercent > 0 ? '+' : ''}
                          {calc.errorPercent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3 text-right text-slate-300">
                        {calc.byteTimeUs < 1
                          ? `${(calc.byteTimeUs * 1000).toFixed(0)} ns`
                          : `${calc.byteTimeUs.toFixed(2)} µs`}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            calc.status === 'optimal'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : calc.status === 'safe_slow'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {calc.status === 'optimal' && <CheckCircle2 className="w-3 h-3" />}
                          {calc.status === 'safe_slow' && <Check className="w-3 h-3" />}
                          {calc.status === 'exceeds' && <AlertTriangle className="w-3 h-3" />}
                          {calc.status === 'optimal'
                            ? '권장 (추천)'
                            : calc.status === 'safe_slow'
                            ? '안전 저속'
                            : '속도 초과'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUserSelectedDivisor(calc.divisor);
                          }}
                          className={`px-2.5 py-1 rounded text-xs transition ${
                            isSelected
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {isSelected ? '선택됨' : '적용'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Slave Mode Status & Verification Banner */
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              SPI 슬레이브 타이밍 제약 & 내부 2단계 동기화 메커니즘
            </h4>
            <span
              className={`text-xs px-2.5 py-1 rounded font-bold font-mono flex items-center gap-1 ${
                slaveCalculations.isExceeded
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : slaveCalculations.isWarning
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {slaveCalculations.isExceeded ? (
                <>
                  <XCircle className="w-3.5 h-3.5" /> F_CPU / 2 절대 규격 초과 (동작 불가)
                </>
              ) : slaveCalculations.isWarning ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" /> F_CPU / 4 초과 (노이즈 환경 주의)
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> 완벽한 안전 동기화 영역
                </>
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400">외부 SCK 펄스 최소 지속폭 (t_SCKL / t_SCKH)</div>
              <div className="text-base font-bold text-white font-mono mt-1">
                ≥ {slaveCalculations.minPulseWidthNs.toFixed(1)} ns
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                SCK의 High 및 Low 상태는 각각 최소 2개의 CPU 클럭 주기 동안 유지되어야 동기화 플립플롭이 래치합니다.
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400">SS (Slave Select) 핀 하드웨어 역할</div>
              <div className="text-base font-bold text-indigo-300 font-mono mt-1">
                LOW 활성화 (Active LOW)
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                마스터가 SS 핀을 HIGH로 올리면 SPI 내부 직렬 레지스터가 즉시 리셋되며 MISO 핀이 하이임피던스(Hi-Z)로 뜹니다.
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400">데이터 처리 방식 추천</div>
              <div className="text-base font-bold text-purple-300 font-mono mt-1">
                인터럽트 (SPI_STC_vect)
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                마스터가 언제 데이터를 보낼지 알 수 없으므로 SPIE=1로 인터럽트를 활성화하여 수신하는 것이 표준입니다.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SPI Protocol Mode (0, 1, 2, 3), Data Order & Interrupt Controls */}
      <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-5 space-y-4">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          SPI 프로토콜 전송 모드 (Mode 0~3), 데이터 순서(DORD) 및 인터럽트(SPIE)
        </h4>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Mode 0, 1, 2, 3 Selector */}
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-medium">클럭 극성(CPOL) & 클럭 위상(CPHA) 모드:</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { m: 0, cpol: 0, cpha: 0, name: 'Mode 0', desc: 'Idle=Low, Leading 샘플 (표준 SD/센서)' },
                { m: 1, cpol: 0, cpha: 1, name: 'Mode 1', desc: 'Idle=Low, Trailing 샘플' },
                { m: 2, cpol: 1, cpha: 0, name: 'Mode 2', desc: 'Idle=High, Leading 샘플' },
                { m: 3, cpol: 1, cpha: 1, name: 'Mode 3', desc: 'Idle=High, Trailing 샘플 (EEPROM/플래시)' }
              ].map((item) => (
                <button
                  key={item.m}
                  onClick={() => setSpiMode(item.m)}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    spiMode === item.m
                      ? 'bg-indigo-500/20 border-indigo-500 text-white font-bold ring-1 ring-indigo-500/50'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{item.name}</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      CPOL={item.cpol}, CPHA={item.cpha}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Data Order (DORD) */}
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-medium">비트 전송 순서 (Data Order - DORD):</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => setDataOrder('MSB')}
                className={`p-3 rounded-lg border text-left transition ${
                  dataOrder === 'MSB'
                    ? 'bg-indigo-500/20 border-indigo-500 text-white font-bold ring-1 ring-indigo-500/50'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="font-mono text-sm">MSB First</div>
                <div className="text-[10px] text-slate-400 mt-0.5">DORD = 0 (비트 7부터 전송)</div>
                <div className="text-[10px] text-emerald-400 mt-1">★ 99% SPI 디바이스 표준</div>
              </button>

              <button
                onClick={() => setDataOrder('LSB')}
                className={`p-3 rounded-lg border text-left transition ${
                  dataOrder === 'LSB'
                    ? 'bg-indigo-500/20 border-indigo-500 text-white font-bold ring-1 ring-indigo-500/50'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="font-mono text-sm">LSB First</div>
                <div className="text-[10px] text-slate-400 mt-0.5">DORD = 1 (비트 0부터 전송)</div>
                <div className="text-[10px] text-amber-400 mt-1">특수 통신/디스플레이</div>
              </button>
            </div>
          </div>

          {/* SPI Interrupt Enable (SPIE) */}
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-medium">전송 완료 인터럽트 활성화 (SPIE):</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => setInterruptEnable(false)}
                className={`p-3 rounded-lg border text-left transition ${
                  !interruptEnable
                    ? 'bg-indigo-500/20 border-indigo-500 text-white font-bold ring-1 ring-indigo-500/50'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="font-mono text-sm">폴링 방식 (Polling)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">SPIE = 0</div>
                <div className="text-[10px] text-slate-400 mt-1">while(!(SPSR &amp; (1&lt;&lt;SPIF)))</div>
              </button>

              <button
                onClick={() => setInterruptEnable(true)}
                className={`p-3 rounded-lg border text-left transition ${
                  interruptEnable
                    ? 'bg-indigo-500/20 border-indigo-500 text-white font-bold ring-1 ring-indigo-500/50'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="font-mono text-sm">인터럽트 (ISR)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">SPIE = 1</div>
                <div className="text-[10px] text-purple-400 mt-1">ISR(SPI_STC_vect) 핸들러</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 8-bit Register Bitfield Inspectors: SPCR & SPSR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* SPCR Visualizer */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              SPCR (SPI Control Register)
            </h4>
            <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
              {registers.spcr.hex} (0b{registers.spcr.bin})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                  <th className="p-1.5 border-r border-slate-800">Bit 7</th>
                  <th className="p-1.5 border-r border-slate-800">Bit 6</th>
                  <th className="p-1.5 border-r border-slate-800">Bit 5</th>
                  <th className="p-1.5 border-r border-slate-800">Bit 4</th>
                  <th className="p-1.5 border-r border-slate-800">Bit 3</th>
                  <th className="p-1.5 border-r border-slate-800">Bit 2</th>
                  <th className="p-1.5 border-r border-slate-800">Bit 1</th>
                  <th className="p-1.5">Bit 0</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-800 font-bold text-white bg-slate-950">
                  <td className="p-2 border-r border-slate-800">SPIE</td>
                  <td className="p-2 border-r border-slate-800">SPE</td>
                  <td className="p-2 border-r border-slate-800">DORD</td>
                  <td className="p-2 border-r border-slate-800">MSTR</td>
                  <td className="p-2 border-r border-slate-800">CPOL</td>
                  <td className="p-2 border-r border-slate-800">CPHA</td>
                  <td className="p-2 border-r border-slate-800 text-indigo-300">SPR1</td>
                  <td className="p-2 text-indigo-300">SPR0</td>
                </tr>
                <tr className="bg-slate-900/40 text-xs font-bold">
                  {registers.spcr.bits.map((b, idx) => (
                    <td
                      key={idx}
                      className={`p-2 border-r border-slate-800 ${
                        idx === 7 ? 'border-r-0' : ''
                      } ${b ? 'text-emerald-400 bg-emerald-950/20' : 'text-slate-500'}`}
                    >
                      {b}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="text-[11px] text-slate-400 grid grid-cols-2 gap-1 pt-1 font-mono">
            <div>• SPIE = {interruptEnable ? '1 (인터럽트 ON)' : '0 (폴링 모드)'}</div>
            <div>• SPE = 1 (SPI 모듈 활성)</div>
            <div>• DORD = {dataOrder === 'LSB' ? '1 (LSB First)' : '0 (MSB First)'}</div>
            <div>• MSTR = {spiRole === 'master' ? '1 (Master)' : '0 (Slave)'}</div>
            <div>• CPOL = {cpol} ({cpol ? 'Idle HIGH' : 'Idle LOW'})</div>
            <div>• CPHA = {cpha} ({cpha ? 'Trailing Edge' : 'Leading Edge'})</div>
            <div>• SPR1:0 = 0b{registers.spcr.bits[6]}{registers.spcr.bits[7]} (분주 선택)</div>
          </div>
        </div>

        {/* SPSR Visualizer */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              SPSR (SPI Status Register)
            </h4>
            <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
              {registers.spsr.hex} (0b{registers.spsr.bin})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                  <th className="p-1.5 border-r border-slate-800">Bit 7</th>
                  <th className="p-1.5 border-r border-slate-800">Bit 6</th>
                  <th className="p-1.5 border-r border-slate-800">Bit 5</th>
                  <th className="p-1.5 border-r border-slate-800">Bit 4</th>
                  <th className="p-1.5 border-r border-slate-800">Bit 3</th>
                  <th className="p-1.5 border-r border-slate-800">Bit 2</th>
                  <th className="p-1.5 border-r border-slate-800">Bit 1</th>
                  <th className="p-1.5 bg-cyan-950/30 text-cyan-300">Bit 0</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-800 font-bold text-white bg-slate-950">
                  <td className="p-2 border-r border-slate-800 text-slate-400">SPIF</td>
                  <td className="p-2 border-r border-slate-800 text-slate-400">WCOL</td>
                  <td className="p-2 border-r border-slate-800 text-slate-600">-</td>
                  <td className="p-2 border-r border-slate-800 text-slate-600">-</td>
                  <td className="p-2 border-r border-slate-800 text-slate-600">-</td>
                  <td className="p-2 border-r border-slate-800 text-slate-600">-</td>
                  <td className="p-2 border-r border-slate-800 text-slate-600">-</td>
                  <td className="p-2 bg-cyan-950/50 text-cyan-300">SPI2X</td>
                </tr>
                <tr className="bg-slate-900/40 text-xs font-bold">
                  <td colSpan={7} className="p-2 border-r border-slate-800 text-slate-500 font-sans text-[11px]">
                    상태 플래그 (SPIF: 전송 완료, WCOL: 충돌)
                  </td>
                  <td className={`p-2 ${registers.spsr.bits[7] ? 'text-cyan-400 bg-cyan-950/40' : 'text-slate-500'}`}>
                    {registers.spsr.bits[7]}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="text-[11px] text-slate-400 space-y-1 pt-1 font-mono">
            <div>• SPI2X = {registers.spsr.bits[7]} ({registers.spsr.bits[7] ? '2배속 더블 스피드 ON' : '표준 1배속'})</div>
            <div>• SPI2X=1 설정 시 클럭 주파수가 2배로 증가하여 f_osc / 2, f_osc / 8, f_osc / 32를 생성합니다.</div>
            <div className="text-slate-500 text-[10px] pt-1">
              * 마스터 모드에서만 SPI2X가 동작하며, 슬레이브 모드에서는 무시됩니다.
            </div>
          </div>
        </div>
      </div>

      {/* Target MCU Hardware SPI Pin Mapping Grid */}
      <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-5 space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          {currentProfile.name} 하드웨어 SPI 핀 배치 & DDR 방향 설정
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* SCK */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-mono">SCK (클럭)</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                spiRole === 'master' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-purple-500/20 text-purple-300'
              }`}>
                {spiRole === 'master' ? 'OUTPUT' : 'INPUT'}
              </span>
            </div>
            <div className="text-sm font-bold text-white font-mono mt-1">{spiPinInfo.sck.pin}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              아두이노: {spiPinInfo.sck.arduino} (핀 #{spiPinInfo.sck.phys})
            </div>
          </div>

          {/* MOSI */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-mono">MOSI (마스터 출력)</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                spiRole === 'master' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-purple-500/20 text-purple-300'
              }`}>
                {spiRole === 'master' ? 'OUTPUT' : 'INPUT'}
              </span>
            </div>
            <div className="text-sm font-bold text-white font-mono mt-1">{spiPinInfo.mosi.pin}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              아두이노: {spiPinInfo.mosi.arduino} (핀 #{spiPinInfo.mosi.phys})
            </div>
          </div>

          {/* MISO */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-mono">MISO (마스터 입력)</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                spiRole === 'master' ? 'bg-purple-500/20 text-purple-300' : 'bg-indigo-500/20 text-indigo-300'
              }`}>
                {spiRole === 'master' ? 'INPUT' : 'OUTPUT'}
              </span>
            </div>
            <div className="text-sm font-bold text-white font-mono mt-1">{spiPinInfo.miso.pin}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              아두이노: {spiPinInfo.miso.arduino} (핀 #{spiPinInfo.miso.phys})
            </div>
          </div>

          {/* SS */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-mono">SS (Slave Select)</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                spiRole === 'master' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-purple-500/20 text-purple-300'
              }`}>
                {spiRole === 'master' ? 'OUTPUT' : 'INPUT'}
              </span>
            </div>
            <div className="text-sm font-bold text-white font-mono mt-1">{spiPinInfo.ss.pin}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              아두이노: {spiPinInfo.ss.arduino} (핀 #{spiPinInfo.ss.phys})
            </div>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
          <span>
            {spiRole === 'master'
              ? '마스터 모드 주의: SS 핀이 입력으로 설정된 상태에서 외부 신호에 의해 LOW로 떨어지면, AVR은 강제로 슬레이브 모드로 강등(MSTR=0)되고 SPIF 플래그를 세웁니다. 따라서 마스터 동작 시 SS 핀은 항상 출력(OUTPUT)으로 두거나 HIGH 풀업을 유지하십시오.'
              : '슬레이브 모드 주의: SS 핀이 LOW일 때만 MISO 핀이 활성화됩니다. SS가 HIGH가 되면 SPI 수신 회로가 리셋되고 MISO는 Hi-Z 상태로 전환되어 버스를 해제합니다.'}
          </span>
        </div>
      </div>

      {/* Production-Ready C Code Generator */}
      <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              자동 생성된 AVR-GCC C 초기화 & 송수신 드라이버 ({currentProfile.name} {spiRole.toUpperCase()})
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIncludeFullExample(!includeFullExample)}
              className="text-xs px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              {includeFullExample ? '간략 초기화만 보기' : '전체 드라이버 코드 보기'}
            </button>

            <button
              onClick={handleCopyCode}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                copiedCode
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-indigo-500 hover:bg-indigo-400 text-white'
              }`}
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5" /> 복사 완료!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> 코드 복사
                </>
              )}
            </button>
          </div>
        </div>

        <div className="relative">
          <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800/80 text-xs font-mono text-indigo-200 overflow-x-auto leading-relaxed max-h-80 select-all">
            {generatedCode}
          </pre>
        </div>
      </div>
    </div>
  );
};
