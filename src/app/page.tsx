'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    const res = await fetch('/api/products');
    const data = await res.json();
    setProducts(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const seedData = async () => {
    setSeeding(true);
    await fetch('/api/seed', { method: 'POST' });
    await fetchProducts();
    setSeeding(false);
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="animate-fade-in">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl text-teal-800">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Annual Product Quality Review — API Manufacturing</p>
          </div>
          <div className="flex items-center gap-2">
            {products.length === 0 && (
              <button onClick={seedData} disabled={seeding} className="btn-secondary text-xs">
                {seeding ? 'Seeding…' : '✦ Load Demo Data'}
              </button>
            )}
            <Link href="/products/new" className="btn-primary text-xs">+ New Product</Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full" />
        </div>
      ) : products.length === 0 ? (
        <div className="card p-12 text-center animate-slide-up">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-cream-100 flex items-center justify-center">
            <span className="text-3xl">📊</span>
          </div>
          <h2 className="font-display text-xl text-gray-800">No products yet</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
            Add your first API product to start tracking quality data, or load demo data to explore QReview.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <button onClick={seedData} disabled={seeding} className="btn-secondary">
              {seeding ? 'Loading…' : 'Load Demo Data'}
            </button>
            <Link href="/products/new" className="btn-primary">Create Product</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-slide-up">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Products</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{products.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Batches</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {products.reduce((sum: number, p: any) => sum + (p.batch_count || 0), 0)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Parameters Tracked</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {products.reduce((sum: number, p: any) => sum + (p.param_count || 0), 0)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Review Period</p>
              <p className="text-lg font-bold text-gray-900 mt-1">Jan–Dec 2025</p>
            </div>
          </div>

          {/* Products Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">API Products</h2>
              <Link href="/products" className="text-xs text-teal-600 hover:underline">View all →</Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p: any, i: number) => (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="card p-4 hover:shadow-md hover:border-teal-200 transition-all duration-200 group"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-display text-lg text-gray-900 group-hover:text-teal-700 transition-colors">{p.name}</h3>
                      <p className="text-xs font-mono text-gray-400 mt-0.5">{p.code}</p>
                    </div>
                    <span className={`badge ${p.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{p.status}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-cream-100">
                    <div>
                      <p className="text-xs text-gray-400">Batches</p>
                      <p className="text-sm font-bold text-gray-800">{p.batch_count || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Parameters</p>
                      <p className="text-sm font-bold text-gray-800">{p.param_count || 0}</p>
                    </div>
                    {p.therapeutic_category && (
                      <div>
                        <p className="text-xs text-gray-400">Category</p>
                        <p className="text-sm text-gray-600">{p.therapeutic_category}</p>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
