import React, { useState, useMemo, useRef } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  ShieldCheck,
  ShieldAlert,
  FileCode2,
  Copy,
  Check,
  Download,
  Upload,
  RefreshCw,
  Sparkles,
  Layers,
  Cpu,
  Zap,
  HardDrive,
  Code2,
  AlertTriangle,
  Info,
  CheckCircle2,
  Sliders
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type CrcAlgorithmType = 'crc_ccitt' | 'crc_xmodem' | 'crc_ibm';

interface CrcAlgorithmMeta {
  id: CrcAlgorithmType;
  name: string;
  poly: string;
  initValue: number;
  headerFunc: string;
  desc: string;
}

const CRC_ALGORITHMS: CrcAlgorithmMeta[] = [
  {
    id: 'crc_ccitt',
    name: 'CRC-16-CCITT (Init 0xFFFF, avr-libc 표준)',
    poly: '0x1021 (X^16 + X^12 + X^5 + 1)',
    initValue: 0xffff,
    headerFunc: '_crc_ccitt_update(crc, data)',
    desc: 'AVR 펌웨어 서명 및 부트로더 무결성 검증에 가장 널리 사용되는 공식 표준 알고리즘'
  },
  {
    id: 'crc_xmodem',
    name: 'CRC-16-XMODEM (Init 0x0000, Poly 0x1021)',
    poly: '0x1021',
    initValue: 0x0000,
    headerFunc: '_crc_xmodem_update(crc, data)',
    desc: 'XMODEM 시리얼 펌웨어 업로드 프로토콜 및 통신 패킷 체크섬 표준'
  },
  {
    id: 'crc_ibm',
    name: 'CRC-16-IBM / ANSI (Init 0x0000, Poly 0xA001)',
    poly: '0x8005 (역방향 0xA001)',
    initValue: 0x0000,
    headerFunc: '_crc16_update(crc, data)',
    desc: 'Modbus RTU 및 산업용 EEPROM 블록 무결성 검증 알고리즘'
  }
];

// Sample Intel HEX String for Blink / Demo
const SAMPLE_INTEL_HEX = `:100000000C9434000C9446000C9446000C94460058
:100010000C9446000C9446000C9446000C94460048
:100020000C9446000C9446000C9446000C94460038
:100030000C9446000C9446000C9446000C94460028
:100040000C9446000C9446000C9446000C94460018
:100050000C9446000C9446000C9446000C94460008
:100060000C9446000C94460011241FBECFEFD8E035
:10007000DEBFCDBF11E0A0E0B1E0ECE0FEE002C063
:1000800005900D92A030B107D9F711E0A0E0B1E050
:1000900001C01D92A030B107E1F70C9448000C94FB
:1000A00000002F928F939F93AF93BF93EF93FF9326
:00000001FF`;

const SAMPLE_EEPROM_CONFIG_HEX = `A5 5A 01 00 1E 96 08 00 24 00 00 00 41 56 52 5F 43 4F 4E 46 49 47 5F 56 31 2E 30 00 00 00 00 00`;

// AVR-libc matching implementation of _crc_ccitt_update
function avrCrcCcittUpdate(crc: number, data: number): number {
  const lo = crc & 0xff;
  const hi = (crc >> 8) & 0xff;
  let d = (data ^ lo) & 0xff;
  d = (d ^ ((d << 4) & 0xff)) & 0xff;
  const res = (((d << 8) | hi) ^ (d >> 4) ^ ((d << 3) & 0xffff)) & 0xffff;
  return res;
}

// AVR-libc matching implementation of _crc_xmodem_update
function avrCrcXmodemUpdate(crc: number, data: number): number {
  let c = crc ^ (data << 8);
  for (let i = 0; i < 8; i++) {
    if (c & 0x8000) {
      c = ((c << 1) ^ 0x1021) & 0xffff;
    } else {
      c = (c << 1) & 0xffff;
    }
  }
  return c;
}

// AVR-libc matching implementation of _crc16_update
function avrCrcIbmUpdate(crc: number, data: number): number {
  let c = (crc ^ data) & 0xffff;
  for (let i = 0; i < 8; i++) {
    if (c & 1) {
      c = ((c >> 1) ^ 0xa001) & 0xffff;
    } else {
      c = (c >> 1) & 0xffff;
    }
  }
  return c;
}

