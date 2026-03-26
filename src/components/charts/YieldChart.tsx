'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Area, ComposedChart } from 'recharts';

interface YieldChartProps {
  data: { batchNumber: string; yield: number; date: string; standardYield?: number }[];
  standardYield?: number;
  height?: number;
}

export default function YieldChart({ data, standardYield, height = 280 }: YieldChartProps) {
  if (!data || data.length === 0) {
    return <div className="card p-6 flex items-center justify-center h-48 text-gray-400 text-sm">No yield data</div>;
  }

  const yields = data.map(d => d.yield);
  const minY = Math.min(...yields) - 3;
  const maxY = Math.max(...yields) + 3;

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Batch Yield Trend</h3>
        <span className="text-xs text-gray-400 font-mono">(%)</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="batchNumber" tick={{ fontSize: 10, fill: '#9CA3AF' }} angle={-45} textAnchor="end" height={60}
            interval={data.length > 20 ? Math.floor(data.length / 10) : 0} />
          <YAxis domain={[minY, maxY]} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={v => v.toFixed(1)} width={50} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-white/95 backdrop-blur border border-cream-200 rounded-lg p-3 shadow-lg text-xs">
                  <p className="font-semibold text-gray-900">{d.batchNumber}</p>
                  <p className="font-mono text-teal-700 text-sm">{d.yield?.toFixed(1)}%</p>
                  {d.date && <p className="text-gray-400">{d.date}</p>}
                </div>
              );
            }}
          />
          {standardYield && (
            <ReferenceLine y={standardYield} stroke="#D4A843" strokeDasharray="6 3" strokeWidth={1.5}
              label={{ value: `Std: ${standardYield}%`, position: 'right', fontSize: 9, fill: '#D4A843' }} />
          )}
          <Area type="monotone" dataKey="yield" fill="#1A6B5A" fillOpacity={0.06} stroke="none" />
          <Line type="monotone" dataKey="yield" stroke="#1A6B5A" strokeWidth={2}
            dot={{ r: 3, fill: '#1A6B5A', stroke: '#fff', strokeWidth: 1.5 }}
            activeDot={{ r: 5, fill: '#1A6B5A', stroke: '#fff', strokeWidth: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
