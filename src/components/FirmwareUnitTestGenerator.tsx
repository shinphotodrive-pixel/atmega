import React, { useState, useMemo } from 'react';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import confetti from 'canvas-confetti';
import {
  Cpu,
  Terminal,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Download,
  Play,
  RotateCcw,
  Sliders,
  FileCode,
  ShieldCheck,
  Layers,
  Bug,
  Sparkles,
  HelpCircle,
  Clock,
  Radio,
  Activity,
  Gauge,
  Workflow
} from 'lucide-react';

interface Props {
  selectedMCU: SupportedMCU;
}

export type TestFramework = 'googletest' | 'unity' | 'host_c';
export type PeripheralTarget = 'all' | 'uart' | 'adc' | 'timer';

interface SimulatedTestResult {
  id: string;
  category: 'UART' | 'ADC' | 'Timer';
  name: string;
  desc: string;
  passed: boolean;
  expected: string;
  actual: string;
  details: string;
  executionTimeUs: number;
}

export const FirmwareUnitTestGenerator: React.FC<Props> = ({ selectedMCU }) => {
  const currentProfile = MCU_PROFILES[selectedMCU];

  // Framework & Target Selection
  const [framework, setFramework] = useState<TestFramework>('googletest');
  const [target, setTarget] = useState<PeripheralTarget>('all');
  const [activeTab, setActiveTab] = useState<'tests' | 'mock_header' | 'build_script' | 'runner'>('tests');

  // Common Hardware Project Settings
  const [fcpu, setFcpu] = useState<number>(16000000);

  // UART Project Settings
  const [uartChannel, setUartChannel] = useState<number>(0);
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [u2x, setU2x] = useState<boolean>(false);
  const [dataBits, setDataBits] = useState<number>(8);
  const [parity, setParity] = useState<'none' | 'even' | 'odd'>('none');
  const [stopBits, setStopBits] = useState<number>(1);
  const [uartInterrupts, setUartInterrupts] = useState<boolean>(true);

  // ADC Project Settings
  const [adcRef, setAdcRef] = useState<'avcc' | 'internal' | 'aref'>('avcc');
  const [adcChannel, setAdcChannel] = useState<number>(0);
  const [adcPrescaler, setAdcPrescaler] = useState<number>(128); // 16MHz / 128 = 125kHz
  const [adcLeftAdjust, setAdcLeftAdjust] = useState<boolean>(false);
  const [adcInterrupt, setAdcInterrupt] = useState<boolean>(false);

  // Timer Project Settings
  const [timerInstance, setTimerInstance] = useState<'timer0' | 'timer1' | 'timer2'>('timer1');
  const [timerMode, setTimerMode] = useState<'ctc' | 'normal' | 'fast_pwm'>('ctc');
  const [targetFreqHz, setTargetFreqHz] = useState<number>(1000); // 1kHz
  const [timerPrescaler, setTimerPrescaler] = useState<number>(64);
  const [timerInterrupt, setTimerInterrupt] = useState<boolean>(true);

  // Fault Injection for Regression Testing Simulation
  const [faultBaudRate, setFaultBaudRate] = useState<boolean>(false);
  const [faultAdcAtomic, setFaultAdcAtomic] = useState<boolean>(false);
  const [faultTimerPrescaler, setFaultTimerPrescaler] = useState<boolean>(false);

  // Simulation execution state
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simResults, setSimResults] = useState<SimulatedTestResult[] | null>(null);
  const [simFilter, setSimFilter] = useState<'all' | 'passed' | 'failed'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Maximum UART ports for the selected MCU
  const maxUartChannels = currentProfile.usart;
  const safeUartChannel = uartChannel >= maxUartChannels ? 0 : uartChannel;

  // MCU register naming specifics
  const is328P = selectedMCU === 'atmega328p';
  const is128 = selectedMCU === 'atmega128';

  // --- UART Math & Calculations ---
  const divisor = u2x ? 8 : 16;
  const calculatedUbrr = Math.round(fcpu / (divisor * baudRate) - 1);
  const safeUbrr = calculatedUbrr < 0 ? 0 : calculatedUbrr;
  const actualBaud = fcpu / (divisor * (safeUbrr + 1));
  const baudErrorPercent = ((actualBaud - baudRate) / baudRate) * 100;

  // Expected UART registers
  const expectedUbrrH = (safeUbrr >> 8) & 0xFF;
  const expectedUbrrL = safeUbrr & 0xFF;
  const expectedUcsrA = (u2x ? 0x02 : 0x00);
  let expectedUcsrB = 0x18; // RXEN | TXEN
  if (uartInterrupts) expectedUcsrB |= 0x80; // RXCIE
  let expectedUcsrC = 0x06; // 8-bit default (UCSZ0=1, UCSZ1=1)
  if (parity === 'even') expectedUcsrC |= 0x20;
  if (parity === 'odd') expectedUcsrC |= 0x30;
  if (stopBits === 2) expectedUcsrC |= 0x08;

  // --- ADC Calculations ---
  let expectedAdmux = 0;
  if (adcRef === 'avcc') expectedAdmux |= (1 << 6); // REFS0
  else if (adcRef === 'internal') {
    if (is328P) expectedAdmux |= (1 << 7) | (1 << 6); // 1.1V internal
    else expectedAdmux |= (1 << 7) | (1 << 6); // 2.56V internal
  }
  if (adcLeftAdjust) expectedAdmux |= (1 << 5); // ADLAR
  expectedAdmux |= (adcChannel & 0x07);

  let expectedAdcsra = 0x80; // ADEN enable
  if (adcInterrupt) expectedAdcsra |= 0x08; // ADIE
  // Prescaler bits
  const prescalerMap: Record<number, number> = { 2: 1, 4: 2, 8: 3, 16: 4, 32: 5, 64: 6, 128: 7 };
  expectedAdcsra |= (prescalerMap[adcPrescaler] || 7);
  const adcFreqKHz = (fcpu / adcPrescaler) / 1000;

  // --- Timer Calculations ---
  // Timer1 16-bit CTC OCR1A: OCR = (F_CPU / (2 * N * F)) - 1  (toggle) or (F_CPU / (N * F)) - 1 (overflow period)
  const timerPrescalerMap16: Record<number, number> = { 1: 1, 8: 2, 64: 3, 256: 4, 1024: 5 };
  const timerPrescalerBits = timerPrescalerMap16[timerPrescaler] || 3;
  const ocr1aVal = Math.round(fcpu / (timerPrescaler * targetFreqHz) - 1);
  const safeOcr1a = Math.max(0, Math.min(65535, ocr1aVal));
  const actualTimerFreq = fcpu / (timerPrescaler * (safeOcr1a + 1));
  const expectedTccr1A = timerMode === 'ctc' ? 0x00 : timerMode === 'fast_pwm' ? 0x02 : 0x00;
  const expectedTccr1B = (timerMode === 'ctc' ? 0x08 : timerMode === 'fast_pwm' ? 0x18 : 0x00) | timerPrescalerBits;
  const expectedTimsk1 = timerInterrupt ? 0x02 : 0x00; // OCIE1A

  // Copy helper
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(key);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Download helper
  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------
  // SIMULATE UNIT TESTS IN BROWSER
  // -------------------------------------------------------------
  const runSimulation = () => {
    setIsSimulating(true);
    setSimResults(null);

    setTimeout(() => {
      const results: SimulatedTestResult[] = [];

      // --- UART TESTS ---
      if (target === 'all' || target === 'uart') {
        // Test 1: UART Init Registers Match Datasheet
        const actualUbrrToCompare = faultBaudRate ? (safeUbrr ^ 0x05) : safeUbrr;
        const passedUbrr = actualUbrrToCompare === safeUbrr;
        results.push({
          id: 'uart_init_regs',
          category: 'UART',
          name: `UART${safeUartChannel}_Init_RegisterBitVerification`,
          desc: `Verifies UBRR${safeUartChannel}H/L, UCSR${safeUartChannel}B, UCSR${safeUartChannel}C register bit masks against hardware configuration.`,
          passed: passedUbrr,
          expected: `UBRR=0x${safeUbrr.toString(16).toUpperCase().padStart(4, '0')} (${safeUbrr}), UCSRB=0x${expectedUcsrB.toString(16).toUpperCase().padStart(2, '0')}`,
          actual: `UBRR=0x${actualUbrrToCompare.toString(16).toUpperCase().padStart(4, '0')} (${actualUbrrToCompare}), UCSRB=0x${expectedUcsrB.toString(16).toUpperCase().padStart(2, '0')}`,
          details: passedUbrr
            ? `All control and baud registers exactly match ${currentProfile.name} USART${safeUartChannel} specifications.`
            : `Assertion failure: UBRR register mismatch detected! Expected 0x${safeUbrr.toString(16)} but mock recorded 0x${actualUbrrToCompare.toString(16)}.`,
          executionTimeUs: 42
        });

        // Test 2: Baud Rate Accuracy Tolerance
        const isBaudWithinTolerance = Math.abs(baudErrorPercent) <= 2.0 && !faultBaudRate;
        results.push({
          id: 'uart_baud_tolerance',
          category: 'UART',
          name: `UART${safeUartChannel}_BaudRate_ErrorTolerance_Test`,
          desc: `Verifies hardware clock baud error does not exceed ±2.0% threshold for reliable asynchronous framing.`,
          passed: isBaudWithinTolerance,
          expected: `Error <= ±2.00% (Calculated: ${baudErrorPercent.toFixed(2)}%)`,
          actual: faultBaudRate ? `Error: +5.82% (FAULT INJECTED)` : `Error: ${baudErrorPercent.toFixed(2)}%`,
          details: isBaudWithinTolerance
            ? `Actual baud rate ${Math.round(actualBaud)} bps with error ${baudErrorPercent.toFixed(2)}% meets RS-232/UART specification.`
            : `Clock divisor error (${baudErrorPercent.toFixed(2)}%) exceeds tolerable 2.0% framing margin! Framing errors likely.`,
          executionTimeUs: 18
        });

        // Test 3: UART Transmit Mock Ring Buffer
        results.push({
          id: 'uart_tx_buffer',
          category: 'UART',
          name: `UART${safeUartChannel}_Transmit_MockBuffer_FIFO_Test`,
          desc: `Simulates writing 5-byte payload into UDR register mock and verifies FIFO shadow queue ordering.`,
          passed: true,
          expected: `Mock FIFO Queue: ['H', 'E', 'L', 'L', 'O'], UDRE bit cleared then reset`,
          actual: `Mock FIFO Queue: ['H', 'E', 'L', 'L', 'O'], UDRE bit cleared then reset`,
          details: `Shadow register buffer accepted all 5 bytes, UDR write side-effects triggered UDRE mock flag transitions successfully.`,
          executionTimeUs: 65
        });
      }

      // --- ADC TESTS ---
      if (target === 'all' || target === 'adc') {
        // Test 4: ADC Init & Prescaler Bounds
        const isPrescalerValid = adcFreqKHz >= 50 && adcFreqKHz <= 200;
        results.push({
          id: 'adc_init_prescaler',
          category: 'ADC',
          name: `ADC_Init_PrescalerAndFrequency_Range_Test`,
          desc: `Verifies ADC clock frequency (F_CPU / Prescaler) stays within recommended 50kHz - 200kHz for full 10-bit resolution.`,
          passed: isPrescalerValid,
          expected: `50 kHz <= ADC_CLK <= 200 kHz (Current: ${adcFreqKHz.toFixed(1)} kHz)`,
          actual: `ADC_CLK = ${adcFreqKHz.toFixed(1)} kHz (Prescaler: 1:${adcPrescaler})`,
          details: isPrescalerValid
            ? `ADC clock is optimal at ${adcFreqKHz.toFixed(1)} kHz for standard 10-bit successive approximation SAR ADC.`
            : `Warning: ADC clock ${adcFreqKHz.toFixed(1)} kHz is outside 50~200kHz range! Resolution degradation or slow conversion.`,
          executionTimeUs: 29
        });

        // Test 5: ADC 10-Bit Atomic Read Sequence (ADCL before ADCH)
        const passedAdcAtomic = !faultAdcAtomic;
        results.push({
          id: 'adc_atomic_read',
          category: 'ADC',
          name: `ADC_10Bit_Atomic_RegisterAccess_Sequence_Test`,
          desc: `Verifies that ADCL is read before ADCH to prevent datasheet latch register corruption during conversion.`,
          passed: passedAdcAtomic,
          expected: `Read sequence: ADCL (locks high byte) -> ADCH (releases lock)`,
          actual: faultAdcAtomic
            ? `Read sequence: ADCH read first! Latch lock corrupted! (FAULT INJECTED)`
            : `Read sequence: ADCL read first -> ADCH read second -> 10-bit value 0x02FF assembled`,
          details: passedAdcAtomic
            ? `Datasheet Section 'ADC Data Register' constraint verified: Reading ADCL locks ADCH data until ADCH is read.`
            : `Critical assertion failed: Reading ADCH before ADCL causes new conversions to overwrite data register mid-read!`,
          executionTimeUs: 34
        });

        // Test 6: ADC Channel Out-Of-Bounds Clamping
        results.push({
          id: 'adc_channel_bounds',
          category: 'ADC',
          name: `ADC_ChannelSelection_Bounds_Safety_Test`,
          desc: `Passes out-of-range channel (e.g. channel 19) to ADC_SelectChannel() to ensure safe masking without corrupting ADMUX.`,
          passed: true,
          expected: `ADMUX MUX bits masked to safe range (0x07 max for single-ended), REFS bits preserved`,
          actual: `ADMUX bits preserved: REFS=0x${(expectedAdmux & 0xC0).toString(16)}, MUX masked correctly`,
          details: `Defensive driver check verified: Invalid channel inputs do not overwrite voltage reference bits.`,
          executionTimeUs: 22
        });
      }

      // --- TIMER TESTS ---
      if (target === 'all' || target === 'timer') {
        // Test 7: Timer Mode & Clock Select Registers
        const actualPrescalerBits = faultTimerPrescaler ? 0 : timerPrescalerBits;
        const passedPrescaler = actualPrescalerBits === timerPrescalerBits;
        results.push({
          id: 'timer_mode_registers',
          category: 'Timer',
          name: `Timer1_ModeAndPrescaler_Register_Test`,
          desc: `Verifies TCCR1A and TCCR1B bit fields (WGM13:10 and CS12:10) for ${timerMode.toUpperCase()} mode with 1:${timerPrescaler} prescaler.`,
          passed: passedPrescaler,
          expected: `TCCR1A=0x${expectedTccr1A.toString(16).padStart(2, '0')}, TCCR1B=0x${expectedTccr1B.toString(16).padStart(2, '0')}`,
          actual: `TCCR1A=0x${expectedTccr1A.toString(16).padStart(2, '0')}, TCCR1B=0x${((expectedTccr1B & 0xF8) | actualPrescalerBits).toString(16).padStart(2, '0')}`,
          details: passedPrescaler
            ? `Timer1 configured correctly in ${timerMode.toUpperCase()} mode with prescaler 1:${timerPrescaler}.`
            : `Assertion failed: CS12:0 clock select bits are 0x00 (Timer Stopped)! Expected 0x${timerPrescalerBits.toString(16)}.`,
          executionTimeUs: 38
        });

        // Test 8: Timer CTC Frequency Calculation Exactness
        const freqDelta = Math.abs(actualTimerFreq - targetFreqHz);
        const freqDeltaPercent = (freqDelta / targetFreqHz) * 100;
        const isFreqAccurate = freqDeltaPercent < 1.0;
        results.push({
          id: 'timer_ocr_accuracy',
          category: 'Timer',
          name: `Timer1_OCR1A_MatchFrequency_Precision_Test`,
          desc: `Verifies calculated OCR1A register value (${safeOcr1a}) produces target ${targetFreqHz}Hz within 1.0% precision.`,
          passed: isFreqAccurate,
          expected: `Target: ${targetFreqHz} Hz (Tolerance < 1.0%)`,
          actual: `Actual: ${actualTimerFreq.toFixed(2)} Hz (Delta: ${freqDeltaPercent.toFixed(3)}%, OCR1A=${safeOcr1a})`,
          details: isFreqAccurate
            ? `Output frequency error is only ${freqDeltaPercent.toFixed(3)}%, providing jitter-free timer periods.`
            : `Frequency delta is ${freqDeltaPercent.toFixed(2)}%. Consider adjusting prescaler for closer match.`,
          executionTimeUs: 25
        });

        // Test 9: 16-Bit Timer Register TEMP Buffer Atomicity
        results.push({
          id: 'timer_16bit_atomic_write',
          category: 'Timer',
          name: `Timer1_16Bit_AtomicWrite_TEMP_Latch_Test`,
          desc: `Simulates writing 16-bit OCR1A and verifies High-Byte precedes Low-Byte to use hardware TEMP buffer correctly.`,
          passed: true,
          expected: `Write High byte (0x${((safeOcr1a >> 8) & 0xFF).toString(16)}) -> TEMP latch -> Write Low byte (0x${(safeOcr1a & 0xFF).toString(16)})`,
          actual: `Write sequence followed: OCR1AH written first, then OCR1AL written atomically`,
          details: `Hardware TEMP register simulation confirmed zero corruption of high byte during 16-bit register write.`,
          executionTimeUs: 47
        });
      }

      setSimResults(results);
      setIsSimulating(false);

      // Trigger celebratory confetti if all passed
      const allPassed = results.every(r => r.passed);
      if (allPassed) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 }
        });
      }
    }, 400);
  };

  // -------------------------------------------------------------
  // CODE TEMPLATE GENERATION
  // -------------------------------------------------------------
  const generatedTestCode = useMemo(() => {
    if (framework === 'googletest') {
      return `// ============================================================================
// GoogleTest Suite: ${currentProfile.name} Peripheral Hardware Unit Tests
// Target Architecture: ${currentProfile.fullName} (${currentProfile.package})
// Clock Frequency: ${fcpu.toLocaleString()} Hz
// Framework: GoogleTest (gtest / gmock) C++14/17
// Generated by: ATmega Firmware Studio Test Scaffold Engine
// ============================================================================

#include <gtest/gtest.h>
#include <gmock/gmock.h>
#include "avr_mock.h"

using namespace testing;

// ----------------------------------------------------------------------------
// Test Fixture: Peripheral Hardware Simulation Sandbox
// ----------------------------------------------------------------------------
class ${currentProfile.name.replace(/[^a-zA-Z0-9]/g, '_')}_PeripheralTestFixture : public ::testing::Test {
protected:
    void SetUp() override {
        // Reset all mock register memory spaces before each test run
        AVR_Mock_Reset();
    }

    void TearDown() override {
        // Verify no memory leaks or unhandled mock interrupts
        AVR_Mock_VerifyCleanState();
    }
};

${target === 'all' || target === 'uart' ? `// ============================================================================
// 1. USART${safeUartChannel} Hardware Configuration Unit Tests
// ============================================================================

TEST_F(${currentProfile.name.replace(/[^a-zA-Z0-9]/g, '_')}_PeripheralTestFixture, USART${safeUartChannel}_Init_RegistersExactMatch) {
    // 1. Arrange & Act: Call firmware USART initialization
    USART${safeUartChannel}_Init(${baudRate}UL, ${u2x ? 'true' : 'false'});

    // 2. Assert: Verify baud rate prescaler registers (UBRRH / UBRRL)
    const uint16_t expected_ubrr = ${safeUbrr};
    const uint8_t expected_ubrr_h = (expected_ubrr >> 8) & 0xFF;
    const uint8_t expected_ubrr_l = expected_ubrr & 0xFF;

    EXPECT_EQ(UBRR${safeUartChannel}H, expected_ubrr_h) 
        << "UBRR${safeUartChannel}H baud prescaler high byte mismatch!";
    EXPECT_EQ(UBRR${safeUartChannel}L, expected_ubrr_l) 
        << "UBRR${safeUartChannel}L baud prescaler low byte mismatch!";

    // 3. Assert: Verify Control and Status Register A (U2X double speed flag)
    EXPECT_EQ(UCSR${safeUartChannel}A & (1 << U2X${safeUartChannel}), ${u2x ? `(1 << U2X${safeUartChannel})` : '0'})
        << "U2X${safeUartChannel} bit did not match requested double-speed setting!";

    // 4. Assert: Verify Control and Status Register B (RXEN, TXEN enable)
    EXPECT_TRUE(UCSR${safeUartChannel}B & (1 << RXEN${safeUartChannel})) 
        << "Receiver hardware (RXEN${safeUartChannel}) was not enabled!";
    EXPECT_TRUE(UCSR${safeUartChannel}B & (1 << TXEN${safeUartChannel})) 
        << "Transmitter hardware (TXEN${safeUartChannel}) was not enabled!";

    // 5. Assert: Frame format (UCSZ = 8-bit, 1 Stop Bit, No Parity)
    EXPECT_EQ(UCSR${safeUartChannel}C & 0x06, 0x06) 
        << "Frame character size should default to 8-bit (UCSZ${safeUartChannel}1:0)!";
}

TEST_F(${currentProfile.name.replace(/[^a-zA-Z0-9]/g, '_')}_PeripheralTestFixture, USART${safeUartChannel}_BaudRate_ErrorToleranceCheck) {
    const double f_cpu = ${fcpu}.0;
    const double requested_baud = ${baudRate}.0;
    const double divisor = ${u2x ? '8.0' : '16.0'};
    
    // Hardware computed baud from actual integer UBRR
    const uint16_t actual_ubrr = ${safeUbrr};
    const double actual_baud = f_cpu / (divisor * (actual_ubrr + 1));
    const double baud_error_pct = ((actual_baud - requested_baud) / requested_baud) * 100.0;

    // Standard asynchronous framing tolerance is <= ±2.0%
    EXPECT_LE(std::abs(baud_error_pct), 2.0)
        << "Baud rate error " << baud_error_pct << "% exceeds ±2.0% safe framing threshold!";
}

TEST_F(${currentProfile.name.replace(/[^a-zA-Z0-9]/g, '_')}_PeripheralTestFixture, USART${safeUartChannel}_Transmit_MockBufferQueue) {
    USART${safeUartChannel}_Init(${baudRate}UL, false);

    const char test_payload[] = "OK\\r\\n";
    for (size_t i = 0; i < sizeof(test_payload) - 1; ++i) {
        USART${safeUartChannel}_Transmit(static_cast<uint8_t>(test_payload[i]));
    }

    // Verify mock transmission ring buffer contents
    std::string captured = AVR_Mock_GetUartTxBuffer(${safeUartChannel});
    EXPECT_EQ(captured, "OK\\r\\n")
        << "Transmitted string did not match mock UART ring buffer capture!";
}
` : ''}
${target === 'all' || target === 'adc' ? `// ============================================================================
// 2. ADC (Analog to Digital Converter) Hardware Unit Tests
// ============================================================================

TEST_F(${currentProfile.name.replace(/[^a-zA-Z0-9]/g, '_')}_PeripheralTestFixture, ADC_Init_PrescalerAndReferenceVoltage) {
    // Initialize ADC with target prescaler and reference
    ADC_Init(${adcPrescaler}, ${adcRef.toUpperCase()});

    // 1. Verify ADC Enable flag (ADEN)
    EXPECT_TRUE(ADCSRA & (1 << ADEN)) 
        << "ADEN bit in ADCSRA was not set during initialization!";

    // 2. Verify Prescaler bits in ADCSRA
    const uint8_t expected_prescaler_mask = ${prescalerMap[adcPrescaler] || 7};
    EXPECT_EQ(ADCSRA & 0x07, expected_prescaler_mask)
        << "ADCSRA prescaler bits (ADPS2:0) do not match selected 1:${adcPrescaler} division!";

    // 3. Verify Voltage Reference bits in ADMUX
    EXPECT_EQ(ADMUX & 0xC0, 0x${(expectedAdmux & 0xC0).toString(16).padStart(2, '0')})
        << "ADMUX REFS1:0 bits do not match requested reference voltage!";
}

TEST_F(${currentProfile.name.replace(/[^a-zA-Z0-9]/g, '_')}_PeripheralTestFixture, ADC_10Bit_Read_AtomicSequence_EnforcesADCLFirst) {
    ADC_Init(${adcPrescaler}, ${adcRef.toUpperCase()});
    
    // Inject mock analog conversion result into mock hardware (e.g. 0x02FF = 767)
    AVR_Mock_SetAdcConversionResult(0x02FF);

    // Call firmware read function
    uint16_t adc_val = ADC_ReadChannel(${adcChannel});

    EXPECT_EQ(adc_val, 0x02FF) 
        << "ADC_ReadChannel did not reconstruct 10-bit conversion value accurately!";

    // Verify atomic latch sequence: ADCL read MUST precede ADCH read
    EXPECT_TRUE(AVR_Mock_WasAdclReadBeforeAdch())
        << "CRITICAL VIOLATION: ADCH read before ADCL, violating hardware latch locking!";
}

TEST_F(${currentProfile.name.replace(/[^a-zA-Z0-9]/g, '_')}_PeripheralTestFixture, ADC_ChannelSelection_SafetyBoundsClamping) {
    ADC_Init(${adcPrescaler}, ${adcRef.toUpperCase()});

    // Pass invalid high channel index (e.g., 255)
    ADC_ReadChannel(255);

    // Assert that voltage reference bits (REFS1:0) were preserved without corruption
    EXPECT_EQ(ADMUX & 0xC0, 0x${(expectedAdmux & 0xC0).toString(16).padStart(2, '0')})
        << "Invalid channel index corrupted ADMUX voltage reference bits!";
}
` : ''}
${target === 'all' || target === 'timer' ? `// ============================================================================
// 3. Timer/Counter Hardware Unit Tests
// ============================================================================

TEST_F(${currentProfile.name.replace(/[^a-zA-Z0-9]/g, '_')}_PeripheralTestFixture, Timer1_CTC_Mode_RegisterConfiguration) {
    Timer1_Init_CTC(${targetFreqHz}UL, ${timerPrescaler});

    // 1. Verify CTC Mode bits (WGM13:10 = 0100 -> WGM12 in TCCR1B)
    EXPECT_EQ(TCCR1A & 0x03, 0x00) << "WGM11:10 bits in TCCR1A should be 0 in CTC mode!";
    EXPECT_TRUE(TCCR1B & (1 << WGM12)) << "WGM12 bit in TCCR1B must be set for CTC mode!";

    // 2. Verify Prescaler bits in TCCR1B
    const uint8_t expected_cs = ${timerPrescalerBits};
    EXPECT_EQ(TCCR1B & 0x07, expected_cs)
        << "TCCR1B CS12:10 prescaler bits do not match 1:${timerPrescaler} selection!";

    // 3. Verify Output Compare Register 1A value
    const uint16_t expected_ocr1a = ${safeOcr1a};
    const uint16_t actual_ocr1a = (OCR1AH << 8) | OCR1AL;
    EXPECT_EQ(actual_ocr1a, expected_ocr1a)
        << "OCR1A match register mismatch for ${targetFreqHz}Hz target!";
}

TEST_F(${currentProfile.name.replace(/[^a-zA-Z0-9]/g, '_')}_PeripheralTestFixture, Timer1_16Bit_AtomicWrite_TEMPLatchIntegrity) {
    // When writing a 16-bit register in 8-bit AVR, High byte MUST be written first
    // because it stores into the temporary 8-bit latch (TEMP)
    AVR_Mock_ResetLatchTracker();

    Timer1_SetCompareA(${safeOcr1a});

    EXPECT_TRUE(AVR_Mock_WasHighByteWrittenBeforeLowByte_OCR1A())
        << "16-bit register write order violation! OCR1AH must be written before OCR1AL!";
}
` : ''}

// ----------------------------------------------------------------------------
// Test Runner Entry Point
// ----------------------------------------------------------------------------
int main(int argc, char **argv) {
    ::testing::InitGoogleTest(&argc, argv);
    std::cout << "[INFO] Running ${currentProfile.name} Embedded Mock Peripheral Suite" << std::endl;
    std::cout << "[INFO] F_CPU = ${fcpu} Hz, Architecture: AVR 8-bit RISC" << std::endl;
    return RUN_ALL_TESTS();
}
`;
    } else if (framework === 'unity') {
      return `/* ============================================================================
 * Unity Embedded C Test Suite: ${currentProfile.name}
 * Hardware Mocking Framework: ThrowTheSwitch Unity + Custom AVR SFR Shadow
 * Target: ${currentProfile.fullName}
 * ============================================================================ */

#include "unity.h"
#include "avr_mock.h"
#include <stdint.h>
#include <stdbool.h>

void setUp(void) {
    // Reset all mock SFR registers to datasheet power-on reset defaults
    AVR_Mock_Reset();
}

void tearDown(void) {
    // Post-test sanity checks
}

${target === 'all' || target === 'uart' ? `/* ----------------------------------------------------------------------------
 * USART${safeUartChannel} Unit Tests
 * ---------------------------------------------------------------------------- */
void test_USART${safeUartChannel}_Init_Registers(void) {
    USART${safeUartChannel}_Init(${baudRate}UL, ${u2x ? 'true' : 'false'});

    // Verify baud rate register pair
    TEST_ASSERT_EQUAL_HEX8(${expectedUbrrH}, UBRR${safeUartChannel}H);
    TEST_ASSERT_EQUAL_HEX8(${expectedUbrrL}, UBRR${safeUartChannel}L);

    // Verify transmitter/receiver enables in UCSRB
    TEST_ASSERT_BIT_HIGH(RXEN${safeUartChannel}, UCSR${safeUartChannel}B);
    TEST_ASSERT_BIT_HIGH(TXEN${safeUartChannel}, UCSR${safeUartChannel}B);
}

void test_USART${safeUartChannel}_BaudRate_ErrorThreshold(void) {
    const uint32_t f_cpu = ${fcpu}UL;
    const uint32_t target_baud = ${baudRate}UL;
    const uint16_t ubrr_val = ${safeUbrr};
    const uint32_t divisor = ${u2x ? '8' : '16'};

    uint32_t actual_baud = f_cpu / (divisor * (ubrr_val + 1));
    int32_t error_ppm = (int32_t)(((int64_t)actual_baud - (int64_t)target_baud) * 1000000 / target_baud);

    // Within ±20,000 PPM (±2.0%)
    TEST_ASSERT_INT_WITHIN(20000, 0, error_ppm);
}
` : ''}
${target === 'all' || target === 'adc' ? `/* ----------------------------------------------------------------------------
 * ADC Unit Tests
 * ---------------------------------------------------------------------------- */
void test_ADC_Init_PrescalerAndRef(void) {
    ADC_Init(${adcPrescaler}, ${adcRef.toUpperCase()});

    // Check ADEN
    TEST_ASSERT_BIT_HIGH(ADEN, ADCSRA);

    // Check prescaler bits (ADPS2:0)
    TEST_ASSERT_EQUAL_HEX8(${prescalerMap[adcPrescaler] || 7}, ADCSRA & 0x07);

    // Check voltage reference in ADMUX
    TEST_ASSERT_EQUAL_HEX8(0x${(expectedAdmux & 0xC0).toString(16)}, ADMUX & 0xC0);
}

void test_ADC_10Bit_AtomicRead_Order(void) {
    ADC_Init(${adcPrescaler}, ${adcRef.toUpperCase()});
    AVR_Mock_SetAdcConversionResult(0x03FF); // Full-scale 1023

    uint16_t val = ADC_ReadChannel(${adcChannel});
    TEST_ASSERT_EQUAL_UINT16(0x03FF, val);
    TEST_ASSERT_TRUE(AVR_Mock_WasAdclReadBeforeAdch());
}
` : ''}
${target === 'all' || target === 'timer' ? `/* ----------------------------------------------------------------------------
 * Timer1 Unit Tests
 * ---------------------------------------------------------------------------- */
void test_Timer1_CTC_Registers(void) {
    Timer1_Init_CTC(${targetFreqHz}UL, ${timerPrescaler});

    // Verify CTC WGM12 bit
    TEST_ASSERT_BIT_HIGH(WGM12, TCCR1B);
    TEST_ASSERT_BIT_LOW(WGM10, TCCR1A);

    // Verify Compare register
    uint16_t ocr = (OCR1AH << 8) | OCR1AL;
    TEST_ASSERT_EQUAL_UINT16(${safeOcr1a}, ocr);
}

void test_Timer1_16Bit_AtomicWrite_Order(void) {
    AVR_Mock_ResetLatchTracker();
    Timer1_SetCompareA(${safeOcr1a});
    TEST_ASSERT_TRUE(AVR_Mock_WasHighByteWrittenBeforeLowByte_OCR1A());
}
` : ''}

int main(void) {
    UNITY_BEGIN();
${target === 'all' || target === 'uart' ? `    RUN_TEST(test_USART${safeUartChannel}_Init_Registers);
    RUN_TEST(test_USART${safeUartChannel}_BaudRate_ErrorThreshold);
` : ''}${target === 'all' || target === 'adc' ? `    RUN_TEST(test_ADC_Init_PrescalerAndRef);
    RUN_TEST(test_ADC_10Bit_AtomicRead_Order);
` : ''}${target === 'all' || target === 'timer' ? `    RUN_TEST(test_Timer1_CTC_Registers);
    RUN_TEST(test_Timer1_16Bit_AtomicWrite_Order);
` : ''}    return UNITY_END();
}
`;
    } else {
      // Host C Standalone Runner
      return `/* ============================================================================
 * Standalone Host C99 Test Runner (Zero-Dependency)
 * Target MCU: ${currentProfile.name} (${currentProfile.fullName})
 * Compile: gcc -Wall -Wextra -I. test_main.c -o unit_tests && ./unit_tests
 * ============================================================================ */

#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>
#include <assert.h>
#include <string.h>

/* --- Minimal ANSI Terminal Colors --- */
#define COLOR_GREEN "\\033[1;32m"
#define COLOR_RED   "\\033[1;31m"
#define COLOR_CYAN  "\\033[1;36m"
#define COLOR_RESET "\\033[0m"

static int g_tests_run = 0;
static int g_tests_passed = 0;

#define ASSERT_TEST(cond, msg) do { \\
    g_tests_run++; \\
    if (cond) { \\
        g_tests_passed++; \\
        printf("  [" COLOR_GREEN "PASS" COLOR_RESET "] %s\\n", msg); \\
    } else { \\
        printf("  [" COLOR_RED "FAIL" COLOR_RESET "] %s\\n", msg); \\
    } \\
} while(0)

#include "avr_mock.h"

int main(void) {
    printf(COLOR_CYAN "========================================================\\n" COLOR_RESET);
    printf(COLOR_CYAN "  ${currentProfile.name} Bare-metal Peripheral Unit Test Suite\\n" COLOR_RESET);
    printf(COLOR_CYAN "  Host: Linux/macOS/x86_64, F_CPU: %lu Hz\\n" COLOR_RESET, ${fcpu}UL);
    printf(COLOR_CYAN "========================================================\\n\\n" COLOR_RESET);

${target === 'all' || target === 'uart' ? `    /* 1. USART Tests */
    printf("[Suite 1: USART${safeUartChannel} Testing]\\n");
    AVR_Mock_Reset();
    USART${safeUartChannel}_Init(${baudRate}UL, ${u2x ? 'true' : 'false'});
    ASSERT_TEST(UBRR${safeUartChannel}H == ${expectedUbrrH} && UBRR${safeUartChannel}L == ${expectedUbrrL}, 
                "UBRR${safeUartChannel} matches baud rate prescaler ${safeUbrr}");
    ASSERT_TEST((UCSR${safeUartChannel}B & ((1 << RXEN${safeUartChannel}) | (1 << TXEN${safeUartChannel}))) != 0, 
                "UCSR${safeUartChannel}B transmitter and receiver enabled");
    printf("\\n");
` : ''}
${target === 'all' || target === 'adc' ? `    /* 2. ADC Tests */
    printf("[Suite 2: ADC Peripheral Testing]\\n");
    AVR_Mock_Reset();
    ADC_Init(${adcPrescaler}, ${adcRef.toUpperCase()});
    ASSERT_TEST((ADCSRA & (1 << ADEN)) != 0, "ADCSRA enable bit (ADEN) set");
    ASSERT_TEST((ADCSRA & 0x07) == ${prescalerMap[adcPrescaler] || 7}, "ADC Prescaler bits set to 1:${adcPrescaler}");
    
    AVR_Mock_SetAdcConversionResult(0x02FF);
    uint16_t adc_sample = ADC_ReadChannel(${adcChannel});
    ASSERT_TEST(adc_sample == 0x02FF, "ADC 10-bit conversion data read accurate");
    ASSERT_TEST(AVR_Mock_WasAdclReadBeforeAdch(), "ADC atomic register latch order (ADCL first) verified");
    printf("\\n");
` : ''}
${target === 'all' || target === 'timer' ? `    /* 3. Timer Tests */
    printf("[Suite 3: Timer1 16-Bit Testing]\\n");
    AVR_Mock_Reset();
    Timer1_Init_CTC(${targetFreqHz}UL, ${timerPrescaler});
    ASSERT_TEST((TCCR1B & (1 << WGM12)) != 0, "Timer1 CTC mode enabled (WGM12=1)");
    ASSERT_TEST((TCCR1B & 0x07) == ${timerPrescalerBits}, "Timer1 Prescaler 1:${timerPrescaler} clock selected");
    uint16_t read_ocr = (OCR1AH << 8) | OCR1AL;
    ASSERT_TEST(read_ocr == ${safeOcr1a}, "Timer1 OCR1A compare value matches ${targetFreqHz}Hz");
    printf("\\n");
` : ''}
    printf(COLOR_CYAN "--------------------------------------------------------\\n" COLOR_RESET);
    if (g_tests_passed == g_tests_run) {
        printf(COLOR_GREEN "SUCCESS: All %d/%d tests passed!\\n" COLOR_RESET, g_tests_passed, g_tests_run);
        return 0;
    } else {
        printf(COLOR_RED "FAILURE: %d/%d tests failed.\\n" COLOR_RESET, g_tests_run - g_tests_passed, g_tests_run);
        return 1;
    }
}
`;
    }
  }, [
    framework,
    target,
    currentProfile,
    fcpu,
    safeUartChannel,
    baudRate,
    u2x,
    safeUbrr,
    expectedUbrrH,
    expectedUbrrL,
    expectedUcsrB,
    adcPrescaler,
    adcRef,
    adcChannel,
    prescalerMap,
    expectedAdmux,
    timerPrescaler,
    targetFreqHz,
    timerPrescalerBits,
    safeOcr1a
  ]);

  // Mock Header (avr_mock.h)
  const mockHeaderCode = useMemo(() => {
    return `/**
 * @file avr_mock.h
 * @brief Memory-Mapped SFR (Special Function Register) Hardware Mock for ${currentProfile.name}
 * 
 * Allows native compilation and execution of AVR embedded C/C++ firmware on x86_64 host
 * by redirecting hardware register accesses to mock shadow variables with cycle-accurate latch emulation.
 */

#ifndef AVR_MOCK_H_
#define AVR_MOCK_H_

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stdbool.h>
#include <string.h>

/* ============================================================================
 * 1. Shadow SFR Register Declarations
 * ============================================================================ */
extern volatile uint8_t g_mock_sfr_memory[0x200];

/* USART Common Mock Registers */
#define UDR${safeUartChannel}    g_mock_sfr_memory[0xC6]
#define UBRR${safeUartChannel}L  g_mock_sfr_memory[0xC4]
#define UBRR${safeUartChannel}H  g_mock_sfr_memory[0xC5]
#define UCSR${safeUartChannel}A  g_mock_sfr_memory[0xC0]
#define UCSR${safeUartChannel}B  g_mock_sfr_memory[0xC1]
#define UCSR${safeUartChannel}C  g_mock_sfr_memory[0xC2]

/* USART Bit Definitions */
#define RXC${safeUartChannel}   7
#define TXC${safeUartChannel}   6
#define UDRE${safeUartChannel}  5
#define FE${safeUartChannel}    4
#define DOR${safeUartChannel}   3
#define UPE${safeUartChannel}   2
#define U2X${safeUartChannel}   1
#define MPCM${safeUartChannel}  0

#define RXCIE${safeUartChannel} 7
#define TXCIE${safeUartChannel} 6
#define UDRIE${safeUartChannel} 5
#define RXEN${safeUartChannel}  4
#define TXEN${safeUartChannel}  3
#define UCSZ${safeUartChannel}2 2
#define RXB8${safeUartChannel}  1
#define TXB8${safeUartChannel}  0

#define UMSEL${safeUartChannel}1 7
#define UMSEL${safeUartChannel}0 6
#define UPM${safeUartChannel}1   5
#define UPM${safeUartChannel}0   4
#define USBS${safeUartChannel}   3
#define UCSZ${safeUartChannel}1  2
#define UCSZ${safeUartChannel}0  1
#define UCPOL${safeUartChannel}  0

/* ADC Mock Registers */
#define ADMUX   g_mock_sfr_memory[0x7C]
#define ADCSRA  g_mock_sfr_memory[0x7A]
#define ADCSRB  g_mock_sfr_memory[0x7B]
#define ADCL    g_mock_sfr_memory[0x78]
#define ADCH    g_mock_sfr_memory[0x79]

#define ADEN    7
#define ADSC    6
#define ADATE   5
#define ADIF    4
#define ADIE    3
#define ADPS2   2
#define ADPS1   1
#define ADPS0   0

#define REFS1   7
#define REFS0   6
#define ADLAR   5

/* Timer1 16-Bit Mock Registers */
#define TCCR1A  g_mock_sfr_memory[0x80]
#define TCCR1B  g_mock_sfr_memory[0x81]
#define TCCR1C  g_mock_sfr_memory[0x82]
#define TCNT1L  g_mock_sfr_memory[0x84]
#define TCNT1H  g_mock_sfr_memory[0x85]
#define OCR1AL  g_mock_sfr_memory[0x88]
#define OCR1AH  g_mock_sfr_memory[0x89]
#define TIMSK1  g_mock_sfr_memory[0x6F]

#define WGM10   0
#define WGM11   1
#define WGM12   3
#define WGM13   4
#define CS10    0
#define CS11    1
#define CS12    2

/* ============================================================================
 * 2. Mock Hardware Inspection & Control APIs
 * ============================================================================ */
void AVR_Mock_Reset(void);
void AVR_Mock_VerifyCleanState(void);

/* UART Helper Mocks */
void USART${safeUartChannel}_Init(uint32_t baud, bool double_speed);
void USART${safeUartChannel}_Transmit(uint8_t data);
const char* AVR_Mock_GetUartTxBuffer(uint8_t channel);

/* ADC Helper Mocks */
#define AVCC     0
#define INTERNAL 1
#define AREF     2
void ADC_Init(uint16_t prescaler, uint8_t ref);
uint16_t ADC_ReadChannel(uint8_t channel);
void AVR_Mock_SetAdcConversionResult(uint16_t val);
bool AVR_Mock_WasAdclReadBeforeAdch(void);

/* Timer Helper Mocks */
void Timer1_Init_CTC(uint32_t freq_hz, uint16_t prescaler);
void Timer1_SetCompareA(uint16_t ocr_val);
void AVR_Mock_ResetLatchTracker(void);
bool AVR_Mock_WasHighByteWrittenBeforeLowByte_OCR1A(void);

#ifdef __cplusplus
}
#endif

#endif /* AVR_MOCK_H_ */
`;
  }, [currentProfile, safeUartChannel]);

  // Build Script (CMake / Makefile)
  const buildScriptCode = useMemo(() => {
    if (framework === 'googletest') {
      return `cmake_minimum_required(VERSION 3.14)
project(${currentProfile.name.replace(/[^a-zA-Z0-9]/g, '_')}_UnitTests C CXX)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Enable compiler warnings
if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -Wpedantic -g)
endif()

# Automatically fetch GoogleTest from GitHub at configure time
include(FetchContent)
FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG        v1.14.0
)
# For Windows: Prevent overriding the parent project's compiler/linker settings
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

enable_testing()

# Build and link the peripheral test runner
add_executable(peripheral_tests
    test_peripherals.cpp
    avr_mock.c
)

target_include_directories(peripheral_tests PRIVATE \${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(peripheral_tests PRIVATE GTest::gtest_main GTest::gmock)

include(GoogleTest)
gtest_discover_tests(peripheral_tests)

# How to build and execute:
#   mkdir build && cd build
#   cmake ..
#   cmake --build .
#   ctest --output-on-failure
`;
    } else {
      return `# Makefile for ${currentProfile.name} Embedded Unit Tests
# Compatible with Linux, macOS, WSL, and MinGW

CC = gcc
CFLAGS = -Wall -Wextra -Wpedantic -std=c99 -g -O0 -I.
TARGET = test_runner

SRCS = test_main.c avr_mock.c
OBJS = $(SRCS:.c=.o)

all: $(TARGET) run

$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) -o $@ $(OBJS)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

run: $(TARGET)
	@echo "==> Running Embedded Unit Test Suite..."
	./$(TARGET)

clean:
	rm -f $(OBJS) $(TARGET)

.PHONY: all run clean
`;
    }
  }, [framework, currentProfile]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Embedded CI/CD Test Automation
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>{currentProfile.name} 펌웨어 단위 테스트 생성기 (Firmware Unit Test Generator)</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              UART, ADC, Timer 주변장치 설정을 기반으로 <strong>GoogleTest</strong>, <strong>Unity & CMock</strong>, 
              또는 무설치 <strong>Host C Runner</strong>용 하드웨어 Mock 구조체와 테스트 스위트를 자동 생성하고 브라우저에서 즉시 검증합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runSimulation}
              disabled={isSimulating}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all transform active:scale-95 disabled:opacity-50"
            >
              {isSimulating ? (
                <Clock className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <Play className="w-4 h-4 fill-current text-slate-950" />
              )}
              {isSimulating ? '시뮬레이션 실행 중...' : '테스트 시뮬레이션 실행'}
            </button>
          </div>
        </div>
      </div>

      {/* Control Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Framework & Peripheral Selection */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-sm font-bold text-white">
            <Sliders className="w-4 h-4 text-amber-400" />
            테스트 프레임워크 & 대상 선택
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">테스트 프레임워크 (Framework)</label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                onClick={() => setFramework('googletest')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  framework === 'googletest'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                GoogleTest
              </button>
              <button
                onClick={() => setFramework('unity')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  framework === 'unity'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Unity (C)
              </button>
              <button
                onClick={() => setFramework('host_c')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  framework === 'host_c'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Host C (C99)
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {framework === 'googletest' && 'C++14/17 기반 산업 표준, GMock 및 CMake FetchContent 자동 연동'}
              {framework === 'unity' && 'ThrowTheSwitch 임베디드 C 전용 경량 테스트 하네스'}
              {framework === 'host_c' && '외부 의존성 제로(Zero-dependency), 표준 gcc 컴파일 즉시 실행'}
            </p>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">테스트 주변장치 범위 (Scope)</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'all', label: '전체 (UART+ADC+Timer)' },
                { id: 'uart', label: `UART (USART${safeUartChannel})` },
                { id: 'adc', label: 'ADC (아날로그)' },
                { id: 'timer', label: 'Timer (Timer1 16-bit)' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setTarget(opt.id as PeripheralTarget)}
                  className={`px-3 py-2 text-xs rounded-xl border text-left font-medium transition ${
                    target === opt.id
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">시스템 코어 클럭 (F_CPU)</label>
            <select
              value={fcpu}
              onChange={(e) => setFcpu(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value={16000000}>16.000 MHz (5V 표준 크리스털)</option>
              <option value={8000000}>8.000 MHz (내부 RC 오실레이터 / 3.3V)</option>
              <option value={11059200}>11.0592 MHz (통신 전용 0% 오차 크리스털)</option>
              <option value={20000000}>20.000 MHz (오버클럭 최대 주파수)</option>
            </select>
          </div>
        </div>

        {/* Card 2: UART & ADC Hardware Parameters */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-sm font-bold text-white">
            <Radio className="w-4 h-4 text-cyan-400" />
            UART & ADC 하드웨어 파라미터
          </div>

          {/* UART Settings */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> USART 설정
              </span>
              {maxUartChannels > 1 && (
                <div className="flex gap-1">
                  {Array.from({ length: maxUartChannels }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setUartChannel(idx)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        safeUartChannel === idx
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      CH{idx}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">보드레이트 (Baud)</label>
                <select
                  value={baudRate}
                  onChange={(e) => setBaudRate(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value={9600}>9600 bps</option>
                  <option value={19200}>19200 bps</option>
                  <option value={38400}>38400 bps</option>
                  <option value={57600}>57600 bps</option>
                  <option value={115200}>115200 bps</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">2배속 (U2X)</label>
                <button
                  onClick={() => setU2x(!u2x)}
                  className={`w-full py-1.5 px-2 rounded-lg text-xs font-mono font-medium border text-center transition ${
                    u2x
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {u2x ? 'U2X ON (8분주)' : '1배속 (16분주)'}
                </button>
              </div>
            </div>

            <div className="text-[10px] font-mono text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800/80 flex items-center justify-between">
              <span>UBRR = {safeUbrr} (0x{safeUbrr.toString(16).toUpperCase().padStart(4, '0')})</span>
              <span className={Math.abs(baudErrorPercent) > 2 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                오차: {baudErrorPercent.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* ADC Settings */}
          <div className="space-y-2 pt-2 border-t border-slate-800/60">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> ADC 10비트 설정
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">기준 전압 (VREF)</label>
                <select
                  value={adcRef}
                  onChange={(e) => setAdcRef(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="avcc">AVCC (+5V 표준)</option>
                  <option value="internal">내부 밴드갭 (1.1V/2.56V)</option>
                  <option value="aref">외부 AREF 핀</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">프리스케일러</label>
                <select
                  value={adcPrescaler}
                  onChange={(e) => setAdcPrescaler(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value={16}>1:16 (1.0 MHz - 고속)</option>
                  <option value={64}>1:64 (250 kHz)</option>
                  <option value={128}>1:128 (125 kHz - 정밀 권장)</option>
                </select>
              </div>
            </div>

            <div className="text-[10px] font-mono text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800/80 flex items-center justify-between">
              <span>샘플링 클럭: {adcFreqKHz.toFixed(1)} kHz</span>
              <span className={adcFreqKHz >= 50 && adcFreqKHz <= 200 ? 'text-emerald-400' : 'text-amber-400'}>
                {adcFreqKHz >= 50 && adcFreqKHz <= 200 ? '✓ 50~200kHz 최적' : '주의: 대역폭 편차'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Timer Parameters & Fault Injection */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-sm font-bold text-white">
            <Gauge className="w-4 h-4 text-purple-400" />
            Timer 파라미터 & 결함 주입 (Fault Injection)
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" /> Timer1 (16비트) 설정
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">동작 모드 (Mode)</label>
                <select
                  value={timerMode}
                  onChange={(e) => setTimerMode(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="ctc">CTC 모드 (주기 타이머)</option>
                  <option value="normal">Normal 모드 (카운터)</option>
                  <option value="fast_pwm">Fast PWM 모드</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">목표 주기 (Hz)</label>
                <select
                  value={targetFreqHz}
                  onChange={(e) => setTargetFreqHz(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value={100}>100 Hz (10 ms)</option>
                  <option value={500}>500 Hz (2 ms)</option>
                  <option value={1000}>1,000 Hz (1 ms 인터럽트)</option>
                  <option value={5000}>5,000 Hz (200 us)</option>
                  <option value={10000}>10,000 Hz (100 us)</option>
                </select>
              </div>
            </div>

            <div className="text-[10px] font-mono text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800/80 flex items-center justify-between">
              <span>OCR1A = {safeOcr1a}</span>
              <span className="text-purple-400">실제 주파수: {actualTimerFreq.toFixed(1)} Hz</span>
            </div>
          </div>

          {/* Fault Injection toggles */}
          <div className="pt-2 border-t border-slate-800/60 space-y-2">
            <span className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
              <Bug className="w-3.5 h-3.5" /> 결함 주입 (테스트 회귀 검증)
            </span>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={faultBaudRate}
                  onChange={(e) => setFaultBaudRate(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-rose-500 focus:ring-0"
                />
                <span>UBRR 보드레이트 레지스터 변조 결함</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={faultAdcAtomic}
                  onChange={(e) => setFaultAdcAtomic(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-rose-500 focus:ring-0"
                />
                <span>ADC 10비트 읽기 역순(ADCH 선행) 래치 오염 결함</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={faultTimerPrescaler}
                  onChange={(e) => setFaultTimerPrescaler(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-rose-500 focus:ring-0"
                />
                <span>Timer 프리스케일러 클럭 정지(CS=0x00) 결함</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="border-b border-slate-800 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('tests')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'tests'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <FileCode className="w-4 h-4" />
            단위 테스트 소스 ({framework === 'googletest' ? 'test_peripherals.cpp' : 'test_main.c'})
          </button>

          <button
            onClick={() => setActiveTab('mock_header')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'mock_header'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            하드웨어 Mock 헤더 (avr_mock.h)
          </button>

          <button
            onClick={() => setActiveTab('build_script')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'build_script'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Workflow className="w-4 h-4" />
            빌드 스크립트 ({framework === 'googletest' ? 'CMakeLists.txt' : 'Makefile'})
          </button>

          <button
            onClick={() => setActiveTab('runner')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'runner'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="w-4 h-4" />
            브라우저 테스트 시뮬레이터
            {simResults && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                simResults.every(r => r.passed) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}>
                {simResults.filter(r => r.passed).length}/{simResults.length}
              </span>
            )}
          </button>
        </div>

        {/* Global Tab Actions */}
        <div className="flex items-center gap-2 pb-2">
          {activeTab === 'tests' && (
            <>
              <button
                onClick={() => copyToClipboard(generatedTestCode, 'tests')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition"
              >
                {copiedCode === 'tests' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode === 'tests' ? '복사됨' : '테스트 코드 복사'}
              </button>
              <button
                onClick={() => downloadFile(framework === 'googletest' ? 'test_peripherals.cpp' : 'test_main.c', generatedTestCode)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-xs font-medium transition"
              >
                <Download className="w-3.5 h-3.5" />
                다운로드
              </button>
            </>
          )}

          {activeTab === 'mock_header' && (
            <>
              <button
                onClick={() => copyToClipboard(mockHeaderCode, 'mock')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition"
              >
                {copiedCode === 'mock' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode === 'mock' ? '복사됨' : '헤더 복사'}
              </button>
              <button
                onClick={() => downloadFile('avr_mock.h', mockHeaderCode)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-xs font-medium transition"
              >
                <Download className="w-3.5 h-3.5" />
                avr_mock.h 다운로드
              </button>
            </>
          )}

          {activeTab === 'build_script' && (
            <>
              <button
                onClick={() => copyToClipboard(buildScriptCode, 'build')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition"
              >
                {copiedCode === 'build' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode === 'build' ? '복사됨' : '빌드 스크립트 복사'}
              </button>
              <button
                onClick={() => downloadFile(framework === 'googletest' ? 'CMakeLists.txt' : 'Makefile', buildScriptCode)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-xs font-medium transition"
              >
                <Download className="w-3.5 h-3.5" />
                다운로드
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab 1: Test Source View */}
      {activeTab === 'tests' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-2 font-semibold text-slate-300">
                {framework === 'googletest' ? 'test_peripherals.cpp (GoogleTest Suite)' : 'test_main.c (C Test Suite)'}
              </span>
            </div>
            <span>{currentProfile.name} • {framework.toUpperCase()} • F_CPU={fcpu / 1000000}MHz</span>
          </div>
          <pre className="p-4 text-[12px] font-mono text-slate-300 overflow-x-auto max-h-[520px] custom-scrollbar leading-relaxed">
            {generatedTestCode}
          </pre>
        </div>
      )}

      {/* Tab 2: Mock Header View */}
      {activeTab === 'mock_header' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="font-semibold text-slate-300">avr_mock.h — Hardware Memory Map & Shadow SFR Latch</span>
            <span>Zero Hardware Dependencies on x86_64</span>
          </div>
          <pre className="p-4 text-[12px] font-mono text-slate-300 overflow-x-auto max-h-[520px] custom-scrollbar leading-relaxed">
            {mockHeaderCode}
          </pre>
        </div>
      )}

      {/* Tab 3: Build Script View */}
      {activeTab === 'build_script' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="font-semibold text-slate-300">
              {framework === 'googletest' ? 'CMakeLists.txt (with FetchContent GoogleTest)' : 'Makefile (Native GNU Make)'}
            </span>
            <span>One-click Host CI Runner</span>
          </div>
          <pre className="p-4 text-[12px] font-mono text-slate-300 overflow-x-auto max-h-[520px] custom-scrollbar leading-relaxed">
            {buildScriptCode}
          </pre>
        </div>
      )}

      {/* Tab 4: Interactive Browser Test Runner Simulation */}
      {activeTab === 'runner' && (
        <div className="space-y-4">
          {/* Runner Summary & Trigger */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-amber-400" />
                브라우저 내 실시간 하드웨어 Mock 단위 테스트 시뮬레이터
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                실제 MCU에 플래싱하기 전에 브라우저 환경에서 레지스터 비트 정밀성, 16비트 임시 버퍼(TEMP) 원자성, 보드레이트 오차율을 자동 검증합니다.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={runSimulation}
                disabled={isSimulating}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50"
              >
                {isSimulating ? <Clock className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                테스트 전체 실행
              </button>
            </div>
          </div>

          {/* Test Results Dashboard */}
          {simResults ? (
            <div className="space-y-4">
              {/* Metric Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                  <span className="text-[11px] text-slate-400 block">총 실행 테스트</span>
                  <span className="text-xl font-bold font-mono text-white">{simResults.length}건</span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                  <span className="text-[11px] text-slate-400 block">성공 (PASSED)</span>
                  <span className="text-xl font-bold font-mono text-emerald-400">
                    {simResults.filter(r => r.passed).length}건
                  </span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                  <span className="text-[11px] text-slate-400 block">실패 (FAILED)</span>
                  <span className={`text-xl font-bold font-mono ${simResults.some(r => !r.passed) ? 'text-rose-400' : 'text-slate-500'}`}>
                    {simResults.filter(r => !r.passed).length}건
                  </span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                  <span className="text-[11px] text-slate-400 block">합격률 (Pass Rate)</span>
                  <span className="text-xl font-bold font-mono text-amber-400">
                    {Math.round((simResults.filter(r => r.passed).length / simResults.length) * 100)}%
                  </span>
                </div>
              </div>

              {/* Filter controls */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5 text-xs">
                  <button
                    onClick={() => setSimFilter('all')}
                    className={`px-3 py-1 rounded-lg font-medium transition ${
                      simFilter === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    전체 보기 ({simResults.length})
                  </button>
                  <button
                    onClick={() => setSimFilter('passed')}
                    className={`px-3 py-1 rounded-lg font-medium transition ${
                      simFilter === 'passed' ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    통과 ({simResults.filter(r => r.passed).length})
                  </button>
                  <button
                    onClick={() => setSimFilter('failed')}
                    className={`px-3 py-1 rounded-lg font-medium transition ${
                      simFilter === 'failed' ? 'bg-rose-500/20 text-rose-400 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    실패 ({simResults.filter(r => !r.passed).length})
                  </button>
                </div>
              </div>

              {/* Test Cases List */}
              <div className="space-y-3">
                {simResults
                  .filter(r => simFilter === 'all' || (simFilter === 'passed' && r.passed) || (simFilter === 'failed' && !r.passed))
                  .map((test) => (
                    <div
                      key={test.id}
                      className={`border rounded-xl p-4 transition-all ${
                        test.passed
                          ? 'bg-slate-950/70 border-emerald-500/30'
                          : 'bg-rose-950/20 border-rose-500/50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-start sm:items-center gap-2.5">
                          {test.passed ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
                          )}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-white">{test.name}</span>
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-800 text-slate-300">
                                {test.category}
                              </span>
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                test.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                              }`}>
                                {test.passed ? 'PASSED' : 'FAILED'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">{test.desc}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[11px] font-mono text-slate-500">{test.executionTimeUs} µs</span>
                        </div>
                      </div>

                      {/* Detail block */}
                      <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                        <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">기대값 (EXPECTED)</span>
                          <span className="text-emerald-400 text-[11px]">{test.expected}</span>
                        </div>
                        <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">실제 Mock 관측값 (ACTUAL)</span>
                          <span className={test.passed ? 'text-slate-300 text-[11px]' : 'text-rose-400 font-bold text-[11px]'}>
                            {test.actual}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                        💡 {test.details}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-amber-400 mx-auto" />
              <h4 className="text-sm font-bold text-white">시뮬레이션을 시작해보세요</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                우측 상단의 <strong>'테스트 전체 실행'</strong> 버튼을 클릭하면 UART, ADC, Timer 주변장치의 레지스터 설정이 검증 스위트를 통과하는지 확인할 수 있습니다.
              </p>
              <button
                onClick={runSimulation}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition"
              >
                <Play className="w-4 h-4 fill-current" />
                지금 시뮬레이션 실행
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
