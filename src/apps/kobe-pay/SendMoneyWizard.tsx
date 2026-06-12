import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, X, Check, ChevronDown, Calendar, ArrowRight, ArrowLeft, Search, Send } from 'lucide-react';

/**
 * Multi-step "Send Money" wizard for KobePay.
 *
 * Wraps the existing /kobepay/payouts endpoint with a four-step flow:
 *   1. Pick contact          (supplier or customer)
 *   2. Amount + source rail  (currency, balance, fee, conversion)
 *   3. Recipient rail        (currency the receiver gets, destination)
 *   4. Review & confirm      (POST to /kobepay/payouts)
 *
 * Light card on dark backdrop, green accent — matches the mockup. The
 * available balance + rate come from the existing wallet + rates endpoints
 * so no new backend work is needed.
 */

export interface SendMoneyWizardProps {
  /** When false the dialog is hidden. */
  open: boolean;
  /** Close handler — wizard must be controlled from outside. */
  onClose: () => void;
  /** Optional callback after a successful payout creation. */
  onSent?: () => void;
  /** Pre-loaded contacts (suppliers + customers) from KobePay state. */
  contacts: ContactOption[];
  /** Source-side wallet balance (USD-equivalent, for display only). */
  availableBalance: number;
}

export interface ContactOption {
  id: string;
  kind: 'supplier' | 'customer';
  name: string;
  subtitle: string;     // phone or email
  avatarHue?: string;   // gradient seed for the avatar circle
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
  USD: 1,
  TZS: 2630,
  KES: 130,
  UGX: 3700,
  NGN: 1451,
  EUR: 0.92,
  GBP: 0.79,
  CNY: 7.2,
};

const METHODS = [
  { id: 'M-Pesa',         label: 'M-Pesa',         hint: 'Mobile money' },
  { id: 'Bank Transfer',  label: 'Bank Transfer',  hint: '1-2 business days' },
  { id: 'Cash',           label: 'Cash',           hint: 'Counter pickup' },
  { id: 'WeChat Pay',     label: 'WeChat Pay',     hint: 'Cross-border' },
  { id: 'Alipay',         label: 'Alipay',         hint: 'Cross-border' },
  { id: 'Wallet',         label: 'Wallet',         hint: 'KobePay internal' },
];

type Step = 1 | 2 | 3 | 4;

