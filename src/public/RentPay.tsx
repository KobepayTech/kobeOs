import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Building2,
  Camera,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  LogOut,
  QrCode,
  Search,
  ShieldCheck,
  Smartphone,
  UserRound,
  X,
} from 'lucide-react';
import { publicApi } from './api';
import { useQRScanner } from '@/hooks/useQRScanner';

type Channel = 'CASH' | 'BANK' | 'MOBILE_MONEY' | 'CARD';
type OrderStatus = 'CREATED' | 'ACTIVE' | 'PARTIALLY_PAID' | 'PAID' | 'EXPIRED' | 'CANCELLED';

interface PartnerSession {
  sessionToken: string;
  expiresAt: string;
  partner: {
    id: string;
    name: string;
    type: 'BANK' | 'AGENT';
    partnerCode: string;
    branch: string;
    commissionPct: number;
  };
}

interface PaymentOrder {
  code: string;
  publicToken: string;
  status: OrderStatus;
  payer: { name: string; phone: string };
  property: { name: string; unit: string; address: string };
  invoiceReference: string;
  expectedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  currency: string;
  partialAllowed: boolean;
  allowedVariance: number;
  allowedChannels: Channel[];
  expiresAt: string;
  partner: { name: string; type: 'BANK' | 'AGENT'; branch: string };
}

interface CollectionReceipt {
  receiptId: string;
  orderCode: string;
  payerName: string;
  unitNumber: string;
  amount: number;
  currency: string;
  channel: Channel;
  reference: string;
  partnerName: string;
  partnerType: 'BANK' | 'AGENT';
  commissionAmount: number;
  receivedAt: string;
  orderStatus: OrderStatus;
  totalPaid: number;
  remainingAmount: number;
}

