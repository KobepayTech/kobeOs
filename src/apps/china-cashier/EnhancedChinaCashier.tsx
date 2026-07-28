import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Building2,
  Camera,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Landmark,
  Loader2,
  Phone,
  Receipt,
  ScanLine,
  Search,
  ShieldCheck,
  Smartphone,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@/lib/api';
import { useQRScanner } from '@/hooks/useQRScanner';

type Method = 'Cash' | 'Bank' | 'WeChat' | 'Alipay' | 'Other';
type ReceiptStatus = 'Pending' | 'Paid' | 'Cancelled';

interface PayoutReceipt {
  id: string;
  receiptNumber: string;
  publicToken: string;
  customerName: string;
  customerPhone: string;
  customerReference: string;
  supplierNumber: string;
  supplierName: string;
  supplierPhone: string;
  itemCount: number;
  sourceAmount: number | string;
  sourceCurrency: string;
  exchangeRate: number | string;
  amountDue: number | string;
  shipping: number | string;
  serviceFee: number | string;
  total: number | string;
  currency: string;
  status: ReceiptStatus;
  paymentMethod: Method | '';
  transactionId: string;
  paidByName: string;
  paidAt?: string | null;
}

interface CustomerLookup {
  customer: { name: string; phone: string; reference: string };
  totals: { pendingCount: number; pendingAmount: number; paidCount: number; paidAmount: number; currency: string };
  receipts: PayoutReceipt[];
}

interface Dashboard {
  currency: string;
  cards: {
    pendingAmount: number;
    pendingCount: number;
    paidToday: number;
    paidTodayCount: number;
    totalPaid: number;
    totalPaidCount: number;
  };
}

const methods: Array<{ key: Method; label: string; icon: typeof Banknote }> = [
  { key: 'Cash', label: 'Cash', icon: Banknote },
  { key: 'Bank', label: 'Bank', icon: Building2 },
  { key: 'WeChat', label: 'WeChat', icon: Smartphone },
  { key: 'Alipay', label: 'Alipay', icon: CreditCard },
  { key: 'Other', label: 'Other', icon: Wallet },
];

