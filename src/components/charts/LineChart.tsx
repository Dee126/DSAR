"use client";

interface DataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
  width?: number;
  showDots?: boolean;
  showArea?: boolean;
  forecast?: DataPoint[];
  forecastColor?: string;
}

export default function LineChart({
  data,
  color = "#6366f1",
  height = 200,
  width = 600,
  showDots = true,
  showArea = false,
  forecast,
  forecastColor = "#a5b4fc",
}: LineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>
        No data available
      </div>
    );
  }

  const allPoints = [...data, ...(forecast ?? [])];
  const values = allPoints.map((d) => d.value);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  function x(i: number) {
    return padding.left + (i / Math.max(allPoints.length - 1, 1)) * chartW;
  }
  function y(v: number) {
    return padding.top + chartH - ((v - minVal) / range) * chartH;
  }

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.value)}`)
    .join(" ");

  const areaPath = showArea
    ? `${linePath} L ${x(data.length - 1)} ${y(minVal)} L ${x(0)} ${y(minVal)} Z`
    : "";

  let forecastPath = "";
  if (forecast && forecast.length > 0) {
    const startIdx = data.length - 1;
    const startPoint = `M ${x(startIdx)} ${y(data[data.length - 1].value)}`;
    const forecastPoints = forecast
      .map((d, i) => `L ${x(startIdx + 1 + i)} ${y(d.value)}`)
      .join(" ");
    forecastPath = startPoint + " " + forecastPoints;
  }

  // Y-axis grid lines
  const gridLines = 5;
  const gridValues = Array.from({ length: gridLines }, (_, i) =>
    minVal + (range * i) / (gridLines - 1),
  );

  // Show ~6 x-axis labels
  const labelStep = Math.max(1, Math.floor(allPoints.length / 6));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid */}
      {gridValues.map((v, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            y1={y(v)}
            x2={width - padding.right}
            y2={y(v)}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
          <text x={padding.left - 8} y={y(v) + 4} textAnchor="end" className="text-[10px] fill-gray-400">
            {v % 1 === 0 ? v : v.toFixed(1)}
          </text>
        </g>
      ))}

      {/* Area fill */}
      {showArea && <path d={areaPath} fill={color} opacity={0.1} />}

      {/* Main line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} />

      {/* Forecast line */}
      {forecastPath && (
        <path d={forecastPath} fill="none" stroke={forecastColor} strokeWidth={2} strokeDasharray="6 3" />
      )}

      {/* Dots */}
      {showDots &&
        data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.value)} r={3} fill={color} />
        ))}

      {/* Forecast dots */}
      {forecast?.map((d, i) => (
        <circle
          key={`f-${i}`}
          cx={x(data.length + i)}
          cy={y(d.value)}
          r={3}
          fill={forecastColor}
          strokeDasharray="2 2"
        />
      ))}

      {/* X-axis labels */}
      {allPoints.map((d, i) =>
        i % labelStep === 0 || i === allPoints.length - 1 ? (
          <text
            key={i}
            x={x(i)}
            y={height - 8}
            textAnchor="middle"
            className="text-[10px] fill-gray-400"
          >
            {d.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}
