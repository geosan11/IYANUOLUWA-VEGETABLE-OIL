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
      className={`p-4 rounded-2xl bg-[#0B1120] border border-slate-800 shadow-2xl space-y-3.5 select-none animate-in fade-in zoom-in-95 duration-150 max-w-sm ${className}`}
    >
      {/* Header: Target Tabs & Active Bold Value Display */}
      <div className="flex items-center justify-between gap-3 bg-[#111A2E] p-2 rounded-xl border border-slate-850">
        <div className="flex items-center gap-1 bg-[#0B1120] p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => onTargetChange('qty')}
            className={`px-3 py-1.5 rounded-md text-xs font-sans font-bold transition-all cursor-pointer ${
              activeTarget === 'qty'
                ? 'bg-brand-500 text-slate-950 font-black shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Qty
          </button>
          <button
            type="button"
            onClick={() => onTargetChange('price')}
            className={`px-3 py-1.5 rounded-md text-xs font-sans font-bold transition-all cursor-pointer ${
              activeTarget === 'price'
                ? 'bg-brand-500 text-slate-950 font-black shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Price
          </button>
        </div>

        {/* Large Bold Display of Current Value */}
        <div className="text-right pr-1">
          <span className="text-[10px] font-mono font-bold uppercase text-slate-400 tracking-wider block">
            {activeTarget === 'qty' ? 'Units' : 'Unit Rate'}
          </span>
          <span className="font-mono font-black text-xl text-white tracking-tight tabular-nums block leading-tight">
            {activeTarget === 'qty' ? `${qty} pk` : price !== '' ? `₦${Number(price).toLocaleString()}` : '₦0'}
          </span>
        </div>
      </div>

      {/* Streamlined 1-Row Quick Presets */}
      <div className="flex items-center gap-1.5">
        {activeTarget === 'qty' ? (
          <>
            {[5, 10, 20, 50].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => onQtyChange(n)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-sans font-bold transition-all cursor-pointer ${
                  qty === n
                    ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40'
                    : 'bg-[#152138] hover:bg-[#1C2C4B] text-slate-300 border border-slate-750'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => addQtyDelta(5)}
              className="px-2.5 py-1.5 rounded-lg bg-[#152138] hover:bg-[#1C2C4B] text-brand-400 text-xs font-sans font-bold border border-slate-750 cursor-pointer"
            >
              +5
            </button>
          </>
        ) : (
          <>
            {[-1000, 500, 1000, 5000].map(delta => (
              <button
                key={delta}
                type="button"
                onClick={() => addPriceDelta(delta)}
                className="flex-1 py-1.5 rounded-lg bg-[#152138] hover:bg-[#1C2C4B] text-slate-300 text-xs font-sans font-bold border border-slate-750 transition-colors cursor-pointer"
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
            {standardPrice && (
              <button
                type="button"
                onClick={onResetPrice}
                className="px-2.5 py-1.5 rounded-lg bg-[#152138] hover:bg-[#1C2C4B] text-brand-400 text-xs font-sans font-bold flex items-center gap-1 border border-slate-750 cursor-pointer"
                title="Reset to standard rate"
              >
                <ArrowsClockwise className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* 3x4 Number Grid: Bold, compact, non-wide numbers on dark tiles */}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button
            key={d}
            type="button"
            onClick={() => handleDigit(d)}
            className="h-12 rounded-xl bg-[#141E34] hover:bg-[#1C2A48] active:bg-brand-500 active:text-slate-950 border border-slate-750/80 font-sans font-black text-xl text-white tracking-tight shadow-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer"
          >
            {d}
          </button>
        ))}

        <button
          type="button"
          onClick={handleClear}
          className="h-12 rounded-xl bg-[#182033] hover:bg-rose-950/40 hover:border-rose-700/60 border border-slate-750 font-sans font-bold text-xs uppercase tracking-wider text-slate-400 hover:text-rose-400 shadow-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          Clear
        </button>

        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="h-12 rounded-xl bg-[#141E34] hover:bg-[#1C2A48] active:bg-brand-500 active:text-slate-950 border border-slate-750/80 font-sans font-black text-xl text-white tracking-tight shadow-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleBackspace}
          className="h-12 rounded-xl bg-[#182033] hover:bg-[#222E4A] border border-slate-750 text-slate-300 hover:text-white shadow-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer"
          aria-label="Backspace"
        >
          <Backspace className="w-5 h-5" weight="bold" />
        </button>
      </div>

      {/* Done Confirmation Button */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-black text-sm flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all cursor-pointer"
        >
          <Check className="w-4 h-4" weight="bold" />
          <span>Done</span>
        </button>
      )}
    </div>
  );
};
