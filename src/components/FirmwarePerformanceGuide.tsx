import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Zap,
  TrendingUp,
  Cpu,
  Layers,
  Code2,
  Check,
  Copy,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Info,
  Clock,
  ArrowRight,
  ShieldCheck,
  Terminal,
  Activity,
  Maximize2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
}

export type OptimizationTopic = 'volatile' | 'bit_ops' | 'memory_align';

interface OptimizationCase {
  id: string;
  topic: OptimizationTopic;
  title: string;
  shortTag: string;
  categoryLabel: string;
  problemSummary: string;
  antipatternCode: string;
  antipatternCycles: string;
  antipatternAssembly: string;
  optimizedCode: string;
  optimizedCycles: string;
  optimizedAssembly: string;
  speedupPercentage: string;
  explanation: string;
  bestPracticeTip: string;
}

const OPTIMIZATION_CASES: OptimizationCase[] = [
  // 1. Volatile Local Caching
  {
    id: 'volatile-local-caching',
    topic: 'volatile',
    title: '루프 내 Volatile 전역 변수의 로컬 레지스터 캐싱',
    shortTag: 'SRAM I/O 단축',
    categoryLabel: 'volatile 최적화',
    problemSummary: '루프 또는 조건문에서 volatile 변수를 매번 직접 읽으면 컴파일러가 R16~R31 레지스터 캐싱을 포기하고 매번 2사이클 LDS(SRAM 읽기) 명령어를 강제 발행합니다.',
    antipatternCode: `// ❌ 비효율: 매 반복마다 SRAM에서 2사이클 LDS 강제 실행
extern volatile uint8_t g_sensor_status;

void process_sensor_stream(void) {
    for (uint8_t i = 0; i < 64; i++) {
        // g_sensor_status를 읽을 때마다 SRAM 접근 (2 사이클 x 2회)
        if ((g_sensor_status & 0x01) && !(g_sensor_status & 0x80)) {
            do_work(i);
        }
    }
}`,
    antipatternCycles: '~8 사이클 / 루프',
    antipatternAssembly: `lds r24, g_sensor_status ; 2 cycles
sbrs r24, 0              ; 1 cycle
rjmp .L2
lds r24, g_sensor_status ; 2 cycles (중복 SRAM 읽기!)
sbrc r24, 7              ; 1 cycle`,
    optimizedCode: `// ✅ 최적화: 로컬 변수(CPU 레지스터)에 1회 복사하여 사용
extern volatile uint8_t g_sensor_status;

void process_sensor_stream(void) {
    // 1회만 SRAM에서 읽어 범용 레지스터(GPR)에 보관
    uint8_t status_snapshot = g_sensor_status; // 2 사이클 LDS 단 1회!

    for (uint8_t i = 0; i < 64; i++) {
        // CPU 레지스터(R24)에서 1사이클로 즉각 비교
        if ((status_snapshot & 0x01) && !(status_snapshot & 0x80)) {
            do_work(i);
        }
    }
}`,
    optimizedCycles: '~2 사이클 / 루프',
    optimizedAssembly: `lds r24, g_sensor_status ; 2 cycles (루프 전 1회만 실행)
; 루프 내부에서는 R24 레지스터 직접 검사 (0 SRAM 접근)
sbrs r24, 0              ; 1 cycle
sbrc r24, 7              ; 1 cycle`,
    speedupPercentage: '75% 사이클 단축',
    explanation: 'volatile은 하드웨어 레지스터나 ISR 공유 변수의 최적화 방지용이므로, 루프 실행 도중 외부에서 변경될 필요가 없는 단일 작업 단위에서는 로컬 비휘발성 변수에 스냅샷을 떠서 CPU 레지스터 연산 속도를 살려야 합니다.',
    bestPracticeTip: 'SRAM 접근(LDS/STS)은 2클럭이지만, 레지스터 연산은 1클럭입니다. 루프 내 다중 참조 시 로컬 캐싱을 적용하세요.'
  },

  // 2. Volatile Pointer Placement
  {
    id: 'volatile-pointer-syntax',
    topic: 'volatile',
    title: '포인터 위치에 따른 volatile 의미 차이와 하드웨어 드라이버',
    shortTag: '문법 및 메모리 안전',
    categoryLabel: 'volatile 최적화',
    problemSummary: 'volatile 위치에 따라 "가리키는 데이터가 하드웨어 레지스터인지", "포인터 주소 자체가 인터럽트에서 바뀌는지" 완전히 달라지며 오용 시 버그나 과도한 코드가 발생합니다.',
    antipatternCode: `// ❌ 오해하기 쉬운 선언
// 1. 포인터 변수 자체만 volatile (주소값은 자주 바뀌지만 데이터는 캐시됨 -> HW SFR 제어 실패!)
uint8_t * volatile bad_ptr = (uint8_t *)0x25;

// 2. 과도한 이중 volatile (레지스터 주소와 데이터 모두 SRAM 강제)
volatile uint8_t * volatile overly_volatile_ptr = (uint8_t *)0x25;`,
    antipatternCycles: '메모리 읽기 지연 & 최적화 완전 소실',
    antipatternAssembly: `lds r30, bad_ptr   ; 포인터 주소 읽기 (2c)
lds r31, bad_ptr+1 ; (2c)
ld  r24, Z         ; 데이터 읽기 (2c)`,
    optimizedCode: `// ✅ 임베디드 하드웨어 레지스터 표준 선언
// "가리키는 대상(SFR 메모리)이 volatile이고, 포인터 주소는 컴파일타임 상수"
#define PORTB_REG  (*(volatile uint8_t *)(0x25))

// 포인터 변수로 전달할 때의 표준 형식:
void write_hardware_byte(volatile uint8_t * const reg_addr, uint8_t val) {
    // reg_addr 주소 자체는 고정(const), 가리키는 하드웨어는 volatile
    *reg_addr = val;
}`,
    optimizedCycles: '1~2 사이클 직접 접근',
    optimizedAssembly: `out 0x05, r24 ; I/O 공간이면 단 1사이클 OUT 명령으로 직결!
; 또는
sts 0x25, r24 ; 메모리 공간이면 2사이클 STS`,
    speedupPercentage: '코드 크기 50% 절감',
    explanation: '하드웨어 레지스터 제어 매크로는 `*(volatile uint8_t *)(주소)` 형태로 선언하여 포인터 주소 연산 오버헤드를 없애고 컴파일러가 직접 `IN`/`OUT`/`STS` 명령을 생성하도록 해야 합니다.',
    bestPracticeTip: '항상 <avr/io.h>의 표준 정의 매크로(PORTB, UCSR0A 등)를 사용하세요. 이미 volatile 캐스팅이 적용되어 있습니다.'
  },

  // 3. Fast 1-Cycle Bit Manipulation (SBI/CBI)
  {
    id: 'fast-sbi-cbi',
    topic: 'bit_ops',
    title: '1클럭 전용 명령어(SBI / CBI)와 하위 32개 I/O 공간 활용',
    shortTag: '1클럭 하드웨어 제어',
    categoryLabel: '비트 조작 팁',
    problemSummary: 'AVR 코어는 하위 32개 I/O 레지스터(0x00~0x1F)에서만 1사이클 단일 비트 세트/클리어(SBI/CBI) 명령어를 지원하며, 상위 I/O나 비효율적인 코드에서는 3~5사이클의 Read-Modify-Write가 발생합니다.',
    antipatternCode: `// ❌ 비효율: 다중 비트 또는 변수 마스크 사용 시 Read-Modify-Write 발생
void pulse_pin_slow(void) {
    // PORTB5(Pin 13 LED)를 켜기 위해 3개 명령어 소모
    // 1. IN  (1클럭)
    // 2. ORI (1클럭)
    // 3. OUT (1클럭) -> 총 3클럭 + 인터럽트 발생 시 데이터 레이스 위험!
    PORTB |= (1 << PB5); 
}`,
    antipatternCycles: '3 클럭 사이클 (IN + ORI + OUT)',
    antipatternAssembly: `in  r24, 0x05 ; 1 cycle
ori r24, 0x20 ; 1 cycle
out 0x05, r24 ; 1 cycle`,
    optimizedCode: `// ✅ 최적화: 상수 비트 1개 조작은 컴파일러가 자동으로 1사이클 SBI 생성
void pulse_pin_fast(void) {
    // 하위 32개 I/O 주소(PORTB = 0x05)이므로 1사이클 하드웨어 비트 세트
    // 원자적(Atomic)으로 동작하여 인터럽트 안전성 100% 보장!
    PORTB |= (1 << PB5); // 컴파일러가 'sbi 0x05, 5' 생성
}`,
    optimizedCycles: '1 클럭 사이클 (단일 SBI)',
    optimizedAssembly: `sbi 0x05, 5 ; 1 cycle (원자적 하드웨어 비트 세트!)`,
    speedupPercentage: '67% 사이클 단축 (원자적 보호)',
    explanation: '하위 32개 I/O(PORTB, PORTC, PORTD, PINB 등)에서는 단일 비트 |= 연산 시 컴파일러가 `sbi` 또는 `cbi`를 자동 생성합니다. 인터럽트 차단(cli/sei) 없이도 원자성이 완벽히 유지됩니다.',
    bestPracticeTip: '단일 비트를 토글하거나 플래그를 세트할 때는 변수를 통한 마스크 대신 상수 `(1 << PB5)`를 직접 대입하세요.'
  },

  // 4. PINx Register Hardware Toggle Trick
  {
    id: 'pinx-hardware-toggle',
    topic: 'bit_ops',
    title: 'PINx 레지스터 1 쓰기를 통한 초고속 1클럭 핀 토글 트릭',
    shortTag: '초고속 GPIO 토글',
    categoryLabel: '비트 조작 팁',
    problemSummary: '일반적인 XOR(^) 핀 토글은 PORT 레지스터를 읽고, 비트를 반전하고, 다시 쓰는 3~4사이클 R-M-W 시퀀스를 거쳐 신호 지연과 글리치가 유발됩니다.',
    antipatternCode: `// ❌ 일반적인 포트 토글 (3~4클럭)
void toggle_led_traditional(void) {
    // 1. IN r24, PORTB
    // 2. LDI r25, 0x20
    // 3. EOR r24, r25
    // 4. OUT PORTB, r24
    PORTB ^= (1 << PB5);
}`,
    antipatternCycles: '3 ~ 4 클럭 사이클',
    antipatternAssembly: `in  r24, 0x05 ; 1 cycle
ldi r25, 0x20 ; 1 cycle
eor r24, r25 ; 1 cycle
out 0x05, r24 ; 1 cycle`,
    optimizedCode: `// ✅ 최적화: AVR 하드웨어 고유의 PINx 레지스터 1 쓰기 토글 특성 활용!
void toggle_led_ultra_fast(void) {
    // 데이터시트 명시: PINx(입력 핀 레지스터)의 해당 비트에 1을 쓰면
    // 하드웨어가 자동으로 PORTx 비트를 1클럭 만에 하드웨어적으로 토글함!
    PINB = (1 << PINB5); // 또는 sbi 0x03, 5
}`,
    optimizedCycles: '1 클럭 사이클 (단일 OUT 또는 SBI)',
    optimizedAssembly: `sbi 0x03, 5 ; 1 cycle (PINB5에 1 쓰기 -> PORTB5 하드웨어 자동 반전!)`,
    speedupPercentage: '75% 사이클 단축',
    explanation: 'AVR 마이크로컨트롤러(ATmega328P/2560/640/128A)는 PINx 레지스터에 로직 1을 쓰면 해당 포트 핀의 출력 래치가 하드웨어적으로 즉시 토글되는 기능을 갖추고 있습니다.',
    bestPracticeTip: '고주파 사각파 생성이나 인터럽트 ISR 내 디버그 핀 펄스 출력 시 `PINB = (1 << PINB5);`를 적극 활용하세요.'
  },

  // 5. Memory Alignment & Power-of-2 Ring Buffer
  {
    id: 'power-of-two-ring-buffer',
    topic: 'memory_align',
    title: '원형 링 버퍼(Ring Buffer)의 2^N 정렬 및 나눗셈(Modulo) 제거',
    shortTag: '연산 사이클 90% 절감',
    categoryLabel: '메모리 정렬 가이드',
    problemSummary: '버퍼 크기를 100이나 50 등 임의의 크기로 잡으면 링 버퍼 래핑 시 무거운 정수 나눗셈(%) 런타임 루틴이 호출되어 수십 사이클을 소모합니다.',
    antipatternCode: `// ❌ 비효율: 버퍼 크기가 100바이트 -> 나눗셈 루틴 호출 (15~25클럭)
#define BUFFER_SIZE 100

volatile uint8_t rx_buffer[BUFFER_SIZE];
volatile uint8_t head = 0;

void push_byte_slow(uint8_t data) {
    rx_buffer[head] = data;
    // ⚠️ 8비트 AVR에는 하드웨어 나눗셈기가 없음! 
    // % 연산자는 내부 __udivmodqi4 소프트웨어 함수를 호출하여 20클럭 소모
    head = (head + 1) % BUFFER_SIZE; 
}`,
    antipatternCycles: '18 ~ 25 클럭 사이클',
    antipatternAssembly: `mov  r24, r18
subi r24, -1
ldi  r22, 100
rcall __udivmodqi4 ; 소프트웨어 나눗셈 함수 호출 (치명적 지연!)`,
    optimizedCode: `// ✅ 최적화: 버퍼 크기를 2의 거듭제곱(64, 128, 256)으로 메모리 정렬
#define BUFFER_SIZE 64 // 2^6 (2의 거듭제곱)

volatile uint8_t rx_buffer[BUFFER_SIZE];
volatile uint8_t head = 0;

void push_byte_fast(uint8_t data) {
    rx_buffer[head] = data;
    // ⚠️ 비트 AND 마스킹을 통한 1클럭 초고속 래핑!
    // (BUFFER_SIZE - 1)은 63 (0b00111111) 상수 마스크로 치환됨
    head = (head + 1) & (BUFFER_SIZE - 1); // 단 1사이클 ANDI 명령!
}`,
    optimizedCycles: '1 ~ 2 클럭 사이클 (단일 ANDI)',
    optimizedAssembly: `subi r24, -1 ; 1 cycle (head + 1)
andi r24, 63 ; 1 cycle (비트 마스킹으로 0~63 순환 완료!)`,
    speedupPercentage: '92% 사이클 절감',
    explanation: '8비트 AVR CPU는 하드웨어 곱셈기(2클럭)는 있지만 나눗셈기가 없습니다. 2^N 크기로 정렬하면 `(idx + 1) & (SIZE - 1)` 단일 비트 마스킹으로 1사이클 내 순환 처리가 가능합니다.',
    bestPracticeTip: 'USART, SPI, ADC 센서 버퍼 크기는 항상 16, 32, 64, 128, 256 바이트 중 하나로 선언하세요.'
  },

  // 6. Struct Alignment & Member Ordering
  {
    id: 'struct-member-ordering',
    topic: 'memory_align',
    title: '구조체(Struct) 멤버 크기순 배치 및 16비트 레지스터 페어링',
    shortTag: 'SRAM 및 포인터 최적화',
    categoryLabel: '메모리 정렬 가이드',
    problemSummary: '8비트 AVR은 바이트 단위 주소 체계이지만, 포인터 연산 및 16비트 변수 접근 시 레지스터 짝(R24:R25, X, Y, Z) 최적화를 고려하지 않고 멤버를 무작위 배치하면 추가적인 주소 가산 코드가 생성됩니다.',
    antipatternCode: `// ❌ 무작위 배치 구조체 (비효율적인 오프셋 연산 유발)
struct SensorPacket_Bad {
    uint8_t  sensor_id;  // 1 바이트 (오프셋 0)
    uint32_t timestamp;  // 4 바이트 (오프셋 1 -> 비정렬)
    uint8_t  flags;      // 1 바이트 (오프셋 5)
    uint16_t adc_val;    // 2 바이트 (오프셋 6)
}; // 총 8 바이트`,
    antipatternCycles: '오프셋 주소 가산(ADIW) 반복 소모',
    antipatternAssembly: `ldd r24, Y+1 ; 2 cycles
ldd r25, Y+2 ; 2 cycles
ldd r26, Y+3 ; 2 cycles
ldd r27, Y+4 ; 2 cycles`,
    optimizedCode: `// ✅ 최적화: 32비트 -> 16비트 -> 8비트 내림차순 정렬 배치
struct SensorPacket_Optimized {
    uint32_t timestamp;  // 4 바이트 (오프셋 0: Z-포인터 0 기준 즉각 로드)
    uint16_t adc_val;    // 2 바이트 (오프셋 4: 레지스터 페어 r24:r25 연속 로드)
    uint8_t  sensor_id;  // 1 바이트 (오프셋 6)
    uint8_t  flags;      // 1 바이트 (오프셋 7)
};

// 배열 선언 시 PROGMEM 및 SRAM 접근 효율 극대화`,
    optimizedCycles: '연속 로드(LD Z+) 및 최소 사이클',
    optimizedAssembly: `ld r24, Z+ ; 1 cycle
ld r25, Z+ ; 1 cycle
ld r26, Z+ ; 1 cycle
ld r27, Z+ ; 1 cycle (포인터 자동 증가 활용)`,
    speedupPercentage: '코드 크기 및 접근 시간 30% 개선',
    explanation: '구조체 멤버를 큰 자료형(32비트 -> 16비트 -> 8비트) 순으로 정렬하면 컴파일러가 간접 주소 지정 시 오프셋 가산기(ADIW)를 덜 사용하고 `LD Z+` 자동 증가 명령어를 유효하게 활용할 수 있습니다.',
    bestPracticeTip: '임베디드 패킷 구조체는 내림차순 정렬을 원칙으로 하되, 통신 프로토콜 일치 필요 시에만 `__attribute__((packed))`를 선언하세요.'
  }
];

