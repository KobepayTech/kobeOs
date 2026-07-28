import { useEffect, useState } from 'react';
import { publicApi } from './api';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  Receipt as ReceiptIcon,
  ShieldCheck,
} from 'lucide-react';

interface PublicReceipt {
  receiptNumber: string;
  verification: { verified: boolean; fingerprint: string };
  customerName: string;
  customerPhone: string;
  customerReference: string;
  supplierName: string;
  supplierNumber: string;
  supplierPhone: string;
  items: { name: string; qty: number; unitPrice?: number }[];
  itemCount: number;
  sourceAmount: number;
  sourceCurrency: string;
  exchangeRate: number;
  amountDue: number;
  shipping: number;
  serviceFee: number;
  amountToReceive: number;
  total: number;
  currency: string;
  status: 'Pending' | 'Paid' | 'Cancelled';
  createdAt: string;
  createdByName: string | null;
  paymentMethod: string | null;
  transactionId: string | null;
  paidByName: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
}

const money = (amount: number, currency: string) => `${currency} ${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function Receipt({ token }: { token: string }) {
  const [receipt, setReceipt] = useState<PublicReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    publicApi<PublicReceipt>(`/public/receipts/${encodeURIComponent(token)}`)
      .then((value) => { if (!cancelled) setReceipt(value); })
      .catch(() => { if (!cancelled) setError('Receipt not found.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  if (loading) return <div className="min-h-[100dvh] grid place-items-center bg-slate-50"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (error || !receipt) return (
    <div className="min-h-[100dvh] grid place-items-center bg-slate-50 p-6">
      <div className="text-center text-slate-500"><ReceiptIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />{error || 'Not found'}</div>
    </div>
  );

  const paid = receipt.status === 'Paid';
  const cancelled = receipt.status === 'Cancelled';
  const header = paid ? 'bg-emerald-600' : cancelled ? 'bg-rose-700' : 'bg-slate-900';

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900">
      <header className={`px-5 py-6 text-white ${header}`}>
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-white/70 text-xs font-semibold uppercase tracking-wide"><ReceiptIcon className="w-4 h-4" /> KobePay Supplier Receipt</div>
            <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${receipt.verification.verified ? 'bg-white/20 text-white' : 'bg-amber-300 text-amber-950'}`}>
              {receipt.verification.verified ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              {receipt.verification.verified ? 'Verified' : 'Legacy receipt'}
            </div>
          </div>
          <h1 className="text-2xl font-extrabold mt-1 font-mono">{receipt.receiptNumber}</h1>
          <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${paid ? 'bg-white/20' : cancelled ? 'bg-white/15' : 'bg-amber-400 text-amber-950'}`}>
            {paid ? <><CheckCircle2 className="w-4 h-4" /> Paid Successfully</> : cancelled ? <><AlertTriangle className="w-4 h-4" /> Cancelled</> : <><Clock className="w-4 h-4" /> Awaiting Supplier Payout</>}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        <section className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
          <Field label="Customer" value={receipt.customerName || '—'} />
          <Field label="Customer mobile" value={receipt.customerPhone || '—'} />
          <Field label="Customer number" value={receipt.customerReference || '—'} />
          <Field label="Supplier" value={receipt.supplierName || '—'} />
          <Field label="Supplier number" value={receipt.supplierNumber || '—'} />
          <Field label="Supplier mobile" value={receipt.supplierPhone || '—'} />
          <Field label="Created" value={new Date(receipt.createdAt).toLocaleString()} />
          <Field label="Created by" value={receipt.createdByName || '—'} />
        </section>

        {receipt.items.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide mb-2"><Package className="w-3.5 h-3.5" /> Products · {receipt.itemCount}</div>
            <div className="divide-y divide-slate-100">
              {receipt.items.map((item, index) => (
                <div key={`${item.name}-${index}`} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-700">{item.name} <span className="text-slate-400">×{item.qty}</span></span>
                  {item.unitPrice != null && <span className="text-slate-500">{money(item.unitPrice * item.qty, receipt.currency)}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-sm">
          <Row label="Customer paid" value={money(receipt.sourceAmount, receipt.sourceCurrency)} />
          {receipt.exchangeRate > 0 && <Row label="Exchange rate" value={`${receipt.exchangeRate.toLocaleString()} ${receipt.sourceCurrency} / ${receipt.currency}`} />}
          <Row label="Supplier goods" value={money(receipt.amountDue, receipt.currency)} />
          <Row label="Shipping" value={money(receipt.shipping, receipt.currency)} />
          <Row label="Service fee" value={money(receipt.serviceFee, receipt.currency)} />
          <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
            <span className="font-extrabold text-slate-900">Amount supplier receives</span>
            <span className="text-xl font-extrabold text-emerald-700">{money(receipt.amountToReceive, receipt.currency)}</span>
          </div>
        </section>

        {paid && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <div className="font-extrabold text-emerald-800">Supplier payout confirmed</div>
            <div className="mt-2 grid grid-cols-2 gap-3"><Field label="Method" value={receipt.paymentMethod || '—'} /><Field label="Cashier" value={receipt.paidByName || '—'} /><Field label="Transaction" value={receipt.transactionId || '—'} /><Field label="Paid at" value={receipt.paidAt ? new Date(receipt.paidAt).toLocaleString() : '—'} /></div>
          </section>
        )}

        {cancelled && (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><div className="font-extrabold">Receipt cancelled</div><div className="mt-1">{receipt.cancellationReason || 'No reason supplied.'}</div></section>
        )}

        <div className="text-center text-[10px] text-slate-400">
          Verification fingerprint: <span className="font-mono font-bold">{receipt.verification.fingerprint || 'LEGACY'}</span>
        </div>
      </main>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div><div className="font-semibold text-slate-800 break-words">{value}</div></div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-slate-500">{label}</span><span className="text-right text-slate-800 font-medium">{value}</span></div>;
}
