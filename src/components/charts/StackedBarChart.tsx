"use client";

interface StackedData {
  label: string;
  segments: { value: number; color: string; label: string }[];
}

interface StackedBarChartProps {
  data: StackedData[];
  height?: number;
  width?: number;
  legend?: boolean;
}

export default function StackedBarChart({
  data,
  height = 200,
  width = 600,
  legend = true,
}: StackedBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>
        No data available
      </div>
    );
  }

  const maxVal = Math.max(
    ...data.map((d) => d.segments.reduce((s, seg) => s + seg.value, 0)),
    1,
  );

  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const barW = Math.min(40, chartW / data.length - 8);
  const gap = (chartW - barW * data.length) / Math.max(data.length, 1);

  // Collect unique segment labels for legend
  const legendItems = data[0]?.segments.map((s) => ({ label: s.label, color: s.color })) ?? [];

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={padding.top + chartH * (1 - pct)}
              x2={width - padding.right}
              y2={padding.top + chartH * (1 - pct)}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
            <text
              x={padding.left - 8}
              y={padding.top + chartH * (1 - pct) + 4}
              textAnchor="end"
              className="text-[10px] fill-gray-400"
            >
              {Math.round(maxVal * pct)}
            </text>
          </g>
        ))}

        {/* Stacked bars */}
        {data.map((d, i) => {
          const barX = padding.left + gap / 2 + i * (barW + gap);
          let cumulativeH = 0;

          return (
            <g key={i}>
              {d.segments.map((seg, j) => {
                const segH = (seg.value / maxVal) * chartH;
                const segY = padding.top + chartH - cumulativeH - segH;
                cumulativeH += segH;

                return (
                  <rect
                    key={j}
                    x={barX}
                    y={segY}
                    width={barW}
                    height={segH}
                    fill={seg.color}
                    rx={j === d.segments.length - 1 ? 3 : 0}
                  />
                );
              })}
              <text
                x={barX + barW / 2}
                y={height - 8}
                textAnchor="middle"
                className="text-[10px] fill-gray-400"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {legend && legendItems.length > 0 && (
        <div className="flex items-center gap-4 justify-center mt-2">
          {legendItems.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-gray-500">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
