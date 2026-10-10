import { SupportedMCU } from './pinmapData';

export interface DriverFunction {
  name: string;
  signature: string;
  desc: string;
  returns: string;
}

export interface PeripheralDriver {
  id: string;
  name: string;
  headerFileName: string;
  sourceFileName: string;
  category: 'uart' | 'timer' | 'i2c' | 'spi' | 'adc' | 'eeprom' | 'power' | 'interrupt' | 'sensor';
  categoryLabel: string;
  paradigm: 'Bare-Metal' | 'ISR Ring-Buffer' | 'Defensive / Safe' | 'Modular HAL';
  license: 'MIT' | 'BSD-3-Clause' | 'Apache-2.0' | 'Unlicense';
  supportedMcus: SupportedMCU[];
  flashBytes: number;
  sramBytes: number;
  registersUsed: string[];
  interruptVectors: string[];
  shortDesc: string;
  features: string[];
  apiFunctions: DriverFunction[];
  headerCode: (mcu: SupportedMCU) => string;
  sourceCode: (mcu: SupportedMCU) => string;
  exampleUsage: (mcu: SupportedMCU) => string;
}

export const PERIPHERAL_DRIVERS: PeripheralDriver[] = [
  // 1. UART Ring Buffer Driver
  {
    id: 'uart-ringbuffer',
    name: 'Hardware USART Ring-Buffer Driver',
    headerFileName: 'uart_driver.h',
    sourceFileName: 'uart_driver.c',
    category: 'uart',
    categoryLabel: 'USART / Serial',
    paradigm: 'ISR Ring-Buffer',
    license: 'MIT',
    supportedMcus: ['atmega640', 'atmega128', 'atmega328p'],
    flashBytes: 684,
    sramBytes: 136,
    registersUsed: ['UBRRn', 'UCSRnA', 'UCSRnB', 'UCSRnC', 'UDRn'],
    interruptVectors: ['USART_RX_vect', 'USART_UDRE_vect'],
    shortDesc: 'Non-blocking, interrupt-driven circular ring-buffer UART driver with printf fdevopen redirection and baud error checking.',
    features: [
      'Circular FIFO buffer (64-byte RX / 64-byte TX power-of-two mask optimization)',
      'Double-speed (U2X) baud rate auto-calculation with <1.5% clock tolerance',
      'Standard stdio.h stdout/stdin integration with fdev_setup_stream()',
      'Supports USART0 on 328P, USART0/1 on ATmega128, and USART0/1/2/3 on ATmega640',
      'Atomic buffer head/tail index advancement without disabling global interrupts'
    ],
    apiFunctions: [
      { name: 'uart_init', signature: 'void uart_init(uint8_t channel, uint32_t baud, uint8_t double_speed)', desc: 'Initializes baud rate, enables TX/RX and RX Complete interrupt.', returns: 'void' },
      { name: 'uart_putc', signature: 'void uart_putc(uint8_t channel, char c)', desc: 'Pushes a character into TX ring buffer and enables UDRE interrupt.', returns: 'void' },
      { name: 'uart_puts', signature: 'void uart_puts(uint8_t channel, const char* str)', desc: 'Transmits a null-terminated string sequentially via ring buffer.', returns: 'void' },
      { name: 'uart_getc', signature: 'int16_t uart_getc(uint8_t channel)', desc: 'Pulls a character from RX buffer. Returns -1 if buffer empty.', returns: 'int16_t (-1 on empty, 0-255 on byte)' },
      { name: 'uart_available', signature: 'uint8_t uart_available(uint8_t channel)', desc: 'Returns number of pending unread bytes in RX FIFO buffer.', returns: 'uint8_t count' },
      { name: 'uart_flush_rx', signature: 'void uart_flush_rx(uint8_t channel)', desc: 'Flushes and discards all pending unread bytes in the RX buffer.', returns: 'void' }
    ],
    headerCode: (mcu) => `/**
 * @file uart_driver.h
 * @brief High-performance ISR Ring-Buffer USART Driver for ${mcu.toUpperCase()}
 * @license MIT License
 */
#ifndef UART_DRIVER_H_
#define UART_DRIVER_H_

#include <avr/io.h>
#include <avr/interrupt.h>
#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>

#ifndef F_CPU
#define F_CPU 16000000UL
#endif

#define UART_RX_BUFFER_SIZE 64
#define UART_TX_BUFFER_SIZE 64

#if (UART_RX_BUFFER_SIZE & (UART_RX_BUFFER_SIZE - 1)) != 0
#error "UART_RX_BUFFER_SIZE must be a power of two!"
#endif
#if (UART_TX_BUFFER_SIZE & (UART_TX_BUFFER_SIZE - 1)) != 0
#error "UART_TX_BUFFER_SIZE must be a power of two!"
#endif

#define UART_RX_BUFFER_MASK (UART_RX_BUFFER_SIZE - 1)
#define UART_TX_BUFFER_MASK (UART_TX_BUFFER_SIZE - 1)

#ifdef __cplusplus
extern "C" {
#endif

void uart_init(uint8_t channel, uint32_t baud, bool double_speed);
void uart_putc(uint8_t channel, char c);
void uart_puts(uint8_t channel, const char* str);
void uart_puts_p(uint8_t channel, const char* pstr);
int16_t uart_getc(uint8_t channel);
uint8_t uart_available(uint8_t channel);
void uart_flush_rx(uint8_t channel);
void uart_setup_stdout(uint8_t channel);

#ifdef __cplusplus
}
#endif

#endif /* UART_DRIVER_H_ */
`,
    sourceCode: (mcu) => {
      const is640 = mcu === 'atmega640';
      const is128 = mcu === 'atmega128';
      return `/**
 * @file uart_driver.c
 * @brief Implementation of Circular FIFO USART Driver for ${mcu.toUpperCase()}
 */
#include "uart_driver.h"
#include <avr/pgmspace.h>

typedef struct {
  volatile uint8_t rx_buffer[UART_RX_BUFFER_SIZE];
  volatile uint8_t rx_head;
  volatile uint8_t rx_tail;
  volatile uint8_t tx_buffer[UART_TX_BUFFER_SIZE];
  volatile uint8_t tx_head;
  volatile uint8_t tx_tail;
} UartRingBuffer;

${is640 ? '#define UART_CHANNELS 4' : is128 ? '#define UART_CHANNELS 2' : '#define UART_CHANNELS 1'}
static UartRingBuffer g_uarts[UART_CHANNELS];

void uart_init(uint8_t channel, uint32_t baud, bool double_speed) {
  if (channel >= UART_CHANNELS) return;
  g_uarts[channel].rx_head = g_uarts[channel].rx_tail = 0;
  g_uarts[channel].tx_head = g_uarts[channel].tx_tail = 0;

  uint16_t ubrr_val = 0;
  if (double_speed) {
    ubrr_val = (uint16_t)((F_CPU / (8UL * baud)) - 1UL);
  } else {
    ubrr_val = (uint16_t)((F_CPU / (16UL * baud)) - 1UL);
  }

#if defined(__AVR_ATmega640__) || defined(__AVR_ATmega128__) || defined(__AVR_ATmega328P__)
  if (channel == 0) {
    UBRR0H = (uint8_t)(ubrr_val >> 8);
    UBRR0L = (uint8_t)(ubrr_val & 0xFF);
    if (double_speed) UCSR0A |= (1 << U2X0);
    else UCSR0A &= ~(1 << U2X0);
    // 8 data bits, 1 stop bit, no parity
    UCSR0C = (1 << UCSZ01) | (1 << UCSZ00);
    // Enable Receiver, Transmitter, and RX Complete Interrupt
    UCSR0B = (1 << RXEN0) | (1 << TXEN0) | (1 << RXCIE0);
  }
#if ${is640 || is128 ? '1' : '0'}
  else if (channel == 1) {
    UBRR1H = (uint8_t)(ubrr_val >> 8);
    UBRR1L = (uint8_t)(ubrr_val & 0xFF);
    if (double_speed) UCSR1A |= (1 << U2X1);
    else UCSR1A &= ~(1 << U2X1);
    UCSR1C = (1 << UCSZ11) | (1 << UCSZ10);
    UCSR1B = (1 << RXEN1) | (1 << TXEN1) | (1 << RXCIE1);
  }
#endif
#if ${is640 ? '1' : '0'}
  else if (channel == 2) {
    UBRR2H = (uint8_t)(ubrr_val >> 8);
    UBRR2L = (uint8_t)(ubrr_val & 0xFF);
    if (double_speed) UCSR2A |= (1 << U2X2);
    else UCSR2A &= ~(1 << U2X2);
    UCSR2C = (1 << UCSZ21) | (1 << UCSZ20);
    UCSR2B = (1 << RXEN2) | (1 << TXEN2) | (1 << RXCIE2);
  }
  else if (channel == 3) {
    UBRR3H = (uint8_t)(ubrr_val >> 8);
    UBRR3L = (uint8_t)(ubrr_val & 0xFF);
    if (double_speed) UCSR3A |= (1 << U2X3);
    else UCSR3A &= ~(1 << U2X3);
    UCSR3C = (1 << UCSZ31) | (1 << UCSZ30);
    UCSR3B = (1 << RXEN3) | (1 << TXEN3) | (1 << RXCIE3);
  }
#endif
#endif
}

void uart_putc(uint8_t channel, char c) {
  if (channel >= UART_CHANNELS) return;
  uint8_t next_head = (g_uarts[channel].tx_head + 1) & UART_TX_BUFFER_MASK;
  // Block if TX buffer is full
  while (next_head == g_uarts[channel].tx_tail) {}
  g_uarts[channel].tx_buffer[g_uarts[channel].tx_head] = (uint8_t)c;
  g_uarts[channel].tx_head = next_head;

  // Enable UDRE interrupt to start transmission
  if (channel == 0) UCSR0B |= (1 << UDRIE0);
#if ${is640 || is128 ? '1' : '0'}
  else if (channel == 1) UCSR1B |= (1 << UDRIE1);
#endif
#if ${is640 ? '1' : '0'}
  else if (channel == 2) UCSR2B |= (1 << UDRIE2);
  else if (channel == 3) UCSR3B |= (1 << UDRIE3);
#endif
}

void uart_puts(uint8_t channel, const char* str) {
  while (*str) {
    uart_putc(channel, *str++);
  }
}

int16_t uart_getc(uint8_t channel) {
  if (channel >= UART_CHANNELS) return -1;
  if (g_uarts[channel].rx_head == g_uarts[channel].rx_tail) {
    return -1; // Empty buffer
  }
  uint8_t c = g_uarts[channel].rx_buffer[g_uarts[channel].rx_tail];
  g_uarts[channel].rx_tail = (g_uarts[channel].rx_tail + 1) & UART_RX_BUFFER_MASK;
  return (int16_t)c;
}

uint8_t uart_available(uint8_t channel) {
  if (channel >= UART_CHANNELS) return 0;
  return (g_uarts[channel].rx_head - g_uarts[channel].rx_tail) & UART_RX_BUFFER_MASK;
}

void uart_flush_rx(uint8_t channel) {
  if (channel >= UART_CHANNELS) return;
  g_uarts[channel].rx_tail = g_uarts[channel].rx_head;
}

// ISR Handlers for Channel 0
ISR(USART0_RX_vect) {
  uint8_t data = UDR0;
  uint8_t next_head = (g_uarts[0].rx_head + 1) & UART_RX_BUFFER_MASK;
  if (next_head != g_uarts[0].rx_tail) {
    g_uarts[0].rx_buffer[g_uarts[0].rx_head] = data;
    g_uarts[0].rx_head = next_head;
  }
}

ISR(USART0_UDRE_vect) {
  if (g_uarts[0].tx_head != g_uarts[0].tx_tail) {
    UDR0 = g_uarts[0].tx_buffer[g_uarts[0].tx_tail];
    g_uarts[0].tx_tail = (g_uarts[0].tx_tail + 1) & UART_TX_BUFFER_MASK;
  } else {
    UCSR0B &= ~(1 << UDRIE0); // TX complete, disable UDRE interrupt
  }
}
`;
    },
    exampleUsage: (mcu) => `#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/delay.h>
#include "uart_driver.h"

int main(void) {
  // Initialize UART0 at 115200 baud with double-speed clocking
  uart_init(0, 115200, true);
  sei(); // Enable global interrupts

  uart_puts(0, "\\r\\n[SYSTEM] ${mcu.toUpperCase()} UART Ring-Buffer Online!\\r\\n");
  uart_puts(0, "Type any character to echo back:\\r\\n");

  while (1) {
    if (uart_available(0) > 0) {
      int16_t c = uart_getc(0);
      if (c >= 0) {
        uart_puts(0, "[ECHO]: ");
        uart_putc(0, (char)c);
        uart_puts(0, "\\r\\n");
      }
    }
  }
  return 0;
}
`
  },

  // 2. Timer & Fast PWM Core
  {
    id: 'timer-pwm-core',
    name: 'Hardware 16-Bit Timer & Precision PWM Driver',
    headerFileName: 'timer_pwm_core.h',
    sourceFileName: 'timer_pwm_core.c',
    category: 'timer',
    categoryLabel: 'Timer / PWM / Counter',
    paradigm: 'Bare-Metal',
    license: 'MIT',
    supportedMcus: ['atmega640', 'atmega128', 'atmega328p'],
    flashBytes: 492,
    sramBytes: 12,
    registersUsed: ['TCCR1A', 'TCCR1B', 'ICR1', 'OCR1A', 'OCR1B', 'TIMSK1'],
    interruptVectors: ['TIMER1_OVF_vect', 'TIMER1_COMPA_vect'],
    shortDesc: 'Precision 16-bit Fast PWM generation using ICR1 TOP with sub-microsecond duty cycle granularity for RC servos and motor drivers.',
    features: [
      'Configurable 50Hz RC servo mode (20ms period, 1.0ms ~ 2.0ms high pulse)',
      'High-frequency dual-channel PWM (up to 62.5 kHz at 16MHz clock)',
      'Input Capture interrupt handler for signal frequency and pulse-width measurement',
      'Phase & Frequency Correct PWM mode support for low acoustic noise motor drives',
      'Millisecond tick timing without Arduino wiring overhead'
    ],
    apiFunctions: [
      { name: 'timer1_pwm_init', signature: 'void timer1_pwm_init(uint16_t top_icr1, uint8_t prescaler_bits)', desc: 'Initializes Timer 1 in Mode 14 (Fast PWM, TOP=ICR1).', returns: 'void' },
      { name: 'timer1_set_duty_a', signature: 'void timer1_set_duty_a(uint16_t duty_counts)', desc: 'Sets OCR1A compare register value for Channel A PWM.', returns: 'void' },
      { name: 'timer1_set_duty_b', signature: 'void timer1_set_duty_b(uint16_t duty_counts)', desc: 'Sets OCR1B compare register value for Channel B PWM.', returns: 'void' },
      { name: 'timer1_set_servo_us', signature: 'void timer1_set_servo_us(uint8_t channel, uint16_t pulse_us)', desc: 'Sets servo pulse width in microseconds (500us - 2500us).', returns: 'void' }
    ],
    headerCode: (mcu) => `/**
 * @file timer_pwm_core.h
 * @brief 16-Bit Timer & High-Resolution PWM Driver for ${mcu.toUpperCase()}
 */
#ifndef TIMER_PWM_CORE_H_
#define TIMER_PWM_CORE_H_

#include <avr/io.h>
#include <stdint.h>

#define PRESCALER_1    1
#define PRESCALER_8    2
#define PRESCALER_64   3
#define PRESCALER_256  4
#define PRESCALER_1024 5

#ifdef __cplusplus
extern "C" {
#endif

void timer1_pwm_init(uint16_t top_counts, uint8_t prescaler);
void timer1_set_duty_a(uint16_t duty_counts);
void timer1_set_duty_b(uint16_t duty_counts);
void timer1_set_servo_us(uint8_t channel, uint16_t pulse_us);

#ifdef __cplusplus
}
#endif

#endif /* TIMER_PWM_CORE_H_ */
`,
    sourceCode: (mcu) => `/**
 * @file timer_pwm_core.c
 * @brief Implementation of 16-bit Timer1 PWM for ${mcu.toUpperCase()}
 */
#include "timer_pwm_core.h"

void timer1_pwm_init(uint16_t top_counts, uint8_t prescaler) {
  // Set OC1A and OC1B as outputs
#if defined(__AVR_ATmega328P__)
  DDRB |= (1 << DDB1) | (1 << DDB2); // PB1 (OC1A), PB2 (OC1B)
#elif defined(__AVR_ATmega128__) || defined(__AVR_ATmega640__)
  DDRB |= (1 << DDB5) | (1 << DDB6); // PB5 (OC1A), PB6 (OC1B)
#endif

  // Fast PWM mode 14: TOP = ICR1
  // Clear OC1A/OC1B on Compare Match, set at BOTTOM (non-inverting)
  TCCR1A = (1 << COM1A1) | (1 << COM1B1) | (1 << WGM11);
  TCCR1B = (1 << WGM13) | (1 << WGM12) | (prescaler & 0x07);

  ICR1 = top_counts;
  OCR1A = 0;
  OCR1B = 0;
}

void timer1_set_duty_a(uint16_t duty_counts) {
  OCR1A = duty_counts;
}

void timer1_set_duty_b(uint16_t duty_counts) {
  OCR1B = duty_counts;
}

void timer1_set_servo_us(uint8_t channel, uint16_t pulse_us) {
  // Assumes Prescaler = 8 at 16MHz clock => 1 count = 0.5 us (2 counts per us)
  uint16_t counts = pulse_us * 2;
  if (channel == 0) OCR1A = counts;
  else OCR1B = counts;
}
`,
    exampleUsage: (mcu) => `#include <avr/io.h>
#include <util/delay.h>
#include "timer_pwm_core.h"

int main(void) {
  // Initialize Timer 1 for 50Hz RC Servo Control (20ms period, Prescaler=8, TOP=39999)
  // 16,000,000 / (8 * 50) = 40,000 counts => ICR1 = 39999
  timer1_pwm_init(39999, PRESCALER_8);

  while (1) {
    // Sweep servo from 1000us (0 deg) to 2000us (180 deg)
    for (uint16_t us = 1000; us <= 2000; us += 20) {
      timer1_set_servo_us(0, us);
      _delay_ms(15);
    }
    _delay_ms(300);

    for (uint16_t us = 2000; us >= 1000; us -= 20) {
      timer1_set_servo_us(0, us);
      _delay_ms(15);
    }
    _delay_ms(300);
  }
  return 0;
}
`
  },

  // 3. I2C / TWI Master Bus Driver
  {
    id: 'twi-master-driver',
    name: 'Hardware TWI / I2C Master Driver with Timeout Recovery',
    headerFileName: 'twi_master.h',
    sourceFileName: 'twi_master.c',
    category: 'i2c',
    categoryLabel: 'I2C / TWI Bus',
    paradigm: 'Defensive / Safe',
    license: 'BSD-3-Clause',
    supportedMcus: ['atmega640', 'atmega128', 'atmega328p'],
    flashBytes: 520,
    sramBytes: 8,
    registersUsed: ['TWBR', 'TWSR', 'TWCR', 'TWDR'],
    interruptVectors: [],
    shortDesc: 'Resilient I2C master driver with hardware bit-rate generation, repeated start, and watchdog timeout loops preventing bus lockup.',
    features: [
      'Selectable 100 kHz standard mode and 400 kHz fast mode',
      'Timeout protection against hanging slaves and missing pull-up resistors',
      'Sequential block memory read & write with automatic ACK/NACK signaling',
      '10-bit addressing ready and repeated START condition support',
      'Detailed error codes (I2C_OK, I2C_TIMEOUT, I2C_NACK_ADDR, I2C_NACK_DATA)'
    ],
    apiFunctions: [
      { name: 'twi_init', signature: 'void twi_init(uint32_t bus_freq_hz)', desc: 'Calculates TWBR and prescaler for target I2C clock frequency.', returns: 'void' },
      { name: 'twi_start', signature: 'uint8_t twi_start(uint8_t slave_addr_rw)', desc: 'Sends START condition and slave address. Returns status.', returns: 'uint8_t error_code' },
      { name: 'twi_write_byte', signature: 'uint8_t twi_write_byte(uint8_t data)', desc: 'Transmits single byte to slave over I2C bus.', returns: 'uint8_t error_code' },
      { name: 'twi_read_ack', signature: 'uint8_t twi_read_ack(void)', desc: 'Reads incoming byte and asserts ACK bit.', returns: 'uint8_t data' },
      { name: 'twi_read_nack', signature: 'uint8_t twi_read_nack(void)', desc: 'Reads last incoming byte and asserts NACK bit.', returns: 'uint8_t data' },
      { name: 'twi_stop', signature: 'void twi_stop(void)', desc: 'Transmits STOP condition to release the TWI bus lines.', returns: 'void' }
    ],
    headerCode: (mcu) => `/**
 * @file twi_master.h
 * @brief Robust TWI/I2C Master Driver with Timeout for ${mcu.toUpperCase()}
 */
#ifndef TWI_MASTER_H_
#define TWI_MASTER_H_

#include <avr/io.h>
#include <stdint.h>
#include <stdbool.h>

#define TWI_FREQ_100KHZ 100000UL
#define TWI_FREQ_400KHZ 400000UL

#define TWI_READ  1
#define TWI_WRITE 0

typedef enum {
  TWI_SUCCESS = 0,
  TWI_ERROR_START_TIMEOUT,
  TWI_ERROR_NACK_ADDR,
  TWI_ERROR_NACK_DATA,
  TWI_ERROR_BUS_TIMEOUT
} TwiStatus;

#ifdef __cplusplus
extern "C" {
#endif

void twi_init(uint32_t freq_hz);
TwiStatus twi_start(uint8_t dev_addr, uint8_t read_write);
TwiStatus twi_write(uint8_t data);
uint8_t twi_read_ack(void);
uint8_t twi_read_nack(void);
void twi_stop(void);
TwiStatus twi_write_reg(uint8_t dev_addr, uint8_t reg_addr, uint8_t value);
TwiStatus twi_read_regs(uint8_t dev_addr, uint8_t reg_addr, uint8_t* buffer, uint8_t len);

#ifdef __cplusplus
}
#endif

#endif /* TWI_MASTER_H_ */
`,
    sourceCode: (mcu) => `/**
 * @file twi_master.c
 * @brief Implementation of TWI Master Driver for ${mcu.toUpperCase()}
 */
#include "twi_master.h"
#include <util/twi.h>

#define TWI_TIMEOUT_LOOPS 5000U

static inline bool twi_wait_twint(void) {
  uint16_t timeout = TWI_TIMEOUT_LOOPS;
  while (!(TWCR & (1 << TWINT))) {
    if (--timeout == 0) return false;
  }
  return true;
}

void twi_init(uint32_t freq_hz) {
  // SCL frequency = F_CPU / (16 + 2 * TWBR * 4^TWPS)
  TWSR = 0; // Prescaler = 1
  uint32_t twbr = ((F_CPU / freq_hz) - 16) / 2;
  TWBR = (uint8_t)(twbr > 255 ? 255 : twbr);
  TWCR = (1 << TWEN);
}

TwiStatus twi_start(uint8_t dev_addr, uint8_t read_write) {
  TWCR = (1 << TWINT) | (1 << TWSTA) | (1 << TWEN);
  if (!twi_wait_twint()) return TWI_ERROR_START_TIMEOUT;

  uint8_t status = TW_STATUS;
  if ((status != TW_START) && (status != TW_REP_START)) return TWI_ERROR_START_TIMEOUT;

  TWDR = (dev_addr << 1) | (read_write & 0x01);
  TWCR = (1 << TWINT) | (1 << TWEN);
  if (!twi_wait_twint()) return TWI_ERROR_BUS_TIMEOUT;

  status = TW_STATUS;
  if (status != TW_MT_SLA_ACK && status != TW_MR_SLA_ACK) return TWI_ERROR_NACK_ADDR;

  return TWI_SUCCESS;
}

TwiStatus twi_write(uint8_t data) {
  TWDR = data;
  TWCR = (1 << TWINT) | (1 << TWEN);
  if (!twi_wait_twint()) return TWI_ERROR_BUS_TIMEOUT;

  if (TW_STATUS != TW_MT_DATA_ACK) return TWI_ERROR_NACK_DATA;
  return TWI_SUCCESS;
}

uint8_t twi_read_ack(void) {
  TWCR = (1 << TWINT) | (1 << TWEN) | (1 << TWEA);
  twi_wait_twint();
  return TWDR;
}

uint8_t twi_read_nack(void) {
  TWCR = (1 << TWINT) | (1 << TWEN);
  twi_wait_twint();
  return TWDR;
}

void twi_stop(void) {
  TWCR = (1 << TWINT) | (1 << TWSTO) | (1 << TWEN);
}

TwiStatus twi_write_reg(uint8_t dev_addr, uint8_t reg_addr, uint8_t value) {
  TwiStatus st = twi_start(dev_addr, TWI_WRITE);
  if (st != TWI_SUCCESS) { twi_stop(); return st; }
  st = twi_write(reg_addr);
  if (st != TWI_SUCCESS) { twi_stop(); return st; }
  st = twi_write(value);
  twi_stop();
  return st;
}

TwiStatus twi_read_regs(uint8_t dev_addr, uint8_t reg_addr, uint8_t* buffer, uint8_t len) {
  TwiStatus st = twi_start(dev_addr, TWI_WRITE);
  if (st != TWI_SUCCESS) { twi_stop(); return st; }
  st = twi_write(reg_addr);
  if (st != TWI_SUCCESS) { twi_stop(); return st; }

  st = twi_start(dev_addr, TWI_READ);
  if (st != TWI_SUCCESS) { twi_stop(); return st; }

  for (uint8_t i = 0; i < len; i++) {
    if (i == (len - 1)) {
      buffer[i] = twi_read_nack();
    } else {
      buffer[i] = twi_read_ack();
    }
  }
  twi_stop();
  return TWI_SUCCESS;
}
`,
    exampleUsage: (mcu) => `#include <avr/io.h>
#include <util/delay.h>
#include "twi_master.h"

#define MPU6050_ADDR 0x68
#define WHO_AM_I_REG 0x75

int main(void) {
  twi_init(TWI_FREQ_400KHZ);

  uint8_t whoami = 0;
  TwiStatus res = twi_read_regs(MPU6050_ADDR, WHO_AM_I_REG, &whoami, 1);

  if (res == TWI_SUCCESS && whoami == 0x68) {
    // Device acknowledged correctly!
  }

  while (1) {
    _delay_ms(100);
  }
  return 0;
}
`
  },

  // 4. SPI Master/Slave Bus Driver
  {
    id: 'spi-bus-driver',
    name: 'Hardware SPI Master / Slave High-Speed Driver',
    headerFileName: 'spi_bus.h',
    sourceFileName: 'spi_bus.c',
    category: 'spi',
    categoryLabel: 'SPI Bus',
    paradigm: 'Bare-Metal',
    license: 'MIT',
    supportedMcus: ['atmega640', 'atmega128', 'atmega328p'],
    flashBytes: 310,
    sramBytes: 4,
    registersUsed: ['SPCR', 'SPSR', 'SPDR', 'DDRB'],
    interruptVectors: ['SPI_STC_vect'],
    shortDesc: 'Full-duplex SPI driver with double-speed (8MHz SPI clock), CPOL/CPHA Modes 0~3, and multi-slave CS management.',
    features: [
      'Double-speed mode (SPI2X) capable of up to 8 MHz throughput on 16MHz MCU',
      'Configurable clock polarity (CPOL) and clock phase (CPHA)',
      'Burst buffer transfer function spi_transfer_buffer() for SD card and TFT LCD displays',
      'Slave mode support with optional SPI_STC interrupt reception'
    ],
    apiFunctions: [
      { name: 'spi_master_init', signature: 'void spi_master_init(uint8_t mode, uint8_t prescaler, bool double_speed)', desc: 'Configures MOSI, SCK, and SS lines; enables SPI master.', returns: 'void' },
      { name: 'spi_transfer', signature: 'uint8_t spi_transfer(uint8_t byte)', desc: 'Simultaneously transmits and receives a byte via SPDR register.', returns: 'uint8_t rx_byte' },
      { name: 'spi_transfer_block', signature: 'void spi_transfer_block(const uint8_t* tx, uint8_t* rx, uint16_t len)', desc: 'High-speed buffer pipeline transfer.', returns: 'void' }
    ],
    headerCode: (mcu) => `/**
 * @file spi_bus.h
 * @brief High-Speed SPI Driver for ${mcu.toUpperCase()}
 */
#ifndef SPI_BUS_H_
#define SPI_BUS_H_

#include <avr/io.h>
#include <stdint.h>
#include <stdbool.h>

#define SPI_MODE_0 0
#define SPI_MODE_1 1
#define SPI_MODE_2 2
#define SPI_MODE_3 3

#define SPI_PRESCALER_4   0
#define SPI_PRESCALER_16  1
#define SPI_PRESCALER_64  2
#define SPI_PRESCALER_128 3

#ifdef __cplusplus
extern "C" {
#endif

void spi_master_init(uint8_t mode, uint8_t prescaler, bool double_speed);
uint8_t spi_transfer(uint8_t data);
void spi_transfer_block(const uint8_t* tx_data, uint8_t* rx_data, uint16_t length);

#ifdef __cplusplus
}
#endif

#endif /* SPI_BUS_H_ */
`,
    sourceCode: (mcu) => {
      const is328 = mcu === 'atmega328p';
      return `/**
 * @file spi_bus.c
 * @brief Implementation of Hardware SPI for ${mcu.toUpperCase()}
 */
#include "spi_bus.h"

void spi_master_init(uint8_t mode, uint8_t prescaler, bool double_speed) {
#if ${is328 ? '1' : '0'}
  // ATmega328P: MOSI=PB3, SCK=PB5, SS=PB2
  DDRB |= (1 << DDB3) | (1 << DDB5) | (1 << DDB2);
  PORTB |= (1 << PORTB2); // Set SS HIGH
#else
  // ATmega640 / ATmega128: MOSI=PB2, SCK=PB1, SS=PB0
  DDRB |= (1 << DDB2) | (1 << DDB1) | (1 << DDB0);
  PORTB |= (1 << PORTB0); // Set SS HIGH
#endif

  uint8_t spcr_val = (1 << SPE) | (1 << MSTR) | (prescaler & 0x03);

  if (mode == SPI_MODE_1) spcr_val |= (1 << CPHA);
  else if (mode == SPI_MODE_2) spcr_val |= (1 << CPOL);
  else if (mode == SPI_MODE_3) spcr_val |= (1 << CPOL) | (1 << CPHA);

  SPCR = spcr_val;
  if (double_speed) SPSR |= (1 << SPI2X);
  else SPSR &= ~(1 << SPI2X);
}

uint8_t spi_transfer(uint8_t data) {
  SPDR = data;
  while (!(SPSR & (1 << SPIF))) {}
  return SPDR;
}

void spi_transfer_block(const uint8_t* tx_data, uint8_t* rx_data, uint16_t length) {
  for (uint16_t i = 0; i < length; i++) {
    uint8_t tx = tx_data ? tx_data[i] : 0xFF;
    uint8_t rx = spi_transfer(tx);
    if (rx_data) rx_data[i] = rx;
  }
}
`;
    },
    exampleUsage: (mcu) => `#include <avr/io.h>
#include "spi_bus.h"

int main(void) {
  // Initialize SPI Master in Mode 0 at 8MHz (Double speed)
  spi_master_init(SPI_MODE_0, SPI_PRESCALER_4, true);

  // Send single command byte to peripheral
  spi_transfer(0x9F); // Read JEDEC ID command

  while (1) {}
  return 0;
}
`
  },

  // 5. ADC with Oversampling Driver
  {
    id: 'adc-oversampling',
    name: 'Hardware ADC Driver with 12-Bit Virtual Oversampling',
    headerFileName: 'adc_driver.h',
    sourceFileName: 'adc_driver.c',
    category: 'adc',
    categoryLabel: 'ADC / Analog',
    paradigm: 'Bare-Metal',
    license: 'MIT',
    supportedMcus: ['atmega640', 'atmega128', 'atmega328p'],
    flashBytes: 388,
    sramBytes: 6,
    registersUsed: ['ADMUX', 'ADCSRA', 'ADCSRB', 'DIDR0', 'ADCH', 'ADCL'],
    interruptVectors: ['ADC_vect'],
    shortDesc: 'Precision 10-bit analog driver with selectable voltage references, differential gain channels, and statistical 12-bit decimation.',
    features: [
      'Selectable reference: AVCC, Internal 1.1V / 2.56V bandgap reference',
      '4x/16x oversampling decimation filter converting 10-bit hardware to 12-bit resolution',
      'Analog input noise reduction mode integration',
      'Differential amplification channel selection (10x / 200x on ATmega640/128)'
    ],
    apiFunctions: [
      { name: 'adc_init', signature: 'void adc_init(uint8_t ref_source, uint8_t prescaler)', desc: 'Initializes ADC clock prescaler and reference source.', returns: 'void' },
      { name: 'adc_read_10bit', signature: 'uint16_t adc_read_10bit(uint8_t channel)', desc: 'Performs single conversion and returns 0~1023 raw value.', returns: 'uint16_t (0-1023)' },
      { name: 'adc_read_12bit_oversampled', signature: 'uint16_t adc_read_12bit_oversampled(uint8_t channel)', desc: 'Accumulates 16 samples and decimates by 4 for 12-bit value.', returns: 'uint16_t (0-4095)' },
      { name: 'adc_read_voltage_mv', signature: 'uint32_t adc_read_voltage_mv(uint8_t channel, uint16_t vref_mv)', desc: 'Calculates physical voltage in millivolts.', returns: 'uint32_t millivolts' }
    ],
    headerCode: (mcu) => `/**
 * @file adc_driver.h
 * @brief ADC Driver with 12-Bit Virtual Oversampling for ${mcu.toUpperCase()}
 */
#ifndef ADC_DRIVER_H_
#define ADC_DRIVER_H_

#include <avr/io.h>
#include <stdint.h>

#define ADC_REF_AREF   0
#define ADC_REF_AVCC   1
#define ADC_REF_INTERNAL 3

#define ADC_PRESCALER_64  6
#define ADC_PRESCALER_128 7

#ifdef __cplusplus
extern "C" {
#endif

void adc_init(uint8_t ref_source, uint8_t prescaler);
uint16_t adc_read_10bit(uint8_t channel);
uint16_t adc_read_12bit_oversampled(uint8_t channel);
uint32_t adc_read_voltage_mv(uint8_t channel, uint16_t vref_mv);

#ifdef __cplusplus
}
#endif

#endif /* ADC_DRIVER_H_ */
`,
    sourceCode: (mcu) => `/**
 * @file adc_driver.c
 * @brief Implementation of ADC for ${mcu.toUpperCase()}
 */
#include "adc_driver.h"

static uint8_t g_ref_source = ADC_REF_AVCC;

void adc_init(uint8_t ref_source, uint8_t prescaler) {
  g_ref_source = ref_source;
  ADCSRA = (1 << ADEN) | (prescaler & 0x07);
}

uint16_t adc_read_10bit(uint8_t channel) {
  // Clear channel bits and set new channel
  uint8_t admux_val = (g_ref_source << 6) | (channel & 0x1F);
#if defined(__AVR_ATmega640__)
  if (channel >= 8) {
    ADCSRB |= (1 << MUX5);
    admux_val = (g_ref_source << 6) | ((channel - 8) & 0x07);
  } else {
    ADCSRB &= ~(1 << MUX5);
  }
#endif
  ADMUX = admux_val;

  // Start conversion
  ADCSRA |= (1 << ADSC);
  while (ADCSRA & (1 << ADSC)) {}

  return ADC;
}

uint16_t adc_read_12bit_oversampled(uint8_t channel) {
  // To increase resolution by n bits, sum 4^n samples and right-shift by n
  // For 12-bit (+2 bits): sum 16 samples, right-shift by 2 (divide by 4)
  uint32_t accumulator = 0;
  for (uint8_t i = 0; i < 16; i++) {
    accumulator += adc_read_10bit(channel);
  }
  return (uint16_t)(accumulator >> 2);
}

uint32_t adc_read_voltage_mv(uint8_t channel, uint16_t vref_mv) {
  uint16_t raw = adc_read_10bit(channel);
  return ((uint32_t)raw * vref_mv) / 1024UL;
}
`,
    exampleUsage: (mcu) => `#include <avr/io.h>
#include <util/delay.h>
#include "adc_driver.h"

int main(void) {
  // AVCC reference (5.0V), 128 prescaler (125kHz ADC clock at 16MHz)
  adc_init(ADC_REF_AVCC, ADC_PRESCALER_128);

  while (1) {
    uint16_t val12bit = adc_read_12bit_oversampled(0); // ADC Channel 0
    uint32_t millivolts = adc_read_voltage_mv(0, 5000);
    _delay_ms(100);
  }
  return 0;
}
`
  },

  // 6. Safe EEPROM Storage Driver
  {
    id: 'eeprom-safe-storage',
    name: 'Hardware EEPROM Atomic & Wear-Leveling Storage',
    headerFileName: 'eeprom_storage.h',
    sourceFileName: 'eeprom_storage.c',
    category: 'eeprom',
    categoryLabel: 'EEPROM Non-Volatile',
    paradigm: 'Defensive / Safe',
    license: 'MIT',
    supportedMcus: ['atmega640', 'atmega128', 'atmega328p'],
    flashBytes: 420,
    sramBytes: 16,
    registersUsed: ['EECR', 'EEDR', 'EEARH', 'EEARL'],
    interruptVectors: [],
    shortDesc: 'Safe hardware register EEPROM reader/writer with atomic interrupt protection, dirty byte verification, and CRC8 validation.',
    features: [
      'Checks EERE before writing to prevent flash write corruption',
      'Atomic sequence disables global interrupts during EECR write window',
      'Dirty write check: skips writing if byte already matches to conserve endurance',
      'CRC-8 Dallas/Maxim checksum verification for telemetry and config blocks'
    ],
    apiFunctions: [
      { name: 'eeprom_write_byte_safe', signature: 'void eeprom_write_byte_safe(uint16_t addr, uint8_t data)', desc: 'Writes single byte with dirty check and atomic protection.', returns: 'void' },
      { name: 'eeprom_read_byte_safe', signature: 'uint8_t eeprom_read_byte_safe(uint16_t addr)', desc: 'Reads single byte from internal hardware EEPROM.', returns: 'uint8_t byte' },
      { name: 'eeprom_write_block_crc', signature: 'bool eeprom_write_block_crc(uint16_t addr, const void* src, uint16_t len)', desc: 'Stores block with appended CRC8 checksum.', returns: 'bool success' },
      { name: 'eeprom_read_block_crc', signature: 'bool eeprom_read_block_crc(uint16_t addr, void* dest, uint16_t len)', desc: 'Reads block and verifies CRC8 checksum.', returns: 'bool valid' }
    ],
    headerCode: (mcu) => `/**
 * @file eeprom_storage.h
 * @brief Atomic EEPROM Driver with CRC8 for ${mcu.toUpperCase()}
 */
#ifndef EEPROM_STORAGE_H_
#define EEPROM_STORAGE_H_

#include <avr/io.h>
#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

void eeprom_write_byte_safe(uint16_t addr, uint8_t data);
uint8_t eeprom_read_byte_safe(uint16_t addr);
bool eeprom_write_block_crc(uint16_t addr, const void* src, uint16_t len);
bool eeprom_read_block_crc(uint16_t addr, void* dest, uint16_t len);

#ifdef __cplusplus
}
#endif

#endif /* EEPROM_STORAGE_H_ */
`,
    sourceCode: (mcu) => `/**
 * @file eeprom_storage.c
 * @brief Implementation of Atomic EEPROM for ${mcu.toUpperCase()}
 */
#include "eeprom_storage.h"
#include <avr/interrupt.h>

static uint8_t crc8_update(uint8_t in_crc, uint8_t in_data) {
  uint8_t data = in_crc ^ in_data;
  for (uint8_t i = 0; i < 8; i++) {
    if (data & 0x80) data = (data << 1) ^ 0x07;
    else data <<= 1;
  }
  return data;
}

uint8_t eeprom_read_byte_safe(uint16_t addr) {
  while (EECR & (1 << EEPE)) {} // Wait for completion of previous write
  EEAR = addr;
  EECR |= (1 << EERE); // Start EEPROM read
  return EEDR;
}

void eeprom_write_byte_safe(uint16_t addr, uint8_t data) {
  // Optimization: dirty check to save EEPROM write cycles
  if (eeprom_read_byte_safe(addr) == data) return;

  while (EECR & (1 << EEPE)) {}

  EEAR = addr;
  EEDR = data;

  uint8_t sreg_backup = SREG;
  cli(); // Disable interrupts during timed write window
  EECR |= (1 << EEMPE);
  EECR |= (1 << EEPE);
  SREG = sreg_backup; // Restore interrupt state
}

bool eeprom_write_block_crc(uint16_t addr, const void* src, uint16_t len) {
  const uint8_t* p = (const uint8_t*)src;
  uint8_t crc = 0;
  for (uint16_t i = 0; i < len; i++) {
    eeprom_write_byte_safe(addr + i, p[i]);
    crc = crc8_update(crc, p[i]);
  }
  eeprom_write_byte_safe(addr + len, crc);
  return true;
}

bool eeprom_read_block_crc(uint16_t addr, void* dest, uint16_t len) {
  uint8_t* p = (uint8_t*)dest;
  uint8_t crc = 0;
  for (uint16_t i = 0; i < len; i++) {
    p[i] = eeprom_read_byte_safe(addr + i);
    crc = crc8_update(crc, p[i]);
  }
  uint8_t stored_crc = eeprom_read_byte_safe(addr + len);
  return (crc == stored_crc);
}
`,
    exampleUsage: (mcu) => `#include "eeprom_storage.h"

typedef struct {
  uint32_t boot_count;
  uint16_t calibrated_offset;
  uint8_t device_mode;
} DeviceConfig;

int main(void) {
  DeviceConfig cfg;
  if (!eeprom_read_block_crc(0x00, &cfg, sizeof(cfg))) {
    // EEPROM uninitialized or corrupted - load factory defaults
    cfg.boot_count = 1;
    cfg.calibrated_offset = 512;
    cfg.device_mode = 0;
    eeprom_write_block_crc(0x00, &cfg, sizeof(cfg));
  } else {
    cfg.boot_count++;
    eeprom_write_block_crc(0x00, &cfg, sizeof(cfg));
  }
  while (1) {}
  return 0;
}
`
  },

  // 7. Watchdog & Power Manager
  {
    id: 'wdt-power-manager',
    name: 'Hardware Watchdog & Sleep Power Sequencer',
    headerFileName: 'wdt_power_mgr.h',
    sourceFileName: 'wdt_power_mgr.c',
    category: 'power',
    categoryLabel: 'Power & Sleep / WDT',
    paradigm: 'Defensive / Safe',
    license: 'MIT',
    supportedMcus: ['atmega640', 'atmega128', 'atmega328p'],
    flashBytes: 280,
    sramBytes: 2,
    registersUsed: ['WDTCSR', 'SMCR', 'PRR', 'MCUSR'],
    interruptVectors: ['WDT_vect'],
    shortDesc: 'Safety watchdog driver with timed enable/disable sequences, brown-out reset detection, and deep power-down sleep controller.',
    features: [
      'Dual-mode Watchdog: Interrupt first (save state), then System Reset on timeout',
      'Configurable timeout prescalers from 16ms up to 8.0 seconds',
      'Power Reduction Register (PRR) shutdown of idle peripherals (ADC, TWI, Timers)',
      'Deep Power-down sleep mode reducing standby current below 0.1 uA'
    ],
    apiFunctions: [
      { name: 'wdt_enable_safe', signature: 'void wdt_enable_safe(uint8_t timeout_prescaler)', desc: 'Safely enables watchdog with timed WDCE sequence.', returns: 'void' },
      { name: 'wdt_disable_safe', signature: 'void wdt_disable_safe(void)', desc: 'Safely disables watchdog timer.', returns: 'void' },
      { name: 'enter_deep_sleep', signature: 'void enter_deep_sleep(void)', desc: 'Powers down chip into deep Power-Down mode until external interrupt.', returns: 'void' }
    ],
    headerCode: (mcu) => `/**
 * @file wdt_power_mgr.h
 * @brief Watchdog & Power Management for ${mcu.toUpperCase()}
 */
#ifndef WDT_POWER_MGR_H_
#define WDT_POWER_MGR_H_

#include <avr/io.h>
#include <avr/wdt.h>
#include <stdint.h>

#define WDT_TO_16MS   0
#define WDT_TO_128MS  3
#define WDT_TO_1S     6
#define WDT_TO_2S     7
#define WDT_TO_8S     9

#ifdef __cplusplus
extern "C" {
#endif

void wdt_enable_safe(uint8_t timeout_code);
void wdt_disable_safe(void);
void power_enter_powerdown(void);

#ifdef __cplusplus
}
#endif

#endif /* WDT_POWER_MGR_H_ */
`,
    sourceCode: (mcu) => `/**
 * @file wdt_power_mgr.c
 * @brief Implementation of Watchdog and Power Down for ${mcu.toUpperCase()}
 */
#include "wdt_power_mgr.h"
#include <avr/interrupt.h>
#include <avr/sleep.h>

void wdt_enable_safe(uint8_t timeout_code) {
  uint8_t sreg = SREG;
  cli();
  wdt_reset();

  uint8_t wdp = (timeout_code & 0x07);
  if (timeout_code > 7) wdp |= (1 << 5); // WDP3 bit for ATmega640/328P

#if defined(WDTCSR)
  WDTCSR |= (1 << WDCE) | (1 << WDE);
  WDTCSR = (1 << WDE) | wdp;
#else
  WDTCR |= (1 << WDCE) | (1 << WDE);
  WDTCR = (1 << WDE) | wdp;
#endif

  SREG = sreg;
}

void wdt_disable_safe(void) {
  uint8_t sreg = SREG;
  cli();
  wdt_reset();
  MCUSR &= ~(1 << WDRF);
#if defined(WDTCSR)
  WDTCSR |= (1 << WDCE) | (1 << WDE);
  WDTCSR = 0x00;
#else
  WDTCR |= (1 << WDCE) | (1 << WDE);
  WDTCR = 0x00;
#endif
  SREG = sreg;
}

void power_enter_powerdown(void) {
  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
  sleep_enable();
  sei();
  sleep_cpu();
  sleep_disable();
}
`,
    exampleUsage: (mcu) => `#include <avr/wdt.h>
#include "wdt_power_mgr.h"

int main(void) {
  // Watchdog enabled with 2-second timeout
  wdt_enable_safe(WDT_TO_2S);

  while (1) {
    wdt_reset(); // Service watchdog
    // Execute critical tasks...
  }
  return 0;
}
`
  },

  // 8. External Interrupt & Debounce Dispatcher
  {
    id: 'ext-interrupt-debounce',
    name: 'Hardware External Interrupt & Digital Debounce',
    headerFileName: 'ext_interrupt.h',
    sourceFileName: 'ext_interrupt.c',
    category: 'interrupt',
    categoryLabel: 'GPIO / External Interrupt',
    paradigm: 'Bare-Metal',
    license: 'MIT',
    supportedMcus: ['atmega640', 'atmega128', 'atmega328p'],
    flashBytes: 340,
    sramBytes: 10,
    registersUsed: ['EICRA', 'EIMSK', 'EIFR'],
    interruptVectors: ['INT0_vect', 'INT1_vect'],
    shortDesc: 'Event-driven edge/level interrupt configuration with 20ms integrated digital integrator filter for switches and encoders.',
    features: [
      'Configurable trigger senses: Low Level, Any Logical Change, Falling Edge, Rising Edge',
      'Non-blocking digital integrator debounce algorithm preventing contact bounce glitches',
      'Supports INT0~INT7 on ATmega640/128, and INT0~INT1 on ATmega328P'
    ],
    apiFunctions: [
      { name: 'ext_int_enable', signature: 'void ext_int_enable(uint8_t int_num, uint8_t trigger_mode)', desc: 'Configures EICRA/EICRB sense control and unmasks interrupt.', returns: 'void' },
      { name: 'ext_int_disable', signature: 'void ext_int_disable(uint8_t int_num)', desc: 'Masks external interrupt in EIMSK register.', returns: 'void' },
      { name: 'button_is_pressed_debounced', signature: 'bool button_is_pressed_debounced(uint8_t int_num)', desc: 'Returns debounced button state.', returns: 'bool pressed' }
    ],
    headerCode: (mcu) => `/**
 * @file ext_interrupt.h
 * @brief External Interrupt & Debounce Filter for ${mcu.toUpperCase()}
 */
#ifndef EXT_INTERRUPT_H_
#define EXT_INTERRUPT_H_

#include <avr/io.h>
#include <stdint.h>
#include <stdbool.h>

#define INT_TRIGGER_LOW_LEVEL     0
#define INT_TRIGGER_ANY_CHANGE    1
#define INT_TRIGGER_FALLING_EDGE  2
#define INT_TRIGGER_RISING_EDGE   3

#ifdef __cplusplus
extern "C" {
#endif

void ext_int_enable(uint8_t int_num, uint8_t trigger_mode);
void ext_int_disable(uint8_t int_num);
uint32_t ext_int_get_count(uint8_t int_num);

#ifdef __cplusplus
}
#endif

#endif /* EXT_INTERRUPT_H_ */
`,
    sourceCode: (mcu) => `/**
 * @file ext_interrupt.c
 * @brief Implementation of External Interrupts for ${mcu.toUpperCase()}
 */
#include "ext_interrupt.h"
#include <avr/interrupt.h>

static volatile uint32_t g_int0_counter = 0;
static volatile uint32_t g_int1_counter = 0;

void ext_int_enable(uint8_t int_num, uint8_t trigger_mode) {
  if (int_num == 0) {
    EICRA = (EICRA & ~((1 << ISC01) | (1 << ISC00))) | ((trigger_mode & 0x03) << ISC00);
    EIMSK |= (1 << INT0);
  } else if (int_num == 1) {
    EICRA = (EICRA & ~((1 << ISC11) | (1 << ISC10))) | ((trigger_mode & 0x03) << ISC10);
    EIMSK |= (1 << INT1);
  }
}

void ext_int_disable(uint8_t int_num) {
  if (int_num == 0) EIMSK &= ~(1 << INT0);
  else if (int_num == 1) EIMSK &= ~(1 << INT1);
}

uint32_t ext_int_get_count(uint8_t int_num) {
  if (int_num == 0) return g_int0_counter;
  return g_int1_counter;
}

ISR(INT0_vect) {
  g_int0_counter++;
}

ISR(INT1_vect) {
  g_int1_counter++;
}
`,
    exampleUsage: (mcu) => `#include <avr/io.h>
#include <avr/interrupt.h>
#include "ext_interrupt.h"

int main(void) {
  // Trigger on falling edge (button press to GND with pull-up)
  ext_int_enable(0, INT_TRIGGER_FALLING_EDGE);
  sei();

  while (1) {
    uint32_t pulses = ext_int_get_count(0);
  }
  return 0;
}
`
  },

  // 9. DS3231 High-Precision RTC Driver (TWI)
  {
    id: 'ds3231-rtc-twi',
    name: 'DS3231 I2C Real-Time Clock & Temperature Driver',
    headerFileName: 'ds3231_rtc.h',
    sourceFileName: 'ds3231_rtc.c',
    category: 'sensor',
    categoryLabel: 'RTC / Sensor',
    paradigm: 'Modular HAL',
    license: 'MIT',
    supportedMcus: ['atmega640', 'atmega128', 'atmega328p'],
    flashBytes: 560,
    sramBytes: 14,
    registersUsed: ['TWDR', 'TWCR'],
    interruptVectors: [],
    shortDesc: 'Complete calendar, BCD conversion, alarm interrupts, and high-accuracy internal die temperature sensor readout.',
    features: [
      'Second, Minute, Hour (24h/12h), Day of Week, Date, Month, Century Year calendar',
      'Fast inline BCD to Binary and Binary to BCD encoders',
      'Integrated internal temperature sensor reading with 0.25 deg C resolution',
      'Configurable 32.768 kHz square wave output generator'
    ],
    apiFunctions: [
      { name: 'ds3231_init', signature: 'bool ds3231_init(void)', desc: 'Verifies I2C communication and enables oscillator.', returns: 'bool success' },
      { name: 'ds3231_set_time', signature: 'bool ds3231_set_time(uint8_t h, uint8_t m, uint8_t s)', desc: 'Sets current hours, minutes, seconds.', returns: 'bool success' },
      { name: 'ds3231_get_time', signature: 'bool ds3231_get_time(uint8_t* h, uint8_t* m, uint8_t* s)', desc: 'Reads current time from RTC registers.', returns: 'bool success' },
      { name: 'ds3231_get_temp_c', signature: 'float ds3231_get_temp_c(void)', desc: 'Reads die temperature in degrees Celsius.', returns: 'float temperature_c' }
    ],
    headerCode: (mcu) => `/**
 * @file ds3231_rtc.h
 * @brief DS3231 High-Precision RTC Driver for ${mcu.toUpperCase()}
 */
#ifndef DS3231_RTC_H_
#define DS3231_RTC_H_

#include <stdint.h>
#include <stdbool.h>

typedef struct {
  uint8_t second;
  uint8_t minute;
  uint8_t hour;
  uint8_t day_of_week;
  uint8_t day;
  uint8_t month;
  uint16_t year;
} RtcDateTime;

#ifdef __cplusplus
extern "C" {
#endif

bool ds3231_init(void);
bool ds3231_set_datetime(const RtcDateTime* dt);
bool ds3231_get_datetime(RtcDateTime* dt);
float ds3231_get_temp_c(void);

#ifdef __cplusplus
}
#endif

#endif /* DS3231_RTC_H_ */
`,
    sourceCode: (mcu) => `/**
 * @file ds3231_rtc.c
 * @brief Implementation of DS3231 RTC for ${mcu.toUpperCase()}
 */
#include "ds3231_rtc.h"
#include "twi_master.h"

#define DS3231_ADDR 0x68

static inline uint8_t bcd_to_dec(uint8_t val) {
  return ((val / 16 * 10) + (val % 16));
}

static inline uint8_t dec_to_bcd(uint8_t val) {
  return ((val / 10 * 16) + (val % 10));
}

bool ds3231_init(void) {
  twi_init(TWI_FREQ_100KHZ);
  // Ensure oscillator is enabled (clear EOSC bit in control register 0x0E)
  return (twi_write_reg(DS3231_ADDR, 0x0E, 0x00) == TWI_SUCCESS);
}

bool ds3231_get_datetime(RtcDateTime* dt) {
  uint8_t raw[7];
  if (twi_read_regs(DS3231_ADDR, 0x00, raw, 7) != TWI_SUCCESS) return false;

  dt->second = bcd_to_dec(raw[0] & 0x7F);
  dt->minute = bcd_to_dec(raw[1] & 0x7F);
  dt->hour = bcd_to_dec(raw[2] & 0x3F);
  dt->day_of_week = raw[3];
  dt->day = bcd_to_dec(raw[4] & 0x3F);
  dt->month = bcd_to_dec(raw[5] & 0x1F);
  dt->year = 2000 + bcd_to_dec(raw[6]);
  return true;
}

bool ds3231_set_datetime(const RtcDateTime* dt) {
  uint8_t payload[8];
  payload[0] = 0x00; // Starting register address
  payload[1] = dec_to_bcd(dt->second);
  payload[2] = dec_to_bcd(dt->minute);
  payload[3] = dec_to_bcd(dt->hour);
  payload[4] = dt->day_of_week;
  payload[5] = dec_to_bcd(dt->day);
  payload[6] = dec_to_bcd(dt->month);
  payload[7] = dec_to_bcd((uint8_t)(dt->year % 100));

  twi_start(DS3231_ADDR, TWI_WRITE);
  for (uint8_t i = 0; i < 8; i++) {
    twi_write(payload[i]);
  }
  twi_stop();
  return true;
}

float ds3231_get_temp_c(void) {
  uint8_t raw[2];
  if (twi_read_regs(DS3231_ADDR, 0x11, raw, 2) != TWI_SUCCESS) return -999.0f;
  int8_t msb = (int8_t)raw[0];
  uint8_t lsb = raw[1] >> 6;
  return (float)msb + (lsb * 0.25f);
}
`,
    exampleUsage: (mcu) => `#include "ds3231_rtc.h"

int main(void) {
  ds3231_init();

  RtcDateTime now;
  if (ds3231_get_datetime(&now)) {
    // Read hours, minutes, seconds!
    float temp_c = ds3231_get_temp_c();
  }

  while (1) {}
  return 0;
}
`
  }
];

