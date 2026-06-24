import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2, X, Check, ChevronDown, ArrowRight, ArrowLeft,
  Search, Send, ScanLine, Download, Calendar, Plus,
} from 'lucide-react';
import { SupplierPaymentReconcileDialog } from './SupplierPaymentReconcileDialog';

/**
 * Unified KobePay transact wizard. Same shell, two intents:
 *   intent='send'    → POST /kobepay/payouts   (Send Money)
 *   intent='receive' → POST /kobepay/deposits  (Record Deposit)
 *
 * Step 2 of the receive flow exposes the OCR receipt scanner so we don't
 * carry two parallel surfaces for "record incoming money" anymore.
 *
 * FX: live from /kobepay/rates/active + /kobepay/rates/derived. Falls
 * back to an in-component USD-relative table when no rate rows exist
 * yet (fresh install), so the wizard never blocks on empty data.
 *
 * Layout follows the green / lime "Send Money" mockups: left-rail stepper,
 * progress bar in the header, You-send + Recipient-get cards visible
 * together on the Amount step, and an Anywhere/Selected-contact toggle.
 */

export interface TransactWizardProps {
  open: boolean;
  onClose: () => void;
  onSent?: () => void;
  contacts: ContactOption[];
  availableBalance: number;
  intent?: 'send' | 'receive';
  initialContact?: ContactOption | null;
}

export interface ContactOption {
  id: string;
  kind: 'supplier' | 'customer';
  name: string;
  subtitle: string;
  avatarHue?: string;
}

interface FiatCurrency { code: string; label: string; flag: string }

const CURRENCIES: FiatCurrency[] = [
  { code: 'USD', label: 'US Dollar',         flag: '🇺🇸' },
  { code: 'TZS', label: 'Tanzania Shilling', flag: '🇹🇿' },
  { code: 'KES', label: 'Kenya Shilling',    flag: '🇰🇪' },
  { code: 'UGX', label: 'Uganda Shilling',   flag: '🇺🇬' },
  { code: 'NGN', label: 'Nigerian Naira',    flag: '🇳🇬' },
  { code: 'EUR', label: 'Euro',              flag: '🇪🇺' },
  { code: 'GBP', label: 'British Pound',     flag: '🇬🇧' },
  { code: 'CNY', label: 'Chinese Yuan',      flag: '🇨🇳' },
];

const FX_FALLBACK: Record<string, number> = {
  USD: 1, TZS: 2630, KES: 130, UGX: 3700, NGN: 1451, EUR: 0.92, GBP: 0.79, CNY: 7.2,
};

const METHODS = [
  { id: 'M-Pesa',         label: 'M-Pesa',         hint: 'Mobile money' },
  { id: 'Bank Transfer',  label: 'Bank Transfer',  hint: '1-2 business days' },
  { id: 'Cash',           label: 'Cash',           hint: 'Counter pickup' },
  { id: 'WeChat Pay',     label: 'WeChat Pay',     hint: 'Cross-border' },
  { id: 'Alipay',         label: 'Alipay',         hint: 'Cross-border' },
  { id: 'Wallet',         label: 'Wallet',         hint: 'KobePay internal' },
];

const SEND_RAILS = [
  { id: 'checking-6346', label: 'Checking (**** 6346)' },
  { id: 'savings-9821',  label: 'Savings (**** 9821)' },
  { id: 'wallet-kobe',   label: 'KobePay Wallet' },
];

type Step = 1 | 2 | 3 | 4;
type Recipient = 'selected' | 'anywhere';

interface RateRow { fromCurrency: string; toCurrency: string; salesRate: number | string }

function lookupRate(rates: RateRow[], from: string, to: string): number | null {
  if (from === to) return 1;
  const row = rates.find((r) => r.fromCurrency === from && r.toCurrency === to);
  if (row) return Number(row.salesRate);
  const inv = rates.find((r) => r.fromCurrency === to && r.toCurrency === from);
  if (inv && Number(inv.salesRate) > 0) return 1 / Number(inv.salesRate);
  return null;
}

