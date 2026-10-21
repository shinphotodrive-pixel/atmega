import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { MakefileGenerator } from './MakefileGenerator';
import { InterruptVectorTableGenerator } from './InterruptVectorTableGenerator';
import { FirmwareCrcIntegrityCalculator } from './FirmwareCrcIntegrityCalculator';
import { SerialProtocolDataLogger } from './SerialProtocolDataLogger';
import { TimerCounterSimulator } from './TimerCounterSimulator';
import { OptibootBuildConfigurator } from './OptibootBuildConfigurator';
import { BootloaderSelectorConfig } from './BootloaderSelectorConfig';
import {
  Download,
  Terminal,
  Cpu,
  Layers,
  Zap,
  Cable,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Info,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Sliders,
  FileCode2,
  HelpCircle,
  HardDrive,
  Play,
  Pause,
  RefreshCw,
  Radio,
  Clock,
  Settings,
  Share2,
  Code2,
  Wrench,
  CheckCircle,
  XCircle,
  FolderOpen
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU: (mcu: SupportedMCU) => void;
}

export type ProgrammerType = 'usbasp' | 'uart_bootloader' | 'arduino_isp' | 'atmel_ice' | 'stk500' | 'hvpp';

export interface ProgrammerConfig {
  id: ProgrammerType;
  name: string;
  category: 'ISP (SPI)' | 'UART Bootloader' | 'JTAG & OCD' | 'High-Voltage';
  avrdudeId: string;
  defaultBaud?: number;
  interfaceType: string;
  description: string;
  speedFlag: string;
  pros: string;
  cons: string;
  voltage: '5V / 3.3V 점퍼 지원' | '5V 또는 3.3V' | '5V / 3.3V 자동 타깃 감지' | '12V 펄스 + 5V';
}

const PROGRAMMERS: ProgrammerConfig[] = [
  {
    id: 'usbasp',
    name: 'USBasp (표준 범용 저가 ISP 프로그래머)',
    category: 'ISP (SPI)',
    avrdudeId: 'usbasp',
    interfaceType: 'ISP (SPI 6-Pin / 10-Pin)',
    description: 'Thomas Fischl의 오픈소스 USB 프로그래머. 펌웨어 최초 플래싱, 퓨즈 비트 수정 및 부트로더 라이팅 표준 도구.',
    speedFlag: '-B 1.5',
    pros: '저렴한 가격, 표준 6핀/10핀 케이블 지원, Zadig로 손쉬운 libusb 드라이버 설치',
    cons: '하드웨어 온칩 디버깅(OCD) 미지원, 팩토리 1MHz 칩 플래싱 시 -B 32 저속 옵션 필요',
    voltage: '5V / 3.3V 점퍼 지원'
  },
  {
    id: 'uart_bootloader',
    name: 'USB-to-UART 모듈 (Optiboot / 시리얼 부트로더)',
    category: 'UART Bootloader',
    avrdudeId: 'arduino',
    defaultBaud: 115200,
    interfaceType: 'Serial UART (RX/TX + DTR Auto-Reset)',
    description: 'CH340, CP2102, FT232R을 이용한 부트로더 기반 펌웨어 다운로드. DTR 핀을 통한 0.1µF 오토 리셋 회로 필수.',
    speedFlag: '-b 115200',
    pros: 'ISP 프로그래머 없이 USB 케이블만으로 손쉬운 업데이트 가능, 시리얼 통신 겸용',
    cons: '부트로더가 사전 설치되어 있어야 함, 퓨즈 비트 변경 및 벽돌 복구 불가',
    voltage: '5V 또는 3.3V'
  },
  {
    id: 'arduino_isp',
    name: 'Arduino as ISP (아두이노 보드를 ISP로 업사이클링)',
    category: 'ISP (SPI)',
    avrdudeId: 'stk500v1',
    defaultBaud: 19200,
    interfaceType: 'ISP (SPI via Arduino GPIO)',
    description: '여분의 Arduino Uno/Nano에 "ArduinoISP" 예제 스케치를 업로드하여 전용 프로그래머 없이 타깃 MCU를 플래싱.',
    speedFlag: '-b 19200',
    pros: '별도 하드웨어 구매 불필요, 모든 아두이노 보드 호환',
    cons: '프로그래머 아두이노의 RESET과 GND 사이에 10µF 커패시터 장착 필수 (오토리셋 방지)',
    voltage: '5V 또는 3.3V'
  },
  {
    id: 'atmel_ice',
    name: 'Atmel-ICE / Power Debugger (정품 프로그래머 & 디버거)',
    category: 'JTAG & OCD',
    avrdudeId: 'atmelice_isp',
    interfaceType: 'JTAG / ISP / debugWIRE / PDI',
    description: 'Microchip 공식 정품 디버거/프로그래머. 초고속 프로그래밍과 소스코드 레벨 하드웨어 브레이크포인트 실시간 디버깅 지원.',
    speedFlag: '-B 0.5',
    pros: '초고속 전송 속도, 타깃 VCC 1.62V~5.5V 자동 감지 레벨 시프터 내장, JTAG 온칩 디버깅',
    cons: '고가의 가격대, 50mil 소형 커넥터 변환 젠더 필요',
    voltage: '5V / 3.3V 자동 타깃 감지'
  },
  {
    id: 'stk500',
    name: 'STK500 / AVR ISP mkII 호환 프로그래머',
    category: 'ISP (SPI)',
    avrdudeId: 'stk500v2',
    defaultBaud: 115200,
    interfaceType: 'ISP / STK500v2 Protocol',
    description: 'Microchip 전통의 STK500v2 프로토콜 지원 ISP 프로그래머. 산업용 툴체인 및 오래된 IDE와 완벽한 호환성.',
    speedFlag: '-B 1.0',
    pros: '안정적인 통신 핸드셰이크, 폭넓은 구형 툴체인 호환성',
    cons: '가상 COM 포트 드라이버 설정 필요',
    voltage: '5V / 3.3V 점퍼 지원'
  },
  {
    id: 'hvpp',
    name: 'HVPP / 12V 퓨즈 닥터 (고전압 병렬 프로그래밍)',
    category: 'High-Voltage',
    avrdudeId: 'stk500pp',
    interfaceType: 'Parallel 12V High-Voltage Programming',
    description: 'RSTDISBL(리셋 비활성화)이나 SPIEN 해제로 완전히 브릭(Brick)되어 ISP 접속이 불가능해진 AVR을 12V 리셋 펄스로 강제 초기화.',
    speedFlag: '-B 10',
    pros: '어떤 퓨즈 비트 실수(클럭 오류, 리셋 핀 차단)로 잠긴 칩도 100% 공장 초기화 복구 가능',
    cons: '20개 이상의 병렬 핀 결선 필요, 12V 정밀 전원 인가 필요',
    voltage: '12V 펄스 + 5V'
  }
];

