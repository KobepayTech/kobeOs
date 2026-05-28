// ============================================================================
// KITCHEN DISPLAY SYSTEM (KDS)
// ============================================================================
// Real-time order routing to Kitchen, Bar, and Dessert stations
// Auto-splits orders by station, shows elapsed time, priority
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  ChefHat, Wine, IceCream, Flame, Clock, CheckCircle, AlertTriangle,
  Volume2, VolumeX, Filter, Maximize2, Minimize2
} from 'lucide-react';
import type { Order, KDSOrder } from '@/shared/types';

interface KDSDisplayProps {
  orders: Order[];
  station: 'kitchen' | 'bar' | 'dessert' | 'all';
  onUpdateItemStatus: (orderId: string, itemId: string, status: string) => void;
  onCompleteOrder: (orderId: string) => void;
}

export const KDSDisplay: React.FC<KDSDisplayProps> = ({
  orders,
  station,
  onUpdateItemStatus,
  onCompleteOrder,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'new' | 'preparing' | 'rush'>('all');

  const kdsOrders = useMemo(() => {
    let result = orders.filter(o => o.status === 'pending' || o.status === 'preparing');
    if (station !== 'all') {
      result = result.filter(o => o.station === station || o.station === 'mixed');
    }
    const now = Date.now();
    return result.map(o => {
      const elapsed = Math.floor((now - new Date(o.createdAt).getTime()) / 1000);
      let priority: KDSOrder['priority'] = 'normal';
      if (elapsed > 900) priority = 'rush';
      else if (elapsed > 600) priority = 'high';
      const stationItems = o.items.filter(item => station === 'all' || item.station === station);
      return {
        orderId: o.id,
        items: stationItems,
        tableNumber: o.tableId,
        roomNumber: o.roomId,
        guestName: o.guestName,
        priority,
        elapsedTime: elapsed,
        station: o.station as KDSOrder['station'],
        status: o.status as KDSOrder['status'],
        notes: o.notes,
      };
    }).sort((a, b) => {
      const priorityOrder = { rush: 0, high: 1, normal: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.elapsedTime - a.elapsedTime;
    });
  }, [orders, station]);

  const filteredOrders = useMemo(() => {
    if (filter === 'all') return kdsOrders;
    if (filter === 'new') return kdsOrders.filter(o => o.status === 'new');
    if (filter === 'preparing') return kdsOrders.filter(o => o.status === 'preparing');
    if (filter === 'rush') return kdsOrders.filter(o => o.priority === 'rush');
    return kdsOrders;
  }, [kdsOrders, filter]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const getStationIcon = (s: string) => {
    if (s === 'kitchen') return <ChefHat size={20} />;
    if (s === 'bar') return <Wine size={20} />;
    if (s === 'dessert') return <IceCream size={20} />;
    return <Flame size={20} />;
  };

  const getStationColor = (s: string) => {
    if (s === 'kitchen') return '#4ADE80';
    if (s === 'bar') return '#60A5FA';
    if (s === 'dessert') return '#FACC15';
    return '#A78BFA';
  };

  return (
    <div style={{
      height: '100vh',
      background: '#0B0B0B',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 24px',
        background: '#111111',
        borderBottom: '1px solid #1A1A1A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: `${getStationColor(station)}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: getStationColor(station),
          }}>
            {getStationIcon(station)}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#FFFFFF', textTransform: 'capitalize' }}>
              {station === 'all' ? 'All Stations' : `${station} Station`}
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6B7280' }}>
              {filteredOrders.length} active orders · {filteredOrders.filter(o => o.priority === 'rush').length} rush
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as any)}
            style={{
              padding: '8px 12px',
              background: '#1A1A1A',
              border: '1px solid #2C2C2C',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Orders</option>
            <option value="new">New</option>
            <option value="preparing">Preparing</option>
            <option value="rush">Rush</option>
          </select>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              padding: '8px',
              background: '#1A1A1A',
              border: '1px solid #2C2C2C',
              borderRadius: '8px',
              color: soundEnabled ? '#4ADE80' : '#6B7280',
              cursor: 'pointer',
            }}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            onClick={() => setFullscreen(!fullscreen)}
            style={{
              padding: '8px',
              background: '#1A1A1A',
              border: '1px solid #2C2C2C',
              borderRadius: '8px',
              color: '#9CA3AF',
              cursor: 'pointer',
            }}
          >
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '16px',
        alignContent: 'start',
      }}>
        {filteredOrders.map(order => {
          const isRush = order.priority === 'rush';
          const isHigh = order.priority === 'high';
          const borderColor = isRush ? '#DC2626' : isHigh ? '#FACC15' : '#2C2C2C';
          const bgColor = isRush ? '#450A0A' : '#181818';

          return (
            <div
              key={order.orderId}
              style={{
                background: bgColor,
                border: `2px solid ${borderColor}`,
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: isRush ? '#DC2626' : isHigh ? '#FACC15' : '#1A1A1A',
                    color: isRush ? '#FFFFFF' : isHigh ? '#000000' : '#9CA3AF',
                  }}>
                    {isRush ? 'RUSH' : isHigh ? 'HIGH' : 'NORMAL'}
                  </span>
                  {order.tableNumber && <span style={{ fontSize: '14px', color: '#FFFFFF', fontWeight: 600 }}>Table {order.tableNumber}</span>}
                  {order.roomNumber && <span style={{ fontSize: '14px', color: '#FFFFFF', fontWeight: 600 }}>Room {order.roomNumber}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isRush ? '#F87171' : '#9CA3AF' }}>
                  <Clock size={14} />
                  <span style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'monospace' }}>
                    {formatElapsed(order.elapsedTime)}
                  </span>
                </div>
              </div>

              {order.guestName && (
                <div style={{ fontSize: '13px', color: '#B3B3B3' }}>
                  Guest: <span style={{ color: '#FFFFFF', fontWeight: 500 }}>{order.guestName}</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {order.items.map(item => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: item.status === 'ready' ? '#0A3D1F' : item.status === 'preparing' ? '#422006' : '#1A1A1A',
                      borderRadius: '8px',
                      border: `1px solid ${item.status === 'ready' ? '#166534' : item.status === 'preparing' ? '#854D0E' : '#2C2C2C'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: '#0F1115',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#FFFFFF',
                      }}>
                        {item.quantity}
                      </span>
                      <div>
                        <div style={{ fontSize: '14px', color: '#FFFFFF', fontWeight: 500 }}>{item.name}</div>
                        {item.notes && <div style={{ fontSize: '11px', color: '#FACC15' }}>{item.notes}</div>}
                        {item.options && <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{item.options}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {item.status !== 'preparing' && (
                        <button
                          onClick={() => onUpdateItemStatus(order.orderId, item.id, 'preparing')}
                          style={{
                            padding: '6px 10px',
                            background: '#422006',
                            border: '1px solid #854D0E',
                            borderRadius: '6px',
                            color: '#FACC15',
                            fontSize: '11px',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          Start
                        </button>
                      )}
                      {item.status !== 'ready' && (
                        <button
                          onClick={() => onUpdateItemStatus(order.orderId, item.id, 'ready')}
                          style={{
                            padding: '6px 10px',
                            background: '#0A3D1F',
                            border: '1px solid #166534',
                            borderRadius: '6px',
                            color: '#4ADE80',
                            fontSize: '11px',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          Ready
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {order.notes && (
                <div style={{
                  padding: '8px 12px',
                  background: '#1A1A1A',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#FACC15',
                  border: '1px solid #422006',
                }}>
                  <AlertTriangle size={12} style={{ marginRight: '6px', display: 'inline' }} />
                  {order.notes}
                </div>
              )}

              <button
                onClick={() => onCompleteOrder(order.orderId)}
                style={{
                  padding: '10px',
                  background: '#0A3D1F',
                  border: '1px solid #166534',
                  borderRadius: '8px',
                  color: '#4ADE80',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle size={16} /> Mark Complete
              </button>
            </div>
          );
        })}

        {filteredOrders.length === 0 && (
          <div style={{
            gridColumn: '1 / -1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px',
            color: '#6B7280',
            gap: '12px',
          }}>
            <ChefHat size={48} />
            <p style={{ fontSize: '16px' }}>No active orders</p>
            <p style={{ fontSize: '13px' }}>New orders will appear here automatically</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default KDSDisplay;
