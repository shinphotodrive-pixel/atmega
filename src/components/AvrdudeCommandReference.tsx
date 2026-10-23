import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Terminal,
  Search,
  Copy,
  Check,
  BookOpen,
  Filter,
  Zap,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  Cable,
  HardDrive,
  RotateCcw,
  Command,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export interface AvrdudeFlag {
  flag: string;
  syntax: string;
  name: string;
  category: 'core' | 'programmer' | 'fuses' | 'safety' | 'protocol';
  description: string;
  details: string;
  example: string;
  appliesTo: string; // e.g. "전체 프로그래머", "USBasp 전용", "시리얼/Arduino 전용"
}

export const AVRDUDE_FLAGS: AvrdudeFlag[] = [
  {
    flag: '-p',
    syntax: '-p <partno>',
    name: '타깃 마이크로컨트롤러 파트 넘버',
    category: 'core',
    description: '타깃 MCU 모델을 지정합니다. avrdude.conf 설정 파일의 부품 정의와 매칭됩니다.',
    details: 'ATmega328P: m328p, ATmega128: m128, ATmega640: m640, ATmega2560: m2560. 대소문자는 구분하지 않습니다.',
    example: 'avrdude -p m328p -c usbasp',
    appliesTo: '모든 프로그래머 필수'
  },
  {
    flag: '-c',
    syntax: '-c <programmer-id>',
    name: '하드웨어 프로그래머 (드라이버) 타입',
    category: 'programmer',
    description: '사용할 ISP 프로그래머 또는 부트로더 프로토콜을 지정합니다.',
    details: 'USBasp: usbasp, Arduino as ISP: stk500v1, Optiboot UART: arduino, Atmel-ICE ISP: atmelice_isp, STK500: stk500v2.',
    example: 'avrdude -c usbasp',
    appliesTo: '모든 프로그래머 필수'
  },
  {
    flag: '-U',
    syntax: '-U <memtype>:<op>:<filename>[:format]',
    name: '메모리 작업 (Flash, EEPROM, Fuses 읽기/쓰기/검증)',
    category: 'core',
    description: 'avrdude의 핵심 플래그. 플래시 롬, EEPROM, 퓨즈비트, 락비트를 읽거나 씁니다.',
    details: '<memtype>: flash, eeprom, lfuse, hfuse, efuse, lock, signature. <op>: w(쓰기), r(읽기), v(검증). [format]: i(Intel Hex), r(Raw Binary), m(Immediate Hex byte).',
    example: 'avrdude -U flash:w:firmware.hex:i -U lfuse:w:0xFF:m',
    appliesTo: '모든 프로그래머'
  },
  {
    flag: '-P',
    syntax: '-P <port>',
    name: '통신 연결 포트 (COM 포트 / USB 디바이스)',
    category: 'programmer',
    description: '프로그래머가 연결된 물리 시리얼 또는 USB 장치 경로를 지정합니다.',
    details: 'Windows: COM1~COM99, Linux: /dev/ttyUSB0 또는 /dev/ttyACM0, macOS: /dev/cu.usbserial-*. USBasp는 포트 생략 가능(USB 자동 감지) 또는 usb 지정.',
    example: 'avrdude -c stk500v1 -P COM3 -b 19200',
    appliesTo: '시리얼/UART 기반 프로그래머 (ArduinoISP, Optiboot, STK500)'
  },
  {
    flag: '-b',
    syntax: '-b <baudrate>',
    name: '통신 보레이트 (Baud Rate 속도)',
    category: 'programmer',
    description: '시리얼 포트 프로그래머와의 RS-232 통신 속도를 bps 단위로 설정합니다.',
    details: 'ArduinoISP는 반드시 19200bps(-b 19200)로 지정해야 합니다! Optiboot는 115200bps, 구형 ATmega128 부트로더는 57600bps를 주로 사용합니다.',
    example: 'avrdude -c arduino -P COM4 -b 115200',
    appliesTo: '시리얼/UART 기반 프로그래머'
  },
  {
    flag: '-B',
    syntax: '-B <bitclock>',
    name: 'ISP 비트클럭 주기 (저속 출하 칩 복구 필수)',
    category: 'programmer',
    description: 'ISP 프로그래밍 SPI 클럭 주기를 마이크로초(µs) 단위로 설정합니다. 저속 클럭 칩 플래싱 시 필수.',
    details: '규칙: ISP 클럭은 타깃 CPU 클럭의 1/4 미만이어야 합니다! 공장 출하 시 내부 1MHz 칩은 기본 속도로 통신 불가하므로 -B 32(약 31kHz)를 주어야 통신 성공합니다. 16MHz 동작 시 -B 1.5 또는 -B 0.5 권장.',
    example: 'avrdude -c usbasp -B 32 -p m128',
    appliesTo: 'USBasp, Atmel-ICE, STK500 등 하드웨어 ISP'
  },
  {
    flag: '-e',
    syntax: '-e',
    name: '칩 전체 소거 (Chip Erase)',
    category: 'core',
    description: '플래시 메모리와 EEPROM(EESAVE 퓨즈 미설정 시)을 완전히 지우고 락비트를 초기화(0xFF)합니다.',
    details: '새 펌웨어를 쓰기 전에 플래시 셀을 0xFF로 복원합니다. ⚠️ 주의: Optiboot 등 부트로더를 사용 중일 때 -e를 실행하면 부트로더까지 영구 소거되므로 절대 사용하지 마세요!',
    example: 'avrdude -c usbasp -p m328p -e -U flash:w:main.hex:i',
    appliesTo: 'ISP 프로그래머 전용 (부트로더 사용 시 금지)'
  },
  {
    flag: '-v',
    syntax: '-v, -vv, -vvvv',
    name: '상세 디버그 출력 (Verbose Output)',
    category: 'safety',
    description: '프로그래밍 진행 과정과 바이트 단위 통신 프로토콜 로그를 자세히 출력합니다.',
    details: '-v를 중첩할수록(최대 4개 -vvvv) SPI 패킷, 응답 헤더, 퓨즈 및 락비트 비트맵을 상세히 보여주어 연결 문제 트러블슈팅에 탁월합니다.',
    example: 'avrdude -p m328p -c usbasp -vv',
    appliesTo: '모든 프로그래머'
  },
  {
    flag: '-V',
    syntax: '-V',
    name: '자동 검증 비활성화 (Skip Verification)',
    category: 'safety',
    description: '플래시 메모리에 데이터를 쓴 후 다시 읽어와 원본과 일치하는지 비교하는 검증 단계를 생략합니다.',
    details: '다운로드 시간을 40% 단축할 수 있으나 플래시 기록 불량을 감지하지 못하므로, 공장 양산 고속화 단계가 아닌 개발 단계에서는 권장하지 않습니다.',
    example: 'avrdude -c usbasp -p m2560 -V -U flash:w:large.hex:i',
    appliesTo: '모든 프로그래머'
  },
  {
    flag: '-F',
    syntax: '-F',
    name: '디바이스 시그니처 검사 강제 무시 (Force Override)',
    category: 'safety',
    description: 'MCU의 하드웨어 시그니처 바이트(예: 0x1E 0x95 0x0F)가 불일치해도 강제로 플래싱을 속행합니다.',
    details: '⚠️ 위험: 배선 접촉 불량이나 전압 부족으로 0x000000이 반환되었을 때 -F를 쓰면 잘못된 칩에 플래싱하여 MCU를 벽돌(Bricked)로 만들 수 있습니다.',
    example: 'avrdude -c usbasp -p m328p -F -U flash:w:test.hex:i',
    appliesTo: '모든 프로그래머 (극도의 주의 필요)'
  },
  {
    flag: '-t',
    syntax: '-t',
    name: '대화형 터미널 모드 (Interactive Terminal Shell)',
    category: 'protocol',
    description: 'CLI 인자 대신 대화형 프롬프트(avrdude>)로 진입하여 메모리 덤프, 퓨즈 수정, EEPROM 수정을 실시간 대화식으로 수행합니다.',
    details: '진입 후 사용 가능한 명령어: "read flash 0 32" (플래시 덤프), "write lfuse 0 0xff" (퓨즈 수정), "sig" (시그니처 재확인), "quit" (종료).',
    example: 'avrdude -c usbasp -p m128 -t',
    appliesTo: '모든 ISP 프로그래머'
  },
  {
    flag: '-u',
    syntax: '-u',
    name: '안전 퓨즈 검사 비활성화 (Disable Safemode)',
    category: 'fuses',
    description: 'avrdude의 기본 기능인 safemode(의도치 않은 퓨즈 비트 변경 감지 및 자동 롤백)를 끕니다.',
    details: '일부 특수 퓨즈 비트 스크립트 실행 시 롤백 경고를 방지하기 위해 사용됩니다.',
    example: 'avrdude -c usbasp -p m640 -u -U lfuse:w:0xFF:m',
    appliesTo: '모든 프로그래머'
  },
  {
    flag: '-n',
    syntax: '-n',
    name: '시뮬레이션 모드 (Dry-Run / No-Write)',
    category: 'safety',
    description: '타깃 MCU와 통신을 맺고 서명을 확인하되, 실제 플래시나 퓨즈에 쓰기(Write) 작업을 수행하지 않습니다.',
    details: '배선과 프로그래머 드라이버가 정상인지 무위험으로 사전 테스트할 때 매우 유용합니다.',
    example: 'avrdude -c usbasp -p m328p -n -U flash:w:test.hex:i',
    appliesTo: '모든 프로그래머'
  },
  {
    flag: '-x',
    syntax: '-x <extended-param>',
    name: '확장 프로그래머 파라미터 (Extended Parameter)',
    category: 'programmer',
    description: '특정 하드웨어 디버거 또는 최신 avrdude 7.x 전용 확장 옵션을 지정합니다.',
    details: '예: Atmel-ICE에서 JTAG 데이지체인 디바이스 인덱스 설정 또는 Vtarget 전압 모니터링 파라미터 전달.',
    example: 'avrdude -c atmelice_isp -p m2560 -x vtarget=5.0',
    appliesTo: 'Atmel-ICE, JTAGICE3, STK600 등 고급 프로그래머'
  }
];

