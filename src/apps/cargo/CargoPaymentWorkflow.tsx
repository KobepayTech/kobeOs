import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Building2, CheckCircle2, ChevronRight,
  Copy, FileText, Phone, Printer, Receipt, User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';

/**
 * 3-step cargo payment workflow: form → confirm → receipts. Posts to
 * /api/cargo/payments which persists the payment and emits a cargo:payment
 * socket event so any other open admin screens update live. The success step
 * renders 3 receipt previews and links to a print-friendly route at
 * /print/cargo-receipt?id=… that auto-prints a thermal-format slip per copy.
 */

type Purpose = 'DEPOSIT' | 'BALANCE' | 'FULL' | 'SHIPPING' | 'CUSTOMS';
type Method = 'KOBEPAY' | 'BANK' | 'MOBILE_MONEY' | 'CASH' | 'CARD';

interface ParcelLite { id: string; parcelId?: string; senderName?: string; ownerName?: string; }
interface ShipmentLite { id: string; shipmentId?: string; }

interface CargoPaymentRecord {
  id: string;
  parcelId?: string | null;
  shipmentId?: string | null;
  customerName: string;
  customerPhone: string;
  supplierName?: string | null;
  supplierNumber?: string | null;
  amount: number | string;
  currency: string;
  purpose: Purpose;
  method: Method;
  reference?: string | null;
  notes: string;
  status: string;
  createdAt?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: (payment: CargoPaymentRecord) => void;
  /** Pre-fill the subject when launched from a row in a parcel/shipment list. */
  defaultParcelId?: string;
  defaultShipmentId?: string;
  defaultCustomerName?: string;
  defaultCustomerPhone?: string;
}

