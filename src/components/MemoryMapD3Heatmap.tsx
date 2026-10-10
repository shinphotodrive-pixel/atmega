import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import { HardDrive, Info, Layers, ZoomIn } from 'lucide-react';

interface Props {
  selectedMCU: SupportedMCU;
}

interface MemorySection {
  name: string;
  startAddr: number;
  endAddr: number;
  sizeBytes: number;
  type: 'registers' | 'io' | 'ext_io' | 'sram' | 'ext_sram' | 'eeprom';
  color: string;
  desc: string;
  usage: string;
}

export const MemoryMapD3Heatmap: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedSection, setSelectedSection] = useState<MemorySection | null>(null);
  const [viewMode, setViewMode] = useState<'sram_map' | 'eeprom_map'>('sram_map');

  // Define Memory Section layouts for the 3 MCUs based on Datasheets
  const getMemorySections = (mcu: SupportedMCU, mode: 'sram_map' | 'eeprom_map'): MemorySection[] => {
    if (mode === 'eeprom_map') {
      const eepromSize = currentProfile.eeprom * 1024; // in bytes
      return [
        {
          name: 'EEPROM 블록 0 (시스템 설정 & 캘리브레이션)',
          startAddr: 0x0000,
          endAddr: 0x00FF,
          sizeBytes: 256,
          type: 'eeprom',
          color: '#f59e0b',
          desc: '센서 0점 오프셋, 고유 시리얼 번호, 부트 파라미터 저장 구역',
          usage: 'Read-frequent / Low-wear'
        },
        {
          name: 'EEPROM 블록 1 (사용자 런타임 설정 데이터)',
          startAddr: 0x0100,
          endAddr: Math.floor(eepromSize * 0.4) - 1,
          sizeBytes: Math.floor(eepromSize * 0.4) - 256,
          type: 'eeprom',
          color: '#fbbf24',
          desc: '보드레이트, Wi-Fi/CAN 통신 ID, 알람 임계값 등 사용자 변경 파라미터',
          usage: 'Medium-wear'
        },
        {
          name: 'EEPROM 블록 2 (이벤트 로그 & 오류 이력 버퍼)',
          startAddr: Math.floor(eepromSize * 0.4),
          endAddr: eepromSize - 1,
          sizeBytes: eepromSize - Math.floor(eepromSize * 0.4),
          type: 'eeprom',
          color: '#d97706',
          desc: '정전 발생 시 최종 상태 기록 및 와치독 리셋 오류 코드 순환 저장 구역',
          usage: 'Circular Ring Buffer'
        }
      ];
    }

    // SRAM / Data Space Layout
    if (mcu === 'atmega328p') {
      return [
        {
          name: '범용 작업 레지스터 (R0 ~ R31)',
          startAddr: 0x0000,
          endAddr: 0x001F,
          sizeBytes: 32,
          type: 'registers',
          color: '#6366f1',
          desc: '32개의 8비트 범용 작업 레지스터 (R26~R31은 X, Y, Z 16비트 포인터)',
          usage: 'CPU ALU 1클럭 직접 연산'
        },
        {
          name: '기본 I/O 제어 레지스터 (64개)',
          startAddr: 0x0020,
          endAddr: 0x005F,
          sizeBytes: 64,
          type: 'io',
          color: '#06b6d4',
          desc: 'PORTB~D, DDRB~D, TCCR0, SREG 등 단일 사이클 IN/OUT, SBI/CBI 접근 영역',
          usage: '하드웨어 페리페럴 레지스터'
        },
        {
          name: '확장 I/O 레지스터 (Extended I/O)',
          startAddr: 0x0060,
          endAddr: 0x00FF,
          sizeBytes: 160,
          type: 'ext_io',
          color: '#0ea5e9',
          desc: 'UCSR0A/B/C, UBRR0, ADCSRA, PRR, PCMSK 등 확장 기능 레지스터 (LDS/STS 접근)',
          usage: '확장 페리페럴 제어'
        },
        {
          name: '내부 SRAM 데이터 공간 (2,048 Bytes)',
          startAddr: 0x0100,
          endAddr: 0x08FF,
          sizeBytes: 2048,
          type: 'sram',
          color: '#10b981',
          desc: '.data(초기화 전역변수), .bss(미초기화 전역변수), Heap(동적할당), Stack(함수호출/인터럽트)',
          usage: '런타임 실행 메모리 (RAMEND = 0x08FF)'
        }
      ];
    } else if (mcu === 'atmega128') {
      return [
        {
          name: '범용 작업 레지스터 (R0 ~ R31)',
          startAddr: 0x0000,
          endAddr: 0x001F,
          sizeBytes: 32,
          type: 'registers',
          color: '#6366f1',
          desc: '32개 고속 ALU 레지스터 파일 (X, Y, Z 16비트 인덱스 포인터 포함)',
          usage: '초고속 데이터 처리'
        },
        {
          name: '표준 I/O 레지스터 (64개)',
          startAddr: 0x0020,
          endAddr: 0x005F,
          sizeBytes: 64,
          type: 'io',
          color: '#06b6d4',
          desc: '포트 제어, 타이머0/1/2, 상태 레지스터 SREG (IN/OUT 명령어 지원)',
          usage: '주변장치 제어'
        },
        {
          name: '확장 I/O 레지스터 (Extended I/O 160개)',
          startAddr: 0x0060,
          endAddr: 0x00FF,
          sizeBytes: 160,
          type: 'ext_io',
          color: '#0ea5e9',
          desc: 'USART0/1, Timer3, TWI 등 (★ M103C 퓨즈 해제 시에만 온전히 개방)',
          usage: '확장 주변장치 제어'
        },
        {
          name: '내부 SRAM 데이터 공간 (4,096 Bytes)',
          startAddr: 0x0100,
          endAddr: 0x10FF,
          sizeBytes: 4096,
          type: 'sram',
          color: '#10b981',
          desc: '내부 고속 스태틱 RAM (RAMEND = 0x10FF)',
          usage: '런타임 스택 및 힙 메모리'
        },
        {
          name: '외부 SRAM 확장 영역 (XMEM 최대 60KB)',
          startAddr: 0x1100,
          endAddr: 0xFFFF,
          sizeBytes: 61184,
          type: 'ext_sram',
          color: '#8b5cf6',
          desc: 'Port A/C/G 외부 버스 인터페이스 활성화 시 연결되는 대용량 확장 메모리 공간',
          usage: '대용량 외부 버퍼'
        }
      ];
    } else {
      // ATmega640
      return [
        {
          name: '범용 작업 레지스터 (R0 ~ R31)',
          startAddr: 0x0000,
          endAddr: 0x001F,
          sizeBytes: 32,
          type: 'registers',
          color: '#6366f1',
          desc: '32개의 8비트 범용 작업 레지스터 (X=R26:27, Y=R28:29, Z=R30:31)',
          usage: 'CPU ALU 1클럭 직접 연산'
        },
        {
          name: '기본 I/O 레지스터 (64개)',
          startAddr: 0x0020,
          endAddr: 0x005F,
          sizeBytes: 64,
          type: 'io',
          color: '#06b6d4',
          desc: '기본 포트(PORTA~G), 타이머0, SREG 레지스터 (IN/OUT, SBI/CBI 전용 영역)',
          usage: '기본 하드웨어 레지스터'
        },
        {
          name: '확장 I/O 레지스터 (Extended I/O 416개)',
          startAddr: 0x0060,
          endAddr: 0x01FF,
          sizeBytes: 416,
          type: 'ext_io',
          color: '#0ea5e9',
          desc: 'USART0~3, Timer3~5, PORTH~L, ADC8~15 등 대규모 주변장치 매핑 영역',
          usage: '대형 주변장치 제어'
        },
        {
          name: '내부 SRAM 데이터 공간 (8,192 Bytes)',
          startAddr: 0x0200,
          endAddr: 0x21FF,
          sizeBytes: 8192,
          type: 'sram',
          color: '#10b981',
          desc: '초대용량 8KB 내부 SRAM. .data, .bss, Heap, Stack (RAMEND = 0x21FF)',
          usage: '대형 링버퍼 및 스택 (328P의 4배)'
        },
        {
          name: '외부 SRAM 확장 영역 (XMEM 최대 56KB)',
          startAddr: 0x2200,
          endAddr: 0xFFFF,
          sizeBytes: 56832,
          type: 'ext_sram',
          color: '#8b5cf6',
          desc: 'XMCRB/XMCRA 레지스터를 통해 활성화되는 외부 물리 SRAM 확장 인터페이스 공간',
          usage: '초대형 외부 버퍼링'
        }
      ];
    }
  };

  const sections = getMemorySections(selectedMCU, viewMode);

  // Render D3 Heatmap and Memory Map Stack
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 640;
    const height = 180;
    const margin = { top: 25, right: 30, bottom: 40, left: 30 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // We use a weighted power/log scale or proportional block scale so tiny registers and large SRAM both display legibly
    // Calculate total display weight
    const totalWeights = sections.reduce((acc, s) => {
      // give tiny sections a min weight so they are easily clickable/visible
      const weight = Math.max(18, Math.sqrt(s.sizeBytes));
      return acc + weight;
    }, 0);

    let currentX = 0;
    const blocksData = sections.map((s) => {
      const weight = Math.max(18, Math.sqrt(s.sizeBytes));
      const blockWidth = (weight / totalWeights) * innerWidth;
      const x = currentX;
      currentX += blockWidth;
      return {
        ...s,
        x,
        width: blockWidth
      };
    });

    // Create defs for gradients
    const defs = svg.append('defs');
    blocksData.forEach((d, idx) => {
      const grad = defs
        .append('linearGradient')
        .attr('id', `mem-grad-${idx}`)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');

      grad.append('stop').attr('offset', '0%').attr('stop-color', d.color).attr('stop-opacity', 0.95);
      grad.append('stop').attr('offset', '100%').attr('stop-color', d.color).attr('stop-opacity', 0.65);
    });

    // Draw Heatmap Blocks
    const blocks = g
      .selectAll('.mem-block')
      .data(blocksData)
      .enter()
      .append('g')
      .attr('class', 'mem-block cursor-pointer')
      .on('click', (_event, d) => {
        setSelectedSection(d);
      })
      .on('mouseenter', function (_event, d) {
        d3.select(this)
          .select('rect')
          .transition()
          .duration(150)
          .attr('y', -4)
          .attr('height', innerHeight + 8)
          .attr('stroke', '#f8fafc')
          .attr('stroke-width', 2);
      })
      .on('mouseleave', function () {
        d3.select(this)
          .select('rect')
          .transition()
          .duration(150)
          .attr('y', 0)
          .attr('height', innerHeight)
          .attr('stroke', '#334155')
          .attr('stroke-width', 1);
      });

    // Rectangles
    blocks
      .append('rect')
      .attr('x', (d) => d.x + 2)
      .attr('y', 0)
      .attr('width', (d) => Math.max(8, d.width - 4))
      .attr('height', innerHeight)
      .attr('rx', 6)
      .attr('fill', (_d, i) => `url(#mem-grad-${i})`)
      .attr('stroke', '#334155')
      .attr('stroke-width', 1);

    // Heatmap grid overlay ticks for aesthetic technical look
    blocks
      .append('line')
      .attr('x1', (d) => d.x + 2)
      .attr('x2', (d) => d.x + d.width - 2)
      .attr('y1', innerHeight / 2)
      .attr('y2', innerHeight / 2)
      .attr('stroke', 'rgba(255,255,255,0.2)')
      .attr('stroke-dasharray', '3,3');

    // Section Name Labels inside blocks (if width allows)
    blocks.each(function (d) {
      if (d.width > 55) {
        d3.select(this)
          .append('text')
          .attr('x', d.x + d.width / 2)
          .attr('y', innerHeight / 2 - 6)
          .attr('text-anchor', 'middle')
          .attr('fill', '#ffffff')
          .attr('font-size', '10px')
          .attr('font-weight', '700')
          .attr('font-family', 'monospace')
          .text(d.sizeBytes >= 1024 ? `${(d.sizeBytes / 1024).toFixed(0)}KB` : `${d.sizeBytes}B`);

        d3.select(this)
          .append('text')
          .attr('x', d.x + d.width / 2)
          .attr('y', innerHeight / 2 + 10)
          .attr('text-anchor', 'middle')
          .attr('fill', 'rgba(255,255,255,0.85)')
          .attr('font-size', '9px')
          .text(d.type.toUpperCase());
      }
    });

    // Address start and end annotations
    blocks.each(function (d) {
      // Start Address (top)
      g.append('text')
        .attr('x', d.x + 3)
        .attr('y', -8)
        .attr('fill', '#94a3b8')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .text(`0x${d.startAddr.toString(16).padStart(4, '0').toUpperCase()}`);

      // End Address (bottom)
      g.append('text')
        .attr('x', d.x + d.width - 4)
        .attr('y', innerHeight + 18)
        .attr('text-anchor', 'end')
        .attr('fill', '#94a3b8')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .text(`0x${d.endAddr.toString(16).padStart(4, '0').toUpperCase()}`);
    });

    // Default select first section if none selected
    if (!selectedSection || !sections.some((s) => s.name === selectedSection.name)) {
      setSelectedSection(sections[sections.length > 3 ? 3 : 0]);
    }
  }, [selectedMCU, viewMode]);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-lg space-y-4">
      {/* Title & View Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-1.5">
              <span>{currentProfile.name} 메모리 맵(Memory Map) D3.js 히트맵</span>
            </h3>
            <p className="text-xs text-slate-400">
              블록을 클릭하면 16진수 시작/끝 주소, 가용 바이트 수 및 레지스터 배치 구조를 상세 분석합니다.
            </p>
          </div>
        </div>

        <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800 shrink-0">
          <button
            onClick={() => setViewMode('sram_map')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              viewMode === 'sram_map'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            데이터 공간 (SRAM/IO)
          </button>
          <button
            onClick={() => setViewMode('eeprom_map')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              viewMode === 'eeprom_map'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            EEPROM 공간 ({currentProfile.eeprom}KB)
          </button>
        </div>
      </div>

      {/* D3 Heatmap Canvas */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 overflow-x-auto relative">
        <div className="text-[10px] text-slate-400 font-mono mb-1 flex justify-between">
          <span>← 하위 주소 (0x0000)</span>
          <span className="text-amber-400">D3.js 인터랙티브 스케일 히트맵</span>
          <span>상위 주소 (RAMEND / Top) →</span>
        </div>
        <svg ref={svgRef} className="w-full h-auto min-w-[580px]" />
      </div>

      {/* Selected Block Detailed Inspection Card */}
      {selectedSection && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: selectedSection.color }}
              />
              <span className="font-bold text-white text-sm">{selectedSection.name}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                {selectedSection.sizeBytes.toLocaleString()} Bytes ({selectedSection.sizeBytes >= 1024 ? `${(selectedSection.sizeBytes / 1024).toFixed(1)} KB` : 'Small Block'})
              </span>
            </div>

            <div className="font-mono text-cyan-400 text-xs bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
              주소 범위: 0x{selectedSection.startAddr.toString(16).padStart(4, '0').toUpperCase()} ~ 0x{selectedSection.endAddr.toString(16).padStart(4, '0').toUpperCase()}
            </div>
          </div>

          <p className="text-slate-300 leading-relaxed text-xs">{selectedSection.desc}</p>

          <div className="flex flex-wrap gap-4 text-[11px] pt-1 text-slate-400 font-mono">
            <div>
              <span className="text-slate-500">주요 접근 메커니즘: </span>
              <span className="text-amber-400 font-bold">{selectedSection.usage}</span>
            </div>
            <div>
              <span className="text-slate-500">영역 분류: </span>
              <span className="text-emerald-400 font-bold">{selectedSection.type.toUpperCase()}</span>
            </div>
            {viewMode === 'sram_map' && selectedSection.type === 'sram' && (
              <div>
                <span className="text-slate-500">스택 포인터 초기화(SP): </span>
                <span className="text-white font-bold">
                  RAMEND (0x{selectedSection.endAddr.toString(16).padStart(4, '0').toUpperCase()})
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend & Key Architecture Tips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono">
        <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
          <span className="text-slate-300">R0~R31 레지스터</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shrink-0" />
          <span className="text-slate-300">기본/확장 I/O (SFR)</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-slate-300">내부 고속 SRAM</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
          <span className="text-slate-300">EEPROM / 외부 XMEM</span>
        </div>
      </div>
    </div>
  );
};
