// ============================================================================
// QR CUSTOMER PORTAL
// ============================================================================
// Public-facing web app for guests scanning QR at tables or rooms
// Features: Digital menu, ordering, payment, room service, call waiter
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  QrCode, ShoppingCart, Plus, Minus, Trash2, CreditCard,
  MessageSquare, Wifi, Phone, CheckCircle, Clock, Home,
  ChevronLeft, ChevronRight, Star, X
} from 'lucide-react';
import type { Hotel, MenuCategory, MenuItem, Order, OrderItem } from '@/shared/types';
import { formatCurrency, generateId } from '@/shared/utils';

interface QRCustomerPortalProps {
  hotel: Hotel;
  tableId?: string;
  roomId?: string;
  onPlaceOrder: (order: Order) => void;
  onCallWaiter: (tableId: string) => void;
  onRequestService: (roomId: string, serviceType: string) => void;
}

type PortalView = 'menu' | 'cart' | 'order-status' | 'room-services' | 'hotel-info';

export const QRCustomerPortal: React.FC<QRCustomerPortalProps> = ({
  hotel,
  tableId,
  roomId,
  onPlaceOrder,
  onCallWaiter,
  onRequestService,
}) => {
  const [view, setView] = useState<PortalView>('menu');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<{ item: MenuItem; quantity: number; options?: string }[]>([]);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

  const isTableMode = !!tableId;
  const isRoomMode = !!roomId;

  const filteredItems = selectedCategory === 'all'
    ? hotel.menuCategories.flatMap(c => c.items.filter(i => i.isAvailable))
    : hotel.menuCategories.find(c => c.id === selectedCategory)?.items.filter(i => i.isAvailable) || [];

  const addToCart = (item: MenuItem, options?: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id && c.options === options);
      if (existing) {
        return prev.map(c => c.item.id === item.id && c.options === options
          ? { ...c, quantity: c.quantity + 1 }
          : c
        );
      }
      return [...prev, { item, quantity: 1, options }];
    });
  };

  const updateQuantity = (itemId: string, options: string | undefined, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.item.id === itemId && c.options === options) {
        const newQty = Math.max(0, c.quantity + delta);
        return { ...c, quantity: newQty };
      }
      return c;
    }).filter(c => c.quantity > 0));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0);
  const tax = cartTotal * (hotel.settings.taxRate / 100);
  const serviceCharge = cartTotal * (hotel.settings.serviceCharge / 100);
  const total = cartTotal + tax + serviceCharge;

  const placeOrder = () => {
    if (cart.length === 0) return;
    const orderItems: OrderItem[] = cart.map(c => ({
      id: generateId('item-'),
      menuItemId: c.item.id,
      name: c.item.name,
      quantity: c.quantity,
      unitPrice: c.item.price,
      totalPrice: c.item.price * c.quantity,
      options: c.options,
      notes: '',
      station: c.item.station,
      status: 'pending',
    }));

    const stations = [...new Set(orderItems.map(i => i.station))];
    const order: Order = {
      id: generateId('ord-'),
      tableId: tableId || undefined,
      roomId: roomId || undefined,
      items: orderItems,
      status: 'pending',
      subtotal: cartTotal,
      tax,
      serviceCharge,
      total,
      paymentStatus: 'unpaid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      station: stations.length > 1 ? 'mixed' : stations[0],
    };

    setCurrentOrder(order);
    onPlaceOrder(order);
    setOrderPlaced(true);
    setCart([]);
    setView('order-status');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F1115',
      color: '#FFFFFF',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: '#111111',
        borderBottom: '1px solid #1A1A1A',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{hotel.name}</h1>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B7280' }}>
            {isTableMode ? `Table ${tableId}` : isRoomMode ? `Room ${roomId}` : 'Guest Portal'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isTableMode && (
            <button
              onClick={() => onCallWaiter(tableId!)}
              style={{
                padding: '8px 12px',
                background: '#1A1A1A',
                border: '1px solid #2C2C2C',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <MessageSquare size={14} /> Call Waiter
            </button>
          )}
          <button
            onClick={() => setView(view === 'cart' ? 'menu' : 'cart')}
            style={{
              padding: '8px 12px',
              background: cart.length > 0 ? '#1F3B73' : '#1A1A1A',
              border: '1px solid #2C2C2C',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              position: 'relative',
            }}
          >
            <ShoppingCart size={14} />
            {cart.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#F87171',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {cart.reduce((sum, c) => sum + c.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '12px 20px',
        overflowX: 'auto',
        borderBottom: '1px solid #1A1A1A',
      }}>
        {[
          { id: 'menu' as PortalView, label: 'Menu', icon: <Star size={14} /> },
          ...(isRoomMode ? [{ id: 'room-services' as PortalView, label: 'Room Service', icon: <Home size={14} /> }] : []),
          { id: 'hotel-info' as PortalView, label: 'Hotel Info', icon: <Wifi size={14} /> },
          ...(currentOrder ? [{ id: 'order-status' as PortalView, label: 'My Order', icon: <Clock size={14} /> }] : []),
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: view === tab.id ? '#1F3B73' : 'transparent',
              color: view === tab.id ? '#FFFFFF' : '#9CA3AF',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '20px' }}>
        {view === 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Category Filter */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              <button
                onClick={() => setSelectedCategory('all')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  background: selectedCategory === 'all' ? '#1F3B73' : '#1A1A1A',
                  color: selectedCategory === 'all' ? '#FFFFFF' : '#9CA3AF',
                  border: '1px solid #2C2C2C',
                  cursor: 'pointer',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                }}
              >
                All Items
              </button>
              {hotel.menuCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    background: selectedCategory === cat.id ? '#1F3B73' : '#1A1A1A',
                    color: selectedCategory === cat.id ? '#FFFFFF' : '#9CA3AF',
                    border: '1px solid #2C2C2C',
                    cursor: 'pointer',
                    fontSize: '13px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Menu Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '14px',
                    background: '#181818',
                    border: '1px solid #222',
                    borderRadius: '12px',
                  }}
                >
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '10px',
                    background: '#1A1A1A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6B7280',
                    flexShrink: 0,
                  }}>
                    {item.image ? (
                      <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} />
                    ) : (
                      <Star size={28} />
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#FFFFFF' }}>{item.name}</h3>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#FACC15' }}>
                        {formatCurrency(item.price, hotel.settings.currency)}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF', lineHeight: 1.4 }}>{item.description}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        background: item.station === 'kitchen' ? '#0A3D1F' : item.station === 'bar' ? '#1E3A5F' : '#422006',
                        color: item.station === 'kitchen' ? '#4ADE80' : item.station === 'bar' ? '#60A5FA' : '#FACC15',
                        textTransform: 'uppercase',
                      }}>
                        {item.station}
                      </span>
                      {item.isPopular && (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          background: '#450A0A',
                          color: '#F87171',
                        }}>
                          Popular
                        </span>
                      )}
                      <span style={{ fontSize: '12px', color: '#6B7280' }}>{item.preparationTime} min</span>
                    </div>
                    <button
                      onClick={() => addToCart(item)}
                      style={{
                        marginTop: '8px',
                        padding: '8px 16px',
                        background: '#1F3B73',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Plus size={14} /> Add to Order
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'cart' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Your Order</h2>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                <ShoppingCart size={48} style={{ marginBottom: '12px' }} />
                <p>Your cart is empty</p>
                <button
                  onClick={() => setView('menu')}
                  style={{
                    marginTop: '12px',
                    padding: '10px 20px',
                    background: '#1F3B73',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Browse Menu
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {cart.map((c, idx) => (
                    <div key={`${c.item.id}-${idx}`} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      background: '#181818',
                      border: '1px solid #222',
                      borderRadius: '10px',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: '#FFFFFF' }}>{c.item.name}</div>
                        {c.options && <div style={{ fontSize: '12px', color: '#9CA3AF' }}>{c.options}</div>}
                        <div style={{ fontSize: '13px', color: '#FACC15', marginTop: '2px' }}>
                          {formatCurrency(c.item.price, hotel.settings.currency)} each
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => updateQuantity(c.item.id, c.options, -1)}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: '#1A1A1A',
                            border: '1px solid #2C2C2C',
                            color: '#FFFFFF',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Minus size={14} />
                        </button>
                        <span style={{ fontSize: '16px', fontWeight: 600, minWidth: '24px', textAlign: 'center' }}>
                          {c.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(c.item.id, c.options, 1)}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: '#1A1A1A',
                            border: '1px solid #2C2C2C',
                            color: '#FFFFFF',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => updateQuantity(c.item.id, c.options, -c.quantity)}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'transparent',
                            border: '1px solid #2C2C2C',
                            color: '#F87171',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{
                  padding: '16px',
                  background: '#181818',
                  border: '1px solid #222',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#B3B3B3' }}>
                    <span>Subtotal</span>
                    <span>{formatCurrency(cartTotal, hotel.settings.currency)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#B3B3B3' }}>
                    <span>Tax ({hotel.settings.taxRate}%)</span>
                    <span>{formatCurrency(tax, hotel.settings.currency)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#B3B3B3' }}>
                    <span>Service Charge ({hotel.settings.serviceCharge}%)</span>
                    <span>{formatCurrency(serviceCharge, hotel.settings.currency)}</span>
                  </div>
                  <div style={{ borderTop: '1px solid #2C2C2C', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>
                    <span>Total</span>
                    <span style={{ color: '#FACC15' }}>{formatCurrency(total, hotel.settings.currency)}</span>
                  </div>
                </div>

                <button
                  onClick={placeOrder}
                  style={{
                    padding: '14px',
                    background: '#0A3D1F',
                    border: '1px solid #166534',
                    borderRadius: '10px',
                    color: '#4ADE80',
                    fontSize: '16px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <CheckCircle size={18} /> Place Order
                </button>
              </>
            )}
          </div>
        )}

        {view === 'order-status' && currentOrder && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '20px 0' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: currentOrder.status === 'served' ? '#0A3D1F' : currentOrder.status === 'ready' ? '#0A3D1F' : '#422006',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {currentOrder.status === 'served' || currentOrder.status === 'ready' ? (
                <CheckCircle size={40} color="#4ADE80" />
              ) : (
                <Clock size={40} color="#FACC15" />
              )}
            </div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>
              {currentOrder.status === 'served' ? 'Enjoy Your Meal!' : currentOrder.status === 'ready' ? 'Ready for Pickup' : 'Preparing Your Order'}
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#9CA3AF', textAlign: 'center' }}>
              Order #{currentOrder.id.slice(-6).toUpperCase()}
              <br />
              {isTableMode ? `Table ${tableId}` : isRoomMode ? `Room ${roomId}` : ''}
            </p>

            <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentOrder.items.map(item => (
                <div key={item.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: item.status === 'ready' ? '#0A3D1F' : '#181818',
                  borderRadius: '8px',
                  border: `1px solid ${item.status === 'ready' ? '#166534' : '#222'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>{item.quantity}x</span>
                    <span style={{ fontSize: '14px', color: '#B3B3B3' }}>{item.name}</span>
                  </div>
                  <span style={{
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: item.status === 'ready' ? '#166534' : item.status === 'preparing' ? '#854D0E' : '#1A1A1A',
                    color: item.status === 'ready' ? '#4ADE80' : item.status === 'preparing' ? '#FACC15' : '#9CA3AF',
                    textTransform: 'uppercase',
                  }}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>

            <div style={{
              padding: '16px',
              background: '#181818',
              border: '1px solid #222',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '400px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 700 }}>
                <span>Total</span>
                <span style={{ color: '#FACC15' }}>{formatCurrency(currentOrder.total, hotel.settings.currency)}</span>
              </div>
              {currentOrder.paymentStatus === 'unpaid' && (
                <button style={{
                  marginTop: '12px',
                  width: '100%',
                  padding: '12px',
                  background: '#1F3B73',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}>
                  <CreditCard size={16} /> Pay Now
                </button>
              )}
            </div>
          </div>
        )}

        {view === 'room-services' && isRoomMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Room Services</h2>
            {[
              { icon: <Home size={20} />, label: 'Housekeeping', color: '#60A5FA' },
              { icon: <MessageSquare size={20} />, label: 'Call Reception', color: '#4ADE80' },
              { icon: <Wifi size={20} />, label: 'WiFi Password', color: '#FACC15' },
              { icon: <Phone size={20} />, label: 'Request Laundry', color: '#A78BFA' },
              { icon: <CreditCard size={20} />, label: 'View Bill', color: '#F87171' },
              { icon: <CheckCircle size={20} />, label: 'Express Checkout', color: '#4ADE80' },
            ].map(service => (
              <button
                key={service.label}
                onClick={() => onRequestService(roomId!, service.label)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '16px',
                  background: '#181818',
                  border: '1px solid #222',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: 500,
                  textAlign: 'left',
                }}
              >
                <span style={{ color: service.color }}>{service.icon}</span>
                {service.label}
                <ChevronRight size={16} style={{ marginLeft: 'auto', color: '#6B7280' }} />
              </button>
            ))}
          </div>
        )}

        {view === 'hotel-info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Hotel Information</h2>
            <div style={{
              padding: '20px',
              background: '#181818',
              border: '1px solid #222',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <InfoRow icon={<Home size={16} />} label="Address" value={hotel.address} />
              <InfoRow icon={<Phone size={16} />} label="Phone" value={hotel.phone} />
              <InfoRow icon={<MessageSquare size={16} />} label="Email" value={hotel.email} />
              <InfoRow icon={<Wifi size={16} />} label="WiFi" value="Ask reception for password" />
              <InfoRow icon={<Clock size={16} />} label="Check-in" value={hotel.settings.checkInTime} />
              <InfoRow icon={<Clock size={16} />} label="Check-out" value={hotel.settings.checkOutTime} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <span style={{ color: '#6B7280' }}>{icon}</span>
    <div>
      <div style={{ fontSize: '12px', color: '#6B7280' }}>{label}</div>
      <div style={{ fontSize: '14px', color: '#FFFFFF', fontWeight: 500 }}>{value}</div>
    </div>
  </div>
);

export default QRCustomerPortal;
