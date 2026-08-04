import { useCallback, useEffect, useState } from 'react';
import { publicApi } from './api';

interface CatalogProduct {
  productId: string; code: string; name: string; livePrice: number; catalogPrice: number;
  stock: number; currency: string; imageUrl: string | null; isFeatured: boolean;
}
interface Catalog {
  live: boolean; sessionId?: string; title?: string; currency?: string;
  featured?: CatalogProduct | null; products?: CatalogProduct[];
}

const money = (n: number, ccy: string) => `${ccy} ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/**
 * Kobe Live Catalog — the permanent public link a seller puts in their TikTok/IG
 * profile (shop.kobeapptz.com/live or /@handle). It shows the currently-featured
 * product ("NOW SHOWING", updates live) + all products the seller selected for
 * this live, and three ways to buy: reserve-and-buy, enter a reservation code,
 * or WhatsApp handoff.
 */
export default function LiveCatalog({ slug, whatsapp }: { slug: string; whatsapp?: string }) {
  const [cat, setCat] = useState<Catalog | null>(null);
  const [picked, setPicked] = useState<CatalogProduct | null>(null);
  const [qty, setQty] = useState(1);
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');

  const load = useCallback(async () => {
    try { setCat(await publicApi<Catalog>(`/live-sales/public/${encodeURIComponent(slug)}`)); }
    catch { setCat({ live: false }); }
  }, [slug]);
  // Poll so the "NOW SHOWING" product + stock update without a refresh.
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

  const reserve = async (p: CatalogProduct) => {
    setBusy(true); setError(null);
    try {
      const r = await publicApi<{ checkoutPath: string }>(`/live-sales/public/${encodeURIComponent(slug)}/reserve`, {
        method: 'POST', body: JSON.stringify({ code: p.code, qty, buyerHandle: handle.trim() }),
      });
      window.location.href = r.checkoutPath; // -> /live/pay/{token}
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };

  const openByCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    setBusy(true); setError(null);
    try {
      const r = await publicApi<{ token: string }>(`/live-sales/public/reservation/${code}`);
      window.location.href = `/live/pay/${r.token}`;
    } catch (e) { setError('That reservation code was not found or has expired.'); setBusy(false); }
  };

  if (!cat) return <Center><div className="text-white/60">Loading…</div></Center>;
  if (!cat.live) {
    return <Center><div className="space-y-2"><div className="text-3xl">🛍️</div><div className="text-white/70">No live sale is running right now.</div><div className="text-white/40 text-sm">Check back when the seller goes live.</div></div></Center>;
  }

  const featured = cat.featured;
  const priceOf = (p: CatalogProduct) => (p.livePrice > 0 ? p.livePrice : p.catalogPrice);

  return (
    <div className="min-h-screen bg-[#0b0b16] text-white/90 px-4 py-5">
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-400"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> LIVE NOW</div>
          <h1 className="text-lg font-extrabold">{cat.title || 'KOBE LIVE SALE'}</h1>
        </div>

        {/* NOW SHOWING */}
        {featured && (
          <div className="rounded-2xl border border-indigo-500/40 bg-indigo-500/[0.07] overflow-hidden">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 px-3 pt-2">Now showing</div>
            <div className="aspect-square bg-white/[0.03] grid place-items-center">
              {featured.imageUrl ? <img src={featured.imageUrl} alt={featured.name} className="w-full h-full object-contain" /> : <div className="text-6xl font-bold text-white/20">{featured.code}</div>}
            </div>
            <div className="p-3 space-y-2">
              <div className="flex items-baseline justify-between">
                <div><span className="text-white/40 text-sm">#{featured.code}</span> <span className="font-semibold">{featured.name}</span></div>
                <div className="font-bold">{money(priceOf(featured), featured.currency)}</div>
              </div>
              <div className="text-xs text-white/50">{featured.stock > 0 ? `Stock: ${featured.stock}` : 'Sold out'}</div>
              <QtyRow qty={qty} setQty={setQty} max={featured.stock} />
              <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Your TikTok/IG @handle (optional)" className="w-full h-9 px-3 rounded-lg bg-white/[0.05] border border-white/10 text-xs outline-none" />
              <button disabled={busy || featured.stock <= 0} onClick={() => reserve(featured)} className="w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 font-bold">RESERVE AND BUY</button>
            </div>
          </div>
        )}

        {/* All products in this live */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="text-xs font-semibold text-white/60 mb-2">All items in this live</div>
          <div className="space-y-1.5">
            {(cat.products ?? []).map((p) => (
              <button key={p.productId} onClick={() => { setPicked(p); setQty(1); }} className={`w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-left ${picked?.productId === p.productId ? 'bg-indigo-500/15 border border-indigo-500/40' : 'hover:bg-white/[0.04] border border-transparent'}`}>
                <span className="text-xs font-mono text-white/40 w-8">{p.code}</span>
                <span className="flex-1 text-sm truncate">{p.name}</span>
                <span className="text-sm font-semibold">{money(priceOf(p), p.currency)}</span>
              </button>
            ))}
          </div>
          {picked && picked.productId !== featured?.productId && (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 space-y-2">
              <div className="text-sm font-semibold">#{picked.code} {picked.name} · {money(priceOf(picked), picked.currency)}</div>
              <QtyRow qty={qty} setQty={setQty} max={picked.stock} />
              <button disabled={busy || picked.stock <= 0} onClick={() => reserve(picked)} className="w-full h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 font-bold text-sm">RESERVE AND BUY</button>
            </div>
          )}
        </div>

        {/* Method 2: reservation code from a comment */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="text-xs font-semibold text-white/60 mb-2">Have a reservation code? (from commenting BUY)</div>
          <div className="flex gap-2">
            <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} placeholder="e.g. K7Q4" maxLength={6} className="flex-1 h-10 px-3 rounded-lg bg-white/[0.05] border border-white/10 text-sm uppercase tracking-widest outline-none" />
            <button disabled={busy || !codeInput.trim()} onClick={openByCode} className="h-10 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-semibold disabled:opacity-40">Open</button>
          </div>
        </div>

        {/* Method 3: WhatsApp handoff */}
        {whatsapp && (
          <a href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hello Kobe, I want to buy from your live. Product code: ')}`} target="_blank" rel="noreferrer" className="block text-center h-11 leading-[44px] rounded-lg bg-emerald-600 hover:bg-emerald-700 font-bold">Buy via WhatsApp</a>
        )}

        {error && <p className="text-[11px] text-red-300 text-center">{error}</p>}
        <p className="text-[10px] text-white/30 text-center">Reserved items are held 5 minutes. Pay to confirm.</p>
      </div>
    </div>
  );
}

function QtyRow({ qty, setQty, max }: { qty: number; setQty: (n: number) => void; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/50">Qty</span>
      <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-8 h-8 rounded-lg bg-white/10">-</button>
      <span className="w-8 text-center tabular-nums">{qty}</span>
      <button onClick={() => setQty(Math.min(Math.max(1, max), qty + 1))} className="w-8 h-8 rounded-lg bg-white/10">+</button>
    </div>
  );
}
function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#0b0b16] grid place-items-center px-6 text-center">{children}</div>;
}
