export interface InterruptVector {
  vectorNum: number;
  programAddress: string; // e.g. "0x0002"
  vectorName: string; // e.g. "INT0_vect"
  sourceName: string; // e.g. "외부 인터럽트 요청 0"
  enableRegister: string; // e.g. "EIMSK (INT0 bit)"
  flagRegister: string; // e.g. "EIFR (INTF0 bit)"
  category: 'external' | 'timer' | 'comm' | 'analog' | 'system' | 'eeprom';
  description: string;
}

// -------------------------------------------------------------
// ATmega328P Interrupt Vectors (26 Vectors)
// -------------------------------------------------------------
export const ATMEGA328P_VECTORS: InterruptVector[] = [
  {
    vectorNum: 1,
    programAddress: '0x0000',
    vectorName: 'RESET_vect',
    sourceName: '리셋 (Power-on, Brown-out, Watchdog, External)',
    enableRegister: '상시 활성화 (하드웨어 고정)',
    flagRegister: 'MCUSR (PORF, EXTRF, BORF, WDRF)',
    category: 'system',
    description: '리셋 발생 시 프로그램 시작 벡터 (0x0000)로 점프'
  },
  {
    vectorNum: 2,
    programAddress: '0x0002',
    vectorName: 'INT0_vect',
    sourceName: '외부 인터럽트 0 (External Interrupt Request 0)',
    enableRegister: 'EIMSK (비트 0: INT0) & SREG (I 비트)',
    flagRegister: 'EIFR (INTF0)',
    category: 'external',
    description: 'PD2 (Pin 4) 핀의 상승/하강/레벨 에지 신호 감지 (EICRA 설정)'
  },
  {
    vectorNum: 3,
    programAddress: '0x0004',
    vectorName: 'INT1_vect',
    sourceName: '외부 인터럽트 1 (External Interrupt Request 1)',
    enableRegister: 'EIMSK (비트 1: INT1) & SREG (I 비트)',
    flagRegister: 'EIFR (INTF1)',
    category: 'external',
    description: 'PD3 (Pin 5) 핀의 신호 에지 변화 감지 (EICRA 설정)'
  },
  {
    vectorNum: 4,
    programAddress: '0x0006',
    vectorName: 'PCINT0_vect',
    sourceName: '핀 체인지 인터럽트 0 (Pin Change Interrupt Request 0)',
    enableRegister: 'PCICR (비트 0: PCIE0) & PCMSK0',
    flagRegister: 'PCIFR (PCIF0)',
    category: 'external',
    description: 'Port B (PB0~PB7) 핀의 로직 레벨 반전 감지'
  },
  {
    vectorNum: 5,
    programAddress: '0x0008',
    vectorName: 'PCINT1_vect',
    sourceName: '핀 체인지 인터럽트 1 (Pin Change Interrupt Request 1)',
    enableRegister: 'PCICR (비트 1: PCIE1) & PCMSK1',
    flagRegister: 'PCIFR (PCIF1)',
    category: 'external',
    description: 'Port C (PC0~PC6) 핀의 로직 레벨 반전 감지'
  },
  {
    vectorNum: 6,
    programAddress: '0x000A',
    vectorName: 'PCINT2_vect',
    sourceName: '핀 체인지 인터럽트 2 (Pin Change Interrupt Request 2)',
    enableRegister: 'PCICR (비트 2: PCIE2) & PCMSK2',
    flagRegister: 'PCIFR (PCIF2)',
    category: 'external',
    description: 'Port D (PD0~PD7) 핀의 로직 레벨 반전 감지'
  },
  {
    vectorNum: 7,
    programAddress: '0x000C',
    vectorName: 'WDT_vect',
    sourceName: '와치독 타이머 타임아웃 인터럽트',
    enableRegister: 'WDTCSR (WDIE bit)',
    flagRegister: 'WDTCSR (WDIF)',
    category: 'system',
    description: '와치독 카운터 만료 시 리셋 대신 인터럽트 발생 (슬립 모드 기동용)'
  },
  {
    vectorNum: 8,
    programAddress: '0x000E',
    vectorName: 'TIMER2_COMPA_vect',
    sourceName: 'Timer/Counter2 Compare Match A',
    enableRegister: 'TIMSK2 (OCIE2A bit)',
    flagRegister: 'TIFR2 (OCF2A)',
    category: 'timer',
    description: '8비트 Timer2 카운터와 OCR2A 비교 일치'
  },
  {
    vectorNum: 9,
    programAddress: '0x0010',
    vectorName: 'TIMER2_COMPB_vect',
    sourceName: 'Timer/Counter2 Compare Match B',
    enableRegister: 'TIMSK2 (OCIE2B bit)',
    flagRegister: 'TIFR2 (OCF2B)',
    category: 'timer',
    description: '8비트 Timer2 카운터와 OCR2B 비교 일치'
  },
  {
    vectorNum: 10,
    programAddress: '0x0012',
    vectorName: 'TIMER2_OVF_vect',
    sourceName: 'Timer/Counter2 Overflow',
    enableRegister: 'TIMSK2 (TOIE2 bit)',
    flagRegister: 'TIFR2 (TOV2)',
    category: 'timer',
    description: 'Timer2 8비트 카운터 오버플로우 (0xFF -> 0x00)'
  },
  {
    vectorNum: 11,
    programAddress: '0x0014',
    vectorName: 'TIMER1_CAPT_vect',
    sourceName: 'Timer/Counter1 Input Capture',
    enableRegister: 'TIMSK1 (ICIE1 bit)',
    flagRegister: 'TIFR1 (ICF1)',
    category: 'timer',
    description: 'ICP1 (PB0) 핀 신호 에지 캡처 시 ICR1 값 저장'
  },
  {
    vectorNum: 12,
    programAddress: '0x0016',
    vectorName: 'TIMER1_COMPA_vect',
    sourceName: 'Timer/Counter1 Compare Match A',
    enableRegister: 'TIMSK1 (OCIE1A bit)',
    flagRegister: 'TIFR1 (OCF1A)',
    category: 'timer',
    description: '16비트 Timer1 카운터와 OCR1A 일치 (정밀 CTC 주기 생성)'
  },
  {
    vectorNum: 13,
    programAddress: '0x0018',
    vectorName: 'TIMER1_COMPB_vect',
    sourceName: 'Timer/Counter1 Compare Match B',
    enableRegister: 'TIMSK1 (OCIE1B bit)',
    flagRegister: 'TIFR1 (OCF1B)',
    category: 'timer',
    description: '16비트 Timer1 카운터와 OCR1B 일치'
  },
  {
    vectorNum: 14,
    programAddress: '0x001A',
    vectorName: 'TIMER1_OVF_vect',
    sourceName: 'Timer/Counter1 Overflow',
    enableRegister: 'TIMSK1 (TOIE1 bit)',
    flagRegister: 'TIFR1 (TOV1)',
    category: 'timer',
    description: '16비트 Timer1 카운터 오버플로우 (0xFFFF -> 0x0000)'
  },
  {
    vectorNum: 15,
    programAddress: '0x001C',
    vectorName: 'TIMER0_COMPA_vect',
    sourceName: 'Timer/Counter0 Compare Match A',
    enableRegister: 'TIMSK0 (OCIE0A bit)',
    flagRegister: 'TIFR0 (OCF0A)',
    category: 'timer',
    description: '8비트 Timer0 카운터와 OCR0A 일치'
  },
  {
    vectorNum: 16,
    programAddress: '0x001E',
    vectorName: 'TIMER0_COMPB_vect',
    sourceName: 'Timer/Counter0 Compare Match B',
    enableRegister: 'TIMSK0 (OCIE0B bit)',
    flagRegister: 'TIFR0 (OCF0B)',
    category: 'timer',
    description: '8비트 Timer0 카운터와 OCR0B 일치'
  },
  {
    vectorNum: 17,
    programAddress: '0x0020',
    vectorName: 'TIMER0_OVF_vect',
    sourceName: 'Timer/Counter0 Overflow (millis/delay)',
    enableRegister: 'TIMSK0 (TOIE0 bit)',
    flagRegister: 'TIFR0 (TOV0)',
    category: 'timer',
    description: '아두이노 millis() 및 micros() 타이밍 기준 클럭 생성'
  },
  {
    vectorNum: 18,
    programAddress: '0x0022',
    vectorName: 'SPI_STC_vect',
    sourceName: 'SPI Serial Transfer Complete',
    enableRegister: 'SPCR (SPIE bit)',
    flagRegister: 'SPSR (SPIF)',
    category: 'comm',
    description: 'SPI 8비트 데이터 바이트 전송/수신 완료 시 발생'
  },
  {
    vectorNum: 19,
    programAddress: '0x0024',
    vectorName: 'USART_RX_vect',
    sourceName: 'USART Rx Complete (데이터 수신 완료)',
    enableRegister: 'UCSR0B (RXCIE0 bit)',
    flagRegister: 'UCSR0A (RXC0)',
    category: 'comm',
    description: 'UDR0 수신 버퍼에 새로운 바이트가 도착했을 때 (링버퍼 저장용)'
  },
  {
    vectorNum: 20,
    programAddress: '0x0026',
    vectorName: 'USART_UDRE_vect',
    sourceName: 'USART Data Register Empty (송신 버퍼 빔)',
    enableRegister: 'UCSR0B (UDRIE0 bit)',
    flagRegister: 'UCSR0A (UDRE0)',
    category: 'comm',
    description: 'UDR0 송신 버퍼가 비어 다음 바이트를 쓸 준비가 되었을 때'
  },
  {
    vectorNum: 21,
    programAddress: '0x0028',
    vectorName: 'USART_TX_vect',
    sourceName: 'USART Tx Complete (송신 완전 완료)',
    enableRegister: 'UCSR0B (TXCIE0 bit)',
    flagRegister: 'UCSR0A (TXC0)',
    category: 'comm',
    description: '시프트 레지스터까지 모든 비트가 전송선으로 나갔을 때'
  },
  {
    vectorNum: 22,
    programAddress: '0x002A',
    vectorName: 'ADC_vect',
    sourceName: 'ADC Conversion Complete (아날로그 변환 완료)',
    enableRegister: 'ADCSRA (ADIE bit)',
    flagRegister: 'ADCSRA (ADIF)',
    category: 'analog',
    description: '10비트 ADC 변환 완료 시 발생 (SLEEP_MODE_ADC 기동용)'
  },
  {
    vectorNum: 23,
    programAddress: '0x002C',
    vectorName: 'EE_READY_vect',
    sourceName: 'EEPROM Ready (EEPROM 준비 완료)',
    enableRegister: 'EECR (EERIE bit)',
    flagRegister: 'EECR (EEPE = 0)',
    category: 'eeprom',
    description: '이전 EEPROM 쓰기 작업이 끝나고 다음 기록이 가능할 때'
  },
  {
    vectorNum: 24,
    programAddress: '0x002E',
    vectorName: 'ANALOG_COMP_vect',
    sourceName: 'Analog Comparator (아날로그 비교기)',
    enableRegister: 'ACSR (ACIE bit)',
    flagRegister: 'ACSR (ACI)',
    category: 'analog',
    description: 'AIN0 및 AIN1 핀의 전압 대소 관계 역전 시 발생'
  },
  {
    vectorNum: 25,
    programAddress: '0x0030',
    vectorName: 'TWI_vect',
    sourceName: '2-wire Serial Interface (I2C / TWI)',
    enableRegister: 'TWCR (TWIE bit)',
    flagRegister: 'TWCR (TWINT)',
    category: 'comm',
    description: 'START, STOP, ACK, 데이터 바이트 송수신 완료 시 발생'
  },
  {
    vectorNum: 26,
    programAddress: '0x0032',
    vectorName: 'SPM_READY_vect',
    sourceName: 'Store Program Memory Ready',
    enableRegister: 'SPMCSR (SPMIE bit)',
    flagRegister: 'SPMCSR (SPMEN = 0)',
    category: 'system',
    description: '플래시 메모리 페이지 쓰기 작업 완료 (부트로더 전용)'
  }
];

