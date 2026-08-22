import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Radio, Megaphone, Loader2, Phone, CheckCircle2 } from 'lucide-react';

interface SaleItem {
  id: string; channel: 'live' | 'post'; platform: string; sessionTitle: string;
  code: string; qty: number; status: string; buyerHandle: string; buyerContact: string;
  reservationCode: string; createdAt: string;
}
interface Feed { live: SaleItem[]; nonLive: SaleItem[]; counts: { live: number; nonLive: number } }

/**
 * Admin PWA — all live-selling sales on the phone, split into LIVE and
 * NON-LIVE (ad/post) lists. Each reservation/sale shows the buyer + code, with
 * a one-tap call/WhatsApp so the admin can contact the customer.
 */
export default function MobileLiveSales() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'live' | 'post'>('live');

  const load = useCallback(async () => {
    try { setFeed(await api<Feed>('/live-sales/sales/feed')); setErr(null); }
    catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  const list = feed ? (tab === 'live' ? feed.live : feed.nonLive) : [];

  return (
    <div className="p-3 space-y-3">
      <h1 className="text-lg font-bold flex items-center gap-2"><Radio className="w-5 h-5 text-indigo-500" /> Live-sale orders</h1>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setTab('live')} className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold ${tab === 'live' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
          <Radio className="w-4 h-4" /> Live <span className="opacity-70">({feed?.counts.live ?? 0})</span>
        </button>
        <button onClick={() => setTab('post')} className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold ${tab === 'post' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
          <Megaphone className="w-4 h-4" /> Ads/Posts <span className="opacity-70">({feed?.counts.nonLive ?? 0})</span>
        </button>
      </div>

      {err && <div className="text-sm text-red-500">{err}</div>}
      {!feed && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
      {feed && list.length === 0 && <div className="text-center text-slate-400 text-sm py-10">No {tab === 'live' ? 'live' : 'ad/post'} sales yet.</div>}

      <div className="space-y-2">
        {list.map((s) => {
          const paid = s.status === 'CONVERTED';
          const phone = (s.buyerContact || '').replace(/[^0-9]/g, '');
          return (
            <div key={s.id} className={`rounded-xl border p-3 ${paid ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{s.platform}</span>
                  <span className="font-semibold text-sm truncate">{s.buyerHandle || 'buyer'}</span>
                </div>
                <span className={`text-[11px] font-bold ${paid ? 'text-emerald-600' : 'text-amber-600'}`}>{paid ? 'PAID' : s.status}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">#{s.code} · qty {s.qty}{s.reservationCode ? ` · code ${s.reservationCode}` : ''} · {s.sessionTitle}</div>
              <div className="mt-2 flex gap-2">
                {phone && <a href={`tel:${phone}`} className="flex-1 h-9 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1"><Phone className="w-3.5 h-3.5" /> Call</a>}
                {phone && <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="flex-1 h-9 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold inline-flex items-center justify-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> WhatsApp</a>}
                {!phone && <span className="text-[11px] text-slate-400">No contact yet — buyer pays via the checkout link.</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
