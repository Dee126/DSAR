"use client";

interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarData[];
  height?: number;
  width?: number;
  defaultColor?: string;
  horizontal?: boolean;
}

export default function BarChart({
  data,
  height = 200,
  width = 600,
  defaultColor = "#6366f1",
  horizontal = false,
}: BarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>
        No data available
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const padding = { top: 20, right: 20, bottom: 40, left: horizontal ? 100 : 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  if (horizontal) {
    const barH = Math.min(30, chartH / data.length - 4);
    const gap = (chartH - barH * data.length) / Math.max(data.length - 1, 1);

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {data.map((d, i) => {
          const barY = padding.top + i * (barH + gap);
          const barW = (d.value / maxVal) * chartW;
          return (
            <g key={i}>
              <rect
                x={padding.left}
                y={barY}
                width={barW}
                height={barH}
                rx={3}
                fill={d.color ?? defaultColor}
              />
              <text
                x={padding.left - 8}
                y={barY + barH / 2 + 4}
                textAnchor="end"
                className="text-[10px] fill-gray-500"
              >
                {d.label}
              </text>
              <text
                x={padding.left + barW + 6}
                y={barY + barH / 2 + 4}
                className="text-[10px] fill-gray-600 font-medium"
              >
                {d.value}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  // Vertical bars
  const barW = Math.min(40, chartW / data.length - 8);
  const totalBarW = data.length * barW;
  const gap = (chartW - totalBarW) / Math.max(data.length, 1);

  return (
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

      {/* Bars */}
      {data.map((d, i) => {
        const barX = padding.left + gap / 2 + i * (barW + gap);
        const barH = (d.value / maxVal) * chartH;
        return (
          <g key={i}>
            <rect
              x={barX}
              y={padding.top + chartH - barH}
              width={barW}
              height={barH}
              rx={3}
              fill={d.color ?? defaultColor}
            />
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
  );
}