const SESSION_KEY = 'kobe-property-collection-session';
const money = (amount: number, currency = 'TZS') => `${currency} ${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const requestKey = () => globalThis.crypto?.randomUUID?.() || `collect-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function RentPay({ code: initialCode = '' }: { code?: string }) {
  const [session, setSession] = useState<PartnerSession | null>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PartnerSession;
      return new Date(parsed.expiresAt).getTime() > Date.now() ? parsed : null;
    } catch { return null; }
  });
  const [partnerCode, setPartnerCode] = useState('');
  const [pin, setPin] = useState('');
  const [orderCode, setOrderCode] = useState(initialCode.toUpperCase());
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState<Channel | null>(null);
  const [reference, setReference] = useState('');
  const [receipt, setReceipt] = useState<CollectionReceipt | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(requestKey());
  const [phase, setPhase] = useState<'login' | 'ready' | 'looking' | 'found' | 'collecting' | 'done'>(session ? 'ready' : 'login');
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const call = useCallback(<T,>(path: string, init: RequestInit = {}) => {
    if (!session) throw new Error('Collection partner login is required.');
    const headers = new Headers(init.headers);
    headers.set('x-property-agent-session', session.sessionToken);
    return publicApi<T>(path, { ...init, headers });
  }, [session]);

  const login = async () => {
    setError(null);
    if (!partnerCode.trim() || !pin.trim()) {
      setError('Enter the partner code and PIN.');
      return;
    }
    setPhase('looking');
    try {
      const value = await publicApi<PartnerSession>('/property/collection/login', {
        method: 'POST',
        body: JSON.stringify({ partnerCode: partnerCode.trim().toUpperCase(), pin }),
      });
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
      setSession(value);
      setPin('');
      setPhase('ready');
    } catch (reason) {
      setError(friendly(reason));
      setPhase('login');
    }
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setOrder(null);
    setReceipt(null);
    setPhase('login');
  };

  const lookup = useCallback(async (raw: string) => {
    const value = extractCode(raw);
    setError(null);
    if (!value) {
      setError('Enter or scan a valid payment code.');
      return;
    }
    setPhase('looking');
    try {
      const found = await call<PaymentOrder>(`/property/collection/orders/${encodeURIComponent(value)}`);
      setOrder(found);
      setOrderCode(found.code);
      setAmount(String(found.remainingAmount || ''));
      setChannel(found.allowedChannels[0] ?? null);
      setReference('');
      setReceipt(null);
      setIdempotencyKey(requestKey());
      setPhase('found');
    } catch (reason) {
      setOrder(null);
      setError(friendly(reason));
      setPhase('ready');
    }
  }, [call]);

  useEffect(() => {
    if (session && initialCode && phase === 'ready') void lookup(initialCode);
  }, [initialCode, lookup, phase, session]);

  const collect = async () => {
    if (!order || !channel) return;
    const received = Number(amount);
    setError(null);
    if (!Number.isFinite(received) || received <= 0) {
      setError('Enter the amount received.');
      return;
    }
    if (received > order.remainingAmount) {
      setError(`Overpayment is not allowed. Remaining amount is ${money(order.remainingAmount, order.currency)}.`);
      return;
    }
    setPhase('collecting');
    try {
      const result = await call<CollectionReceipt>(`/property/collection/orders/${encodeURIComponent(order.publicToken)}/redeem`, {
        method: 'POST',
        body: JSON.stringify({
          amountReceived: received,
          channel,
          reference: reference.trim() || undefined,
          idempotencyKey,
        }),
      });
      setReceipt(result);
      setPhase('done');
    } catch (reason) {
      setError(friendly(reason));
      setPhase('found');
    }
  };

  const reset = () => {
    setOrderCode('');
    setOrder(null);
    setAmount('');
    setChannel(null);
    setReference('');
    setReceipt(null);
    setIdempotencyKey(requestKey());
    setError(null);
    setPhase('ready');
  };

  const canCollect = useMemo(() => order && ['ACTIVE', 'PARTIALLY_PAID'].includes(order.status), [order]);

  if (!session) {
    return (
      <div className="min-h-[100dvh] bg-slate-100 p-4 grid place-items-center" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="bg-slate-950 px-6 py-7 text-white">
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Landmark className="h-6 w-6" /></div>
            <h1 className="text-xl font-extrabold">Property Collection Portal</h1>
            <p className="mt-1 text-sm text-slate-300">Secure login for registered banks and collection agents.</p>
          </div>
          <div className="space-y-4 p-6">
            <label className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Partner code</span><input value={partnerCode} onChange={(e) => setPartnerCode(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter') void login(); }} className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 font-mono tracking-wider outline-none focus:border-blue-500" placeholder="BANK-DAR-01" /></label>
            <label className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">PIN</span><input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void login(); }} className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 text-lg tracking-[0.3em] outline-none focus:border-blue-500" /></label>
            <button onClick={login} disabled={phase === 'looking'} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-extrabold text-white hover:bg-blue-500 disabled:opacity-50">{phase === 'looking' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Secure login</button>
            {error && <ErrorBox message={error} />}
            <p className="text-center text-[11px] text-slate-400">Every collection is linked to the logged-in partner, reconciled, and protected against duplicate submission.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-100 text-slate-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-xl text-white ${session.partner.type === 'BANK' ? 'bg-blue-700' : 'bg-emerald-600'}`}>{session.partner.type === 'BANK' ? <Building2 className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}</div>
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-extrabold">{session.partner.name}</div><div className="text-[11px] text-slate-500">{session.partner.type === 'BANK' ? 'Bank portal' : 'Agent portal'} · {session.partner.branch || session.partner.partnerCode}</div></div>
          <button onClick={logout} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50"><LogOut className="h-3.5 w-3.5" />Logout</button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4">
        {(phase === 'ready' || phase === 'looking') && (
          <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-center"><div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600"><QrCode className="h-6 w-6" /></div><h2 className="text-lg font-extrabold">Scan or enter payment token</h2><p className="text-xs text-slate-500">The verified payer, property, unit, and exact amount will load before collection.</p></div>
            <div className="flex gap-2"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={orderCode} onChange={(e) => setOrderCode(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter') void lookup(orderCode); }} className="h-12 w-full rounded-xl border border-slate-300 pl-9 pr-3 font-mono text-lg tracking-widest outline-none focus:border-blue-500" placeholder="ABCD2345XY" /></div><button onClick={() => void lookup(orderCode)} disabled={phase === 'looking'} className="grid h-12 w-12 place-items-center rounded-xl bg-blue-600 text-white disabled:opacity-50">{phase === 'looking' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button></div>
            <button onClick={() => setScannerOpen(true)} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 font-extrabold text-white hover:bg-slate-800"><Camera className="h-5 w-5" />Scan QR with camera</button>
            {error && <div className="mt-3"><ErrorBox message={error} /></div>}
          </div>
        )}

        {(phase === 'found' || phase === 'collecting') && order && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-950 px-5 py-4 text-white"><div><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Payment order</div><div className="font-mono text-xl font-extrabold tracking-wider">{order.code}</div></div><Status status={order.status} /></div>
              <div className="space-y-4 p-5">
                <button onClick={reset} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800"><ArrowLeft className="h-3.5 w-3.5" />Different token</button>
                <div className="grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-4 text-sm"><Field label="Payer" value={order.payer.name} /><Field label="Mobile" value={order.payer.phone || '—'} /><Field label="Property" value={order.property.name || '—'} /><Field label="Unit" value={order.property.unit || '—'} /><Field label="Invoice" value={order.invoiceReference || '—'} /><Field label="Expires" value={new Date(order.expiresAt).toLocaleString()} /></div>
                <div className="grid grid-cols-3 gap-2"><AmountCard label="Expected" value={money(order.expectedAmount, order.currency)} /><AmountCard label="Already paid" value={money(order.paidAmount, order.currency)} /><AmountCard label="Remaining" value={money(order.remainingAmount, order.currency)} strong /></div>
                {!canCollect && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">This order is {order.status.toLowerCase()} and cannot accept another payment.</div>}
              </div>
            </section>

            <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-extrabold">Confirm collection</h3>
              <p className="mt-1 text-xs text-slate-500">Allowed channels and payment rules come from the landlord’s order.</p>
              <label className="mt-4 block"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Amount received ({order.currency})</span><input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" disabled={!canCollect} className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 text-lg font-extrabold outline-none focus:border-blue-500 disabled:bg-slate-100" /></label>
              <div className="mt-3 grid grid-cols-2 gap-2">{order.allowedChannels.map((item) => { const Icon = channelIcon(item); return <button key={item} onClick={() => setChannel(item)} disabled={!canCollect} className={`flex h-12 items-center justify-center gap-1.5 rounded-xl border text-xs font-extrabold ${channel === item ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'} disabled:opacity-40`}><Icon className="h-4 w-4" />{channelLabel(item)}</button>; })}</div>
              <input value={reference} onChange={(e) => setReference(e.target.value)} disabled={!canCollect} placeholder="Transaction / deposit reference" className="mt-3 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100" />
              <button onClick={collect} disabled={!canCollect || !channel || phase === 'collecting'} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-extrabold text-white hover:bg-emerald-500 disabled:opacity-40">{phase === 'collecting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{phase === 'collecting' ? 'Recording safely…' : 'Confirm payment'}</button>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-400">Database locking and the request key prevent duplicate collections. Overpayment is blocked. Partial payment is accepted only when enabled.</p>
              {error && <div className="mt-3"><ErrorBox message={error} /></div>}
            </aside>
          </div>
        )}

        {phase === 'done' && receipt && (
          <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-lg">
            <div className="bg-emerald-600 px-6 py-7 text-center text-white"><div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-white/20"><CheckCircle2 className="h-9 w-9" /></div><h2 className="text-2xl font-extrabold">Payment recorded</h2><p className="mt-1 text-sm text-emerald-50">Receipt {receipt.receiptId.slice(0, 8).toUpperCase()}</p></div>
            <div className="space-y-4 p-5"><div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4"><Field label="Payer" value={receipt.payerName} /><Field label="Unit" value={receipt.unitNumber} /><Field label="Amount" value={money(receipt.amount, receipt.currency)} /><Field label="Channel" value={channelLabel(receipt.channel)} /><Field label="Partner" value={receipt.partnerName} /><Field label="Commission" value={money(receipt.commissionAmount, receipt.currency)} /><Field label="Reference" value={receipt.reference || '—'} /><Field label="Received" value={new Date(receipt.receivedAt).toLocaleString()} /></div><div className="grid grid-cols-2 gap-2"><AmountCard label="Total paid" value={money(receipt.totalPaid, receipt.currency)} /><AmountCard label="Balance remaining" value={money(receipt.remainingAmount, receipt.currency)} strong={receipt.remainingAmount > 0} /></div><button onClick={reset} className="h-12 w-full rounded-xl bg-slate-900 font-extrabold text-white hover:bg-slate-800">Collect another payment</button></div>
          </div>
        )}
      </main>

      {scannerOpen && <Scanner onClose={() => setScannerOpen(false)} onResult={(value) => { setScannerOpen(false); setOrderCode(extractCode(value)); void lookup(value); }} />}
    </div>
  );
}

function Scanner({ onClose, onResult }: { onClose: () => void; onResult: (value: string) => void }) {
  const { videoRef, result, scanning, error, start, stop } = useQRScanner();
  useEffect(() => { void start(); return stop; }, [start, stop]);
  useEffect(() => { if (result?.rawValue) onResult(result.rawValue); }, [onResult, result]);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"><div className="w-full max-w-md rounded-3xl bg-slate-950 p-4 text-white"><div className="mb-3 flex items-center justify-between"><div><h3 className="font-extrabold">Scan payment QR</h3><p className="text-xs text-slate-400">Point the camera at the tenant’s property payment token.</p></div><button onClick={() => { stop(); onClose(); }} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-800"><X className="h-4 w-4" /></button></div><div className="relative overflow-hidden rounded-2xl bg-black"><video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" /><div className="pointer-events-none absolute inset-[14%] rounded-2xl border-2 border-emerald-400" />{scanning && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs">Scanning…</div>}</div>{error && <div className="mt-3 text-xs text-rose-300">{error}</div>}</div></div>;
}

