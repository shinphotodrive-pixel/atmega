import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  GitCompare,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Search,
  Filter,
  Download,
  Copy,
  Check,
  Cpu,
  Layers,
  ArrowDownRight,
  ExternalLink
} from 'lucide-react';
import { REGISTER_DATABASE, RegisterDefinition } from './RegisterStatusDashboard';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU: (mcu: SupportedMCU) => void;
}

interface SfrDiffItem {
  name: string;
  category: string;
  categoryLabel: string;
  sourceSupport: boolean;
  targetSupport: boolean;
  sourceAddr?: string;
  targetAddr?: string;
  description: string;
  bitsStatus: 'identical' | 'different_bits' | 'only_source' | 'only_target';
  diffNotes: string;
  migrationSeverity: 'critical' | 'warning' | 'info' | 'identical';
}

export const SfrRegisterDifferential: React.FC<Props> = ({ selectedMCU, onSelectMCU }) => {
  const [sourceMcu, setSourceMcu] = useState<SupportedMCU>(selectedMCU);
  const [targetMcu, setTargetMcu] = useState<SupportedMCU>(
    selectedMCU === 'atmega328p' ? 'atmega128' : 'atmega328p'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'critical' | 'different' | 'identical'>('all');
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Synchronize if selectedMCU from parent changes
  React.useEffect(() => {
    if (sourceMcu !== selectedMCU) {
      setSourceMcu(selectedMCU);
      if (targetMcu === selectedMCU) {
        setTargetMcu(selectedMCU === 'atmega328p' ? 'atmega128' : 'atmega328p');
      }
    }
  }, [selectedMCU]);

  // Comprehensive map of AVR SFR discrepancies and migration notes between ATmega640 / ATmega128 / ATmega328P
  const diffItems = useMemo<SfrDiffItem[]>(() => {
    const list: SfrDiffItem[] = [];

    // Detailed knowledge base of specific migration hurdles
    const migrationRules: Record<string, {
      getDiffNotes: (src: SupportedMCU, tgt: SupportedMCU) => {
        notes: string;
        severity: 'critical' | 'warning' | 'info' | 'identical';
        bitsStatus: 'identical' | 'different_bits' | 'only_source' | 'only_target';
      };
    }> = {
      'TCCR0': {
        getDiffNotes: (src, tgt) => {
          if (src === 'atmega128' && tgt !== 'atmega128') {
            return {
              notes: 'ATmega128은 단일 8비트 제어 레지스터 TCCR0를 사용하지만, ATmega328P/640은 TCCR0A 및 TCCR0B 2개 레지스터로 분할되었습니다. (WGM/CS 비트 위치 재배치 필수)',
              severity: 'critical',
              bitsStatus: 'only_source'
            };
          }
          if (src !== 'atmega128' && tgt === 'atmega128') {
            return {
              notes: 'ATmega328P/640의 TCCR0A/TCCR0B 설정을 ATmega128의 TCCR0 단일 레지스터로 병합해야 합니다. FOC0, COM01:0, WGM00:0, CS02:0 비트가 한 바이트에 공존합니다.',
              severity: 'critical',
              bitsStatus: 'only_target'
            };
          }
          return { notes: '동일 규격', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'TCCR0A': {
        getDiffNotes: (src, tgt) => {
          if (src === 'atmega128' && tgt !== 'atmega128') {
            return {
              notes: 'ATmega128에는 TCCR0A가 존재하지 않으며 단일 TCCR0를 사용합니다.',
              severity: 'critical',
              bitsStatus: 'only_target'
            };
          }
          if (src !== 'atmega128' && tgt === 'atmega128') {
            return {
              notes: 'ATmega128로 마이그레이션 시 TCCR0A의 COM0A/B 및 WGM 비트를 TCCR0 하나로 통합해야 합니다.',
              severity: 'critical',
              bitsStatus: 'only_source'
            };
          }
          return { notes: 'ATmega328P와 ATmega640 상호 호환 (COM0A/B, WGM00/01)', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'TCCR0B': {
        getDiffNotes: (src, tgt) => {
          if (src === 'atmega128' || tgt === 'atmega128') {
            return {
              notes: 'ATmega128에는 TCCR0B가 없습니다. 클럭 분주비 CS02:0 및 FOC0는 TCCR0에 직접 기록해야 합니다.',
              severity: 'critical',
              bitsStatus: src === 'atmega128' ? 'only_target' : 'only_source'
            };
          }
          return { notes: 'CS02:0 및 WGM02 비트 완전 호환', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'UCSR0A': {
        getDiffNotes: (src, tgt) => {
          if (src === 'atmega128' || tgt === 'atmega128') {
            return {
              notes: 'ATmega128은 UBRR/UCSR 레지스터가 확장 I/O 공간(Extended I/O)에 위치하지 않고 표준 0x00-0x3F I/O에 매핑되어 in/out 명령어가 사용 가능합니다.',
              severity: 'info',
              bitsStatus: 'different_bits'
            };
          }
          return { notes: 'RXC0, TXC0, UDRE0, FE0, DOR0, UPE0, U2X0, MPCM0 비트 완벽 호환', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'UCSR0B': {
        getDiffNotes: (src, tgt) => {
          return { notes: 'RXCIE0, TXCIE0, UDRIE0, RXEN0, TXEN0, UCSZ02 등 비트 구성 호환', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'UCSR0C': {
        getDiffNotes: (src, tgt) => {
          if (src === 'atmega128' || tgt === 'atmega128') {
            return {
              notes: 'ATmega128에서 UCSR0C는 별도 주소가 할당되어 있지만, 구형 칩 설계상 동시 접근 주의가 필요합니다. ATmega328P/640은 전용 주소 0xC2 / 0xC2 보유.',
              severity: 'info',
              bitsStatus: 'identical'
            };
          }
          return { notes: 'UMSEL0, UPM01:0, USBS0, UCSZ01:0 패리티 및 스톱비트 구성 동일', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'UBRR0H': {
        getDiffNotes: (src, tgt) => {
          return { notes: '12비트 보드레이트 분주기의 상위 4비트 설정 레지스터. 16비트 임시 버퍼링(TEMP) 주의 필요.', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'UBRR0L': {
        getDiffNotes: (src, tgt) => {
          return { notes: '보드레이트 분주기 하위 8비트. 공식: (F_CPU / (16 * BAUD)) - 1', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'UCSR1A': {
        getDiffNotes: (src, tgt) => {
          if (tgt === 'atmega328p') {
            return {
              notes: '주의! ATmega328P는 USART0(1채널)만 존재하며 USART1이 물리적으로 존재하지 않습니다. USART1 의존 코드는 소프트웨어 Serial(SoftwareSerial)로 대체해야 합니다.',
              severity: 'critical',
              bitsStatus: 'only_source'
            };
          }
          if (src === 'atmega328p') {
            return {
              notes: 'ATmega328P에는 USART1이 없습니다. 타겟 MCU로 전환 시 두 번째 하드웨어 시리얼 채널을 활용할 수 있습니다.',
              severity: 'info',
              bitsStatus: 'only_target'
            };
          }
          return { notes: 'ATmega128(2채널)과 ATmega640(4채널) 모두 USART1 지원', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'UCSR2A': {
        getDiffNotes: (src, tgt) => {
          const srcHas = src === 'atmega640';
          const tgtHas = tgt === 'atmega640';
          if (!tgtHas && srcHas) {
            return {
              notes: 'ATmega640 전용 USART2 채널입니다. ATmega128(최대 2개), ATmega328P(1개)에는 존재하지 않습니다.',
              severity: 'critical',
              bitsStatus: 'only_source'
            };
          }
          if (tgtHas && !srcHas) {
            return {
              notes: 'ATmega640 확장 기능: 3번째 하드웨어 UART(USART2)를 즉시 가용할 수 있습니다.',
              severity: 'info',
              bitsStatus: 'only_target'
            };
          }
          return { notes: '미지원 또는 동등', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'UCSR3A': {
        getDiffNotes: (src, tgt) => {
          const srcHas = src === 'atmega640';
          const tgtHas = tgt === 'atmega640';
          if (!tgtHas && srcHas) {
            return {
              notes: 'ATmega640 전용 USART3 채널입니다. 타 MCU로 마이그레이션 시 하드웨어 UART 부족 병목 발생.',
              severity: 'critical',
              bitsStatus: 'only_source'
            };
          }
          if (tgtHas && !srcHas) {
            return {
              notes: 'ATmega640 확장 기능: 4번째 하드웨어 UART(USART3) 지원.',
              severity: 'info',
              bitsStatus: 'only_target'
            };
          }
          return { notes: '동등', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'ADCSRA': {
        getDiffNotes: (src, tgt) => {
          if (src === 'atmega128' || tgt === 'atmega128') {
            return {
              notes: 'ATmega128 데이터시트의 구형 표기는 ADCSR이지만 avr-libc에서 ADCSRA 매크로 별칭을 지원합니다. 비트 필드(ADEN, ADSC, ADATE, ADIF, ADIE, ADPS2:0) 구조 일치.',
              severity: 'info',
              bitsStatus: 'identical'
            };
          }
          return { notes: '완전 호환', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'ADCSRB': {
        getDiffNotes: (src, tgt) => {
          if (src === 'atmega128') {
            return {
              notes: 'ATmega128에는 ADCSRB(자동 트리거 소스 선택) 레지스터가 존재하지 않습니다! ATmega128은 프리 러닝 모드만 지원하며 타이머 비교 일치 트리거링이 불가합니다.',
              severity: 'critical',
              bitsStatus: 'only_target'
            };
          }
          if (tgt === 'atmega128') {
            return {
              notes: 'ATmega128에는 ADCSRB가 없습니다. 타이머 트리거 ADC 변환 코드를 타이머 ISR 내 수동 ADSC 세트 방식으로 리팩터링해야 합니다.',
              severity: 'critical',
              bitsStatus: 'only_source'
            };
          }
          return { notes: 'ATmega328P와 ATmega640 모두 ADC 자동 트리거 소스 레지스터 지원', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'ADMUX': {
        getDiffNotes: (src, tgt) => {
          if (src === 'atmega128' || tgt === 'atmega128') {
            return {
              notes: '기준 전압(REFS1:0) 차이 주의! ATmega128의 내부 밴드갭 기준전압은 2.56V인 반면, ATmega328P와 ATmega640의 내부 기준전압은 1.1V입니다! (전압 환산 공식 수정 필수)',
              severity: 'critical',
              bitsStatus: 'different_bits'
            };
          }
          if (src === 'atmega640' || tgt === 'atmega640') {
            return {
              notes: 'ATmega640은 ADC 채널이 16개(ADC0~ADC15)이므로 ADMUX의 MUX4:0 비트 외에 ADCSRB의 MUX5 비트를 조합해야 합니다. (ATmega328P는 최대 8개 채널)',
              severity: 'warning',
              bitsStatus: 'different_bits'
            };
          }
          return { notes: '호환', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'SPCR': {
        getDiffNotes: (src, tgt) => {
          return { notes: 'SPI 제어 레지스터 (SPE, MSTR, CPOL, CPHA, SPR1:0) 3종 MCU 전원 완전 호환', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'SPSR': {
        getDiffNotes: (src, tgt) => {
          return { notes: 'SPI 상태 레지스터 (SPIF, WCOL, SPI2X) 완전 호환', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'TWCR': {
        getDiffNotes: (src, tgt) => {
          return { notes: 'I2C(TWI) 제어 레지스터 (TWINT, TWEA, TWSTA, TWSTO, TWWC, TWEN, TWIE) 전 기종 완전 호환', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'TWBR': {
        getDiffNotes: (src, tgt) => {
          return { notes: 'TWI 비트레이트 레지스터 호환. SCL 클럭 = F_CPU / (16 + 2 * TWBR * 4^TWPS)', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'MCUCR': {
        getDiffNotes: (src, tgt) => {
          if (src === 'atmega128' || tgt === 'atmega128') {
            return {
              notes: 'ATmega128은 MCUCR에 외부 인터럽트 ISCx 제어 및 슬립 모드 비트(SM2:0, SE)가 집중되어 있으나, ATmega328P/640은 SMCR(슬립 제어) 및 EICRA(외부 인터럽트 제어 A)로 기능이 분리되었습니다.',
              severity: 'critical',
              bitsStatus: 'different_bits'
            };
          }
          return { notes: 'PUD(Pull-up Disable) 및 IVSEL(인터럽트 벡터 테이블 변경) 등 유사 구성', severity: 'warning', bitsStatus: 'different_bits' };
        }
      },
      'SMCR': {
        getDiffNotes: (src, tgt) => {
          if (src === 'atmega128') {
            return {
              notes: 'ATmega128에는 SMCR이 없으며 MCUCR의 SM2:0, SE 비트를 사용합니다.',
              severity: 'warning',
              bitsStatus: 'only_target'
            };
          }
          if (tgt === 'atmega128') {
            return {
              notes: 'ATmega128로 이식 시 SMCR(Sleep Mode Control Register) 대신 MCUCR의 비트를 조작해야 합니다.',
              severity: 'warning',
              bitsStatus: 'only_source'
            };
          }
          return { notes: 'PicoPower 슬립 모드 제어 레지스터 완벽 호환', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'XMCRB': {
        getDiffNotes: (src, tgt) => {
          const srcExt = src === 'atmega640' || src === 'atmega128';
          const tgtExt = tgt === 'atmega640' || tgt === 'atmega128';
          if (!tgtExt && srcExt) {
            return {
              notes: 'ATmega328P는 외부 메모리 인터페이스(XMEM)를 전혀 지원하지 않습니다! 64KB 외부 SRAM/FPGA 버스 주소 확장 불가.',
              severity: 'critical',
              bitsStatus: 'only_source'
            };
          }
          if (tgtExt && !srcExt) {
            return {
              notes: '타겟 MCU는 최대 64KB 외부 메모리 버스(XMEM) 및 주소 래치 비트(XMCRB/XMCRA) 지원.',
              severity: 'info',
              bitsStatus: 'only_target'
            };
          }
          return { notes: '외부 메모리 제어 버스 레지스터 호환 (Wait-state 설정 등)', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'PORTL': {
        getDiffNotes: (src, tgt) => {
          if (tgt !== 'atmega640' && src === 'atmega640') {
            return {
              notes: 'PORTL(핀 PL0~PL7)은 100핀 ATmega640 전용 대형 GPIO 포트입니다. 64핀 ATmega128이나 28핀 ATmega328P에는 존재하지 않습니다.',
              severity: 'critical',
              bitsStatus: 'only_source'
            };
          }
          if (tgt === 'atmega640' && src !== 'atmega640') {
            return {
              notes: 'ATmega640 이식 시 8개의 추가적인 디지털 핀 PORTL을 활용 가능합니다.',
              severity: 'info',
              bitsStatus: 'only_target'
            };
          }
          return { notes: '미지원 또는 동등', severity: 'identical', bitsStatus: 'identical' };
        }
      },
      'PORTK': {
        getDiffNotes: (src, tgt) => {
          if (tgt !== 'atmega640' && src === 'atmega640') {
            return {
              notes: 'PORTK(PK0~PK7 / ADC8~15)는 100핀 ATmega640 전용입니다. 타 MCU로 마이그레이션 시 핀 부족 발생.',
              severity: 'critical',
              bitsStatus: 'only_source'
            };
          }
          return { notes: '동등', severity: 'identical', bitsStatus: 'identical' };
        }
      }
    };

    // Scan all database registers
    const allRegNames = new Set<string>();
    REGISTER_DATABASE.forEach(r => allRegNames.add(r.name));
    // Add extra differential registers
    ['TCCR0', 'TCCR0A', 'TCCR0B', 'UCSR1A', 'UCSR2A', 'UCSR3A', 'ADCSRB', 'SMCR', 'XMCRB', 'PORTL', 'PORTK'].forEach(n => allRegNames.add(n));

    allRegNames.forEach((name) => {
      const regDef = REGISTER_DATABASE.find(r => r.name === name);
      const rule = migrationRules[name];

      // Check support in source
      let srcSupported = true;
      let tgtSupported = true;

      if (regDef?.mcuSupport) {
        srcSupported = regDef.mcuSupport.includes(sourceMcu);
        tgtSupported = regDef.mcuSupport.includes(targetMcu);
      } else {
        // Special manual checks for peripheral existence
        if (name === 'TCCR0') {
          srcSupported = sourceMcu === 'atmega128';
          tgtSupported = targetMcu === 'atmega128';
        } else if (name === 'TCCR0A' || name === 'TCCR0B' || name === 'ADCSRB' || name === 'SMCR') {
          srcSupported = sourceMcu !== 'atmega128';
          tgtSupported = targetMcu !== 'atmega128';
        } else if (name === 'UCSR1A') {
          srcSupported = sourceMcu !== 'atmega328p';
          tgtSupported = targetMcu !== 'atmega328p';
        } else if (name === 'UCSR2A' || name === 'UCSR3A' || name === 'PORTL' || name === 'PORTK') {
          srcSupported = sourceMcu === 'atmega640';
          tgtSupported = targetMcu === 'atmega640';
        } else if (name === 'XMCRB') {
          srcSupported = sourceMcu !== 'atmega328p';
          tgtSupported = targetMcu !== 'atmega328p';
        }
      }

      // If neither supports it, skip
      if (!srcSupported && !tgtSupported) return;

      let severity: 'critical' | 'warning' | 'info' | 'identical' = 'identical';
      let bitsStatus: 'identical' | 'different_bits' | 'only_source' | 'only_target' = 'identical';
      let diffNotes = '두 MCU 간에 비트 구성 및 동작 방식이 상호 호환됩니다.';

      if (rule) {
        const res = rule.getDiffNotes(sourceMcu, targetMcu);
        severity = res.severity;
        bitsStatus = res.bitsStatus;
        diffNotes = res.notes;
      } else {
        if (srcSupported && !tgtSupported) {
          severity = 'critical';
          bitsStatus = 'only_source';
          diffNotes = `주의: [${MCU_PROFILES[targetMcu].name}]에는 ${name} 레지스터가 존재하지 않습니다. 기능 마이그레이션 필요.`;
        } else if (!srcSupported && tgtSupported) {
          severity = 'info';
          bitsStatus = 'only_target';
          diffNotes = `[${MCU_PROFILES[targetMcu].name}] 전용 기능. 마이그레이션 후 추가 가용 가능.`;
        } else {
          severity = 'identical';
          bitsStatus = 'identical';
          diffNotes = '동일 명칭 및 비트필드 레이아웃 유지.';
        }
      }

      list.push({
        name,
        category: regDef?.category || 'system',
        categoryLabel: regDef?.categoryLabel || '제어 레지스터',
        sourceSupport: srcSupported,
        targetSupport: tgtSupported,
        sourceAddr: regDef?.addr || '0x??',
        targetAddr: regDef?.addr || '0x??',
        description: regDef?.desc || `${name} 하드웨어 특수 기능 레지스터`,
        bitsStatus,
        diffNotes,
        migrationSeverity: severity
      });
    });

    // Sort: critical first, then warning, then only_source/target, then identical
    const rank = { critical: 0, warning: 1, info: 2, identical: 3 };
    return list.sort((a, b) => rank[a.migrationSeverity] - rank[b.migrationSeverity] || a.name.localeCompare(b.name));
  }, [sourceMcu, targetMcu]);

  // Filtered
  const filteredItems = useMemo(() => {
    return diffItems.filter(item => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q || item.name.toLowerCase().includes(q) || item.diffNotes.toLowerCase().includes(q) || item.categoryLabel.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (selectedFilter === 'critical') return item.migrationSeverity === 'critical';
      if (selectedFilter === 'different') return item.migrationSeverity !== 'identical';
      if (selectedFilter === 'identical') return item.migrationSeverity === 'identical';
      return true;
    });
  }, [diffItems, searchTerm, selectedFilter]);

  // Statistics
  const stats = useMemo(() => {
    const critical = diffItems.filter(i => i.migrationSeverity === 'critical').length;
    const warning = diffItems.filter(i => i.migrationSeverity === 'warning').length;
    const info = diffItems.filter(i => i.migrationSeverity === 'info').length;
    const identical = diffItems.filter(i => i.migrationSeverity === 'identical').length;
    return { critical, warning, info, identical, total: diffItems.length };
  }, [diffItems]);

  const handleCopyReport = () => {
    const lines = [
      `# SFR 레지스터 마이그레이션 차이 분석 리포트`,
      `기준 소스 MCU: ${MCU_PROFILES[sourceMcu].name} -> 타겟 MCU: ${MCU_PROFILES[targetMcu].name}`,
      `총 분석 레지스터: ${stats.total}개 (치명적 변경/누락: ${stats.critical}건, 경고: ${stats.warning}건, 호환: ${stats.identical}건)`,
      `----------------------------------------------------------------`,
      ...diffItems.filter(i => i.migrationSeverity !== 'identical').map(i => {
        return `[${i.migrationSeverity.toUpperCase()}] ${i.name} (${i.categoryLabel}): ${i.diffNotes}`;
      })
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-2">
            <GitCompare className="w-3.5 h-3.5" />
            SFR Register Differential Engine
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            SFR 레지스터 이종 MCU 차이점 & 마이그레이션 분석기
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            두 개의 서로 다른 AVR 마이크로컨트롤러 간 특수 기능 레지스터(SFR) 매핑, 분할/통합 구조,
            전압 기준치(VREF 1.1V vs 2.56V) 및 미지원 하드웨어 모듈 차이를 비교하여 펌웨어 포팅 시 장애 요인을 사전 검증합니다.
          </p>
        </div>

        <button
          onClick={handleCopyReport}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-semibold transition shadow-sm self-start md:self-auto"
        >
          {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedSummary ? '리포트 복사 완료!' : '차이 분석 요약 복사'}</span>
        </button>
      </div>

      {/* MCU Selectors Comparison Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-950/70 border border-slate-800 rounded-xl items-center">
        {/* Source MCU */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              소스 MCU (기존 코드 베이스)
            </span>
            <span className="font-mono text-amber-400 font-bold">{MCU_PROFILES[sourceMcu].name}</span>
          </div>
          <div className="flex gap-2">
            {(['atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
              <button
                key={`src-${mcuId}`}
                onClick={() => setSourceMcu(mcuId)}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg border transition ${
                  sourceMcu === mcuId
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {MCU_PROFILES[mcuId].name}
              </button>
            ))}
          </div>
        </div>

        {/* Target MCU */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              타겟 MCU (이식 목표 대상)
            </span>
            <span className="font-mono text-cyan-400 font-bold">{MCU_PROFILES[targetMcu].name}</span>
          </div>
          <div className="flex gap-2">
            {(['atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
              <button
                key={`tgt-${mcuId}`}
                onClick={() => setTargetMcu(mcuId)}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg border transition ${
                  targetMcu === mcuId
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {MCU_PROFILES[mcuId].name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Stats Badge Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-rose-950/20 border border-rose-800/40 rounded-xl p-3">
          <div className="text-[11px] text-rose-400 font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> 치명적 위험 (코드 수정 필수)
          </div>
          <div className="text-xl font-black text-rose-400 font-mono mt-1">{stats.critical} 개</div>
          <div className="text-[10px] text-rose-400/80 mt-0.5">레지스터 누락 또는 구조적 분할</div>
        </div>

        <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-3">
          <div className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> 기능 경고 (동작 편차)
          </div>
          <div className="text-xl font-black text-amber-400 font-mono mt-1">{stats.warning} 개</div>
          <div className="text-[10px] text-amber-400/80 mt-0.5">VREF 전압 및 비트 위치 변동</div>
        </div>

        <div className="bg-cyan-950/20 border border-cyan-800/40 rounded-xl p-3">
          <div className="text-[11px] text-cyan-400 font-semibold flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5" /> 기능 확장 (타겟 전용)
          </div>
          <div className="text-xl font-black text-cyan-400 font-mono mt-1">{stats.info} 개</div>
          <div className="text-[10px] text-cyan-400/80 mt-0.5">타겟에서 추가 활용 가능한 SFR</div>
        </div>

        <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-3">
          <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> 완전 호환
          </div>
          <div className="text-xl font-black text-emerald-400 font-mono mt-1">{stats.identical} 개</div>
          <div className="text-[10px] text-emerald-400/80 mt-0.5">코드 수정 없이 100% 바이너리 호환</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="레지스터명 또는 설명 검색 (예: TCCR, ADMUX)..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
          />
        </div>

        <div className="flex items-center gap-1 self-start sm:self-auto overflow-x-auto w-full sm:w-auto">
          {(['all', 'critical', 'different', 'identical'] as const).map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setSelectedFilter(filterKey)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedFilter === filterKey
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {filterKey === 'all' && '전체 보기'}
              {filterKey === 'critical' && `치명적 위험 (${stats.critical})`}
              {filterKey === 'different' && `차이점만 (${stats.critical + stats.warning + stats.info})`}
              {filterKey === 'identical' && `동일 호환 (${stats.identical})`}
            </button>
          ))}
        </div>
      </div>

      {/* Differential Table */}
      <div className="overflow-x-auto border border-slate-800 rounded-xl shadow-inner">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[11px] border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">레지스터 / 모듈</th>
              <th className="px-3 py-3 text-center">{MCU_PROFILES[sourceMcu].name} 지원</th>
              <th className="px-3 py-3 text-center">{MCU_PROFILES[targetMcu].name} 지원</th>
              <th className="px-3 py-3 text-center">차이 구분</th>
              <th className="px-4 py-3">마이그레이션 장애 분석 및 해결 가이드</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  해당 필터 조건에 부합하는 레지스터 차이 항목이 없습니다.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isCrit = item.migrationSeverity === 'critical';
                const isWarn = item.migrationSeverity === 'warning';
                const isInfo = item.migrationSeverity === 'info';

                return (
                  <tr
                    key={item.name}
                    className={`hover:bg-slate-800/30 transition-colors ${
                      isCrit ? 'bg-rose-950/10' : isWarn ? 'bg-amber-950/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <span>{item.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-sans font-normal border border-slate-700">
                          {item.categoryLabel}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans mt-0.5 max-w-xs truncate">
                        {item.description}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-center">
                      {item.sourceSupport ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 text-[10px] font-mono">
                          <Check className="w-3 h-3" /> 지원
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/40 text-rose-400 border border-rose-800/60 text-[10px] font-mono">
                          미지원
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3 text-center">
                      {item.targetSupport ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 text-[10px] font-mono">
                          <Check className="w-3 h-3" /> 지원
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/40 text-rose-400 border border-rose-800/60 text-[10px] font-mono">
                          미지원
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3 text-center font-mono text-[10px]">
                      {isCrit && (
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                          CRITICAL
                        </span>
                      )}
                      {isWarn && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                          WARNING
                        </span>
                      )}
                      {isInfo && (
                        <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                          EXPANDED
                        </span>
                      )}
                      {!isCrit && !isWarn && !isInfo && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                          COMPATIBLE
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className={`text-xs leading-relaxed ${
                        isCrit ? 'text-rose-200' : isWarn ? 'text-amber-200' : 'text-slate-300'
                      }`}>
                        {item.diffNotes}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
