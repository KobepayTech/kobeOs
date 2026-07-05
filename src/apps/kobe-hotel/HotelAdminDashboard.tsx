// ============================================================================
// KOBE HOTEL ADMIN DASHBOARD — Behance-Style Multi-Hotel Management
// ============================================================================
// Glassmorphism Aladin OS theme with multi-hotel support, KPI cards, charts,
// and comprehensive hotel management: rooms, bookings, guests, restaurant,
// parking, financials, analytics, and website builder.
// ============================================================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Building2, Bed, Calendar, Users,
  UtensilsCrossed, Car, DollarSign, BarChart3, Globe,
  Bell, ChevronDown, Search, Plus, Edit2, Trash2, Eye,
  CheckCircle, X, TrendingUp, TrendingDown, Minus,
  ChefHat, QrCode, Star, Percent, Phone, Mail, MapPin,
  Clock, ArrowUpRight, ArrowDownRight, Filter, Download,
  Settings, LogOut, Shield, Wifi, Coffee, Waves, Dumbbell,
  CreditCard, Receipt, Wallet, CircleDollarSign, UserPlus,
  CarFront, Bike, ParkingSquare, FileText, MoreHorizontal,
  XCircle, HelpCircle, Megaphone
} from 'lucide-react';
import type { Hotel, Room, Booking, Guest, MenuCategory, MenuItem, StaffMember, Order, OrderItem } from '@/shared/types';
import { formatCurrency, formatDate, getStatusColor, classNames } from '@/shared/utils';
import { api } from '@/lib/api';

// ── Tab Types ───────────────────────────────────────────────────────────────
type TabType =
  | 'overview' | 'hotels' | 'rooms' | 'bookings' | 'guests'
  | 'restaurant' | 'parking' | 'financials' | 'analytics' | 'website';

// ── Extended Types ──────────────────────────────────────────────────────────
interface GuestProfile extends Guest {
  email?: string;
  nationality?: string;
  idType?: 'passport' | 'national_id' | 'driving_license';
  idNumber?: string;
  checkInCount: number;
  lastStay?: string;
  notes?: string;
}

interface ParkingSpot {
  id: string;
  number: string;
  type: 'car' | 'motorcycle' | 'vip';
  status: 'free' | 'occupied' | 'reserved';
  vehiclePlate?: string;
  vehicleModel?: string;
  guestName?: string;
  checkInTime?: string;
  checkOutTime?: string;
}

interface HotelRecord {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'maintenance' | 'closed';
  rooms: Room[];
  bookings: Booking[];
  guests: GuestProfile[];
  staff: StaffMember[];
  menuCategories: MenuCategory[];
  orders: Order[];
  parkingSpots: ParkingSpot[];
  revenueToday: number;
  revenueThisMonth: number;
  expensesToday: number;
  currency: string;
  subdomain: string;
  phone: string;
  email: string;
  address: string;
  settings: {
    checkInTime: string;
    checkOutTime: string;
    currency: string;
    taxRate: number;
    serviceCharge: number;
    enableQROrdering: boolean;
    enableRoomService: boolean;
  };
}

// ── Mock Data: Multi-Hotel ──────────────────────────────────────────────────
const MOCK_HOTELS: HotelRecord[] = [
  {
    id: 'h1', name: 'Kobe Grand Hotel', location: 'Dar es Salaam, TZ', status: 'active',
    currency: 'TZS', revenueToday: 1850000, revenueThisMonth: 45200000, expensesToday: 620000,
    subdomain: 'grand', phone: '+255 744 123 456', email: 'grand@kobe.co.tz',
    address: '123 Samora Avenue, Dar es Salaam',
    settings: { checkInTime: '14:00', checkOutTime: '11:00', currency: 'TZS', taxRate: 18, serviceCharge: 5, enableQROrdering: true, enableRoomService: true },
    staff: [
      { id: 's1', name: 'John Mwinyi', phone: '+255 744 111 222', email: 'john@kobe.co.tz', role: 'manager', pin: '1234', isActive: true, permissions: ['all'] },
      { id: 's2', name: 'Amina Hassan', phone: '+255 744 333 444', email: 'amina@kobe.co.tz', role: 'receptionist', pin: '2345', isActive: true, permissions: ['bookings', 'guests'] },
      { id: 's3', name: 'David Kimaro', phone: '+255 744 555 666', role: 'chef', pin: '3456', isActive: true, permissions: ['kitchen'] },
      { id: 's4', name: 'Grace Joseph', phone: '+255 744 777 888', role: 'housekeeping', pin: '4567', isActive: true, permissions: ['rooms'] },
    ],
    parkingSpots: [
      { id: 'p1', number: 'P-01', type: 'car', status: 'occupied', vehiclePlate: 'T123 ABC', vehicleModel: 'Toyota Prado', guestName: 'Michael Brown', checkInTime: '2026-01-15T08:00:00' },
      { id: 'p2', number: 'P-02', type: 'car', status: 'free' },
      { id: 'p3', number: 'P-03', type: 'car', status: 'reserved' },
      { id: 'p4', number: 'P-04', type: 'vip', status: 'occupied', vehiclePlate: 'T456 DEF', vehicleModel: 'BMW X5', guestName: 'Sarah Johnson', checkInTime: '2026-01-15T10:30:00' },
      { id: 'p5', number: 'P-05', type: 'motorcycle', status: 'free' },
      { id: 'p6', number: 'P-06', type: 'car', status: 'free' },
      { id: 'p7', number: 'P-07', type: 'car', status: 'occupied', vehiclePlate: 'T789 GHI', vehicleModel: 'Nissan Patrol', guestName: 'James Wilson', checkInTime: '2026-01-14T16:00:00' },
      { id: 'p8', number: 'P-08', type: 'car', status: 'free' },
      { id: 'p9', number: 'P-09', type: 'motorcycle', status: 'occupied', vehiclePlate: 'T321 JKL', vehicleModel: 'Honda CBR', guestName: 'Alice Smith' },
      { id: 'p10', number: 'P-10', type: 'vip', status: 'free' },
      { id: 'p11', number: 'P-11', type: 'car', status: 'free' },
      { id: 'p12', number: 'P-12', type: 'car', status: 'reserved' },
    ],
    bookings: [], rooms: [], menuCategories: [], orders: [], guests: [],
  },
  {
    id: 'h2', name: 'Kobe Beach Resort', location: 'Zanzibar, TZ', status: 'active',
    currency: 'TZS', revenueToday: 2100000, revenueThisMonth: 38900000, expensesToday: 780000,
    subdomain: 'beach', phone: '+255 744 999 000', email: 'beach@kobe.co.tz',
    address: '45 Nungwi Road, Zanzibar',
    settings: { checkInTime: '15:00', checkOutTime: '12:00', currency: 'TZS', taxRate: 18, serviceCharge: 5, enableQROrdering: true, enableRoomService: true },
    staff: [
      { id: 's5', name: 'Fatima Omar', phone: '+255 744 222 333', email: 'fatima@kobe.co.tz', role: 'manager', pin: '5678', isActive: true, permissions: ['all'] },
      { id: 's6', name: 'Omar Salim', phone: '+255 744 444 555', role: 'chef', pin: '6789', isActive: true, permissions: ['kitchen'] },
    ],
    parkingSpots: [
      { id: 'p13', number: 'A-01', type: 'car', status: 'occupied', vehiclePlate: 'T555 MNO', vehicleModel: 'Land Cruiser', guestName: 'Robert Chen' },
      { id: 'p14', number: 'A-02', type: 'car', status: 'free' },
      { id: 'p15', number: 'A-03', type: 'car', status: 'free' },
      { id: 'p16', number: 'A-04', type: 'motorcycle', status: 'occupied', vehiclePlate: 'T777 PQR', vehicleModel: 'Yamaha R1', guestName: 'Lisa Wang' },
    ],
    bookings: [], rooms: [], menuCategories: [], orders: [], guests: [],
  },
  {
    id: 'h3', name: 'Kobe Business Inn', location: 'Arusha, TZ', status: 'active',
    currency: 'TZS', revenueToday: 950000, revenueThisMonth: 21400000, expensesToday: 410000,
    subdomain: 'business', phone: '+255 744 666 777', email: 'arusha@kobe.co.tz',
    address: '78 Sokoine Road, Arusha',
    settings: { checkInTime: '14:00', checkOutTime: '11:00', currency: 'TZS', taxRate: 18, serviceCharge: 5, enableQROrdering: true, enableRoomService: false },
    staff: [
      { id: 's7', name: 'Peter Mosha', phone: '+255 744 888 999', email: 'peter@kobe.co.tz', role: 'manager', pin: '7890', isActive: true, permissions: ['all'] },
    ],
    parkingSpots: [
      { id: 'p17', number: 'B-01', type: 'car', status: 'free' },
      { id: 'p18', number: 'B-02', type: 'car', status: 'occupied', vehiclePlate: 'T888 STU', vehicleModel: 'Mazda CX-5', guestName: 'Emma Davis' },
      { id: 'p19', number: 'B-03', type: 'car', status: 'free' },
      { id: 'p20', number: 'B-04', type: 'car', status: 'reserved' },
    ],
    bookings: [], rooms: [], menuCategories: [], orders: [], guests: [],
  },
  {
    id: 'h4', name: 'Kobe Safari Lodge', location: 'Serengeti, TZ', status: 'maintenance',
    currency: 'TZS', revenueToday: 0, revenueThisMonth: 8500000, expensesToday: 320000,
    subdomain: 'safari', phone: '+255 744 000 111', email: 'safari@kobe.co.tz',
    address: 'Serengeti National Park',
    settings: { checkInTime: '12:00', checkOutTime: '10:00', currency: 'TZS', taxRate: 18, serviceCharge: 5, enableQROrdering: false, enableRoomService: true },
    staff: [
      { id: 's8', name: 'Martha Lema', phone: '+255 744 123 789', role: 'manager', pin: '8901', isActive: true, permissions: ['all'] },
    ],
    parkingSpots: [
      { id: 'p21', number: 'S-01', type: 'car', status: 'free' },
      { id: 'p22', number: 'S-02', type: 'car', status: 'free' },
      { id: 'p23', number: 'S-03', type: 'vip', status: 'free' },
    ],
    bookings: [], rooms: [], menuCategories: [], orders: [], guests: [],
  },
];

