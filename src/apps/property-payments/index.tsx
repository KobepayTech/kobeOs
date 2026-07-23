import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeDollarSign,
  Banknote,
  Building2,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Landmark,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Smartphone,
  UserRound,
  XCircle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '@/lib/api';

type View = 'orders' | 'partners' | 'reconciliation';
type Channel = 'CASH' | 'BANK' | 'MOBILE_MONEY' | 'CARD';
type OrderStatus = 'CREATED' | 'ACTIVE' | 'PARTIALLY_PAID' | 'PAID' | 'EXPIRED' | 'CANCELLED';

interface Tenant { id: string; name: string; phone?: string; unitId?: string | null }
interface Unit { id: string; unitNumber: string; propertyId: string; rentAmount?: number; currency?: string }
interface Charge { id: string; tenantId: string; unitId: string; period: string; amount: number; amountPaid: number; status: string }
interface Partner { id: string; name: string; type: 'BANK' | 'AGENT'; partnerCode: string; commissionPct: number; status: string; phone: string; branch: string }
interface PaymentOrder {
  id: string; code: string; publicToken: string; tenantId: string; unitId: string; chargeId?: string | null;
  invoiceReference: string; expectedAmount: number; paidAmount: number; remainingAmount: number; currency: string;
  allowedVariance: number; partialAllowed: boolean; allowedChannels: Channel[]; assignedPartnerId?: string | null;
  status: OrderStatus; expiresAt: string; createdAt: string; tenantName: string; unitNumber: string; partnerName: string;
}
interface Redemption {
  id: string; orderId: string; partnerId: string; amount: number; currency: string; channel: Channel;
  reference: string; commissionAmount: number; status: 'CONFIRMED' | 'REVERSED'; receivedAt: string;
  reversedAt?: string | null; reversalReason?: string; partnerName: string;
}
interface Reconciliation {
  totals: { confirmedAmount: number; commissionAmount: number; reversedAmount: number; count: number };
  rows: Redemption[];
}

