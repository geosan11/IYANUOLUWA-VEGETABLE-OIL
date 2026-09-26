import React from 'react';
import { useStore } from '../../services/store';
import { hexToRgba } from '../../services/color';
import { configuredNumber, resolveLitresPerKeg } from '../../services/businessLogic';

interface TankGaugeProps {
  productId: string;
  productName?: string;
  remainingLitres: number;
  totalCapacityLitres?: number;
  truckLabel?: string;
  shortfall?: number;
  /**
   * Litres above which the shortfall flag shows. Callers with settings should
   * pass `settings.truck_shortfall_threshold`. 0 = no tolerance configured,
   * so nothing is flagged rather than everything.
   */
  shortfallThresholdLitres?: number;
  /**
   * Resolved litres per keg for this product (`resolveLitresPerKeg`). Falls
   * back to the depot-wide figure from Settings; when neither is configured
   * the keg line is hidden instead of dividing by zero.
   */
  kegSizeLitres?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
}

export const TankGauge: React.FC<TankGaugeProps> = ({
  productId,
  productName,
  remainingLitres,
  totalCapacityLitres = 0,
  truckLabel,
  shortfall = 0,
  shortfallThresholdLitres = 0,
  kegSizeLitres,
  size = 'md',
  showLabels = true,
}) => {
  const { products, settings } = useStore();
  const product = products.find(p => p.id === productId);
  // An explicitly passed keg size (this tank's own figure) wins, else the
  // resolved standard — the depot figure while it is set, else the product's
  // own — else 0 (unset).
  const kegSize = configuredNumber(kegSizeLitres) || resolveLitresPerKeg(product, settings);
  // Same contract for capacity: only a capacity the depot actually configured
  // can produce a fill %, so an unset one shows no percentage at all rather
  // than a clamped 100%.
  const capacityKnown = totalCapacityLitres > 0;
  const colorLight = product?.color_light || '#F59E0B';
  const colorDark = product?.color_dark || '#B45309';

  const percentage = capacityKnown
    ? Math.min(100, Math.max(0, (remainingLitres / totalCapacityLitres) * 100))
    : 0;
  const isLowStock = capacityKnown && percentage < 15;

  // Height and width configurations with responsive scaling
  const heightClasses = {
    sm: 'h-36 w-full max-w-[130px]',
    md: 'h-52 w-full max-w-[200px]',
    lg: 'h-64 w-full max-w-[260px]',
  }[size];

  return (
    <div className="flex flex-col items-center select-none">
      {/* Tank Cylindrical Container Structure */}
      <div
        className={`relative ${heightClasses} rounded-2xl border-2 shadow-card-light dark:shadow-card-dark bg-white dark:bg-slate-900/90 overflow-hidden flex flex-col justify-end p-1 transition-all duration-300`}
        style={{ borderColor: hexToRgba(colorLight, 0.6) }}
      >
        {/* Top Rim Indicator with metallic sheen */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-2 rounded-full bg-slate-200 dark:bg-slate-700/80 z-20 shadow-inner flex items-center justify-center">
          <div className="w-8 h-0.5 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>

        {/* Fill Percentage Overlay badge */}
        <div className="absolute top-3.5 right-3 z-20 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums font-bold text-slate-800 dark:text-slate-100 shadow-sm flex items-center gap-1">
          {isLowStock && (
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          )}
          <span>{capacityKnown ? `${percentage.toFixed(0)}%` : '—'}</span>
        </div>

        {/* Measurement tick marks */}
        <div className="absolute inset-y-5 left-3 z-10 flex flex-col justify-between opacity-60 dark:opacity-40 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 pointer-events-none font-bold">
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
          <div className="absolute -top-3 left-0 right-0 w-full h-4 overflow-hidden pointer-events-none">
            <svg
              className="w-[200%] h-full animate-liquid-wave fill-current text-opacity-95"
              style={{ color: colorDark }}
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
            >
              <path d="M0,0 C150,90 350,-40 500,45 C650,130 900,-20 1200,30 L1200,120 L0,120 Z" />
            </svg>
          </div>

          {/* Liquid Body with rich dual gradient */}
          <div
            className="w-full h-full opacity-95 rounded-b-xl relative overflow-hidden shadow-inner"
            style={{
              background: `linear-gradient(to top, ${colorDark}, ${colorLight})`,
            }}
          >
            {/* Shimmer / light reflection effect */}
            <div className="absolute top-0 right-3 w-2 h-full bg-white/30 blur-[1px] rounded-full" />
            <div className="absolute top-0 left-4 w-1.5 h-full bg-black/20 blur-[1px] rounded-full" />
          </div>
        </div>

        {/* Empty Chamber Tint */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{ backgroundColor: hexToRgba(colorDark, 0.08) }}
        />
      </div>

      {/* Tank Labels */}
      {showLabels && (
        <div className="mt-3.5 text-center w-full space-y-1">
          <div className="text-xs font-sans font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {productName || product?.name || 'Oil'}
          </div>
          <div className="text-xl font-mono font-extrabold text-slate-900 dark:text-white tabular-nums">
            {remainingLitres.toLocaleString('en-US', { maximumFractionDigits: 0 })}{' '}
            <span className="text-xs font-sans font-normal text-slate-500 dark:text-slate-400">
              Litres
            </span>
          </div>
          {kegSize > 0 ? (
            <div className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              ≈ {Math.round(remainingLitres / kegSize).toLocaleString()} Kegs ({kegSize}L)
            </div>
          ) : (
            <div className="text-xs font-sans text-slate-500 dark:text-slate-400">
              Set the keg size in Settings to see keg equivalents
            </div>
          )}
          {truckLabel && (
            <div className="text-xs text-slate-600 dark:text-slate-400 font-sans truncate max-w-[180px] mx-auto">
              {truckLabel}
            </div>
          )}
          {shortfallThresholdLitres > 0 && shortfall > shortfallThresholdLitres && (
            <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono tabular-nums font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30">
              Shortfall: -{shortfall.toFixed(0)}L
            </div>
          )}
        </div>
      )}
    </div>
  );
};
