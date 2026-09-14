import React from 'react';

interface KegFleetLifecycleDiagramProps {
  inYardCount?: number;
  loanedCount?: number;
  overdueCount?: number;
  depositRate?: number;
  isCompact?: boolean;
}

export const KegFleetLifecycleDiagram: React.FC<KegFleetLifecycleDiagramProps> = ({
  inYardCount = 1420,
  loanedCount = 380,
  overdueCount = 45,
  depositRate = 2000,
  isCompact = false,
}) => {
  const depositLiability = loanedCount * depositRate;

  return (
    <div className="rounded-2xl depot-card p-4 sm:p-5 border border-slate-200 dark:border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold text-lg">
            📦
          </div>
          <div>
            <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              Keg Container Fleet Lifecycle
              <span className="text-xs px-2 py-0.5 rounded-full font-sans font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                25L Jerrycans
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">
              Track container assets across yard stock, customer loans, and gate returns.
            </p>
          </div>
        </div>

        <div className="self-start sm:self-auto">
          <span className="badge-purple inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold">
            Held Deposits: ₦{depositLiability.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Visual Workflow Steps (Horizontal Flow) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
        {/* Step 1: Yard Stock */}
        <div className="relative p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-2 hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-heading font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              1. Yard Storage
            </span>
            <span className="text-lg">🏭</span>
          </div>
          <div>
            <div className="text-xl font-heading font-bold text-slate-900 dark:text-white font-mono tabular-nums">
              {inYardCount.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
              Clean, empty & ready for filling at pumps.
            </div>
          </div>
          <div className="text-[10px] uppercase font-mono font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-slate-200/60 dark:border-slate-800">
            Available on Site
          </div>
        </div>

        {/* Step 2: Customer Loan */}
        <div className="relative p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-2 hover:border-sky-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-heading font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              2. Customer Loan
            </span>
            <span className="text-lg">🚚</span>
          </div>
          <div>
            <div className="text-xl font-heading font-bold text-sky-600 dark:text-sky-400 font-mono tabular-nums">
              {loanedCount.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
              Dispatched with oil. ₦{depositRate.toLocaleString()} deposit held.
            </div>
          </div>
          <div className="text-[10px] uppercase font-mono font-bold text-sky-600 dark:text-sky-400 pt-1 border-t border-slate-200/60 dark:border-slate-800">
            Active in Field
          </div>
        </div>

        {/* Step 3: Gate Return */}
        <div className="relative p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-2 hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-heading font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              3. Gate Return Bay
            </span>
            <span className="text-lg">🔄</span>
          </div>
          <div>
            <div className="text-xl font-heading font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
              {overdueCount.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
              Returned by driver, inspected & deposit refunded.
            </div>
          </div>
          <div className="text-[10px] uppercase font-mono font-bold text-amber-600 dark:text-amber-400 pt-1 border-t border-slate-200/60 dark:border-slate-800">
            {overdueCount > 0 ? `${overdueCount} Pending Audit` : 'All Audited'}
          </div>
        </div>

        {/* Step 4: Outright Sale */}
        <div className="relative p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-2 hover:border-purple-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-heading font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              4. Outright Purchase
            </span>
            <span className="text-lg">🏷️</span>
          </div>
          <div>
            <div className="text-xl font-heading font-bold text-purple-600 dark:text-purple-400 font-mono tabular-nums">
              Permanent
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
              Customer pays in full to keep the jerrycans.
            </div>
          </div>
          <div className="text-[10px] uppercase font-mono font-bold text-purple-600 dark:text-purple-400 pt-1 border-t border-slate-200/60 dark:border-slate-800">
            Asset Transferred
          </div>
        </div>
      </div>

      {/* Explanatory Context Box */}
      {!isCompact && (
        <div className="text-xs bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/80 text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
          <span className="text-base leading-none">💡</span>
          <div className="leading-relaxed font-sans">
            <strong className="text-slate-800 dark:text-slate-200">Why Container Tracking Protects Capital:</strong> In edible oil distribution, empty 25L jerrycans represent significant physical capital (₦2,000–₦2,500 each). Holding refundable container deposits guarantees that buyers promptly return empty kegs to your yard rather than diverting them to other dealers.
          </div>
        </div>
      )}
    </div>
  );
};
