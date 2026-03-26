'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ParamRow {
  name: string; type: string; unit: string; usl: string; lsl: string; target: string; stage: string; is_critical: boolean;
}

const defaultParam = (): ParamRow => ({
  name: '', type: 'cqa', unit: '', usl: '', lsl: '', target: '', stage: 'final', is_critical: true,
});

export default function NewProductPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', code: '', generic_name: '', api_grade: '', batch_size: '',
    batch_size_unit: 'kg', shelf_life_months: '', license_no: '',
    standard_yield: '', therapeutic_category: '',
  });
  const [params, setParams] = useState<ParamRow[]>([
    { name: 'Assay', type: 'cqa', unit: '%', usl: '', lsl: '', target: '', stage: 'final', is_critical: true },
    { name: 'Water Content', type: 'cqa', unit: '% w/w', usl: '', lsl: '', target: '', stage: 'final', is_critical: true },
    defaultParam(),
  ]);

  const updateForm = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const updateParam = (i: number, key: keyof ParamRow, value: any) => {
    const next = [...params];
    (next[i] as any)[key] = value;
    setParams(next);
  };

  const addParam = () => setParams(prev => [...prev, defaultParam()]);
  const removeParam = (i: number) => setParams(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code) return alert('Product name and code are required');

    setSaving(true);
    const validParams = params.filter(p => p.name.trim() !== '').map(p => ({
      ...p,
      usl: p.usl !== '' ? Number(p.usl) : null,
      lsl: p.lsl !== '' ? Number(p.lsl) : null,
      target: p.target !== '' ? Number(p.target) : null,
      is_critical: p.is_critical ? 1 : 0,
    }));

    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        shelf_life_months: form.shelf_life_months ? Number(form.shelf_life_months) : null,
        standard_yield: form.standard_yield ? Number(form.standard_yield) : null,
        parameters: validParams,
      }),
    });

    if (res.ok) {
      const product = await res.json();
      router.push(`/products/${product.id}`);
    } else {
      alert('Failed to create product');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl text-teal-800">New API Product</h1>
        <p className="text-sm text-gray-500 mt-1">Define your product and its quality parameters</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product Details */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Product Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Product Name *</label>
              <input className="input" placeholder="e.g. Metformin Hydrochloride" value={form.name} onChange={e => updateForm('name', e.target.value)} required />
            </div>
            <div>
              <label className="input-label">Product Code *</label>
              <input className="input font-mono" placeholder="e.g. MET-API-001" value={form.code} onChange={e => updateForm('code', e.target.value)} required />
            </div>
            <div>
              <label className="input-label">Generic Name</label>
              <input className="input" placeholder="e.g. Metformin HCl" value={form.generic_name} onChange={e => updateForm('generic_name', e.target.value)} />
            </div>
            <div>
              <label className="input-label">API Grade</label>
              <input className="input" placeholder="e.g. IP/BP/USP" value={form.api_grade} onChange={e => updateForm('api_grade', e.target.value)} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="input-label">Batch Size</label>
                <input className="input" placeholder="e.g. 500" value={form.batch_size} onChange={e => updateForm('batch_size', e.target.value)} />
              </div>
              <div className="w-24">
                <label className="input-label">Unit</label>
                <select className="input" value={form.batch_size_unit} onChange={e => updateForm('batch_size_unit', e.target.value)}>
                  <option value="kg">kg</option><option value="g">g</option><option value="L">L</option>
                </select>
              </div>
            </div>
            <div>
              <label className="input-label">Shelf Life (months)</label>
              <input className="input" type="number" placeholder="e.g. 36" value={form.shelf_life_months} onChange={e => updateForm('shelf_life_months', e.target.value)} />
            </div>
            <div>
              <label className="input-label">License No.</label>
              <input className="input font-mono" placeholder="e.g. API/MFG/2024/001" value={form.license_no} onChange={e => updateForm('license_no', e.target.value)} />
            </div>
            <div>
              <label className="input-label">Standard Yield (%)</label>
              <input className="input" type="number" step="0.1" placeholder="e.g. 85.0" value={form.standard_yield} onChange={e => updateForm('standard_yield', e.target.value)} />
            </div>
            <div>
              <label className="input-label">Therapeutic Category</label>
              <input className="input" placeholder="e.g. Anti-diabetic" value={form.therapeutic_category} onChange={e => updateForm('therapeutic_category', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Parameters */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Quality Parameters (CQAs / CPPs)</h2>
            <button type="button" onClick={addParam} className="btn-ghost text-xs">+ Add Parameter</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left py-2 px-2">Parameter Name</th>
                  <th className="text-left py-2 px-2">Type</th>
                  <th className="text-left py-2 px-2">Unit</th>
                  <th className="text-left py-2 px-2">USL</th>
                  <th className="text-left py-2 px-2">LSL</th>
                  <th className="text-left py-2 px-2">Target</th>
                  <th className="text-left py-2 px-2">Stage</th>
                  <th className="text-center py-2 px-2">Critical</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {params.map((p, i) => (
                  <tr key={i}>
                    <td className="py-1.5 px-1"><input className="input text-xs" placeholder="e.g. Assay" value={p.name} onChange={e => updateParam(i, 'name', e.target.value)} /></td>
                    <td className="py-1.5 px-1">
                      <select className="input text-xs" value={p.type} onChange={e => updateParam(i, 'type', e.target.value)}>
                        <option value="cqa">CQA</option><option value="cpp">CPP</option><option value="ipc">IPC</option><option value="yield">Yield</option>
                      </select>
                    </td>
                    <td className="py-1.5 px-1"><input className="input text-xs w-16" placeholder="%" value={p.unit} onChange={e => updateParam(i, 'unit', e.target.value)} /></td>
                    <td className="py-1.5 px-1"><input className="input text-xs w-20 font-mono" type="number" step="any" placeholder="—" value={p.usl} onChange={e => updateParam(i, 'usl', e.target.value)} /></td>
                    <td className="py-1.5 px-1"><input className="input text-xs w-20 font-mono" type="number" step="any" placeholder="—" value={p.lsl} onChange={e => updateParam(i, 'lsl', e.target.value)} /></td>
                    <td className="py-1.5 px-1"><input className="input text-xs w-20 font-mono" type="number" step="any" placeholder="—" value={p.target} onChange={e => updateParam(i, 'target', e.target.value)} /></td>
                    <td className="py-1.5 px-1">
                      <select className="input text-xs" value={p.stage} onChange={e => updateParam(i, 'stage', e.target.value)}>
                        <option value="final">Final</option><option value="reaction">Reaction</option><option value="crystallization">Crystallization</option>
                        <option value="drying">Drying</option><option value="milling">Milling</option><option value="dissolution">Dissolution</option>
                      </select>
                    </td>
                    <td className="text-center py-1.5 px-1">
                      <input type="checkbox" checked={p.is_critical} onChange={e => updateParam(i, 'is_critical', e.target.checked)}
                        className="w-4 h-4 text-teal-600 rounded border-gray-300" />
                    </td>
                    <td className="py-1.5 px-1">
                      {params.length > 1 && (
                        <button type="button" onClick={() => removeParam(i)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-400">
            Leave USL or LSL blank for one-sided specifications (e.g., impurities typically have only USL).
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Creating…' : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  );
}
