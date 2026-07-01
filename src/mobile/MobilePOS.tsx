import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useQRScanner } from '@/hooks/useQRScanner';
import {
  Search, Minus, Plus, ShoppingCart, X, Trash2, Loader2, CheckCircle2, QrCode,
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
  unit?: string;
  decimalQuantity?: boolean;
  barcode?: string;
}

interface CartItem { product: Product; quantity: number }

/** Render qty + unit naturally — "3", "2.5 m", "0.75 kg". */
function fmtQty(q: number, unit?: string): string {
  const num = Number.isInteger(q) ? String(q) : Number(q).toFixed(2).replace(/\.?0+$/, '');
  return unit && unit !== 'piece' && unit !== 'pcs' ? `${num} ${unit}` : num;
}

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
  const [showScanner, setShowScanner] = useState(false);
  const { videoRef, result, start: startScan, stop: stopScan } = useQRScanner();

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

  // ── QR scan: auto-add scanned product to cart ──────────────────────────────
  useEffect(() => {
    if (!result) return;
    const scanned = result.rawValue.trim();
    const match = products.find(
      (p) => p.sku === scanned || p.id === scanned || p.barcode === scanned,
    );
    if (match) {
      addToCart(match);
      setShowScanner(false);
      stopScan();
      setDone(`${match.name} added from scan`);
      setTimeout(() => setDone(null), 2000);
    } else {
      setErr(`No product found for barcode: ${scanned}`);
      setTimeout(() => setErr(null), 3000);
    }
  }, [result]);

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
      {/* Search + QR scan */}
      <div className="px-4 pt-4 pb-2 sticky top-0 bg-slate-50 z-10 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
          <button
            onClick={() => { setShowScanner(true); startScan(); }}
            className="shrink-0 w-11 h-11 rounded-xl bg-indigo-600 text-white grid place-items-center active:bg-indigo-700"
            title="Scan barcode"
          >
            <QrCode className="w-5 h-5" />
          </button>
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
                  <div className="text-[10px] text-slate-500">
                    {p.sku} · {p.stock} {p.unit && p.unit !== 'piece' ? p.unit : 'in stock'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold text-slate-900">
                    {fmt(parseFloat(String(p.price)))}{p.unit && p.unit !== 'piece' ? ` / ${p.unit}` : ''}
                  </div>
                  {inCart && (
                    <div className="text-[10px] font-bold text-indigo-600 mt-0.5">
                      {fmtQty(inCart.quantity, p.unit)}
                    </div>
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
                    <div className="text-[10px] text-slate-500">
                      {fmt(parseFloat(String(c.product.price)))}{c.product.unit && c.product.unit !== 'piece' ? ` / ${c.product.unit}` : ' each'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.product.decimalQuantity ? (
                      // Cut-to-length / weight-priced SKU — accept any
                      // positive decimal directly so 2.5 / 0.75 / 12.4
                      // all work without tap-mashing the increment button.
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={c.quantity}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value) || 0);
                          setCart((prev) => prev
                            .map((it) => (it.product.id === c.product.id ? { ...it, quantity: v } : it))
                            .filter((it) => it.quantity > 0));
                        }}
                        className="w-20 h-8 rounded-lg border border-slate-200 px-2 text-sm font-bold text-right"
                      />
                    ) : (
                      <>
                        <button onClick={() => updateQty(c.product.id, -1)} className="w-8 h-8 rounded-full bg-slate-100 grid place-items-center text-slate-700">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-extrabold text-sm">{c.quantity}</span>
                        <button onClick={() => updateQty(c.product.id, 1)} className="w-8 h-8 rounded-full bg-slate-100 grid place-items-center text-slate-700">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {c.product.unit && c.product.unit !== 'piece' && (
                      <span className="text-[10px] text-slate-500 ml-1 w-8">{c.product.unit}</span>
                    )}
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

      {/* QR Scanner overlay */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-black/80">
            <button
              onClick={() => { setShowScanner(false); stopScan(); }}
              className="inline-flex items-center gap-1 text-white text-sm font-bold"
            >
              <X className="w-5 h-5" /> Cancel
            </button>
            <span className="text-white text-xs font-bold">Scan product barcode</span>
            <div className="w-16" />
          </div>
          <div className="flex-1 relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-32 border-2 border-white/60 rounded-xl relative">
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-400 rounded-br-lg" />
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-indigo-400/30 -translate-y-1/2" />
              </div>
            </div>
            <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 text-white text-xs font-bold">
                <QrCode className="w-4 h-4 animate-pulse" /> Point camera at product barcode
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
