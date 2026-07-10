import { useEffect, useState } from 'react';
import { publicApi } from './api';
import { CheckCircle2, Clock, Loader2, Package, Receipt as ReceiptIcon } from 'lucide-react';

/**
 * Public payout-receipt view — the landing page for a scanned receipt QR.
 * Shows the receipt details and whether it's been paid out to the supplier
 * yet. Read-only; the token in the URL is the capability.
 */
interface PublicReceipt {
  receiptNumber: string;
  customerName: string;
  supplierName: string;
  items: { name: string; qty: number; unitPrice?: number }[];
  itemCount: number;
  amountDue: number;
  shipping: number;
  serviceFee: number;
  total: number;
  currency: string;
  status: 'Pending' | 'Paid';
  createdAt: string;
  paidByName: string | null;
  paidAt: string | null;
}

const money = (n: number, c: string) => `${c} ${Number(n || 0).toLocaleString()}`;

export default function Receipt({ token }: { token: string }) {
  const [r, setR] = useState<PublicReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setR(await publicApi<PublicReceipt>(`/public/receipts/${encodeURIComponent(token)}`));
      } catch { setError('Receipt not found.'); }
      finally { setLoading(false); }
    })();
  }, [token]);

  if (loading) return <div className="min-h-[100dvh] grid place-items-center bg-slate-50"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (error || !r) return (
    <div className="min-h-[100dvh] grid place-items-center bg-slate-50 p-6">
      <div className="text-center text-slate-500"><ReceiptIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />{error || 'Not found'}</div>
    </div>
  );

  const paid = r.status === 'Paid';
  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900">
      <header className={`px-5 py-6 text-white ${paid ? 'bg-emerald-600' : 'bg-slate-900'}`}>
        <div className="flex items-center gap-2 text-white/70 text-xs font-semibold uppercase tracking-wide">
          <ReceiptIcon className="w-4 h-4" /> Payout Receipt
        </div>
        <h1 className="text-2xl font-extrabold mt-1">{r.receiptNumber}</h1>
        <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${paid ? 'bg-white/20' : 'bg-amber-400 text-amber-950'}`}>
          {paid ? <><CheckCircle2 className="w-4 h-4" /> Paid Successfully</> : <><Clock className="w-4 h-4" /> Awaiting Payout</>}
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-2 gap-y-3 text-sm">
          <Field label="Supplier" value={r.supplierName} />
          <Field label="Customer" value={r.customerName || '—'} />
          <Field label="Items" value={String(r.itemCount)} />
          <Field label="Created" value={new Date(r.createdAt).toLocaleDateString()} />
          {paid && <Field label="Paid by" value={r.paidByName || '—'} />}
          {paid && r.paidAt && <Field label="Paid on" value={new Date(r.paidAt).toLocaleDateString()} />}
        </div>

        {r.items.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide mb-2"><Package className="w-3.5 h-3.5" /> Products</div>
            <div className="divide-y divide-slate-100">
              {r.items.map((it, i) => (
                <div key={i} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-700">{it.name} <span className="text-slate-400">×{it.qty}</span></span>
                  {it.unitPrice != null && <span className="text-slate-500">{money(it.unitPrice * it.qty, r.currency)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-sm">
          <Row label="Amount Due" value={money(r.amountDue, r.currency)} />
          <Row label="Shipping" value={money(r.shipping, r.currency)} />
          <Row label="Service Fee" value={money(r.serviceFee, r.currency)} />
          <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
            <span className="font-extrabold text-slate-900">Total</span>
            <span className="text-xl font-extrabold text-slate-900">{money(r.total, r.currency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="font-semibold text-slate-800">{value}</div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}
