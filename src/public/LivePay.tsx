import { useCallback, useEffect, useState } from 'react';
import { publicApi } from './api';

interface Checkout {
  token: string; status: string; expired: boolean; reservedUntil: string | null;
  qty: number; buyerHandle: string;
  product: { id: string; sku: string; name: string; imageUrl: string | null } | null;
  unitPrice: number; currency: string; sessionTitle: string; platform: string;
  storefrontPath: string;
}

const money = (n: number, ccy: string) => `${ccy} ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/**
 * Buyer's checkout page for a live-sale reservation (the link they get after
 * commenting BUY). Shows the held product + price + a live countdown, takes a
 * phone number, and confirms the order via the public pay-by-token endpoint.
 */
export default function LivePay({ token }: { token: string }) {
  const [data, setData] = useState<Checkout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [left, setLeft] = useState<number>(0);

  const load = useCallback(async () => {
    try { setData(await publicApi<Checkout>(`/live-sales/public/checkout/${token}`)); setError(null); }
    catch (e) { setError((e as Error).message); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  // Countdown to the reservation expiry.
  useEffect(() => {
    if (!data?.reservedUntil) return;
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(data.reservedUntil as string).getTime() - Date.now()) / 1000)));
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, [data?.reservedUntil]);

  const pay = async () => {
    if (!phone.trim()) { setError('Enter your phone number to confirm.'); return; }
    setBusy(true); setError(null);
    try {
      await publicApi(`/live-sales/public/checkout/${token}/pay`, { method: 'POST', body: JSON.stringify({ buyerContact: phone.trim() }) });
      setDone(true);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  if (error && !data) return <Center><div className="text-red-300">{error}</div></Center>;
  if (!data) return <Center><div className="text-white/60">Loading your reservation…</div></Center>;

  const total = data.unitPrice * data.qty;
  const expired = data.expired || (data.reservedUntil && left <= 0 && !done);

  return (
    <div className="min-h-screen bg-[#0b0b16] text-white/90 grid place-items-center px-4 py-8">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center text-xs text-white/40 uppercase tracking-wider">{data.sessionTitle}</div>

        {done ? (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-center space-y-1">
            <div className="text-2xl">✅</div>
            <div className="text-sm font-semibold text-emerald-200">Order confirmed</div>
            <div className="text-xs text-white/60">We’ve reserved {data.qty} × {data.product?.name}. The seller will contact you on {phone} to complete delivery/payment.</div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden">
            <div className="aspect-square bg-white/[0.03] grid place-items-center">
              {data.product?.imageUrl
                ? <img src={data.product.imageUrl} alt={data.product?.name} className="w-full h-full object-contain" />
                : <div className="text-5xl font-bold text-white/20">{(data.product?.name || '?').slice(0, 2).toUpperCase()}</div>}
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="text-base font-semibold">{data.product?.name ?? 'Reserved item'}</div>
                <div className="text-sm text-white/50">{data.qty} × {money(data.unitPrice, data.currency)} = <b className="text-white/90">{money(total, data.currency)}</b></div>
              </div>

              {expired ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-sm text-amber-200 text-center">
                  This reservation expired. Comment <b>BUY</b> again in the live to get a fresh link.
                </div>
              ) : (
                <>
                  {data.reservedUntil && (
                    <div className="text-center text-xs text-amber-300">Held for {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} more</div>
                  )}
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Your phone number" className="w-full h-11 px-3 rounded-lg bg-white/[0.05] border border-white/10 text-sm outline-none" />
                  <a href={data.storefrontPath || `/?live=${encodeURIComponent(token)}`} className="block w-full h-11 leading-[44px] rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 text-center font-semibold">
                    Add more products from the store
                  </a>
                  <button onClick={pay} disabled={busy || !phone.trim()} className="w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 font-semibold">
                    {busy ? 'Confirming…' : `Confirm order · ${money(total, data.currency)}`}
                  </button>
                  {error && <p className="text-[11px] text-red-300 text-center">{error}</p>}
                </>
              )}
            </div>
          </div>
        )}
        <p className="text-[11px] text-white/35 text-center">Reserved from a live sale · {data.buyerHandle}</p>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#0b0b16] grid place-items-center px-6 text-center">{children}</div>;
}