// -------------------------------------------------------------
// ATmega128 Interrupt Vectors (35 Vectors)
// -------------------------------------------------------------
export const ATMEGA128_VECTORS: InterruptVector[] = [
  {
    vectorNum: 1,
    programAddress: '0x0000',
    vectorName: 'RESET_vect',
    sourceName: '리셋 (Power-on, Brown-out, Watchdog, External)',
    enableRegister: '상시 활성화',
    flagRegister: 'MCUCSR',
    category: 'system',
    description: '하드웨어 리셋 점프 벡터'
  },
  {
    vectorNum: 2,
    programAddress: '0x0002',
    vectorName: 'INT0_vect',
    sourceName: '외부 인터럽트 0 (PD0 Pin)',
    enableRegister: 'EIMSK (INT0 bit)',
    flagRegister: 'EIFR (INTF0)',
    category: 'external',
    description: 'PD0 핀 신호 에지/레벨 감지'
  },
  {
    vectorNum: 3,
    programAddress: '0x0004',
    vectorName: 'INT1_vect',
    sourceName: '외부 인터럽트 1 (PD1 Pin)',
    enableRegister: 'EIMSK (INT1 bit)',
    flagRegister: 'EIFR (INTF1)',
    category: 'external',
    description: 'PD1 핀 신호 에지/레벨 감지'
  },
  {
    vectorNum: 4,
    programAddress: '0x0006',
    vectorName: 'INT2_vect',
    sourceName: '외부 인터럽트 2 (PD2 Pin)',
    enableRegister: 'EIMSK (INT2 bit)',
    flagRegister: 'EIFR (INTF2)',
    category: 'external',
    description: 'PD2 핀 신호 감지'
  },
  {
    vectorNum: 5,
    programAddress: '0x0008',
    vectorName: 'INT3_vect',
    sourceName: '외부 인터럽트 3 (PD3 Pin)',
    enableRegister: 'EIMSK (INT3 bit)',
    flagRegister: 'EIFR (INTF3)',
    category: 'external',
    description: 'PD3 핀 신호 감지'
  },
  {
    vectorNum: 6,
    programAddress: '0x000A',
    vectorName: 'INT4_vect',
    sourceName: '외부 인터럽트 4 (PE4 Pin)',
    enableRegister: 'EIMSK (INT4 bit)',
    flagRegister: 'EIFR (INTF4)',
    category: 'external',
    description: 'PE4 핀 신호 감지 (비동기 슬립 복귀 가능)'
  },
  {
    vectorNum: 7,
    programAddress: '0x000C',
    vectorName: 'INT5_vect',
    sourceName: '외부 인터럽트 5 (PE5 Pin)',
    enableRegister: 'EIMSK (INT5 bit)',
    flagRegister: 'EIFR (INTF5)',
    category: 'external',
    description: 'PE5 핀 신호 감지'
  },
  {
    vectorNum: 8,
    programAddress: '0x000E',
    vectorName: 'INT6_vect',
    sourceName: '외부 인터럽트 6 (PE6 Pin)',
    enableRegister: 'EIMSK (INT6 bit)',
    flagRegister: 'EIFR (INTF6)',
    category: 'external',
    description: 'PE6 핀 신호 감지'
  },
  {
    vectorNum: 9,
    programAddress: '0x0010',
    vectorName: 'INT7_vect',
    sourceName: '외부 인터럽트 7 (PE7 Pin)',
    enableRegister: 'EIMSK (INT7 bit)',
    flagRegister: 'EIFR (INTF7)',
    category: 'external',
    description: 'PE7 핀 신호 감지'
  },
  {
    vectorNum: 10,
    programAddress: '0x0012',
    vectorName: 'TIMER2_COMP_vect',
    sourceName: 'Timer/Counter2 Compare Match',
    enableRegister: 'TIMSK (OCIE2 bit)',
    flagRegister: 'TIFR (OCF2)',
    category: 'timer',
    description: '8비트 Timer2 카운터와 OCR2 일치'
  },
  {
    vectorNum: 11,
    programAddress: '0x0014',
    vectorName: 'TIMER2_OVF_vect',
    sourceName: 'Timer/Counter2 Overflow',
    enableRegister: 'TIMSK (TOIE2 bit)',
    flagRegister: 'TIFR (TOV2)',
    category: 'timer',
    description: 'Timer2 8비트 카운터 오버플로우'
  },
  {
    vectorNum: 12,
    programAddress: '0x0016',
    vectorName: 'TIMER1_CAPT_vect',
    sourceName: 'Timer/Counter1 Input Capture',
    enableRegister: 'TIMSK (TICIE1 bit)',
    flagRegister: 'TIFR (ICF1)',
    category: 'timer',
    description: 'ICP1 (PD4) 핀 입력 캡처'
  },
  {
    vectorNum: 13,
    programAddress: '0x0018',
    vectorName: 'TIMER1_COMPA_vect',
    sourceName: 'Timer/Counter1 Compare Match A',
    enableRegister: 'TIMSK (OCIE1A bit)',
    flagRegister: 'TIFR (OCF1A)',
    category: 'timer',
    description: '16비트 Timer1 카운터와 OCR1A 일치'
  },
  {
    vectorNum: 14,
    programAddress: '0x001A',
    vectorName: 'TIMER1_COMPB_vect',
    sourceName: 'Timer/Counter1 Compare Match B',
    enableRegister: 'TIMSK (OCIE1B bit)',
    flagRegister: 'TIFR (OCF1B)',
    category: 'timer',
    description: '16비트 Timer1 카운터와 OCR1B 일치'
  },
  {
    vectorNum: 15,
    programAddress: '0x001C',
    vectorName: 'TIMER1_OVF_vect',
    sourceName: 'Timer/Counter1 Overflow',
    enableRegister: 'TIMSK (TOIE1 bit)',
    flagRegister: 'TIFR (TOV1)',
    category: 'timer',
    description: '16비트 Timer1 오버플로우'
  },
  {
    vectorNum: 16,
    programAddress: '0x001E',
    vectorName: 'TIMER0_COMP_vect',
    sourceName: 'Timer/Counter0 Compare Match',
    enableRegister: 'TIMSK (OCIE0 bit)',
    flagRegister: 'TIFR (OCF0)',
    category: 'timer',
    description: '8비트 Timer0 카운터와 OCR0 일치'
  },
  {
    vectorNum: 17,
    programAddress: '0x0020',
    vectorName: 'TIMER0_OVF_vect',
    sourceName: 'Timer/Counter0 Overflow',
    enableRegister: 'TIMSK (TOIE0 bit)',
    flagRegister: 'TIFR (TOV0)',
    category: 'timer',
    description: '8비트 Timer0 오버플로우'
  },
  {
    vectorNum: 18,
    programAddress: '0x0022',
    vectorName: 'SPI_STC_vect',
    sourceName: 'SPI Serial Transfer Complete',
    enableRegister: 'SPCR (SPIE bit)',
    flagRegister: 'SPSR (SPIF)',
    category: 'comm',
    description: 'SPI 바이트 송수신 완료'
  },
  {
    vectorNum: 19,
    programAddress: '0x0024',
    vectorName: 'USART0_RX_vect',
    sourceName: 'USART0 Rx Complete',
    enableRegister: 'UCSR0B (RXCIE0 bit)',
    flagRegister: 'UCSR0A (RXC0)',
    category: 'comm',
    description: 'USART0 데이터 수신 완료'
  },
  {
    vectorNum: 20,
    programAddress: '0x0026',
    vectorName: 'USART0_UDRE_vect',
    sourceName: 'USART0 Data Register Empty',
    enableRegister: 'UCSR0B (UDRIE0 bit)',
    flagRegister: 'UCSR0A (UDRE0)',
    category: 'comm',
    description: 'USART0 송신 버퍼 빔'
  },
  {
    vectorNum: 21,
    programAddress: '0x0028',
    vectorName: 'USART0_TX_vect',
    sourceName: 'USART0 Tx Complete',
    enableRegister: 'UCSR0B (TXCIE0 bit)',
    flagRegister: 'UCSR0A (TXC0)',
    category: 'comm',
    description: 'USART0 송신 완료'
  },
  {
    vectorNum: 22,
    programAddress: '0x002A',
    vectorName: 'ADC_vect',
    sourceName: 'ADC Conversion Complete',
    enableRegister: 'ADCSRA (ADIE bit)',
    flagRegister: 'ADCSRA (ADIF)',
    category: 'analog',
    description: '10비트 ADC 변환 완료'
  },
  {
    vectorNum: 23,
    programAddress: '0x002C',
    vectorName: 'EE_READY_vect',
    sourceName: 'EEPROM Ready',
    enableRegister: 'EECR (EERIE bit)',
    flagRegister: 'EECR (EEWE = 0)',
    category: 'eeprom',
    description: 'EEPROM 쓰기 완료'
  },
  {
    vectorNum: 24,
    programAddress: '0x002E',
    vectorName: 'ANALOG_COMP_vect',
    sourceName: 'Analog Comparator',
    enableRegister: 'ACSR (ACIE bit)',
    flagRegister: 'ACSR (ACI)',
    category: 'analog',
    description: '아날로그 비교기 전압 비교 일치'
  },
  {
    vectorNum: 25,
    programAddress: '0x0030',
    vectorName: 'TIMER1_COMPC_vect',
    sourceName: 'Timer/Counter1 Compare Match C',
    enableRegister: 'ETIMSK (OCIE1C bit)',
    flagRegister: 'ETIFR (OCF1C)',
    category: 'timer',
    description: '16비트 Timer1 OCR1C 일치'
  },
  {
    vectorNum: 26,
    programAddress: '0x0032',
    vectorName: 'TIMER3_CAPT_vect',
    sourceName: 'Timer/Counter3 Input Capture',
    enableRegister: 'ETIMSK (TICIE3 bit)',
    flagRegister: 'ETIFR (ICF3)',
    category: 'timer',
    description: '16비트 Timer3 입력 캡처 (PE7)'
  },
  {
    vectorNum: 27,
    programAddress: '0x0034',
    vectorName: 'TIMER3_COMPA_vect',
    sourceName: 'Timer/Counter3 Compare Match A',
    enableRegister: 'ETIMSK (OCIE3A bit)',
    flagRegister: 'ETIFR (OCF3A)',
    category: 'timer',
    description: '16비트 Timer3 OCR3A 일치'
  },
  {
    vectorNum: 28,
    programAddress: '0x0036',
    vectorName: 'TIMER3_COMPB_vect',
    sourceName: 'Timer/Counter3 Compare Match B',
    enableRegister: 'ETIMSK (OCIE3B bit)',
    flagRegister: 'ETIFR (OCF3B)',
    category: 'timer',
    description: '16비트 Timer3 OCR3B 일치'
  },
  {
    vectorNum: 29,
    programAddress: '0x0038',
    vectorName: 'TIMER3_COMPC_vect',
    sourceName: 'Timer/Counter3 Compare Match C',
    enableRegister: 'ETIMSK (OCIE3C bit)',
    flagRegister: 'ETIFR (OCF3C)',
    category: 'timer',
    description: '16비트 Timer3 OCR3C 일치'
  },
  {
    vectorNum: 30,
    programAddress: '0x003A',
    vectorName: 'TIMER3_OVF_vect',
    sourceName: 'Timer/Counter3 Overflow',
    enableRegister: 'ETIMSK (TOIE3 bit)',
    flagRegister: 'ETIFR (TOV3)',
    category: 'timer',
    description: '16비트 Timer3 오버플로우'
  },
  {
    vectorNum: 31,
    programAddress: '0x003C',
    vectorName: 'USART1_RX_vect',
    sourceName: 'USART1 Rx Complete (2번째 시리얼)',
    enableRegister: 'UCSR1B (RXCIE1 bit)',
    flagRegister: 'UCSR1A (RXC1)',
    category: 'comm',
    description: '★ M103C 퓨즈 해제 시에만 온전히 사용 가능한 USART1 수신 인터럽트'
  },
  {
    vectorNum: 32,
    programAddress: '0x003E',
    vectorName: 'USART1_UDRE_vect',
    sourceName: 'USART1 Data Register Empty',
    enableRegister: 'UCSR1B (UDRIE1 bit)',
    flagRegister: 'UCSR1A (UDRE1)',
    category: 'comm',
    description: 'USART1 송신 버퍼 빔'
  },
  {
    vectorNum: 33,
    programAddress: '0x0040',
    vectorName: 'USART1_TX_vect',
    sourceName: 'USART1 Tx Complete',
    enableRegister: 'UCSR1B (TXCIE1 bit)',
    flagRegister: 'UCSR1A (TXC1)',
    category: 'comm',
    description: 'USART1 송신 완료'
  },
  {
    vectorNum: 34,
    programAddress: '0x0042',
    vectorName: 'TWI_vect',
    sourceName: 'Two-wire Serial Interface (I2C)',
    enableRegister: 'TWCR (TWIE bit)',
    flagRegister: 'TWCR (TWINT)',
    category: 'comm',
    description: 'I2C 통신 이벤트 완료'
  },
  {
    vectorNum: 35,
    programAddress: '0x0044',
    vectorName: 'SPM_READY_vect',
    sourceName: 'Store Program Memory Ready',
    enableRegister: 'SPMCSR (SPMIE bit)',
    flagRegister: 'SPMCSR (SPMEN = 0)',
    category: 'system',
    description: '플래시 메모리 프로그래밍 완료'
  }
];

