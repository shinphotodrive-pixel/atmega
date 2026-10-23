import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Zap,
  Sliders,
  Copy,
  Check,
  Terminal,
  Cpu,
  Clock,
  HardDrive,
  FileCode,
  ShieldCheck,
  AlertTriangle,
  Info,
  Layers,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  BarChart3,
  Flame,
  Bug,
  Sparkles
} from 'lucide-react';

export interface CompilerOptimizationAnalyzerProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type OptLevel = '-O0' | '-O1' | '-O2' | '-O3' | '-Os' | '-Ofast' | '-Og';

export interface OptProfile {
  level: OptLevel;
  name: string;
  tagline: string;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  sizeMultiplier: number; // relative to -Os (1.00)
  buildTimeMultiplier: number; // relative to -O0 (1.00)
  debugRating: number; // 1 to 5
  executionSpeedRating: number; // 1 to 5
  codeSizeRating: number; // 1 to 5 (5 is smallest)
  recommendedFor: string;
  summary: string;
  gccDescription: string;
  strengths: string[];
  weaknesses: string[];
  sampleAsm: {
    title: string;
    cCode: string;
    asm: string;
    explanation: string;
  };
}

const OPT_PROFILES: Record<OptLevel, OptProfile> = {
  '-O0': {
    level: '-O0',
    name: '최적화 비활성화 (No Optimization)',
    tagline: 'GDB 단일 스텝 디버깅 전용 (코드 팽창 최대)',
    badgeColor: 'text-rose-400',
    badgeBg: 'bg-rose-950/60',
    badgeBorder: 'border-rose-800/50',
    sizeMultiplier: 2.38,
    buildTimeMultiplier: 1.0,
    debugRating: 5,
    executionSpeedRating: 1,
    codeSizeRating: 1,
    recommendedFor: 'AVR Dragon / Atmel-ICE 하드웨어 OCD 디버거를 통한 라인 단위 변수 추적 시에만 일시적 사용',
    summary: '모든 C 변수를 스택 메모리에 쓰고 읽으며, 루프나 데드 코드를 전혀 제거하지 않아 코드가 2.3배 이상 비대해집니다.',
    gccDescription: 'Reduce compilation time and make debugging produce the expected results. Statements are independent.',
    strengths: [
      'GDB / SimAVR에서 C 소스 코드 라인과 어셈블리 1:1 완벽 일치',
      '최적화로 인한 변수 증발(optimized out) 현상 전무',
      '가장 빠른 빌드 컴파일 시간 (0.15초 이내)'
    ],
    weaknesses: [
      '플래시 ROM 점유율이 238%로 폭증하여 소형 MCU(328P) 메모리 초과 유발',
      '인터럽트 진입/탈출 및 함수 호출 오버헤드가 극도로 큼',
      '상수 접기(Constant Folding) 미적용으로 런타임 연산 과다'
    ],
    sampleAsm: {
      title: 'uint8_t count = 0; count++; (로컬 변수 증가 연산)',
      cCode: 'uint8_t count = 0;\ncount++;\nPORTB = count;',
      asm: `; --- avr-gcc -O0 어셈블리 출력 ---
push r28
push r29
in r28, 0x3d        ; 스택 포인터 로컬 프레임 생성
in r29, 0x3e
sbiw r28, 1         ; 로컬 변수 스택 프레임 1바이트 할당
out 0x3e, r29
out 0x3d, r28
std Y+1, __zero_reg__ ; count = 0 (SRAM 스택에 저장)
ldd r24, Y+1        ; SRAM에서 다시 레지스터로 로드
subi r24, 0xFF      ; count++
std Y+1, r24        ; 결과를 다시 SRAM 스택에 저장
ldd r24, Y+1        ; 또다시 SRAM에서 로드
out 0x05, r24       ; PORTB 출력
adiw r28, 1         ; 스택 정리 후 복귀 (총 14개 명령어 소모!)`,
      explanation: '변수 count가 레지스터에 머무르지 못하고 매 연산마다 스택(SRAM)을 왕복(std/ldd)하여 코드와 사이클이 극심하게 낭비됩니다.'
    }
  },
  '-O1': {
    level: '-O1',
    name: '기본 최적화 (Basic Optimization)',
    tagline: '코드 크기와 빌드 시간의 최소 균형',
    badgeColor: 'text-amber-400',
    badgeBg: 'bg-amber-950/60',
    badgeBorder: 'border-amber-800/50',
    sizeMultiplier: 1.35,
    buildTimeMultiplier: 1.35,
    debugRating: 4,
    executionSpeedRating: 3,
    codeSizeRating: 3,
    recommendedFor: '디버그 심볼을 유지하면서도 기초적인 코드 축소가 필요한 개발 중간 단계',
    summary: '기초적인 불필요 코드 제거, 공통 부분식 통합, 레지스터 할당을 수행하며 루프 언롤링은 하지 않습니다.',
    gccDescription: 'Optimizing compilation takes more time and memory for large functions. Disables aggressive transformations.',
    strengths: [
      '스택 낭비를 줄이고 기본 레지스터 할당 활성화',
      '디버깅 시 변수 추적이 비교적 용이',
      '빠른 컴파일 유지'
    ],
    weaknesses: [
      '-Os 대비 여전히 35% 이상 플래시를 더 소모함',
      '인라인 함수 최적화 미흡'
    ],
    sampleAsm: {
      title: 'uint8_t count = 0; count++; (로컬 변수 증가 연산)',
      cCode: 'uint8_t count = 0;\ncount++;\nPORTB = count;',
      asm: `; --- avr-gcc -O1 어셈블리 출력 ---
ldi r24, 0x01       ; 컴파일러가 count = 1 결과를 컴파일 타임에 계산!
out 0x05, r24       ; PORTB에 0x01 즉시 출력
ret                 ; (스택 왕복 없이 단 2개 명령어로 단축)`,
      explanation: '기초적인 상수 접기(Constant Folding)가 작동하여 불필요한 증가 연산이 컴파일 시점에 해결되었습니다.'
    }
  },
  '-O2': {
    level: '-O2',
    name: '표준 고속 최적화 (Standard Speed Optimization)',
    tagline: '성능 극대화 (사이즈 트레이드오프 발생)',
    badgeColor: 'text-sky-400',
    badgeBg: 'bg-sky-950/60',
    badgeBorder: 'border-sky-800/50',
    sizeMultiplier: 1.48,
    buildTimeMultiplier: 2.1,
    debugRating: 2,
    executionSpeedRating: 5,
    codeSizeRating: 2,
    recommendedFor: 'FFT 고속 푸리에 변환, 모터 FOC 알고리즘, 복잡한 통신 CRC 등 실행 속도가 최우선인 연산 집중형 모듈',
    summary: '명령어 스케줄링, 점프 최적화, 부분 루프 인라인 등을 총동원하여 실행 속도를 최대화하지만 바이너리가 팽창합니다.',
    gccDescription: 'Optimize even more. GCC performs nearly all supported optimizations that do not involve a space-speed tradeoff.',
    strengths: [
      'AVR 16MHz 단일 코어의 연산 처리량(Throughput) 극대화',
      '조건 분기 예측 및 파이프라인 정지(Stall) 최소화',
      '대용량 플래시 MCU (ATmega2560 256KB)에서 유리'
    ],
    weaknesses: [
      '-Os 대비 바이너리가 48% 가량 커져 소형 플래시에서 오버플로우 위험',
      '디버깅 시 코드 실행 순서가 뒤바뀌어 breakpoint 추적 불가',
      '컴파일 소요 시간 증가'
    ],
    sampleAsm: {
      title: '배열 4개 요소 합산 연산 (루프 인라이닝)',
      cCode: 'for(int i=0; i<4; i++) sum += arr[i];',
      asm: `; --- avr-gcc -O2 어셈블리 출력 (루프 언롤링 적용) ---
ld r18, Z+          ; 요소 0 로드
add r24, r18
ld r18, Z+          ; 요소 1 로드
add r24, r18
ld r18, Z+          ; 요소 2 로드
add r24, r18
ld r18, Z           ; 요소 3 로드
add r24, r18        ; (루프 비교 및 분기 명령어 brne 오버헤드 0사이클로 제거!)`,
      explanation: '루프 분기(brne) 비용을 아끼기 위해 루프 본문을 4번 복제(Unroll)하여 속도를 극대화한 대신 바이트 수가 늘어났습니다.'
    }
  },
  '-O3': {
    level: '-O3',
    name: '공격적 고속 최적화 (Aggressive Optimization)',
    tagline: '과도한 인라인 확장 및 코드 팽창 주의',
    badgeColor: 'text-purple-400',
    badgeBg: 'bg-purple-950/60',
    badgeBorder: 'border-purple-800/50',
    sizeMultiplier: 1.76,
    buildTimeMultiplier: 2.8,
    debugRating: 1,
    executionSpeedRating: 5,
    codeSizeRating: 1,
    recommendedFor: '특정 서브루틴의 절대적 지연시간 최소화가 필요할 때 (함수 단위 `__attribute__((optimize("O3")))` 권장)',
    summary: '거의 모든 함수를 강제 인라인화하고 루프를 복제합니다. 8비트 AVR에서는 코드 캐시가 없어 오히려 역효과를 낼 수도 있습니다.',
    gccDescription: 'Optimize yet more. Turns on -finline-functions, -funswitch-loops, and vectorization attempts.',
    strengths: [
      '함수 호출 CALL / RET 오버헤드(각 3~4사이클) 완전 제거',
      '수치 계산 라이브러리 최대 처리 속도'
    ],
    weaknesses: [
      '플래시 메모리 점유율이 70% 이상 비대해져 메모리 낭비 심각',
      'AVR에는 하드웨어 L1 캐시가 없으므로 인라이닝으로 인한 캐시 이점이 없음',
      '긴 빌드 시간 소요'
    ],
    sampleAsm: {
      title: '서브루틴 호출 인라인화',
      cCode: 'inline void setPin() { PORTB |= (1<<5); }',
      asm: `; --- avr-gcc -O3 어셈블리 출력 ---
; rcall setPin 호출 대신 본문을 직접 복사
sbi 0x05, 5         ; 호출할 때마다 매번 sbi 코드가 복제 배치됨`,
      explanation: '함수 호출 스택 프레임 생성을 배제하기 위해 함수 본문을 매번 복제하여 전체 플래시 크기가 급증합니다.'
    }
  },
  '-Os': {
    level: '-Os',
    name: '크기 최소화 최적화 (Optimize for Size) [★ AVR 표준 권장]',
    tagline: '8비트 AVR 하버드 아키텍처 공식 표준 플래그',
    badgeColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-950/60',
    badgeBorder: 'border-emerald-800/50',
    sizeMultiplier: 1.0,
    buildTimeMultiplier: 1.5,
    debugRating: 3,
    executionSpeedRating: 4,
    codeSizeRating: 5,
    recommendedFor: '모든 AVR 펌웨어 프로덕션 빌드, 아두이노(Arduino) 코어 기본값, 플래시 절약 최우선 프로젝트',
    summary: '코드 크기를 늘리지 않는 -O2의 모든 최적화를 적용하고, 인라이닝을 억제하여 8비트 AVR 플래시를 극대화 보존합니다.',
    gccDescription: 'Optimize for size. Enables all -O2 optimizations except those that often increase code size.',
    strengths: [
      '가장 작은 플래시 ROM 바이너리 크기 산출 (최대 60% 절감)',
      '단일 사이클 비트 명령어(sbi, cbi, sbrc, sbrs)의 최적 활용',
      'Arduino IDE 코어 및 Microchip Studio 공식 디폴트 플래그',
      '충분히 우수한 실행 속도와 작은 풋프린트의 황금 밸런스'
    ],
    weaknesses: [
      '극단적인 루프 언롤링을 하지 않으므로 초대형 FFT 등에서 -O2보다 미세하게 느릴 수 있음'
    ],
    sampleAsm: {
      title: 'uint8_t count = 0; count++; (최적화 결합)',
      cCode: 'uint8_t count = 0;\ncount++;\nPORTB = count;',
      asm: `; --- avr-gcc -Os 어셈블리 출력 ---
ldi r24, 0x01       ; 즉시값 1 로드
out 0x05, r24       ; PORTB에 직접 출력 (단 2바이트 / 2사이클!)`,
      explanation: '플래시 크기 최우선 규칙에 따라 최소 바이트의 고속 어셈블리 코드로 컴팩트하게 압축 생성됩니다.'
    }
  },
  '-Ofast': {
    level: '-Ofast',
    name: '초고속 완화 최적화 (Disregard Strict Standards)',
    tagline: '-O3 + 비표준 부동소수점 가속 (-ffast-math)',
    badgeColor: 'text-violet-400',
    badgeBg: 'bg-violet-950/60',
    badgeBorder: 'border-violet-800/50',
    sizeMultiplier: 1.62,
    buildTimeMultiplier: 2.6,
    debugRating: 1,
    executionSpeedRating: 5,
    codeSizeRating: 2,
    recommendedFor: 'IEEE 754 표준 정밀도가 중요하지 않은 센서 그래픽/오디오 DSP 연산',
    summary: '-O3에 더해 수학 공식의 결합법칙을 허용하고 NaN/무한대 검사를 생략하여 부동소수점 소프트웨어 루틴을 가속합니다.',
    gccDescription: 'Enables all -O3 optimizations. Also turns on options that are not valid for all standard-compliant programs (-ffast-math).',
    strengths: [
      'AVR 소프트웨어 float 에뮬레이션 연산 속도 대폭 개선',
      '수학 라이브러리(sqrt, sin, cos) 호출 단축'
    ],
    weaknesses: [
      'IEEE 754 부동소수점 오차 발생 가능 (NaN/Inf 미지원)',
      '코드 크기가 크고 디버깅이 불가능에 가까움'
    ],
    sampleAsm: {
      title: '부동소수점 곱셈 x * 2.0f',
      cCode: 'float y = x * 2.0f;',
      asm: `; --- avr-gcc -Ofast 어셈블리 출력 ---
; __mulsf3 부동소수점 소프트웨어 호출 대신
; 지수부(Exponent) 비트필드에 +1 가산하여 고속 계산`,
      explanation: 'IEEE 표준의 오버플로우/언더플로우 예외 처리를 건너뛰고 빠른 비트 조작으로 계산하여 속도를 챙깁니다.'
    }
  },
  '-Og': {
    level: '-Og',
    name: '디버그 지향 최적화 (Optimize for Debugging)',
    tagline: '디버그 환경에서 합리적인 코드 크기 제공',
    badgeColor: 'text-cyan-400',
    badgeBg: 'bg-cyan-950/60',
    badgeBorder: 'border-cyan-800/50',
    sizeMultiplier: 1.25,
    buildTimeMultiplier: 1.2,
    debugRating: 5,
    executionSpeedRating: 3,
    codeSizeRating: 4,
    recommendedFor: '개발 중 GDB 실시간 브레이크포인트 디버깅을 하면서도 -O0의 과도한 메모리 부족을 피하고 싶을 때',
    summary: '디버깅 경험(콜 스택, 변수 심볼)을 훼손하지 않는 최적화만 엄선 적용합니다.',
    gccDescription: 'Optimize debugging experience. -Og enables optimizations that do not interfere with debugging.',
    strengths: [
      '-O0보다 40% 이상 작으면서도 변수 심볼(DWARF)이 소실되지 않음',
      '신속한 편집-컴파일-디버그 주기'
    ],
    weaknesses: [
      '프로덕션 릴리스 기준으로는 -Os보다 약 25% 큼'
    ],
    sampleAsm: {
      title: '변수 관찰 가능 최적화',
      cCode: 'int a = readSensor(); process(a);',
      asm: `; --- avr-gcc -Og 어셈블리 출력 ---
call readSensor
movw r24, r22       ; 변수 a가 레지스터에 보존되어 디버거가 검사 가능
call process`,
      explanation: '디버거가 변수 `a`의 값을 실시간으로 읽을 수 있도록 레지스터 수명을 보장하면서도 불필요한 스택 오버헤드는 줄입니다.'
    }
  }
};