const money = (value: number | string, currency: string) => `${currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const newKey = () => globalThis.crypto?.randomUUID?.() || `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function EnhancedChinaCashier() {
  const [pin, setPin] = useState('');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [phone, setPhone] = useState('');
  const [receiptInput, setReceiptInput] = useState('');
  const [customer, setCustomer] = useState<CustomerLookup | null>(null);
  const [receipt, setReceipt] = useState<PayoutReceipt | null>(null);
  const [method, setMethod] = useState<Method | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(newKey());

  const apiPin = useCallback(<T,>(path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (pin.trim()) headers.set('x-kobepay-pin', pin.trim());
    return api<T>(path, { ...init, headers });
  }, [pin]);

  const loadDashboard = useCallback(async () => {
    try { setDashboard(await apiPin<Dashboard>('/kobepay/receipts/dashboard')); }
    catch { /* dashboard remains optional */ }
  }, [apiPin]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const resetPayment = () => {
    setMethod(null);
    setTransactionId('');
    setNotes('');
    setIdempotencyKey(newKey());
  };

  const selectReceipt = (value: PayoutReceipt) => {
    setReceipt(value);
    setReceiptInput(value.receiptNumber);
    resetPayment();
    setError(null);
  };

  const lookupCustomer = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    setError(null);
    setReceipt(null);
    try {
      const result = await apiPin<CustomerLookup>(`/kobepay/receipts/by-customer/${encodeURIComponent(phone.trim())}`);
      setCustomer(result);
      const pending = result.receipts.find((row) => row.status === 'Pending');
      if (pending) selectReceipt(pending);
    } catch (reason) {
      setCustomer(null);
      setError(reason instanceof Error ? reason.message : 'Customer not found.');
    } finally {
      setLoading(false);
    }
  };

  const lookupReceipt = async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setLoading(true);
    setError(null);
    try {
      const tokenMatch = value.match(/\/r\/([a-f0-9]{16,})/i);
      const token = tokenMatch?.[1] || (/^[a-f0-9]{24,}$/i.test(value) ? value : null);
      const path = token
        ? `/kobepay/receipts/by-token/${encodeURIComponent(token)}`
        : `/kobepay/receipts/by-number/${encodeURIComponent(value.toUpperCase())}`;
      selectReceipt(await apiPin<PayoutReceipt>(path));
    } catch (reason) {
      setReceipt(null);
      setError(reason instanceof Error ? reason.message : 'Receipt not found.');
    } finally {
      setLoading(false);
    }
  };

  const pay = async () => {
    if (!receipt || !method || receipt.status !== 'Pending') return;
    setPaying(true);
    setError(null);
    try {
      const updated = await apiPin<PayoutReceipt>(`/kobepay/receipts/${receipt.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          method,
          transactionId: transactionId.trim() || undefined,
          notes: notes.trim() || undefined,
          idempotencyKey,
        }),
      });
      setReceipt(updated);
      if (customer) {
        setCustomer({
          ...customer,
          receipts: customer.receipts.map((row) => row.id === updated.id ? updated : row),
        });
      }
      await loadDashboard();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Payout failed.');
    } finally {
      setPaying(false);
    }
  };

  const pendingCustomerReceipts = useMemo(
    () => customer?.receipts.filter((row) => row.status === 'Pending') ?? [],
    [customer],
  );

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-red-700"><Landmark className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1"><h1 className="font-extrabold">China Cashier PWA</h1><p className="text-[11px] text-slate-400">Customer lookup · receipt QR · supplier payout</p></div>
          <label className="hidden sm:block"><span className="sr-only">Cashier PIN</span><input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Cashier PIN" inputMode="numeric" className="h-9 w-28 rounded-lg border border-slate-700 bg-slate-900 px-2 text-center text-xs tracking-widest" /></label>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 p-4">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Pending payout" value={money(dashboard?.cards.pendingAmount ?? 0, dashboard?.currency ?? 'CNY')} detail={`${dashboard?.cards.pendingCount ?? 0} receipts`} />
          <Stat label="Paid today" value={money(dashboard?.cards.paidToday ?? 0, dashboard?.currency ?? 'CNY')} detail={`${dashboard?.cards.paidTodayCount ?? 0} receipts`} />
          <Stat label="Total paid" value={money(dashboard?.cards.totalPaid ?? 0, dashboard?.currency ?? 'CNY')} detail={`${dashboard?.cards.totalPaidCount ?? 0} payouts`} />
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4"><div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" />Restricted role</div><div className="mt-2 text-sm font-extrabold">China cashier only</div><div className="mt-1 text-[11px] text-slate-400">TZ cashier payout permission is blocked by the backend.</div></div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="mb-3 flex items-center gap-2"><User className="h-4 w-4 text-blue-400" /><h2 className="text-sm font-extrabold">1. Find customer by mobile number</h2></div>
            <div className="flex gap-2"><div className="relative min-w-0 flex-1"><Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void lookupCustomer(); }} placeholder="+255 7XX XXX XXX" inputMode="tel" className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm" /></div><button onClick={lookupCustomer} disabled={loading || !phone.trim()} className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button></div>
            {customer && (
              <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
                <div className="font-extrabold">{customer.customer.name}</div><div className="text-xs text-slate-400">{customer.customer.phone} · {customer.customer.reference || 'No customer number'}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><MiniStat label="Pending" value={`${customer.totals.pendingCount} · ${money(customer.totals.pendingAmount, customer.totals.currency)}`} /><MiniStat label="Paid" value={`${customer.totals.paidCount} · ${money(customer.totals.paidAmount, customer.totals.currency)}`} /></div>
                {pendingCustomerReceipts.length > 0 && <div className="mt-3 space-y-1.5">{pendingCustomerReceipts.map((row) => <button key={row.id} onClick={() => selectReceipt(row)} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs ${receipt?.id === row.id ? 'border-rose-500 bg-rose-500/10' : 'border-slate-700 bg-slate-950/50'}`}><span><b className="font-mono">{row.receiptNumber}</b><span className="ml-2 text-slate-400">{row.supplierName}</span></span><b>{money(row.total, row.currency)}</b></button>)}</div>}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="mb-3 flex items-center gap-2"><ScanLine className="h-4 w-4 text-rose-400" /><h2 className="text-sm font-extrabold">2. Scan supplier receipt QR</h2></div>
            <div className="flex gap-2"><div className="relative min-w-0 flex-1"><Receipt className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={receiptInput} onChange={(e) => setReceiptInput(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter') void lookupReceipt(receiptInput); }} placeholder="KP-2026-000254 or QR token" className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 font-mono text-sm" /></div><button onClick={() => void lookupReceipt(receiptInput)} disabled={loading || !receiptInput.trim()} className="h-11 rounded-xl bg-slate-700 px-4 text-xs font-bold hover:bg-slate-600 disabled:opacity-40">Load</button></div>
            <button onClick={() => setScannerOpen(true)} className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-extrabold hover:bg-rose-500"><Camera className="h-4 w-4" />Open camera scanner</button>
            <p className="mt-2 text-[11px] text-slate-500">Scanning automatically loads the customer, supplier, amount, currency, and payout instructions. The cashier never types the payout amount.</p>
          </div>
        </section>

        {error && <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"><AlertTriangle className="h-4 w-4" />{error}</div>}

        {receipt && (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3"><div><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Loaded supplier receipt</div><div className="font-mono text-xl font-extrabold">{receipt.receiptNumber}</div></div><Status status={receipt.status} /></div>
              <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto]">
                <div className="grid grid-cols-2 gap-3 text-sm"><KeyValue label="Customer" value={receipt.customerName || '—'} /><KeyValue label="Customer number" value={receipt.customerReference || '—'} /><KeyValue label="Customer mobile" value={receipt.customerPhone || '—'} /><KeyValue label="Supplier" value={receipt.supplierName || '—'} /><KeyValue label="Supplier number" value={receipt.supplierNumber || '—'} /><KeyValue label="Supplier mobile" value={receipt.supplierPhone || '—'} /><KeyValue label="Items" value={String(receipt.itemCount)} /><KeyValue label="Exchange rate" value={Number(receipt.exchangeRate) > 0 ? `${Number(receipt.exchangeRate).toLocaleString()} ${receipt.sourceCurrency}/${receipt.currency}` : '—'} /></div>
                <div className="h-fit rounded-xl bg-white p-2"><QRCodeSVG value={`${window.location.origin}/r/${receipt.publicToken}`} size={108} /></div>
              </div>
              <div className="m-4 mt-0 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm"><AmountRow label="Customer paid" value={money(receipt.sourceAmount, receipt.sourceCurrency)} /><AmountRow label="Supplier goods" value={money(receipt.amountDue, receipt.currency)} /><AmountRow label="Shipping" value={money(receipt.shipping, receipt.currency)} /><AmountRow label="Service fee" value={money(receipt.serviceFee, receipt.currency)} /><div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-3"><b>Supplier receives</b><b className="text-2xl text-emerald-400">{money(receipt.total, receipt.currency)}</b></div></div>
              <a href={`${window.location.origin}/r/${receipt.publicToken}`} target="_blank" rel="noreferrer" className="mx-4 mb-4 inline-flex items-center gap-1 text-xs font-bold text-blue-400 hover:underline">Open verified online receipt <ExternalLink className="h-3 w-3" /></a>
            </div>

            <aside className="h-fit rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <h3 className="text-sm font-extrabold">3. Initiate supplier payout</h3>
              {receipt.status === 'Pending' ? (
                <>
                  <div className="mt-3 grid grid-cols-5 gap-2">{methods.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => setMethod(key)} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl border py-2 text-[10px] font-bold ${method === key ? 'border-rose-500 bg-rose-500/15 text-white' : 'border-slate-700 text-slate-400'}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
                  <input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="Bank / WeChat / Alipay transaction reference" className="mt-3 h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm" />
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Payout note (optional)" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm" />
                  <button onClick={pay} disabled={!method || paying} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-extrabold hover:bg-emerald-500 disabled:opacity-40">{paying ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wallet className="h-5 w-5" />}{paying ? 'Processing safely…' : `Pay ${money(receipt.total, receipt.currency)}`}</button>
                  <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Protected by cashier permissions, row locking, and an idempotency key. Double taps cannot create a second payout.</p>
                </>
              ) : receipt.status === 'Paid' ? (
                <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300"><CheckCircle2 className="mb-2 h-6 w-6" /><div className="font-extrabold">Supplier paid</div><div className="mt-1 text-xs">{receipt.paymentMethod}{receipt.transactionId ? ` · ${receipt.transactionId}` : ''}</div><div className="mt-1 text-xs">Cashier: {receipt.paidByName || 'owner'}</div></div>
              ) : (
                <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300"><AlertTriangle className="mb-2 h-6 w-6" /><div className="font-extrabold">Cancelled receipt</div><div className="text-xs">Payout is blocked.</div></div>
              )}
            </aside>
          </section>
        )}
      </main>

      {scannerOpen && <Scanner onClose={() => setScannerOpen(false)} onResult={(value) => { setScannerOpen(false); setReceiptInput(value); void lookupReceipt(value); }} />}
    </div>
  );
}

