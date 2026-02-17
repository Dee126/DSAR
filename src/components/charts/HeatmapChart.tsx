"use client";

interface HeatmapCell {
  row: string;
  col: string;
  value: number;
}

interface HeatmapChartProps {
  data: HeatmapCell[];
  rows: string[];
  cols: string[];
  colorScale?: { low: string; mid: string; high: string };
}

function interpolateColor(value: number, max: number, colors: { low: string; mid: string; high: string }): string {
  if (max === 0) return colors.low;
  const pct = Math.min(1, value / max);
  if (pct < 0.5) return colors.low;
  if (pct < 0.75) return colors.mid;
  return colors.high;
}

export default function HeatmapChart({
  data,
  rows,
  cols,
  colorScale = { low: "#dcfce7", mid: "#fef9c3", high: "#fecaca" },
}: HeatmapChartProps) {
  if (data.length === 0 || rows.length === 0 || cols.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400 h-32">
        No data available
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const valueMap = new Map(data.map((d) => [`${d.row}-${d.col}`, d.value]));

  const cellSize = 40;

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="text-xs text-gray-400 p-1" />
            {cols.map((col) => (
              <th key={col} className="text-xs text-gray-500 p-1 font-normal text-center" style={{ minWidth: cellSize }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row}>
              <td className="text-xs text-gray-500 p-1 pr-2 text-right whitespace-nowrap">{row}</td>
              {cols.map((col) => {
                const value = valueMap.get(`${row}-${col}`) ?? 0;
                const bgColor = interpolateColor(value, maxVal, colorScale);
                return (
                  <td
                    key={col}
                    className="text-xs text-center p-1 font-medium"
                    style={{ backgroundColor: bgColor, minWidth: cellSize, minHeight: cellSize }}
                  >
                    {value > 0 ? value : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
