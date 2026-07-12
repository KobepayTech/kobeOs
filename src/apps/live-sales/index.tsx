import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import {
  Radio, Plus, Loader2, Pin, Trash2, ShoppingBag, CheckCircle2, XCircle, Zap,
  MessageCircle, Package, Play, Square, TrendingUp, Link2, Copy, Send, AlertCircle,
} from 'lucide-react';

/* ── Types ── */
interface Session { id: string; title: string; platform: string; status: 'LIVE' | 'ENDED'; ingestToken: string; currency: string; totalSales: number | string; orderCount: number; createdAt: string; showOnStorefront?: boolean }
interface PinRow { id: string; code: string; productId: string; name: string; livePrice: number; catalogPrice: number; stock: number; soldQty: number }
interface Comment { id: string; source: string; buyerHandle: string; buyerContact: string; text: string; matchedCode: string; qty: number; status: string; createdAt: string }
interface Product { id: string; name: string; price: number | string; stock: number }
interface Stats { totalSales: number; orderCount: number; pendingComments: number; convertedComments: number; pins: PinRow[] }

const money = (n: number | string, c = 'TZS') => `${c === 'TZS' ? 'TSh ' : c === 'CNY' ? '¥' : c + ' '}${Number(n || 0).toLocaleString()}`;