// Toolchain Guides
export type ToolchainType = 'arduino_ide' | 'microchip_studio' | 'platformio' | 'avrdudess' | 'avrdude_cli';

interface ToolchainGuide {
  id: ToolchainType;
  name: string;
  badge: string;
  summary: string;
  steps: { title: string; desc: string; code?: string }[];
  configSnippet?: { title: string; lang: string; code: string };
}

const TOOLCHAIN_GUIDES: ToolchainGuide[] = [
  {
    id: 'arduino_ide',
    name: 'Arduino IDE 2.x & MegaCore / MiniCore',
    badge: '가장 추천 (입문 & 빠른 프로토타이핑)',
    summary: 'MCUdude의 MegaCore(ATmega640/128) 및 MiniCore(ATmega328P) 서드파티 보드 패키지를 등록하여 클릭 한 번으로 컴파일, 퓨즈 설정 및 다운로드를 수행합니다.',
    steps: [
      {
        title: '1. 보드 매니저 추가 URL 등록',
        desc: 'Arduino IDE [설정 (Preferences)] -> [추가 보드 관리자 URL]에 아래 URL을 입력합니다:',
        code: 'https://mcudude.github.io/MegaCore/package_MCUdude_MegaCore_index.json\nhttps://mcudude.github.io/MiniCore/package_MCUdude_MiniCore_index.json'
      },
      {
        title: '2. 보드 매니저에서 패키지 설치',
        desc: '[도구] -> [보드] -> [보드 매니저]에서 "MegaCore" 또는 "MiniCore"를 검색하여 설치합니다.'
      },
      {
        title: '3. 타깃 MCU, 클럭 및 프로그래머 선택',
        desc: '[도구] 메뉴에서 [보드: ATmega640 / ATmega128 / ATmega328], [Clock: External 16 MHz], [Programmer: USBasp 또는 Arduino as ISP]를 선택합니다.'
      },
      {
        title: '4. 부트로더 굽기 또는 프로그래머를 이용해 업로드',
        desc: '새 칩인 경우 먼저 [도구] -> [부트로더 굽기]를 눌러 퓨즈 비트(16MHz 외부 크리스털)를 초기화합니다. 이후 [스케치] -> [프로그래머를 써서 업로드 (Ctrl+Shift+U)]를 클릭하면 다운로드가 완료됩니다.'
      }
    ]
  },
  {
    id: 'microchip_studio',
    name: 'Microchip Studio (구 Atmel Studio) / MPLAB X',
    badge: '공식 프로덕션 IDE (Bare-metal C & 디버깅)',
    summary: 'Microchip 공식 툴체인으로 Atmel-ICE, AVRISP mkII, STK500을 이용해 레지스터 레벨 펌웨어 라이팅과 온칩 디버깅(OCD)을 완벽 지원합니다.',
    steps: [
      {
        title: '1. Device Programming 창 열기',
        desc: '상단 메뉴 [Tools] -> [Device Programming] (단축키: Ctrl+Shift+P)을 실행합니다.'
      },
      {
        title: '2. Tool, Device, Interface 선택 후 Apply',
        desc: 'Tool: Atmel-ICE (또는 STK500), Device: ATmega640/128/328P, Interface: ISP 또는 JTAG를 선택한 뒤 [Apply] 버튼을 누릅니다.'
      },
      {
        title: '3. Device Signature 및 타깃 전압 읽기',
        desc: '[Device signature] 옆의 [Read] 버튼을 눌러 "0x1E 0x96 0x08" 등 정상 시그니처가 읽히는지 확인합니다. 타깃 전압(Target Voltage)이 5.0V 또는 3.3V로 정상 공급되는지 확인합니다.'
      },
      {
        title: '4. Memories 탭에서 .hex 플래싱',
        desc: '좌측 [Memories] 탭 클릭 -> Flash (.hex) 경로에서 컴파일된 Release 바이너리를 지정한 뒤 [Program] 버튼을 클릭하면 플래시 라이팅 및 자동 Verify가 완료됩니다.'
      }
    ]
  },
  {
    id: 'platformio',
    name: 'VS Code + PlatformIO IDE',
    badge: '모던 개발 환경 (CI/CD & 크로스플랫폼)',
    summary: 'Visual Studio Code 기반으로 Makefile 없이 빠른 의존성 관리, 고속 빌드, 원클릭 업로드 스크립트를 제공합니다.',
    steps: [
      {
        title: '1. platformio.ini 환경 구성',
        desc: '프로젝트 루트의 platformio.ini 파일에 타깃 MCU와 프로그래머 프로토콜을 정의합니다.',
        code: `[env:atmega640]
platform = atmelavr
board = atmega640
board_build.f_cpu = 16000000L
upload_protocol = usbasp
upload_flags =
    -B
    1.5`
      },
      {
        title: '2. 컴파일 및 업로드 단축키 실행',
        desc: 'VS Code 하단 상태바의 [체크표시 (Build: Ctrl+Alt+B)]를 눌러 바이너리를 빌드한 후, [화살표 (Upload: Ctrl+Alt+U)]를 클릭하면 avrdude가 자동 호출되어 타깃에 다운로드됩니다.'
      }
    ]
  },
  {
    id: 'avrdudess',
    name: 'AVRDUDESS (Windows 오픈소스 GUI 플래셔)',
    badge: 'GUI 편의 도구 (독립 실행형 라이터)',
    summary: 'Zak Kemble이 개발한 GUI 도구로, 별도의 무거운 IDE 설치 없이 컴파일된 .hex 파일과 퓨즈 비트를 직관적인 체크박스로 확인하며 즉시 다운로드할 수 있습니다.',
    steps: [
      {
        title: '1. 프로그래머 & MCU 선택',
        desc: 'Programmer 드롭다운에서 [USBasp] 또는 [Arduino], MCU에서 [ATmega640 / ATmega128 / ATmega328P]를 선택하고 [Detect]를 누릅니다.'
      },
      {
        title: '2. Flash 파일 선택 및 옵션 지정',
        desc: 'Flash 영역에서 다운로드할 .hex 파일을 찾아보기로 선택하고 [Format: Intel Hex]로 지정합니다. [Erase chip (-e)]을 체크합니다.'
      },
      {
        title: '3. [Program!] 버튼 클릭',
        desc: '우측 하단의 [Program!] 버튼을 클릭하면 내장된 avrdude가 실행되며 실시간 콘솔에 전송 로그와 프로그레스가 표시됩니다.'
      }
    ]
  },
  {
    id: 'avrdude_cli',
    name: 'avrdude 커맨드라인 CLI (Terminal / Shell)',
    badge: '엔지니어 표준 (스크립트 & 공정 양산)',
    summary: '모든 AVR 툴체인의 기반이 되는 오픈소스 플래싱 도구. 배치 스크립트(.bat / .sh)에 포함시켜 공장 양산 라인에서 자동화 다운로드를 수행할 때 사용됩니다.',
    steps: [
      {
        title: '1. 터미널 열기',
        desc: 'PowerShell, macOS Terminal 또는 Linux Bash를 열고 컴파일된 바이너리가 있는 디렉터리로 이동합니다.'
      },
      {
        title: '2. 칩 연결 상태 테스트 (Read Signature)',
        desc: '다운로드 전 통신이 정상인지 확인하기 위해 서명을 먼저 읽어봅니다:',
        code: 'avrdude -p m640 -c usbasp -B 1.5'
      },
      {
        title: '3. 프로덕션 플래싱 실행',
        desc: '칩 소거, 플래시 쓰기, 검증(Verify)을 포함한 표준 명령어를 실행합니다:',
        code: 'avrdude -p m640 -c usbasp -B 1.5 -e -U flash:w:firmware.hex:i'
      }
    ]
  }
];

