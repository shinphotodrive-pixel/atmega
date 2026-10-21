import fs from 'fs';
import path from 'path';
import {
  MCU_DIAGRAM_MAP,
  McuDiagramProfile,
  BADGE_STYLES,
  BadgeType
} from '../src/data/pinoutDiagramData';

function generateSvgForMcu(profile: McuDiagramProfile): string {
  const isLight = true;
  const bgColor = '#FFFFFF';
  const gridLineColor = '#E2E8F0';
  const icBodyColor = '#18181B';
  const icBorderColor = '#27272A';
  const leadWireColor = '#94A3B8';
  const pinLegColor = '#CBD5E1';

  const leftPins = profile.pins.filter((p) => p.side === 'left');
  const rightPins = profile.pins.filter((p) => p.side === 'right');

  const rowCount = Math.max(leftPins.length, rightPins.length);
  const rowHeight = profile.id === 'atmega640' ? 24 : profile.id === 'atmega128' ? 28 : 36;
  const chipWidth = profile.id === 'atmega328p' ? 140 : 160;
  const chipHeight = rowCount * rowHeight + 40;

  const sideWidth = profile.id === 'atmega640' ? 440 : profile.id === 'atmega128' ? 420 : 380;
  const canvasWidth = sideWidth * 2 + chipWidth + 120;
  const headerHeight = 160;
  const footerHeight = 70;
  const canvasHeight = headerHeight + chipHeight + footerHeight;

  const chipX = (canvasWidth - chipWidth) / 2;
  const chipY = headerHeight + 20;

  let leftPinsSvg = '';
  leftPins.forEach((pin, idx) => {
    const yPos = chipY + 24 + idx * rowHeight;
    const pinLegX = chipX - 14;
    const solderDotX = pinLegX - 6;
    const wireEndX = chipX - 40;

    let badgesSvg = '';
    let currentRightX = wireEndX - 4;
    const badgeHeight = Math.min(rowHeight - 6, 20);

    [...pin.badges].reverse().forEach((badge) => {
      const style = BADGE_STYLES[badge.type];
      const charLen = badge.text.length;
      const badgeWidth = Math.max(charLen * 7 + 12, 34);
      const badgeX = currentRightX - badgeWidth;
      currentRightX -= badgeWidth + 4;

      badgesSvg += `
        <rect x="${badgeX}" y="${yPos - badgeHeight / 2}" width="${badgeWidth}" height="${badgeHeight}" fill="${style.bg}" stroke="${style.border}" stroke-width="1" rx="3" />
        <text x="${badgeX + badgeWidth / 2}" y="${yPos + 3.5}" fill="${style.text}" font-size="${badgeHeight < 16 ? 8 : 9}" font-weight="bold" text-anchor="middle">${badge.text}</text>
      `;
    });

    leftPinsSvg += `
      <g id="pin-${pin.pinNumber}">
        <rect x="${pinLegX}" y="${yPos - 3.5}" width="14" height="7" fill="${pinLegColor}" stroke="#475569" stroke-width="0.6" rx="1" />
        <text x="${chipX + 12}" y="${yPos + 3.5}" fill="#FFFFFF" font-size="${rowHeight < 28 ? 9 : 10}" font-weight="bold" text-anchor="middle">${pin.pinNumber}</text>
        <circle cx="${solderDotX}" cy="${yPos}" r="2.5" fill="#334155" stroke="${leadWireColor}" stroke-width="1" />
        <line x1="${solderDotX}" y1="${yPos}" x2="${wireEndX}" y2="${yPos}" stroke="${leadWireColor}" stroke-width="1.2" />
        ${badgesSvg}
      </g>
    `;
  });

  let rightPinsSvg = '';
  rightPins.forEach((pin, idx) => {
    const yPos = chipY + 24 + idx * rowHeight;
    const pinLegX = chipX + chipWidth;
    const solderDotX = pinLegX + 20;
    const wireStartX = solderDotX;
    const wireEndX = chipX + chipWidth + 40;

    let badgesSvg = '';
    let currentLeftX = wireEndX + 4;
    const badgeHeight = Math.min(rowHeight - 6, 20);

    pin.badges.forEach((badge) => {
      const style = BADGE_STYLES[badge.type];
      const charLen = badge.text.length;
      const badgeWidth = Math.max(charLen * 7 + 12, 34);
      const badgeX = currentLeftX;
      currentLeftX += badgeWidth + 4;

      badgesSvg += `
        <rect x="${badgeX}" y="${yPos - badgeHeight / 2}" width="${badgeWidth}" height="${badgeHeight}" fill="${style.bg}" stroke="${style.border}" stroke-width="1" rx="3" />
        <text x="${badgeX + badgeWidth / 2}" y="${yPos + 3.5}" fill="${style.text}" font-size="${badgeHeight < 16 ? 8 : 9}" font-weight="bold" text-anchor="middle">${badge.text}</text>
      `;
    });

    rightPinsSvg += `
      <g id="pin-${pin.pinNumber}">
        <rect x="${pinLegX}" y="${yPos - 3.5}" width="14" height="7" fill="${pinLegColor}" stroke="#475569" stroke-width="0.6" rx="1" />
        <text x="${chipX + chipWidth - 12}" y="${yPos + 3.5}" fill="#FFFFFF" font-size="${rowHeight < 28 ? 9 : 10}" font-weight="bold" text-anchor="middle">${pin.pinNumber}</text>
        <circle cx="${solderDotX}" cy="${yPos}" r="2.5" fill="#334155" stroke="${leadWireColor}" stroke-width="1" />
        <line x1="${wireStartX}" y1="${yPos}" x2="${wireEndX}" y2="${yPos}" stroke="${leadWireColor}" stroke-width="1.2" />
        ${badgesSvg}
      </g>
    `;
  });

  const legendItems = [
    { type: 'gnd', label: 'GND' },
    { type: 'power', label: 'POWER' },
    { type: 'control', label: 'CONTROL' },
    { type: 'port', label: 'PORT PIN' },
    { type: 'func', label: `${profile.chipLabel.split('P')[0]} PIN FUNC` },
    { type: 'digital', label: 'DIGITAL PIN' },
    { type: 'analog', label: 'ANALOG-RELATED PIN' },
    { type: 'pwm', label: 'PWM PIN' },
    { type: 'serial', label: 'SERIAL PIN' }
  ] as { type: BadgeType; label: string }[];

  let legendSvg = '';
  legendItems.forEach((item, idx) => {
    const style = BADGE_STYLES[item.type];
    const yPos = 24 + idx * 14;
    legendSvg += `
      <g transform="translate(0, ${yPos})">
        <rect x="0" y="0" width="160" height="13" fill="${style.bg}" stroke="${style.border}" stroke-width="0.8" rx="1" />
        <text x="80" y="9.5" fill="${style.text}" font-size="8.5" font-weight="bold" text-anchor="middle" letter-spacing="0.5">${item.label}</text>
      </g>
    `;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg" style="background-color: ${bgColor}; font-family: Consolas, Menlo, Monaco, 'Courier New', monospace;">
  <defs>
    <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="${gridLineColor}" stroke-width="0.5" stroke-opacity="0.4" />
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#gridPattern)" />

  <!-- Legend -->
  <g transform="translate(30, 25)">
    <rect x="0" y="0" width="160" height="22" fill="#18181B" rx="2" />
    <text x="80" y="15" fill="#FFFFFF" font-size="10" font-weight="bold" text-anchor="middle" letter-spacing="1">LEGEND</text>
    ${legendSvg}
  </g>

  <!-- Title Top Right -->
  <g transform="translate(${canvasWidth - 30}, 30)">
    <text x="0" y="0" fill="#475569" font-size="9.5" font-weight="bold" text-anchor="end" letter-spacing="1.5">THE</text>
    <text x="0" y="12" fill="#475569" font-size="9.5" font-weight="bold" text-anchor="end" letter-spacing="1.5">UNOFFICIAL</text>
    <text x="0" y="30" fill="#0F172A" font-size="18" font-weight="900" text-anchor="end">${profile.id === 'atmega328p' ? 'ARDUINO' : 'EMBEDDED AVR'}</text>
    <rect x="-72" y="34" width="14" height="12" fill="#FACC15" stroke="#CA8A04" stroke-width="0.5" rx="1" />
    <text x="-65" y="43" fill="#713F12" font-size="9" font-weight="bold" text-anchor="middle">&amp;</text>
    <text x="0" y="44" fill="#0F172A" font-size="18" font-weight="900" text-anchor="end">${profile.chipLabel}</text>
    <rect x="-125" y="50" width="125" height="14" fill="#1E293B" rx="2" />
    <text x="-62.5" y="60.5" fill="#FFFFFF" font-size="7.5" font-weight="bold" text-anchor="middle" letter-spacing="1">PINOUT DIAGRAM</text>
    <text x="0" y="78" fill="#64748B" font-size="8.5" font-weight="bold" text-anchor="end">Package: ${profile.packageType}</text>
  </g>

  <!-- Center IC Chip -->
  <g transform="translate(${chipX}, ${chipY})">
    <rect x="0" y="0" width="${chipWidth}" height="${chipHeight}" fill="${icBodyColor}" stroke="${icBorderColor}" stroke-width="2.5" rx="6" />
    <path d="M ${chipWidth / 2 - 16} 0 A 16 16 0 0 0 ${chipWidth / 2 + 16} 0 Z" fill="#27272A" stroke="${icBorderColor}" stroke-width="1.5" />
    <circle cx="16" cy="20" r="4" fill="#3F3F46" stroke="#52525B" stroke-width="1" />
    <g transform="translate(${chipWidth / 2}, ${chipHeight / 2}) rotate(-90)">
      <text x="0" y="6" fill="#FFFFFF" font-size="${profile.id === 'atmega640' ? 20 : 22}" font-weight="900" text-anchor="middle" letter-spacing="4">${profile.chipLabel}</text>
    </g>
    <text x="${chipWidth / 2}" y="${chipHeight - 16}" fill="#71717A" font-size="8" font-weight="bold" text-anchor="middle" letter-spacing="1">${profile.totalPins}-PIN AVR</text>
  </g>

  <!-- Left Pins -->
  ${leftPinsSvg}

  <!-- Right Pins -->
  ${rightPinsSvg}

  <!-- Footer -->
  <g transform="translate(${canvasWidth - 30}, ${canvasHeight - 25})">
    <text x="0" y="0" fill="#64748B" font-size="8" font-weight="bold" text-anchor="end">Pighixxx Style Pinout Reference • AVR Firmware Hub</text>
    <text x="0" y="11" fill="#94A3B8" font-size="7.5" text-anchor="end">CC BY-SA 4.0 • Microchip ATmega Datasheet Grounded</text>
  </g>
  <g transform="translate(30, ${canvasHeight - 35})">
    <text x="0" y="0" fill="#334155" font-size="8.5" font-weight="bold">Total ${profile.totalPins} Pins • ${profile.packageType}</text>
  </g>
</svg>`;
}

const outDir = path.resolve('public');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

for (const [mcuId, profile] of Object.entries(MCU_DIAGRAM_MAP)) {
  const svg = generateSvgForMcu(profile);
  const filePath = path.join(outDir, `pinout_${mcuId}.svg`);
  fs.writeFileSync(filePath, svg, 'utf-8');
  console.log(`Generated: ${filePath}`);
}

console.log('All pinout SVG assets generated successfully!');
