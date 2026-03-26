'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface BatchSummaryProps {
  summary: {
    total: number;
    released: number;
    rejected: number;
    reprocessed: number;
    under_process: number;
  };
}

const COLORS = {
  released: '#22C55E',
  rejected: '#EF4444',
  reprocessed: '#F59E0B',
  under_process: '#6B7280',
};

const LABELS: Record<string, string> = {
  released: 'Released',
  rejected: 'Rejected',
  reprocessed: 'Reprocessed',
  under_process: 'Under Process',
};

export default function BatchSummary({ summary }: BatchSummaryProps) {
  const data = [
    { name: 'Released', value: summary.released, color: COLORS.released },
    { name: 'Rejected', value: summary.rejected, color: COLORS.rejected },
    { name: 'Reprocessed', value: summary.reprocessed, color: COLORS.reprocessed },
    { name: 'Under Process', value: summary.under_process, color: COLORS.under_process },
  ].filter((d) => d.value > 0);

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Batch Summary</h3>
      <div className="flex items-center gap-4">
        <div className="relative w-28 h-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2} dataKey="value" strokeWidth={0}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                return (
                  <div className="bg-white/95 border border-cream-200 rounded-lg p-2 shadow-lg text-xs">
                    <span className="font-medium">{payload[0].name}: {payload[0].value}</span>
                  </div>
                );
              }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-gray-900">{summary.total}</span>
          </div>
        </div>
        <div className="space-y-1.5 flex-1">
          {Object.entries(COLORS).map(([key, color]) => {
            const count = summary[key as keyof typeof summary];
            if (typeof count !== 'number') return null;
            return (
              <div key={key} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-gray-600">{LABELS[key]}</span>
                </div>
                <span className="font-mono font-medium text-gray-900">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
