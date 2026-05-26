// ============================================================================
// PROPERTY SUMMARY CARDS
// ============================================================================
// Top-level summary cards for property dashboard
// Shows: Total Tenants, Overdue, Fully Paid, Pending, Revenue
// ============================================================================

import React from 'react';
import { Users, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import type { PropertySummary } from '@/shared/types';
import { formatCurrency } from '@/shared/utils';

interface PropertySummaryCardsProps {
  summary: PropertySummary;
  currency?: string;
}

const SummaryCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: string;
}> = ({ title, value, subtitle, icon, color, trend }) => (
  <div style={{
    background: '#181818',
    border: '1px solid #222',
    borderRadius: '12px',
    padding: '20px',
    minWidth: '200px',
    flex: '1',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: '#9CA3AF', fontSize: '13px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {title}
      </span>
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        background: `${color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color,
      }}>
        {icon}
      </div>
    </div>
    <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2 }}>
      {value}
    </div>
    {subtitle && (
      <div style={{ fontSize: '12px', color: '#6B7280' }}>{subtitle}</div>
    )}
    {trend && (
      <div style={{ fontSize: '12px', color: '#4ADE80', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
        <TrendingUp size={14} />
        {trend}
      </div>
    )}
  </div>
);

export const PropertySummaryCards: React.FC<PropertySummaryCardsProps> = ({ summary, currency = 'TZS' }) => {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
      marginBottom: '24px',
    }}>
      <SummaryCard
        title="Total Tenants"
        value={summary.totalTenants}
        subtitle={`${summary.occupancyRate}% occupancy`}
        icon={<Users size={18} />}
        color="#60A5FA"
        trend="+3 this month"
      />
      <SummaryCard
        title="Overdue"
        value={summary.overdueCount}
        subtitle={`${formatCurrency(summary.totalOutstanding, currency)} outstanding`}
        icon={<AlertTriangle size={18} />}
        color="#F87171"
      />
      <SummaryCard
        title="Fully Paid"
        value={summary.fullyPaidCount}
        subtitle="Current month"
        icon={<CheckCircle size={18} />}
        color="#4ADE80"
      />
      <SummaryCard
        title="Pending"
        value={summary.pendingCount}
        subtitle="Awaiting payment"
        icon={<Clock size={18} />}
        color="#FACC15"
      />
      <SummaryCard
        title="Revenue This Month"
        value={formatCurrency(summary.totalRevenueThisMonth, currency)}
        subtitle="Collected payments"
        icon={<TrendingUp size={18} />}
        color="#A78BFA"
        trend="+12% vs last month"
      />
    </div>
  );
};

export default PropertySummaryCards;
