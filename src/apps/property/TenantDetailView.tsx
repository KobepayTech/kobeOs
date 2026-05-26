// ============================================================================
// TENANT DETAIL VIEW
// ============================================================================
// Enterprise-grade tenant detail page with:
// - QR Code Payment (dynamic, regenerates with remaining balance)
// - Compact Payment Timeline
// - Transaction History
// - Quick Actions (Record Payment, Send Reminder, Download Invoice, WhatsApp)
// - Right Sidebar Analytics
// ============================================================================

import React, { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft, Phone, Mail, Calendar, FileText, Download, MessageSquare,
  Bell, CreditCard, Receipt, CheckCircle, XCircle, Clock, AlertTriangle,
  TrendingUp, Home, Copy, Share2, Printer, Edit3, Trash2, ChevronRight,
  Wallet, Percent, Users
} from 'lucide-react';
import type { Tenant, PaymentRecord } from '@/shared/types';
import { formatCurrency, formatDate, formatDateTime, getStatusColor } from '@/shared/utils';

interface TenantDetailViewProps {
  tenant: Tenant;
  onBack: () => void;
  onRecordPayment: (tenantId: string) => void;
  onSendReminder: (tenantId: string) => void;
  onDownloadInvoice: (tenantId: string) => void;
  onGenerateReceipt: (paymentId: string) => void;
  onWhatsApp: (tenantId: string) => void;
  onEdit: (tenantId: string) => void;
}

