import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';
import {
  Phone, KeySquare, Loader2, LogOut, Package, Receipt, Wallet, Star,
  AlertTriangle, ExternalLink, CheckCircle2,
} from 'lucide-react';

/**
 * Customer self-serve portal at /me.
 *
 * Three states:
 *   1. Phone entry       → POST /me/request-otp
 *   2. OTP code entry    → POST /me/verify-otp  → token stored in localStorage
 *   3. Dashboard         → GET  /me/dashboard   with Bearer token
 *
 * No-auth public page — uses its own portal-scoped token kind so it
 * can never accidentally be used for operator endpoints.
 */

const TOKEN_KEY = 'kobeos_portal_token';

interface Dashboard {
  phone: string;
  cargoCustomer: { displayId: string; name: string; balance: number; currency: string } | null;
  loyalty:       { points: number; tier?: string | null } | null;
  parcels: Array<{
    parcelId: string; description: string; destination: string;
    weight: number; lifecycleStatus: string; preAlertedAt?: string | null;
    externalTracking?: string | null; createdAt: string;
  }>;
  recentOrders: Array<{
    orderNumber: string; total: number; currency: string;
    createdAt: string; itemCount: number;
    items: Array<{ productName: string; quantity: number; unitPrice: number }>;
  }>;
}

