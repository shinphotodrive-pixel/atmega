import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  FileCode2,
  Cpu,
  Layers,
  Zap,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Download,
  Info,
  TrendingDown,
  Gauge,
  Terminal,
  ShieldCheck,
  ArrowRight,
  Maximize2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type ArchitectureMode = 'avr_8bit' | 'cross_32bit' | 'arm_cortex_32bit';

export interface StructField {
  id: string;
  name: string;
  type: string;
  baseSize: number; // in bytes
  alignment: number; // in bytes
  isBitfieldCandidate?: boolean;
  bitCount?: number;
  description: string;
}

export interface PresetStruct {
  id: string;
  name: string;
  category: 'iot' | 'motor' | 'comm' | 'rtos';
  description: string;
  targetInstances: number; // typical array length in SRAM
  rawSnippet: string;
  fields: StructField[];
}

const PRESET_STRUCTS: PresetStruct[] = [
  {
    id: 'iot_telemetry',
    name: 'IoT 환경 센서 텔레메트리 패킷 (SensorTelemetry_t)',
    category: 'iot',
    description: '온습도, 기압, 조도 및 개별 상태 플래그가 혼합되어 패딩 낭비가 심한 센서 패킷 구조체',
    targetInstances: 32,
    rawSnippet: `struct SensorTelemetry {
    uint8_t  sensor_id;       // 1 byte
    uint32_t timestamp;       // 4 bytes (needs 4-byte align on 32-bit / 2-byte alignment)
    uint8_t  battery_level;   // 1 byte
    float    temperature;     // 4 bytes
    uint8_t  is_valid;        // 1 byte (boolean flag)
    uint16_t humidity_raw;    // 2 bytes
    uint8_t  alert_flag;      // 1 byte
    uint32_t pressure_pa;     // 4 bytes
    uint8_t  has_error;       // 1 byte
};`,
    fields: [
      { id: 'f1', name: 'sensor_id', type: 'uint8_t', baseSize: 1, alignment: 1, description: '센서 모듈 고유 ID' },
      { id: 'f2', name: 'timestamp', type: 'uint32_t', baseSize: 4, alignment: 4, description: 'UNIX 에포크 타임스탬프 (4바이트 정렬 요구)' },
      { id: 'f3', name: 'battery_level', type: 'uint8_t', baseSize: 1, alignment: 1, description: '배터리 잔량 백분율 (0-100%)' },
      { id: 'f4', name: 'temperature', type: 'float', baseSize: 4, alignment: 4, description: 'IEEE 754 32비트 부동소수점 온도' },
      { id: 'f5', name: 'is_valid', type: 'uint8_t', baseSize: 1, alignment: 1, isBitfieldCandidate: true, bitCount: 1, description: '유효 측정 데이터 여부 (1비트 플래그)' },
      { id: 'f6', name: 'humidity_raw', type: 'uint16_t', baseSize: 2, alignment: 2, description: '16비트 습도 ADC 변환 원시값' },
      { id: 'f7', name: 'alert_flag', type: 'uint8_t', baseSize: 1, alignment: 1, isBitfieldCandidate: true, bitCount: 1, description: '임계치 초과 경보 플래그 (1비트 플래그)' },
      { id: 'f8', name: 'pressure_pa', type: 'uint32_t', baseSize: 4, alignment: 4, description: '대기압 Pa 측정값' },
      { id: 'f9', name: 'has_error', type: 'uint8_t', baseSize: 1, alignment: 1, isBitfieldCandidate: true, bitCount: 1, description: 'I2C/SPI 버스 통신 오류 플래그 (1비트)' }
    ]
  },
  {
    id: 'motor_pid',
    name: 'BLDC 모터 PID 제어 컨텍스트 (MotorControlState_t)',
    category: 'motor',
    description: '모터 엔코더 펄스, PWM 듀티, 에러 적분값과 방향/브레이크 비트가 뒤섞인 제어 구조체',
    targetInstances: 8,
    rawSnippet: `struct MotorControlState {
    uint8_t  motor_id;        // 1 byte
    uint32_t encoder_ticks;   // 4 bytes
    uint8_t  dir_forward;     // 1 byte (flag)
    int16_t  target_rpm;      // 2 bytes
    uint8_t  brake_engaged;   // 1 byte (flag)
    float    pid_integral;    // 4 bytes
    uint8_t  fault_overcurrent; // 1 byte (flag)
    uint16_t pwm_duty;        // 2 bytes
    uint8_t  fault_stall;     // 1 byte (flag)
};`,
    fields: [
      { id: 'm1', name: 'motor_id', type: 'uint8_t', baseSize: 1, alignment: 1, description: '모터 채널 인덱스' },
      { id: 'm2', name: 'encoder_ticks', type: 'uint32_t', baseSize: 4, alignment: 4, description: '쿼드러처 엔코더 누적 펄스 수' },
      { id: 'm3', name: 'dir_forward', type: 'uint8_t', baseSize: 1, alignment: 1, isBitfieldCandidate: true, bitCount: 1, description: '회전 방향 (0: 역방향, 1: 정방향)' },
      { id: 'm4', name: 'target_rpm', type: 'int16_t', baseSize: 2, alignment: 2, description: '목표 RPM 속도 명령치' },
      { id: 'm5', name: 'brake_engaged', type: 'uint8_t', baseSize: 1, alignment: 1, isBitfieldCandidate: true, bitCount: 1, description: '전자 브레이크 체결 여부' },
      { id: 'm6', name: 'pid_integral', type: 'float', baseSize: 4, alignment: 4, description: '적분(I) 누적 제어 오차치' },
      { id: 'm7', name: 'fault_overcurrent', type: 'uint8_t', baseSize: 1, alignment: 1, isBitfieldCandidate: true, bitCount: 1, description: '과전류 차단 트립 상태' },
      { id: 'm8', name: 'pwm_duty', type: 'uint16_t', baseSize: 2, alignment: 2, description: '타이머 OCR 비교 매치 PWM 듀티 레지스터 값' },
      { id: 'm9', name: 'fault_stall', type: 'uint8_t', baseSize: 1, alignment: 1, isBitfieldCandidate: true, bitCount: 1, description: '구속(Stall) 모터 과열 감지 상태' }
    ]
  },
  {
    id: 'comm_frame',
    name: 'RS-485 / Modbus 통신 프레임 (ModbusPacket_t)',
    category: 'comm',
    description: '프레임 헤더, 타임아웃 타이머, CRC-16 및 단일 플래그 바이트가 비효율적으로 배치된 패킷',
    targetInstances: 16,
    rawSnippet: `struct ModbusPacket {
    uint8_t  start_byte;      // 1 byte
    uint32_t frame_seq;       // 4 bytes
    uint8_t  slave_addr;      // 1 byte
    uint16_t crc16;           // 2 bytes
    uint8_t  is_broadcast;    // 1 byte
    uint32_t rx_timeout_ms;   // 4 bytes
    uint8_t  ack_received;    // 1 byte
    uint8_t  retry_count;     // 1 byte
};`,
    fields: [
      { id: 'c1', name: 'start_byte', type: 'uint8_t', baseSize: 1, alignment: 1, description: '프레임 시작 식별자 (0xAA)' },
      { id: 'c2', name: 'frame_seq', type: 'uint32_t', baseSize: 4, alignment: 4, description: '패킷 일련번호 시퀀스' },
      { id: 'c3', name: 'slave_addr', type: 'uint8_t', baseSize: 1, alignment: 1, description: '슬레이브 디바이스 주소 (0-247)' },
      { id: 'c4', name: 'crc16', type: 'uint16_t', baseSize: 2, alignment: 2, description: '16비트 CRC 체크섬' },
      { id: 'c5', name: 'is_broadcast', type: 'uint8_t', baseSize: 1, alignment: 1, isBitfieldCandidate: true, bitCount: 1, description: '브로드캐스트 메시지 여부 (1비트)' },
      { id: 'c6', name: 'rx_timeout_ms', type: 'uint32_t', baseSize: 4, alignment: 4, description: '응답 대기 타이머 만료 시각 (ms)' },
      { id: 'c7', name: 'ack_received', type: 'uint8_t', baseSize: 1, alignment: 1, isBitfieldCandidate: true, bitCount: 1, description: '수신 확인 ACK 플래그 (1비트)' },
      { id: 'c8', name: 'retry_count', type: 'uint8_t', baseSize: 1, alignment: 1, description: '재전송 시도 카운터' }
    ]
  },
  {
    id: 'rtos_tcb',
    name: 'RTOS 경량 태스크 제어 블록 (TaskControlBlock_t)',
    category: 'rtos',
    description: '스택 포인터, 태스크 우선순위, 틱 지연 시간, 스케줄링 플래그가 배치된 TCB',
    targetInstances: 12,
    rawSnippet: `struct TaskControlBlock {
    uint8_t  task_id;         // 1 byte
    void*    stack_ptr;       // 2 bytes (AVR 16-bit ptr) or 4 bytes (32-bit ptr)
    uint8_t  priority;        // 1 byte
    uint32_t delay_ticks;     // 4 bytes
    uint8_t  is_ready;        // 1 byte
    uint8_t  is_suspended;    // 1 byte
    uint32_t execution_count; // 4 bytes
    uint8_t  watchdog_pet;    // 1 byte
};`,
    fields: [
      { id: 'r1', name: 'task_id', type: 'uint8_t', baseSize: 1, alignment: 1, description: '스케줄러 태스크 핸들 ID' },
      { id: 'r2', name: 'stack_ptr', type: 'void*', baseSize: 2, alignment: 2, description: '태스크 전용 스택 탑 포인터 (AVR은 16비트 포인터)' },
      { id: 'r3', name: 'priority', type: 'uint8_t', baseSize: 1, alignment: 1, description: '스케줄링 우선순위 레벨 (0-255)' },
      { id: 'r4', name: 'delay_ticks', type: 'uint32_t', baseSize: 4, alignment: 4, description: 'vTaskDelay 슬립 틱 카운터' },
      { id: 'r5', name: 'is_ready', type: 'uint8_t', baseSize: 1, alignment: 1, isBitfieldCandidate: true, bitCount: 1, description: '실행 준비 완료 플래그 (1비트)' },
      { id: 'r6', name: 'is_suspended', type: 'uint8_t', baseSize: 1, alignment: 1, isBitfieldCandidate: true, bitCount: 1, description: '일시정지 상태 플래그 (1비트)' },
      { id: 'r7', name: 'execution_count', type: 'uint32_t', baseSize: 4, alignment: 4, description: '태스크 총 스케줄링 횟수' },
      { id: 'r8', name: 'watchdog_pet', type: 'uint8_t', baseSize: 1, alignment: 1, isBitfieldCandidate: true, bitCount: 1, description: '소프트웨어 워치독 갱신 플래그 (1비트)' }
    ]
  }
];

