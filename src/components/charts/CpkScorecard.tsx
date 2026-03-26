'use client';

interface ParamStat {
  parameter: {
    id: string;
    name: string;
    unit: string | null;
    usl: number | null;
    lsl: number | null;
    type: string;
    is_critical: number;
  };
  capability: {
    n: number;
    mean: number;
    sd: number;
    rsd: number;
    min: number;
    max: number;
    cpk: number | null;
    ppk: number | null;
    cp: number | null;
    cpkStatus: string;
    nelsonViolations: { rule: number; ruleName: string; indices: number[] }[];
  } | null;
}

interface CpkScorecardProps {
  parameterStats: ParamStat[];
  onSelect?: (paramId: string) => void;
  selectedParam?: string | null;
}

function getCpkColor(cpk: number | null, status: string): string {
  if (cpk == null || status === 'insufficient_data') return 'bg-gray-50 border-gray-200 text-gray-400';
  if (cpk >= 1.33) return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (cpk >= 1.0) return 'bg-amber-50 border-amber-200 text-amber-700';
  return 'bg-red-50 border-red-200 text-red-700';
}

function getCpkLabel(cpk: number | null, status: string): string {
  if (cpk == null || status === 'insufficient_data') return '—';
  return cpk.toFixed(2);
}

export default function CpkScorecard({ parameterStats, onSelect, selectedParam }: CpkScorecardProps) {
  if (!parameterStats || parameterStats.length === 0) {
    return <div className="card p-6 text-center text-gray-400 text-sm">No parameters defined</div>;
  }

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Process Capability (Cpk)</h3>
        <div className="flex items-center gap-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-200 inline-block" /> ≥1.33</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-200 inline-block" /> 1.0–1.33</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-200 inline-block" /> &lt;1.0</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {parameterStats.map((ps) => {
          const cpk = ps.capability?.cpk ?? null;
          const status = ps.capability?.cpkStatus || 'insufficient_data';
          const violations = ps.capability?.nelsonViolations || [];
          const isSelected = selectedParam === ps.parameter.id;

          return (
            <button
              key={ps.parameter.id}
              onClick={() => onSelect?.(ps.parameter.id)}
              className={`text-left p-2.5 rounded-lg border transition-all duration-150 hover:shadow-sm ${getCpkColor(cpk, status)} ${isSelected ? 'ring-2 ring-teal-600 shadow-md' : ''}`}
            >
              <div className="flex items-start justify-between">
                <p className="text-[11px] font-medium leading-tight truncate pr-1">{ps.parameter.name}</p>
                {ps.parameter.is_critical === 1 && (
                  <span className="text-[8px] bg-white/60 rounded px-1 shrink-0">CQA</span>
                )}
              </div>
              <p className="text-lg font-mono font-bold mt-1">{getCpkLabel(cpk, status)}</p>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] opacity-70">n={ps.capability?.n || 0}</span>
                {violations.length > 0 && (
                  <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded">
                    {violations.length} alert{violations.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
