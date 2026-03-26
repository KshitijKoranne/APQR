'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ControlChart from '@/components/charts/ControlChart';
import YieldChart from '@/components/charts/YieldChart';
import CpkScorecard from '@/components/charts/CpkScorecard';
import BatchSummary from '@/components/charts/BatchSummary';
import StatsTable from '@/components/charts/StatsTable';

type Tab = 'dashboard' | 'data' | 'deviations' | 'capas' | 'changes' | 'complaints';

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [selectedParam, setSelectedParam] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Qualitative data states
  const [deviations, setDeviations] = useState<any[]>([]);
  const [capas, setCapas] = useState<any[]>([]);
  const [changeControls, setChangeControls] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, prodRes] = await Promise.all([
        fetch(`/api/products/${id}/stats`),
        fetch(`/api/products/${id}`),
      ]);
      const statsData = await statsRes.json();
      const prodData = await prodRes.json();
      setStats(statsData);
      setProduct(prodData);
      setDeviations(prodData.deviations || []);
      setCapas(prodData.capas || []);
      setChangeControls(prodData.changeControls || []);
      setComplaints(prodData.complaints || []);
      if (statsData.parameterStats?.length > 0 && !selectedParam) {
        setSelectedParam(statsData.parameterStats[0].parameter.id);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [id, selectedParam]);

  useEffect(() => { fetchData(); }, [id]);

  // CSV Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);

    try {
      // Dynamic import of XLSX
      const XLSX = (await import('xlsx'));
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          if (jsonRows.length === 0) {
            setUploadResult({ error: 'No data rows found in file' });
            setUploading(false);
            return;
          }

          const res = await fetch(`/api/products/${id}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: jsonRows, parameterMapping: {} }),
          });
          const result = await res.json();
          setUploadResult(result);
          if (result.success) {
            await fetchData();
          }
        } catch (err: any) {
          setUploadResult({ error: err.message });
        }
        setUploading(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setUploadResult({ error: err.message });
      setUploading(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Quick-add forms
  const [showAddDev, setShowAddDev] = useState(false);
  const [devForm, setDevForm] = useState({ deviation_number: '', type: 'minor', description: '', root_cause: '', capa_reference: '', date_raised: '' });

  const addDeviation = async () => {
    if (!devForm.deviation_number || !devForm.description) return;
    await fetch(`/api/products/${id}/deviations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(devForm)
    });
    setShowAddDev(false);
    setDevForm({ deviation_number: '', type: 'minor', description: '', root_cause: '', capa_reference: '', date_raised: '' });
    const res = await fetch(`/api/products/${id}/deviations`);
    setDeviations(await res.json());
  };

  const [showAddCapa, setShowAddCapa] = useState(false);
  const [capaForm, setCapaForm] = useState({ capa_number: '', source_type: '', source_reference: '', description: '', action_taken: '', due_date: '', status: 'open' });

  const addCapa = async () => {
    if (!capaForm.capa_number || !capaForm.description) return;
    await fetch(`/api/products/${id}/capas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(capaForm)
    });
    setShowAddCapa(false);
    setCapaForm({ capa_number: '', source_type: '', source_reference: '', description: '', action_taken: '', due_date: '', status: 'open' });
    const res = await fetch(`/api/products/${id}/capas`);
    setCapas(await res.json());
  };

  const [showAddCC, setShowAddCC] = useState(false);
  const [ccForm, setCcForm] = useState({ cc_number: '', description: '', type: 'process', impact_assessment: '', effective_date: '', status: 'open' });

  const addCC = async () => {
    if (!ccForm.cc_number || !ccForm.description) return;
    await fetch(`/api/products/${id}/change-controls`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ccForm)
    });
    setShowAddCC(false);
    setCcForm({ cc_number: '', description: '', type: 'process', impact_assessment: '', effective_date: '', status: 'open' });
    const res = await fetch(`/api/products/${id}/change-controls`);
    setChangeControls(await res.json());
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full" />
    </div>
  );

  if (!stats || !product) return <div className="text-center py-20 text-gray-500">Product not found</div>;

  const selectedParamStats = stats.parameterStats?.find((ps: any) => ps.parameter.id === selectedParam);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'dashboard', label: 'Analysis Dashboard' },
    { key: 'data', label: 'Batch Data', count: stats.batchCount },
    { key: 'deviations', label: 'Deviations', count: deviations.length },
    { key: 'capas', label: 'CAPAs', count: capas.length },
    { key: 'changes', label: 'Change Controls', count: changeControls.length },
    { key: 'complaints', label: 'Complaints', count: complaints.length },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Product Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => router.push('/products')} className="text-xs text-gray-400 hover:text-teal-600 mb-1">← Products</button>
          <h1 className="font-display text-2xl text-teal-800">{product.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span className="font-mono">{product.code}</span>
            {product.api_grade && <span>· {product.api_grade}</span>}
            {product.batch_size && <span>· {product.batch_size} {product.batch_size_unit}</span>}
          </div>
        </div>
        <span className={`badge ${product.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{product.status}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-cream-200 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.key ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
            {t.count != null && <span className="ml-1.5 bg-cream-100 text-gray-500 px-1.5 py-0.5 rounded-full text-[10px]">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {tab === 'dashboard' && (
        <div className="space-y-5">
          {stats.batchCount === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-gray-500 mb-4">No batch data yet. Upload batch data to see analysis.</p>
              <button onClick={() => setTab('data')} className="btn-primary">Go to Batch Data →</button>
            </div>
          ) : (
            <>
              {/* Summary Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <BatchSummary summary={stats.batchSummary} />
                <div className="card p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-800">Yield Summary</h3>
                  {stats.yieldStats ? (
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-gray-500">Mean Yield</span><span className="font-mono font-bold text-gray-900">{stats.yieldStats.mean.toFixed(1)}%</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">SD</span><span className="font-mono text-gray-700">{stats.yieldStats.sd.toFixed(2)}%</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Range</span><span className="font-mono text-gray-700">{stats.yieldStats.min.toFixed(1)}–{stats.yieldStats.max.toFixed(1)}%</span></div>
                      {stats.yieldStats.standardYield && (
                        <div className="flex justify-between"><span className="text-gray-500">Below Std</span>
                          <span className={`font-mono font-bold ${stats.yieldStats.batchesBelowStandard > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {stats.yieldStats.batchesBelowStandard} batches
                          </span>
                        </div>
                      )}
                    </div>
                  ) : <p className="text-xs text-gray-400">No yield data</p>}
                </div>
                <div className="card p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-800">Quality Events</h3>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">OOS Results</span><span className="font-mono font-bold text-gray-900">{stats.oosCount}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Deviations</span><span className="font-mono font-bold text-gray-900">{deviations.length}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">CAPAs</span><span className="font-mono font-bold text-gray-900">{capas.length}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Complaints</span><span className="font-mono font-bold text-gray-900">{complaints.length}</span></div>
                  </div>
                </div>
                <div className="card p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-800">Nelson&apos;s Alerts</h3>
                  {(() => {
                    const totalViolations = stats.parameterStats?.reduce((sum: number, ps: any) =>
                      sum + (ps.capability?.nelsonViolations?.length || 0), 0) || 0;
                    const paramsWithViolations = stats.parameterStats?.filter((ps: any) =>
                      ps.capability?.nelsonViolations?.length > 0).length || 0;
                    return (
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between"><span className="text-gray-500">Total Alerts</span>
                          <span className={`font-mono font-bold ${totalViolations > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{totalViolations}</span>
                        </div>
                        <div className="flex justify-between"><span className="text-gray-500">Params Affected</span>
                          <span className="font-mono text-gray-700">{paramsWithViolations} / {stats.parameterStats?.length || 0}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Yield Trend */}
              {stats.yieldChartData?.length > 0 && (
                <YieldChart data={stats.yieldChartData} standardYield={product.standard_yield} />
              )}

              {/* Cpk Scorecard */}
              <CpkScorecard parameterStats={stats.parameterStats} onSelect={setSelectedParam} selectedParam={selectedParam} />

              {/* Selected Parameter Control Chart */}
              {selectedParamStats?.chartData?.length > 0 && (
                <ControlChart
                  data={selectedParamStats.chartData}
                  title={`${selectedParamStats.parameter.name} — I-Chart`}
                  unit={selectedParamStats.parameter.unit}
                  height={320}
                />
              )}

              {/* Stats Table */}
              <StatsTable parameterStats={stats.parameterStats} />
            </>
          )}
        </div>
      )}

      {/* Data Tab */}
      {tab === 'data' && (
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Upload Batch Data</h3>
            <p className="text-xs text-gray-500 mb-4">
              Upload an Excel (.xlsx) or CSV file with columns: <code className="bg-cream-100 px-1 py-0.5 rounded font-mono text-[10px]">batch_number</code>, <code className="bg-cream-100 px-1 py-0.5 rounded font-mono text-[10px]">manufacturing_date</code>, <code className="bg-cream-100 px-1 py-0.5 rounded font-mono text-[10px]">status</code>, <code className="bg-cream-100 px-1 py-0.5 rounded font-mono text-[10px]">yield_percentage</code>, and one column per parameter name matching the defined parameters.
            </p>
            <div className="flex items-center gap-3">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-primary text-xs">
                {uploading ? 'Processing…' : '📁 Upload File'}
              </button>
            </div>
            {uploadResult && (
              <div className={`mt-3 p-3 rounded-lg text-xs ${uploadResult.success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                {uploadResult.success ? (
                  <p>✓ Imported {uploadResult.imported} batches ({uploadResult.skipped} skipped). {uploadResult.errors?.length > 0 && `${uploadResult.errors.length} warnings.`}</p>
                ) : (
                  <p>✕ {uploadResult.error}</p>
                )}
                {uploadResult.errors?.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-[11px] opacity-80">
                    {uploadResult.errors.slice(0, 5).map((e: string, i: number) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Batch data table */}
          {product.batches?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-cream-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Batch Records ({product.batches.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full data-table">
                  <thead>
                    <tr>
                      <th>Batch No.</th>
                      <th>Mfg Date</th>
                      <th>Status</th>
                      <th>Yield %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.batches.map((b: any) => (
                      <tr key={b.id}>
                        <td className="font-mono font-medium">{b.batch_number}</td>
                        <td>{b.manufacturing_date || '—'}</td>
                        <td>
                          <span className={`badge ${b.status === 'released' ? 'badge-green' : b.status === 'rejected' ? 'badge-red' : b.status === 'reprocessed' ? 'badge-amber' : 'badge-gray'}`}>
                            {b.status}
                          </span>
                        </td>
                        <td>{b.yield_percentage != null ? `${b.yield_percentage}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deviations Tab */}
      {tab === 'deviations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Deviations ({deviations.length})</h3>
            <button onClick={() => setShowAddDev(!showAddDev)} className="btn-primary text-xs">+ Add Deviation</button>
          </div>
          {showAddDev && (
            <div className="card p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="input-label">Deviation No. *</label><input className="input text-xs font-mono" value={devForm.deviation_number} onChange={e => setDevForm(p => ({ ...p, deviation_number: e.target.value }))} placeholder="DEV-2025-XXX" /></div>
                <div><label className="input-label">Type</label>
                  <select className="input text-xs" value={devForm.type} onChange={e => setDevForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option>
                  </select></div>
                <div><label className="input-label">Date Raised</label><input type="date" className="input text-xs" value={devForm.date_raised} onChange={e => setDevForm(p => ({ ...p, date_raised: e.target.value }))} /></div>
              </div>
              <div><label className="input-label">Description *</label><textarea className="input text-xs" rows={2} value={devForm.description} onChange={e => setDevForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="input-label">Root Cause</label><textarea className="input text-xs" rows={2} value={devForm.root_cause} onChange={e => setDevForm(p => ({ ...p, root_cause: e.target.value }))} /></div>
                <div><label className="input-label">CAPA Reference</label><input className="input text-xs font-mono" value={devForm.capa_reference} onChange={e => setDevForm(p => ({ ...p, capa_reference: e.target.value }))} placeholder="CAPA-2025-XXX" /></div>
              </div>
              <div className="flex gap-2"><button onClick={addDeviation} className="btn-primary text-xs">Save</button><button onClick={() => setShowAddDev(false)} className="btn-ghost text-xs">Cancel</button></div>
            </div>
          )}
          {deviations.length === 0 ? <div className="card p-8 text-center text-gray-400 text-sm">No deviations recorded</div> : (
            <div className="space-y-2">
              {deviations.map((d: any) => (
                <div key={d.id} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-gray-800">{d.deviation_number}</span>
                        <span className={`badge ${d.type === 'critical' ? 'badge-red' : d.type === 'major' ? 'badge-amber' : 'badge-gray'}`}>{d.type}</span>
                        <span className={`badge ${d.investigation_status === 'closed' ? 'badge-green' : 'badge-blue'}`}>{d.investigation_status}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{d.description}</p>
                      {d.root_cause && <p className="text-xs text-gray-500 mt-1"><strong>Root Cause:</strong> {d.root_cause}</p>}
                      {d.capa_reference && <p className="text-xs text-gray-400 mt-0.5">CAPA: {d.capa_reference}</p>}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{d.date_raised}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CAPAs Tab */}
      {tab === 'capas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">CAPAs ({capas.length})</h3>
            <button onClick={() => setShowAddCapa(!showAddCapa)} className="btn-primary text-xs">+ Add CAPA</button>
          </div>
          {showAddCapa && (
            <div className="card p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="input-label">CAPA No. *</label><input className="input text-xs font-mono" value={capaForm.capa_number} onChange={e => setCapaForm(p => ({ ...p, capa_number: e.target.value }))} /></div>
                <div><label className="input-label">Source Type</label><input className="input text-xs" value={capaForm.source_type} onChange={e => setCapaForm(p => ({ ...p, source_type: e.target.value }))} placeholder="Deviation / OOS / Audit" /></div>
                <div><label className="input-label">Due Date</label><input type="date" className="input text-xs" value={capaForm.due_date} onChange={e => setCapaForm(p => ({ ...p, due_date: e.target.value }))} /></div>
              </div>
              <div><label className="input-label">Description *</label><textarea className="input text-xs" rows={2} value={capaForm.description} onChange={e => setCapaForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div><label className="input-label">Action Taken</label><textarea className="input text-xs" rows={2} value={capaForm.action_taken} onChange={e => setCapaForm(p => ({ ...p, action_taken: e.target.value }))} /></div>
              <div className="flex gap-2"><button onClick={addCapa} className="btn-primary text-xs">Save</button><button onClick={() => setShowAddCapa(false)} className="btn-ghost text-xs">Cancel</button></div>
            </div>
          )}
          {capas.length === 0 ? <div className="card p-8 text-center text-gray-400 text-sm">No CAPAs recorded</div> : (
            <div className="space-y-2">
              {capas.map((c: any) => (
                <div key={c.id} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-gray-800">{c.capa_number}</span>
                        <span className={`badge ${c.status === 'effective' ? 'badge-green' : c.status === 'closed' ? 'badge-blue' : c.status === 'overdue' ? 'badge-red' : 'badge-amber'}`}>{c.status}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{c.description}</p>
                      {c.action_taken && <p className="text-xs text-gray-500 mt-1"><strong>Action:</strong> {c.action_taken}</p>}
                      {c.effectiveness_review && <p className="text-xs text-gray-500 mt-0.5"><strong>Effectiveness:</strong> {c.effectiveness_review}</p>}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">Due: {c.due_date || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Change Controls Tab */}
      {tab === 'changes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Change Controls ({changeControls.length})</h3>
            <button onClick={() => setShowAddCC(!showAddCC)} className="btn-primary text-xs">+ Add Change Control</button>
          </div>
          {showAddCC && (
            <div className="card p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="input-label">CC No. *</label><input className="input text-xs font-mono" value={ccForm.cc_number} onChange={e => setCcForm(p => ({ ...p, cc_number: e.target.value }))} /></div>
                <div><label className="input-label">Type</label>
                  <select className="input text-xs" value={ccForm.type} onChange={e => setCcForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="process">Process</option><option value="analytical">Analytical</option><option value="equipment">Equipment</option><option value="material">Material</option><option value="specification">Specification</option>
                  </select></div>
                <div><label className="input-label">Effective Date</label><input type="date" className="input text-xs" value={ccForm.effective_date} onChange={e => setCcForm(p => ({ ...p, effective_date: e.target.value }))} /></div>
              </div>
              <div><label className="input-label">Description *</label><textarea className="input text-xs" rows={2} value={ccForm.description} onChange={e => setCcForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div><label className="input-label">Impact Assessment</label><textarea className="input text-xs" rows={2} value={ccForm.impact_assessment} onChange={e => setCcForm(p => ({ ...p, impact_assessment: e.target.value }))} /></div>
              <div className="flex gap-2"><button onClick={addCC} className="btn-primary text-xs">Save</button><button onClick={() => setShowAddCC(false)} className="btn-ghost text-xs">Cancel</button></div>
            </div>
          )}
          {changeControls.length === 0 ? <div className="card p-8 text-center text-gray-400 text-sm">No change controls recorded</div> : (
            <div className="space-y-2">
              {changeControls.map((cc: any) => (
                <div key={cc.id} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-gray-800">{cc.cc_number}</span>
                        <span className={`badge badge-blue`}>{cc.type}</span>
                        <span className={`badge ${cc.status === 'implemented' ? 'badge-green' : cc.status === 'closed' ? 'badge-gray' : 'badge-amber'}`}>{cc.status}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{cc.description}</p>
                      {cc.impact_assessment && <p className="text-xs text-gray-500 mt-1"><strong>Impact:</strong> {cc.impact_assessment}</p>}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{cc.effective_date || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Complaints Tab */}
      {tab === 'complaints' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Complaints ({complaints.length})</h3>
          </div>
          {complaints.length === 0 ? <div className="card p-8 text-center text-gray-400 text-sm">No complaints recorded</div> : (
            <div className="space-y-2">
              {complaints.map((c: any) => (
                <div key={c.id} className="card p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-gray-800">{c.complaint_number}</span>
                    <span className="badge badge-blue">{c.type}</span>
                    <span className={`badge ${c.status === 'closed' ? 'badge-green' : 'badge-amber'}`}>{c.status}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{c.description}</p>
                  {c.investigation_summary && <p className="text-xs text-gray-500 mt-1">{c.investigation_summary}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