export const FirmwarePerformanceGuide: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  const [activeTopic, setActiveTopic] = useState<OptimizationTopic>('volatile');
  const [selectedCaseId, setSelectedCaseId] = useState<string>('volatile-local-caching');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const filteredCases = useMemo(() => {
    return OPTIMIZATION_CASES.filter((c) => c.topic === activeTopic);
  }, [activeTopic]);

  const activeCase = useMemo(() => {
    return OPTIMIZATION_CASES.find((c) => c.id === selectedCaseId) || filteredCases[0];
  }, [selectedCaseId, filteredCases]);

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    confetti({ particleCount: 35, spread: 55, origin: { y: 0.7 } });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* 1. Top Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              펌웨어 성능 최적화 가이드
              <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                8-Bit AVR Performance Blueprint
              </span>
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-4xl leading-relaxed">
            {currentProfile.name} 8비트 RISC 하드웨어의 실행 사이클을 최소화하기 위한
            <strong className="text-emerald-300"> volatile 키워드 위치 최적화</strong>,
            <strong className="text-cyan-300"> 1클럭 하드웨어 비트 조작(SBI/PINx)</strong>, 그리고
            <strong className="text-amber-300"> 2^N 메모리 정렬(Memory Alignment)</strong> 실무 가이드를 제공합니다.
          </p>
        </div>

        {/* Quick Target Arch Badge */}
        <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800 shrink-0">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold text-slate-200">
            {currentProfile.name} • 1-Cycle Harvard Core
          </span>
        </div>
      </div>

      {/* 2. Interactive Topic Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-950/60 p-2 rounded-2xl border border-slate-800/80">
        {[
          {
            id: 'volatile' as OptimizationTopic,
            label: '1. volatile 키워드 위치 & 로컬 캐싱',
            icon: Zap,
            color: 'text-amber-400'
          },
          {
            id: 'bit_ops' as OptimizationTopic,
            label: '2. 1클럭 비트 조작 (SBI / PINx 토글)',
            icon: Sparkles,
            color: 'text-cyan-400'
          },
          {
            id: 'memory_align' as OptimizationTopic,
            label: '3. 메모리 정렬 & 2^N 링 버퍼 나눗셈 제거',
            icon: Layers,
            color: 'text-emerald-400'
          }
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTopic === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTopic(tab.id);
                const first = OPTIMIZATION_CASES.find((c) => c.topic === tab.id);
                if (first) setSelectedCaseId(first.id);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isSelected
                  ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-white border border-emerald-500/50 shadow-md shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${tab.color}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Case Selector Pills for Active Topic */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {filteredCases.map((item) => {
          const isSelected = selectedCaseId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedCaseId(item.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all shrink-0 border flex items-center gap-2 ${
                isSelected
                  ? 'bg-slate-800 text-emerald-300 border-emerald-500/60 font-bold shadow-sm'
                  : 'bg-slate-950/50 text-slate-400 hover:text-slate-200 border-slate-800'
              }`}
            >
              <span>{item.title}</span>
              <span className={`text-[10px] px-2 py-0.2 rounded-full font-mono ${
                isSelected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-900 text-slate-500'
              }`}>
                {item.shortTag}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. Active Case In-Depth Breakdown Card */}
      {activeCase && (
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-5">
          {/* Summary Callout */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/30">
                  {activeCase.categoryLabel}
                </span>
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 font-mono">
                  속도 개선: {activeCase.speedupPercentage}
                </span>
              </div>
              <h4 className="text-base font-bold text-white tracking-tight">
                {activeCase.title}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                {activeCase.problemSummary}
              </p>
            </div>
          </div>

          {/* Side-by-Side: Antipattern (Left) vs Optimized (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Anti-pattern (Bad Practice) */}
            <div className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-4 space-y-3 shadow-lg flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-xs font-bold text-rose-300 font-mono">
                      ❌ 비효율적인 안티패턴 (Bad Practice)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    소요: {activeCase.antipatternCycles}
                  </span>
                </div>

                <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-[11px] text-slate-300 overflow-x-auto select-text shadow-inner">
                  <pre className="whitespace-pre">
                    {activeCase.antipatternCode}
                  </pre>
                </div>

                {/* Generated Assembly Disassembly */}
                <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase font-bold">
                    실제 생성되는 AVR 어셈블리 (Disassembly):
                  </span>
                  <pre className="text-[10px] font-mono text-rose-300 leading-tight overflow-x-auto whitespace-pre">
                    {activeCase.antipatternAssembly}
                  </pre>
                </div>
              </div>
            </div>

            {/* Right: Optimized Pattern (Good Practice) */}
            <div className="bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-4 space-y-3 shadow-lg flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold text-emerald-300 font-mono">
                      ✅ 성능 최적화 패턴 (Optimized Pattern)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                      소요: {activeCase.optimizedCycles}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(activeCase.id, activeCase.optimizedCode)}
                      className="p-1 text-slate-400 hover:text-white transition"
                      title="최적화 코드 복사"
                    >
                      {copiedCode === activeCase.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-[11px] text-emerald-200 overflow-x-auto select-text shadow-inner">
                  <pre className="whitespace-pre">
                    {activeCase.optimizedCode}
                  </pre>
                </div>

                {/* Generated Assembly Disassembly */}
                <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase font-bold">
                    최적화 어셈블리 (Disassembly):
                  </span>
                  <pre className="text-[10px] font-mono text-emerald-400 leading-tight overflow-x-auto whitespace-pre">
                    {activeCase.optimizedAssembly}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Deep-Dive Hardware Explanation & Best Practice Rule */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="md:col-span-8 space-y-1">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                하드웨어 아키텍처 관점의 원리:
              </span>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                {activeCase.explanation}
              </p>
            </div>

            <div className="md:col-span-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 space-y-1 flex flex-col justify-center">
              <span className="font-bold text-emerald-300 text-[11px] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                실무 적용 권장 팁:
              </span>
              <p className="text-slate-300 text-[10px] leading-relaxed">
                {activeCase.bestPracticeTip}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