export const AvrdudeCommandReference: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  const mcuPart = useMemo(() => {
    if (selectedMCU === 'atmega2560') return 'm2560';
    if (selectedMCU === 'atmega640') return 'm640';
    if (selectedMCU === 'atmega128') return 'm128';
    return 'm328p';
  }, [selectedMCU]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Quick Assembler States
  const [assemblerAction, setAssemblerAction] = useState<'flash_write' | 'flash_read' | 'fuse_write' | 'fuse_read' | 'chip_erase' | 'interactive' | 'sig_check'>('flash_write');
  const [assemblerProg, setAssemblerProg] = useState<'usbasp' | 'arduino_isp' | 'optiboot_uart' | 'atmel_ice'>('usbasp');
  const [assemblerPort, setAssemblerPort] = useState<string>('COM3');
  const [assemblerBaud, setAssemblerBaud] = useState<number>(115200);
  const [assemblerHex, setAssemblerHex] = useState<string>('firmware.hex');
  const [assemblerSpeed, setAssemblerSpeed] = useState<'normal' | 'slow_1mhz' | 'fast'>('normal');

  // Filtered Flags
  const filteredFlags = useMemo(() => {
    return AVRDUDE_FLAGS.filter((item) => {
      const matchCat = activeCategory === 'all' || item.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        item.flag.toLowerCase().includes(q) ||
        item.syntax.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.details.toLowerCase().includes(q) ||
        item.appliesTo.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [activeCategory, searchQuery]);

  // Standard Fuses for the 4 MCUs
  const fusePresets = useMemo(() => {
    if (selectedMCU === 'atmega328p') {
      return {
        arduino: { name: '표준 아두이노 Uno (16MHz Ext Crystal, Optiboot 512B)', lfuse: '0xFF', hfuse: '0xDE', efuse: '0xFD', lock: '0x0F' },
        internal8: { name: '내부 8MHz RC 발진기 (크리스털 미장착 독립 구동)', lfuse: '0xE2', hfuse: '0xD9', efuse: '0xFF', lock: '0x3F' },
        factory1: { name: '공장 출하 초기값 (내부 1MHz, CKDIV8=0)', lfuse: '0x62', hfuse: '0xD9', efuse: '0xFF', lock: '0x3F' }
      };
    } else if (selectedMCU === 'atmega128') {
      return {
        arduino: { name: '표준 산업용 16MHz (M103C 해제, 4KB 부트로더)', lfuse: '0xFF', hfuse: '0xC9', efuse: '0xFF', lock: '0x0F' },
        internal8: { name: '내부 8MHz RC 발진기 (M103C=1, JTAG 활성)', lfuse: '0xE4', hfuse: '0x99', efuse: '0xFF', lock: '0x3F' },
        factory1: { name: '공장 출하 초기값 (M103C=0 활성화, 내부 1MHz)', lfuse: '0x21', hfuse: '0x99', efuse: '0xFF', lock: '0x3F' }
      };
    } else if (selectedMCU === 'atmega2560') {
      return {
        arduino: { name: '표준 Mega 2560 (16MHz Ext, 8KB Bootloader)', lfuse: '0xFF', hfuse: '0xD8', efuse: '0xFD', lock: '0x0F' },
        internal8: { name: '내부 8MHz RC 발진기 (독립형 제어보드)', lfuse: '0xE2', hfuse: '0xD9', efuse: '0xFF', lock: '0x3F' },
        factory1: { name: '공장 출하 초기값 (내부 1MHz, CKDIV8=0)', lfuse: '0x62', hfuse: '0x99', efuse: '0xFF', lock: '0x3F' }
      };
    } else {
      // ATmega640
      return {
        arduino: { name: '표준 16MHz 고효율 양산 (MegaCore 호환 퓨즈)', lfuse: '0xFF', hfuse: '0xD8', efuse: '0xFD', lock: '0x0F' },
        internal8: { name: '내부 8MHz RC 발진기 (BOM 원가 절감)', lfuse: '0xE2', hfuse: '0xD9', efuse: '0xFF', lock: '0x3F' },
        factory1: { name: '공장 출하 초기값 (내부 1MHz, CKDIV8=0)', lfuse: '0x62', hfuse: '0x99', efuse: '0xFF', lock: '0x3F' }
      };
    }
  }, [selectedMCU]);

  // Assembled Command Calculator
  const assembledCommand = useMemo(() => {
    let cmd = `avrdude -p ${mcuPart}`;

    if (assemblerProg === 'usbasp') {
      cmd += ' -c usbasp';
      if (assemblerSpeed === 'slow_1mhz') cmd += ' -B 32';
      else if (assemblerSpeed === 'fast') cmd += ' -B 0.5';
      else cmd += ' -B 1.5';
    } else if (assemblerProg === 'arduino_isp') {
      cmd += ` -c stk500v1 -P ${assemblerPort} -b 19200`;
    } else if (assemblerProg === 'optiboot_uart') {
      cmd += ` -c arduino -P ${assemblerPort} -b ${assemblerBaud}`;
    } else if (assemblerProg === 'atmel_ice') {
      cmd += ' -c atmelice_isp';
    }

    if (assemblerAction === 'flash_write') {
      cmd += ` -U flash:w:${assemblerHex}:i`;
    } else if (assemblerAction === 'flash_read') {
      cmd += ' -U flash:r:backup_firmware.bin:r';
    } else if (assemblerAction === 'fuse_write') {
      const f = fusePresets.arduino;
      cmd += ` -U lfuse:w:${f.lfuse}:m -U hfuse:w:${f.hfuse}:m -U efuse:w:${f.efuse}:m`;
    } else if (assemblerAction === 'fuse_read') {
      cmd += ' -U lfuse:r:-:h -U hfuse:r:-:h -U efuse:r:-:h';
    } else if (assemblerAction === 'chip_erase') {
      cmd += ' -e';
    } else if (assemblerAction === 'interactive') {
      cmd += ' -t';
    } else if (assemblerAction === 'sig_check') {
      cmd += ' -v';
    }

    return cmd;
  }, [mcuPart, assemblerProg, assemblerSpeed, assemblerPort, assemblerBaud, assemblerAction, assemblerHex, fusePresets]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.6 } });
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold tracking-wide uppercase mb-2">
            <Command className="w-3.5 h-3.5" />
            Avrdude CLI Command & Argument Reference
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-3">
            avrdude 커맨드라인 레퍼런스 (Command Reference)
            <span className="text-xs font-mono font-normal text-emerald-300 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-700/50">
              avrdude 7.x+ • {currentProfile.name} (-p {mcuPart})
            </span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            플래시 메모리 라이팅, 퓨즈/락비트 설정, 백업 및 USBasp·ArduinoISP·Optiboot 전용 필수 플래그를 빠르게 검색하고, 원클릭으로 프로덕션용 CLI 명령어를 조합해 실행하세요.
          </p>
        </div>

        {/* Quick Target Part Badge */}
        <div className="bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-800 text-right self-start lg:self-auto shrink-0">
          <div className="text-[10px] text-slate-500 uppercase font-mono font-bold">현재 타깃 MCU 파트</div>
          <div className="font-mono text-base font-black text-emerald-400">
            -p {mcuPart}
            <span className="text-xs text-slate-400 font-normal ml-2">({currentProfile.name})</span>
          </div>
        </div>
      </div>

      {/* Section A: Interactive Quick Command Assembler */}
      <div className="bg-slate-950/90 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-inner">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
            <Zap className="w-4 h-4 text-amber-400" />
            원클릭 avrdude 명령어 빠른 조합기 (Quick Command Assembler)
          </div>
          <button
            onClick={() => handleCopy(assembledCommand, 'assembler_cmd')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20"
          >
            {copiedText === 'assembler_cmd' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedText === 'assembler_cmd' ? '복사 완료!' : '조합된 명령어 복사'}</span>
          </button>
        </div>

        {/* Parameter Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          {/* Action */}
          <div>
            <label className="text-[10px] text-slate-400 block mb-1 font-sans">1. 수행할 작업 (Action):</label>
            <select
              value={assemblerAction}
              onChange={(e) => setAssemblerAction(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white focus:border-amber-400 focus:outline-none"
            >
              <option value="flash_write">플래시 펌웨어 쓰기 (-U flash:w)</option>
              <option value="flash_read">플래시 바이너리 백업 (-U flash:r)</option>
              <option value="fuse_write">표준 퓨즈비트 쓰기 (-U *fuse:w)</option>
              <option value="fuse_read">현재 퓨즈비트 읽기 (-U *fuse:r)</option>
              <option value="sig_check">칩 서명 및 연결 진단 (-v)</option>
              <option value="chip_erase">칩 완전 소거 (-e)</option>
              <option value="interactive">대화형 터미널 쉘 진입 (-t)</option>
            </select>
          </div>

          {/* Programmer */}
          <div>
            <label className="text-[10px] text-slate-400 block mb-1 font-sans">2. 프로그래머 (Programmer):</label>
            <select
              value={assemblerProg}
              onChange={(e) => setAssemblerProg(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white focus:border-amber-400 focus:outline-none"
            >
              <option value="usbasp">USBasp (-c usbasp)</option>
              <option value="arduino_isp">Arduino as ISP (-c stk500v1, 19200bps)</option>
              <option value="optiboot_uart">Optiboot UART (-c arduino, 115200bps)</option>
              <option value="atmel_ice">Atmel-ICE (-c atmelice_isp)</option>
            </select>
          </div>

          {/* Port or Speed */}
          {assemblerProg === 'usbasp' ? (
            <div>
              <label className="text-[10px] text-slate-400 block mb-1 font-sans">3. ISP 클럭 속도 (-B):</label>
              <select
                value={assemblerSpeed}
                onChange={(e) => setAssemblerSpeed(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="normal">표준 -B 1.5 (8~16MHz 크리스털)</option>
                <option value="slow_1mhz">저속 -B 32 (출하 초기 1MHz 칩 복구)</option>
                <option value="fast">고속 -B 0.5 (고속 크리스털)</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="text-[10px] text-slate-400 block mb-1 font-sans">3. 시리얼 포트 (-P):</label>
              <input
                type="text"
                value={assemblerPort}
                onChange={(e) => setAssemblerPort(e.target.value)}
                placeholder="COM3 또는 /dev/ttyUSB0"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
          )}

          {/* Hex File name or Baud */}
          {assemblerAction === 'flash_write' ? (
            <div>
              <label className="text-[10px] text-slate-400 block mb-1 font-sans">4. 헥스 파일명:</label>
              <input
                type="text"
                value={assemblerHex}
                onChange={(e) => setAssemblerHex(e.target.value)}
                placeholder="firmware.hex"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
          ) : (
            <div>
              <label className="text-[10px] text-slate-400 block mb-1 font-sans">4. 보드레이트 속도 (-b):</label>
              <input
                type="number"
                value={assemblerProg === 'arduino_isp' ? 19200 : assemblerBaud}
                disabled={assemblerProg === 'arduino_isp'}
                onChange={(e) => setAssemblerBaud(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white focus:border-amber-400 focus:outline-none disabled:opacity-50"
              />
            </div>
          )}
        </div>

        {/* Live Output Box */}
        <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono text-slate-400">
            <span>Terminal Command (Ready to Execute)</span>
            <span className="text-emerald-400 font-bold">100% Validated Syntax</span>
          </div>
          <pre className="p-3.5 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed select-all">
            {assembledCommand}
          </pre>
        </div>
      </div>

      {/* Section B: Programmer-Specific Quick Cheat Sheets (USBasp vs ArduinoISP vs Optiboot) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider px-1">
          <Cable className="w-4 h-4 text-cyan-400" />
          프로그래머별 핵심 플래그 & 실무 주의사항 (Programmer-Specific Guidelines)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* USBasp Guide Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="font-bold text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                USBasp 플래그 가이드
              </span>
              <code className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                -c usbasp
              </code>
            </div>

            <ul className="space-y-2 text-slate-300 leading-relaxed text-[11px]">
              <li>
                <strong className="text-white">• 포트(-P) 생략 가능:</strong> USBasp는 libusb VID/PID로 자동 인식되므로 <code className="text-slate-400">-P</code> 옵션을 생략해도 됩니다.
              </li>
              <li>
                <strong className="text-amber-400">• 공장 출하 칩(-B 32 필수):</strong> 박스에서 갓 꺼낸 새 칩은 내부 1MHz로 동작하므로 기본 고속 통신 시 <code className="text-rose-400">0x000000</code> 오류가 발생합니다. 반드시 <code className="text-amber-300 font-mono">-B 32</code>를 지정하세요.
              </li>
              <li>
                <strong className="text-cyan-400">• 드라이버 주의:</strong> Windows에서는 <code className="text-slate-400">Zadig</code> 유틸리티로 드라이버를 <code className="text-cyan-300">libusbK</code>로 설정해야 인식됩니다.
              </li>
            </ul>

            <div className="pt-2 border-t border-slate-800/60">
              <button
                onClick={() => handleCopy(`avrdude -p ${mcuPart} -c usbasp -B 32 -v`, 'usbasp_diag')}
                className="w-full py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-emerald-400 border border-slate-800 transition flex items-center justify-between"
              >
                <span>진단 명령어 복사 (-B 32)</span>
                {copiedText === 'usbasp_diag' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Arduino as ISP Guide Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="font-bold text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                Arduino as ISP 플래그 가이드
              </span>
              <code className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                -c stk500v1
              </code>
            </div>

            <ul className="space-y-2 text-slate-300 leading-relaxed text-[11px]">
              <li>
                <strong className="text-white">• 프로그래머 프로토콜:</strong> 아두이노 스케치 <code className="text-slate-400">ArduinoISP</code>는 STK500v1 프로토콜을 구현하므로 <code className="text-cyan-300 font-mono">-c stk500v1</code>을 사용합니다.
              </li>
              <li>
                <strong className="text-rose-400">• 보레이트 19200 고정 필수:</strong> <code className="text-amber-300 font-mono">-b 19200</code>을 명시하지 않으면 115200bps로 연결되어 프로그래머 보드 자신의 칩이 덮어쓰여질 수 있습니다!
              </li>
              <li>
                <strong className="text-emerald-400">• 오토리셋 방지 커패시터:</strong> 아두이노 보드의 RESET과 GND 사이에 10µF 커패시터를 연결해야 avrdude 연결 시 리셋되지 않습니다.
              </li>
            </ul>

            <div className="pt-2 border-t border-slate-800/60">
              <button
                onClick={() => handleCopy(`avrdude -p ${mcuPart} -c stk500v1 -P COM3 -b 19200 -v`, 'arduino_diag')}
                className="w-full py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-cyan-400 border border-slate-800 transition flex items-center justify-between"
              >
                <span>ArduinoISP 명령어 복사</span>
                {copiedText === 'arduino_diag' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Optiboot UART Bootloader Guide Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="font-bold text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Optiboot 시리얼 부트로더
              </span>
              <code className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
                -c arduino
              </code>
            </div>

            <ul className="space-y-2 text-slate-300 leading-relaxed text-[11px]">
              <li>
                <strong className="text-white">• 프로토콜:</strong> <code className="text-amber-300 font-mono">-c arduino</code> 또는 <code className="text-amber-300 font-mono">-c urclock</code> 사용. Uno는 115200bps, 구형 보드는 57600bps.
              </li>
              <li>
                <strong className="text-rose-400">• 칩 소거(-e) 절대 금지:</strong> 부트로더 프로토콜에서는 칩 소거 명령이 부트로더 자신을 날려버릴 수 있으므로 <code className="text-rose-400 font-mono">-e</code>를 절대 주지 마세요.
              </li>
              <li>
                <strong className="text-slate-400">• 퓨즈 쓰기 불가:</strong> 하드웨어 퓨즈비트는 부트로더를 통해서는 쓸 수 없습니다 (ISP 장비 필요).
              </li>
            </ul>

            <div className="pt-2 border-t border-slate-800/60">
              <button
                onClick={() => handleCopy(`avrdude -p ${mcuPart} -c arduino -P COM3 -b 115200 -U flash:w:firmware.hex:i`, 'optiboot_cmd')}
                className="w-full py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-amber-400 border border-slate-800 transition flex items-center justify-between"
              >
                <span>Optiboot 업로드 명령어 복사</span>
                {copiedText === 'optiboot_cmd' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section C: Target MCU Fuse Recipes Box */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            {currentProfile.name} 원클릭 실무 퓨즈 레시피 (Flashing & Fuse Setting Recipes)
          </div>
          <span className="text-[11px] font-mono text-amber-400">
            Format: -U memtype:w:byte:m
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Recipe 1: Standard 16MHz Crystal */}
          <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2 flex flex-col justify-between">
            <div>
              <div className="font-bold text-emerald-400 text-xs">
                1. {fusePresets.arduino.name}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                외장 16MHz 크리스털, BOD 2.7V/4.3V, 부트로더 영역 보호 설정.
              </p>
              <div className="mt-2 text-[10px] font-mono text-slate-300 bg-slate-950 p-2 rounded border border-slate-800 space-y-0.5">
                <div>LFUSE: <strong className="text-emerald-400">{fusePresets.arduino.lfuse}</strong></div>
                <div>HFUSE: <strong className="text-emerald-400">{fusePresets.arduino.hfuse}</strong></div>
                <div>EFUSE: <strong className="text-emerald-400">{fusePresets.arduino.efuse}</strong></div>
                <div>LOCK:  <strong className="text-emerald-400">{fusePresets.arduino.lock}</strong></div>
              </div>
            </div>

            <button
              onClick={() => handleCopy(
                `avrdude -p ${mcuPart} -c usbasp -B 1.5 -U lfuse:w:${fusePresets.arduino.lfuse}:m -U hfuse:w:${fusePresets.arduino.hfuse}:m -U efuse:w:${fusePresets.arduino.efuse}:m -U lock:w:${fusePresets.arduino.lock}:m`,
                'fuse_ext16'
              )}
              className="mt-2 py-1.5 px-2.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/40 text-[11px] font-mono transition flex items-center justify-between"
            >
              <span>퓨즈 쓰기 명령어 복사</span>
              {copiedText === 'fuse_ext16' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>

          {/* Recipe 2: Internal 8MHz RC */}
          <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2 flex flex-col justify-between">
            <div>
              <div className="font-bold text-cyan-400 text-xs">
                2. {fusePresets.internal8.name}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                외부 크리스털과 커패시터 없이 칩 단독 구동. 원가 절감형.
              </p>
              <div className="mt-2 text-[10px] font-mono text-slate-300 bg-slate-950 p-2 rounded border border-slate-800 space-y-0.5">
                <div>LFUSE: <strong className="text-cyan-400">{fusePresets.internal8.lfuse}</strong></div>
                <div>HFUSE: <strong className="text-cyan-400">{fusePresets.internal8.hfuse}</strong></div>
                <div>EFUSE: <strong className="text-cyan-400">{fusePresets.internal8.efuse}</strong></div>
                <div>LOCK:  <strong className="text-cyan-400">{fusePresets.internal8.lock}</strong></div>
              </div>
            </div>

            <button
              onClick={() => handleCopy(
                `avrdude -p ${mcuPart} -c usbasp -B 1.5 -U lfuse:w:${fusePresets.internal8.lfuse}:m -U hfuse:w:${fusePresets.internal8.hfuse}:m -U efuse:w:${fusePresets.internal8.efuse}:m`,
                'fuse_int8'
              )}
              className="mt-2 py-1.5 px-2.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/40 text-[11px] font-mono transition flex items-center justify-between"
            >
              <span>퓨즈 쓰기 명령어 복사</span>
              {copiedText === 'fuse_int8' ? <Check className="w-3 h-3 text-cyan-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>

          {/* Recipe 3: Factory Defaults */}
          <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2 flex flex-col justify-between">
            <div>
              <div className="font-bold text-amber-400 text-xs">
                3. {fusePresets.factory1.name}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                출하 초기 상태 복구. 1MHz 클럭이므로 이후 -B 32 필수.
              </p>
              <div className="mt-2 text-[10px] font-mono text-slate-300 bg-slate-950 p-2 rounded border border-slate-800 space-y-0.5">
                <div>LFUSE: <strong className="text-amber-400">{fusePresets.factory1.lfuse}</strong></div>
                <div>HFUSE: <strong className="text-amber-400">{fusePresets.factory1.hfuse}</strong></div>
                <div>EFUSE: <strong className="text-amber-400">{fusePresets.factory1.efuse}</strong></div>
                <div>LOCK:  <strong className="text-amber-400">{fusePresets.factory1.lock}</strong></div>
              </div>
            </div>

            <button
              onClick={() => handleCopy(
                `avrdude -p ${mcuPart} -c usbasp -B 1.5 -U lfuse:w:${fusePresets.factory1.lfuse}:m -U hfuse:w:${fusePresets.factory1.hfuse}:m -U efuse:w:${fusePresets.factory1.efuse}:m`,
                'fuse_factory'
              )}
              className="mt-2 py-1.5 px-2.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/40 text-[11px] font-mono transition flex items-center justify-between"
            >
              <span>퓨즈 복원 명령어 복사</span>
              {copiedText === 'fuse_factory' ? <Check className="w-3 h-3 text-amber-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* Section D: Searchable avrdude Flag Directory Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            avrdude 커맨드라인 아규먼트 사전 (Flag Lookup Directory)
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto text-xs font-mono">
            {[
              { id: 'all', label: '전체 플래그' },
              { id: 'core', label: '플래싱/메모리' },
              { id: 'programmer', label: '프로그래머/포트' },
              { id: 'fuses', label: '퓨즈/락비트' },
              { id: 'safety', label: '안전/디버깅' }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                  activeCategory === cat.id
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="플래그 또는 기능 검색 (예: -U, -B, -c, usbasp, baud, fuse, eeprom)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition font-mono"
          />
        </div>

        {/* Flag Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredFlags.map((item) => (
            <div
              key={item.flag}
              className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2.5 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black text-emerald-400">
                      {item.flag}
                    </span>
                    <span className="text-xs font-mono text-slate-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {item.syntax}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white mt-1">
                    {item.name}
                  </div>
                </div>

                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 shrink-0">
                  {item.appliesTo}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {item.description}
              </p>

              <div className="text-[11px] text-slate-400 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed font-sans">
                {item.details}
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
                <code className="text-[11px] font-mono text-emerald-300 truncate max-w-[280px]">
                  {item.example}
                </code>
                <button
                  onClick={() => handleCopy(item.example, `flag_${item.flag}`)}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-[10px] font-mono border border-slate-800 transition flex items-center gap-1 shrink-0"
                >
                  {copiedText === `flag_${item.flag}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedText === `flag_${item.flag}` ? '복사됨' : '예시 복사'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
