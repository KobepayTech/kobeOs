// ============================================================================
// CARGO SHIPMENT CREATION
// ============================================================================
// Multi-step shipment creation with:
// - Customer info (auto/search)
// - Multi-supplier allocation (crucial for China-Tanzania logistics)
// - Purpose selection (Deposit, Balance, Full Payment, Shipping, Customs)
// - Auto QR generation
// ============================================================================

import React, { useState } from 'react';
import {
  Plus, X, ChevronRight, ChevronLeft, CheckCircle, QrCode,
  User, Phone, Building2, MapPin, Package, DollarSign, FileText
} from 'lucide-react';
import type { Shipment, SupplierAllocation } from '@/shared/types';
import { generateShipmentRef, generateQRData, generateId, formatCurrency } from '@/shared/utils';

interface ShipmentCreationProps {
  onCreate: (shipment: Shipment) => void;
  onCancel: () => void;
  currency?: string;
}

type Step = 'customer' | 'suppliers' | 'details' | 'payment' | 'confirm';

export const ShipmentCreation: React.FC<ShipmentCreationProps> = ({
  onCreate,
  onCancel,
  currency = 'TZS',
}) => {
  const [step, setStep] = useState<Step>('customer');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [suppliers, setSuppliers] = useState<SupplierAllocation[]>([]);
  const [origin, setOrigin] = useState('China');
  const [destination, setDestination] = useState('Tanzania');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [value, setValue] = useState('');
  const [purpose, setPurpose] = useState<'deposit' | 'balance' | 'full-payment' | 'shipping' | 'customs'>('deposit');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const addSupplier = () => {
    const newSupplier: SupplierAllocation = {
      id: generateId('sup-'),
      supplierNumber: '',
      supplierName: '',
      supplierCity: 'guangzhou',
      platform: 'alibaba',
      amount: 0,
      items: '',
      status: 'pending',
    };
    setSuppliers([...suppliers, newSupplier]);
  };

  const updateSupplier = (id: string, field: keyof SupplierAllocation, val: string | number) => {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s));
  };

  const removeSupplier = (id: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
  };

  const totalSupplierAmount = suppliers.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  const canProceed = () => {
    if (step === 'customer') return customerName && customerPhone;
    if (step === 'suppliers') return suppliers.length > 0 && suppliers.every(s => s.supplierNumber);
    if (step === 'details') return origin && destination;
    if (step === 'payment') return amount && Number(amount) > 0;
    return true;
  };

  const submit = () => {
    const shipmentId = generateId('shp-');
    const ref = generateShipmentRef();
    const qrData = generateQRData(shipmentId);

    const shipment: Shipment = {
      id: shipmentId,
      reference: ref,
      qrCode: qrData,
      qrData,
      customerId: generateId('cust-'),
      customerName,
      customerPhone,
      customerEmail: customerEmail || undefined,
      suppliers,
      stage: 'created',
      status: 'active',
      origin,
      destination,
      weight: weight ? Number(weight) : undefined,
      dimensions: dimensions || undefined,
      description: description || undefined,
      value: value ? Number(value) : undefined,
      payments: [],
      totalAmount: Number(amount),
      paidAmount: 0,
      balance: Number(amount),
      purpose,
      trackingEvents: [{
        id: generateId('evt-'),
        shipmentId,
        stage: 'created',
        location: origin,
        notes: 'Shipment created',
        timestamp: new Date().toISOString(),
      }],
      notifications: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onCreate(shipment);
  };

  const steps: { id: Step; label: string; icon: React.ReactNode }[] = [
    { id: 'customer', label: 'Customer', icon: <User size={16} /> },
    { id: 'suppliers', label: 'Suppliers', icon: <Building2 size={16} /> },
    { id: 'details', label: 'Details', icon: <Package size={16} /> },
    { id: 'payment', label: 'Payment', icon: <DollarSign size={16} /> },
    { id: 'confirm', label: 'Confirm', icon: <CheckCircle size={16} /> },
  ];

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      background: '#181818',
      border: '1px solid #222',
      borderRadius: '16px',
      overflow: 'hidden',
    }}>
      {/* Stepper */}
      <div style={{
        display: 'flex',
        padding: '20px 24px',
        background: '#141414',
        borderBottom: '1px solid #222',
        gap: '4px',
      }}>
        {steps.map((s, idx) => {
          const isActive = s.id === step;
          const isDone = steps.findIndex(x => x.id === step) > idx;
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isActive ? '#1F3B73' : isDone ? '#0A3D1F' : '#1A1A1A',
                color: isActive ? '#FFFFFF' : isDone ? '#4ADE80' : '#6B7280',
                border: `2px solid ${isActive ? '#1F3B73' : isDone ? '#166534' : '#2C2C2C'}`,
                fontSize: '14px',
                fontWeight: 700,
              }}>
                {isDone ? <CheckCircle size={16} /> : s.icon}
              </div>
              <span style={{
                fontSize: '13px',
                fontWeight: 600,
                color: isActive ? '#FFFFFF' : isDone ? '#B3B3B3' : '#6B7280',
              }}>
                {s.label}
              </span>
              {idx < steps.length - 1 && (
                <ChevronRight size={14} color="#2C2C2C" />
              )}
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ padding: '24px' }}>
        {step === 'customer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#FFFFFF' }}>Customer Information</h3>
            <InputField label="Customer Name *" value={customerName} onChange={setCustomerName} icon={<User size={14} />} />
            <InputField label="Phone Number *" value={customerPhone} onChange={setCustomerPhone} icon={<Phone size={14} />} type="tel" />
            <InputField label="Email" value={customerEmail} onChange={setCustomerEmail} icon={<FileText size={14} />} type="email" />
            <InputField label="Customer ID (Optional)" value={customerId} onChange={setCustomerId} icon={<FileText size={14} />} />
          </div>
        )}

        {step === 'suppliers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#FFFFFF' }}>Supplier Allocations</h3>
              <button
                onClick={addSupplier}
                style={{
                  padding: '8px 14px',
                  background: '#1F3B73',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Plus size={14} /> Add Supplier
              </button>
            </div>

            {suppliers.map((supplier, idx) => (
              <div key={supplier.id} style={{
                padding: '16px',
                background: '#141414',
                border: '1px solid #222',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>Supplier {idx + 1}</span>
                  <button
                    onClick={() => removeSupplier(supplier.id)}
                    style={{
                      padding: '4px',
                      background: 'transparent',
                      border: 'none',
                      color: '#F87171',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <InputField
                    label="Supplier Number *"
                    value={supplier.supplierNumber}
                    onChange={v => updateSupplier(supplier.id, 'supplierNumber', v)}
                    icon={<Phone size={14} />}
                  />
                  <InputField
                    label="Supplier Name"
                    value={supplier.supplierName || ''}
                    onChange={v => updateSupplier(supplier.id, 'supplierName', v)}
                    icon={<Building2 size={14} />}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <select
                    value={supplier.supplierCity}
                    onChange={e => updateSupplier(supplier.id, 'supplierCity', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="guangzhou">Guangzhou</option>
                    <option value="yiwu">Yiwu</option>
                    <option value="shenzhen">Shenzhen</option>
                    <option value="other">Other</option>
                  </select>
                  <select
                    value={supplier.platform}
                    onChange={e => updateSupplier(supplier.id, 'platform', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="alibaba">Alibaba</option>
                    <option value="1688">1688</option>
                    <option value="wechat">WeChat</option>
                    <option value="other">Other</option>
                  </select>
                  <InputField
                    label="Amount"
                    value={String(supplier.amount)}
                    onChange={v => updateSupplier(supplier.id, 'amount', Number(v))}
                    type="number"
                    icon={<DollarSign size={14} />}
                  />
                </div>
                <InputField
                  label="Items Description"
                  value={supplier.items}
                  onChange={v => updateSupplier(supplier.id, 'items', v)}
                  icon={<Package size={14} />}
                />
              </div>
            ))}

            {suppliers.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px', color: '#6B7280' }}>
                <Building2 size={32} style={{ marginBottom: '8px' }} />
                <p>Add at least one supplier to continue</p>
              </div>
            )}

            {suppliers.length > 0 && (
              <div style={{
                padding: '12px 16px',
                background: '#0F1115',
                borderRadius: '8px',
                border: '1px solid #222',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: '14px', color: '#9CA3AF' }}>Total Supplier Amount</span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#FACC15' }}>
                  {formatCurrency(totalSupplierAmount, currency)}
                </span>
              </div>
            )}
          </div>
        )}

        {step === 'details' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#FFFFFF' }}>Shipment Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <InputField label="Origin *" value={origin} onChange={setOrigin} icon={<MapPin size={14} />} />
              <InputField label="Destination *" value={destination} onChange={setDestination} icon={<MapPin size={14} />} />
            </div>
            <InputField label="Description" value={description} onChange={setDescription} icon={<FileText size={14} />} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <InputField label="Weight (kg)" value={weight} onChange={setWeight} type="number" icon={<Package size={14} />} />
              <InputField label="Dimensions" value={dimensions} onChange={setDimensions} icon={<Package size={14} />} />
              <InputField label="Declared Value" value={value} onChange={setValue} type="number" icon={<DollarSign size={14} />} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                placeholder="Any special instructions..."
              />
            </div>
          </div>
        )}

        {step === 'payment' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#FFFFFF' }}>Payment Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Purpose</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { value: 'deposit', label: 'Deposit' },
                  { value: 'balance', label: 'Balance Payment' },
                  { value: 'full-payment', label: 'Full Payment' },
                  { value: 'shipping', label: 'Shipping Fee' },
                  { value: 'customs', label: 'Customs Fee' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPurpose(opt.value as any)}
                    style={{
                      padding: '12px',
                      background: purpose === opt.value ? '#1F3B73' : '#1A1A1A',
                      border: `1px solid ${purpose === opt.value ? '#1F3B73' : '#2C2C2C'}`,
                      borderRadius: '8px',
                      color: purpose === opt.value ? '#FFFFFF' : '#B3B3B3',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <InputField
              label="Payment Amount *"
              value={amount}
              onChange={setAmount}
              type="number"
              icon={<DollarSign size={14} />}
            />
          </div>
        )}

        {step === 'confirm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#0A3D1F',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <CheckCircle size={32} color="#4ADE80" />
            </div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>Review Shipment</h3>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <ReviewRow label="Customer" value={`${customerName} (${customerPhone})`} />
              <ReviewRow label="Suppliers" value={`${suppliers.length} suppliers · ${formatCurrency(totalSupplierAmount, currency)}`} />
              <ReviewRow label="Route" value={`${origin} → ${destination}`} />
              <ReviewRow label="Purpose" value={purpose.replace('-', ' ')} />
              <ReviewRow label="Amount" value={formatCurrency(Number(amount), currency)} />
              <ReviewRow label="QR Code" value="Will be generated automatically" />
            </div>

            <div style={{
              padding: '16px',
              background: '#0F1115',
              borderRadius: '10px',
              border: '1px solid #222',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
            }}>
              <QrCode size={24} color="#60A5FA" />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>QR Tracking Enabled</div>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>Each package gets a unique QR code for warehouse scanning</div>
              </div>
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
        <button
          onClick={step === 'customer' ? onCancel : () => {
            const prev = steps[steps.findIndex(s => s.id === step) - 1];
            if (prev) setStep(prev.id);
          }}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: '1px solid #2C2C2C',
            borderRadius: '8px',
            color: '#B3B3B3',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <ChevronLeft size={16} /> {step === 'customer' ? 'Cancel' : 'Back'}
        </button>

        <button
          onClick={() => {
            if (step === 'confirm') {
              submit();
            } else {
              const next = steps[steps.findIndex(s => s.id === step) + 1];
              if (next) setStep(next.id);
            }
          }}
          disabled={!canProceed()}
          style={{
            padding: '10px 18px',
            background: canProceed() ? '#1F3B73' : '#1A1A1A',
            border: 'none',
            borderRadius: '8px',
            color: canProceed() ? '#FFFFFF' : '#5A5A5A',
            fontSize: '14px',
            cursor: canProceed() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 600,
          }}
        >
          {step === 'confirm' ? 'Create Shipment' : 'Next'} <ChevronRight size={16} />
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

const ReviewRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1A1A1A' }}>
    <span style={{ fontSize: '13px', color: '#9CA3AF' }}>{label}</span>
    <span style={{ fontSize: '13px', color: '#FFFFFF', fontWeight: 500, textAlign: 'right' }}>{value}</span>
  </div>
);

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: '#1A1A1A',
  border: '1px solid #2C2C2C',
  borderRadius: '8px',
  color: '#FFFFFF',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

export default ShipmentCreation;
