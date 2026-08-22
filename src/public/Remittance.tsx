import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { publicApi } from './api';

interface Supplier { code: string; supplierName: string; supplierPhone: string; authorizedAmount: number; redeemedAmount: number; status: string }
interface Payout { amount: number; supplierQrId: string | null; at: string }
interface Portal {
  masterCode: string; amount: number; balance: number; currency: string; status: string;
  senderName: string; recipientCountry: string; suppliers: Supplier[]; payouts: Payout[];
}

const money = (n: number, ccy: string) => `${ccy} ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const rcUrl = (code: string) => `${window.location.origin}/rc/${code}`;

/**
 * Sender's live remittance portal (secret portalToken). Shows the balance live,
 * lets the sender add a supplier (→ a fixed-amount child QR the cashier can
 * pay against), and lists every cash-out. Same origin/http works offline on LAN.
 */
export default function Remittance({ portalToken }: { portalToken: string }) {
  const [data, setData] = useState<Portal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ supplierName: '', supplierPhone: '', authorizedAmount: '' });
  const [newQr, setNewQr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await publicApi<Portal>(`/remittance/portal/${portalToken}`)); setError(null); }
    catch (e) { setError((e as Error).message); }
  }, [portalToken]);

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  const addSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.authorizedAmount);
    if (!(amount > 0)) return;
    setAdding(true);
    try {
      const sup = await publicApi<Supplier>(`/remittance/portal/${portalToken}/suppliers`, {
        method: 'POST',
        body: JSON.stringify({ supplierName: form.supplierName, supplierPhone: form.supplierPhone, authorizedAmount: amount }),
      });
      setForm({ supplierName: '', supplierPhone: '', authorizedAmount: '' });
      setNewQr(sup.code);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setAdding(false); }
  };

  if (error && !data) return <Center><div className="text-red-300">Couldn’t open this link: {error}</div></Center>;
  if (!data) return <Center><div className="text-white/60">Loading…</div></Center>;

  const pct = data.amount > 0 ? Math.round((data.balance / data.amount) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0b0b16] text-white/90 px-4 py-6">
      <div className="max-w-md mx-auto space-y-5">
        <div className="text-center">
          <div className="text-xs text-white/40 uppercase tracking-wider">Remittance{data.recipientCountry ? ` · ${data.recipientCountry}` : ''}</div>
          <div className="text-4xl font-bold mt-1 tabular-nums">{money(data.balance, data.currency)}</div>
          <div className="text-xs text-white/40 mt-1">available of {money(data.amount, data.currency)} · {data.status}</div>
          <div className="h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
        </div>

        {/* Master QR */}
        <Card>
          <div className="text-sm font-semibold mb-2">Main code</div>
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-lg"><QRCodeSVG value={rcUrl(data.masterCode)} size={104} level="M" /></div>
            <div className="text-xs text-white/60">
              Any cashier can pay against this for the full balance. Prefer per-supplier codes below for safety.
              <div className="mt-1 font-mono text-white/80 text-sm">{data.masterCode}</div>
            </div>
          </div>
        </Card>

        {/* Add supplier */}
        <Card>
          <div className="text-sm font-semibold mb-2">Add a supplier</div>
          <form onSubmit={addSupplier} className="space-y-2">
            <input value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} placeholder="Supplier name" className="w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/10 text-sm outline-none" />
            <input value={form.supplierPhone} onChange={(e) => setForm({ ...form, supplierPhone: e.target.value })} placeholder="Phone (optional)" className="w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/10 text-sm outline-none" />
            <input value={form.authorizedAmount} onChange={(e) => setForm({ ...form, authorizedAmount: e.target.value })} inputMode="decimal" placeholder={`Amount to allow (${data.currency})`} className="w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/10 text-sm outline-none" />
            <button disabled={adding || !(Number(form.authorizedAmount) > 0)} className="w-full h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-sm font-semibold">
              {adding ? 'Generating…' : 'Generate supplier QR'}
            </button>
          </form>
        </Card>

        {/* Suppliers */}
        {data.suppliers.length > 0 && (
          <Card>
            <div className="text-sm font-semibold mb-2">Suppliers</div>
            <div className="space-y-3">
              {data.suppliers.map((s) => (
                <div key={s.code} className={`flex items-center gap-3 rounded-lg border p-2.5 ${newQr === s.code ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-white/10 bg-white/[0.03]'}`}>
                  <div className="bg-white p-1.5 rounded-lg shrink-0"><QRCodeSVG value={rcUrl(s.code)} size={72} level="M" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{s.supplierName || 'Supplier'}</div>
                    <div className="text-[11px] text-white/50">{s.supplierPhone}</div>
                    <div className="text-xs mt-1">{money(s.redeemedAmount, data.currency)} / {money(s.authorizedAmount, data.currency)} · <span className={s.status === 'USED' ? 'text-emerald-400' : 'text-amber-300'}>{s.status}</span></div>
                    <div className="font-mono text-[11px] text-white/60 mt-0.5">{s.code}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/40 mt-2">Show a supplier’s QR to the cashier — it can only ever pay out that supplier’s allowed amount, drawn from your balance.</p>
          </Card>
        )}

        {/* Payout ledger */}
        {data.payouts.length > 0 && (
          <Card>
            <div className="text-sm font-semibold mb-2">Cash-outs</div>
            <div className="space-y-1">
              {data.payouts.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-white/70">
                  <span>{p.supplierQrId ? 'Supplier' : 'Main code'}</span>
                  <span className="tabular-nums">−{money(p.amount, data.currency)}</span>
                  <span className="text-white/40">{new Date(p.at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4">{children}</div>;
}
function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#0b0b16] grid place-items-center px-6 text-center">{children}</div>;
}
