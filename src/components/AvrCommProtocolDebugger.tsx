import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Activity,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Download,
  Info,
  Sparkles,
  Zap,
  Cpu,
  Layers,
  ArrowRight,
  Code2,
  Play,
  RotateCcw,
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  Radio,
  FileCode2,
  Terminal,
  Bug,
  Pause,
  Shuffle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type CommProtocol = 'i2c' | 'spi';

// TWI Status Codes
export interface TwiStatusItem {
  codeHex: string;
  codeDec: number;
  macro: string;
  name: string;
  desc: string;
  isError: boolean;
}

const TWI_STATUS_MAP: Record<string, TwiStatusItem> = {
  '0x08': {
    codeHex: '0x08',
    codeDec: 8,
    macro: 'TW_START',
    name: 'START 조건 송신 완료',
    desc: '마스터가 성공적으로 START 조건을 버스에 송신했습니다.',
    isError: false
  },
  '0x10': {
    codeHex: '0x10',
    codeDec: 16,
    macro: 'TW_REP_START',
    name: 'Repeated START 송신 완료',
    desc: '버스 점유를 유지하며 재시작(Sr) 조건을 송신했습니다.',
    isError: false
  },
  '0x18': {
    codeHex: '0x18',
    codeDec: 24,
    macro: 'TW_MT_SLA_ACK',
    name: 'SLA+W 송신 완료 & ACK 수신',
    desc: '슬레이브 주소(Write)를 송신했고 슬레이브가 ACK를 응답했습니다.',
    isError: false
  },
  '0x20': {
    codeHex: '0x20',
    codeDec: 32,
    macro: 'TW_MT_SLA_NACK',
    name: 'SLA+W 송신 완료 & NACK 수신',
    desc: '슬레이브가 응답하지 않거나 준비되지 않아 NACK(High)가 수신되었습니다.',
    isError: true
  },
  '0x28': {
    codeHex: '0x28',
    codeDec: 40,
    macro: 'TW_MT_DATA_ACK',
    name: '데이터 바이트 송신 & ACK 수신',
    desc: '1바이트 데이터 송신 완료 후 슬레이브로부터 정상 ACK 수신.',
    isError: false
  },
  '0x30': {
    codeHex: '0x30',
    codeDec: 48,
    macro: 'TW_MT_DATA_NACK',
    name: '데이터 바이트 송신 & NACK 수신',
    desc: '슬레이브가 더 이상 데이터를 수신할 수 없어 NACK를 응답했습니다.',
    isError: true
  },
  '0x38': {
    codeHex: '0x38',
    codeDec: 56,
    macro: 'TW_MT_ARB_LOST',
    name: '버스 중재 탈취 패배 (Arbitration Lost)',
    desc: '경합 마스터가 동시에 송신 중 SDA=0을 출력하여 본 마스터(SDA=1 출력)가 중재에서 패배했습니다. 버스 소유권 상실!',
    isError: true
  }
};

