"use client";

interface GaugeChartProps {
  value: number; // 0-100
  label?: string;
  size?: number;
  thresholds?: { green: number; yellow: number }; // upper bounds
}

export default function GaugeChart({
  value,
  label,
  size = 140,
  thresholds = { green: 70, yellow: 85 },
}: GaugeChartProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const radius = (size - 16) / 2;
  const cx = size / 2;
  const cy = size / 2 + 10;

  // Semi-circle (180 degrees)
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const arcLength = Math.PI * radius;

  function polarToXY(angle: number, r: number) {
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }

  const start = polarToXY(startAngle, radius);
  const end = polarToXY(endAngle, radius);
  const bgArc = `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;

  // Value arc
  const valueAngle = startAngle + (clampedValue / 100) * Math.PI;
  const valueEnd = polarToXY(valueAngle, radius);
  const largeArc = clampedValue > 50 ? 1 : 0;
  const valueArc = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${valueEnd.x} ${valueEnd.y}`;

  // Color based on value
  let color = "#22c55e"; // green
  if (clampedValue > thresholds.yellow) color = "#ef4444"; // red
  else if (clampedValue > thresholds.green) color = "#eab308"; // yellow

  return (
    <div className="inline-flex flex-col items-center">
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        {/* Background arc */}
        <path d={bgArc} fill="none" stroke="#e5e7eb" strokeWidth={10} strokeLinecap="round" />
        {/* Value arc */}
        {clampedValue > 0 && (
          <path d={valueArc} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />
        )}
        {/* Center value */}
        <text x={cx} y={cy - 5} textAnchor="middle" className="text-2xl font-bold" fill={color}>
          {Math.round(clampedValue)}
        </text>
      </svg>
      {label && <span className="text-xs text-gray-500 -mt-1">{label}</span>}
    </div>
  );
}