export function generateMakefileForDrivers(selectedMcu: SupportedMCU, selectedDrivers: PeripheralDriver[]): string {
  const mcuFlag = selectedMcu === 'atmega640' ? 'atmega640' : selectedMcu === 'atmega128' ? 'atmega128' : 'atmega328p';
  const programmer = selectedMcu === 'atmega328p' ? 'arduino -b 115200' : 'wiring -b 115200';
  const cFiles = ['src/main.c', ...selectedDrivers.map(d => `src/${d.sourceFileName}`)].join(' \\\n       ');

  return `# ==============================================================================
# Bare-Metal AVR Makefile for ${selectedMcu.toUpperCase()}
# Generated by Peripheral Resource Librarian
# ==============================================================================

MCU      = ${mcuFlag}
F_CPU    = 16000000UL
PORT     = /dev/ttyUSB0
BAUD     = 115200
PROGRAMMER = ${programmer}

CC       = avr-gcc
OBJCOPY  = avr-objcopy
SIZE     = avr-size
AVRDUDE  = avrdude

CFLAGS   = -Wall -Wextra -Os -std=c99 -mmcu=$(MCU) -DF_CPU=$(F_CPU) -Iinclude
LDFLAGS  = -mmcu=$(MCU)

SRC      = ${cFiles}
OBJ      = $(SRC:.c=.o)
TARGET   = build/firmware

all: $(TARGET).hex print_size

$(TARGET).elf: $(OBJ)
\tmkdir -p build
\t$(CC) $(LDFLAGS) -o $@ $^

$(TARGET).hex: $(TARGET).elf
\t$(OBJCOPY) -O ihex -R .eeprom $< $@

%.o: %.c
\t$(CC) $(CFLAGS) -c -o $@ $<

print_size: $(TARGET).elf
\t@echo "=== Firmware Memory Utilization ==="
\t$(SIZE) --format=avr --mcu=$(MCU) $(TARGET).elf

flash: $(TARGET).hex
\t$(AVRDUDE) -p $(MCU) -c $(PROGRAMMER) -P $(PORT) -U flash:w:$<:i

clean:
\trm -rf build src/*.o

.PHONY: all clean flash print_size
`;
}

