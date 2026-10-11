import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Layers,
  Lock,
  Unlock,
  AlertTriangle,
  Play,
  RotateCcw,
  Copy,
  Check,
  Terminal,
  Info,
  CheckCircle2,
  XCircle,
  Sparkles,
  Sliders
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type MemoryZoneId = 'flash_app' | 'flash_boot' | 'sram_data' | 'sram_stack' | 'eeprom' | 'io_sfr';

export interface MemoryZone {
  id: MemoryZoneId;
  name: string;
  category: 'flash' | 'sram' | 'eeprom' | 'io';
  addressRange: string;
  defaultR: boolean;
  defaultW: boolean;
  defaultX: boolean;
  hardwareSupport: string;
  description: string;
}

const MEMORY_ZONES: MemoryZone[] = [
  {
    id: 'flash_app',
    name: 'Flash Application Section (애플리케이션 영역)',
    category: 'flash',
    addressRange: '0x0000 ~ Bootloader Start',
    defaultR: true,
    defaultW: false,
    defaultX: true,
    hardwareSupport: '하드웨어 락비트 (BLB01/BLB02)',
    description: '메인 펌웨어 코드가 상주하며, 부트로더로부터의 불법 SPM 쓰기를 방지'
  },
  {
    id: 'flash_boot',
    name: 'Flash Bootloader Section (부트로더 영역)',
    category: 'flash',
    addressRange: 'BOOTSZ 결정 주소 ~ FLASHEND',
    defaultR: true,
    defaultW: false,
    defaultX: true,
    hardwareSupport: '하드웨어 락비트 (BLB11/BLB12)',
    description: 'ISP 및 UART 펌웨어 플래싱 루틴이 상주하며, 앱 코드로부터의 덮어쓰기 원천 차단'
  },
  {
    id: 'sram_data',
    name: 'SRAM Data & BSS (.data / .bss 정적 전역 변수)',
    category: 'sram',
    addressRange: 'RAMSTART ~ __bss_end',
    defaultR: true,
    defaultW: true,
    defaultX: false,
    hardwareSupport: '소프트웨어 MPU / 경계 센티넬',
    description: '전역 변수 및 정적 링버퍼 공간. 스택 침범으로부터 보호 필요'
  },
  {
    id: 'sram_stack',
    name: 'SRAM Stack (호출 스택 & 로컬 프레임)',
    category: 'sram',
    addressRange: 'SP (스택 탑) ~ RAMEND',
    defaultR: true,
    defaultW: true,
    defaultX: false,
    hardwareSupport: '스택 워터마크 & SP 가드',
    description: '함수 호출 복귀 주소 및 로컬 변수. 하향 성장하며 BSS 충돌 방지 감시'
  },
  {
    id: 'eeprom',
    name: 'EEPROM (비휘발성 설정 데이터)',
    category: 'eeprom',
    addressRange: '0x000 ~ E2END',
    defaultR: true,
    defaultW: true,
    defaultX: false,
    hardwareSupport: 'EECR 레지스터 (EEMWE/EEWE 타이밍 시퀀스)',
    description: '교정값 및 환경설정 저장. 우발적 전압 강하 쓰기 방지 필요'
  },
  {
    id: 'io_sfr',
    name: 'I/O & SFR 레지스터 공간',
    category: 'io',
    addressRange: '0x0020 ~ 0x00FF (Extended IO)',
    defaultR: true,
    defaultW: true,
    defaultX: false,
    hardwareSupport: 'NULL 포인터 역참조 방지 트랩',
    description: '하드웨어 주변장치 제어 레지스터. 0x0000 NULL 포인터 오염 감시'
  }
];

export interface ViolationScenario {
  id: string;
  name: string;
  zoneId: MemoryZoneId;
  targetAddr: string;
  operation: 'READ' | 'WRITE' | 'EXECUTE';
  asmInstruction: string;
  description: string;
  hardwareResponse: string;
  severity: 'critical' | 'warning' | 'fatal';
}