export const CompilerOptimizationAnalyzer: React.FC<CompilerOptimizationAnalyzerProps> = ({
  selectedMCU,
  onSelectMCU
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Active Selected Flag
  const [selectedOpt, setSelectedOpt] = useState<OptLevel>('-Os');

  // Auxiliary GCC optimization flags
  const [enableLto, setEnableLto] = useState<boolean>(true);
  const [enableGcSections, setEnableGcSections] = useState<boolean>(true);
  const [enableCallPrologues, setEnableCallPrologues] = useState<boolean>(false);
  const [enableDebugSymbols, setEnableDebugSymbols] = useState<boolean>(false);
  const [projectPreset, setProjectPreset] = useState<'small' | 'medium' | 'large'>('medium');

  // UI state
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // Baseline firmware code size based on project preset
  const baselineCodeBytes = useMemo(() => {
    switch (projectPreset) {
      case 'small':
        return 3840; // ~3.8 KB (Blink, simple UART sensor)
      case 'medium':
        return 14500; // ~14.5 KB (Motor PID, LCD, I2C, State Machine)
      case 'large':
        return 48000; // ~48 KB (RTOS / Marlin 3D / Modbus / Multi-peripheral)
    }
  }, [projectPreset]);

  const baselineDataBytes = useMemo(() => {
    switch (projectPreset) {
      case 'small':
        return 180;
      case 'medium':
        return 650;
      case 'large':
        return 1850;
    }
  }, [projectPreset]);

  // Calculate dynamic metrics based on flags
  const metrics = useMemo(() => {
    const profile = OPT_PROFILES[selectedOpt];

    // LTO saves ~12% flash, but adds ~85% build time
    const ltoSizeFactor = enableLto ? 0.88 : 1.0;
    const ltoBuildFactor = enableLto ? 1.85 : 1.0;

    // Garbage collection of dead sections saves ~7%
    const gcSizeFactor = enableGcSections ? 0.93 : 1.0;

    // mcall-prologues saves ~3% flash on functions with > 4 saved regs
    const prologueSizeFactor = enableCallPrologues ? 0.97 : 1.0;

    // Debug symbols (-g) add ~20% build time, 0% flash in .hex
    const debugBuildFactor = enableDebugSymbols ? 1.25 : 1.0;

    // Estimated Final Code Size (Flash Bytes)
    const estimatedCodeBytes = Math.round(
      baselineCodeBytes * profile.sizeMultiplier * ltoSizeFactor * gcSizeFactor * prologueSizeFactor
    );

    // Baseline build time in seconds (e.g. 0.28s)
    const baselineBuildSeconds = projectPreset === 'small' ? 0.18 : projectPreset === 'medium' ? 0.42 : 1.25;
    const estimatedBuildSeconds = +(
      baselineBuildSeconds * profile.buildTimeMultiplier * ltoBuildFactor * debugBuildFactor
    ).toFixed(2);

    const flashCapacityBytes = currentProfile.flash * 1024;
    const flashUsagePct = Math.min(100, +((estimatedCodeBytes / flashCapacityBytes) * 100).toFixed(1));
    const isFlashOverflow = estimatedCodeBytes > flashCapacityBytes;

    // Compile command generated
    let cmd = `avr-gcc -mmcu=${selectedMCU === 'atmega2560' ? 'atmega2560' : selectedMCU === 'atmega640' ? 'atmega640' : selectedMCU === 'atmega128' ? 'atmega128' : 'atmega328p'} ${selectedOpt}`;
    if (enableLto) cmd += ' -flto';
    if (enableGcSections) cmd += ' -ffunction-sections -fdata-sections -Wl,--gc-sections';
    if (enableCallPrologues) cmd += ' -mcall-prologues';
    if (enableDebugSymbols) cmd += ' -g3 -gdwarf-2';
    cmd += ' -Wall -Wextra main.c -o build/firmware.elf';

    // Intel HEX extraction command
    const hexCmd = `avr-objcopy -O ihex -R .eeprom build/firmware.elf build/firmware.hex\navr-size --format=avr --mcu=${selectedMCU === 'atmega2560' ? 'atmega2560' : selectedMCU === 'atmega640' ? 'atmega640' : selectedMCU === 'atmega128' ? 'atmega128' : 'atmega328p'} build/firmware.elf`;

    // Mock terminal avr-size report
    const sramCapacityBytes = currentProfile.sram * 1024;
    const sramUsagePct = Math.min(100, +((baselineDataBytes / sramCapacityBytes) * 100).toFixed(1));

    const avrSizeReport = `AVR Memory Usage
----------------
Device: ${selectedMCU}

Program:   ${estimatedCodeBytes.toLocaleString().padStart(6, ' ')} bytes (${flashUsagePct}% Full)
(.text + .data + .bootloader)

Data:      ${baselineDataBytes.toLocaleString().padStart(6, ' ')} bytes (${sramUsagePct}% Full)
(.data + .bss + .noinit)

EEPROM:         0 bytes (0.0% Full)

Build Execution Time: ${estimatedBuildSeconds}s
Status: ${isFlashOverflow ? 'FAILED (Section .text will not fit in region text)' : 'SUCCESS'}`;

    return {
      estimatedCodeBytes,
      estimatedBuildSeconds,
      flashUsagePct,
      isFlashOverflow,
      flashCapacityBytes,
      cmd,
      hexCmd,
      avrSizeReport
    };
  }, [
    selectedOpt,
    selectedMCU,
    currentProfile,
    enableLto,
    enableGcSections,
    enableCallPrologues,
    enableDebugSymbols,
    baselineCodeBytes,
    baselineDataBytes,
    projectPreset
  ]);

  const activeProfile = OPT_PROFILES[selectedOpt];

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(`${metrics.cmd}\n${metrics.hexCmd}`);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(metrics.avrSizeReport);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  return (
    <div id="compiler-optimization-analyzer-card" className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur-xl shadow-2xl space-y-7">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                컴파일러 최적화 플래그 분석기
              </h3>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                Compiler Optimization Analyzer
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                {currentProfile.name}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              GCC 컴파일러 플래그(<strong>-O0, -O1, -O2, -O3, -Os, -Ofast, -Og</strong>)를 실시간 토글하여 예상되는 플래시 코드 크기(Code Size), 빌드 소요 시간, 어셈블리 생성 차이 및 디버깅 용이성을 텍스트 터미널 뷰로 정밀 계측합니다.
            </p>
          </div>
        </div>

        {/* Project Size Preset Selector */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-400 font-mono">프로젝트 규모:</span>
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setProjectPreset('small')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                projectPreset === 'small'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              소형 (~4KB)
            </button>
            <button
              onClick={() => setProjectPreset('medium')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                projectPreset === 'medium'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              중형 (~15KB)
            </button>
            <button
              onClick={() => setProjectPreset('large')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                projectPreset === 'large'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              대형 (~48KB)
            </button>
          </div>
        </div>
      </div>

      {/* Main Optimization Level Selector Buttons */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-amber-400" />
            1. GCC 최적화 플래그 선택 (Optimization Level)
          </span>
          <span className="text-[11px] text-emerald-400 font-mono bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
            ★ AVR 기본 표준: -Os (Size Optimization)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {(Object.keys(OPT_PROFILES) as OptLevel[]).map((level) => {
            const prof = OPT_PROFILES[level];
            const isSelected = selectedOpt === level;
            const isOs = level === '-Os';

            return (
              <button
                key={level}
                onClick={() => setSelectedOpt(level)}
                className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/40 shadow-xl shadow-amber-500/10'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                {isOs && (
                  <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950">
                    권장
                  </span>
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-base font-black font-mono ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                      {level}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-semibold mt-1 truncate">
                    {level === '-Os' ? '크기 최적화' : level === '-O0' ? '디버그 전용' : level === '-O2' ? '속도 최적화' : level === '-O3' ? '공격적 속도' : level === '-Ofast' ? '고속 수학' : level === '-Og' ? '디버그 친화' : '기본 최적화'}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-400">크기:</span>
                  <span className={`font-bold ${prof.sizeMultiplier > 1.4 ? 'text-rose-400' : prof.sizeMultiplier === 1.0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {prof.sizeMultiplier === 1.0 ? '100% (기준)' : `${Math.round(prof.sizeMultiplier * 100)}%`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Auxiliary Linker & Compiler Flags Toggle */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-cyan-400" />
            2. 보조 최적화 및 링커 플래그 토글 (Auxiliary Optimization Flags)
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            코드 크기 및 빌드 속도에 복합적 영향
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Flag 1: -flto */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
            <input
              type="checkbox"
              checked={enableLto}
              onChange={(e) => setEnableLto(e.target.checked)}
              className="mt-0.5 accent-amber-500 rounded"
            />
            <div>
              <span className="font-mono font-bold text-white block">-flto (Link-Time Optimization)</span>
              <span className="text-[11px] text-slate-400 leading-relaxed block mt-0.5">
                모듈 간 통합 최적화. 플래시 <strong>10~15% 절감</strong>, 단 링크 시간 85% 증가.
              </span>
            </div>
          </label>

          {/* Flag 2: --gc-sections */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
            <input
              type="checkbox"
              checked={enableGcSections}
              onChange={(e) => setEnableGcSections(e.target.checked)}
              className="mt-0.5 accent-amber-500 rounded"
            />
            <div>
              <span className="font-mono font-bold text-white block">-Wl,--gc-sections</span>
              <span className="text-[11px] text-slate-400 leading-relaxed block mt-0.5">
                미사용 C 함수 및 전역 변수를 링커 단계에서 <strong>자동 삭제(가비지 컬렉션)</strong>.
              </span>
            </div>
          </label>

          {/* Flag 3: -mcall-prologues */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
            <input
              type="checkbox"
              checked={enableCallPrologues}
              onChange={(e) => setEnableCallPrologues(e.target.checked)}
              className="mt-0.5 accent-amber-500 rounded"
            />
            <div>
              <span className="font-mono font-bold text-white block">-mcall-prologues</span>
              <span className="text-[11px] text-slate-400 leading-relaxed block mt-0.5">
                함수 진입/복귀 코드를 서브루틴으로 공유하여 <strong>대형 프로젝트 2~4% 절감</strong>.
              </span>
            </div>
          </label>

          {/* Flag 4: -g3 */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
            <input
              type="checkbox"
              checked={enableDebugSymbols}
              onChange={(e) => setEnableDebugSymbols(e.target.checked)}
              className="mt-0.5 accent-amber-500 rounded"
            />
            <div>
              <span className="font-mono font-bold text-white block">-g3 (Debug Symbols)</span>
              <span className="text-[11px] text-slate-400 leading-relaxed block mt-0.5">
                ELF에 DWARF 디버그 심볼 포함. <strong>HEX 용량 0B 증가</strong> (빌드 시간만 +25%).
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Real-time Code Size & Build Time Impact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Estimated Flash ROM Size */}
        <div className={`p-4.5 rounded-2xl border transition-all ${
          metrics.isFlashOverflow
            ? 'bg-rose-950/60 border-rose-500 shadow-lg shadow-rose-950/20'
            : 'bg-slate-950/80 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <HardDrive className="w-4 h-4 text-sky-400" />
              예상 플래시 코드 크기
            </span>
            <span className={`font-mono font-bold text-xs ${
              metrics.isFlashOverflow ? 'text-rose-400' : 'text-sky-400'
            }`}>
              {metrics.flashUsagePct}% 점유
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white tracking-tight">
              {metrics.estimatedCodeBytes.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-slate-400">/ {metrics.flashCapacityBytes.toLocaleString()} Bytes</span>
          </div>

          {/* Mini progress bar */}
          <div className="mt-2.5 w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                metrics.isFlashOverflow
                  ? 'bg-rose-500'
                  : metrics.flashUsagePct > 80
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-sky-500 to-emerald-400'
              }`}
              style={{ width: `${Math.min(100, metrics.flashUsagePct)}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            {metrics.isFlashOverflow ? (
              <strong className="text-rose-400">⚠️ 플래시 용량 초과! 링커 에러가 발생합니다. -Os 및 -flto를 적용하세요.</strong>
            ) : (
              <span>잔여 공간: <strong>{((metrics.flashCapacityBytes - metrics.estimatedCodeBytes) / 1024).toFixed(1)} KB</strong></span>
            )}
          </p>
        </div>

        {/* Metric 2: Estimated Build Time */}
        <div className="bg-slate-950/80 border border-slate-800 p-4.5 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-amber-400" />
              예상 클린 빌드 시간
            </span>
            <span className="font-mono text-amber-400 font-bold">
              {activeProfile.buildTimeMultiplier}x 배속
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white tracking-tight">
              {metrics.estimatedBuildSeconds}
            </span>
            <span className="text-xs font-mono text-slate-400">초 (Seconds)</span>
          </div>

          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
            <span>컴파일 단계: <strong>{+(metrics.estimatedBuildSeconds * 0.45).toFixed(2)}s</strong></span>
            <span>•</span>
            <span>링킹(LTO): <strong>{+(metrics.estimatedBuildSeconds * 0.55).toFixed(2)}s</strong></span>
          </div>

          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            {enableLto ? 'LTO 모듈 간 분석으로 링킹 단계에서 시간이 소요됩니다.' : '개별 오브젝트 고속 링킹 완료.'}
          </p>
        </div>

        {/* Metric 3: Debuggability Rating */}
        <div className="bg-slate-950/80 border border-slate-800 p-4.5 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Bug className="w-4 h-4 text-rose-400" />
              디버깅 용이성 (GDB / OCD)
            </span>
            <span className="font-mono text-xs font-bold text-slate-300">
              {activeProfile.debugRating}/5 점
            </span>
          </div>

          <div className="mt-2 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <div
                key={star}
                className={`h-2 flex-1 rounded-full ${
                  star <= activeProfile.debugRating
                    ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                    : 'bg-slate-800'
                }`}
              />
            ))}
          </div>

          <div className="mt-3 text-[11px] font-mono text-slate-300">
            {activeProfile.debugRating >= 4 ? (
              <span className="text-emerald-400 font-bold">라인 일치 우수 (변수 추적 원활)</span>
            ) : activeProfile.debugRating === 3 ? (
              <span className="text-amber-400 font-bold">보통 (일부 변수 최적화 소실)</span>
            ) : (
              <span className="text-rose-400 font-bold">난해 (인라인 및 순서 변경 심함)</span>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            {selectedOpt === '-O0' ? '단일 스텝 디버깅에 가장 최적화되어 있습니다.' : selectedOpt === '-Os' ? '일반 디버깅에 적합하며 콜스택이 유지됩니다.' : '코드 재배치로 인해 브레이크포인트가 빗나갈 수 있습니다.'}
          </p>
        </div>

        {/* Metric 4: Execution Speed Profile */}
        <div className="bg-slate-950/80 border border-slate-800 p-4.5 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Flame className="w-4 h-4 text-purple-400" />
              실행 속도 처리량 (Throughput)
            </span>
            <span className="font-mono text-xs font-bold text-slate-300">
              {activeProfile.executionSpeedRating}/5 점
            </span>
          </div>

          <div className="mt-2 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <div
                key={star}
                className={`h-2 flex-1 rounded-full ${
                  star <= activeProfile.executionSpeedRating
                    ? 'bg-purple-400 shadow-sm shadow-purple-400/50'
                    : 'bg-slate-800'
                }`}
              />
            ))}
          </div>

          <div className="mt-3 text-[11px] font-mono text-slate-300">
            {activeProfile.executionSpeedRating === 5 ? (
              <span className="text-purple-400 font-bold">최대 성능 (루프 언롤링 & 파이프라인)</span>
            ) : activeProfile.executionSpeedRating >= 3 ? (
              <span className="text-cyan-400 font-bold">우수한 성능 (레지스터 기반 연산)</span>
            ) : (
              <span className="text-rose-400 font-bold">저하 (모든 변수 스택 경유)</span>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            16MHz 기준 루프 지연시간 및 산술 연산 효율을 나타냅니다.
          </p>
        </div>
      </div>

      {/* Text-Based Live Terminal Output Preview */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              3. 실시간 텍스트 터미널 출력 프리뷰 (Text-based Compilation & Size Report Preview)
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCmd}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono transition flex items-center gap-1.5"
            >
              {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCmd ? '명령어 복사됨' : 'GCC 명령어 복사'}</span>
            </button>
            <button
              onClick={handleCopyReport}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              {copiedReport ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedReport ? '리포트 복사됨' : 'avr-size 리포트 복사'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Box 1: CLI Invocation Command & avr-size Report */}
          <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col justify-between">
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                avr-gcc 빌드 호출 & 메모리 풋프린트 리포트
              </span>
              <span className="text-emerald-400 font-bold">{selectedOpt} Active</span>
            </div>

            <div className="p-4 font-mono text-xs text-slate-300 space-y-3 overflow-x-auto leading-relaxed">
              <div className="text-slate-500">
                # 1. 컴파일 & 링킹 명령어
              </div>
              <div className="text-amber-300 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80 select-all">
                {metrics.cmd}
              </div>

              <div className="text-slate-500 pt-1">
                # 2. avr-size 메모리 사용량 계측 텍스트 출력
              </div>
              <pre className="text-emerald-300 bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 whitespace-pre font-mono text-[11px] leading-relaxed select-all">
                {metrics.avrSizeReport}
              </pre>
            </div>
          </div>

          {/* Box 2: Disassembly Assembly Output Preview */}
          <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col justify-between">
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="flex items-center gap-2">
                <FileCode className="w-3.5 h-3.5 text-sky-400" />
                생성 어셈블리(Disassembly) 텍스트 프리뷰
              </span>
              <span className="text-sky-400 font-mono text-[10px]">C ➔ AVR ASM</span>
            </div>

            <div className="p-4 font-mono text-xs text-slate-300 space-y-3 overflow-x-auto leading-relaxed">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>테스트 코드 예제: <strong className="text-white">{activeProfile.sampleAsm.title}</strong></span>
              </div>

              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 text-slate-300 text-[11px]">
                <span className="text-slate-500 block text-[10px] mb-1">// 원본 C 코드:</span>
                <pre className="text-sky-300">{activeProfile.sampleAsm.cCode}</pre>
              </div>

              <pre className="text-amber-200 bg-slate-900/90 p-3 rounded-xl border border-slate-800 whitespace-pre font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto">
                {activeProfile.sampleAsm.asm}
              </pre>

              <p className="text-[11px] text-slate-400 leading-relaxed italic border-t border-slate-800/80 pt-2">
                💡 <strong>해설:</strong> {activeProfile.sampleAsm.explanation}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Flag Comparison Reference Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            4. GCC 최적화 플래그 종합 비교 가이드 (Quick Matrix)
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            클릭하여 해당 플래그 즉시 적용
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3 font-semibold">플래그</th>
                <th className="p-3 font-semibold">이름 & 특성</th>
                <th className="p-3 font-semibold text-center">예상 코드 크기</th>
                <th className="p-3 font-semibold text-center">빌드 시간</th>
                <th className="p-3 font-semibold text-center">GDB 디버깅</th>
                <th className="p-3 font-semibold text-center">실행 속도</th>
                <th className="p-3 font-semibold">주요 추천 대상</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {(Object.keys(OPT_PROFILES) as OptLevel[]).map((level) => {
                const p = OPT_PROFILES[level];
                const isSelected = selectedOpt === level;

                return (
                  <tr
                    key={level}
                    onClick={() => setSelectedOpt(level)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-amber-500/10' : 'hover:bg-slate-900/50'
                    }`}
                  >
                    <td className="p-3 font-bold">
                      <span className={`px-2 py-0.5 rounded font-mono ${
                        isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-white'
                      }`}>
                        {level}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-sans font-semibold text-white">{p.name.split(' (')[0]}</div>
                      <div className="text-[10px] text-slate-400 font-sans truncate max-w-xs">{p.tagline}</div>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`font-bold ${
                        p.sizeMultiplier === 1.0 ? 'text-emerald-400' : p.sizeMultiplier > 1.4 ? 'text-rose-400' : 'text-slate-300'
                      }`}>
                        {Math.round(p.sizeMultiplier * 100)}%
                      </span>
                    </td>
                    <td className="p-3 text-center text-slate-300">
                      {p.buildTimeMultiplier}x
                    </td>
                    <td className="p-3 text-center">
                      <span className={p.debugRating >= 4 ? 'text-emerald-400 font-bold' : p.debugRating >= 3 ? 'text-amber-400' : 'text-slate-500'}>
                        {'★'.repeat(p.debugRating)}{'☆'.repeat(5 - p.debugRating)}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={p.executionSpeedRating >= 4 ? 'text-purple-400 font-bold' : 'text-slate-300'}>
                        {'★'.repeat(p.executionSpeedRating)}{'☆'.repeat(5 - p.executionSpeedRating)}
                      </span>
                    </td>
                    <td className="p-3 text-[11px] font-sans text-slate-400 max-w-xs">
                      {p.recommendedFor}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
