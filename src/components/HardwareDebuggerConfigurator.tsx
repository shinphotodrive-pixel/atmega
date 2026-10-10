import React, { useState, useMemo } from 'react';
import {
  Cpu,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Download,
  Info,
  Layers,
  ArrowRight,
  ShieldAlert,
  Zap,
  Activity,
  Cable,
  Play,
  RotateCcw,
  Sliders,
  CheckSquare,
  Square
} from 'lucide-react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';

interface Props {
  selectedMCU: SupportedMCU;
}

type DebugInterface = 'jtag' | 'debugwire';
type DebuggerHardware = 'atmel-ice' | 'avr-dragon' | 'jtagice3' | 'pickit4' | 'avarice-custom';

export const HardwareDebuggerConfigurator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Interface Selection (JTAG vs debugWIRE)
  // Default according to MCU: 328p only has debugWIRE, 640/128 only have JTAG
  const defaultInterface: DebugInterface = selectedMCU === 'atmega328p' ? 'debugwire' : 'jtag';
  const [selectedInterface, setSelectedInterface] = useState<DebugInterface>(defaultInterface);
  const [selectedDebugger, setSelectedDebugger] = useState<DebuggerHardware>('atmel-ice');

  // Clock configuration
  const [clockFreqMHz, setClockFreqMHz] = useState<number>(16);
  const [ckdiv8Programmed, setCkdiv8Programmed] = useState<boolean>(false); // false = unprogrammed (1), true = programmed (0)

  // Fuse configuration states (0 = Programmed/Enabled in AVR fuses, 1 = Unprogrammed/Disabled)
  const [jtagEnBit, setJtagEnBit] = useState<boolean>(true); // true = Enabled (bit 0)
  const [ocdEnBit, setOcdEnBit] = useState<boolean>(true); // true = Enabled (bit 0)
  const [dwEnBit, setDwEnBit] = useState<boolean>(true); // true = Enabled (bit 0)
  const [spienBit, setSpienBit] = useState<boolean>(true); // true = Enabled (bit 0) - Always safe

  // Hardware circuit checks
  const [dtrCapDisconnected, setDtrCapDisconnected] = useState<boolean>(selectedMCU !== 'atmega328p');
  const [targetVccSupplied, setTargetVccSupplied] = useState<boolean>(true);
  const [pullupValid, setPullupValid] = useState<boolean>(true);

  // Copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Interactive Live Debugger Simulator state
  const [simRunning, setSimRunning] = useState<boolean>(false);
  const [simHalted, setSimHalted] = useState<boolean>(false);
  const [simPC, setSimPC] = useState<number>(0x0040);
  const [simRegisters, setSimRegisters] = useState<{ r16: string; r24: string; r25: string; sreg: string; sp: string }>({
    r16: '0x00',
    r24: '0x5A',
    r25: '0x00',
    sreg: '0x02',
    sp: '0x21FE'
  });
  const [simLog, setSimLog] = useState<string[]>([
    'Debugger initialized. Target power detected: 5.02V.',
    'Ready to initiate on-chip debugging session.'
  ]);

  // Compatibility assessment
  const isJtagNative = selectedMCU === 'atmega640' || selectedMCU === 'atmega128';
  const isDebugWireNative = selectedMCU === 'atmega328p';
  const isInterfaceCompatible =
    (selectedInterface === 'jtag' && isJtagNative) ||
    (selectedInterface === 'debugwire' && isDebugWireNative);

  // Effective MCU Core Frequency after CKDIV8
  const effectiveCoreFreqMHz = ckdiv8Programmed ? clockFreqMHz / 8 : clockFreqMHz;
  const maxJtagTckKHz = Math.floor((effectiveCoreFreqMHz * 1000) / 4);

  // Fuse calculations
  const fuseCalc = useMemo(() => {
    let lfuse = 0xff;
    let hfuse = 0xd9;
    let efuse = 0xff;
    let partName = 'm640';

    if (selectedMCU === 'atmega640') {
      partName = 'm640';
      // Low fuse: Bit 7 is CKDIV8 (0 = programmed, 1 = unprogrammed)
      lfuse = ckdiv8Programmed ? 0x7f : 0xff; // 16MHz Crystal default: 0xFF, with CKDIV8: 0x7F
      // High fuse:
      // Bit 7: OCDEN (0 = prog, 1 = unprog)
      // Bit 6: JTAGEN (0 = prog, 1 = unprog)
      // Bit 5: SPIEN (0 = prog, 1 = unprog)
      // Bit 4: WDTON (1 = unprog)
      // Bit 3: EESAVE (1 = unprog)
      // Bit 2..1: BOOTSZ (00 = 4096w / 0x01)
      // Bit 0: BOOTRST (1 = unprog)
      hfuse = 0x19; // baseline without OCD/JTAG/SPI
      if (!ocdEnBit) hfuse |= 0x80; else hfuse &= ~0x80;
      if (!jtagEnBit) hfuse |= 0x40; else hfuse &= ~0x40;
      if (!spienBit) hfuse |= 0x20; else hfuse &= ~0x20;
      // Ext fuse:
      efuse = 0xfd; // 2.7V BOD
    } else if (selectedMCU === 'atmega128') {
      partName = 'm128';
      // ATmega128 doesn't have CKDIV8 in lfuse, lfuse is 0xFF (Ext crystal)
      lfuse = 0xff;
      // High fuse:
      // Bit 7: OCDEN
      // Bit 6: JTAGEN
      // Bit 5: SPIEN
      // Bit 4: CKOPT
      // Bit 3: EESAVE
      // Bit 2..1: BOOTSZ
      // Bit 0: BOOTRST
      hfuse = 0x19;
      if (!ocdEnBit) hfuse |= 0x80; else hfuse &= ~0x80;
      if (!jtagEnBit) hfuse |= 0x40; else hfuse &= ~0x40;
      if (!spienBit) hfuse |= 0x20; else hfuse &= ~0x20;
      efuse = 0xff; // Native ATmega128 (M103C disabled)
    } else {
      // ATmega328P
      partName = 'm328p';
      // Low fuse: Bit 7 is CKDIV8
      lfuse = ckdiv8Programmed ? 0x7f : 0xff;
      // High fuse:
      // Bit 7: RSTDISBL (1 = unprog)
      // Bit 6: DWEN (0 = prog, 1 = unprog)
      // Bit 5: SPIEN (0 = prog, 1 = unprog)
      // Bit 4: WDTON
      // Bit 3: EESAVE
      // Bit 2..1: BOOTSZ
      // Bit 0: BOOTRST
      hfuse = 0x9e;
      if (!dwEnBit) hfuse |= 0x40; else hfuse &= ~0x40;
      if (!spienBit) hfuse |= 0x20; else hfuse &= ~0x20;
      efuse = 0xfd; // 2.7V BOD
    }

    const lfuseHex = '0x' + (lfuse & 0xff).toString(16).padStart(2, '0').toUpperCase();
    const hfuseHex = '0x' + (hfuse & 0xff).toString(16).padStart(2, '0').toUpperCase();
    const efuseHex = '0x' + (efuse & 0xff).toString(16).padStart(2, '0').toUpperCase();

    return {
      partName,
      lfuse,
      hfuse,
      efuse,
      lfuseHex,
      hfuseHex,
      efuseHex
    };
  }, [selectedMCU, ckdiv8Programmed, jtagEnBit, ocdEnBit, dwEnBit, spienBit]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Hardware pin assignments based on MCU & Interface
  const pinoutMapping = useMemo(() => {
    if (selectedInterface === 'jtag') {
      if (selectedMCU === 'atmega640') {
        return [
          { name: 'TCK', pin: 'PF4 (Pin 72)', function: 'Test Clock Input (Max: F_CPU / 4)', color: 'text-amber-400' },
          { name: 'TMS', pin: 'PF5 (Pin 71)', function: 'Test Mode Select (TAP Controller state)', color: 'text-cyan-400' },
          { name: 'TDO', pin: 'PF6 (Pin 70)', function: 'Test Data Output (Target -> Debugger)', color: 'text-emerald-400' },
          { name: 'TDI', pin: 'PF7 (Pin 69)', function: 'Test Data Input (Debugger -> Target)', color: 'text-blue-400' },
          { name: 'nSRST', pin: 'RESET (Pin 20)', function: 'Target System Reset line', color: 'text-red-400' },
          { name: 'VTG', pin: 'VCC / 5V (Pins 10,31,61,80)', function: 'Voltage Target Reference Sensor', color: 'text-rose-400' },
          { name: 'GND', pin: 'GND (Pins 11,32,62,81,99)', function: 'Common System Ground', color: 'text-slate-400' }
        ];
      } else if (selectedMCU === 'atmega128') {
        return [
          { name: 'TCK', pin: 'PF4 (Pin 57)', function: 'Test Clock Input (Max: F_CPU / 4)', color: 'text-amber-400' },
          { name: 'TMS', pin: 'PF5 (Pin 56)', function: 'Test Mode Select (TAP Controller state)', color: 'text-cyan-400' },
          { name: 'TDO', pin: 'PF6 (Pin 55)', function: 'Test Data Output (Target -> Debugger)', color: 'text-emerald-400' },
          { name: 'TDI', pin: 'PF7 (Pin 54)', function: 'Test Data Input (Debugger -> Target)', color: 'text-blue-400' },
          { name: 'nSRST', pin: 'RESET (Pin 20)', function: 'Target System Reset line', color: 'text-red-400' },
          { name: 'VTG', pin: 'VCC / 5V (Pins 21,52)', function: 'Target Reference Sensing Pin', color: 'text-rose-400' },
          { name: 'GND', pin: 'GND (Pins 22,53,63)', function: 'Common Ground Return', color: 'text-slate-400' }
        ];
      } else {
        return [
          { name: 'N/A', pin: 'Not Available on ATmega328P', function: '28/32-pin AVRs lack dedicated JTAG TAP pins. Use debugWIRE (1-wire) instead.', color: 'text-amber-400' }
        ];
      }
    } else {
      // debugWIRE
      if (selectedMCU === 'atmega328p') {
        return [
          { name: 'dW / RESET', pin: 'PC6 / RESET (Pin 1 DIP / Pin 29 TQFP)', function: 'Open-drain 1-Wire Asynchronous Serial Debug Line', color: 'text-amber-400' },
          { name: 'VTG', pin: 'VCC (Pin 7 DIP / Pin 4 TQFP)', function: 'Supply Voltage Sensing (1.8V ~ 5.5V)', color: 'text-emerald-400' },
          { name: 'GND', pin: 'GND (Pin 8, 22 DIP / Pin 3, 5, 21 TQFP)', function: 'Target Common Ground Reference', color: 'text-slate-400' },
          { name: 'SCK / MOSI / MISO', pin: 'PB5, PB3, PB4', function: 'Used solely for initial fuse entry & recovery (SPI ISP)', color: 'text-cyan-400' }
        ];
      } else {
        return [
          { name: 'N/A', pin: `Not Available on ${currentProfile.name}`, function: `${currentProfile.name} is a high-pin MCU equipped with full 4-wire JTAG. debugWIRE is omitted.`, color: 'text-amber-400' }
        ];
      }
    }
  }, [selectedInterface, selectedMCU, currentProfile.name]);

  // Generated Scripts
  const avrdudeEnableCmd = useMemo(() => {
    return `# 1. 현재 퓨즈 상태 백업 (Safety Backup)
avrdude -c usbasp -p ${fuseCalc.partName} -U lfuse:r:lfuse_backup.hex:h -U hfuse:r:hfuse_backup.hex:h -U efuse:r:efuse_backup.hex:h

# 2. 하드웨어 디버거 활성화 퓨즈 쓰기 (${selectedInterface.toUpperCase()} & CKDIV8=${ckdiv8Programmed ? 'ON(1MHz)' : 'OFF(1:1)'})
avrdude -c usbasp -p ${fuseCalc.partName} -B 4 -U lfuse:w:${fuseCalc.lfuseHex}:m -U hfuse:w:${fuseCalc.hfuseHex}:m -U efuse:w:${fuseCalc.efuseHex}:m`;
  }, [fuseCalc, selectedInterface, ckdiv8Programmed]);

  const avrdudeRecoveryCmd = useMemo(() => {
    // Normal factory defaults to recover ISP
    let restoreHfuse = '0xD9';
    if (selectedMCU === 'atmega328p') restoreHfuse = '0xDE'; // DWEN unprogrammed (1)
    if (selectedMCU === 'atmega128') restoreHfuse = '0xC9';
    return `# 디버깅 세션 종료 후 일반 ISP 프로그래밍 원복 (DWEN / JTAGEN 해제)
avrdude -c usbasp -p ${fuseCalc.partName} -U lfuse:w:0xFF:m -U hfuse:w:${restoreHfuse}:m -U efuse:w:0xFD:m`;
  }, [selectedMCU, fuseCalc.partName]);

  const avariceGdbServerCmd = useMemo(() => {
    if (selectedInterface === 'jtag') {
      const toolFlag = selectedDebugger === 'atmel-ice' ? '--edbg' : selectedDebugger === 'jtagice3' ? '-3' : '-2';
      return `# AVaRICE JTAG GDB Server 실행 (Port 4242)
avarice ${toolFlag} --jtag /dev/ttyACM0 --jtag-bitrate ${Math.min(maxJtagTckKHz, 500)}kHz :4242`;
    } else {
      const toolFlag = selectedDebugger === 'atmel-ice' ? '--edbg' : '-w';
      return `# AVaRICE debugWIRE GDB Server 실행 (Port 4242, 1-wire dW)
avarice ${toolFlag} --debugwire /dev/ttyACM0 :4242`;
    }
  }, [selectedInterface, selectedDebugger, maxJtagTckKHz]);

  const gdbInitScript = useMemo(() => {
    return `# .gdbinit 또는 avr-gdb 스크립트
target remote localhost:4242
file build/firmware.elf
load
set disassemble-next-line on
break main
continue
# (브레이크포인트 도달 후 'stepi', 'next', 'info registers'로 디버깅 시작)`;
  }, []);

  const vsCodeConfig = useMemo(() => {
    return JSON.stringify(
      {
        version: '0.2.0',
        configurations: [
          {
            name: `${currentProfile.name} Hardware Debug (${selectedInterface.toUpperCase()})`,
            type: 'cppdbg',
            request: 'launch',
            program: '${workspaceFolder}/build/firmware.elf',
            miDebuggerServerAddress: 'localhost:4242',
            miDebuggerPath: 'avr-gdb',
            cwd: '${workspaceFolder}',
            setupCommands: [
              { description: 'Enable Pretty Printing', text: '-enable-pretty-printing', ignoreFailures: true },
              { description: 'Load Symbol Table', text: 'file ${workspaceFolder}/build/firmware.elf', ignoreFailures: false }
            ]
          }
        ]
      },
      null,
      2
    );
  }, [currentProfile.name, selectedInterface]);

  // Simulator Actions
  const handleConnectSim = () => {
    if (!isInterfaceCompatible) {
      setSimLog((prev) => [
        `[ERROR] Connection aborted: ${selectedInterface.toUpperCase()} is not physically supported on ${currentProfile.name}.`,
        ...prev
      ]);
      return;
    }
    if (selectedInterface === 'debugwire' && !dtrCapDisconnected) {
      setSimLog((prev) => [
        '[WARN] debugWIRE handshake failed! Auto-reset DTR capacitor is holding down the line. Please disconnect DTR capacitor!',
        ...prev
      ]);
      return;
    }
    setSimRunning(true);
    setSimHalted(true);
    setSimPC(0x0024);
    setSimLog((prev) => [
      `[OK] Connected via ${selectedDebugger.toUpperCase()} [${selectedInterface.toUpperCase()}]. Target synchronized at ${effectiveCoreFreqMHz.toFixed(1)} MHz.`,
      `[BREAK] Halted at Reset Vector 0x0024 (PC=0x0024).`,
      ...prev
    ]);
  };

  const handleStepSim = () => {
    if (!simRunning) return;
    const nextPC = simPC + 2;
    const nextR16 = '0x' + Math.floor(Math.random() * 255).toString(16).padStart(2, '0').toUpperCase();
    setSimPC(nextPC);
    setSimRegisters((prev) => ({ ...prev, r16: nextR16 }));
    setSimLog((prev) => [
      `[STEP] Instruction executed at 0x${simPC.toString(16).toUpperCase()} -> PC=0x${nextPC.toString(16).toUpperCase()} | R16 updated to ${nextR16}`,
      ...prev.slice(0, 8)
    ]);
  };

  const handleResumeSim = () => {
    if (!simRunning) return;
    setSimHalted(false);
    setSimLog((prev) => ['[RUN] Target resumed. Running at full clock speed.', ...prev]);
    setTimeout(() => {
      setSimHalted(true);
      setSimPC(0x0118);
      setSimLog((prev) => [
        '[BREAKPOINT] Hit breakpoint 1 at main() [PC=0x0118]. Target halted.',
        ...prev
      ]);
    }, 600);
  };

  const handleResetSim = () => {
    setSimRunning(false);
    setSimHalted(false);
    setSimPC(0x0000);
    setSimLog(['Debugger reset to idle state. Ready for physical session.']);
  };

  const downloadSetupScript = () => {
    const fullScript = `#!/usr/bin/env bash
# ==============================================================================
# Hardware Debugger Setup Script for ${currentProfile.name}
# Interface: ${selectedInterface.toUpperCase()} | Debugger: ${selectedDebugger.toUpperCase()}
# Generated by ATmega640 Interactive Firmware Hub
# ==============================================================================
set -e

echo "[1/4] Checking target connectivity and backing up current fuse bits..."
avrdude -c usbasp -p ${fuseCalc.partName} -U lfuse:r:lfuse_backup.hex:h -U hfuse:r:hfuse_backup.hex:h

echo "[2/4] Programming target fuse bits for ${selectedInterface.toUpperCase()} on-chip debugging..."
# LFUSE: ${fuseCalc.lfuseHex} (CKDIV8=${ckdiv8Programmed ? 'Enabled/0' : 'Disabled/1'})
# HFUSE: ${fuseCalc.hfuseHex} (OCDEN=0, ${selectedInterface === 'jtag' ? 'JTAGEN=0' : 'DWEN=0'})
avrdude -c usbasp -p ${fuseCalc.partName} -B 4 -U lfuse:w:${fuseCalc.lfuseHex}:m -U hfuse:w:${fuseCalc.hfuseHex}:m -U efuse:w:${fuseCalc.efuseHex}:m

echo "[3/4] Launching AVaRICE GDB Server on port 4242..."
${avariceGdbServerCmd} &
AVARICE_PID=$!
echo "AVaRICE running with PID: $AVARICE_PID"

echo "[4/4] Starting avr-gdb session..."
cat << 'EOF' > .gdbinit
${gdbInitScript}
EOF

avr-gdb
kill $AVARICE_PID 2>/dev/null || true
echo "Debugging session terminated."
`;
    const blob = new Blob([fullScript], { type: 'text/x-sh' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug_setup_${selectedMCU}_${selectedInterface}.sh`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Activity className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              하드웨어 디버거 환경설정기 (Hardware Debugger Configurator)
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
              JTAG & debugWIRE
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            물리적 하드웨어 디버깅(On-Chip Debugging)을 위한 JTAG 및 debugWIRE 인터페이스 선택, 클럭 분주(CKDIV8) 및 필수 퓨즈 비트(JTAGEN, DWEN, OCDEN) 분석 가이드
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={downloadSetupScript}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>설정 스크립트 (.sh)</span>
          </button>
        </div>
      </div>

      {/* Target MCU Compatibility Status Banner */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isInterfaceCompatible
          ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
          : 'bg-amber-950/30 border-amber-800/60 text-amber-300'
      }`}>
        <div className="flex items-start gap-3">
          {isInterfaceCompatible ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          )}
          <div>
            <div className="text-xs font-bold flex items-center gap-2">
              <span>현재 선택된 MCU: <strong className="text-white">{currentProfile.name}</strong></span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono">
                {selectedInterface.toUpperCase()} 인터페이스 {isInterfaceCompatible ? '완전 지원 (Native)' : '하드웨어 미지원'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              {selectedInterface === 'jtag' ? (
                isJtagNative ? (
                  `${currentProfile.name}는 4선식 표준 JTAG TAP(TCK, TMS, TDO, TDI) 하드웨어를 내장하고 있습니다. Port F의 상위 4개 핀(PF4~PF7)을 점유하며 고속 온칩 디버깅과 바운더리 스캔을 지원합니다.`
                ) : (
                  `주의: ATmega328P(28/32핀)는 물리적 핀 제약으로 JTAG 인터페이스가 탑재되지 않았습니다! 대신 1선식 debugWIRE(dW)를 사용해야 합니다.`
                )
              ) : (
                isDebugWireNative ? (
                  `${currentProfile.name}는 핀 절약형 1선식 debugWIRE 비동기 통신을 지원합니다. RESET 핀(PC6)을 양방향 오픈드레인 디버깅 라인으로 전환합니다.`
                ) : (
                  `참고: ${currentProfile.name}는 대형 패키지 MCU로 완전한 4선 JTAG을 탑재하고 있어 debugWIRE 모듈이 생략되었습니다. JTAG 인터페이스를 선택하세요.`
                )
              )}
            </p>
          </div>
        </div>

        {!isInterfaceCompatible && (
          <button
            onClick={() => setSelectedInterface(isJtagNative ? 'jtag' : 'debugwire')}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow"
          >
            권장 인터페이스({isJtagNative ? 'JTAG' : 'debugWIRE'})로 즉시 전환
          </button>
        )}
      </div>

      {/* Main Interactive Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interface & Hardware & Fuse Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Interface & Debugger Selector Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Cable className="w-4 h-4 text-cyan-400" />
              1. 디버그 인터페이스 및 하드웨어 프로브 선택
            </h3>

            {/* Interface Tabs */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedInterface('jtag')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  selectedInterface === 'jtag'
                    ? 'bg-cyan-950/40 border-cyan-500/70 text-white shadow-lg'
                    : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-cyan-300 flex items-center gap-1.5">
                    JTAG (IEEE 1149.1)
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isJtagNative ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}>
                    {isJtagNative ? 'Mega640/128 탑재' : '328P 미지원'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  4선식 버스 (TCK/TMS/TDO/TDI). 고속 풀 피처 디버깅, 플래시/레지스터 실시간 덤프, 하드웨어 브레이크포인트 4개 지원.
                </p>
              </button>

              <button
                onClick={() => setSelectedInterface('debugwire')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  selectedInterface === 'debugwire'
                    ? 'bg-amber-950/40 border-amber-500/70 text-white shadow-lg'
                    : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-amber-300 flex items-center gap-1.5">
                    debugWIRE (1-Wire dW)
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isDebugWireNative ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {isDebugWireNative ? '328P 탑재' : 'Mega640/128 미탑재'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  단일 RESET 핀(PC6) 공유. 추가 핀 점유 없음, 자동 보드레이트 동기화, 소프트웨어 브레이크포인트 기반.
                </p>
              </button>
            </div>

            {/* Probe Hardware Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  사용할 물리 하드웨어 디버거 (Hardware Probe)
                </label>
                <select
                  value={selectedDebugger}
                  onChange={(e) => setSelectedDebugger(e.target.value as DebuggerHardware)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="atmel-ice">Atmel-ICE (JTAG, debugWIRE, ISP, aWire 권장)</option>
                  <option value="avr-dragon">AVR Dragon (JTAG, debugWIRE, HVPP/HVSP 복구)</option>
                  <option value="jtagice3">JTAGICE3 / JTAGICE mkII (클래식 에뮬레이터)</option>
                  <option value="pickit4">MPLAB PICkit 4 / SNAP (Microchip 최신)</option>
                  <option value="avarice-custom">커스텀 / DIY FT232 + AVaRICE (USB-Serial)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  타깃 오실레이터 주파수 (F_OSC)
                </label>
                <select
                  value={clockFreqMHz}
                  onChange={(e) => setClockFreqMHz(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value={16}>16.000 MHz (외부 크리스털 표준)</option>
                  <option value={8}>8.000 MHz (내부 Calibrated RC / 3.3V)</option>
                  <option value={20}>20.000 MHz (오버클럭/고속)</option>
                  <option value={1}>1.000 MHz (초기 저전력 클럭)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. Critical Fuse & Clock Explainer Card (CKDIV8, JTAGEN, DWEN) */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                2. 필수 퓨즈 비트 및 클럭 분주(CKDIV8) 매커니즘
              </h3>
              <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-mono">
                AVR 퓨즈: 0 = Programmed (기능 활성)
              </span>
            </div>

            {/* Toggle 1: CKDIV8 */}
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${ckdiv8Programmed ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <span className="text-xs font-bold text-white font-mono">
                    CKDIV8 (LFUSE Bit 7) : {ckdiv8Programmed ? '0 (Programmed / 8분주)' : '1 (Unprogrammed / 1:1 직결)'}
                  </span>
                </div>
                <button
                  onClick={() => setCkdiv8Programmed(!ckdiv8Programmed)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                    ckdiv8Programmed
                      ? 'bg-amber-950 text-amber-300 border-amber-700'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  }`}
                >
                  {ckdiv8Programmed ? '8분주 해제하기 (권장)' : '8분주 활성화됨'}
                </button>
              </div>
              <div className="text-[11px] text-slate-300 leading-relaxed space-y-1">
                <p>
                  <strong>디버거 관점에서의 CKDIV8 영향:</strong> 공장 출하 시 AVR은 내부 8MHz RC에 CKDIV8=0이 프로그래밍되어 <strong>1.0 MHz</strong>로 부팅됩니다.
                </p>
                <ul className="list-disc list-inside text-slate-400 space-y-0.5 pl-1">
                  <li>
                    <strong className="text-slate-300">JTAG 제약:</strong> JTAG 클럭(TCK)은 규격상 타깃 코어 주파수의 <strong>1/4 이하</strong>여야 합니다. (F_CPU=1MHz일 때 최대 TCK=<strong>250 kHz</strong>). 디버거가 고속(1MHz 이상)으로 연결을 시도하면 핸드셰이크 실패가 발생합니다.
                  </li>
                  <li>
                    <strong className="text-slate-300">debugWIRE 제약:</strong> 1선식 통신은 타깃의 시스템 클럭을 기준으로 자동 보드레이트를 계산합니다. CKDIV8로 인해 클럭이 지나치게 느려지면 패킷 타임아웃 오류가 발생하기 쉽습니다.
                  </li>
                  <li className="text-emerald-400 font-medium">
                    해결책: 물리 디버깅 시에는 CKDIV8을 Unprogrammed(1)로 변경하여 풀 스피드(8MHz/16MHz)로 동작시키는 것이 이상적입니다.
                  </li>
                </ul>
              </div>
            </div>

            {/* Toggle 2: JTAGEN or DWEN */}
            {selectedInterface === 'jtag' ? (
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${jtagEnBit ? 'bg-cyan-400' : 'bg-slate-500'}`} />
                    <span className="text-xs font-bold text-white font-mono">
                      JTAGEN (HFUSE Bit 6) : {jtagEnBit ? '0 (Programmed / JTAG 활성화)' : '1 (Unprogrammed / JTAG 비활성화)'}
                    </span>
                  </div>
                  <button
                    onClick={() => setJtagEnBit(!jtagEnBit)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                      jtagEnBit
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {jtagEnBit ? 'JTAGEN 켜짐 (0)' : 'JTAGEN 꺼짐 (1)'}
                  </button>
                </div>
                <div className="text-[11px] text-slate-300 leading-relaxed space-y-1">
                  <p>
                    <strong>JTAGEN 활성화 시 I/O 핀 점유 주의사항:</strong>
                  </p>
                  <p className="text-slate-400">
                    JTAGEN이 0으로 설정되면 하드웨어 TAP 컨트롤러가 <strong>Port F의 PF4(TCK), PF5(TMS), PF6(TDO), PF7(TDI)</strong> 4개 핀을 완전 독점합니다. 이 핀들은 일반 GPIO 및 ADC 입력으로 동작하지 않습니다.
                  </p>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800 font-mono text-[10px] text-cyan-300">
                    // 펌웨어 런타임에서 임시로 JTAG 해제하여 GPIO 복원하는 C 코드:<br />
                    MCUCR |= (1 &lt;&lt; JTD);<br />
                    MCUCR |= (1 &lt;&lt; JTD); // 4사이클 이내에 2회 연속 기록 필수!
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${dwEnBit ? 'bg-amber-400' : 'bg-slate-500'}`} />
                    <span className="text-xs font-bold text-white font-mono">
                      DWEN (HFUSE Bit 6 on 328P) : {dwEnBit ? '0 (Programmed / debugWIRE 활성)' : '1 (Unprogrammed / 일반 Reset)'}
                    </span>
                  </div>
                  <button
                    onClick={() => setDwEnBit(!dwEnBit)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                      dwEnBit
                        ? 'bg-amber-950 text-amber-300 border-amber-700'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {dwEnBit ? 'DWEN 켜짐 (0)' : 'DWEN 꺼짐 (1)'}
                  </button>
                </div>
                <div className="text-[11px] text-slate-300 leading-relaxed space-y-1">
                  <p className="text-rose-300 font-semibold">
                    경고: DWEN 활성화 시 발생하는 특수 락아웃(Lockout) 현상
                  </p>
                  <ul className="list-disc list-inside text-slate-400 space-y-0.5 pl-1">
                    <li>
                      DWEN이 활성화되면 <strong>RESET 핀이 양방향 직렬선(dW)으로 변경</strong>되므로, 일반 ISP(SPIEN) 프로그래밍 명령어에 응답하지 않습니다. (avrdude 실행 시 타깃 미응답 오류 발생).
                    </li>
                    <li>
                      <strong>원복 절차:</strong> 디버깅 완료 후 반드시 Microchip Studio 메뉴 또는 gdb/avarice 세션 종료 명령을 통해 DWEN을 1로 복원해야 ISP 플래시 쓰기가 가능해집니다.
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Toggle 3: OCDEN */}
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${ocdEnBit ? 'bg-indigo-400' : 'bg-slate-500'}`} />
                  <span className="text-xs font-bold text-white font-mono">
                    OCDEN (HFUSE Bit 7) : {ocdEnBit ? '0 (On-Chip Debug Core 활성)' : '1 (Unprogrammed / 대기전력 절약)'}
                  </span>
                </div>
                <button
                  onClick={() => setOcdEnBit(!ocdEnBit)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                    ocdEnBit
                      ? 'bg-indigo-950 text-indigo-300 border-indigo-700'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {ocdEnBit ? 'OCDEN 켜짐 (0)' : 'OCDEN 꺼짐 (1)'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                On-Chip Debug 회로의 메인 전원을 켭니다. 양산 제품 배포 시에는 전력 소모를 줄이고 펌웨어 덤프 보안을 위해 반드시 Unprogrammed(1)로 설정해야 합니다.
              </p>
            </div>
          </div>

          {/* 3. Physical Circuit Prerequisites Checklist */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              3. 하드웨어 회로 점검 사전 체크리스트
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => setDtrCapDisconnected(!dtrCapDisconnected)}
                className={`p-2.5 rounded-lg border text-left flex items-start gap-2 transition ${
                  dtrCapDisconnected
                    ? 'bg-slate-900/90 border-emerald-500/50 text-slate-200'
                    : 'bg-rose-950/30 border-rose-800/80 text-rose-300'
                }`}
              >
                {dtrCapDisconnected ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                )}
                <div>
                  <div className="text-xs font-bold">DTR 자동 리셋 커패시터 제거</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    (Arduino Uno RESET-EN 패턴 단선 필요, 100nF 제거)
                  </div>
                </div>
              </button>

              <button
                onClick={() => setTargetVccSupplied(!targetVccSupplied)}
                className={`p-2.5 rounded-lg border text-left flex items-start gap-2 transition ${
                  targetVccSupplied
                    ? 'bg-slate-900/90 border-emerald-500/50 text-slate-200'
                    : 'bg-rose-950/30 border-rose-800/80 text-rose-300'
                }`}
              >
                {targetVccSupplied ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                )}
                <div>
                  <div className="text-xs font-bold">VTG 타깃 전원 인가 (VCC)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    (Atmel-ICE는 전원을 공급하지 않고 감지만 수행)
                  </div>
                </div>
              </button>

              <button
                onClick={() => setPullupValid(!pullupValid)}
                className={`p-2.5 rounded-lg border text-left flex items-start gap-2 transition ${
                  pullupValid
                    ? 'bg-slate-900/90 border-emerald-500/50 text-slate-200'
                    : 'bg-rose-950/30 border-rose-800/80 text-rose-300'
                }`}
              >
                {pullupValid ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                )}
                <div>
                  <div className="text-xs font-bold">RESET 풀업 저항값 확인</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    (4.7kΩ ~ 10kΩ 권장. 4.7kΩ 미만 사용 금지)
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Calculated Fuses, Physical Pinout & Simulator (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Calculated Fuses Summary Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                계산된 실시간 퓨즈 바이트
              </h3>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded font-mono">
                {currentProfile.name}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">LOW FUSE</span>
                <span className="text-base font-mono font-bold text-amber-400">{fuseCalc.lfuseHex}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {ckdiv8Programmed ? 'CKDIV8=0 (1MHz)' : 'CKDIV8=1 (1:1)'}
                </span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">HIGH FUSE</span>
                <span className="text-base font-mono font-bold text-cyan-400">{fuseCalc.hfuseHex}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {selectedInterface === 'jtag' ? 'JTAGEN=0' : 'DWEN=0'}
                </span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">EXT FUSE</span>
                <span className="text-base font-mono font-bold text-emerald-400">{fuseCalc.efuseHex}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">BOD 2.7V/Std</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>유효 시스템 코어 주파수:</span>
                <span className="font-mono font-bold text-white">{effectiveCoreFreqMHz.toFixed(2)} MHz</span>
              </div>
              {selectedInterface === 'jtag' && (
                <div className="flex justify-between text-slate-400">
                  <span>최대 안전 JTAG TCK 클럭:</span>
                  <span className="font-mono font-bold text-cyan-400">≤ {maxJtagTckKHz} kHz</span>
                </div>
              )}
            </div>
          </div>

          {/* Physical Header Wiring & Pin Mapping Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                물리 디버거 핀맵 매핑 ({selectedInterface.toUpperCase()})
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                {selectedInterface === 'jtag' ? '10-Pin Atmel JTAG' : '6-Pin AVR ISP/dW'}
              </span>
            </div>

            <div className="divide-y divide-slate-800/80 max-h-56 overflow-y-auto pr-1">
              {pinoutMapping.map((pin, idx) => (
                <div key={idx} className="py-1.5 flex items-start justify-between gap-2 text-xs">
                  <div>
                    <span className={`font-mono font-bold ${pin.color}`}>{pin.name}</span>
                    <span className="text-slate-400 text-[11px] block">{pin.function}</span>
                  </div>
                  <span className="font-mono text-slate-300 text-[11px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800 shrink-0">
                    {pin.pin}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Live Debugger Session Simulator Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                가상 디버깅 세션 시뮬레이터 (Hardware Stepping)
              </h3>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                simRunning
                  ? simHalted ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {simRunning ? (simHalted ? 'HALTED (BREAK)' : 'RUNNING') : 'DISCONNECTED'}
              </span>
            </div>

            {/* Sim Controls */}
            <div className="flex flex-wrap gap-2">
              {!simRunning ? (
                <button
                  onClick={handleConnectSim}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow"
                >
                  <Play className="w-3.5 h-3.5" />
                  디버거 연결 (Connect)
                </button>
              ) : (
                <>
                  <button
                    onClick={handleStepSim}
                    disabled={!simHalted}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold disabled:opacity-50 transition border border-slate-700"
                  >
                    단일 스텝 (Step Into F11)
                  </button>
                  <button
                    onClick={handleResumeSim}
                    disabled={!simHalted}
                    className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50 transition"
                  >
                    계속 실행 (Continue F5)
                  </button>
                  <button
                    onClick={handleResetSim}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition border border-slate-700"
                    title="연결 해제 및 초기화"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* Register State Snapshot */}
            {simRunning && (
              <div className="grid grid-cols-4 gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800 text-[10px] font-mono text-center">
                <div>
                  <span className="text-slate-500 block">PC</span>
                  <span className="text-cyan-300 font-bold">0x{simPC.toString(16).padStart(4, '0').toUpperCase()}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">R16</span>
                  <span className="text-amber-300 font-bold">{simRegisters.r16}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">SP</span>
                  <span className="text-emerald-300 font-bold">{simRegisters.sp}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">SREG</span>
                  <span className="text-slate-300 font-bold">{simRegisters.sreg}</span>
                </div>
              </div>
            )}

            {/* Sim Console Logs */}
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 font-mono text-[10px] text-slate-300 space-y-1 max-h-24 overflow-y-auto">
              {simLog.map((log, index) => (
                <div key={index} className="leading-tight text-slate-400">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CLI & Toolchain Integration Commands Accordion */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            4. 명령어 생성기 (avrdude 퓨즈 쓰기, AVaRICE GDB 서버, VS Code 세팅)
          </h3>
          <span className="text-[11px] text-slate-400">원클릭 복사 지원</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* avrdude Command */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                avrdude 디버그 퓨즈 프로그래밍
              </span>
              <button
                onClick={() => copyToClipboard(avrdudeEnableCmd, 'avrdude')}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-800 transition"
              >
                {copiedKey === 'avrdude' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'avrdude' ? '복사됨' : '복사'}</span>
              </button>
            </div>
            <pre className="text-[11px] font-mono text-slate-300 bg-slate-900/80 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {avrdudeEnableCmd}
            </pre>
          </div>

          {/* AVaRICE GDB Server Command */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                AVaRICE GDB 브리지 서버 구동 (포트 4242)
              </span>
              <button
                onClick={() => copyToClipboard(avariceGdbServerCmd, 'avarice')}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-800 transition"
              >
                {copiedKey === 'avarice' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'avarice' ? '복사됨' : '복사'}</span>
              </button>
            </div>
            <pre className="text-[11px] font-mono text-slate-300 bg-slate-900/80 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {avariceGdbServerCmd}
            </pre>
          </div>

          {/* Recovery Command */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                디버깅 종료 후 공장 출하 퓨즈 복구 (ISP 락아웃 해제)
              </span>
              <button
                onClick={() => copyToClipboard(avrdudeRecoveryCmd, 'recovery')}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-800 transition"
              >
                {copiedKey === 'recovery' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'recovery' ? '복사됨' : '복사'}</span>
              </button>
            </div>
            <pre className="text-[11px] font-mono text-slate-300 bg-slate-900/80 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {avrdudeRecoveryCmd}
            </pre>
          </div>

          {/* VS Code launch.json */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                VS Code / C++ 디버깅 launch.json 설정
              </span>
              <button
                onClick={() => copyToClipboard(vsCodeConfig, 'vscode')}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-800 transition"
              >
                {copiedKey === 'vscode' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'vscode' ? '복사됨' : '복사'}</span>
              </button>
            </div>
            <pre className="text-[11px] font-mono text-slate-300 bg-slate-900/80 p-2.5 rounded-lg overflow-x-auto whitespace-pre leading-relaxed max-h-36">
              {vsCodeConfig}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
