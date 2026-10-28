import React, { useState, useMemo } from 'react';
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
  Sparkles,
  HelpCircle,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  Code2,
  FolderTree
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type BuildSystemFormat = 'makefile' | 'cmakelists' | 'toolchain_cmake';

export type OptimizationLevel = 'Os' | 'O0' | 'O1' | 'O2' | 'O3' | 'Ofast';

interface CompilerFlagOption {
  id: string;
  flag: string;
  category: 'optimization' | 'size' | 'warnings' | 'codegen' | 'debug';
  label: string;
  description: string;
  flashImpact: string;
  recommended: boolean;
  defaultChecked: boolean;
}

const COMPILER_FLAGS_REGISTRY: CompilerFlagOption[] = [
  // Size & Linker Optimization
  {
    id: 'flto',
    flag: '-flto',
    category: 'optimization',
    label: '-flto (Link-Time Optimization)',
    description: '컴파일 단위 경계를 넘어 전체 프로그램 수준에서 인라인 및 미사용 코드를 정밀 제거합니다.',
    flashImpact: '10~25% 절감',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'ffunction-sections',
    flag: '-ffunction-sections',
    category: 'size',
    label: '-ffunction-sections',
    description: '각 C 함수를 독립된 ELF 섹션(.text.func_name)으로 분리하여 링커 가비지 컬렉션을 가능하게 합니다.',
    flashImpact: '5~15% 절감',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'fdata-sections',
    flag: '-fdata-sections',
    category: 'size',
    label: '-fdata-sections',
    description: '각 전역/정적 변수를 개별 데이터 섹션으로 분리하여 미참조 변수를 링커가 제거할 수 있게 합니다.',
    flashImpact: '2~8% 절감',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'gc-sections',
    flag: '-Wl,--gc-sections',
    category: 'size',
    label: '-Wl,--gc-sections (Linker Dead Code Strip)',
    description: '참조되지 않는 섹션(함수 및 변수)을 최종 ELF에서 완전히 소거합니다.',
    flashImpact: '핵심 필수 (최대 30% 절감)',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'mcall-prologues',
    flag: '-mcall-prologues',
    category: 'size',
    label: '-mcall-prologues',
    description: '함수 진입/복귀 시 레지스터 Push/Pop 명령을 공통 서브루틴으로 호출하여 코드 크기를 추가 절감합니다.',
    flashImpact: '3~7% 절감 (약간의 속도 희생)',
    recommended: false,
    defaultChecked: false
  },
  // 8-bit AVR Hardware Optimization
  {
    id: 'funsigned-char',
    flag: '-funsigned-char',
    category: 'codegen',
    label: '-funsigned-char',
    description: '기본 char 타입을 unsigned char(uint8_t)로 처리하여 8비트 AVR 하드웨어 연산 효율을 극대화합니다.',
    flashImpact: '2~5% 절감',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'funsigned-bitfields',
    flag: '-funsigned-bitfields',
    category: 'codegen',
    label: '-funsigned-bitfields',
    description: '구조체 비트필드를 부호 없는 정수로 간주하여 불필요한 부호 확장(Sign Extension) 명령을 억제합니다.',
    flashImpact: '1~3% 절감',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'fpack-struct',
    flag: '-fpack-struct',
    category: 'codegen',
    label: '-fpack-struct',
    description: '구조체 멤버 간 패딩 바이트를 제거하여 SRAM 메모리 누수를 방지합니다.',
    flashImpact: 'SRAM 절약',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'fshort-enums',
    flag: '-fshort-enums',
    category: 'codegen',
    label: '-fshort-enums',
    description: 'enum 열거형을 16/32비트 대신 값 범위에 맞는 최소 바이트 크기(1바이트 등)로 압축합니다.',
    flashImpact: '1~3% 절감',
    recommended: true,
    defaultChecked: true
  },
  // Compiler Warnings & Diagnostics
  {
    id: 'wall',
    flag: '-Wall',
    category: 'warnings',
    label: '-Wall (All Standard Warnings)',
    description: '컴파일러 기본 경고 집합 활성화 (미초기화 변수, 묵시적 캐스팅 등 검출)',
    flashImpact: '영향 없음 (코드 품질 향상)',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'wextra',
    flag: '-Wextra',
    category: 'warnings',
    label: '-Wextra (Extra Strict Warnings)',
    description: '추가적인 엄격한 경고 활성화 (부호 비교, 미사용 매개변수 등 검출)',
    flashImpact: '영향 없음 (코드 품질 향상)',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'wstrict-prototypes',
    flag: '-Wstrict-prototypes',
    category: 'warnings',
    label: '-Wstrict-prototypes',
    description: '인수 타입이 명시되지 않은 구형 K&R 스타일 C 함수 선언을 금지합니다.',
    flashImpact: '영향 없음 (C 표준 준수)',
    recommended: true,
    defaultChecked: true
  },
  {
    id: 'werror',
    flag: '-Werror',
    category: 'warnings',
    label: '-Werror (Warnings as Errors)',
    description: '모든 경고를 에러로 취급하여 무결점 펌웨어 빌드를 강제합니다.',
    flashImpact: '영향 없음 (무결점 빌드 강제)',
    recommended: false,
    defaultChecked: false
  },
  // Debugging & Formats
  {
    id: 'g2',
    flag: '-g2 -gdwarf-2',
    category: 'debug',
    label: '-g2 -gdwarf-2 (DWARF-2 Debug Symbol)',
    description: 'AVR Studio / SimAVR / GDB / Atmel-ICE 하드웨어 디버깅용 디버그 심볼을 ELF에 포함합니다.',
    flashImpact: 'ELF 파일만 증가 (HEX에는 미포함)',
    recommended: false,
    defaultChecked: false
  }
];

