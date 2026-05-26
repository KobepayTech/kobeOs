// ============================================================================
// CARGO KANBAN PIPELINE
// ============================================================================
// Drag-and-drop pipeline for shipment stages:
// Created → Supplier Paid → Warehouse Received → Export Customs → 
// In Transit → Import Customs → Local Warehouse → Out For Delivery → Delivered
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Package, ArrowRight, Clock, MapPin, CheckCircle, AlertTriangle,
  QrCode, ChevronDown, ChevronUp, Phone, DollarSign, Truck, Warehouse,
  Globe, Shield, Home
} from 'lucide-react';
import type { Shipment, TrackingEvent } from '@/shared/types';
import { formatCurrency, formatDate, formatDateTime, getStatusColor, getShipmentStageLabel } from '@/shared/utils';

interface CargoKanbanProps {
  shipments: Shipment[];
  onUpdateStage: (shipmentId: string, newStage: string) => void;
  onSelectShipment: (shipmentId: string) => void;
  onScanQR: (shipmentId: string) => void;
}

const STAGES: { id: string; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'created', label: 'Created', icon: <Package size={14} />, color: '#60A5FA' },
  { id: 'supplier-paid', label: 'Supplier Paid', icon: <DollarSign size={14} />, color: '#60A5FA' },
  { id: 'warehouse-received', label: 'Warehouse', icon: <Warehouse size={14} />, color: '#4ADE80' },
  { id: 'export-customs', label: 'Export Customs', icon: <Shield size={14} />, color: '#FACC15' },
  { id: 'in-transit', label: 'In Transit', icon: <Truck size={14} />, color: '#FACC15' },
  { id: 'import-customs', label: 'Import Customs', icon: <Shield size={14} />, color: '#FACC15' },
  { id: 'local-warehouse', label: 'Local WH', icon: <Warehouse size={14} />, color: '#60A5FA' },
  { id: 'out-for-delivery', label: 'Out For Delivery', icon: <Truck size={14} />, color: '#FACC15' },
  { id: 'delivered', label: 'Delivered', icon: <CheckCircle size={14} />, color: '#4ADE80' },
];

export const CargoKanban: React.FC<CargoKanbanProps> = ({
  shipments,
  onUpdateStage,
  onSelectShipment,
  onScanQR,
}) => {
  const [expandedShipment, setExpandedShipment] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const filteredShipments = useMemo(() => {
    if (!filter) return shipments;
    const q = filter.toLowerCase();
    return shipments.filter(s =>
      s.reference.toLowerCase().includes(q) ||
      s.customerName.toLowerCase().includes(q) ||
      s.customerPhone.includes(q)
    );
  }, [shipments, filter]);

  const shipmentsByStage = useMemo(() => {
    const map: Record<string, Shipment[]> = {};
    STAGES.forEach(s => { map[s.id] = []; });
    filteredShipments.forEach(s => {
      if (map[s.stage]) map[s.stage].push(s);
    });
    return map;
  }, [filteredShipments]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>Shipment Pipeline</h1>
        <div style={{ position: 'relative', width: '300px' }}>
          <input
            type="text"
            placeholder="Search shipments..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: '#1A1A1A',
              border: '1px solid #2C2C2C',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Kanban Board */}
      <div style={{
        display: 'flex',
        gap: '12px',
        overflowX: 'auto',
        paddingBottom: '8px',
        flex: 1,
      }}>
        {STAGES.map(stage => {
          const stageShipments = shipmentsByStage[stage.id] || [];
          return (
            <div
              key={stage.id}
              style={{
                minWidth: '280px',
                maxWidth: '280px',
                background: '#141414',
                border: '1px solid #1A1A1A',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '100%',
              }}
            >
              {/* Column Header */}
              <div style={{
                padding: '12px 14px',
                borderBottom: '1px solid #1A1A1A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: stage.color }}>{stage.icon}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>{stage.label}</span>
                </div>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: '#1A1A1A',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#9CA3AF',
                }}>
                  {stageShipments.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                overflowY: 'auto',
                flex: 1,
              }}>
                {stageShipments.map(shipment => (
                  <ShipmentCard
                    key={shipment.id}
                    shipment={shipment}
                    isExpanded={expandedShipment === shipment.id}
                    onToggle={() => setExpandedShipment(expandedShipment === shipment.id ? null : shipment.id)}
                    onSelect={() => onSelectShipment(shipment.id)}
                    onScanQR={() => onScanQR(shipment.id)}
                    onAdvance={() => {
                      const currentIdx = STAGES.findIndex(s => s.id === shipment.stage);
                      if (currentIdx < STAGES.length - 1) {
                        onUpdateStage(shipment.id, STAGES[currentIdx + 1].id);
                      }
                    }}
                  />
                ))}
                {stageShipments.length === 0 && (
                  <div style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: '#4A4A4A',
                    fontSize: '13px',
                  }}>
                    No shipments
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ShipmentCard: React.FC<{
  shipment: Shipment;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onScanQR: () => void;
  onAdvance: () => void;
}> = ({ shipment, isExpanded, onToggle, onSelect, onScanQR, onAdvance }) => {
  const colors = getStatusColor(shipment.status);
  const isLastStage = shipment.stage === 'delivered';

  return (
    <div
      style={{
        background: '#181818',
        border: '1px solid #222',
        borderRadius: '10px',
        padding: '12px',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#2C2C2C'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; }}
    >
      <div onClick={onToggle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#60A5FA', fontFamily: 'monospace' }}>
            {shipment.reference}
          </span>
          <span style={{
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 600,
            background: colors.bg,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            textTransform: 'uppercase',
          }}>
            {shipment.status}
          </span>
        </div>

        <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', marginBottom: '4px' }}>
          {shipment.customerName}
        </div>
        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
          {shipment.customerPhone}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#9CA3AF' }}>
            <Package size={12} />
            {shipment.suppliers.length} suppliers
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#FACC15' }}>
            {formatCurrency(shipment.balance, 'USD')}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #222',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          {/* Suppliers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Suppliers</span>
            {shipment.suppliers.map(sup => (
              <div key={sup.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                background: '#0F1115',
                borderRadius: '6px',
                fontSize: '12px',
              }}>
                <span style={{ color: '#B3B3B3' }}>{sup.supplierNumber}</span>
                <span style={{ color: '#FACC15' }}>{formatCurrency(sup.amount, 'USD')}</span>
              </div>
            ))}
          </div>

          {/* Tracking Events */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>History</span>
            {shipment.trackingEvents.slice(-3).map(evt => (
              <div key={evt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <Clock size={12} color="#6B7280" />
                <span style={{ color: '#9CA3AF' }}>{getShipmentStageLabel(evt.stage)}</span>
                <span style={{ color: '#4A4A4A' }}>·</span>
                <span style={{ color: '#6B7280' }}>{formatDateTime(evt.timestamp)}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              style={{
                flex: 1,
                padding: '8px',
                background: '#1A1A1A',
                border: '1px solid #2C2C2C',
                borderRadius: '6px',
                color: '#FFFFFF',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              View Details
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onScanQR(); }}
              style={{
                flex: 1,
                padding: '8px',
                background: '#1A1A1A',
                border: '1px solid #2C2C2C',
                borderRadius: '6px',
                color: '#60A5FA',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <QrCode size={12} /> Scan
            </button>
            {!isLastStage && (
              <button
                onClick={(e) => { e.stopPropagation(); onAdvance(); }}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: '#0A3D1F',
                  border: '1px solid #166534',
                  borderRadius: '6px',
                  color: '#4ADE80',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <ArrowRight size={12} /> Advance
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CargoKanban;