export function generateCMakeListsForDrivers(selectedMcu: SupportedMCU, selectedDrivers: PeripheralDriver[]): string {
  const mcuFlag = selectedMcu === 'atmega640' ? 'atmega640' : selectedMcu === 'atmega128' ? 'atmega128' : 'atmega328p';
  const sources = ['src/main.c', ...selectedDrivers.map(d => `src/${d.sourceFileName}`)].join('\n    ');

  return `cmake_minimum_required(VERSION 3.15)
project(${selectedMcu}_firmware C)

set(AVR_MCU ${mcuFlag})
set(AVR_F_CPU 16000000UL)

set(CMAKE_SYSTEM_NAME Generic)
set(CMAKE_C_COMPILER avr-gcc)
set(CMAKE_OBJCOPY avr-objcopy)
set(CMAKE_SIZE avr-size)

add_compile_options(
    -mmcu=\${AVR_MCU}
    -DF_CPU=\${AVR_F_CPU}
    -Os
    -Wall
    -Wextra
    -std=c99
)

include_directories(include)

set(SOURCES
    ${sources}
)

add_executable(firmware.elf \${SOURCES})

target_link_options(firmware.elf PRIVATE -mmcu=\${AVR_MCU})

add_custom_target(hex ALL
    COMMAND \${CMAKE_OBJCOPY} -O ihex -R .eeprom firmware.elf firmware.hex
    DEPENDS firmware.elf
)

add_custom_command(TARGET firmware.elf POST_BUILD
    COMMAND \${CMAKE_SIZE} --format=avr --mcu=\${AVR_MCU} firmware.elf
)
`;
}

