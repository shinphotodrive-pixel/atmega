import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';
import {
  Cpu,
  Layers,
  Terminal,
  Copy,
  Check,
  Download,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Info,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Clock,
  Radio,
  FileCode,
  HardDrive
} from 'lucide-react';

interface Props {
  selectedMCU: SupportedMCU;
}

export interface BootSizeConfig {
  bootszBits: '11' | '10' | '01' | '00';
  bootszVal: number; // 3, 2, 1, 0
  sizeBytes: number;
  sizeWords: number;
  pages: number;
  startWordAddrHex: string;
  startByteAddrHex: string;
  appSizeBytes: number;
  appSizeWords: number;
  appEndByteHex: string;
  desc: string;
  recommendedFor: string;
}

export interface BootloaderTemplate {
  id: 'optiboot' | 'atmegaboot' | 'urboot' | 'custom';
  name: string;
  shortDesc: string;
  protocol: string;
  minSizeBytes: number;
  typicalBaud: number;
  hexFileName: string;
  features: string[];
}

export const BootloaderCustomizer: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // MCU Architecture Specifications for Bootloader
  const mcuSpecs = useMemo(() => {
    if (selectedMCU === 'atmega328p') {
      return {
        part: 'm328p',
        arch: 'AVR Enhanced 8-bit',
        totalFlashBytes: 32768,
        totalFlashWords: 16384,
        pageSizeBytes: 128,
        pageSizeWords: 64,
        totalPages: 256,
        defaultUart: 0,
        maxUarts: 1,
        defaultLedPin: 'B5',
        ledPort: 'PORTB',
        ledDdr: 'DDRB',
        ledBitNum: 5,
        defaultHfuseBase: 0xDC, // without BOOTSZ / BOOTRST
        defaultLfuse: '0xFF',
        defaultEfuse: '0xFD',
        bootSizes: [
          {
            bootszBits: '11' as const,
            bootszVal: 3,
            sizeBytes: 512,
            sizeWords: 256,
            pages: 4,
            startWordAddrHex: '0x3F00',
            startByteAddrHex: '0x7E00',
            appSizeBytes: 32256,
            appSizeWords: 16128,
            appEndByteHex: '0x7DFF',
            desc: '512 바이트 (4 페이지 / 256 워드)',
            recommendedFor: 'Optiboot (Arduino Uno 표준 / 초경량)'
          },
          {
            bootszBits: '10' as const,
            bootszVal: 2,
            sizeBytes: 1024,
            sizeWords: 512,
            pages: 8,
            startWordAddrHex: '0x3E00',
            startByteAddrHex: '0x7C00',
            appSizeBytes: 31744,
            appSizeWords: 15872,
            appEndByteHex: '0x7BFF',
            desc: '1,024 바이트 (8 페이지 / 512 워드)',
            recommendedFor: 'Urboot 및 기능 확장 Optiboot'
          },
          {
            bootszBits: '01' as const,
            bootszVal: 1,
            sizeBytes: 2048,
            sizeWords: 1024,
            pages: 16,
            startWordAddrHex: '0x3C00',
            startByteAddrHex: '0x7800',
            appSizeBytes: 30720,
            appSizeWords: 15360,
            appEndByteHex: '0x77FF',
            desc: '2,048 바이트 (16 페이지 / 1,024 워드)',
            recommendedFor: 'Arduino 구형 ATmegaBOOT (Duemilanove)'
          },
          {
            bootszBits: '00' as const,
            bootszVal: 0,
            sizeBytes: 4096,
            sizeWords: 2048,
            pages: 32,
            startWordAddrHex: '0x3800',
            startByteAddrHex: '0x7000',
            appSizeBytes: 28672,
            appSizeWords: 14336,
            appEndByteHex: '0x6FFF',
            desc: '4,096 바이트 (32 페이지 / 2,048 워드)',
            recommendedFor: '대용량 커스텀 통신/암호화 부트로더'
          }
        ]
      };
    } else if (selectedMCU === 'atmega128') {
      return {
        part: 'm128',
        arch: 'AVR Mega Core',
        totalFlashBytes: 131072,
        totalFlashWords: 65536,
        pageSizeBytes: 256,
        pageSizeWords: 128,
        totalPages: 512,
        defaultUart: 0,
        maxUarts: 2,
        defaultLedPin: 'B4',
        ledPort: 'PORTB',
        ledDdr: 'DDRB',
        ledBitNum: 4,
        defaultHfuseBase: 0xC8,
        defaultLfuse: '0xFF',
        defaultEfuse: '0xFF',
        bootSizes: [
          {
            bootszBits: '11' as const,
            bootszVal: 3,
            sizeBytes: 1024,
            sizeWords: 512,
            pages: 4,
            startWordAddrHex: '0xFE00',
            startByteAddrHex: '0x1FC00',
            appSizeBytes: 130048,
            appSizeWords: 65024,
            appEndByteHex: '0x1FBFF',
            desc: '1,024 바이트 (4 페이지 / 512 워드)',
            recommendedFor: 'Optiboot ATmega128 경량 포팅'
          },
          {
            bootszBits: '10' as const,
            bootszVal: 2,
            sizeBytes: 2048,
            sizeWords: 1024,
            pages: 8,
            startWordAddrHex: '0xFC00',
            startByteAddrHex: '0x1F800',
            appSizeBytes: 129024,
            appSizeWords: 64512,
            appEndByteHex: '0x1F7FF',
            desc: '2,048 바이트 (8 페이지 / 1,024 워드)',
            recommendedFor: '표준 STK500v2 컴팩트 부트로더'
          },
          {
            bootszBits: '01' as const,
            bootszVal: 1,
            sizeBytes: 4096,
            sizeWords: 2048,
            pages: 16,
            startWordAddrHex: '0xF800',
            startByteAddrHex: '0x1F000',
            appSizeBytes: 126976,
            appSizeWords: 63488,
            appEndByteHex: '0x1EFFF',
            desc: '4,096 바이트 (16 페이지 / 2,048 워드)',
            recommendedFor: 'ATmegaBOOT128 공식 레퍼런스'
          },
          {
            bootszBits: '00' as const,
            bootszVal: 0,
            sizeBytes: 8192,
            sizeWords: 4096,
            pages: 32,
            startWordAddrHex: '0xF000',
            startByteAddrHex: '0x1E000',
            appSizeBytes: 122880,
            appSizeWords: 61440,
            appEndByteHex: '0x1DFFF',
            desc: '8,192 바이트 (32 페이지 / 4,096 워드)',
            recommendedFor: '고급 복구 & 다중 통신 프로토콜 부트로더'
          }
        ]
      };
    } else {
      // ATmega640
      return {
        part: 'm640',
        arch: 'AVR Mega Extended',
        totalFlashBytes: 65536,
        totalFlashWords: 32768,
        pageSizeBytes: 256,
        pageSizeWords: 128,
        totalPages: 256,
        defaultUart: 0,
        maxUarts: 4,
        defaultLedPin: 'B7',
        ledPort: 'PORTB',
        ledDdr: 'DDRB',
        ledBitNum: 7,
        defaultHfuseBase: 0xD8,
        defaultLfuse: '0xFF',
        defaultEfuse: '0xFD',
        bootSizes: [
          {
            bootszBits: '11' as const,
            bootszVal: 3,
            sizeBytes: 1024,
            sizeWords: 512,
            pages: 4,
            startWordAddrHex: '0x7E00',
            startByteAddrHex: '0xFC00',
            appSizeBytes: 64512,
            appSizeWords: 32256,
            appEndByteHex: '0xFBFF',
            desc: '1,024 바이트 (4 페이지 / 512 워드)',
            recommendedFor: 'Optiboot Mega 초소형 고속 부트로더'
          },
          {
            bootszBits: '10' as const,
            bootszVal: 2,
            sizeBytes: 2048,
            sizeWords: 1024,
            pages: 8,
            startWordAddrHex: '0x7C00',
            startByteAddrHex: '0xF800',
            appSizeBytes: 63488,
            appSizeWords: 31744,
            appEndByteHex: '0xF7FF',
            desc: '2,048 바이트 (8 페이지 / 1,024 워드)',
            recommendedFor: 'Urboot 64K 시리즈'
          },
          {
            bootszBits: '01' as const,
            bootszVal: 1,
            sizeBytes: 4096,
            sizeWords: 2048,
            pages: 16,
            startWordAddrHex: '0x7800',
            startByteAddrHex: '0xF000',
            appSizeBytes: 61440,
            appSizeWords: 30720,
            appEndByteHex: '0xEFFF',
            desc: '4,096 바이트 (16 페이지 / 2,048 워드)',
            recommendedFor: 'STK500v2 Arduino Mega 호환 부트로더'
          },
          {
            bootszBits: '00' as const,
            bootszVal: 0,
            sizeBytes: 8192,
            sizeWords: 4096,
            pages: 32,
            startWordAddrHex: '0x7000',
            startByteAddrHex: '0xE000',
            appSizeBytes: 57344,
            appSizeWords: 28672,
            appEndByteHex: '0xDFFF',
            desc: '8,192 바이트 (32 페이지 / 4,096 워드)',
            recommendedFor: 'Mega 2560/640 대용량 8K 표준 부트로더'
          }
        ]
      };
    }
  }, [selectedMCU]);

  // Standard Bootloader Profiles
  const bootloaderTemplates: BootloaderTemplate[] = useMemo(() => [
    {
      id: 'optiboot',
      name: 'Optiboot (추천)',
      shortDesc: 'Arduino Uno의 공식 초경량 512B/1KB 고속 부트로더',
      protocol: 'STK500v1',
      minSizeBytes: selectedMCU === 'atmega328p' ? 512 : 1024,
      typicalBaud: 115200,
      hexFileName: `optiboot_${mcuSpecs.part}.hex`,
      features: [
        '최소 512바이트 플래시 소비로 스케치 가용 공간 극대화',
        '115,200 bps 고속 업로드 지원',
        '워치독(WDT) 기반 자동 재부팅 및 핀 토글 인디케이터',
        '어셈블리 최적화로 빠른 시작(Fast Boot) 보장'
      ]
    },
    {
      id: 'atmegaboot',
      name: 'Arduino ATmegaBOOT',
      shortDesc: '클래식 Arduino 및 Mega 시리즈의 전통적 STK500v2 부트로더',
      protocol: 'STK500v2',
      minSizeBytes: selectedMCU === 'atmega328p' ? 2048 : 4096,
      typicalBaud: 57600,
      hexFileName: `ATmegaBOOT_168_${mcuSpecs.part}.hex`,
      features: [
        '안정적인 대용량 버퍼 처리 및 STK500v2 호환',
        '부팅 시 3회 LED 심장박동(Heartbeat) 깜빡임',
        '구형 개발 툴 및 프로그래머와 100% 호환성 유지'
      ]
    },
    {
      id: 'urboot',
      name: 'Urboot (고성능)',
      shortDesc: 'EEPROM 읽기/쓰기 및 벡터 스와핑을 지원하는 차세대 부트로더',
      protocol: 'AVR-ISP / Urboot',
      minSizeBytes: selectedMCU === 'atmega328p' ? 512 : 1024,
      typicalBaud: 115200,
      hexFileName: `urboot_${mcuSpecs.part}.hex`,
      features: [
        'EEPROM 런타임 읽기/쓰기 커맨드 완벽 지원',
        '인터럽트 벡터 테이블 안전 스와핑 (IVSEL 보호)',
        '최대 230,400 ~ 500,000 bps 초고속 전송 지원'
      ]
    },
    {
      id: 'custom',
      name: 'Custom Bare-Metal Bootloader',
      shortDesc: '직접 작성한 C/Assembly 펌웨어 부트로더 및 사용자 지정 프로토콜',
      protocol: '사용자 지정 프로토콜 (Custom)',
      minSizeBytes: 512,
      typicalBaud: 115200,
      hexFileName: `custom_boot_${mcuSpecs.part}.hex`,
      features: [
        '사용자 맞춤형 시작 진입점 및 빌드 플래그 생성',
        '완전한 avr-gcc 링커 스크립트 플래그 제어',
        '임의의 UART 포트 및 LED 인디케이터 핀 지정'
      ]
    }
  ], [selectedMCU, mcuSpecs.part]);

  // States
  const [selectedTemplate, setSelectedTemplate] = useState<'optiboot' | 'atmegaboot' | 'urboot' | 'custom'>('optiboot');
  const [selectedBootszBits, setSelectedBootszBits] = useState<'11' | '10' | '01' | '00'>('11');
  const [bootrst, setBootrst] = useState<boolean>(true); // true = 0 (Programmed: Reset Vector = Bootloader)
  const [eesave, setEesave] = useState<boolean>(true);   // true = 0 (Programmed: EEPROM preserved on Chip Erase)
  const [fcpu, setFcpu] = useState<number>(16000000);
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [selectedUart, setSelectedUart] = useState<number>(0);
  const [ledPin, setLedPin] = useState<string>(mcuSpecs.defaultLedPin);
  const [ledFlashes, setLedFlashes] = useState<number>(3);
  const [lockMode, setLockMode] = useState<'no_lock' | 'protect_boot' | 'full_lock'>('protect_boot');
  const [wdtTimeout, setWdtTimeout] = useState<'1s' | '2s' | '4s' | 'disabled'>('1s');

  // Active Boot Size Config
  const currentBootSize: BootSizeConfig = useMemo(() => {
    const found = mcuSpecs.bootSizes.find((b) => b.bootszBits === selectedBootszBits);
    return found || mcuSpecs.bootSizes[0];
  }, [mcuSpecs, selectedBootszBits]);

  // Selected Template Object
  const currentTemplateObj = useMemo(() => {
    return bootloaderTemplates.find((t) => t.id === selectedTemplate) || bootloaderTemplates[0];
  }, [bootloaderTemplates, selectedTemplate]);

  // Warning if selected BOOTSZ size is smaller than template minimum size
  const isSizeTooSmall = currentBootSize.sizeBytes < currentTemplateObj.minSizeBytes;

  // Calculate High Fuse & Lock Byte
  // In AVR:
  // Programmed = 0, Unprogrammed = 1
  // ATmega328P High Fuse:
  // Bit 7: RSTDISBL (1=Reset pin enabled)
  // Bit 6: DWEN (1=debugWIRE disabled)
  // Bit 5: SPIEN (0=SPI programming enabled)
  // Bit 4: WDTON (1=Watchdog not always on)
  // Bit 3: EESAVE (0=preserve EEPROM, 1=erase)
  // Bit 2: BOOTSZ1
  // Bit 1: BOOTSZ0
  // Bit 0: BOOTRST (0=Reset jumps to bootloader, 1=0x0000)
  const calculatedFuses = useMemo(() => {
    let hfuseNum = 0xDF; // Base default (all unprogrammed except SPIEN=0 -> 1101 1111 = 0xDF)

    // BOOTSZ1:0 bits (bits 2..1)
    // Clear bits 2 and 1
    hfuseNum &= ~(0x06);
    if (selectedBootszBits === '11') {
      hfuseNum |= 0x06; // BOOTSZ1=1, BOOTSZ0=1
    } else if (selectedBootszBits === '10') {
      hfuseNum |= 0x04; // BOOTSZ1=1, BOOTSZ0=0
    } else if (selectedBootszBits === '01') {
      hfuseNum |= 0x02; // BOOTSZ1=0, BOOTSZ0=1
    } else {
      hfuseNum |= 0x00; // BOOTSZ1=0, BOOTSZ0=0
    }

    // BOOTRST bit (bit 0): 0 = programmed (jump to bootloader)
    if (bootrst) {
      hfuseNum &= ~0x01; // 0 (active jump to bootloader)
    } else {
      hfuseNum |= 0x01; // 1 (jump to 0x0000)
    }

    // EESAVE bit (bit 3): 0 = preserve EEPROM
    if (eesave) {
      hfuseNum &= ~0x08; // 0
    } else {
      hfuseNum |= 0x08; // 1
    }

    // Lock byte:
    // 0x3F = No memory lock features (LB=11, BLB0=11, BLB1=11)
    // 0x2F = Protect Boot section from SPM overwrite (BLB12=1, BLB11=0 -> SPM cannot write to Boot section)
    // 0x0F = Full Protection (SPM and LPM prohibited in Boot section, application cannot read/write bootloader)
    let lockByteHex = '0x3F';
    if (lockMode === 'protect_boot') {
      lockByteHex = '0x2F';
    } else if (lockMode === 'full_lock') {
      lockByteHex = '0x0F';
    }

    const hfuseHex = '0x' + (hfuseNum & 0xFF).toString(16).toUpperCase().padStart(2, '0');
    const lfuseHex = mcuSpecs.defaultLfuse;
    const efuseHex = mcuSpecs.defaultEfuse;

    return {
      hfuseHex,
      lfuseHex,
      efuseHex,
      lockByteHex,
      hfuseNum
    };
  }, [selectedBootszBits, bootrst, eesave, lockMode, mcuSpecs]);

  // Generated Linker & Preprocessor Flags
  const generatedBuildFlags = useMemo(() => {
    const textStartFlag = `-Wl,--section-start=.text=${currentBootSize.startByteAddrHex.toLowerCase()}`;
    const relaxFlag = `-Wl,--relax`;
    const fcpuFlag = `-DF_CPU=${fcpu}UL`;
    const baudFlag = `-DBAUD_RATE=${baudRate}`;
    const uartFlag = `-DUART=${selectedUart}`;
    const ledFlag = ledPin !== 'NONE' ? `-DLED=${ledPin}` : `-DLED=NONE`;
    const flashesFlag = ledPin !== 'NONE' ? `-DLED_START_FLASHES=${ledFlashes}` : `-DLED_START_FLASHES=0`;
    const mcuFlag = `-mmcu=${mcuSpecs.part}`;

    return {
      textStartFlag,
      relaxFlag,
      fcpuFlag,
      baudFlag,
      uartFlag,
      ledFlag,
      flashesFlag,
      mcuFlag,
      allFlags: [
        mcuFlag,
        `-Os`,
        `-fno-inline-small-functions`,
        `-fno-split-wide-types`,
        `-mshort-calls`,
        fcpuFlag,
        baudFlag,
        uartFlag,
        ledFlag,
        flashesFlag,
        textStartFlag,
        relaxFlag
      ].join(' ')
    };
  }, [currentBootSize, fcpu, baudRate, selectedUart, ledPin, ledFlashes, mcuSpecs.part]);

  // Avrdude Commands
  const avrdudeBurnCommand = useMemo(() => {
    return `avrdude -c usbasp -p ${mcuSpecs.part} -U lfuse:w:${calculatedFuses.lfuseHex}:m -U hfuse:w:${calculatedFuses.hfuseHex}:m -U efuse:w:${calculatedFuses.efuseHex}:m`;
  }, [mcuSpecs.part, calculatedFuses]);

  const avrdudeFlashCommand = useMemo(() => {
    return `avrdude -c usbasp -p ${mcuSpecs.part} -U flash:w:${currentTemplateObj.hexFileName}:i -U lock:w:${calculatedFuses.lockByteHex}:m`;
  }, [mcuSpecs.part, currentTemplateObj.hexFileName, calculatedFuses]);

  // Full Makefile snippet
  const generatedMakefile = useMemo(() => {
    return `# ========================================================
# ${currentProfile.name} Bootloader Makefile
# Bootloader Type: ${currentTemplateObj.name}
# Boot Section: ${currentBootSize.sizeBytes} Bytes (${currentBootSize.startByteAddrHex})
# F_CPU: ${fcpu} Hz | Baud: ${baudRate} bps | UART: ${selectedUart}
# Generated by AVR System Studio Bootloader Customizer
# ========================================================

MCU            = ${mcuSpecs.part}
F_CPU          = ${fcpu}UL
BAUD_RATE      = ${baudRate}
BOOT_ADDR      = ${currentBootSize.startByteAddrHex.toLowerCase()}

CC             = avr-gcc
OBJCOPY        = avr-objcopy
SIZE           = avr-size
AVRDUDE        = avrdude

# Fuses & Lock Configurations
LFUSE          = ${calculatedFuses.lfuseHex}
HFUSE          = ${calculatedFuses.hfuseHex}
EFUSE          = ${calculatedFuses.efuseHex}
LOCK           = ${calculatedFuses.lockByteHex}

# Compiler & Linker Optimization Flags
CFLAGS         = -mmcu=$(MCU) -Wall -Os -fno-inline-small-functions \\
                 -fno-split-wide-types -mshort-calls \\
                 -DF_CPU=$(F_CPU) -DBAUD_RATE=$(BAUD_RATE) \\
                 -DUART=${selectedUart} -DLED=${ledPin} -DLED_START_FLASHES=${ledFlashes}

LDFLAGS        = -mmcu=$(MCU) -Wl,--section-start=.text=$(BOOT_ADDR) -Wl,--relax

TARGET         = ${currentTemplateObj.id}_${mcuSpecs.part}

all: $(TARGET).hex print_size

$(TARGET).elf: bootloader.c
\t$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $<

$(TARGET).hex: $(TARGET).elf
\t$(OBJCOPY) -j .text -j .data -O ihex $< $@

print_size: $(TARGET).elf
\t@$(SIZE) --format=avr --mcu=$(MCU) $<

# Flash bootloader and lock bits
program: $(TARGET).hex
\t$(AVRDUDE) -c usbasp -p $(MCU) -U flash:w:$<:i -U lock:w:$(LOCK):m

# Program Fuses (BOOTSZ & BOOTRST)
fuses:
\t$(AVRDUDE) -c usbasp -p $(MCU) -U lfuse:w:$(LFUSE):m -U hfuse:w:$(HFUSE):m -U efuse:w:$(EFUSE):m

clean:
\trm -f *.elf *.hex *.o *.lst
`;
  }, [currentProfile.name, currentTemplateObj, currentBootSize, fcpu, baudRate, selectedUart, ledPin, ledFlashes, mcuSpecs.part, calculatedFuses]);

  // Minimal C Bootloader Jump Skeleton
  const minimalBootloaderC = useMemo(() => {
    return `// ========================================================
// ${currentProfile.name} Minimal Software Bootloader Entry & Exit
// Boot Section Start: ${currentBootSize.startByteAddrHex}
// ========================================================
#include <avr/io.h>
#include <avr/wdt.h>
#include <avr/interrupt.h>
#include <util/delay.h>

#define BOOT_START_ADDR ${currentBootSize.startByteAddrHex}

// 1. 애플리케이션 시작 주소 함수 포인터 (Flash 0x0000)
void (*start_app)(void) = 0x0000;

void bootloader_exit_to_application(void) {
    // A. 인터럽트 전역 비활성화
    cli();

    // B. 워치독 타이머 안전 해제 (애플리케이션 무한 리셋 방지)
    wdt_reset();
    MCUSR = 0;
    wdt_disable();

    // C. 인터럽트 벡터를 다시 애플리케이션 영역(0x0000)으로 복귀
    MCUCR = (1 << IVCE);  // Interrupt Vector Change Enable
    MCUCR = 0x00;         // IVSEL = 0 (Application Flash Section)

    // D. 스택 포인터 초기화 및 앱 점프
    start_app();
}

int main(void) {
    // [하드웨어 초기화]
    // UART 초기화 및 통신 대기 루틴...

    // 예: 타임아웃 1초 동안 펌웨어 업로드 요청이 없으면 앱으로 즉시 점프
    _delay_ms(500);

    bootloader_exit_to_application();
    return 0;
}
`;
  }, [currentProfile.name, currentBootSize.startByteAddrHex]);

  // Copy states
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    confetti({
      particleCount: 30,
      spread: 60,
      origin: { y: 0.7 }
    });
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Download Makefile
  const handleDownloadMakefile = () => {
    const blob = new Blob([generatedMakefile], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Makefile.bootloader_${mcuSpecs.part}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Selectable LED options per MCU
  const ledOptions = useMemo(() => {
    if (selectedMCU === 'atmega328p') {
      return [
        { id: 'B5', label: 'PB5 (Pin 19 / Arduino Uno 빌트인 LED)' },
        { id: 'B0', label: 'PB0 (Pin 14 / D8)' },
        { id: 'D4', label: 'PD4 (Pin 6 / D4)' },
        { id: 'NONE', label: 'LED 사용 안 함' }
      ];
    } else if (selectedMCU === 'atmega128') {
      return [
        { id: 'B4', label: 'PB4 (Pin 14 / 표준 모듈 온보드 LED)' },
        { id: 'E2', label: 'PE2 (Pin 4 / PE2 상태 LED)' },
        { id: 'A0', label: 'PA0 (Pin 51 / 포트A 비트0)' },
        { id: 'NONE', label: 'LED 사용 안 함' }
      ];
    } else {
      return [
        { id: 'B7', label: 'PB7 (Pin 26 / Arduino Mega 2560/640 빌트인 LED)' },
        { id: 'E5', label: 'PE5 (Pin 7 / PE5 인디케이터)' },
        { id: 'NONE', label: 'LED 사용 안 함' }
      ];
    }
  }, [selectedMCU]);

  // Percent calculation
  const appPercent = ((currentBootSize.appSizeBytes / mcuSpecs.totalFlashBytes) * 100).toFixed(1);
  const bootPercent = ((currentBootSize.sizeBytes / mcuSpecs.totalFlashBytes) * 100).toFixed(1);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold font-mono">
              <HardDrive className="w-3.5 h-3.5" />
              BOOTLOADER CUSTOMIZER
            </span>
            <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
              {currentProfile.name} • Flash {(mcuSpecs.totalFlashBytes / 1024).toFixed(0)} KB
            </span>
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-cyan-400" />
            부트로더 커스터마이저 &amp; BOOTSZ 퓨즈 설정기
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {currentProfile.name}의 플래시 부트 섹션 크기(<strong>BOOTSZ1:0</strong>)와 리셋 벡터(<strong>BOOTRST</strong>)를 설정하고,
            Optiboot 및 표준 부트로더에 맞는 <strong>avr-gcc 링커 빌드 플래그</strong>, <strong>avrdude 퓨즈 굽기 명령</strong> 및 <strong>Makefile</strong>을 자동 생성합니다.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleDownloadMakefile}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-lg shadow-cyan-950/40"
          >
            <Download className="w-4 h-4" />
            Makefile 다운로드
          </button>
        </div>
      </div>

      {/* Interactive Flash Partition Diagram */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span className="font-semibold text-slate-300">플래시 메모리 분할 레이아웃:</span>
            <span className="text-slate-400 font-mono">
              총 {mcuSpecs.totalFlashBytes.toLocaleString()} Bytes ({mcuSpecs.totalPages} 페이지)
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span className="text-emerald-400">■ 앱 공간: {currentBootSize.appSizeBytes.toLocaleString()}B ({appPercent}%)</span>
            <span className="text-cyan-400">■ 부트로더: {currentBootSize.sizeBytes.toLocaleString()}B ({bootPercent}%)</span>
          </div>
        </div>

        {/* Proportional Memory Bar */}
        <div className="relative w-full h-8 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex">
          <div
            style={{ width: `${appPercent}%` }}
            className="h-full bg-gradient-to-r from-emerald-950/90 via-emerald-800/80 to-teal-800/80 border-r border-emerald-400/40 flex items-center justify-between px-3 text-[11px] text-emerald-200 font-mono transition-all duration-300"
          >
            <span className="truncate">Application Section (0x0000 ~ {currentBootSize.appEndByteHex})</span>
            <span className="hidden sm:inline font-bold">{appPercent}%</span>
          </div>
          <div
            style={{ width: `${bootPercent}%` }}
            className="h-full bg-gradient-to-r from-cyan-600 to-blue-600 flex items-center justify-center px-2 text-[11px] text-white font-mono font-bold transition-all duration-300"
          >
            <span className="truncate">Bootloader ({currentBootSize.startByteAddrHex})</span>
          </div>
        </div>

        {/* Address and Reset Vector Pointer */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">시작: 0x0000 (워드 0x0000)</span>
            <span className="text-slate-700">|</span>
            <span className="text-amber-400 font-semibold">
              리셋 진입점: {bootrst ? `Bootloader (${currentBootSize.startByteAddrHex})` : 'App (0x0000)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-semibold">
              부트 시작 주소: 바이트 {currentBootSize.startByteAddrHex} / 워드 {currentBootSize.startWordAddrHex}
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-500">
              플래시 끝: 0x{(mcuSpecs.totalFlashBytes - 1).toString(16).toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Settings & Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Selectors & Options (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Standard Bootloader Selection */}
          <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[11px]">1</span>
                표준 부트로더 템플릿 선택
              </label>
              <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
                프로토콜: {currentTemplateObj.protocol}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bootloaderTemplates.map((template) => {
                const isSelected = selectedTemplate === template.id;
                return (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplate(template.id);
                      setBaudRate(template.typicalBaud);
                      // Auto adjust bootsz if too small
                      if (currentBootSize.sizeBytes < template.minSizeBytes) {
                        const target = mcuSpecs.bootSizes.find((b) => b.sizeBytes >= template.minSizeBytes);
                        if (target) setSelectedBootszBits(target.bootszBits);
                      }
                    }}
                    className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-md shadow-cyan-950/30 ring-1 ring-cyan-500/50'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-200">{template.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                        {template.shortDesc}
                      </p>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 border-t border-slate-800/60 pt-1.5 flex justify-between">
                      <span>최소: {template.minSizeBytes}B</span>
                      <span className="text-cyan-400">{template.typicalBaud} bps</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: BOOTSZ Configuration (Boot Section Size) */}
          <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[11px]">2</span>
                부트 섹션 크기 설정 (BOOTSZ1:0 퓨즈 비트)
              </label>
              <span className="text-[11px] font-mono text-amber-400">
                HFUSE 비트 [2:1]
              </span>
            </div>

            {isSizeTooSmall && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>
                  주의: 선택한 <strong>{currentTemplateObj.name}</strong>는 최소 {currentTemplateObj.minSizeBytes} 바이트가 필요합니다.
                  현재 선택된 부트 섹션({currentBootSize.sizeBytes}B)은 공간이 부족할 수 있습니다!
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mcuSpecs.bootSizes.map((b) => {
                const isSelected = selectedBootszBits === b.bootszBits;
                return (
                  <button
                    key={b.bootszBits}
                    onClick={() => setSelectedBootszBits(b.bootszBits)}
                    className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-950/30 border-amber-500 text-white shadow-md shadow-amber-950/30 ring-1 ring-amber-500/50'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-200">
                          {b.sizeBytes} Bytes ({b.pages} 페이지)
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                        }`}>
                          BOOTSZ={b.bootszBits}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mb-1">
                        시작 주소: <span className="text-amber-400 font-bold">{b.startByteAddrHex}</span> (워드 {b.startWordAddrHex})
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed mb-2">
                        {b.recommendedFor}
                      </p>
                    </div>
                    <div className="text-[10px] font-mono text-emerald-400 border-t border-slate-800/60 pt-1 flex justify-between">
                      <span>스케치 가용:</span>
                      <span>{(b.appSizeBytes / 1024).toFixed(1)} KB</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Hardware Peripherals & Boot Options */}
          <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[11px]">3</span>
                하드웨어 통신 &amp; 부팅 파라미터 커스터마이징
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* F_CPU */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">시스템 클럭 (F_CPU)</label>
                <select
                  value={fcpu}
                  onChange={(e) => setFcpu(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value={16000000}>16.000 MHz (표준 5V)</option>
                  <option value={8000000}>8.000 MHz (내부RC / 3.3V)</option>
                  <option value={11059200}>11.0592 MHz (통신 전용)</option>
                  <option value={20000000}>20.000 MHz (오버클럭)</option>
                  <option value={12000000}>12.000 MHz (USB 지원)</option>
                  <option value={4000000}>4.000 MHz (저전력)</option>
                </select>
              </div>

              {/* Baud Rate */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">업로드 보드레이트 (Baud)</label>
                <select
                  value={baudRate}
                  onChange={(e) => setBaudRate(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value={115200}>115,200 bps (Optiboot 표준)</option>
                  <option value={57600}>57,600 bps (구형 STK500)</option>
                  <option value={38400}>38,400 bps</option>
                  <option value={19200}>19,200 bps</option>
                  <option value={230400}>230,400 bps (초고속)</option>
                  <option value={500000}>500,000 bps (Urboot)</option>
                </select>
              </div>

              {/* UART Port */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">통신 UART 채널</label>
                <select
                  value={selectedUart}
                  onChange={(e) => setSelectedUart(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value={0}>UART 0 (기본 다운로드 포트)</option>
                  {mcuSpecs.maxUarts > 1 && <option value={1}>UART 1</option>}
                  {mcuSpecs.maxUarts > 2 && <option value={2}>UART 2</option>}
                  {mcuSpecs.maxUarts > 3 && <option value={3}>UART 3</option>}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* LED Pin Indicator */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">LED 상태 인디케이터 핀</label>
                <select
                  value={ledPin}
                  onChange={(e) => setLedPin(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                >
                  {ledOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* LED Flash Count */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">부팅 시 LED 깜빡임 횟수</label>
                <select
                  value={ledFlashes}
                  onChange={(e) => setLedFlashes(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value={1}>1회 빠른 점멸 (Optiboot 기본)</option>
                  <option value={2}>2회 점멸</option>
                  <option value={3}>3회 점멸 (Arduino Classic)</option>
                  <option value={0}>점멸 안 함 (최고속 부팅)</option>
                </select>
              </div>
            </div>

            {/* Checkboxes: BOOTRST & EESAVE & Lock */}
            <div className="pt-3 border-t border-slate-900 space-y-2.5">
              <label className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900/50 hover:bg-slate-900 cursor-pointer border border-slate-800 transition">
                <input
                  type="checkbox"
                  checked={bootrst}
                  onChange={(e) => setBootrst(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 bg-slate-950"
                />
                <div className="text-xs">
                  <span className="font-bold text-white block">
                    BOOTRST 활성화 (부트 리셋 벡터 인에이블 / HFUSE bit 0 = 0)
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    체크 시 전원 인가 또는 리셋 시 CPU가 부트로더 시작 주소(<strong>{currentBootSize.startByteAddrHex}</strong>)로 직행합니다. (권장)
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900/50 hover:bg-slate-900 cursor-pointer border border-slate-800 transition">
                <input
                  type="checkbox"
                  checked={eesave}
                  onChange={(e) => setEesave(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 bg-slate-950"
                />
                <div className="text-xs">
                  <span className="font-bold text-white block">
                    EESAVE 활성화 (칩 소거 시 EEPROM 보존 / HFUSE bit 3 = 0)
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    새로운 펌웨어 업로드 시 저장된 EEPROM 설정 데이터를 지우지 않고 유지합니다.
                  </span>
                </div>
              </label>

              {/* Lock Mode Selector */}
              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    부트로더 락 비트(Lock Bits) 보안 설정:
                  </span>
                  <span className="font-mono text-cyan-400 font-bold">{calculatedFuses.lockByteHex}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                  <button
                    onClick={() => setLockMode('no_lock')}
                    className={`p-2 rounded-lg border text-center transition ${
                      lockMode === 'no_lock'
                        ? 'bg-slate-800 border-cyan-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="block font-bold">보안 없음 (0x3F)</span>
                    <span className="text-[10px] text-slate-500">자유로운 읽기/쓰기</span>
                  </button>
                  <button
                    onClick={() => setLockMode('protect_boot')}
                    className={`p-2 rounded-lg border text-center transition ${
                      lockMode === 'protect_boot'
                        ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="block font-bold">부트 보호 (0x2F)</span>
                    <span className="text-[10px] text-cyan-500">SPM 부트 덮어쓰기 금지</span>
                  </button>
                  <button
                    onClick={() => setLockMode('full_lock')}
                    className={`p-2 rounded-lg border text-center transition ${
                      lockMode === 'full_lock'
                        ? 'bg-rose-950/60 border-rose-400 text-rose-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="block font-bold">완전 보호 (0x0F)</span>
                    <span className="text-[10px] text-rose-400">LPM/SPM 읽기쓰기 차단</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Calculated Artifacts & Commands (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Fuse Calculation Card */}
          <div className="bg-gradient-to-br from-slate-950 to-slate-900 p-5 rounded-2xl border border-cyan-500/30 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-cyan-400" />
                계산된 퓨즈 &amp; 락 바이트
              </span>
              <span className="text-[10px] font-mono bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800">
                BOOTSZ = {selectedBootszBits}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block mb-0.5 font-mono">LFUSE</span>
                <span className="text-sm font-bold text-slate-200 font-mono">{calculatedFuses.lfuseHex}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-cyan-500/40 ring-1 ring-cyan-500/20">
                <span className="text-[10px] text-cyan-400 block mb-0.5 font-mono">HFUSE</span>
                <span className="text-sm font-bold text-cyan-300 font-mono">{calculatedFuses.hfuseHex}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block mb-0.5 font-mono">EFUSE</span>
                <span className="text-sm font-bold text-slate-200 font-mono">{calculatedFuses.efuseHex}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-amber-400 block mb-0.5 font-mono">LOCK</span>
                <span className="text-sm font-bold text-amber-300 font-mono">{calculatedFuses.lockByteHex}</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 space-y-1 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 font-mono">
              <div className="flex justify-between">
                <span>BOOTSZ1:0 비트:</span>
                <span className="text-amber-400 font-bold">{selectedBootszBits} ({currentBootSize.sizeBytes} Bytes)</span>
              </div>
              <div className="flex justify-between">
                <span>BOOTRST 비트:</span>
                <span className={bootrst ? 'text-cyan-400' : 'text-slate-500'}>
                  {bootrst ? '0 (부트로더 리셋)' : '1 (0x0000 리셋)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>링커 시작 주소:</span>
                <span className="text-emerald-400 font-bold">{currentBootSize.startByteAddrHex}</span>
              </div>
            </div>
          </div>

          {/* Generated Linker / GCC Flags Card */}
          <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-amber-400" />
                avr-gcc 빌드 플래그 (Build Flags)
              </span>
              <button
                onClick={() => handleCopy(generatedBuildFlags.allFlags, 'flags')}
                className="inline-flex items-center gap-1 text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 text-[10px] transition"
              >
                {copiedSection === 'flags' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedSection === 'flags' ? '복사됨' : '플래그 복사'}
              </button>
            </div>

            <div className="space-y-1.5 text-[11px] font-mono">
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 text-cyan-300">
                <span className="text-slate-500 block text-[10px]"># 링커 섹션 시작 주소:</span>
                {generatedBuildFlags.textStartFlag} {generatedBuildFlags.relaxFlag}
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 text-amber-300">
                <span className="text-slate-500 block text-[10px]"># 클럭 &amp; 보드레이트 정의:</span>
                {generatedBuildFlags.fcpuFlag} {generatedBuildFlags.baudFlag}
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 text-emerald-300">
                <span className="text-slate-500 block text-[10px]"># 하드웨어 핀 및 UART 정의:</span>
                {generatedBuildFlags.uartFlag} {generatedBuildFlags.ledFlag} {generatedBuildFlags.flashesFlag}
              </div>
            </div>
          </div>

          {/* Avrdude Command Snippets */}
          <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-emerald-400" />
                avrdude 퓨즈 &amp; 펌웨어 굽기 명령
              </span>
            </div>

            {/* Fuse burn command */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] text-slate-400">
                <span>1. 퓨즈 바이트 기록 (BOOTSZ &amp; BOOTRST 설정):</span>
                <button
                  onClick={() => handleCopy(avrdudeBurnCommand, 'burn_fuse')}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[10px]"
                >
                  {copiedSection === 'burn_fuse' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  복사
                </button>
              </div>
              <pre className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-[10px] font-mono text-cyan-300 overflow-x-auto whitespace-pre-wrap">
                {avrdudeBurnCommand}
              </pre>
            </div>

            {/* Flash hex burn command */}
            <div className="space-y-1 pt-2 border-t border-slate-900">
              <div className="flex justify-between items-center text-[10px] text-slate-400">
                <span>2. 부트로더 HEX 및 락 비트 굽기:</span>
                <button
                  onClick={() => handleCopy(avrdudeFlashCommand, 'flash_hex')}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[10px]"
                >
                  {copiedSection === 'flash_hex' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  복사
                </button>
              </div>
              <pre className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-[10px] font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                {avrdudeFlashCommand}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Code Snippets Tabbed Box: Makefile & C Bare-metal skeleton */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              부트로더 소스코드 &amp; Makefile 스크립트
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(generatedMakefile, 'makefile')}
              className="flex items-center gap-1 text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-900 text-xs transition border border-slate-800"
            >
              {copiedSection === 'makefile' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              Makefile 복사
            </button>
            <button
              onClick={() => handleCopy(minimalBootloaderC, 'c_code')}
              className="flex items-center gap-1 text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-900 text-xs transition border border-slate-800"
            >
              {copiedSection === 'c_code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              C 점프 루틴 복사
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
          {/* Makefile Viewer */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1">
              <span>Makefile (자동 생성)</span>
              <span className="text-cyan-400">avr-gcc 빌드 전용</span>
            </div>
            <pre className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60 custom-scrollbar">
              {generatedMakefile}
            </pre>
          </div>

          {/* Minimal C Jump Routine */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1">
              <span>bootloader_exit.c (안전한 앱 복귀 루틴)</span>
              <span className="text-emerald-400">WDT &amp; IVSEL 복구 포함</span>
            </div>
            <pre className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60 custom-scrollbar">
              {minimalBootloaderC}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
