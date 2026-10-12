import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  HardDrive,
  Cpu,
  Layers,
  Terminal,
  Copy,
  Check,
  Download,
  Sliders,
  ShieldCheck,
  Zap,
  Info,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Clock,
  Radio,
  FileCode,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export const OptibootBuildConfigurator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Configuration State
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [fcpuHz, setFcpuHz] = useState<number>(16000000);
  const [selectedUart, setSelectedUart] = useState<number>(0);
  const [ledPin, setLedPin] = useState<string>(selectedMCU === 'atmega328p' ? 'B5' : 'B7');
  const [ledFlashes, setLedFlashes] = useState<number>(3);
  const [supportEeprom, setSupportEeprom] = useState<boolean>(true);
  const [fastBoot, setFastBoot] = useState<boolean>(false);
  const [bootSizeSelection, setBootSizeSelection] = useState<number>(selectedMCU === 'atmega328p' ? 512 : 1024);
  const [activeTab, setActiveTab] = useState<'c_source' | 'makefile' | 'flashing_cmd' | 'memory_map'>('c_source');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // MCU Specs for Bootloader
  const mcuSpecs = useMemo(() => {
    if (selectedMCU === 'atmega328p') {
      return {
        part: 'atmega328p',
        avrdudePart: 'm328p',
        flashBytes: 32768,
        pageSize: 128,
        hasBigBoot: false,
        maxUarts: 1,
        defaultLed: 'B5',
        bootSizes: [
          { size: 512, bootszBits: '11', hfuseBase: 0xDE, bootAddrHex: '0x7E00', bootWordHex: '0x3F00' },
          { size: 1024, bootszBits: '10', hfuseBase: 0xDC, bootAddrHex: '0x7C00', bootWordHex: '0x3E00' },
          { size: 2048, bootszBits: '01', hfuseBase: 0xDA, bootAddrHex: '0x7800', bootWordHex: '0x3C00' },
          { size: 4096, bootszBits: '00', hfuseBase: 0xD8, bootAddrHex: '0x7000', bootWordHex: '0x3800' }
        ],
        lfuse: '0xFF',
        efuse: '0xFD',
        lockByte: '0x0F'
      };
    } else if (selectedMCU === 'atmega128') {
      return {
        part: 'atmega128',
        avrdudePart: 'm128',
        flashBytes: 131072,
        pageSize: 256,
        hasBigBoot: true,
        maxUarts: 2,
        defaultLed: 'B7',
        bootSizes: [
          { size: 1024, bootszBits: '11', hfuseBase: 0xDC, bootAddrHex: '0x1FC00', bootWordHex: '0xFE00' },
          { size: 2048, bootszBits: '10', hfuseBase: 0xDA, bootAddrHex: '0x1F800', bootWordHex: '0xFC00' },
          { size: 4096, bootszBits: '01', hfuseBase: 0xD8, bootAddrHex: '0x1F000', bootWordHex: '0xF800' },
          { size: 8192, bootszBits: '00', hfuseBase: 0xD6, bootAddrHex: '0x1E000', bootWordHex: '0xF000' }
        ],
        lfuse: '0xFF',
        efuse: '0xFF',
        lockByte: '0x2F'
      };
    } else {
      // atmega640
      return {
        part: 'atmega640',
        avrdudePart: 'm640',
        flashBytes: 65536,
        pageSize: 256,
        hasBigBoot: true,
        maxUarts: 4,
        defaultLed: 'B7',
        bootSizes: [
          { size: 1024, bootszBits: '11', hfuseBase: 0xDC, bootAddrHex: '0xFC00', bootWordHex: '0x7E00' },
          { size: 2048, bootszBits: '10', hfuseBase: 0xDA, bootAddrHex: '0xF800', bootWordHex: '0x7C00' },
          { size: 4096, bootszBits: '01', hfuseBase: 0xD8, bootAddrHex: '0xF000', bootWordHex: '0x7800' },
          { size: 8192, bootszBits: '00', hfuseBase: 0xD6, bootAddrHex: '0xE000', bootWordHex: '0x7000' }
        ],
        lfuse: '0xFF',
        efuse: '0xFD',
        lockByte: '0x2F'
      };
    }
  }, [selectedMCU]);

  // Current Boot Config
  const activeBootConfig = useMemo(() => {
    const found = mcuSpecs.bootSizes.find((b) => b.size === bootSizeSelection);
    return found || mcuSpecs.bootSizes[0];
  }, [mcuSpecs, bootSizeSelection]);

  // U2X Baud Rate Calculations
  const baudCalculations = useMemo(() => {
    // Optiboot uses U2X mode (divisor = 8)
    const ubrrVal = Math.round(fcpuHz / (8 * baudRate) - 1);
    const actualBaud = fcpuHz / (8 * (ubrrVal + 1));
    const errorPct = ((actualBaud - baudRate) / baudRate) * 100;
    const isSafe = Math.abs(errorPct) <= 2.5;

    return { ubrrVal, actualBaud, errorPct, isSafe };
  }, [fcpuHz, baudRate]);

  // Full C Source Code for Optiboot
  const generatedOptibootC = useMemo(() => {
    const isMega = mcuSpecs.hasBigBoot;
    return `/**
 * @file    optiboot_${mcuSpecs.part}.c
 * @brief   최적화된 AVR Optiboot 고속 부트로더 소스 코드
 * @target  ${currentProfile.name} (${mcuSpecs.part})
 * @clock   ${fcpuHz.toLocaleString()} Hz | Baud: ${baudRate} bps (오차율: ${baudCalculations.errorPct.toFixed(2)}%)
 * @boot    시작 주소: ${activeBootConfig.bootAddrHex} (${activeBootConfig.size} Bytes)
 */

#define F_CPU ${fcpuHz}UL
#define BAUD_RATE ${baudRate}
#define LED_START_FLASHES ${ledFlashes}
#define UART ${selectedUart}

#include <inttypes.h>
#include <avr/io.h>
#include <avr/pgmspace.h>
#include <avr/boot.h>
#include <avr/wdt.h>
#include <avr/interrupt.h>

// STK500 v1 프로토콜 상수
#define STK_OK              0x10
#define STK_FAILED          0x11
#define STK_UNKNOWN         0x12
#define STK_INSYNC          0x14
#define STK_NOSYNC          0x15
#define CRC_EOP             0x20
#define STK_GET_SYNC        0x30
#define STK_GET_PARAMETER   0x41
#define STK_SET_DEVICE      0x42
#define STK_SET_DEVICE_EXT  0x45
#define STK_LOAD_ADDRESS    0x55
#define STK_PROG_PAGE       0x64
#define STK_READ_PAGE       0x74
#define STK_READ_SIGN       0x75
#define STK_LEAVE_PROGMODE  0x51

#define PAGE_SIZE           ${mcuSpecs.pageSize}

// 함수 원형 선언
void putch(char ch);
uint8_t getch(void);
void verifySpace(void);
void getNch(uint8_t count);
static inline void flash_led(uint8_t count);
void app_start(void) __attribute__ ((naked, noreturn));

// 1. 애플리케이션 시작 지점 점프 함수 (Flash 0x0000)
void app_start(void) {
    wdt_disable();
    // 인터럽트 벡터 테이블을 애플리케이션 영역으로 원복
    MCUCR = (1 << IVCE);
    MCUCR = 0;
    asm volatile ( "clr r1\\n\\t" "jmp 0x0000\\n\\t" );
}

// 2. UART 바이트 송수신 기본 루틴 (U2X 고속 모드)
#if UART == 0
  #define UART_SRA  UCSR0A
  #define UART_SRB  UCSR0B
  #define UART_UDR  UDR0
#elif UART == 1
  #define UART_SRA  UCSR1A
  #define UART_SRB  UCSR1B
  #define UART_UDR  UDR1
#else
  #define UART_SRA  UCSR0A
  #define UART_SRB  UCSR0B
  #define UART_UDR  UDR0
#endif

void putch(char ch) {
    while (!(UART_SRA & (1 << UDRE0)));
    UART_UDR = ch;
}

uint8_t getch(void) {
    uint8_t ch;
    while (!(UART_SRA & (1 << RXC0))) {
        wdt_reset(); // 수신 대기 중 워치독 리셋
    }
    ch = UART_UDR;
    return ch;
}

void verifySpace(void) {
    if (getch() != CRC_EOP) {
        putch(STK_NOSYNC);
        app_start();
    }
    putch(STK_INSYNC);
    putch(STK_OK);
}

void getNch(uint8_t count) {
    while (count--) getch();
    verifySpace();
}

static inline void flash_led(uint8_t count) {
#if LED_START_FLASHES > 0
    DDRB |= (1 << ${ledPin.slice(1)});
    while (count--) {
        PORTB ^= (1 << ${ledPin.slice(1)});
        for (volatile uint32_t i = 0; i < 40000; i++);
    }
#endif
}

// 3. 메인 부트로더 실행 루틴
int main(void) __attribute__ ((OS_main, section(".version")));
int main(void) {
    uint16_t address = 0;
    uint8_t ch;

    // 워치독 타이머 1초 설정
    wdt_enable(WDTO_1S);

    // UART0 U2X 배속 모드 초기화 (UBRR: ${baudCalculations.ubrrVal})
    UART_SRA = (1 << U2X0);
    UBRR0H = (uint8_t)(${baudCalculations.ubrrVal} >> 8);
    UBRR0L = (uint8_t)(${baudCalculations.ubrrVal});
    UART_SRB = (1 << RXEN0) | (1 << TXEN0);

    flash_led(LED_START_FLASHES * 2);

    // STK500 명령 처리 루프
    while (1) {
        ch = getch();

        if (ch == STK_GET_SYNC) {
            verifySpace();
        } else if (ch == STK_GET_PARAMETER) {
            uint8_t param = getch();
            verifySpace();
            if (param == 0x82) putch(${mcuSpecs.pageSize});
            else if (param == 0x81) putch(${mcuSpecs.pageSize});
            else putch(0x00);
        } else if (ch == STK_SET_DEVICE || ch == STK_SET_DEVICE_EXT) {
            getNch(ch == STK_SET_DEVICE ? 20 : 5);
        } else if (ch == STK_LOAD_ADDRESS) {
            address = getch();
            address |= (getch() << 8);
            address <<= 1; // 워드 -> 바이트 주소 변환
            verifySpace();
        } else if (ch == STK_PROG_PAGE) {
            uint16_t length = (getch() << 8) | getch();
            getch(); // 'F' or 'E'
            for (uint16_t i = 0; i < length; i += 2) {
                uint16_t w = getch() | (getch() << 8);
                boot_page_fill(address + i, w);
            }
            boot_page_erase(address);
            boot_spm_busy_wait();
            boot_page_write(address);
            boot_spm_busy_wait();
            boot_rww_enable();
            verifySpace();
        } else if (ch == STK_LEAVE_PROGMODE) {
            verifySpace();
            app_start();
        } else {
            verifySpace();
        }
    }
}
`;
  }, [
    mcuSpecs,
    currentProfile.name,
    fcpuHz,
    baudRate,
    baudCalculations,
    activeBootConfig,
    ledFlashes,
    selectedUart,
    ledPin
  ]);

  // Production Makefile
  const generatedMakefile = useMemo(() => {
    return `# ========================================================
# Optiboot Makefile for ${currentProfile.name}
# Target MCU: ${mcuSpecs.part}
# Boot Address: ${activeBootConfig.bootAddrHex} (${activeBootConfig.size} Bytes)
# F_CPU: ${fcpuHz} Hz | Baud: ${baudRate} bps
# ========================================================

MCU            = ${mcuSpecs.part}
F_CPU          = ${fcpuHz}UL
BAUD_RATE      = ${baudRate}
BOOT_ADDR      = ${activeBootConfig.bootAddrHex.toLowerCase()}

CC             = avr-gcc
OBJCOPY        = avr-objcopy
SIZE           = avr-size
AVRDUDE        = avrdude

# Fuses & Lock Configuration
LFUSE          = ${mcuSpecs.lfuse}
HFUSE          = 0x${activeBootConfig.hfuseBase.toString(16).toUpperCase()}
EFUSE          = ${mcuSpecs.efuse}
LOCK           = ${mcuSpecs.lockByte}

# Size-Optimized Flags
CFLAGS         = -mmcu=$(MCU) -Wall -Os -fno-inline-small-functions \\
                 -fno-split-wide-types -mshort-calls \\
                 -DF_CPU=$(F_CPU) -DBAUD_RATE=$(BAUD_RATE) \\
                 -DLED_START_FLASHES=${ledFlashes}

LDFLAGS        = -mmcu=$(MCU) -Wl,--section-start=.text=$(BOOT_ADDR) -Wl,--relax

TARGET         = optiboot_$(MCU)

all: $(TARGET).hex print_size

$(TARGET).elf: optiboot.c
\t$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $<

$(TARGET).hex: $(TARGET).elf
\t$(OBJCOPY) -j .text -j .data -O ihex $< $@

print_size: $(TARGET).elf
\t@$(SIZE) --format=avr --mcu=$(MCU) $<

# ISP Flashing Commands
fuses:
\t$(AVRDUDE) -c usbasp -p ${mcuSpecs.avrdudePart} -U lfuse:w:$(LFUSE):m -U hfuse:w:$(HFUSE):m -U efuse:w:$(EFUSE):m

flash_bootloader: $(TARGET).hex
\t$(AVRDUDE) -c usbasp -p ${mcuSpecs.avrdudePart} -U flash:w:$<:i -U lock:w:$(LOCK):m

clean:
\trm -f *.elf *.hex *.o
`;
  }, [
    currentProfile.name,
    mcuSpecs,
    activeBootConfig,
    fcpuHz,
    baudRate,
    ledFlashes
  ]);

  // CLI Build & Flash Commands
  const cliCommands = useMemo(() => {
    const hfuse = `0x${activeBootConfig.hfuseBase.toString(16).toUpperCase()}`;
    return `# 1. GCC 컴파일 명령 (크기 최적화 및 섹션 재배치)
avr-gcc -mmcu=${mcuSpecs.part} -Wall -Os -fno-inline-small-functions -mshort-calls \\
  -DF_CPU=${fcpuHz}UL -DBAUD_RATE=${baudRate} -DLED_START_FLASHES=${ledFlashes} \\
  -Wl,--section-start=.text=${activeBootConfig.bootAddrHex.toLowerCase()} -Wl,--relax \\
  -o optiboot_${mcuSpecs.part}.elf optiboot.c

# 2. Intel HEX 변환 및 바이너리 크기 검증
avr-objcopy -j .text -j .data -O ihex optiboot_${mcuSpecs.part}.elf optiboot_${mcuSpecs.part}.hex
avr-size --format=avr --mcu=${mcuSpecs.part} optiboot_${mcuSpecs.part}.elf

# 3. 퓨즈 비트 프로그래밍 (BOOTSZ 및 BOOTRST 부트 리셋 벡터 활성화)
avrdude -c usbasp -p ${mcuSpecs.avrdudePart} -U lfuse:w:${mcuSpecs.lfuse}:m -U hfuse:w:${hfuse}:m -U efuse:w:${mcuSpecs.efuse}:m

# 4. 부트로더 플래시 라이팅 및 락비트(Lock Bits) 설정 (부트로더 보호)
avrdude -c usbasp -p ${mcuSpecs.avrdudePart} -U flash:w:optiboot_${mcuSpecs.part}.hex:i -U lock:w:${mcuSpecs.lockByte}:m`;
  }, [mcuSpecs, fcpuHz, baudRate, ledFlashes, activeBootConfig]);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(label);
      confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 } });
      setTimeout(() => setCopiedText(null), 2500);
    } catch {}
  };

  const handleDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-7 shadow-2xl backdrop-blur">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <HardDrive className="w-3.5 h-3.5" /> AVR Optiboot 부트로더 빌더 (Bootloader Configurator)
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              Boot Size: {activeBootConfig.size} Bytes ({activeBootConfig.bootAddrHex})
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-800/40 text-xs font-mono font-bold">
              {currentProfile.name}
            </span>
            <span className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-bold border ${
              baudCalculations.isSafe
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/40'
                : 'bg-rose-950/80 text-rose-300 border-rose-800/40'
            }`}>
              Baud: {baudRate} bps (오차율: {baudCalculations.errorPct.toFixed(2)}%)
            </span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            AVR Optiboot 부트로더 설정 및 빌드 도구 (Optiboot Builder)
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            선택한 타깃 MCU와 전송 속도(Baud Rate), 클럭 주파수, LED 핀 설정을 바탕으로 최적화된 초경량 Optiboot C 소스 코드와 자동 빌드 Makefile, avrdude 퓨즈 라이팅 명령어를 실시간으로 생성합니다.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleCopy(generatedOptibootC, 'c_code')}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-600/20 flex items-center gap-1.5"
          >
            {copiedText === 'c_code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedText === 'c_code' ? '복사됨!' : 'optiboot.c 복사'}</span>
          </button>
          <button
            onClick={() => handleDownload('optiboot.c', generatedOptibootC)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.c 다운로드</span>
          </button>
        </div>
      </div>

      {/* Main Parameters Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
        {/* 1. Baud Rate Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span>부트로더 전송 속도 (Baud Rate)</span>
            <span className="font-mono text-amber-400 font-bold">{baudRate} bps</span>
          </label>
          <select
            value={baudRate}
            onChange={(e) => setBaudRate(parseInt(e.target.value) || 115200)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
          >
            <option value="115200">115,200 bps (Arduino Uno/Mega 표준)</option>
            <option value="57600">57,600 bps (구형 8MHz / Pro Mini 표준)</option>
            <option value="38400">38,400 bps</option>
            <option value="19200">19,200 bps (저속 노이즈 환경)</option>
            <option value="9600">9,600 bps (초저속 통신)</option>
            <option value="250000">250,000 bps (0% 고속 에러율)</option>
            <option value="500000">500,000 bps (초고속 업로드)</option>
          </select>
          <p className="text-[10px] text-slate-500 font-mono">
            UBRR 값: {baudCalculations.ubrrVal} (U2X0 배속 모드)
          </p>
        </div>

        {/* 2. Clock Frequency */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span>시스템 클럭 (F_CPU)</span>
            <span className="font-mono text-cyan-400 font-bold">{(fcpuHz / 1000000).toFixed(2)} MHz</span>
          </label>
          <select
            value={fcpuHz}
            onChange={(e) => setFcpuHz(parseInt(e.target.value) || 16000000)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
          >
            <option value="16000000">16.0 MHz (표준 크리스털)</option>
            <option value="8000000">8.0 MHz (내부 RC 또는 3.3V)</option>
            <option value="20000000">20.0 MHz (최대 정격 오버클럭)</option>
            <option value="12000000">12.0 MHz (V-USB)</option>
            <option value="7372800">7.3728 MHz (UART 0% 전송 오차)</option>
            <option value="11059200">11.0592 MHz (UART 0% 전송 오차)</option>
          </select>
          <p className={`text-[10px] font-mono ${baudCalculations.isSafe ? 'text-emerald-400' : 'text-rose-400'}`}>
            통신 오차율: {baudCalculations.errorPct > 0 ? `+${baudCalculations.errorPct.toFixed(2)}` : baudCalculations.errorPct.toFixed(2)}%
          </p>
        </div>

        {/* 3. Bootloader Size & Fuse */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span>부트 섹션 크기 (BOOTSZ)</span>
            <span className="font-mono text-violet-400 font-bold">{activeBootConfig.size} B</span>
          </label>
          <select
            value={bootSizeSelection}
            onChange={(e) => setBootSizeSelection(parseInt(e.target.value) || 512)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
          >
            {mcuSpecs.bootSizes.map((b) => (
              <option key={b.size} value={b.size}>
                {b.size} Bytes (시작: {b.bootAddrHex})
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-500 font-mono">
            High Fuse: 0x{activeBootConfig.hfuseBase.toString(16).toUpperCase()} (BOOTRST On)
          </p>
        </div>

        {/* 4. LED Indicator Pin */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span>부팅 LED 표시 핀 (LED Pin)</span>
            <span className="font-mono text-amber-400 font-bold">{ledPin} ({ledFlashes}회)</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={ledPin}
              onChange={(e) => setLedPin(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-2 py-2 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
            >
              <option value="B5">PB5 (Uno D13)</option>
              <option value="B7">PB7 (Mega D13)</option>
              <option value="D6">PD6</option>
              <option value="E0">PE0</option>
            </select>
            <select
              value={ledFlashes}
              onChange={(e) => setLedFlashes(parseInt(e.target.value) || 0)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-2 py-2 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
            >
              <option value="3">3회 점멸</option>
              <option value="1">1회 점멸</option>
              <option value="0">점멸 없음</option>
            </select>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            업로드 모드 진입 시 시각적 확인
          </p>
        </div>
      </div>

      {/* Output Tabs & Code Viewer */}
      <div className="space-y-4">
        {/* Tab Headers */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'c_source', label: 'optiboot.c 소스 코드', icon: FileCode },
              { id: 'makefile', label: '컴파일 Makefile', icon: Terminal },
              { id: 'flashing_cmd', label: 'avrdude 라이팅 명령어', icon: Zap },
              { id: 'memory_map', label: '플래시 메모리 맵 배치', icon: Layers }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border ${
                    activeTab === tab.id
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              const txt = activeTab === 'c_source' ? generatedOptibootC : activeTab === 'makefile' ? generatedMakefile : cliCommands;
              handleCopy(txt, activeTab);
            }}
            className="text-xs text-amber-400 hover:text-amber-300 font-mono flex items-center gap-1"
          >
            {copiedText === activeTab ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedText === activeTab ? '복사 완료!' : '내용 복사'}</span>
          </button>
        </div>

        {/* Tab Content 1: C Source Code */}
        {activeTab === 'c_source' && (
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-400">
              <span>optiboot_{mcuSpecs.part}.c ({activeBootConfig.size}B Target)</span>
              <span className="text-emerald-400 font-bold">Production Ready</span>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-96">
              <code>{generatedOptibootC}</code>
            </pre>
          </div>
        )}

        {/* Tab Content 2: Makefile */}
        {activeTab === 'makefile' && (
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-400">
              <span>Makefile</span>
              <span className="text-amber-400 font-bold">AVR-GCC Toolchain</span>
            </div>
            <pre className="p-4 text-xs font-mono text-amber-300/90 overflow-x-auto leading-relaxed max-h-96">
              <code>{generatedMakefile}</code>
            </pre>
          </div>
        )}

        {/* Tab Content 3: Flashing Commands */}
        {activeTab === 'flashing_cmd' && (
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-400">
                <span>터미널 복사 실행 명령어 (Terminal CLI)</span>
                <span className="text-emerald-400 font-bold">USBasp / ISP</span>
              </div>
              <pre className="p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                <code>{cliCommands}</code>
              </pre>
            </div>
          </div>
        )}

        {/* Tab Content 4: Memory Map View */}
        {activeTab === 'memory_map' && (
          <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-300 pb-2 border-b border-slate-800">
              <span className="font-bold text-white">플래시 메모리 영역 배치 (Flash Memory Layout)</span>
              <span>총 플래시: {mcuSpecs.flashBytes.toLocaleString()} 바이트</span>
            </div>

            <div className="h-16 w-full rounded-xl overflow-hidden flex border border-slate-800">
              {/* Application Section */}
              <div
                style={{ width: `${((mcuSpecs.flashBytes - activeBootConfig.size) / mcuSpecs.flashBytes) * 100}%` }}
                className="bg-slate-800 hover:bg-slate-700 transition p-2 flex flex-col justify-between text-slate-300 select-none"
              >
                <div className="font-bold flex items-center justify-between text-[11px]">
                  <span>Application Section</span>
                  <span>{(mcuSpecs.flashBytes - activeBootConfig.size).toLocaleString()} Bytes</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  0x0000 ~ {(parseInt(activeBootConfig.bootAddrHex, 16) - 1).toString(16).toUpperCase()}
                </div>
              </div>

              {/* Bootloader Section */}
              <div
                style={{ width: `${(activeBootConfig.size / mcuSpecs.flashBytes) * 100}%` }}
                className="bg-amber-600 hover:bg-amber-500 transition p-2 flex flex-col justify-between text-slate-950 font-bold select-none min-w-[120px]"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span>Optiboot</span>
                  <span>{activeBootConfig.size} B</span>
                </div>
                <div className="text-[10px] opacity-90">
                  {activeBootConfig.bootAddrHex} ~ {(mcuSpecs.flashBytes - 1).toString(16).toUpperCase()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-400 text-[11px]">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">부트 리셋 벡터 (BOOTRST)</span>
                <span className="text-amber-400 font-bold">활성화됨 (전원 인가 시 {activeBootConfig.bootAddrHex}로 즉시 실행)</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">락 비트 (Lock Bits) 보호</span>
                <span className="text-emerald-400 font-bold">{mcuSpecs.lockByte} (부트로더 섹션 SPM 덮어쓰기 방지)</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">페이지 사이즈 (Page Size)</span>
                <span className="text-cyan-400 font-bold">{mcuSpecs.pageSize} Bytes ({mcuSpecs.pageSize / 2} Words)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
