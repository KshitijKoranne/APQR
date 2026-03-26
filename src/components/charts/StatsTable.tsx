'use client';

interface ParamStat {
  parameter: { id: string; name: string; unit: string | null; usl: number | null; lsl: number | null; type: string; is_critical: number };
  capability: {
    n: number; mean: number; sd: number; rsd: number; min: number; max: number;
    cp: number | null; cpk: number | null; pp: number | null; ppk: number | null;
    ucl: number; lcl: number; cpkStatus: string;
    nelsonViolations: { rule: number; ruleName: string }[];
  } | null;
}

export default function StatsTable({ parameterStats }: { parameterStats: ParamStat[] }) {
  if (!parameterStats || parameterStats.length === 0) return null;

  const fmt = (v: number | null | undefined, dec = 3) => {
    if (v == null) return '—';
    return v.toFixed(dec);
  };

  const cpkBadge = (cpk: number | null, status: string) => {
    if (cpk == null || status === 'insufficient_data') return <span className="badge badge-gray">N/A</span>;
    if (cpk >= 1.33) return <span className="badge badge-green">{cpk.toFixed(2)}</span>;
    if (cpk >= 1.0) return <span className="badge badge-amber">{cpk.toFixed(2)}</span>;
    return <span className="badge badge-red">{cpk.toFixed(2)}</span>;
  };

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-cream-200">
        <h3 className="text-sm font-semibold text-gray-800">Statistical Summary</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            <tr>
              <th className="sticky left-0 bg-cream-100 z-10">Parameter</th>
              <th>n</th>
              <th>Mean</th>
              <th>SD</th>
              <th>RSD%</th>
              <th>Min</th>
              <th>Max</th>
              <th>LSL</th>
              <th>USL</th>
              <th>UCL</th>
              <th>LCL</th>
              <th>Cp</th>
              <th>Cpk</th>
              <th>Ppk</th>
              <th>Alerts</th>
            </tr>
          </thead>
          <tbody>
            {parameterStats.map((ps) => {
              const c = ps.capability;
              return (
                <tr key={ps.parameter.id}>
                  <td className="sticky left-0 bg-white z-10 !font-sans font-medium text-gray-800 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {ps.parameter.name}
                      {ps.parameter.is_critical === 1 && (
                        <span className="text-[8px] bg-teal-50 text-teal-700 px-1 py-0.5 rounded ring-1 ring-teal-200">CQA</span>
                      )}
                    </div>
                    {ps.parameter.unit && <span className="text-[10px] text-gray-400">({ps.parameter.unit})</span>}
                  </td>
                  <td>{c?.n || 0}</td>
                  <td>{fmt(c?.mean)}</td>
                  <td>{fmt(c?.sd)}</td>
                  <td>{fmt(c?.rsd, 1)}</td>
                  <td>{fmt(c?.min)}</td>
                  <td>{fmt(c?.max)}</td>
                  <td className="text-red-500">{fmt(ps.parameter.lsl, 2)}</td>
                  <td className="text-red-500">{fmt(ps.parameter.usl, 2)}</td>
                  <td>{fmt(c?.ucl)}</td>
                  <td>{fmt(c?.lcl)}</td>
                  <td>{fmt(c?.cp, 2)}</td>
                  <td>{cpkBadge(c?.cpk ?? null, c?.cpkStatus || 'insufficient_data')}</td>
                  <td>{fmt(c?.ppk, 2)}</td>
                  <td>
                    {c?.nelsonViolations && c.nelsonViolations.length > 0 ? (
                      <span className="badge badge-amber">
                        {c.nelsonViolations.map(v => `R${v.rule}`).join(', ')}
                      </span>
                    ) : (
                      <span className="text-emerald-500 text-xs">✓</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
