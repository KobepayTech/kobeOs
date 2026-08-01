import { useCallback, useEffect, useState } from 'react';
import { publicApi } from './api';
import { api } from '@/lib/api';

interface Lookup {
  via: 'master' | 'supplier'; currency: string; claimStatus: string;
  claimBalance: number; payableNow: number; supplierName?: string; supplierStatus?: string;
}
interface RedeemResult { claimBalance: number; paidNow: number; currency: string; claimStatus: string; via: string; supplierRemaining?: number }

const money = (n: number, ccy: string) => `${ccy} ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/**
 * Cashier page for a scanned remittance QR (master or supplier). Anyone can see
 * what's payable (public lookup); recording a cash-out requires the cashier to
 * be signed in (authenticated redeem) so a supplier can't self-redeem.
 */
export default function RemittanceCashier({ code }: { code: string }) {
  const [info, setInfo] = useState<Lookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<RedeemResult | null>(null);
  const [authNeeded, setAuthNeeded] = useState(false);

  const load = useCallback(async () => {
    try { setInfo(await publicApi<Lookup>(`/remittance/lookup/${code}`)); setError(null); }
    catch (e) { setError((e as Error).message); }
  }, [code]);
  useEffect(() => { load(); }, [load]);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!(amt > 0)) return;
    setBusy(true); setError(null); setAuthNeeded(false);
    try {
      const key = (crypto as { randomUUID?: () => string }).randomUUID?.() ?? `${code}-${Date.now()}`;
      const res = await api<RedeemResult>(`/remittance/redeem/${code}`, {
        method: 'POST',
        body: JSON.stringify({ amountReceived: amt, idempotencyKey: key }),
      });
      setDone(res); setAmount(''); await load();
    } catch (e) {
      const msg = (e as Error).message;
      if (/401|unauth/i.test(msg)) setAuthNeeded(true);
      setError(msg);
    } finally { setBusy(false); }
  };

  if (error && !info) return <Center><div className="text-red-300">{error}</div></Center>;
  if (!info) return <Center><div className="text-white/60">Loading…</div></Center>;

  return (
    <div className="min-h-screen bg-[#0b0b16] text-white/90 grid place-items-center px-4 py-8">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-xs text-white/40 uppercase tracking-wider">Cash-out · {info.via === 'supplier' ? (info.supplierName || 'Supplier') : 'Main code'}</div>
          <div className="text-3xl font-bold mt-1 tabular-nums">{money(info.payableNow, info.currency)}</div>
          <div className="text-xs text-white/40 mt-1">payable now · balance {money(info.claimBalance, info.currency)} · {info.claimStatus}</div>
        </div>

        {done && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200 text-center">
            Paid {money(done.paidNow, done.currency)}. Balance now {money(done.claimBalance, done.currency)}{done.claimStatus === 'SETTLED' ? ' · fully settled' : ''}.
          </div>
        )}

        {info.payableNow > 0 && info.claimStatus === 'OPEN' && info.supplierStatus !== 'USED' ? (
          <form onSubmit={pay} className="space-y-2 rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4">
            <label className="text-sm text-white/70">Amount handed over</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={`Up to ${money(info.payableNow, info.currency)}`} className="w-full h-11 px-3 rounded-lg bg-white/[0.05] border border-white/10 text-lg tabular-nums outline-none" />
            <button disabled={busy || !(Number(amount) > 0)} className="w-full h-11 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 font-semibold">
              {busy ? 'Recording…' : 'Record cash-out'}
            </button>
            {authNeeded && <p className="text-[11px] text-amber-300">Cashier must be signed in to KobeOS on this device to record a payout.</p>}
            {error && !authNeeded && <p className="text-[11px] text-red-300">{error}</p>}
          </form>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-white/60 text-center">Nothing left to pay on this code.</div>
        )}
        <p className="text-[11px] text-white/40 text-center">The amount is capped at the balance{info.via === 'supplier' ? ' and this supplier’s limit' : ''} — you can’t overpay.</p>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#0b0b16] grid place-items-center px-6 text-center">{children}</div>;
}