// Layout calculation helper
interface ByteLayoutItem {
  offset: number;
  fieldName: string;
  fieldType: string;
  isPadding: boolean;
  color: string;
}

export const CompilerOptimizationReportGenerator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  const [selectedPresetId, setSelectedPresetId] = useState<string>('iot_telemetry');
  const [archMode, setArchMode] = useState<ArchitectureMode>('cross_32bit');
  const [activeStrategy, setActiveStrategy] = useState<'reorder' | 'bitfield' | 'packed'>('bitfield');
  const [instanceCount, setInstanceCount] = useState<number>(32);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [showSegmentModal, setShowSegmentModal] = useState<boolean>(false);

  const currentPreset = useMemo(() => {
    return PRESET_STRUCTS.find((p) => p.id === selectedPresetId) || PRESET_STRUCTS[0];
  }, [selectedPresetId]);

  // Determine alignment requirement based on architecture
  const getFieldAlignment = (field: StructField, mode: ArchitectureMode): number => {
    if (mode === 'avr_8bit') {
      // AVR 8-bit architecture natural byte alignment is 1 for almost everything,
      // but GCC for AVR may align 16-bit to 1 and 32-bit to 1, or 2 if specified.
      // However, structs communicating with 32-bit hosts or using strict ABI align to field size up to 2.
      return Math.min(field.alignment, 2);
    }
    // 32-bit Cortex-M / x86 / Host alignment: natural alignment = baseSize (up to 4)
    return Math.min(field.alignment, 4);
  };

  // Helper to compute layout of a sequence of fields
  const computeLayout = (
    fields: StructField[],
    mode: ArchitectureMode,
    isPacked: boolean = false
  ) => {
    const layout: ByteLayoutItem[] = [];
    let currentOffset = 0;
    let maxStructAlign = 1;

    const colors: Record<string, string> = {
      uint8_t: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      'uint8_t:1': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      uint16_t: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      int16_t: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      'void*': 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      uint32_t: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
      float: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    };

    fields.forEach((f) => {
      const align = isPacked ? 1 : getFieldAlignment(f, mode);
      maxStructAlign = Math.max(maxStructAlign, align);

      // Check for padding before field
      const remainder = currentOffset % align;
      if (remainder !== 0) {
        const padBytes = align - remainder;
        for (let i = 0; i < padBytes; i++) {
          layout.push({
            offset: currentOffset + i,
            fieldName: 'PAD (Wasted Gap)',
            fieldType: 'padding',
            isPadding: true,
            color: 'bg-rose-950/60 text-rose-400 border-rose-500/50 dashed'
          });
        }
        currentOffset += padBytes;
      }

      // Add field bytes
      const color = colors[f.type] || 'bg-slate-700/40 text-slate-300 border-slate-600';
      for (let i = 0; i < f.baseSize; i++) {
        layout.push({
          offset: currentOffset + i,
          fieldName: `${f.name}${f.baseSize > 1 ? ` [B${i}]` : ''}`,
          fieldType: f.type,
          isPadding: false,
          color
        });
      }
      currentOffset += f.baseSize;
    });

    // Tail padding to round up struct size to multiple of maxStructAlign
    if (!isPacked && maxStructAlign > 1) {
      const tailRemainder = currentOffset % maxStructAlign;
      if (tailRemainder !== 0) {
        const tailPad = maxStructAlign - tailRemainder;
        for (let i = 0; i < tailPad; i++) {
          layout.push({
            offset: currentOffset + i,
            fieldName: 'TAIL PAD',
            fieldType: 'padding',
            isPadding: true,
            color: 'bg-rose-950/60 text-rose-400 border-rose-500/50 dashed'
          });
        }
        currentOffset += tailPad;
      }
    }

    const totalBytes = currentOffset;
    const paddingBytes = layout.filter((x) => x.isPadding).length;
    const dataBytes = totalBytes - paddingBytes;

    return { layout, totalBytes, paddingBytes, dataBytes, maxStructAlign };
  };

  // Original Layout
  const originalLayout = useMemo(() => {
    return computeLayout(currentPreset.fields, archMode, false);
  }, [currentPreset, archMode]);

  // Strategy 1: Reordered Layout (Sort by alignment descending: 4 -> 2 -> 1)
  const reorderedFields = useMemo(() => {
    const list = [...currentPreset.fields];
    return list.sort((a, b) => {
      const alignA = getFieldAlignment(a, archMode);
      const alignB = getFieldAlignment(b, archMode);
      if (alignB !== alignA) return alignB - alignA;
      return b.baseSize - a.baseSize;
    });
  }, [currentPreset, archMode]);

  const reorderedLayout = useMemo(() => {
    return computeLayout(reorderedFields, archMode, false);
  }, [reorderedFields, archMode]);

  // Strategy 2: Reordered + Bitfield Compaction
  const bitfieldFields = useMemo(() => {
    // Separate bitfield candidates from standard fields
    const candidates = currentPreset.fields.filter((f) => f.isBitfieldCandidate);
    const standard = currentPreset.fields.filter((f) => !f.isBitfieldCandidate);

    // Group bitfield candidates into uint8_t flags container
    const totalBits = candidates.reduce((acc, c) => acc + (c.bitCount || 1), 0);
    const packedBytes = Math.ceil(totalBits / 8);

    const packedField: StructField = {
      id: 'flags_packed',
      name: `status_flags[${packedBytes}] (비트필드 결합: ${totalBits}개 플래그)`,
      type: 'uint8_t:1',
      baseSize: packedBytes,
      alignment: 1,
      description: `${candidates.map((c) => c.name).join(', ')} 플래그 압축`
    };

    const combined = [...standard, packedField];
    return combined.sort((a, b) => {
      const alignA = getFieldAlignment(a, archMode);
      const alignB = getFieldAlignment(b, archMode);
      if (alignB !== alignA) return alignB - alignA;
      return b.baseSize - a.baseSize;
    });
  }, [currentPreset, archMode]);

  const bitfieldLayout = useMemo(() => {
    return computeLayout(bitfieldFields, archMode, false);
  }, [bitfieldFields, archMode]);

  // Strategy 3: Packed attribute Layout
  const packedLayout = useMemo(() => {
    return computeLayout(currentPreset.fields, archMode, true);
  }, [currentPreset, archMode]);

  // Active chosen optimized layout
  const optimizedLayout = useMemo(() => {
    if (activeStrategy === 'reorder') return reorderedLayout;
    if (activeStrategy === 'bitfield') return bitfieldLayout;
    return packedLayout;
  }, [activeStrategy, reorderedLayout, bitfieldLayout, packedLayout]);

  // Comparison metrics
  const origSize = originalLayout.totalBytes;
  const optSize = optimizedLayout.totalBytes;
  const savedBytesPerStruct = origSize - optSize;
  const percentSaved = origSize > 0 ? ((savedBytesPerStruct / origSize) * 100).toFixed(1) : '0';

  const totalSramSaved = savedBytesPerStruct * instanceCount;
  const sramTotalBytes = currentProfile.sram;
  const sramSavedPercentOfMCU = ((totalSramSaved / sramTotalBytes) * 100).toFixed(2);

  const efficiencyScore = Math.min(
    100,
    Math.round((optimizedLayout.dataBytes / optimizedLayout.totalBytes) * 100)
  );

  // Generate Optimized C Code
  const generatedCCode = useMemo(() => {
    const isBitfield = activeStrategy === 'bitfield';
    const isPacked = activeStrategy === 'packed';
    const fieldsToOutput = isBitfield ? bitfieldFields : isPacked ? currentPreset.fields : reorderedFields;

    let code = `/**\n * @file    ${currentPreset.id}_optimized.h\n * @brief   MCU Memory Alignment & Padding Optimized Struct\n * @target  ${currentProfile.name} (SRAM: ${currentProfile.sram} Bytes, Flash: ${currentProfile.flash} KB)\n * @profile Size reduced from ${origSize} bytes to ${optSize} bytes (-${percentSaved}%)\n * @date    Generated by AVR Studio Build Optimizer\n */\n\n#ifndef ${currentPreset.id.toUpperCase()}_OPTIMIZED_H\n#define ${currentPreset.id.toUpperCase()}_OPTIMIZED_H\n\n#include <stdint.h>\n#include <stdbool.h>\n#include <avr/pgmspace.h>\n\n`;

    if (isPacked) {
      code += `/* 주의: __attribute__((packed))는 패딩을 완전 제거하지만,\n   일부 16/32비트 버스 아키텍처에서 비정렬 접근(unaligned access) 시 추가 사이클이 발생할 수 있습니다.\n   AVR 8-bit 코어에서는 바이트 단위 메모리 버스를 사용하므로 안전합니다. */\n`;
      code += `typedef struct __attribute__((packed)) {\n`;
    } else {
      code += `/* 최적화: 크기순 정렬(Descending Alignment Reorder)로 내부 패딩 구멍을 완전 소거함 */\n`;
      code += `typedef struct {\n`;
    }

    if (isBitfield) {
      // Output standard fields first
      const nonFlags = fieldsToOutput.filter((f) => f.id !== 'flags_packed');
      nonFlags.forEach((f) => {
        code += `    ${f.type.padEnd(10)} ${f.name}; // Offset: ${f.baseSize}B (${f.description})\n`;
      });

      // Output bitfields
      code += `\n    /* --- 비트필드(Bit-fields) 압축: 여러 개의 bool/flag 변수를 1~2바이트로 결합 --- */\n`;
      const candidates = currentPreset.fields.filter((f) => f.isBitfieldCandidate);
      candidates.forEach((c) => {
        code += `    uint8_t    ${c.name} : ${c.bitCount || 1}; // ${c.description}\n`;
      });
      const remainingBits = 8 - (candidates.length % 8);
      if (remainingBits < 8 && remainingBits > 0) {
        code += `    uint8_t    _reserved : ${remainingBits}; // 8비트 경계 패딩\n`;
      }
    } else {
      fieldsToOutput.forEach((f) => {
        code += `    ${f.type.padEnd(10)} ${f.name}; // ${f.description}\n`;
      });
    }

    code += `} ${currentPreset.name.split(' ')[0]}_t;\n\n`;

    code += `/* 컴파일 타임 크기 검증 단언문 (C11 static_assert) */\n`;
    code += `_Static_assert(sizeof(${currentPreset.name.split(' ')[0]}_t) == ${optSize}, "Struct size optimization mismatch!");\n\n`;

    code += `/* 정적 버퍼 선언 시 절약 효과 (N=${instanceCount} 인스턴스) */\n`;
    code += `// 기존 크기: ${origSize * instanceCount} 바이트 -> 최적화 후: ${optSize * instanceCount} 바이트 (총 ${totalSramSaved} 바이트 SRAM 절약)\n`;
    code += `extern ${currentPreset.name.split(' ')[0]}_t g_ring_buffer[${instanceCount}];\n\n`;

    code += `/* 저전력 & SRAM 절약 팁: 변경되지 않는 룩업 테이블이나 기본 설정값은 .data 대신 PROGMEM에 배치하세요 */\n`;
    code += `const ${currentPreset.name.split(' ')[0]}_t PROGMEM DEFAULT_CONFIG = {\n`;
    code += `    // 플래시 메모리에 상주하여 부팅 시 SRAM을 단 1바이트도 소모하지 않음\n`;
    code += `};\n\n`;
    code += `#endif /* ${currentPreset.id.toUpperCase()}_OPTIMIZED_H */\n`;

    return code;
  }, [
    activeStrategy,
    currentPreset,
    currentProfile,
    origSize,
    optSize,
    percentSaved,
    instanceCount,
    totalSramSaved,
    bitfieldFields,
    reorderedFields
  ]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.8 }
    });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadCode = () => {
    const blob = new Blob([generatedCCode], { type: 'text/x-csrc' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentPreset.id}_optimized.h`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 lg:p-8 backdrop-blur shadow-2xl space-y-8 relative overflow-hidden">
      {/* Glow highlight */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg shadow-emerald-500/20 text-slate-950 font-black">
              <FileCode2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl lg:text-2xl font-black text-white tracking-tight">
                  컴파일러 최적화 리포트 생성기
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Data / BSS / Struct Padding Optimizer
                </span>
              </div>
              <p className="text-xs lg:text-sm text-slate-400 mt-1">
                변수들의 메모리 정렬 및 패딩(Padding) 낭비 공간을 실시간 분석하고, 비트필드(Bit-field) 및 멤버 재배열을 통해 SRAM을 극대화하는 데이터 구조체를 제안합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Target MCU and Arch selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-300">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>타깃:</span>
            <span className="font-bold text-emerald-300">{currentProfile.name}</span>
            <span className="text-[11px] text-slate-500">({currentProfile.sram}B SRAM)</span>
          </div>

          <button
            onClick={() => setShowSegmentModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-700"
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            Data vs BSS vs Stack 가이드
          </button>
        </div>
      </div>

      {/* Preset Structure Selector & Target Architecture Mode */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Preset Selector */}
        <div className="lg:col-span-2 space-y-3">
          <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              분석할 데이터 구조체 샘플 선택:
            </span>
            <span className="text-[11px] text-slate-500">실무 임베디드 패턴 4종 완비</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PRESET_STRUCTS.map((preset) => {
              const isSelected = preset.id === selectedPresetId;
              return (
                <button
                  key={preset.id}
                  onClick={() => {
                    setSelectedPresetId(preset.id);
                    setInstanceCount(preset.targetInstances);
                  }}
                  className={`text-left p-3.5 rounded-2xl border transition-all relative ${
                    isSelected
                      ? 'bg-gradient-to-br from-emerald-950/60 to-slate-900 border-emerald-500 text-white shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      {preset.name.split(' ')[0]}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-900 text-slate-500 border-slate-800'
                      }`}
                    >
                      {preset.category.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1 leading-snug">
                    {preset.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Target Memory Alignment Architecture */}
        <div className="space-y-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-2">
              <Gauge className="w-3.5 h-3.5 text-blue-400" />
              정렬 아키텍처 규칙 (ABI Alignment Mode):
            </label>
            <div className="space-y-2">
              <button
                onClick={() => setArchMode('cross_32bit')}
                className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                  archMode === 'cross_32bit'
                    ? 'bg-blue-950/50 border-blue-500 text-blue-200 font-bold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-200">Cross-Platform / 32-bit Host</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    자연 정렬 (4바이트 정렬) - 통신 패킷 송수신 시 최대 패딩 누수 발생
                  </div>
                </div>
                {archMode === 'cross_32bit' && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
              </button>

              <button
                onClick={() => setArchMode('avr_8bit')}
                className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                  archMode === 'avr_8bit'
                    ? 'bg-emerald-950/50 border-emerald-500 text-emerald-200 font-bold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-200">AVR-GCC Native (8-bit)</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    2바이트 정렬 완화 모드 (포인터 및 16/32비트 변수 기준)
                  </div>
                </div>
                {archMode === 'avr_8bit' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>SRAM 버퍼 인스턴스 개수:</span>
              <span className="font-mono font-bold text-amber-400">{instanceCount}개 배열</span>
            </div>
            <input
              type="range"
              min={1}
              max={128}
              step={1}
              value={instanceCount}
              onChange={(e) => setInstanceCount(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 mt-2"
            />
          </div>
        </div>
      </div>

      {/* Savings Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 relative overflow-hidden">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            기존 구조체 크기
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-rose-400 font-mono">
              {origSize}
            </span>
            <span className="text-xs text-slate-400 font-mono">Bytes / struct</span>
          </div>
          <div className="text-[11px] text-rose-500 mt-1 flex items-center gap-1 font-medium">
            <AlertTriangle className="w-3 h-3" />
            패딩 구멍: {originalLayout.paddingBytes}B 낭비
          </div>
        </div>

        <div className="bg-slate-950/80 border border-emerald-900/40 rounded-2xl p-4 relative overflow-hidden">
          <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
            최적화 후 크기
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-emerald-400 font-mono">
              {optSize}
            </span>
            <span className="text-xs text-slate-400 font-mono">Bytes / struct</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
            <TrendingDown className="w-3 h-3" />
            구조체당 {savedBytesPerStruct}B 절약 (-{percentSaved}%)
          </div>
        </div>

        <div className="bg-slate-950/80 border border-blue-900/40 rounded-2xl p-4 relative overflow-hidden">
          <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider mb-1">
            SRAM 총 절약량 ({instanceCount}개 버퍼)
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-blue-400 font-mono">
              {totalSramSaved}
            </span>
            <span className="text-xs text-slate-400 font-mono">Bytes 절감</span>
          </div>
          <div className="text-[11px] text-blue-300 mt-1 font-medium">
            {currentProfile.name} SRAM의 {sramSavedPercentOfMCU}% 회수
          </div>
        </div>

        <div className="bg-slate-950/80 border border-amber-900/40 rounded-2xl p-4 relative overflow-hidden">
          <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1">
            메모리 밀도 효율 점수
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-black text-amber-400 font-mono">
              {efficiencyScore}%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({optimizedLayout.dataBytes}/{optimizedLayout.totalBytes}B 유효)
            </span>
          </div>
          <div className="text-[11px] text-amber-400 mt-1 flex items-center gap-1 font-semibold">
            <Sparkles className="w-3 h-3" />
            {efficiencyScore === 100 ? '완벽한 0-패딩 밀도' : '최소 패딩 달성'}
          </div>
        </div>
      </div>

      {/* Optimization Strategy Switcher */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              최적화 전략 선택 및 실시간 비교
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveStrategy('reorder')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeStrategy === 'reorder'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              1. 크기순 재배열 (Descending Align)
            </button>
            <button
              onClick={() => setActiveStrategy('bitfield')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeStrategy === 'bitfield'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              2. 비트필드 압축 + 재배열 (권장)
            </button>
            <button
              onClick={() => setActiveStrategy('packed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeStrategy === 'packed'
                  ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/20'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              3. __attribute__((packed))
            </button>
          </div>
        </div>

        {/* Strategy description card */}
        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs text-slate-300 flex items-start gap-3">
          <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            {activeStrategy === 'reorder' && (
              <span>
                <strong>전략 1 (크기순 재정렬):</strong> 구조체 멤버를 정렬 요구치 내림차순(4바이트 float/uint32_t → 2바이트 uint16_t → 1바이트 uint8_t)으로 재배열하여 중간에 발생하는 패딩 구멍을 없앱니다. 런타임 성능 저하나 추가 코드 크기 증가가 전혀 없는 가장 안전한 기법입니다.
              </span>
            )}
            {activeStrategy === 'bitfield' && (
              <span>
                <strong>전략 2 (비트필드 압축 + 재정렬):</strong> 단순 참/거짓 또는 상태를 나타내는 여러 개의 <code className="text-emerald-300 font-mono">uint8_t</code> 또는 <code className="text-emerald-300 font-mono">bool</code> 변수들을 단 1비트씩 할당하는 C 비트필드(<code className="text-emerald-300 font-mono">uint8_t is_valid : 1;</code>)로 결합합니다. RAM 낭비를 극적으로 줄일 수 있습니다.
              </span>
            )}
            {activeStrategy === 'packed' && (
              <span>
                <strong>전략 3 (__attribute__((packed))):</strong> GCC 컴파일러에게 모든 패딩 바이트를 강제로 제거하도록 지시합니다. 크기는 가장 작아지지만 통신 프레임 직렬화에 적합하며, 32비트 코어에서는 비정렬 메모리 접근 시 추가 사이클이 소모될 수 있습니다(8비트 AVR은 바이트 단위 접근이므로 오버헤드 미미).
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Visual Memory Byte Grid: Before vs After */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Before Grid */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5 uppercase tracking-wide">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              최적화 전 메모리 배치 ({origSize} 바이트)
            </span>
            <span className="text-[11px] font-mono text-rose-400/90 bg-rose-950/50 px-2 py-0.5 rounded-lg border border-rose-900/60">
              패딩 손실 {originalLayout.paddingBytes}B
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {originalLayout.layout.map((byte, idx) => (
                <div
                  key={idx}
                  title={`오프셋: +${byte.offset} (0x${byte.offset.toString(16).padStart(2, '0')}) - ${byte.fieldName} (${byte.fieldType})`}
                  className={`p-2 rounded-xl border text-center transition-transform hover:scale-105 cursor-help ${byte.color}`}
                >
                  <div className="text-[9px] font-mono opacity-60">+{byte.offset}</div>
                  <div className="text-[10px] font-bold truncate leading-tight mt-0.5">
                    {byte.isPadding ? 'PAD' : byte.fieldName.split(' ')[0]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/60 leading-relaxed">
            빨간색 점선으로 표시된 <strong className="text-rose-400">PAD</strong> 블록은 변수들 사이의 정렬 요건을 맞추기 위해 컴파일러가 삽입한 빈 공간입니다. 프로그램 로직에 아무 기여를 하지 않으면서 SRAM을 낭비합니다.
          </div>
        </div>

        {/* After Grid */}
        <div className="bg-slate-950/80 border border-emerald-900/50 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              최적화 후 메모리 배치 ({optSize} 바이트)
            </span>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-lg border border-emerald-900/60 font-bold">
              {optimizedLayout.paddingBytes === 0 ? '패딩 0% 제거 달성' : `패딩 ${optimizedLayout.paddingBytes}B로 축소`}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {optimizedLayout.layout.map((byte, idx) => (
                <div
                  key={idx}
                  title={`오프셋: +${byte.offset} (0x${byte.offset.toString(16).padStart(2, '0')}) - ${byte.fieldName} (${byte.fieldType})`}
                  className={`p-2 rounded-xl border text-center transition-transform hover:scale-105 cursor-help ${byte.color}`}
                >
                  <div className="text-[9px] font-mono opacity-60">+{byte.offset}</div>
                  <div className="text-[10px] font-bold truncate leading-tight mt-0.5">
                    {byte.isPadding ? 'PAD' : byte.fieldName.split(' ')[0]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-slate-300 bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-900/40 leading-relaxed flex items-center justify-between">
            <span>
              변수가 빈틈없이 조밀하게 밀착되어 구조체당 <strong className="text-emerald-400">{savedBytesPerStruct} 바이트</strong>를 절감했습니다!
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
          </div>
        </div>
      </div>

      {/* Code Generation Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              최적화된 프로덕션 C 언어 헤더 코드 ({currentPreset.id}_optimized.h)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm ${
                copiedCode
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/80 hover:shadow-emerald-500/20'
              }`}
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? '복사 완료!' : 'C 헤더 복사'}
            </button>
            <button
              onClick={handleDownloadCode}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              .h 다운로드
            </button>
          </div>
        </div>

        {/* Code block */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              include/{currentPreset.id}_optimized.h
            </span>
            <span className="text-[11px] text-slate-500">AVR-GCC / Clang 호환 표준 C11</span>
          </div>
          <pre className="p-4 text-xs font-mono text-emerald-300/90 overflow-x-auto leading-relaxed max-h-80 selection:bg-emerald-500/30">
            {generatedCCode}
          </pre>
        </div>
      </div>

      {/* Memory Segment (Data / BSS / Stack) Architecture Guide Modal / Drawer */}
      {showSegmentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">
                  AVR 메모리 세그먼트 (Data vs BSS vs Stack) 설계 원칙
                </h3>
              </div>
              <button
                onClick={() => setShowSegmentModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 bg-slate-950 rounded-2xl border border-blue-900/40">
                <div className="font-bold text-blue-400 mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  .data 세그먼트 (초기화된 전역/정적 변수)
                </div>
                <p className="text-slate-400">
                  <code className="text-blue-300">uint32_t val = 1234;</code> 처럼 0이 아닌 초기값이 지정된 변수입니다. 
                  MCU가 부팅될 때 Flash ROM에서 SRAM으로 값을 복사(<code className="text-amber-300">__do_copy_data</code>)하므로 <strong>Flash와 SRAM을 동시에 2배로 소비</strong>합니다.
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-2xl border border-emerald-900/40">
                <div className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  .bss 세그먼트 (0으로 초기화되거나 미초기화된 변수)
                </div>
                <p className="text-slate-400">
                  <code className="text-emerald-300">uint8_t buffer[64];</code> 처럼 초기값이 없거나 0인 변수입니다. 
                  초기값 저장을 위한 Flash 공간을 차지하지 않고, 부팅 시 crt0에 의해 0으로 일괄 클리어(<code className="text-amber-300">__do_clear_bss</code>)됩니다.
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-2xl border border-purple-900/40">
                <div className="font-bold text-purple-400 mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  Stack vs Heap 충돌 방지
                </div>
                <p className="text-slate-400">
                  함수 내부의 로컬 구조체는 Stack에 배치됩니다. 구조체 크기가 크면 함수 호출 시 스택 포인터가 아래로 자라나 전역 BSS/Heap 영역과 충돌하여 <strong>스택 오버플로우 및 예측 불가 리셋</strong>을 유발합니다. 패딩을 줄이는 것이 스택 보존의 핵심입니다.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowSegmentModal(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all"
              >
                확인 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
