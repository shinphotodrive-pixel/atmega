import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  MCU_DIAGRAM_MAP,
  McuDiagramProfile,
  DiagramPin,
  BADGE_STYLES,
  BadgeType
} from '../data/pinoutDiagramData';
import { SupportedMCU, MCU_PROFILES } from '../data/pinmapData';
import {
  Cpu,
  Download,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Info,
  Layers,
  Copy,
  Check,
  Eye,
  Sliders,
  Maximize2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Props {
  selectedMCU: SupportedMCU;
  onSelectMCU?: (mcu: SupportedMCU) => void;
  onNavigateToPin?: (pinName: string) => void;
}

export const PinoutDiagramViewer: React.FC<Props> = ({
  selectedMCU,
  onSelectMCU,
  onNavigateToPin
}) => {
  const [activeMcu, setActiveMcu] = useState<SupportedMCU>(selectedMCU);
  const [activeLayout, setActiveLayout] = useState<'pighixxx_dual' | 'quad_qfp'>('pighixxx_dual');
  const [colorTheme, setColorTheme] = useState<'classic_light' | 'tech_dark'>('classic_light');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterBadgeType, setFilterBadgeType] = useState<BadgeType | 'all'>('all');
  const [selectedPin, setSelectedPin] = useState<DiagramPin | null>(null);
  const [hoveredPin, setHoveredPin] = useState<DiagramPin | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Sync with prop when selectedMCU changes externally
  useEffect(() => {
    setActiveMcu(selectedMCU);
  }, [selectedMCU]);

  const profile: McuDiagramProfile = useMemo(() => {
    return MCU_DIAGRAM_MAP[activeMcu] || MCU_DIAGRAM_MAP.atmega328p;
  }, [activeMcu]);

  const handleMcuSwitch = (mcu: SupportedMCU) => {
    setActiveMcu(mcu);
    setSelectedPin(null);
    setHoveredPin(null);
    if (onSelectMCU) {
      onSelectMCU(mcu);
    }
  };

  // Dimensions based on pin count
  const isLight = colorTheme === 'classic_light';
  const bgColor = isLight ? '#FFFFFF' : '#0B1120';
  const gridLineColor = isLight ? '#E2E8F0' : '#1E293B';
  const textColor = isLight ? '#0F172A' : '#F8FAFC';
  const icBodyColor = isLight ? '#18181B' : '#090D16';
  const icBorderColor = isLight ? '#27272A' : '#334155';
  const leadWireColor = isLight ? '#94A3B8' : '#475569';
  const pinLegColor = isLight ? '#CBD5E1' : '#64748B';

  const leftPins = useMemo(() => profile.pins.filter((p) => p.side === 'left'), [profile]);
  const rightPins = useMemo(() => profile.pins.filter((p) => p.side === 'right'), [profile]);

  const rowCount = Math.max(leftPins.length, rightPins.length);
  const rowHeight = activeMcu === 'atmega640' ? 24 : activeMcu === 'atmega128' ? 28 : 36;
  const chipWidth = activeMcu === 'atmega328p' ? 140 : 160;
  const chipHeight = rowCount * rowHeight + 40;

  // Total canvas dimensions for Dual-Column Pighixxx layout
  const sideWidth = activeMcu === 'atmega640' ? 440 : activeMcu === 'atmega128' ? 420 : 380;
  const canvasWidth = sideWidth * 2 + chipWidth + 120;
  const headerHeight = 160;
  const footerHeight = 70;
  const canvasHeight = headerHeight + chipHeight + footerHeight;

  const chipX = (canvasWidth - chipWidth) / 2;
  const chipY = headerHeight + 20;

  // Matching check
  const isPinMatched = (pin: DiagramPin) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesFilter =
      filterBadgeType === 'all' || pin.badges.some((b) => b.type === filterBadgeType);
    if (!matchesFilter) return false;
    if (!q) return true;

    return (
      pin.label.toLowerCase().includes(q) ||
      (pin.port && pin.port.toLowerCase().includes(q)) ||
      (pin.arduino && pin.arduino.toLowerCase().includes(q)) ||
      pin.desc.toLowerCase().includes(q) ||
      pin.badges.some((b) => b.text.toLowerCase().includes(q))
    );
  };

  // High-Resolution PNG Download
  const handleDownloadPNG = () => {
    if (!svgRef.current) return;

    try {
      const svgElement = svgRef.current;
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL;
      const blobURL = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const scale = 2.5; // High-resolution retina scale
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth * scale;
        canvas.height = canvasHeight * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);

        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `${profile.id}_pinout_diagram_pighixxx.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(blobURL);

        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.2 }
        });
        setCopiedStatus('png');
        setTimeout(() => setCopiedStatus(null), 2500);
      };
      img.src = blobURL;
    } catch (e) {
      console.error('PNG export failed', e);
    }
  };

  // Vector SVG Download
  const handleDownloadSVG = () => {
    if (!svgRef.current) return;
    const svgString = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${profile.id}_pinout_diagram_pighixxx.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setCopiedStatus('svg');
    setTimeout(() => setCopiedStatus(null), 2500);
  };

  // Copy SVG string
  const handleCopySVG = () => {
    if (!svgRef.current) return;
    const svgString = new XMLSerializer().serializeToString(svgRef.current);
    navigator.clipboard.writeText(svgString);
    setCopiedStatus('copy');
    setTimeout(() => setCopiedStatus(null), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-2xl space-y-6">
      {/* Top Header & MCU Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Pighixxx 스타일 고해상도 공식 핀아웃 다이어그램 뷰어
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>{profile.name} 하드웨어 핀아웃 다이어그램 (Pinout Diagram)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            전통적인 Pighixxx 인포그래픽 표준 규격에 맞추어 <strong>ATmega328P(28-DIP)</strong>,{' '}
            <strong>ATmega128(64-TQFP)</strong>, <strong>ATmega640(100-TQFP)</strong>의 모든 물리 핀,
            포트, 대체 기능, 아두이노 매핑을 시각화하고 고해상도 이미지(PNG/SVG)로 다운로드할 수 있습니다.
          </p>
        </div>

        {/* Action Buttons: Export PNG / SVG */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadPNG}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20"
            title="고해상도 2.5x 레티나 PNG 이미지 파일로 저장"
          >
            {copiedStatus === 'png' ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            <span>{copiedStatus === 'png' ? '저장 완료!' : '고해상도 PNG 다운로드'}</span>
          </button>
          <button
            onClick={handleDownloadSVG}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-all flex items-center gap-1.5"
            title="확대해도 깨지지 않는 벡터 SVG 파일로 저장"
          >
            {copiedStatus === 'svg' ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            <span>{copiedStatus === 'svg' ? 'SVG 다운로드됨' : '벡터 SVG 다운로드'}</span>
          </button>
          <button
            onClick={handleCopySVG}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-950 border border-slate-800 text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
            title="SVG 소스 코드 클립보드 복사"
          >
            {copiedStatus === 'copy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedStatus === 'copy' ? '복사됨!' : 'SVG 복사'}</span>
          </button>
          <a
            href={`/pinout_${profile.id}.svg`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-950 border border-slate-800 text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
            title="독립 SVG 원본 이미지 새 창에서 열기"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>이미지 직접 보기</span>
          </a>
        </div>
      </div>

      {/* MCU Switcher Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-1">
            <Cpu className="w-4 h-4 text-amber-400" /> 대상 MCU 선택:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => {
              const isSelected = activeMcu === mcuId;
              const mcuName = MCU_DIAGRAM_MAP[mcuId].name;
              const pkgName = MCU_DIAGRAM_MAP[mcuId].packageType.split(' ')[0];
              return (
                <button
                  key={mcuId}
                  onClick={() => handleMcuSwitch(mcuId)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {mcuName} ({pkgName})
                </button>
              );
            })}
          </div>
        </div>

        {/* Theme & Zoom Controls */}
        <div className="flex items-center gap-2 text-xs">
          {/* Theme Toggle */}
          <div className="flex items-center border border-slate-800 rounded-lg overflow-hidden bg-slate-900">
            <button
              onClick={() => setColorTheme('classic_light')}
              className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                isLight ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              화이트 (원본 스타일)
            </button>
            <button
              onClick={() => setColorTheme('tech_dark')}
              className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                !isLight ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              다크 블루프린트
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border border-slate-800 rounded-lg p-0.5 bg-slate-900 text-slate-300">
            <button
              onClick={() => setZoomScale((z) => Math.max(0.6, z - 0.15))}
              className="p-1 hover:text-white transition-colors"
              title="축소"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono text-[11px]">{Math.round(zoomScale * 100)}%</span>
            <button
              onClick={() => setZoomScale((z) => Math.min(1.8, z + 0.15))}
              className="p-1 hover:text-white transition-colors"
              title="확대"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomScale(1)}
              className="p-1 hover:text-white transition-colors"
              title="100% 초기화"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/60">
        <div className="md:col-span-4 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="핀 검색 (예: SCL, PWM, ADC, RESET, RXD...)"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Legend Filter Bar */}
        <div className="md:col-span-8 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
            <Sliders className="w-3.5 h-3.5 text-amber-400" /> 배지 하이라이트:
          </span>
          <button
            onClick={() => setFilterBadgeType('all')}
            className={`px-2 py-0.5 text-[11px] rounded transition-all border ${
              filterBadgeType === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            전체 표시
          </button>
          {(Object.entries(BADGE_STYLES) as [BadgeType, typeof BADGE_STYLES[BadgeType]][]).map(
            ([typeKey, style]) => {
              const isSelected = filterBadgeType === typeKey;
              return (
                <button
                  key={typeKey}
                  onClick={() => setFilterBadgeType(isSelected ? 'all' : typeKey)}
                  style={{
                    backgroundColor: isSelected ? style.bg : undefined,
                    color: isSelected ? style.text : undefined,
                    borderColor: isSelected ? style.border : undefined
                  }}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded transition-all border flex items-center gap-1 ${
                    isSelected
                      ? 'shadow-md scale-105'
                      : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: style.bg, border: `1px solid ${style.border}` }}
                  />
                  <span>{style.label.split(' ')[0]}</span>
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* Main SVG Diagram Container with Horizontal & Vertical Scroll */}
      <div className="relative border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-inner">
        {/* Floating Controls Overlay */}
        <div className="absolute top-3 right-3 z-10 bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300 flex items-center gap-2 shadow-lg">
          <span className="font-bold text-amber-400">{profile.name}</span>
          <span className="text-slate-500">•</span>
          <span>{profile.packageType}</span>
          <span className="text-slate-500">•</span>
          <span>{profile.totalPins} Pins</span>
        </div>

        {/* Scrollable Canvas Viewport */}
        <div className="overflow-auto max-h-[720px] p-4 flex justify-center bg-slate-950/80">
          <div
            style={{
              transform: `scale(${zoomScale})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out'
            }}
          >
            <svg
              ref={svgRef}
              width={canvasWidth}
              height={canvasHeight}
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              xmlns="http://www.w3.org/2000/svg"
              className="rounded-lg shadow-2xl transition-all"
              style={{
                backgroundColor: bgColor,
                fontFamily: 'Consolas, Menlo, Monaco, "Courier New", monospace'
              }}
            >
              {/* Background Grid Pattern */}
              <defs>
                <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path
                    d="M 20 0 L 0 0 0 20"
                    fill="none"
                    stroke={gridLineColor}
                    strokeWidth="0.5"
                    strokeOpacity="0.4"
                  />
                </pattern>
                {/* Glow Filter for Highlights */}
                <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <rect width="100%" height="100%" fill="url(#gridPattern)" />

              {/* ------------------------------------------------------------- */}
              {/* Top Header Section */}
              {/* ------------------------------------------------------------- */}

              {/* Top-Left: LEGEND BOX (Matching Pighixxx Exact Style) */}
              <g transform="translate(30, 25)">
                {/* Legend Header */}
                <rect x="0" y="0" width="160" height="22" fill="#18181B" rx="2" />
                <text
                  x="80"
                  y="15"
                  fill="#FFFFFF"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                  letterSpacing="1"
                >
                  LEGEND
                </text>

                {/* Stack of Legend Items */}
                {(
                  [
                    { type: 'gnd', label: 'GND' },
                    { type: 'power', label: 'POWER' },
                    { type: 'control', label: 'CONTROL' },
                    { type: 'port', label: 'PORT PIN' },
                    { type: 'func', label: `${profile.chipLabel.split('P')[0]} PIN FUNC` },
                    { type: 'digital', label: 'DIGITAL PIN' },
                    { type: 'analog', label: 'ANALOG-RELATED PIN' },
                    { type: 'pwm', label: 'PWM PIN' },
                    { type: 'serial', label: 'SERIAL PIN' }
                  ] as { type: BadgeType; label: string }[]
                ).map((item, idx) => {
                  const style = BADGE_STYLES[item.type];
                  const yPos = 24 + idx * 14;
                  return (
                    <g key={item.type} transform={`translate(0, ${yPos})`}>
                      <rect
                        x="0"
                        y="0"
                        width="160"
                        height="13"
                        fill={style.bg}
                        stroke={style.border}
                        strokeWidth="0.8"
                        rx="1"
                      />
                      <text
                        x="80"
                        y="9.5"
                        fill={style.text}
                        fontSize="8.5"
                        fontWeight="bold"
                        textAnchor="middle"
                        letterSpacing="0.5"
                      >
                        {item.label}
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* Top-Right: THE UNOFFICIAL ARDUINO & ATMEGA PINOUT DIAGRAM */}
              <g transform={`translate(${canvasWidth - 30}, 30)`}>
                <text
                  x="0"
                  y="0"
                  fill={isLight ? '#475569' : '#94A3B8'}
                  fontSize="9.5"
                  fontWeight="bold"
                  textAnchor="end"
                  letterSpacing="1.5"
                >
                  THE
                </text>
                <text
                  x="0"
                  y="12"
                  fill={isLight ? '#475569' : '#94A3B8'}
                  fontSize="9.5"
                  fontWeight="bold"
                  textAnchor="end"
                  letterSpacing="1.5"
                >
                  UNOFFICIAL
                </text>
                <text
                  x="0"
                  y="30"
                  fill={isLight ? '#0F172A' : '#FFFFFF'}
                  fontSize="18"
                  fontWeight="900"
                  textAnchor="end"
                  letterSpacing="0.5"
                >
                  {profile.id === 'atmega328p' ? 'ARDUINO' : 'EMBEDDED AVR'}
                </text>
                {/* Yellow Box for & */}
                <rect
                  x="-72"
                  y="34"
                  width="14"
                  height="12"
                  fill="#FACC15"
                  stroke="#CA8A04"
                  strokeWidth="0.5"
                  rx="1"
                />
                <text
                  x="-65"
                  y="43"
                  fill="#713F12"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  &
                </text>
                <text
                  x="0"
                  y="44"
                  fill={isLight ? '#0F172A' : '#FFFFFF'}
                  fontSize="18"
                  fontWeight="900"
                  textAnchor="end"
                >
                  {profile.chipLabel}
                </text>

                {/* Subtitle Badge */}
                <rect
                  x="-125"
                  y="50"
                  width="125"
                  height="14"
                  fill="#1E293B"
                  rx="2"
                />
                <text
                  x="-62.5"
                  y="60.5"
                  fill="#FFFFFF"
                  fontSize="7.5"
                  fontWeight="bold"
                  textAnchor="middle"
                  letterSpacing="1"
                >
                  PINOUT DIAGRAM
                </text>

                {/* Package Spec Tag */}
                <text
                  x="0"
                  y="78"
                  fill={isLight ? '#64748B' : '#94A3B8'}
                  fontSize="8.5"
                  fontWeight="bold"
                  textAnchor="end"
                >
                  Package: {profile.packageType}
                </text>
              </g>

              {/* ------------------------------------------------------------- */}
              {/* Center IC Chip Package (DIP or Quad Slim Center) */}
              {/* ------------------------------------------------------------- */}
              <g transform={`translate(${chipX}, ${chipY})`}>
                {/* Chip Body */}
                <rect
                  x="0"
                  y="0"
                  width={chipWidth}
                  height={chipHeight}
                  fill={icBodyColor}
                  stroke={icBorderColor}
                  strokeWidth="2.5"
                  rx="6"
                  filter="drop-shadow(0 6px 12px rgba(0,0,0,0.3))"
                />

                {/* Semi-circular Notch at Top */}
                <path
                  d={`M ${chipWidth / 2 - 16} 0 A 16 16 0 0 0 ${chipWidth / 2 + 16} 0 Z`}
                  fill={isLight ? '#27272A' : '#1E293B'}
                  stroke={icBorderColor}
                  strokeWidth="1.5"
                />

                {/* Pin 1 Dot Marker */}
                <circle
                  cx="16"
                  cy="20"
                  r="4"
                  fill={isLight ? '#3F3F46' : '#334155'}
                  stroke="#52525B"
                  strokeWidth="1"
                />

                {/* Vertical Chip Name in Bold White Text */}
                <g transform={`translate(${chipWidth / 2}, ${chipHeight / 2}) rotate(-90)`}>
                  <text
                    x="0"
                    y="6"
                    fill="#FFFFFF"
                    fontSize={activeMcu === 'atmega640' ? '20' : '22'}
                    fontWeight="900"
                    textAnchor="middle"
                    letterSpacing="4"
                  >
                    {profile.chipLabel}
                  </text>
                </g>

                {/* Top/Bottom Details */}
                <text
                  x={chipWidth / 2}
                  y={chipHeight - 16}
                  fill="#71717A"
                  fontSize="8"
                  fontWeight="bold"
                  textAnchor="middle"
                  letterSpacing="1"
                >
                  {profile.totalPins}-PIN AVR
                </text>
              </g>

              {/* ------------------------------------------------------------- */}
              {/* Left Side Pins and Badges */}
              {/* ------------------------------------------------------------- */}
              {leftPins.map((pin, idx) => {
                const yPos = chipY + 24 + idx * rowHeight;
                const matched = isPinMatched(pin);
                const isSelected = selectedPin?.pinNumber === pin.pinNumber;
                const isHovered = hoveredPin?.pinNumber === pin.pinNumber;
                const opacity = matched ? 1 : 0.2;

                // Pin Leg on chip (Silver rectangle extending left)
                const pinLegX = chipX - 14;
                const solderDotX = pinLegX - 6;

                // Wire leading from pin to badges
                const wireEndX = chipX - 40;

                return (
                  <g
                    key={`left-pin-${pin.pinNumber}`}
                    opacity={opacity}
                    cursor="pointer"
                    onClick={() => {
                      setSelectedPin(pin);
                      if (onNavigateToPin && pin.port) {
                        onNavigateToPin(pin.label);
                      }
                    }}
                    onMouseEnter={() => setHoveredPin(pin)}
                    onMouseLeave={() => setHoveredPin(null)}
                    className="transition-opacity duration-150"
                  >
                    {/* Metallic Pin Leg */}
                    <rect
                      x={pinLegX}
                      y={yPos - 3.5}
                      width="14"
                      height="7"
                      fill={isSelected || isHovered ? '#FACC15' : pinLegColor}
                      stroke="#475569"
                      strokeWidth="0.6"
                      rx="1"
                    />

                    {/* Pin Number inside Chip Margin */}
                    <text
                      x={chipX + 12}
                      y={yPos + 3.5}
                      fill="#FFFFFF"
                      fontSize={rowHeight < 28 ? '9' : '10'}
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {pin.pinNumber}
                    </text>

                    {/* Solder / Wire Contact Circle */}
                    <circle
                      cx={solderDotX}
                      cy={yPos}
                      r="2.5"
                      fill={isSelected || isHovered ? '#FACC15' : '#334155'}
                      stroke={leadWireColor}
                      strokeWidth="1"
                    />

                    {/* Trace line extending to badges */}
                    <line
                      x1={solderDotX}
                      y1={yPos}
                      x2={wireEndX}
                      y2={yPos}
                      stroke={isSelected || isHovered ? '#FACC15' : leadWireColor}
                      strokeWidth={isSelected || isHovered ? '2' : '1.2'}
                    />

                    {/* Stack of Badges (Right-to-Left alignment towards the pin) */}
                    {/* Reverse order so that the last badge is closest to the pin */}
                    {(() => {
                      let currentRightX = wireEndX - 4;
                      const badgeHeight = Math.min(rowHeight - 6, 20);

                      return [...pin.badges].reverse().map((badge, bIdx) => {
                        const style = BADGE_STYLES[badge.type];
                        const charLen = badge.text.length;
                        const badgeWidth = Math.max(charLen * 7 + 12, 34);
                        const badgeX = currentRightX - badgeWidth;
                        currentRightX -= badgeWidth + 4;

                        return (
                          <g key={`l-badge-${pin.pinNumber}-${bIdx}`}>
                            <rect
                              x={badgeX}
                              y={yPos - badgeHeight / 2}
                              width={badgeWidth}
                              height={badgeHeight}
                              fill={style.bg}
                              stroke={isSelected || isHovered ? '#FACC15' : style.border}
                              strokeWidth={isSelected || isHovered ? '1.5' : '1'}
                              rx="3"
                              filter={isSelected || isHovered ? 'url(#glowEffect)' : undefined}
                            />
                            <text
                              x={badgeX + badgeWidth / 2}
                              y={yPos + 3.5}
                              fill={style.text}
                              fontSize={badgeHeight < 16 ? '8' : '9'}
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              {badge.text}
                            </text>
                          </g>
                        );
                      });
                    })()}
                  </g>
                );
              })}

              {/* ------------------------------------------------------------- */}
              {/* Right Side Pins and Badges */}
              {/* ------------------------------------------------------------- */}
              {rightPins.map((pin, idx) => {
                const yPos = chipY + 24 + idx * rowHeight;
                const matched = isPinMatched(pin);
                const isSelected = selectedPin?.pinNumber === pin.pinNumber;
                const isHovered = hoveredPin?.pinNumber === pin.pinNumber;
                const opacity = matched ? 1 : 0.2;

                // Pin Leg on chip (Silver rectangle extending right)
                const pinLegX = chipX + chipWidth;
                const solderDotX = pinLegX + 20;
                const wireStartX = solderDotX;
                const wireEndX = chipX + chipWidth + 40;

                return (
                  <g
                    key={`right-pin-${pin.pinNumber}`}
                    opacity={opacity}
                    cursor="pointer"
                    onClick={() => {
                      setSelectedPin(pin);
                      if (onNavigateToPin && pin.port) {
                        onNavigateToPin(pin.label);
                      }
                    }}
                    onMouseEnter={() => setHoveredPin(pin)}
                    onMouseLeave={() => setHoveredPin(null)}
                    className="transition-opacity duration-150"
                  >
                    {/* Metallic Pin Leg */}
                    <rect
                      x={pinLegX}
                      y={yPos - 3.5}
                      width="14"
                      height="7"
                      fill={isSelected || isHovered ? '#FACC15' : pinLegColor}
                      stroke="#475569"
                      strokeWidth="0.6"
                      rx="1"
                    />

                    {/* Pin Number inside Chip Margin */}
                    <text
                      x={chipX + chipWidth - 12}
                      y={yPos + 3.5}
                      fill="#FFFFFF"
                      fontSize={rowHeight < 28 ? '9' : '10'}
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {pin.pinNumber}
                    </text>

                    {/* Solder / Wire Contact Circle */}
                    <circle
                      cx={solderDotX}
                      cy={yPos}
                      r="2.5"
                      fill={isSelected || isHovered ? '#FACC15' : '#334155'}
                      stroke={leadWireColor}
                      strokeWidth="1"
                    />

                    {/* Trace line extending to badges */}
                    <line
                      x1={wireStartX}
                      y1={yPos}
                      x2={wireEndX}
                      y2={yPos}
                      stroke={isSelected || isHovered ? '#FACC15' : leadWireColor}
                      strokeWidth={isSelected || isHovered ? '2' : '1.2'}
                    />

                    {/* Stack of Badges (Left-to-Right alignment away from pin) */}
                    {(() => {
                      let currentLeftX = wireEndX + 4;
                      const badgeHeight = Math.min(rowHeight - 6, 20);

                      return pin.badges.map((badge, bIdx) => {
                        const style = BADGE_STYLES[badge.type];
                        const charLen = badge.text.length;
                        const badgeWidth = Math.max(charLen * 7 + 12, 34);
                        const badgeX = currentLeftX;
                        currentLeftX += badgeWidth + 4;

                        return (
                          <g key={`r-badge-${pin.pinNumber}-${bIdx}`}>
                            <rect
                              x={badgeX}
                              y={yPos - badgeHeight / 2}
                              width={badgeWidth}
                              height={badgeHeight}
                              fill={style.bg}
                              stroke={isSelected || isHovered ? '#FACC15' : style.border}
                              strokeWidth={isSelected || isHovered ? '1.5' : '1'}
                              rx="3"
                              filter={isSelected || isHovered ? 'url(#glowEffect)' : undefined}
                            />
                            <text
                              x={badgeX + badgeWidth / 2}
                              y={yPos + 3.5}
                              fill={style.text}
                              fontSize={badgeHeight < 16 ? '8' : '9'}
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              {badge.text}
                            </text>
                          </g>
                        );
                      });
                    })()}
                  </g>
                );
              })}

              {/* ------------------------------------------------------------- */}
              {/* Footer Section */}
              {/* ------------------------------------------------------------- */}
              <g transform={`translate(${canvasWidth - 30}, ${canvasHeight - 25})`}>
                <text
                  x="0"
                  y="0"
                  fill={isLight ? '#64748B' : '#64748B'}
                  fontSize="8"
                  fontWeight="bold"
                  textAnchor="end"
                >
                  Pighixxx Style Pinout Reference • AVR Firmware Hub
                </text>
                <text
                  x="0"
                  y="11"
                  fill={isLight ? '#94A3B8' : '#475569'}
                  fontSize="7.5"
                  textAnchor="end"
                >
                  CC BY-SA 4.0 • Microchip ATmega Datasheet Grounded
                </text>
              </g>

              {/* Bottom-Left Notes */}
              <g transform={`translate(30, ${canvasHeight - 35})`}>
                <text
                  x="0"
                  y="0"
                  fill={isLight ? '#334155' : '#CBD5E1'}
                  fontSize="8.5"
                  fontWeight="bold"
                >
                  💡 핀 클릭 또는 마우스 호버 시 해당 핀의 상세 전기적 스펙 및 레지스터 비트가 표시됩니다.
                </text>
                <text
                  x="0"
                  y="12"
                  fill={isLight ? '#64748B' : '#94A3B8'}
                  fontSize="7.5"
                >
                  Total {profile.totalPins} Pins • {profile.notes?.[0] || ''}
                </text>
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* Selected Pin Details Inspector Card */}
      {selectedPin ? (
        <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-amber-500/40 rounded-xl p-5 shadow-xl space-y-3 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm shadow-md shadow-amber-500/30">
                #{selectedPin.pinNumber}
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>핀 {selectedPin.pinNumber}: {selectedPin.label}</span>
                  {selectedPin.arduino && (
                    <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-mono font-bold">
                      Arduino: {selectedPin.arduino}
                    </span>
                  )}
                  {selectedPin.port && (
                    <span className="text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded font-mono">
                      포트: {selectedPin.port}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedPin.desc}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedPin(null)}
                className="px-3 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors border border-slate-700"
              >
                닫기
              </button>
            </div>
          </div>

          {/* Badges Flow */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-slate-400 font-semibold">할당된 기능 배지:</span>
            {selectedPin.badges.map((b, idx) => {
              const style = BADGE_STYLES[b.type];
              return (
                <span
                  key={idx}
                  style={{
                    backgroundColor: style.bg,
                    color: style.text,
                    border: `1px solid ${style.border}`
                  }}
                  className="px-2.5 py-0.5 rounded text-xs font-mono font-bold shadow-sm"
                >
                  {b.text} ({style.label.split(' ')[0]})
                </span>
              );
            })}
          </div>

          {/* Quick Code Snippet */}
          {selectedPin.port && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-400 space-y-1">
              <div className="text-slate-400 text-[11px] font-sans font-semibold">
                C 제어 레지스터 예제 ({selectedPin.label}):
              </div>
              <div>// 출력 모드 설정 & HIGH 출력</div>
              <div className="text-emerald-300">
                DDR{selectedPin.port.slice(-1)} |= (1 &lt;&lt; {selectedPin.label}); // 출력 전환
              </div>
              <div className="text-emerald-300">
                PORT{selectedPin.port.slice(-1)} |= (1 &lt;&lt; {selectedPin.label}); // HIGH 출력 (입력 시 내부 풀업)
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Info className="w-4 h-4 text-amber-400" />
          <span>다이어그램 상의 임의의 핀 또는 배지를 클릭하면 해당 핀의 상세 제어 코드와 아두이노 매핑 정보가 표시됩니다.</span>
        </div>
      )}

      {/* Target MCU Summary Grid (4-Chip Quick Specs Comparison) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        {(['atmega2560', 'atmega640', 'atmega128', 'atmega328p'] as SupportedMCU[]).map((mcuId) => {
          const mcuData = MCU_DIAGRAM_MAP[mcuId];
          const isCurrent = activeMcu === mcuId;
          const prof = MCU_PROFILES[mcuId];

          return (
            <div
              key={mcuId}
              onClick={() => handleMcuSwitch(mcuId)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                isCurrent
                  ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-white flex items-center gap-1.5">
                  <Cpu className={`w-4 h-4 ${isCurrent ? 'text-amber-400' : 'text-slate-400'}`} />
                  {mcuData.name}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300">
                  {mcuData.totalPins} Pins
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
                {mcuData.notes?.[0] || mcuData.subtitle}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2">
                <span>{prof.package.split(' ')[0]}</span>
                <span className="text-amber-400 font-bold">{prof.io} I/O Pins</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
