import React, { useState, useMemo } from 'react';
import {
  GitCompare,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Search,
  Filter,
  Copy,
  Check,
  Cpu,
  Layers,
  ArrowLeftRight,
  ShieldAlert,
  Info,
  Code2,
  Sliders,
  Sparkles,
  ExternalLink,
  Table
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type PeripheralCategory = 'all' | 'usart' | 'twi' | 'spi' | 'timer' | 'ext_int';

export interface BitFieldInfo {
  bit: number;
  name: string;
  desc: string;
  rw: string;
  initial: string;
  isReserved?: boolean;
}

export interface RegisterDiffSpec {
  name: string;
  category: PeripheralCategory;
  categoryLabel: string;
  title: string;
  description: string;

  // MCU A Specs
  mcuA: {
    supported: boolean;
    ioAddr?: string;
    memAddr?: string;
    isExtendedIo?: boolean; // > 0x3F: cannot use in/out, must use lds/sts
    bits: BitFieldInfo[];
    notes?: string;
  };

  // MCU B Specs
  mcuB: {
    supported: boolean;
    ioAddr?: string;
    memAddr?: string;
    isExtendedIo?: boolean;
    bits: BitFieldInfo[];
    notes?: string;
  };

  severity: 'critical' | 'warning' | 'info' | 'identical';
  diffSummary: string;
  migrationCodeSnippet?: string;
}

export const RegisterDiffTool: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const [mcuA, setMcuA] = useState<SupportedMCU>(selectedMCU);
  const [mcuB, setMcuB] = useState<SupportedMCU>(
    selectedMCU === 'atmega328p' ? 'atmega128' : 'atmega328p'
  );

  const [activeCategory, setActiveCategory] = useState<PeripheralCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRegName, setSelectedRegName] = useState<string>('TWCR');
  const [selectedBitIndex, setSelectedBitIndex] = useState<number | null>(7);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Sync if selectedMCU from parent changes
  React.useEffect(() => {
    if (mcuA !== selectedMCU) {
      setMcuA(selectedMCU);
      if (mcuB === selectedMCU) {
        setMcuB(selectedMCU === 'atmega328p' ? 'atmega128' : 'atmega328p');
      }
    }
  }, [selectedMCU]);

  const swapMcus = () => {
    const temp = mcuA;
    setMcuA(mcuB);
    setMcuB(temp);
  };

  // Master Database of Shared Peripheral Registers and their bitfields across 328P, 128, and 640
  const registerDatabase = useMemo<RegisterDiffSpec[]>(() => {
    // Helper to extract MCU specific hardware info
    const getSpecs = (regName: string, mcu: SupportedMCU) => {
      // --- TWI (I2C) REGISTERS ---
      if (regName === 'TWBR') {
        if (mcu === 'atmega128') {
          return {
            supported: true,
            ioAddr: '0x54',
            memAddr: '0x74',
            isExtendedIo: true,
            bits: [
              { bit: 7, name: 'TWBR7', desc: 'TWI 비트레이트 분주비 비트 7', rw: 'R/W', initial: '0' },
              { bit: 6, name: 'TWBR6', desc: '비트레이트 분주비 비트 6', rw: 'R/W', initial: '0' },
              { bit: 5, name: 'TWBR5', desc: '비트레이트 분주비 비트 5', rw: 'R/W', initial: '0' },
              { bit: 4, name: 'TWBR4', desc: '비트레이트 분주비 비트 4', rw: 'R/W', initial: '0' },
              { bit: 3, name: 'TWBR3', desc: '비트레이트 분주비 비트 3', rw: 'R/W', initial: '0' },
              { bit: 2, name: 'TWBR2', desc: '비트레이트 분주비 비트 2', rw: 'R/W', initial: '0' },
              { bit: 1, name: 'TWBR1', desc: '비트레이트 분주비 비트 1', rw: 'R/W', initial: '0' },
              { bit: 0, name: 'TWBR0', desc: '비트레이트 분주비 비트 0', rw: 'R/W', initial: '0' }
            ]
          };
        } else {
          // atmega328p & atmega640
          return {
            supported: true,
            ioAddr: '0x98',
            memAddr: '0xB8',
            isExtendedIo: true,
            bits: [
              { bit: 7, name: 'TWBR7', desc: 'TWI 비트레이트 분주비 비트 7', rw: 'R/W', initial: '0' },
              { bit: 6, name: 'TWBR6', desc: '비트레이트 분주비 비트 6', rw: 'R/W', initial: '0' },
              { bit: 5, name: 'TWBR5', desc: '비트레이트 분주비 비트 5', rw: 'R/W', initial: '0' },
              { bit: 4, name: 'TWBR4', desc: '비트레이트 분주비 비트 4', rw: 'R/W', initial: '0' },
              { bit: 3, name: 'TWBR3', desc: '비트레이트 분주비 비트 3', rw: 'R/W', initial: '0' },
              { bit: 2, name: 'TWBR2', desc: '비트레이트 분주비 비트 2', rw: 'R/W', initial: '0' },
              { bit: 1, name: 'TWBR1', desc: '비트레이트 분주비 비트 1', rw: 'R/W', initial: '0' },
              { bit: 0, name: 'TWBR0', desc: '비트레이트 분주비 비트 0', rw: 'R/W', initial: '0' }
            ]
          };
        }
      }

      if (regName === 'TWCR') {
        const ioAddr = mcu === 'atmega128' ? '0x56' : '0x9C';
        const memAddr = mcu === 'atmega128' ? '0x76' : '0xBC';
        return {
          supported: true,
          ioAddr,
          memAddr,
          isExtendedIo: true,
          bits: [
            { bit: 7, name: 'TWINT', desc: 'TWI 인터럽트 플래그 (1 쓰기로 클리어 & 하드웨어 실행 재개)', rw: 'R/W', initial: '0' },
            { bit: 6, name: 'TWEA', desc: 'TWI ACK 활성화 비트 (ACK 응답 신호 전송 여부)', rw: 'R/W', initial: '0' },
            { bit: 5, name: 'TWSTA', desc: 'TWI START 조건 생성 비트 (마스터 버스 점유 시작)', rw: 'R/W', initial: '0' },
            { bit: 4, name: 'TWSTO', desc: 'TWI STOP 조건 생성 비트 (마스터 전송 종료)', rw: 'R/W', initial: '0' },
            { bit: 3, name: 'TWWC', desc: 'TWI 쓰기 충돌 플래그 (Write Collision Flag)', rw: 'R', initial: '0' },
            { bit: 2, name: 'TWEN', desc: 'TWI 하드웨어 활성화 비트 (SDA/SCL 핀 인터페이스 가동)', rw: 'R/W', initial: '0' },
            { bit: 1, name: '-', desc: '예약된 비트 (항상 0)', rw: 'R', initial: '0', isReserved: true },
            { bit: 0, name: 'TWIE', desc: 'TWI 인터럽트 활성화 비트 (TWINT 인터럽트 발생)', rw: 'R/W', initial: '0' }
          ]
        };
      }

      if (regName === 'TWSR') {
        const ioAddr = mcu === 'atmega128' ? '0x53' : '0x99';
        const memAddr = mcu === 'atmega128' ? '0x73' : '0xB9';
        return {
          supported: true,
          ioAddr,
          memAddr,
          isExtendedIo: true,
          bits: [
            { bit: 7, name: 'TWS7', desc: 'TWI 상태 코드 비트 7', rw: 'R', initial: '1' },
            { bit: 6, name: 'TWS6', desc: 'TWI 상태 코드 비트 6', rw: 'R', initial: '1' },
            { bit: 5, name: 'TWS5', desc: 'TWI 상태 코드 비트 5', rw: 'R', initial: '1' },
            { bit: 4, name: 'TWS4', desc: 'TWI 상태 코드 비트 4', rw: 'R', initial: '1' },
            { bit: 3, name: 'TWS3', desc: 'TWI 상태 코드 비트 3', rw: 'R', initial: '1' },
            { bit: 2, name: '-', desc: '예약된 비트 (항상 0)', rw: 'R', initial: '0', isReserved: true },
            { bit: 1, name: 'TWPS1', desc: 'TWI 프리스케일러 상위 비트 (분주비 1, 4, 16, 64)', rw: 'R/W', initial: '0' },
            { bit: 0, name: 'TWPS0', desc: 'TWI 프리스케일러 하위 비트', rw: 'R/W', initial: '0' }
          ]
        };
      }

      if (regName === 'TWAMR') {
        if (mcu === 'atmega128') {
          return {
            supported: false,
            bits: [],
            notes: 'ATmega128에는 TWAMR(주소 마스크 레지스터)이 물리적으로 존재하지 않습니다! 하드웨어 다중 슬레이브 주소 필터링 불가.'
          };
        } else {
          return {
            supported: true,
            ioAddr: '0x9D',
            memAddr: '0xBD',
            isExtendedIo: true,
            bits: [
              { bit: 7, name: 'TWAM6', desc: '슬레이브 주소 마스크 비트 6 (1=비교 무시)', rw: 'R/W', initial: '0' },
              { bit: 6, name: 'TWAM5', desc: '슬레이브 주소 마스크 비트 5', rw: 'R/W', initial: '0' },
              { bit: 5, name: 'TWAM4', desc: '슬레이브 주소 마스크 비트 4', rw: 'R/W', initial: '0' },
              { bit: 4, name: 'TWAM3', desc: '슬레이브 주소 마스크 비트 3', rw: 'R/W', initial: '0' },
              { bit: 3, name: 'TWAM2', desc: '슬레이브 주소 마스크 비트 2', rw: 'R/W', initial: '0' },
              { bit: 2, name: 'TWAM1', desc: '슬레이브 주소 마스크 비트 1', rw: 'R/W', initial: '0' },
              { bit: 1, name: 'TWAM0', desc: '슬레이브 주소 마스크 비트 0', rw: 'R/W', initial: '0' },
              { bit: 0, name: '-', desc: '예약된 비트 (항상 0)', rw: 'R', initial: '0', isReserved: true }
            ]
          };
        }
      }

      // --- USART REGISTERS ---
      if (regName === 'UCSR0A') {
        if (mcu === 'atmega128') {
          return {
            supported: true,
            ioAddr: '0x0B',
            memAddr: '0x2B',
            isExtendedIo: false, // Standard I/O, in/out accessible!
            bits: [
              { bit: 7, name: 'RXC0', desc: 'USART0 수신 완료 플래그 (수신 버퍼 읽기 시 클리어)', rw: 'R', initial: '0' },
              { bit: 6, name: 'TXC0', desc: 'USART0 송신 완료 플래그 (TX 버퍼 및 시프트 레지스터 방출 완료)', rw: 'R/W', initial: '0' },
              { bit: 5, name: 'UDRE0', desc: 'USART0 송신 데이터 레지스터 빈 상태 플래그 (1이면 쓰기 가능)', rw: 'R', initial: '1' },
              { bit: 4, name: 'FE0', desc: '프레임 에러 플래그 (Frame Error)', rw: 'R', initial: '0' },
              { bit: 3, name: 'DOR0', desc: '데이터 오버런 플래그 (Data OverRun)', rw: 'R', initial: '0' },
              { bit: 2, name: 'UPE0', desc: '패리티 에러 (Parity Error / 구형 데이터시트에선 PE0)', rw: 'R', initial: '0' },
              { bit: 1, name: 'U2X0', desc: '2배속 비동기 통신 모드 활성화 (분주비 16 -> 8)', rw: 'R/W', initial: '0' },
              { bit: 0, name: 'MPCM0', desc: '다중 프로세서 통신 모드 (Multi-processor Communication)', rw: 'R/W', initial: '0' }
            ],
            notes: 'ATmega128은 I/O 0x0B에 위치하여 in/out 명령어가 1클럭으로 고속 접근 가능합니다.'
          };
        } else {
          // atmega328p & atmega640
          return {
            supported: true,
            ioAddr: '0xA0',
            memAddr: '0xC0',
            isExtendedIo: true, // Extended I/O! Cannot use in/out!
            bits: [
              { bit: 7, name: 'RXC0', desc: 'USART0 수신 완료 플래그', rw: 'R', initial: '0' },
              { bit: 6, name: 'TXC0', desc: 'USART0 송신 완료 플래그', rw: 'R/W', initial: '0' },
              { bit: 5, name: 'UDRE0', desc: 'USART0 송신 버퍼 빈 상태', rw: 'R', initial: '1' },
              { bit: 4, name: 'FE0', desc: '프레임 에러', rw: 'R', initial: '0' },
              { bit: 3, name: 'DOR0', desc: '데이터 오버런', rw: 'R', initial: '0' },
              { bit: 2, name: 'UPE0', desc: '패리티 에러', rw: 'R', initial: '0' },
              { bit: 1, name: 'U2X0', desc: '2배속 모드', rw: 'R/W', initial: '0' },
              { bit: 0, name: 'MPCM0', desc: '다중 프로세서 모드', rw: 'R/W', initial: '0' }
            ],
            notes: '확장 I/O(0xC0)에 배치되어 in/out 어셈블리 사용 불가, 반드시 lds/sts 명령어로 2클럭 소요!'
          };
        }
      }

      if (regName === 'UCSR0B') {
        const is128 = mcu === 'atmega128';
        return {
          supported: true,
          ioAddr: is128 ? '0x0A' : '0xA1',
          memAddr: is128 ? '0x2A' : '0xC1',
          isExtendedIo: !is128,
          bits: [
            { bit: 7, name: 'RXCIE0', desc: '수신 완료 인터럽트 활성화', rw: 'R/W', initial: '0' },
            { bit: 6, name: 'TXCIE0', desc: '송신 완료 인터럽트 활성화', rw: 'R/W', initial: '0' },
            { bit: 5, name: 'UDRIE0', desc: '송신 데이터 버퍼 빈 상태 인터럽트 활성화', rw: 'R/W', initial: '0' },
            { bit: 4, name: 'RXEN0', desc: '수신부(Receiver) 하드웨어 활성화', rw: 'R/W', initial: '0' },
            { bit: 3, name: 'TXEN0', desc: '송신부(Transmitter) 하드웨어 활성화', rw: 'R/W', initial: '0' },
            { bit: 2, name: 'UCSZ02', desc: '데이터 문자 길이 9비트 선택 비트', rw: 'R/W', initial: '0' },
            { bit: 1, name: 'RXB80', desc: '9비트 모드 수신 9번째 데이터 비트', rw: 'R', initial: '0' },
            { bit: 0, name: 'TXB80', desc: '9비트 모드 송신 9번째 데이터 비트', rw: 'R/W', initial: '0' }
          ]
        };
      }

      if (regName === 'UCSR0C') {
        const is128 = mcu === 'atmega128';
        return {
          supported: true,
          ioAddr: is128 ? '0x20' : '0xA2',
          memAddr: is128 ? '0x95' : '0xC2', // On Mega128, UCSR0C is special mapping at 0x95 in SRAM space
          isExtendedIo: true,
          bits: is128
            ? [
                { bit: 7, name: '-', desc: '예약된 비트', rw: 'R', initial: '0', isReserved: true },
                { bit: 6, name: 'UMSEL0', desc: '동기/비동기 모드 선택 (0=비동기 UART, 1=동기 USRT)', rw: 'R/W', initial: '0' },
                { bit: 5, name: 'UPM01', desc: '패리티 모드 비트 1 (00=None, 10=Even, 11=Odd)', rw: 'R/W', initial: '0' },
                { bit: 4, name: 'UPM00', desc: '패리티 모드 비트 0', rw: 'R/W', initial: '0' },
                { bit: 3, name: 'USBS0', desc: '스톱 비트 선택 (0=1-bit, 1=2-bit)', rw: 'R/W', initial: '0' },
                { bit: 2, name: 'UCSZ01', desc: '문자 크기 선택 비트 1', rw: 'R/W', initial: '1' },
                { bit: 1, name: 'UCSZ00', desc: '문자 크기 선택 비트 0 (011=8비트 데이터)', rw: 'R/W', initial: '1' },
                { bit: 0, name: 'UCPOL0', desc: '클럭 극성 (동기 모드 전용)', rw: 'R/W', initial: '0' }
              ]
            : [
                { bit: 7, name: 'UMSEL01', desc: '동기/MSPIM 모드 상위 비트 (00=UART, 01=Sync, 11=Master SPI)', rw: 'R/W', initial: '0' },
                { bit: 6, name: 'UMSEL00', desc: '동기/MSPIM 모드 하위 비트', rw: 'R/W', initial: '0' },
                { bit: 5, name: 'UPM01', desc: '패리티 모드 비트 1', rw: 'R/W', initial: '0' },
                { bit: 4, name: 'UPM00', desc: '패리티 모드 비트 0', rw: 'R/W', initial: '0' },
                { bit: 3, name: 'USBS0', desc: '스톱 비트 선택 (0=1-bit, 1=2-bit)', rw: 'R/W', initial: '0' },
                { bit: 2, name: 'UCSZ01', desc: '문자 크기 선택 비트 1', rw: 'R/W', initial: '1' },
                { bit: 1, name: 'UCSZ00', desc: '문자 크기 선택 비트 0', rw: 'R/W', initial: '1' },
                { bit: 0, name: 'UCPOL0', desc: '클럭 극성 (동기 모드 전용)', rw: 'R/W', initial: '0' }
              ],
          notes: is128
            ? 'ATmega128은 Bit 7이 미사용 예약 비트이나, ATmega328P/640은 Bit 7:6이 UMSEL01:00으로 확장되어 Master SPI(MSPIM) 모드를 지원합니다!'
            : 'Bit 7:6이 UMSEL01:00으로 2비트 분할되어 하드웨어 고속 MSPIM(Master SPI) 모드를 추가 지원합니다.'
        };
      }

      if (regName === 'UCSR1A') {
        if (mcu === 'atmega328p') {
          return {
            supported: false,
            bits: [],
            notes: 'ATmega328P는 단일 채널(USART0)만 존재하며 USART1이 하드웨어적으로 없습니다! 멀티 시리얼 구현 시 SoftwareSerial 또는 Mega128/640 전환 필수.'
          };
        } else if (mcu === 'atmega128') {
          return {
            supported: true,
            ioAddr: '0x9B',
            memAddr: '0x9B',
            isExtendedIo: true,
            bits: [
              { bit: 7, name: 'RXC1', desc: 'USART1 수신 완료', rw: 'R', initial: '0' },
              { bit: 6, name: 'TXC1', desc: 'USART1 송신 완료', rw: 'R/W', initial: '0' },
              { bit: 5, name: 'UDRE1', desc: 'USART1 송신 버퍼 빈 상태', rw: 'R', initial: '1' },
              { bit: 4, name: 'FE1', desc: '프레임 에러', rw: 'R', initial: '0' },
              { bit: 3, name: 'DOR1', desc: '데이터 오버런', rw: 'R', initial: '0' },
              { bit: 2, name: 'UPE1', desc: '패리티 에러', rw: 'R', initial: '0' },
              { bit: 1, name: 'U2X1', desc: '2배속 모드', rw: 'R/W', initial: '0' },
              { bit: 0, name: 'MPCM1', desc: '다중 프로세서 통신', rw: 'R/W', initial: '0' }
            ]
          };
        } else {
          // atmega640
          return {
            supported: true,
            ioAddr: '0xA8',
            memAddr: '0xC8',
            isExtendedIo: true,
            bits: [
              { bit: 7, name: 'RXC1', desc: 'USART1 수신 완료', rw: 'R', initial: '0' },
              { bit: 6, name: 'TXC1', desc: 'USART1 송신 완료', rw: 'R/W', initial: '0' },
              { bit: 5, name: 'UDRE1', desc: 'USART1 송신 버퍼 빈 상태', rw: 'R', initial: '1' },
              { bit: 4, name: 'FE1', desc: '프레임 에러', rw: 'R', initial: '0' },
              { bit: 3, name: 'DOR1', desc: '데이터 오버런', rw: 'R', initial: '0' },
              { bit: 2, name: 'UPE1', desc: '패리티 에러', rw: 'R', initial: '0' },
              { bit: 1, name: 'U2X1', desc: '2배속 모드', rw: 'R/W', initial: '0' },
              { bit: 0, name: 'MPCM1', desc: '다중 프로세서 통신', rw: 'R/W', initial: '0' }
            ]
          };
        }
      }

      // --- SPI REGISTERS ---
      if (regName === 'SPCR') {
        const ioAddr = mcu === 'atmega128' ? '0x0D' : '0x2C';
        const memAddr = mcu === 'atmega128' ? '0x2D' : '0x4C';
        return {
          supported: true,
          ioAddr,
          memAddr,
          isExtendedIo: false, // Standard I/O, in/out accessible on all!
          bits: [
            { bit: 7, name: 'SPIE', desc: 'SPI 인터럽트 활성화', rw: 'R/W', initial: '0' },
            { bit: 6, name: 'SPE', desc: 'SPI 하드웨어 활성화', rw: 'R/W', initial: '0' },
            { bit: 5, name: 'DORD', desc: '데이터 순서 (0=MSB first, 1=LSB first)', rw: 'R/W', initial: '0' },
            { bit: 4, name: 'MSTR', desc: '마스터/슬레이브 선택 (1=Master, 0=Slave)', rw: 'R/W', initial: '0' },
            { bit: 3, name: 'CPOL', desc: '클럭 극성 (0=SCK low idle, 1=SCK high idle)', rw: 'R/W', initial: '0' },
            { bit: 2, name: 'CPHA', desc: '클럭 위상 (0=Leading edge sample, 1=Trailing edge sample)', rw: 'R/W', initial: '0' },
            { bit: 1, name: 'SPR1', desc: 'SPI 클럭 분주비 비트 1', rw: 'R/W', initial: '0' },
            { bit: 0, name: 'SPR0', desc: 'SPI 클럭 분주비 비트 0 (00=f/4, 01=f/16, 10=f/64, 11=f/128)', rw: 'R/W', initial: '0' }
          ]
        };
      }

      // --- TIMER0 REGISTERS ---
      if (regName === 'TCCR0A') {
        if (mcu === 'atmega128') {
          return {
            supported: false,
            bits: [],
            notes: 'ATmega128에는 TCCR0A가 없습니다! 단일 TCCR0 레지스터에 FOC0, COM01:0, WGM01:0, CS02:0 비트가 합쳐져 있습니다.'
          };
        } else {
          // 328p & 640
          return {
            supported: true,
            ioAddr: '0x24',
            memAddr: '0x44',
            isExtendedIo: false,
            bits: [
              { bit: 7, name: 'COM0A1', desc: '비교 출력 모드 A 비트 1 (OC0A 핀 동작 제어)', rw: 'R/W', initial: '0' },
              { bit: 6, name: 'COM0A0', desc: '비교 출력 모드 A 비트 0', rw: 'R/W', initial: '0' },
              { bit: 5, name: 'COM0B1', desc: '비교 출력 모드 B 비트 1 (OC0B 핀 동작 제어)', rw: 'R/W', initial: '0' },
              { bit: 4, name: 'COM0B0', desc: '비교 출력 모드 B 비트 0', rw: 'R/W', initial: '0' },
              { bit: 3, name: '-', desc: '예약된 비트', rw: 'R', initial: '0', isReserved: true },
              { bit: 2, name: '-', desc: '예약된 비트', rw: 'R', initial: '0', isReserved: true },
              { bit: 1, name: 'WGM01', desc: '파형 생성 모드 비트 1 (CTC, Fast PWM 등)', rw: 'R/W', initial: '0' },
              { bit: 0, name: 'WGM00', desc: '파형 생성 모드 비트 0', rw: 'R/W', initial: '0' }
            ]
          };
        }
      }

      if (regName === 'TIMSK0') {
        if (mcu === 'atmega128') {
          return {
            supported: false,
            bits: [],
            notes: 'ATmega128은 타이머별 독립 TIMSK0가 없고, 구형 공유 레지스터 TIMSK (0x37) 및 ETIMSK (0x7D)를 사용합니다.'
          };
        } else {
          return {
            supported: true,
            ioAddr: '0x4E',
            memAddr: '0x6E',
            isExtendedIo: true,
            bits: [
              { bit: 7, name: '-', desc: '예약된 비트', rw: 'R', initial: '0', isReserved: true },
              { bit: 6, name: '-', desc: '예약된 비트', rw: 'R', initial: '0', isReserved: true },
              { bit: 5, name: '-', desc: '예약된 비트', rw: 'R', initial: '0', isReserved: true },
              { bit: 4, name: '-', desc: '예약된 비트', rw: 'R', initial: '0', isReserved: true },
              { bit: 3, name: '-', desc: '예약된 비트', rw: 'R', initial: '0', isReserved: true },
              { bit: 2, name: 'OCIE0B', desc: '타이머 0 비교일치 B 인터럽트 활성화', rw: 'R/W', initial: '0' },
              { bit: 1, name: 'OCIE0A', desc: '타이머 0 비교일치 A 인터럽트 활성화', rw: 'R/W', initial: '0' },
              { bit: 0, name: 'TOIE0', desc: '타이머 0 오버플로 인터럽트 활성화', rw: 'R/W', initial: '0' }
            ]
          };
        }
      }

      return { supported: false, bits: [] };
    };

    const registerList: Array<{ name: string; category: PeripheralCategory; categoryLabel: string; title: string; desc: string }> = [
      { name: 'TWCR', category: 'twi', categoryLabel: 'I2C / TWI', title: 'TWI 제어 레지스터 (TWCR)', desc: 'TWI 버스 전송 시작/중지 및 인터럽트 제어' },
      { name: 'TWSR', category: 'twi', categoryLabel: 'I2C / TWI', title: 'TWI 상태 레지스터 (TWSR)', desc: 'TWI 버스 상태 코드 및 프리스케일러 분주비' },
      { name: 'TWBR', category: 'twi', categoryLabel: 'I2C / TWI', title: 'TWI 비트레이트 분주 레지스터 (TWBR)', desc: 'I2C 클럭 속도 결정 분주 레지스터' },
      { name: 'TWAMR', category: 'twi', categoryLabel: 'I2C / TWI', title: 'TWI 주소 마스크 레지스터 (TWAMR)', desc: '하드웨어 다중 슬레이브 어드레스 필터링 마스크' },
      { name: 'UCSR0A', category: 'usart', categoryLabel: 'USART0', title: 'USART0 제어 및 상태 A (UCSR0A)', desc: '수신/송신 완료 플래그 및 2배속 U2X 모드' },
      { name: 'UCSR0B', category: 'usart', categoryLabel: 'USART0', title: 'USART0 제어 및 상태 B (UCSR0B)', desc: 'TXEN/RXEN 송수신부 인에이블 및 인터럽트 활성화' },
      { name: 'UCSR0C', category: 'usart', categoryLabel: 'USART0', title: 'USART0 제어 및 상태 C (UCSR0C)', desc: '패리티, 스톱비트 및 동기/비동기/MSPIM 모드' },
      { name: 'UCSR1A', category: 'usart', categoryLabel: 'USART1', title: 'USART1 제어 및 상태 A (UCSR1A)', desc: '2번째 하드웨어 시리얼 채널 제어 레지스터' },
      { name: 'SPCR', category: 'spi', categoryLabel: 'SPI', title: 'SPI 제어 레지스터 (SPCR)', desc: 'SPI 마스터/슬레이브, 데이터 순서, 클럭 극성 및 속도' },
      { name: 'TCCR0A', category: 'timer', categoryLabel: 'Timer0', title: '타이머0 제어 레지스터 A (TCCR0A)', desc: '비교 출력 모드 COM 및 파형 생성 WGM 비트' },
      { name: 'TIMSK0', category: 'timer', categoryLabel: 'Timer0', title: '타이머0 인터럽트 마스크 (TIMSK0)', desc: '오버플로 및 비교일치 인터럽트 활성화' }
    ];

    return registerList.map((item) => {
      const specA = getSpecs(item.name, mcuA);
      const specB = getSpecs(item.name, mcuB);

      let severity: 'critical' | 'warning' | 'info' | 'identical' = 'identical';
      let diffSummary = '두 MCU 간에 레지스터 비트맵과 동작 구조가 동일합니다.';

      if (!specA.supported && specB.supported) {
        severity = 'critical';
        diffSummary = `${MCU_PROFILES[mcuA].name}에는 존재하지 않으며, ${MCU_PROFILES[mcuB].name} 전용 레지스터입니다.`;
      } else if (specA.supported && !specB.supported) {
        severity = 'critical';
        diffSummary = `${MCU_PROFILES[mcuA].name}에만 존재하며, ${MCU_PROFILES[mcuB].name}로 포팅 시 하드웨어 부재로 빌드 에러가 발생합니다.`;
      } else if (specA.isExtendedIo !== specB.isExtendedIo) {
        severity = 'warning';
        diffSummary = `주소 매핑 차이: 한쪽은 저위 I/O(in/out 가용), 다른 쪽은 확장 I/O(0x3F 초과, lds/sts 강제)에 배치되어 있습니다.`;
      } else if (specA.ioAddr !== specB.ioAddr) {
        severity = 'info';
        diffSummary = `레지스터 I/O 주소가 다릅니다 (${specA.ioAddr} vs ${specB.ioAddr}). C 언어 헤더 매크로 사용 시 호환되나 하드코딩된 주소는 수정 필요.`;
      }

      // Check bit discrepancy
      if (specA.supported && specB.supported) {
        const hasBitMismatch = specA.bits.some((bA, idx) => {
          const bB = specB.bits[idx];
          return bA && bB && bA.name !== bB.name;
        });
        if (hasBitMismatch) {
          severity = 'warning';
          diffSummary = `비트 필드 구성 불일치: 일부 비트의 이름이나 기능이 확장/재배치되었습니다.`;
        }
      }

      return {
        name: item.name,
        category: item.category,
        categoryLabel: item.categoryLabel,
        title: item.title,
        description: item.desc,
        mcuA: specA,
        mcuB: specB,
        severity,
        diffSummary
      };
    });
  }, [mcuA, mcuB]);

  // Filtered registers
  const filteredRegisters = useMemo(() => {
    return registerDatabase.filter((reg) => {
      const matchesCategory = activeCategory === 'all' || reg.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        reg.name.toLowerCase().includes(q) ||
        reg.title.toLowerCase().includes(q) ||
        reg.description.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [registerDatabase, activeCategory, searchQuery]);

  // Selected Register Details
  const activeReg = useMemo(() => {
    return (
      registerDatabase.find((r) => r.name === selectedRegName) ||
      registerDatabase[0]
    );
  }, [registerDatabase, selectedRegName]);

  // Copy Portable Migration Code
  const portableCode = useMemo(() => {
    return `// Portable AVR SFR Mapping between ${MCU_PROFILES[mcuA].name} and ${MCU_PROFILES[mcuB].name}
#include <avr/io.h>

#if defined(__AVR_ATmega128__) || defined(__AVR_ATmega128A__)
    // ATmega128 Configuration
    #define TARGET_REG   ${mcuA === 'atmega128' ? (activeReg.mcuA.supported ? activeReg.name : '/* Unmapped */') : (activeReg.mcuB.supported ? activeReg.name : '/* Unmapped */')}
#elif defined(__AVR_ATmega328P__)
    // ATmega328P Configuration
    #define TARGET_REG   ${mcuA === 'atmega328p' ? (activeReg.mcuA.supported ? activeReg.name : '/* Unmapped */') : (activeReg.mcuB.supported ? activeReg.name : '/* Unmapped */')}
#elif defined(__AVR_ATmega640__) || defined(__AVR_ATmega2560__)
    // ATmega640 / 2560 Configuration
    #define TARGET_REG   ${mcuA === 'atmega640' ? (activeReg.mcuA.supported ? activeReg.name : '/* Unmapped */') : (activeReg.mcuB.supported ? activeReg.name : '/* Unmapped */')}
#endif`;
  }, [mcuA, mcuB, activeReg]);

  const copyCode = () => {
    navigator.clipboard.writeText(portableCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-2">
            <GitCompare className="w-3.5 h-3.5" /> Cross-MCU Register & Bit-field Differential Engine
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            SFR 레지스터 비교 도구 (Register Diff Tool)
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            두 개의 서로 다른 AVR MCU를 선택하여 <strong>USART, TWI(I2C), SPI, Timer</strong> 등 공유 주변장치 레지스터의
            <strong> I/O 및 메모리 매핑 주소 차이(Address Differences)</strong>와
            <strong> 8비트 레지스터 비트필드 불일치(Bit-field Discrepancies)</strong>를 인터랙티브하게 비교 분석합니다.
          </p>
        </div>

        {/* Quick MCU Comparison Pair Selectors */}
        <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800 shrink-0">
          {/* MCU A */}
          <div className="text-left">
            <span className="text-[10px] text-cyan-400 font-bold block px-1">MCU A (기준)</span>
            <select
              value={mcuA}
              onChange={(e) => setMcuA(e.target.value as SupportedMCU)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-bold text-white font-mono"
            >
              <option value="atmega2560">ATmega2560</option>
              <option value="atmega640">ATmega640</option>
              <option value="atmega128">ATmega128</option>
              <option value="atmega328p">ATmega328P</option>
            </select>
          </div>

          {/* Swap Button */}
          <button
            onClick={swapMcus}
            title="MCU A와 MCU B 상호 전환"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
          >
            <ArrowLeftRight className="w-4 h-4 text-amber-400" />
          </button>

          {/* MCU B */}
          <div className="text-left">
            <span className="text-[10px] text-amber-400 font-bold block px-1">MCU B (비교 대상)</span>
            <select
              value={mcuB}
              onChange={(e) => setMcuB(e.target.value as SupportedMCU)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-bold text-white font-mono"
            >
              <option value="atmega2560">ATmega2560</option>
              <option value="atmega640">ATmega640</option>
              <option value="atmega128">ATmega128</option>
              <option value="atmega328p">ATmega328P</option>
            </select>
          </div>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          {[
            { id: 'all', label: '전체 레지스터' },
            { id: 'usart', label: 'USART (시리얼)' },
            { id: 'twi', label: 'TWI (I2C)' },
            { id: 'spi', label: 'SPI' },
            { id: 'timer', label: '타이머/카운터' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as PeripheralCategory)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeCategory === cat.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="레지스터 검색 (TWCR, UCSR0A...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Register Selector Grid List */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {filteredRegisters.map((reg) => {
          const isSelected = reg.name === selectedRegName;
          const hasIssue = reg.severity === 'critical';
          const hasDiff = reg.severity === 'warning';

          return (
            <button
              key={reg.name}
              onClick={() => {
                setSelectedRegName(reg.name);
                setSelectedBitIndex(7);
              }}
              className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400/50'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-sm text-cyan-300">{reg.name}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      hasIssue ? 'bg-rose-500' : hasDiff ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  />
                </div>
                <div className="text-[10px] text-slate-400 truncate">{reg.categoryLabel}</div>
              </div>
              <div className="mt-2 text-[10px] font-mono text-slate-500">
                {reg.mcuA.supported ? reg.mcuA.memAddr : 'N/A'} ↔ {reg.mcuB.supported ? reg.mcuB.memAddr : 'N/A'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Interactive Differential Inspector for selectedRegName */}
      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-6">
        {/* Title & Status Alert */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-black text-white">{activeReg.name}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-semibold">
                {activeReg.categoryLabel}
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold font-mono border ${
                  activeReg.severity === 'critical'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : activeReg.severity === 'warning'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}
              >
                {activeReg.severity === 'critical'
                  ? '마이그레이션 결함 (Critical)'
                  : activeReg.severity === 'warning'
                  ? '비트필드 / 주소 차이 (Warning)'
                  : '완전 호환 (Identical)'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{activeReg.description}</p>
          </div>

          <div className="text-xs text-slate-300 bg-slate-900/80 p-3 rounded-xl border border-slate-800 max-w-md">
            <span className="font-bold text-amber-400 block mb-0.5 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> 차이점 분석 요약:
            </span>
            <span className="text-slate-300">{activeReg.diffSummary}</span>
          </div>
        </div>

        {/* Address & Access Mode Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MCU A Address Card */}
          <div className="bg-slate-900/60 p-4 rounded-xl border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-cyan-400 flex items-center gap-2 text-sm">
                <Cpu className="w-4 h-4" /> {MCU_PROFILES[mcuA].name} 주소 및 접근 방식
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${activeReg.mcuA.supported ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-400'}`}>
                {activeReg.mcuA.supported ? '하드웨어 지원' : '미지원 (부재)'}
              </span>
            </div>

            {activeReg.mcuA.supported ? (
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">I/O 공간 주소</div>
                  <div className="text-base font-bold text-cyan-300">{activeReg.mcuA.ioAddr || 'N/A'}</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">메모리 매핑(SRAM)</div>
                  <div className="text-base font-bold text-white">{activeReg.mcuA.memAddr || 'N/A'}</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">필수 어셈블리</div>
                  <div className={`text-xs font-bold mt-1 ${activeReg.mcuA.isExtendedIo ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {activeReg.mcuA.isExtendedIo ? 'lds / sts (2cyc)' : 'in / out (1cyc)'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-rose-950/20 border border-rose-500/30 text-rose-300 text-xs">
                {activeReg.mcuA.notes || `${MCU_PROFILES[mcuA].name}에는 이 레지스터가 존재하지 않습니다.`}
              </div>
            )}
          </div>

          {/* MCU B Address Card */}
          <div className="bg-slate-900/60 p-4 rounded-xl border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-amber-400 flex items-center gap-2 text-sm">
                <Cpu className="w-4 h-4" /> {MCU_PROFILES[mcuB].name} 주소 및 접근 방식
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${activeReg.mcuB.supported ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-400'}`}>
                {activeReg.mcuB.supported ? '하드웨어 지원' : '미지원 (부재)'}
              </span>
            </div>

            {activeReg.mcuB.supported ? (
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">I/O 공간 주소</div>
                  <div className="text-base font-bold text-amber-300">{activeReg.mcuB.ioAddr || 'N/A'}</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">메모리 매핑(SRAM)</div>
                  <div className="text-base font-bold text-white">{activeReg.mcuB.memAddr || 'N/A'}</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">필수 어셈블리</div>
                  <div className={`text-xs font-bold mt-1 ${activeReg.mcuB.isExtendedIo ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {activeReg.mcuB.isExtendedIo ? 'lds / sts (2cyc)' : 'in / out (1cyc)'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-rose-950/20 border border-rose-500/30 text-rose-300 text-xs">
                {activeReg.mcuB.notes || `${MCU_PROFILES[mcuB].name}에는 이 레지스터가 존재하지 않습니다.`}
              </div>
            )}
          </div>
        </div>

        {/* Side-by-Side 8-Bit Register Bit-Field Visualizer */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              8비트 레지스터 비트필드 구조 비교 (Bit 7 ~ Bit 0):
            </span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />비트 일치</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />비트 불일치/차이</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" />미지원 / 부재</span>
            </div>
          </div>

          {/* Bit Comparison Matrix */}
          <div className="space-y-3 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
            {/* MCU A Bit Row */}
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-cyan-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" /> {MCU_PROFILES[mcuA].name} 비트 배열:
              </div>
              <div className="grid grid-cols-8 gap-1.5 text-center font-mono text-xs">
                {activeReg.mcuA.supported && activeReg.mcuA.bits.length === 8 ? (
                  activeReg.mcuA.bits.map((bA, idx) => {
                    const bB = activeReg.mcuB.bits[idx];
                    const isDiff = !bB || bA.name !== bB.name;
                    const isSelected = selectedBitIndex === bA.bit;

                    return (
                      <button
                        key={bA.bit}
                        onClick={() => setSelectedBitIndex(bA.bit)}
                        className={`p-2.5 rounded-lg border text-center transition-all ${
                          isSelected
                            ? 'ring-2 ring-cyan-400 shadow-md'
                            : 'hover:bg-slate-800'
                        } ${
                          isDiff
                            ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                            : 'bg-slate-950 border-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="text-[9px] text-slate-500">Bit {bA.bit}</div>
                        <div className="font-bold text-sm my-0.5 truncate">{bA.name}</div>
                        <div className="text-[9px] text-slate-400">{bA.rw}</div>
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-8 p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 text-rose-300 text-xs">
                    {MCU_PROFILES[mcuA].name}에는 이 레지스터가 존재하지 않습니다.
                  </div>
                )}
              </div>
            </div>

            {/* MCU B Bit Row */}
            <div className="space-y-1 pt-2 border-t border-slate-800">
              <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> {MCU_PROFILES[mcuB].name} 비트 배열:
              </div>
              <div className="grid grid-cols-8 gap-1.5 text-center font-mono text-xs">
                {activeReg.mcuB.supported && activeReg.mcuB.bits.length === 8 ? (
                  activeReg.mcuB.bits.map((bB, idx) => {
                    const bA = activeReg.mcuA.bits[idx];
                    const isDiff = !bA || bB.name !== bA.name;
                    const isSelected = selectedBitIndex === bB.bit;

                    return (
                      <button
                        key={bB.bit}
                        onClick={() => setSelectedBitIndex(bB.bit)}
                        className={`p-2.5 rounded-lg border text-center transition-all ${
                          isSelected
                            ? 'ring-2 ring-amber-400 shadow-md'
                            : 'hover:bg-slate-800'
                        } ${
                          isDiff
                            ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                            : 'bg-slate-950 border-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="text-[9px] text-slate-500">Bit {bB.bit}</div>
                        <div className="font-bold text-sm my-0.5 truncate">{bB.name}</div>
                        <div className="text-[9px] text-slate-400">{bB.rw}</div>
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-8 p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 text-rose-300 text-xs">
                    {MCU_PROFILES[mcuB].name}에는 이 레지스터가 존재하지 않습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Bit Detail Inspector Card */}
        {selectedBitIndex !== null && (
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-2 font-mono">
                <Info className="w-4 h-4 text-cyan-400" /> Bit {selectedBitIndex} 상세 비트 비교 인스펙터
              </span>
              <span className="text-[10px] text-slate-400">클릭하여 각 비트의 세부 기능 대조</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* MCU A Bit Detail */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-cyan-400">{MCU_PROFILES[mcuA].name}:</span>
                  <span className="font-mono text-cyan-300 font-bold">
                    {activeReg.mcuA.bits[7 - selectedBitIndex]?.name || 'N/A'}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {activeReg.mcuA.bits[7 - selectedBitIndex]?.desc || '해당 비트 미지원'}
                </p>
                <div className="text-[10px] text-slate-500 font-mono">
                  접근 권한: {activeReg.mcuA.bits[7 - selectedBitIndex]?.rw || '-'} | 초기값: {activeReg.mcuA.bits[7 - selectedBitIndex]?.initial || '-'}
                </div>
              </div>

              {/* MCU B Bit Detail */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-amber-400">{MCU_PROFILES[mcuB].name}:</span>
                  <span className="font-mono text-amber-300 font-bold">
                    {activeReg.mcuB.bits[7 - selectedBitIndex]?.name || 'N/A'}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {activeReg.mcuB.bits[7 - selectedBitIndex]?.desc || '해당 비트 미지원'}
                </p>
                <div className="text-[10px] text-slate-500 font-mono">
                  접근 권한: {activeReg.mcuB.bits[7 - selectedBitIndex]?.rw || '-'} | 초기값: {activeReg.mcuB.bits[7 - selectedBitIndex]?.initial || '-'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Code Generator & Migration Snippet */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2 font-mono">
              <Code2 className="w-4 h-4 text-emerald-400" />
              크로스 MCU 호환성 C 전처리기 매크로 코드 ({activeReg.name})
            </span>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs transition"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? '복사됨' : '매크로 복사'}
            </button>
          </div>

          <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
            {portableCode}
          </pre>
        </div>
      </div>
    </div>
  );
};
