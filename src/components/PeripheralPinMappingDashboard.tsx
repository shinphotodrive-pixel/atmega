import React, { useState, useMemo, useCallback } from 'react';
import { SupportedMCU, MCU_PROFILES, PinDefinition } from '../data/pinmapData';
import {
  Cpu,
  Layers,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  ArrowRight,
  GripVertical,
  Radio,
  Clock,
  Zap,
  Activity,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Shuffle,
  FileCode,
  Search,
  Sliders,
  CheckCircle,
  HelpCircle,
  ShieldAlert,
  Flame
} from 'lucide-react';
import confetti from 'canvas-confetti';

export interface PeripheralPinMappingDashboardProps {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
}

export type PeripheralCategory = 'uart' | 'spi' | 'i2c' | 'timer' | 'interrupt' | 'adc' | 'custom';

export interface PeripheralSignal {
  id: string;
  name: string;
  codeName: string;
  category: PeripheralCategory;
  direction: 'input' | 'output' | 'bidirectional';
  defaultPin: string;
  description: string;
  isHardwareFixed: boolean;
  requiredMcus?: SupportedMCU[];
}

export interface PinConflict {
  pin: string;
  signals: PeripheralSignal[];
  severity: 'critical' | 'warning';
  title: string;
  explanation: string;
  solution: string;
}