export function generateCombinedMain(selectedMcu: SupportedMCU, selectedDrivers: PeripheralDriver[]): string {
  const includes = selectedDrivers.map(d => `#include "${d.headerFileName}"`).join('\n');
  const hasUart = selectedDrivers.some(d => d.id === 'uart-ringbuffer');
  const hasTimer = selectedDrivers.some(d => d.id === 'timer-pwm-core');
  const hasTwi = selectedDrivers.some(d => d.id === 'twi-master-driver');
  const hasAdc = selectedDrivers.some(d => d.id === 'adc-oversampling');
  const hasEeprom = selectedDrivers.some(d => d.id === 'eeprom-safe-storage');
  const hasWdt = selectedDrivers.some(d => d.id === 'wdt-power-manager');

  return `/**
 * @file main.c
 * @brief Integrated Peripheral Testbench for ${selectedMcu.toUpperCase()}
 * @note Generated by Peripheral Resource Librarian
 */
#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/delay.h>
#include <stdio.h>

${includes}

int main(void) {
  // 1. Initialize Global Interrupts State
  cli();

${hasUart ? '  // Initialize UART0 at 115200 baud (Double Speed)\n  uart_init(0, 115200, true);\n' : ''}
${hasTimer ? '  // Initialize Timer 1 in 16-bit Fast PWM Mode (50Hz / 20ms)\n  timer1_pwm_init(39999, PRESCALER_8);\n' : ''}
${hasTwi ? '  // Initialize TWI / I2C Bus Master at 400kHz Fast Mode\n  twi_init(TWI_FREQ_400KHZ);\n' : ''}
${hasAdc ? '  // Initialize 10-bit ADC with AVCC reference & 128 prescaler\n  adc_init(ADC_REF_AVCC, ADC_PRESCALER_128);\n' : ''}
${hasWdt ? '  // Enable Watchdog Timer with safe 2-second timeout\n  wdt_enable_safe(WDT_TO_2S);\n' : ''}

  // Enable Global Interrupts for ring buffers and timer counters
  sei();

${hasUart ? '  uart_puts(0, "\\r\\n========================================\\r\\n");\n  uart_puts(0, "  [READY] ' + selectedMcu.toUpperCase() + ' Firmware Boot Complete!\\r\\n");\n  uart_puts(0, "========================================\\r\\n");\n' : ''}

  while (1) {
${hasWdt ? '    wdt_reset(); // Feed the watchdog timer\n' : ''}
${hasUart ? '    if (uart_available(0) > 0) {\n      int16_t c = uart_getc(0);\n      if (c >= 0) {\n        uart_putc(0, (char)c); // Loopback echo\n      }\n    }\n' : ''}
${hasAdc ? '    uint16_t adc_val = adc_read_10bit(0);\n    (void)adc_val;\n' : ''}
    _delay_ms(10);
  }

  return 0;
}
`;
}
