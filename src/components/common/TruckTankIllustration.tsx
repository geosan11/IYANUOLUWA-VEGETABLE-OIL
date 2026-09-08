import React, { useEffect, useState } from 'react';
import { Product, Tank } from '../../types';
import { formatDepotDate } from '../../services/businessLogic';

interface TruckTankIllustrationProps {
  tank: Tank;
  product?: Product;
  connectedPumpLabel?: string;
  animateOnMount?: boolean;
}

export const TruckTankIllustration: React.FC<TruckTankIllustrationProps> = ({
  tank,
  connectedPumpLabel,
  animateOnMount = false
}) => {
  const isVeg = tank.product_id === 'veg';
  const received = tank.received_litres || 1;
  const remaining = Math.max(0, tank.remaining_litres);
  const targetPercentage = Math.min(100, Math.max(0, (remaining / received) * 100));

  // Two-phase animation: on mount/record, animate from 0 to targetPercentage over 1.2s, then idle
  const [displayedPercentage, setDisplayedPercentage] = useState<number>(
    animateOnMount ? 0 : targetPercentage
  );

  useEffect(() => {
    if (animateOnMount) {
      const timer = setTimeout(() => {
        setDisplayedPercentage(targetPercentage);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setDisplayedPercentage(targetPercentage);
    }
  }, [targetPercentage, animateOnMount]);

  // Extract Driver Name if included in truck label or provide a realistic depot driver label
  const parseDriverName = (label: string): string => {
    const matchParen = label.match(/\(([^)]+)\)/);
    if (matchParen && matchParen[1]) return matchParen[1].trim();
    const matchDash = label.split(/[·-]/);
    if (matchDash.length > 1 && !matchDash[matchDash.length - 1].match(/^[0-9A-Z]+$/i)) {
      return matchDash[matchDash.length - 1].trim();
    }
    return 'Driver On Duty';
  };

  const driverName = parseDriverName(tank.truck_label);

  // Placard styling
  const placardText = isVeg ? 'VEG-1090' : 'PALM-1085';
  const placardTitle = isVeg ? 'VEGETABLE OIL' : 'PALM OIL';

  // Gradient IDs for SVG
  const gradientId = `truck-liquid-grad-${tank.id}`;
  const clipId = `truck-tank-clip-${tank.id}`;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/90 p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700/80 transition-all space-y-4">
      {/* 1. TOP HEADER: IDENTIFIER & STATUS */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-heading font-bold text-[16px] text-slate-900 dark:text-white">
            {tank.truck_label}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-sans font-bold uppercase tracking-wider ${
              isVeg
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60'
                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700/60'
            }`}
          >
            {isVeg ? 'Golden Oil' : 'Palm Oil'}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[12px] font-mono tabular-nums">
          <span className="text-slate-500 dark:text-slate-400">
            {formatDepotDate(tank.date)}
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono tabular-nums font-bold ${
              remaining > 0
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/50'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}
          >
            {remaining > 0 ? `${targetPercentage.toFixed(0)}% Available` : 'Depleted'}
          </span>
        </div>
      </div>

      {/* 2. THE TRUCK ILLUSTRATION (SVG CANVAS) */}
      <div className="relative w-full bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3 sm:p-4 overflow-hidden select-none">
        <svg
          viewBox="0 0 540 180"
          className="w-full h-auto max-h-[190px] drop-shadow-sm"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Liquid Fill Horizontal Gradient */}
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              {isVeg ? (
                <>
                  <stop offset="0%" stopColor="#F59E0B" />
                  <stop offset="50%" stopColor="#D97706" />
                  <stop offset="100%" stopColor="#B45309" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#F87171" />
                  <stop offset="50%" stopColor="#DC2626" />
                  <stop offset="100%" stopColor="#991B1B" />
                </>
              )}
            </linearGradient>

            {/* Tank Capsule Clip Path */}
            <clipPath id={clipId}>
              <rect x="135" y="28" width="365" height="96" rx="22" ry="22" />
            </clipPath>

            {/* Subtle Metallic Gradient for Cab & Tank Outer Shell */}
            <linearGradient id="truck-metal" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#1E293B" />
            </linearGradient>
            <linearGradient id="tank-shell" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="50%" stopColor="#334155" />
              <stop offset="100%" stopColor="#1E293B" />
            </linearGradient>
          </defs>

          {/* ═════════════════════════════════════════════ */}
          {/* CHASSIS & LOWER CARRIAGE */}
          {/* ═════════════════════════════════════════════ */}
          {/* Main frame beam */}
          <rect x="25" y="122" width="480" height="10" rx="3" fill="#0F172A" />
          {/* Landing gear / spare bracket */}
          <rect x="145" y="128" width="8" height="14" fill="#334155" />
          <rect x="141" y="140" width="16" height="4" rx="2" fill="#475569" />

          {/* ═════════════════════════════════════════════ */}
          {/* CAB (LEFT SILHOUETTE) */}
          {/* ═════════════════════════════════════════════ */}
          <g id="cab-assembly">
            {/* Cab Roof Deflector / Windscreen contour */}
            <path
              d="M 22 122 L 22 80 Q 22 45 48 40 L 98 40 Q 115 40 118 52 L 122 122 Z"
              fill="url(#truck-metal)"
              stroke="#0F172A"
              strokeWidth="2"
            />
            {/* Front grill / bumper */}
            <rect x="16" y="98" width="12" height="26" rx="3" fill="#475569" stroke="#0F172A" strokeWidth="1.5" />
            {/* Headlight */}
            <rect x="18" y="104" width="7" height="6" rx="1.5" fill="#FEF08A" />
            {/* Chrome bumper */}
            <rect x="14" y="120" width="22" height="8" rx="3" fill="#64748B" />

            {/* Driver Window */}
            <path
              d="M 46 48 L 88 48 Q 96 48 98 56 L 102 78 L 46 78 Z"
              fill="#94A3B8"
              fillOpacity="0.4"
              stroke="#1E293B"
              strokeWidth="1.5"
            />

            {/* Driver Silhouette inside cabin */}
            <circle cx="68" cy="62" r="5" fill="#334155" />
            <path d="M 60 76 Q 60 69 68 69 Q 76 69 76 76 Z" fill="#334155" />

            {/* Vertical exhaust stack behind cab */}
            <rect x="120" y="20" width="6" height="102" rx="3" fill="#64748B" stroke="#0F172A" strokeWidth="1.5" />
            <path d="M 120 20 Q 120 14 126 14" stroke="#64748B" strokeWidth="4" fill="none" strokeLinecap="round" />

            {/* Front Wheel */}
            <circle cx="58" cy="132" r="16" fill="#0F172A" stroke="#334155" strokeWidth="2" />
            <circle cx="58" cy="132" r="9" fill="#475569" />
            <circle cx="58" cy="132" r="4" fill="#94A3B8" />

            {/* ── DRIVER LEADER LINE TO LABEL ── */}
            {/* Anchor point at driver window */}
            <circle cx="68" cy="62" r="2.5" fill="#10B981" />
            {/* Leader line running down to bottom callout */}
            <path
              d="M 68 62 L 68 88 L 38 100 L 38 152"
              fill="none"
              stroke="#10B981"
              strokeWidth="1.5"
              strokeDasharray="3 2"
            />
            {/* Driver Label Pill */}
            <rect x="10" y="152" width="105" height="22" rx="6" fill="#064E3B" stroke="#10B981" strokeWidth="1.5" />
            <text
              x="62"
              y="167"
              textAnchor="middle"
              fill="#A7F3D0"
              fontSize="9"
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              👤 {driverName.slice(0, 14)}
            </text>
          </g>

          {/* ═════════════════════════════════════════════ */}
          {/* TANK BODY (RIGHT - HORIZONTAL LIQUID FILL) */}
          {/* ═════════════════════════════════════════════ */}
          <g id="tank-assembly">
            {/* Manhole Covers on Top of Tank */}
            <ellipse cx="230" cy="25" rx="14" ry="4" fill="#64748B" stroke="#1E293B" strokeWidth="1.5" />
            <rect x="226" y="21" width="8" height="3" rx="1" fill="#94A3B8" />

            <ellipse cx="320" cy="25" rx="14" ry="4" fill="#64748B" stroke="#1E293B" strokeWidth="1.5" />
            <rect x="316" y="21" width="8" height="3" rx="1" fill="#94A3B8" />

            <ellipse cx="410" cy="25" rx="14" ry="4" fill="#64748B" stroke="#1E293B" strokeWidth="1.5" />
            <rect x="406" y="21" width="8" height="3" rx="1" fill="#94A3B8" />

            {/* Tank Shell Outer Frame */}
            <rect
              x="135"
              y="28"
              width="365"
              height="96"
              rx="22"
              ry="22"
              fill="#0F172A"
              stroke="#334155"
              strokeWidth="3"
            />

            {/* ── LIQUID FILL REGION (Clipped to Tank Body) ── */}
            <g clipPath={`url(#${clipId})`}>
              {/* Empty Chamber Background Hue */}
              <rect
                x="135"
                y="28"
                width="365"
                height="96"
                fill={isVeg ? '#F59E0B' : '#EF4444'}
                fillOpacity="0.10"
              />

              {/* Measurement Volume Ticks (Background guide) */}
              <line x1="226" y1="28" x2="226" y2="124" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
              <line x1="317" y1="28" x2="317" y2="124" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
              <line x1="408" y1="28" x2="408" y2="124" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />

              {/* Liquid Volume Body (Fills Left to Right) */}
              <rect
                x="135"
                y="28"
                width={`${(365 * Math.max(2, displayedPercentage)) / 100}`}
                height="96"
                fill={`url(#${gradientId})`}
                className="transition-all duration-1000 ease-out"
              />

              {/* Ambient Idle Wave Overlay across Liquid Volume */}
              {displayedPercentage > 0 && (
                <g className="animate-liquid-wave opacity-40">
                  <path
                    d="M 135 40 Q 180 32 230 40 T 330 40 T 430 40 T 520 40 L 520 124 L 135 124 Z"
                    fill="#FFFFFF"
                    fillOpacity="0.18"
                  />
                  <path
                    d="M 135 48 Q 170 56 220 48 T 310 48 T 410 48 T 510 48 L 510 124 L 135 124 Z"
                    fill="#000000"
                    fillOpacity="0.12"
                  />
                </g>
              )}

              {/* Glossy Top Highlight Sheen */}
              <rect x="145" y="32" width="345" height="10" rx="5" fill="#FFFFFF" fillOpacity="0.22" />
            </g>

            {/* Tank Shell Bounding Border & Seams */}
            <rect
              x="135"
              y="28"
              width="365"
              height="96"
              rx="22"
              ry="22"
              fill="none"
              stroke="#475569"
              strokeWidth="2.5"
            />
            {/* Structural vertical bands / weld seams */}
            <line x1="226" y1="28" x2="226" y2="124" stroke="#1E293B" strokeWidth="2" opacity="0.6" />
            <line x1="317" y1="28" x2="317" y2="124" stroke="#1E293B" strokeWidth="2" opacity="0.6" />
            <line x1="408" y1="28" x2="408" y2="124" stroke="#1E293B" strokeWidth="2" opacity="0.6" />

            {/* ── CAPACITY PLATE (Small label on tank showing tons declared) ── */}
            <g id="capacity-plate">
              <rect x="155" y="44" width="44" height="20" rx="3" fill="#E2E8F0" stroke="#0F172A" strokeWidth="1.2" />
              {/* Rivets */}
              <circle cx="158" cy="47" r="1" fill="#64748B" />
              <circle cx="196" cy="47" r="1" fill="#64748B" />
              <circle cx="158" cy="61" r="1" fill="#64748B" />
              <circle cx="196" cy="61" r="1" fill="#64748B" />
              <text
                x="177"
                y="58"
                textAnchor="middle"
                fill="#0F172A"
                fontSize="9"
                fontWeight="900"
                fontFamily="monospace"
              >
                {tank.tons.toFixed(1)} T
              </text>
            </g>

            {/* ── PRODUCT PLACARD (Color-coded hazard/cargo style placard badge) ── */}
            <g id="product-placard">
              <rect
                x="255"
                y="62"
                width="74"
                height="32"
                rx="4"
                fill={isVeg ? '#F59E0B' : '#DC2626'}
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
              <rect x="257" y="64" width="70" height="28" rx="2" fill="none" stroke="#0F172A" strokeWidth="1" />
              <text
                x="292"
                y="76"
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="7.5"
                fontWeight="900"
                fontFamily="sans-serif"
                letterSpacing="0.5"
              >
                {placardTitle}
              </text>
              <text
                x="292"
                y="88"
                textAnchor="middle"
                fill="#FEF08A"
                fontSize="8.5"
                fontWeight="900"
                fontFamily="monospace"
              >
                {placardText}
              </text>
            </g>

            {/* ── DISCHARGE INDICATOR (Rear-bottom valve outlet) ── */}
            <g id="discharge-indicator">
              {/* Discharge Pipe & Valve */}
              <rect x="475" y="116" width="16" height="12" rx="2" fill="#334155" stroke="#0F172A" strokeWidth="1" />
              <circle cx="483" cy="122" r="3.5" fill="#10B981" />
              <line x1="483" y1="112" x2="483" y2="120" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />

              {/* Connected Pump Badge */}
              <rect
                x="378"
                y="152"
                width="122"
                height="22"
                rx="6"
                fill="#1E293B"
                stroke="#64748B"
                strokeWidth="1"
              />
              <text
                x="439"
                y="167"
                textAnchor="middle"
                fill="#E2E8F0"
                fontSize="9"
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                ⛽ {connectedPumpLabel || (isVeg ? 'Line: Pump 1 / 2' : 'Line: Pump 3')}
              </text>
            </g>

            {/* Rear Tandem Dual Wheels */}
            <circle cx="400" cy="132" r="16" fill="#0F172A" stroke="#334155" strokeWidth="2" />
            <circle cx="400" cy="132" r="9" fill="#475569" />
            <circle cx="400" cy="132" r="4" fill="#94A3B8" />

            <circle cx="445" cy="132" r="16" fill="#0F172A" stroke="#334155" strokeWidth="2" />
            <circle cx="445" cy="132" r="9" fill="#475569" />
            <circle cx="445" cy="132" r="4" fill="#94A3B8" />
          </g>
        </svg>
      </div>

      {/* 3. METRICS & SHORTFALL BREAKDOWN (UNDERNEATH ILLUSTRATION) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[13px] font-mono tabular-nums">
        <div>
          <span className="text-[11px] uppercase text-slate-500 dark:text-slate-400 block font-sans">
            Capacity (Tons)
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {tank.tons} Metric Tons
          </span>
        </div>

        <div>
          <span className="text-[11px] uppercase text-slate-500 dark:text-slate-400 block font-sans">
            Received Volume
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {tank.received_litres.toLocaleString()} L
          </span>
        </div>

        <div>
          <span className="text-[11px] uppercase text-slate-500 dark:text-slate-400 block font-sans">
            Current Balance
          </span>
          <span className="font-bold text-brand-600 dark:text-brand-400">
            {remaining.toLocaleString()} L
          </span>
        </div>

        <div>
          <span className="text-[11px] uppercase text-slate-500 dark:text-slate-400 block font-sans">
            Offload Shortfall
          </span>
          <span
            className={`font-bold inline-flex items-center gap-1 ${
              tank.shortfall > 50
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            {tank.shortfall > 0 ? `-${tank.shortfall} L` : '0 L'}
            {tank.shortfall > 50 && (
              <span className="text-[11px] px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 font-sans font-bold">
                FLAGGED
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};