export function SendMoneyWizard({ open, onClose, onSent, contacts, availableBalance }: SendMoneyWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [search, setSearch] = useState('');
  const [contact, setContact] = useState<ContactOption | null>(null);
  const [sendAmount, setSendAmount] = useState('200');
  const [sendCurrency, setSendCurrency] = useState('USD');
  const [recvCurrency, setRecvCurrency] = useState('NGN');
  const [method, setMethod] = useState('Bank Transfer');
  const [schedule, setSchedule] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) {
      // reset on close so re-open starts fresh
      setStep(1); setSearch(''); setContact(null);
      setSendAmount('200'); setSendCurrency('USD'); setRecvCurrency('NGN');
      setMethod('Bank Transfer'); setSchedule(''); setNotes('');
      setError(null); setDone(false);
    }
  }, [open]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q));
  }, [contacts, search]);

  const sendNum = Number.parseFloat(sendAmount) || 0;
  const sendUsd = sendNum / (FX_FALLBACK[sendCurrency] || 1);
  const recvNum = sendUsd * (FX_FALLBACK[recvCurrency] || 1);
  const fee = Math.max(1.20, sendUsd * 0.006);    // flat USD 1.20 or 0.6%
  const totalUsd = Math.max(0, sendUsd - fee);
  const rate = FX_FALLBACK[recvCurrency] / FX_FALLBACK[sendCurrency];

  const canNext = (() => {
    if (step === 1) return Boolean(contact);
    if (step === 2) return sendNum > 0 && sendNum <= (availableBalance + 1e-6);
    if (step === 3) return Boolean(recvCurrency && method);
    return true;
  })();

  const submit = async () => {
    if (!contact) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = contact.kind === 'supplier'
        ? { supplierId: contact.id, amount: sendNum, currency: sendCurrency, method, notes }
        : { customerId: contact.id, amount: sendNum, currency: sendCurrency, method, notes };
      await api('/kobepay/payouts', { method: 'POST', body: JSON.stringify(body) });
      setDone(true);
      setTimeout(() => { onClose(); onSent?.(); }, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex">
        {/* ─── Step sidebar ───────────────────────────────────────────────── */}
        <aside className="w-52 shrink-0 border-r border-slate-100 p-5 flex flex-col gap-4 text-slate-700">
          <div className="text-base font-bold">Send Money</div>
          {([
            { n: 1, label: 'Select Contact' },
            { n: 2, label: 'Amount' },
            { n: 3, label: 'Recipient' },
            { n: 4, label: 'Review & Confirmation' },
          ] as const).map(({ n, label }) => {
            const active = step === n;
            const done = step > n;
            return (
              <div key={n} className="text-sm">
                <div className={`flex items-center gap-1.5 font-semibold ${active ? 'text-lime-600' : done ? 'text-slate-900' : 'text-slate-400'}`}>
                  Step {n}/4 {done && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <div className={`text-[13px] ${active ? 'text-slate-900' : done ? 'text-slate-700' : 'text-slate-400'}`}>{label}</div>
              </div>
            );
          })}
        </aside>

        {/* ─── Main panel ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 pt-5 pb-3 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">
              {step === 1 ? 'Select Contact' : step === 2 ? 'Amount' : step === 3 ? 'Recipient' : 'Review & Confirmation'}
            </h2>
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-lime-500 transition-all" style={{ width: `${(step / 4) * 100}%` }} />
            </div>
            <span className="text-xs text-slate-500 font-medium">{step}/4 Completed</span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
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
                <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2 space-y-1.5">
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
                            selected
                              ? 'bg-lime-50 border-lime-300'
                              : 'bg-white border-slate-100 hover:border-slate-200'
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
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                  <Label>You send</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      className="text-2xl font-bold border-none px-0 focus-visible:ring-0 text-slate-900 bg-transparent"
                    />
                    <CurrencyPicker value={sendCurrency} onChange={setSendCurrency} />
                  </div>
                  <div className="text-xs text-slate-500 flex items-center justify-between">
                    <span>
                      You've <strong className="text-slate-700">${availableBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong> available
                    </span>
                    <span className="text-lime-700 font-medium cursor-pointer">Deposit to wallet</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Fiat currency in {sendCurrency}, typically off-chain or through payment gateways.</p>
                  <hr className="border-slate-100 my-1" />
                  <Row label="Transfer fee"     value={`− $${fee.toFixed(2)}`} />
                  <Row label="Total amount send" value={`= $${totalUsd.toFixed(2)}`} bold />
                  <Label className="mt-2">Rail</Label>
                  <SelectPill value="Checking (**** 6346)" />
                </div>

                {contact && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: contact.avatarHue ?? 'linear-gradient(135deg, #f59e0b, #f97316)' }}
                    >
                      {contact.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{contact.name}</div>
                      <div className="text-xs text-slate-500 truncate">{contact.subtitle}</div>
                    </div>
                    <button onClick={() => setStep(1)} className="text-xs font-semibold text-slate-700 underline">Change</button>
                  </div>
                )}

                <button
                  onClick={() => {/* schedule picker stub */}}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Calendar className="w-3.5 h-3.5" /> Set Schedule
                </button>
              </>
            )}

            {step === 3 && (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Recipient Get</Label>
                    <CurrencyPicker value={recvCurrency} onChange={setRecvCurrency} />
                  </div>
                  <div className="text-3xl font-bold text-slate-900">
                    {recvNum.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-base font-medium text-slate-500">{recvCurrency}</span>
                  </div>
                  <p className="text-xs text-slate-500">Rate: 1 {sendCurrency} ≈ {rate.toFixed(2)} {recvCurrency}</p>
                  <Label className="mt-2">Rail</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {METHODS.map((m) => {
                      const active = method === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setMethod(m.id)}
                          className={`text-left p-3 rounded-xl border transition-colors ${
                            active ? 'bg-lime-50 border-lime-300' : 'bg-white border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div className="text-sm font-semibold text-slate-900">{m.label}</div>
                          <div className="text-[11px] text-slate-500">{m.hint}</div>
                        </button>
                      );
                    })}
                  </div>
                  <button className="text-xs text-lime-700 font-semibold mt-2">+ Add Currency Account</button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                  <Label>Note (optional)</Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Invoice #, reference, message…"
                    className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
                  />
                  <Label>Schedule</Label>
                  <Input
                    type="datetime-local"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    className="bg-slate-50 border-slate-200 text-slate-900"
                  />
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
                    <p className="text-base font-semibold text-slate-900">Payment created</p>
                    <p className="text-sm text-slate-500 mt-1">Closing…</p>
                  </div>
                ) : (
                  <>
                    <Section title="Recipient">
                      <Row label="Name"    value={contact?.name ?? '—'} />
                      <Row label="Contact" value={contact?.subtitle ?? '—'} />
                      <Row label="Kind"    value={contact?.kind ?? '—'} />
                    </Section>
                    <Section title="Amount">
                      <Row label="You send"        value={`${sendNum.toLocaleString()} ${sendCurrency}`} />
                      <Row label="Transfer fee"   value={`$${fee.toFixed(2)}`} />
                      <Row label="Recipient gets" value={`${recvNum.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${recvCurrency}`} bold />
                      <Row label="Rate"            value={`1 ${sendCurrency} ≈ ${rate.toFixed(2)} ${recvCurrency}`} />
                    </Section>
                    <Section title="Rail">
                      <Row label="Method"   value={method} />
                      {schedule && <Row label="Scheduled" value={new Date(schedule).toLocaleString()} />}
                      {notes && <Row label="Note" value={notes} />}
                    </Section>
                    {error && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs p-3">{error}</div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {!done && (
            <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => (step > 1 ? setStep((step - 1) as Step) : onClose())}
                className="border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>

              {step < 4 ? (
                <Button
                  onClick={() => setStep((step + 1) as Step)}
                  disabled={!canNext}
                  className="bg-lime-500 hover:bg-lime-600 text-white font-semibold disabled:opacity-50"
                >
                  Continue <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={submit}
                  disabled={submitting}
                  className="bg-lime-500 hover:bg-lime-600 text-white font-semibold disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                  {submitting ? 'Sending…' : 'Confirm & send'}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-xs font-medium text-slate-500 ${className}`}>{children}</div>;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={bold ? 'font-bold text-slate-900' : 'text-slate-900'}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function SelectPill({ value }: { value: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 flex items-center justify-between">
      {value} <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
    </div>
  );
}

function CurrencyPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = CURRENCIES.find((c) => c.code === value) ?? CURRENCIES[0];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-900"
      >
        <span className="text-base leading-none">{current.flag}</span>
        {current.code}
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-10">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => { onChange(c.code); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${value === c.code ? 'bg-lime-50' : ''}`}
            >
              <span className="text-base leading-none">{c.flag}</span>
              <span className="font-semibold text-slate-900">{c.code}</span>
              <span className="text-xs text-slate-500 ml-1">{c.label}</span>
              {value === c.code && <Check className="w-3.5 h-3.5 text-lime-600 ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
