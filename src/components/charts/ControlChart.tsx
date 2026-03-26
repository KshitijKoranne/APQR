'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer, Dot } from 'recharts';

interface ChartPoint {
  index: number;
  batchNumber: string;
  value: number;
  ucl: number;
  lcl: number;
  uwl: number;
  lwl: number;
  mean: number;
  usl?: number;
  lsl?: number;
  violatedRules: number[];
}

interface ControlChartProps {
  data: ChartPoint[];
  title: string;
  unit?: string;
  height?: number;
}

function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  if (!payload) return null;
  const hasViolation = payload.violatedRules && payload.violatedRules.length > 0;
  const isOOS = (payload.usl != null && payload.value > payload.usl) ||
                (payload.lsl != null && payload.value < payload.lsl);

  if (isOOS) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill="#EF4444" stroke="#fff" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={10} fill="none" stroke="#EF4444" strokeWidth={1.5} strokeDasharray="3 2" />
      </g>
    );
  }
  if (hasViolation) {
    return (
      <g>
        <polygon points={`${cx},${cy - 7} ${cx + 6},${cy + 4} ${cx - 6},${cy + 4}`} fill="#F59E0B" stroke="#fff" strokeWidth={1.5} />
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={3.5} fill="#1A6B5A" stroke="#fff" strokeWidth={1.5} />;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white/95 backdrop-blur border border-cream-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-900 mb-1">{d.batchNumber}</p>
      <p className="font-mono text-teal-700 text-sm">{d.value?.toFixed(3)}</p>
      <div className="mt-1.5 space-y-0.5 text-gray-500">
        <p>Mean: {d.mean?.toFixed(3)}</p>
        <p>UCL: {d.ucl?.toFixed(3)} | LCL: {d.lcl?.toFixed(3)}</p>
        {d.usl != null && <p className="text-red-600">USL: {d.usl}</p>}
        {d.lsl != null && <p className="text-red-600">LSL: {d.lsl}</p>}
      </div>
      {d.violatedRules?.length > 0 && (
        <p className="mt-1.5 text-amber-600 font-medium">
          ⚠ Nelson Rule {d.violatedRules.join(', ')} violated
        </p>
      )}
    </div>
  );
}

export default function ControlChart({ data, title, unit, height = 300 }: ControlChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-6 flex items-center justify-center h-48 text-gray-400 text-sm">
        No data available for chart
      </div>
    );
  }

  const first = data[0];
  const allValues = data.map((d) => d.value);
  const minY = Math.min(...allValues, first.lcl, first.lsl ?? Infinity) * 0.995;
  const maxY = Math.max(...allValues, first.ucl, first.usl ?? -Infinity) * 1.005;

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {unit && <span className="text-xs text-gray-400 font-mono">({unit})</span>}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          {/* Zone shading: 1σ, 2σ, 3σ */}
          <ReferenceArea y1={first.lwl} y2={first.uwl} fill="#1A6B5A" fillOpacity={0.04} />
          <ReferenceArea y1={first.uwl} y2={first.ucl} fill="#F59E0B" fillOpacity={0.04} />
          <ReferenceArea y1={first.lcl} y2={first.lwl} fill="#F59E0B" fillOpacity={0.04} />

          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="batchNumber"
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            angle={-45}
            textAnchor="end"
            height={60}
            interval={data.length > 20 ? Math.floor(data.length / 10) : 0}
          />
          <YAxis
            domain={[minY, maxY]}
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            tickFormatter={(v) => v.toFixed(2)}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Spec limits */}
          {first.usl != null && (
            <ReferenceLine y={first.usl} stroke="#EF4444" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: 'USL', position: 'right', fontSize: 9, fill: '#EF4444' }} />
          )}
          {first.lsl != null && (
            <ReferenceLine y={first.lsl} stroke="#EF4444" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: 'LSL', position: 'right', fontSize: 9, fill: '#EF4444' }} />
          )}

          {/* Control limits */}
          <ReferenceLine y={first.ucl} stroke="#9CA3AF" strokeDasharray="4 2" label={{ value: 'UCL', position: 'right', fontSize: 9, fill: '#9CA3AF' }} />
          <ReferenceLine y={first.lcl} stroke="#9CA3AF" strokeDasharray="4 2" label={{ value: 'LCL', position: 'right', fontSize: 9, fill: '#9CA3AF' }} />
          <ReferenceLine y={first.mean} stroke="#1A6B5A" strokeDasharray="2 2" strokeWidth={1} label={{ value: 'X̄', position: 'right', fontSize: 9, fill: '#1A6B5A' }} />

          <Line
            type="monotone"
            dataKey="value"
            stroke="#1A6B5A"
            strokeWidth={1.5}
            dot={<CustomDot />}
            activeDot={{ r: 5, fill: '#1A6B5A', stroke: '#fff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400 justify-center">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-600 inline-block" /> Normal</span>
        <span className="flex items-center gap-1"><span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-amber-400 inline-block" /> Nelson Violation</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Out of Spec</span>
      </div>
    </div>
  );
}