function extractCode(raw: string): string {
  const value = raw.trim();
  const tokenMatch = value.match(/(?:pay|collection)\/([A-Za-z0-9]{8,64})(?:[/?#]|$)/i);
  return (tokenMatch?.[1] || value).trim().toUpperCase();
}
function Field({ label, value }: { label: string; value: string }) { return <div><div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</div><div className="break-words text-sm font-bold text-slate-800">{value}</div></div>; }
function AmountCard({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <div className={`rounded-xl border p-3 text-center ${strong ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}><div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</div><div className={`mt-1 text-xs font-extrabold ${strong ? 'text-blue-700' : 'text-slate-900'}`}>{value}</div></div>; }
function ErrorBox({ message }: { message: string }) { return <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"><AlertCircle className="h-4 w-4 shrink-0" />{message}</div>; }
function Status({ status }: { status: OrderStatus }) { const cls = status === 'PAID' ? 'bg-emerald-400/20 text-emerald-200' : status === 'ACTIVE' || status === 'PARTIALLY_PAID' ? 'bg-amber-400/20 text-amber-200' : 'bg-rose-400/20 text-rose-200'; return <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold ${cls}`}>{status.replaceAll('_', ' ')}</span>; }
function channelIcon(channel: Channel) { return channel === 'CASH' ? Banknote : channel === 'BANK' ? Landmark : channel === 'MOBILE_MONEY' ? Smartphone : CreditCard; }
function channelLabel(channel: Channel) { return channel === 'MOBILE_MONEY' ? 'Mobile money' : channel.charAt(0) + channel.slice(1).toLowerCase(); }
function friendly(reason: unknown): string { const message = reason instanceof Error ? reason.message : String(reason); if (/401|unauthor/i.test(message)) return 'Session expired or the partner is not authorised. Log in again.'; if (/404|not found/i.test(message)) return 'Payment token not found.'; if (/expired/i.test(message)) return 'This payment token has expired.'; if (/overpayment/i.test(message)) return message; if (/partial/i.test(message)) return message; if (/429/.test(message)) return 'Too many attempts. Wait a moment and retry.'; return message || 'Something went wrong. Try again.'; }
