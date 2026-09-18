import React from 'react';

interface MiniBarChartDatum {
  label: string;
  value: number;
}

interface MiniBarChartProps {
  data: MiniBarChartDatum[];
  colorCls?: string;
  formatValue?: (value: number) => string;
  height?: number;
  emptyLabel?: string;
  /** Highlights the last bar (e.g. "today") with a distinct color/ring. */
  highlightLast?: boolean;
}

/**
 * Lightweight vertical bar chart — no charting library, bars are just
 * height-scaled flex children. Matches the app's existing hand-rolled SVG
 * visualization convention (TankGauge, KegVisual25L) rather than pulling in
 * a dependency for what's a handful of simple bars.
 */
export const MiniBarChart: React.FC<MiniBarChartProps> = ({
  data,
  colorCls = 'bg-brand-500',
  formatValue = (v) => v.toLocaleString(),
  height = 140,
  emptyLabel = 'No data yet',
  highlightLast = false
}) => {
  const max = Math.max(1, ...data.map(d => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  const hasData = data.some(d => d.value > 0);

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center text-xs font-sans text-slate-400 dark:text-slate-500 h-full"
        style={{ minHeight: height }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-2">
      <div className="flex items-baseline justify-between shrink-0">
        <span className="text-[10px] font-sans font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Total
        </span>
        <span className="text-sm font-mono tabular-nums font-bold text-slate-900 dark:text-white">
          {formatValue(total)}
        </span>
      </div>
      <div className="w-full flex-1" style={{ minHeight: height }}>
        <div className="flex items-end justify-between gap-1.5 h-full">
          {data.map((d, i) => {
            const isLast = highlightLast && i === data.length - 1;
            const pct = d.value > 0 ? Math.max(6, Math.round((d.value / max) * 100)) : 0;
            return (
              <div key={i} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-1">
                <span
                  className={`text-[9px] font-mono tabular-nums leading-tight text-center truncate w-full ${
                    d.value > 0 ? 'text-slate-600 dark:text-slate-300 font-bold' : 'text-slate-300 dark:text-slate-700'
                  }`}
                >
                  {d.value > 0 ? formatValue(d.value) : '·'}
                </span>
                <div className="w-full flex items-end justify-center h-full">
                  {d.value > 0 ? (
                    <div
                      className={`w-full max-w-[28px] rounded-t-md transition-all duration-500 ${
                        isLast ? `${colorCls} ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-900 ring-amber-400` : colorCls
                      }`}
                      style={{ height: `${pct}%` }}
                      title={`${d.label}: ${formatValue(d.value)}`}
                    />
                  ) : (
                    <div className="w-full max-w-[28px] h-[3px] rounded-full bg-slate-200 dark:bg-slate-800" title={`${d.label}: ${formatValue(0)}`} />
                  )}
                </div>
                <span className={`text-[9px] font-sans truncate w-full text-center ${isLast ? 'font-bold text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MiniBarChart;