function Scanner({ onClose, onResult }: { onClose: () => void; onResult: (value: string) => void }) {
  const { videoRef, result, scanning, error, start, stop } = useQRScanner();
  useEffect(() => { void start(); return stop; }, [start, stop]);
  useEffect(() => { if (result?.rawValue) onResult(result.rawValue); }, [result, onResult]);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"><div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4"><div className="mb-3 flex items-center justify-between"><div><div className="font-extrabold">Scan supplier receipt</div><div className="text-xs text-slate-400">Point the camera at the KobePay QR.</div></div><button onClick={() => { stop(); onClose(); }} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-800"><X className="h-4 w-4" /></button></div><div className="relative overflow-hidden rounded-xl bg-black"><video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" /><div className="pointer-events-none absolute inset-[15%] rounded-xl border-2 border-rose-400" />{scanning && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs">Scanning…</div>}</div>{error && <div className="mt-3 text-xs text-rose-300">{error}</div>}</div></div>;
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-lg font-extrabold">{value}</div><div className="text-[11px] text-slate-500">{detail}</div></div>; }
function MiniStat({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-950/60 p-2"><div className="text-[9px] font-bold uppercase text-slate-500">{label}</div><div className="mt-0.5 font-bold">{value}</div></div>; }
function KeyValue({ label, value }: { label: string; value: string }) { return <div><div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</div><div className="break-words font-semibold text-slate-200">{value}</div></div>; }
function AmountRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between py-1 text-slate-400"><span>{label}</span><span className="font-semibold text-slate-200">{value}</span></div>; }
function Status({ status }: { status: ReceiptStatus }) { const style = status === 'Paid' ? 'bg-emerald-500/15 text-emerald-300' : status === 'Cancelled' ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-500/15 text-amber-300'; return <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${style}`}>{status}</span>; }
