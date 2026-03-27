import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'QReview — APQR for Pharma API',
  description: 'Annual Product Quality Review software for pharmaceutical API manufacturers',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-cream-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-display text-sm">Q</span>
                </div>
                <span className="font-display text-xl text-teal-800">QReview</span>
                <span className="text-[10px] font-mono text-gray-400 bg-cream-100 px-1.5 py-0.5 rounded">v1</span>
              </Link>
              <div className="flex items-center gap-1">
                <Link href="/" className="btn-ghost text-xs">Dashboard</Link>
                <Link href="/products" className="btn-ghost text-xs">Products</Link>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
