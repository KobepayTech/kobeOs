// ============================================================================
// CARGO SHIPMENT CREATION
// ============================================================================
// Multi-step shipment creation with:
// - Customer info (auto/search)
// - Multi-supplier allocation (crucial for China-Tanzania logistics)
// - Purpose selection (Deposit, Balance, Full Payment, Shipping, Customs)
// - Auto QR generation via qrcode.react
// ============================================================================

import React, { useState } from 'react';
import {
  Plus, X, ChevronRight, ChevronLeft, CheckCircle, QrCode,
  User, Phone, Building2, MapPin, Package, DollarSign, FileText
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Shipment, SupplierAllocation } from '@/shared/types';
import { formatCurrency } from '@/shared/utils';
import { api } from '@/lib/api';

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
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
  const [qrData, setQrData] = useState('');

  const addSupplier = () => {
    const newSupplier: SupplierAllocation = {
      id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      customerName,
      customerPhone,
      customerEmail,
      origin,
      destination,
      description,
      weight: weight ? parseFloat(weight) : undefined,
      dimensions,
      value: value ? parseFloat(value) : undefined,
      purpose,
      amount: parseFloat(amount),
      notes,
      supplierAllocations: suppliers,
    };

    try {
      const created = await api<Shipment>('/cargo/shipments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setQrData(created.qrData || created.id);
      onCreate(created);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create shipment');
    } finally {
      setSubmitting(false);
    }
  };

  const steps: { id: Step; label: string; icon: React.ReactNode }[] = [
    { id: 'customer', label: 'Customer', icon: <User size={16} /> },
    { id: 'suppliers', label: 'Suppliers', icon: <Building2 size={16} /> },
    { id: 'details', label: 'Details', icon: <Package size={16} /> },
    { id: 'payment', label: 'Payment', icon: <DollarSign size={16} /> },
    { id: 'confirm', label: 'Confirm', icon: <CheckCircle size={16} /> },
  ];

  const activeIdx = steps.findIndex(s => s.id === step);

  return (
    <div className="h-full flex relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #E8E4F3 0%, #C9D6FF 50%, #E8E4F3 100%)' }}>
      <BokehBackground />
      <div className="relative z-10 flex-1 flex flex-col items-center overflow-y-auto p-4">
        <div style={{
          maxWidth: '800px',
          width: '100%',
          background: 'rgba(255,255,255,0.30)',
          border: '1px solid rgba(255,255,255,0.40)',
          borderRadius: '20px',
          overflow: 'hidden',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        }}>
          {/* Stepper */}
          <div style={{
            display: 'flex',
            padding: '20px 24px',
            background: 'rgba(255,255,255,0.40)',
            borderBottom: '1px solid rgba(255,255,255,0.40)',
            gap: '4px',
          }}>
            {steps.map((s, idx) => {
              const isActive = s.id === step;
              const isDone = activeIdx > idx;
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive ? '#3B82F6' : isDone ? '#10B981' : 'rgba(255,255,255,0.50)',
                    color: isActive ? '#FFFFFF' : isDone ? '#FFFFFF' : '#94A3B8',
                    border: `2px solid ${isActive ? '#3B82F6' : isDone ? '#10B981' : 'rgba(255,255,255,0.40)'}`,
                    fontSize: '14px',
                    fontWeight: 700,
                  }}>
                    {isDone ? <CheckCircle size={16} /> : s.icon}
                  </div>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: isActive ? '#334155' : isDone ? '#475569' : '#94A3B8',
                  }}>
                    {s.label}
                  </span>
                  {idx < steps.length - 1 && (
                    <ChevronRight size={14} color="#CBD5E1" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Content */}
          <div style={{ padding: '24px' }}>
            {submitError && (
              <div style={{
                marginBottom: '16px',
                padding: '12px 16px',
                background: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.20)',
                borderRadius: '12px',
                color: '#DC2626',
                fontSize: '13px',
              }}>
                {submitError}
              </div>
            )}

            {step === 'customer' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#334155' }}>Customer Information</h3>
                <InputField label="Customer Name *" value={customerName} onChange={setCustomerName} icon={<User size={14} />} />
                <InputField label="Phone Number *" value={customerPhone} onChange={setCustomerPhone} icon={<Phone size={14} />} type="tel" />
                <InputField label="Email" value={customerEmail} onChange={setCustomerEmail} icon={<FileText size={14} />} type="email" />
                <InputField label="Customer ID (Optional)" value={customerId} onChange={setCustomerId} icon={<FileText size={14} />} />
              </div>
            )}

            {step === 'suppliers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#334155' }}>Supplier Allocations</h3>
                  <button
                    onClick={addSupplier}
                    style={{
                      padding: '8px 14px',
                      background: '#3B82F6',
                      border: 'none',
                      borderRadius: '10px',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 500,
                    }}
                  >
                    <Plus size={14} /> Add Supplier
                  </button>
                </div>

                {suppliers.map((supplier, idx) => (
                  <div key={supplier.id} style={{
                    padding: '16px',
                    background: 'rgba(255,255,255,0.40)',
                    border: '1px solid rgba(255,255,255,0.40)',
                    borderRadius: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    backdropFilter: 'blur(16px)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Supplier {idx + 1}</span>
                      <button
                        onClick={() => removeSupplier(supplier.id)}
                        style={{
                          padding: '4px',
                          background: 'transparent',
                          border: 'none',
                          color: '#EF4444',
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
                  <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
                    <Building2 size={32} style={{ marginBottom: '8px' }} />
                    <p>Add at least one supplier to continue</p>
                  </div>
                )}

                {suppliers.length > 0 && (
                  <div style={{
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.40)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.40)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '14px', color: '#64748B' }}>Total Supplier Amount</span>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: '#D97706' }}>
                      {formatCurrency(totalSupplierAmount, currency)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {step === 'details' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#334155' }}>Shipment Details</h3>
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
                  <label style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</label>
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
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#334155' }}>Payment Information</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Purpose</label>
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
                          background: purpose === opt.value ? '#3B82F6' : 'rgba(255,255,255,0.50)',
                          border: `1px solid ${purpose === opt.value ? '#3B82F6' : 'rgba(255,255,255,0.40)'}`,
                          borderRadius: '10px',
                          color: purpose === opt.value ? '#FFFFFF' : '#475569',
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
                  background: '#10B981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <CheckCircle size={32} color="#FFFFFF" />
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#334155' }}>Review Shipment</h3>

                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <ReviewRow label="Customer" value={`${customerName} (${customerPhone})`} />
                  <ReviewRow label="Suppliers" value={`${suppliers.length} suppliers · ${formatCurrency(totalSupplierAmount, currency)}`} />
                  <ReviewRow label="Route" value={`${origin} → ${destination}`} />
                  <ReviewRow label="Purpose" value={purpose.replace('-', ' ')} />
                  <ReviewRow label="Amount" value={formatCurrency(Number(amount), currency)} />
                  <ReviewRow label="QR Code" value="Will be generated automatically" />
                </div>

                {/* QR Code Preview */}
                <div style={{
                  padding: '16px',
                  background: 'rgba(255,255,255,0.50)',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.40)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  width: '100%',
                }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    background: '#FFFFFF',
                    borderRadius: '10px',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <QRCodeSVG
                      value={qrData || `shipment-${Date.now()}`}
                      size={64}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>QR Tracking Enabled</div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Each package gets a unique QR code for warehouse scanning</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            background: 'rgba(255,255,255,0.40)',
            borderTop: '1px solid rgba(255,255,255,0.40)',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <button
              onClick={step === 'customer' ? onCancel : () => {
                const prev = steps[steps.findIndex(s => s.id === step) - 1];
                if (prev) setStep(prev.id);
              }}
              disabled={submitting}
              style={{
                padding: '10px 18px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.40)',
                borderRadius: '10px',
                color: '#64748B',
                fontSize: '14px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: submitting ? 0.5 : 1,
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
              disabled={!canProceed() || submitting}
              style={{
                padding: '10px 18px',
                background: canProceed() && !submitting ? '#3B82F6' : 'rgba(148,163,184,0.30)',
                border: 'none',
                borderRadius: '10px',
                color: canProceed() && !submitting ? '#FFFFFF' : '#94A3B8',
                fontSize: '14px',
                cursor: canProceed() && !submitting ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
              }}
            >
              {step === 'confirm' ? (submitting ? 'Creating...' : 'Create Shipment') : 'Next'} <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function BokehBackground() {
  const orbs = [
    { x: 15, y: 20, size: 320, color: 'rgba(180,170,230,0.35)', blur: 90 },
    { x: 75, y: 15, size: 280, color: 'rgba(200,180,240,0.30)', blur: 100 },
    { x: 50, y: 60, size: 380, color: 'rgba(160,190,250,0.28)', blur: 110 },
    { x: 85, y: 75, size: 240, color: 'rgba(190,160,235,0.30)', blur: 80 },
    { x: 25, y: 80, size: 300, color: 'rgba(170,180,245,0.25)', blur: 95 },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {orbs.map((orb, i) => (
        <div key={i} className="absolute rounded-full animate-float" style={{
          left: `${orb.x}%`, top: `${orb.y}%`, width: orb.size, height: orb.size,
          background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
          filter: `blur(${orb.blur}px)`, animationDelay: `${i * 1.5}s`, animationDuration: `${12 + i * 2}s`,
          transform: 'translate(-50%, -50%)',
        }} />
      ))}
    </div>
  );
}

const InputField: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
  icon?: React.ReactNode;
  type?: string;
}> = ({ label, value, onChange, icon, type = 'text' }) => (
  <div>
    <label style={{ fontSize: '12px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
      {label}
    </label>
    <div style={{ position: 'relative' }}>
      {icon && <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>{icon}</span>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: icon ? '10px 12px 10px 38px' : '10px 12px',
          background: 'rgba(255,255,255,0.50)',
          border: '1px solid rgba(255,255,255,0.40)',
          borderRadius: '10px',
          color: '#334155',
          fontSize: '14px',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  </div>
);

const ReviewRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.30)' }}>
    <span style={{ fontSize: '13px', color: '#64748B' }}>{label}</span>
    <span style={{ fontSize: '13px', color: '#334155', fontWeight: 500, textAlign: 'right' }}>{value}</span>
  </div>
);

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'rgba(255,255,255,0.50)',
  border: '1px solid rgba(255,255,255,0.40)',
  borderRadius: '10px',
  color: '#334155',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

export default ShipmentCreation;