export default function LiveSales() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [active, setActive] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try { const s = await api<Session[]>('/live-sales'); setSessions(Array.isArray(s) ? s : []); }
    catch { setSessions([]); } finally { setLoading(false); }
  }, []);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  const start = async () => {
    const title = prompt('Name this live session', 'Live Sale')?.trim();
    if (title === undefined) return;
    const s = await api<Session>('/live-sales', { method: 'POST', body: JSON.stringify({ title: title || 'Live Sale', platform: 'tiktok' }) });
    await loadSessions(); setActive(s);
  };

  if (active) return <SessionConsole session={active} onBack={() => { setActive(null); loadSessions(); }} />;

  return (
    <div className="h-full bg-slate-950 text-slate-100 overflow-auto">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-rose-600 grid place-items-center"><Radio className="w-4.5 h-4.5 text-white" /></div>
          <div><h1 className="text-sm font-bold">Live Sales</h1><p className="text-[10px] text-slate-500">Sell live · comment orders → real-time stock</p></div>
        </div>
        <button onClick={start} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-bold"><Play className="w-4 h-4" /> Go Live</button>
      </div>

      <div className="p-5 space-y-2">
        {loading ? <Center><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></Center> : sessions.length === 0 ? (
          <div className="text-center text-slate-500 py-16">No live sessions yet. Hit <span className="text-fuchsia-400 font-semibold">Go Live</span> to start one.</div>
        ) : sessions.map((s) => (
          <button key={s.id} onClick={() => setActive(s)} className="w-full text-left rounded-xl border border-slate-800 bg-slate-900/50 p-4 flex items-center justify-between hover:border-slate-700">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{s.title}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status === 'LIVE' ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-700 text-slate-400'}`}>{s.status === 'LIVE' ? '● LIVE' : 'ENDED'}</span>
                <span className="text-[10px] text-slate-500 uppercase">{s.platform}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">{new Date(s.createdAt).toLocaleString()}</div>
            </div>
            <div className="text-right">
              <div className="font-extrabold text-emerald-400">{money(s.totalSales, s.currency)}</div>
              <div className="text-[11px] text-slate-500">{s.orderCount} orders</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────── Session console ─────────────────────── */
function SessionConsole({ session, onBack }: { session: Session; onBack: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showPin, setShowPin] = useState(false);
  const [manualText, setManualText] = useState('');
  const [manualHandle, setManualHandle] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [ended, setEnded] = useState(session.status === 'ENDED');
  const [onShop, setOnShop] = useState(session.showOnStorefront !== false);
  const toggleShop = async () => {
    const next = !onShop; setOnShop(next);
    try { await api(`/live-sales/${session.id}/storefront`, { method: 'POST', body: JSON.stringify({ show: next }) }); } catch { setOnShop(!next); }
  };
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [st, cs] = await Promise.all([
        api<Stats>(`/live-sales/${session.id}/stats`),
        api<Comment[]>(`/live-sales/${session.id}/comments`),
      ]);
      setStats(st); setComments(Array.isArray(cs) ? cs : []);
    } catch { /* offline */ }
  }, [session.id]);

  useEffect(() => {
    refresh();
    api<Product[]>('/pos/products').then((p) => setProducts(Array.isArray(p) ? p : [])).catch(() => {});
  }, [refresh]);

  // Poll the comment feed while live (assisted + bridge comments both land here).
  useEffect(() => {
    if (ended) return;
    timer.current = setInterval(refresh, 4000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [ended, refresh]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  const addManual = async () => {
    if (!manualText.trim()) return;
    await api(`/live-sales/${session.id}/comments`, { method: 'POST', body: JSON.stringify({ text: manualText.trim(), buyerHandle: manualHandle.trim() || '@guest' }) });
    setManualText(''); setManualHandle(''); refresh();
  };

  const convert = async (c: Comment) => {
    setBusy(c.id);
    try {
      const phone = c.buyerContact || prompt(`Buyer phone for payment request (optional) — ${c.buyerHandle}`, '') || '';
      const res = await api<{ lineTotal: number; remainingStock: number; payment: { message: string } }>(`/live-sales/comments/${c.id}/convert`, {
        method: 'POST', body: JSON.stringify({ buyerContact: phone || undefined }),
      });
      flash(`Sold ${money(res.lineTotal, session.currency)} · ${res.payment.message}`);
      refresh();
    } catch (e) { flash((e as Error).message || 'Convert failed'); }
    finally { setBusy(null); }
  };

  const ignore = async (c: Comment) => { await api(`/live-sales/comments/${c.id}/ignore`, { method: 'POST', body: '{}' }); refresh(); };

  const end = async () => { await api(`/live-sales/${session.id}/end`, { method: 'POST', body: '{}' }); setEnded(true); };

  const bridgeUrl = `${window.location.origin}/api/live-sales/ingest/${session.ingestToken}`;

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-slate-400 hover:text-white text-sm">←</button>
          <span className="font-bold">{session.title}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ended ? 'bg-slate-700 text-slate-400' : 'bg-rose-500/20 text-rose-400'}`}>{ended ? 'ENDED' : '● LIVE'}</span>
        </div>
        <div className="flex items-center gap-2">
          {!ended && (
            <button onClick={toggleShop} title="Show this live as a shoppable banner on your online storefront"
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border ${onShop ? 'bg-fuchsia-600/20 border-fuchsia-500/40 text-fuchsia-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
              <ShoppingBag className="w-3.5 h-3.5" /> {onShop ? 'On shop' : 'Off shop'}
            </button>
          )}
          {!ended && <button onClick={end} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"><Square className="w-3.5 h-3.5" /> End live</button>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 p-3 shrink-0">
        <Stat label="Sales" value={money(stats?.totalSales ?? 0, session.currency)} Icon={TrendingUp} tone="text-emerald-400" />
        <Stat label="Orders" value={String(stats?.orderCount ?? 0)} Icon={ShoppingBag} tone="text-indigo-400" />
        <Stat label="Waiting" value={String(stats?.pendingComments ?? 0)} Icon={MessageCircle} tone="text-amber-400" />
        <Stat label="Pinned" value={String(stats?.pins.length ?? 0)} Icon={Pin} tone="text-fuchsia-400" />
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 px-3 pb-3 min-h-0">
        {/* Pinned products */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Pinned products</span>
            {!ended && <button onClick={() => setShowPin(true)} className="inline-flex items-center gap-1 text-xs font-bold text-fuchsia-400"><Plus className="w-3.5 h-3.5" /> Pin</button>}
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-1.5">
            {(stats?.pins ?? []).length === 0 ? <p className="text-xs text-slate-500 text-center py-6">Pin products with a buy-code (e.g. A1) that you announce on the live.</p> :
              stats!.pins.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-extrabold text-fuchsia-400 bg-fuchsia-500/10 rounded px-2 py-0.5 text-sm">{p.code}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{p.name}</div>
                      <div className="text-[11px] text-slate-500">{money(p.livePrice > 0 ? p.livePrice : p.catalogPrice, session.currency)} · sold {p.soldQty}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <div className={`text-sm font-bold ${p.stock <= 0 ? 'text-rose-400' : p.stock <= 3 ? 'text-amber-400' : 'text-slate-300'}`}>{p.stock <= 0 ? 'SOLD OUT' : `${p.stock} left`}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Comment feed */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Comments → orders</span>
            <span className="text-[10px] text-slate-500">{ended ? 'ended' : 'live · auto-refresh'}</span>
          </div>
          {!ended && (
            <div className="p-2 border-b border-slate-800 flex gap-1.5">
              <input value={manualHandle} onChange={(e) => setManualHandle(e.target.value)} placeholder="@buyer" className="w-24 h-9 px-2 rounded-lg bg-slate-950 border border-slate-700 text-xs" />
              <input value={manualText} onChange={(e) => setManualText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addManual(); }} placeholder='Type a comment e.g. "A1 x2"' className="flex-1 h-9 px-2 rounded-lg bg-slate-950 border border-slate-700 text-xs" />
              <button onClick={addManual} className="h-9 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white"><Send className="w-3.5 h-3.5" /></button>
            </div>
          )}
          <div className="flex-1 overflow-auto p-2 space-y-1.5">
            {comments.length === 0 ? <p className="text-xs text-slate-500 text-center py-6">Comments appear here — typed by you, or forwarded by a bridge.</p> :
              comments.map((c) => (
                <div key={c.id} className={`rounded-lg border px-3 py-2 ${c.status === 'CONVERTED' ? 'border-emerald-800 bg-emerald-500/5' : c.status === 'MATCHED' ? 'border-amber-800 bg-amber-500/5' : 'border-slate-800 bg-slate-950'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-300">{c.buyerHandle || '@guest'}</span>
                      {c.matchedCode && <span className="ml-1.5 font-mono text-[10px] text-fuchsia-400">{c.matchedCode}×{c.qty}</span>}
                      <span className="ml-1.5 text-[9px] text-slate-600 uppercase">{c.source}</span>
                      <div className="text-sm text-slate-400 truncate">{c.text}</div>
                    </div>
                    <div className="shrink-0">
                      {c.status === 'CONVERTED' ? <span className="text-[10px] font-bold text-emerald-400 inline-flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> SOLD</span>
                        : c.status === 'IGNORED' ? <span className="text-[10px] text-slate-500">ignored</span>
                        : c.status === 'FAILED' ? <span className="text-[10px] text-rose-400">failed</span>
                        : !ended && (
                          <div className="flex gap-1">
                            <button onClick={() => convert(c)} disabled={busy === c.id || !c.matchedCode} title={c.matchedCode ? 'Convert to sale' : 'No buy-code matched'}
                              className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold disabled:opacity-40">
                              {busy === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Sell
                            </button>
                            <button onClick={() => ignore(c)} className="text-slate-500 hover:text-slate-300"><XCircle className="w-4 h-4" /></button>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
          {/* Bridge URL */}
          <div className="px-3 py-2 border-t border-slate-800 flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input readOnly value={bridgeUrl} className="flex-1 bg-transparent text-[10px] text-slate-500 truncate outline-none" />
            <button onClick={() => { navigator.clipboard?.writeText(bridgeUrl); flash('Bridge URL copied'); }} className="text-slate-400 hover:text-white"><Copy className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>

      {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-xl z-50 inline-flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {toast}</div>}
      {showPin && <PinDialog session={session} products={products} onClose={() => setShowPin(false)} onPinned={() => { setShowPin(false); refresh(); }} />}
    </div>
  );
}

function PinDialog({ session, products, onClose, onPinned }: { session: Session; products: Product[]; onClose: () => void; onPinned: () => void }) {
  const [productId, setProductId] = useState('');
  const [code, setCode] = useState('');
  const [livePrice, setLivePrice] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 30);

  const pin = async () => {
    if (!productId || !code.trim()) { setErr('Pick a product and a buy-code.'); return; }
    setBusy(true); setErr(null);
    try { await api(`/live-sales/${session.id}/pins`, { method: 'POST', body: JSON.stringify({ productId, code: code.trim(), livePrice: Number(livePrice) || 0 }) }); onPinned(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 font-bold"><Pin className="w-4 h-4 text-fuchsia-400" /> Pin a product</div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="w-full h-9 px-3 rounded-lg bg-slate-950 border border-slate-700 text-sm" />
        <div className="max-h-48 overflow-auto rounded-lg border border-slate-800 divide-y divide-slate-800">
          {filtered.map((p) => (
            <button key={p.id} onClick={() => setProductId(p.id)} className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${productId === p.id ? 'bg-fuchsia-500/15 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
              <span className="truncate"><Package className="w-3.5 h-3.5 inline mr-1 text-slate-500" />{p.name}</span>
              <span className="text-[11px] text-slate-500 shrink-0">{money(p.price, session.currency)} · {p.stock} left</span>
            </button>
          ))}
          {filtered.length === 0 && <div className="px-3 py-4 text-xs text-slate-500">No products. Add some in POS first.</div>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Buy-code e.g. A1" className="h-10 px-3 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono" />
          <input value={livePrice} onChange={(e) => setLivePrice(e.target.value.replace(/\D/g, ''))} placeholder="Live price (optional)" className="h-10 px-3 rounded-lg bg-slate-950 border border-slate-700 text-sm" />
        </div>
        {err && <div className="text-xs text-rose-400">{err}</div>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg bg-slate-800 text-slate-300 text-sm font-semibold">Cancel</button>
          <button onClick={pin} disabled={busy} className="flex-1 h-10 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-bold disabled:opacity-50">{busy ? 'Pinning…' : 'Pin product'}</button>
        </div>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) { return <div className="grid place-items-center py-16">{children}</div>; }
function Stat({ label, value, Icon, tone }: { label: string; value: string; Icon: typeof TrendingUp; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-center justify-between"><span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span><Icon className={`w-3.5 h-3.5 ${tone}`} /></div>
      <div className={`text-lg font-extrabold mt-0.5 ${tone}`}>{value}</div>
    </div>
  );
}