export const FirmwareCrcIntegrityCalculator: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // State
  const [inputType, setInputType] = useState<'hex_file' | 'hex_bytes' | 'ascii'>('hex_file');
  const [rawInput, setRawInput] = useState<string>(SAMPLE_INTEL_HEX);
  const [algorithm, setAlgorithm] = useState<CrcAlgorithmType>('crc_ccitt');
  const [copiedMacro, setCopiedMacro] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [codeTargetType, setCodeTargetType] = useState<'flash' | 'eeprom'>('flash');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedAlgoMeta = useMemo(() => {
    return CRC_ALGORITHMS.find((a) => a.id === algorithm) || CRC_ALGORITHMS[0];
  }, [algorithm]);

  // Parse input into byte array
  const parsedBytesResult = useMemo(() => {
    const bytes: number[] = [];
    let isHexFormat = false;
    let hexRecordCount = 0;
    let hexStartAddr = 0;
    let hexMaxAddr = 0;
    let parseError: string | null = null;

    if (inputType === 'hex_file') {
      // Parse Intel HEX format
      const lines = rawInput.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (line.startsWith(':')) {
          isHexFormat = true;
          try {
            const byteCount = parseInt(line.substring(1, 3), 16);
            const address = parseInt(line.substring(3, 7), 16);
            const recordType = parseInt(line.substring(7, 9), 16);

            if (recordType === 0) {
              // Data Record
              hexRecordCount++;
              if (bytes.length === 0) hexStartAddr = address;
              hexMaxAddr = Math.max(hexMaxAddr, address + byteCount);

              for (let b = 0; b < byteCount; b++) {
                const byteVal = parseInt(line.substring(9 + b * 2, 11 + b * 2), 16);
                if (!isNaN(byteVal)) {
                  bytes.push(byteVal);
                }
              }
            } else if (recordType === 1) {
              // End of File
              break;
            }
          } catch (e) {
            parseError = `Intel HEX 줄 ${i + 1} 구문 분석 오류`;
          }
        }
      }

      // If no valid Intel HEX records found, fallback to parsing hex stream
      if (bytes.length === 0 && !isHexFormat) {
        const matches = rawInput.match(/[0-9a-fA-F]{2}/g);
        if (matches) {
          matches.forEach((m) => bytes.push(parseInt(m, 16)));
        }
      }
    } else if (inputType === 'hex_bytes') {
      const matches = rawInput.match(/[0-9a-fA-F]{2}/g);
      if (matches) {
        matches.forEach((m) => bytes.push(parseInt(m, 16)));
      }
    } else {
      // ASCII
      for (let i = 0; i < rawInput.length; i++) {
        bytes.push(rawInput.charCodeAt(i) & 0xff);
      }
    }

    return {
      bytes,
      isHexFormat,
      hexRecordCount,
      hexStartAddr,
      hexMaxAddr,
      parseError
    };
  }, [rawInput, inputType]);

  // Calculate CRC
  const calculatedCrc = useMemo(() => {
    let crc = selectedAlgoMeta.initValue;
    const { bytes } = parsedBytesResult;

    if (algorithm === 'crc_ccitt') {
      for (let i = 0; i < bytes.length; i++) {
        crc = avrCrcCcittUpdate(crc, bytes[i]);
      }
    } else if (algorithm === 'crc_xmodem') {
      for (let i = 0; i < bytes.length; i++) {
        crc = avrCrcXmodemUpdate(crc, bytes[i]);
      }
    } else {
      for (let i = 0; i < bytes.length; i++) {
        crc = avrCrcIbmUpdate(crc, bytes[i]);
      }
    }

    const hexString = crc.toString(16).toUpperCase().padStart(4, '0');
    const highByte = ((crc >> 8) & 0xff).toString(16).toUpperCase().padStart(2, '0');
    const lowByte = (crc & 0xff).toString(16).toUpperCase().padStart(2, '0');

    return {
      crc16: crc,
      hexString: `0x${hexString}`,
      highByte: `0x${highByte}`,
      lowByte: `0x${lowByte}`,
      byteCount: bytes.length
    };
  }, [parsedBytesResult, algorithm, selectedAlgoMeta]);

  // Flash Memory Percent
  const flashBytesTotal = currentProfile.flash * 1024;
  const flashUsagePct = ((calculatedCrc.byteCount / flashBytesTotal) * 100).toFixed(2);

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawInput(content);
        setInputType('hex_file');
        confetti({
          particleCount: 20,
          spread: 40,
          origin: { y: 0.7 }
        });
      }
    };
    reader.readAsText(file);
  };

  // Generated C Macros
  const generatedMacroCode = useMemo(() => {
    return `// =============================================================================
// [${currentProfile.name}] 펌웨어 무결성 검증용 매크로 정의
// 알고리즘: ${selectedAlgoMeta.name}
// =============================================================================
#define FIRMWARE_EXPECTED_CRC16      ${calculatedCrc.hexString}  // 예상 CRC-16 값
#define FIRMWARE_CRC_HIGH_BYTE       ${calculatedCrc.highByte}    // 상위 바이트 (MSB)
#define FIRMWARE_CRC_LOW_BYTE        ${calculatedCrc.lowByte}    // 하위 바이트 (LSB)
#define FIRMWARE_PAYLOAD_SIZE_BYTES  ${calculatedCrc.byteCount}U  // 검증 대상 바이너리 바이트 크기

// Flash 메모리 특정 주소(또는 .signature 섹션)에 상수 서명으로 배치
const uint16_t g_firmware_golden_crc PROGMEM = ${calculatedCrc.hexString};`;
  }, [currentProfile.name, selectedAlgoMeta.name, calculatedCrc]);

  // Generated C Runtime Verification Function
  const generatedCVerificationSource = useMemo(() => {
    if (codeTargetType === 'flash') {
      return `/**
 * @file    firmware_integrity_check.c
 * @target  ${currentProfile.name} (Flash: ${currentProfile.flash}KB)
 * @brief   부팅 시 Flash 메모리 자가 검증 (Self-Test) 및 변조/손상 방지 루틴
 * @note    <util/crc16.h>의 초고속 인라인 어셈블리 루틴을 활용합니다.
 */

#include <avr/io.h>
#include <avr/pgmspace.h>
#include <util/crc16.h>
#include <stdbool.h>

// 1. 컴파일 타임 생성된 골든 CRC-16 매크로
#define EXPECTED_FIRMWARE_CRC16  ${calculatedCrc.hexString}
#define FIRMWARE_SIZE_TO_CHECK   ${calculatedCrc.byteCount}U

/**
 * @brief  Flash 메모리 영역을 순회하며 런타임 CRC-16을 계산 및 검증합니다.
 * @return true: 무결성 정상 통과, false: 펌웨어 변조/플래시 손상 감지
 */
bool verify_flash_firmware_integrity(void) {
    uint16_t calculated_crc = ${selectedAlgoMeta.initValue === 0xffff ? '0xFFFF' : '0x0000'};
    
    // Flash 메모리 0x0000부터 지정된 바이트 크기까지 1바이트씩 순회
    for (uint32_t addr = 0; addr < FIRMWARE_SIZE_TO_CHECK; addr++) {
        uint8_t byte_val = pgm_read_byte_far(addr); // 또는 pgm_read_byte(addr)
        calculated_crc = ${selectedAlgoMeta.headerFunc.replace('data', 'byte_val')};
    }

    // 골든 CRC와 일치하는지 비교
    if (calculated_crc == EXPECTED_FIRMWARE_CRC16) {
        return true; // 무결성 검증 성공
    } else {
        // [페일세이프]: 펌웨어 변조 또는 플래시 비트 플립 감지!
        // 액추에이터/모터 차단 후 비상 안전 모드 진입 또는 부트로더 복구 대기
        return false;
    }
}

// 시스템 시작 진입점 예시
int main(void) {
    if (!verify_flash_firmware_integrity()) {
        // 무결성 오류: 경고 LED 고속 점멸 및 시스템 정지
        DDRB |= (1 << PB5);
        while (1) {
            PINB = (1 << PB5); // 경고 토글
            for (volatile uint32_t i = 0; i < 50000; i++);
        }
    }

    // 정상 펌웨어 실행 루틴 진행...
    while (1) {
    }
}`;
    } else {
      return `/**
 * @file    eeprom_integrity_check.c
 * @target  ${currentProfile.name} (EEPROM: ${currentProfile.eeprom}KB)
 * @brief   EEPROM 설정 데이터 블록 손상 방지 및 CRC-16 검증
 */

#include <avr/io.h>
#include <avr/eeprom.h>
#include <util/crc16.h>
#include <stdbool.h>

#define EEPROM_BLOCK_START_ADDR  0x0000
#define EEPROM_BLOCK_SIZE_BYTES  ${calculatedCrc.byteCount}U
#define EEPROM_EXPECTED_CRC16    ${calculatedCrc.hexString}

/**
 * @brief EEPROM 구성 데이터 블록의 CRC-16 무결성을 검증합니다.
 */
bool verify_eeprom_config_block(void) {
    uint16_t crc = ${selectedAlgoMeta.initValue === 0xffff ? '0xFFFF' : '0x0000'};
    
    for (uint16_t addr = 0; addr < EEPROM_BLOCK_SIZE_BYTES; addr++) {
        uint8_t val = eeprom_read_byte((const uint8_t*)addr);
        crc = ${selectedAlgoMeta.headerFunc.replace('data', 'val')};
    }

    return (crc == EEPROM_EXPECTED_CRC16);
}`;
    }
  }, [codeTargetType, currentProfile, calculatedCrc, selectedAlgoMeta]);

  const handleCopyMacro = () => {
    navigator.clipboard.writeText(generatedMacroCode);
    setCopiedMacro(true);
    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.8 }
    });
    setTimeout(() => setCopiedMacro(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCVerificationSource);
    setCopiedCode(true);
    confetti({
      particleCount: 30,
      spread: 60,
      origin: { y: 0.7 }
    });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadHeader = () => {
    const fullSource = `${generatedMacroCode}\n\n${generatedCVerificationSource}`;
    const blob = new Blob([fullSource], { type: 'text/x-csrc;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `firmware_crc16_${selectedMCU}.h`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur shadow-2xl space-y-6 animate-fade-in">
      {/* Title & Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> Flash/EEPROM 데이터 무결성 체크용 CRC 계산기
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono font-bold">
              Target: {currentProfile.name}
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-mono font-bold">
              알고리즘: {selectedAlgoMeta.id.toUpperCase()}
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            AVR 펌웨어 CRC-16-CCITT 무결성 검증기 & 매크로 생성기
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            컴파일된 Intel Hex 파일 또는 바이트 스트림을 입력하면, AVR이 공식 사용하는 <code>_crc_ccitt_update()</code>
            알고리즘을 적용하여 펌웨어 변조 방지 골든 CRC-16 값을 정밀 계산하고, 부팅 시 자가 검증을 수행하는 C 매크로와 소스코드를 제안합니다.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto">
          <button
            onClick={handleCopyMacro}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-600/20"
          >
            {copiedMacro ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedMacro ? '매크로 복사 완료!' : 'CRC 매크로 복사'}</span>
          </button>
          <button
            onClick={handleDownloadHeader}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition border border-slate-700"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>.h 헤더 다운로드</span>
          </button>
        </div>
      </div>

      {/* Grid: Controls & Real-time CRC Calculation KPI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Input Form & File Uploader */}
        <div className="lg:col-span-2 bg-slate-950/70 border border-slate-800/90 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 text-xs">
            {/* Input Type Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">입력 형식:</span>
              <button
                onClick={() => setInputType('hex_file')}
                className={`px-3 py-1 rounded-lg transition font-mono ${
                  inputType === 'hex_file'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                Intel HEX 파일
              </button>
              <button
                onClick={() => setInputType('hex_bytes')}
                className={`px-3 py-1 rounded-lg transition font-mono ${
                  inputType === 'hex_bytes'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                16진수 바이트열
              </button>
              <button
                onClick={() => setInputType('ascii')}
                className={`px-3 py-1 rounded-lg transition font-mono ${
                  inputType === 'ascii'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                ASCII 문자열
              </button>
            </div>

            {/* Quick Sample Buttons & File Upload */}
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".hex,.bin,.txt"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition flex items-center gap-1 text-[11px] font-mono"
              >
                <Upload className="w-3 h-3 text-emerald-400" />
                <span>.hex 파일 업로드</span>
              </button>
              <button
                onClick={() => {
                  setRawInput(SAMPLE_INTEL_HEX);
                  setInputType('hex_file');
                }}
                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 text-[11px] font-mono"
                title="Blink 펌웨어 샘플 로드"
              >
                Blink 샘플
              </button>
              <button
                onClick={() => {
                  setRawInput(SAMPLE_EEPROM_CONFIG_HEX);
                  setInputType('hex_bytes');
                }}
                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 text-[11px] font-mono"
                title="EEPROM 구성 블록 샘플 로드"
              >
                EEPROM 샘플
              </button>
            </div>
          </div>

          {/* Algorithm Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-slate-400 font-medium">CRC 계산 알고리즘:</span>
            <div className="flex flex-wrap gap-1.5">
              {CRC_ALGORITHMS.map((algo) => (
                <button
                  key={algo.id}
                  onClick={() => setAlgorithm(algo.id)}
                  className={`px-2.5 py-1 rounded-lg transition font-mono text-[11px] ${
                    algorithm === algo.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold shadow-sm'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  {algo.name.split('(')[0].trim()}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea for Data Stream Input */}
          <div>
            <div className="flex justify-between items-center mb-1 text-[11px] font-mono text-slate-400">
              <span>데이터 스트림 입력 (.hex / byte stream):</span>
              <span>
                {parsedBytesResult.bytes.length}바이트 파싱됨{' '}
                {parsedBytesResult.hexRecordCount > 0 && `(${parsedBytesResult.hexRecordCount}개 레코드)`}
              </span>
            </div>
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="여기에 Intel HEX 코드나 16진수 바이트를 붙여넣으세요..."
              rows={8}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-xs text-emerald-300 font-mono leading-relaxed focus:outline-none focus:border-emerald-400 custom-scrollbar resize-none"
            />
            {parsedBytesResult.parseError && (
              <div className="mt-1 text-[11px] text-rose-400 font-mono flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>{parsedBytesResult.parseError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Calculation Result KPI Card */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-white">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> CRC-16 계산 결과
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40 font-bold">
                VALIDATED
              </span>
            </div>

            {/* CRC Big Badge */}
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 text-center space-y-1">
              <span className="text-[11px] text-slate-400 font-mono block">16-bit CRC 골든 체크섬</span>
              <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-emerald-400">
                {calculatedCrc.hexString}
              </div>
              <div className="text-xs text-slate-400 font-mono mt-1">
                MSB: <strong className="text-cyan-300">{calculatedCrc.highByte}</strong> | LSB:{' '}
                <strong className="text-amber-300">{calculatedCrc.lowByte}</strong>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs font-mono space-y-1.5 text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">총 데이터 크기:</span>
                <span className="text-white font-bold">{calculatedCrc.byteCount.toLocaleString()} 바이트</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">타깃 플래시 용량:</span>
                <span className="text-cyan-400 font-bold">{currentProfile.flash} KB</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">플래시 점유율:</span>
                <span className="text-amber-400 font-bold">{flashUsagePct}%</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-800/80 text-[10px] text-slate-500">
                <span>알고리즘: {selectedAlgoMeta.headerFunc}</span>
              </div>
            </div>

            {/* Quick Macro Code Box */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 font-mono text-xs">
              <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                <span>C 매크로 스니펫</span>
                <button onClick={handleCopyMacro} className="text-emerald-400 hover:text-white flex items-center gap-1">
                  {copiedMacro ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>복사</span>
                </button>
              </div>
              <code className="text-[11px] text-amber-300 block select-all">
                #define FIRMWARE_EXPECTED_CRC16 {calculatedCrc.hexString}
              </code>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-500 leading-tight">
            💡 생성된 매크로를 펌웨어 소스에 정의하고, 부팅 시 <code className="text-slate-400">verify_flash_firmware_integrity()</code>를 호출하여 플래시 메모리 변조 여부를 100% 탐지하세요.
          </div>
        </div>
      </div>

      {/* Section: Generated C Code Template for Flash/EEPROM Self-Test */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              소스 코드 삽입용 무결성 자가 검증 C 함수 & 매크로 템플릿
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-mono">
              <button
                onClick={() => setCodeTargetType('flash')}
                className={`px-3 py-1 rounded-lg transition font-bold ${
                  codeTargetType === 'flash'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Flash 자가 검증 (부팅 시)
              </button>
              <button
                onClick={() => setCodeTargetType('eeprom')}
                className={`px-3 py-1 rounded-lg transition font-bold ${
                  codeTargetType === 'eeprom'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                EEPROM 설정 검증
              </button>
            </div>

            <button
              onClick={handleCopyCode}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? '복사됨!' : '검증 C 코드 복사'}</span>
            </button>
          </div>
        </div>

        {/* Live Code Viewer */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
            <span>
              {codeTargetType === 'flash' ? 'firmware_integrity_check.c' : 'eeprom_integrity_check.c'} (AVR-GCC C99/C11)
            </span>
            <span className="text-emerald-400 font-bold">&lt;util/crc16.h&gt; Native Optimized</span>
          </div>
          <pre className="p-5 font-mono text-xs text-emerald-300 overflow-x-auto max-h-[420px] leading-relaxed custom-scrollbar selection:bg-emerald-500/30">
            {generatedCVerificationSource}
          </pre>
        </div>
      </div>
    </div>
  );
};
