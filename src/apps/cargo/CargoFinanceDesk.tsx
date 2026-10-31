import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Check, Loader2, RefreshCw, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import KobePay from '../kobe-pay';

interface Account { id: string; name: string; phone: string; balance: string | number; currency: string | null; }
interface Shipment { id: string; shipmentId: string; origin: string; destination: string; status: string; }
interface Payment { id: string; shipmentId?: string; customerName: string; amount: string | number; currency: string; method: string; purpose: string; status: string; reference?: string; }
const money = (amount: string | number, currency: string) => `${currency} ${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 4 })}`;

export default function CargoFinanceDesk() {
  const [tab, setTab] = useState<'supplier' | 'freight' | 'history'>('supplier');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [shipmentId, setShipmentId] = useState('');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('SHIPPING');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<Payment | null>(null);
  const account = accounts.find(a => a.id === customerId);
  const shipment = shipments.find(s => s.id === shipmentId);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [a, s, p] = await Promise.all([
        api<Account[]>('/cargo/kobepay/accounts', { offlineFallback: false }),
        api<Shipment[]>('/cargo/shipments?limit=100', { offlineFallback: false }),
        api<Payment[]>('/cargo/payments?limit=100', { offlineFallback: false }),
      ]);
      setAccounts(Array.isArray(a) ? a : []); setShipments(Array.isArray(s) ? s : []); setPayments(Array.isArray(p) ? p : []);
    } catch (e) { setError(e instanceof Error && !e.message.includes('fetch') ? e.message : 'Freight finance records are unavailable. Check the connection and refresh.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (tab !== 'supplier') void load(); }, [tab, load]);
  const canReview = !!account?.currency && !!shipment && Number.isFinite(Number(amount)) && Number(amount) > 0 && Number(amount) <= Number(account.balance) && Number(amount) <= 1_000_000_000;
  const submit = async () => {
    if (!account?.currency || !canReview || posting) return;
    setPosting(true); setError('');
    // Keep the same request ID across uncertain responses and page reloads.
    const key = `cargo-freight:${customerId}:${shipmentId}:${purpose}:${Number(amount)}:${account.currency}`;
    try {
      let requestId = sessionStorage.getItem(key);
      if (!requestId) { requestId = crypto.randomUUID(); sessionStorage.setItem(key, requestId); }
      const payment = await api<Payment>('/cargo/kobepay/freight-payments', { method: 'POST', offlineFallback: false,
        body: JSON.stringify({ customerId, shipmentId, amount: Number(amount), currency: account.currency, purpose, requestId }),
      });
      sessionStorage.removeItem(key); setSaved(payment); setReview(false); setAmount(''); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Payment could not be confirmed. Retry to check the same request.'); }
    finally { setPosting(false); }
  };
  return <section className="ad-finance-desk">
    <div className="ad-page-heading"><div><div className="ad-overline">CARGO FINANCE / KOBEPAY</div><h1>Money in motion.</h1><p>Supplier transfer requests, funded freight payments and shipment receipts.</p></div><Wallet size={34} strokeWidth={1} /></div>
    <div className="ad-board-nav"><div className="ad-purpose-tabs">{[['supplier', 'Suppliers & transfers'], ['freight', 'Pay freight'], ['history', 'Cargo receipts']].map(([key, title]) => <button type="button" className="cursor-interaction" key={key} aria-pressed={tab === key} onClick={() => { if (!posting) { setTab(key as typeof tab); setReview(false); } }} disabled={posting}>{title}</button>)}</div>{tab !== 'supplier' && <button className="ad-text-button cursor-interaction" type="button" disabled={loading || posting} onClick={() => void load()}><RefreshCw size={14} />Refresh</button>}</div>
    {tab === 'supplier' && <><p className="ad-desk-hint">KobePay's existing customer, supplier and payout workflow. A payout request stays pending until execution is confirmed.</p><div className="ad-kobepay-embedded"><KobePay embedded /></div></>}
    {error && <div className="ad-load-state" role="alert">{error}</div>}
    {saved && <div className="ad-payment-success" role="status"><Check size={18} /><div><b>Freight payment confirmed</b><p>{money(saved.amount, saved.currency)} · receipt {saved.id}</p></div><a className="ad-text-button" href={`/print/cargo-receipt?id=${encodeURIComponent(saved.id)}`} target="_blank" rel="noreferrer">Print receipt <ArrowUpRight size={15} /></a></div>}
    {loading && tab !== 'supplier' && <div className="ad-empty" role="status"><Loader2 className="animate-spin" size={22} />Loading financial records…</div>}
    {tab === 'freight' && !loading && <div className="ad-freight-layout"><div className="ad-freight-form"><div className="ad-overline">FROM FUNDED KOBEPAY BALANCE</div><h2>Cover the next leg.</h2><label>Customer account<select value={customerId} disabled={posting || review} onChange={e => { setCustomerId(e.target.value); setSaved(null); }}><option value="">Select a KobePay account</option>{accounts.map(a => <option key={a.id} value={a.id} disabled={!a.currency}>{a.name} · {a.currency ? money(a.balance, a.currency) : 'Funding review required'}</option>)}</select></label><label>Cargo shipment<select value={shipmentId} disabled={posting || review} onChange={e => { setShipmentId(e.target.value); setSaved(null); }}><option value="">Select shipment</option>{shipments.filter(s => s.status !== 'CANCELLED').map(s => <option key={s.id} value={s.id}>{s.shipmentId} · {s.origin} → {s.destination}</option>)}</select></label><div className="ad-form-pair"><label>Purpose<select value={purpose} disabled={posting || review} onChange={e => setPurpose(e.target.value)}><option value="SHIPPING">Freight charge</option><option value="CUSTOMS">Customs charge</option></select></label><label>Amount {account?.currency && `(${account.currency})`}<input aria-label="Freight payment amount" type="number" min="0.0001" step="0.0001" max={account ? Number(account.balance) : undefined} value={amount} disabled={posting || review} onChange={e => { setAmount(e.target.value); setSaved(null); }} placeholder="0.00" /></label></div>
      {review ? <div className="ad-payment-review"><span className="ad-overline">CONFIRM CUSTOMER AUTHORIZATION</span><h3>{money(amount, account?.currency ?? '')}</h3><p>Debit {account?.name} and apply to {shipment?.shipmentId}. This does not pay a supplier or clear customs.</p><div className="ad-form-actions"><button className="ad-primary cursor-interaction" type="button" disabled={posting} onClick={() => void submit()}>{posting ? 'Confirming…' : 'Confirm freight payment'}</button><button className="ad-text-button cursor-interaction" type="button" disabled={posting} onClick={() => setReview(false)}>Back</button></div></div> : <button className="ad-primary cursor-interaction" type="button" disabled={!canReview || posting || !!error} onClick={() => setReview(true)}>Review payment <ArrowUpRight size={15} /></button>}
      {!accounts.length && !error && <p className="ad-desk-hint">Add a customer and confirm funding in Suppliers & transfers first.</p>}</div><aside className="ad-funding-note"><div className="ad-overline">CLEAR ACCOUNTS. CLEAR PURPOSES.</div><h2>Funded.<br />Linked.<br />Recorded.</h2><p>The server checks the account, shipment, funding currency and available balance before recording a receipt.</p><p>Mixed-currency accounts need reconciliation first. This flow does not invent exchange rates or confirm an external transfer.</p></aside></div>}
    {tab === 'history' && !loading && <div className="ad-record-table-wrap"><table className="ad-record-table"><thead><tr><th>Customer / reference</th><th>Purpose</th><th>Amount</th><th>Status</th></tr></thead><tbody>{payments.map(p => <tr key={p.id}><td><b>{p.customerName}</b><small>{p.reference || p.id}</small></td><td>{p.purpose}<small>{p.method}</small></td><td>{money(p.amount, p.currency)}</td><td>{p.status}</td></tr>)}</tbody></table>{!payments.length && !error && <div className="ad-empty">No cargo payment receipts have been recorded.</div>}</div>}
  </section>;
}
