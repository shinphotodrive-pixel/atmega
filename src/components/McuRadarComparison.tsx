import React, { useState } from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip
} from 'recharts';
import {
  Zap,
  Gauge,
  HardDrive,
  Cpu,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  TrendingUp,
  BatteryCharging
} from 'lucide-react';
import { SupportedMCU } from '../data/pinmapData';

interface Props {
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

interface RadarDataPoint {
  subject: string;
  category: string;
  atmega2560: number;
  atmega640: number;
  atmega128: number;
  atmega328p: number;
  unit: string;
  raw2560: string;
  raw640: string;
  raw128: string;
  raw328p: string;
  description: string;
}

// 1. Core 3-Axis Dataset (Requested: Processing Speed, Flash Memory Density, Power Consumption / Efficiency)
const CORE_THREE_AXIS_DATA: RadarDataPoint[] = [
  {
    subject: '연산 속도 (Speed)',
    category: 'Processing Speed',
    atmega2560: 80,
    atmega640: 80,
    atmega128: 80,
    atmega328p: 100,
    unit: 'MHz / MIPS',
    raw2560: '16 MHz (16 MIPS @ 5V)',
    raw640: '16 MHz (16 MIPS @ 5V)',
    raw128: '16 MHz (16 MIPS @ 5V)',
    raw328p: '20 MHz (20 MIPS @ 5V)',
    description: '단일 클럭 사이클 명령어 처리 능력 및 최고 동작 주파수 (ATmega328P 정격 20MHz 최고)'
  },
  {
    subject: '플래시 집적도 (Flash)',
    category: 'Flash Memory Density',
    atmega2560: 100,
    atmega640: 35,
    atmega128: 60,
    atmega328p: 20,
    unit: 'KB Density',
    raw2560: '256 KB (최대 롬 집적도)',
    raw640: '64 KB (Self-Prog)',
    raw128: '128 KB (대용량 펌웨어)',
    raw328p: '32 KB (기본 스케치)',
    description: '온칩 프로그램 플래시 메모리 용량 및 펌웨어 수용 밀도 (ATmega2560이 256KB로 압도적 최우수)'
  },
  {
    subject: '저전력 효율 (Power)',
    category: 'Power Efficiency',
    atmega2560: 72,
    atmega640: 72,
    atmega128: 38,
    atmega328p: 98,
    unit: 'Low-Power Score',
    raw2560: '0.5 µA Sleep / 1.8V~5.5V',
    raw640: '0.5 µA Sleep / 1.8V~5.5V',
    raw128: '20 µA Sleep / 2.7V~5.5V',
    raw328p: '0.1 µA PicoPower / 1.8V~5.5V',
    description: '슬립 모드 암전류(µA) 최소화, 1.8V 저전압 배터리 구동성 및 에너지 효율 (ATmega328P 압도적 우위)'
  }
];

// 2. Comprehensive 6-Axis Extended Dataset (Speed, Flash, Power + SRAM, I/O, Peripherals)
const EXTENDED_SIX_AXIS_DATA: RadarDataPoint[] = [
  ...CORE_THREE_AXIS_DATA,
  {
    subject: 'SRAM 버퍼 용량 (SRAM)',
    category: 'SRAM Buffer',
    atmega2560: 100,
    atmega640: 100,
    atmega128: 50,
    atmega328p: 25,
    unit: 'KB RAM',
    raw2560: '8 KB (대용량 링버퍼)',
    raw640: '8 KB (대용량 링버퍼)',
    raw128: '4 KB',
    raw328p: '2 KB',
    description: '동적 데이터 버퍼 및 변수 저장용 내부 SRAM 용량 (ATmega2560 및 640이 8KB로 최우수)'
  },
  {
    subject: 'I/O 핀 밀도 (I/O Pins)',
    category: 'I/O Scalability',
    atmega2560: 100,
    atmega640: 100,
    atmega128: 62,
    atmega328p: 27,
    unit: 'Pins',
    raw2560: '86 핀 (100-TQFP)',
    raw640: '86 핀 (100-TQFP)',
    raw128: '53 핀 (64-TQFP)',
    raw328p: '23 핀 (28-DIP)',
    description: '물리적 범용 입출력 GPIO 핀 수 및 하드웨어 확장 여유 (ATmega2560/640 86핀 최다)'
  },
  {
    subject: '통신 채널 수 (USART/I2C)',
    category: 'Peripheral Channels',
    atmega2560: 100,
    atmega640: 95,
    atmega128: 50,
    atmega328p: 25,
    unit: 'Interfaces',
    raw2560: '4x USART, 16x ADC, 16x PWM',
    raw640: '4x USART, 16x ADC, 15x PWM',
    raw128: '2x USART, 8x ADC, 8x PWM',
    raw328p: '1x USART, 8x ADC, 6x PWM',
    description: '하드웨어 USART 직렬 포트 및 아날로그 ADC/PWM 채널 집적도 (ATmega2560 4개 USART 및 16개 PWM 최다)'
  }
];

export const McuRadarComparison: React.FC<Props> = ({ onSelectMCU }) => {
  const [viewMode, setViewMode] = useState<'core3' | 'full6'>('core3');
  const [activeMcus, setActiveMcus] = useState<{
    atmega2560: boolean;
    atmega640: boolean;
    atmega128: boolean;
    atmega328p: boolean;
  }>({
    atmega2560: true,
    atmega640: true,
    atmega128: true,
    atmega328p: true
  });

  const chartData = viewMode === 'core3' ? CORE_THREE_AXIS_DATA : EXTENDED_SIX_AXIS_DATA;

  const toggleMcu = (mcu: 'atmega2560' | 'atmega640' | 'atmega128' | 'atmega328p') => {
    setActiveMcus((prev) => {
      // Ensure at least one MCU remains active
      const next = { ...prev, [mcu]: !prev[mcu] };
      if (!next.atmega2560 && !next.atmega640 && !next.atmega128 && !next.atmega328p) {
        return prev;
      }
      return next;
    });
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
            <Gauge className="w-3.5 h-3.5" /> Recharts Interactive Radar Visualizer
          </div>
          <h3 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>ATmega 핵심 3요소 (연산 속도·플래시 집적도·저전력 효율) 레이더 차트 비교</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            ATmega640, ATmega128, ATmega328P의 <strong>연산 속도(Processing Speed)</strong>,{' '}
            <strong>플래시 메모리 집적도(Flash Memory Density)</strong>, <strong>전력 소비/효율(Power Consumption & Efficiency)</strong>을{' '}
            정규화(0~100)된 다차원 레이더 차트로 직관적으로 비교 분석합니다.
          </p>
        </div>

        {/* View Mode Toggle & MCU Visibility Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 3-Axis vs 6-Axis Toggle */}
          <div className="flex items-center border border-slate-800 rounded-xl overflow-hidden bg-slate-950 p-0.5">
            <button
              onClick={() => setViewMode('core3')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'core3'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              핵심 3대 지표 (Speed·Flash·Power)
            </button>
            <button
              onClick={() => setViewMode('full6')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'full6'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              종합 6대 지표 (+SRAM·I/O·통신)
            </button>
          </div>
        </div>
      </div>

      {/* MCU Toggle Chips */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
        <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-amber-400" /> 차트 표시 MCU 토글:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => toggleMcu('atmega2560')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border flex items-center gap-1.5 ${
              activeMcus.atmega2560
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm'
                : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" />
            <span>ATmega2560 (100-TQFP)</span>
          </button>
          <button
            onClick={() => toggleMcu('atmega640')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border flex items-center gap-1.5 ${
              activeMcus.atmega640
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            <span>ATmega640 (100-TQFP)</span>
          </button>
          <button
            onClick={() => toggleMcu('atmega128')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border flex items-center gap-1.5 ${
              activeMcus.atmega128
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
            <span>ATmega128 (64-TQFP)</span>
          </button>
          <button
            onClick={() => toggleMcu('atmega328p')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border flex items-center gap-1.5 ${
              activeMcus.atmega328p
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
            <span>ATmega328P (28-DIP)</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Radar Chart + Metric Breakdown Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Radar Chart Display Area */}
        <div className="lg:col-span-7 h-[380px] sm:h-[420px] w-full bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col justify-center relative">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <PolarGrid stroke="#334155" strokeDasharray="3 3" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: '#E2E8F0', fontSize: 11, fontWeight: 'bold' }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fill: '#94A3B8', fontSize: 9 }}
                stroke="#475569"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as RadarDataPoint;
                    return (
                      <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-3 shadow-2xl backdrop-blur text-xs space-y-2 max-w-xs">
                        <div className="font-bold text-white border-b border-slate-800 pb-1 flex items-center justify-between">
                          <span>{data.subject}</span>
                          <span className="text-[10px] text-amber-400 font-mono">{data.unit}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-tight">{data.description}</p>
                        <div className="space-y-1 font-mono pt-1 text-[11px]">
                          {activeMcus.atmega2560 && (
                            <div className="flex items-center justify-between text-purple-400">
                              <span>ATmega2560:</span>
                              <span className="font-bold">{data.raw2560} ({data.atmega2560}점)</span>
                            </div>
                          )}
                          {activeMcus.atmega640 && (
                            <div className="flex items-center justify-between text-amber-400">
                              <span>ATmega640:</span>
                              <span className="font-bold">{data.raw640} ({data.atmega640}점)</span>
                            </div>
                          )}
                          {activeMcus.atmega128 && (
                            <div className="flex items-center justify-between text-cyan-400">
                              <span>ATmega128:</span>
                              <span className="font-bold">{data.raw128} ({data.atmega128}점)</span>
                            </div>
                          )}
                          {activeMcus.atmega328p && (
                            <div className="flex items-center justify-between text-emerald-400">
                              <span>ATmega328P:</span>
                              <span className="font-bold">{data.raw328p} ({data.atmega328p}점)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: 10 }}
                formatter={(value: string) => {
                  if (value === 'atmega2560') return <span className="text-purple-400 font-bold text-xs">ATmega2560 (Purple)</span>;
                  if (value === 'atmega640') return <span className="text-amber-400 font-bold text-xs">ATmega640 (Amber)</span>;
                  if (value === 'atmega128') return <span className="text-cyan-400 font-bold text-xs">ATmega128 (Cyan)</span>;
                  if (value === 'atmega328p') return <span className="text-emerald-400 font-bold text-xs">ATmega328P (Green)</span>;
                  return value;
                }}
              />
              {activeMcus.atmega2560 && (
                <Radar
                  name="atmega2560"
                  dataKey="atmega2560"
                  stroke="#A855F7"
                  fill="#A855F7"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              )}
              {activeMcus.atmega640 && (
                <Radar
                  name="atmega640"
                  dataKey="atmega640"
                  stroke="#F59E0B"
                  fill="#F59E0B"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              )}
              {activeMcus.atmega128 && (
                <Radar
                  name="atmega128"
                  dataKey="atmega128"
                  stroke="#06B6D4"
                  fill="#06B6D4"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              )}
              {activeMcus.atmega328p && (
                <Radar
                  name="atmega328p"
                  dataKey="atmega328p"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              )}
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Metric Breakdown Cards (Core 3 Dimensions In-Depth) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Dimension 1: Processing Speed */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-emerald-400" /> 1. 연산 속도 (Processing Speed)
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                328P 우세 (20MHz)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              ATmega328P는 정격 <strong>20 MHz (20 MIPS)</strong> 클럭을 정식 지원하여 단일 코어 연산 속도가 가장 빠릅니다. ATmega2560, 640, 128A는 <strong>16 MHz (16 MIPS)</strong> 정격입니다.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] font-mono text-center pt-1 border-t border-slate-900">
              <div className="bg-slate-900/90 p-1.5 rounded border border-purple-500/30">
                <span className="text-slate-500 text-[9px] block">2560</span>
                <span className="text-purple-400 font-bold">16 MIPS</span>
              </div>
              <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
                <span className="text-slate-500 text-[9px] block">640</span>
                <span className="text-amber-400 font-bold">16 MIPS</span>
              </div>
              <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
                <span className="text-slate-500 text-[9px] block">128</span>
                <span className="text-cyan-400 font-bold">16 MIPS</span>
              </div>
              <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
                <span className="text-slate-500 text-[9px] block">328P</span>
                <span className="text-emerald-400 font-bold">20 MIPS ★</span>
              </div>
            </div>
          </div>

          {/* Dimension 2: Flash Memory Density */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-purple-400" /> 2. 플래시 메모리 집적도 (Flash Density)
              </span>
              <span className="text-[10px] font-mono text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/30">
                2560 최고 (256KB)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              ATmega2560은 <strong>256 KB (128KW)</strong> 온칩 플래시를 탑재하여 복잡한 Marlin 3D 프린터 및 RTOS 펌웨어를 여유롭게 수용합니다. ATmega128은 128KB, 640은 64KB, 328P는 32KB입니다.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] font-mono text-center pt-1 border-t border-slate-900">
              <div className="bg-slate-900/90 p-1.5 rounded border border-purple-500/30">
                <span className="text-slate-500 text-[9px] block">2560</span>
                <span className="text-purple-400 font-bold">256 KB ★</span>
              </div>
              <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
                <span className="text-slate-500 text-[9px] block">640</span>
                <span className="text-amber-400 font-bold">64 KB</span>
              </div>
              <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
                <span className="text-slate-500 text-[9px] block">128</span>
                <span className="text-cyan-400 font-bold">128 KB</span>
              </div>
              <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
                <span className="text-slate-500 text-[9px] block">328P</span>
                <span className="text-emerald-400 font-bold">32 KB</span>
              </div>
            </div>
          </div>

          {/* Dimension 3: Power Consumption & Efficiency */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <BatteryCharging className="w-4 h-4 text-amber-400" /> 3. 전력 소비 & 효율 (Power Consumption)
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                328P 초저전력 (0.1µA)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              ATmega328P는 <strong>PicoPower</strong> 기술로 Power-save 모드 시 <strong>0.1 µA</strong> 및 1.8V 저전압 배터리 구동이 가능합니다. ATmega2560/640은 0.5 µA, ATmega128은 최소 2.7V 이상 및 대기 전류(20 µA) 소모가 큽니다.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] font-mono text-center pt-1 border-t border-slate-900">
              <div className="bg-slate-900/90 p-1.5 rounded border border-purple-500/30">
                <span className="text-slate-500 text-[9px] block">2560</span>
                <span className="text-purple-400 font-bold">0.5 µA / 1.8V</span>
              </div>
              <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
                <span className="text-slate-500 text-[9px] block">640</span>
                <span className="text-amber-400 font-bold">0.5 µA / 1.8V</span>
              </div>
              <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
                <span className="text-slate-500 text-[9px] block">128</span>
                <span className="text-rose-400 font-bold">20 µA / 2.7V</span>
              </div>
              <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
                <span className="text-slate-500 text-[9px] block">328P</span>
                <span className="text-emerald-400 font-bold">0.1 µA ★</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Engineering Takeaways / Conclusion */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-xs text-slate-300 space-y-1.5">
        <div className="font-bold text-amber-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> 엔지니어링 레이더 차트 분석 요약 (Architectural Trade-offs)
        </div>
        <p className="text-slate-400 leading-relaxed">
          • <strong>대규모 3D 프린터 및 복합 제어 (Mega 2560)</strong>: 256KB 초대용량 플래시와 86핀 I/O, 16개 PWM, 4채널 USART를 모두 보유한 풀스펙 플래그십입니다.<br />
          • <strong>초소형 배터리 IoT 노드</strong>: 20MHz 빠른 처리 속도와 0.1µA PicoPower 극저전력을 가진 <strong>ATmega328P</strong>가 최적입니다.<br />
          • <strong>대용량 펌웨어 산업용 제어</strong>: 128KB 넉넉한 롬을 갖추어 복잡한 산업용 제어 바이너리를 담을 수 있는 <strong>ATmega128</strong>이 표준입니다.<br />
          • <strong>대규모 센서 & 가성비 양산</strong>: 86개 물리 I/O와 4개 USART 및 8KB 대용량 SRAM을 탑재하면서도 저렴한 <strong>ATmega640</strong>이 밸런스 최고입니다.
        </p>
      </div>
    </div>
  );
};