const VIOLATION_SCENARIOS: ViolationScenario[] = [
  {
    id: 'spm_boot_overwrite',
    name: '1. 앱 코드의 부트로더 덮어쓰기 시도 (SPM Lock Bit Violation)',
    zoneId: 'flash_boot',
    targetAddr: '0x7E00 (Bootloader)',
    operation: 'WRITE',
    asmInstruction: 'spm (Store Program Memory with Z=0x7E00)',
    description: '버그가 발생한 애플리케이션 코드가 부트로더 섹션으로 플래시 쓰기(SPM)를 시도함',
    hardwareResponse: 'BLB12=0 설정으로 인해 SPM 명령어가 하드웨어 수준에서 무시됨. 부트로더 손상 방지 완료.',
    severity: 'fatal'
  },
  {
    id: 'stack_overflow_bss',
    name: '2. 스택 오버플로우 전역 변수 침범 (SRAM Boundary Violation)',
    zoneId: 'sram_data',
    targetAddr: '0x0180 (.bss g_system_state)',
    operation: 'WRITE',
    asmInstruction: 'push r24 (SP <= __bss_end)',
    description: '과도한 함수 재귀 호출로 스택 포인터가 하향 팽창하여 .bss 전역 변수를 덮어씀',
    hardwareResponse: '스택 센티넬 매직워드(0x55) 파괴 감지! 페일세이프 ISR 트랩 진입 및 비상 리셋 트리거.',
    severity: 'critical'
  },
  {
    id: 'null_ptr_deref',
    name: '3. NULL 포인터 역참조 I/O 레지스터 오염 (Null Pointer Trap)',
    zoneId: 'io_sfr',
    targetAddr: '0x0000 (R0 / I/O Base)',
    operation: 'WRITE',
    asmInstruction: 'st Z, r1 (Z=0x0000 Null Pointer)',
    description: '초기화되지 않은 널 포인터를 통해 0번지 메모리에 쓰기를 시도하여 R0 및 인터럽트 플래그를 오염시킴',
    hardwareResponse: '소프트웨어 MPU 가드: 0x0000 번지 메모리 감시 루틴에서 불법 접근 포착 및 시스템 세이프가드 정지.',
    severity: 'fatal'
  },
  {
    id: 'sram_code_execution',
    name: '4. SRAM 데이터 영역 코드 실행 시도 (Harvard Bus Violation)',
    zoneId: 'sram_data',
    targetAddr: '0x0250 (SRAM Rx Buffer)',
    operation: 'EXECUTE',
    asmInstruction: 'ijmp (Indirect Jump to SRAM Z=0x0250)',
    description: '외부 패킷 버퍼(SRAM)로 함수 포인터가 점프하여 임의 코드 실행(Code Injection)을 시도함',
    hardwareResponse: 'AVR은 하버드 아키텍처이므로 SRAM 주소로 ijmp 시 플래시의 0x0250번지 명령어가 실행되어 오동작/리셋.',
    severity: 'critical'
  }
];

