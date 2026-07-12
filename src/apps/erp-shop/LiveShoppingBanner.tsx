import { useEffect, useState } from 'react';
import { Radio, Zap, X } from 'lucide-react';

/**
 * LIVE shopping banner for the storefront. Polls the shop's public live
 * endpoint; when the seller is live (and has enabled "show on storefront"),
 * it surfaces the live-pinned products at their live price so web shoppers
 * can buy the live too — not just viewers on TikTok/Instagram. Adds to the
 * storefront's own cart at the live price.
 */
interface LiveProduct { productId: string; code: string; name: string; livePrice: number; catalogPrice: number; stock: number; currency: string }
interface LiveResp { live: boolean; title?: string; currency?: string; products?: LiveProduct[] }

interface CartProduct { id: string; name: string; sku: string; price: number; stock: number; category: string; imageUrl?: string | null; currency: string }

export default function LiveShoppingBanner({ slug, onAdd }: { slug: string; onAdd: (p: CartProduct) => void }) {
  const [data, setData] = useState<LiveResp | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let off = false;
    const load = async () => {
      try {
        const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api');
        const r = await fetch(`${base}/live-sales/public/${encodeURIComponent(slug)}`);
        if (r.ok && !off) setData(await r.json());
      } catch { /* ignore */ }
    };
    load();
    const t = setInterval(load, 10000); // refresh stock/status while browsing
    return () => { off = true; clearInterval(t); };
  }, [slug]);

  if (!data?.live || !(data.products?.length) || !open) return null;
  const cur = data.currency ?? 'TZS';
  const money = (n: number) => `${cur === 'TZS' ? 'TSh ' : cur === 'CNY' ? '¥' : cur + ' '}${Number(n || 0).toLocaleString()}`;

  return (
    <div className="bg-gradient-to-r from-rose-600 to-fuchsia-600 text-white">
      <div className="max-w-6xl mx-auto px-4 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold">
            <span className="inline-flex items-center gap-1.5"><Radio className="w-4 h-4 animate-pulse" /> LIVE NOW</span>
            {data.title && <span className="text-white/80 font-semibold text-sm hidden sm:inline">· {data.title}</span>}
            <span className="text-[11px] font-bold bg-white/20 rounded-full px-2 py-0.5">Live prices</span>
          </div>
          <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 mt-2 -mx-1 px-1">
          {data.products!.map((p) => {
            const soldOut = p.stock <= 0;
            const deal = p.livePrice < p.catalogPrice;
            return (
              <div key={p.productId} className="shrink-0 w-40 bg-white/10 backdrop-blur rounded-xl p-2.5 border border-white/15">
                <div className="text-xs font-bold truncate">{p.name}</div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="font-extrabold">{money(p.livePrice)}</span>
                  {deal && <span className="text-[10px] text-white/60 line-through">{money(p.catalogPrice)}</span>}
                </div>
                <div className="text-[10px] text-white/70">{soldOut ? 'Sold out' : `${p.stock} left`}</div>
                <button
                  disabled={soldOut}
                  onClick={() => onAdd({ id: p.productId, name: p.name, sku: p.code, price: p.livePrice, stock: p.stock, category: 'LIVE', currency: cur })}
                  className="w-full mt-1.5 h-8 rounded-lg bg-white text-rose-700 text-xs font-extrabold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Zap className="w-3 h-3" /> {soldOut ? 'Sold out' : 'Add'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
