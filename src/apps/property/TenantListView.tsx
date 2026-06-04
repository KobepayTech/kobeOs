// ============================================================================
// TENANT LIST VIEW
// ============================================================================
// Production-scale tenant management table
// Features: Search, Filters, Sort, Pagination, Status badges, Quick actions
// Replaces horizontal month-per-tenant layout with compact rows
// ============================================================================

import React, { useState, useMemo, useCallback } from 'react';
import { Search, Eye, MessageSquare, Download, ArrowUpDown, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import type { Tenant } from '@/shared/types';
import { formatCurrency, formatDate, getStatusColor, debounce } from '@/shared/utils';

interface TenantListViewProps {
  tenants: Tenant[];
  onSelectTenant: (tenantId: string) => void;
  onRecordPayment: (tenantId: string) => void;
  onSendReminder: (tenantId: string) => void;
  onWhatsApp: (tenantId: string) => void;
  onExport: () => void;
}

export const TenantListView: React.FC<TenantListViewProps> = ({
  tenants,
  onSelectTenant,
  onRecordPayment,
  onSendReminder,
  onWhatsApp,
  onExport,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: string; order: 'asc' | 'desc' }>({ key: 'name', order: 'asc' });
  const [page, setPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const pageSize = 20;

  const debouncedSearch = useCallback(
    debounce((val: string) => setSearchQuery(val), 300),
    []
  );

  const filteredTenants = useMemo(() => {
    let result = [...tenants];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.phone.includes(q) ||
        t.unit.toLowerCase().includes(q) ||
        t.shortCode.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }

    if (propertyFilter !== 'all') {
      result = result.filter(t => t.propertyId === propertyFilter);
    }

    result.sort((a, b) => {
      const aVal = a[sortConfig.key as keyof Tenant];
      const bVal = b[sortConfig.key as keyof Tenant];
      if (aVal === undefined || bVal === undefined) return 0;
      if (aVal < bVal) return sortConfig.order === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.order === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [tenants, searchQuery, statusFilter, propertyFilter, sortConfig]);

  const paginatedTenants = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTenants.slice(start, start + pageSize);
  }, [filteredTenants, page]);

  const totalPages = Math.ceil(filteredTenants.length / pageSize);

  const toggleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      order: prev.key === key && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const toggleSelectRow = (id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedRows.size === paginatedTenants.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedTenants.map(t => t.id)));
    }
  };

  const statusOptions = [
    { value: 'all', label: 'All Statuses', count: tenants.length },
    { value: 'active', label: 'Active', count: tenants.filter(t => t.status === 'active').length },
    { value: 'overdue', label: 'Overdue', count: tenants.filter(t => t.status === 'overdue').length },
    { value: 'fully-paid', label: 'Fully Paid', count: tenants.filter(t => t.status === 'fully-paid').length },
    { value: 'pending', label: 'Pending', count: tenants.filter(t => t.status === 'pending').length },
    { value: 'inactive', label: 'Inactive', count: tenants.filter(t => t.status === 'inactive').length },
  ];

  // Get unique properties for filter
  const properties = useMemo(() => {
    const map = new Map<string, string>();
    tenants.forEach(t => { if (t.propertyId) map.set(t.propertyId, t.propertyName || t.propertyId); });
    return Array.from(map.entries());
  }, [tenants]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: '300px' }}>
          <div style={{
            position: 'relative',
            flex: '1',
            maxWidth: '400px',
          }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
            <input
              type="text"
              placeholder="Search by name, phone, unit..."
              onChange={e => debouncedSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 38px',
                background: '#1A1A1A',
                border: '1px solid #2C2C2C',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            style={{
              padding: '10px 12px',
              background: '#1A1A1A',
              border: '1px solid #2C2C2C',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label} ({opt.count})</option>
            ))}
          </select>

          {properties.length > 0 && (
            <select
              value={propertyFilter}
              onChange={e => { setPropertyFilter(e.target.value); setPage(1); }}
              style={{
                padding: '10px 12px',
                background: '#1A1A1A',
                border: '1px solid #2C2C2C',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Properties</option>
              {properties.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onExport}
            style={{
              padding: '10px 16px',
              background: '#1A1A1A',
              border: '1px solid #2C2C2C',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Results count */}
      <div style={{ fontSize: '13px', color: '#6B7280' }}>
        Showing {paginatedTenants.length} of {filteredTenants.length} tenants
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Table */}
      <div style={{
        background: '#181818',
        border: '1px solid #222',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #222', background: '#141414' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={paginatedTenants.length > 0 && selectedRows.size === paginatedTenants.length}
                    onChange={selectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', cursor: 'pointer', color: '#9CA3AF', fontWeight: 500, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }} onClick={() => toggleSort('name')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Tenant <ArrowUpDown size={14} />
                  </div>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#9CA3AF', fontWeight: 500, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unit</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', cursor: 'pointer', color: '#9CA3AF', fontWeight: 500, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }} onClick={() => toggleSort('status')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Status <ArrowUpDown size={14} />
                  </div>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'right', cursor: 'pointer', color: '#9CA3AF', fontWeight: 500, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }} onClick={() => toggleSort('paidAmount')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    Paid <ArrowUpDown size={14} />
                  </div>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'right', cursor: 'pointer', color: '#9CA3AF', fontWeight: 500, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }} onClick={() => toggleSort('balance')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    Balance <ArrowUpDown size={14} />
                  </div>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', cursor: 'pointer', color: '#9CA3AF', fontWeight: 500, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }} onClick={() => toggleSort('nextDueDate')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Next Due <ArrowUpDown size={14} />
                  </div>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: '#9CA3AF', fontWeight: 500, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTenants.map(tenant => {
                const colors = getStatusColor(tenant.status);
                return (
                  <tr
                    key={tenant.id}
                    style={{
                      borderBottom: '1px solid #1F1F1F',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1A1A1A')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedRows.has(tenant.id)}
                        onChange={() => toggleSelectRow(tenant.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '14px 16px' }} onClick={() => onSelectTenant(tenant.id)}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ color: '#FFFFFF', fontWeight: 500 }}>{tenant.name}</span>
                        <span style={{ color: '#6B7280', fontSize: '12px' }}>{tenant.phone}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#B3B3B3' }} onClick={() => onSelectTenant(tenant.id)}>
                      {tenant.unit}
                    </td>
                    <td style={{ padding: '14px 16px' }} onClick={() => onSelectTenant(tenant.id)}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                      }}>
                        {tenant.status === 'overdue' && <AlertTriangle size={12} />}
                        {tenant.status === 'fully-paid' && <CheckCircle size={12} />}
                        {tenant.status.replace('-', ' ')}
                      </span>
                      {tenant.status === 'overdue' && tenant.daysOverdue > 0 && (
                        <div style={{ fontSize: '11px', color: '#F87171', marginTop: '4px' }}>
                          {tenant.daysOverdue} days overdue
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: '#4ADE80', fontWeight: 500 }} onClick={() => onSelectTenant(tenant.id)}>
                      {formatCurrency(tenant.paidAmount, tenant.currency)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', color: tenant.balance > 0 ? '#F87171' : '#4ADE80', fontWeight: 500 }} onClick={() => onSelectTenant(tenant.id)}>
                      {formatCurrency(tenant.balance, tenant.currency)}
                    </td>
                    <td style={{ padding: '14px 16px', color: tenant.status === 'overdue' ? '#F87171' : '#B3B3B3' }} onClick={() => onSelectTenant(tenant.id)}>
                      {formatDate(tenant.nextDueDate)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          onClick={() => onSelectTenant(tenant.id)}
                          style={{
                            padding: '6px',
                            background: 'transparent',
                            border: '1px solid #2C2C2C',
                            borderRadius: '6px',
                            color: '#9CA3AF',
                            cursor: 'pointer',
                          }}
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => onRecordPayment(tenant.id)}
                          style={{
                            padding: '6px',
                            background: 'transparent',
                            border: '1px solid #2C2C2C',
                            borderRadius: '6px',
                            color: '#4ADE80',
                            cursor: 'pointer',
                          }}
                          title="Record Payment"
                        >
                          <TrendingUp size={14} />
                        </button>
                        <button
                          onClick={() => onWhatsApp(tenant.id)}
                          style={{
                            padding: '6px',
                            background: 'transparent',
                            border: '1px solid #2C2C2C',
                            borderRadius: '6px',
                            color: '#60A5FA',
                            cursor: 'pointer',
                          }}
                          title="WhatsApp"
                        >
                          <MessageSquare size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedTenants.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#6B7280' }}>
                    No tenants found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderTop: '1px solid #222',
          }}>
            <span style={{ fontSize: '13px', color: '#6B7280' }}>
              Page {page} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: '8px 14px',
                  background: page === 1 ? '#1A1A1A' : '#222',
                  border: '1px solid #2C2C2C',
                  borderRadius: '6px',
                  color: page === 1 ? '#5A5A5A' : '#FFFFFF',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                }}
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  padding: '8px 14px',
                  background: page === totalPages ? '#1A1A1A' : '#222',
                  border: '1px solid #2C2C2C',
                  borderRadius: '6px',
                  color: page === totalPages ? '#5A5A5A' : '#FFFFFF',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TenantListView;
