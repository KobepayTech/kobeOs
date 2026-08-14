import { useCallback, useEffect, useState } from 'react';
import { publicApi } from './api';

interface Bucket { category: string; balance: number }
interface Wallet { available: number; savings: number; buckets: Bucket[]; reservedTotal: number; total: number; currency: string; spentToday: number }
interface Group { id: string; title: string; productName: string; groupPrice: number; normalPrice: number; deadline: string | null; deliveryLocation: string; joined: boolean }
interface Pack { id: string; name: string; className: string; items: number }
interface Order { reference: string; groupTitle: string; qty: number; amount: number; status: string; collected: boolean; collectedAt: string | null }
interface Portal {
  student: { name: string; code: string; className: string };
  topUp: { reference: string; note: string };
  wallet: Wallet;
  history: Array<{ kind: string; category: string; amount: number; description: string; at: string }>;
  groups: Group[]; packs: Pack[]; orders: Order[]; currency: string;
}

const money = (n: number, c = 'TZS') => `${c === 'TZS' ? 'TSh ' : c + ' '}${Number(n || 0).toLocaleString()}`;

/**
 * Parent/student wallet — opened from the tokenised link the school shares
 * (/kobepay/me/{qrToken}). No login. Shows the four money pools, how to top up,
 * joinable purchase groups, starter packs and the student's orders.
 */
export default function StudentWallet({ token }: { token: string }) {
  const [d, setD] = useState<Portal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setD(await publicApi<Portal>(`/kobepay-pro/me/${token}`)); setError(null); }
    catch (e) { setError((e as Error).message); }
  }, [token]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const join = async (g: Group) => {
    setBusy(g.id); setError(null);
    try { setD(await publicApi<Portal>(`/kobepay-pro/me/${token}/groups/${g.id}/join`, { method: 'POST', body: '{}' })); }
    catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };
  const buyPack = async (p: Pack) => {
    setBusy(p.id); setError(null);
    try { setD(await publicApi<Portal>(`/kobepay-pro/me/${token}/packs/${p.id}/buy`, { method: 'POST', body: '{}' })); }
    catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  if (error && !d) return <Center><div className="text-red-300">{error}</div></Center>;
  if (!d) return <Center><div className="text-white/60">Loading…</div></Center>;
  const w = d.wallet;
  const c = d.currency;

  return (
    <div className="min-h-screen bg-[#0b0b16] text-white/90 px-4 py-5">
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-wider text-emerald-300">Kobepay · Pocket money</div>
          <h1 className="text-xl font-extrabold">{d.student.name}</h1>
          <div className="text-xs text-white/40">{d.student.code}{d.student.className ? ` · ${d.student.className}` : ''}</div>
        </div>

        {/* Balance */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="text-[10px] uppercase text-white/40">Total balance</div>
          <div className="text-3xl font-black">{money(w.total, c)}</div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[['Available', w.available], ['For school', (w.buckets || []).reduce((s, b) => s + b.balance, 0)], ['Orders (held)', w.reservedTotal], ['Savings', w.savings]].map(([k, v]) => (
              <div key={k as string} className="rounded-xl bg-white/[0.05] p-2.5">
                <div className="text-[10px] uppercase text-white/40">{k}</div>
                <div className="font-bold mt-0.5">{money(v as number, c)}</div>
              </div>
            ))}
          </div>
          {(w.buckets || []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {w.buckets.map((b) => <span key={b.category} className="text-[10px] px-2 py-1 rounded-full bg-white/[0.06]">{b.category} {money(b.balance, c)}</span>)}
            </div>
          )}
        </div>

        {/* Top up */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <div className="text-sm font-bold text-emerald-200">Add money</div>
          <p className="text-xs text-white/60 mt-1">{d.topUp.note}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm font-mono tracking-wider">{d.topUp.reference}</code>
            <button onClick={() => navigator.clipboard?.writeText(d.topUp.reference)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold">Copy</button>
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}

        {/* Starter packs */}
        {d.packs.length > 0 && (
          <Section title="Starter packs">
            {d.packs.map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
                <div className="min-w-0 flex-1"><div className="font-semibold truncate">{p.name}</div><div className="text-[11px] text-white/40">{p.items} item(s){p.className ? ` · ${p.className}` : ''}</div></div>
                <button disabled={busy === p.id} onClick={() => buyPack(p)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold disabled:opacity-40">Buy pack</button>
              </div>
            ))}
          </Section>
        )}

        {/* Joinable groups */}
        {d.groups.length > 0 && (
          <Section title="Group offers">
            {d.groups.map((g) => (
              <div key={g.id} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{g.title}</div>
                  <div className="text-[11px] text-white/40">{money(g.groupPrice, c)}{g.normalPrice > 0 && <span className="line-through ml-1 text-white/25">{money(g.normalPrice, c)}</span>} · {g.deliveryLocation || 'school'}</div>
                </div>
                {g.joined
                  ? <span className="text-[11px] text-emerald-400 font-bold">Joined ✓</span>
                  : <button disabled={busy === g.id} onClick={() => join(g)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold disabled:opacity-40">Join</button>}
              </div>
            ))}
          </Section>
        )}

        {/* Orders */}
        {d.orders.length > 0 && (
          <Section title="My orders">
            {d.orders.map((o) => (
              <div key={o.reference} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0 text-sm">
                <div className="min-w-0 flex-1"><div className="truncate">{o.groupTitle}</div><div className="text-[11px] text-white/40">×{o.qty} · {money(o.amount, c)} · {o.reference}</div></div>
                {o.collected ? <span className="text-[11px] text-emerald-400 font-bold">Collected ✓</span> : <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.08]">{o.status}</span>}
              </div>
            ))}
          </Section>
        )}

        {/* History */}
        <Section title="Recent activity">
          {d.history.length === 0 ? <p className="text-xs text-white/40 py-2">No activity yet.</p> : d.history.slice(0, 15).map((h, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 text-sm border-b border-white/5 last:border-0">
              <div className="min-w-0 flex-1"><div className="truncate">{h.description || h.kind}</div><div className="text-[10px] text-white/40">{new Date(h.at).toLocaleString()}</div></div>
              <span className={`font-semibold ${h.kind === 'DEPOSIT' || h.kind === 'RELEASE' ? 'text-emerald-400' : 'text-white/70'}`}>{money(h.amount, c)}</span>
            </div>
          ))}
        </Section>

        <p className="text-[10px] text-white/30 text-center">Kobepay Pro · controlled by the parent & school.</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-white/50 mb-1">{title}</div>
      {children}
    </div>
  );
}
function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#0b0b16] grid place-items-center px-6 text-center">{children}</div>;
}