export default function CustomerPortal() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetch(`${API_BASE}/me/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          throw new Error(b?.message || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d: Dashboard) => { if (!cancelled) setData(d); })
      .catch((e) => {
        if (cancelled) return;
        setErr((e as Error).message);
        // 401 → token bad/expired, drop it so user re-OTPs.
        if (/401|unauth|expired|invalid/i.test((e as Error).message)) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const onLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setData(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white">
      <header className="border-b border-white/[0.06] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-300 grid place-items-center">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold">My account</h1>
              <p className="text-[11px] text-white/50">Track your parcels and orders</p>
            </div>
          </div>
          {token && (
            <button onClick={onLogout} className="text-[11px] text-white/50 hover:text-white inline-flex items-center gap-1">
              <LogOut className="w-3 h-3" /> Sign out
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {!token ? (
          <LoginFlow onAuthed={(t) => { localStorage.setItem(TOKEN_KEY, t); setToken(t); }} />
        ) : loading ? (
          <div className="text-center py-12 text-white/40 text-sm">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : err ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200 text-xs inline-flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" /> {err}
          </div>
        ) : data ? (
          <DashboardView data={data} />
        ) : null}
      </main>
    </div>
  );
}

function LoginFlow({ onAuthed }: { onAuthed: (token: string) => void }) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const requestOtp = async () => {
    if (!phone.trim()) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${API_BASE}/me/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error(b?.message || `HTTP ${r.status}`);
      }
      setStep('code');
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  const verify = async () => {
    if (!code.trim() || code.length !== 6) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${API_BASE}/me/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error(b?.message || `HTTP ${r.status}`);
      }
      const { token } = await r.json() as { token: string };
      onAuthed(token);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-3">
        <div className="text-xs font-bold text-white/60 uppercase tracking-wide">
          {step === 'phone' ? 'Enter your phone number' : `Enter the code we sent to ${phone}`}
        </div>
        {step === 'phone' ? (
          <>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void requestOtp(); }}
                placeholder="+255 712 345 678"
                className="w-full h-12 pl-9 pr-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm"
              />
            </div>
            <button
              onClick={requestOtp}
              disabled={busy || !phone.trim()}
              className="w-full h-11 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send code'}
            </button>
          </>
        ) : (
          <>
            <div className="relative">
              <KeySquare className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') void verify(); }}
                placeholder="6-digit code"
                className="w-full h-12 pl-9 pr-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-lg font-mono tracking-widest text-center"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setStep('phone'); setCode(''); setErr(null); }}
                className="h-11 px-3 rounded-xl text-white/60 text-xs font-bold"
              >
                Change number
              </button>
              <button
                onClick={verify}
                disabled={busy || code.length !== 6}
                className="flex-1 h-11 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
              </button>
            </div>
            <button onClick={requestOtp} disabled={busy} className="text-[11px] text-violet-300 font-bold">
              Resend code
            </button>
          </>
        )}
        {err && (
          <div className="text-[11px] text-rose-300 inline-flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {err}
          </div>
        )}
      </div>
      <p className="text-[10px] text-white/30 text-center px-4">
        We'll send a 6-digit code via SMS. Standard message rates apply.
      </p>
    </div>
  );
}

function DashboardView({ data }: { data: Dashboard }) {
  const noData = !data.cargoCustomer && !data.loyalty && data.parcels.length === 0 && data.recentOrders.length === 0;
  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {data.cargoCustomer && (
          <SummaryCard icon={<Phone />} label="Cargo ID" value={data.cargoCustomer.displayId} sub={data.cargoCustomer.name} tone="violet" />
        )}
        {data.cargoCustomer && (
          <SummaryCard
            icon={<Wallet />}
            label="Cargo wallet"
            value={`${data.cargoCustomer.currency} ${Math.round(data.cargoCustomer.balance).toLocaleString()}`}
            tone="amber"
          />
        )}
        {data.loyalty && (
          <SummaryCard
            icon={<Star />}
            label="Loyalty"
            value={`${data.loyalty.points} pts`}
            sub={data.loyalty.tier ?? undefined}
            tone="emerald"
          />
        )}
      </div>

      {noData && (
        <div className="rounded-2xl border border-white/[0.06] p-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-white/30 mx-auto mb-2" />
          <p className="text-sm text-white/60">Signed in as {data.phone}</p>
          <p className="text-[11px] text-white/40 mt-1">No parcels or recent purchases on this number yet.</p>
        </div>
      )}

      {/* Parcels */}
      {data.parcels.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-white/60 uppercase tracking-wide mb-2 inline-flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> My parcels ({data.parcels.length})
          </h2>
          <div className="space-y-2">
            {data.parcels.map((p) => (
              <a
                key={p.parcelId}
                href={`/track/${p.parcelId}`}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 hover:bg-white/[0.05]"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-mono font-bold text-amber-300">{p.parcelId}</span>
                  <span className="text-[9px] uppercase font-bold opacity-70">{p.lifecycleStatus.replace(/_/g, ' ')}</span>
                </div>
                <div className="text-xs text-white/70 mt-0.5">{p.description || '—'}</div>
                <div className="text-[10px] text-white/40 mt-1 inline-flex items-center gap-1">
                  → {p.destination} · {Number(p.weight).toFixed(2)} kg
                  <ExternalLink className="w-2.5 h-2.5" />
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* POS history */}
      {data.recentOrders.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-white/60 uppercase tracking-wide mb-2 inline-flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5" /> Recent purchases ({data.recentOrders.length})
          </h2>
          <div className="space-y-2">
            {data.recentOrders.map((o) => (
              <div key={o.orderNumber} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono font-bold">{o.orderNumber}</span>
                  <span className="text-sm font-extrabold text-amber-300 tabular-nums">
                    {o.currency} {Math.round(o.total).toLocaleString()}
                  </span>
                </div>
                <div className="text-[10px] text-white/40">{new Date(o.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</div>
                <ul className="mt-1.5 space-y-0.5">
                  {o.items.map((it, i) => (
                    <li key={i} className="text-[11px] text-white/70 flex justify-between">
                      <span>{it.quantity}× {it.productName}</span>
                      <span className="tabular-nums text-white/40">{o.currency} {Math.round(it.unitPrice * it.quantity).toLocaleString()}</span>
                    </li>
                  ))}
                  {o.itemCount > o.items.length && (
                    <li className="text-[10px] text-white/30 italic">+{o.itemCount - o.items.length} more</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: 'violet' | 'amber' | 'emerald';
}) {
  const colors = {
    violet:  'border-violet-500/30 bg-violet-500/[0.05] text-violet-200',
    amber:   'border-amber-500/30  bg-amber-500/[0.05]  text-amber-200',
    emerald: 'border-emerald-500/30 bg-emerald-500/[0.05] text-emerald-200',
  }[tone];
  return (
    <div className={`rounded-2xl border p-3 ${colors}`}>
      <div className="flex items-baseline gap-1.5">
        <div className="w-4 h-4 opacity-70">{icon}</div>
        <span className="text-[9px] uppercase font-bold opacity-70">{label}</span>
      </div>
      <div className="text-lg font-extrabold mt-0.5">{value}</div>
      {sub && <div className="text-[10px] opacity-60 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
