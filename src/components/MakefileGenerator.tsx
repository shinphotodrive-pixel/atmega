import React, { useState, useMemo, useEffect } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  FileCode2,
  Copy,
  Check,
  Download,
  Terminal,
  Settings2,
  Layers,
  Cpu,
  Clock,
  Zap,
  ShieldCheck,
  Sliders,
  FolderTree,
  FileCheck2,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

interface CompilerFlagOption {
  id: string;
  flag: string;
  category: 'optimization' | 'size' | 'warnings' | 'code-generation' | 'debugging' | 'standards';
  label: string;
  description: string;
  recommended: boolean;
  defaultChecked: boolean;
}

const COMPILER_FLAGS_REGISTRY: CompilerFlagOption[] = [
  // Size & Optimization
  {
    id: 'opt-os',
    flag: '-Os',
    category: 'optimization',
    label: '-Os (Optimize for Size)',
    description: 'AVR 플래시 메모리 절약에 가장 최적화된 필수 옵션. 인라인 및 루프 크기를 최소화합니다.',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'ffunction-sections',
    flag: '-ffunction-sections',
    category: 'size',
    label: '-ffunction-sections',
    description: '각 C 함수를 독립된 ELF 섹션(.text.func_name)으로 분리하여 링커 가비지 컬렉션을 가능하게 합니다.',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'fdata-sections',
    flag: '-fdata-sections',
    category: 'size',
    label: '-fdata-sections',
    description: '각 전역/정적 변수를 개별 데이터 섹션으로 분리하여 미참조 변수를 링커가 제거할 수 있게 합니다.',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'funsigned-char',
    flag: '-funsigned-char',
    category: 'code-generation',
    label: '-funsigned-char',
    description: '기본 char 타입을 unsigned char(uint8_t)로 간주하여 8비트 AVR 하드웨어 연산 효율을 극대화합니다.',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'funsigned-bitfields',
    flag: '-funsigned-bitfields',
    category: 'code-generation',
    label: '-funsigned-bitfields',
    description: '구조체 비트필드를 부호 없는 정수로 처리하여 불필요한 부호 확장(Sign Extension) 명령을 억제합니다.',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'fpack-struct',
    flag: '-fpack-struct',
    category: 'code-generation',
    label: '-fpack-struct',
    description: '구조체 멤버 간 패딩 바이트를 제거하여 SRAM 메모리 누수를 방지합니다.',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'fshort-enums',
    flag: '-fshort-enums',
    category: 'code-generation',
    label: '-fshort-enums',
    description: 'enum 열거형을 16/32비트가 아닌 값 범위에 맞는 최소 바이트 크기(1바이트 등)로 압축합니다.',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'flto',
    flag: '-flto',
    category: 'optimization',
    label: '-flto (Link Time Optimization)',
    description: '컴파일 단위 경계를 넘어 전체 프로젝트 수준에서 인라인 및 불필요한 코드를 정밀 제거합니다.',
    recommended: true,
    defaultChecked: false
  },
  {
    id: 'mcall-prologues',
    flag: '-mcall-prologues',
    category: 'size',
    label: '-mcall-prologues',
    description: '함수 진입/복귀 시 레지스터 Push/Pop 루틴을 공통 서브루틴으로 호출하여 플래시 크기를 추가 절약합니다.',
    recommended: false,
    defaultChecked: false
  },
  // Warnings & Quality
  {
    id: 'wall',
    flag: '-Wall',
    category: 'warnings',
    label: '-Wall',
    description: '컴파일러 기본 경고 집합 활성화 (미초기화 변수, 묵시적 캐스팅 등 검출)',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'wextra',
    flag: '-Wextra',
    category: 'warnings',
    label: '-Wextra',
    description: '추가적인 엄격한 경고 활성화 (부호 비교, 미사용 매개변수 등 검출)',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'werror',
    flag: '-Werror',
    category: 'warnings',
    label: '-Werror (Treat Warnings as Errors)',
    description: '모든 경고를 에러로 취급하여 무결점 펌웨어 빌드를 강제합니다.',
    recommended: false,
    defaultChecked: false
  },
  {
    id: 'wstrict-prototypes',
    flag: '-Wstrict-prototypes',
    category: 'warnings',
    label: '-Wstrict-prototypes',
    description: '함수 선언 시 인수 타입이 생략된 구형 K&R 스타일 함수 선언을 엄격히 방지합니다.',
    recommended: true,
    defaultChecked: true
  },
  // Debugging & Formats
  {
    id: 'g2',
    flag: '-g2 -gdwarf-2',
    category: 'debugging',
    label: '-g2 -gdwarf-2 (DWARF-2 Debug Symbol)',
    description: 'AVR Studio / SimAVR / GDB 하드웨어 디버깅용 디버그 심볼을 ELF에 포함합니다.',
    recommended: true,
    defaultChecked: false
  }
];

