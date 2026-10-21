import React, { useState } from 'react';
import { Table, Check, X, Cpu, Download, ArrowUpDown, Filter, Sparkles, AlertCircle } from 'lucide-react';
import { SupportedMCU } from '../data/pinmapData';
import { McuRadarComparison } from './McuRadarComparison';

interface Props {
  onSelectMCU: (mcu: SupportedMCU) => void;
  onSwitchToUniversal?: () => void;
}

interface SpecRow {
  category: string;
  feature: string;
  atmega2560: string;
  atmega640: string;
  atmega128: string;
  atmega328p: string;
  winner?: 'atmega2560' | 'atmega640' | 'atmega128' | 'atmega328p' | 'tie';
  tip?: string;
}

const SPEC_DATA: SpecRow[] = [
  // 1. 핵심 코어 및 연산
  {
    category: '코어 & 프로세서',
    feature: 'CPU 아키텍처',
    atmega2560: 'AVR 8-bit RISC (Harvard, 3-byte PC)',
    atmega640: 'AVR 8-bit RISC (Harvard, 2-byte PC)',
    atmega128: 'AVR 8-bit RISC (Harvard, 2-byte PC)',
    atmega328p: 'AVR 8-bit RISC (Harvard, 2-byte PC)',
    winner: 'tie',
    tip: '2560은 256KB(128KW) 주소 지정을 위해 3바이트 Program Counter 및 RAMPZ/EIND 레지스터 탑재'
  },
  {
    category: '코어 & 프로세서',
    feature: '범용 작업 레지스터',
    atmega2560: '32 x 8-bit (X, Y, Z 포인터)',
    atmega640: '32 x 8-bit (X, Y, Z 포인터)',
    atmega128: '32 x 8-bit (X, Y, Z 포인터)',
    atmega328p: '32 x 8-bit (X, Y, Z 포인터)',
    winner: 'tie'
  },
  {
    category: '코어 & 프로세서',
    feature: '최대 클럭 & MIPS',
    atmega2560: '16 MHz (16 MIPS)',
    atmega640: '16 MHz (16 MIPS)',
    atmega128: '16 MHz (16 MIPS @ 128A)',
    atmega328p: '20 MHz (20 MIPS)',
    winner: 'atmega328p',
    tip: 'ATmega328P가 정격 20MHz로 단일 코어 클럭 속도 최고'
  },
  {
    category: '코어 & 프로세서',
    feature: '동작 전압 범위 (VCC)',
    atmega2560: '1.8V ~ 5.5V (2560V 1.8V / 2560 4.5~5.5V)',
    atmega640: '1.8V ~ 5.5V (640V 1.8V / 640 2.7~5.5V)',
    atmega128: '2.7V ~ 5.5V (128A)',
    atmega328p: '1.8V ~ 5.5V (PicoPower)',
    winner: 'atmega328p',
    tip: '128A는 1.8V 저전압 배터리 구동 불가(2.7V 이상 필수)'
  },

  // 2. 메모리
  {
    category: '메모리 용량',
    feature: '플래시 롬 (Flash ROM)',
    atmega2560: '256 KB (10,000 W/E)',
    atmega640: '64 KB (10,000 W/E)',
    atmega128: '128 KB (10,000 W/E)',
    atmega328p: '32 KB (10,000 W/E)',
    winner: 'atmega2560',
    tip: '★ ATmega2560이 256KB로 압도적 최대 용량! Marlin 3D 프린터 및 대형 펌웨어 수용'
  },
  {
    category: '메모리 용량',
    feature: '내부 SRAM 용량',
    atmega2560: '8 KB',
    atmega640: '8 KB',
    atmega128: '4 KB',
    atmega328p: '2 KB',
    winner: 'atmega2560',
    tip: '2560과 640이 8KB로 328P(2KB)의 4배! 대형 버퍼와 스택 여유 확보'
  },
  {
    category: '메모리 용량',
    feature: '내장 EEPROM',
    atmega2560: '4 KB (100,000 W/E)',
    atmega640: '4 KB (100,000 W/E)',
    atmega128: '4 KB (100,000 W/E)',
    atmega328p: '1 KB (100,000 W/E)',
    winner: 'atmega2560',
    tip: '설정값 및 비휘발성 로깅 데이터 보존 공간'
  },
  {
    category: '메모리 용량',
    feature: '외부 메모리 확장 (XMEM)',
    atmega2560: '최대 64 KB (Port A/C/G)',
    atmega640: '최대 64 KB (Port A/C/G)',
    atmega128: '최대 64 KB (Port A/C/G)',
    atmega328p: '미지원 (내부 2KB 전용)',
    winner: 'atmega2560',
    tip: '외부 대용량 고속 SRAM 또는 메모리 매핑 주변장치 연결 가능'
  },

  // 3. 핀 및 I/O
  {
    category: 'I/O 및 패키지',
    feature: '범용 I/O 핀 수',
    atmega2560: '86 개',
    atmega640: '86 개',
    atmega128: '53 개',
    atmega328p: '23 개 (DIP) / 23 개',
    winner: 'atmega2560',
    tip: '2560과 640이 86개로 포트 확장 IC 없이 대규모 제어 가능'
  },
  {
    category: 'I/O 및 패키지',
    feature: '물리 패키지 형태',
    atmega2560: '100-pin TQFP / 100-ball CBGA',
    atmega640: '100-pin TQFP / 100-ball CBGA',
    atmega128: '64-pin TQFP / 64-pad QFN',
    atmega328p: '28-pin DIP / 32-pin TQFP',
    winner: 'atmega328p',
    tip: '328P는 DIP 타입으로 만능기판 DIY 및 시제품 제작 최고'
  },
  {
    category: 'I/O 및 패키지',
    feature: '포트 구성 그룹',
    atmega2560: 'Port A ~ Port L (11개 포트)',
    atmega640: 'Port A ~ Port L (11개 포트)',
    atmega128: 'Port A ~ Port G (7개 포트)',
    atmega328p: 'Port B, C, D (3개 포트)',
    winner: 'atmega2560'
  },

  // 4. 통신 인터페이스
  {
    category: '통신 주변장치',
    feature: '하드웨어 USART',
    atmega2560: '4 채널 (USART0~3 독립)',
    atmega640: '4 채널 (USART0~3 독립)',
    atmega128: '2 채널 (USART0~1)',
    atmega328p: '1 채널 (USART0)',
    winner: 'atmega2560',
    tip: '2560과 640은 RS485, 블루투스, GPS, 디버그 콘솔 동시 운용'
  },
  {
    category: '통신 주변장치',
    feature: '하드웨어 SPI 버스',
    atmega2560: '1 채널 (Master/Slave, PB0~3)',
    atmega640: '1 채널 (Master/Slave, PB0~3)',
    atmega128: '1 채널 (Master/Slave, PB0~3)',
    atmega328p: '1 채널 (Master/Slave, PB2~5)',
    winner: 'tie'
  },
  {
    category: '통신 주변장치',
    feature: 'I2C / TWI 버스',
    atmega2560: '1 채널 (최대 400kHz, PD0/PD1)',
    atmega640: '1 채널 (최대 400kHz, PD0/PD1)',
    atmega128: '1 채널 (최대 400kHz, PD0/PD1)',
    atmega328p: '1 채널 (최대 400kHz, PC4/PC5)',
    winner: 'tie'
  },

  // 5. 타이머 및 아날로그
  {
    category: '타이머 & 아날로그',
    feature: '내장 타이머 수',
    atmega2560: '6개 (2x 8-bit, 4x 16-bit: T0~T5)',
    atmega640: '6개 (2x 8-bit, 4x 16-bit: T0~T5)',
    atmega128: '4개 (2x 8-bit, 2x 16-bit: T0~T3)',
    atmega328p: '3개 (2x 8-bit, 1x 16-bit: T0~T2)',
    winner: 'atmega2560',
    tip: 'Timer 1/3/4/5 총 4개의 16비트 타이머로 서보/인버터/스텝모터 정밀 제어'
  },
  {
    category: '타이머 & 아날로그',
    feature: '하드웨어 PWM 채널',
    atmega2560: '16 채널 (최대 16비트 고분해능)',
    atmega640: '15 채널 (최대 16비트 고분해능)',
    atmega128: '8 채널',
    atmega328p: '6 채널',
    winner: 'atmega2560',
    tip: 'ATmega2560은 총 16개 PWM 핀을 지원하여 다축 로봇 구동에 압도적'
  },
  {
    category: '타이머 & 아날로그',
    feature: '10비트 ADC 채널',
    atmega2560: '16 채널 (차동 + 200x 게인)',
    atmega640: '16 채널 (차동 + 200x 게인)',
    atmega128: '8 채널 (차동 + 200x 게인)',
    atmega328p: '8 채널 (단일 종단 전용)',
    winner: 'atmega2560',
    tip: '2560과 640은 ADC가 16개로 풍부한 아날로그 센서 수용'
  },
  {
    category: '타이머 & 아날로그',
    feature: '아날로그 비교기 (Comparator)',
    atmega2560: '1 채널 내장',
    atmega640: '1 채널 내장',
    atmega128: '1 채널 내장',
    atmega328p: '1 채널 내장',
    winner: 'tie'
  },

  // 6. 개발 및 특이사항
  {
    category: '개발 & 특이사항',
    feature: 'ISP 프로그래밍 핀',
    atmega2560: 'PB1(SCK), PB2(MOSI), PB3(MISO)',
    atmega640: 'PB1(SCK), PB2(MOSI), PB3(MISO)',
    atmega128: '★ PE0(PDI), PE1(PDO), PB1(SCK)',
    atmega328p: 'PB5(SCK), PB3(MOSI), PB4(MISO)',
    winner: 'tie',
    tip: '★ ATmega128은 SPI 핀이 아닌 PE0/PE1로 ISP를 연결해야 함!'
  },
  {
    category: '개발 & 특이사항',
    feature: '주의해야 할 퓨즈 비트',
    atmega2560: 'BOOTSZ (최대 4KB BLS), CKDIV8 해제',
    atmega640: 'CKDIV8 (출고 시 8분주 해제 필요)',
    atmega128: '★ M103C (출고 시 103모드 해제 필수)',
    atmega328p: 'BODLEVEL (2.7V 활성화 권장)',
    winner: 'tie',
    tip: '2560은 STK500v2 부트로더를 위해 BOOTSZ를 2KB/4KB로 지정'
  },
  {
    category: '개발 & 특이사항',
    feature: '대표적인 활용 분야',
    atmega2560: 'Arduino Mega 2560, 3D 프린터(Marlin), 다관절 로봇, 복합 계측기',
    atmega640: '공장 자동화, 다축 모터 콘솔, 센서 허브, 2560 BOM 단가 절감',
    atmega128: '산업용 PLC 보드, 로봇 제어기, 대학/연구소 임베디드 실습 표준',
    atmega328p: '아두이노 우노(Uno), 배터리 IoT 센서 노드, 교육용 DIY'
  }
];

