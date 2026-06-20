import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  Search, Minus, Plus, ShoppingCart, X, Trash2, Loader2, CheckCircle2,
} from 'lucide-react';

/**
 * Phone-first POS. One scrollable product column, big tap targets, sticky
 * cart drawer that slides up from the bottom. Posts to the same
 * /pos/products and /pos/orders endpoints the desktop POS uses so a sale
 * rung on a phone shows up in the same ledger.
 */

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number | string;
  stock: number;
}

interface CartItem { product: Product; quantity: number }

const fmt = (n: number) => `TZS ${Math.round(n).toLocaleString()}`;

export default function MobilePOS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api<Product[]>('/pos/products');
        if (!cancelled) setProducts(Array.isArray(list) ? list : []);
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
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q),
    );
  }, [products, search]);

  const total = cart.reduce((s, it) => s + parseFloat(String(it.product.price)) * it.quantity, 0);
  const cartCount = cart.reduce((s, it) => s + it.quantity, 0);

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const i = prev.findIndex((c) => c.product.id === p.id);
      if (i === -1) return [...prev, { product: p, quantity: 1 }];
      const copy = prev.slice();
      copy[i] = { ...copy[i], quantity: Math.min(p.stock, copy[i].quantity + 1) };
      return copy;
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.product.id === id ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c))
        .filter((c) => c.quantity > 0),
    );
  };

  const removeFrom = (id: string) => setCart((prev) => prev.filter((c) => c.product.id !== id));

  const checkout = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setErr(null);
    try {
      const orderNumber = `M-${Date.now().toString(36).toUpperCase()}`;
      const dto = {
        orderNumber,
        lines: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
        paymentMethod: 'CASH',
      };
      const sale = await api<{ receipt?: { orderNumber?: string } }>('/pos/orders', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      setDone(sale?.receipt?.orderNumber ?? orderNumber);
      setCart([]);
      setDrawerOpen(false);
      // Refresh stock — mobile cashier might keep selling without reloading.
      try {
        const list = await api<Product[]>('/pos/products');
        if (Array.isArray(list)) setProducts(list);
      } catch { /* ignore */ }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative h-full flex flex-col">
      {/* Search */}
      <div className="px-4 pt-4 pb-2 sticky top-0 bg-slate-50 z-10">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      {/* Product list */}
      <div className="flex-1 overflow-y-auto px-4 pb-28 space-y-2">
        {loading ? (
          <div className="grid place-items-center py-12 text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-12">No products match.</div>
        ) : (
          filtered.map((p) => {
            const inCart = cart.find((c) => c.product.id === p.id);
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.stock <= 0}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 text-left active:bg-slate-50 disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-lg bg-slate-100 grid place-items-center text-[10px] font-bold text-slate-500">
                  {p.category?.slice(0, 3).toUpperCase() ?? 'SKU'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{p.name}</div>
                  <div className="text-[10px] text-slate-500">{p.sku} · {p.stock} in stock</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold text-slate-900">{fmt(parseFloat(String(p.price)))}</div>
                  {inCart && (
                    <div className="text-[10px] font-bold text-indigo-600 mt-0.5">×{inCart.quantity}</div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Done toast */}
      {done && (
        <div className="fixed top-16 left-4 right-4 z-30 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 p-3 flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-5 h-5" />
          <div className="flex-1">
            <div className="text-sm font-extrabold">Sale recorded</div>
            <div className="text-[11px] opacity-80">Receipt {done}</div>
          </div>
          <button onClick={() => setDone(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {err && (
        <div className="fixed top-16 left-4 right-4 z-30 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 p-3 text-xs flex items-start gap-2">
          <X className="w-4 h-4 mt-0.5" />
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr(null)}><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Sticky cart pill */}
      {cartCount > 0 && (
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-20 left-4 right-4 z-20 h-14 rounded-xl bg-indigo-600 text-white flex items-center justify-between px-5 shadow-xl active:bg-indigo-700"
        >
          <span className="inline-flex items-center gap-2 font-extrabold">
            <ShoppingCart className="w-5 h-5" />{cartCount} item{cartCount === 1 ? '' : 's'}
          </span>
          <span className="font-extrabold">{fmt(total)} · Review →</span>
        </button>
      )}

      {/* Cart drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setDrawerOpen(false)}>
          <div
            className="absolute left-0 right-0 bottom-0 max-h-[80vh] bg-white rounded-t-3xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Cart ({cartCount})</h3>
              <button onClick={() => setDrawerOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 grid place-items-center">
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 divide-y divide-slate-100">
              {cart.map((c) => (
                <div key={c.product.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{c.product.name}</div>
                    <div className="text-[10px] text-slate-500">{fmt(parseFloat(String(c.product.price)))} each</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(c.product.id, -1)} className="w-8 h-8 rounded-full bg-slate-100 grid place-items-center text-slate-700">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center font-extrabold text-sm">{c.quantity}</span>
                    <button onClick={() => updateQty(c.product.id, 1)} className="w-8 h-8 rounded-full bg-slate-100 grid place-items-center text-slate-700">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button onClick={() => removeFrom(c.product.id)} className="text-rose-500 ml-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Total</span>
                <span className="text-xl font-extrabold text-slate-900">{fmt(total)}</span>
              </div>
              <button
                onClick={checkout}
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Processing…' : `Charge ${fmt(total)} (Cash)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