export function SendMoneyWizard({
  open, onClose, onSent, contacts, availableBalance,
  intent = 'send', initialContact = null,
}: TransactWizardProps) {
  const isReceive = intent === 'receive';

  const [step, setStep] = useState<Step>(1);
  const [search, setSearch] = useState('');
  const [contact, setContact] = useState<ContactOption | null>(initialContact);
  const [recipientMode, setRecipientMode] = useState<Recipient>(initialContact ? 'selected' : 'selected');
  const [freeRecipient, setFreeRecipient] = useState('');
  const [sendAmount, setSendAmount] = useState('200');
  const [sendCurrency, setSendCurrency] = useState('USD');
  const [recvCurrency, setRecvCurrency] = useState(isReceive ? 'USD' : 'NGN');
  const [sendRail, setSendRail] = useState(SEND_RAILS[0].id);
  const [method, setMethod] = useState('Bank Transfer');
  const [schedule, setSchedule] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Reconciliation handoff — when the just-sent payout matched an ERP
  // supplier by phone, we pop SupplierPaymentReconcileDialog so the
  // operator can mark this as a PO payment, new-goods delivery, or
  // general supplier payment. Cleared once they save or skip.
  const [reconcile, setReconcile] = useState<{
    payoutId: string;
    amount: number;
    currency: string;
    erpMatch: {
      supplierId: string;
      supplierName: string;
      openPos: Array<{ id: string; poNumber: string; total: number; paidAmount: number; outstanding: number; status: string }>;
    };
  } | null>(null);

  const [rates, setRates] = useState<RateRow[]>([]);
  const [ratesLoaded, setRatesLoaded] = useState(false);
  /** Live FX from /api/fx/current — used when the operator hasn't set
   *  a house rate for the (send, recv) pair. Source tells the UI
   *  whether to display a "fallback rate" warning. */
  const [liveFx, setLiveFx] = useState<{ rate: number; source: 'live' | 'cached' | 'fallback'; fetchedAt: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanHint, setScanHint] = useState<string | null>(null);

  useEffect(() => {
    if (!open || ratesLoaded) return;
    (async () => {
      try {
        const [active, derived] = await Promise.all([
          api<RateRow[]>('/kobepay/rates/active').catch(() => []),
          api<RateRow[]>('/kobepay/rates/derived').catch(() => []),
        ]);
        setRates([
          ...(active ?? []).map((r) => ({ ...r, salesRate: Number(r.salesRate) })),
          ...(derived ?? []).map((r) => ({ ...r, salesRate: Number(r.salesRate) })),
        ]);
      } catch { /* fallback below */ }
      finally { setRatesLoaded(true); }
    })();
  }, [open, ratesLoaded]);

  useEffect(() => {
    if (!open) {
      setStep(1); setSearch(''); setContact(initialContact);
      setSendAmount('200'); setSendCurrency('USD'); setRecvCurrency(isReceive ? 'USD' : 'NGN');
      setMethod('Bank Transfer'); setSchedule(''); setScheduleOpen(false); setNotes('');
      setSendRail(SEND_RAILS[0].id); setFreeRecipient(''); setRecipientMode('selected');
      setError(null); setDone(false); setScanHint(null);
    }
  }, [open, isReceive, initialContact]);

  const filteredContacts = useMemo(() => {
    const base = contacts.filter((c) => isReceive ? c.kind === 'customer' : true);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((c) => c.name.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q));
  }, [contacts, search, isReceive]);

  // Resolution order:
  //   1. Operator-set "house rate" (KobePayRatesService)
  //   2. Live FX from /api/fx/current (ECB-backed, cached 6h server-side)
  //   3. Hardcoded FX_FALLBACK (last-resort, displays a warning)
  const resolvedRate = useMemo(() => {
    const real = lookupRate(rates, sendCurrency, recvCurrency);
    if (real != null && Number.isFinite(real) && real > 0) return { rate: real, source: 'house' as const };
    if (liveFx && liveFx.rate > 0) return { rate: liveFx.rate, source: liveFx.source };
    const fall = (FX_FALLBACK[recvCurrency] ?? 1) / (FX_FALLBACK[sendCurrency] ?? 1);
    return { rate: fall, source: 'frontend-fallback' as const };
  }, [rates, sendCurrency, recvCurrency, liveFx]);

  // Pull a fresh live rate whenever the pair changes. Skipped if the
  // operator has already set a house rate for this exact pair.
  useEffect(() => {
    if (!open) return;
    if (sendCurrency === recvCurrency) { setLiveFx({ rate: 1, source: 'live', fetchedAt: new Date().toISOString() }); return; }
    if (lookupRate(rates, sendCurrency, recvCurrency) != null) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ rate: number; source: 'live' | 'cached' | 'fallback'; fetchedAt: string }>(
          `/fx/current?from=${encodeURIComponent(sendCurrency)}&to=${encodeURIComponent(recvCurrency)}`,
        );
        if (!cancelled) setLiveFx(data);
      } catch { /* keep prior liveFx; UI falls through to hardcoded */ }
    })();
    return () => { cancelled = true; };
  }, [open, sendCurrency, recvCurrency, rates]);

  const sendNum = Number.parseFloat(sendAmount) || 0;
  const recvNum = sendNum * resolvedRate.rate;
  const sendUsd = sendNum / (FX_FALLBACK[sendCurrency] || 1);
  const fee = isReceive ? 0 : Math.max(1.20, sendUsd * 0.006);
  const totalUsd = Math.max(0, sendUsd - fee);

  const recipientName = recipientMode === 'selected' ? (contact?.name ?? '') : freeRecipient.trim();

  const canNext = (() => {
    if (step === 1) return Boolean(contact);
    if (step === 2) {
      if (sendNum <= 0) return false;
      if (!isReceive && sendNum > (availableBalance + 1e-6)) return false;
      if (recipientMode === 'anywhere' && !freeRecipient.trim()) return false;
      return true;
    }
    if (step === 3) return Boolean(recvCurrency && method);
    return true;
  })();

  const handleScan = async (file: File) => {
    setScanning(true);
    setError(null);
    setScanHint(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/ocr/extract-receipt', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      const data = await res.json() as { parsed: { total: number | null; currency: string | null; merchant: string | null } };
      const bits: string[] = [];
      if (data.parsed.total != null) { setSendAmount(String(data.parsed.total)); bits.push(`amount ${data.parsed.total}`); }
      if (data.parsed.currency) { setSendCurrency(data.parsed.currency === 'TZS' ? 'TZS' : 'USD'); bits.push(data.parsed.currency); }
      if (data.parsed.merchant) { setNotes((n) => n || `From ${data.parsed.merchant}`); bits.push(`merchant ${data.parsed.merchant}`); }
      setScanHint(bits.length ? `Filled: ${bits.join(', ')}` : 'No fields recognised — text extracted only');
      setTimeout(() => setScanHint(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const submit = async () => {
    if (!contact) return;
    setSubmitting(true);
    setError(null);
    try {
      if (isReceive) {
        if (contact.kind !== 'customer') throw new Error('Receive a deposit from a customer (not a supplier).');
        await api('/kobepay/deposits', {
          method: 'POST',
          body: JSON.stringify({
            customerId: contact.id,
            amount: sendNum,
            currency: sendCurrency,
            method,
            reference: notes || '',
            status: 'Confirmed',
            txnType: 'Deposit',
          }),
        });
      } else {
        const body = contact.kind === 'supplier'
          ? { supplierId: contact.id, amount: sendNum, currency: sendCurrency, method, notes }
          : { customerId: contact.id, amount: sendNum, currency: sendCurrency, method, notes };
        const payout = await api<{
          id: string;
          erpMatch?: {
            supplierId: string;
            supplierName: string;
            openPos: Array<{ id: string; poNumber: string; total: number; paidAmount: number; outstanding: number; status: string }>;
          } | null;
        }>('/kobepay/payouts', { method: 'POST', body: JSON.stringify(body) });

        // If the phone matched an ERP supplier, hand off to the
        // reconciliation modal instead of closing — the operator gets
        // a chance to mark this payout against an open PO or log it
        // as a NEW_GOODS / GENERAL payment so the books stay tidy.
        if (payout.erpMatch) {
          setReconcile({
            payoutId: payout.id,
            amount: sendNum,
            currency: sendCurrency,
            erpMatch: payout.erpMatch,
          });
          return;
        }
      }
      setDone(true);
      setTimeout(() => { onClose(); onSent?.(); }, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const stepLabels = isReceive
    ? ['Select Customer', 'Amount',     'Source',    'Review & Record']
    : ['Select Contact',  'Amount',     'Recipient', 'Review & Confirmation'];

  const stepHeadings = isReceive
    ? ['Who deposited?',        'How much was received?',  'How was it paid?',         'Review & record']
    : ['Who are you sending to?', 'How much do you want to send?', 'How should it arrive?', 'Review & confirm'];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex">

        {/* Left rail — stepper */}
        <aside className="w-56 shrink-0 border-r border-slate-100 p-6 flex flex-col gap-5 bg-slate-50/40">
          <div className="text-base font-extrabold text-slate-900">{isReceive ? 'Receive Deposit' : 'Send Money'}</div>
          <div className="flex flex-col gap-5">
            {stepLabels.map((label, i) => {
              const n = (i + 1) as Step;
              const active = step === n;
              const isDone = step > n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => isDone && setStep(n)}
                  disabled={!isDone}
                  className="text-left"
                >
                  <div className={`text-xs font-bold flex items-center gap-1.5 ${
                    active ? 'text-lime-600' : isDone ? 'text-slate-900' : 'text-slate-400'
                  }`}>
                    Step {n}/4 {isDone && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100">
                        <Check className="w-2.5 h-2.5 text-emerald-700" />
                      </span>
                    )}
                  </div>
                  <div className={`text-sm font-semibold mt-0.5 ${
                    active ? 'text-slate-900' : isDone ? 'text-slate-700' : 'text-slate-400'
                  }`}>{label}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-auto text-[10px]">
            {!ratesLoaded ? (
              <span className="text-slate-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading FX…</span>
            ) : rates.length > 0 ? (
              <span className="text-emerald-600"><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />{rates.length} live rates</span>
            ) : (
              <span className="text-amber-600"><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1" />using fallback FX</span>
            )}
          </div>
        </aside>

        {/* Right pane */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Header with progress + close */}
          <div className="flex items-center gap-4 px-6 pt-5 pb-4 border-b border-slate-100">
            <h2 className="text-base font-extrabold text-slate-900">{stepLabels[step - 1]}</h2>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-lime-400 to-emerald-500 transition-all"
                  style={{ width: `${(step / 4) * 100}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">{step}/4 Completed</span>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <h3 className="text-xl font-extrabold text-slate-900">{stepHeadings[step - 1]}</h3>

            {step === 1 && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search name, phone, email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
                  />
                </div>
                <div className="max-h-[55vh] overflow-y-auto -mx-2 px-2 space-y-1.5">
                  {filteredContacts.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-6">No matching contacts.</p>
                  ) : (
                    filteredContacts.map((c) => {
                      const selected = contact?.id === c.id;
                      const initials = c.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
                      return (
                        <button
                          key={c.id}
                          onClick={() => setContact(c)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                            selected ? 'bg-lime-50 border-lime-400 ring-1 ring-lime-300' : 'bg-white border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ background: c.avatarHue ?? 'linear-gradient(135deg, #f59e0b, #f97316)' }}
                          >
                            {initials || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">{c.name}</div>
                            <div className="text-xs text-slate-500 truncate">{c.subtitle}</div>
                          </div>
                          <span className={`text-[10px] font-semibold uppercase rounded-full px-2 py-0.5 ${
                            c.kind === 'supplier' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>{c.kind}</span>
                          {selected && <Check className="w-4 h-4 text-lime-600" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                {/* Anywhere / Selected contact toggle */}
                {!isReceive && (
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-full border border-slate-200 bg-slate-50">
                    <ToggleChip
                      label="Sent to Anywhere"
                      active={recipientMode === 'anywhere'}
                      onClick={() => setRecipientMode('anywhere')}
                    />
                    <ToggleChip
                      label="Selected contact"
                      active={recipientMode === 'selected'}
                      onClick={() => setRecipientMode('selected')}
                      disabled={!contact}
                    />
                  </div>
                )}

                {/* You send card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <Label>{isReceive ? 'Amount received' : 'You send'}</Label>
                    {isReceive && (
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleScan(f);
                            e.target.value = '';
                          }}
                        />
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border border-amber-500/30">
                          {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanLine className="w-3 h-3" />}
                          {scanning ? 'Scanning…' : 'Scan receipt'}
                        </span>
                      </label>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-extrabold text-slate-900">$</span>
                    <Input
                      type="number"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      className="text-2xl font-extrabold border-none px-0 focus-visible:ring-0 text-slate-900 bg-transparent h-auto"
                    />
                    <CurrencyPicker value={sendCurrency} onChange={setSendCurrency} />
                  </div>
                  {scanHint && <p className="text-[11px] text-emerald-600">{scanHint}</p>}
                  {!isReceive && (
                    <>
                      <div className="text-xs text-slate-500 flex items-center justify-between">
                        <span>
                          You've <strong className="text-slate-700">${availableBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong> available balance
                        </span>
                        <button className="text-lime-700 font-bold hover:text-lime-800">Deposit to wallet</button>
                      </div>
                      <p className="text-[10px] text-slate-400">Fiat currency in {sendCurrency}, typically off-chain or through payment gateways.</p>
                      <hr className="border-slate-100" />
                      <Row label="Transfer fee"     value={`− $${fee.toFixed(2)}`} />
                      <Row label="Total amount send" value={`= $${totalUsd.toFixed(2)}`} bold />
                      <Label className="mt-1">Rail</Label>
                      <RailDropdown
                        value={sendRail}
                        options={SEND_RAILS}
                        onChange={setSendRail}
                      />
                    </>
                  )}
                </div>

                {/* Recipient row — selected contact card or free-text */}
                {recipientMode === 'selected' && contact && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center gap-3 shadow-sm">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: contact.avatarHue ?? 'linear-gradient(135deg, #f59e0b, #f97316)' }}
                    >
                      {contact.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-extrabold text-slate-900 truncate">{contact.name}</div>
                      <div className="text-xs text-slate-500 truncate">{contact.subtitle}</div>
                    </div>
                    <button onClick={() => setStep(1)} className="text-xs font-bold text-slate-700 underline hover:text-lime-600">Change</button>
                  </div>
                )}
                {recipientMode === 'anywhere' && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2 shadow-sm">
                    <Label>Recipient name</Label>
                    <Input
                      placeholder="e.g. Sarah Mwangi"
                      value={freeRecipient}
                      onChange={(e) => setFreeRecipient(e.target.value)}
                      className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                )}

                {/* Recipient Get card */}
                {!isReceive && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <Label>Recipient Get</Label>
                      <CurrencyPicker value={recvCurrency} onChange={setRecvCurrency} />
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900">
                      {recvNum.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      <span className="text-base font-semibold text-slate-500 ml-2">{recvCurrency}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      1 {sendCurrency} ≈ {resolvedRate.rate.toFixed(4)} {recvCurrency}
                      <span className={`ml-2 inline-block text-[10px] px-1.5 py-0.5 rounded ${
                        resolvedRate.source === 'house' || resolvedRate.source === 'live' ? 'bg-emerald-50 text-emerald-700' :
                        resolvedRate.source === 'cached'   ? 'bg-blue-50 text-blue-700'      :
                                                             'bg-amber-50 text-amber-700'
                      }`}>
                        {resolvedRate.source === 'house'             ? 'house rate'    :
                         resolvedRate.source === 'live'              ? 'live'          :
                         resolvedRate.source === 'cached'            ? 'cached (6h)'   :
                         resolvedRate.source === 'fallback'          ? 'fallback'      :
                                                                       'fallback (stale)'}
                      </span>
                    </p>
                    <hr className="border-slate-100" />
                    <Label>Rail</Label>
                    <RailDropdown
                      value={method}
                      options={METHODS.map((m) => ({ id: m.id, label: `${m.label} — ${m.hint}` }))}
                      onChange={setMethod}
                    />
                    <button className="text-xs font-bold text-lime-700 hover:text-lime-800 underline self-start">
                      Add Currency Account
                    </button>
                  </div>
                )}

                {/* Set Schedule button + popover */}
                {!isReceive && (
                  <div>
                    <button
                      onClick={() => setScheduleOpen((s) => !s)}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold transition ${
                        schedule
                          ? 'border-lime-400 bg-lime-50 text-lime-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      {schedule ? `Scheduled · ${new Date(schedule).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}` : 'Set Schedule'}
                    </button>
                    {scheduleOpen && (
                      <div className="mt-2 inline-flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-white shadow-sm">
                        <Input
                          type="datetime-local"
                          value={schedule}
                          onChange={(e) => setSchedule(e.target.value)}
                          className="bg-slate-50 border-slate-200 text-slate-900 h-9"
                        />
                        {schedule && (
                          <button onClick={() => { setSchedule(''); setScheduleOpen(false); }} className="text-[11px] text-slate-500 hover:text-rose-600 px-1">
                            clear
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                  <Label>{isReceive ? 'Payment method' : 'How should the recipient receive it?'}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {METHODS.map((m) => {
                      const active = method === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setMethod(m.id)}
                          className={`text-left p-3 rounded-xl border transition-colors ${
                            active ? 'bg-lime-50 border-lime-400 ring-1 ring-lime-300' : 'bg-white border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div className="text-sm font-bold text-slate-900">{m.label}</div>
                          <div className="text-[11px] text-slate-500">{m.hint}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 shadow-sm">
                  <Label>{isReceive ? 'Reference (M-Pesa code, etc.)' : 'Note (optional)'}</Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={isReceive ? 'M-Pesa code / bank reference' : 'Invoice #, reference, message…'}
                    className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
                  />
                  {!isReceive && (
                    <p className="text-[11px] text-slate-400">Shown to the recipient when they receive the funds.</p>
                  )}
                </div>
              </>
            )}

            {step === 4 && (
              <div className="space-y-3">
                {done ? (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                      <Check className="w-8 h-8 text-emerald-600" />
                    </div>
                    <p className="text-base font-semibold text-slate-900">{isReceive ? 'Deposit recorded' : 'Payment created'}</p>
                    <p className="text-sm text-slate-500 mt-1">Closing…</p>
                  </div>
                ) : (
                  <>
                    <Section title={isReceive ? 'Customer' : 'Recipient'}>
                      <Row label="Name"    value={recipientName || '—'} />
                      <Row label="Contact" value={contact?.subtitle ?? '—'} />
                      <Row label="Kind"    value={contact?.kind ?? (recipientMode === 'anywhere' ? 'one-off' : '—')} />
                    </Section>
                    <Section title="Amount">
                      <Row label={isReceive ? 'Received' : 'You send'} value={`${sendNum.toLocaleString()} ${sendCurrency}`} />
                      {!isReceive && <Row label="Transfer fee" value={`$${fee.toFixed(2)}`} />}
                      <Row label={isReceive ? 'Credited as' : 'Recipient gets'} value={`${recvNum.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${recvCurrency}`} bold />
                      <Row label="Rate" value={`1 ${sendCurrency} ≈ ${resolvedRate.rate.toFixed(4)} ${recvCurrency} · ${resolvedRate.source}`} />
                    </Section>
                    <Section title="Rail">
                      <Row label="Method" value={method} />
                      {schedule && <Row label="Scheduled" value={new Date(schedule).toLocaleString()} />}
                      {notes && <Row label={isReceive ? 'Reference' : 'Note'} value={notes} />}
                    </Section>
                    {error && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs p-3">{error}</div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer actions */}
          {!done && (
            <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => (step > 1 ? setStep((step - 1) as Step) : onClose())}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-full px-5"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>

              {step < 4 ? (
                <Button
                  onClick={() => setStep((step + 1) as Step)}
                  disabled={!canNext}
                  className="bg-lime-500 hover:bg-lime-600 text-white font-extrabold disabled:opacity-50 rounded-full px-6 shadow-md shadow-lime-500/30"
                >
                  Continue <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={submit}
                  disabled={submitting}
                  className="bg-lime-500 hover:bg-lime-600 text-white font-extrabold disabled:opacity-50 rounded-full px-6 shadow-md shadow-lime-500/30"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : isReceive ? <Download className="w-3.5 h-3.5 mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                  {submitting ? (isReceive ? 'Recording…' : 'Sending…') : (isReceive ? 'Record deposit' : 'Confirm & send')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {reconcile && (
        <SupplierPaymentReconcileDialog
          payoutId={reconcile.payoutId}
          amount={reconcile.amount}
          currency={reconcile.currency}
          erpMatch={reconcile.erpMatch}
          onClose={() => {
            setReconcile(null);
            setDone(true);
            setTimeout(() => { onClose(); onSent?.(); }, 800);
          }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-xs font-bold text-slate-500 uppercase tracking-wide ${className}`}>{children}</div>;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={bold ? 'font-extrabold text-slate-900' : 'text-slate-900 font-semibold'}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ToggleChip({ label, active, onClick, disabled }: { label: string; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`py-2 rounded-full text-xs font-extrabold transition disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? 'bg-lime-500 text-white shadow' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );
}

function RailDropdown({
  value, options, onChange,
}: {
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value) ?? options[0];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 font-semibold flex items-center justify-between hover:border-slate-300"
      >
        {current?.label ?? value}
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => { onChange(o.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 font-semibold ${value === o.id ? 'bg-lime-50 text-lime-700' : 'text-slate-700'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CurrencyPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = CURRENCIES.find((c) => c.code === value) ?? CURRENCIES[0];
  const filtered = CURRENCIES.filter((c) =>
    !q || c.code.toLowerCase().includes(q.toLowerCase()) || c.label.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-extrabold text-slate-900 hover:border-slate-300"
      >
        <span className="text-base leading-none">{current.flag}</span>
        {current.code}
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Type currency or country"
                autoFocus
                className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md bg-slate-50 border border-slate-200 focus:outline-none focus:border-lime-400"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-slate-400 text-center">No match</div>
            ) : filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onChange(c.code); setOpen(false); setQ(''); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${value === c.code ? 'bg-lime-50' : ''}`}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="font-extrabold text-slate-900">{c.label}</span>
                <span className="text-xs text-slate-500 ml-auto font-bold">{c.code}</span>
                {value === c.code && <Check className="w-3.5 h-3.5 text-lime-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