// -------------------------------------------------------------
// ATmega640 Interrupt Vectors (57 Vectors) - Core subset and crucial ones
// -------------------------------------------------------------
export const ATMEGA640_VECTORS: InterruptVector[] = [
  {
    vectorNum: 1,
    programAddress: '0x0000',
    vectorName: 'RESET_vect',
    sourceName: '리셋 (Power-on, Brown-out, Watchdog, External)',
    enableRegister: '상시 활성화',
    flagRegister: 'MCUSR',
    category: 'system',
    description: '100핀 아키텍처 리셋 점프 벡터'
  },
  {
    vectorNum: 2,
    programAddress: '0x0002',
    vectorName: 'INT0_vect',
    sourceName: '외부 인터럽트 0 (PD0 Pin)',
    enableRegister: 'EIMSK (INT0 bit)',
    flagRegister: 'EIFR (INTF0)',
    category: 'external',
    description: 'PD0 핀 신호 감지'
  },
  {
    vectorNum: 3,
    programAddress: '0x0004',
    vectorName: 'INT1_vect',
    sourceName: '외부 인터럽트 1 (PD1 Pin)',
    enableRegister: 'EIMSK (INT1 bit)',
    flagRegister: 'EIFR (INTF1)',
    category: 'external',
    description: 'PD1 핀 신호 감지'
  },
  {
    vectorNum: 4,
    programAddress: '0x0006',
    vectorName: 'INT2_vect',
    sourceName: '외부 인터럽트 2 (PD2 Pin)',
    enableRegister: 'EIMSK (INT2 bit)',
    flagRegister: 'EIFR (INTF2)',
    category: 'external',
    description: 'PD2 핀 신호 감지'
  },
  {
    vectorNum: 5,
    programAddress: '0x0008',
    vectorName: 'INT3_vect',
    sourceName: '외부 인터럽트 3 (PD3 Pin)',
    enableRegister: 'EIMSK (INT3 bit)',
    flagRegister: 'EIFR (INTF3)',
    category: 'external',
    description: 'PD3 핀 신호 감지'
  },
  {
    vectorNum: 6,
    programAddress: '0x000A',
    vectorName: 'INT4_vect',
    sourceName: '외부 인터럽트 4 (PE4 Pin)',
    enableRegister: 'EIMSK (INT4 bit)',
    flagRegister: 'EIFR (INTF4)',
    category: 'external',
    description: 'PE4 핀 비동기 감지'
  },
  {
    vectorNum: 7,
    programAddress: '0x000C',
    vectorName: 'INT5_vect',
    sourceName: '외부 인터럽트 5 (PE5 Pin)',
    enableRegister: 'EIMSK (INT5 bit)',
    flagRegister: 'EIFR (INTF5)',
    category: 'external',
    description: 'PE5 핀 비동기 감지'
  },
  {
    vectorNum: 8,
    programAddress: '0x000E',
    vectorName: 'INT6_vect',
    sourceName: '외부 인터럽트 6 (PE6 Pin)',
    enableRegister: 'EIMSK (INT6 bit)',
    flagRegister: 'EIFR (INTF6)',
    category: 'external',
    description: 'PE6 핀 비동기 감지'
  },
  {
    vectorNum: 9,
    programAddress: '0x0010',
    vectorName: 'INT7_vect',
    sourceName: '외부 인터럽트 7 (PE7 Pin)',
    enableRegister: 'EIMSK (INT7 bit)',
    flagRegister: 'EIFR (INTF7)',
    category: 'external',
    description: 'PE7 핀 비동기 감지'
  },
  {
    vectorNum: 10,
    programAddress: '0x0012',
    vectorName: 'PCINT0_vect',
    sourceName: '핀 체인지 인터럽트 0 (Port B: PB0~PB7)',
    enableRegister: 'PCICR (PCIE0 bit) & PCMSK0',
    flagRegister: 'PCIFR (PCIF0)',
    category: 'external',
    description: 'Port B 핀 레벨 반전 감지'
  },
  {
    vectorNum: 11,
    programAddress: '0x0014',
    vectorName: 'PCINT1_vect',
    sourceName: '핀 체인지 인터럽트 1 (Port J: PJ0~PJ6)',
    enableRegister: 'PCICR (PCIE1 bit) & PCMSK1',
    flagRegister: 'PCIFR (PCIF1)',
    category: 'external',
    description: 'Port J 핀 레벨 반전 감지'
  },
  {
    vectorNum: 12,
    programAddress: '0x0016',
    vectorName: 'PCINT2_vect',
    sourceName: '핀 체인지 인터럽트 2 (Port K: PK0~PK7)',
    enableRegister: 'PCICR (PCIE2 bit) & PCMSK2',
    flagRegister: 'PCIFR (PCIF2)',
    category: 'external',
    description: 'Port K 핀 레벨 반전 감지'
  },
  {
    vectorNum: 13,
    programAddress: '0x0018',
    vectorName: 'WDT_vect',
    sourceName: '와치독 타이머 인터럽트',
    enableRegister: 'WDTCSR (WDIE bit)',
    flagRegister: 'WDTCSR (WDIF)',
    category: 'system',
    description: 'Watchdog 만료 인터럽트'
  },
  {
    vectorNum: 14,
    programAddress: '0x001A',
    vectorName: 'TIMER2_COMPA_vect',
    sourceName: 'Timer/Counter2 Compare Match A',
    enableRegister: 'TIMSK2 (OCIE2A bit)',
    flagRegister: 'TIFR2 (OCF2A)',
    category: 'timer',
    description: 'Timer2 OCR2A 일치'
  },
  {
    vectorNum: 15,
    programAddress: '0x001C',
    vectorName: 'TIMER2_COMPB_vect',
    sourceName: 'Timer/Counter2 Compare Match B',
    enableRegister: 'TIMSK2 (OCIE2B bit)',
    flagRegister: 'TIFR2 (OCF2B)',
    category: 'timer',
    description: 'Timer2 OCR2B 일치'
  },
  {
    vectorNum: 16,
    programAddress: '0x001E',
    vectorName: 'TIMER2_OVF_vect',
    sourceName: 'Timer/Counter2 Overflow (RTC)',
    enableRegister: 'TIMSK2 (TOIE2 bit)',
    flagRegister: 'TIFR2 (TOV2)',
    category: 'timer',
    description: '32.768kHz TOSC RTC 카운터 오버플로우'
  },
  {
    vectorNum: 17,
    programAddress: '0x0020',
    vectorName: 'TIMER1_CAPT_vect',
    sourceName: 'Timer/Counter1 Input Capture',
    enableRegister: 'TIMSK1 (ICIE1 bit)',
    flagRegister: 'TIFR1 (ICF1)',
    category: 'timer',
    description: 'Timer1 입력 캡처 (PD4)'
  },
  {
    vectorNum: 18,
    programAddress: '0x0022',
    vectorName: 'TIMER1_COMPA_vect',
    sourceName: 'Timer/Counter1 Compare Match A',
    enableRegister: 'TIMSK1 (OCIE1A bit)',
    flagRegister: 'TIFR1 (OCF1A)',
    category: 'timer',
    description: '16비트 Timer1 OCR1A 일치'
  },
  {
    vectorNum: 19,
    programAddress: '0x0024',
    vectorName: 'TIMER1_COMPB_vect',
    sourceName: 'Timer/Counter1 Compare Match B',
    enableRegister: 'TIMSK1 (OCIE1B bit)',
    flagRegister: 'TIFR1 (OCF1B)',
    category: 'timer',
    description: '16비트 Timer1 OCR1B 일치'
  },
  {
    vectorNum: 20,
    programAddress: '0x0026',
    vectorName: 'TIMER1_COMPC_vect',
    sourceName: 'Timer/Counter1 Compare Match C',
    enableRegister: 'TIMSK1 (OCIE1C bit)',
    flagRegister: 'TIFR1 (OCF1C)',
    category: 'timer',
    description: '16비트 Timer1 OCR1C 일치'
  },
  {
    vectorNum: 21,
    programAddress: '0x0028',
    vectorName: 'TIMER1_OVF_vect',
    sourceName: 'Timer/Counter1 Overflow',
    enableRegister: 'TIMSK1 (TOIE1 bit)',
    flagRegister: 'TIFR1 (TOV1)',
    category: 'timer',
    description: '16비트 Timer1 오버플로우'
  },
  {
    vectorNum: 26,
    programAddress: '0x0032',
    vectorName: 'USART0_RX_vect',
    sourceName: 'USART0 Rx Complete',
    enableRegister: 'UCSR0B (RXCIE0 bit)',
    flagRegister: 'UCSR0A (RXC0)',
    category: 'comm',
    description: 'USART0 수신 완료'
  },
  {
    vectorNum: 27,
    programAddress: '0x0034',
    vectorName: 'USART0_UDRE_vect',
    sourceName: 'USART0 Data Register Empty',
    enableRegister: 'UCSR0B (UDRIE0 bit)',
    flagRegister: 'UCSR0A (UDRE0)',
    category: 'comm',
    description: 'USART0 송신 버퍼 빔'
  },
  {
    vectorNum: 28,
    programAddress: '0x0036',
    vectorName: 'USART0_TX_vect',
    sourceName: 'USART0 Tx Complete',
    enableRegister: 'UCSR0B (TXCIE0 bit)',
    flagRegister: 'UCSR0A (TXC0)',
    category: 'comm',
    description: 'USART0 송신 완료'
  },
  {
    vectorNum: 31,
    programAddress: '0x003C',
    vectorName: 'TIMER3_COMPA_vect',
    sourceName: 'Timer/Counter3 Compare Match A',
    enableRegister: 'TIMSK3 (OCIE3A bit)',
    flagRegister: 'TIFR3 (OCF3A)',
    category: 'timer',
    description: '16비트 Timer3 OCR3A 일치'
  },
  {
    vectorNum: 36,
    programAddress: '0x0046',
    vectorName: 'USART1_RX_vect',
    sourceName: 'USART1 Rx Complete (2번째 포트)',
    enableRegister: 'UCSR1B (RXCIE1 bit)',
    flagRegister: 'UCSR1A (RXC1)',
    category: 'comm',
    description: 'USART1 수신 완료 (PD2)'
  },
  {
    vectorNum: 41,
    programAddress: '0x0050',
    vectorName: 'TIMER4_COMPA_vect',
    sourceName: 'Timer/Counter4 Compare Match A',
    enableRegister: 'TIMSK4 (OCIE4A bit)',
    flagRegister: 'TIFR4 (OCF4A)',
    category: 'timer',
    description: '16비트 Timer4 OCR4A 일치 (PH3)'
  },
  {
    vectorNum: 46,
    programAddress: '0x005A',
    vectorName: 'TIMER5_COMPA_vect',
    sourceName: 'Timer/Counter5 Compare Match A',
    enableRegister: 'TIMSK5 (OCIE5A bit)',
    flagRegister: 'TIFR5 (OCF5A)',
    category: 'timer',
    description: '16비트 Timer5 OCR5A 일치 (PL3)'
  },
  {
    vectorNum: 51,
    programAddress: '0x0064',
    vectorName: 'USART2_RX_vect',
    sourceName: 'USART2 Rx Complete (3번째 포트)',
    enableRegister: 'UCSR2B (RXCIE2 bit)',
    flagRegister: 'UCSR2A (RXC2)',
    category: 'comm',
    description: 'USART2 수신 완료 (PH0)'
  },
  {
    vectorNum: 54,
    programAddress: '0x006A',
    vectorName: 'USART3_RX_vect',
    sourceName: 'USART3 Rx Complete (4번째 포트)',
    enableRegister: 'UCSR3B (RXCIE3 bit)',
    flagRegister: 'UCSR3A (RXC3)',
    category: 'comm',
    description: 'USART3 수신 완료 (PJ0)'
  }
];

export const getVectorTableByMCU = (mcu: 'atmega640' | 'atmega128' | 'atmega328p'): InterruptVector[] => {
  if (mcu === 'atmega328p') return ATMEGA328P_VECTORS;
  if (mcu === 'atmega128') return ATMEGA128_VECTORS;
  return ATMEGA640_VECTORS;
};