const PaymentTimeline: React.FC<{ payments: PaymentRecord[]; monthlyRent: number; currency: string }> = ({ payments, monthlyRent, currency }) => {
  const months = useMemo(() => {
    const result: { month: string; label: string; paid: boolean; partial: boolean; amount: number; date?: string }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthPayments = payments.filter(p => p.month === monthKey && p.status === 'completed');
      const totalPaid = monthPayments.reduce((sum, p) => sum + p.amount, 0);
      result.push({
        month: monthKey,
        label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        paid: totalPaid >= monthlyRent,
        partial: totalPaid > 0 && totalPaid < monthlyRent,
        amount: totalPaid,
        date: monthPayments[0]?.date,
      });
    }
    return result;
  }, [payments, monthlyRent]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
        Payment Timeline (Last 12 Months)
      </h3>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {months.map(m => (
          <div
            key={m.month}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: m.paid ? '#0A3D1F' : m.partial ? '#422006' : '#1F1F1F',
              border: `1px solid ${m.paid ? '#166534' : m.partial ? '#854D0E' : '#2C2C2C'}`,
              minWidth: '60px',
            }}
            title={m.paid ? `Paid: ${formatCurrency(m.amount, currency)}` : m.partial ? `Partial: ${formatCurrency(m.amount, currency)}` : 'Unpaid'}
          >
            <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500 }}>{m.label}</span>
            <span style={{ fontSize: '16px' }}>
              {m.paid ? <CheckCircle size={16} color="#4ADE80" /> : m.partial ? <Clock size={16} color="#FACC15" /> : <XCircle size={16} color="#6B7280" />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const TransactionHistory: React.FC<{ payments: PaymentRecord[]; currency: string }> = ({ payments, currency }) => {
  if (payments.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280', fontSize: '14px' }}>
        No payment transactions yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
        Transaction History
      </h3>
      <div style={{ border: '1px solid #222', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#141414', borderBottom: '1px solid #222' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 500, fontSize: '11px' }}>DATE</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 500, fontSize: '11px' }}>MONTH</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: '#6B7280', fontWeight: 500, fontSize: '11px' }}>AMOUNT</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 500, fontSize: '11px' }}>METHOD</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 500, fontSize: '11px' }}>REFERENCE</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', color: '#6B7280', fontWeight: 500, fontSize: '11px' }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {payments.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(payment => (
              <tr key={payment.id} style={{ borderBottom: '1px solid #1A1A1A' }}>
                <td style={{ padding: '10px 12px', color: '#B3B3B3' }}>{formatDate(payment.date)}</td>
                <td style={{ padding: '10px 12px', color: '#B3B3B3' }}>{payment.month}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#4ADE80', fontWeight: 500 }}>{formatCurrency(payment.amount, currency)}</td>
                <td style={{ padding: '10px 12px', color: '#B3B3B3' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: '#1A1A1A',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                  }}>
                    {payment.method}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', color: '#9CA3AF', fontFamily: 'monospace', fontSize: '12px' }}>{payment.reference}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  {payment.status === 'completed' ? (
                    <CheckCircle size={14} color="#4ADE80" />
                  ) : payment.status === 'pending' ? (
                    <Clock size={14} color="#FACC15" />
                  ) : (
                    <XCircle size={14} color="#F87171" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const TenantDetailView: React.FC<TenantDetailViewProps> = ({
  tenant,
  onBack,
  onRecordPayment,
  onSendReminder,
  onDownloadInvoice,
  onGenerateReceipt,
  onWhatsApp,
  onEdit,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const statusColors = getStatusColor(tenant.status);

  const qrPaymentUrl = useMemo(() => {
    // Dynamic QR that includes current balance
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://kobeos.app';
    return `${baseUrl}/pay?tenant=${tenant.shortCode}&amount=${tenant.balance}&ref=${tenant.id}`;
  }, [tenant.shortCode, tenant.balance, tenant.id]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(qrPaymentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const paymentConsistency = useMemo(() => {
    const completed = tenant.paymentHistory.filter(p => p.status === 'completed').length;
    const total = tenant.paymentHistory.length || 1;
    return Math.round((completed / total) * 100);
  }, [tenant.paymentHistory]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onBack}
            style={{
              padding: '8px',
              background: '#1A1A1A',
              border: '1px solid #2C2C2C',
              borderRadius: '8px',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>{tenant.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                background: statusColors.bg,
                color: statusColors.text,
                border: `1px solid ${statusColors.border}`,
                textTransform: 'uppercase',
              }}>
                {tenant.status.replace('-', ' ')}
              </span>
              {tenant.status === 'overdue' && (
                <span style={{ fontSize: '13px', color: '#F87171', fontWeight: 500 }}>
                  {tenant.daysOverdue} days overdue — {formatCurrency(tenant.balance, tenant.currency)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => onEdit(tenant.id)} style={actionButtonStyle}><Edit3 size={14} /> Edit</button>
          <button onClick={() => onWhatsApp(tenant.id)} style={actionButtonStyle}><MessageSquare size={14} /> WhatsApp</button>
          <button onClick={() => onSendReminder(tenant.id)} style={actionButtonStyle}><Bell size={14} /> Reminder</button>
          <button onClick={() => onRecordPayment(tenant.id)} style={{ ...actionButtonStyle, background: '#0A3D1F', color: '#4ADE80', borderColor: '#166534' }}>
            <CreditCard size={14} /> Record Payment
          </button>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 280px', gap: '20px' }}>
        {/* LEFT: Tenant Profile */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={cardStyle}>
            <h3 style={sectionTitleStyle}>Tenant Profile</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <InfoRow icon={<Phone size={14} />} label="Phone" value={tenant.phone} />
              {tenant.email && <InfoRow icon={<Mail size={14} />} label="Email" value={tenant.email} />}
              <InfoRow icon={<Home size={14} />} label="Unit" value={tenant.unit} />
              <InfoRow icon={<Calendar size={14} />} label="Lease Start" value={formatDate(tenant.leaseStart)} />
              <InfoRow icon={<Calendar size={14} />} label="Lease End" value={formatDate(tenant.leaseEnd)} />
              <InfoRow icon={<FileText size={14} />} label="Short Code" value={tenant.shortCode} />
              <InfoRow icon={<Wallet size={14} />} label="Monthly Rent" value={formatCurrency(tenant.monthlyRent, tenant.currency)} />
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={sectionTitleStyle}>Notes</h3>
            <p style={{ color: '#B3B3B3', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
              {tenant.notes || 'No notes added.'}
            </p>
          </div>
        </div>

        {/* CENTER: Payments + QR + Timeline + Transactions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Annual Summary */}
          <div style={cardStyle}>
            <h3 style={sectionTitleStyle}>Annual Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <SummaryBox label="Total Expected" value={formatCurrency(tenant.totalExpected, tenant.currency)} color="#FFFFFF" />
              <SummaryBox label="Total Paid" value={formatCurrency(tenant.paidAmount, tenant.currency)} color="#4ADE80" />
              <SummaryBox label="Balance" value={formatCurrency(tenant.balance, tenant.currency)} color={tenant.balance > 0 ? '#F87171' : '#4ADE80'} />
            </div>
          </div>

          {/* QR Code Payment */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ ...sectionTitleStyle, margin: 0 }}>QR Payment</h3>
              <span style={{ fontSize: '12px', color: '#6B7280' }}>Scan to pay remaining balance</span>
            </div>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              <div style={{
                padding: '16px',
                background: '#FFFFFF',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}>
                <QRCodeSVG value={qrPaymentUrl} size={160} level="H" />
                <span style={{ fontSize: '11px', color: '#374151', fontWeight: 600 }}>Scan to Pay</span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  padding: '16px',
                  background: '#0F1115',
                  borderRadius: '10px',
                  border: '1px solid #222',
                }}>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Amount Due</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: tenant.balance > 0 ? '#F87171' : '#4ADE80' }}>
                    {formatCurrency(tenant.balance, tenant.currency)}
                  </div>
                  {tenant.balance > 0 && (
                    <div style={{ fontSize: '12px', color: '#FACC15', marginTop: '4px' }}>
                      Due: {formatDate(tenant.nextDueDate)}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleCopyLink} style={{ ...smallButtonStyle, flex: 1 }}>
                    <Copy size={14} /> {copiedLink ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button style={{ ...smallButtonStyle, flex: 1 }}>
                    <Share2 size={14} /> Share
                  </button>
                  <button style={{ ...smallButtonStyle, flex: 1 }}>
                    <Printer size={14} /> Print
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
                  QR updates automatically when balance changes. Partial payments will regenerate with remaining amount.
                </p>
              </div>
            </div>
          </div>

          {/* Payment Timeline */}
          <PaymentTimeline payments={tenant.paymentHistory} monthlyRent={tenant.monthlyRent} currency={tenant.currency} />

          {/* Transaction History */}
          <TransactionHistory payments={tenant.paymentHistory} currency={tenant.currency} />
        </div>

        {/* RIGHT: Analytics + Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={cardStyle}>
            <h3 style={sectionTitleStyle}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ActionButton icon={<CreditCard size={16} />} label="Record Payment" color="#4ADE80" onClick={() => onRecordPayment(tenant.id)} />
              <ActionButton icon={<Receipt size={16} />} label="Download Invoice" color="#60A5FA" onClick={() => onDownloadInvoice(tenant.id)} />
              <ActionButton icon={<Bell size={16} />} label="Send Reminder" color="#FACC15" onClick={() => onSendReminder(tenant.id)} />
              <ActionButton icon={<MessageSquare size={16} />} label="WhatsApp Tenant" color="#25D366" onClick={() => onWhatsApp(tenant.id)} />
              <ActionButton icon={<FileText size={16} />} label="View Lease" color="#A78BFA" onClick={() => {}} />
              <ActionButton icon={<Trash2 size={16} />} label="Terminate Lease" color="#F87171" onClick={() => {}} />
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={sectionTitleStyle}>Analytics</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <AnalyticsRow label="Payment Consistency" value={`${paymentConsistency}%`} icon={<Percent size={14} />} />
              <AnalyticsRow label="Occupancy Rate" value="100%" icon={<Home size={14} />} />
              <AnalyticsRow label="Late Payment History" value={`${tenant.daysOverdue > 0 ? tenant.daysOverdue + ' days' : 'None'}`} icon={<AlertTriangle size={14} />} color={tenant.daysOverdue > 0 ? '#F87171' : '#4ADE80'} />
              <AnalyticsRow label="Lease Expiry" value={formatDate(tenant.leaseEnd)} icon={<Calendar size={14} />} />
              <AnalyticsRow label="Total Payments" value={`${tenant.paymentHistory.length}`} icon={<TrendingUp size={14} />} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Sub-components ---

const cardStyle: React.CSSProperties = {
  background: '#181818',
  border: '1px solid #222',
  borderRadius: '12px',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#9CA3AF',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  margin: 0,
};

const actionButtonStyle: React.CSSProperties = {
  padding: '8px 14px',
  background: '#1A1A1A',
  border: '1px solid #2C2C2C',
  borderRadius: '8px',
  color: '#FFFFFF',
  fontSize: '13px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const smallButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: '#1A1A1A',
  border: '1px solid #2C2C2C',
  borderRadius: '8px',
  color: '#B3B3B3',
  fontSize: '12px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
};

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <span style={{ color: '#6B7280' }}>{icon}</span>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: '14px', color: '#FFFFFF', fontWeight: 500 }}>{value}</div>
    </div>
  </div>
);

const SummaryBox: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ textAlign: 'center', padding: '12px', background: '#0F1115', borderRadius: '8px', border: '1px solid #222' }}>
    <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '18px', fontWeight: 700, color }}>{value}</div>
  </div>
);

const ActionButton: React.FC<{ icon: React.ReactNode; label: string; color: string; onClick: () => void }> = ({ icon, label, color, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 14px',
      background: '#0F1115',
      border: '1px solid #222',
      borderRadius: '8px',
      color: '#FFFFFF',
      fontSize: '13px',
      cursor: 'pointer',
      width: '100%',
      textAlign: 'left',
      transition: 'all 0.15s',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = color;
      e.currentTarget.style.background = `${color}10`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = '#222';
      e.currentTarget.style.background = '#0F1115';
    }}
  >
    <span style={{ color }}>{icon}</span>
    {label}
    <ChevronRight size={14} style={{ marginLeft: 'auto', color: '#6B7280' }} />
  </button>
);

const AnalyticsRow: React.FC<{ label: string; value: string; icon: React.ReactNode; color?: string }> = ({ label, value, icon, color = '#60A5FA' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <span style={{ color }}>{icon}</span>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '12px', color: '#9CA3AF' }}>{label}</div>
      <div style={{ fontSize: '14px', color: '#FFFFFF', fontWeight: 500 }}>{value}</div>
    </div>
  </div>
);

export default TenantDetailView;