export const BuildConfigurator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Config State
  const [targetMCU, setTargetMCU] = useState<SupportedMCU>(selectedMCU);
  const [buildFormat, setBuildFormat] = useState<BuildSystemFormat>('makefile');
  const [projectName, setProjectName] = useState<string>('firmware_app');
  const [fCpu, setFCpu] = useState<number>(16000000);
  const [customFCpu, setCustomFCpu] = useState<string>('16000000');
  const [isCustomClock, setIsCustomClock] = useState<boolean>(false);
  const [optLevel, setOptLevel] = useState<OptimizationLevel>('Os');
  const [cStandard, setCStandard] = useState<'gnu11' | 'c11' | 'gnu99' | 'c99'>('gnu11');
  const [cxxStandard, setCxxStandard] = useState<'c++14' | 'c++17' | 'c++11'>('c++14');
  const [includeCppSupport, setIncludeCppSupport] = useState<boolean>(true);
  const [programmer, setProgrammer] = useState<'usbasp' | 'arduino' | 'stk500v2' | 'atmelice_isp' | 'wiring'>('usbasp');
  const [port, setPort] = useState<string>('/dev/ttyACM0');
  const [baud, setBaud] = useState<number>(115200);
  const [buildDir, setBuildDir] = useState<string>('build');

  // Advanced toggles
  const [enableEepromHex, setEnableEepromHex] = useState<boolean>(true);
  const [enableDisasm, setEnableDisasm] = useState<boolean>(true);
  const [enableFusesTarget, setEnableFusesTarget] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // Synchronize targetMCU when parent selectedMCU prop changes
  React.useEffect(() => {
    setTargetMCU(selectedMCU);
  }, [selectedMCU]);

  // Selected compiler flags
  const [selectedFlags, setSelectedFlags] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    COMPILER_FLAGS_REGISTRY.forEach((f) => {
      init[f.id] = f.defaultChecked;
    });
    return init;
  });

  // MCU Specs
  const mcuDetails = useMemo(() => {
    switch (targetMCU) {
      case 'atmega2560':
        return {
          gccMcu: 'atmega2560',
          avrdudePart: 'm2560',
          flashBytes: 262144,
          flashKb: 256,
          sramBytes: 8192,
          eepromBytes: 4096,
          defaultBaud: 115200,
          lfuse: '0xFF',
          hfuse: '0xD8',
          efuse: '0xFD',
          description: '256KB 대용량 플래시 & 4개 하드웨어 USART 지원 (Arduino Mega 2560 호환)'
        };
      case 'atmega128':
        return {
          gccMcu: 'atmega128',
          avrdudePart: 'm128',
          flashBytes: 131072,
          flashKb: 128,
          sramBytes: 4096,
          eepromBytes: 4096,
          defaultBaud: 57600,
          lfuse: '0xFF',
          hfuse: '0xCA',
          efuse: '0xFF',
          description: '128KB 플래시 & 산업용 64-TQFP 레거시 및 최신 임베디드 코어'
        };
      case 'atmega328p':
        return {
          gccMcu: 'atmega328p',
          avrdudePart: 'm328p',
          flashBytes: 32768,
          flashKb: 32,
          sramBytes: 2048,
          eepromBytes: 1024,
          defaultBaud: 115200,
          lfuse: '0xFF',
          hfuse: '0xDE',
          efuse: '0xFD',
          description: '32KB 플래시 & 표준 28-DIP / 32-TQFP (Arduino Uno/Nano 호환)'
        };
      case 'atmega640':
      default:
        return {
          gccMcu: 'atmega640',
          avrdudePart: 'm640',
          flashBytes: 65536,
          flashKb: 64,
          sramBytes: 8192,
          eepromBytes: 4096,
          defaultBaud: 115200,
          lfuse: '0xFF',
          hfuse: '0xD8',
          efuse: '0xFD',
          description: '64KB 플래시 & 86개 범용 GPIO (100-TQFP 고밀도 패키지)'
        };
    }
  }, [targetMCU]);

  const effectiveFCpu = isCustomClock ? parseInt(customFCpu, 10) || 16000000 : fCpu;

  // Toggle single compiler flag
  const toggleFlag = (id: string) => {
    setSelectedFlags((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Preset Configurations
  const applyPreset = (preset: 'minimal-size' | 'production-safe' | 'max-speed' | 'debug-dev' | 'arduino-compat') => {
    const updated: Record<string, boolean> = {};
    COMPILER_FLAGS_REGISTRY.forEach((f) => {
      updated[f.id] = false;
    });

    if (preset === 'minimal-size') {
      setOptLevel('Os');
      updated['flto'] = true;
      updated['ffunction-sections'] = true;
      updated['fdata-sections'] = true;
      updated['gc-sections'] = true;
      updated['mcall-prologues'] = true;
      updated['funsigned-char'] = true;
      updated['funsigned-bitfields'] = true;
      updated['fpack-struct'] = true;
      updated['fshort-enums'] = true;
      updated['wall'] = true;
    } else if (preset === 'production-safe') {
      setOptLevel('Os');
      updated['flto'] = true;
      updated['ffunction-sections'] = true;
      updated['fdata-sections'] = true;
      updated['gc-sections'] = true;
      updated['funsigned-char'] = true;
      updated['funsigned-bitfields'] = true;
      updated['fpack-struct'] = true;
      updated['fshort-enums'] = true;
      updated['wall'] = true;
      updated['wextra'] = true;
      updated['wstrict-prototypes'] = true;
    } else if (preset === 'max-speed') {
      setOptLevel('O3');
      updated['flto'] = true;
      updated['ffunction-sections'] = true;
      updated['fdata-sections'] = true;
      updated['gc-sections'] = true;
      updated['funsigned-char'] = true;
      updated['funsigned-bitfields'] = true;
      updated['wall'] = true;
    } else if (preset === 'debug-dev') {
      setOptLevel('O0');
      updated['wall'] = true;
      updated['wextra'] = true;
      updated['g2'] = true;
    } else if (preset === 'arduino-compat') {
      setOptLevel('Os');
      updated['flto'] = true;
      updated['ffunction-sections'] = true;
      updated['fdata-sections'] = true;
      updated['gc-sections'] = true;
      updated['funsigned-char'] = true;
      updated['funsigned-bitfields'] = true;
      updated['fpack-struct'] = true;
      updated['fshort-enums'] = true;
      updated['wall'] = true;
    }

    setSelectedFlags(updated);
  };

  // Optimization Level Description & Estimator
  const optLevelDetails = useMemo(() => {
    switch (optLevel) {
      case 'Os':
        return {
          title: '-Os (Optimize for Size)',
          flashSavings: '약 40~55% 절감 (기준: -O0 대비)',
          speedRating: '양호 (AVR 플래시 병목 해소)',
          debugRating: '제한적 (일부 변수 최적화 생략)',
          badge: 'AVR 임베디드 강력 권장',
          badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40',
          recommendation: '플래시가 수십 KB에 불과한 AVR MCU 환경에서 가장 신뢰성 높고 널리 검증된 표준입니다.'
        };
      case 'O0':
        return {
          title: '-O0 (No Optimization)',
          flashSavings: '최대 코드 팽창 (기준점: 100%)',
          speedRating: '가장 느림 (매 연산 메모리 R/W)',
          debugRating: '최상 (100% 소스-바이너리 1:1 매핑)',
          badge: 'GDB / SimAVR 디버깅 전용',
          badgeColor: 'text-amber-400 bg-amber-950/60 border-amber-800/40',
          recommendation: '하드웨어 브레이크포인트 설정 및 지역 변수 실시간 모니터링 시에만 임시로 사용하세요.'
        };
      case 'O1':
        return {
          title: '-O1 (Basic Optimization)',
          flashSavings: '약 20~30% 절감',
          speedRating: '기본 속도 향상',
          debugRating: '양호',
          badge: '기본 테스트 빌드',
          badgeColor: 'text-blue-400 bg-blue-950/60 border-blue-800/40',
          recommendation: '빠른 컴파일 속도와 최소한의 코드 정리가 필요할 때 사용합니다.'
        };
      case 'O2':
        return {
          title: '-O2 (Balanced Optimization)',
          flashSavings: '약 30~45% 절감',
          speedRating: '매우 우수 (루프 및 분기 최적화)',
          debugRating: '보통',
          badge: '속도 중시 범용 펌웨어',
          badgeColor: 'text-indigo-400 bg-indigo-950/60 border-indigo-800/40',
          recommendation: '인라인이 과도하게 팽창하지 않으면서 높은 클록 실행 성능을 보장합니다.'
        };
      case 'O3':
        return {
          title: '-O3 (Aggressive Optimization)',
          flashSavings: '인라인 및 루프 언롤링으로 플래시 증가 가능',
          speedRating: '최고 속도',
          debugRating: '어려움 (코드 재배치 극심)',
          badge: '고속 루프 & DSP/연산 전용',
          badgeColor: 'text-purple-400 bg-purple-950/60 border-purple-800/40',
          recommendation: '고속 인터럽트 핸들러나 디지털 필터 루틴 등 연산 지연 최소화가 필요할 때 선택합니다.'
        };
      case 'Ofast':
        return {
          title: '-Ofast (Aggressive + Fast Math)',
          flashSavings: '플래시 증가 가능',
          speedRating: '수학 부동소수점 극대화',
          debugRating: '불가',
          badge: '비표준 고속 수학',
          badgeColor: 'text-rose-400 bg-rose-950/60 border-rose-800/40',
          recommendation: '엄격한 IEEE 754 부동소수점 규격을 무시하고 연산 속도를 극대화합니다.'
        };
    }
  }, [optLevel]);

  // Generate Active Compile Flags List
  const activeCompileFlags = useMemo(() => {
    const list: string[] = [];
    COMPILER_FLAGS_REGISTRY.forEach((flagItem) => {
      if (selectedFlags[flagItem.id] && flagItem.id !== 'gc-sections') {
        list.push(flagItem.flag);
      }
    });
    return list;
  }, [selectedFlags]);

  const isLtoEnabled = selectedFlags['flto'];
  const isGcSectionsEnabled = selectedFlags['gc-sections'];

  // Generated Makefile Content
  const generatedMakefile = useMemo(() => {
    const customFlagsFormatted = activeCompileFlags.length > 0
      ? activeCompileFlags.map((f) => `CFLAGS        += ${f}`).join('\n')
      : '# No additional compiler flags';

    const customCxxFlags = activeCompileFlags
      .filter((f) => f !== '-Wstrict-prototypes')
      .map((f) => `CXXFLAGS      += ${f}`)
      .join('\n');

    return `# ==============================================================================
# AVR-GCC Production Makefile for ${currentProfile.name}
# Target MCU   : ${mcuDetails.gccMcu} (${mcuDetails.flashKb} KB Flash, ${mcuDetails.sramBytes} B SRAM)
# F_CPU        : ${effectiveFCpu} Hz (${(effectiveFCpu / 1000000).toFixed(2)} MHz)
# Optimization : -${optLevel} (${optLevelDetails.title})
# Generated by : AVR Embedded Architecture & Build Configuration Tool
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Project & Output Binary Configuration
# ------------------------------------------------------------------------------
PROJECT       ?= ${projectName}
MCU           ?= ${mcuDetails.gccMcu}
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
AVRDUDE        = avrdude
MKDIR_P        = mkdir -p
RM             = rm -rf

# ------------------------------------------------------------------------------
# 3. Source Files & Include Directories
# ------------------------------------------------------------------------------
# Collect all .c, .cpp, and .S files in current directory and src/
SRCS_C        ?= $(wildcard *.c) $(wildcard src/*.c)
SRCS_CPP      ?= $(wildcard *.cpp) $(wildcard src/*.cpp)
SRCS_ASM      ?= $(wildcard *.S) $(wildcard src/*.S)

OBJS           = $(patsubst %.c,$(BUILD_DIR)/%.o,$(SRCS_C)) \\
                 $(patsubst %.cpp,$(BUILD_DIR)/%.o,$(SRCS_CPP)) \\
                 $(patsubst %.S,$(BUILD_DIR)/%.o,$(SRCS_ASM))

INCLUDES      ?= -I. -Iinclude -Isrc

# ------------------------------------------------------------------------------
# 4. Compiler & Linker Flags (Optimization Level: -${optLevel})
# ------------------------------------------------------------------------------
# Base Architecture & Target Hardware Flags
CFLAGS         = -mmcu=$(MCU) -DF_CPU=$(F_CPU) -${optLevel} -std=${cStandard}
${customFlagsFormatted}
CFLAGS        += $(INCLUDES)

# C++ Compiler Flags
CXXFLAGS       = -mmcu=$(MCU) -DF_CPU=$(F_CPU) -${optLevel} -std=${cxxStandard}
CXXFLAGS      += -fno-exceptions -fno-rtti
${customCxxFlags}
CXXFLAGS      += $(INCLUDES)

# Linker Flags (Section Garbage Collection & Map Generation)
LDFLAGS        = -mmcu=$(MCU)${isGcSectionsEnabled ? ' -Wl,--gc-sections' : ''}${isLtoEnabled ? ' -flto' : ''}
LDFLAGS       += -Wl,-Map=$(TARGET_MAP),--cref

# ------------------------------------------------------------------------------
# 5. In-System Programmer (avrdude) Settings
# ------------------------------------------------------------------------------
AVRDUDE_MCU    = ${mcuDetails.avrdudePart}
PROGRAMMER    ?= ${programmer}
PORT          ?= ${port}
BAUD          ?= ${baud}

AVRDUDE_FLAGS  = -p $(AVRDUDE_MCU) -c $(PROGRAMMER)
ifneq ($(filter arduino stk500v1 stk500v2 wiring,$(PROGRAMMER)),)
    AVRDUDE_FLAGS += -P $(PORT) -b $(BAUD)
endif

# Recommended Target Fuses for ${currentProfile.name}
LFUSE         ?= ${mcuDetails.lfuse}
HFUSE         ?= ${mcuDetails.hfuse}
EFUSE         ?= ${mcuDetails.efuse}

# ------------------------------------------------------------------------------
# 6. Build Targets
# ------------------------------------------------------------------------------
.PHONY: all clean flash size disasm eeprom fuses check-env help

# Default target: compile, link, generate Intel HEX and report footprint
all: check-env $(TARGET_HEX) ${enableEepromHex ? '$(TARGET_EEP) ' : ''}size

# Main Linker Target
$(TARGET_ELF): $(OBJS) | $(BUILD_DIR)
	@echo "  [LD]       $@"
	@$(CC) $(LDFLAGS) -o $@ $^
	@chmod -x $@

# Intel HEX Generation (.text + .data, stripping EEPROM & Fuses)
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

# Assemble Assembly Source Files (.S)
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
# Print AVR Flash ROM and SRAM Memory Consumption
size: $(TARGET_ELF)
	@echo ""
	@echo "================================================================="
	@echo "  AVR Memory Footprint Report [Target: $(MCU)]"
	@echo "================================================================="
	@$(SIZE) -C --mcu=$(MCU) $(TARGET_ELF)
	@echo "================================================================="

${enableDisasm ? `# Disassembly Output for Assembly Review
disasm: $(TARGET_ELF)
	@echo "  [OBJDUMP]  $(TARGET_LST)"
	@$(OBJDUMP) -h -S $< > $(TARGET_LST)
	@echo "  Disassembly listing created: $(TARGET_LST)"
` : ''}
# Flash Application Firmware to Target MCU via avrdude
flash: $(TARGET_HEX)
	@echo "  Flashing $< to $(MCU) via $(PROGRAMMER)..."
	$(AVRDUDE) $(AVRDUDE_FLAGS) -U flash:w:$<:i

${enableEepromHex ? `# Flash EEPROM Image
flash-eeprom: $(TARGET_EEP)
	@echo "  Flashing EEPROM image to $(MCU)..."
	$(AVRDUDE) $(AVRDUDE_FLAGS) -U eeprom:w:$<:i
` : ''}
${enableFusesTarget ? `# Burn Safe Factory/Clock Fuses
fuses:
	@echo "  Writing fuse bits to $(MCU) [LFUSE=$(LFUSE), HFUSE=$(HFUSE), EFUSE=$(EFUSE)]..."
	$(AVRDUDE) $(AVRDUDE_FLAGS) -U lfuse:w:$(LFUSE):m -U hfuse:w:$(HFUSE):m -U efuse:w:$(EFUSE):m
` : ''}
# Clean Build Artifacts
clean:
	@echo "  [CLEAN]    Removing $(BUILD_DIR)..."
	@$(RM) $(BUILD_DIR)

# Verify avr-gcc Toolchain Installation
check-env:
	@which $(CC) > /dev/null 2>&1 || (echo "ERROR: $(CC) not found in PATH! Please install avr-gcc toolchain." && exit 1)

help:
	@echo "Available Targets:"
	@echo "  make              - Compile project and generate $(TARGET_HEX)"
	@echo "  make flash        - Program hex firmware to target MCU using $(PROGRAMMER)"
	@echo "  make size         - Output flash ROM and SRAM usage report"
	@echo "  make disasm       - Generate assembly listing file ($(TARGET_LST))"
	@echo "  make fuses        - Write LFUSE/HFUSE/EFUSE to target MCU"
	@echo "  make clean        - Delete build directory and intermediate files"
`;
  }, [
    currentProfile.name,
    mcuDetails,
    effectiveFCpu,
    optLevel,
    optLevelDetails.title,
    projectName,
    buildDir,
    cStandard,
    cxxStandard,
    activeCompileFlags,
    isGcSectionsEnabled,
    isLtoEnabled,
    programmer,
    port,
    baud,
    enableEepromHex,
    enableDisasm,
    enableFusesTarget
  ]);

  // Generated CMakeLists.txt Content
  const generatedCMakeLists = useMemo(() => {
    const compileOptionsList = [
      '-mmcu=\${MCU}',
      '-DF_CPU=\${F_CPU}',
      `-${optLevel}`,
      ...activeCompileFlags
    ];

    return `# ==============================================================================
# Modern CMakeLists.txt for AVR Embedded Firmware (${currentProfile.name})
# Target MCU   : ${mcuDetails.gccMcu} (${mcuDetails.flashKb} KB Flash, ${mcuDetails.sramBytes} B SRAM)
# F_CPU        : ${effectiveFCpu} Hz (${(effectiveFCpu / 1000000).toFixed(2)} MHz)
# Optimization : -${optLevel} (${optLevelDetails.title})
# Generated by : AVR Embedded Architecture & Build Configuration Tool
# ==============================================================================

cmake_minimum_required(VERSION 3.20)

# ------------------------------------------------------------------------------
# 1. Cross-Compilation AVR Toolchain Specification
# ------------------------------------------------------------------------------
set(CMAKE_SYSTEM_NAME Generic)
set(CMAKE_SYSTEM_PROCESSOR avr)

# If not using an external toolchain file, configure default compilers
if(NOT CMAKE_C_COMPILER)
    set(CMAKE_C_COMPILER avr-gcc)
endif()
if(NOT CMAKE_CXX_COMPILER)
    set(CMAKE_CXX_COMPILER avr-g++)
endif()

# Inhibit standard host compiler testing
set(CMAKE_C_COMPILER_WORKS 1)
set(CMAKE_CXX_COMPILER_WORKS 1)

# ------------------------------------------------------------------------------
# 2. Project Definition & Language Standards
# ------------------------------------------------------------------------------
project(${projectName}
    VERSION 1.0.0
    DESCRIPTION "Bare-metal firmware for ${currentProfile.name}"
    LANGUAGES C${includeCppSupport ? ' CXX' : ''} ASM
)

set(CMAKE_C_STANDARD ${cStandard.replace('gnu', '').replace('c', '')})
set(CMAKE_C_STANDARD_REQUIRED ON)
${includeCppSupport ? `set(CMAKE_CXX_STANDARD ${cxxStandard.replace('c++', '')})\nset(CMAKE_CXX_STANDARD_REQUIRED ON)\n` : ''}
# ------------------------------------------------------------------------------
# 3. Target MCU & Frequency Parameters
# ------------------------------------------------------------------------------
set(MCU "${mcuDetails.gccMcu}" CACHE STRING "Target AVR microcontroller")
set(F_CPU "${effectiveFCpu}UL" CACHE STRING "AVR CPU Clock frequency")
set(AVRDUDE_MCU "${mcuDetails.avrdudePart}" CACHE STRING "avrdude target part ID")
set(PROGRAMMER "${programmer}" CACHE STRING "Hardware programmer type")
set(PORT "${port}" CACHE STRING "Serial COM port or USB port")
set(BAUD "${baud}" CACHE STRING "Bootloader baud rate")

# ------------------------------------------------------------------------------
# 4. Compiler & Linker Options (Optimization Level: -${optLevel})
# ------------------------------------------------------------------------------
add_compile_options(
    ${compileOptionsList.join('\n    ')}
)

${includeCppSupport ? `# C++ specific flags (strip overhead)
add_compile_options(
    $<$<COMPILE_LANGUAGE:CXX>:-fno-exceptions>
    $<$<COMPILE_LANGUAGE:CXX>:-fno-rtti>
)
` : ''}
# Linker options
add_link_options(
    -mmcu=\${MCU}
    ${isGcSectionsEnabled ? '-Wl,--gc-sections\n    ' : ''}${isLtoEnabled ? '-flto\n    ' : ''}-Wl,-Map=\${PROJECT_NAME}.map,--cref
)

# ------------------------------------------------------------------------------
# 5. Executable Target & Source Discovery
# ------------------------------------------------------------------------------
# Discover sources in current directory and src/
file(GLOB_RECURSE SOURCES_C CONFIGURE_DEPENDS "src/*.c" "*.c")
${includeCppSupport ? 'file(GLOB_RECURSE SOURCES_CXX CONFIGURE_DEPENDS "src/*.cpp" "*.cpp")\n' : ''}file(GLOB_RECURSE SOURCES_ASM CONFIGURE_DEPENDS "src/*.S" "*.S")

# Create Main ELF Executable Target
add_executable(\${PROJECT_NAME}.elf
    \${SOURCES_C}
    ${includeCppSupport ? '\${SOURCES_CXX}\n    ' : ''}\${SOURCES_ASM}
)

target_include_directories(\${PROJECT_NAME}.elf PRIVATE
    \${CMAKE_CURRENT_SOURCE_DIR}
    \${CMAKE_CURRENT_SOURCE_DIR}/include
    \${CMAKE_CURRENT_SOURCE_DIR}/src
)

# ------------------------------------------------------------------------------
# 6. Toolchain Utilities Discovery
# ------------------------------------------------------------------------------
find_program(AVR_OBJCOPY avr-objcopy REQUIRED)
find_program(AVR_OBJDUMP avr-objdump REQUIRED)
find_program(AVR_SIZE    avr-size    REQUIRED)
find_program(AVRDUDE     avrdude     REQUIRED)

# ------------------------------------------------------------------------------
# 7. Post-Build Custom Commands (HEX, EEPROM, Footprint Size)
# ------------------------------------------------------------------------------
# Generate Intel HEX (.hex) for Flash programming
add_custom_command(
    TARGET \${PROJECT_NAME}.elf POST_BUILD
    COMMAND \${AVR_OBJCOPY} -O ihex -R .eeprom -R .fuse -R .lock -R .signature
            \${PROJECT_NAME}.elf \${PROJECT_NAME}.hex
    COMMENT "Generating Intel HEX file: \${PROJECT_NAME}.hex"
)

# Generate Raw Binary (.bin)
add_custom_command(
    TARGET \${PROJECT_NAME}.elf POST_BUILD
    COMMAND \${AVR_OBJCOPY} -O binary -R .eeprom -R .fuse -R .lock -R .signature
            \${PROJECT_NAME}.elf \${PROJECT_NAME}.bin
    COMMENT "Generating Raw Binary: \${PROJECT_NAME}.bin"
)

${enableEepromHex ? `# Generate EEPROM Image (.eep)
add_custom_command(
    TARGET \${PROJECT_NAME}.elf POST_BUILD
    COMMAND \${AVR_OBJCOPY} -j .eeprom --set-section-flags=.eeprom="alloc,load"
            --change-section-lma .eeprom=0 -O ihex
            \${PROJECT_NAME}.elf \${PROJECT_NAME}.eep
    COMMENT "Generating EEPROM Image: \${PROJECT_NAME}.eep"
)
` : ''}
# Print Memory Consumption Report after build
add_custom_command(
    TARGET \${PROJECT_NAME}.elf POST_BUILD
    COMMAND \${AVR_SIZE} -C --mcu=\${MCU} \${PROJECT_NAME}.elf
    COMMENT "AVR Memory Consumption Report:"
)

# ------------------------------------------------------------------------------
# 8. Custom Targets: flash, disasm, fuses
# ------------------------------------------------------------------------------
# Flash upload target (cmake --build build --target flash)
add_custom_target(flash
    COMMAND \${AVRDUDE} -p \${AVRDUDE_MCU} -c \${PROGRAMMER}
            $<$<NOT:$<STREQUAL:\${PROGRAMMER},"usbasp">>:-P \${PORT} -b \${BAUD}>
            -U flash:w:\${CMAKE_CURRENT_BINARY_DIR}/\${PROJECT_NAME}.hex:i
    DEPENDS \${PROJECT_NAME}.elf
    COMMENT "Flashing firmware to \${MCU} via \${PROGRAMMER}..."
)

${enableDisasm ? `# Disassembly listing target (cmake --build build --target disasm)
add_custom_target(disasm
    COMMAND \${AVR_OBJDUMP} -h -S \${PROJECT_NAME}.elf > \${CMAKE_CURRENT_BINARY_DIR}/\${PROJECT_NAME}.lst
    DEPENDS \${PROJECT_NAME}.elf
    COMMENT "Generating assembly listing: \${PROJECT_NAME}.lst"
)
` : ''}
${enableFusesTarget ? `# Fuse programming target (cmake --build build --target fuses)
add_custom_target(fuses
    COMMAND \${AVRDUDE} -p \${AVRDUDE_MCU} -c \${PROGRAMMER}
            $<$<NOT:$<STREQUAL:\${PROGRAMMER},"usbasp">>:-P \${PORT} -b \${BAUD}>
            -U lfuse:w:${mcuDetails.lfuse}:m
            -U hfuse:w:${mcuDetails.hfuse}:m
            -U efuse:w:${mcuDetails.efuse}:m
    COMMENT "Writing recommended fuse bits to \${MCU}..."
)
` : ''}
`;
  }, [
    currentProfile.name,
    mcuDetails,
    effectiveFCpu,
    optLevel,
    optLevelDetails.title,
    projectName,
    cStandard,
    cxxStandard,
    includeCppSupport,
    programmer,
    port,
    baud,
    activeCompileFlags,
    isGcSectionsEnabled,
    isLtoEnabled,
    enableEepromHex,
    enableDisasm,
    enableFusesTarget
  ]);

  // Generated avr-toolchain.cmake (Standalone CMake Toolchain File)
  const generatedToolchainFile = useMemo(() => {
    return `# ==============================================================================
# AVR-GCC CMake Toolchain File (avr-toolchain.cmake)
# Usage: cmake -B build -DCMAKE_TOOLCHAIN_FILE=avr-toolchain.cmake
# Target MCU: ${mcuDetails.gccMcu} (${currentProfile.name})
# ==============================================================================

set(CMAKE_SYSTEM_NAME Generic)
set(CMAKE_SYSTEM_PROCESSOR avr)

find_program(AVR_CC  avr-gcc  REQUIRED)
find_program(AVR_CXX avr-g++  REQUIRED)
find_program(AVR_AR  avr-ar   REQUIRED)
find_program(AVR_RANLIB avr-ranlib REQUIRED)

set(CMAKE_C_COMPILER   \${AVR_CC})
set(CMAKE_CXX_COMPILER \${AVR_CXX})
set(CMAKE_AR           \${AVR_AR})
set(CMAKE_RANLIB       \${AVR_RANLIB})

# Skip compiler checks during cross-compilation
set(CMAKE_C_COMPILER_WORKS   1)
set(CMAKE_CXX_COMPILER_WORKS 1)

# Default target parameters
set(MCU "${mcuDetails.gccMcu}" CACHE STRING "Target AVR MCU")
set(F_CPU "${effectiveFCpu}UL" CACHE STRING "CPU frequency in Hz")

message(STATUS "Loaded AVR Toolchain for \${MCU} @ \${F_CPU}")
`;
  }, [mcuDetails.gccMcu, currentProfile.name, effectiveFCpu]);

  // Current code to display
  const currentCode = useMemo(() => {
    if (buildFormat === 'makefile') return generatedMakefile;
    if (buildFormat === 'cmakelists') return generatedCMakeLists;
    return generatedToolchainFile;
  }, [buildFormat, generatedMakefile, generatedCMakeLists, generatedToolchainFile]);

  // Copy code handler
  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    confetti({
      particleCount: 30,
      spread: 60,
      origin: { y: 0.7 }
    });
    setTimeout(() => setCopied(false), 2000);
  };

  // Download handler
  const handleDownload = () => {
    const filename =
      buildFormat === 'makefile'
        ? 'Makefile'
        : buildFormat === 'cmakelists'
        ? 'CMakeLists.txt'
        : 'avr-toolchain.cmake';
    const blob = new Blob([currentCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-6 backdrop-blur shadow-2xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <FileCode2 className="w-3.5 h-3.5" /> 빌드 구성 도구 (Build Configuration Tool)
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
              Makefile & CMakeLists.txt 동시 지원
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-xs font-mono font-bold">
              {currentProfile.name} ({mcuDetails.gccMcu})
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            컴파일러 최적화 & 빌드 템플릿 생성기
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            선택된 MCU({mcuDetails.gccMcu})와 컴파일러 최적화 플래그({optLevelDetails.title}, LTO, 섹션 GC)를 기반으로
            프로덕션 레벨 <span className="text-cyan-300 font-mono font-semibold">Makefile</span> 또는{' '}
            <span className="text-amber-300 font-mono font-semibold">CMakeLists.txt</span>를 실시간 생성하고 바로 복사/다운로드할 수 있습니다.
          </p>
        </div>

        {/* Quick MCU Switcher */}
        {onSelectMCU && (
          <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 shrink-0">
            {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
              <button
                key={mcuId}
                onClick={() => {
                  setTargetMCU(mcuId);
                  onSelectMCU(mcuId);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                  targetMCU === mcuId
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {MCU_PROFILES[mcuId].name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Control Grid: 1. Build Format & Presets, 2. Optimization Level */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols): Presets & Hardware Config */}
        <div className="lg:col-span-7 space-y-5">
          {/* Format Selector Tabs */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" /> 빌드 시스템 형식 (Build System Format)
              </span>
              <span className="text-[11px] text-slate-500 font-normal">GNU Make vs Modern CMake</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setBuildFormat('makefile')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  buildFormat === 'makefile'
                    ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-500/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-cyan-300 font-mono">Makefile</span>
                  {buildFormat === 'makefile' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  avr-gcc 표준 GNU Make. 추가 의존성 없이 빠르고 직접적임.
                </p>
              </button>

              <button
                onClick={() => setBuildFormat('cmakelists')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  buildFormat === 'cmakelists'
                    ? 'bg-amber-950/40 border-amber-500 text-white shadow-lg shadow-amber-950/50 ring-1 ring-amber-500/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-amber-300 font-mono">CMakeLists.txt</span>
                  {buildFormat === 'cmakelists' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  모던 CMake 3.20+. VS Code 및 Clion, CI/CD 파이프라인 연동에 최적.
                </p>
              </button>

              <button
                onClick={() => setBuildFormat('toolchain_cmake')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  buildFormat === 'toolchain_cmake'
                    ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-emerald-300 font-mono">Toolchain File</span>
                  {buildFormat === 'toolchain_cmake' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  avr-toolchain.cmake. CMake 크로스컴파일 전용 독립 툴체인 스크립트.
                </p>
              </button>
            </div>
          </div>

          {/* Quick Optimization Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 추천 최적화 프리셋 (One-Click Optimization Presets)
              </label>
              <span className="text-[11px] text-slate-500">목적에 맞게 즉시 설정</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <button
                onClick={() => applyPreset('minimal-size')}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/60 hover:bg-emerald-950/20 text-left transition group"
              >
                <span className="text-emerald-400 font-bold block text-[11px] group-hover:underline">
                  🚀 극소 용량 (-Os)
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">LTO + Dead Code + Prologues</span>
              </button>

              <button
                onClick={() => applyPreset('production-safe')}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/60 hover:bg-cyan-950/20 text-left transition group"
              >
                <span className="text-cyan-400 font-bold block text-[11px] group-hover:underline">
                  🛡️ 안전 프로덕션
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">-Os + Wall + Wextra + GC</span>
              </button>

              <button
                onClick={() => applyPreset('max-speed')}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/60 hover:bg-purple-950/20 text-left transition group"
              >
                <span className="text-purple-400 font-bold block text-[11px] group-hover:underline">
                  ⚡ 고속 연산 (-O3)
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">루프 언롤링 + LTO</span>
              </button>

              <button
                onClick={() => applyPreset('debug-dev')}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/60 hover:bg-amber-950/20 text-left transition group"
              >
                <span className="text-amber-400 font-bold block text-[11px] group-hover:underline">
                  🐞 GDB 디버깅 (-O0)
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">DWARF-2 심볼 + 최적화 해제</span>
              </button>

              <button
                onClick={() => applyPreset('arduino-compat')}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/60 hover:bg-indigo-950/20 text-left transition group"
              >
                <span className="text-indigo-400 font-bold block text-[11px] group-hover:underline">
                  🤖 아두이노 호환
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">코어 표준 설정과 일치</span>
              </button>
            </div>
          </div>

          {/* Project & Hardware Settings */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3.5">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 border-b border-slate-800/80 pb-2">
              <Settings2 className="w-3.5 h-3.5 text-cyan-400" /> 프로젝트 및 하드웨어 매개변수 설정
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">프로젝트 명칭</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                  placeholder="firmware_app"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">CPU 클록 주파수 (F_CPU)</label>
                <select
                  value={isCustomClock ? 'custom' : fCpu}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setIsCustomClock(true);
                    } else {
                      setIsCustomClock(false);
                      setFCpu(Number(e.target.value));
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value={16000000}>16.000 MHz (외부 크리스털 표준)</option>
                  <option value={8000000}>8.000 MHz (내부 RC / 3.3V 저전력)</option>
                  <option value={20000000}>20.000 MHz (오버클록/고속)</option>
                  <option value={12000000}>12.000 MHz (V-USB 전용 클록)</option>
                  <option value={1000000}>1.000 MHz (팩토리 기본 출하 상태)</option>
                  <option value="custom">사용자 직접 입력 (Hz)...</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">C 언어 표준 (-std)</label>
                <select
                  value={cStandard}
                  onChange={(e) => setCStandard(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value="gnu11">GNU11 (ISO C11 + GNU 확장 - 추천)</option>
                  <option value="c11">C11 (순수 ISO C11 표준)</option>
                  <option value="gnu99">GNU99 (전통적인 C99 + GNU)</option>
                  <option value="c99">C99 (레거시 표준)</option>
                </select>
              </div>
            </div>

            {isCustomClock && (
              <div className="flex items-center gap-2 pt-1 text-xs">
                <span className="text-amber-400 font-mono">커스텀 클록 입력:</span>
                <input
                  type="number"
                  value={customFCpu}
                  onChange={(e) => setCustomFCpu(e.target.value)}
                  className="w-48 bg-slate-900 border border-amber-500/50 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-mono focus:outline-none"
                  placeholder="예: 14745600"
                />
                <span className="text-slate-400">Hz (UL 접미사 자동 부여)</span>
              </div>
            )}

            {/* Programmer & Target Port */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-800/60">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">플래시 프로그래머 (-c)</label>
                <select
                  value={programmer}
                  onChange={(e) => setProgrammer(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value="usbasp">USBasp (ISP 프로그래머)</option>
                  <option value="arduino">Arduino (Optiboot / STK500v1 UART)</option>
                  <option value="stk500v2">STK500v2 (Arduino Mega 2560 UART)</option>
                  <option value="atmelice_isp">Atmel-ICE (Microchip 정품 디버거)</option>
                  <option value="wiring">Wiring (Mega 부트로더)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">통신 포트 (-P)</label>
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                  placeholder="/dev/ttyACM0 또는 COM3"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">통신 속도 (-b, Baud)</label>
                <select
                  value={baud}
                  onChange={(e) => setBaud(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value={115200}>115,200 bps (Optiboot / Uno / Mega)</option>
                  <option value={57600}>57,600 bps (구형 Uno / Nano)</option>
                  <option value={19200}>19,200 bps (Arduino as ISP)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Optimization Level & Impact Visualizer */}
        <div className="lg:col-span-5 space-y-4">
          {/* Base Optimization Level */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> 컴파일러 최적화 레벨 (Optimization Level)
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${optLevelDetails.badgeColor}`}>
                {optLevelDetails.badge}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-xs font-mono font-bold">
              {(['Os', 'O0', 'O1', 'O2', 'O3', 'Ofast'] as OptimizationLevel[]).map((level) => {
                const isSelected = optLevel === level;
                return (
                  <button
                    key={level}
                    onClick={() => setOptLevel(level)}
                    className={`py-2 rounded-xl text-center border transition ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    -{level}
                  </button>
                );
              })}
            </div>

            {/* Explanatory Box */}
            <div className="p-3 bg-slate-900/90 border border-slate-800/80 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">플래시 메모리 절감율:</span>
                <span className="text-emerald-400 font-bold font-mono">{optLevelDetails.flashSavings}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">실행 속도 효율:</span>
                <span className="text-cyan-400 font-bold font-mono">{optLevelDetails.speedRating}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">GDB 디버깅 용이성:</span>
                <span className="text-amber-400 font-bold font-mono">{optLevelDetails.debugRating}</span>
              </div>
              <p className="text-[11px] text-slate-300 pt-1 border-t border-slate-800 leading-relaxed">
                💡 {optLevelDetails.recommendation}
              </p>
            </div>
          </div>

          {/* MCU Resource Specs Badge */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" /> 타깃 MCU 사양
              </span>
              <span className="text-cyan-300 font-bold">{mcuDetails.gccMcu}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-slate-900 p-2 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">Flash ROM</span>
                <span className="text-amber-400 font-bold text-xs">{mcuDetails.flashKb} KB</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">SRAM</span>
                <span className="text-cyan-400 font-bold text-xs">{mcuDetails.sramBytes} B</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">EEPROM</span>
                <span className="text-emerald-400 font-bold text-xs">{mcuDetails.eepromBytes} B</span>
              </div>
            </div>
          </div>

          {/* Additional Features Toggle */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
            <span className="text-xs font-bold text-slate-300 block mb-1">빌드 타깃 포함 여부 설정</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={enableEepromHex}
                  onChange={(e) => setEnableEepromHex(e.target.checked)}
                  className="accent-cyan-500 rounded"
                />
                <span>EEPROM HEX 생성 (.eep)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={enableDisasm}
                  onChange={(e) => setEnableDisasm(e.target.checked)}
                  className="accent-cyan-500 rounded"
                />
                <span>디스어셈블리 타깃 (disasm)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={enableFusesTarget}
                  onChange={(e) => setEnableFusesTarget(e.target.checked)}
                  className="accent-cyan-500 rounded"
                />
                <span>퓨즈비트 타깃 (fuses)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={includeCppSupport}
                  onChange={(e) => setIncludeCppSupport(e.target.checked)}
                  className="accent-cyan-500 rounded"
                />
                <span>C++ 소스 (.cpp) 컴파일 지원</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Compiler Flags Checklist */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" /> 세부 컴파일러 최적화 & 경고 플래그 제어
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            활성화된 플래그: {activeCompileFlags.length + (isGcSectionsEnabled ? 1 : 0)}개
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {COMPILER_FLAGS_REGISTRY.map((flagItem) => {
            const isChecked = !!selectedFlags[flagItem.id];
            return (
              <div
                key={flagItem.id}
                onClick={() => toggleFlag(flagItem.id)}
                className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                  isChecked
                    ? 'bg-slate-900 border-cyan-500/50 text-white shadow-sm'
                    : 'bg-slate-950/80 border-slate-800/80 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold font-mono text-cyan-300">{flagItem.flag}</span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="accent-cyan-500 rounded cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">{flagItem.description}</p>
                </div>
                <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 font-mono">플래시 영향:</span>
                  <span className="text-emerald-400 font-medium">{flagItem.flashImpact}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Code Viewer & Action Bar */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold text-white">
              {buildFormat === 'makefile'
                ? 'Makefile'
                : buildFormat === 'cmakelists'
                ? 'CMakeLists.txt'
                : 'avr-toolchain.cmake'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              {mcuDetails.gccMcu} • -{optLevel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-cyan-600/20"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '복사 완료!' : '코드 복사'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>파일 다운로드</span>
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="p-4 overflow-x-auto max-h-[560px] overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed bg-slate-950">
          <pre className="select-all">
            {currentCode.split('\n').map((line, idx) => {
              const isComment = line.trim().startsWith('#');
              const isTarget = line.includes(':') && !isComment && !line.includes('=') && !line.includes('${') && !line.includes('(');
              const isVar = (line.includes('=') || line.includes('set(')) && !isComment;

              let lineClass = 'text-slate-300';
              if (isComment) lineClass = 'text-slate-500 italic';
              else if (isTarget) lineClass = 'text-amber-300 font-bold';
              else if (isVar) lineClass = 'text-cyan-300';

              return (
                <div key={idx} className="flex">
                  <span className="text-slate-600 select-none w-10 shrink-0 text-right pr-4 text-[11px]">
                    {idx + 1}
                  </span>
                  <span className={lineClass}>{line}</span>
                </div>
              );
            })}
          </pre>
        </div>

        {/* Quick Instructions Footer */}
        <div className="px-4 py-3 bg-slate-900/90 border-t border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-mono text-[11px]">
              {buildFormat === 'makefile' ? (
                <>
                  터미널 실행: <code className="text-emerald-300 font-bold">make</code> (빌드) /{' '}
                  <code className="text-emerald-300 font-bold">make flash</code> (업로드) /{' '}
                  <code className="text-emerald-300 font-bold">make size</code> (메모리 확인)
                </>
              ) : (
                <>
                  터미널 실행: <code className="text-amber-300 font-bold">cmake -B build</code> &&{' '}
                  <code className="text-amber-300 font-bold">cmake --build build</code> (빌드) /{' '}
                  <code className="text-amber-300 font-bold">cmake --build build --target flash</code> (업로드)
                </>
              )}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {currentProfile.name} • avr-gcc toolchain
          </span>
        </div>
      </div>
    </div>
  );
};