// Master catalogue of peripheral signals across AVR MCU family
const ALL_PERIPHERAL_SIGNALS: PeripheralSignal[] = [
  // --- UART 0 ---
  { id: 'uart0_txd', name: 'USART0 TXD', codeName: 'USART0_TXD', category: 'uart', direction: 'output', defaultPin: 'PE1', description: 'USART0 비동기 시리얼 데이터 송신 라인', isHardwareFixed: true },
  { id: 'uart0_rxd', name: 'USART0 RXD', codeName: 'USART0_RXD', category: 'uart', direction: 'input', defaultPin: 'PE0', description: 'USART0 비동기 시리얼 데이터 수신 라인', isHardwareFixed: true },
  { id: 'uart0_xck', name: 'USART0 XCK', codeName: 'USART0_XCK', category: 'uart', direction: 'bidirectional', defaultPin: 'PE2', description: 'USART0 동기 통신 클럭 라인', isHardwareFixed: true },

  // --- UART 1 (atmega2560, atmega640, atmega128) ---
  { id: 'uart1_txd', name: 'USART1 TXD', codeName: 'USART1_TXD', category: 'uart', direction: 'output', defaultPin: 'PD3', description: 'USART1 시리얼 송신 라인 (GPS, 블루투스 모듈)', isHardwareFixed: true, requiredMcus: ['atmega2560', 'atmega640', 'atmega128'] },
  { id: 'uart1_rxd', name: 'USART1 RXD', codeName: 'USART1_RXD', category: 'uart', direction: 'input', defaultPin: 'PD2', description: 'USART1 시리얼 수신 라인', isHardwareFixed: true, requiredMcus: ['atmega2560', 'atmega640', 'atmega128'] },

  // --- UART 2 (atmega2560, atmega640) ---
  { id: 'uart2_txd', name: 'USART2 TXD', codeName: 'USART2_TXD', category: 'uart', direction: 'output', defaultPin: 'PH1', description: 'USART2 보조 시리얼 송신 라인', isHardwareFixed: true, requiredMcus: ['atmega2560', 'atmega640'] },
  { id: 'uart2_rxd', name: 'USART2 RXD', codeName: 'USART2_RXD', category: 'uart', direction: 'input', defaultPin: 'PH0', description: 'USART2 보조 시리얼 수신 라인', isHardwareFixed: true, requiredMcus: ['atmega2560', 'atmega640'] },

  // --- SPI Bus ---
  { id: 'spi_mosi', name: 'SPI MOSI', codeName: 'SPI_MOSI', category: 'spi', direction: 'output', defaultPin: 'PB2', description: 'SPI 마스터 송신 / 슬레이브 수신 데이터 버스', isHardwareFixed: true },
  { id: 'spi_miso', name: 'SPI MISO', codeName: 'SPI_MISO', category: 'spi', direction: 'input', defaultPin: 'PB3', description: 'SPI 슬레이브 송신 / 마스터 수신 데이터 버스', isHardwareFixed: true },
  { id: 'spi_sck', name: 'SPI SCK', codeName: 'SPI_SCK', category: 'spi', direction: 'output', defaultPin: 'PB1', description: 'SPI 동기 고속 직렬 클럭 버스', isHardwareFixed: true },
  { id: 'spi_ss', name: 'SPI SS (CS)', codeName: 'SPI_SS', category: 'spi', direction: 'output', defaultPin: 'PB0', description: 'SPI 슬레이브 셀렉트 (Active Low 칩 선택)', isHardwareFixed: true },

  // --- I2C / TWI Bus ---
  { id: 'i2c_sda', name: 'I2C SDA', codeName: 'I2C_SDA', category: 'i2c', direction: 'bidirectional', defaultPin: 'PD1', description: '2선 직렬 TWI 양방향 오픈드레인 데이터 버스', isHardwareFixed: true },
  { id: 'i2c_scl', name: 'I2C SCL', codeName: 'I2C_SCL', category: 'i2c', direction: 'output', defaultPin: 'PD0', description: '2선 직렬 TWI 동기 클럭 라인 (400kHz Fast Mode)', isHardwareFixed: true },

  // --- Timers & PWM ---
  { id: 'pwm_oc0a', name: 'Timer0 OC0A', codeName: 'PWM_OC0A', category: 'timer', direction: 'output', defaultPin: 'PB7', description: '8비트 Timer0 비교일치 A 고속 파형 출력', isHardwareFixed: true },
  { id: 'pwm_oc0b', name: 'Timer0 OC0B', codeName: 'PWM_OC0B', category: 'timer', direction: 'output', defaultPin: 'PG5', description: '8비트 Timer0 비교일치 B 파형 출력', isHardwareFixed: true },
  { id: 'pwm_oc1a', name: 'Timer1 OC1A', codeName: 'PWM_OC1A', category: 'timer', direction: 'output', defaultPin: 'PB5', description: '16비트 Timer1 Compare A 정밀 16비트 서보 PWM', isHardwareFixed: true },
  { id: 'pwm_oc1b', name: 'Timer1 OC1B', codeName: 'PWM_OC1B', category: 'timer', direction: 'output', defaultPin: 'PB6', description: '16비트 Timer1 Compare B 정밀 PWM 출력', isHardwareFixed: true },
  { id: 'pwm_oc2a', name: 'Timer2 OC2A', codeName: 'PWM_OC2A', category: 'timer', direction: 'output', defaultPin: 'PB4', description: '8비트 Timer2 비동기 RTC / 사운드 톤 PWM 출력', isHardwareFixed: true },
  { id: 'pwm_oc3a', name: 'Timer3 OC3A', codeName: 'PWM_OC3A', category: 'timer', direction: 'output', defaultPin: 'PE3', description: '16비트 Timer3 Compare A 모터 PWM 출력', isHardwareFixed: true, requiredMcus: ['atmega2560', 'atmega640', 'atmega128'] },

  // --- External Interrupts ---
  { id: 'int0', name: 'Ext INT0', codeName: 'EXT_INT0', category: 'interrupt', direction: 'input', defaultPin: 'PD0', description: '외부 하드웨어 인터럽트 0 (비동기 웨이크업)', isHardwareFixed: true },
  { id: 'int1', name: 'Ext INT1', codeName: 'EXT_INT1', category: 'interrupt', direction: 'input', defaultPin: 'PD1', description: '외부 하드웨어 인터럽트 1', isHardwareFixed: true },
  { id: 'int2', name: 'Ext INT2', codeName: 'EXT_INT2', category: 'interrupt', direction: 'input', defaultPin: 'PD2', description: '외부 하드웨어 인터럽트 2 (엔코더 A상)', isHardwareFixed: true, requiredMcus: ['atmega2560', 'atmega640', 'atmega128'] },
  { id: 'int3', name: 'Ext INT3', codeName: 'EXT_INT3', category: 'interrupt', direction: 'input', defaultPin: 'PD3', description: '외부 하드웨어 인터럽트 3 (엔코더 B상)', isHardwareFixed: true, requiredMcus: ['atmega2560', 'atmega640', 'atmega128'] },
  { id: 'int4', name: 'Ext INT4', codeName: 'EXT_INT4', category: 'interrupt', direction: 'input', defaultPin: 'PE4', description: '외부 하드웨어 인터럽트 4 (고속 입력 감지)', isHardwareFixed: true, requiredMcus: ['atmega2560', 'atmega640', 'atmega128'] },
  { id: 'int5', name: 'Ext INT5', codeName: 'EXT_INT5', category: 'interrupt', direction: 'input', defaultPin: 'PE5', description: '외부 하드웨어 인터럽트 5 (고속 입력 감지)', isHardwareFixed: true, requiredMcus: ['atmega2560', 'atmega640', 'atmega128'] },

  // --- ADC Analog Inputs ---
  { id: 'adc0', name: 'ADC0 (Ch0)', codeName: 'ADC_CH0', category: 'adc', direction: 'input', defaultPin: 'PF0', description: '10비트 고감도 아날로그 입력 채널 0 (온도 센서)', isHardwareFixed: true },
  { id: 'adc1', name: 'ADC1 (Ch1)', codeName: 'ADC_CH1', category: 'adc', direction: 'input', defaultPin: 'PF1', description: '10비트 아날로그 입력 채널 1 (가변저항/조도센서)', isHardwareFixed: true },
  { id: 'adc2', name: 'ADC2 (Ch2)', codeName: 'ADC_CH2', category: 'adc', direction: 'input', defaultPin: 'PF2', description: '10비트 아날로그 입력 채널 2 (배터리 전압 센싱)', isHardwareFixed: true },
  { id: 'adc3', name: 'ADC3 (Ch3)', codeName: 'ADC_CH3', category: 'adc', direction: 'input', defaultPin: 'PF3', description: '10비트 아날로그 입력 채널 3 (전류 센서 Shunt)', isHardwareFixed: true },

  // --- Custom GPIO User Signals ---
  { id: 'user_led', name: 'STATUS LED', codeName: 'PIN_STATUS_LED', category: 'custom', direction: 'output', defaultPin: 'PB7', description: '시스템 동작 상태 점멸 표시용 인디케이터 LED', isHardwareFixed: false },
  { id: 'user_buzzer', name: 'PIEZO BUZZER', codeName: 'PIN_BUZZER', category: 'custom', direction: 'output', defaultPin: 'PL3', description: '경보음 및 키 비프음 발생용 피에조 부저', isHardwareFixed: false },
  { id: 'user_relay', name: 'POWER RELAY', codeName: 'PIN_RELAY_CTRL', category: 'custom', direction: 'output', defaultPin: 'PA0', description: '고전압/대전류 릴레이 코일 구동 신호', isHardwareFixed: false },
  { id: 'user_btn', name: 'USER BUTTON', codeName: 'PIN_USER_BTN', category: 'custom', direction: 'input', defaultPin: 'PE4', description: '택트 스위치 입력 (내부 풀업 저항 적용)', isHardwareFixed: false },
  { id: 'user_sensor_cs', name: 'IMU SENSOR CS', codeName: 'PIN_IMU_CS', category: 'custom', direction: 'output', defaultPin: 'PL6', description: '6축 자이로/가속도 센서 전용 SPI 칩 셀렉트', isHardwareFixed: false }
];

