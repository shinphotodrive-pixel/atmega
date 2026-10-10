export interface ResourceItem {
  id: string;
  type: 'github' | 'youtube' | 'doc';
  mcuCategory: 'all' | 'atmega640' | 'atmega128' | 'atmega328p' | 'stm32' | 'pic' | '8051' | 'cross_arch';
  title: string;
  url: string;
  badge: string;
  category: string;
  desc: string;
  tag: string;
  starsOrDuration?: string;
  features: string[];
}

export const RESOURCES: ResourceItem[] = [
  // MegaCore & 640
  {
    id: 'res-megacore',
    type: 'github',
    mcuCategory: 'atmega640',
    title: 'MCUdude/MegaCore',
    url: 'https://github.com/MCUdude/MegaCore',
    badge: 'Arduino Core Framework',
    category: 'core',
    desc: 'ATmega640, ATmega1280, ATmega2560 등 100핀/64핀 계열을 위한 최고 수준의 Arduino 서드파티 하드웨어 코어. Urboot 및 100핀 물리 핀 1:1 매핑을 완벽 지원합니다.',
    tag: 'ATmega640/2560 코어',
    starsOrDuration: '★ 1.8k',
    features: ['100핀 TQFP 전체 86개 I/O 핀 노출', 'Urboot / Optiboot 초소형 부트로더 내장', 'BOD 및 0.5~20MHz 커스텀 클럭']
  },
  {
    id: 'res-bootloader-640',
    type: 'github',
    mcuCategory: 'atmega640',
    title: 'Daniel-dk/Atmega640_arduino_bootloader',
    url: 'https://github.com/Daniel-dk/Atmega640_arduino_bootloader',
    badge: 'Custom Bootloader',
    category: 'bootloader',
    desc: 'ATmega2560 폼팩터 보드를 ATmega640으로 핀투핀(Pin-to-Pin) 교체하여 단가를 절감할 때 소스 변경 없이 즉시 플래싱 가능한 브리지 부트로더입니다.',
    tag: '640 다운그레이드 양산',
    starsOrDuration: '★ 85+',
    features: ['2560 PCB 아트워크 그대로 사용', 'UART0 기반 자동 보드레이트 감지', 'STK500v1 프로토콜 호환']
  },

  // ATmega128 Specialized
  {
    id: 'res-m128-core',
    type: 'github',
    mcuCategory: 'atmega128',
    title: 'MCUdude/MegaCore (ATmega128/128A 지원)',
    url: 'https://github.com/MCUdude/MegaCore',
    badge: 'Hardware Core',
    category: 'core',
    desc: 'ATmega128 및 ATmega128A를 아두이노 IDE 및 VSCode PlatformIO에서 최신 C++17 툴체인으로 빌드할 수 있도록 완벽 포팅된 코어입니다.',
    tag: 'ATmega128 현대화',
    starsOrDuration: '★ 1.8k',
    features: ['M103C 호환성 퓨즈 자동 해제', 'PE0(PDI)/PE1(PDO) ISP 맵 완벽 대응', '53개 I/O 전체 핀 매핑']
  },
  {
    id: 'res-m128-examples',
    type: 'github',
    mcuCategory: 'atmega128',
    title: 'ATmega128 Bare-metal C Driver Collection',
    url: 'https://github.com/microchip-pic-avr-examples',
    badge: 'Driver Library',
    category: 'drivers',
    desc: 'Microchip 공식 제공 ATmega128 정밀 타이머/카운터, 2채널 USART 링버퍼, TWI(I2C) 센서 드라이버 및 외부 인터럽트 예제 모음집.',
    tag: 'ATmega128 정통 C 드라이버',
    starsOrDuration: '★ 520+',
    features: ['레지스터 직접 제어(DDR, PORT, PIN)', '인터럽트 벡터 서비스 루틴(ISR) 템플릿', '외부 메모리 XMEM 버스 초기화']
  },

  // ATmega328P Specialized
  {
    id: 'res-minicore',
    type: 'github',
    mcuCategory: 'atmega328p',
    title: 'MCUdude/MiniCore (ATmega328P 특화)',
    url: 'https://github.com/MCUdude/MiniCore',
    badge: 'Hardware Core',
    category: 'core',
    desc: 'ATmega328P, 328PB, 168, 88을 지원하는 초경량 코어. 내장 8MHz RC 발진기, 32.768kHz RTC 수정, Urboot 부트로더를 완벽 통합 지원합니다.',
    tag: 'ATmega328P 초소형 코어',
    starsOrDuration: '★ 1.5k',
    features: ['내장 8MHz 발진기로 외장 크리스탈 제거', '초소형 256/512바이트 부트로더', 'PB/PicoPower 전력 절감 프리셋']
  },
  {
    id: 'res-optiboot',
    type: 'github',
    mcuCategory: 'atmega328p',
    title: 'Optiboot / Optiboot (Arduino Uno 표준 부트로더)',
    url: 'https://github.com/Optiboot/optiboot',
    badge: 'Standard Bootloader',
    category: 'bootloader',
    desc: '단 512바이트(256워드)의 Flash 공간만 차지하며 115200 bps 고속 업로드를 지원하는 아두이노 우노 공식 초고효율 부트로더입니다.',
    tag: '512B 초소형 부트로더',
    starsOrDuration: '★ 1.9k',
    features: ['512바이트 최소 플래시 점유율', '115200bps 고속 펌웨어 전송', '가상 부트 파티션 지원']
  },

  // Common AVR Tools
  {
    id: 'res-fuse-doctor',
    type: 'github',
    mcuCategory: 'all',
    title: 'SukkoPera/avr-fusebit-doctor',
    url: 'https://github.com/SukkoPera/avr-fusebit-doctor',
    badge: 'Hardware Rescue',
    category: 'utility',
    desc: 'SPIEN 해제, RSTDISBL 설정, 클럭 오설정으로 ISP 다운로드가 불가능해진 ATmega640/128/328P를 12V 고전압 패러럴(HVPP) 펄스로 공장 출하값 복구하는 복구기 프로젝트.',
    tag: '벽돌 복구 오픈소스',
    starsOrDuration: '★ 940+',
    features: ['12V 고전압 패러럴(HVPP) 시퀀스 구현', '딥 브릭(Deep Brick) MCU 자동 복구', '원클릭 퓨즈 리셋 펌웨어']
  },
  {
    id: 'res-avrdude',
    type: 'github',
    mcuCategory: 'all',
    title: 'avrdudes/avrdude (차세대 AVR 다운로더)',
    url: 'https://github.com/avrdudes/avrdude',
    badge: 'Official Tool',
    category: 'tool',
    desc: '전 세계 표준 AVR ISP 프로그래머 유틸리티 최신 v7.x+. ATmega640, 128, 328P를 비롯한 모든 AVR 마이크로컨트롤러의 플래시, EEPROM, 퓨즈 비트 읽기/쓰기/잠금 지원.',
    tag: 'AVR 프로그래밍 표준',
    starsOrDuration: '★ 1.2k',
    features: ['USBasp, STK500, ArduinoISP 드라이버 지원', '터미널 대화형 퓨즈/EEPROM 인스펙터', '최신 멀티플랫폼 CLI']
  },

  // Cross-Architecture: STM32F, PIC, 8051 Tools & References
  {
    id: 'res-stm32-libopencm3',
    type: 'github',
    mcuCategory: 'stm32',
    title: 'libopencm3 / libopencm3 (오픈소스 ARM Cortex-M 라이브러리)',
    url: 'https://github.com/libopencm3/libopencm3',
    badge: 'Open Source Firmware',
    category: 'stm32',
    desc: 'STM32F0, STM32F1 등 ARM Cortex-M 계열을 위해 순수 GPL 오픈소스로 구현된 가벼운 펌웨어 라이브러리. 벤더 종속 없이 완전한 베어메탈 제어가 가능합니다.',
    tag: 'STM32F 베어메탈',
    starsOrDuration: '★ 3.2k',
    features: ['STM32F0/F1 Cortex-M0/M3 완벽 지원', 'GCC arm-none-eabi 툴체인 직결', '초경량 하드웨어 추상화']
  },
  {
    id: 'res-stm32-cube',
    type: 'doc',
    mcuCategory: 'stm32',
    title: 'STMicroelectronics STM32CubeIDE & LL Drivers Reference',
    url: 'https://www.st.com/en/development-tools/stm32cubeide.html',
    badge: 'Official IDE & Tool',
    category: 'stm32',
    desc: 'STM32 공식 통합 개발 환경. 그래픽 핀/클럭 트리 구성기(CubeMX)와 레지스터 수준의 초고속 LL(Low-Layer) 드라이버를 제공합니다.',
    tag: 'STM32 산업 표준 개발툴',
    starsOrDuration: 'Official ST',
    features: ['하드웨어 SWD 2핀 실시간 디버거', 'Cortex-M0/M3 클럭 트리 GUI 설정', 'FreeRTOS 원클릭 통합']
  },
  {
    id: 'res-pic-sdcc-xc8',
    type: 'doc',
    mcuCategory: 'pic',
    title: 'Microchip MPLAB X IDE & XC8 C Compiler Reference',
    url: 'https://www.microchip.com/en-us/tools-resources/develop/mplab-xc-compilers',
    badge: 'Official Compiler',
    category: 'pic',
    desc: 'PIC16F, PIC18F 마이크로컨트롤러의 정식 C 컴파일러. 고신뢰성 가전 및 자동차 전장 펌웨어 개발 시 사용되는 산업 표준 도구입니다.',
    tag: 'Microchip PIC 개발도구',
    starsOrDuration: 'Official Microchip',
    features: ['PIC16/PIC18 RISC 아키텍처 최적화', 'MCC(MPLAB Code Configurator) GUI 연동', 'ICSP 5핀 프로그래밍 & 디버깅']
  },
  {
    id: 'res-8051-sdcc',
    type: 'github',
    mcuCategory: '8051',
    title: 'SDCC - Small Device C Compiler (8051 오픈소스 C 컴파일러)',
    url: 'https://github.com/freepascal/sdcc',
    badge: 'Open Source Compiler',
    category: '8051',
    desc: 'Intel 8051 아키텍처 및 파생 칩셋(AT89S52, STC8, Silabs)을 위한 오픈소스 ANSI-C 컴파일러. Keil 라이선스 없이도 8051 펌웨어를 리눅스/윈도우에서 무료 빌드 가능합니다.',
    tag: '8051 오픈소스 C 컴파일러',
    starsOrDuration: '★ 1.1k',
    features: ['표준 8051 및 1T 고속 코어 지원', '__data, __xdata, __code 메모리 수식자 지원', 'make 및 CMake 빌드 자동화']
  },

  // YouTube Deep Dive Video Tutorials
  {
    id: 'res-yt-timer',
    type: 'youtube',
    mcuCategory: 'all',
    title: 'Low Level Learning - AVR Hardware Timers & CTC Mode in C',
    url: 'https://www.youtube.com/watch?v=cAui801hZz4',
    badge: 'Video Tutorial',
    category: 'video',
    desc: '하드웨어 타이머 카운터(TCNT1), 비교 레지스터(OCR1A), CTC 모드의 내부 하드웨어 비교기 동작 및 ISR 루틴을 어셈블리와 C 언어로 해설합니다.',
    tag: 'AVR 타이머 마스터',
    starsOrDuration: '18:42',
    features: ['16비트 임시 버퍼 TEMP 작동 원리', 'CTC 인터럽트 발생 타이밍', '분주비(Prescaler) 계산 공식']
  },
  {
    id: 'res-yt-twi',
    type: 'youtube',
    mcuCategory: 'all',
    title: 'Engineering Funda - I2C / TWI Register Bare-metal Programming',
    url: 'https://www.youtube.com/watch?v=XSP6WyK-Kh0',
    badge: 'Video Tutorial',
    category: 'video',
    desc: 'TWBR, TWSR, TWCR, TWDR 레지스터를 직접 비트 제어하여 외부 라이브러리 없이 순수 베어메탈 마스터-슬레이브 I2C 핸드셰이킹 루틴을 구현하는 실전 강의입니다.',
    tag: 'I2C/TWI 프로그래밍',
    starsOrDuration: '22:15',
    features: ['START / ACK / NACK 상태 코드 판독', 'TWBR 보드레이트 레지스터 설정', '버스 홀드 및 타임아웃 방지']
  },
  {
    id: 'res-yt-usart',
    type: 'youtube',
    mcuCategory: 'all',
    title: 'Joel Castillo - USART Serial Communication Deep Dive',
    url: 'https://www.youtube.com/watch?v=KnyyQujvcBo',
    badge: 'Video Tutorial',
    category: 'video',
    desc: 'USART 통신의 프레임 포맷(8N1), 보드레이트 오차율 산출, 원형 큐(Circular Ring Buffer)를 통한 인터럽트 기반 무손실 수신 버퍼 설계를 다룹니다.',
    tag: 'USART 신뢰성 설계',
    starsOrDuration: '29:50',
    features: ['링 버퍼(Ring Buffer) 인터럽트 수신', 'UBRR 오차율 계산 및 패리티 비트', 'U2X 배속 모드 활용법']
  },
  {
    id: 'res-yt-328-registers',
    type: 'youtube',
    mcuCategory: 'atmega328p',
    title: 'Bitwise Operations & Port Registers on ATmega328P',
    url: 'https://www.youtube.com/watch?v=6qXmGoX3bYc',
    badge: 'Video Tutorial',
    category: 'video',
    desc: '아두이노 digitalWrite() 대신 DDRD, PORTD 직접 레지스터 비트 조작으로 실행 속도를 50배 이상 단축시키는 ATmega328P 최적화 테크닉입니다.',
    tag: 'ATmega328P 고속 I/O',
    starsOrDuration: '14:28',
    features: ['digitalWrite vs Direct Port Access', '단 62.5ns 초고속 핀 토글', 'PINx 하드웨어 토글 트릭']
  }
];
