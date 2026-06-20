import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Search, Loader2, Package } from 'lucide-react';

interface Product { id: string; sku: string; name: string; stock: number; category?: string; price: number | string }

const fmt = (n: number) => `TZS ${Math.round(n).toLocaleString()}`;

/** Phone-friendly read-only stock lookup. Filters as you type; surfaces
 *  out-of-stock items at the bottom with a red badge so a clerk on the
 *  floor can tell the manager what to reorder. */
export default function MobileInventory() {
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api<Product[]>('/pos/products');
        if (!cancelled) setItems(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = !q ? items : items.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
    // Sort: low stock first, then by name. Helps the user spot what to reorder.
    return base.slice().sort((a, b) => {
      const lowA = a.stock <= 5 ? 0 : 1;
      const lowB = b.stock <= 5 ? 0 : 1;
      if (lowA !== lowB) return lowA - lowB;
      return a.name.localeCompare(b.name);
    });
  }, [items, search]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2 sticky top-0 bg-slate-50 z-10">
        <h2 className="text-lg font-extrabold text-slate-900 mb-2">Stock</h2>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU or name…"
            className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {loading ? (
          <div className="grid place-items-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : err ? (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-12">No items.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((p) => {
              const lowStock = p.stock <= 5;
              const out = p.stock <= 0;
              return (
                <li key={p.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                  <div className={`w-10 h-10 rounded-lg grid place-items-center ${out ? 'bg-rose-100 text-rose-600' : lowStock ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-500">{p.sku}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-extrabold ${out ? 'text-rose-600' : lowStock ? 'text-amber-700' : 'text-slate-900'}`}>
                      {p.stock} {out ? '· OUT' : lowStock ? '· LOW' : ''}
                    </div>
                    <div className="text-[10px] text-slate-500">{fmt(parseFloat(String(p.price)))}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
