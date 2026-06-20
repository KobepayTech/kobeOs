// ============================================================================
// CARGO KANBAN PIPELINE
// ============================================================================
// Drag-and-drop pipeline for shipment stages:
// Created → Supplier Paid → Warehouse Received → Export Customs →
// In Transit → Import Customs → Local Warehouse → Out For Delivery → Delivered
// ============================================================================

import React, { useState, useMemo, useEffect } from 'react';
import {
  Package, ArrowRight, Clock, CheckCircle,
  QrCode, DollarSign, Truck, Warehouse, Shield
} from 'lucide-react';
import type { Shipment } from '@/shared/types';
import { formatCurrency, formatDateTime, getStatusColor, getShipmentStageLabel } from '@/shared/utils';
import { api } from '@/lib/api';

interface CargoKanbanProps {
  shipments?: Shipment[];
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
  shipments: shipmentsProp,
  onUpdateStage,
  onSelectShipment,
  onScanQR,
}) => {
  const [expandedShipment, setExpandedShipment] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [internalShipments, setInternalShipments] = useState<Shipment[]>([]);

  useEffect(() => {
    if (shipmentsProp) return;
    api<Shipment[]>('/cargo/shipments')
      .then(setInternalShipments)
      .catch(console.error);
  }, [shipmentsProp]);

  const shipments = shipmentsProp ?? internalShipments;

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
    <div className="h-full flex relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #E8E4F3 0%, #C9D6FF 50%, #E8E4F3 100%)' }}>
      <BokehBackground />
      <div className="relative z-10 flex-1 flex flex-col p-4" style={{ gap: '16px', height: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#334155' }}>Shipment Pipeline</h1>
          <div style={{ position: 'relative', width: '300px' }}>
            <input
              type="text"
              placeholder="Search shipments..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.50)',
                border: '1px solid rgba(255,255,255,0.40)',
                borderRadius: '12px',
                color: '#334155',
                fontSize: '14px',
                outline: 'none',
                backdropFilter: 'blur(20px)',
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
                  background: 'rgba(255,255,255,0.30)',
                  border: '1px solid rgba(255,255,255,0.40)',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: '100%',
                  backdropFilter: 'blur(24px)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                }}
              >
                {/* Column Header */}
                <div style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid rgba(255,255,255,0.30)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: stage.color }}>{stage.icon}</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>{stage.label}</span>
                  </div>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.50)',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#64748B',
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
                      color: '#94A3B8',
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
        background: 'rgba(255,255,255,0.35)',
        border: '1px solid rgba(255,255,255,0.40)',
        borderRadius: '12px',
        padding: '12px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        backdropFilter: 'blur(16px)',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.40)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.40)'; }}
    >
      <div onClick={onToggle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563EB', fontFamily: 'monospace' }}>
            {shipment.reference}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border" style={{
            background: `${colors.bg}`,
            color: `${colors.text}`,
            borderColor: `${colors.border}`,
            textTransform: 'uppercase',
          }}>
            {shipment.status}
          </span>
        </div>

        <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
          {shipment.customerName}
        </div>
        <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>
          {shipment.customerPhone}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#64748B' }}>
            <Package size={12} />
            {shipment.suppliers.length} suppliers
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#D97706' }}>
            {formatCurrency(shipment.balance, 'USD')}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255,255,255,0.40)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          {/* Suppliers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Suppliers</span>
            {shipment.suppliers.map(sup => (
              <div key={sup.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.40)',
                borderRadius: '8px',
                fontSize: '12px',
              }}>
                <span style={{ color: '#475569' }}>{sup.supplierNumber}</span>
                <span style={{ color: '#D97706', fontWeight: 600 }}>{formatCurrency(sup.amount, 'USD')}</span>
              </div>
            ))}
          </div>

          {/* Tracking Events */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>History</span>
            {shipment.trackingEvents.slice(-3).map(evt => (
              <div key={evt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <Clock size={12} color="#94A3B8" />
                <span style={{ color: '#64748B' }}>{getShipmentStageLabel(evt.stage)}</span>
                <span style={{ color: '#CBD5E1' }}>&#183;</span>
                <span style={{ color: '#94A3B8' }}>{formatDateTime(evt.timestamp)}</span>
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
                background: 'rgba(255,255,255,0.50)',
                border: '1px solid rgba(255,255,255,0.40)',
                borderRadius: '8px',
                color: '#334155',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              View Details
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onScanQR(); }}
              style={{
                flex: 1,
                padding: '8px',
                background: 'rgba(255,255,255,0.50)',
                border: '1px solid rgba(255,255,255,0.40)',
                borderRadius: '8px',
                color: '#2563EB',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                fontWeight: 500,
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
                  background: '#10B981',
                  border: '1px solid #10B981',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  fontWeight: 600,
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