const input = 'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const label = 'mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-500';
const channels: Array<{ id: Channel; label: string; icon: typeof Banknote }> = [
  { id: 'CASH', label: 'Cash', icon: Banknote },
  { id: 'BANK', label: 'Bank', icon: Landmark },
  { id: 'MOBILE_MONEY', label: 'Mobile money', icon: Smartphone },
  { id: 'CARD', label: 'Card', icon: BadgeDollarSign },
];
const money = (value: number, currency = 'TZS') => `${currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const dateAfter = (days: number) => { const date = new Date(Date.now() + days * 86_400_000); return date.toISOString().slice(0, 10); };

export default function PropertyPaymentsApp() {
  const [view, setView] = useState<View>('orders');
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [selected, setSelected] = useState<PaymentOrder | null>(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [orderRows, partnerRows, tenantRows, unitRows, chargeRows, report] = await Promise.all([
        api<PaymentOrder[]>('/property/payment-orders'),
        api<Partner[]>('/property/payment-orders/partners/list'),
        api<Tenant[]>('/property/tenants'),
        api<Unit[]>('/property/units'),
        api<Charge[]>('/property/rent-charges'),
        api<Reconciliation>('/property/payment-orders/reconciliation/report'),
      ]);
      setOrders(Array.isArray(orderRows) ? orderRows : []);
      setPartners(Array.isArray(partnerRows) ? partnerRows : []);
      setTenants(Array.isArray(tenantRows) ? tenantRows : []);
      setUnits(Array.isArray(unitRows) ? unitRows : []);
      setCharges(Array.isArray(chargeRows) ? chargeRows : []);
      setReconciliation(report);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load property payments.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((row) => [row.code, row.tenantName, row.unitNumber, row.invoiceReference, row.partnerName, row.status].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [orders, query]);

  const createOrder = async (payload: Record<string, unknown>) => {
    setSaving(true); setError(null);
    try {
      const created = await api<PaymentOrder>('/property/payment-orders', { method: 'POST', body: JSON.stringify(payload) });
      setOrders((current) => [created, ...current]);
      setSelected(created);
      setShowOrderForm(false);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create payment order.'); }
    finally { setSaving(false); }
  };

  const createPartner = async (payload: Record<string, unknown>) => {
    setSaving(true); setError(null);
    try {
      await api('/property/payment-orders/partners', { method: 'POST', body: JSON.stringify(payload) });
      setShowPartnerForm(false);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create collection partner.'); }
    finally { setSaving(false); }
  };

  const cancel = async (order: PaymentOrder) => {
    const reason = window.prompt(`Reason for cancelling ${order.code}:`);
    if (!reason?.trim()) return;
    try {
      await api(`/property/payment-orders/${order.id}`, { method: 'DELETE', body: JSON.stringify({ reason }) });
      if (selected?.id === order.id) setSelected(null);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not cancel order.'); }
  };

  const reverse = async (row: Redemption) => {
    const reason = window.prompt('Reversal reason (this creates a negative ledger entry):');
    if (!reason?.trim()) return;
    try {
      await api(`/property/payment-orders/redemptions/${row.id}/reverse`, { method: 'POST', body: JSON.stringify({ reason }) });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not reverse collection.'); }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100 text-slate-900">
      <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><BadgeDollarSign className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1"><h1 className="font-extrabold">Property Payments</h1><p className="text-[11px] text-slate-500">Secure orders, banks, agents, collection receipts, and reconciliation</p></div>
          <button onClick={() => void load()} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" title="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={() => setShowPartnerForm(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-extrabold"><ShieldCheck className="h-3.5 w-3.5" />Add bank/agent</button>
          <button onClick={() => setShowOrderForm(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-extrabold text-white hover:bg-blue-500"><Plus className="h-3.5 w-3.5" />Create payment order</button>
        </div>
        <nav className="mt-3 flex gap-1 overflow-x-auto">{(['orders', 'partners', 'reconciliation'] as View[]).map((item) => <button key={item} onClick={() => setView(item)} className={`rounded-lg px-3 py-1.5 text-xs font-extrabold capitalize ${view === item ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{item}</button>)}</nav>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-5">
        {error && <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><AlertCircle className="h-4 w-4" />{error}</div>}
        {loading && orders.length === 0 ? <div className="grid h-full place-items-center"><Loader2 className="h-7 w-7 animate-spin text-slate-400" /></div> : null}

        {view === 'orders' && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-200 p-3"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code, tenant, unit, invoice or partner" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></div><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500">{filteredOrders.length}</span></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-3">Token</th><th className="p-3">Tenant / unit</th><th className="p-3">Invoice</th><th className="p-3 text-right">Expected</th><th className="p-3 text-right">Remaining</th><th className="p-3">Partner</th><th className="p-3">Status</th></tr></thead><tbody>{filteredOrders.map((row) => <tr key={row.id} onClick={() => setSelected(row)} className={`cursor-pointer border-t border-slate-100 hover:bg-blue-50/50 ${selected?.id === row.id ? 'bg-blue-50' : ''}`}><td className="p-3 font-mono font-extrabold text-blue-700">{row.code}</td><td className="p-3"><div className="font-bold">{row.tenantName}</div><div className="text-slate-400">Unit {row.unitNumber}</div></td><td className="p-3 text-slate-600">{row.invoiceReference}</td><td className="p-3 text-right font-semibold">{money(row.expectedAmount, row.currency)}</td><td className="p-3 text-right font-extrabold">{money(row.remainingAmount, row.currency)}</td><td className="p-3 text-slate-600">{row.partnerName}</td><td className="p-3"><OrderStatusPill status={row.status} /></td></tr>)}</tbody></table></div>
              {!filteredOrders.length && <Empty text="No payment orders yet." />}
            </section>
            <OrderDetail order={selected} onCancel={cancel} />
          </div>
        )}

        {view === 'partners' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4"><h2 className="font-extrabold">Registered collection partners</h2><p className="text-xs text-slate-500">Only active partners can log in to the bank/agent web app and redeem assigned or open payment orders.</p></div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{partners.map((partner) => <div key={partner.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start gap-3"><div className={`grid h-11 w-11 place-items-center rounded-xl text-white ${partner.type === 'BANK' ? 'bg-blue-700' : 'bg-emerald-600'}`}>{partner.type === 'BANK' ? <Building2 className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><div className="truncate font-extrabold">{partner.name}</div><div className="font-mono text-xs text-slate-500">{partner.partnerCode}</div></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700">{partner.status}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><Mini label="Type" value={partner.type} /><Mini label="Commission" value={`${partner.commissionPct}%`} /><Mini label="Branch" value={partner.branch || '—'} /><Mini label="Phone" value={partner.phone || '—'} /></div></div>)}</div>
            {!partners.length && <Empty text="No banks or agents registered." />}
          </section>
        )}

        {view === 'reconciliation' && reconciliation && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Kpi label="Confirmed collections" value={money(reconciliation.totals.confirmedAmount)} /><Kpi label="Partner commissions" value={money(reconciliation.totals.commissionAmount)} /><Kpi label="Reversed" value={money(reconciliation.totals.reversedAmount)} /><Kpi label="Receipts" value={String(reconciliation.totals.count)} /></div>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-xs"><thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-3">Date</th><th className="p-3">Partner</th><th className="p-3">Order</th><th className="p-3">Channel</th><th className="p-3">Reference</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">Commission</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead><tbody>{reconciliation.rows.map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="p-3">{new Date(row.receivedAt).toLocaleString()}</td><td className="p-3 font-bold">{row.partnerName}</td><td className="p-3 font-mono">{row.orderId.slice(0, 8)}</td><td className="p-3">{row.channel.replace('_', ' ')}</td><td className="p-3 text-slate-500">{row.reference || '—'}</td><td className="p-3 text-right font-extrabold">{money(row.amount, row.currency)}</td><td className="p-3 text-right">{money(row.commissionAmount, row.currency)}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${row.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{row.status}</span></td><td className="p-3">{row.status === 'CONFIRMED' && <button onClick={() => void reverse(row)} className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600"><RotateCcw className="h-3 w-3" />Reverse</button>}</td></tr>)}</tbody></table></div>{!reconciliation.rows.length && <Empty text="No collections to reconcile." />}</section>
          </div>
        )}
      </main>

      {showOrderForm && <OrderForm tenants={tenants} units={units} charges={charges} partners={partners} saving={saving} onClose={() => setShowOrderForm(false)} onSave={createOrder} />}
      {showPartnerForm && <PartnerForm saving={saving} onClose={() => setShowPartnerForm(false)} onSave={createPartner} />}
    </div>
  );
}

