import React from 'react';
import { Package } from '@phosphor-icons/react';

interface KegVisual25LProps {
  remainingLitres: number;
  totalCapacityLitres?: number;
  kegSizeLitres?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
}

export const KegVisual25L: React.FC<KegVisual25LProps> = ({
  remainingLitres,
  totalCapacityLitres = 15000,
  kegSizeLitres = 25,
  size = 'lg',
  showLabels = true
}) => {
  const currentKegs = Math.max(0, Math.round(remainingLitres / kegSizeLitres));
  const maxKegs = Math.max(1, Math.round(totalCapacityLitres / kegSizeLitres));
  const percentage = Math.min(100, Math.max(0, (remainingLitres / totalCapacityLitres) * 100));
  const isLowStock = percentage < 15;

  const containerSizes = {
    sm: 'w-32 max-w-[130px]',
    md: 'w-38 max-w-[155px]',
    lg: 'w-44 max-w-[175px]'
  }[size];

  // Fluid height inside the keg body (from y=46 to y=246, total height = 200px)
  const kegBodyY = 46;
  const kegBodyHeight = 200;
  const fillHeight = Math.max(12, (percentage / 100) * kegBodyHeight);
  const fillY = kegBodyY + kegBodyHeight - fillHeight;

  return (
    <div className={`flex flex-col items-center select-none ${containerSizes}`}>
      {/* Top Badges */}
      <div className="w-full flex items-center justify-between mb-2 px-1">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs font-sans font-bold border border-rose-500/25">
          <Package className="w-3.5 h-3.5 text-rose-500" weight="fill" />
          <span>25L Company Keg</span>
        </span>

        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-mono tabular-nums font-bold border shadow-xs ${isLowStock
              ? 'bg-rose-950/80 text-rose-300 border-rose-500/60 animate-pulse'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
        >
          {percentage.toFixed(0)}%
        </span>
      </div>

      {/* SVG 25L Heavy-Duty Jerrycan / Keg Illustration */}
      <div className="relative w-full aspect-[200/260] drop-shadow-md">
        <svg
          viewBox="0 0 200 260"
          className="w-full h-full overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Palm Oil Rich Ruby/Amber Fluid Gradient */}
            <linearGradient id="palmOilFluidGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="35%" stopColor="#DC2626" />
              <stop offset="100%" stopColor="#991B1B" />
            </linearGradient>

            {/* Jerrycan Plastic Body Outer Gradient (HDPE Sheen) */}
            <linearGradient id="kegPlasticGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F87171" stopOpacity="0.35" />
              <stop offset="15%" stopColor="#FCA5A5" stopOpacity="0.15" />
              <stop offset="85%" stopColor="#EF4444" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#B91C1C" stopOpacity="0.45" />
            </linearGradient>

            {/* Handle & Cap Gradient */}
            <linearGradient id="kegHandleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F87171" />
              <stop offset="100%" stopColor="#B91C1C" />
            </linearGradient>

            {/* Spout Cap Gold/Red Accent */}
            <linearGradient id="kegCapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>

            {/* Clip path defining the interior cavity of the 25L Jerrycan body */}
            <clipPath id="kegInteriorClip">
              <rect x="26" y="46" width="148" height="200" rx="14" />
            </clipPath>
          </defs>

          {/* --- TOP HARDWARE: SCREW CAP & SPOUT --- */}
          {/* Spout Neck */}
          <rect x="36" y="26" width="26" height="18" rx="2" fill="url(#kegHandleGrad)" />
          {/* Threaded Screw Cap with knurling */}
          <rect x="33" y="16" width="32" height="14" rx="4" fill="url(#kegCapGrad)" stroke="#78350F" strokeWidth="1" />
          <line x1="39" y1="17" x2="39" y2="29" stroke="#FEF3C7" strokeWidth="1" opacity="0.6" />
          <line x1="45" y1="17" x2="45" y2="29" stroke="#FEF3C7" strokeWidth="1" opacity="0.6" />
          <line x1="51" y1="17" x2="51" y2="29" stroke="#FEF3C7" strokeWidth="1" opacity="0.6" />
          <line x1="57" y1="17" x2="57" y2="29" stroke="#FEF3C7" strokeWidth="1" opacity="0.6" />

          {/* --- TOP HARDWARE: HEAVY-DUTY MOLDED CARRY HANDLE --- */}
          {/* Main Top Handle Arc */}
          <path
            d="M 68 46 L 74 12 C 75 8, 80 6, 86 6 L 154 6 C 160 6, 165 8, 166 12 L 172 46 Z"
            fill="url(#kegHandleGrad)"
            stroke="#991B1B"
            strokeWidth="1.5"
          />
          {/* Handle Grip Inner Cutout */}
          <path
            d="M 84 46 L 88 22 C 89 19, 93 17, 98 17 L 142 17 C 147 17, 151 19, 152 22 L 156 46 Z"
            fill="white"
            className="dark:fill-slate-900 transition-colors"
            stroke="#991B1B"
            strokeWidth="1.2"
          />
          {/* Handle Grip Ridges (Ergonomic fingers) */}
          <path d="M 104 17 L 104 23 M 116 17 L 116 23 M 128 17 L 128 23 M 140 17 L 140 23" stroke="#FEF2F2" strokeWidth="1.2" opacity="0.6" />

          {/* --- JERRYCAN MAIN BODY CAVITY (INTERIOR & FLUID) --- */}
          {/* Background casing tint */}
          <rect
            x="24"
            y="44"
            width="152"
            height="204"
            rx="16"
            fill="#FEF2F2"
            className="dark:fill-slate-950 transition-colors"
          />

          {/* Liquid Oil Body Fill (Clipped inside the keg) */}
          <g clipPath="url(#kegInteriorClip)">
            {/* Palm Oil Fluid Layer */}
            <rect
              x="26"
              y={fillY}
              width="148"
              height={fillHeight + 10}
              fill="url(#palmOilFluidGrad)"
              className="transition-all duration-700 ease-out"
            />

            {/* Animated Surface Wave Line */}
            <g transform={`translate(0, ${fillY - 4})`}>
              <path
                d="M 20 4 Q 60 0, 100 4 T 180 4 L 180 14 L 20 14 Z"
                fill="#EF4444"
                opacity="0.9"
              />
              <path
                d="M 26 4 Q 65 8, 100 4 T 174 4"
                stroke="#FECA40"
                strokeWidth="2"
                fill="none"
                opacity="0.8"
              />
            </g>

            {/* Fluid Depth Vignette / Internal Shadow */}
            <rect
              x="26"
              y="46"
              width="148"
              height="200"
              fill="black"
              opacity="0.08"
              pointerEvents="none"
            />
          </g>

          {/* --- STRUCTURAL REINFORCEMENT RIBS (Standard 25L HDPE Molded Stiffeners) --- */}
          {/* Left Vertical Molded Stiffener Rib */}
          <rect
            x="58"
            y="94"
            width="14"
            height="124"
            rx="7"
            fill="none"
            stroke="#B91C1C"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            opacity="0.4"
          />
          {/* Right Vertical Molded Stiffener Rib */}
          <rect
            x="128"
            y="94"
            width="14"
            height="124"
            rx="7"
            fill="none"
            stroke="#B91C1C"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            opacity="0.4"
          />

          {/* --- CENTER EMBOSSED "25L" LOGO BADGE --- */}
          <g transform="translate(72, 56)">
            {/* Embossed Recessed Plate */}
            <rect
              x="0"
              y="0"
              width="56"
              height="26"
              rx="6"
              fill="white"
              className="dark:fill-slate-900"
              opacity="0.9"
              stroke="#E11D48"
              strokeWidth="1.2"
            />
            <text
              x="28"
              y="18"
              textAnchor="middle"
              className="font-mono font-black"
              fontSize="14"
              fontWeight="900"
              fill="#BE123C"
              letterSpacing="0.5"
            >
              25L
            </text>
          </g>

          {/* --- MEASUREMENT SIGHT STRIP & GRADUATION MARKS (Left Edge) --- */}
          <g stroke="#991B1B" strokeWidth="1.2" opacity="0.6">
            {/* 25L Max Mark */}
            <line x1="30" y1="56" x2="42" y2="56" strokeWidth="2" stroke="#DC2626" />
            <text x="46" y="59" fontSize="8" fontWeight="bold" fill="#B91C1C" stroke="none">MAX</text>

            {/* 20L Mark */}
            <line x1="30" y1="96" x2="39" y2="96" />
            <text x="43" y="99" fontSize="8" fill="#B91C1C" stroke="none">20L</text>

            {/* 15L Mark */}
            <line x1="30" y1="136" x2="39" y2="136" />
            <text x="43" y="139" fontSize="8" fill="#B91C1C" stroke="none">15L</text>

            {/* 10L Mark */}
            <line x1="30" y1="176" x2="39" y2="176" />
            <text x="43" y="179" fontSize="8" fill="#B91C1C" stroke="none">10L</text>

            {/* 5L Min Mark */}
            <line x1="30" y1="216" x2="42" y2="216" strokeWidth="2" stroke="#DC2626" />
            <text x="46" y="219" fontSize="8" fontWeight="bold" fill="#B91C1C" stroke="none">5L</text>
          </g>

          {/* --- OUTER JERRYCAN BEVELED CASING & LIGHT REFLECTION --- */}
          <rect
            x="24"
            y="44"
            width="152"
            height="204"
            rx="16"
            fill="url(#kegPlasticGrad)"
            stroke="#BE123C"
            strokeWidth="2.5"
            pointerEvents="none"
          />

          {/* Specular White Highlights along plastic corners */}
          <path
            d="M 32 50 L 168 50"
            stroke="white"
            strokeWidth="2"
            opacity="0.6"
            strokeLinecap="round"
          />
          <path
            d="M 28 56 L 28 240"
            stroke="white"
            strokeWidth="1.5"
            opacity="0.4"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Primary Hero Keg Metrics Underneath */}
      {showLabels && (
        <div className="mt-3.5 text-center w-full space-y-1">
          <div className="text-xs font-sans font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Pre-Kegged Palm Oil
          </div>
          <div className="text-2xl font-mono font-extrabold text-slate-900 dark:text-white tabular-nums flex items-baseline justify-center gap-1.5">
            <span>{currentKegs.toLocaleString()}</span>
            <span className="text-sm font-sans font-bold text-rose-600 dark:text-rose-400">
              Kegs (25L)
            </span>
          </div>
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {remainingLitres.toLocaleString()} Litres Total
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 font-sans pt-0.5">
            Capacity: {currentKegs} / {maxKegs} Stored
          </div>
        </div>
      )}
    </div>
  );
};
