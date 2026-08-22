import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useQRScanner } from '@/hooks/useQRScanner';
import {
  Landmark, ScanLine, Loader2, CheckCircle2, Clock, Wallet, Package, X, Camera,
  Banknote, Building2, Smartphone, CreditCard, MoreHorizontal, Search, AlertCircle, ArrowLeft,
} from 'lucide-react';

/**
 * Lipa — the KobePay cashier on a phone. Scan a supplier-payout receipt QR
 * (or type its number), the receipt loads verbatim, pick a method and pay.
 * No manual amounts. Mobile-first sibling of the China Cashier desktop app;
 * reuses the same /kobepay/receipts/* endpoints.
 */
type Method = 'Cash' | 'Bank' | 'WeChat' | 'Alipay' | 'Other';
interface ReceiptItem { name: string; qty: number; unitPrice?: number }
interface PayoutReceipt {
  id: string; receiptNumber: string; publicToken: string;
  customerName: string; supplierName: string;
  items?: ReceiptItem[] | null; itemCount: number;
  amountDue: number | string; shipping: number | string; serviceFee: number | string; total: number | string;
  currency: string; status: 'Pending' | 'Paid';
  paymentMethod: Method | ''; paidByName: string; paidAt?: string | null;
}

const METHODS: { key: Method; label: string; Icon: typeof Banknote }[] = [
  { key: 'Cash', label: 'Cash', Icon: Banknote },
  { key: 'Bank', label: 'Bank', Icon: Building2 },
  { key: 'WeChat', label: 'WeChat', Icon: Smartphone },
  { key: 'Alipay', label: 'Alipay', Icon: CreditCard },
  { key: 'Other', label: 'Other', Icon: MoreHorizontal },
];
const sym = (c: string) => (c === 'CNY' ? '¥' : c === 'USD' ? '$' : c === 'TZS' ? 'TSh ' : `${c} `);
const money = (n: number | string, c = 'CNY') => `${sym(c)}${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function MobileLipa() {
  const [pin, setPin] = useState('');
  const [number, setNumber] = useState('');
  const [receipt, setReceipt] = useState<PayoutReceipt | null>(null);
  const [pending, setPending] = useState<PayoutReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [method, setMethod] = useState<Method | null>(null);
  const [txnId, setTxnId] = useState('');
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);

  const apiPin = useCallback(<T,>(path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (pin.trim()) headers.set('x-kobepay-pin', pin.trim());
    return api<T>(path, { ...init, headers });
  }, [pin]);

  const loadPending = useCallback(() => {
    apiPin<PayoutReceipt[]>('/kobepay/receipts?status=Pending')
      .then((r) => setPending(Array.isArray(r) ? r.slice(0, 20) : []))
      .catch(() => setPending([]));
  }, [apiPin]);
  useEffect(() => { loadPending(); }, [loadPending]);

  const lookup = useCallback(async (kind: 'number' | 'token', value: string) => {
    setError(null); setReceipt(null); setDone(false); setMethod(null); setTxnId('');
    setLoading(true);
    try {
      const path = kind === 'number'
        ? `/kobepay/receipts/by-number/${encodeURIComponent(value.trim().toUpperCase())}`
        : `/kobepay/receipts/by-token/${encodeURIComponent(value)}`;
      setReceipt(await apiPin<PayoutReceipt>(path));
    } catch (e) { setError((e as Error).message || 'Receipt not found.'); }
    finally { setLoading(false); }
  }, [apiPin]);

  const onScan = (raw: string) => {
    setScanning(false);
    const s = raw.trim();
    const m = s.match(/\/r\/([a-f0-9]{8,})/i);
    if (m) lookup('token', m[1]);
    else if (/^[a-f0-9]{16,}$/i.test(s)) lookup('token', s);
    else { setNumber(s.toUpperCase()); lookup('number', s); }
  };

  const pay = async () => {
    if (!receipt || !method) return;
    setPaying(true); setError(null);
    try {
      const updated = await apiPin<PayoutReceipt>(`/kobepay/receipts/${receipt.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ method, transactionId: txnId || undefined }),
      });
      setReceipt(updated); setDone(true); loadPending();
    } catch (e) { setError((e as Error).message || 'Payout failed.'); }
    finally { setPaying(false); }
  };

  /* ── Receipt detail / pay view ── */
  if (receipt) {
    const paid = receipt.status === 'Paid';
    return (
      <div className="px-4 py-4 space-y-4">
        <button onClick={() => setReceipt(null)} className="inline-flex items-center gap-1 text-sm text-slate-500 font-semibold"><ArrowLeft className="w-4 h-4" /> Back</button>

        <div className={`rounded-2xl overflow-hidden border ${paid ? 'border-emerald-200' : 'border-slate-200'}`}>
          <div className={`px-4 py-3 ${paid ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'}`}>
            <div className="text-[11px] uppercase tracking-wide opacity-70">Receipt</div>
            <div className="text-lg font-extrabold font-mono">{receipt.receiptNumber}</div>
          </div>
          <div className="p-4 space-y-3 bg-white">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <KV label="Supplier" value={receipt.supplierName} />
              <KV label="Customer" value={receipt.customerName || '—'} />
              <KV label="Items" value={String(receipt.itemCount)} />
            </div>
            {(receipt.items?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                {receipt.items!.map((it, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-slate-700"><Package className="w-3.5 h-3.5 inline mr-1 text-slate-400" />{it.name} <span className="text-slate-400">×{it.qty}</span></span>
                    {it.unitPrice != null && <span className="text-slate-500">{money(it.unitPrice * it.qty, receipt.currency)}</span>}
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1.5 text-sm">
              <Row label="Amount Due" value={money(receipt.amountDue, receipt.currency)} />
              <Row label="Shipping" value={money(receipt.shipping, receipt.currency)} />
              <Row label="Service Fee" value={money(receipt.serviceFee, receipt.currency)} />
              <div className="border-t border-slate-200 pt-1.5 flex items-center justify-between">
                <span className="font-extrabold">Total</span>
                <span className="text-xl font-extrabold text-emerald-600">{money(receipt.total, receipt.currency)}</span>
              </div>
            </div>

            {error && <div className="text-sm text-rose-600 inline-flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {error}</div>}

            {paid ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4 inline mr-1" /> Paid via <b>{receipt.paymentMethod}</b>
                {receipt.paidByName && <> by {receipt.paidByName}</>}
                {receipt.paidAt && <> · {new Date(receipt.paidAt).toLocaleString()}</>}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-5 gap-2">
                  {METHODS.map((m) => (
                    <button key={m.key} onClick={() => setMethod(m.key)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[11px] font-bold ${method === m.key ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-500'}`}>
                      <m.Icon className="w-4 h-4" /> {m.label}
                    </button>
                  ))}
                </div>
                <input value={txnId} onChange={(e) => setTxnId(e.target.value)} placeholder="Transaction ID (optional)" className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm" />
                <button onClick={pay} disabled={!method || paying}
                  className="w-full h-14 rounded-xl bg-emerald-600 text-white font-extrabold text-base inline-flex items-center justify-center gap-2 disabled:opacity-40 active:bg-emerald-700">
                  {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
                  Lipa Now · {money(receipt.total, receipt.currency)}
                </button>
              </>
            )}
          </div>
        </div>
        {scanning && <ScannerSheet onClose={() => setScanning(false)} onResult={onScan} />}
      </div>
    );
  }

  /* ── Home: scan + pending list ── */
  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 grid place-items-center"><Landmark className="w-5 h-5 text-white" /></div>
        <div className="flex-1">
          <h2 className="text-lg font-extrabold text-slate-900 leading-tight">Lipa · Supplier Payouts</h2>
          <p className="text-[11px] text-slate-500 leading-tight">Scan a receipt to pay the supplier</p>
        </div>
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="PIN" inputMode="numeric"
          className="w-16 h-9 px-2 rounded-lg border border-slate-200 text-sm text-center tracking-widest" title="Optional cashier PIN" />
      </div>

      <button onClick={() => setScanning(true)} className="w-full h-16 rounded-2xl bg-rose-600 text-white font-extrabold text-lg inline-flex items-center justify-center gap-2 active:bg-rose-700">
        <Camera className="w-6 h-6" /> Scan Receipt QR
      </button>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter' && number.trim()) lookup('number', number); }}
            placeholder="KP-2026-000254" className="w-full h-12 pl-9 pr-3 rounded-xl border border-slate-200 text-sm font-mono" />
        </div>
        <button onClick={() => number.trim() && lookup('number', number)} disabled={!number.trim() || loading}
          className="h-12 px-4 rounded-xl bg-slate-800 text-white text-sm font-bold disabled:opacity-40">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load'}
        </button>
      </div>

      {error && <div className="text-sm text-rose-600 inline-flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {error}</div>}

      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
          <Clock className="w-3.5 h-3.5" /> Awaiting payout ({pending.length})
        </div>
        {pending.length === 0 ? (
          <div className="text-sm text-slate-400 py-6 text-center">No pending receipts.</div>
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <button key={r.id} onClick={() => lookup('number', r.receiptNumber)}
                className="w-full text-left bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between active:bg-slate-50">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-slate-500">{r.receiptNumber}</div>
                  <div className="font-bold text-slate-800 truncate">{r.supplierName}</div>
                  <div className="text-[11px] text-slate-400">{r.itemCount} items{r.customerName ? ` · ${r.customerName}` : ''}</div>
                </div>
                <div className="text-right shrink-0 pl-2">
                  <div className="font-extrabold text-slate-900">{money(r.total, r.currency)}</div>
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600"><Clock className="w-2.5 h-2.5" /> Pending</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {scanning && <ScannerSheet onClose={() => setScanning(false)} onResult={onScan} />}
    </div>
  );
}

function ScannerSheet({ onClose, onResult }: { onClose: () => void; onResult: (raw: string) => void }) {
  const { videoRef, result, error, start, stop } = useQRScanner();
  const fired = useRef(false);
  useEffect(() => { start(); return () => stop(); }, [start, stop]);
  useEffect(() => { if (result && !fired.current) { fired.current = true; onResult(result.rawValue); } }, [result, onResult]);
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 h-14 text-white shrink-0">
        <span className="font-bold flex items-center gap-2"><ScanLine className="w-5 h-5" /> Scan receipt</span>
        <button onClick={onClose}><X className="w-6 h-6" /></button>
      </div>
      <div className="relative flex-1">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-x-10 top-1/2 -translate-y-1/2 aspect-square border-2 border-rose-400/80 rounded-2xl pointer-events-none" />
      </div>
      {error && <div className="p-3 text-xs text-rose-300 bg-black shrink-0">{error} — type the receipt number instead.</div>}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</div><div className="font-semibold text-slate-800">{value}</div></div>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="text-slate-500">{label}</span><span className="text-slate-700">{value}</span></div>;
}