function OrderForm({ tenants, units, charges, partners, saving, onClose, onSave }: { tenants: Tenant[]; units: Unit[]; charges: Charge[]; partners: Partner[]; saving: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [tenantId, setTenantId] = useState('');
  const tenant = tenants.find((row) => row.id === tenantId);
  const unit = units.find((row) => row.id === tenant?.unitId);
  const tenantCharges = charges.filter((row) => row.tenantId === tenantId && !['paid', 'waived'].includes(row.status));
  const [chargeId, setChargeId] = useState('');
  const charge = tenantCharges.find((row) => row.id === chargeId);
  const [amount, setAmount] = useState('');
  const [expiresAt, setExpiresAt] = useState(dateAfter(45));
  const [partial, setPartial] = useState(true);
  const [variance, setVariance] = useState('0');
  const [assignedPartnerId, setAssignedPartnerId] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<Channel[]>(['CASH', 'BANK', 'MOBILE_MONEY']);
  useEffect(() => { if (charge) setAmount(String(Math.max(0, Number(charge.amount) - Number(charge.amountPaid)))); else if (unit) setAmount(String(Number(unit.rentAmount || 0))); }, [charge, unit]);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!tenant || !unit) return; void onSave({ tenantId: tenant.id, unitId: unit.id, chargeId: chargeId || undefined, invoiceReference: charge?.period || undefined, expectedAmount: Number(amount), currency: unit.currency || 'TZS', allowedVariance: Number(variance || 0), partialAllowed: partial, allowedChannels: selectedChannels, assignedPartnerId: assignedPartnerId || undefined, expiresAt: new Date(`${expiresAt}T23:59:59`).toISOString() }); };
  return <Modal title="Create property payment order" subtitle="The tenant receives one QR/human token linked to an unpaid obligation." onClose={onClose}><form onSubmit={submit} className="space-y-4"><label><span className={label}>Tenant</span><select required value={tenantId} onChange={(e) => { setTenantId(e.target.value); setChargeId(''); }} className={input}><option value="">Select tenant</option>{tenants.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>{tenant && !unit && <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">This tenant has no linked unit.</div>}<label><span className={label}>Unpaid rent charge (optional)</span><select value={chargeId} onChange={(e) => setChargeId(e.target.value)} className={input}><option value="">General rent payment</option>{tenantCharges.map((row) => <option key={row.id} value={row.id}>{row.period} · {money(Number(row.amount) - Number(row.amountPaid))}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label><span className={label}>Expected amount</span><input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={input} /></label><label><span className={label}>Expires</span><input required type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={input} /></label></div><div className="grid grid-cols-2 gap-3"><label><span className={label}>Allowed variance</span><input type="number" min="0" value={variance} onChange={(e) => setVariance(e.target.value)} className={input} /></label><label><span className={label}>Assigned partner</span><select value={assignedPartnerId} onChange={(e) => setAssignedPartnerId(e.target.value)} className={input}><option value="">Any authorised partner</option>{partners.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label></div><label className="flex items-center gap-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} />Allow partial payment</label><div><span className={label}>Allowed collection channels</span><div className="grid grid-cols-2 gap-2">{channels.map(({ id, label: text, icon: Icon }) => { const active = selectedChannels.includes(id); return <button type="button" key={id} onClick={() => setSelectedChannels((current) => active ? current.filter((item) => item !== id) : [...current, id])} className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold ${active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'}`}><Icon className="h-4 w-4" />{text}</button>; })}</div></div><button disabled={saving || !unit || selectedChannels.length === 0} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-extrabold text-white disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}Create secure token</button></form></Modal>;
}

function PartnerForm({ saving, onClose, onSave }: { saving: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); void onSave({ name: data.get('name'), type: data.get('type'), partnerCode: data.get('partnerCode'), pin: data.get('pin'), commissionPct: Number(data.get('commissionPct') || 0), phone: data.get('phone'), branch: data.get('branch') }); };
  return <Modal title="Register bank or agent" subtitle="The partner receives a code and PIN for the secure collection web app." onClose={onClose}><form onSubmit={submit} className="space-y-3"><label><span className={label}>Name</span><input name="name" required className={input} placeholder="Kobe Bank Kariakoo" /></label><div className="grid grid-cols-2 gap-3"><label><span className={label}>Type</span><select name="type" className={input}><option value="BANK">Bank</option><option value="AGENT">Agent</option></select></label><label><span className={label}>Partner code</span><input name="partnerCode" required className={`${input} font-mono uppercase`} placeholder="BANK-DAR-01" /></label></div><div className="grid grid-cols-2 gap-3"><label><span className={label}>Initial PIN</span><input name="pin" type="password" minLength={4} required className={input} /></label><label><span className={label}>Commission %</span><input name="commissionPct" type="number" min="0" max="100" step="0.01" defaultValue="0" className={input} /></label></div><div className="grid grid-cols-2 gap-3"><label><span className={label}>Phone</span><input name="phone" className={input} /></label><label><span className={label}>Branch / area</span><input name="branch" className={input} /></label></div><button disabled={saving} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 font-extrabold text-white disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Register partner</button></form></Modal>;
}

function OrderDetail({ order, onCancel }: { order: PaymentOrder | null; onCancel: (order: PaymentOrder) => Promise<void> }) {
  if (!order) return <aside className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-400">Select an order to see its QR and controls.</aside>;
  const payUrl = `${window.location.origin}/pay/${order.code}`;
  return <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Payment token</div><div className="font-mono text-2xl font-extrabold tracking-wider text-blue-700">{order.code}</div></div><OrderStatusPill status={order.status} /></div><div className="mx-auto my-4 w-fit rounded-2xl border border-slate-200 bg-white p-3"><QRCodeSVG value={payUrl} size={180} /></div><div className="grid grid-cols-2 gap-2"><Mini label="Tenant" value={order.tenantName} /><Mini label="Unit" value={order.unitNumber} /><Mini label="Expected" value={money(order.expectedAmount, order.currency)} /><Mini label="Remaining" value={money(order.remainingAmount, order.currency)} /><Mini label="Partner" value={order.partnerName} /><Mini label="Expires" value={new Date(order.expiresAt).toLocaleDateString()} /></div><div className="mt-3 flex gap-2"><button onClick={() => void navigator.clipboard.writeText(`${order.code}\n${payUrl}`)} className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-300 text-xs font-bold"><Copy className="h-3.5 w-3.5" />Copy</button><a href={payUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-300 text-xs font-bold"><ExternalLink className="h-3.5 w-3.5" />Bank/agent app</a></div>{!['PAID', 'CANCELLED', 'EXPIRED'].includes(order.status) && <button onClick={() => void onCancel(order)} className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1 rounded-xl bg-rose-50 text-xs font-bold text-rose-700"><XCircle className="h-3.5 w-3.5" />Cancel token</button>}</aside>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-4"><div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl"><div className="flex items-start gap-3 border-b border-slate-200 p-5"><div className="min-w-0 flex-1"><h2 className="font-extrabold">{title}</h2><p className="text-xs text-slate-500">{subtitle}</p></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100"><XCircle className="h-4 w-4" /></button></div><div className="p-5">{children}</div></div></div>; }
function OrderStatusPill({ status }: { status: OrderStatus }) { const cls = status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : status === 'ACTIVE' || status === 'PARTIALLY_PAID' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'; return <span className={`rounded-full px-2.5 py-1 text-[9px] font-extrabold ${cls}`}>{status.replaceAll('_', ' ')}</span>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-xl bg-slate-50 p-2.5"><div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</div><div className="truncate text-xs font-extrabold text-slate-800" title={value}>{value}</div></div>; }
function Kpi({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-xl font-extrabold">{value}</div></div>; }
function Empty({ text }: { text: string }) { return <div className="p-10 text-center text-sm text-slate-400">{text}</div>; }