// Populate rooms for each hotel
const roomTypes = ['Standard', 'Deluxe', 'Suite', 'Presidential'];
const roomAmenities = ['WiFi', 'AC', 'TV', 'Minibar', 'Safe', 'Balcony', 'Sea View', 'Kitchenette'];
MOCK_HOTELS.forEach((hotel, hi) => {
  const roomCount = [12, 8, 6, 4][hi];
  for (let i = 1; i <= roomCount; i++) {
    const status = i <= 3 ? 'occupied' : i <= 5 ? 'maintenance' : 'available';
    const type = roomTypes[i % roomTypes.length];
    const price = type === 'Standard' ? 85000 : type === 'Deluxe' ? 150000 : type === 'Suite' ? 280000 : 450000;
    const booking: Booking = {
      id: `b${hi}-${i}`, guestId: `Guest ${i}`, roomId: `r${hi}-${i}`,
      checkIn: '2026-01-10', checkOut: '2026-01-20',
      status: i <= 2 ? 'checked-in' : 'confirmed',
      totalAmount: price * 10, paidAmount: price * 5,
      source: i % 2 === 0 ? 'online' : 'walk-in',
    };
    const room: Room = {
      id: `r${hi}-${i}`, number: `${100 + i}`, type, floor: Math.ceil(i / 4),
      pricePerNight: price, status: status as any, capacity: 2 + (i % 3),
      amenities: roomAmenities.slice(0, 3 + (i % 5)),
      qrCode: status === 'occupied' ? `qr-${hi}-${i}` : undefined,
      currentGuest: status === 'occupied' ? {
        id: `g${hi}-${i}`, name: `Guest ${i}`, phone: `+255 744 ${100000 + i * 111}`,
        checkInDate: '2026-01-10', checkOutDate: '2026-01-20',
      } : undefined,
      bookings: [booking],
    };
    hotel.rooms.push(room);
    hotel.bookings.push(booking);
  }
  // Add guests
  for (let i = 1; i <= 6; i++) {
    hotel.guests.push({
      id: `gp${hi}-${i}`, name: ['Michael Brown', 'Sarah Johnson', 'James Wilson', 'Alice Smith', 'Robert Chen', 'Emma Davis'][i - 1],
      phone: `+255 744 ${200000 + hi * 1000 + i * 111}`,
      email: `guest${i}@email.com`, nationality: ['US', 'UK', 'Germany', 'France', 'China', 'Canada'][i - 1],
      idType: i % 2 === 0 ? 'passport' : 'national_id',
      idNumber: `ID${100000 + i}`, checkInCount: 1 + (i % 4), lastStay: '2026-01-15',
      checkInDate: '2026-01-10', checkOutDate: '2026-01-20',
    });
  }
  // Add menu categories & orders
  hotel.menuCategories = [
    {
      id: `mc${hi}-1`, name: 'Breakfast', sortOrder: 1,
      items: [
        { id: `mi${hi}-1`, categoryId: `mc${hi}-1`, name: 'Full English Breakfast', description: 'Eggs, bacon, sausage, beans, toast', price: 25000, isAvailable: true, preparationTime: 15, station: 'kitchen' },
        { id: `mi${hi}-2`, categoryId: `mc${hi}-1`, name: 'Continental Breakfast', description: 'Croissants, jam, butter, coffee', price: 18000, isAvailable: true, preparationTime: 5, station: 'kitchen' },
        { id: `mi${hi}-3`, categoryId: `mc${hi}-1`, name: 'Tropical Fruit Platter', description: 'Seasonal fresh fruits', price: 15000, isAvailable: true, preparationTime: 10, station: 'kitchen' },
      ],
    },
    {
      id: `mc${hi}-2`, name: 'Main Course', sortOrder: 2,
      items: [
        { id: `mi${hi}-4`, categoryId: `mc${hi}-2`, name: 'Grilled Tilapia', description: 'Fresh lake fish with ugali and vegetables', price: 35000, isAvailable: true, preparationTime: 25, station: 'grill' },
        { id: `mi${hi}-5`, categoryId: `mc${hi}-2`, name: 'Chicken Biryani', description: 'Aromatic rice with spiced chicken', price: 28000, isAvailable: true, preparationTime: 30, station: 'kitchen' },
        { id: `mi${hi}-6`, categoryId: `mc${hi}-2`, name: 'Beef Steak', description: '300g sirloin with mashed potatoes', price: 45000, isAvailable: true, preparationTime: 20, station: 'grill' },
      ],
    },
    {
      id: `mc${hi}-3`, name: 'Beverages', sortOrder: 3,
      items: [
        { id: `mi${hi}-7`, categoryId: `mc${hi}-3`, name: 'Fresh Juice', description: 'Orange, mango, or passion', price: 8000, isAvailable: true, preparationTime: 5, station: 'bar' },
        { id: `mi${hi}-8`, categoryId: `mc${hi}-3`, name: 'Espresso', description: 'Double shot Italian roast', price: 6000, isAvailable: true, preparationTime: 3, station: 'bar' },
        { id: `mi${hi}-9`, categoryId: `mc${hi}-3`, name: 'Tropical Cocktail', description: 'Rum, pineapple, coconut cream', price: 18000, isAvailable: true, preparationTime: 5, station: 'bar' },
      ],
    },
  ];
  // Add orders
  hotel.orders = [
    { id: `o${hi}-1`, tableId: `t${hi}-1`, items: [{ id: `oi${hi}-1`, menuItemId: `mi${hi}-1`, name: 'Full English Breakfast', quantity: 2, unitPrice: 25000, totalPrice: 50000, station: 'kitchen', status: 'ready' }], status: 'ready', subtotal: 50000, tax: 9000, serviceCharge: 2500, total: 61500, paymentStatus: 'unpaid', station: 'kitchen', createdAt: '2026-01-15T07:30:00', updatedAt: '2026-01-15T07:45:00' },
    { id: `o${hi}-2`, roomId: `r${hi}-1`, guestName: 'Michael Brown', items: [{ id: `oi${hi}-2`, menuItemId: `mi${hi}-7`, name: 'Fresh Juice', quantity: 1, unitPrice: 8000, totalPrice: 8000, station: 'bar', status: 'served' }], status: 'served', subtotal: 8000, tax: 1440, serviceCharge: 400, total: 9840, paymentStatus: 'paid', station: 'bar', createdAt: '2026-01-15T08:00:00', updatedAt: '2026-01-15T08:10:00' },
    { id: `o${hi}-3`, tableId: `t${hi}-2`, items: [{ id: `oi${hi}-3`, menuItemId: `mi${hi}-4`, name: 'Grilled Tilapia', quantity: 1, unitPrice: 35000, totalPrice: 35000, station: 'grill', status: 'preparing' }], status: 'preparing', subtotal: 35000, tax: 6300, serviceCharge: 1750, total: 43050, paymentStatus: 'unpaid', station: 'grill', createdAt: '2026-01-15T09:00:00', updatedAt: '2026-01-15T09:05:00' },
  ];
});