const PURPOSES: { value: Purpose; label: string }[] = [
  { value: 'DEPOSIT', label: 'Deposit' },
  { value: 'BALANCE', label: 'Balance' },
  { value: 'FULL', label: 'Full Goods Payment' },
  { value: 'SHIPPING', label: 'Shipping Fee' },
  { value: 'CUSTOMS', label: 'Customs Fee' },
];
const METHODS: { value: Method; label: string }[] = [
  { value: 'KOBEPAY', label: 'KobePay' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'BANK', label: 'Bank Transfer' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
];

export default function CargoPaymentWorkflow({
  open, onClose, onSaved,
  defaultParcelId, defaultShipmentId, defaultCustomerName, defaultCustomerPhone,
}: Props) {
  const [step, setStep] = useState<'form' | 'confirm' | 'receipts'>('form');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<CargoPaymentRecord | null>(null);

  // Subject pickers
  const [subjectKind, setSubjectKind] = useState<'parcel' | 'shipment'>(defaultShipmentId ? 'shipment' : 'parcel');
  const [parcelId, setParcelId] = useState<string>(defaultParcelId || '');
  const [shipmentId, setShipmentId] = useState<string>(defaultShipmentId || '');
  const [parcels, setParcels] = useState<ParcelLite[]>([]);
  const [shipments, setShipments] = useState<ShipmentLite[]>([]);

  const [customerName, setCustomerName] = useState(defaultCustomerName ?? '');
  const [customerPhone, setCustomerPhone] = useState(defaultCustomerPhone ?? '');
  const [supplierName, setSupplierName] = useState('');
  const [supplierNumber, setSupplierNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TZS');
  const [purpose, setPurpose] = useState<Purpose>('DEPOSIT');
  const [method, setMethod] = useState<Method>('KOBEPAY');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  // Lazy load parcels/shipments when picker first opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const [p, s] = await Promise.all([
          api<ParcelLite[]>('/cargo/parcels'),
          api<ShipmentLite[]>('/cargo/shipments'),
        ]);
        if (cancelled) return;
        setParcels(Array.isArray(p) ? p : []);
        setShipments(Array.isArray(s) ? s : []);
      } catch { /* keep dropdowns empty */ }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Reset state every time the dialog closes.
  useEffect(() => {
    if (open) return;
    setStep('form'); setSubmitting(false); setError(null); setSaved(null);
    setCustomerName(defaultCustomerName ?? '');
    setCustomerPhone(defaultCustomerPhone ?? '');
    setSupplierName(''); setSupplierNumber(''); setAmount(''); setCurrency('TZS');
    setPurpose('DEPOSIT'); setMethod('KOBEPAY'); setReference(''); setNotes('');
    setParcelId(defaultParcelId || '');
    setShipmentId(defaultShipmentId || '');
    setSubjectKind(defaultShipmentId ? 'shipment' : 'parcel');
  }, [open, defaultCustomerName, defaultCustomerPhone, defaultParcelId, defaultShipmentId]);

  const amountNum = useMemo(() => parseFloat(amount), [amount]);
  const subjectId = subjectKind === 'parcel' ? parcelId : shipmentId;
  const canReview = customerName.trim().length > 0 && Number.isFinite(amountNum) && amountNum > 0 && !!subjectId;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        amount: amountNum,
        currency: currency || 'TZS',
        purpose,
        method,
      };
      if (subjectKind === 'parcel' && parcelId) payload.parcelId = parcelId;
      if (subjectKind === 'shipment' && shipmentId) payload.shipmentId = shipmentId;
      if (supplierName.trim()) payload.supplierName = supplierName.trim();
      if (supplierNumber.trim()) payload.supplierNumber = supplierNumber.trim();
      if (reference.trim()) payload.reference = reference.trim();
      if (notes.trim()) payload.notes = notes.trim();

      const created = await api<CargoPaymentRecord>('/cargo/payments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSaved(created);
      setStep('receipts');
      onSaved?.(created);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const openPrintAll = () => {
    if (!saved) return;
    window.open(`/print/cargo-receipt?id=${encodeURIComponent(saved.id)}`, '_blank', 'noopener');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-white/[0.85] backdrop-blur-xl border-white/[0.40] text-slate-700 max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-700">
            <Receipt className="w-4 h-4 text-blue-500" />
            {step === 'form' && 'Record Payment'}
            {step === 'confirm' && 'Confirm Payment'}
            {step === 'receipts' && 'Payment Recorded'}
          </DialogTitle>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4">
            <Section title="Subject">
              <div className="flex gap-2">
                {(['parcel', 'shipment'] as const).map(k => (
                  <Button
                    key={k}
                    size="sm"
                    variant={subjectKind === k ? 'default' : 'outline'}
                    onClick={() => setSubjectKind(k)}
                    className={subjectKind === k ? 'bg-blue-500 hover:bg-blue-600 capitalize' : 'border-slate-300 text-slate-600 capitalize hover:bg-slate-50'}
                  >
                    {k}
                  </Button>
                ))}
              </div>
              <Select
                value={subjectId}
                onValueChange={(v) => (subjectKind === 'parcel' ? setParcelId(v) : setShipmentId(v))}
              >
                <SelectTrigger className="bg-white/50 border-white/[0.40] rounded-xl text-slate-700 text-xs h-9">
                  <SelectValue placeholder={`Select a ${subjectKind}...`} />
                </SelectTrigger>
                <SelectContent>
                  {subjectKind === 'parcel'
                    ? parcels.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {(p.parcelId || p.id.slice(0, 8))} — {p.senderName || p.ownerName || '—'}
                        </SelectItem>
                      ))
                    : shipments.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.shipmentId || s.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </Section>

            <Section title="Customer">
              <LabeledInput label="Name *" value={customerName} onChange={setCustomerName} icon={<User className="w-3 h-3" />} />
              <LabeledInput label="Phone" value={customerPhone} onChange={setCustomerPhone} icon={<Phone className="w-3 h-3" />} />
            </Section>

            <Section title="Supplier">
              <LabeledInput label="Supplier number" value={supplierNumber} onChange={setSupplierNumber} icon={<Phone className="w-3 h-3" />} />
              <LabeledInput label="Supplier name" value={supplierName} onChange={setSupplierName} icon={<Building2 className="w-3 h-3" />} />
            </Section>

            <Section title="Payment">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1.5">Purpose</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PURPOSES.map(p => (
                    <Button
                      key={p.value}
                      size="sm"
                      variant={purpose === p.value ? 'default' : 'outline'}
                      onClick={() => setPurpose(p.value)}
                      className={purpose === p.value ? 'bg-blue-500 hover:bg-blue-600 text-white text-xs h-9' : 'border-slate-300 text-slate-600 text-xs h-9 hover:bg-slate-50'}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1.5">Amount *</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="bg-white/50 border-white/[0.40] rounded-xl text-slate-700 text-xs h-9 placeholder:text-slate-400"
                    placeholder="100000"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1.5">Currency</label>
                  <Input
                    value={currency}
                    onChange={e => setCurrency(e.target.value.toUpperCase())}
                    maxLength={8}
                    className="bg-white/50 border-white/[0.40] rounded-xl text-slate-700 text-xs h-9"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1.5">Method</label>
                <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
                  <SelectTrigger className="bg-white/50 border-white/[0.40] rounded-xl text-slate-700 text-xs h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <LabeledInput label="Reference" value={reference} onChange={setReference} icon={<FileText className="w-3 h-3" />} />
              <LabeledInput label="Notes" value={notes} onChange={setNotes} icon={<FileText className="w-3 h-3" />} />
            </Section>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-3">
            <div className="flex flex-col items-center text-center py-2">
              <AlertTriangle className="w-9 h-9 text-amber-500 mb-2" />
              <p className="text-sm text-slate-500">Review before confirming — receipts will be generated.</p>
            </div>
            <div className="border border-white/[0.40] rounded-xl divide-y divide-white/[0.30] bg-white/30 backdrop-blur-lg">
              <Row label="Subject" value={`${subjectKind[0].toUpperCase()}${subjectKind.slice(1)} ${subjectId.slice(0, 8)}`} />
              <Row label="Customer" value={`${customerName}${customerPhone ? ` · ${customerPhone}` : ''}`} />
              {(supplierNumber || supplierName) && (
                <Row label="Supplier" value={[supplierNumber, supplierName].filter(Boolean).join(' · ')} />
              )}
              <Row label="Purpose" value={PURPOSES.find(p => p.value === purpose)?.label ?? purpose} />
              <Row label="Method" value={METHODS.find(m => m.value === method)?.label ?? method} />
              <Row label="Amount" value={`${amountNum.toLocaleString()} ${currency}`} />
              {reference && <Row label="Reference" value={reference} />}
              {notes && <Row label="Notes" value={notes} />}
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}

        {step === 'receipts' && saved && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h3 className="font-semibold text-slate-700">Payment recorded</h3>
              <p className="text-xs text-slate-400 mt-1">
                {Number(saved.amount).toLocaleString()} {saved.currency} · {saved.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <div className="space-y-2">
              {['Customer Copy', 'Supplier Notice', 'Warehouse Copy'].map((label) => (
                <ReceiptPreview
                  key={label}
                  label={label}
                  payment={saved}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-white/[0.40]">
          {step === 'form' && (
            <>
              <Button variant="outline" onClick={onClose} className="border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl">Cancel</Button>
              <Button
                onClick={() => setStep('confirm')}
                disabled={!canReview}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl"
              >
                Review <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          )}
          {step === 'confirm' && (
            <>
              <Button variant="outline" onClick={() => setStep('form')} className="border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl" disabled={submitting}>Back</Button>
              <Button onClick={submit} disabled={submitting} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl">
                {submitting ? 'Saving...' : <><CheckCircle2 className="w-4 h-4 mr-1" /> Confirm & Generate</>}
              </Button>
            </>
          )}
          {step === 'receipts' && (
            <>
              <Button variant="outline" onClick={onClose} className="border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl">Done</Button>
              <Button onClick={openPrintAll} className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl">
                <Printer className="w-4 h-4 mr-1" /> Print All
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-white/[0.40] rounded-xl p-3 space-y-2 bg-white/30 backdrop-blur-lg">
      <h4 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{title}</h4>
      {children}
    </div>
  );
}

function LabeledInput({
  label, value, onChange, icon,
}: { label: string; value: string; onChange: (v: string) => void; icon?: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1.5">
        {icon}{label}
      </label>
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-white/50 border-white/[0.40] rounded-xl text-slate-700 text-xs h-9 placeholder:text-slate-400"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-700 font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

function ReceiptPreview({ label, payment }: { label: string; payment: CargoPaymentRecord }) {
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => buildReceiptText(label, payment), [label, payment]);
  const onCopy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* clipboard unavailable */ }
  };
  return (
    <div className="bg-white text-slate-900 rounded-xl p-3 font-mono text-[11px] shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold uppercase tracking-wide">{label}</span>
        <span className="text-[10px] text-slate-500">{payment.id.slice(0, 8).toUpperCase()}</span>
      </div>
      <div className="space-y-0.5">
        <Line k="Customer" v={payment.customerName} />
        {payment.customerPhone && <Line k="Phone" v={payment.customerPhone} />}
        {payment.supplierNumber && <Line k="Supplier #" v={payment.supplierNumber} />}
        <Line k="Purpose" v={payment.purpose} />
        <Line k="Amount" v={`${Number(payment.amount).toLocaleString()} ${payment.currency}`} bold />
      </div>
      <div className="flex gap-2 mt-2">
        <Button
          size="sm"
          onClick={() => window.open(`/print/cargo-receipt?id=${encodeURIComponent(payment.id)}`, '_blank', 'noopener')}
          className="flex-1 h-7 text-[11px] bg-slate-800 hover:bg-slate-900 text-white rounded-lg"
        >
          <Printer className="w-3 h-3 mr-1" /> Print
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCopy}
          className="flex-1 h-7 text-[11px] border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg"
        >
          <Copy className="w-3 h-3 mr-1" /> {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

function Line({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{k}</span>
      <span className={bold ? 'font-bold' : ''}>{v}</span>
    </div>
  );
}

function buildReceiptText(label: string, p: CargoPaymentRecord): string {
  return [
    label.toUpperCase(),
    '------------------------',
    `Customer: ${p.customerName}`,
    p.customerPhone ? `Phone: ${p.customerPhone}` : null,
    p.supplierName ? `Supplier: ${p.supplierName}` : null,
    p.supplierNumber ? `Supplier #: ${p.supplierNumber}` : null,
    `Purpose: ${p.purpose}`,
    `Method: ${p.method}`,
    `Amount: ${Number(p.amount).toLocaleString()} ${p.currency}`,
    p.reference ? `Reference: ${p.reference}` : null,
    p.parcelId ? `Parcel: ${p.parcelId.slice(0, 8)}` : null,
    p.shipmentId ? `Shipment: ${p.shipmentId.slice(0, 8)}` : null,
    p.notes ? `Notes: ${p.notes}` : null,
    `Ref: ${p.id.slice(0, 8).toUpperCase()}`,
  ].filter(Boolean).join('\n');
}
