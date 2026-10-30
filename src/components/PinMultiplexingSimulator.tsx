import React, { useState, useMemo } from 'react';
import {
  Cpu,
  Layers,
  Radio,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Copy,
  Check,
  Search,
  Sparkles,
  Zap,
  ArrowRight,
  Terminal,
  Activity,
  ShieldCheck,
  RotateCcw,
  Binary
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES, PinDefinition } from '../data/pinmapData';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
  onNavigateToPin?: (pinName: string) => void;
}

export interface MultiplexedFunctionDetail {
  id: string;
  name: string;
  category: 'gpio' | 'usart' | 'spi' | 'i2c' | 'adc' | 'timer' | 'interrupt' | 'analog' | 'memory' | 'system';
  direction: 'Input' | 'Output' | 'Input / Output (DDRx 제어)' | 'Bi-directional (Open Drain)' | 'Analog Input' | 'Clock / Bus';
  badgeColor: string;
  badgeBorder: string;
  badgeText: string;
  description: string;
  overrideBehavior: string;
  registers: {
    regName: string;
    regDesc: string;
    bitIndex: number;
    bitName: string;
    targetValue: '0' | '1' | 'Configurable';
    purpose: string;
  }[];
  codeSnippet: string;
}

export const PinMultiplexingSimulator: React.FC<Props> = ({
  selectedMCU,
  onSelectMCU,
  onNavigateToPin
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const portKeys = useMemo(() => Object.keys(currentProfile.ports), [currentProfile]);

  // Selected Port and Pin
  const [selectedPortKey, setSelectedPortKey] = useState<string>(() => {
    return portKeys.includes('PORTD') ? 'PORTD' : portKeys.includes('PORTB') ? 'PORTB' : portKeys[0];
  });

  // Ensure port exists if MCU changes
  React.useEffect(() => {
    if (!currentProfile.ports[selectedPortKey]) {
      setSelectedPortKey(Object.keys(currentProfile.ports)[0]);
    }
  }, [selectedMCU, currentProfile, selectedPortKey]);

  const currentPort = currentProfile.ports[selectedPortKey] || Object.values(currentProfile.ports)[0];

  const [selectedPinName, setSelectedPinName] = useState<string>(() => {
    return currentPort.pins[0]?.pin || 'PD0';
  });

  // Update selected pin when port changes
  React.useEffect(() => {
    if (!currentPort.pins.some((p) => p.pin === selectedPinName)) {
      setSelectedPinName(currentPort.pins[0]?.pin || 'PD0');
    }
  }, [currentPort, selectedPinName]);

  // Selected Alternate Function ID
  const [activeFuncId, setActiveFuncId] = useState<string>('gpio');

  // Search filter for pins
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Copy state
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // All pins across all ports of this MCU
  const allMcuPins = useMemo(() => {
    const list: (PinDefinition & { portKey: string })[] = [];
    Object.entries(currentProfile.ports).forEach(([pKey, pInfo]) => {
      pInfo.pins.forEach((pin) => {
        list.push({ ...pin, portKey: pKey });
      });
    });
    return list;
  }, [currentProfile]);

  // Active Pin Object
  const activePin = useMemo(() => {
    return allMcuPins.find((p) => p.pin === selectedPinName) || currentPort.pins[0];
  }, [allMcuPins, selectedPinName, currentPort]);

  // Extract port letter and bit number (e.g. 'PD3' -> port 'D', bit 3)
  const pinLetter = activePin.pin.charAt(1).toUpperCase(); // e.g. 'D'
  const pinBit = parseInt(activePin.pin.substring(2), 10) || 0; // e.g. 3

  // ---------------------------------------------------------------------------
  // Parse and Synthesize All Alternate Multiplexed Functions for the selected Pin
  // ---------------------------------------------------------------------------
  const alternateFunctions = useMemo((): MultiplexedFunctionDetail[] => {
    const funcs: MultiplexedFunctionDetail[] = [];
    const pinName = activePin.pin; // e.g. 'PD0', 'PC4', 'PB3'
    const altStr = `${activePin.alt} ${activePin.name} ${activePin.desc}`.toUpperCase();

    // 1. Always available: General Purpose I/O (GPIO)
    funcs.push({
      id: 'gpio',
      name: `GPIO (PORT${pinLetter}${pinBit})`,
      category: 'gpio',
      direction: 'Input / Output (DDRx 제어)',
      badgeColor: 'bg-slate-800 text-slate-200',
      badgeBorder: 'border-slate-700',
      badgeText: '기본 범용 I/O',
      description: `특수 하드웨어 기능을 활성화하지 않은 기본 상태로, DDR${pinLetter} 방향 레지스터를 통해 입력 또는 출력으로 동작하며, 입력 시 PORT${pinLetter}${pinBit}로 내부 풀업 저항(20k~50kΩ)을 켤 수 있습니다.`,
      overrideBehavior: `하드웨어 오버라이드 없음 (순수 레지스터 DDR${pinLetter}, PORT${pinLetter}, PIN${pinLetter}로 완전 제어)`,
      registers: [
        {
          regName: `DDR${pinLetter}`,
          regDesc: `Port ${pinLetter} Data Direction Register`,
          bitIndex: pinBit,
          bitName: `DD${pinLetter}${pinBit}`,
          targetValue: 'Configurable',
          purpose: `0 = 디지털 입력 (High-Z), 1 = 디지털 출력 (Push-pull 드라이브)`
        },
        {
          regName: `PORT${pinLetter}`,
          regDesc: `Port ${pinLetter} Data Register`,
          bitIndex: pinBit,
          bitName: `PORT${pinLetter}${pinBit}`,
          targetValue: 'Configurable',
          purpose: `출력 모드 시 High(5V)/Low(0V) 출력, 입력 모드 시 1이면 내부 풀업 저항(Pull-up) 활성화`
        },
        {
          regName: `PIN${pinLetter}`,
          regDesc: `Port ${pinLetter} Input Pins Address`,
          bitIndex: pinBit,
          bitName: `PIN${pinLetter}${pinBit}`,
          targetValue: 'Configurable',
          purpose: `외부 입력 전압 상태 읽기 (0=GND, 1=VCC), 1을 쓰면 출력 토글(Toggle)`
        }
      ],
      codeSnippet: `// ==========================================
// ${currentProfile.name} ${pinName} GPIO 제어 예제
// ==========================================
// 1. 출력 모드로 설정 및 High 출력
DDR${pinLetter} |= (1 << DD${pinLetter}${pinBit});     // ${pinName} 출력 방향 설정
PORT${pinLetter} |= (1 << PORT${pinLetter}${pinBit}); // ${pinName} High 출력

// 2. 또는 입력 모드로 설정 및 내부 풀업 저항 활성화
DDR${pinLetter} &= ~(1 << DD${pinLetter}${pinBit});   // ${pinName} 입력 방향 설정
PORT${pinLetter} |= (1 << PORT${pinLetter}${pinBit}); // 풀업 저항 활성화
uint8_t pin_state = (PIN${pinLetter} & (1 << PIN${pinLetter}${pinBit})) ? 1 : 0;`
    });

    // 2. USART Communication (RXD, TXD, XCK)
    if (altStr.includes('RXD') || altStr.includes('TXD') || altStr.includes('XCK')) {
      const isRxd = altStr.includes('RXD');
      const isTxd = altStr.includes('TXD');
      // Channel index
      let ch = 0;
      if (altStr.includes('RXD3') || altStr.includes('TXD3')) ch = 3;
      else if (altStr.includes('RXD2') || altStr.includes('TXD2')) ch = 2;
      else if (altStr.includes('RXD1') || altStr.includes('TXD1')) ch = 1;

      const ucsraReg = selectedMCU === 'atmega328p' ? 'UCSR0A' : `UCSR${ch}A`;
      const ucsrbReg = selectedMCU === 'atmega328p' ? 'UCSR0B' : `UCSR${ch}B`;
      const ucsrcReg = selectedMCU === 'atmega328p' ? 'UCSR0C' : `UCSR${ch}C`;
      const rxenBit = selectedMCU === 'atmega328p' ? 'RXEN0' : `RXEN${ch}`;
      const txenBit = selectedMCU === 'atmega328p' ? 'TXEN0' : `TXEN${ch}`;

      if (isRxd) {
        funcs.push({
          id: `usart_rxd_${ch}`,
          name: `USART${ch} RXD (시리얼 수신 입력)`,
          category: 'usart',
          direction: 'Input',
          badgeColor: 'bg-indigo-950/80 text-indigo-300',
          badgeBorder: 'border-indigo-700/60',
          badgeText: `USART${ch} 시리얼 수신`,
          description: `USART 채널 ${ch}의 비동기 직렬 데이터 수신(RX) 전용 핀입니다. PC 시리얼 모니터, GPS, 블루투스 등 외부 시리얼 기기로부터 데이터를 수신합니다.`,
          overrideBehavior: `${ucsrbReg} 레지스터의 ${rxenBit} 비트가 1로 설정되는 즉시 포트 방향(DDR)과 상관없이 하드웨어 수신 버퍼로 자동 오버라이드(Override)됩니다.`,
          registers: [
            {
              regName: ucsrbReg,
              regDesc: `USART${ch} Control and Status Register B`,
              bitIndex: 4,
              bitName: rxenBit,
              targetValue: '1',
              purpose: `1 = USART${ch} 수신기(Receiver) 활성화 (DDR 레지스터를 입력으로 자동 오버라이드)`
            },
            {
              regName: ucsrbReg,
              regDesc: `USART${ch} Control and Status Register B`,
              bitIndex: 7,
              bitName: selectedMCU === 'atmega328p' ? 'RXCIE0' : `RXCIE${ch}`,
              targetValue: 'Configurable',
              purpose: `1 = 수신 완료(RX Complete) 시 인터럽트 발생 허용`
            }
          ],
          codeSnippet: `// ==========================================
// ${currentProfile.name} ${pinName} -> USART${ch} RXD 활성화
// ==========================================
#include <avr/io.h>

void USART${ch}_Init_RX(void) {
    // 1. 보드레이트 설정 (예: 9600 bps @ 16MHz)
    UBRR${ch}H = 0;
    UBRR${ch}L = 103;

    // 2. 수신기(RXEN) 활성화 -> ${pinName} 핀이 자동으로 USART 수신 모드로 전환됨
    ${ucsrbReg} |= (1 << ${rxenBit});

    // 3. 8비트 데이터, 1스톱비트 모드
    ${ucsrcReg} = (1 << UCSZ${ch}1) | (1 << UCSZ${ch}0);
}`
        });
      }

      if (isTxd) {
        funcs.push({
          id: `usart_txd_${ch}`,
          name: `USART${ch} TXD (시리얼 송신 출력)`,
          category: 'usart',
          direction: 'Output',
          badgeColor: 'bg-indigo-950/80 text-indigo-300',
          badgeBorder: 'border-indigo-700/60',
          badgeText: `USART${ch} 시리얼 송신`,
          description: `USART 채널 ${ch}의 비동기 직렬 데이터 송신(TX) 전용 핀입니다. MCU의 내부 데이터를 직렬 프레임으로 변환하여 송출합니다.`,
          overrideBehavior: `${ucsrbReg}의 ${txenBit} 비트가 1이 되면 포트 방향(DDR)을 자동으로 출력(Output) 드라이버로 오버라이드합니다.`,
          registers: [
            {
              regName: ucsrbReg,
              regDesc: `USART${ch} Control and Status Register B`,
              bitIndex: 3,
              bitName: txenBit,
              targetValue: '1',
              purpose: `1 = USART${ch} 송신기(Transmitter) 활성화 (핀을 송신 출력으로 자동 점유)`
            }
          ],
          codeSnippet: `// ==========================================
// ${currentProfile.name} ${pinName} -> USART${ch} TXD 활성화
// ==========================================
#include <avr/io.h>

void USART${ch}_Init_TX(void) {
    UBRR${ch}H = 0;
    UBRR${ch}L = 103; // 9600 bps @ 16MHz

    // 송신기 활성화 -> ${pinName} 핀이 자동으로 TX 라인으로 드라이브됨
    ${ucsrbReg} |= (1 << ${txenBit});
}`
        });
      }
    }

    // 3. I2C / TWI (SDA, SCL)
    if (altStr.includes('SDA') || altStr.includes('SCL')) {
      const isSda = altStr.includes('SDA');
      funcs.push({
        id: isSda ? 'twi_sda' : 'twi_scl',
        name: isSda ? 'TWI / I2C SDA (Serial Data Bus)' : 'TWI / I2C SCL (Serial Clock Bus)',
        category: 'i2c',
        direction: 'Bi-directional (Open Drain)',
        badgeColor: 'bg-emerald-950/80 text-emerald-300',
        badgeBorder: 'border-emerald-700/60',
        badgeText: isSda ? 'I2C 데이터 (SDA)' : 'I2C 클럭 (SCL)',
        description: isSda
          ? 'I2C (2-Wire Serial Interface) 양방향 데이터 라인입니다. 오픈 드레인(Open-drain) 구조이므로 외부에 4.7kΩ 풀업 저항이 필수입니다.'
          : 'I2C (2-Wire Serial Interface) 마스터 클럭 라인입니다. SCL 클럭을 생성하거나 슬레이브 클럭 스트레칭을 감지합니다.',
        overrideBehavior: `TWCR 레지스터의 TWEN 비트를 1로 설정하면, 슬루레이트(Slew-rate) 제어 오픈 드레인 하드웨어 드라이버가 활성화되며 일반 Push-pull 출력이 차단됩니다. PORT${pinLetter}${pinBit}=1로 내부 약한 풀업을 켤 수 있으나 외부 풀업이 강력 권장됩니다.`,
        registers: [
          {
            regName: 'TWCR',
            regDesc: 'TWI Control Register',
            bitIndex: 2,
            bitName: 'TWEN',
            targetValue: '1',
            purpose: '1 = TWI(I2C) 하드웨어 활성화 및 해당 핀을 I2C 오픈 드레인 버스로 점유'
          },
          {
            regName: 'TWBR',
            regDesc: 'TWI Bit Rate Register',
            bitIndex: 0,
            bitName: 'TWBR0-7',
            targetValue: 'Configurable',
            purpose: 'SCL 클럭 주파수 설정 (예: 100kHz Standard or 400kHz Fast)'
          }
        ],
        codeSnippet: `// ==========================================
// ${currentProfile.name} ${pinName} -> I2C (${isSda ? 'SDA' : 'SCL'}) 활성화
// ==========================================
#include <avr/io.h>

void TWI_Init(void) {
    // 100kHz SCL @ 16MHz (TWBR = 72, Prescaler = 1)
    TWSR = 0x00;
    TWBR = 72;

    // TWI 인터페이스 활성화 -> ${pinName} 핀이 I2C 전용으로 오버라이드됨
    TWCR = (1 << TWEN);
}`
      });
    }

    // 4. SPI (MOSI, MISO, SCK, SS)
    if (altStr.includes('MOSI') || altStr.includes('MISO') || altStr.includes('SCK') || altStr.includes('SS')) {
      let spiType = 'SPI Pin';
      let dir: 'Input' | 'Output' | 'Bi-directional (Open Drain)' = 'Output';
      let overrideNote = '';

      if (altStr.includes('MOSI')) {
        spiType = 'SPI MOSI (Master Out Slave In)';
        dir = 'Output';
        overrideNote = 'SPCR.SPE=1 설정 후, 마스터 모드에서는 사용자가 직접 DDR을 출력(1)으로 설정해야 MOSI 파형이 핀으로 출력됩니다.';
      } else if (altStr.includes('MISO')) {
        spiType = 'SPI MISO (Master In Slave Out)';
        dir = 'Input';
        overrideNote = 'SPCR.SPE=1 및 SPCR.MSTR=1 설정 시, MISO 핀은 자동으로 입력 버퍼로 전환됩니다.';
      } else if (altStr.includes('SCK')) {
        spiType = 'SPI SCK (Serial Clock)';
        dir = 'Output';
        overrideNote = '마스터 모드 시 DDR을 출력(1)으로 설정하여 SCK 클럭을 외부로 송출합니다.';
      } else if (altStr.includes('SS')) {
        spiType = 'SPI SS (Slave Select)';
        dir = 'Output';
        overrideNote = '마스터 모드 시 SS 핀이 입력으로 설정되고 Low가 인가되면 MCU가 자동으로 슬레이브 모드로 강제 강등되므로, 마스터에서는 출력(DDR=1)으로 두는 것이 필수적입니다.';
      }

      funcs.push({
        id: 'spi_bus',
        name: spiType,
        category: 'spi',
        direction: dir,
        badgeColor: 'bg-cyan-950/80 text-cyan-300',
        badgeBorder: 'border-cyan-700/60',
        badgeText: 'SPI 버스',
        description: `하드웨어 고속 동기 직렬 인터페이스 SPI(Serial Peripheral Interface) 버스 라인입니다. SD 카드, 플래시 메모리, LCD 디스플레이 등과 수 MHz 대역폭으로 통신합니다.`,
        overrideBehavior: overrideNote,
        registers: [
          {
            regName: 'SPCR',
            regDesc: 'SPI Control Register',
            bitIndex: 6,
            bitName: 'SPE',
            targetValue: '1',
            purpose: '1 = SPI 서브시스템 활성화'
          },
          {
            regName: 'SPCR',
            regDesc: 'SPI Control Register',
            bitIndex: 4,
            bitName: 'MSTR',
            targetValue: '1',
            purpose: '1 = SPI 마스터(Master) 모드 선택 (0 = 슬레이브 모드)'
          },
          {
            regName: `DDR${pinLetter}`,
            regDesc: `Port ${pinLetter} Direction Register`,
            bitIndex: pinBit,
            bitName: `DD${pinLetter}${pinBit}`,
            targetValue: dir === 'Output' ? '1' : '0',
            purpose: dir === 'Output' ? '출력 방향 필수 지정' : '입력 방향 지정'
          }
        ],
        codeSnippet: `// ==========================================
// ${currentProfile.name} ${pinName} -> ${spiType} 활성화
// ==========================================
#include <avr/io.h>

void SPI_Master_Init(void) {
    // 해당 SPI 핀 방향 설정
    ${dir === 'Output' ? `DDR${pinLetter} |= (1 << DD${pinLetter}${pinBit});` : `DDR${pinLetter} &= ~(1 << DD${pinLetter}${pinBit});`}

    // SPI 활성화, 마스터 모드, 클럭 분주 f_osc/16
    SPCR = (1 << SPE) | (1 << MSTR) | (1 << SPR0);
}`
      });
    }

    // 5. Timer / PWM (OC0A, OC0B, OC1A, OC1B, OC1C, OC2A, OC2B, OC3A... etc.)
    const ocMatch = altStr.match(/OC([0-9])([A-C])/);
    if (ocMatch) {
      const timerNum = ocMatch[1];
      const channel = ocMatch[2];
      const timerRegA = `TCCR${timerNum}A`;
      const comBit1 = `COM${timerNum}${channel}1`;
      const comBit0 = `COM${timerNum}${channel}0`;

      funcs.push({
        id: `timer_pwm_oc${timerNum}${channel}`,
        name: `Timer${timerNum} PWM 출력 (OC${timerNum}${channel})`,
        category: 'timer',
        direction: 'Output',
        badgeColor: 'bg-amber-950/80 text-amber-300',
        badgeBorder: 'border-amber-700/60',
        badgeText: `Timer${timerNum} PWM (${channel})`,
        description: `하드웨어 타이머/카운터 ${timerNum}의 비교 일치(Compare Match) 파형 발생기 출력 라인입니다. CPU 개입 없이 하드웨어적으로 정밀 PWM 및 구형파를 출력합니다.`,
        overrideBehavior: `${timerRegA} 레지스터의 ${comBit1}:${comBit0} 비트를 비-제로(Non-zero)로 설정하면 PORT${pinLetter}${pinBit} 출력 래치가 타이머 파형 발생기로 오버라이드됩니다. 단, 핀으로 신호가 나오려면 DDR${pinLetter}${pinBit}=1 (출력 모드)이 반드시 설정되어야 합니다!`,
        registers: [
          {
            regName: timerRegA,
            regDesc: `Timer/Counter ${timerNum} Control Register A`,
            bitIndex: channel === 'A' ? 7 : channel === 'B' ? 5 : 3,
            bitName: comBit1,
            targetValue: '1',
            purpose: '1 = Clear OC on Compare Match (비반전 Fast/Phase Correct PWM 출력)'
          },
          {
            regName: `DDR${pinLetter}`,
            regDesc: `Port ${pinLetter} Direction Register`,
            bitIndex: pinBit,
            bitName: `DD${pinLetter}${pinBit}`,
            targetValue: '1',
            purpose: '1 = 출력 방향 설정 필수 (0이면 물리 핀으로 파형이 드라이브되지 않음)'
          }
        ],
        codeSnippet: `// ==========================================
// ${currentProfile.name} ${pinName} -> Timer${timerNum} PWM (OC${timerNum}${channel}) 활성화
// ==========================================
#include <avr/io.h>

void PWM_Init_OC${timerNum}${channel}(void) {
    // 1. 핀을 출력으로 설정 (필수!)
    DDR${pinLetter} |= (1 << DD${pinLetter}${pinBit});

    // 2. 타이머 비교 출력 모드 (Fast PWM, 비반전 출력)
    ${timerRegA} |= (1 << ${comBit1}) | (1 << WGM${timerNum}0);
    TCCR${timerNum}B |= (1 << CS${timerNum}1); // 클럭 분주 8분주

    // 3. 듀티 사이클 지정 (0~255 or 16-bit)
    OCR${timerNum}${channel} = 128; // 50% 듀티
}`
      });
    }

    // 6. ADC (Analog Input Channels: ADC0 ~ ADC15)
    const adcMatch = altStr.match(/ADC([0-9]{1,2})/);
    if (adcMatch) {
      const adcChannel = parseInt(adcMatch[1], 10);
      const isHighAdc = adcChannel >= 8;
      const didrReg = isHighAdc ? 'DIDR2' : 'DIDR0';
      const didrBit = isHighAdc ? `ADC${adcChannel}D` : `ADC${adcChannel}D`;

      funcs.push({
        id: `adc_ch_${adcChannel}`,
        name: `ADC${adcChannel} (아날로그 입력 채널 ${adcChannel})`,
        category: 'adc',
        direction: 'Analog Input',
        badgeColor: 'bg-rose-950/80 text-rose-300',
        badgeBorder: 'border-rose-700/60',
        badgeText: `ADC 채널 ${adcChannel}`,
        description: `10비트 연속 근사형 아날로그-디지털 변환기(ADC)의 아날로그 입력 채널입니다. 센서 전압(0V ~ VREF)을 정밀하게 측정합니다.`,
        overrideBehavior: `ADMUX의 MUX 비트들로 채널을 선택하고 ADCSRA의 ADEN=1을 인가하면 아날로그 멀티플렉서에 연결됩니다. 중요한 점: 디지털 입력 버퍼를 통한 누설 전류를 방지하기 위해 ${didrReg} 레지스터의 ${didrBit} 비트를 1로 설정하여 디지털 버퍼를 비활성화해야 전력 소비를 줄이고 노이즈를 억제할 수 있습니다.`,
        registers: [
          {
            regName: 'ADCSRA',
            regDesc: 'ADC Control and Status Register A',
            bitIndex: 7,
            bitName: 'ADEN',
            targetValue: '1',
            purpose: '1 = ADC 주변장치 전원 및 클록 인가'
          },
          {
            regName: 'ADMUX',
            regDesc: 'ADC Multiplexer Selection Register',
            bitIndex: 0,
            bitName: 'MUX0-4',
            targetValue: 'Configurable',
            purpose: `채널 ${adcChannel} 선택 (MUX 비트에 0x${(adcChannel % 8).toString(16)} 지정)`
          },
          {
            regName: didrReg,
            regDesc: 'Digital Input Disable Register',
            bitIndex: adcChannel % 8,
            bitName: didrBit,
            targetValue: '1',
            purpose: '1 = 디지털 입력 버퍼 차단 (아날로그 측정 시 전력 누설 방지 및 노이즈 제거)'
          }
        ],
        codeSnippet: `// ==========================================
// ${currentProfile.name} ${pinName} -> ADC${adcChannel} 아날로그 측정 활성화
// ==========================================
#include <avr/io.h>

void ADC_Init_Channel_${adcChannel}(void) {
    // 1. 디지털 입력 버퍼 비활성화 (초저전력 및 노이즈 억제)
    ${didrReg} |= (1 << ${didrBit});

    // 2. 기준 전압 AVCC 선택 및 채널 ${adcChannel} 지정
    ADMUX = (1 << REFS0) | (${adcChannel % 8} & 0x07);
    #if defined(MUX5)
    ${adcChannel >= 8 ? 'ADCSRB |= (1 << MUX5);' : 'ADCSRB &= ~(1 << MUX5);'}
    #endif

    // 3. ADC 활성화 및 클럭 분주 (16MHz 기준 128분주 = 125kHz)
    ADCSRA = (1 << ADEN) | (1 << ADPS2) | (1 << ADPS1) | (1 << ADPS0);
}`
      });
    }

    // 7. External Interrupt (INT0 ~ INT7)
    const intMatch = altStr.match(/INT([0-7])/);
    if (intMatch) {
      const intNum = intMatch[1];
      const eicrReg = parseInt(intNum, 10) < 4 ? 'EICRA' : 'EICRB';
      const iscBit1 = `ISC${intNum}1`;
      const iscBit0 = `ISC${intNum}0`;

      funcs.push({
        id: `ext_int_${intNum}`,
        name: `외부 인터럽트 INT${intNum} (External Interrupt ${intNum})`,
        category: 'interrupt',
        direction: 'Input',
        badgeColor: 'bg-purple-950/80 text-purple-300',
        badgeBorder: 'border-purple-700/60',
        badgeText: `외부 인터럽트 INT${intNum}`,
        description: `하드웨어 외부 인터럽트 라인입니다. 상승 엣지(Rising), 하강 엣지(Falling), 양방향 엣지, 또는 Low 레벨 감지 시 즉시 CPU를 웨이크업하고 ISR(인터럽트 서비스 루틴)을 실행합니다.`,
        overrideBehavior: `EIMSK의 INT${intNum} 비트가 1이 되면 인터럽트 감지 회로가 활성화됩니다. 핀은 기본적으로 입력이어야 하므로 DDR${pinLetter}${pinBit}=0으로 설정하고, 플로팅 방지를 위해 풀업 저항을 켜는 것이 권장됩니다.`,
        registers: [
          {
            regName: 'EIMSK',
            regDesc: 'External Interrupt Mask Register',
            bitIndex: parseInt(intNum, 10),
            bitName: `INT${intNum}`,
            targetValue: '1',
            purpose: `1 = 외부 인터럽트 ${intNum} 활성화`
          },
          {
            regName: eicrReg,
            regDesc: `External Interrupt Control Register`,
            bitIndex: (parseInt(intNum, 10) % 4) * 2 + 1,
            bitName: `${iscBit1}:${iscBit0}`,
            targetValue: 'Configurable',
            purpose: '트리거 조건: 00=Low레벨, 01=모든 변화, 10=하강엣지(Falling), 11=상승엣지(Rising)'
          }
        ],
        codeSnippet: `// ==========================================
// ${currentProfile.name} ${pinName} -> 외부 인터럽트 INT${intNum} 활성화
// ==========================================
#include <avr/io.h>
#include <avr/interrupt.h>

void ExtInterrupt_Init_INT${intNum}(void) {
    // 1. 입력 모드 및 내부 풀업 저항 설정
    DDR${pinLetter} &= ~(1 << DD${pinLetter}${pinBit});
    PORT${pinLetter} |= (1 << PORT${pinLetter}${pinBit});

    // 2. 하강 엣지(Falling edge) 트리거 설정
    ${eicrReg} |= (1 << ${iscBit1});
    ${eicrReg} &= ~(1 << ${iscBit0});

    // 3. 인터럽트 마스크 언마스크 및 글로벌 인터럽트 활성화
    EIMSK |= (1 << INT${intNum});
    sei();
}

ISR(INT${intNum}_vect) {
    // 핀 이벤트 발생 시 즉시 실행될 코드
}`
      });
    }

    // 8. Pin Change Interrupt (PCINT0 ~ PCINT23)
    const pcintMatch = altStr.match(/PCINT([0-9]{1,2})/);
    if (pcintMatch) {
      const pcintNum = parseInt(pcintMatch[1], 10);
      const group = Math.floor(pcintNum / 8); // 0, 1, or 2
      const pcmskReg = `PCMSK${group}`;
      const pcieBit = `PCIE${group}`;

      funcs.push({
        id: `pcint_${pcintNum}`,
        name: `핀 변경 인터럽트 PCINT${pcintNum}`,
        category: 'interrupt',
        direction: 'Input',
        badgeColor: 'bg-violet-950/80 text-violet-300',
        badgeBorder: 'border-violet-700/60',
        badgeText: `PCINT${pcintNum}`,
        description: `핀의 논리 상태(High <-> Low)가 변경될 때마다 인터럽트를 발생시키는 Pin Change Interrupt 라인입니다. 로터리 엔코더, 버튼 감지, 웨이크업 신호에 매우 유용합니다.`,
        overrideBehavior: `PCICR의 ${pcieBit} 및 ${pcmskReg}의 PCINT${pcintNum} 비트를 1로 설정하면 활성화됩니다.`,
        registers: [
          {
            regName: 'PCICR',
            regDesc: 'Pin Change Interrupt Control Register',
            bitIndex: group,
            bitName: pcieBit,
            targetValue: '1',
            purpose: `1 = Pin Change 인터럽트 그룹 ${group} 활성화`
          },
          {
            regName: pcmskReg,
            regDesc: `Pin Change Mask Register ${group}`,
            bitIndex: pcintNum % 8,
            bitName: `PCINT${pcintNum}`,
            targetValue: '1',
            purpose: `1 = ${pinName} 핀의 핀 변경 감지 활성화`
          }
        ],
        codeSnippet: `// ==========================================
// ${currentProfile.name} ${pinName} -> PCINT${pcintNum} 활성화
// ==========================================
#include <avr/io.h>
#include <avr/interrupt.h>

void PCINT_Init_${pcintNum}(void) {
    // 1. 입력 모드 및 내부 풀업 저항 활성화
    DDR${pinLetter} &= ~(1 << DD${pinLetter}${pinBit});
    PORT${pinLetter} |= (1 << PORT${pinLetter}${pinBit});

    // 2. 핀 마스크 등록 및 인터럽트 활성화
    ${pcmskReg} |= (1 << PCINT${pcintNum});
    PCICR |= (1 << ${pcieBit});
    sei();
}

ISR(PCINT${group}_vect) {
    // 그룹 ${group}의 핀 레벨 변경 시 실행
}`
      });
    }

    // 9. Analog Comparator (AIN0, AIN1)
    if (altStr.includes('AIN0') || altStr.includes('AIN1')) {
      const isAin0 = altStr.includes('AIN0');
      funcs.push({
        id: isAin0 ? 'ain0' : 'ain1',
        name: isAin0 ? 'AIN0 (아날로그 비교기 + 입력)' : 'AIN1 (아날로그 비교기 - 입력)',
        category: 'analog',
        direction: 'Analog Input',
        badgeColor: 'bg-pink-950/80 text-pink-300',
        badgeBorder: 'border-pink-700/60',
        badgeText: isAin0 ? '비교기 양의 입력 (AIN0)' : '비교기 음의 입력 (AIN1)',
        description: `내장 고속 아날로그 비교기(Analog Comparator)의 ${isAin0 ? '비반전(+) 아날로그 입력' : '반전(-) 아날로그 입력'} 단자입니다. 기준 전압과 비교하여 신속한 임계값 판단이 가능합니다.`,
        overrideBehavior: `ACSR 레지스터의 ACD=0(기본 활성화) 상태에서 아날로그 신호를 인가합니다. 디지털 입력 버퍼 차단(DIDR1.AIN0D / AIN1D)을 통해 누설 전류를 차단해야 합니다.`,
        registers: [
          {
            regName: 'ACSR',
            regDesc: 'Analog Comparator Control and Status Register',
            bitIndex: 7,
            bitName: 'ACD',
            targetValue: '0',
            purpose: '0 = 아날로그 비교기 전원 인가 활성화 (1이면 절전을 위해 꺼짐)'
          },
          {
            regName: 'DIDR1',
            regDesc: 'Digital Input Disable Register 1',
            bitIndex: isAin0 ? 0 : 1,
            bitName: isAin0 ? 'AIN0D' : 'AIN1D',
            targetValue: '1',
            purpose: '1 = 디지털 버퍼 차단 (아날로그 신호 입력 시 전력 누설 방지)'
          }
        ],
        codeSnippet: `// ==========================================
// ${currentProfile.name} ${pinName} -> 아날로그 비교기 (${isAin0 ? 'AIN0' : 'AIN1'})
// ==========================================
#include <avr/io.h>

void Comparator_Init(void) {
    // 1. 디지털 버퍼 차단
    DIDR1 |= (1 << ${isAin0 ? 'AIN0D' : 'AIN1D'});

    // 2. 아날로그 비교기 켜기 (ACD = 0)
    ACSR &= ~(1 << ACD);
}`
      });
    }

    return funcs;
  }, [activePin, pinLetter, pinBit, selectedMCU, currentProfile.name]);

  // Set active function if current one not in list
  React.useEffect(() => {
    if (!alternateFunctions.some((f) => f.id === activeFuncId)) {
      setActiveFuncId(alternateFunctions[0]?.id || 'gpio');
    }
  }, [alternateFunctions, activeFuncId]);

  const activeFunction = useMemo(() => {
    return alternateFunctions.find((f) => f.id === activeFuncId) || alternateFunctions[0];
  }, [alternateFunctions, activeFuncId]);

  const handleCopyCode = () => {
    if (!activeFunction) return;
    navigator.clipboard.writeText(activeFunction.codeSnippet);
    setCopiedCode(true);
    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.8 }
    });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Filtered pins for quick search
  const filteredPins = useMemo(() => {
    if (!searchFilter.trim()) return currentPort.pins;
    const q = searchFilter.toLowerCase();
    return allMcuPins.filter(
      (p) =>
        p.pin.toLowerCase().includes(q) ||
        p.alt.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.arduino.toLowerCase().includes(q)
    );
  }, [currentPort.pins, allMcuPins, searchFilter]);

  return (
    <div id="pin-multiplexing-simulator-section" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur shadow-2xl space-y-6 scroll-mt-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <Layers className="w-3.5 h-3.5" /> 핀 멀티플렉싱 시뮬레이터 (Pin Multiplexing Simulator)
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              SFR Register Bit Mapper & Peripheral Override Analyzer
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-xs font-mono font-bold">
              {currentProfile.name} ({currentProfile.io}개 I/O)
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            핀 멀티플렉싱 시뮬레이터 (Pin Multiplexing Simulator)
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            MCU의 특정 핀을 선택하면, 해당 핀이 공유하는 모든 대체 기능(USART, SPI, I2C, ADC, Timer/PWM, External Interrupt 등)을
            시각적으로 하이라이트하고, 해당 기능을 물리적으로 활성화하기 위해 설정해야 할 <strong className="text-cyan-300 font-mono">SFR 제어 레지스터 및 비트 필드</strong>를 실시간으로 보여줍니다.
          </p>
        </div>

        {/* Quick MCU Switcher */}
        {onSelectMCU && (
          <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 shrink-0">
            {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
              <button
                key={mcuId}
                onClick={() => {
                  onSelectMCU(mcuId);
                  setSearchFilter('');
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                  selectedMCU === mcuId
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {MCU_PROFILES[mcuId].name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pin Selection Bar: Port Group Selector & Search */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            1. 분석할 대상 핀 선택 (Port & Pin Selector):
          </label>

          {/* Quick Search Input */}
          <div className="relative sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="핀 이름 검색 (예: MOSI, SDA, RXD, D13)..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Port Group Tabs (if not searching across all pins) */}
        {!searchFilter && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            <span className="text-xs font-mono text-slate-400 mr-1 shrink-0">포트 그룹:</span>
            {portKeys.map((pKey) => {
              const isSelected = selectedPortKey === pKey;
              return (
                <button
                  key={pKey}
                  onClick={() => setSelectedPortKey(pKey)}
                  className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition shrink-0 border ${
                    isSelected
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {pKey}
                </button>
              );
            })}
          </div>
        )}

        {/* Pin Buttons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 pt-1">
          {filteredPins.map((pin) => {
            const isSelected = pin.pin === selectedPinName;
            return (
              <button
                key={pin.pin}
                onClick={() => {
                  setSelectedPinName(pin.pin);
                  if (onNavigateToPin) onNavigateToPin(pin.pin);
                }}
                className={`p-2.5 rounded-xl text-left border transition relative overflow-hidden ${
                  isSelected
                    ? 'bg-cyan-500/20 text-white border-cyan-400 shadow-lg ring-1 ring-cyan-500/40'
                    : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono text-cyan-300">{pin.pin}</span>
                  {pin.physicalPin && (
                    <span className="text-[10px] text-slate-500 font-mono">P{pin.physicalPin}</span>
                  )}
                </div>
                <div className="text-[10px] text-amber-300 truncate mt-0.5 font-mono">{pin.arduino}</div>
                <div className="text-[10px] text-slate-400 truncate opacity-80">{pin.alt || 'GPIO Only'}</div>
                {isSelected && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-cyan-400 rounded-tl-md" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Pin Snapshot Banner */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-black font-mono text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              {activePin.pin}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
              아두이노 {activePin.arduino}
            </span>
            {activePin.physicalPin && (
              <span className="text-xs px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 font-mono">
                물리 패키지 Pin #{activePin.physicalPin}
              </span>
            )}
            <span className="text-xs px-2.5 py-0.5 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-mono">
              총 {alternateFunctions.length}개 기능 멀티플렉싱 지원
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono">{activePin.name} • {activePin.desc}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-right shrink-0">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">초기 리셋 기본 상태</span>
          <span className="text-xs font-mono font-bold text-amber-400">High-Z Tri-state (플로팅 입력)</span>
        </div>
      </div>

      {/* 2. Alternate Functions Navigation Tabs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            2. {activePin.pin} 핀의 지원 대체 기능 목록 (클릭하여 시뮬레이션):
          </label>
          <span className="text-[11px] font-mono text-slate-400">
            원하는 대체 기능을 클릭하면 활성화 레지스터 비트가 즉시 표시됩니다.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {alternateFunctions.map((fn) => {
            const isSelected = fn.id === activeFuncId;
            return (
              <button
                key={fn.id}
                onClick={() => setActiveFuncId(fn.id)}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between space-y-2 relative ${
                  isSelected
                    ? `${fn.badgeColor} ${fn.badgeBorder} shadow-lg ring-2 ring-cyan-500/50 scale-[1.01]`
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold font-mono tracking-tight text-white">{fn.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-slate-900/90 text-slate-300 border border-slate-700 shrink-0">
                    {fn.direction}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {fn.description}
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono border-t border-slate-800/80 pt-1.5 mt-1">
                  <span className="text-cyan-400">{fn.badgeText}</span>
                  <span className={isSelected ? 'text-white font-bold' : 'text-slate-500'}>
                    {isSelected ? '● 활성화 중' : '클릭하여 선택'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Real-Time Register Bit Mapping View for Selected Function */}
      {activeFunction && (
        <div className="bg-slate-950/90 border border-cyan-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5">
          {/* Active Function Detail Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {activeFunction.badgeText}
                </span>
                <span className="text-xs text-slate-400 font-mono">신호 방향: {activeFunction.direction}</span>
              </div>
              <h4 className="text-lg font-black text-white flex items-center gap-2">
                <span>{activeFunction.name}</span>
              </h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {activeFunction.description}
              </p>
            </div>

            {/* Hardware Override Notice */}
            <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/30 text-amber-300 text-xs sm:max-w-md space-y-1 shrink-0">
              <span className="font-bold flex items-center gap-1.5 text-amber-400 font-mono text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5" /> 하드웨어 오버라이드 (Override) 규칙:
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {activeFunction.overrideBehavior}
              </p>
            </div>
          </div>

          {/* Interactive Register Bit Field Inspector */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Binary className="w-4 h-4 text-cyan-400" />
                활성화 필수 SFR 제어 레지스터 및 비트 필드 매핑
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {activeFunction.registers.length}개 레지스터 조작 필요
              </span>
            </div>

            <div className="space-y-3">
              {activeFunction.registers.map((reg, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black font-mono text-amber-400">{reg.regName}</span>
                      <span className="text-xs text-slate-400">({reg.regDesc})</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-slate-400">조작 비트:</span>
                      <span className="px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/40 font-bold">
                        Bit {reg.bitIndex} ({reg.bitName}) = {reg.targetValue}
                      </span>
                    </div>
                  </div>

                  {/* Visual 8-Bit Register Layout */}
                  <div className="space-y-1">
                    <div className="text-[11px] text-slate-400 font-mono flex justify-between">
                      <span>8-비트 레지스터 슬롯 레이아웃:</span>
                      <span className="text-cyan-400 font-semibold">MSB (Bit 7) $\rightarrow$ LSB (Bit 0)</span>
                    </div>
                    <div className="grid grid-cols-8 gap-1 text-center font-mono text-xs">
                      {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => {
                        const isTargetBit = bit === reg.bitIndex;
                        return (
                          <div
                            key={bit}
                            className={`p-2 rounded-lg border transition ${
                              isTargetBit
                                ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400 ring-2 ring-cyan-500/50 shadow-md font-bold'
                                : 'bg-slate-950 text-slate-500 border-slate-800'
                            }`}
                          >
                            <div className="text-[10px] opacity-75">Bit {bit}</div>
                            <div className="text-xs font-black truncate my-0.5">
                              {isTargetBit ? reg.bitName : '-'}
                            </div>
                            <div
                              className={`text-[10px] px-1 rounded ${
                                isTargetBit
                                  ? 'bg-cyan-400 text-slate-950 font-black'
                                  : 'text-slate-600'
                              }`}
                            >
                              {isTargetBit ? reg.targetValue : '0'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 font-mono bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                    💡 <strong>역할 및 동작:</strong> {reg.purpose}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Bare-Metal C Initialization Code Generator */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-slate-900 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono font-bold text-white">
                  C 언어 레지스터 초기화 루틴 ({activePin.pin} $\rightarrow$ {activeFunction.name})
                </span>
              </div>
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? '복사 완료!' : '초기화 C 코드 복사'}</span>
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-64 custom-scrollbar leading-relaxed">
              {activeFunction.codeSnippet}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