// Sample Intel HEX Data for Virtual Simulation
const SAMPLE_HEX = `:100000000C9434000C9446000C9446000C94460058
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

export const ProgramTab: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Options State
  const [selectedProgrammer, setSelectedProgrammer] = useState<ProgrammerType>('usbasp');
  const [selectedToolchain, setSelectedToolchain] = useState<ToolchainType>('arduino_ide');
  const [comPort, setComPort] = useState<string>('COM3');
  const [hexFileName, setHexFileName] = useState<string>('firmware.hex');
  const [eepFileName, setEepFileName] = useState<string>('');
  const [ispClockSpeed, setIspClockSpeed] = useState<string>('normal'); // 'slow_1mhz', 'normal', 'fast'
  const [eraseChip, setEraseChip] = useState<boolean>(true);
  const [verifyFlash, setVerifyFlash] = useState<boolean>(true);
  const [includeFuses, setIncludeFuses] = useState<boolean>(false);
  const [forceOverride, setForceOverride] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);

  // Virtual Flasher Simulator State
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationProgress, setSimulationProgress] = useState<number>(0);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [simulationStatus, setSimulationStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const terminalRef = useRef<HTMLDivElement>(null);

  const currentProg = useMemo(() => {
    return PROGRAMMERS.find((p) => p.id === selectedProgrammer) || PROGRAMMERS[0];
  }, [selectedProgrammer]);

  // Target MCU Specific Physical ISP Pins
  const isppPinMapping = useMemo(() => {
    if (selectedMCU === 'atmega128') {
      return {
        mcuName: 'ATmega128 (64-pin TQFP)',
        flashSize: '128 KB (Page: 256 바이트)',
        signature: '0x1E 0x97 0x02',
        resetPin: 'Pin 20 (/RESET)',
        sckPin: 'Pin 11 (PB1 / SCK)',
        mosiPin: 'Pin 2 (PE0 / PDI) ⚠️ 일반 MOSI 아님!',
        misoPin: 'Pin 3 (PE1 / PDO) ⚠️ 일반 MISO 아님!',
        vccPin: 'Pin 21, 52 (VCC 5V/3.3V)',
        gndPin: 'Pin 22, 53 (GND)',
        uartRx: 'Pin 2 (PE0 / RXD0)',
        uartTx: 'Pin 3 (PE1 / TXD0)',
        jtagPins: 'Pin 56~59 (PF4~PF7: TCK, TMS, TDO, TDI)',
        warning: '⚠️ [치명적 주의] ATmega128의 ISP 프로그래밍 핀은 PB2/PB3(일반 SPI)이 아니라 PE0(PDI)와 PE1(PDO)입니다! 개발자들이 가장 흔하게 겪는 배선 오류 1위입니다.'
      };
    } else if (selectedMCU === 'atmega640') {
      return {
        mcuName: 'ATmega640 (100-pin TQFP)',
        flashSize: '64 KB (Page: 256 바이트)',
        signature: '0x1E 0x96 0x08',
        resetPin: 'Pin 30 (/RESET)',
        sckPin: 'Pin 20 (PB1 / SCK)',
        mosiPin: 'Pin 21 (PB2 / MOSI)',
        misoPin: 'Pin 22 (PB3 / MISO)',
        vccPin: 'Pin 10, 31, 61, 80 (VCC)',
        gndPin: 'Pin 11, 32, 62, 81 (GND)',
        uartRx: 'Pin 2 (PE0 / RXD0)',
        uartTx: 'Pin 3 (PE1 / TXD0)',
        jtagPins: 'Pin 90~93 (PF4~PF7: TCK, TMS, TDO, TDI)',
        warning: '💡 ATmega640 100핀 모델은 ISP(PB1~3) 외에도 10핀 JTAG 포트(PF4~7)를 통한 초고속 플래싱 및 Atmel-ICE 하드웨어 온칩 실시간 디버깅을 지원합니다.'
      };
    } else if (selectedMCU === 'atmega2560') {
      return {
        mcuName: 'ATmega2560 (100-pin TQFP / Arduino Mega 2560)',
        flashSize: '256 KB (Page: 256 바이트 / 1024 Pages)',
        signature: '0x1E 0x98 0x01',
        resetPin: 'Pin 30 (/RESET)',
        sckPin: 'Pin 20 (PB1 / SCK / Arduino D52)',
        mosiPin: 'Pin 21 (PB2 / MOSI / Arduino D51)',
        misoPin: 'Pin 22 (PB3 / MISO / Arduino D50)',
        vccPin: 'Pin 10, 31, 61, 80 (VCC 5V)',
        gndPin: 'Pin 11, 32, 62, 81 (GND)',
        uartRx: 'Pin 2 (PE0 / RXD0 / Arduino D0)',
        uartTx: 'Pin 3 (PE1 / TXD0 / Arduino D1)',
        jtagPins: 'Pin 90~93 (PF4~PF7: TCK, TMS, TDO, TDI)',
        warning: '💡 ATmega2560은 256KB 대용량 플래시(128K Words)를 갖추고 있어 avrdude에서 -p m2560 플래그로 64KW 이상의 확장 주소(RAMPZ/EIND)를 지원하는 STK500v2 또는 Wiring 부트로더(115200bps)를 사용합니다.'
      };
    } else {
      return {
        mcuName: 'ATmega328P (28-pin DIP / 32-pin TQFP)',
        flashSize: '32 KB (Page: 128 바이트)',
        signature: '0x1E 0x95 0x0F',
        resetPin: 'Pin 1 (PC6 / /RESET) [DIP]',
        sckPin: 'Pin 19 (PB5 / SCK, Arduino D13)',
        mosiPin: 'Pin 17 (PB3 / MOSI, Arduino D11)',
        misoPin: 'Pin 18 (PB4 / MISO, Arduino D12)',
        vccPin: 'Pin 7, 20 (VCC, AVCC)',
        gndPin: 'Pin 8, 22 (GND)',
        uartRx: 'Pin 2 (PD0 / RXD)',
        uartTx: 'Pin 3 (PD1 / TXD)',
        jtagPins: '미지원 (debugWIRE 단선 디버깅 지원)',
        warning: '💡 아두이노 우노/나노 표준 6핀 ICSP 헤더와 1:1 직결되며, DTR 핀에 0.1µF 커패시터를 연결하여 Optiboot 시리얼 업로드가 가능합니다.'
      };
    }
  }, [selectedMCU]);

  // Generate Avrdude Command
  const generatedAvrdudeCmd = useMemo(() => {
    let cmd = 'avrdude';

    // 1. MCU Target Part
    const mcuPart = selectedMCU === 'atmega2560' ? 'm2560' : selectedMCU === 'atmega640' ? 'm640' : selectedMCU === 'atmega128' ? 'm128' : 'm328p';
    cmd += ` -p ${mcuPart}`;

    // 2. Programmer
    cmd += ` -c ${currentProg.avrdudeId}`;

    // 3. Port (for UART or Arduino as ISP)
    if (selectedProgrammer === 'uart_bootloader' || selectedProgrammer === 'arduino_isp' || selectedProgrammer === 'stk500') {
      cmd += ` -P ${comPort}`;
      if (currentProg.defaultBaud) {
        cmd += ` -b ${currentProg.defaultBaud}`;
      }
    }

    // 4. ISP Clock Speed (-B flag)
    if (selectedProgrammer === 'usbasp' || selectedProgrammer === 'atmel_ice' || selectedProgrammer === 'stk500') {
      if (ispClockSpeed === 'slow_1mhz') {
        cmd += ' -B 32'; // Slow speed for 1MHz unconfigured factory chips
      } else if (ispClockSpeed === 'fast') {
        cmd += ' -B 0.5';
      } else {
        cmd += ' -B 1.5';
      }
    }

    // 5. Erase chip
    if (eraseChip) {
      cmd += ' -e';
    }

    // 6. Flash write
    cmd += ` -U flash:w:${hexFileName}:i`;

    // 7. EEPROM write (optional)
    if (eepFileName.trim()) {
      cmd += ` -U eeprom:w:${eepFileName.trim()}:i`;
    }

    // 8. Fuses (optional)
    if (includeFuses) {
      if (selectedMCU === 'atmega328p') {
        cmd += ' -U lfuse:w:0xFF:m -U hfuse:w:0xDE:m -U efuse:w:0xFD:m';
      } else if (selectedMCU === 'atmega128') {
        cmd += ' -U lfuse:w:0xFF:m -U hfuse:w:0xC9:m -U efuse:w:0xFF:m';
      } else {
        cmd += ' -U lfuse:w:0xFF:m -U hfuse:w:0xD8:m -U efuse:w:0xFD:m';
      }
    }

    // 9. Disable verification if unchecked
    if (!verifyFlash) {
      cmd += ' -V';
    }

    // 10. Force override signature flag (with warning)
    if (forceOverride) {
      cmd += ' -F';
    }

    return cmd;
  }, [
    selectedMCU,
    currentProg,
    selectedProgrammer,
    comPort,
    ispClockSpeed,
    eraseChip,
    hexFileName,
    eepFileName,
    includeFuses,
    verifyFlash,
    forceOverride
  ]);

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(generatedAvrdudeCmd);
    setCopiedCmd(true);
    confetti({
      particleCount: 25,
      spread: 50,
      origin: { y: 0.8 }
    });
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleCopyCodeSnippet = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeIdx(idx);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  // Run Virtual Download Simulation
  const handleStartSimulation = () => {
    if (isSimulating) return;

    setIsSimulating(true);
    setSimulationStatus('running');
    setSimulationProgress(0);
    setSimulationLogs([]);

    const steps = [
      { text: `avrdude: Version 7.2 initialized`, delay: 100, pct: 5 },
      { text: `avrdude: Connecting to programmer [${currentProg.avrdudeId}]...`, delay: 300, pct: 15 },
      { text: `avrdude: Programmer type: ${currentProg.interfaceType}`, delay: 500, pct: 25 },
      { text: `avrdude: Target VCC detected: 5.01V (Stable)`, delay: 700, pct: 35 },
      { text: `avrdude: AVR device initialized and ready to accept instructions`, delay: 900, pct: 45 },
      { text: `avrdude: Device signature = ${isppPinMapping.signature} (${selectedMCU.toUpperCase()}) - MATCH!`, delay: 1200, pct: 55 },
      { text: `avrdude: Erasing chip memory (-e)... done.`, delay: 1500, pct: 65 },
      { text: `avrdude: Reading "${hexFileName}": 3,420 bytes loaded`, delay: 1800, pct: 75 },
      { text: `avrdude: Writing flash [####################################] 100% (3,420 bytes, 0.42s)`, delay: 2200, pct: 88 },
      { text: `avrdude: Verifying flash against "${hexFileName}"... verified successfully!`, delay: 2600, pct: 96 },
      { text: `avrdude: Safely releasing target reset line. MCU rebooting with new firmware!`, delay: 2900, pct: 100 },
      { text: `\n🎉 [SUCCESS] 펌웨어 다운로드 완료! 타깃 마이크로컨트롤러가 정상 부팅되었습니다.`, delay: 3100, pct: 100 }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        const item = steps[currentStep];
        setSimulationLogs((prev) => [...prev, item.text]);
        setSimulationProgress(item.pct);
        currentStep++;

        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      } else {
        clearInterval(interval);
        setIsSimulating(false);
        setSimulationStatus('success');
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }, 280);
  };

  const handleResetSimulation = () => {
    setIsSimulating(false);
    setSimulationStatus('idle');
    setSimulationProgress(0);
    setSimulationLogs([]);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-amber-950/40 border border-slate-800 p-6 sm:p-8 backdrop-blur shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                <Download className="w-3.5 h-3.5" /> 프로그램 & 펌웨어 다운로딩 마스터 가이드
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
                avrdude 7.x+ / USBasp / Optiboot / JTAG
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 text-xs font-mono font-bold">
                {currentProfile.name}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 text-xs font-mono font-bold flex items-center gap-1">
                <FileCode2 className="w-3.5 h-3.5" /> AVR-GCC Makefile 생성기 내장
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-rose-950/60 text-rose-300 border border-rose-800/40 text-xs font-mono font-bold flex items-center gap-1">
                <Bell className="w-3.5 h-3.5" /> 인터럽트 벡터 테이블 생성기
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-xs font-mono font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Flash/EEPROM CRC-16 계산기
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 text-xs font-mono font-bold flex items-center gap-1">
                <Radio className="w-3.5 h-3.5" /> 시리얼 프로토콜 데이터 로거
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-violet-950/60 text-violet-300 border border-violet-800/40 text-xs font-mono font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> 타이머/카운터 설정 시뮬레이터
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-800/40 text-xs font-mono font-bold flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5" /> Optiboot 부트로더 빌더
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              AVR 펌웨어 다운로드 & ISP 프로그래머 배선 가이드
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              USBasp, Arduino as ISP, UART 부트로더(Optiboot) 빌더 및 설정 도구, Atmel-ICE 등 다양한 하드웨어 프로그래머를 사용한 핀 결선법과 툴체인별 플래싱 절차, 타이머/카운터 설정 시뮬레이터, 시리얼 프로토콜 데이터 로거, Flash/EEPROM 무결성 검증 CRC-16 계산기, 인터럽트 벡터 테이블 기반 ISR 코드 생성기, 컴파일러 플래그 Makefile 생성기 및 대화형 avrdude 명령어 생성기를 제공합니다.
            </p>
          </div>

          {/* Quick Target MCU Switcher */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 shrink-0">
            {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
              <button
                key={mcuId}
                onClick={() => onSelectMCU(mcuId)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                  selectedMCU === mcuId
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {MCU_PROFILES[mcuId].name}
              </button>
            ))}
          </div>
        </div>

        {/* Quick MCU Specs Banner */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px]">타깃 플래시 용량</span>
            <span className="text-amber-400 font-bold">{isppPinMapping.flashSize}</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px]">고유 디바이스 서명 (Signature)</span>
            <span className="text-cyan-400 font-bold">{isppPinMapping.signature}</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px]">ISP 리셋 핀</span>
            <span className="text-rose-400 font-bold">{isppPinMapping.resetPin}</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-500 block text-[10px]">지원 인터페이스</span>
            <span className="text-emerald-400 font-bold">
              {selectedMCU === 'atmega328p' ? 'ISP / UART / debugWIRE' : 'ISP / UART / JTAG (PF4~7)'}
            </span>
          </div>
        </div>
      </div>

      {/* Section 1: Programmer Hardware Interface Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Cable className="w-4 h-4 text-amber-400" />
            1. 프로그래머 하드웨어 방식 선택 (Hardware Programmer Setup)
          </span>
          <span className="text-[11px] text-slate-500 font-mono">총 6가지 프로그래밍 방식 비교</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {PROGRAMMERS.map((prog) => {
            const isSelected = selectedProgrammer === prog.id;
            return (
              <button
                key={prog.id}
                onClick={() => setSelectedProgrammer(prog.id)}
                className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-amber-950/40 border-amber-500 text-white shadow-xl shadow-amber-950/50 ring-1 ring-amber-500/50'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-200 truncate pr-2">
                      {prog.name.split('(')[0]}
                    </span>
                    {isSelected ? (
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <span className="text-[10px] text-slate-600 font-mono">선택</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                      {prog.category}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      avrdude: -c {prog.avrdudeId}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                    {prog.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 text-[10px] space-y-1 font-mono">
                  <div className="text-emerald-400/90 truncate">✓ 장점: {prog.pros}</div>
                  <div className="text-rose-400/90 truncate">✗ 한계: {prog.cons}</div>
                  <div className="text-slate-500 pt-0.5">전압: {prog.voltage}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: Interactive Wiring Pinout Diagram */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              2. 하드웨어 배선 가이드 ({isppPinMapping.mcuName} ↔ {currentProg.name.split('(')[0]})
            </h3>
          </div>
          <span className="text-[11px] text-amber-400 bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-900/50 font-mono font-bold">
            타깃 전압: 5.0V / 3.3V 레벨 일치 필수
          </span>
        </div>

        {/* Warning Banner for ATmega128 or others */}
        {isppPinMapping.warning && (
          <div className="p-3.5 bg-amber-950/30 border border-amber-600/50 rounded-2xl text-xs text-amber-300 leading-relaxed flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{isppPinMapping.warning}</span>
          </div>
        )}

        {/* Pin Mapping Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
            <span className="text-slate-400">프로그래머 MOSI ↔ MCU:</span>
            <span className="text-emerald-400 font-bold">{isppPinMapping.mosiPin}</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
            <span className="text-slate-400">프로그래머 MISO ↔ MCU:</span>
            <span className="text-emerald-400 font-bold">{isppPinMapping.misoPin}</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
            <span className="text-slate-400">프로그래머 SCK ↔ MCU:</span>
            <span className="text-cyan-400 font-bold">{isppPinMapping.sckPin}</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
            <span className="text-slate-400">프로그래머 /RESET ↔ MCU:</span>
            <span className="text-rose-400 font-bold">{isppPinMapping.resetPin}</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
            <span className="text-slate-400">전원 공급 VCC:</span>
            <span className="text-amber-400 font-bold">{isppPinMapping.vccPin}</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
            <span className="text-slate-400">공통 접지 GND:</span>
            <span className="text-slate-300 font-bold">{isppPinMapping.gndPin}</span>
          </div>
        </div>

        {/* Header Diagrams: 6-Pin ISP, 10-Pin ISP, and UART Auto-Reset */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
          {/* 6-Pin ISP Header */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
            <div className="text-xs font-bold text-white flex items-center justify-between">
              <span>표준 6-Pin AVR ISP 헤더 배치 (Top View)</span>
              <span className="text-[10px] text-amber-400 font-mono">ICSP 6P</span>
            </div>
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 font-mono text-xs flex justify-around items-center">
              <div className="space-y-1 text-right text-emerald-400">
                <div>(1) MISO ●</div>
                <div>(3) SCK  ●</div>
                <div>(5) /RST ●</div>
              </div>
              <div className="h-16 w-6 border-2 border-slate-700 rounded bg-slate-950 flex items-center justify-center text-[10px] text-slate-500">
                홈(Key)
              </div>
              <div className="space-y-1 text-left text-amber-400">
                <div>● VCC (2)</div>
                <div>● MOSI (4)</div>
                <div>● GND (6)</div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 pt-1">
              아두이노 우노/메가2560 보드 상의 2x3 핀 헤더와 100% 동일 규격입니다.
            </p>
          </div>

          {/* 10-Pin Kanda ISP Header */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
            <div className="text-xs font-bold text-white flex items-center justify-between">
              <span>표준 10-Pin Kanda ISP 헤더 배치 (Top View)</span>
              <span className="text-[10px] text-cyan-400 font-mono">Kanda 10P</span>
            </div>
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 font-mono text-[11px] flex justify-around items-center">
              <div className="space-y-0.5 text-right text-emerald-400">
                <div>(1) MOSI ●</div>
                <div>(3) NC   ●</div>
                <div>(5) /RST ●</div>
                <div>(7) SCK  ●</div>
                <div>(9) MISO ●</div>
              </div>
              <div className="h-20 w-5 border-2 border-slate-700 rounded bg-slate-950 flex items-center justify-center text-[9px] text-slate-500">
                홈
              </div>
              <div className="space-y-0.5 text-left text-amber-400">
                <div>● VCC (2)</div>
                <div>● GND (4)</div>
                <div>● GND (6)</div>
                <div>● GND (8)</div>
                <div>● GND (10)</div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 pt-1">
              USBasp 기본 10핀 리본 케이블 규격입니다 (6핀 변환 젠더 사용 가능).
            </p>
          </div>

          {/* UART Auto-reset Wiring */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
            <div className="text-xs font-bold text-white flex items-center justify-between">
              <span>USB-UART 부트로더 배선 (DTR 오토 리셋 회로)</span>
              <span className="text-[10px] text-emerald-400 font-mono">Optiboot</span>
            </div>
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span>USB-UART TX ──▶ {isppPinMapping.uartRx}</span>
              </div>
              <div className="flex justify-between">
                <span>USB-UART RX ◀── {isppPinMapping.uartTx}</span>
              </div>
              <div className="flex justify-between text-amber-400 font-bold">
                <span>DTR ──[ 100nF (0.1µF) ]──▶ /RESET</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>MCU /RESET ──[ 10kΩ 풀업 저항 ]──▶ VCC</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 pt-1">
              * DTR 신호의 하강 엣지가 0.1µF 커패시터를 통과해 MCU를 자동 리셋시켜 부트로더로 즉시 진입시킵니다.
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Software Toolchain Step-by-Step Flashing Guides */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              3. 소프트웨어 툴체인별 다운로드 방법 가이드
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            원하는 개발 환경을 클릭하여 상세 절차 확인
          </span>
        </div>

        {/* Toolchain Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {TOOLCHAIN_GUIDES.map((tool) => {
            const isSelected = selectedToolchain === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setSelectedToolchain(tool.id)}
                className={`whitespace-nowrap px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-1 ring-indigo-400'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <span>{tool.name.split('&')[0].trim()}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Toolchain Content */}
        {(() => {
          const activeGuide = TOOLCHAIN_GUIDES.find((g) => g.id === selectedToolchain) || TOOLCHAIN_GUIDES[0];
          return (
            <div className="space-y-4 pt-2">
              <div className="p-4 bg-indigo-950/30 border border-indigo-800/40 rounded-2xl">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-bold text-white">{activeGuide.name}</h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {activeGuide.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeGuide.summary}
                </p>
              </div>

              <div className="space-y-3">
                {activeGuide.steps.map((st, i) => (
                  <div key={i} className="p-4 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-2">
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center text-[11px] font-mono font-black">
                        {i + 1}
                      </span>
                      <span>{st.title}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed pl-7">
                      {st.desc}
                    </p>
                    {st.code && (
                      <div className="ml-7 relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                        <div className="flex justify-between items-center px-3 py-1.5 bg-slate-950/80 text-[10px] text-slate-500 font-mono border-b border-slate-800">
                          <span>Configuration / Command</span>
                          <button
                            onClick={() => handleCopyCodeSnippet(st.code!, i)}
                            className="text-amber-400 hover:text-white flex items-center gap-1 transition"
                          >
                            {copiedCodeIdx === i ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedCodeIdx === i ? '복사됨' : '복사'}</span>
                          </button>
                        </div>
                        <pre className="p-3 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                          {st.code}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Section 4: Production AVR-GCC Makefile Generator */}
      <div id="makefile-generator-section" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <FileCode2 className="w-4 h-4 text-cyan-400" />
            4. AVR-GCC 메이크파일 생성기 (Makefile Generator & 컴파일러 플래그 제안)
          </span>
          <span className="text-[11px] text-cyan-400 bg-cyan-950/60 px-2.5 py-0.5 rounded-full border border-cyan-800/40 font-mono">
            -mmcu={selectedMCU} • -Os vs -O2 • LTO • One-Click Copy
          </span>
        </div>

        <MakefileGenerator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />
      </div>

      {/* Section 5: Interrupt Vector Table & ISR Code Generator */}
      <div id="interrupt-vector-table-section" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-rose-400" />
            5. AVR 인터럽트 벡터 테이블 & ISR 코드 생성기 (Interrupt Vector Table Generator)
          </span>
          <span className="text-[11px] text-rose-400 bg-rose-950/60 px-2.5 py-0.5 rounded-full border border-rose-800/40 font-mono">
            하드웨어 우선순위 • ISR_NOBLOCK 중첩 • BADISR 세이프가드
          </span>
        </div>

        <InterruptVectorTableGenerator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />
      </div>

      {/* Section 6: Firmware CRC-16 Data Integrity Calculator */}
      <div id="crc-integrity-section" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            6. Flash/EEPROM 데이터 무결성 체크용 CRC-16 계산기 (Data Integrity & Macro Generator)
          </span>
          <span className="text-[11px] text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800/40 font-mono">
            CRC-16-CCITT • _crc_ccitt_update() • 펌웨어 변조 방지 자가 검증
          </span>
        </div>

        <FirmwareCrcIntegrityCalculator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />
      </div>

      {/* Section 7: Serial Protocol Data Logger & Baud Rate Timing Inspector */}
      <div id="serial-protocol-logger-section" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-cyan-400" />
            7. 시리얼 프로토콜 데이터 로거 & 보레이트 타이밍 검증기 (UART Packet & Timing Inspector)
          </span>
          <span className="text-[11px] text-cyan-400 bg-cyan-950/60 px-2.5 py-0.5 rounded-full border border-cyan-800/40 font-mono">
            패킷 헤더/페이로드/체크섬 검증 • 10-Bit 타이밍 도표 • FSM 파서 C 코드
          </span>
        </div>

        <SerialProtocolDataLogger selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />
      </div>

      {/* Section 8: AVR Timer/Counter Configuration Simulator & TCCR Register Builder */}
      <div id="timer-counter-simulator-section" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-violet-400" />
            8. AVR 타이머/카운터 설정 시뮬레이터 & TCCR 레지스터 생성기 (Timer/Counter Simulator)
          </span>
          <span className="text-[11px] text-violet-400 bg-violet-950/60 px-2.5 py-0.5 rounded-full border border-violet-800/40 font-mono">
            Normal / CTC / PWM 모드 • 실시간 주파수 & 오버플로우 주기 • TCCR 비트필드 자동 생성
          </span>
        </div>

        <TimerCounterSimulator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />
      </div>

      {/* Section 9: Bootloader Selector & Configuration (BLS Start Address & Flash Section Locks) */}
      <div id="bootloader-selector-config-section" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <HardDrive className="w-4 h-4 text-amber-400" />
            9. 부트로더 선택기 & 플래시 락비트 설정기 (Bootloader Selector & Configuration)
          </span>
          <span className="text-[11px] text-amber-400 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-800/40 font-mono">
            BLS 번지 계산 • BOOTSZ/BOOTRST 퓨즈 • BLB0/BLB1/LB 락비트
          </span>
        </div>

        <BootloaderSelectorConfig selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />
      </div>

      {/* Section 10: AVR Optiboot Bootloader Configurator & Build Tool */}
      <div id="optiboot-configurator-section" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <HardDrive className="w-4 h-4 text-cyan-400" />
            10. AVR Optiboot 부트로더 설정 및 빌드 도구 (Optiboot Bootloader Configurator & Builder)
          </span>
          <span className="text-[11px] text-cyan-400 bg-cyan-950/60 px-2.5 py-0.5 rounded-full border border-cyan-800/40 font-mono">
            STK500 프로토콜 • 보레이트 오차 분석 • optiboot.c 소스 & Makefile 자동 생성
          </span>
        </div>

        <OptibootBuildConfigurator selectedMCU={selectedMCU} onSelectMCU={onSelectMCU} />
      </div>

      {/* Section 11: Interactive Virtual Flasher Simulator */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              11. 가상 펌웨어 다운로드 시뮬레이터 (Virtual Firmware Flasher)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetSimulation}
              disabled={isSimulating}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>초기화</span>
            </button>
            <button
              onClick={handleStartSimulation}
              disabled={isSimulating}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSimulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isSimulating ? '다운로드 진행 중...' : '가상 다운로드 실행 (Start Flashing)'}</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          실제 타깃 하드웨어가 없더라도 avrdude와 AVR MCU 간의 ISP 통신 핸드셰이크, 디바이스 시그니처 체크, 칩 소거, 플래시 페이지 쓰기 및 검증(Verify) 과정을 실시간 콘솔로 시뮬레이션할 수 있습니다.
        </p>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400">
              진행 상태:{' '}
              {simulationStatus === 'running' && <span className="text-amber-400 font-bold">Flashing In Progress...</span>}
              {simulationStatus === 'success' && <span className="text-emerald-400 font-bold">100% Download Verified!</span>}
              {simulationStatus === 'idle' && <span className="text-slate-500">대기 중 (Ready)</span>}
            </span>
            <span className="text-emerald-400 font-bold">{simulationProgress}%</span>
          </div>
          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-emerald-500 to-cyan-500 transition-all duration-300"
              style={{ width: `${simulationProgress}%` }}
            />
          </div>
        </div>

        {/* Terminal Logs Window */}
        <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>avrdude Live Simulation Console</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              Target: {selectedMCU} @ 16.0MHz
            </span>
          </div>
          <div
            ref={terminalRef}
            className="p-4 h-48 overflow-y-auto font-mono text-xs text-slate-300 space-y-1 custom-scrollbar leading-relaxed"
          >
            {simulationLogs.length === 0 ? (
              <div className="text-slate-600 italic py-10 text-center">
                상단의 "가상 다운로드 실행 (Start Flashing)" 버튼을 클릭하면 실제 avrdude 펌웨어 라이팅 과정이 터미널에 시뮬레이션됩니다.
              </div>
            ) : (
              simulationLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={
                    log.includes('SUCCESS')
                      ? 'text-emerald-400 font-bold bg-emerald-950/30 p-2 rounded'
                      : log.includes('MATCH')
                      ? 'text-cyan-400 font-bold'
                      : log.includes('Writing') || log.includes('Erasing')
                      ? 'text-amber-300'
                      : 'text-slate-300'
                  }
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Section 11: Interactive avrdude Command Generator */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              12. 대화형 avrdude 프로덕션 명령어 생성기
            </h3>
          </div>
          <button
            onClick={handleCopyCmd}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20"
          >
            {copiedCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCmd ? '명령어 복사 완료!' : 'avrdude 명령어 복사'}</span>
          </button>
        </div>

        {/* Command Parameter Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">시리얼 포트 (COM 포트 / USB):</label>
            <input
              type="text"
              value={comPort}
              onChange={(e) => setComPort(e.target.value)}
              placeholder="예: COM3 또는 /dev/ttyUSB0"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">다운로드할 .hex 파일명:</label>
            <input
              type="text"
              value={hexFileName}
              onChange={(e) => setHexFileName(e.target.value)}
              placeholder="firmware.hex"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">ISP 클럭 속도 (-B 옵션):</label>
            <select
              value={ispClockSpeed}
              onChange={(e) => setIspClockSpeed(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
            >
              <option value="slow_1mhz">저속 -B 32 (출하 초기 1MHz 클럭 필수)</option>
              <option value="normal">표준 -B 1.5 (8MHz / 16MHz 권장)</option>
              <option value="fast">고속 -B 0.5 (고속 크리스털)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">EEPROM 파일 (선택 사항):</label>
            <input
              type="text"
              value={eepFileName}
              onChange={(e) => setEepFileName(e.target.value)}
              placeholder="미사용 시 공란"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Checkbox Options */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-300 pt-1">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={eraseChip}
              onChange={(e) => setEraseChip(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span>전체 칩 소거 (-e)</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={verifyFlash}
              onChange={(e) => setVerifyFlash(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span>플래시 기록 검증 (Verify)</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeFuses}
              onChange={(e) => setIncludeFuses(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span>표준 퓨즈비트(Fuse Bits) 동시 라이팅</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-rose-400">
            <input
              type="checkbox"
              checked={forceOverride}
              onChange={(e) => setForceOverride(e.target.checked)}
              className="accent-rose-500 rounded"
            />
            <span>시그니처 검사 강제 무시 (-F, 위험)</span>
          </label>
        </div>

        {/* Live Generated Command Block */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
            <span>터미널 실행 명령어 (PowerShell / Bash / CMD)</span>
            <span className="text-emerald-400 font-bold">Ready to Execute</span>
          </div>
          <pre className="p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed select-all">
            {generatedAvrdudeCmd}
          </pre>
        </div>
      </div>

      {/* Section 12: Troubleshooting FAQ & Error Diagnostics */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <HelpCircle className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            13. 자주 발생하는 다운로드 오류 & 하드웨어 트러블슈팅
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
            <div className="font-bold text-rose-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              오류: Device signature = 0x000000 / Yikes!
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              <strong>원인 1:</strong> 팩토리 출하 상태 칩은 내부 1MHz 클럭으로 동작하므로 프로그래머 속도가 너무 빠릅니다. 해결책: <code className="text-amber-300 font-mono">-B 32</code> 옵션을 추가하여 ISP 속도를 낮추세요.
              <br />
              <strong>원인 2:</strong> ATmega128의 경우 PE0/PE1 대신 PB2/PB3에 꽂았는지 배선을 확인하세요.
            </p>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
            <div className="font-bold text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              오류: ser_open(): can't open device / Access Denied
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              <strong>원인:</strong> 시리얼 모니터(Arduino IDE 등)가 해당 COM 포트를 점유하고 있거나, USBasp 드라이버가 인식되지 않았습니다.
              <br />
              <strong>해결책:</strong> Zadig 프로그램을 실행하여 USBasp 드라이버를 <code className="text-cyan-300 font-mono">libusbK</code>로 재설치하세요.
            </p>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
            <div className="font-bold text-cyan-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              오류: verification error, first mismatch at byte 0x0000
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              <strong>원인:</strong> 플래시 메모리 락비트(Lock Bits)가 설정되어 쓰기가 차단된 상태입니다.
              <br />
              <strong>해결책:</strong> <code className="text-amber-300 font-mono">-e</code> (Chip Erase) 옵션을 주어 칩을 완전히 소거한 후 다시 기록하세요.
            </p>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
            <div className="font-bold text-indigo-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              오류: stk500_recv(): programmer is not responding
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              <strong>원인:</strong> Optiboot UART 다운로드 중 자동 리셋이 동작하지 않았거나 통신 속도가 맞지 않습니다.
              <br />
              <strong>해결책:</strong> DTR과 RESET 사이의 100nF 커패시터 연결을 확인하고 보레이트(115200bps 또는 57600bps)를 점검하세요.
            </p>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
            <div className="font-bold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              플래싱 후 실행 불가 (MCU 벽돌/Bricked) 복구 팁
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              퓨즈비트에서 외부 크리스털을 선택했는데 크리스털(16MHz)이나 22pF 부하 커패시터가 연결되지 않았을 경우 동작을 멈춥니다. XTAL1 핀에 외부 1MHz 발진기 펄스를 인가하면 즉시 복구됩니다.
            </p>
          </div>

          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
            <div className="font-bold text-rose-300 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              주의: 타깃 전압 5V ↔ 3.3V 레벨 불일치
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              타깃 보드가 3.3V 동작(예: 센서 연동 시스템)인데 5V USBasp로 직접 플래싱하면 MCU 또는 주변 회로가 손상될 수 있습니다. 프로그래머의 3.3V 점퍼를 반드시 전환하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