export const AvrMpuProtectionSimulator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Permissions state for each zone: Read, Write, Execute
  const [permissions, setPermissions] = useState<Record<MemoryZoneId, { r: boolean; w: boolean; x: boolean }>>({
    flash_app: { r: true, w: false, x: true },
    flash_boot: { r: true, w: false, x: true },
    sram_data: { r: true, w: true, x: false },
    sram_stack: { r: true, w: true, x: false },
    eeprom: { r: true, w: true, x: false },
    io_sfr: { r: true, w: true, x: false }
  });

  const [activeViolationId, setActiveViolationId] = useState<string>('spm_boot_overwrite');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationLog, setSimulationLog] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const activeViolation = useMemo(() => {
    return VIOLATION_SCENARIOS.find((v) => v.id === activeViolationId) || VIOLATION_SCENARIOS[0];
  }, [activeViolationId]);

  const togglePermission = (zoneId: MemoryZoneId, perm: 'r' | 'w' | 'x') => {
    setPermissions((prev) => ({
      ...prev,
      [zoneId]: {
        ...prev[zoneId],
        [perm]: !prev[zoneId][perm]
      }
    }));
  };

  // Run violation simulation test
  const handleRunSimulation = () => {
    setIsSimulating(true);
    setSimulationLog(null);

    setTimeout(() => {
      setIsSimulating(false);
      setSimulationLog(
        `[트랩 발동] 주소 ${activeViolation.targetAddr}에 대한 불법 ${activeViolation.operation} 접근 포착!\n` +
        `명령어: ${activeViolation.asmInstruction}\n` +
        `하드웨어 조치: ${activeViolation.hardwareResponse}`
      );
      confetti({
        particleCount: 20,
        spread: 45,
        origin: { y: 0.7 }
      });
    }, 400);
  };

  // Generated Lock Bits & Register Configuration
  const generatedConfigCode = useMemo(() => {
    return `// ==============================================================================
// ${currentProfile.name} 메모리 보호(MPU) 및 락비트(Lock Bits) 프로덕션 설정
// ==============================================================================
#include <avr/io.h>
#include <avr/boot.h>
#include <avr/interrupt.h>

/**
 * 1. AVR 하드웨어 플래시 락비트 (Lock Bits Fuse 바이트 설정)
 * - BLB02:01 = 0b10 (Application Section: 부트로더에서의 SPM 쓰기 금지)
 * - BLB12:11 = 0b10 (Bootloader Section: 애플리케이션에서의 SPM 쓰기 금지)
 * - LB2:1    = 0b10 (외부 프로그래머의 Flash/EEPROM 읽기 및 쓰기 보호)
 */
#define MPU_LOCK_BITS_RECOMMENDED  0xCC // Lock Fuse: 0b11001100

/**
 * 2. 런타임 소프트웨어 MPU 스택 가드 센티넬 초기화
 */
extern uint8_t __bss_end;
#define STACK_CANARY_MAGIC  0x5AA5

void mpu_software_guard_init(void) {
    // .bss와 스택 경계 지점에 16비트 매직 센티넬 기록
    uint16_t *sentinel = (uint16_t*)&__bss_end;
    *sentinel = STACK_CANARY_MAGIC;
}

/**
 * 3. 주기적 메모리 경계 세그먼트 위반 감사 루틴 (메인루프/타이머에서 호출)
 */
void mpu_verify_segment_integrity(void) {
    uint16_t *sentinel = (uint16_t*)&__bss_end;
    
    // 센티넬 오염 여부 검사 (스택 오버플로우 위반 감지)
    if (*sentinel != STACK_CANARY_MAGIC) {
        // [세그먼트 위반 트랩]
        cli(); // 모든 인터럽트 차단
        PORTB &= ~0b00100000; // 액추에이터 비상 정지
        while (1) {
            // 하드웨어 워치독으로 안전 리셋 유도
        }
    }
}
`;
  }, [currentProfile.name]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedConfigCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 lg:p-8 backdrop-blur shadow-2xl space-y-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg shadow-cyan-500/20 text-slate-950 font-black">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl lg:text-2xl font-black text-white tracking-tight">
                  AVR 메모리 보호 단위(MPU) 설정 시뮬레이터
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Memory Protection Unit & Lock Bits Simulator
                </span>
              </div>
              <p className="text-xs lg:text-sm text-slate-400 mt-1">
                메모리 영역(Flash/SRAM/EEPROM)별 R/W/X 권한을 설정하고, 하드웨어 락비트 및 SPMCSR 레지스터 구성과 잠재적인 세그먼트 위반 사례를 시뮬레이션합니다.
              </p>
            </div>
          </div>
        </div>

        {/* MCU Badge */}
        <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs text-slate-300">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span>MCU:</span>
          <span className="font-bold text-cyan-300">{currentProfile.name}</span>
          <span className="text-[11px] text-slate-500 font-mono">
            (Flash: {currentProfile.flash}KB / SRAM: {currentProfile.sram}B)
          </span>
        </div>
      </div>

      {/* Memory Zones Permission Matrix */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            메모리 영역별 접근 권한(R/W/X) 매트릭스 설정
          </span>
          <span className="text-[11px] text-slate-500">체크박스를 클릭하여 권한 제어</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {MEMORY_ZONES.map((zone) => {
            const p = permissions[zone.id];

            return (
              <div
                key={zone.id}
                className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3 hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-white">{zone.name.split('(')[0]}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">{zone.addressRange}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-900 border border-slate-800 text-cyan-300">
                    {zone.category.toUpperCase()}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                  {zone.description}
                </p>

                {/* R/W/X Toggle Checkboxes */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <span className="text-[11px] text-slate-500 font-sans">허용 권한:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => togglePermission(zone.id, 'r')}
                      className={`px-2 py-1 rounded-lg font-bold border transition ${
                        p.r
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-900 text-slate-600 border-slate-800'
                      }`}
                    >
                      Read (R)
                    </button>
                    <button
                      onClick={() => togglePermission(zone.id, 'w')}
                      className={`px-2 py-1 rounded-lg font-bold border transition ${
                        p.w
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-900 text-slate-600 border-slate-800'
                      }`}
                    >
                      Write (W)
                    </button>
                    <button
                      onClick={() => togglePermission(zone.id, 'x')}
                      className={`px-2 py-1 rounded-lg font-bold border transition ${
                        p.x
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          : 'bg-slate-900 text-slate-600 border-slate-800'
                      }`}
                    >
                      Exec (X)
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Segment Violation Interactive Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Violation Scenario Picker (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              세그먼트 위반(Violation) 시나리오 선택
            </span>
          </div>

          <div className="space-y-2.5">
            {VIOLATION_SCENARIOS.map((scen) => {
              const isSelected = scen.id === activeViolationId;
              return (
                <button
                  key={scen.id}
                  onClick={() => {
                    setActiveViolationId(scen.id);
                    setSimulationLog(null);
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-rose-950/40 border-rose-500 text-white ring-1 ring-rose-500/50'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs mb-1 flex items-center justify-between">
                    <span>{scen.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-950 border border-slate-800 text-rose-300">
                      {scen.operation}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {scen.description}
                  </p>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={isSimulating}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-500/20 disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isSimulating ? '위반 감지 시뮬레이션 중...' : '세그먼트 위반 발생 시뮬레이션 실행'}</span>
          </button>
        </div>

        {/* Right: Simulation Live Reaction Visualizer (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                하드웨어 MPU 보호 트랩 동작 결과
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Live Hardware Reaction</span>
            </div>

            {/* Target Details Card */}
            <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">위반 대상 주소:</span>
                <span className="text-rose-400 font-bold">{activeViolation.targetAddr}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">접근 명령어 (Assembly):</span>
                <span className="text-amber-300 font-bold">{activeViolation.asmInstruction}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">접근 유형:</span>
                <span className="text-cyan-300 font-bold">{activeViolation.operation} Violation</span>
              </div>
            </div>

            {/* Simulation Log Console */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 min-h-[110px] flex items-center">
              {simulationLog ? (
                <div className="text-xs font-mono text-emerald-300 space-y-1.5 leading-relaxed">
                  <div className="flex items-center gap-1.5 text-rose-400 font-bold">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>[MPU TRAP ENGAGED] 비인가 접근 차단 성공!</span>
                  </div>
                  <pre className="text-slate-300 text-[11px] whitespace-pre-wrap">{simulationLog}</pre>
                </div>
              ) : (
                <div className="text-slate-500 text-xs font-mono text-center w-full">
                  좌측에서 시나리오를 선택하고 [시뮬레이션 실행] 버튼을 누르면
                  <br />
                  하드웨어 트랩 및 보호 동작 과정이 실시간 출력됩니다.
                </div>
              )}
            </div>
          </div>

          {/* Action button */}
          <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
            <span className="text-[11px] text-slate-400">보호 락비트 및 C 초기화 루틴:</span>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-sm"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? '복사 완료!' : '보호 코드 복사'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
