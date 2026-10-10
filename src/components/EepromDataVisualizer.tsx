import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';
import {
  Database,
  Layers,
  Code2,
  Copy,
  Check,
  Download,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  RotateCcw,
  Sparkles,
  Info,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Terminal,
  HelpCircle,
  FileCode,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Eye
} from 'lucide-react';

interface Props {
  selectedMCU: SupportedMCU;
}

export type FieldType =
  | 'uint8_t'
  | 'int8_t'
  | 'uint16_t'
  | 'int16_t'
  | 'uint32_t'
  | 'int32_t'
  | 'float'
  | 'bool'
  | 'string'
  | 'bytes';

export interface StructField {
  id: string;
  name: string;
  type: FieldType;
  arrayLength?: number; // for string (char[N]) or bytes (uint8_t[N])
  value: string;        // user input representation
  comment?: string;
  color: string;
}

// Preset color palette for visual distinction
const FIELD_COLORS = [
  { border: 'border-cyan-500', bg: 'bg-cyan-500/20', text: 'text-cyan-300', dot: 'bg-cyan-400', hexBg: 'bg-cyan-900/60 text-cyan-200 ring-1 ring-cyan-500/50' },
  { border: 'border-emerald-500', bg: 'bg-emerald-500/20', text: 'text-emerald-300', dot: 'bg-emerald-400', hexBg: 'bg-emerald-900/60 text-emerald-200 ring-1 ring-emerald-500/50' },
  { border: 'border-amber-500', bg: 'bg-amber-500/20', text: 'text-amber-300', dot: 'bg-amber-400', hexBg: 'bg-amber-900/60 text-amber-200 ring-1 ring-amber-500/50' },
  { border: 'border-purple-500', bg: 'bg-purple-500/20', text: 'text-purple-300', dot: 'bg-purple-400', hexBg: 'bg-purple-900/60 text-purple-200 ring-1 ring-purple-500/50' },
  { border: 'border-rose-500', bg: 'bg-rose-500/20', text: 'text-rose-300', dot: 'bg-rose-400', hexBg: 'bg-rose-900/60 text-rose-200 ring-1 ring-rose-500/50' },
  { border: 'border-blue-500', bg: 'bg-blue-500/20', text: 'text-blue-300', dot: 'bg-blue-400', hexBg: 'bg-blue-900/60 text-blue-200 ring-1 ring-blue-500/50' },
  { border: 'border-indigo-500', bg: 'bg-indigo-500/20', text: 'text-indigo-300', dot: 'bg-indigo-400', hexBg: 'bg-indigo-900/60 text-indigo-200 ring-1 ring-indigo-500/50' },
  { border: 'border-lime-500', bg: 'bg-lime-500/20', text: 'text-lime-300', dot: 'bg-lime-400', hexBg: 'bg-lime-900/60 text-lime-200 ring-1 ring-lime-500/50' },
  { border: 'border-teal-500', bg: 'bg-teal-500/20', text: 'text-teal-300', dot: 'bg-teal-400', hexBg: 'bg-teal-900/60 text-teal-200 ring-1 ring-teal-500/50' },
  { border: 'border-fuchsia-500', bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-300', dot: 'bg-fuchsia-400', hexBg: 'bg-fuchsia-900/60 text-fuchsia-200 ring-1 ring-fuchsia-500/50' },
];

export const PRESET_STRUCTS: {
  id: string;
  name: string;
  description: string;
  structName: string;
  fields: StructField[];
}[] = [
  {
    id: 'iot_config',
    name: 'IoT 노드 네트워크 & 센서 설정 (IoT Node Config)',
    description: '매직 헤더, 디바이스 ID, Wi-Fi SSID/비밀번호, 센서 보정 오프셋 및 CRC16 무결성 검증',
    structName: 'IoT_DeviceConfig_t',
    fields: [
      { id: 'f1', name: 'magic_header', type: 'uint16_t', value: '0x55AA', comment: '초기화 판별용 매직키', color: 'border-cyan-500' },
      { id: 'f2', name: 'device_id', type: 'uint32_t', value: '1048576', comment: '고유 식별자', color: 'border-emerald-500' },
      { id: 'f3', name: 'fw_version', type: 'uint16_t', value: '0x0201', comment: '펌웨어 v2.1', color: 'border-amber-500' },
      { id: 'f4', name: 'wifi_ssid', type: 'string', arrayLength: 16, value: 'AVR_Lab_Mesh_01', comment: 'Wi-Fi AP 이름', color: 'border-purple-500' },
      { id: 'f5', name: 'wifi_password', type: 'string', arrayLength: 16, value: 'SecureKey99!#', comment: '네트워크 패스워드', color: 'border-rose-500' },
      { id: 'f6', name: 'calib_offset', type: 'float', value: '3.14159', comment: '온도/ADC 보정 계수', color: 'border-blue-500' },
      { id: 'f7', name: 'sample_rate_sec', type: 'uint16_t', value: '60', comment: '주기(초)', color: 'border-indigo-500' },
      { id: 'f8', name: 'flags', type: 'uint8_t', value: '0x07', comment: '동작 옵션 비트플래그', color: 'border-lime-500' },
      { id: 'f9', name: 'crc16', type: 'uint16_t', value: '0xA1B2', comment: 'EEPROM 데이터 무결성 CRC', color: 'border-fuchsia-500' },
    ]
  },
  {
    id: 'motor_pid',
    name: '모터 제어기 PID 튜닝 파라미터 (Motor PID Controller)',
    description: '비례/적분/미분 이득 상수(Float), 최대 속도 한계(RPM), 방향 반전 플래그',
    structName: 'Motor_PID_Params_t',
    fields: [
      { id: 'm1', name: 'header', type: 'string', arrayLength: 4, value: 'PID1', comment: '헤더 태그', color: 'border-cyan-500' },
      { id: 'm2', name: 'kp', type: 'float', value: '12.45', comment: '비례 제어 이득(Kp)', color: 'border-emerald-500' },
      { id: 'm3', name: 'ki', type: 'float', value: '0.85', comment: '적분 제어 이득(Ki)', color: 'border-amber-500' },
      { id: 'm4', name: 'kd', type: 'float', value: '2.10', comment: '미분 제어 이득(Kd)', color: 'border-purple-500' },
      { id: 'm5', name: 'max_rpm', type: 'uint16_t', value: '3600', comment: '최고 회전속도', color: 'border-rose-500' },
      { id: 'm6', name: 'direction_invert', type: 'bool', value: 'true', comment: '회전 역방향 여부', color: 'border-blue-500' },
      { id: 'm7', name: 'checksum', type: 'uint8_t', value: '0x7E', comment: '1바이트 XOR 체크섬', color: 'border-teal-500' },
    ]
  },
  {
    id: 'ring_buffer_head',
    name: '센서 로깅 링 버퍼 헤더 (Wear-Leveling Ring Buffer Head)',
    description: 'EEPROM 수명 연장을 위한 순환 버퍼 기록 인덱스 및 레코드 카운터',
    structName: 'EEPROM_RingBuffer_Head_t',
    fields: [
      { id: 'r1', name: 'marker', type: 'uint8_t', value: '0xEE', comment: '동기화 바이트', color: 'border-cyan-500' },
      { id: 'r2', name: 'write_index', type: 'uint16_t', value: '24', comment: '현재 기록 인덱스', color: 'border-emerald-500' },
      { id: 'r3', name: 'total_records', type: 'uint32_t', value: '1548', comment: '누적 기록 횟수', color: 'border-amber-500' },
      { id: 'r4', name: 'is_overrun', type: 'bool', value: 'false', comment: '버퍼 순환 오버런 여부', color: 'border-purple-500' },
      { id: 'r5', name: 'reserved', type: 'bytes', arrayLength: 4, value: '00 00 00 00', comment: '향후 확장 예약 바이트', color: 'border-rose-500' },
    ]
  }
];

// Helper: Calculate field size in bytes
export const getFieldSize = (field: StructField): number => {
  switch (field.type) {
    case 'uint8_t':
    case 'int8_t':
    case 'bool':
      return 1;
    case 'uint16_t':
    case 'int16_t':
      return 2;
    case 'uint32_t':
    case 'int32_t':
    case 'float':
      return 4;
    case 'string':
      return Math.max(1, field.arrayLength || 16);
    case 'bytes':
      return Math.max(1, field.arrayLength || 4);
    default:
      return 1;
  }
};

// Helper: Convert field value to array of bytes (little-endian for AVR)
export const fieldValueToBytes = (field: StructField): number[] => {
  const size = getFieldSize(field);
  const bytes = new Array(size).fill(0);

  try {
    const rawVal = field.value.trim();

    if (field.type === 'bool') {
      bytes[0] = (rawVal.toLowerCase() === 'true' || rawVal === '1') ? 1 : 0;
      return bytes;
    }

    if (field.type === 'uint8_t' || field.type === 'int8_t') {
      const num = rawVal.startsWith('0x') || rawVal.startsWith('0X')
        ? parseInt(rawVal, 16)
        : parseInt(rawVal, 10);
      bytes[0] = (isNaN(num) ? 0 : num) & 0xFF;
      return bytes;
    }

    if (field.type === 'uint16_t' || field.type === 'int16_t') {
      const num = rawVal.startsWith('0x') || rawVal.startsWith('0X')
        ? parseInt(rawVal, 16)
        : parseInt(rawVal, 10);
      const safe = isNaN(num) ? 0 : num;
      // Little endian (Low byte first)
      bytes[0] = safe & 0xFF;
      bytes[1] = (safe >> 8) & 0xFF;
      return bytes;
    }

    if (field.type === 'uint32_t' || field.type === 'int32_t') {
      const num = rawVal.startsWith('0x') || rawVal.startsWith('0X')
        ? parseInt(rawVal, 16)
        : parseInt(rawVal, 10);
      const safe = isNaN(num) ? 0 : num;
      // Little endian
      bytes[0] = safe & 0xFF;
      bytes[1] = (safe >> 8) & 0xFF;
      bytes[2] = (safe >> 16) & 0xFF;
      bytes[3] = (safe >>> 24) & 0xFF;
      return bytes;
    }

    if (field.type === 'float') {
      const fVal = parseFloat(rawVal);
      const safeF = isNaN(fVal) ? 0.0 : fVal;
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      // Little-endian true
      view.setFloat32(0, safeF, true);
      const u8 = new Uint8Array(buffer);
      return Array.from(u8);
    }

    if (field.type === 'string') {
      // Null-terminated string padded with 0
      const enc = new TextEncoder();
      const encoded = enc.encode(rawVal);
      for (let i = 0; i < size; i++) {
        if (i < encoded.length) {
          bytes[i] = encoded[i];
        } else {
          bytes[i] = 0; // null terminator or zero padding
        }
      }
      return bytes;
    }

    if (field.type === 'bytes') {
      // Hex space-delimited string, e.g. "AA BB 01 FF"
      const hexTokens = rawVal.replace(/[^0-9a-fA-F]/g, ' ').trim().split(/\s+/);
      for (let i = 0; i < size; i++) {
        if (i < hexTokens.length && hexTokens[i]) {
          bytes[i] = parseInt(hexTokens[i], 16) & 0xFF;
        } else {
          bytes[i] = 0;
        }
      }
      return bytes;
    }
  } catch (err) {
    console.error('Error parsing field value:', err);
  }

  return bytes;
};

export const EepromDataVisualizer: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // EEPROM Capacity in bytes
  // ATmega328P: 1024 Bytes (1 KB)
  // ATmega128: 4096 Bytes (4 KB)
  // ATmega640: 4096 Bytes (4 KB)
  const eepromCapacityBytes = useMemo(() => {
    return currentProfile.eeprom || (selectedMCU === 'atmega328p' ? 1024 : 4096);
  }, [currentProfile.eeprom, selectedMCU]);

  // States
  const [structName, setStructName] = useState<string>('IoT_DeviceConfig_t');
  const [fields, setFields] = useState<StructField[]>(PRESET_STRUCTS[0].fields);
  const [baseOffset, setBaseOffset] = useState<number>(0); // Address in EEPROM where struct starts (default 0x0000)
  const [fillUnusedWith0xFF, setFillUnusedWith0xFF] = useState<boolean>(true); // AVR erased EEPROM default is 0xFF
  const [isPacked, setIsPacked] = useState<boolean>(true); // __attribute__((__packed__))
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [hoveredByteAddr, setHoveredByteAddr] = useState<number | null>(null);
  const [hexViewerPage, setHexViewerPage] = useState<number>(0); // 128 bytes per page
  const [writeFreqPerDay, setWriteFreqPerDay] = useState<number>(24); // Writes per day for wear leveling calculation
  const [wearLevelFactor, setWearLevelFactor] = useState<number>(1); // 1 = Direct overwrite, 10 = 10-slot wear leveling ring buffer
  const [copiedKind, setCopiedKind] = useState<string | null>(null);

  const bytesPerPage = 128; // 8 rows of 16 bytes
  const totalPages = Math.ceil(eepromCapacityBytes / bytesPerPage);

  // Field layout calculation with byte offsets
  const fieldLayout = useMemo(() => {
    let currentOffset = baseOffset;
    return fields.map((field, idx) => {
      const size = getFieldSize(field);
      const start = currentOffset;
      const end = currentOffset + size - 1;
      const rawBytes = fieldValueToBytes(field);
      currentOffset += size;
      const colorScheme = FIELD_COLORS[idx % FIELD_COLORS.length];
      return {
        ...field,
        size,
        startOffset: start,
        endOffset: end,
        bytes: rawBytes,
        colorScheme
      };
    });
  }, [fields, baseOffset]);

  // Total struct size
  const totalStructBytes = useMemo(() => {
    return fieldLayout.reduce((acc, f) => acc + f.size, 0);
  }, [fieldLayout]);

  const endAddress = baseOffset + totalStructBytes - 1;
  const isOverflow = endAddress >= eepromCapacityBytes;
  const utilizationPercent = ((totalStructBytes / eepromCapacityBytes) * 100).toFixed(1);

  // Map each EEPROM byte to its owning field layout info
  const byteToFieldMap = useMemo(() => {
    const map = new Map<number, typeof fieldLayout[0]>();
    fieldLayout.forEach((item) => {
      for (let addr = item.startOffset; addr <= item.endOffset; addr++) {
        map.set(addr, item);
      }
    });
    return map;
  }, [fieldLayout]);

  // Build the full or paged EEPROM memory buffer
  const currentViewStart = hexViewerPage * bytesPerPage;
  const currentViewEnd = Math.min(eepromCapacityBytes, currentViewStart + bytesPerPage);

  const viewBytes = useMemo(() => {
    const list: {
      address: number;
      value: number;
      field?: typeof fieldLayout[0];
      byteInField?: number;
      isModified: boolean;
    }[] = [];

    const defaultVal = fillUnusedWith0xFF ? 0xFF : 0x00;

    for (let addr = currentViewStart; addr < currentViewEnd; addr++) {
      const ownerField = byteToFieldMap.get(addr);
      if (ownerField) {
        const byteIndex = addr - ownerField.startOffset;
        const val = ownerField.bytes[byteIndex] ?? defaultVal;
        list.push({
          address: addr,
          value: val,
          field: ownerField,
          byteInField: byteIndex,
          isModified: true
        });
      } else {
        list.push({
          address: addr,
          value: defaultVal,
          isModified: false
        });
      }
    }
    return list;
  }, [currentViewStart, currentViewEnd, byteToFieldMap, fillUnusedWith0xFF]);

  // Group into 16-byte rows for Hex Dump
  const hexRows = useMemo(() => {
    const rows: {
      rowAddress: number;
      bytes: typeof viewBytes;
    }[] = [];

    for (let i = 0; i < viewBytes.length; i += 16) {
      const slice = viewBytes.slice(i, i + 16);
      rows.push({
        rowAddress: slice[0]?.address ?? 0,
        bytes: slice
      });
    }
    return rows;
  }, [viewBytes]);

  // Wear leveling endurance estimation
  // AVR EEPROM guaranteed write endurance: 100,000 cycles
  const enduranceCalc = useMemo(() => {
    const maxCycles = 100000;
    const effectiveCycles = maxCycles * wearLevelFactor;
    const writesPerYear = writeFreqPerDay * 365.25;
    const yearsExpected = writesPerYear > 0 ? (effectiveCycles / writesPerYear) : 999;
    const daysExpected = writesPerYear > 0 ? (effectiveCycles / writeFreqPerDay) : 999999;

    return {
      maxCycles,
      effectiveCycles,
      writesPerYear,
      yearsExpected: yearsExpected.toFixed(1),
      daysExpected: Math.round(daysExpected)
    };
  }, [writeFreqPerDay, wearLevelFactor]);

  // Generated C/C++ Header & Implementation Code
  const generatedCCode = useMemo(() => {
    const fieldLines = fieldLayout.map((f) => {
      let typeDecl: string = f.type;
      if (f.type === 'string') {
        typeDecl = `char ${f.name}[${f.size}]`;
      } else if (f.type === 'bytes') {
        typeDecl = `uint8_t ${f.name}[${f.size}]`;
      } else {
        typeDecl = `${f.type} ${f.name}`;
      }
      const commentStr = f.comment ? ` // [0x${f.startOffset.toString(16).padStart(4, '0')}..0x${f.endOffset.toString(16).padStart(4, '0')}] (${f.size}B) ${f.comment}` : ` // [Offset 0x${f.startOffset.toString(16).padStart(4, '0')}]`;
      return `    ${typeDecl};${commentStr}`;
    }).join('\n');

    const initLines = fieldLayout.map((f) => {
      let initVal = f.value;
      if (f.type === 'string') {
        initVal = `"${f.value}"`;
      } else if (f.type === 'bytes') {
        const byteList = f.bytes.map((b) => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`).join(', ');
        initVal = `{ ${byteList} }`;
      } else if (f.type === 'bool') {
        initVal = f.value.toLowerCase() === 'true' ? 'true' : 'false';
      }
      return `    .${f.name} = ${initVal}`;
    }).join(',\n');

    const packedAttr = isPacked ? ' __attribute__((__packed__))' : '';

    return `// ========================================================
// [${currentProfile.name}] EEPROM 데이터 구조체 정의 및 입출력 루틴
// EEPROM 용량: ${eepromCapacityBytes.toLocaleString()} 바이트 | 구조체 크기: ${totalStructBytes} 바이트
// 베이스 시작 주소: 0x${baseOffset.toString(16).toUpperCase().padStart(4, '0')}
// ========================================================
#include <avr/io.h>
#include <avr/eeprom.h>
#include <stdbool.h>
#include <stdint.h>

#define EEPROM_BASE_ADDR ((void*)0x${baseOffset.toString(16).toUpperCase().padStart(4, '0')})

typedef struct${packedAttr} {
${fieldLines}
} ${structName};

// 기본 출하(Factory Default) 인스턴스
const ${structName} factory_default_${structName} = {
${initLines}
};

// 1. EEPROM 전체 구조체 읽기
void EEPROM_Read_Config(${structName} *dest) {
    eeprom_read_block((void*)dest, EEPROM_BASE_ADDR, sizeof(${structName}));
}

// 2. EEPROM 안전 쓰기 (값이 변경된 바이트만 갱신하여 10만회 수명 보호)
void EEPROM_Save_Config(const ${structName} *src) {
    eeprom_update_block((const void*)src, EEPROM_BASE_ADDR, sizeof(${structName}));
}

// 3. 무결성 확인 및 공장 초기화
void EEPROM_Verify_Or_FactoryReset(${structName} *cfg) {
    EEPROM_Read_Config(cfg);
    // 필요 시 magic_header 또는 CRC 검사 후 초기화
    // eeprom_update_block(&factory_default_${structName}, EEPROM_BASE_ADDR, sizeof(${structName}));
}
`;
  }, [currentProfile.name, eepromCapacityBytes, totalStructBytes, baseOffset, fieldLayout, isPacked, structName]);

  // Generated Arduino C++ Code
  const generatedArduinoCode = useMemo(() => {
    return `// ========================================================
// [Arduino 호환] EEPROM.h 기반 get() / put() 스케치 코드
// ========================================================
#include <EEPROM.h>

const int EE_ADDR = 0x${baseOffset.toString(16).toUpperCase().padStart(4, '0')};

void setup() {
    Serial.begin(115200);
    ${structName} myConfig;

    // EEPROM에서 인스턴스 일괄 읽기
    EEPROM.get(EE_ADDR, myConfig);

    // EEPROM.put()은 내부적으로 update()를 수행하여 
    // 기존 데이터와 동일한 바이트는 다시 쓰지 않아 플래시 수명을 보존합니다.
    // EEPROM.put(EE_ADDR, myConfig);
}

void loop() {
}
`;
  }, [baseOffset, structName]);

  // Copy helper
  const handleCopy = (text: string, kind: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKind(kind);
    confetti({
      particleCount: 25,
      spread: 60,
      origin: { y: 0.7 }
    });
    setTimeout(() => setCopiedKind(null), 2000);
  };

  // Download raw binary
  const handleDownloadBinary = () => {
    const fullBuffer = new Uint8Array(eepromCapacityBytes);
    fullBuffer.fill(fillUnusedWith0xFF ? 0xFF : 0x00);

    fieldLayout.forEach((item) => {
      item.bytes.forEach((byte, i) => {
        const addr = item.startOffset + i;
        if (addr < eepromCapacityBytes) {
          fullBuffer[addr] = byte;
        }
      });
    });

    const blob = new Blob([fullBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedMCU}_eeprom_image_${structName}.bin`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Add new field
  const handleAddField = () => {
    const newId = 'f_' + Date.now().toString(36);
    const newField: StructField = {
      id: newId,
      name: `field_${fields.length + 1}`,
      type: 'uint16_t',
      value: '0',
      comment: '새로운 설정 필드',
      color: FIELD_COLORS[fields.length % FIELD_COLORS.length].border
    };
    setFields([...fields, newField]);
  };

  // Remove field
  const handleRemoveField = (id: string) => {
    if (fields.length <= 1) return;
    setFields(fields.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  // Move field up/down
  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    const newFields = [...fields];
    const temp = newFields[index];
    newFields[index] = newFields[targetIndex];
    newFields[targetIndex] = temp;
    setFields(newFields);
  };

  // Update field property
  const handleUpdateField = (id: string, updates: Partial<StructField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  // Load Preset
  const handleLoadPreset = (presetId: string) => {
    const found = PRESET_STRUCTS.find((p) => p.id === presetId);
    if (!found) return;
    setStructName(found.structName);
    setFields(found.fields);
    setHexViewerPage(0);
    confetti({
      particleCount: 40,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold font-mono">
              <Database className="w-3.5 h-3.5" />
              EEPROM DATA VISUALIZER &amp; HEX INSPECTOR
            </span>
            <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
              {currentProfile.name} • EEPROM {eepromCapacityBytes.toLocaleString()} Bytes (0x0000 ~ 0x{(eepromCapacityBytes - 1).toString(16).toUpperCase().padStart(4, '0')})
            </span>
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-indigo-400" />
            EEPROM 구조체 메모리 맵퍼 &amp; 헥스 덤프 뷰어
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            임베디드 C/C++ 커스텀 구조체(<code className="text-indigo-300">struct</code>)의 각 멤버 변수들이
            {currentProfile.name}의 EEPROM 물리 주소 공간에 어떻게 매핑되는지 바이트 단위로 시각화하고,
            실시간 <strong>Hex-Dump(헥스 덤프)</strong> 뷰어 및 리틀 엔디안(Little-endian) 바이트 정렬을 검증합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleDownloadBinary}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-950/40"
          >
            <Download className="w-4 h-4" />
            .BIN 바이너리 덤프
          </button>
        </div>
      </div>

      {/* Preset Selector & Base Offset Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
        <div className="lg:col-span-8 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mr-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            추천 프리셋:
          </span>
          {PRESET_STRUCTS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleLoadPreset(preset.id)}
              className="px-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-indigo-500/50 hover:bg-slate-850 transition flex items-center gap-1.5"
            >
              <span>{preset.name.split('(')[0].trim()}</span>
            </button>
          ))}
        </div>

        <div className="lg:col-span-4 flex items-center justify-end gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <label className="text-slate-400 font-mono">시작 오프셋:</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1.5 text-slate-500 font-mono text-xs">0x</span>
              <input
                type="text"
                value={baseOffset.toString(16).toUpperCase()}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 16);
                  if (!isNaN(val) && val >= 0 && val < eepromCapacityBytes) {
                    setBaseOffset(val);
                  }
                }}
                className="w-20 pl-7 pr-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 select-none">
            <input
              type="checkbox"
              checked={fillUnusedWith0xFF}
              onChange={(e) => setFillUnusedWith0xFF(e.target.checked)}
              className="rounded border-slate-800 text-indigo-500 focus:ring-indigo-500 bg-slate-900"
            />
            <span className="text-[11px] font-mono">공백 0xFF 채움</span>
          </label>
        </div>
      </div>

      {/* Capacity & Memory Allocation Status Bar */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
            <span className="font-semibold text-slate-200">구조체 이름:</span>
            <input
              type="text"
              value={structName}
              onChange={(e) => setStructName(e.target.value)}
              className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-indigo-300 font-mono font-bold text-xs focus:outline-none focus:border-indigo-500"
            />
            <span className="text-slate-400 font-mono">
              ({totalStructBytes} Bytes 점유)
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span className="text-indigo-400">
              할당 범위: 0x{baseOffset.toString(16).toUpperCase().padStart(4, '0')} ~ 0x{endAddress.toString(16).toUpperCase().padStart(4, '0')}
            </span>
            <span className="text-emerald-400">
              잔여 용량: {(eepromCapacityBytes - totalStructBytes).toLocaleString()}B ({((1 - totalStructBytes / eepromCapacityBytes) * 100).toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Visual Memory Blocks Bar */}
        <div className="relative w-full h-9 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex">
          {/* Base offset space if > 0 */}
          {baseOffset > 0 && (
            <div
              style={{ width: `${(baseOffset / eepromCapacityBytes) * 100}%` }}
              className="h-full bg-slate-950/80 border-r border-slate-800 flex items-center justify-center text-[10px] text-slate-500 font-mono truncate"
              title={`Reserved Offset: 0x0000 ~ 0x${(baseOffset - 1).toString(16).toUpperCase()}`}
            >
              예약구역
            </div>
          )}

          {/* Struct fields as proportional color segments */}
          {fieldLayout.map((field) => {
            const widthPct = Math.max(0.8, (field.size / eepromCapacityBytes) * 100);
            const isHovered = hoveredFieldId === field.id || selectedFieldId === field.id;
            return (
              <div
                key={field.id}
                style={{ width: `${widthPct}%` }}
                onMouseEnter={() => setHoveredFieldId(field.id)}
                onMouseLeave={() => setHoveredFieldId(null)}
                onClick={() => setSelectedFieldId(selectedFieldId === field.id ? null : field.id)}
                className={`h-full border-r border-slate-900 cursor-pointer transition-all flex items-center justify-center px-1 text-[10px] font-mono select-none truncate ${
                  field.colorScheme.bg
                } ${field.colorScheme.text} ${
                  isHovered ? 'ring-2 ring-white z-10 brightness-125' : 'opacity-90 hover:opacity-100'
                }`}
                title={`${field.name} (${field.type}) - 0x${field.startOffset.toString(16).padStart(4, '0')}..0x${field.endOffset.toString(16).padStart(4, '0')} (${field.size} Bytes)`}
              >
                <span className="truncate font-semibold">{field.name}</span>
              </div>
            );
          })}

          {/* Unused Remaining EEPROM space */}
          <div
            style={{ width: `${Math.max(0, 100 - ((baseOffset + totalStructBytes) / eepromCapacityBytes) * 100)}%` }}
            className="h-full bg-slate-950/50 flex items-center justify-center text-[10px] text-slate-600 font-mono"
          >
            <span className="truncate">미할당 EEPROM ({fillUnusedWith0xFF ? '0xFF' : '0x00'})</span>
          </div>
        </div>

        {/* Status warnings */}
        {isOverflow && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>
              경고: 구조체 끝 주소(0x{endAddress.toString(16).toUpperCase()})가 {currentProfile.name}의 EEPROM 용량({eepromCapacityBytes} 바이트)을 초과했습니다!
            </span>
          </div>
        )}
      </div>

      {/* Main Grid: Left = Struct Builder Table, Right = Hex Dump Viewer */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Struct Definition Table (7 cols) */}
        <div className="xl:col-span-7 space-y-4">
          <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  구조체 필드 편집기 (Struct Builder)
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {fields.length}개 멤버 변수
                </span>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isPacked}
                    onChange={(e) => setIsPacked(e.target.checked)}
                    className="rounded border-slate-800 text-indigo-500 focus:ring-indigo-500 bg-slate-900"
                  />
                  <span className="font-mono text-[11px] text-cyan-300">__packed__</span>
                </label>

                <button
                  onClick={handleAddField}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  필드 추가
                </button>
              </div>
            </div>

            {/* Fields Table */}
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800/80 text-[11px] font-mono">
                    <th className="pb-2 pl-2">오프셋</th>
                    <th className="pb-2">필드명</th>
                    <th className="pb-2">타입</th>
                    <th className="pb-2">크기</th>
                    <th className="pb-2">설정값 (Value)</th>
                    <th className="pb-2 text-right pr-2">조작</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {fieldLayout.map((field, idx) => {
                    const isHovered = hoveredFieldId === field.id || selectedFieldId === field.id;
                    return (
                      <tr
                        key={field.id}
                        onMouseEnter={() => setHoveredFieldId(field.id)}
                        onMouseLeave={() => setHoveredFieldId(null)}
                        className={`transition-colors font-mono ${
                          isHovered ? 'bg-indigo-950/40 text-white' : 'hover:bg-slate-900/40 text-slate-300'
                        }`}
                      >
                        {/* Offset */}
                        <td className="py-2.5 pl-2">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${field.colorScheme.border} ${field.colorScheme.bg} ${field.colorScheme.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${field.colorScheme.dot}`} />
                            0x{field.startOffset.toString(16).toUpperCase().padStart(4, '0')}
                          </span>
                        </td>

                        {/* Name */}
                        <td className="py-2.5 pr-2">
                          <input
                            type="text"
                            value={field.name}
                            onChange={(e) => handleUpdateField(field.id, { name: e.target.value })}
                            className="w-28 sm:w-32 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                          />
                        </td>

                        {/* Type */}
                        <td className="py-2.5 pr-2">
                          <div className="flex items-center gap-1">
                            <select
                              value={field.type}
                              onChange={(e) => {
                                const newType = e.target.value as FieldType;
                                const updates: Partial<StructField> = { type: newType };
                                if (newType === 'string' && !field.arrayLength) updates.arrayLength = 16;
                                if (newType === 'bytes' && !field.arrayLength) updates.arrayLength = 4;
                                handleUpdateField(field.id, updates);
                              }}
                              className="bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-xs text-cyan-300 focus:outline-none focus:border-indigo-500 font-mono"
                            >
                              <option value="uint8_t">uint8_t (1B)</option>
                              <option value="int8_t">int8_t (1B)</option>
                              <option value="uint16_t">uint16_t (2B)</option>
                              <option value="int16_t">int16_t (2B)</option>
                              <option value="uint32_t">uint32_t (4B)</option>
                              <option value="int32_t">int32_t (4B)</option>
                              <option value="float">float (4B)</option>
                              <option value="bool">bool (1B)</option>
                              <option value="string">char[] (문자열)</option>
                              <option value="bytes">uint8_t[] (배열)</option>
                            </select>

                            {(field.type === 'string' || field.type === 'bytes') && (
                              <input
                                type="number"
                                min={1}
                                max={256}
                                value={field.arrayLength || 8}
                                onChange={(e) => handleUpdateField(field.id, { arrayLength: Math.max(1, parseInt(e.target.value) || 1) })}
                                className="w-12 bg-slate-900 border border-slate-800 rounded px-1 py-1 text-xs text-white text-center font-mono"
                                title="배열 길이"
                              />
                            )}
                          </div>
                        </td>

                        {/* Size */}
                        <td className="py-2.5 pr-2 text-slate-400 font-mono text-[11px]">
                          {field.size}B
                        </td>

                        {/* Value */}
                        <td className="py-2.5 pr-2">
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) => handleUpdateField(field.id, { value: e.target.value })}
                            className="w-32 sm:w-40 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-amber-300 focus:outline-none focus:border-indigo-500 font-mono"
                            placeholder="값 입력..."
                          />
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 pr-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleMoveField(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-20"
                              title="위로 이동"
                            >
                              <MoveUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleMoveField(idx, 'down')}
                              disabled={idx === fields.length - 1}
                              className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-20"
                              title="아래로 이동"
                            >
                              <MoveDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemoveField(field.id)}
                              disabled={fields.length <= 1}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 disabled:opacity-20"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Field breakdown tooltip info */}
            {hoveredFieldId && (() => {
              const active = fieldLayout.find((f) => f.id === hoveredFieldId);
              if (!active) return null;
              return (
                <div className="p-3 rounded-xl bg-slate-900 border border-indigo-500/40 text-xs flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white font-mono">{active.name}</span>
                    <span className="text-slate-400">({active.type}, {active.size}바이트)</span>
                  </div>
                  <div className="font-mono text-cyan-300">
                    바이트 열 (Little-Endian):{' '}
                    {active.bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Right Column: Hex-Dump Style Viewer (5 cols) */}
        <div className="xl:col-span-5 space-y-4">
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  EEPROM 헥스 덤프 뷰어 (Hex-Dump)
                </span>
              </div>

              {/* Page Controls */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <button
                  onClick={() => setHexViewerPage((prev) => Math.max(0, prev - 1))}
                  disabled={hexViewerPage === 0}
                  className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30"
                  title="이전 128바이트"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] text-slate-400">
                  {hexViewerPage + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setHexViewerPage((prev) => Math.min(totalPages - 1, prev + 1))}
                  disabled={hexViewerPage >= totalPages - 1}
                  className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30"
                  title="다음 128바이트"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Hex Dump Table */}
            <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 overflow-x-auto font-mono text-[11px] leading-relaxed custom-scrollbar">
              <div className="text-slate-500 border-b border-slate-800 pb-1 mb-1.5 flex justify-between select-none">
                <span>Offset(h)  00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F  ASCII</span>
              </div>

              <div className="space-y-1">
                {hexRows.map((row) => {
                  const offsetStr = row.rowAddress.toString(16).toUpperCase().padStart(8, '0');
                  const firstHalf = row.bytes.slice(0, 8);
                  const secondHalf = row.bytes.slice(8, 16);

                  const renderByte = (b: typeof viewBytes[0]) => {
                    const isHovered = hoveredByteAddr === b.address || (hoveredFieldId && b.field?.id === hoveredFieldId) || (selectedFieldId && b.field?.id === selectedFieldId);
                    const hexStr = b.value.toString(16).toUpperCase().padStart(2, '0');

                    let colorClass = 'text-slate-500';
                    if (b.field) {
                      colorClass = isHovered
                        ? 'bg-white text-slate-950 font-bold rounded ring-1 ring-white'
                        : b.field.colorScheme.hexBg;
                    } else if (fillUnusedWith0xFF) {
                      colorClass = 'text-slate-600';
                    }

                    return (
                      <span
                        key={b.address}
                        onMouseEnter={() => {
                          setHoveredByteAddr(b.address);
                          if (b.field) setHoveredFieldId(b.field.id);
                        }}
                        onMouseLeave={() => {
                          setHoveredByteAddr(null);
                          setHoveredFieldId(null);
                        }}
                        className={`inline-block px-0.5 cursor-pointer transition select-all ${colorClass}`}
                        title={
                          b.field
                            ? `Addr 0x${b.address.toString(16).toUpperCase().padStart(4, '0')}: ${b.field.name}[${b.byteInField}] = 0x${hexStr} (${b.value}, '${b.value >= 32 && b.value <= 126 ? String.fromCharCode(b.value) : '.'}')`
                            : `Addr 0x${b.address.toString(16).toUpperCase().padStart(4, '0')}: 미할당 (0x${hexStr})`
                        }
                      >
                        {hexStr}
                      </span>
                    );
                  };

                  const asciiStr = row.bytes.map((b) => {
                    if (b.value >= 32 && b.value <= 126) {
                      return String.fromCharCode(b.value);
                    }
                    return '.';
                  }).join('');

                  return (
                    <div key={row.rowAddress} className="flex items-center gap-2 whitespace-nowrap">
                      {/* Offset */}
                      <span className="text-cyan-500/80 font-bold select-none">{offsetStr}</span>

                      {/* 8 Bytes */}
                      <div className="flex gap-1">
                        {firstHalf.map(renderByte)}
                      </div>

                      <span className="text-slate-700 select-none">-</span>

                      {/* 8 Bytes */}
                      <div className="flex gap-1">
                        {secondHalf.map(renderByte)}
                      </div>

                      <span className="text-slate-700 select-none">|</span>

                      {/* ASCII */}
                      <span className="text-emerald-400 tracking-wider select-all">{asciiStr}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hovered Byte Inspector Card */}
            {hoveredByteAddr !== null ? (() => {
              const target = viewBytes.find((b) => b.address === hoveredByteAddr);
              if (!target) return null;
              return (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>선택 주소: <strong className="text-cyan-400">0x{target.address.toString(16).toUpperCase().padStart(4, '0')}</strong></span>
                    <span>값: <strong className="text-emerald-400">0x{target.value.toString(16).toUpperCase().padStart(2, '0')}</strong> ({target.value} Dec, &apos;{target.value >= 32 && target.value <= 126 ? String.fromCharCode(target.value) : '.'}&apos;)</span>
                  </div>
                  {target.field ? (
                    <div className="text-slate-400 text-[11px]">
                      매핑 필드: <span className="text-amber-400 font-bold">{target.field.name}</span> (타입: {target.field.type}, 오프셋 인덱스: +{target.byteInField})
                    </div>
                  ) : (
                    <div className="text-slate-500 text-[11px]">
                      미할당 EEPROM 기본값 (출하 0xFF 상태)
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-500 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span>헥스 덤프의 특정 바이트 위에 마우스를 올리면 해당 구조체 멤버와 리틀 엔디안 인덱스가 표시됩니다.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EEPROM Endurance & Wear-Leveling Advisor */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-5 rounded-2xl border border-indigo-500/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              EEPROM 수명(10만회 쓰기 보장) &amp; 웨어 레벨링(Wear-Leveling) 분석기
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-800/50">
            예상 수명: 약 {enduranceCalc.yearsExpected} 년 ({enduranceCalc.daysExpected.toLocaleString()} 일)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {/* Write frequency */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
            <label className="text-slate-400 block font-medium">일일 EEPROM 쓰기 횟수:</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={100000}
                value={writeFreqPerDay}
                onChange={(e) => setWriteFreqPerDay(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
              <span className="text-slate-500 text-[11px]">회 / 일</span>
            </div>
            <p className="text-[10px] text-slate-500">예: 1시간에 1회 저장 = 24회/일</p>
          </div>

          {/* Wear Leveling Factor */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
            <label className="text-slate-400 block font-medium">웨어 레벨링 분산 슬롯 수:</label>
            <select
              value={wearLevelFactor}
              onChange={(e) => setWearLevelFactor(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            >
              <option value={1}>1 (동일 주소 반복 덮어쓰기 - 기본)</option>
              <option value={4}>4 슬롯 순환 버퍼 (수명 4배 증가)</option>
              <option value={8}>8 슬롯 순환 버퍼 (수명 8배 증가)</option>
              <option value={16}>16 슬롯 순환 버퍼 (수명 16배 증가)</option>
              <option value={32}>32 슬롯 순환 버퍼 (수명 32배 증가)</option>
            </select>
            <p className="text-[10px] text-slate-500">링 버퍼 구조를 사용하면 쓰기 횟수가 분산됩니다.</p>
          </div>

          {/* Golden Rule Tip */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
            <span className="text-amber-400 font-bold block flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              핵심 최적화 권장안
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <code className="text-cyan-300 bg-slate-900 px-1 rounded">eeprom_write_block()</code> 대신 반드시 <code className="text-emerald-300 bg-slate-900 px-1 rounded">eeprom_update_block()</code> 또는 Arduino <code className="text-emerald-300 bg-slate-900 px-1 rounded">EEPROM.update()</code>를 사용하여 기존 값과 달라진 바이트만 기록하세요.
            </p>
          </div>
        </div>
      </div>

      {/* Code Generation Section (AVR C Code & Arduino Code) */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              자동 생성된 C/C++ 펌웨어 소스코드
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(generatedCCode, 'c_code')}
              className="flex items-center gap-1 text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-900 text-xs transition border border-slate-800"
            >
              {copiedKind === 'c_code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              AVR-C 코드 복사
            </button>
            <button
              onClick={() => handleCopy(generatedArduinoCode, 'arduino_code')}
              className="flex items-center gap-1 text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-900 text-xs transition border border-slate-800"
            >
              {copiedKind === 'arduino_code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              Arduino 코드 복사
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1">
              <span>AVR-Libc (&lt;avr/eeprom.h&gt;) 네이티브 C 헤더</span>
              <span className="text-cyan-400">구조체 &amp; update_block</span>
            </div>
            <pre className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64 custom-scrollbar">
              {generatedCCode}
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1">
              <span>Arduino (&lt;EEPROM.h&gt;) C++ 스케치</span>
              <span className="text-emerald-400">EEPROM.get() / put()</span>
            </div>
            <pre className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64 custom-scrollbar">
              {generatedArduinoCode}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
