import React from 'react';
import { formatVolumeWithDrums } from '../../services/businessLogic';
import { Package } from '@phosphor-icons/react';

interface KegPalletStackDiagramProps {
  remainingLitres: number;
  totalCapacityLitres?: number;
  kegSizeLitres?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
}

export const KegPalletStackDiagram: React.FC<KegPalletStackDiagramProps> = ({
  remainingLitres,
  totalCapacityLitres = 15000,
  kegSizeLitres = 25,
  size = 'md',
  showLabels = true
}) => {
  const currentKegs = Math.max(0, Math.round(remainingLitres / kegSizeLitres));
  const maxKegs = Math.max(1, Math.round(totalCapacityLitres / kegSizeLitres));
  const percentage = Math.min(100, Math.max(0, (remainingLitres / totalCapacityLitres) * 100));
  const isLowStock = percentage < 15;

  const heightClasses = {
    sm: 'h-40 w-full max-w-[170px]',
    md: 'h-52 w-full max-w-[220px]',
    lg: 'h-64 w-full max-w-[260px]'
  }[size];

  // Visual grid of 20 sample kegs (4 rows x 5 columns) representing the stack density
  const totalSlots = 20;
  const filledSlots = Math.min(totalSlots, Math.round((percentage / 100) * totalSlots));

  return (
    <div className="flex flex-col items-center select-none w-full max-w-[280px]">
      {/* Outer Pallet Bay Container */}
      <div
        className={`relative ${heightClasses} rounded-2xl border-2 shadow-card-light dark:shadow-card-dark bg-gradient-to-b from-rose-950/10 via-slate-900/50 to-slate-950 border-rose-500/40 overflow-hidden flex flex-col justify-between p-3 transition-all duration-300`}
      >
        {/* Top Header Badge */}
        <div className="flex items-center justify-between z-10">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-sans font-bold uppercase tracking-wider border border-rose-500/30">
            <Package className="w-3 h-3" />
            <span>25L Pallet Stack</span>
          </span>

          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums font-bold border shadow-sm ${
              isLowStock
                ? 'bg-rose-950/80 text-rose-300 border-rose-500/60 animate-pulse'
                : 'bg-slate-900/90 text-slate-200 border-slate-700'
            }`}
          >
            {percentage.toFixed(0)}%
          </span>
        </div>

        {/* 3D-styled Stacked Jerrycans Grid Illustration */}
        <div className="flex-1 flex flex-col justify-end py-1 px-1 z-10">
          <div className="grid grid-cols-5 gap-1.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm shadow-inner">
            {Array.from({ length: totalSlots }).map((_, i) => {
              // Slots fill from bottom to top
              const row = Math.floor(i / 5);
              const col = i % 5;
              // Invert row so index 0 is bottom
              const slotIndexFromBottom = (3 - row) * 5 + col;
              const isFilled = slotIndexFromBottom < filledSlots;

              return (
                <div
                  key={i}
                  className={`h-5 rounded-md relative transition-all duration-300 flex flex-col items-center justify-center ${
                    isFilled
                      ? 'bg-gradient-to-t from-rose-700 via-rose-600 to-amber-600 border border-rose-400/60 shadow-sm shadow-rose-900/50'
                      : 'bg-slate-800/40 border border-dashed border-slate-700/50 opacity-40'
                  }`}
                  title={isFilled ? `25L Jerrycan (Layer ${4 - row})` : 'Empty stack position'}
                >
                  {/* Jerrycan Molded Handle Top */}
                  {isFilled && (
                    <div className="w-2.5 h-1 rounded-t-sm bg-amber-400/80 shadow-xs -mt-1 mb-0.5" />
                  )}
                  {/* Subtle fluid reflection */}
                  {isFilled && (
                    <div className="w-3 h-1 rounded-full bg-white/30 blur-[0.5px]" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Wooden Warehouse Pallet Base Platform */}
          <div className="mt-1.5 pt-1 flex items-center justify-between border-t-2 border-amber-800/60">
            <div className="h-2 w-full bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 rounded-xs flex justify-around items-center px-1 shadow-md">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-700/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-amber-700/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-amber-700/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-amber-700/60" />
            </div>
          </div>
        </div>

        {/* Bottom Volume Ticker */}
        <div className="z-10 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-300 pt-1 border-t border-slate-800">
          <span className="font-bold text-rose-400">
            {currentKegs} / {maxKegs} Kegs
          </span>
          <span className="text-slate-400 text-[10px]">
            {formatVolumeWithDrums(remainingLitres)}
          </span>
        </div>
      </div>

      {showLabels && (
        <div className="mt-2 text-center">
          <span className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 block">
            Pre-Kegged Jerrycan Fleet
          </span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            25 Litres · Direct Warehouse Palletized Stock
          </span>
        </div>
      )}
    </div>
  );
};
