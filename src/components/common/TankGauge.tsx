import React from 'react';

interface TankGaugeProps {
  productId: string;
  productName?: string;
  remainingLitres: number;
  totalCapacityLitres?: number;
  truckLabel?: string;
  shortfall?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
}

export const TankGauge: React.FC<TankGaugeProps> = ({
  productId,
  productName,
  remainingLitres,
  totalCapacityLitres = 15000,
  truckLabel,
  shortfall = 0,
  size = 'md',
  showLabels = true
}) => {
  const isVeg = productId === 'veg';
  const percentage = Math.min(100, Math.max(0, (remainingLitres / (totalCapacityLitres || 1)) * 100));

  // Height configurations
  const heightClasses = {
    sm: 'h-36 w-full max-w-[120px]',
    md: 'h-52 w-full max-w-[200px]',
    lg: 'h-64 w-full max-w-[260px]'
  }[size];

  // Gradients and liquid styling
  const liquidGradient = isVeg
    ? 'from-amber-400 via-amber-500 to-amber-600 dark:to-amber-700'
    : 'from-rose-400 via-red-500 to-red-700 dark:to-red-900';

  const liquidBg = isVeg ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)';
  const borderGlow = isVeg
    ? 'border-amber-400/50 dark:border-amber-500/40 shadow-amber-500/10'
    : 'border-rose-400/50 dark:border-rose-500/40 shadow-rose-500/10';

  return (
    <div className="flex flex-col items-center select-none">
      {/* Tank Container Structure */}
      <div
        className={`relative ${heightClasses} rounded-2xl border-2 ${borderGlow} shadow-xl bg-slate-100 dark:bg-slate-900/90 overflow-hidden backdrop-blur-md flex flex-col justify-end p-1 transition-colors duration-200`}
      >
        {/* Top Rim Indicator */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700/60 z-20" />
        
        {/* Fill Percentage Overlay badge */}
        <div className="absolute top-3 right-3 z-20 bg-white/90 dark:bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 shadow-sm">
          {percentage.toFixed(0)}%
        </div>

        {/* Measurement tick marks */}
        <div className="absolute inset-y-4 left-2.5 z-10 flex flex-col justify-between opacity-50 dark:opacity-30 text-[9px] font-mono text-slate-500 dark:text-slate-300 pointer-events-none font-bold">
          <span>MAX</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>MIN</span>
        </div>

        {/* Liquid Surface and Wave */}
        <div
          className="relative w-full transition-all duration-700 ease-out z-10"
          style={{ height: `${Math.max(8, percentage)}%` }}
        >
          {/* Animated Wave Surface SVG */}
          <div className="absolute -top-3 left-0 right-0 w-full h-4 overflow-hidden">
            <svg
              className="w-[200%] h-full animate-liquid-wave fill-current text-opacity-95"
              style={{ color: isVeg ? '#F59E0B' : '#EF4444' }}
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
            >
              <path d="M0,0 C150,90 350,-40 500,45 C650,130 900,-20 1200,30 L1200,120 L0,120 Z" />
            </svg>
          </div>

          {/* Liquid Body */}
          <div
            className={`w-full h-full bg-gradient-to-t ${liquidGradient} opacity-95 rounded-b-xl relative overflow-hidden`}
          >
            {/* Shimmer / light reflection effect */}
            <div className="absolute top-0 right-2 w-1.5 h-full bg-white/30 blur-[1px] rounded-full" />
            <div className="absolute top-0 left-3 w-1 h-full bg-black/15 blur-[1px] rounded-full" />
          </div>
        </div>

        {/* Empty Space Background Tint */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{ backgroundColor: liquidBg }}
        />
      </div>

      {/* Tank Labels */}
      {showLabels && (
        <div className="mt-3 text-center w-full">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {productName || (isVeg ? 'Golden Vegetable Oil' : 'Red / Palm Oil')}
          </div>
          <div className="text-base font-mono font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
            {remainingLitres.toLocaleString('en-US', { maximumFractionDigits: 0 })} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Litres</span>
          </div>
          {truckLabel && (
            <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium truncate max-w-[160px] mx-auto mt-0.5">
              {truckLabel}
            </div>
          )}
          {shortfall > 50 && (
            <div className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30">
              Shortfall: -{shortfall.toFixed(0)}L
            </div>
          )}
        </div>
      )}
    </div>
  );
};
