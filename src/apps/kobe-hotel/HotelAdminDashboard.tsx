// ============================================================================
// HOTEL ADMIN DASHBOARD
// ============================================================================
// Central ERP dashboard for hotel owners to manage:
// - Content (website, menus, rooms)
// - Bookings & Reservations
// - Restaurant (QR ordering, KDS, tables)
// - Staff management
// - Analytics
// ============================================================================

import React, { useState } from 'react';
import {
  LayoutDashboard, Bed, UtensilsCrossed, QrCode, Users,
  Globe, ChefHat, BarChart3, Calendar, Plus, Edit2,
  Trash2, Eye, CheckCircle,
  DollarSign, Percent, Star
} from 'lucide-react';
import type { Hotel, Room } from '@/shared/types';
import { formatCurrency, formatDate, getStatusColor } from '@/shared/utils';

type TabType = 'overview' | 'rooms' | 'bookings' | 'restaurant' | 'menu' | 'staff' | 'website' | 'analytics';

interface HotelAdminDashboardProps {
  hotel: Hotel;
  onUpdateHotel: (hotel: Hotel) => void;
}

export const HotelAdminDashboard: React.FC<HotelAdminDashboardProps> = ({ hotel, onUpdateHotel }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showAddMenuItem, setShowAddMenuItem] = useState(false);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} /> },
    { id: 'rooms', label: 'Rooms', icon: <Bed size={16} /> },
    { id: 'bookings', label: 'Bookings', icon: <Calendar size={16} /> },
    { id: 'restaurant', label: 'Restaurant', icon: <UtensilsCrossed size={16} /> },
    { id: 'menu', label: 'Menu Editor', icon: <ChefHat size={16} /> },
    { id: 'staff', label: 'Staff', icon: <Users size={16} /> },
    { id: 'website', label: 'Website', icon: <Globe size={16} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={16} /> },
  ];

  const stats = {
    totalRooms: hotel.rooms.length,
    occupiedRooms: hotel.rooms.filter(r => r.status === 'occupied').length,
    availableRooms: hotel.rooms.filter(r => r.status === 'available').length,
    todayBookings: hotel.rooms.reduce((sum, r) => sum + r.bookings.filter(b => {
      const today = new Date().toISOString().split('T')[0];
      return b.checkIn <= today && b.checkOut >= today;
    }).length, 0),
    activeOrders: 0, // Would come from orders store
    revenueToday: 0,
    occupancyRate: hotel.rooms.length > 0 ? Math.round((hotel.rooms.filter(r => r.status === 'occupied').length / hotel.rooms.length) * 100) : 0,
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0B0B0B' }}>
      {/* Sidebar */}
      <div style={{
        width: '240px',
        background: '#111111',
        borderRight: '1px solid #1A1A1A',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 0',
      }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid #1A1A1A' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#FFFFFF' }}>{hotel.name}</h2>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6B7280' }}>{hotel.subdomain}.kobe</p>
        </div>
        <nav style={{ padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: activeTab === tab.id ? '#1F3B73' : 'transparent',
                color: activeTab === tab.id ? '#FFFFFF' : '#9CA3AF',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#FFFFFF' }}>Dashboard Overview</h1>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <StatCard title="Total Rooms" value={stats.totalRooms} icon={<Bed size={18} />} color="#60A5FA" />
              <StatCard title="Occupied" value={stats.occupiedRooms} icon={<Users size={18} />} color="#F87171" subtitle={`${stats.occupancyRate}% occupancy`} />
              <StatCard title="Available" value={stats.availableRooms} icon={<CheckCircle size={18} />} color="#4ADE80" />
              <StatCard title="Today's Bookings" value={stats.todayBookings} icon={<Calendar size={18} />} color="#A78BFA" />
              <StatCard title="Active Orders" value={stats.activeOrders} icon={<UtensilsCrossed size={18} />} color="#FACC15" />
              <StatCard title="Revenue Today" value={formatCurrency(stats.revenueToday, hotel.settings.currency)} icon={<DollarSign size={18} />} color="#4ADE80" trend="+8%" />
            </div>

            {/* Quick Actions */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
            }}>
              <QuickActionCard
                title="QR Ordering"
                description="Generate QR codes for tables and rooms"
                icon={<QrCode size={24} />}
                color="#60A5FA"
                onClick={() => setActiveTab('restaurant')}
              />
              <QuickActionCard
                title="Menu Editor"
                description="Update digital menus and pricing"
                icon={<ChefHat size={24} />}
                color="#FACC15"
                onClick={() => setActiveTab('menu')}
              />
              <QuickActionCard
                title="Website Builder"
                description="Edit your public hotel website"
                icon={<Globe size={24} />}
                color="#4ADE80"
                onClick={() => setActiveTab('website')}
              />
              <QuickActionCard
                title="Kitchen Display"
                description="Open KDS for real-time orders"
                icon={<UtensilsCrossed size={24} />}
                color="#F87171"
                onClick={() => { /* Open KDS in new window */ }}
              />
            </div>
          </div>
        )}

        {activeTab === 'rooms' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#FFFFFF' }}>Room Management</h1>
              <button
                onClick={() => setShowAddRoom(true)}
                style={{
                  padding: '10px 18px',
                  background: '#1F3B73',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Plus size={16} /> Add Room
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {hotel.rooms.map(room => (
                <RoomCard key={room.id} room={room} currency={hotel.settings.currency} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'bookings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#FFFFFF' }}>Bookings</h1>
            <div style={{ background: '#181818', border: '1px solid #222', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #222', background: '#141414' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#9CA3AF', fontSize: '12px' }}>GUEST</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#9CA3AF', fontSize: '12px' }}>ROOM</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#9CA3AF', fontSize: '12px' }}>CHECK IN</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#9CA3AF', fontSize: '12px' }}>CHECK OUT</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: '#9CA3AF', fontSize: '12px' }}>AMOUNT</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: '12px' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {hotel.rooms.flatMap(r => r.bookings).map(booking => (
                    <tr key={booking.id} style={{ borderBottom: '1px solid #1A1A1A' }}>
                      <td style={{ padding: '12px 16px', color: '#FFFFFF' }}>{booking.guestId}</td>
                      <td style={{ padding: '12px 16px', color: '#B3B3B3' }}>{hotel.rooms.find(r => r.id === booking.roomId)?.number}</td>
                      <td style={{ padding: '12px 16px', color: '#B3B3B3' }}>{formatDate(booking.checkIn)}</td>
                      <td style={{ padding: '12px 16px', color: '#B3B3B3' }}>{formatDate(booking.checkOut)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#4ADE80' }}>{formatCurrency(booking.totalAmount, hotel.settings.currency)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <StatusBadge status={booking.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#FFFFFF' }}>Menu Editor</h1>
              <button
                onClick={() => setShowAddMenuItem(true)}
                style={{
                  padding: '10px 18px',
                  background: '#1F3B73',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Plus size={16} /> Add Item
              </button>
            </div>
            {hotel.menuCategories.map(category => (
              <div key={category.id} style={{ background: '#181818', border: '1px solid #222', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: '#FFFFFF' }}>{category.name}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {category.items.map(item => (
                    <div key={item.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      background: '#141414',
                      borderRadius: '8px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '8px',
                          background: '#1A1A1A',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#6B7280',
                        }}>
                          {item.image ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} /> : <UtensilsCrossed size={20} />}
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: '#FFFFFF' }}>{item.name}</div>
                          <div style={{ fontSize: '12px', color: '#6B7280' }}>{item.description}</div>
                          <div style={{ fontSize: '12px', color: '#FACC15', marginTop: '2px' }}>{formatCurrency(item.price, hotel.settings.currency)}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          background: item.station === 'kitchen' ? '#0A3D1F' : item.station === 'bar' ? '#1E3A5F' : '#422006',
                          color: item.station === 'kitchen' ? '#4ADE80' : item.station === 'bar' ? '#60A5FA' : '#FACC15',
                          textTransform: 'uppercase',
                        }}>
                          {item.station}
                        </span>
                        <button style={{ padding: '6px', background: 'transparent', border: '1px solid #2C2C2C', borderRadius: '6px', color: '#9CA3AF', cursor: 'pointer' }}>
                          <Edit2 size={14} />
                        </button>
                        <button style={{ padding: '6px', background: 'transparent', border: '1px solid #2C2C2C', borderRadius: '6px', color: '#F87171', cursor: 'pointer' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'staff' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#FFFFFF' }}>Staff Management</h1>
            <div style={{ background: '#181818', border: '1px solid #222', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #222', background: '#141414' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#9CA3AF', fontSize: '12px' }}>NAME</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#9CA3AF', fontSize: '12px' }}>ROLE</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#9CA3AF', fontSize: '12px' }}>PHONE</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: '12px' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: '12px' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {hotel.staff.map(staff => (
                    <tr key={staff.id} style={{ borderBottom: '1px solid #1A1A1A' }}>
                      <td style={{ padding: '12px 16px', color: '#FFFFFF', fontWeight: 500 }}>{staff.name}</td>
                      <td style={{ padding: '12px 16px', color: '#B3B3B3', textTransform: 'capitalize' }}>{staff.role}</td>
                      <td style={{ padding: '12px 16px', color: '#B3B3B3' }}>{staff.phone}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <StatusBadge status={staff.isActive ? 'active' : 'inactive'} />
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button style={{ padding: '6px', background: 'transparent', border: '1px solid #2C2C2C', borderRadius: '6px', color: '#9CA3AF', cursor: 'pointer' }}>
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'website' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#FFFFFF' }}>Website Builder</h1>
            <div style={{
              background: '#181818',
              border: '1px solid #222',
              borderRadius: '12px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#FFFFFF' }}>Public Website</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7280' }}>
                    Your hotel website is live at: <span style={{ color: '#60A5FA' }}>https://{hotel.subdomain}.kobe</span>
                  </p>
                </div>
                <button style={{
                  padding: '10px 18px',
                  background: '#1F3B73',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}>
                  <Eye size={16} style={{ marginRight: '6px' }} /> Preview
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hotel Name</label>
                  <input type="text" defaultValue={hotel.name} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subdomain</label>
                  <input type="text" defaultValue={hotel.subdomain} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</label>
                  <input type="text" defaultValue={hotel.phone} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</label>
                  <input type="text" defaultValue={hotel.email} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Address</label>
                <textarea defaultValue={hotel.address} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B3B3B3', fontSize: '14px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hotel.settings.enableQROrdering} readOnly />
                  Enable QR Ordering
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B3B3B3', fontSize: '14px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hotel.settings.enableRoomService} readOnly />
                  Enable Room Service
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#FFFFFF' }}>Analytics</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <StatCard title="Occupancy Rate" value={`${stats.occupancyRate}%`} icon={<Percent size={18} />} color="#60A5FA" />
              <StatCard title="Avg Room Rate" value={formatCurrency(hotel.rooms[0]?.pricePerNight || 0, hotel.settings.currency)} icon={<DollarSign size={18} />} color="#4ADE80" />
              <StatCard title="Total Guests" value={hotel.rooms.filter(r => r.status === 'occupied').reduce((sum, r) => sum + (r.currentGuest ? 1 : 0), 0).toString()} icon={<Users size={18} />} color="#A78BFA" />
              <StatCard title="Rating" value="4.8" icon={<Star size={18} />} color="#FACC15" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Sub-components ---

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; subtitle?: string; trend?: string }> = ({ title, value, icon, color, subtitle, trend }) => (
  <div style={{ background: '#181818', border: '1px solid #222', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: '#9CA3AF', fontSize: '13px', fontWeight: 500, textTransform: 'uppercase' }}>{title}</span>
      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</div>
    </div>
    <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFFFFF' }}>{value}</div>
    {subtitle && <div style={{ fontSize: '12px', color: '#6B7280' }}>{subtitle}</div>}
    {trend && <div style={{ fontSize: '12px', color: '#4ADE80' }}>{trend}</div>}
  </div>
);

const QuickActionCard: React.FC<{ title: string; description: string; icon: React.ReactNode; color: string; onClick: () => void }> = ({ title, description, icon, color, onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: '#181818',
      border: '1px solid #222',
      borderRadius: '12px',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      cursor: 'pointer',
      textAlign: 'left',
      color: 'inherit',
      transition: 'all 0.15s',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = '#1A1A1A'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.background = '#181818'; }}
  >
    <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF' }}>{title}</div>
      <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>{description}</div>
    </div>
  </button>
);

const RoomCard: React.FC<{ room: Room; currency: string }> = ({ room, currency }) => {
  const statusColors = getStatusColor(room.status);
  return (
    <div style={{ background: '#181818', border: '1px solid #222', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>Room {room.number}</div>
          <div style={{ fontSize: '13px', color: '#6B7280' }}>{room.type} · Floor {room.floor}</div>
        </div>
        <span style={{
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 600,
          background: statusColors.bg,
          color: statusColors.text,
          border: `1px solid ${statusColors.border}`,
          textTransform: 'uppercase',
        }}>
          {room.status}
        </span>
      </div>
      <div style={{ fontSize: '20px', fontWeight: 700, color: '#4ADE80' }}>{formatCurrency(room.pricePerNight, currency)}<span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 400 }}>/night</span></div>
      {room.currentGuest && (
        <div style={{ padding: '10px', background: '#0F1115', borderRadius: '8px', border: '1px solid #222' }}>
          <div style={{ fontSize: '12px', color: '#6B7280' }}>Current Guest</div>
          <div style={{ fontSize: '14px', color: '#FFFFFF', fontWeight: 500 }}>{room.currentGuest.name}</div>
          <div style={{ fontSize: '12px', color: '#9CA3AF' }}>Until {formatDate(room.currentGuest.checkOutDate)}</div>
        </div>
      )}
      {room.qrCode && (
        <div style={{ fontSize: '12px', color: '#60A5FA', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <QrCode size={14} /> QR Code Active
        </div>
      )}
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors = getStatusColor(status);
  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: 600,
      background: colors.bg,
      color: colors.text,
      border: `1px solid ${colors.border}`,
      textTransform: 'uppercase',
    }}>
      {status.replace('-', ' ')}
    </span>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: '#1A1A1A',
  border: '1px solid #2C2C2C',
  borderRadius: '8px',
  color: '#FFFFFF',
  fontSize: '14px',
  marginTop: '6px',
  outline: 'none',
};

export default HotelAdminDashboard;