export const ComparisonTab: React.FC<Props> = ({ onSelectMCU, onSwitchToUniversal }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const categories = ['all', '코어 & 프로세서', '메모리 용량', 'I/O 및 패키지', '통신 주변장치', '타이머 & 아날로그', '개발 & 특이사항'];

  const filteredData = SPEC_DATA.filter((row) => {
    const matchesCat = selectedCategory === 'all' || row.category === selectedCategory;
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      row.feature.toLowerCase().includes(q) ||
      row.atmega2560.toLowerCase().includes(q) ||
      row.atmega640.toLowerCase().includes(q) ||
      row.atmega128.toLowerCase().includes(q) ||
      row.atmega328p.toLowerCase().includes(q) ||
      (row.tip && row.tip.toLowerCase().includes(q));

    return matchesCat && matchesSearch;
  });

  const exportCSV = () => {
    const header = ['카테고리', '사양 항목', 'ATmega2560', 'ATmega640', 'ATmega128', 'ATmega328P', '엔지니어링 팁'];
    const rows = SPEC_DATA.map((r) => [
      `"${r.category}"`,
      `"${r.feature}"`,
      `"${r.atmega2560}"`,
      `"${r.atmega640}"`,
      `"${r.atmega128}"`,
      `"${r.atmega328p}"`,
      `"${r.tip || ''}"`
    ]);
    const csvContent = '\uFEFF' + [header.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'ATmega_Comparison_Specs.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
              <Table className="w-3.5 h-3.5" /> Comprehensive Spec Matrix
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              ATmega2560 vs ATmega640 vs ATmega128 vs ATmega328P 전체 사양 비교표
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              프로젝트 요건(BOM 원가, 물리 핀 수, SRAM 용량, 통신 채널 수)에 최적화된 마이크로컨트롤러 선정을 위해
              코어 성능, 메모리, I/O, 주변장치 사양을 한눈에 체계적으로 비교 분석합니다.
            </p>
          </div>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition border border-slate-700 shadow-md shrink-0"
          >
            <Download className="w-4 h-4 text-amber-400" />
            CSV 비교표 다운로드
          </button>
        </div>
      </div>

      {/* Cross-Architecture Banner (AVR vs STM32 vs PIC vs 8051) */}
      {onSwitchToUniversal && (
        <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-blue-950/60 border border-indigo-500/30 rounded-2xl p-4 backdrop-blur shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>AVR vs STM32(F0/F1) vs Microchip PIC vs 8051 이기종 아키텍처 비교</span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-mono">
                  NEW
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                8비트 AVR뿐만 아니라 32비트 ARM Cortex-M0/M3, 산업용 PIC16/18, 클래식 8051과의 코어 구조 및 C 레지스터 코드를 비교해 보세요.
              </p>
            </div>
          </div>
          <button
            onClick={onSwitchToUniversal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md shadow-indigo-600/20 shrink-0"
          >
            <span>4대 MCU 비교표 보기</span>
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Summary Cards (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ATmega2560 Card */}
        <div className="bg-slate-900/70 border border-purple-500/40 rounded-2xl p-5 relative overflow-hidden backdrop-blur shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-base font-black text-purple-400 font-mono">ATmega2560</span>
            <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded font-mono">
              100-pin TQFP
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            <strong>풀스펙 플래그십 & 3D 프린터 표준</strong>: 256KB 초대용량 플래시(128KW), 8KB SRAM, 86개 I/O 및 16개 PWM 채널 탑재. 아두이노 메가 2560과 Marlin 펌웨어의 핵심 코어.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <div>
              <span className="text-slate-500 block text-[10px]">Flash</span>
              <span className="font-bold text-purple-400">256 KB ★</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">SRAM</span>
              <span className="font-bold text-purple-400">8 KB</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">I/O</span>
              <span className="font-bold text-white">86 핀</span>
            </div>
          </div>
          <button
            onClick={() => onSelectMCU('atmega2560')}
            className="w-full mt-3 py-1.5 px-3 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition shadow-md shadow-purple-600/20"
          >
            ATmega2560 상세 가이드 열기 →
          </button>
        </div>

        {/* ATmega640 Card */}
        <div className="bg-slate-900/70 border border-amber-500/30 rounded-2xl p-5 relative overflow-hidden backdrop-blur shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-base font-black text-amber-400 font-mono">ATmega640</span>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-mono">
              100-pin TQFP
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            <strong>최대 I/O & 가성비 양산 모델</strong>: 86개 I/O와 4개 USART를 갖추고 SRAM 8KB를 탑재하여, 고가의 ATmega2560 대비 단가를 대폭 낮추면서도 대형 주변장치를 완벽 운용.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <div>
              <span className="text-slate-500 block text-[10px]">Flash</span>
              <span className="font-bold text-white">64 KB</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">SRAM</span>
              <span className="font-bold text-amber-400">8 KB</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">I/O</span>
              <span className="font-bold text-white">86 핀</span>
            </div>
          </div>
          <button
            onClick={() => onSelectMCU('atmega640')}
            className="w-full mt-3 py-1.5 px-3 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition"
          >
            ATmega640 상세 가이드 열기 →
          </button>
        </div>

        {/* ATmega128 Card */}
        <div className="bg-slate-900/70 border border-cyan-500/30 rounded-2xl p-5 relative overflow-hidden backdrop-blur shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-base font-black text-cyan-400 font-mono">ATmega128</span>
            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded font-mono">
              64-pin TQFP
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            <strong>산업용 스테디셀러 표준</strong>: 128KB 대용량 플래시와 53개 I/O 라인. PLC 보드 및 대학 임베디드 교육에서 가장 널리 입증됨 (M103C 퓨즈 해제 및 PE0/PE1 ISP 배선 필수).
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <div>
              <span className="text-slate-500 block text-[10px]">Flash</span>
              <span className="font-bold text-cyan-400">128 KB</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">SRAM</span>
              <span className="font-bold text-white">4 KB</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">I/O</span>
              <span className="font-bold text-white">53 핀</span>
            </div>
          </div>
          <button
            onClick={() => onSelectMCU('atmega128')}
            className="w-full mt-3 py-1.5 px-3 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition"
          >
            ATmega128 상세 가이드 열기 →
          </button>
        </div>

        {/* ATmega328P Card */}
        <div className="bg-slate-900/70 border border-emerald-500/30 rounded-2xl p-5 relative overflow-hidden backdrop-blur shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-base font-black text-emerald-400 font-mono">ATmega328P</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-mono">
              28-pin DIP / 32-TQFP
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            <strong>아두이노 우노(Uno) 표준 & 초소형</strong>: 브레드보드 작업이 손쉬운 28핀 DIP 패키지, PicoPower 초저전력(0.1µA), 전 세계 최대 규모의 오픈소스 소프트웨어 생태계 보유.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <div>
              <span className="text-slate-500 block text-[10px]">Flash</span>
              <span className="font-bold text-white">32 KB</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">SRAM</span>
              <span className="font-bold text-white">2 KB</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">I/O</span>
              <span className="font-bold text-emerald-400">23 핀 (DIP)</span>
            </div>
          </div>
          <button
            onClick={() => onSelectMCU('atmega328p')}
            className="w-full mt-3 py-1.5 px-3 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition"
          >
            ATmega328P 상세 가이드 열기 →
          </button>
        </div>
      </div>

      {/* Radar Chart Comparison Section (Processing Speed, Flash Density, Power Consumption) */}
      <McuRadarComparison onSelectMCU={onSelectMCU} />

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur shadow-lg flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-amber-400" /> 카테고리 필터:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all border ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {cat === 'all' ? '전체 항목 보기' : cat}
            </button>
          ))}
        </div>

        <div className="w-full md:w-72">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="사양 항목 검색 (SRAM, USART, PWM, ISP...)"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Main Spec Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/70 shadow-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider">
              <th className="px-4 py-3.5 font-bold w-36">구분 카테고리</th>
              <th className="px-4 py-3.5 font-bold w-44">세부 사양 항목</th>
              <th className="px-4 py-3.5 font-bold bg-purple-500/10 text-purple-300 border-l border-r border-purple-500/20">
                ATmega2560
              </th>
              <th className="px-4 py-3.5 font-bold bg-amber-500/10 text-amber-300 border-r border-amber-500/20">
                ATmega640
              </th>
              <th className="px-4 py-3.5 font-bold bg-cyan-500/10 text-cyan-300 border-r border-cyan-500/20">
                ATmega128
              </th>
              <th className="px-4 py-3.5 font-bold bg-emerald-500/10 text-emerald-300 border-r border-emerald-500/20">
                ATmega328P
              </th>
              <th className="px-4 py-3.5 font-bold text-slate-300">엔지니어링 팁 & 핵심 차이점</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredData.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
                <td className="px-4 py-3 text-slate-400 font-medium whitespace-nowrap">
                  {row.category}
                </td>
                <td className="px-4 py-3 font-bold text-white font-mono whitespace-nowrap">
                  {row.feature}
                </td>

                {/* ATmega2560 Cell */}
                <td
                  className={`px-4 py-3 font-mono border-l border-r border-slate-800/80 ${
                    row.winner === 'atmega2560'
                      ? 'bg-purple-500/15 text-purple-300 font-bold'
                      : 'text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {row.winner === 'atmega2560' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                    )}
                    <span>{row.atmega2560}</span>
                  </div>
                </td>

                {/* ATmega640 Cell */}
                <td
                  className={`px-4 py-3 font-mono border-r border-slate-800/80 ${
                    row.winner === 'atmega640'
                      ? 'bg-amber-500/15 text-amber-300 font-bold'
                      : 'text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {row.winner === 'atmega640' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    )}
                    <span>{row.atmega640}</span>
                  </div>
                </td>

                {/* ATmega128 Cell */}
                <td
                  className={`px-4 py-3 font-mono border-r border-slate-800/80 ${
                    row.winner === 'atmega128'
                      ? 'bg-cyan-500/15 text-cyan-300 font-bold'
                      : 'text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {row.winner === 'atmega128' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                    )}
                    <span>{row.atmega128}</span>
                  </div>
                </td>

                {/* ATmega328P Cell */}
                <td
                  className={`px-4 py-3 font-mono border-r border-slate-800/80 ${
                    row.winner === 'atmega328p'
                      ? 'bg-emerald-500/15 text-emerald-300 font-bold'
                      : 'text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {row.winner === 'atmega328p' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    )}
                    <span>{row.atmega328p}</span>
                  </div>
                </td>

                {/* Engineering Tip Cell */}
                <td className="px-4 py-3 text-slate-400 text-xs leading-relaxed">
                  {row.tip ? (
                    <span className="inline-flex items-center gap-1 text-slate-300">
                      💡 {row.tip}
                    </span>
                  ) : (
                    <span className="text-slate-600">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Decision Guide Callout (4 Columns) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-lg space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          마이크로컨트롤러 선정 가이드 (MCU Selection Decision Tree)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/30 space-y-2">
            <div className="flex items-center gap-2 font-bold text-purple-400">
              <span>👉 언제 ATmega2560을 선택해야 할까?</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li>3D 프린터(Marlin) 및 다관절 로봇 등 <strong>256KB 대용량 플래시</strong>가 필요할 때</li>
              <li>최대 <strong>16채널 하드웨어 PWM</strong>으로 다축 모터 및 서보를 동시 정밀 제어할 때</li>
              <li>대규모 라이브러리와 복잡한 프로토콜 스택을 모두 온칩 롬에 수용할 때</li>
              <li><strong>아두이노 메가 2560</strong>의 방대한 쉴드 및 오픈소스 생태계를 쓸 때</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <span>👉 언제 ATmega640을 선택해야 할까?</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li>제어해야 할 센서/스위치가 50개 이상으로 <strong>많은 I/O(86핀)</strong>가 필요할 때</li>
              <li>다중 센서(RS485, 블루투스, GPS 등)로 <strong>4개 하드웨어 USART</strong>가 필수일 때</li>
              <li>대규모 수신 데이터 링버퍼를 위해 <strong>SRAM 8KB</strong>가 필요할 때</li>
              <li>ATmega2560 보드 설계에서 <strong>Flash 64KB로 BOM 원가를 대폭 절감</strong>할 때</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-bold text-cyan-400">
              <span>👉 언제 ATmega128을 선택해야 할까?</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li>임베디드 펌웨어 바이너리 크기가 커서 <strong>128KB 대용량 플래시</strong>가 필요할 때</li>
              <li>기존 산업용 PLC, 로봇, 공정 제어 보드의 <strong>유지보수 및 드롭인 교체</strong>일 때</li>
              <li>중간 규모의 I/O(53핀)와 2개 USART로 산업 장비를 제어할 때</li>
              <li>★ 설계 시 M103C 퓨즈 해제 및 PE0/PE1 ISP 배선 규칙 준수 필요</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-400">
              <span>👉 언제 ATmega328P를 선택해야 할까?</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li>만능기판 또는 브레드보드에 꽂아 <strong>초소형 28핀 DIP</strong>로 시제품을 만들 때</li>
              <li>코인셀 또는 리튬 배터리로 구동되는 <strong>초저전력(PicoPower 0.1µA)</strong> IoT 노드일 때</li>
              <li>전 세계 방대한 <strong>아두이노 오픈소스 라이브러리</strong>를 즉시 활용할 때</li>
              <li>단일 센서 노드 및 저렴한 단품 칩셋이 필요할 때</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
