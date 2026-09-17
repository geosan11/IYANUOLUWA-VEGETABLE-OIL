import React from 'react';

interface DonutChartSegment {
  label: string;
  value: number;
  /** Tailwind text-color class (e.g. 'text-emerald-500') — used via stroke="currentColor". */
  colorCls: string;
}

interface DonutChartProps {
  segments: DonutChartSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}

/**
 * Lightweight donut/ring chart built from stacked SVG circle arcs
 * (stroke-dasharray technique) — no charting library, matches the app's
 * existing hand-rolled SVG visualization convention.
 */
export const DonutChart: React.FC<DonutChartProps> = ({
  segments,
  size = 120,
  strokeWidth = 16,
  centerLabel,
  centerValue
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  let cumulative = 0;

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-100 dark:text-slate-800"
          />
          {total > 0 &&
            segments
              .filter(seg => seg.value > 0)
              .map((seg, i) => {
                const fraction = seg.value / total;
                const segLength = fraction * circumference;
                const offset = -cumulative;
                cumulative += segLength;
                return (
                  <circle
                    key={i}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${segLength} ${circumference - segLength}`}
                    strokeDashoffset={offset}
                    strokeLinecap="butt"
                    className={`${seg.colorCls} transition-all duration-700`}
                  />
                );
              })}
        </svg>
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue && (
              <span className="font-mono tabular-nums font-extrabold text-lg text-slate-900 dark:text-white">
                {centerValue}
              </span>
            )}
            {centerLabel && (
              <span className="text-[9px] font-sans text-slate-500 dark:text-slate-400 text-center leading-tight">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="space-y-1.5 min-w-0">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs font-sans">
            <span className={`w-2 h-2 rounded-full shrink-0 ${seg.colorCls.replace('text-', 'bg-')}`} />
            <span className="text-slate-600 dark:text-slate-300 truncate">{seg.label}</span>
            <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white ml-auto">
              {seg.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DonutChart;