// ── Backend row shapes (server/src/hotel) ───────────────────────────────────
interface ApiTenant { id: string; slug: string; name: string; brandColor?: string | null; logoUrl?: string | null; currency: string; }
interface ApiPortfolioEntry { id: string; slug: string; name: string; currency: string; roomsTotal: number; occupied: number; occupancyRate: number; revenueToday: number; alerts: number; }
interface ApiRoom { id: string; roomNumber: string; type: string; rate: number | string; currency: string; capacity: number; status: 'available' | 'occupied' | 'reserved' | 'maintenance'; hotelId?: string | null; }
interface ApiGuest { id: string; name: string; phone: string; email?: string | null; nationality?: string | null; idType?: string | null; idNumber?: string | null; hotelId?: string | null; }
interface ApiBooking { id: string; roomId: string; guestId: string; checkIn: string; checkOut: string; guestCount: number; status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED'; totalAmount: number | string; currency: string; hotelId?: string | null; }
interface ApiMenuItem { id: string; name: string; category: string; price: number | string; currency: string; available: boolean; station: 'kitchen' | 'bar' | 'other'; hotelId?: string | null; }
interface ApiOrderItem { menuItemId?: string; name: string; qty: number; price: number | string; station?: 'kitchen' | 'bar' | 'other'; }
interface ApiOrder { id: string; roomNumber: string; locationType: 'room' | 'table'; guestName?: string | null; items: ApiOrderItem[]; total: number | string; currency: string; status: 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED'; note: string; hotelId?: string | null; createdAt?: string; updatedAt?: string; }
interface ApiStaff { id: string; name: string; role: string; phone: string; email?: string | null; status: 'active' | 'off' | 'suspended'; hotelId?: string | null; }
interface ApiParkingSpot { id: string; hotelId: string; spotNumber: string; type: 'car' | 'motorcycle' | 'bus' | 'handicap'; status: 'free' | 'occupied' | 'reserved' | 'maintenance'; vehiclePlate?: string; vehicleModel?: string; guestId?: string | null; ratePerDay: number | string; }
interface ApiFinancialRecord { id: string; hotelId: string; category: string; amount: number | string; currency: string; recordDate: string; description: string; granularity: 'daily' | 'weekly' | 'monthly'; }

const num = (v: unknown): number => (typeof v === 'number' ? v : parseFloat(String(v ?? 0)) || 0);

function mapBookingStatus(s: ApiBooking['status']): Booking['status'] {
  switch (s) {
    case 'CHECKED_IN': return 'checked-in';
    case 'CHECKED_OUT': return 'checked-out';
    case 'CANCELLED': return 'cancelled';
    default: return 'confirmed';
  }
}
function mapOrderStatus(s: ApiOrder['status']): Order['status'] {
  switch (s) {
    case 'ACCEPTED':
    case 'PREPARING': return 'preparing';
    case 'READY': return 'ready';
    case 'DELIVERED': return 'served';
    case 'CANCELLED': return 'cancelled';
    default: return 'pending';
  }
}
function mapStation(s?: string): 'kitchen' | 'bar' | 'dessert' | 'grill' {
  return s === 'bar' ? 'bar' : 'kitchen';
}

/** Map the real backend rows onto the exact HotelRecord[] shape the UI consumes.
 *  Records whose hotelId is null / unknown (legacy single-hotel rows) are
 *  attached to the first property so nothing is dropped. Returns [] when there
 *  are no properties, signalling the caller to keep MOCK_HOTELS. */
function buildHotelsFromApi(
  tenants: ApiTenant[],
  portfolio: ApiPortfolioEntry[],
  rooms: ApiRoom[],
  guests: ApiGuest[],
  bookings: ApiBooking[],
  menuItems: ApiMenuItem[],
  orders: ApiOrder[],
  staff: ApiStaff[],
  parkingByHotel: Record<string, ApiParkingSpot[]>,
  financialsByHotel: Record<string, ApiFinancialRecord[]>,
): HotelRecord[] {
  if (tenants.length === 0) return [];
  const primaryId = tenants[0].id;
  const known = new Set(tenants.map(t => t.id));
  const hotelIdOf = (hid?: string | null): string => (hid && known.has(hid) ? hid : primaryId);

  const guestById = new Map(guests.map(g => [g.id, g]));
  const bookingCount = new Map<string, number>();
  for (const b of bookings) bookingCount.set(b.guestId, (bookingCount.get(b.guestId) ?? 0) + 1);
  const portfolioById = new Map(portfolio.map(p => [p.id, p]));

  return tenants.map(t => {
    const hRooms = rooms.filter(r => hotelIdOf(r.hotelId) === t.id);
    const hBookings = bookings.filter(b => hotelIdOf(b.hotelId) === t.id);
    const hGuests = guests.filter(g => hotelIdOf(g.hotelId) === t.id);
    const hMenu = menuItems.filter(m => hotelIdOf(m.hotelId) === t.id);
    const hOrders = orders.filter(o => hotelIdOf(o.hotelId) === t.id);
    const hStaff = staff.filter(s => hotelIdOf(s.hotelId) === t.id);

    const mappedBookings: Booking[] = hBookings.map(b => ({
      id: b.id,
      guestId: guestById.get(b.guestId)?.name ?? b.guestId,
      roomId: b.roomId,
      checkIn: String(b.checkIn),
      checkOut: String(b.checkOut),
      status: mapBookingStatus(b.status),
      totalAmount: num(b.totalAmount),
      paidAmount: 0,
      source: 'online',
    }));

    const rawByRoom = new Map<string, ApiBooking[]>();
    for (const b of hBookings) {
      const arr = rawByRoom.get(b.roomId) ?? [];
      arr.push(b); rawByRoom.set(b.roomId, arr);
    }
    const mappedByRoom = new Map<string, Booking[]>();
    for (const b of mappedBookings) {
      const arr = mappedByRoom.get(b.roomId) ?? [];
      arr.push(b); mappedByRoom.set(b.roomId, arr);
    }

    const mappedRooms: Room[] = hRooms.map(r => {
      const active = (rawByRoom.get(r.id) ?? []).find(b => b.status === 'CHECKED_IN');
      const g = active ? guestById.get(active.guestId) : undefined;
      return {
        id: r.id,
        number: r.roomNumber,
        type: r.type,
        floor: 1,
        pricePerNight: num(r.rate),
        status: r.status,
        capacity: r.capacity,
        amenities: [],
        qrCode: undefined,
        currentGuest: r.status === 'occupied' && active ? {
          id: g?.id ?? active.guestId,
          name: g?.name ?? 'Guest',
          phone: g?.phone ?? '',
          email: g?.email ?? undefined,
          checkInDate: String(active.checkIn),
          checkOutDate: String(active.checkOut),
          idNumber: g?.idNumber ?? undefined,
        } : undefined,
        bookings: mappedByRoom.get(r.id) ?? [],
      };
    });

    const mappedGuests: GuestProfile[] = hGuests.map(g => ({
      id: g.id,
      name: g.name,
      phone: g.phone,
      email: g.email ?? undefined,
      nationality: g.nationality ?? undefined,
      idType: (g.idType as GuestProfile['idType']) ?? undefined,
      idNumber: g.idNumber ?? undefined,
      checkInCount: bookingCount.get(g.id) ?? 0,
      checkInDate: '',
      checkOutDate: '',
    }));

    const catMap = new Map<string, MenuItem[]>();
    hMenu.forEach(m => {
      const arr = catMap.get(m.category) ?? [];
      arr.push({
        id: m.id,
        categoryId: m.category,
        name: m.name,
        description: '',
        price: num(m.price),
        isAvailable: m.available,
        preparationTime: 0,
        station: mapStation(m.station),
      });
      catMap.set(m.category, arr);
    });
    const menuCategories: MenuCategory[] = Array.from(catMap.entries()).map(([name, items], i) => ({
      id: `${t.id}-cat-${i}`, name, sortOrder: i + 1, items,
    }));

    const mappedOrders: Order[] = hOrders.map(o => {
      const items: OrderItem[] = (o.items ?? []).map((it, i) => ({
        id: `${o.id}-${i}`,
        menuItemId: it.menuItemId ?? '',
        name: it.name,
        quantity: it.qty,
        unitPrice: num(it.price),
        totalPrice: num(it.price) * it.qty,
        station: mapStation(it.station),
        status: 'pending',
      }));
      const stations = new Set(items.map(it => it.station));
      const station: Order['station'] = items.length === 0 ? 'kitchen' : stations.size > 1 ? 'mixed' : items[0].station;
      return {
        id: o.id,
        roomId: o.locationType === 'room' ? o.roomNumber : undefined,
        tableId: o.locationType === 'table' ? o.roomNumber : undefined,
        guestName: o.guestName ?? undefined,
        items,
        status: mapOrderStatus(o.status),
        subtotal: num(o.total),
        tax: 0,
        serviceCharge: 0,
        total: num(o.total),
        paymentStatus: 'unpaid',
        station,
        createdAt: o.createdAt ?? new Date().toISOString(),
        updatedAt: o.updatedAt ?? new Date().toISOString(),
      };
    });

    const mappedStaff: StaffMember[] = hStaff.map(s => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      email: s.email ?? undefined,
      role: (s.role as StaffMember['role']) ?? 'receptionist',
      pin: '',
      isActive: s.status === 'active',
      permissions: [],
    }));

    const mappedParking: ParkingSpot[] = (parkingByHotel[t.id] ?? []).map(p => ({
      id: p.id,
      number: p.spotNumber,
      type: p.type === 'motorcycle' ? 'motorcycle' : 'car',
      status: p.status === 'occupied' ? 'occupied' : p.status === 'free' ? 'free' : 'reserved',
      vehiclePlate: p.vehiclePlate,
      vehicleModel: p.vehicleModel,
      guestName: p.guestId ? guestById.get(p.guestId)?.name : undefined,
    }));

    const fin = financialsByHotel[t.id] ?? [];
    const revenueThisMonth = fin.filter(f => f.category.includes('revenue')).reduce((s, f) => s + num(f.amount), 0);
    const expensesToday = fin.filter(f => f.category.includes('expense')).reduce((s, f) => s + num(f.amount), 0);
    const pf = portfolioById.get(t.id);
    const revenueToday = pf ? num(pf.revenueToday) : 0;

    return {
      id: t.id,
      name: t.name,
      location: '',
      status: 'active',
      currency: t.currency,
      revenueToday,
      revenueThisMonth: revenueThisMonth || revenueToday,
      expensesToday,
      subdomain: t.slug,
      phone: '',
      email: '',
      address: '',
      settings: { checkInTime: '14:00', checkOutTime: '11:00', currency: t.currency, taxRate: 18, serviceCharge: 5, enableQROrdering: true, enableRoomService: true },
      staff: mappedStaff,
      parkingSpots: mappedParking,
      bookings: mappedBookings,
      rooms: mappedRooms,
      menuCategories,
      orders: mappedOrders,
      guests: mappedGuests,
    };
  });
}

// ── Component ───────────────────────────────────────────────────────────────