// Helper to adapt default pin to ATmega328P differing pinout
const getTargetDefaultPin = (sig: PeripheralSignal, mcu: SupportedMCU): string => {
  if (mcu === 'atmega328p') {
    switch (sig.id) {
      case 'uart0_txd': return 'PD1';
      case 'uart0_rxd': return 'PD0';
      case 'uart0_xck': return 'PD4';
      case 'spi_mosi': return 'PB3';
      case 'spi_miso': return 'PB4';
      case 'spi_sck': return 'PB5';
      case 'spi_ss': return 'PB2';
      case 'i2c_sda': return 'PC4';
      case 'i2c_scl': return 'PC5';
      case 'pwm_oc0a': return 'PD6';
      case 'pwm_oc0b': return 'PD5';
      case 'pwm_oc1a': return 'PB1';
      case 'pwm_oc1b': return 'PB2';
      case 'pwm_oc2a': return 'PB3';
      case 'int0': return 'PD2';
      case 'int1': return 'PD3';
      case 'adc0': return 'PC0';
      case 'adc1': return 'PC1';
      case 'adc2': return 'PC2';
      case 'adc3': return 'PC3';
      case 'user_led': return 'PB5';
      case 'user_buzzer': return 'PD6';
      case 'user_relay': return 'PB0';
      case 'user_btn': return 'PD7';
      case 'user_sensor_cs': return 'PB2';
      default: return sig.defaultPin;
    }
  }
  if (mcu === 'atmega128') {
    switch (sig.id) {
      case 'uart0_txd': return 'PE1';
      case 'uart0_rxd': return 'PE0';
      case 'uart0_xck': return 'PE2';
      case 'uart1_txd': return 'PD3';
      case 'uart1_rxd': return 'PD2';
      case 'spi_mosi': return 'PB2';
      case 'spi_miso': return 'PB3';
      case 'spi_sck': return 'PB1';
      case 'spi_ss': return 'PB0';
      case 'i2c_sda': return 'PD1';
      case 'i2c_scl': return 'PD0';
      case 'pwm_oc0a': return 'PB4';
      case 'pwm_oc1a': return 'PB5';
      case 'pwm_oc1b': return 'PB6';
      case 'pwm_oc2a': return 'PB7';
      case 'pwm_oc3a': return 'PE3';
      case 'int0': return 'PD0';
      case 'int1': return 'PD1';
      case 'int2': return 'PD2';
      case 'int3': return 'PD3';
      case 'adc0': return 'PF0';
      case 'adc1': return 'PF1';
      case 'adc2': return 'PF2';
      case 'adc3': return 'PF3';
      case 'user_led': return 'PB7';
      case 'user_buzzer': return 'PE3';
      case 'user_relay': return 'PA0';
      case 'user_btn': return 'PE4';
      case 'user_sensor_cs': return 'PB0';
      default: return sig.defaultPin;
    }
  }
  // atmega2560 & atmega640
  return sig.defaultPin;
};

