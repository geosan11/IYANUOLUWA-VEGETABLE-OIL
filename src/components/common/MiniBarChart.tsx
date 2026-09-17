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
  height = 120,
  emptyLabel = 'No data yet'
}) => {
  const max = Math.max(1, ...data.map(d => d.value));
  const hasData = data.some(d => d.value > 0);

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center text-xs font-sans text-slate-400 dark:text-slate-500"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <div className="flex items-end justify-between gap-1.5 h-full">
        {data.map((d, i) => {
          const pct = Math.max(2, Math.round((d.value / max) * 100));
          return (
            <div key={i} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-1 group">
              <span className="text-[9px] font-mono tabular-nums text-slate-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                {formatValue(d.value)}
              </span>
              <div className="w-full flex items-end justify-center h-full">
                <div
                  className={`w-full max-w-[26px] rounded-t-md ${colorCls} transition-all duration-500`}
                  style={{ height: `${pct}%` }}
                  title={`${d.label}: ${formatValue(d.value)}`}
                />
              </div>
              <span className="text-[9px] font-sans text-slate-500 dark:text-slate-400 truncate w-full text-center">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MiniBarChart;
