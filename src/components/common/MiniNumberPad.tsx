import React from 'react';
import { Backspace, Check, ArrowsClockwise } from '@phosphor-icons/react';

interface MiniNumberPadProps {
  qty: number;
  onQtyChange: (newQty: number) => void;
  price: number | string;
  onPriceChange: (newPrice: string) => void;
  standardPrice?: number | null;
  onResetPrice?: () => void;
  activeTarget: 'qty' | 'price';
  onTargetChange: (target: 'qty' | 'price') => void;
  onClose?: () => void;
  className?: string;
}

export const MiniNumberPad: React.FC<MiniNumberPadProps> = ({
  qty,
  onQtyChange,
  price,
  onPriceChange,
  standardPrice,
  onResetPrice,
  activeTarget,
  onTargetChange,
  onClose,
  className = ''
}) => {
  const currentPriceNum = Number(price) || 0;

  const handleDigit = (digit: string) => {
    if (activeTarget === 'qty') {
      const currentStr = String(qty);
      const newStr = currentStr === '0' || currentStr === '1' ? digit : currentStr + digit;
      const val = Math.max(1, Math.min(99999, parseInt(newStr, 10) || 1));
      onQtyChange(val);
    } else {
      const currentStr = String(price || '');
      const newStr = currentStr === '0' ? digit : currentStr + digit;
      onPriceChange(newStr);
    }
  };

  const handleBackspace = () => {
    if (activeTarget === 'qty') {
      const currentStr = String(qty);
      if (currentStr.length <= 1) {
        onQtyChange(1);
      } else {
        onQtyChange(parseInt(currentStr.slice(0, -1), 10) || 1);
      }
    } else {
      const currentStr = String(price || '');
      if (currentStr.length <= 1) {
        onPriceChange('');
      } else {
        onPriceChange(currentStr.slice(0, -1));
      }
    }
  };

  const handleClear = () => {
    if (activeTarget === 'qty') {
      onQtyChange(1);
    } else {
      onPriceChange('');
    }
  };

  const addQtyDelta = (delta: number) => {
    onQtyChange(Math.max(1, qty + delta));
  };

  const addPriceDelta = (delta: number) => {
    const base = currentPriceNum || standardPrice || 0;
    const next = Math.max(0, base + delta);
    onPriceChange(String(next));
  };

  return (
    <div
      className={`p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-2.5 select-none animate-in fade-in zoom-in-95 duration-150 ${className}`}
    >
      {/* Target Selector Tabs */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onTargetChange('qty')}
          className={`py-1.5 px-2.5 rounded-lg text-xs font-sans font-bold flex items-center justify-between transition-all cursor-pointer ${
            activeTarget === 'qty'
              ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span>📦 Qty</span>
          <span className="font-mono tabular-nums text-slate-900 dark:text-white">{qty}</span>
        </button>

        <button
          type="button"
          onClick={() => onTargetChange('price')}
          className={`py-1.5 px-2.5 rounded-lg text-xs font-sans font-bold flex items-center justify-between transition-all cursor-pointer ${
            activeTarget === 'price'
              ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span>₦ Price</span>
          <span className="font-mono tabular-nums text-slate-900 dark:text-white truncate max-w-[80px]">
            {price !== '' ? `₦${Number(price).toLocaleString()}` : '—'}
          </span>
        </button>
      </div>

      {/* Quick Action Presets */}
      <div className="flex flex-wrap items-center gap-1">
        {activeTarget === 'qty' ? (
          <>
            {[5, 10, 20, 25, 50, 100].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => onQtyChange(n)}
                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => addQtyDelta(5)}
              className="px-2 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/80 text-brand-700 dark:text-brand-300 text-[11px] font-mono font-bold transition-colors ml-auto cursor-pointer"
            >
              +5
            </button>
          </>
        ) : (
          <>
            {[-1000, -500, 500, 1000, 5000].map(delta => (
              <button
                key={delta}
                type="button"
                onClick={() => addPriceDelta(delta)}
                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                {delta > 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString()}
              </button>
            ))}
            {standardPrice && (
              <button
                type="button"
                onClick={onResetPrice}
                className="px-2 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 text-[11px] font-sans font-bold flex items-center gap-1 transition-colors ml-auto cursor-pointer"
                title="Reset to standard rate"
              >
                <ArrowsClockwise className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* 3x4 Number Grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button
            key={d}
            type="button"
            onClick={() => handleDigit(d)}
            className="h-10 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 font-mono font-bold text-base text-slate-900 dark:text-white shadow-2xs active:scale-95 transition-all flex items-center justify-center cursor-pointer"
          >
            {d}
          </button>
        ))}

        <button
          type="button"
          onClick={handleClear}
          className="h-10 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-slate-850 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 font-sans font-bold text-xs text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 shadow-2xs active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          Clear
        </button>

        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="h-10 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 font-mono font-bold text-base text-slate-900 dark:text-white shadow-2xs active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleBackspace}
          className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-600 dark:text-slate-300 shadow-2xs active:scale-95 transition-all flex items-center justify-center cursor-pointer"
          aria-label="Backspace"
        >
          <Backspace className="w-5 h-5" />
        </button>
      </div>

      {/* Done / Close Bar */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-sans font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all cursor-pointer"
        >
          <Check className="w-4 h-4" weight="bold" />
          <span>Done</span>
        </button>
      )}
    </div>
  );
};