export const PeripheralPinMappingDashboard: React.FC<PeripheralPinMappingDashboardProps> = ({
  selectedMCU,
  onSelectMCU
}) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Active signals eligible for this MCU
  const availableSignals = useMemo(() => {
    return ALL_PERIPHERAL_SIGNALS.filter((s) => {
      if (!s.requiredMcus) return true;
      return s.requiredMcus.includes(selectedMCU);
    });
  }, [selectedMCU]);

  // Pin assignments map: pinId -> string[] of signal IDs
  // Initialized to default hardware mapping
  const initializeDefaultMapping = useCallback(
    (mcu: SupportedMCU): Record<string, string[]> => {
      const mapping: Record<string, string[]> = {};
      const eligible = ALL_PERIPHERAL_SIGNALS.filter((s) => !s.requiredMcus || s.requiredMcus.includes(mcu));
      eligible.forEach((sig) => {
        const pin = getTargetDefaultPin(sig, mcu);
        if (!mapping[pin]) mapping[pin] = [];
        // Avoid duplicate initial default collision if possible
        if (!mapping[pin].includes(sig.id)) {
          mapping[pin].push(sig.id);
        }
      });
      return mapping;
    },
    []
  );

  const [pinAssignments, setPinAssignments] = useState<Record<string, string[]>>(() =>
    initializeDefaultMapping(selectedMCU)
  );

  // Re-sync default if MCU changes
  const [prevMCU, setPrevMCU] = useState<SupportedMCU>(selectedMCU);
  if (prevMCU !== selectedMCU) {
    setPrevMCU(selectedMCU);
    setPinAssignments(initializeDefaultMapping(selectedMCU));
  }

  // UI state
  const [activePortFilter, setActivePortFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSignalToAssign, setSelectedSignalToAssign] = useState<string | null>(null);
  const [isCHeaderCopied, setIsCHeaderCopied] = useState<boolean>(false);
  const [draggedSignalId, setDraggedSignalId] = useState<string | null>(null);
  const [dragOverPin, setDragOverPin] = useState<string | null>(null);

  // Category collapse states
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({
    custom: false
  });

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Flattened pin list from current MCU profile
  const allMcuPins = useMemo(() => {
    const list: Array<PinDefinition & { portKey: string }> = [];
    Object.entries(currentProfile.ports).forEach(([portKey, portInfo]) => {
      portInfo.pins.forEach((p) => {
        list.push({ ...p, portKey });
      });
    });
    return list;
  }, [currentProfile]);

  // Port list for tabs
  const portKeys = useMemo(() => {
    return Object.keys(currentProfile.ports);
  }, [currentProfile]);

  // Filtered MCU pins by port tab & search term
  const filteredPins = useMemo(() => {
    return allMcuPins.filter((pinObj) => {
      if (activePortFilter !== 'ALL' && pinObj.portKey !== activePortFilter) return false;
      if (!searchTerm) return true;
      const lower = searchTerm.toLowerCase();
      const matchPin = pinObj.pin.toLowerCase().includes(lower);
      const matchName = pinObj.name.toLowerCase().includes(lower);
      const matchAlt = pinObj.alt.toLowerCase().includes(lower);
      const assignedSigNames = (pinAssignments[pinObj.pin] || [])
        .map((sId) => ALL_PERIPHERAL_SIGNALS.find((s) => s.id === sId)?.name.toLowerCase() || '')
        .join(' ');
      return matchPin || matchName || matchAlt || assignedSigNames.includes(lower);
    });
  }, [allMcuPins, activePortFilter, searchTerm, pinAssignments]);

  // Real-Time Conflict Detection Engine
  const conflicts = useMemo<PinConflict[]>(() => {
    const list: PinConflict[] = [];

    Object.entries(pinAssignments).forEach(([pin, sigIds]) => {
      if (sigIds.length > 1) {
        const sigs = sigIds
          .map((id) => ALL_PERIPHERAL_SIGNALS.find((s) => s.id === id))
          .filter((s): s is PeripheralSignal => Boolean(s));

        // Evaluate conflict severity & electronics explanation
        const hasUart = sigs.some((s) => s.category === 'uart');
        const hasSpi = sigs.some((s) => s.category === 'spi');
        const hasI2c = sigs.some((s) => s.category === 'i2c');
        const hasPwm = sigs.some((s) => s.category === 'timer');
        const hasInt = sigs.some((s) => s.category === 'interrupt');
        const hasAdc = sigs.some((s) => s.category === 'adc');

        let severity: 'critical' | 'warning' = 'critical';
        let explanation = '';
        let solution = '';

        if (hasPwm && hasAdc) {
          explanation =
            '고속 PWM 스위칭 신호(0V/5V 급격한 dV/dt 노이즈)가 초정밀 10-bit ADC 아날로그 샘플앤홀드 커패시터에 직접 결합되어 20LSB 이상의 치명적인 계측 왜곡 및 노이즈가 발생합니다.';
          solution = 'PWM 출력을 타이머 전용 포트로 격리하고, ADC는 아날로그 전용 포트(PF 또는 PC)에 단독 할당하십시오.';
        } else if (hasUart && hasInt) {
          explanation =
            'UART 시리얼 데이터 수신/송신 시 발생하는 전이 에지가 외부 인터럽트(INTx)를 무차별 트리거하여 인터럽트 스톰(Interrupt Storm)으로 CPU가 멈추거나 통신 프레임이 깨집니다.';
          solution = '외부 인터럽트 핀을 별도 버튼/센서 핀으로 분리하고 UART 라인을 단독 배선하십시오.';
        } else if (hasPwm && (hasUart || hasSpi || hasI2c)) {
          explanation =
            '타이머 파형 출력 드라이버가 통신 버스의 클럭 또는 데이터 라인을 강제로 하이/로우로 덮어써 통신 패킷 전송이 불가능해집니다 (전기적 쇼트 및 데이터 손실).';
          solution = '통신 라인과 PWM 모터 제어 라인을 물리적으로 서로 다른 포트 핀에 분배하십시오.';
        } else if (hasSpi && hasI2c) {
          explanation =
            'SPI의 Push-Pull 구동 신호와 I2C의 오픈드레인 풀업 통신 규격이 직접 충돌하여 버스 라벨 레벨이 엉키고 두 통신 주변장치가 모두 정지합니다.';
          solution = 'I2C는 TWI 전용 포트(SDA/SCL)에, SPI는 하드웨어 SPI 전용 포트(MOSI/MISO/SCK)에 분리하십시오.';
        } else {
          explanation = `${sigs.map((s) => s.name).join('와(과) ')}가 [${pin}] 핀을 동시 점유하고 있습니다. 펌웨어 실행 시 두 주변장치 모듈이 DDR 및 출력 레지스터를 상호 덮어쓰게 됩니다.`;
          solution = `충돌 중인 신호 중 하나를 다른 미할당 I/O 핀으로 재배치하여 하드웨어 독립성을 확보하세요.`;
        }

        list.push({
          pin,
          signals: sigs,
          severity,
          title: `[${pin}] 핀 중복 공유 충돌 (${sigs.map((s) => s.name).join(' ⚡ ')})`,
          explanation,
          solution
        });
      }
    });

    return list;
  }, [pinAssignments]);

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, signalId: string) => {
    e.dataTransfer.setData('text/plain', signalId);
    setDraggedSignalId(signalId);
  };

  const handleDragOver = (e: React.DragEvent, pinId: string) => {
    e.preventDefault();
    setDragOverPin(pinId);
  };

  const handleDragLeave = () => {
    setDragOverPin(null);
  };

  const handleDrop = (e: React.DragEvent, targetPin: string) => {
    e.preventDefault();
    setDragOverPin(null);
    const signalId = e.dataTransfer.getData('text/plain') || draggedSignalId;
    if (!signalId) return;

    assignSignalToPin(signalId, targetPin);
    setDraggedSignalId(null);
  };

  // Assign a signal to targetPin
  const assignSignalToPin = (signalId: string, targetPin: string) => {
    setPinAssignments((prev) => {
      const next = { ...prev };

      // Remove signal from any previous pins
      Object.keys(next).forEach((p) => {
        if (next[p]?.includes(signalId)) {
          next[p] = next[p].filter((id) => id !== signalId);
          if (next[p].length === 0) delete next[p];
        }
      });

      // Add to target pin
      if (!next[targetPin]) next[targetPin] = [];
      if (!next[targetPin].includes(signalId)) {
        next[targetPin] = [...next[targetPin], signalId];
      }

      return next;
    });
    setSelectedSignalToAssign(null);
  };

  // Remove a signal from pin
  const removeSignal = (signalId: string, fromPin: string) => {
    setPinAssignments((prev) => {
      const next = { ...prev };
      if (next[fromPin]) {
        next[fromPin] = next[fromPin].filter((id) => id !== signalId);
        if (next[fromPin].length === 0) delete next[fromPin];
      }
      return next;
    });
  };

  // Preset Handlers
  const handleResetToDefault = () => {
    setPinAssignments(initializeDefaultMapping(selectedMCU));
  };

  const handleRoboticsPreset = () => {
    const is328 = selectedMCU === 'atmega328p';
    const is128 = selectedMCU === 'atmega128';

    if (is328) {
      setPinAssignments({
        PD1: ['uart0_txd'],
        PD0: ['uart0_rxd'],
        PB3: ['spi_mosi'],
        PB4: ['spi_miso'],
        PB5: ['spi_sck'],
        PB2: ['spi_ss', 'user_sensor_cs'], // Deliberate test warning or clean
        PC4: ['i2c_sda'],
        PC5: ['i2c_scl'],
        PB1: ['pwm_oc1a'], // Motor Left PWM
        PD3: ['pwm_oc2b'], // Motor Right PWM
        PD5: ['pwm_oc0b'],
        PD2: ['int0'], // Encoder A
        PD7: ['user_btn'],
        PC0: ['adc0'], // Analog Sensor
        PB0: ['user_relay']
      });
    } else if (is128) {
      setPinAssignments({
        PE1: ['uart0_txd'],
        PE0: ['uart0_rxd'],
        PD3: ['uart1_txd'],
        PD2: ['uart1_rxd'],
        PB2: ['spi_mosi'],
        PB3: ['spi_miso'],
        PB1: ['spi_sck'],
        PB0: ['spi_ss'],
        PD1: ['i2c_sda'],
        PD0: ['i2c_scl'],
        PB5: ['pwm_oc1a'],
        PB6: ['pwm_oc1b'],
        PE3: ['pwm_oc3a'],
        PE4: ['int4'],
        PE5: ['int5'],
        PF0: ['adc0'],
        PF1: ['adc1'],
        PB7: ['user_led'],
        PA0: ['user_relay']
      });
    } else {
      // 2560 & 640
      setPinAssignments({
        PE1: ['uart0_txd'],
        PE0: ['uart0_rxd'],
        PD3: ['uart1_txd'],
        PD2: ['uart1_rxd'],
        PH1: ['uart2_txd'],
        PH0: ['uart2_rxd'],
        PB2: ['spi_mosi'],
        PB3: ['spi_miso'],
        PB1: ['spi_sck'],
        PB0: ['spi_ss'],
        PD1: ['i2c_sda'],
        PD0: ['i2c_scl'],
        PB5: ['pwm_oc1a'],
        PB6: ['pwm_oc1b'],
        PE3: ['pwm_oc3a'],
        PL3: ['pwm_oc5a'],
        PE4: ['int4'],
        PE5: ['int5'],
        PF0: ['adc0'],
        PF1: ['adc1'],
        PB7: ['user_led'],
        PL4: ['user_buzzer']
      });
    }
  };

  const handleInduceConflictTest = () => {
    // Deliberately assigns incompatible signals to identical pins
    if (selectedMCU === 'atmega328p') {
      setPinAssignments({
        PD2: ['int0', 'pwm_oc0a'], // INT + High speed PWM collision
        PB3: ['spi_mosi', 'pwm_oc2a', 'user_btn'], // 3 signals on one pin
        PC0: ['adc0', 'pwm_oc0b'], // ADC + PWM collision
        PD1: ['uart0_txd'],
        PD0: ['uart0_rxd']
      });
    } else {
      setPinAssignments({
        PE0: ['uart0_rxd', 'int4'], // UART RX + External INT collision
        PB2: ['spi_mosi', 'pwm_oc1b'], // SPI MOSI + Timer1 PWM collision
        PF0: ['adc0', 'pwm_oc0a'], // ADC + PWM noise collision
        PD1: ['i2c_sda', 'spi_sck'], // I2C + SPI clock collision
        PB7: ['user_led', 'pwm_oc0a']
      });
    }
  };

  const handleAutoResolveConflicts = () => {
    // Distribute conflicting signals back to their native hardware pins
    setPinAssignments(initializeDefaultMapping(selectedMCU));
    confetti({
      particleCount: 45,
      spread: 60,
      origin: { y: 0.6 }
    });
  };

  const handleClearAll = () => {
    setPinAssignments({});
  };

  // Find where a signal is currently assigned
  const findAssignedPin = useCallback(
    (signalId: string): string | null => {
      for (const [pin, sigs] of Object.entries(pinAssignments)) {
        if (sigs.includes(signalId)) return pin;
      }
      return null;
    },
    [pinAssignments]
  );

  // Group signals by category for Visual Pin Tree
  const signalsByCategory = useMemo(() => {
    const map: Record<PeripheralCategory, PeripheralSignal[]> = {
      uart: [],
      spi: [],
      i2c: [],
      timer: [],
      interrupt: [],
      adc: [],
      custom: []
    };
    availableSignals.forEach((s) => {
      map[s.category].push(s);
    });
    return map;
  }, [availableSignals]);

  // Category visual labels
  const categoryMeta: Record<
    PeripheralCategory,
    { title: string; subtitle: string; icon: any; color: string; bg: string; border: string }
  > = {
    uart: {
      title: 'USART 직렬 통신',
      subtitle: 'TXD / RXD / XCK',
      icon: Radio,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/40',
      border: 'border-emerald-800/40'
    },
    spi: {
      title: 'SPI 동기 고속 버스',
      subtitle: 'MOSI / MISO / SCK / SS',
      icon: Zap,
      color: 'text-violet-400',
      bg: 'bg-violet-950/40',
      border: 'border-violet-800/40'
    },
    i2c: {
      title: 'I2C / TWI 2선 버스',
      subtitle: 'SDA / SCL (오픈드레인)',
      icon: Activity,
      color: 'text-cyan-400',
      bg: 'bg-cyan-950/40',
      border: 'border-cyan-800/40'
    },
    timer: {
      title: '타이머 / PWM 파형 출력',
      subtitle: 'OC0A, OC1A/B, OC2A, OC3A',
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-950/40',
      border: 'border-amber-800/40'
    },
    interrupt: {
      title: '외부 하드웨어 인터럽트',
      subtitle: 'INT0 ~ INT7 엣지/레벨',
      icon: AlertTriangle,
      color: 'text-rose-400',
      bg: 'bg-rose-950/40',
      border: 'border-rose-800/40'
    },
    adc: {
      title: 'ADC 아날로그 입력 채널',
      subtitle: '10-bit 아날로그 계측',
      icon: Activity,
      color: 'text-blue-400',
      bg: 'bg-blue-950/40',
      border: 'border-blue-800/40'
    },
    custom: {
      title: '사용자 정의 디지털 GPIO',
      subtitle: 'LED / 부저 / 릴레이 / 버튼',
      icon: Sliders,
      color: 'text-slate-300',
      bg: 'bg-slate-900/60',
      border: 'border-slate-800'
    }
  };

  // C Header Export String
  const generatedCHeader = useMemo(() => {
    const lines: string[] = [
      `/**`,
      ` * ============================================================================`,
      ` * @file    pin_mapping_config.h`,
      ` * @brief   AVR Peripheral Pin Mapping Header for ${currentProfile.name}`,
      ` * @note    Generated by AI Studio AVR Architecture Pin Tree Dashboard`,
      ` * ============================================================================`,
      ` */`,
      `#ifndef PIN_MAPPING_CONFIG_H_`,
      `#define PIN_MAPPING_CONFIG_H_`,
      ``,
      `#include <avr/io.h>`,
      ``
    ];

    if (conflicts.length > 0) {
      lines.push(`/* --------------------------------------------------------------------------`);
      lines.push(` * ⚠️ WARNING: ${conflicts.length} PIN CONFLICT(S) DETECTED IN THIS CONFIGURATION!`);
      conflicts.forEach((c) => {
        lines.push(` * - [${c.pin}]: ${c.signals.map((s) => s.codeName).join(' ⚡ ')}`);
        lines.push(` *   Cause: ${c.explanation}`);
      });
      lines.push(` * -------------------------------------------------------------------------- */`);
      lines.push(``);
    }

    lines.push(`/* Peripheral Signal Pin Macro Definitions */`);

    Object.entries(pinAssignments).forEach(([pin, sigIds]) => {
      const portLetter = pin.charAt(1);
      const pinBit = pin.slice(2);
      sigIds.forEach((sigId) => {
        const sig = ALL_PERIPHERAL_SIGNALS.find((s) => s.id === sigId);
        if (!sig) return;
        lines.push(`/* ${sig.name} (${sig.direction.toUpperCase()}) -> ${pin} */`);
        lines.push(`#define ${sig.codeName}_PORT    PORT${portLetter}`);
        lines.push(`#define ${sig.codeName}_DDR     DDR${portLetter}`);
        lines.push(`#define ${sig.codeName}_PINREG  PIN${portLetter}`);
        lines.push(`#define ${sig.codeName}_BIT     ${pinBit}`);
        lines.push(``);
      });
    });

    lines.push(`/**`);
    lines.push(` * @brief Initialize all mapped GPIO directions & pullups`);
    lines.push(` */`);
    lines.push(`static inline void init_peripheral_pins(void) {`);

    Object.entries(pinAssignments).forEach(([pin, sigIds]) => {
      const portLetter = pin.charAt(1);
      const pinBit = pin.slice(2);
      sigIds.forEach((sigId) => {
        const sig = ALL_PERIPHERAL_SIGNALS.find((s) => s.id === sigId);
        if (!sig) return;
        if (sig.direction === 'output') {
          lines.push(`    /* ${sig.name} (${pin}) as Output */`);
          lines.push(`    DDR${portLetter} |= (1 << ${pinBit});`);
        } else if (sig.direction === 'input') {
          lines.push(`    /* ${sig.name} (${pin}) as Input with Pull-up */`);
          lines.push(`    DDR${portLetter} &= ~(1 << ${pinBit});`);
          lines.push(`    PORT${portLetter} |= (1 << ${pinBit});`);
        }
      });
    });

    lines.push(`}`);
    lines.push(``);
    lines.push(`#endif /* PIN_MAPPING_CONFIG_H_ */`);
    return lines.join('\n');
  }, [pinAssignments, currentProfile, conflicts]);

  const handleCopyHeader = () => {
    navigator.clipboard.writeText(generatedCHeader);
    setIsCHeaderCopied(true);
    setTimeout(() => setIsCHeaderCopied(false), 2500);
  };

  const totalAssignedSignals = useMemo(() => {
    let count = 0;
    Object.values(pinAssignments).forEach((sigs) => {
      count += sigs.length;
    });
    return count;
  }, [pinAssignments]);

  const unassignedSignals = useMemo(() => {
    return availableSignals.filter((s) => !findAssignedPin(s.id));
  }, [availableSignals, findAssignedPin]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl backdrop-blur-md">
      {/* 1. Header & Context */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Cpu className="w-4 h-4" />
            </span>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              주변장치 핀 매핑 대시보드 & 시각적 핀 트리
            </h3>
            <span className="text-xs text-amber-400 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-800/40 font-mono">
              Drag & Drop Pin Matrix
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {currentProfile.name}의 주변장치 신호(UART, SPI, I2C, PWM, 외부 인터럽트, ADC, 커스텀 GPIO)를 드래그 앤 드롭으로 각 포트 핀에 재배치하고, 동일 핀 중복 공유 및 하드웨어 기능 충돌을 실시간 감지하여 경고합니다.
          </p>
        </div>

        {/* MCU Selector & Preset Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onSelectMCU && (
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => (
                <button
                  key={mcuId}
                  onClick={() => onSelectMCU(mcuId)}
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
                    selectedMCU === mcuId
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mcuId === 'atmega2560'
                    ? '2560'
                    : mcuId === 'atmega640'
                    ? '640'
                    : mcuId === 'atmega128'
                    ? '128'
                    : '328P'}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700"
            title="하드웨어 실리콘 기본 핀아웃으로 초기화"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>기본 핀아웃</span>
          </button>

          <button
            onClick={handleRoboticsPreset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-300 text-xs font-semibold transition border border-indigo-800/40"
            title="SPI+I2C+PWM+UART+인터럽트가 골고루 배정된 로보틱스 프리셋"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>로보틱스 프리셋</span>
          </button>

          <button
            onClick={handleInduceConflictTest}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 text-xs font-semibold transition border border-rose-800/40"
            title="동일 핀 공유 충돌(UART+INT, PWM+ADC 등)을 강제 유발하여 경고 도구 테스트"
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>충돌 테스트</span>
          </button>

          <button
            onClick={handleClearAll}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs transition border border-slate-800"
            title="전체 핀 매핑 비우기"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Status Metric Banners */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80">
          <span className="text-slate-500 block text-[11px]">총 물리 I/O 핀 수</span>
          <span className="text-base font-bold text-white flex items-center gap-1.5 mt-0.5">
            <Cpu className="w-4 h-4 text-amber-400" />
            {currentProfile.io} 핀 ({Object.keys(currentProfile.ports).length}개 포트)
          </span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80">
          <span className="text-slate-500 block text-[11px]">매핑 완료된 신호</span>
          <span className="text-base font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            {totalAssignedSignals} / {availableSignals.length} 개
          </span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80">
          <span className="text-slate-500 block text-[11px]">대기 중인 미할당 신호</span>
          <span className="text-base font-bold text-slate-300 flex items-center gap-1.5 mt-0.5">
            <Clock className="w-4 h-4 text-slate-400" />
            {unassignedSignals.length} 개 신호
          </span>
        </div>

        <div
          className={`p-3 rounded-2xl border transition-all ${
            conflicts.length === 0
              ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800/60 text-rose-300 shadow-md shadow-rose-950/50'
          }`}
        >
          <span className="text-[11px] block opacity-80">핀 충돌 실시간 진단</span>
          <span className="text-base font-bold flex items-center gap-1.5 mt-0.5">
            {conflicts.length === 0 ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                충돌 없음 (정상)
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
                {conflicts.length}개 핀 충돌 감지!
              </>
            )}
          </span>
        </div>
      </div>

      {/* 3. Real-Time Conflict Warning Alert Banner */}
      {conflicts.length > 0 && (
        <div className="bg-rose-950/50 border border-rose-700/60 rounded-2xl p-4.5 space-y-3 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-800/50 pb-2.5">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-400 animate-bounce" />
              <span>하드웨어 신호 충돌(Collision) 감지: {conflicts.length}개 핀에서 동일 물리 핀을 중복 점유하고 있습니다!</span>
            </div>
            <button
              onClick={handleAutoResolveConflicts}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-md shadow-rose-900/40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>원클릭 자동 충돌 분리</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {conflicts.map((c, idx) => (
              <div key={idx} className="bg-slate-950/80 border border-rose-900/60 p-3 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-rose-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    {c.title}
                  </span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-900/60 text-rose-200 font-bold">
                    치명적 충돌
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">{c.explanation}</p>
                <div className="text-[11px] text-amber-300/90 bg-amber-950/30 p-2 rounded-lg border border-amber-900/30 font-mono">
                  💡 <strong>해결 가이드:</strong> {c.solution}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Main Two-Column Workstation: Visual Pin Tree (Left) + MCU Pin Rack (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visual Peripheral Tree (Available Signals) */}
        <div className="lg:col-span-5 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                주변장치 신호 풀 (Signal Tree)
              </h4>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              드래그하여 오른쪽 핀에 드롭
            </span>
          </div>

          <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
            {(Object.keys(signalsByCategory) as PeripheralCategory[]).map((categoryKey) => {
              const sigs = signalsByCategory[categoryKey];
              if (sigs.length === 0) return null;
              const meta = categoryMeta[categoryKey];
              const IconComp = meta.icon;
              const isCollapsed = collapsedCategories[categoryKey] ?? false;

              return (
                <div key={categoryKey} className="rounded-xl border border-slate-800/80 overflow-hidden bg-slate-900/40">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(categoryKey)}
                    className="w-full flex items-center justify-between p-2.5 bg-slate-900/90 hover:bg-slate-800/80 transition text-left"
                  >
                    <div className="flex items-center gap-2">
                      <IconComp className={`w-4 h-4 ${meta.color}`} />
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{meta.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({sigs.length})</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{meta.subtitle}</div>
                      </div>
                    </div>
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {/* Signal Items List */}
                  {!isCollapsed && (
                    <div className="p-2 space-y-1.5 bg-slate-950/60">
                      {sigs.map((sig) => {
                        const assignedPin = findAssignedPin(sig.id);
                        const isSelected = selectedSignalToAssign === sig.id;
                        const isDragging = draggedSignalId === sig.id;

                        return (
                          <div
                            key={sig.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, sig.id)}
                            onClick={() => setSelectedSignalToAssign(isSelected ? null : sig.id)}
                            className={`p-2 rounded-lg border text-xs transition cursor-grab active:cursor-grabbing flex items-center justify-between gap-2 ${
                              isDragging
                                ? 'opacity-40 border-dashed border-amber-400 bg-amber-950/20'
                                : isSelected
                                ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                                : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <GripVertical className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <div className="truncate">
                                <div className="font-bold text-white flex items-center gap-1.5 truncate">
                                  <span>{sig.name}</span>
                                  <span
                                    className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                                      sig.direction === 'output'
                                        ? 'bg-amber-950 text-amber-300'
                                        : sig.direction === 'input'
                                        ? 'bg-cyan-950 text-cyan-300'
                                        : 'bg-violet-950 text-violet-300'
                                    }`}
                                  >
                                    {sig.direction.toUpperCase()}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                  {sig.description}
                                </div>
                              </div>
                            </div>

                            {/* Assigned Pin Status Badge */}
                            <div className="shrink-0 flex items-center gap-1">
                              {assignedPin ? (
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 flex items-center gap-1">
                                  <span>👉</span> {assignedPin}
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-400">
                                  미할당
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {selectedSignalToAssign && (
            <div className="p-3 bg-amber-950/40 border border-amber-700/60 rounded-xl text-xs space-y-1 text-amber-200">
              <div className="font-bold flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-400" />
                <span>선택된 신호: {ALL_PERIPHERAL_SIGNALS.find((s) => s.id === selectedSignalToAssign)?.name}</span>
              </div>
              <p className="text-[11px] text-slate-300">
                오른쪽 핀 목록에서 원하는 타깃 핀의 <strong>[이 핀에 할당]</strong> 버튼을 누르거나, 마우스로 직접 드래그하여 드롭하세요.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Interactive MCU Pin Bay (Target Pins & Drop Zones) */}
        <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  {currentProfile.name} 핀 할당 랙 (Pin Bay & Drop Zones)
                </h4>
              </div>
              <span className="text-[11px] text-slate-400">
                드래그한 신호를 원하는 핀에 놓으세요 (동일 핀 드롭 시 충돌 감지)
              </span>
            </div>

            {/* Pin Search Filter */}
            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="핀 번호 / 신호 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>
          </div>

          {/* Port Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono scrollbar-none">
            <button
              onClick={() => setActivePortFilter('ALL')}
              className={`px-3 py-1 rounded-lg transition shrink-0 ${
                activePortFilter === 'ALL'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              전체 핀 ({allMcuPins.length})
            </button>
            {portKeys.map((pKey) => {
              const portPins = allMcuPins.filter((p) => p.portKey === pKey);
              const conflictCount = portPins.filter((p) => (pinAssignments[p.pin]?.length || 0) > 1).length;

              return (
                <button
                  key={pKey}
                  onClick={() => setActivePortFilter(pKey)}
                  className={`px-2.5 py-1 rounded-lg transition shrink-0 flex items-center gap-1 ${
                    activePortFilter === pKey
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span>{pKey.replace('PORT', 'Port ')}</span>
                  {conflictCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Pins Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[580px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
            {filteredPins.map((pinObj) => {
              const assignedSigIds = pinAssignments[pinObj.pin] || [];
              const assignedSignals = assignedSigIds
                .map((id) => ALL_PERIPHERAL_SIGNALS.find((s) => s.id === id))
                .filter((s): s is PeripheralSignal => Boolean(s));

              const isConflict = assignedSignals.length > 1;
              const isDragTarget = dragOverPin === pinObj.pin;

              return (
                <div
                  key={pinObj.pin}
                  onDragOver={(e) => handleDragOver(e, pinObj.pin)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, pinObj.pin)}
                  className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                    isConflict
                      ? 'bg-rose-950/30 border-rose-600/70 shadow-sm shadow-rose-950/40 ring-1 ring-rose-500/40'
                      : isDragTarget
                      ? 'bg-amber-500/20 border-dashed border-amber-400 scale-[1.01]'
                      : assignedSignals.length > 0
                      ? 'bg-slate-900/90 border-slate-700/80'
                      : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Pin Header */}
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="font-black text-white text-sm">{pinObj.pin}</span>
                        {pinObj.physicalPin && (
                          <span className="text-[10px] text-slate-500">
                            (Pin {pinObj.physicalPin})
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 px-1 rounded bg-slate-800">
                          {pinObj.arduino}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]" title={pinObj.alt}>
                        기본: {pinObj.alt}
                      </div>
                    </div>

                    {isConflict && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-900/80 text-rose-300 text-[10px] font-mono font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        충돌 ({assignedSignals.length})
                      </span>
                    )}
                  </div>

                  {/* Assigned Signals Container */}
                  <div className="space-y-1.5">
                    {assignedSignals.length === 0 ? (
                      <div className="border border-dashed border-slate-800 rounded-lg p-2 text-center text-[11px] text-slate-600">
                        미할당 (GPIO 일반 입출력 대기)
                      </div>
                    ) : (
                      assignedSignals.map((sig) => (
                        <div
                          key={sig.id}
                          className={`p-1.5 rounded-lg border text-xs flex items-center justify-between gap-1.5 ${
                            isConflict
                              ? 'bg-rose-950/50 border-rose-800/70 text-rose-200'
                              : 'bg-slate-950 border-slate-800 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span className="font-bold text-xs truncate">{sig.name}</span>
                            <span className="text-[9px] text-slate-400 font-mono">({sig.direction})</span>
                          </div>
                          <button
                            onClick={() => removeSignal(sig.id, pinObj.pin)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                            title="이 핀에서 신호 분리 (Unassign)"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Quick Action Button */}
                  <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-800/60">
                    {selectedSignalToAssign && (
                      <button
                        onClick={() => assignSignalToPin(selectedSignalToAssign, pinObj.pin)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-1 shadow-sm"
                      >
                        <Plus className="w-3 h-3" />
                        <span>이 핀에 할당</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. C Header Generator & Export Section */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              자동 생성된 C 핀 매핑 헤더 (pin_mapping_config.h)
            </h4>
          </div>
          <button
            onClick={handleCopyHeader}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 shrink-0"
          >
            {isCHeaderCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCHeaderCopied ? 'C 헤더 복사 완료!' : 'C 헤더 복사하기'}</span>
          </button>
        </div>

        <pre className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto max-h-48 leading-relaxed select-all">
          {generatedCHeader}
        </pre>
      </div>
    </div>
  );
};
