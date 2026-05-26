import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Print sheet for the three cargo receipts (customer / supplier / warehouse)
 * generated from one payment. Mounted standalone from main.tsx at
 * /print/cargo-receipt?id=<paymentId>. The page fetches the payment via the
 * authenticated API (same-origin localStorage token) and auto-prints once
 * everything is rendered. Each receipt is a separate sheet — @page rules
 * give the browser a page break per card.
 */

interface Payment {
  id: string;
  parcelId?: string | null;
  shipmentId?: string | null;
  customerName: string;
  customerPhone: string;
  supplierName?: string | null;
  supplierNumber?: string | null;
  amount: number | string;
  currency: string;
  purpose: string;
  method: string;
  reference?: string | null;
  notes: string;
  status: string;
  createdAt?: string;
}

const RECEIPT_TYPES = [
  { type: 'CUSTOMER', title: 'KOBECARGO RECEIPT', subtitle: 'Customer Copy' },
  { type: 'SUPPLIER', title: 'SUPPLIER PAYMENT NOTICE', subtitle: 'Supplier Copy' },
  { type: 'WAREHOUSE', title: 'WAREHOUSE COPY', subtitle: 'File Copy' },
] as const;

function formatPurpose(p: string) {
  return p.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export default function CargoReceipts() {
  const id = useMemo(() => new URLSearchParams(window.location.search).get('id'), []);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(id ? null : 'Missing payment id');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await api<Payment>(`/cargo/payments/${id}`);
        if (!cancelled) setPayment(p);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!payment) return;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [payment]);

  if (error) {
    return (
      <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif' }}>
        <h1>Could not load receipt</h1>
        <p>{error}</p>
      </div>
    );
  }
  if (!payment) {
    return <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif' }}>Loading receipt…</div>;
  }

  const subjectRef = payment.parcelId
    ? `Parcel ${payment.parcelId.slice(0, 8)}`
    : payment.shipmentId
      ? `Shipment ${payment.shipmentId.slice(0, 8)}`
      : '—';
  const amount = `${Number(payment.amount).toLocaleString()} ${payment.currency}`;
  const date = payment.createdAt ? new Date(payment.createdAt).toLocaleString() : '';

  return (
    <>
      <style>{`
        @page { size: 80mm auto; margin: 5mm; }
        html, body { margin: 0; padding: 0; background: #e5e7eb; }
        body { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; color: #111; }
        .stack { display: flex; flex-direction: column; gap: 16px; padding: 24px; align-items: center; }
        .receipt {
          width: 80mm; background: #fff; padding: 6mm 5mm;
          box-shadow: 0 2px 12px rgba(0,0,0,0.08); border-radius: 2mm;
          page-break-after: always;
        }
        .receipt:last-child { page-break-after: auto; }
        .title { font-size: 11pt; font-weight: 800; text-align: center; margin: 0; letter-spacing: 0.05em; }
        .subtitle { font-size: 8pt; text-align: center; color: #6b7280; margin: 1mm 0 4mm; text-transform: uppercase; letter-spacing: 0.1em; }
        .row { display: flex; justify-content: space-between; gap: 4mm; font-size: 9pt; padding: 1mm 0; }
        .row .k { color: #6b7280; }
        .row .v { color: #111; font-weight: 600; text-align: right; word-break: break-word; }
        .hr { border-top: 0.5mm dashed #d1d5db; margin: 3mm 0; }
        .total { font-size: 12pt; font-weight: 800; }
        .footer { font-size: 7pt; color: #9ca3af; text-align: center; margin-top: 4mm; }
        @media print {
          body { background: #fff; }
          .stack { padding: 0; gap: 0; }
          .receipt { box-shadow: none; border-radius: 0; width: auto; max-width: 80mm; }
        }
      `}</style>
      <div className="stack">
        {RECEIPT_TYPES.map(r => (
          <div key={r.type} className="receipt">
            <h1 className="title">{r.title}</h1>
            <p className="subtitle">{r.subtitle}</p>
            <div className="hr" />
            <div className="row"><span className="k">Customer</span><span className="v">{payment.customerName}</span></div>
            {r.type !== 'SUPPLIER' && payment.customerPhone && (
              <div className="row"><span className="k">Phone</span><span className="v">{payment.customerPhone}</span></div>
            )}
            {(r.type === 'SUPPLIER' || r.type === 'CUSTOMER') && payment.supplierName && (
              <div className="row"><span className="k">Supplier</span><span className="v">{payment.supplierName}</span></div>
            )}
            {(r.type === 'SUPPLIER' || r.type === 'CUSTOMER') && payment.supplierNumber && (
              <div className="row"><span className="k">Supplier #</span><span className="v">{payment.supplierNumber}</span></div>
            )}
            <div className="row"><span className="k">Purpose</span><span className="v">{formatPurpose(payment.purpose)}</span></div>
            <div className="row"><span className="k">Method</span><span className="v">{formatPurpose(payment.method)}</span></div>
            {payment.reference && (
              <div className="row"><span className="k">Reference</span><span className="v">{payment.reference}</span></div>
            )}
            <div className="row"><span className="k">{payment.parcelId ? 'Parcel' : 'Shipment'}</span><span className="v">{subjectRef}</span></div>
            <div className="hr" />
            <div className="row"><span className="k">Amount</span><span className="v total">{amount}</span></div>
            {payment.notes && r.type !== 'SUPPLIER' && (
              <>
                <div className="hr" />
                <div className="row" style={{ display: 'block' }}>
                  <span className="k" style={{ display: 'block', marginBottom: '1mm' }}>Notes</span>
                  <span className="v" style={{ display: 'block', textAlign: 'left', fontWeight: 400 }}>{payment.notes}</span>
                </div>
              </>
            )}
            <div className="footer">
              {date}<br/>
              Ref: {payment.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
