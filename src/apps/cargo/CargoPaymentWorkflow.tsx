// ============================================================================
// CARGO PAYMENT WORKFLOW + RECEIPT ENGINE
// ============================================================================
// Cashier workflow for receiving payments:
// - Customer info entry
// - Supplier number linking
// - Purpose selection (Deposit, Balance, Full, Shipping, Customs)
// - Auto-generate 3 receipts: Customer, Supplier, Warehouse
// - Print prompt workflow
// ============================================================================

import React, { useState } from 'react';
import {
  Receipt, Printer, Download, Share2, CheckCircle, User, Phone,
  Building2, DollarSign, FileText, ChevronRight, QrCode, Copy,
  AlertTriangle
} from 'lucide-react';
import type { Shipment, CargoPayment, Receipt as ReceiptType } from '@/shared/types';
import { formatCurrency, formatDate, generateId } from '@/shared/utils';

interface CargoPaymentWorkflowProps {
  shipment: Shipment;
  onProcessPayment: (payment: CargoPayment) => void;
  onPrintReceipt: (receipt: ReceiptType) => void;
}

export const CargoPaymentWorkflow: React.FC<CargoPaymentWorkflowProps> = ({
  shipment,
  onProcessPayment,
  onPrintReceipt,
}) => {
  const [step, setStep] = useState<'form' | 'confirm' | 'receipts'>('form');
  const [customerName, setCustomerName] = useState(shipment.customerName);
  const [customerPhone, setCustomerPhone] = useState(shipment.customerPhone);
  const [supplierNumber, setSupplierNumber] = useState(shipment.suppliers[0]?.supplierNumber || '');
  const [supplierName, setSupplierName] = useState(shipment.suppliers[0]?.supplierName || '');
  const [amount, setAmount] = useState(String(shipment.balance));
  const [purpose, setPurpose] = useState<'deposit' | 'balance' | 'full-payment' | 'shipping' | 'customs'>('deposit');
  const [method, setMethod] = useState<'kobepay' | 'bank' | 'mobile-money' | 'cash'>('kobepay');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [generatedReceipts, setGeneratedReceipts] = useState<ReceiptType[]>([]);

  const purposes = [
    { value: 'deposit', label: 'Deposit Payment' },
    { value: 'balance', label: 'Balance Payment' },
    { value: 'full-payment', label: 'Full Goods Payment' },
    { value: 'shipping', label: 'Shipping Fee' },
    { value: 'customs', label: 'Customs Fee' },
  ];

  const methods = [
    { value: 'kobepay', label: 'KobePay' },
    { value: 'bank', label: 'Bank Transfer' },
    { value: 'mobile-money', label: 'Mobile Money' },
    { value: 'cash', label: 'Cash' },
  ];

  const confirmPayment = () => {
    const paymentId = generateId('pay-');
    const now = new Date().toISOString();

    const payment: CargoPayment = {
      id: paymentId,
      shipmentId: shipment.id,
      amount: Number(amount),
      currency: 'USD',
      purpose,
      method,
      reference: reference || `TXN-${Date.now()}`,
      status: 'completed',
      createdAt: now,
      createdBy: 'cashier',
    };

    // Generate 3 receipts
    const customerReceipt: ReceiptType = {
      id: generateId('rcp-'),
      type: 'customer',
      title: 'KOBECARGO RECEIPT',
      senderName: customerName,
      senderPhone: customerPhone,
      supplierName: supplierName || undefined,
      supplierNumber: supplierNumber || undefined,
      amount: Number(amount),
      currency: 'USD',
      purpose: purposes.find(p => p.value === purpose)?.label || purpose,
      shipmentRef: shipment.reference,
      date: now,
      items: shipment.suppliers.map(s => `${s.supplierNumber}: ${s.items}`).join(', '),
      notes: notes || undefined,
    };

    const supplierReceipt: ReceiptType = {
      id: generateId('rcp-'),
      type: 'supplier',
      title: 'SUPPLIER PAYMENT NOTICE',
      senderName: customerName,
      amount: Number(amount),
      currency: 'USD',
      purpose: purposes.find(p => p.value === purpose)?.label || purpose,
      shipmentRef: shipment.reference,
      date: now,
    };

    const warehouseReceipt: ReceiptType = {
      id: generateId('rcp-'),
      type: 'warehouse',
      title: 'WAREHOUSE COPY',
      senderName: customerName,
      senderPhone: customerPhone,
      amount: Number(amount),
      currency: 'USD',
      purpose: purposes.find(p => p.value === purpose)?.label || purpose,
      shipmentRef: shipment.reference,
      date: now,
    };

    setGeneratedReceipts([customerReceipt, supplierReceipt, warehouseReceipt]);
    onProcessPayment(payment);
    setStep('receipts');
  };

  return (
    <div style={{
      maxWidth: '700px',
      margin: '0 auto',
      background: '#181818',
      border: '1px solid #222',
      borderRadius: '16px',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '20px 24px',
        background: '#141414',
        borderBottom: '1px solid #222',
      }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>
          {step === 'form' && 'Record Payment'}
          {step === 'confirm' && 'Confirm Payment'}
          {step === 'receipts' && 'Payment Complete'}
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7280' }}>
          Shipment: {shipment.reference} · Balance: {formatCurrency(shipment.balance, 'USD')}
        </p>
      </div>

      <div style={{ padding: '24px' }}>
        {step === 'form' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Customer Info */}
            <div style={{
              padding: '16px',
              background: '#141414',
              borderRadius: '10px',
              border: '1px solid #222',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Customer Information
              </h4>
              <InputField label="Customer Name" value={customerName} onChange={setCustomerName} icon={<User size={14} />} />
              <InputField label="Phone Number" value={customerPhone} onChange={setCustomerPhone} icon={<Phone size={14} />} />
            </div>

            {/* Supplier Info */}
            <div style={{
              padding: '16px',
              background: '#141414',
              borderRadius: '10px',
              border: '1px solid #222',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Supplier Information
              </h4>
              <InputField label="Supplier Number *" value={supplierNumber} onChange={setSupplierNumber} icon={<Phone size={14} />} />
              <InputField label="Supplier Name" value={supplierName} onChange={setSupplierName} icon={<Building2 size={14} />} />
            </div>

            {/* Payment Details */}
            <div style={{
              padding: '16px',
              background: '#141414',
              borderRadius: '10px',
              border: '1px solid #222',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Payment Details
              </h4>

              <div>
                <label style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
                  Purpose
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {purposes.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setPurpose(p.value as any)}
                      style={{
                        padding: '10px',
                        background: purpose === p.value ? '#1F3B73' : '#1A1A1A',
                        border: `1px solid ${purpose === p.value ? '#1F3B73' : '#2C2C2C'}`,
                        borderRadius: '8px',
                        color: purpose === p.value ? '#FFFFFF' : '#B3B3B3',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 500,
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <InputField label="Amount *" value={amount} onChange={setAmount} type="number" icon={<DollarSign size={14} />} />
                <div>
                  <label style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
                    Payment Method
                  </label>
                  <select
                    value={method}
                    onChange={e => setMethod(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: '#1A1A1A',
                      border: '1px solid #2C2C2C',
                      borderRadius: '8px',
                      color: '#FFFFFF',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  >
                    {methods.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <InputField label="Reference Number" value={reference} onChange={setReference} icon={<FileText size={14} />} />
              <InputField label="Notes" value={notes} onChange={setNotes} icon={<FileText size={14} />} />
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            <AlertTriangle size={48} color="#FACC15" />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>Confirm Payment</h3>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <ConfirmRow label="Customer" value={customerName} />
              <ConfirmRow label="Phone" value={customerPhone} />
              <ConfirmRow label="Supplier" value={`${supplierNumber} ${supplierName ? `(${supplierName})` : ''}`} />
              <ConfirmRow label="Amount" value={formatCurrency(Number(amount), 'USD')} />
              <ConfirmRow label="Purpose" value={purposes.find(p => p.value === purpose)?.label || ''} />
              <ConfirmRow label="Method" value={methods.find(m => m.value === method)?.label || ''} />
              <ConfirmRow label="Shipment" value={shipment.reference} />
            </div>
          </div>
        )}

        {step === 'receipts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <CheckCircle size={48} color="#4ADE80" />
              <h3 style={{ margin: '12px 0 0', fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>Payment Recorded</h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7280' }}>
                {formatCurrency(Number(amount), 'USD')} · {shipment.reference}
              </p>
            </div>

            <div style={{ fontSize: '13px', color: '#9CA3AF', textAlign: 'center' }}>
              Select receipts to print or download
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {generatedReceipts.map(receipt => (
                <ReceiptCard key={receipt.id} receipt={receipt} onPrint={() => onPrintReceipt(receipt)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '16px 24px',
        background: '#141414',
        borderTop: '1px solid #222',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        {step === 'form' && (
          <>
            <button onClick={() => {}} style={secondaryButtonStyle}>Cancel</button>
            <button
              onClick={() => setStep('confirm')}
              disabled={!customerName || !amount || !supplierNumber}
              style={{
                ...primaryButtonStyle,
                opacity: !customerName || !amount || !supplierNumber ? 0.5 : 1,
                cursor: !customerName || !amount || !supplierNumber ? 'not-allowed' : 'pointer',
              }}
            >
              Review <ChevronRight size={16} />
            </button>
          </>
        )}
        {step === 'confirm' && (
          <>
            <button onClick={() => setStep('form')} style={secondaryButtonStyle}>Back</button>
            <button onClick={confirmPayment} style={primaryButtonStyle}>
              <CheckCircle size={16} /> Confirm & Generate Receipts
            </button>
          </>
        )}
        {step === 'receipts' && (
          <>
            <button onClick={() => setStep('form')} style={secondaryButtonStyle}>New Payment</button>
            <button
              onClick={() => generatedReceipts.forEach(r => onPrintReceipt(r))}
              style={primaryButtonStyle}
            >
              <Printer size={16} /> Print All
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const ReceiptCard: React.FC<{ receipt: ReceiptType; onPrint: () => void }> = ({ receipt, onPrint }) => {
  const [copied, setCopied] = useState(false);

  const copyReceipt = () => {
    const text = `
${receipt.title}
------------------------
Sender: ${receipt.senderName}
${receipt.senderPhone ? `Phone: ${receipt.senderPhone}` : ''}
${receipt.supplierName ? `Supplier: ${receipt.supplierName}` : ''}
${receipt.supplierNumber ? `Supplier Number: ${receipt.supplierNumber}` : ''}
Amount: ${formatCurrency(receipt.amount, receipt.currency)}
Purpose: ${receipt.purpose}
Shipment: ${receipt.shipmentRef}
Date: ${formatDate(receipt.date)}
${receipt.notes ? `Notes: ${receipt.notes}` : ''}
    `.trim();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '10px',
      padding: '20px',
      color: '#1F1F1F',
      fontFamily: 'monospace',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, textTransform: 'uppercase' }}>{receipt.title}</h4>
        <span style={{ fontSize: '11px', color: '#6B7280' }}>{receipt.type}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
        <div><strong>Sender:</strong> {receipt.senderName}</div>
        {receipt.senderPhone && <div><strong>Phone:</strong> {receipt.senderPhone}</div>}
        {receipt.supplierName && <div><strong>Supplier:</strong> {receipt.supplierName}</div>}
        {receipt.supplierNumber && <div><strong>Supplier #:</strong> {receipt.supplierNumber}</div>}
        <div><strong>Amount:</strong> {formatCurrency(receipt.amount, receipt.currency)}</div>
        <div><strong>Purpose:</strong> {receipt.purpose}</div>
        <div><strong>Shipment:</strong> {receipt.shipmentRef}</div>
        <div><strong>Date:</strong> {formatDate(receipt.date)}</div>
        {receipt.notes && <div><strong>Notes:</strong> {receipt.notes}</div>}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
        <button onClick={onPrint} style={{
          flex: 1,
          padding: '8px',
          background: '#1F1F1F',
          border: 'none',
          borderRadius: '6px',
          color: '#FFFFFF',
          fontSize: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
        }}>
          <Printer size={12} /> Print
        </button>
        <button onClick={copyReceipt} style={{
          flex: 1,
          padding: '8px',
          background: '#F3F4F6',
          border: 'none',
          borderRadius: '6px',
          color: '#1F1F1F',
          fontSize: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
        }}>
          <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
};

const InputField: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
  icon?: React.ReactNode;
  type?: string;
}> = ({ label, value, onChange, icon, type = 'text' }) => (
  <div>
    <label style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
      {label}
    </label>
    <div style={{ position: 'relative' }}>
      {icon && <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }}>{icon}</span>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: icon ? '10px 12px 10px 38px' : '10px 12px',
          background: '#1A1A1A',
          border: '1px solid #2C2C2C',
          borderRadius: '8px',
          color: '#FFFFFF',
          fontSize: '14px',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  </div>
);

const ConfirmRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1A1A1A' }}>
    <span style={{ fontSize: '13px', color: '#9CA3AF' }}>{label}</span>
    <span style={{ fontSize: '13px', color: '#FFFFFF', fontWeight: 500 }}>{value}</span>
  </div>
);

const primaryButtonStyle: React.CSSProperties = {
  padding: '10px 18px',
  background: '#1F3B73',
  border: 'none',
  borderRadius: '8px',
  color: '#FFFFFF',
  fontSize: '14px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontWeight: 600,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '10px 18px',
  background: 'transparent',
  border: '1px solid #2C2C2C',
  borderRadius: '8px',
  color: '#B3B3B3',
  fontSize: '14px',
  cursor: 'pointer',
};

export default CargoPaymentWorkflow;