export const HotelAdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedHotelId, setSelectedHotelId] = useState<string>('all');
  const [hotelSelectorOpen, setHotelSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('all');
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [showAddHotel, setShowAddHotel] = useState(false);
  const [showAssignSpot, setShowAssignSpot] = useState(false);
  const [guestSearch, setGuestSearch] = useState('');
  const [financialPeriod, setFinancialPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Live data ───────────────────────────────────────────────────────────────
  // Start from MOCK_HOTELS so the demo renders instantly, then hydrate from the
  // real backend. `liveData` gates writes so the "Add …" dialogs only POST when
  // we're on real (uuid-keyed) properties.
  const [hotels, setHotels] = useState<HotelRecord[]>(MOCK_HOTELS);
  const [liveData, setLiveData] = useState(false);

  // Add-dialog form state.
  const [roomForm, setRoomForm] = useState({ number: '', type: 'Standard', price: '', capacity: '' });
  const [guestForm, setGuestForm] = useState({ name: '', phone: '', email: '', idType: 'passport', idNumber: '' });
  const [hotelForm, setHotelForm] = useState({ name: '', location: '', rooms: '', phone: '', email: '' });

  // ── Derived data ──────────────────────────────────────────────────────────
  const selectedHotel = useMemo(() =>
    hotels.find(h => h.id === selectedHotelId),
    [selectedHotelId, hotels]
  );

  const allHotels = hotels;

  const loadHotels = useCallback(async () => {
    try {
      const [tenants, portfolio, rooms, guests, bookings, menuItems, orders, staff] = await Promise.all([
        api<ApiTenant[]>('/hotel/properties').catch(() => [] as ApiTenant[]),
        api<ApiPortfolioEntry[]>('/hotel/portfolio').catch(() => [] as ApiPortfolioEntry[]),
        api<ApiRoom[]>('/hotel/rooms?limit=100').catch(() => [] as ApiRoom[]),
        api<ApiGuest[]>('/hotel/guests?limit=100').catch(() => [] as ApiGuest[]),
        api<ApiBooking[]>('/hotel/bookings?limit=100').catch(() => [] as ApiBooking[]),
        api<ApiMenuItem[]>('/hotel/menu-items?limit=100').catch(() => [] as ApiMenuItem[]),
        api<ApiOrder[]>('/hotel/orders?limit=100').catch(() => [] as ApiOrder[]),
        api<ApiStaff[]>('/hotel/staff').catch(() => [] as ApiStaff[]),
      ]);
      if (!tenants || tenants.length === 0) return; // no real properties → keep MOCK_HOTELS

      const parkingByHotel: Record<string, ApiParkingSpot[]> = {};
      const financialsByHotel: Record<string, ApiFinancialRecord[]> = {};
      await Promise.all(tenants.map(async t => {
        parkingByHotel[t.id] = await api<ApiParkingSpot[]>(`/hotel/parking/${t.id}`).catch(() => [] as ApiParkingSpot[]);
        financialsByHotel[t.id] = await api<ApiFinancialRecord[]>(`/hotel/financials/${t.id}`).catch(() => [] as ApiFinancialRecord[]);
      }));

      const built = buildHotelsFromApi(tenants, portfolio, rooms, guests, bookings, menuItems, orders, staff, parkingByHotel, financialsByHotel);
      if (built.length > 0) {
        setHotels(built);
        setLiveData(true);
      }
    } catch {
      // Backend unreachable → keep the MOCK_HOTELS fallback already in state.
    }
  }, []);

  useEffect(() => { void loadHotels(); }, [loadHotels]);

  // ── Create handlers (POST → reload) ─────────────────────────────────────────
  const handleAddRoom = useCallback(async () => {
    const hotelId = selectedHotel?.id ?? hotels[0]?.id;
    try {
      await api('/hotel/rooms', {
        method: 'POST',
        body: JSON.stringify({
          roomNumber: roomForm.number,
          type: roomForm.type,
          rate: Number(roomForm.price) || 0,
          capacity: Number(roomForm.capacity) || 2,
          ...(liveData && hotelId ? { hotelId } : {}),
        }),
      });
      if (liveData) await loadHotels();
    } catch { /* offline / no backend — leave demo data intact */ }
    setRoomForm({ number: '', type: 'Standard', price: '', capacity: '' });
    setShowAddRoom(false);
  }, [roomForm, selectedHotel, hotels, liveData, loadHotels]);

  const handleAddGuest = useCallback(async () => {
    const hotelId = selectedHotel?.id ?? hotels[0]?.id;
    try {
      await api('/hotel/guests', {
        method: 'POST',
        body: JSON.stringify({
          name: guestForm.name,
          phone: guestForm.phone,
          ...(guestForm.email ? { email: guestForm.email } : {}),
          idType: guestForm.idType,
          ...(guestForm.idNumber ? { idNumber: guestForm.idNumber } : {}),
          ...(liveData && hotelId ? { hotelId } : {}),
        }),
      });
      if (liveData) await loadHotels();
    } catch { /* offline / no backend */ }
    setGuestForm({ name: '', phone: '', email: '', idType: 'passport', idNumber: '' });
    setShowAddGuest(false);
  }, [guestForm, selectedHotel, hotels, liveData, loadHotels]);

  const handleAddHotel = useCallback(async () => {
    let slug = (hotelForm.name || 'hotel').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 38);
    if (slug.length < 3) slug = `${slug || 'h'}-hotel`;
    try {
      await api('/hotel/properties', {
        method: 'POST',
        body: JSON.stringify({ slug, name: hotelForm.name || 'New Hotel' }),
      });
      await loadHotels();
    } catch { /* offline / no backend */ }
    setHotelForm({ name: '', location: '', rooms: '', phone: '', email: '' });
    setShowAddHotel(false);
  }, [hotelForm, loadHotels]);

  const aggregatedStats = useMemo(() => {
    const hotels = selectedHotel ? [selectedHotel] : allHotels;
    const allRooms = hotels.flatMap(h => h.rooms);
    const allBookings = hotels.flatMap(h => h.bookings);
    const allGuests = hotels.flatMap(h => h.guests);
    const allOrders = hotels.flatMap(h => h.orders);
    const totalRooms = allRooms.length;
    const occupiedRooms = allRooms.filter(r => r.status === 'occupied').length;
    const availableRooms = allRooms.filter(r => r.status === 'available').length;
    const maintenanceRooms = allRooms.filter(r => r.status === 'maintenance').length;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
    const totalRevenueToday = hotels.reduce((s, h) => s + h.revenueToday, 0);
    const totalRevenueMonth = hotels.reduce((s, h) => s + h.revenueThisMonth, 0);
    const totalExpensesToday = hotels.reduce((s, h) => s + h.expensesToday, 0);
    const activeGuests = allGuests.length;
    const pendingOrders = allOrders.filter(o => o.status === 'pending' || o.status === 'preparing').length;
    const totalStaff = hotels.reduce((s, h) => s + h.staff.length, 0);
    const totalParking = hotels.reduce((s, h) => s + h.parkingSpots.length, 0);
    const occupiedParking = hotels.reduce((s, h) => s + h.parkingSpots.filter(p => p.status === 'occupied').length, 0);
    return {
      hotelCount: hotels.length, totalRooms, occupiedRooms, availableRooms, maintenanceRooms,
      occupancyRate, totalRevenueToday, totalRevenueMonth, totalExpensesToday,
      activeGuests, pendingOrders, totalStaff, totalParking, occupiedParking,
      netProfit: totalRevenueToday - totalExpensesToday,
      allBookings, allGuests, allOrders, allRooms,
    };
  }, [selectedHotel, allHotels]);

  const occupancyData = useMemo(() => {
    return [65, 72, 68, 80, 75, 82, 78, 85, 70, 88, 76, 90, 82, 78, 70].map((v, i) => ({
      day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'][i],
      value: v,
    }));
  }, []);

  const revenueSources = useMemo(() => [
    { label: 'Room Revenue', value: 62, color: '#6366F1' },
    { label: 'Restaurant', value: 23, color: '#10B981' },
    { label: 'Services', value: 10, color: '#F59E0B' },
    { label: 'Parking', value: 5, color: '#EC4899' },
  ], []);

  // ── Navigation ────────────────────────────────────────────────────────────
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
    { id: 'hotels', label: 'Hotels', icon: <Building2 size={18} /> },
    { id: 'rooms', label: 'Rooms', icon: <Bed size={18} /> },
    { id: 'bookings', label: 'Bookings', icon: <Calendar size={18} /> },
    { id: 'guests', label: 'Guests', icon: <Users size={18} /> },
    { id: 'restaurant', label: 'Restaurant', icon: <UtensilsCrossed size={18} /> },
    { id: 'parking', label: 'Parking', icon: <Car size={18} /> },
    { id: 'financials', label: 'Financials', icon: <DollarSign size={18} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
    { id: 'website', label: 'Website', icon: <Globe size={18} /> },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: 'var(--os-wallpaper, linear-gradient(135deg, #E8E4F0 0%, #D4CCE8 50%, #EDE8F5 100%))' }}>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className={classNames(
          "flex flex-col transition-all duration-300 border-r flex-shrink-0",
          sidebarCollapsed ? "w-[72px]" : "w-[240px]"
        )}
        style={{ background: 'rgba(255,255,255,0.20)', backdropFilter: 'blur(24px)', borderColor: 'rgba(255,255,255,0.30)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.25)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
            <Building2 size={16} className="text-white" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Kobe Hotel</span>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={classNames(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer w-full",
                activeTab === tab.id
                  ? "bg-white/[0.35] shadow-sm"
                  : "hover:bg-white/[0.15]"
              )}
              style={{ color: activeTab === tab.id ? 'var(--os-text-primary, #2D2B55)' : 'rgba(45,43,85,0.55)' }}
              title={sidebarCollapsed ? tab.label : undefined}
            >
              <span className="flex-shrink-0">{tab.icon}</span>
              {!sidebarCollapsed && <span>{tab.label}</span>}
            </button>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="mx-3 mb-3 p-2 rounded-xl hover:bg-white/[0.15] transition-all flex items-center justify-center cursor-pointer"
          style={{ color: 'rgba(45,43,85,0.55)' }}
        >
          {sidebarCollapsed ? <ArrowDownRight size={16} className="-rotate-90" /> : <Minus size={16} />}
        </button>
      </aside>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top Bar */}
        <header
          className="flex items-center justify-between px-6 h-16 flex-shrink-0 border-b"
          style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(24px)', borderColor: 'rgba(255,255,255,0.25)' }}
        >
          {/* Left: Page title */}
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>
              {tabs.find(t => t.id === activeTab)?.label}
            </h1>
            {selectedHotel && (
              <span
                className="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5"
                style={{ background: 'rgba(99,102,241,0.12)', color: '#6366F1' }}
              >
                <MapPin size={10} />
                {selectedHotel.name}
              </span>
            )}
          </div>

          {/* Center: Hotel Selector */}
          <div className="relative">
            <button
              onClick={() => setHotelSelectorOpen(!hotelSelectorOpen)}
              className="flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer hover:shadow-sm"
              style={{ background: 'rgba(255,255,255,0.40)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.40)', color: 'var(--os-text-primary, #2D2B55)' }}
            >
              <Building2 size={15} className="opacity-60" />
              <span>{selectedHotel ? selectedHotel.name : 'All Hotels'}</span>
              <ChevronDown size={14} className={classNames("transition-transform", hotelSelectorOpen && "rotate-180")} />
            </button>
            {hotelSelectorOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setHotelSelectorOpen(false)} />
                <div
                  className="absolute top-full mt-2 left-0 w-72 rounded-2xl shadow-xl z-50 overflow-hidden border"
                  style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(24px)', borderColor: 'rgba(255,255,255,0.50)' }}
                >
                  <div className="p-2">
                    <button
                      onClick={() => { setSelectedHotelId('all'); setHotelSelectorOpen(false); }}
                      className={classNames(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer",
                        selectedHotelId === 'all' ? "bg-indigo-50 text-indigo-700 font-semibold" : "hover:bg-white/50"
                      )}
                    >
                      <LayoutDashboard size={16} />
                      <span>All Hotels</span>
                      <span className="ml-auto text-xs opacity-50">{allHotels.length} hotels</span>
                    </button>
                    <div className="my-1.5 mx-3 h-px" style={{ background: 'rgba(0,0,0,0.06)' }} />
                    {allHotels.map(h => (
                      <button
                        key={h.id}
                        onClick={() => { setSelectedHotelId(h.id); setHotelSelectorOpen(false); }}
                        className={classNames(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer",
                          selectedHotelId === h.id ? "bg-indigo-50 text-indigo-700 font-semibold" : "hover:bg-white/50"
                        )}
                      >
                        <div className="relative">
                          <Building2 size={16} />
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white"
                            style={{ background: h.status === 'active' ? '#10B981' : h.status === 'maintenance' ? '#F59E0B' : '#6B7280' }}
                          />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-medium">{h.name}</div>
                          <div className="text-xs opacity-50">{h.location}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right: Notifications + User */}
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-xl hover:bg-white/30 transition-all cursor-pointer" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border border-white" />
            </button>
            <div className="flex items-center gap-2.5 pl-3 border-l" style={{ borderColor: 'rgba(255,255,255,0.30)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                A
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-semibold" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Admin</div>
                <div className="text-xs opacity-50">Super Admin</div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-6">

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* OVERVIEW TAB                                               */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-6">
              {/* KPI Cards Row */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KpiCard title="Hotels" value={aggregatedStats.hotelCount} subtitle="+2 this month" icon={<Building2 size={18} />} accent="#6366F1" trend="up" />
                <KpiCard title="Rooms" value={`${aggregatedStats.occupiedRooms}/${aggregatedStats.totalRooms}`} subtitle={`${aggregatedStats.occupancyRate}% occupied`} icon={<Bed size={18} />} accent="#3B82F6" trend="up" />
                <KpiCard title="Guests" value={aggregatedStats.activeGuests} subtitle="+12 today" icon={<Users size={18} />} accent="#F59E0B" trend="up" />
                <KpiCard title="Revenue" value={formatCurrency(aggregatedStats.totalRevenueToday, 'TZS')} subtitle="+15% vs yest" icon={<DollarSign size={18} />} accent="#10B981" trend="up" />
                <KpiCard title="Occupancy" value={`${aggregatedStats.occupancyRate}%`} subtitle="5% this week" icon={<Percent size={18} />} accent="#8B5CF6" trend="up" />
                <KpiCard title="Orders" value={aggregatedStats.pendingOrders} subtitle={`${aggregatedStats.allOrders.filter(o => o.status === 'preparing').length} preparing`} icon={<UtensilsCrossed size={18} />} accent="#EC4899" trend="neutral" />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Occupancy Chart */}
                <GlassCard className="lg:col-span-2 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-sm" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Occupancy Rate — Last 15 Days</h3>
                    <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'rgba(99,102,241,0.10)', color: '#6366F1' }}>Daily</span>
                  </div>
                  <div className="flex items-end gap-2 h-40">
                    {occupancyData.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                        <div className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#6366F1' }}>{d.value}%</div>
                        <div
                          className="w-full rounded-t-md transition-all duration-500 hover:opacity-80"
                          style={{
                            height: `${d.value * 1.6}px`,
                            background: i === occupancyData.length - 1
                              ? 'linear-gradient(180deg, #6366F1, #8B5CF6)'
                              : 'linear-gradient(180deg, rgba(99,102,241,0.4), rgba(139,92,246,0.2))',
                          }}
                        />
                        <span className="text-[10px] opacity-40 font-medium">{d.day}</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                {/* Revenue Sources Pie */}
                <GlassCard className="p-5">
                  <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Revenue Sources</h3>
                  <div className="flex items-center justify-center mb-4">
                    <div
                      className="w-32 h-32 rounded-full"
                      style={{
                        background: `conic-gradient(
                          ${revenueSources.map((s, i) => `${s.color} ${i === 0 ? 0 : revenueSources.slice(0, i).reduce((a, b) => a + b.value, 0)}% ${revenueSources.slice(0, i + 1).reduce((a, b) => a + b.value, 0)}%`).join(', ')}
                        )`,
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    {revenueSources.map(s => (
                      <div key={s.label} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                          <span style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{s.label}</span>
                        </div>
                        <span className="font-semibold" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{s.value}%</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>

              {/* Hotel Performance Table */}
              {!selectedHotel && (
                <GlassCard className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-sm" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Hotel Performance</h3>
                    <button className="text-xs px-3 py-1.5 rounded-lg hover:shadow-sm transition-all cursor-pointer" style={{ background: 'rgba(99,102,241,0.10)', color: '#6366F1' }}>
                      View All
                    </button>
                  </div>
                  <DataTable
                    headers={['Hotel', 'Location', 'Rooms', 'Occupancy', 'Revenue Today', 'Status', 'Actions']}
                    rows={allHotels.map(h => {
                      const occ = h.rooms.length > 0 ? Math.round((h.rooms.filter(r => r.status === 'occupied').length / h.rooms.length) * 100) : 0;
                      return [
                        <div key="n" className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
                            <Building2 size={14} style={{ color: '#6366F1' }} />
                          </div>
                          <span className="font-medium text-sm" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{h.name}</span>
                        </div>,
                        <span key="l" className="text-xs opacity-60">{h.location}</span>,
                        <span key="r" className="text-xs font-medium">{h.rooms.length}</span>,
                        <div key="o" className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.05)' }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${occ}%`, background: occ > 75 ? '#10B981' : occ > 50 ? '#F59E0B' : '#EF4444' }} />
                          </div>
                          <span className="text-xs font-medium">{occ}%</span>
                        </div>,
                        <span key="rv" className="text-xs font-semibold" style={{ color: '#10B981' }}>{formatCurrency(h.revenueToday, 'TZS')}</span>,
                        <StatusBadge key="s" status={h.status} />,
                        <div key="a" className="flex items-center gap-1.5">
                          <button onClick={() => { setSelectedHotelId(h.id); setActiveTab('rooms'); }} className="p-1.5 rounded-lg hover:bg-white/50 transition-all cursor-pointer" title="View">
                            <Eye size={13} style={{ color: '#6366F1' }} />
                          </button>
                          <button className="p-1.5 rounded-lg hover:bg-white/50 transition-all cursor-pointer" title="Edit">
                            <Edit2 size={13} style={{ color: '#8B5CF6' }} />
                          </button>
                        </div>,
                      ];
                    })}
                  />
                </GlassCard>
              )}

              {/* Recent Bookings */}
              <GlassCard className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Recent Bookings</h3>
                  <button onClick={() => setActiveTab('bookings')} className="text-xs px-3 py-1.5 rounded-lg hover:shadow-sm transition-all cursor-pointer" style={{ background: 'rgba(99,102,241,0.10)', color: '#6366F1' }}>
                    View All
                  </button>
                </div>
                <DataTable
                  headers={['Guest', 'Room', 'Hotel', 'Check In', 'Check Out', 'Amount', 'Status']}
                  rows={aggregatedStats.allBookings.slice(0, 10).map(b => {
                    const hotel = allHotels.find(h => h.rooms.some(r => r.id === b.roomId));
                    const room = hotel?.rooms.find(r => r.id === b.roomId);
                    return [
                      <span key="g" className="text-xs font-medium" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{b.guestId}</span>,
                      <span key="r" className="text-xs opacity-60">{room?.number || '-'}</span>,
                      <span key="h" className="text-xs opacity-60">{hotel?.name || '-'}</span>,
                      <span key="ci" className="text-xs opacity-60">{formatDate(b.checkIn)}</span>,
                      <span key="co" className="text-xs opacity-60">{formatDate(b.checkOut)}</span>,
                      <span key="a" className="text-xs font-semibold" style={{ color: '#10B981' }}>{formatCurrency(b.totalAmount, 'TZS')}</span>,
                      <StatusBadge key="s" status={b.status} />,
                    ];
                  })}
                />
              </GlassCard>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* HOTELS TAB                                                 */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'hotels' && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Multi-Hotel Management</h2>
                <button
                  onClick={() => setShowAddHotel(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer transition-all hover:shadow-lg hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                >
                  <Plus size={16} /> Add Hotel
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {allHotels.map(h => {
                  const occ = h.rooms.length > 0 ? Math.round((h.rooms.filter(r => r.status === 'occupied').length / h.rooms.length) * 100) : 0;
                  return (
                    <GlassCard key={h.id} className="p-5 hover:shadow-lg transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
                            <Building2 size={20} style={{ color: '#6366F1' }} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{h.name}</h3>
                            <p className="text-xs opacity-50">{h.location}</p>
                          </div>
                        </div>
                        <StatusBadge status={h.status} />
                      </div>
                      <div className="grid grid-cols-4 gap-3 mb-4">
                        <MiniStat label="Rooms" value={h.rooms.length} />
                        <MiniStat label="Occupancy" value={`${occ}%`} />
                        <MiniStat label="Staff" value={h.staff.length} />
                        <MiniStat label="Revenue" value={formatCurrency(h.revenueToday, 'TZS').replace('TZS ', '')} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setSelectedHotelId(h.id); setActiveTab('rooms'); }} className="flex-1 text-xs py-2 rounded-lg font-medium transition-all cursor-pointer hover:shadow-sm" style={{ background: 'rgba(99,102,241,0.10)', color: '#6366F1' }}>
                          View Dashboard
                        </button>
                        <button className="px-3 py-2 rounded-lg transition-all cursor-pointer hover:shadow-sm" style={{ background: 'rgba(139,92,246,0.10)', color: '#8B5CF6' }}>
                          <Edit2 size={13} />
                        </button>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
              {/* Add Hotel Modal */}
              {showAddHotel && (
                <Modal title="Add New Hotel" onClose={() => setShowAddHotel(false)}>
                  <div className="flex flex-col gap-4">
                    <FormInput label="Hotel Name" placeholder="e.g., Kobe Plaza Hotel" value={hotelForm.name} onChange={v => setHotelForm(f => ({ ...f, name: v }))} />
                    <FormInput label="Location" placeholder="e.g., Mwanza, TZ" value={hotelForm.location} onChange={v => setHotelForm(f => ({ ...f, location: v }))} />
                    <FormInput label="Number of Rooms" type="number" placeholder="e.g., 20" value={hotelForm.rooms} onChange={v => setHotelForm(f => ({ ...f, rooms: v }))} />
                    <FormInput label="Phone" placeholder="+255 744 000 000" value={hotelForm.phone} onChange={v => setHotelForm(f => ({ ...f, phone: v }))} />
                    <FormInput label="Email" placeholder="hotel@kobe.co.tz" value={hotelForm.email} onChange={v => setHotelForm(f => ({ ...f, email: v }))} />
                    <div className="flex gap-3 mt-2">
                      <button onClick={() => setShowAddHotel(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer hover:bg-white/50" style={{ border: '1px solid rgba(0,0,0,0.08)', color: 'var(--os-text-primary, #2D2B55)' }}>
                        Cancel
                      </button>
                      <button onClick={() => void handleAddHotel()} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all cursor-pointer hover:opacity-90" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                        Create Hotel
                      </button>
                    </div>
                  </div>
                </Modal>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* ROOMS TAB                                                  */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'rooms' && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>
                  Room Management {selectedHotel && `- ${selectedHotel.name}`}
                </h2>
                <button
                  onClick={() => setShowAddRoom(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer transition-all hover:shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                >
                  <Plus size={16} /> Add Room
                </button>
              </div>
              {/* Room Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard title="Total" value={aggregatedStats.totalRooms} icon={<Bed size={16} />} accent="#6366F1" />
                <KpiCard title="Occupied" value={aggregatedStats.occupiedRooms} icon={<Users size={16} />} accent="#3B82F6" />
                <KpiCard title="Available" value={aggregatedStats.availableRooms} icon={<CheckCircle size={16} />} accent="#10B981" />
                <KpiCard title="Maintenance" value={aggregatedStats.maintenanceRooms} icon={<Settings size={16} />} accent="#F59E0B" />
              </div>
              {/* Room Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {aggregatedStats.allRooms.map(room => (
                  <RoomCard key={room.id} room={room} currency={selectedHotel?.currency || 'TZS'} />
                ))}
              </div>
              {/* Add Room Modal */}
              {showAddRoom && (
                <Modal title="Add New Room" onClose={() => setShowAddRoom(false)}>
                  <div className="flex flex-col gap-4">
                    <FormInput label="Room Number" placeholder="e.g., 101" value={roomForm.number} onChange={v => setRoomForm(f => ({ ...f, number: v }))} />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium opacity-60">Room Type</label>
                      <select value={roomForm.type} onChange={e => setRoomForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2" style={{ background: 'rgba(255,255,255,0.50)', borderColor: 'rgba(0,0,0,0.08)', color: 'var(--os-text-primary, #2D2B55)' }}>
                        <option>Standard</option><option>Deluxe</option><option>Suite</option><option>Presidential</option>
                      </select>
                    </div>
                    <FormInput label="Floor" type="number" placeholder="1" />
                    <FormInput label="Price per Night" type="number" placeholder="85000" value={roomForm.price} onChange={v => setRoomForm(f => ({ ...f, price: v }))} />
                    <FormInput label="Capacity" type="number" placeholder="2" value={roomForm.capacity} onChange={v => setRoomForm(f => ({ ...f, capacity: v }))} />
                    <div className="flex gap-3 mt-2">
                      <button onClick={() => setShowAddRoom(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer hover:bg-white/50" style={{ border: '1px solid rgba(0,0,0,0.08)', color: 'var(--os-text-primary, #2D2B55)' }}>Cancel</button>
                      <button onClick={() => void handleAddRoom()} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all cursor-pointer hover:opacity-90" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>Add Room</button>
                    </div>
                  </div>
                </Modal>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* BOOKINGS TAB                                               */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'bookings' && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Bookings</h2>
                <div className="flex items-center gap-3">
                  <select
                    value={bookingStatusFilter}
                    onChange={e => setBookingStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl text-xs font-medium border outline-none cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.50)', borderColor: 'rgba(0,0,0,0.08)', color: 'var(--os-text-primary, #2D2B55)' }}
                  >
                    <option value="all">All Status</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="checked-in">Checked In</option>
                    <option value="checked-out">Checked Out</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer transition-all hover:shadow-lg" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                    <Plus size={16} /> New Booking
                  </button>
                </div>
              </div>
              <GlassCard className="p-5">
                <DataTable
                  headers={['Guest', 'Room', 'Hotel', 'Check In', 'Check Out', 'Amount', 'Source', 'Status']}
                  rows={aggregatedStats.allBookings
                    .filter(b => bookingStatusFilter === 'all' || b.status === bookingStatusFilter)
                    .map(b => {
                      const hotel = allHotels.find(h => h.rooms.some(r => r.id === b.roomId));
                      const room = hotel?.rooms.find(r => r.id === b.roomId);
                      return [
                        <span key="g" className="text-xs font-medium" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{b.guestId}</span>,
                        <span key="r" className="text-xs opacity-60">{room?.number || '-'}</span>,
                        <span key="h" className="text-xs opacity-60">{hotel?.name || '-'}</span>,
                        <span key="ci" className="text-xs opacity-60">{formatDate(b.checkIn)}</span>,
                        <span key="co" className="text-xs opacity-60">{formatDate(b.checkOut)}</span>,
                        <span key="a" className="text-xs font-semibold" style={{ color: '#10B981' }}>{formatCurrency(b.totalAmount, 'TZS')}</span>,
                        <span key="src" className="text-xs capitalize opacity-60">{b.source}</span>,
                        <StatusBadge key="s" status={b.status} />,
                      ];
                    })}
                />
              </GlassCard>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* GUESTS TAB (NEW)                                           */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'guests' && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Guest Management</h2>
                <button
                  onClick={() => setShowAddGuest(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer transition-all hover:shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                >
                  <UserPlus size={16} /> Add Guest
                </button>
              </div>
              {/* Guest KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard title="Total Guests" value={aggregatedStats.allGuests.length} icon={<Users size={16} />} accent="#6366F1" />
                <KpiCard title="Checked In" value={aggregatedStats.occupiedRooms} icon={<CheckCircle size={16} />} accent="#10B981" />
                <KpiCard title="New Today" value={12} icon={<UserPlus size={16} />} accent="#F59E0B" />
                <KpiCard title="Returning" value={aggregatedStats.allGuests.filter(g => g.checkInCount > 1).length} icon={<Star size={16} />} accent="#EC4899" />
              </div>
              {/* Search */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                  <input
                    value={guestSearch}
                    onChange={e => setGuestSearch(e.target.value)}
                    placeholder="Search by name or phone..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-xs border outline-none focus:ring-2"
                    style={{ background: 'rgba(255,255,255,0.50)', borderColor: 'rgba(0,0,0,0.08)', color: 'var(--os-text-primary, #2D2B55)' }}
                  />
                </div>
              </div>
              {/* Guest Table */}
              <GlassCard className="p-5">
                <DataTable
                  headers={['Name', 'Phone', 'Email', 'Nationality', 'ID Type', 'ID Number', 'Stays', 'Actions']}
                  rows={aggregatedStats.allGuests
                    .filter(g => !guestSearch || g.name.toLowerCase().includes(guestSearch.toLowerCase()) || g.phone.includes(guestSearch))
                    .map(g => [
                      <div key="n" className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                          {g.name.charAt(0)}
                        </div>
                        <span className="text-xs font-medium" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{g.name}</span>
                      </div>,
                      <span key="p" className="text-xs opacity-60">{g.phone}</span>,
                      <span key="e" className="text-xs opacity-60">{g.email || '-'}</span>,
                      <span key="nat" className="text-xs opacity-60">{g.nationality || '-'}</span>,
                      <span key="idt" className="text-xs capitalize opacity-60">{g.idType?.replace('-', ' ') || '-'}</span>,
                      <span key="idn" className="text-xs opacity-60 font-mono">{g.idNumber || '-'}</span>,
                      <span key="st" className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ background: 'rgba(99,102,241,0.10)', color: '#6366F1' }}>{g.checkInCount}</span>,
                      <div key="a" className="flex items-center gap-1.5">
                        <button className="p-1.5 rounded-lg hover:bg-white/50 transition-all cursor-pointer" title="View History"><Eye size={13} style={{ color: '#6366F1' }} /></button>
                        <button className="p-1.5 rounded-lg hover:bg-white/50 transition-all cursor-pointer" title="Edit"><Edit2 size={13} style={{ color: '#8B5CF6' }} /></button>
                      </div>,
                    ])}
                />
              </GlassCard>
              {/* Add Guest Modal */}
              {showAddGuest && (
                <Modal title="Add New Guest" onClose={() => setShowAddGuest(false)}>
                  <div className="flex flex-col gap-4">
                    <FormInput label="Full Name" placeholder="e.g., John Doe" value={guestForm.name} onChange={v => setGuestForm(f => ({ ...f, name: v }))} />
                    <FormInput label="Phone" placeholder="+255 744 000 000" value={guestForm.phone} onChange={v => setGuestForm(f => ({ ...f, phone: v }))} />
                    <FormInput label="Email" placeholder="guest@email.com" value={guestForm.email} onChange={v => setGuestForm(f => ({ ...f, email: v }))} />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium opacity-60">ID Type</label>
                      <select value={guestForm.idType} onChange={e => setGuestForm(f => ({ ...f, idType: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none" style={{ background: 'rgba(255,255,255,0.50)', borderColor: 'rgba(0,0,0,0.08)', color: 'var(--os-text-primary, #2D2B55)' }}>
                        <option value="passport">Passport</option><option value="national_id">National ID</option><option value="driving_license">Driving License</option>
                      </select>
                    </div>
                    <FormInput label="ID Number" placeholder="e.g., AB123456" value={guestForm.idNumber} onChange={v => setGuestForm(f => ({ ...f, idNumber: v }))} />
                    <div className="flex gap-3 mt-2">
                      <button onClick={() => setShowAddGuest(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer hover:bg-white/50" style={{ border: '1px solid rgba(0,0,0,0.08)', color: 'var(--os-text-primary, #2D2B55)' }}>Cancel</button>
                      <button onClick={() => void handleAddGuest()} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all cursor-pointer hover:opacity-90" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>Add Guest</button>
                    </div>
                  </div>
                </Modal>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* RESTAURANT TAB                                             */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'restaurant' && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Restaurant & Bar</h2>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer hover:shadow-sm" style={{ background: 'rgba(99,102,241,0.10)', color: '#6366F1' }}>
                    <QrCode size={16} /> QR Ordering
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer hover:shadow-sm" style={{ background: 'rgba(16,185,129,0.10)', color: '#10B981' }}>
                    <ChefHat size={16} /> Kitchen Display
                  </button>
                </div>
              </div>
              {/* Orders */}
              <GlassCard className="p-5">
                <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Active Orders</h3>
                <DataTable
                  headers={['Order ID', 'Table/Room', 'Guest', 'Items', 'Total', 'Station', 'Status']}
                  rows={aggregatedStats.allOrders.map(o => [
                    <span key="id" className="text-xs font-mono opacity-60">{o.id}</span>,
                    <span key="tr" className="text-xs">{o.tableId ? `Table ${o.tableId}` : o.roomId ? `Room ${o.roomId}` : 'Walk-in'}</span>,
                    <span key="g" className="text-xs">{o.guestName || '-'}</span>,
                    <span key="it" className="text-xs">{o.items.length} items</span>,
                    <span key="tot" className="text-xs font-semibold" style={{ color: '#10B981' }}>{formatCurrency(o.total, 'TZS')}</span>,
                    <span key="stn" className="text-xs capitalize px-2 py-0.5 rounded-md" style={{ background: o.station === 'kitchen' ? 'rgba(16,185,129,0.10)' : o.station === 'bar' ? 'rgba(59,130,246,0.10)' : 'rgba(245,158,11,0.10)', color: o.station === 'kitchen' ? '#10B981' : o.station === 'bar' ? '#3B82F6' : '#F59E0B' }}>{o.station}</span>,
                    <StatusBadge key="s" status={o.status} />,
                  ])}
                />
              </GlassCard>
              {/* Menu */}
              <div className="flex flex-col gap-4">
                <h3 className="font-semibold text-sm" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Menu</h3>
                {(selectedHotel || allHotels[0]).menuCategories.map(cat => (
                  <GlassCard key={cat.id} className="p-5">
                    <h4 className="font-semibold text-sm mb-3" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{cat.name}</h4>
                    <div className="flex flex-col gap-2">
                      {cat.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/30 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.03)' }}>
                              <UtensilsCrossed size={16} className="opacity-30" />
                            </div>
                            <div>
                              <div className="text-xs font-medium" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{item.name}</div>
                              <div className="text-[11px] opacity-50">{item.description}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold" style={{ color: '#10B981' }}>{formatCurrency(item.price, 'TZS')}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md capitalize" style={{ background: item.station === 'kitchen' ? 'rgba(16,185,129,0.10)' : item.station === 'bar' ? 'rgba(59,130,246,0.10)' : 'rgba(245,158,11,0.10)', color: item.station === 'kitchen' ? '#10B981' : item.station === 'bar' ? '#3B82F6' : '#F59E0B' }}>{item.station}</span>
                            <div className="flex gap-1">
                              <button className="p-1.5 rounded-lg hover:bg-white/50 transition-all cursor-pointer"><Edit2 size={12} style={{ color: '#8B5CF6' }} /></button>
                              <button className="p-1.5 rounded-lg hover:bg-white/50 transition-all cursor-pointer"><Trash2 size={12} style={{ color: '#EF4444' }} /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* PARKING TAB (NEW)                                          */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'parking' && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Parking Management</h2>
                <button
                  onClick={() => setShowAssignSpot(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer transition-all hover:shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                >
                  <Car size={16} /> Assign Spot
                </button>
              </div>
              {/* Parking KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard title="Total Spots" value={aggregatedStats.totalParking} icon={<ParkingSquare size={16} />} accent="#6366F1" />
                <KpiCard title="Occupied" value={aggregatedStats.occupiedParking} icon={<CarFront size={16} />} accent="#3B82F6" />
                <KpiCard title="Free" value={aggregatedStats.totalParking - aggregatedStats.occupiedParking} icon={<CheckCircle size={16} />} accent="#10B981" />
                <KpiCard title="Reserved" value={aggregatedStats.allRooms.length > 0 ? 3 : 0} icon={<Clock size={16} />} accent="#F59E0B" />
              </div>
              {/* Parking Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {(selectedHotel || allHotels[0]).parkingSpots.map(spot => (
                  <div
                    key={spot.id}
                    className={classNames(
                      "rounded-2xl p-4 flex flex-col gap-2 transition-all hover:shadow-md border",
                      spot.status === 'occupied' && "border-l-4",
                      spot.status === 'free' && "border-l-4",
                      spot.status === 'reserved' && "border-l-4"
                    )}
                    style={{
                      background: 'rgba(255,255,255,0.30)',
                      backdropFilter: 'blur(16px)',
                      borderColor: spot.status === 'occupied' ? 'rgba(59,130,246,0.40)' : spot.status === 'reserved' ? 'rgba(245,158,11,0.40)' : 'rgba(16,185,129,0.40)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{spot.number}</span>
                      {spot.type === 'motorcycle' ? <Bike size={14} className="opacity-40" /> : spot.type === 'vip' ? <CarFront size={14} style={{ color: '#F59E0B' }} /> : <CarFront size={14} className="opacity-40" />}
                    </div>
                    <StatusBadge status={spot.status} />
                    {spot.vehiclePlate && (
                      <div className="mt-1">
                        <div className="text-xs font-mono font-semibold" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{spot.vehiclePlate}</div>
                        <div className="text-[10px] opacity-50">{spot.vehicleModel}</div>
                        {spot.guestName && <div className="text-[10px] opacity-60 mt-0.5">{spot.guestName}</div>}
                      </div>
                    )}
                    {spot.status === 'free' && <div className="text-[10px] opacity-40 mt-1">Available</div>}
                  </div>
                ))}
              </div>
              {/* Assign Spot Modal */}
              {showAssignSpot && (
                <Modal title="Assign Parking Spot" onClose={() => setShowAssignSpot(false)}>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium opacity-60">Spot</label>
                      <select className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none" style={{ background: 'rgba(255,255,255,0.50)', borderColor: 'rgba(0,0,0,0.08)', color: 'var(--os-text-primary, #2D2B55)' }}>
                        {(selectedHotel || allHotels[0]).parkingSpots.filter(s => s.status === 'free').map(s => <option key={s.id} value={s.id}>{s.number} - {s.type}</option>)}
                      </select>
                    </div>
                    <FormInput label="Guest Name" placeholder="Guest name" />
                    <FormInput label="Vehicle Plate" placeholder="T123 ABC" />
                    <FormInput label="Vehicle Model" placeholder="Toyota Prado" />
                    <div className="flex gap-3 mt-2">
                      <button onClick={() => setShowAssignSpot(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer hover:bg-white/50" style={{ border: '1px solid rgba(0,0,0,0.08)', color: 'var(--os-text-primary, #2D2B55)' }}>Cancel</button>
                      <button onClick={() => setShowAssignSpot(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all cursor-pointer hover:opacity-90" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>Assign Spot</button>
                    </div>
                  </div>
                </Modal>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* FINANCIALS TAB (NEW)                                       */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'financials' && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Financials</h2>
                <div className="flex items-center gap-2 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.30)' }}>
                  {(['today', 'week', 'month'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setFinancialPeriod(p)}
                      className={classNames(
                        "px-4 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer capitalize",
                        financialPeriod === p ? "text-white shadow-sm" : "opacity-50 hover:opacity-80"
                      )}
                      style={financialPeriod === p ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' } : {}}
                    >
                      {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Financial KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard
                  title="Revenue"
                  value={formatCurrency(financialPeriod === 'today' ? aggregatedStats.totalRevenueToday : financialPeriod === 'week' ? aggregatedStats.totalRevenueToday * 7 : aggregatedStats.totalRevenueMonth, 'TZS')}
                  subtitle="+12% vs last period" icon={<CircleDollarSign size={16} />} accent="#10B981" trend="up"
                />
                <KpiCard
                  title="Expenses"
                  value={formatCurrency(financialPeriod === 'today' ? aggregatedStats.totalExpensesToday : financialPeriod === 'week' ? aggregatedStats.totalExpensesToday * 7 : aggregatedStats.totalExpensesToday * 30, 'TZS')}
                  subtitle="-5% vs last period" icon={<Receipt size={16} />} accent="#EF4444" trend="down"
                />
                <KpiCard
                  title="Net Profit"
                  value={formatCurrency(financialPeriod === 'today' ? aggregatedStats.netProfit : financialPeriod === 'week' ? aggregatedStats.netProfit * 7 : aggregatedStats.netProfit * 30, 'TZS')}
                  subtitle="+18% vs last period" icon={<Wallet size={16} />} accent="#6366F1" trend="up"
                />
                <KpiCard title="Profit Margin" value={`${Math.round((aggregatedStats.netProfit / (aggregatedStats.totalRevenueToday || 1)) * 100)}%`} subtitle="Target: 65%" icon={<TrendingUp size={16} />} accent="#8B5CF6" trend="up" />
              </div>
              {/* Revenue vs Expenses Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GlassCard className="p-5">
                  <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Revenue vs Expenses</h3>
                  <div className="flex items-end gap-3 h-48">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                      const rev = [1.2, 1.5, 1.3, 1.8, 2.1, 2.4, 2.0][i] * 1000000;
                      const exp = [0.6, 0.7, 0.5, 0.8, 0.9, 1.0, 0.8][i] * 1000000;
                      return (
                        <div key={day} className="flex-1 flex flex-col items-center gap-1.5">
                          <div className="w-full flex gap-1 items-end justify-center" style={{ height: '140px' }}>
                            <div className="w-3 rounded-t-md" style={{ height: `${(rev / 2500000) * 120}px`, background: 'linear-gradient(180deg, #6366F1, #8B5CF6)' }} />
                            <div className="w-3 rounded-t-md" style={{ height: `${(exp / 2500000) * 120}px`, background: 'linear-gradient(180deg, #EF4444, #F87171)' }} />
                          </div>
                          <span className="text-[10px] opacity-40 font-medium">{day}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-center gap-6 mt-3">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: '#6366F1' }} /><span className="text-xs opacity-60">Revenue</span></div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: '#EF4444' }} /><span className="text-xs opacity-60">Expenses</span></div>
                  </div>
                </GlassCard>
                {/* Revenue Breakdown */}
                <GlassCard className="p-5">
                  <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Revenue Breakdown</h3>
                  <div className="flex flex-col gap-4">
                    {[
                      { label: 'Room Revenue', amount: aggregatedStats.totalRevenueToday * 0.62, color: '#6366F1', icon: <Bed size={14} /> },
                      { label: 'Restaurant & Bar', amount: aggregatedStats.totalRevenueToday * 0.23, color: '#10B981', icon: <UtensilsCrossed size={14} /> },
                      { label: 'Services & Amenities', amount: aggregatedStats.totalRevenueToday * 0.10, color: '#F59E0B', icon: <Star size={14} /> },
                      { label: 'Parking', amount: aggregatedStats.totalRevenueToday * 0.05, color: '#EC4899', icon: <Car size={14} /> },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${item.color}15`, color: item.color }}>{item.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{item.label}</span>
                            <span className="text-xs font-semibold" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{formatCurrency(item.amount, 'TZS')}</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: 'rgba(0,0,0,0.04)' }}>
                            <div className="h-full rounded-full" style={{ width: `${(item.amount / (aggregatedStats.totalRevenueToday || 1)) * 100}%`, background: item.color }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>
              {/* Expense Breakdown Table */}
              <GlassCard className="p-5">
                <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Expense Tracking</h3>
                <DataTable
                  headers={['Category', 'Description', 'Amount', 'Date', 'Status']}
                  rows={[
                    ['Staff Salaries', 'Monthly payroll for all staff', 1850000, '2026-01-15', 'paid'],
                    ['Maintenance', 'HVAC repair Room 102', 320000, '2026-01-14', 'paid'],
                    ['Supplies', 'Cleaning supplies & toiletries', 180000, '2026-01-13', 'pending'],
                    ['Utilities', 'Electricity & water bill', 450000, '2026-01-12', 'paid'],
                    ['Food & Beverage', 'Restaurant inventory restock', 680000, '2026-01-11', 'pending'],
                    ['Marketing', 'Social media ads', 120000, '2026-01-10', 'paid'],
                  ].map((row, i) => [
                    <span key="c" className="text-xs font-medium" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{row[0]}</span>,
                    <span key="d" className="text-xs opacity-60">{row[1]}</span>,
                    <span key="a" className="text-xs font-semibold" style={{ color: '#EF4444' }}>{formatCurrency(row[2] as number, 'TZS')}</span>,
                    <span key="dt" className="text-xs opacity-60">{row[3]}</span>,
                    <StatusBadge key="s" status={row[4] as string} />,
                  ])}
                />
              </GlassCard>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* ANALYTICS TAB                                              */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'analytics' && (
            <div className="flex flex-col gap-5">
              <h2 className="text-xl font-bold" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Analytics Dashboard</h2>
              {/* Analytics KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard title="Occupancy Rate" value={`${aggregatedStats.occupancyRate}%`} subtitle="Avg last 30 days" icon={<Percent size={16} />} accent="#6366F1" />
                <KpiCard title="Avg Daily Rate" value={formatCurrency(selectedHotel?.rooms[0]?.pricePerNight || 150000, 'TZS')} subtitle="Per room/night" icon={<DollarSign size={16} />} accent="#10B981" />
                <KpiCard title="RevPAR" value={formatCurrency(Math.round((aggregatedStats.occupancyRate / 100) * (selectedHotel?.rooms[0]?.pricePerNight || 150000)), 'TZS')} subtitle="Revenue per available room" icon={<TrendingUp size={16} />} accent="#8B5CF6" />
                <KpiCard title="Guest Rating" value="4.8/5" subtitle="Based on 128 reviews" icon={<Star size={16} />} accent="#F59E0B" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly Revenue Trend */}
                <GlassCard className="p-5">
                  <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Monthly Revenue Trend</h3>
                  <div className="flex items-end gap-3 h-48">
                    {['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'].map((m, i) => {
                      const val = [28, 32, 30, 38, 35, 42, 45][i];
                      return (
                        <div key={m} className="flex-1 flex flex-col items-center gap-1.5 group">
                          <div className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#6366F1' }}>TZS {val}M</div>
                          <div className="w-full rounded-t-md transition-all hover:opacity-80" style={{ height: `${val * 2.8}px`, background: i === 6 ? 'linear-gradient(180deg, #6366F1, #8B5CF6)' : 'linear-gradient(180deg, rgba(99,102,241,0.35), rgba(139,92,246,0.15))' }} />
                          <span className="text-[10px] opacity-40 font-medium">{m}</span>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>
                {/* Guest Satisfaction */}
                <GlassCard className="p-5">
                  <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Guest Satisfaction</h3>
                  <div className="flex flex-col gap-3">
                    {[
                      { label: 'Cleanliness', score: 4.9 },
                      { label: 'Staff Service', score: 4.7 },
                      { label: 'Food Quality', score: 4.6 },
                      { label: 'Room Comfort', score: 4.8 },
                      { label: 'Value for Money', score: 4.5 },
                      { label: 'Location', score: 4.9 },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-3">
                        <span className="text-xs w-28" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{item.label}</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.04)' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${(item.score / 5) * 100}%`, background: item.score >= 4.8 ? '#10B981' : item.score >= 4.5 ? '#6366F1' : '#F59E0B' }} />
                        </div>
                        <span className="text-xs font-semibold w-8 text-right" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{item.score}</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>
              {/* Top Revenue Sources */}
              <GlassCard className="p-5">
                <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Top Revenue Sources by Hotel</h3>
                <DataTable
                  headers={['Hotel', 'Room Revenue', 'Restaurant', 'Services', 'Parking', 'Total']}
                  rows={allHotels.map(h => {
                    const total = h.revenueToday;
                    return [
                      <span key="n" className="text-xs font-medium" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{h.name}</span>,
                      <span key="rr" className="text-xs">{formatCurrency(total * 0.62, 'TZS')}</span>,
                      <span key="rt" className="text-xs">{formatCurrency(total * 0.23, 'TZS')}</span>,
                      <span key="rs" className="text-xs">{formatCurrency(total * 0.10, 'TZS')}</span>,
                      <span key="rp" className="text-xs">{formatCurrency(total * 0.05, 'TZS')}</span>,
                      <span key="tot" className="text-xs font-semibold" style={{ color: '#10B981' }}>{formatCurrency(total, 'TZS')}</span>,
                    ];
                  })}
                />
              </GlassCard>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* WEBSITE TAB                                                */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'website' && (
            <div className="flex flex-col gap-5">
              <h2 className="text-xl font-bold" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Website Builder</h2>
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-base" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Public Website</h3>
                    <p className="text-xs opacity-50 mt-1">Your hotel website is live at: <span className="font-medium" style={{ color: '#6366F1' }}>https://{(selectedHotel || allHotels[0]).subdomain}.kobe</span></p>
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer transition-all hover:shadow-lg" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                    <Eye size={16} /> Preview
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <FormInput label="Hotel Name" defaultValue={(selectedHotel || allHotels[0]).name} />
                  <FormInput label="Subdomain" defaultValue={(selectedHotel || allHotels[0]).subdomain} />
                  <FormInput label="Phone" defaultValue={(selectedHotel || allHotels[0]).phone} />
                  <FormInput label="Email" defaultValue={(selectedHotel || allHotels[0]).email} />
                </div>
                <div className="mb-4">
                  <label className="text-xs font-medium opacity-60 mb-1.5 block">Address</label>
                  <textarea
                    defaultValue={(selectedHotel || allHotels[0]).address}
                    className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 resize-y min-h-[80px]"
                    style={{ background: 'rgba(255,255,255,0.50)', borderColor: 'rgba(0,0,0,0.08)', color: 'var(--os-text-primary, #2D2B55)' }}
                  />
                </div>
                <div className="flex flex-col gap-3 mb-6">
                  <label className="flex items-center gap-2.5 text-xs cursor-pointer" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>
                    <input type="checkbox" defaultChecked={(selectedHotel || allHotels[0]).settings.enableQROrdering} className="rounded" />
                    Enable QR Ordering
                  </label>
                  <label className="flex items-center gap-2.5 text-xs cursor-pointer" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>
                    <input type="checkbox" defaultChecked={(selectedHotel || allHotels[0]).settings.enableRoomService} className="rounded" />
                    Enable Room Service
                  </label>
                </div>
                <div className="flex gap-3">
                  <button className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer hover:bg-white/50" style={{ border: '1px solid rgba(0,0,0,0.08)', color: 'var(--os-text-primary, #2D2B55)' }}>Reset</button>
                  <button className="px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-all cursor-pointer hover:opacity-90" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>Save Changes</button>
                </div>
              </GlassCard>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

// ── Sub-Components ──────────────────────────────────────────────────────────

/** Glassmorphism card container */
const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div
    className={classNames("rounded-2xl border", className)}
    style={{ background: 'rgba(255,255,255,0.30)', backdropFilter: 'blur(24px)', borderColor: 'rgba(255,255,255,0.40)' }}
  >
    {children}
  </div>
);

/** KPI Card with colored accent */
const KpiCard: React.FC<{
  title: string; value: string | number; subtitle?: string;
  icon: React.ReactNode; accent: string; trend?: 'up' | 'down' | 'neutral';
}> = ({ title, value, subtitle, icon, accent, trend }) => (
  <div
    className="rounded-2xl p-4 flex flex-col gap-2 transition-all hover:shadow-lg border-t-4"
    style={{ background: 'rgba(255,255,255,0.30)', backdropFilter: 'blur(24px)', borderColor: 'rgba(255,255,255,0.40)', borderTopColor: accent }}
  >
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-wider opacity-50">{title}</span>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}15`, color: accent }}>{icon}</div>
    </div>
    <div className="text-xl font-bold" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{value}</div>
    {subtitle && (
      <div className="flex items-center gap-1">
        {trend === 'up' && <ArrowUpRight size={12} style={{ color: '#10B981' }} />}
        {trend === 'down' && <ArrowDownRight size={12} style={{ color: '#EF4444' }} />}
        {trend === 'neutral' && <Minus size={12} className="opacity-30" />}
        <span className="text-[11px] opacity-50">{subtitle}</span>
      </div>
    )}
  </div>
);

/** Mini stat for hotel cards */
const MiniStat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="text-center p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.20)' }}>
    <div className="text-sm font-bold" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{value}</div>
    <div className="text-[10px] opacity-50 mt-0.5">{label}</div>
  </div>
);

/** Status badge with dynamic colors */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors = getStatusColor(status);
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
    >
      {status.replace(/[_-]/g, ' ')}
    </span>
  );
};

/** Room card with guest info */
const RoomCard: React.FC<{ room: Room; currency: string }> = ({ room, currency }) => {
  const colors = getStatusColor(room.status);
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 transition-all hover:shadow-lg border-l-4"
      style={{ background: 'rgba(255,255,255,0.30)', backdropFilter: 'blur(16px)', borderColor: 'rgba(255,255,255,0.40)', borderLeftColor: colors.text }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-bold" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>Room {room.number}</div>
          <div className="text-xs opacity-50">{room.type} &middot; Floor {room.floor}</div>
        </div>
        <StatusBadge status={room.status} />
      </div>
      <div className="text-lg font-bold" style={{ color: '#10B981' }}>
        {formatCurrency(room.pricePerNight, currency)}<span className="text-xs font-normal opacity-50 ml-1">/night</span>
      </div>
      {room.currentGuest && (
        <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
          <div className="text-[10px] opacity-50 uppercase tracking-wide">Current Guest</div>
          <div className="text-xs font-semibold mt-0.5" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{room.currentGuest.name}</div>
          <div className="text-[11px] opacity-50">Until {formatDate(room.currentGuest.checkOutDate)}</div>
        </div>
      )}
      {room.qrCode && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6366F1' }}>
          <QrCode size={12} /> QR Code Active
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {room.amenities.slice(0, 4).map(a => (
          <span key={a} className="text-[9px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1' }}>{a}</span>
        ))}
      </div>
    </div>
  );
};

/** Data table with glass styling */
const DataTable: React.FC<{ headers: string[]; rows: React.ReactNode[][] }> = ({ headers, rows }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          {headers.map((h, i) => (
            <th key={i} className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider opacity-40">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="transition-all hover:bg-white/20" style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
            {row.map((cell, j) => (
              <td key={j} className="px-3 py-2.5 whitespace-nowrap">{cell}</td>
            ))}
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={headers.length} className="text-center py-8 text-xs opacity-40">No data available</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

/** Modal overlay */
const Modal: React.FC<{ title: string; children: React.ReactNode; onClose: () => void }> = ({ title, children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
    <div
      className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl border"
      style={{ background: 'rgba(255,255,255,0.90)', backdropFilter: 'blur(32px)', borderColor: 'rgba(255,255,255,0.50)' }}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-base" style={{ color: 'var(--os-text-primary, #2D2B55)' }}>{title}</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 transition-all cursor-pointer"><X size={16} /></button>
      </div>
      {children}
    </div>
  </div>
);

/** Form input field */
const FormInput: React.FC<{
  label: string; type?: string; placeholder?: string; defaultValue?: string;
  value?: string; onChange?: (v: string) => void;
}> = ({ label, type = 'text', placeholder, defaultValue, value, onChange }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-medium opacity-60">{label}</label>
    <input
      type={type}
      placeholder={placeholder}
      {...(onChange ? { value: value ?? '', onChange: (e) => onChange(e.target.value) } : { defaultValue })}
      className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 transition-all"
      style={{ background: 'rgba(255,255,255,0.50)', borderColor: 'rgba(0,0,0,0.08)', color: 'var(--os-text-primary, #2D2B55)' }}
    />
  </div>
);

export default HotelAdminDashboard;