export const AvrCommProtocolDebugger: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Active Protocol: I2C (TWI) vs SPI
  const [protocol, setProtocol] = useState<CommProtocol>('i2c');

  // MCU Clock
  const [cpuClockMhz, setCpuClockMhz] = useState<number>(16);

  // I2C (TWI) States
  const [twbr, setTwbr] = useState<number>(12); // Bit rate
  const [twps, setTwps] = useState<0 | 1 | 2 | 3>(0); // Prescaler: 0->1, 1->4, 2->16, 3->64
  const [slaveAddrHex, setSlaveAddrHex] = useState<string>('0x68');
  const [rwBit, setRwBit] = useState<0 | 1>(0); // 0=Write, 1=Read
  const [enableGeneralCall, setEnableGeneralCall] = useState<boolean>(false); // TWGCE bit in TWAR
  const [txDataHex, setTxDataHex] = useState<string>('0x5A');

  // Multi-Master Collision Simulation Scenario for I2C
  const [enableArbitrationTest, setEnableArbitrationTest] = useState<boolean>(false);
  const [contenderDataHex, setContenderDataHex] = useState<string>('0x52'); // Contender sends slightly different byte
  const [simStep, setSimStep] = useState<number>(0);
  const [isSimRunning, setIsSimRunning] = useState<boolean>(false);

  // SPI States
  const [spiPrescaler, setSpiPrescaler] = useState<4 | 16 | 64 | 128>(4);
  const [spiDoubleSpeed, setSpiDoubleSpeed] = useState<boolean>(true); // SPI2X
  const [spiCpol, setSpiCpol] = useState<0 | 1>(0);
  const [spiCpha, setSpiCpha] = useState<0 | 1>(0);
  const [spiDord, setSpiDord] = useState<0 | 1>(0); // 0=MSB first, 1=LSB first
  const [spiTxDataHex, setSpiTxDataHex] = useState<string>('0x9F'); // JEDEC ID read command
  const [spiSimCollision, setSpiSimCollision] = useState<'none' | 'wcol' | 'ss_abort'>('none');

  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // ==========================================
  // I2C Math & Register Mapping
  // ==========================================
  const i2cMath = useMemo(() => {
    const fCpuHz = cpuClockMhz * 1_000_000;
    const prescalerVal = Math.pow(4, twps);
    // SCL = F_CPU / (16 + 2 * TWBR * 4^TWPS)
    const sclHz = Math.round(fCpuHz / (16 + 2 * twbr * prescalerVal));
    const sclKhz = (sclHz / 1000).toFixed(1);

    // Target Standard speeds
    const isStandardMode = Math.abs(sclHz - 100_000) < 15_000;
    const isFastMode = Math.abs(sclHz - 400_000) < 30_000;

    // Slave Address parsing
    const addrVal = parseInt(slaveAddrHex.replace('0x', ''), 16) || 0x68;
    const safeAddr7 = addrVal & 0x7f;
    const slarw = (safeAddr7 << 1) | rwBit;

    // TWAR Register: (safeAddr7 << 1) | (enableGeneralCall ? 1 : 0)
    const twarVal = (safeAddr7 << 1) | (enableGeneralCall ? 1 : 0);

    // TWSR Register: (Status & 0xF8) | twps
    // If arbitration lost simulated, status is 0x38, otherwise 0x28 (normal data ACK)
    const isArbLost = enableArbitrationTest && simStep >= 6;
    const activeStatus = isArbLost ? '0x38' : '0x28';
    const statusObj = TWI_STATUS_MAP[activeStatus] || TWI_STATUS_MAP['0x28'];
    const twsrVal = (parseInt(activeStatus, 16) & 0xf8) | twps;

    // TWCR Register value representation:
    // TWINT=1, TWEA=1, TWSTA=0, TWSTO=0, TWWC=0, TWEN=1, TWIE=0 -> 0x84 or 0xC4
    const twcrVal = 0xc4;

    return {
      sclHz,
      sclKhz,
      prescalerVal,
      isStandardMode,
      isFastMode,
      safeAddr7,
      slarw,
      slarwHex: `0x${slarw.toString(16).toUpperCase().padStart(2, '0')}`,
      twarVal,
      twarHex: `0x${twarVal.toString(16).toUpperCase().padStart(2, '0')}`,
      twsrVal,
      twsrHex: `0x${twsrVal.toString(16).toUpperCase().padStart(2, '0')}`,
      twcrHex: `0x${twcrVal.toString(16).toUpperCase().padStart(2, '0')}`,
      twbrHex: `0x${twbr.toString(16).toUpperCase().padStart(2, '0')}`,
      statusObj,
      isArbLost
    };
  }, [cpuClockMhz, twbr, twps, slaveAddrHex, rwBit, enableGeneralCall, enableArbitrationTest, simStep]);

  // Parse Tx Data Bytes
  const txByte = useMemo(() => {
    const val = parseInt(txDataHex.replace('0x', ''), 16);
    return isNaN(val) ? 0x5a : val & 0xff;
  }, [txDataHex]);

  const contenderByte = useMemo(() => {
    const val = parseInt(contenderDataHex.replace('0x', ''), 16);
    return isNaN(val) ? 0x52 : val & 0xff;
  }, [contenderDataHex]);

  // I2C Bit-by-Bit Arbitration Analysis
  const arbitrationBits = useMemo(() => {
    const bits: {
      bitPos: number;
      ourBit: 0 | 1;
      contenderBit: 0 | 1;
      busLineBit: 0 | 1;
      isConflict: boolean;
      lostHere: boolean;
    }[] = [];

    let hasLost = false;
    for (let i = 7; i >= 0; i--) {
      const our = ((txByte >> i) & 1) as 0 | 1;
      const rival = ((contenderByte >> i) & 1) as 0 | 1;
      // Open-drain wire-AND: If anyone pulls low (0), bus is 0!
      const bus = (our === 0 || rival === 0 ? 0 : 1) as 0 | 1;

      // Conflict: We wanted 1 (releasing line), but rival pulled line to 0!
      const conflict = our === 1 && rival === 0;
      const lostHere = conflict && !hasLost;
      if (lostHere) hasLost = true;

      bits.push({
        bitPos: i,
        ourBit: our,
        contenderBit: rival,
        busLineBit: bus,
        isConflict: conflict,
        lostHere
      });
    }

    return {
      bits,
      lostBitIndex: bits.findIndex((b) => b.lostHere)
    };
  }, [txByte, contenderByte]);

  // ==========================================
  // SPI Math & Register Mapping
  // ==========================================
  const spiMath = useMemo(() => {
    const fCpuHz = cpuClockMhz * 1_000_000;
    const effectiveDiv = spiDoubleSpeed ? spiPrescaler / 2 : spiPrescaler;
    const sckHz = fCpuHz / effectiveDiv;
    const sckMhz = (sckHz / 1_000_000).toFixed(2);

    let spr0 = 0;
    let spr1 = 0;
    if (spiPrescaler === 16) spr0 = 1;
    else if (spiPrescaler === 64) spr1 = 1;
    else if (spiPrescaler === 128) {
      spr0 = 1;
      spr1 = 1;
    }

    // SPCR bits: SPIE(7)=0, SPE(6)=1, DORD(5)=spiDord, MSTR(4)=1, CPOL(3)=spiCpol, CPHA(2)=spiCpha, SPR1(1)=spr1, SPR0(0)=spr0
    const mstrBit = spiSimCollision === 'ss_abort' ? 0 : 1; // SS abort clears MSTR!
    const spcrVal = (1 << 6) | (spiDord << 5) | (mstrBit << 4) | (spiCpol << 3) | (spiCpha << 2) | (spr1 << 1) | spr0;

    // SPSR bits: SPIF(7), WCOL(6), SPI2X(0)
    let spsrVal = spiDoubleSpeed ? 1 : 0;
    if (spiSimCollision === 'wcol') {
      spsrVal |= (1 << 6); // WCOL bit set!
    } else {
      spsrVal |= (1 << 7); // SPIF flag set
    }

    const spiTxByte = parseInt(spiTxDataHex.replace('0x', ''), 16) || 0x9f;

    return {
      sckHz,
      sckMhz,
      spcrVal,
      spcrHex: `0x${spcrVal.toString(16).toUpperCase().padStart(2, '0')}`,
      spsrVal,
      spsrHex: `0x${spsrVal.toString(16).toUpperCase().padStart(2, '0')}`,
      spiTxByte,
      spiTxHex: `0x${spiTxByte.toString(16).toUpperCase().padStart(2, '0')}`,
      modeLabel: `Mode ${spiCpol * 2 + spiCpha} (CPOL=${spiCpol}, CPHA=${spiCpha})`,
      bitOrderLabel: spiDord === 0 ? 'MSB First (D7->D0)' : 'LSB First (D0->D7)'
    };
  }, [cpuClockMhz, spiPrescaler, spiDoubleSpeed, spiCpol, spiCpha, spiDord, spiTxDataHex, spiSimCollision]);

  // C Source Code Generation
  const generatedCCode = useMemo(() => {
    if (protocol === 'i2c') {
      return `/* =========================================================================
 * AVR TWI / I2C 버스 중재(Arbitration) 대응 마스터 드라이버
 * 타깃 MCU   : ${currentProfile.name}
 * F_CPU      : ${cpuClockMhz}000000UL (${cpuClockMhz} MHz)
 * SCL 속도   : ${i2cMath.sclKhz} kHz (TWBR=${i2cMath.twbrHex}, TWPS=${twps})
 * 슬레이브 주소: ${slaveAddrHex} (SLA+W/R = ${i2cMath.slarwHex})
 * ========================================================================= */
#include <avr/io.h>
#include <util/twi.h>
#include <stdbool.h>
#include <util/delay.h>

#define MAX_RETRY 3

void twi_init(void) {
    // 1. 비트 레이트 및 프리스케일러 설정
    TWSR = (TWSR & ~0x03) | (${twps} & 0x03);
    TWBR = ${i2cMath.twbrHex}; // SCL = ${i2cMath.sclHz} Hz
    TWAR = ${i2cMath.twarHex}; // 슬레이브 주소 & 일반 호출(General Call)
    TWCR = (1 << TWEN); // TWI 하드웨어 활성화
}

// 버스 중재 탈취(TW_MT_ARB_LOST) 감지 및 자동 재시도 함수
bool twi_write_with_arbitration_retry(uint8_t sla, uint8_t data) {
    for (uint8_t retry = 0; retry < MAX_RETRY; retry++) {
        // START 송신
        TWCR = (1 << TWINT) | (1 << TWSTA) | (1 << TWEN);
        while (!(TWCR & (1 << TWINT)));

        uint8_t status = TW_STATUS;
        if (status == TW_MT_ARB_LOST) {
            // 중재 패배! 버스 해제 후 임의 백오프 딜레이
            _delay_us(50);
            continue; // 재시도
        }
        if (status != TW_START && status != TW_REP_START) return false;

        // SLA+W 전송
        TWDR = (sla << 1) | TW_WRITE;
        TWCR = (1 << TWINT) | (1 << TWEN);
        while (!(TWCR & (1 << TWINT)));

        status = TW_STATUS;
        if (status == TW_MT_ARB_LOST) {
            _delay_us(50);
            continue; // 중재 실패 재시도
        }
        if (status != TW_MT_SLA_ACK) {
            TWCR = (1 << TWINT) | (1 << TWSTO) | (1 << TWEN);
            return false;
        }

        // 데이터 바이트 전송
        TWDR = data;
        TWCR = (1 << TWINT) | (1 << TWEN);
        while (!(TWCR & (1 << TWINT)));

        status = TW_STATUS;
        if (status == TW_MT_ARB_LOST) {
            _delay_us(50);
            continue; // 전송 중 중재 탈취 발생
        }

        // STOP 송신
        TWCR = (1 << TWINT) | (1 << TWSTO) | (1 << TWEN);
        return (status == TW_MT_DATA_ACK);
    }
    return false; // 최대 재시도 초과 실패
}
`;
    } else {
      return `/* =========================================================================
 * AVR SPI 버스 충돌(WCOL) 및 SS 경합 방지 마스터 드라이버
 * 타깃 MCU   : ${currentProfile.name}
 * F_CPU      : ${cpuClockMhz}000000UL (${cpuClockMhz} MHz)
 * SCK 속도   : ${spiMath.sckMhz} MHz (DIV ${spiPrescaler}${spiDoubleSpeed ? ' + SPI2X' : ''})
 * SPI 모드   : ${spiMath.modeLabel}
 * SPCR=${spiMath.spcrHex}, SPSR=${spiMath.spsrHex}
 * ========================================================================= */
#include <avr/io.h>
#include <stdbool.h>

#define CS_PORT PORTB
#define CS_DDR  DDRB
#define CS_PIN  PB2

void spi_init(void) {
    // MOSI, SCK, CS 출력 설정
    DDRB |= (1 << PB3) | (1 << PB5) | (1 << CS_PIN);
    CS_PORT |= (1 << CS_PIN); // CS Idle High

    SPSR = ${spiMath.spsrHex}; // SPI2X = ${spiDoubleSpeed ? '1' : '0'}
    SPCR = ${spiMath.spcrHex}; // SPE=1, MSTR=1, DORD=${spiDord}, Mode ${spiCpol * 2 + spiCpha}
}

// WCOL(Write Collision) 검출 및 안전 전송 함수
uint8_t spi_transfer_safe(uint8_t data, bool *collision_detected) {
    if (collision_detected) *collision_detected = false;

    // 만약 /SS가 외부 마스터에 의해 LOW로 당겨져 MSTR이 풀렸다면 복구
    if (!(SPCR & (1 << MSTR))) {
        SPCR |= (1 << MSTR); // 마스터 모드 재획득
    }

    SPDR = data;

    // 하드웨어 전송 완료 대기
    while (!(SPSR & (1 << SPIF))) {
        if (SPSR & (1 << WCOL)) {
            // 쓰기 충돌 발생 (이전 전송 끝나기 전 SPDR 덮어씀)
            if (collision_detected) *collision_detected = true;
            break;
        }
    }

    return SPDR;
}
`;
    }
  }, [protocol, currentProfile.name, cpuClockMhz, i2cMath, twps, slaveAddrHex, spiMath, spiPrescaler, spiDoubleSpeed, spiDord, spiCpol, spiCpha]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCCode);
    setCopiedCode(true);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.85 } });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadCode = () => {
    const blob = new Blob([generatedCCode], { type: 'text/x-csrc' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avr_${protocol}_protocol_debugger_${selectedMCU}.c`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-2">
            <Bug className="w-3.5 h-3.5" /> Hardware Register & Bus Collision Debugger
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            AVR 통신 프로토콜 디버거 (I2C/SPI 버스 충돌 및 레지스터 연동기)
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            I2C(TWI) 및 SPI 하드웨어 레지스터(TWBR, TWSR, TWAR, SPCR, SPSR)를 실시간 연동하고, 
            <span className="text-cyan-300 font-medium"> 슬레이브 주소/보레이트 계산</span>과 
            <span className="text-rose-400 font-medium"> 버스 충돌(Bus Arbitration & WCOL)</span> 상태를 대화형으로 모의 시험합니다.
          </p>
        </div>

        {/* Protocol Selector */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-start lg:self-center">
          <button
            onClick={() => setProtocol('i2c')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              protocol === 'i2c'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> I2C (TWI) 디버거
          </button>
          <button
            onClick={() => setProtocol('spi')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              protocol === 'spi'
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" /> SPI 디버거
          </button>
        </div>
      </div>

      {/* Control Panel: Parameters Configuration */}
      {protocol === 'i2c' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Col 1: SCL Clock & TWBR Setting */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" /> 통신 속도 & TWBR 계산
            </h3>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>클럭 주파수 (F_CPU)</span>
                <span className="text-cyan-400 font-bold">{cpuClockMhz} MHz</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[8, 12, 16, 20].map((clk) => (
                  <button
                    key={clk}
                    onClick={() => setCpuClockMhz(clk)}
                    className={`py-1 text-xs rounded border transition-all font-semibold ${
                      cpuClockMhz === clk
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {clk}MHz
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>TWBR 비트 레이트 (0~255)</span>
                <span className="text-emerald-400 font-mono font-bold">{twbr} (0x{twbr.toString(16).toUpperCase()})</span>
              </div>
              <input
                type="range"
                min={0}
                max={120}
                value={twbr}
                onChange={(e) => setTwbr(parseInt(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                <span>TWBR=0 (최고속)</span>
                <span>TWBR=72 (100kHz)</span>
                <span>TWBR=12 (400kHz)</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">TWPS 프리스케일러 (TWSR[1:0])</label>
              <div className="grid grid-cols-4 gap-1.5">
                {([0, 1, 2, 3] as (0 | 1 | 2 | 3)[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setTwps(p)}
                    className={`py-1 text-xs rounded border font-semibold ${
                      twps === p
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    4^{p} ({Math.pow(4, p)})
                  </button>
                ))}
              </div>
            </div>

            {/* SCL Result Card */}
            <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>도출된 SCL 속도:</span>
                <span className="text-white font-mono font-bold text-sm">{i2cMath.sclKhz} kHz</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>표준 모드 판정:</span>
                <span className="font-semibold text-emerald-400">
                  {i2cMath.isFastMode ? 'Fast Mode (400kHz)' : i2cMath.isStandardMode ? 'Standard (100kHz)' : 'Custom Speed'}
                </span>
              </div>
            </div>
          </div>

          {/* Col 2: Slave Address & Data Registers */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" /> 주소 설정 & TWAR/TWDR 레지스터
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">슬레이브 주소 (7-bit)</label>
                <input
                  type="text"
                  value={slaveAddrHex}
                  onChange={(e) => setSlaveAddrHex(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  placeholder="0x68"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Dec: {i2cMath.safeAddr7} (0b{i2cMath.safeAddr7.toString(2).padStart(7, '0')})
                </span>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">R/W 방향 비트</label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => setRwBit(0)}
                    className={`py-1.5 text-xs rounded border font-semibold ${
                      rwBit === 0
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Write (0)
                  </button>
                  <button
                    onClick={() => setRwBit(1)}
                    className={`py-1.5 text-xs rounded border font-semibold ${
                      rwBit === 1
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Read (1)
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">SLA+W/R: {i2cMath.slarwHex}</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">송신 데이터 바이트 (TWDR)</label>
              <input
                type="text"
                value={txDataHex}
                onChange={(e) => setTxDataHex(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                placeholder="0x5A"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                바이트 2진수: 0b{txByte.toString(2).padStart(8, '0')} (Dec: {txByte})
              </span>
            </div>

            <div className="flex items-center justify-between bg-slate-900/70 p-2.5 rounded-lg border border-slate-800 text-xs">
              <div>
                <span className="text-slate-200 font-medium block">TWAR 일반 호출 (General Call)</span>
                <span className="text-[11px] text-slate-400">주소 0x00 브로드캐스트 응답 허용 (TWGCE=1)</span>
              </div>
              <input
                type="checkbox"
                checked={enableGeneralCall}
                onChange={(e) => setEnableGeneralCall(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
            </div>
          </div>

          {/* Col 3: Bus Arbitration Simulation */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" /> 버스 충돌 & 중재 탈취(Arbitration) 모의
            </h3>

            <div className="flex items-center justify-between bg-slate-900/70 p-2.5 rounded-lg border border-slate-800 text-xs">
              <div>
                <span className="text-slate-200 font-medium block">경합 마스터(Contender) 주입</span>
                <span className="text-[11px] text-slate-400">동일 버스에서 다른 마스터가 동시 송신 시뮬레이션</span>
              </div>
              <input
                type="checkbox"
                checked={enableArbitrationTest}
                onChange={(e) => setEnableArbitrationTest(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-rose-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
            </div>

            {enableArbitrationTest && (
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">경합 마스터 송신 데이터 (Rival Byte)</label>
                  <input
                    type="text"
                    value={contenderDataHex}
                    onChange={(e) => setContenderDataHex(e.target.value)}
                    className="w-full bg-slate-900 border border-rose-500/50 rounded-lg px-3 py-1.5 text-xs text-rose-300 font-mono"
                    placeholder="0x52"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    경합 2진수: 0b{contenderByte.toString(2).padStart(8, '0')}
                  </span>
                </div>

                <div className="p-2.5 bg-rose-950/30 border border-rose-500/40 rounded-lg text-[11px] text-rose-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    {arbitrationBits.lostBitIndex !== -1
                      ? `Bit ${arbitrationBits.lostBitIndex}에서 중재 탈취 발생!`
                      : '동일 비트 송신으로 충돌 없음'}
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    본 마스터가 SDA=1 출력 시 경합 마스터가 SDA=0으로 당기면, 하드웨어가 이를 감지하여 즉시 
                    <strong> TWSR = 0x38 (TW_MT_ARB_LOST)</strong> 상태로 전환됩니다.
                  </p>
                </div>
              </div>
            )}

            {/* Live TWI Status Register Monitor */}
            <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>현재 TWSR 상태 레지스터:</span>
                <span className={`font-mono font-bold ${i2cMath.statusObj.isError ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {i2cMath.statusObj.codeHex} ({i2cMath.statusObj.macro})
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium">
                {i2cMath.statusObj.name}
              </div>
              <div className="text-[10px] text-slate-400 leading-relaxed">
                {i2cMath.statusObj.desc}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* SPI Debugger Settings */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Col 1: Clock & Prescaler */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" /> SPI 클럭 & SCK 주파수
            </h3>

            <div>
              <label className="text-xs text-slate-400 block mb-1">클럭 분주비 (SPR1:0)</label>
              <div className="grid grid-cols-4 gap-1.5">
                {([4, 16, 64, 128] as (4 | 16 | 64 | 128)[]).map((pre) => (
                  <button
                    key={pre}
                    onClick={() => setSpiPrescaler(pre)}
                    className={`py-1 text-xs rounded border font-semibold ${
                      spiPrescaler === pre
                        ? 'bg-indigo-500 text-white border-indigo-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    /{pre}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-900/70 p-2.5 rounded-lg border border-slate-800 text-xs">
              <div>
                <span className="text-slate-200 font-medium block">SPI2X 배속 비트 (SPSR[0])</span>
                <span className="text-[11px] text-slate-400">클럭 분주 2배 가속 ({spiMath.sckMhz} MHz)</span>
              </div>
              <input
                type="checkbox"
                checked={spiDoubleSpeed}
                onChange={(e) => setSpiDoubleSpeed(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-indigo-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>SCK 클럭 주파수:</span>
                <span className="text-white font-mono font-bold text-sm">{spiMath.sckMhz} MHz</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>모드 명칭:</span>
                <span className="text-indigo-400 font-semibold">{spiMath.modeLabel}</span>
              </div>
            </div>
          </div>

          {/* Col 2: SPI Mode & Data Format */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" /> 모드 극성/위상 & SPCR 레지스터
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">CPOL (클럭 극성)</label>
                <button
                  onClick={() => setSpiCpol(spiCpol === 0 ? 1 : 0)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium"
                >
                  {spiCpol === 0 ? '0 (Idle Low)' : '1 (Idle High)'}
                </button>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">CPHA (클럭 위상)</label>
                <button
                  onClick={() => setSpiCpha(spiCpha === 0 ? 1 : 0)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium"
                >
                  {spiCpha === 0 ? '0 (Leading Edge)' : '1 (Trailing Edge)'}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">데이터 비트 정렬 (DORD)</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => setSpiDord(0)}
                  className={`p-2 rounded-lg border font-semibold ${
                    spiDord === 0
                      ? 'bg-indigo-500 text-white border-indigo-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  MSB First (D7..D0)
                </button>
                <button
                  onClick={() => setSpiDord(1)}
                  className={`p-2 rounded-lg border font-semibold ${
                    spiDord === 1
                      ? 'bg-indigo-500 text-white border-indigo-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  LSB First (D0..D7)
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">송신 데이터 바이트 (SPDR)</label>
              <input
                type="text"
                value={spiTxDataHex}
                onChange={(e) => setSpiTxDataHex(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                placeholder="0x9F"
              />
            </div>
          </div>

          {/* Col 3: SPI Write Collision & SS Conflict Simulator */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" /> SPI 하드웨어 충돌 시뮬레이션
            </h3>

            <div>
              <label className="text-xs text-slate-400 block mb-1">하드웨어 오류 주입 (Failure Injection)</label>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <button
                  onClick={() => setSpiSimCollision('none')}
                  className={`py-1.5 rounded border transition-all ${
                    spiSimCollision === 'none'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  정상 상태
                </button>
                <button
                  onClick={() => setSpiSimCollision('wcol')}
                  className={`py-1.5 rounded border transition-all ${
                    spiSimCollision === 'wcol'
                      ? 'bg-rose-500 text-white border-rose-400 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  WCOL 충돌
                </button>
                <button
                  onClick={() => setSpiSimCollision('ss_abort')}
                  className={`py-1.5 rounded border transition-all ${
                    spiSimCollision === 'ss_abort'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  /SS 경합
                </button>
              </div>
            </div>

            {/* Diagnostic Box */}
            <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>SPSR 상태 레지스터:</span>
                <span className={`font-mono font-bold ${spiSimCollision !== 'none' ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {spiMath.spsrHex} {spiSimCollision === 'wcol' ? '(WCOL Set!)' : '(SPIF Set)'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>SPCR 컨트롤 레지스터:</span>
                <span className="font-mono text-indigo-400 font-bold">
                  {spiMath.spcrHex} {spiSimCollision === 'ss_abort' ? '(MSTR=0 리셋!)' : '(MSTR=1)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 pt-1 leading-relaxed border-t border-slate-800">
                {spiSimCollision === 'wcol'
                  ? 'WCOL (Write Collision): 이전 전송이 끝나기 전 SPDR에 쓰기를 시도하여 데이터가 파손되었습니다.'
                  : spiSimCollision === 'ss_abort'
                  ? 'SS 경합: 외부 마스터가 /SS 핀을 LOW로 당겨 본 마스터의 MSTR 비트가 0으로 강제 클리어되었습니다.'
                  : 'SPI 버스가 충돌 없이 정상 동작하고 있습니다.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Bit-by-Bit Bus Collision Simulator Visualizer */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">
              {protocol === 'i2c'
                ? 'I2C 비트 단위 버스 와이어드-AND 충돌 판정기 (Open-Drain Wired-AND)'
                : 'SPI 비트 스트림 및 레지스터 플래그 타이밍'}
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {protocol === 'i2c'
              ? `본 마스터: 0x${txByte.toString(16).toUpperCase()} vs 경합: 0x${contenderByte.toString(16).toUpperCase()}`
              : `SPDR: 0x${spiMath.spiTxByte.toString(16).toUpperCase()} (${spiMath.bitOrderLabel})`}
          </span>
        </div>

        {protocol === 'i2c' ? (
          <div className="space-y-3">
            {/* Bit Table */}
            <div className="grid grid-cols-8 gap-2 text-center text-xs">
              {arbitrationBits.bits.map((b) => (
                <div
                  key={b.bitPos}
                  className={`p-2.5 rounded-lg border transition-all ${
                    b.lostHere
                      ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/50'
                      : b.isConflict
                      ? 'bg-amber-950/30 border-amber-500/50'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="text-[10px] text-slate-400 mb-1 font-mono">Bit {b.bitPos}</div>
                  <div className="space-y-0.5 font-mono text-[11px]">
                    <div className="text-cyan-400">나: {b.ourBit}</div>
                    <div className="text-rose-400">경합: {b.contenderBit}</div>
                    <div className="text-white font-bold pt-1 border-t border-slate-800">
                      버스: {b.busLineBit}
                    </div>
                  </div>
                  {b.lostHere && (
                    <span className="mt-1.5 inline-block px-1 py-0.5 rounded bg-rose-500 text-white text-[9px] font-bold">
                      중재 패배!
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-900/70 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed">
              <strong>I2C 물리 계층 원리:</strong> I2C는 풀업 저항과 오픈 드레인(Open-drain) 구조이므로, 
              한 마스터가 0(GND)을 출력하면 다른 마스터가 1(Float)을 출력하더라도 버스 전체 전압은 0V가 됩니다. 
              자신이 1을 보냈는데 버스에서 0이 감지되면 즉시 <strong>TW_MT_ARB_LOST(0x38)</strong>가 발생하며 
              송신을 중단하고 수신 대기 상태로 물러납니다.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-8 gap-2 text-center text-xs">
              {Array.from({ length: 8 }).map((_, idx) => {
                const bitPos = spiDord === 0 ? 7 - idx : idx;
                const bitVal = (spiMath.spiTxByte >> bitPos) & 1;
                return (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border bg-slate-900/60 border-slate-800"
                  >
                    <div className="text-[10px] text-slate-400 mb-1 font-mono">D{bitPos}</div>
                    <div className="text-base font-bold font-mono text-emerald-400">{bitVal}</div>
                    <div className="text-[9px] text-slate-500 mt-1">
                      클럭 {idx + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Embedded C Code Generator */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                자동 생성된 AVR C 프로토콜 드라이버 (충돌 대응 & 복구 루틴)
              </h3>
              <p className="text-xs text-slate-400">
                {protocol === 'i2c'
                  ? 'TW_MT_ARB_LOST 중재 탈취 감지 시 백오프 후 자동 재시도하는 견고한 TWI C 코드'
                  : 'WCOL 쓰기 충돌 감지 및 SS 경합 자동 복구 기능이 탑재된 SPI C 코드'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-all flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? '복사 완료!' : 'C 코드 복사'}
            </button>
            <button
              onClick={handleDownloadCode}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> .c 파일 다운로드
            </button>
          </div>
        </div>

        <pre className="p-4 bg-slate-900/90 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[360px] scrollbar-thin scrollbar-thumb-slate-700">
          <code>{generatedCCode}</code>
        </pre>
      </div>
    </div>
  );
};