export const MakefileGenerator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Config State
  const [targetMCU, setTargetMCU] = useState<SupportedMCU>(selectedMCU);

  useEffect(() => {
    setTargetMCU(selectedMCU);
  }, [selectedMCU]);

  const [projectName, setProjectName] = useState<string>('avr_firmware');
  const [fCpu, setFCpu] = useState<number>(16000000);
  const [customFCpu, setCustomFCpu] = useState<string>('16000000');
  const [isCustomClock, setIsCustomClock] = useState<boolean>(false);
  const [optLevel, setOptLevel] = useState<'Os' | 'O1' | 'O2' | 'O3' | 'O0'>('Os');
  const [showFlagGuide, setShowFlagGuide] = useState<boolean>(true);
  const [cStandard, setCStandard] = useState<'c99' | 'c11' | 'gnu99' | 'gnu11'>('gnu11');
  const [programmer, setProgrammer] = useState<'arduino' | 'usbasp' | 'stk500v1' | 'stk500v2' | 'avrispmkII' | 'jtag2'>('arduino');
  const [port, setPort] = useState<string>('/dev/ttyACM0');
  const [baud, setBaud] = useState<number>(115200);

  // Advanced toggles
  const [enableEepromHex, setEnableEepromHex] = useState<boolean>(true);
  const [enableDisasm, setEnableDisasm] = useState<boolean>(true);
  const [enableSymbolSize, setEnableSymbolSize] = useState<boolean>(true);
  const [enableFuseTargets, setEnableFuseTargets] = useState<boolean>(true);
  const [buildDir, setBuildDir] = useState<string>('build');

  // Selected compiler flags
  const [selectedFlags, setSelectedFlags] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    COMPILER_FLAGS_REGISTRY.forEach((f) => {
      init[f.id] = f.defaultChecked;
    });
    return init;
  });

  const [copied, setCopied] = useState<boolean>(false);
  const [activeOutputTab, setActiveOutputTab] = useState<'makefile' | 'usage' | 'files'>('makefile');

  // MCU Part mappings for avr-gcc and avrdude
  const mcuConfig = useMemo(() => {
    switch (targetMCU) {
      case 'atmega2560':
        return {
          gccMcu: 'atmega2560',
          avrdudePart: 'm2560',
          flashBytes: 262144,
          sramBytes: 8192,
          eepromBytes: 4096,
          defaultBaud: 115200,
          lfuse: '0xFF',
          hfuse: '0xD8',
          efuse: '0xFD'
        };
      case 'atmega328p':
        return {
          gccMcu: 'atmega328p',
          avrdudePart: 'm328p',
          flashBytes: 32768,
          sramBytes: 2048,
          eepromBytes: 1024,
          defaultBaud: 115200,
          lfuse: '0xFF',
          hfuse: '0xDE',
          efuse: '0xFD'
        };
      case 'atmega128':
        return {
          gccMcu: 'atmega128',
          avrdudePart: 'm128',
          flashBytes: 131072,
          sramBytes: 4096,
          eepromBytes: 4096,
          defaultBaud: 57600,
          lfuse: '0xFF',
          hfuse: '0xCA',
          efuse: '0xFF'
        };
      case 'atmega640':
      default:
        return {
          gccMcu: 'atmega640',
          avrdudePart: 'm640',
          flashBytes: 65536,
          sramBytes: 8192,
          eepromBytes: 4096,
          defaultBaud: 115200,
          lfuse: '0xFF',
          hfuse: '0xD8',
          efuse: '0xFD'
        };
    }
  }, [targetMCU]);

  const effectiveFCpu = isCustomClock ? parseInt(customFCpu, 10) || 16000000 : fCpu;

  // Toggle flag
  const toggleFlag = (id: string) => {
    setSelectedFlags((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSelectPreset = (preset: 'minimal-size' | 'strict-safe' | 'debug-dev' | 'arduino-compat') => {
    const updated: Record<string, boolean> = {};
    COMPILER_FLAGS_REGISTRY.forEach((f) => {
      updated[f.id] = false;
    });

    if (preset === 'minimal-size') {
      setOptLevel('Os');
      updated['opt-os'] = true;
      updated['ffunction-sections'] = true;
      updated['fdata-sections'] = true;
      updated['funsigned-char'] = true;
      updated['funsigned-bitfields'] = true;
      updated['fpack-struct'] = true;
      updated['fshort-enums'] = true;
      updated['flto'] = true;
      updated['mcall-prologues'] = true;
      updated['wall'] = true;
    } else if (preset === 'strict-safe') {
      setOptLevel('Os');
      updated['opt-os'] = true;
      updated['ffunction-sections'] = true;
      updated['fdata-sections'] = true;
      updated['wall'] = true;
      updated['wextra'] = true;
      updated['werror'] = true;
      updated['wstrict-prototypes'] = true;
      updated['funsigned-char'] = true;
      updated['funsigned-bitfields'] = true;
      updated['fpack-struct'] = true;
      updated['fshort-enums'] = true;
    } else if (preset === 'debug-dev') {
      setOptLevel('O0');
      updated['wall'] = true;
      updated['wextra'] = true;
      updated['g2'] = true;
    } else if (preset === 'arduino-compat') {
      setOptLevel('Os');
      updated['opt-os'] = true;
      updated['ffunction-sections'] = true;
      updated['fdata-sections'] = true;
      updated['funsigned-char'] = true;
      updated['funsigned-bitfields'] = true;
      updated['fpack-struct'] = true;
      updated['fshort-enums'] = true;
      updated['wall'] = true;
      updated['flto'] = true;
    }

    setSelectedFlags(updated);
  };

  // Generate Makefile content
  const generatedMakefile = useMemo(() => {
    const activeFlagsList: string[] = [];

    COMPILER_FLAGS_REGISTRY.forEach((flagItem) => {
      if (selectedFlags[flagItem.id]) {
        // -Os is handled via optLevel variable
        if (flagItem.id !== 'opt-os') {
          activeFlagsList.push(flagItem.flag);
        }
      }
    });

    const isLtoEnabled = selectedFlags['flto'];

    return `# ==============================================================================
# Production-Ready Makefile for AVR Microcontrollers
# Target MCU   : ${MCU_PROFILES[targetMCU].name} (${mcuConfig.gccMcu})
# Architecture : 8-bit AVR RISC (${mcuConfig.flashBytes / 1024}KB Flash, ${mcuConfig.sramBytes}B SRAM, ${mcuConfig.eepromBytes}B EEPROM)
# Generated By : AVR Firmware Architecture & Resource Guide
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Project & Hardware Configuration
# ------------------------------------------------------------------------------
PROJECT       ?= ${projectName}
MCU           ?= ${mcuConfig.gccMcu}
F_CPU         ?= ${effectiveFCpu}UL
BUILD_DIR     ?= ${buildDir}
TARGET_ELF     = $(BUILD_DIR)/$(PROJECT).elf
TARGET_HEX     = $(BUILD_DIR)/$(PROJECT).hex
TARGET_BIN     = $(BUILD_DIR)/$(PROJECT).bin
TARGET_EEP     = $(BUILD_DIR)/$(PROJECT).eep
TARGET_MAP     = $(BUILD_DIR)/$(PROJECT).map
TARGET_LST     = $(BUILD_DIR)/$(PROJECT).lst

# ------------------------------------------------------------------------------
# 2. Toolchain Binaries
# ------------------------------------------------------------------------------
CC             = avr-gcc
CXX            = avr-g++
OBJCOPY        = avr-objcopy
OBJDUMP        = avr-objdump
SIZE           = avr-size
NM             = avr-nm
AVRDUDE        = avrdude
MKDIR_P        = mkdir -p
RM             = rm -rf

# ------------------------------------------------------------------------------
# 3. Source Files & Include Paths
# ------------------------------------------------------------------------------
# Automatically search for .c and .cpp files in current directory and src/
SRCS_C        ?= $(wildcard *.c) $(wildcard src/*.c)
SRCS_CPP      ?= $(wildcard *.cpp) $(wildcard src/*.cpp)
SRCS_ASM      ?= $(wildcard *.S) $(wildcard src/*.S)

OBJS           = $(patsubst %.c,$(BUILD_DIR)/%.o,$(SRCS_C)) \\
                 $(patsubst %.cpp,$(BUILD_DIR)/%.o,$(SRCS_CPP)) \\
                 $(patsubst %.S,$(BUILD_DIR)/%.o,$(SRCS_ASM))

INCLUDES      ?= -I. -Iinclude -Isrc

# ------------------------------------------------------------------------------
# 4. Compiler & Linker Flags
# ------------------------------------------------------------------------------
# Target Architecture & Frequency Define
ARCH_FLAGS     = -mmcu=$(MCU) -DF_CPU=$(F_CPU)

# C Optimization & Standard
OPT_FLAGS      = -${optLevel} -std=${cStandard}

# Selected Custom & Production Flags
CUSTOM_FLAGS   = ${activeFlagsList.join(' \\\n                 ')}

# Full C Compiler Flags
CFLAGS         = $(ARCH_FLAGS) \\
                 $(OPT_FLAGS) \\
                 $(CUSTOM_FLAGS) \\
                 $(INCLUDES)

# Full C++ Compiler Flags
CXXFLAGS       = $(ARCH_FLAGS) \\
                 -${optLevel} \\
                 -std=c++14 \\
                 $(CUSTOM_FLAGS) \\
                 -fno-exceptions -fno-rtti \\
                 $(INCLUDES)

# Linker Flags (Garbage collection of unused sections for minimum flash usage)
LDFLAGS        = -mmcu=$(MCU) \\
                 -Wl,--gc-sections \\
                 -Wl,-Map=$(TARGET_MAP),--cref${isLtoEnabled ? ' \\\n                 -flto' : ''}

# ------------------------------------------------------------------------------
# 5. Flash Programmer (avrdude) Settings
# ------------------------------------------------------------------------------
AVRDUDE_MCU    = ${mcuConfig.avrdudePart}
PROGRAMMER    ?= ${programmer}
PORT          ?= ${port}
BAUD          ?= ${baud}

AVRDUDE_FLAGS  = -p $(AVRDUDE_MCU) -c $(PROGRAMMER)
ifneq ($(filter arduino stk500v1 stk500v2 wiring,$(PROGRAMMER)),)
    AVRDUDE_FLAGS += -P $(PORT) -b $(BAUD)
endif

# Default Target Fuse Configurations
LFUSE         ?= ${mcuConfig.lfuse}
HFUSE         ?= ${mcuConfig.hfuse}
EFUSE         ?= ${mcuConfig.efuse}

# ------------------------------------------------------------------------------
# 6. Build Targets
# ------------------------------------------------------------------------------
.PHONY: all clean flash size disasm eeprom fuses check-env help

# Default: compile, assemble, link, produce HEX and print memory footprint
all: check-env $(TARGET_HEX) ${enableEepromHex ? '$(TARGET_EEP) ' : ''}size

# Main ELF Linking
$(TARGET_ELF): $(OBJS) | $(BUILD_DIR)
	@echo "  [LD]       $@"
	@$(CC) $(LDFLAGS) -o $@ $^
	@chmod -x $@

# Intel HEX Generation (.text + .data, stripping .eeprom and fuses)
$(TARGET_HEX): $(TARGET_ELF)
	@echo "  [OBJCOPY]  $@"
	@$(OBJCOPY) -O ihex -R .eeprom -R .fuse -R .lock -R .signature $< $@

# Raw Binary Generation
$(TARGET_BIN): $(TARGET_ELF)
	@echo "  [BIN]      $@"
	@$(OBJCOPY) -O binary -R .eeprom -R .fuse -R .lock -R .signature $< $@

${enableEepromHex ? `# EEPROM Intel HEX Generation
$(TARGET_EEP): $(TARGET_ELF)
	@echo "  [EEPROM]   $@"
	@$(OBJCOPY) -j .eeprom --set-section-flags=.eeprom="alloc,load" \\
	            --change-section-lma .eeprom=0 -O ihex $< $@ || exit 0
` : ''}
# Compile C Source Files
$(BUILD_DIR)/%.o: %.c | $(BUILD_DIR)
	@mkdir -p $(dir $@)
	@echo "  [CC]       $<"
	@$(CC) $(CFLAGS) -c $< -o $@

# Compile C++ Source Files
$(BUILD_DIR)/%.o: %.cpp | $(BUILD_DIR)
	@mkdir -p $(dir $@)
	@echo "  [CXX]      $<"
	@$(CXX) $(CXXFLAGS) -c $< -o $@

# Assemble ASM Source Files
$(BUILD_DIR)/%.o: %.S | $(BUILD_DIR)
	@mkdir -p $(dir $@)
	@echo "  [AS]       $<"
	@$(CC) $(CFLAGS) -x assembler-with-cpp -c $< -o $@

# Create Build Directory
$(BUILD_DIR):
	@$(MKDIR_P) $(BUILD_DIR)

# ------------------------------------------------------------------------------
# 7. Utilities & Diagnostic Targets
# ------------------------------------------------------------------------------
# Display Flash & SRAM Memory Footprint (AVR specific parser)
size: $(TARGET_ELF)
	@echo ""
	@echo "================================================================="
	@echo " AVR Memory Consumption Report [$(MCU)]"
	@echo "================================================================="
	@$(SIZE) -C --mcu=$(MCU) $(TARGET_ELF)
	@echo "================================================================="
${enableSymbolSize ? `	@echo " Top 10 Largest Symbols in Flash:"
	@$(NM) --size-sort --print-size -C -r $(TARGET_ELF) | head -n 10
	@echo "================================================================="` : ''}

${enableDisasm ? `# Disassembly Output for Assembly Review
disasm: $(TARGET_ELF)
	@echo "  [OBJDUMP]  $(TARGET_LST)"
	@$(OBJDUMP) -h -S $< > $(TARGET_LST)
	@echo "Disassembly written to $(TARGET_LST)"
` : ''}
# Flash Application Firmware to AVR Flash via avrdude
flash: $(TARGET_HEX)
	@echo "Flashing $< to $(MCU) via $(PROGRAMMER)..."
	$(AVRDUDE) $(AVRDUDE_FLAGS) -U flash:w:$<:i

${enableEepromHex ? `# Flash EEPROM Image
flash-eeprom: $(TARGET_EEP)
	@echo "Flashing EEPROM to $(MCU)..."
	$(AVRDUDE) $(AVRDUDE_FLAGS) -U eeprom:w:$<:i
` : ''}
${enableFuseTargets ? `# Program Low/High/Extended Fuses
fuses:
	@echo "Programming Fuses on $(MCU): LFUSE=$(LFUSE), HFUSE=$(HFUSE), EFUSE=$(EFUSE)"
	$(AVRDUDE) $(AVRDUDE_FLAGS) -U lfuse:w:$(LFUSE):m -U hfuse:w:$(HFUSE):m -U efuse:w:$(EFUSE):m

# Verify and Read Current Fuses
read-fuses:
	$(AVRDUDE) $(AVRDUDE_FLAGS) -v
` : ''}
# Clean Build Artifacts
clean:
	@echo "Cleaning build artifacts..."
	@$(RM) $(BUILD_DIR)
	@echo "Done."

# Validate Toolchain Presence
check-env:
	@which $(CC) > /dev/null || (echo "ERROR: $(CC) not found in PATH. Install avr-gcc and avr-libc." && exit 1)

# Quick Help Menu
help:
	@echo "Available Targets:"
	@echo "  all          : Compile firmware and generate .hex (.elf, .map)"
	@echo "  flash        : Upload firmware to target MCU using avrdude"
	@echo "  size         : Display precise Flash ROM & SRAM consumption"
	@echo "  disasm       : Generate assembly source listing ($(TARGET_LST))"
${enableEepromHex ? '	@echo "  flash-eeprom : Write $(TARGET_EEP) into AVR EEPROM"\n' : ''}${enableFuseTargets ? '	@echo "  fuses        : Program target fuses (LFUSE/HFUSE/EFUSE)"\n' : ''}	@echo "  clean        : Remove build directory and compiled objects"
`;
  }, [
    targetMCU,
    projectName,
    effectiveFCpu,
    buildDir,
    optLevel,
    cStandard,
    selectedFlags,
    programmer,
    port,
    baud,
    enableEepromHex,
    enableDisasm,
    enableSymbolSize,
    enableFuseTargets,
    mcuConfig
  ]);

  const copyMakefile = () => {
    navigator.clipboard.writeText(generatedMakefile);
    setCopied(true);
    confetti({
      particleCount: 35,
      spread: 60,
      origin: { y: 0.2 }
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMakefile = () => {
    const blob = new Blob([generatedMakefile], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'Makefile');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-7 backdrop-blur shadow-2xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <FileCode2 className="w-3.5 h-3.5" /> Makefile Generator
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              Target: {MCU_PROFILES[targetMCU].name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-mono">
              F_CPU: {(effectiveFCpu / 1000000).toFixed(4)} MHz
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-mono">
              Toolchain: avr-gcc / avr-libc
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Production-Ready AVR Makefile Generator
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            컴파일러 최적화 플래그(<code>-Os</code>, <code>-ffunction-sections</code>, <code>-fdata-sections</code>, <code>-flto</code>),
            시스템 동작 주파수, MCU 아키텍처 및 avrdude 플래시 프로그래머 규격을 지정하여 배포 가능한 고신뢰성 Makefile을 자동 생성합니다.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
          <button
            onClick={copyMakefile}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-cyan-500/20"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? '복사 완료!' : 'Makefile 복사'}</span>
          </button>
          <button
            onClick={downloadMakefile}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition border border-slate-700"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>다운로드</span>
          </button>
        </div>
      </div>

      {/* Compiler Flags Optimization In-Depth Guide (-mmcu, -O2 vs -Os, LTO) */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              AVR-GCC 최적 컴파일러 플래그 제안 & 심층 분석 (-mmcu, -O2 vs -Os, LTO)
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
              {MCU_PROFILES[targetMCU].name} 타깃 최적화
            </span>
          </div>
          <button
            onClick={() => setShowFlagGuide(!showFlagGuide)}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 transition font-mono"
          >
            {showFlagGuide ? '가이드 접기 ▲' : '가이드 펼치기 ▼'}
          </button>
        </div>

        {showFlagGuide && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
            {/* 1. -mmcu Flag */}
            <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-cyan-400 text-xs">
                  -mmcu={mcuConfig.gccMcu}
                </span>
                <span className="text-[10px] bg-cyan-950/80 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800/40 font-mono">
                  필수 아키텍처
                </span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                타깃 MCU의 <strong>하드웨어 레지스터 맵, 인터럽트 벡터 수, RAMSTART/RAMEND 주소, 하드웨어 곱셈기(mul) 유무</strong>를 컴파일러 백엔드에 바인딩합니다.
              </p>
              <div className="pt-1.5 border-t border-slate-800/60 font-mono text-[10px] text-slate-400 space-y-0.5">
                <div>• 플래시 ROM: <span className="text-white font-bold">{mcuConfig.flashBytes / 1024} KB</span></div>
                <div>• 내부 SRAM: <span className="text-white font-bold">{mcuConfig.sramBytes / 1024} KB</span></div>
                <div>• avrdude 타깃: <span className="text-amber-400 font-bold">-p {mcuConfig.avrdudePart}</span></div>
              </div>
            </div>

            {/* 2. -O2 vs -Os Flag Comparison */}
            <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-amber-400 text-xs">
                  -Os vs -O2 비교 분석
                </span>
                <span className="text-[10px] bg-amber-950/80 text-amber-300 px-1.5 py-0.5 rounded border border-amber-800/40 font-mono">
                  플래시 절약 vs 속도
                </span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                <strong className="text-emerald-400">-Os (권장):</strong> 루프 언롤링을 억제하고 크기를 최소화합니다. AVR은 캐시가 없으므로 코드 크기가 작을수록 인터럽트 응답과 실행 효율이 우수합니다.
              </p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                <strong className="text-amber-300">-O2:</strong> 공격적 인라이닝으로 플래시 크기가 <strong>15~35% 증가</strong>합니다. Flash가 제한된 AVR에서는 공간 부족을 초래할 수 있으므로, 주기적 고속 연산 함수에만 부분 적용을 권장합니다.
              </p>
            </div>

            {/* 3. LTO (-flto) Flag */}
            <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-emerald-400 text-xs">
                  -flto (Link Time Optimization)
                </span>
                <span className="text-[10px] bg-emerald-950/80 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800/40 font-mono">
                  고급 크기 절감
                </span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                소스 파일(.c) 경계를 넘어 링크 단계에서 전체 콜 그래프를 정밀 분석합니다. 크로스 모듈 인라인화와 미사용 함수/정적 변수를 완벽 제거하여 <strong>플래시 용량을 8~18% 추가 절약</strong>합니다.
              </p>
              <div className="pt-1.5 border-t border-slate-800/60 font-mono text-[10px] text-slate-400">
                <span>추천 조합: </span>
                <code className="text-emerald-300">-Os -flto -ffunction-sections -Wl,--gc-sections</code>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preset Quick Toolbar */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-white">최적화 프리셋 원클릭 적용:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => handleSelectPreset('minimal-size')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-white transition font-mono"
            title="-Os + LTO + GC-Sections + Pack Structs"
          >
            ⚡ 초소형 플래시 (Size Minimal)
          </button>
          <button
            onClick={() => handleSelectPreset('strict-safe')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500 text-slate-300 hover:text-white transition font-mono"
            title="-Wall -Wextra -Werror -Wstrict-prototypes"
          >
            🛡️ 무결점 방어 코딩 (Strict Warnings)
          </button>
          <button
            onClick={() => handleSelectPreset('arduino-compat')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-500 text-slate-300 hover:text-white transition font-mono"
            title="Arduino IDE Core 호환 플래그"
          >
            🔌 아두이노 호환 (Arduino IDE Match)
          </button>
          <button
            onClick={() => handleSelectPreset('debug-dev')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-rose-500 text-slate-300 hover:text-white transition font-mono"
            title="-O0 -g2 DWARF 디버깅"
          >
            🐞 디버그 & GDB 모드 (Debug/SimAVR)
          </button>
        </div>
      </div>

      {/* Grid: Configurations Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Target MCU & Hardware Frequency */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">타겟 MCU & 하드웨어 사양</h3>
          </div>

          {/* MCU Selector */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">타겟 마이크로컨트롤러 (MCU)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcu) => (
                <button
                  key={mcu}
                  type="button"
                  onClick={() => {
                    setTargetMCU(mcu);
                    if (onSelectMCU) onSelectMCU(mcu);
                  }}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition ${
                    targetMCU === mcu
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {MCU_PROFILES[mcu].name}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[11px] font-mono text-slate-400 bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
              <div>• GCC 아키텍처: <span className="text-cyan-300">-mmcu={mcuConfig.gccMcu}</span></div>
              <div>• avrdude 파트: <span className="text-cyan-300">-p {mcuConfig.avrdudePart}</span></div>
              <div>• 플래시 ROM 용량: <span className="text-white font-bold">{mcuConfig.flashBytes / 1024} KB</span></div>
            </div>
          </div>

          {/* Project Name */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">프로젝트 명 (바이너리 출력 이름)</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
              placeholder="avr_firmware"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Clock Frequency (F_CPU) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400 font-medium">동작 주파수 (F_CPU)</label>
              <button
                type="button"
                onClick={() => setIsCustomClock(!isCustomClock)}
                className="text-[10px] text-cyan-400 hover:underline font-mono"
              >
                {isCustomClock ? '프리셋 선택' : '직접 입력 (Hz)'}
              </button>
            </div>

            {isCustomClock ? (
              <div className="relative">
                <input
                  type="number"
                  value={customFCpu}
                  onChange={(e) => setCustomFCpu(e.target.value)}
                  placeholder="16000000"
                  className="w-full bg-slate-900 border border-cyan-500/50 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                />
                <span className="absolute right-3 top-1.5 text-[10px] text-slate-500 font-mono">Hz</span>
              </div>
            ) : (
              <select
                value={fCpu}
                onChange={(e) => setFCpu(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
              >
                <option value={16000000}>16.0000 MHz (5V 표준 크리스털)</option>
                <option value={8000000}>8.0000 MHz (3.3V 저전력 / 내부 RC)</option>
                <option value={20000000}>20.0000 MHz (ATmega 오버클럭 최대치)</option>
                <option value={11059200}>11.0592 MHz (UART 0% 정밀 보드레이트)</option>
                <option value={14745600}>14.7456 MHz (UART 전용 고속 크리스털)</option>
                <option value={18432000}>18.4320 MHz (고속 통신 크리스털)</option>
                <option value={12000000}>12.0000 MHz (V-USB 소프트웨어 USB)</option>
                <option value={1000000}>1.0000 MHz (공장 출하 8분주 초기치)</option>
              </select>
            )}
          </div>

          {/* Build Directory */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">빌드 출력 디렉터리 (BUILD_DIR)</label>
            <input
              type="text"
              value={buildDir}
              onChange={(e) => setBuildDir(e.target.value)}
              placeholder="build"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* Middle Column: Compiler Optimization & Standards */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">최적화 레벨 & C 언어 표준</h3>
          </div>

          {/* Optimization Level */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">최적화 수준 (Optimization Level)</label>
            <div className="grid grid-cols-5 gap-1 font-mono text-xs">
              {(['Os', 'O1', 'O2', 'O3', 'O0'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setOptLevel(level)}
                  className={`py-1.5 rounded-lg border font-bold transition text-center ${
                    optLevel === level
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  -{level}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-tight">
              {optLevel === 'Os' && '✅ -Os: AVR 임베디드 표준. 플래시 코드 크기를 최우선으로 줄입니다.'}
              {optLevel === 'O2' && '⚡ -O2: 속도 최적화. 루프 언롤링 등으로 코드 크기가 증가할 수 있습니다.'}
              {optLevel === 'O3' && '🚀 -O3: 최대 속도 최적화. 대규모 인라이닝으로 플래시를 많이 소모합니다.'}
              {optLevel === 'O0' && '🐞 -O0: 최적화 없음. SimAVR, JTAG 또는 GDB 하드웨어 디버깅용.'}
              {optLevel === 'O1' && '⚖️ -O1: 기본 수준의 가벼운 최적화.'}
            </p>
          </div>

          {/* C Standard */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">C 언어 표준 (-std)</label>
            <select
              value={cStandard}
              onChange={(e) => setCStandard(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
            >
              <option value="gnu11">gnu11 (GNU C11 확장 - 권장)</option>
              <option value="c11">c11 (ISO C11 순정 표준)</option>
              <option value="gnu99">gnu99 (GNU C99 레거시)</option>
              <option value="c99">c99 (ISO C99)</option>
            </select>
          </div>

          {/* Feature toggles */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-400 block">부가 타깃 생성 옵션:</span>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enableEepromHex}
                onChange={(e) => setEnableEepromHex(e.target.checked)}
                className="rounded accent-cyan-500 w-3.5 h-3.5"
              />
              <span>EEPROM 전용 바이너리 타깃 생성 (<code className="text-slate-400">.eep</code>)</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enableDisasm}
                onChange={(e) => setEnableDisasm(e.target.checked)}
                className="rounded accent-cyan-500 w-3.5 h-3.5"
              />
              <span>어셈블리 디스어셈블 타깃 (<code className="text-slate-400">make disasm</code>)</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enableSymbolSize}
                onChange={(e) => setEnableSymbolSize(e.target.checked)}
                className="rounded accent-cyan-500 w-3.5 h-3.5"
              />
              <span>가장 큰 심볼 Top 10 보고서 (<code className="text-slate-400">avr-nm</code>)</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enableFuseTargets}
                onChange={(e) => setEnableFuseTargets(e.target.checked)}
                className="rounded accent-cyan-500 w-3.5 h-3.5"
              />
              <span>퓨즈 바이트 기록 타깃 (<code className="text-slate-400">make fuses</code>)</span>
            </label>
          </div>
        </div>

        {/* Right Column: Flash Programmer & Upload Config */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">avrdude ISP 플래시 프로그래머</h3>
          </div>

          {/* Programmer Type */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">프로그래머 타입 (-c)</label>
            <select
              value={programmer}
              onChange={(e) => setProgrammer(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
            >
              <option value="arduino">arduino (Uno/Nano 부트로더 - 115200bps)</option>
              <option value="usbasp">usbasp (USBasp 전용 ISP 동글)</option>
              <option value="stk500v1">stk500v1 (Arduino as ISP / MegaCore)</option>
              <option value="stk500v2">stk500v2 (STK500v2 / AVRISP 2.0)</option>
              <option value="avrispmkII">avrispmkII (공식 Atmel AVRISP mkII)</option>
              <option value="jtag2">jtag2 (JTAG ICE mkII 디버거/ISP)</option>
            </select>
          </div>

          {/* Port */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">시리얼 통신 포트 (-P)</label>
            <input
              type="text"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="/dev/ttyACM0 or COM3"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
            />
            <div className="text-[10px] text-slate-500 mt-1 flex gap-2 font-mono">
              <span className="hover:text-slate-300 cursor-pointer" onClick={() => setPort('/dev/ttyACM0')}>
                Linux: /dev/ttyACM0
              </span>
              <span className="hover:text-slate-300 cursor-pointer" onClick={() => setPort('/dev/ttyUSB0')}>
                /dev/ttyUSB0
              </span>
              <span className="hover:text-slate-300 cursor-pointer" onClick={() => setPort('COM3')}>
                Win: COM3
              </span>
            </div>
          </div>

          {/* Baud Rate */}
          <div>
            <label className="text-xs text-slate-400 block mb-1 font-medium">업로드 보드레이트 (-b)</label>
            <select
              value={baud}
              onChange={(e) => setBaud(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
            >
              <option value={115200}>115,200 bps (Optiboot 328P / MegaCore)</option>
              <option value={57600}>57,600 bps (구형 Nano / ATmega128)</option>
              <option value={19200}>19,200 bps (Arduino as ISP)</option>
              <option value={250000}>250,000 bps (고속 USB 부트로더)</option>
            </select>
          </div>

          {/* Fuse preview */}
          <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400">
            <div className="text-slate-300 font-bold mb-1">기본 퓨즈 세팅 (avrdude):</div>
            <div className="flex justify-between">
              <span>Low Fuse: <strong className="text-amber-400">{mcuConfig.lfuse}</strong></span>
              <span>High Fuse: <strong className="text-amber-400">{mcuConfig.hfuse}</strong></span>
              <span>Ext Fuse: <strong className="text-amber-400">{mcuConfig.efuse}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Compiler Flags Selector Table */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">avr-gcc 컴파일러 플래그 세부 선택</h3>
            <span className="text-[11px] text-slate-400">
              ({Object.values(selectedFlags).filter(Boolean).length}개 활성화됨)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const all: Record<string, boolean> = {};
                COMPILER_FLAGS_REGISTRY.forEach((f) => {
                  all[f.id] = true;
                });
                setSelectedFlags(all);
              }}
              className="text-[11px] text-cyan-400 hover:underline font-mono"
            >
              전체 선택
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => {
                const def: Record<string, boolean> = {};
                COMPILER_FLAGS_REGISTRY.forEach((f) => {
                  def[f.id] = f.defaultChecked;
                });
                setSelectedFlags(def);
              }}
              className="text-[11px] text-slate-400 hover:underline font-mono"
            >
              기본값 복원
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {COMPILER_FLAGS_REGISTRY.map((item) => {
            const isChecked = !!selectedFlags[item.id];
            return (
              <div
                key={item.id}
                onClick={() => toggleFlag(item.id)}
                className={`p-3 rounded-xl border cursor-pointer transition select-none flex items-start gap-2.5 ${
                  isChecked
                    ? 'bg-slate-900/90 border-cyan-500/40 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800/60 opacity-60 hover:opacity-100 hover:border-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}} // handled by parent onClick
                  className="rounded accent-cyan-500 w-4 h-4 mt-0.5 shrink-0 cursor-pointer"
                />
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-bold text-cyan-300">{item.flag}</span>
                    {item.recommended && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                        권장
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Output Viewer: Tabs */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveOutputTab('makefile')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition font-mono flex items-center gap-1.5 ${
                activeOutputTab === 'makefile'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" /> Makefile
            </button>
            <button
              onClick={() => setActiveOutputTab('usage')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition font-mono flex items-center gap-1.5 ${
                activeOutputTab === 'usage'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" /> 빌드 & 플래싱 명령 가이드
            </button>
            <button
              onClick={() => setActiveOutputTab('files')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition font-mono flex items-center gap-1.5 ${
                activeOutputTab === 'files'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" /> 프로젝트 권장 디렉터리 구조
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyMakefile}
              className="text-slate-400 hover:text-white text-xs font-mono inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '복사됨' : '전체 복사'}</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Makefile Source */}
        {activeOutputTab === 'makefile' && (
          <div className="relative">
            <pre className="p-5 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto max-h-[520px] custom-scrollbar bg-slate-950/90 selection:bg-cyan-500/30">
              {generatedMakefile}
            </pre>
          </div>
        )}

        {/* Tab 2: Terminal Usage Guide */}
        {activeOutputTab === 'usage' && (
          <div className="p-6 space-y-4 text-xs font-mono">
            <div className="space-y-2">
              <span className="text-cyan-400 font-bold block text-sm"># 1. 펌웨어 컴파일 및 HEX 생성</span>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-slate-200">
                make
              </div>
              <p className="text-slate-400 text-[11px] font-sans">
                <code>{buildDir}/{projectName}.hex</code>, <code>{projectName}.bin</code> 및 <code>{projectName}.map</code> 파일이 생성되고 AVR 전용 플래시/SRAM 점유율이 터미널에 출력됩니다.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-emerald-400 font-bold block text-sm"># 2. 타겟 MCU로 펌웨어 ISP 업로드</span>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-slate-200">
                make flash
              </div>
              <p className="text-slate-400 text-[11px] font-sans">
                <code>avrdude</code>를 호출하여 <code>{programmer}</code> 프로그래머를 통해 {mcuConfig.gccMcu}에 펌웨어를 고속 라이팅합니다.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-amber-400 font-bold block text-sm"># 3. 플래시 메모리 점유 심볼 분석</span>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-slate-200">
                make size
              </div>
              <p className="text-slate-400 text-[11px] font-sans">
                <code>avr-size</code> 및 <code>avr-nm</code>을 실행하여 함수 및 전역 변수별 메모리 소모 순위를 확인합니다.
              </p>
            </div>

            {enableDisasm && (
              <div className="space-y-2">
                <span className="text-purple-400 font-bold block text-sm"># 4. 어셈블리 소스 디스어셈블링 분석</span>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-slate-200">
                  make disasm
                </div>
                <p className="text-slate-400 text-[11px] font-sans">
                  컴파일러가 생성한 기계어 및 C 소스 대응 라인을 <code>{buildDir}/{projectName}.lst</code>에 기록합니다.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <span className="text-rose-400 font-bold block text-sm"># 5. 빌드 부산물 완전 정리</span>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-slate-200">
                make clean
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Recommended Directory Structure */}
        {activeOutputTab === 'files' && (
          <div className="p-6 space-y-4 text-xs font-mono">
            <span className="text-cyan-400 font-bold block text-sm"># 표준 임베디드 C 프로젝트 디렉터리 배치</span>
            <pre className="bg-slate-900 p-4 rounded-lg border border-slate-800 text-slate-300 leading-relaxed">
{`${projectName}/
├── Makefile                <- 방금 생성한 본 Makefile
├── src/                    <- C/C++ 소스 파일 (*.c, *.cpp)
│   ├── main.c              <- 메인 진입점 (int main(void))
│   ├── uart.c              <- 통신 드라이버
│   └── timer.c             <- 타이머 인터럽트 서비스 루틴
├── include/                <- 헤더 파일 (*.h)
│   ├── pinmap.h
│   └── uart.h
└── build/                  <- 'make' 실행 시 자동 생성되는 빌드 결과물
    ├── ${projectName}.elf    <- ELF 바이너리 (심볼 포함)
    ├── ${projectName}.hex    <- 플래시 프로그래밍용 Intel HEX
    ├── ${projectName}.map    <- 링커 메모리 맵
    └── src/main.o`}
            </pre>
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 text-[11px] font-sans text-slate-400">
              💡 본 Makefile은 와일드카드 규칙(<code>wildcard *.c src/*.c</code>)을 내장하고 있어, <code>src/</code> 폴더 안에 새로운 <code>.c</code> 파일을 추가하더라도 Makefile을 수정할 필요 없이 즉시 빌드됩니다.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
