'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => { setProducts(d); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-teal-800">Products</h1>
          <p className="text-sm text-gray-500">Manage your API products and parameters</p>
        </div>
        <Link href="/products/new" className="btn-primary text-xs">+ New Product</Link>
      </div>

      {products.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500">No products yet. Create your first product to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p: any) => (
            <Link key={p.id} href={`/products/${p.id}`}
              className="card p-4 flex items-center justify-between hover:shadow-md hover:border-teal-200 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center text-teal-700 font-display text-lg">
                  {p.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{p.name}</h3>
                  <p className="text-xs text-gray-400 font-mono">{p.code} · {p.api_grade || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="font-bold text-gray-900">{p.batch_count || 0}</p>
                  <p className="text-[10px] text-gray-400">batches</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-900">{p.param_count || 0}</p>
                  <p className="text-[10px] text-gray-400">params</p>
                </div>
                <span className={`badge ${p.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{p.status}</span>
                <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
