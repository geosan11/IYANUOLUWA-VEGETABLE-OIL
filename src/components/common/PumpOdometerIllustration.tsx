import React from 'react';
import { ArrowsClockwise } from '@phosphor-icons/react';

interface PumpOdometerIllustrationProps {
  pumpName?: string;
  openingReading?: number;
  currentReading?: number;
  recordedSalesLitres?: number;
  tankName?: string;
  isCompact?: boolean;
  /** Shows a big physical-style Reset button beside the counter when provided. */
  onReset?: () => void;
}

export const PumpOdometerIllustration: React.FC<PumpOdometerIllustrationProps> = ({
  pumpName = 'Pump 01',
  openingReading = 142580.0,
  currentReading = 143830.5,
  recordedSalesLitres = 1250.0,
  tankName = 'Storage Tank 1',
  isCompact = false,
  onReset,
}) => {
  const pumpedLitres = Math.max(0, currentReading - openingReading);
  const variance = pumpedLitres - recordedSalesLitres;
  const isVarianceFlagged = Math.abs(variance) > 5; // > 5L variance is flagged

  // Helper to format counter digits as 7 wheels (e.g. 0 1 4 3 8 3 0 . 5)
  const formatOdometerDigits = (num: number) => {
    const fixedStr = num.toFixed(1); // "143830.5"
    const [whole, decimal] = fixedStr.split('.');
    const paddedWhole = whole.padStart(6, '0');
    return {
      wholeDigits: paddedWhole.split(''),
      decimalDigit: decimal || '0',
    };
  };

  const currentDigits = formatOdometerDigits(currentReading);

  return (
    <div className="rounded-2xl depot-card p-4 sm:p-5 border border-slate-200 dark:border-slate-800 space-y-4">
      {/* Header & Concept Explanation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold text-lg">
            ⛽
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              {pumpName} Mechanical Totalizer
              <span className="text-xs px-2 py-0.5 rounded-full font-sans font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Connected to {tankName}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">
              Mechanical meters record every physical drop passing through the nozzle.
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div className="self-start sm:self-auto">
          {isVarianceFlagged ? (
            <span className="badge-rose inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              Variance Alert: {variance > 0 ? `+${variance.toFixed(1)}L` : `${variance.toFixed(1)}L`}
            </span>
          ) : (
            <span className="badge-emerald inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Meter Reconciled (OK)
            </span>
          )}
        </div>
      </div>

      {/* Mechanical Counter Wheel Assembly — hugs its content instead of
          stretching full-width, so the dark box doesn't pull focus away
          from the digits themselves */}
      <div className="w-fit max-w-full mx-auto bg-slate-900 dark:bg-slate-950 rounded-xl py-4 px-5 border border-slate-800 shadow-inner flex flex-col items-center justify-center gap-3">
        <div className="text-[10px] uppercase font-mono tracking-widest text-slate-400 flex items-center gap-2">
          <span>Continuous Mechanical Counter</span>
          <span className="text-slate-600">•</span>
          <span>Never Resets to Zero</span>
        </div>

        {/* Rolling Drum Wheels + physical Reset button */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="inline-flex items-center gap-1 sm:gap-1.5 bg-black/80 p-2 sm:p-2.5 rounded-lg border-2 border-slate-700 shadow-2xl">
            {currentDigits.wholeDigits.map((digit, idx) => (
              <div
                key={idx}
                className="relative w-7 sm:w-9 h-10 sm:h-12 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 rounded flex items-center justify-center shadow-inner overflow-hidden"
              >
                {/* Drum Highlight & Bevel */}
                <div className="absolute inset-x-0 top-0 h-1 bg-white/20" />
                <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40" />
                <div className="absolute inset-y-0 left-0 w-px bg-white/10" />
                {/* Horizontal center crease */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-black/40" />
                <span className="font-mono text-lg sm:text-xl font-black text-white select-none drop-shadow">
                  {digit}
                </span>
              </div>
            ))}

            {/* Decimal Point */}
            <div className="w-2 flex items-end justify-center pb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-glow-amber" />
            </div>

            {/* Tenths Drum (Red / Amber drum for fractions) */}
            <div className="relative w-7 sm:w-9 h-10 sm:h-12 bg-gradient-to-b from-amber-700 via-amber-600 to-amber-800 border border-amber-500 rounded flex items-center justify-center shadow-inner overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-white/30" />
              <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50" />
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-black/30" />
              <span className="font-mono text-lg sm:text-xl font-black text-white select-none drop-shadow">
                {currentDigits.decimalDigit}
              </span>
            </div>

            <div className="ml-1 text-xs font-mono font-bold text-slate-400 select-none">
              L
            </div>
          </div>

          {/* Big physical-style Reset button — embossed, presses down on click */}
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              title="Rub off / reset this meter"
              className="group relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-b from-red-500 via-red-600 to-red-800 border-4 border-red-950/60 shadow-[0_5px_0_0_#7f1d1d,0_8px_14px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center gap-0.5 transition-all active:translate-y-[5px] active:shadow-[0_0px_0_0_#7f1d1d,0_2px_4px_rgba(0,0,0,0.5)] hover:brightness-110 cursor-pointer"
            >
              <span className="absolute inset-x-2 top-1.5 h-3 rounded-full bg-white/25 blur-[2px]" aria-hidden="true" />
              <ArrowsClockwise className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow" weight="bold" />
              <span className="text-[9px] sm:text-[10px] font-mono font-black uppercase tracking-wider text-white drop-shadow">
                Reset
              </span>
            </button>
          )}
        </div>

        {/* Small subtitle indicator */}
        <p className="text-[11px] text-slate-400 font-sans text-center">
          Reading shown reflects current nozzle meter count.
        </p>
      </div>

      {/* Audit Calculation Breakdown */}
      {!isCompact && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 text-xs font-mono tabular-nums">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] uppercase text-slate-500 font-sans block mb-0.5">
              1. Shift Morning Start
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              {openingReading.toLocaleString('en-US', { minimumFractionDigits: 1 })} L
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] uppercase text-slate-500 font-sans block mb-0.5">
              2. Evening Reading
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              {currentReading.toLocaleString('en-US', { minimumFractionDigits: 1 })} L
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] uppercase text-amber-700 dark:text-amber-400 font-sans block mb-0.5 font-bold">
              3. Metered Pumped
            </span>
            <span className="font-bold text-amber-700 dark:text-amber-400 text-sm">
              {pumpedLitres.toLocaleString('en-US', { minimumFractionDigits: 1 })} L
            </span>
          </div>

          <div className={`p-2.5 rounded-xl border ${
            isVarianceFlagged
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
          }`}>
            <span className="text-[10px] uppercase font-sans block mb-0.5 font-bold">
              4. Discrepancy vs Sales
            </span>
            <span className="font-bold text-sm">
              {variance > 0 ? `+${variance.toFixed(1)} L` : `${variance.toFixed(1)} L`}
            </span>
          </div>
        </div>
      )}

      {/* Helpful Depot Note */}
      <div className="text-xs bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/80 text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
        <span className="text-base leading-none">💡</span>
        <div className="leading-relaxed font-sans">
          <strong className="text-slate-800 dark:text-slate-200">How Discrepancy is Calculated:</strong> If the mechanical meter advances by 1,250 Litres, but cashiers only recorded orders totaling 1,230 Litres, there is an unrecorded variance of 20 Litres that must be reconciled with the pump attendants.
        </div>
      </div>
    </div>
  );
};
