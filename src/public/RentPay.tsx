import { useEffect, useState } from 'react';
import { publicApi } from './api';
import { Landmark, Loader2, CheckCircle2, AlertCircle, Search, ArrowLeft } from 'lucide-react';

/**
 * Public rent-collection panel for banks & agents.
 *
 * A landlord shares this link (…/pay) with a bank branch or field agent. The
 * clerk types the tenant's 8-char rent token, the page shows who it belongs to
 * and how much is expected vs already paid, the clerk enters the amount
 * received, and confirming records the payment. No token → no payment. Partial
 * payments leave the token open so the same code completes it later.
 *
 * No login: it talks only to the @Public /property/tokens endpoints, which are
 * rate-limited server-side against brute force.
 */

interface TokenView {
  code: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
  tenantName: string;
  expected: number;
  paid: number;
  remaining: number;
  currency: string;
  fullyPaid: boolean;
}

interface RedeemResult {
  code: string;
  status: string;
  expected: number;
  paid: number;
  remaining: number;
  currency: string;
  fullyPaid: boolean;
}

const money = (n: number, ccy = 'TZS') => `${ccy} ${Math.round(n).toLocaleString()}`;

export default function RentPay({ code: initialCode = '' }: { code?: string }) {
  const [code, setCode] = useState(initialCode);
  const [token, setToken] = useState<TokenView | null>(null);
  const [amount, setAmount] = useState('');
  const [phase, setPhase] = useState<'enter' | 'looking' | 'found' | 'redeeming' | 'done'>('enter');
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const lookup = async (raw: string) => {
    const c = raw.trim().toUpperCase();
    setErr(null);
    if (!/^[A-Z0-9]{8}$/.test(c)) { setErr('Enter the 8-character token code.'); return; }
    setPhase('looking');
    try {
      const t = await publicApi<TokenView>(`/property/tokens/${encodeURIComponent(c)}`);
      setToken(t);
      setAmount(String(t.remaining || ''));
      setPhase('found');
    } catch (e) {
      setErr(friendly(e));
      setPhase('enter');
    }
  };

  // Deep-linked code (scanned QR → /pay/CODE) looks up automatically.
  useEffect(() => {
    if (initialCode && /^[A-Z0-9]{8}$/i.test(initialCode)) void lookup(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redeem = async () => {
    if (!token) return;
    const amt = Number(amount);
    setErr(null);
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Enter the amount received.'); return; }
    setPhase('redeeming');
    try {
      const r = await publicApi<RedeemResult>(`/property/tokens/${encodeURIComponent(token.code)}/redeem`, {
        method: 'POST',
        body: JSON.stringify({ amountReceived: amt }),
      });
      setResult(r);
      setPhase('done');
    } catch (e) {
      setErr(friendly(e));
      setPhase('found');
    }
  };

  const reset = () => {
    setCode(''); setToken(null); setAmount(''); setResult(null); setErr(null); setPhase('enter');
  };

  return (
    <div className="min-h-[100dvh] bg-slate-100 flex items-start sm:items-center justify-center p-4" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 grid place-items-center"><Landmark className="w-5 h-5" /></div>
          <div>
            <div className="text-sm font-bold leading-none">Rent Collection</div>
            <div className="text-[11px] text-slate-300 mt-0.5">Bank &amp; agent panel</div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Step 1 — enter code */}
          {(phase === 'enter' || phase === 'looking') && (
            <>
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Tenant rent token</span>
                <div className="mt-1 flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && lookup(code)}
                    maxLength={8}
                    placeholder="e.g. D8487KXS"
                    autoFocus
                    className="flex-1 h-12 px-3 rounded-lg border border-slate-300 bg-white text-lg font-mono tracking-widest text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => lookup(code)}
                    disabled={phase === 'looking'}
                    className="px-4 h-12 rounded-lg bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {phase === 'looking' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Find
                  </button>
                </div>
              </label>
              <p className="text-[11px] text-slate-400">Ask the tenant for the 8-character code on their rent token (or scan its QR).</p>
            </>
          )}

          {/* Step 2 — found, collect */}
          {(phase === 'found' || phase === 'redeeming') && token && (
            <>
              <button onClick={reset} className="text-[11px] text-slate-400 hover:text-slate-600 inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Different token</button>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold">Paying for</div>
                <div className="text-lg font-bold text-slate-900">{token.tenantName}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Expected" value={money(token.expected, token.currency)} />
                  <Stat label="Already paid" value={money(token.paid, token.currency)} />
                  <Stat label="Remaining" value={money(token.remaining, token.currency)} highlight />
                </div>
                {token.status !== 'ACTIVE' && (
                  <div className="mt-3 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    This token is {token.status.toLowerCase()} and can’t take further payments.
                  </div>
                )}
              </div>

              {token.status === 'ACTIVE' && (
                <>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Amount received ({token.currency})</span>
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                      inputMode="numeric"
                      className="mt-1 w-full h-12 px-3 rounded-lg border border-slate-300 bg-white text-lg font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </label>
                  <button
                    onClick={redeem}
                    disabled={phase === 'redeeming'}
                    className="w-full h-12 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {phase === 'redeeming' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirm payment
                  </button>
                </>
              )}
            </>
          )}

          {/* Step 3 — done */}
          {phase === 'done' && result && (
            <div className="text-center space-y-3 py-2">
              <div className={`w-14 h-14 mx-auto rounded-full grid place-items-center ${result.fullyPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="text-lg font-bold text-slate-900">
                {result.fullyPaid ? 'Paid in full' : 'Partial payment recorded'}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left space-y-1.5 text-sm">
                <Row label="Recorded" value={money(result.paid, result.currency)} />
                <Row label="Expected" value={money(result.expected, result.currency)} />
                <Row label="Remaining" value={money(result.remaining, result.currency)} strong={!result.fullyPaid} />
              </div>
              {!result.fullyPaid && (
                <p className="text-[12px] text-slate-500">The tenant can complete the balance later with the <span className="font-mono font-bold">{result.code}</span> token.</p>
              )}
              <button onClick={reset} className="w-full h-11 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50">
                New collection
              </button>
            </div>
          )}

          {err && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {err}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg px-1.5 py-2 ${highlight ? 'bg-blue-50 border border-blue-100' : ''}`}>
      <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wide">{label}</div>
      <div className={`text-[11px] font-bold mt-0.5 ${highlight ? 'text-blue-700' : 'text-slate-900'}`}>{value}</div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={strong ? 'font-bold text-slate-900' : 'text-slate-700'}>{value}</span>
    </div>
  );
}

function friendly(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/404/.test(m)) return 'No tenant found for that token. Check the code.';
  if (/expired/i.test(m)) return 'This token has expired. Ask the tenant to generate a new one.';
  if (/used|cancelled/i.test(m)) return 'This token has already been fully paid or cancelled.';
  if (/429/.test(m)) return 'Too many attempts. Wait a moment and try again.';
  return 'Something went wrong. Try again.';
}
